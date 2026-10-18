import { Mic, Radio } from 'lucide-react';

interface SpeakerBannerProps {
  speakerName?: string;
  isMe: boolean;
}

/** Ai đang nói: hiển thị to, đọc được từ xa. */
export function SpeakerBanner({ speakerName, isMe }: SpeakerBannerProps) {
  if (!speakerName) {
    return (
      <div className="flex h-11 items-center justify-center gap-2 text-slate-500">
        <Radio className="h-4 w-4" />
        <span className="text-sm font-medium">Kênh rảnh</span>
      </div>
    );
  }
  return (
    <div
      className={`flex h-11 items-center justify-center gap-2 rounded-2xl px-4 ${
        isMe ? 'bg-red-500/15 text-red-300' : 'bg-orange-500/15 text-orange-200'
      }`}
      aria-live="polite"
    >
      <Mic className="h-5 w-5 shrink-0 animate-pulse" />
      <span className="truncate text-lg font-bold">{isMe ? 'Bạn đang nói' : `${speakerName} đang nói`}</span>
    </div>
  );
}
