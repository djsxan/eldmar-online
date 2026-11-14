// ============================================================
//  CLIENTE — roda em todo mundo (inclusive no anfitrião).
//  Movimento livre (sem tiles), interpolação suave dos outros
//  jogadores, animações, interface e tela inicial.
// ============================================================
const G = {
  myId: null, me: null, players: {}, monsters: {}, npcs: {},
  nums: [], effects: [], parts: [], lights: [], timers: [], shake: 0,
  target: null, hover: null, path: null, pathGoal: null, keys: new Set(), cdEnd: [0, 0, 0, 0],
  started: false, view: { ox: 0, oy: 0 }, dialog: null, pendingNpc: null, reviving: null, zoomUser: false,
};
const INTERP_MS = 110;

function mkEnt(o) {
  return Object.assign({ rx: o.x || 0, ry: o.y || 0, z: 0, dir: 0, walking: false, walkDist: 0, buf: [], visible: false, flags: 0, idleT: performance.now(), idleWait: 3000 + Math.random() * 5000, idleAnim: null, anim: null }, o);
}
for (const n of NPCS) G.npcs[n.id] = mkEnt({ ...n, isNpc: true, visible: true, dir: 0 });

// 8 direções pelo ângulo na tela: 0 = baixo, 2 = direita, 4 = cima, 6 = esquerda
function dirFromVec(dx, dy, cur) {
  const sx = dx - dy, sy = (dx + dy) * 0.5;
  if (Math.abs(sx) < 0.001 && Math.abs(sy) < 0.001) return cur;
  return ((Math.round(Math.atan2(sx, sy) / (Math.PI / 4)) % 8) + 8) % 8;
}
const VIEW_DIR = { S: 0, E: 2, N: 4, W: 6 };
function anySprite(cls, skin, color, P, kind) {
  if (R3.ok) { const Q = { ...P, dir: P.dir != null ? P.dir : (VIEW_DIR[P.view] || 0) }; return kind ? npcSprite3D(kind, Q) : heroSprite3D(cls, skin, color, Q); }
  return kind ? npcSprite(kind, P) : heroSprite(cls, skin, color, P);
}
function later(ms, fn) { if (!ms || ms <= 0) fn(); else G.timers.push({ at: performance.now() + ms, fn }); }
const IDLE_SETS = {
  knight: ['look', 'stretch', 'polish', 'kick', 'sit', 'look'], archer: ['look', 'stretch', 'yawn', 'polish', 'sit', 'kick'], mage: ['look', 'yawn', 'polish', 'stretch', 'sit'],
  priest: ['pray', 'read', 'look', 'pray'], merchant: ['look', 'wave', 'kick', 'look'], innkeeper: ['drink', 'look', 'wave', 'drink'], guard: ['salute', 'look', 'kick', 'look'], captain: ['look', 'salute', 'polish', 'look'],
};
function updateIdle(e, now) {
  if (e.walking || (e.anim && now - e.anim.t0 < 700) || e.downed || (e.cast && e.cast.end > now)) { e.idleT = now; e.idleAnim = null; return; }
  if (e.idleAnim) { if (now - e.idleAnim.t0 > e.idleAnim.dur) { e.idleAnim = null; e.idleT = now; e.idleWait = 3500 + Math.random() * 6000; } return; }
  if (now - e.idleT > e.idleWait) {
    const set = IDLE_SETS[e.isNpc ? e.kind : e.cls] || IDLE_SETS.knight;
    const k = pick(set);
    e.idleAnim = { k, t0: now, dur: k === 'sit' ? 6000 + Math.random() * 4000 : 1800 + Math.random() * 600 };
    if (e.isNpc && Math.random() < 0.5) e.dir = pick([0, 0, 1, 3]);
  }
}

// ---------------- mensagens do servidor ----------------
function setBuffs(e, list) { const now = performance.now(); e.buffs = {}; for (const [k, ms] of list || []) e.buffs[k] = now + ms; }

function clientOnServer(m) {
  const now = performance.now();
  switch (m.t) {
    case 'welcome':
      G.myId = m.you;
      for (const p of m.players) G.players[p.id] = mkEnt({ ...p });
      G.me = G.players[G.myId];
      Object.assign(G.me, { x: m.x, y: m.y, rx: m.x, ry: m.y, z: 0, visible: true, mp: 0, maxMp: 1, hp: 1, maxHp: 1, quests: {}, qdone: {}, pots: { hp: 0, mp: 0 }, inv: {}, gold: 0, buffs: {}, lastTile: tileAt(m.x, m.y), sendT: 0 });
      startGame();
      if (!G.prebaked) { G.prebaked = true; prebakeCity(); }
      break;
    case 'pinfo': { const e = G.players[m.p.id]; if (e) Object.assign(e, m.p); else G.players[m.p.id] = mkEnt({ ...m.p }); break; }
    case 'pleave': delete G.players[m.id]; break;
    case 's': applySnapshot(m, now); break;
    case 'pstat': {
      const e = G.me; if (!e || m.id !== G.myId) break;
      const oldLvl = e.lvl;
      Object.assign(e, { hp: m.hp, maxHp: m.maxHp, mp: m.mp, maxMp: m.maxMp, lvl: m.lvl, xp: m.xp, gold: m.gold, pots: m.pots, inv: m.inv || {}, combat: m.combat, quests: m.quests, qdone: m.qdone });
      setBuffs(e, m.buffs);
      G.cdEnd = m.cds.map(r => now + r);
      e.downed = m.downed > 0; e.downUntil = now + m.downed;
      saveChar(); updateHud(); updateQuests(); if (!$('inv').classList.contains('hidden')) updateInv();
      if (oldLvl && m.lvl > oldLvl) showBanner(`Nível ${m.lvl}`, 'Sua força cresce.');
      break;
    }
    case 'tp': if (G.me) { G.floorWait = 0; G.climbing = null; G.me.lift = 0; Object.assign(G.me, { x: m.x, y: m.y, rx: m.x, ry: m.y, z: +m.z || 0, fl: m.fl | 0, fb: m.fb ?? -1 }); G.path = null; G.pathGoal = null; if (m.climb) G.climbArm = m.climb - 1; } break;
    case 'hit':
      later(m.d, () => {
        const t = performance.now();
        const e = m.k === 'm' ? G.monsters[m.id] : G.players[m.id];
        const pos = e ? tileW(e.rx, e.ry, (e.z || 0) * FLOOR_PX) : tileW(m.x, m.y);
        if (e) {
          e.hitAt = t;
          // empurrão na direção oposta a quem bateu (em coordenadas de tela)
          const vx = (m.x - (m.ax ?? m.x)) - (m.y - (m.ay ?? m.y)), vy = ((m.x - (m.ax ?? m.x)) + (m.y - (m.ay ?? m.y))) * 0.5, vl = Math.hypot(vx, vy) || 1;
          e.knock = { t0: t, dx: vx / vl, dy: vy / vl, s: m.crit || m.hv ? 1.8 : 1 };
          if (m.k === 'm' && (m.crit || m.hv)) e.fallAt = t;
        }
        if (m.by === G.myId) G.shake = Math.max(G.shake, m.crit || m.hv ? 4 : 1.6);
        const mine = m.k === 'p' && m.id === G.myId;
        if (false) G.nums.push({ wx: pos.x, wy: pos.y, text: String(m.dmg), color: m.k === 'm' ? (m.crit ? '#f8d850' : '#ffffff') : (mine ? '#f05040' : '#f0a090'), crit: m.crit, big: m.crit, t0: t, vx: (Math.random() < 0.5 ? -1 : 1) * (0.4 + Math.random() * 0.6) });
        for (let k = 0; k < 6; k++) spawnPart(m.k === 'p' ? 'blood' : 'spark', pos.x, pos.y - 26, { color: 'rgba(255,240,180,A)' });
        if (mine) { G.shake = Math.max(G.shake, 2.5); flashDamage(); }
      });
      break;
    case 'fx': if (false) later(m.d, () => { const p = tileW(m.x, m.y); G.nums.push({ wx: p.x, wy: p.y - 24, text: m.text, color: m.color, small: !m.big, big: m.big, t0: performance.now(), vx: 0 }); }); break;
    case 'proj': later(m.delay || 0, () => { const e = G.players[m.id]; if (!e) return; const t = performance.now(), from = tileW(e.rx, e.ry, 20 + (e.z || 0) * FLOOR_PX); G.effects.push({ a: 'proj', kind: m.kind, from, tx: m.tx, ty: m.ty, x: m.tx, y: m.ty, t0: t, dur: Math.max(120, m.d) }); }); break;
    case 'emote': { const e = G.players[m.id]; if (e) { e.emote = { k: m.k, t0: now }; e.anim = null; } break; }
    case 'anim': {
      const e = (m.w === 'p' ? G.players : G.monsters)[m.id];
      if (!e) break;
      e.anim = { a: m.a, t0: now, tx: m.tx, ty: m.ty }; e.emote = null;
      if (m.a === 'execute' && m.id === G.myId) later(380, () => { G.shake = Math.max(G.shake, 6); });
      if (m.tx != null && m.w === 'p' && m.a !== 'spin') e.dir = dirFromVec(m.tx - e.rx, m.ty - e.ry, e.dir);

      if (m.proj) {
        const rel = m.a === 'shoot' ? 230 : 130;
        for (let k = 0; k < (m.n || 1); k++) {
          const from = tileW(e.rx, e.ry, 34 + (e.z || 0) * FLOOR_PX);
          G.effects.push({ a: 'proj', kind: m.proj, from, tx: m.tx, ty: m.ty, x: m.tx, y: m.ty, t0: now + rel + k * 160, dur: Math.max(120, m.d - rel) });
        }
      }
      break;
    }
    case 'aoe':
      G.effects.push({ a: m.a, x: m.x, y: m.y, x2: m.x2, y2: m.y2, k: m.k, id: m.id, t0: now + (m.d || 0), dur: { whirl: 520, warcry: 800, wall: 600, agile: 600, potion: 500, pierce: 500, rain: 900, boom: 500, nova: 700, heal: 1000, lvlup: 1600, meteor: 1600 }[m.a] || 600, seed: Math.floor(Math.random() * 1000) });

      break;
    case 'cast': { const e = G.players[m.id]; if (e) { e.cast = { start: now, end: now + m.ms, el: m.el }; } break; }
    case 'castend': { const e = G.players[m.id]; if (e) e.cast = null; break; }
    case 'mdie': { const e = G.monsters[m.id]; if (e) e.dieAt = now + (m.d || 0); if (G.target === m.id) setTarget(null); break; }
    case 'chat': {
      addChat(m.name, m.text);
      const e = m.id && G.players[m.id];
      if (e) { e.say = m.text; e.sayUntil = now + 4500; }
      break;
    }
    case 'err': showToast(m.text); break;
    case 'npc': if (G.dialog && G.dialog.id === m.n) { setDialogText(m.text); if (m.n === 'captain') later(50, () => G.dialog && buildDialogOptions('captain')); } break;
    case 'down': { const e = G.players[m.id]; if (e) { e.downed = true; e.downUntil = now + DOWNED_MS; } if (m.id === G.myId) { setTarget(null); G.path = null; } break; }
    case 'up': { const e = G.players[m.id]; if (e) { e.downed = false; e.revive = null; } if (m.id === G.myId) showBanner('De pé outra vez', ''); break; }
    case 'rv': { const e = G.players[m.id]; if (e) e.revive = m.by ? { by: m.by, t0: now } : null; break; }
    case 'carry': { const c = G.players[m.by]; if (c) c.carrying = m.id || null; break; }
    case 'respawned': showBanner('Capela da Aurora', 'Você despertou nas ruínas e perdeu metade da experiência do nível.', true); break;
    case 'loot': { const it = LOOT[m.k]; if (it) { showToast('+ ' + it.name); G.newLoot = m.k; } break; }
    case 'qprog': { const q = QUESTS.find(x => x.id === m.id); if (q) showToast(`${q.name}: ${m.n}/${q.count}`); break; }
    case 'qdone': { const q = QUESTS.find(x => x.id === m.id); if (q) showBanner('Contrato cumprido', `${q.name} — +${q.xp} xp, +${q.gold} ouro`); break; }
  }
}

