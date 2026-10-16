import { Inject, Logger } from '@nestjs/common';
import { ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import {
  ClientEvent,
  finiteNumber,
  isRecord,
  nonEmptyString,
  ServerEvent,
  type AudioRelayProfile,
  type CloseMediaPayload,
  type ConnectWebRtcTransportPayload,
  type CreateWebRtcTransportPayload,
  type ErrorPayload,
  type HeartbeatPayload,
  type JoinRoomPayload,
  type Position2D,
  type ProduceAudioPayload,
  type ReleaseFloorPayload,
  type ResumeAudioConsumerPayload,
  type SocketAck,
  type UpdateAudioProfilePayload,
  type WebRtcTransportParameters
} from '@mpc-voicelink/protocol';
import { readConfig } from '../config/config.js';
import { MediaService, type ConsumerClosedDispatch, type ConsumerDispatch } from '../media/media.service.js';
import { RoomsService } from '../rooms/rooms.service.js';

interface SocketSession {
  roomId: string;
  clientId: string;
}

type AckCallback<T> = (response: SocketAck<T>) => void;

@WebSocketGateway({
  cors: {
    origin: (_origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      callback(null, true);
    },
    methods: ['GET', 'POST'],
    credentials: true
  }
})
export class SignalingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(SignalingGateway.name);
  private readonly sessions = new Map<string, SocketSession>();

  @WebSocketServer()
  private server!: Server;

  constructor(
    @Inject(RoomsService) private readonly rooms: RoomsService,
    @Inject(MediaService) private readonly media: MediaService
  ) {
    this.rooms.onFloorReleased(({ payload, floorToken }) => {
      this.emitConsumerClosures(this.media.closeProducerForFloor(
        payload.roomId,
        payload.previousSpeakerClientId,
        floorToken
      ));
      this.server.to(payload.roomId).emit(ServerEvent.FloorReleased, payload);
      this.broadcastRoomState(payload.roomId);
    });
  }

  handleConnection(socket: Socket): void {
    this.logger.log(`Signaling client connected: ${socket.id}`);
    this.registerMediaHandlers(socket);
  }

  async handleDisconnect(socket: Socket): Promise<void> {
    this.emitConsumerClosures(this.media.closeClientMedia(socket.id));
    const session = this.sessions.get(socket.id);
    this.sessions.delete(socket.id);
    if (!session) return;

    socket.leave(session.roomId);
    const { state } = this.rooms.leave(session.roomId, session.clientId);
    this.server.to(session.roomId).emit(ServerEvent.ClientDisconnected, {
      roomId: session.roomId,
      clientId: session.clientId
    });
    if (state) this.server.to(session.roomId).emit(ServerEvent.RoomState, state);
  }

  @SubscribeMessage(ClientEvent.JoinRoom)
  joinRoom(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown): void {
    try {
      const payload = this.parseJoin(body);
      if (this.sessions.has(socket.id)) {
        this.sendError(socket, 'ALREADY_JOINED', 'Socket already belongs to a room.');
        return;
      }

      const state = this.rooms.join({ ...payload, socketId: socket.id });
      this.sessions.set(socket.id, { roomId: payload.roomId, clientId: payload.clientId });
      socket.join(payload.roomId);
      socket.emit(ServerEvent.RoomState, state);
      socket.emit(ServerEvent.AudioProfile, this.media.getAudioProfile());
      socket.to(payload.roomId).emit(ServerEvent.RoomState, state);
    } catch (error) {
      this.sendError(socket, 'JOIN_FAILED', this.errorMessage(error));
    }
  }

  @SubscribeMessage(ClientEvent.RequestFloor)
  requestFloor(@ConnectedSocket() socket: Socket): void {
    try {
      const session = this.requireSession(socket);
      const result = this.rooms.requestFloor(session.roomId, session.clientId);
      if (!result.granted) {
        socket.emit(ServerEvent.FloorDenied, {
          roomId: session.roomId,
          speakerClientId: result.speakerClientId
        });
        return;
      }

      socket.emit(ServerEvent.FloorGranted, {
        roomId: session.roomId,
        floorToken: result.floorToken,
        expiresAt: result.expiresAt,
        heartbeatIntervalMs: readConfig().heartbeatIntervalMs
      });
      this.server.to(session.roomId).emit(ServerEvent.RoomState, result.state);
    } catch (error) {
      this.sendError(socket, 'FLOOR_REQUEST_FAILED', this.errorMessage(error));
    }
  }

  @SubscribeMessage(ClientEvent.ReleaseFloor)
  releaseFloor(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown): void {
    try {
      const session = this.requireSession(socket);
      const payload = this.parseRelease(body);
      const released = this.rooms.releaseFloor(session.roomId, session.clientId, payload.floorToken);
      if (!released) {
        this.sendError(socket, 'STALE_FLOOR_TOKEN', 'Floor lease is no longer active.');
      }
    } catch (error) {
      this.sendError(socket, 'FLOOR_RELEASE_FAILED', this.errorMessage(error));
    }
  }

  @SubscribeMessage(ClientEvent.Heartbeat)
  heartbeat(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown): void {
    try {
      const session = this.requireSession(socket);
      const payload = this.parseHeartbeat(body);
      const valid = this.rooms.heartbeat(session.roomId, session.clientId, payload.floorToken);
      if (!valid) this.sendError(socket, 'STALE_FLOOR_TOKEN', 'Floor lease is no longer active.');
    } catch (error) {
      this.sendError(socket, 'HEARTBEAT_FAILED', this.errorMessage(error));
    }
  }

  @SubscribeMessage(ClientEvent.UpdatePosition)
  updatePosition(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown): void {
    try {
      const session = this.requireSession(socket);
      if (!isRecord(body) || !finiteNumber(body.x) || !finiteNumber(body.y)) {
        throw new Error('UPDATE_POSITION requires valid x and y coordinates.');
      }
      const position: Position2D = {
        x: Math.max(0, Math.min(100, body.x)),
        y: Math.max(0, Math.min(100, body.y)),
        zone: typeof body.zone === 'string' ? body.zone : undefined
      };
      const state = this.rooms.updatePosition(session.roomId, session.clientId, position);
      this.server.to(session.roomId).emit(ServerEvent.RoomState, state);
    } catch (error) {
      this.sendError(socket, 'UPDATE_POSITION_FAILED', this.errorMessage(error));
    }
  }

  private registerMediaHandlers(socket: Socket): void {
    socket.on(ClientEvent.GetMediaCapabilities, (_body: unknown, callback: unknown) => {
      this.respond(socket, callback, () => {
        this.requireSession(socket);
        return {
          routerRtpCapabilities: this.media.getRouterRtpCapabilities(),
          audioProfile: this.media.getAudioProfile()
        };
      });
    });

    socket.on(ClientEvent.CreateWebRtcTransport, (body: unknown, callback: unknown) => {
      this.respond(socket, callback, async () => {
        const session = this.requireSession(socket);
        const payload = this.parseCreateTransport(body);
        const result = await this.media.createWebRtcTransport({
          socketId: socket.id,
          roomId: session.roomId,
          clientId: session.clientId,
          ...payload
        });
        return {
          transport: result.transport,
          consumers: result.consumers.map((dispatch) => dispatch.payload)
        };
      });
    });

    socket.on(ClientEvent.ConnectWebRtcTransport, (body: unknown, callback: unknown) => {
      this.respond(socket, callback, async () => {
        const payload = this.parseConnectTransport(body);
        await this.media.connectWebRtcTransport(socket.id, payload.transportId, payload.dtlsParameters);
        return {};
      });
    });

    socket.on(ClientEvent.ProduceAudio, (body: unknown, callback: unknown) => {
      this.respond(socket, callback, async () => {
        const session = this.requireSession(socket);
        const payload = this.parseProduceAudio(body);
        if (!this.rooms.isCurrentFloorHolder(session.roomId, session.clientId, payload.floorToken)) {
          throw new Error('A current floor lease is required to produce audio.');
        }
        const result = await this.media.produceAudio({ socketId: socket.id, ...payload });
        this.emitConsumerClosures(result.closedConsumers);
        this.emitNewConsumers(result.consumers);
        return { producerId: result.producerId };
      });
    });

    socket.on(ClientEvent.ResumeAudioConsumer, (body: unknown, callback: unknown) => {
      this.respond(socket, callback, async () => {
        const payload = this.parseResumeConsumer(body);
        await this.media.resumeAudioConsumer(socket.id, payload.consumerId);
        return {};
      });
    });

    socket.on(ClientEvent.CloseMedia, (body: unknown, callback: unknown) => {
      this.respond(socket, callback, () => {
        const session = this.requireSession(socket);
        const payload = this.parseCloseMedia(body);
        if (payload.floorToken && !this.rooms.isCurrentFloorHolder(session.roomId, session.clientId, payload.floorToken)) {
          throw new Error('Floor lease is no longer active.');
        }
        this.emitConsumerClosures(this.media.closeClientMedia(socket.id));
        if (payload.floorToken) this.rooms.releaseFloor(session.roomId, session.clientId, payload.floorToken);
        return {};
      });
    });

    socket.on(ClientEvent.UpdateAudioProfile, (body: unknown, callback: unknown) => {
      this.respond(socket, callback, () => {
        const session = this.requireSession(socket);
        const payload = this.parseAudioProfileUpdate(body);
        const isAuthorized = this.rooms.validateAdmin(session.roomId, session.clientId, payload.controlCode);
        if (!isAuthorized) {
          throw new Error('Bạn không có quyền quản trị (Chỉ chủ phòng hoặc người có mã admin mới được chỉnh).');
        }
        const profile = this.media.updateAudioProfile(payload);
        this.server.to(session.roomId).emit(ServerEvent.AudioProfile, profile);
        return profile;
      });
    });

    socket.on(ClientEvent.ForceReleaseFloor, (body: unknown, callback: unknown) => {
      this.respond(socket, callback, () => {
        const session = this.requireSession(socket);
        const controlCode = isRecord(body) && typeof body.controlCode === 'string' ? body.controlCode : undefined;
        const isAuthorized = this.rooms.validateAdmin(session.roomId, session.clientId, controlCode);
        if (!isAuthorized) {
          throw new Error('Chỉ chủ phòng (Admin) mới có quyền cưỡng chế thu hồi mic.');
        }
        const { released, floorToken, state } = this.rooms.forceReleaseFloor(session.roomId);
        if (released && floorToken) {
          this.emitConsumerClosures(this.media.closeProducerForFloor(session.roomId, released.previousSpeakerClientId, floorToken));
          this.server.to(session.roomId).emit(ServerEvent.FloorReleased, released);
        }
        if (state) {
          this.server.to(session.roomId).emit(ServerEvent.RoomState, state);
        }
        return { success: true };
      });
    });
  }

  private respond<T>(socket: Socket, callback: unknown, action: () => T | Promise<T>): void {
    if (typeof callback !== 'function') {
      this.sendError(socket, 'ACK_REQUIRED', 'Realtime media requests require a Socket.IO acknowledgement callback.');
      return;
    }

    const acknowledgement = callback as AckCallback<T>;
    void Promise.resolve(action())
      .then((data) => acknowledgement({ ok: true, data }))
      .catch((error: unknown) => {
        const message = this.errorMessage(error);
        this.logger.warn(`Media request failed for socket ${socket.id}: ${message}`);
        acknowledgement({ ok: false, error: { code: 'MEDIA_REQUEST_FAILED', message } });
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
  }

  private requireSession(socket: Socket): SocketSession {
    const session = this.sessions.get(socket.id);
    if (!session) throw new Error('JOIN_ROOM is required before this action.');
    return session;
  }

  private parseJoin(body: unknown): JoinRoomPayload {
    if (!isRecord(body) || !nonEmptyString(body.roomId) || !nonEmptyString(body.clientId) ||
        !nonEmptyString(body.displayName) || !nonEmptyString(body.joinCode)) {
      throw new Error('JOIN_ROOM requires non-empty roomId, clientId, displayName and joinCode.');
    }
    const position = isRecord(body.position) && finiteNumber(body.position.x) && finiteNumber(body.position.y)
      ? {
          x: Math.max(0, Math.min(100, body.position.x)),
          y: Math.max(0, Math.min(100, body.position.y)),
          zone: typeof body.position.zone === 'string' ? body.position.zone : undefined
        }
      : undefined;

    return {
      roomId: body.roomId.trim(),
      clientId: body.clientId.trim(),
      displayName: body.displayName.trim(),
      joinCode: body.joinCode,
      department: typeof body.department === 'string' && body.department.trim() ? body.department.trim() : undefined,
      position
    };
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
    if (!isRecord(body) || !nonEmptyString(body.transportId) || !nonEmptyString(body.floorToken) ||
        body.kind !== 'audio' || !isRecord(body.rtpParameters)) {
      throw new Error('PRODUCE_AUDIO requires an audio send transport, current floor token and RTP parameters.');
    }
    return {
      transportId: body.transportId,
      floorToken: body.floorToken,
      kind: 'audio',
      rtpParameters: body.rtpParameters
    };
  }

  private parseResumeConsumer(body: unknown): ResumeAudioConsumerPayload {
    if (!isRecord(body) || !nonEmptyString(body.consumerId)) {
      throw new Error('RESUME_AUDIO_CONSUMER requires consumerId.');
    }
    return { consumerId: body.consumerId };
  }

  private parseCloseMedia(body: unknown): CloseMediaPayload {
    if (body === undefined || body === null) return {};
    if (!isRecord(body)) throw new Error('CLOSE_MEDIA payload must be an object.');
    if (body.floorToken !== undefined && !nonEmptyString(body.floorToken)) {
      throw new Error('CLOSE_MEDIA floorToken must be a non-empty string.');
    }
    if (body.reason !== undefined && body.reason !== 'client_request' && body.reason !== 'transport_failure') {
      throw new Error('CLOSE_MEDIA reason is invalid.');
    }
    return {
      ...(body.floorToken !== undefined ? { floorToken: body.floorToken } : {}),
      ...(body.reason !== undefined ? { reason: body.reason } : {})
    };
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

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Unexpected signaling error.';
  }
}

