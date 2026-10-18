import { Device, type types as MediasoupTypes } from 'mediasoup-client';
import type { Socket } from 'socket.io-client';
import {
  ClientEvent,
  type AudioConsumerPayload,
  type AudioRelayProfile,
  type CreateWebRtcTransportResult,
  type MediaCapabilitiesPayload,
  type ProduceAudioResult,
  type RestartIceResult,
  type WebRtcTransportDirection
} from '@mpc-voicelink/protocol';
import { emitWithAck } from '../lib/socket';

export interface AudioMetrics {
  inputLevel: number;
  roundTripMs?: number;
  inboundJitterMs?: number;
  inboundPacketsLost?: number;
}

export interface VoiceMediaEvents {
  onTransportState: (state: string) => void;
  /** Transport không tự phục hồi được sau ICE restart: cần kết nối lại toàn bộ. */
  onFatal: (message: string) => void;
  onMetrics: (metrics: AudioMetrics) => void;
  /** Trình duyệt chặn tự phát âm thanh: cần người dùng chạm để bật loa. */
  onAutoplayBlocked: (blocked: boolean) => void;
  /** Micro đang dùng bị rút/ngắt; đã tự chuyển về micro mặc định (nếu được). */
  onInputDeviceLost: (fallbackOk: boolean) => void;
}

type SinkCapable = HTMLMediaElement & { setSinkId?: (sinkId: string) => Promise<void> };

interface RemoteAudio {
  consumer: MediasoupTypes.Consumer;
  element: HTMLAudioElement;
}

type BeepKind = 'permit' | 'end' | 'busy';

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error('Realtime media operation failed.');
}

/**
 * Toàn bộ media của một client trong một kết nối socket.
 *
 * Mic được mở và Producer được tạo ngay khi vào channel nhưng luôn ở trạng thái pause:
 * server giữ Producer PAUSED và chỉ resume khi cấp floor; client cũng pause cục bộ để
 * track tắt khi không có quyền nói. Bấm PTT chỉ còn một round-trip REQUEST_FLOOR.
 */
export class VoiceMedia {
  private device?: Device;
  private sendTransport?: MediasoupTypes.Transport;
  private recvTransport?: MediasoupTypes.Transport;
  private producer?: MediasoupTypes.Producer;
  private micStream?: MediaStream;
  /** deviceId micro/loa người dùng chọn; undefined = mặc định của hệ thống. */
  private inputDeviceId?: string;
  private outputDeviceId?: string;
  private readonly remotes = new Map<string, RemoteAudio>();
  private profile?: AudioRelayProfile;
  private volume = 1;
  private playoutDelayMs = 0;
  private analyserContext?: AudioContext;
  private analyser?: AnalyserNode;
  private beepContext?: AudioContext;
  private metricTimer?: number;
  private sampling = false;
  private metricTick = 0;
  private readyPromise?: Promise<void>;
  private iceTimers = new Map<string, number>();
  private closed = false;

  constructor(
    private readonly socket: Socket,
    private readonly events: VoiceMediaEvents,
    devices: { inputDeviceId?: string; outputDeviceId?: string } = {}
  ) {
    this.inputDeviceId = devices.inputDeviceId;
    this.outputDeviceId = devices.outputDeviceId;
  }

  get ready(): boolean {
    return Boolean(this.device && this.sendTransport && this.recvTransport);
  }

  get audioProfile(): AudioRelayProfile | undefined {
    return this.profile;
  }

  /** Lần vào channel đầu tiên của kết nối: tải device, tạo transport, mở mic và produce (paused). */
  start(): Promise<void> {
    this.readyPromise ??= this.doStart().catch((error: unknown) => {
      this.readyPromise = undefined;
      throw error;
    });
    return this.readyPromise;
  }

  /** Sau khi đổi channel: server đã đóng Producer cũ, tạo lại Producer (paused) trên cùng transport. */
  async rejoined(): Promise<void> {
    await this.start();
    await this.produce();
  }

  /** Server đã đóng Producer khi rời channel; đóng bản cục bộ cho khớp. */
  left(): void {
    this.producer?.close();
    this.producer = undefined;
  }

