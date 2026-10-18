# MPC VoiceLink — Trạng thái dự án

Cập nhật: 2026-10-17 (Asia/Ho_Chi_Minh)

## Trạng thái tổng quan

Repository là monorepo Turborepo với hai chế độ:

- **LAN (chính):** `apps/server` là **một tiến trình NestJS** phục vụ HTTPS, giao diện web đã build (`apps/web/dist`), Socket.IO và mediasoup SFU. `apps/web` (React 19 + **Vite 8**, chỉ build/`build --watch`) là giao diện mobile-first: nhập tên một lần, chọn **channel cố định** (PIN tùy chọn), giữ nút để nói.
- **P2P Serverless:** `apps/web-p2p` (PeerJS, Vercel). Không thay đổi trong đợt này.

Ngày 2026-10-17 chế độ LAN được viết lại theo plan "NestJS một service + Vite 8, channel cố định, mobile-first". Mô hình room key và Vite dev server/proxy trước đó đã bị thay thế.

## Chế độ LAN — đã làm

| Hạng mục | Nội dung |
|---|---|
| Một service | `main.ts` chạy HTTPS (`PORT=443`), phục vụ `WEB_DIST_PATH` bằng Express của Nest (asset hash cache lâu, `index.html` no-cache, SPA fallback trừ `/health` và `/socket.io`), in URL LAN khi khởi động. Không còn `apps/web/.env.local`, `CORS_ORIGINS` hay Vite proxy. |
| Channel cố định | `CHANNELS_FILE` (`apps/server/channels.json`, bị Git bỏ qua; mẫu `channels.example.json`) khai báo `{ id, name, color, pin? }`. `RoomsService` tạo room cho mỗi channel lúc boot, PIN lưu dạng SHA-256 và so sánh `timingSafeEqual`, tối đa `MAX_MEMBERS_PER_ROOM=15`. Sai PIN quá `JOIN_MAX_FAILURES` lần thì chặn theo IP. |
| Protocol | `LIST_CHANNELS`, `JOIN_CHANNEL` (ack trả `ROOM_STATE` hoặc mã lỗi `PIN_REQUIRED/PIN_INVALID/PIN_BLOCKED/CHANNEL_FULL/CHANNEL_NOT_FOUND`), `LEAVE_CHANNEL`, `RESTART_ICE`, push `CHANNELS_UPDATE` (số người, ai đang nói). Bỏ `CREATE_ROOM`, `JOIN_ROOM`, room key, `UPDATE_POSITION`. |
| Producer PAUSED (độ trễ thấp) | Vào channel là mở mic và produce ngay. Server tạo Producer `paused` và chỉ `resume()` khi cấp floor (rồi mới gửi `FLOOR_GRANTED`); nhả, hết lease, thu hồi hay mất kết nối thì `pause()` trước rồi mới gửi `FLOOR_RELEASED`. Thao tác pause/resume tuần tự theo từng channel để không bị race. Consumer tạo sẵn cho mọi Producer trong channel. |
| Đổi channel | Cùng socket, giữ transport (không bắt tay ICE/DTLS lại). Server đóng Producer/Consumer cũ, tạo Consumer mới; client tạo lại Producer. |
| Phục hồi | Socket.IO tự kết nối lại và vào lại channel cuối. Thành viên chỉ bị xóa khi chính socket đó rời (socket mới vào lại trước khi server xử lý disconnect cũ không bị đá). ICE restart khi transport `disconnected` (sau 1,5 s) hoặc `failed`; 8 s vẫn hỏng thì dựng lại toàn bộ kết nối. |
| Admin | Chỉ còn `AUDIO_CONTROL_CODE` (so sánh constant-time). Để trống thì tắt admin. Đã bỏ fallback `admin123`. |
| Chat theo channel | `SEND_CHAT` (ack), server đẩy `CHAT_MESSAGE` cho đúng channel; khi vào channel nhận `CHAT_HISTORY` (50 tin gần nhất, `CHAT_HISTORY_SIZE`). Chỉ giữ trong RAM. Server kiểm tra: phải đang ở channel, bỏ ký tự điều khiển, tối đa `CHAT_MAX_LENGTH`=500 ký tự, tối đa 5 tin / 5 giây mỗi socket. UI: `ChatPanel` ngay dưới nút mic (nút mic thu nhỏ còn `min(58vw, 32dvh, 15rem)`), tự cuộn khi đang ở cuối, Space trong ô chat không kích hoạt PTT, viewport `interactive-widget=resizes-content` để bàn phím Android thu layout thay vì che. |
| Báo lỗi cho người dùng | `services/connectionIssues.ts` chuyển lỗi kỹ thuật thành câu tiếng Việt kèm gợi ý: lý do `disconnect` của Socket.IO (`ping timeout`, `transport close/error`, `io server disconnect`), `connect_error` (không tới được server), sự kiện `offline/online` của trình duyệt, ICE/âm thanh thất bại, trang không HTTPS hoặc trình duyệt không hỗ trợ WebRTC, ack `TIMEOUT`. `ConnectionBanner` cố định dưới thanh trên (thời gian mất kết nối, số lần thử lại, mã gốc), tự ẩn khi nối lại, kèm toast "Đã kết nối lại sau X giây. Đã vào <channel>." Menu → **Nhật ký sự cố**: 50 sự kiện gần nhất, nút sao chép (kèm user agent) để gửi người vận hành. Server log mỗi lần ngắt kèm channel và lý do. |
| Chọn thiết bị âm thanh | `services/audioDevices.ts` liệt kê micro/loa; `VoiceMedia.setInputDevice` mở micro theo `deviceId` rồi `producer.replaceTrack` (không ngắt kết nối, giữ trạng thái pause/floor); `setOutputDevice` dùng `setSinkId` cho mọi `<audio>` và AudioContext tiếng bíp (chỉ Chrome/Edge; Safari/iOS hiện lời giải thích). Theo dõi `devicechange`: báo thiết bị mới trong nhật ký, tự chuyển lại sang micro đã chọn khi tai nghe/Bluetooth kết nối lại, loa đã chọn biến mất thì về mặc định. Track micro kết thúc (rút tai nghe) thì tự chuyển về micro mặc định thay vì ngắt cả kết nối như trước. Lưu lựa chọn trong localStorage. UI: `DevicePicker` trong Menu → Âm thanh, kèm dòng "Đang thu". |
| Health | `/health`: channel (số người, đang nói), số Producer/paused/Consumer, byte RTP vào từ từng Producer và tổng byte chuyển tiếp. |
| Web client | `VoiceLinkClient` (socket + channel + máy trạng thái PTT, không phụ thuộc React) và `VoiceMedia` (mediasoup-client: mic mono EC/NS/AGC, Opus FEC, DTX tắt, ptime 20; mỗi người nói một `<audio>` riêng, không qua Web Audio; `jitterBufferTarget`/`playoutDelayHint`; bíp talk-permit/kết thúc/bận; mức mic, RTT, jitter, mất gói). React đọc state qua `useSyncExternalStore`. |
| UI mobile | Một màn hình `100dvh`: TopBar (channel + số người, chấm trạng thái, ☰), banner "ai đang nói", nút PTT lớn (Space trên máy tính), chip số người. `ChannelSheet` là bottom sheet, PIN nhập ngay tại dòng. `AppDrawer` có các mục gập: Âm thanh, Thành viên, Chẩn đoán, Chia sẻ (QR), Admin, Tài khoản. Wake lock, PWA manifest. Đã xóa landing/bản đồ/ban/vị trí. |
| Build/dev | `npm run dev:lan` (tsx watch + `vite build --watch`), `npm run start:lan`. Vite 8.3.2 và `@vitejs/plugin-react` 6.1.1 chỉ trong `apps/web`; `web-p2p` vẫn Vite 7. |

