// ============================================================
//  VIDA NA CIDADE — rotina da fruteira, camas (dormir), lista de reinos online
//  A rotina é calculada pelo relógio do mundo (igual em todos os navegadores),
//  então todo mundo vê a fruteira no mesmo lugar sem precisar de rede.
// ============================================================
const LIFE = { ok: null, atStall: true, busyText: '' };
const SELL_SPEED = 1.35, HOUR_S = DAY_CYCLE_MS / 24 / 1000;
const gameHour = () => LIFE.hour ?? (dayInfo().phase * 24 + 12) % 24;   // LIFE.hour: só para testes

// ---------- caminhos (linhas com comprimento) ----------
function polyOf(pts) { let len = 0; const L = [0]; for (let i = 1; i < pts.length; i++) { len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); L.push(len); } return { pts, L, len: Math.max(0.01, len) }; }
function polyAt(P, d, rev) {
  if (rev) d = P.len - d; d = clamp(d, 0, P.len);
  let i = 1; while (i < P.pts.length - 1 && P.L[i] < d) i++;
  const a = P.pts[i - 1], b = P.pts[i], seg = (P.L[i] - P.L[i - 1]) || 1, k = clamp((d - P.L[i - 1]) / seg, 0, 1);
  let dx = b[0] - a[0], dy = b[1] - a[1]; if (rev) { dx = -dx; dy = -dy; }
  return { x: a[0] + (b[0] - a[0]) * k, y: a[1] + (b[1] - a[1]) * k, dx, dy };
}
function pathBetween(a, b) { const p = findPath(a[0], a[1], b[0], b[1], 0, 1); return polyOf([a].concat(p || []).concat([b])); }

// ---------- preparação (na primeira vez que o mundo existe) ----------
function lifeInit() {
  if (LIFE.ok !== null) return LIFE.ok;
  LIFE.ok = false;
  const n = NPCS.find(q => q.id === 'fruit'); if (!n || !WORLD.seats) return false;
  const sx = n.stall[0], sy = n.stall[1], free = (x, y) => canStandZ(x, y, 0, 0.25) && !BLOCKING.has(WORLD.obj[Math.round(y) * MAP_W + Math.round(x)]);
  // atrás da barraca (lado do castelo), um banquinho ao lado e dois pontos para arrumar as frutas
  const pickSpot = list => list.map(([dx, dy]) => [sx + dx, sy + dy]).find(([x, y]) => free(x, y)) || [sx, sy + 1];
  LIFE.stand = pickSpot([[0, -1], [0, 1], [-1, 0], [1, 0]]);
  const back = LIFE.stand[1] < sy ? -1 : 1;
  LIFE.stool = pickSpot([[1, back], [-1, back], [1.2, back * 0.4], [-1.2, back * 0.4]]);
  LIFE.arr = [pickSpot([[-0.8, back * 0.8], [-1, 0]]), pickSpot([[0.8, back * 0.8], [1, 0]])];
  LIFE.faceStall = dirFromVec(sx - LIFE.stand[0], sy - LIFE.stand[1], 0);
  // casa ao lado: a casa mais perto da barraca, com cama e cadeira
  let home = -1, bd = 1e9;
  BUILDINGS.forEach((b, bi) => { if (b.kind !== 'house' || !BEDS.some(q => q.bi === bi)) return; const d = Math.hypot(b.x + b.w / 2 - sx, b.y + b.h / 2 - sy); if (d < bd) { bd = d; home = bi; } });
  if (home < 0) return false;
  LIFE.home = home; LIFE.bed = BEDS.find(q => q.bi === home); LIFE.seat = WORLD.seats.find(q => q.bi === home) || null;
  LIFE.pB = pathBetween(LIFE.stand, [LIFE.bed.x, LIFE.bed.y]);
  LIFE.pS = LIFE.seat ? pathBetween(LIFE.stand, [LIFE.seat.x, LIFE.seat.y]) : null;
  LIFE.pStool = polyOf([LIFE.stand, LIFE.stool]); LIFE.pA = polyOf([LIFE.stand, LIFE.arr[0], LIFE.arr[1], LIFE.stand]);
  LIFE.ok = true; return true;
}

