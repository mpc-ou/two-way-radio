import React from 'react';
import type { RoomStatePayload } from '@mpc-voicelink/protocol';
import type { PttPhase } from '../../types';
import type { AudioMetrics } from '../../services/mediaClient';
import { SpeakerStatusCard } from './SpeakerStatusCard';
import { PttButton } from './PttButton';
import { VoiceChannelBar } from './VoiceChannelBar';
import { Volume2, VolumeX, Share2, SlidersHorizontal, Crown, MapPin } from 'lucide-react';

interface PttTerminalProps {
  room: RoomStatePayload | null;
  roomId: string;
  currentClientId: string;
  phase: PttPhase;
  notice: string;
  remoteAudioActive: boolean;
  metrics: AudioMetrics;
  canTalk: boolean;
  pttDisabled: boolean;
  pttCaption: string;
  onRequestFloor: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onReleaseFloor: (e: React.PointerEvent<HTMLButtonElement>) => void;
  speakerEnabled?: boolean;
  onToggleSpeaker?: () => void;
  onOpenShare?: () => void;
  onOpenAdmin?: () => void;
  onOpenMap?: () => void;
  isRoomAdmin?: boolean;
}

export function PttTerminal({
  room,
  roomId,
  currentClientId,
  phase,
  notice,
  remoteAudioActive,
  metrics,
  canTalk,
  pttDisabled,
  pttCaption,
  onRequestFloor,
  onReleaseFloor,
  speakerEnabled = false,
  onToggleSpeaker,
  onOpenShare,
  onOpenAdmin,
  onOpenMap,
  isRoomAdmin = false
}: PttTerminalProps) {
  const speaker = room?.speakerClientId
    ? room.members.find((member) => member.clientId === room.speakerClientId) ?? null
    : null;
  const isMeSpeaker = speaker?.clientId === currentClientId;

  return (
    <div className="w-full max-w-lg mx-auto flex flex-col items-center justify-between gap-5 py-2 px-3 sm:px-4 min-h-[calc(100vh-140px)]">
      {/* 1. Top HUD: Dynamic Live Voice Channel Status */}
      <div className="w-full">
        <SpeakerStatusCard
          speaker={speaker}
          isMeSpeaker={isMeSpeaker}
          roomId={room?.roomId || roomId}
          remoteAudioActive={remoteAudioActive}
          metrics={metrics}
        />
      </div>

      {/* 2. Centerpiece: Dominant Tactile PTT Voice Stage */}
      <div className="flex-1 flex flex-col items-center justify-center my-auto py-2">
        <PttButton
          phase={phase}
          remoteAudioActive={remoteAudioActive}
          pttDisabled={pttDisabled}
          pttCaption={pttCaption}
          onRequestFloor={onRequestFloor}
          onReleaseFloor={onReleaseFloor}
        />

        {/* Quick Voice Controls Dock */}
        <div className="flex items-center gap-2.5 mt-2 flex-wrap justify-center">
          {onToggleSpeaker && (
            <button
              type="button"
              onClick={onToggleSpeaker}
              title="Kiểm tra âm thanh / Bật loa ngoài"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                speakerEnabled
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                  : 'bg-slate-900/80 border-white/10 text-slate-400 hover:text-white'
              }`}
            >
              {speakerEnabled ? <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> : <VolumeX className="w-3.5 h-3.5" />}
              <span>{speakerEnabled ? 'Loa bật' : 'Bật loa'}</span>
            </button>
          )}

          {onOpenMap && (
            <button
              type="button"
              onClick={onOpenMap}
              title="Xem Sơ đồ Vị trí & Radar hội trường"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-900/80 border border-white/10 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/40 transition cursor-pointer"
            >
              <MapPin className="w-3.5 h-3.5 text-emerald-400" />
              <span>Sơ đồ</span>
            </button>
          )}

          {onOpenShare && (
            <button
              type="button"
              onClick={onOpenShare}
              title="Mã QR chia sẻ phòng"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-900/80 border border-white/10 text-slate-400 hover:text-orange-400 hover:border-orange-500/40 transition cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5 text-orange-400" />
              <span>Chia sẻ</span>
            </button>
          )}

          {onOpenAdmin && (
            <button
              type="button"
              onClick={onOpenAdmin}
              title="Quản trị âm lượng & độ trễ"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                isRoomAdmin
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                  : 'bg-slate-900/80 border-white/10 text-slate-400 hover:text-white'
              }`}
            >
              {isRoomAdmin ? (
                <>
                  <Crown className="w-3.5 h-3.5 text-amber-400" />
                  <span>Host Panel</span>
                </>
              ) : (
                <>
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Cài đặt</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* 3. Bottom: Space-Saving Voice Participant Bar & Notice */}
      <div className="w-full flex flex-col gap-2">
        <VoiceChannelBar
          members={room?.members ?? []}
          currentClientId={currentClientId}
          speakerClientId={room?.speakerClientId}
          creatorClientId={room?.creatorClientId}
        />

        {notice && (
          <div className="text-center py-2 px-3 rounded-xl bg-slate-950/60 border border-white/5 text-[0.72rem] text-slate-400 font-medium">
            {notice}
          </div>
        )}
      </div>
    </div>
  );
}
