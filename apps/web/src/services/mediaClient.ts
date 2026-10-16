import { Device, type types as MediasoupTypes } from 'mediasoup-client';
import type { Socket } from 'socket.io-client';
import {
  ClientEvent,
  type AudioConsumerPayload,
  type AudioRelayProfile,
  type CreateWebRtcTransportResult,
  type MediaCapabilitiesPayload,
  type ProduceAudioResult,
  type SocketAck,
  type WebRtcTransportDirection
} from '@mpc-voicelink/protocol';

export interface AudioMetrics {
  inputLevel: number;
  roundTripMs?: number;
  inboundJitterMs?: number;
  inboundPacketsLost?: number;
}

export interface MediaClientEvents {
  onError: (message: string) => void;
  onMetrics: (metrics: AudioMetrics) => void;
  onTransportState: (state: string) => void;
  onTransportFailure: () => void;
  onRemoteAudioActive: (active: boolean) => void;
}

interface InputGraph {
  context: AudioContext;
  source: MediaStreamAudioSourceNode;
  gain: GainNode;
  analyser: AnalyserNode;
  destination: MediaStreamAudioDestinationNode;
  rawStream: MediaStream;
}

interface RemoteGraph {
  source: MediaStreamAudioSourceNode;
  gain: GainNode;
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error('Realtime media operation failed.');
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function emitWithAck<T>(socket: Socket, event: string, payload: Record<string, unknown>): Promise<T> {
  return new Promise((resolve, reject) => {
    socket.timeout(10_000).emit(event, payload, (timeoutError: Error | null, response?: SocketAck<T>) => {
      if (timeoutError) {
        reject(new Error(`Server did not respond to ${event} within 10 seconds.`));
        return;
      }
      if (!response) {
        reject(new Error(`Server returned an empty response for ${event}.`));
        return;
      }
      if (!response.ok) {
        reject(new Error(`${response.error.code}: ${response.error.message}`));
        return;
      }
      resolve(response.data);
    });
  });
}

export class MediaClient {
  private device?: Device;
  private sendTransport?: MediasoupTypes.Transport;
  private recvTransport?: MediasoupTypes.Transport;
  private producer?: MediasoupTypes.Producer;
  private readonly consumers = new Map<string, MediasoupTypes.Consumer>();
  private readonly remoteGraphs = new Map<string, RemoteGraph>();
  private inputGraph?: InputGraph;
  private outputContext?: AudioContext;
  private outputDestination?: MediaStreamAudioDestinationNode;
  private audioElement?: HTMLAudioElement;
  private audioProfile?: AudioRelayProfile;
  private activeFloorToken?: string;
  private inputGain = 1;
  private outputGain = 1;
  private targetPlayoutDelayMs = 0;
  private metricTimer?: number;
  private samplingMetrics = false;
  private talkingAttempt = 0;

  constructor(private readonly events: MediaClientEvents) {}

  setAudioElement(element: HTMLAudioElement | null): void {
    this.audioElement = element ?? undefined;
    if (element && this.outputDestination) {
      element.srcObject = this.outputDestination.stream;
      void element.play().catch(() => undefined);
    }
  }

  async enableAudioOutput(): Promise<void> {
    // Create and resume the graph inside the user's click/tap. On mobile
    // browsers, creating it only when remote audio arrives is too late for
    // autoplay/user-activation rules.
    const { context } = this.getOrCreateOutputGraph();
    if (context && context.state === 'suspended') {
      await context.resume();
    }
    if (context) {
      try {
        const buffer = context.createBuffer(1, 1, 22050);
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.connect(context.destination);
        source.start(0);
      } catch {
        // Ignore silent buffer failure
      }
    }
    if (this.audioElement) {
      try {
        await this.audioElement.play();
      } catch {
        // Empty MediaStream may reject play() until tracks arrive; this is expected
      }
    }
  }

  get profile(): AudioRelayProfile | undefined {
    return this.audioProfile;
  }

  get ready(): boolean {
    return Boolean(this.device && this.recvTransport);
  }

  async initialize(socket: Socket): Promise<AudioRelayProfile> {
    if (this.ready && this.audioProfile) return this.audioProfile;

    const capabilities = await emitWithAck<MediaCapabilitiesPayload>(
      socket,
      ClientEvent.GetMediaCapabilities,
      {}
    );
    const device = await Device.factory();
    await device.load({
      routerRtpCapabilities: capabilities.routerRtpCapabilities as MediasoupTypes.RtpCapabilities
    });
    if (!device.canProduce('audio')) {
      throw new Error('This browser does not support the Opus audio profile required by the server.');
    }

    this.device = device;
    this.applyAudioProfile(capabilities.audioProfile);
    const result = await this.createTransport(socket, 'recv', device.recvRtpCapabilities);
    for (const consumer of result.consumers) await this.consumeAudio(socket, consumer);
    return capabilities.audioProfile;
  }

