import React, { useState } from 'react';
import {
  LogIn,
  PlusCircle,
  Dices,
  User,
  DoorOpen,
  Zap,
  Wifi,
  Radio,
  Layers,
  MapPin,
  Crosshair,
  Headphones,
  Signal,
  CheckCircle2,
  Sparkles,
  QrCode,
  Sun,
  Server,
  ExternalLink
} from 'lucide-react';
import {
  DEPARTMENT_LIST,
  getDepartmentConfig,
  type DepartmentId,
  getDefaultPositionForDept,
  VENUE_ZONES,
  type Position2D
} from '@mpc-voicelink/ui';
import type { VoiceLinkMode } from './GatewayModeSelector';

interface JoinP2PRoomCardProps {
  mode: VoiceLinkMode;
  onSelectMode: (mode: VoiceLinkMode) => void;
  roomId: string;
  onRoomIdChange: (val: string) => void;
  displayName: string;
  onDisplayNameChange: (val: string) => void;
  department: DepartmentId;
  onDepartmentChange: (dept: DepartmentId) => void;
  position: Position2D;
  onPositionChange: (pos: Position2D) => void;
  keepScreenAwake: boolean;
  onKeepScreenAwakeChange: (val: boolean) => void;
  onOpenShareModal: () => void;
  onConnect: () => void;
  connecting: boolean;
  notice: string;
}