  setTalking(talking: boolean): void {
    if (!this.producer || this.producer.closed) return;
    if (talking) this.producer.resume();
    else this.producer.pause();
  }

  async consume(payload: AudioConsumerPayload): Promise<void> {
    await this.start();
    if (!this.recvTransport || this.remotes.has(payload.consumerId) || this.closed) return;
    const consumer = await this.recvTransport.consume({
      id: payload.consumerId,
      producerId: payload.producerId,
      kind: 'audio',
      rtpParameters: payload.rtpParameters as MediasoupTypes.RtpParameters
    });
    this.applyPlayoutDelay(consumer);

    // Mỗi người nói một <audio> riêng: đường phát ngắn nhất, chạy được trên iOS/Android
    // (không qua Web Audio nên không thêm buffer đầu ra).
    const element = document.createElement('audio');
    element.autoplay = true;
    element.setAttribute('playsinline', '');
    element.volume = this.volume;
    element.srcObject = new MediaStream([consumer.track]);
    element.style.display = 'none';
    document.body.appendChild(element);
    await this.applySink(element);
    this.remotes.set(consumer.id, { consumer, element });
    this.play(element);

    consumer.on('transportclose', () => this.closeConsumer(consumer.id));
    consumer.on('trackended', () => this.closeConsumer(consumer.id));
    await emitWithAck(this.socket, ClientEvent.ResumeAudioConsumer, { consumerId: consumer.id });
  }

  closeConsumer(consumerId: string): void {
    const remote = this.remotes.get(consumerId);
    if (!remote) return;
    remote.consumer.close();
    remote.element.srcObject = null;
    remote.element.remove();
    this.remotes.delete(consumerId);
  }

  /** Gọi trong một thao tác chạm của người dùng để mở khóa phát âm thanh trên điện thoại. */
  unlockAudio(): void {
    try {
      this.beepContext ??= new AudioContext({ latencyHint: 'interactive' });
      void this.beepContext.resume();
    } catch {
      // Web Audio không khả dụng: chỉ mất tiếng bíp.
    }
    let anyBlocked = false;
    for (const { element } of this.remotes.values()) {
      element.play().catch(() => {
        anyBlocked = true;
      });
    }
    if (!anyBlocked) this.events.onAutoplayBlocked(false);
  }

