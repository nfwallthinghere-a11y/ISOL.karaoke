'use strict';
/*
 * Kho dữ liệu nhỏ. Có Vercel KV / Upstash Redis thì dùng, không có thì dùng bộ nhớ tạm.
 * Bộ nhớ tạm sống theo tiến trình: chạy local thì bền, trên serverless thì có thể mất
 * khi Vercel khởi động instance mới — phòng và điểm chỉ là tiện ích phụ, cuộc gọi vẫn chạy.
 */
const URL_ENV   = process.env.KV_REST_API_URL   || process.env.UPSTASH_REDIS_REST_URL   || '';
const TOKEN_ENV = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
const REMOTE = !!(URL_ENV && TOKEN_ENV);
const TTL = 60 * 60 * 24; // 1 ngày

const mem = new Map();

function memGet(key) {
  const e = mem.get(key);
  if (!e) return null;
  if (e.exp < Date.now()) { mem.delete(key); return null; }
  return e.v;
}
function memSet(key, val) {
  if (mem.size > 2000) {
    const now = Date.now();
    for (const [k, v] of mem) if (v.exp < now) mem.delete(k);
  }
  mem.set(key, { v: val, exp: Date.now() + TTL * 1000 });
}

async function kv(path, opts) {
  const r = await fetch(URL_ENV.replace(/\/$/, '') + path, Object.assign({
    headers: { Authorization: 'Bearer ' + TOKEN_ENV },
  }, opts || {}));
  if (!r.ok) throw Object.assign(new Error('kv_loi_' + r.status), { status: 502 });
  return r.json();
}

async function get(key) {
  if (!REMOTE) return memGet(key);
  const j = await kv('/get/' + encodeURIComponent(key));
  if (j.result == null) return null;
  try { return JSON.parse(j.result); } catch (e) { return null; }
}

async function set(key, val) {
  if (!REMOTE) { memSet(key, val); return true; }
  await kv('/set/' + encodeURIComponent(key) + '?EX=' + TTL, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN_ENV, 'Content-Type': 'text/plain' },
    body: JSON.stringify(val),
  });
  return true;
}

function kind() { return REMOTE ? 'kv' : 'memory'; }
function _reset() { mem.clear(); }

module.exports = { get, set, kind, _reset, TTL };
