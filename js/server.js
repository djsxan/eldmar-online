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
    pots: { hp: p.pots.hp, mp: p.pots.mp }, quests: { ...p.quests }, qdone: { ...p.qdone },
    buffs: Object.entries(p.buffs).filter(([, u]) => u > now).map(([k, u]) => [k, u - now]),
    cds: [0, 1, 2, 3].map(i => Math.max(0, (p.cds[i] || 0) - now)),
    combat: now - p.lastCombat < OUT_OF_COMBAT_MS, downed: p.downed ? p.downed.until - now : 0,
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
  if (!canStand(x, y, 0, 0.3) || inSafe(x, y)) return false;
  if (monsterAtPos(x, y, m)) return false;
  for (const id in S.players) { const p = S.players[id]; if (p.z < 0.5 && !p.downed && dist(p.x, p.y, x, y) < 0.55) return false; }
  return true;
}

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
    const skin = SKINS[cls].some(s => s.id === m.skin) ? m.skin : SKINS[cls][0].id;
    const lvl = clamp(m.lvl | 0 || 1, 1, 300);
    const s = townSpot();
    const np = {
      id: from, name: String(m.name || 'Aventureiro').slice(0, 16), cls, skin,
      color: /^#[0-9a-f]{6}$/i.test(m.color) ? m.color : '#8b2e2e',
      x: s.x, y: s.y, z: 0, lvl, xp: clamp(m.xp | 0, 0, need(lvl) - 1), gold: clamp(m.gold | 0, 0, 1e7),
      pots: { hp: clamp((m.pots && m.pots.hp) | 0, 0, 999), mp: clamp((m.pots && m.pots.mp) | 0, 0, 999) },
      maxHp: maxHpFor(cls, lvl), maxMp: maxMpFor(cls, lvl), hp: 0, mp: 0,
      target: null, nextAtk: 0, cds: {}, buffs: {}, casting: null, lastCombat: 0, potCd: 0, lastMv: now_(),
      downed: null, carriedBy: null, carrying: null, revive: null, quests: {}, qdone: {},
    };
    if (m.quests) for (const q of QUESTS) if (m.quests[q.id] != null) np.quests[q.id] = clamp(m.quests[q.id] | 0, 0, q.count);
    if (m.qdone) for (const q of QUESTS) if (m.qdone[q.id]) np.qdone[q.id] = m.qdone[q.id] | 0;
    np.hp = np.maxHp; np.mp = np.maxMp;
    if (!m.lvl) { np.gold = 30; np.pots.hp = 3; np.pots.mp = 2; } // kit inicial
    S.players[from] = np;
    Net.toOne(from, { t: 'welcome', you: from, x: np.x, y: np.y, players: Object.values(S.players).map(pinfo) });
    Net.toOthers({ t: 'pinfo', p: pinfo(np) }, from);
    sendStat(np);
    sys(`${np.name}, ${CLASSES[cls].name}, chegou à Cidadela de Eldmar.`);
    return;
  }
  if (!p) return;
  switch (m.t) {
    case 'mv': handleMove(p, m); break;
    case 'target': p.target = m.id && S.monsters[m.id] ? m.id : null; break;
    case 'chat': { const text = String(m.text || '').slice(0, 140).trim(); if (text) Net.toAll({ t: 'chat', id: from, name: p.name, text }); break; }
    case 'skill': if (!p.downed) useSkill(p, m.i | 0); break;
    case 'pot': if (!p.downed) usePot(p, m.k); break;
    case 'npc': npcAction(p, m); break;
    case 'revive': {
      const t = S.players[m.id];
      if (m.on && t && t.downed && !p.downed && dist(p.x, p.y, t.x, t.y) <= 1.8) { t.revive = { by: p.id, start: now_() }; near(t.x, t.y, { t: 'rv', id: t.id, by: p.id }); }
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
  const now = now_();
  const x = +m.x, y = +m.y;
  if (!isFinite(x) || !isFinite(y)) return;
  const z = heightAt(x, y, p.z);
  const dt = Math.min(1, (now - p.lastMv) / 1000);
  const maxStep = PLAYER_SPEED * (m.r ? RUN_MUL * 1.5 : 1.7) * (dt + 0.25) + 0.4;
  const ok = dist(p.x, p.y, x, y) <= maxStep && canStandZ(x, y, z, 0.18) && Math.abs(z - (+m.z || 0)) < 0.45;
  if (!ok) { Net.toOne(p.id, { t: 'tp', x: p.x, y: p.y, z: p.z }); return; }
  if (p.sit && dist(p.x, p.y, x, y) > 0.05) p.sit = null;
  p.x = x; p.y = y; p.z = z; p.dir = m.d | 0; p.walking = !!m.w; p.running = !!m.r; p.lastMv = now;
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
  Net.toOne(t.id, { t: 'tp', x: t.x, y: t.y, z: t.z });
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
function roll(p, mult = 1) {
  const c = CLASSES[p.cls], l = p.lvl;
  let dmg = rint(Math.floor(c.dmg[0][0] + c.dmg[0][1] * l), Math.floor(c.dmg[1][0] + c.dmg[1][1] * l)) * mult;
  if (buffOn(p, 'mead')) dmg *= 1.1;
  if (buffOn(p, 'whet')) dmg *= 1.15;
  const crit = Math.random() < c.crit + (buffOn(p, 'agile') ? 0.1 : 0);
  if (crit) dmg *= 1.8;
  return { dmg: Math.max(1, Math.round(dmg)), crit };
}

function hitMonster(p, m, mult, delay = 0) {
  if (!S.monsters[m.id]) return;
  const { dmg, crit } = roll(p, mult);
  m.hp -= dmg; m.aggro = p.id; m.returning = false;
  p.lastCombat = now_();
  near(m.x, m.y, { t: 'hit', k: 'm', id: m.id, x: m.x, y: m.y, dmg, crit, d: delay, by: p.id, ax: p.x, ay: p.y, hv: mult >= 2 ? 1 : 0 });
  if (m.hp <= 0) killMonster(m, p, delay);
}

function killMonster(m, p, delay) {
  delete S.monsters[m.id];
  near(m.x, m.y, { t: 'mdie', id: m.id, d: delay });
  for (const id in S.players) if (S.players[id].target === m.id) S.players[id].target = null;
  const def = MON[m.type];
  const gold = rint(def.gold[0], def.gold[1]);
  p.gold += gold;
  sfx(m.x, m.y, `+${gold} ouro`, '#e8c860', delay + 250);
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
    p.maxHp = maxHpFor(p.cls, p.lvl); p.maxMp = maxMpFor(p.cls, p.lvl);
    if (!p.downed) { p.hp = p.maxHp; p.mp = p.maxMp; }
    aoe('lvlup', p.x, p.y, { id: p.id, d: delay });
    sys(`${p.name} alcançou o nível ${p.lvl}.`);
    Net.toAll({ t: 'pinfo', p: pinfo(p) });
  }
  sendStat(p);
}

function damagePlayer(p, raw, m, delay = 0) {
  if (p.downed) return;
  const c = CLASSES[p.cls];
  let mult = 1 - c.armor;
  if (buffOn(p, 'wall')) mult *= 0.4;
  if (buffOn(p, 'warcry')) mult *= 0.8;
  if (buffOn(p, 'bless')) mult *= 0.9;
  const dmg = Math.max(1, Math.round(raw * mult));
  p.hp -= dmg;
  p.lastCombat = now_();
  near(p.x, p.y, { t: 'hit', k: 'p', id: p.id, x: p.x, y: p.y, dmg, d: delay, ax: m ? m.x : p.x, ay: m ? m.y : p.y - 1 });
  if (p.hp > 0) { sendStat(p); return; }
  goDown(p, m);
}

// ---------------- caído (downed) ----------------
function goDown(p, m) {
  p.hp = 0; p.downed = { until: now_() + DOWNED_MS }; p.target = null; p.casting = null; p.revive = null;
  if (p.carrying) dropCarried(p);
  for (const id in S.monsters) { const q = S.monsters[id]; if (q.aggro === p.id) q.aggro = null; if (q.taunt && q.taunt.pid === p.id) q.taunt = null; }
  near(p.x, p.y, { t: 'down', id: p.id });
  sys(`${p.name} caiu diante de ${m ? MON[m.type].name : 'um inimigo'}. Ajude-o!`);
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
  Net.toOne(p.id, { t: 'tp', x: p.x, y: p.y, z: p.z });
  sendStat(p);
}
function respawnTemple(p) {
  if (p.carriedBy && S.players[p.carriedBy]) S.players[p.carriedBy].carrying = null;
  p.carriedBy = null; p.downed = null; p.revive = null;
  p.xp = Math.floor(p.xp / 2);
  p.hp = p.maxHp; p.mp = p.maxMp; p.lastCombat = 0;
  const s = townSpot(); p.x = s.x; p.y = s.y; p.z = 0;
  Net.toOne(p.id, { t: 'tp', x: p.x, y: p.y, z: 0 });
  Net.toOne(p.id, { t: 'respawned' });
  near(p.x, p.y, { t: 'up', id: p.id });
  sendStat(p);
}

const flight = (ax, ay, bx, by) => 120 + Math.hypot(ax - bx, ay - by) * 55;

function basicAttack(p, m, now) {
  const c = CLASSES[p.cls];
  p.nextAtk = now + c.atkMs * (buffOn(p, 'agile') ? 0.5 : 1);
  if (p.cls === 'knight') { anim('p', p, 'swing', m.x, m.y); hitMonster(p, m, 1, 180); }
  else if (p.cls === 'archer') { const d = flight(p.x, p.y, m.x, m.y) + 200; anim('p', p, 'shoot', m.x, m.y, { proj: 'arrow', d }); hitMonster(p, m, 1, d); }
  else { const d = flight(p.x, p.y, m.x, m.y) + 150; anim('p', p, 'bolt', m.x, m.y, { proj: 'bolt', d }); hitMonster(p, m, 1, d); }
}

// ---------------- habilidades ----------------
function useSkill(p, i) {
  const sk = SKILLS[p.cls][i], now = now_();
  if (!sk || p.casting || p.carrying) return;
  if (now < (p.cds[i] || 0)) return;
  if (p.mp < sk.mp) { tell(p, 'Mana insuficiente.'); return; }
  let m = null;
  if (sk.tgt) {
    m = S.monsters[p.target];
    if (!m) { tell(p, 'Selecione um alvo.'); return; }
    if (dist(p.x, p.y, m.x, m.y) > sk.range) { tell(p, 'Alvo fora de alcance.'); return; }
  }
  const offensive = sk.id !== 'heal' && sk.id !== 'wall' && sk.id !== 'agile';
  if (offensive && inSafe(p.x, p.y)) { tell(p, 'Não se luta dentro da cidadela.'); return; }
  p.mp -= sk.mp; p.cds[i] = now + sk.cd;
  if (sk.cast) {
    p.casting = { i, until: now + sk.cast, tid: m && m.id }; p.castX = p.x; p.castY = p.y;
    near(p.x, p.y, { t: 'cast', id: p.id, ms: sk.cast, s: sk.name, el: sk.el });
  } else execSkill(p, i, m);
  sendStat(p);
}
function monstersNear(x, y, r) { return Object.values(S.monsters).filter(m => dist(m.x, m.y, x, y) <= r); }

function execSkill(p, i, m) {
  const sk = SKILLS[p.cls][i], now = now_();
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
    case 'nova': anim('p', p, 'nova', tx, ty, shout); aoe('nova', p.x, p.y); for (const q of monstersNear(p.x, p.y, 2.5)) { q.slowUntil = now + 4000; hitMonster(p, q, 1.4, 200); } break;
    case 'heal':
      anim('p', p, 'heal', tx, ty, shout);
      for (const q of Object.values(S.players)) {
        if (dist(q.x, q.y, p.x, p.y) > 4) continue;
        if (q.downed) { revivePlayer(q, 0.25, p.name); continue; }
        const h = Math.min(q.maxHp - q.hp, Math.round(20 + p.lvl * 5 + q.maxHp * 0.15));
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
  if (k === 'hp') { const h = Math.min(p.maxHp - p.hp, Math.ceil(p.maxHp * 0.35)); p.hp += h; sfx(p.x, p.y, `+${h}`, '#7ad87a'); }
  else { const h = Math.min(p.maxMp - p.mp, Math.ceil(p.maxMp * 0.4)); p.mp += h; sfx(p.x, p.y, `+${h}`, '#6a9ae8'); }
  aoe('potion', p.x, p.y, { id: p.id, k });
  sendStat(p);
}

// ---------------- NPCs ----------------
function npcAction(p, m) {
  const n = NPCS.find(q => q.id === m.n);
  if (!n || dist(p.x, p.y, n.x, n.y) > 3.5) { tell(p, 'Chegue mais perto para conversar.'); return; }
  const say = text => Net.toOne(p.id, { t: 'npc', n: n.id, text });
  const pay = cost => { if (p.gold < cost) { say('Você não tem ouro suficiente.'); return false; } p.gold -= cost; return true; };
  const now = now_();
  if (n.id === 'merchant' && m.a === 'buy' && ITEMS[m.item]) {
    const qty = m.qty === 5 ? 5 : 1;
    if (!pay(ITEMS[m.item].price * qty)) return;
    p.pots[m.item] += qty;
    say(`${qty}x ${ITEMS[m.item].name}. Boa caçada, e volte inteiro.`);
  } else if (n.id === 'priest' && m.a === 'bless') {
    p.hp = p.maxHp; p.mp = p.maxMp; p.buffs.bless = now + 180000;
    aoe('heal', p.x, p.y, { id: p.id });
    say('Que a Aurora guarde seus passos. Suas feridas estão fechadas, e a bênção reduz o dano que você recebe por algum tempo.');
  } else if (n.id === 'innkeeper' && m.a === 'mead') {
    if (!pay(15)) return;
    p.buffs.mead = now + 180000;
    say('Hidromel da casa. Aquece o sangue: +10% de dano e recuperação mais rápida por 3 minutos.');
  } else if (n.id === 'innkeeper' && m.a === 'stew') {
    if (!pay(10)) return;
    p.hp = p.maxHp; p.mp = p.maxMp;
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
  if (now < m.stunUntil) return;
  const speed = d.speed * (now < m.slowUntil ? 0.5 : 1), step = speed * dt;
  const homeDist = dist(m.x, m.y, m.homeX, m.homeY);
  const reach = d.big ? 1.7 : 1.3;
  if (m.returning) {
    if (homeDist <= 1.5) { m.returning = false; m.aggro = null; }
    else chase(m, m.homeX, m.homeY, step * 1.1, now);
    return;
  }
  let tgt = null;
  const valid = p => p && !p.downed && p.z < 0.5 && !inSafe(p.x, p.y);
  if (m.taunt && m.taunt.until > now && valid(S.players[m.taunt.pid])) tgt = S.players[m.taunt.pid];
  if (!tgt && m.aggro && valid(S.players[m.aggro]) && dist(m.x, m.y, S.players[m.aggro].x, S.players[m.aggro].y) <= 11) tgt = S.players[m.aggro];
  if (!tgt) {
    let best = 99;
    for (const p of players) { if (!valid(p)) continue; const dd = dist(m.x, m.y, p.x, p.y); if (dd <= d.aggro && dd < best) { best = dd; tgt = p; } }
  }
  if (tgt) {
    if (homeDist > 13) { m.returning = true; m.aggro = null; m.taunt = null; return; }
    const dd = dist(m.x, m.y, tgt.x, tgt.y);
    const sdx = (tgt.x - m.x) - (tgt.y - m.y); if (Math.abs(sdx) > 0.05) m.face = sdx > 0 ? 1 : -1;
    if (dd <= reach) {
      if (now >= m.nextAtk) { m.nextAtk = now + d.atk; anim('m', m, 'bite', tgt.x, tgt.y); damagePlayer(tgt, rint(d.dmg[0], d.dmg[1]), m, 200); }
    } else {
      chase(m, tgt.x, tgt.y, step, now);
      m.nextAtk = Math.max(m.nextAtk, now + 300);
    }
    m.wander = null;
  } else {
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

// ---------------- laço principal (10x por segundo) ----------------
function hostTick() {
  const now = now_();
  const dt = S.lastTick ? Math.min(0.25, (now - S.lastTick) / 1000) : 0.1;
  S.lastTick = now;
  const players = Object.values(S.players);

  if (!S.filled) {
    for (let i = 0; i < 8000 && Object.keys(S.monsters).length < MAX_MON; i++) spawnMonster();
    S.filled = true;
  } else if (now >= S.nextSpawn && Object.keys(S.monsters).length < MAX_MON) {
    for (let i = 0; i < 40; i++) if (spawnMonster()) break;
    S.nextSpawn = now + 1500;
  }

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
    if (p.casting && now >= p.casting.until) { const c = p.casting; p.casting = null; execSkill(p, c.i, S.monsters[c.tid]); }
    if (!p.target) continue;
    const m = S.monsters[p.target];
    if (!m) { p.target = null; continue; }
    if (!p.casting && !p.carrying && now >= p.nextAtk && !inSafe(p.x, p.y) && p.z < 0.5 && dist(p.x, p.y, m.x, m.y) <= CLASSES[p.cls].range) basicAttack(p, m, now);
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
      if (buffOn(p, 'mead')) { hr = Math.ceil(hr * 1.5); mr = Math.ceil(mr * 1.5); }
      if (inSafe(p.x, p.y)) { hr *= 2; mr *= 2; }
      if (p.sit) { hr = Math.ceil(hr * 2.5); mr = Math.ceil(mr * 2.5); }
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
      let fl = (p.walking ? 1 : 0) | (p.downed ? 2 : 0) | (p.carriedBy ? 4 : 0) | (p.carrying ? 8 : 0) | (p.running && p.walking ? 256 : 0) | (p.sit ? 512 : 0) | (p.sit === 'c' ? 1024 : 0);
      for (const b in BUFF_BITS) if (buffOn(p, b)) fl |= BUFF_BITS[b];
      pl.push([p.id, Math.round(p.x * 100), Math.round(p.y * 100), Math.round(p.z * 100), p.dir | 0, fl, Math.round(p.hp / p.maxHp * 100), p.carrying || 0]);
    }
    for (const m of mons) {
      if (Math.abs(m.x - r.x) > VIEW_RADIUS || Math.abs(m.y - r.y) > VIEW_RADIUS) continue;
      ml.push([m.id, MON_TYPES.indexOf(m.type), Math.round(m.x * 100), Math.round(m.y * 100), m.hp, (m.slowUntil > now ? 1 : 0) | (m.stunUntil > now ? 2 : 0), m.face]);
    }
    Net.toOne(r.id, { t: 's', p: pl, m: ml }, true);
  }
}

function startHostLoop() {
  try {
    const src = 'setInterval(() => postMessage(0), 100);';
    const w = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
    w.onmessage = hostTick;
  } catch (e) { setInterval(hostTick, 100); }
}
