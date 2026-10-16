import React from 'react';
import type { AudioRelayProfile } from '@mpc-voicelink/protocol';
import type { AudioPreset } from './AdminModal';
import { Crown, Info, Zap, Shield, Volume2, Save, Radio } from 'lucide-react';

interface AdminAudioTabProps {
  isRoomAdmin: boolean;
  audioProfile: AudioRelayProfile | null;
  inputGain: number;
  outputGain: number;
  targetDelayMs: number;
  adminCode: string;
  onInputGainChange: (val: number) => void;
  onOutputGainChange: (val: number) => void;
  onTargetDelayChange: (val: number) => void;
  onAdminCodeChange: (val: string) => void;
  onApplyProfile: () => void;
  onApplyLocal: () => void;
  onApplyPreset: (preset: AudioPreset) => void;
}

export function AdminAudioTab({
  isRoomAdmin,
  audioProfile,
  inputGain,
  outputGain,
  targetDelayMs,
  adminCode,
  onInputGainChange,
  onOutputGainChange,
  onTargetDelayChange,
  onAdminCodeChange,
  onApplyProfile,
  onApplyLocal,
  onApplyPreset
}: AdminAudioTabProps) {
  return (
    <div className="flex flex-col gap-5">
      {/* Role Banner */}
      {isRoomAdmin ? (
        <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200">
          <Crown className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <strong className="text-amber-300">Bạn là Chủ Phòng</strong>: Mọi thay đổi cấu hình âm thanh có thể đồng bộ tức thì đến toàn bộ thiết bị trong phòng!
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-sky-500/10 border border-sky-500/30 text-xs text-sky-200">
          <Info className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
          <div>
            <strong className="text-sky-300">Chế độ Thành Viên</strong>: Bạn có thể tự chỉnh âm lượng riêng cho máy này. Nhập mã phòng để đồng bộ toàn mạng.
          </div>
        </div>
      )}

      {/* Quick Presets */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between">
          <h3 className="text-xs font-black uppercase tracking-wider text-orange-400">
            Cấu hình nhanh theo cự ly (Presets)
          </h3>
          <span className="text-[0.68rem] text-slate-400">Chỉnh 1 chạm cho mọi tình huống</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {/* Preset 1 */}
          <button
            type="button"
            onClick={() => onApplyPreset('low_latency')}
            className={`p-3.5 rounded-2xl border text-left flex items-start gap-3 transition cursor-pointer ${
              targetDelayMs === 0
                ? 'bg-orange-500/15 border-orange-500 shadow-lg shadow-orange-500/20'
                : 'bg-slate-900/60 border-white/10 hover:border-orange-500/40 hover:bg-slate-850'
            }`}
          >
            <div className="w-8 h-8 rounded-xl bg-orange-500/20 flex items-center justify-center text-orange-400 shrink-0">
              <Zap className="w-4 h-4" />
            </div>
            <div className="flex flex-col gap-0.5">
              <strong className="text-xs text-white">Siêu Tốc (&lt;10m)</strong>
              <span className="text-[0.68rem] font-bold text-orange-400">Delay: 0ms • 1.0×</span>
              <p className="text-[0.65rem] text-slate-400 mt-1 leading-tight">Đàm thoại trực diện không trễ</p>
            </div>
          </button>

          {/* Preset 2 */}
          <button
            type="button"
            onClick={() => onApplyPreset('long_range')}
            className={`p-3.5 rounded-2xl border text-left flex items-start gap-3 transition cursor-pointer ${
              targetDelayMs >= 60 && targetDelayMs <= 100
                ? 'bg-orange-500/15 border-orange-500 shadow-lg shadow-orange-500/20'
                : 'bg-slate-900/60 border-white/10 hover:border-orange-500/40 hover:bg-slate-850'
            }`}
          >
            <div className="w-8 h-8 rounded-xl bg-orange-500/20 flex items-center justify-center text-orange-400 shrink-0">
              <Shield className="w-4 h-4" />
            </div>
            <div className="flex flex-col gap-0.5">
              <strong className="text-xs text-white">Tầm Xa (20-50m)</strong>
              <span className="text-[0.68rem] font-bold text-orange-400">Delay: 80ms • 1.3×</span>
              <p className="text-[0.65rem] text-slate-400 mt-1 leading-tight">Bù gói rớt khi đi xa/xuyên tường</p>
            </div>
          </button>

          {/* Preset 3 */}
          <button
            type="button"
            onClick={() => onApplyPreset('boost')}
            className={`p-3.5 rounded-2xl border text-left flex items-start gap-3 transition cursor-pointer ${
              inputGain >= 1.4 && outputGain >= 1.4
                ? 'bg-orange-500/15 border-orange-500 shadow-lg shadow-orange-500/20'
                : 'bg-slate-900/60 border-white/10 hover:border-orange-500/40 hover:bg-slate-850'
            }`}
          >
            <div className="w-8 h-8 rounded-xl bg-orange-500/20 flex items-center justify-center text-orange-400 shrink-0">
              <Volume2 className="w-4 h-4" />
            </div>
            <div className="flex flex-col gap-0.5">
              <strong className="text-xs text-white">Môi Trường Ồn</strong>
              <span className="text-[0.68rem] font-bold text-orange-400">Delay: 40ms • 1.5×</span>
              <p className="text-[0.65rem] text-slate-400 mt-1 leading-tight">Tối đa âm lượng mic và loa</p>
            </div>
          </button>
        </div>
      </div>

      {/* Sliders */}
      <div className="flex flex-col gap-3">
        <h3 className="text-xs font-black uppercase tracking-wider text-orange-400">
          Tinh chỉnh tham số chuyên sâu
        </h3>

        <div className="flex flex-col gap-3">
          {/* Input Gain Slider */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-white/5 flex flex-col gap-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-300">Độ lợi Microphone (Input Gain)</span>
              <strong className="font-mono text-orange-400 font-bold">{inputGain.toFixed(2)}×</strong>
            </div>
            <input
              type="range"
              min="0"
              max={audioProfile?.inputGainMax ?? 2.0}
              step="0.05"
              value={inputGain}
              onChange={(e) => onInputGainChange(Number(e.target.value))}
              className="accent-orange-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
            <div className="flex justify-between text-[0.65rem] text-slate-500">
              <span>0.5× (Giảm rè)</span>
              <span>1.0× (Chuẩn)</span>
              <span>2.0× (Nhạy tối đa)</span>
            </div>
          </div>

          {/* Output Gain Slider */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-white/5 flex flex-col gap-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-300">Độ lợi Loa ngoài (Output Gain)</span>
              <strong className="font-mono text-orange-400 font-bold">{outputGain.toFixed(2)}×</strong>
            </div>
            <input
              type="range"
              min="0"
              max={audioProfile?.outputGainMax ?? 2.0}
              step="0.05"
              value={outputGain}
              onChange={(e) => onOutputGainChange(Number(e.target.value))}
              className="accent-orange-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
            <div className="flex justify-between text-[0.65rem] text-slate-500">
              <span>0.0× (Tắt tiếng)</span>
              <span>1.0× (Chuẩn)</span>
              <span>2.0× (Kích âm)</span>
            </div>
          </div>

          {/* Playout Delay Slider */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-white/5 flex flex-col gap-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-300">Độ trễ đệm phát (Playout Delay / Jitter Buffer)</span>
              <strong className="font-mono text-sky-400 font-bold px-2 py-0.5 rounded bg-sky-500/10 border border-sky-500/30">
                {targetDelayMs} ms
              </strong>
            </div>
            <input
              type="range"
              min="0"
              max={audioProfile?.targetPlayoutDelayMaxMs ?? 200}
              step="10"
              value={targetDelayMs}
              onChange={(e) => onTargetDelayChange(Number(e.target.value))}
              className="accent-sky-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
            <div className="flex justify-between text-[0.65rem] text-slate-500">
              <span>0ms (Tức thì &lt;10m)</span>
              <span>80ms (Tầm xa 20-50m)</span>
              <span>150ms (Chống mất gói)</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between gap-3 pt-2 flex-wrap">
          <button
            type="button"
            onClick={onApplyLocal}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 border border-white/10 text-xs font-bold text-slate-200 transition cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            Lưu riêng máy này
          </button>

          <div className="flex items-center gap-2">
            {!isRoomAdmin && (
              <input
                type="password"
                placeholder="Mã phòng hoặc admin..."
                value={adminCode}
                onChange={(e) => onAdminCodeChange(e.target.value)}
                className="w-36 px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-xs focus:outline-none focus:border-orange-500"
              />
            )}
            <button
              type="button"
              onClick={onApplyProfile}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 transition cursor-pointer shadow-md shadow-orange-500/25"
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Đồng bộ toàn phòng</span>
              {isRoomAdmin && <Crown className="w-3.5 h-3.5 text-amber-300" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
