// ============================================================
//  ARCO — segurar o clique esquerdo puxa a corda, soltar dispara, botão direito relaxa.
//  Depois de cada tiro o arqueiro pega outra flecha na aljava. A flecha voa de verdade
//  (com queda) e fica cravada onde acertou: no corpo, no chão, em árvores e paredes.
// ============================================================
G.bow = { st: 'ready' };
G.flyArrows = {}; G.gArrows = []; G.corpseArrows = {};
const isArcher = () => G.me && G.me.cls === 'archer';
function bowPress() {
  const b = G.bow, now = performance.now(), me = G.me; if (!me || me.downed || me.carrying) return;
  if (b.st === 'nocking' && now < b.until) { b.want = true; return; }
  b.st = 'drawing'; b.t0 = now; b.want = false; Net.send({ t: 'draw', on: 1 });
}
function bowRelease() {
  const b = G.bow; b.want = false; if (b.st !== 'drawing') return;
  const now = performance.now(), pow = Math.min(1, (now - b.t0) / BOW.draw);
  if (pow < 0.15) { bowCancel(); return; }
  const me = G.me, a = me.fa ?? 0, w = G.mouseW || { x: me.x + Math.cos(a) * 8, y: me.y + Math.sin(a) * 8 };
  Net.send({ t: 'loose', a, tx: w.x, ty: w.y });
  b.st = 'nocking'; b.until = now + BOW.loose + BOW.nock;
}
function bowCancel() { if (G.bow.st === 'drawing') Net.send({ t: 'draw', on: 0 }); G.bow.st = 'ready'; }
function bowUpdate(now) {
  const b = G.bow; if (!isArcher()) return;
  if (b.st === 'nocking' && now >= b.until) { b.st = 'ready'; if (b.want && G.mouse0) bowPress(); }
}
const bowPow = now => G.bow.st === 'drawing' ? Math.min(1, (now - G.bow.t0) / BOW.draw) : 0;
const bowSway = now => G.bow.st === 'drawing' ? Math.max(0, now - G.bow.t0 - BOW.draw - BOW.holdSway) / 1000 : 0;

// pose de puxar a corda (eu e os outros arqueiros)
function bowPose(e, now) {
  const t0 = e === G.me ? (G.bow.st === 'drawing' ? G.bow.t0 : 0) : e.bowDrawT;
  if (!t0 || e.cls !== 'archer') return null;
  const k = Math.min(1, (now - t0) / BOW.draw), held = now - t0 - BOW.draw;
  let f = Math.floor(k * 11); if (held > BOW.holdSway && Math.floor(now / 90) % 2) f = 10;   // braço tremendo
  return { k: 'bowdraw', f };
}

