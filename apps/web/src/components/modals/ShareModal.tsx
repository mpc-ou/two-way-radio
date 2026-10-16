import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Share2, Copy, Check, X, Globe, DoorOpen, KeyRound, Camera } from 'lucide-react';

interface ShareModalProps {
  isOpen: boolean;
  roomId: string;
  joinCode: string;
  onClose: () => void;
}

export function ShareModal({
  isOpen,
  roomId,
  joinCode,
  onClose
}: ShareModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (!isOpen || !roomId) return;
    const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(roomId)}&code=${encodeURIComponent(joinCode)}`;
    QRCode.toDataURL(inviteUrl, {
      width: 240,
      margin: 2,
      color: { dark: '#07090e', light: '#ffffff' }
    })
      .then(setQrDataUrl)
      .catch((err) => console.error('Lỗi tạo mã QR:', err));
  }, [isOpen, roomId, joinCode]);

  if (!isOpen) return null;

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
              <p className="text-[0.65rem] sm:text-[0.68rem] text-slate-400">Mời các máy khác trong mạng kết nối</p>
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

        {/* QR Frame with Sci-fi Targeting Brackets */}
        {qrDataUrl && (
          <div className="flex flex-col items-center gap-2 sm:gap-2.5">
            <div className="relative p-2 rounded-2xl bg-white shadow-xl">
              <span className="absolute -top-1.5 -left-1.5 w-3 h-3 border-t-2 border-l-2 border-orange-500" />
              <span className="absolute -top-1.5 -right-1.5 w-3 h-3 border-t-2 border-r-2 border-orange-500" />
              <span className="absolute -bottom-1.5 -left-1.5 w-3 h-3 border-b-2 border-l-2 border-orange-500" />
              <span className="absolute -bottom-1.5 -right-1.5 w-3 h-3 border-b-2 border-r-2 border-orange-500" />
              <img src={qrDataUrl} alt="QR Code" className="w-36 h-36 min-[380px]:w-44 min-[380px]:h-44 rounded-xl object-contain" />
            </div>
            <p className="flex items-center gap-1.5 text-[0.65rem] sm:text-[0.7rem] text-slate-400 text-center">
              <Camera className="w-3.5 h-3.5 text-orange-400 shrink-0" />
              Bật camera quét mã QR để vào phòng tức thì
            </p>
          </div>
        )}

        {/* Room Info details */}
        <div className="flex flex-col gap-2 p-3.5 rounded-xl bg-slate-950/80 border border-white/5 text-xs">
          <div className="flex justify-between items-center">
            <span className="flex items-center gap-1.5 text-slate-400">
              <Globe className="w-3 h-3 text-slate-500" /> Địa chỉ Web / IP:
            </span>
            <span className="text-orange-400 font-mono font-bold">{window.location.origin}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="flex items-center gap-1.5 text-slate-400">
              <DoorOpen className="w-3 h-3 text-slate-500" /> Tên phòng:
            </span>
            <span className="text-white font-bold">{roomId}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="flex items-center gap-1.5 text-slate-400">
              <KeyRound className="w-3 h-3 text-slate-500" /> Mã phòng:
            </span>
            <span className="px-2 py-0.5 rounded bg-orange-500/20 border border-orange-500/40 text-orange-400 font-mono font-black">
              {joinCode}
            </span>
          </div>
        </div>

        {/* Copy Link Button */}
        <button
          type="button"
          onClick={() => {
            const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(roomId)}&code=${encodeURIComponent(joinCode)}`;
            void navigator.clipboard.writeText(inviteUrl);
            setCopiedLink(true);
            setTimeout(() => setCopiedLink(false), 2000);
          }}
          className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 transition cursor-pointer shadow-lg shadow-orange-500/25"
        >
          {copiedLink ? (
            <>
              <Check className="w-4 h-4 text-emerald-300" /> Đã Sao Chép Link Tham Gia!
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" /> Sao Chép Link Tham Gia Phòng
            </>
          )}
        </button>
      </div>
    </div>
  );
}
