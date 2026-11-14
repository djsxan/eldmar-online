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

// tile livre DENTRO da casa ao lado de um ponto (a cama, a cadeira, o fogão) — o caminho passa pela porta
function interiorSpot(bi, x, y) {
  let best = null, bd = 9;
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const tx = Math.round(x) + dx, ty = Math.round(y) + dy; if (!inBounds(tx, ty) || WORLD.bld[ty * MAP_W + tx] !== bi || !canStandZ(tx, ty, 0, 0.25)) continue; const d = Math.hypot(tx - x, ty - y); if (d < bd) { bd = d; best = [tx, ty]; } }
  return best;
}
function pathVia(a, via, end) { const p = findPath(a[0], a[1], via[0], via[1], 0, 0); return polyOf([a].concat(p || []).concat([via]).concat(end ? [end] : [])); }

// ---------- preparação (na primeira vez que o mundo existe) ----------
function lifeInit() {
  if (LIFE.ok !== null) return LIFE.ok;
  LIFE.ok = false;
  const n = NPCS.find(q => q.id === 'fruit'); if (!n || !WORLD.seats) return false;
  const sx = n.stall[0], sy = n.stall[1], free = (x, y) => canStandZ(x, y, 0, 0.25) && !BLOCKING.has(WORLD.obj[Math.round(y) * MAP_W + Math.round(x)]);
  const pickSpot = list => list.map(([dx, dy]) => [sx + dx, sy + dy]).find(([x, y]) => free(x, y)) || [sx, sy + 1];
  LIFE.stand = pickSpot([[0, -1], [0, 1], [-1, 0], [1, 0]]);
  const back = LIFE.stand[1] < sy ? -1 : 1;
  LIFE.stool = FRUIT_STOOL.x >= 0 ? [FRUIT_STOOL.x, FRUIT_STOOL.y] : pickSpot([[1, back], [-1, back]]);   // o banquinho de verdade, ao lado da barraca
  LIFE.arr = [pickSpot([[-0.8, back * 0.8], [-1, 0]]), pickSpot([[0.8, back * 0.8], [1, 0]])];
  LIFE.faceStall = dirFromVec(sx - LIFE.stand[0], sy - LIFE.stand[1], 0);
  let home = -1, bd = 1e9;
  BUILDINGS.forEach((b, bi) => { if (b.kind !== 'house' || !BEDS.some(q => q.bi === bi)) return; const d = Math.hypot(b.x + b.w / 2 - sx, b.y + b.h / 2 - sy); if (d < bd) { bd = d; home = bi; } });
  if (home < 0) return false;
  LIFE.home = home; LIFE.bed = BEDS.find(q => q.bi === home); LIFE.seat = WORLD.seats.find(q => q.bi === home) || null; LIFE.stove = KITCHENS.find(q => q.bi === home) || null;
  const bedIn = interiorSpot(home, LIFE.bed.x, LIFE.bed.y);
  LIFE.pB = bedIn ? pathVia(LIFE.stand, bedIn, [LIFE.bed.x, LIFE.bed.y]) : polyOf([LIFE.stand, [LIFE.bed.x, LIFE.bed.y]]);
  const seatIn = LIFE.seat && interiorSpot(home, LIFE.seat.x, LIFE.seat.y);
  LIFE.pS = seatIn ? pathVia(LIFE.stand, seatIn, [LIFE.seat.x, LIFE.seat.y]) : null;
  LIFE.stoveIn = LIFE.stove ? interiorSpot(home, LIFE.stove.x, LIFE.stove.y) : null;
  LIFE.pK = LIFE.stoveIn ? pathVia(LIFE.stand, LIFE.stoveIn) : (bedIn ? pathVia(LIFE.stand, bedIn) : null);
  // volta da faxina: os cantos livres da casa
  const b = BUILDINGS[home], cells = [];
  for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) if (WORLD.bld[y * MAP_W + x] === home && canStandZ(x, y, 0, 0.25)) cells.push([x, y]);
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2, corner = (sx2, sy2) => cells.slice().sort((p, q) => (Math.hypot(q[0] - cx, q[1] - cy) * 0.3 - ((q[0] - cx) * sx2 + (q[1] - cy) * sy2)) - (Math.hypot(p[0] - cx, p[1] - cy) * 0.3 - ((p[0] - cx) * sx2 + (p[1] - cy) * sy2)))[0];
  const loop = [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)].filter(Boolean);
  LIFE.pSweep = loop.length >= 2 ? polyOf(loop.concat([loop[0]])) : null;
  const kIn = LIFE.stoveIn || bedIn; LIFE.pBedFromK = kIn && bedIn ? polyOf([kIn, bedIn, [LIFE.bed.x, LIFE.bed.y]]) : null;
  LIFE.pStool = polyOf([LIFE.stand, LIFE.stool]); LIFE.pA = polyOf([LIFE.stand, LIFE.arr[0], LIFE.arr[1], LIFE.stand]);
  LIFE.ok = true; return true;
}

