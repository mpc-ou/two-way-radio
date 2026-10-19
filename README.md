# MPC VoiceLink

Bộ đàm half-duplex Push-to-Talk chạy trên trình duyệt điện thoại, có **hai chế độ**:

| Chế độ | App | Cách hoạt động |
|---|---|---|
| **LAN** (chính) | `apps/server` + `apps/web` | **Một tiến trình NestJS** trên máy chủ trong mạng LAN phục vụ giao diện web, Socket.IO và mediasoup SFU. Điện thoại mở `https://<IP-server>`, chọn channel là nói được. Âm thanh đi UDP trong LAN, không cần Internet. |
| **P2P Serverless** | `apps/web-p2p` | Full mesh WebRTC giữa các trình duyệt qua PeerJS, deploy Vercel, không cần server riêng. |

## Monorepo

    apps/
      server/      NestJS: HTTPS + phục vụ apps/web/dist + Socket.IO (channel, floor) + mediasoup (Opus SFU)
      web/         React 19 + Vite 8, chỉ build (vite build --watch) ra dist/ — giao diện mobile-first
      web-p2p/     React + Vite 7 + PeerJS — chế độ P2P serverless
    packages/
      protocol/    Event và payload dùng chung server ↔ web
      ui/          Component dùng chung của web-p2p

Turborepo điều phối build/typecheck/dev. Yêu cầu Node >= 22, npm >= 10.

## Chế độ LAN

### Kiến trúc

    Điện thoại ──HTTPS/WSS :443──► NestJS (một tiến trình)
                                   ├─ web tĩnh apps/web/dist (SPA)
                                   ├─ Socket.IO: channel, quyền nói (floor), heartbeat
                                   └─ mediasoup WebRtcServer :44444
               ◄── Opus/WebRTC UDP :44444 ──┘   (TCP cùng cổng chỉ là dự phòng)

- **Âm thanh đi UDP** (WebRTC/SRTP, Opus mono 48 kHz, 20 ms, FEC). Socket.IO chỉ mang tín hiệu điều khiển.
- **Channel cố định** khai báo trong `apps/server/channels.json`; channel nào có `pin` thì phải nhập PIN.
- **Độ trễ thấp:** khi vào channel, điện thoại mở mic và tạo Producer ngay nhưng server giữ Producer ở trạng thái **PAUSED**. Bấm PTT: server cấp quyền nói, rồi `resume` Producer (chỉ một round-trip). Nhả PTT hoặc hết lease: server `pause` lại. Quyền nói do server quyết định.
- **Tự phục hồi:** Socket.IO tự kết nối lại và vào lại channel cũ; WebRTC tự ICE restart khi đổi AP hoặc mất sóng ngắn.

### Cài đặt lần đầu

    npm.cmd install
    Copy-Item apps/server/.env.example apps/server/.env
    Copy-Item apps/server/channels.example.json apps/server/channels.json

1. **Certificate HTTPS** (bắt buộc để điện thoại dùng micro). Lấy IP LAN của máy server (`ipconfig`), rồi tạo:

        powershell -ExecutionPolicy Bypass -File .\scripts\new-lan-tls.ps1 -LanIp 192.168.1.10

   Chép **chỉ** `certs/mpc-lan-ca.crt` sang từng điện thoại và cài làm CA tin cậy:
   - Android: Cài đặt → Bảo mật → Mã hóa & thông tin xác thực → Cài chứng chỉ → Chứng chỉ CA, rồi mở lại Chrome.
   - iPhone: cài profile, rồi bật tin cậy ở Cài đặt → Cài đặt chung → Giới thiệu → Cài đặt tin cậy chứng nhận.

   Khi IP server đổi, cấp lại cert **không đổi CA** (điện thoại không phải cài lại):

        powershell -ExecutionPolicy Bypass -File .\scripts\new-lan-tls.ps1 -LanIp 192.168.1.10,10.0.0.5 -ReuseCa -Force

2. **`apps/server/.env`**: `PORT=443`, đường dẫn TLS, `MEDIASOUP_ANNOUNCED_ADDRESS` = IP LAN (để trống thì server tự dò), `AUDIO_CONTROL_CODE` nếu muốn dùng chức năng admin.
3. **`apps/server/channels.json`**: danh sách `{ "id", "name", "color", "pin"? }`. File này bị Git bỏ qua vì có PIN.
4. **Firewall** (PowerShell Administrator):

        New-NetFirewallRule -DisplayName 'MPC VoiceLink web' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 443
        New-NetFirewallRule -DisplayName 'MPC VoiceLink media UDP' -Direction Inbound -Action Allow -Protocol UDP -LocalPort 44444
        New-NetFirewallRule -DisplayName 'MPC VoiceLink media TCP' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 44444

### Chạy

    npm.cmd run dev:lan      # dev: server (tsx watch) + web (vite build --watch); sửa FE rồi tải lại trang
    npm.cmd run start:lan    # chạy thật: build web + server rồi node apps/server/dist/main.js

Server in ra các URL `https://<IP>` để mở trên điện thoại. Giao diện:

