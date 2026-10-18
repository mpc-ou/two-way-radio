export const ClientEvent = Object.freeze({
  ListChannels: 'LIST_CHANNELS',
  JoinChannel: 'JOIN_CHANNEL',
  LeaveChannel: 'LEAVE_CHANNEL',
  SendChat: 'SEND_CHAT',
  RequestFloor: 'REQUEST_FLOOR',
  ReleaseFloor: 'RELEASE_FLOOR',
  Heartbeat: 'HEARTBEAT',
  GetMediaCapabilities: 'GET_MEDIA_CAPABILITIES',
  CreateWebRtcTransport: 'CREATE_WEBRTC_TRANSPORT',
  ConnectWebRtcTransport: 'CONNECT_WEBRTC_TRANSPORT',
  RestartIce: 'RESTART_ICE',
  ProduceAudio: 'PRODUCE_AUDIO',
  ResumeAudioConsumer: 'RESUME_AUDIO_CONSUMER',
  CloseMedia: 'CLOSE_MEDIA',
  UpdateAudioProfile: 'UPDATE_AUDIO_PROFILE',
  ForceReleaseFloor: 'FORCE_RELEASE_FLOOR'
});

export const ServerEvent = Object.freeze({
  ChannelsUpdate: 'CHANNELS_UPDATE',
  RoomState: 'ROOM_STATE',
  ChatHistory: 'CHAT_HISTORY',
  ChatMessage: 'CHAT_MESSAGE',
  FloorGranted: 'FLOOR_GRANTED',
  FloorDenied: 'FLOOR_DENIED',
  FloorReleased: 'FLOOR_RELEASED',
  ClientDisconnected: 'CLIENT_DISCONNECTED',
  Error: 'ERROR',
  AudioConsumerCreated: 'AUDIO_CONSUMER_CREATED',
  AudioConsumerClosed: 'AUDIO_CONSUMER_CLOSED',
  AudioProfile: 'AUDIO_PROFILE'
});

/** Giới hạn tin nhắn chat (ký tự) và số tin giữ lại mỗi channel. */
export const CHAT_MAX_LENGTH = 500;
export const CHAT_HISTORY_SIZE = 50;

export function isRecord(value) {
  return typeof value === 'object' && value !== null;
}

export function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}
