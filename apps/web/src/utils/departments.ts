import React from 'react';
import { Crown, Code2, Megaphone, Boxes } from 'lucide-react';

export type DepartmentId = 'bcn' | 'dev' | 'media' | 'logistics';

export interface DepartmentConfig {
  id: DepartmentId;
  name: string;
  shortName: string;
  badgeLabel: string;
  description: string;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeClass: string;
  borderClass: string;
  glowClass: string;
  activeBg: string;
}

export const DEPARTMENTS: Record<DepartmentId, DepartmentConfig> = {
  bcn: {
    id: 'bcn',
    name: 'Ban Chủ nhiệm',
    shortName: 'BCN',
    badgeLabel: 'Chủ nhiệm',
    description: 'Điều phối & quản lý chung',
    color: '#f59e0b',
    icon: Crown,
    badgeClass: 'bg-amber-500/15 border-amber-500/40 text-amber-300',
    borderClass: 'border-amber-500',
    glowClass: 'shadow-amber-500/30',
    activeBg: 'from-amber-500/20 to-yellow-600/20'
  },
  dev: {
    id: 'dev',
    name: 'Ban Lập trình',
    shortName: 'Lập trình',
    badgeLabel: 'Lập trình',
    description: 'Phát triển phần mềm & kỹ thuật',
    color: '#0ea5e9',
    icon: Code2,
    badgeClass: 'bg-sky-500/15 border-sky-500/40 text-sky-300',
    borderClass: 'border-sky-500',
    glowClass: 'shadow-sky-500/30',
    activeBg: 'from-sky-500/20 to-blue-600/20'
  },
  media: {
    id: 'media',
    name: 'Ban Truyền thông',
    shortName: 'Truyền thông',
    badgeLabel: 'Truyền thông',
    description: 'Hình ảnh, tin tức & sự kiện',
    color: '#a855f7',
    icon: Megaphone,
    badgeClass: 'bg-purple-500/15 border-purple-500/40 text-purple-300',
    borderClass: 'border-purple-500',
    glowClass: 'shadow-purple-500/30',
    activeBg: 'from-purple-500/20 to-pink-600/20'
  },
  logistics: {
    id: 'logistics',
    name: 'Ban Hậu cần',
    shortName: 'Hậu cần',
    badgeLabel: 'Hậu cần',
    description: 'Hỗ trợ thiết bị, hậu cần & vận hành',
    color: '#10b981',
    icon: Boxes,
    badgeClass: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300',
    borderClass: 'border-emerald-500',
    glowClass: 'shadow-emerald-500/30',
    activeBg: 'from-emerald-500/20 to-teal-600/20'
  }
};

export const DEPARTMENT_LIST: DepartmentConfig[] = Object.values(DEPARTMENTS);

export function getDepartmentConfig(id?: string): DepartmentConfig {
  if (id && id in DEPARTMENTS) {
    return DEPARTMENTS[id as DepartmentId];
  }
  return DEPARTMENTS.dev;
}

