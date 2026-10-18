import { useEffect, useState, type ReactNode } from 'react';
import QRCode from 'qrcode';
import { Activity, ChevronRight, Copy, LogOut, Mic, QrCode, ScrollText, Shield, SlidersHorizontal, User, Users } from 'lucide-react';
import type { RoomStatePayload } from '@mpc-voicelink/protocol';
import type { VoiceLinkState } from '../services/voiceLinkClient';
import { formatMs } from '../utils/format';
import { formatLogTime, type LogEntry } from '../services/connectionIssues';
import { DevicePicker } from './DevicePicker';
import { Sheet } from './Sheet';

interface AppDrawerProps {
  open: boolean;
  state: VoiceLinkState;
  myClientId: string;
  displayName: string;
  volume: number;
  playoutDelayMs: number;
  wakeLockHeld: boolean;
  onClose: () => void;
  onVolumeChange: (value: number) => void;
  onPlayoutDelayChange: (value: number) => void;
  onTestBeep: () => void;
  onInputDeviceChange: (deviceId: string | undefined) => void;
  onOutputDeviceChange: (deviceId: string | undefined) => void;
  onRename: (name: string) => void;
  onLeave: () => void;
  onForceRelease: (code: string) => Promise<void>;
  /** Toàn bộ nhật ký dạng văn bản để sao chép. */
  getLogText: () => string;
}

function Section({ icon, title, children, defaultOpen = false }: { icon: ReactNode; title: string; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="group rounded-2xl border border-white/10 bg-slate-950/60">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-3.5 py-3 text-sm font-semibold text-slate-100 [&::-webkit-details-marker]:hidden">
        <span className="text-orange-400">{icon}</span>
        <span className="flex-1">{title}</span>
        <ChevronRight className="h-4 w-4 text-slate-500 transition-transform group-open:rotate-90" />
      </summary>
      <div className="flex flex-col gap-3 px-3.5 pb-3.5">{children}</div>
    </details>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-slate-400">{label}</span>
      <span className="font-mono text-slate-100">{value}</span>
    </div>
  );
}

