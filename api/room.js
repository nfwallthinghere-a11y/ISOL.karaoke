'use strict';
/* GET  /api/room?code=ABC12   -> thông tin phòng (ai đang ở, đã hát mấy câu)
   POST /api/room {code,name,house}  -> ghi danh vào phòng, trả về trạng thái mới
   Chỉ là sổ ghi chép cho tiện theo dõi; cuộc gọi vẫn chạy P2P không cần API này. */
const { handler, send, query, readJson, roomCode, text, int, rateLimit, clientIp } = require('./_lib');
const store = require('./_store');

const key = c => 'kk:room:' + c;
const empty = c => ({ code: c, created: Date.now(), updated: Date.now(), rounds: 0, players: {} });

module.exports = handler('GET, POST', async (req, res) => {
  if (req.method === 'GET') {
    const code = roomCode(query(req).code);
    if (!code) return send(res, 400, { ok: false, error: 'ma_phong_khong_hop_le' });
    const room = await store.get(key(code));
    return send(res, 200, { ok: true, found: !!room, room: room || empty(code), storage: store.kind() });
  }

  if (!rateLimit('room:' + clientIp(req), 60, 60000))
    return send(res, 429, { ok: false, error: 'qua_nhieu_yeu_cau' });

  const body = await readJson(req, 4096);
  const code = roomCode(body.code);
  if (!code) return send(res, 400, { ok: false, error: 'ma_phong_khong_hop_le' });
  const name = text(body.name, 24);
  if (!name) return send(res, 400, { ok: false, error: 'thieu_ten' });
  const house = int(body.house, 0, 31);
  if (house == null) return send(res, 400, { ok: false, error: 'nha_khong_hop_le' });

  const room = (await store.get(key(code))) || empty(code);
  const p = room.players[name] || { name, house, rounds: 0, points: 0, best: 0 };
  p.house = house;
  p.seen = Date.now();
  room.players[name] = p;
  room.updated = Date.now();
  await store.set(key(code), room);
  send(res, 200, { ok: true, room, storage: store.kind() });
});
