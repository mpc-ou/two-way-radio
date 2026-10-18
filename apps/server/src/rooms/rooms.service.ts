import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { readConfig, type ChannelConfig } from '../config/config.js';
import {
  CHAT_HISTORY_SIZE,
  type ChannelInfo,
  type ChatMessage,
  type FloorReleasedPayload,
  type RoomStatePayload
} from '@mpc-voicelink/protocol';

interface Member {
  clientId: string;
  displayName: string;
  socketId: string;
  lastHeartbeatAt: number;
}

interface FloorLease {
  clientId: string;
  token: string;
  expiresAt: number;
}

/** Mỗi channel cấu hình là một room tồn tại suốt vòng đời server. */
interface Room {
  roomId: string;
  name: string;
  color: string;
  pinHash?: Buffer;
  members: Map<string, Member>;
  floor?: FloorLease;
  /** CHAT_HISTORY_SIZE tin gần nhất; chỉ trong RAM. */
  chat: ChatMessage[];
}

export class JoinChannelError extends Error {
  constructor(
    readonly code: 'CHANNEL_NOT_FOUND' | 'PIN_REQUIRED' | 'PIN_INVALID' | 'CHANNEL_FULL',
    message: string
  ) {
    super(message);
  }
}

export type FloorRequestResult =
  | { granted: true; floorToken: string; expiresAt: number; state: RoomStatePayload }
  | { granted: false; speakerClientId?: string; state: RoomStatePayload };

export interface FloorReleasedEvent {
  payload: FloorReleasedPayload;
  floorToken: string;
}

function hashPin(pin: string): Buffer {
  return createHash('sha256').update(pin).digest();
}

@Injectable()
export class RoomsService implements OnModuleDestroy {
  private readonly rooms = new Map<string, Room>();
  private readonly events = new EventEmitter();
  private readonly floorLeaseMs = readConfig().floorLeaseMs;
  private readonly expiryTimer = setInterval(() => this.expireLeases(), 250);

  constructor() {
    this.expiryTimer.unref();
    for (const channel of readConfig().channels) this.rooms.set(channel.id, this.createRoom(channel));
  }

  onFloorReleased(listener: (event: FloorReleasedEvent) => void): void {
    this.events.on('floorReleased', listener);
  }

  listChannels(): ChannelInfo[] {
    const maxMembers = readConfig().maxMembersPerRoom;
    return [...this.rooms.values()].map((room) => ({
      id: room.roomId,
      name: room.name,
      color: room.color,
      hasPin: Boolean(room.pinHash),
      memberCount: room.members.size,
      maxMembers,
      ...(room.floor ? { speakerName: room.members.get(room.floor.clientId)?.displayName } : {})
    }));
  }

  join(input: { roomId: string; clientId: string; displayName: string; socketId: string; pin?: string }): RoomStatePayload {
    const room = this.rooms.get(input.roomId);
    if (!room) throw new JoinChannelError('CHANNEL_NOT_FOUND', 'Channel không tồn tại.');

    if (room.pinHash) {
      if (!input.pin) throw new JoinChannelError('PIN_REQUIRED', 'Channel này cần mã PIN.');
      if (!timingSafeEqual(room.pinHash, hashPin(input.pin.trim()))) {
        throw new JoinChannelError('PIN_INVALID', 'Mã PIN không đúng.');
      }
    }

    const isRejoin = room.members.has(input.clientId);
    if (!isRejoin && room.members.size >= readConfig().maxMembersPerRoom) {
      throw new JoinChannelError('CHANNEL_FULL', 'Channel đã đầy.');
    }

    room.members.set(input.clientId, {
      clientId: input.clientId,
      displayName: input.displayName,
      socketId: input.socketId,
      lastHeartbeatAt: Date.now()
    });
    return this.snapshot(room);
  }

  /**
   * Rời channel. Chỉ xóa member nếu nó vẫn thuộc socket này: khi client kết nối lại,
   * socket mới có thể vào lại trước khi server xử lý disconnect của socket cũ.
   */
  leave(roomId: string, clientId: string, socketId: string): { state?: RoomStatePayload; released?: FloorReleasedPayload } {
    const room = this.rooms.get(roomId);
    const member = room?.members.get(clientId);
    if (!room || !member || member.socketId !== socketId) return {};

    room.members.delete(clientId);
    const released = room.floor?.clientId === clientId
      ? this.release(room, 'disconnected')
      : undefined;
    return { state: this.snapshot(room), released };
  }

  requestFloor(roomId: string, clientId: string): FloorRequestResult {
    const room = this.requireMember(roomId, clientId);
    this.expireRoomLease(room);

    if (room.floor) {
      return {
        granted: false,
        speakerClientId: room.floor.clientId,
        state: this.snapshot(room)
      };
    }

    const expiresAt = Date.now() + this.floorLeaseMs;
    const floorToken = randomUUID();
    room.floor = { clientId, token: floorToken, expiresAt };
    return { granted: true, floorToken, expiresAt, state: this.snapshot(room) };
  }

