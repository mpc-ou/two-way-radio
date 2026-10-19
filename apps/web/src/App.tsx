import { useCallback, useEffect, useState } from 'react';
import { Volume2 } from 'lucide-react';
import { AppDrawer } from './components/AppDrawer';
import { ChannelSheet } from './components/ChannelSheet';
import { ChatPanel } from './components/ChatPanel';
import { ConnectionBanner } from './components/ConnectionBanner';
import { NameSetup } from './components/NameSetup';
import { PttButton } from './components/PttButton';
import { SpeakerBanner } from './components/SpeakerBanner';
import { TopBar } from './components/TopBar';
import { useVoiceLink } from './hooks/useVoiceLink';
import { useWakeLock } from './hooks/useWakeLock';
import type { VoiceLinkState } from './services/voiceLinkClient';
import { storage } from './utils/storage';

const NOTICE_MS = 3500;

export function App() {
  const [displayName, setDisplayName] = useState(storage.getName);
  const { client, state } = useVoiceLink(displayName);
  const [channelsOpen, setChannelsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [volume, setVolume] = useState(storage.getVolume);
  const [playoutDelayMs, setPlayoutDelayMs] = useState(storage.getPlayoutDelay);
  const [visibleNotice, setVisibleNotice] = useState<VoiceLinkState['notice']>();
  const wakeLockHeld = useWakeLock(Boolean(state?.channelId));

  const inChannel = Boolean(state?.channelId);
  const notJoined = state?.status === 'online' && !state.channelId && !state.joiningChannelId;

  // Chưa ở channel nào: mở sẵn danh sách để chạm là vào.
  useEffect(() => {
    if (notJoined && (state?.channels.length ?? 0) > 0) setChannelsOpen(true);
  }, [notJoined, state?.channels.length]);

  // Channel cần PIN: mở danh sách để hiện ô nhập.
  useEffect(() => {
    if (state?.pinPrompt) setChannelsOpen(true);
  }, [state?.pinPrompt]);

  // Vào channel thành công thì đóng danh sách.
  useEffect(() => {
    if (state?.channelId) setChannelsOpen(false);
  }, [state?.channelId]);

  useEffect(() => {
    const notice = state?.notice;
    if (!notice) return undefined;
    setVisibleNotice(notice);
    const timer = window.setTimeout(() => setVisibleNotice(undefined), NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [state?.notice]);

  // Rời tab/khóa màn hình khi đang giữ PTT: nhả ngay để không chiếm kênh.
  useEffect(() => {
    if (!client) return undefined;
    const release = (): void => {
      if (document.visibilityState !== 'visible') client.releaseTalk();
    };
    const pagehide = (): void => client.releaseTalk();
    document.addEventListener('visibilitychange', release);
    window.addEventListener('pagehide', pagehide);
    return () => {
      document.removeEventListener('visibilitychange', release);
      window.removeEventListener('pagehide', pagehide);
    };
  }, [client]);

  // Trình duyệt điện thoại chỉ cho phát âm thanh (tiếng nói, âm báo chat) sau một thao tác của
  // người dùng: mở khóa ở bất kỳ lần chạm/phím nào, không chỉ khi bấm nút nói.
  useEffect(() => {
    if (!client) return undefined;
    const unlock = (): void => client.unlockAudio();
    document.addEventListener('pointerdown', unlock, { passive: true });
    document.addEventListener('keydown', unlock);
    return () => {
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
    };
  }, [client]);

  const press = useCallback(() => client?.pressTalk(), [client]);
  const release = useCallback(() => client?.releaseTalk(), [client]);

  if (!displayName) {
    return (
      <NameSetup
        onSubmit={(name) => {
          storage.setName(name);
          setDisplayName(name);
        }}
      />
    );
  }

  if (!client || !state) return null;

  const channel = state.channels.find((item) => item.id === state.channelId);
  const room = state.room;
  const speaker = room?.members.find((member) => member.clientId === room.speakerClientId);
  const isMeSpeaker = room?.speakerClientId === client.myClientId;
  const busy = Boolean(room?.speakerClientId && !isMeSpeaker);
  const pttDisabled = !inChannel || state.media !== 'ready';

  return (
    <div className="flex h-[100dvh] flex-col">
      <TopBar
        channel={channel}
        joining={Boolean(state.joiningChannelId)}
        status={state.status}
        media={state.media}
        onOpenChannels={() => setChannelsOpen(true)}
        onOpenMenu={() => setMenuOpen(true)}
      />

      <ConnectionBanner issue={state.issue} envIssue={state.envIssue} reconnectAttempt={state.reconnectAttempt} />

      {/* Toast nằm phía trên ô nhập chat để không che dòng "ai đang nói". */}
      <div className="pointer-events-none fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-20 flex justify-center">
        {visibleNotice && (
          <div
            key={visibleNotice.at}
            className={`animate-toast-in max-w-md rounded-xl px-3 py-2 text-center text-sm shadow-lg ${
              visibleNotice.tone === 'error'
                ? 'bg-red-600/95 text-white'
                : visibleNotice.tone === 'warn'
                  ? 'bg-amber-500/95 text-slate-950'
                  : 'bg-slate-800/95 text-slate-100'
            }`}
          >
            {visibleNotice.text}
          </div>
        )}
      </div>

      <main className="flex min-h-0 flex-1 flex-col items-center gap-3 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="w-full max-w-md shrink-0">
          {state.audioBlocked ? (
            <button
              type="button"
              onClick={() => client.unlockAudio()}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 font-bold text-white"
            >
              <Volume2 className="h-5 w-5" /> Chạm để bật loa
            </button>
          ) : (
            <SpeakerBanner speakerName={speaker?.displayName} isMe={isMeSpeaker} />
          )}
        </div>

        <div className="flex shrink-0 items-center justify-center py-1">
          {inChannel ? (
            <PttButton
              phase={state.phase}
              busy={busy}
              disabled={pttDisabled}
              inputLevel={state.metrics.inputLevel}
              onPress={press}
              onRelease={release}
            />
          ) : (
            <button
              type="button"
              onClick={() => setChannelsOpen(true)}
              className="rounded-2xl border border-white/10 bg-slate-900 px-6 py-4 text-base font-semibold text-slate-200"
            >
              {state.status === 'online' ? 'Chọn channel để bắt đầu' : 'Đang kết nối tới server…'}
            </button>
          )}
        </div>

        {/* Chat của channel ngay dưới mic, chiếm phần còn lại của màn hình. */}
        <ChatPanel
          messages={state.chat}
          myClientId={client.myClientId}
          disabled={!inChannel}
          onSend={(text) => client.sendChat(text)}
        />
      </main>

      <ChannelSheet
        open={channelsOpen}
        channels={state.channels}
        currentChannelId={state.channelId}
        joiningChannelId={state.joiningChannelId}
        pinPrompt={state.pinPrompt}
        onSelect={(channelId, pin) => void client.joinChannel(channelId, pin)}
        onCancelPin={() => client.dismissPinPrompt()}
        onClose={() => {
          client.dismissPinPrompt();
          setChannelsOpen(false);
        }}
      />

      <AppDrawer
        open={menuOpen}
        state={state}
        myClientId={client.myClientId}
        displayName={displayName}
        volume={volume}
        playoutDelayMs={playoutDelayMs}
        wakeLockHeld={wakeLockHeld}
        onClose={() => setMenuOpen(false)}
        onVolumeChange={(value) => {
          setVolume(value);
          client.setVolume(value);
        }}
        onPlayoutDelayChange={(value) => {
          setPlayoutDelayMs(value);
          client.setPlayoutDelay(value);
        }}
        onTestBeep={() => client.testBeep()}
        onChatSoundChange={(enabled) => client.setChatSound(enabled)}
        onInputDeviceChange={(deviceId) => void client.setInputDevice(deviceId)}
        onOutputDeviceChange={(deviceId) => void client.setOutputDevice(deviceId)}
        onRename={(name) => {
          setDisplayName(name.trim());
          client.setDisplayName(name);
        }}
        onLeave={() => {
          setMenuOpen(false);
          void client.leaveChannel();
        }}
        onForceRelease={(code) => client.forceReleaseFloor(code)}
        getLogText={() => client.logText()}
      />
    </div>
  );
}
