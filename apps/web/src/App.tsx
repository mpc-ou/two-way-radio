import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import {
  ClientEvent,
  ServerEvent,
  type AudioConsumerClosedPayload,
  type AudioConsumerPayload,
  type AudioRelayProfile,
  type ErrorPayload,
  type FloorDeniedPayload,
  type FloorGrantedPayload,
  type FloorReleasedPayload,
  type RoomStatePayload
} from '@mpc-voicelink/protocol';
import type { ConnectionSettings, Position2D, PttPhase } from './types';
import { newClientId } from './utils/format';
import { getInitialSettings, saveSettings } from './utils/storage';
import { emitWithAck, MediaClient, type AudioMetrics } from './services/mediaClient';
import { Header } from './components/common/Header';
import { Footer } from './components/common/Footer';
import { AmbientBackground } from './components/common/AmbientBackground';
import { JoinRoomCard } from './components/join/JoinRoomCard';
import { PttTerminal } from './components/ptt/PttTerminal';
import { AdminModal } from './components/modals/AdminModal';
import { ShareModal } from './components/modals/ShareModal';
import { TacticalMapModal } from './components/modals/TacticalMapModal';

export function App() {
  const [settings, setSettings] = useState<ConnectionSettings>(getInitialSettings);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [joined, setJoined] = useState(false);
  const [mediaReady, setMediaReady] = useState(false);
  const [phase, setPhase] = useState<PttPhase>('IDLE');
  const [room, setRoom] = useState<RoomStatePayload | null>(null);
  const [notice, setNotice] = useState('Nhập thông tin phòng để kết nối bộ đàm.');
  const [heartbeatIntervalMs, setHeartbeatIntervalMs] = useState(1000);
  const [audioProfile, setAudioProfile] = useState<AudioRelayProfile | null>(null);
  const [inputGain, setInputGain] = useState(1);
  const [outputGain, setOutputGain] = useState(1);
  const [targetDelayMs, setTargetDelayMs] = useState(0);
  const [adminCode, setAdminCode] = useState('');
  const [transportState, setTransportState] = useState('chưa tạo transport');
  const [remoteAudioActive, setRemoteAudioActive] = useState(false);
  const [metrics, setMetrics] = useState<AudioMetrics>({ inputLevel: 0 });
  const [floorGrantRoundTripMs, setFloorGrantRoundTripMs] = useState<number>();
  const [speakerEnabled, setSpeakerEnabled] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isMapOpen, setIsMapOpen] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const clientIdRef = useRef(newClientId());
  const floorTokenRef = useRef<string | null>(null);
  const pressActiveRef = useRef(false);
  const floorRequestStartedAtRef = useRef<number | undefined>(undefined);
  const mediaInitializingRef = useRef(false);
  const audioElementRef = useRef<HTMLAudioElement>(null);
  const mediaRef = useRef<MediaClient | null>(null);

  if (!mediaRef.current) {
    mediaRef.current = new MediaClient({
      onError: (message) => setNotice(message),
      onMetrics: (nextMetrics) => setMetrics(nextMetrics),
      onTransportState: (state) => setTransportState(state),
      onTransportFailure: () => {
        const socket = socketRef.current;
        setNotice('Mất kết nối WebRTC; đang khởi động lại media…');
        setMediaReady(false);
        void mediaRef.current?.close();
        socket?.disconnect();
      },
      onRemoteAudioActive: setRemoteAudioActive
    });
  }
  const media = mediaRef.current;

  useEffect(() => {
    media.setAudioElement(audioElementRef.current);
    return () => {
      void media.close();
      socketRef.current?.disconnect();
    };
  }, [media]);

  useEffect(() => {
    if (phase !== 'TALKING' || !floorTokenRef.current) return undefined;
    const timer = window.setInterval(() => {
      socketRef.current?.emit(ClientEvent.Heartbeat, { floorToken: floorTokenRef.current });
    }, heartbeatIntervalMs);
    return () => window.clearInterval(timer);
  }, [heartbeatIntervalMs, phase]);

  useEffect(() => {
    const releaseForInterruption = (): void => {
      pressActiveRef.current = false;
      const floorToken = floorTokenRef.current;
      if (!floorToken) return;

      floorTokenRef.current = null;
      setPhase('RELEASING');
      void media.stopTalking();
      socketRef.current?.emit(ClientEvent.ReleaseFloor, { floorToken });
    };
    const onVisibilityChange = (): void => {
      if (document.visibilityState !== 'visible') releaseForInterruption();
    };

    window.addEventListener('pagehide', releaseForInterruption);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('pagehide', releaseForInterruption);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [media]);

  function resetFloor(message?: string): void {
    floorTokenRef.current = null;
    floorRequestStartedAtRef.current = undefined;
    setPhase('IDLE');
    if (message) setNotice(message);
  }

  function applyAudioProfile(profile: AudioRelayProfile): void {
    media.applyAudioProfile(profile);
    setAudioProfile(profile);
    setInputGain(profile.inputGainDefault);
    setOutputGain(profile.outputGainDefault);
    setTargetDelayMs(profile.targetPlayoutDelayMs);
  }

  function initializeMedia(socket: Socket): void {
    if (media.ready || mediaInitializingRef.current) return;
    mediaInitializingRef.current = true;
    setNotice('Đang khởi tạo WebRTC audio…');
    void media.initialize(socket)
      .then((profile) => {
        applyAudioProfile(profile);
        setMediaReady(true);
        setNotice(window.isSecureContext
          ? 'Hệ thống sẵn sàng. Nhấn giữ nút PTT để phát biểu.'
          : 'Đã kết nối, nhưng cần HTTPS để dùng Microphone.');
      })
      .catch((error: unknown) => {
        setMediaReady(false);
        setNotice(`Không thể khởi tạo WebRTC: ${error instanceof Error ? error.message : 'Lỗi không xác định.'}`);
      })
      .finally(() => {
        mediaInitializingRef.current = false;
      });
  }

  function connect(): void {
    if (!settings.serverUrl || !settings.roomId || !settings.displayName || !settings.joinCode) {
      setNotice('Vui lòng điền đầy đủ tên hiển thị, tên phòng và mã phòng.');
      return;
    }

    saveSettings(settings);

    void media.close();
    setMediaReady(false);
    socketRef.current?.disconnect();
    clientIdRef.current = newClientId();
    setConnecting(true);
    setNotice('Đang kết nối tới server…');
    const socket = io(settings.serverUrl, {
      autoConnect: false,
      transports: ['polling', 'websocket'],
      reconnection: false
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      setConnecting(false);
      setNotice('Đã kết nối; đang tham gia phòng…');
      socket.emit(ClientEvent.JoinRoom, {
        roomId: settings.roomId.trim(),
        clientId: clientIdRef.current,
        displayName: settings.displayName.trim(),
        joinCode: settings.joinCode.trim(),
        department: settings.department || 'dev',
        position: settings.position
      });
    });

    socket.on('disconnect', () => {
      setConnected(false);
      setConnecting(false);
      setJoined(false);
      setMediaReady(false);
      setRoom(null);
      setRemoteAudioActive(false);
      void media.close();
      resetFloor('Đã ngắt kết nối với phòng bộ đàm.');
    });

    socket.on('connect_error', (error: any) => {
      console.error('Socket connect_error:', error);
      setConnected(false);
      setConnecting(false);
      const detail = error?.description ? ` (${error.description})` : '';
      setNotice(`Không kết nối được: ${error.message || 'Lỗi mạng hoặc SSL'}${detail}. Đảm bảo dùng URL https cùng cổng web.`);
    });

    socket.on(ServerEvent.RoomState, (payload: RoomStatePayload) => {
      setRoom(payload);
      setJoined(true);
      setNotice(payload.speakerClientId ? 'Kênh đang có người nói.' : 'Kênh rảnh. Sẵn sàng đàm thoại.');
      initializeMedia(socket);
    });

    socket.on(ServerEvent.AudioProfile, (payload: AudioRelayProfile) => {
      applyAudioProfile(payload);
    });

    socket.on(ServerEvent.AudioConsumerCreated, (payload: AudioConsumerPayload) => {
      void media.consumeAudio(socket, payload).catch((error: unknown) => {
        setNotice(`Lỗi nhận audio: ${error instanceof Error ? error.message : 'không rõ'}`);
      });
    });

    socket.on(ServerEvent.AudioConsumerClosed, (payload: AudioConsumerClosedPayload) => {
      media.closeConsumer(payload.consumerId);
    });

    socket.on(ServerEvent.FloorGranted, (payload: FloorGrantedPayload) => {
      floorTokenRef.current = payload.floorToken;
      setHeartbeatIntervalMs(payload.heartbeatIntervalMs);
      if (floorRequestStartedAtRef.current !== undefined) {
        setFloorGrantRoundTripMs(Math.round(performance.now() - floorRequestStartedAtRef.current));
      }
      if (!pressActiveRef.current) {
        socket.emit(ClientEvent.ReleaseFloor, { floorToken: payload.floorToken });
        setPhase('IDLE');
        return;
      }
      setPhase('TALKING');
      setNotice('Đang phát biểu qua Microphone…');
      void media.startTalking(socket, payload.floorToken)
        .then((started) => {
          if (started) setNotice('Đang nói. Nhả nút để kết thúc lượt.');
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : 'Lỗi microphone';
          setNotice(`Lỗi mic: ${message}`);
          void media.stopTalking();
          socket.emit(ClientEvent.ReleaseFloor, { floorToken: payload.floorToken });
          setPhase('IDLE');
        });
    });

    socket.on(ServerEvent.FloorDenied, (payload: FloorDeniedPayload) => {
      setPhase('IDLE');
      setNotice(payload.speakerClientId ? 'Kênh đang bận. Người khác đang nói.' : 'Yêu cầu nói bị từ chối.');
    });

    socket.on(ServerEvent.FloorReleased, (payload: FloorReleasedPayload) => {
      if (payload.previousSpeakerClientId === clientIdRef.current) {
        void media.stopTalking();
        resetFloor('Đã nhả lượt nói.');
      }
    });

    socket.on(ServerEvent.Error, (payload: ErrorPayload) => {
      if (payload.code === 'INVALID_JOIN_CODE' || payload.code === 'JOIN_FAILED') {
        setConnecting(false);
        setJoined(false);
        socket.disconnect();
        setNotice(`Không vào được phòng: ${payload.message}`);
        return;
      }
      if (payload.code.includes('FLOOR') || payload.code === 'STALE_FLOOR_TOKEN') {
        void media.stopTalking();
        resetFloor(`${payload.message}`);
        return;
      }
      setNotice(`${payload.message}`);
    });

    socket.connect();
  }

  function disconnect(): void {
    pressActiveRef.current = false;
    setConnecting(false);
    void media.close();
    socketRef.current?.disconnect();
  }

  function requestFloor(event: React.PointerEvent<HTMLButtonElement>): void {
    if (!canTalk) return;
    event.preventDefault();
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(40);
      } catch {}
    }
    pressActiveRef.current = true;
    floorRequestStartedAtRef.current = performance.now();
    setPhase('REQUESTING');
    setNotice('Đang yêu cầu kênh nói…');
    socketRef.current?.emit(ClientEvent.RequestFloor, {});
  }

  function releaseFloor(event: React.PointerEvent<HTMLButtonElement>): void {
    event.preventDefault();
    if (!pressActiveRef.current && phase === 'IDLE') return;
    pressActiveRef.current = false;
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(20);
      } catch {}
    }
    const floorToken = floorTokenRef.current;
    if (!floorToken) {
      setPhase('IDLE');
      setNotice('Đã hủy yêu cầu.');
      return;
    }
    setPhase('RELEASING');
    setNotice('Đang giải phóng kênh…');
    void media.stopTalking();
    socketRef.current?.emit(ClientEvent.ReleaseFloor, { floorToken });
  }

  function enableSpeaker(): void {
    void media.enableAudioOutput();
    setSpeakerEnabled(true);
    setNotice('Đã bật loa thành công.');
  }

  function applyPreset(preset: 'low_latency' | 'long_range' | 'boost'): void {
    let newIn = 1.0;
    let newOut = 1.0;
    let newDelay = 0;
    if (preset === 'low_latency') {
      newIn = 1.0;
      newOut = 1.0;
      newDelay = 0;
    } else if (preset === 'long_range') {
      newIn = 1.2;
      newOut = 1.3;
      newDelay = 80;
    } else if (preset === 'boost') {
      newIn = 1.5;
      newOut = 1.5;
      newDelay = 40;
    }
    setInputGain(newIn);
    setOutputGain(newOut);
    setTargetDelayMs(newDelay);
    media.setInputGain(newIn);
    media.setOutputGain(newOut);
    media.setTargetPlayoutDelay(newDelay);
    const label = preset === 'low_latency' ? 'Siêu tốc (<10m)' : preset === 'long_range' ? 'Tầm xa (20-50m)' : 'Môi trường ồn';
    setNotice(`Đã chọn preset: ${label}`);
  }

  function handlePositionChange(nextPos: Position2D): void {
    const updated = { ...settings, position: nextPos };
    setSettings(updated);
    saveSettings(updated);
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit(ClientEvent.UpdatePosition, nextPos);
    }
    setNotice(`Đã cập nhật vị trí tác chiến: ${nextPos.zone || 'Tọa độ tự do'}`);
  }

  function applyLocal(): void {
    media.setInputGain(inputGain);
    media.setOutputGain(outputGain);
    media.setTargetPlayoutDelay(targetDelayMs);
    setNotice('Đã lưu cấu hình âm thanh cho riêng máy này.');
  }

  function forceReleaseFloor(): void {
    const socket = socketRef.current;
    if (!socket || !joined) return;
    void emitWithAck<{ success: boolean }>(socket, ClientEvent.ForceReleaseFloor, {
      controlCode: adminCode.trim() || undefined
    })
      .then(() => {
        setNotice('Chủ phòng đã cưỡng chế thu hồi mic thành công.');
      })
      .catch((error: unknown) => {
        setNotice(`Không thể thu hồi mic: ${error instanceof Error ? error.message : 'Lỗi quyền hạn.'}`);
      });
  }

  function updateAdminProfile(): void {
    const socket = socketRef.current;
    if (!socket || !joined) return;
    void emitWithAck<AudioRelayProfile>(socket, ClientEvent.UpdateAudioProfile, {
      controlCode: adminCode.trim() || undefined,
      inputGainDefault: inputGain,
      outputGainDefault: outputGain,
      targetPlayoutDelayMs: targetDelayMs
    })
      .then((updated) => {
        applyAudioProfile(updated);
        setNotice('Đã đồng bộ cấu hình audio toàn phòng thành công!');
      })
      .catch((error: unknown) => {
        setNotice(`Không thể đồng bộ: ${error instanceof Error ? error.message : 'Lỗi quyền hạn.'}`);
      });
  }

  const connectionReady = Boolean(settings.serverUrl && settings.roomId && settings.displayName && settings.joinCode);
  const speakerActive = Boolean(room?.speakerClientId);
  const isMeSpeaker = room?.speakerClientId === clientIdRef.current;
  const canTalk = joined && mediaReady && (!speakerActive || isMeSpeaker);
  const pttDisabled = !canTalk || phase === 'RELEASING';

  let pttCaption = 'ẤN ĐỂ NÓI';
  if (!connected) pttCaption = 'CHƯA KẾT NỐI';
  else if (!joined) pttCaption = 'CHƯA VÀO PHÒNG';
  else if (!mediaReady) pttCaption = 'MEDIA CHƯA SẴN SÀNG';
  else if (phase === 'REQUESTING') pttCaption = 'ĐANG XIN QUYỀN…';
  else if (phase === 'TALKING') pttCaption = 'ĐANG NÓI (NHẢ ĐỂ DỪNG)';
  else if (phase === 'RELEASING') pttCaption = 'ĐANG GIẢI PHÓNG…';
  else if (speakerActive && !isMeSpeaker) pttCaption = 'KÊNH ĐANG BẬN';

  const isRoomAdmin = Boolean(room && room.creatorClientId === clientIdRef.current);

  return (
    <div className="relative min-h-[100dvh] flex flex-col bg-[#07090e] text-slate-100 overflow-x-hidden pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <AmbientBackground />
      <audio ref={audioElementRef} autoPlay playsInline className="hidden" />

      <Header
        joined={joined}
        room={room}
        roomId={settings.roomId}
        joinCode={settings.joinCode}
        isRoomAdmin={isRoomAdmin}
        speakerEnabled={speakerEnabled}
        onToggleSpeaker={enableSpeaker}
        onOpenAdmin={() => setIsAdminOpen(true)}
        onOpenShare={() => setIsShareOpen(true)}
        onDisconnect={disconnect}
      />

      <main className="relative z-10 flex-1 flex flex-col justify-center items-center px-2 sm:px-4 md:px-6 py-2 sm:py-4">
        {!joined ? (
          <JoinRoomCard
            settings={settings}
            connecting={connecting}
            connectionReady={connectionReady}
            notice={notice}
            onSettingsChange={setSettings}
            onConnect={connect}
            onOpenMap={() => setIsMapOpen(true)}
          />
        ) : (
          <PttTerminal
            room={room}
            roomId={settings.roomId}
            currentClientId={clientIdRef.current}
            phase={phase}
            notice={notice}
            remoteAudioActive={remoteAudioActive}
            metrics={metrics}
            canTalk={canTalk}
            pttDisabled={pttDisabled}
            pttCaption={pttCaption}
            onRequestFloor={requestFloor}
            onReleaseFloor={releaseFloor}
            speakerEnabled={speakerEnabled}
            onToggleSpeaker={enableSpeaker}
            onOpenShare={() => setIsShareOpen(true)}
            onOpenAdmin={() => setIsAdminOpen(true)}
            onOpenMap={() => setIsMapOpen(true)}
            isRoomAdmin={isRoomAdmin}
          />
        )}
      </main>

      <Footer />

      <AdminModal
        isOpen={isAdminOpen}
        isRoomAdmin={isRoomAdmin}
        room={room}
        currentClientId={clientIdRef.current}
        audioProfile={audioProfile}
        inputGain={inputGain}
        outputGain={outputGain}
        targetDelayMs={targetDelayMs}
        adminCode={adminCode}
        floorGrantRoundTripMs={floorGrantRoundTripMs}
        metrics={metrics}
        transportState={transportState}
        onClose={() => setIsAdminOpen(false)}
        onInputGainChange={(val) => {
          setInputGain(val);
          media.setInputGain(val);
        }}
        onOutputGainChange={(val) => {
          setOutputGain(val);
          media.setOutputGain(val);
        }}
        onTargetDelayChange={(val) => {
          setTargetDelayMs(val);
          media.setTargetPlayoutDelay(val);
        }}
        onAdminCodeChange={setAdminCode}
        onApplyProfile={updateAdminProfile}
        onApplyLocal={applyLocal}
        onApplyPreset={applyPreset}
        onForceReleaseFloor={forceReleaseFloor}
      />

      <ShareModal
        isOpen={isShareOpen}
        roomId={room?.roomId || settings.roomId}
        joinCode={settings.joinCode}
        onClose={() => setIsShareOpen(false)}
      />

      <TacticalMapModal
        isOpen={isMapOpen}
        onClose={() => setIsMapOpen(false)}
        room={room}
        currentClientId={clientIdRef.current}
        myPosition={settings.position || { x: 50, y: 50, zone: 'Khán Phòng' }}
        onPositionChange={handlePositionChange}
      />
    </div>
  );
}
