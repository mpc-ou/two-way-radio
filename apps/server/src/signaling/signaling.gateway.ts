import { Inject, Logger } from '@nestjs/common';
import { ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import {
  CHAT_MAX_LENGTH,
  ClientEvent,
  finiteNumber,
  isRecord,
  nonEmptyString,
  ServerEvent,
  type ChannelInfo,
  type ConnectWebRtcTransportPayload,
  type CreateWebRtcTransportPayload,
  type ErrorPayload,
  type HeartbeatPayload,
  type JoinChannelPayload,
  type ProduceAudioPayload,
  type ReleaseFloorPayload,
  type ResumeAudioConsumerPayload,
  type RoomStatePayload,
  type SocketAck,
  type UpdateAudioProfilePayload
} from '@mpc-voicelink/protocol';
import { readConfig } from '../config/config.js';
import { MediaService, type ConsumerClosedDispatch, type ConsumerDispatch } from '../media/media.service.js';
import { JoinChannelError, RoomsService } from '../rooms/rooms.service.js';

interface SocketSession {
  roomId?: string;
  clientId: string;
}

type AckCallback<T> = (response: SocketAck<T>) => void;

class AckError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
  }
}

/** Giới hạn số lần nhập sai PIN theo địa chỉ IP. */
class AttemptThrottle {
  private readonly entries = new Map<string, { count: number; resetAt: number }>();

  isBlocked(key: string, now = Date.now()): boolean {
    const entry = this.entries.get(key);
    if (!entry) return false;
    if (entry.resetAt <= now) {
      this.entries.delete(key);
      return false;
    }
    return entry.count >= readConfig().joinMaxFailures;
  }

  recordFailure(key: string, now = Date.now()): void {
    const entry = this.entries.get(key);
    if (!entry || entry.resetAt <= now) {
      this.entries.set(key, { count: 1, resetAt: now + readConfig().joinBlockMs });
      return;
    }
    entry.count += 1;
  }
}