function applySnapshot(m, now) {
  const seenP = new Set();
  for (let [id, x100, y100, z, dir, fl, hpPct, carrying] of m.p) {
    seenP.add(id);
    let e = G.players[id];
    if (!e) e = G.players[id] = mkEnt({ id, name: '...', cls: 'knight', skin: 'iron', color: '#888888', lvl: 1 });
    const x = x100 / 100, y = y100 / 100;
    e.flags = fl; e.visible = true; e.carrying = carrying || null; e.carriedBy = !!(fl & 4); z = z / 100;
    const wasDown = e.downed; e.downed = !!(fl & 2);
    if (e.downed && !wasDown && !e.downUntil) e.downUntil = now + DOWNED_MS;
    if (id === G.myId) {
      if (e.carriedBy) { e.x = x; e.y = y; e.z = z; e.rx = x; e.ry = y; }
      continue;
    }
    e.hp = hpPct; e.maxHp = 100; e.z = z;
    e.srvDir = dir; e.srvWalk = !!(fl & 1); if (e !== G.me) { e.running = !!(fl & 256); e.fl = (fl >> 11) & 3; e.crouch = !!(fl & 8192); e.slide = !!(fl & 16384); e.sit = fl & 512 ? { chair: fl & 1024 ? 1 : 0 } : null; }
    e.buf.push({ t: now, x, y });
    if (e.buf.length > 6) e.buf.shift();
  }
  for (const id in G.players) if (!seenP.has(id) && id !== G.myId) G.players[id].visible = false;
  const seenM = new Set();
  for (const [id, ti, x100, y100, hp, flags, face] of m.m) {
    seenM.add(id);
    const x = x100 / 100, y = y100 / 100;
    let e = G.monsters[id];
    if (!e) { const type = MON_TYPES[ti]; e = G.monsters[id] = mkEnt({ id, type, x, y, rx: x, ry: y, maxHp: MON[type].hp, visible: true }); }
    e.hp = hp; e.flags = flags; e.face = face;
    e.buf.push({ t: now, x, y });
    if (e.buf.length > 6) e.buf.shift();
  }
  for (const id in G.monsters) if (!seenM.has(+id) && !G.monsters[id].dieAt) delete G.monsters[id];
  if (G.target && (!G.monsters[G.target] || G.monsters[G.target].dieAt)) setTarget(null);
}

// posição suavizada (renderiza um pouco "no passado" e interpola)
function interp(e, now) {
  const b = e.buf;
  if (!b.length) return;
  const t = now - INTERP_MS;
  let x, y;
  if (t <= b[0].t) { x = b[0].x; y = b[0].y; }
  else if (t >= b[b.length - 1].t) { x = b[b.length - 1].x; y = b[b.length - 1].y; }
  else for (let k = 0; k < b.length - 1; k++) if (t >= b[k].t && t <= b[k + 1].t) { const u = (t - b[k].t) / (b[k + 1].t - b[k].t || 1); x = b[k].x + (b[k + 1].x - b[k].x) * u; y = b[k].y + (b[k + 1].y - b[k].y) * u; break; }
  const dx = x - e.rx, dy = y - e.ry, d = Math.hypot(dx, dy);
  if (d > 4) { e.rx = x; e.ry = y; return; }
  e.rx = x; e.ry = y;
  e.walkDist += d;
  e.speedEst = (e.speedEst || 0) * 0.8 + d * 60 * 0.2;
  e.walking = e.speedEst > 0.4;
  if (d > 0.004) e.dir = dirFromVec(dx, dy, e.dir);
}

// ---------------- movimento local ----------------
function monsterNear(x, y, r = 0.5) {
  for (const id in G.monsters) { const m = G.monsters[id]; if (!m.dieAt && dist(m.rx, m.ry, x, y) < r) return true; }
  return false;
}
function freeAt(x, y, z) { const me = G.me; if (me && me.fl > 0) return canStandFloor(x, y, me.fb, me.fl, 0.22); return canStandZ(x, y, z, 0.22) && (z >= 0.5 || G.slide || !monsterNear(x, y)); }

function myInput() {
  const k = G.keys;
  let sx = 0, sy = 0;
  if (k.has('w') || k.has('arrowup')) sy -= 1;
  if (k.has('s') || k.has('arrowdown')) sy += 1;
  if (k.has('a') || k.has('arrowleft')) sx -= 1;
  if (k.has('d') || k.has('arrowright')) sx += 1;
  if (G.joy) { sx = G.joy[0]; sy = G.joy[1]; }
  if (!sx && !sy) return null;
  // direção na tela -> direção no mapa isométrico
  let dx = sx * 0.5 + sy, dy = -sx * 0.5 + sy;
  const L = Math.hypot(dx, dy); return [dx / L, dy / L];
}

function updateLocal(now, dt) {
  const me = G.me;
  if (!me || me.carriedBy) { if (me) { me.walking = false; } return; }
  if (G.climbing) { stepClimb(now); return; }
  if (now < (G.floorWait || 0)) { me.walking = false; return; }
  if (document.activeElement && document.activeElement.tagName === 'INPUT') G.keys.clear();
  let v = myInput();
  if (me.sit) { if (v || G.path) standUp(); else { v = null; } }
  if (v) { G.path = null; G.pathGoal = null; G.pendingNpc = null; G.pendingSeat = null; }
  else if (G.path && G.path.length) {
    // segue o caminho, pulando pontos quando há linha livre
    while (G.path.length > 1 && lineFree(me.x, me.y, G.path[1][0], G.path[1][1], me.z)) G.path.shift();
    const [tx, ty] = G.path[0], dx = tx - me.x, dy = ty - me.y, d = Math.hypot(dx, dy);
    if (d < 0.12) { G.path.shift(); if (!G.path.length) { G.path = null; G.pathGoal = null; } }
    else v = [dx / d, dy / d];
  }
  if (me.cast && me.cast.end > now) v = null;
  if (G.pendingSeat != null && !G.path) { const st = WORLD.seats[G.pendingSeat]; if (dist(me.x, me.y, st.x, st.y) <= 1.7) sitDown(G.pendingSeat); G.pendingSeat = null; }
  if (G.pendingNpc && !G.path) { const n = G.npcs[G.pendingNpc]; if (dist(me.x, me.y, n.x, n.y) <= 3) openDialog(n.id); G.pendingNpc = null; }
  // correr com SHIFT gasta estamina; ao esgotar, precisa recuperar um pouco antes de correr de novo
  if (G.stam == null) { G.stam = STAM_MAX; G.stamT = 0; G.tired = false; }
  const kneel = healthState(me) === 3;
  const crouchKey = !kneel && (G.keys.has('c') || G.crouchToggle) && !me.downed && !me.carrying && !me.sit && (me.z || 0) < 0.5;
  if (!(G.keys.has('c') && G.keys.has('shift'))) G.slideLatch = false;
  if (!G.slide && !kneel && v && G.keys.has('c') && G.keys.has('shift') && !G.slideLatch && !G.tired && G.stam >= SLIDE_COST && !me.downed && !me.carrying && (me.z || 0) < 0.5 && !(me.fl > 0)) {
    G.slide = { t0: now, v: v.slice() }; G.slideLatch = true; G.stam -= SLIDE_COST; G.stamT = now;
  }
  if (G.slide && now - G.slide.t0 > SLIDE_MS) G.slide = null;
  if (G.slide) v = G.slide.v;
  me.slide = !!G.slide; me.crouch = crouchKey && !G.slide;
  const running = !!v && !kneel && G.keys.has('shift') && !crouchKey && !G.tired && !me.downed && !me.carrying && G.stam > 0;
  if (running) { G.stam = Math.max(0, G.stam - STAM_DRAIN * dt); G.stamT = now; if (G.stam <= 0) G.tired = true; }
  else if (now - G.stamT > STAM_DELAY) G.stam = Math.min(STAM_MAX, G.stam + STAM_REGEN * dt * (v ? 0.6 : me.sit ? 2.5 : 1));
  revealFog(me.x, me.y);
  if (G.tired && G.stam >= STAM_MAX * 0.3) G.tired = false;
  me.running = running;
  let moved = 0;
  if (v) {
    let sp = PLAYER_SPEED;
    if (me.buffs && me.buffs.agile > now) sp *= 1.6;
    if (running) sp *= RUN_MUL;
    if (me.crouch) sp *= CROUCH_MUL;
    if (kneel) sp *= KNEEL_MUL;
    if (G.slide) { const k = (now - G.slide.t0) / SLIDE_MS; sp = PLAYER_SPEED * RUN_MUL * 1.5 * (1 - k * 0.65); if (Math.random() < 0.5) { const w = tileW(me.x, me.y, 0); spawnPart('dust', w.x, w.y); } }
    if (me.carrying) sp *= 0.75;
    if (me.downed) sp *= 0.22;
    if (WORLD.ground[tileAt(me.x, me.y)] === T.SHALLOW) sp *= 0.65;
    if (stairH(me.x, me.y) >= 0) sp *= 0.8;
    const step = sp * dt, nx = me.x + v[0] * step, ny = me.y + v[1] * step;
    const ox = me.x, oy = me.y;
    if (freeAt(nx, ny, me.z)) { me.x = nx; me.y = ny; }
    else if (freeAt(nx, me.y, me.z)) me.x = nx;
    else if (freeAt(me.x, ny, me.z)) me.y = ny;
    moved = Math.hypot(me.x - ox, me.y - oy);
    me.dir = dirFromVec(v[0], v[1], me.dir);
    if (!moved && G.path) { G.path = null; G.pathGoal = null; }
  }
  me.walking = moved > 0.0005;
  me.walkDist += moved;
  if (me.walking && Math.random() < 0.08) { const w = tileW(me.x, me.y, me.z * FLOOR_PX); spawnPart('dust', w.x, w.y); }
  // escadas dentro dos prédios: pisar no degrau de baixo sobe andando; pisar no topo (andar de cima) desce
  if ((me.z || 0) < 0.5 && now >= (G.climbT || 0) && !me.downed && !me.carrying) {
    const fl = me.fl || 0, bi = fl > 0 ? me.fb : bldAt(me.x, me.y), b = BUILDINGS[bi];
    if (b && b.kind !== 'stairtower') {
      const nF = floorsOf(b);
      if (fl < nF - 1) { const s = stairWorld(b, fl); if (Math.hypot(me.x - s.L[0], me.y - s.L[1]) < 0.42) { const ex = s.U[0] + (s.U[0] - s.L[0]) * 0.45, ey = s.U[1] + (s.U[1] - s.L[1]) * 0.45; startClimb(now, bi, fl, fl + 1, [[me.x, me.y, 0], [s.L[0], s.L[1], 0.25], [s.U[0], s.U[1], 0.75], [ex, ey, 1]], s.arrive); } }
      if (!G.climbing && fl > 0) { const s = stairWorld(b, fl - 1); if (Math.hypot(me.x - s.U[0], me.y - s.U[1]) < 0.42) { const ex = s.L[0] - (s.U[0] - s.L[0]) * 0.45, ey = s.L[1] - (s.U[1] - s.L[1]) * 0.45; startClimb(now, bi, fl, fl - 1, [[me.x, me.y, 0], [s.U[0], s.U[1], -0.25], [s.L[0], s.L[1], -0.75], [ex, ey, -1]], s.entry); } }
    }
  }
  // torres-escada: pisar na escada sobe para a muralha; pisar no alçapão lá em cima desce
  for (let bi = 0; bi < BUILDINGS.length; bi++) {
    const b = BUILDINGS[bi]; if (b.kind !== 'stairtower') continue;
    const cx = b.x + 1, cy = b.y + 1, d = Math.hypot(me.x - cx, me.y - cy);
    if (d > 0.9) { if (G.climbArm === bi) G.climbArm = null; continue; }
    if (G.climbArm === bi || d > 0.42 || now < (G.climbT || 0)) continue;
    const up = (me.z || 0) < 0.5;
    if (up && bldAt(me.x, me.y) !== bi) continue;
    G.climbT = now + 900; G.climbArm = bi; G.path = null; G.pathGoal = null;
    fadeFlash(); Net.send({ t: 'climb', b: bi, up: up ? 1 : 0 });
    break;
  }
  // rampas: a altura acompanha a posição (sem teletransporte)
  me.z = heightAt(me.x, me.y, me.z);
  // na rampa, centraliza suavemente no degrau
  { const t = tileAt(me.x, me.y), d = WORLD.stair[t]; if (d && moved) { const k = Math.min(1, dt * 10); if (d <= 2) me.y += (Math.round(me.y) - me.y) * k; else me.x += (Math.round(me.x) - me.x) * k; } }
  me.rx = me.x; me.ry = me.y;
  if (me.walking && me.emote) me.emote = null;
  if (now - (G.autoT || 0) > 250 && !me.downed && !me.carrying && (me.z || 0) < 0.5 && !inSafe(me.x, me.y)) {
    G.autoT = now;
    const rng2 = CLASSES[me.cls].range, cur = G.target && G.monsters[G.target];
    const keep = cur && !cur.dieAt && dist(me.x, me.y, cur.rx, cur.ry) <= rng2 * 1.5;
    if (!keep) { let best = null, bd = rng2; for (const id in G.monsters) { const q = G.monsters[id]; if (q.dieAt || !q.visible || MON[q.type].beh) continue; const d = dist(me.x, me.y, q.rx, q.ry); if (d <= bd) { bd = d; best = q; } } if (best) setTarget(best.id); else if (cur && cur.dieAt) setTarget(null); }
  }
  const stF = (me.crouch ? 1 : 0) | (me.slide ? 2 : 0);
  if (now - me.sendT > 100 && (moved || me.walking !== me.sentWalk || stF !== me.sentSt)) {
    me.sendT = now; me.sentWalk = me.walking; me.sentSt = stF;
    Net.send({ t: 'mv', x: Math.round(me.x * 100) / 100, y: Math.round(me.y * 100) / 100, z: Math.round(me.z * 100) / 100, d: me.dir, w: me.walking ? 1 : 0, r: running ? 1 : 0, c: me.crouch ? 1 : 0, sl: me.slide ? 1 : 0, ti: G.tired || (G.stam ?? STAM_MAX) < STAM_MAX * 0.3 ? 1 : 0 }, true);
  }
}
function lineFree(ax, ay, bx, by, z) {
  const d = Math.hypot(bx - ax, by - ay), n = Math.ceil(d / 0.3), L = z >= 0.5 ? 1 : 0;
  for (let k = 1; k <= n; k++) { const t = k / n, x = ax + (bx - ax) * t, y = ay + (by - ay) * t; if (stairH(x, y) >= 0 || !canStand(x, y, L, 0.26)) return false; }
  return true;
}
function findPath(sx, sy, tx, ty, z, near = 0) {
  z = z >= 0.5 ? 1 : 0;
  sx = Math.round(sx); sy = Math.round(sy);
  const key = (x, y) => y * MAP_W + x, start = key(sx, sy), prev = new Map([[start, -1]]), q = [[sx, sy]];
  for (let qi = 0; qi < q.length && qi < 6000; qi++) {
    const [x, y] = q[qi];
    if (Math.max(Math.abs(x - tx), Math.abs(y - ty)) <= near && !(x === sx && y === sy && near)) {
      const path = []; let k = key(x, y);
      while (k !== start) { path.push([k % MAP_W, Math.floor(k / MAP_W)]); k = prev.get(k); }
      path.reverse();
      if (!near && path.length) path[path.length - 1] = [tx, ty];
      return path;
    }
    for (const [dx, dy] of DIRS8) {
      const nx = x + dx, ny = y + dy, k = key(nx, ny);
      if (prev.has(k) || !walkableTile(nx, ny, z)) continue;
      if (z === 0 && !edgeOk(x, y, nx, ny)) continue;
      if (dx && dy && (!walkableTile(x + dx, y, z) || !walkableTile(x, y + dy, z))) continue;
      if (z === 0 && WORLD.stair[k]) continue;
      prev.set(k, key(x, y)); q.push([nx, ny]);
    }
  }
  return null;
}

