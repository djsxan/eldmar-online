// ============================================================
//  REDE — conexão direta entre navegadores (PeerJS / WebRTC).
//  Quem cria a sala é o "anfitrião": ele simula o mundo.
//  Cada jogador abre 2 canais com o anfitrião:
//   - "rel":  confiável e em ordem (eventos: dano, chat, compras)
//   - "fast": sem ordem (posições 10x por segundo; se um pacote
//             atrasar, o próximo já substitui — evita "engasgos")
// ============================================================
const Net = {
  PREFIX: 'world-of-sxan-v4-',
  peer: null, isHost: false, offline: false, myId: null, room: null,
  rel: {}, fast: {},          // (anfitrião) conexões por jogador
  hostRel: null, hostFast: null,

  onServer: null,       // (msg)          mensagem do anfitrião para este jogador
  onClient: null,       // (fromId, msg)  (só no anfitrião) mensagem de um jogador
  onPeerLeave: null,    // (id)
  onDisconnected: null, // ()

  host(room, cb) {
    this.isHost = true; this.room = room;
    if (typeof Peer === 'undefined') { this.goOffline(); cb(null); return; }
    let opened = false;
    const peer = new Peer(this.PREFIX + room, { debug: 1 });
    this.peer = peer;
    peer.on('open', id => { opened = true; this.myId = id; cb(null); });
    peer.on('connection', conn => {
      const who = conn.peer, isFast = conn.label === 'fast';
      (isFast ? this.fast : this.rel)[who] = conn;
      conn.on('data', d => this.onClient(who, d));
      if (isFast) { conn.on('close', () => { delete this.fast[who]; }); return; }
      const gone = () => {
        if (!this.rel[who]) return;
        delete this.rel[who]; delete this.fast[who];
        if (this.onPeerLeave) this.onPeerLeave(who);
      };
      conn.on('close', gone); conn.on('error', gone);
    });
    peer.on('disconnected', () => { if (!peer.destroyed) peer.reconnect(); });
    peer.on('error', err => { if (!opened) { peer.destroy(); cb(err); } else console.warn('PeerJS:', err); });
  },

  goOffline() { this.offline = true; this.isHost = true; this.myId = 'local'; },

  join(room, cb) {
    this.isHost = false; this.room = room;
    if (typeof Peer === 'undefined') { cb({ type: 'no-peerjs' }); return; }
    let done = false;
    const finish = err => { if (done) return; done = true; cb(err); };
    const peer = new Peer({ debug: 1 });
    this.peer = peer;
    peer.on('open', id => {
      this.myId = id;
      const rel = peer.connect(this.PREFIX + room, { label: 'rel', reliable: true, serialization: 'json' });
      this.hostRel = rel;
      const timer = setTimeout(() => finish({ type: 'timeout' }), 15000);
      rel.on('open', () => {
        clearTimeout(timer);
        const fast = peer.connect(this.PREFIX + room, { label: 'fast', reliable: false, serialization: 'json' });
        fast.on('open', () => { this.hostFast = fast; });
        fast.on('data', d => this.onServer(d));
        finish(null);
      });
      rel.on('data', d => this.onServer(d));
      rel.on('close', () => { if (done && this.onDisconnected) this.onDisconnected(); });
    });
    peer.on('error', err => { if (!done) { peer.destroy(); finish(err); } else console.warn('PeerJS:', err); });
  },

  // jogador -> anfitrião (fast = posição; pode perder/chegar fora de ordem)
  send(msg, fast) {
    if (this.isHost) { this.onClient(this.myId, msg); return; }
    const c = fast && this.hostFast && this.hostFast.open ? this.hostFast : this.hostRel;
    if (c && c.open) c.send(msg);
  },

  // anfitrião -> um jogador
  toOne(id, msg, fast) {
    if (id === this.myId) { this.onServer(msg); return; }
    const c = (fast && this.fast[id] && this.fast[id].open) ? this.fast[id] : this.rel[id];
    if (c && c.open) c.send(msg);
  },
  // anfitrião -> todos
  toAll(msg) {
    for (const id in this.rel) { const c = this.rel[id]; if (c.open) c.send(msg); }
    this.onServer(msg);
  },
  toOthers(msg, exceptId) {
    for (const id in this.rel) { if (id === exceptId) continue; const c = this.rel[id]; if (c.open) c.send(msg); }
    if (exceptId !== this.myId) this.onServer(msg);
  },
};
