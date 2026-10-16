export declare const ClientEvent: Readonly<{
  JoinRoom: 'JOIN_ROOM';
  RequestFloor: 'REQUEST_FLOOR';
  ReleaseFloor: 'RELEASE_FLOOR';
  Heartbeat: 'HEARTBEAT';
  GetMediaCapabilities: 'GET_MEDIA_CAPABILITIES';
  CreateWebRtcTransport: 'CREATE_WEBRTC_TRANSPORT';
  ConnectWebRtcTransport: 'CONNECT_WEBRTC_TRANSPORT';
  ProduceAudio: 'PRODUCE_AUDIO';
  ResumeAudioConsumer: 'RESUME_AUDIO_CONSUMER';
  CloseMedia: 'CLOSE_MEDIA';
  UpdateAudioProfile: 'UPDATE_AUDIO_PROFILE';
  ForceReleaseFloor: 'FORCE_RELEASE_FLOOR';
  UpdatePosition: 'UPDATE_POSITION';
}>;

export declare const ServerEvent: Readonly<{
  RoomState: 'ROOM_STATE';
  FloorGranted: 'FLOOR_GRANTED';
  FloorDenied: 'FLOOR_DENIED';
  FloorReleased: 'FLOOR_RELEASED';
  ClientDisconnected: 'CLIENT_DISCONNECTED';
  Error: 'ERROR';
  AudioConsumerCreated: 'AUDIO_CONSUMER_CREATED';
  AudioConsumerClosed: 'AUDIO_CONSUMER_CLOSED';
  AudioProfile: 'AUDIO_PROFILE';
}>;

export type RoomPhase = 'IDLE' | 'REQUESTING' | 'TALKING' | 'RELEASING';

export interface Position2D {
  x: number; // 0 - 100 percentage
  y: number; // 0 - 100 percentage
  zone?: string;
}

export interface JoinRoomPayload {
  roomId: string;
  clientId: string;
  displayName: string;
  joinCode: string;
  department?: string;
  position?: Position2D;
}

export interface UpdatePositionPayload {
  x: number;
  y: number;
  zone?: string;
}

export interface ReleaseFloorPayload {
  floorToken: string;
}

export interface ForceReleaseFloorPayload {
  controlCode?: string;
}

export interface HeartbeatPayload {
  floorToken?: string;
}

export interface RoomMember {
  clientId: string;
  displayName: string;
  department?: string;
  position?: Position2D;
  isAdmin?: boolean;
}

export interface RoomStatePayload {
  roomId: string;
  creatorClientId?: string;
  phase: RoomPhase;
  speakerClientId?: string;
  members: RoomMember[];
}

export interface FloorGrantedPayload {
  roomId: string;
  floorToken: string;
  expiresAt: number;
  heartbeatIntervalMs: number;
}

export interface FloorDeniedPayload {
  roomId: string;
  speakerClientId?: string;
}

export interface FloorReleasedPayload {
  roomId: string;
  previousSpeakerClientId: string;
  reason: 'released' | 'lease_expired' | 'disconnected' | 'force_released';
}

export interface ErrorPayload {
  code: string;
  message: string;
}

export type WebRtcTransportDirection = 'send' | 'recv';

export interface AudioRelayProfile {
  inputGainDefault: number;
  inputGainMax: number;
  outputGainDefault: number;
  outputGainMax: number;
  targetPlayoutDelayMs: number;
  targetPlayoutDelayMaxMs: number;
  opusBitrate: number;
  packetizationMs: number;
  maxOutgoingBitrate: number;
}

export interface MediaCapabilitiesPayload {
  routerRtpCapabilities: Record<string, unknown>;
  audioProfile: AudioRelayProfile;
}

export interface CreateWebRtcTransportPayload {
  direction: WebRtcTransportDirection;
  rtpCapabilities?: Record<string, unknown>;
}

export interface WebRtcTransportParameters {
  id: string;
  iceParameters: Record<string, unknown>;
  iceCandidates: Record<string, unknown>[];
  dtlsParameters: Record<string, unknown>;
}

export interface CreateWebRtcTransportResult {
  transport: WebRtcTransportParameters;
  consumers: AudioConsumerPayload[];
}

export interface ConnectWebRtcTransportPayload {
  transportId: string;
  dtlsParameters: Record<string, unknown>;
}

export interface ProduceAudioPayload {
  transportId: string;
  floorToken: string;
  kind: 'audio';
  rtpParameters: Record<string, unknown>;
}

export interface ProduceAudioResult {
  producerId: string;
}

export interface AudioConsumerPayload {
  consumerId: string;
  producerId: string;
  kind: 'audio';
  rtpParameters: Record<string, unknown>;
}

export interface AudioConsumerClosedPayload {
  consumerId: string;
  producerId: string;
  reason: 'producer_closed' | 'transport_closed' | 'session_closed';
}

export interface ResumeAudioConsumerPayload {
  consumerId: string;
}

export interface CloseMediaPayload {
  floorToken?: string;
  reason?: 'client_request' | 'transport_failure';
}

export interface UpdateAudioProfilePayload {
  controlCode?: string;
  inputGainDefault: number;
  outputGainDefault: number;
  targetPlayoutDelayMs: number;
}

export interface SocketAckSuccess<T> {
  ok: true;
  data: T;
}

export interface SocketAckFailure {
  ok: false;
  error: ErrorPayload;
}

export type SocketAck<T> = SocketAckSuccess<T> | SocketAckFailure;

export declare function isRecord(value: unknown): value is Record<string, unknown>;
export declare function nonEmptyString(value: unknown): value is string;
export declare function finiteNumber(value: unknown): value is number;
