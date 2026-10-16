import React from 'react';
import type { RoomStatePayload } from '@mpc-voicelink/protocol';
import { MicOff, Mic, Headphones, Crown, CheckCircle2 } from 'lucide-react';

interface AdminMembersTabProps {
  room: RoomStatePayload | null;
  currentClientId: string;
  onForceReleaseFloor: () => void;
}

export function AdminMembersTab({
  room,
  currentClientId,
  onForceReleaseFloor
}: AdminMembersTabProps) {
  const currentSpeaker = room?.members.find((m) => m.clientId === room?.speakerClientId);

  return (
    <div className="flex flex-col gap-5">
      {/* Floor / Speaker Control */}
      <div className="flex flex-col gap-2.5">
        <h3 className="text-xs font-black uppercase tracking-wider text-orange-400">
          Điều phối Kênh Phát Biểu (Floor Control)
        </h3>

        <div className="p-4 rounded-2xl bg-slate-950/80 border border-white/10">
          {room?.speakerClientId ? (
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-rose-500/20 border-2 border-rose-500 flex items-center justify-center text-rose-400 animate-pulse">
                  <Mic className="w-5 h-5" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[0.68rem] text-slate-400">Đang giữ micro phát biểu:</span>
                  <strong className="text-sm text-white">
                    {currentSpeaker?.displayName ?? room.speakerClientId}{' '}
                    {room.speakerClientId === currentClientId && '(Bạn)'}
                  </strong>
                </div>
              </div>

              <button
                type="button"
                onClick={onForceReleaseFloor}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500 border border-rose-500/40 hover:border-rose-500 text-rose-300 hover:text-white text-xs font-extrabold transition cursor-pointer shadow-md"
              >
                <MicOff className="w-3.5 h-3.5" />
                Thu hồi Mic (Cưỡng chế)
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
              <div>
                <strong className="text-emerald-400 block font-bold">Kênh đang rảnh</strong>
                <span>Chưa có thành viên nào nhấn giữ nút đàm thoại.</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Members Directory */}
      <div className="flex flex-col gap-2.5">
        <h3 className="text-xs font-black uppercase tracking-wider text-orange-400">
          Danh sách thành viên ({room?.members.length ?? 0})
        </h3>

        <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
          {room?.members.map((m) => {
            const isMe = m.clientId === currentClientId;
            const isSpeaker = m.clientId === room.speakerClientId;
            const isHost = m.isAdmin || m.clientId === room.creatorClientId;

            return (
              <div
                key={m.clientId}
                className={`flex items-center justify-between p-3 rounded-xl border transition ${
                  isSpeaker
                    ? 'bg-orange-500/15 border-orange-500/60'
                    : 'bg-slate-950/60 border-white/5'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-xs font-bold text-orange-400">
                    {m.displayName.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-bold text-white">
                        {m.displayName} {isMe && <em className="not-italic text-orange-400 text-[0.7rem]">(Bạn)</em>}
                      </span>
                      {m.department && (
                        <span className="px-1.5 py-0.5 rounded text-[0.6rem] font-bold bg-slate-800 text-slate-300 border border-white/5">
                          {m.department === 'bcn' ? '👑 BCN' : m.department === 'dev' ? '💻 Dev' : m.department === 'media' ? '📢 Media' : '📦 Hậu cần'}
                        </span>
                      )}
                    </div>
                    <span className="text-[0.62rem] font-mono text-slate-500">
                      ID: {m.clientId.slice(0, 8)}…
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isHost && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-[0.62rem] font-bold text-amber-300">
                      <Crown className="w-2.5 h-2.5 text-amber-400" /> Chủ phòng
                    </span>
                  )}
                  {isSpeaker ? (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/20 border border-orange-500/50 text-[0.62rem] font-bold text-orange-300 animate-pulse">
                      <Mic className="w-2.5 h-2.5" /> Đang nói
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800 text-[0.62rem] text-slate-400">
                      <Headphones className="w-2.5 h-2.5 text-slate-500" /> Đang nghe
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
