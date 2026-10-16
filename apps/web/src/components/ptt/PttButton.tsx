import React from 'react';
import type { PttPhase } from '../../types';
import { Mic } from 'lucide-react';

interface PttButtonProps {
  phase: PttPhase;
  remoteAudioActive: boolean;
  pttDisabled: boolean;
  pttCaption: string;
  onRequestFloor: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onReleaseFloor: (e: React.PointerEvent<HTMLButtonElement>) => void;
}

export function PttButton({
  phase,
  remoteAudioActive,
  pttDisabled,
  pttCaption,
  onRequestFloor,
  onReleaseFloor
}: PttButtonProps) {
  const isTalking = phase === 'TALKING';
  const isReceiving = remoteAudioActive;
  const isRequesting = phase === 'REQUESTING';

  return (
    <div className="flex flex-col items-center justify-center py-2 sm:py-4 select-none">
      {/* Concentric Anchor Container: Exact same geometrical center for button and rings */}
      <div className="relative flex items-center justify-center w-52 h-52 min-[380px]:w-64 min-[380px]:h-64 sm:w-72 sm:h-72">
        {/* Triple Sonar Shockwave Rings */}
        {(isTalking || isReceiving) && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              className={`absolute w-44 h-44 min-[380px]:w-56 min-[380px]:h-56 sm:w-64 sm:h-64 rounded-full border-2 ${
                isTalking ? 'border-rose-500/70 bg-rose-500/10' : 'border-orange-500/70 bg-orange-500/10'
              } animate-sonar-1`}
            />
            <div
              className={`absolute w-44 h-44 min-[380px]:w-56 min-[380px]:h-56 sm:w-64 sm:h-64 rounded-full border-2 ${
                isTalking ? 'border-rose-500/60' : 'border-orange-500/60'
              } animate-sonar-2`}
            />
            <div
              className={`absolute w-44 h-44 min-[380px]:w-56 min-[380px]:h-56 sm:w-64 sm:h-64 rounded-full border-2 ${
                isTalking ? 'border-rose-500/40' : 'border-orange-500/40'
              } animate-sonar-3`}
            />
          </div>
        )}

        {/* Rotating Radar Tick Ring - perfectly concentric with button */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[204px] h-[204px] min-[380px]:w-[248px] min-[380px]:h-[248px] sm:w-[280px] sm:h-[280px] animate-rotate-radar opacity-50">
            <svg viewBox="0 0 300 300" className="w-full h-full">
              <circle cx="150" cy="150" r="140" fill="none" stroke="#f97316" strokeWidth="1.5" strokeDasharray="4 12" />
              <circle cx="150" cy="150" r="132" fill="none" stroke="#ffffff" strokeWidth="1" strokeDasharray="1 8" />
            </svg>
          </div>
        </div>

        {/* Main 3D Tactile Push-To-Talk Button */}
        <button
          type="button"
          disabled={pttDisabled}
          onPointerDown={onRequestFloor}
          onPointerUp={onReleaseFloor}
          onPointerCancel={onReleaseFloor}
          onTouchStart={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
          aria-pressed={isTalking}
          className={`relative z-10 w-36 h-36 min-[380px]:w-48 min-[380px]:h-48 sm:w-56 sm:h-56 rounded-full border-4 flex flex-col items-center justify-center transition-all duration-150 cursor-pointer shadow-2xl select-none touch-none ${
            isTalking
              ? 'bg-gradient-to-b from-rose-500 via-rose-600 to-red-700 border-rose-300 text-white scale-95 shadow-[0_0_50px_rgba(244,63,94,0.6)]'
              : isRequesting
              ? 'bg-gradient-to-b from-amber-500 to-amber-700 border-amber-300 text-white scale-95 animate-pulse'
              : isReceiving
              ? 'bg-gradient-to-b from-orange-600 to-slate-900 border-orange-400 text-white shadow-[0_0_35px_rgba(249,115,22,0.4)]'
              : 'bg-gradient-to-b from-slate-800 via-slate-900 to-slate-950 border-orange-500/40 hover:border-orange-400 text-slate-100 hover:shadow-[0_0_35px_rgba(249,115,22,0.3)] active:scale-95'
          } disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          {/* Inner Disc Bevel */}
          <div className="flex flex-col items-center justify-center gap-1 sm:gap-1.5 pointer-events-none">
            <div className="relative">
              <Mic
                className={`w-8 h-8 min-[380px]:w-10 min-[380px]:h-10 sm:w-11 sm:h-11 ${
                  isTalking ? 'text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.8)]' : 'text-orange-400'
                }`}
                strokeWidth={2.2}
              />
              {isTalking && (
                <span className="absolute inset-0 rounded-full bg-white/20 blur-md animate-ping" />
              )}
            </div>

            <span className="text-xs min-[380px]:text-sm sm:text-base font-black tracking-wider uppercase text-center px-2">
              {pttCaption}
            </span>
            <span className="text-[0.55rem] min-[380px]:text-[0.62rem] font-bold tracking-widest text-slate-400 uppercase">
              {isTalking ? 'TRANSMITTING' : isReceiving ? 'RECEIVING' : 'PUSH TO TALK'}
            </span>
          </div>
        </button>
      </div>

      {/* Helpful instruction toast sits cleanly underneath WITHOUT displacing the center */}
      <div className="mt-3 flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/80 border border-white/10 text-xs text-slate-400 shadow-sm">
        <span
          className={`w-2 h-2 rounded-full ${
            isTalking ? 'bg-rose-500 animate-ping' : isReceiving ? 'bg-orange-400' : 'bg-emerald-500'
          }`}
        />
        <span>
          {isTalking
            ? 'Đang mở mic • Nhả tay để kết thúc'
            : isReceiving
            ? 'Kênh đang phát âm thanh'
            : 'Nhấn và giữ chặt nút để nói'}
        </span>
      </div>
    </div>
  );
}
