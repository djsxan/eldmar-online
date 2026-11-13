// ============================================================
//  CLIENTE — roda em todo mundo (inclusive no host).
//  Recebe o estado do servidor, anima, desenha e lê os controles.
// ============================================================
const G = {
  myId: null, me: null, players: {}, monsters: {}, npcs: {},
  fx: [], nums: [], effects: [], parts: [], lights: [], timers: [], shake: 0,
  target: null, path: null, hover: null, keys: new Set(), cdEnd: [0, 0, 0, 0],
  started: false, view: { ox: 0, oy: 0 }, dialog: null, pendingNpc: null,
};

function mkEnt(o) {
  return Object.assign({ rx: o.x, ry: o.y, fromX: o.x, fromY: o.y, moveStart: 0, dur: 1, face: 1, back: false, walking: false, say: null, sayUntil: 0, nextMove: 0, buffs: {} }, o);
}
for (const n of NPCS) G.npcs[n.id] = mkEnt({ ...n, face: n.x > CENTER ? -1 : 1 });

function lookAt(e, tx, ty) {
  const sdx = (tx - ty) - (e.x - e.y), sdy = (tx + ty) - (e.x + e.y);
  if (sdx) e.face = sdx > 0 ? 1 : -1;
  e.back = sdy < 0;
}
function moveEnt(e, x, y, dur) {
  if (cheb(e.x, e.y, x, y) > 2) { e.x = e.rx = e.fromX = x; e.y = e.ry = e.fromY = y; e.dur = 1; return; }
  lookAt(e, x, y);
  e.fromX = e.rx; e.fromY = e.ry; e.x = x; e.y = y;
  e.moveStart = performance.now(); e.dur = dur;
}
function interp(e, now) {
  const t = Math.min(1, (now - e.moveStart) / e.dur);
  e.rx = e.fromX + (e.x - e.fromX) * t;
  e.ry = e.fromY + (e.y - e.fromY) * t;
  e.walking = t < 1;
}
function later(ms, fn) { if (!ms || ms <= 0) fn(); else G.timers.push({ at: performance.now() + ms, fn }); }

function applyMonsters(list) {
  const seen = new Set();
  for (const [id, type, x, y, hp, flags] of list) {
    seen.add(id);
    const e = G.monsters[id];
    if (!e) G.monsters[id] = mkEnt({ id, type, x, y, hp, maxHp: MON[type].hp, flags, face: Math.random() < 0.5 ? 1 : -1 });
    else {
      if (e.x !== x || e.y !== y) moveEnt(e, x, y, MON[type].speed * (flags & 1 ? 2 : 1));
      e.hp = hp; e.flags = flags;
    }
  }
  for (const id in G.monsters) if (!seen.has(+id) && !G.monsters[id].dieAt) delete G.monsters[id];
  if (G.target && (!G.monsters[G.target] || G.monsters[G.target].dieAt)) setTarget(null);
}

function setBuffs(e, list) {
  const now = performance.now();
  e.buffs = {};
  for (const [k, ms] of list || []) e.buffs[k] = now + ms;
}

const EFFECT_MS = { whirl: 520, warcry: 800, wall: 600, agile: 600, potion: 500, pierce: 500, rain: 900, boom: 500, nova: 700, heal: 1000, lvlup: 1600, meteor: 1600 };

