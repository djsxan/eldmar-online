// ============================================================
//  SERVIDOR — roda só no navegador do anfitrião.
//  Decide dano, vida, monstros, ouro, xp e missões.
//  Otimização: cada jogador só recebe o que está perto dele
//  (VIEW_RADIUS), em pacotes compactos 10x por segundo.
// ============================================================
const S = { players: {}, monsters: {}, nextMid: 1, nextSpawn: 0, lastRegen: 0, filled: false, lastTick: 0 };
const MAX_MON = typeof TEST3D !== 'undefined' && TEST3D ? 10 : 320;

const RUMORS = [
  'Os lenhadores evitam o Bosque Sombrio depois do pôr do sol. Os lobos de lá caçam em bando.',
  'Dizem que algo grande vive na montanha da cachoeira. As pegadas na lama têm o tamanho de um escudo.',
  'O pântano a leste engoliu duas carroças este mês. Os sapos de lá não têm medo de ninguém.',
  'Ao sul ficam as Colinas de Ossos. Os mortos que não foram enterrados direito não descansam.',
  'Os orcs a oeste estão se organizando. Alguém está pagando os goblins para saquear as estradas.',
  'Um Cavaleiro na frente, um Atirador atrás e um Mago curando. É assim que se volta vivo.',
  'Se um companheiro cair, não o abandone. Levante-o, ou carregue-o até a capela.',
  'A cidadela foi reconstruída pedra por pedra depois da última guerra. Ainda há quem jure ouvir os mortos nas muralhas.',
];

const now_ = () => Date.now();
function buffOn(p, b) { return (p.buffs[b] || 0) > now_(); }
function pinfo(p) { return { id: p.id, name: p.name, color: p.color, cls: p.cls, skin: p.skin, lvl: p.lvl }; }
function fullStat(p) {
  const now = now_();
  return {
    t: 'pstat', id: p.id, hp: p.hp, maxHp: p.maxHp, mp: p.mp, maxMp: p.maxMp, lvl: p.lvl, xp: p.xp, gold: p.gold,
    pots: { hp: p.pots.hp, mp: p.pots.mp, band: p.pots.band || 0 }, body: p.body, bleed: p.bleed, food: Math.round(p.food ?? 100), water: Math.round(p.water ?? 100), cold: Math.round(p.cold || 0), infect: p.infect || 0, sick: Math.max(0, (p.sickUntil || 0) - now), hasSkin: !!p.hasSkin, lost: p.lost || 0, pro: p.pro || 0, knock: Math.max(0, (p.knockUntil || 0) - now), inv: { ...p.inv }, quests: { ...p.quests }, qdone: { ...p.qdone },
    buffs: Object.entries(p.buffs).filter(([, u]) => u > now).map(([k, u]) => [k, u - now]),
    cds: [0, 1, 2, 3].map(i => Math.max(0, (p.cds[i] || 0) - now)),
    combat: now - p.lastCombat < OUT_OF_COMBAT_MS, cst: Math.round(p.cst ?? CST_MAX), cstMax: cstMaxOf(p), esc: (p.gripBy || p.tied) ? Math.round(p.esc || 0) : 0, arw: (p.arrows || []).map(a => a.part), tree: p.tree || {}, use: p.use || {}, stun: Math.max(0, (p.stunUntil || 0) - now), rip: Math.max(0, (p.ripUntil || 0) - now), slow: Math.max(0, (p.slowUntil || 0) - now), downed: p.downed ? p.downed.until - now : 0,
  };
}
function sendStat(p) { Net.toOne(p.id, fullStat(p)); }
// envia um evento só para quem está perto de (x, y)
function near(x, y, msg, r = VIEW_RADIUS + 4) {
  for (const id in S.players) { const q = S.players[id]; if (dist(q.x, q.y, x, y) <= r) Net.toOne(id, msg); }
}
function sfx(x, y, text, color, d = 0, big = false) { near(x, y, { t: 'fx', x, y, text: String(text), color, d, big }); }
function sys(text) { Net.toAll({ t: 'chat', name: '', text }); }
function tell(p, text) { Net.toOne(p.id, { t: 'err', text }); }
function anim(w, e, a, tx, ty, extra) { near(e.x, e.y, { t: 'anim', w, id: e.id, a, tx, ty, ...extra }); }
function aoe(a, x, y, extra) { near(x, y, { t: 'aoe', a, x, y, ...extra }); }

function townSpot() {
  for (let i = 0; i < 100; i++) {
    const x = TEMPLE_SPAWN.x + (Math.random() - 0.5) * 3, y = TEMPLE_SPAWN.y + (Math.random() - 0.5) * 2;
    if (canStand(x, y, 0)) return { x, y };
  }
  return { x: TEMPLE_SPAWN.x, y: TEMPLE_SPAWN.y };
}

function monsterAtPos(x, y, self, r = 0.62) {
  for (const id in S.monsters) { const m = S.monsters[id]; if (m !== self && dist(m.x, m.y, x, y) < r) return true; }
  return false;
}
function monStand(x, y, m) {
  if (m && m.z) { if (!canStandZ(x, y, 1, 0.3) || stairH(x, y) >= 0) return false; }
  else if (!canStand(x, y, 0, 0.3) || inSafe(x, y)) return false;
  if (monsterAtPos(x, y, m)) return false;
  for (const id in S.players) { const p = S.players[id]; if (p.z < 0.5 && !p.downed && dist(p.x, p.y, x, y) < 0.55) return false; }
  return true;
}

function spawnAt(type, x, y, extra) {
  const id = S.nextMid++;
  S.monsters[id] = { id, type, zone: zoneAt(x, y), x, y, homeX: x, homeY: y, hp: MON[type].hp, nextAtk: 0, stunUntil: 0, slowUntil: 0, taunt: null, aggro: null, returning: false, face: 1, path: null, pathT: 0, wander: null, waitUntil: 0, ...extra };
  return id;
}
// ---------------- bastiões: vagas fixas de monstros, patrulhas, chefe e baú ----------------
function initBastions() {
  S.bslots = []; S.chests = S.chests || {};
  for (const B of BASTIONS) {
    if (B.kind === 'dragon') { const a = Math.atan2(CENTER - B.y, CENTER - B.x); S.bslots.push({ b: B, type: B.boss, pos: [B.x + Math.cos(a) * 0.8, B.y + Math.sin(a) * 0.8], boss: true, z: 1 }); continue; }
    const spots = [];
    for (let k = 0; k < 800 && spots.length < 40; k++) { const a = Math.random() * 6.28, r = 1 + Math.random() * (B.r - 1.5), x = B.x + Math.cos(a) * r, y = B.y + Math.sin(a) * r; if (monStand(x, y, null) && REACH[Math.round(y) * MAP_W + Math.round(x)]) spots.push([x, y]); }
    if (!spots.length) continue;
    let si = 0; const take = () => spots[(si++) % spots.length];
    for (const [type, n] of Object.entries(B.mons)) for (let i = 0; i < n; i++) S.bslots.push({ b: B, type, pos: take() });
    if (B.boss) S.bslots.push({ b: B, type: B.boss, pos: take(), boss: true });
    if (B.night) for (const [type, n] of Object.entries(B.night)) for (let i = 0; i < n; i++) S.bslots.push({ b: B, type, pos: take(), night: true });
    if (B.patrol) {
      const pts = []; for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2, x = B.x + Math.cos(a) * (B.r + 5), y = B.y + Math.sin(a) * (B.r + 5); if (monStand(x, y, null) && REACH[Math.round(y) * MAP_W + Math.round(x)]) pts.push([x, y]); }
      if (pts.length >= 3) B.patrol.forEach((type, i) => S.bslots.push({ b: B, type, pos: pts[0], patrol: pts, off: i }));
    }
  }
}
function tickBastions(now) {
  const night = dayInfo().night;
  for (const s of S.bslots) {
    const m = s.mid != null ? S.monsters[s.mid] : null;
    if (m) { if (s.night && !night) { delete S.monsters[s.mid]; near(m.x, m.y, { t: 'mdie', id: m.id, d: 0 }); s.mid = null; } continue; }
    if (s.mid != null) { s.mid = null; s.deadAt = now; }          // morreu
    if (s.night && !night) continue;
    if (s.deadAt && now - s.deadAt < (s.b.fast && !s.boss ? s.b.fast : s.b.respawn && s.boss ? s.b.respawn : s.boss ? BOSS_RESPAWN : BASTION_RESPAWN)) continue;
    const [x, y] = s.pos;
    if (s.deadAt && !s.b.fast) { let busy = false; for (const id in S.players) if (dist(S.players[id].x, S.players[id].y, x, y) < 12) busy = true; if (busy) continue; }
    const ox = s.patrol ? (s.off - 1) * 0.7 : 0;
    if (MON[s.type].dragon && s.deadAt) { sys('Um rugido ecoa das Terras Selvagens... o dragão voltou ao covil.'); Net.toAll({ t: 'shake', s: 3 }); }
    s.mid = spawnAt(s.type, x + ox, y, { bs: s.b.id, patrol: s.patrol ? { pts: s.patrol, i: 0 } : null, z: s.z || 0, sleep: !!MON[s.type].dragon, ang: Math.PI * 0.75 }); s.deadAt = 0;
  }
  for (const id in S.chests) if (now > S.chests[id].until) delete S.chests[id];
  for (const id in S.corpses || {}) if (now > S.corpses[id].until) delete S.corpses[id];
  // objetos quebrados voltam ao lugar depois de 3 min (se ninguém estiver em cima)
  if (S.objBack && S.objBack.length) S.objBack = S.objBack.filter(q => { if (now < q.at) return true; const x = q.i % MAP_W, y = Math.floor(q.i / MAP_W); for (const id in S.players) if (dist(S.players[id].x, S.players[id].y, x, y) < 0.9) return true; for (const id in S.monsters) if (dist(S.monsters[id].x, S.monsters[id].y, x, y) < 0.9) return true; setObj(q.i, q.o); return false; });
}
// objetos do cenário que mudaram (levantados/quebrados) — todos os clientes recebem
function bodyBits(p) {
  const extra = (p.parry ? 32 : 0) | (now_() < (p.stunUntil || 0) ? 64 : 0) | (p.duel ? 128 : 0);
  if (!p.body) return extra; const leg = Math.max(PART_STATE(p.body.legL), PART_STATE(p.body.legR));
  let bl = 0; for (const k of BODY_PARTS) bl += p.bleed[k] || 0;
  return extra | leg | (PART_STATE(p.body.armA) >= 2 ? 4 : 0) | (PART_STATE(p.body.head) >= 2 ? 8 : 0) | (bl > 0 ? 16 : 0);
}
function setObj(i, o) { WORLD.obj[i] = o; (S.objMods = S.objMods || {})[i] = o; Net.toAll({ t: 'obj', i, o }); }
function spawnChest(m) {
  const id = S.nextChest = (S.nextChest || 0) + 1, who = new Set();
  for (const pid in S.players) if (dist(S.players[pid].x, S.players[pid].y, m.x, m.y) <= 14) who.add(pid);
  S.chests[id] = { id, x: m.x, y: m.y, until: now_() + CHEST_MS, who, opened: new Set(), boss: m.type };
  sys('Um baú surgiu onde ' + MON[m.type].name + ' caiu.');
}
function wildCount() { let n = 0; for (const id in S.monsters) if (!S.monsters[id].bs) n++; return n; }
function spawnMonster() {
  const x = rint(2, MAP_W - 3), y = rint(2, MAP_H - 3), z = zoneAt(x, y);
  if (!ZONES[z].mons.length || !REACH[y * MAP_W + x] || !monStand(x, y, null)) return false;
  for (const id in S.players) if (dist(x, y, S.players[id].x, S.players[id].y) < 11) return false;
  const type = pick(ZONES[z].mons), id = S.nextMid++;
  S.monsters[id] = { id, type, zone: z, x, y, homeX: x, homeY: y, hp: MON[type].hp, nextAtk: 0, stunUntil: 0, slowUntil: 0, taunt: null, aggro: null, returning: false, face: 1, path: null, pathT: 0, wander: null, waitUntil: 0 };
  return true;
}

// ---------------- mensagens dos jogadores ----------------
function hostOnClient(from, m) {
  const p = S.players[from];
  if (m.t === 'hello') {
    if (p) return;
    const cls = CLASSES[m.cls] ? m.cls : 'knight';
    const lvl = clamp(m.lvl | 0 || 1, 1, 300);
    const si = SKINS[cls].findIndex(s => s.id === m.skin), skin = si >= 0 && lvl >= SKIN_LVL[si] ? m.skin : SKINS[cls][0].id;
    const s = townSpot();
    const np = {
      id: from, name: String(m.name || 'Aventureiro').slice(0, 16), cls, skin,
      color: /^#[0-9a-f]{6}$/i.test(m.color) ? m.color : '#8b2e2e',
      x: s.x, y: s.y, z: 0, lvl, xp: clamp(m.xp | 0, 0, need(lvl) - 1), gold: clamp(m.gold | 0, 0, 1e7),
      pots: { hp: clamp((m.pots && m.pots.hp) | 0, 0, 999), mp: clamp((m.pots && m.pots.mp) | 0, 0, 999), band: clamp((m.pots && m.pots.band) | 0, 0, 999) },
      food: clamp(isFinite(m.food) ? +m.food : 100, 0, 100), water: clamp(isFinite(m.water) ? +m.water : 100, 0, 100), infect: clamp(m.infect | 0, 0, 2), cold: 0, hasSkin: !!m.hasSkin,
      lost: (m.lost | 0) & 30, pro: (m.pro | 0) & 30, cst: CST_MAX, body: Object.fromEntries(BODY_PARTS.map(k => [k, clamp(m.body && isFinite(m.body[k]) ? +m.body[k] : 100, 0, 100)])),
      bleed: Object.fromEntries(BODY_PARTS.map(k => [k, clamp(m.bleed && isFinite(m.bleed[k]) ? +m.bleed[k] : 0, 0, 2)])), aim: 'torso',
      maxHp: maxHpFor(cls, lvl), maxMp: maxMpFor(cls, lvl), hp: 0, mp: 0,
      target: null, nextAtk: 0, cds: {}, buffs: {}, casting: null, lastCombat: 0, potCd: 0, lastMv: now_(),
      downed: null, carriedBy: null, carrying: null, revive: null, quests: {}, qdone: {}, inv: {},
    };
    if (m.inv) for (const k in LOOT) if (m.inv[k] > 0) np.inv[k] = clamp(m.inv[k] | 0, 0, 999);
    np.tree = cleanTree(cls, lvl, m.tree); np.use = {}; if (m.use && typeof m.use === 'object') for (const k in USE) if (isFinite(m.use[k])) np.use[k] = clamp(+m.use[k], 0, 1e6);
    np.maxHp = maxHpOf(np); np.maxMp = maxMpOf(np);
    if (m.quests) for (const q of QUESTS) if (m.quests[q.id] != null) np.quests[q.id] = clamp(m.quests[q.id] | 0, 0, q.count);
    if (m.qdone) for (const q of QUESTS) if (m.qdone[q.id]) np.qdone[q.id] = m.qdone[q.id] | 0;
    np.hp = np.maxHp; np.mp = np.maxMp;
    if (!m.lvl) { np.gold = 30; np.pots.hp = 3; np.pots.mp = 2; np.pots.band = 3; } // kit inicial
    S.players[from] = np;
    if (m.dev && typeof crypto !== 'undefined' && crypto.subtle) crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(m.dev))).then(buf => {
      const h = [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
      if (h !== DEV_HASH || !S.players[from]) { Net.toOne(from, { t: 'dev', ok: 0 }); return; }
      if (m.devMode === 'normal') { np.devPowers = true; Net.toOne(from, { t: 'dev', ok: 1, mode: 'normal' }); return; }   // criador com a vocação normal (toma dano, monstros atacam), mas com o painel
      np.dev = true; np.skin = 'weaver'; np.devHidden = false; Net.toOne(from, { t: 'dev', ok: 1 }); Net.toAll({ t: 'pinfo', p: pinfo(np) });
    });
    Net.toOne(from, { t: 'welcome', you: from, x: np.x, y: np.y, players: Object.values(S.players).map(pinfo), objs: S.objMods || {} });
    Net.toOthers({ t: 'pinfo', p: pinfo(np) }, from);
    sendStat(np);
    sys(`${np.name}, ${CLASSES[cls].name}, chegou à Cidadela de Sxan.`);
    return;
  }
  if (!p) return;
  switch (m.t) {
    case 'mv': handleMove(p, m); break;
    case 'target': p.target = m.id && S.monsters[m.id] ? m.id : null; break;
    case 'tlearn': {
      const T = TREE[p.cls]; if (!T) break; let ok = false; p.tree = p.tree || {};
      T.forEach(b => b.nodes.forEach((nd, i) => { if (nd.id !== m.id) return; const r = p.tree[nd.id] | 0; if (r >= nd.max || treePts(p) >= p.lvl - 1 || branchPts(p, b) < TREE_REQ[i]) return; p.tree[nd.id] = r + 1; ok = true; }));
      if (!ok) { tell(p, 'Não dá para aprender isso agora.'); break; }
      { const rh = p.hp / Math.max(1, p.maxHp), rm = p.mp / Math.max(1, p.maxMp); p.maxHp = maxHpOf(p); p.maxMp = maxMpOf(p); if (!p.downed) { p.hp = Math.max(1, Math.round(p.maxHp * rh)); p.mp = Math.round(p.maxMp * rm); } }
      sendStat(p); break;
    }
    case 'tskill': treeSkill(p, m.b | 0, m); break;
    case 'draw': bowDraw(p, !!m.on); break;
    case 'loose': bowLoose(p, m); break;
    case 'pullarrow': pullArrow(p); break;
    case 'grab': startGrab(p, m); break;
    case 'cookat': cookAt(p, String(m.r)); break;
    case 'release': stopDrag(p); break;
    case 'struggle': if (!tiedStruggle(p)) struggle(p); break;
    case 'untie': untie(p, m); break;
    case 'shoot': {
      const now = now_(); if (p.cls === 'knight' || p.downed || p.carrying || p.lifted || p.atk || p.casting || p.grabbed || now < p.nextAtk) break;
      const rng = CLASSES[p.cls].range + treeEff(p, 'range'), a = +m.a || 0, ok = q => q && Math.abs((q.z || 0) - (p.z || 0)) < 0.5 && (q.alt || 0) < 1.2 && dist(p.x, p.y, q.x, q.y) <= rng + (MON[q.type].rad || 0);
      let q = S.monsters[m.id]; if (!ok(q)) q = null;
      if (!q) { let best = 1e9; for (const o of Object.values(S.monsters)) { if (!ok(o)) continue; const da = Math.abs(angDiff(Math.atan2(o.y - p.y, o.x - p.x), a)); if (da > 0.5) continue; const sc = da * 4 + dist(p.x, p.y, o.x, o.y); if (sc < best) { best = sc; q = o; } } }
      if (!q) break;
      p.target = q.id; basicAttack(p, q, now); break;
    }
    case 'chat': { const text = String(m.text || '').slice(0, 140).trim(); if (text) Net.toAll({ t: 'chat', id: from, name: p.name, text }); break; }
    case 'skill': if (!p.downed) useSkill(p, m.i | 0); break;
    case 'pot': if (!p.downed) usePot(p, m.k); break;
    case 'npc': npcAction(p, m); break;
    case 'revive': {
      const t = S.players[m.id];
      if (m.on && t && !t.downed && t !== p && !p.downed && t.hp < t.maxHp * KNEEL_HP && dist(p.x, p.y, t.x, t.y) <= 1.8) { t.aid = { by: p.id, start: now_() }; near(t.x, t.y, { t: 'rv', id: t.id, by: p.id }); }
      else if (!m.on && t && t.aid && t.aid.by === p.id) { t.aid = null; near(t.x, t.y, { t: 'rv', id: t.id, by: null }); }
      else if (m.on && t && t.downed && !t.decap && !p.downed && dist(p.x, p.y, t.x, t.y) <= 1.8) { t.revive = { by: p.id, start: now_() }; near(t.x, t.y, { t: 'rv', id: t.id, by: p.id }); }
      else if (!m.on && t && t.revive && t.revive.by === p.id) { t.revive = null; near(t.x, t.y, { t: 'rv', id: t.id, by: null }); }
      break;
    }
    case 'carry': {
      if (p.carrying) { dropCarried(p); break; }
      const t = S.players[m.id];
      if (t && t.downed && !t.carriedBy && !p.downed && dist(p.x, p.y, t.x, t.y) <= 1.8) {
        p.carrying = t.id; t.carriedBy = p.id; t.revive = null;
        near(p.x, p.y, { t: 'carry', by: p.id, id: t.id });
      }
      break;
    }
    case 'giveup': if (p.downed) respawnTemple(p); break;
    case 'climb': {
      const b = BUILDINGS[m.b | 0]; if (!b || b.kind !== 'stairtower' || p.downed || p.carriedBy) break;
      const cx = b.x + 1, cy = b.y + 1; if (dist(p.x, p.y, cx, cy) > 1.3) break;
      if (m.up) { p.x = cx; p.y = cy; p.z = 1; }
      else { const [dx, dy] = doorTile(b); p.x = (dx + cx) / 2; p.y = (dy + cy) / 2; p.z = 0; }
      p.lastMv = now_(); p.sit = null;
      if (p.carrying) { const t = S.players[p.carrying]; if (t) { t.x = p.x; t.y = p.y; t.z = p.z; } }
      Net.toOne(p.id, { t: 'tp', x: p.x, y: p.y, z: p.z, climb: (m.b | 0) + 1 });
      break;
    }
    case 'floor': {
      const b = BUILDINGS[m.b | 0], to = m.to | 0, fl = p.fl || 0; if (!b || p.downed || p.carriedBy || Math.abs(to - fl) !== 1 || to < 0 || to >= floorsOf(b)) break;
      const sw = stairWorld(b, Math.min(fl, to)); if (dist(p.x, p.y, (sw.L[0] + sw.U[0]) / 2, (sw.L[1] + sw.U[1]) / 2) > 2.2) break;
      const [ax, ay] = to > fl ? sw.arrive : sw.entry; p.x = ax; p.y = ay; p.fl = to; p.fb = to > 0 ? (m.b | 0) : -1; p.lastMv = now_(); p.sit = null;
      if (p.carrying) { const t = S.players[p.carrying]; if (t) { t.x = p.x; t.y = p.y; t.fl = p.fl; t.fb = p.fb; } }
      Net.toOne(p.id, { t: 'tp', x: p.x, y: p.y, z: 0, fl: p.fl, fb: p.fb });
      break;
    }
    case 'lift': {
      const i = m.i | 0, o = WORLD.obj[i], tx = i % MAP_W, ty = Math.floor(i / MAP_W);
      if (!THROWABLE[o] || p.lifted || p.carrying || p.downed || p.z >= 0.5 || p.fl > 0 || dist(p.x, p.y, tx, ty) > 1.7) break;
      p.lifted = o; setObj(i, O.NONE); (S.objBack = S.objBack || []).push({ i, o, at: now_() + 180000 });
      break;
    }
    case 'throw': {
      if (!p.lifted || p.downed) break;
      const o = p.lifted; p.lifted = null;
      let tx = +m.tx, ty = +m.ty; if (!isFinite(tx) || !isFinite(ty)) break;
      const d0 = dist(p.x, p.y, tx, ty); if (d0 > 7) { tx = p.x + (tx - p.x) / d0 * 7; ty = p.y + (ty - p.y) / d0 * 7; }
      const ms = 260 + dist(p.x, p.y, tx, ty) * 70;
      near(p.x, p.y, { t: 'throwfx', o, fx: p.x, fy: p.y, tx, ty, ms, by: p.id });
      setTimeout(() => {
        const dmg = THROWABLE[o] + p.lvl * 2;
        for (const q of Object.values(S.monsters)) {
          if (q.z || dist(q.x, q.y, tx, ty) > 1.3 + (MON[q.type].rad || 0) * 0.5) continue;
          q.stunUntil = Math.max(q.stunUntil, now_() + 900); hitRolled(p, q, dmg, false, 0, 1);
        }
      }, ms);
      break;
    }
    case 'dev': {
      if (!p.dev && !p.devPowers) break;
      const x = +m.x, y = +m.y;
      if (m.a === 'summon' && isFinite(x) && isFinite(y) && inBounds(Math.round(x), Math.round(y))) {
        const t = Math.round(y) * MAP_W + Math.round(x), top = WORLD.ground[t] === T.CLIFF && WORLD.fl1[t] > 0;
        if (m.kind === 'mon' && MON[m.v]) spawnAt(m.v, x, y, { z: top ? 1 : 0, sleep: !!MON[m.v].dragon, ang: 0 });
        else if (m.kind === 'obj' && O[m.v] != null && WORLD.bld[t] < 0) setObj(t, O[m.v]);
      } else if (m.a === 'clear') { for (const id in S.monsters) { const q = S.monsters[id]; if (dist(q.x, q.y, p.x, p.y) < 12) { delete S.monsters[id]; near(q.x, q.y, { t: 'mdie', id: q.id, d: 0 }); } } }
      else if (m.a === 'heal') { p.hp = p.maxHp; p.mp = p.maxMp; sendStat(p); }
      else if (m.a === 'hide') p.devHidden = !!m.on;
      else if (m.a === 'dragon') { const dm = Object.values(S.monsters).find(q => MON[q.type].dragon); if (dm) { dm.sleep = false; dm.aggro = null; startPatrol(dm, now_()); } }
      else if (m.a === 'tp' && isFinite(x) && isFinite(y)) { p.x = clamp(x, 1, MAP_W - 2); p.y = clamp(y, 1, MAP_H - 2); p.z = +m.z || 0; p.fl = 0; p.fb = -1; Net.toOne(p.id, { t: 'tp', x: p.x, y: p.y, z: p.z, fl: 0, fb: -1 }); }
      break;
    }
    case 'atk': playerStrike(p, m.k, +m.a, now_()); break;
    case 'parry': if (m.on) { if (p.atk && !p.atk.done && p.cst >= FEINT_COST) { p.cst -= FEINT_COST; p.atk = null; } if (!p.atk && !p.downed && now_() >= (p.stunUntil || 0)) p.parry = { t0: now_(), a: +m.a || 0 }; } else p.parry = null; break;
    case 'parrya': if (p.parry && isFinite(+m.a)) p.parry.a = +m.a; break;
    case 'dodge': { const now = now_(); const lg = (p.lost || 0) & ~(p.pro || 0) & 24; if (lg || now < (p.knockUntil || 0) || p.downed || now < (p.dodgeCd || 0) || p.cst < DODGE.cost * Math.max(0.4, 1 - treeEff(p, 'dodgeCost') - useBonus(p, 'dodge')) || now < (p.stunUntil || 0)) break; p.cst -= DODGE.cost * Math.max(0.4, 1 - treeEff(p, 'dodgeCost') - useBonus(p, 'dodge')); useGain(p, 'dodge', 1); p.dodgeCd = now + DODGE.cd; p.dodgeUntil = now + DODGE.iframe; p.dodgeAllow = now + DODGE.ms + 400; p.parry = null; if (p.atk && !p.atk.done) p.atk = null; near(p.x, p.y, { t: 'anim', w: 'p', id: p.id, a: 'dash', ms: DODGE.ms + 120 }); sendStat(p);
      if (p.burnUntil > now) { p.burnUntil -= 3000; if (p.burnUntil <= now + 400) extinguish(p, 'Você rola no chão e apaga o fogo.'); else near(p.x, p.y, { t: 'burn', id: p.id, ms: p.burnUntil - now }); }
      break; }
    case 'kick': playerKick(p, +m.a || 0, now_()); break;
    case 'duel': p.duel = !!m.on; break;
    case 'aim': if (['head', 'torso', 'legs'].includes(m.z)) p.aim = m.z; break;
    case 'band': bandage(p); break;
    case 'use': useItem(p, String(m.k)); break;
    case 'harvest': {
      const i = m.i | 0, o = WORLD.obj[i], x = i % MAP_W, y = Math.floor(i / MAP_W); if (p.downed || dist(p.x, p.y, x, y) > 1.8 || (o !== O.BERRY && o !== O.HERB)) break;
      const k = o === O.BERRY ? 'berries' : 'herb', n = o === O.BERRY ? 2 + (Math.random() < 0.5 ? 1 : 0) : 1;
      if (!p.inv[k] && Object.keys(p.inv).length >= INV_SLOTS) { tell(p, 'Inventário cheio.'); break; }
      p.inv[k] = (p.inv[k] || 0) + n + (Math.random() < useBonus(p, 'skin') * 2 ? 1 : 0); useGain(p, 'skin', 1); setObj(i, o === O.BERRY ? O.BUSH : O.NONE); (S.objBack = S.objBack || []).push({ i, o, at: now_() + (o === O.BERRY ? 240000 : 300000) });
      Net.toOne(p.id, { t: 'loot', k }); sendStat(p); break;
    }
    case 'cook': cookOrDrink(p, 'cook'); break;
    case 'drinkw': cookOrDrink(p, 'drink'); break;
    case 'skin': {
      const c = S.corpses && S.corpses[m.id]; if (!c || c.looted || p.downed || dist(p.x, p.y, c.x, c.y) > 1.9) break;
      lootCorpse(p, c); break;
    }
    case 'open': {
      const c = S.chests && S.chests[m.id]; if (!c || p.downed || dist(p.x, p.y, c.x, c.y) > 2) break;
      if (!c.who.has(p.id)) { tell(p, 'Este baú não é seu: você não lutou contra o chefe.'); break; }
      if (c.opened.has(p.id)) break;
      c.opened.add(p.id);
      const gold = rint(90, 160); p.gold += gold; p.pots.hp += 2;
      const items = [MON[c.boss].trophy]; if (Math.random() < 0.5) items.push('gem');
      for (const k of items) if (k && LOOT[k]) { p.inv[k] = Math.min(999, (p.inv[k] || 0) + 1); Net.toOne(p.id, { t: 'loot', k }); }
      Net.toOne(p.id, { t: 'chestopen', id: c.id, gold, items }); sendStat(p);
      break;
    }
    case 'emote': { const k = ['salute', 'dance', 'point', 'cheer', 'surprise', 'adore', 'anger', 'fear', 'sad'].includes(m.k) ? m.k : null; if (k && !p.downed) near(p.x, p.y, { t: 'emote', id: p.id, k }); break; }
    case 'exec': {   // entrega o condenado caído ao carrasco: deita na guilhotina, a lâmina cai e a cabeça rola (morte permanente)
      const v = S.players[p.carrying] || (p.drag && p.drag.k === 'p' && p.drag.mode !== 'grip' ? S.players[p.drag.id] : null); if (!v || !v.downed || STAGE.x < 0 || v.execAt || dist(p.x, p.y, STAGE.x, STAGE.y) > 3.4) break;
      if (!npcAlive('executioner')) { tell(p, 'Não há carrasco para executar ninguém.'); break; }
      if (p.carrying) dropCarried(p); else stopDrag(p); startExecution(v, p.name); break; const now = now_(); v.x = STAGE.x; v.y = STAGE.y; v.z = 0; v.execAt = now + 2600; v.downed.until = Math.max(v.downed.until, now + 12000);
      near(STAGE.x, STAGE.y, { t: 'exec', id: v.id, x: STAGE.x, y: STAGE.y, ms: 2600 }); sys(p.name + ' levou ' + v.name + ' ao cadafalso!');
      setTimeout(() => { const q = S.players[v.id]; if (!q) return; q.execAt = 0; if (!q.downed) return; q.downed = null; severPlayer(q, 'head', { x: STAGE.x, y: STAGE.y + 1, name: 'o Carrasco' }); }, 2600);
      break;
    }
    case 'sleep': {
      if (!m.on || p.downed || p.carrying || p.carriedBy) { p.sleep = null; break; }
      const b = BEDS[m.b | 0]; if (!b || dist(p.x, p.y, b.x, b.y) > 2.6) break;
      p.x = b.x; p.y = b.y; p.dir = dirFromVec(b.dx, b.dy, 0); p.sleep = m.b | 0; p.sit = null; p.walking = false; break;
    }
    case 'sit': {
      if (!m.on || p.downed || p.carrying || p.carriedBy) { p.sit = null; break; }
      const st = m.s != null ? WORLD.seats[m.s | 0] : null;
      if (st) { if (dist(p.x, p.y, st.x, st.y) > 2.5) break; p.x = st.x; p.y = st.y; p.dir = st.dir; p.sit = 'c'; }
      else p.sit = 'g';
      p.walking = false;
      break;
    }
  }
}

