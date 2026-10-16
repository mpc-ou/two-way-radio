import React from 'react';

export function AmbientBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
      {/* Floating Animated Glow Orbs */}
      <div className="absolute top-[8%] left-[12%] w-[420px] h-[420px] rounded-full bg-orange-600/15 blur-[120px] animate-float-1" />
      <div className="absolute bottom-[10%] right-[10%] w-[480px] h-[480px] rounded-full bg-cyan-600/10 blur-[130px] animate-float-2" />
      <div className="absolute top-[45%] right-[25%] w-[320px] h-[320px] rounded-full bg-purple-600/10 blur-[110px] animate-pulse-glow" />

      {/* Futuristic SVG Cyber Grid */}
      <svg className="absolute inset-0 w-full h-full" width="100%" height="100%">
        <defs>
          <pattern id="cyber-grid" width="48" height="48" patternUnits="userSpaceOnUse">
            <path d="M 48 0 L 0 0 0 48" fill="none" stroke="rgba(255, 255, 255, 0.035)" strokeWidth="1" />
            <circle cx="48" cy="48" r="1.2" fill="rgba(249, 115, 22, 0.25)" />
          </pattern>
          <radialGradient id="ambient-vignette" cx="50%" cy="45%" r="65%">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="60%" stopColor="#07090e" stopOpacity="0.65" />
            <stop offset="100%" stopColor="#07090e" stopOpacity="0.95" />
          </radialGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#cyber-grid)" />
        <rect width="100%" height="100%" fill="url(#ambient-vignette)" />
      </svg>

      {/* Sci-Fi HUD Corner Markings */}
      <div className="hidden md:flex absolute top-5 left-6 items-center gap-2 opacity-35 text-[0.65rem] tracking-[0.15em] font-mono text-slate-400">
        <span className="w-2.5 h-2.5 border-l-2 border-t-2 border-orange-500" />
        <span>MPC // VOICELINK PROTOCOL</span>
      </div>
      <div className="hidden md:flex absolute top-5 right-6 items-center gap-2 opacity-35 text-[0.65rem] tracking-[0.15em] font-mono text-slate-400">
        <span>LOCAL LAN PTT • OPUS 48kHz</span>
        <span className="w-2.5 h-2.5 border-r-2 border-t-2 border-cyan-500" />
      </div>
    </div>
  );
}
