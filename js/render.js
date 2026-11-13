// ============================================================
//  DESENHO — tudo é desenhado com formas (sem imagens), em
//  projeção isométrica: cada tile é um losango de 64x32 pixels.
// ============================================================
const TW = 64, TH = 32;

// posição do tile (x, y) na tela, sem câmera
function iso(x, y) { return { sx: (x - y) * TW / 2, sy: (x + y) * TH / 2 }; }

// tela -> tile (inverso do iso)
function unIso(px, py) {
  const a = px / (TW / 2), b = py / (TH / 2);
  return { x: (a + b) / 2, y: (b - a) / 2 };
}

const GROUND_COLORS = {
  [T.SAND]: ['#d9c58c', '#d2bd82', '#dfcc95'],
  [T.GRASS]: ['#5c9e3d', '#57983a', '#62a542'],
  [T.FOREST]: ['#417f2e', '#3c792b', '#468632'],
  [T.STONE]: ['#a3a3a0', '#989894'],
  [T.DIRT]: ['#9b7549', '#94703f', '#a07b4f'],
  [T.BRIDGE]: ['#8b5a2b', '#7d5126'],
};

function diamond(ctx, sx, sy, grow = 0) {
  ctx.beginPath();
  ctx.moveTo(sx, sy - TH / 2 - grow);
  ctx.lineTo(sx + TW / 2 + grow * 2, sy);
  ctx.lineTo(sx, sy + TH / 2 + grow);
  ctx.lineTo(sx - TW / 2 - grow * 2, sy);
  ctx.closePath();
}

function drawGround(ctx, x, y, sx, sy, now) {
  const i = y * MAP_W + x, g = WORLD.ground[i];
  if (g === T.WATER) {
    const w = Math.sin(now / 700 + x * 0.7 + y * 0.4);
    ctx.fillStyle = w > 0.6 ? '#3a7cc0' : '#2f6db0';
    diamond(ctx, sx, sy, 0.6); ctx.fill();
    if (w > 0.85) {
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(sx - 10, sy); ctx.quadraticCurveTo(sx, sy - 4, sx + 10, sy); ctx.stroke();
    }
    return;
  }
  const pal = GROUND_COLORS[g];
  let c;
  if (g === T.STONE) c = pal[(x + y) & 1];
  else c = pal[Math.floor(hash2(x, y, 11) * pal.length)];
  ctx.fillStyle = c;
  diamond(ctx, sx, sy, 0.6); ctx.fill();

  if (g === T.BRIDGE) {
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1;
    for (let k = -1; k <= 1; k++) {
      ctx.beginPath(); ctx.moveTo(sx - 16 + k * 10, sy - 8 + k * 5 + 8); ctx.lineTo(sx + 16 + k * 10 - 20, sy + 8 + k * 5 - 8 + 8); ctx.stroke();
    }
  } else if (g === T.GRASS || g === T.FOREST) {
    // tufos de grama
    if (hash2(x, y, 3) < 0.4) {
      ctx.strokeStyle = 'rgba(30,70,20,0.45)'; ctx.lineWidth = 1;
      const ox = (hash2(x, y, 5) - 0.5) * 30, oy = (hash2(x, y, 6) - 0.5) * 10;
      ctx.beginPath();
      ctx.moveTo(sx + ox - 2, sy + oy); ctx.lineTo(sx + ox - 3, sy + oy - 4);
      ctx.moveTo(sx + ox, sy + oy); ctx.lineTo(sx + ox, sy + oy - 5);
      ctx.moveTo(sx + ox + 2, sy + oy); ctx.lineTo(sx + ox + 3, sy + oy - 4);
      ctx.stroke();
    }
  }
  // borda de areia/terra perto da água: leve sombra
  ctx.strokeStyle = 'rgba(0,0,0,0.06)'; ctx.lineWidth = 1;
  diamond(ctx, sx, sy); ctx.stroke();

  // flores são "chão": desenhadas aqui para não precisar ordenar
  if (WORLD.obj[i] === O.FLOWER) {
    const cols = ['#f472b6', '#facc15', '#f8fafc', '#a78bfa'];
    for (let k = 0; k < 3; k++) {
      ctx.fillStyle = cols[Math.floor(hash2(x + k, y, 21) * cols.length)];
      const ox = (hash2(x, y, 30 + k) - 0.5) * 34, oy = (hash2(x, y, 40 + k) - 0.5) * 12;
      ctx.beginPath(); ctx.arc(sx + ox, sy + oy, 2.2, 0, Math.PI * 2); ctx.fill();
    }
  }
}

