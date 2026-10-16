import type { ConnectionSettings, Position2D } from '../types';
import type { DepartmentId } from './departments';
import { getDefaultPositionForDept } from './zones';

export function defaultServerUrl(): string {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'http://localhost:3000';
}

export function getInitialSettings(): ConnectionSettings {
  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const urlRoom = params?.get('room');
  const urlCode = params?.get('code');
  const urlDept = params?.get('dept') as DepartmentId | null;
  const savedName = typeof localStorage !== 'undefined' ? localStorage.getItem('mpc_name') || '' : '';
  const savedRoom = typeof localStorage !== 'undefined' ? localStorage.getItem('mpc_room') || '' : '';
  const savedCode = typeof localStorage !== 'undefined' ? localStorage.getItem('mpc_code') || '' : '';
  const savedDept = (typeof localStorage !== 'undefined' ? localStorage.getItem('mpc_department') : null) as DepartmentId | null;
  
  let savedPos: Position2D | undefined = undefined;
  if (typeof localStorage !== 'undefined') {
    try {
      const rawPos = localStorage.getItem('mpc_position');
      if (rawPos) savedPos = JSON.parse(rawPos);
    } catch {}
  }

  const dept = urlDept || savedDept || 'dev';

  return {
    serverUrl: defaultServerUrl(),
    roomId: (urlRoom || savedRoom || 'MPC-01').trim(),
    displayName: savedName.trim(),
    joinCode: (urlCode || savedCode || '1234').trim(),
    department: dept,
    position: savedPos || getDefaultPositionForDept(dept)
  };
}

export function saveSettings(settings: ConnectionSettings): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('mpc_name', settings.displayName.trim());
    localStorage.setItem('mpc_room', settings.roomId.trim());
    localStorage.setItem('mpc_code', settings.joinCode.trim());
    if (settings.department) {
      localStorage.setItem('mpc_department', settings.department);
    }
    if (settings.position) {
      localStorage.setItem('mpc_position', JSON.stringify(settings.position));
    }
  }
}