// ---------- onde a fruteira está agora ----------
function sellerState(now) {
  const hh = gameHour(), wall = Date.now();
  const dB = LIFE.pB.len / SELL_SPEED / HOUR_S, dS = LIFE.pS ? LIFE.pS.len / SELL_SPEED / HOUR_S : 0;
  const walk = (P, k, rev) => { const q = polyAt(P, k * P.len, rev); return { x: q.x, y: q.y, dir: dirFromVec(q.dx, q.dy, 0), walking: true, wd: k * P.len }; };
  const bedDir = dirFromVec(LIFE.bed.dx, LIFE.bed.dy, 0);
  const SLEEP = 21.5, WAKE = 6;
  if (hh >= SLEEP || hh < WAKE) return { x: LIFE.bed.x, y: LIFE.bed.y, dir: bedDir, cust: { down: true }, away: 'Zzz... (ela está dormindo em casa. A feira abre de manhã.)' };
  if (hh < WAKE + dB) return Object.assign(walk(LIFE.pB, (hh - WAKE) / dB, true), { away: 'Já vou, já vou! Deixa eu abrir a barraca.' });
  if (hh >= SLEEP - dB) return Object.assign(walk(LIFE.pB, (hh - (SLEEP - dB)) / dB, false), { away: 'Por hoje chega! Volte amanhã cedo.' });
  if (LIFE.pS) {
    if (hh >= 12 - dS && hh < 12) return Object.assign(walk(LIFE.pS, (hh - (12 - dS)) / dS, false), { away: 'Hora do almoço! Já volto.' });
    if (hh >= 12 && hh < 13) return { x: LIFE.seat.x, y: LIFE.seat.y, dir: LIFE.seat.dir, cust: { sit: 'c', eat: ((wall / 3500) % 1) }, away: 'Estou almoçando, querido. Volte daqui a pouco.' };
    if (hh >= 13 && hh < 13 + dS) return Object.assign(walk(LIFE.pS, (hh - 13) / dS, true), { away: 'Hora do almoço! Já volto.' });
  }
  // na barraca: vende, arruma as frutas, senta no banquinho para fumar cachimbo
  const SEG = 24000, act = LIFE.act || ['sell', 'arrange', 'sell', 'smoke'][Math.floor(wall / SEG) % 4], t = (wall % SEG) / 1000;
  const at = (p, dir, cust) => ({ x: p[0], y: p[1], dir, cust });
  if (act === 'arrange') {
    const segs = [[0, 2, 'w', 0, 1 / 3], [2, 8, 'p', 0], [8, 10, 'w', 1 / 3, 2 / 3], [10, 16, 'p', 1], [16, 18, 'w', 2 / 3, 1]];
    for (const [a, b, k, u, v] of segs) if (t >= a && t < b) {
      if (k === 'w') { const kk = u + (v - u) * (t - a) / (b - a); const q = polyAt(LIFE.pA, kk * LIFE.pA.len); return { x: q.x, y: q.y, dir: dirFromVec(q.dx, q.dy, 0), walking: true, wd: kk * LIFE.pA.len }; }
      const p = LIFE.arr[u]; return at(p, dirFromVec(NPCS.find(q => q.id === 'fruit').stall[0] - p[0], NPCS.find(q => q.id === 'fruit').stall[1] - p[1], 0), { idle: { k: 'polish', f: Math.floor(((wall / 3000) % 1) * 12) } });
    }
  }
  if (act === 'smoke') {
    if (t < 1.5) { const q = polyAt(LIFE.pStool, t / 1.5 * LIFE.pStool.len); return { x: q.x, y: q.y, dir: dirFromVec(q.dx, q.dy, 0), walking: true, wd: t }; }
    if (t < 22) return at(LIFE.stool, LIFE.faceStall, { sit: 'c', smk: (wall / 4200) % 1, stool: 1 });
    { const q = polyAt(LIFE.pStool, (t - 22) / 2 * LIFE.pStool.len, true); return { x: q.x, y: q.y, dir: dirFromVec(q.dx, q.dy, 0), walking: true, wd: t }; }
  }
  return at(LIFE.stand, LIFE.faceStall, null);
}
function updateLife(now) {
  if (!lifeInit()) return;
  const e = G.npcs.fruit; if (!e || e.npDown || e.npDead || e.dragged || e.onBackBy) return;
  const s = sellerState(now);
  e.x = e.rx = s.x; e.y = e.ry = s.y; e.dir = s.dir;
  e.walking = !!s.walking; if (s.walking) e.walkDist = s.wd || 0;
  e.custP = s.cust || null; e.sleepB = s.cust && s.cust.down ? 1 : null;
  LIFE.atStall = !s.away; LIFE.busyText = s.away || '';
  // fumaça do cachimbo depois de cada tragada
  if (s.cust && s.cust.smk != null) { const ph = s.cust.smk; if (ph > 0.42 && ph < 0.5 && Math.random() < 0.5) { const p = iso(e.rx, e.ry); spawnPart('smoke', p.sx + 3, p.sy - 34); } }
}

