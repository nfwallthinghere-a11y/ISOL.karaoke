'use strict';
/* POST /api/score {code,name,house,pct}  -> gửi điểm "nhịp chuẩn" của một câu
   GET  /api/score?code=ABC12             -> bảng xếp hạng trung bình của phòng */
const { handler, send, query, readJson, roomCode, text, int, rateLimit, clientIp } = require('./_lib');
const store = require('./_store');

const key = c => 'kk:room:' + c;

function board(room) {
  return Object.values(room.players || {})
    .filter(p => p.rounds > 0)
    .map(p => ({
      name: p.name, house: p.house, rounds: p.rounds,
      avg: Math.round(p.sum / p.rounds), best: p.best || 0,
    }))
    .sort((a, b) => b.avg - a.avg || b.rounds - a.rounds);
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

  if (!rateLimit('score:' + clientIp(req), 120, 60000))
    return send(res, 429, { ok: false, error: 'qua_nhieu_yeu_cau' });

  const body = await readJson(req, 4096);
  const code = roomCode(body.code);
  if (!code) return send(res, 400, { ok: false, error: 'ma_phong_khong_hop_le' });
  const name = text(body.name, 24);
  if (!name) return send(res, 400, { ok: false, error: 'thieu_ten' });
  const house = int(body.house, 0, 31);
  if (house == null) return send(res, 400, { ok: false, error: 'nha_khong_hop_le' });
  const pct = int(body.pct, 0, 100);
  if (pct == null) return send(res, 400, { ok: false, error: 'diem_khong_hop_le' });

  const room = (await store.get(key(code))) ||
               { code, created: Date.now(), updated: Date.now(), rounds: 0, players: {} };
  const p = room.players[name] || { name, house, rounds: 0, sum: 0, best: 0 };
  p.house = house; p.rounds++; p.sum += pct; p.best = Math.max(p.best || 0, pct); p.seen = Date.now();
  room.players[name] = p;
  room.rounds = Math.max(room.rounds, Math.max(...Object.values(room.players).map(x => x.rounds)));
  room.updated = Date.now();
  await store.set(key(code), room);

  send(res, 200, { ok: true, code, rounds: room.rounds, board: board(room), storage: store.kind() });
});
