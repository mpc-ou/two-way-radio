import React from 'react';
import {
  SpeakerStatusCard,
  VoiceChannelBar,
  type AudioMetrics,
  type PttPhase
} from '@mpc-voicelink/ui';
import type { P2PMember } from '../services/p2pMeshClient';
import { CockpitTelemetryRibbon } from './CockpitTelemetryRibbon';
import { CockpitPttStage } from './CockpitPttStage';

export interface P2PRoomCockpitProps {
  roomId: string;
  currentClientId: string;
  wakeLockActive: boolean;
  playoutDelayMs: number;
  hangTimeMs: number;
  members: P2PMember[];
  speaker: P2PMember | null;
  phase: PttPhase;
  metrics: AudioMetrics;
  remoteAudioActive: boolean;
  onOpenAudioSettings: () => void;
  onRequestFloor: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onReleaseFloor: (e: React.PointerEvent<HTMLButtonElement>) => void;
}

export function P2PRoomCockpit({
  roomId,
  currentClientId,
  wakeLockActive,
  playoutDelayMs,
  hangTimeMs,
  members,
  speaker,
  phase,
  metrics,
  remoteAudioActive,
  onOpenAudioSettings,
  onRequestFloor,
  onReleaseFloor
}: P2PRoomCockpitProps) {
  const isMeSpeaker = speaker?.clientId === currentClientId;
  const pttDisabled = Boolean(speaker && !isMeSpeaker);
  const pttCaption = isMeSpeaker
    ? 'Đang phát biểu'
    : speaker
    ? `${speaker.displayName} đang nói`
    : 'Nhấn để nói';

  return (
    <div className="w-full flex-1 flex flex-col justify-between items-center gap-3 sm:gap-4 min-h-[calc(100dvh-130px)] animate-in fade-in duration-200">
      {/* Top HUD: WakeLock, Delay Ribbon & Speaker Status Card */}
      <div className="w-full flex flex-col gap-2.5 shrink-0">
        <CockpitTelemetryRibbon
          wakeLockActive={wakeLockActive}
          playoutDelayMs={playoutDelayMs}
          hangTimeMs={hangTimeMs}
          memberCount={members.length}
          onOpenAudioSettings={onOpenAudioSettings}
        />

        <SpeakerStatusCard
          speaker={speaker}
          isMeSpeaker={isMeSpeaker}
          roomId={roomId}
          remoteAudioActive={remoteAudioActive}
          metrics={metrics}
        />
      </div>

      {/* CENTERPIECE: Dominant Push-To-Talk Button Stage */}
      <CockpitPttStage
        phase={phase}
        remoteAudioActive={remoteAudioActive}
        pttDisabled={pttDisabled}
        pttCaption={pttCaption}
        inputLevel={metrics.inputLevel}
        onRequestFloor={onRequestFloor}
        onReleaseFloor={onReleaseFloor}
      />

      {/* Bottom HUD: Voice Channel Online Roster Bar */}
      <div className="w-full shrink-0">
        <VoiceChannelBar
          members={members}
          currentClientId={currentClientId}
          speakerClientId={speaker?.clientId}
          creatorClientId={members.find((m) => m.isAdmin)?.clientId}
        />
      </div>
    </div>
  );
}