  beep(kind: BeepKind): void {
    const context = this.beepContext;
    if (!context || context.state !== 'running') return;
    const tones: Array<[number, number, number]> = kind === 'permit'
      ? [[1250, 0, 0.07]]
      : kind === 'end'
        ? [[880, 0, 0.06]]
        : [[420, 0, 0.09], [420, 0.14, 0.09]];
    for (const [frequency, offset, duration] of tones) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime + offset;
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.18, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.02);
    }
  }

  setVolume(value: number): void {
    this.volume = Math.min(Math.max(value, 0), 1);
    for (const { element } of this.remotes.values()) element.volume = this.volume;
  }

  setPlayoutDelay(delayMs: number): void {
    const maximum = this.profile?.targetPlayoutDelayMaxMs ?? 150;
    this.playoutDelayMs = Math.min(Math.max(delayMs, 0), maximum);
    for (const { consumer } of this.remotes.values()) this.applyPlayoutDelay(consumer);
  }

  /** Tên micro đang thu (để hiển thị). */
  get activeInputLabel(): string | undefined {
    return this.micStream?.getAudioTracks()[0]?.label || undefined;
  }

  /**
   * Đổi micro (micro máy, tai nghe có dây, Bluetooth). Nếu đang trong channel thì thay track của
   * Producer tại chỗ (replaceTrack): không ngắt kết nối, trạng thái pause/resume được giữ nguyên.
   */
  async setInputDevice(deviceId: string | undefined): Promise<void> {
    this.inputDeviceId = deviceId;
    if (!this.micStream) return;
    const next = await this.getMicrophoneStream();
    const track = next.getAudioTracks()[0];
    if (!track) throw new Error('Không lấy được micro đã chọn.');
    if (this.producer && !this.producer.closed) await this.producer.replaceTrack({ track });
    this.swapMicStream(next);
  }

  /** Đổi loa/tai nghe phát âm thanh (chỉ trình duyệt có setSinkId). */
  async setOutputDevice(deviceId: string | undefined): Promise<void> {
    this.outputDeviceId = deviceId;
    await Promise.all([...this.remotes.values()].map(({ element }) => this.applySink(element)));
    const beep = this.beepContext as (AudioContext & { setSinkId?: (id: string) => Promise<void> }) | undefined;
    await beep?.setSinkId?.(deviceId ?? '').catch(() => undefined);
  }

  async close(): Promise<void> {
    this.closed = true;
    for (const timer of this.iceTimers.values()) window.clearTimeout(timer);
    this.iceTimers.clear();
    if (this.metricTimer) window.clearInterval(this.metricTimer);
    this.metricTimer = undefined;
    for (const consumerId of [...this.remotes.keys()]) this.closeConsumer(consumerId);
    this.producer?.close();
    this.sendTransport?.close();
    this.recvTransport?.close();
    for (const track of this.micStream?.getTracks() ?? []) track.stop();
    this.producer = undefined;
    this.sendTransport = undefined;
    this.recvTransport = undefined;
    this.micStream = undefined;
    this.device = undefined;
    await this.analyserContext?.close().catch(() => undefined);
    this.analyserContext = undefined;
    this.analyser = undefined;
    this.events.onMetrics({ inputLevel: 0 });
  }

  private async doStart(): Promise<void> {
    const capabilities = await emitWithAck<MediaCapabilitiesPayload>(this.socket, ClientEvent.GetMediaCapabilities, {});
    this.profile = capabilities.audioProfile;
    const device = await Device.factory();
    await device.load({ routerRtpCapabilities: capabilities.routerRtpCapabilities as MediasoupTypes.RtpCapabilities });
    if (!device.canProduce('audio')) throw new Error('Trình duyệt không hỗ trợ Opus theo cấu hình server.');
    this.device = device;

    const micPromise = this.openMicrophone();
    const recv = await this.createTransport('recv', device.recvRtpCapabilities);
    await this.createTransport('send');
    await micPromise;
    // Consumer cho những người đã có mặt trong channel.
    void Promise.all(recv.consumers.map((payload) => this.consumeReady(payload)));
    await this.produce();
    this.startMetrics();
  }

  /** consume() trong lúc start() còn chạy sẽ chờ readyPromise; bản này dùng nội bộ khi đã sẵn sàng. */
  private async consumeReady(payload: AudioConsumerPayload): Promise<void> {
    try {
      await this.consume(payload);
    } catch {
      // Một consumer lỗi không được làm hỏng cả phiên.
    }
  }

  private async openMicrophone(): Promise<void> {
    if (this.micStream) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Cần mở trang bằng HTTPS để dùng microphone.');
    }
    this.swapMicStream(await this.getMicrophoneStream());
  }

  /** getUserMedia theo micro đã chọn; thiết bị không còn thì quay về mặc định. */
  private async getMicrophoneStream(): Promise<MediaStream> {
    const constraints = (deviceId?: string): MediaStreamConstraints => ({
      audio: {
        ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
        channelCount: { ideal: 1 },
        sampleRate: { ideal: 48000 },
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      video: false
    });
    try {
      return await navigator.mediaDevices.getUserMedia(constraints(this.inputDeviceId));
    } catch (error) {
      const missing = error instanceof DOMException && (error.name === 'OverconstrainedError' || error.name === 'NotFoundError');
      if (!this.inputDeviceId || !missing) throw error;
      this.inputDeviceId = undefined;
      return navigator.mediaDevices.getUserMedia(constraints());
    }
  }

  /** Dùng stream micro mới: dừng stream cũ, gắn đồng hồ mức mic và theo dõi khi thiết bị bị rút. */
  private swapMicStream(next: MediaStream): void {
    const previous = this.micStream;
    this.micStream = next;
    for (const track of previous?.getTracks() ?? []) track.stop();
    void this.analyserContext?.close().catch(() => undefined);
    this.setupAnalyser(next);
    const track = next.getAudioTracks()[0];
    track?.addEventListener('ended', () => {
      // Chỉ xử lý nếu track này vẫn là track đang dùng (không phải track cũ vừa bị thay).
      if (this.closed || this.micStream !== next) return;
      void this.recoverFromLostInput();
    });
  }

  /** Tai nghe/Bluetooth bị ngắt: chuyển về micro mặc định thay vì bỏ cả kết nối. */
  private async recoverFromLostInput(): Promise<void> {
    try {
      await this.setInputDevice(undefined);
      this.events.onInputDeviceLost(true);
    } catch {
      this.events.onInputDeviceLost(false);
      this.events.onFatal('Microphone bị ngắt.');
    }
  }

  private async applySink(element: SinkCapable): Promise<void> {
    if (!element.setSinkId) return;
    try {
      await element.setSinkId(this.outputDeviceId ?? '');
    } catch {
      // Loa đã chọn không còn: phát ra thiết bị mặc định.
      await element.setSinkId('').catch(() => undefined);
    }
  }

  private async produce(): Promise<void> {
    const track = this.micStream?.getAudioTracks()[0];
    if (!this.sendTransport || !track) throw new Error('Microphone chưa sẵn sàng.');
    this.producer?.close();
    const producer = await this.sendTransport.produce({
      track,
      stopTracks: false,
      disableTrackOnPause: true,
      zeroRtpOnPause: false,
      codecOptions: {
        opusStereo: false,
        opusFec: true,
        opusDtx: false,
        opusPtime: 20,
        opusMaxAverageBitrate: this.profile?.opusBitrate
      }
    });
    producer.pause();
    this.producer = producer;
    // Track kết thúc (rút tai nghe, ngắt Bluetooth) được xử lý trong swapMicStream.
  }

  private async createTransport(
    direction: WebRtcTransportDirection,
    rtpCapabilities?: MediasoupTypes.RtpCapabilities
  ): Promise<CreateWebRtcTransportResult> {
    if (!this.device) throw new Error('Media device is not loaded.');
    const response = await emitWithAck<CreateWebRtcTransportResult>(this.socket, ClientEvent.CreateWebRtcTransport, {
      direction,
      ...(rtpCapabilities ? { rtpCapabilities: rtpCapabilities as unknown as Record<string, unknown> } : {})
    });
    const options = response.transport as unknown as MediasoupTypes.TransportOptions;
    const transport = direction === 'send'
      ? this.device.createSendTransport(options)
      : this.device.createRecvTransport(options);
    this.registerTransport(transport, direction);
    if (direction === 'send') this.sendTransport = transport;
    else this.recvTransport = transport;
    return response;
  }

  private registerTransport(transport: MediasoupTypes.Transport, direction: WebRtcTransportDirection): void {
    transport.on('connect', ({ dtlsParameters }, callback, errback) => {
      void emitWithAck(this.socket, ClientEvent.ConnectWebRtcTransport, {
        transportId: transport.id,
        dtlsParameters: dtlsParameters as unknown as Record<string, unknown>
      })
        .then(() => callback())
        .catch((error: unknown) => errback(asError(error)));
    });
    transport.on('connectionstatechange', (state) => {
      this.events.onTransportState(`${direction}:${state}`);
      this.handleConnectionState(transport, state);
    });
    if (direction === 'send') {
      transport.on('produce', ({ kind, rtpParameters }, callback, errback) => {
        if (kind !== 'audio') {
          errback(new Error('Only audio can be produced.'));
          return;
        }
        void emitWithAck<ProduceAudioResult>(this.socket, ClientEvent.ProduceAudio, {
          transportId: transport.id,
          kind: 'audio',
          rtpParameters: rtpParameters as unknown as Record<string, unknown>
        })
          .then(({ producerId }) => callback({ id: producerId }))
          .catch((error: unknown) => errback(asError(error)));
      });
    }
  }

  /** Đi xa/đổi AP: thử ICE restart trước khi bỏ cả kết nối. */
  private handleConnectionState(transport: MediasoupTypes.Transport, state: string): void {
    const pending = this.iceTimers.get(transport.id);
    if (state === 'connected') {
      if (pending) window.clearTimeout(pending);
      this.iceTimers.delete(transport.id);
      return;
    }
    if (state !== 'disconnected' && state !== 'failed') return;
    if (pending) return;
    const delay = state === 'failed' ? 0 : 1500;
    this.iceTimers.set(transport.id, window.setTimeout(() => {
      void this.restartIce(transport).finally(() => {
        // Nếu 8 giây sau vẫn chưa nối lại được thì báo lỗi để controller kết nối lại từ đầu.
        this.iceTimers.set(transport.id, window.setTimeout(() => {
          this.iceTimers.delete(transport.id);
          if (transport.connectionState !== 'connected' && !this.closed) {
            this.events.onFatal('Mất kết nối âm thanh.');
          }
        }, 8000));
      });
    }, delay));
  }

  private async restartIce(transport: MediasoupTypes.Transport): Promise<void> {
    if (this.closed || transport.closed) return;
    try {
      const { iceParameters } = await emitWithAck<RestartIceResult>(this.socket, ClientEvent.RestartIce, {
        transportId: transport.id
      });
      await transport.restartIce({ iceParameters: iceParameters as unknown as MediasoupTypes.IceParameters });
    } catch {
      // Socket có thể đang mất kết nối; controller sẽ dựng lại media khi socket nối lại.
    }
  }

  private play(element: HTMLAudioElement): void {
    void element.play()
      .then(() => this.events.onAutoplayBlocked(false))
      .catch(() => this.events.onAutoplayBlocked(true));
  }

  private applyPlayoutDelay(consumer: MediasoupTypes.Consumer): void {
    const receiver = consumer.rtpReceiver as (RTCRtpReceiver & { playoutDelayHint?: number; jitterBufferTarget?: number }) | undefined;
    if (!receiver) return;
    try {
      if ('jitterBufferTarget' in receiver) receiver.jitterBufferTarget = this.playoutDelayMs;
      if ('playoutDelayHint' in receiver) receiver.playoutDelayHint = this.playoutDelayMs / 1000;
    } catch {
      // Trình duyệt không hỗ trợ gợi ý jitter buffer.
    }
  }

  private setupAnalyser(stream: MediaStream): void {
    try {
      const context = new AudioContext({ latencyHint: 'interactive' });
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      context.createMediaStreamSource(stream).connect(analyser);
      this.analyserContext = context;
      this.analyser = analyser;
    } catch {
      // Chỉ mất đồng hồ mức mic.
    }
  }

  private startMetrics(): void {
    if (this.metricTimer) return;
    this.metricTimer = window.setInterval(() => void this.sampleMetrics(), 250);
  }

  private async sampleMetrics(): Promise<void> {
    if (this.sampling) return;
    this.sampling = true;
    try {
      const metrics: AudioMetrics = { inputLevel: this.producer && !this.producer.paused ? this.readInputLevel() : 0 };
      // Thống kê mạng tốn hơn: lấy mỗi ~1 giây.
      this.metricTick = (this.metricTick + 1) % 4;
      if (this.metricTick === 0) {
        if (this.producer) {
          for (const stat of (await this.producer.getStats()).values()) {
            if (stat.type === 'remote-inbound-rtp' && typeof stat.roundTripTime === 'number') {
              metrics.roundTripMs = Math.round(stat.roundTripTime * 1000);
            }
          }
        }
        for (const { consumer } of this.remotes.values()) {
          for (const stat of (await consumer.getStats()).values()) {
            if (stat.type !== 'inbound-rtp') continue;
            if (typeof stat.jitter === 'number') metrics.inboundJitterMs = Math.round(stat.jitter * 1000);
            if (typeof stat.packetsLost === 'number') {
              metrics.inboundPacketsLost = (metrics.inboundPacketsLost ?? 0) + stat.packetsLost;
            }
          }
        }
      }
      this.events.onMetrics(metrics);
    } catch {
      // Thống kê chỉ mang tính tham khảo.
    } finally {
      this.sampling = false;
    }
  }

  private readInputLevel(): number {
    const analyser = this.analyser;
    if (!analyser) return 0;
    if (this.analyserContext?.state === 'suspended') void this.analyserContext.resume();
    const samples = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(samples);
    let sum = 0;
    for (const sample of samples) {
      const normalized = (sample - 128) / 128;
      sum += normalized * normalized;
    }
    return Math.min(1, Math.sqrt(sum / samples.length) * 3);
  }
}
