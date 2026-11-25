'use strict';
/* GET /api/lyrics            -> cả kho câu hát
   GET /api/lyrics?random=1   -> 1 câu ngẫu nhiên (hoặc ?random=3 lấy 3 câu) */
const { handler, send, query, int } = require('./_lib');
const lyrics = require('./_lyrics');

module.exports = handler('GET', async (req, res) => {
  const q = query(req);
  if (q.random != null && q.random !== '') {
    const n = int(q.random, 1, 20) || 1;
    return send(res, 200, { ok: true, items: lyrics.random(n) });
  }
  res.setHeader('Cache-Control', 'public, max-age=60');
  send(res, 200, { ok: true, items: lyrics.all() });
});