function clientOnServer(m) {
  const now = performance.now();
  switch (m.t) {
    case 'welcome':
      G.myId = m.you;
      G.players = {};
      for (const p of m.players) { G.players[p.id] = mkEnt(p); setBuffs(G.players[p.id], p.buffs); }
      G.me = G.players[G.myId];
      G.monsters = {};
      applyMonsters(m.monsters);
      startGame();
      break;
    case 'pjoin': G.players[m.p.id] = mkEnt(m.p); setBuffs(G.players[m.p.id], m.p.buffs); break;
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
      const oldLvl = e.lvl;
      Object.assign(e, { hp: m.hp, maxHp: m.maxHp, mp: m.mp, maxMp: m.maxMp, lvl: m.lvl, xp: m.xp, gold: m.gold, pots: m.pots, combat: m.combat });
      setBuffs(e, m.buffs);
      if (m.id === G.myId) {
        G.cdEnd = m.cds.map(r => now + r);
        saveChar();
        updateHud();
        if (m.lvl > oldLvl) showBanner(`Nível ${m.lvl}!`, 'Sua força cresce, aventureiro.');
      }
      break;
    }
    case 'mstate': applyMonsters(m.l); break;
    case 'mdie': {
      const e = G.monsters[m.id];
      if (e) e.dieAt = now + (m.d || 0);
      if (G.target === m.id) setTarget(null);
      break;
    }
    case 'hit':
      later(m.d, () => {
        const t = performance.now();
        const e = m.k === 'm' ? G.monsters[m.id] : G.players[m.id];
        const pos = e ? tileW(e.rx, e.ry) : tileW(m.x, m.y);
        if (e) e.hitAt = t;
        const mine = m.k === 'p' && m.id === G.myId;
        G.nums.push({ wx: pos.x, wy: pos.y, text: String(m.dmg), color: m.k === 'm' ? (m.crit ? '#fde047' : '#ffffff') : (mine ? '#ef4444' : '#fca5a5'), crit: m.crit, big: m.crit, t0: t, vx: (Math.random() < 0.5 ? -1 : 1) * (0.4 + Math.random() * 0.6) });
        for (let k = 0; k < 6; k++) spawnPart('spark', pos.x, pos.y - 16, { color: m.k === 'm' ? 'rgba(255,240,180,A)' : 'rgba(255,90,90,A)' });
        if (mine) { G.shake = Math.max(G.shake, 3); flashDamage(); }
      });
      break;
    case 'fx':
      later(m.d, () => {
        G.nums.push({ wx: tileW(m.x, m.y).x, wy: tileW(m.x, m.y).y - 14, text: m.text, color: m.color, small: !m.big, big: m.big, t0: performance.now(), vx: 0 });
      });
      break;
    case 'anim': {
      const e = (m.w === 'p' ? G.players : G.monsters)[m.id];
      if (!e) break;
      e.anim = { a: m.a, t0: now, tx: m.tx, ty: m.ty };
      if (m.tx != null && (m.tx !== e.x || m.ty !== e.y)) lookAt(e, m.tx, m.ty);
      if (m.s) { e.shout = m.s; e.shoutUntil = now + 1600; }
      if (m.proj) {
        const rel = m.a === 'shoot' ? 230 : 130;
        for (let k = 0; k < (m.n || 1); k++) {
          const from = tileW(e.rx, e.ry, 24); from.x += (e.face || 1) * 10;
          G.effects.push({ a: 'proj', kind: m.proj, from, tx: m.tx, ty: m.ty, x: m.tx, y: m.ty, t0: now + rel + k * 160, dur: Math.max(120, m.d - rel) });
        }
      }
      break;
    }
    case 'aoe':
      G.effects.push({ a: m.a, x: m.x, y: m.y, x2: m.x2, y2: m.y2, k: m.k, id: m.id, t0: now + (m.d || 0), dur: EFFECT_MS[m.a] || 600, seed: Math.floor(Math.random() * 1000) });
      if (m.a === 'lvlup') later(m.d, () => G.nums.push({ wx: tileW(m.x, m.y).x, wy: tileW(m.x, m.y).y - 30, text: 'LEVEL UP!', color: '#fde047', big: true, t0: performance.now(), vx: 0 }));
      break;
    case 'cast': {
      const e = G.players[m.id];
      if (e) { e.cast = { start: now, end: now + m.ms, el: m.el }; e.anim = { a: 'cast', t0: now }; }
      break;
    }
    case 'castend': { const e = G.players[m.id]; if (e) e.cast = null; break; }
    case 'chat': {
      addChat(m.name, m.text);
      const e = m.id && G.players[m.id];
      if (e) { e.say = m.text; e.sayUntil = now + 4500; }
      break;
    }
    case 'err': showToast(m.text); break;
    case 'npc': if (G.dialog && G.dialog.id === m.n) setDialogText(m.text); break;
    case 'died':
      showBanner('Você caiu em batalha', 'Despertou no Templo da Aurora e perdeu metade da experiência do nível.', true);
      setTarget(null);
      break;
  }
}

// ---------- movimento local ----------
function monsterAt(x, y) {
  for (const id in G.monsters) { const m = G.monsters[id]; if (!m.dieAt && m.x === x && m.y === y) return m; }
  return null;
}
function canWalk(x, y) { return walkable(x, y) && !monsterAt(x, y); }
function stepMs() { return G.me.buffs.agile > performance.now() ? STEP_MS * 0.62 : STEP_MS; }

