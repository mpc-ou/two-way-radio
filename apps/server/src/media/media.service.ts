import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { networkInterfaces } from 'node:os';
import * as mediasoup from 'mediasoup';
import type {
  Consumer,
  DtlsParameters,
  Producer,
  Router,
  RtpCapabilities,
  RtpParameters,
  WebRtcServer,
  WebRtcTransport,
  Worker
} from 'mediasoup/types';
import type {
  AudioConsumerClosedPayload,
  AudioConsumerPayload,
  AudioRelayProfile,
  WebRtcTransportDirection,
  WebRtcTransportParameters
} from '@mpc-voicelink/protocol';
import { readConfig } from '../config/config.js';

type ProducerData = { clientId: string; roomId: string };
type ConsumerData = { producerId: string; producerClientId: string };

interface MediaSession {
  socketId: string;
  clientId: string;
  /** Channel hiện tại; undefined khi socket chưa vào hoặc đã rời channel. */
  roomId?: string;
  recvRtpCapabilities?: RtpCapabilities;
  sendTransport?: WebRtcTransport;
  recvTransport?: WebRtcTransport;
  producer?: Producer<ProducerData>;
  consumers: Map<string, Consumer<ConsumerData>>;
}

export interface ConsumerDispatch {
  socketId: string;
  payload: AudioConsumerPayload;
}

export interface ConsumerClosedDispatch {
  socketId: string;
  payload: AudioConsumerClosedPayload;
}

export interface MediaChanges {
  closed: ConsumerClosedDispatch[];
  created: ConsumerDispatch[];
}

interface CreateTransportResult {
  transport: WebRtcTransportParameters;
  consumers: ConsumerDispatch[];
}

