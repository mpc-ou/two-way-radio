import React from 'react';

export function Footer() {
  return (
    <footer className="mt-auto py-6 px-4 text-center border-t border-white/5 bg-slate-950/70 backdrop-blur-md">
      <p className="text-xs font-semibold text-slate-400">
        CLB Lập trình trên thiết bị di động (MPC) • Khoa CNTT • Trường Đại học Mở TP.HCM
      </p>
      <p className="mt-1 text-[0.7rem] text-slate-500">
        © 2026{' '}
        <a
          href="https://www.mpclub.dev"
          target="_blank"
          rel="noopener noreferrer"
          className="text-orange-400 hover:text-orange-300 font-bold transition"
        >
          MPClub
        </a>{' '}
        – Mobile Programming Club. All rights reserved.
      </p>
    </footer>
  );
}

