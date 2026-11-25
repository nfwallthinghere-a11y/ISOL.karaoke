'use strict';
const L = require('./_lib');
const { handler, send } = L;
const store = require('./_store');
const lyrics = require('./_lyrics');

module.exports = handler('GET', async (req, res) => {
  send(res, 200, {
    ok: true,
    name: 'karaoke-call',
    version: '1.1.0',
    time: new Date().toISOString(),
    storage: store.kind(),              // 'kv' = lưu bền, 'memory' = tạm
    lyrics: lyrics.all().length,
    turn: L.cfg('TURN_URL') ? 'own' : 'free',   // TURN riêng hay TURN công cộng miễn phí
    peerServer: L.cfg('PEER_HOST') || 'peerjs-cloud',
    sheet: !!L.cfg('SHEET_CSV_URL'),
    youtube: !!L.cfg('YT_API_KEY'),
    gasKhoa: !!L.cfg('GAS_SECRET'),
    donate: L.cfg('GAS_URL') ? 'sheet' : store.kind(),
  });
});
