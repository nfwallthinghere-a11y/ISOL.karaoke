'use strict';
/* Bộ đọc CSV nhỏ: hiểu ô có dấu nháy kép, ô xuống dòng nhiều lần, và "" để thoát dấu nháy.
   Cần đúng chuẩn này vì ô LYRICS trong sheet là một ô nhiều dòng. */
function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  const s = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

/* Link Google Sheet (bản /edit, /view hay đã export) -> link tải CSV.
   Chỉ nhận docs.google.com để không biến API thành cái proxy tải hộ mọi thứ. */
function sheetCsvUrl(link) {
  let u;
  try { u = new URL(String(link || '').trim()); } catch (e) { return null; }
  if (u.protocol !== 'https:') return null;
  if (!/(^|\.)google\.com$/.test(u.hostname)) return null;
  const m = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/.exec(u.pathname);
  if (!m) return null;
  const gid = (/[#&?]gid=(\d+)/.exec(u.hash + u.search) || [])[1];
  return 'https://docs.google.com/spreadsheets/d/' + m[1] + '/export?format=csv' + (gid ? '&gid=' + gid : '');
}

const chuan = v => String(v == null ? '' : v).replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s+/g, ' ').trim();
const hoa = v => chuan(v).toUpperCase();

/* Tìm hàng tiêu đề và vị trí từng cột.
   Sheet có thể có nhiều khối tiêu đề; khối dùng được là khối có cả STT, TÊN BÀI và LYRICS,
   nên quét hai lượt: lượt đầu chỉ nhận hàng có STT, lượt sau mới chấp nhận hàng bất kỳ. */
function timCot(rows) {
  return quetCot(rows, true) || quetCot(rows, false);
}
function quetCot(rows, canStt) {
  for (let r = 0; r < Math.min(rows.length, 40); r++) {
    const h = rows[r].map(hoa);
    const iLy = h.indexOf('LYRICS');
    if (iLy < 0) continue;
    if (canStt && h.indexOf('STT') < 0) continue;

    const iStt = h.indexOf('STT');
    const sau = (ten, tu) => { for (let i = Math.max(0, tu); i < h.length; i++) if (h[i] === ten) return i; return -1; };

    let iTen = iStt >= 0 ? sau('TÊN BÀI', iStt) : -1;
    if (iTen < 0) iTen = h.indexOf('TÊN BÀI');
    let iLyr = iTen >= 0 ? sau('LYRICS', iTen) : iLy;
    if (iLyr < 0) iLyr = iLy;
    if (iTen < 0) continue;

    const chua = (...tu) => h.findIndex(x => tu.some(t => x.includes(t)));
    return {
      hang: r, ten: iTen, lyrics: iLyr,
      kara: h.indexOf('KARAOKE'),
      link: chua('LINK', 'YOUTUBE', 'URL'),
      ca: h.indexOf('TRÌNH BÀY'),
    };
  }
  return null;
}

/* ---------- tách ô lyrics thành các ĐOẠN hát được ----------
   Ô lyrics trong sheet gồm: khối ghi công (tác giả, producer…), rồi lời tiếng Việt chia
   thành đoạn bằng nhãn ngoặc vuông ([Verse 1: …], [Chorus: …], [Bridge: …]), và ở một số
   bài còn có bản dịch tiếng Anh nằm phía sau, ngăn bằng hàng gạch dưới và dòng ghi công.
   Chỉ lấy phần lời tiếng Việt. */

const NHAN_DOAN = /^(verse|chorus|pre[- ]?chorus|post[- ]?chorus|hook|bridge|intro|outro|breakdown|refrain|interlude|rap|ending|drop|solo|điệp khúc|đoạn)\b/i;

/* Dòng MỞ ĐẦU phần bản dịch tiếng Anh. Chỉ nhận những dấu hiệu rõ ràng của một đầu
   khối dịch — gạch ngăn, "unofficial", "fan-made", "engsub", "bản Tiếng Anh",
   "English … adaptation/translation", "… by @ai đó", "Title:".
   KHÔNG đoán theo từng dòng nữa: nhiều bài có lời tiếng Anh thật trong bài
   (Move On, Keep Me In Love, câu rap chen tiếng Anh…) và trước đây bị lọc oan. */
const CAT_TU = new RegExp([
  '^[\\s_\\-=~–—]{3,}$',                                    // hàng gạch ngăn
  'unofficial',
  'fan\\s?-?\\s?made',
  'eng\\s?sub',
  'b[aả]n\\s+ti[êế]ng\\s?anh|ti[êế]ng\\s?anh\\s*\\)',        // "(… bản Tiếng Anh)"
  'english[^\\n]{0,40}(translat|adapt|singable|version|lyric|sub)',
  '(translat|adapt)[a-z]*\\s*\\/?\\s*(translat|adapt)?[a-z]*\\s+by\\b',
  '^title\\s*:',
  '^lyrics?\\s+(and|&)\\b',
  '^credits?\\b',
].join('|'), 'i');

/* Dòng ghi công. Từ tiếng Anh phải có dấu hai chấm mới tính, không thì một câu hát
   mở đầu bằng "Music" hay "Beat" cũng bị bỏ oan. */
const GHI_CONG_VI = /^(tác giả|sáng tác|nhạc sĩ|lời rap|lời mới|tên bài gốc|phối khí|thu âm|biên tập|trình bày|thể hiện|ca sĩ)\b/i;
const GHI_CONG_EN = /^(music|composer|composed|produced|producer|prod|mix|mixing|master|mastering|arrange|arranger|arrangement|beat|rap|vocal|vocals|lyric|lyrics|credit|credits|artist|song|a product of|executive|dsp)\s*[:：]/i;
const laGhiCong = d => GHI_CONG_VI.test(d) || GHI_CONG_EN.test(d);

/* Dấu hiệu "cả ô này là bản song ngữ xen từng dòng": dòng ghi công bản dịch nằm NGAY
   ĐẦU ô, trước khi có lời nào. Trong sheet chỉ có vài bài như vậy (mỗi câu tiếng Việt
   kèm ngay một câu tiếng Anh ở dòng dưới) — với mấy bài đó thì phải lọc theo từng dòng.
   Còn mốc nằm GIỮA ô thì nghĩa là bản dịch gom thành khối ở cuối, cắt từ đó là xong. */
const DICH_DAU = /(eng\s?sub|unofficial|fan\s?-?\s?made|english[^\n]{0,40}(translat|adapt|singable|version|lyric|sub))/i;

const CO_DAU_VIET = /[ăâđêôơưĂÂĐÊÔƠƯ\u00C0-\u00FF\u0102-\u0169\u01A0-\u01B0\u1EA0-\u1EF9]/;
const TU_ANH = /\b(the|and|you|your|my|me|we|our|with|that|this|will|would|can't|don't|i'm|it's|of|in|to|for|is|are|was|were|be|have|has|love|heart|never|always|every|when|what|why|how)\b/i;

/* Chỉ dùng cho ô song ngữ xen dòng: dòng không dấu tiếng Việt mà đầy từ tiếng Anh. */
function laTiengAnh(d) {
  if (CO_DAU_VIET.test(d)) return false;
  return TU_ANH.test(d) && d.split(/\s+/).length >= 3;
}

function laNhan(d) {
  const m = /^\[([^\]]+)\]$/.exec(d);
  return m ? m[1].trim() : null;
}

