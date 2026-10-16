import React from 'react';
import {
  SlidersHorizontal,
  X,
  Zap,
  Shield,
  Clock,
  Mic,
  Volume2,
  Check
} from 'lucide-react';

export interface AudioSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  playoutDelayMs: number;
  onPlayoutDelayChange: (val: number) => void;
  hangTimeMs: number;
  onHangTimeChange: (val: number) => void;
  inputGain?: number;
  onInputGainChange?: (val: number) => void;
  outputGain?: number;
  onOutputGainChange?: (val: number) => void;
}

export function AudioSettingsModal({
  isOpen,
  onClose,
  playoutDelayMs,
  onPlayoutDelayChange,
  hangTimeMs,
  onHangTimeChange,
  inputGain = 1.0,
  onInputGainChange,
  outputGain = 1.0,
  onOutputGainChange
}: AudioSettingsModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[92dvh] overflow-y-auto rounded-3xl bg-slate-900 border border-white/10 shadow-2xl p-4 sm:p-6 flex flex-col gap-4 sm:gap-5 backdrop-blur-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400 shrink-0">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-black text-white tracking-wide">
                Cài Đặt Độ Trễ & Âm Thanh
              </h2>
              <p className="text-[0.68rem] text-slate-400">
                Tinh chỉnh buffer trễ, giữ đuôi mic và âm lượng bộ đàm
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Presets */}
        <div className="flex flex-col gap-2">
          <span className="text-[0.68rem] font-bold uppercase tracking-wider text-orange-400">
            Cấu hình nhanh (Presets)
          </span>
          <div className="grid grid-cols-3 gap-2">
            {/* Preset 1: Ultra Low Latency */}
            <button
              type="button"
              onClick={() => {
                onPlayoutDelayChange(0);
                onHangTimeChange(100);
              }}
              className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 transition cursor-pointer ${
                playoutDelayMs === 0 && hangTimeMs <= 100
                  ? 'bg-orange-500/20 border-orange-500 shadow-md shadow-orange-500/20'
                  : 'bg-slate-950/60 border-white/5 hover:border-orange-500/30'
              }`}
            >
              <div className="flex items-center gap-1.5 text-orange-400">
                <Zap className="w-3.5 h-3.5" />
                <span className="text-xs font-bold text-white">Siêu Tốc</span>
              </div>
              <span className="text-[0.65rem] text-slate-400">Trễ 0ms</span>
            </button>

            {/* Preset 2: Long Range */}
            <button
              type="button"
              onClick={() => {
                onPlayoutDelayChange(80);
                onHangTimeChange(200);
              }}
              className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 transition cursor-pointer ${
                playoutDelayMs >= 60 && playoutDelayMs <= 100
                  ? 'bg-orange-500/20 border-orange-500 shadow-md shadow-orange-500/20'
                  : 'bg-slate-950/60 border-white/5 hover:border-orange-500/30'
              }`}
            >
              <div className="flex items-center gap-1.5 text-sky-400">
                <Shield className="w-3.5 h-3.5" />
                <span className="text-xs font-bold text-white">Tầm Xa</span>
              </div>
              <span className="text-[0.65rem] text-slate-400">Trễ 80ms</span>
            </button>

            {/* Preset 3: Smooth Release */}
            <button
              type="button"
              onClick={() => {
                onPlayoutDelayChange(40);
                onHangTimeChange(300);
              }}
              className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 transition cursor-pointer ${
                hangTimeMs >= 300
                  ? 'bg-orange-500/20 border-orange-500 shadow-md shadow-orange-500/20'
                  : 'bg-slate-950/60 border-white/5 hover:border-orange-500/30'
              }`}
            >
              <div className="flex items-center gap-1.5 text-emerald-400">
                <Clock className="w-3.5 h-3.5" />
                <span className="text-xs font-bold text-white">Trọn Câu</span>
              </div>
              <span className="text-[0.65rem] text-slate-400">Đệm 300ms</span>
            </button>
          </div>
        </div>

        {/* Detailed Controls */}
        <div className="flex flex-col gap-3.5">
          {/* 1. Playout Delay (Jitter Buffer) */}
          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-white/5 flex flex-col gap-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-300 font-medium flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-orange-400" />
                Độ trễ đệm phát (Playout Delay)
              </span>
              <strong className="font-mono text-orange-400 font-bold px-2 py-0.5 rounded bg-orange-500/10 border border-orange-500/30">
                {playoutDelayMs} ms
              </strong>
            </div>
            <input
              type="range"
              min="0"
              max="200"
              step="10"
              value={playoutDelayMs}
              onChange={(e) => onPlayoutDelayChange(Number(e.target.value))}
              className="accent-orange-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg w-full"
            />
            <div className="flex justify-between text-[0.62rem] text-slate-500">
              <span>0ms (Tức thì &lt;10m)</span>
              <span>60-80ms (Khuyên dùng)</span>
              <span>200ms (Bù rớt gói)</span>
            </div>
          </div>

          {/* 2. PTT Hang Time */}
          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-white/5 flex flex-col gap-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-300 font-medium flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-sky-400" />
                Thời gian giữ mic sau khi nhả (Hang Time)
              </span>
              <strong className="font-mono text-sky-400 font-bold px-2 py-0.5 rounded bg-sky-500/10 border border-sky-500/30">
                {hangTimeMs} ms
              </strong>
            </div>
            <input
              type="range"
              min="0"
              max="500"
              step="50"
              value={hangTimeMs}
              onChange={(e) => onHangTimeChange(Number(e.target.value))}
              className="accent-sky-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg w-full"
            />
            <div className="flex justify-between text-[0.62rem] text-slate-500">
              <span>0ms (Tắt ngay)</span>
              <span>150ms (Chuẩn bộ đàm)</span>
              <span>500ms (Chống mất đuôi)</span>
            </div>
            <p className="text-[0.62rem] text-slate-400 leading-tight">
              Giữ micro tiếp tục gửi âm thanh thêm vài mili-giây sau khi buông nút, giúp người nghe không bị đứt mất chữ cuối.
            </p>
          </div>

          {/* 3. Input Gain */}
          {onInputGainChange && (
            <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-white/5 flex flex-col gap-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-300 font-medium flex items-center gap-1.5">
                  <Mic className="w-3.5 h-3.5 text-amber-400" />
                  Độ lợi Microphone (Input Gain)
                </span>
                <strong className="font-mono text-amber-400 font-bold">
                  {inputGain.toFixed(2)}×
                </strong>
              </div>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.05"
                value={inputGain}
                onChange={(e) => onInputGainChange(Number(e.target.value))}
                className="accent-amber-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg w-full"
              />
              <div className="flex justify-between text-[0.62rem] text-slate-500">
                <span>0.5× (Giảm rè)</span>
                <span>1.0× (Chuẩn)</span>
                <span>2.0× (Kích âm nhạy)</span>
              </div>
            </div>
          )}

          {/* 4. Output Gain */}
          {onOutputGainChange && (
            <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-white/5 flex flex-col gap-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-300 font-medium flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                  Độ lợi Loa ngoài (Output Gain)
                </span>
                <strong className="font-mono text-emerald-400 font-bold">
                  {outputGain.toFixed(2)}×
                </strong>
              </div>
              <input
                type="range"
                min="0.0"
                max="2.0"
                step="0.05"
                value={outputGain}
                onChange={(e) => onOutputGainChange(Number(e.target.value))}
                className="accent-emerald-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg w-full"
              />
              <div className="flex justify-between text-[0.62rem] text-slate-500">
                <span>0.0× (Tắt)</span>
                <span>1.0× (Chuẩn)</span>
                <span>2.0× (Kích âm to)</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-xs font-black text-white uppercase tracking-wider transition shadow-lg shadow-orange-500/25 cursor-pointer mt-1"
        >
          <Check className="w-4 h-4" />
          <span>Áp Dụng & Đóng</span>
        </button>
      </div>
    </div>
  );
}
