export function newClientId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `client-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function formatMs(value: number | undefined): string {
  return value === undefined ? '—' : `${value} ms`;
}

