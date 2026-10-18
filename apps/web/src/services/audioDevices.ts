// Liệt kê micro / loa của thiết bị. Nhãn (tên thiết bị) chỉ có sau khi đã cấp quyền micro.

export interface DeviceOption {
  deviceId: string;
  label: string;
}

export interface AudioDeviceList {
  inputs: DeviceOption[];
  outputs: DeviceOption[];
}

/** Trình duyệt cho phép chọn loa phát (Chrome/Edge; Safari/iOS thì không). */
export function canSelectOutput(): boolean {
  return typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype;
}

function describe(device: MediaDeviceInfo, index: number, fallback: string): DeviceOption {
  return { deviceId: device.deviceId, label: device.label || `${fallback} ${index + 1}` };
}

export async function listAudioDevices(): Promise<AudioDeviceList> {
  if (!navigator.mediaDevices?.enumerateDevices) return { inputs: [], outputs: [] };
  const devices = await navigator.mediaDevices.enumerateDevices();
  // "default"/"communications" là bí danh của Chrome trên Windows; tùy chọn "Mặc định" trong UI đã bao trùm.
  const real = (kind: MediaDeviceKind) =>
    devices.filter((device) => device.kind === kind && device.deviceId && !['default', 'communications'].includes(device.deviceId));
  return {
    inputs: real('audioinput').map((device, index) => describe(device, index, 'Micro')),
    outputs: real('audiooutput').map((device, index) => describe(device, index, 'Loa'))
  };
}

/** Đoán nhanh loại thiết bị từ tên để hiển thị biểu tượng/nhãn dễ hiểu. */
export function deviceKindHint(label: string): 'bluetooth' | 'headset' | 'builtin' {
  if (/bluetooth|airpods|buds|hands-free|bt\b/i.test(label)) return 'bluetooth';
  if (/headset|headphone|tai nghe|earphone|usb|wired|jack/i.test(label)) return 'headset';
  return 'builtin';
}
