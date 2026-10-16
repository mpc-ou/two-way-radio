import React, { useState } from 'react';
import type { RoomStatePayload } from '@mpc-voicelink/protocol';
import {
  Share2,
  QrCode,
  Volume2,
  VolumeX,
  SlidersHorizontal,
  Crown,
  LogOut,
  Radio,
  Menu,
  X
} from 'lucide-react';

interface HeaderProps {
  joined: boolean;
  room: RoomStatePayload | null;
  roomId: string;
  joinCode: string;
  isRoomAdmin?: boolean;
  speakerEnabled: boolean;
  onToggleSpeaker: () => void;
  onOpenAdmin: () => void;
  onOpenShare: () => void;
  onDisconnect: () => void;
}

export function Header({
  joined,
  room,
  roomId,
  joinCode,
  isRoomAdmin,
  speakerEnabled,
  onToggleSpeaker,
  onOpenAdmin,
  onOpenShare,
  onDisconnect
}: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full px-3 py-2 sm:px-6 sm:py-3 flex items-center justify-between border-b border-white/10 bg-slate-950/90 backdrop-blur-xl">
      {/* Brand Identity */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <div className="relative flex items-center justify-center shrink-0">
          <img
            src="/mpc-logo.webp"
            alt="MPC Logo"
            className="w-7 h-7 sm:w-9 sm:h-9 rounded-xl object-contain drop-shadow-[0_0_12px_rgba(249,115,22,0.4)] hover:scale-105 transition-transform"
          />
         
        </div>

        <div className="flex flex-col">
          <h1 className="text-xs sm:text-base md:text-lg font-black tracking-tight text-white flex items-center gap-1">
            MPC <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">VoiceLink</span>
          </h1>
          <span className="hidden min-[400px]:inline-block text-[0.55rem] sm:text-[0.65rem] uppercase tracking-wider text-slate-400 font-medium truncate max-w-[140px] sm:max-w-none">
            Mobile Programming Club
          </span>
        </div>
      </div>

      {/* Desktop Actions (sm and up) */}
      <div className="hidden sm:flex items-center gap-2">
        {joined ? (
          <>
            {/* Room Info Pill */}
            <button
              type="button"
              onClick={onOpenShare}
              title="Xem mã QR & thông tin chia sẻ phòng"
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-orange-500/30 hover:border-orange-500/70 hover:bg-slate-800/90 transition text-xs text-slate-200 cursor-pointer shadow-sm"
            >
              <span className="text-slate-400">
                Phòng: <strong className="text-orange-400 font-bold">#{room?.roomId || roomId}</strong>
              </span>
              <span className="text-slate-400">| Mã: <strong className="text-amber-400 font-bold">{joinCode}</strong></span>
              <Share2 className="w-3.5 h-3.5 text-orange-400" />
            </button>

            {/* QR Share Button */}
            <button
              type="button"
              onClick={onOpenShare}
              title="Mã QR & Chia sẻ phòng"
              className="w-9 h-9 rounded-xl flex items-center justify-center bg-orange-500/10 border border-orange-500/30 text-orange-400 hover:bg-orange-500 hover:text-white transition shadow-sm cursor-pointer"
            >
              <QrCode className="w-4 h-4" />
            </button>

            {/* Speaker Toggle Pill */}
            <button
              type="button"
              onClick={onToggleSpeaker}
              title={speakerEnabled ? 'Loa ngoài đang bật' : 'Nhấn để kiểm tra loa'}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                speakerEnabled
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                  : 'bg-slate-900 border-white/10 text-slate-400 hover:text-white hover:border-white/20'
              }`}
            >
              {speakerEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
              <span>{speakerEnabled ? 'Loa bật' : 'Bật loa'}</span>
            </button>

            {/* Admin Crown / Settings */}
            <button
              type="button"
              onClick={onOpenAdmin}
              title={isRoomAdmin ? 'Quản trị phòng (Bạn là Chủ Phòng)' : 'Cài đặt quản trị'}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition cursor-pointer ${
                isRoomAdmin
                  ? 'bg-amber-500/20 border border-amber-500 text-amber-400 shadow-[0_0_14px_rgba(245,158,11,0.35)]'
                  : 'bg-slate-900 border border-white/10 text-slate-400 hover:text-white hover:border-white/20'
              }`}
            >
              {isRoomAdmin ? (
                <Crown className="w-4 h-4 text-amber-400" />
              ) : (
                <SlidersHorizontal className="w-4 h-4" />
              )}
            </button>

            {/* Leave Room */}
            <button
              type="button"
              onClick={onDisconnect}
              title="Rời phòng"
              className="w-9 h-9 rounded-xl flex items-center justify-center bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500 hover:text-white transition shadow-sm cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onOpenAdmin}
            title="Cài đặt quản trị"
            className="w-9 h-9 rounded-xl flex items-center justify-center bg-slate-900 border border-white/10 text-slate-400 hover:text-white hover:border-white/20 transition cursor-pointer"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Mobile Compact Actions (Bars / Hamburger) */}
      <div className="flex sm:hidden items-center gap-1.5">
        {joined ? (
          <>
            {/* Quick Room Badge */}
            <button
              type="button"
              onClick={onOpenShare}
              className="px-2.5 py-1 rounded-xl bg-slate-900/90 border border-orange-500/30 text-[0.72rem] font-bold text-orange-400 cursor-pointer shadow-sm flex items-center gap-1"
            >
              <span>#{room?.roomId || roomId}</span>
              <Share2 className="w-3 h-3 text-orange-400" />
            </button>

            {/* Compact Bars (Menu) Toggle Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className={`w-8 h-8 rounded-xl flex items-center justify-center border transition cursor-pointer ${
                mobileMenuOpen
                  ? 'bg-orange-500/20 border-orange-500 text-orange-400 shadow-sm'
                  : 'bg-slate-900 border-white/10 text-slate-300 hover:text-white'
              }`}
              aria-label="Menu tác vụ"
            >
              {mobileMenuOpen ? <X className="w-4 h-4 text-orange-400" /> : <Menu className="w-4 h-4" />}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onOpenAdmin}
            title="Cài đặt quản trị"
            className="w-8 h-8 rounded-xl flex items-center justify-center bg-slate-900 border border-white/10 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Mobile Dropdown Action Tray (Bars Expanded) */}
      {joined && mobileMenuOpen && (
        <div className="sm:hidden absolute top-full left-0 right-0 bg-slate-950/95 border-b border-orange-500/30 backdrop-blur-2xl p-3 shadow-2xl flex flex-col gap-2 z-50 animate-in slide-in-from-top-2">
          <div className="flex items-center justify-between pb-2 border-b border-white/10 text-xs">
            <span className="text-slate-400">
              Phòng: <strong className="text-orange-400 font-bold">#{room?.roomId || roomId}</strong>
            </span>
            <span className="text-slate-400">
              Mã PIN: <strong className="text-amber-400 font-bold font-mono">{joinCode}</strong>
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            {/* Toggle Speaker Button */}
            <button
              type="button"
              onClick={() => {
                onToggleSpeaker();
                setMobileMenuOpen(false);
              }}
              className={`flex items-center justify-center gap-1.5 p-2 rounded-xl border text-xs font-bold transition cursor-pointer ${
                speakerEnabled
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                  : 'bg-slate-900 border-white/10 text-slate-300'
              }`}
            >
              {speakerEnabled ? <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> : <VolumeX className="w-3.5 h-3.5 text-slate-400" />}
              <span>{speakerEnabled ? 'Loa đang bật' : 'Bật loa ngoài'}</span>
            </button>

            {/* QR Share */}
            <button
              type="button"
              onClick={() => {
                onOpenShare();
                setMobileMenuOpen(false);
              }}
              className="flex items-center justify-center gap-1.5 p-2 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-400 text-xs font-bold cursor-pointer hover:bg-orange-500/20"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Mã QR Chia Sẻ</span>
            </button>

            {/* Admin Settings */}
            <button
              type="button"
              onClick={() => {
                onOpenAdmin();
                setMobileMenuOpen(false);
              }}
              className={`flex items-center justify-center gap-1.5 p-2 rounded-xl border text-xs font-bold transition cursor-pointer ${
                isRoomAdmin
                  ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                  : 'bg-slate-900 border-white/10 text-slate-300'
              }`}
            >
              {isRoomAdmin ? <Crown className="w-3.5 h-3.5 text-amber-400" /> : <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />}
              <span>{isRoomAdmin ? 'Quản trị (Host)' : 'Cài đặt âm thanh'}</span>
            </button>

            {/* Leave Room */}
            <button
              type="button"
              onClick={() => {
                onDisconnect();
                setMobileMenuOpen(false);
              }}
              className="flex items-center justify-center gap-1.5 p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold cursor-pointer hover:bg-rose-500/20"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Rời phòng</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
