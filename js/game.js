// ============================================================
//  JOGO — regras, monstros, combate e controles.
//  A parte "S" (servidor) só roda no navegador de quem criou a sala.
//  A parte "G" (cliente) roda em todo mundo, inclusive no host.
// ============================================================
const STEP_MS = 230;        // tempo para andar 1 tile
const ATK_MS = 1000;        // intervalo do ataque corpo a corpo
const FIRE_CD = 3000, HEAL_CD = 5000;
const MAX_MON = 70;

const MON = {
  rat:      { name: 'Rato',      hp: 14,  dmg: [1, 3],  xp: 6,   speed: 650, atk: 1400 },
  slime:    { name: 'Gosma',     hp: 26,  dmg: [2, 5],  xp: 12,  speed: 800, atk: 1500 },
  wolf:     { name: 'Lobo',      hp: 45,  dmg: [4, 9],  xp: 25,  speed: 420, atk: 1200 },
  skeleton: { name: 'Esqueleto', hp: 80,  dmg: [6, 13], xp: 50,  speed: 600, atk: 1300 },
  orc:      { name: 'Orc',       hp: 140, dmg: [9, 19], xp: 100, speed: 520, atk: 1300 },
};

const need = l => Math.floor(20 * Math.pow(l, 1.7));   // xp para passar de nível
const maxHpFor = l => 90 + 15 * l;
const cheb = (ax, ay, bx, by) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));
const rint = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];

// ============================================================
//  SERVIDOR (host)
// ============================================================
const S = { players: {}, monsters: {}, nextMid: 1, nextSpawn: 0, lastRegen: 0, filled: false };

function pub(p) { return { id: p.id, name: p.name, color: p.color, x: p.x, y: p.y, hp: p.hp, maxHp: p.maxHp, lvl: p.lvl, xp: p.xp }; }
function monList() { return Object.values(S.monsters).map(m => [m.id, m.type, m.x, m.y, m.hp]); }
function sendStat(p) { Net.toAll({ t: 'pstat', id: p.id, hp: p.hp, maxHp: p.maxHp, lvl: p.lvl, xp: p.xp }); }
function sfx(x, y, text, color) { Net.toAll({ t: 'fx', x, y, text: String(text), color }); }
function sys(text) { Net.toAll({ t: 'chat', name: '', text }); }

function townSpot() {
  for (let i = 0; i < 60; i++) {
    const x = CENTER + rint(-4, 4), y = CENTER + rint(-4, 4);
    if (walkable(x, y)) return { x, y };
  }
  return { x: CENTER + 2, y: CENTER + 2 };
}

function occupied(x, y, self) {
  for (const id in S.monsters) { const m = S.monsters[id]; if (m !== self && m.x === x && m.y === y) return true; }
  for (const id in S.players) { const p = S.players[id]; if (p.x === x && p.y === y) return true; }
  return false;
}
function monCanStand(x, y, m) { return walkable(x, y) && !inSafe(x, y) && !occupied(x, y, m); }

function spawnMonster() {
  const x = rint(2, MAP_W - 3), y = rint(2, MAP_H - 3);
  const d = cheb(x, y, CENTER, CENTER);
  if (d < SAFE_R + 4 || !monCanStand(x, y, null)) return false;
  for (const id in S.players) if (cheb(x, y, S.players[id].x, S.players[id].y) < 9) return false;
  const type = d < 16 ? pick(['rat', 'rat', 'slime'])
    : d < 25 ? pick(['slime', 'wolf', 'rat'])
    : d < 34 ? pick(['wolf', 'skeleton'])
    : pick(['skeleton', 'orc', 'orc']);
  const id = S.nextMid++;
  S.monsters[id] = { id, type, x, y, homeX: x, homeY: y, hp: MON[type].hp, nextMove: 0, nextAtk: 0 };
  return true;
}

