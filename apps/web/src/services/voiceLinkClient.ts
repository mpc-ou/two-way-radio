import { io, type Socket } from 'socket.io-client';
import {
  ClientEvent,
  ServerEvent,
  type AudioConsumerClosedPayload,
  type AudioConsumerPayload,
  type AudioRelayProfile,
  type ChannelInfo,
  type ChatHistoryPayload,
  type ChatMessage,
  type ErrorPayload,
  type FloorDeniedPayload,
  type FloorGrantedPayload,
  type FloorReleasedPayload,
  type RoomStatePayload
} from '@mpc-voicelink/protocol';
import { AckError, emitWithAck } from '../lib/socket';
import { storage } from '../utils/storage';
import { VoiceMedia, type AudioMetrics } from './voiceMedia';
import { canSelectOutput, listAudioDevices, type DeviceOption } from './audioDevices';
import {
  checkEnvironment,
  describeConnectError,
  describeDisconnect,
  describeMediaFailure,
  describeOffline,
  describeRequestError,
  formatLogTime,
  type ConnectionIssue,
  type LogEntry,
  type LogLevel
} from './connectionIssues';

export type ConnectionStatus = 'connecting' | 'online' | 'offline';
export type PttPhase = 'IDLE' | 'REQUESTING' | 'TALKING' | 'RELEASING';
export type MediaStatus = 'idle' | 'starting' | 'ready' | 'error';
export type NoticeTone = 'info' | 'warn' | 'error';

export interface PinPrompt {
  channelId: string;
  error?: string;
}

export interface VoiceLinkState {
  status: ConnectionStatus;
  channels: ChannelInfo[];
  /** Channel đang ở (đã vào thành công). */
  channelId?: string;
  /** Channel đang xin vào. */
  joiningChannelId?: string;
  room?: RoomStatePayload;
  phase: PttPhase;
  media: MediaStatus;
  transportState: string;
  metrics: AudioMetrics;
  audioBlocked: boolean;
  pinPrompt?: PinPrompt;
  notice?: { text: string; tone: NoticeTone; at: number };
  floorGrantMs?: number;
  profile?: AudioRelayProfile;
  /** Tin chat của channel hiện tại (mới nhất ở cuối). */
  chat: ChatMessage[];
  /** Sự cố kết nối đang diễn ra (mất mạng, không tới server, mất âm thanh). */
  issue?: ConnectionIssue;
  /** Vấn đề môi trường phát hiện lúc mở trang (HTTP, trình duyệt không hỗ trợ). */
  envIssue?: ConnectionIssue;
  /** Số lần đang thử kết nối lại. */
  reconnectAttempt: number;
  /** Nhật ký sự cố gần nhất (mới nhất ở cuối). */
  log: LogEntry[];
  /** Micro / loa có trên máy (nhãn chỉ có sau khi cấp quyền micro). */
  inputs: DeviceOption[];
  outputs: DeviceOption[];
  /** Thiết bị đã chọn; undefined = mặc định của hệ thống. */
  inputDeviceId?: string;
  outputDeviceId?: string;
  /** Trình duyệt cho chọn loa phát (Safari/iOS: không). */
  outputSelectable: boolean;
  /** Tên micro đang thu thực tế. */
  activeInputLabel?: string;
}

const INITIAL_STATE: VoiceLinkState = {
  status: 'connecting',
  channels: [],
  phase: 'IDLE',
  media: 'idle',
  transportState: '—',
  metrics: { inputLevel: 0 },
  audioBlocked: false,
  chat: [],
  reconnectAttempt: 0,
  log: [],
  inputs: [],
  outputs: [],
  outputSelectable: false
};

const CHAT_KEEP = 100;
const LOG_KEEP = 50;

function vibrate(pattern: number | number[]): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Không hỗ trợ rung.
  }
}

/**
 * Bộ điều khiển phía client: một socket tới chính server phục vụ trang, channel hiện tại,
 * máy trạng thái PTT (IDLE → REQUESTING → TALKING → RELEASING → IDLE) và media.
 * Server là nơi duy nhất quyết định ai được nói; client chỉ bật track sau FLOOR_GRANTED.
 */