function handleMove(p, m) {
  if (p.carriedBy) return;
  if (p.grabbed || p.dragBy || p.gripBy || now_() < (p.flungUntil || 0) || now_() < (p.knockUntil || 0)) return;
  if (p.sleep != null && m.w) p.sleep = null;   // voando / derrubado
  if (p.dev) { const x = +m.x, y = +m.y; if (isFinite(x) && isFinite(y)) { p.x = clamp(x, 1, MAP_W - 2); p.y = clamp(y, 1, MAP_H - 2); p.z = +m.z || 0; p.dir = m.d | 0; p.walking = !!m.w; p.lastMv = now_(); } return; }
  const now = now_();
  const x = +m.x, y = +m.y;
  if (!isFinite(x) || !isFinite(y)) return;
  const z = heightAt(x, y, p.z);
  const dt = Math.min(1, (now - p.lastMv) / 1000);
  const maxStep = PLAYER_SPEED * (m.sl || now < (p.dodgeAllow || 0) ? RUN_MUL * 2.6 : m.r ? RUN_MUL * 1.5 : 1.7) * (dt + 0.25) + 0.4;
  const ok = dist(p.x, p.y, x, y) <= maxStep && canStandZ(x, y, z, 0.18, p.fl || 0, p.fb ?? -1) && Math.abs(z - (+m.z || 0)) < 0.45;
  if (!ok) { Net.toOne(p.id, { t: 'tp', x: p.x, y: p.y, z: p.z, fl: p.fl || 0, fb: p.fb ?? -1 }); return; }
  if (p.sit && dist(p.x, p.y, x, y) > 0.05) p.sit = null;
  p.x = x; p.y = y; p.z = z; p.dir = m.d | 0; p.walking = !!m.w; p.running = !!m.r; p.crouch = !!m.c; p.slide = !!m.sl; p.tired = !!m.ti; p.lastMv = now;
  if (p.casting && dist(p.x, p.y, p.castX, p.castY) > 0.3) { p.casting = null; near(p.x, p.y, { t: 'castend', id: p.id }); }
  if (p.carrying) { const t = S.players[p.carrying]; if (t) { t.x = p.x; t.y = p.y; t.z = p.z; } }
}

function dropCarried(p) {
  const t = S.players[p.carrying];
  p.carrying = null;
  if (!t) return;
  t.carriedBy = null;
  for (const [dx, dy] of [[0.6, 0], [-0.6, 0], [0, 0.6], [0, -0.6], [0, 0]]) if (canStandZ(p.x + dx, p.y + dy, p.z)) { t.x = p.x + dx; t.y = p.y + dy; break; }
  t.z = p.z;
  near(p.x, p.y, { t: 'carry', by: p.id, id: null });
  t.fl = p.fl || 0; t.fb = p.fb ?? -1;
  Net.toOne(t.id, { t: 'tp', x: t.x, y: t.y, z: t.z, fl: t.fl, fb: t.fb });
}

function hostOnLeave(id) {
  const p = S.players[id];
  if (!p) return;
  if (p.carrying) dropCarried(p);
  if (p.carriedBy && S.players[p.carriedBy]) S.players[p.carriedBy].carrying = null;
  delete S.players[id];
  Net.toAll({ t: 'pleave', id });
  sys(`${p.name} deixou a cidadela.`);
}

// ---------------- combate ----------------
function roll(p, mult = 1, tgt = null) {
  const c = CLASSES[p.cls], l = p.lvl;
  let dmg = rint(Math.floor(c.dmg[0][0] + c.dmg[0][1] * l), Math.floor(c.dmg[1][0] + c.dmg[1][1] * l)) * mult;
  if (buffOn(p, 'mead')) dmg *= 1.1;
  if (p.hp < p.maxHp * KNEEL_HP) dmg *= 0.7;   // de joelhos: golpes fracos
  if (p.body) dmg *= ((p.lost || 0) & LOST.armA) ? (((p.pro || 0) & LOST.armA) ? 0.6 : 0.3) : ARM_DMG[PART_STATE(p.body.armA)];   // braço da arma ferido / perdido (gancho ajuda)
  dmg *= p._aimMul || 1;
  if (buffOn(p, 'whet')) dmg *= 1.15;
  dmg *= 1 + treeEff(p, 'dmg') + (p._el === 'fire' ? treeEff(p, 'fire') : p._el === 'ice' ? treeEff(p, 'ice') : 0) + useBonus(p, p._melee ? MELEE_USE[p.cls] : RANGED_USE[p.cls]);
  if (tgt && MON[tgt.type] && MON[tgt.type].beh) dmg *= 1 + treeEff(p, 'beast');
  if (buffOn(p, 'banner')) dmg *= 1.15;
  const crit = p._forceCrit || Math.random() < c.crit + treeEff(p, 'crit') + (buffOn(p, 'agile') ? 0.1 : 0);
  if (crit) dmg *= 1.8 + treeEff(p, 'critDmg');
  return { dmg: Math.max(1, Math.round(dmg)), crit };
}

function hitRolled(p, m, dmg, crit, delay, hv) {
  if (!S.monsters[m.id]) return;
  m.hp -= dmg; m.aggro = p.id; m.returning = false;
  p.lastCombat = now_();
  near(m.x, m.y, { t: 'hit', k: 'm', id: m.id, x: m.x, y: m.y, dmg, crit, d: delay, by: p.id, ax: p.x, ay: p.y, hv, z: m._hz }); m._hz = null;
  if (m.hp <= 0) killMonster(m, p, delay);
}
function hitMonster(p, m, mult, delay = 0) {
  if (!S.monsters[m.id]) return;
  const { dmg, crit } = roll(p, mult, m);
  m.hp -= dmg; m.aggro = p.id; m.returning = false;
  p.lastCombat = now_();
  near(m.x, m.y, { t: 'hit', k: 'm', id: m.id, x: m.x, y: m.y, dmg, crit, d: delay, by: p.id, ax: p.x, ay: p.y, hv: mult >= 2 ? 1 : 0 });
  if (m.hp <= 0) killMonster(m, p, delay);
}

function lootCorpse(p, c, auto) {
  c.looted = true; useGain(p, 'skin', 1);
  if (c.gold) { const g = Math.round(c.gold * (1 + useBonus(p, 'skin'))); p.gold += g; Net.toOne(p.id, { t: 'lootgold', g }); }
  for (const k of c.items) { if (!p.inv[k] && Object.keys(p.inv).length >= INV_SLOTS) { tell(p, 'Inventário cheio.'); c.looted = false; c.gold = 0; c.items = c.items.slice(c.items.indexOf(k)); break; } p.inv[k] = Math.min(999, (p.inv[k] || 0) + 1); Net.toOne(p.id, { t: 'loot', k }); }
  if (c.looted) c.items = [];
  if (!auto && !c.gold && !c.items.length && c.looted) tell(p, 'Nada de útil aqui.');
  sendStat(p);
}
function killMonster(m, p, delay) {
  delete S.monsters[m.id];
  near(m.x, m.y, { t: 'mdie', id: m.id, d: delay });
  for (const id in S.players) if (S.players[id].target === m.id) S.players[id].target = null;
  const def = MON[m.type];
  // o corpo fica no chão (até o monstro voltar) com o ouro e os recursos dentro: é preciso revistar/esfolar (segurar F)
  const gold = rint(def.gold[0], def.gold[1]), drops = [];
  for (const [k, ch] of MON_LOOT[m.type] || []) if (Math.random() < ch) drops.push(k);
  if (Math.random() < 0.03) drops.push('gem');
  if (m.type !== 'wisp') (S.corpses = S.corpses || {})[m.id] = { lost: m.lost || 0, id: m.id, type: m.type, x: m.x, y: m.y, z: m.z || 0, gold, items: drops, looted: !gold && !drops.length, until: now_() + (m.bs && (BASTIONS.find(b => b.id === m.bs) || {}).fast ? 20000 : def.dragon ? (BASTIONS.find(b => b.id === 'dragon') || {}).respawn || BOSS_RESPAWN : def.boss ? BOSS_RESPAWN : BASTION_RESPAWN), ix: m.x - p.x, iy: m.y - p.y };
  { const c = S.corpses && S.corpses[m.id]; if (c && !c.looted && p && S.players[p.id] && !p.downed && dist(p.x, p.y, c.x, c.y) < 16) setTimeout(() => { if (!c.looted && S.players[p.id]) lootCorpse(p, c, true); }, (delay || 0) + 250); }
  if (def.boss) spawnChest(m);
  const group = Object.values(S.players).filter(q => !q.downed && dist(q.x, q.y, m.x, m.y) <= 10);
  if (!group.includes(p)) group.push(p);
  const share = Math.ceil(def.xp * (group.length > 1 ? 0.7 : 1));
  for (const q of group) { gainXp(q, share, delay + 400); questCredit(q, m.type); }
}

function questCredit(p, type) {
  for (const q of QUESTS) {
    if (q.mon !== type || p.quests[q.id] == null) continue;
    p.quests[q.id]++;
    if (p.quests[q.id] >= q.count) {
      delete p.quests[q.id];
      p.qdone[q.id] = (p.qdone[q.id] || 0) + 1;
      p.gold += q.gold;
      Net.toOne(p.id, { t: 'qdone', id: q.id });
      gainXp(p, q.xp, 600);
    } else Net.toOne(p.id, { t: 'qprog', id: q.id, n: p.quests[q.id] });
    sendStat(p);
  }
}

function gainXp(p, amount, delay = 0) {
  p.xp += amount;
  sfx(p.x, p.y, `+${amount} xp`, '#b9a8f0', delay);
  let up = false;
  while (p.xp >= need(p.lvl)) { p.xp -= need(p.lvl); p.lvl++; up = true; }
  if (up) {
    p.maxHp = maxHpOf(p); p.maxMp = maxMpOf(p);
    if (!p.downed) { p.hp = p.maxHp; p.mp = p.maxMp; }
    aoe('lvlup', p.x, p.y, { id: p.id, d: delay });
    sys(`${p.name} alcançou o nível ${p.lvl}.`);
    Net.toAll({ t: 'pinfo', p: pinfo(p) });
  }
  sendStat(p);
}

