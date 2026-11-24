'use strict';
/* Danh sách máy chủ ICE cho WebRTC. Không có cái này thì vài mạng (4G, wifi công ty,
   trường học) không bắt tay P2P được. STUN công cộng là đủ cho đa số; mạng chặn chặt
   thì cần TURN riêng — khai báo qua biến môi trường TURN_URL/TURN_USERNAME/TURN_CREDENTIAL. */
const { handler, send } = require('./_lib');

const STUN = [
  'stun:stun.l.google.com:19302',
  'stun:stun1.l.google.com:19302',
  'stun:stun2.l.google.com:19302',
];

module.exports = handler('GET', async (req, res) => {
  const list = [{ urls: STUN }];
  if (process.env.TURN_URL) {
    list.push({
      urls: process.env.TURN_URL.split(',').map(s => s.trim()).filter(Boolean),
      username: process.env.TURN_USERNAME || '',
      credential: process.env.TURN_CREDENTIAL || '',
    });
  }
  res.setHeader('Cache-Control', 'public, max-age=300');
  send(res, 200, { ok: true, iceServers: list, turn: !!process.env.TURN_URL });
});
