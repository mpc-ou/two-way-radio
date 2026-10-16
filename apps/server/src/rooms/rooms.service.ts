import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { readConfig } from '../config/config.js';
import type { FloorReleasedPayload, Position2D, RoomStatePayload } from '@mpc-voicelink/protocol';

interface Member {
  clientId: string;
  displayName: string;
  department?: string;
  position?: Position2D;
  socketId: string;
  lastHeartbeatAt: number;
}

interface FloorLease {
  clientId: string;
  token: string;
  expiresAt: number;
}

interface Room {
  roomId: string;
  creatorClientId: string;
  joinCode?: string;
  members: Map<string, Member>;
  floor?: FloorLease;
}

export type FloorRequestResult =
  | { granted: true; floorToken: string; expiresAt: number; state: RoomStatePayload }
  | { granted: false; speakerClientId?: string; state: RoomStatePayload };

export interface FloorReleasedEvent {
  payload: FloorReleasedPayload;
  floorToken: string;
}

@Injectable()
export class RoomsService implements OnModuleDestroy {
  private readonly rooms = new Map<string, Room>();
  private readonly events = new EventEmitter();
  private readonly floorLeaseMs = readConfig().floorLeaseMs;
  private readonly expiryTimer = setInterval(() => this.expireLeases(), 250);

  constructor() {
    this.expiryTimer.unref();
  }

  onFloorReleased(listener: (event: FloorReleasedEvent) => void): void {
    this.events.on('floorReleased', listener);
  }

  join(input: { roomId: string; clientId: string; displayName: string; socketId: string; joinCode?: string; department?: string; position?: Position2D }): RoomStatePayload {
    const config = readConfig();
    const existing = this.rooms.get(input.roomId);
    if (!existing) {
      const roomJoinCode = input.joinCode?.trim() || config.roomJoinCode;
      const room: Room = {
        roomId: input.roomId,
        creatorClientId: input.clientId,
        joinCode: roomJoinCode,
        members: new Map()
      };
      this.rooms.set(input.roomId, room);
      room.members.set(input.clientId, {
        clientId: input.clientId,
        displayName: input.displayName,
        department: input.department,
        position: input.position,
        socketId: input.socketId,
        lastHeartbeatAt: Date.now()
      });
      return this.snapshot(room);
    }

    const providedCode = input.joinCode?.trim() ?? '';
    const roomCode = existing.joinCode ?? config.roomJoinCode;
    const isMasterCode = Boolean(config.roomJoinCode && providedCode === config.roomJoinCode);
    const isRoomCode = Boolean(roomCode && providedCode === roomCode);

    if (roomCode && !isRoomCode && !isMasterCode) {
      throw new Error('Mã phòng không chính xác.');
    }

    existing.members.set(input.clientId, {
      clientId: input.clientId,
      displayName: input.displayName,
      department: input.department,
      position: input.position ?? existing.members.get(input.clientId)?.position,
      socketId: input.socketId,
      lastHeartbeatAt: Date.now()
    });
    return this.snapshot(existing);
  }

  updatePosition(roomId: string, clientId: string, position: Position2D): RoomStatePayload {
    const room = this.requireMember(roomId, clientId);
    const member = room.members.get(clientId);
    if (member) {
      member.position = position;
    }
    return this.snapshot(room);
  }

  leave(roomId: string, clientId: string): { state?: RoomStatePayload; released?: FloorReleasedPayload } {
    const room = this.rooms.get(roomId);
    if (!room) return {};

    room.members.delete(clientId);
    const released = room.floor?.clientId === clientId
      ? this.release(room, 'disconnected')
      : undefined;
    const state = room.members.size > 0 ? this.snapshot(room) : undefined;
    if (room.members.size === 0) this.rooms.delete(roomId);
    return { state, released };
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

  forceReleaseFloor(roomId: string): { released?: FloorReleasedPayload; floorToken?: string; state?: RoomStatePayload } {
    const room = this.rooms.get(roomId);
    if (!room || !room.floor) return {};
    const floorToken = room.floor.token;
    const released = this.release(room, 'force_released');
    const state = this.snapshot(room);
    return { released, floorToken, state };
  }

  validateAdmin(roomId: string, clientId: string, controlCode?: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;
    // 1. The room creator is always Admin!
    if (room.creatorClientId === clientId) return true;

    const config = readConfig();
    const trimmed = controlCode?.trim();
    if (!trimmed) return false;

    // 2. Configured or default audioControlCode
    const serverAdminCode = config.audioControlCode || 'admin123';
    if (trimmed === serverAdminCode) return true;

    // 3. Room join code or master code
    if (room.joinCode && trimmed === room.joinCode) return true;
    if (config.roomJoinCode && trimmed === config.roomJoinCode) return true;

    return false;
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

  isCurrentFloorHolder(roomId: string, clientId: string, floorToken: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;
    this.expireRoomLease(room);
    return room.floor?.clientId === clientId && room.floor.token === floorToken;
  }

  getFloorLeaseMs(): number {
    return this.floorLeaseMs;
  }

  getRoomState(roomId: string): RoomStatePayload | undefined {
    const room = this.rooms.get(roomId);
    if (!room) return undefined;
    return this.snapshot(room);
  }

  onModuleDestroy(): void {
    clearInterval(this.expiryTimer);
    this.events.removeAllListeners();
    this.rooms.clear();
  }

  private requireMember(roomId: string, clientId: string): Room {
    const room = this.rooms.get(roomId);
    if (!room || !room.members.has(clientId)) {
      throw new Error('Client is not an active member of this room.');
    }
    return room;
  }

  private snapshot(room: Room): RoomStatePayload {
    return {
      roomId: room.roomId,
      creatorClientId: room.creatorClientId,
      phase: room.floor ? 'TALKING' : 'IDLE',
      speakerClientId: room.floor?.clientId,
      members: [...room.members.values()].map(({ clientId, displayName, department, position }) => ({
        clientId,
        displayName,
        department,
        position,
        isAdmin: clientId === room.creatorClientId
      }))
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
