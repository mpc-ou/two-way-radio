# Prompt triển khai chi tiết — MPC VoiceLink Web

Bạn là Software Architect và Senior Engineer chuyên về WebRTC browser, React, TypeScript, NestJS và mediasoup. Hãy thiết kế, triển khai và kiểm thử hệ thống bộ đàm LAN chạy trong trình duyệt có tên MPC VoiceLink theo các yêu cầu sau.

## 1. Mục tiêu sản phẩm

Xây dựng web app Push-to-Talk (PTT), half-duplex, cho nhiều thiết bị mở browser trong cùng Wi-Fi Hotspot. Một điện thoại có SIM 4G/5G chỉ phát Hotspot; laptop kết nối Hotspot chạy web/control server và mediasoup. Browser client gửi và nhận audio qua laptop bằng WebRTC/Opus.

Audio LAN cơ bản không được đi qua cloud, không dùng Internet di động, không ghi âm, không lưu payload audio, file audio hay lịch sử thoại. Chỉ được có buffer realtime hữu hạn.

Phải phân biệt đường LAN với Internet 4G/5G: audio chỉ không tiêu tốn dữ liệu di động khi client, signaling và media thực sự đi qua laptop trong LAN, không qua dịch vụ ngoài hoặc TURN cloud.

## 2. Quyết định kiến trúc MVP

Chọn duy nhất kiến trúc sau cho MVP:

- Browser client: React + TypeScript + Vite.
- Monorepo: npm workspaces + Turborepo.
- Shared protocol: packages/protocol.
- Control/signaling: NestJS + Socket.IO WebSocket chạy trên laptop.
- Media: mediasoup SFU + WebRTC.
- Codec: Opus.
- Network: Wi-Fi Hotspot LAN; QR hoặc URL LAN phân phối địa chỉ server.
- Audio output/policy: server giữ profile relay, lease, bitrate cap và stale-packet policy; browser/OS vẫn quyết định jitter buffer và độ trễ loa thực tế.

Không dùng Flutter, Expo, React Native hay Android/iOS app native cho MVP này. Không gửi raw audio qua WebSocket và không tự viết RTP/RTCP/Opus stack.

So sánh ngắn LiveKit chỉ khi cần quyết định lại media server; không ghép LiveKit và mediasoup vào cùng MVP.

## 3. Yêu cầu browser và HTTPS

Browser chỉ cho phép microphone trong secure context. localhost có ngoại lệ phát triển, nhưng client truy cập địa chỉ LAN của laptop phải dùng HTTPS hợp lệ/được client tin cậy trước khi gọi getUserMedia và chạy media thật.

- Web app production phải được phục vụ từ HTTPS trên laptop hoặc reverse proxy LAN có HTTPS.
- Socket.IO phải dùng WSS khi web origin là HTTPS.
- Không coi HTTP LAN là đường chạy audio browser hợp lệ chỉ vì control UI mở được.
- Tài liệu hóa cách cung cấp/chấp nhận local CA hoặc chứng chỉ LAN; không đưa private key vào repository.
- Mọi client vẫn cần truy cập UDP mediasoup trực tiếp tới laptop.

## 4. Luồng PTT bắt buộc

Mỗi room có state machine:

- IDLE: không có speaker.
- REQUESTING: client đang chờ kết quả xin floor.
- TALKING: đúng một client đang giữ floor lease.
- RELEASING: floor đang được giải phóng.

Protocol shared trong packages/protocol phải giữ các event:

- JOIN_ROOM
- ROOM_STATE
- REQUEST_FLOOR
- FLOOR_GRANTED
- FLOOR_DENIED
- RELEASE_FLOOR
- FLOOR_RELEASED
- HEARTBEAT
- CLIENT_DISCONNECTED
- ERROR

Yêu cầu bắt buộc:

1. Server là nguồn sự thật và cấp floor atomically/serially trong room; không có await giữa kiểm tra room rảnh và gán lease.
2. Một room chỉ có một holder tại mọi thời điểm.
3. FLOOR_GRANTED gồm floor token, thời hạn và heartbeat interval. Token gắn room, client và session hiện tại.
4. Client chỉ bắt microphone, encoder và mediasoup Producer sau FLOOR_GRANTED.
5. Release, disconnect, heartbeat timeout hoặc lease expiry phải thu hồi floor, dừng media relay và phát ROOM_STATE mới.
6. Server phải từ chối/đóng/pause Producer của client không còn giữ floor. Khóa nút PTT trên UI không phải cơ chế bảo mật.
7. Xử lý click/release nhanh, hai request gần đồng thời, reconnect, stale token và tab/browser đóng.
8. Browser PTT dùng pointer events; nhả nút khi pointer cancel hoặc cửa sổ mất kết nối.

## 5. Luồng WebRTC/mediasoup

Khi vào room, browser kết nối Socket.IO, JOIN_ROOM và lấy router RTP capabilities. Sau đó tạo WebRTC send/receive transports, trao đổi ICE/DTLS parameters bằng signaling và tạo Consumer cho audio của speaker.