// ---------- onde a fruteira está agora ----------
// 6h acorda e vai à feira · 12h almoça em casa · 17h30 volta para casa · cozinha · varre · 21h30 dorme
function sellerState(now) {
  const hh = gameHour(), wall = Date.now();
  const T = P => P ? P.len / SELL_SPEED / HOUR_S : 0;
  const walk = (P, k, rev) => { const q = polyAt(P, k * P.len, rev); return { x: q.x, y: q.y, dir: dirFromVec(q.dx, q.dy, 0), walking: true, wd: k * P.len }; };
  const bedDir = dirFromVec(LIFE.bed.dx, LIFE.bed.dy, 0);
  const WAKE = 6, SLEEP = 21.5, HOME = 17.5, COOK_END = 19.5, SWEEP_END = 21.0;
  const dB = T(LIFE.pB), dS = T(LIFE.pS), dK = T(LIFE.pK), dBK = T(LIFE.pBedFromK);
  const inn = (a, b) => hh >= a && hh < b;
  if (hh >= SLEEP || hh < WAKE) return { x: LIFE.bed.x, y: LIFE.bed.y, dir: bedDir, cust: { down: true }, away: 'Zzz... (ela está dormindo em casa. A feira abre de manhã.)' };
  if (hh < WAKE + dB) return Object.assign(walk(LIFE.pB, (hh - WAKE) / dB, true), { away: 'Já vou, já vou! Deixa eu abrir a barraca.' });
  if (LIFE.pS) {
    if (inn(12 - dS, 12)) return Object.assign(walk(LIFE.pS, (hh - (12 - dS)) / dS, false), { away: 'Hora do almoço! Já volto.' });
    if (inn(12, 13)) return { x: LIFE.seat.x, y: LIFE.seat.y, dir: LIFE.seat.dir, cust: { sit: 'c', eat: ((wall / 3500) % 1) }, away: 'Estou almoçando, querido. Volte daqui a pouco.' };
    if (inn(13, 13 + dS)) return Object.assign(walk(LIFE.pS, (hh - 13) / dS, true), { away: 'Hora do almoço! Já volto.' });
  }
  if (LIFE.pK && hh >= HOME) {
    const closed = 'A feira fechou por hoje. Volte amanhã cedo!';
    if (inn(HOME, HOME + dK)) return Object.assign(walk(LIFE.pK, (hh - HOME) / dK, false), { away: closed });
    const kp = LIFE.pK.pts[LIFE.pK.pts.length - 1];
    if (inn(HOME + dK, COOK_END) && LIFE.stove) return { x: kp[0], y: kp[1], dir: dirFromVec(LIFE.stove.x - kp[0], LIFE.stove.y - kp[1], 0), cust: { act: { k: 'cook', f: Math.floor(((wall / 1200) % 1) * 12) } }, away: 'Estou cozinhando a janta. Cheirinho bom, né?', steam: 1 };
    if (inn(LIFE.stove ? COOK_END : HOME + dK, SWEEP_END) && LIFE.pSweep) { const k = ((hh - COOK_END) * HOUR_S * 0.45 / LIFE.pSweep.len) % 1, q = polyAt(LIFE.pSweep, Math.max(0, k) * LIFE.pSweep.len); return { x: q.x, y: q.y, dir: dirFromVec(q.dx, q.dy, 0), walking: true, slow: 1, wd: k * LIFE.pSweep.len, cust: { sweep: 1, act: { k: 'sweep', f: Math.floor(((wall / 1400) % 1) * 12) } }, away: 'Deixa eu varrer a casa antes de dormir.' }; }
    if (LIFE.pBedFromK && hh >= SWEEP_END) return Object.assign(walk(LIFE.pBedFromK, Math.min(1, (hh - SWEEP_END) / Math.max(0.05, dBK)), false), { away: 'Já vou deitar. Boa noite!' });
    return { x: kp[0], y: kp[1], dir: 0, away: closed };
  }
  if (!LIFE.pK && hh >= SLEEP - dB) return Object.assign(walk(LIFE.pB, (hh - (SLEEP - dB)) / dB, false), { away: 'Por hoje chega! Volte amanhã cedo.' });
  // na barraca: vende, arruma as frutas, senta no banquinho para fumar cachimbo
  const SEG = 24000, act = LIFE.act || ['sell', 'arrange', 'sell', 'smoke'][Math.floor(wall / SEG) % 4], t = (wall % SEG) / 1000;
  const at = (p, dir, cust) => ({ x: p[0], y: p[1], dir, cust });
  if (act === 'arrange') {
    const segs = [[0, 2, 'w', 0, 1 / 3], [2, 8, 'p', 0], [8, 10, 'w', 1 / 3, 2 / 3], [10, 16, 'p', 1], [16, 18, 'w', 2 / 3, 1]];
    for (const [a, b, k, u, v] of segs) if (t >= a && t < b) {
      if (k === 'w') { const kk = u + (v - u) * (t - a) / (b - a); const q = polyAt(LIFE.pA, kk * LIFE.pA.len); return { x: q.x, y: q.y, dir: dirFromVec(q.dx, q.dy, 0), walking: true, wd: kk * LIFE.pA.len }; }
      const p = LIFE.arr[u], st = NPCS.find(q => q.id === 'fruit').stall; return at(p, dirFromVec(st[0] - p[0], st[1] - p[1], 0), { idle: { k: 'polish', f: Math.floor(((wall / 3000) % 1) * 12) } });
    }
  }
  if (act === 'smoke') {
    if (t < 1.5) { const q = polyAt(LIFE.pStool, t / 1.5 * LIFE.pStool.len); return { x: q.x, y: q.y, dir: dirFromVec(q.dx, q.dy, 0), walking: true, wd: t }; }
    if (t < 22) return at(LIFE.stool, LIFE.faceStall, { sit: 'c', smk: (wall / 4200) % 1 });
    { const q = polyAt(LIFE.pStool, (t - 22) / 2 * LIFE.pStool.len, true); return { x: q.x, y: q.y, dir: dirFromVec(q.dx, q.dy, 0), walking: true, wd: t }; }
  }
  return at(LIFE.stand, LIFE.faceStall, null);
}
function updateLife(now) {
  if (!lifeInit()) return;
  const e = G.npcs.fruit; if (!e) return;
  if (e.npDown || e.npDead || e.dragged || e.onBackBy) { e._off = true; e._lt = now; return; }
  const s = sellerState(now), dt = Math.min(0.1, (now - (e._lt || now)) / 1000); e._lt = now;
  if (e._off) { e._off = false; let path = null; try { path = findPath(e.rx, e.ry, s.x, s.y, 0, 0); } catch (er) { } e.back = { path: path || [], t: now }; }
  if (e.back) {
    const s2 = sellerState(now), tg = e.back.path.length ? e.back.path[0] : [s2.x, s2.y], dx = tg[0] - e.rx, dy = tg[1] - e.ry, d = Math.hypot(dx, dy);
    if (d < 0.15 && e.back.path.length) e.back.path.shift();
    else if (d > 0.01) { const st = Math.min(d, 1.5 * dt); e.rx += dx / d * st; e.ry += dy / d * st; e.x = e.rx; e.y = e.ry; e.dir = dirFromVec(dx, dy, e.dir); e.walking = true; e.walkDist = (e.walkDist || 0) + st; e.custP = null; e.sleepB = null; }
    if ((!e.back.path.length && Math.hypot(s2.x - e.rx, s2.y - e.ry) < 0.3) || now - e.back.t > 40000) e.back = null; else { LIFE.atStall = false; LIFE.busyText = 'Ai, que susto... já volto para o meu lugar.'; return; }
  }
  e.x = e.rx = s.x; e.y = e.ry = s.y; if (!(e.lookUntil > now)) e.dir = s.dir;
  if (!s.walking && !(s.cust && (s.cust.down || s.cust.act))) { let q = null, bd = 6; for (const id in G.players) { const p = G.players[id]; if (!p.visible) continue; const d = dist(p.rx, p.ry, e.rx, e.ry); if (d < bd) { bd = d; q = p; } } if (q) e.dir = dirFromVec(q.rx - e.rx, q.ry - e.ry, e.dir); }
  e.walking = !!s.walking; if (s.walking) e.walkDist = s.wd || 0;
  e.custP = s.cust || null; e.sleepB = s.cust && s.cust.down ? 1 : null;
  LIFE.atStall = !s.away; LIFE.busyText = s.away || '';
  if (s.cust && s.cust.smk != null) { const ph = s.cust.smk; if (ph > 0.42 && ph < 0.5 && Math.random() < 0.5) { const p = iso(e.rx, e.ry); spawnPart('smoke', p.sx + 3, p.sy - 34); } }
  if (s.steam && Math.random() < 0.06 && LIFE.stove) { const p = iso(LIFE.stove.x, LIFE.stove.y); spawnPart('smoke', p.sx, p.sy - 30); }
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
