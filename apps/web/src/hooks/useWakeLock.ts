import { useEffect, useState } from 'react';

interface WakeLockSentinelLike {
  released: boolean;
  release(): Promise<void>;
  addEventListener(type: 'release', listener: () => void): void;
}

interface WakeLockNavigator {
  wakeLock?: { request(type: 'screen'): Promise<WakeLockSentinelLike> };
}

/** Giữ màn hình sáng khi đang ở trong channel; tự xin lại khi quay lại tab. */
export function useWakeLock(active: boolean): boolean {
  const [held, setHeld] = useState(false);

  useEffect(() => {
    const api = (navigator as Navigator & WakeLockNavigator).wakeLock;
    if (!active || !api) return undefined;
    let sentinel: WakeLockSentinelLike | undefined;
    let cancelled = false;

    const acquire = async (): Promise<void> => {
      if (document.visibilityState !== 'visible' || (sentinel && !sentinel.released)) return;
      try {
        const next = await api.request('screen');
        if (cancelled) {
          void next.release();
          return;
        }
        sentinel = next;
        setHeld(true);
        next.addEventListener('release', () => setHeld(false));
      } catch {
        setHeld(false);
      }
    };
    const onVisibility = (): void => {
      void acquire();
    };

    void acquire();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      void sentinel?.release().catch(() => undefined);
      setHeld(false);
    };
  }, [active]);

  return held;
}
