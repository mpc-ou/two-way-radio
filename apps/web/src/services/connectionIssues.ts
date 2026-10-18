// Chuyển lỗi kỹ thuật (Socket.IO, trình duyệt, WebRTC) thành thông báo tiếng Việt kèm gợi ý xử lý.

export type IssueKind = 'offline' | 'unreachable' | 'disconnected' | 'insecure' | 'unsupported' | 'media';

export interface ConnectionIssue {
  kind: IssueKind;
  /** Câu ngắn hiển thị đậm trên banner. */
  title: string;
  /** Gợi ý cách khắc phục. */
  hint: string;
  /** Mã kỹ thuật gốc (để người vận hành tra cứu). */
  code: string;
  since: number;
}

export type LogLevel = 'info' | 'warn' | 'error';

export interface LogEntry {
  at: number;
  level: LogLevel;
  text: string;
}

function issue(kind: IssueKind, title: string, hint: string, code: string): ConnectionIssue {
  return { kind, title, hint, code, since: Date.now() };
}

/** Lý do `disconnect` của Socket.IO client. */
export function describeDisconnect(reason: string): ConnectionIssue {
  switch (reason) {
    case 'ping timeout':
      return issue('disconnected', 'Server không phản hồi', 'Mạng đang nghẽn hoặc bạn ở quá xa router. Lại gần điểm phát Wi-Fi.', reason);
    case 'transport close':
    case 'transport error':
      return issue('disconnected', 'Mất kết nối mạng tới server', 'Wi-Fi yếu, vừa đổi mạng hoặc màn hình vừa tắt. Đang tự kết nối lại.', reason);
    case 'io server disconnect':
      return issue('disconnected', 'Server đã ngắt kết nối', 'Server vừa khởi động lại hoặc đã tắt. Báo người vận hành nếu kéo dài.', reason);
    case 'parse error':
      return issue('disconnected', 'Dữ liệu từ server bị lỗi', 'Tải lại trang. Nếu vẫn lỗi, báo người vận hành.', reason);
    default:
      return issue('disconnected', 'Mất kết nối tới server', 'Đang tự kết nối lại.', reason);
  }
}

/** Lỗi khi chưa kết nối được (`connect_error`). */
export function describeConnectError(error: Error & { description?: unknown; type?: string }): ConnectionIssue {
  const message = error.message || 'connect_error';
  if (/timeout/i.test(message)) {
    return issue('unreachable', 'Không tới được server', 'Kiểm tra điện thoại cùng Wi-Fi với máy chủ và máy chủ còn chạy. Mạng có thể đang nghẽn.', message);
  }
  if (/websocket|xhr poll|transport/i.test(message)) {
    return issue('unreachable', 'Không tới được server', 'Máy chủ có thể đã tắt, đổi IP hoặc bị firewall chặn cổng web.', message);
  }
  return issue('unreachable', 'Không tới được server', 'Kiểm tra Wi-Fi và địa chỉ trang. Đang thử lại.', message);
}

export function describeOffline(): ConnectionIssue {
  return issue('offline', 'Điện thoại đang mất Wi-Fi', 'Bật lại Wi-Fi hoặc lại gần điểm phát. Ứng dụng tự vào lại khi có mạng.', 'navigator.offline');
}

/** Kiểm tra môi trường ngay khi mở trang. */
export function checkEnvironment(): ConnectionIssue | undefined {
  if (!window.isSecureContext) {
    return issue('insecure', 'Trang chưa mở bằng HTTPS', 'Micro sẽ không hoạt động. Mở bằng https:// và cài chứng chỉ của máy chủ trên điện thoại.', 'insecure-context');
  }
  if (typeof RTCPeerConnection === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return issue('unsupported', 'Trình duyệt không hỗ trợ bộ đàm', 'Dùng Chrome (Android) hoặc Safari (iPhone) bản mới.', 'no-webrtc');
  }
  return undefined;
}

/** Đường âm thanh (WebRTC) hỏng dù socket vẫn còn. */
export function describeMediaFailure(detail: string): ConnectionIssue {
  return issue('media', 'Mất đường âm thanh', 'Có thể firewall máy chủ chặn UDP 44444 hoặc Wi-Fi quá yếu. Đang kết nối lại.', detail);
}

/** Lỗi thao tác (ack) thành câu dễ hiểu; trả về message gốc nếu không nhận ra. */
export function describeRequestError(error: unknown): string {
  const code = typeof error === 'object' && error && 'code' in error ? String((error as { code: unknown }).code) : '';
  if (code === 'TIMEOUT') return 'Server phản hồi chậm (mạng nghẽn). Thử lại sau vài giây.';
  if (code === 'CHANNEL_FULL') return 'Channel đã đủ người.';
  return error instanceof Error ? error.message : 'Lỗi không xác định.';
}

export function formatLogTime(at: number): string {
  return new Date(at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