function Members({ room, myClientId }: { room?: RoomStatePayload; myClientId: string }) {
  if (!room) return <p className="text-xs text-slate-400">Chưa vào channel.</p>;
  return (
    <ul className="flex flex-col gap-1.5">
      {room.members.map((member) => {
        const talking = member.clientId === room.speakerClientId;
        return (
          <li key={member.clientId} className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 ${talking ? 'bg-orange-500/15' : 'bg-slate-900'}`}>
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-[0.7rem] font-bold text-orange-300">
              {member.displayName.slice(0, 2).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm text-white">
              {member.displayName}
              {member.clientId === myClientId && <span className="text-slate-400"> (bạn)</span>}
            </span>
            {talking && <Mic className="h-4 w-4 animate-pulse text-orange-400" />}
          </li>
        );
      })}
    </ul>
  );
}

function IncidentLog({ entries, getLogText }: { entries: LogEntry[]; getLogText: () => string }) {
  const [copied, setCopied] = useState(false);
  if (entries.length === 0) return <p className="text-xs text-slate-400">Chưa có sự cố nào.</p>;
  const tone = { info: 'text-emerald-300', warn: 'text-amber-300', error: 'text-red-300' } as const;
  return (
    <>
      <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto pr-1">
        {[...entries].reverse().map((entry) => (
          <li key={`${entry.at}-${entry.text}`} className="flex gap-2 text-xs leading-snug">
            <span className="shrink-0 font-mono text-slate-500">{formatLogTime(entry.at)}</span>
            <span className={`select-text ${tone[entry.level]}`}>{entry.text}</span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(getLogText()).then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          });
        }}
        className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 py-1.5 text-xs text-slate-200 active:bg-white/10"
      >
        <Copy className="h-3.5 w-3.5" /> {copied ? 'Đã sao chép' : 'Sao chép nhật ký để gửi người vận hành'}
      </button>
    </>
  );
}

function Share() {
  const url = window.location.origin;
  const [qr, setQr] = useState('');
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    void QRCode.toDataURL(url, { width: 220, margin: 1 }).then(setQr).catch(() => setQr(''));
  }, [url]);
  return (
    <div className="flex flex-col items-center gap-2">
      {qr && <img src={qr} alt="QR mở VoiceLink" className="h-44 w-44 rounded-xl bg-white p-1" />}
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(url).then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          });
        }}
        className="flex items-center gap-1.5 font-mono text-xs text-orange-300"
      >
        <Copy className="h-3.5 w-3.5" /> {copied ? 'Đã chép' : url}
      </button>
      <p className="text-center text-[0.7rem] text-slate-500">Máy khác cùng Wi-Fi quét mã này để vào bộ đàm.</p>
    </div>
  );
}

export function AppDrawer({
  open,
  state,
  myClientId,
  displayName,
  volume,
  playoutDelayMs,
  wakeLockHeld,
  onClose,
  onVolumeChange,
  onPlayoutDelayChange,
  onTestBeep,
  onInputDeviceChange,
  onOutputDeviceChange,
  onRename,
  onLeave,
  onForceRelease,
  getLogText
}: AppDrawerProps) {
  const [name, setName] = useState(displayName);
  const [adminCode, setAdminCode] = useState('');
  const [adminMessage, setAdminMessage] = useState('');
  useEffect(() => setName(displayName), [displayName, open]);
  const maxDelay = state.profile?.targetPlayoutDelayMaxMs ?? 150;

  return (
    <Sheet open={open} side="right" title="Menu" onClose={onClose}>
      <div className="flex flex-col gap-2.5">
        <Section icon={<SlidersHorizontal className="h-4 w-4" />} title="Âm thanh" defaultOpen>
          <DevicePicker
            inputs={state.inputs}
            outputs={state.outputs}
            inputDeviceId={state.inputDeviceId}
            outputDeviceId={state.outputDeviceId}
            outputSelectable={state.outputSelectable}
            activeInputLabel={state.activeInputLabel}
            onInputChange={onInputDeviceChange}
            onOutputChange={onOutputDeviceChange}
          />
          <label className="flex flex-col gap-1.5 text-xs text-slate-300">
            <span className="flex justify-between"><span>Âm lượng loa</span><span className="font-mono">{Math.round(volume * 100)}%</span></span>
            <input type="range" min={0} max={1} step={0.05} value={volume} onChange={(e) => onVolumeChange(Number(e.target.value))} className="accent-orange-500" />
          </label>
          <label className="flex flex-col gap-1.5 text-xs text-slate-300">
            <span className="flex justify-between"><span>Đệm chống giật (playout)</span><span className="font-mono">{playoutDelayMs} ms</span></span>
            <input type="range" min={0} max={maxDelay} step={10} value={playoutDelayMs} onChange={(e) => onPlayoutDelayChange(Number(e.target.value))} className="accent-orange-500" />
            <span className="text-[0.68rem] text-slate-500">0 = trễ thấp nhất. Tăng lên nếu tiếng bị rè/ngắt khi đi xa router.</span>
          </label>
          <button type="button" onClick={onTestBeep} className="self-start rounded-xl border border-white/10 px-3 py-1.5 text-xs text-slate-200 active:bg-white/10">
            Thử tiếng bíp
          </button>
        </Section>

        <Section icon={<Users className="h-4 w-4" />} title={`Thành viên${state.room ? ` (${state.room.members.length})` : ''}`}>
          <Members room={state.room} myClientId={myClientId} />
        </Section>

        <Section icon={<Activity className="h-4 w-4" />} title="Chẩn đoán">
          <Row label="Kết nối" value={state.status} />
          <Row label="Media" value={state.media} />
          <Row label="Transport" value={state.transportState} />
          <Row label="Cấp quyền nói" value={formatMs(state.floorGrantMs)} />
          <Row label="RTT" value={formatMs(state.metrics.roundTripMs)} />
          <Row label="Jitter" value={formatMs(state.metrics.inboundJitterMs)} />
          <Row label="Mất gói" value={state.metrics.inboundPacketsLost ?? '—'} />
          <Row label="Opus" value={state.profile ? `${Math.round(state.profile.opusBitrate / 1000)} kbps` : '—'} />
          <Row label="Giữ màn hình sáng" value={wakeLockHeld ? 'bật' : 'tắt'} />
        </Section>

        <Section
          icon={<ScrollText className="h-4 w-4" />}
          title={`Nhật ký sự cố${state.log.some((entry) => entry.level === 'error') ? ' •' : ''}`}
          defaultOpen={Boolean(state.issue)}
        >
          <IncidentLog entries={state.log} getLogText={getLogText} />
        </Section>

        <Section icon={<QrCode className="h-4 w-4" />} title="Chia sẻ">
          <Share />
        </Section>

        <Section icon={<Shield className="h-4 w-4" />} title="Admin">
          <input
            type="password"
            value={adminCode}
            onChange={(e) => setAdminCode(e.target.value)}
            placeholder="Mã admin"
            autoComplete="off"
            className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none"
          />
          <button
            type="button"
            disabled={!adminCode || !state.room?.speakerClientId}
            onClick={() => {
              onForceRelease(adminCode)
                .then(() => setAdminMessage('Đã thu hồi mic.'))
                .catch((error: unknown) => setAdminMessage(error instanceof Error ? error.message : 'Không thu hồi được.'));
            }}
            className="rounded-xl bg-red-600 py-2 text-sm font-bold text-white disabled:opacity-40"
          >
            Thu hồi mic người đang nói
          </button>
          {adminMessage && <p className="text-xs text-slate-400">{adminMessage}</p>}
        </Section>

        <Section icon={<User className="h-4 w-4" />} title="Tài khoản">
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none"
            />
            <button
              type="button"
              disabled={!name.trim() || name.trim() === displayName}
              onClick={() => onRename(name)}
              className="rounded-xl bg-slate-700 px-3 text-sm font-semibold text-white disabled:opacity-40"
            >
              Lưu
            </button>
          </div>
          {state.channelId && (
            <button type="button" onClick={onLeave} className="flex items-center justify-center gap-2 rounded-xl border border-red-500/40 py-2 text-sm text-red-300 active:bg-red-500/10">
              <LogOut className="h-4 w-4" /> Rời channel
            </button>
          )}
        </Section>
      </div>
    </Sheet>
  );
}
