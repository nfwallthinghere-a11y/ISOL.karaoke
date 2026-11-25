# Karaoke Call — phòng hát các nhà

Voice call nhiều người ngay trên trình duyệt: mỗi người là một **nhà** có icon riêng,
câu hát ngẫu nhiên hiện lên sau tiếng đếm **3·2·1**, **khán giả chấm điểm bằng reaction**,
**bảng xếp hạng điểm** chạy trực tiếp, và **chia sẻ màn hình** để chiếu MV cho cả phòng.

**Cách đồng bộ (bản này đã dựng lại):** mọi thứ *trừ tiếng hát* đều đi qua server
(`/api/sync`) — danh sách nhà, lời bài hát, đếm 3·2·1, reaction, bảng xếp hạng, chat,
thông báo donate. P2P (WebRTC qua PeerJS) nay chỉ còn làm **một** việc duy nhất:
truyền giọng nói và màn hình. Mạng có chặn P2P thì phòng vẫn chạy đầy đủ, chỉ là
không nghe được tiếng nhau — trước đây chặn P2P là mất sạch.

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

## Chủ phòng tắt mic các nhà

Mỗi thẻ nhà có nút 🔇 ở góc (chỉ chủ phòng thấy, và không có trên thẻ của chính mình).
Bấm là mic nhà đó tắt — **tắt thật ở máy nhà đó**, không phải chỉ tắt loa bên mình, nên cả
phòng đều không nghe thấy nữa. Thẻ nhà hiện viền đứt kèm dòng *"chủ phòng đã tắt mic"*, và
nút mic của nhà đó đổi thành *"🔇 Chủ phòng đã tắt mic"* và bị khoá — tự bấm không mở lại được.
Bấm 🔊 là mở lại.

Nút **🔇 Tắt mic tất cả nhà** cạnh nút Chốt điểm tắt một lượt mọi nhà trừ chủ phòng; bấm lần
nữa thì mở lại hết. Khán giả vốn không có mic nên không ảnh hưởng.

Cơ chế là *hợp tác*: lệnh đi qua `/api/sync`, máy nhà đó nhận rồi tự tắt đường tiếng của mình.
Đủ dùng cho một buổi chơi, nhưng không phải là chặn ở tầng mạng — ai sửa code trong trình duyệt
thì vẫn nói được.

## Donate

Nút **💝 Donate** trên thanh đầu trang mở hộp ủng hộ, bộ trường giống trang Rung Chuông Vàng:
mã giao dịch (tự sinh, chống ghi trùng khi bấm hai lần), người gửi, nhà được ủng hộ, số tiền
và ảnh chuyển khoản (ảnh tự nén xuống dưới ~190KB trước khi gửi).

Mỗi nhà có **mã QR riêng**: chọn nhà trong hộp donate là hiện đúng QR của nhà đó, kèm nút
*Mở mã QR* và *Mở trang quỹ* (MoMo / Timo / Google Sheet tuỳ nhà). Nhà đã **về bờ** thì hiện
lời nhắn thay cho QR và không gửi donate được nữa.

Mỗi nhà có **avatar riêng** (logo lấy từ poster Hội Nghệ Ít Liều Nhiều), nhúng thẳng vào
`index.html` dạng WebP tròn 180px nên không phụ thuộc mạng ngoài.

Danh sách 26 nhà (10 nhà còn nhận donate, 16 nhà đã về bờ), ảnh QR trên Google Drive và link quỹ
lấy từ trang Rung Chuông Vàng,
nằm ở hằng `HOUSES` đầu `index.html` — sửa ở đó là cả trang đổi theo.

### Nơi lưu — Google Sheet qua Apps Script

Backend lưu donate nằm ở `gas/Code.gs`, cùng cách trang Rung Chuông Vàng đang chạy.

1. Tạo một Google Sheet mới → **Extensions → Apps Script** → dán nguyên `gas/Code.gs` đè vào.
2. **Project Settings → Script properties**:
   | Thuộc tính | Bắt buộc | Dùng để |
   |---|---|---|
   | `SECRET` | không | Chuỗi ngẫu nhiên, phải trùng `GAS_SECRET`. **Không đặt thì script nhận mọi yêu cầu** — ai biết URL `/exec` cũng ghi được vào Sheet và tải ảnh vào Drive của bạn. Chạy hàm `taoSecret()` là có ngay một chuỗi. |
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

**Khoá hay không khoá:** `GAS_SECRET` để trống thì donate vẫn ghi vào Sheet bình thường, miễn là
Apps Script cũng không đặt `SECRET`. Tiện lúc dựng, nhưng URL `/exec` là địa chỉ công khai: ai có nó
cũng POST được. Muốn khoá lại sau: chạy `taoSecret()` trong Apps Script rồi dán chuỗi vào `GAS_SECRET`.