// ---------- desenhos: banquinho e "Zzz" ----------
function drawStool(ctx, sx, sy) {
  ctx.save(); ctx.fillStyle = '#5a3d22';
  for (const dx of [-5, 0, 5]) ctx.fillRect(sx + dx - 1, sy - 9, 2, 9);
  ctx.fillStyle = '#7a5530'; ctx.beginPath(); ctx.ellipse(sx, sy - 10, 7, 3, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#8f6a40'; ctx.beginPath(); ctx.ellipse(sx, sy - 10.6, 6, 2.2, 0, 0, 7); ctx.fill(); ctx.restore();
}
function drawZzz(ctx, x, y, now) {
  ctx.save(); ctx.font = 'bold 9px serif'; ctx.textAlign = 'center';
  for (let k = 0; k < 3; k++) { const ph = (now / 2400 + k / 3) % 1; ctx.globalAlpha = Math.sin(ph * Math.PI) * 0.85; ctx.fillStyle = '#e8f0ff'; ctx.font = 'bold ' + (7 + ph * 5).toFixed(0) + 'px serif'; ctx.fillText('z', x + 6 + ph * 10 + Math.sin(ph * 6) * 2, y - ph * 22); }
  ctx.restore();
}

// ---------- dormir numa cama (jogadores) ----------
function bedUnderMouse(cx, cy) {
  const w = screenToWorld(cx, cy); let best = -1, bd = 1.1;
  BEDS.forEach((b, k) => { const d = Math.hypot(b.x - w.x, b.y - w.y); if (d < bd) { bd = d; best = k; } });
  return best;
}
function lieDown(k) {
  const me = G.me, b = BEDS[k]; if (!me || !b || me.downed || me.carrying || me.carriedBy) return;
  if (me.sit) standUp();
  me.sleep = { bed: k, ox: me.x, oy: me.y }; me.x = me.rx = b.x; me.y = me.ry = b.y; me.dir = dirFromVec(b.dx, b.dy, 0); me.sleepB = 1;
  G.path = null; G.pathGoal = null; me.walking = false;
  Net.send({ t: 'sleep', on: 1, b: k }); showToast('Você deita para dormir. Mexa-se para levantar.');
}
function getUp() {
  const me = G.me; if (!me || !me.sleep) return;
  const s = me.sleep; me.sleep = null; me.sleepB = null;
  if (s.ox != null) { me.x = me.rx = s.ox; me.y = me.ry = s.oy; }
  Net.send({ t: 'sleep', on: 0 });
}

// ---------- reinos online (lista na tela inicial) ----------
function renderServers(list) {
  const box = document.getElementById('sv-list'); if (!box) return;
  if (!list.length) { box.innerHTML = '<div class="sv-empty">Nenhum reino aberto agora. Crie o seu!</div>'; return; }
  box.innerHTML = '';
  for (const s of list) {
    const row = document.createElement('div'); row.className = 'sv-row';
    const txt = document.createElement('span'); txt.textContent = 'Reino de ' + (s.name || '?') + ' · ' + (s.n || 0) + (s.n === 1 ? ' jogador' : ' jogadores') + (s.ver && s.ver !== VERSION ? ' · ' + s.ver : '');
    const b = document.createElement('button'); b.className = 'btn'; b.textContent = 'Entrar';
    b.onclick = () => { document.getElementById('code').value = s.code; joinRoom(); };
    row.appendChild(txt); row.appendChild(b); box.appendChild(row);
  }
}
function scanServers() {
  const box = document.getElementById('sv-list'); if (!box || LIFE.scanning || (typeof G !== 'undefined' && G.started)) return;
  LIFE.scanning = true; box.innerHTML = '<div class="sv-empty">Procurando reinos...</div>';
  Net.scan(list => { LIFE.scanning = false; renderServers(list); });
}
(function lobbyServers() {
  const go = () => { const b = document.getElementById('btn-scan'); if (b) b.onclick = scanServers; scanServers(); setInterval(() => { if (!G.started && !document.getElementById('lobby').classList.contains('hidden')) scanServers(); }, 30000); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
})();
