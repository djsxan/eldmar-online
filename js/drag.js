// ============================================================
//  PUXAR E CARREGAR — segure F perto de um corpo para abrir o menu radial:
//  Braços (anda de costas puxando), Pé (anda de frente arrastando), Costas (levanta e carrega),
//  Reanimar (aliado caído) ou Agarrar (alguém de pé, pelas costas). F de novo larga.
// ============================================================
const WEIGHT_C = { rat: 0, toad: 0, slime: 0, spider: 0, wisp: 0, wolf: 1, goblin: 1, boar: 1, deer: 2, skeleton: 2, bandit: 2, deserter: 2, orc: 2 };
const RADIAL_MS = 220;
const OPT_LABEL = { revive: 'Reanimar', arms: 'Braços', foot: 'Pé', back: 'Costas', grip: 'Agarrar' };
function grabCandidate() {
  const me = G.me; if (!me) return null;
  let best = null, bd = 1.9;
  for (const id in G.players) { const q = G.players[id]; if (q === me || !q.visible || q.carriedBy || q.isNpc) continue; const d = dist(q.rx, q.ry, me.x, me.y); if (q.downed && d < bd) { bd = d; best = { k: 'p', id, opts: ['revive', 'arms', 'foot', 'back'] }; } }
  if (best) return best;
  for (const id in G.npcs) { const n = G.npcs[id]; if (!(n.npDown || n.npDead) || n.onBackBy || n.dragged) continue; const d = dist(n.rx, n.ry, me.x, me.y); if (d < bd) { bd = d; best = { k: 'n', id, opts: ['arms', 'foot', 'back'] }; } }
  if (best) return best;
  for (const c of G.corpses || []) { if (!c.looted || c.onBack) continue; const w = WEIGHT_C[c.type] ?? 3; if (w >= 3) continue; const d = dist(c.x, c.y, me.x, me.y); if (d < bd) { bd = d; best = { k: 'c', id: c.id, opts: w >= 2 ? ['arms', 'foot', 'back'] : ['arms', 'foot', 'back'] }; } }
  if (best) return best;
  bd = 1.4;
  for (const id in G.npcs) { const n = G.npcs[id]; if (n.npDown || n.npDead || n.onBackBy || n.carrying || n.sleepB) continue; const d = dist(n.rx, n.ry, me.x, me.y); if (d < bd) { bd = d; best = { k: 'n', id, opts: ['grip'], standing: true }; } }
  for (const id in G.monsters) { const q = G.monsters[id]; if (q.dieAt || !q.visible || (WEIGHT_C[q.type] ?? 3) > 2) continue; const d = dist(q.rx, q.ry, me.x, me.y); if (d < bd + (MON[q.type].rad || 0.3)) { bd = d; best = { k: 'm', id: +id, opts: ['grip'], standing: true }; } }
  for (const id in G.players) { const q = G.players[id]; if (q === me || !q.visible || q.downed || q.isNpc || q.carriedBy) continue; const d = dist(q.rx, q.ry, me.x, me.y); if (d < bd) { bd = d; best = { k: 'p', id, opts: ['grip'], standing: true }; } }
  return best;
}
// F apertado: larga o que estiver segurando, ou começa o menu radial
function grabKeyDown() {
  const me = G.me; if (!me || me.downed) return false;
  if (me.dragMode) { Net.send({ t: 'release' }); return true; }
  if (me.carrying) return false;   // o F de entregar ao carrasco / G de largar continuam valendo
  if (typeof tiedNear === 'function') { const t = tiedNear(); if (t) { Net.send({ t: 'untie', id: t.id }); return true; } }
  const c = grabCandidate(); if (!c) return false;
  G.radial = { t0: performance.now(), ...c, sel: 0 }; return true;
}
function grabKeyUp() {
  const R = G.radial; if (!R) return false; G.radial = null;
  const now = performance.now();
  if (now - R.t0 < RADIAL_MS && R.opts.length > 1) {   // toque rápido com várias opções: a primeira de puxar
    Net.send({ t: 'grab', k: R.k, id: R.id, mode: R.opts.includes('arms') ? 'arms' : R.opts[0] }); return true;
  }
  const o = R.opts[R.sel] || R.opts[0];
  if (o === 'revive') { G.reviving = R.id; G.reviveSticky = true; Net.send({ t: 'revive', id: R.id, on: true }); }
  else Net.send({ t: 'grab', k: R.k, id: R.id, mode: o });
  return true;
}
function drawRadial(ctx, now) {
  const R = G.radial; if (!R || now - R.t0 < RADIAL_MS || !G.me) return;
  const me = G.me, p = iso(me.rx, me.ry), cx = p.sx + G.view.ox, cy = p.sy + G.view.oy - 30, n = R.opts.length, rad = 34;
  let ma = null; if (G.mouseW) { const q = iso(G.mouseW.x, G.mouseW.y), dx = q.sx + G.view.ox - cx, dy = q.sy + G.view.oy - cy; if (dx * dx + dy * dy > 64) ma = Math.atan2(dy, dx); }
  if (ma != null) { let best = 0, bd = 9; R.opts.forEach((o, i) => { const a = -Math.PI / 2 + i / n * Math.PI * 2; let d = Math.abs(((ma - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI); if (d < bd) { bd = d; best = i; } }); R.sel = best; }
  ctx.save(); ctx.globalAlpha = 0.92;
  ctx.fillStyle = 'rgba(20,14,8,0.55)'; ctx.beginPath(); ctx.arc(cx, cy, rad + 16, 0, 7); ctx.fill();
  ctx.font = 'bold 7px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  R.opts.forEach((o, i) => {
    const a = -Math.PI / 2 + i / n * Math.PI * 2, x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad, sel = i === R.sel;
    ctx.fillStyle = sel ? 'rgba(232,196,90,0.95)' : 'rgba(60,44,24,0.9)'; ctx.beginPath(); ctx.arc(x, y, 13, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(232,196,90,0.8)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = sel ? '#2a1a0a' : '#f0e2c0'; ctx.fillText(OPT_LABEL[o], x, y);
  });
  ctx.fillStyle = '#f0e2c0'; ctx.font = '6px serif'; ctx.fillText('solte F', cx, cy); ctx.restore();
}
// barra de quem foi agarrado: martelar ESPAÇO
function drawGripBar(ctx, now) {
  const me = G.me; if (!me || !me.gripped) return;
  const p = iso(me.rx, me.ry), x = p.sx + G.view.ox, y = p.sy + G.view.oy - 66, k = Math.min(1, (me.esc || 0) / 100);
  ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x - 22, y - 3, 44, 6); ctx.fillStyle = '#e8c45a'; ctx.fillRect(x - 21, y - 2, 42 * k, 4);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 7px serif'; ctx.textAlign = 'center'; ctx.fillText(Math.floor(now / 250) % 2 ? 'ESPAÇO! ESPAÇO!' : 'Solte-se!', x, y - 7); ctx.restore();
}
// corpo puxado: deitado (de costas pelos braços, de bruços pelo pé), cabeça/pés para o lado de quem puxa
function dragDir(e) {
  let dr = null, bd = 2.2; for (const id in G.players) { const q = G.players[id]; if (q === e || !(q.dragMode === 'arms' || q.dragMode === 'foot')) continue; const d = dist(q.rx, q.ry, e.rx, e.ry); if (d < bd) { bd = d; dr = q; } }
  if (dr) { const a = Math.atan2(dr.ry - e.ry, dr.rx - e.rx); e._dA = a; }   // de costas: pés para longe de quem puxa; de bruços: cabeça para longe (pés com quem puxa)
  else if (e._dpx != null) { const mx = e.rx - e._dpx, my = e.ry - e._dpy; if (mx * mx + my * my > 0.0002) e._dA = Math.atan2(my, mx); }
  e._dpx = e.rx; e._dpy = e.ry;
  const a = e._dA ?? 0; return dirFromVec(-Math.cos(a), -Math.sin(a), e.dir || 0);
}
function drawDragged(ctx, e, sx, sy, now) {
  const P = { dir: dragDir(e), walk: -1, down: true, prone: !!e.prone, lost: e.lost || 0, pro: e.pro || 0 };
  const s = heroSprite3D(e.cls, e.skin, e.color, P); ctx.imageSmoothingEnabled = true; pblit(ctx, woundOf(s, 3), sx, sy);
  if (Math.random() < 0.08) { const w = tileW(e.rx, e.ry, 0); spawnPart('dust', w.x, w.y); }
}
// cadáver nas costas de quem carrega
function drawBackCorpse(ctx, e, sx, sy, now) {
  const c = (G.corpses || []).find(q => q.onBack === e.id); if (!c) return;
  const f = FALLS['m' + c.id]; if (f) drawFall(ctx, f, sx, sy - 44, now, 1, 0);
}

