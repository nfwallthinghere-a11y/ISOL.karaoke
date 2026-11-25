'use strict';
/*
 * Máy chủ chạy thử ở máy: phục vụ index.html + định tuyến /api/<tên> tới api/<tên>.js
 * giống hệt cách Vercel làm, để test và dev mà không cần deploy.
 *   npm run dev   -> http://localhost:3000
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const API = path.join(ROOT, 'api');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
};

function createServer() {
  return http.createServer(async (req, res) => {
    let pathname = '/';
    try { pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch (e) {}

    if (pathname.startsWith('/api/')) {
      const name = pathname.slice(5).replace(/\.js$/, '');
      const file = path.join(API, name + '.js');
      if (!/^[a-z0-9-]+$/i.test(name) || name.startsWith('_') || !fs.existsSync(file)) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify({ ok: false, error: 'khong_co_route' }));
      }
      try {
        const mod = require(file);
        return await (mod.default || mod)(req, res);
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify({ ok: false, error: String((e && e.message) || e) }));
      }
    }

    /* tĩnh — mọi đường dẫn lạ đều rơi về index.html, giống rewrite trên Vercel */
    const rel = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    let file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      file = path.join(ROOT, 'index.html');
    }
    res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store');
    fs.createReadStream(file).pipe(res);
  });
}

module.exports = { createServer };

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  createServer().listen(port, () => {
    console.log('Karaoke Call đang chạy: http://localhost:' + port);
    console.log('API thử nhanh:        http://localhost:' + port + '/api/health');
  });
}
