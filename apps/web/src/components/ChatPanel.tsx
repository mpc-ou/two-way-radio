import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { MessageSquare, SendHorizontal } from 'lucide-react';
import { CHAT_MAX_LENGTH, type ChatMessage } from '@mpc-voicelink/protocol';

interface ChatPanelProps {
  messages: ChatMessage[];
  myClientId: string;
  disabled: boolean;
  onSend: (text: string) => Promise<boolean>;
}

function formatTime(at: number): string {
  return new Date(at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

/** Chat của channel hiện tại, nằm ngay dưới nút PTT. */
export function ChatPanel({ messages, myClientId, disabled, onSend }: ChatPanelProps) {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  // Chỉ tự cuộn xuống khi người dùng đang ở cuối danh sách (không giật khi đang đọc tin cũ).
  useLayoutEffect(() => {
    const list = listRef.current;
    if (list && stickToBottom.current) list.scrollTop = list.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (disabled) setDraft('');
  }, [disabled]);

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    stickToBottom.current = true;
    const sent = await onSend(text);
    setSending(false);
    if (sent) setDraft('');
  }

  return (
    <section className="flex min-h-0 w-full max-w-md flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60">
      <div
        ref={listRef}
        onScroll={(event) => {
          const el = event.currentTarget;
          stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        }}
        className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto overscroll-contain px-3 py-2"
        aria-live="polite"
      >
        {messages.length === 0 && (
          <div className="m-auto flex flex-col items-center gap-1 text-slate-500">
            <MessageSquare className="h-5 w-5" />
            <span className="text-xs">{disabled ? 'Vào channel để chat' : 'Chưa có tin nhắn'}</span>
          </div>
        )}
        {messages.map((message, index) => {
          const mine = message.clientId === myClientId;
          const showName = !mine && messages[index - 1]?.clientId !== message.clientId;
          return (
            <div key={message.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
              {showName && <span className="px-1 text-[0.68rem] font-semibold text-orange-300">{message.displayName}</span>}
              <div
                className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-1.5 text-sm select-text ${
                  mine ? 'rounded-br-md bg-orange-500 text-white' : 'rounded-bl-md bg-slate-800 text-slate-100'
                }`}
              >
                {message.text}
                <span className={`ml-2 align-bottom text-[0.6rem] ${mine ? 'text-orange-100/80' : 'text-slate-400'}`}>
                  {formatTime(message.at)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={(event) => void submit(event)} className="flex items-center gap-2 border-t border-white/10 p-2">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          disabled={disabled}
          maxLength={CHAT_MAX_LENGTH}
          placeholder={disabled ? 'Chưa vào channel' : 'Nhắn cho cả channel…'}
          enterKeyHint="send"
          autoComplete="off"
          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-orange-500 focus:outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={disabled || sending || !draft.trim()}
          aria-label="Gửi"
          className="rounded-xl bg-orange-500 p-2.5 text-white active:bg-orange-600 disabled:opacity-40"
        >
          <SendHorizontal className="h-4 w-4" />
        </button>
      </form>
    </section>
  );
}
