import React from 'react';
import type { RoomStatePayload } from '@mpc-voicelink/protocol';
import type { Position2D } from '../../types';
import { TacticalMapFrame } from '../map/TacticalMapFrame';
import { Map, X } from 'lucide-react';

export interface TacticalMapModalProps {
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
                Mô phỏng bán kính 30m - 50m và hiển thị vị trí của bạn
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

        {/* Content */}
        <div className="p-3.5 sm:p-5 overflow-y-auto">
          <TacticalMapFrame
            currentClientId={currentClientId}
            myPosition={myPosition}
            members={membersWithPositions}
            speakerClientId={room?.speakerClientId}
            onPositionChange={onPositionChange}
          />
        </div>
      </div>
    </div>
  );
}

