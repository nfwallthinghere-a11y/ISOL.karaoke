'use strict';
/* Đồng bộ phòng qua server: thay cho toàn bộ phần P2P cũ (trừ tiếng hát). */
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { createServer } = require('./dev-server');
const store = require('../api/_store');

let server, base;
before(async () => {
  store._reset();
  server = createServer();
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  base = 'http://127.0.0.1:' + server.address().port;
});
after(() => server && server.close());

const get  = (p)    => fetch(base + p).then(async r => ({ s: r.status, j: await r.json() }));
const post = (p, b) => fetch(base + p, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b),
}).then(async r => ({ s: r.status, j: await r.json() }));

const ai = (id, extra) => Object.assign({ id, name: 'Nhà ' + id, house: 1, v: false }, extra || {});
const guiDi = (code, who, act, vcode) =>
  post('/api/sync', { code, vcode, me: who, act: act || { t: 'join' } });
const timNguoi = (j, id) => (j.nguoi || []).find(x => x.id === id);

test('thiếu mã phòng thì từ chối', async () => {
  assert.equal((await get('/api/sync')).s, 400);
  assert.equal((await post('/api/sync', { code: 'ROOM1', me: {} })).s, 400);
});

test('nhà vào trước thành chủ phòng, khán giả thì không', async () => {
  const code = 'SYNC1';
  const kg = await guiDi(code, ai('v1', { v: true }));
  assert.equal(kg.j.host, '');                        // khán giả không được làm chủ phòng
  const a = await guiDi(code, ai('a'));
  assert.equal(a.j.host, 'a');
  const b = await guiDi(code, ai('b'));
  assert.equal(b.j.host, 'a');                        // người vào sau không giành mất
  assert.equal(b.j.nguoi.length, 3);
});

test('mã người xem tra ra mã phòng, mã lạ thì không', async () => {
  await guiDi('SYNC2', ai('a'), null, 'XEMAA');
  const { s, j } = await get('/api/sync?v=XEMAA');
  assert.equal(s, 200); assert.equal(j.code, 'SYNC2');
  assert.equal((await get('/api/sync?v=KHONGCO')).s, 404);
});

test('chỉ chủ phòng mở được câu hát, mốc bắt đầu nằm ở tương lai', async () => {
  const code = 'SYNC3';
  await guiDi(code, ai('a'));
  await guiDi(code, ai('b'));
  const xau = await guiDi(code, ai('b'), { t: 'round', line: 'của nhà b', song: 'X', cho: 700 });
  assert.equal(xau.j.round, null);                    // không phải chủ phòng -> bỏ qua
  const r = await guiDi(code, ai('a'), { t: 'round', line: 'câu một\ncâu hai', song: 'Bài A', nhan: 'Chorus', cho: 700 });
  assert.equal(r.j.round.idx, 1);
  assert.equal(r.j.round.open, true);
  assert.equal(r.j.round.line, 'câu một\ncâu hai', 'lời nhiều dòng phải giữ nguyên xuống dòng');
  assert.ok(r.j.round.startAt > r.j.now);              // còn kịp đếm 3·2·1
});

test('reaction cộng cho đúng nhà, khán giả không nhận điểm', async () => {
  const code = 'SYNC4';
  await guiDi(code, ai('a'));
  await guiDi(code, ai('b'));
  await guiDi(code, ai('v1', { v: true }));
  await guiDi(code, ai('a'), { t: 'round', line: 'L', song: 'S', cho: 10 });
  const r = await guiDi(code, ai('v1', { v: true }), { t: 'rx', ds: { b: 1.5, v1: 9 } });
  assert.equal(timNguoi(r.j, 'b').rx, 1.5);
  assert.equal(timNguoi(r.j, 'v1').rx, 0);
  const r2 = await guiDi(code, ai('v1', { v: true }), { t: 'rx', ds: { b: 2 } });
  assert.equal(timNguoi(r2.j, 'b').rx, 3.5);           // gom cục nhiều lần vẫn cộng dồn
});

test('chốt câu gộp điểm reaction vào tổng, mở câu mới cũng gộp', async () => {
  const code = 'SYNC5';
  await guiDi(code, ai('a'));
  await guiDi(code, ai('a'), { t: 'round', line: 'L1', song: 'S', cho: 10 });
  await guiDi(code, ai('v', { v: true }), { t: 'rx', ds: { a: 2 } });
  const dong = await guiDi(code, ai('a'), { t: 'close' });
  assert.equal(dong.j.round.open, false);
  assert.equal(timNguoi(dong.j, 'a').pts, 2);
  assert.equal(timNguoi(dong.j, 'a').rx, 0);
  await guiDi(code, ai('v', { v: true }), { t: 'rx', ds: { a: 1 } });
  const moi = await guiDi(code, ai('a'), { t: 'round', line: 'L2', song: 'S', cho: 10 });
  assert.equal(moi.j.round.idx, 2);
  assert.equal(timNguoi(moi.j, 'a').pts, 3);           // 2 + 1, không cộng hai lần
  assert.equal(timNguoi(moi.j, 'a').rx, 0);
});

