import { useEffect, useState, type FormEvent } from 'react';
import { Check, Lock, Mic, Users } from 'lucide-react';
import type { ChannelInfo } from '@mpc-voicelink/protocol';
import type { PinPrompt } from '../services/voiceLinkClient';
import { Sheet } from './Sheet';

interface ChannelSheetProps {
  open: boolean;
  channels: ChannelInfo[];
  currentChannelId?: string;
  joiningChannelId?: string;
  pinPrompt?: PinPrompt;
  onSelect: (channelId: string, pin?: string) => void;
  onCancelPin: () => void;
  onClose: () => void;
}

/** Danh sách channel: chạm là vào ngay; channel có khóa hiện ô nhập PIN ngay tại dòng đó. */
export function ChannelSheet({
  open,
  channels,
  currentChannelId,
  joiningChannelId,
  pinPrompt,
  onSelect,
  onCancelPin,
  onClose
}: ChannelSheetProps) {
  const [pin, setPin] = useState('');
  useEffect(() => setPin(''), [pinPrompt?.channelId]);

  function submitPin(event: FormEvent, channelId: string): void {
    event.preventDefault();
    if (pin.trim()) onSelect(channelId, pin.trim());
  }

  return (
    <Sheet open={open} side="bottom" title="Chọn channel" onClose={onClose}>
      {channels.length === 0 && <p className="py-6 text-center text-sm text-slate-400">Đang tải danh sách channel…</p>}
      <ul className="flex flex-col gap-2">
        {channels.map((channel) => {
          const active = channel.id === currentChannelId;
          const joining = channel.id === joiningChannelId;
          const askPin = pinPrompt?.channelId === channel.id;
          const full = channel.memberCount >= channel.maxMembers && !active;
          return (
            <li key={channel.id} className={`rounded-2xl border ${active ? 'border-orange-500/60 bg-orange-500/10' : 'border-white/10 bg-slate-950/60'}`}>
              <button
                type="button"
                disabled={joining || full}
                onClick={() => (active ? onClose() : onSelect(channel.id))}
                className="flex w-full items-center gap-3 px-3.5 py-3 text-left disabled:opacity-50"
              >
                <span className="h-9 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: channel.color }} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 font-semibold text-white">
                    <span className="truncate">{channel.name}</span>
                    {channel.hasPin && <Lock className="h-3.5 w-3.5 shrink-0 text-amber-400" />}
                  </span>
                  <span className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" /> {channel.memberCount}/{channel.maxMembers}
                    </span>
                    {channel.speakerName && (
                      <span className="flex min-w-0 items-center gap-1 text-orange-300">
                        <Mic className="h-3 w-3 shrink-0" /> <span className="truncate">{channel.speakerName}</span>
                      </span>
                    )}
                    {full && <span className="text-red-400">Đầy</span>}
                  </span>
                </span>
                {joining ? (
                  <span className="text-xs text-slate-400">Đang vào…</span>
                ) : active ? (
                  <Check className="h-5 w-5 text-orange-400" />
                ) : null}
              </button>

              {askPin && (
                <form onSubmit={(event) => submitPin(event, channel.id)} className="flex flex-col gap-2 border-t border-white/10 px-3.5 py-3">
                  <div className="flex gap-2">
                    <input
                      value={pin}
                      onChange={(event) => setPin(event.target.value)}
                      inputMode="numeric"
                      autoComplete="off"
                      autoFocus
                      placeholder="Mã PIN"
                      className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-900 px-3 py-2.5 text-center font-mono tracking-widest text-white focus:border-orange-500 focus:outline-none"
                    />
                    <button type="submit" disabled={!pin.trim()} className="rounded-xl bg-orange-500 px-4 font-bold text-white disabled:opacity-40">
                      Vào
                    </button>
                    <button type="button" onClick={onCancelPin} className="rounded-xl px-3 text-slate-400">
                      Hủy
                    </button>
                  </div>
                  {pinPrompt?.error && <p className="text-xs text-red-400">{pinPrompt.error}</p>}
                </form>
              )}
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}
