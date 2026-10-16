import React, { useRef } from 'react';
import type { Position2D } from '../../types';
import { VENUE_ZONES, type VenueZone } from '../../utils/zones';
import { getDepartmentConfig } from '../../utils/departments';
import { MapPin, Navigation, Crosshair, Crown, Mic, Wifi, Radio, Signal, Compass } from 'lucide-react';

export interface MemberOnMap {
  clientId: string;
  displayName: string;
  department?: string;
  position?: Position2D;
  isAdmin?: boolean;
}

export interface TacticalMapFrameProps {
  currentClientId?: string;
  myPosition: Position2D;
  members?: MemberOnMap[];
  speakerClientId?: string;
  onPositionChange: (nextPos: Position2D) => void;
  readOnly?: boolean;
  className?: string;
}

export function TacticalMapFrame({
  currentClientId,
  myPosition,
  members = [],
  speakerClientId,
  onPositionChange,
  readOnly = false,
  className = ''
}: TacticalMapFrameProps) {
  const mapRef = useRef<HTMLDivElement>(null);

  // Calculate real-world simulated distance in meters from Central Hotspot (50%, 50%)
  // Standard venue scale: 30m wide (horizontal) x 50m deep (vertical)
  const distPercent = Math.hypot(myPosition.x - 50, myPosition.y - 50);
  const myDistanceMeters = Math.max(1, Math.min(50, Math.round((distPercent / 42) * 50)));

  let signalTierText = 'Tối ưu (< 15m)';
  let signalColor = 'text-emerald-400';
  let signalBadgeClass = 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300';
  let signalStrength = '98%';

  if (myDistanceMeters > 35) {
    signalTierText = 'Rìa sóng (35m - 50m)';
    signalColor = 'text-rose-400';
    signalBadgeClass = 'bg-rose-500/15 border-rose-500/40 text-rose-300';
    signalStrength = `${Math.max(40, 75 - (myDistanceMeters - 35) * 2)}%`;
  } else if (myDistanceMeters > 20) {
    signalTierText = 'Ổn định (20m - 35m)';
    signalColor = 'text-amber-400';
    signalBadgeClass = 'bg-amber-500/15 border-amber-500/40 text-amber-300';
    signalStrength = `${Math.max(70, 92 - (myDistanceMeters - 20) * 1.4)}%`;
  }

  function updatePositionFromCoords(rawX: number, rawY: number) {
    const x = Math.max(5, Math.min(95, Math.round(rawX)));
    const y = Math.max(5, Math.min(95, Math.round(rawY)));

    let closestZone = 'Vị trí tự do';
    let minDistance = Infinity;

    for (const zone of VENUE_ZONES) {
      const dist = Math.hypot(x - zone.x, y - zone.y);
      if (dist < minDistance && dist < 18) {
        minDistance = dist;
        closestZone = zone.name;
      }
    }

    onPositionChange({ x, y, zone: closestZone });
  }

  function handleMapClick(e: React.MouseEvent<HTMLDivElement>) {
    if (readOnly || !mapRef.current) return;
    const rect = mapRef.current.getBoundingClientRect();
    const rawX = ((e.clientX - rect.left) / rect.width) * 100;
    const rawY = ((e.clientY - rect.top) / rect.height) * 100;
    updatePositionFromCoords(rawX, rawY);
  }

  function handleQuickZoneSelect(zone: VenueZone) {
    if (readOnly) return;
    onPositionChange({
      x: zone.x,
      y: zone.y,
      zone: zone.name
    });
  }

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {/* Real-time Distance & Telemetry Ribbon */}
      <div className="flex items-center justify-between p-2.5 sm:p-3 rounded-2xl bg-slate-900/90 border border-white/10 backdrop-blur-xl shadow-lg">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-orange-500/15 border border-orange-500/40 flex items-center justify-center text-orange-400 shrink-0 shadow-inner">
            <Compass className="w-4 h-4 sm:w-5 sm:h-5 animate-spin-slow" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[0.62rem] sm:text-[0.68rem] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5 truncate">
              <span>ĐỊNH VỊ BỘ ĐÀM</span>
              <span className="text-slate-600">•</span>
              <span className="text-orange-400 font-mono">BÁN KÍNH 50M</span>
            </span>
            <span className="text-xs sm:text-sm font-black text-white truncate flex items-center gap-1.5">
              <span>{myPosition.zone || 'Khu vực tự do'}</span>
              <span className="text-slate-500 text-[0.65rem] font-mono">({myPosition.x}%, {myPosition.y}%)</span>
            </span>
          </div>
        </div>

        {/* Distance Badge & Link Quality */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex flex-col items-end">
            <span className="text-xs sm:text-sm font-black font-mono text-orange-400">
              ~{myDistanceMeters}m
            </span>
            <span className={`text-[0.6rem] font-bold ${signalColor} flex items-center gap-0.5`}>
              <Signal className="w-2.5 h-2.5" /> {signalStrength}
            </span>
          </div>
          <div className={`hidden sm:flex px-2 py-1 rounded-lg text-[0.65rem] font-bold border ${signalBadgeClass}`}>
            {signalTierText}
          </div>
        </div>
      </div>

      {/* Main Tactical Radar Simulation Map */}
      <div
        ref={mapRef}
        onClick={handleMapClick}
        className={`relative w-full aspect-[4/3] sm:aspect-[16/10] rounded-3xl border-2 border-orange-500/30 bg-slate-950 overflow-hidden shadow-2xl select-none ${
          readOnly ? 'cursor-default' : 'cursor-crosshair'
        }`}
        style={{
          backgroundImage: `
            radial-gradient(circle at 50% 50%, rgba(249, 115, 22, 0.08) 0%, transparent 70%),
            linear-gradient(to right, rgba(255, 255, 255, 0.04) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.04) 1px, transparent 1px)
          `,
          backgroundSize: '100% 100%, 24px 24px, 24px 24px'
        }}
      >
        {/* Animated Sweep Radar Beam */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-center">
          <div className="w-[180%] h-[180%] rounded-full opacity-20 animate-radar-sweep origin-center bg-[conic-gradient(from_0deg,transparent_0deg,transparent_270deg,rgba(249,115,22,0.6)_360deg)]" />
        </div>

        {/* Circular Range Rings (30m - 50m Scale Simulation) */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          {/* 50m Max Edge Ring */}
          <div className="absolute w-[92%] h-[92%] rounded-full border border-dashed border-rose-500/30 flex items-center justify-center">
            <span className="absolute top-1 text-[0.55rem] font-mono text-rose-400/70 bg-slate-950/80 px-1 rounded">50m Max Range</span>
          </div>
          {/* 30m Working Boundary */}
          <div className="absolute w-[68%] h-[68%] rounded-full border border-orange-500/30 flex items-center justify-center">
            <span className="absolute top-1 text-[0.55rem] font-mono text-orange-400/80 bg-slate-950/80 px-1 rounded">30m Ranh Giới Chuẩn</span>
          </div>
          {/* 20m Stable Zone */}
          <div className="absolute w-[46%] h-[46%] rounded-full border border-amber-500/25 flex items-center justify-center">
            <span className="absolute top-1 text-[0.52rem] font-mono text-amber-400/70 bg-slate-950/80 px-1 rounded">20m</span>
          </div>
          {/* 10m High Quality Core */}
          <div className="absolute w-[24%] h-[24%] rounded-full border border-emerald-500/30 flex items-center justify-center">
            <span className="absolute top-1 text-[0.5rem] font-mono text-emerald-400/80 bg-slate-950/80 px-1 rounded">10m Core</span>
          </div>
        </div>

        {/* Central Wi-Fi / Hotspot Base Marker (0m Reference) */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex flex-col items-center z-10">
          <div className="relative flex items-center justify-center">
            <div className="w-8 h-8 rounded-full bg-orange-500/20 border border-orange-500/60 flex items-center justify-center text-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.4)]">
              <Wifi className="w-4 h-4" />
            </div>
            <span className="absolute w-12 h-12 rounded-full border border-orange-500/40 animate-ping opacity-30" />
          </div>
          <span className="mt-1 px-1.5 py-0.2 rounded bg-slate-900/90 border border-orange-500/40 text-[0.55rem] font-bold font-mono text-orange-300 whitespace-nowrap shadow-sm">
            HOTSPOT TRUNG TÂM (0m)
          </span>
        </div>

        {/* Predefined Venue Zones */}
        {VENUE_ZONES.map((zone) => {
          const isCurrentZone = myPosition.zone === zone.name;

          return (
            <div
              key={zone.id}
              onClick={(e) => {
                e.stopPropagation();
                handleQuickZoneSelect(zone);
              }}
              style={{ left: `${zone.x}%`, top: `${zone.y}%` }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center transition-transform hover:scale-110 ${
                readOnly ? 'pointer-events-none' : 'cursor-pointer'
              }`}
            >
              <div
                className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center border shadow-md transition-all ${
                  isCurrentZone
                    ? 'bg-orange-500 text-white border-white scale-110 shadow-[0_0_14px_rgba(249,115,22,0.6)]'
                    : 'bg-slate-900/90 text-slate-300 border-white/20 hover:border-orange-400'
                }`}
                style={{ borderColor: isCurrentZone ? '#ffffff' : zone.color }}
              >
                <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4" style={{ color: isCurrentZone ? '#ffffff' : zone.color }} />
              </div>
              <span
                className={`mt-1 px-1.5 py-0.5 rounded text-[0.55rem] sm:text-[0.62rem] font-bold tracking-tight whitespace-nowrap border shadow-sm backdrop-blur-md ${
                  isCurrentZone
                    ? 'bg-orange-500/90 border-white text-white'
                    : 'bg-slate-950/80 border-white/10 text-slate-300'
                }`}
              >
                {zone.shortName}
              </span>
            </div>
          );
        })}

        {/* Other Members Markers */}
        {members
          .filter((m) => m.clientId !== currentClientId && m.position)
          .map((m) => {
            const isSpeaker = m.clientId === speakerClientId;
            const deptConfig = getDepartmentConfig(m.department);

            return (
              <div
                key={m.clientId}
                style={{ left: `${m.position!.x}%`, top: `${m.position!.y}%` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center pointer-events-none transition-all duration-300"
              >
                <div
                  className={`relative w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-[0.6rem] font-bold border-2 shadow-lg ${
                    isSpeaker
                      ? 'bg-rose-500 border-rose-300 text-white scale-125 shadow-[0_0_16px_rgba(244,63,94,0.8)] animate-pulse'
                      : `bg-slate-900 ${deptConfig.borderClass} text-slate-200`
                  }`}
                >
                  {m.displayName.slice(0, 2).toUpperCase()}
                  {m.isAdmin && (
                    <Crown className="absolute -top-1.5 -right-1.5 w-3 h-3 text-amber-400 drop-shadow" />
                  )}
                  {isSpeaker && (
                    <Mic className="absolute -bottom-1 -right-1 w-3 h-3 text-white bg-rose-600 rounded-full p-0.5" />
                  )}
                </div>
                <span className="mt-1 px-1.5 py-0.2 rounded bg-slate-950/90 border border-white/10 text-[0.55rem] font-bold text-slate-300 whitespace-nowrap shadow">
                  {m.displayName}
                </span>
              </div>
            );
          })}

        {/* My Position Marker (Highlighted with High Visibility Beacon) */}
        <div
          style={{ left: `${myPosition.x}%`, top: `${myPosition.y}%` }}
          className="absolute -translate-x-1/2 -translate-y-1/2 z-30 flex flex-col items-center pointer-events-none transition-all duration-200"
        >
          <div className="relative flex items-center justify-center">
            {/* Pulsing Beacon Wave */}
            <span className="absolute w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-cyan-400/40 animate-ping" />
            <span className="absolute w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-orange-500/40 animate-pulse" />

            {/* Core Badge */}
            <div className="relative w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-tr from-orange-600 to-cyan-500 border-2 border-white flex items-center justify-center text-white shadow-[0_0_20px_rgba(6,182,212,0.8)]">
              <Crosshair className="w-4 h-4 sm:w-4.5 sm:h-4.5 animate-spin-slow" />
            </div>
          </div>

          {/* Prominent Label */}
          <div className="mt-1.5 flex flex-col items-center">
            <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-orange-600 to-cyan-600 border border-white/80 text-[0.58rem] sm:text-[0.65rem] font-black tracking-wider text-white uppercase whitespace-nowrap shadow-xl">
              VỊ TRÍ CỦA BẠN (~{myDistanceMeters}m)
            </span>
          </div>
        </div>

        {/* Legend Overlay at Bottom */}
        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between pointer-events-none text-[0.6rem] font-mono text-slate-400 bg-slate-950/80 p-1.5 px-2.5 rounded-xl border border-white/10 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" /> Bạn
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-rose-500" /> Đang nói
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-orange-500" /> Hotspot 0m
            </span>
          </div>
          <span className="hidden min-[460px]:inline text-slate-500">
            {readOnly ? 'Chế độ xem sơ đồ' : 'Chạm/Click để đổi vị trí của bạn'}
          </span>
        </div>
      </div>

      {/* Quick Location Pills */}
      {!readOnly && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[0.65rem] font-bold uppercase tracking-wider text-slate-400">
            Chọn nhanh vị trí công tác:
          </span>
          <div className="grid grid-cols-2 min-[420px]:grid-cols-3 sm:grid-cols-6 gap-1.5">
            {VENUE_ZONES.map((zone) => {
              const active = myPosition.zone === zone.name;

              return (
                <button
                  key={zone.id}
                  type="button"
                  onClick={() => handleQuickZoneSelect(zone)}
                  className={`flex items-center justify-center gap-1 p-1.5 sm:p-2 rounded-xl border text-[0.65rem] sm:text-xs font-bold transition cursor-pointer truncate ${
                    active
                      ? 'bg-orange-500 text-white border-white shadow-md shadow-orange-500/30'
                      : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border-white/10'
                  }`}
                >
                  <MapPin className="w-3 h-3 shrink-0" style={{ color: active ? '#ffffff' : zone.color }} />
                  <span className="truncate">{zone.shortName}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