export class VoiceLinkClient {
  private state: VoiceLinkState = INITIAL_STATE;
  private readonly listeners = new Set<() => void>();
  private readonly socket: Socket;
  private media?: VoiceMedia;
  private floorToken?: string;
  private heartbeatTimer?: number;
  private heartbeatIntervalMs = 750;
  private pressActive = false;
  private floorRequestedAt?: number;
  /** Channel muốn ở: tự vào lại sau khi mất kết nối. */
  private desiredChannelId?: string;
  private volume = storage.getVolume();
  private playoutDelayMs = storage.getPlayoutDelay();
  private disconnectedAt?: number;
  private lastConnectError?: string;
  /** Thông báo "đã kết nối lại" chờ gộp với lần tự vào lại channel (tránh bị toast sau ghi đè). */
  private reconnectNotice?: string;
  private destroyed = false;
  /** Micro người dùng chọn: giữ lại để tự chuyển về khi tai nghe/Bluetooth kết nối lại. */
  private preferredInputId = storage.getInputDevice();
  private knownDeviceIds = new Set<string>();
  private readonly onDeviceChange = (): void => {
    void this.refreshDevices(true);
  };
  private readonly onBrowserOffline = (): void => {
    this.log('error', 'Điện thoại mất kết nối Wi-Fi.');
    this.update({ issue: describeOffline() });
  };
  private readonly onBrowserOnline = (): void => {
    this.log('info', 'Điện thoại có Wi-Fi trở lại.');
    if (this.state.issue?.kind === 'offline') {
      this.update({ issue: undefined });
      // Socket có thể chưa kịp đứt khi mạng mất ngắn: vẫn báo cho người dùng biết đã ổn.
      if (this.socket.connected) this.notify('Đã có Wi-Fi trở lại.');
    }
    if (!this.socket.connected) this.socket.connect();
  };

  constructor(private readonly clientId: string, private displayName: string, initialChannelId?: string) {
    this.desiredChannelId = initialChannelId;
    const envIssue = checkEnvironment();
    if (envIssue) {
      this.state = { ...this.state, envIssue };
      this.log('error', `${envIssue.title}: ${envIssue.hint}`);
    }
    window.addEventListener('offline', this.onBrowserOffline);
    window.addEventListener('online', this.onBrowserOnline);
    this.state = {
      ...this.state,
      inputDeviceId: this.preferredInputId,
      outputDeviceId: storage.getOutputDevice(),
      outputSelectable: canSelectOutput()
    };
    navigator.mediaDevices?.addEventListener?.('devicechange', this.onDeviceChange);
    void this.refreshDevices(false);
    this.socket = io({
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 3000,
      timeout: 6000
    });
    this.registerSocket();
    if (!navigator.onLine) this.onBrowserOffline();
  }

  // ---- React binding (useSyncExternalStore) ----
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getState = (): VoiceLinkState => this.state;

  get myClientId(): string {
    return this.clientId;
  }

  get settings(): { volume: number; playoutDelayMs: number } {
    return { volume: this.volume, playoutDelayMs: this.playoutDelayMs };
  }

  // ---- Actions ----
  async joinChannel(channelId: string, pin?: string): Promise<void> {
    if (this.state.channelId === channelId || this.state.joiningChannelId) return;
    this.media?.unlockAudio();
    this.releaseLocally();
    this.update({ joiningChannelId: channelId, pinPrompt: undefined });

    const effectivePin = pin ?? storage.getPin(channelId);
    try {
      const room = await emitWithAck<RoomStatePayload>(this.socket, ClientEvent.JoinChannel, {
        channelId,
        clientId: this.clientId,
        displayName: this.displayName,
        ...(effectivePin ? { pin: effectivePin } : {})
      });
      this.desiredChannelId = channelId;
      storage.setLastChannel(channelId);
      if (effectivePin) storage.setPin(channelId, effectivePin);
      const switching = Boolean(this.media?.ready);
      this.update({ channelId, joiningChannelId: undefined, room, phase: 'IDLE' });
      const joined = `Đã vào ${this.channelName(channelId)}.`;
      this.notify(this.reconnectNotice ? `${this.reconnectNotice} ${joined}` : joined);
      this.reconnectNotice = undefined;
      await this.startMedia(switching);
    } catch (error) {
      this.update({ joiningChannelId: undefined });
      if (error instanceof AckError && (error.code === 'PIN_REQUIRED' || error.code === 'PIN_INVALID')) {
        if (error.code === 'PIN_INVALID') storage.setPin(channelId, undefined);
        this.update({ pinPrompt: { channelId, error: error.code === 'PIN_INVALID' ? error.message : undefined } });
        return;
      }
      if (error instanceof AckError && error.code === 'PIN_BLOCKED') {
        this.update({ pinPrompt: { channelId, error: error.message } });
        return;
      }
      this.notify(`Không vào được channel: ${describeRequestError(error)}`, 'error');
    }
  }

