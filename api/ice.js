'use strict';
/* Danh sách máy chủ ICE cho WebRTC.
 * STUN chỉ giúp hai máy tự tìm thấy nhau khi mạng cho phép. Rất nhiều mạng (4G/5G có
 * CGNAT, wifi trường học, wifi công ty) chặn kết nối trực tiếp — lúc đó BẮT BUỘC phải
 * có TURN làm trạm trung chuyển, không thì vào phòng mà không ai nghe thấy ai.
 * Mặc định dùng TURN công cộng miễn phí của Open Relay Project; có TURN riêng thì
 * khai báo TURN_URL / TURN_USERNAME / TURN_CREDENTIAL để thay thế.
 */
const { handler, send } = require('./_lib');

const STUN = [
  'stun:stun.l.google.com:19302',
  'stun:stun1.l.google.com:19302',
  'stun:stun2.l.google.com:19302',
];

/* TURN công cộng miễn phí — cổng 80 và 443 để qua được tường lửa chặt */
const FREE_TURN = {
  urls: [
    'turn:openrelay.metered.ca:80',
    'turn:openrelay.metered.ca:443',
    'turns:openrelay.metered.ca:443',
  ],
  username: 'openrelayproject',
  credential: 'openrelayproject',
};

module.exports = handler('GET', async (req, res) => {
  const list = [{ urls: STUN }];
  if (process.env.TURN_URL) {
    list.push({
      urls: process.env.TURN_URL.split(',').map(s => s.trim()).filter(Boolean),
      username: process.env.TURN_USERNAME || '',
      credential: process.env.TURN_CREDENTIAL || '',
    });
  } else {
    list.push(FREE_TURN);
  }
  /* PeerServer riêng (tuỳ chọn). Bỏ trống thì dùng máy chủ công cộng của PeerJS. */
  let peerServer = null;
  if (process.env.PEER_HOST) {
    peerServer = {
      host: process.env.PEER_HOST,
      port: Number(process.env.PEER_PORT) || 443,
      path: process.env.PEER_PATH || '/',
      secure: process.env.PEER_SECURE !== '0',
    };
    if (process.env.PEER_KEY) peerServer.key = process.env.PEER_KEY;
  }

  res.setHeader('Cache-Control', 'public, max-age=300');
  send(res, 200, { ok: true, iceServers: list, turn: true, own: !!process.env.TURN_URL, peer: peerServer });
});
