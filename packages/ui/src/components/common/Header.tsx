import React, { useState } from 'react';
import type { RoomStatePayload } from '@mpc-voicelink/protocol';
import {
  Share2,
  Volume2,
  VolumeX,
  SlidersHorizontal,
  Crown,
  LogOut,
  Radio,
  Menu,
  X,
  Globe
} from 'lucide-react';

export interface HeaderProps {
  joined: boolean;
  room?: RoomStatePayload | null;
  roomId: string;
  joinCode?: string;
  isRoomAdmin?: boolean;
  speakerEnabled?: boolean;
  modeLabel?: string;
  onToggleSpeaker?: () => void;
  onOpenAdmin?: () => void;
  onOpenSettings?: () => void;
  onOpenShare?: () => void;
  onDisconnect: () => void;
  logoSrc?: string;
}

export function Header({
  joined,
  room,
  roomId,
  joinCode,
  isRoomAdmin,
  speakerEnabled,
  modeLabel = 'P2P DIRECT',
  onToggleSpeaker,
  onOpenAdmin,
  onOpenSettings,
  onOpenShare,
  onDisconnect,
  logoSrc = '/mpc-logo.webp'
}: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full px-3 py-2 sm:px-6 sm:py-3 flex items-center justify-between border-b border-white/10 bg-slate-950/90 backdrop-blur-xl">
      {/* Brand Identity */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <div className="relative flex items-center justify-center shrink-0">
          <img
            src={logoSrc}
            alt="MPC Logo"
            className="w-7 h-7 sm:w-9 sm:h-9 rounded-xl object-contain drop-shadow-[0_0_12px_rgba(249,115,22,0.4)] hover:scale-105 transition-transform"
          />
         
        </div>

        <div className="flex flex-col">
          <h1 className="text-xs sm:text-base md:text-lg font-black tracking-tight text-white flex items-center gap-1">
            <span>MPC</span>
            <span className="bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">
              VoiceLink
            </span>
            <span className="hidden min-[480px]:inline px-1.5 py-0.2 rounded-full bg-orange-500/15 border border-orange-500/30 text-[0.55rem] sm:text-[0.62rem] font-bold text-orange-400">
              {modeLabel}
            </span>
          </h1>
          <span className="text-[0.6rem] sm:text-[0.68rem] text-slate-400 tracking-wider hidden min-[360px]:block">
            BỘ ĐÀM TRỰC TIẾP MPCLUB
          </span>
        </div>
      </div>

      {/* Right Actions for Room Connected */}
      {joined ? (
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Quick Room Badge */}
          <div className="hidden min-[440px]:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-900 border border-white/10 text-xs font-mono">
            <Radio className="w-3.5 h-3.5 text-orange-400 animate-pulse" />
            <span className="font-bold text-white">#{roomId}</span>
          </div>

          {/* Share Button (Desktop) */}
          {onOpenShare && (
            <button
              type="button"
              onClick={onOpenShare}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 text-xs font-bold text-orange-300 transition cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Mời</span>
            </button>
          )}

          {/* Speaker Toggle Button */}
          {onToggleSpeaker && (
            <button
              type="button"
              onClick={onToggleSpeaker}
              title={speakerEnabled ? 'Tắt loa ngoài' : 'Bật loa ngoài'}
              className={`p-1.5 sm:px-3 sm:py-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                speakerEnabled
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                  : 'bg-slate-900 border-white/10 text-slate-400 hover:text-white'
              }`}
            >
              {speakerEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              <span className="hidden md:inline">{speakerEnabled ? 'Loa Bật' : 'Loa Tắt'}</span>
            </button>
          )}

          {/* Audio Settings / Delay Button */}
          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 text-xs font-bold text-orange-300 transition flex items-center gap-1.5 cursor-pointer"
              title="Cài đặt Độ trễ & Âm thanh"
            >
              <SlidersHorizontal className="w-4 h-4 text-orange-400" />
              <span className="hidden md:inline">Độ Trễ & Mic</span>
            </button>
          )}

          {/* Admin Controls */}
          {isRoomAdmin && onOpenAdmin && (
            <button
              type="button"
              onClick={onOpenAdmin}
              className="p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-xs font-bold text-amber-300 transition flex items-center gap-1.5 cursor-pointer"
              title="Quản trị phòng"
            >
              <Crown className="w-4 h-4 text-amber-400" />
              <span className="hidden md:inline">Quản Trị</span>
            </button>
          )}

          {/* Disconnect Button (Desktop) */}
          <button
            type="button"
            onClick={onDisconnect}
            className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-xs font-bold text-rose-300 transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Rời phòng</span>
          </button>

          {/* Mobile Bars (Menu) Action Tray Trigger */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="sm:hidden p-2 rounded-xl bg-slate-900 border border-white/10 text-slate-300 hover:text-white transition cursor-pointer"
            aria-label="Mở menu tuỳ chọn"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-[0.65rem] sm:text-xs font-bold text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>SẴN SÀNG</span>
          </div>
        </div>
      )}

      {/* Mobile Drawer Dropdown Tray */}
      {joined && mobileMenuOpen && (
        <div className="sm:hidden absolute top-full left-0 right-0 bg-slate-950/95 border-b border-white/10 p-3 shadow-2xl backdrop-blur-2xl flex flex-col gap-2 z-50 animate-in slide-in-from-top-2 duration-150">
          <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-slate-900 text-xs font-mono text-slate-300">
            <span>MÃ PHÒNG:</span>
            <span className="font-bold text-orange-400">#{roomId}</span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            {onOpenShare && (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenShare();
                }}
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-orange-500/15 border border-orange-500/30 text-xs font-bold text-orange-300"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Mời / QR</span>
              </button>
            )}

            {onOpenSettings && (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenSettings();
                }}
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-orange-500/15 border border-orange-500/30 text-xs font-bold text-orange-300"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Độ trễ & Mic</span>
              </button>
            )}

            {isRoomAdmin && onOpenAdmin && (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenAdmin();
                }}
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-xs font-bold text-amber-300"
              >
                <Crown className="w-3.5 h-3.5" />
                <span>Quản trị</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              onDisconnect();
            }}
            className="w-full flex items-center justify-center gap-1.5 py-2 px-3 mt-1 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs font-bold text-rose-300"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Rời phòng đàm thoại</span>
          </button>
        </div>
      )}
    </header>
  );
}