## Đã kiểm tra (2026-10-17)

| Kiểm tra | Kết quả |
|---|---|
| `npm run typecheck`, `npm run build` | Đạt cho `server`, `web`, `web-p2p`. |
| Smoke test server qua `https://10.173.146.111:8443` (Socket.IO client, CA LAN) | Đạt 21/21: SPA + fallback + `/health`; danh sách channel; PIN thiếu/sai/đúng; channel không tồn tại; floor grant/deny/release; người nói hiển thị trong danh sách; đổi channel; `CHANNELS_UPDATE`; admin bị từ chối khi sai mã; kết nối lại cùng clientId; chặn dò PIN. |
| E2E Chrome headless, 2 browser context, mic giả, HTTPS LAN | Đạt 14/14: hai máy vào channel, Producer khởi tạo PAUSED, không chuyển tiếp byte nào khi không ai nói; bấm PTT thì Producer resume (~77 ms đo bằng polling), ~31 kbps Opus chuyển tiếp A → B; B thấy "đang nói" và có `<audio>` đang phát; B bị từ chối khi A nói; nhả thì dừng chuyển tiếp ngay (0 byte); B nói được sau đó; đóng máy thì dọn Producer/Consumer. |
| E2E đổi channel + PIN qua UI | Đạt 9/9: đổi channel bằng bottom sheet, Producer tạo lại trên cùng transport, Consumer tạo lại, A → B có tiếng sau khi đổi; channel khóa hiện ô PIN, PIN đúng vào được. Ảnh chụp 390×844 xác nhận layout. |
| Chat (2026-10-18) | Smoke server 9/9: lịch sử khi vào, chỉ channel đó nhận, tin rỗng/quá dài bị từ chối, phải vào channel mới chat được, giới hạn 5 tin/5 s, người vào sau nhận đúng 50 tin cuối. E2E Chrome 5/5: hai máy chat qua UI, ô nhập tự xóa, Space khi đang gõ không bật mic, PTT vẫn chạy với layout mới; ảnh 390×844 kiểm tra layout. |
| Tải đồng thời (2026-10-18) | 75 socket vào cùng lúc (5 channel): 75/75 trong 350 ms, p95 56 ms, 0 bị ngắt; tranh quyền 15 máy: 1 được/14 bị từ chối. Thử 12 Chrome headless trên cùng laptop: Chrome sập vì quá tải, không kết luận được; lần chạy đầu lộ lỗi `recv transport already exists` (mục Rủi ro 6). |
| Báo lỗi kết nối (2026-10-18) | E2E Chrome 9/9: giả lập mất Wi-Fi thì hiện banner "Điện thoại đang mất Wi-Fi", có mạng lại thì có thông báo và banner ẩn; tắt server đột ngột thì hiện "Mất kết nối mạng tới server (transport close)" rồi "Không tới được server" kèm số lần thử lại; bật server lại thì có toast "Đã kết nối lại sau X giây", tự vào lại channel có media; nhật ký ghi đủ các sự kiện. |
| Chọn micro/loa (2026-10-18) | E2E Chrome (thiết bị giả) 8/8: danh sách có tên thiết bị; đổi micro khi đang ở channel thì nhãn "Đang thu" đổi, không kết nối lại, PTT vẫn chuyển tiếp ~30 kbps, Producer khóa lại sau khi nhả; lựa chọn được lưu; đổi loa thì `sinkId` của mọi `<audio>` khớp. Chưa test rút/cắm tai nghe và Bluetooth thật. |
| Thiết bị thật (Android/iOS) trên Wi-Fi | **Chưa chạy.** |