// ---------- corpo: qual parte foi atingida e o que isso causa ----------
function pickPart(m) {
  const z = HIT_ZONES[m ? HIT_CAT(m.type) : 'mid'], r = Math.random();
  if (r < z[0]) return 'head'; if (r < z[0] + z[1]) return 'torso';
  if (r < z[0] + z[1] + z[2]) return Math.random() < 0.55 ? 'armA' : 'armB';
  return Math.random() < 0.5 ? 'legL' : 'legR';
}
function woundPart(p, part, dmg) {
  if (!p.body) return;
  const before = PART_STATE(p.body[part]);
  p.body[part] = Math.max(0, p.body[part] - dmg / p.maxHp * 100 * 2.2);
  const after = PART_STATE(p.body[part]);
  if (after > before || (dmg >= p.maxHp * 0.12 && Math.random() < 0.5)) p.bleed[part] = Math.min(2, Math.max(p.bleed[part] || 0, BLEED_RATE[Math.max(1, after)]));
  if (after > before) Net.toOne(p.id, { t: 'wound', part, st: after });
}
// ---------- sobrevivência: fome, sede, frio, infecção ----------
function nearFire(p, r = 3.2) {
  if (S.fires && S.fires.some(f => dist(f.x, f.y, p.x, p.y) < r)) return true;
  for (let y = Math.round(p.y) - 3; y <= Math.round(p.y) + 3; y++) for (let x = Math.round(p.x) - 3; x <= Math.round(p.x) + 3; x++) { if (!inBounds(x, y)) continue; const o = WORLD.obj[y * MAP_W + x]; if ((o === O.CAMPFIRE || o === O.BRAZIER || o === O.TORCH) && dist(x, y, p.x, p.y) < r) return true; }
  return false;
}
function survFactor(p) { return ((p.food ?? 100) < 30 ? 0.6 : 1) * ((p.water ?? 100) < 30 ? 0.7 : 1) * ((p.cold || 0) > 50 ? 0.6 : 1) * (p.infect ? 0.7 : 1); }
function survivalTick(p, now, dt) {
  if (p.dev || p.downed) return;
  const busy = (p.running && p.walking) || now - p.lastCombat < 4000 ? 1.5 : 1, sick = now < (p.sickUntil || 0);
  p.food = Math.max(0, (p.food ?? 100) - dt * 100 / (SURV.foodMin * 60) * busy);
  p.water = Math.max(0, (p.water ?? 100) - dt * 100 / (SURV.waterMin * 60) * busy * (sick ? 2.5 : 1));
  if (p.water < 25 && !p.atk && !p.parry) drinkCanteen(p, now);   // bebe sozinho do cantil quando a sede aperta
  // frio: à noite, fora da cidade, longe do fogo e fora de casa
  const night = dayInfo().night, indoor = p.fl > 0 || bldAt(p.x, p.y) >= 0, warm = !night || indoor || nearFire(p);
  p.cold = clamp((p.cold || 0) + dt * (warm ? -2.5 : inSafe(p.x, p.y) ? 0.2 : 100 / (SURV.coldMin * 60)), 0, 100);
  // infecção: ferida grave sem bandagem pode infeccionar; piora com o tempo
  p.band = p.band || {};
  for (const k of BODY_PARTS) if (p.band[k] && p.body[k] >= 70) delete p.band[k];
  if (now > (p.infCheck || 0)) { p.infCheck = now + 30000; if (!p.infect && BODY_PARTS.some(k => !((p.lost || 0) & (LOST[k] || 0)) && PART_STATE(p.body[k]) >= 2 && !p.band[k]) && Math.random() < SURV.infectChance) { p.infect = 1; p.infT = 0; tell(p, 'Uma ferida infeccionou. Você está com febre. Use unguento ou procure a sacerdotisa.'); } }
  if (p.infect) { p.infT = (p.infT || 0) + dt; if (p.infect === 1 && p.infT > 300) { p.infect = 2; tell(p, 'A infecção piorou.'); } }
  // dano por fome, sede, frio extremo e infecção (acumulado)
  const drain = ((p.food <= 0 ? 0.1 : 0) + (p.water <= 0 ? 0.17 : 0) + (p.cold >= 100 ? 0.125 : 0) + (p.infect === 1 ? 0.05 : p.infect === 2 ? 0.2 : 0)) / 100 * p.maxHp * dt;
  if (drain > 0) { p.survAcc = (p.survAcc || 0) + drain; if (p.survAcc >= 1) { const h = Math.floor(p.survAcc); p.survAcc -= h; p.hp -= h; if (p.hp <= 0) { p.hp = 0; goDown(p, null); } } }
}
function drinkCanteen(p, now, manual) {
  if (p.downed || p.grabbed || now < (p.drinkT || 0)) return;
  if ((p.water ?? 100) >= 99) { if (manual) tell(p, 'Você não está com sede.'); return; }
  p.drinkT = now + 2600; p.water = Math.min(100, (p.water ?? 100) + 45);
  near(p.x, p.y, { t: 'anim', w: 'p', id: p.id, a: 'drinkb', ms: 1600 }); sendStat(p);
}
function useItem(p, k) {
  const now = now_(); if (p.downed || now < (p.useT || 0)) return; p.useT = now + 600;
  if (k === 'water') { drinkCanteen(p, now, true); return; }
  if (!p.inv[k]) return;
  const take = () => { if (--p.inv[k] <= 0) delete p.inv[k]; };
  if (FOOD[k]) { take(); p.food = Math.min(100, p.food + FOOD[k] * (1 + useBonus(p, 'cook'))); if (k === 'stew') { p.water = Math.min(100, (p.water ?? 100) + 20); p.hp = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * 0.15)); } if (k === 'cookedmeat') p.water = Math.max(0, p.water - 5); if ((k === 'venison' || k === 'pork') && Math.random() < 0.3) { p.sickUntil = now + 120000; tell(p, 'A carne crua caiu mal. Você está enjoado (sede dobrada por 2 min).'); } else tell(p, 'Você comeu ' + LOOT[k].name.toLowerCase() + '.'); }
  else if (k === 'ointment') { take(); p.infect = 0; p.infT = 0; tell(p, 'O unguento arde, mas a febre baixa.'); }
  else if (k === 'tea') { take(); p.water = Math.min(100, (p.water ?? 100) + 35); p.infect = Math.max(0, (p.infect || 0) - 1); tell(p, 'O chá quente acalma e mata a sede.'); }
  else if (k === 'herb') { take(); useGain(p, 'aid', 1); p.infect = Math.max(0, (p.infect || 0) - 1); p.infT = 0; for (const b of BODY_PARTS) if (p.bleed[b] > 0 && p.bleed[b] <= 0.6) p.bleed[b] = 0; tell(p, 'A erva amarga acalma a febre e estanca os cortes leves.'); }
  else if (k === 'firewood') {
    const tx = Math.round(p.x + Math.cos(p.fa || 0)), ty = Math.round(p.y + Math.sin(p.fa || 0)), t = ty * MAP_W + tx;
    if (!inBounds(tx, ty) || WORLD.obj[t] !== O.NONE || WORLD.bld[t] >= 0 || WORLD.ground[t] === T.WATER || WORLD.ground[t] === T.CLIFF) { tell(p, 'Não dá para acender a fogueira aí.'); return; }
    take(); setObj(t, O.CAMPFIRE); (S.objBack = S.objBack || []).push({ i: t, o: O.NONE, at: now + 180000 }); tell(p, 'Fogueira acesa. Dura uns 3 minutos.');
  }
  sendStat(p);
}
function cookOrDrink(p, what) {
  if (p.downed) return;
  if (what === 'cook') {
    if (!nearFire(p, 1.9)) return; let n = 0;
    for (const k of ['venison', 'pork']) { n += p.inv[k] || 0; delete p.inv[k]; }
    if (!n) { tell(p, 'Nada para assar.'); return; }
    if (!p.inv.cookedmeat && Object.keys(p.inv).length >= INV_SLOTS) { tell(p, 'Inventário cheio.'); return; }
    p.inv.cookedmeat = (p.inv.cookedmeat || 0) + n; useGain(p, 'cook', n); tell(p, n + ' carne' + (n > 1 ? 's assadas' : ' assada') + '.'); sendStat(p);
  } else if (what === 'drink') {
    let ok = false; for (let y = Math.round(p.y) - 2; y <= Math.round(p.y) + 2 && !ok; y++) for (let x = Math.round(p.x) - 2; x <= Math.round(p.x) + 2; x++) { if (!inBounds(x, y)) continue; const i = y * MAP_W + x, g = WORLD.ground[i], o = WORLD.obj[i]; if ((g === T.WATER || g === T.SHALLOW || o === O.WELL || o === O.FOUNTAIN) && dist(x, y, p.x, p.y) < 1.9) { ok = true; break; } }
    if (!ok) return; near(p.x, p.y, { t: 'anim', w: 'p', id: p.id, a: 'scoop', ms: 1500 }); p.water = 100; if (p.hasSkin) p.pots.water = 5; tell(p, p.hasSkin ? 'Você bebeu e encheu o odre.' : 'Você bebeu até matar a sede.'); sendStat(p);
  }
}
// morte permanente: o personagem acaba
function permaDeath(p, reason) {
  Net.toOne(p.id, { t: 'dead', reason, lvl: p.lvl, name: p.name });
  sys(`${p.name} morreu ${reason}. Que a Aurora o receba.`);
  if (p.carrying) dropCarried(p);
  if (p.carriedBy && S.players[p.carriedBy]) S.players[p.carriedBy].carrying = null;
  delete S.players[p.id]; Net.toAll({ t: 'pleave', id: p.id });
}
function bodyTick(p, now, dt) {
  if (!p.body || p.downed || p.dev) return;
  let tot = 0; for (const k of BODY_PARTS) tot += p.bleed[k] || 0;
  tot = Math.min(2.5, tot);
  if (tot > 0) {
    p.bleedAcc = (p.bleedAcc || 0) + p.maxHp * tot / 100 * dt;
    if (p.bleedAcc >= 1) { const h = Math.floor(p.bleedAcc); p.bleedAcc -= h; p.hp -= h; if (p.hp <= 0) { p.hp = 0; goDown(p, null); return; } }
    for (const k of BODY_PARTS) if (p.bleed[k] > 0 && p.bleed[k] <= 0.3) p.bleed[k] = Math.max(0, p.bleed[k] - 0.006 * dt);   // feridas leves estancam sozinhas
  } else if (now - p.lastCombat > 8000) {
    if (p.infect !== 2) for (const k of BODY_PARTS) { if ((p.lost || 0) & (LOST[k] || 0)) continue; const h = p.body[k]; p.body[k] = h >= 40 ? Math.min(100, h + 0.4 * dt) : Math.min(40, h + 0.08 * dt); }   // grave só cicatriza até "ferido" (o resto, só com a sacerdotisa)
  }
  if (now - (p.bodySent || 0) > 2000) { p.bodySent = now; sendStat(p); }
}
function bandage(p) {
  const now = now_(); if (p.downed || now < (p.bandT || 0)) return;
  const worst = BODY_PARTS.slice().sort((a, b) => (p.bleed[b] - p.bleed[a]) || (p.body[a] - p.body[b]))[0];
  if (p.pots.band > 0) {
    p.bandT = now + 1800; const x0 = p.x, y0 = p.y;
    Net.toOne(p.id, { t: 'banding', ms: 1500 });
    setTimeout(() => { if (p.downed || dist(p.x, p.y, x0, y0) > 0.4) { tell(p, 'Você se mexeu: a bandagem soltou.'); return; } p.pots.band--; p.bleed[worst] = 0; if (p.arrows && p.arrows.some(a => a.part === worst)) { p.arrows = p.arrows.filter(a => a.part !== worst); near(p.x, p.y, { t: 'unstick', k: 'p', id: p.id, part: worst }); } (p.band = p.band || {})[worst] = true; p.body[worst] = Math.min(100, p.body[worst] + 12); tell(p, 'Bandagem em ' + BODY_NAMES[worst].toLowerCase() + '.'); sendStat(p); }, 1500);
    return;
  }
  const fire = S.fires && S.fires.some(f => dist(f.x, f.y, p.x, p.y) < 1.8);
  let nearFire = fire; for (let y = Math.round(p.y) - 2; y <= Math.round(p.y) + 2 && !nearFire; y++) for (let x = Math.round(p.x) - 2; x <= Math.round(p.x) + 2; x++) { const o = WORLD.obj[y * MAP_W + x]; if ((o === O.CAMPFIRE || o === O.TORCH || o === O.BRAZIER) && dist(x, y, p.x, p.y) < 1.8) { nearFire = true; break; } }
  if (!nearFire) { tell(p, 'Sem bandagem e sem fogo por perto para cauterizar.'); return; }
  p.bandT = now + 2000; p.band = p.band || {}; for (const k of BODY_PARTS) { p.bleed[k] = 0; if (PART_STATE(p.body[k]) >= 2) p.band[k] = true; }
  const h = Math.round(p.maxHp * 0.1); p.hp -= h; near(p.x, p.y, { t: 'hit', k: 'p', id: p.id, x: p.x, y: p.y, dmg: h, d: 0 });
  tell(p, 'Você cauterizou as feridas no fogo. Dói, mas o sangue parou.'); if (p.hp <= 0) { p.hp = 0; goDown(p, null); } sendStat(p);
}
function damagePlayer(p, raw, m, delay = 0, zone = null, exactPart = null) {
  if (p.dev) return;   // o Tecelão não se fere
  if (p.sleep != null) p.sleep = null;
  if (p.downed) {
    // lobos atacam quem está caído: a pessoa sangra mais rápido
    if (m && MON[m.type] && MON[m.type].beh === 'pred' && m.id != null && S.monsters[m.id] && !m.dragging && !p.dragBy && !p.carriedBy && !p.tied && Math.random() < 0.3) { m.dragging = p.id; m.dragUntil = now_() + 6000; p.dragBy = 'w:' + m.id; p.dragMode = 'foot'; }
    if (m && MON[m.type] && MON[m.type].beh === 'pred') { p.downed.until -= 2500; near(p.x, p.y, { t: 'hit', k: 'p', id: p.id, x: p.x, y: p.y, dmg: 0, d: delay, ax: m.x, ay: m.y }); }
    return;
  }
  const c = CLASSES[p.cls];
  let mult = 1 - c.armor;
  if (buffOn(p, 'wall')) mult *= 0.4;
  if (buffOn(p, 'warcry')) mult *= 0.8;
  if (buffOn(p, 'bless')) mult *= 0.9;
  mult *= Math.max(0.4, 1 - treeEff(p, 'armor')); if (buffOn(p, 'iron')) mult *= 0.6; if (buffOn(p, 'sanct')) mult *= 0.75;
  useGain(p, 'vigor', 0.5);
  if (p.body && PART_STATE(p.body.armB) >= 2) mult = Math.min(1, mult * 1.25);
  const part = exactPart || (zone ? pick(STRIKE_PART[zone]) : pickPart(m)), headK = part === 'head' ? 1.25 : 1;
  const dmg = Math.max(1, Math.round(raw * mult * headK));
  woundPart(p, part, dmg);
  p.hp -= dmg;
  p.lastCombat = now_();
  near(p.x, p.y, { t: 'hit', k: 'p', id: p.id, x: p.x, y: p.y, dmg, d: delay, ax: m ? m.x : p.x, ay: m ? m.y : p.y - 1 });
  if (p.hp > 0) { sendStat(p); return; }
  goDown(p, m);
}

// ---------------- caído (downed) ----------------
function goDown(p, m) {
  if (p.drag) stopDrag(p);
  if (m && m.id != null && m.type && CAPTORS.has(m.type) && S.monsters[m.id] && !p.dev && !inSafe(p.x, p.y) && Math.random() < 0.7) setTimeout(() => { if (S.monsters[m.id] && p.downed) S.monsters[m.id].carryWant = p.id; }, 1200);
  p.lifted = null;
  p.hp = 0; p.downed = { until: now_() + DOWNED_MS }; p.target = null; p.casting = null; p.revive = null;
  if (p.carrying) dropCarried(p);
  for (const id in S.monsters) { const q = S.monsters[id]; if (q.aggro === p.id) q.aggro = null; if (q.taunt && q.taunt.pid === p.id) q.taunt = null; }
  near(p.x, p.y, { t: 'down', id: p.id });
  sys(`${p.name} caiu diante de ${m ? (m.name || (MON[m.type] && MON[m.type].name) || 'um inimigo') : 'um inimigo'}. Ajude-o!`);
  sendStat(p);
}
function revivePlayer(p, frac, by) {
  if (!p.downed) return;
  p.downed = null; p.revive = null;
  if (p.carriedBy && S.players[p.carriedBy]) { const c = S.players[p.carriedBy]; c.carrying = null; near(c.x, c.y, { t: 'carry', by: c.id, id: null }); }
  p.carriedBy = null;
  p.hp = Math.max(1, Math.round(p.maxHp * frac));
  p.lastCombat = 0;
  near(p.x, p.y, { t: 'up', id: p.id });
  aoe('heal', p.x, p.y, { id: p.id });
  sys(by ? `${by} reanimou ${p.name}.` : `${p.name} foi reanimado.`);
  Net.toOne(p.id, { t: 'tp', x: p.x, y: p.y, z: p.z, fl: p.fl || 0, fb: p.fb ?? -1 });
  sendStat(p);
}
function respawnTemple(p) {
  if (p.arrows && p.arrows.length) { p.arrows = []; near(p.x, p.y, { t: 'unstick', k: 'p', id: p.id, all: 1 }); }
  if (PERMADEATH && !p.dev && !p.devPowers) { permaDeath(p, p.decap ? 'decapitado' : 'sangrando no chão'); return; }
  if (p.carriedBy && S.players[p.carriedBy]) S.players[p.carriedBy].carrying = null;
  p.carriedBy = null; p.downed = null; p.revive = null;
  p.xp = Math.floor(p.xp / 2);
  p.hp = p.maxHp; p.mp = p.maxMp; p.lastCombat = 0; p.atk = null; p.parry = null; p.cst = CST_MAX; p.lost = (p.lost || 0) & ~LOST.head; p.decap = false; p.knockUntil = 0;
  if (p.body) for (const k of BODY_PARTS) { if (p.lost & (LOST[k] || 0)) { p.body[k] = 0; p.bleed[k] = 0; continue; } p.body[k] = 100; p.bleed[k] = 0; }
  const s = townSpot(); p.x = s.x; p.y = s.y; p.z = 0; p.fl = 0; p.fb = -1;
  Net.toOne(p.id, { t: 'tp', x: p.x, y: p.y, z: 0 });
  Net.toOne(p.id, { t: 'respawned' });
  near(p.x, p.y, { t: 'up', id: p.id });
  sendStat(p);
}

const flight = (ax, ay, bx, by) => 120 + Math.hypot(ax - bx, ay - by) * 55;

// monstro atrás do jogador (para os giros de 180°)
function monBehind(p, m, range) {
  const fx = m.x - p.x, fy = m.y - p.y, fl = Math.hypot(fx, fy) || 1;
  let best = null, bd = 1e9;
  for (const id in S.monsters) { const q = S.monsters[id]; if (q === m) continue; const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy); if (d > range || d < 0.3) continue; if ((dx * fx + dy * fy) / (d * fl) > -0.5) continue; if (d < bd) { bd = d; best = q; } }
  return best;
}
function shot(p, kind, tx, ty, d, delay) { near(p.x, p.y, { t: 'proj', id: p.id, kind, tx, ty, d, delay }); }
function basicAttack(p, m, now) {
  const z = p.aim || 'torso';
  if (Math.random() > AIM_ACC[z]) { p.nextAtk = now + CLASSES[p.cls].atkMs; anim('p', p, p.cls === 'knight' ? 'swing' : p.cls === 'archer' ? 'shoot' : 'bolt', m.x, m.y); near(m.x, m.y, { t: 'miss', id: m.id }); return; }   // errou
  p._aimMul = AIM_DMG[z];
  try { basicAttack0(p, m, now); } finally { p._aimMul = 1; }
  if (p.cls !== 'knight') useGain(p, RANGED_USE[p.cls], 1);
  if (p.body && PART_STATE(p.body.armA) >= 2) p.nextAtk += CLASSES[p.cls].atkMs * (PART_STATE(p.body.armA) === 3 ? 0.5 : 0.2);
  if (S.monsters[m.id]) { if (z === 'legs') m.slowUntil = Math.max(m.slowUntil, now + 2500); else if (z === 'head' && Math.random() < 0.15) m.stunUntil = Math.max(m.stunUntil, now + 700); }
}
function basicAttack0(p, m, now) {
  const c = CLASSES[p.cls], r = Math.random();
  const kneel = p.hp < p.maxHp * KNEEL_HP;
  p.nextAtk = now + c.atkMs * (buffOn(p, 'agile') ? 0.5 : 1) * (kneel ? 1.5 : 1) * (1 - Math.min(0.4, treeEff(p, 'aspd')));
  if (kneel) { if (p.cls === 'knight') { const { dmg, crit } = roll(p, 1); anim('p', p, 'swing', m.x, m.y); hitRolled(p, m, dmg, crit, 180, 0); } else { const kind = p.cls === 'archer' ? 'arrow' : 'bolt', d = flight(p.x, p.y, m.x, m.y) + 180; anim('p', p, p.cls === 'archer' ? 'shoot' : 'bolt', m.x, m.y, { proj: kind, d }); hitMonster(p, m, 1, d); } return; }
  if (p.cls === 'knight') {
    const { dmg, crit } = roll(p, 1);
    if (dmg >= m.hp && r < 0.6) { anim('p', p, 'execute', m.x, m.y); hitRolled(p, m, Math.max(dmg, m.hp), true, 380, 1); return; }   // golpe na cabeça: termina o inimigo
    if (r < 0.25 && dist(p.x, p.y, m.x, m.y) < 1.25) {                                                                              // chute: empurra 1 tile
      anim('p', p, 'kick', m.x, m.y); hitRolled(p, m, dmg, crit, 260, 0);
      const dx = m.x - p.x, dy = m.y - p.y, l = Math.hypot(dx, dy) || 1, nx = m.x + dx / l, ny = m.y + dy / l;
      if (S.monsters[m.id] && monStand(nx, ny, m)) { m.x = nx; m.y = ny; m.stunUntil = Math.max(m.stunUntil, now + 500); }
      return;
    }
    anim('p', p, 'swing', m.x, m.y); hitRolled(p, m, dmg, crit, 180, 0); return;
  }
  const kind = p.cls === 'archer' ? 'arrow' : 'bolt', base = p.cls === 'archer' ? 'shoot' : 'bolt', d = flight(p.x, p.y, m.x, m.y) + (p.cls === 'archer' ? 200 : 150);
  if (r < 0.25) {
    if (p.cls === 'archer') { anim('p', p, 'quiver', m.x, m.y, { proj: kind, d: d + 260 }); hitMonster(p, m, 1.25, d + 260); return; }     // flecha do quiver: +25%
    const n = Object.values(S.monsters).filter(q => q !== m && dist(q.x, q.y, m.x, m.y) <= 1.8).sort((a, b) => dist(a.x, a.y, m.x, m.y) - dist(b.x, b.y, m.x, m.y))[0];
    anim('p', p, 'dualcast', m.x, m.y, { proj: kind, d }); hitMonster(p, m, 1, d);                                                          // duas mãos: acerta um vizinho
    if (n) { shot(p, kind, n.x, n.y, d, 60); hitMonster(p, n, 0.6, d + 60); }
    return;
  }
  if (r < 0.5) {
    const back = monBehind(p, m, c.range);
    if (back) {                                                                                                                            // giro de 180°: segundo alvo atrás
      const a = p.cls === 'archer' ? 'turnshot' : 'turncast', ms = 950;
      anim('p', p, a, m.x, m.y, { proj: kind, d }); hitMonster(p, m, 1, d);
      const d2 = flight(p.x, p.y, back.x, back.y) + 120; shot(p, kind, back.x, back.y, d2, ms * 0.62); hitMonster(p, back, 0.8, ms * 0.62 + d2);
      return;
    }
  }
  anim('p', p, base, m.x, m.y, { proj: kind, d }); hitMonster(p, m, 1, d);
}

// ---------------- habilidades ----------------
function useSkill(p, i) {
  const sk = SKILLS[p.cls][i], now = now_();
  p._el = sk.el; setTimeout(() => { p._el = null; }, 0); if (p.cls === 'mage') useGain(p, 'magic', 2);
  if (!sk || p.casting || p.carrying) return;
  if (now < (p.cds[i] || 0)) return;
  if (p.mp < sk.mp) { tell(p, 'Mana insuficiente.'); return; }
  if (p.hp < p.maxHp * KNEEL_HP) { tell(p, 'De joelhos, sem forças para isso.'); return; }
  let m = null;
  if (sk.tgt) {
    m = S.monsters[p.target];
    if (!m) { tell(p, 'Selecione um alvo.'); return; }
    if (dist(p.x, p.y, m.x, m.y) > sk.range + (MON[m.type].rad || 0)) { tell(p, 'Alvo fora de alcance.'); return; }
  }
  const offensive = sk.id !== 'heal' && sk.id !== 'wall' && sk.id !== 'agile';

  p.mp -= sk.mp; p.cds[i] = now + sk.cd;
  if (sk.cast) {
    p.casting = { i, until: now + sk.cast * (1 - Math.min(0.5, treeEff(p, 'castSpeed'))), tid: m && m.id }; p.castX = p.x; p.castY = p.y;
    near(p.x, p.y, { t: 'cast', id: p.id, ms: sk.cast, s: sk.name, el: sk.el });
  } else execSkill(p, i, m);
  sendStat(p);
}
function monstersNear(x, y, r) { return Object.values(S.monsters).filter(m => dist(m.x, m.y, x, y) <= r); }

function execSkill(p, i, m) {
  const sk = SKILLS[p.cls][i], now = now_();
  p._el = sk.el; setTimeout(() => { p._el = null; }, 0); if (p.cls === 'mage') useGain(p, 'magic', 2);
  if (sk.tgt && (!m || !S.monsters[m.id])) return;
  const tx = m ? m.x : p.x, ty = m ? m.y : p.y;
  const shout = { s: sk.name + '!' };
  switch (sk.id) {
    case 'bash': anim('p', p, 'bash', tx, ty, shout); hitMonster(p, m, 2.2, 220); m.stunUntil = now + 1400; break;
    case 'warcry':
      anim('p', p, 'warcry', tx, ty, shout); aoe('warcry', p.x, p.y); p.buffs.warcry = now + 6000;
      for (const q of monstersNear(p.x, p.y, 5)) { q.taunt = { pid: p.id, until: now + 6000 }; q.returning = false; }
      p.lastCombat = now; break;
    case 'whirl': anim('p', p, 'spin', tx, ty, shout); aoe('whirl', p.x, p.y, { id: p.id }); for (const q of monstersNear(p.x, p.y, 1.8)) hitMonster(p, q, 1.6, 250); break;
    case 'wall': anim('p', p, 'block', tx, ty, shout); aoe('wall', p.x, p.y, { id: p.id }); p.buffs.wall = now + 6000; break;
    case 'double': { const d = flight(p.x, p.y, m.x, m.y) + 180; anim('p', p, 'double', tx, ty, { ...shout, proj: 'arrow', d, n: 2 }); hitMonster(p, m, 1, d); hitMonster(p, m, 1, d + 160); break; }
    case 'pierce': {
      const dx = m.x - p.x, dy = m.y - p.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
      anim('p', p, 'pierce', tx, ty, shout); aoe('pierce', p.x, p.y, { x2: p.x + ux * 8, y2: p.y + uy * 8 });
      for (const q of Object.values(S.monsters)) {
        const rx = q.x - p.x, ry = q.y - p.y, along = rx * ux + ry * uy;
        if (along < 0 || along > 8) continue;
        if (Math.abs(rx * uy - ry * ux) < 0.7) hitMonster(p, q, 1.8, 150 + along * 40);
      }
      break;
    }
    case 'rain': anim('p', p, 'rain', tx, ty, shout); aoe('rain', tx, ty); for (const q of monstersNear(tx, ty, 1.6)) hitMonster(p, q, 1.3, 650); break;
    case 'agile': anim('p', p, 'dash', tx, ty, shout); aoe('agile', p.x, p.y, { id: p.id }); p.buffs.agile = now + 6000; break;
    case 'fireball': { const d = flight(p.x, p.y, m.x, m.y) + 100; anim('p', p, 'fireball', tx, ty, { ...shout, proj: 'fire', d }); hitMonster(p, m, 2.6, d); aoe('boom', tx, ty, { d }); break; }
    case 'nova': anim('p', p, 'nova', tx, ty, shout); aoe('nova', p.x, p.y); for (const q of monstersNear(p.x, p.y, 2.5)) { q.slowUntil = now + 4000 * (1 + treeEff(p, 'slowDur')); hitMonster(p, q, 1.4, 200); } break;
    case 'heal':
      anim('p', p, 'heal', tx, ty, shout);
      for (const q of Object.values(S.players)) {
        if (dist(q.x, q.y, p.x, p.y) > 4) continue;
        if (q.downed) { revivePlayer(q, 0.25, p.name); continue; }
        const h = Math.min(q.maxHp - q.hp, Math.round((20 + p.lvl * 5 + q.maxHp * 0.15) * (1 + treeEff(p, 'holy'))));
        q.hp += h; aoe('heal', q.x, q.y, { id: q.id }); sfx(q.x, q.y, `+${h}`, '#7ad87a', 150); sendStat(q);
      }
      break;
    case 'meteor': anim('p', p, 'meteor', tx, ty, shout); aoe('meteor', tx, ty); for (const q of monstersNear(tx, ty, 2.5)) hitMonster(p, q, 3.2, 750); break;
  }
}

