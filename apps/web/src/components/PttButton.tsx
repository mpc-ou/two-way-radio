import { useEffect, type PointerEvent } from 'react';
import { Mic, MicOff, Volume2 } from 'lucide-react';
import type { PttPhase } from '../services/voiceLinkClient';

interface PttButtonProps {
  phase: PttPhase;
  /** Người khác đang nói. */
  busy: boolean;
  disabled: boolean;
  inputLevel: number;
  onPress: () => void;
  onRelease: () => void;
}

/**
 * Nút PTT lớn ở giữa màn hình. Dùng pointer capture để kéo ngón tay ra ngoài nút vẫn
 * giữ quyền nói cho tới khi nhả; phím Space cũng dùng được trên máy tính.
 */
export function PttButton({ phase, busy, disabled, inputLevel, onPress, onRelease }: PttButtonProps) {
  const talking = phase === 'TALKING';
  const requesting = phase === 'REQUESTING';

  useEffect(() => {
    const isTyping = (target: EventTarget | null): boolean =>
      target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
    const down = (event: KeyboardEvent): void => {
      if (event.code !== 'Space' || event.repeat || isTyping(event.target) || disabled) return;
      event.preventDefault();
      onPress();
    };
    const up = (event: KeyboardEvent): void => {
      if (event.code !== 'Space' || isTyping(event.target)) return;
      event.preventDefault();
      onRelease();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [disabled, onPress, onRelease]);

  function handleDown(event: PointerEvent<HTMLButtonElement>): void {
    event.preventDefault();
    if (disabled) return;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Một số trình duyệt cũ không hỗ trợ.
    }
    onPress();
  }

  function handleUp(event: PointerEvent<HTMLButtonElement>): void {
    event.preventDefault();
    onRelease();
  }

  const ring = Math.min(1, inputLevel * 1.4);
  const tone = talking
    ? 'border-red-500 bg-red-600 text-white shadow-[0_0_60px_rgba(239,68,68,0.55)]'
    : requesting
      ? 'border-amber-300 bg-amber-500 text-white'
      : busy
        ? 'border-orange-400/70 bg-slate-800 text-orange-200'
        : 'border-orange-500/60 bg-gradient-to-b from-slate-800 to-slate-950 text-white active:scale-95';
  const label = talking ? 'ĐANG NÓI' : requesting ? 'ĐANG XIN…' : busy ? 'KÊNH BẬN' : 'GIỮ ĐỂ NÓI';
  const Icon = busy && !talking ? Volume2 : disabled && !busy ? MicOff : Mic;

  return (
    <div className="relative flex items-center justify-center">
      {talking && (
        <span
          className="pointer-events-none absolute rounded-full border-4 border-red-500/60 transition-transform duration-75"
          style={{ width: 'var(--ptt-size)', height: 'var(--ptt-size)', transform: `scale(${1.04 + ring * 0.1})` }}
        />
      )}
      {busy && !talking && (
        // Nhấp nháy tại chỗ (không phóng to) để không đè lên khung chat bên dưới.
        <span className="pointer-events-none absolute animate-pulse rounded-full border-4 border-orange-400/50" style={{ width: 'calc(var(--ptt-size) + 0.75rem)', height: 'calc(var(--ptt-size) + 0.75rem)' }} />
      )}
      <button
        type="button"
        disabled={disabled}
        onPointerDown={handleDown}
        onPointerUp={handleUp}
        onPointerCancel={handleUp}
        onContextMenu={(event) => event.preventDefault()}
        aria-pressed={talking}
        aria-label={label}
        style={{ width: 'var(--ptt-size)', height: 'var(--ptt-size)', WebkitTouchCallout: 'none' }}
        className={`relative z-10 flex select-none touch-none flex-col items-center justify-center gap-2 rounded-full border-[6px] transition-[transform,background-color] duration-100 disabled:opacity-40 ${tone} ${talking ? 'scale-95' : ''}`}
      >
        <Icon className="h-[28%] w-[28%]" strokeWidth={2.2} />
        <span className="text-sm font-black tracking-wider min-[380px]:text-base">{label}</span>
      </button>
    </div>
  );
}