**Chưa cấu hình Apps Script** thì API vẫn chạy: donate lưu tạm trong bộ nhớ server (hoặc KV
nếu có bật), không giữ ảnh — đủ để thử, nhưng Vercel khởi động lại là mất.

Mỗi lượt ủng hộ được báo vào khung chat cho cả phòng thấy. Trạng thái mặc định là *Chờ duyệt* —
ban tổ chức tự đối soát, code không tự cộng tiền thành điểm.

## Kho bài hát từ Google Sheet + video karaoke tự mở

Lời bài hát **không nằm trong mã nguồn**. Máy chủ đọc thẳng Google Sheet của bạn mỗi lần chủ
phòng bấm *Câu hát mới*, nhớ tạm 5 phút. Sửa sheet là trang đổi theo ngay, không phải deploy lại,
và kho lời vẫn thuộc về bạn chứ không bị sao chép vào repo công khai.

**Cài:**

1. Sheet để chế độ chia sẻ **"Bất kỳ ai có đường liên kết"** (chỉ cần quyền Người xem).
2. Vercel → Environment Variables → `SHEET_CSV_URL` = link sheet (dạng `.../edit?usp=sharing` là được).
3. Redeploy. Kiểm tra `/api/songs` phải thấy danh sách bài, `/api/health` thấy `"sheet":true`.

**Ba cách mở lượt hát** (nút của chủ phòng, ở ngay dưới khung lời):

| Chọn bài | Bấm | Kết quả |
|---|---|---|
| 🎲 Bài ngẫu nhiên | **Một đoạn** | Một đoạn ngẫu nhiên của một bài ngẫu nhiên |
| 🎲 Bài ngẫu nhiên | **Hát cả bài** | Nguyên một bài ngẫu nhiên, đủ các đoạn |
| Chọn tên bài | **Một đoạn** | Một đoạn ngẫu nhiên *của bài đó* |
| Chọn tên bài | **Hát cả bài** | Nguyên bài đó |

Hát cả bài thì khung lời tự đổi kiểu: chữ nhỏ lại, canh trái, cuộn được, có nhãn
*Verse 1 / Chorus / Bridge…* phân đoạn. Điểm tính suốt từ lúc hết 3·2·1 tới lúc chủ phòng
bấm **Chốt điểm**, nên cả bài là một lượt chấm.

Ô chọn bài tự nạp danh sách từ sheet khi mình là chủ phòng; sửa sheet xong bấm vào ô là có
bài mới (nhớ tạm 5 phút).

**Bốc đoạn, không bốc câu lẻ:** khi bấm *Một đoạn*, server lấy ngẫu nhiên **một đoạn**
(Verse / Pre-Chorus / Chorus / Bridge…) theo nhãn ngoặc vuông trong ô LYRICS, tối đa 6 dòng
liên tiếp. Bỏ khối ghi công đầu ô và nhãn người hát kiểu `[WILL]`. Bài không có nhãn đoạn thì
tự gom thành khối 5 dòng.

**Cắt bản dịch tiếng Anh thế nào — chỉ cắt bản dịch, không cắt lời tiếng Anh của bài:**
nhiều bài có lời tiếng Anh thật (*Move On*, *Keep Me In Love*, câu rap chen tiếng Anh…), nên
code **không đoán theo từng dòng** nữa. Nó tìm dòng *mở đầu khối dịch* — hàng gạch ngăn
(`______`), `Unofficial` / `Fan-made`, `Engsub`, `English … Adaptation/Translation`,
`… by @ai-đó`, `Title:`, `(… bản Tiếng Anh)` — rồi cắt từ đó tới cuối ô.

Một mốc như vậy chỉ được tính khi **phía trên đã có lời hát**. Vài bài để dòng
`Engsub by @…` ngay đầu ô: ở đó nó không phải chỗ cắt mà là dấu hiệu cả ô là **bản song ngữ
xen từng dòng** (mỗi câu tiếng Việt kèm ngay câu tiếng Anh ở dòng dưới) — với mấy bài đó, và
chỉ mấy bài đó, code mới lọc theo từng dòng.

Dòng ghi công bằng tiếng Anh phải có dấu hai chấm mới bị bỏ (`Music:`, `Producer:`), để câu
hát mở đầu bằng "Music is…" hay "Beat này…" không bị bỏ oan.

**Soi lại một bài:** mở `/api/songs?bai=tên bài&moi=1` để xem đúng những đoạn code tách ra
(`moi=1` là đọc lại sheet ngay, khỏi chờ hết 5 phút nhớ tạm). Sai chỗ nào thì sửa sheet —
thường là thêm một hàng `______` trước khối dịch cho rõ.

