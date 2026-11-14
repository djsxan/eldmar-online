// ============================================================
//  PROGRESSÃO — painel da árvore de talentos (K), habilidades 5/6/7,
//  progressão por uso na pausa e efeitos das zonas (estandarte, armadilha, santuário)
// ============================================================
function stamMax() { const me = G.me; return me ? Math.round(STAM_MAX * (1 + treeEff(me, 'stam') + useBonus(me, 'run'))) : STAM_MAX; }
function speedMul() {
  const me = G.me; if (!me) return 1;
  const legs = (me.arw || []).filter(p => p === 'legL' || p === 'legR').length;
  return (1 + treeEff(me, 'speed') + useBonus(me, 'run') * 0.47) * (G.bow && G.bow.st === 'drawing' ? 0.5 : 1) * (me.dragMode ? Math.min(1, ({ arms: 0.45, foot: 0.6, back: 0.75, grip: 0.5 }[me.dragMode] || 1) * (me.pullHelp ? 1.6 : 1)) : 1) * Math.max(0.6, 1 - legs * 0.2);
}

// ---------- painel da árvore: constelações num céu noturno ----------
const CONST_SHAPES = [   // posições (0..1) dos 5 astros de cada ramo, de baixo para cima
  [[0.5, 0.9], [0.3, 0.72], [0.62, 0.55], [0.35, 0.36], [0.55, 0.14]],
  [[0.5, 0.9], [0.7, 0.72], [0.4, 0.56], [0.66, 0.37], [0.45, 0.14]],
  [[0.5, 0.9], [0.32, 0.7], [0.58, 0.52], [0.3, 0.34], [0.6, 0.14]],
];
const SVGNS = 'http://www.w3.org/2000/svg';
const svgEl = (t, a) => { const e = document.createElementNS(SVGNS, t); for (const k in a) e.setAttribute(k, a[k]); return e; };
function updateTree() {
  const me = G.me, box = $('tree-body'); if (!me || !box) return;
  const T = TREE[me.cls] || [], spent = treePts(me), free = Math.max(0, (me.lvl || 1) - 1 - spent);
  $('tree-pts').textContent = free + (free === 1 ? ' ponto livre' : ' pontos livres');
  box.innerHTML = '';
  const W = 900, H = 520, svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'tr-sky' });
  const defs = svgEl('defs', {});
  defs.innerHTML = '<radialGradient id="trGlow"><stop offset="0" stop-color="#fff6d8"/><stop offset="0.35" stop-color="#f0c860"/><stop offset="1" stop-color="#f0c860" stop-opacity="0"/></radialGradient><radialGradient id="trCan"><stop offset="0" stop-color="#ffffff"/><stop offset="0.4" stop-color="#bcd4ff"/><stop offset="1" stop-color="#bcd4ff" stop-opacity="0"/></radialGradient><radialGradient id="trNeb"><stop offset="0" stop-color="#6a7ab8" stop-opacity="0.35"/><stop offset="1" stop-color="#1a1c30" stop-opacity="0"/></radialGradient>';
  svg.appendChild(defs);
  // estrelas de fundo (sempre as mesmas) e nebulosas atrás de cada constelação
  for (let i = 0; i < 160; i++) { const r = hash2(i, 3, 901), r2 = hash2(i, 7, 902), r3 = hash2(i, 11, 903); svg.appendChild(svgEl('circle', { cx: r * W, cy: r2 * H, r: 0.4 + r3 * 1.1, fill: '#dfe6ff', opacity: 0.25 + r3 * 0.55, class: r3 > 0.8 ? 'tr-twinkle' : '' })); }
  const colW = W / 3;
  T.forEach((b, bi) => {
    const bp = branchPts(me, b), x0 = bi * colW, sh = CONST_SHAPES[bi % 3], pos = sh.map(([u, v]) => [x0 + 40 + u * (colW - 80), 60 + v * (H - 110)]);
    svg.appendChild(svgEl('ellipse', { cx: x0 + colW / 2, cy: H / 2 + 10, rx: colW * 0.42, ry: H * 0.42, fill: 'url(#trNeb)' }));
    const title = svgEl('text', { x: x0 + colW / 2, y: 34, class: 'tr-btitle' }); title.textContent = b.icon + '  ' + b.name; svg.appendChild(title);
    const sub = svgEl('text', { x: x0 + colW / 2, y: 52, class: 'tr-bsub' }); sub.textContent = bp + ' pontos'; svg.appendChild(sub);
    // linhas da constelação: acesas até onde o ramo já liberou
    for (let i = 0; i < pos.length - 1; i++) { const lit = bp >= TREE_REQ[i + 1]; svg.appendChild(svgEl('line', { x1: pos[i][0], y1: pos[i][1], x2: pos[i + 1][0], y2: pos[i + 1][1], class: 'tr-link' + (lit ? ' lit' : '') })); }
    b.nodes.forEach((nd, i) => {
      const [x, y] = pos[i], r = (me.tree && me.tree[nd.id]) | 0, unlocked = bp >= TREE_REQ[i], can = unlocked && free > 0 && r < nd.max, R = nd.skill ? 15 : 10;
      const g = svgEl('g', { class: 'tr-star' + (r ? ' got' : '') + (can ? ' can' : '') + (!unlocked ? ' locked' : ''), transform: `translate(${x},${y})` });
      g.appendChild(svgEl('circle', { r: R * 2.6, fill: r ? 'url(#trGlow)' : can ? 'url(#trCan)' : 'none', class: 'tr-halo' }));
      if (nd.skill) g.appendChild(svgEl('polygon', { points: [0, 1, 2, 3, 4, 5, 6, 7].map(k => { const a = k / 8 * Math.PI * 2 - Math.PI / 2, rr = k % 2 ? R * 0.55 : R * 1.25; return (Math.cos(a) * rr).toFixed(1) + ',' + (Math.sin(a) * rr).toFixed(1); }).join(' '), class: 'tr-core' }));
      else g.appendChild(svgEl('circle', { r: R * 0.55, class: 'tr-core' }));
      for (let k = 0; k < nd.max && !nd.skill; k++) { const a = -Math.PI / 2 + (k - (nd.max - 1) / 2) * 0.55; g.appendChild(svgEl('circle', { cx: Math.cos(a) * (R + 6), cy: Math.sin(a) * (R + 6), r: 2, class: 'tr-rank' + (k < r ? ' on' : '') })); }
      const lb = svgEl('text', { y: R + 18, class: 'tr-name' }); lb.textContent = nd.name; g.appendChild(lb);
      const tip = nd.desc + (nd.skill ? ' · Mana ' + nd.mp + ' · Recarga ' + nd.cd / 1000 + 's · Tecla ' + (5 + bi) : ' · ' + r + '/' + nd.max) + (!unlocked ? ' · Precisa de ' + TREE_REQ[i] + ' pontos em ' + b.name + '.' : can ? ' · Clique para aprender.' : '');
      g.addEventListener('mouseenter', () => { $('tree-info').innerHTML = '<b>' + nd.name + '</b> — ' + tip; });
      g.addEventListener('click', () => { if (can) Net.send({ t: 'tlearn', id: nd.id }); else if (!unlocked) showToast('Gaste ' + TREE_REQ[i] + ' pontos em ' + b.name + ' para liberar.'); else if (!free) showToast('Sem pontos livres: suba de nível.'); });
      svg.appendChild(g);
    });
  });
  box.appendChild(svg);
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