function usePot(p, k) {
  const now = now_();
  if (!ITEMS[k] || p.pots[k] <= 0 || now < p.potCd) return;
  p.potCd = now + 1000; p.pots[k]--;
  useGain(p, 'aid', 1);
  if (k === 'hp') { const h = Math.min(p.maxHp - p.hp, Math.ceil(p.maxHp * 0.35 * (1 + useBonus(p, 'aid')))); p.hp += h; sfx(p.x, p.y, `+${h}`, '#7ad87a'); }
  else { const h = Math.min(p.maxMp - p.mp, Math.ceil(p.maxMp * 0.4)); p.mp += h; sfx(p.x, p.y, `+${h}`, '#6a9ae8'); }
  aoe('potion', p.x, p.y, { id: p.id, k });
  sendStat(p);
}

// ---------------- NPCs ----------------
function npcAction(p, m) {
  const n = NPCS.find(q => q.id === m.n);
  { const sn = S.npcs && S.npcs[m.n]; if (sn && (sn.dead || sn.downed)) { tell(p, sn.dead ? sn.name + ' está morto.' : sn.name + ' está caído e não responde.'); return; } }
  if (!n || dist(p.x, p.y, (S.npcs && S.npcs[n.id] ? S.npcs[n.id].x : n.x), (S.npcs && S.npcs[n.id] ? S.npcs[n.id].y : n.y)) > 3.5) { tell(p, 'Chegue mais perto para conversar.'); return; }
  const say = text => Net.toOne(p.id, { t: 'npc', n: n.id, text });
  const pay = cost => { if (p.gold < cost) { say('Você não tem ouro suficiente.'); return false; } p.gold -= cost; return true; };
  const now = now_();
  if (m.a === 'buyl' && LOOT[m.item] && ((n.id === 'merchant' && ['bread', 'ointment', 'firewood'].includes(m.item)) || (n.id === 'fruit' && ['apple', 'berries'].includes(m.item)))) {
    const qty = m.qty === 5 ? 5 : 1; if (!p.inv[m.item] && Object.keys(p.inv).length >= INV_SLOTS) { say('Sua mochila está cheia.'); return; }
    if (!pay(LOOT[m.item].price * qty)) return; p.inv[m.item] = (p.inv[m.item] || 0) + qty; say(qty + 'x ' + LOOT[m.item].name + '. Bom proveito.');
  } else if (n.id === 'priest' && m.a === 'treset') {
    if (!treePts(p)) { say('Você ainda não aprendeu nenhum talento.'); return; }
    if (!pay(20 * p.lvl)) return; p.tree = {}; p.maxHp = maxHpOf(p); p.maxMp = maxMpOf(p); p.hp = Math.min(p.hp, p.maxHp); p.mp = Math.min(p.mp, p.maxMp);
    say('Respire fundo e esqueça... Seus pontos de talento voltaram para você.');
  } else if (n.id === 'merchant' && m.a === 'buy' && m.item === 'water') {
    if (!pay(ITEMS.water.price)) return; p.hasSkin = true; p.pots.water = 5; say('Um odre cheio. Encha em rios, poços e fontes.');
  } else if (n.id === 'merchant' && m.a === 'buy' && ITEMS[m.item]) {
    const qty = m.qty === 5 ? 5 : 1;
    if (!pay(ITEMS[m.item].price * qty)) return;
    p.pots[m.item] += qty;
    say(`${qty}x ${ITEMS[m.item].name}. Boa caçada, e volte inteiro.`);
  } else if (n.id === 'merchant' && m.a === 'sell') {
    let total = 0, n2 = 0;
    for (const k in p.inv) { if (!LOOT[k] || (m.item && m.item !== k) || (!m.item && ['bread', 'cookedmeat', 'ointment', 'firewood', 'berries', 'herb', 'apple', 'stew', 'pie', 'tea'].includes(k))) continue; total += LOOT[k].price * p.inv[k]; n2 += p.inv[k]; delete p.inv[k]; }
    if (!n2) { say('Você não tem nada que me interesse agora.'); return; }
    p.gold += total;
    say(`Fechado: ${n2} ${n2 > 1 ? 'itens' : 'item'} por ${total} de ouro. Traga mais quando puder.`);
  } else if (n.id === 'smith' && m.a === 'prosth') {
    const part = ['legL', 'legR', 'armA', 'armB'].find(k => (p.lost || 0) & LOST[k] && !((p.pro || 0) & LOST[k]));
    if (!part) { say('Você está inteiro. Volte se precisar de mim.'); return; }
    if (!pay(PROSTH_PRICE)) return;
    p.pro = (p.pro || 0) | LOST[part]; p.bleed[part] = 0;
    say(part.startsWith('leg') ? 'Perna de pau de carvalho, presa com couro e ferro. Não vai correr, mas anda.' : 'Um gancho de ferro bem preso. Não segura espada, mas fere.');
  } else if (n.id === 'priest' && m.a === 'ritual') {
    if (!(p.lost & 30)) { say('A Aurora vê que você está inteiro.'); return; }
    if (!pay(RITUAL_PRICE)) return;
    p.lost = 0; p.pro = 0; for (const k of BODY_PARTS) { p.body[k] = 100; p.bleed[k] = 0; } aoe('heal', p.x, p.y, { id: p.id });
    say('Pelo fogo da Aurora, o que foi tirado volta a ser seu. Não desperdice este milagre.');
  } else if (n.id === 'priest' && m.a === 'bless') {
    p.hp = p.maxHp; p.mp = p.maxMp; p.buffs.bless = now + 180000;
    if (p.body) for (const k of BODY_PARTS) { if ((p.lost || 0) & (LOST[k] || 0)) continue; p.body[k] = 100; p.bleed[k] = 0; }   // a sacerdotisa trata todas as feridas
    p.infect = 0; p.infT = 0; p.cold = 0;
    aoe('heal', p.x, p.y, { id: p.id });
    say('Que a Aurora guarde seus passos. Suas feridas estão fechadas, e a bênção reduz o dano que você recebe por algum tempo.');
  } else if (n.id === 'innkeeper' && m.a === 'mead') {
    if (!pay(15)) return;
    p.buffs.mead = now + 180000;
    say('Hidromel da casa. Aquece o sangue: +10% de dano e recuperação mais rápida por 3 minutos.');
  } else if (n.id === 'innkeeper' && m.a === 'stew') {
    if (!pay(10)) return;
    p.hp = p.maxHp; p.mp = p.maxMp; p.food = 100; p.water = 100; p.cold = 0;
    say('Ensopado de javali, como minha mãe fazia. Coma com calma.');
  } else if (n.id === 'innkeeper' && m.a === 'rumor') {
    say(pick(RUMORS));
  } else if (n.id === 'smith' && m.a === 'whet') {
    if (!pay(25)) return;
    p.buffs.whet = now + 240000;
    say('Pronto. Fio de navalha. Vai cortar como se fosse nova por uns quatro minutos (+15% de dano).');
  } else if (n.id === 'smith' && m.a === 'talk') {
    say(pick(['Aço bom não se apressa. Nem guerreiro bom.', 'Os orcs a oeste usam ferro ruim, mas batem forte. Mantenha o escudo alto.', 'Essa cidadela já caiu uma vez. Não vai cair de novo enquanto eu tiver carvão.']));
  } else if (n.id === 'captain' && m.a === 'quest') {
    const q = QUESTS.find(x => x.id === m.id);
    if (!q) return;
    if (p.quests[q.id] != null) { say(`Você já está nessa: ${p.quests[q.id]}/${q.count}.`); return; }
    if (Object.keys(p.quests).length >= MAX_ACTIVE_QUESTS) { say(`Uma coisa de cada vez. No máximo ${MAX_ACTIVE_QUESTS} contratos ao mesmo tempo.`); return; }
    p.quests[q.id] = 0;
    say(`Contrato aceito: ${q.name}. Recompensa de ${q.xp} xp e ${q.gold} de ouro quando terminar.`);
  } else if (n.id === 'captain' && m.a === 'abandon') {
    delete p.quests[m.id];
    say('Contrato cancelado. Sem ressentimentos.');
  }
  sendStat(p);
}

// ---------------- monstros (movimento livre) ----------------
function moveToward(m, tx, ty, step) {
  const dx = tx - m.x, dy = ty - m.y, d = Math.hypot(dx, dy);
  if (d < 0.02) return true;
  const s = Math.min(d, step), nx = m.x + dx / d * s, ny = m.y + dy / d * s;
  const sdx = (nx - m.x) - (ny - m.y);
  if (Math.abs(sdx) > 0.001) m.face = sdx > 0 ? 1 : -1;
  if (monStand(nx, ny, m)) { m.x = nx; m.y = ny; return true; }
  if (monStand(nx, m.y, m)) { m.x = nx; return true; }
  if (monStand(m.x, ny, m)) { m.y = ny; return true; }
  return false;
}
function clearLine(ax, ay, bx, by) {
  const d = Math.hypot(bx - ax, by - ay), n = Math.ceil(d / 0.4);
  for (let k = 1; k < n; k++) { const t = k / n; if (!canStand(ax + (bx - ax) * t, ay + (by - ay) * t, 0, 0.25)) return false; }
  return true;
}
function tilePath(sx, sy, tx, ty, maxNodes = 400) {
  sx = Math.round(sx); sy = Math.round(sy); tx = Math.round(tx); ty = Math.round(ty);
  const key = (x, y) => y * MAP_W + x, start = key(sx, sy), prev = new Map([[start, -1]]), q = [[sx, sy]];
  for (let qi = 0; qi < q.length && qi < maxNodes; qi++) {
    const [x, y] = q[qi];
    if (Math.max(Math.abs(x - tx), Math.abs(y - ty)) <= 1) {
      const path = []; let k = key(x, y);
      while (k !== start) { path.push([k % MAP_W, Math.floor(k / MAP_W)]); k = prev.get(k); }
      return path.reverse();
    }
    for (const [dx, dy] of DIRS8) {
      const nx = x + dx, ny = y + dy, k = key(nx, ny);
      if (prev.has(k) || !walkableTile(nx, ny) || inSafe(nx, ny)) continue;
      if (dx && dy && (!walkableTile(x + dx, y) || !walkableTile(x, y + dy))) continue;
      prev.set(k, key(x, y)); q.push([nx, ny]);
    }
  }
  return null;
}
function chase(m, tx, ty, step, now) {
  if (clearLine(m.x, m.y, tx, ty)) { m.path = null; moveToward(m, tx, ty, step); return; }
  if (!m.path || now > m.pathT) { m.path = tilePath(m.x, m.y, tx, ty); m.pathT = now + 700; }
  if (m.path && m.path.length) {
    const [wx, wy] = m.path[0];
    moveToward(m, wx, wy, step);
    if (dist(m.x, m.y, wx, wy) < 0.25) m.path.shift();
  }
}

function monsterThink(m, players, now, dt) {
  const d = MON[m.type];
  if (m.atk) { const A = m.atk; if (!A.done && now >= A.t0 + A.W) { A.done = true; resolveMonStrike(m, A, now); } if (now >= A.t0 + A.W + A.R + A.C) m.atk = null; else return; }
  if (d.dragon) return dragonThink(m, players, now, dt);
  if (m.gripBy) { const g = S.players[m.gripBy]; if (!g || !g.drag || g.drag.id !== m.id || now > m.escAt) { m.gripBy = null; m.dragBy = null; if (g && g.drag && g.drag.id === m.id) stopDrag(g, MON[m.type].name + ' se soltou!'); m.stunUntil = 0; } else return; }
  if (now < m.stunUntil) return;
  if (m.dragging && wolfDragTick(m, now, dt)) return;
  if ((m.carrying || m.carryWant) && captorTick(m, now, dt)) return;
  const speed = d.speed * (now < m.slowUntil ? 0.5 : 1) * ((m.lost || 0) & 24 ? 0.4 : 1), step = speed * dt;
  const homeDist = dist(m.x, m.y, m.homeX, m.homeY);
  const reach = d.big ? 1.7 : 1.3;
  if (m.returning) {
    if (homeDist <= 1.5) { m.returning = false; m.aggro = null; }
    else chase(m, m.homeX, m.homeY, step * 1.1, now);
    return;
  }
  // fauna que foge: ao ser atacada, corre para longe de quem atacou
  if (d.beh === 'flee' && m.aggro) { m.flee = { from: m.aggro, until: now + 4500 }; m.aggro = null; }
  if (m.flee && m.flee.until > now) {
    const pl = S.players[m.flee.from];
    if (pl) { const ax = m.x - pl.x, ay = m.y - pl.y, l = Math.hypot(ax, ay) || 1; if (!moveToward(m, m.x + ax / l * 2, m.y + ay / l * 2, step * 1.35)) { const a = Math.random() * 6.28; moveToward(m, m.x + Math.cos(a), m.y + Math.sin(a), step); } }
    m.wander = null; return;
  }
  let tgt = null;
  const pred = d.beh === 'pred';
  const valid = p => p && !p.dev && !buffOn(p, 'smoke') && (!p.downed || (pred && !p.carriedBy)) && p.z < 0.5 && !inSafe(p.x, p.y);
  // lobo: sempre caça quem está de joelhos ou caído; quem está cansado, 50% de chance (sorteio renovado a cada 8 s)
  const prey = p => {
    if (!pred) return true;
    if (p.downed || p.hp < p.maxHp * KNEEL_HP) return true;
    if (p.hp < p.maxHp * 0.6 || p.tired) { m.prey = m.prey || {}; let r = m.prey[p.id]; if (!r || now > r.t) r = m.prey[p.id] = { ok: Math.random() < 0.5, t: now + 8000 }; return r.ok; }
    return false;
  };
  if (m.taunt && m.taunt.until > now && valid(S.players[m.taunt.pid])) tgt = S.players[m.taunt.pid];
  if (!tgt && m.aggro && valid(S.players[m.aggro]) && dist(m.x, m.y, S.players[m.aggro].x, S.players[m.aggro].y) <= 11) tgt = S.players[m.aggro];
  if (!tgt) {
    let best = 99;
    if (d.aggro > 0) for (const p of players) { if (!valid(p) || !prey(p)) continue; const dd = dist(m.x, m.y, p.x, p.y); if (dd <= d.aggro * (p.crouch ? 0.5 * (1 - treeEff(p, 'stealth')) : 1) && dd < best) { best = dd; tgt = p; } }
  }
  if (tgt) {
    if (homeDist > 13) { m.returning = true; m.aggro = null; m.taunt = null; return; }
    const dd = dist(m.x, m.y, tgt.x, tgt.y);
    const sdx = (tgt.x - m.x) - (tgt.y - m.y); if (Math.abs(sdx) > 0.05) m.face = sdx > 0 ? 1 : -1;
    if (d.thrower && dd > 2.6 && dd < 7 && now >= (m.cdThrow || 0) && now >= m.nextAtk) {
      m.cdThrow = now + 6500 + Math.random() * 4000; m.nextAtk = now + 1200;
      const tx = tgt.x, ty = tgt.y, ms = 320 + dd * 75;
      anim('m', m, 'bite', tx, ty); near(m.x, m.y, { t: 'throwfx', o: O.ROCK, fx: m.x, fy: m.y, tx, ty, ms, big: d.big ? 1 : 0 });
      setTimeout(() => { if (!S.monsters[m.id] || tgt.downed || dist(tgt.x, tgt.y, tx, ty) > 1.1) return; damagePlayer(tgt, Math.round(rint(d.dmg[0], d.dmg[1]) * 1.15), m, 0); }, ms);
    } else if (dd <= reach + 0.25) {
      if (now >= m.nextAtk && now >= (m.stunUntil || 0)) startMonStrike(m, tgt, now);
    } else {
      chase(m, tgt.x, tgt.y, step, now);
      m.nextAtk = Math.max(m.nextAtk, now + 300);
    }
    m.wander = null;
  } else {
    // patrulha: anda em volta do bastião, de ponto em ponto
    if (m.patrol) { const P = m.patrol, t = P.pts[P.i]; if (!moveToward(m, t[0], t[1], step * 0.5) || dist(m.x, m.y, t[0], t[1]) < 0.6) P.i = (P.i + 1) % P.pts.length; m.homeX = m.x; m.homeY = m.y; return; }
    if (now < m.waitUntil) return;
    if (!m.wander) {
      const a = Math.random() * Math.PI * 2, r = 1 + Math.random() * 4;
      const wx = m.homeX + Math.cos(a) * r, wy = m.homeY + Math.sin(a) * r;
      if (zoneAt(wx, wy) === m.zone && canStand(wx, wy, 0, 0.3)) m.wander = [wx, wy]; else { m.waitUntil = now + 1000; return; }
    }
    const ok = moveToward(m, m.wander[0], m.wander[1], step * 0.45);
    if (!ok || dist(m.x, m.y, m.wander[0], m.wander[1]) < 0.1) { m.wander = null; m.waitUntil = now + 1500 + Math.random() * 4000; }
  }
}

