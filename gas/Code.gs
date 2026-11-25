/**
 * Karaoke Call — nơi lưu thông tin donate (Google Apps Script web app).
 *
 * Cài một lần:
 *  1. Tạo một Google Sheet mới. Extensions > Apps Script. Dán nguyên file này đè vào Code.gs.
 *  2. Project Settings > Script properties, thêm:
 *       SECRET     = một chuỗi ngẫu nhiên dài (bắt buộc)
 *       FOLDER_ID  = id thư mục Drive chứa ảnh chuyển khoản (tuỳ chọn; để trống thì lần đầu
 *                    chạy sẽ tự tạo thư mục riêng tư "Karaoke Call - Ảnh chuyển khoản")
 *       ADMIN_KEY  = chuỗi dùng để duyệt donate (tuỳ chọn)
 *  3. Chạy hàm setup() một lần trong trình soạn thảo để cấp quyền và tạo sẵn tab.
 *  4. Deploy > New deployment > Web app. Execute as: Me. Who has access: Anyone. Copy URL /exec.
 *  5. Trên Vercel: GAS_URL = URL vừa copy, GAS_SECRET = đúng chuỗi SECRET. Redeploy.
 *
 * Ảnh chuyển khoản nằm RIÊNG TƯ trong Drive của bạn (không chia sẻ cho ai). Sheet chỉ lưu
 * đường link, mở được bởi tài khoản có quyền vào thư mục đó.
 */

var DONATE_HEADER = ['Thời gian', 'Phòng', 'Mã GD', 'Người gửi', 'Nhà', 'Số tiền',
                     'Ảnh chuyển khoản', 'Trạng thái', 'IP (băm)', 'Trình duyệt'];

function doPost(e) {
  try {
    var p = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var props = PropertiesService.getScriptProperties();
    var secret = props.getProperty('SECRET');
    if (!secret || p.secret !== secret) return out_({ ok: false, error: 'unauthorized' });

    if (p.action === 'ping')   return out_({ ok: true, service: 'karaoke-donate' });
    if (p.action === 'append') return append_(p, props);
    if (p.action === 'list')   return list_(p);
    if (p.action === 'mark')   return mark_(p);
    return out_({ ok: false, error: 'bad_action' });
  } catch (err) {
    return out_({ ok: false, error: String((err && err.message) || err).slice(0, 200) });
  }
}

function doGet() {
  return out_({ ok: true, service: 'karaoke-donate' });
}

/* ---------- ghi một lượt donate ---------- */
function append_(p, props) {
  if (!/^[A-Za-z]{2,20}$/.test(String(p.sheet || ''))) return out_({ ok: false, error: 'bad_sheet' });
  if (!Array.isArray(p.header) || !Array.isArray(p.rows) || !p.rows.length)
    return out_({ ok: false, error: 'bad_rows' });

  var cache = CacheService.getScriptCache();
  if (p.dedupeKey && cache.get(p.dedupeKey)) return out_({ ok: true, dup: true });

  var width = p.header.length;
  var rows = p.rows.map(function (r) {
    var a = (r || []).slice(0, width);
    while (a.length < width) a.push('');
    return a;
  });

  /* ảnh chuyển khoản -> file riêng tư trên Drive, chỉ link đi vào Sheet */
  var anh = false;
  if (p.image && p.image.b64 && typeof p.imageCol === 'number') {
    var blob = Utilities.newBlob(Utilities.base64Decode(p.image.b64), p.image.mime || 'image/jpeg',
                                 String(p.image.name || 'anh.jpg').replace(/[^A-Za-z0-9_.-]/g, '_'));
    rows[0][p.imageCol] = folder_(props).createFile(blob).getUrl();
    anh = true;
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    var sh = sheet_(p.sheet, p.header);
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, width).setValues(rows);
  } finally {
    lock.releaseLock();
  }

  if (p.dedupeKey) cache.put(p.dedupeKey, '1', 21600);   // 6 tiếng
  return out_({ ok: true, anh: anh, n: rows.length });
}

/* ---------- đọc lại danh sách donate của một phòng ---------- */
function list_(p) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(p.sheet || 'Donate');
  if (!sh || sh.getLastRow() < 2) return out_({ ok: true, items: [], total: 0 });

  var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var idx = {};
  head.forEach(function (h, i) { idx[h] = i; });

  var n = Math.min(sh.getLastRow() - 1, 500);
  var vals = sh.getRange(sh.getLastRow() - n + 1, 1, n, sh.getLastColumn()).getValues();
  var code = String(p.code || '').toUpperCase();
  var items = [], total = 0;

  for (var i = vals.length - 1; i >= 0; i--) {
    var r = vals[i];
    if (code && String(r[idx['Phòng']] || '').toUpperCase() !== code) continue;
    var so = Number(r[idx['Số tiền']]) || 0;
    total += so;
    if (items.length < (p.limit || 50)) {
      items.push({
        luc: String(r[idx['Thời gian']] || ''),
        bid: String(r[idx['Mã GD']] || ''),
        ten: String(r[idx['Người gửi']] || ''),
        nha: String(r[idx['Nhà']] || ''),
        so: so,
        anh: !!r[idx['Ảnh chuyển khoản']],
        trangThai: String(r[idx['Trạng thái']] || '')
      });
    }
  }
  return out_({ ok: true, items: items, total: total });
}

/* ---------- duyệt / từ chối một mã GD ---------- */
function mark_(p) {
  var props = PropertiesService.getScriptProperties();
  var key = props.getProperty('ADMIN_KEY');
  if (!key || String(p.adminKey || '') !== key) return out_({ ok: false, error: 'unauthorized' });

  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(p.sheet || 'Donate');
  if (!sh || sh.getLastRow() < 2) return out_({ ok: false, error: 'khong_co_du_lieu' });

  var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var cBid = head.indexOf('Mã GD') + 1, cSt = head.indexOf('Trạng thái') + 1;
  if (cBid < 1 || cSt < 1) return out_({ ok: false, error: 'thieu_cot' });

  var hit = sh.getRange(2, cBid, sh.getLastRow() - 1, 1)
              .createTextFinder(String(p.bid || '')).matchEntireCell(true).findNext();
  if (!hit) return out_({ ok: false, error: 'khong_thay_ma_gd' });

  sh.getRange(hit.getRow(), cSt).setValue(String(p.kq || 'Đã duyệt') + ' · ' + nowVN_());
  return out_({ ok: true, row: hit.getRow() });
}

/* ---------- tiện ích ---------- */
function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function nowVN_() {
  return Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd HH:mm:ss');
}

function sheet_(name, header) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.setColumnWidth(1, 150);
  }
  return sh;
}

function folder_(props) {
  var id = props.getProperty('FOLDER_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { /* tạo lại bên dưới */ } }
  var f = DriveApp.createFolder('Karaoke Call - Ảnh chuyển khoản');
  props.setProperty('FOLDER_ID', f.getId());
  return f;
}

/* Chạy một lần trong trình soạn thảo để cấp quyền và tạo sẵn tab + thư mục ảnh. */
function setup() {
  folder_(PropertiesService.getScriptProperties());
  sheet_('Donate', DONATE_HEADER);
}
