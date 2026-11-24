# Karaoke Call — phòng hát các nhà

Voice call nhiều người ngay trên trình duyệt: mỗi người là một **nhà** có icon riêng,
**line distribution** cập nhật trực tiếp theo giọng ai đang hát, thử thách **hát đúng nhịp**
với câu hát ngẫu nhiên, và **chia sẻ màn hình** để chiếu MV cho cả phòng.

Giọng nói đi thẳng giữa các máy (WebRTC P2P qua PeerJS) — API ở đây chỉ làm phần phụ trợ,
tắt API thì cuộc gọi vẫn chạy.

---

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

## Chạy ở máy

```bash
npm run dev     # http://localhost:3000
npm test        # 16 test, không cần cài gói nào
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
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Lưu phòng và bảng xếp hạng bền (Vercel KV / Upstash Redis). Không có thì lưu tạm trong RAM, Vercel khởi động lại là mất. |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Tên khác của cùng hai biến trên. |
| `TURN_URL`, `TURN_USERNAME`, `TURN_CREDENTIAL` | Máy chủ TURN riêng. Chỉ cần khi có người ở mạng công ty/trường học chặn P2P — lúc đó họ vào phòng mà không ai nghe thấy. |
| `LYRICS_JSON` | Ghi đè kho câu hát, dạng `[{"t":"lời","s":"tên bài","bpm":92}]`. |

## API

| Route | Việc |
|---|---|
| `GET /api/health` | Trạng thái, kiểu lưu trữ, số câu hát, có TURN hay không |
| `GET /api/ice` | Danh sách ICE server cho WebRTC (frontend tự gọi lúc vào phòng) |
| `GET /api/lyrics` · `?random=3` | Cả kho câu hát, hoặc n câu ngẫu nhiên |
| `GET /api/room?code=ABC12` | Ai đang ở trong phòng |
| `POST /api/room` | `{code,name,house}` — ghi danh vào phòng |
| `GET /api/score?code=ABC12` | Bảng xếp hạng nhịp của phòng |
| `POST /api/score` | `{code,name,house,pct}` — gửi điểm một câu, trả về bảng xếp hạng mới |

Mã phòng: 3–10 ký tự `A–Z` và `0–9`. Mọi route đều có CORS và giới hạn số lần gọi.

## Câu hát và bản quyền

Kho mặc định chỉ gồm dân ca và đồng dao cổ truyền nên dùng công khai thoải mái.
Lời bài hát hiện đại vẫn còn bản quyền, không nên đóng gói sẵn vào repo công khai —
chủ phòng dán danh sách riêng ngay trong trang (ô **Danh sách câu hát**), mỗi dòng:

```
Câu hát của bạn | Tên bài | 92
```

Danh sách đó chỉ lưu trong trình duyệt của chủ phòng, không gửi lên server.

## Giới hạn cần biết

- Mô hình mesh P2P: ngon nhất dưới ~8 người cùng phòng, đông hơn thì máy yếu sẽ đuối.
- **Người tạo phòng là chủ phòng** và giữ danh sách thành viên — nên ở lại tới cuối.
- Tín hiệu bắt tay đi qua máy chủ công cộng của PeerJS (miễn phí, có giới hạn lưu lượng).
- Chia sẻ màn hình chỉ có trên máy tính; Safari iOS và Chrome Android không hỗ trợ.
- Nên dùng tai nghe: loa ngoài vọng vào mic sẽ bị tính là "đang hát" và làm lệch line distribution.
