import React, { useState, useRef } from 'react';
import {
  Header,
  Footer,
  AmbientBackground,
  ShareModal,
  AudioSettingsModal,
  newClientId,
  getDefaultPositionForDept,
  type DepartmentId,
  type Position2D
} from '@mpc-voicelink/ui';
import { JoinP2PRoomCard } from './components/JoinP2PRoomCard';
import { P2PRoomCockpit } from './components/P2PRoomCockpit';
import { useWakeLock } from './hooks/useWakeLock';
import { useP2PMesh } from './hooks/useP2PMesh';
import type { VoiceLinkMode } from './components/GatewayModeSelector';

export function App() {
  const [mode, setMode] = useState<VoiceLinkMode>('p2p');
  const [roomId, setRoomId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('room') || 'mpc-event';
  });
  const [displayName, setDisplayName] = useState(() => {
    return localStorage.getItem('mpc_p2p_name') || '';
  });
  const [department, setDepartment] = useState<DepartmentId>('dev');
  const [position, setPosition] = useState<Position2D>(() => getDefaultPositionForDept('dev'));
  const [keepScreenAwake, setKeepScreenAwake] = useState(true);
  const [notice, setNotice] = useState('Chế độ P2P Serverless không cần server. Nhập phòng hoặc quét QR để nói.');
  const [speakerEnabled, setSpeakerEnabled] = useState(true);

  // Modals state
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isAudioSettingsOpen, setIsAudioSettingsOpen] = useState(false);

  const clientIdRef = useRef(newClientId());
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  // Custom hook: WebRTC P2P Mesh Networking & Voice logic
  const mesh = useP2PMesh({
    clientId: clientIdRef.current,
    roomId,
    displayName,
    department,
    position,
    audioElement: audioElementRef.current,
    onNotice: setNotice
  });

  // Custom hook: Screen WakeLock management
  const { wakeLockActive } = useWakeLock(keepScreenAwake, mesh.joined);

  const isRoomAdmin = mesh.members.find((m) => m.clientId === clientIdRef.current)?.isAdmin;

  function handleToggleSpeaker() {
    if (audioElementRef.current) {
      audioElementRef.current.muted = speakerEnabled;
      setSpeakerEnabled(!speakerEnabled);
    }
  }

  return (
    <div className="relative min-h-screen flex flex-col bg-[#07090e] text-slate-100 overflow-x-hidden">
      {/* Background Ambience */}
      <AmbientBackground />

      {/* Hidden Audio Element for Remote Streams */}
      <audio ref={audioElementRef} autoPlay playsInline className="hidden" />

      {/* Header Bar */}
      <Header
        joined={mesh.joined}
        roomId={roomId}
        isRoomAdmin={isRoomAdmin}
        speakerEnabled={speakerEnabled}
        modeLabel="P2P SERVERLESS"
        onToggleSpeaker={handleToggleSpeaker}
        onOpenSettings={() => setIsAudioSettingsOpen(true)}
        onOpenShare={() => setIsShareOpen(true)}
        onDisconnect={mesh.disconnect}
      />

      {/* Main View Area */}
      <main
        className={`relative z-10 flex-1 flex flex-col p-2 sm:p-4 w-full mx-auto justify-center ${
          mesh.joined ? 'max-w-2xl' : 'max-w-6xl'
        }`}
      >
        {!mesh.joined ? (
          <JoinP2PRoomCard
            mode={mode}
            onSelectMode={setMode}
            roomId={roomId}
            onRoomIdChange={setRoomId}
            displayName={displayName}
            onDisplayNameChange={setDisplayName}
            department={department}
            onDepartmentChange={setDepartment}
            position={position}
            onPositionChange={setPosition}
            keepScreenAwake={keepScreenAwake}
            onKeepScreenAwakeChange={setKeepScreenAwake}
            onOpenShareModal={() => setIsShareOpen(true)}
            onConnect={mesh.connect}
            connecting={mesh.connecting}
            notice={notice}
          />
        ) : (
          <P2PRoomCockpit
            roomId={roomId}
            currentClientId={clientIdRef.current}
            wakeLockActive={wakeLockActive}
            playoutDelayMs={mesh.playoutDelayMs}
            hangTimeMs={mesh.hangTimeMs}
            members={mesh.members}
            speaker={mesh.speaker}
            phase={mesh.phase}
            metrics={mesh.metrics}
            remoteAudioActive={mesh.remoteAudioActive}
            onOpenAudioSettings={() => setIsAudioSettingsOpen(true)}
            onRequestFloor={mesh.requestFloor}
            onReleaseFloor={mesh.releaseFloor}
          />
        )}
      </main>

      {/* Share Modal with QR & Link */}
      <ShareModal
        isOpen={isShareOpen}
        roomId={roomId}
        onClose={() => setIsShareOpen(false)}
      />

      {/* Audio Settings Modal */}
      <AudioSettingsModal
        isOpen={isAudioSettingsOpen}
        onClose={() => setIsAudioSettingsOpen(false)}
        playoutDelayMs={mesh.playoutDelayMs}
        onPlayoutDelayChange={mesh.changePlayoutDelay}
        hangTimeMs={mesh.hangTimeMs}
        onHangTimeChange={mesh.changeHangTime}
        inputGain={mesh.inputGain}
        onInputGainChange={mesh.changeInputGain}
        outputGain={mesh.outputGain}
        onOutputGainChange={mesh.changeOutputGain}
      />

      {/* Footer */}
      <Footer />
    </div>
  );
}
