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

interface MediaSession {
  socketId: string;
  roomId: string;
  clientId: string;
  recvRtpCapabilities?: RtpCapabilities;
  sendTransport?: WebRtcTransport;
  recvTransport?: WebRtcTransport;
  producer?: Producer<{ floorToken: string }>;
  consumers: Map<string, Consumer<{ producerId: string }>>;
}

export interface ConsumerDispatch {
  socketId: string;
  payload: AudioConsumerPayload;
}

export interface ConsumerClosedDispatch {
  socketId: string;
  payload: AudioConsumerClosedPayload;
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
    if (!this.router) throw new Error('Media router is not ready.');
    return this.router.rtpCapabilities as unknown as Record<string, unknown>;
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

    this.audioProfile = {
      ...this.getAudioProfile(),
      ...input
    };
    return this.getAudioProfile();
  }

  getRelayProfile(): AudioRelayProfile {
    return this.getAudioProfile();
  }

  getDiagnostics(): { mediaSessions: number; activeProducers: number; activeConsumers: number } {
    let activeProducers = 0;
    let activeConsumers = 0;
    for (const session of this.sessions.values()) {
      if (session.producer && !session.producer.closed) activeProducers += 1;
      activeConsumers += [...session.consumers.values()].filter((consumer) => !consumer.closed).length;
    }
    return { mediaSessions: this.sessions.size, activeProducers, activeConsumers };
  }

  async createWebRtcTransport(input: {
    socketId: string;
    roomId: string;
    clientId: string;
    direction: WebRtcTransportDirection;
    rtpCapabilities?: Record<string, unknown>;
  }): Promise<CreateTransportResult> {
    const router = this.requireRouter();
    const config = readConfig();
    const session = this.getOrCreateSession(input);
    const currentTransport = input.direction === 'send' ? session.sendTransport : session.recvTransport;
    if (currentTransport && !currentTransport.closed) {
      throw new Error(`${input.direction} transport already exists for this socket.`);
    }
    if (input.direction === 'recv' && !input.rtpCapabilities) {
      throw new Error('Receive transport requires router-compatible RTP capabilities.');
    }

    const announcedAddress = this.resolveAnnouncedAddress(config.media.announcedAddress);
    const listenInfo = {
      protocol: 'udp' as const,
      ip: config.media.listenIp,
      ...(announcedAddress ? { announcedAddress } : {})
    };
    const transport = await router.createWebRtcTransport({
      listenInfos: [listenInfo],
      enableUdp: true,
      enableTcp: false,
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
    const session = this.requireSession(socketId);
    const transport = this.findTransport(session, transportId);
    await transport.connect({ dtlsParameters: dtlsParameters as unknown as DtlsParameters });
  }

  async produceAudio(input: {
    socketId: string;
    transportId: string;
    floorToken: string;
    rtpParameters: Record<string, unknown>;
  }): Promise<{ producerId: string; closedConsumers: ConsumerClosedDispatch[]; consumers: ConsumerDispatch[] }> {
    const session = this.requireSession(input.socketId);
    if (!session.sendTransport || session.sendTransport.id !== input.transportId) {
      throw new Error('A matching send transport is required before producing audio.');
    }

    const closedConsumers = this.closeProducerForSession(session, 'producer_closed');
    const producer = await session.sendTransport.produce({
      kind: 'audio',
      rtpParameters: input.rtpParameters as unknown as RtpParameters,
      appData: { floorToken: input.floorToken }
    });
    session.producer = producer;
    producer.on('transportclose', () => {
      if (session.producer?.id === producer.id) session.producer = undefined;
    });

    const consumers = await this.createConsumersForProducer(session, producer);
    return { producerId: producer.id, closedConsumers, consumers };
  }

  async resumeAudioConsumer(socketId: string, consumerId: string): Promise<void> {
    const session = this.requireSession(socketId);
    const consumer = session.consumers.get(consumerId);
    if (!consumer || consumer.closed) return;
    await consumer.resume();
  }

  closeProducerForFloor(roomId: string, clientId: string, floorToken: string): ConsumerClosedDispatch[] {
    const session = [...this.sessions.values()].find((entry) =>
      entry.roomId === roomId && entry.clientId === clientId && entry.producer?.appData.floorToken === floorToken
    );
    return session ? this.closeProducerForSession(session, 'producer_closed') : [];
  }

  closeClientMedia(socketId: string): ConsumerClosedDispatch[] {
    const session = this.sessions.get(socketId);
    if (!session) return [];

    const dispatches = this.closeProducerForSession(session, 'session_closed');
    for (const consumer of [...session.consumers.values()]) {
      consumer.close();
      session.consumers.delete(consumer.id);
    }
    session.sendTransport?.close();
    session.recvTransport?.close();
    this.sessions.delete(socketId);
    return dispatches;
  }

  async onModuleDestroy(): Promise<void> {
    for (const socketId of [...this.sessions.keys()]) this.closeClientMedia(socketId);
    this.router?.close();
    this.worker?.close();
  }

  private getOrCreateSession(input: { socketId: string; roomId: string; clientId: string }): MediaSession {
    const current = this.sessions.get(input.socketId);
    if (current) {
      if (current.roomId !== input.roomId || current.clientId !== input.clientId) {
        throw new Error('Media session does not match the signaling session.');
      }
      return current;
    }
    const created: MediaSession = { ...input, consumers: new Map() };
    this.sessions.set(input.socketId, created);
    return created;
  }

  private resolveAnnouncedAddress(configuredAddress: string): string {
    const interfaces = networkInterfaces();
    const allIpv4: string[] = [];
    for (const addrs of Object.values(interfaces)) {
      if (!addrs) continue;
      for (const addr of addrs) {
        if (addr.family === 'IPv4' && !addr.internal) {
          allIpv4.push(addr.address);
        }
      }
    }
    if (configuredAddress && allIpv4.includes(configuredAddress)) {
      return configuredAddress;
    }
    const detected = allIpv4.find((ip) => ip.startsWith('192.168.') || ip.startsWith('172.') || ip.startsWith('10.')) ?? allIpv4[0] ?? '127.0.0.1';
    if (configuredAddress && configuredAddress !== detected) {
      this.logger.warn(`Configured MEDIASOUP_ANNOUNCED_ADDRESS (${configuredAddress}) is not active on this machine. Auto-detected LAN IP: ${detected}`);
    } else {
      this.logger.log(`WebRTC announced address: ${detected}`);
    }
    return detected;
  }

  private requireSession(socketId: string): MediaSession {
    const session = this.sessions.get(socketId);
    if (!session) throw new Error('Create a WebRTC transport after JOIN_ROOM first.');
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

  private serializeTransport(transport: WebRtcTransport): WebRtcTransportParameters {
    return {
      id: transport.id,
      iceParameters: transport.iceParameters as unknown as Record<string, unknown>,
      iceCandidates: transport.iceCandidates as unknown as Record<string, unknown>[],
      dtlsParameters: transport.dtlsParameters as unknown as Record<string, unknown>
    };
  }

  private async createConsumersForExistingProducers(session: MediaSession): Promise<ConsumerDispatch[]> {
    const dispatches: ConsumerDispatch[] = [];
    for (const producerSession of this.sessions.values()) {
      if (producerSession.roomId !== session.roomId || producerSession.socketId === session.socketId) continue;
      if (producerSession.producer && !producerSession.producer.closed) {
        const dispatch = await this.createConsumer(session, producerSession.producer);
        if (dispatch) dispatches.push(dispatch);
      }
    }
    return dispatches;
  }

  private async createConsumersForProducer(owner: MediaSession, producer: Producer<{ floorToken: string }>): Promise<ConsumerDispatch[]> {
    const dispatches: ConsumerDispatch[] = [];
    for (const session of this.sessions.values()) {
      if (session.roomId !== owner.roomId || session.socketId === owner.socketId) continue;
      const dispatch = await this.createConsumer(session, producer);
      if (dispatch) dispatches.push(dispatch);
    }
    return dispatches;
  }

  private async createConsumer(session: MediaSession, producer: Producer<{ floorToken: string }>): Promise<ConsumerDispatch | undefined> {
    const router = this.requireRouter();
    if (!session.recvTransport || !session.recvRtpCapabilities || session.recvTransport.closed) return undefined;
    if (!router.canConsume({ producerId: producer.id, rtpCapabilities: session.recvRtpCapabilities })) return undefined;

    const consumer = await session.recvTransport.consume({
      producerId: producer.id,
      rtpCapabilities: session.recvRtpCapabilities,
      paused: true,
      appData: { producerId: producer.id }
    });
    session.consumers.set(consumer.id, consumer);
    consumer.on('transportclose', () => session.consumers.delete(consumer.id));
    consumer.on('producerclose', () => session.consumers.delete(consumer.id));

    return {
      socketId: session.socketId,
      payload: {
        consumerId: consumer.id,
        producerId: producer.id,
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