function hostOnClient(from, m) {
  const p = S.players[from];
  if (m.t === 'hello') {
    if (p) return;
    const lvl = Math.max(1, Math.min(300, m.lvl | 0 || 1));
    const xp = Math.max(0, Math.min(need(lvl) - 1, m.xp | 0));
    const s = townSpot();
    const np = {
      id: from, name: String(m.name || 'Aventureiro').slice(0, 16),
      color: /^#[0-9a-f]{6}$/i.test(m.color) ? m.color : '#3b82f6',
      x: s.x, y: s.y, lvl, xp, maxHp: maxHpFor(lvl), hp: maxHpFor(lvl),
      target: null, nextAtk: 0, nextFire: 0, nextHeal: 0,
    };
    S.players[from] = np;
    Net.toOne(from, { t: 'welcome', you: from, players: Object.values(S.players).map(pub), monsters: monList() });
    Net.toOthers({ t: 'pjoin', p: pub(np) }, from);
    sys(`${np.name} entrou no mundo.`);
    return;
  }
  if (!p) return;
  switch (m.t) {
    case 'move':
      if (Number.isInteger(m.x) && Number.isInteger(m.y) && walkable(m.x, m.y) && cheb(p.x, p.y, m.x, m.y) <= 1) {
        p.x = m.x; p.y = m.y;
        Net.toOthers({ t: 'pmove', id: from, x: p.x, y: p.y }, from);
      } else {
        Net.toOne(from, { t: 'pmove', id: from, x: p.x, y: p.y, tp: 1 });
      }
      break;
    case 'target':
      p.target = m.id && S.monsters[m.id] ? m.id : null;
      break;
    case 'chat': {
      const text = String(m.text || '').slice(0, 140).trim();
      if (text) Net.toAll({ t: 'chat', id: from, name: p.name, text });
      break;
    }
    case 'spell':
      castSpell(p, m.s);
      break;
  }
}

function hostOnLeave(id) {
  const p = S.players[id];
  if (!p) return;
  delete S.players[id];
  Net.toAll({ t: 'pleave', id });
  sys(`${p.name} saiu.`);
}

function castSpell(p, s) {
  const now = Date.now();
  if (s === 'heal') {
    if (now < p.nextHeal) return;
    p.nextHeal = now + HEAL_CD;
    const h = Math.min(p.maxHp - p.hp, 20 + p.lvl * 5);
    p.hp += h;
    sfx(p.x, p.y, `+${h}`, '#4ade80');
    sendStat(p);
  } else if (s === 'fire') {
    const m = S.monsters[p.target];
    if (now < p.nextFire || !m || inSafe(p.x, p.y) || cheb(p.x, p.y, m.x, m.y) > 5) return;
    p.nextFire = now + FIRE_CD;
    Net.toAll({ t: 'proj', x1: p.x, y1: p.y, x2: m.x, y2: m.y });
    damageMonster(m, p, rint(6 + p.lvl * 2, 12 + p.lvl * 3));
  }
}

function damageMonster(m, p, dmg) {
  m.hp -= dmg;
  sfx(m.x, m.y, dmg, '#fde047');
  if (m.hp > 0) return;
  delete S.monsters[m.id];
  Net.toAll({ t: 'mdie', id: m.id, x: m.x, y: m.y });
  for (const id in S.players) if (S.players[id].target === m.id) S.players[id].target = null;
  gainXp(p, MON[m.type].xp);
}

function gainXp(p, amount) {
  p.xp += amount;
  sfx(p.x, p.y, `+${amount} xp`, '#c4b5fd');
  while (p.xp >= need(p.lvl)) {
    p.xp -= need(p.lvl);
    p.lvl++;
    p.maxHp = maxHpFor(p.lvl);
    p.hp = p.maxHp;
    sfx(p.x, p.y, 'LEVEL UP!', '#facc15');
    sys(`${p.name} avançou para o nível ${p.lvl}!`);
  }
  sendStat(p);
}

function damagePlayer(p, dmg, m) {
  p.hp -= dmg;
  sfx(p.x, p.y, dmg, '#f87171');
  if (p.hp > 0) { sendStat(p); return; }
  sys(`${p.name} foi derrotado por um ${MON[m.type].name}.`);
  p.xp = Math.floor(p.xp / 2);
  p.hp = p.maxHp;
  p.target = null;
  const s = townSpot();
  p.x = s.x; p.y = s.y;
  Net.toAll({ t: 'pmove', id: p.id, x: p.x, y: p.y, tp: 1 });
  Net.toOne(p.id, { t: 'died' });
  sendStat(p);
}

