'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { createServer } = require('./dev-server');

let server, base;
const ROOM = 'TEST1';

before(async () => {
  server = createServer();
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  base = 'http://127.0.0.1:' + server.address().port;
});
after(() => server && server.close());

const get  = (p)    => fetch(base + p).then(async r => ({ s: r.status, j: await r.json() }));
const post = (p, b) => fetch(base + p, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b),
}).then(async r => ({ s: r.status, j: await r.json() }));

/* ---------- trang ---------- */
test('trang chủ trả về HTML của app', async () => {
  const r = await fetch(base + '/');
  assert.equal(r.status, 200);
  const html = await r.text();
  assert.match(html, /<!DOCTYPE html>/i);
  assert.match(html, /Karaoke Call/);
});

test('đường dẫn lạ vẫn rơi về index.html (không 404 như trên Vercel)', async () => {
  const r = await fetch(base + '/phong/abc');
  assert.equal(r.status, 200);
  assert.match(await r.text(), /Karaoke Call/);
});

/* ---------- health ---------- */
test('GET /api/health báo trạng thái', async () => {
  const { s, j } = await get('/api/health');
  assert.equal(s, 200);
  assert.equal(j.ok, true);
  assert.equal(j.name, 'karaoke-call');
  assert.ok(j.lyrics > 0);
  assert.ok(['kv', 'memory'].includes(j.storage));
});

test('POST /api/health bị từ chối', async () => {
  const { s, j } = await post('/api/health', {});
  assert.equal(s, 405);
  assert.equal(j.error, 'method_not_allowed');
});

/* ---------- ice ---------- */
test('GET /api/ice trả về máy chủ STUN hợp lệ', async () => {
  const { s, j } = await get('/api/ice');
  assert.equal(s, 200);
  assert.ok(Array.isArray(j.iceServers) && j.iceServers.length >= 1);
  const urls = [].concat(j.iceServers[0].urls);
  assert.ok(urls.every(u => /^(stun|turn)s?:/.test(u)), 'mọi url phải là stun:/turn:');
});

/* ---------- lyrics ---------- */
test('GET /api/lyrics trả về kho câu hát đủ trường', async () => {
  const { s, j } = await get('/api/lyrics');
  assert.equal(s, 200);
  assert.ok(j.items.length >= 10);
  for (const it of j.items) {
    assert.ok(it.t && it.s, 'câu hát phải có lời và tên bài');
    assert.ok(it.bpm >= 40 && it.bpm <= 200, 'bpm phải hợp lệ');
  }
});

test('GET /api/lyrics?random=3 trả đúng 3 câu khác nhau', async () => {
  const { j } = await get('/api/lyrics?random=3');
  assert.equal(j.items.length, 3);
  assert.equal(new Set(j.items.map(x => x.t)).size, 3);
});

/* ---------- room ---------- */
test('GET /api/room chặn mã phòng sai', async () => {
  const { s, j } = await get('/api/room?code=x!');
  assert.equal(s, 400);
  assert.equal(j.error, 'ma_phong_khong_hop_le');
});

test('POST /api/room ghi danh rồi GET đọc lại được', async () => {
  const a = await post('/api/room', { code: ROOM, name: 'Alice', house: 3 });
  assert.equal(a.s, 200);
  assert.equal(a.j.room.players.Alice.house, 3);

  await post('/api/room', { code: ROOM, name: 'Bình', house: 0 });
  const b = await get('/api/room?code=' + ROOM);
  assert.equal(b.j.found, true);
  assert.deepEqual(Object.keys(b.j.room.players).sort(), ['Alice', 'Bình']);
});

test('POST /api/room đòi đủ tên và nhà', async () => {
  assert.equal((await post('/api/room', { code: ROOM, house: 1 })).j.error, 'thieu_ten');
  assert.equal((await post('/api/room', { code: ROOM, name: 'A', house: 99 })).j.error, 'nha_khong_hop_le');
});

/* ---------- score ---------- */
test('POST /api/score cộng dồn và xếp hạng theo điểm trung bình', async () => {
  const code = 'SCORE9';
  await post('/api/score', { code, name: 'Alice', house: 3, pct: 80 });
  await post('/api/score', { code, name: 'Alice', house: 3, pct: 100 });
  const r = await post('/api/score', { code, name: 'Bình', house: 1, pct: 70 });

  assert.equal(r.s, 200);
  assert.equal(r.j.board[0].name, 'Alice');
  assert.equal(r.j.board[0].avg, 90, 'trung bình 80 và 100 phải là 90');
  assert.equal(r.j.board[0].best, 100);
  assert.equal(r.j.board[0].rounds, 2);
  assert.equal(r.j.board[1].name, 'Bình');
  assert.equal(r.j.rounds, 2);
});

test('GET /api/score đọc lại bảng xếp hạng đã lưu', async () => {
  const { j } = await get('/api/score?code=SCORE9');
  assert.equal(j.board.length, 2);
  assert.equal(j.board[0].avg, 90);
});

test('POST /api/score chặn điểm ngoài 0-100', async () => {
  assert.equal((await post('/api/score', { code: 'SCORE9', name: 'A', house: 0, pct: 150 })).j.error,
               'diem_khong_hop_le');
});

test('phòng chưa ai hát thì bảng xếp hạng rỗng, không lỗi', async () => {
  const { s, j } = await get('/api/score?code=TRONG1');
  assert.equal(s, 200);
  assert.deepEqual(j.board, []);
});

/* ---------- lung tung ---------- */
test('route không tồn tại trả JSON 404', async () => {
  const { s, j } = await get('/api/khongcogi');
  assert.equal(s, 404);
  assert.equal(j.ok, false);
});

test('CORS preflight được chấp nhận', async () => {
  const r = await fetch(base + '/api/score', { method: 'OPTIONS' });
  assert.equal(r.status, 204);
  assert.equal(r.headers.get('access-control-allow-origin'), '*');
});
