// ============================================================
//  REDE — conexão direta entre navegadores usando PeerJS (WebRTC).
//  Quem cria a sala é o "host": ele simula os monstros e repassa
//  as mensagens para todos. Os outros jogadores conectam no host.
// ============================================================
const Net = {
  PREFIX: 'eldmar-online-v1-',
  peer: null,
  isHost: false,
  offline: false,
  myId: null,
  room: null,
  conns: {},        // (host) conexões com cada jogador
  hostConn: null,   // (cliente) conexão com o host

  // callbacks preenchidos pelo jogo
  onServer: null,       // (msg)          mensagem do host para este jogador
  onClient: null,       // (fromId, msg)  (só no host) mensagem de um jogador
  onPeerLeave: null,    // (id)           (só no host) jogador saiu
  onDisconnected: null, // ()             (cliente) perdeu o host

  host(room, cb) {
    this.isHost = true;
    this.room = room;
    if (typeof Peer === 'undefined') { this.goOffline(); cb(null); return; }
    let opened = false;
    const peer = new Peer(this.PREFIX + room, { debug: 1 });
    this.peer = peer;
    peer.on('open', id => { opened = true; this.myId = id; cb(null); });
    peer.on('connection', conn => {
      this.conns[conn.peer] = conn;
      conn.on('data', d => this.onClient(conn.peer, d));
      const gone = () => {
        if (!this.conns[conn.peer]) return;
        delete this.conns[conn.peer];
        if (this.onPeerLeave) this.onPeerLeave(conn.peer);
      };
      conn.on('close', gone);
      conn.on('error', gone);
    });
    peer.on('disconnected', () => { if (!peer.destroyed) peer.reconnect(); });
    peer.on('error', err => {
      if (!opened) { peer.destroy(); cb(err); }
      else console.warn('PeerJS:', err);
    });
  },

  goOffline() {
    this.offline = true;
    this.isHost = true;
    this.myId = 'local';
  },

  join(room, cb) {
    this.isHost = false;
    this.room = room;
    if (typeof Peer === 'undefined') { cb({ type: 'no-peerjs' }); return; }
    let done = false;
    const finish = err => { if (done) return; done = true; cb(err); };
    const peer = new Peer({ debug: 1 });
    this.peer = peer;
    peer.on('open', id => {
      this.myId = id;
      const conn = peer.connect(this.PREFIX + room, { reliable: true, serialization: 'json' });
      this.hostConn = conn;
      const timer = setTimeout(() => finish({ type: 'timeout' }), 15000);
      conn.on('open', () => { clearTimeout(timer); finish(null); });
      conn.on('data', d => this.onServer(d));
      conn.on('close', () => { if (done && this.onDisconnected) this.onDisconnected(); });
    });
    peer.on('error', err => {
      if (!done) { peer.destroy(); finish(err); }
      else console.warn('PeerJS:', err);
    });
  },

  // Jogador -> host
  send(msg) {
    if (this.isHost) this.onClient(this.myId, msg);
    else if (this.hostConn && this.hostConn.open) this.hostConn.send(msg);
  },

  // Host -> todos (inclusive ele mesmo)
  toAll(msg) {
    for (const id in this.conns) { const c = this.conns[id]; if (c.open) c.send(msg); }
    this.onServer(msg);
  },

  // Host -> todos menos um
  toOthers(msg, exceptId) {
    for (const id in this.conns) {
      if (id === exceptId) continue;
      const c = this.conns[id]; if (c.open) c.send(msg);
    }
    if (exceptId !== this.myId) this.onServer(msg);
  },

  // Host -> um jogador
  toOne(id, msg) {
    if (id === this.myId) { this.onServer(msg); return; }
    const c = this.conns[id];
    if (c && c.open) c.send(msg);
  },
};
