'use strict';
/*
 * Helper dùng chung cho các API serverless.
 * File bắt đầu bằng "_" trong /api không trở thành route.
 *
 * Biến môi trường (Vercel > Project > Settings > Environment Variables) — tất cả đều TUỲ CHỌN:
 *   KV_REST_API_URL / KV_REST_API_TOKEN   Vercel KV hoặc Upstash Redis (lưu phòng + bảng xếp hạng)
 *   UPSTASH_REDIS_REST_URL / ..._TOKEN    tên khác của cùng thứ trên
 *   TURN_URL / TURN_USERNAME / TURN_CREDENTIAL   máy chủ TURN riêng (mạng chặn P2P thì cần)
 *   LYRICS_JSON                            ghi đè kho câu hát, dạng JSON [{t,s,bpm}]
 */

const ROOM_RE = /^[A-Z0-9]{3,10}$/;

/* ---------- rate limit theo từng instance (best-effort) ---------- */
const buckets = new Map();
function rateLimit(key, max, windowMs) {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || now - b.start > windowMs) { b = { start: now, n: 0 }; buckets.set(key, b); }
  b.n++;
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (now - v.start > windowMs) buckets.delete(k);
  }
  return b.n <= max;
}

function clientIp(req) {
  const xf = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return xf || String(req.headers['x-real-ip'] || '') ||
         (req.socket && req.socket.remoteAddress) || 'unknown';
}

/* Chuỗi an toàn: bỏ ký tự điều khiển, giới hạn độ dài */
function text(v, max) {
  return String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max || 120);
}

function int(v, min, max) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

/* Số có thể lẻ (điểm reaction 1.5), làm tròn tới `dec` chữ số thập phân */
function num(v, min, max, dec) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  const p = Math.pow(10, dec == null ? 1 : dec);
  return Math.round(n * p) / p;
}

function roomCode(v) {
  const s = text(v, 10).toUpperCase();
  return ROOM_RE.test(s) ? s : null;
}

function cors(res, methods) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', (methods || 'GET, POST') + ', OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
}

function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(obj));
}

/* Đọc body JSON dù runtime đã parse sẵn hay chưa */
async function readJson(req, maxBytes) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
  const chunks = []; let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > (maxBytes || 16384)) throw Object.assign(new Error('too_large'), { status: 413 });
    chunks.push(c);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

function query(req) {
  if (req.query && typeof req.query === 'object') return req.query;
  const u = new URL(req.url, 'http://x');
  return Object.fromEntries(u.searchParams.entries());
}

/* Bọc handler: tự xử lý OPTIONS, method sai và lỗi không lường trước */
function handler(methods, fn) {
  const allow = methods.split(',').map(s => s.trim().toUpperCase());
  return async function (req, res) {
    cors(res, allow.join(', '));
    if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
    if (!allow.includes(req.method)) return send(res, 405, { ok: false, error: 'method_not_allowed' });
    try {
      await fn(req, res);
    } catch (e) {
      const status = e && e.status ? e.status : 500;
      send(res, status, { ok: false, error: (e && e.message) || 'loi_may_chu' });
    }
  };
}

/* ---------- phần dùng cho donate (giống trang Rung Chuông Vàng) ---------- */
const crypto = require('crypto');

/* Cột của tab "Donate" trong Google Sheet. Apps Script tự tạo header lần đầu. */
const SHEETS = {
  Donate: ['Thời gian', 'Phòng', 'Mã GD', 'Người gửi', 'Nhà', 'Số tiền',
           'Ảnh chuyển khoản', 'Trạng thái', 'IP (băm)', 'Trình duyệt'],
};

/* Chữ an toàn cho ô Sheet: bỏ ký tự điều khiển, chặn công thức (ô bắt đầu bằng = + - @) */
function cell(v, max) {
  let x = String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max || 200);
  if (/^[=+\-@\t]/.test(x)) x = "'" + x;
  return x;
}

/* Giờ Việt Nam dạng chữ: 2026-11-25 14:03:22 */
function nowVN() {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().replace('T', ' ').slice(0, 19);
}

function ipHash(ip) {
  return crypto.createHash('sha256')
    .update((process.env.IP_SALT || 'kk') + '|' + ip).digest('hex').slice(0, 12);
}

/* Người duyệt donate: gửi kèm header x-kk-key trùng với ADMIN_KEY trên Vercel */
function isAdmin(req) {
  const key = process.env.ADMIN_KEY;
  const got = String(req.headers['x-kk-key'] || '');
  if (!key || !got || got.length !== key.length) return false;
  return crypto.timingSafeEqual(Buffer.from(got), Buffer.from(key));
}

/* Gửi sang Google Apps Script. Apps Script trả 302 sang googleusercontent.com,
   fetch đi theo bằng GET — đúng như nó mong đợi. */
async function callGas(payload, timeoutMs) {
  const url = process.env.GAS_URL, secret = process.env.GAS_SECRET;
  if (!url || !secret) return { ok: false, error: 'chua_cau_hinh_gas', status: 503 };
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs || 25000);
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(Object.assign({}, payload, { secret })),
      redirect: 'follow',
      signal: ctl.signal,
    });
    const txt = await r.text();
    let j = null; try { j = JSON.parse(txt); } catch (e) { /* trang lỗi HTML */ }
    if (!j) return { ok: false, error: 'gas_bad_response', status: 502 };
    return j.ok ? Object.assign({ status: 200 }, j) : Object.assign({ status: 502 }, j);
  } catch (e) {
    return { ok: false, error: e.name === 'AbortError' ? 'gas_timeout' : 'gas_unreachable', status: 504 };
  } finally { clearTimeout(t); }
}

module.exports = { ROOM_RE, rateLimit, clientIp, text, int, num, roomCode, cors, send, readJson, query, handler,
                   SHEETS, cell, nowVN, ipHash, callGas, isAdmin };
