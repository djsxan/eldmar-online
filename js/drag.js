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
//  CORPO REBOCADO — ragdoll de verdade preso às mãos de quem puxa (braços/pé, sozinho ou em dupla)
//  ou dobrado sobre o ombro de quem carrega (desenhado junto, na mesma cena 3D, e colidindo com o corpo dele).
//  Vale para gente (ragdoll humano) e bichos (ragdoll de quadrúpede).
// ============================================================
const TOWS = {};
const TOW_K = () => 32 / U;
const W2M = (dx, dy) => { const k = TOW_K(); return [(dx - dy) * k, (dx + dy) * k]; };
const M2W = (mx, mz) => { const k = TOW_K(); return [(mx + mz) / (2 * k), (mz - mx) / (2 * k)]; };
function towRig(f) {
  if (f.npc) { if (!_rigs.get('npc:' + f.npc)) { R3.budget = Math.max(R3.budget, 1); npcSprite3D(f.npc, { dir: 0, walk: -1 }); } return _rigs.get('npc:' + f.npc); }
  return rigOf(f);
}
// simulação genérica: humano (rag) ou bicho (quad)
const simOf = f => f.mode === 'quad' ? f.quad : f.rag;
const ctrOf = f => { const s = simOf(f); return f.mode === 'quad' ? s.pts.F.clone().add(s.pts.K).multiplyScalar(0.5) : s.pts.pel; };
const ctr0Of = f => f.mode === 'quad' ? f.quad.c0 : f.rag.pel0;
function towStart(key, look, wx, wy, dir) {
  const quad = look.type && QUAD_RAG.has(look.type);
  const f = { key, ...look, dir: dir || 0, ix: 0, iy: 0, force: 0.1, t0: performance.now(), ox: 0, oy: 0, mode: quad ? 'quad' : 'rag' };
  const R = towRig(f); if (!R) return null;
  if (quad) { quadStart(f, R); f.hgt = Math.max(0.4, f.quad.pts.T.y); for (let k = 0; k < 300 && !quadStep(f); k++); }
  else { ragStart(f, R); f.hgt = Math.max(1.2, f.rag.pts.hed.y); for (let k = 0; k < 300 && !ragStep(f); k++); }
  if (quad) {   // quais patas são da frente
    const P = f.quad.pts, fwd = P.F.clone().sub(P.K); f.front = []; f.back = [];
    for (const L of f.quad.legs) (P['H' + L.i].clone().sub(P.F.clone().add(P.K).multiplyScalar(0.5)).dot(fwd) > 0 ? f.front : f.back).push('P' + L.i);
  }
  const c = ctrOf(f), c0 = ctr0Of(f), [dx, dy] = M2W(c.x - c0.x, c.z - c0.z);
  f.wx = wx - dx; f.wy = wy - dy; f.pinT = {};
  return f;
}
function towModel(f, wx, wy) { const c0 = ctr0Of(f), [mx, mz] = W2M(wx - f.wx, wy - f.wy); return [c0.x + mx, c0.z + mz]; }
function towWorldOf(f, name) { const s = simOf(f), c0 = ctr0Of(f), p = s.pts[name], [dx, dy] = M2W(p.x - c0.x, p.z - c0.z); return [f.wx + dx, f.wy + dy]; }
// um passo de física com pontos presos de forma suave (sem trancos) e colisão com o corpo de quem carrega
function towStepOnce(f, pins, bias, cols) {
  const s = simOf(f), { pts, prev, len } = s, quad = f.mode === 'quad';
  for (const k in pts) { const p = pts[k], q = prev[k], vx = (p.x - q.x) * 0.93, vy = (p.y - q.y) * 0.93, vz = (p.z - q.z) * 0.93; q.copy(p); p.x += vx; p.y += vy - 9.8 * RAG_DT * RAG_DT; p.z += vz; }
  if (bias) for (const [n, bx, bz] of bias) if (pts[n]) { pts[n].x += bx * RAG_DT * RAG_DT; pts[n].z += bz * RAG_DT * RAG_DT; }
  for (const [n, x, y, z] of pins) { const t = f.pinT[n] || (f.pinT[n] = { x, y, z }); t.x += (x - t.x) * 0.35; t.y += (y - t.y) * 0.35; t.z += (z - t.z) * 0.35; }   // alvo suavizado
  for (let it = 0; it < 8; it++) {
    if (quad) for (const [a, b] of s.pairs) { const A = pts[a], B = pts[b], L = len[a + '|' + b], d = A.distanceTo(B) || 1e-6, kk = (d - L) / d * 0.5; const dx = (B.x - A.x) * kk, dy = (B.y - A.y) * kk, dz = (B.z - A.z) * kk; A.x += dx; A.y += dy; A.z += dz; B.x -= dx; B.y -= dy; B.z -= dz; }
    else {
      for (const [a, b] of RAG_BONES) { const A = pts[a], B = pts[b], L = len[a + b], d = A.distanceTo(B) || 1e-6, kk = (d - L) / d * 0.5; const dx = (B.x - A.x) * kk, dy = (B.y - A.y) * kk, dz = (B.z - A.z) * kk; A.x += dx; A.y += dy; A.z += dz; B.x -= dx; B.y -= dy; B.z -= dz; }
      for (const [a, b, fr] of RAG_MIN) { const A = pts[a], B = pts[b], L = (fr * (a[0] === 'h' && b[0] === 'f' ? len[a + 'kn' + a[2]] + len['kn' + a[2] + 'ft' + a[2]] : a === 'pel' ? len.pelnek + len.nekhed : len[a + 'el' + a[2]] + len['el' + a[2] + 'ha' + a[2]])) || 0.5, d = A.distanceTo(B) || 1e-6; if (d >= L) continue; const kk = (d - L) / d * 0.5; const dx = (B.x - A.x) * kk, dy = (B.y - A.y) * kk, dz = (B.z - A.z) * kk; A.x += dx; A.y += dy; A.z += dz; B.x -= dx; B.y -= dy; B.z -= dz; }
    }
    for (const n in f.pinT) { if (!pins.some(q => q[0] === n)) continue; const p = pts[n], t = f.pinT[n]; p.x += (t.x - p.x) * 0.6; p.y += (t.y - p.y) * 0.6; p.z += (t.z - p.z) * 0.6; }
    if (cols) for (const C of cols) for (const k in pts) {   // não atravessa o tronco/cabeça de quem carrega
      const p = pts[k]; if (p.y < C.y0 || p.y > C.y1) continue; const dx = p.x - C.x, dz = p.z - C.z, d = Math.hypot(dx, dz); if (d >= C.r || d < 1e-5) continue; p.x = C.x + dx / d * C.r; p.z = C.z + dz / d * C.r;
    }
    for (const k in pts) { const p = pts[k], r = quad ? (k[0] === 'P' ? 0.03 : 0.12) : (k === 'hed' ? 0.1 : k === 'pel' ? 0.12 : 0.05); if (p.y < r) { p.y = r; const q = prev[k]; q.x += (p.x - q.x) * 0.45; q.z += (p.z - q.z) * 0.45; q.y = p.y; } }
  }
  // recentra o modelo quando o corpo anda muito (o quadro não foge)
  const c = ctrOf(f), c0 = ctr0Of(f), dmx = c.x - c0.x, dmz = c.z - c0.z;
  if (Math.abs(dmx) > 2.5 || Math.abs(dmz) > 2.5) { for (const n in pts) { pts[n].x -= dmx; pts[n].z -= dmz; prev[n].x -= dmx; prev[n].z -= dmz; } for (const n in f.pinT) { f.pinT[n].x -= dmx; f.pinT[n].z -= dmz; } const [dx, dy] = M2W(dmx, dmz); f.wx += dx; f.wy += dy; }
}
const facingVec = d => { const th = (d || 0) * Math.PI / 4, sx = Math.sin(th), sy = Math.cos(th), vx = (sx + 2 * sy) / 2, vy = (2 * sy - sx) / 2, l = Math.hypot(vx, vy) || 1; return [vx / l, vy / l]; };
// posição REAL das mãos de quem puxa (lida do esqueleto 3D na pose atual), em relação aos pés dele
const HANDC = new Map();
function handsOf(c) {
  const P = heroPoseFor(c, performance.now()), cls = c.isNpc ? (NPC_CLS[c.kind] || 'knight') : (c.cls || 'knight');
  const key = (c.isNpc ? 'n' + c.kind : cls + c.skin + c.color) + '|' + P.drag + '|' + (P.dir | 0) + '|' + (P.walk >= 0 ? P.walk : 's');
  let h = HANDC.get(key); if (h) return h;
  const R = c.isNpc ? _rigs.get('npc:' + c.kind) : _rigs.get(cls + ':' + c.skin + ':' + c.color); if (!R) return null;
  const Q = buildPose(cls, P); applyPose(R, Q, P, P.walk >= 0 ? P.walk / 12 * Math.PI * 2 : 0);
  const a = (P.dir | 0) * Math.PI / 4; R.root.position.set(0, 0, 0); R.root.quaternion.identity(); R.root.rotation.set(0, Math.atan2(0.5 * Math.sin(a), Math.cos(a)), 0); R.root.updateMatrixWorld(true);
  let minY = Infinity; for (const o of [R.LA.ft, R.LB.ft]) minY = Math.min(minY, o.getWorldPosition(v3()).y);
  const A = R.A.hand.getWorldPosition(v3()), B = R.B.hand.getWorldPosition(v3()), wa = M2W(A.x, A.z), wb = M2W(B.x, B.z);
  h = { A: [wa[0], wa[1], A.y - minY], B: [wb[0], wb[1], B.y - minY] }; HANDC.set(key, h); if (HANDC.size > 3000) HANDC.clear(); return h;
}
function towPins(f, c, mode) {
  const out = [], H = f.hgt, pin = (n, wx, wy, h) => { const [mx, mz] = towModel(f, wx, wy); out.push([n, mx, h, mz]); };
  const hd = handsOf(c), [fx, fy] = facingVec(c.dir), sxv = -fy, syv = fx;
  const hA = hd ? [c.rx + hd.A[0], c.ry + hd.A[1], hd.A[2]] : [c.rx + fx * 0.3, c.ry + fy * 0.3, H * 0.4];
  const hB = hd ? [c.rx + hd.B[0], c.ry + hd.B[1], hd.B[2]] : hA;
  if (f.mode === 'quad') {
    if (mode === 'arms') { const fr = f.front.length ? f.front : ['F']; pin(fr[0], hA[0], hA[1], hA[2]); if (fr[1]) pin(fr[1], hB[0], hB[1], hB[2]); }
    else if (mode === 'foot') pin((f.back[0] || 'K'), hA[0], hA[1], hA[2]);
    else pin('T', c.rx + sxv * 0.08, c.ry + syv * 0.08, 1.45);
    return out;
  }
  if (mode === 'arms') { pin('haA', hA[0], hA[1], Math.min(hA[2], H * 0.34)); pin('haB', hB[0], hB[1], Math.min(hB[2], H * 0.34)); }   // as mãos do corpo nas mãos de quem puxa (baixas, o corpo arrasta no chão)
  else if (mode === 'foot') pin('ftA', hA[0], hA[1], Math.min(hA[2], H * 0.3));
  else pin('pel', c.rx + sxv * 0.09 - fx * 0.02, c.ry + syv * 0.09 - fy * 0.02, H * 0.84);   // sobre o ombro
  return out;
}
function towBias(f, c, mode) {
  if (mode !== 'back') return null;
  const [fx, fy] = facingVec(c.dir), [bx, bz] = W2M(fx, fy), l = Math.hypot(bx, bz) || 1, ux = bx / l, uz = bz / l;
  return f.mode === 'quad' ? [['F', -ux * 4, -uz * 4], ['K', ux * 4, uz * 4]] : [['hed', -ux * 7, -uz * 7], ['shA', -ux * 4, -uz * 4], ['shB', -ux * 4, -uz * 4], ['ftA', ux * 6, uz * 6], ['ftB', ux * 6, uz * 6], ['knA', ux * 4, uz * 4], ['knB', ux * 4, uz * 4]];
}
function towCols(f, c, mode) {
  if (mode !== 'back') return null;
  const [mx, mz] = towModel(f, c.rx, c.ry), H = 1.75;
  return [{ x: mx, z: mz, r: 0.2, y0: 0.15, y1: H * 0.78 }, { x: mx, z: mz, r: 0.13, y0: H * 0.8, y1: H * 1.02 }];
}
function towLook(key) {
  const k = key[0], id = key.slice(2);
  if (k === 'p') { const e = G.players[id]; return e ? { look: { hero: { cls: e.cls, skin: e.skin, color: e.color }, cls: e.cls, lost: e.lost || 0, pro: e.pro || 0 }, e } : null; }
  if (k === 'n') { const e = G.npcs[id]; return e ? { look: { npc: e.kind, cls: NPC_CLS[e.kind] || 'knight' }, e } : null; }
  if (k === 'c') { const c = (G.corpses || []).find(q => String(q.id) === id); return c && (MON_LOOK[c.type] || QUAD_RAG.has(c.type)) ? { look: { type: c.type, cls: 'knight', lost: c.lost || 0 }, e: { rx: c.x, ry: c.y, dir: c.id % 8 } } : null; }
  return null;
}
function updateTows(now) {
  if (!R3.ok || typeof ragStart !== 'function') return;
  const want = {}, add = (key, c, mode) => (want[key] = want[key] || []).push({ c, mode });
  for (const id in G.players) { const e = G.players[id]; if (!e.visible) continue; if (e.tow && (e.dragMode === 'arms' || e.dragMode === 'foot' || e.dragMode === 'back')) add(e.tow, e, e.dragMode); if (e.carrying) add('p:' + e.carrying, e, 'back'); }
  for (const id in G.npcs) { const e = G.npcs[id]; if (e.carrying) add('p:' + e.carrying, e, 'back'); }
  for (const id in G.monsters) { const e = G.monsters[id]; if (e.carrying && !e.dieAt) add('p:' + e.carrying, e, 'back'); }
  for (const key in want) {
    let f = TOWS[key];
    if (!f) { const L = towLook(key); if (!L) continue; f = towStart(key, L.look, L.e.rx, L.e.ry, L.e.dir); if (!f) continue; TOWS[key] = f; f.tl = now; }
    f.cs = want[key]; f.c = f.cs[0].c; f.tmode = f.cs[0].mode; f.seen = now; f.combined = f.tmode === 'back' && !!(f.c.isNpc || f.c.cls);
    const steps = Math.min(4, Math.max(1, Math.round((now - (f.tl || now)) / 16.7))); f.tl = now;
    let pins = []; for (const w of f.cs) pins = pins.concat(towPins(f, w.c, w.mode));
    const bias = towBias(f, f.c, f.tmode), cols = towCols(f, f.c, f.tmode);
    for (let s = 0; s < steps; s++) towStepOnce(f, pins, bias, cols);
  }
  // soltou: o corpo assenta no chão e fica deitado onde parou
  for (const key in TOWS) {
    const f = TOWS[key]; if (want[key]) continue;
    for (let s = 0; s < 160; s++) towStepOnce(f, [], null, null);
    const R = towRig(f), L = towLook(key);
    if (R && L) { if (f.mode === 'quad') quadApply(f, R); else ragApply(f, R); const fin = rigShot(f, R, true), fk = key[0] === 'p' ? 'p' + key.slice(2) : key[0] === 'c' ? 'm' + key.slice(2) : 'n' + key.slice(2), p0 = iso(f.wx, f.wy), p1 = iso(L.e.rx, L.e.ry); FALLS[fk] = { ...f, done: true, final: fin, ox: p0.sx - p1.sx + f.ox, oy: p0.sy - p1.sy + f.oy, staged: false }; }
    delete TOWS[key];
  }
}
function towSprite(f) { const R = towRig(f); if (!R) return null; if (f.mode === 'quad') quadApply(f, R); else ragApply(f, R); return { s: rigShot(f, R, false), R }; }
// corpo no chão (puxado): desenhado no lugar dele
function drawTow(ctx, key, now) {
  const f = TOWS[key]; if (!f) return false;
  if (f.tmode === 'back' && f.c && !f.c.isMon && f.combined) return true;   // vai junto com quem carrega
  const t = towSprite(f); if (!t) return false;
  const p = iso(f.wx, f.wy), sx = p.sx + G.view.ox, sy = p.sy + G.view.oy;
  if (f.tmode !== 'back') softDab(ctx, sx + f.ox, sy + f.oy, 16, '#000000', 0.28);
  ctx.imageSmoothingEnabled = true; pblit(ctx, woundOf(t.s, f.hero ? 1 : 0), sx + f.ox, sy + f.oy);
  if (f.tmode !== 'back' && f.c && f.c.walking && Math.random() < 0.12) { const [wx, wy] = towWorldOf(f, f.mode === 'quad' ? 'F' : 'pel'), w = tileW(wx, wy, 0); spawnPart('dust', w.x, w.y); }
  return true;
}
// saco no ombro: quem carrega e o carregado fotografados JUNTOS (a perna passa na frente do peito, a cabeça fica atrás das costas)
function carrySprite(c, f, P) {
  const cls = c.isNpc ? (NPC_CLS[c.kind] || 'knight') : c.cls, R = c.isNpc ? _rigs.get('npc:' + c.kind) : _rigs.get(cls + ':' + c.skin + ':' + c.color), Rb = towRig(f);
  if (!R || !Rb) return null;
  const { renderer, scene, cam, W, H } = R3;
  const Q = buildPose(cls, P); if (!c.isNpc) applyLost(R, P.lost || 0, P.pro || 0); applyPose(R, Q, P, P.walk >= 0 ? P.walk / 12 * Math.PI * 2 : 0);
  const a = (P.dir | 0) * Math.PI / 4; R.root.position.set(0, 0, 0); R.root.quaternion.identity(); R.root.rotation.set(0, Math.atan2(0.5 * Math.sin(a), Math.cos(a)), 0); R.root.updateMatrixWorld(true);
  let minY = Infinity; for (const o of [R.LA.ft, R.LB.ft]) minY = Math.min(minY, o.getWorldPosition(v3()).y); R.root.position.y = -minY + 0.035; R.root.updateMatrixWorld(true);
  if (f.mode === 'quad') quadApply(f, Rb); else ragApply(f, Rb);
  const s = simOf(f), cc = ctrOf(f), c0 = ctr0Of(f), [ox, oz] = W2M(f.wx - c.rx, f.wy - c.ry);
  Rb.root.position.x += ox + cc.x - c0.x; Rb.root.position.z += oz + cc.z - c0.z; Rb.root.position.y += R.root.position.y; Rb.root.updateMatrixWorld(true);
  if (f.hero) applyLost(Rb, f.lost || 0, f.pro || 0);
  scene.add(R.root); scene.add(Rb.root); renderer.render(scene, cam); scene.remove(R.root); scene.remove(Rb.root);
  const cv = f._ccv || (f._ccv = document.createElement('canvas')); cv.width = W; cv.height = H; const x = cv.getContext('2d'); x.clearRect(0, 0, W, H); x.drawImage(renderer.domElement, 0, 0);
  return { c: cv, w: FRAME_W, h: FRAME_H, ax: FRAME_W / 2, ay: FOOT_Y, painted: true, hd: true };
}