function tenNhan(n) {
  const t = String(n).split(/[:：]/)[0].trim();
  return t.length > 28 ? t.slice(0, 28) : t;
}

/* Cắt lấy tối đa `toi` dòng liên tiếp, lấy ngẫu nhiên vị trí bắt đầu cho đỡ nhàm. */
function catBot(dong, toi) {
  if (dong.length <= toi) return dong;
  const bd = Math.floor(Math.random() * (dong.length - toi + 1));
  return dong.slice(bd, bd + toi);
}

function tachDoan(o) {
  const tho = String(o || '').split('\n').map(x => chuan(x));

  /* 1. Cắt bỏ từ chỗ bắt đầu khối dịch tiếng Anh trở đi.
        Chỉ cắt khi PHÍA TRƯỚC đã có lời hát: vài bài để dòng "Engsub by @…" ngay trên
        đầu ô, cắt ở đó là mất cả bài. */
  let het = tho.length, coLoi = false, songNgu = false;
  for (let i = 0; i < tho.length; i++) {
    const d = tho[i];
    if (!d) continue;
    const nhan = laNhan(d);
    if (nhan && NHAN_DOAN.test(nhan)) { coLoi = true; continue; }   // [Verse 1] … là lời
    if (CAT_TU.test(nhan || d)) {
      if (coLoi) { het = i; break; }                               // khối dịch ở cuối -> cắt
      if (DICH_DAU.test(nhan || d)) songNgu = true;                // ghi công ở đầu -> xen dòng
      continue;
    }
    if (!nhan && !laGhiCong(d) && d.length >= 4) coLoi = true;
  }
  const dong = tho.slice(0, het);
  const boDong = d => laGhiCong(d) || CAT_TU.test(d) || (songNgu && laTiengAnh(d));

  /* 2. chia theo nhãn đoạn */
  const doan = [];
  let hien = null;
  for (const d of dong) {
    if (!d) continue;
    const nhan = laNhan(d);
    if (nhan) {
      if (NHAN_DOAN.test(nhan)) { hien = { nhan: tenNhan(nhan), dong: [] }; doan.push(hien); }
      continue;                                  // nhãn người hát như [WILL] thì bỏ dòng, giữ đoạn
    }
    if (!hien) continue;                         // còn ở khối ghi công đầu ô
    if (boDong(d)) continue;
    if (d.length < 4 || d.length > 120) continue;
    hien.dong.push(d.replace(/^[-–•*_]+\s*/, '').replace(/\s*[_–-]+$/, ''));
  }

  /* 3. bài không có nhãn nào: gom các dòng lời thành khối 5 dòng */
  if (!doan.length) {
    const con = dong.filter(d => d && !laNhan(d) && !boDong(d) &&
                                 d.length >= 4 && d.length <= 120);
    for (let i = 0; i < con.length; i += 5) {
      const kh = con.slice(i, i + 5);
      if (kh.length >= 2) doan.push({ nhan: 'Đoạn ' + (doan.length + 1), dong: kh });
    }
  }

  /* 4. đoạn phải có từ 2 dòng, dài quá thì cắt còn 6 dòng liên tiếp */
  return doan.filter(d => d.dong.length >= 2).map(d => ({ nhan: d.nhan, dong: catBot(d.dong, 6) }));
}

