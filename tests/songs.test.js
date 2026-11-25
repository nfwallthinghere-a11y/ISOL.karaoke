'use strict';
/* Thử đường đi đọc Google Sheet bằng một máy chủ CSV giả, không cần Google. */
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const { createServer } = require('./dev-server');
const { parseCsv, sheetCsvUrl, docBaiHat, tachDoan } = require('../api/_csv');

/* ---------- phần thuần hàm ---------- */
test('CSV: ô nhiều dòng và dấu nháy kép lồng nhau', () => {
  const r = parseCsv('a,"dòng 1\ndòng 2","nói ""thế"" đấy"\nx,y,z');
  assert.deepEqual(r[0], ['a', 'dòng 1\ndòng 2', 'nói "thế" đấy']);
  assert.deepEqual(r[1], ['x', 'y', 'z']);
});

test('chỉ nhận link Google Sheet, đổi sang link tải CSV', () => {
  assert.match(sheetCsvUrl('https://docs.google.com/spreadsheets/d/ABC123_-x/edit?usp=sharing'),
               /\/spreadsheets\/d\/ABC123_-x\/export\?format=csv$/);
  assert.match(sheetCsvUrl('https://docs.google.com/spreadsheets/d/ABC/edit#gid=77'), /gid=77$/);
  assert.equal(sheetCsvUrl('https://evil.example.com/spreadsheets/d/ABC/edit'), null);
  assert.equal(sheetCsvUrl('http://docs.google.com/spreadsheets/d/ABC/edit'), null, 'chặn http');
  assert.equal(sheetCsvUrl('linh tinh'), null);
});

test('tách đoạn: bỏ nhãn người hát, bỏ khối ghi công, cắt phần dịch tiếng Anh', () => {
  const o = [
    'Tác giả: AI ĐÓ',
    'Producer: AI ĐÓ KHÁC',
    '[Verse 1: Thái VG, OSAD]',
    'Dòng lời tiếng Việt một',
    'Dòng lời tiếng Việt hai',
    '[WILL]',
    'Dòng lời tiếng Việt ba',
    '[Chorus: All]',
    'Điệp khúc dòng một',
    'Điệp khúc dòng hai',
    '________________',
    'Unofficial Fan-made English Singable Adaptation by ai đó',
    'On my shoulder I carry the flag',
    'We will never fall down again',
  ].join('\n');
  const d = tachDoan(o);
  assert.equal(d.length, 2, 'được 2 đoạn');
  assert.equal(d[0].nhan, 'Verse 1', 'nhãn cắt bỏ phần tên người hát sau dấu hai chấm');
  assert.equal(d[0].dong.length, 3, 'nhãn [WILL] bị bỏ nhưng dòng sau nó vẫn thuộc Verse 1');
  assert.equal(d[1].nhan, 'Chorus');
  assert.ok(!JSON.stringify(d).includes('shoulder'), 'không được lấy phần dịch tiếng Anh');
  assert.ok(!JSON.stringify(d).includes('Producer'), 'không được lấy khối ghi công');
});

test('bài không có nhãn đoạn thì tự gom thành khối 5 dòng', () => {
  const dong = [];
  for (let i = 1; i <= 7; i++) dong.push('Dòng lời bài hát số ' + i);
  const d = tachDoan(dong.join('\n'));
  assert.equal(d.length, 2);
  assert.equal(d[0].dong.length, 5);
  assert.equal(d[1].dong.length, 2);
});

test('đoạn dài hơn 6 dòng thì cắt còn 6 dòng liên tiếp', () => {
  const dong = ['[Chorus]'];
  for (let i = 1; i <= 16; i++) dong.push('Dòng điệp khúc số ' + i);
  const d = tachDoan(dong.join('\n'));
  assert.equal(d.length, 1);
  assert.equal(d[0].dong.length, 6);
  const vt = dong.indexOf(d[0].dong[0]);
  assert.deepEqual(d[0].dong, dong.slice(vt, vt + 6), 'phải là 6 dòng liên tiếp');
});

test('đọc đúng khối cột có STT khi sheet có hai khối tiêu đề', () => {
  const csv = [
    'HỘI NGHỆ,,,,,,',
    'TÊN BÀI,,LYRICS,,BÀI HÁT,LINE HÁT CỦA,LỜI GỐC',
    'ghi chú,,ghi chú,,,,',
    'STT,TÊN BÀI,TRÌNH BÀY,EKIP,LYRICS,Karaoke,Engsub',
    '1,Bài Một,Ca sĩ A,ekip,"Câu hát số một đủ dài\nCâu hát số hai đủ dài",[ KARAOKE ] BÀI MỘT,TRUE',
    '2,Bài Hai,Ca sĩ B,ekip,"Một câu hát khác đủ dài\nCâu thứ hai của bài hai",https://www.youtube.com/watch?v=dQw4w9WgXcQ,FALSE',
    ',,,,,,',
  ].join('\n');
  const kq = docBaiHat(csv);
  assert.equal(kq.ok, true);
  assert.equal(kq.songs.length, 2, 'bỏ hàng trống');
  assert.equal(kq.songs[0].ten, 'Bài Một');
  assert.equal(kq.songs[0].doan.length, 1);
  assert.equal(kq.songs[0].doan[0].dong.length, 2);
  assert.equal(kq.songs[0].ca, 'Ca sĩ A');
  assert.equal(kq.songs[1].yt, 'dQw4w9WgXcQ', 'lấy được id video từ cột Karaoke');
});