function stepToward(m, tx, ty) {
  const cur = cheb(m.x, m.y, tx, ty);
  let best = null, bestScore = Infinity;
  for (const [dx, dy] of DIRS8) {
    const nx = m.x + dx, ny = m.y + dy;
    if (!monCanStand(nx, ny, m)) continue;
    const d = cheb(nx, ny, tx, ty);
    if (d > cur) continue;
    const score = d * 10 + Math.hypot(nx - tx, ny - ty) + Math.random() * 0.5;
    if (score < bestScore) { bestScore = score; best = [nx, ny]; }
  }
  if (best) { m.x = best[0]; m.y = best[1]; }
}

function hostTick() {
  const now = Date.now();
  const players = Object.values(S.players);

  // nascer monstros (no começo enche tudo, depois 1 a cada 2s)
  if (!S.filled) {
    for (let i = 0; i < 3000 && Object.keys(S.monsters).length < MAX_MON; i++) spawnMonster();
    S.filled = true;
  } else if (now >= S.nextSpawn && Object.keys(S.monsters).length < MAX_MON) {
    for (let i = 0; i < 40; i++) if (spawnMonster()) break;
    S.nextSpawn = now + 2000;
  }

  // ataques corpo a corpo dos jogadores
  for (const p of players) {
    if (!p.target) continue;
    const m = S.monsters[p.target];
    if (!m) { p.target = null; continue; }
    if (now >= p.nextAtk && cheb(p.x, p.y, m.x, m.y) <= 1 && !inSafe(p.x, p.y)) {
      p.nextAtk = now + ATK_MS;
      damageMonster(m, p, rint(2 + p.lvl, 6 + p.lvl * 2));
    }
  }

  // inteligência dos monstros
  for (const m of Object.values(S.monsters)) {
    const d = MON[m.type];
    let tgt = null, best = 99;
    for (const p of players) {
      if (inSafe(p.x, p.y)) continue;
      const dist = cheb(m.x, m.y, p.x, p.y);
      if (dist <= 7 && dist < best) { best = dist; tgt = p; }
    }
    if (tgt) {
      if (best <= 1) {
        if (now >= m.nextAtk) { m.nextAtk = now + d.atk; damagePlayer(tgt, rint(d.dmg[0], d.dmg[1]), m); }
      } else if (now >= m.nextMove) {
        stepToward(m, tgt.x, tgt.y);
        m.nextMove = now + d.speed;
        m.nextAtk = Math.max(m.nextAtk, now + 300);
      }
    } else if (now >= m.nextMove) {
      m.nextMove = now + d.speed * (2 + Math.random() * 4);
      const [dx, dy] = pick(DIRS8);
      const nx = m.x + dx, ny = m.y + dy;
      if (monCanStand(nx, ny, m) && cheb(nx, ny, m.homeX, m.homeY) <= 6) { m.x = nx; m.y = ny; }
    }
  }

  // regeneração de vida (mais rápida na cidade)
  if (now - S.lastRegen >= 1000) {
    S.lastRegen = now;
    for (const p of players) {
      if (p.hp >= p.maxHp) continue;
      p.hp = Math.min(p.maxHp, p.hp + (inSafe(p.x, p.y) ? 4 + p.lvl : 1));
      sendStat(p);
    }
  }

  Net.toAll({ t: 'mstate', l: monList() });
}

// Timer num Web Worker: continua rodando mesmo com a aba do host em segundo plano
function startHostLoop() {
  try {
    const src = 'setInterval(() => postMessage(0), 100);';
    const w = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
    w.onmessage = hostTick;
  } catch (e) {
    setInterval(hostTick, 100);
  }
}

// ============================================================
//  CLIENTE (todo mundo)
// ============================================================
const G = {
  myId: null, me: null, players: {}, monsters: {}, fx: [], projs: [],
  target: null, path: null, hover: null, keys: new Set(), cd: { fire: 0, heal: 0 }, started: false,
};

