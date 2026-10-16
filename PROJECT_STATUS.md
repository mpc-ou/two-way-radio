# MPC VoiceLink — Trạng thái dự án

Cập nhật: 2026-10-14 (Asia/Ho_Chi_Minh)

## Trạng thái tổng quan

Dự án đã được khởi tạo lại thành ứng dụng trình duyệt chạy trong mạng LAN. Mã nguồn Flutter/mobile đã được chủ động loại bỏ. Repository hiện là monorepo Turborepo gồm web client React/Vite, server NestJS/mediasoup và một package protocol dùng chung.

Dự án đã có luồng audio realtime trong mã nguồn: browser tạo mediasoup transport, chỉ lấy microphone/produce sau khi server cấp floor, server xác thực floor token, tạo Consumer cho người nghe và browser phát audio qua Web Audio. Chưa có kết quả kiểm thử microphone, UDP mediasoup và audio giữa các thiết bị thật trong Hotspot.

## Hạng mục đã hoàn thành

| Hạng mục | Trạng thái | Nội dung hiện có |
|---|---|---|
| Monorepo | Hoàn thành | npm workspaces + Turborepo điều phối `apps/web`, `apps/server` và `packages/protocol`. |
| Web client | Hoàn thành (chưa test thiết bị thật) | React/Vite kết nối Socket.IO, vào phòng, xin/nhả floor, tạo mediasoup recv/send transport, lấy mic sau `FLOOR_GRANTED`, produce Opus và phát Consumer audio. PTT tự nhả khi mất focus/đổi tab và chặn lệnh release trùng. |
| Protocol dùng chung | Hoàn thành | `packages/protocol` quản lý hằng số event và khai báo TypeScript payload, được dùng ở cả server lẫn trình duyệt. |
| Lõi PTT server | Hoàn thành | Thành viên phòng, quyền nói tuần tự cho một người, nhả bằng token, gia hạn heartbeat, hết hạn và khôi phục khi mất kết nối. |
| Signaling server | Hoàn thành | Handler Socket.IO kiểm tra room/floor và các yêu cầu media ack: capability, tạo/kết nối transport, Producer, Consumer, teardown và audio profile. |
| Nền tảng mediasoup | Hoàn thành (chưa test UDP thật) | Worker/router Opus, WebRtcTransport UDP, Producer/Consumer paused-resume và cleanup theo floor/disconnect. |
| UI audio | Hoàn thành (chưa test thiết bị thật) | Slider gain mic/loa, target playout profile, level mic, RTT cấp floor/WebRTC, jitter và packet loss; **Bật loa** prewarm/resume AudioContext trong user gesture cho browser điện thoại; runtime profile cần `AUDIO_CONTROL_CODE`. |
| Sẵn sàng TLS cho trình duyệt | Một phần | Local CA/certificate SAN đã được tạo; `apps/server/.env` và `apps/web/.env.local` đã trỏ tới certificate/key và CORS HTTPS LAN. NestJS HTTPS, certificate verification và Socket.IO WSS handshake với origin web LAN đã đạt cục bộ. Cần cài/trust CA trên điện thoại và kiểm thử audio HTTPS/WSS thật. |
| Flutter/mobile | Đã chủ động loại bỏ | `apps/mobile` không còn thuộc dự án hoặc lộ trình. |
| Quy tắc kỹ thuật | Hoàn thành | `SKILL.md` ở root quy định kiến trúc, PTT, bảo mật, code, kiểm tra và tài liệu cho các người/AI phát triển tiếp theo. |

## Đã kiểm tra cục bộ sau khi chuyển sang web

| Kiểm tra | Kết quả |
|---|---|
| `npm.cmd install` | Đạt; lockfile đã cập nhật Turbo, React/Vite và Socket.IO client. |
| `npm.cmd run typecheck` | Đạt cho workspace server và web qua Turborepo. |
| `npm.cmd run build` | Đạt; NestJS đã biên dịch và Vite đã tạo bundle production. |
| Xem trước Vite production | Đạt; request HTTP cục bộ tới trang web đã build nhận mã `200`. Tiến trình preview đã được dừng sau đó. |
| Khởi động server sau khi sửa DI | Đạt từ bản server đã biên dịch; NestJS đã đăng ký các event signaling và router mediasoup đã khởi tạo. Tiến trình kiểm tra đã được dừng sau đó. |
| Smoke test floor trên server | Đạt sau khi chuyển sang shared protocol: yêu cầu đầu tiên thắng, yêu cầu đồng thời bị từ chối, nhả thành công, sau đó client còn lại nhận được floor. |
| `npm.cmd run typecheck` sau media | Đạt cho web và server. |
| `npm.cmd run build` sau media | Đạt; Vite bundle gồm `mediasoup-client`. |
| Khởi động server đã build sau media | Đạt đến lúc mediasoup router khởi tạo; cổng `3000` đang được một tiến trình khác sử dụng nên test dùng cổng riêng đã khởi động thành công. |
| Smoke test signaling media | Đạt với server cổng tách biệt/mã test tạm thời: JOIN_ROOM, lấy router RTP capabilities và tạo receive WebRtcTransport qua Socket.IO acknowledgement. |
| Kiểm tra Hotspot/trình duyệt trên thiết bị thật | Chưa chạy. |
| Kiểm tra microphone trình duyệt qua HTTPS/WSS | Chưa chạy. |