function tryStep(dx, dy, now) {
  const me = G.me;
  const opts = [[dx, dy]];
  if (dx && dy) opts.push([dx, 0], [0, dy]);
  for (const [ax, ay] of opts) {
    const nx = me.x + ax, ny = me.y + ay;
    if (!canWalk(nx, ny)) continue;
    const ms = stepMs();
    moveEnt(me, nx, ny, ms);
    me.nextMove = now + ms;
    Net.send({ t: 'move', x: nx, y: ny });
    if (Math.random() < 0.3) { const w = tileW(me.rx, me.ry); spawnPart('dust', w.x, w.y); }
    return true;
  }
  return false;
}

function findPath(sx, sy, isGoal, maxNodes = 5000) {
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
  if (me.cast && me.cast.end > now) return; // conjurando: fica parado
  if (document.activeElement && document.activeElement.tagName === 'INPUT') { G.keys.clear(); }
  let dx = 0, dy = 0;
  const k = G.keys;
  if (k.has('w') || k.has('arrowup')) { dx -= 1; dy -= 1; }
  if (k.has('s') || k.has('arrowdown')) { dx += 1; dy += 1; }
  if (k.has('a') || k.has('arrowleft')) { dx -= 1; dy += 1; }
  if (k.has('d') || k.has('arrowright')) { dx += 1; dy -= 1; }
  dx = Math.sign(dx); dy = Math.sign(dy);
  if (dx || dy) { G.path = null; G.pendingNpc = null; tryStep(dx, dy, now); return; }

  if (G.path && G.path.length) {
    const n = G.path.shift();
    if (cheb(n.x, n.y, me.x, me.y) !== 1 || !tryStep(n.x - me.x, n.y - me.y, now) || me.x !== n.x || me.y !== n.y) G.path = null;
    return;
  }
  if (G.pendingNpc) {
    const n = G.npcs[G.pendingNpc];
    if (cheb(me.x, me.y, n.x, n.y) <= 3) openDialog(n.id);
    G.pendingNpc = null;
  }
}

function setTarget(id) {
  if (G.target === id) return;
  G.target = id;
  Net.send({ t: 'target', id });
  updateTargetFrame();
}

function castSkill(i) {
  const sk = SKILLS[G.me.cls][i], now = performance.now();
  if (!sk) return;
  if (now < G.cdEnd[i]) return;
  if (G.me.mp < sk.mp) { showToast('Mana insuficiente.'); return; }
  if (sk.tgt) {
    const t = G.target && G.monsters[G.target];
    if (!t) { showToast('Selecione um monstro como alvo (clique nele ou aperte Espaço).'); return; }
    if (cheb(G.me.x, G.me.y, t.x, t.y) > sk.range) { showToast(`Alvo fora de alcance (máximo ${sk.range} tiles).`); return; }
  }
  const slot = document.querySelectorAll('.slot.skill')[i];
  if (slot) { slot.classList.remove('pressed'); void slot.offsetWidth; slot.classList.add('pressed'); }
  Net.send({ t: 'skill', i });
}
function drinkPot(k) {
  if (!G.me.pots || G.me.pots[k] <= 0) { showToast(`Sem ${ITEMS[k].name}. Compre no Empório do Borin.`); return; }
  Net.send({ t: 'pot', k });
}

