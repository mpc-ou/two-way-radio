import React from 'react';
import { Wifi, Server, Sparkles, Globe, ShieldCheck } from 'lucide-react';

export type VoiceLinkMode = 'p2p' | 'lan_server';

interface GatewayModeSelectorProps {
  currentMode: VoiceLinkMode;
  onSelectMode: (mode: VoiceLinkMode) => void;
  lanServerUrl?: string;
}

export function GatewayModeSelector({
  currentMode,
  onSelectMode,
  lanServerUrl = 'https://172.22.177.111:5173'
}: GatewayModeSelectorProps) {
  return (
    <div className="w-full flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[0.68rem] sm:text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <Globe className="w-3.5 h-3.5 text-orange-400" />
          <span>CỔNG TRUY CẬP (GATEWAY) • CHỌN HẠ TẦNG</span>
        </span>
        <span className="text-[0.62rem] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
          AUTO-ROUTE
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {/* Mode 1: P2P Serverless (Vercel) */}
        <button
          type="button"
          onClick={() => onSelectMode('p2p')}
          className={`flex items-start gap-3 p-3 sm:p-3.5 rounded-2xl border transition-all text-left cursor-pointer ${
            currentMode === 'p2p'
              ? 'bg-gradient-to-br from-orange-500/20 via-orange-600/10 to-transparent border-orange-500 shadow-lg shadow-orange-500/15'
              : 'bg-slate-900/60 hover:bg-slate-800/80 border-white/10'
          }`}
        >
          <div
            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 border ${
              currentMode === 'p2p'
                ? 'bg-orange-500 text-white border-orange-300 shadow-md shadow-orange-500/40'
                : 'bg-slate-800 text-slate-400 border-white/10'
            }`}
          >
            <Sparkles className="w-5 h-5" />
          </div>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs sm:text-sm font-black text-white">P2P Serverless (Trực tiếp)</span>
              <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[0.55rem] font-bold">
                Vercel Ready
              </span>
            </div>
            <p className="text-[0.65rem] sm:text-[0.7rem] text-slate-400 mt-0.5 leading-snug">
              Client-to-Client không cần máy chủ. Nhập mã phòng là nói ngay qua WebRTC.
            </p>
          </div>
        </button>

        {/* Mode 2: LAN Server (Mediasoup SFU) */}
        <button
          type="button"
          onClick={() => {
            onSelectMode('lan_server');
          }}
          className={`flex items-start gap-3 p-3 sm:p-3.5 rounded-2xl border transition-all text-left cursor-pointer ${
            currentMode === 'lan_server'
              ? 'bg-gradient-to-br from-sky-500/20 via-sky-600/10 to-transparent border-sky-500 shadow-lg shadow-sky-500/15'
              : 'bg-slate-900/60 hover:bg-slate-800/80 border-white/10'
          }`}
        >
          <div
            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 border ${
              currentMode === 'lan_server'
                ? 'bg-sky-500 text-white border-sky-300 shadow-md shadow-sky-500/40'
                : 'bg-slate-800 text-slate-400 border-white/10'
            }`}
          >
            <Server className="w-5 h-5" />
          </div>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs sm:text-sm font-black text-white">Server Nội Bộ (LAN SFU)</span>
              <span className="px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 text-[0.55rem] font-bold">
                Mediasoup
              </span>
            </div>
            <p className="text-[0.65rem] sm:text-[0.7rem] text-slate-400 mt-0.5 leading-snug">
              Dành cho mạng LAN nội bộ ban tổ chức chạy máy chủ NestJS SFU chuyên dụng.
            </p>
          </div>
        </button>
      </div>
    </div>
  );
}

