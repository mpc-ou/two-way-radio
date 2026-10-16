import React from 'react';
import { PttButton, type PttPhase } from '@mpc-voicelink/ui';

export interface CockpitPttStageProps {
  phase: PttPhase;
  remoteAudioActive: boolean;
  pttDisabled: boolean;
  pttCaption: string;
  inputLevel: number;
  onRequestFloor: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onReleaseFloor: (e: React.PointerEvent<HTMLButtonElement>) => void;
}

export function CockpitPttStage({
  phase,
  remoteAudioActive,
  pttDisabled,
  pttCaption,
  inputLevel,
  onRequestFloor,
  onReleaseFloor
}: CockpitPttStageProps) {
  return (
    <div className="w-full flex-1 flex flex-col items-center justify-center my-auto py-2 sm:py-4">
      <div className="w-full max-w-md mx-auto flex flex-col items-center justify-center p-4 sm:p-8 rounded-3xl bg-slate-900/40 border border-white/5 backdrop-blur-xl shadow-2xl">
        <PttButton
          phase={phase}
          remoteAudioActive={remoteAudioActive}
          pttDisabled={pttDisabled}
          pttCaption={pttCaption}
          onRequestFloor={onRequestFloor}
          onReleaseFloor={onReleaseFloor}
          inputLevel={inputLevel}
        />
      </div>
    </div>
  );
}