  async leaveChannel(): Promise<void> {
    this.releaseLocally();
    this.desiredChannelId = undefined;
    storage.setLastChannel(undefined);
    this.media?.left();
    this.update({ channelId: undefined, room: undefined, phase: 'IDLE', chat: [] });
    await emitWithAck(this.socket, ClientEvent.LeaveChannel, {}).catch(() => undefined);
  }

  /** Gửi tin chat vào channel hiện tại. Trả về false nếu server từ chối. */
  async sendChat(text: string): Promise<boolean> {
    const trimmed = text.trim();
    if (!trimmed || !this.state.channelId) return false;
    try {
      await emitWithAck<ChatMessage>(this.socket, ClientEvent.SendChat, { text: trimmed });
      return true;
    } catch (error) {
      this.notify(`Không gửi được tin nhắn: ${describeRequestError(error)}`, 'warn');
      return false;
    }
  }

  dismissPinPrompt(): void {
    this.update({ pinPrompt: undefined });
  }

  /** Nhấn PTT. Phải được gọi trong sự kiện chạm/nhấn của người dùng. */
  pressTalk(): void {
    this.media?.unlockAudio();
    const { room, phase, media } = this.state;
    if (!room || phase !== 'IDLE') return;
    if (media !== 'ready') {
      this.notify('Âm thanh chưa sẵn sàng.', 'warn');
      return;
    }
    if (room.speakerClientId && room.speakerClientId !== this.clientId) {
      this.media?.beep('busy');
      vibrate([20, 60, 20]);
      return;
    }
    this.pressActive = true;
    this.floorRequestedAt = performance.now();
    this.update({ phase: 'REQUESTING' });
    this.socket.emit(ClientEvent.RequestFloor, {});
  }

  /** Nhả PTT. */
  releaseTalk(): void {
    this.pressActive = false;
    if (this.state.phase === 'REQUESTING') {
      // FLOOR_GRANTED đến sau sẽ được nhả ngay (xem onFloorGranted).
      return;
    }
    if (this.state.phase !== 'TALKING') return;
    this.stopTalking(true);
  }

  forceReleaseFloor(controlCode: string): Promise<void> {
    return emitWithAck(this.socket, ClientEvent.ForceReleaseFloor, { controlCode }).then(() => undefined);
  }

  unlockAudio(): void {
    this.media?.unlockAudio();
  }

  setDisplayName(name: string): void {
    this.displayName = name.trim();
    storage.setName(this.displayName);
    const channelId = this.state.channelId;
    if (channelId) {
      // Vào lại để server cập nhật tên (cùng socket, không mất media).
      void this.leaveChannel().then(() => this.joinChannel(channelId));
    }
  }

  setVolume(value: number): void {
    this.volume = value;
    storage.setVolume(value);
    this.media?.setVolume(value);
  }

  setPlayoutDelay(value: number): void {
    this.playoutDelayMs = value;
    storage.setPlayoutDelay(value);
    this.media?.setPlayoutDelay(value);
  }

  /** Chọn micro. Đổi ngay cả khi đang trong channel (không ngắt kết nối). */
  async setInputDevice(deviceId: string | undefined): Promise<void> {
    this.preferredInputId = deviceId;
    storage.setInputDevice(deviceId);
    this.update({ inputDeviceId: deviceId });
    try {
      await this.media?.setInputDevice(deviceId);
      this.update({ activeInputLabel: this.media?.activeInputLabel });
      this.notify(`Micro: ${this.deviceLabel(this.state.inputs, deviceId)}.`);
    } catch (error) {
      this.notify(`Không dùng được micro đã chọn: ${error instanceof Error ? error.message : 'lỗi'}`, 'error');
    }
  }

  /** Chọn loa/tai nghe phát âm thanh (trình duyệt hỗ trợ setSinkId). */
  async setOutputDevice(deviceId: string | undefined): Promise<void> {
    storage.setOutputDevice(deviceId);
    this.update({ outputDeviceId: deviceId });
    await this.media?.setOutputDevice(deviceId);
    this.notify(`Âm thanh phát ra: ${this.deviceLabel(this.state.outputs, deviceId)}.`);
  }