function setTarget(id) {
  if (G.target === id) return;
  G.target = id;
  Net.send({ t: 'target', id });
  updateTargetFrame();
}
function castSkill(i) {
  const me = G.me, sk = SKILLS[me.cls][i], now = performance.now();
  if (!sk || me.downed) return;
  if (now < G.cdEnd[i]) return;
  if (me.mp < sk.mp) { showToast('Mana insuficiente.'); return; }
  if (healthState(me) === 3) { showToast('De joelhos, sem forças para isso.'); return; }
  if (sk.tgt) {
    const t = G.target && G.monsters[G.target];
    if (!t) { showToast('Selecione um alvo (clique nele ou aperte Espaço).'); return; }
    if (dist(me.x, me.y, t.rx, t.ry) > sk.range + 0.3) { showToast(`Alvo fora de alcance (máx. ${sk.range} tiles).`); return; }
  }
  const slot = $('slot' + i);
  slot.classList.remove('pressed'); void slot.offsetWidth; slot.classList.add('pressed');
  Net.send({ t: 'skill', i });
}
function drinkPot(k) {
  if (G.me.downed) return;
  if (!G.me.pots || G.me.pots[k] <= 0) { showToast(`Sem ${ITEMS[k].name}. Compre no Empório do Borin.`); return; }
  Net.send({ t: 'pot', k });
}
function nearestDowned() {
  let best = null, bd = 1.7;
  for (const id in G.players) { const e = G.players[id]; if (id === G.myId || !(e.downed || healthState(e) === 3) || !e.visible || e.carriedBy) continue; const d = dist(e.rx, e.ry, G.me.x, G.me.y); if (d < bd) { bd = d; best = e; } }
  return best;
}

// ---------------- salvar no navegador ----------------
const SAVE_KEY = 'wos-chars-v4';
function loadChars() { try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch (e) { return {}; } }
function charKey(name, cls) { return name.trim().toLowerCase() + '|' + cls; }
function saveChar() {
  const me = G.me;
  try {
    const all = loadChars();
    all[charKey(me.name, me.cls)] = { name: me.name, cls: me.cls, skin: me.skin, color: me.color, lvl: me.lvl, xp: me.xp, gold: me.gold, pots: me.pots, inv: me.inv, quests: me.quests, qdone: me.qdone, t: Date.now() };
    localStorage.setItem(SAVE_KEY, JSON.stringify(all));
  } catch (e) { }
}

// ============================================================
//  INTERFACE
// ============================================================
const $ = id => document.getElementById(id);
const canvas = $('game'), ctx = canvas.getContext('2d');
let W = 0, H = 0, DPR = 1;
function resize() {
  DPR = Math.min(SET.quality === 'low' ? 1 : SET.quality === 'med' ? 1.5 : 2, window.devicePixelRatio || 1);
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = W * DPR; canvas.height = H * DPR;
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  if (!G.zoomUser) SCALE = clamp(H / 425 * 1.45 * (SET.zoom || 1), 1.8, 6.5);
}
window.addEventListener('resize', resize);
resize();

