'use strict';
/*
 * Kho câu hát mặc định: toàn bộ là dân ca / đồng dao cổ truyền, không vướng bản quyền.
 * Muốn đổi mà không sửa code: đặt biến môi trường LYRICS_JSON = [{"t":"...","s":"...","bpm":92}]
 * (Chủ phòng cũng có thể dán danh sách riêng ngay trong trang, không cần tới đây.)
 */
const DEFAULT = [
  { t: 'Bắc kim thang cà lang bí rợ',        s: 'Bắc Kim Thang · dân ca Nam Bộ',  bpm: 96 },
  { t: 'Con cò bay lả bay la',               s: 'Cò Lả · dân ca Bắc Bộ',          bpm: 84 },
  { t: 'Trống cơm khéo vỗ nên vông',         s: 'Trống Cơm · dân ca',             bpm: 92 },
  { t: 'Bông xanh bông trắng rồi lại vàng bông', s: 'Lý Cây Bông · dân ca Nam Bộ', bpm: 88 },
  { t: 'Cái bống là cái bống bang',          s: 'Cái Bống · đồng dao',            bpm: 100 },
  { t: 'Kìa con bướm vàng kìa con bướm vàng', s: 'Kìa Con Bướm Vàng · đồng dao',  bpm: 104 },
  { t: 'Tập tầm vông tay không tay có',      s: 'Tập Tầm Vông · đồng dao',        bpm: 108 },
  { t: 'Nu na nu nống cái cống nằm trong',   s: 'Nu Na Nu Nống · đồng dao',       bpm: 100 },
  { t: 'Chi chi chành chành cái đanh thổi lửa', s: 'Chi Chi Chành Chành · đồng dao', bpm: 112 },
  { t: 'Thằng Bờm có cái quạt mo',           s: 'Thằng Bờm · ca dao',             bpm: 96 },
  { t: 'Ai đem con sáo sang sông',           s: 'Lý Con Sáo · dân ca',            bpm: 80 },
  { t: 'Con gà gáy le té le sáng rồi',       s: 'Gà Gáy · dân ca Cống Khao',      bpm: 96 },
  { t: 'Inh lả ơi sao noọng ơi',             s: 'Inh Lả Ơi · dân ca Thái',        bpm: 84 },
  { t: 'Ru con con ngủ cho lành',            s: 'Ru Con · dân ca',                bpm: 72 },
];

function clean(list) {
  return (Array.isArray(list) ? list : [])
    .map(x => ({
      t: String((x && x.t) || '').trim().slice(0, 160),
      s: String((x && x.s) || 'Bài của bạn').trim().slice(0, 80),
      bpm: Math.min(200, Math.max(40, Math.round(Number(x && x.bpm)) || 92)),
    }))
    .filter(x => x.t);
}

function all() {
  const cfg = require('./_lib').cfg;
  if (cfg('LYRICS_JSON')) {
    try {
      const custom = clean(JSON.parse(cfg('LYRICS_JSON')));
      if (custom.length) return custom;
    } catch (e) { /* JSON hỏng thì quay về mặc định */ }
  }
  return DEFAULT.slice();
}

function random(n) {
  const pool = all(), out = [];
  const k = Math.min(Math.max(1, n || 1), pool.length);
  const idx = pool.map((_, i) => i);
  for (let i = 0; i < k; i++) out.push(pool[idx.splice(Math.floor(Math.random() * idx.length), 1)[0]]);
  return out;
}

module.exports = { all, random, clean, DEFAULT };
