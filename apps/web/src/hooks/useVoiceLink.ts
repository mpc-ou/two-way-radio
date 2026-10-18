import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { VoiceLinkClient, type VoiceLinkState } from '../services/voiceLinkClient';
import { newClientId } from '../utils/format';
import { channelFromUrl, storage } from '../utils/storage';

/**
 * Tạo một VoiceLinkClient cho cả vòng đời trang (khi đã có tên) và theo dõi state của nó.
 * Đổi tên sau đó đi qua client.setDisplayName, không tạo lại kết nối.
 */
export function useVoiceLink(displayName: string): { client?: VoiceLinkClient; state?: VoiceLinkState } {
  const [client, setClient] = useState<VoiceLinkClient>();
  const nameRef = useRef(displayName);
  nameRef.current = displayName;
  const hasName = displayName.length > 0;

  useEffect(() => {
    if (!hasName) return undefined;
    const created = new VoiceLinkClient(newClientId(), nameRef.current, channelFromUrl() ?? storage.getLastChannel());
    setClient(created);
    return () => created.destroy();
  }, [hasName]);

  const state = useSyncExternalStore(
    client?.subscribe ?? noopSubscribe,
    client?.getState ?? noState,
    client?.getState ?? noState
  );
  return { client, state };
}

const noopSubscribe = (): (() => void) => () => undefined;
const noState = (): undefined => undefined;
