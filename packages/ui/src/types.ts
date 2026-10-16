import type { DepartmentId } from './utils/departments';

export type PttPhase = 'IDLE' | 'REQUESTING' | 'TALKING' | 'RELEASING';

export interface Position2D {
  x: number; // 0 - 100 percentage
  y: number; // 0 - 100 percentage
  zone?: string;
}

export interface AudioMetrics {
  inputLevel: number;
  roundTripMs?: number;
  inboundJitterMs?: number;
  inboundPacketsLost?: number;
}

export interface ConnectionSettings {
  serverUrl: string;
  roomId: string;
  displayName: string;
  joinCode: string;
  department?: DepartmentId;
  position?: Position2D;
}