// ---------- salvar personagem no navegador ----------
const SAVE_KEY = 'eldmar-chars-v2';
function loadChars() { try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch (e) { return {}; } }
function charKey(name, cls) { return name.trim().toLowerCase() + '|' + cls; }
function saveChar() {
  const me = G.me;
  try {
    const all = loadChars();
    all[charKey(me.name, me.cls)] = { name: me.name, cls: me.cls, color: me.color, lvl: me.lvl, xp: me.xp, gold: me.gold, pots: me.pots, t: Date.now() };
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
  canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
}
window.addEventListener('resize', resize);
resize();

function bar(id, v, max, text) {
  $(id + '-fill').style.width = (100 * Math.max(0, Math.min(1, v / max))) + '%';
  $(id + '-text').textContent = text;
}

function updateHud() {
  const me = G.me;
  if (!me) return;
  $('hud-name').textContent = me.name;
  $('hud-class').textContent = `${CLASSES[me.cls].name} · Nível ${me.lvl}`;
  bar('hp', me.hp, me.maxHp, `${me.hp} / ${me.maxHp}`);
  bar('mp', me.mp, me.maxMp, `${me.mp} / ${me.maxMp}`);
  bar('xp', me.xp, need(me.lvl), `${me.xp} / ${need(me.lvl)} xp`);
  $('gold').textContent = me.gold;
  $('pot-hp-n').textContent = me.pots ? me.pots.hp : 0;
  $('pot-mp-n').textContent = me.pots ? me.pots.mp : 0;
  const st = $('combat-state');
  st.textContent = me.combat ? '⚔ Em combate' : (me.hp < me.maxHp || me.mp < me.maxMp ? '✦ Descansando (regenerando)' : '✦ Descansado');
  st.className = me.combat ? 'combat' : 'rest';
  SKILLS[me.cls].forEach((sk, i) => $('slot' + i).classList.toggle('nomana', me.mp < sk.mp));
  const buffs = $('buffs');
  buffs.innerHTML = '';
  const now = performance.now();
  for (const k in me.buffs) {
    if (me.buffs[k] <= now) continue;
    const d = document.createElement('div');
    d.className = 'buff ' + k; d.title = BUFF_NAMES[k] || k;
    d.dataset.end = me.buffs[k];
    buffs.appendChild(d);
  }
  if (G.dialog) refreshDialogGold();
}

function updateTargetFrame() {
  const f = $('target-frame');
  const t = G.target && G.monsters[G.target];
  if (!t) { f.classList.add('hidden'); return; }
  f.classList.remove('hidden');
  const z = ZONES[zoneAt(t.x, t.y)];
  $('tg-name').textContent = MON[t.type].name;
  $('tg-stars').textContent = '★'.repeat(Math.max(1, z.stars));
  bar('tg', t.hp, t.maxHp, `${Math.max(0, t.hp)} / ${t.maxHp}`);
  const d = cheb(G.me.x, G.me.y, t.x, t.y), r = CLASSES[G.me.cls].range;
  const rs = $('tg-range');
  const safe = inSafe(G.me.x, G.me.y);
  rs.textContent = safe ? 'Você está na zona protegida' : d <= r ? '⚔ Ao alcance' : `Fora de alcance (${d} / ${r})`;
  rs.className = !safe && d <= r ? 'ok' : 'far';
}

function updateSlots(now) {
  for (let i = 0; i < 4; i++) {
    const left = Math.max(0, G.cdEnd[i] - now), sk = SKILLS[G.me.cls][i];
    const el = $('slot' + i);
    el.style.setProperty('--cd', left > 0 ? (left / sk.cd * 360) + 'deg' : '0deg');
    $('slot' + i + '-t').textContent = left > 0 ? (left / 1000).toFixed(left < 1000 ? 1 : 0) : '';
  }
  for (const b of document.querySelectorAll('.buff')) {
    const left = (+b.dataset.end - now) / 1000;
    b.textContent = left > 0 ? (left > 60 ? Math.ceil(left / 60) + 'm' : Math.ceil(left) + '') : '';
    if (left <= 0) b.remove();
  }
}

function addChat(name, text) {
  const log = $('chat-log');
  const line = document.createElement('div');
  if (name) {
    const b = document.createElement('b'); b.textContent = name + ': ';
    line.appendChild(b);
    line.appendChild(document.createTextNode(text));
  } else { line.className = 'sys'; line.textContent = text; }
  log.appendChild(line);
  while (log.children.length > 80) log.firstChild.remove();
  log.scrollTop = log.scrollHeight;
}

let toastTimer = 0;
function showToast(text) {
  const t = $('toast');
  t.textContent = text; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}
let bannerTimer = 0;
function showBanner(title, sub, dark) {
  const b = $('banner');
  $('banner-title').textContent = title; $('banner-sub').textContent = sub;
  b.className = dark ? 'show dark' : 'show';
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => b.className = '', 3200);
}
function flashDamage() {
  const v = $('vignette');
  v.classList.remove('hit'); void v.offsetWidth; v.classList.add('hit');
}

