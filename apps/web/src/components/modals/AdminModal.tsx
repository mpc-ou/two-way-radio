import React, { useState } from 'react';
import type { AudioRelayProfile, RoomStatePayload } from '@mpc-voicelink/protocol';
import type { AudioMetrics } from '../../services/mediaClient';
import { AdminAudioTab } from './AdminAudioTab';
import { AdminMembersTab } from './AdminMembersTab';
import { AdminNetworkTab } from './AdminNetworkTab';
import { SlidersHorizontal, Users, Radio, Crown, Shield, X } from 'lucide-react';

export type AudioPreset = 'low_latency' | 'long_range' | 'boost';

interface AdminModalProps {
  isOpen: boolean;
  isRoomAdmin: boolean;
  room: RoomStatePayload | null;
  currentClientId: string;
  audioProfile: AudioRelayProfile | null;
  inputGain: number;
  outputGain: number;
  targetDelayMs: number;
  adminCode: string;
  floorGrantRoundTripMs?: number;
  metrics: AudioMetrics;
  transportState: string;
  onClose: () => void;
  onInputGainChange: (val: number) => void;
  onOutputGainChange: (val: number) => void;
  onTargetDelayChange: (val: number) => void;
  onAdminCodeChange: (val: string) => void;
  onApplyProfile: () => void;
  onApplyLocal: () => void;
  onApplyPreset: (preset: AudioPreset) => void;
  onForceReleaseFloor: () => void;
}

export function AdminModal({
  isOpen,
  isRoomAdmin,
  room,
  currentClientId,
  audioProfile,
  inputGain,
  outputGain,
  targetDelayMs,
  adminCode,
  floorGrantRoundTripMs,
  metrics,
  transportState,
  onClose,
  onInputGainChange,
  onOutputGainChange,
  onTargetDelayChange,
  onAdminCodeChange,
  onApplyProfile,
  onApplyLocal,
  onApplyPreset,
  onForceReleaseFloor
}: AdminModalProps) {
  const [activeTab, setActiveTab] = useState<'audio' | 'members' | 'network'>('audio');

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[92dvh] flex flex-col rounded-3xl bg-slate-900 border border-white/10 shadow-2xl overflow-hidden backdrop-blur-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-3.5 sm:p-6 border-b border-white/10 bg-slate-950/60 shrink-0">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm sm:text-base md:text-lg font-black text-white">
                Bảng Quản Trị & Tối Ưu
              </h2>
              {isRoomAdmin ? (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/50 text-amber-300 text-[0.65rem] sm:text-xs font-black shadow-sm">
                  <Crown className="w-3 h-3 text-amber-400" /> CHỦ PHÒNG
                </span>
              ) : (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800 border border-white/10 text-slate-400 text-[0.65rem] sm:text-xs font-semibold">
                  <Shield className="w-3 h-3" /> THÀNH VIÊN
                </span>
              )}
            </div>
            <p className="mt-0.5 text-[0.65rem] sm:text-xs text-slate-400">
              Điều chỉnh độ lợi âm lượng, độ trễ đệm WebRTC và kiểm soát kênh đàm thoại
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 border border-white/10 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer transition shrink-0 ml-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-white/10 bg-slate-950/80 px-2 sm:px-6 gap-1 sm:gap-2 overflow-x-auto scrollbar-none shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('audio')}
            className={`flex items-center gap-1.5 py-2.5 sm:py-3 px-2.5 sm:px-4 text-xs sm:text-sm font-bold border-b-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'audio'
                ? 'border-orange-500 text-orange-400 bg-orange-500/5'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Âm Thanh
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('members')}
            className={`flex items-center gap-1.5 py-2.5 sm:py-3 px-2.5 sm:px-4 text-xs sm:text-sm font-bold border-b-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'members'
                ? 'border-orange-500 text-orange-400 bg-orange-500/5'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Thành Viên ({room?.members.length ?? 0})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('network')}
            className={`flex items-center gap-1.5 py-2.5 sm:py-3 px-2.5 sm:px-4 text-xs sm:text-sm font-bold border-b-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'network'
                ? 'border-orange-500 text-orange-400 bg-orange-500/5'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            Sóng LAN
          </button>
        </div>

        {/* Scrollable Tab Content Body */}
        <div className="p-3.5 sm:p-6 overflow-y-auto max-h-[68vh]">
          {activeTab === 'audio' && (
            <AdminAudioTab
              isRoomAdmin={isRoomAdmin}
              audioProfile={audioProfile}
              inputGain={inputGain}
              outputGain={outputGain}
              targetDelayMs={targetDelayMs}
              adminCode={adminCode}
              onInputGainChange={onInputGainChange}
              onOutputGainChange={onOutputGainChange}
              onTargetDelayChange={onTargetDelayChange}
              onAdminCodeChange={onAdminCodeChange}
              onApplyProfile={onApplyProfile}
              onApplyLocal={onApplyLocal}
              onApplyPreset={onApplyPreset}
            />
          )}

          {activeTab === 'members' && (
            <AdminMembersTab
              room={room}
              currentClientId={currentClientId}
              onForceReleaseFloor={onForceReleaseFloor}
            />
          )}

          {activeTab === 'network' && (
            <AdminNetworkTab
              floorGrantRoundTripMs={floorGrantRoundTripMs}
              metrics={metrics}
              transportState={transportState}
            />
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex justify-end p-4 sm:p-5 border-t border-white/10 bg-slate-950/60">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 transition cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
