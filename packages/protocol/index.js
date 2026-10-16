export const ClientEvent = Object.freeze({
  JoinRoom: 'JOIN_ROOM',
  RequestFloor: 'REQUEST_FLOOR',
  ReleaseFloor: 'RELEASE_FLOOR',
  Heartbeat: 'HEARTBEAT',
  GetMediaCapabilities: 'GET_MEDIA_CAPABILITIES',
  CreateWebRtcTransport: 'CREATE_WEBRTC_TRANSPORT',
  ConnectWebRtcTransport: 'CONNECT_WEBRTC_TRANSPORT',
  ProduceAudio: 'PRODUCE_AUDIO',
  ResumeAudioConsumer: 'RESUME_AUDIO_CONSUMER',
  CloseMedia: 'CLOSE_MEDIA',
  UpdateAudioProfile: 'UPDATE_AUDIO_PROFILE',
  ForceReleaseFloor: 'FORCE_RELEASE_FLOOR',
  UpdatePosition: 'UPDATE_POSITION'
});

export const ServerEvent = Object.freeze({
  RoomState: 'ROOM_STATE',
  FloorGranted: 'FLOOR_GRANTED',
  FloorDenied: 'FLOOR_DENIED',
  FloorReleased: 'FLOOR_RELEASED',
  ClientDisconnected: 'CLIENT_DISCONNECTED',
  Error: 'ERROR',
  AudioConsumerCreated: 'AUDIO_CONSUMER_CREATED',
  AudioConsumerClosed: 'AUDIO_CONSUMER_CLOSED',
  AudioProfile: 'AUDIO_PROFILE'
});

export function isRecord(value) {
  return typeof value === 'object' && value !== null;
}

export function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}
