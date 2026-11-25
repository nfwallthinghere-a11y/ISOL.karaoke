'use strict';
/* POST /api/score {code,name,house,points}  -> cộng điểm reaction của một câu hát cho một nhà
   GET  /api/score?code=ABC12                -> bảng xếp hạng tổng điểm của phòng
   Chỉ chủ phòng gọi POST (mỗi câu một lần cho mỗi nhà) để điểm không bị đếm đôi. */
const { handler, send, query, readJson, roomCode, text, int, num, rateLimit, clientIp } = require('./_lib');
const store = require('./_store');

const key = c => 'kk:room:' + c;

function board(room) {
  return Object.values(room.players || {})
    .map(p => ({
      name: p.name, house: p.house,
      rounds: p.rounds || 0,
      points: Math.round((p.points || 0) * 10) / 10,
      best: Math.round((p.best || 0) * 10) / 10,
    }))
    .filter(p => p.rounds > 0)
    .sort((a, b) => b.points - a.points || b.best - a.best);
}

module.exports = handler('GET, POST', async (req, res) => {
  if (req.method === 'GET') {
    const code = roomCode(query(req).code);
    if (!code) return send(res, 400, { ok: false, error: 'ma_phong_khong_hop_le' });
    const room = await store.get(key(code));
    return send(res, 200, {
      ok: true, code, rounds: room ? room.rounds : 0,
      board: room ? board(room) : [], storage: store.kind(),
    });
  }

  if (!rateLimit('score:' + clientIp(req), 240, 60000))
    return send(res, 429, { ok: false, error: 'qua_nhieu_yeu_cau' });

  const body = await readJson(req, 4096);
  const code = roomCode(body.code);
  if (!code) return send(res, 400, { ok: false, error: 'ma_phong_khong_hop_le' });
  const name = text(body.name, 24);
  if (!name) return send(res, 400, { ok: false, error: 'thieu_ten' });
  const house = int(body.house, 0, 31);
  if (house == null) return send(res, 400, { ok: false, error: 'nha_khong_hop_le' });
  const points = num(body.points, 0, 5000, 1);   // cho phép 1.5 điểm
  if (points == null) return send(res, 400, { ok: false, error: 'diem_khong_hop_le' });

  const room = (await store.get(key(code))) ||
               { code, created: Date.now(), updated: Date.now(), rounds: 0, players: {} };
  const p = room.players[name] || { name, house, rounds: 0, points: 0, best: 0 };
  p.house = house;
  p.rounds++;
  p.points = Math.round(((p.points || 0) + points) * 10) / 10;   // tổng điểm cả phiên
  p.best = Math.max(p.best || 0, points);  // câu được nhiều reaction nhất
  p.seen = Date.now();
  room.players[name] = p;
  room.rounds = Math.max(room.rounds || 0, p.rounds);
  room.updated = Date.now();
  await store.set(key(code), room);

  send(res, 200, { ok: true, code, rounds: room.rounds, board: board(room), storage: store.kind() });
});