// ---------- diálogo com NPCs ----------
const GUARD_TEXT = 'Ao redor do vilarejo há terras perigosas: os Campos (★) ao redor da paliçada, o Bosque Sombrio (★★) ao norte, o Pântano Pútrido (★★) a leste, as Colinas de Ossos (★★★) ao sul, o Acampamento Orc (★★★) a oeste e, perto do mar, as Terras Selvagens (★★★★).';
const NPC_DIALOG = {
  merchant: { greet: 'Bem-vindo ao meu empório! Tenho as melhores poções da região. O que vai levar?', opts: [
    ['Poção de Vida — 20 ouro', { a: 'buy', item: 'hp', qty: 1 }], ['5 Poções de Vida — 100 ouro', { a: 'buy', item: 'hp', qty: 5 }],
    ['Poção de Mana — 25 ouro', { a: 'buy', item: 'mp', qty: 1 }], ['5 Poções de Mana — 125 ouro', { a: 'buy', item: 'mp', qty: 5 }]] },
  priest: { greet: 'A luz da Aurora te saúda, filho. Se estiver ferido, posso abençoá-lo.', opts: [['Receber a bênção (grátis)', { a: 'bless' }]] },
  innkeeper: { greet: 'Entre, entre! Na Taverna do Javali tem bebida gelada, comida quente e muita conversa.', opts: [
    ['Hidromel — 15 ouro (+10% de dano por 3 min)', { a: 'mead' }], ['Ensopado de javali — 10 ouro (recupera tudo)', { a: 'stew' }], ['Ouvir os boatos da taverna', { a: 'rumor' }]] },
  guard: { greet: 'Alto lá, aventureiro. Fique atento lá fora: quanto mais longe do vilarejo, mais perigoso.', opts: [['Quais são as regiões?', { local: GUARD_TEXT }]] },
};

function npcUnderMouse(mx, my) {
  for (const n of NPCS) {
    const e = G.npcs[n.id], p = iso(e.x, e.y);
    const sx = (p.sx + G.view.ox) * ZOOM, sy = (p.sy + G.view.oy) * ZOOM;
    if (mx > sx - 14 * ZOOM && mx < sx + 14 * ZOOM && my > sy - 48 * ZOOM && my < sy + 6 * ZOOM) return n;
  }
  return null;
}

function openDialog(id) {
  const n = NPCS.find(q => q.id === id), def = NPC_DIALOG[n.kind];
  G.dialog = { id };
  $('dlg-name').textContent = n.name;
  setDialogText(def.greet);
  const box = $('dlg-opts');
  box.innerHTML = '';
  for (const [label, act] of def.opts) {
    const b = document.createElement('button');
    b.textContent = label;
    b.onclick = () => { if (act.local) setDialogText(act.local); else Net.send({ t: 'npc', n: id, ...act }); };
    box.appendChild(b);
  }
  const close = document.createElement('button');
  close.textContent = 'Até logo'; close.className = 'ghost';
  close.onclick = closeDialog;
  box.appendChild(close);
  const pc = $('dlg-portrait'), pctx = pc.getContext('2d');
  pctx.setTransform(1, 0, 0, 1, 0, 0); pctx.clearRect(0, 0, pc.width, pc.height);
  pctx.setTransform(3, 0, 0, 3, pc.width / 2, pc.height - 6);
  drawPerson(pctx, NPC_LOOK[n.kind], 0);
  refreshDialogGold();
  $('dialog').classList.remove('hidden');
}
function setDialogText(t) { $('dlg-text').textContent = t; }
function refreshDialogGold() { $('dlg-gold').textContent = G.me ? G.me.gold : 0; }
function closeDialog() { G.dialog = null; $('dialog').classList.add('hidden'); }

// ---------- mouse e teclado ----------
function screenToTile(mx, my) {
  const f = unIso(mx / ZOOM - G.view.ox, my / ZOOM - G.view.oy);
  return { x: Math.round(f.x), y: Math.round(f.y) };
}
function monsterUnderMouse(mx, my) {
  let found = null, bestD = -Infinity;
  for (const id in G.monsters) {
    const e = G.monsters[id];
    if (e.dieAt) continue;
    const p = iso(e.rx, e.ry), big = MON[e.type].big ? 1.5 : 1;
    const sx = (p.sx + G.view.ox) * ZOOM, sy = (p.sy + G.view.oy) * ZOOM;
    if (mx > sx - 18 * ZOOM * big && mx < sx + 18 * ZOOM * big && my > sy - 40 * ZOOM * big && my < sy + 8 * ZOOM) {
      const d = e.x + e.y;
      if (d > bestD) { found = e; bestD = d; }
    }
  }
  return found;
}