Khi được floor:

1. Browser gọi getUserMedia audio với mono capture, AEC/noise suppression phù hợp.
2. Browser tạo hoặc resume Producer Opus chỉ khi token còn hợp lệ.
3. Server xác minh token/session/floor trước khi accept hoặc relay producer.
4. Server tạo/resume Consumers tới listeners.
5. Khi release hoặc lease hết hạn: pause/close Producer, ngừng consumer relay thích hợp, dừng track microphone và giải phóng timers/listeners.

Chọn lifecycle Producer reuse hoặc close/recreate bằng benchmark thực tế; ban đầu ưu tiên close/pause rõ ràng và cleanup chắc chắn hơn tối ưu vi mô. Không transcoding, mixing hoặc resampling phía server nếu không cần.

## 6. Audio, delay, RAM và CPU

Profile benchmark ban đầu:

| Thông số | Khởi điểm |
|---|---|
| Codec | Opus |
| Capture | mono |
| RTP WebRTC capability | Opus 48 kHz, 2-channel capability chuẩn; request stereo=0 ở browser |
| Bitrate thử | 24 / 32 / 40 kbps |
| Packetization | khoảng 20 ms |
| Mode | half-duplex |
| Recording | tắt |
| Server processing | SFU relay, không transcode |

Không đồng nhất sample rate, bitrate, packetization, jitter buffer và end-to-end delay. Bitrate cao không đảm bảo âm thanh tốt nếu microphone, Wi-Fi hoặc echo là nút thắt.

Thiết kế không để RAM tăng theo thời gian thoại:

- Không log audio/SDP bí mật/token.
- Buffer, stats cache và queue đều có giới hạn count + age.
- Ưu tiên bỏ audio quá cũ hơn phát trễ.
- Dọn WebRtcTransport, Producer, Consumer, timer, Socket.IO listeners, room sessions khi leave/disconnect.
- Đo CPU/RAM qua soak test, không tự cam kết số client hay latency trước benchmark.

## 7. Monorepo source tree

    apps/
      web/                 React/Vite browser client
      server/              NestJS, Socket.IO, mediasoup
    packages/
      protocol/            event constants và TypeScript payload contracts
    turbo.json             task graph
    MPC_VoiceLink_Architecture.md
    PROJECT_STATUS.md

Dùng Turborepo cho build, typecheck và dev task khi có nhiều app/package. Không thêm app mới nếu không có yêu cầu rõ ràng. Protocol message không được copy-paste khác nhau giữa web và server.

## 8. Networking, security và smoke test

Trước khi làm media, thực hiện smoke test trên đúng Hotspot:

- Browser client truy cập HTTPS URL laptop.
- WSS/Socket.IO kết nối được từ ít nhất hai thiết bị.
- Laptop IP LAN ổn định hoặc được chia bằng QR.
- UDP dải mediasoup đi qua Hotspot và Windows Firewall.
- Hotspot không client-isolation laptop/client.
- Browser xin được microphone trên HTTPS.
- Không tự chuyển cloud nếu Hotspot chặn LAN/UDP; khắc phục layer mạng.

Bảo mật tối thiểu:

- Room join code/token, không dùng IP LAN làm authentication.
- Server xác minh floor token mọi request/media operation.
- Không gửi token qua log hoặc persistent storage.
- DTLS-SRTP bảo vệ transport, nhưng laptop mediasoup là trust boundary của media relay.
- Shared join code chỉ là MVP; ghi rõ khi cần per-user/device auth.

## 9. Kế hoạch triển khai và nghiệm thu

Giai đoạn 1: Turborepo, web control UI, shared protocol, server room/floor core.
Giai đoạn 2: HTTPS LAN, Hotspot/WSS/UDP smoke test.
Giai đoạn 3: browser mediasoup transport, microphone, Producer/Consumer lifecycle.
Giai đoạn 4: metrics, bounded buffering, reconnect, disconnect và soak tests.
Giai đoạn 5: hardening auth và deployment LAN.

Test tối thiểu:

| Case | Kỳ vọng |
|---|---|
| 2 browser clients | signaling và audio relay qua laptop hoạt động |
| 3–5 clients | chỉ một speaker |
| Hai PTT đồng thời | đúng một FLOOR_GRANTED |
| Speaker đóng tab/mất Wi-Fi | floor tự thu hồi |
| Listener chậm | không có queue RAM vô hạn |
| 30–60 phút | RAM không tăng tuyến tính |
| 24/32/40 kbps | ghi nhận clarity, loss, jitter, RTT, delay, CPU/RAM |
| Hotspot mục tiêu | HTTPS/WSS/UDP được xác minh thật |

Ngưỡng nghiệm thu là mục tiêu thử nghiệm, không phải lời hứa trước benchmark. Khi trả lời hoặc code, đưa quyết định cụ thể, trade-off và các giả định còn cần người dùng xác nhận.