// ---------- desenho: flechas voando, cravadas no corpo e no chão, mira ----------
function arrowShaft(ctx, bx, by, dx, dy, L, up) {
  const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
  const ex = bx - dx * L, ey = by - dy * L - (up || 0);
  ctx.strokeStyle = '#3e2a16'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ex, ey); ctx.stroke(); ctx.strokeStyle = '#8a6438'; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ex, ey); ctx.stroke();
  const fx = ex - bx, fy = ey - by, fl = Math.hypot(fx, fy) || 1, ux = fx / fl, uy = fy / fl;
  ctx.strokeStyle = '#ece4d0'; ctx.lineWidth = 1; ctx.beginPath();
  ctx.moveTo(ex - ux * 2, ey - uy * 2); ctx.lineTo(ex + ux * 1 - uy * 2, ey + uy * 1 + ux * 2);
  ctx.moveTo(ex - ux * 2, ey - uy * 2); ctx.lineTo(ex + ux * 1 + uy * 2, ey + uy * 1 - ux * 2); ctx.stroke();
}
function drawStuck(ctx, e, sx, sy, now, lyingDir) {
  if (!e.arrows || !e.arrows.length) return;
  const lying = lyingDir != null || e.downed;
  for (const a of e.arrows) {
    const rot = ((e.dir || 0) - (a.dir0 || 0)) * Math.PI / 4;
    let lx = a.lx * Math.cos(rot) - a.ly * Math.sin(rot), ly = a.lx * Math.sin(rot) + a.ly * Math.cos(rot), hz = a.h;
    if (lying) {   // corpo no chão: a altura vira posição ao longo do corpo deitado
      const bd = (lyingDir != null ? lyingDir : (e.dir || 0)) * Math.PI / 4, along = (Math.min(1, a.h / (a.H || 1.8)) - 0.5) * (a.H || 1.8) * 0.45;
      lx = Math.cos(bd) * along + lx * 0.5; ly = Math.sin(bd) * along + ly * 0.5; hz = 0.25;
    }
    const fa = a.a + rot, bx = sx + (lx - ly) * 32, by = sy + (lx + ly) * 16 - hz * 25;
    arrowShaft(ctx, bx, by, (Math.cos(fa) - Math.sin(fa)) * 32, (Math.cos(fa) + Math.sin(fa)) * 16, 17, lying ? 8 : 3);
  }
}
function drawBowGround(ctx, now, P) {
  G.gArrows = G.gArrows.filter(a => now < a.t0 + a.ms);
  for (const a of G.gArrows) {
    const [x, y] = P(a.x, a.y, 0), by = y - a.h * 25, fade = Math.min(1, (a.t0 + a.ms - now) / 1500);
    ctx.globalAlpha = fade; arrowShaft(ctx, x, by, (Math.cos(a.a) - Math.sin(a.a)) * 32, (Math.cos(a.a) + Math.sin(a.a)) * 16, 16, Math.max(1, -Math.sin(a.pitch || -0.3) * 12)); ctx.globalAlpha = 1;
  }
}
function drawBowTop(ctx, now) {
  const ox = G.view.ox, oy = G.view.oy;
  for (const id in G.flyArrows) {
    const A = G.flyArrows[id], t = (now - A.t0) / 1000; if (t > 5) { delete G.flyArrows[id]; continue; }
    const x = A.x + A.vx * t, y = A.y + A.vy * t, h = A.h + A.vz * t - 0.5 * A.g * t * t, vz = A.vz - A.g * t;
    const p = iso(x, y), sx = p.sx + ox, sy = p.sy + oy - h * 25;
    const dx = (A.vx - A.vy) * 32, dy = (A.vx + A.vy) * 16 - vz * 25 * 0.5;
    ctx.save(); ctx.globalAlpha = 0.25; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; const l = Math.hypot(dx, dy) || 1; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - dx / l * 26, sy - dy / l * 26); ctx.stroke(); ctx.restore();
    arrowShaft(ctx, sx + dx / l * 6, sy + dy / l * 6, dx, dy, 15, 0);
  }
  // mira do arqueiro: anel que enche com a puxada e treme quando o braço cansa
  if (isArcher() && G.mouseW && inCombatZone()) {
    const pw = bowPow(now), sw = Math.min(1, bowSway(now)), p = iso(G.mouseW.x, G.mouseW.y);
    const jx = (Math.random() - 0.5) * sw * 10, jy = (Math.random() - 0.5) * sw * 6, x = p.sx + ox + jx, y = p.sy + oy + jy;
    ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(x, y, 9, 4.5, 0, 0, 7); ctx.stroke();
    if (pw > 0) { ctx.strokeStyle = pw >= 1 ? (sw > 0 ? 'rgba(255,120,80,0.95)' : 'rgba(255,230,140,0.95)') : 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, y, 9, 4.5, 0, -Math.PI / 2, -Math.PI / 2 + pw * Math.PI * 2); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillRect(x - 0.6, y - 0.6, 1.2, 1.2);
    if (G.bow.st === 'nocking') { ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = '7px serif'; ctx.textAlign = 'center'; ctx.fillText('pegando flecha', x, y + 13); }
    ctx.restore();
  }
}
// ---------- eventos do servidor ----------
function bowEvent(m, now) {
  switch (m.t) {
    case 'arrow': G.flyArrows[m.id] = { ...m, t0: now }; return true;
    case 'arrowend': delete G.flyArrows[m.id]; return true;
    case 'astick': G.gArrows.push({ ...m, t0: now }); if (G.gArrows.length > 160) G.gArrows.shift(); return true;
    case 'stick': {
      const e = (m.k === 'p' ? G.players : G.monsters)[m.id]; if (!e) return true;
      (e.arrows = e.arrows || []).push({ part: m.part, h: m.h, lx: m.lx, ly: m.ly, a: m.a, dir0: e.dir || 0, H: m.k === 'p' ? 1.8 : 1.6 });
      if (e.arrows.length > 14) e.arrows.shift();
      if (e === G.me && !G.arrowTip) { G.arrowTip = 1; showToast('Uma flecha cravou em você! F arranca (dói); a bandagem tira sem dor.'); }
      return true;
    }
    case 'unstick': { const e = G.players[m.id]; if (!e || !e.arrows) return true; if (m.all) e.arrows = []; else if (m.part) e.arrows = e.arrows.filter(a => a.part !== m.part); else e.arrows.pop(); return true; }
    case 'bowrelax': G.bow.st = 'ready'; return true;
  }
  return false;
}
