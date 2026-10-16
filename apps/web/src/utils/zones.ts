export interface VenueZone {
  id: string;
  name: string;
  shortName: string;
  x: number; // percentage 0 - 100
  y: number; // percentage 0 - 100
  recommendedDept?: string;
  color: string;
}

export const VENUE_ZONES: VenueZone[] = [
  {
    id: 'stage',
    name: 'Sân Khấu Chính',
    shortName: 'Sân Khấu',
    x: 50,
    y: 18,
    recommendedDept: 'bcn',
    color: '#f59e0b'
  },
  {
    id: 'backstage',
    name: 'Khu Hậu Trường',
    shortName: 'Hậu Trường',
    x: 82,
    y: 22,
    recommendedDept: 'bcn',
    color: '#f97316'
  },
  {
    id: 'foh',
    name: 'Bàn Kỹ Thuật (FOH)',
    shortName: 'Bàn Kỹ Thuật',
    x: 50,
    y: 82,
    recommendedDept: 'dev',
    color: '#0ea5e9'
  },
  {
    id: 'logistics',
    name: 'Kho Hậu Cần & Đạo Cụ',
    shortName: 'Hậu Cần',
    x: 18,
    y: 35,
    recommendedDept: 'logistics',
    color: '#10b981'
  },
  {
    id: 'checkin',
    name: 'Cổng Đón Tiếp (Check-in)',
    shortName: 'Cổng Đón Tiếp',
    x: 18,
    y: 82,
    recommendedDept: 'media',
    color: '#a855f7'
  },
  {
    id: 'hall',
    name: 'Khán Phòng / Giữa Hội Trường',
    shortName: 'Khán Phòng',
    x: 50,
    y: 50,
    recommendedDept: 'media',
    color: '#e2e8f0'
  }
];

export function getDefaultPositionForDept(deptId?: string): { x: number; y: number; zone: string } {
  if (deptId === 'bcn') {
    return { x: 50, y: 18, zone: 'Sân Khấu' };
  }
  if (deptId === 'dev') {
    return { x: 50, y: 82, zone: 'Bàn Kỹ Thuật' };
  }
  if (deptId === 'logistics') {
    return { x: 18, y: 35, zone: 'Hậu Cần' };
  }
  if (deptId === 'media') {
    return { x: 18, y: 82, zone: 'Cổng Đón Tiếp' };
  }
  return { x: 50, y: 50, zone: 'Khán Phòng' };
}

