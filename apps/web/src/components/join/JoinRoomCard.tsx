import React, { useState } from 'react';
import type { ConnectionSettings, Position2D } from '../../types';
import { ServerUrlToggle } from './ServerUrlToggle';
import {
  DEPARTMENT_LIST,
  getDepartmentConfig,
  type DepartmentId
} from '../../utils/departments';
import { getDefaultPositionForDept, VENUE_ZONES } from '../../utils/zones';
import { TacticalMapFrame } from '../map/TacticalMapFrame';
import {
  LogIn,
  PlusCircle,
  Dices,
  Crown,
  User,
  DoorOpen,
  KeyRound,
  Zap,
  Wifi,
  ShieldCheck,
  Radio,
  Sparkles,
  Layers,
  MapPin,
  Crosshair,
  Navigation,
  Activity,
  ArrowUpRight,
  Headphones,
  Signal,
  CheckCircle2
} from 'lucide-react';

interface JoinRoomCardProps {
  settings: ConnectionSettings;
  connecting: boolean;
  connectionReady: boolean;
  notice: string;
  onSettingsChange: (next: ConnectionSettings) => void;
  onConnect: () => void;
  onOpenMap?: () => void;
}

export function JoinRoomCard({
  settings,
  connecting,
  connectionReady,
  notice,
  onSettingsChange,
  onConnect,
  onOpenMap
}: JoinRoomCardProps) {
  const [formMode, setFormMode] = useState<'join' | 'create'>('join');
  const [showMap, setShowMap] = useState(false);
  const [activePreviewTab, setActivePreviewTab] = useState<'audio' | 'radar' | 'network'>('audio');

  const selectedDeptId: DepartmentId = settings.department || 'dev';
  const currentDept = getDepartmentConfig(selectedDeptId);

  const currentPos: Position2D = settings.position || getDefaultPositionForDept(selectedDeptId);

  return (
    <div className="w-full max-w-6xl mx-auto my-auto py-2 sm:py-6 px-3 sm:px-6 flex flex-col lg:flex-row items-center lg:items-stretch justify-center gap-6 lg:gap-8">
      {/* ================= LEFT COLUMN: SECTION CARD (JOIN/CREATE FORM) ================= */}
      <div className="w-full lg:w-7/12 max-w-md sm:max-w-xl flex flex-col">
        <div className="relative rounded-3xl p-4 sm:p-7 bg-slate-900/90 border border-white/10 shadow-2xl shadow-black/80 backdrop-blur-2xl flex-1 flex flex-col justify-between">
          <div>
            {/* Mobile Mini Brand Banner (lg:hidden) */}
            <div className="lg:hidden flex items-center justify-between pb-3 mb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <img
                  src="/mpc-logo.webp"
                  alt="MPC Logo"
                  className="w-7 h-7 rounded-xl object-contain drop-shadow-[0_0_10px_rgba(249,115,22,0.4)]"
                />
                <div>
                  <h2 className="text-xs font-black text-white flex items-center gap-1">
                    MPC <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">VoiceLink</span>
                  </h2>
                  <span className="text-[0.58rem] text-slate-400 font-medium">Wi-Fi LAN Mesh 20m–50m</span>
                </div>
              </div>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[0.6rem] font-bold text-emerald-400 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                LAN ONLINE
              </span>
            </div>

            {/* Mode Tabs */}
            <div className="grid grid-cols-2 p-1 mb-3.5 sm:mb-5 rounded-2xl bg-slate-950/80 border border-white/5">
              <button
                type="button"
                onClick={() => setFormMode('join')}
                className={`flex items-center justify-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
                  formMode === 'join'
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <LogIn className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                Tham Gia Phòng
              </button>
              <button
                type="button"
                onClick={() => {
                  setFormMode('create');
                  if (!settings.joinCode || settings.joinCode === '1234') {
                    onSettingsChange({
                      ...settings,
                      roomId: settings.roomId || `MPC-${Math.floor(10 + Math.random() * 90)}`,
                      joinCode: Math.floor(1000 + Math.random() * 9000).toString()
                    });
                  }
                }}
                className={`flex items-center justify-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
                  formMode === 'create'
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <PlusCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                Tạo Phòng (Host)
              </button>
            </div>

            {/* Form Inputs */}
            <div className="flex flex-col gap-3 sm:gap-3.5">
              {/* Display Name */}
              <div className="flex flex-col gap-1">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                  <User className="w-3.5 h-3.5 text-orange-400" />
                  {formMode === 'create' ? 'Tên của bạn (Chủ phòng)' : 'Tên hiển thị của bạn'}
                </label>
                <input
                  value={settings.displayName}
                  disabled={connecting}
                  onChange={(e) => onSettingsChange({ ...settings, displayName: e.target.value })}
                  placeholder={formMode === 'create' ? 'VD: Ban Tổ Chức, Leader...' : 'VD: Tuấn, Thành viên 1...'}
                  autoFocus
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-white/10 text-white text-sm focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition disabled:opacity-50"
                />
              </div>

              {/* Department Selection (4 Ban) - Compact Pills */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-orange-400" />
                    Ban hoạt động:
                  </span>
                  <span className="text-[0.68rem] text-orange-400 font-bold">{currentDept.name}</span>
                </div>

                <div className="grid grid-cols-2 min-[400px]:grid-cols-4 gap-1.5">
                  {DEPARTMENT_LIST.map((dept) => {
                    const isSelected = selectedDeptId === dept.id;
                    const IconComponent = dept.icon;

                    return (
                      <button
                        key={dept.id}
                        type="button"
                        disabled={connecting}
                        onClick={() => {
                          const nextPos = getDefaultPositionForDept(dept.id);
                          onSettingsChange({
                            ...settings,
                            department: dept.id,
                            position: settings.position?.zone === 'Tọa độ tự do' ? settings.position : nextPos
                          });
                        }}
                        className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl border text-xs font-bold transition cursor-pointer ${
                          isSelected
                            ? `bg-gradient-to-r ${dept.activeBg} ${dept.borderClass} ${dept.glowClass} text-white shadow-md scale-[1.02]`
                            : 'bg-slate-950/60 border-white/5 text-slate-400 hover:text-white hover:bg-slate-900/60'
                        }`}
                      >
                        <IconComponent className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{dept.shortName}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Position / Location Frame on venue - Compact Chips + Toggleable 30m-50m Map */}
              <div className="flex flex-col gap-1.5 p-2.5 rounded-2xl bg-slate-950/70 border border-white/5">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-orange-400" />
                    Vị trí trực chiến:
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[0.68rem] text-orange-400 font-bold">
                      {currentPos.zone || 'Tọa độ tự do'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowMap(!showMap)}
                      className="flex items-center gap-1 text-[0.68rem] font-bold text-orange-400 hover:text-orange-300 transition cursor-pointer ml-1 bg-orange-500/10 px-2 py-0.5 rounded-lg border border-orange-500/30"
                    >
                      <Crosshair className="w-3 h-3" />
                      <span>{showMap ? 'Thu gọn' : 'Bản đồ 30m–50m'}</span>
                    </button>
                  </div>
                </div>

                {/* Quick Zone Chips Row */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
                  {VENUE_ZONES.map((zone) => {
                    const isCurrent = currentPos.zone === zone.name;
                    return (
                      <button
                        key={zone.id}
                        type="button"
                        disabled={connecting}
                        onClick={() =>
                          onSettingsChange({
                            ...settings,
                            position: { x: zone.x, y: zone.y, zone: zone.name }
                          })
                        }
                        className={`px-2 py-1 rounded-xl text-[0.68rem] font-bold whitespace-nowrap transition border cursor-pointer shrink-0 ${
                          isCurrent
                            ? 'bg-orange-500/20 border-orange-500 text-orange-300 shadow-sm'
                            : 'bg-slate-950/60 border-white/5 text-slate-400 hover:text-white'
                        }`}
                      >
                        {zone.shortName}
                      </button>
                    );
                  })}
                </div>

                {/* Toggleable Simulated 30m - 50m Map Frame */}
                {showMap && (
                  <div className="mt-2 pt-2 border-t border-white/10 animate-in fade-in zoom-in-95">
                    <TacticalMapFrame
                      myPosition={currentPos}
                      onPositionChange={(pos) => onSettingsChange({ ...settings, position: pos })}
                    />
                  </div>
                )}
              </div>

              {/* Room ID & Join Code Row - Always Clean 2 Cols */}
              <div className="grid grid-cols-2 gap-2">
                {/* Room ID */}
                <div className="flex flex-col gap-1">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                    <DoorOpen className="w-3.5 h-3.5 text-orange-400" />
                    {formMode === 'create' ? 'Tên phòng' : 'Tên phòng'}
                  </label>
                  <input
                    value={settings.roomId}
                    disabled={connecting}
                    onChange={(e) => onSettingsChange({ ...settings, roomId: e.target.value })}
                    placeholder="VD: MPC-01"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-white/10 text-white text-sm focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition disabled:opacity-50"
                  />
                </div>

                {/* Room Join Code */}
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between items-center">
                    <label className="flex items-center gap-1 text-xs font-semibold text-slate-300">
                      <KeyRound className="w-3.5 h-3.5 text-orange-400" />
                      Mã PIN
                    </label>
                    {formMode === 'create' && (
                      <button
                        type="button"
                        onClick={() =>
                          onSettingsChange({
                            ...settings,
                            joinCode: Math.floor(1000 + Math.random() * 9000).toString()
                          })
                        }
                        className="flex items-center gap-0.5 text-[0.65rem] font-bold text-orange-400 hover:text-orange-300 transition cursor-pointer"
                      >
                        <Dices className="w-2.5 h-2.5" />
                        Đổi
                      </button>
                    )}
                  </div>
                  <input
                    value={settings.joinCode}
                    disabled={connecting}
                    onChange={(e) => onSettingsChange({ ...settings, joinCode: e.target.value })}
                    placeholder="VD: 1234"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-white/10 text-white text-sm font-mono tracking-wider focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Server URL expandable toggle */}
              <ServerUrlToggle
                serverUrl={settings.serverUrl}
                disabled={connecting}
                onChange={(url) => onSettingsChange({ ...settings, serverUrl: url })}
              />

              {/* Connect CTA Button */}
              <button
                type="button"
                disabled={!connectionReady || connecting}
                onClick={onConnect}
                className="w-full mt-1 py-3 sm:py-3.5 px-4 sm:px-6 rounded-2xl font-black text-xs sm:text-sm tracking-wide text-white bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 active:scale-[0.99] shadow-xl shadow-orange-500/30 transition disabled:opacity-40 disabled:pointer-events-none cursor-pointer flex items-center justify-center gap-2"
              >
                {connecting ? (
                  <span className="flex items-center gap-2">
                    <Radio className="w-4 h-4 animate-spin" /> Đang kết nối máy chủ…
                  </span>
                ) : formMode === 'create' ? (
                  <>
                    <Crown className="w-4 h-4 text-amber-200" />
                    Khởi Tạo Phòng & Bắt Đầu
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    Vào Phòng Đàm Thoại
                  </>
                )}
              </button>
            </div>

            {/* Live Notice / Alert */}
            {notice && (
              <p className="mt-3 text-center text-xs text-slate-400 leading-relaxed font-medium">
                {notice}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ================= RIGHT COLUMN: INTERACTIVE TACTICAL COCKPIT (Desktop Only) ================= */}
      <div className="hidden lg:flex lg:w-5/12 max-w-lg flex-col">
        <div className="relative rounded-3xl p-4 sm:p-7 bg-slate-900/80 border border-white/10 shadow-2xl shadow-black/80 backdrop-blur-2xl flex-1 flex flex-col justify-between overflow-hidden">
          {/* Subtle Ambient Glow Orb */}
          <div className="absolute -top-16 -right-16 w-52 h-52 bg-gradient-to-br from-orange-500/25 to-amber-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Top Brand & Hero Identity */}
          <div className="relative z-10 flex flex-col">
            <div className="flex items-start justify-between gap-3 mb-3.5 sm:mb-4">
              {/* 3D MPC Cube Podium */}
              <div className="relative group cursor-pointer shrink-0">
                <div className="absolute -inset-2 bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl blur-xl opacity-40 group-hover:opacity-75 transition duration-500" />
                <div className="relative w-14 h-14 sm:w-20 sm:h-20 rounded-2xl bg-slate-950/90 border border-orange-500/30 p-2 flex items-center justify-center shadow-xl group-hover:scale-105 transition-all">
                  <img
                    src="/mpc-logo.webp"
                    alt="MPC Logo"
                    className="w-full h-full object-contain drop-shadow-[0_8px_16px_rgba(249,115,22,0.4)]"
                  />
                </div>
              </div>

              {/* Status Badge */}
              <div className="flex flex-col items-end gap-1">
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[0.62rem] sm:text-[0.68rem] font-bold text-emerald-400 font-mono">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  LAN MESH SẴN SÀNG
                </span>
                <span className="text-[0.58rem] sm:text-[0.62rem] text-slate-400 font-mono">
                  Opus 48kHz • RTT &lt; 5ms
                </span>
              </div>
            </div>

            {/* Title & Tagline */}
            <div className="flex flex-col mb-3.5 sm:mb-4">
              <div className="flex items-center gap-1.5 sm:gap-2 mb-1 sm:mb-1.5 flex-wrap">
                <span className="px-2 py-0.5 rounded-md bg-orange-500/15 border border-orange-500/30 text-[0.6rem] sm:text-[0.65rem] font-extrabold uppercase tracking-widest text-orange-400">
                  MPC VOICELINK v2.0
                </span>
                <span className="text-xs text-slate-500">•</span>
                <span className="text-[0.7rem] sm:text-xs text-slate-400 font-semibold truncate">Khoa CNTT - ĐH Mở TP.HCM</span>
              </div>

              <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight">
                Bộ Đàm Nội Bộ <span className="bg-gradient-to-r from-orange-400 via-amber-400 to-orange-500 bg-clip-text text-transparent">Không Dây</span>
              </h2>

              <p className="mt-1 sm:mt-1.5 text-[0.72rem] sm:text-xs text-slate-400 leading-relaxed">
                Hệ thống đàm thoại P2P thời gian thực qua Wi-Fi nội bộ, phủ sóng 20m – 50m độc lập không phụ thuộc Internet hay mạng 4G.
              </p>
            </div>

            {/* Interactive Feature Showcase Selector Tabs */}
            <div className="grid grid-cols-3 p-1 mb-3 rounded-xl bg-slate-950/80 border border-white/5 text-[0.65rem] sm:text-[0.7rem] font-bold">
              <button
                type="button"
                onClick={() => setActivePreviewTab('audio')}
                className={`py-1.5 px-1.5 sm:px-2 rounded-lg transition cursor-pointer flex items-center justify-center gap-1 ${
                  activePreviewTab === 'audio'
                    ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Zap className="w-3 h-3 text-orange-400" />
                <span>Âm Thanh</span>
              </button>
              <button
                type="button"
                onClick={() => setActivePreviewTab('radar')}
                className={`py-1.5 px-1.5 sm:px-2 rounded-lg transition cursor-pointer flex items-center justify-center gap-1 ${
                  activePreviewTab === 'radar'
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Crosshair className="w-3 h-3 text-sky-400" />
                <span>Radar 4 Ban</span>
              </button>
              <button
                type="button"
                onClick={() => setActivePreviewTab('network')}
                className={`py-1.5 px-1.5 sm:px-2 rounded-lg transition cursor-pointer flex items-center justify-center gap-1 ${
                  activePreviewTab === 'network'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Wifi className="w-3 h-3 text-emerald-400" />
                <span>Sóng LAN</span>
              </button>
            </div>

            {/* Dynamic Interactive Preview Body */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-white/5 min-h-[145px] flex flex-col justify-between">
              {activePreviewTab === 'audio' && (
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Headphones className="w-4 h-4 text-orange-400" />
                      Codec Opus 48kHz Chuẩn Phòng Thu
                    </span>
                    <span className="text-[0.62rem] font-mono px-2 py-0.5 rounded bg-orange-500/10 border border-orange-500/30 text-orange-400 font-bold">
                      0ms LATENCY
                    </span>
                  </div>

                  {/* Dynamic Equalizer Visualizer Bars */}
                  <div className="flex items-center justify-between h-9 px-3 rounded-xl bg-slate-900 border border-white/5">
                    <span className="text-[0.65rem] text-slate-400 font-mono">SIGNAL SPECTRUM:</span>
                    <div className="flex items-center gap-1 h-6">
                      <span className="w-1.5 h-full rounded-full bg-orange-500 animate-pulse" style={{ animationDuration: '0.4s' }} />
                      <span className="w-1.5 h-full rounded-full bg-amber-400 animate-pulse" style={{ animationDuration: '0.7s' }} />
                      <span className="w-1.5 h-full rounded-full bg-orange-400 animate-pulse" style={{ animationDuration: '0.5s' }} />
                      <span className="w-1.5 h-full rounded-full bg-rose-500 animate-pulse" style={{ animationDuration: '0.8s' }} />
                      <span className="w-1.5 h-full rounded-full bg-amber-300 animate-pulse" style={{ animationDuration: '0.6s' }} />
                      <span className="w-1.5 h-full rounded-full bg-orange-500 animate-pulse" style={{ animationDuration: '0.45s' }} />
                    </div>
                  </div>

                  <p className="text-[0.72rem] text-slate-400 leading-relaxed">
                    Khử tiếng vang và tạp âm tự động, truyền trực tiếp giữa các trình duyệt mà không cần tải lên đám mây.
                  </p>
                </div>
              )}

              {activePreviewTab === 'radar' && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Crosshair className="w-4 h-4 text-sky-400" />
                      Định Vị Tác Chiến 4 Ban
                    </span>
                    <span className="text-[0.62rem] font-mono px-2 py-0.5 rounded bg-sky-500/10 border border-sky-500/30 text-sky-400 font-bold">
                      RADAR LIVE
                    </span>
                  </div>

                  {/* 4 Department Mini Preview Strip */}
                  <div className="grid grid-cols-4 gap-1.5 py-1">
                    {DEPARTMENT_LIST.map((dept) => {
                      const Icon = dept.icon;
                      return (
                        <div
                          key={dept.id}
                          className={`p-1.5 rounded-lg border text-center flex flex-col items-center gap-0.5 ${dept.badgeClass}`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <span className="text-[0.6rem] font-bold truncate max-w-full">{dept.shortName}</span>
                        </div>
                      );
                    })}
                  </div>

                  <p className="text-[0.72rem] text-slate-400 leading-relaxed">
                    Khi bất kỳ ban nào phát biểu, sơ đồ radar sẽ tự động đánh dấu và phát sóng sonar xác định vị trí trong hội trường.
                  </p>
                </div>
              )}

              {activePreviewTab === 'network' && (
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Wifi className="w-4 h-4 text-emerald-400" />
                      Hotspot Wi-Fi 2.4 GHz
                    </span>
                    <span className="text-[0.62rem] font-mono px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold">
                      20M – 50M
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900 border border-white/5 text-[0.7rem] text-slate-300">
                    <div className="flex items-center gap-2">
                      <Signal className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Cự ly phát: <strong>20 - 50 mét</strong></span>
                    </div>
                    <span className="text-emerald-400 font-mono font-bold">0% Rơi Gói</span>
                  </div>

                  <p className="text-[0.72rem] text-slate-400 leading-relaxed">
                    Bật Mobile Hotspot trên Laptop, đặt máy trên bàn cao 1.5m để các điện thoại khác kết nối không cần Internet.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Card Footer */}
          <div className="relative z-10 pt-4 mt-4 border-t border-white/5 flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-1.5 text-[0.7rem]">
              <CheckCircle2 className="w-3.5 h-3.5 text-orange-400" />
              Sản phẩm nội bộ MPClub
            </span>
            <a
              href="https://www.mpclub.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="text-orange-400 hover:text-orange-300 font-bold flex items-center gap-0.5 text-[0.7rem] transition"
            >
              <span>mpclub.dev</span>
              <ArrowUpRight className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