  releaseFloor(roomId: string, clientId: string, floorToken: string): FloorReleasedPayload | undefined {
    const room = this.requireMember(roomId, clientId);
    if (!room.floor || room.floor.clientId !== clientId || room.floor.token !== floorToken) {
      return undefined;
    }
    return this.release(room, 'released');
  }

  forceReleaseFloor(roomId: string): FloorReleasedPayload | undefined {
    const room = this.rooms.get(roomId);
    if (!room?.floor) return undefined;
    return this.release(room, 'force_released');
  }

  /** Quyền admin LAN: mã vận hành AUDIO_CONTROL_CODE do người chạy server đặt. */
  validateAdmin(controlCode?: string): boolean {
    const serverAdminCode = readConfig().audioControlCode;
    const trimmed = controlCode?.trim();
    if (!serverAdminCode || !trimmed) return false;
    const expected = Buffer.from(serverAdminCode);
    const provided = Buffer.from(trimmed);
    return expected.length === provided.length && timingSafeEqual(expected, provided);
  }

  heartbeat(roomId: string, clientId: string, floorToken?: string): boolean {
    const room = this.requireMember(roomId, clientId);
    const member = room.members.get(clientId)!;
    member.lastHeartbeatAt = Date.now();

    if (room.floor?.clientId === clientId && room.floor.token === floorToken) {
      room.floor.expiresAt = Date.now() + this.floorLeaseMs;
      return true;
    }
    return !room.floor;
  }

  /** Thêm tin chat của một thành viên; trả về tin đã chuẩn hóa để phát cho cả channel. */
  addChat(roomId: string, clientId: string, text: string): ChatMessage {
    const room = this.requireMember(roomId, clientId);
    const message: ChatMessage = {
      id: randomUUID(),
      roomId,
      clientId,
      displayName: room.members.get(clientId)!.displayName,
      text,
      at: Date.now()
    };
    room.chat.push(message);
    if (room.chat.length > CHAT_HISTORY_SIZE) room.chat.splice(0, room.chat.length - CHAT_HISTORY_SIZE);
    return message;
  }

  chatHistory(roomId: string): ChatMessage[] {
    return [...(this.rooms.get(roomId)?.chat ?? [])];
  }

  /** clientId đang giữ floor của channel (nếu lease còn hiệu lực). */
  currentSpeaker(roomId: string): string | undefined {
    const room = this.rooms.get(roomId);
    if (!room) return undefined;
    this.expireRoomLease(room);
    return room.floor?.clientId;
  }

  getFloorLeaseMs(): number {
    return this.floorLeaseMs;
  }

  getRoomState(roomId: string): RoomStatePayload | undefined {
    const room = this.rooms.get(roomId);
    return room ? this.snapshot(room) : undefined;
  }

  onModuleDestroy(): void {
    clearInterval(this.expiryTimer);
    this.events.removeAllListeners();
    this.rooms.clear();
  }

  private createRoom(channel: ChannelConfig): Room {
    return {
      roomId: channel.id,
      name: channel.name,
      color: channel.color,
      ...(channel.pin ? { pinHash: hashPin(channel.pin) } : {}),
      members: new Map(),
      chat: []
    };
  }

  private requireMember(roomId: string, clientId: string): Room {
    const room = this.rooms.get(roomId);
    if (!room || !room.members.has(clientId)) {
      throw new Error('Client is not an active member of this channel.');
    }
    return room;
  }

  private snapshot(room: Room): RoomStatePayload {
    return {
      roomId: room.roomId,
      phase: room.floor ? 'TALKING' : 'IDLE',
      speakerClientId: room.floor?.clientId,
      members: [...room.members.values()].map(({ clientId, displayName }) => ({ clientId, displayName }))
    };
  }

  private release(room: Room, reason: FloorReleasedPayload['reason']): FloorReleasedPayload | undefined {
    const floor = room.floor;
    if (!floor) return undefined;
    room.floor = undefined;
    const payload: FloorReleasedPayload = {
      roomId: room.roomId,
      previousSpeakerClientId: floor.clientId,
      reason
    };
    this.events.emit('floorReleased', { payload, floorToken: floor.token } satisfies FloorReleasedEvent);
    return payload;
  }

  private expireLeases(): void {
    for (const room of this.rooms.values()) this.expireRoomLease(room);
  }

  private expireRoomLease(room: Room): void {
    if (room.floor && room.floor.expiresAt <= Date.now()) {
      this.release(room, 'lease_expired');
    }
  }
}
