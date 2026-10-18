import { useEffect, useState } from 'react';
import { AlertTriangle, ShieldAlert, WifiOff } from 'lucide-react';
import type { ConnectionIssue } from '../services/connectionIssues';

interface ConnectionBannerProps {
  issue?: ConnectionIssue;
  envIssue?: ConnectionIssue;
  reconnectAttempt: number;
}

function useSecondsSince(since?: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (since === undefined) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [since]);
  return since === undefined ? 0 : Math.max(0, Math.round((now - since) / 1000));
}

/** Banner cố định nói rõ đang lỗi gì và nên làm gì; tự ẩn khi kết nối lại. */
export function ConnectionBanner({ issue, envIssue, reconnectAttempt }: ConnectionBannerProps) {
  // Sự cố đang diễn ra quan trọng hơn cảnh báo môi trường.
  const shown = issue ?? envIssue;
  const seconds = useSecondsSince(issue?.since);
  if (!shown) return null;

  const severe = shown.kind === 'insecure' || shown.kind === 'unsupported' || shown.kind === 'unreachable';
  const Icon = shown.kind === 'offline' ? WifiOff : shown.kind === 'insecure' ? ShieldAlert : AlertTriangle;
  const retrying = shown === issue && shown.kind !== 'offline';

  return (
    <div
      role="alert"
      className={`mx-3 mt-2 flex gap-2.5 rounded-2xl border px-3 py-2.5 ${
        severe ? 'border-red-500/50 bg-red-950/70 text-red-100' : 'border-amber-500/50 bg-amber-950/70 text-amber-100'
      }`}
    >
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${severe ? 'text-red-400' : 'text-amber-400'}`} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">{shown.title}</p>
        <p className="text-xs opacity-90">{shown.hint}</p>
        <p className="mt-0.5 text-[0.68rem] opacity-60">
          {shown === issue && `Đã ${seconds} giây`}
          {retrying && reconnectAttempt > 0 && ` · thử lại lần ${reconnectAttempt}`}
          {` · ${shown.code}`}
        </p>
      </div>
    </div>
  );
}
