import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface SheetProps {
  open: boolean;
  side: 'bottom' | 'right';
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/** Lớp phủ dạng bottom sheet (danh sách) hoặc drawer bên phải (menu). */
export function Sheet({ open, side, title, onClose, children }: SheetProps) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const panel = side === 'bottom'
    ? 'inset-x-0 bottom-0 max-h-[85dvh] rounded-t-3xl pb-[max(1rem,env(safe-area-inset-bottom))] animate-sheet-up'
    : 'inset-y-0 right-0 w-[min(88vw,22rem)] rounded-l-3xl pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] animate-drawer-in';

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Đóng" className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={`absolute flex flex-col bg-slate-900 border border-white/10 shadow-2xl ${panel}`}>
        {side === 'bottom' && <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-white/20" />}
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <h2 className="text-base font-bold text-white">{title}</h2>
          <button type="button" onClick={onClose} className="p-2 -mr-2 rounded-full text-slate-400 active:bg-white/10" aria-label="Đóng">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-2">{children}</div>
      </div>
    </div>
  );
}
