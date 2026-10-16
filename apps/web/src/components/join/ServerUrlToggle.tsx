import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Server } from 'lucide-react';

interface ServerUrlToggleProps {
  serverUrl: string;
  disabled: boolean;
  onChange: (url: string) => void;
}

export function ServerUrlToggle({ serverUrl, disabled, onChange }: ServerUrlToggleProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="flex flex-col gap-2 pt-1">
      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="flex items-center gap-1.5 text-[0.78rem] font-bold text-slate-400 hover:text-orange-400 transition self-start cursor-pointer"
      >
        <Server className="w-3.5 h-3.5 text-orange-400" />
        <span>{showAdvanced ? 'Ẩn địa chỉ server' : 'Tùy chỉnh Server URL'}</span>
        {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>

      {showAdvanced && (
        <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-slate-900/60 border border-white/5">
          <label className="text-xs font-semibold text-slate-300">Server URL (Signaling & Relay)</label>
          <input
            value={serverUrl}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://172.22.177.111:5173"
            className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950/80 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-orange-500 transition disabled:opacity-50"
          />
        </div>
      )}
    </div>
  );
}