// ---------------- DESMEMBRAMENTO E QUEDAS ----------------
function severPart(k, lost) { const c = (SEVER_FROM[k] || []).filter(([pt]) => !(lost & LOST[pt])); if (!c.length) return null; let r = Math.random() * c.reduce((s, x) => s + x[1], 0); for (const [pt, w] of c) { if ((r -= w) <= 0) return pt; } return c[0][0]; }
function severPlayer(q, part, by) {
  if (!part || q.dev || q.downed) return;
  q.lost = (q.lost || 0) | LOST[part]; q.pro = (q.pro || 0) & ~LOST[part];
  if (part !== 'head') { q.body[part] = 0; q.bleed[part] = 2; }
  near(q.x, q.y, { t: 'sever', k: 'p', id: q.id, part, x: q.x, y: q.y, ax: by.x, ay: by.y });
  if (part === 'head') { q.decap = true; goDown(q, by); q.downed.until = now_() + 1500; tell(q, 'Você foi decapitado.'); }
  else tell(q, 'Você perdeu ' + LOST_NAMES[part] + '! Estanque o sangue (B) ou morra.');
  sendStat(q);
}
function knockPlayer(p, by, now) {
  if (p.dev || p.downed || now < (p.knockUntil || 0) || buffOn(p, 'iron')) return;
  p.knockUntil = now + KNOCK_MS; p.parry = null; p.atk = null; p.stunUntil = now + KNOCK_MS;
  near(p.x, p.y, { t: 'knock', k: 'p', id: p.id, ax: by.x, ay: by.y, ms: KNOCK_MS }); sendStat(p);
}
function knockMon(q, by, now) {
  q.stunUntil = Math.max(q.stunUntil, now + 1500); q.atk = null; q.nextAtk = now + 1700;
  near(q.x, q.y, { t: 'knock', k: 'm', id: q.id, ax: by.x, ay: by.y, ms: 1500 });
}
// ---------------- COMBATE DIRECIONAL ----------------
const inArc = (ox, oy, a, x, y, reach, arc, rad = 0) => { const d = Math.hypot(x - ox, y - oy); return d <= reach + rad && Math.abs(angDiff(Math.atan2(y - oy, x - ox), a)) <= arc + (rad > 0 ? Math.atan2(rad, Math.max(0.3, d)) : 0); };
function startMonStrike(m, tgt, now) {
  const d = MON[m.type], MM = MON_MELEE[m.type], k = MM ? pick(MM.s) : 'bite', B = STRIKES[k];
  const W = Math.round(B.W * (MM ? MM.W : 1)), reach = (MM ? B.reach : B.reach) + (d.big ? 0.5 : 0), a = Math.atan2(tgt.y - m.y, tgt.x - m.x);
  m.atk = { k, t0: now, a, W, R: B.R, C: B.C, reach, arc: B.arc, tgt: tgt.id };
  m.nextAtk = now + W + B.R + B.C + d.atk * 0.35;
  anim('m', m, MM ? 'atk_' + k : 'bite', tgt.x, tgt.y, { ms: W + B.R + B.C, W, ang: a, reach, arc: B.arc });
}
function resolveMonStrike(m, A, now) {
  const d = MON[m.type];
  for (const p of Object.values(S.players)) {
    if (p.dev || p.downed || Math.abs((p.z || 0) - (m.z || 0)) >= 0.5 || !inArc(m.x, m.y, A.a, p.x, p.y, A.reach, A.arc)) continue;
    if (now < (p.dodgeUntil || 0)) { near(p.x, p.y, { t: 'whiff', id: p.id }); continue; }       // esquivou
    if (Math.random() < treeEff(p, 'evade')) { near(p.x, p.y, { t: 'whiff', id: p.id }); continue; }   // reflexos (talento)
    const toM = Math.atan2(m.y - p.y, m.x - p.x);
    if (p.parry && Math.abs(angDiff(p.parry.a, toM)) <= PARRY_ARC) {
      const perfect = now - p.parry.t0 <= PARRY_PERFECT + A.W * 0.25 + treeEff(p, 'parry') + useLvl(p, 'parry') * 0.6; useGain(p, 'parry', perfect ? 3 : 1);
      if (perfect) { m.stunUntil = now + 850; m.nextAtk = Math.max(m.nextAtk, now + 900); p.ripUntil = now + RIPOSTE_MS; p.cst = Math.min(CST_MAX, p.cst + 5); near(p.x, p.y, { t: 'clang', x: (p.x + m.x) / 2, y: (p.y + m.y) / 2, perfect: 1, id: m.id }); }
      else { p.cst -= (10 + (d.big ? 18 : 6)) * ((p.lost || 0) & LOST.armB ? 1.6 : 1) * (1 - useBonus(p, 'parry')); near(p.x, p.y, { t: 'clang', x: (p.x + m.x) / 2, y: (p.y + m.y) / 2 }); if (p.cst <= 0) guardBreak(p, now); }
      sendStat(p); continue;
    }
    const crit = MON_MELEE[m.type] && A.k !== 'stab' && A.k !== 'bite' && Math.random() < (d.big ? 0.12 : 0.07);
    damagePlayer(p, Math.round(rint(d.dmg[0], d.dmg[1]) * STRIKES[A.k].mult * ((m.lost || 0) & 6 ? 0.4 : 1) * (crit ? 1.6 : 1)), m, 0, STRIKES[A.k].zone);
    const svp = crit && !p.downed ? severPart(A.k, p.lost || 0) : null;
    if (svp && (p.body[svp] ?? 100) <= 30 && Math.random() < 0.5) severPlayer(p, svp, m);
    else if (d.big && !p.downed && Math.random() < 0.35 * Math.max(0, 1 - treeEff(p, 'knockRes'))) knockPlayer(p, m, now);
    if (d.drain && !p.downed) { p.mp = Math.max(0, p.mp - d.drain); sendStat(p); }
    if (p.atk && !p.atk.done) { p.atk = null; near(p.x, p.y, { t: 'anim', w: 'p', id: p.id, a: 'hurt' }); }   // levar golpe interrompe a preparação
    if (A.k !== 'stab' && A.k !== 'bite') break;   // golpes de arma acertam um alvo
  }
}
function guardBreak(p, now) { p.parry = null; p.cst = 0; p.stunUntil = now + 950; near(p.x, p.y, { t: 'anim', w: 'p', id: p.id, a: 'hurt', ms: 950 }); tell(p, 'Sua guarda quebrou!'); sendStat(p); }
// golpe do jogador: começa a preparação; o impacto é resolvido no laço principal
function playerStrike(p, k, a, now) {
  const B = STRIKES[k]; if (!B || k === 'bite' || p.downed || p.carrying || p.lifted || p.casting || now < (p.stunUntil || 0) || now < (p.knockUntil || 0) || p.fl > 0) return;
  if (p.atk) {
    if (!p.atk.done && now < p.atk.t0 + p.atk.W && p.atk.k !== k && p.cst >= FEINT_COST) { p.cst -= FEINT_COST; }   // finta: troca de golpe no meio da preparação
    else return;
  } else if (p.cst < B.st) { tell(p, 'Sem fôlego.'); return; }
  else { p.cst -= B.st; useGain(p, 'breath', B.st / 10); }
  const M = MELEE[p.cls] || MELEE.knight, rip = now < (p.ripUntil || 0);
  const W = Math.round(B.W * M.spd * (rip ? 0.55 : 1)), R = B.R, C = Math.round(B.C * M.spd);
  p.atk = { k, t0: now, a: isFinite(a) ? a : 0, W, R, C, reach: B.reach * M.reach, arc: B.arc, rip }; p.parry = null; p.ripUntil = 0; p.lastCombat = now;
  anim('p', p, 'atk_' + k, p.x + Math.cos(p.atk.a), p.y + Math.sin(p.atk.a), { ms: W + R + C, W, ang: p.atk.a, reach: p.atk.reach, arc: B.arc });
  sendStat(p);
}
// duelo: só vale se os dois ligaram o modo duelo e estão fora da cidade
// PvP liberado em todo lugar (cidade e dentro das casas também), entre quem está no mesmo andar
const pvpOk = (a, b) => a !== b && !a.dev && !b.dev && !b.downed && Math.abs((a.z || 0) - (b.z || 0)) < 0.5 && (a.fl || 0) === (b.fl || 0);
// crime na cidade: se uma sentinela vê (até 10 passos, sem parede no meio), o agressor fica procurado por 5 minutos
function sightClear(ax, ay, bx, by) { const n = Math.ceil(dist(ax, ay, bx, by) * 2); for (let i = 1; i < n; i++) { const t = tileAt(ax + (bx - ax) * i / n, ay + (by - ay) * i / n); if (WORLD.bld[t] >= 0 || WORLD.obj[t] === O.WALL || WORLD.obj[t] === O.TOWER || WORLD.ground[t] === T.CLIFF) return false; } return true; }
function witnessCrime(p, x, y) {
  if (!p || p.dev || !inSafe(x, y)) return false;
  const guards = S.npcs ? Object.values(S.npcs).filter(n => n.kind === 'guard' && !n.dead && !n.downed) : NPCS.filter(n => n.kind === 'guard');
  const seen = guards.some(n => dist(n.x, n.y, x, y) <= 10 && sightClear(n.x, n.y, x, y));
  if (!seen) return false;
  const now = now_(), was = now < (p.wanted || 0); p.wanted = now + 300000;
  if (!was) { sys(p.name + ' foi visto cometendo um crime na cidade! As sentinelas estão atrás dele.'); tell(p, 'Uma sentinela viu: você está PROCURADO por 5 minutos (sair da cidade limpa a ficha).'); }
  Net.toAll({ t: 'wanted', id: p.id, ms: 300000 }); return true;
}
function pvpHit(p, q, A, now) {
  witnessCrime(p, p.x, p.y);
  if (now < (q.dodgeUntil || 0)) { near(q.x, q.y, { t: 'whiff', id: q.id }); return; }
  const toP = Math.atan2(p.y - q.y, p.x - q.x);
  if (q.parry && Math.abs(angDiff(q.parry.a, toP)) <= PARRY_ARC) {
    if (now - q.parry.t0 <= PARRY_PERFECT + A.W * 0.25) { p.stunUntil = now + 750; q.ripUntil = now + RIPOSTE_MS; q.cst = Math.min(CST_MAX, q.cst + 5); near(q.x, q.y, { t: 'clang', x: (p.x + q.x) / 2, y: (p.y + q.y) / 2, perfect: 1 }); near(p.x, p.y, { t: 'anim', w: 'p', id: p.id, a: 'hurt', ms: 750 }); sendStat(p); }
    else { q.cst -= 14; near(q.x, q.y, { t: 'clang', x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 }); if (q.cst <= 0) guardBreak(q, now); }
    sendStat(q); return;
  }
  const B = STRIKES[A.k], M = MELEE[p.cls] || MELEE.knight, { dmg } = roll(p, B.mult * M.dmg * (A.rip ? 1.25 : 1));
  const crit = roll(p, 1).crit;
  damagePlayer(q, Math.round(dmg * (crit ? 1.6 : 1)), { x: p.x, y: p.y, name: p.name }, 0, B.zone);
  if (crit && A.k !== 'stab' && !q.downed) severPlayer(q, severPart(A.k, q.lost || 0), { x: p.x, y: p.y, name: p.name });
  if (q.atk && !q.atk.done) { q.atk = null; near(q.x, q.y, { t: 'anim', w: 'p', id: q.id, a: 'hurt' }); }
}
function resolvePlayerStrike(p, A, now) { p._melee = true; try { resolvePlayerStrike0(p, A, now); } finally { p._melee = false; } }
function resolvePlayerStrike0(p, A, now) {
  { const B0 = STRIKES[A.k]; let n = 0; for (const q of Object.values(S.players)) { if (n >= (B0.multi || 1) || !pvpOk(p, q) || !inArc(p.x, p.y, A.a, q.x, q.y, A.reach, A.arc, 0.3)) continue; pvpHit(p, q, A, now); n++; } if (n) return; }
  for (const n of Object.values(S.npcs || {})) { if (n.dead || n.onBack || n.carriedBy || !inArc(p.x, p.y, A.a, n.x, n.y, A.reach, A.arc, 0.3)) continue; const B1 = STRIKES[A.k], M1 = MELEE[p.cls] || MELEE.knight; npcDamage(n, roll(p, B1.mult * M1.dmg).dmg, p); break; }
  const B = STRIKES[A.k], M = MELEE[p.cls] || MELEE.knight;
  const targets = Object.values(S.monsters).filter(q => Math.abs((q.z || 0) - (p.z || 0)) < 0.5 && (q.alt || 0) < 1.2 && inArc(p.x, p.y, A.a, q.x, q.y, A.reach, A.arc, MON[q.type].rad || 0.3)).sort((a, b) => dist(a.x, a.y, p.x, p.y) - dist(b.x, b.y, p.x, p.y)).slice(0, B.multi || 1);
  for (const q of targets) {
    const MM = MON_MELEE[q.type], facing = Math.abs(angDiff(Math.atan2(p.y - q.y, p.x - q.x), q.atk ? q.atk.a : Math.atan2(p.y - q.y, p.x - q.x))) < 1.2;
    if (MM && MM.blk && !q.atk && facing && now > (q.guardBreak || 0) && now >= (q.stunUntil || 0) && Math.random() < MM.blk) {   // o inimigo bloqueou
      near(q.x, q.y, { t: 'clang', x: (p.x + q.x) / 2, y: (p.y + q.y) / 2, blockBy: q.id }); p.atk.C += 220; continue;
    }
    const { dmg, crit } = roll(p, B.mult * M.dmg * (A.rip ? 1.25 : 1));
    const sev = crit && A.k !== 'stab' && MON_LOOK[q.type] ? severPart(A.k, q.lost || 0) : null;
    if (sev) { q.lost = (q.lost || 0) | LOST[sev]; near(q.x, q.y, { t: 'sever', k: 'm', id: q.id, part: sev, x: q.x, y: q.y, ax: p.x, ay: p.y }); }
    q._hz = B.zone; hitRolled(p, q, sev === 'head' ? q.hp + 9999 : dmg, crit, 0, crit ? 1 : 0); useGain(p, MELEE_USE[p.cls], 1);
    if (!S.monsters[q.id]) continue;
    if (sev && sev.startsWith('arm')) q.flee = { from: p.id, until: now + 7000 };
    if (crit && A.k === 'over' && !sev && !MON[q.type].big) knockMon(q, p, now);
    if (q.atk && !q.atk.done && A.k !== 'stab') { q.atk = null; q.nextAtk = now + 600; }   // golpe pesado interrompe o inimigo
    if (A.k === 'over' && Math.random() < 0.18) q.stunUntil = Math.max(q.stunUntil, now + 650);
    if (A.k === 'under') q.slowUntil = Math.max(q.slowUntil, now + 2500);
  }
  if (!targets.length) near(p.x, p.y, { t: 'swoosh', id: p.id });
}
function playerKick(p, a, now) {
  if (p.downed || now < (p.stunUntil || 0) || p.atk || p.cst < KICK.cost || now < (p.kickT || 0)) return;
  p.cst -= KICK.cost; p.kickT = now + 900; p.parry = null;
  anim('p', p, 'kick', p.x + Math.cos(a), p.y + Math.sin(a), { ms: 520 });
  setTimeout(() => {
    for (const q of Object.values(S.monsters)) {
      if (!inArc(p.x, p.y, a, q.x, q.y, KICK.reach, KICK.arc, MON[q.type].rad || 0.3) || MON[q.type].dragon) continue;
      q.guardBreak = now_() + 1600; q.stunUntil = Math.max(q.stunUntil, now_() + (MON[q.type].big ? 350 : KICK.stun)); if (q.atk && !q.atk.done) q.atk = null;
      if (!MON[q.type].big) for (let s = 1; s <= 6; s++) setTimeout(() => { if (!S.monsters[q.id]) return; const nx = q.x + Math.cos(a) * KICK.push / 6, ny = q.y + Math.sin(a) * KICK.push / 6; if (monStand(nx, ny, q)) { q.x = nx; q.y = ny; } }, s * 35);   // empurrão longo
      hitRolled(p, q, Math.max(1, Math.round(p.lvl * 1.5 + 3)), false, 0, 0);
    }
    for (const q of Object.values(S.players)) {   // duelo: o chute quebra a guarda e empurra o outro jogador
      if (!pvpOk(p, q) || !inArc(p.x, p.y, a, q.x, q.y, KICK.reach, KICK.arc, 0.3)) continue;
      if (q.parry) { q.parry = null; q.stunUntil = now_() + 700; near(q.x, q.y, { t: 'anim', w: 'p', id: q.id, a: 'hurt', ms: 700 }); }
      q.dodgeAllow = now_() + 700; Net.toOne(q.id, { t: 'push', a, d: KICK.push }); damagePlayer(q, Math.max(1, Math.round(p.lvl + 3)), { x: p.x, y: p.y, name: p.name }, 0, 'torso'); sendStat(q);
    }
  }, KICK.W);
  sendStat(p);
}
function combatTick(p, now, dt) {
  if (p.atk) { const A = p.atk; if (!A.done && now >= A.t0 + A.W) { A.done = true; resolvePlayerStrike(p, A, now); } if (p.atk && now >= A.t0 + A.W + A.R + A.C) p.atk = null; }
  if (!p.atk && !p.parry && now - (p.cstT || 0) > 600) p.cst = Math.min(cstMaxOf(p), (p.cst ?? cstMaxOf(p)) + CST_REGEN * dt * survFactor(p) * (1 + useBonus(p, 'breath')));
  if (p.parry) p.cst = Math.max(0, p.cst - 2 * dt);
}

