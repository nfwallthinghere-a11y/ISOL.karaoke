'use strict';
/*
 * Kiểm tra đường đi Google Apps Script mà không cần Google: dựng một máy chủ giả
 * nói đúng giao thức của Apps Script (nhận POST JSON, trả JSON), rồi trỏ GAS_URL vào đó.
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const { createServer } = require('./dev-server');

let app, gas, base, got = [];
const SECRET = 'bi-mat-test-123';

before(async () => {
  /* Apps Script giả */
  gas = http.createServer((req, res) => {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      const p = JSON.parse(body || '{}');
      got.push(p);
      res.setHeader('Content-Type', 'application/json');
      if (p.secret && p.secret !== SECRET) return res.end(JSON.stringify({ ok: false, error: 'unauthorized' }));
      if (p.action === 'append') return res.end(JSON.stringify({ ok: true, anh: !!p.image, n: p.rows.length }));
      if (p.action === 'list')   return res.end(JSON.stringify({ ok: true, total: 150000, items: [
        { luc: '2026-11-25 12:00:00', bid: 'babc1234', ten: 'Lan', nha: 'Hỏa Long', so: 150000, anh: false, trangThai: 'Chờ duyệt' }] }));
      if (p.action === 'mark')   return res.end(JSON.stringify({ ok: true, row: 7 }));
      res.end(JSON.stringify({ ok: false, error: 'bad_action' }));
    });
  });
  await new Promise(r => gas.listen(0, '127.0.0.1', r));
  process.env.GAS_URL = 'http://127.0.0.1:' + gas.address().port;
  process.env.GAS_SECRET = SECRET;
  process.env.ADMIN_KEY = 'khoa-quan-tri';

  app = createServer();
  await new Promise(r => app.listen(0, '127.0.0.1', r));
  base = 'http://127.0.0.1:' + app.address().port;
});

after(() => {
  delete process.env.GAS_URL; delete process.env.GAS_SECRET; delete process.env.ADMIN_KEY;
  app && app.close(); gas && gas.close();
});

const post = (p, b, h) => fetch(base + p, {
  method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, h || {}),
  body: JSON.stringify(b),
}).then(async r => ({ s: r.status, j: await r.json() }));
const get = p => fetch(base + p).then(async r => ({ s: r.status, j: await r.json() }));

test('donate được đẩy sang Apps Script đúng định dạng hàng của Sheet', async () => {
  got = [];
  const r = await post('/api/donate', {
    code: 'LDN88', bid: 'bgas1234', ten: 'Lan', nha: 'Hỏa Long · Alice', so: 150000,
  });
  assert.equal(r.s, 200);
  assert.equal(r.j.luu, 'sheet');

  const p = got[0];
  assert.equal(p.action, 'append');
  assert.equal(p.sheet, 'Donate');
  assert.equal(p.secret, SECRET, 'phải gửi kèm secret');
  assert.equal(p.dedupeKey, 'donate:LDN88:bgas1234', 'khoá chống ghi trùng');
  assert.equal(p.header.length, 10);
  assert.equal(p.imageCol, p.header.indexOf('Ảnh chuyển khoản'));

  const row = p.rows[0];
  assert.equal(row.length, 10);
  assert.match(row[0], /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/, 'cột thời gian giờ VN');
  assert.equal(row[1], 'LDN88');
  assert.equal(row[2], 'bgas1234');
  assert.equal(row[3], 'Lan');
  assert.equal(row[4], 'Hỏa Long · Alice');
  assert.equal(row[5], 150000);
  assert.equal(row[7], 'Chờ duyệt');
  assert.ok(row[8] && row[8].length === 12, 'IP phải được băm, không lưu thô');
});

test('ảnh chuyển khoản đi kèm sang Apps Script', async () => {
  got = [];
  const px = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const r = await post('/api/donate', { code: 'LDN88', bid: 'bimgxyz1', nha: 'Mộc Lan', so: 20000, anh: px });
  assert.equal(r.j.anh, true);
  assert.ok(got[0].image && got[0].image.b64, 'ảnh phải được chuyển tiếp');
  assert.equal(got[0].image.mime, 'image/png');
});

test('GET đọc danh sách từ Sheet thay vì bộ nhớ tạm', async () => {
  got = [];
  const { j } = await get('/api/donate?code=LDN88');
  assert.equal(j.luu, 'sheet');
  assert.equal(j.total, 150000);
  assert.equal(j.items[0].ten, 'Lan');
  assert.equal(got[0].action, 'list');
  assert.equal(got[0].code, 'LDN88');
});

test('duyệt donate cần đúng khoá quản trị', async () => {
  const no = await post('/api/donate', { action: 'duyet', bid: 'bgas1234', kq: 'Đã duyệt' });
  assert.equal(no.s, 403);
  assert.equal(no.j.error, 'khong_co_quyen');

  const sai = await post('/api/donate', { action: 'duyet', bid: 'bgas1234' }, { 'x-kk-key': 'sai-khoa-roi' });
  assert.equal(sai.s, 403);

  got = [];
  const ok = await post('/api/donate', { action: 'duyet', bid: 'bgas1234', kq: 'Đã duyệt' },
                        { 'x-kk-key': 'khoa-quan-tri' });
  assert.equal(ok.s, 200);
  assert.equal(ok.j.row, 7);
  assert.equal(got[0].action, 'mark');
  assert.equal(got[0].bid, 'bgas1234');
});

test('bỏ trống GAS_SECRET vẫn gửi được — Apps Script tự quyết có kiểm tra hay không', async () => {
  const cu = process.env.GAS_SECRET;
  delete process.env.GAS_SECRET;
  got = [];
  const r = await post('/api/donate', { code: 'LDN88', bid: 'bnosec01', nha: 'LASIDO', so: 10000 });
  assert.equal(r.j.ok, true, 'không có secret vẫn ghi được');
  assert.equal(got[0].action, 'append');
  assert.equal(got[0].secret, '', 'gửi secret rỗng, phía Apps Script sẽ bỏ qua nếu nó cũng không đặt');
  process.env.GAS_SECRET = cu;
});

test('Apps Script trả lỗi thì API báo lỗi chứ không im lặng', async () => {
  const old = process.env.GAS_SECRET;
  process.env.GAS_SECRET = 'sai-secret';
  const r = await post('/api/donate', { code: 'LDN88', bid: 'bfail123', nha: 'Kim Ngân', so: 10000 });
  assert.equal(r.j.ok, false);
  assert.equal(r.j.error, 'unauthorized');
  process.env.GAS_SECRET = old;
});