@Injectable()
export class MediaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MediaService.name);
  private readonly sessions = new Map<string, MediaSession>();
  private worker?: Worker;
  private webRtcServer?: WebRtcServer;
  private router?: Router;
  private audioProfile?: AudioRelayProfile;

  async onModuleInit(): Promise<void> {
    const { media } = readConfig();
    this.worker = await mediasoup.createWorker({
      logLevel: 'warn',
      rtcMinPort: media.rtcMinPort,
      rtcMaxPort: media.rtcMaxPort
    });
    this.worker.on('died', () => {
      this.logger.error('mediasoup worker died; process must be restarted.');
      process.exitCode = 1;
    });
    this.webRtcServer = await this.worker.createWebRtcServer({
      listenInfos: this.buildListenInfos(media)
    });
    this.router = await this.worker.createRouter({
      mediaCodecs: [{
        kind: 'audio',
        mimeType: 'audio/opus',
        clockRate: 48000,
        channels: 2,
        parameters: {
          minptime: 10,
          useinbandfec: 1,
          usedtx: 0
        }
      }]
    });
    this.audioProfile = {
      inputGainDefault: media.inputGainDefault,
      inputGainMax: media.inputGainMax,
      outputGainDefault: media.outputGainDefault,
      outputGainMax: media.outputGainMax,
      targetPlayoutDelayMs: media.targetPlayoutDelayMs,
      targetPlayoutDelayMaxMs: media.targetPlayoutDelayMaxMs,
      opusBitrate: media.opusBitrate,
      packetizationMs: media.opusPacketizationMs,
      maxOutgoingBitrate: media.maxOutgoingBitrate
    };

    this.logger.log(`mediasoup audio router ready (Opus, ${media.opusBitrate} bps target).`);
  }

  getRouterRtpCapabilities(): Record<string, unknown> {
    return this.requireRouter().rtpCapabilities as unknown as Record<string, unknown>;
  }

  getAudioProfile(): AudioRelayProfile {
    if (!this.audioProfile) throw new Error('Media router is not ready.');
    return { ...this.audioProfile };
  }

  updateAudioProfile(input: Pick<AudioRelayProfile, 'inputGainDefault' | 'outputGainDefault' | 'targetPlayoutDelayMs'>): AudioRelayProfile {
    const config = readConfig();
    if (input.inputGainDefault < 0 || input.inputGainDefault > config.media.inputGainMax) {
      throw new Error(`Input gain must be between 0 and ${config.media.inputGainMax}.`);
    }
    if (input.outputGainDefault < 0 || input.outputGainDefault > config.media.outputGainMax) {
      throw new Error(`Output gain must be between 0 and ${config.media.outputGainMax}.`);
    }
    if (input.targetPlayoutDelayMs < 0 || input.targetPlayoutDelayMs > config.media.targetPlayoutDelayMaxMs) {
      throw new Error(`Target playout delay must be between 0 and ${config.media.targetPlayoutDelayMaxMs} ms.`);
    }

    this.audioProfile = { ...this.getAudioProfile(), ...input };
    return this.getAudioProfile();
  }

  getDiagnostics(): { mediaSessions: number; producers: number; pausedProducers: number; activeConsumers: number } {
    let producers = 0;
    let pausedProducers = 0;
    let activeConsumers = 0;
    for (const session of this.sessions.values()) {
      if (session.producer && !session.producer.closed) {
        producers += 1;
        if (session.producer.paused) pausedProducers += 1;
      }
      activeConsumers += [...session.consumers.values()].filter((consumer) => !consumer.closed).length;
    }
    return { mediaSessions: this.sessions.size, producers, pausedProducers, activeConsumers };
  }

  /** Byte RTP nhận từ từng Producer và tổng byte đã chuyển tiếp tới người nghe. */
  async getTrafficStats(): Promise<{
    producers: Array<{ clientId: string; roomId: string; paused: boolean; bytesIn: number }>;
    bytesForwarded: number;
  }> {
    const producers: Array<{ clientId: string; roomId: string; paused: boolean; bytesIn: number }> = [];
    let bytesForwarded = 0;
    for (const session of this.sessions.values()) {
      const producer = session.producer;
      if (producer && !producer.closed) {
        const stats = await producer.getStats().catch(() => []);
        producers.push({
          clientId: producer.appData.clientId,
          roomId: producer.appData.roomId,
          paused: producer.paused,
          bytesIn: stats.reduce((sum, stat) => sum + (stat.byteCount ?? 0), 0)
        });
      }
      for (const consumer of session.consumers.values()) {
        if (consumer.closed) continue;
        const stats = await consumer.getStats().catch(() => []);
        for (const stat of stats) {
          if (stat.type === 'outbound-rtp') bytesForwarded += stat.byteCount ?? 0;
        }
      }
    }
    return { producers, bytesForwarded };
  }

  /**
   * Gắn socket vào channel mới. Producer cũ và consumer cũ bị đóng, transport được giữ lại
   * để đổi channel không phải bắt tay ICE/DTLS lại. Trả về consumer cho các producer có sẵn.
   */
  async enterRoom(socketId: string, clientId: string, roomId: string): Promise<MediaChanges> {
    const session = this.sessions.get(socketId) ?? this.createSession(socketId, clientId);
    const closed = this.detachFromRoom(session);
    session.roomId = roomId;
    const created = await this.createConsumersForExistingProducers(session);
    return { closed, created };
  }

  /** Rời channel nhưng giữ transport (LEAVE_CHANNEL). */
  leaveRoom(socketId: string): ConsumerClosedDispatch[] {
    const session = this.sessions.get(socketId);
    if (!session) return [];
    const closed = this.detachFromRoom(session);
    session.roomId = undefined;
    return closed;
  }

  async createWebRtcTransport(input: {
    socketId: string;
    clientId: string;
    direction: WebRtcTransportDirection;
    rtpCapabilities?: Record<string, unknown>;
  }): Promise<CreateTransportResult> {
    const router = this.requireRouter();
    const config = readConfig();
    const session = this.sessions.get(input.socketId) ?? this.createSession(input.socketId, input.clientId);
    if (session.clientId !== input.clientId) throw new Error('Media session does not match the signaling session.');
    const currentTransport = input.direction === 'send' ? session.sendTransport : session.recvTransport;
    if (currentTransport && !currentTransport.closed) {
      throw new Error(`${input.direction} transport already exists for this socket.`);
    }
    if (input.direction === 'recv' && !input.rtpCapabilities) {
      throw new Error('Receive transport requires router-compatible RTP capabilities.');
    }

    const transport = await router.createWebRtcTransport({
      webRtcServer: this.requireWebRtcServer(),
      enableUdp: config.media.enableUdp,
      enableTcp: config.media.enableTcp,
      preferUdp: true,
      initialAvailableOutgoingBitrate: config.media.maxOutgoingBitrate
    });
    await transport.setMaxOutgoingBitrate(config.media.maxOutgoingBitrate);
    transport.on('dtlsstatechange', (state) => {
      if (state === 'failed') {
        this.logger.warn(`DTLS failed for ${input.direction} transport on socket ${input.socketId}.`);
      }
    });

    if (input.direction === 'send') {
      session.sendTransport = transport;
    } else {
      session.recvTransport = transport;
      session.recvRtpCapabilities = input.rtpCapabilities as unknown as RtpCapabilities;
    }

    const consumers = input.direction === 'recv'
      ? await this.createConsumersForExistingProducers(session)
      : [];
    return { transport: this.serializeTransport(transport), consumers };
  }

  async connectWebRtcTransport(socketId: string, transportId: string, dtlsParameters: Record<string, unknown>): Promise<void> {
    const transport = this.findTransport(this.requireSession(socketId), transportId);
    await transport.connect({ dtlsParameters: dtlsParameters as unknown as DtlsParameters });
  }

  /** ICE restart khi điện thoại đổi AP hoặc mất sóng tạm thời. */
  async restartIce(socketId: string, transportId: string): Promise<Record<string, unknown>> {
    const transport = this.findTransport(this.requireSession(socketId), transportId);
    return (await transport.restartIce()) as unknown as Record<string, unknown>;
  }

  /**
   * Producer luôn được tạo ở trạng thái PAUSED: server không chuyển tiếp RTP cho tới khi
   * `setProducerPaused(false)` được gọi lúc cấp floor. `startResumed` chỉ dùng khi client
   * produce lại trong lúc đang giữ floor hợp lệ (do gateway xác nhận).
   */
  async produceAudio(input: {
    socketId: string;
    transportId: string;
    rtpParameters: Record<string, unknown>;
    startResumed: boolean;
  }): Promise<{ producerId: string; closedConsumers: ConsumerClosedDispatch[]; consumers: ConsumerDispatch[] }> {
    const session = this.requireSession(input.socketId);
    if (!session.roomId) throw new Error('Join a channel before producing audio.');
    if (!session.sendTransport || session.sendTransport.id !== input.transportId) {
      throw new Error('A matching send transport is required before producing audio.');
    }

    const closedConsumers = this.closeProducerForSession(session, 'producer_closed');
    const producer = await session.sendTransport.produce({
      kind: 'audio',
      rtpParameters: input.rtpParameters as unknown as RtpParameters,
      paused: !input.startResumed,
      appData: { clientId: session.clientId, roomId: session.roomId }
    });
    session.producer = producer;
    producer.on('transportclose', () => {
      if (session.producer?.id === producer.id) session.producer = undefined;
    });

    const consumers = await this.createConsumersForProducer(session, producer);
    return { producerId: producer.id, closedConsumers, consumers };
  }

  /** Mở/khóa Producer của một client trong channel. Đây là nơi server thực thi quyền nói. */
  async setProducerPaused(roomId: string, clientId: string, paused: boolean): Promise<void> {
    for (const session of this.sessions.values()) {
      const producer = session.producer;
      if (session.roomId !== roomId || session.clientId !== clientId || !producer || producer.closed) continue;
      if (paused && !producer.paused) await producer.pause();
      if (!paused && producer.paused) await producer.resume();
    }
  }

  async resumeAudioConsumer(socketId: string, consumerId: string): Promise<void> {
    const consumer = this.requireSession(socketId).consumers.get(consumerId);
    if (!consumer || consumer.closed) return;
    await consumer.resume();
  }

  closeClientMedia(socketId: string): ConsumerClosedDispatch[] {
    const session = this.sessions.get(socketId);
    if (!session) return [];

    const dispatches = this.detachFromRoom(session);
    session.sendTransport?.close();
    session.recvTransport?.close();
    this.sessions.delete(socketId);
    return dispatches;
  }

  async onModuleDestroy(): Promise<void> {
    for (const socketId of [...this.sessions.keys()]) this.closeClientMedia(socketId);
    this.router?.close();
    this.webRtcServer?.close();
    this.worker?.close();
  }

  private createSession(socketId: string, clientId: string): MediaSession {
    const created: MediaSession = { socketId, clientId, consumers: new Map() };
    this.sessions.set(socketId, created);
    return created;
  }

  /** Đóng producer của session (báo cho người nghe) và mọi consumer của chính session (báo cho chính nó). */
  private detachFromRoom(session: MediaSession): ConsumerClosedDispatch[] {
    const dispatches = this.closeProducerForSession(session, 'session_closed');
    for (const consumer of [...session.consumers.values()]) {
      consumer.close();
      session.consumers.delete(consumer.id);
      dispatches.push({
        socketId: session.socketId,
        payload: { consumerId: consumer.id, producerId: consumer.producerId, reason: 'producer_closed' }
      });
    }
    return dispatches;
  }

  /**
   * Một cổng duy nhất (UDP và/hoặc TCP) cho mọi WebRtcTransport. Chỉ cần mở đúng cổng này
   * trên firewall; announcedAddress là địa chỉ client dùng để kết nối tới.
   */
  private buildListenInfos(media: ReturnType<typeof readConfig>['media']): mediasoup.types.TransportListenInfo[] {
    const announcedAddress = this.resolveAnnouncedAddress(media.announcedAddress);
    const base = {
      ip: media.listenIp,
      port: media.port,
      ...(announcedAddress ? { announcedAddress } : {})
    };
    const infos: mediasoup.types.TransportListenInfo[] = [];
    if (media.enableUdp) infos.push({ protocol: 'udp', ...base });
    if (media.enableTcp) infos.push({ protocol: 'tcp', ...base });
    this.logger.log(
      `WebRTC listening on ${media.listenIp}:${media.port} (${infos.map((i) => i.protocol).join('+')}), ` +
      `announced as ${announcedAddress || 'listen ip'}`
    );
    return infos;
  }

  private requireWebRtcServer(): WebRtcServer {
    if (!this.webRtcServer) throw new Error('Media router is not ready.');
    return this.webRtcServer;
  }

  private resolveAnnouncedAddress(configuredAddress: string): string {
    // Địa chỉ cấu hình rõ ràng (IP public, domain/DDNS, host tunnel) được dùng nguyên văn.
    const localIpv4 = Object.values(networkInterfaces())
      .flatMap((addrs) => addrs ?? [])
      .filter((addr) => addr.family === 'IPv4' && !addr.internal)
      .map((addr) => addr.address);
    const isPrivateIpv4 = (value: string): boolean =>
      /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(value);

    if (configuredAddress) {
      // IP LAN đã cấu hình nhưng không còn trên máy (đổi Wi-Fi/Hotspot) -> dò lại thay vì announce IP chết.
      if (!isPrivateIpv4(configuredAddress) || localIpv4.includes(configuredAddress)) {
        this.logger.log(`WebRTC announced address (configured): ${configuredAddress}`);
        return configuredAddress;
      }
      this.logger.warn(
        `MEDIASOUP_ANNOUNCED_ADDRESS (${configuredAddress}) is a LAN IP not present on this machine; auto-detecting.`
      );
    }

    const detected = localIpv4.find(isPrivateIpv4) ?? localIpv4[0] ?? '127.0.0.1';
    this.logger.log(`WebRTC announced address (auto-detected LAN IP): ${detected}`);
    return detected;
  }

  private requireSession(socketId: string): MediaSession {
    const session = this.sessions.get(socketId);
    if (!session) throw new Error('Join a channel and create a WebRTC transport first.');
    return session;
  }

  private requireRouter(): Router {
    if (!this.router) throw new Error('Media router is not ready.');
    return this.router;
  }

  private findTransport(session: MediaSession, transportId: string): WebRtcTransport {
    if (session.sendTransport?.id === transportId) return session.sendTransport;
    if (session.recvTransport?.id === transportId) return session.recvTransport;
    throw new Error('WebRTC transport does not belong to this socket.');
  }

  /** mediasoup không hỗ trợ announcedPort nên ghi đè cổng công khai trong candidate gửi cho client. */
  private withAnnouncedPorts(candidates: WebRtcTransport['iceCandidates']): Record<string, unknown>[] {
    const { announcedUdpPort, announcedTcpPort } = readConfig().media;
    return candidates.map((candidate) => {
      const port = candidate.protocol === 'udp' ? announcedUdpPort : announcedTcpPort;
      return { ...candidate, ...(port ? { port } : {}) } as unknown as Record<string, unknown>;
    });
  }

  private serializeTransport(transport: WebRtcTransport): WebRtcTransportParameters {
    return {
      id: transport.id,
      iceParameters: transport.iceParameters as unknown as Record<string, unknown>,
      iceCandidates: this.withAnnouncedPorts(transport.iceCandidates),
      dtlsParameters: transport.dtlsParameters as unknown as Record<string, unknown>
    };
  }

  private async createConsumersForExistingProducers(session: MediaSession): Promise<ConsumerDispatch[]> {
    const dispatches: ConsumerDispatch[] = [];
    if (!session.roomId) return dispatches;
    for (const producerSession of this.sessions.values()) {
      if (producerSession.roomId !== session.roomId || producerSession.socketId === session.socketId) continue;
      if (producerSession.producer && !producerSession.producer.closed) {
        const dispatch = await this.createConsumer(session, producerSession.producer);
        if (dispatch) dispatches.push(dispatch);
      }
    }
    return dispatches;
  }

  private async createConsumersForProducer(owner: MediaSession, producer: Producer<ProducerData>): Promise<ConsumerDispatch[]> {
    const dispatches: ConsumerDispatch[] = [];
    for (const session of this.sessions.values()) {
      if (session.roomId !== owner.roomId || session.socketId === owner.socketId) continue;
      const dispatch = await this.createConsumer(session, producer);
      if (dispatch) dispatches.push(dispatch);
    }
    return dispatches;
  }

  private async createConsumer(session: MediaSession, producer: Producer<ProducerData>): Promise<ConsumerDispatch | undefined> {
    const router = this.requireRouter();
    if (!session.recvTransport || !session.recvRtpCapabilities || session.recvTransport.closed) return undefined;
    if (session.consumers.size > 0 && [...session.consumers.values()].some((c) => c.producerId === producer.id)) {
      return undefined;
    }
    if (!router.canConsume({ producerId: producer.id, rtpCapabilities: session.recvRtpCapabilities })) return undefined;

    const consumer = await session.recvTransport.consume({
      producerId: producer.id,
      rtpCapabilities: session.recvRtpCapabilities,
      paused: true,
      appData: { producerId: producer.id, producerClientId: producer.appData.clientId }
    });
    session.consumers.set(consumer.id, consumer);
    consumer.on('transportclose', () => session.consumers.delete(consumer.id));
    consumer.on('producerclose', () => session.consumers.delete(consumer.id));

    return {
      socketId: session.socketId,
      payload: {
        consumerId: consumer.id,
        producerId: producer.id,
        producerClientId: producer.appData.clientId,
        kind: 'audio',
        rtpParameters: consumer.rtpParameters as unknown as Record<string, unknown>
      }
    };
  }

  private closeProducerForSession(session: MediaSession, reason: AudioConsumerClosedPayload['reason']): ConsumerClosedDispatch[] {
    const producer = session.producer;
    if (!producer || producer.closed) return [];

    const dispatches: ConsumerClosedDispatch[] = [];
    for (const listener of this.sessions.values()) {
      for (const consumer of [...listener.consumers.values()]) {
        if (consumer.producerId !== producer.id) continue;
        consumer.close();
        listener.consumers.delete(consumer.id);
        dispatches.push({
          socketId: listener.socketId,
          payload: { consumerId: consumer.id, producerId: producer.id, reason }
        });
      }
    }
    producer.close();
    session.producer = undefined;
    return dispatches;
  }
}