test('chat qua server: ai cũng thấy, có số thứ tự để lọc trùng', async () => {
  const code = 'SYNC6';
  await guiDi(code, ai('a'));
  await guiDi(code, ai('a'), { t: 'chat', m: 'nhà a chào cả phòng' });
  const r = await guiDi(code, ai('v', { v: true }), { t: 'chat', m: 'khán giả vào xem' });
  assert.equal(r.j.chat.length, 2);
  assert.equal(r.j.chat[0].m, 'nhà a chào cả phòng');
  assert.equal(r.j.chat[1].v, true);
  assert.ok(r.j.chat[1].i > r.j.chat[0].i);
  const sys = await guiDi(code, ai('a'), { t: 'sys', m: '🎁 ai đó vừa ủng hộ' });
  assert.equal(sys.j.chat[2].sys, true);
});

test('hỏi thăm mà phòng chưa đổi thì không gửi lại dữ liệu', async () => {
  const code = 'SYNC7';
  const vao = await guiDi(code, ai('a'));
  const lan1 = await get('/api/sync?code=' + code + '&since=' + vao.j.seq);
  assert.equal(lan1.j.nguoi, undefined);               // nhẹ: chỉ có seq + giờ server
  assert.equal(lan1.j.seq, vao.j.seq);
  const lan2 = await get('/api/sync?code=' + code + '&since=0');
  assert.equal(lan2.j.nguoi.length, 1);
});

test('rời phòng và reset điểm', async () => {
  const code = 'SYNC8';
  await guiDi(code, ai('a'));
  await guiDi(code, ai('b'));
  await guiDi(code, ai('a'), { t: 'round', line: 'L', song: 'S', cho: 10 });
  await guiDi(code, ai('v', { v: true }), { t: 'rx', ds: { a: 2, b: 1 } });
  const rs = await guiDi(code, ai('a'), { t: 'reset' });
  assert.equal(timNguoi(rs.j, 'a').rx, 0);
  assert.equal(timNguoi(rs.j, 'b').rx, 0);
  const ra = await guiDi(code, ai('b'), { t: 'leave' });
  assert.equal(timNguoi(ra.j, 'b'), undefined);
  assert.equal(ra.j.host, 'a');
});

test('mã PeerJS của từng người được chia cho cả phòng (để gọi tiếng)', async () => {
  const code = 'SYNC9';
  await guiDi(code, ai('a', { pid: 'peer-a-123' }));
  const r = await guiDi(code, ai('b', { pid: 'peer-b-456' }));
  assert.equal(timNguoi(r.j, 'a').pid, 'peer-a-123');
  assert.equal(timNguoi(r.j, 'b').pid, 'peer-b-456');
});

test('lời cả bài: giữ xuống dòng và nhãn đoạn, dọn ký tự lạ', () => {
  const { textNl, text } = require('../api/_lib');
  const loi = '§Verse 1\r\nDòng một\tcó tab\n\n\n\nDòng hai   \n§Chorus\nĐiệp khúc';
  assert.equal(textNl(loi, 9000),
    '§Verse 1\nDòng một có tab\n\nDòng hai\n§Chorus\nĐiệp khúc');
  assert.equal(text('a\nb'), 'a b', 'text() vẫn dồn một dòng, dùng cho tên bài và chat');
  assert.equal(textNl('x\ny', 3), 'x\ny', 'vẫn cắt theo độ dài');
});

test('chủ phòng tắt mic một nhà, và tắt mic tất cả', async () => {
  const code = 'SYN10';
  await guiDi(code, ai('a'));                         // a là chủ phòng
  await guiDi(code, ai('b'));
  await guiDi(code, ai('c'));
  await guiDi(code, ai('v', { v: true }));

  const xau = await guiDi(code, ai('b'), { t: 'mute', id: 'c', on: true });
  assert.equal(timNguoi(xau.j, 'c').bit, false, 'nhà thường không tắt mic người khác được');

  const m = await guiDi(code, ai('a'), { t: 'mute', id: 'b', on: true });
  assert.equal(timNguoi(m.j, 'b').bit, true);
  assert.equal(timNguoi(m.j, 'c').bit, false, 'chỉ đúng nhà bị chỉ định');

  const mo = await guiDi(code, ai('a'), { t: 'mute', id: 'b', on: false });
  assert.equal(timNguoi(mo.j, 'b').bit, false);

  const tat = await guiDi(code, ai('a'), { t: 'muteall', on: true });
  assert.equal(timNguoi(tat.j, 'b').bit, true);
  assert.equal(timNguoi(tat.j, 'c').bit, true);
  assert.equal(timNguoi(tat.j, 'a').bit, false, 'chủ phòng không tự tắt mic mình');
  assert.equal(timNguoi(tat.j, 'v').bit, false, 'khán giả vốn không có mic');

  const moHet = await guiDi(code, ai('a'), { t: 'muteall', on: false });
  assert.equal(timNguoi(moHet.j, 'b').bit, false);
  assert.equal(timNguoi(moHet.j, 'c').bit, false);
});