canvas.addEventListener('mousemove', e => {
  if (!G.started) return;
  G.hover = screenToTile(e.clientX, e.clientY);
  canvas.style.cursor = monsterUnderMouse(e.clientX, e.clientY) ? 'crosshair' : npcUnderMouse(e.clientX, e.clientY) ? 'help' : 'pointer';
});
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('mousedown', e => {
  if (!G.started) return;
  $('chat-input').blur();
  const mon = monsterUnderMouse(e.clientX, e.clientY);
  if (mon) {
    setTarget(G.target === mon.id ? null : mon.id);
    if (G.target && cheb(G.me.x, G.me.y, mon.x, mon.y) > CLASSES[G.me.cls].range) showToast('Alvo fora de alcance — aproxime-se para atacar.');
    return;
  }
  const npc = npcUnderMouse(e.clientX, e.clientY);
  if (npc) {
    if (cheb(G.me.x, G.me.y, npc.x, npc.y) <= 3) openDialog(npc.id);
    else { G.path = findPath(G.me.x, G.me.y, (x, y) => cheb(x, y, npc.x, npc.y) <= 1); G.pendingNpc = npc.id; }
    return;
  }
  if (e.button !== 0) return;
  const t = screenToTile(e.clientX, e.clientY);
  if (!canWalk(t.x, t.y)) return;
  G.pendingNpc = null;
  G.path = findPath(G.me.x, G.me.y, (x, y) => x === t.x && y === t.y);
});
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  ZOOM = Math.max(1.25, Math.min(3, ZOOM * (e.deltaY < 0 ? 1.1 : 0.9)));
}, { passive: false });

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
  if (k === 'escape') { if (G.dialog) closeDialog(); else { setTarget(null); G.path = null; } return; }
  if (k >= '1' && k <= '4') { castSkill(+k - 1); return; }
  if (k === 'q') { drinkPot('hp'); return; }
  if (k === 'e') { drinkPot('mp'); return; }
  if (k === ' ' || k === 'tab') {
    e.preventDefault();
    let best = null, bd = 99;
    for (const id in G.monsters) { const m = G.monsters[id]; if (m.dieAt) continue; const d = cheb(m.x, m.y, G.me.x, G.me.y); if (d < bd && m.id !== G.target) { bd = d; best = m; } }
    if (best && bd <= 9) setTarget(best.id);
    return;
  }
  if (k.startsWith('arrow')) e.preventDefault();
  G.keys.add(k);
});
window.addEventListener('keyup', e => G.keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => G.keys.clear());

// ---------- laço de desenho ----------
let lastMini = 0, lastHudTick = 0;
const lobbyCam = { x: CENTER, y: CENTER };
function frame() {
  const now = performance.now();
  // temporizadores (dano chegando depois da flecha, etc.)
  if (G.timers.length) {
    const due = G.timers.filter(t => t.at <= now);
    G.timers = G.timers.filter(t => t.at > now);
    for (const t of due) t.fn();
  }
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (G.started) {
    updateLocal(now);
    for (const id in G.players) interp(G.players[id], now);
    for (const id in G.monsters) {
      const m = G.monsters[id];
      interp(m, now);
      if (m.dieAt && now > m.dieAt + 650) delete G.monsters[id];
    }
    renderScene(ctx, W, H, now, { x: G.me.rx, y: G.me.ry }, DPR);
    updateSlots(now);
    if (now - lastMini > 200) {
      lastMini = now;
      renderMinimap(mctx, mini.width);
      const z = ZONES[zoneAt(G.me.x, G.me.y)];
      $('zone-name').textContent = z.name;
      $('zone-stars').textContent = z.stars ? '★'.repeat(z.stars) + '☆'.repeat(4 - z.stars) : 'Zona protegida';
      const d = dayInfo();
      $('daytime').textContent = d.night ? '🌙 Noite' : d.dusk > 0.3 ? '🌅 Crepúsculo' : '☀ Dia';
      updateTargetFrame();
    }
    if (now - lastHudTick > 1000) { lastHudTick = now; updateHud(); }
    if (G.dialog) { const n = G.npcs[G.dialog.id]; if (cheb(G.me.x, G.me.y, n.x, n.y) > 4) closeDialog(); }
  } else {
    // fundo do lobby: câmera passeando pelo vilarejo
    const t = now / 9000;
    lobbyCam.x = CENTER + Math.cos(t) * 5; lobbyCam.y = CENTER + Math.sin(t) * 5;
    renderScene(ctx, W, H, now, lobbyCam, DPR);
    drawClassPreviews(now);
  }
  requestAnimationFrame(frame);
}

