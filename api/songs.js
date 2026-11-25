'use strict';
/*
 * GET /api/songs            -> danh mục bài hát (tên, số câu, id video) — không kèm lời
 * GET /api/songs?random=1   -> một ĐOẠN ngẫu nhiên (verse/chorus/bridge…) của một bài ngẫu nhiên
 * GET /api/songs?bai=<tên bài>  -> xem TẤT CẢ đoạn mà code tách ra từ một bài, để kiểm tra
 *                                  xem có lọc đúng (chỉ bỏ bản dịch tiếng Anh) hay không
 * GET /api/songs?moi=1      -> đọc lại sheet ngay, không dùng bản nhớ tạm 5 phút
 * GET /api/songs?sheet=<link google sheet>  -> đọc sheet khác thay cho sheet mặc định
 *
 * Lời bài hát KHÔNG nằm trong mã nguồn. Máy chủ đọc thẳng Google Sheet của bạn mỗi lần
 * cần, nhớ tạm 5 phút. Sửa sheet là trang đổi theo, không phải deploy lại.
 *
 * Biến môi trường:
 *   SHEET_CSV_URL  link Google Sheet chứa bảng bài hát (chia sẻ "bất kỳ ai có đường liên kết")
 *   YT_API_KEY     tuỳ chọn — có thì tự tìm video karaoke trên YouTube theo tên trong sheet
 */
const L = require('./_lib');
const { sheetCsvUrl, docBaiHat, timBai } = require('./_csv');

/* Sheet lời bài hát mặc định. Không phải bí mật (sheet đã chia sẻ công khai), để sẵn đây
   để web vẫn chạy kể cả khi quên điền api/_config.js hay quên đặt biến môi trường.
   Thứ tự ưu tiên: ?sheet= trên URL > biến môi trường > api/_config.js > dòng này. */
const SHEET_MAC_DINH = 'https://docs.google.com/spreadsheets/d/1vG34NBLiQJJKD0Z_a2atMlGsL0u5Y_27-ZeCtH9jbaA/edit?usp=sharing';

const CACHE = new Map();           // url -> {luc, songs}
const YT = new Map();              // tên video -> id
const TTL = 5 * 60 * 1000;

async function taiSheet(link, moi) {
  const url = sheetCsvUrl(link);
  if (!url) return { ok: false, error: 'link_sheet_khong_hop_le', status: 400 };

  const c = CACHE.get(url);
  if (!moi && c && Date.now() - c.luc < TTL) return { ok: true, songs: c.songs, cached: true };

  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch(url, { redirect: 'follow', signal: ctl.signal });
    if (!r.ok) return { ok: false, error: 'khong_tai_duoc_sheet_' + r.status, status: 502 };
    const txt = await r.text();
    if (/<html/i.test(txt.slice(0, 200)))
      return { ok: false, error: 'sheet_chua_chia_se_cong_khai', status: 403 };
    const kq = docBaiHat(txt);
    if (!kq.ok) return { ok: false, error: kq.error, status: 422 };
    CACHE.set(url, { luc: Date.now(), songs: kq.songs });
    return { ok: true, songs: kq.songs, cached: false };
  } catch (e) {
    return { ok: false, error: e.name === 'AbortError' ? 'sheet_timeout' : 'sheet_khong_voi_toi', status: 504 };
  } finally { clearTimeout(t); }
}

/* Sheet chỉ ghi TÊN video karaoke chứ không có link, nên tìm hộ khi có khoá API. */
async function timYt(tua) {
  const key = L.cfg('YT_API_KEY');
  if (!key || !tua) return '';
  if (YT.has(tua)) return YT.get(tua);
  try {
    const u = 'https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=1' +
              '&videoEmbeddable=true&q=' + encodeURIComponent(tua) + '&key=' + key;
    const r = await fetch(u);
    if (!r.ok) { YT.set(tua, ''); return ''; }
    const j = await r.json();
    const id = (j.items && j.items[0] && j.items[0].id && j.items[0].id.videoId) || '';
    YT.set(tua, id);
    return id;
  } catch (e) { return ''; }
}

module.exports = L.handler('GET', async (req, res) => {
  const q = L.query(req);
  const link = q.sheet || L.cfg('SHEET_CSV_URL') || SHEET_MAC_DINH;
  if (!link) return L.send(res, 503, { ok: false, error: 'chua_cau_hinh_sheet' });

  const kq = await taiSheet(link, q.moi != null && q.moi !== '');
  if (!kq.ok) return L.send(res, kq.status || 502, { ok: false, error: kq.error });
  const songs = kq.songs;
  if (!songs.length) return L.send(res, 422, { ok: false, error: 'sheet_khong_co_bai_nao' });

  /* Xem một bài: chủ phòng dán tên bài vào để soi code tách đoạn đúng chưa. */
  if (q.bai) {
    const tim = L.text(q.bai, 80);
    const b = timBai(songs, tim);
    if (!b) return L.send(res, 404, { ok: false, error: 'khong_thay_bai',
      goiY: songs.map(x => x.ten).slice(0, 10) });
    return L.send(res, 200, {
      ok: true, ten: b.ten, ca: b.ca, yt: b.yt, kara: b.kara,
      soDoan: b.doan.length,
      doan: b.doan.map(d => ({ nhan: d.nhan, soDong: d.dong.length, dong: d.dong })),
    });
  }

  if (q.random != null && q.random !== '') {
    const b = songs[Math.floor(Math.random() * songs.length)];
    const d = b.doan[Math.floor(Math.random() * b.doan.length)];
    const yt = b.yt || await timYt(b.kara || (b.ten + ' karaoke'));
    return L.send(res, 200, {
      ok: true, ten: b.ten, ca: b.ca, nhan: d.nhan, dong: d.dong,
      cau: d.dong.join('\n'), yt, kara: b.kara,
      soDoan: b.doan.length, tongBai: songs.length,
    });
  }

  /* danh mục: không trả lời bài hát, chỉ thông tin để chọn */
  res.setHeader('Cache-Control', 'public, max-age=60');
  L.send(res, 200, {
    ok: true, tongBai: songs.length, cached: kq.cached,
    songs: songs.map(b => ({ ten: b.ten, ca: b.ca, soDoan: b.doan.length, yt: b.yt, kara: b.kara })),
  });
});
