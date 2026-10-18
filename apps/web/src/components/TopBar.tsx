import { ChevronDown, Menu, Users } from 'lucide-react';
import type { ChannelInfo } from '@mpc-voicelink/protocol';
import type { ConnectionStatus, MediaStatus } from '../services/voiceLinkClient';

interface TopBarProps {
  channel?: ChannelInfo;
  joining: boolean;
  status: ConnectionStatus;
  media: MediaStatus;
  onOpenChannels: () => void;
  onOpenMenu: () => void;
}

function statusDot(status: ConnectionStatus, media: MediaStatus): { color: string; label: string } {
  if (status === 'offline') return { color: 'bg-red-500', label: 'Mất kết nối' };
  if (status === 'connecting') return { color: 'bg-amber-400 animate-pulse', label: 'Đang kết nối' };
  if (media === 'error') return { color: 'bg-red-500', label: 'Lỗi âm thanh' };
  if (media === 'starting') return { color: 'bg-amber-400 animate-pulse', label: 'Đang mở âm thanh' };
  return { color: 'bg-emerald-400', label: 'Trực tuyến' };
}

export function TopBar({ channel, joining, status, media, onOpenChannels, onOpenMenu }: TopBarProps) {
  const dot = statusDot(status, media);
  return (
    <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-white/5 bg-[#07090e]/90 px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur-xl">
      <button
        type="button"
        onClick={onOpenChannels}
        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-2xl border border-white/10 bg-slate-900/80 px-3 py-2 text-left active:bg-slate-800"
      >
        <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: channel?.color ?? '#475569' }} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.95rem] font-bold text-white">
            {joining ? 'Đang vào…' : channel?.name ?? 'Chọn channel'}
          </span>
          {channel && (
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <Users className="h-3 w-3" /> {channel.memberCount}/{channel.maxMembers}
            </span>
          )}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
      </button>

      <span className="flex items-center gap-1.5 px-1" title={dot.label} aria-label={dot.label}>
        <span className={`h-2.5 w-2.5 rounded-full ${dot.color}`} />
      </span>

      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="Menu"
        className="rounded-2xl border border-white/10 bg-slate-900/80 p-2.5 text-slate-200 active:bg-slate-800"
      >
        <Menu className="h-5 w-5" />
      </button>
    </header>
  );
}