**Sheet cần có gì:** một hàng tiêu đề chứa `STT`, `TÊN BÀI`, `LYRICS` (và tuỳ chọn `TRÌNH BÀY`,
`Karaoke`). Ô `LYRICS` là cả bài, mỗi câu một dòng — code tự tách, bỏ nhãn đoạn (`[Verse]`,
`Điệp khúc:`) và những dòng quá ngắn hoặc quá dài. Sheet nhiều khối tiêu đề cũng đọc được vì
bộ đọc ưu tiên khối có cột `STT`.

**Video karaoke**: web không tự nhúng YouTube nữa (trình duyệt chặn tự phát, và nhúng hay hỏng).
Chủ phòng mở video bằng nút **🖥️ Chia sẻ màn hình** như trước — chọn thẻ *Tab*, chọn tab đang mở
YouTube, nhớ tick ô chia sẻ âm thanh.

Cột `Link karaoke` trong sheet vẫn đọc được và trả về trong `/api/songs`, để dành khi cần.

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
│  ├─ _lib.js          helper chung (CORS, đọc JSON, rate limit, validate, cfg)
│  ├─ _config.js       nơi ghi thẳng khoá vào code nếu không dùng biến môi trường
│  ├─ _store.js        kho dữ liệu: Vercel KV/Upstash nếu có, không thì bộ nhớ tạm
│  ├─ _lyrics.js       kho câu hát mặc định (dân ca/đồng dao, không bản quyền)
│  ├─ _csv.js          đọc Google Sheet dạng CSV, tách đoạn verse/chorus/bridge
│  ├─ sync.js          GET+POST /api/sync  ĐỒNG BỘ CẢ PHÒNG (phần quan trọng nhất)
│  ├─ songs.js         GET  /api/songs    kho bài hát lấy từ Google Sheet
│  ├─ donate.js        GET+POST /api/donate lưu thông tin donate
│  ├─ health.js        GET  /api/health   kiểm tra sống chết
│  ├─ ice.js           GET  /api/ice      máy chủ STUN/TURN cho WebRTC
│  ├─ lyrics.js        GET  /api/lyrics   kho câu hát / câu ngẫu nhiên
│  ├─ room.js          GET+POST /api/room  sổ ghi danh phòng
│  └─ score.js         GET+POST /api/score điểm nhịp + bảng xếp hạng
└─ tests/
   ├─ dev-server.js    máy chủ chạy thử ở máy, định tuyến giống Vercel
   ├─ api.test.js      test cho API chung
   ├─ sync.test.js     test cho đồng bộ phòng
   ├─ songs.test.js    test cho kho bài hát từ sheet
   └─ gas.test.js      test cho đường donate qua Apps Script
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
npm test        # 45 test, không cần cài gói nào
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

## Hai cách cấu hình: biến môi trường hoặc ghi thẳng vào code

Mọi khoá đọc qua hàm `cfg()` trong `api/_lib.js`, thứ tự ưu tiên:
**biến môi trường trên Vercel → `api/_config.js`**.

- **Biến môi trường** (khuyên dùng): Vercel → Settings → Environment Variables → Redeploy.
  Khoá không nằm trong repo, đổi khoá không cần sửa code.
- **Ghi thẳng vào `api/_config.js`**: mở file, điền giá trị. File này **chỉ chạy ở máy chủ**,
  trình duyệt không tải được, nên khoá không lộ cho người vào phòng — nhưng nó **nằm trong repo**,
  nên chỉ làm vậy khi repo để **Private**.

**Tuyệt đối không** dán `GAS_SECRET`, `ADMIN_KEY`, `YT_API_KEY` vào `index.html`: file đó gửi
thẳng tới mọi trình duyệt, ai cũng đọc được và ghi rác vào Google Sheet của bạn.

Riêng `SHEET_CSV_URL` chỉ là link sheet đã chia sẻ công khai, không phải bí mật, để đâu cũng được.

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
| `SHEET_CSV_URL` | Link Google Sheet chứa kho bài hát (xem mục trên). Không có thì dùng kho dân ca mặc định. |
| `YT_API_KEY` | Tự tìm video karaoke trên YouTube theo tên bài. |
| `LYRICS_JSON` | Ghi đè kho câu hát dự phòng, dạng `[{"t":"lời","s":"tên bài"}]`. |

## API