// ---------------- DRAGÃO ----------------
const angDiff = (a, b) => { let d = (a - b) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
function dragonDir(m) { const dx = Math.cos(m.ang), dy = Math.sin(m.ang); return dirFromVec(dx, dy, 0); }
const DRG_MS = { bite: 700, breath: 2000, tail: 900, roar: 1300, takeoff: 1100, land: 800 };
const DRG = { bite: 5.4, tail: 7.2, bMin: 3.6, bMax: 12.5, bLen: 11.5, mouth: 2.8, circR: 8, altAir: 5, altStrafe: 2.4, fly: 7, strafe: 10, altPatrol: 6.5 };
// o dragão caça qualquer um fora da cidade — inclusive o Tecelão, a não ser que esteja invisível
const dragonCan = p => p && !p.downed && !p.grabbed && !(p.dev && p.devHidden) && !inSafe(p.x, p.y) && !(p.fl > 0) && now_() >= (p.flungUntil || 0);
function flyTo(m, x, y, alt, speed, dt) {
  const dx = x - m.x, dy = y - m.y, d = Math.hypot(dx, dy), s = Math.min(d, speed * dt);
  if (d > 0.01) { m.x += dx / d * s; m.y += dy / d * s; const want = Math.atan2(dy, dx); m.ang += Math.max(-dt * 3, Math.min(dt * 3, angDiff(want, m.ang))); }
  m.alt += Math.max(-dt * 4.5, Math.min(dt * 4.5, alt - m.alt));
  return d < 0.6 && Math.abs(m.alt - alt) < 0.15;
}
function dragonAnim(m, a, tx, ty) { anim('m', m, a, tx, ty); m.busyUntil = now_() + DRG_MS[a]; }
function landedZ(m) { const t = tileAt(m.x, m.y); m.z = WORLD.ground[t] === T.CLIFF && WORLD.fl1[t] > 0 ? 1 : 0; }
function dragonThink(m, players, now, dt) {
  const d = MON[m.type]; m.alt = m.alt || 0;
  const tg = players.filter(p => dragonCan(p) && dist(p.x, p.y, m.x, m.y) < 24);
  if (m.sleep) {
    if (!m.patrolAt) m.patrolAt = now + 360000 + Math.random() * 300000;
    if (now >= m.patrolAt) { startPatrol(m, now); return; }
    const noisy = p => (p.running && p.walking) || now - p.lastCombat < 2500;
    const wake = m.aggro || tg.some(p => dist(p.x, p.y, m.x, m.y) < (p.crouch ? 3.2 : 6.5)) || tg.some(p => !p.crouch && noisy(p) && dist(p.x, p.y, m.x, m.y) < 14);
    if (!wake) return;
    m.sleep = false; m.mode = 'ground'; m.groundSince = now; m.nextRoar = now + 300; m.busyUntil = now + 300; m.airHp = [0.75, 0.5, 0.25];
  }
  if (!m.mode) m.mode = 'ground';
  const fury = m.hp < d.hp * 0.3; if (fury && !m.fury) { m.fury = true; near(m.x, m.y, { t: 'shake', s: 10 }); sys(d.name + ' entra em fúria!'); }
  const cdk = fury ? 0.6 : 1;
  if (m.mode === 'patrol') return dragonPatrol(m, players, tg, now, dt);
  if (m.mode === 'home') {
    if (m.aggro && tg.some(p => p.id === m.aggro)) { m.mode = 'air'; m.airUntil = now + 2500; return; }
    const back = dist(m.x, m.y, m.homeX, m.homeY) < 0.6;
    if (!back) { flyTo(m, m.homeX, m.homeY, DRG.altAir, DRG.fly, dt); return; }
    if (!flyTo(m, m.homeX, m.homeY, 0, DRG.fly, dt)) return;
    m.alt = 0; landedZ(m); m.mode = null; m.sleep = true; m.hp = d.hp; m.aggro = null; m.fury = false; m.idleSince = 0;
    if (!m.patrolAt || m.patrolAt < now) m.patrolAt = now + 720000 + Math.random() * 360000; return;
  }
  if (m.mode !== 'ground') return dragonAir(m, tg, now, dt, cdk);
  // ---------- no chão ----------
  if (now < (m.busyUntil || 0)) return;
  if (!tg.length) { m.idleSince = m.idleSince || now; if (now - m.idleSince > 12000) { m.mode = 'home'; dragonAnim(m, 'takeoff', m.x, m.y); } return; }
  m.idleSince = 0;
  const tgt = tg.find(p => p.id === m.aggro) || tg.slice().sort((a, b) => dist(a.x, a.y, m.x, m.y) - dist(b.x, b.y, m.x, m.y))[0];
  m.aggro = tgt.id;
  const dd = dist(m.x, m.y, tgt.x, tgt.y), want = Math.atan2(tgt.y - m.y, tgt.x - m.x), sameZ = Math.abs((tgt.z || 0) - (m.z || 0)) < 0.5;
  const turn = angDiff(want, m.ang); m.ang += Math.max(-dt * 1.8, Math.min(dt * 1.8, turn));
  // levanta voo: de tempos em tempos, quando perde vida (75/50/25%) ou quando não alcança o alvo (em cima/embaixo da rocha, longe)
  const hpCross = m.airHp && m.airHp.length && m.hp < d.hp * m.airHp[0];
  if (hpCross || now - m.groundSince > 17000 + (m.id % 5) * 1000 || (!sameZ && dd > 3) || dd > 16) {
    if (hpCross) m.airHp.shift();
    m.mode = 'takeoff'; m.airActs = 0; dragonAnim(m, 'takeoff', tgt.x, tgt.y); near(m.x, m.y, { t: 'shake', s: 4 });
    for (const p of players) if (!p.downed && dist(p.x, p.y, m.x, m.y) < 5 && Math.abs((p.z || 0) - (m.z || 0)) < 0.5) { p.slowUntil = now + 1200; sendStat(p); }
    return;
  }
  // rugido: assusta (lentidão) e treme a tela
  if (now >= (m.nextRoar || 0)) {
    m.nextRoar = now + 16000 + Math.random() * 6000; dragonAnim(m, 'roar', tgt.x, tgt.y);
    for (const p of tg) if (dist(p.x, p.y, m.x, m.y) < 11) { p.slowUntil = now + 2500; sendStat(p); }
    near(m.x, m.y, { t: 'shake', s: 9 }); return;
  }
  // golpe de cauda: quem está atrás ou dos lados voa longe
  const flank = tg.filter(p => sameZ && dist(p.x, p.y, m.x, m.y) < DRG.tail && Math.abs(angDiff(Math.atan2(p.y - m.y, p.x - m.x), m.ang)) > 1.5);
  if (flank.length && now >= (m.cdTail || 0)) {
    m.cdTail = now + 5500 * cdk; dragonAnim(m, 'tail', flank[0].x, flank[0].y);
    setTimeout(() => { if (!S.monsters[m.id]) return; for (const p of Object.values(S.players)) { if (p.downed || Math.abs((p.z || 0) - (m.z || 0)) > 0.5 || dist(p.x, p.y, m.x, m.y) > DRG.tail + 0.3 || Math.abs(angDiff(Math.atan2(p.y - m.y, p.x - m.x), m.ang)) < 1.1) continue; damagePlayer(p, rint(24, 38), m, 0); if (!p.downed) flingPlayer(p, m.x, m.y, 7); } }, 430);
    return;
  }
  // sopro: inspira, depois um jato que VARRE na frente (de um lado para o outro), incendiando o mato
  if (dd > DRG.bMin && dd < DRG.bMax && Math.abs(turn) < 0.5 && now >= (m.cdBreath || 0)) { m.cdBreath = now + 9000 * cdk; m.ang = want; dragonBreath(m, want, fury); return; }
  // mordida
  if (dd <= DRG.bite) {
    if (sameZ && now >= m.nextAtk && Math.abs(turn) < 0.8) { m.nextAtk = now + 1800 * cdk; dragonAnim(m, 'bite', tgt.x, tgt.y); m.busyUntil = now + 500; setTimeout(() => { if (S.monsters[m.id] && !tgt.downed && dist(tgt.x, tgt.y, m.x, m.y) < DRG.bite + 0.4) damagePlayer(tgt, rint(d.dmg[0], d.dmg[1]), m, 0); }, 380); }
    return;
  }
  moveToward(m, tgt.x, tgt.y, d.speed * dt * (fury ? 1.35 : 1));
}
function dragonBreath(m, a, fury) {
  dragonAnim(m, 'breath', 0, 0); m.busyUntil = now_() + DRG_MS.breath;
  const side = Math.random() < 0.5 ? 1 : -1, sw = fury ? 0.95 : 0.75, a0 = a - side * sw, a1 = a + side * sw, wind = 700, ms = 1300;
  const x0 = m.x + Math.cos(a) * DRG.mouth, y0 = m.y + Math.sin(a) * DRG.mouth;
  near(m.x, m.y, { t: 'tele', x: x0, y: y0, z: m.z || 0, a, len: DRG.bLen, w: sw, ms: wind, nf: 1 });
  setTimeout(() => {
    if (!S.monsters[m.id]) return;
    near(m.x, m.y, { t: 'jet', id: m.id, a0, a1, ms, d0: DRG.mouth, len: DRG.bLen });
    const hitAt = {};
    for (let k = 0; k <= 13; k++) setTimeout(() => {
      if (!S.monsters[m.id]) return;
      const now = now_(), ang = a0 + (a1 - a0) * (k / 13); m.ang = ang;
      const mx = m.x + Math.cos(ang) * DRG.mouth, my = m.y + Math.sin(ang) * DRG.mouth;
      for (const p of Object.values(S.players)) {
        if (p.downed || now < (hitAt[p.id] || 0)) continue;
        const ax = p.x - mx, ay = p.y - my, l = Math.hypot(ax, ay); if (l > DRG.bLen || Math.abs(angDiff(Math.atan2(ay, ax), ang)) > 0.22 + 0.6 / (l + 1)) continue;
        hitAt[p.id] = now + 350; damagePlayer(p, rint(12, 18), m, 0); ignitePlayer(p, now);
      }
      const list = []; igniteTile(mx + Math.cos(ang) * DRG.bLen * (0.4 + Math.random() * 0.6), my + Math.sin(ang) * DRG.bLen * (0.4 + Math.random() * 0.6), now, list, true); if (list.length) near(m.x, m.y, { t: 'fires', l: list, nb: 1 });
    }, k * 100);
  }, wind);
}
// ---------- no ar ----------
function dragonAir(m, tg, now, dt, cdk) {
  const tgt = tg.find(p => p.id === m.aggro) || tg[0];
  if (m.mode === 'takeoff') { flyTo(m, m.x, m.y, DRG.altAir, 0, dt); if (m.alt > DRG.altAir - 0.3) { m.mode = 'air'; m.airUntil = now + 3500 + Math.random() * 1500; m.circA = Math.atan2(m.y - (tgt ? tgt.y : m.y), m.x - (tgt ? tgt.x : m.x)); } return; }
  if (m.mode === 'carry') return dragonCarry(m, now, dt);
  if (!tgt && m.mode !== 'strafe') { m.lostT = m.lostT || now; if (now - m.lostT > 6000) { m.mode = 'home'; m.lostT = 0; } else flyTo(m, m.x + Math.cos(m.ang) * 3, m.y + Math.sin(m.ang) * 3, DRG.altAir, DRG.fly * 0.6, dt); return; }
  m.lostT = 0; if (tgt) m.aggro = tgt.id;
  if (m.mode === 'air') {
    // circula em volta do alvo, com a sombra passando por cima dele
    m.circA = (m.circA || 0) + dt * (DRG.fly / DRG.circR) * 0.8;
    flyTo(m, tgt.x + Math.cos(m.circA) * DRG.circR, tgt.y + Math.sin(m.circA) * DRG.circR, DRG.altAir, DRG.fly, dt);
    if (now < m.airUntil) return;
    m.airActs = (m.airActs || 0) + 1;
    if (m.airActs > 2 + (m.fury ? 1 : 0)) return dragonStartLand(m, tgt, now);
    if (Math.random() < 0.62) dragonStartStrafe(m, tgt, now, 'air'); else dragonStartDive(m, tgt, now);
    return;
  }
  if (m.mode === 'strafe') {
    const R = m.run, done = flyTo(m, R.x1, R.y1, DRG.altStrafe, now < R.go ? DRG.fly : DRG.strafe, dt);
    if (now >= R.go) {
      if (!R.jet) { R.jet = true; near(m.x, m.y, { t: 'jet', id: m.id, a0: R.a, a1: R.a, ms: Math.round(R.len / DRG.strafe * 1000) + 300, d0: 2.6, len: 2.6, air: 1 }); }
      const fx = m.x + Math.cos(R.a) * 4, fy = m.y + Math.sin(R.a) * 4, along = (fx - R.sx) * Math.cos(R.a) + (fy - R.sy) * Math.sin(R.a);
      if (along > 0 && along < R.len) {
        const list = []; igniteTile(fx, fy, now, list, true); (S.fires = S.fires || []).push({ x: fx, y: fy, r: 1.1, until: now + 3500 }); list.push([fx, fy, 1.2, 3500]); near(fx, fy, { t: 'fires', l: list, nb: 1 });
        for (const p of Object.values(S.players)) { if (p.downed || R.hit[p.id] || dist(p.x, p.y, fx, fy) > 1.6) continue; if (now < (p.dodgeUntil || 0)) { near(p.x, p.y, { t: 'whiff', id: p.id }); continue; } R.hit[p.id] = 1; damagePlayer(p, rint(28, 40), m, 0); ignitePlayer(p, now); }
      }
    }
    if (done || now > R.until) { m.mode = R.after; m.airUntil = now + 2500 + Math.random() * 1500; if (R.after === 'patrol') m.pi = Math.min(m.pi, m.route.length - 1); }
    return;
  }
  if (m.mode === 'dive') {
    const D = m.dive, k = Math.min(1, (now - D.t0) / D.ms);
    m.x = D.fx + (D.tx - D.fx) * k; m.y = D.fy + (D.ty - D.fy) * k; m.alt = DRG.altAir + (0.9 - DRG.altAir) * k; m.ang = Math.atan2(D.ty - D.fy, D.tx - D.fx);
    if (k < 1) return;
    const p = S.players[D.id];
    if (p && dragonCan(p) && dist(p.x, p.y, D.tx, D.ty) < 1.7 && now >= (p.dodgeUntil || 0)) {
      if (p.carrying) dropCarried(p); p.grabbed = m.id; p.sit = null; m.mode = 'carry'; m.carry = { id: p.id, until: now + 2300 };
      near(m.x, m.y, { t: 'grab', id: p.id, mid: m.id, ms: 2300 }); damagePlayer(p, rint(10, 16), m, 0); tell(p, 'O dragão te agarrou!');
    } else { if (p) near(p.x, p.y, { t: 'whiff', id: p.id }); m.mode = 'air'; m.airUntil = now + 2000; near(m.x, m.y, { t: 'shake', s: 3 }); }
    return;
  }
  if (m.mode === 'land') {
    const L = m.landAt; if (!flyTo(m, L.x, L.y, dist(m.x, m.y, L.x, L.y) < 2.5 ? 0 : 1.5, DRG.fly, dt)) return;
    m.alt = 0; landedZ(m); m.mode = 'ground'; m.groundSince = now; dragonAnim(m, 'land', tgt ? tgt.x : m.x, tgt ? tgt.y : m.y);
    near(m.x, m.y, { t: 'shake', s: 12 });
    for (const p of Object.values(S.players)) { if (p.downed || p.grabbed || Math.abs((p.z || 0) - (m.z || 0)) > 0.5 || dist(p.x, p.y, m.x, m.y) > 4.8) continue; damagePlayer(p, rint(18, 28), m, 0); if (!p.downed) knockPlayer(p, { x: m.x, y: m.y }, now); }
  }
}
function dragonStartStrafe(m, tgt, now, after) {
  const a = Math.atan2(tgt.y - m.y, tgt.x - m.x), sx = tgt.x - Math.cos(a) * 5, sy = tgt.y - Math.sin(a) * 5, len = 14;
  m.mode = 'strafe'; m.run = { a, sx, sy, len, x1: tgt.x + Math.cos(a) * 11, y1: tgt.y + Math.sin(a) * 11, go: now + 900, until: now + 5000, hit: {}, after };
  near(tgt.x, tgt.y, { t: 'tele', k: 'strip', x: sx, y: sy, a, len, w: 1.5, ms: 1100, z: 0 });
}
function dragonStartDive(m, tgt, now) {
  m.mode = 'dive'; m.dive = { id: tgt.id, t0: now, ms: 1200, fx: m.x, fy: m.y, tx: tgt.x, ty: tgt.y };
  near(tgt.x, tgt.y, { t: 'tele', k: 'ring', x: tgt.x, y: tgt.y, r: 1.7, ms: 1200, z: tgt.z || 0 });
}
function dragonStartLand(m, tgt, now) {
  let L = null;
  if ((tgt.z || 0) >= 0.5 && dist(tgt.x, tgt.y, m.homeX, m.homeY) < 10) L = { x: m.homeX, y: m.homeY };
  else for (let k = 0; k < 12 && !L; k++) { const a = Math.atan2(m.y - tgt.y, m.x - tgt.x) + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.5, x = tgt.x + Math.cos(a) * 6.5, y = tgt.y + Math.sin(a) * 6.5, t = tileAt(x, y); if (inBounds(Math.round(x), Math.round(y)) && WORLD.ground[t] !== T.WATER && WORLD.ground[t] !== T.CLIFF && !inSafe(x, y)) L = { x, y }; }
  m.mode = 'land'; m.landAt = L || { x: tgt.x, y: tgt.y };
  near(m.landAt.x, m.landAt.y, { t: 'tele', k: 'ring', x: m.landAt.x, y: m.landAt.y, r: 4.8, ms: 1300, z: 0 });
}
function dragonCarry(m, now, dt) {
  const C = m.carry, p = S.players[C.id];
  flyTo(m, m.x + Math.cos(m.ang) * 4, m.y + Math.sin(m.ang) * 4, 6, 5.5, dt);
  if (!m._edge) { const nx = m.x + Math.cos(m.ang) * 3, ny = m.y + Math.sin(m.ang) * 3; if (!inBounds(Math.round(nx), Math.round(ny)) || inSafe(nx, ny)) m.ang += Math.PI * 0.6; }
  if (p) { p.x = m.x; p.y = m.y; p.lastMv = now; }
  if (now < C.until && p && p.grabbed === m.id) return;
  if (p && p.grabbed === m.id) dragonDrop(p, m.alt);
  m.mode = 'air'; m.airUntil = now + 2500; m.carry = null;
}
// solta quem estava nas garras: cai do alto, se machuca e fica no chão
function dragonDrop(p, alt) {
  p.grabbed = null;
  let best = null;
  for (let r = 0; r < 6 && !best; r += 0.5) for (let k = 0; k < 8 && !best; k++) { const a = k * Math.PI / 4, x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r; if (!inBounds(Math.round(x), Math.round(y))) continue; const t = tileAt(x, y), top = WORLD.ground[t] === T.CLIFF && WORLD.fl1[t] > 0; if (top && canStandZ(x, y, 1, 0.22)) best = [x, y, 1]; else if (!top && WORLD.ground[t] !== T.CLIFF && canStand(x, y, 0, 0.22)) best = [x, y, 0]; }
  const [tx, ty, tz] = best || [p.x, p.y, 0], ms = 750, fz = Math.max(1, (alt || 4) / 4);   // altura de voo (ALT_PX 44) em andares (176 px)
  near(p.x, p.y, { t: 'fling', id: p.id, fx: p.x, fy: p.y, fz, tx, ty, tz, ms });
  p.x = tx; p.y = ty; p.z = tz; p.flungUntil = now_() + ms + 900; p.lastMv = now_();
  setTimeout(() => { if (!S.players[p.id] || p.downed) return; const wet = WORLD.ground[tileAt(p.x, p.y)] === T.WATER || WORLD.ground[tileAt(p.x, p.y)] === T.SHALLOW; damagePlayer(p, Math.round(p.maxHp * (wet ? 0.08 : 0.22)), null, 0); if (!p.downed && !wet) knockPlayer(p, { x: p.x + 0.5, y: p.y }, now_()); }, ms);
}
// ---------- patrulha: de tempos em tempos sobrevoa o mundo e ataca quem estiver no caminho, fora da cidade ----------
function startPatrol(m, now) {
  const a0 = Math.atan2(m.homeY - CENTER, m.homeX - CENTER), dir = Math.random() < 0.5 ? 1 : -1;
  m.route = []; for (let k = 1; k <= 7; k++) { const a = a0 + dir * k * Math.PI * 2 / 8, r = 64 + Math.random() * 22; m.route.push([CENTER + Math.cos(a) * r, CENTER + Math.sin(a) * r]); }
  m.pi = 0; m.patrolHit = {}; m.sleep = false; m.mode = 'patrol'; m.alt = 0; m.patrolAt = now + 720000 + Math.random() * 360000;
  dragonAnim(m, 'takeoff', m.x, m.y); sys('Uma sombra imensa cruza o céu... ' + MON[m.type].name + ' saiu do covil para caçar.'); Net.toAll({ t: 'shake', s: 2 });
}
function dragonPatrol(m, players, tg, now, dt) {
  if (now < (m.busyUntil || 0)) { flyTo(m, m.x, m.y, 2, 0, dt); return; }
  if (m.aggro) { const a = tg.find(p => p.id === m.aggro); if (a) { m.mode = 'air'; m.airUntil = now + 2000; m.airActs = 0; return; } }
  const wp = m.route[m.pi];
  if (!wp) { m.mode = 'home'; return; }
  if (flyTo(m, wp[0], wp[1], DRG.altPatrol, DRG.fly * 0.85, dt) || dist(m.x, m.y, wp[0], wp[1]) < 1.2) m.pi++;
  const prey = tg.find(p => !m.patrolHit[p.id] && dist(p.x, p.y, m.x, m.y) < 10 && WORLD.zone[tileAt(p.x, p.y)] !== Z.OUTSKIRTS);
  if (prey) { m.patrolHit[prey.id] = 1; dragonStartStrafe(m, prey, now, 'patrol'); }
}

// ---------- fogo: no corpo (role ou entre na água) e no mato (espalha) ----------
function ignitePlayer(p, now) {
  if (p.downed || !S.players[p.id]) return;
  const was = now < (p.burnUntil || 0); p.burnUntil = now + 6000;
  near(p.x, p.y, { t: 'burn', id: p.id, ms: 6000 });
  if (!was) tell(p, 'Você está pegando fogo! Role (esquiva) ou entre na água.');
}
function extinguish(p, msg) { p.burnUntil = 0; near(p.x, p.y, { t: 'burn', id: p.id, ms: 0 }); if (msg) tell(p, msg); }
const FLAMMABLE = new Set([O.TALLGRASS, O.BUSH, O.FERN, O.TREE, O.PINE, O.OAK, O.BIRCH, O.WILLOW, O.BERRY, O.HERB, O.LOG, O.ROOTS, O.FLOWER, O.REEDS, O.DEADTREE]);
const BIG_FUEL = new Set([O.TREE, O.PINE, O.OAK, O.BIRCH, O.WILLOW, O.DEADTREE]);
const raining = () => typeof weatherNow === 'function' && weatherNow().rain > 0.3;
function igniteTile(x, y, now, list, force) {
  x = Math.round(x); y = Math.round(y); if (!inBounds(x, y)) return;
  const i = y * MAP_W + x; S.burn = S.burn || {}; S.burnt = S.burnt || {};
  if (S.burn[i] || (S.burnt[i] || 0) > now || (S.burnN || 0) > 180) return;
  const z = WORLD.zone[i], g = WORLD.ground[i], o = WORLD.obj[i];
  if (z === Z.VILLAGE || z === Z.OUTSKIRTS || g === T.WATER || g === T.SHALLOW || g === T.SAND || WORLD.bld[i] >= 0) return;
  const fuel = FLAMMABLE.has(o) ? (BIG_FUEL.has(o) ? 2 : 1) : (g === T.GRASS || g === T.FOREST) ? (force ? 0.6 : 0.4) : 0;
  if (!fuel || (raining() && !force)) return;
  const ms = (2500 + fuel * 3000) * (raining() ? 0.5 : 1);
  S.burn[i] = { until: now + ms, spreadAt: now + 1200 + Math.random() * 1800, o }; S.burnN = (S.burnN || 0) + 1;
  S.fires = S.fires || []; S.fires.push({ x, y, r: fuel >= 2 ? 1.2 : 0.8, until: now + ms });
  list.push([x, y, fuel >= 2 ? 1.7 : fuel >= 1 ? 1.1 : 0.7, ms]);
}
function fireTick(now, players) {
  if (S.burnN) {
    const list = [], wet = raining();
    for (const k in S.burn) {
      const b = S.burn[k], i = +k, x = i % MAP_W, y = Math.floor(i / MAP_W);
      if (!b.spread && now >= b.spreadAt) { b.spread = true; if (!wet) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const j = i + dy * MAP_W + dx; if (Math.random() < (FLAMMABLE.has(WORLD.obj[j]) ? 0.3 : 0.1)) igniteTile(x + dx, y + dy, now, list); } }
      if (now < b.until) continue;
      delete S.burn[k]; S.burnN--; S.burnt[i] = now + 600000;
      if (b.o === WORLD.obj[i] && BIG_FUEL.has(b.o) && b.o !== O.DEADTREE) { setObj(i, O.DEADTREE); (S.objBack = S.objBack || []).push({ i, o: b.o, at: now + 600000 }); }
      else if (b.o === WORLD.obj[i] && FLAMMABLE.has(b.o) && b.o !== O.DEADTREE) { setObj(i, O.NONE); (S.objBack = S.objBack || []).push({ i, o: b.o, at: now + 360000 }); }
    }
    if (list.length) { const [x, y] = list[0]; near(x, y, { t: 'fires', l: list, nb: 1 }, VIEW_RADIUS + 14); }
  }
  for (const p of players) {
    if (p.grabbed && !S.monsters[p.grabbed]) dragonDrop(p, 4);
    if (!p.burnUntil) continue;
    if (p.downed || now >= p.burnUntil) { extinguish(p, p.downed ? null : 'O fogo se apagou.'); continue; }
    const g = WORLD.ground[tileAt(p.x, p.y)]; if (g === T.WATER || g === T.SHALLOW) { extinguish(p, 'Você apaga o fogo na água.'); continue; }
    if (now >= (p.burnDmgT || 0)) { p.burnDmgT = now + 650; damagePlayer(p, Math.max(3, Math.round(p.maxHp * 0.03)), null, 0); }
  }
}
// arremesso realista: a pessoa voa em arco para longe e cai (pode cair da mesa)
function flingPlayer(p, fx, fy, D) {
  if (p.carrying) dropCarried(p);
  const dx = p.x - fx, dy = p.y - fy, l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l;
  let best = [p.x, p.y, p.z];
  for (let s = 0.25; s <= D; s += 0.25) {
    const x = p.x + ux * s, y = p.y + uy * s, t = tileAt(x, y), top = WORLD.ground[t] === T.CLIFF && WORLD.fl1[t] > 0;
    if (top) { if (canStandZ(x, y, 1, 0.22)) best = [x, y, 1]; continue; }
    if (WORLD.ground[t] === T.CLIFF || WORLD.ground[t] === T.WATER) continue;      // passa por cima da borda da rocha
    if (!canStand(x, y, 0, 0.22)) { if (BLOCKING.has(WORLD.obj[t]) || wallHit(x, y, 0.22)) break; continue; }
    best = [x, y, 0];
  }
  const fz = p.z, [tx, ty, tz] = best, ms = 600 + Math.hypot(tx - p.x, ty - p.y) * 45;
  near(p.x, p.y, { t: 'fling', id: p.id, fx: p.x, fy: p.y, fz, tx, ty, tz, ms });
  p.x = tx; p.y = ty; p.z = tz; p.flungUntil = now_() + ms + 900; p.lastMv = now_(); p.sit = null;
  if (fz >= 0.5 && tz < 0.5) setTimeout(() => damagePlayer(p, Math.round(p.maxHp * 0.08), null, 0), ms);   // queda da mesa
}

// ---------------- arco (estilo caçada): puxar, soltar, flecha com voo real, fincar no corpo ----------------
const MON_HT = { rat: 0.4, slime: 0.6, toad: 0.5, spider: 0.7, wolf: 0.95, boar: 0.9, deer: 1.5, goblin: 1.15, skeleton: 1.8, bandit: 1.8, deserter: 1.85, deserterchief: 1.95, orc: 2.05, orcchief: 2.4, troll: 3.0, cryptlord: 2.1, wisp: 1.2, elderslime: 1.3, dragon: 5 };
const OBST_H = o => [O.TREE, O.PINE, O.OAK, O.BIRCH, O.WILLOW, O.DEADTREE].includes(o) ? 6 : [O.WALL, O.TOWER, O.GATE, O.RUINTOWER].includes(o) ? 7 : [O.ROCK, O.BOULDER, O.BARREL, O.CRATE, O.HAY, O.STUMP, O.LOG, O.BUSH, O.BERRY].includes(o) ? 1.1 : 2.2;
const groundH = (x, y) => { const t = tileAt(x, y); return WORLD.ground[t] === T.CLIFF && WORLD.fl1[t] > 0 ? 3.5 : 0; };
let _arrowId = 1;
function bowDraw(p, on) {
  const now = now_();
  if (!on) { p.drawT = null; return; }
  if (p.cls !== 'archer' || p.downed || p.carrying || p.lifted || p.grabbed || now < (p.nockReady || 0) || now < (p.stunUntil || 0) || now < (p.knockUntil || 0)) return;
  p.drawT = now; p.parry = null; p.lastCombat = now;
}
function bowLoose(p, m) {
  const now = now_(); if (!p.drawT) return;
  const held = now - p.drawT, pow = clamp(held / BOW.draw, 0, 1); p.drawT = null;
  if (pow < 0.15) return;   // mal puxou: relaxa sem atirar
  // tremor: segurar demais no máximo e flecha cravada no braço espalham a mira
  const sway = Math.max(0, held - BOW.draw - BOW.holdSway) / 1000 * 0.09 + (p.arrows || []).filter(a => a.part === 'armA' || a.part === 'armB').length * 0.06;
  const a = (isFinite(+m.a) ? +m.a : 0) + (Math.random() - 0.5) * 2 * Math.min(0.35, sway);
  let tx = +m.tx, ty = +m.ty; if (!isFinite(tx) || !isFinite(ty)) { tx = p.x + Math.cos(a) * 8; ty = p.y + Math.sin(a) * 8; }
  const D = clamp(dist(p.x, p.y, tx, ty), 0.5, BOW.maxRange) * 2;   // metros (1 tile = 2 m)
  const v = (BOW.vMin + (BOW.vMax - BOW.vMin) * pow) * 2, g = BOW.g;  // m/s
  // altura de chegada: o meio do corpo de quem está sob o cursor (bicho baixo, gente, troll); senão 1 m
  let aimH = 1.0, bd = 1.3;
  for (const q of Object.values(S.monsters)) { const d = dist(q.x, q.y, tx, ty); if (d < bd && (q.alt || 0) < 1.2) { bd = d; aimH = (MON_HT[q.type] || 1.6) * 0.62; } }
  for (const q of Object.values(S.players)) { if (q === p) continue; const d = dist(q.x, q.y, tx, ty); if (d < bd) { bd = d; aimH = q.downed ? 0.3 : 1.15; } }
  const z0 = (p.z >= 0.5 ? 3.5 : 0), h0 = z0 + 1.45, dh = (groundH(tx, ty) + aimH) - h0;
  const disc = v ** 4 - g * (g * D * D + 2 * dh * v * v);
  const th = disc >= 0 ? Math.atan((v * v - Math.sqrt(disc)) / (g * D)) : Math.PI / 4;
  const A = { id: _arrowId++, by: p.id, x: p.x + Math.cos(a) * 0.45, y: p.y + Math.sin(a) * 0.45, h: h0, vx: Math.cos(a) * v * Math.cos(th) / 2, vy: Math.sin(a) * v * Math.cos(th) / 2, vz: v * Math.sin(th), t0: now, pow, a };
  (S.arrows = S.arrows || []).push(A);
  anim('p', p, 'loose', p.x + Math.cos(a), p.y + Math.sin(a));
  near(p.x, p.y, { t: 'arrow', id: A.id, x: A.x, y: A.y, h: A.h, vx: A.vx, vy: A.vy, vz: A.vz, g }, VIEW_RADIUS + 10);
  p.nockReady = now + BOW.loose + BOW.nock; p.lastCombat = now;
  setTimeout(() => { if (S.players[p.id] && !p.downed) anim('p', p, 'nock', p.x + Math.cos(a), p.y + Math.sin(a)); }, BOW.loose);
}
// parte do corpo pela altura relativa e pelo lado em que a flecha passou
function arrowPart(rel, lat) {
  if (rel > 0.84) return 'head';
  if (rel > 0.5) return Math.abs(lat) > 0.55 ? (lat > 0 ? 'armA' : 'armB') : 'torso';
  return lat > 0 ? 'legR' : 'legL';
}
function arrowTick(now, dt) {
  if (!S.arrows || !S.arrows.length) return;
  const SUB = 0.025, steps = Math.ceil(dt / SUB);
  for (const A of S.arrows.slice()) {
    const shooter = S.players[A.by]; let done = false;
    for (let s = 0; s < steps && !done; s++) {
      A.x += A.vx * SUB; A.y += A.vy * SUB; A.vz -= BOW.g * SUB; A.h += A.vz * SUB;
      const fa = Math.atan2(A.vy, A.vx);
      if (!inBounds(Math.round(A.x), Math.round(A.y)) || now - A.t0 > 5000) { done = true; break; }
      // corpos: jogadores (inclusive aliados) e monstros
      const tgts = [];
      for (const q of Object.values(S.players)) { if (q.dev || (q.id === A.by && now - A.t0 < 250) || q.fl > 0) continue; tgts.push({ q, k: 'p', r: 0.32, H: q.downed ? 0.45 : 1.8, base: q.z >= 0.5 ? 3.5 : 0 }); }
      for (const q of Object.values(S.npcs || {})) { if (q.dead || q.onBack) continue; tgts.push({ q, k: 'n', r: 0.32, H: q.downed ? 0.45 : 1.8, base: 0 }); }
      for (const q of Object.values(S.monsters)) { if ((q.alt || 0) > 1.2) continue; tgts.push({ q, k: 'm', r: Math.max(0.3, Math.min(1.6, MON[q.type].rad || 0.35)), H: MON_HT[q.type] || 1.6, base: (q.z || 0) >= 0.5 ? 3.5 : 0 }); }
      for (const T0 of tgts) {
        const q = T0.q, dx = A.x - q.x, dy = A.y - q.y; if (dx * dx + dy * dy > T0.r * T0.r) continue;
        const rel = (A.h - T0.base) / T0.H; if (rel < 0 || rel > 1.05) continue;
        const lat = (-dx * Math.sin(fa) + dy * Math.cos(fa)) / T0.r, part = T0.k === 'p' && q.downed ? 'torso' : arrowPart(rel, lat);
        arrowHit(A, shooter, q, T0.k, part, A.h - T0.base, dx, dy, fa); done = true; break;
      }
      if (done) break;
      // obstáculos, paredes e chão
      const t = tileAt(A.x, A.y), o = WORLD.obj[t], gh = groundH(A.x, A.y);
      const wall = WORLD.bld[t] >= 0 && A.h < gh + 5.5, obst = BLOCKING.has(o) && A.h < gh + OBST_H(o);
      if (wall || obst || A.h <= gh) {
        const h = Math.max(gh + 0.05, Math.min(A.h, gh + 3));
        near(A.x, A.y, { t: 'astick', id: A.id, x: A.x, y: A.y, h, a: fa, pitch: Math.atan2(A.vz, Math.hypot(A.vx, A.vy) * 2), ms: 60000 }, VIEW_RADIUS + 10);
        done = true;
      }
    }
    if (done) { S.arrows = S.arrows.filter(z => z !== A); near(A.x, A.y, { t: 'arrowend', id: A.id }, VIEW_RADIUS + 10); }
  }
}
function arrowHit(A, p, q, k, part, h, dx, dy, fa) {
  const now = now_(), pow = A.pow, mult = (0.6 + 1.9 * Math.pow(pow, 1.5)) * (part === 'head' ? 2 : part.startsWith('leg') ? 0.75 : part.startsWith('arm') ? 0.85 : 1);
  const src = p || { id: A.by, x: A.x, y: A.y, cls: 'archer', lvl: 1, buffs: {}, body: null };
  const stick = { k, id: q.id, part, h, lx: dx, ly: dy, a: fa };
  if (k === 'n') { const r = p ? roll(p, mult) : { dmg: Math.round(12 * mult) }; npcDamage(q, r.dmg, p); }
  else if (k === 'p') {
    if (now < (q.dodgeUntil || 0)) { near(q.x, q.y, { t: 'whiff', id: q.id }); return; }
    if (p && inSafe(q.x, q.y)) witnessCrime(p, p.x, p.y);
    const r = p ? roll(p, mult) : { dmg: Math.round(12 * mult), crit: false };
    damagePlayer(q, Math.round(r.dmg * (part === 'head' ? 1 : 1)), { x: A.x - Math.cos(fa), y: A.y - Math.sin(fa), name: p ? p.name : '' }, 0, null, part);
    if (S.players[q.id]) { (q.arrows = q.arrows || []).push({ part, t: now }); if (q.arrows.length > 14) q.arrows.shift(); if (q.bleed && part !== 'head') q.bleed[part] = Math.max(q.bleed[part] || 0, 0.6); sendStat(q); }
  } else {
    if (!S.monsters[q.id]) return;
    const r = p ? roll(p, mult, q) : { dmg: Math.round(12 * mult), crit: false };
    q.arrows = (q.arrows || 0) + 1; q.arrowBy = A.by;
    if (part.startsWith('leg')) q.slowUntil = Math.max(q.slowUntil || 0, now + 600000);
    if (p) { hitRolled(p, q, r.dmg, part === 'head' || r.crit, 0, part === 'head' ? 1 : 0); useGain(p, 'bow', 1); }
  }
  near(q.x, q.y, Object.assign({ t: 'stick' }, stick), VIEW_RADIUS + 10);
}
// arrancar uma flecha (dói e sangra); a bandagem tira as do lugar sem dor
function pullArrow(p) {
  if (!p.arrows || !p.arrows.length || p.downed) return;
  const a = p.arrows.pop(); damagePlayer(p, Math.max(2, Math.round(p.maxHp * 0.03)), null, 0, null, a.part);
  if (p.bleed && a.part !== 'head') p.bleed[a.part] = Math.max(p.bleed[a.part] || 0, 0.8);
  tell(p, 'Você arranca a flecha com um puxão. Arde.'); near(p.x, p.y, { t: 'unstick', k: 'p', id: p.id, n: 1 }); sendStat(p);
}
function bowTick(p, now, dt) {
  if (p.drawT && now - p.drawT > BOW.draw) { p.cst = (p.cst ?? CST_MAX) - BOW.holdDrain * dt; p.cstT = now; if (p.cst <= 0) { p.cst = 0; p.drawT = null; tell(p, 'O braço cansou e a corda relaxou.'); Net.toOne(p.id, { t: 'bowrelax' }); } }
}
function arrowBleedTick(now) {
  if (now - (S.arrowBleedT || 0) < 1000) return; S.arrowBleedT = now;
  for (const m of Object.values(S.monsters)) if (m.arrows) { m.hp -= m.arrows; if (m.hp <= 0) { const p = S.players[m.arrowBy]; if (p) killMonster(m, p, 0); else delete S.monsters[m.id]; } }
}

