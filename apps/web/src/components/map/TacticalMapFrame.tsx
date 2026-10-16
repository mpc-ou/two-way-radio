import React, { useRef } from 'react';
import type { Position2D } from '../../types';
import { VENUE_ZONES, type VenueZone } from '../../utils/zones';
import { getDepartmentConfig } from '../../utils/departments';
import { MapPin, Navigation, Crosshair, Crown, Mic, Wifi, Radio, Signal, Compass } from 'lucide-react';

interface MemberOnMap {
  clientId: string;
  displayName: string;
  department?: string;
  position?: Position2D;
  isAdmin?: boolean;
}

interface TacticalMapFrameProps {
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

    // Find closest zone
    let closestZone: VenueZone | undefined;
    let minDistance = Infinity;
    for (const z of VENUE_ZONES) {
      const dist = Math.hypot(z.x - x, z.y - y);
      if (dist < minDistance) {
        minDistance = dist;
        closestZone = z;
      }
    }

    const zoneName = minDistance <= 25 && closestZone ? closestZone.name : 'Tọa độ tự do';
    onPositionChange({ x, y, zone: zoneName });
  }

  function handleMapClick(e: React.MouseEvent<HTMLDivElement>) {
    if (readOnly || !mapRef.current) return;
    const rect = mapRef.current.getBoundingClientRect();
    const rawX = ((e.clientX - rect.left) / rect.width) * 100;
    const rawY = ((e.clientY - rect.top) / rect.height) * 100;
    updatePositionFromCoords(rawX, rawY);
  }

  function handleMapTouch(e: React.TouchEvent<HTMLDivElement>) {
    if (readOnly || !mapRef.current || e.touches.length === 0) return;
    const touch = e.touches[0];
    const rect = mapRef.current.getBoundingClientRect();
    const rawX = ((touch.clientX - rect.left) / rect.width) * 100;
    const rawY = ((touch.clientY - rect.top) / rect.height) * 100;
    updatePositionFromCoords(rawX, rawY);
  }

  return (
    <div className={`flex flex-col gap-2.5 sm:gap-3 ${className}`}>
      {/* 30m - 50m Tactical Distance Status Bar */}
      <div className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-900/90 border border-white/10 text-xs shadow-sm">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400 shrink-0">
            <Radio className="w-3.5 h-3.5" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[0.65rem] text-slate-400 font-medium">Bản đồ mô phỏng phủ sóng:</span>
            <span className="text-xs font-black text-white truncate flex items-center gap-1.5">
              <span>Hội Trường 30m × 50m</span>
              <span className="text-[0.6rem] font-mono text-emerald-400">• LAN 2.4GHz</span>
            </span>
          </div>
        </div>

        {/* Live Distance & Signal Badge for Self */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`px-2.5 py-1 rounded-xl text-[0.68rem] font-bold border font-mono flex items-center gap-1 shadow-sm ${signalBadgeClass}`}>
            <Signal className="w-3 h-3" />
            <span>~{myDistanceMeters}m ({signalStrength})</span>
          </span>
        </div>
      </div>

      {/* Quick Zone Selection Chips */}
      {!readOnly && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 font-bold text-slate-300 text-[0.72rem] sm:text-xs">
              <Crosshair className="w-3.5 h-3.5 text-orange-400" />
              Chọn nhanh vị trí trên bản đồ:
            </span>
            <span className="text-[0.65rem] sm:text-[0.68rem] font-mono text-orange-400 font-bold truncate max-w-[140px] sm:max-w-none text-right">
              {myPosition.zone || 'Tọa độ tự do'} (~{myDistanceMeters}m)
            </span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {VENUE_ZONES.map((zone) => {
              const isCurrent = myPosition.zone === zone.name;
              return (
                <button
                  key={zone.id}
                  type="button"
                  onClick={() => onPositionChange({ x: zone.x, y: zone.y, zone: zone.name })}
                  className={`px-2.5 py-1.5 rounded-xl text-[0.68rem] sm:text-xs font-bold whitespace-nowrap transition border cursor-pointer shrink-0 ${
                    isCurrent
                      ? 'bg-orange-500/20 border-orange-500 text-orange-300 shadow-md shadow-orange-500/20'
                      : 'bg-slate-900/80 border-white/10 text-slate-400 hover:text-white hover:border-white/20'
                  }`}
                >
                  {zone.shortName}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* The 30m - 50m Tactical Canvas Map Frame */}
      <div
        ref={mapRef}
        onClick={handleMapClick}
        onTouchStart={handleMapTouch}
        onTouchMove={handleMapTouch}
        className={`relative w-full aspect-[16/11] sm:aspect-[16/9] rounded-2xl bg-slate-950 border border-orange-500/40 overflow-hidden shadow-2xl select-none touch-none ${
          !readOnly ? 'cursor-crosshair' : 'cursor-default'
        }`}
        style={{
          backgroundImage: `
            radial-gradient(circle at 50% 50%, rgba(249, 115, 22, 0.08) 0%, transparent 65%),
            linear-gradient(to right, rgba(255, 255, 255, 0.04) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.04) 1px, transparent 1px)
          `,
          backgroundSize: '100% 100%, 28px 28px, 28px 28px'
        }}
      >
        {/* Sci-fi Corner Target Brackets */}
        <span className="absolute top-2 left-2 w-3.5 h-3.5 border-t-2 border-l-2 border-orange-500 pointer-events-none z-10" />
        <span className="absolute top-2 right-2 w-3.5 h-3.5 border-t-2 border-r-2 border-orange-500 pointer-events-none z-10" />
        <span className="absolute bottom-2 left-2 w-3.5 h-3.5 border-b-2 border-l-2 border-orange-500 pointer-events-none z-10" />
        <span className="absolute bottom-2 right-2 w-3.5 h-3.5 border-b-2 border-r-2 border-orange-500 pointer-events-none z-10" />

        {/* 360° Dynamic Rotating Radar Sweep Line Beam */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[84%] h-[84%] rounded-full animate-radar-sweep opacity-30 pointer-events-none"
            style={{
              background: 'conic-gradient(from 0deg, rgba(249,115,22,0.4) 0deg, rgba(249,115,22,0.05) 45deg, transparent 90deg, transparent 360deg)'
            }}
          />
        </div>

        {/* Concentric Distance Rings: 10m, 20m, 30m, 50m */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {/* Ring 10m */}
          <div className="w-[20%] h-[20%] rounded-full border border-emerald-500/25 flex items-center justify-center">
            <span className="text-[0.52rem] text-emerald-400/70 font-mono -mt-5 bg-slate-950/80 px-1 rounded">10m</span>
          </div>

          {/* Ring 20m */}
          <div className="absolute w-[40%] h-[40%] rounded-full border border-emerald-500/20 flex items-center justify-center">
            <span className="text-[0.52rem] text-emerald-400/60 font-mono -mt-11 bg-slate-950/80 px-1 rounded">20m (Tối ưu)</span>
          </div>

          {/* Ring 30m */}
          <div className="absolute w-[62%] h-[62%] rounded-full border border-amber-500/25 flex items-center justify-center">
            <span className="text-[0.55rem] text-amber-400/80 font-mono -mt-16 sm:-mt-20 bg-slate-950/80 px-1 rounded font-bold">30m Hội Trường</span>
          </div>

          {/* Ring 50m (Max Wi-Fi Range) */}
          <div className="absolute w-[86%] h-[86%] rounded-full border border-rose-500/30 flex items-center justify-center">
            <span className="text-[0.55rem] text-rose-400/90 font-mono -mt-24 sm:-mt-28 bg-slate-950/80 px-1.5 py-0.2 rounded font-black border border-rose-500/40">
              50m (Rìa Phủ Sóng Max)
            </span>
          </div>

          {/* Axis Crosshairs */}
          <div className="absolute w-full h-[1px] bg-orange-500/15" />
          <div className="absolute h-full w-[1px] bg-orange-500/15" />
        </div>

        {/* Central Wi-Fi Hotspot Station Marker (0m Anchor) */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none z-10">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center text-emerald-300 shadow-[0_0_16px_rgba(16,185,129,0.5)]">
            <Wifi className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
          </div>
          <span className="mt-0.5 px-1.5 py-0.2 rounded bg-slate-950/90 border border-emerald-500/40 text-[0.55rem] font-bold text-emerald-400 font-mono whitespace-nowrap shadow-md">
            HOTSPOT (0M)
          </span>
        </div>

        {/* Static Simulated Venue Landmarks (30m x 50m Area) */}
        {VENUE_ZONES.map((zone) => (
          <div
            key={zone.id}
            style={{ left: `${zone.x}%`, top: `${zone.y}%` }}
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none flex flex-col items-center opacity-70 hover:opacity-100 transition"
          >
            <div className="px-2 py-0.5 rounded-lg border border-dashed border-slate-500/60 bg-slate-950/70 flex items-center justify-center shadow-sm">
              <span className="text-[0.55rem] sm:text-[0.62rem] font-bold text-slate-300 tracking-tight text-center whitespace-nowrap">
                {zone.shortName}
              </span>
            </div>
          </div>
        ))}

        {/* Other Room Members' Pins */}
        {members
          .filter((m) => m.clientId !== currentClientId && m.position)
          .map((m) => {
            const isSpeaker = m.clientId === speakerClientId;
            const deptConfig = getDepartmentConfig(m.department);
            const pos = m.position!;

            return (
              <div
                key={m.clientId}
                style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center pointer-events-none transition-all duration-300"
              >
                {/* Active Sonar Ring if Speaking */}
                {isSpeaker && (
                  <div className="absolute -inset-3 rounded-full bg-rose-500/25 border-2 border-rose-500 animate-ping pointer-events-none" />
                )}

                {/* Avatar Pin */}
                <div
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-[0.62rem] sm:text-xs font-bold text-white shadow-lg border-2 ${
                    isSpeaker
                      ? 'bg-rose-500 border-white shadow-rose-500/60 scale-110'
                      : `bg-slate-900 ${deptConfig.borderClass} shadow-black`
                  }`}
                >
                  {m.displayName.slice(0, 2).toUpperCase()}
                </div>

                {/* Member Label Tag */}
                <div className="mt-1 px-1.5 py-0.5 rounded-md bg-slate-950/90 border border-white/10 text-[0.6rem] font-bold text-slate-200 whitespace-nowrap shadow-md flex items-center gap-1">
                  {isSpeaker && <Mic className="w-2.5 h-2.5 text-rose-400 animate-pulse" />}
                  <span>{m.displayName}</span>
                  <span className={`text-[0.55rem] px-1 rounded ${deptConfig.badgeClass}`}>
                    {deptConfig.shortName}
                  </span>
                </div>
              </div>
            );
          })}

        {/* ================= VỊ TRÍ CỦA CHÍNH BẢN THÂN MÌNH (YOUR POSITION BEACON) ================= */}
        <div
          style={{ left: `${myPosition.x}%`, top: `${myPosition.y}%` }}
          className="absolute -translate-x-1/2 -translate-y-1/2 z-30 flex flex-col items-center pointer-events-none transition-all duration-200"
        >
          {/* Dual Pulsing Sonar Beacon Rings */}
          <div className="absolute -inset-3 rounded-full bg-orange-500/30 border-2 border-orange-400 animate-ping pointer-events-none" />
          <div className="absolute -inset-1 rounded-full bg-amber-400/40 animate-pulse pointer-events-none" />

          {/* High-Tech Beacon Marker with Direction Arrow */}
          <div className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-tr from-orange-600 via-orange-500 to-amber-400 border-2 border-white flex items-center justify-center text-white font-black text-xs shadow-[0_0_20px_rgba(249,115,22,0.9)] scale-110">
            <Navigation className="w-4 h-4 fill-white" />
          </div>

          {/* Prominent Floating Identification Card */}
          <div className="mt-1 px-2.5 py-1 rounded-xl bg-slate-950/95 border border-orange-500/70 shadow-2xl flex flex-col items-center whitespace-nowrap">
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-ping" />
              <span className="text-orange-400 font-black text-[0.68rem] tracking-wider">VỊ TRÍ CỦA BẠN</span>
            </div>
            <div className="text-[0.62rem] text-white font-bold flex items-center gap-1 mt-0.5">
              <span>{myPosition.zone || 'Tọa độ tự do'}</span>
              <span className="text-amber-400 font-mono">• ~{myDistanceMeters}m</span>
            </div>
          </div>
        </div>

        {/* Tactical Footer Overlay with Real 30m - 50m Scale Bar */}
        <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-[0.58rem] sm:text-[0.62rem] text-slate-300 font-mono pointer-events-none bg-slate-950/80 px-2 py-1 rounded-lg border border-white/10">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>RADAR LAN 30M - 50M</span>
          </div>

          {/* Mini Scale Ruler */}
          <div className="hidden min-[380px]:flex items-center gap-1 text-[0.55rem] text-slate-400">
            <span>0m</span>
            <div className="w-12 sm:w-16 h-[2px] bg-orange-500/40 relative">
              <span className="absolute left-0 top-[-2px] w-[2px] h-[6px] bg-orange-400" />
              <span className="absolute left-1/2 top-[-2px] w-[1px] h-[4px] bg-orange-400" />
              <span className="absolute right-0 top-[-2px] w-[2px] h-[6px] bg-orange-400" />
            </div>
            <span className="text-orange-400 font-bold">50m Max</span>
          </div>

          {!readOnly ? (
            <span className="text-orange-400 font-bold">Chạm để đổi vị trí</span>
          ) : (
            <span>Chế độ xem</span>
          )}
        </div>
      </div>
    </div>
  );
}