  testBeep(): void {
    this.media?.unlockAudio();
    this.media?.beep('permit');
  }

  /** Nhật ký dạng văn bản để sao chép gửi người vận hành. */
  logText(): string {
    const header = `MPC VoiceLink — ${new Date().toLocaleString('vi-VN')} — ${navigator.userAgent}`;
    const lines = this.state.log.map((entry) => `${formatLogTime(entry.at)} [${entry.level}] ${entry.text}`);
    return [header, ...lines].join('\n');
  }

  destroy(): void {
    this.destroyed = true;
    window.removeEventListener('offline', this.onBrowserOffline);
    window.removeEventListener('online', this.onBrowserOnline);
    navigator.mediaDevices?.removeEventListener?.('devicechange', this.onDeviceChange);
    this.releaseLocally();
    void this.media?.close();
    this.socket.removeAllListeners();
    this.socket.disconnect();
    this.listeners.clear();
  }

  // ---- Internals ----
  private registerSocket(): void {
    const socket = this.socket;

    socket.on('connect', () => {
      if (this.disconnectedAt !== undefined) {
        const seconds = Math.max(1, Math.round((Date.now() - this.disconnectedAt) / 1000));
        const text = `Đã kết nối lại sau ${seconds} giây.`;
        this.log('info', text);
        if (this.desiredChannelId) this.reconnectNotice = text;
        else this.notify(text);
      } else {
        this.log('info', 'Đã kết nối tới server.');
      }
      this.disconnectedAt = undefined;
      this.lastConnectError = undefined;
      this.update({ status: 'online', issue: undefined, reconnectAttempt: 0 });
      void emitWithAck<ChannelInfo[]>(socket, ClientEvent.ListChannels, {})
        .then((channels) => {
          this.update({ channels });
          const target = this.desiredChannelId;
          if (target && channels.some((channel) => channel.id === target)) void this.joinChannel(target);
        })
        .catch(() => undefined);
    });

    socket.on('disconnect', (reason: string) => {
      if (this.destroyed) return;
      this.disconnectedAt ??= Date.now();
      // 'io client disconnect' là do chính client chủ động dựng lại (lỗi media): đã ghi ở onFatal.
      if (reason !== 'io client disconnect') {
        const issue = navigator.onLine ? describeDisconnect(reason) : describeOffline();
        this.log('error', `${issue.title} (${reason}).`);
        this.update({ issue });
      }
      this.releaseLocally();
      void this.media?.close();
      this.media = undefined;
      this.update({
        status: 'offline',
        channelId: undefined,
        joiningChannelId: undefined,
        room: undefined,
        phase: 'IDLE',
        media: 'idle',
        transportState: '—'
      });
    });

    socket.io.on('reconnect_attempt', (attempt: number) => this.update({ status: 'connecting', reconnectAttempt: attempt }));

    socket.on('connect_error', (error: Error) => {
      this.disconnectedAt ??= Date.now();
      if (!navigator.onLine) {
        this.update({ status: 'offline', issue: describeOffline() });
        return;
      }
      const issue = describeConnectError(error);
      // Chỉ ghi nhật ký khi kiểu lỗi đổi, không ghi lặp ở mỗi lần thử lại.
      if (issue.code !== this.lastConnectError) {
        this.lastConnectError = issue.code;
        this.log('error', `${issue.title} (${issue.code}).`);
      }
      const since = this.state.issue?.kind === 'unreachable' ? this.state.issue.since : issue.since;
      this.update({ status: 'offline', issue: { ...issue, since } });
    });

    socket.on(ServerEvent.ChannelsUpdate, (channels: ChannelInfo[]) => this.update({ channels }));

    socket.on(ServerEvent.RoomState, (room: RoomStatePayload) => {
      if (room.roomId !== this.state.channelId) return;
      this.update({ room });
    });

    socket.on(ServerEvent.ChatHistory, (payload: ChatHistoryPayload) => {
      // Lịch sử đến ngay trước ack JOIN_CHANNEL nên so với cả channel đang xin vào.
      if (payload.roomId !== this.state.joiningChannelId && payload.roomId !== this.state.channelId) return;
      this.update({ chat: payload.messages.slice(-CHAT_KEEP) });
    });

    socket.on(ServerEvent.ChatMessage, (message: ChatMessage) => {
      if (message.roomId !== this.state.channelId) return;
      if (this.state.chat.some((item) => item.id === message.id)) return;
      this.update({ chat: [...this.state.chat, message].slice(-CHAT_KEEP) });
    });

    socket.on(ServerEvent.AudioProfile, (profile: AudioRelayProfile) => this.update({ profile }));

    socket.on(ServerEvent.AudioConsumerCreated, (payload: AudioConsumerPayload) => {
      void this.media?.consume(payload).catch(() => undefined);
    });

    socket.on(ServerEvent.AudioConsumerClosed, (payload: AudioConsumerClosedPayload) => {
      this.media?.closeConsumer(payload.consumerId);
    });

    socket.on(ServerEvent.FloorGranted, (payload: FloorGrantedPayload) => this.onFloorGranted(payload));

    socket.on(ServerEvent.FloorDenied, (_payload: FloorDeniedPayload) => {
      this.update({ phase: 'IDLE' });
      this.media?.beep('busy');
      vibrate([20, 60, 20]);
    });

    socket.on(ServerEvent.FloorReleased, (payload: FloorReleasedPayload) => {
      if (payload.previousSpeakerClientId !== this.clientId) return;
      const wasTalking = this.state.phase === 'TALKING';
      this.stopTalking(false);
      if (wasTalking && payload.reason === 'lease_expired') this.notify('Mất quyền nói (hết hạn).', 'warn');
      if (payload.reason === 'force_released') this.notify('Admin đã thu hồi mic.', 'warn');
    });

    socket.on(ServerEvent.Error, (payload: ErrorPayload) => {
      if (payload.code === 'STALE_FLOOR_TOKEN') {
        this.stopTalking(false);
        return;
      }
      if (payload.code.startsWith('FLOOR')) this.update({ phase: 'IDLE' });
      this.notify(payload.message, 'warn');
    });
  }

