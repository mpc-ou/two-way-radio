import { useState, useEffect, useRef, useCallback } from 'react';

export function useWakeLock(enabled: boolean, shouldBeActive: boolean) {
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const wakeLockRef = useRef<any>(null);

  const acquire = useCallback(async () => {
    if ('wakeLock' in navigator && enabled) {
      try {
        const sentinel = await (navigator as any).wakeLock.request('screen');
        wakeLockRef.current = sentinel;
        setWakeLockActive(true);
        sentinel.addEventListener('release', () => {
          setWakeLockActive(false);
        });
      } catch (err) {
        console.warn('Wake Lock request note:', err);
      }
    }
  }, [enabled]);

  const release = useCallback(() => {
    if (wakeLockRef.current) {
      void wakeLockRef.current.release().catch(() => undefined);
      wakeLockRef.current = null;
      setWakeLockActive(false);
    }
  }, []);

  useEffect(() => {
    if (shouldBeActive && enabled) {
      void acquire();
    } else {
      release();
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && shouldBeActive && enabled) {
        void acquire();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      release();
    };
  }, [shouldBeActive, enabled, acquire, release]);

  return { wakeLockActive, acquire, release };
}