// ---------------- puxar (braços / pé), carregar nas costas e agarrão ----------------
// peso: 0-1 vai em qualquer forma; 2 (gente, orc, cervo) nas costas só com fôlego; 3 (troll, chefes, dragão) não se move
const WEIGHT = { rat: 0, toad: 0, slime: 0, spider: 0, wisp: 0, wolf: 1, goblin: 1, boar: 1, deer: 2, skeleton: 2, bandit: 2, deserter: 2, orc: 2, troll: 3, orcchief: 3, cryptlord: 3, deserterchief: 3, elderslime: 3, dragon: 3 };
const dirVec = d => { const th = (d || 0) * Math.PI / 4, sx = Math.sin(th), sy = Math.cos(th), vx = (sx + 2 * sy) / 2, vy = (2 * sy - sx) / 2, l = Math.hypot(vx, vy) || 1; return [vx / l, vy / l]; };
const dragTarget = (k, id) => k === 'p' ? S.players[id] : k === 'c' ? (S.corpses || {})[id] : k === 'n' ? (S.npcs || {})[id] : k === 'm' ? S.monsters[id] : null;
const weightOf = (k, t) => k === 'c' || k === 'm' ? (WEIGHT[t.type] ?? 2) : 2;
const GRIP_HUMANOID = new Set(['bandit', 'deserter', 'skeleton', 'orc']);
function startGrab(p, m) {
  if (p.downed || p.drag || p.carrying || p.lifted || p.carriedBy || p.gripBy || p.dragBy) return;
  const k = m.k, mode = m.mode, t = dragTarget(k, m.id);
  if (!t || t === p || !['arms', 'foot', 'back', 'grip'].includes(mode) || dist(p.x, p.y, t.x, t.y) > 2.1) return;
  const w = weightOf(k, t); if (w >= 3) { tell(p, 'Pesado demais para mover.'); return; }
  const now = now_();
  if (mode === 'grip' && (k === 'm' || k === 'n')) {   // agarrar bicho pequeno, humanoide atordoado ou NPC em pé
    if (t.gripBy || t.dragBy || t.dead || t.downed || t.carrying) return;
    if (k === 'm') { const small = (WEIGHT[t.type] ?? 2) <= 1, weak = now < (t.stunUntil || 0) || t.sleep; if (!(small && !t.atk) && !(GRIP_HUMANOID.has(t.type) && weak)) { tell(p, small ? 'Ele está atacando: espere a brecha.' : 'Só dá para agarrar esse inimigo atordoado.'); return; } }
    if ((p.cst ?? 0) < 30) { tell(p, 'Sem fôlego para agarrar.'); return; }
    p.cst -= 20; t.gripBy = p.id; t.dragBy = p.id; t.atk = null; t.escAt = now + (k === 'm' ? ((WEIGHT[t.type] ?? 2) <= 1 ? 2600 : 3600) : 5000);
    p.drag = { k, id: t.id, mode, w, a: Math.atan2(t.y - p.y, t.x - p.x) };
    near(p.x, p.y, { t: 'drag', by: p.id, k, id: t.id, mode }); if (k === 'n') witnessCrime(p, p.x, p.y); sendStat(p); return;
  }
  if (mode === 'grip') {   // agarrão em quem está de pé: só pelas costas ou em quem está atordoado/sem fôlego
    if (k !== 'p' || t.downed || t.dev || t.gripBy || t.carriedBy) return;
    const [fx, fy] = dirVec(t.dir), behind = (fx * (p.x - t.x) + fy * (p.y - t.y)) / (dist(p.x, p.y, t.x, t.y) || 1) < -0.25;
    const weak = now < (t.stunUntil || 0) || now < (t.knockUntil || 0) || (t.cst ?? 99) < 25;
    if (!behind && !weak) { tell(p, 'Só dá para agarrar pelas costas (ou quem está atordoado ou exausto).'); return; }
    if ((p.cst ?? 0) < 40) { tell(p, 'Sem fôlego para agarrar.'); return; }
    p.cst -= 25; t.gripBy = p.id; t.esc = 0; t.dragBy = p.id; t.atk = null; t.parry = null; t.drawT = null;
    p.drag = { k, id: t.id, mode, w, a: Math.atan2(t.y - p.y, t.x - p.x) };
    near(p.x, p.y, { t: 'drag', by: p.id, k, id: t.id, mode }); tell(t, 'Você foi agarrado! Aperte ESPAÇO várias vezes para se soltar.'); witnessCrime(p, p.x, p.y); sendStat(p); sendStat(t); return;
  }
  if (k === 'p' && (!t.downed || t.carriedBy || t.dragBy || t.execAt || t.tied)) return;
  if (k === 'n' && ((!t.downed && !t.dead) || t.dragBy)) return;
  if (k === 'c' && t.dragBy) return;
  if (k === 'n' && (t.dead ? false : !t.downed)) return;
  if (mode === 'back') {
    if (w >= 2 && (p.cst ?? 0) < cstMaxOf(p) * 0.4) { tell(p, 'Sem fôlego para levantar esse peso.'); return; }
    if (k === 'p') { p.carrying = t.id; t.carriedBy = p.id; t.revive = null; near(p.x, p.y, { t: 'carry', by: p.id, id: t.id }); return; }   // gente nas costas: o carregar de sempre
  }
  p.drag = { k, id: t.id, mode, w }; t.dragBy = p.id; t.dragMode = mode; if (k === 'p') t.revive = null; if ((k === 'c' || k === 'n') && mode === 'back') t.onBack = p.id;
  near(p.x, p.y, { t: 'drag', by: p.id, k, id: t.id, mode });
}
function stopDrag(p, why) {
  const d = p.drag; if (!d) return; p.drag = null;
  const t = dragTarget(d.k, d.id);
  if (t) {
    t.dragBy = null; t.dragMode = null;
    if (d.mode === 'grip') { t.gripBy = null; t.esc = 0; if (d.k === 'p') sendStat(t); }
    if ((d.k === 'c' || d.k === 'n') && d.mode === 'back') { t.onBack = null; for (const [dx, dy] of [[0.7, 0], [-0.7, 0], [0, 0.7], [0, -0.7], [0, 0]]) if (canStand(p.x + dx, p.y + dy, p.z || 0, 0.2)) { t.x = p.x + dx; t.y = p.y + dy; break; } }
  }
  near(p.x, p.y, { t: 'drag', by: p.id, k: d.k, id: d.id, mode: null });
  if (why) tell(p, why);
}
function struggle(p) {
  if (!p.gripBy) return; const g = S.players[p.gripBy]; if (!g) { p.gripBy = null; p.dragBy = null; return; }
  p.esc = (p.esc || 0) + 6 + 6 * clamp((p.cst ?? 0) / cstMaxOf(p), 0, 1); p.cst = Math.max(0, (p.cst ?? 0) - 2); g.cst = Math.max(0, (g.cst ?? 0) - 2.5);
  if (p.esc >= 100) { stopDrag(g, p.name + ' se soltou!'); tell(p, 'Você se soltou!'); near(p.x, p.y, { t: 'anim', w: 'p', id: g.id, a: 'hurt', ms: 500 }); g.stunUntil = now_() + 500; }
  else sendStat(p);
}
function dragTick(p, now, dt) {
  const d = p.drag; if (!d) return;
  const t = dragTarget(d.k, d.id);
  if (!t || p.downed || p.carriedBy || (d.k === 'p' && d.mode !== 'grip' && !t.downed) || (d.k === 'n' && !t.downed && !t.dead) || (d.mode === 'grip' && t.downed) || (d.k === 'p' && t.carriedBy)) { stopDrag(p); return; }
  if (p._lx != null) { const mx = p.x - p._lx, my = p.y - p._ly; if (mx * mx + my * my > 0.0004) p._dragA = Math.atan2(my, mx); } p._lx = p.x; p._ly = p.y;
  const a = p._dragA ?? Math.atan2(t.y - p.y, t.x - p.x) + Math.PI;
  if (d.mode === 'back') { t.x = p.x; t.y = p.y; t.z = p.z; p.cst -= (d.w >= 2 ? 8 : 2) * dt; p.cstT = now; if (p.cst <= 0) { p.cst = 0; stopDrag(p, 'O peso venceu: você largou.'); } return; }
  if (d.mode === 'grip') {   // a vítima fica presa na frente de quem agarra
    const ga = Math.atan2(t.y - p.y, t.x - p.x), nx = p.x + Math.cos(ga) * 0.55, ny = p.y + Math.sin(ga) * 0.55;
    if (canStand(nx, ny, p.z || 0, 0.2)) { t.x = nx; t.y = ny; } t.lastMv = now; t.walking = false;
    p.cst -= 9 * dt; p.cstT = now; if (p.cst <= 0) { p.cst = 0; stopDrag(p, 'Sem fôlego: você soltou.'); tell(t, 'Você se soltou!'); }
    return;
  }
  const back = d.mode === 'arms' ? 1.0 : 1.2, nx = p.x - Math.cos(a) * back, ny = p.y - Math.sin(a) * back;
  if (canStand(nx, ny, p.z || 0, 0.15) || dist(nx, ny, p.x, p.y) < 0.5) { t.x = nx; t.y = ny; }
  if (dist(t.x, t.y, p.x, p.y) > 2.5) { t.x = nx; t.y = ny; }   // não deixa o corpo ficar para trás preso numa quina
  t.z = p.z; t.lastMv = now;
}
function dragCleanup() {
  for (const q of Object.values(S.players)) if (q.dragBy && !String(q.dragBy).startsWith('w:') && (!S.players[q.dragBy] || !S.players[q.dragBy].drag || S.players[q.dragBy].drag.id !== q.id)) { q.dragBy = null; q.gripBy = null; q.dragMode = null; q.esc = 0; }
  for (const c of Object.values(S.npcs || {})) if (c.dragBy && (!S.players[c.dragBy] || !S.players[c.dragBy].drag || S.players[c.dragBy].drag.id !== c.id)) { c.dragBy = null; c.dragMode = null; c.onBack = null; }
  for (const c of Object.values(S.corpses || {})) if (c.dragBy && (!S.players[c.dragBy] || !S.players[c.dragBy].drag || S.players[c.dragBy].drag.id !== c.id)) { c.dragBy = null; c.dragMode = null; c.onBack = null; }
}

// ---------------- NPCs vulneráveis, sentinelas que agem, prisioneiros e lobos que arrastam ----------------
const NPC_HP = { guard: 260, executioner: 220, captain: 240 };
function initNpcs() {
  if (S.npcs) return; S.npcs = {};
  for (const n of NPCS) S.npcs[n.id] = { id: n.id, kind: n.kind, name: n.name, x: n.x, y: n.y, z: 0, postX: n.x, postY: n.y, hp: NPC_HP[n.kind] || 90, maxHp: NPC_HP[n.kind] || 90, downed: null, dead: false };
}
const npcAlive = id => { const n = S.npcs && S.npcs[id]; return !n || (!n.dead && !n.downed); };
function npcDamage(n, dmg, p) {
  if (!n || n.dead) return; const now = now_();
  if (p) witnessCrime(p, n.x, n.y);
  if (n.downed) { npcDie(n, p); return; }
  n.hp -= dmg; sfx(n.x, n.y, '-' + dmg, '#ff8a6a'); near(n.x, n.y, { t: 'anim', w: 'n', id: n.id, a: 'hurt', ms: 300 });
  if (n.kind === 'guard' && p) { n.aggro = p.id; p.wanted = Math.max(p.wanted || 0, now + 300000); Net.toAll({ t: 'wanted', id: p.id, ms: p.wanted - now }); }
  if (n.hp <= 0) { n.hp = 0; n.downed = { until: now + 45000 }; n.carrying && npcDropCarried(n); sys(n.name + ' caiu ferido!'); }
}
function npcDie(n, p) {
  n.dead = true; n.downed = null; n.hp = 0; if (n.carrying) npcDropCarried(n);
  if (n.dragBy && S.players[n.dragBy]) stopDrag(S.players[n.dragBy]);
  sys(n.name + ' morreu' + (p ? ' pelas mãos de ' + p.name : '') + '. A cidade não o terá de volta tão cedo.');
}
// carregar jogador (sentinelas e monstros levam nas costas)
function entCarry(c, q, tag) { c.carrying = q.id; q.carriedBy = tag; q.revive = null; if (q.dragBy && S.players[q.dragBy]) stopDrag(S.players[q.dragBy]); }
function npcDropCarried(c) { const q = S.players[c.carrying]; c.carrying = null; if (!q) return; q.carriedBy = null; q.x = c.x + 0.5; q.y = c.y; q.z = 0; return q; }
// movimento simples de NPC (sem a regra de "monstro não entra na cidade"), seguindo um caminho quando o anfitrião tem o pathfinder
function npcWalk(n, tx, ty, speed, dt) {
  if (n.path && n.path.length && (n.pathTo[0] !== Math.round(tx) || n.pathTo[1] !== Math.round(ty))) n.path = null;
  if (!n.path && typeof findPath === 'function' && dist(n.x, n.y, tx, ty) > 2) { try { n.path = findPath(n.x, n.y, tx, ty, 0, 1) || []; } catch (e) { n.path = []; } n.pathTo = [Math.round(tx), Math.round(ty)]; }
  let gx = tx, gy = ty; if (n.path && n.path.length) { [gx, gy] = n.path[0]; if (dist(n.x, n.y, gx, gy) < 0.35) n.path.shift(); }
  const dx = gx - n.x, dy = gy - n.y, d = Math.hypot(dx, dy); if (d < 0.05) return dist(n.x, n.y, tx, ty) < 0.6;
  const s = Math.min(d, speed * dt), nx = n.x + dx / d * s, ny = n.y + dy / d * s;
  if (canStand(nx, ny, 0, 0.22)) { n.x = nx; n.y = ny; } else if (canStand(nx, n.y, 0, 0.22)) n.x = nx; else if (canStand(n.x, ny, 0, 0.22)) n.y = ny; else { n.x = nx; n.y = ny; }
  n.walk = true; return dist(n.x, n.y, tx, ty) < 0.6;
}
// execução no cadafalso (usada pelo jogador e pela sentinela)
function startExecution(v, by) {
  if (!npcAlive('executioner')) return false;
  const now = now_(); v.x = STAGE.x; v.y = STAGE.y; v.z = 0; v.execAt = now + 2600; v.downed.until = Math.max(v.downed.until, now + 12000);
  near(STAGE.x, STAGE.y, { t: 'exec', id: v.id, x: STAGE.x, y: STAGE.y, ms: 2600 }); sys(by + ' levou ' + v.name + ' ao cadafalso!');
  setTimeout(() => { const q = S.players[v.id]; if (!q) return; q.execAt = 0; if (!q.downed) return; q.downed = null; severPlayer(q, 'head', { x: STAGE.x, y: STAGE.y + 1, name: 'o Carrasco' }); }, 2600);
  return true;
}
function guardThink(n, now, dt) {
  n.walk = false;
  // carregando alguém: procurado vai ao cadafalso; ferido inocente vai à sacerdotisa
  if (n.carrying) {
    const q = S.players[n.carrying]; if (!q || !q.downed) { if (q) npcDropCarried(n); else n.carrying = null; return; }
    q.x = n.x; q.y = n.y; q.downed.until = Math.max(q.downed.until, now + 4000);
    if (n.mission === 'stage' && STAGE.x >= 0) { if (npcWalk(n, STAGE.x + 1.2, STAGE.y + 2.2, 1.7, dt)) { const v = npcDropCarried(n); if (v && !startExecution(v, n.name)) tell(v, 'Sem carrasco, a sentinela te larga no cadafalso.'); n.mission = null; } }
    else { const tx = TEMPLE_SPAWN.x, ty = TEMPLE_SPAWN.y; if (npcWalk(n, tx, ty, 1.7, dt)) { const v = npcDropCarried(n); n.mission = null; if (v && npcAlive('priest')) { revivePlayer(v, 0.35, 'Irmã Lúmina'); tell(v, 'A sentinela te trouxe até a Irmã Lúmina.'); } } }
    return;
  }
  // procurados à vista: persegue e ataca; caído, carrega
  let tgt = null, bd = 14;
  for (const q of Object.values(S.players)) { if (q.dev || q.carriedBy || !(now < (q.wanted || 0) || n.aggro === q.id)) continue; const d = dist(n.x, n.y, q.x, q.y); if (d < bd && (d < 3 || sightClear(n.x, n.y, q.x, q.y))) { bd = d; tgt = q; } }
  if (tgt) {
    if (tgt.downed) { if (bd < 1.3) { entCarry(n, tgt, 'n:' + n.id); n.mission = 'stage'; n.aggro = null; sys(n.name + ' prendeu ' + tgt.name + ' e o leva ao cadafalso!'); } else npcWalk(n, tgt.x, tgt.y, 2.3, dt); return; }
    if (bd > 1.3) { npcWalk(n, tgt.x, tgt.y, 2.3, dt); return; }
    if (now >= (n.nextAtk || 0)) {
      n.nextAtk = now + 1400; n.face = Math.atan2(tgt.y - n.y, tgt.x - n.x);
      near(n.x, n.y, { t: 'anim', w: 'n', id: n.id, a: 'atk_slashR', ms: 900, tx: tgt.x, ty: tgt.y });
      setTimeout(() => { if (n.dead || n.downed || !S.players[tgt.id] || tgt.downed || dist(n.x, n.y, tgt.x, tgt.y) > 1.8) return; if (now_() < (tgt.dodgeUntil || 0)) { near(tgt.x, tgt.y, { t: 'whiff', id: tgt.id }); return; } if (tgt.parry) { tgt.cst -= 16; near(tgt.x, tgt.y, { t: 'clang', x: (n.x + tgt.x) / 2, y: (n.y + tgt.y) / 2 }); if (tgt.cst <= 0) guardBreak(tgt, now_()); sendStat(tgt); return; } damagePlayer(tgt, rint(16, 26), { x: n.x, y: n.y, name: n.name }, 0, 'torso'); }, 480);
    }
    return;
  }
  n.aggro = null;
  // socorro: jogador caído (não procurado) dentro da cidade, sem ninguém cuidando
  for (const q of Object.values(S.players)) {
    if (!q.downed || q.carriedBy || q.dragBy || q.tied || q.execAt || !inSafe(q.x, q.y) || now < (q.wanted || 0)) continue;
    if (Object.values(S.npcs).some(o => o !== n && o.carrying === q.id)) continue;
    const d = dist(n.x, n.y, q.x, q.y); if (d > 16 || now - (q.downed.until - DOWNED_MS) < 4000) continue;
    if (d < 1.3) { entCarry(n, q, 'n:' + n.id); n.mission = 'temple'; tell(q, 'Uma sentinela te pegou para levar à sacerdotisa.'); } else npcWalk(n, q.x, q.y, 2.2, dt);
    return;
  }
  if (dist(n.x, n.y, n.postX, n.postY) > 0.5) npcWalk(n, n.postX, n.postY, 1.6, dt);
}
function npcTick(now, dt) {
  initNpcs();
  for (const n of Object.values(S.npcs)) {
    if (n.dead) continue;
    if (n.downed) { if (now > n.downed.until && !n.dragBy) { n.downed = null; n.hp = Math.round(n.maxHp * 0.3); sys(n.name + ' se levantou, ferido.'); } continue; }
    if (n.gripBy && !n.downed) { const g = S.players[n.gripBy]; if (!g || !g.drag || g.drag.id !== n.id || now > n.escAt) { n.gripBy = null; n.dragBy = null; if (g && g.drag && g.drag.id === n.id) stopDrag(g, n.name + ' se soltou!'); } continue; }
    if (n.dragBy) continue;
    if (n.kind === 'guard') { guardThink(n, now, dt); continue; }
    if (n.id === 'fruit' && typeof G !== 'undefined' && G.npcs && G.npcs.fruit) { n.x = G.npcs.fruit.x; n.y = G.npcs.fruit.y; }
  }
}
// ---------- monstros: orcs/bandidos levam prisioneiros, lobos arrastam a presa ----------
const CAPTORS = new Set(['orc', 'bandit', 'deserter', 'goblin', 'orcchief', 'deserterchief']);
function captorTick(m, now, dt) {
  const d = MON[m.type];
  if (m.carrying) {
    const q = S.players[m.carrying]; if (!q || !q.downed) { if (q) npcDropCarried(m); else m.carrying = null; return true; }
    q.x = m.x; q.y = m.y; q.downed.until = Math.max(q.downed.until, now + 4000);
    const B = BASTIONS.find(b => b.id === m.bs), hx = B ? B.x : m.homeX, hy = B ? B.y : m.homeY;
    if (dist(m.x, m.y, hx, hy) < 1.5) { const v = npcDropCarried(m); if (v) { v.tied = { until: now + 300000, by: m.type }; v.esc = 0; v.x = hx + 0.8; v.y = hy + 0.3; tell(v, 'Você foi amarrado num poste do acampamento! Martele ESPAÇO para se soltar, ou espere ajuda (F perto solta). Em 5 minutos o chefe vai te executar.'); sys(v.name + ' foi feito prisioneiro.'); } }
    else moveToward(m, hx, hy, d.speed * 0.75 * dt) || (m.x += (hx - m.x) * 0.02, m.y += (hy - m.y) * 0.02);
    return true;
  }
  if (m.carryWant) {
    const q = S.players[m.carryWant]; if (!q || !q.downed || q.carriedBy || q.dragBy || q.tied) { m.carryWant = null; return false; }
    if (dist(m.x, m.y, q.x, q.y) < 1.3) { entCarry(m, q, 'm:' + m.id); m.carryWant = null; tell(q, 'Um ' + MON[m.type].name.toLowerCase() + ' te jogou nas costas e te leva para o acampamento!'); }
    else chase(m, q.x, q.y, d.speed * dt, now);
    return true;
  }
  return false;
}
function wolfDragTick(m, now, dt) {
  const q = S.players[m.dragging];
  if (!q || !q.downed || q.carriedBy || now > m.dragUntil) { if (q && q.dragBy === 'w:' + m.id) { q.dragBy = null; q.dragMode = null; } m.dragging = null; return false; }
  // puxa para longe dos outros jogadores
  let ax = 0, ay = 0; for (const o of Object.values(S.players)) { if (o === q || o.downed) continue; const dd = dist(o.x, o.y, m.x, m.y); if (dd < 14) { ax += (m.x - o.x) / (dd + 0.5); ay += (m.y - o.y) / (dd + 0.5); } }
  if (Math.hypot(ax, ay) < 0.05) { m.dragA = m.dragA ?? Math.random() * Math.PI * 2; ax = Math.cos(m.dragA); ay = Math.sin(m.dragA); } const l = Math.hypot(ax, ay) || 1;
  moveToward(m, m.x + ax / l * 2, m.y + ay / l * 2, MON[m.type].speed * 0.55 * dt);
  const a = Math.atan2(ay, ax), nx = m.x - Math.cos(a) * 1.0, ny = m.y - Math.sin(a) * 1.0; if (canStand(nx, ny, 0, 0.15)) { q.x = nx; q.y = ny; }
  return true;
}
function tiedTick(p, now) {
  if (!p.tied) return;
  if (!p.downed) { p.tied = null; return; }
  p.downed.until = Math.max(p.downed.until, now + 5000);   // amarrado não sangra até morrer
  if (now > p.tied.until) { p.tied = null; sys(p.name + ' foi executado pelo chefe do acampamento.'); p.downed = null; severPlayer(p, 'head', { x: p.x + 1, y: p.y, name: 'o chefe' }); }
}
function untie(p, m) {
  const q = S.players[m.id]; if (!q || !q.tied || dist(p.x, p.y, q.x, q.y) > 2) return;
  q.tied = null; q.esc = 0; q.downed.until = now_() + DOWNED_MS; tell(q, p.name + ' cortou suas cordas!'); tell(p, 'Você soltou ' + q.name + '. Reanime-o!');
}
function tiedStruggle(p) {
  if (!p.tied) return false;
  p.esc = (p.esc || 0) + 2.5; if (p.esc >= 100) { p.tied = null; p.esc = 0; revivePlayer(p, 0.15, 'você mesmo'); tell(p, 'Você se livrou das cordas! Fuja!'); } else sendStat(p);
  return true;
}