  private onFloorGranted(payload: FloorGrantedPayload): void {
    this.floorToken = payload.floorToken;
    this.heartbeatIntervalMs = payload.heartbeatIntervalMs;
    if (!this.pressActive) {
      // Người dùng đã nhả trước khi được cấp.
      this.stopTalking(true);
      return;
    }
    this.media?.setTalking(true);
    this.media?.beep('permit');
    vibrate(30);
    const floorGrantMs = this.floorRequestedAt !== undefined
      ? Math.round(performance.now() - this.floorRequestedAt)
      : undefined;
    this.update({ phase: 'TALKING', floorGrantMs });
    this.startHeartbeat();
  }

  /** Tắt mic ngay tại chỗ, sau đó báo server nhả floor (nếu còn token). */
  private stopTalking(notifyServer: boolean): void {
    const token = this.floorToken;
    const wasTalking = this.state.phase === 'TALKING';
    this.media?.setTalking(false);
    this.stopHeartbeat();
    this.floorToken = undefined;
    if (notifyServer && token) this.socket.emit(ClientEvent.ReleaseFloor, { floorToken: token });
    if (wasTalking) {
      this.media?.beep('end');
      vibrate(15);
    }
    this.update({ phase: 'IDLE' });
  }

  private releaseLocally(): void {
    this.pressActive = false;
    if (this.state.phase === 'TALKING' || this.floorToken) this.stopTalking(true);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = window.setInterval(() => {
      if (this.floorToken) this.socket.emit(ClientEvent.Heartbeat, { floorToken: this.floorToken });
    }, this.heartbeatIntervalMs);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) window.clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = undefined;
  }

  private async startMedia(switching: boolean): Promise<void> {
    if (!this.media) {
      this.media = new VoiceMedia(this.socket, {
        onTransportState: (transportState) => {
          const [direction, state] = transportState.split(':');
          const label = direction === 'send' ? 'gửi' : 'nhận';
          if (state === 'disconnected') this.log('warn', `Đường âm thanh ${label} chập chờn, đang thử nối lại (ICE restart).`);
          if (state === 'failed') this.log('error', `Đường âm thanh ${label} thất bại.`);
          if (state === 'connected' && this.state.transportState === `${direction}:disconnected`) {
            this.log('info', `Đường âm thanh ${label} đã ổn định lại.`);
          }
          this.update({ transportState });
        },
        onFatal: (message) => {
          const issue = describeMediaFailure(message);
          this.log('error', `${issue.title}: ${message}`);
          this.update({ issue });
          // Dựng lại toàn bộ: socket nối lại sẽ tự vào lại channel mong muốn.
          this.socket.disconnect();
          window.setTimeout(() => this.socket.connect(), 300);
        },
        onMetrics: (metrics) => this.update({ metrics }),
        onAutoplayBlocked: (audioBlocked) => {
          if (audioBlocked !== this.state.audioBlocked) this.update({ audioBlocked });
        },
        onInputDeviceLost: (fallbackOk) => {
          if (!fallbackOk) return;
          this.notify('Tai nghe / micro đã ngắt, chuyển về micro mặc định.', 'warn');
          this.update({ inputDeviceId: undefined, activeInputLabel: this.media?.activeInputLabel });
        }
      }, { inputDeviceId: this.preferredInputId, outputDeviceId: this.state.outputDeviceId });
      this.media.setVolume(this.volume);
      this.media.setPlayoutDelay(this.playoutDelayMs);
    }
    this.update({ media: this.media.ready ? 'ready' : 'starting' });
    try {
      if (switching) await this.media.rejoined();
      else await this.media.start();
      this.media.setPlayoutDelay(this.playoutDelayMs);
      this.update({ media: 'ready', profile: this.media.audioProfile, activeInputLabel: this.media.activeInputLabel });
      // Sau khi cấp quyền micro mới có tên thiết bị.
      void this.refreshDevices(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không mở được âm thanh.';
      const denied = error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'SecurityError');
      this.update({ media: 'error' });
      this.notify(denied ? 'Cần cấp quyền microphone để nói (cho phép micro trong cài đặt trình duyệt).' : `Lỗi âm thanh: ${message}`, 'error');
    }
  }

  /**
   * Cập nhật danh sách thiết bị. Khi có thay đổi (cắm/rút tai nghe, Bluetooth kết nối/ngắt):
   * báo thiết bị mới, tự chuyển lại sang micro đã chọn nếu nó vừa xuất hiện trở lại,
   * và quay về loa mặc định nếu loa đã chọn biến mất.
   */
  private async refreshDevices(changed: boolean): Promise<void> {
    let list;
    try {
      list = await listAudioDevices();
    } catch {
      return;
    }
    const all = [...list.inputs, ...list.outputs];
    if (changed) {
      const added = all.filter((device) => !this.knownDeviceIds.has(device.deviceId) && device.label);
      const removed = this.knownDeviceIds.size > 0 && all.length < this.knownDeviceIds.size;
      if (added.length > 0) this.log('info', `Phát hiện thiết bị âm thanh: ${[...new Set(added.map((d) => d.label))].join(', ')}.`);
      else if (removed) this.log('info', 'Một thiết bị âm thanh vừa bị ngắt.');
    }
    this.knownDeviceIds = new Set(all.map((device) => device.deviceId));
    this.update({ inputs: list.inputs, outputs: list.outputs });

    const preferred = this.preferredInputId;
    if (changed && preferred && this.state.inputDeviceId !== preferred && list.inputs.some((d) => d.deviceId === preferred)) {
      await this.setInputDevice(preferred);
    }
    const output = this.state.outputDeviceId;
    if (output && list.outputs.length > 0 && !list.outputs.some((d) => d.deviceId === output)) {
      this.update({ outputDeviceId: undefined });
      await this.media?.setOutputDevice(undefined);
      this.notify('Loa / tai nghe đã chọn không còn, phát ra loa mặc định.', 'warn');
    }
  }

  private deviceLabel(list: DeviceOption[], deviceId: string | undefined): string {
    if (!deviceId) return 'mặc định của máy';
    return list.find((device) => device.deviceId === deviceId)?.label ?? 'thiết bị đã chọn';
  }

  private channelName(channelId: string): string {
    return this.state.channels.find((channel) => channel.id === channelId)?.name ?? channelId;
  }

  private notify(text: string, tone: NoticeTone = 'info'): void {
    if (tone !== 'info') this.log(tone, text);
    this.update({ notice: { text, tone, at: Date.now() } });
  }

  private log(level: LogLevel, text: string): void {
    const last = this.state.log.at(-1);
    if (last && last.text === text && Date.now() - last.at < 2000) return;
    this.update({ log: [...this.state.log, { at: Date.now(), level, text }].slice(-LOG_KEEP) });
  }

  private update(patch: Partial<VoiceLinkState>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }
}