function shadow(ctx, sx, sy, rx, ry) {
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(sx, sy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
}

function drawObject(ctx, type, x, y, sx, sy, now) {
  switch (type) {
    case O.TREE: {
      shadow(ctx, sx, sy + 2, 18, 7);
      ctx.fillStyle = '#6b4423'; ctx.fillRect(sx - 3, sy - 22, 6, 22);
      const s = 0.85 + hash2(x, y, 8) * 0.3;
      ctx.fillStyle = '#2f6b25';
      ctx.beginPath(); ctx.arc(sx, sy - 34 * s, 17 * s, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(sx - 10 * s, sy - 26 * s, 11 * s, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(sx + 10 * s, sy - 26 * s, 11 * s, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(140,210,90,0.35)';
      ctx.beginPath(); ctx.arc(sx - 5 * s, sy - 39 * s, 8 * s, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case O.PINE: {
      shadow(ctx, sx, sy + 2, 14, 6);
      ctx.fillStyle = '#5a3a1e'; ctx.fillRect(sx - 3, sy - 12, 6, 12);
      ctx.fillStyle = '#1f5130';
      for (let k = 0; k < 3; k++) {
        const top = sy - 30 - k * 13, half = 17 - k * 4;
        ctx.beginPath(); ctx.moveTo(sx, top - 14); ctx.lineTo(sx + half, top + 10); ctx.lineTo(sx - half, top + 10); ctx.closePath(); ctx.fill();
      }
      break;
    }
    case O.ROCK: {
      shadow(ctx, sx, sy + 2, 14, 5);
      ctx.fillStyle = '#7d7d7a';
      ctx.beginPath(); ctx.moveTo(sx - 13, sy + 2); ctx.lineTo(sx - 9, sy - 10); ctx.lineTo(sx + 2, sy - 15); ctx.lineTo(sx + 12, sy - 7); ctx.lineTo(sx + 13, sy + 2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#9b9b97';
      ctx.beginPath(); ctx.moveTo(sx - 9, sy - 10); ctx.lineTo(sx + 2, sy - 15); ctx.lineTo(sx + 3, sy - 6); ctx.lineTo(sx - 6, sy - 3); ctx.closePath(); ctx.fill();
      break;
    }
    case O.BUSH: {
      shadow(ctx, sx, sy + 1, 12, 4);
      ctx.fillStyle = '#3d8a33';
      ctx.beginPath(); ctx.arc(sx - 6, sy - 5, 7, 0, Math.PI * 2); ctx.arc(sx + 6, sy - 5, 7, 0, Math.PI * 2); ctx.arc(sx, sy - 10, 8, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case O.FOUNTAIN: {
      ctx.fillStyle = '#7a7a78';
      ctx.beginPath(); ctx.ellipse(sx, sy, 26, 13, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#4b8fd6';
      ctx.beginPath(); ctx.ellipse(sx, sy - 2, 21, 10, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#8d8d8a'; ctx.fillRect(sx - 3, sy - 22, 6, 20);
      ctx.fillStyle = 'rgba(200,230,255,0.8)';
      for (let k = 0; k < 6; k++) {
        const t = ((now / 900) + k / 6) % 1;
        const ang = k * Math.PI / 3;
        const px = sx + Math.cos(ang) * 16 * t, py = sy - 24 + t * 22 - Math.sin(t * Math.PI) * 12 + Math.sin(ang) * 5 * t;
        ctx.beginPath(); ctx.arc(px, py, 2, 0, Math.PI * 2); ctx.fill();
      }
      break;
    }
    case O.LAMP: {
      const g = ctx.createRadialGradient(sx, sy - 40, 2, sx, sy - 40, 46);
      g.addColorStop(0, 'rgba(255,220,120,0.45)'); g.addColorStop(1, 'rgba(255,220,120,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy - 40, 46, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#333'; ctx.fillRect(sx - 2, sy - 40, 4, 40);
      ctx.fillStyle = '#ffe28a'; ctx.fillRect(sx - 5, sy - 48, 10, 9);
      break;
    }
  }
}

// ---------- personagens ----------
function drawHuman(ctx, sx, sy, o, now) {
  const step = o.walking ? Math.sin(now / 60) * 3 : 0;
  shadow(ctx, sx, sy + 1, 11, 4);
  // pernas
  ctx.fillStyle = o.legs || '#3b2f2a';
  ctx.fillRect(sx - 5, sy - 10 + Math.max(0, step), 4, 10 - Math.max(0, step));
  ctx.fillRect(sx + 1, sy - 10 + Math.max(0, -step), 4, 10 - Math.max(0, -step));
  // corpo
  const bw = o.big ? 18 : 14;
  ctx.fillStyle = o.body;
  ctx.beginPath(); ctx.roundRect(sx - bw / 2, sy - 26, bw, 17, 4); ctx.fill();
  // braços
  ctx.fillStyle = o.skin;
  ctx.fillRect(sx - bw / 2 - 3, sy - 24 - step * 0.5, 3, 11);
  ctx.fillRect(sx + bw / 2, sy - 24 + step * 0.5, 3, 11);
  // cabeça
  ctx.fillStyle = o.skin;
  ctx.beginPath(); ctx.arc(sx, sy - 32, 7, 0, Math.PI * 2); ctx.fill();
  if (o.hair) {
    ctx.fillStyle = o.hair;
    ctx.beginPath(); ctx.arc(sx, sy - 34, 7, Math.PI, Math.PI * 2); ctx.fill();
  }
  // olhos
  ctx.fillStyle = o.eyes || '#222';
  const f = o.face || 1;
  ctx.fillRect(sx + f * 1 - 1, sy - 33, 2, 2);
  ctx.fillRect(sx + f * 4 - 1, sy - 33, 2, 2);
  if (o.weapon) {
    ctx.strokeStyle = o.weapon; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(sx + f * (bw / 2 + 2), sy - 14); ctx.lineTo(sx + f * (bw / 2 + 8), sy - 32); ctx.stroke();
  }
}

function drawMonster(ctx, e, sx, sy, now) {
  const f = e.face || 1;
  switch (e.type) {
    case 'rat': {
      shadow(ctx, sx, sy + 1, 11, 4);
      ctx.strokeStyle = '#c9a0a0'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(sx - f * 9, sy - 4); ctx.quadraticCurveTo(sx - f * 18, sy - 2, sx - f * 16, sy - 10); ctx.stroke();
      ctx.fillStyle = '#857a70';
      ctx.beginPath(); ctx.ellipse(sx, sy - 6, 11, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(sx + f * 10, sy - 8, 5, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#d9a5a5'; ctx.beginPath(); ctx.arc(sx + f * 7, sy - 13, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#111'; ctx.fillRect(sx + f * 11, sy - 10, 2, 2);
      return 18;
    }
    case 'slime': {
      const b = Math.sin(now / 200 + e.id) * 2;
      shadow(ctx, sx, sy + 1, 13, 5);
      ctx.fillStyle = 'rgba(80,200,90,0.9)';
      ctx.beginPath(); ctx.ellipse(sx, sy - 9 - b / 2, 13 + b, 10 - b, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.arc(sx - 5, sy - 14 - b, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#123'; ctx.fillRect(sx - 4, sy - 11 - b / 2, 2, 3); ctx.fillRect(sx + 3, sy - 11 - b / 2, 2, 3);
      return 22;
    }
    case 'wolf': {
      const leg = e.walking ? Math.sin(now / 50) * 2 : 0;
      shadow(ctx, sx, sy + 1, 15, 5);
      ctx.fillStyle = '#5d616a';
      ctx.fillRect(sx - 10, sy - 8 + leg, 3, 8 - leg); ctx.fillRect(sx + 7, sy - 8 - leg, 3, 8 + leg);
      ctx.beginPath(); ctx.ellipse(sx, sy - 12, 14, 7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(sx + f * 13, sy - 17, 7, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(sx + f * 10, sy - 21); ctx.lineTo(sx + f * 12, sy - 28); ctx.lineTo(sx + f * 15, sy - 21); ctx.fill();
      ctx.beginPath(); ctx.moveTo(sx - f * 13, sy - 14); ctx.lineTo(sx - f * 22, sy - 20); ctx.lineTo(sx - f * 13, sy - 10); ctx.fill();
      ctx.fillStyle = '#fbbf24'; ctx.fillRect(sx + f * 15 - 1, sy - 19, 2, 2);
      return 30;
    }
    case 'skeleton':
      drawHuman(ctx, sx, sy, { walking: e.walking, face: f, body: '#d9d4c3', skin: '#ece8da', legs: '#cfc9b6', eyes: '#c0262d', weapon: '#9ca3af' }, now);
      return 42;
    case 'orc':
      drawHuman(ctx, sx, sy, { walking: e.walking, face: f, big: true, body: '#6b4a2b', skin: '#5f8a43', legs: '#3d2b1a', hair: '#1c1c1c', eyes: '#f43f5e', weapon: '#7c5a35' }, now);
      return 42;
  }
  return 30;
}

function drawBar(ctx, sx, sy, frac) {
  const w = 28;
  ctx.fillStyle = '#000'; ctx.fillRect(sx - w / 2 - 1, sy - 1, w + 2, 5);
  ctx.fillStyle = frac > 0.6 ? '#22c55e' : frac > 0.3 ? '#eab308' : '#ef4444';
  ctx.fillRect(sx - w / 2, sy, w * Math.max(0, Math.min(1, frac)), 3);
}

function drawName(ctx, sx, sy, text, color) {
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.lineWidth = 3; ctx.strokeStyle = '#000';
  ctx.strokeText(text, sx, sy);
  ctx.fillStyle = color; ctx.fillText(text, sx, sy);
}

function drawBubble(ctx, sx, sy, text) {
  ctx.font = '12px system-ui, sans-serif';
  const w = Math.min(220, ctx.measureText(text).width) + 12;
  ctx.fillStyle = 'rgba(255,255,240,0.95)';
  ctx.beginPath(); ctx.roundRect(sx - w / 2, sy - 20, w, 18, 6); ctx.fill();
  ctx.fillStyle = '#222'; ctx.textAlign = 'center';
  ctx.fillText(text, sx, sy - 7, 214);
}

// ---------- cena completa ----------
function renderScene(ctx, W, H, now) {
  const me = G.me;
  const cam = iso(me.rx, me.ry);
  const ox = Math.round(W / 2 - cam.sx), oy = Math.round(H / 2 - cam.sy);
  G.view = { ox, oy };

  ctx.fillStyle = '#1d4f86';
  ctx.fillRect(0, 0, W, H);

  // 1) chão
  const items = [];
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const sx = (x - y) * TW / 2 + ox, sy = (x + y) * TH / 2 + oy;
      if (sx < -TW || sx > W + TW || sy < -TH || sy > H + 80) continue;
      drawGround(ctx, x, y, sx, sy, now);
      const o = WORLD.obj[y * MAP_W + x];
      if (o !== O.NONE && o !== O.FLOWER) items.push({ d: x + y, k: 0, x, y, o, sx, sy });
    }
  }

  // marcador do tile sob o mouse
  if (G.hover && inBounds(G.hover.x, G.hover.y)) {
    const p = iso(G.hover.x, G.hover.y);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.5;
    diamond(ctx, p.sx + ox, p.sy + oy); ctx.stroke();
  }
  // marcador do alvo
  const tgt = G.target && G.monsters[G.target];
  if (tgt) {
    const p = iso(tgt.rx, tgt.ry);
    ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2;
    diamond(ctx, p.sx + ox, p.sy + oy, -2); ctx.stroke();
  }
  // destino do caminho
  if (G.path && G.path.length) {
    const last = G.path[G.path.length - 1], p = iso(last.x, last.y);
    ctx.strokeStyle = 'rgba(250,204,21,0.7)'; ctx.lineWidth = 1.5;
    diamond(ctx, p.sx + ox, p.sy + oy, -6); ctx.stroke();
  }

  // 2) objetos + personagens ordenados por profundidade (x + y)
  const addEnt = (e, kind) => {
    const p = iso(e.rx, e.ry);
    const sx = p.sx + ox, sy = p.sy + oy;
    if (sx < -60 || sx > W + 60 || sy < -60 || sy > H + 80) return;
    items.push({ d: Math.max(e.x + e.y, e.fromX + e.fromY) + 0.5, k: kind, e, sx, sy });
  };
  for (const id in G.monsters) addEnt(G.monsters[id], 1);
  for (const id in G.players) addEnt(G.players[id], 2);
  items.sort((a, b) => a.d - b.d || a.k - b.k);

  const labels = [];
  for (const it of items) {
    if (it.k === 0) { drawObject(ctx, it.o, it.x, it.y, it.sx, it.sy, now); continue; }
    const e = it.e;
    if (it.k === 1) {
      const h = drawMonster(ctx, e, it.sx, it.sy, now);
      labels.push({ sx: it.sx, sy: it.sy - h - 8, name: MON[e.type].name, color: e.id === G.target ? '#fca5a5' : '#e5e7eb', hp: e.hp / e.maxHp });
    } else {
      drawHuman(ctx, it.sx, it.sy, { walking: e.walking, face: e.face, body: e.color, skin: '#f1c27d', hair: '#4a2f1b', legs: '#2d2a3a' }, now);
      labels.push({ sx: it.sx, sy: it.sy - 50, name: `${e.name} [${e.lvl}]`, color: e.id === G.myId ? '#fde68a' : '#93c5fd', hp: e.hp / e.maxHp, say: e.sayUntil > now ? e.say : null });
    }
  }
  // nomes e barras por cima de tudo
  for (const l of labels) {
    drawBar(ctx, l.sx, l.sy + 3, l.hp);
    drawName(ctx, l.sx, l.sy, l.name, l.color);
    if (l.say) drawBubble(ctx, l.sx, l.sy - 12, l.say);
  }

  // 3) projéteis (bola de fogo)
  G.projs = G.projs.filter(p => now - p.t0 < 350);
  for (const p of G.projs) {
    const t = (now - p.t0) / 350;
    const a = iso(p.x1, p.y1), b = iso(p.x2, p.y2);
    const sx = a.sx + (b.sx - a.sx) * t + ox, sy = a.sy + (b.sy - a.sy) * t + oy - 22 - Math.sin(t * Math.PI) * 20;
    const g = ctx.createRadialGradient(sx, sy, 1, sx, sy, 12);
    g.addColorStop(0, '#fff7cc'); g.addColorStop(0.4, '#fb923c'); g.addColorStop(1, 'rgba(239,68,68,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, 12, 0, Math.PI * 2); ctx.fill();
  }

  // 4) textos flutuantes (dano, xp, cura)
  G.fx = G.fx.filter(f => now - f.t0 < 1300);
  ctx.font = 'bold 14px system-ui, sans-serif'; ctx.textAlign = 'center';
  for (const f of G.fx) {
    const t = (now - f.t0) / 1300;
    const p = iso(f.x, f.y);
    const sx = p.sx + ox + (f.dx || 0), sy = p.sy + oy - 40 - t * 34;
    ctx.globalAlpha = 1 - t * t;
    ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.strokeText(f.text, sx, sy);
    ctx.fillStyle = f.color; ctx.fillText(f.text, sx, sy);
    ctx.globalAlpha = 1;
  }
}

// ---------- minimapa ----------
const MINI = (() => {
  const c = document.createElement('canvas');
  c.width = MAP_W; c.height = MAP_H;
  const m = c.getContext('2d');
  const cols = { [T.WATER]: '#2f6db0', [T.SAND]: '#d9c58c', [T.GRASS]: '#5c9e3d', [T.FOREST]: '#3a7029', [T.STONE]: '#bdbdb8', [T.DIRT]: '#9b7549', [T.BRIDGE]: '#8b5a2b' };
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const i = y * MAP_W + x;
    m.fillStyle = BLOCKING.has(WORLD.obj[i]) && WORLD.obj[i] !== O.LAMP ? '#2a5220' : cols[WORLD.ground[i]];
    m.fillRect(x, y, 1, 1);
  }
  return c;
})();

function renderMinimap(ctx, size) {
  const s = size / MAP_W;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(MINI, 0, 0, size, size);
  ctx.fillStyle = '#ef4444';
  for (const id in G.monsters) { const e = G.monsters[id]; ctx.fillRect(e.x * s, e.y * s, s, s); }
  for (const id in G.players) {
    const e = G.players[id];
    ctx.fillStyle = id === G.myId ? '#fff' : '#60a5fa';
    ctx.fillRect(e.x * s - s, e.y * s - s, s * 3, s * 3);
  }
}