function bar(id, v, max, text) { $(id + '-fill').style.width = (100 * clamp(v / max, 0, 1)) + '%'; $(id + '-text').textContent = text; }
function updateHud() {
  const me = G.me; if (!me) return;
  $('hud-name').textContent = me.name;
  $('hud-class').textContent = CLASSES[me.cls].name; $('hud-lvl').textContent = me.lvl;
  bar('hp', me.hp, me.maxHp, `${me.hp} / ${me.maxHp}`);
  bar('mp', me.mp, me.maxMp, `${me.mp} / ${me.maxMp}`);
  bar('st', G.stam ?? STAM_MAX, STAM_MAX, 'Estamina'); $('st-fill').parentNode.classList.toggle('tired', !!G.tired);
  bar('xp', me.xp, need(me.lvl), `${me.xp} / ${need(me.lvl)} xp`);
  $('gold').textContent = me.gold;
  $('pot-hp-n').textContent = me.pots ? me.pots.hp : 0;
  $('pot-mp-n').textContent = me.pots ? me.pots.mp : 0;
  const st = $('combat-state');
  st.textContent = me.downed ? '✖ Caído' : me.combat ? '⚔ Em combate' : (me.hp < me.maxHp || me.mp < me.maxMp ? '✚ Recuperando' : '· Descansado');
  st.className = me.downed || me.combat ? 'combat' : 'rest';
  SKILLS[me.cls].forEach((sk, i) => $('slot' + i).classList.toggle('nomana', me.mp < sk.mp));
  const buffs = $('buffs'); buffs.innerHTML = '';
  const now = performance.now();
  for (const k in me.buffs) {
    if (me.buffs[k] <= now) continue;
    const d = document.createElement('div'); d.className = 'buff ' + k; d.dataset.tip = BUFF_NAMES[k] || k; d.dataset.end = me.buffs[k];
    buffs.appendChild(d);
  }
  $('downed-ui').classList.toggle('hidden', !me.downed);
  if (G.dialog) refreshDialogGold();
}
function updateQuests() {
  const box = $('quest-list'), done = $('quest-done'), me = G.me;
  box.innerHTML = ''; done.innerHTML = '';
  const act = Object.entries(me.quests || {});
  const row = (q, html) => { const d = document.createElement('div'); d.className = 'jq'; d.innerHTML = html; return d; };
  for (const [id, n] of act) {
    const q = QUESTS.find(x => x.id === id); if (!q) continue;
    box.appendChild(row(q, `<b>${q.name}</b> <small>· ${n}/${q.count} ${MON[q.mon].name}</small><div class="jq-bar"><div style="width:${100 * n / q.count}%"></div></div><small>${q.desc} Recompensa: ${q.xp} xp e ${q.gold} de ouro.</small>`));
  }
  if (!act.length) box.innerHTML = '<div class="gp-note">Nenhum contrato ativo.</div>';
  const dn = QUESTS.filter(q => me.qdone && me.qdone[q.id]);
  for (const q of dn) done.appendChild(row(q, `<b>${q.name}</b> <small>· cumprido ${me.qdone[q.id]}x</small>`));
  if (!dn.length) done.innerHTML = '<div class="gp-note">Nada ainda.</div>';
}
// ---------- painéis: inventário (I) e jornada (J) ----------
function togglePanel(id, force) {
  const el = $(id), open = force != null ? force : el.classList.contains('hidden');
  for (const o of ['inv', 'journal']) $(o).classList.add('hidden');
  if (!open) return;
  el.classList.remove('hidden');
  if (id === 'inv') updateInv(); else updateQuests();
}
function updateInv() {
  const me = G.me, grid = $('inv-grid'); if (!me) return;
  $('inv-gold').textContent = me.gold;
  const list = [];
  if (me.pots && me.pots.hp) list.push({ k: 'hp', n: me.pots.hp, name: ITEMS.hp.name, icon: '🧪', color: '#e85a5a', desc: ITEMS.hp.desc + ' Clique para beber (Q).', use: () => drinkPot('hp') });
  if (me.pots && me.pots.mp) list.push({ k: 'mp', n: me.pots.mp, name: ITEMS.mp.name, icon: '🧪', color: '#5a8ae8', desc: ITEMS.mp.desc + ' Clique para beber (E).', use: () => drinkPot('mp') });
  for (const k in (me.inv || {})) { const it = LOOT[k]; if (it && me.inv[k] > 0) list.push({ k, n: me.inv[k], name: it.name, icon: it.icon, color: it.color, desc: it.desc + ' Vale ' + it.price + ' de ouro cada no Empório.' }); }
  grid.innerHTML = '';
  for (let i = 0; i < INV_SLOTS; i++) {
    const s = document.createElement('div'), it = list[i]; s.className = 'inv-slot';
    if (it) {
      s.classList.add('full'); if (G.newLoot === it.k) s.classList.add('new');
      s.innerHTML = `<span style="color:${it.color};filter:${it.k === 'mp' ? 'hue-rotate(55deg) saturate(1.4)' : it.k === 'hp' ? 'hue-rotate(195deg) saturate(1.6)' : 'none'}">${it.icon}</span><span class="n">${it.n}</span>`;
      s.onmouseenter = () => { $('inv-info').innerHTML = `<b>${it.name}</b> ×${it.n}<br>${it.desc}`; };
      if (it.use) s.onclick = () => { it.use(); setTimeout(updateInv, 300); };
    }
    grid.appendChild(s);
  }
  G.newLoot = null;
}
for (const b of document.querySelectorAll('.gp-x')) b.addEventListener('click', () => togglePanel(b.dataset.close, false));
$('btn-inv').addEventListener('click', () => togglePanel('inv'));
$('btn-journal').addEventListener('click', () => togglePanel('journal'));
// estado de saúde na tela: cansado = bordas escuras; à beira da morte = pulso vermelho e cores apagadas
function updateHealthFx() {
  const hs = G.me ? healthState(G.me) : 0;
  if (hs === G.hsShown) return; G.hsShown = hs;
  $('hstate').className = hs === 3 ? 'dying kneel' : hs === 2 ? 'dying' : hs === 1 ? 'tired' : '';
  document.body.classList.toggle('dying', hs >= 2); document.body.classList.toggle('tired', hs === 1);
}
function updateTargetFrame() {
  const f = $('target-frame'), t = G.target && G.monsters[G.target];
  if (true) { f.classList.add('hidden'); return; }   // tela limpa: sem quadro do alvo
  f.classList.remove('hidden');
  const z = ZONES[zoneAt(t.rx, t.ry)];
  $('tg-name').textContent = MON[t.type].name;
  $('tg-stars').textContent = '★'.repeat(Math.max(1, z.stars));
  bar('tg', t.hp, t.maxHp, `${Math.max(0, t.hp)} / ${t.maxHp}`);
  const d = dist(G.me.x, G.me.y, t.rx, t.ry), r = CLASSES[G.me.cls].range, safe = inSafe(G.me.x, G.me.y);
  const rs = $('tg-range');
  rs.textContent = safe ? 'Você está na cidadela (zona protegida)' : d <= r ? '⚔ Ao alcance' : `Fora de alcance (${d.toFixed(1)} / ${r})`;
  rs.className = !safe && d <= r ? 'ok' : 'far';
}
function updateSlots(now) {
  for (let i = 0; i < 4; i++) {
    const left = Math.max(0, G.cdEnd[i] - now), sk = SKILLS[G.me.cls][i], el = $('slot' + i);
    el.style.setProperty('--cd', left > 0 ? (left / sk.cd * 360) + 'deg' : '0deg');
    $('slot' + i + '-t').textContent = left > 0 ? (left / 1000).toFixed(left < 1000 ? 1 : 0) : '';
  }
  for (const b of document.querySelectorAll('.buff')) {
    const left = (+b.dataset.end - now) / 1000;
    b.textContent = left > 0 ? (left > 60 ? Math.ceil(left / 60) + 'm' : Math.ceil(left) + '') : '';
    if (left <= 0) b.remove();
  }
  const me = G.me;
  if (me.downed) { const left = Math.max(0, me.downUntil - now); $('downed-time').textContent = Math.ceil(left / 1000) + 's'; $('downed-fill').style.width = (left / DOWNED_MS * 100) + '%'; }
  // dica de interação (reanimar/carregar)
  const dn = !me.downed && nearestDowned();
  const pr = $('prompt');
  if (me.carrying) { pr.textContent = '[G] Soltar · leve até a Irmã Lúmina, na capela'; pr.classList.remove('hidden'); }
  else if (dn) { pr.textContent = `[F segurar] Reanimar ${dn.name} · [G] Carregar`; pr.classList.remove('hidden'); }
  else pr.classList.add('hidden');
}

function addChat(name, text) {
  const log = $('chat-log'), line = document.createElement('div');
  if (name) { const b = document.createElement('b'); b.textContent = name + ': '; line.append(b, document.createTextNode(text)); }
  else { line.className = 'sys'; line.textContent = text; }
  log.appendChild(line);
  while (log.children.length > 80) log.firstChild.remove();
  log.scrollTop = log.scrollHeight;
}
let toastTimer = 0;
function showToast(text) { const t = $('toast'); t.textContent = text; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600); }
let bannerTimer = 0;
function showBanner(title, sub, dark) {
  const b = $('banner'); $('banner-title').textContent = title; $('banner-sub').textContent = sub;
  b.className = dark ? 'show dark' : 'show'; clearTimeout(bannerTimer); bannerTimer = setTimeout(() => b.className = '', 3400);
}
function flashDamage() { const v = $('vignette'); v.classList.remove('hit'); void v.offsetWidth; v.classList.add('hit'); }

// ---------- diálogos com NPCs ----------
const GUARD_TEXT = 'Além do fosso: os Campos (★) logo além da paliçada; o Bosque Sombrio (★★) ao norte; o Pântano Pútrido (★★) a leste; as Colinas de Ossos (★★★) ao sul; o Acampamento Orc (★★★) a oeste. Perto do mar, as Terras Selvagens (★★★★). A cachoeira fica na montanha, a noroeste.';
const NPC_DIALOG = {
  merchant: { greet: 'Bem-vindo ao Empório. Não é muito, mas o que vendo funciona.', opts: [
    ['Poção de Vida — 20 ouro', { a: 'buy', item: 'hp', qty: 1 }], ['5 Poções de Vida — 100 ouro', { a: 'buy', item: 'hp', qty: 5 }],
    ['Poção de Mana — 25 ouro', { a: 'buy', item: 'mp', qty: 1 }], ['5 Poções de Mana — 125 ouro', { a: 'buy', item: 'mp', qty: 5 }],
    ['Vender todo o saque', { a: 'sell' }]] },
  priest: { greet: 'Paz, viajante. A capela é pequena, mas a Aurora ainda escuta quem pede. Traga aqui os que caírem; eu cuido deles.', opts: [['Receber a bênção (grátis)', { a: 'bless' }]] },
  innkeeper: { greet: 'Sente-se. Tem fogo, comida quente e gente falando demais. Do que precisa?', opts: [
    ['Hidromel — 15 ouro (+10% de dano por 3 min)', { a: 'mead' }], ['Ensopado de javali — 10 ouro (recupera tudo)', { a: 'stew' }], ['Ouvir as conversas da taverna', { a: 'rumor' }]] },
  guard: { greet: 'Fique atento lá fora. Quanto mais longe da cidadela, mais o mundo tenta te matar.', opts: [['Quais são as regiões?', { local: GUARD_TEXT }]] },
  smith: { greet: 'Hrodgar. Ferreiro da cidadela. Se a lâmina está cega, eu resolvo.', opts: [['Afiar a arma — 25 ouro (+15% de dano por 4 min)', { a: 'whet' }], ['Conversar', { a: 'talk' }]] },
  captain: { greet: 'Sou a Capitã Varn. Temos poucos braços e muitas ameaças. Aceite um contrato e eu pago pelo serviço.', opts: [] },
};
function npcUnderMouse(mx, my) {
  const S = SCALE;
  for (const n of NPCS) {
    const e = G.npcs[n.id], p = iso(e.rx, e.ry), sx = (p.sx + G.view.ox) * S, sy = (p.sy + G.view.oy) * S;
    if (mx > sx - 16 * S && mx < sx + 16 * S && my > sy - 72 * S && my < sy + 6 * S) return n;
  }
  return null;
}
function openDialog(id) {
  const n = NPCS.find(q => q.id === id), def = NPC_DIALOG[n.id === 'captain' ? 'captain' : n.kind];
  G.dialog = { id };
  $('dlg-name').textContent = n.name;
  setDialogText(def.greet);
  buildDialogOptions(id);
  const pc = $('dlg-portrait'), pctx = pc.getContext('2d');
  pctx.setTransform(1, 0, 0, 1, 0, 0); pctx.clearRect(0, 0, pc.width, pc.height); pctx.imageSmoothingEnabled = false;
  const spr = anySprite(null, null, null, { view: 'S', dir: 1, walk: -1 }, n.kind), kk = R3.ok ? 1.25 : 1.6;
  pctx.imageSmoothingEnabled = true;
  pctx.drawImage(spr.c, pc.width / 2 - spr.ax * kk, pc.height - spr.ay * kk + (R3.ok ? 70 : 46), spr.w * kk, spr.h * kk);
  refreshDialogGold();
  $('dialog').classList.remove('hidden');
}
function buildDialogOptions(id) {
  const n = NPCS.find(q => q.id === id), box = $('dlg-opts');
  box.innerHTML = '';
  const add = (label, fn, cls) => { const b = document.createElement('button'); b.textContent = label; b.onclick = fn; if (cls) b.className = cls; box.appendChild(b); };
  if (id === 'captain') {
    const me = G.me;
    for (const q of QUESTS) {
      const active = me.quests && me.quests[q.id] != null;
      const done = (me.qdone && me.qdone[q.id]) || 0;
      if (active) add(`✦ ${q.name} — ${me.quests[q.id]}/${q.count} (cancelar)`, () => Net.send({ t: 'npc', n: id, a: 'abandon', id: q.id }), 'active');
      else add(`${q.name} — ${q.count} ${MON[q.mon].name} · ${q.xp} xp${done ? ` · feito ${done}x` : ''}`, () => { setDialogText(q.desc); Net.send({ t: 'npc', n: id, a: 'quest', id: q.id }); });
    }
  } else {
    const def = NPC_DIALOG[n.kind];
    for (const [label, act] of def.opts) add(label, () => { if (act.local) setDialogText(act.local); else Net.send({ t: 'npc', n: id, ...act }); });
  }
  add('Até logo', closeDialog, 'ghost');
}
function setDialogText(t) { $('dlg-text').textContent = t; }
function refreshDialogGold() { $('dlg-gold').textContent = G.me ? G.me.gold : 0; }
function closeDialog() { G.dialog = null; $('dialog').classList.add('hidden'); }

