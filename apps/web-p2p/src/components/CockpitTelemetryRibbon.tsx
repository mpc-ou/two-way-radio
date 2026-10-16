import React from 'react';
import { Sun, Moon, SlidersHorizontal } from 'lucide-react';

export interface CockpitTelemetryRibbonProps {
  wakeLockActive: boolean;
  playoutDelayMs: number;
  hangTimeMs: number;
  memberCount: number;
  onOpenAudioSettings: () => void;
}

export function CockpitTelemetryRibbon({
  wakeLockActive,
  playoutDelayMs,
  hangTimeMs,
  memberCount,
  onOpenAudioSettings
}: CockpitTelemetryRibbonProps) {
  return (
    <div className="flex items-center justify-between px-3 py-1.5 sm:px-4 sm:py-2 rounded-2xl bg-slate-900/90 border border-white/10 text-xs shadow-md flex-wrap gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        {wakeLockActive ? (
          <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 font-bold text-[0.62rem] sm:text-xs">
            <Sun className="w-3.5 h-3.5 text-amber-400 animate-spin-slow" />
            <span>MÀN HÌNH LUÔN SÁNG</span>
          </span>
        ) : (
          <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-800 border border-white/10 text-slate-400 font-medium text-[0.62rem] sm:text-xs">
            <Moon className="w-3.5 h-3.5" />
            <span>MÀN HÌNH TỰ DO</span>
          </span>
        )}

        {/* Audio Delay Quick Control Pill */}
        <button
          type="button"
          onClick={onOpenAudioSettings}
          className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 text-orange-300 font-bold text-[0.62rem] sm:text-xs transition cursor-pointer"
          title="Bấm để chỉnh độ trễ âm thanh"
        >
          <SlidersHorizontal className="w-3 h-3 text-orange-400" />
          <span>ĐỘ TRỄ: <strong className="font-mono text-white">{playoutDelayMs}ms</strong></span>
          <span className="hidden min-[600px]:inline text-slate-400 font-normal">• Đệm: {hangTimeMs}ms</span>
        </button>
      </div>

      {/* Members Mesh Online Scale Pill */}
      <div className="flex items-center gap-1.5 font-mono text-[0.68rem] sm:text-xs">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="font-bold text-white">{memberCount}</span>
        <span className="text-slate-400">thiết bị trong mesh</span>
      </div>
    </div>
  );
}