## Công việc còn lại

### Mốc tiếp theo: kiểm tra control plane trên LAN

1. Đặt `ROOM_JOIN_CODE`, `MEDIASOUP_ANNOUNCED_ADDRESS`, `CORS_ORIGINS` và (nếu cần chỉnh từ UI) `AUDIO_CONTROL_CODE` thực tế trong `apps/server/.env`.
2. Cấp certificate cục bộ được hai thiết bị tin cậy; đặt đường dẫn cho server và `apps/web/.env.local`, sau đó chạy HTTPS/WSS.
3. Mở URL HTTPS của Vite từ hai thiết bị cùng Hotspot, cấp quyền mic cho speaker và kiểm tra người nghe nhận audio.
4. Kiểm tra Windows Firewall cho cổng TCP server/Vite và UDP `MEDIASOUP_RTC_MIN_PORT` đến `MEDIASOUP_RTC_MAX_PORT`.
5. Kiểm tra hai yêu cầu PTT đồng thời, nhả nhanh, mất Wi-Fi/đóng tab speaker và quyền tiếp quản sau heartbeat expiry.

### Media cần nghiệm thu trên thiết bị thật

1. Xác nhận ICE/DTLS/UDP WebRtcTransport kết nối từ đúng điện thoại/Hotspot; ghi nhận lỗi candidate/Firewall nếu có.
2. Xác nhận browser chỉ gọi `getUserMedia` sau `FLOOR_GRANTED`, Producer bị từ chối khi floor token cũ và mic track thực sự dừng khi nhả.
3. Xác nhận Consumer phát được audio, autoplay fallback **Bật loa** hoạt động và cleanup đúng khi speaker rời phòng.
4. Benchmark bitrate 24/32/40 kbps với profile `OPUS_BITRATE`/`MAX_OUTGOING_BITRATE`; không đổi codec hay packetization chỉ dựa vào phỏng đoán.

### Củng cố và đo lường

- Thêm unit/integration test cho client ID trùng, lease hết hạn, kết nối lại, yêu cầu floor song song và dọn tài nguyên.
- Thêm metrics chỉ cục bộ, có giới hạn: độ trễ cấp floor, RTT, jitter, packet loss, CPU/RAM và số thành viên phòng.
- Xác định chính sách âm thanh cũ/drop đã được kiểm thử; không có hàng đợi audio/stat không giới hạn.
- Chạy test audio 2 client, tranh quyền 3–5 client, đóng tab/mất Wi-Fi cưỡng bức, người nghe chậm và soak test 30–60 phút.
- Thay mã tham gia chung bằng xác thực theo người dùng/thiết bị nếu threat model yêu cầu.

## Ràng buộc quan trọng

- UI không được bật media chỉ vì nút PTT được bấm; bắt buộc phải có `FLOOR_GRANTED` từ server.
- Microphone trình duyệt trong LAN yêu cầu HTTPS được chính trình duyệt đó tin cậy. HTTP chỉ dùng để kiểm thử UI/control.
- MVP chỉ chạy LAN, không có cloud relay/TURN dự phòng. Nếu Hotspot chặn LAN hoặc UDP, cần sửa cấu hình Hotspot thay vì gửi âm thanh ra Internet.
- Chính sách server có thể giới hạn bitrate và từ chối media cũ, nhưng không thể ép độ trễ đầu ra chính xác cho mọi trình duyệt/thiết bị.
- Không bao giờ commit, in log hoặc làm lộ `apps/server/.env`, TLS private key, join code, floor token hay audio payload.

## Lệnh hiện dùng

    npm.cmd run dev
    npm.cmd run dev:web
    npm.cmd run dev:server
    npm.cmd run typecheck
    npm.cmd run build