function mkEnt(o) {
  return Object.assign({ rx: o.x, ry: o.y, fromX: o.x, fromY: o.y, moveStart: 0, dur: 1, face: 1, walking: false, say: null, sayUntil: 0, nextMove: 0 }, o);
}
function moveEnt(e, x, y, dur) {
  if (cheb(e.x, e.y, x, y) > 2) { // teletransporte
    e.x = e.rx = e.fromX = x; e.y = e.ry = e.fromY = y; e.dur = 1; return;
  }
  const sdx = (x - y) - (e.x - e.y);
  if (sdx) e.face = sdx > 0 ? 1 : -1;
  e.fromX = e.rx; e.fromY = e.ry; e.x = x; e.y = y;
  e.moveStart = performance.now(); e.dur = dur;
}
function interp(e, now) {
  const t = Math.min(1, (now - e.moveStart) / e.dur);
  e.rx = e.fromX + (e.x - e.fromX) * t;
  e.ry = e.fromY + (e.y - e.fromY) * t;
  e.walking = t < 1;
}

function applyMonsters(list) {
  const seen = new Set();
  for (const [id, type, x, y, hp] of list) {
    seen.add(id);
    const e = G.monsters[id];
    if (!e) G.monsters[id] = mkEnt({ id, type, x, y, hp, maxHp: MON[type].hp });
    else {
      if (e.x !== x || e.y !== y) moveEnt(e, x, y, MON[type].speed);
      e.hp = hp;
    }
  }
  for (const id in G.monsters) if (!seen.has(+id)) delete G.monsters[id];
  if (G.target && !G.monsters[G.target]) setTarget(null);
}

function clientOnServer(m) {
  const now = performance.now();
  switch (m.t) {
    case 'welcome':
      G.myId = m.you;
      G.players = {};
      for (const p of m.players) G.players[p.id] = mkEnt(p);
      G.me = G.players[G.myId];
      G.monsters = {};
      applyMonsters(m.monsters);
      startGame();
      break;
    case 'pjoin': G.players[m.p.id] = mkEnt(m.p); break;
    case 'pleave': delete G.players[m.id]; break;
    case 'pmove': {
      const e = G.players[m.id];
      if (!e) break;
      if (m.id === G.myId) {
        if (m.tp) { e.x = e.rx = e.fromX = m.x; e.y = e.ry = e.fromY = m.y; G.path = null; }
      } else moveEnt(e, m.x, m.y, STEP_MS);
      break;
    }
    case 'pstat': {
      const e = G.players[m.id];
      if (!e) break;
      Object.assign(e, { hp: m.hp, maxHp: m.maxHp, lvl: m.lvl, xp: m.xp });
      if (m.id === G.myId) { saveChar(); updateHud(); }
      break;
    }
    case 'mstate': applyMonsters(m.l); break;
    case 'mdie':
      delete G.monsters[m.id];
      if (G.target === m.id) setTarget(null);
      break;
    case 'fx':
      G.fx.push({ x: m.x, y: m.y, text: m.text, color: m.color, t0: now, dx: (Math.random() - 0.5) * 16 });
      break;
    case 'proj': G.projs.push({ ...m, t0: now }); break;
    case 'chat': {
      addChat(m.name, m.text);
      const e = m.id && G.players[m.id];
      if (e) { e.say = m.text; e.sayUntil = now + 4500; }
      break;
    }
    case 'died':
      showToast('Você foi derrotado! Voltou para a cidade e perdeu metade da experiência do nível.');
      setTarget(null);
      break;
  }
}

// ---------- movimento local ----------
function monsterAt(x, y) {
  for (const id in G.monsters) { const m = G.monsters[id]; if (m.x === x && m.y === y) return m; }
  return null;
}
function canWalk(x, y) { return walkable(x, y) && !monsterAt(x, y); }

function tryStep(dx, dy, now) {
  const me = G.me;
  const opts = [[dx, dy]];
  if (dx && dy) opts.push([dx, 0], [0, dy]);
  for (const [ax, ay] of opts) {
    const nx = me.x + ax, ny = me.y + ay;
    if (!canWalk(nx, ny)) continue;
    moveEnt(me, nx, ny, STEP_MS);
    me.nextMove = now + STEP_MS;
    Net.send({ t: 'move', x: nx, y: ny });
    return true;
  }
  return false;
}

