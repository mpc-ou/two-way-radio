import { Logger } from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function positiveInteger(name: string, fallback: number): number {
  const value = process.env[name];
  if (value === undefined || value === '') return fallback;

  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

function optionalPort(name: string): number | undefined {
  const value = process.env[name];
  if (value === undefined || value === '') return undefined;
  return positiveInteger(name, 0);
}

function booleanFlag(name: string, fallback: boolean): boolean {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) return fallback;
  if (['1', 'true', 'yes', 'on'].includes(value)) return true;
  if (['0', 'false', 'no', 'off'].includes(value)) return false;
  throw new Error(`${name} must be true or false.`);
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

/** Đường dẫn tương đối tính từ thư mục chạy server (apps/server). */
function pathFromEnv(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value ? resolve(value) : (fallback ? resolve(fallback) : '');
}

export interface ChannelConfig {
  id: string;
  name: string;
  color: string;
  pin?: string;
}

const DEFAULT_CHANNELS: ChannelConfig[] = [
  { id: 'tong', name: 'Kênh Tổng', color: '#f97316' }
];

function readChannels(filePath: string): ChannelConfig[] {
  if (!existsSync(filePath)) {
    new Logger('Configuration').warn(`CHANNELS_FILE ${filePath} not found; using a single default channel.`);
    return DEFAULT_CHANNELS;
  }

  const parsed: unknown = JSON.parse(readFileSync(filePath, 'utf8'));
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('CHANNELS_FILE must contain a non-empty JSON array.');
  }

  const ids = new Set<string>();
  return parsed.map((entry: unknown, index): ChannelConfig => {
    if (typeof entry !== 'object' || entry === null) throw new Error(`Channel #${index} must be an object.`);
    const raw = entry as Record<string, unknown>;
    const id = typeof raw.id === 'string' ? raw.id.trim() : '';
    const name = typeof raw.name === 'string' ? raw.name.trim() : '';
    if (!/^[a-z0-9_-]{1,32}$/.test(id)) {
      throw new Error(`Channel #${index} id must match [a-z0-9_-]{1,32}.`);
    }
    if (!name) throw new Error(`Channel "${id}" requires a name.`);
    if (ids.has(id)) throw new Error(`Duplicate channel id "${id}".`);
    ids.add(id);
    const pin = typeof raw.pin === 'string' && raw.pin.trim() ? raw.pin.trim() : undefined;
    const color = typeof raw.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(raw.color) ? raw.color : '#f97316';
    return { id, name, color, ...(pin ? { pin } : {}) };
  });
}

export interface AppConfig {
  host: string;
  port: number;
  webDistPath: string;
  channels: ChannelConfig[];
  maxMembersPerRoom: number;
  joinMaxFailures: number;
  joinBlockMs: number;
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
    port: number;
    announcedUdpPort?: number;
    announcedTcpPort?: number;
    enableUdp: boolean;
    enableTcp: boolean;
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

/** Đọc và kiểm tra cấu hình một lần; các lần gọi sau dùng bản đã cache. */
export function readConfig(): AppConfig {
  if (cachedConfig) return cachedConfig;

  const config: AppConfig = {
    host: process.env.HOST ?? '0.0.0.0',
    port: positiveInteger('PORT', 443),
    webDistPath: pathFromEnv('WEB_DIST_PATH', '../web/dist'),
    channels: readChannels(pathFromEnv('CHANNELS_FILE', 'channels.json')),
    maxMembersPerRoom: positiveInteger('MAX_MEMBERS_PER_ROOM', 15),
    joinMaxFailures: positiveInteger('JOIN_MAX_FAILURES', 8),
    joinBlockMs: positiveInteger('JOIN_BLOCK_MS', 60000),
    audioControlCode: process.env.AUDIO_CONTROL_CODE ?? '',
    floorLeaseMs: positiveInteger('FLOOR_LEASE_MS', 2500),
    heartbeatIntervalMs: positiveInteger('HEARTBEAT_INTERVAL_MS', 750),
    tls: {
      certPath: pathFromEnv('TLS_CERT_PATH', ''),
      keyPath: pathFromEnv('TLS_KEY_PATH', '')
    },
    media: {
      listenIp: process.env.MEDIASOUP_LISTEN_IP ?? '0.0.0.0',
      announcedAddress: process.env.MEDIASOUP_ANNOUNCED_ADDRESS ?? '',
      port: positiveInteger('MEDIASOUP_PORT', 44444),
      announcedUdpPort: optionalPort('MEDIASOUP_ANNOUNCED_UDP_PORT'),
      announcedTcpPort: optionalPort('MEDIASOUP_ANNOUNCED_TCP_PORT'),
      enableUdp: booleanFlag('MEDIASOUP_ENABLE_UDP', true),
      enableTcp: booleanFlag('MEDIASOUP_ENABLE_TCP', true),
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

  if (!config.media.enableUdp && !config.media.enableTcp) {
    throw new Error('At least one of MEDIASOUP_ENABLE_UDP / MEDIASOUP_ENABLE_TCP must be true.');
  }
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
  const logger = new Logger('Configuration');
  if (!config.tls.certPath) {
    logger.warn('TLS_CERT_PATH is empty: điện thoại trong LAN sẽ không dùng được microphone qua HTTP.');
  }
  if (!existsSync(config.webDistPath)) {
    logger.warn(`WEB_DIST_PATH ${config.webDistPath} not found; chạy "vite build" cho apps/web trước.`);
  }
  cachedConfig = config;
  return cachedConfig;
}