export function JoinP2PRoomCard({
  mode,
  onSelectMode,
  roomId,
  onRoomIdChange,
  displayName,
  onDisplayNameChange,
  department,
  onDepartmentChange,
  position,
  onPositionChange,
  keepScreenAwake,
  onKeepScreenAwakeChange,
  onOpenShareModal,
  onConnect,
  connecting,
  notice
}: JoinP2PRoomCardProps) {
  const [formMode, setFormMode] = useState<'join' | 'create'>('join');
  const [activePreviewTab, setActivePreviewTab] = useState<'audio' | 'radar' | 'gateway'>('audio');

  const selectedDeptId: DepartmentId = department || 'dev';
  const currentDept = getDepartmentConfig(selectedDeptId);

  function handleDeptClick(deptId: DepartmentId) {
    onDepartmentChange(deptId);
    const nextPos = getDefaultPositionForDept(deptId);
    onPositionChange(nextPos);
  }

  function handleZoneSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const zoneName = e.target.value;
    const found = VENUE_ZONES.find((z) => z.name === zoneName);
    if (found) {
      onPositionChange({ x: found.x, y: found.y, zone: found.name });
    }
  }

  function handleGenerateRoom() {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const prefixes = ['mpc', 'bcn', 'event', 'crew', 'radio'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    onRoomIdChange(`${prefix}-${randomSuffix}`);
  }

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
                  <span className="text-[0.58rem] text-slate-400 font-medium">P2P Serverless • Không Cần Server</span>
                </div>
              </div>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[0.6rem] font-bold text-emerald-400 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                P2P READY
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
                  if (!roomId || roomId === 'mpc-event') {
                    handleGenerateRoom();
                  }
                }}
                className={`flex items-center justify-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
                  formMode === 'create'
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <PlusCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                Tạo Phòng Mới
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
                  value={displayName}
                  disabled={connecting}
                  onChange={(e) => onDisplayNameChange(e.target.value)}
                  placeholder={formMode === 'create' ? 'VD: Ban Tổ Chức, Leader...' : 'VD: Tuấn Kiệt, Hoàng Long...'}
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
                        onClick={() => handleDeptClick(dept.id)}
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

              {/* Room Key / ID with Randomizer and QR share button */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <DoorOpen className="w-3.5 h-3.5 text-orange-400" />
                    Mã phòng đàm thoại (Room Key):
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleGenerateRoom}
                      className="flex items-center gap-1 text-[0.68rem] font-bold text-orange-400 hover:text-orange-300 cursor-pointer"
                      title="Tạo mã phòng ngẫu nhiên"
                    >
                      <Dices className="w-3 h-3" />
                      <span>Mã ngẫu nhiên</span>
                    </button>
                    <button
                      type="button"
                      onClick={onOpenShareModal}
                      className="flex items-center gap-1 text-[0.68rem] font-bold text-amber-400 hover:text-amber-300 cursor-pointer"
                      title="Mở mã QR mời vào phòng"
                    >
                      <QrCode className="w-3 h-3" />
                      <span>Mã QR</span>
                    </button>
                  </div>
                </div>

                <div className="relative flex items-center">
                  <input
                    value={roomId}
                    disabled={connecting}
                    onChange={(e) => onRoomIdChange(e.target.value)}
                    placeholder="VD: mpc-event, phong-1..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-white/10 text-white text-sm font-mono focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Tactical Zone Selector */}
              <div className="flex flex-col gap-1">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                  <MapPin className="w-3.5 h-3.5 text-orange-400" />
                  Vị trí ban đầu trên radar (Bán kính 30m - 50m):
                </label>
                <select
                  value={position.zone || 'Sân Khấu Chính'}
                  disabled={connecting}
                  onChange={handleZoneSelect}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-white/10 text-white text-xs sm:text-sm focus:outline-none focus:border-orange-500 transition cursor-pointer"
                >
                  {VENUE_ZONES.map((zone) => (
                    <option key={zone.id} value={zone.name} className="bg-slate-900 text-white">
                      {zone.name} (Gần {zone.recommendedDept?.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>

              {/* WakeLock (Chặn tắt màn hình) Toggle */}
              <div className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-950/60 border border-white/5">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                    <Sun className="w-3.5 h-3.5 animate-pulse" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[0.72rem] font-bold text-white flex items-center gap-1 truncate">
                      <span>Chặn tắt màn hình thụ động</span>
                      <span className="px-1 rounded bg-emerald-500/15 border border-emerald-500/30 text-[0.55rem] font-bold text-emerald-400">
                        Bật
                      </span>
                    </span>
                    <span className="text-[0.6rem] text-slate-400 truncate">
                      Giữ sáng màn hình để duy trì P2P liên tục
                    </span>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-2">
                  <input
                    type="checkbox"
                    checked={keepScreenAwake}
                    onChange={(e) => onKeepScreenAwakeChange(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-500" />
                </label>
              </div>

              {/* Connect Button */}
              <button
                type="button"
                disabled={connecting || !roomId.trim() || !displayName.trim()}
                onClick={onConnect}
                className="w-full mt-2 py-3 sm:py-3.5 rounded-2xl bg-gradient-to-r from-orange-500 via-orange-600 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-slate-950 font-black text-sm sm:text-base tracking-wide uppercase transition-all shadow-xl shadow-orange-500/25 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
              >
                {connecting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    <span>Đang kết nối P2P…</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>{formMode === 'create' ? 'Khởi Tạo Phòng Đàm Thoại' : 'Vào Phòng Đàm Thoại'}</span>
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
                  P2P MESH SẴN SÀNG
                </span>
                <span className="text-[0.58rem] sm:text-[0.62rem] text-slate-400 font-mono">
                  Opus 48kHz • Không Cần Server
                </span>
              </div>
            </div>

            {/* Title & Tagline */}
            <div className="flex flex-col mb-3.5 sm:mb-4">
              <div className="flex items-center gap-1.5 sm:gap-2 mb-1 sm:mb-1.5 flex-wrap">
                <span className="px-2 py-0.5 rounded-md bg-orange-500/15 border border-orange-500/30 text-[0.6rem] sm:text-[0.65rem] font-extrabold uppercase tracking-widest text-orange-400">
                  MPC VOICELINK P2P
                </span>
                <span className="text-xs text-slate-500">•</span>
                <span className="text-[0.7rem] sm:text-xs text-slate-400 font-semibold truncate">Khoa CNTT - ĐH Mở TP.HCM</span>
              </div>

              <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight">
                Bộ Đàm Trực Tiếp <span className="bg-gradient-to-r from-orange-400 via-amber-400 to-orange-500 bg-clip-text text-transparent">Serverless</span>
              </h2>

              <p className="mt-1 sm:mt-1.5 text-[0.72rem] sm:text-xs text-slate-400 leading-relaxed">
                Hệ thống đàm thoại P2P thời gian thực giữa các trình duyệt. Không cần máy chủ trung gian, hoạt động tức thì qua mã phòng hoặc quét QR.
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
                onClick={() => setActivePreviewTab('gateway')}
                className={`py-1.5 px-1.5 sm:px-2 rounded-lg transition cursor-pointer flex items-center justify-center gap-1 ${
                  activePreviewTab === 'gateway'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Server className="w-3 h-3 text-emerald-400" />
                <span>Cổng Chế Độ</span>
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
                      BÁN KÍNH 50M
                    </span>
                  </div>

                  {/* 4 Department Mini Preview Strip */}
                  <div className="grid grid-cols-4 gap-1.5 py-1">
                    {DEPARTMENT_LIST.map((dept) => {
                      const Icon = dept.icon;
                      return (
                        <div key={dept.id} className="flex flex-col items-center p-1.5 rounded-lg bg-slate-900 border border-white/5">
                          <Icon className="w-3.5 h-3.5 mb-1 text-slate-300" />
                          <span className="text-[0.6rem] font-bold text-white truncate max-w-full">{dept.shortName}</span>
                        </div>
                      );
                    })}
                  </div>

                  <p className="text-[0.72rem] text-slate-400 leading-relaxed">
                    Mô phỏng vị trí các ban trên radar hội trường 30m - 50m, tự động phát hiện nguồn phát giọng nói khi có người bấm PTT.
                  </p>
                </div>
              )}

              {activePreviewTab === 'gateway' && (
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Server className="w-4 h-4 text-emerald-400" />
                      Cổng Chuyển Đổi Hạ Tầng
                    </span>
                    <span className="text-[0.62rem] font-mono px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold">
                      GATEWAY
                    </span>
                  </div>

                  <div className="flex flex-col gap-1.5 text-xs">
                    <div className="flex items-center justify-between p-2 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-300">
                      <span className="font-bold">Đang dùng: P2P Serverless (Vercel)</span>
                      <span className="text-[0.6rem] bg-orange-500/20 px-1.5 py-0.5 rounded font-mono">0 SERVER</span>
                    </div>

                    <a
                      href="https://172.22.177.111:5173"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-2 rounded-xl bg-sky-950/40 hover:bg-sky-900/50 border border-sky-500/30 text-sky-200 transition"
                    >
                      <span className="font-semibold text-[0.68rem]">Chuyển sang Server LAN (Mediasoup)</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Security & Tech Badges */}
          <div className="pt-3 border-t border-white/5 flex items-center justify-between text-[0.65rem] text-slate-500 font-mono">
            <span className="flex items-center gap-1">
              <Signal className="w-3 h-3 text-emerald-400" /> Full Mesh WebRTC
            </span>
            <span>DTLS-SRTP ENCRYPTED</span>
          </div>
        </div>
      </div>
    </div>
  );
}
