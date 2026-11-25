'use strict';
/* Danh sách máy chủ ICE cho WebRTC.
 * STUN chỉ giúp hai máy tự tìm thấy nhau khi mạng cho phép. Rất nhiều mạng (4G/5G có
 * CGNAT, wifi trường học, wifi công ty) chặn kết nối trực tiếp — lúc đó BẮT BUỘC phải
 * có TURN làm trạm trung chuyển, không thì vào phòng mà không ai nghe thấy ai.
 * Mặc định dùng TURN công cộng miễn phí của Open Relay Project; có TURN riêng thì
 * khai báo TURN_URL / TURN_USERNAME / TURN_CREDENTIAL để thay thế.
 */
const L = require('./_lib');
const { handler, send } = L;

const STUN = [
  'stun:stun.l.google.com:19302',
  'stun:stun1.l.google.com:19302',
  'stun:stun.cloudflare.com:3478',
  'stun:stun.nextcloud.com:443',
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

/* Metered: điền METERED_APP + METERED_KEY là server tự đi lấy thông tin đăng nhập TURN,
   khỏi phải dán tay username/credential. Nhớ tạm 10 phút cho đỡ gọi nhiều. */
let MET = { luc: 0, ds: null };
async function layMetered() {
  const app = L.cfg('METERED_APP'), key = L.cfg('METERED_KEY');
  if (!app || !key) return null;
  if (MET.ds && Date.now() - MET.luc < 600000) return MET.ds;
  try {
    const u = 'https://' + app.replace(/^https?:\/\//, '').replace(/\/.*$/, '') +
              '.metered.live/api/v1/turn/credentials?apiKey=' + encodeURIComponent(key);
    const r = await fetch(u);
    if (!r.ok) return null;
    const j = await r.json();
    if (!Array.isArray(j) || !j.length) return null;
    MET = { luc: Date.now(), ds: j };
    return j;
  } catch (e) { return null; }
}

module.exports = handler('GET', async (req, res) => {
  const list = [{ urls: STUN }];
  const met = await layMetered();
  if (met) {
    met.forEach(x => list.push(x));
  } else if (L.cfg('TURN_URL')) {
    list.push({
      urls: L.cfg('TURN_URL').split(',').map(s => s.trim()).filter(Boolean),
      username: L.cfg('TURN_USERNAME') || '',
      credential: L.cfg('TURN_CREDENTIAL') || '',
    });
  } else {
    list.push(FREE_TURN);
  }
  /* PeerServer riêng (tuỳ chọn). Bỏ trống thì dùng máy chủ công cộng của PeerJS. */
  let peerServer = null;
  if (L.cfg('PEER_HOST')) {
    peerServer = {
      host: L.cfg('PEER_HOST'),
      port: Number(L.cfg('PEER_PORT')) || 443,
      path: L.cfg('PEER_PATH') || '/',
      secure: L.cfg('PEER_SECURE') !== '0',
    };
    if (L.cfg('PEER_KEY')) peerServer.key = L.cfg('PEER_KEY');
  }

  const coRieng = !!met || !!L.cfg('TURN_URL');
  res.setHeader('Cache-Control', 'public, max-age=300');
  send(res, 200, {
    ok: true, iceServers: list,
    turn: met ? 'metered' : (L.cfg('TURN_URL') ? 'rieng' : 'cong-cong'),
    /* TURN công cộng miễn phí hay quá tải và có lúc ngừng hẳn. Không có TURN riêng thì
       máy dùng 4G/5G (CGNAT) rất dễ không bắt tay được — đặt TURN_URL để chắc ăn. */
    canhBao: coRieng ? '' : 'chua_co_turn_rieng',
    peer: peerServer,
  });
});
