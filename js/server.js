// ============================================================
//  SERVIDOR — só roda no navegador de quem criou a sala (host).
//  Ele decide tudo que importa: dano, vida, monstros, ouro e xp.
// ============================================================
const S = { players: {}, monsters: {}, nextMid: 1, nextSpawn: 0, lastRegen: 0, filled: false };
const MAX_MON = 150;

const RUMORS = [
  'Dizem que no Bosque Sombrio, ao norte, os lobos caçam em bando. Vá preparado.',
  'O Pântano Pútrido, a leste, é cheio de sapos enormes. Cuidado com a língua deles!',
  'Ao sul ficam as Colinas de Ossos. Os mortos não descansam por lá...',
  'Os orcs montaram acampamento a oeste. Goblins e orcs guardam o lugar.',
  'Nas Terras Selvagens, perto do mar, vivem os Trolls da Montanha. Só vá em grupo!',
  'Um Cavaleiro na frente, um Atirador atrás e um Mago curando: esse é o segredo.',
  'Fora de combate, sua vida e mana voltam sozinhas. Descanse antes da próxima luta.',
];

const now_ = () => Date.now();
function buffOn(p, b) { return (p.buffs[b] || 0) > now_(); }
function pub(p) {
  const now = now_();
  return {
    id: p.id, name: p.name, color: p.color, cls: p.cls, x: p.x, y: p.y,
    hp: p.hp, maxHp: p.maxHp, mp: p.mp, maxMp: p.maxMp, lvl: p.lvl, xp: p.xp, gold: p.gold,
    pots: { hp: p.pots.hp, mp: p.pots.mp },
    buffs: Object.entries(p.buffs).filter(([, u]) => u > now).map(([k, u]) => [k, u - now]),
    cds: [0, 1, 2, 3].map(i => Math.max(0, (p.cds[i] || 0) - now)),
    combat: now - p.lastCombat < OUT_OF_COMBAT_MS,
  };
}
function monList() {
  const now = now_();
  return Object.values(S.monsters).map(m => [m.id, m.type, m.x, m.y, m.hp, (m.slowUntil > now ? 1 : 0) | (m.stunUntil > now ? 2 : 0)]);
}
function sendStat(p) { Net.toAll({ t: 'pstat', ...pub(p) }); }
function sfx(x, y, text, color, d = 0, big = false) { Net.toAll({ t: 'fx', x, y, text: String(text), color, d, big }); }
function sys(text) { Net.toAll({ t: 'chat', name: '', text }); }
function tell(p, text) { Net.toOne(p.id, { t: 'err', text }); }
function anim(w, id, a, tx, ty, extra) { Net.toAll({ t: 'anim', w, id, a, tx, ty, ...extra }); }
function aoe(a, x, y, extra) { Net.toAll({ t: 'aoe', a, x, y, ...extra }); }

function townSpot() {
  for (let i = 0; i < 80; i++) {
    const x = TEMPLE_SPAWN.x + rint(-2, 2), y = TEMPLE_SPAWN.y + rint(-1, 2);
    if (walkable(x, y)) return { x, y };
  }
  return { x: CENTER + 2, y: CENTER + 2 };
}

function occupied(x, y, self) {
  for (const id in S.monsters) { const m = S.monsters[id]; if (m !== self && m.x === x && m.y === y) return true; }
  for (const id in S.players) { const p = S.players[id]; if (p.x === x && p.y === y) return true; }
  return false;
}
function monCanStand(x, y, m) {
  if (!walkable(x, y) || inSafe(x, y) || occupied(x, y, m)) return false;
  return true;
}

function spawnMonster() {
  const x = rint(2, MAP_W - 3), y = rint(2, MAP_H - 3);
  const z = zoneAt(x, y);
  if (z === Z.VILLAGE || !REACH[y * MAP_W + x] || !monCanStand(x, y, null)) return false;
  for (const id in S.players) if (cheb(x, y, S.players[id].x, S.players[id].y) < 10) return false;
  const type = pick(ZONES[z].mons);
  const id = S.nextMid++;
  S.monsters[id] = { id, type, zone: z, x, y, homeX: x, homeY: y, hp: MON[type].hp, nextMove: 0, nextAtk: 0, stunUntil: 0, slowUntil: 0, taunt: null, aggro: null, returning: false };
  return true;
}

