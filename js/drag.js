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
  for (const c of G.corpses || []) { if (!c.looted || c.onBack) continue; const w = WEIGHT_C[c.type] ?? 3; if (w >= 3) continue; const d = dist(c.x, c.y, me.x, me.y); if (d < bd) { bd = d; best = { k: 'c', id: c.id, opts: w >= 2 ? ['arms', 'foot', 'back'] : ['arms', 'foot', 'back'] }; } }
  if (best) return best;
  bd = 1.4; for (const id in G.players) { const q = G.players[id]; if (q === me || !q.visible || q.downed || q.isNpc || q.carriedBy) continue; const d = dist(q.rx, q.ry, me.x, me.y); if (d < bd) { bd = d; best = { k: 'p', id, opts: ['grip'], standing: true }; } }
  return best;
}
// F apertado: larga o que estiver segurando, ou começa o menu radial
function grabKeyDown() {
  const me = G.me; if (!me || me.downed) return false;
  if (me.dragMode) { Net.send({ t: 'release' }); return true; }
  if (me.carrying) return false;   // o F de entregar ao carrasco / G de largar continuam valendo
  const c = grabCandidate(); if (!c) return false;
  G.radial = { t0: performance.now(), ...c, sel: 0 }; return true;
}
function grabKeyUp() {
  const R = G.radial; if (!R) return false; G.radial = null;
  const now = performance.now();
  if (now - R.t0 < RADIAL_MS) {   // toque rápido: ação comum
    if (R.opts[0] === 'revive') { G.reviving = R.id; G.reviveSticky = true; Net.send({ t: 'revive', id: R.id, on: true }); }
    else if (R.standing) Net.send({ t: 'kick', a: G.me.fa ?? 0 });
    return true;
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
  if (e._dpx != null) { const mx = e.rx - e._dpx, my = e.ry - e._dpy; if (mx * mx + my * my > 0.0002) e._dA = Math.atan2(my, mx); }
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