// Busca em largura: menor caminho até um tile que satisfaça isGoal
function findPath(sx, sy, isGoal, maxNodes = 4000) {
  const key = (x, y) => y * MAP_W + x;
  const prev = new Map([[key(sx, sy), -1]]);
  const queue = [[sx, sy]];
  for (let qi = 0; qi < queue.length && qi < maxNodes; qi++) {
    const [x, y] = queue[qi];
    if (isGoal(x, y) && !(x === sx && y === sy)) {
      const path = [];
      let k = key(x, y);
      while (k !== key(sx, sy)) { path.push({ x: k % MAP_W, y: Math.floor(k / MAP_W) }); k = prev.get(k); }
      return path.reverse();
    }
    for (const [dx, dy] of DIRS8) {
      const nx = x + dx, ny = y + dy, k = key(nx, ny);
      if (prev.has(k) || !canWalk(nx, ny)) continue;
      prev.set(k, key(x, y));
      queue.push([nx, ny]);
    }
  }
  return null;
}

function updateLocal(now) {
  const me = G.me;
  if (now < me.nextMove) return;
  let dx = 0, dy = 0;
  const k = G.keys;
  // direções da TELA convertidas para o mapa isométrico
  if (k.has('w') || k.has('arrowup')) { dx -= 1; dy -= 1; }
  if (k.has('s') || k.has('arrowdown')) { dx += 1; dy += 1; }
  if (k.has('a') || k.has('arrowleft')) { dx -= 1; dy += 1; }
  if (k.has('d') || k.has('arrowright')) { dx += 1; dy -= 1; }
  dx = Math.sign(dx); dy = Math.sign(dy);
  if (dx || dy) { G.path = null; tryStep(dx, dy, now); return; }

  if (G.path && G.path.length) {
    const n = G.path.shift();
    if (cheb(n.x, n.y, me.x, me.y) !== 1 || !tryStep(n.x - me.x, n.y - me.y, now) || me.x !== n.x || me.y !== n.y) G.path = null;
    return;
  }
  // perseguir o alvo até ficar do lado
  const t = G.target && G.monsters[G.target];
  if (t && cheb(me.x, me.y, t.x, t.y) > 1 && cheb(me.x, me.y, t.x, t.y) < 15) {
    const p = findPath(me.x, me.y, (x, y) => cheb(x, y, t.x, t.y) <= 1, 1500);
    if (p && p.length) tryStep(p[0].x - me.x, p[0].y - me.y, now);
    else me.nextMove = now + 200;
  }
}

function setTarget(id) {
  if (G.target === id) return;
  G.target = id;
  Net.send({ t: 'target', id });
}

function castLocal(s) {
  const now = performance.now();
  if (s === 'fire') {
    const t = G.target && G.monsters[G.target];
    if (!t) { showToast('Selecione um monstro primeiro (clique nele).'); return; }
    if (cheb(G.me.x, G.me.y, t.x, t.y) > 5) { showToast('Alvo muito longe (máximo 5 tiles).'); return; }
    if (inSafe(G.me.x, G.me.y)) { showToast('Não é possível atacar dentro da cidade.'); return; }
    if (now < G.cd.fire) return;
    G.cd.fire = now + FIRE_CD;
  } else {
    if (now < G.cd.heal) return;
    G.cd.heal = now + HEAL_CD;
  }
  Net.send({ t: 'spell', s });
}

// ---------- salvar personagem no navegador ----------
function saveChar() {
  const me = G.me;
  try { localStorage.setItem('eldmar-char', JSON.stringify({ name: me.name, color: me.color, lvl: me.lvl, xp: me.xp })); } catch (e) { }
}
function loadChar() {
  try { return JSON.parse(localStorage.getItem('eldmar-char')) || {}; } catch (e) { return {}; }
}

// ============================================================
//  INTERFACE
// ============================================================
const $ = id => document.getElementById(id);
const canvas = $('game'), ctx = canvas.getContext('2d');
const mini = $('minimap'), mctx = mini.getContext('2d');
let W = 0, H = 0;