// ---------- mouse e teclado ----------
function screenToWorld(mx, my) {
  const z = G.me ? (G.me.z || 0) * FLOOR_PX : 0;
  return unIso(mx / SCALE - G.view.ox, my / SCALE - G.view.oy + z);
}
function monsterUnderMouse(mx, my) {
  let found = null, bestD = -Infinity;
  const S = SCALE;
  for (const id in G.monsters) {
    const e = G.monsters[id]; if (e.dieAt || !e.visible) continue;
    const spr = monSprite(e.type, 0, -1), p = iso(e.rx, e.ry), sx = (p.sx + G.view.ox) * S, sy = (p.sy + G.view.oy) * S;
    const hw = Math.max(18, spr.w * 0.4) * S;
    if (mx > sx - hw && mx < sx + hw && my > sy - spr.ay * S && my < sy + 6 * S) { const d = e.rx + e.ry; if (d > bestD) { found = e; bestD = d; } }
  }
  return found;
}
canvas.addEventListener('mousemove', e => {
  if (!G.started) return;
  const w = screenToWorld(e.clientX, e.clientY);
  G.hover = { x: Math.round(w.x), y: Math.round(w.y) };
  canvas.style.cursor = monsterUnderMouse(e.clientX, e.clientY) ? 'crosshair' : npcUnderMouse(e.clientX, e.clientY) ? 'help' : 'pointer';
});
canvas.addEventListener('contextmenu', e => e.preventDefault());
// assento sob o mouse (bancos e cadeiras)
function seatUnderMouse(cx, cy) {
  const S = SCALE, w = screenToWorld(cx, cy);
  let best = -1, bd = 1.2;
  WORLD.seats.forEach((st, k) => { const d = Math.hypot(st.x - w.x, st.y - w.y); if (d < bd) { bd = d; best = k; } });
  return best;
}
// sentar: no chão (C) ou num assento
function sitDown(seat) {
  const me = G.me; if (!me || me.downed || me.carrying || me.carriedBy) return;
  if (seat != null && seat >= 0) {
    const st = WORLD.seats[seat];
    me.sit = { seat, chair: 1, ox: me.x, oy: me.y }; me.x = me.rx = st.x; me.y = me.ry = st.y; me.dir = st.dir;
    Net.send({ t: 'sit', on: 1, s: seat });
  } else { me.sit = { chair: 0 }; Net.send({ t: 'sit', on: 1 }); }
  G.path = null; G.pathGoal = null; me.walking = false;
}
function standUp() {
  const me = G.me; if (!me || !me.sit) return;
  const s = me.sit; me.sit = null;
  if (s.chair) {
    // sai do assento para o lugar livre mais perto
    let spot = null;
    for (const rr of [0.8, 1.0, 1.3]) for (let a = 0; a < 6.28 && !spot; a += 0.4) { const x = me.x + Math.cos(a) * rr, y = me.y + Math.sin(a) * rr; if (canStandZ(x, y, 0) && edgeOk(Math.round(me.x), Math.round(me.y), Math.round(x), Math.round(y))) spot = [x, y]; }
    if (!spot && s.ox != null) spot = [s.ox, s.oy];
    if (spot) { me.x = me.rx = spot[0]; me.y = me.ry = spot[1]; }
  }
  Net.send({ t: 'sit', on: 0 });
  Net.send({ t: 'mv', x: Math.round(me.x * 100) / 100, y: Math.round(me.y * 100) / 100, z: Math.round(me.z * 100) / 100, d: me.dir, w: 0 }, true);
}
canvas.addEventListener('mousedown', e => {
  if (!G.started) return;
  $('chat-input').blur();
  const me = G.me;
  const mon = monsterUnderMouse(e.clientX, e.clientY);
  if (mon) {
    setTarget(G.target === mon.id ? null : mon.id);
    if (G.target && dist(me.x, me.y, mon.rx, mon.ry) > CLASSES[me.cls].range) showToast('Fora de alcance: aproxime-se para atacar.');
    return;
  }
  const seat = seatUnderMouse(e.clientX, e.clientY);
  if (seat >= 0 && !npcUnderMouse(e.clientX, e.clientY)) {
    const st = WORLD.seats[seat];
    if (dist(me.x, me.y, st.x, st.y) <= 1.7) sitDown(seat);
    else { G.path = findPath(me.x, me.y, st.x, st.y, me.z, 1); G.pathGoal = G.path ? { x: st.x, y: st.y } : null; G.pendingSeat = G.path ? seat : null; }
    return;
  }
  const npc = npcUnderMouse(e.clientX, e.clientY);
  if (npc) {
    if (dist(me.x, me.y, npc.x, npc.y) <= 3) openDialog(npc.id);
    else { G.path = findPath(me.x, me.y, Math.round(npc.x), Math.round(npc.y), me.z, 2); G.pathGoal = G.path ? { x: Math.round(npc.x), y: Math.round(npc.y) } : null; G.pendingNpc = npc.id; }
    return;
  }
  if (e.button !== 0 || me.carriedBy) return;
  const w = screenToWorld(e.clientX, e.clientY), tx = Math.round(w.x), ty = Math.round(w.y);
  if (!walkableTile(tx, ty, me.z)) return;
  G.pendingNpc = null;
  if (me.fl > 0) { const w2 = screenToWorld(e.clientX, e.clientY); G.path = [[w2.x, w2.y]]; G.pathGoal = { x: Math.round(w2.x), y: Math.round(w2.y) }; return; }
  G.path = findPath(me.x, me.y, w.x, w.y, me.z, 0);
  if (G.path && G.path.length) G.path[G.path.length - 1] = [w.x, w.y];
  G.pathGoal = G.path ? { x: tx, y: ty } : null;
});
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  SCALE = clamp(SCALE * (e.deltaY < 0 ? 1.1 : 0.9), 1.4, 7);
  G.zoomUser = true;
}, { passive: false });

window.addEventListener('keydown', e => {
  if (!G.started) return;
  const input = $('chat-input');
  if (document.activeElement === input) {
    if (e.key === 'Enter') { const text = input.value.trim(); if (text) Net.send({ t: 'chat', text }); input.value = ''; input.blur(); }
    else if (e.key === 'Escape') input.blur();
    return;
  }
  const k = e.key.toLowerCase();
  if (G.paused && k !== 'escape') return;
  if (k === 'enter') { input.focus(); e.preventDefault(); return; }
  if (k === 'escape') { if (G.mapOpen) { toggleWorldMap(); return; } if (!$('inv').classList.contains('hidden') || !$('journal').classList.contains('hidden')) { togglePanel('inv', false); return; } if (G.dialog) { closeDialog(); return; } togglePause(); return; }
  if (k >= '1' && k <= '4') { castSkill(+k - 1); return; }
  if (k === 'q') { drinkPot('hp'); return; }
  if (k === 'e') { drinkPot('mp'); return; }
  if (k === 'r' && G.me.downed) { Net.send({ t: 'giveup' }); return; }
  if (k === 'f' && !e.repeat) { const d = nearestDowned(); if (d) { G.reviving = d.id; Net.send({ t: 'revive', id: d.id, on: true }); } return; }
  if (k === 'g' && !e.repeat) { if (G.me.carrying) Net.send({ t: 'carry' }); else { const d = nearestDowned(); if (d) Net.send({ t: 'carry', id: d.id }); } return; }
  if (k === 'x') { attackNearest(); return; }
  if (k === 'v' && !e.repeat) { if (G.me.sit) standUp(); else if (!G.me.walking) sitDown(null); return; }
  if (k === 'i' && !e.repeat) { togglePanel('inv'); return; }
  if (k === 'j' && !e.repeat) { togglePanel('journal'); return; }
  if (k === 'm' && !e.repeat) { toggleWorldMap(); return; }
  if (k === 't') { if (!e.repeat) openEmoteWheel(); return; }
  if (k === ' ' || k === 'tab') {
    e.preventDefault();
    let best = null, bd = 99;
    for (const id in G.monsters) { const m = G.monsters[id]; if (m.dieAt) continue; const d = dist(m.rx, m.ry, G.me.x, G.me.y); if (d < bd && m.id !== G.target) { bd = d; best = m; } }
    if (best && bd <= 9) setTarget(best.id);
    return;
  }
  if (k.startsWith('arrow')) e.preventDefault();
  if (k === 'shift') e.preventDefault();
  G.keys.add(k);
});
window.addEventListener('keyup', e => {
  const k = e.key.toLowerCase();
  G.keys.delete(k);
  if (k === 't' && G.wheel) closeEmoteWheel(true);
  if (k === 'f' && G.reviving) { Net.send({ t: 'revive', id: G.reviving, on: false }); G.reviving = null; }
});
window.addEventListener('blur', () => G.keys.clear());

