import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Header,
  Footer,
  AmbientBackground,
  PttButton,
  SpeakerStatusCard,
  VoiceChannelBar,
  TacticalMapFrame,
  TacticalMapModal,
  ShareModal,
  AudioSettingsModal,
  newClientId,
  getDefaultPositionForDept,
  type DepartmentId,
  type Position2D,
  type PttPhase,
  type AudioMetrics
} from '@mpc-voicelink/ui';
import { P2PMeshClient, type P2PMember } from './services/p2pMeshClient';
import { JoinP2PRoomCard } from './components/JoinP2PRoomCard';
import type { VoiceLinkMode } from './components/GatewayModeSelector';
import { Map, Sun, Moon, Radio, Sparkles, SlidersHorizontal } from 'lucide-react';

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
  const [wakeLockActive, setWakeLockActive] = useState(false);

  const [joined, setJoined] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [phase, setPhase] = useState<PttPhase>('IDLE');
  const [members, setMembers] = useState<P2PMember[]>([]);
  const [speaker, setSpeaker] = useState<P2PMember | null>(null);
  const [metrics, setMetrics] = useState<AudioMetrics>({ inputLevel: 0 });
  const [remoteAudioActive, setRemoteAudioActive] = useState(false);
  const [notice, setNotice] = useState('Chế độ P2P Serverless không cần server. Nhập phòng hoặc quét QR để nói.');
  const [speakerEnabled, setSpeakerEnabled] = useState(true);

  const [isMapOpen, setIsMapOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isAudioSettingsOpen, setIsAudioSettingsOpen] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [playoutDelayMs, setPlayoutDelayMs] = useState(0);
  const [hangTimeMs, setHangTimeMs] = useState(150);
  const [inputGain, setInputGain] = useState(1.0);
  const [outputGain, setOutputGain] = useState(1.0);

  const clientIdRef = useRef(newClientId());
  const clientRef = useRef<P2PMeshClient | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const wakeLockRef = useRef<any>(null);

  // Request WakeLock
  const acquireWakeLock = useCallback(async () => {
    if ('wakeLock' in navigator && keepScreenAwake) {
      try {
        const sentinel = await (navigator as any).wakeLock.request('screen');
        wakeLockRef.current = sentinel;
        setWakeLockActive(true);
        sentinel.addEventListener('release', () => {
          setWakeLockActive(false);
        });
      } catch (err) {
        console.warn('Wake Lock request failed:', err);
      }
    }
  }, [keepScreenAwake]);

  // Release WakeLock
  const releaseWakeLock = useCallback(() => {
    if (wakeLockRef.current) {
      void wakeLockRef.current.release().catch(() => undefined);
      wakeLockRef.current = null;
      setWakeLockActive(false);
    }
  }, []);

  // Sync WakeLock with joined state and visibilitychange
  useEffect(() => {
    if (joined && keepScreenAwake) {
      void acquireWakeLock();
    } else {
      releaseWakeLock();
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && joined && keepScreenAwake) {
        void acquireWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      releaseWakeLock();
    };
  }, [joined, keepScreenAwake, acquireWakeLock, releaseWakeLock]);

  // Clean up client on unmount
  useEffect(() => {
    return () => {
      clientRef.current?.close();
    };
  }, []);

  function handleConnect() {
    if (!roomId.trim() || !displayName.trim()) {
      setNotice('Vui lòng nhập tên hiển thị và mã phòng.');
      return;
    }

    localStorage.setItem('mpc_p2p_name', displayName.trim());

    setConnecting(true);
    setNotice('Đang khởi tạo kênh WebRTC P2P Direct…');

    const myMember: P2PMember = {
      clientId: clientIdRef.current,
      peerId: '',
      displayName: displayName.trim(),
      department,
      position,
      isAdmin: false
    };

    const client = new P2PMeshClient(
      {
        onStatusChange: (status) => setNotice(status),
        onError: (err) => setNotice(err),
        onMembersUpdate: (updatedMembers) => setMembers(updatedMembers),
        onSpeakerChange: (activeSpeaker) => setSpeaker(activeSpeaker),
        onMetrics: (nextMetrics) => setMetrics(nextMetrics),
        onRemoteAudioActive: (active) => setRemoteAudioActive(active)
      },
      myMember,
      roomId.trim()
    );

    client.setAudioElement(audioElementRef.current);
    client.setPlayoutDelay(playoutDelayMs);
    client.setHangTime(hangTimeMs);
    client.setInputGain(inputGain);
    client.setOutputGain(outputGain);
    clientRef.current = client;

    client
      .connect()
      .then(() => {
        setConnectedUI();
      })
      .catch((err) => {
        setConnecting(false);
        setNotice(`Không thể kết nối: ${err instanceof Error ? err.message : 'Lỗi P2P'}`);
      });
  }

  function handlePlayoutDelayChange(val: number) {
    setPlayoutDelayMs(val);
    clientRef.current?.setPlayoutDelay(val);
  }

  function handleHangTimeChange(val: number) {
    setHangTimeMs(val);
    clientRef.current?.setHangTime(val);
  }

  function handleInputGainChange(val: number) {
    setInputGain(val);
    clientRef.current?.setInputGain(val);
  }

  function handleOutputGainChange(val: number) {
    setOutputGain(val);
    clientRef.current?.setOutputGain(val);
  }

  function setConnectedUI() {
    setConnecting(false);
    setJoined(true);
    setNotice('Kênh P2P sẵn sàng. Nhấn giữ nút PTT cảm ứng trên màn hình để phát biểu.');
  }

  function handleDisconnect() {
    releaseWakeLock();
    clientRef.current?.close();
    clientRef.current = null;
    setJoined(false);
    setConnecting(false);
    setPhase('IDLE');
    setSpeaker(null);
    setMembers([]);
    setNotice('Đã rời phòng đàm thoại.');
  }

  function handlePositionChange(nextPos: Position2D) {
    setPosition(nextPos);
    clientRef.current?.updatePosition(nextPos);
  }

  const pressActiveRef = useRef(false);

  function handleRequestFloor(e?: React.PointerEvent<HTMLButtonElement>) {
    if (e) e.preventDefault();
    if (phase === 'TALKING' || !clientRef.current) return;

    pressActiveRef.current = true;
    setPhase('TALKING');
    setNotice('Đang phát biểu qua Microphone… Nhả nút để dừng');

    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate(30); } catch {}
    }

    void clientRef.current.startTalking().then((ok) => {
      if (!ok || !pressActiveRef.current) {
        clientRef.current?.stopTalking();
        setPhase('IDLE');
        setNotice(ok ? 'Kênh rảnh. Sẵn sàng đàm thoại.' : 'Kênh đang có người phát biểu.');
      }
    });
  }

  function handleReleaseFloor(e?: React.PointerEvent<HTMLButtonElement>) {
    if (e) e.preventDefault();
    pressActiveRef.current = false;
    setPhase('IDLE');
    setNotice('Kênh rảnh. Sẵn sàng đàm thoại.');
    clientRef.current?.stopTalking();

    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate(15); } catch {}
    }
  }

  const isMeSpeaker = speaker?.clientId === clientIdRef.current;
  const pttDisabled = Boolean(speaker && !isMeSpeaker);
  const pttCaption = isMeSpeaker
    ? 'Đang phát biểu'
    : speaker
    ? `${speaker.displayName} đang nói`
    : 'Nhấn để nói';

  return (
    <div className="relative min-h-screen flex flex-col bg-[#07090e] text-slate-100 overflow-x-hidden">
      {/* Background Ambience */}
      <AmbientBackground />

      {/* Hidden Audio Element for Remote Streams */}
      <audio ref={audioElementRef} autoPlay playsInline className="hidden" />

      {/* Shared Header from @mpc-voicelink/ui */}
      <Header
        joined={joined}
        roomId={roomId}
        isRoomAdmin={members.find((m) => m.clientId === clientIdRef.current)?.isAdmin}
        speakerEnabled={speakerEnabled}
        modeLabel="P2P SERVERLESS"
        onToggleSpeaker={() => {
          if (audioElementRef.current) {
            audioElementRef.current.muted = speakerEnabled;
            setSpeakerEnabled(!speakerEnabled);
          }
        }}
        onOpenSettings={() => setIsAudioSettingsOpen(true)}
        onOpenShare={() => setIsShareOpen(true)}
        onDisconnect={handleDisconnect}
      />

      {/* Main View Area */}
      <main
        className={`relative z-10 flex-1 flex flex-col p-2 sm:p-4 w-full mx-auto justify-center ${
          joined ? 'max-w-2xl' : 'max-w-6xl'
        }`}
      >
        {!joined ? (
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
            onConnect={handleConnect}
            connecting={connecting}
            notice={notice}
          />
        ) : (
          <div className="w-full flex-1 flex flex-col justify-between items-center gap-3 sm:gap-4 min-h-[calc(100dvh-130px)] animate-in fade-in duration-200">
            {/* Top HUD: WakeLock, Delay Ribbon & Speaker Status Card */}
            <div className="w-full flex flex-col gap-2.5 shrink-0">
              {/* Screen WakeLock Telemetry & Audio Delay Ribbon */}
              <div className="flex items-center justify-between px-3 py-1.5 sm:px-4 sm:py-2 rounded-2xl bg-slate-900/90 border border-white/10 text-xs shadow-md flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {wakeLockActive ? (
                    <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 font-bold text-[0.62rem] sm:text-xs">
                      <Sun className="w-3.5 h-3.5 text-amber-400 animate-spin-slow" />
                      <span>MÀN HÌNH LUÔN SÁNG</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-800 border border-white/10 text-slate-400 font-medium text-[0.62rem] sm:text-xs">
                      <Moon className="w-3.5 h-3.5" />
                      <span>MÀN HÌNH TỰ DO</span>
                    </span>
                  )}

                  {/* Audio Delay & Hang Time Quick Pill */}
                  <button
                    type="button"
                    onClick={() => setIsAudioSettingsOpen(true)}
                    className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 text-orange-300 font-bold text-[0.62rem] sm:text-xs transition cursor-pointer"
                    title="Bấm để chỉnh độ trễ âm thanh"
                  >
                    <SlidersHorizontal className="w-3 h-3 text-orange-400" />
                    <span>ĐỘ TRỄ: <strong className="font-mono text-white">{playoutDelayMs}ms</strong></span>
                    <span className="hidden min-[600px]:inline text-slate-400 font-normal">• Đệm: {hangTimeMs}ms</span>
                  </button>
                </div>

                {/* Members Mesh Online Scale Pill */}
                <div className="flex items-center gap-1.5 font-mono text-[0.68rem] sm:text-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-bold text-white">{members.length}</span>
                  <span className="text-slate-400">thiết bị trong mesh</span>
                </div>
              </div>

              {/* Speaker Status Card */}
              <SpeakerStatusCard
                speaker={speaker}
                isMeSpeaker={isMeSpeaker}
                roomId={roomId}
                remoteAudioActive={remoteAudioActive}
                metrics={metrics}
              />
            </div>

            {/* CENTERPIECE: Dominant Push-To-Talk Button Stage */}
            <div className="w-full flex-1 flex flex-col items-center justify-center my-auto py-2 sm:py-4">
              <div className="w-full max-w-md mx-auto flex flex-col items-center justify-center p-4 sm:p-8 rounded-3xl bg-slate-900/40 border border-white/5 backdrop-blur-xl shadow-2xl">
                <PttButton
                  phase={phase}
                  remoteAudioActive={remoteAudioActive}
                  pttDisabled={pttDisabled}
                  pttCaption={pttCaption}
                  onRequestFloor={handleRequestFloor}
                  onReleaseFloor={handleReleaseFloor}
                  inputLevel={metrics.inputLevel}
                />
              </div>
            </div>

            {/* Bottom HUD: Voice Channel Online Roster Bar */}
            <div className="w-full shrink-0">
              <VoiceChannelBar
                members={members}
                currentClientId={clientIdRef.current}
                speakerClientId={speaker?.clientId}
                creatorClientId={members.find((m) => m.isAdmin)?.clientId}
              />
            </div>
          </div>
        )}
      </main>

      {/* Tactical Map Modal (for mobile or enlarged view) */}
      <TacticalMapModal
        isOpen={isMapOpen}
        onClose={() => setIsMapOpen(false)}
        room={{
          members: members.map((m) => ({
            clientId: m.clientId,
            displayName: m.displayName,
            department: m.department,
            position: m.position,
            isAdmin: m.isAdmin
          })),
          speakerClientId: speaker?.clientId,
          roomId,
          creatorClientId: members.find((m) => m.isAdmin)?.clientId || ''
        } as any}
        currentClientId={clientIdRef.current}
        myPosition={position}
        onPositionChange={handlePositionChange}
      />

      {/* Share Modal with QR & Link */}
      <ShareModal
        isOpen={isShareOpen}
        roomId={roomId}
        onClose={() => setIsShareOpen(false)}
      />

      {/* Audio Settings Modal (Playout Delay, Jitter Buffer, Hang Time, Gains) */}
      <AudioSettingsModal
        isOpen={isAudioSettingsOpen}
        onClose={() => setIsAudioSettingsOpen(false)}
        playoutDelayMs={playoutDelayMs}
        onPlayoutDelayChange={handlePlayoutDelayChange}
        hangTimeMs={hangTimeMs}
        onHangTimeChange={handleHangTimeChange}
        inputGain={inputGain}
        onInputGainChange={handleInputGainChange}
        outputGain={outputGain}
        onOutputGainChange={handleOutputGainChange}
      />

      {/* Shared Footer from @mpc-voicelink/ui */}
      <Footer />
    </div>
  );
}
