'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { createServer } = require('./dev-server');

let server, base;
const ROOM = 'TEST1';

const CF = require('../api/_config');
let cuGas;
before(async () => {
  /* nhóm test này chạy với kho lưu tạm trong máy, nên tắt đường Apps Script đã điền sẵn */
  cuGas = CF.GAS_URL; CF.GAS_URL = '';
  server = createServer();
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  base = 'http://127.0.0.1:' + server.address().port;
});
after(() => { CF.GAS_URL = cuGas; server && server.close(); });

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
  assert.ok(['own', 'free'].includes(j.turn), 'phải báo đang dùng TURN loại nào');
  assert.ok(j.peerServer);
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
  const urls = j.iceServers.flatMap(x => [].concat(x.urls));
  assert.ok(urls.every(u => /^(stun|turn)s?:/.test(u)), 'mọi url phải là stun:/turn:');
});

test('GET /api/ice luôn kèm TURN — thiếu TURN là mạng chặn P2P sẽ im tiếng', async () => {
  const { j } = await get('/api/ice');
  const turn = j.iceServers.filter(x => [].concat(x.urls).some(u => /^turns?:/.test(u)));
  assert.ok(turn.length >= 1, 'phải có ít nhất một máy chủ TURN');
  assert.ok(turn[0].username && turn[0].credential, 'TURN phải có tài khoản');
  assert.equal(j.turn, true);
});

