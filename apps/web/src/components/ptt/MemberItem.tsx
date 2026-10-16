import React from 'react';
import { Crown, Mic, Headphones } from 'lucide-react';
import { getDepartmentConfig } from '../../utils/departments';

interface MemberItemProps {
  displayName: string;
  clientId: string;
  department?: string;
  isMe: boolean;
  isSpeaking: boolean;
  isHost: boolean;
}

export function MemberItem({
  displayName,
  department,
  isMe,
  isSpeaking,
  isHost
}: MemberItemProps) {
  const deptConfig = getDepartmentConfig(department);
  const DeptIcon = deptConfig.icon;

  return (
    <div
      className={`flex items-center gap-2.5 p-2 rounded-xl border transition ${
        isSpeaking
          ? 'bg-orange-500/15 border-orange-500/50 shadow-md shadow-orange-500/20'
          : isMe
          ? 'bg-slate-900/90 border-white/10'
          : 'bg-slate-950/60 border-white/5'
      }`}
    >
      <div className={`w-8 h-8 rounded-lg bg-slate-800 border ${deptConfig.borderClass} flex items-center justify-center text-xs font-bold text-orange-400 shrink-0`}>
        {displayName.slice(0, 2).toUpperCase() || 'TV'}
      </div>

      <div className="flex flex-col min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-bold text-white truncate">{displayName}</span>

          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[0.6rem] font-bold border ${deptConfig.badgeClass}`}>
            <DeptIcon className="w-2.5 h-2.5" />
            {deptConfig.shortName}
          </span>

          {isHost && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-[0.6rem] font-bold text-amber-300">
              <Crown className="w-2.5 h-2.5 text-amber-400" /> Chủ phòng
            </span>
          )}

          {isMe && (
            <span className="text-[0.65rem] font-semibold text-slate-400">(Bạn)</span>
          )}
        </div>

        <span className="flex items-center gap-1 text-[0.65rem] text-slate-400">
          {isSpeaking ? (
            <>
              <Mic className="w-2.5 h-2.5 text-orange-400" /> Đang nói
            </>
          ) : (
            <>
              <Headphones className="w-2.5 h-2.5 text-slate-500" /> Đang lắng nghe
            </>
          )}
        </span>
      </div>

      {isSpeaking && (
        <span className="w-2 h-2 rounded-full bg-orange-400 animate-ping shrink-0 mr-1" />
      )}
    </div>
  );
}
