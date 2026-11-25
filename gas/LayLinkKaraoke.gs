/**
 * Lấy link YouTube ra khỏi cột Karaoke (kể cả ô là smart chip) và ghi ra cột chữ thường.
 *
 * Vì sao cần: bản xuất CSV của Google Sheet — thứ mà trang karaoke đọc — chỉ lấy CHỮ HIỂN THỊ
 * của ô, không lấy URL bên dưới. Và URL của smart chip còn không nằm trong rich text, nên
 * cách đọc thông thường chỉ bắt được ô có hyperlink thường.
 *
 * CÀI (làm đúng thứ tự):
 *  1. Mở sheet > Extensions > Apps Script, dán nguyên file này vào, bấm Save.
 *  2. Trong trình soạn thảo, cột trái có mục "Services" (dịch vụ) — bấm dấu +,
 *     chọn "Google Sheets API", bấm Add.  ← BƯỚC QUAN TRỌNG NHẤT, thiếu là không lấy được chip
 *  3. Chọn hàm layLinkKaraoke, bấm Run. Lần đầu Google hỏi cấp quyền thì cho phép.
 *  4. Xong: sheet có cột "Link karaoke" chứa link dạng chữ. Chạy lại mỗi khi thêm bài mới.
 */

var TEN_SHEET = 'LYRICS';        // tên tab chứa bảng bài hát
var COT_NGUON = 'Karaoke';       // tiêu đề cột đang chứa chip
var COT_DICH  = 'Link karaoke';  // tiêu đề cột sẽ ghi link dạng chữ

function layLinkKaraoke() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(TEN_SHEET) || ss.getActiveSheet();
  var soHang = sh.getLastRow(), soCot = sh.getLastColumn();
  if (soHang < 2) return bao_('Sheet trống.');

  /* tìm hàng tiêu đề và cột nguồn */
  var hangTieuDe = 0, cotNguon = 0;
  var quet = sh.getRange(1, 1, Math.min(soHang, 40), soCot).getDisplayValues();
  for (var r = 0; r < quet.length && !hangTieuDe; r++) {
    for (var c = 0; c < quet[r].length; c++) {
      if (String(quet[r][c]).trim().toLowerCase() === COT_NGUON.toLowerCase()) {
        hangTieuDe = r + 1; cotNguon = c + 1; break;
      }
    }
  }
  if (!hangTieuDe) return bao_('Không thấy cột "' + COT_NGUON + '".');

  /* cột đích: dùng lại nếu đã có, không thì thêm vào cuối bảng */
  var tieuDe = sh.getRange(hangTieuDe, 1, 1, soCot).getDisplayValues()[0];
  var cotDich = 0;
  for (var i = 0; i < tieuDe.length; i++)
    if (String(tieuDe[i]).trim().toLowerCase() === COT_DICH.toLowerCase()) cotDich = i + 1;
  if (!cotDich) {
    cotDich = soCot + 1;
    sh.getRange(hangTieuDe, cotDich).setValue(COT_DICH).setFontWeight('bold');
  }

  var n = soHang - hangTieuDe;
  if (n < 1) return bao_('Không có dòng dữ liệu nào.');

  var o    = sh.getRange(hangTieuDe + 1, cotNguon, n, 1);
  var rich = o.getRichTextValues();
  var chu  = o.getDisplayValues();
  var cong = o.getFormulas();

  /* nguồn chính: Sheets API, chỗ duy nhất lộ ra URL của smart chip */
  var a1 = "'" + sh.getName().replace(/'/g, "''") + "'!" +
           cotA1_(cotNguon) + (hangTieuDe + 1) + ':' + cotA1_(cotNguon) + soHang;
  var kq = tuApi_(ss.getId(), a1, n);

  var ra = [], duoc = 0, thieu = [];
  for (var k = 0; k < n; k++) {
    var url = kq.uris[k] || '';

    /* dự phòng khi API không bật hoặc ô không phải chip */
    if (!url) {
      var rt = rich[k][0];
      if (rt) {
        url = rt.getLinkUrl() || '';
        if (!url) {
          var doan = rt.getRuns();
          for (var j = 0; j < doan.length && !url; j++) url = doan[j].getLinkUrl() || '';
        }
      }
    }
    if (!url && cong[k][0]) {
      var m = /HYPERLINK\(\s*"([^"]+)"/i.exec(cong[k][0]);
      if (m) url = m[1];
    }
    if (!url && /^https?:\/\//i.test(chu[k][0])) url = String(chu[k][0]).trim();

    ra.push([url]);
    if (url) duoc++; else if (String(chu[k][0]).trim()) thieu.push(hangTieuDe + 1 + k);
  }

  sh.getRange(hangTieuDe + 1, cotDich, n, 1).setValues(ra);

  var msg = 'Đã lấy ' + duoc + '/' + (duoc + thieu.length) + ' link.';
  if (!kq.api) msg += ' CHƯA BẬT Google Sheets API nên không đọc được smart chip — ' +
                      'vào Services ở cột trái, thêm "Google Sheets API" rồi chạy lại.';
  else if (thieu.length) msg += ' Chưa lấy được ở dòng: ' + thieu.slice(0, 15).join(', ') +
                      (thieu.length > 15 ? '…' : '') + '.';
  bao_(msg);
}

/* Đọc URL thật của từng ô: hyperlink thường, smart chip, và link gắn trên một đoạn chữ. */
function tuApi_(idFile, a1, n) {
  var out = { api: false, uris: new Array(n) };
  for (var z = 0; z < n; z++) out.uris[z] = '';
  if (typeof Sheets === 'undefined') return out;          // chưa bật dịch vụ nâng cao
  try {
    var r = Sheets.Spreadsheets.get(idFile, {
      ranges: [a1],
      includeGridData: true,
      fields: 'sheets(data(rowData(values(hyperlink,' +
              'chipRuns(chip(richLinkProperties(uri))),' +
              'textFormatRuns(format(link(uri)))))))'
    });
    out.api = true;
    var data = (((r.sheets || [])[0] || {}).data || [])[0] || {};
    var rows = data.rowData || [];
    for (var i = 0; i < rows.length && i < n; i++) {
      var o = ((rows[i].values || [])[0]) || {};
      var u = o.hyperlink || '';
      var k;
      if (!u && o.chipRuns) for (k = 0; k < o.chipRuns.length && !u; k++) {
        var ch = o.chipRuns[k].chip || {};
        u = (ch.richLinkProperties && ch.richLinkProperties.uri) || '';
      }
      if (!u && o.textFormatRuns) for (k = 0; k < o.textFormatRuns.length && !u; k++) {
        var fm = o.textFormatRuns[k].format || {};
        u = (fm.link && fm.link.uri) || '';
      }
      out.uris[i] = u || '';
    }
  } catch (e) {
    Logger.log('Sheets API: ' + e);
  }
  return out;
}

function cotA1_(n) {
  var s = '';
  while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; }
  return s;
}

function bao_(msg) {
  try { SpreadsheetApp.getActive().toast(msg, 'Link karaoke', 20); } catch (e) {}
  Logger.log(msg);
}
