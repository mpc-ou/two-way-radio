import { Peer, type DataConnection, type MediaConnection } from 'peerjs';
import type { Position2D, AudioMetrics, PttPhase } from '@mpc-voicelink/ui';

export interface P2PMember {
  clientId: string;
  peerId: string;
  displayName: string;
  department?: string;
  position?: Position2D;
  isAdmin?: boolean;
}

export interface P2PMeshEvents {
  onStatusChange: (status: string) => void;
  onError: (error: string) => void;
  onMembersUpdate: (members: P2PMember[]) => void;
  onSpeakerChange: (speaker: P2PMember | null) => void;
  onMetrics: (metrics: AudioMetrics) => void;
  onRemoteAudioActive: (active: boolean) => void;
}

type P2PMessage =
  | { type: 'HELLO'; member: P2PMember }
  | { type: 'ROSTER_SYNC'; members: P2PMember[] }
  | { type: 'POSITION_UPDATE'; clientId: string; position: Position2D }
  | { type: 'TALK_START'; clientId: string; timestamp: number }
  | { type: 'TALK_STOP'; clientId: string }
  | { type: 'GOODBYE'; clientId: string };

function cleanRoomString(roomId: string): string {
  return roomId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
}

export class P2PMeshClient {
  private peer: Peer | null = null;
  private myPeerId = '';
  private isAnchor = false;
  private localStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private metricInterval: number | null = null;

  private readonly dataConnections = new Map<string, DataConnection>(); // key: peerId
  private readonly mediaConnections = new Map<string, MediaConnection>(); // key: peerId
  private readonly membersMap = new Map<string, P2PMember>(); // key: clientId

  private currentSpeaker: P2PMember | null = null;
  private talkStartTimestamp = 0;
  private audioElement: HTMLAudioElement | null = null;

  constructor(
    private readonly events: P2PMeshEvents,
    private readonly myMember: P2PMember,
    private readonly roomId: string
  ) {}

  setAudioElement(element: HTMLAudioElement | null) {
    this.audioElement = element;
  }