| Route | Việc |
|---|---|
| `GET /api/songs?bai=<tên bài>` · `&moi=1` | Xem mọi đoạn code tách được từ một bài, để kiểm tra việc cắt bản dịch |
| `GET /api/sync?code=ABC12&since=N` | Trạng thái phòng. `since` trùng `seq` thì chỉ trả về `seq` + giờ server cho nhẹ |
| `GET /api/sync?v=XEMABC` | Khán giả tra mã phòng từ mã người xem |
| `POST /api/sync` | `{code,vcode,me:{id,name,house,v,pid,muted},act}`. `act.t`: `join` · `leave` · `round` · `close` · `rx` · `chat` · `sys` · `reset` · `mute` · `muteall`. Chỉ chủ phòng mở/chốt câu hát và tắt mic người khác |
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

## Cần gắn kho dùng chung (Vercel KV / Upstash) — quan trọng

`/api/sync` giữ trạng thái phòng trong `_store.js`. Có KV/Redis thì mọi máy đọc cùng một
bản phòng; **không có thì mỗi instance của Vercel giữ một bản riêng** và các nhà sẽ bị lệch
phòng. Chạy ở máy thì bộ nhớ tạm là đủ, deploy thật thì nên gắn:

1. Vercel > project > **Storage** > **Upstash Redis** (bản miễn phí, không cần thẻ).
2. Bấm **Connect** — Vercel tự thêm `KV_REST_API_URL` và `KV_REST_API_TOKEN`.
3. Deploy lại. `GET /api/health` sẽ báo `storage: "kv"`.

Chưa gắn thì chủ phòng sẽ thấy dòng cảnh báo ngay trong khung chat.

Lượng gọi rất nhẹ: mỗi máy hỏi thăm 1,2 giây/lần lúc đang hát và 3,5 giây/lần lúc nghỉ,
reaction thì gom cục rồi gửi một lần — 20 người chơi một buổi hai tiếng tốn khoảng
20–40 nghìn lệnh, trong khi bản miễn phí cho 500 nghìn lệnh/tháng.

## Pill trạng thái nói gì

| Pill hiện | Nghĩa là | Làm gì |
|---|---|---|
| ✅ Trong phòng · N nhà | Đồng bộ tốt, nghe được tiếng | — |
| ✅ Trong phòng · N nhà · ⚠️ chưa nghe được tiếng | Lời, chat, điểm đều chạy; chỉ tiếng chưa bắt tay được | Bấm vào pill để thử nối lại tiếng; mãi không được là mạng chặn P2P |
| ⚠️ Mất kết nối server · bấm để thử lại | Hỏng mạng hoặc `/api/sync` lỗi | Bấm vào pill, hoặc kiểm tra mạng |

Thêm `?debug=1` vào cuối link để in nhật ký ra Console của trình duyệt.

**Chặn P2P thì mất gì?** Chỉ mất tiếng hát và màn hình chia sẻ. Lời bài hát, đếm 3·2·1,
reaction, bảng xếp hạng và chat vẫn chạy nguyên vì không đi qua P2P nữa. Muốn chắc ăn phần
tiếng: đăng ký một TURN riêng (Metered, Twilio…) rồi đặt `TURN_URL` · `TURN_USER` ·
`TURN_PASS`, hoặc cho cả phòng vào chung một wifi.

## Giới hạn cần biết

- Tiếng hát vẫn là mesh P2P: ngon nhất dưới ~8 nhà cùng nói, đông hơn thì máy yếu sẽ đuối.
  Phần đồng bộ thì không giới hạn như vậy vì đi qua server.
- **Chủ phòng là nhà vào sớm nhất**, do server chọn. Chủ phòng rời đi thì nhà kế tiếp tự lên
  thay, không còn cảnh cùng mã mà hai phòng tách biệt như bản P2P cũ.
- Điểm và danh sách phòng sống 1 ngày trong kho; ai mất mạng hơn 45 giây thì rơi khỏi danh sách.
- Tín hiệu bắt tay đi qua máy chủ công cộng của PeerJS (miễn phí, có giới hạn lưu lượng) — đổi được bằng `PEER_HOST`.
- TURN công cộng miễn phí cũng có giới hạn băng thông; chơi thường xuyên nên thuê TURN riêng.
- Chia sẻ màn hình chỉ có trên máy tính; Safari iOS và Chrome Android không hỗ trợ.
- Chia sẻ màn hình **không chạy trong khung nhúng** (Wix…) — phải mở link gốc ở tab riêng.
  Safari và Firefox chỉ nhận yêu cầu đơn giản nên không lấy được tiếng tab; Chrome/Edge thì có.
  macOS còn cần bật *Cài đặt > Quyền riêng tư và bảo mật > Ghi màn hình* cho trình duyệt.
- Nên dùng tai nghe: loa ngoài vọng vào mic sẽ làm icon nhà sáng sai và lệch nút "nhà đang hát".