@WebSocketGateway({
  cors: {
    origin: (_origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // FE được phục vụ từ chính server này (cùng origin); cho phép mọi origin trong LAN.
      callback(null, true);
    },
    methods: ['GET', 'POST'],
    credentials: true
  }
})
export class SignalingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(SignalingGateway.name);
  private readonly sessions = new Map<string, SocketSession>();
  private readonly pinThrottle = new AttemptThrottle();
  /** Thời điểm các tin chat gần đây theo socket (tối đa CHAT_BURST tin / CHAT_WINDOW_MS). */
  private readonly chatTimes = new Map<string, number[]>();
  /** Thao tác pause/resume Producer theo floor được tuần tự hóa cho từng channel. */
  private readonly floorQueues = new Map<string, Promise<void>>();
  private channelsUpdateTimer?: NodeJS.Timeout;

  @WebSocketServer()
  private server!: Server;

  constructor(
    @Inject(RoomsService) private readonly rooms: RoomsService,
    @Inject(MediaService) private readonly media: MediaService
  ) {
    this.rooms.onFloorReleased(({ payload }) => {
      // Khóa Producer trước rồi mới báo FLOOR_RELEASED.
      void this.enqueueFloor(payload.roomId, async () => {
        await this.media.setProducerPaused(payload.roomId, payload.previousSpeakerClientId, true);
        this.server.to(payload.roomId).emit(ServerEvent.FloorReleased, payload);
        this.broadcastRoomState(payload.roomId);
      });
    });
  }

  handleConnection(socket: Socket): void {
    this.logger.log(`Client connected: ${socket.id} (${this.clientIp(socket)})`);
    socket.on('disconnect', (reason) => {
      const session = this.sessions.get(socket.id);
      this.logger.log(`Client disconnected: ${socket.id} (${this.clientIp(socket)}) channel=${session?.roomId ?? '-'} reason=${reason}`);
    });
    this.registerAckHandlers(socket);
  }

  handleDisconnect(socket: Socket): void {
    this.chatTimes.delete(socket.id);
    this.emitConsumerClosures(this.media.closeClientMedia(socket.id));
    const session = this.sessions.get(socket.id);
    this.sessions.delete(socket.id);
    if (session?.roomId) this.leaveRoom(socket, session, true);
  }

  @SubscribeMessage(ClientEvent.RequestFloor)
  requestFloor(@ConnectedSocket() socket: Socket): void {
    try {
      const session = this.requireChannel(socket);
      const result = this.rooms.requestFloor(session.roomId, session.clientId);
      if (!result.granted) {
        socket.emit(ServerEvent.FloorDenied, { roomId: session.roomId, speakerClientId: result.speakerClientId });
        return;
      }

      // Mở Producer trước rồi mới báo FLOOR_GRANTED để tiếng nói đi ngay khi client bật track.
      void this.enqueueFloor(session.roomId, async () => {
        if (this.rooms.currentSpeaker(session.roomId) !== session.clientId) return;
        await this.media.setProducerPaused(session.roomId, session.clientId, false);
        socket.emit(ServerEvent.FloorGranted, {
          roomId: session.roomId,
          floorToken: result.floorToken,
          expiresAt: result.expiresAt,
          heartbeatIntervalMs: readConfig().heartbeatIntervalMs
        });
        this.server.to(session.roomId).emit(ServerEvent.RoomState, result.state);
        this.scheduleChannelsUpdate();
      });
    } catch (error) {
      this.sendError(socket, 'FLOOR_REQUEST_FAILED', this.errorMessage(error));
    }
  }

  @SubscribeMessage(ClientEvent.ReleaseFloor)
  releaseFloor(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown): void {
    try {
      const session = this.requireChannel(socket);
      const payload = this.parseRelease(body);
      const released = this.rooms.releaseFloor(session.roomId, session.clientId, payload.floorToken);
      if (!released) this.sendError(socket, 'STALE_FLOOR_TOKEN', 'Floor lease is no longer active.');
    } catch (error) {
      this.sendError(socket, 'FLOOR_RELEASE_FAILED', this.errorMessage(error));
    }
  }

  @SubscribeMessage(ClientEvent.Heartbeat)
  heartbeat(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown): void {
    try {
      const session = this.requireChannel(socket);
      const payload = this.parseHeartbeat(body);
      const valid = this.rooms.heartbeat(session.roomId, session.clientId, payload.floorToken);
      if (!valid) this.sendError(socket, 'STALE_FLOOR_TOKEN', 'Floor lease is no longer active.');
    } catch (error) {
      this.sendError(socket, 'HEARTBEAT_FAILED', this.errorMessage(error));
    }
  }

  private registerAckHandlers(socket: Socket): void {
    this.onAck(socket, ClientEvent.ListChannels, (): ChannelInfo[] => this.rooms.listChannels());

    this.onAck(socket, ClientEvent.JoinChannel, async (body): Promise<RoomStatePayload> => {
      const ip = this.clientIp(socket);
      if (this.pinThrottle.isBlocked(ip)) {
        throw new AckError('PIN_BLOCKED', 'Nhập sai PIN quá nhiều lần. Vui lòng thử lại sau ít phút.');
      }
      const payload = this.parseJoin(body);
      const current = this.sessions.get(socket.id);
      if (current && current.clientId !== payload.clientId) {
        throw new AckError('JOIN_FAILED', 'Socket đã gắn với một client khác.');
      }
      if (current?.roomId === payload.channelId) {
        return this.rooms.getRoomState(payload.channelId)!;
      }

      let state: RoomStatePayload;
      try {
        state = this.rooms.join({
          roomId: payload.channelId,
          clientId: payload.clientId,
          displayName: payload.displayName,
          socketId: socket.id,
          pin: payload.pin
        });
      } catch (error) {
        if (error instanceof JoinChannelError) {
          if (error.code === 'PIN_INVALID') this.pinThrottle.recordFailure(ip);
          throw new AckError(error.code, error.message);
        }
        throw error;
      }

      // Rời channel cũ sau khi đã vào được channel mới (đổi channel không bị "rơi" giữa chừng).
      if (current?.roomId) this.leaveRoom(socket, current, false);
      const session: SocketSession = { roomId: payload.channelId, clientId: payload.clientId };
      this.sessions.set(socket.id, session);
      socket.join(payload.channelId);

      const changes = await this.media.enterRoom(socket.id, payload.clientId, payload.channelId);
      this.emitConsumerClosures(changes.closed);
      this.emitNewConsumers(changes.created);
      socket.emit(ServerEvent.AudioProfile, this.media.getAudioProfile());
      socket.emit(ServerEvent.ChatHistory, { roomId: payload.channelId, messages: this.rooms.chatHistory(payload.channelId) });
      socket.to(payload.channelId).emit(ServerEvent.RoomState, state);
      this.scheduleChannelsUpdate();
      return state;
    });

    this.onAck(socket, ClientEvent.SendChat, (body) => {
      const session = this.requireChannel(socket);
      const text = this.parseChatText(body);
      if (!this.chatAllowed(socket.id)) {
        throw new AckError('CHAT_RATE_LIMITED', 'Gửi quá nhanh, chờ một chút.');
      }
      const message = this.rooms.addChat(session.roomId, session.clientId, text);
      this.server.to(session.roomId).emit(ServerEvent.ChatMessage, message);
      return message;
    });

    this.onAck(socket, ClientEvent.LeaveChannel, () => {
      const session = this.sessions.get(socket.id);
      if (session?.roomId) this.leaveRoom(socket, session, false);
      return {};
    });

    this.onAck(socket, ClientEvent.GetMediaCapabilities, () => {
      this.requireChannel(socket);
      return {
        routerRtpCapabilities: this.media.getRouterRtpCapabilities(),
        audioProfile: this.media.getAudioProfile()
      };
    });

    this.onAck(socket, ClientEvent.CreateWebRtcTransport, async (body) => {
      const session = this.requireChannel(socket);
      const payload = this.parseCreateTransport(body);
      const result = await this.media.createWebRtcTransport({
        socketId: socket.id,
        clientId: session.clientId,
        ...payload
      });
      return {
        transport: result.transport,
        consumers: result.consumers.map((dispatch) => dispatch.payload)
      };
    });

    this.onAck(socket, ClientEvent.ConnectWebRtcTransport, async (body) => {
      const payload = this.parseConnectTransport(body);
      await this.media.connectWebRtcTransport(socket.id, payload.transportId, payload.dtlsParameters);
      return {};
    });

    this.onAck(socket, ClientEvent.RestartIce, async (body) => {
      if (!isRecord(body) || !nonEmptyString(body.transportId)) {
        throw new Error('RESTART_ICE requires transportId.');
      }
      return { iceParameters: await this.media.restartIce(socket.id, body.transportId) };
    });

    this.onAck(socket, ClientEvent.ProduceAudio, async (body) => {
      const session = this.requireChannel(socket);
      const payload = this.parseProduceAudio(body);
      const result = await this.media.produceAudio({
        socketId: socket.id,
        transportId: payload.transportId,
        rtpParameters: payload.rtpParameters,
        startResumed: this.rooms.currentSpeaker(session.roomId) === session.clientId
      });
      this.emitConsumerClosures(result.closedConsumers);
      this.emitNewConsumers(result.consumers);
      return { producerId: result.producerId };
    });

    this.onAck(socket, ClientEvent.ResumeAudioConsumer, async (body) => {
      const payload = this.parseResumeConsumer(body);
      await this.media.resumeAudioConsumer(socket.id, payload.consumerId);
      return {};
    });

    this.onAck(socket, ClientEvent.CloseMedia, () => {
      this.emitConsumerClosures(this.media.closeClientMedia(socket.id));
      return {};
    });

    this.onAck(socket, ClientEvent.UpdateAudioProfile, (body) => {
      const session = this.requireChannel(socket);
      const payload = this.parseAudioProfileUpdate(body);
      if (!this.rooms.validateAdmin(payload.controlCode)) {
        throw new AckError('FORBIDDEN', 'Sai mã admin (AUDIO_CONTROL_CODE).');
      }
      const profile = this.media.updateAudioProfile(payload);
      this.server.to(session.roomId).emit(ServerEvent.AudioProfile, profile);
      return profile;
    });

    this.onAck(socket, ClientEvent.ForceReleaseFloor, (body) => {
      const session = this.requireChannel(socket);
      const controlCode = isRecord(body) && typeof body.controlCode === 'string' ? body.controlCode : undefined;
      if (!this.rooms.validateAdmin(controlCode)) {
        throw new AckError('FORBIDDEN', 'Sai mã admin (AUDIO_CONTROL_CODE).');
      }
      this.rooms.forceReleaseFloor(session.roomId);
      return { success: true };
    });
  }

  private leaveRoom(socket: Socket, session: SocketSession, disconnected: boolean): void {
    const roomId = session.roomId;
    if (!roomId) return;
    if (!disconnected) this.emitConsumerClosures(this.media.leaveRoom(socket.id));
    socket.leave(roomId);
    session.roomId = undefined;
    const { state } = this.rooms.leave(roomId, session.clientId, socket.id);
    this.server.to(roomId).emit(ServerEvent.ClientDisconnected, { roomId, clientId: session.clientId });
    if (state) this.server.to(roomId).emit(ServerEvent.RoomState, state);
    this.scheduleChannelsUpdate();
  }

  private enqueueFloor(roomId: string, task: () => Promise<void>): Promise<void> {
    const previous = this.floorQueues.get(roomId) ?? Promise.resolve();
    const next = previous.then(task).catch((error: unknown) => {
      this.logger.warn(`Floor media update failed in ${roomId}: ${this.errorMessage(error)}`);
    });
    this.floorQueues.set(roomId, next);
    return next;
  }

  /** Gộp nhiều thay đổi liên tiếp thành một CHANNELS_UPDATE gửi tới mọi client. */
  private scheduleChannelsUpdate(): void {
    if (this.channelsUpdateTimer) return;
    this.channelsUpdateTimer = setTimeout(() => {
      this.channelsUpdateTimer = undefined;
      this.server.emit(ServerEvent.ChannelsUpdate, this.rooms.listChannels());
    }, 100);
  }

  private onAck<T>(socket: Socket, event: string, action: (body: unknown) => T | Promise<T>): void {
    socket.on(event, (body: unknown, callback: unknown) => {
      if (typeof callback !== 'function') {
        this.sendError(socket, 'ACK_REQUIRED', `${event} requires a Socket.IO acknowledgement callback.`);
        return;
      }
      const acknowledgement = callback as AckCallback<T>;
      // new Promise để lỗi ném đồng bộ trong action vẫn được trả về qua ack.
      void new Promise<T>((resolve) => resolve(action(body)))
        .then((data) => acknowledgement({ ok: true, data }))
        .catch((error: unknown) => {
          const code = error instanceof AckError ? error.code : 'REQUEST_FAILED';
          const message = this.errorMessage(error);
          if (!(error instanceof AckError)) this.logger.warn(`${event} failed for socket ${socket.id}: ${message}`);
          acknowledgement({ ok: false, error: { code, message } });
        });
    });
  }

  private emitNewConsumers(dispatches: ConsumerDispatch[]): void {
    for (const dispatch of dispatches) {
      this.server.to(dispatch.socketId).emit(ServerEvent.AudioConsumerCreated, dispatch.payload);
    }
  }

  private emitConsumerClosures(dispatches: ConsumerClosedDispatch[]): void {
    for (const dispatch of dispatches) {
      this.server.to(dispatch.socketId).emit(ServerEvent.AudioConsumerClosed, dispatch.payload);
    }
  }

  private broadcastRoomState(roomId: string): void {
    const state = this.rooms.getRoomState(roomId);
    if (state) this.server.to(roomId).emit(ServerEvent.RoomState, state);
    this.scheduleChannelsUpdate();
  }

  private requireChannel(socket: Socket): { roomId: string; clientId: string } {
    const session = this.sessions.get(socket.id);
    if (!session?.roomId) throw new Error('JOIN_CHANNEL is required before this action.');
    return { roomId: session.roomId, clientId: session.clientId };
  }

  private parseJoin(body: unknown): JoinChannelPayload {
    if (!isRecord(body) || !nonEmptyString(body.channelId) || !nonEmptyString(body.clientId) ||
        !nonEmptyString(body.displayName)) {
      throw new AckError('JOIN_FAILED', 'JOIN_CHANNEL requires channelId, clientId and displayName.');
    }
    return {
      channelId: body.channelId.trim(),
      clientId: body.clientId.trim().slice(0, 64),
      displayName: body.displayName.trim().slice(0, 40),
      pin: typeof body.pin === 'string' && body.pin.trim() ? body.pin.trim() : undefined
    };
  }

  private parseChatText(body: unknown): string {
    if (!isRecord(body) || typeof body.text !== 'string') throw new AckError('CHAT_INVALID', 'Tin nhắn không hợp lệ.');
    // Bỏ ký tự điều khiển (giữ xuống dòng), gộp khoảng trắng thừa ở hai đầu.
    const text = body.text.replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '').trim();
    if (!text) throw new AckError('CHAT_INVALID', 'Tin nhắn trống.');
    if (text.length > CHAT_MAX_LENGTH) throw new AckError('CHAT_TOO_LONG', `Tin nhắn tối đa ${CHAT_MAX_LENGTH} ký tự.`);
    return text;
  }

  private chatAllowed(socketId: string, now = Date.now()): boolean {
    const CHAT_BURST = 5;
    const CHAT_WINDOW_MS = 5000;
    const recent = (this.chatTimes.get(socketId) ?? []).filter((at) => now - at < CHAT_WINDOW_MS);
    if (recent.length >= CHAT_BURST) {
      this.chatTimes.set(socketId, recent);
      return false;
    }
    recent.push(now);
    this.chatTimes.set(socketId, recent);
    return true;
  }

  private parseRelease(body: unknown): ReleaseFloorPayload {
    if (!isRecord(body) || !nonEmptyString(body.floorToken)) {
      throw new Error('RELEASE_FLOOR requires floorToken.');
    }
    return { floorToken: body.floorToken };
  }

  private parseHeartbeat(body: unknown): HeartbeatPayload {
    if (body === undefined || body === null) return {};
    if (!isRecord(body)) throw new Error('HEARTBEAT payload must be an object.');
    if (body.floorToken !== undefined && !nonEmptyString(body.floorToken)) {
      throw new Error('HEARTBEAT floorToken must be a non-empty string.');
    }
    return { floorToken: body.floorToken as string | undefined };
  }

  private parseCreateTransport(body: unknown): CreateWebRtcTransportPayload {
    if (!isRecord(body) || (body.direction !== 'send' && body.direction !== 'recv')) {
      throw new Error('CREATE_WEBRTC_TRANSPORT requires direction send or recv.');
    }
    if (body.direction === 'recv' && !isRecord(body.rtpCapabilities)) {
      throw new Error('Receive transport requires RTP capabilities.');
    }
    return {
      direction: body.direction,
      ...(isRecord(body.rtpCapabilities) ? { rtpCapabilities: body.rtpCapabilities } : {})
    };
  }

  private parseConnectTransport(body: unknown): ConnectWebRtcTransportPayload {
    if (!isRecord(body) || !nonEmptyString(body.transportId) || !isRecord(body.dtlsParameters)) {
      throw new Error('CONNECT_WEBRTC_TRANSPORT requires transportId and DTLS parameters.');
    }
    return { transportId: body.transportId, dtlsParameters: body.dtlsParameters };
  }

  private parseProduceAudio(body: unknown): ProduceAudioPayload {
    if (!isRecord(body) || !nonEmptyString(body.transportId) || body.kind !== 'audio' || !isRecord(body.rtpParameters)) {
      throw new Error('PRODUCE_AUDIO requires an audio send transport and RTP parameters.');
    }
    return { transportId: body.transportId, kind: 'audio', rtpParameters: body.rtpParameters };
  }

  private parseResumeConsumer(body: unknown): ResumeAudioConsumerPayload {
    if (!isRecord(body) || !nonEmptyString(body.consumerId)) {
      throw new Error('RESUME_AUDIO_CONSUMER requires consumerId.');
    }
    return { consumerId: body.consumerId };
  }

  private parseAudioProfileUpdate(body: unknown): UpdateAudioProfilePayload {
    if (!isRecord(body) ||
        !finiteNumber(body.inputGainDefault) || !finiteNumber(body.outputGainDefault) ||
        !finiteNumber(body.targetPlayoutDelayMs)) {
      throw new Error('UPDATE_AUDIO_PROFILE requires finite numeric audio settings.');
    }
    return {
      controlCode: typeof body.controlCode === 'string' ? body.controlCode : undefined,
      inputGainDefault: body.inputGainDefault,
      outputGainDefault: body.outputGainDefault,
      targetPlayoutDelayMs: body.targetPlayoutDelayMs
    };
  }

  private sendError(socket: Socket, code: string, message: string): void {
    const payload: ErrorPayload = { code, message };
    socket.emit(ServerEvent.Error, payload);
  }

  private clientIp(socket: Socket): string {
    return socket.handshake.address || 'unknown';
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Unexpected signaling error.';
  }
}