function buildHotbar() {
  const cls = G.me.cls;
  SKILLS[cls].forEach((sk, i) => {
    const el = $('slot' + i);
    drawSkillIcon(el.querySelector('canvas').getContext('2d'), sk.id, 48);
    el.querySelector('.cost').textContent = sk.mp;
    el.dataset.tip = `${sk.name}\n${sk.desc}\nMana: ${sk.mp} · Recarga: ${sk.cd / 1000}s${sk.cast ? ` · Conjuração: ${sk.cast / 1000}s` : ''}${sk.range ? ` · Alcance: ${sk.range}` : ''}`;
    el.onclick = () => castSkill(i);
  });
  drawSkillIcon($('pot-hp').querySelector('canvas').getContext('2d'), 'hp', 48);
  drawSkillIcon($('pot-mp').querySelector('canvas').getContext('2d'), 'mp', 48);
  $('pot-hp').onclick = () => drinkPot('hp');
  $('pot-mp').onclick = () => drinkPot('mp');
  const p = CLASSES[cls].passive;
  $('passive').dataset.tip = `Aptidão: ${p.name}\n${p.desc}`;
  $('passive').textContent = p.name;
  // retrato
  const pc = $('portrait'), pctx = pc.getContext('2d');
  pctx.setTransform(1, 0, 0, 1, 0, 0); pctx.clearRect(0, 0, pc.width, pc.height);
  pctx.setTransform(2.6, 0, 0, 2.6, pc.width / 2 - 2, pc.height + 52);
  drawHero(pctx, 0, 0, { cls, color: G.me.color, face: 1 }, 0);
}

function startGame() {
  if (G.started) return;
  G.started = true;
  $('lobby').classList.add('hidden');
  $('hud').classList.remove('hidden');
  buildHotbar();
  updateHud();
  addChat('', `Bem-vindo a Eldmar, ${G.me.name}! Fale com os moradores clicando neles. Enter abre o chat.`);
  showBanner('Vilarejo de Eldmar', 'Zona protegida — monstros não entram aqui.');
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
  tip.style.left = Math.max(8, Math.min(window.innerWidth - 268, r.left + r.width / 2 - 130)) + 'px';
  tip.style.top = Math.max(8, r.top - tip.offsetHeight - 10) + 'px';
});

// ============================================================
//  LOBBY
// ============================================================
const HERALDRY = ['#b91c1c', '#1d4ed8', '#15803d', '#7e22ce', '#b45309', '#0f766e', '#be185d', '#3f3f46'];
let chosenClass = 'knight', chosenColor = HERALDRY[0];

function randomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
function setStatus(text, err) { const s = $('status'); s.textContent = text; s.className = err ? 'err' : ''; }
function lockLobby(b) { for (const el of document.querySelectorAll('#lobby button, #lobby input')) el.disabled = b; }

function helloMsg() {
  const name = $('name').value.trim() || 'Aventureiro';
  const saved = loadChars()[charKey(name, chosenClass)] || {};
  return { t: 'hello', name, color: chosenColor, cls: chosenClass, lvl: saved.lvl, xp: saved.xp, gold: saved.gold, pots: saved.pots };
}
function showRoom(code) { $('room-code').textContent = Net.offline ? 'offline' : code; }

