// ============================================================
//  PROGRESSÃO — painel da árvore de talentos (K), habilidades 5/6/7,
//  progressão por uso na pausa e efeitos das zonas (estandarte, armadilha, santuário)
// ============================================================
function stamMax() { const me = G.me; return me ? Math.round(STAM_MAX * (1 + treeEff(me, 'stam') + useBonus(me, 'run'))) : STAM_MAX; }
function speedMul() {
  const me = G.me; if (!me) return 1;
  const legs = (me.arw || []).filter(p => p === 'legL' || p === 'legR').length;
  return (1 + treeEff(me, 'speed') + useBonus(me, 'run') * 0.47) * (G.bow && G.bow.st === 'drawing' ? 0.5 : 1) * Math.max(0.6, 1 - legs * 0.2);
}

// ---------- painel da árvore ----------
function updateTree() {
  const me = G.me, box = $('tree-body'); if (!me || !box) return;
  const T = TREE[me.cls] || [], spent = treePts(me), free = Math.max(0, (me.lvl || 1) - 1 - spent);
  $('tree-pts').textContent = free + (free === 1 ? ' ponto livre' : ' pontos livres');
  box.innerHTML = '';
  T.forEach((b, bi) => {
    const col = document.createElement('div'); col.className = 'tr-col';
    const bp = branchPts(me, b);
    col.innerHTML = '<div class="tr-head"><span class="tr-ic">' + b.icon + '</span>' + b.name + '<small>' + bp + ' pts</small></div>';
    b.nodes.forEach((nd, i) => {
      const r = (me.tree && me.tree[nd.id]) | 0, unlocked = bp >= TREE_REQ[i], can = unlocked && free > 0 && r < nd.max;
      const el = document.createElement('button'); el.className = 'tr-node' + (nd.skill ? ' skill' : '') + (r ? ' got' : '') + (!unlocked ? ' locked' : '') + (can ? ' can' : '');
      el.innerHTML = '<b>' + nd.name + '</b><span>' + (nd.skill ? (r ? 'tecla ' + (5 + bi) : 'habilidade') : r + '/' + nd.max) + '</span>';
      const tip = nd.desc + (nd.skill ? '\nMana ' + nd.mp + ' · Recarga ' + nd.cd / 1000 + 's · Tecla ' + (5 + bi) : '') + (!unlocked ? '\nPrecisa de ' + TREE_REQ[i] + ' pontos neste ramo.' : '');
      el.title = tip; el.onmouseenter = () => { $('tree-info').textContent = nd.name + ' — ' + tip.replace(/\n/g, ' · '); };
      el.onclick = () => { if (can) Net.send({ t: 'tlearn', id: nd.id }); else if (!unlocked) showToast('Gaste ' + TREE_REQ[i] + ' pontos em ' + b.name + ' para liberar.'); else if (!free) showToast('Sem pontos livres: suba de nível.'); };
      col.appendChild(el);
    });
    box.appendChild(col);
  });
}
function onProgStat() { const t = $('tree'); if (t && !t.classList.contains('hidden')) updateTree(); }

// ---------- progressão por uso (pausa) ----------
function useHtml() {
  const me = G.me; if (!me) return '';
  const cats = {}; for (const k in USE) (cats[USE[k].cat] = cats[USE[k].cat] || []).push(k);
  let h = '';
  for (const c in cats) {
    h += '<div class="us-cat">' + c + '</div>';
    for (const k of cats[c]) {
      if ((k === 'sword' && me.cls !== 'knight') || (k === 'dagger' && me.cls !== 'archer') || (k === 'staff' && me.cls !== 'mage') || (k === 'bow' && me.cls !== 'archer') || (k === 'magic' && me.cls !== 'mage')) continue;
      const l = useLvl(me, k), b = Math.round(useBonus(me, k) * 1000) / 10;
      h += '<div class="us-row" title="' + USE[k].desc + '"><span>' + USE[k].name + '</span><div class="us-bar"><i style="width:' + l + '%"></i></div><b>' + l + '</b><small>+' + b + '%</small></div>';
    }
  }
  return h + '<div class="gp-note">Sobem conforme você usa. No 100: +15% no que cada uma melhora.</div>';
}