## Còn lại / rủi ro

1. **Thiết bị thật:** đo bấm PTT → nghe (mục tiêu < 300 ms), tranh quyền 3–5 máy, khóa màn hình, tắt Wi-Fi 10 s rồi bật lại, đi giữa các AP (ICE restart), soak 30–60 phút, CPU/pin.
2. **iOS Safari:** mic luôn mở khi ở channel (chấm cam), có thể đẩy âm thanh ra loa trong thay vì loa ngoài và âm lượng nhỏ. Nếu gặp: thử `navigator.audioSession.type = 'play-and-record'` (Safari 17+) hoặc tùy chọn chỉ mở mic khi bấm.
3. **Firewall:** máy dev chưa có rule cho TCP 443 và UDP/TCP 44444, Wi-Fi đang ở profile Public.
4. **Dev:** `vite build --watch` không có HMR; sửa FE xong phải tải lại trang.
5. Audio profile (`UPDATE_AUDIO_PROFILE`) vẫn toàn cục, UI chưa dùng. Gain mic chỉ còn AGC của trình duyệt; âm lượng loa tối đa 100% (không qua Web Audio để giảm trễ).
6. **Rớt dây chuyền khi Wi-Fi nghẽn** (chưa sửa): `VoiceMedia.start()` thử lại sẽ tạo trùng transport (server trả `recv transport already exists`) nên máy đó mất tiếng tới khi tải lại; mỗi `AUDIO_CONSUMER_CREATED` lại gọi `start()`; lỗi media dẫn tới ngắt cả socket (`onFatal`); kết nối lại đồng loạt (0,5–3 s) làm lại N² consumer + N² `RESUME`; máy im lặng vẫn gửi 50 gói/s (`zeroRtpOnPause: false`); mediasoup worker chết thì server chạy tiếp mà không có media. Server đã log mỗi lần ngắt kết nối kèm lý do.
7. Chat: mỗi lần tải trang là một `clientId` mới nên tin cũ của chính mình hiện như của người khác (vẫn đúng tên). Lịch sử mất khi server khởi động lại.
8. Chưa có unit test tự động trong repo; các script smoke/E2E hiện nằm ngoài repo, nên đưa vào `apps/server/test` + CI.

## P2P Serverless — việc còn lại (không đổi)

1. Kiểm thử 2–5 thiết bị (cùng Wi-Fi, 4G ↔ Wi-Fi, Vercel); không có TURN.
2. Quyền nói chỉ do client tự kiểm tra; hai người bấm cùng lúc đều phát được.
3. Anchor rời phòng chưa có cơ chế chuyển anchor.
4. `peer.on('error')` khác `unavailable-id` vẫn `resolve()` nên UI báo đã vào phòng.
5. `GatewayModeSelector`/`JoinP2PRoomCard` hardcode URL LAN `https://172.22.177.111:5173`, đã lỗi thời: chế độ LAN giờ là `https://<IP>` cổng 443.

## Ràng buộc

- Server là nơi duy nhất quyết định ai được nói: Producer chỉ được resume sau khi server cấp floor; client bật track sau `FLOOR_GRANTED`.
- Micro trên điện thoại cần HTTPS mà trình duyệt tin cậy (cài CA LAN).
- Âm thanh chỉ đi trong LAN, không có cloud relay/TURN.
- Không commit hoặc log `.env`, `channels.json`, private key, PIN, floor token hay audio.

## Lệnh

    npm.cmd run dev:lan
    npm.cmd run start:lan
    npm.cmd run dev:p2p
    npm.cmd run build:p2p
    npm.cmd run typecheck
    npm.cmd run build