test('đúng cấu trúc sheet thật: hai khối tiêu đề nằm CHUNG một hàng', () => {
  /* hàng tiêu đề thật gộp cả khối trái lẫn khối STT, và cột LYRICS xuất hiện hai lần */
  const head = ['TÊN BÀI','','LYRICS','','BÀI HÁT','LINE HÁT CỦA','LỜI GỐC','LỜI "KHÔNG CHÍNH THỨC"','',
                'STT','TÊN BÀI','TRÌNH BÀY','EKIP','LYRICS','Karaoke','Engsub','Link karaoke'].join(',');
  const row = (stt,ten,ca,lyr,kara,link) =>
    [',,,,,,,,', stt, ten, ca, 'ekip', '"'+lyr+'"', kara, 'TRUE', link].join(',');
  const csv = [
    'Mn giúp Xí nghiệp điền lyrics là được nha ạ,,,,,,,,,,,,,,,,',
    head,
    row('1','Hỏa Tâm','[34 Anh Tài]','Câu hát thứ nhất đủ dài\nCâu hát thứ hai đủ dài','[ KARAOKE ] HỎA TÂM','https://youtu.be/4MUuj5Q2Wy4?si=rgTYqlupT7zVFV5M'),
    row('2','Bài Hai','Ca sĩ B','Một câu hát khác đủ dài\nCâu thứ hai của bài hai','[KARAOKE] Bài Hai','https://www.youtube.com/watch?v=LGykGDhVczQ&list=PLV-EtP4gjToI&index=7'),
    row('17','Cho Anh Xin Số Nhà','Ca sĩ C','Câu hát của bài chưa có link\nCâu thứ hai bài chưa có link','[KARAOKE] Số Nhà',''),
    ',,,,,,,,,,,,,,,,',
  ].join('\n');

  const kq = docBaiHat(csv);
  assert.equal(kq.ok, true);
  assert.equal(kq.songs.length, 3, 'lấy đúng 3 bài, bỏ hàng trống và hàng tiêu đề phụ');
  assert.equal(kq.songs[0].ten, 'Hỏa Tâm', 'lấy TÊN BÀI của khối STT chứ không phải khối trái');
  assert.equal(kq.songs[0].ca, '[34 Anh Tài]');
  assert.equal(kq.songs[0].doan.length, 1);
  assert.equal(kq.songs[0].doan[0].dong.length, 2);
  assert.equal(kq.songs[0].yt, '4MUuj5Q2Wy4', 'đọc được dạng youtu.be kèm ?si=');
  assert.equal(kq.songs[1].yt, 'LGykGDhVczQ', 'đọc được dạng watch?v= kèm &list=&index=');
  assert.equal(kq.songs[2].yt, '', 'bài chưa có link thì để trống, không đoán bừa');
  assert.ok(kq.songs[2].kara, 'vẫn giữ tên video để còn tìm trên YouTube');
});

test('sheet không có cột LYRICS thì báo lỗi rõ ràng', () => {
  assert.equal(docBaiHat('a,b\n1,2').error, 'khong_thay_cot_lyrics');
});

/* ---------- qua API ---------- */
let app, sheet, base;
before(async () => {
  sheet = http.createServer((req, res) => {
    if (/khong-chia-se/.test(req.url)) { res.setHeader('Content-Type','text/html'); return res.end('<html>Sign in</html>'); }
    res.setHeader('Content-Type', 'text/csv');
    res.end([
      'STT,TÊN BÀI,TRÌNH BÀY,EKIP,LYRICS,Karaoke,Engsub',
      '1,Bài Một,Ca sĩ A,ekip,"Câu hát số một đủ dài\nCâu hát số hai đủ dài",https://youtu.be/dQw4w9WgXcQ,TRUE',
    ].join('\n'));
  });
  await new Promise(r => sheet.listen(0, '127.0.0.1', r));
  process.env.SHEET_CSV_URL = 'http://127.0.0.1:' + sheet.address().port + '/x';
  app = createServer();
  await new Promise(r => app.listen(0, '127.0.0.1', r));
  base = 'http://127.0.0.1:' + app.address().port;
});
after(() => { delete process.env.SHEET_CSV_URL; app && app.close(); sheet && sheet.close(); });

const get = p => fetch(base + p).then(async r => ({ s: r.status, j: await r.json() }));

test('GET /api/songs chặn link sheet không phải Google', async () => {
  const { s, j } = await get('/api/songs?sheet=' + encodeURIComponent('https://evil.example.com/a'));
  assert.equal(s, 400);
  assert.equal(j.error, 'link_sheet_khong_hop_le');
});

test('luôn có sheet mặc định trong code, không cấu hình gì vẫn chạy', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '../api/songs.js'), 'utf8');
  const m = /const SHEET_MAC_DINH = '([^']+)'/.exec(src);
  assert.ok(m, 'songs.js phải có link sheet mặc định');
  assert.ok(sheetCsvUrl(m[1]), 'link mặc định phải là link Google Sheet hợp lệ');
  assert.match(sheetCsvUrl(m[1]), /export\?format=csv/);
  assert.ok(src.includes("q.sheet || L.cfg('SHEET_CSV_URL') || SHEET_MAC_DINH"),
            'thứ tự ưu tiên: ?sheet= > biến môi trường/_config > mặc định');
});
