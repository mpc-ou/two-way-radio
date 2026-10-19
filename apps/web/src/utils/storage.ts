// Mọi truy cập storage đều bọc try/catch: chế độ riêng tư hoặc trình duyệt chặn site data
// không được làm hỏng ứng dụng.

const KEYS = {
  name: 'mpc_name',
  lastChannel: 'mpc_last_channel',
  pinPrefix: 'mpc_pin_',
  volume: 'mpc_volume',
  playoutDelay: 'mpc_playout_delay',
  inputDevice: 'mpc_input_device',
  outputDevice: 'mpc_output_device',
  chatSound: 'mpc_chat_sound'
} as const;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Bỏ qua: chỉ mất tính năng ghi nhớ.
  }
}

function readNumber(key: string, fallback: number): number {
  const value = Number(read(key));
  return read(key) !== null && Number.isFinite(value) ? value : fallback;
}

export const storage = {
  getName: (): string => read(KEYS.name)?.trim() ?? '',
  setName: (name: string): void => write(KEYS.name, name.trim()),

  getLastChannel: (): string | undefined => read(KEYS.lastChannel) ?? undefined,
  setLastChannel: (channelId: string | undefined): void => write(KEYS.lastChannel, channelId ?? null),

  getPin: (channelId: string): string | undefined => read(KEYS.pinPrefix + channelId) ?? undefined,
  setPin: (channelId: string, pin: string | undefined): void => write(KEYS.pinPrefix + channelId, pin ?? null),

  getVolume: (): number => readNumber(KEYS.volume, 1),
  setVolume: (value: number): void => write(KEYS.volume, String(value)),

  getPlayoutDelay: (): number => readNumber(KEYS.playoutDelay, 0),
  setPlayoutDelay: (value: number): void => write(KEYS.playoutDelay, String(value)),

  /** deviceId micro/loa đã chọn; undefined = mặc định của hệ thống. */
  getInputDevice: (): string | undefined => read(KEYS.inputDevice) || undefined,
  setInputDevice: (deviceId: string | undefined): void => write(KEYS.inputDevice, deviceId ?? null),
  getOutputDevice: (): string | undefined => read(KEYS.outputDevice) || undefined,
  setOutputDevice: (deviceId: string | undefined): void => write(KEYS.outputDevice, deviceId ?? null),

  /** Âm báo khi có tin chat mới (mặc định bật). */
  getChatSound: (): boolean => read(KEYS.chatSound) !== 'off',
  setChatSound: (enabled: boolean): void => write(KEYS.chatSound, enabled ? 'on' : 'off')
};

/** Channel cho phép chọn qua link/QR: https://<server>/?channel=<id> */
export function channelFromUrl(): string | undefined {
  try {
    return new URLSearchParams(window.location.search).get('channel') ?? undefined;
  } catch {
    return undefined;
  }
}
