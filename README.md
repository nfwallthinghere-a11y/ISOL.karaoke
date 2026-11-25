# Karaoke Call — phòng hát các nhà

Voice call nhiều người ngay trên trình duyệt: mỗi người là một **nhà** có icon riêng,
câu hát ngẫu nhiên hiện lên sau tiếng đếm **3·2·1**, **khán giả chấm điểm bằng reaction**,
**bảng xếp hạng điểm** chạy trực tiếp, và **chia sẻ màn hình** để chiếu MV cho cả phòng.

Giọng nói đi thẳng giữa các máy (WebRTC P2P qua PeerJS) — API ở đây chỉ làm phần phụ trợ,
tắt API thì cuộc gọi vẫn chạy.

---

## Luật chơi và cách tính điểm

1. Chủ phòng bấm **🎲 Câu hát mới · 3·2·1**. Thao tác này **chốt điểm câu trước** rồi mở câu mới.
2. Cả phòng đếm 3 · 2 · 1 → **HÁT!** → lời bài hiện sáng lên, cửa chấm điểm mở.
3. **Khán giả chạm vào nhà** muốn chấm (nhà đó viền vàng, thanh dưới hiện "Hãy chấm điểm cho
   nhà …"), rồi bấm emoji bao nhiêu lần tuỳ thích. Emoji bay lên từ icon nhà đó.
   Nút **🎤 Nhà đang hát** nhảy nhanh sang nhà đang có giọng to nhất.

   | Emoji | Điểm |
   |---|---|
   | 😭 | 1 |
   | 🤡 | 1,5 |
   | 🔥 | 1,5 |
   | 🤯 | 2 |

   Sửa bảng `RX_PTS` trong `index.html` là đổi được trọng số hoặc thêm emoji mới.
4. Câu tiếp theo bắt đầu (hoặc chủ phòng bấm **⏹️ Chốt điểm câu này**) là khoá sổ: điểm câu đó
   cộng vào tổng, chủ phòng phát bảng kết quả chính thức cho cả phòng và gửi lên `/api/score`.

**Bảng xếp hạng** ở cột giữa có hai tab: *Tổng điểm* (cả phiên) và *Câu này* (câu đang hát).
Nhà dẫn đầu đeo 👑, thanh dài ngắn so với nhà cao điểm nhất, thanh màu phía trên là tỉ lệ
điểm giữa các nhà. Ai tải lại trang giữa chừng thì tổng điểm được lấy lại từ server.

Các nhà **không chấm điểm được** — chỉ khán giả. Mỗi khán giả bị giới hạn 1 reaction mỗi 0,3 giây
và tối đa 40 reaction một câu, để không ai spam lệch kết quả.

Không còn chấm nhịp tự động: máy không biết nhịp thật của bài hát nên điểm nhịp dễ sai,
tai khán giả chấm chuẩn hơn nhiều.

## Donate

Nút **💝 Donate** trên thanh đầu trang mở hộp ủng hộ, bộ trường giống trang Rung Chuông Vàng:
mã giao dịch (tự sinh, chống ghi trùng khi bấm hai lần), người gửi, nhà được ủng hộ, số tiền
và ảnh chuyển khoản (ảnh tự nén xuống dưới ~190KB trước khi gửi).

Thông tin chuyển khoản hiện trong hộp lấy từ hằng `DONATE` ở đầu `index.html` — sửa ngân hàng,
số tài khoản, chủ tài khoản, nội dung và link ảnh QR ở đó.

### Nơi lưu — Google Sheet qua Apps Script

Backend lưu donate nằm ở `gas/Code.gs`, cùng cách trang Rung Chuông Vàng đang chạy.

1. Tạo một Google Sheet mới → **Extensions → Apps Script** → dán nguyên `gas/Code.gs` đè vào.
2. **Project Settings → Script properties**:
   | Thuộc tính | Bắt buộc | Dùng để |
   |---|---|---|
   | `SECRET` | có | chuỗi ngẫu nhiên dài, phải trùng với `GAS_SECRET` trên Vercel |
   | `FOLDER_ID` | không | thư mục Drive chứa ảnh chuyển khoản; để trống thì tự tạo thư mục riêng tư |
   | `ADMIN_KEY` | không | khoá để duyệt donate |
3. Chạy hàm `setup()` một lần trong trình soạn thảo để cấp quyền và tạo sẵn tab **Donate**.
4. **Deploy → New deployment → Web app**, *Execute as: Me*, *Who has access: Anyone*, copy URL `/exec`.
5. Trên Vercel đặt `GAS_URL` = URL đó, `GAS_SECRET` = đúng chuỗi `SECRET`, rồi redeploy.

Xong là mỗi lượt donate thành một dòng trong tab **Donate**: Thời gian · Phòng · Mã GD ·
Người gửi · Nhà · Số tiền · Ảnh chuyển khoản · Trạng thái · IP (băm) · Trình duyệt.

Ảnh chuyển khoản nằm **riêng tư** trong Drive của bạn, Sheet chỉ giữ đường link. IP người gửi
được băm chứ không lưu thô. Cùng một mã GD gửi hai lần chỉ ghi một dòng (chặn 6 tiếng).

`GET /api/donate?code=LDN88` đọc thẳng từ Sheet, trả 50 lượt gần nhất và tổng tiền.

Duyệt một lượt (ghi vào cột Trạng thái):

```bash
curl -X POST https://<tên>.vercel.app/api/donate \
  -H 'Content-Type: application/json' -H 'x-kk-key: <ADMIN_KEY trên Vercel>' \
  -d '{"action":"duyet","bid":"bk3x9f2a","kq":"Đã duyệt"}'
```

**Chưa cấu hình Apps Script** thì API vẫn chạy: donate lưu tạm trong bộ nhớ server (hoặc KV
nếu có bật), không giữ ảnh — đủ để thử, nhưng Vercel khởi động lại là mất.

Mỗi lượt ủng hộ được báo vào khung chat cho cả phòng thấy. Trạng thái mặc định là *Chờ duyệt* —
ban tổ chức tự đối soát, code không tự cộng tiền thành điểm.

## Hai loại mã, hai link riêng

| Vai | Mã | Link | Được gì |
|---|---|---|---|
| 🎤 **Nhà** | `LDN88` | `?room=LDN88` | Nói/hát, chọn nhà, nhận điểm reaction, chia sẻ màn hình, chat |
| 👀 **Người xem** | `XLTZPG` | `?v=XLTZPG` | Chỉ nghe và chat, chấm điểm bằng reaction. Không xin quyền mic |

Mã người xem là **chuỗi riêng 6 chữ cái**, sinh ra từ mã nhà bằng hàm băm một chiều: cầm mã
xem **không suy ngược ra được mã nhà**, nên khán giả không tự vào làm nhà. Chủ phòng thấy cả
hai mã (rê chuột lên tên phòng) và có hai nút **📋 Link nhà** / **👀 Link người xem** để copy
đúng link cho từng nhóm.

Cách chạy bên dưới: chủ phòng mở **hai cổng PeerJS** — một mang mã nhà, một mang mã xem.
Khán giả nối vào cổng của mình để lấy danh sách phòng, sau đó các nhà gọi thẳng tới họ như
mọi kết nối khác, nên vẫn nghe đủ giọng mọi nhà. Mã phòng chỉ được gửi cho khán giả sau khi
đã vào, để dùng cho bảng xếp hạng và donate.

Người xem không cần mic nên vào được cả từ điện thoại và từ iframe nhúng trong Wix —
chỉ các nhà mới bắt buộc mở bằng link gốc ở tab riêng.

Khung chat chạy lan truyền qua mạng P2P, lọc trùng bằng mã tin nhắn: hai người xem
không nối trực tiếp với nhau nhưng vẫn thấy tin của nhau qua các nhà. Chat không lưu
lại ở đâu cả, thoát phòng là mất.

## Cấu trúc

```
karaoke-call/
├─ index.html          toàn bộ giao diện + logic cuộc gọi (1 file, không cần build)
├─ vercel.json         cấu hình deploy: không build, phục vụ tĩnh, chừa /api
├─ package.json        script dev + test
├─ api/
│  ├─ _lib.js          helper chung (CORS, đọc JSON, rate limit, validate)
│  ├─ _store.js        kho dữ liệu: Vercel KV/Upstash nếu có, không thì bộ nhớ tạm
│  ├─ _lyrics.js       kho câu hát mặc định (dân ca/đồng dao, không bản quyền)
│  ├─ health.js        GET  /api/health   kiểm tra sống chết
│  ├─ ice.js           GET  /api/ice      máy chủ STUN/TURN cho WebRTC
│  ├─ lyrics.js        GET  /api/lyrics   kho câu hát / câu ngẫu nhiên
│  ├─ room.js          GET+POST /api/room  sổ ghi danh phòng
│  └─ score.js         GET+POST /api/score điểm nhịp + bảng xếp hạng
└─ tests/
   ├─ dev-server.js    máy chủ chạy thử ở máy, định tuyến giống Vercel
   └─ api.test.js      16 test cho toàn bộ API
```

File bắt đầu bằng `_` trong `/api` không thành route — Vercel bỏ qua chúng.

## Xem thử không cần ai khác

Thêm `?demo=1` vào cuối link (`http://localhost:3000/?demo=1` hoặc `https://…vercel.app/?demo=1`)
để vào **chế độ xem thử**: 5 nhà giả đang hát, 4 khán giả, chat tự chạy,
các câu hát tự lặp kèm reaction bay lên, bảng xếp hạng chạy theo, và một màn hình chia sẻ giả vẽ bằng canvas.
Mở ra là thấy **màn hình khách** trước; nút trên thanh vàng đổi qua lại giữa màn hình khách
và màn hình nhà để xem cả hai bên.
Không xin mic, không nối mạng, không đụng tới API — dùng để xem bố cục, quay màn hình
giới thiệu hoặc gửi cho người khác xem trước.

Bấm **Vào phòng thật** trên thanh vàng ở đầu trang để quay lại bản thường.

## Chạy ở máy

```bash
npm run dev     # http://localhost:3000
npm test        # 32 test, không cần cài gói nào
```

Không có `node_modules`, không có bước build. Cần Node 18 trở lên.

> Mic và chia sẻ màn hình chỉ chạy trên `https://` hoặc `localhost`. Mở file bằng
> `file://` sẽ bị trình duyệt chặn mic.

## Deploy lên Vercel

**Quan trọng: để thư mục này làm gốc của một repo riêng.** Nếu bỏ chung vào repo
Rung Chuông Vàng thì `vercel.json` của repo đó sẽ chiếm đường dẫn `/` và trang này 404.

1. Tạo repo mới, đẩy toàn bộ thư mục này lên (index.html nằm ngay gốc repo).
2. Vercel → Add New → Project → chọn repo đó.
3. Framework Preset: **Other**. Build Command: để trống. Output Directory: để trống.
   Root Directory: gốc repo (hoặc đúng thư mục chứa `index.html` nếu để trong thư mục con).
4. Deploy. Mở `https://<tên>.vercel.app/api/health` — thấy `{"ok":true}` là chạy đúng.

Nếu vẫn 404: vào tab **Deployments → bản mới nhất → Source**, xem `index.html` có nằm ở
gốc danh sách không. Không nằm ở gốc nghĩa là Root Directory đang trỏ sai chỗ.

## Biến môi trường — tất cả đều tuỳ chọn

| Biến | Dùng để làm gì |
|---|---|
| `GAS_URL`, `GAS_SECRET` | Lưu donate vào Google Sheet qua Apps Script (xem mục Donate). Không có thì donate chỉ lưu tạm. |
| `ADMIN_KEY` | Khoá để gọi API duyệt donate. |
| `IP_SALT` | Muối riêng khi băm IP người donate. |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Lưu phòng và bảng xếp hạng bền (Vercel KV / Upstash Redis). Không có thì lưu tạm trong RAM, Vercel khởi động lại là mất. |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Tên khác của cùng hai biến trên. |
| `TURN_URL`, `TURN_USERNAME`, `TURN_CREDENTIAL` | Máy chủ TURN **riêng**, thay cho TURN công cộng miễn phí đang dùng mặc định. Nên set nếu chơi đông hoặc TURN miễn phí quá tải. |
| `PEER_HOST`, `PEER_PORT`, `PEER_PATH`, `PEER_KEY`, `PEER_SECURE` | PeerServer riêng thay cho máy chủ tín hiệu công cộng của PeerJS. |
| `LYRICS_JSON` | Ghi đè kho câu hát, dạng `[{"t":"lời","s":"tên bài","bpm":92}]`. |

## API

| Route | Việc |
|---|---|
| `GET /api/health` | Trạng thái, kiểu lưu trữ, số câu hát, có TURN hay không |
| `GET /api/ice` | Danh sách ICE server cho WebRTC (frontend tự gọi lúc vào phòng) |
| `GET /api/lyrics` · `?random=3` | Cả kho câu hát, hoặc n câu ngẫu nhiên |
| `GET /api/room?code=ABC12` | Ai đang ở trong phòng |
| `POST /api/room` | `{code,name,house}` — ghi danh vào phòng |
| `GET /api/score?code=ABC12` | Bảng xếp hạng tổng điểm của phòng |
| `POST /api/score` | `{code,name,house,points}` — chốt điểm reaction của một câu cho một nhà, trả về bảng xếp hạng mới. Chỉ chủ phòng gọi, mỗi câu một lần cho mỗi nhà. |

Mã phòng: 3–10 ký tự `A–Z` và `0–9`. Mọi route đều có CORS và giới hạn số lần gọi.

## Câu hát và bản quyền

Kho mặc định chỉ gồm dân ca và đồng dao cổ truyền nên dùng công khai thoải mái.
Lời bài hát hiện đại vẫn còn bản quyền, không nên đóng gói sẵn vào repo công khai —
chủ phòng dán danh sách riêng ngay trong trang (ô **Danh sách câu hát**), mỗi dòng:

```
Câu hát của bạn | Tên bài
```

(Vẫn nhận định dạng cũ có thêm số BPM ở cuối, chỉ là giờ không dùng tới nữa.)

Danh sách đó chỉ lưu trong trình duyệt của chủ phòng, không gửi lên server.

## Khi các nhà không vào cùng phòng được

Vào cùng mã mà mỗi người một phòng, hoặc vào rồi không nghe thấy ai — nhìn **pill trạng thái**
trên thanh đầu trang để biết đang kẹt ở đâu:

| Pill hiện | Nghĩa là | Làm gì |
|---|---|---|
| 👑 Chủ phòng · đang chờ các nhà | Mình là người mở phòng, chưa ai vào | Gửi link mời cho người khác |
| Đang kết nối chủ phòng… (2) | Đang bắt tay, tự thử lại 4 lần | Chờ vài giây |
| ✅ Đã nối N nhà | Chạy đúng | — |
| ⚠️ Mạng chặn kết nối P2P | Bắt tay thất bại cả 4 lần | Đổi mạng (4G ↔ wifi), tắt VPN, hoặc set TURN riêng |
| ⚠️ Không thấy chủ phòng | Mã phòng chưa ai mở, hoặc chủ phòng đã thoát | Tải lại trang để tự mở phòng |
| Mất tín hiệu, đang nối lại… | Rớt máy chủ tín hiệu, tự nối lại | Chờ, đừng tải lại ngay |

Thêm `?debug=1` vào cuối link để in nhật ký kết nối ra Console của trình duyệt.

Hai nguyên nhân hay gặp nhất, đều đã xử lý sẵn trong bản này:

1. **Không có TURN.** STUN không đủ cho mạng 4G có CGNAT hay wifi trường học/công ty.
   Giờ `/api/ice` luôn trả kèm TURN công cộng miễn phí.
2. **Chủ phòng rớt máy chủ tín hiệu.** Mã phòng là ID của chủ phòng trên PeerJS; rớt một
   nhịp là mất đăng ký, người vào sau liền tự thành chủ phòng thứ hai — cùng mã nhưng hai
   phòng tách biệt. Giờ chủ phòng tự `reconnect` để giữ mã.

Nếu mở trang bằng `file://` hoặc nhúng iframe (Wix) thì `/api/ice` không gọi được và mic bị
chặn: luôn mở bằng link `https://` ở tab riêng.

## Giới hạn cần biết

- Mô hình mesh P2P: ngon nhất dưới ~8 người cùng phòng, đông hơn thì máy yếu sẽ đuối.
- **Người tạo phòng là chủ phòng** và giữ danh sách thành viên — nên ở lại tới cuối.
- Tín hiệu bắt tay đi qua máy chủ công cộng của PeerJS (miễn phí, có giới hạn lưu lượng) — đổi được bằng `PEER_HOST`.
- TURN công cộng miễn phí cũng có giới hạn băng thông; chơi thường xuyên nên thuê TURN riêng.
- Chia sẻ màn hình chỉ có trên máy tính; Safari iOS và Chrome Android không hỗ trợ.
- Nên dùng tai nghe: loa ngoài vọng vào mic sẽ làm icon nhà sáng sai và lệch nút "nhà đang hát".
