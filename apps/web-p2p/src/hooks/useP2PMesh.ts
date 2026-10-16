import { useState, useRef, useEffect } from 'react';
import type { AudioMetrics, Position2D, PttPhase, DepartmentId } from '@mpc-voicelink/ui';
import { P2PMeshClient, type P2PMember } from '../services/p2pMeshClient';

export interface UseP2PMeshOptions {
  clientId: string;
  roomId: string;
  displayName: string;
  department: DepartmentId;
  position: Position2D;
  audioElement: HTMLAudioElement | null;
  onNotice: (msg: string) => void;
}

export function useP2PMesh({
  clientId,
  roomId,
  displayName,
  department,
  position,
  audioElement,
  onNotice
}: UseP2PMeshOptions) {
  const [joined, setJoined] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [phase, setPhase] = useState<PttPhase>('IDLE');
  const [members, setMembers] = useState<P2PMember[]>([]);
  const [speaker, setSpeaker] = useState<P2PMember | null>(null);
  const [metrics, setMetrics] = useState<AudioMetrics>({ inputLevel: 0 });
  const [remoteAudioActive, setRemoteAudioActive] = useState(false);

  // Audio configuration settings
  const [playoutDelayMs, setPlayoutDelayMs] = useState(0);
  const [hangTimeMs, setHangTimeMs] = useState(150);
  const [inputGain, setInputGain] = useState(1.0);
  const [outputGain, setOutputGain] = useState(1.0);

  const clientRef = useRef<P2PMeshClient | null>(null);
  const pressActiveRef = useRef(false);

  useEffect(() => {
    return () => {
      clientRef.current?.close();
    };
  }, []);

  function connect() {
    if (!roomId.trim() || !displayName.trim()) {
      onNotice('Vui lòng nhập tên hiển thị và mã phòng.');
      return;
    }

    localStorage.setItem('mpc_p2p_name', displayName.trim());
    setConnecting(true);
    onNotice('Đang khởi tạo kênh WebRTC P2P Direct…');

    const myMember: P2PMember = {
      clientId,
      peerId: '',
      displayName: displayName.trim(),
      department,
      position,
      isAdmin: false
    };

    const client = new P2PMeshClient(
      {
        onStatusChange: onNotice,
        onError: onNotice,
        onMembersUpdate: setMembers,
        onSpeakerChange: setSpeaker,
        onMetrics: setMetrics,
        onRemoteAudioActive: setRemoteAudioActive
      },
      myMember,
      roomId.trim()
    );

    client.setAudioElement(audioElement);
    client.setPlayoutDelay(playoutDelayMs);
    client.setHangTime(hangTimeMs);
    client.setInputGain(inputGain);
    client.setOutputGain(outputGain);
    clientRef.current = client;

    client
      .connect()
      .then(() => {
        setConnecting(false);
        setJoined(true);
        onNotice('Kênh P2P sẵn sàng. Nhấn giữ nút PTT cảm ứng trên màn hình để phát biểu.');
      })
      .catch((err) => {
        setConnecting(false);
        onNotice(`Không thể kết nối: ${err instanceof Error ? err.message : 'Lỗi P2P'}`);
      });
  }

  function disconnect() {
    clientRef.current?.close();
    clientRef.current = null;
    setJoined(false);
    setConnecting(false);
    setPhase('IDLE');
    setSpeaker(null);
    setMembers([]);
    onNotice('Đã rời phòng đàm thoại.');
  }

  function updatePosition(nextPos: Position2D) {
    clientRef.current?.updatePosition(nextPos);
  }

  function requestFloor(e?: React.PointerEvent<HTMLButtonElement>) {
    if (e) e.preventDefault();
    if (phase === 'TALKING' || !clientRef.current) return;

    pressActiveRef.current = true;
    setPhase('TALKING');
    onNotice('Đang phát biểu qua Microphone… Nhả nút để dừng');

    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate(30); } catch {}
    }

    void clientRef.current.startTalking().then((ok) => {
      if (!ok || !pressActiveRef.current) {
        clientRef.current?.stopTalking();
        setPhase('IDLE');
        onNotice(ok ? 'Kênh rảnh. Sẵn sàng đàm thoại.' : 'Kênh đang có người phát biểu.');
      }
    });
  }

  function releaseFloor(e?: React.PointerEvent<HTMLButtonElement>) {
    if (e) e.preventDefault();
    pressActiveRef.current = false;
    setPhase('IDLE');
    onNotice('Kênh rảnh. Sẵn sàng đàm thoại.');
    clientRef.current?.stopTalking();

    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate(15); } catch {}
    }
  }

  function changePlayoutDelay(val: number) {
    setPlayoutDelayMs(val);
    clientRef.current?.setPlayoutDelay(val);
  }

  function changeHangTime(val: number) {
    setHangTimeMs(val);
    clientRef.current?.setHangTime(val);
  }

  function changeInputGain(val: number) {
    setInputGain(val);
    clientRef.current?.setInputGain(val);
  }

  function changeOutputGain(val: number) {
    setOutputGain(val);
    clientRef.current?.setOutputGain(val);
  }

  return {
    joined,
    connecting,
    phase,
    members,
    speaker,
    metrics,
    remoteAudioActive,
    playoutDelayMs,
    hangTimeMs,
    inputGain,
    outputGain,
    connect,
    disconnect,
    updatePosition,
    requestFloor,
    releaseFloor,
    changePlayoutDelay,
    changeHangTime,
    changeInputGain,
    changeOutputGain
  };
}