const YT_ID = /(?:youtu\.be\/|v=|embed\/|shorts\/)([a-zA-Z0-9_-]{11})/;
const ytId = v => { const m = YT_ID.exec(String(v || '')); return m ? m[1] : ''; };

/* CSV -> danh sách bài hát */
function docBaiHat(csv) {
  const rows = parseCsv(csv);
  const c = timCot(rows);
  if (!c) return { ok: false, error: 'khong_thay_cot_lyrics' };
  const out = [];
  for (let r = c.hang + 1; r < rows.length; r++) {
    const row = rows[r];
    const ten = chuan(row[c.ten]);
    const lyr = row[c.lyrics];
    if (!ten || !lyr) continue;
    const doan = tachDoan(lyr);
    if (!doan.length) continue;
    out.push({
      ten,
      doan,
      kara: c.kara >= 0 ? chuan(row[c.kara]) : '',
      yt: c.link >= 0 ? ytId(row[c.link]) : (ytId(row[c.kara]) || ''),
      ca: c.ca >= 0 ? chuan(row[c.ca]).slice(0, 80) : '',
    });
  }
  return { ok: true, songs: out };
}

/* Tìm bài theo tên: khớp đúng trước, không có thì khớp một phần, không phân biệt hoa thường. */
function timBai(songs, q) {
  const t = chuan(q).toLowerCase();
  if (!t) return null;
  return (songs || []).find(x => chuan(x.ten).toLowerCase() === t) ||
         (songs || []).find(x => chuan(x.ten).toLowerCase().includes(t)) || null;
}

module.exports = { parseCsv, sheetCsvUrl, docBaiHat, tachDoan, ytId, timBai };
