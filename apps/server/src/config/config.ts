import { Logger } from '@nestjs/common';

function positiveInteger(name: string, fallback: number): number {
  const value = process.env[name];
  if (value === undefined || value === '') return fallback;

  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

function boundedNumber(name: string, fallback: number, minimum: number, maximum: number): number {
  const value = process.env[name];
  if (value === undefined || value === '') return fallback;

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be between ${minimum} and ${maximum}.`);
  }
  return parsed;
}

function csv(name: string, fallback: string[]): string[] {
  const value = process.env[name];
  if (!value) return fallback;
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

export interface AppConfig {
  host: string;
  port: number;
  corsOrigins: string[];
  roomJoinCode: string;
  audioControlCode: string;
  floorLeaseMs: number;
  heartbeatIntervalMs: number;
  tls: {
    certPath: string;
    keyPath: string;
  };
  media: {
    listenIp: string;
    announcedAddress: string;
    rtcMinPort: number;
    rtcMaxPort: number;
    opusBitrate: number;
    opusPacketizationMs: number;
    maxOutgoingBitrate: number;
    inputGainDefault: number;
    inputGainMax: number;
    outputGainDefault: number;
    outputGainMax: number;
    targetPlayoutDelayMs: number;
    targetPlayoutDelayMaxMs: number;
  };
}

let cachedConfig: AppConfig | undefined;

export function readConfig(): AppConfig {
  const config: AppConfig = {
    host: process.env.HOST ?? '0.0.0.0',
    port: positiveInteger('PORT', 3001),
    corsOrigins: csv('CORS_ORIGINS', ['http://localhost:5173']),
    roomJoinCode: process.env.ROOM_JOIN_CODE ?? 'change-this-before-testing',
    audioControlCode: process.env.AUDIO_CONTROL_CODE ?? '',
    floorLeaseMs: positiveInteger('FLOOR_LEASE_MS', 2500),
    heartbeatIntervalMs: positiveInteger('HEARTBEAT_INTERVAL_MS', 750),
    tls: {
      certPath: process.env.TLS_CERT_PATH ?? '',
      keyPath: process.env.TLS_KEY_PATH ?? ''
    },
    media: {
      listenIp: process.env.MEDIASOUP_LISTEN_IP ?? '0.0.0.0',
      announcedAddress: process.env.MEDIASOUP_ANNOUNCED_ADDRESS ?? '',
      rtcMinPort: positiveInteger('MEDIASOUP_RTC_MIN_PORT', 40000),
      rtcMaxPort: positiveInteger('MEDIASOUP_RTC_MAX_PORT', 40100),
      opusBitrate: positiveInteger('OPUS_BITRATE', 32000),
      opusPacketizationMs: positiveInteger('OPUS_PACKETIZATION_MS', 20),
      maxOutgoingBitrate: positiveInteger('MAX_OUTGOING_BITRATE', 40000),
      inputGainDefault: boundedNumber('INPUT_GAIN_DEFAULT', 1, 0, 2),
      inputGainMax: boundedNumber('INPUT_GAIN_MAX', 1.5, 0.1, 2),
      outputGainDefault: boundedNumber('OUTPUT_GAIN_DEFAULT', 1, 0, 2),
      outputGainMax: boundedNumber('OUTPUT_GAIN_MAX', 1.5, 0.1, 2),
      targetPlayoutDelayMs: boundedNumber('TARGET_PLAYOUT_DELAY_MS', 0, 0, 250),
      targetPlayoutDelayMaxMs: boundedNumber('TARGET_PLAYOUT_DELAY_MAX_MS', 150, 0, 250)
    }
  };

  if (config.media.rtcMinPort >= config.media.rtcMaxPort) {
    throw new Error('MEDIASOUP_RTC_MIN_PORT must be lower than MEDIASOUP_RTC_MAX_PORT.');
  }
  if (Boolean(config.tls.certPath) !== Boolean(config.tls.keyPath)) {
    throw new Error('TLS_CERT_PATH and TLS_KEY_PATH must either both be set or both be empty.');
  }
  if (config.media.opusPacketizationMs !== 20) {
    throw new Error('This MVP currently supports a 20 ms Opus packetization profile only.');
  }
  if (config.media.inputGainDefault > config.media.inputGainMax) {
    throw new Error('INPUT_GAIN_DEFAULT must not exceed INPUT_GAIN_MAX.');
  }
  if (config.media.outputGainDefault > config.media.outputGainMax) {
    throw new Error('OUTPUT_GAIN_DEFAULT must not exceed OUTPUT_GAIN_MAX.');
  }
  if (config.media.targetPlayoutDelayMs > config.media.targetPlayoutDelayMaxMs) {
    throw new Error('TARGET_PLAYOUT_DELAY_MS must not exceed TARGET_PLAYOUT_DELAY_MAX_MS.');
  }
  if (!config.media.announcedAddress) {
    new Logger('Configuration').warn(
      'MEDIASOUP_ANNOUNCED_ADDRESS is empty. Set the laptop LAN IP before WebRTC testing.'
    );
  }
  if (config.roomJoinCode === 'change-this-before-testing') {
    new Logger('Configuration').warn('ROOM_JOIN_CODE still uses the development default.');
  }
  cachedConfig = config;
  return cachedConfig;
}

