'use strict';
/*
 * Đồng bộ phòng KHÔNG cần P2P.
 *
 * Mọi thứ trừ giọng nói đều đi qua đây: danh sách người trong phòng, câu hát đang mở,
 * mốc đếm 3·2·1, điểm reaction, bảng xếp hạng, chat. Máy nào mở được web là chạy,
 * không phụ thuộc mạng có chặn P2P hay không.
 *
 *   GET  /api/sync?code=ABC12&since=<seq>   -> trạng thái phòng (bỏ qua nếu chưa đổi)
 *   POST /api/sync {code, me:{...}, act:{...}}  -> gửi một hành động, trả về trạng thái mới
 *
 * Giữ cho nhẹ: trạng thái là MỘT gói JSON nhỏ; reaction gom cục rồi gửi mỗi ~0,7 giây;
 * máy khách hỏi 1,5 giây/lần lúc đang hát và 4 giây/lần lúc nghỉ.
 */
const L = require('./_lib');
const store = require('./_store');

const key = c => 'kk:sync:' + c;
const keyV = v => 'kk:vmap:' + v;     // mã người xem -> mã phòng
const SONG = 45000;          // quá lâu không hỏi thăm thì coi như đã rời phòng
const CHAT_TOI_DA = 60;

function phongMoi(code) {
  return { code, seq: 1, host: '', tao: Date.now(), round: null, nguoi: {}, chat: [], chatId: 1 };
}

function don(p) {                                    // bỏ người đã rời, chọn lại chủ phòng
  const now = Date.now();
  for (const id in p.nguoi) if (now - (p.nguoi[id].seen || 0) > SONG) delete p.nguoi[id];
  if (!p.nguoi[p.host]) {
    const con = Object.values(p.nguoi).filter(x => !x.v).sort((a, b) => a.vao - b.vao);
    p.host = con.length ? con[0].id : '';
  }
  return p;
}

const pt = n => Math.round((Number(n) || 0) * 10) / 10;

async function doc(code) { return (await store.get(key(code))) || phongMoi(code); }
async function ghi(p) { p.seq++; p.updated = Date.now(); await store.set(key(p.code), p); return p; }

/* Gói trả về cho máy khách — chỉ những gì cần vẽ lên màn hình */
function goi(p, since) {
  const doiMoi = p.seq !== Number(since);
  const o = { ok: true, seq: p.seq, now: Date.now(), host: p.host, storage: store.kind() };
  if (!doiMoi) return o;                              // chưa đổi gì thì khỏi gửi lại cho nhẹ
  o.round = p.round;
  o.nguoi = Object.values(p.nguoi).map(x => ({
    id: x.id, pid: x.pid || '', name: x.name, house: x.house, v: !!x.v,
    muted: !!x.muted, bit: !!x.bit, pts: pt(x.pts), rx: pt(x.rx),
  }));
  o.chat = p.chat;
  return o;
}

