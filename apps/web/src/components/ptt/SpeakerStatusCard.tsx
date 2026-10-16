import React from 'react';
import type { AudioMetrics } from '../../services/mediaClient';
import { AudioEqualizer } from './AudioEqualizer';
import { getDepartmentConfig } from '../../utils/departments';
import { Radio, Mic, Activity } from 'lucide-react';

interface SpeakerStatusCardProps {
  speaker: { clientId: string; displayName: string; department?: string } | null;
  isMeSpeaker: boolean;
  roomId: string;
  remoteAudioActive: boolean;
  metrics: AudioMetrics;
}

export function SpeakerStatusCard({
  speaker,
  isMeSpeaker,
  roomId,
  remoteAudioActive,
  metrics
}: SpeakerStatusCardProps) {
  const isSpeaking = Boolean(speaker);
  const deptConfig = speaker?.department ? getDepartmentConfig(speaker.department) : null;
  const DeptIcon = deptConfig?.icon;

  return (
    <div
      className={`relative flex items-center gap-3 sm:gap-4 p-3 sm:p-5 rounded-2xl border backdrop-blur-xl transition-all duration-300 shadow-lg ${
        isSpeaking
          ? isMeSpeaker
            ? 'bg-rose-950/40 border-rose-500/50 shadow-rose-500/20'
            : 'bg-orange-950/40 border-orange-500/50 shadow-orange-500/20'
          : 'bg-slate-900/60 border-white/10 shadow-black/40'
      }`}
    >
      {/* Wave / Idle indicator box */}
      <div
        className={`relative flex items-center justify-center w-11 h-11 sm:w-13 sm:h-13 rounded-2xl bg-slate-950/95 border overflow-hidden shrink-0 transition-all ${
          isSpeaking
            ? isMeSpeaker
              ? 'border-rose-500 shadow-[0_0_18px_rgba(244,63,94,0.4)]'
              : 'border-orange-500 shadow-[0_0_18px_rgba(249,115,22,0.4)]'
            : 'border-white/10'
        }`}
      >
        {isSpeaking ? (
          <div className="relative flex items-center justify-center w-full h-full p-1.5">
            {/* Pulsing ambient halo behind icon */}
            <span
              className={`absolute inset-1.5 rounded-xl opacity-35 animate-ping ${
                isMeSpeaker ? 'bg-rose-500' : 'bg-orange-500'
              }`}
            />

            {/* Center Dynamic Icon */}
            <div
              className={`relative z-10 p-2 rounded-xl border flex items-center justify-center ${
                isMeSpeaker
                  ? 'bg-rose-500/20 border-rose-500/60 text-rose-300 shadow-[0_0_14px_rgba(244,63,94,0.6)]'
                  : 'bg-orange-500/20 border-orange-500/60 text-orange-300 shadow-[0_0_14px_rgba(249,115,22,0.6)]'
              }`}
            >
              {isMeSpeaker ? (
                <Mic className="w-5 h-5 sm:w-6 sm:h-6 text-rose-300 animate-pulse" />
              ) : (
                <Radio className="w-5 h-5 sm:w-6 sm:h-6 text-orange-300 animate-pulse" />
              )}
            </div>
          </div>
        ) : (
          <div className="relative flex items-center justify-center">
            <Radio className="w-5 h-5 text-emerald-400" />
            <span className="animate-ping absolute inline-flex h-4 w-4 rounded-full bg-emerald-400 opacity-25" />
          </div>
        )}
      </div>

      {/* Center info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 sm:gap-2 mb-1 flex-wrap">
          <span className="px-1.5 py-0.5 sm:px-2 rounded-md bg-white/5 border border-white/10 text-[0.6rem] sm:text-[0.65rem] font-mono font-bold text-slate-400">
            PHÒNG: #{roomId}
          </span>

          {deptConfig && DeptIcon && (
            <span className={`flex items-center gap-1 px-1.5 py-0.5 sm:px-2 rounded-md text-[0.6rem] sm:text-[0.65rem] font-bold border ${deptConfig.badgeClass}`}>
              <DeptIcon className="w-2.5 h-2.5" />
              {deptConfig.shortName}
            </span>
          )}

          {isSpeaking && (
            <span
              className={`flex items-center gap-1 sm:gap-1.5 px-1.5 py-0.5 sm:px-2 rounded-md text-[0.6rem] sm:text-[0.65rem] font-bold tracking-wider ${
                isMeSpeaker
                  ? 'bg-rose-500/20 border border-rose-500/40 text-rose-300 animate-pulse'
                  : 'bg-orange-500/20 border border-orange-500/40 text-orange-300 animate-pulse'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isMeSpeaker ? 'bg-rose-400' : 'bg-orange-400'}`} />
              {isMeSpeaker ? 'TRANSMITTING' : 'RECEIVING'}
            </span>
          )}
        </div>

        <h2 className="text-sm sm:text-base md:text-lg font-black text-white truncate">
          {isSpeaking
            ? isMeSpeaker
              ? 'Bạn đang nói…'
              : `${speaker?.displayName} đang nói…`
            : 'Kênh Sẵn Sàng'}
        </h2>

        <p className="text-[0.68rem] sm:text-xs text-slate-400 truncate">
          {isSpeaking
            ? isMeSpeaker
              ? 'Giọng nói của bạn đang truyền trực tiếp qua WebRTC Opus'
              : `Đang nhận luồng giọng nói từ ${deptConfig?.name || 'thành viên'}`
            : 'Đường truyền ổn định • Nhấn giữ nút PTT bên dưới để phát biểu'}
        </p>
      </div>

      {/* Right side VU Meter or Codec tag */}
      {isMeSpeaker ? (
        <div className="flex flex-col items-center gap-1 shrink-0" title="Cường độ âm thanh thu từ Micro">
          <div className="w-2.5 h-10 rounded-full bg-slate-950 border border-white/10 p-0.5 flex flex-col justify-end overflow-hidden">
            <div
              className="w-full rounded-full bg-gradient-to-t from-emerald-500 via-amber-500 to-rose-500 transition-all duration-75"
              style={{ height: `${Math.min(100, Math.max(10, Math.round(metrics.inputLevel * 100)))}%` }}
            />
          </div>
          <Mic className="w-3 h-3 text-slate-400" />
        </div>
      ) : isSpeaking ? (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950/80 border border-white/10 shrink-0 text-xs font-mono text-slate-300">
          <Activity className={`w-3.5 h-3.5 ${remoteAudioActive ? 'text-emerald-400' : 'text-amber-400 animate-pulse'}`} />
          <span>{remoteAudioActive ? '48kHz' : 'Nạp…'}</span>
        </div>
      ) : null}
    </div>
  );
}
