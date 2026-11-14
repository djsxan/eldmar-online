// ============================================================
//  NPCs VULNERÁVEIS NO CLIENTE — estados vindos do anfitrião (caído, morto, puxado, carregado),
//  sentinelas que andam, prisioneiros amarrados no poste e o que cada um carrega.
// ============================================================
function applyNpcRows(rows, now) {
  const seen = new Set();
  for (const [id, x100, y100, fl, onBack, carrying] of rows || []) {
    const e = G.npcs[id]; if (!e) continue; seen.add(id);
    e.srv = true; e.npDown = !!(fl & 1); e.npDead = !!(fl & 2); e.dragged = !!(fl & 4); e.prone = !!(fl & 8); e.npWalk = !!(fl & 32);
    e.onBackBy = onBack || null; e.carrying = carrying || null;
    e.tx = x100 / 100; e.ty = y100 / 100;
    if (e.kind !== 'fruit' || e.npDown || e.npDead || e.dragged || e.onBackBy) { if (e._snap == null || Math.hypot(e.tx - e.rx, e.ty - e.ry) > 4) { e.x = e.rx = e.tx; e.y = e.ry = e.ty; } e._snap = 1; }
  }
}
// sentinelas e corpos de NPC deslizam até a posição do anfitrião
function updateNpcMotion(now, dt) {
  for (const id in G.npcs) {
    const e = G.npcs[id]; if (e.tx == null || (e.kind === 'fruit' && !e.npDown && !e.npDead && !e.dragged && !e.onBackBy)) continue;
    const dx = e.tx - e.rx, dy = e.ty - e.ry, d = Math.hypot(dx, dy);
    if (d > 0.01) { const k = Math.min(1, dt * 9); e.rx += dx * k; e.ry += dy * k; e.x = e.rx; e.y = e.ry; if (!e.npDown && !e.npDead && !e.dragged) { e.dir = dirFromVec(dx, dy, e.dir); e.walking = e.npWalk || d > 0.05; e.walkDist = (e.walkDist || 0) + d * k; } }
    else if (!e.npWalk) e.walking = false;
  }
}
// NPC caído ou morto: deitado; puxado: arrastado; nas costas de alguém: não aparece no chão
function drawNpcState(ctx, e, sx, sy, now) {
  if (e.onBackBy) return true;
  if (!(e.npDown || e.npDead)) return false;
  const P = { dir: e.dragged && typeof dragDir === 'function' ? dragDir(e) : (e.dir || 0), walk: -1, down: true, prone: !!e.prone };
  const s = npcSprite3D(e.kind, P); ctx.imageSmoothingEnabled = true; pblit(ctx, s, sx, sy);
  if (e.npDead) { ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = '#5a0c0c'; ctx.beginPath(); ctx.ellipse(sx + 6, sy + 2, 14, 5, 0, 0, 7); ctx.fill(); ctx.restore(); }
  return true;
}
// alguém carregado nas costas de um NPC/monstro, ou NPC nas costas de um jogador
function drawNpcOnBack(ctx, carrier, sx, sy) {
  for (const id in G.npcs) { const n = G.npcs[id]; if (n.onBackBy !== carrier.id) continue; const s = npcSprite3D(n.kind, { dir: 2, walk: -1, down: true }); pblit(ctx, s, sx, sy - 70); }
}
// prisioneiro amarrado: poste de madeira com cordas, sentado no chão de costas para ele
function drawTied(ctx, e, sx, sy, now) {
  ctx.save(); ctx.fillStyle = '#4a3420'; ctx.fillRect(sx - 2, sy - 44, 4, 46); ctx.fillStyle = '#3a2814'; ctx.fillRect(sx - 3, sy - 46, 6, 3);
  const s = heroSprite3D(e.cls, e.skin, e.color, { dir: e.dir || 0, walk: -1, sit: 'g', tied: 1 }); ctx.imageSmoothingEnabled = true; pblit(ctx, woundOf(s, 3), sx, sy + 2);
  ctx.strokeStyle = '#c8a870'; ctx.lineWidth = 1.2; for (const yy of [-22, -16]) { ctx.beginPath(); ctx.ellipse(sx, sy + yy, 7, 2.5, 0, 0, 7); ctx.stroke(); }
  if (e === G.me) { const k = Math.min(1, (e.esc || 0) / 100); ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(sx - 22, sy - 64, 44, 6); ctx.fillStyle = '#e8c45a'; ctx.fillRect(sx - 21, sy - 63, 42 * k, 4); ctx.fillStyle = '#fff'; ctx.font = 'bold 7px serif'; ctx.textAlign = 'center'; ctx.fillText('Martele ESPAÇO para soltar as cordas', sx, sy - 68); }
  ctx.restore();
}
function tiedNear() { const me = G.me; for (const id in G.players) { const q = G.players[id]; if (q !== me && q.tied && dist(q.rx, q.ry, me.x, me.y) < 1.8) return q; } return null; }