test('GET /api/ice không khai báo PeerServer riêng khi chưa set env', async () => {
  const { j } = await get('/api/ice');
  assert.equal(j.peer, null, 'chưa set PEER_HOST thì dùng máy chủ công cộng của PeerJS');
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
test('POST /api/score cộng dồn điểm reaction và xếp hạng theo tổng điểm', async () => {
  const code = 'SCORE9';
  await post('/api/score', { code, name: 'Alice', house: 3, pct: undefined, points: 12 });
  await post('/api/score', { code, name: 'Alice', house: 3, points: 20 });
  const r = await post('/api/score', { code, name: 'Bình', house: 1, points: 25 });

  assert.equal(r.s, 200);
  assert.equal(r.j.board[0].name, 'Alice');
  assert.equal(r.j.board[0].points, 32, '12 + 20 phải thành 32');
  assert.equal(r.j.board[0].best, 20, 'câu nhiều reaction nhất là 20');
  assert.equal(r.j.board[0].rounds, 2);
  assert.equal(r.j.board[1].name, 'Bình');
  assert.equal(r.j.rounds, 2);
});

test('GET /api/score đọc lại bảng xếp hạng đã lưu', async () => {
  const { j } = await get('/api/score?code=SCORE9');
  assert.equal(j.board.length, 2);
  assert.equal(j.board[0].points, 32);
});

test('điểm lẻ cộng đúng — 🤡 và 🤯 mỗi cái 1.5 điểm', async () => {
  const code = 'HALF1';
  await post('/api/score', { code, name: 'Hân', house: 5, points: 1.5 });
  const r = await post('/api/score', { code, name: 'Hân', house: 5, points: 4.5 });
  assert.equal(r.j.board[0].points, 6, '1.5 + 4.5 phải đúng bằng 6, không ra 5.999…');
  assert.equal(r.j.board[0].best, 4.5);
});

test('điểm lẻ được làm tròn về 1 chữ số thập phân', async () => {
  const code = 'HALF2';
  const r = await post('/api/score', { code, name: 'Ngân', house: 4, points: 2.349 });
  assert.equal(r.j.board[0].points, 2.3);
});

test('một câu không có reaction nào vẫn ghi nhận, 0 điểm', async () => {
  const code = 'ZERO1';
  const r = await post('/api/score', { code, name: 'Ngọc', house: 2, points: 0 });
  assert.equal(r.s, 200);
  assert.equal(r.j.board[0].points, 0);
  assert.equal(r.j.board[0].rounds, 1);
});

test('POST /api/score chặn điểm âm và điểm vô lý', async () => {
  assert.equal((await post('/api/score', { code: 'SCORE9', name: 'A', house: 0, points: -5 })).j.error,
               'diem_khong_hop_le');
  assert.equal((await post('/api/score', { code: 'SCORE9', name: 'A', house: 0, points: 99999 })).j.error,
               'diem_khong_hop_le');
  assert.equal((await post('/api/score', { code: 'SCORE9', name: 'A', house: 0 })).j.error,
               'diem_khong_hop_le');
});

test('phòng chưa ai hát thì bảng xếp hạng rỗng, không lỗi', async () => {
  const { s, j } = await get('/api/score?code=TRONG1');
  assert.equal(s, 200);
  assert.deepEqual(j.board, []);
});

/* ---------- donate ---------- */
const DON = { code: 'DON77', bid: 'bk3x9f2a', ten: 'Lan', nha: 'Hỏa Long', so: 50000 };

test('POST /api/donate ghi nhận một lượt ủng hộ', async () => {
  const { s, j } = await post('/api/donate', DON);
  assert.equal(s, 200);
  assert.equal(j.ok, true);
  assert.equal(j.dup, false);
  assert.ok(['memory', 'kv', 'sheet'].includes(j.luu));
});

test('GET /api/donate trả danh sách và tổng tiền', async () => {
  await post('/api/donate', Object.assign({}, DON, { bid: 'bq7w1m4z', ten: 'Tuấn', so: 100000 }));
  const { j } = await get('/api/donate?code=DON77');
  assert.equal(j.total, 150000, '50.000 + 100.000');
  assert.equal(j.items.length, 2);
  assert.equal(j.items[0].ten, 'Tuấn', 'mới nhất lên đầu');
  assert.equal(j.items[0].trangThai, 'Chờ duyệt');
});

test('cùng một mã GD gửi hai lần chỉ tính một lần', async () => {
  const r = await post('/api/donate', DON);
  assert.equal(r.j.dup, true);
  const { j } = await get('/api/donate?code=DON77');
  assert.equal(j.items.length, 2, 'không thêm dòng trùng');
});

test('POST /api/donate kiểm tra từng trường', async () => {
  const bad = (patch, err) => post('/api/donate', Object.assign({}, DON, { bid: 'b' + Math.random().toString(36).slice(2, 9) }, patch))
    .then(r => assert.equal(r.j.error, err, JSON.stringify(patch)));
  await bad({ code: 'x!' }, 'ma_phong_khong_hop_le');
  await bad({ bid: 'xyz' }, 'ma_gd_khong_hop_le');
  await bad({ so: 500 }, 'so_tien_khong_hop_le');
  await bad({ so: 'nhiều' }, 'so_tien_khong_hop_le');
  await bad({ nha: '' }, 'thieu_nha');
  await bad({ anh: 'khong-phai-anh' }, 'anh_khong_hop_le');
});

test('tên người gửi để trống thì ghi là Khán giả, và chặn công thức Sheet', async () => {
  const code = 'DON88';
  await post('/api/donate', { code, bid: 'bzz1a2b3', nha: '=SUM(A1)', so: 20000 });
  const { j } = await get('/api/donate?code=' + code);
  assert.equal(j.items[0].ten, 'Khán giả');
  assert.equal(j.items[0].nha[0], "'", 'ô bắt đầu bằng = phải được thêm dấu nháy');
});

test('ảnh base64 hợp lệ được nhận', async () => {
  const px = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const { j } = await post('/api/donate', { code: 'DON99', bid: 'bimg1234', nha: 'Mộc Lan', so: 30000, anh: px });
  assert.equal(j.ok, true);
  assert.equal(j.anh, true);
});

/* ---------- cấu hình ---------- */
test('cfg(): biến môi trường thắng, không có thì lấy trong api/_config.js', () => {
  const { cfg } = require('../api/_lib');
  const cf = require('../api/_config');

  delete process.env.KK_THU;
  cf.KK_THU = 'trong-code';
  assert.equal(cfg('KK_THU'), 'trong-code', 'không có env thì dùng giá trị ghi trong code');

  process.env.KK_THU = 'tu-vercel';
  assert.equal(cfg('KK_THU'), 'tu-vercel', 'có env thì env thắng');

  process.env.KK_THU = '';
  assert.equal(cfg('KK_THU'), 'trong-code', 'env rỗng coi như chưa đặt');

  delete process.env.KK_THU; delete cf.KK_THU;
  assert.equal(cfg('KK_THU'), '', 'không có ở đâu thì trả chuỗi rỗng');
});

test('_config.js để trống hết, không lỡ commit khoá thật', () => {
  const cf = require('../api/_config');
  for (const k of ['GAS_SECRET', 'ADMIN_KEY', 'YT_API_KEY', 'KV_REST_API_TOKEN'])
    assert.equal(cf[k], '', k + ' phải để trống trong repo');
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
