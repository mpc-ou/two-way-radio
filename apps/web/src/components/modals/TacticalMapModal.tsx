import React from 'react';
import type { RoomStatePayload } from '@mpc-voicelink/protocol';
import type { Position2D } from '../../types';
import { TacticalMapFrame } from '../map/TacticalMapFrame';
import { Map, X, Users, Mic, Radio } from 'lucide-react';

interface TacticalMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: RoomStatePayload | null;
  currentClientId: string;
  myPosition: Position2D;
  onPositionChange: (nextPos: Position2D) => void;
}

export function TacticalMapModal({
  isOpen,
  onClose,
  room,
  currentClientId,
  myPosition,
  onPositionChange
}: TacticalMapModalProps) {
  if (!isOpen) return null;

  const membersWithPositions = room?.members ?? [];
  const activeSpeaker = membersWithPositions.find((m) => m.clientId === room?.speakerClientId);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-5 bg-black/80 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[92dvh] flex flex-col rounded-3xl bg-slate-900 border border-white/10 shadow-2xl overflow-hidden backdrop-blur-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-3.5 sm:p-5 border-b border-white/10 bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400 shrink-0">
              <Map className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base md:text-lg font-black text-white flex items-center gap-1.5 truncate">
                Sơ Đồ Vị Trí (Radar Hội Trường)
              </h2>
              <p className="text-[0.65rem] sm:text-xs text-slate-400 truncate">
                Hiển thị vị trí thực tế của các ban và phát hiện nguồn phát giọng nói
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 border border-white/10 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer transition shrink-0 ml-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-3 sm:p-6 flex flex-col gap-3 sm:gap-4 overflow-y-auto">
          {/* Active Speaker Alert Bar if someone is talking */}
          {room?.speakerClientId && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-orange-500/15 border border-orange-500/40 text-orange-200 text-xs animate-pulse">
              <div className="flex items-center gap-2 font-bold">
                <Mic className="w-4 h-4 text-orange-400" />
                <span>Nguồn phát đàm thoại: {activeSpeaker?.displayName || 'Ai đó'}</span>
              </div>
              <span className="font-mono text-[0.7rem] bg-orange-500/30 px-2 py-0.5 rounded">
                Khu vực: {activeSpeaker?.position?.zone || 'Tọa độ tự do'}
              </span>
            </div>
          )}

          {/* The Interactive Map */}
          <TacticalMapFrame
            currentClientId={currentClientId}
            myPosition={myPosition}
            members={membersWithPositions}
            speakerClientId={room?.speakerClientId}
            onPositionChange={onPositionChange}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-white/10 bg-slate-950/60 text-xs">
          <span className="text-slate-400 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-slate-400" />
            Đang định vị {membersWithPositions.length} thiết bị trong phòng
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-400 text-white font-bold transition cursor-pointer"
          >
            Đóng sơ đồ
          </button>
        </div>
      </div>
    </div>
  );
}

