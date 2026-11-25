'use strict';
const { handler, send } = require('./_lib');
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
    turn: process.env.TURN_URL ? 'own' : 'free',   // TURN riêng hay TURN công cộng miễn phí
    peerServer: process.env.PEER_HOST || 'peerjs-cloud',
    donate: (process.env.GAS_URL && process.env.GAS_SECRET) ? 'sheet' : store.kind(),
  });
});