// ---------- laço de desenho ----------
let lastMini = 0, lastHud = 0, lastT = performance.now();
const lobbyCam = { x: CENTER, y: CENTER, z: 0 };
function frame() {
  const now = performance.now(), dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  if (G.timers.length) { const due = G.timers.filter(t => t.at <= now); G.timers = G.timers.filter(t => t.at > now); for (const t of due) t.fn(); }
  R3.budget = G.started ? 3 : 2;
  S3.budget = G.started ? 2 : 5;
  let cam = lobbyCam;
  if (G.started) {
    updateLocal(now, dt);
    for (const id in G.players) { const e = G.players[id]; if (id !== G.myId) interp(e, now); updateIdle(e, now); }
    for (const id in G.monsters) { const m = G.monsters[id]; interp(m, now); if (m.dieAt && now > m.dieAt + 650) delete G.monsters[id]; }
    for (const id in G.npcs) updateIdle(G.npcs[id], now);
    cam = { x: G.me.rx, y: G.me.ry, z: G.me.z };
    updateGates(dt);
    if (G.mapOpen && now - (G.mapT || 0) > 300) { G.mapT = now; drawWorldMap(); }
  } else {
    const t = now / 11000;
    lobbyCam.x = CENTER + Math.cos(t) * 7; lobbyCam.y = CENTER + Math.sin(t) * 7;
    for (const id in G.npcs) updateIdle(G.npcs[id], now);
  }
  const labels = renderWorld(ctx, now, cam, W, H, DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (G.started) {
    drawLabels(ctx, labels, now);
    drawNumbers(ctx, now);
    updateSlots(now);
    if (now - lastMini > 200) {
      lastMini = now;
      // sem minimapa: ao entrar numa região nova, aparece o nome dela
      const zi = zoneAt(G.me.x, G.me.y);
      if (G.zoneShown == null) G.zoneShown = zi;
      else if (zi !== G.zoneShown) { G.zoneShown = zi; const z = ZONES[zi]; showBanner(z.name, z.stars ? '★'.repeat(z.stars) + '☆'.repeat(4 - z.stars) : 'Zona protegida', z.stars >= 3); }
      updateHealthFx();
      updateTargetFrame();
    }
    if (now - lastHud > 1000) { lastHud = now; updateHud(); }
    if (G.dialog) { const n = G.npcs[G.dialog.id]; if (dist(G.me.x, G.me.y, n.x, n.y) > 4.5) closeDialog(); }
  } else drawClassPreviews(now);
  requestAnimationFrame(frame);
}

function attackNearest() {
  let best = null, bd = 99;
  for (const id in G.monsters) { const m = G.monsters[id]; if (m.dieAt) continue; const d = dist(m.rx, m.ry, G.me.x, G.me.y); if (d < bd) { bd = d; best = m; } }
  if (best && bd <= 10) setTarget(best.id); else showToast('Nenhum inimigo por perto.');
  const b = $('btn-attack'); b.classList.remove('pressed'); void b.offsetWidth; b.classList.add('pressed');
}
function setupJoystick() {
  const joy = $('joystick'), knob = $('joy-knob');
  let id = null, cx = 0, cy = 0;
  joy.addEventListener('pointerdown', e => { id = e.pointerId; const r = joy.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; joy.setPointerCapture(id); move(e); });
  const move = e => {
    if (e.pointerId !== id) return;
    let dx = e.clientX - cx, dy = e.clientY - cy; const L = Math.hypot(dx, dy), max = 46;
    if (L > max) { dx = dx / L * max; dy = dy / L * max; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    G.joy = L > 10 ? [dx / max, dy / max] : null;
  };
  joy.addEventListener('pointermove', move);
  const end = e => { if (e.pointerId !== id) return; id = null; G.joy = null; knob.style.transform = ''; };
  joy.addEventListener('pointerup', end); joy.addEventListener('pointercancel', end);
}
function buildHotbar() {
  const cls = G.me.cls;
  const iconTo = (cv, id) => { const c2 = cv.getContext('2d'); c2.imageSmoothingEnabled = false; c2.clearRect(0, 0, cv.width, cv.height); const ic = iconSprite(id); c2.drawImage(ic.c, 0, 0, ic.w, ic.h, 0, 0, cv.width, cv.height); };
  SKILLS[cls].forEach((sk, i) => {
    const el = $('slot' + i);
    iconTo(el.querySelector('canvas'), sk.id);
    el.querySelector('.cost').textContent = sk.mp;
    el.dataset.tip = `${sk.name}\n${sk.desc}\nMana ${sk.mp} · Recarga ${sk.cd / 1000}s${sk.cast ? ` · Conjuração ${sk.cast / 1000}s` : ''}${sk.range ? ` · Alcance ${sk.range}` : ''}`;
    el.onclick = () => castSkill(i);
  });
  iconTo($('pot-hp').querySelector('canvas'), 'hp'); iconTo($('pot-mp').querySelector('canvas'), 'mp');
  $('pot-hp').onclick = () => drinkPot('hp'); $('pot-mp').onclick = () => drinkPot('mp');
  const p = CLASSES[cls].passive;
  $('passive').dataset.tip = `Aptidão: ${p.name}\n${p.desc}`; $('passive').textContent = p.name;
  const pc = $('portrait'), pctx = pc.getContext('2d');
  pctx.setTransform(1, 0, 0, 1, 0, 0); pctx.clearRect(0, 0, pc.width, pc.height); pctx.imageSmoothingEnabled = false;
  const spr = anySprite(cls, G.me.skin, G.me.color, { view: 'S', dir: 1, walk: -1 });
  pctx.imageSmoothingEnabled = true;
  if (R3.ok) { const f = spr.c.width / spr.w; pctx.drawImage(spr.c, 42 * f, 28 * f, 36 * f, 38 * f, 0, 0, pc.width, pc.height); }
  else pctx.drawImage(spr.c, 22, 28, 44, 46, 0, 0, pc.width, pc.height);
}
function startGame() {
  if (G.started) return;
  G.started = true;
  $('lobby').classList.add('hidden');
  $('hud').classList.remove('hidden');
  buildHotbar(); updateHud(); updateQuests(); setupJoystick();
  $('btn-attack').onclick = attackNearest;
  if (matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');
  if (!$('btn-crouch')) { const b = document.createElement('button'); b.id = 'btn-crouch'; b.textContent = '⤓'; b.title = 'Agachar'; document.body.appendChild(b); b.addEventListener('click', () => { G.crouchToggle = !G.crouchToggle; b.classList.toggle('on', G.crouchToggle); }); }
  addChat('', `Bem-vindo a World of Sxan, ${G.me.name}. Fale com os moradores clicando neles. Enter abre o chat.`);
  showBanner('Cidadela de Sxan', 'Zona protegida — os monstros não atravessam o fosso.');
}

// tooltips
const tip = $('tooltip');
document.addEventListener('mouseover', e => {
  if (document.body.classList.contains('touch') || (e.pointerType && e.pointerType !== 'mouse') || matchMedia('(hover: none)').matches) { tip.classList.add('hidden'); return; }
  const el = e.target.closest('[data-tip]');
  if (!el) { tip.classList.add('hidden'); return; }
  const [title, ...rest] = el.dataset.tip.split('\n');
  tip.innerHTML = '';
  const h = document.createElement('b'); h.textContent = title; tip.appendChild(h);
  for (const r of rest) { const d = document.createElement('div'); d.textContent = r; tip.appendChild(d); }
  tip.classList.remove('hidden');
  const r = el.getBoundingClientRect();
  tip.style.left = clamp(r.left + r.width / 2 - 135, 8, window.innerWidth - 278) + 'px';
  tip.style.top = Math.max(8, r.top - tip.offsetHeight - 10) + 'px';
});

// ============================================================
//  LOBBY
// ============================================================
const HERALDRY = ['#8b2e2e', '#2c4a7a', '#3a6b3a', '#5e3a7a', '#8a5a24', '#2a6a64', '#7a2a5a', '#3a3a40'];
let chosenClass = 'knight', chosenSkin = { knight: 'iron', archer: 'scout', mage: 'adept' }, chosenColor = HERALDRY[0];
function randomCode() { const ch = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 5; i++) s += ch[Math.floor(Math.random() * ch.length)]; return s; }
function setStatus(text, err) { const s = $('status'); s.textContent = text; s.className = err ? 'err' : ''; }
function lockLobby(b) { for (const el of document.querySelectorAll('#lobby button, #lobby input')) el.disabled = b; }
function helloMsg() {
  const name = $('name').value.trim() || 'Aventureiro';
  const saved = loadChars()[charKey(name, chosenClass)] || {};
  return { t: 'hello', name, color: chosenColor, cls: chosenClass, skin: chosenSkin[chosenClass], lvl: saved.lvl, xp: saved.xp, gold: saved.gold, pots: saved.pots, inv: saved.inv, quests: saved.quests, qdone: saved.qdone };
}
function showRoom(code) { $('room-code').textContent = Net.offline ? 'offline' : code; }
function createRoom(code = randomCode(), tries = 0) {
  if (!$('name').value.trim()) { setStatus('Escolha um nome para seu herói.', true); $('name').focus(); return; }
  lockLobby(true); setStatus('Erguendo o reino...');
  Net.onClient = hostOnClient; Net.onServer = clientOnServer; Net.onPeerLeave = hostOnLeave;
  Net.host(code, err => {
    if (err) {
      if (err.type === 'unavailable-id' && tries < 3) { createRoom(randomCode(), tries + 1); return; }
      setStatus('Não foi possível criar a sala: ' + (err.type || err), true); lockLobby(false); return;
    }
    startHostLoop(); hostTick(); showRoom(code); Net.send(helloMsg());
  });
}
function joinRoom() {
  if (!$('name').value.trim()) { setStatus('Escolha um nome para seu herói.', true); $('name').focus(); return; }
  const code = $('code').value.trim().toUpperCase();
  if (!code) { setStatus('Digite o código da sala.', true); return; }
  lockLobby(true); setStatus('Cavalgando até a sala ' + code + '...');
  Net.onServer = clientOnServer;
  Net.onDisconnected = () => $('disconnected').classList.remove('hidden');
  Net.join(code, err => {
    if (err) {
      const msg = err.type === 'peer-unavailable' ? 'Sala não encontrada. Confira o código (quem criou precisa estar com o jogo aberto).'
        : err.type === 'timeout' ? 'Tempo esgotado. A rede pode estar bloqueando a conexão direta.'
        : err.type === 'no-peerjs' ? 'Não foi possível carregar a biblioteca de rede (sem internet?).' : 'Erro: ' + (err.type || err);
      setStatus(msg, true); lockLobby(false); return;
    }
    showRoom(code); Net.send(helloMsg());
  });
}

const previews = [];
function drawClassPreviews(now) {
  for (const { cls, c } of previews) {
    const pctx = c.getContext('2d');
    pctx.setTransform(1, 0, 0, 1, 0, 0); pctx.clearRect(0, 0, c.width, c.height); pctx.imageSmoothingEnabled = false;
    const sel = cls === chosenClass, cyc = (now / 1000) % 8;
    const dirs = ['S', 'E', 'N', 'W'], view = sel ? dirs[Math.floor(cyc / 2) % 4] : 'S';
    const atkK = { knight: ['swing', 'bash', 'warcry'], archer: ['shoot', 'pierce', 'rain'], mage: ['bolt', 'fireball', 'meteor'] }[cls][Math.floor(now / 8000) % 3];
    const inAtk = sel && (cyc % 2) > 1.4;
    const P = { view: view === 'W' ? 'E' : view, dir: R3.ok ? (sel ? Math.floor(now / 1000) % 8 : 1) : undefined, walk: sel && !inAtk ? Math.floor(now / 70) % 12 : -1, act: inAtk ? { k: atkK, f: Math.min(11, Math.floor(((cyc % 2) - 1.4) / 0.6 * 12)) } : null };
    const spr = anySprite(cls, chosenSkin[cls], chosenColor, P);
    const k = R3.ok ? 1.0 : 1.3;
    pctx.imageSmoothingEnabled = !!R3.ok;
    pctx.save();
    pctx.translate(c.width / 2, c.height - 4);
    if (view === 'W' && !R3.ok) pctx.scale(-1, 1);
    pctx.drawImage(spr.c, -spr.ax * k, -spr.ay * k, spr.w * k, spr.h * k);
    pctx.restore();
  }
}
// nível do personagem salvo com este nome e vocação (para liberar skins)
function lobbyLvl(cls) { const nm = ($('name').value || '').trim().toLowerCase(); let l = 1; for (const ch of Object.values(loadChars())) if (ch.cls === cls && (ch.name || '').toLowerCase() === nm) l = Math.max(l, ch.lvl | 0); return l; }
function refreshSkinLocks() {
  document.querySelectorAll('.class-card').forEach(card => {
    const cls = card.dataset.cls, lv = lobbyLvl(cls);
    card.querySelectorAll('.skin').forEach(el => { const si = +el.dataset.si; el.classList.toggle('locked', lv < SKIN_LVL[si]); });
    const cur = SKINS[cls].findIndex(s => s.id === chosenSkin[cls]); if (cur > 0 && lv < SKIN_LVL[cur]) { chosenSkin[cls] = SKINS[cls][0].id; card.querySelectorAll('.skin').forEach((el, i) => el.classList.toggle('sel', i === 0)); }
  });
}
function buildLobby() {
  $('version').textContent = `${GAME_NAME} ${VERSION} · ${VERSION_NAME}`;
  const box = $('classes');
  for (const [cls, c] of Object.entries(CLASSES)) {
    const card = document.createElement('div');
    card.className = 'class-card' + (cls === chosenClass ? ' sel' : ''); card.dataset.cls = cls;
    const cv = document.createElement('canvas'); cv.width = 132; cv.height = 150; previews.push({ cls, c: cv });
    const h = document.createElement('h3'); h.textContent = c.name;
    const role = document.createElement('div'); role.className = 'role'; role.textContent = c.role;
    const skins = document.createElement('div'); skins.className = 'skins';
    for (const s of SKINS[cls]) {
      const b = document.createElement('button');
      b.className = 'skin ' + s.rarity.toLowerCase().replace('á', 'a').replace('ê', 'e') + (chosenSkin[cls] === s.id ? ' sel' : '');
      const si = SKINS[cls].indexOf(s); b.dataset.si = si; b.dataset.lvl = 'nv. ' + SKIN_LVL[si];
      b.textContent = s.name; b.dataset.tip = `${s.name}\nRaridade: ${s.rarity}${si ? `\nLibera no nível ${SKIN_LVL[si]}` : ''}`;
      b.onclick = ev => { ev.stopPropagation(); if (lobbyLvl(cls) < SKIN_LVL[si]) { showToast(`Esta skin libera no nível ${SKIN_LVL[si]}.`); return; } chosenSkin[cls] = s.id; chosenClass = cls; for (const el of skins.children) el.classList.toggle('sel', el === b); selectClass(cls); };
      skins.appendChild(b);
    }
    const desc = document.createElement('p'); desc.textContent = c.desc;
    const stats = document.createElement('div'); stats.className = 'stats';
    for (const [k, v] of Object.entries(c.stats)) {
      const row = document.createElement('div'), lab = document.createElement('span'), pips = document.createElement('i');
      lab.textContent = k;
      for (let n = 0; n < 5; n++) { const s2 = document.createElement('b'); if (n < v) s2.className = 'on'; pips.appendChild(s2); }
      row.append(lab, pips); stats.appendChild(row);
    }
    const sk = document.createElement('div'); sk.className = 'skills';
    for (const s of SKILLS[cls]) {
      const ic = document.createElement('canvas'); ic.width = 36; ic.height = 36;
      const ictx = ic.getContext('2d'); ictx.imageSmoothingEnabled = false; { const ic = iconSprite(s.id); ictx.drawImage(ic.c, 0, 0, ic.w, ic.h, 0, 0, 36, 36); }
      ic.dataset.tip = `${s.name}\n${s.desc}\nMana ${s.mp} · Recarga ${s.cd / 1000}s`;
      sk.appendChild(ic);
    }
    const pas = document.createElement('div'); pas.className = 'passive-line';
    pas.textContent = '✦ ' + c.passive.name; pas.dataset.tip = `Aptidão: ${c.passive.name}\n${c.passive.desc}`;
    card.append(cv, h, role, skins, desc, stats, sk, pas);
    card.onclick = () => selectClass(cls);
    box.appendChild(card);
  }
  const sw = $('swatches');
  for (const col of HERALDRY) {
    const b = document.createElement('button');
    b.className = 'swatch' + (col === chosenColor ? ' sel' : ''); b.style.background = col; b.title = 'Cor do brasão'; b.dataset.col = col;
    b.onclick = () => { chosenColor = col; for (const el of sw.children) el.classList.toggle('sel', el === b); };
    sw.appendChild(b);
  }
  const chars = Object.values(loadChars()).sort((a, b) => (b.t || 0) - (a.t || 0)).slice(0, 4);
  const sv = $('saved');
  for (const ch of chars) {
    if (!CLASSES[ch.cls]) continue;
    const b = document.createElement('button'); b.className = 'saved-char';
    b.textContent = `${ch.name} · ${CLASSES[ch.cls].name} nv. ${ch.lvl}`;
    b.onclick = () => {
      $('name').value = ch.name; if (ch.skin) chosenSkin[ch.cls] = ch.skin; chosenColor = ch.color || chosenColor;
      for (const el of $('swatches').children) el.classList.toggle('sel', el.dataset.col === chosenColor);
      selectClass(ch.cls);
      document.querySelectorAll('.class-card').forEach(card => { if (card.dataset.cls === ch.cls) card.querySelectorAll('.skin').forEach((el, i) => el.classList.toggle('sel', SKINS[ch.cls][i].id === chosenSkin[ch.cls])); });
      refreshSkinLocks();
    };
    sv.appendChild(b);
  }
  if (!chars.length) sv.classList.add('hidden');
  $('name').addEventListener('input', () => { updateSavedInfo(); refreshSkinLocks(); });
  refreshSkinLocks();
  const urlCode = new URLSearchParams(location.search).get('sala');
  if (urlCode) $('code').value = urlCode.toUpperCase();
  $('btn-create').onclick = () => createRoom();
  $('btn-join').onclick = joinRoom;
  $('code').addEventListener('keydown', e => { if (e.key === 'Enter') joinRoom(); });
  $('btn-copy').onclick = () => { const link = location.origin + location.pathname + '?sala=' + Net.room; navigator.clipboard.writeText(link).then(() => showToast('Convite copiado. Mande para seus amigos.'), () => showToast(link)); };
  $('btn-help').onclick = () => $('help').classList.toggle('hidden');
  if (chars[0]) $('name').value = chars[0].name;
  updateSavedInfo();
}
function selectClass(cls) {
  chosenClass = cls;
  for (const el of document.querySelectorAll('.class-card')) el.classList.toggle('sel', el.dataset.cls === cls);
  updateSavedInfo();
}
function updateSavedInfo() {
  const name = $('name').value.trim(), s = name && loadChars()[charKey(name, chosenClass)];
  $('saved-info').textContent = s ? `Continuar: ${s.name}, ${CLASSES[s.cls].name} nível ${s.lvl} (${s.gold || 0} ouro)` : name ? `Novo herói: ${name}, ${CLASSES[chosenClass].name}` : '';
}

buildLobby();
requestAnimationFrame(frame);

// ============================================================
//  NÉVOA DO MAPA (o que você já explorou) e MAPA DO MUNDO (M)
// ============================================================
const FOG_R = 13;
function fogKey() { return 'wos-fog-' + MAP_W + '-' + ((G.me && G.me.name) || 'x'); }
function loadFog() {
  G.fog = new Uint8Array(MAP_W * MAP_H);
  try { const s = localStorage.getItem(fogKey()); if (s) { const bin = atob(s); for (let i = 0; i < MAP_W * MAP_H; i++) if (bin.charCodeAt(i >> 3) & (1 << (i & 7))) G.fog[i] = 1; } } catch (e) { }
  G.fogDirty = true; G.fogT = 0;
}
function saveFog() {
  try { const bytes = new Uint8Array(MAP_W * MAP_H / 8); for (let i = 0; i < MAP_W * MAP_H; i++) if (G.fog[i]) bytes[i >> 3] |= 1 << (i & 7); let s = ''; for (const b of bytes) s += String.fromCharCode(b); localStorage.setItem(fogKey(), btoa(s)); } catch (e) { }
}
function revealFog(x, y) {
  if (!G.fog || G.fogKeyName !== fogKey()) { G.fogKeyName = fogKey(); loadFog(); }
  const tx = Math.round(x), ty = Math.round(y);
  if (tx === G.fogTx && ty === G.fogTy) return;
  G.fogTx = tx; G.fogTy = ty;
  for (let dy = -FOG_R; dy <= FOG_R; dy++) for (let dx = -FOG_R; dx <= FOG_R; dx++) {
    if (dx * dx + dy * dy > FOG_R * FOG_R || !inBounds(tx + dx, ty + dy)) continue;
    const i = (ty + dy) * MAP_W + tx + dx; if (!G.fog[i]) { G.fog[i] = 1; G.fogDirty = true; }
  }
  const now = performance.now();
  if (G.fogDirty && now - G.fogT > 4000) { G.fogT = now; saveFog(); }
}
// camada de névoa (pergaminho onde não foi explorado), com bordas suaves
function fogLayer() {
  if (!G.fog) return null;
  if (G.fogCanvas && !G.fogDirty) return G.fogCanvas;
  const c = G.fogCanvas || (G.fogCanvas = document.createElement('canvas')); c.width = MAP_W; c.height = MAP_H;
  const x = c.getContext('2d'), img = x.createImageData(MAP_W, MAP_H);
  for (let i = 0; i < MAP_W * MAP_H; i++) { const n = hash2(i % MAP_W, i / MAP_W | 0, 9) * 18; img.data[i * 4] = 196 + n; img.data[i * 4 + 1] = 176 + n; img.data[i * 4 + 2] = 134 + n; img.data[i * 4 + 3] = G.fog[i] ? 0 : 255; }
  x.putImageData(img, 0, 0);
  G.fogDirty = false;
  return c;
}
// nomes das regiões no mapa: setores pelo centro; anéis em 4 pontos ao redor da cidade
const ZONE_LABELS = (() => {
  const acc = {}, out = [];
  for (let y = 0; y < MAP_H; y += 2) for (let x = 0; x < MAP_W; x += 2) { const z = WORLD.zone[y * MAP_W + x], g = WORLD.ground[y * MAP_W + x]; if (g === T.WATER) continue; const a = acc[z] || (acc[z] = [0, 0, 0]); a[0] += x; a[1] += y; a[2]++; }
  const ring = { [Z.OUTSKIRTS]: 50, [Z.FIELDS]: 72, [Z.WILD]: 114 };
  for (const [z, a] of Object.entries(acc)) {
    if (+z === Z.VILLAGE) continue;
    if (ring[z]) for (let k = 0; k < 4; k++) { const an = Math.PI / 4 + k * Math.PI / 2 + 0.35, x = C + Math.cos(an) * ring[z], y = C + Math.sin(an) * ring[z]; if (inBounds(Math.round(x), Math.round(y)) && WORLD.zone[Math.round(y) * MAP_W + Math.round(x)] === +z) out.push({ z: +z, x, y }); }
    else out.push({ z: +z, x: a[0] / a[2], y: a[1] / a[2] });
  }
  return out;
})();
function toggleWorldMap() {
  G.mapOpen = !G.mapOpen;
  $('worldmap').classList.toggle('hidden', !G.mapOpen);
  if (G.mapOpen) drawWorldMap();
}
function drawWorldMap() {
  if (!G.mapOpen || !G.me) return;
  const cv = $('wm-canvas'), size = Math.min(innerWidth, innerHeight) * 0.86, dpr = Math.min(2, devicePixelRatio || 1);
  cv.width = size * dpr; cv.height = size * dpr; cv.style.width = size + 'px'; cv.style.height = size + 'px';
  const x = cv.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0);
  const s = size / (MAP_W * Math.SQRT2) * 1.02;
  const P = (wx, wy) => { const dx = (wx - MAP_W / 2) * s, dy = (wy - MAP_H / 2) * s; return [size / 2 + (dx - dy) * Math.SQRT1_2, size / 2 + (dx + dy) * Math.SQRT1_2]; };
  x.save(); x.translate(size / 2, size / 2); x.rotate(Math.PI / 4); x.scale(s, s); x.translate(-MAP_W / 2, -MAP_H / 2);
  x.imageSmoothingEnabled = false; x.drawImage(MINI, 0, 0);
  x.imageSmoothingEnabled = true; const f = fogLayer(); if (f) { x.filter = 'blur(1.5px)'; x.drawImage(f, 0, 0); x.filter = 'none'; }
  x.restore();
  // tom de pergaminho por cima de tudo
  x.globalCompositeOperation = 'multiply'; x.fillStyle = 'rgba(230,205,160,0.55)'; x.fillRect(0, 0, size, size); x.globalCompositeOperation = 'source-over';
  const seen = (wx, wy) => G.fog && G.fog[Math.round(wy) * MAP_W + Math.round(wx)];
  x.textAlign = 'center'; x.textBaseline = 'middle';
  const label = (t, wx, wy, sz, col) => { const [px, py] = P(wx, wy); x.font = '700 ' + sz + 'px "Cinzel", serif'; x.lineWidth = 3; x.strokeStyle = 'rgba(240,226,190,0.85)'; x.strokeText(t, px, py); x.fillStyle = col; x.fillText(t, px, py); };
  for (const L of ZONE_LABELS) if (seen(L.x, L.y)) label(ZONES[L.z].name + (ZONES[L.z].stars ? ' ' + '★'.repeat(ZONES[L.z].stars) : ''), L.x, L.y, 13, '#4a2e14');
  if (seen(C, C)) label('Sxan', C, C + 2, 20, '#5a1a10');
  // marcos: lojas e NPCs já vistos
  const icons = { priest: '✚', merchant: '⚖', innkeeper: '🍺', smith: '⚒', captain: '!' };
  for (const n of NPCS) if (icons[n.kind] && seen(n.x, n.y)) { const [px, py] = P(n.x, n.y); x.font = '700 12px serif'; x.fillStyle = '#2a1a0a'; x.fillText(icons[n.kind], px, py); }
  // jogadores
  for (const id in G.players) {
    const e = G.players[id]; if (!e.visible && id !== G.myId) continue;
    const [px, py] = P(e.rx, e.ry), me = id === G.myId;
    x.beginPath(); x.arc(px, py, me ? 6 : 4.5, 0, 7); x.fillStyle = me ? '#c8281e' : '#2a5ab8'; x.fill(); x.lineWidth = 1.5; x.strokeStyle = '#f4e8c8'; x.stroke();
    x.font = '600 11px "Alegreya Sans SC", sans-serif'; x.fillStyle = '#2a1a0a'; x.fillText(e.name, px, py - 12);
  }
}

// portões: abrem sozinhos quando alguém se aproxima e fecham depois
function updateGates(dt) {
  G.gateF = G.gateF || WORLD.gates.map(() => 0);
  WORLD.gates.forEach((gt, k) => {
    const cx = (gt.x0 + gt.x1) / 2, cy = gt.y;
    let near = false;
    for (const id in G.players) { const e = G.players[id]; if ((e.visible || id === G.myId) && (e.z || 0) < 0.5 && Math.abs(e.rx - cx) < 4 + (gt.x1 - gt.x0) / 2 && Math.abs(e.ry - cy) < 4.5) near = true; }
    const tgt = near ? 1 : 0;
    G.gateF[k] = clamp(G.gateF[k] + Math.sign(tgt - G.gateF[k]) * dt / 0.9, 0, 1);
  });
}

// ============================================================
//  MENU DE PAUSA E CONFIGURAÇÕES
// ============================================================
function applySettings() {
  canvas.style.filter = SET.bright !== 1 ? 'brightness(' + SET.bright + ')' : '';
  if (typeof S3 !== 'undefined' && S3.ok) S3.renderer.shadowMap.enabled = SET.quality !== 'low';
  for (const b of document.querySelectorAll('#pz-quality button')) b.classList.toggle('on', b.dataset.q === SET.quality);
  $('pz-bright').value = SET.bright; $('pz-bright-v').textContent = Math.round(SET.bright * 100) + '%';
  $('pz-zoom').value = SET.zoom; $('pz-zoom-v').textContent = Math.round(SET.zoom * 100) + '%';
  document.documentElement.style.setProperty('--pad', SET.pad); $('pz-pad').value = SET.pad; $('pz-pad-v').textContent = Math.round(SET.pad * 100) + '%';
}
$('pz-pad').addEventListener('input', e => { SET.pad = +e.target.value; saveSettings(); applySettings(); });
function togglePause(force) {
  G.paused = force != null ? force : !G.paused;
  $('pause').classList.toggle('hidden', !G.paused);
  if (G.paused) { applySettings(); G.keys.clear(); updateHud(); const z = ZONES[zoneAt(G.me.x, G.me.y)]; $('zone-name').textContent = z.name + (G.me.fl > 0 ? ' · andar ' + (G.me.fl + 1) : G.me.z >= 0.5 ? ' · Muralhas' : ''); $('zone-stars').textContent = z.stars ? '★'.repeat(z.stars) + '☆'.repeat(4 - z.stars) : 'Zona protegida'; }
}
$('btn-menu').addEventListener('click', () => togglePause());
$('pz-resume').addEventListener('click', () => togglePause(false));
for (const b of document.querySelectorAll('#pz-quality button')) b.addEventListener('click', () => {
  if (SET.quality === b.dataset.q) return;
  SET.quality = b.dataset.q; saveSettings(); resize();
  if (typeof SC3 !== 'undefined') { SC3.clear(); S3.px = 0; }   // refaz o cenário na qualidade nova
  applySettings();
});
$('pz-bright').addEventListener('input', e => { SET.bright = +e.target.value; saveSettings(); applySettings(); });
$('pz-zoom').addEventListener('input', e => { SET.zoom = +e.target.value; saveSettings(); G.zoomUser = false; resize(); applySettings(); });
$('pz-full').addEventListener('click', () => { if (document.fullscreenElement) document.exitFullscreen(); else (document.documentElement.requestFullscreen || (() => { })).call(document.documentElement); });
$('pz-quit').addEventListener('click', () => { try { saveChar(); saveFog && G.fog && saveFog(); } catch (e) { } location.reload(); });
applySettings();

// subir/descer andando pelos degraus: segue os pontos (x, y, altura em andares) e no fim troca de andar com um esmaecimento cruzado
function startClimb(now, bi, from, to, pts, dest) {
  let len = 0; for (let k = 1; k < pts.length; k++) len += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
  G.climbing = { t0: now, dur: Math.max(600, len / (PLAYER_SPEED * 0.6) * 1000), bi, from, to, pts, len, dest };
  G.path = null; G.pathGoal = null; if (G.me.sit) standUp(); G.me.emote = null;
}
function stepClimb(now) {
  const c = G.climbing, me = G.me, k = Math.min(1, (now - c.t0) / c.dur);
  let d = k * c.len, p = c.pts[c.pts.length - 1];
  for (let i = 1; i < c.pts.length; i++) { const a = c.pts[i - 1], b = c.pts[i], sl = Math.hypot(b[0] - a[0], b[1] - a[1]); if (d <= sl || i === c.pts.length - 1) { const t = sl ? Math.min(1, d / sl) : 1; p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; if (sl > 0.01) me.dir = dirFromVec(b[0] - a[0], b[1] - a[1], me.dir); break; } d -= sl; }
  const ox = me.x, oy = me.y; me.x = me.rx = p[0]; me.y = me.ry = p[1]; me.lift = p[2]; me.walking = true; me.walkDist += Math.hypot(me.x - ox, me.y - oy);
  if (k < 1) return;
  // no topo: a tela escurece rapidinho e ele aparece em frente aos degraus, no outro andar
  me.walking = false;
  if (!c.fading) { c.fading = now; fadeFlash(); return; }
  if (now - c.fading < 270) return;
  G.climbing = null; me.lift = 0; me.fl = c.to; me.fb = c.to > 0 ? c.bi : -1;
  me.x = me.rx = c.dest[0]; me.y = me.ry = c.dest[1];
  G.climbT = now + 500; G.floorWait = now + 1200;
  Net.send({ t: 'floor', b: c.bi, to: c.to });
}
// escurece a tela rapidinho (subir/descer a torre)
function fadeFlash() {
  let f = document.getElementById('fade'); if (!f) { f = document.createElement('div'); f.id = 'fade'; f.style.cssText = 'position:fixed;inset:0;z-index:20;background:#000;opacity:0;pointer-events:none;transition:opacity .25s'; document.body.appendChild(f); }
  f.style.opacity = 1; setTimeout(() => { f.style.opacity = 0; }, 330);
}
// ============================================================
//  PREPARAR A CIDADE (tela de carregamento): fotografa todos os
//  prédios, muralhas e torres uma vez só; depois nada trava.
// ============================================================
function prebakeCity(done) {
  if (typeof S3 === 'undefined' || !S3.ok) { done && done(); return; }
  const jobs = [], seen = new Set(), X0 = CASTLE.x0 - 6, X1 = CASTLE.x1 + 6, Y0 = CASTLE.y0 - 6, Y1 = CASTLE.y1 + 6;
  for (const b of BUILDINGS) { const k = archKey(b) + (b.door || 'S'); if (!seen.has(k)) { seen.add(k); jobs.push(() => { const sp = buildingSprite(b, false); if (sp) { maskOf(sp); silhouette(sp); } }); } }
  for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) {
    if (!inBounds(x, y)) continue;
    const i = y * MAP_W + x, o = WORLD.obj[i];
    if (o === O.TOWER) jobs.push(() => { const sp = towerSprite(WORLD.tvar[i], WORLD.toff[i]); if (sp) { maskOf(sp); silhouette(sp); } });
    else if (o !== O.NONE && o !== O.PART && !FLAT.has(o)) jobs.push(() => { const sp = objSprite(o, x, y); if (sp && sp.h > 60) { maskOf(sp); silhouette(sp); } });
  }
  WORLD.gates.forEach((gt, gi) => { for (let q = 0; q <= 4; q++) jobs.push(() => scen3('gh|' + gi + '|' + q, () => mGateHouse(gt, q / 4))); });
  const ov = document.createElement('div'); ov.id = 'prebake';
  ov.innerHTML = '<div class="pb-box"><div class="pb-title">Preparando Sxan</div><div class="pb-bar"><div id="pb-fill"></div></div><div class="pb-txt" id="pb-txt">0%</div></div>';
  document.body.appendChild(ov);
  const total = jobs.length; let k = 0;
  S3.pinning = true;
  (function step() {
    const t0 = performance.now();
    while (k < total && performance.now() - t0 < 30) { S3.budget = 1e9; try { jobs[k](); } catch (e) { console.warn(e); } k++; }
    const pc = Math.round(k / total * 100); document.getElementById('pb-fill').style.width = pc + '%'; document.getElementById('pb-txt').textContent = pc + '%';
    if (k < total) requestAnimationFrame(step);
    else { S3.pinning = false; ov.style.opacity = 0; setTimeout(() => ov.remove(), 400); done && done(); }
  })();
}

