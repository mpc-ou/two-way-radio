import type { Socket } from 'socket.io-client';
import type { SocketAck } from '@mpc-voicelink/protocol';

export class AckError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
  }
}

/** Gửi một yêu cầu Socket.IO có acknowledgement; lỗi server trả về dạng AckError(code). */
export function emitWithAck<T = Record<string, never>>(
  socket: Socket,
  event: string,
  payload: Record<string, unknown>,
  timeoutMs = 8000
): Promise<T> {
  return new Promise((resolve, reject) => {
    socket.timeout(timeoutMs).emit(event, payload, (timeoutError: Error | null, response?: SocketAck<T>) => {
      if (timeoutError) {
        reject(new AckError('TIMEOUT', `Server không phản hồi ${event}.`));
        return;
      }
      if (!response) {
        reject(new AckError('EMPTY', `Server trả về rỗng cho ${event}.`));
        return;
      }
      if (!response.ok) {
        reject(new AckError(response.error.code, response.error.message));
        return;
      }
      resolve(response.data);
    });
  });
}
