import { useState, type FormEvent } from 'react';
import { Radio } from 'lucide-react';

interface NameSetupProps {
  initialName?: string;
  onSubmit: (name: string) => void;
}

/** Màn hình duy nhất cần nhập: tên hiển thị (lưu trên máy cho lần sau). */
export function NameSetup({ initialName = '', onSubmit }: NameSetupProps) {
  const [name, setName] = useState(initialName);
  const trimmed = name.trim();

  function submit(event: FormEvent): void {
    event.preventDefault();
    if (trimmed) onSubmit(trimmed.slice(0, 40));
  }

  return (
    <form onSubmit={submit} className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 px-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <img src="/mpc-logo.webp" alt="" className="h-16 w-16 object-contain drop-shadow-[0_0_18px_rgba(249,115,22,0.45)]" />
        <h1 className="text-2xl font-black text-white">
          MPC <span className="text-orange-400">VoiceLink</span>
        </h1>
        <p className="text-sm text-slate-400">Bộ đàm nội bộ qua Wi-Fi. Nhập tên để bắt đầu.</p>
      </div>
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Tên của bạn"
        autoFocus
        maxLength={40}
        enterKeyHint="go"
        className="w-full max-w-xs rounded-2xl border border-white/10 bg-slate-900 px-4 py-3.5 text-center text-lg text-white placeholder:text-slate-500 focus:border-orange-500 focus:outline-none"
      />
      <button
        type="submit"
        disabled={!trimmed}
        className="flex w-full max-w-xs items-center justify-center gap-2 rounded-2xl bg-orange-500 py-3.5 text-base font-bold text-white active:bg-orange-600 disabled:opacity-40"
      >
        <Radio className="h-5 w-5" /> Vào bộ đàm
      </button>
    </form>
  );
}
