'use strict';
/*
 * POST /api/donate — khán giả báo đã chuyển khoản ủng hộ một nhà.
 * Bộ trường: mã GD, người gửi, nhà, số tiền, ảnh chuyển khoản.
 *
 * Body: { code, bid, ten, nha, so, anh? }
 *   code  mã phòng
 *   bid   mã giao dịch do máy khách sinh ra (dùng để chống ghi trùng khi bấm hai lần)
 *   so    số tiền VND
 *   anh   tuỳ chọn, "data:image/jpeg;base64,…" (máy khách đã nén sẵn)
 *
 * Có GAS_URL + GAS_SECRET thì ghi thẳng vào tab "Donate" của Google Sheet, y như trang
 * Rung Chuông Vàng. Chưa cấu hình thì lưu tạm vào kho của chính server để trận đấu
 * vẫn chạy và chủ phòng vẫn xem được danh sách.
 *
 * GET /api/donate?code=ABC12 — 50 lượt ủng hộ gần nhất của phòng.
 */
const L = require('./_lib');
const store = require('./_store');

const MAX_BODY = 1.5 * 1024 * 1024;
const MAX_IMG_B64 = 900 * 1024;
const key = c => 'kk:donate:' + c;
const hasGas = () => !!(process.env.GAS_URL && process.env.GAS_SECRET);

module.exports = L.handler('GET, POST', async (req, res) => {
  if (req.method === 'GET') {
    const code = L.roomCode(L.query(req).code);
    if (!code) return L.send(res, 400, { ok: false, error: 'ma_phong_khong_hop_le' });

    /* có Google Sheet thì đọc thẳng từ đó, hỏng thì quay về bản lưu tạm */
    if (hasGas()) {
      const r = await L.callGas({ action: 'list', sheet: 'Donate', code, limit: 50 }, 20000);
      if (r.ok) return L.send(res, 200, { ok: true, code, total: r.total || 0,
                                          items: r.items || [], luu: 'sheet' });
    }
    const list = (await store.get(key(code))) || [];
    const total = list.reduce((a, b) => a + (b.so || 0), 0);
    return L.send(res, 200, { ok: true, code, total, items: list.slice(0, 50), luu: store.kind() });
  }

  const ip = L.clientIp(req);
  if (!L.rateLimit('donate:' + ip, 20, 60000))   // cả phòng có thể chung một wifi
    return L.send(res, 429, { ok: false, error: 'qua_nhieu_yeu_cau' });

  let b;
  try { b = await L.readJson(req, MAX_BODY); }
  catch (e) { return L.send(res, e.status || 400, { ok: false, error: e.status === 413 ? 'anh_qua_nang' : 'json_hong' }); }

  /* duyệt / từ chối một mã GD — cần ADMIN_KEY, ghi thẳng vào Sheet */
  if (b.action === 'duyet') {
    if (!L.isAdmin(req)) return L.send(res, 403, { ok: false, error: 'khong_co_quyen' });
    if (!hasGas()) return L.send(res, 503, { ok: false, error: 'chua_cau_hinh_gas' });
    const r = await L.callGas({ action: 'mark', sheet: 'Donate', adminKey: process.env.GAS_ADMIN_KEY || process.env.ADMIN_KEY,
                                bid: String(b.bid || ''), kq: L.cell(b.kq, 40) || 'Đã duyệt' }, 20000);
    if (!r.ok) return L.send(res, r.status || 502, { ok: false, error: r.error || 'gas_error' });
    return L.send(res, 200, { ok: true, row: r.row });
  }

  const code = L.roomCode(b.code);
  if (!code) return L.send(res, 400, { ok: false, error: 'ma_phong_khong_hop_le' });
  const bid = String(b.bid || '');
  if (!/^b[a-z0-9]{6,40}$/.test(bid)) return L.send(res, 400, { ok: false, error: 'ma_gd_khong_hop_le' });
  const so = L.int(b.so, 1000, 1000000000);
  if (so === null) return L.send(res, 400, { ok: false, error: 'so_tien_khong_hop_le' });
  const nha = L.cell(b.nha, 40);
  if (!nha) return L.send(res, 400, { ok: false, error: 'thieu_nha' });
  const ten = L.cell(b.ten, 40) || 'Khán giả';

  let image = null;
  if (b.anh) {
    const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(b.anh));
    if (!m) return L.send(res, 400, { ok: false, error: 'anh_khong_hop_le' });
    if (m[2].length > MAX_IMG_B64) return L.send(res, 413, { ok: false, error: 'anh_qua_nang' });
    image = { b64: m[2], mime: 'image/' + m[1], name: code + '_' + bid + '.' + (m[1] === 'jpeg' ? 'jpg' : m[1]) };
  }

  /* có Google Sheet thì ghi vào đó */
  if (hasGas()) {
    const row = [
      L.nowVN(), code, bid, ten, nha, so, '', 'Chờ duyệt',
      L.ipHash(ip), L.cell(req.headers['user-agent'], 160),
    ];
    const r = await L.callGas({
      action: 'append', sheet: 'Donate', header: L.SHEETS.Donate, rows: [row],
      dedupeKey: 'donate:' + code + ':' + bid,
      image, imageCol: L.SHEETS.Donate.indexOf('Ảnh chuyển khoản'),
    }, 28000);
    if (!r.ok) return L.send(res, r.status || 502, { ok: false, error: r.error || 'gas_error' });
    return L.send(res, 200, { ok: true, dup: !!r.dup, anh: !!r.anh, luu: 'sheet' });
  }

  /* chưa có Sheet: lưu tạm ở server, không giữ ảnh cho nhẹ */
  const list = (await store.get(key(code))) || [];
  if (list.some(x => x.bid === bid))
    return L.send(res, 200, { ok: true, dup: true, luu: store.kind() });
  list.unshift({ bid, ten, nha, so, anh: !!image, luc: L.nowVN(), trangThai: 'Chờ duyệt' });
  await store.set(key(code), list.slice(0, 200));
  L.send(res, 200, { ok: true, dup: false, anh: !!image, luu: store.kind() });
});