// ---------------- mensagens dos jogadores ----------------
function hostOnClient(from, m) {
  const p = S.players[from];
  if (m.t === 'hello') {
    if (p) return;
    const cls = CLASSES[m.cls] ? m.cls : 'knight';
    const lvl = Math.max(1, Math.min(300, m.lvl | 0 || 1));
    const s = townSpot();
    const np = {
      id: from, name: String(m.name || 'Aventureiro').slice(0, 16), cls,
      color: /^#[0-9a-f]{6}$/i.test(m.color) ? m.color : '#2563eb',
      x: s.x, y: s.y, lvl, xp: Math.max(0, Math.min(need(lvl) - 1, m.xp | 0)),
      gold: Math.max(0, Math.min(1e7, m.gold | 0)),
      pots: { hp: Math.max(0, Math.min(999, (m.pots && m.pots.hp) | 0)), mp: Math.max(0, Math.min(999, (m.pots && m.pots.mp) | 0)) },
      maxHp: maxHpFor(cls, lvl), maxMp: maxMpFor(cls, lvl), hp: 0, mp: 0,
      target: null, nextAtk: 0, cds: {}, buffs: {}, casting: null, lastCombat: 0, potCd: 0,
    };
    np.hp = np.maxHp; np.mp = np.maxMp;
    if (!m.lvl || m.lvl <= 1 && !m.gold) { np.gold = 30; np.pots.hp = 3; np.pots.mp = 2; } // kit inicial
    S.players[from] = np;
    Net.toOne(from, { t: 'welcome', you: from, players: Object.values(S.players).map(pub), monsters: monList() });
    Net.toOthers({ t: 'pjoin', p: pub(np) }, from);
    sys(`${np.name}, o ${CLASSES[cls].name}, chegou ao vilarejo.`);
    return;
  }
  if (!p) return;
  switch (m.t) {
    case 'move':
      if (Number.isInteger(m.x) && Number.isInteger(m.y) && walkable(m.x, m.y) && cheb(p.x, p.y, m.x, m.y) <= 1 && !occupiedByMonster(m.x, m.y)) {
        p.x = m.x; p.y = m.y;
        if (p.casting) { p.casting = null; Net.toAll({ t: 'castend', id: p.id }); }
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
    case 'skill': useSkill(p, m.i | 0); break;
    case 'pot': usePot(p, m.k); break;
    case 'npc': npcAction(p, m); break;
  }
}
function occupiedByMonster(x, y) {
  for (const id in S.monsters) { const m = S.monsters[id]; if (m.x === x && m.y === y) return true; }
  return false;
}

function hostOnLeave(id) {
  const p = S.players[id];
  if (!p) return;
  delete S.players[id];
  Net.toAll({ t: 'pleave', id });
  sys(`${p.name} deixou o vilarejo.`);
}

// ---------------- combate ----------------
function roll(p, mult = 1) {
  const c = CLASSES[p.cls], l = p.lvl;
  let dmg = rint(Math.floor(c.dmg[0][0] + c.dmg[0][1] * l), Math.floor(c.dmg[1][0] + c.dmg[1][1] * l)) * mult;
  if (buffOn(p, 'mead')) dmg *= 1.1;
  const crit = Math.random() < c.crit + (buffOn(p, 'agile') ? 0.1 : 0);
  if (crit) dmg *= 1.8;
  return { dmg: Math.max(1, Math.round(dmg)), crit };
}

function hitMonster(p, m, mult, delay = 0) {
  if (!S.monsters[m.id]) return;
  const { dmg, crit } = roll(p, mult);
  m.hp -= dmg;
  m.aggro = p.id;
  p.lastCombat = now_();
  Net.toAll({ t: 'hit', k: 'm', id: m.id, x: m.x, y: m.y, dmg, crit, d: delay });
  if (m.hp <= 0) killMonster(m, p, delay);
}

function killMonster(m, p, delay) {
  delete S.monsters[m.id];
  Net.toAll({ t: 'mdie', id: m.id, d: delay });
  for (const id in S.players) if (S.players[id].target === m.id) S.players[id].target = null;
  const def = MON[m.type];
  const gold = rint(def.gold[0], def.gold[1]);
  p.gold += gold;
  sfx(m.x, m.y, `+${gold} ouro`, '#fcd34d', delay + 250);
  // xp dividida entre quem está perto (grupo ganha bônus)
  const near = Object.values(S.players).filter(q => cheb(q.x, q.y, m.x, m.y) <= 9);
  const share = Math.ceil(def.xp * (near.length > 1 ? 0.7 : 1));
  for (const q of near) gainXp(q, share, delay + 400);
  if (!near.includes(p)) sendStat(p);
}

function gainXp(p, amount, delay = 0) {
  p.xp += amount;
  sfx(p.x, p.y, `+${amount} xp`, '#c4b5fd', delay);
  let up = false;
  while (p.xp >= need(p.lvl)) {
    p.xp -= need(p.lvl);
    p.lvl++;
    up = true;
  }
  if (up) {
    p.maxHp = maxHpFor(p.cls, p.lvl); p.maxMp = maxMpFor(p.cls, p.lvl);
    p.hp = p.maxHp; p.mp = p.maxMp;
    aoe('lvlup', p.x, p.y, { id: p.id, d: delay });
    sys(`${p.name} alcançou o nível ${p.lvl}!`);
  }
  sendStat(p);
}

function damagePlayer(p, raw, m, delay = 0) {
  const c = CLASSES[p.cls];
  let mult = 1 - c.armor;
  if (buffOn(p, 'wall')) mult *= 0.4;
  if (buffOn(p, 'warcry')) mult *= 0.8;
  if (buffOn(p, 'bless')) mult *= 0.9;
  const dmg = Math.max(1, Math.round(raw * mult));
  p.hp -= dmg;
  p.lastCombat = now_();
  Net.toAll({ t: 'hit', k: 'p', id: p.id, x: p.x, y: p.y, dmg, d: delay });
  if (p.hp > 0) { sendStat(p); return; }
  sys(`${p.name} caiu em batalha contra ${MON[m.type].name}.`);
  p.xp = Math.floor(p.xp / 2);
  p.hp = p.maxHp; p.mp = p.maxMp;
  p.target = null; p.casting = null; p.lastCombat = 0;
  const s = townSpot();
  p.x = s.x; p.y = s.y;
  Net.toAll({ t: 'pmove', id: p.id, x: p.x, y: p.y, tp: 1 });
  Net.toOne(p.id, { t: 'died' });
  sendStat(p);
}

const flight = (ax, ay, bx, by) => 120 + Math.hypot(ax - bx, ay - by) * 55;

function basicAttack(p, m, now) {
  const c = CLASSES[p.cls];
  p.nextAtk = now + c.atkMs * (buffOn(p, 'agile') ? 0.5 : 1);
  if (p.cls === 'knight') {
    anim('p', p.id, 'swing', m.x, m.y);
    hitMonster(p, m, 1, 180);
  } else if (p.cls === 'archer') {
    const d = flight(p.x, p.y, m.x, m.y) + 200;
    anim('p', p.id, 'shoot', m.x, m.y, { proj: 'arrow', d });
    hitMonster(p, m, 1, d);
  } else {
    const d = flight(p.x, p.y, m.x, m.y) + 150;
    anim('p', p.id, 'thrust', m.x, m.y, { proj: 'bolt', d });
    hitMonster(p, m, 1, d);
  }
}

// ---------------- habilidades ----------------
function useSkill(p, i) {
  const sk = SKILLS[p.cls][i];
  const now = now_();
  if (!sk || p.casting) return;
  if (now < (p.cds[i] || 0)) return;
  if (p.mp < sk.mp) { tell(p, 'Mana insuficiente.'); return; }
  let m = null;
  if (sk.tgt) {
    m = S.monsters[p.target];
    if (!m) { tell(p, 'Selecione um monstro como alvo.'); return; }
    if (cheb(p.x, p.y, m.x, m.y) > sk.range) { tell(p, 'Alvo fora de alcance.'); return; }
  }
  const offensive = sk.id !== 'heal' && sk.id !== 'wall' && sk.id !== 'agile';
  if (offensive && inSafe(p.x, p.y)) { tell(p, 'Não é permitido lutar dentro do vilarejo.'); return; }
  p.mp -= sk.mp;
  p.cds[i] = now + sk.cd;
  if (sk.cast) {
    p.casting = { i, until: now + sk.cast, tid: m && m.id };
    Net.toAll({ t: 'cast', id: p.id, ms: sk.cast, s: sk.name, el: sk.el });
  } else execSkill(p, i, m);
  sendStat(p);
}

function monstersNear(x, y, r) { return Object.values(S.monsters).filter(m => cheb(m.x, m.y, x, y) <= r); }

function execSkill(p, i, m) {
  const sk = SKILLS[p.cls][i];
  const now = now_();
  if (sk.tgt && (!m || !S.monsters[m.id])) return; // alvo morreu durante a conjuração
  const tx = m ? m.x : p.x, ty = m ? m.y : p.y;
  const shout = { s: sk.name + '!' };
  switch (sk.id) {
    case 'bash':
      anim('p', p.id, 'bash', tx, ty, shout);
      hitMonster(p, m, 2.2, 220);
      m.stunUntil = now + 1400;
      break;
    case 'warcry':
      anim('p', p.id, 'shout', tx, ty, shout);
      aoe('warcry', p.x, p.y);
      p.buffs.warcry = now + 6000;
      for (const q of monstersNear(p.x, p.y, 5)) { q.taunt = { pid: p.id, until: now + 6000 }; q.returning = false; }
      p.lastCombat = now;
      break;
    case 'whirl':
      anim('p', p.id, 'spin', tx, ty, shout);
      aoe('whirl', p.x, p.y, { id: p.id });
      for (const q of monstersNear(p.x, p.y, 1)) hitMonster(p, q, 1.6, 250);
      break;
    case 'wall':
      anim('p', p.id, 'block', tx, ty, shout);
      aoe('wall', p.x, p.y, { id: p.id });
      p.buffs.wall = now + 6000;
      break;
    case 'double': {
      const d = flight(p.x, p.y, m.x, m.y) + 180;
      anim('p', p.id, 'shoot', tx, ty, { ...shout, proj: 'arrow', d, n: 2 });
      hitMonster(p, m, 1, d);
      hitMonster(p, m, 1, d + 160);
      break;
    }
    case 'pierce': {
      // linha reta do jogador na direção do alvo, até 8 tiles
      const dx = m.x - p.x, dy = m.y - p.y, steps = Math.max(Math.abs(dx), Math.abs(dy)) || 1;
      const ex = p.x + Math.round(dx / steps * 8), ey = p.y + Math.round(dy / steps * 8);
      anim('p', p.id, 'shoot', tx, ty, shout);
      aoe('pierce', p.x, p.y, { x2: ex, y2: ey });
      const hitSet = new Set();
      for (let k = 1; k <= 8; k++) {
        const lx = p.x + Math.round(dx / steps * k), ly = p.y + Math.round(dy / steps * k);
        for (const q of Object.values(S.monsters)) if (q.x === lx && q.y === ly && !hitSet.has(q.id)) { hitSet.add(q.id); hitMonster(p, q, 1.8, 150 + k * 40); }
      }
      break;
    }
    case 'rain':
      anim('p', p.id, 'shootup', tx, ty, shout);
      aoe('rain', tx, ty);
      for (const q of monstersNear(tx, ty, 1)) hitMonster(p, q, 1.3, 650);
      break;
    case 'agile':
      anim('p', p.id, 'shout', tx, ty, shout);
      aoe('agile', p.x, p.y, { id: p.id });
      p.buffs.agile = now + 6000;
      break;
    case 'fireball': {
      const d = flight(p.x, p.y, m.x, m.y) + 100;
      anim('p', p.id, 'thrust', tx, ty, { ...shout, proj: 'fire', d });
      hitMonster(p, m, 2.6, d);
      aoe('boom', tx, ty, { d });
      break;
    }
    case 'nova':
      anim('p', p.id, 'cast', tx, ty, shout);
      aoe('nova', p.x, p.y);
      for (const q of monstersNear(p.x, p.y, 2)) { q.slowUntil = now + 4000; hitMonster(p, q, 1.4, 200); }
      break;
    case 'heal':
      anim('p', p.id, 'cast', tx, ty, shout);
      for (const q of Object.values(S.players)) {
        if (cheb(q.x, q.y, p.x, p.y) > 4) continue;
        const h = Math.min(q.maxHp - q.hp, Math.round(20 + p.lvl * 5 + q.maxHp * 0.15));
        q.hp += h;
        aoe('heal', q.x, q.y, { id: q.id });
        sfx(q.x, q.y, `+${h}`, '#4ade80', 150);
        sendStat(q);
      }
      break;
    case 'meteor':
      anim('p', p.id, 'cast', tx, ty, shout);
      aoe('meteor', tx, ty);
      for (const q of monstersNear(tx, ty, 2)) hitMonster(p, q, 3.2, 750);
      break;
  }
}

function usePot(p, k) {
  const now = now_();
  if (!ITEMS[k] || p.pots[k] <= 0 || now < p.potCd) return;
  p.potCd = now + 1000;
  p.pots[k]--;
  if (k === 'hp') {
    const h = Math.min(p.maxHp - p.hp, Math.ceil(p.maxHp * 0.35));
    p.hp += h; sfx(p.x, p.y, `+${h}`, '#4ade80');
  } else {
    const h = Math.min(p.maxMp - p.mp, Math.ceil(p.maxMp * 0.4));
    p.mp += h; sfx(p.x, p.y, `+${h}`, '#60a5fa');
  }
  aoe('potion', p.x, p.y, { id: p.id, k });
  sendStat(p);
}

// ---------------- NPCs ----------------
function npcAction(p, m) {
  const n = NPCS.find(q => q.id === m.n);
  if (!n || cheb(p.x, p.y, n.x, n.y) > 3) { tell(p, 'Chegue mais perto para conversar.'); return; }
  const say = text => Net.toOne(p.id, { t: 'npc', n: n.id, text });
  const pay = cost => { if (p.gold < cost) { say('Você não tem ouro suficiente, aventureiro.'); return false; } p.gold -= cost; return true; };
  const now = now_();
  if (n.id === 'merchant' && m.a === 'buy' && ITEMS[m.item]) {
    const qty = m.qty === 5 ? 5 : 1;
    if (!pay(ITEMS[m.item].price * qty)) return;
    p.pots[m.item] += qty;
    say(`Aqui está: ${qty}x ${ITEMS[m.item].name}. Volte sempre!`);
  } else if (n.id === 'priest' && m.a === 'bless') {
    p.hp = p.maxHp; p.mp = p.maxMp; p.buffs.bless = now + 180000;
    aoe('heal', p.x, p.y, { id: p.id });
    say('Que a luz da Aurora te proteja. Suas feridas estão curadas e você recebe 10% de proteção por 3 minutos.');
  } else if (n.id === 'innkeeper' && m.a === 'mead') {
    if (!pay(15)) return;
    p.buffs.mead = now + 180000;
    say('Um caneco de hidromel bem gelado! +10% de dano e regeneração 50% maior por 3 minutos.');
  } else if (n.id === 'innkeeper' && m.a === 'stew') {
    if (!pay(10)) return;
    p.hp = p.maxHp; p.mp = p.maxMp;
    say('Ensopado de javali, receita da casa. Vida e mana restauradas!');
  } else if (n.id === 'innkeeper' && m.a === 'rumor') {
    say(pick(RUMORS));
  }
  sendStat(p);
}

// ---------------- monstros ----------------
function stepToward(m, tx, ty) {
  const cur = cheb(m.x, m.y, tx, ty);
  let best = null, bestScore = Infinity;
  for (const [dx, dy] of DIRS8) {
    const nx = m.x + dx, ny = m.y + dy;
    if (!monCanStand(nx, ny, m)) continue;
    const d = cheb(nx, ny, tx, ty);
    if (d > cur) continue;
    const score = d * 10 + Math.hypot(nx - tx, ny - ty) + Math.random() * 0.6;
    if (score < bestScore) { bestScore = score; best = [nx, ny]; }
  }
  if (best) { m.x = best[0]; m.y = best[1]; return true; }
  return false;
}

function monsterThink(m, players, now) {
  const d = MON[m.type];
  if (now < m.stunUntil) return;
  const speed = d.speed * (now < m.slowUntil ? 2 : 1);
  const homeDist = cheb(m.x, m.y, m.homeX, m.homeY);

  if (m.returning) {
    if (homeDist <= 2) { m.returning = false; m.aggro = null; }
    else if (now >= m.nextMove) { stepToward(m, m.homeX, m.homeY); m.nextMove = now + speed * 0.8; }
    return;
  }
  // escolher alvo: provocação > quem bateu nele > mais próximo
  let tgt = null;
  if (m.taunt && m.taunt.until > now) tgt = S.players[m.taunt.pid];
  if (!tgt && m.aggro && S.players[m.aggro] && cheb(m.x, m.y, S.players[m.aggro].x, S.players[m.aggro].y) <= 10) tgt = S.players[m.aggro];
  if (!tgt) {
    let best = 99;
    for (const p of players) {
      const dist = cheb(m.x, m.y, p.x, p.y);
      if (dist <= d.aggro && dist < best && !inSafe(p.x, p.y)) { best = dist; tgt = p; }
    }
  }
  if (tgt && inSafe(tgt.x, tgt.y)) tgt = null;

  if (tgt) {
    if (homeDist > 12) { m.returning = true; m.aggro = null; m.taunt = null; return; }
    const dist = cheb(m.x, m.y, tgt.x, tgt.y);
    if (dist <= 1) {
      if (now >= m.nextAtk) {
        m.nextAtk = now + d.atk;
        anim('m', m.id, 'bite', tgt.x, tgt.y);
        damagePlayer(tgt, rint(d.dmg[0], d.dmg[1]), m, 200);
      }
    } else if (now >= m.nextMove) {
      stepToward(m, tgt.x, tgt.y);
      m.nextMove = now + speed;
      m.nextAtk = Math.max(m.nextAtk, now + 350);
    }
  } else if (now >= m.nextMove) {
    m.nextMove = now + speed * (2 + Math.random() * 4);
    if (homeDist > 6) { stepToward(m, m.homeX, m.homeY); return; }
    const [dx, dy] = pick(DIRS8);
    const nx = m.x + dx, ny = m.y + dy;
    if (monCanStand(nx, ny, m) && zoneAt(nx, ny) === m.zone && cheb(nx, ny, m.homeX, m.homeY) <= 6) { m.x = nx; m.y = ny; }
  }
}

// ---------------- laço principal (10x por segundo) ----------------
function hostTick() {
  const now = now_();
  const players = Object.values(S.players);

  if (!S.filled) {
    for (let i = 0; i < 6000 && Object.keys(S.monsters).length < MAX_MON; i++) spawnMonster();
    S.filled = true;
  } else if (now >= S.nextSpawn && Object.keys(S.monsters).length < MAX_MON) {
    for (let i = 0; i < 40; i++) if (spawnMonster()) break;
    S.nextSpawn = now + 1500;
  }

  for (const p of players) {
    // conjuração terminou?
    if (p.casting && now >= p.casting.until) {
      const c = p.casting; p.casting = null;
      execSkill(p, c.i, S.monsters[c.tid]);
    }
    // ataque básico automático (somente se o alvo estiver no alcance — sem perseguir)
    if (!p.target) continue;
    const m = S.monsters[p.target];
    if (!m) { p.target = null; continue; }
    if (!p.casting && now >= p.nextAtk && !inSafe(p.x, p.y) && cheb(p.x, p.y, m.x, m.y) <= CLASSES[p.cls].range) basicAttack(p, m, now);
  }

  for (const m of Object.values(S.monsters)) monsterThink(m, players, now);

  // regeneração fora de combate
  if (now - S.lastRegen >= 1000) {
    S.lastRegen = now;
    for (const p of players) {
      if (now - p.lastCombat < OUT_OF_COMBAT_MS) continue;
      if (p.hp >= p.maxHp && p.mp >= p.maxMp) continue;
      let hr = Math.ceil(p.maxHp * 0.04) + 1, mr = Math.ceil(p.maxMp * 0.05) + 1;
      if (p.cls === 'mage') mr *= 2;
      if (buffOn(p, 'mead')) { hr = Math.ceil(hr * 1.5); mr = Math.ceil(mr * 1.5); }
      if (inSafe(p.x, p.y)) { hr *= 2; mr *= 2; }
      p.hp = Math.min(p.maxHp, p.hp + hr);
      p.mp = Math.min(p.maxMp, p.mp + mr);
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
