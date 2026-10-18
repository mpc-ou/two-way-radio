# MPC VoiceLink — Hướng dẫn xử lý sự cố (chế độ LAN)

Tài liệu cho **người vận hành máy chủ** và **người dùng điện thoại**. Tra theo thứ tự:

1. **Thông báo trên điện thoại** (banner, toast) → [mục 2](#2-tra-theo-thông-báo-trên-điện-thoại)
2. **Log trên máy chủ** → [mục 3](#3-tra-theo-log-máy-chủ)
3. **Triệu chứng** (không nghe được, rè, rớt hàng loạt…) → [mục 4](#4-tra-theo-triệu-chứng)

## 1. Chẩn đoán nhanh trong 5 bước

| Bước | Ai làm | Việc cần làm |
|---|---|---|
| 1 | Người dùng | Đọc **banner** dưới thanh trên cùng: nó nói lỗi gì và gợi ý cách sửa. |
| 2 | Người dùng | Mở **☰ Menu → Nhật ký sự cố**, xem các dòng đỏ; bấm **Sao chép nhật ký** rồi gửi cho người vận hành. |
| 3 | Người dùng | Mở **☰ Menu → Chẩn đoán**: `Kết nối` phải là `online`, `Media` là `ready`, `Transport` là `send:connected`/`recv:connected`. |
| 4 | Vận hành | Mở `https://<IP-server>/health` trên máy chủ hoặc điện thoại. Xem `channels` (số người), `media.producers` (số máy có âm thanh), `traffic.bytesForwarded` (tăng khi có người nói). |
| 5 | Vận hành | Xem terminal chạy server: dòng `Client disconnected … reason=…` cho biết máy nào rớt và vì sao ([mục 3](#3-tra-theo-log-máy-chủ)). |

Chấm tròn trên thanh trên cùng: **xanh** là trực tuyến; **vàng** là đang kết nối hoặc đang mở âm thanh; **đỏ** là mất kết nối hoặc lỗi âm thanh.

## 2. Tra theo thông báo trên điện thoại

### Banner sự cố kết nối

| Thông báo | Nguyên nhân thường gặp | Cách xử lý |
|---|---|---|
| **Điện thoại đang mất Wi-Fi** (`navigator.offline`) | Điện thoại rớt Wi-Fi, đi ra ngoài vùng phủ, bật chế độ máy bay. | Bật lại Wi-Fi, lại gần điểm phát. Ứng dụng tự vào lại channel khi có mạng. |
| **Mất kết nối mạng tới server** (`transport close` / `transport error`) | Wi-Fi yếu, điện thoại vừa chuyển AP/đổi mạng, màn hình tắt (trình duyệt ngắt kết nối nền). | Chờ vài giây để tự kết nối lại. Nếu lặp lại thường xuyên: lại gần AP, giữ màn hình mở, kiểm tra vùng phủ ([4.5](#45-tiếng-rè-ngắt-hoặc-trễ), [4.6](#46-nhiều-máy-rớt-cùng-lúc)). |
| **Server không phản hồi** (`ping timeout`) | Wi-Fi nghẽn nặng hoặc điện thoại ở quá xa router; máy chủ quá tải (hiếm). | Lại gần AP. Vận hành: giảm số máy trên một AP, cắm máy chủ bằng dây LAN. |
| **Server đã ngắt kết nối** (`io server disconnect`) | Máy chủ khởi động lại hoặc đã tắt. | Vận hành kiểm tra terminal server. Khi server chạy lại, điện thoại tự kết nối. |
| **Không tới được server** · thử lại lần N (`websocket error`, `timeout`…) | Máy chủ tắt; máy chủ **đổi IP**; điện thoại **khác Wi-Fi** với máy chủ; firewall chặn cổng 443; router bật *client isolation*. | Xem [4.1](#41-không-mở-được-trang). |
| **Mất đường âm thanh** | Kết nối WebRTC (UDP 44444) thất bại: firewall chặn UDP 44444, IP media sai, Wi-Fi quá yếu. Ứng dụng tự dựng lại kết nối. | Xem [4.2](#42-mở-được-trang-nhưng-không-nghe-không-nói-được). |
| **Trang chưa mở bằng HTTPS** | Mở bằng `http://`; micro bị trình duyệt chặn. | Mở bằng `https://<IP-server>` và cài chứng chỉ CA ([4.1](#41-không-mở-được-trang)). |
| **Trình duyệt không hỗ trợ bộ đàm** | Trình duyệt cũ, webview trong app (Zalo, Facebook…), chế độ hạn chế. | Mở bằng Chrome (Android) hoặc Safari (iPhone) bản mới. |

Khi kết nối lại thành công sẽ có thông báo **"Đã kết nối lại sau X giây. Đã vào <channel>."** và banner tự biến mất.

### Thông báo khác

| Thông báo | Nguyên nhân | Cách xử lý |
|---|---|---|
| **Chạm để bật loa** (nút cam) | Trình duyệt chặn tự phát âm thanh cho tới khi người dùng chạm. | Chạm nút một lần. |
| **Cần cấp quyền microphone để nói** | Người dùng bấm "Chặn" khi trình duyệt hỏi quyền micro. | Chrome: biểu tượng ổ khóa trên thanh địa chỉ → Quyền → Micro → Cho phép, rồi tải lại. iPhone: Cài đặt → Safari → Micro → Cho phép. |
| **Âm thanh chưa sẵn sàng** | Vừa vào channel, âm thanh còn đang khởi tạo; hoặc khởi tạo lỗi. | Chờ 1–2 giây. Nếu chấm vẫn đỏ và Chẩn đoán báo `Media: error`, tải lại trang. |
| **Lỗi âm thanh: …** | Khởi tạo WebRTC thất bại (server chậm, mic bị app khác chiếm…). | Tải lại trang. Đóng app khác đang dùng micro (gọi điện, ghi âm). |
| **KÊNH BẬN** / tiếng bíp kép | Người khác đang nói. Chỉ một người được nói tại một thời điểm. | Chờ người kia nhả nút. |
| **Mất quyền nói (hết hạn)** | Điện thoại không gửi heartbeat kịp (mạng chập chờn) nên server thu hồi lượt nói. | Nhả và bấm lại. Lặp lại thường xuyên là dấu hiệu Wi-Fi yếu. |
| **Admin đã thu hồi mic** | Người vận hành dùng mã admin để thu hồi. | Bình thường; bấm lại khi được phép. |
| **Channel này cần mã PIN** / **Mã PIN không đúng** | Channel có khóa. | Hỏi người vận hành mã PIN (trong `apps/server/channels.json`). |
| **Nhập sai PIN quá nhiều lần…** | Sai PIN quá `JOIN_MAX_FAILURES` (mặc định 8) lần trong `JOIN_BLOCK_MS` (60 giây), bị chặn theo IP. | Chờ 1 phút rồi nhập đúng PIN. |
| **Channel đã đầy** / dòng channel hiện "Đầy" | Đã đủ `MAX_MEMBERS_PER_ROOM` (mặc định 15) người. | Chọn channel khác, hoặc vận hành tăng `MAX_MEMBERS_PER_ROOM` trong `.env` rồi khởi động lại server. |
| **Server phản hồi chậm (mạng nghẽn)** | Yêu cầu không có phản hồi trong 8 giây. | Thử lại sau vài giây; kiểm tra Wi-Fi. |
| **Gửi quá nhanh, chờ một chút** (chat) | Quá 5 tin trong 5 giây. | Chờ vài giây. |
| **Tin nhắn tối đa 500 ký tự** | Tin quá dài. | Chia nhỏ tin. |
| **Sai mã admin (AUDIO_CONTROL_CODE)** | Mã admin sai, hoặc server chưa đặt `AUDIO_CONTROL_CODE` (chức năng admin bị tắt). | Vận hành đặt `AUDIO_CONTROL_CODE` trong `apps/server/.env` rồi khởi động lại. |

## 3. Tra theo log máy chủ

### Lúc khởi động

| Log / lỗi | Ý nghĩa | Cách xử lý |
|---|---|---|
| `Configured TLS certificate or key file does not exist.` | Đường dẫn `TLS_CERT_PATH`/`TLS_KEY_PATH` sai (tính từ thư mục `apps/server`). | Kiểm tra `certs/mpc-lan-cert.pem` và `certs/mpc-lan-key.pem`; mặc định `../../certs/...`. |
| `TLS_CERT_PATH is empty …` (WARN) | Server đang chạy HTTP, điện thoại sẽ không dùng được micro. | Tạo cert ([README](README.md#cài-đặt-lần-đầu)) và đặt đường dẫn trong `.env`. |
| `WEB_DIST_PATH … not found` (WARN) | Chưa build giao diện. | `npm.cmd run build:lan` hoặc chạy `npm.cmd run dev:lan`. |
| `CHANNELS_FILE … not found; using a single default channel` (WARN) | Chưa có `apps/server/channels.json`. | `Copy-Item apps/server/channels.example.json apps/server/channels.json`. |
| `CHANNELS_FILE must contain a non-empty JSON array` / `Channel #… id must match …` / `Duplicate channel id …` | `channels.json` sai cú pháp: id chỉ được chữ thường, số, `-`, `_`, tối đa 32 ký tự, không trùng. | Sửa `channels.json` (kiểm tra dấu phẩy, ngoặc). |
| `… must be a positive integer` / `… must be between …` | Giá trị trong `.env` không hợp lệ. | Sửa biến được nêu tên. |
| `EADDRINUSE … :443` | Cổng 443 đang bị chương trình khác giữ (IIS, VMware, Skype, một bản server cũ). | `netstat -ano \| findstr :443` để tìm PID, tắt chương trình đó; hoặc đổi `PORT=8443` và mở `https://<IP>:8443`. |
| Lỗi mediasoup lúc tạo WebRtcServer (thường nhắc tới cổng/bind) | Cổng `MEDIASOUP_PORT` (44444) đang bị tiến trình khác giữ, thường là **bản server cũ chưa tắt**. | `netstat -ano \| findstr :44444`, tắt tiến trình cũ (`taskkill /PID <pid> /F`), hoặc đổi `MEDIASOUP_PORT` và mở firewall theo cổng mới. |
| `MEDIASOUP_ANNOUNCED_ADDRESS (x.x.x.x) is a LAN IP not present on this machine; auto-detecting.` (WARN) | Máy chủ đã đổi mạng/IP; server tự dùng IP mới. | Không bắt buộc sửa, nhưng nên cập nhật `.env` và **cấp lại cert có IP mới** ([4.8](#48-máy-chủ-đổi-ip)). |
| `Mở trên điện thoại: https://…` | Danh sách URL để mở trên điện thoại. | Dùng URL có IP cùng mạng Wi-Fi với điện thoại. |

### Lúc đang chạy

| Log | Ý nghĩa | Cách xử lý |
|---|---|---|
| `Client disconnected: … reason=transport close` | Kết nối của điện thoại bị đứt (mất sóng, tắt màn hình, đóng tab). | Một vài máy là bình thường. **Nhiều máy cùng lúc** → xem [4.6](#46-nhiều-máy-rớt-cùng-lúc). |
| `… reason=ping timeout` | Điện thoại không phản hồi khoảng 20 giây: Wi-Fi nghẽn hoặc yếu. | Kiểm tra vùng phủ, số máy trên mỗi AP. |
| `… reason=client namespace disconnect` | Người dùng rời trang hoặc ứng dụng chủ động dựng lại kết nối. | Bình thường. |
| `… reason=server shutting down` | Server đang tắt. | Bình thường khi dừng server. |
| `DTLS failed for … transport` (WARN) | Bắt tay bảo mật âm thanh thất bại: mạng chặn UDP/TCP 44444 hoặc rất chập chờn. | Kiểm tra firewall cổng 44444, client isolation. |
| `CREATE_WEBRTC_TRANSPORT failed …: recv transport already exists` (WARN) | **Lỗi đã biết:** điện thoại khởi tạo âm thanh lỗi giữa chừng (thường do mạng nghẽn) rồi thử lại sai cách; máy đó mất tiếng. | Người dùng **tải lại trang**. Sẽ được sửa trong source (xem `PROJECT_STATUS.md`). |
| `mediasoup worker died; process must be restarted.` (ERROR) | Tiến trình xử lý âm thanh bị chết; mọi máy mất tiếng. | **Khởi động lại server ngay.** Ghi lại log gần đó để báo lỗi. |
| `… failed for socket …` (WARN khác) | Một yêu cầu media lỗi (thường do client gửi khi chưa sẵn sàng). | Thường tự hết; nếu lặp lại ở nhiều máy thì gửi log cho người phát triển. |

## 4. Tra theo triệu chứng

### 4.1 Không mở được trang

1. **Cùng mạng chưa?** Điện thoại và máy chủ phải cùng Wi-Fi (cùng dải IP, ví dụ đều là `192.168.1.x`). Wi-Fi khách (guest) thường tách khỏi mạng chính.
2. **Đúng IP chưa?** Trên máy chủ chạy `ipconfig` và lấy IPv4 của card Wi-Fi/Ethernet đang dùng. Mở đúng `https://<IP>` (thêm `:<PORT>` nếu `PORT` khác 443). Server cũng in danh sách URL khi khởi động.
3. **Server còn chạy không?** Trên chính máy chủ mở `https://localhost/health`.
4. **Firewall:** đã thêm rule cho TCP 443 chưa ([README](README.md#cài-đặt-lần-đầu)). Mạng Wi-Fi đang ở profile **Public** thì Windows chặn nhiều hơn; có thể đổi sang Private trong Settings → Network.
5. **Router chặn máy với máy:** tắt *AP/client isolation* (hay gặp trên router khách sạn, sự kiện, hotspot điện thoại).
6. **Cảnh báo chứng chỉ ("Kết nối không riêng tư"):** điện thoại chưa cài CA, hoặc cert không chứa IP hiện tại. Cài `certs/mpc-lan-ca.crt` lên điện thoại; nếu IP đổi thì cấp lại cert bằng `-ReuseCa` ([4.8](#48-máy-chủ-đổi-ip)). **Không bấm "Vẫn tiếp tục"**, vì micro có thể vẫn bị chặn.

Kiểm tra từ một máy tính khác cùng mạng: `Test-NetConnection <IP-server> -Port 443` phải ra `TcpTestSucceeded : True`.

### 4.2 Mở được trang nhưng không nghe, không nói được

Socket.IO (cổng 443) vẫn chạy nhưng âm thanh (cổng 44444) không đi được.

1. Menu → Chẩn đoán: `Transport` khác `connected` hoặc banner báo **Mất đường âm thanh** nghĩa là âm thanh bị chặn.
2. Firewall máy chủ đã mở **UDP 44444** (và TCP 44444) chưa.
3. Log server khi khởi động ghi `announced as <IP>`: IP này phải là IP máy chủ **mà điện thoại tới được**. Sai thì đặt `MEDIASOUP_ANNOUNCED_ADDRESS` đúng IP LAN trong `.env`.
4. Máy chủ có nhiều card mạng (VPN như Outline/WireGuard, VirtualBox, Hyper-V): IP tự dò có thể chọn sai, cần đặt `MEDIASOUP_ANNOUNCED_ADDRESS` thủ công. Tắt VPN trên máy chủ nếu không cần.
5. Không nghe nhưng nói được: chạm **Chạm để bật loa** nếu có; kiểm tra âm lượng điện thoại và **Âm lượng loa** trong Menu; tắt chế độ im lặng.
6. Nói mà người khác không nghe: kiểm tra quyền micro; xem `/health` khi đang giữ nút: `traffic.bytesForwarded` phải tăng.

### 4.3 Chỉ một vài máy không nghe/nói được

- Máy đó ở xa AP hoặc bám vào AP khác subnet: kiểm tra IP của điện thoại cùng dải với máy chủ.
- Trình duyệt đặc biệt (webview trong Zalo/Facebook, trình duyệt tiết kiệm dữ liệu): mở bằng Chrome/Safari.
- Log có `recv transport already exists` cho máy đó: tải lại trang ([mục 3](#lúc-đang-chạy)).
- App khác đang giữ micro (cuộc gọi, ghi âm): đóng app đó rồi tải lại trang.

### 4.3b Tai nghe có dây, tai nghe Bluetooth, chọn micro/loa

Chọn ở **☰ Menu → Âm thanh → Micro** và **Loa / tai nghe**. Dòng **"Đang thu: …"** cho biết micro thực sự đang dùng.

| Gặp | Cách xử lý |
|---|---|
| Danh sách chỉ có "Micro 1, Micro 2…" (không có tên) | Chưa cấp quyền micro. Vào một channel và cho phép micro; tên thiết bị sẽ hiện. |
| Cắm/kết nối tai nghe nhưng không thấy trong danh sách | Đóng rồi mở lại Menu. Bluetooth: kiểm tra tai nghe đã kết nối ở cài đặt hệ thống (không chỉ ghép đôi). Một số tai nghe chỉ hiện micro khi đã ở chế độ gọi. |
| Không có ô chọn loa, chỉ có dòng giải thích | Trình duyệt (Safari/iPhone, một số trình duyệt Android) không cho web chọn loa. Hệ thống tự phát ra tai nghe khi cắm hoặc kết nối Bluetooth; trên iPhone chọn ở Trung tâm điều khiển → biểu tượng AirPlay. |
| Thông báo **"Tai nghe / micro đã ngắt, chuyển về micro mặc định"** | Tai nghe bị rút hoặc Bluetooth mất kết nối; ứng dụng đã tự chuyển về micro máy, không mất kết nối. Kết nối lại tai nghe thì ứng dụng tự chuyển về. |
| Thông báo **"Loa / tai nghe đã chọn không còn, phát ra loa mặc định"** | Thiết bị phát đã ngắt; âm thanh chuyển về loa mặc định. Chọn lại khi thiết bị kết nối lại. |
| **"Không dùng được micro đã chọn"** | Thiết bị đang bị app khác giữ (cuộc gọi, ghi âm) hoặc vừa bị ngắt. Đóng app kia hoặc chọn "Mặc định của máy". |
| Nghe qua tai nghe Bluetooth bị rè/nhỏ khi đang ở trong channel | Dùng micro Bluetooth làm tai nghe chuyển sang chế độ gọi (chất lượng thấp hơn). Muốn nghe rõ: chọn micro là **micro của máy**, vẫn nghe qua tai nghe. |
| Bluetooth trễ hơn tai nghe dây | Bluetooth luôn thêm 100–300 ms. Dùng tai nghe dây cho vị trí cần phản hồi nhanh. |
| Đổi micro rồi người khác không nghe | Mở Chẩn đoán xem `Media: ready`; thử chọn "Mặc định của máy". Nếu vẫn không được, tải lại trang. |

### 4.4 iPhone (Safari)

- Khóa màn hình hoặc chuyển app thì Safari tạm dừng trang và mất kết nối. Giữ màn hình mở; nên "Thêm vào màn hình chính".
- Khi ở trong channel, iPhone hiện chấm cam (micro đang mở). Đây là thiết kế để bấm nói không bị trễ; server vẫn khóa âm thanh cho tới khi được cấp quyền.
- Tiếng nhỏ hoặc phát ra loa trong (loa nghe gọi): tăng âm lượng, thử tai nghe; đây là rủi ro đã biết của Safari khi micro đang mở.
- Chế độ im lặng (gạt bên hông) có thể tắt tiếng bíp báo hiệu.

### 4.5 Tiếng rè, ngắt hoặc trễ

- Menu → Chẩn đoán: **Jitter** cao (> 30 ms) hoặc **Mất gói** tăng nhanh nghĩa là Wi-Fi kém.
- Tăng **Đệm chống giật** trong Menu (40–80 ms) để đổi lấy một chút độ trễ.
- Lại gần AP. Tránh để quá nhiều máy trên một AP (khuyến nghị tối đa 25–30 máy).
- Máy chủ nên **cắm dây LAN** vào router: nếu máy chủ dùng Wi-Fi, mọi gói âm thanh đi qua sóng hai lần.
- Hạ `OPUS_BITRATE=24000` trong `.env` nếu mạng yếu.
- Tiếng vọng: hai máy đặt gần nhau cùng bật loa. Tách xa ra hoặc dùng tai nghe.

### 4.6 Nhiều máy rớt cùng lúc

Kiểm tra theo thứ tự:

1. **Số máy vượt giới hạn của điểm phát:** hotspot điện thoại thường chỉ cho khoảng 10 máy (Android) hoặc khoảng 5 máy (iPhone). Dùng router/AP thật.
2. **Máy chủ khởi động lại:** khi chạy `dev:lan`, mỗi lần sửa code server là server tự khởi động lại. Sự kiện thật thì dùng `start:lan`.
3. **Wi-Fi nghẽn:** log có nhiều `ping timeout`/`transport close` cùng thời điểm. Xử lý: AP tốt hơn, nhiều AP cùng SSID, máy chủ cắm dây, tắt tốc độ 802.11b trên AP.
4. **Mọi người khóa màn hình** (cất máy vào túi): trình duyệt điện thoại ngắt kết nối nền. Đây là giới hạn của trình duyệt.
5. **Máy chủ đổi IP** (DHCP cấp IP mới): đặt DHCP reservation cho máy chủ.
6. **`mediasoup worker died`** trong log: khởi động lại server.

Lưu ý: source hiện còn điểm yếu khiến khi Wi-Fi nghẽn, nhiều máy cùng kết nối lại một lúc và làm nghẽn thêm (xem `PROJECT_STATUS.md`, mục Rủi ro 6). Khi gặp, tải lại trang trên các máy bị mất tiếng.

### 4.7 Không vào được channel / chat / admin

Xem bảng [Thông báo khác](#thông-báo-khác). Người vận hành quản lý channel và PIN trong `apps/server/channels.json`, giới hạn người trong `.env`; đổi xong phải **khởi động lại server**.

### 4.8 Máy chủ đổi IP

1. `ipconfig` để lấy IP mới.
2. Cấp lại cert, **giữ nguyên CA** (điện thoại không phải cài lại):

        powershell -ExecutionPolicy Bypass -File .\scripts\new-lan-tls.ps1 -LanIp <IP-mới>,<IP-cũ> -ReuseCa -Force

3. Cập nhật `MEDIASOUP_ANNOUNCED_ADDRESS` trong `apps/server/.env` (hoặc để trống cho server tự dò).
4. Khởi động lại server; gửi URL/QR mới cho mọi người (Menu → Chia sẻ).

### 4.9 Server không khởi động

Xem bảng [Lúc khởi động](#lúc-khởi-động). Lỗi hay gặp nhất là **bản server cũ vẫn chạy** và giữ cổng 443/44444: tắt cửa sổ terminal cũ hoặc dùng `taskkill`.

## 5. Lệnh chẩn đoán (PowerShell trên máy chủ)

    ipconfig                                         # IP của máy chủ
    netstat -ano | findstr ":443 :44444"             # tiến trình nào đang giữ cổng
    taskkill /PID <pid> /F                           # tắt tiến trình cũ
    Get-NetConnectionProfile                         # Wi-Fi đang Public hay Private
    Get-NetFirewallRule -DisplayName 'MPC VoiceLink*' | Select DisplayName, Enabled
    curl.exe -k https://localhost/health             # tình trạng server, channel, media, lưu lượng
    Test-NetConnection <IP-server> -Port 443         # chạy từ máy khác cùng mạng
    tracert -d -h 3 8.8.8.8                          # hop đầu là 10.x/100.64.x: mạng sau CGNAT (không ảnh hưởng LAN)

Trong `/health`:
- `channels[].memberCount`: số người mỗi channel.
- `media.producers`: số máy đã sẵn sàng âm thanh. Thấp hơn số người nghĩa là có máy lỗi media.
- `media.pausedProducers`: lúc không ai nói phải bằng `producers`.
- `traffic.bytesForwarded`: phải tăng khi có người giữ nút nói.

## 6. Gửi báo lỗi cho người phát triển

Gửi kèm:
1. **Nhật ký sự cố** từ điện thoại bị lỗi (Menu → Nhật ký sự cố → Sao chép), cả loại máy và trình duyệt.
2. **Log terminal của server** quanh thời điểm lỗi, có các dòng `Client disconnected … reason=…` và mọi dòng `WARN`/`ERROR`.
3. Kết quả `https://<IP-server>/health` lúc đang lỗi.
4. Mô tả mạng: router hay hotspot, số AP, số máy, máy chủ cắm dây hay Wi-Fi.
5. Các bước tái hiện: lỗi xảy ra khi nào, bao nhiêu máy, có lặp lại không.

Không gửi `apps/server/.env`, `channels.json`, file `certs/*key*.pem` hay mã PIN/admin.