1. Lần đầu nhập **tên**, lưu trên máy.
2. Chạm **channel** (có khóa thì nhập PIN ngay tại dòng đó). Lần sau tự vào lại channel cuối. Có thể mở thẳng `https://<IP>/?channel=<id>`.
3. **Giữ nút tròn để nói**, nhả để dừng. Có tiếng bíp khi được cấp quyền và khi kết thúc; người khác đang nói thì nút hiện "KÊNH BẬN".
4. **Chat** ngay dưới nút mic, riêng cho từng channel. Người vào sau thấy 50 tin gần nhất. Tin chỉ nằm trong RAM server, mất khi server khởi động lại. Có **âm báo "ting-tong"** (kèm rung) khi người khác nhắn: không kêu với tin của mình, không kêu khi bạn đang giữ nút nói, tin đến dồn dập chỉ kêu một lần; bật/tắt ở ☰ Menu → Âm thanh.
5. **Báo lỗi:** khi mất Wi-Fi, mất kết nối tới server hay mất đường âm thanh, một banner dưới thanh trên cùng nói rõ lý do, gợi ý cách xử lý, thời gian đã mất kết nối và số lần thử lại. Banner tự ẩn khi kết nối lại.
6. **Chọn micro và loa/tai nghe** (☰ Menu → Âm thanh): micro máy, tai nghe có dây, Bluetooth. Đổi được ngay khi đang ở trong channel mà không mất kết nối. Rút tai nghe thì tự quay về micro máy; kết nối lại thì tự chuyển về thiết bị đã chọn. Lựa chọn được lưu trên máy. Chọn loa chỉ có trên Chrome/Edge; Safari/iPhone do hệ thống tự chuyển.
7. **☰ Menu**: âm lượng, đệm chống giật, thành viên, chẩn đoán (RTT/jitter/mất gói), **nhật ký sự cố** (có nút sao chép để gửi người vận hành), QR chia sẻ, admin (thu hồi mic), đổi tên, rời channel.

Có thể "Thêm vào màn hình chính" để chạy toàn màn hình (PWA).

Terminal của server ghi mỗi lần điện thoại ngắt kết nối: `Client disconnected: <id> (<IP>) channel=<id> reason=<lý do>`. Tình trạng tổng quát xem ở `https://<IP-server>/health`.

### Xử lý sự cố nhanh

Hướng dẫn đầy đủ (tra theo thông báo, theo log server, theo triệu chứng): **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)**.

| Gặp | Kiểm tra trước tiên |
|---|---|
| Không mở được trang / "Không tới được server" | Điện thoại cùng Wi-Fi với máy chủ? Đúng IP (`ipconfig`)? Server còn chạy? Firewall TCP 443? Router tắt *client isolation*? |
| Cảnh báo chứng chỉ | Cài `certs/mpc-lan-ca.crt` lên điện thoại; IP đổi thì cấp lại cert bằng `-ReuseCa`. |
| Vào được nhưng không có tiếng / "Mất đường âm thanh" | Firewall UDP 44444; log `announced as <IP>` phải là IP LAN đúng; tắt VPN trên máy chủ. |
| Tiếng rè, ngắt | Lại gần AP, tăng **Đệm chống giật**, máy chủ cắm dây LAN, bớt máy trên một AP. |
| Nhiều máy rớt cùng lúc | Hotspot điện thoại giới hạn số máy; server vừa khởi động lại (`dev:lan`); Wi-Fi nghẽn; mọi người khóa màn hình. |
| Cắm tai nghe/Bluetooth mà không nhận | ☰ Menu → Âm thanh → chọn thiết bị trong danh sách Micro / Loa; iPhone chọn loa ở Trung tâm điều khiển. |
| Một máy mất tiếng sau khi mạng chập chờn | Tải lại trang (lỗi đã biết `recv transport already exists`). |
| Server không khởi động | Bản server cũ còn giữ cổng 443/44444 (`netstat -ano \| findstr ":443 :44444"`); kiểm tra `channels.json` và đường dẫn cert. |

### Để dùng được xa và rõ

Âm thanh chỉ tốt bằng vùng phủ Wi-Fi:

- Phủ sóng bằng nhiều AP/mesh **cùng một SSID và cùng subnet**; tắt *client/AP isolation*.
- Ưu tiên 2.4 GHz ở khu vực rộng (xa hơn), 5 GHz ở khu vực đông người (ít nhiễu).
- Đặt IP cố định cho máy server (DHCP reservation) để không phải đổi cert.
- Tiếng bị rè/ngắt khi đi xa: tăng **Đệm chống giật** trong Menu (đổi lấy một ít độ trễ).
- `OPUS_BITRATE` 24000/32000/40000 tùy chất lượng mạng (mặc định 32000).

### Client ở mạng khác

Không nằm trong mục tiêu LAN hiện tại. Server hỗ trợ `MEDIASOUP_ANNOUNCED_ADDRESS` là IP public/domain, cùng `MEDIASOUP_ANNOUNCED_UDP_PORT/TCP_PORT` khi đi qua tunnel cấp cổng khác. Máy sau CGNAT thì không forward cổng được: cần tunnel UDP/TCP hoặc VPS.

## Chế độ P2P Serverless

    npm.cmd run dev:p2p       # http://localhost:5174
    npm.cmd run build:p2p     # deploy Vercel (vercel.json rewrite SPA)

Nhập tên, chọn ban, nhập mã phòng (hoặc `?room=<id>`). Người đầu tiên đăng ký peer ID `mpc-vl-<room>-anchor` thành chủ phòng; người sau nối vào anchor rồi tự nối full mesh.

Lưu ý:
- Cần Internet: dùng PeerJS cloud broker và STUN công khai, không có TURN.
- Quyền nói chỉ là quy ước phía client; hai người bấm cùng lúc có thể cùng phát.
- Mic cần HTTPS hoặc `localhost`. Không có mã bảo vệ: biết mã phòng là vào được.

## Kiểm tra

    npm.cmd run typecheck
    npm.cmd run build

Xem `PROJECT_STATUS.md` để biết những gì đã kiểm thử và còn thiếu, `TROUBLESHOOTING.md` khi gặp sự cố.