function resize() {
  const dpr = window.devicePixelRatio || 1;
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = W * dpr; canvas.height = H * dpr;
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);

function updateHud() {
  const me = G.me;
  if (!me) return;
  $('hud-name').textContent = me.name;
  $('hud-lvl').textContent = `Nível ${me.lvl}`;
  $('hp-fill').style.width = (100 * me.hp / me.maxHp) + '%';
  $('hp-text').textContent = `${me.hp} / ${me.maxHp}`;
  $('xp-fill').style.width = (100 * me.xp / need(me.lvl)) + '%';
  $('xp-text').textContent = `${me.xp} / ${need(me.lvl)} xp`;
}

function addChat(name, text) {
  const log = $('chat-log');
  const line = document.createElement('div');
  if (name) {
    const b = document.createElement('b'); b.textContent = name + ': ';
    line.appendChild(b);
    line.appendChild(document.createTextNode(text));
  } else {
    line.className = 'sys'; line.textContent = text;
  }
  log.appendChild(line);
  while (log.children.length > 60) log.firstChild.remove();
  log.scrollTop = log.scrollHeight;
}

let toastTimer = 0;
function showToast(text) {
  const t = $('toast');
  t.textContent = text; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
}

function screenToTile(mx, my) {
  const f = unIso(mx - G.view.ox, my - G.view.oy);
  return { x: Math.round(f.x), y: Math.round(f.y) };
}
function monsterUnderMouse(mx, my) {
  let found = null, bestD = Infinity;
  for (const id in G.monsters) {
    const e = G.monsters[id], p = iso(e.rx, e.ry);
    const sx = p.sx + G.view.ox, sy = p.sy + G.view.oy;
    if (mx > sx - 18 && mx < sx + 18 && my > sy - 44 && my < sy + 8) {
      const d = e.x + e.y;
      if (found === null || d > bestD) { found = e; bestD = d; }
    }
  }
  return found;
}

canvas.addEventListener('mousemove', e => { if (G.started) G.hover = screenToTile(e.clientX, e.clientY); });
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('mousedown', e => {
  if (!G.started) return;
  $('chat-input').blur();
  const mon = monsterUnderMouse(e.clientX, e.clientY);
  if (mon) { setTarget(G.target === mon.id ? null : mon.id); G.path = null; return; }
  if (e.button !== 0) return;
  const t = screenToTile(e.clientX, e.clientY);
  if (!canWalk(t.x, t.y)) return;
  G.path = findPath(G.me.x, G.me.y, (x, y) => x === t.x && y === t.y);
});

window.addEventListener('keydown', e => {
  if (!G.started) return;
  const input = $('chat-input');
  if (document.activeElement === input) {
    if (e.key === 'Enter') {
      const text = input.value.trim();
      if (text) Net.send({ t: 'chat', text });
      input.value = ''; input.blur();
    } else if (e.key === 'Escape') input.blur();
    return;
  }
  const k = e.key.toLowerCase();
  if (k === 'enter') { input.focus(); e.preventDefault(); return; }
  if (k === 'escape') { setTarget(null); G.path = null; return; }
  if (k === '1' || k === 'f') { castLocal('fire'); return; }
  if (k === '2' || k === 'h') { castLocal('heal'); return; }
  if (k === ' ' || k === 'tab') { // espaço/tab: mirar no monstro mais próximo
    e.preventDefault();
    let best = null, bd = 99;
    for (const id in G.monsters) { const m = G.monsters[id], d = cheb(m.x, m.y, G.me.x, G.me.y); if (d < bd) { bd = d; best = m; } }
    if (best && bd <= 8) setTarget(best.id);
    return;
  }
  if (k.startsWith('arrow')) e.preventDefault();
  G.keys.add(k);
});
window.addEventListener('keyup', e => G.keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => G.keys.clear());

function updateCooldowns(now) {
  for (const s of ['fire', 'heal']) {
    const total = s === 'fire' ? FIRE_CD : HEAL_CD;
    const left = Math.max(0, G.cd[s] - now);
    $('cd-' + s).style.height = (100 * left / total) + '%';
  }
}

