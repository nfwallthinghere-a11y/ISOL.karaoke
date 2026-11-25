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

const chuan = v => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
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

/* dòng mở đầu phần tiếng Anh / phần không phải lời hát */
const CAT_TU = /(^_{4,}$|^-{6,}$|^={4,}$|unofficial|fan-?made|english|engsub|translat|adaptation|lyrics? by|credit)/i;

/* dòng ghi công trong khối đầu ô */
const GHI_CONG = /^(tác giả|sáng tác|nhạc sĩ|lời rap|rap:|music|composer|producer|mix|master|arrange|a product of|executive|dsp|beat|phối khí|thu âm|biên tập|lời mới|tên bài gốc)/i;

const CO_DAU_VIET = /[ăâđêôơưĂÂĐÊÔƠƯ\u00C0-\u00FF\u0102-\u0169\u01A0-\u01B0\u1EA0-\u1EF9]/;
const TU_ANH = /\b(the|and|you|your|my|me|we|our|with|that|this|will|would|can't|don't|i'm|it's|of|in|to|for|is|are|was|were|be|have|has|love|heart|never|always|every|when|what|why|how)\b/i;

/* Dòng không dấu tiếng Việt mà đầy từ tiếng Anh thì coi là lời dịch, bỏ đi. */
function laTiengAnh(d) {
  if (CO_DAU_VIET.test(d)) return false;
  const tu = (d.match(TU_ANH) || []).length;
  return tu > 0 && d.split(/\s+/).length >= 3;
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

  /* 1. cắt bỏ từ chỗ bắt đầu phần tiếng Anh trở đi */
  let het = tho.length;
  for (let i = 0; i < tho.length; i++) {
    const d = tho[i];
    if (!d) continue;
    if (CAT_TU.test(d) && !laNhan(d)) { het = i; break; }
  }
  const dong = tho.slice(0, het);

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
    if (GHI_CONG.test(d) || laTiengAnh(d)) continue;
    if (d.length < 4 || d.length > 120) continue;
    hien.dong.push(d.replace(/^[-–•*]+\s*/, ''));
  }

  /* 3. bài không có nhãn nào: gom các dòng lời thành khối 5 dòng */
  if (!doan.length) {
    const con = dong.filter(d => d && !laNhan(d) && !GHI_CONG.test(d) && !laTiengAnh(d) &&
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

module.exports = { parseCsv, sheetCsvUrl, docBaiHat, tachDoan, ytId };