// ---------- zonas (estandarte, armadilha, santuário) e efeitos ----------
G.zones = G.zones || [];
function drawZones(ctx, now, P) {
  G.zones = G.zones.filter(z => now < z.t0 + z.ms);
  for (const z of G.zones) {
    const [x, y] = P(z.x, z.y, z.z || 0), fade = Math.min(1, (z.t0 + z.ms - now) / 600);
    ctx.save(); ctx.globalAlpha = fade;
    if (z.k === 'sanct' || z.k === 'banner') {
      const r = (z.k === 'sanct' ? 4 : 4.5) * 32, pulse = 0.5 + Math.sin(now / 300) * 0.5;
      ctx.strokeStyle = z.k === 'sanct' ? 'rgba(255,230,140,0.7)' : 'rgba(220,60,40,0.55)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(x, y, r, r / 2, 0, 0, 7); ctx.stroke();
      ctx.fillStyle = z.k === 'sanct' ? 'rgba(255,230,140,' + (0.08 + pulse * 0.05).toFixed(3) + ')' : 'rgba(200,50,30,0.06)'; ctx.fill();
      G.lights.push({ x, y: y - 10, r: z.k === 'sanct' ? 150 : 70, c: z.k === 'sanct' ? '255,230,150' : '255,140,90', a: 0.6 * fade });
    }
    if (z.k === 'banner') {   // mastro com flâmula vermelha tremulando
      ctx.fillStyle = '#4a3420'; ctx.fillRect(x - 1, y - 46, 2, 46);
      const w = Math.sin(now / 160) * 3; ctx.fillStyle = '#a8241c'; ctx.beginPath(); ctx.moveTo(x + 1, y - 45); ctx.quadraticCurveTo(x + 10, y - 44 + w, x + 18, y - 42 + w); ctx.lineTo(x + 16, y - 33 + w); ctx.quadraticCurveTo(x + 9, y - 33 + w * 0.5, x + 1, y - 32); ctx.fill();
      ctx.fillStyle = '#e8c45a'; ctx.fillRect(x + 6, y - 41 + w * 0.5, 4, 4);
    }
    if (z.k === 'sanct') for (let k = 0; k < 6; k++) { const ph = (now / 1400 + k / 6) % 1, a = k * 1.05 + now / 2000, rr = 30 + (k % 3) * 25; ctx.fillStyle = 'rgba(255,240,180,' + (Math.sin(ph * Math.PI) * 0.8).toFixed(2) + ')'; ctx.fillRect(x + Math.cos(a) * rr - 1, y + Math.sin(a) * rr * 0.5 - ph * 40, 2, 2); }
    if (z.k === 'trap') {   // mandíbulas de ferro no chão
      ctx.strokeStyle = '#4a4a4e'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, y, 7, 3.5, 0, 0, 7); ctx.stroke();
      ctx.fillStyle = '#8a8a90'; for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; ctx.fillRect(x + Math.cos(a) * 6 - 0.5, y + Math.sin(a) * 3 - 2, 1, 2.5); }
    }
    ctx.restore();
  }
  // monstros presos no gelo: brilho azul
  for (const id in G.monsters) { const e = G.monsters[id]; if (!e.iceUntil || now > e.iceUntil) continue; const [x, y] = P(e.rx, e.ry, e.z || 0); ctx.save(); ctx.globalCompositeOperation = 'lighter'; softDab(ctx, x, y - 16, 26, '#9ad8ff', 0.35); ctx.restore(); }
}
function progEvent(m, now) {
  switch (m.t) {
    case 'zone': G.zones.push({ ...m, t0: now }); return true;
    case 'zoneoff': { let bi = -1, bd = 1; G.zones.forEach((z, i) => { const d = Math.hypot(z.x - m.x, z.y - m.y); if (z.k === m.k && d < bd) { bd = d; bi = i; } }); if (bi >= 0) G.zones.splice(bi, 1); return true; }
    case 'smokebomb': { const p = iso(m.x, m.y); for (let k = 0; k < 40; k++) spawnPart('smoke', p.sx + (Math.random() - 0.5) * 90, p.sy - Math.random() * 40); G.shake = Math.max(G.shake, 2); return true; }
    case 'icejail': { const e = G.monsters[m.id]; if (e) e.iceUntil = now + m.ms; return true; }
    case 'usel': showToast((USE[m.k] ? USE[m.k].name : m.k) + ' chegou a ' + m.l + '!'); return true;
  }
  return false;
}
if (typeof NPC_DIALOG !== 'undefined' && NPC_DIALOG.priest && NPC_DIALOG.priest.opts) NPC_DIALOG.priest.opts.push(['Esquecer talentos (reinicia a árvore) — 20 ouro por nível', { a: 'treset' }]);
