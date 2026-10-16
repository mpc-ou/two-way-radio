import React from 'react';
import { MemberItem } from './MemberItem';

export interface MembersListProps {
  members: Array<{ clientId: string; displayName: string; department?: string; isAdmin?: boolean }>;
  currentClientId: string;
  speakerClientId?: string;
  creatorClientId?: string;
}

export function MembersList({
  members,
  currentClientId,
  speakerClientId,
  creatorClientId
}: MembersListProps) {
  return (
    <div className="flex flex-col gap-3 p-4 rounded-2xl bg-slate-900/60 border border-white/10 backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
          Thành viên trong phòng ({members.length})
        </h3>
        <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-[0.62rem] font-bold text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          TRỰC TIẾP
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
        {members.map((m) => {
          const isMe = m.clientId === currentClientId;
          const isSpeaking = speakerClientId === m.clientId;
          const isHost = m.isAdmin || m.clientId === creatorClientId;

          return (
            <MemberItem
              key={m.clientId}
              displayName={m.displayName}
              clientId={m.clientId}
              department={m.department}
              isMe={isMe}
              isSpeaking={isSpeaking}
              isHost={isHost}
            />
          );
        })}
      </div>
    </div>
  );
}