// ---------------- cozinha ----------------
function cookAt(p, r) {
  const rc = RECIPES[r], now = now_(); if (!rc || p.downed || now < (p.cookT || 0)) return;
  const st = KITCHENS.find(k => dist(k.x, k.y, p.x, p.y) < 1.9); if (!st) { tell(p, 'Precisa estar perto de um fogão.'); return; }
  const has = () => Object.entries(rc.need).every(([k, n]) => k === 'meat' ? (p.inv.venison || 0) + (p.inv.pork || 0) >= n : (p.inv[k] || 0) >= n);
  if (!has()) { tell(p, 'Faltam ingredientes.'); return; }
  p.cookT = now + 3200; const x0 = p.x, y0 = p.y;
  near(p.x, p.y, { t: 'anim', w: 'p', id: p.id, a: 'cook', ms: 3000, tx: st.x, ty: st.y });
  setTimeout(() => {
    if (!S.players[p.id] || p.downed || dist(p.x, p.y, x0, y0) > 0.6) { tell(p, 'Você saiu do fogão e a comida passou do ponto.'); return; }
    if (!has()) return;
    for (const [k, n] of Object.entries(rc.need)) { if (k === 'meat') { let left = n; for (const mk of ['venison', 'pork']) { const t = Math.min(left, p.inv[mk] || 0); p.inv[mk] -= t; left -= t; if (!p.inv[mk]) delete p.inv[mk]; } } else { p.inv[k] -= n; if (!p.inv[k]) delete p.inv[k]; } }
    p.inv[rc.out] = (p.inv[rc.out] || 0) + 1; useGain(p, 'cook', 2); Net.toOne(p.id, { t: 'loot', k: rc.out }); tell(p, rc.name + ' pronto!'); sendStat(p);
  }, 3000);
}
// ---------------- progressão por uso e habilidades da árvore ----------------
function useGain(p, k, amt) {
  if (!USE[k] || !p || p.dev || !(amt > 0)) return; p.use = p.use || {};
  const l0 = useLvl(p, k); p.use[k] = (p.use[k] || 0) + amt; const l1 = useLvl(p, k);
  if (l1 > l0) { if (k === 'vigor') { const r = p.hp / Math.max(1, p.maxHp); p.maxHp = maxHpOf(p); if (!p.downed) p.hp = Math.max(1, Math.round(p.maxHp * r)); } if (l1 % 5 === 0) Net.toOne(p.id, { t: 'usel', k, l: l1 }); }
}
function treeSkill(p, b, msg) {
  const br = TREE[p.cls] && TREE[p.cls][b], nd = br && br.nodes[4]; if (!nd) return;
  if (!treeHas(p, nd.id)) { tell(p, 'Aprenda ' + nd.name + ' na árvore de talentos (K).'); return; }
  const now = now_(); p.tcd = p.tcd || {};
  if (p.downed || p.carrying || p.lifted || p.grabbed || now < (p.stunUntil || 0) || now < (p.knockUntil || 0)) return;
  if (now < (p.tcd[b] || 0)) { tell(p, nd.name + ': recarregando (' + Math.ceil((p.tcd[b] - now) / 1000) + 's).'); return; }
  if (p.mp < nd.mp) { tell(p, 'Mana insuficiente.'); return; }
  const a = isFinite(+msg.a) ? +msg.a : 0, shout = { s: nd.name + '!' };
  const sameLvl = q => Math.abs((q.z || 0) - (p.z || 0)) < 0.5 && (q.alt || 0) < 1.2;
  const pickTgt = rng => { let q = S.monsters[msg.id]; if (q && sameLvl(q) && dist(p.x, p.y, q.x, q.y) <= rng) return q; let best = null, bs = 1e9; for (const o of Object.values(S.monsters)) { if (!sameLvl(o)) continue; const d = dist(p.x, p.y, o.x, o.y); if (d > rng) continue; const da = Math.abs(angDiff(Math.atan2(o.y - p.y, o.x - p.x), a)); if (da > 0.7) continue; const sc = d + da * 4; if (sc < bs) { bs = sc; best = o; } } return best; };
  switch (nd.id) {
    case 'charge': {
      let d = 0; for (let s = 0.25; s <= 4; s += 0.25) { if (!canStand(p.x + Math.cos(a) * s, p.y + Math.sin(a) * s, p.z || 0, 0.25)) break; d = s; }
      anim('p', p, 'dash', p.x + Math.cos(a), p.y + Math.sin(a), shout); Net.toOne(p.id, { t: 'push', a, d });
      const hit = Object.values(S.monsters).filter(sameLvl).map(q => { const ax = q.x - p.x, ay = q.y - p.y; return { q, t: ax * Math.cos(a) + ay * Math.sin(a), perp: Math.abs(-ax * Math.sin(a) + ay * Math.cos(a)) }; }).filter(o => o.t > 0 && o.t < d + 1.3 && o.perp < 0.9 + (MON[o.q.type].rad || 0.3)).sort((x, y) => x.t - y.t)[0];
      if (hit) setTimeout(() => { const q = S.monsters[hit.q.id]; if (!q) return; p._melee = true; hitMonster(p, q, 1.8, 0); p._melee = false; if (S.monsters[q.id]) { q.stunUntil = Math.max(q.stunUntil, now_() + 1000); q.atk = null; if (!MON[q.type].big) knockMon(q, p, now_()); } }, 220);
      break;
    }
    case 'taunt': anim('p', p, 'warcry', p.x, p.y, shout); aoe('warcry', p.x, p.y); p.buffs.iron = now + 5000; for (const q of monstersNear(p.x, p.y, 6)) { q.taunt = { pid: p.id, until: now + 5000 }; q.returning = false; q.aggro = p.id; } break;
    case 'banner': anim('p', p, 'warcry', p.x, p.y, shout); addZone(p, 'banner', p.x + Math.cos(a) * 0.8, p.y + Math.sin(a) * 0.8, 0, 12000); break;
    case 'headshot': {
      const q = pickTgt(CLASSES[p.cls].range + treeEff(p, 'range') + 1); if (!q) { tell(p, 'Nenhum alvo na mira.'); return; }
      anim('p', p, 'pierce', q.x, q.y, shout); const id = q.id;
      setTimeout(() => { const t = S.monsters[id]; if (!t) return; const d = flight(p.x, p.y, t.x, t.y); shot(p, 'arrow', t.x, t.y, d, 0); p._forceCrit = true; const r = roll(p, 3.5, t); p._forceCrit = false; hitRolled(p, t, r.dmg, true, d, 1); }, 650);
      break;
    }
    case 'trap': { const mine = (S.zones || []).filter(z => z.k === 'trap' && z.by === p.id); if (mine.length >= 2) removeZone(mine[0]); anim('p', p, 'quiver', p.x, p.y, shout); addZone(p, 'trap', p.x, p.y, 0, 30000); break; }
    case 'smoke':
      near(p.x, p.y, { t: 'smokebomb', x: p.x, y: p.y }); p.buffs.smoke = now + 4000; p.buffs.agile = Math.max(p.buffs.agile || 0, now + 4000);
      for (const q of Object.values(S.monsters)) if ((q.aggro === p.id || (q.taunt && q.taunt.pid === p.id)) && dist(q.x, q.y, p.x, p.y) < 14) { q.aggro = null; q.taunt = null; q.atk = null; q.returning = true; }
      break;
    case 'firewall': { const cx = p.x + Math.cos(a) * 3, cy = p.y + Math.sin(a) * 3; anim('p', p, 'fireball', cx, cy, shout); addZone(p, 'firewall', cx, cy, a, 5000); break; }
    case 'icejail': {
      const q = pickTgt(CLASSES[p.cls].range + 1); if (!q) { tell(p, 'Nenhum alvo na mira.'); return; }
      anim('p', p, 'bolt', q.x, q.y, shout); p._el = 'ice'; hitMonster(p, q, 1.5, 250); p._el = null;
      if (S.monsters[q.id]) { q.stunUntil = Math.max(q.stunUntil, now + 3000); q.atk = null; } near(q.x, q.y, { t: 'icejail', id: q.id, ms: 3000 }); break;
    }
    case 'sanct': anim('p', p, 'heal', p.x, p.y, shout); addZone(p, 'sanct', p.x, p.y, 0, 8000); break;
  }
  p.mp -= nd.mp; p.tcd[b] = now + nd.cd; p.lastCombat = now; if (p.cls === 'mage') useGain(p, 'magic', 2); sendStat(p);
}
function addZone(p, k, x, y, a, ms) {
  const z = { k, x, y, a, by: p.id, until: now_() + ms, t: 0 }; (S.zones = S.zones || []).push(z);
  near(x, y, { t: 'zone', k, x, y, a, ms, z: p.z || 0 });
  if (k === 'firewall') { const l = []; for (let s = -2; s <= 2.01; s += 0.5) l.push([x - Math.sin(a) * s, y + Math.cos(a) * s, 1.1, ms]); near(x, y, { t: 'fires', l, nb: 1 }); }
  return z;
}
function removeZone(z) { S.zones = (S.zones || []).filter(q => q !== z); near(z.x, z.y, { t: 'zoneoff', k: z.k, x: z.x, y: z.y }); }
function zoneTick(now) {
  if (!S.zones || !S.zones.length) return;
  for (const z of S.zones.slice()) {
    const p = S.players[z.by];
    if (now >= z.until || !p) { removeZone(z); continue; }
    if (now < z.t) continue;
    if (z.k === 'trap') { z.t = now + 100; const q = Object.values(S.monsters).find(o => (o.alt || 0) < 1 && dist(o.x, o.y, z.x, z.y) < 0.75 + (MON[o.type].rad || 0.3) * 0.5); if (q) { hitMonster(p, q, 1.5, 0); if (S.monsters[q.id]) { q.stunUntil = Math.max(q.stunUntil, now + 3000); q.atk = null; } removeZone(z); } continue; }
    if (z.k === 'firewall') { z.t = now + 500; for (const q of Object.values(S.monsters)) { const ax = q.x - z.x, ay = q.y - z.y; if (Math.abs(-ax * Math.sin(z.a) + ay * Math.cos(z.a)) < 2.6 && Math.abs(ax * Math.cos(z.a) + ay * Math.sin(z.a)) < 0.9) { p._el = 'fire'; hitMonster(p, q, 0.6, 0); p._el = null; } } continue; }
    if (z.k === 'banner' || z.k === 'sanct') {
      z.t = now + 1000; const r = z.k === 'banner' ? 4.5 : 4;
      for (const q of Object.values(S.players)) { if (q.downed || dist(q.x, q.y, z.x, z.y) > r) continue; q.buffs[z.k] = now + 1500; const h = Math.round(q.maxHp * (z.k === 'sanct' ? 0.03 * (1 + treeEff(p, 'holy')) : 0.015)); if (q.hp < q.maxHp) { q.hp = Math.min(q.maxHp, q.hp + h); sendStat(q); } }
    }
  }
}

// ---------------- laço principal (10x por segundo) ----------------
function hostTick() {
  const now = now_();
  const dt = S.lastTick ? Math.min(0.25, (now - S.lastTick) / 1000) : 0.1;
  S.lastTick = now;
  const players = Object.values(S.players);

  if (!S.filled) {
    for (let i = 0; i < 8000 && wildCount() < MAX_WILD; i++) spawnMonster();
    S.filled = true;
  } else if (now >= S.nextSpawn && wildCount() < MAX_WILD) {
    for (let i = 0; i < 40; i++) if (spawnMonster()) break;
    S.nextSpawn = now + 1500;
  }

  for (const p of players) { if (p.wanted && (now > p.wanted || !inSafe(p.x, p.y))) { p.wanted = 0; Net.toAll({ t: 'wanted', id: p.id, ms: 0 }); }
    bodyTick(p, now, dt); survivalTick(p, now, dt); combatTick(p, now, dt); bowTick(p, now, dt); dragTick(p, now, dt); tiedTick(p, now); if (p.running && p.walking) { const d = dist(p._rx ?? p.x, p._ry ?? p.y, p.x, p.y); if (d < 3) useGain(p, 'run', d); } p._rx = p.x; p._ry = p.y; }
  if (!S.bslots) initBastions();
  tickBastions(now);
  if (S.fires && S.fires.length) { S.fires = S.fires.filter(f => f.until > now); for (const p of players) { if (p.downed || now < (p.burnT || 0)) continue; if (S.fires.some(f => dist(f.x, f.y, p.x, p.y) < f.r)) { p.burnT = now + 500; damagePlayer(p, 6, null, 0); if (Math.random() < 0.25) ignitePlayer(p, now); } } }
  npcTick(now, dt); dragCleanup(); fireTick(now, players); zoneTick(now); arrowTick(now, dt); arrowBleedTick(now);

  for (const p of players) {
    if (p.downed) {
      // reanimação em andamento
      if (p.revive) {
        const r = S.players[p.revive.by];
        if (!r || r.downed || dist(r.x, r.y, p.x, p.y) > 1.9) { p.revive = null; near(p.x, p.y, { t: 'rv', id: p.id, by: null }); }
        else if (now - p.revive.start >= REVIVE_MS) revivePlayer(p, 0.3, r.name);
      }
      // levado até a capela: a Irmã Lúmina reanima
      if (p.downed) { const pr = NPCS[0]; if (dist(p.x, p.y, pr.x, pr.y) <= 2.6) { revivePlayer(p, 1); near(p.x, p.y, { t: 'chat', name: '', text: 'A Irmã Lúmina reanimou ' + p.name + '.' }); } }
      if (p.downed && now >= p.downed.until) respawnTemple(p);
      continue;
    }
    if (p.aid) {
      const r = S.players[p.aid.by];
      if (!r || r.downed || dist(r.x, r.y, p.x, p.y) > 1.9 || p.hp >= p.maxHp * KNEEL_HP) { p.aid = null; near(p.x, p.y, { t: 'rv', id: p.id, by: null }); }
      else if (now - p.aid.start >= AID_MS) { p.hp = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * AID_HEAL)); p.aid = null; near(p.x, p.y, { t: 'rv', id: p.id, by: null }); aoe('heal', p.x, p.y, { id: p.id }); tell(p, r.name + ' te ajudou a levantar.'); sendStat(p); }
    }
    if (p.casting && now >= p.casting.until) { const c = p.casting; p.casting = null; execSkill(p, c.i, S.monsters[c.tid]); }
    if (!p.target) continue;
    const m = S.monsters[p.target];
    if (!m) { p.target = null; continue; }
    if (false && p.cls !== 'knight' && dist(p.x, p.y, m.x, m.y) > 2.2 && !p.atk && !p.parry && !p.casting && !p.carrying && !p.lifted && now >= p.nextAtk && !inSafe(p.x, p.y) && Math.abs(p.z - (m.z || 0)) < 0.5 && dist(p.x, p.y, m.x, m.y) <= CLASSES[p.cls].range + (MON[m.type].rad || 0)) basicAttack(p, m, now);
  }

  for (const m of Object.values(S.monsters)) monsterThink(m, players, now, dt);

  // regeneração fora de combate
  if (now - S.lastRegen >= 1000) {
    S.lastRegen = now;
    for (const p of players) {
      if (p.downed || now - p.lastCombat < OUT_OF_COMBAT_MS) continue;
      if (p.hp >= p.maxHp && p.mp >= p.maxMp) continue;
      let hr = Math.ceil(p.maxHp * 0.04) + 1, mr = Math.ceil(p.maxMp * 0.05) + 1;
      if (p.cls === 'mage') mr *= 2;
      hr = Math.ceil(hr * (1 + treeEff(p, 'regen'))); mr = Math.ceil(mr * (1 + treeEff(p, 'mregen')));
      if (buffOn(p, 'mead')) { hr = Math.ceil(hr * 1.5); mr = Math.ceil(mr * 1.5); }
      if (inSafe(p.x, p.y)) { hr *= 2; mr *= 2; }
      if (p.sit) { hr = Math.ceil(hr * 2.5); mr = Math.ceil(mr * 2.5); }
      if (p.sleep != null) { hr = Math.ceil(hr * 4); mr = Math.ceil(mr * 4); }
      p.hp = Math.min(p.maxHp, p.hp + hr); p.mp = Math.min(p.maxMp, p.mp + mr);
      sendStat(p);
    }
  }

  // pacotes de estado: cada jogador recebe só o que está perto
  const mons = Object.values(S.monsters);
  for (const r of players) {
    const pl = [], ml = [];
    for (const p of players) {
      if (dist(p.x, p.y, r.x, r.y) > VIEW_RADIUS) continue;
      if (p.devHidden && p.id !== r.id) continue;
      let fl = (p.walking ? 1 : 0) | (p.downed ? 2 : 0) | (p.carriedBy ? 4 : 0) | (p.carrying ? 8 : 0) | (p.running && p.walking ? 256 : 0) | (p.sit ? 512 : 0) | (p.sit === 'c' ? 1024 : 0) | (p.sleep != null ? 32768 : 0) | (p.drawT ? 65536 : 0) | (p.dragBy ? 131072 : 0) | (p.dragMode === 'foot' ? 262144 : 0) | (p.drag && p.drag.mode === 'arms' ? 524288 : 0) | (p.drag && p.drag.mode === 'foot' ? 1048576 : 0) | (p.drag && p.drag.mode === 'back' ? 2097152 : 0) | (p.drag && p.drag.mode === 'grip' ? 4194304 : 0) | (p.gripBy ? 8388608 : 0) | (p.tied ? 16777216 : 0) | ((p.fl || 0) << 11) | (p.crouch ? 8192 : 0) | (p.slide ? 16384 : 0);
      for (const b in BUFF_BITS) if (buffOn(p, b)) fl |= BUFF_BITS[b];
      pl.push([p.id, Math.round(p.x * 100), Math.round(p.y * 100), Math.round(p.z * 100), p.dir | 0, fl, Math.round(p.hp / p.maxHp * 100), p.carrying || 0, p.lifted || 0, bodyBits(p), (p.lost || 0) | ((p.pro || 0) << 5), p.drag ? p.drag.k + ':' + p.drag.id : 0]);
    }
    for (const m of mons) {
      if (Math.abs(m.x - r.x) > VIEW_RADIUS || Math.abs(m.y - r.y) > VIEW_RADIUS) continue;
      ml.push([m.id, MON_TYPES.indexOf(m.type), Math.round(m.x * 100), Math.round(m.y * 100), m.hp, (m.slowUntil > now ? 1 : 0) | (m.stunUntil > now ? 2 : 0) | (m.sleep ? 4 : 0) | (m.fury ? 8 : 0) | ((m.lost || 0) << 5), m.face, MON[m.type].dragon ? dragonDir(m) : -1, Math.round((m.alt || 0) * 10), m.carrying || 0]);
    }
    const ch = []; for (const id in S.chests) { const c = S.chests[id]; if (Math.abs(c.x - r.x) <= VIEW_RADIUS && Math.abs(c.y - r.y) <= VIEW_RADIUS) ch.push([c.id, Math.round(c.x * 100), Math.round(c.y * 100), c.opened.has(r.id) ? 1 : 0, c.who.has(r.id) ? 1 : 0]); }
    const co = []; for (const id in S.corpses || {}) { const c = S.corpses[id]; if (Math.abs(c.x - r.x) <= VIEW_RADIUS && Math.abs(c.y - r.y) <= VIEW_RADIUS) co.push([c.id, MON_TYPES.indexOf(c.type), Math.round(c.x * 100), Math.round(c.y * 100), c.z, c.looted ? 1 : 0, Math.round(c.ix * 10), Math.round(c.iy * 10), c.lost || 0, c.onBack || 0]); }
    const np = []; for (const n of Object.values(S.npcs || {})) { if (Math.abs(n.x - r.x) > VIEW_RADIUS + 4 || Math.abs(n.y - r.y) > VIEW_RADIUS + 4) continue; np.push([n.id, Math.round(n.x * 100), Math.round(n.y * 100), (n.downed ? 1 : 0) | (n.dead ? 2 : 0) | (n.dragBy && n.dragMode !== 'back' ? 4 : 0) | (n.dragMode === 'foot' ? 8 : 0) | (n.walk ? 32 : 0), n.onBack || 0, n.carrying || 0]); }
    Net.toOne(r.id, { t: 's', p: pl, m: ml, ch, co, np }, true);
  }
}

function startHostLoop() {
  try {
    const src = 'setInterval(() => postMessage(0), 100);';
    const w = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
    w.onmessage = hostTick;
  } catch (e) { setInterval(hostTick, 100); }
}
