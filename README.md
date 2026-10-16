# MPC VoiceLink

MPC VoiceLink là web app bộ đàm LAN, half-duplex Push-to-Talk. Browser client giao tiếp control qua Socket.IO và relay WebRTC/Opus qua mediasoup trên laptop. Hotspot chỉ cấp Wi-Fi; audio LAN không cần cloud.

## Monorepo

    apps/
      web/                 React + Vite browser PTT client
      server/              NestJS + Socket.IO + mediasoup
    packages/
      protocol/            Shared event constants và payload contracts

Turborepo điều phối build, typecheck và dev tasks.

## Cài đặt

    npm.cmd install
    Copy-Item apps/server/.env.example apps/server/.env

Sửa apps/server/.env:

- Đặt ROOM_JOIN_CODE khác mặc định.
- Đặt MEDIASOUP_ANNOUNCED_ADDRESS thành IP LAN của laptop trước khi thử media.
- CORS_ORIGINS là web origin được phép. Mặc định cho Vite local là http://localhost:5173.
- Có thể đặt `AUDIO_CONTROL_CODE` riêng để cho phép cập nhật runtime audio profile trong UI. Không dùng lại `ROOM_JOIN_CODE`.

## Chạy development

Mở hai terminal tại root:

    npm.cmd run dev:server
    npm.cmd run dev:web

Vite lắng nghe trên tất cả network interfaces. Mở URL Vite hiển thị trong terminal để thử UI/control plane.

## Kiểm tra microphone và audio thật trên hai thiết bị

Điện thoại truy cập IP LAN qua HTTP chỉ kiểm tra được UI/control; browser sẽ chặn microphone. Muốn dùng PTT phải có HTTPS cho web, WSS cho Socket.IO và certificate được tin cậy trên từng điện thoại.

Ví dụ dưới dùng IP laptop `192.168.1.2`; thay bằng IP Hotspot hiện tại của laptop nếu khác.

### 1. Tạo local CA và certificate LAN

Máy hiện có OpenSSL. Từ thư mục root, chạy một lần:

    powershell -ExecutionPolicy Bypass -File .\scripts\new-lan-tls.ps1 -LanIp 192.168.1.2

Lệnh tạo `certs/mpc-lan-ca.crt`, `certs/mpc-lan-cert.pem` và `certs/mpc-lan-key.pem`. Thư mục `certs/` bị Git bỏ qua; tuyệt đối không gửi hoặc commit file key.

Chép **chỉ** `certs/mpc-lan-ca.crt` sang từng điện thoại và cài nó làm CA tin cậy:

- Android: Settings → Security & privacy → More security settings → Encryption & credentials → Install a certificate → CA certificate; sau đó đóng/mở lại Chrome.
- iPhone/iPad: cài profile certificate, rồi bật trust tại Settings → General → About → Certificate Trust Settings.

Không dùng certificate warning/bypass thay cho bước trust CA.

### 2. Cấu hình HTTPS/WSS

Trong `apps/server/.env`, đặt các giá trị sau (giữ nguyên mã phòng hiện có):

```env
HOST=0.0.0.0
PORT=3000
CORS_ORIGINS=https://192.168.1.2:5173,https://localhost:5173
TLS_CERT_PATH=../../certs/mpc-lan-cert.pem
TLS_KEY_PATH=../../certs/mpc-lan-key.pem
MEDIASOUP_ANNOUNCED_ADDRESS=192.168.1.2
```

Tạo `apps/web/.env.local` từ `.env.example`, rồi đặt:

```env
DEV_TLS_CERT_PATH=../../certs/mpc-lan-cert.pem
DEV_TLS_KEY_PATH=../../certs/mpc-lan-key.pem
```

Mở PowerShell **Run as administrator** và cho phép các cổng cần thiết trong Windows Firewall:

```powershell
New-NetFirewallRule -DisplayName 'MPC VoiceLink TCP' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3000,5173
New-NetFirewallRule -DisplayName 'MPC VoiceLink WebRTC UDP' -Direction Inbound -Action Allow -Protocol UDP -LocalPort 40000-40100
```

Khởi động lại cả hai tiến trình để đọc certificate/config mới:

    npm.cmd run dev:server
    npm.cmd run dev:web

### 3. Quy trình nghiệm thu hai thiết bị

1. Kết nối laptop và hai điện thoại vào cùng Hotspot; tắt client isolation nếu Hotspot có tùy chọn này.
2. Trên cả hai điện thoại, mở `https://192.168.1.2:5173`. Trình duyệt phải không hiện cảnh báo certificate.
3. Ở mỗi máy, Server URL là `https://192.168.1.2:3000`; dùng cùng phòng/mã phòng nhưng tên hiển thị khác nhau. Chờ trạng thái `ONLINE` và `WEBRTC SẴN SÀNG`.
4. Trên máy nghe, chạm **Bật loa**. Trên máy nói, nhấn giữ PTT và cấp quyền microphone khi browser hỏi. Khi nhả, mic track và floor phải dừng.
5. Kiểm tra tranh quyền: giữ PTT ở máy A rồi thử PTT ở máy B; B phải báo kênh bận. Nhả A thì B có thể nói. Đóng tab A khi đang nói; quyền nói phải tự thu hồi sau tối đa một lease.

Khung Audio Profile hiển thị mức mic, RTT, jitter, packet loss và gain đầu vào/đầu ra. `Mục tiêu playout` là policy/benchmark của server, không thể ép độ trễ loa chính xác trên mọi điện thoại.

## Kiểm tra

    npm.cmd run typecheck
    npm.cmd run build

## Scope hiện tại

Đã có React UI kết nối room, request/release floor và heartbeat bằng Socket.IO; server có atomic floor lease, WebRTC transport, Producer/Consumer authorization và mediasoup Opus router. Browser tạo recv transport sau khi vào phòng, chỉ lấy mic/produce sau `FLOOR_GRANTED`, dừng track khi nhả floor và phát audio nhận được qua Web Audio gain graph.

Chưa có kết quả kiểm thử microphone/UDP trên Hotspot với thiết bị thật, benchmark 24/32/40 kbps, reconnect/soak test hoặc xác thực theo từng người dùng. Xem `PROJECT_STATUS.md` và `MPC_VoiceLink_Architecture.md` trước khi tiếp tục.