function createRoom(code = randomCode(), tries = 0) {
  if (!$('name').value.trim()) { setStatus('Escolha um nome para seu herói.', true); $('name').focus(); return; }
  lockLobby(true);
  setStatus('Erguendo o reino...');
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
  if (!$('name').value.trim()) { setStatus('Escolha um nome para seu herói.', true); $('name').focus(); return; }
  const code = $('code').value.trim().toUpperCase();
  if (!code) { setStatus('Digite o código da sala.', true); return; }
  lockLobby(true);
  setStatus('Cavalgando até a sala ' + code + '...');
  Net.onServer = clientOnServer;
  Net.onDisconnected = () => $('disconnected').classList.remove('hidden');
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

// pré-visualização animada das classes
const previews = [];
function drawClassPreviews(now) {
  for (const { cls, c } of previews) {
    const pctx = c.getContext('2d');
    pctx.setTransform(1, 0, 0, 1, 0, 0);
    pctx.clearRect(0, 0, c.width, c.height);
    const sel = cls === chosenClass;
    const cycle = (now / 1000) % 4;
    const anims = { knight: 'swing', archer: 'shoot', mage: 'cast' };
    const o = { cls, color: chosenColor, face: 1, walking: sel && cycle < 2, anim: sel && cycle > 2.6 ? { a: anims[cls], t0: now - (cycle - 2.6) * 1000 } : null };
    if (o.anim && (now - o.anim.t0) > ANIM_MS[o.anim.a]) o.anim = null;
    pctx.setTransform(2.4, 0, 0, 2.4, c.width / 2, c.height - 14);
    ell(pctx, 0, 2, 16, 5, 'rgba(0,0,0,0.25)');
    drawHero(pctx, 0, 0, o, sel ? now : 0);
  }
}

function buildLobby() {
  $('version').textContent = `${VERSION} · ${VERSION_NAME}`;
  const box = $('classes');
  for (const [cls, c] of Object.entries(CLASSES)) {
    const card = document.createElement('div');
    card.className = 'class-card' + (cls === chosenClass ? ' sel' : '');
    card.dataset.cls = cls;
    const cv = document.createElement('canvas'); cv.width = 150; cv.height = 160;
    previews.push({ cls, c: cv });
    const h = document.createElement('h3'); h.textContent = c.name;
    const role = document.createElement('div'); role.className = 'role'; role.textContent = c.role;
    const desc = document.createElement('p'); desc.textContent = c.desc;
    const stats = document.createElement('div'); stats.className = 'stats';
    for (const [k, v] of Object.entries(c.stats)) {
      const row = document.createElement('div');
      const lab = document.createElement('span'); lab.textContent = k;
      const pips = document.createElement('i');
      for (let n = 0; n < 5; n++) { const s = document.createElement('b'); if (n < v) s.className = 'on'; pips.appendChild(s); }
      row.append(lab, pips); stats.appendChild(row);
    }
    const sk = document.createElement('div'); sk.className = 'skills';
    for (const s of SKILLS[cls]) {
      const ic = document.createElement('canvas'); ic.width = 30; ic.height = 30;
      drawSkillIcon(ic.getContext('2d'), s.id, 30);
      ic.dataset.tip = `${s.name}\n${s.desc}\nMana: ${s.mp} · Recarga: ${s.cd / 1000}s`;
      sk.appendChild(ic);
    }
    const pas = document.createElement('div'); pas.className = 'passive-line';
    pas.textContent = '✦ ' + c.passive.name; pas.dataset.tip = `Aptidão: ${c.passive.name}\n${c.passive.desc}`;
    card.append(cv, h, role, desc, stats, sk, pas);
    card.onclick = () => {
      chosenClass = cls;
      for (const el of document.querySelectorAll('.class-card')) el.classList.toggle('sel', el.dataset.cls === cls);
      updateSavedInfo();
    };
    box.appendChild(card);
  }
  const sw = $('swatches');
  for (const col of HERALDRY) {
    const b = document.createElement('button');
    b.className = 'swatch' + (col === chosenColor ? ' sel' : '');
    b.style.background = col; b.title = 'Cor do brasão';
    b.onclick = () => { chosenColor = col; for (const el of sw.children) el.classList.toggle('sel', el === b); };
    sw.appendChild(b);
  }
  // personagens salvos
  const chars = Object.values(loadChars()).sort((a, b) => (b.t || 0) - (a.t || 0)).slice(0, 4);
  const sv = $('saved');
  for (const ch of chars) {
    if (!CLASSES[ch.cls]) continue;
    const b = document.createElement('button');
    b.className = 'saved-char';
    b.textContent = `${ch.name} · ${CLASSES[ch.cls].name} nv. ${ch.lvl}`;
    b.onclick = () => {
      $('name').value = ch.name; chosenClass = ch.cls; chosenColor = ch.color || chosenColor;
      for (const el of document.querySelectorAll('.class-card')) el.classList.toggle('sel', el.dataset.cls === ch.cls);
      for (const el of $('swatches').children) el.classList.toggle('sel', el.style.background && el.title && rgbToHex(el.style.background) === chosenColor);
      updateSavedInfo();
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
  $('btn-copy').onclick = () => {
    const link = location.origin + location.pathname + '?sala=' + Net.room;
    navigator.clipboard.writeText(link).then(() => showToast('Link copiado! Mande para seus amigos.'), () => showToast(link));
  };
  $('btn-help').onclick = () => $('help').classList.toggle('hidden');
  if (chars[0]) { $('name').value = chars[0].name; }
  updateSavedInfo();
}
function rgbToHex(rgb) { const m = rgb.match(/\d+/g); return m ? '#' + m.slice(0, 3).map(v => (+v).toString(16).padStart(2, '0')).join('') : ''; }
function updateSavedInfo() {
  const name = $('name').value.trim();
  const s = name && loadChars()[charKey(name, chosenClass)];
  $('saved-info').textContent = s ? `Continuar jornada: ${s.name}, ${CLASSES[s.cls].name} nível ${s.lvl} (${s.gold || 0} ouro)` : name ? `Novo herói: ${name}, ${CLASSES[chosenClass].name}` : '';
}

buildLobby();
requestAnimationFrame(frame);