// ============================================================
//  CORPO REBOCADO — ragdoll de verdade preso à mão de quem puxa (braços/pé) ou dobrado
//  sobre o ombro de quem carrega (como um saco). Braços, pernas e cabeça balançam e arrastam.
// ============================================================
const TOWS = {};
const TOW_K = () => 32 / U;
function towRig(f) {
  if (f.npc) { if (!_rigs.get('npc:' + f.npc)) { R3.budget = Math.max(R3.budget, 1); npcSprite3D(f.npc, { dir: 0, walk: -1 }); } return _rigs.get('npc:' + f.npc); }
  return rigOf(f);
}
function towStart(key, look, wx, wy, dir) {
  const f = { key, ...look, dir: dir || 0, ix: 0, iy: 0, force: 0.1, t0: performance.now(), ox: 0, oy: 0, mode: 'rag' };
  const R = towRig(f); if (!R) return null;
  ragStart(f, R); f.hgt = Math.max(1.2, f.rag.pts.hed.y);
  for (let k = 0; k < 300 && !ragStep(f); k++);   // deita no chão antes de começar
  const P = f.rag.pts, k = TOW_K(), mx = P.pel.x - f.rag.pel0.x, mz = P.pel.z - f.rag.pel0.z;
  f.wx = wx - (mx + mz) / (2 * k); f.wy = wy - (mz - mx) / (2 * k);   // a pelve começa onde está o corpo
  return f;
}
function towModel(f, wx, wy) { const k = TOW_K(), dx = wx - f.wx, dy = wy - f.wy; return [f.rag.pel0.x + (dx - dy) * k, f.rag.pel0.z + (dx + dy) * k]; }
function towWorldOf(f, name) { const k = TOW_K(), p = f.rag.pts[name], mx = p.x - f.rag.pel0.x, mz = p.z - f.rag.pel0.z; return [f.wx + (mx + mz) / (2 * k), f.wy + (mz - mx) / (2 * k)]; }
// um passo de física com pontos presos (pins: [nome, x, y, z] no espaço do modelo)
function towStepOnce(f, pins, bias) {
  const { pts, prev, len } = f.rag;
  for (const k in pts) { const p = pts[k], q = prev[k], vx = (p.x - q.x) * 0.97, vy = (p.y - q.y) * 0.97, vz = (p.z - q.z) * 0.97; q.copy(p); p.x += vx; p.y += vy - 9.8 * RAG_DT * RAG_DT; p.z += vz; }
  if (bias) for (const [n, bx, bz] of bias) { pts[n].x += bx * RAG_DT * RAG_DT; pts[n].z += bz * RAG_DT * RAG_DT; }
  for (let it = 0; it < 10; it++) {
    for (const [a, b] of RAG_BONES) { const A = pts[a], B = pts[b], L = len[a + b], d = A.distanceTo(B) || 1e-6, kk = (d - L) / d * 0.5; const dx = (B.x - A.x) * kk, dy = (B.y - A.y) * kk, dz = (B.z - A.z) * kk; A.x += dx; A.y += dy; A.z += dz; B.x -= dx; B.y -= dy; B.z -= dz; }
    for (const [n, x, y, z] of pins) { const p = pts[n]; p.x = x; p.y = y; p.z = z; }
    for (const k in pts) { const p = pts[k], r = k === 'hed' ? 0.1 : k === 'pel' ? 0.12 : 0.05; if (p.y < r) { p.y = r; const q = prev[k]; q.x += (p.x - q.x) * 0.25; q.z += (p.z - q.z) * 0.25; } }
  }
  // não deixa o quadro fugir: recentra o modelo quando a pelve anda muito
  const P = pts.pel, dmx = P.x - f.rag.pel0.x, dmz = P.z - f.rag.pel0.z;
  if (Math.abs(dmx) > 2.5 || Math.abs(dmz) > 2.5) { const k = TOW_K(); for (const n in pts) { pts[n].x -= dmx; pts[n].z -= dmz; prev[n].x -= dmx; prev[n].z -= dmz; } f.wx += (dmx + dmz) / (2 * k); f.wy += (dmz - dmx) / (2 * k); }
}
const facingVec = d => { const th = (d || 0) * Math.PI / 4, sx = Math.sin(th), sy = Math.cos(th), vx = (sx + 2 * sy) / 2, vy = (2 * sy - sx) / 2, l = Math.hypot(vx, vy) || 1; return [vx / l, vy / l]; };
function towPins(f, c, mode) {
  const [fx, fy] = facingVec(c.dir), sxv = -fy, syv = fx, H = f.hgt, out = [];
  const pin = (n, wx, wy, h) => { const [mx, mz] = towModel(f, wx, wy); out.push([n, mx, h, mz]); };
  if (mode === 'arms') { const hx = c.rx + fx * 0.42, hy = c.ry + fy * 0.42; pin('haA', hx + sxv * 0.06, hy + syv * 0.06, H * 0.4); pin('haB', hx - sxv * 0.06, hy - syv * 0.06, H * 0.4); }
  else if (mode === 'foot') pin('ftA', c.rx - fx * 0.42 + sxv * 0.1, c.ry - fy * 0.42 + syv * 0.1, H * 0.32);
  else pin('pel', c.rx + sxv * 0.1 - fx * 0.05, c.ry + syv * 0.1 - fy * 0.05, H * 0.86);   // sobre o ombro
  return out;
}
function towBias(f, c, mode) {
  if (mode !== 'back') return null;
  const [fx, fy] = facingVec(c.dir), [bx, bz] = [(fx - fy), (fx + fy)];   // cabeça pende para trás, pernas para a frente
  return [['hed', -bx * 6, -bz * 6], ['ftA', bx * 5, bz * 5], ['ftB', bx * 5, bz * 5]];
}
function towLook(key) {
  const [k, id] = [key[0], key.slice(2)];
  if (k === 'p') { const e = G.players[id]; return e ? { look: { hero: { cls: e.cls, skin: e.skin, color: e.color }, cls: e.cls, lost: e.lost || 0, pro: e.pro || 0 }, e } : null; }
  if (k === 'n') { const e = G.npcs[id]; return e ? { look: { npc: e.kind, cls: NPC_CLS[e.kind] || 'knight' }, e } : null; }
  if (k === 'c') { const c = (G.corpses || []).find(q => String(q.id) === id); return c && MON_LOOK[c.type] ? { look: { type: c.type, cls: 'knight', lost: c.lost || 0 }, e: { rx: c.x, ry: c.y, dir: c.id % 8 } } : null; }
  return null;
}
function updateTows(now) {
  if (!R3.ok || typeof ragStart !== 'function') return;
  const want = {};
  for (const id in G.players) { const e = G.players[id]; if (!e.visible) continue; if (e.tow && (e.dragMode === 'arms' || e.dragMode === 'foot' || e.dragMode === 'back')) want[e.tow] = { c: e, mode: e.dragMode }; if (e.carrying) want['p:' + e.carrying] = { c: e, mode: 'back' }; }
  for (const id in G.npcs) { const e = G.npcs[id]; if (e.carrying) want['p:' + e.carrying] = { c: e, mode: 'back' }; }
  for (const id in G.monsters) { const e = G.monsters[id]; if (e.carrying && !e.dieAt) want['p:' + e.carrying] = { c: e, mode: 'back' }; }
  for (const key in want) {
    let f = TOWS[key];
    if (!f) { const L = towLook(key); if (!L) continue; f = towStart(key, L.look, L.e.rx, L.e.ry, L.e.dir); if (!f) continue; TOWS[key] = f; f.tl = now; }
    f.c = want[key].c; f.mode = want[key].mode; f.seen = now;
    const steps = Math.min(4, Math.max(1, Math.round((now - (f.tl || now)) / 16.7))); f.tl = now;
    const pins = towPins(f, f.c, f.mode), bias = towBias(f, f.c, f.mode);
    for (let s = 0; s < steps; s++) towStepOnce(f, pins, bias);
  }
  // soltou: o corpo fica deitado onde parou (vira a pose final no chão)
  for (const key in TOWS) {
    const f = TOWS[key]; if (want[key]) continue;
    if (f.mode === 'back') { delete TOWS[key]; continue; }
    for (let s = 0; s < 120; s++) towStepOnce(f, [], null);
    const R = towRig(f); if (R) { ragApply(f, R); const fin = rigShot(f, R, true), [pwx, pwy] = towWorldOf(f, 'pel'), L = towLook(key);
      if (L) { const ex = L.e.rx, ey = L.e.ry, fk = key[0] === 'p' ? 'p' + key.slice(2) : key[0] === 'c' ? 'm' + key.slice(2) : 'n' + key.slice(2);
        const p0 = iso(f.wx, f.wy), p1 = iso(ex, ey); FALLS[fk] = { ...f, done: true, final: fin, ox: p0.sx - p1.sx + f.ox, oy: p0.sy - p1.sy + f.oy, mode: 'rag', staged: false }; } }
    delete TOWS[key];
  }
}
function drawTow(ctx, key, now) {
  const f = TOWS[key]; if (!f) return false;
  const R = towRig(f); if (!R) return false;
  ragApply(f, R); const s = rigShot(f, R, false), p = iso(f.wx, f.wy), sx = p.sx + G.view.ox, sy = p.sy + G.view.oy;
  if (f.mode !== 'back') softDab(ctx, sx + f.ox, sy + f.oy, 16, '#000000', 0.28);
  ctx.imageSmoothingEnabled = true; pblit(ctx, woundOf(s, f.hero ? 1 : 0), sx + f.ox, sy + f.oy);
  if (f.mode !== 'back' && f.c && f.c.walking && Math.random() < 0.12) { const [wx, wy] = towWorldOf(f, 'pel'), w = tileW(wx, wy, 0); spawnPart('dust', w.x, w.y); }
  return true;
}