  async startTalking(socket: Socket, floorToken: string): Promise<boolean> {
    if (!this.device) throw new Error('Realtime media is not ready yet.');
    const attempt = ++this.talkingAttempt;
    this.activeFloorToken = floorToken;
    const sendTransport = await this.ensureSendTransport(socket);
    if (!this.isActiveTalkingAttempt(attempt, floorToken)) return false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: { ideal: 1 },
          sampleRate: { ideal: 48000 },
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false
        },
        video: false
      });
      if (!this.isActiveTalkingAttempt(attempt, floorToken)) {
        for (const track of stream.getTracks()) track.stop();
        return false;
      }

      const track = await this.createInputGraph(stream);
      if (!this.isActiveTalkingAttempt(attempt, floorToken)) {
        this.closeInputGraph();
        return false;
      }

      const producer = await sendTransport.produce({
        track,
        stopTracks: false,
        codecOptions: {
          opusStereo: false,
          opusFec: true,
          opusDtx: false,
          opusMaxAverageBitrate: this.audioProfile?.opusBitrate
        }
      });
      if (!this.isActiveTalkingAttempt(attempt, floorToken)) {
        producer.close();
        return false;
      }

      this.producer = producer;
      producer.on('trackended', () => {
        this.events.onError('Microphone track ended unexpectedly; quyền nói đã kết thúc.');
        void this.stopTalking();
      });
      this.startMetrics();
      return true;
    } catch (error) {
      if (!this.isActiveTalkingAttempt(attempt, floorToken)) return false;
      await this.stopTalking();
      throw error;
    }
  }

  async consumeAudio(socket: Socket, payload: AudioConsumerPayload): Promise<void> {
    if (!this.recvTransport || this.consumers.has(payload.consumerId)) return;
    const consumer = await this.recvTransport.consume({
      id: payload.consumerId,
      producerId: payload.producerId,
      kind: 'audio',
      rtpParameters: payload.rtpParameters as MediasoupTypes.RtpParameters
    });
    this.applyPlayoutDelayToConsumer(consumer, this.targetPlayoutDelayMs);
    this.consumers.set(consumer.id, consumer);
    await this.attachRemoteTrack(consumer);
    consumer.on('trackended', () => this.closeConsumer(consumer.id));
    consumer.on('transportclose', () => this.closeConsumer(consumer.id));
    await emitWithAck<Record<string, never>>(socket, ClientEvent.ResumeAudioConsumer, { consumerId: consumer.id });
    this.startMetrics();
  }

  closeConsumer(consumerId: string): void {
    const consumer = this.consumers.get(consumerId);
    consumer?.close();
    this.consumers.delete(consumerId);
    const graph = this.remoteGraphs.get(consumerId);
    graph?.source.disconnect();
    graph?.gain.disconnect();
    this.remoteGraphs.delete(consumerId);
    if (this.audioElement && this.consumers.size === 0) {
      this.audioElement.srcObject = null;
    }
    this.events.onRemoteAudioActive(this.remoteGraphs.size > 0 || this.consumers.size > 0);
    if (this.consumers.size === 0) this.stopMetricsIfIdle();
  }

  async stopTalking(): Promise<void> {
    this.talkingAttempt += 1;
    this.producer?.close();
    this.producer = undefined;
    this.activeFloorToken = undefined;
    this.closeInputGraph();
    this.stopMetricsIfIdle();
  }

  async close(): Promise<void> {
    await this.stopTalking();
    for (const consumerId of [...this.consumers.keys()]) this.closeConsumer(consumerId);
    this.sendTransport?.close();
    this.recvTransport?.close();
    this.sendTransport = undefined;
    this.recvTransport = undefined;
    this.device = undefined;
    this.outputDestination?.disconnect();
    await this.outputContext?.close();
    this.outputContext = undefined;
    this.outputDestination = undefined;
    if (this.audioElement) this.audioElement.srcObject = null;
  }

  applyAudioProfile(profile: AudioRelayProfile): void {
    this.audioProfile = profile;
    this.setInputGain(profile.inputGainDefault);
    this.setOutputGain(profile.outputGainDefault);
    this.setTargetPlayoutDelay(profile.targetPlayoutDelayMs);
  }

  setTargetPlayoutDelay(delayMs: number): number {
    const maximum = this.audioProfile?.targetPlayoutDelayMaxMs ?? 250;
    this.targetPlayoutDelayMs = clamp(delayMs, 0, maximum);
    for (const consumer of this.consumers.values()) {
      this.applyPlayoutDelayToConsumer(consumer, this.targetPlayoutDelayMs);
    }
    return this.targetPlayoutDelayMs;
  }

  private applyPlayoutDelayToConsumer(consumer: MediasoupTypes.Consumer, delayMs: number): void {
    try {
      const receiver = (consumer as unknown as { rtpReceiver?: RTCRtpReceiver }).rtpReceiver;
      if (receiver && 'playoutDelayHint' in receiver) {
        receiver.playoutDelayHint = Math.max(0, delayMs / 1000);
      }
    } catch {
      // Ignored if browser does not support playoutDelayHint
    }
  }

  setInputGain(value: number): number {
    const maximum = this.audioProfile?.inputGainMax ?? 2;
    this.inputGain = clamp(value, 0, maximum);
    if (this.inputGraph) this.inputGraph.gain.gain.value = this.inputGain;
    return this.inputGain;
  }

  setOutputGain(value: number): number {
    const maximum = this.audioProfile?.outputGainMax ?? 2;
    this.outputGain = clamp(value, 0, maximum);
    for (const graph of this.remoteGraphs.values()) graph.gain.gain.value = this.outputGain;
    return this.outputGain;
  }

  private async ensureSendTransport(socket: Socket): Promise<MediasoupTypes.Transport> {
    if (this.sendTransport) return this.sendTransport;
    await this.createTransport(socket, 'send');
    if (!this.sendTransport) throw new Error('Could not create the audio send transport.');
    return this.sendTransport;
  }

  private isActiveTalkingAttempt(attempt: number, floorToken: string): boolean {
    return this.talkingAttempt === attempt && this.activeFloorToken === floorToken;
  }

  private async createTransport(
    socket: Socket,
    direction: WebRtcTransportDirection,
    rtpCapabilities?: MediasoupTypes.RtpCapabilities
  ): Promise<CreateWebRtcTransportResult> {
    if (!this.device) throw new Error('Media device is not loaded.');
    const response = await emitWithAck<CreateWebRtcTransportResult>(socket, ClientEvent.CreateWebRtcTransport, {
      direction,
      ...(rtpCapabilities ? { rtpCapabilities: rtpCapabilities as unknown as Record<string, unknown> } : {})
    });
    const transportOptions = response.transport as unknown as MediasoupTypes.TransportOptions;
    const transport = direction === 'send'
      ? this.device.createSendTransport(transportOptions)
      : this.device.createRecvTransport(transportOptions);
    this.registerTransport(socket, transport, direction);
    if (direction === 'send') this.sendTransport = transport;
    else this.recvTransport = transport;
    return response;
  }

  private registerTransport(socket: Socket, transport: MediasoupTypes.Transport, direction: WebRtcTransportDirection): void {
    transport.on('connect', ({ dtlsParameters }, callback, errback) => {
      void emitWithAck<Record<string, never>>(socket, ClientEvent.ConnectWebRtcTransport, {
        transportId: transport.id,
        dtlsParameters: dtlsParameters as unknown as Record<string, unknown>
      })
        .then(() => callback())
        .catch((error: unknown) => errback(asError(error)));
    });
    transport.on('connectionstatechange', (state) => {
      this.events.onTransportState(`${direction}:${state}`);
      if (state === 'failed') this.events.onTransportFailure();
    });
    if (direction === 'send') {
      transport.on('produce', ({ kind, rtpParameters }, callback, errback) => {
        if (kind !== 'audio' || !this.activeFloorToken) {
          errback(new Error('An active floor lease is required before producing audio.'));
          return;
        }
        void emitWithAck<ProduceAudioResult>(socket, ClientEvent.ProduceAudio, {
          transportId: transport.id,
          floorToken: this.activeFloorToken,
          kind: 'audio',
          rtpParameters: rtpParameters as unknown as Record<string, unknown>
        })
          .then(({ producerId }) => callback({ id: producerId }))
          .catch((error: unknown) => errback(asError(error)));
      });
    }
  }

  private async createInputGraph(rawStream: MediaStream): Promise<MediaStreamTrack> {
    this.closeInputGraph();
    const context = new AudioContext({ latencyHint: 'interactive' });
    const source = context.createMediaStreamSource(rawStream);
    const gain = context.createGain();
    const analyser = context.createAnalyser();
    const destination = context.createMediaStreamDestination();
    gain.gain.value = this.inputGain;
    analyser.fftSize = 256;
    source.connect(gain);
    gain.connect(analyser);
    gain.connect(destination);
    this.inputGraph = { context, source, gain, analyser, destination, rawStream };
    await context.resume();
    const track = destination.stream.getAudioTracks()[0];
    if (!track) throw new Error('Browser did not provide an audio track.');
    return track;
  }

  private closeInputGraph(): void {
    const graph = this.inputGraph;
    if (!graph) return;
    graph.source.disconnect();
    graph.gain.disconnect();
    graph.analyser.disconnect();
    graph.destination.disconnect();
    for (const track of graph.rawStream.getTracks()) track.stop();
    for (const track of graph.destination.stream.getTracks()) track.stop();
    void graph.context.close();
    this.inputGraph = undefined;
  }

  private async attachRemoteTrack(consumer: MediasoupTypes.Consumer): Promise<void> {
    const remoteStream = new MediaStream([consumer.track]);

    // 1. Direct playback via HTMLAudioElement (CRITICAL for mobile iOS/Android WebRTC)
    if (this.audioElement) {
      this.audioElement.srcObject = remoteStream;
      this.audioElement.volume = Math.min(Math.max(this.outputGain, 0), 1);
      void this.audioElement.play().catch((err: unknown) => {
        console.warn('AudioElement play caught:', err);
      });
    }

    // 2. Also try Web Audio routing for browsers that support it
    try {
      const { context, destination } = await this.ensureOutputGraph();
      if (context && context.state !== 'closed') {
        const source = context.createMediaStreamSource(remoteStream);
        const gain = context.createGain();
        gain.gain.value = this.outputGain;
        source.connect(gain);
        gain.connect(destination);
        this.remoteGraphs.set(consumer.id, { source, gain });
      }
    } catch {
      // Ignore Web Audio errors if createMediaStreamSource is not supported for WebRTC tracks
    }

    this.events.onRemoteAudioActive(true);
  }

  private async ensureOutputGraph(): Promise<{ context: AudioContext; destination: MediaStreamAudioDestinationNode }> {
    const graph = this.getOrCreateOutputGraph();
    await this.enableAudioOutput().catch(() => undefined);
    return graph;
  }

  private getOrCreateOutputGraph(): { context: AudioContext; destination: MediaStreamAudioDestinationNode } {
    if (!this.outputContext || !this.outputDestination) {
      this.outputContext = new AudioContext({ latencyHint: 'interactive' });
      this.outputDestination = this.outputContext.createMediaStreamDestination();
      if (this.audioElement) {
        this.audioElement.srcObject = this.outputDestination.stream;
        this.audioElement.volume = 1;
      }
    }
    return { context: this.outputContext, destination: this.outputDestination };
  }

  private startMetrics(): void {
    if (this.metricTimer) return;
    this.metricTimer = window.setInterval(() => {
      void this.sampleMetrics();
    }, 1_000);
    void this.sampleMetrics();
  }

  private stopMetricsIfIdle(): void {
    if (this.producer || this.consumers.size > 0) return;
    if (this.metricTimer) window.clearInterval(this.metricTimer);
    this.metricTimer = undefined;
    this.events.onMetrics({ inputLevel: 0 });
  }

  private async sampleMetrics(): Promise<void> {
    if (this.samplingMetrics) return;
    this.samplingMetrics = true;
    try {
      const metrics: AudioMetrics = { inputLevel: this.readInputLevel() };
      if (this.producer) this.readProducerStats(metrics, await this.producer.getStats());
      for (const consumer of this.consumers.values()) {
        this.readConsumerStats(metrics, await consumer.getStats());
      }
      this.events.onMetrics(metrics);
    } catch {
      // Stats are best effort and must never interrupt realtime audio.
    } finally {
      this.samplingMetrics = false;
    }
  }

  private readInputLevel(): number {
    const analyser = this.inputGraph?.analyser;
    if (!analyser) return 0;
    const samples = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(samples);
    let sum = 0;
    for (const sample of samples) {
      const normalized = (sample - 128) / 128;
      sum += normalized * normalized;
    }
    return Math.min(1, Math.sqrt(sum / samples.length));
  }

  private readProducerStats(metrics: AudioMetrics, stats: RTCStatsReport): void {
    for (const stat of stats.values()) {
      if (!isRecord(stat) || stat.type !== 'remote-inbound-rtp') continue;
      if (typeof stat.roundTripTime === 'number') metrics.roundTripMs = Math.round(stat.roundTripTime * 1_000);
    }
  }

  private readConsumerStats(metrics: AudioMetrics, stats: RTCStatsReport): void {
    for (const stat of stats.values()) {
      if (!isRecord(stat) || stat.type !== 'inbound-rtp') continue;
      if (typeof stat.jitter === 'number') metrics.inboundJitterMs = Math.round(stat.jitter * 1_000);
      if (typeof stat.packetsLost === 'number') metrics.inboundPacketsLost = stat.packetsLost;
    }
  }
}
