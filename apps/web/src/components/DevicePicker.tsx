import { Bluetooth, Headphones, Mic, Smartphone, Speaker } from 'lucide-react';
import { deviceKindHint, type DeviceOption } from '../services/audioDevices';

interface DevicePickerProps {
  inputs: DeviceOption[];
  outputs: DeviceOption[];
  inputDeviceId?: string;
  outputDeviceId?: string;
  outputSelectable: boolean;
  activeInputLabel?: string;
  onInputChange: (deviceId: string | undefined) => void;
  onOutputChange: (deviceId: string | undefined) => void;
}

function KindIcon({ label }: { label?: string }) {
  const kind = label ? deviceKindHint(label) : 'builtin';
  const Icon = kind === 'bluetooth' ? Bluetooth : kind === 'headset' ? Headphones : Smartphone;
  return <Icon className="h-3.5 w-3.5 shrink-0" />;
}

const selectClass =
  'w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none disabled:opacity-50';

/** Chọn micro và loa/tai nghe (micro máy, tai nghe có dây, Bluetooth). */
export function DevicePicker({
  inputs,
  outputs,
  inputDeviceId,
  outputDeviceId,
  outputSelectable,
  activeInputLabel,
  onInputChange,
  onOutputChange
}: DevicePickerProps) {
  const labelsHidden = inputs.length > 0 && inputs.every((device) => /^Micro \d+$/.test(device.label));

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5 text-xs text-slate-300">
        <span className="flex items-center gap-1.5"><Mic className="h-3.5 w-3.5 text-orange-400" /> Micro</span>
        <select
          value={inputDeviceId ?? ''}
          onChange={(event) => onInputChange(event.target.value || undefined)}
          className={selectClass}
        >
          <option value="">Mặc định của máy</option>
          {inputs.map((device) => (
            <option key={device.deviceId} value={device.deviceId}>{device.label}</option>
          ))}
        </select>
        {activeInputLabel && (
          <span className="flex items-center gap-1.5 text-[0.68rem] text-emerald-300">
            <KindIcon label={activeInputLabel} /> Đang thu: <span className="truncate">{activeInputLabel}</span>
          </span>
        )}
        {labelsHidden && <span className="text-[0.68rem] text-slate-500">Vào một channel (cấp quyền micro) để thấy tên thiết bị.</span>}
      </label>

      <label className="flex flex-col gap-1.5 text-xs text-slate-300">
        <span className="flex items-center gap-1.5"><Speaker className="h-3.5 w-3.5 text-orange-400" /> Loa / tai nghe</span>
        {outputSelectable ? (
          <select
            value={outputDeviceId ?? ''}
            onChange={(event) => onOutputChange(event.target.value || undefined)}
            className={selectClass}
          >
            <option value="">Mặc định của máy</option>
            {outputs.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>{device.label}</option>
            ))}
          </select>
        ) : (
          <span className="rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-[0.7rem] leading-snug text-slate-400">
            Trình duyệt này (Safari / iPhone) không cho trang web chọn loa. Hệ thống tự chuyển sang tai nghe khi cắm dây
            hoặc kết nối Bluetooth; trên iPhone có thể chọn ở Trung tâm điều khiển → biểu tượng AirPlay.
          </span>
        )}
      </label>

      <p className="text-[0.68rem] leading-snug text-slate-500">
        Cắm hoặc kết nối tai nghe là danh sách tự cập nhật; rút ra thì tự quay về micro máy, kết nối lại thì tự chuyển về
        thiết bị đã chọn. Dùng micro Bluetooth sẽ đưa tai nghe vào chế độ gọi (tiếng nghe kém hơn một chút); muốn nghe
        Bluetooth rõ hơn, chọn micro của máy.
      </p>
    </div>
  );
}
