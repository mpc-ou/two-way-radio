import React from 'react';

export interface AudioEqualizerProps {
  isMe: boolean;
  inputLevel?: number;
}

export function AudioEqualizer({ isMe }: AudioEqualizerProps) {
  const bars = [
    { delay: '0s', duration: '0.65s' },
    { delay: '0.25s', duration: '0.85s' },
    { delay: '0.45s', duration: '0.7s' },
    { delay: '0.15s', duration: '0.9s' },
    { delay: '0.35s', duration: '0.75s' }
  ];

  const gradientClass = isMe
    ? 'bg-gradient-to-t from-rose-600 via-rose-500 to-rose-400 shadow-[0_0_6px_rgba(244,63,94,0.5)]'
    : 'bg-gradient-to-t from-orange-600 via-orange-500 to-amber-400 shadow-[0_0_6px_rgba(249,115,22,0.5)]';

  return (
    <div className="flex items-end justify-center gap-1 h-6 w-full px-1">
      {bars.map((bar, index) => (
        <span
          key={index}
          className={`w-1 h-full rounded-full origin-bottom ${gradientClass}`}
          style={{
            animation: `eqBounce ${bar.duration} ease-in-out infinite`,
            animationDelay: bar.delay
          }}
        />
      ))}
    </div>
  );
}

