import React from 'react';
import type { AudioMetrics } from '../../services/mediaClient';
import { formatMs } from '../../utils/format';
import {
  Wifi,
  SignalHigh,
  SignalMedium,
  SignalLow,
  Clock,
  Activity,
  Zap,
  AlertTriangle,
  Lightbulb,
  Radio,
  Laptop,
  ArrowUpFromLine,
  Sliders
} from 'lucide-react';

interface AdminNetworkTabProps {
  floorGrantRoundTripMs?: number;
  metrics: AudioMetrics;
  transportState: string;
}

export function AdminNetworkTab({
  floorGrantRoundTripMs,
  metrics,
  transportState
}: AdminNetworkTabProps) {
  const rtt = metrics.roundTripMs ?? floorGrantRoundTripMs ?? 0;
  const jitter = metrics.inboundJitterMs ?? 0;
  const loss = metrics.inboundPacketsLost ?? 0;

  let signalTier: 'excellent' | 'good' | 'poor' = 'excellent';
  let signalText = 'Sóng Cực Mạnh (< 20m) • Tối ưu';
  let signalAdvice = 'Độ trễ thấp hoàn hảo. Có thể dùng Delay = 0ms.';
  let SignalIcon = SignalHigh;

  if (rtt > 120 || jitter > 50 || loss > 5) {
    signalTier = 'poor';
    signalText = 'Sóng Yếu / Rìa Phủ (> 40m)';
    signalAdvice = 'Nên chọn Preset "Tầm Xa" (Delay 80ms) để bù rớt gói Wi-Fi!';
    SignalIcon = SignalLow;
  } else if (rtt > 50 || jitter > 25 || loss > 0) {
    signalTier = 'good';
    signalText = 'Sóng Ổn Định (20m - 40m)';
    signalAdvice = 'Khuyến nghị đặt Delay 50ms - 80ms để loại bỏ tiếng giật lẹt xẹt.';
    SignalIcon = SignalMedium;
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Signal Health Status Card */}
      <div
        className={`p-4 rounded-2xl border flex flex-col gap-2 ${
          signalTier === 'excellent'
            ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-200'
            : signalTier === 'good'
            ? 'bg-amber-500/10 border-amber-500/40 text-amber-200'
            : 'bg-rose-500/10 border-rose-500/40 text-rose-200'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SignalIcon className="w-5 h-5 shrink-0" />
            <h4 className="text-sm font-black text-white">{signalText}</h4>
          </div>
          <span className="text-[0.65rem] font-mono px-2 py-0.5 rounded bg-black/40 text-slate-300 border border-white/5">
            {transportState}
          </span>
        </div>
        <p className="text-xs leading-relaxed opacity-90 flex items-center gap-1.5">
          {signalTier === 'poor' && <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />}
          {signalAdvice}
        </p>
      </div>

      {/* WebRTC Diagnostics Grid */}
      <div className="flex flex-col gap-2.5">
        <h3 className="text-xs font-black uppercase tracking-wider text-orange-400 flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5" />
          Thông số truyền dẫn WebRTC (Thời gian thực)
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="p-3 rounded-xl bg-slate-950/80 border border-white/5 flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 text-[0.68rem] text-slate-400">
              <Clock className="w-3.5 h-3.5 text-sky-400" />
              <span>RTT Cấp Floor</span>
            </div>
            <strong className="text-sm font-mono text-white font-bold">{formatMs(floorGrantRoundTripMs)}</strong>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/80 border border-white/5 flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 text-[0.68rem] text-slate-400">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span>RTT WebRTC UDP</span>
            </div>
            <strong className="text-sm font-mono text-white font-bold">{formatMs(metrics.roundTripMs)}</strong>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/80 border border-white/5 flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 text-[0.68rem] text-slate-400">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Độ rung (Jitter)</span>
            </div>
            <strong className="text-sm font-mono text-white font-bold">{formatMs(metrics.inboundJitterMs)}</strong>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/80 border border-white/5 flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 text-[0.68rem] text-slate-400">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              <span>Gói tin mất</span>
            </div>
            <strong className="text-sm font-mono text-white font-bold">{metrics.inboundPacketsLost ?? 0}</strong>
          </div>
        </div>
      </div>

      {/* Distance Guide */}
      <div className="p-4 rounded-2xl bg-slate-950/80 border border-white/5 text-xs text-slate-400 leading-relaxed flex flex-col gap-3">
        <h4 className="font-bold text-white flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-amber-400" />
          Mẹo tối ưu sóng 20m - 50m tại chỗ:
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[0.78rem]">
          <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-start gap-2">
            <Laptop className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-slate-200">Laptop làm Hotspot:</strong> Anten máy tính phát sóng xa gấp đôi điện thoại.
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-start gap-2">
            <Wifi className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-slate-200">Băng tần 2.4 GHz:</strong> Bắt buộc chọn 2.4 GHz trong Windows Mobile Hotspot.
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-start gap-2">
            <ArrowUpFromLine className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-slate-200">Độ cao đặt máy:</strong> Đặt laptop trên bàn cao 1.2m – 1.8m, tránh để sát nền nhà.
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-start gap-2">
            <Sliders className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-slate-200">Độ trễ đệm:</strong> Khi đi xa &gt; 25m, đặt Playout Delay = 80ms để chống giật âm thanh.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