let lastMini = 0;
function frame() {
  const now = performance.now();
  updateLocal(now);
  for (const id in G.players) interp(G.players[id], now);
  for (const id in G.monsters) interp(G.monsters[id], now);
  renderScene(ctx, W, H, now);
  updateCooldowns(now);
  if (now - lastMini > 200) { lastMini = now; renderMinimap(mctx, mini.width); }
  $('hud-zone').textContent = inSafe(G.me.x, G.me.y) ? 'Cidade (zona protegida)' : 'Zona de caça';
  requestAnimationFrame(frame);
}

function startGame() {
  if (G.started) return;
  G.started = true;
  $('lobby').classList.add('hidden');
  $('hud').classList.remove('hidden');
  resize();
  updateHud();
  addChat('', 'Bem-vindo a Eldmar! Clique nos monstros para atacar. Enter abre o chat.');
  requestAnimationFrame(frame);
}

// ============================================================
//  LOBBY (tela inicial)
// ============================================================
function randomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function setStatus(text, err) { const s = $('status'); s.textContent = text; s.className = err ? 'err' : ''; }
function lockLobby(b) { for (const el of document.querySelectorAll('#lobby button, #lobby input')) el.disabled = b; }

function helloMsg() {
  const saved = loadChar();
  const name = $('name').value.trim() || 'Aventureiro';
  const sameChar = saved.name === name;
  return { t: 'hello', name, color: $('color').value, lvl: sameChar ? saved.lvl : 1, xp: sameChar ? saved.xp : 0 };
}

function showRoom(code) {
  $('room-code').textContent = Net.offline ? 'offline' : code;
  $('room-box').classList.remove('hidden');
}

function createRoom(code = randomCode(), tries = 0) {
  lockLobby(true);
  setStatus('Criando sala...');
  Net.onClient = hostOnClient;
  Net.onServer = clientOnServer;
  Net.onPeerLeave = hostOnLeave;
  Net.host(code, err => {
    if (err) {
      if (err.type === 'unavailable-id' && tries < 3) { createRoom(randomCode(), tries + 1); return; }
      setStatus('Não foi possível criar a sala: ' + (err.type || err), true);
      lockLobby(false);
      return;
    }
    startHostLoop();
    hostTick();
    showRoom(code);
    Net.send(helloMsg());
  });
}

function joinRoom() {
  const code = $('code').value.trim().toUpperCase();
  if (!code) { setStatus('Digite o código da sala.', true); return; }
  lockLobby(true);
  setStatus('Conectando na sala ' + code + '...');
  Net.onServer = clientOnServer;
  Net.onDisconnected = () => {
    $('disconnected').classList.remove('hidden');
  };
  Net.join(code, err => {
    if (err) {
      const msg = err.type === 'peer-unavailable' ? 'Sala não encontrada. Confira o código (o criador da sala precisa estar com o jogo aberto).'
        : err.type === 'timeout' ? 'Tempo esgotado. A rede de vocês pode estar bloqueando a conexão direta.'
        : err.type === 'no-peerjs' ? 'Não foi possível carregar a biblioteca de rede (sem internet?).'
        : 'Erro: ' + (err.type || err);
      setStatus(msg, true);
      lockLobby(false);
      return;
    }
    showRoom(code);
    Net.send(helloMsg());
  });
}

(function initLobby() {
  const saved = loadChar();
  if (saved.name) $('name').value = saved.name;
  if (saved.color) $('color').value = saved.color;
  if (saved.lvl) $('saved').textContent = `Personagem salvo: ${saved.name} (nível ${saved.lvl})`;
  const urlCode = new URLSearchParams(location.search).get('sala');
  if (urlCode) $('code').value = urlCode.toUpperCase();

  $('btn-create').onclick = () => createRoom();
  $('btn-join').onclick = joinRoom;
  $('code').addEventListener('keydown', e => { if (e.key === 'Enter') joinRoom(); });
  $('btn-copy').onclick = () => {
    const link = location.origin + location.pathname + '?sala=' + Net.room;
    navigator.clipboard.writeText(link).then(() => showToast('Link copiado! Mande para seus amigos.'), () => showToast(link));
  };
})();