  async connect(): Promise<void> {
    const cleanRoom = cleanRoomString(this.roomId);
    const anchorPeerId = `mpc-vl-${cleanRoom}-anchor`;
    const regularPeerId = `mpc-vl-${cleanRoom}-${this.myMember.clientId.slice(0, 8)}`;

    this.events.onStatusChange('Đang khởi tạo kênh P2P Direct…');

    // Attempt to register as anchor first, fallback to regular
    return new Promise((resolve) => {
      let resolved = false;

      const tryRegister = (targetId: string, asAnchor: boolean) => {
        const peer = new Peer(targetId, {
          debug: 1,
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:global.stun.twilio.com:3478' }
            ]
          }
        });

        peer.on('open', (id) => {
          this.peer = peer;
          this.myPeerId = id;
          this.isAnchor = asAnchor;
          this.myMember.peerId = id;
          this.myMember.isAdmin = asAnchor;
          this.membersMap.set(this.myMember.clientId, this.myMember);
          this.setupPeerListeners(peer);

          if (!asAnchor) {
            this.events.onStatusChange('Đã vào mạng P2P; đang kết nối tới phòng…');
            this.connectToPeer(anchorPeerId);
          } else {
            this.events.onStatusChange('Phòng khởi tạo thành công (Chủ phòng). Sẵn sàng nhận kết nối.');
          }

          this.broadcastRoster();
          void this.prewarmMicrophone();
          if (!resolved) {
            resolved = true;
            resolve();
          }
        });

        peer.on('error', (err: any) => {
          if (asAnchor && err.type === 'unavailable-id') {
            // Anchor already exists! Connect as normal peer
            peer.destroy();
            tryRegister(regularPeerId, false);
            return;
          }
          console.warn('P2P Peer error:', err);
          this.events.onError(`Lỗi mạng P2P: ${err.message || err.type}`);
          if (!resolved) {
            resolved = true;
            resolve();
          }
        });
      };

      tryRegister(anchorPeerId, true);
    });
  }

  private setupPeerListeners(peer: Peer) {
    // Inbound Data Connection
    peer.on('connection', (conn) => {
      this.setupDataConnection(conn);
    });

    // Inbound Media Call
    peer.on('call', async (call) => {
      const dummyStream = this.getOrCreateSilentStream();
      call.answer(dummyStream);
      this.setupMediaConnection(call);
    });
  }

  private setupDataConnection(conn: DataConnection) {
    conn.on('open', () => {
      this.dataConnections.set(conn.peer, conn);

      // Send greeting
      const msg: P2PMessage = { type: 'HELLO', member: this.myMember };
      conn.send(msg);

      if (this.isAnchor) {
        // Send full roster
        const rosterMsg: P2PMessage = {
          type: 'ROSTER_SYNC',
          members: Array.from(this.membersMap.values())
        };
        conn.send(rosterMsg);
      }
    });

    conn.on('data', (data: unknown) => {
      this.handleIncomingMessage(data as P2PMessage, conn.peer);
    });

    conn.on('close', () => {
      this.dataConnections.delete(conn.peer);
      this.removeMemberByPeerId(conn.peer);
    });
  }

  private setupMediaConnection(call: MediaConnection) {
    this.mediaConnections.set(call.peer, call);

    call.on('stream', (remoteStream) => {
      if (this.audioElement) {
        this.audioElement.srcObject = remoteStream;
        void this.audioElement.play().catch(() => undefined);
      }
      this.events.onRemoteAudioActive(true);
    });

    call.on('close', () => {
      this.mediaConnections.delete(call.peer);
      this.events.onRemoteAudioActive(false);
    });
  }

  private connectToPeer(targetPeerId: string) {
    if (!this.peer || targetPeerId === this.myPeerId || this.dataConnections.has(targetPeerId)) {
      return;
    }

    const conn = this.peer.connect(targetPeerId, { reliable: true });
    this.setupDataConnection(conn);

    // Also initiate media call with silent or live stream
    const stream = this.localStream || this.getOrCreateSilentStream();
    const call = this.peer.call(targetPeerId, stream);
    this.setupMediaConnection(call);
  }

  private handleIncomingMessage(msg: P2PMessage, senderPeerId: string) {
    if (!msg || typeof msg !== 'object') return;

    switch (msg.type) {
      case 'HELLO': {
        const member = { ...msg.member, peerId: senderPeerId };
        this.membersMap.set(member.clientId, member);
        this.broadcastRoster();

        // If I am anchor, tell all other peers about this new member
        if (this.isAnchor) {
          this.broadcastMessage({
            type: 'ROSTER_SYNC',
            members: Array.from(this.membersMap.values())
          });
        }
        break;
      }

      case 'ROSTER_SYNC': {
        for (const m of msg.members) {
          this.membersMap.set(m.clientId, m);
          // Connect to any peer we don't have a direct connection with yet (Full Mesh)
          if (m.peerId && m.peerId !== this.myPeerId && !this.dataConnections.has(m.peerId)) {
            this.connectToPeer(m.peerId);
          }
        }
        this.broadcastRoster();
        break;
      }

      case 'POSITION_UPDATE': {
        const existing = this.membersMap.get(msg.clientId);
        if (existing) {
          existing.position = msg.position;
          this.broadcastRoster();
        }
        break;
      }

      case 'TALK_START': {
        const speaker = this.membersMap.get(msg.clientId) || null;
        this.currentSpeaker = speaker;
        this.talkStartTimestamp = msg.timestamp;
        this.events.onSpeakerChange(speaker);
        this.events.onRemoteAudioActive(true);
        break;
      }

      case 'TALK_STOP': {
        if (this.currentSpeaker?.clientId === msg.clientId) {
          this.currentSpeaker = null;
          this.events.onSpeakerChange(null);
          this.events.onRemoteAudioActive(false);
        }
        break;
      }

      case 'GOODBYE': {
        this.membersMap.delete(msg.clientId);
        this.broadcastRoster();
        break;
      }
    }
  }

  private removeMemberByPeerId(peerId: string) {
    let removedClientId: string | null = null;
    for (const [clientId, member] of this.membersMap.entries()) {
      if (member.peerId === peerId) {
        removedClientId = clientId;
        break;
      }
    }
    if (removedClientId) {
      this.membersMap.delete(removedClientId);
      if (this.currentSpeaker?.clientId === removedClientId) {
        this.currentSpeaker = null;
        this.events.onSpeakerChange(null);
        this.events.onRemoteAudioActive(false);
      }
      this.broadcastRoster();
    }
  }

  private broadcastRoster() {
    this.events.onMembersUpdate(Array.from(this.membersMap.values()));
  }

  private broadcastMessage(msg: P2PMessage) {
    for (const conn of this.dataConnections.values()) {
      if (conn.open) {
        conn.send(msg);
      }
    }
  }

  updatePosition(position: Position2D) {
    this.myMember.position = position;
    this.membersMap.set(this.myMember.clientId, this.myMember);
    this.broadcastRoster();
    this.broadcastMessage({
      type: 'POSITION_UPDATE',
      clientId: this.myMember.clientId,
      position
    });
  }

  async prewarmMicrophone(): Promise<void> {
    if (this.localStream) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000
        },
        video: false
      });
      stream.getAudioTracks().forEach((track) => {
        track.enabled = false;
      });
      this.localStream = stream;
      this.setupAudioAnalyser(stream);
    } catch (err) {
      console.warn('Microphone pre-warm note:', err);
    }
  }

  // Push-To-Talk Actions
  async startTalking(): Promise<boolean> {
    if (this.currentSpeaker && this.currentSpeaker.clientId !== this.myMember.clientId) {
      this.events.onStatusChange('Kênh đang bận. Có người khác đang phát biểu.');
      return false;
    }

    try {
      if (!this.localStream) {
        await this.prewarmMicrophone();
      }

      if (this.localStream) {
        if (this.audioContext && this.audioContext.state === 'suspended') {
          void this.audioContext.resume();
        }
        this.localStream.getAudioTracks().forEach((track) => {
          track.enabled = true;
        });

        // Replace tracks in all active media calls to all peers
        const audioTrack = this.localStream.getAudioTracks()[0];
        if (audioTrack) {
          for (const call of this.mediaConnections.values()) {
            const sender = call.peerConnection
              ?.getSenders()
              .find((s) => s.track?.kind === 'audio');
            if (sender) {
              void sender.replaceTrack(audioTrack);
            } else {
              const newCall = this.peer?.call(call.peer, this.localStream);
              if (newCall) this.setupMediaConnection(newCall);
            }
          }
        }
      }

      this.currentSpeaker = this.myMember;
      this.events.onSpeakerChange(this.myMember);
      this.broadcastMessage({
        type: 'TALK_START',
        clientId: this.myMember.clientId,
        timestamp: Date.now()
      });

      return true;
    } catch (err) {
      console.error('Lỗi mở microphone:', err);
      this.events.onError('Không thể mở Microphone. Vui lòng cấp quyền micro.');
      return false;
    }
  }

  stopTalking() {
    if (this.currentSpeaker?.clientId === this.myMember.clientId) {
      this.currentSpeaker = null;
      this.events.onSpeakerChange(null);

      if (this.localStream) {
        this.localStream.getAudioTracks().forEach((track) => {
          track.enabled = false;
        });
      }

      this.broadcastMessage({
        type: 'TALK_STOP',
        clientId: this.myMember.clientId
      });
    }
  }

  private setupAudioAnalyser(stream: MediaStream) {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);

      this.audioContext = ctx;
      this.analyser = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      if (this.metricInterval) clearInterval(this.metricInterval);
      this.metricInterval = window.setInterval(() => {
        if (!this.analyser) return;
        this.analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const level = Math.min(1, (sum / (dataArray.length * 255)) * 2.5);
        this.events.onMetrics({ inputLevel: level });
      }, 75);
    } catch {
      // AudioContext failed or not supported
    }
  }

  private getOrCreateSilentStream(): MediaStream {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const dst = ctx.createMediaStreamDestination();
      const gain = ctx.createGain();
      gain.gain.value = 0; // complete silence
      osc.connect(gain);
      gain.connect(dst);
      osc.start();
      return dst.stream;
    } catch {
      return new MediaStream();
    }
  }

  close() {
    if (this.metricInterval) clearInterval(this.metricInterval);
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }
    if (this.audioContext) {
      void this.audioContext.close();
      this.audioContext = null;
    }

    this.broadcastMessage({ type: 'GOODBYE', clientId: this.myMember.clientId });

    for (const conn of this.dataConnections.values()) {
      conn.close();
    }
    this.dataConnections.clear();

    for (const call of this.mediaConnections.values()) {
      call.close();
    }
    this.mediaConnections.clear();

    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
  }
}