// ============================================================
//  RODA DE EMOJIS (segurar T, soltar sobre um): saudar, dançar, apontar
// ============================================================
const EMOTES = [{ k: 'salute', n: 'Saudar', i: '✋' }, { k: 'dance', n: 'Dançar', i: '💃' }, { k: 'point', n: 'Apontar', i: '👉' }];
(function () {
  const w = document.createElement('div'); w.id = 'emote-wheel'; w.className = 'hidden';
  w.innerHTML = EMOTES.map((e, i) => '<div class="ew-opt" data-i="' + i + '" style="--a:' + (i * 120 - 90) + 'deg"><span>' + e.i + '</span><b>' + e.n + '</b></div>').join('') + '<div class="ew-hint">solte sobre um emoji</div>';
  document.body.appendChild(w);
  const st = document.createElement('style');
  st.textContent = '#emote-wheel{position:fixed;left:50%;top:50%;width:0;height:0;z-index:30}#emote-wheel.hidden{display:none}#emote-wheel .ew-opt{position:absolute;width:86px;height:86px;margin:-43px;border-radius:50%;transform:rotate(var(--a)) translate(105px) rotate(calc(-1 * var(--a)));background:radial-gradient(#3a2e22ee,#14100cee);box-shadow:0 0 0 2px #8a6a2a;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#f0d890;font:700 12px Cinzel,serif;cursor:pointer;transition:transform .1s,box-shadow .1s}#emote-wheel .ew-opt span{font-size:30px}#emote-wheel .ew-opt.on{box-shadow:0 0 0 3px #f0d890,0 0 18px #f0c060;transform:rotate(var(--a)) translate(105px) rotate(calc(-1 * var(--a))) scale(1.12)}#emote-wheel .ew-hint{position:absolute;left:-90px;width:180px;top:150px;text-align:center;font:italic 13px Alegreya,serif;color:#e8dcc0;text-shadow:0 1px 3px #000}#btn-emote{position:fixed;top:316px;right:12px;z-index:5;width:36px;height:36px;border-radius:50%;border:0;font-size:18px;cursor:pointer;background:radial-gradient(#3a302a,#141010);box-shadow:0 0 0 1px #000,0 0 0 3px #8a6a2a;display:none}body.touch #btn-emote{display:block}';
  document.head.appendChild(st);
  const btn = document.createElement('button'); btn.id = 'btn-emote'; btn.textContent = '☺'; btn.title = 'Emojis (T)'; document.body.appendChild(btn);
  btn.addEventListener('click', () => { if (G.wheel) closeEmoteWheel(false); else { openEmoteWheel(); G.wheel.tap = true; } });
  w.querySelectorAll('.ew-opt').forEach(o => o.addEventListener('click', () => { G.wheel && (G.wheel.sel = +o.dataset.i); closeEmoteWheel(true); }));
  window.addEventListener('mousemove', e => {
    if (!G.wheel) return;
    const dx = e.clientX - innerWidth / 2, dy = e.clientY - innerHeight / 2;
    if (Math.hypot(dx, dy) < 40) { G.wheel.sel = -1; } else { const a = (Math.atan2(dy, dx) * 180 / Math.PI + 90 + 360 + 60) % 360; G.wheel.sel = Math.floor(a / 120); }
    w.querySelectorAll('.ew-opt').forEach(o => o.classList.toggle('on', +o.dataset.i === G.wheel.sel));
  });
})();
function openEmoteWheel() { if (!G.started || G.me.downed) return; G.wheel = { sel: -1 }; $('emote-wheel').classList.remove('hidden'); }
function closeEmoteWheel(fire) {
  const wl = G.wheel; G.wheel = null; $('emote-wheel').classList.add('hidden');
  document.querySelectorAll('#emote-wheel .ew-opt').forEach(o => o.classList.remove('on'));
  if (fire && wl && wl.sel >= 0) { const k = EMOTES[wl.sel].k; if (G.me.sit) standUp(); G.me.emote = { k, t0: performance.now() }; Net.send({ t: 'emote', k }); }
}
