import React, { useState } from 'react';
import { Users, Crown, Mic, ChevronUp, ChevronDown } from 'lucide-react';
import { getDepartmentConfig } from '../../utils/departments';

interface VoiceChannelBarProps {
  members: Array<{ clientId: string; displayName: string; department?: string; isAdmin?: boolean }>;
  currentClientId: string;
  speakerClientId?: string;
  creatorClientId?: string;
}

export function VoiceChannelBar({
  members,
  currentClientId,
  speakerClientId,
  creatorClientId
}: VoiceChannelBarProps) {
  const [expanded, setExpanded] = useState(false);

  const activeSpeaker = members.find((m) => m.clientId === speakerClientId);
  const activeSpeakerDept = activeSpeaker?.department ? getDepartmentConfig(activeSpeaker.department) : null;

  return (
    <div className="w-full rounded-2xl bg-slate-900/80 border border-white/10 backdrop-blur-xl shadow-lg transition-all overflow-hidden">
      {/* Compact Channel Summary Header */}
      <div className="flex items-center justify-between p-2.5 sm:p-3.5 gap-2">
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
          {/* Stacked Avatars (first 5 members) */}
          <div className="flex -space-x-2 shrink-0">
            {members.slice(0, 5).map((m) => {
              const isSpeaker = m.clientId === speakerClientId;
              const isHost = m.isAdmin || m.clientId === creatorClientId;
              const isMe = m.clientId === currentClientId;
              const deptConfig = getDepartmentConfig(m.department);

              return (
                <div
                  key={m.clientId}
                  title={`${m.displayName}${isMe ? ' (Bạn)' : ''} • [${deptConfig.name}]${isHost ? ' • Chủ phòng' : ''}${isSpeaker ? ' • Đang nói' : ''}`}
                  className={`relative w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-[0.6rem] sm:text-[0.65rem] font-bold border-2 transition-transform ${
                    isSpeaker
                      ? 'bg-rose-500 border-rose-300 text-white z-20 scale-110 shadow-[0_0_10px_rgba(244,63,94,0.6)] animate-pulse'
                      : isMe
                      ? 'bg-orange-600 border-orange-400 text-white z-10'
                      : `bg-slate-800 ${deptConfig.borderClass} text-slate-200`
                  }`}
                >
                  {m.displayName.slice(0, 2).toUpperCase()}
                  {isHost && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full bg-amber-500 flex items-center justify-center text-slate-950">
                      <Crown className="w-2 h-2 text-slate-950" />
                    </span>
                  )}
                </div>
              );
            })}
            {members.length > 5 && (
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center text-[0.6rem] sm:text-[0.65rem] font-bold text-slate-400">
                +{members.length - 5}
              </div>
            )}
          </div>

          <div className="flex flex-col min-w-0">
            <span className="text-[0.7rem] sm:text-xs font-bold text-white flex items-center gap-1 sm:gap-1.5 flex-wrap truncate">
              <span>{members.length} Trực tuyến</span>
              {speakerClientId && (
                <span className="flex items-center gap-1 text-[0.62rem] sm:text-[0.68rem] text-orange-400 font-normal truncate">
                  • <Mic className="w-2.5 h-2.5 animate-pulse shrink-0" /> {activeSpeaker?.displayName || 'Ai đó'}
                  {activeSpeakerDept && (
                    <span className={`px-1 py-0.2 rounded text-[0.55rem] sm:text-[0.6rem] font-bold border ${activeSpeakerDept.badgeClass}`}>
                      {activeSpeakerDept.shortName}
                    </span>
                  )}
                </span>
              )}
            </span>
            <span className="text-[0.58rem] sm:text-[0.62rem] text-slate-400 truncate">Kênh thoại nội bộ MPClub</span>
          </div>
        </div>

        {/* Toggle List Button */}
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-750 border border-white/5 text-[0.68rem] sm:text-[0.72rem] font-bold text-slate-300 hover:text-white transition cursor-pointer shrink-0"
        >
          <Users className="w-3.5 h-3.5 text-orange-400" />
          <span className="hidden min-[360px]:inline">{expanded ? 'Thu gọn' : 'Xem danh sách'}</span>
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Expanded Members Tray */}
      {expanded && (
        <div className="border-t border-white/5 p-3 max-h-52 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-950/40">
          {members.map((m) => {
            const isMe = m.clientId === currentClientId;
            const isSpeaker = m.clientId === speakerClientId;
            const isHost = m.isAdmin || m.clientId === creatorClientId;
            const deptConfig = getDepartmentConfig(m.department);
            const DeptIcon = deptConfig.icon;

            return (
              <div
                key={m.clientId}
                className={`flex items-center justify-between p-2 rounded-xl border text-xs ${
                  isSpeaker
                    ? 'bg-orange-500/15 border-orange-500/50'
                    : 'bg-slate-900/60 border-white/5'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-lg bg-slate-800 flex items-center justify-center text-[0.65rem] font-bold text-orange-400 shrink-0">
                    {m.displayName.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-white truncate max-w-[110px]">
                      {m.displayName} {isMe && '(Bạn)'}
                    </span>
                    <span className={`inline-flex items-center gap-0.5 text-[0.6rem] font-semibold ${deptConfig.badgeClass.split(' ')[2]}`}>
                      <DeptIcon className="w-2.5 h-2.5" />
                      {deptConfig.name}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {isHost && (
                    <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-500/20 text-[0.6rem] text-amber-300 font-bold border border-amber-500/30">
                      <Crown className="w-2.5 h-2.5" /> Host
                    </span>
                  )}
                  {isSpeaker ? (
                    <span className="text-[0.62rem] text-orange-400 font-bold flex items-center gap-0.5">
                      <Mic className="w-2.5 h-2.5" /> Đang nói
                    </span>
                  ) : (
                    <span className="text-[0.62rem] text-slate-500">Đang nghe</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
