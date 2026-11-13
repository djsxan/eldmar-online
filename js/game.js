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
      Object.assign(G.me, { x: m.x, y: m.y, rx: m.x, ry: m.y, z: 0, visible: true, mp: 0, maxMp: 1, hp: 1, maxHp: 1, quests: {}, qdone: {}, pots: { hp: 0, mp: 0 }, gold: 0, buffs: {}, lastTile: tileAt(m.x, m.y), sendT: 0 });
      startGame();
      break;
    case 'pinfo': { const e = G.players[m.p.id]; if (e) Object.assign(e, m.p); else G.players[m.p.id] = mkEnt({ ...m.p }); break; }
    case 'pleave': delete G.players[m.id]; break;
    case 's': applySnapshot(m, now); break;
    case 'pstat': {
      const e = G.me; if (!e || m.id !== G.myId) break;
      const oldLvl = e.lvl;
      Object.assign(e, { hp: m.hp, maxHp: m.maxHp, mp: m.mp, maxMp: m.maxMp, lvl: m.lvl, xp: m.xp, gold: m.gold, pots: m.pots, combat: m.combat, quests: m.quests, qdone: m.qdone });
      setBuffs(e, m.buffs);
      G.cdEnd = m.cds.map(r => now + r);
      e.downed = m.downed > 0; e.downUntil = now + m.downed;
      saveChar(); updateHud(); updateQuests();
      if (oldLvl && m.lvl > oldLvl) showBanner(`Nível ${m.lvl}`, 'Sua força cresce.');
      break;
    }
    case 'tp': if (G.me) { Object.assign(G.me, { x: m.x, y: m.y, rx: m.x, ry: m.y, z: +m.z || 0 }); G.path = null; G.pathGoal = null; } break;
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
        G.nums.push({ wx: pos.x, wy: pos.y, text: String(m.dmg), color: m.k === 'm' ? (m.crit ? '#f8d850' : '#ffffff') : (mine ? '#f05040' : '#f0a090'), crit: m.crit, big: m.crit, t0: t, vx: (Math.random() < 0.5 ? -1 : 1) * (0.4 + Math.random() * 0.6) });
        for (let k = 0; k < 6; k++) spawnPart(m.k === 'p' ? 'blood' : 'spark', pos.x, pos.y - 26, { color: 'rgba(255,240,180,A)' });
        if (mine) { G.shake = Math.max(G.shake, 2.5); flashDamage(); }
      });
      break;
    case 'fx': later(m.d, () => { const p = tileW(m.x, m.y); G.nums.push({ wx: p.x, wy: p.y - 24, text: m.text, color: m.color, small: !m.big, big: m.big, t0: performance.now(), vx: 0 }); }); break;
    case 'anim': {
      const e = (m.w === 'p' ? G.players : G.monsters)[m.id];
      if (!e) break;
      e.anim = { a: m.a, t0: now, tx: m.tx, ty: m.ty };
      if (m.tx != null && m.w === 'p' && m.a !== 'spin') e.dir = dirFromVec(m.tx - e.rx, m.ty - e.ry, e.dir);
      if (m.s) { e.shout = m.s; e.shoutUntil = now + 1600; }
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
      if (m.a === 'lvlup') later(m.d, () => { const p = tileW(m.x, m.y); G.nums.push({ wx: p.x, wy: p.y - 44, text: 'LEVEL UP!', color: '#f0d050', big: true, t0: performance.now(), vx: 0 }); });
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
    e.srvDir = dir; e.srvWalk = !!(fl & 1);
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
function freeAt(x, y, z) { return canStandZ(x, y, z, 0.22) && (z >= 0.5 || !monsterNear(x, y)); }

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
  if (document.activeElement && document.activeElement.tagName === 'INPUT') G.keys.clear();
  let v = myInput();
  if (v) { G.path = null; G.pathGoal = null; G.pendingNpc = null; }
  else if (G.path && G.path.length) {
    // segue o caminho, pulando pontos quando há linha livre
    while (G.path.length > 1 && lineFree(me.x, me.y, G.path[1][0], G.path[1][1], me.z)) G.path.shift();
    const [tx, ty] = G.path[0], dx = tx - me.x, dy = ty - me.y, d = Math.hypot(dx, dy);
    if (d < 0.12) { G.path.shift(); if (!G.path.length) { G.path = null; G.pathGoal = null; } }
    else v = [dx / d, dy / d];
  }
  if (me.cast && me.cast.end > now) v = null;
  if (G.pendingNpc && !G.path) { const n = G.npcs[G.pendingNpc]; if (dist(me.x, me.y, n.x, n.y) <= 3) openDialog(n.id); G.pendingNpc = null; }
  let moved = 0;
  if (v) {
    let sp = PLAYER_SPEED;
    if (me.buffs && me.buffs.agile > now) sp *= 1.6;
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
  // rampas: a altura acompanha a posição (sem teletransporte)
  me.z = heightAt(me.x, me.y, me.z);
  // na rampa, centraliza suavemente no degrau
  { const t = tileAt(me.x, me.y), d = WORLD.stair[t]; if (d && moved) { const k = Math.min(1, dt * 10); if (d <= 2) me.y += (Math.round(me.y) - me.y) * k; else me.x += (Math.round(me.x) - me.x) * k; } }
  me.rx = me.x; me.ry = me.y;
  if (now - me.sendT > 100 && (moved || me.walking !== me.sentWalk)) {
    me.sendT = now; me.sentWalk = me.walking;
    Net.send({ t: 'mv', x: Math.round(me.x * 100) / 100, y: Math.round(me.y * 100) / 100, z: Math.round(me.z * 100) / 100, d: me.dir, w: me.walking ? 1 : 0 }, true);
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
  for (const id in G.players) { const e = G.players[id]; if (id === G.myId || !e.downed || !e.visible || e.carriedBy) continue; const d = dist(e.rx, e.ry, G.me.x, G.me.y); if (d < bd) { bd = d; best = e; } }
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
    all[charKey(me.name, me.cls)] = { name: me.name, cls: me.cls, skin: me.skin, color: me.color, lvl: me.lvl, xp: me.xp, gold: me.gold, pots: me.pots, quests: me.quests, qdone: me.qdone, t: Date.now() };
    localStorage.setItem(SAVE_KEY, JSON.stringify(all));
  } catch (e) { }
}

// ============================================================
//  INTERFACE
// ============================================================
const $ = id => document.getElementById(id);
const canvas = $('game'), ctx = canvas.getContext('2d');
const mini = $('minimap'), mctx = mini.getContext('2d');
let W = 0, H = 0, DPR = 1;
function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = W * DPR; canvas.height = H * DPR;
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  if (!G.zoomUser) SCALE = clamp(H / 425, 1.4, 4);
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
  const box = $('quest-list'), me = G.me;
  box.innerHTML = '';
  const act = Object.entries(me.quests || {});
  $('quests').classList.toggle('hidden', !act.length);
  for (const [id, n] of act) {
    const q = QUESTS.find(x => x.id === id); if (!q) continue;
    const d = document.createElement('div');
    const name = document.createElement('b'); name.textContent = q.name;
    const pr = document.createElement('span'); pr.textContent = ` ${n}/${q.count} ${MON[q.mon].name}`;
    d.append(name, pr); box.appendChild(d);
  }
}
function updateTargetFrame() {
  const f = $('target-frame'), t = G.target && G.monsters[G.target];
  if (!t || !G.me) { f.classList.add('hidden'); return; }
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
    ['Poção de Mana — 25 ouro', { a: 'buy', item: 'mp', qty: 1 }], ['5 Poções de Mana — 125 ouro', { a: 'buy', item: 'mp', qty: 5 }]] },
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
  const npc = npcUnderMouse(e.clientX, e.clientY);
  if (npc) {
    if (dist(me.x, me.y, npc.x, npc.y) <= 3) openDialog(npc.id);
    else { G.path = findPath(me.x, me.y, Math.round(npc.x), Math.round(npc.y), me.z, 1); G.pathGoal = G.path ? { x: Math.round(npc.x), y: Math.round(npc.y) } : null; G.pendingNpc = npc.id; }
    return;
  }
  if (e.button !== 0 || me.carriedBy) return;
  const w = screenToWorld(e.clientX, e.clientY), tx = Math.round(w.x), ty = Math.round(w.y);
  if (!walkableTile(tx, ty, me.z)) return;
  G.pendingNpc = null;
  G.path = findPath(me.x, me.y, w.x, w.y, me.z, 0);
  if (G.path && G.path.length) G.path[G.path.length - 1] = [w.x, w.y];
  G.pathGoal = G.path ? { x: tx, y: ty } : null;
});
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  SCALE = clamp(SCALE * (e.deltaY < 0 ? 1.1 : 0.9), 1.1, 4.5);
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
  if (k === 'enter') { input.focus(); e.preventDefault(); return; }
  if (k === 'escape') { if (G.dialog) closeDialog(); else { setTarget(null); G.path = null; G.pathGoal = null; } return; }
  if (k >= '1' && k <= '4') { castSkill(+k - 1); return; }
  if (k === 'q') { drinkPot('hp'); return; }
  if (k === 'e') { drinkPot('mp'); return; }
  if (k === 'r' && G.me.downed) { Net.send({ t: 'giveup' }); return; }
  if (k === 'f' && !e.repeat) { const d = nearestDowned(); if (d) { G.reviving = d.id; Net.send({ t: 'revive', id: d.id, on: true }); } return; }
  if (k === 'g' && !e.repeat) { if (G.me.carrying) Net.send({ t: 'carry' }); else { const d = nearestDowned(); if (d) Net.send({ t: 'carry', id: d.id }); } return; }
  if (k === 'x') { attackNearest(); return; }
  if (k === ' ' || k === 'tab') {
    e.preventDefault();
    let best = null, bd = 99;
    for (const id in G.monsters) { const m = G.monsters[id]; if (m.dieAt) continue; const d = dist(m.rx, m.ry, G.me.x, G.me.y); if (d < bd && m.id !== G.target) { bd = d; best = m; } }
    if (best && bd <= 9) setTarget(best.id);
    return;
  }
  if (k.startsWith('arrow')) e.preventDefault();
  G.keys.add(k);
});
window.addEventListener('keyup', e => {
  const k = e.key.toLowerCase();
  G.keys.delete(k);
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
      renderMinimap(mctx, mini.width);
      const z = ZONES[zoneAt(G.me.x, G.me.y)];
      $('zone-name').textContent = z.name + (G.me.z >= 0.5 ? ' · Muralhas' : '');
      $('zone-stars').textContent = z.stars ? '★'.repeat(z.stars) + '☆'.repeat(4 - z.stars) : 'Zona protegida';
      const d = dayInfo();
      $('daytime').textContent = d.night ? '☾ Noite' : d.dusk > 0.3 ? '◐ Crepúsculo' : '☀ Dia';
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
  addChat('', `Bem-vindo a World of Sxan, ${G.me.name}. Fale com os moradores clicando neles. Enter abre o chat.`);
  showBanner('Cidadela de Eldmar', 'Zona protegida — os monstros não atravessam o fosso.');
}

// tooltips
const tip = $('tooltip');
document.addEventListener('mouseover', e => {
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
  return { t: 'hello', name, color: chosenColor, cls: chosenClass, skin: chosenSkin[chosenClass], lvl: saved.lvl, xp: saved.xp, gold: saved.gold, pots: saved.pots, quests: saved.quests, qdone: saved.qdone };
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
      b.textContent = s.name; b.dataset.tip = `${s.name}\nRaridade: ${s.rarity}`;
      b.onclick = ev => { ev.stopPropagation(); chosenSkin[cls] = s.id; chosenClass = cls; for (const el of skins.children) el.classList.toggle('sel', el === b); selectClass(cls); };
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
    };
    sv.appendChild(b);
  }
  if (!chars.length) sv.classList.add('hidden');
  $('name').addEventListener('input', updateSavedInfo);
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
