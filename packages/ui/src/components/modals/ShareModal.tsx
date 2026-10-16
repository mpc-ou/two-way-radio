import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Share2, Copy, Check, X, DoorOpen, KeyRound } from 'lucide-react';

export interface ShareModalProps {
  isOpen: boolean;
  roomId: string;
  joinCode?: string;
  onClose: () => void;
}

export function ShareModal({
  isOpen,
  roomId,
  joinCode = '',
  onClose
}: ShareModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (!isOpen || !roomId) return;
    const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(roomId)}${joinCode ? `&code=${encodeURIComponent(joinCode)}` : ''}`;
    QRCode.toDataURL(inviteUrl, {
      width: 240,
      margin: 2,
      color: { dark: '#07090e', light: '#ffffff' }
    })
      .then(setQrDataUrl)
      .catch((err) => console.error('Lỗi tạo mã QR:', err));
  }, [isOpen, roomId, joinCode]);

  if (!isOpen) return null;

  const currentInviteUrl = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(roomId)}${joinCode ? `&code=${encodeURIComponent(joinCode)}` : ''}`;

  function handleCopy() {
    navigator.clipboard
      .writeText(currentInviteUrl)
      .then(() => {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      })
      .catch(() => undefined);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm max-h-[92dvh] overflow-y-auto rounded-3xl bg-slate-900 border border-white/10 shadow-2xl p-4 sm:p-6 flex flex-col gap-4 sm:gap-5 backdrop-blur-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400 shrink-0">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-white">Chia Sẻ Phòng Bộ Đàm</h2>
              <p className="text-[0.65rem] sm:text-[0.68rem] text-slate-400">Mời các máy khác vào đàm thoại</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 border border-white/10 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer transition shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* QR Code Container */}
        <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-950 border border-white/10">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt="Mã QR tham gia nhanh"
              className="w-44 h-44 rounded-xl border-4 border-white shadow-lg"
            />
          ) : (
            <div className="w-44 h-44 rounded-xl bg-slate-800 animate-pulse flex items-center justify-center text-xs text-slate-400">
              Đang tạo mã QR…
            </div>
          )}
          <span className="mt-2 text-[0.65rem] text-slate-400 font-mono text-center">
            Quét mã để vào thẳng phòng
          </span>
        </div>

        {/* Room Credentials Card */}
        <div className="flex flex-col gap-2 p-3 rounded-xl bg-slate-950/80 border border-white/10">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 flex items-center gap-1.5">
              <DoorOpen className="w-3.5 h-3.5 text-orange-400" /> Tên phòng:
            </span>
            <span className="font-mono font-bold text-white bg-slate-800 px-2 py-0.5 rounded">
              {roomId}
            </span>
          </div>
          {joinCode && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-amber-400" /> Mã PIN:
              </span>
              <span className="font-mono font-bold text-white bg-slate-800 px-2 py-0.5 rounded tracking-widest">
                {joinCode}
              </span>
            </div>
          )}
        </div>

        {/* Copy Link Action Button */}
        <button
          type="button"
          onClick={handleCopy}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-slate-950 text-xs sm:text-sm font-black transition cursor-pointer shadow-lg shadow-orange-500/20 active:scale-98"
        >
          {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          <span>{copiedLink ? 'Đã sao chép link!' : 'Sao chép link tham gia'}</span>
        </button>
      </div>
    </div>
  );
}