module.exports = L.handler('GET, POST', async (req, res) => {
  const q = L.query(req);

  if (req.method === 'GET') {
    if (q.v) {                                      // khán giả chỉ biết mã xem
      const vc = L.roomCode(q.v);
      const ma = vc ? await store.get(keyV(vc)) : null;
      if (!ma) return L.send(res, 404, { ok: false, error: 'chua_mo_phong' });
      return L.send(res, 200, { ok: true, code: ma });
    }
    const code = L.roomCode(q.code);
    if (!code) return L.send(res, 400, { ok: false, error: 'ma_phong_khong_hop_le' });
    const p = don(await doc(code));
    return L.send(res, 200, goi(p, q.since));
  }

  if (!L.rateLimit('sync:' + L.clientIp(req), 1200, 60000))
    return L.send(res, 429, { ok: false, error: 'qua_nhieu_yeu_cau' });

  const b = await L.readJson(req, 32768);
  const code = L.roomCode(b.code);
  if (!code) return L.send(res, 400, { ok: false, error: 'ma_phong_khong_hop_le' });
  const me = b.me || {};
  const id = L.text(me.id, 40);
  if (!id) return L.send(res, 400, { ok: false, error: 'thieu_id' });

  let p = don(await doc(code));

  /* ghi danh / cập nhật người gửi */
  const cu = p.nguoi[id] || { id, vao: Date.now(), pts: 0, rx: 0 };
  cu.name = L.text(me.name, 24) || 'Khách';
  cu.house = L.int(me.house, 0, 63) || 0;
  cu.v = !!me.v;
  cu.pid = L.text(me.pid, 60);
  cu.muted = !!me.muted;
  cu.seen = Date.now();
  p.nguoi[id] = cu;
  if (!p.host && !cu.v) p.host = id;

  const vc = L.roomCode(b.vcode);                   // nhà nào vào cũng ghi lại mã xem của phòng
  if (vc && !cu.v) { try { await store.set(keyV(vc), code, 86400) } catch (e) {} }

  const act = b.act || {};
  const laHost = p.host === id;

  switch (act.t) {
    case 'join': break;                               // chỉ ghi danh, đã làm ở trên

    case 'leave': delete p.nguoi[id]; break;

    case 'round': {                                   // chủ phòng mở câu mới
      if (!laHost) break;
      Object.values(p.nguoi).forEach(x => { x.pts = pt((x.pts || 0) + (x.rx || 0)); x.rx = 0; });
      p.round = {
        idx: ((p.round && p.round.idx) || 0) + 1,
        line: L.textNl(act.line, 9000), song: L.text(act.song, 120), nhan: L.text(act.nhan, 40),
        startAt: Date.now() + (L.int(act.cho, 0, 10000) || 700),
        open: true,
      };
      break;
    }

    case 'close':                                     // chốt điểm câu đang mở
      if (!laHost || !p.round) break;
      p.round.open = false;
      Object.values(p.nguoi).forEach(x => { x.pts = pt((x.pts || 0) + (x.rx || 0)); x.rx = 0; });
      break;

    case 'rx': {                                      // gom cục điểm reaction
      const ds = act.ds || {};
      for (const to in ds) {
        const n = L.num(ds[to], 0, 500, 1);
        const ng = p.nguoi[to];
        if (n && ng && !ng.v) ng.rx = pt((ng.rx || 0) + n);
      }
      break;
    }

    case 'chat': {
      const m = L.text(act.m, 300);
      if (!m) break;
      p.chat.push({ i: p.chatId++, n: cu.name, h: cu.house, v: cu.v, m, ts: Date.now() });
      if (p.chat.length > CHAT_TOI_DA) p.chat = p.chat.slice(-CHAT_TOI_DA);
      break;
    }

    case 'sys': {                                     // thông báo hệ thống (ai vào, ai donate)
      const m = L.text(act.m, 200);
      if (!m) break;
      p.chat.push({ i: p.chatId++, sys: true, m, ts: Date.now() });
      if (p.chat.length > CHAT_TOI_DA) p.chat = p.chat.slice(-CHAT_TOI_DA);
      break;
    }

    /* Chủ phòng tắt mic của một nhà. Máy nhà đó nhận lệnh rồi tự tắt đường tiếng,
       nên các nhà khác không nghe thấy nữa chứ không phải chỉ tắt loa một bên. */
    case 'mute': {
      if (!laHost) break;
      const ai = L.text(act.id, 40), ng = p.nguoi[ai];
      if (ng && !ng.v) ng.bit = !!act.on;
      break;
    }

    case 'muteall':
      if (!laHost) break;
      Object.values(p.nguoi).forEach(x => { if (!x.v && x.id !== id) x.bit = !!act.on });
      break;

    case 'reset':
      if (!laHost) break;
      Object.values(p.nguoi).forEach(x => { x.pts = 0; x.rx = 0; });
      break;

    default: break;
  }

  p = await ghi(p);
  L.send(res, 200, goi(p, -1));
});
