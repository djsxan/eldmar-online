// ============================================================
//  RENDER — desenha o mundo em projeção isométrica.
//  Cada tile é um losango de 64x32 pixels (antes do zoom).
// ============================================================
const TW = 64, TH = 32;
let ZOOM = 2;

function iso(x, y) { return { sx: (x - y) * TW / 2, sy: (x + y) * TH / 2 }; }
function unIso(px, py) { const a = px / (TW / 2), b = py / (TH / 2); return { x: (a + b) / 2, y: (b - a) / 2 }; }
function wind(x, y, now) { return Math.sin(now / 1400 + x * 0.37 + y * 0.21) + Math.sin(now / 530 + x * 1.1) * 0.35; }

// ---------- cores pré-calculadas do chão ----------
function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
function mixRgb(a, b, t) { return `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`; }
const PAL = {
  [T.GRASS]: ['#4c8a32', '#6cad48'], [T.FOREST]: ['#30622a', '#457f33'], [T.SAND]: ['#c9b177', '#e4d29c'],
  [T.STONE]: ['#83837e', '#a6a6a0'], [T.DIRT]: ['#80603a', '#a47b4e'], [T.BRIDGE]: ['#77502a', '#966835'],
  [T.COBBLE]: ['#8a857b', '#a9a397'], [T.SWAMP]: ['#3b4628', '#55603a'], [T.DEAD]: ['#857a4c', '#a39562'],
};
const ZONE_GRASS = { [Z.FOREST]: ['#3a7230', '#4f8d3c'], [Z.ORCS]: ['#6b8a3a', '#86a24a'], [Z.BONES]: ['#6e7a4a', '#8a9060'], [Z.SWAMP]: ['#476a33', '#5d7d40'] };
const TILE_COL = new Array(MAP_W * MAP_H);
const SHORE = new Uint8Array(MAP_W * MAP_H);   // bits: 1=(x,y-1) 2=(x+1,y) 4=(x,y+1) 8=(x-1,y) são terra
const DEPTH = new Uint8Array(MAP_W * MAP_H);
(function precompute() {
  const isLand = (x, y) => inBounds(x, y) && WORLD.ground[y * MAP_W + x] !== T.WATER;
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const i = y * MAP_W + x, g = WORLD.ground[i];
    if (g === T.WATER) {
      let s = 0;
      if (isLand(x, y - 1)) s |= 1; if (isLand(x + 1, y)) s |= 2; if (isLand(x, y + 1)) s |= 4; if (isLand(x - 1, y)) s |= 8;
      SHORE[i] = s;
      let d = 3;
      for (let r = 1; r <= 3 && d === 3; r++) for (let k = -r; k <= r; k++) if (isLand(x + k, y - r) || isLand(x + k, y + r) || isLand(x - r, y + k) || isLand(x + r, y + k)) { d = r - 1; break; }
      DEPTH[i] = d;
      continue;
    }
    let pal = PAL[g];
    if (g === T.GRASS && ZONE_GRASS[WORLD.zone[i]]) pal = ZONE_GRASS[WORLD.zone[i]];
    const t = Math.min(1, Math.max(0, fbm(x / 6, y / 6, 123) * 1.4 - 0.2 + (hash2(x, y, 11) - 0.5) * 0.18));
    TILE_COL[i] = mixRgb(hexRgb(pal[0]), hexRgb(pal[1]), t);
  }
})();

function diamond(ctx, sx, sy, grow = 0) {
  ctx.beginPath();
  ctx.moveTo(sx, sy - TH / 2 - grow);
  ctx.lineTo(sx + TW / 2 + grow * 2, sy);
  ctx.lineTo(sx, sy + TH / 2 + grow);
  ctx.lineTo(sx - TW / 2 - grow * 2, sy);
  ctx.closePath();
}

// ---------- chão ----------
function drawGround(ctx, x, y, sx, sy, now) {
  const i = y * MAP_W + x, g = WORLD.ground[i];
  if (g === T.WATER) { drawWater(ctx, x, y, i, sx, sy, now); return; }
  ctx.fillStyle = TILE_COL[i];
  diamond(ctx, sx, sy, 0.7); ctx.fill();
  const h = (k) => hash2(x, y, k);

  switch (g) {
    case T.GRASS: case T.FOREST: {
      const n = g === T.FOREST ? 4 : 3;
      ctx.strokeStyle = g === T.FOREST ? 'rgba(20,50,15,0.5)' : 'rgba(35,80,25,0.45)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let k = 0; k < n; k++) {
        const ox = (h(5 + k) - 0.5) * 40, oy = (h(9 + k) - 0.5) * 14;
        if (Math.abs(ox) / 32 + Math.abs(oy) / 16 > 0.85) continue;
        const w = wind(x + k, y, now) * 1.2;
        ctx.moveTo(sx + ox - 2, sy + oy); ctx.lineTo(sx + ox - 3 + w, sy + oy - 4);
        ctx.moveTo(sx + ox, sy + oy); ctx.lineTo(sx + ox + w, sy + oy - 5.5);
        ctx.moveTo(sx + ox + 2, sy + oy); ctx.lineTo(sx + ox + 3 + w, sy + oy - 4);
      }
      ctx.stroke();
      if (h(14) < 0.3) { ctx.fillStyle = 'rgba(255,255,200,0.12)'; ctx.beginPath(); ctx.ellipse(sx + (h(15) - 0.5) * 20, sy + (h(16) - 0.5) * 8, 8, 3, 0, 0, 7); ctx.fill(); }
      if (g === T.FOREST && h(17) < 0.5) { ctx.fillStyle = 'rgba(120,80,30,0.45)'; for (let k = 0; k < 3; k++) { ctx.fillRect(sx + (h(20 + k) - 0.5) * 34, sy + (h(25 + k) - 0.5) * 12, 2, 1.2); } }
      break;
    }
    case T.SAND:
      ctx.fillStyle = 'rgba(140,110,60,0.35)';
      for (let k = 0; k < 4; k++) ctx.fillRect(sx + (h(5 + k) - 0.5) * 36, sy + (h(9 + k) - 0.5) * 12, 1.4, 1.4);
      if (h(3) < 0.15) { ctx.fillStyle = '#f5ede0'; ctx.beginPath(); ctx.ellipse(sx + 5, sy + 2, 2.2, 1.4, 0.5, 0, 7); ctx.fill(); }
      break;
    case T.DIRT: case T.DEAD:
      ctx.fillStyle = g === T.DIRT ? 'rgba(60,40,20,0.35)' : 'rgba(90,80,40,0.4)';
      for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.ellipse(sx + (h(5 + k) - 0.5) * 36, sy + (h(9 + k) - 0.5) * 12, 2, 1.2, 0, 0, 7); ctx.fill(); }
      if (g === T.DEAD) {
        ctx.strokeStyle = 'rgba(180,160,90,0.7)'; ctx.lineWidth = 1; ctx.beginPath();
        const ox = (h(30) - 0.5) * 26, w = wind(x, y, now) * 0.8;
        ctx.moveTo(sx + ox, sy); ctx.lineTo(sx + ox - 2 + w, sy - 5); ctx.moveTo(sx + ox + 1, sy); ctx.lineTo(sx + ox + 2 + w, sy - 6);
        ctx.stroke();
      }
      break;
    case T.COBBLE: {
      ctx.strokeStyle = 'rgba(60,55,50,0.45)'; ctx.lineWidth = 0.8;
      const st = [[-14, 0], [-4, -6], [8, -3], [16, 1], [-6, 4], [5, 5], [-1, -1]];
      for (let k = 0; k < st.length; k++) {
        const [a, b] = st[k];
        ctx.fillStyle = h(40 + k) < 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';
        ctx.beginPath(); ctx.ellipse(sx + a, sy + b, 5, 2.6, 0, 0, 7); ctx.fill(); ctx.stroke();
      }
      break;
    }
    case T.STONE:
      ctx.strokeStyle = 'rgba(50,50,50,0.35)'; ctx.lineWidth = 0.8; ctx.beginPath();
      ctx.moveTo(sx - 10 + h(3) * 6, sy - 3); ctx.lineTo(sx, sy + 1); ctx.lineTo(sx + 8, sy - 2 + h(4) * 4); ctx.stroke();
      break;
    case T.SWAMP: {
      ctx.fillStyle = 'rgba(90,120,50,0.35)';
      ctx.beginPath(); ctx.ellipse(sx + (h(5) - 0.5) * 20, sy + (h(6) - 0.5) * 8, 9, 3.5, 0, 0, 7); ctx.fill();
      const t = ((now / 2200) + h(7)) % 1;
      if (h(8) < 0.5 && t < 0.4) { ctx.strokeStyle = `rgba(160,190,110,${0.6 - t * 1.5})`; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.ellipse(sx + (h(9) - 0.5) * 24, sy + (h(10) - 0.5) * 8, 1 + t * 8, 0.5 + t * 4, 0, 0, 7); ctx.stroke(); }
      break;
    }
    case T.BRIDGE: {
      // estradas leste-oeste ficam nas linhas y = CENTER e CENTER+1
      const alongX = y === CENTER || y === CENTER + 1;
      const ax = alongX ? [32, 16] : [-32, 16], px = alongX ? [-32, 16] : [32, 16];
      ctx.strokeStyle = 'rgba(40,25,10,0.55)'; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let k = -2; k <= 2; k++) {
        const t = k / 5, cx = sx + ax[0] * t, cy = sy + ax[1] * t;
        ctx.moveTo(cx - px[0] * 0.45, cy - px[1] * 0.45); ctx.lineTo(cx + px[0] * 0.45, cy + px[1] * 0.45);
      }
      ctx.stroke();
      break;
    }
  }

  const o = WORLD.obj[i];
  if (FLAT.has(o)) drawFlat(ctx, o, x, y, sx, sy, now);
}

function drawWater(ctx, x, y, i, sx, sy, now) {
  const d = DEPTH[i];
  const base = ['#3a8fbf', '#2c76ae', '#235f9a', '#1d5089'][d];
  ctx.fillStyle = base;
  diamond(ctx, sx, sy, 0.7); ctx.fill();
  const w = Math.sin(now / 900 + x * 0.6 + y * 0.35) + Math.sin(now / 1300 - x * 0.3 + y * 0.8) * 0.6;
  if (w > 0.7) {
    ctx.strokeStyle = `rgba(255,255,255,${(w - 0.7) * 0.35})`; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(sx - 12, sy + 1); ctx.quadraticCurveTo(sx - 2, sy - 4, sx + 10, sy + 1); ctx.stroke();
  }
  if (hash2(x, y, 77) < 0.12) {
    const t = ((now / 1700) + hash2(x, y, 78)) % 1;
    if (t < 0.15) { ctx.fillStyle = `rgba(255,255,255,${0.9 - t * 6})`; ctx.fillRect(sx + (hash2(x, y, 79) - 0.5) * 30, sy + (hash2(x, y, 80) - 0.5) * 10, 2, 1); }
  }
  const s = SHORE[i];
  if (s) {
    const f = 0.45 + Math.sin(now / 600 + x + y) * 0.25;
    ctx.strokeStyle = `rgba(235,250,255,${f})`; ctx.lineWidth = 2;
    const top = [sx, sy - 16], right = [sx + 32, sy], bot = [sx, sy + 16], left = [sx - 32, sy];
    const k = 0.82 + Math.sin(now / 600 + x * 2 + y) * 0.06;
    const shrink = (a, b) => [sx + (a[0] - sx) * k, sy + (a[1] - sy) * k, sx + (b[0] - sx) * k, sy + (b[1] - sy) * k];
    ctx.beginPath();
    const edge = (a, b) => { const q = shrink(a, b); ctx.moveTo(q[0], q[1]); ctx.lineTo(q[2], q[3]); };
    if (s & 1) edge(top, right); if (s & 2) edge(right, bot); if (s & 4) edge(bot, left); if (s & 8) edge(left, top);
    ctx.stroke();
  }
  if (WORLD.obj[i] === O.LILY) drawFlat(ctx, O.LILY, x, y, sx, sy, now);
}

function drawFlat(ctx, o, x, y, sx, sy, now) {
  const h = (k) => hash2(x, y, k);
  if (o === O.FLOWER) {
    const cols = ['#f472b6', '#facc15', '#f8fafc', '#a78bfa', '#fb7185', '#60a5fa'];
    for (let k = 0; k < 5; k++) {
      const fx = sx + (h(30 + k) - 0.5) * 36, fy = sy + (h(40 + k) - 0.5) * 12, w = wind(x + k, y, now) * 0.8;
      ctx.strokeStyle = '#2f6b22'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx + w, fy - 4); ctx.stroke();
      ctx.fillStyle = cols[Math.floor(h(20 + k) * cols.length)];
      for (let p = 0; p < 4; p++) { const a = p * Math.PI / 2; ctx.beginPath(); ctx.arc(fx + w + Math.cos(a) * 1.4, fy - 4 + Math.sin(a) * 1, 1.2, 0, 7); ctx.fill(); }
      ctx.fillStyle = '#fde047'; ctx.beginPath(); ctx.arc(fx + w, fy - 4, 0.8, 0, 7); ctx.fill();
    }
  } else if (o === O.FLOWERBED) {
    ctx.fillStyle = '#5b3d22'; diamond(ctx, sx, sy, -5); ctx.fill();
    const cols = ['#ef4444', '#f59e0b', '#ec4899', '#f8fafc'];
    for (let k = 0; k < 8; k++) {
      const fx = sx + (h(50 + k) - 0.5) * 30, fy = sy + (h(60 + k) - 0.5) * 9;
      ctx.fillStyle = '#2f6b22'; ctx.fillRect(fx - 0.5, fy - 4, 1, 4);
      ctx.fillStyle = cols[k % 4]; ctx.beginPath(); ctx.arc(fx, fy - 5, 2, 0, 7); ctx.fill();
    }
  } else if (o === O.LILY) {
    const fx = sx + (h(3) - 0.5) * 16, fy = sy + (h(4) - 0.5) * 6 + Math.sin(now / 900 + x) * 0.8;
    ctx.fillStyle = '#3f8f3a'; ctx.beginPath(); ctx.ellipse(fx, fy, 7, 3.5, 0, 0.4, Math.PI * 2 - 0.1); ctx.lineTo(fx, fy); ctx.fill();
    ctx.fillStyle = '#5fb050'; ctx.beginPath(); ctx.ellipse(fx + 8, fy + 3, 4.5, 2.2, 0, 0, 7); ctx.fill();
    if (h(5) < 0.5) { ctx.fillStyle = '#f9a8d4'; ctx.beginPath(); ctx.arc(fx - 1, fy - 1.5, 2.2, 0, 7); ctx.fill(); ctx.fillStyle = '#fde047'; ctx.beginPath(); ctx.arc(fx - 1, fy - 1.8, 0.8, 0, 7); ctx.fill(); }
  } else if (o === O.BONES) {
    ctx.fillStyle = '#e7e2d0';
    ctx.save(); ctx.translate(sx + (h(3) - 0.5) * 14, sy + (h(4) - 0.5) * 5); ctx.rotate(h(5) * 3);
    ctx.fillRect(-6, -0.8, 12, 1.6); ctx.beginPath(); ctx.arc(-6, -1, 1.3, 0, 7); ctx.arc(-6, 1, 1.3, 0, 7); ctx.arc(6, -1, 1.3, 0, 7); ctx.arc(6, 1, 1.3, 0, 7); ctx.fill();
    ctx.restore();
    if (h(6) < 0.4) { ctx.beginPath(); ctx.arc(sx + 8, sy - 2, 3.2, 0, 7); ctx.fill(); ctx.fillStyle = '#222'; ctx.fillRect(sx + 6.5, sy - 3, 1.2, 1.2); ctx.fillRect(sx + 8.5, sy - 3, 1.2, 1.2); }
  }
}

// ---------- objetos ----------
function drawTree(ctx, x, y, sx, sy, now) {
  const s = 0.85 + hash2(x, y, 8) * 0.35, w = wind(x, y, now) * 1.6;
  shadowAt(ctx, sx + 4, sy + 2, 20 * s, 7 * s);
  // tronco com raízes
  ctx.fillStyle = '#5b3a1e';
  ctx.beginPath(); ctx.moveTo(sx - 4, sy); ctx.lineTo(sx - 2.5, sy - 24 * s); ctx.lineTo(sx + 2.5, sy - 24 * s); ctx.lineTo(sx + 4, sy); ctx.closePath(); ctx.fill();
  poly(ctx, [sx - 4, sy, sx - 8, sy + 2, sx - 2, sy - 3], '#5b3a1e'); poly(ctx, [sx + 4, sy, sx + 8, sy + 1.5, sx + 2, sy - 3], '#4a2f17');
  line(ctx, sx - 1, sy - 4, sx - 0.5, sy - 18 * s, '#3f2814', 0.8); line(ctx, sx + 1.5, sy - 8, sx + 1.2, sy - 20 * s, '#7a5634', 0.6);
  const cy = sy - 36 * s, dk = '#2b5e22', md = '#3d7a2c', lt = '#5a9b3e';
  const blobs = [[-11, 6, 11], [11, 6, 11], [0, 0, 15], [-7, -9, 10], [8, -8, 10], [0, -15, 9]];
  for (const [bx, by, r] of blobs) circ(ctx, sx + bx * s + w * (1 - by / 30) * 0.6, cy + by * s, r * s, dk);
  for (const [bx, by, r] of blobs) circ(ctx, sx + bx * s - 1.5 + w * 0.8, cy + by * s - 2, r * s * 0.78, md);
  for (const [bx, by, r] of blobs.slice(2)) circ(ctx, sx + bx * s - 3 + w, cy + by * s - 4, r * s * 0.42, lt);
  if (hash2(x, y, 9) < 0.25) for (let k = 0; k < 4; k++) circ(ctx, sx + (hash2(x, y, 60 + k) - 0.5) * 24 * s + w, cy + (hash2(x, y, 70 + k) - 0.3) * 18 * s, 1.6, '#dc2626');
}

function drawObject(ctx, type, x, y, sx, sy, now) {
  const h = (k) => hash2(x, y, k);
  switch (type) {
    case O.TREE: drawTree(ctx, x, y, sx, sy, now); break;
    case O.PINE: {
      const s = 0.85 + h(8) * 0.4, w = wind(x, y, now) * 1.2;
      shadowAt(ctx, sx + 3, sy + 2, 15 * s, 6 * s);
      rect(ctx, sx - 2.5, sy - 12, 5, 12, '#4a2f17');
      for (let k = 0; k < 4; k++) {
        const top = sy - 22 * s - k * 11 * s, half = (18 - k * 3.6) * s, sway = w * (k + 1) * 0.35;
        poly(ctx, [sx + sway, top - 14 * s, sx + half + sway * 0.5, top + 8, sx - half + sway * 0.5, top + 8], '#1d4a2b');
        poly(ctx, [sx + sway, top - 14 * s, sx + sway * 0.5, top + 8, sx - half + sway * 0.5, top + 8], '#163d23');
        line(ctx, sx - half * 0.6 + sway * 0.5, top + 5, sx + half * 0.7 + sway * 0.5, top + 6, 'rgba(120,180,120,0.25)', 1);
      }
      break;
    }
    case O.ROCK: {
      const s = 0.8 + h(8) * 0.5;
      shadowAt(ctx, sx + 2, sy + 2, 15 * s, 5 * s);
      poly(ctx, [sx - 14 * s, sy + 2, sx - 10 * s, sy - 10 * s, sx + 1, sy - 16 * s, sx + 12 * s, sy - 8 * s, sx + 14 * s, sy + 2], '#6f6f6b');
      poly(ctx, [sx - 10 * s, sy - 10 * s, sx + 1, sy - 16 * s, sx + 3, sy - 6 * s, sx - 6 * s, sy - 2], '#9a9a95');
      poly(ctx, [sx + 3, sy - 6 * s, sx + 12 * s, sy - 8 * s, sx + 14 * s, sy + 2, sx + 2, sy + 2], '#5b5b57');
      if (h(9) < 0.5) ell(ctx, sx - 4 * s, sy - 10 * s, 5 * s, 2 * s, 'rgba(80,130,50,0.8)');
      break;
    }
    case O.BUSH: {
      const w = wind(x, y, now);
      shadowAt(ctx, sx, sy + 1, 13, 4);
      for (const [bx, by, r, c] of [[-6, -5, 7, '#2f6e29'], [6, -5, 7, '#2f6e29'], [0, -10, 8, '#3c8233'], [-3, -12, 4, '#56a043']]) circ(ctx, sx + bx + w * (by < -8 ? 1 : 0.4), sy + by, r, c);
      if (h(9) < 0.4) for (let k = 0; k < 5; k++) circ(ctx, sx + (h(20 + k) - 0.5) * 18 + w, sy - 4 - h(30 + k) * 10, 1.3, h(10) < 0.5 ? '#7c3aed' : '#dc2626');
      break;
    }
    case O.TALLGRASS: {
      const dry = zoneAt(x, y) === Z.BONES;
      for (let k = 0; k < 8; k++) {
        const bx = sx + (h(10 + k) - 0.5) * 26, by = sy + (h(20 + k) - 0.5) * 8, ht = 8 + h(30 + k) * 8;
        const w = wind(x + k * 0.3, y, now) * 2.5;
        ctx.strokeStyle = dry ? (k % 2 ? '#b8a46a' : '#9c8a52') : (k % 2 ? '#3f8a30' : '#57a540');
        ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(bx + w * 0.3, by - ht * 0.6, bx + w, by - ht); ctx.stroke();
      }
      break;
    }
    case O.MUSHROOM: {
      const glow = zoneAt(x, y) === Z.SWAMP || zoneAt(x, y) === Z.FOREST && h(3) < 0.4;
      for (let k = 0; k < 3; k++) {
        const mx = sx + (h(10 + k) - 0.5) * 22, my = sy + (h(20 + k) - 0.5) * 8, s = 0.7 + h(30 + k) * 0.6;
        rect(ctx, mx - 1.2 * s, my - 5 * s, 2.4 * s, 5 * s, '#f5f0e1');
        ctx.fillStyle = glow ? '#38bdf8' : '#dc2626';
        ctx.beginPath(); ctx.ellipse(mx, my - 5 * s, 4.5 * s, 3 * s, 0, Math.PI, 0); ctx.fill();
        circ(ctx, mx - 1.5 * s, my - 6.5 * s, 0.8 * s, '#fff'); circ(ctx, mx + 1.8 * s, my - 6 * s, 0.6 * s, '#fff');
      }
      if (glow) G.lights.push({ x: sx, y: sy - 4, r: 26, c: '56,189,248', a: 0.5 });
      break;
    }
    case O.REEDS: {
      for (let k = 0; k < 6; k++) {
        const bx = sx + (h(10 + k) - 0.5) * 22, by = sy + (h(20 + k) - 0.5) * 6, ht = 14 + h(30 + k) * 10, w = wind(x + k, y, now) * 2;
        ctx.strokeStyle = '#5d7a2e'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(bx, by - ht * 0.5, bx + w, by - ht); ctx.stroke();
        if (k % 2 === 0) { ctx.fillStyle = '#5b3a1e'; ctx.beginPath(); ctx.ellipse(bx + w, by - ht + 1, 1.6, 3.5, w * 0.05, 0, 7); ctx.fill(); }
      }
      break;
    }
    case O.STUMP:
      shadowAt(ctx, sx, sy + 1, 10, 4);
      rect(ctx, sx - 7, sy - 8, 14, 8, '#5b3a1e'); ell(ctx, sx, sy, 7, 2.5, '#4a2f17');
      ell(ctx, sx, sy - 8, 7, 3, '#b08a5a'); ell(ctx, sx, sy - 8, 4, 1.7, '#9a7448'); ell(ctx, sx, sy - 8, 1.5, 0.7, '#7a5634');
      break;
    case O.LOG:
      shadowAt(ctx, sx, sy + 2, 18, 5);
      ctx.save(); ctx.translate(sx, sy - 4); ctx.rotate(h(3) < 0.5 ? 0.45 : -0.45);
      rrect(ctx, -16, -4, 30, 8, 4, '#6b4423'); line(ctx, -12, -1, 10, -1, '#4a2f17', 0.8);
      ell(ctx, 14, 0, 3, 4, '#b08a5a'); ell(ctx, 14, 0, 1.5, 2, '#8a6a42');
      if (h(4) < 0.5) circ(ctx, -6, -4, 2.5, 'rgba(80,130,50,0.8)');
      ctx.restore();
      break;
    case O.DEADTREE: {
      const w = wind(x, y, now) * 0.5;
      shadowAt(ctx, sx + 3, sy + 2, 14, 5);
      ctx.strokeStyle = '#4b3b2e'; ctx.lineCap = 'round';
      ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + 1, sy - 30); ctx.stroke();
      ctx.lineWidth = 2.5; ctx.beginPath();
      ctx.moveTo(sx + 1, sy - 22); ctx.quadraticCurveTo(sx - 8, sy - 30, sx - 13 + w, sy - 40);
      ctx.moveTo(sx + 1, sy - 28); ctx.quadraticCurveTo(sx + 9, sy - 34, sx + 12 + w, sy - 44);
      ctx.moveTo(sx + 1, sy - 30); ctx.lineTo(sx - 1 + w, sy - 46);
      ctx.stroke();
      ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(sx - 8, sy - 33); ctx.lineTo(sx - 4 + w, sy - 38); ctx.moveTo(sx + 9, sy - 37); ctx.lineTo(sx + 15 + w, sy - 38); ctx.stroke();
      ctx.lineCap = 'butt';
      break;
    }
    case O.GRAVE:
      ell(ctx, sx, sy + 1, 12, 5, '#5c5340');
      rrect(ctx, sx - 6, sy - 18, 12, 18, [6, 6, 0, 0], '#8e8e88');
      rrect(ctx, sx - 6, sy - 18, 5, 18, [6, 0, 0, 0], '#a8a8a2');
      rect(ctx, sx - 1, sy - 15, 2, 9, '#5f5f5a'); rect(ctx, sx - 3.5, sy - 12.5, 7, 2, '#5f5f5a');
      if (h(3) < 0.5) ell(ctx, sx + 3, sy - 2, 4, 1.6, 'rgba(80,120,50,0.8)');
      break;
    case O.TENT:
      shadowAt(ctx, sx, sy + 3, 26, 9);
      poly(ctx, [sx - 24, sy + 2, sx, sy - 34, sx + 2, sy + 10], '#7a5634');
      poly(ctx, [sx + 2, sy + 10, sx, sy - 34, sx + 24, sy + 2], '#5f4126');
      poly(ctx, [sx - 4, sy + 6, sx, sy - 14, sx + 5, sy + 7], '#2a1a0e');
      line(ctx, sx, sy - 34, sx - 3, sy - 42, '#3b2a1e', 1.6); line(ctx, sx, sy - 34, sx + 4, sy - 41, '#3b2a1e', 1.6);
      for (let k = 0; k < 3; k++) line(ctx, sx - 20 + k * 6, sy + 1 - k * 4, sx - 10 + k * 3, sy - 6 - k * 5, '#4a3020', 0.8);
      poly(ctx, [sx + 4, sy - 41, sx + 14 + wind(x, y, now) * 2, sy - 39, sx + 4, sy - 36], '#991b1b');
      break;
    case O.CAMPFIRE: {
      for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2; ell(ctx, sx + Math.cos(a) * 9, sy + Math.sin(a) * 4.5, 3, 2, '#6b6b66'); }
      line(ctx, sx - 6, sy + 1, sx + 6, sy - 2, '#4a2f17', 2.5); line(ctx, sx - 6, sy - 2, sx + 6, sy + 1, '#3b2414', 2.5);
      drawFlame(ctx, sx, sy - 1, 1.2, now, x);
      G.lights.push({ x: sx, y: sy - 8, r: 90, c: '255,150,60', a: 0.9, flick: true });
      if (Math.random() < 0.08) spawnPart('smoke', sx - G.view.ox, sy - 16 - G.view.oy);
      if (Math.random() < 0.1) spawnPart('ember', sx - G.view.ox, sy - 8 - G.view.oy);
      break;
    }
    case O.FENCE: {
      const i = y * MAP_W + x, isF = j => WORLD.obj[j] === O.FENCE || WORLD.obj[j] === O.TORCH;
      const alongX = isF(i - 1) || isF(i + 1);
      const dx = alongX ? 8 : -8;
      for (const k of [-1, 0, 1]) {
        const px = sx + dx * k * 1.6, py = sy + 4 * k * 1.6;
        rect(ctx, px - 2.5, py - 20, 5, 20, k === 0 ? '#7a5634' : '#6b4a2b');
        poly(ctx, [px - 2.5, py - 20, px, py - 25, px + 2.5, py - 20], '#8a6440');
        rect(ctx, px - 2.5, py - 20, 1.5, 20, 'rgba(255,255,255,0.1)');
      }
      line(ctx, sx - dx * 1.6, sy - 4 * 1.6 - 13, sx + dx * 1.6, sy + 4 * 1.6 - 13, '#4a2f17', 2);
      line(ctx, sx - dx * 1.6, sy - 4 * 1.6 - 6, sx + dx * 1.6, sy + 4 * 1.6 - 6, '#4a2f17', 2);
      break;
    }
    case O.TORCH:
      rect(ctx, sx - 2, sy - 26, 4, 26, '#4a2f17');
      rect(ctx, sx - 3.5, sy - 28, 7, 4, '#6b6b66');
      drawFlame(ctx, sx, sy - 28, 0.6, now, x + y);
      G.lights.push({ x: sx, y: sy - 32, r: 80, c: '255,170,80', a: 0.9, flick: true });
      if (Math.random() < 0.03) spawnPart('ember', sx - G.view.ox, sy - 34 - G.view.oy);
      break;
    case O.LAMP:
      shadowAt(ctx, sx, sy + 1, 6, 2.5);
      rect(ctx, sx - 3, sy - 3, 6, 3, '#1f2937');
      rect(ctx, sx - 1.5, sy - 40, 3, 38, '#27272a');
      line(ctx, sx, sy - 40, sx + 7, sy - 42, '#27272a', 1.8);
      poly(ctx, [sx + 3, sy - 42, sx + 11, sy - 42, sx + 10, sy - 50, sx + 4, sy - 50], 'rgba(255,220,140,0.9)');
      poly(ctx, [sx + 2, sy - 50, sx + 12, sy - 50, sx + 7, sy - 54], '#27272a');
      G.lights.push({ x: sx + 7, y: sy - 46, r: 100, c: '255,215,140', a: 1, flick: true });
      break;
    case O.FOUNTAIN: {
      ell(ctx, sx, sy + 2, 30, 15, 'rgba(0,0,0,0.2)');
      ell(ctx, sx, sy, 28, 14, '#8b8b86'); ell(ctx, sx, sy - 3, 28, 14, '#a8a8a2');
      ell(ctx, sx, sy - 3, 23, 11, '#3b82c4');
      const sh = Math.sin(now / 400) * 0.1;
      ell(ctx, sx - 6, sy - 6, 8, 2.5, `rgba(255,255,255,${0.25 + sh})`);
      rect(ctx, sx - 4, sy - 22, 8, 19, '#9a9a95'); rect(ctx, sx - 4, sy - 22, 3, 19, '#b8b8b2');
      ell(ctx, sx, sy - 22, 9, 4, '#a8a8a2'); ell(ctx, sx, sy - 23, 7, 3, '#3b82c4');
      rect(ctx, sx - 1.5, sy - 32, 3, 10, '#b8b8b2');
      for (let k = 0; k < 10; k++) {
        const t = ((now / 1000) + k / 10) % 1, a = k * Math.PI / 5;
        const px = sx + Math.cos(a) * 18 * t, py = sy - 32 + t * 28 - Math.sin(t * Math.PI) * 14 + Math.sin(a) * 6 * t;
        circ(ctx, px, py, 1.6, `rgba(210,235,255,${0.9 - t * 0.5})`);
      }
      break;
    }
    case O.BARREL:
      shadowAt(ctx, sx, sy + 1, 9, 3.5);
      rrect(ctx, sx - 7, sy - 17, 14, 17, 4, '#7a4f26');
      rect(ctx, sx - 7, sy - 14, 14, 1.5, '#3f3f46'); rect(ctx, sx - 7, sy - 5, 14, 1.5, '#3f3f46');
      rect(ctx, sx - 7, sy - 17, 4, 17, 'rgba(255,255,255,0.08)');
      ell(ctx, sx, sy - 17, 7, 2.5, '#94632f');
      break;
    case O.CRATE:
      shadowAt(ctx, sx, sy + 1, 11, 4);
      poly(ctx, [sx - 11, sy - 5, sx, sy, sx, sy - 13, sx - 11, sy - 18], '#a0743f');
      poly(ctx, [sx, sy, sx + 11, sy - 5, sx + 11, sy - 18, sx, sy - 13], '#7a5634');
      poly(ctx, [sx - 11, sy - 18, sx, sy - 13, sx + 11, sy - 18, sx, sy - 23], '#c09060');
      line(ctx, sx - 11, sy - 5, sx, sy - 13, '#5b3a1e', 1); line(ctx, sx + 11, sy - 5, sx, sy - 13, '#4a2f17', 1);
      break;
    case O.HAY:
      shadowAt(ctx, sx, sy + 2, 15, 5);
      ell(ctx, sx, sy - 8, 15, 10, '#d4b04c'); ell(ctx, sx - 2, sy - 11, 11, 6, '#e6c862');
      for (let k = 0; k < 8; k++) line(ctx, sx - 12 + k * 3, sy - 4 - h(k) * 8, sx - 11 + k * 3 + wind(x, y, now), sy - 8 - h(k + 9) * 8, '#b8922e', 0.7);
      break;
    case O.WELL:
      shadowAt(ctx, sx, sy + 2, 15, 6);
      ell(ctx, sx, sy - 2, 13, 6.5, '#7d7d78'); rect(ctx, sx - 13, sy - 10, 26, 8, '#8e8e88');
      ell(ctx, sx, sy - 10, 13, 6.5, '#a8a8a2'); ell(ctx, sx, sy - 10, 9.5, 4.5, '#1e3a5f');
      rect(ctx, sx - 12, sy - 34, 2.5, 24, '#5b3a1e'); rect(ctx, sx + 9.5, sy - 34, 2.5, 24, '#5b3a1e');
      poly(ctx, [sx - 16, sy - 32, sx, sy - 42, sx + 16, sy - 32], '#8b3a2a');
      line(ctx, sx - 10, sy - 30, sx + 10, sy - 30, '#4a2f17', 1.5); line(ctx, sx + 2, sy - 30, sx + 2, sy - 20, '#d6c9a8', 0.8);
      rrect(ctx, sx - 1, sy - 21, 6, 5, 1, '#6b4423');
      break;
    case O.STALL: {
      shadowAt(ctx, sx, sy + 2, 18, 6);
      rect(ctx, sx - 15, sy - 30, 2, 28, '#5b3a1e'); rect(ctx, sx + 13, sy - 30, 2, 28, '#5b3a1e');
      poly(ctx, [sx - 17, sy - 12, sx, sy - 4, sx + 17, sy - 12, sx, sy - 20], '#8a6440');
      rect(ctx, sx - 17, sy - 12, 17, 6, '#6b4a2b');
      const cols = ['#ef4444', '#facc15', '#22c55e', '#f97316'];
      for (let k = 0; k < 6; k++) circ(ctx, sx - 10 + k * 4, sy - 14 + (k % 2) * 2, 2.2, cols[k % 4]);
      for (let k = 0; k < 6; k++) poly(ctx, [sx - 19 + k * 6.5, sy - 30 + k * 0.5, sx - 12.5 + k * 6.5, sy - 30 + k * 0.5, sx - 13 + k * 6.5, sy - 24, sx - 19.5 + k * 6.5, sy - 24], k % 2 ? '#f8fafc' : '#b91c1c');
      break;
    }
    case O.BENCH:
      shadowAt(ctx, sx, sy + 1, 14, 4);
      poly(ctx, [sx - 14, sy - 7, sx + 2, sy + 1, sx + 6, sy - 1, sx - 10, sy - 9], '#8a6440');
      rect(ctx, sx - 12, sy - 7, 2, 6, '#4a2f17'); rect(ctx, sx + 3, sy - 1, 2, 5, '#4a2f17');
      poly(ctx, [sx - 14, sy - 7, sx + 2, sy + 1, sx + 2, sy - 6, sx - 14, sy - 14], '#7a5634');
      break;
    case O.BANNER: {
      rect(ctx, sx - 1.5, sy - 46, 3, 46, '#4a2f17'); circ(ctx, sx, sy - 47, 2.2, '#e7c158');
      const w = wind(x, y, now);
      ctx.fillStyle = '#1e3a8a';
      ctx.beginPath(); ctx.moveTo(sx + 1, sy - 44); ctx.lineTo(sx + 14 + w, sy - 43);
      ctx.quadraticCurveTo(sx + 15 + w * 2, sy - 32, sx + 14 + w * 2.5, sy - 22); ctx.lineTo(sx + 8 + w * 2, sy - 26); ctx.lineTo(sx + 1, sy - 22); ctx.fill();
      circ(ctx, sx + 8 + w, sy - 35, 3, '#e7c158');
      break;
    }
    case O.SPIKES:
      for (const [a, b] of [[-8, 2], [0, -2], [8, 2]]) { line(ctx, sx + a - 5, sy + b, sx + a + 4, sy + b - 16, '#6b4a2b', 2.5); line(ctx, sx + a + 5, sy + b, sx + a - 4, sy + b - 16, '#5b3a1e', 2.5); }
      break;
  }
}

function drawFlame(ctx, x, y, s, now, seed) {
  const f = Math.sin(now / 70 + seed) * 1.5, f2 = Math.cos(now / 90 + seed) * 1.2;
  ctx.fillStyle = 'rgba(239,68,68,0.85)';
  ctx.beginPath(); ctx.moveTo(x - 7 * s, y); ctx.quadraticCurveTo(x - 6 * s, y - 10 * s, x + f * s, y - 20 * s); ctx.quadraticCurveTo(x + 6 * s, y - 10 * s, x + 7 * s, y); ctx.fill();
  ctx.fillStyle = 'rgba(251,146,60,0.95)';
  ctx.beginPath(); ctx.moveTo(x - 4.5 * s, y); ctx.quadraticCurveTo(x - 4 * s, y - 7 * s, x + f2 * s, y - 14 * s); ctx.quadraticCurveTo(x + 4 * s, y - 7 * s, x + 4.5 * s, y); ctx.fill();
  ctx.fillStyle = 'rgba(254,240,138,0.95)';
  ctx.beginPath(); ctx.ellipse(x, y - 3 * s, 2.5 * s, 4 * s, 0, 0, 7); ctx.fill();
}

// ---------- construções ----------
function drawBuilding(ctx, b, ox, oy, now, night) {
  const x0 = b.x - 0.5, x1 = b.x + b.w - 0.5, y0 = b.y - 0.5, y1 = b.y + b.h - 0.5;
  const P = (x, y, z = 0) => { const p = iso(x, y); return [p.sx + ox, p.sy + oy - z]; };
  const H = b.wall;
  const style = {
    temple: { wall: '#e8e2d2', wallR: '#c9c2b0', roof: '#2f5591', roofR: '#24457a', trim: '#e7c158' },
    shop: { wall: '#f0e2c0', wallR: '#d6c59e', roof: '#a33a2c', roofR: '#842d22', trim: '#5b3a1f' },
    tavern: { wall: '#ead7b0', wallR: '#cdb88f', roof: '#6e4524', roofR: '#57361b', trim: '#4a2f17' },
    house: { wall: '#efe5cc', wallR: '#d3c7a8', roof: b.x % 2 ? '#7c3a2d' : '#4f6b3a', roofR: b.x % 2 ? '#622d22' : '#3e552d', trim: '#5b3a1f' },
  }[b.kind];
  const L = (u, z) => { const a = P(x0 + (x1 - x0) * u, y1, z); return a; };      // face esquerda (frente-esquerda)
  const R = (u, z) => { const a = P(x1, y1 - (y1 - y0) * u, z); return a; };      // face direita (frente-direita)
  const quad = (F, u0, u1, z0, z1, color) => {
    const a = F(u0, z0), bb = F(u1, z0), c = F(u1, z1), d = F(u0, z1);
    poly(ctx, [a[0], a[1], bb[0], bb[1], c[0], c[1], d[0], d[1]], color);
  };
  // sombra
  const s0 = P(x0, y1, 0), s1 = P(x1 + 0.8, y1 + 0.3, 0), s2 = P(x1 + 0.8, y0 + 0.3, 0);
  poly(ctx, [s0[0], s0[1], s1[0], s1[1], s2[0], s2[1]], 'rgba(0,0,0,0.22)');
  // base de pedra
  const base = b.kind === 'temple' ? 0 : 8;
  quad(L, 0, 1, 0, H, style.wall);
  quad(R, 0, 1, 0, H, style.wallR);
  if (base) { quad(L, 0, 1, 0, base, '#8b8b86'); quad(R, 0, 1, 0, base, '#6f6f6b'); }
  // linhas de tijolo / enxaimel
  if (b.kind === 'temple') {
    ctx.strokeStyle = 'rgba(120,110,90,0.35)'; ctx.lineWidth = 0.8;
    for (let z = 8; z < H; z += 8) { for (const F of [L, R]) { const a = F(0, z), c = F(1, z); line(ctx, a[0], a[1], c[0], c[1], 'rgba(120,110,90,0.35)', 0.8); } }
    // colunas
    for (const u of [0.08, 0.3, 0.7, 0.92]) { quad(L, u - 0.035, u + 0.035, 0, H - 4, '#f8f5ec'); quad(L, u - 0.05, u + 0.05, H - 6, H - 2, style.trim); }
  } else {
    for (const F of [L, R]) {
      const cnt = F === L ? b.w : b.h;
      for (let k = 0; k <= cnt; k++) { const a = F(k / cnt, base), c = F(k / cnt, H); line(ctx, a[0], a[1], c[0], c[1], style.trim, 2); }
      const a = F(0, base + (H - base) * 0.5), c = F(1, base + (H - base) * 0.5); line(ctx, a[0], a[1], c[0], c[1], style.trim, 2);
      const a2 = F(0, H - 1), c2 = F(1, H - 1); line(ctx, a2[0], a2[1], c2[0], c2[1], style.trim, 2.5);
      for (let k = 0; k < cnt; k++) { const p1 = F(k / cnt, base), p2 = F((k + 1) / cnt, base + (H - base) * 0.5); line(ctx, p1[0], p1[1], p2[0], p2[1], style.trim, 1.3); }
    }
  }
  // janelas (acendem à noite)
  const winCol = night ? 'rgba(255,200,110,0.95)' : '#33475b';
  const windows = b.kind === 'temple' ? [[R, 0.25], [R, 0.75]] : b.kind === 'house' ? [[R, 0.5], [L, 0.25]] : [[R, 0.3], [R, 0.72], [L, 0.18], [L, 0.82]];
  const wz0 = b.kind === 'temple' ? H * 0.35 : base + (H - base) * 0.58, wz1 = b.kind === 'temple' ? H * 0.8 : base + (H - base) * 0.88;
  for (const [F, u] of windows) {
    const ww = 0.42 / (F === L ? b.w : b.h);
    quad(F, u - ww - 0.02, u + ww + 0.02, wz0 - 2, wz1 + 2, style.trim);
    quad(F, u - ww, u + ww, wz0, wz1, b.kind === 'temple' ? (night ? 'rgba(180,200,255,0.95)' : '#5b7db8') : winCol);
    if (b.kind === 'temple') { const c = F(u, (wz0 + wz1) / 2); circ(ctx, c[0], c[1], 2.5, night ? '#fde68a' : '#e7c158'); }
    else { const t = F(u, wz0), tt = F(u, wz1); line(ctx, t[0], t[1], tt[0], tt[1], style.trim, 1); }
    if (night) { const c = F(u, (wz0 + wz1) / 2); G.lights.push({ x: c[0], y: c[1] + 6, r: 55, c: b.kind === 'temple' ? '190,210,255' : '255,190,100', a: 0.8 }); }
  }
  // porta
  const du = 0.5, dw = 0.55 / b.w;
  quad(L, du - dw - 0.025, du + dw + 0.025, 0, (b.kind === 'temple' ? 34 : 26) + 2, style.trim);
  quad(L, du - dw, du + dw, 0, b.kind === 'temple' ? 34 : 26, b.kind === 'temple' ? '#7a4f26' : '#5b3a1e');
  { const k = L(du + dw * 0.6, 12); circ(ctx, k[0], k[1], 1.2, '#e7c158'); }
  // telhado
  const o = 0.35, rz = H + b.roof;
  const ridgeX = b.w >= b.h;
  let pts;
  if (ridgeX) {
    const ym = (y0 + y1) / 2, hw = (y1 - y0) / 2;
    const A = P(x0 - o, y0 - o, H), Bp = P(x1 + o, y0 - o, H), Cp = P(x1 + o, y1 + o, H), D = P(x0 - o, y1 + o, H);
    const r1 = P(x0 + hw * 0.6, ym, rz), r2 = P(x1 - hw * 0.6, ym, rz);
    poly(ctx, [A[0], A[1], Bp[0], Bp[1], r2[0], r2[1], r1[0], r1[1]], style.roofR);
    poly(ctx, [A[0], A[1], r1[0], r1[1], D[0], D[1]], style.roofR);
    poly(ctx, [Bp[0], Bp[1], Cp[0], Cp[1], r2[0], r2[1]], style.roofR);
    poly(ctx, [D[0], D[1], Cp[0], Cp[1], r2[0], r2[1], r1[0], r1[1]], style.roof);
    for (let k = 1; k < 5; k++) { const t = k / 5; line(ctx, D[0] + (r1[0] - D[0]) * t, D[1] + (r1[1] - D[1]) * t, Cp[0] + (r2[0] - Cp[0]) * t, Cp[1] + (r2[1] - Cp[1]) * t, 'rgba(0,0,0,0.18)', 1); }
    line(ctx, r1[0], r1[1], r2[0], r2[1], shade(style.roof.startsWith('#') ? style.roof : '#555555', 0.25), 2);
    pts = { top: r1, top2: r2 };
  } else {
    const xm = (x0 + x1) / 2, hw = (x1 - x0) / 2;
    const A = P(x0 - o, y0 - o, H), Bp = P(x1 + o, y0 - o, H), Cp = P(x1 + o, y1 + o, H), D = P(x0 - o, y1 + o, H);
    const r1 = P(xm, y0 + hw * 0.6, rz), r2 = P(xm, y1 - hw * 0.6, rz);
    poly(ctx, [A[0], A[1], r1[0], r1[1], r2[0], r2[1], D[0], D[1]], style.roofR);
    poly(ctx, [A[0], A[1], Bp[0], Bp[1], r1[0], r1[1]], style.roofR);
    poly(ctx, [D[0], D[1], Cp[0], Cp[1], r2[0], r2[1]], style.roof);
    poly(ctx, [Bp[0], Bp[1], Cp[0], Cp[1], r2[0], r2[1], r1[0], r1[1]], style.roofR);
    for (let k = 1; k < 5; k++) { const t = k / 5; line(ctx, Bp[0] + (r1[0] - Bp[0]) * t, Bp[1] + (r1[1] - Bp[1]) * t, Cp[0] + (r2[0] - Cp[0]) * t, Cp[1] + (r2[1] - Cp[1]) * t, 'rgba(0,0,0,0.18)', 1); }
    line(ctx, r1[0], r1[1], r2[0], r2[1], 'rgba(255,255,255,0.25)', 2);
    pts = { top: r1, top2: r2 };
  }
  const mid = [(pts.top[0] + pts.top2[0]) / 2, (pts.top[1] + pts.top2[1]) / 2];
  // extras por tipo
  if (b.kind === 'temple') {
    // torre com sino e sol dourado
    const tx = mid[0], ty = mid[1];
    rect(ctx, tx - 7, ty - 26, 14, 26, '#e8e2d2'); rect(ctx, tx, ty - 26, 7, 26, '#c9c2b0');
    rrect(ctx, tx - 4, ty - 22, 8, 10, [4, 4, 0, 0], '#3a3226');
    circ(ctx, tx, ty - 15, 2.6, '#c99a2e');
    poly(ctx, [tx - 10, ty - 26, tx, ty - 46, tx + 10, ty - 26], '#2f5591');
    poly(ctx, [tx, ty - 26, tx, ty - 46, tx + 10, ty - 26], '#24457a');
    circ(ctx, tx, ty - 50, 4, '#e7c158');
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 + now / 3000; line(ctx, tx + Math.cos(a) * 5, ty - 50 + Math.sin(a) * 5, tx + Math.cos(a) * 8, ty - 50 + Math.sin(a) * 8, '#e7c158', 1.2); }
    if (night) G.lights.push({ x: tx, y: ty - 50, r: 40, c: '255,220,120', a: 0.6 });
  }
  if (b.kind === 'tavern' || b.kind === 'house') {
    const c = P(x0 + (x1 - x0) * 0.3, y0 + (y1 - y0) * 0.35, H + b.roof * 0.75);
    rect(ctx, c[0] - 4, c[1] - 16, 8, 18, '#7d7d78'); rect(ctx, c[0], c[1] - 16, 4, 18, '#5f5f5a'); rect(ctx, c[0] - 5, c[1] - 18, 10, 3, '#5f5f5a');
    if (Math.random() < (b.kind === 'tavern' ? 0.12 : 0.05)) spawnPart('smoke', c[0] - ox, c[1] - oy - 20);
  }
  // placa
  if (b.kind === 'shop' || b.kind === 'tavern') {
    const p = L(0.82, base + (H - base) * 0.45);
    line(ctx, p[0], p[1] - 4, p[0] + 10, p[1] - 1, '#27272a', 1.5);
    const sw = Math.sin(now / 800) * 0.08;
    ctx.save(); ctx.translate(p[0] + 9, p[1]); ctx.rotate(sw);
    rrect(ctx, -7, 0, 14, 11, 2, '#7a4f26'); rrect(ctx, -6, 1, 12, 9, 1.5, '#a0743f');
    if (b.kind === 'shop') { circ(ctx, 0, 5.5, 3.2, '#e7c158'); circ(ctx, 0, 5.5, 1.8, '#c99a2e'); }
    else { rrect(ctx, -3, 2.5, 5, 6, 1, '#e7c158'); rect(ctx, -3, 2, 5, 1.6, '#fef3c7'); ctx.strokeStyle = '#e7c158'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(2.5, 5.5, 1.8, -1.4, 1.4); ctx.stroke(); }
    ctx.restore();
  }
  if (b.kind === 'shop') {
    for (const u of [0.3, 0.72]) {
      const a = R(u - 0.2, wz1 + 4), c = R(u + 0.2, wz1 + 4), d = R(u + 0.2, wz1 - 4), e = R(u - 0.2, wz1 - 4);
      const out = 7;
      poly(ctx, [a[0], a[1], c[0], c[1], d[0] + out, d[1] + out * 0.5, e[0] + out, e[1] + out * 0.5], '#b91c1c');
    }
  }
  return { x: mid[0], y: mid[1] - (b.kind === 'temple' ? 62 : 14) };
}

// ---------- partículas ----------
function spawnPart(kind, x, y, extra) {
  if (G.parts.length > 400) return;
  const p = { kind, x, y, z: 0, vx: 0, vy: 0, vz: 0, t0: performance.now(), life: 1000, size: 2, seed: Math.random() * 100, ...extra };
  switch (kind) {
    case 'smoke': p.life = 2600; p.vx = 0.004; p.vy = -0.012; p.size = 3; break;
    case 'ember': p.life = 900; p.vx = (Math.random() - 0.5) * 0.02; p.vy = -0.04; break;
    case 'leaf': p.life = 4200; p.vy = 0.012; p.vx = 0.008; p.color = Math.random() < 0.5 ? '#6aa84f' : '#c9a227'; break;
    case 'butterfly': p.life = 7000; p.color = pick(['#f472b6', '#fde047', '#93c5fd', '#fdba74', '#fff']); break;
    case 'firefly': p.life = 5000; break;
    case 'spark': p.life = 400 + Math.random() * 300; { const a = Math.random() * Math.PI * 2, s = 0.05 + Math.random() * 0.12; p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s * 0.6 - 0.05; } break;
    case 'sparkle': p.life = 1000; p.vy = -0.03 - Math.random() * 0.02; p.vx = (Math.random() - 0.5) * 0.01; break;
    case 'dust': p.life = 500; p.vx = (Math.random() - 0.5) * 0.02; p.vy = -0.01; p.size = 2.5; break;
    case 'shard': p.life = 700; { const a = Math.random() * Math.PI * 2, s = 0.04 + Math.random() * 0.08; p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s * 0.5 - 0.06; } break;
  }
  G.parts.push(p);
}

function drawParticles(ctx, ox, oy, now, dt) {
  const keep = [];
  for (const p of G.parts) {
    const age = now - p.t0;
    if (age > p.life) continue;
    keep.push(p);
    const t = age / p.life;
    p.x += p.vx * dt; p.y += p.vy * dt;
    let x = p.x + ox, y = p.y + oy;
    switch (p.kind) {
      case 'smoke': circ(ctx, x + Math.sin(age / 500 + p.seed) * 3, y, p.size + t * 9, `rgba(120,120,120,${0.35 * (1 - t)})`); break;
      case 'ember': circ(ctx, x, y, 1.2, `rgba(255,${150 + Math.random() * 80},60,${1 - t})`); G.lights.push({ x, y, r: 10, c: '255,150,60', a: 0.5 * (1 - t) }); break;
      case 'leaf': {
        x += Math.sin(age / 400 + p.seed) * 8;
        ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(age / 300 + p.seed) * 1.2);
        ctx.globalAlpha = t > 0.8 ? (1 - t) * 5 : 1; ell(ctx, 0, 0, 2.6, 1.2, p.color); ctx.restore(); ctx.globalAlpha = 1;
        break;
      }
      case 'butterfly': {
        const bx = x + Math.sin(age / 900 + p.seed) * 30 + Math.sin(age / 230) * 4, by = y + Math.cos(age / 1200 + p.seed) * 14 - 14 - Math.abs(Math.sin(age / 160)) * 3;
        const fl = Math.abs(Math.sin(age / 60));
        ctx.globalAlpha = Math.min(1, (1 - t) * 4, t * 6);
        ell(ctx, bx - 2 * fl, by, 2.4 * fl + 0.4, 1.8, p.color); ell(ctx, bx + 2 * fl, by, 2.4 * fl + 0.4, 1.8, p.color);
        ctx.globalAlpha = 1;
        break;
      }
      case 'firefly': {
        const fx = x + Math.sin(age / 700 + p.seed) * 14, fy = y + Math.cos(age / 900 + p.seed) * 8 - 10;
        const a = Math.max(0, Math.sin(age / 300 + p.seed)) * Math.min(1, (1 - t) * 4);
        circ(ctx, fx, fy, 1.3, `rgba(220,255,120,${a})`);
        G.lights.push({ x: fx, y: fy, r: 16, c: '200,255,120', a: a * 0.8 });
        break;
      }
      case 'spark': circ(ctx, x, y, p.size * (1 - t * 0.5), p.color ? p.color.replace('A', String(1 - t)) : `rgba(255,240,180,${1 - t})`); break;
      case 'sparkle': {
        const a = 1 - t, s = 2.5 * (1 - t * 0.5);
        ctx.fillStyle = (p.color || 'rgba(255,240,150,A)').replace('A', String(a));
        ctx.beginPath(); ctx.moveTo(x, y - s * 1.6); ctx.lineTo(x + s * 0.4, y); ctx.lineTo(x, y + s * 1.6); ctx.lineTo(x - s * 0.4, y); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x - s * 1.6, y); ctx.lineTo(x, y + s * 0.4); ctx.lineTo(x + s * 1.6, y); ctx.lineTo(x, y - s * 0.4); ctx.closePath(); ctx.fill();
        break;
      }
      case 'dust': circ(ctx, x, y, p.size + t * 3, `rgba(180,160,120,${0.4 * (1 - t)})`); break;
      case 'shard': ctx.fillStyle = `rgba(200,235,255,${1 - t})`; ctx.save(); ctx.translate(x, y); ctx.rotate(p.seed); ctx.fillRect(-1, -3, 2, 6); ctx.restore(); break;
    }
  }
  G.parts = keep;
}

function ambientParticles(now, visTrees, visFlowers, visGrass, night) {
  if (G.parts.length > 300) return;
  if (visTrees.length && Math.random() < 0.06) { const t = pick(visTrees); spawnPart('leaf', t.wx + (Math.random() - 0.5) * 24, t.wy - 40); }
  const nb = G.parts.reduce((n, p) => n + (p.kind === 'butterfly'), 0);
  if (!night && visFlowers.length && nb < 6 && Math.random() < 0.03) { const t = pick(visFlowers); spawnPart('butterfly', t.wx, t.wy); }
  const nf = G.parts.reduce((n, p) => n + (p.kind === 'firefly'), 0);
  if (night && visGrass.length && nf < 30 && Math.random() < 0.25) { const t = pick(visGrass); spawnPart('firefly', t.wx + (Math.random() - 0.5) * 30, t.wy); }
}

// ---------- dia e noite (mesmo horário para todos: usa o relógio) ----------
const DAY_CYCLE_MS = 12 * 60 * 1000;
function dayInfo() {
  const ph = (Date.now() % DAY_CYCLE_MS) / DAY_CYCLE_MS;
  const sun = Math.cos(ph * Math.PI * 2);           // 1 = meio-dia, -1 = meia-noite
  const k = Math.min(1, Math.max(0, (0.15 - sun) / 0.65));
  const dark = smooth(k) * 0.72;
  const dusk = Math.max(0, 1 - Math.abs(sun - (-0.05)) / 0.35);
  return { dark, dusk, night: dark > 0.3, phase: ph };
}

// ---------- efeitos de combate (estilo arcade) ----------
function tileW(x, y, z = 0) { const p = iso(x, y); return { x: p.sx, y: p.sy - z }; }

function drawEffects(ctx, ox, oy, now) {
  const keep = [];
  for (const e of G.effects) {
    const age = now - e.t0;
    if (age < 0) { keep.push(e); continue; }
    if (age > e.dur) continue;
    keep.push(e);
    const t = age / e.dur;
    const c = tileW(e.x, e.y);
    const cx = c.x + ox, cy = c.y + oy;
    switch (e.a) {
      case 'proj': {
        const a = e.from, b = tileW(e.tx, e.ty, 20);
        const px = a.x + (b.x - a.x) * t + ox, py = a.y + (b.y - a.y) * t + oy - Math.sin(t * Math.PI) * (e.kind === 'arrow' ? 10 : 6);
        const ang = Math.atan2(b.y - a.y - Math.cos(t * Math.PI) * 10 * (e.kind === 'arrow' ? 1 : 0), b.x - a.x);
        if (e.kind === 'arrow') {
          ctx.save(); ctx.translate(px, py); ctx.rotate(ang);
          line(ctx, -12, 0, 6, 0, '#e7dcc0', 1.4); poly(ctx, [6, -2, 10, 0, 6, 2], '#cbd5e1');
          poly(ctx, [-12, 0, -15, -2.5, -10, 0], '#dc2626'); poly(ctx, [-12, 0, -15, 2.5, -10, 0], '#dc2626');
          ctx.restore();
          line(ctx, px - Math.cos(ang) * 30, py - Math.sin(ang) * 30, px - Math.cos(ang) * 12, py - Math.sin(ang) * 12, 'rgba(255,255,255,0.35)', 1);
        } else if (e.kind === 'bolt') {
          const g = ctx.createRadialGradient(px, py, 0.5, px, py, 9);
          g.addColorStop(0, '#f5f3ff'); g.addColorStop(0.4, 'rgba(167,139,250,0.9)'); g.addColorStop(1, 'rgba(124,58,237,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, 9, 0, 7); ctx.fill();
          if (Math.random() < 0.6) spawnPart('sparkle', px - ox, py - oy, { color: 'rgba(196,181,253,A)', life: 400 });
          G.lights.push({ x: px, y: py, r: 30, c: '167,139,250', a: 0.8 });
        } else if (e.kind === 'fire') {
          const g = ctx.createRadialGradient(px, py, 1, px, py, 15);
          g.addColorStop(0, '#fffbeb'); g.addColorStop(0.3, '#fdba74'); g.addColorStop(0.7, 'rgba(239,68,68,0.7)'); g.addColorStop(1, 'rgba(239,68,68,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, 15, 0, 7); ctx.fill();
          spawnPart('ember', px - ox + (Math.random() - 0.5) * 8, py - oy + (Math.random() - 0.5) * 8);
          G.lights.push({ x: px, y: py, r: 70, c: '255,140,50', a: 1 });
        }
        break;
      }
      case 'whirl': {
        ctx.save(); ctx.translate(cx, cy - 16); ctx.scale(1, 0.5);
        for (let k = 0; k < 2; k++) {
          ctx.strokeStyle = `rgba(255,255,255,${0.8 * (1 - t)})`; ctx.lineWidth = 6 - k * 3;
          ctx.beginPath(); ctx.arc(0, 0, 40 + k * 8, t * 12 + k, t * 12 + k + 3.5); ctx.stroke();
        }
        ctx.restore();
        if (Math.random() < 0.5) spawnPart('dust', c.x + (Math.random() - 0.5) * 60, c.y + (Math.random() - 0.5) * 20);
        break;
      }
      case 'warcry': {
        for (let k = 0; k < 3; k++) {
          const r = (t * 1.2 - k * 0.15) * 160;
          if (r <= 0) continue;
          ctx.strokeStyle = `rgba(248,113,113,${Math.max(0, 0.8 - t)})`; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.ellipse(cx, cy, r, r / 2, 0, 0, 7); ctx.stroke();
        }
        G.lights.push({ x: cx, y: cy - 20, r: 80 * (1 - t), c: '248,113,113', a: 0.7 });
        break;
      }
      case 'wall': case 'agile': case 'potion': {
        const col = e.a === 'wall' ? '253,224,71' : e.a === 'agile' ? '110,231,183' : (e.k === 'hp' ? '248,113,113' : '96,165,250');
        ctx.strokeStyle = `rgba(${col},${1 - t})`; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.ellipse(cx, cy, 10 + t * 30, 5 + t * 15, 0, 0, 7); ctx.stroke();
        if (Math.random() < 0.6) spawnPart('sparkle', c.x + (Math.random() - 0.5) * 24, c.y - Math.random() * 30, { color: `rgba(${col},A)` });
        break;
      }
      case 'pierce': {
        const b = tileW(e.x2, e.y2);
        const g = ctx.createLinearGradient(cx, cy - 20, b.x + ox, b.y + oy - 20);
        g.addColorStop(0, `rgba(187,247,208,${0.9 * (1 - t)})`); g.addColorStop(1, `rgba(187,247,208,0)`);
        ctx.strokeStyle = g; ctx.lineWidth = 6 * (1 - t) + 1;
        ctx.beginPath(); ctx.moveTo(cx, cy - 20); ctx.lineTo(b.x + ox, b.y + oy - 20); ctx.stroke();
        const ax = cx + (b.x + ox - cx) * Math.min(1, t * 2), ay = cy - 20 + (b.y + oy - cy) * Math.min(1, t * 2);
        circ(ctx, ax, ay, 4, '#ecfccb');
        G.lights.push({ x: ax, y: ay, r: 40, c: '187,247,208', a: 0.8 });
        break;
      }
      case 'rain': {
        for (let k = 0; k < 18; k++) {
          const tk = (t * 1.6 - hash2(k, 1, e.seed) * 0.6);
          if (tk < 0 || tk > 1) continue;
          const tx = cx + (hash2(k, 2, e.seed) - 0.5) * 120, ty = cy + (hash2(k, 3, e.seed) - 0.5) * 50;
          const yy = ty - 140 * (1 - tk);
          line(ctx, tx - 3, yy - 14, tx, yy, '#e7dcc0', 1.4); poly(ctx, [tx - 2, yy - 2, tx + 2, yy - 1, tx + 0.6, yy + 3], '#cbd5e1');
          if (tk > 0.95) spawnPart('dust', tx - ox, ty - oy);
        }
        break;
      }
      case 'boom': {
        const r = 10 + easeOut(t) * 34;
        const g = ctx.createRadialGradient(cx, cy - 14, 1, cx, cy - 14, r);
        g.addColorStop(0, `rgba(255,251,235,${1 - t})`); g.addColorStop(0.4, `rgba(251,146,60,${0.9 * (1 - t)})`); g.addColorStop(1, 'rgba(239,68,68,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy - 14, r, 0, 7); ctx.fill();
        if (!e.sp) { e.sp = 1; for (let k = 0; k < 14; k++) spawnPart('spark', c.x, c.y - 14, { color: 'rgba(253,186,116,A)' }); }
        G.lights.push({ x: cx, y: cy - 14, r: 120 * (1 - t), c: '255,150,60', a: 1 });
        break;
      }
      case 'nova': {
        const r = easeOut(t) * 150;
        ctx.save(); ctx.translate(cx, cy);
        ctx.fillStyle = `rgba(186,230,253,${0.35 * (1 - t)})`; ctx.beginPath(); ctx.ellipse(0, 0, r, r / 2, 0, 0, 7); ctx.fill();
        ctx.strokeStyle = `rgba(224,242,254,${1 - t})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, 0, r, r / 2, 0, 0, 7); ctx.stroke();
        for (let k = 0; k < 12; k++) {
          const a = k / 12 * Math.PI * 2, rr = r * 0.85;
          const sx = Math.cos(a) * rr, sy = Math.sin(a) * rr / 2, hgt = 18 * Math.sin(Math.min(1, t * 2) * Math.PI) ;
          poly(ctx, [sx - 3, sy, sx, sy - hgt, sx + 3, sy], `rgba(224,242,254,${0.9 * (1 - t)})`);
        }
        ctx.restore();
        if (!e.sp) { e.sp = 1; for (let k = 0; k < 20; k++) spawnPart('shard', c.x, c.y - 10); }
        G.lights.push({ x: cx, y: cy, r: 140 * (1 - t * 0.5), c: '186,230,253', a: 0.9 * (1 - t) });
        break;
      }
      case 'heal': case 'lvlup': {
        const gold = e.a === 'lvlup';
        const w = gold ? 26 : 18, alpha = Math.sin(t * Math.PI);
        const g = ctx.createLinearGradient(0, cy - 120, 0, cy);
        g.addColorStop(0, `rgba(${gold ? '253,224,71' : '187,247,208'},0)`); g.addColorStop(1, `rgba(${gold ? '253,224,71' : '134,239,172'},${0.55 * alpha})`);
        ctx.fillStyle = g; ctx.fillRect(cx - w / 2, cy - 120, w, 120);
        ctx.strokeStyle = `rgba(${gold ? '253,224,71' : '134,239,172'},${alpha})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(cx, cy, 18 + t * 10, 9 + t * 5, 0, 0, 7); ctx.stroke();
        if (Math.random() < 0.7) spawnPart('sparkle', c.x + (Math.random() - 0.5) * 26, c.y - Math.random() * 20, { color: gold ? 'rgba(253,224,71,A)' : 'rgba(187,247,208,A)' });
        G.lights.push({ x: cx, y: cy - 30, r: 90, c: gold ? '253,224,71' : '134,239,172', a: alpha });
        break;
      }
      case 'meteor': {
        for (let k = 0; k < 5; k++) {
          const st = hash2(k, 4, e.seed) * 0.35, tk = (t - st) / 0.45;
          const tx = cx + (hash2(k, 5, e.seed) - 0.5) * 140, ty = cy + (hash2(k, 6, e.seed) - 0.5) * 60;
          if (tk >= 0 && tk <= 1) {
            const mx = tx - 160 * (1 - tk), my = ty - 260 * (1 - tk);
            line(ctx, mx - 40, my - 65, mx, my, 'rgba(251,146,60,0.6)', 8);
            const g = ctx.createRadialGradient(mx, my, 1, mx, my, 14);
            g.addColorStop(0, '#fffbeb'); g.addColorStop(0.4, '#f97316'); g.addColorStop(1, 'rgba(120,53,15,0)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(mx, my, 14, 0, 7); ctx.fill();
            G.lights.push({ x: mx, y: my, r: 60, c: '255,140,50', a: 1 });
          } else if (tk > 1 && tk < 1.8) {
            const bt = (tk - 1) / 0.8, r = 12 + bt * 40;
            const g = ctx.createRadialGradient(tx, ty - 8, 1, tx, ty - 8, r);
            g.addColorStop(0, `rgba(255,251,235,${1 - bt})`); g.addColorStop(0.5, `rgba(249,115,22,${0.8 * (1 - bt)})`); g.addColorStop(1, 'rgba(127,29,29,0)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(tx, ty - 8, r, 0, 7); ctx.fill();
            if (!e['b' + k]) { e['b' + k] = 1; G.shake = Math.max(G.shake, 6); for (let q = 0; q < 10; q++) spawnPart('spark', tx - ox, ty - oy - 8, { color: 'rgba(253,186,116,A)' }); }
            G.lights.push({ x: tx, y: ty - 8, r: 130 * (1 - bt), c: '255,140,50', a: 1 });
          }
        }
        break;
      }
    }
  }
  G.effects = keep;
}

function drawMagicCircle(ctx, cx, cy, now, el, prog) {
  const col = { fire: '251,146,60', ice: '125,211,252', holy: '253,224,71', wind: '110,231,183', phys: '229,231,235' }[el] || '196,181,253';
  ctx.save(); ctx.translate(cx, cy); ctx.scale(1, 0.5);
  const r = 26 + Math.sin(now / 150) * 1;
  ctx.strokeStyle = `rgba(${col},0.9)`; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.stroke();
  ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, r - 6, 0, 7); ctx.stroke();
  ctx.rotate(now / 600);
  ctx.beginPath();
  for (let k = 0; k < 6; k++) { const a = k * Math.PI * 2 / 6, a2 = a + Math.PI * 2 / 6 * 2; ctx.moveTo(Math.cos(a) * (r - 6), Math.sin(a) * (r - 6)); ctx.lineTo(Math.cos(a2) * (r - 6), Math.sin(a2) * (r - 6)); }
  ctx.stroke();
  for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; ctx.fillStyle = `rgba(${col},0.9)`; ctx.fillRect(Math.cos(a) * (r + 4) - 1.5, Math.sin(a) * (r + 4) - 1.5, 3, 3); }
  ctx.fillStyle = `rgba(${col},${0.12 + prog * 0.2})`; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
  ctx.restore();
  G.lights.push({ x: cx, y: cy - 6, r: 60, c: col, a: 0.6 + prog * 0.4 });
}

function drawAuras(ctx, e, sx, sy, now) {
  const b = e.buffs || {};
  if (b.wall > now) {
    ctx.save(); ctx.translate(sx, sy - 18);
    const a = 0.25 + Math.sin(now / 200) * 0.08;
    ctx.fillStyle = `rgba(253,224,71,${a * 0.5})`; ctx.strokeStyle = `rgba(253,224,71,${a + 0.3})`; ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let k = 0; k < 6; k++) { const an = k * Math.PI / 3 + now / 1000; ctx.lineTo(Math.cos(an) * 20, Math.sin(an) * 24); }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    G.lights.push({ x: sx, y: sy - 18, r: 50, c: '253,224,71', a: 0.5 });
  }
  if (b.agile > now) {
    for (let k = 0; k < 3; k++) {
      const an = now / 150 + k * 2.1;
      ctx.strokeStyle = 'rgba(110,231,183,0.7)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(sx, sy - 3 - k * 4, 14, 5, 0, an, an + 1.6); ctx.stroke();
    }
  }
  if (b.bless > now && Math.random() < 0.05) spawnPart('sparkle', sx - G.view.ox, sy - G.view.oy - Math.random() * 40, { color: 'rgba(253,224,71,A)' });
  if (b.warcry > now) { ctx.strokeStyle = `rgba(248,113,113,${0.4 + Math.sin(now / 120) * 0.2})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(sx, sy, 16, 7, 0, 0, 7); ctx.stroke(); }
}

// ---------- cena completa ----------
const lightCanvas = document.createElement('canvas');
const lctx = lightCanvas.getContext('2d');
let lastFrame = performance.now();

function renderScene(ctx, W, H, now, cam, dpr) {
  const dt = Math.min(50, now - lastFrame); lastFrame = now;
  const Zm = ZOOM, VW = W / Zm, VH = H / Zm;
  const c = iso(cam.x, cam.y);
  let shx = 0, shy = 0;
  if (G.shake > 0.1) { shx = (Math.random() - 0.5) * G.shake; shy = (Math.random() - 0.5) * G.shake; G.shake *= 0.88; }
  const ox = Math.round(VW / 2 - c.sx + shx), oy = Math.round(VH / 2 - c.sy + 14 + shy);
  G.view = { ox, oy };
  G.lights = [];
  const day = dayInfo();

  ctx.save();
  ctx.scale(Zm, Zm);
  ctx.fillStyle = '#1d5089'; ctx.fillRect(0, 0, VW, VH);

  // faixa de tiles visíveis
  const corners = [unIso(-ox, -oy), unIso(VW - ox, -oy), unIso(-ox, VH - oy + 120), unIso(VW - ox, VH - oy + 120)];
  const minX = Math.max(0, Math.floor(Math.min(...corners.map(q => q.x))) - 2), maxX = Math.min(MAP_W - 1, Math.ceil(Math.max(...corners.map(q => q.x))) + 2);
  const minY = Math.max(0, Math.floor(Math.min(...corners.map(q => q.y))) - 2), maxY = Math.min(MAP_H - 1, Math.ceil(Math.max(...corners.map(q => q.y))) + 2);

  const items = [], visTrees = [], visFlowers = [], visGrass = [];
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const wx = (x - y) * TW / 2, wy = (x + y) * TH / 2;
      const sx = wx + ox, sy = wy + oy;
      if (sx < -TW || sx > VW + TW || sy < -TH || sy > VH + 110) continue;
      drawGround(ctx, x, y, sx, sy, now);
      const i = y * MAP_W + x, o = WORLD.obj[i];
      if (o !== O.NONE && !FLAT.has(o)) {
        items.push({ d: x + y, k: 0, x, y, o, sx, sy });
        if (o === O.TREE || o === O.PINE) visTrees.push({ wx, wy });
      }
      if (o === O.FLOWER || o === O.FLOWERBED) visFlowers.push({ wx, wy });
      const g = WORLD.ground[i];
      if ((g === T.GRASS || g === T.FOREST || g === T.SWAMP) && hash2(x, y, 5) < 0.3) visGrass.push({ wx, wy });
    }
  }

  // marcadores no chão
  if (G.hover && inBounds(G.hover.x, G.hover.y)) {
    const p = iso(G.hover.x, G.hover.y);
    ctx.strokeStyle = 'rgba(255,240,200,0.55)'; ctx.lineWidth = 1.2;
    diamond(ctx, p.sx + ox, p.sy + oy, -1); ctx.stroke();
  }
  const tgt = G.target && G.monsters[G.target];
  if (tgt) {
    const p = iso(tgt.rx, tgt.ry);
    const pulse = Math.sin(now / 150) * 1.5;
    ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 1.8;
    diamond(ctx, p.sx + ox, p.sy + oy, -3 + pulse); ctx.stroke();
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2 + now / 400;
      circ(ctx, p.sx + ox + Math.cos(a) * 22, p.sy + oy + Math.sin(a) * 11, 1.6, '#fca5a5');
    }
  }
  if (G.path && G.path.length) {
    const last = G.path[G.path.length - 1], p = iso(last.x, last.y);
    ctx.strokeStyle = 'rgba(250,204,21,0.8)'; ctx.lineWidth = 1.5;
    diamond(ctx, p.sx + ox, p.sy + oy, -7 + Math.sin(now / 200) * 1.5); ctx.stroke();
  }
  // círculos mágicos de conjuração
  for (const id in G.players) {
    const e = G.players[id];
    if (e.cast && e.cast.end > now) {
      const p = iso(e.rx, e.ry);
      drawMagicCircle(ctx, p.sx + ox, p.sy + oy, now, e.cast.el, (now - e.cast.start) / (e.cast.end - e.cast.start));
    }
  }

  // objetos, construções e personagens ordenados por profundidade
  const addEnt = (e, kind) => {
    const p = iso(e.rx, e.ry);
    const sx = p.sx + ox, sy = p.sy + oy;
    if (sx < -80 || sx > VW + 80 || sy < -60 || sy > VH + 100) return;
    items.push({ d: Math.max(e.x + e.y, (e.fromX ?? e.x) + (e.fromY ?? e.y)) + 0.5, k: kind, e, sx, sy, tx: e.x, ty: e.y });
  };
  for (const id in G.monsters) addEnt(G.monsters[id], 1);
  for (const n of NPCS) addEnt(G.npcs[n.id], 3);
  for (const id in G.players) addEnt(G.players[id], 2);
  BUILDINGS.forEach((b, bi) => {
    const D = b.x + b.w - 1 + b.y + b.h - 1;
    items.push({ d: D, k: 4, b, bi });
    // quem está atrás da construção é desenhado antes; quem está na frente, depois
    for (const it of items) {
      if (it.k === 4) continue;
      const ix = it.k === 0 ? it.x : it.tx, iy = it.k === 0 ? it.y : it.ty;
      if (ix < b.x - 5 || iy < b.y - 5 || ix > b.x + b.w + 1 || iy > b.y + b.h + 1) continue;
      const behind = ix < b.x + b.w && iy < b.y + b.h;
      it.d = behind ? Math.min(it.d, D - 0.5) : Math.max(it.d, D + 0.5);
    }
  });
  items.sort((a, b) => a.d - b.d || a.k - b.k);

  const labels = [];
  for (const it of items) {
    if (it.k === 0) { drawObject(ctx, it.o, it.x, it.y, it.sx, it.sy, now); continue; }
    if (it.k === 4) {
      const top = drawBuilding(ctx, it.b, ox, oy, now, day.night);
      if (it.b.name) labels.push({ sx: top.x, sy: top.y, title: it.b.name });
      continue;
    }
    const e = it.e;
    if (it.k === 1) {
      const h = drawMonster(ctx, e, it.sx, it.sy, now);
      if (!e.dieAt) labels.push({ sx: it.sx, sy: it.sy - h - 6, name: MON[e.type].name, color: e.id === G.target ? '#fca5a5' : '#f5f0e1', hp: e.hp / e.maxHp, e });
    } else if (it.k === 3) {
      drawNPC(ctx, e, it.sx, it.sy, now);
      labels.push({ sx: it.sx, sy: it.sy - 50, name: e.name, color: '#86efac', npc: true });
    } else {
      drawAuras(ctx, e, it.sx, it.sy, now);
      drawHero(ctx, it.sx, it.sy, e, now);
      if (e.cls === 'mage') G.lights.push({ x: it.sx + 9 * (e.face || 1), y: it.sy - 50, r: 34, c: '147,197,253', a: 0.6 });
      G.lights.push({ x: it.sx, y: it.sy - 20, r: 70, c: '255,240,220', a: 0.45 });
      labels.push({
        sx: it.sx, sy: it.sy - (e.cls === 'mage' ? 66 : 56), name: e.name, color: e.id === G.myId ? '#fde68a' : '#bfdbfe', hp: e.hp / e.maxHp,
        mp: e.id === G.myId ? e.mp / e.maxMp : null, e, player: true,
      });
    }
  }

  drawEffects(ctx, ox, oy, now);
  ambientParticles(now, visTrees, visFlowers, visGrass, day.night);
  drawParticles(ctx, ox, oy, now, dt);

  // sombras de nuvens (de dia)
  if (day.dark < 0.4) {
    ctx.globalAlpha = 0.09 * (1 - day.dark / 0.4);
    for (let k = 0; k < 4; k++) {
      const cxw = ((k * 811 + now * 0.012) % 2400) - 1200 + c.sx, cyw = ((k * 467 + now * 0.005) % 1400) - 700 + c.sy;
      const sx = cxw + ox, sy = cyw + oy;
      ctx.fillStyle = '#0b1a2a';
      ctx.beginPath(); ctx.ellipse(sx, sy, 160, 60, 0, 0, 7); ctx.ellipse(sx + 90, sy + 20, 110, 45, 0, 0, 7); ctx.ellipse(sx - 80, sy + 15, 90, 40, 0, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  // ---------- iluminação (tela) ----------
  if (day.dark > 0.01 || day.dusk > 0.01) {
    if (lightCanvas.width !== Math.round(W * dpr) || lightCanvas.height !== Math.round(H * dpr)) { lightCanvas.width = Math.round(W * dpr); lightCanvas.height = Math.round(H * dpr); }
    lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    lctx.globalCompositeOperation = 'source-over';
    lctx.clearRect(0, 0, W, H);
    lctx.fillStyle = `rgba(8,12,38,${day.dark})`;
    lctx.fillRect(0, 0, W, H);
    lctx.globalCompositeOperation = 'destination-out';
    for (const L of G.lights) {
      const fl = L.flick ? 0.92 + Math.sin(now / 60 + L.x) * 0.05 + Math.random() * 0.03 : 1;
      const r = L.r * Zm * fl, x = L.x * Zm, y = L.y * Zm;
      if (x < -r || y < -r || x > W + r || y > H + r) continue;
      const g = lctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(0,0,0,${L.a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      lctx.fillStyle = g; lctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    ctx.drawImage(lightCanvas, 0, 0, W, H);
    // brilho colorido das luzes
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const glow = Math.max(day.dark, 0.15);
    for (const L of G.lights) {
      const r = L.r * Zm * 0.7, x = L.x * Zm, y = L.y * Zm;
      if (x < -r || y < -r || x > W + r || y > H + r) continue;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${L.c},${0.22 * L.a * glow})`); g.addColorStop(1, `rgba(${L.c},0)`);
      ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    ctx.restore();
    if (day.dusk > 0.01) { ctx.fillStyle = `rgba(255,120,40,${day.dusk * 0.12})`; ctx.fillRect(0, 0, W, H); }
  }

  drawLabels(ctx, labels, now, Zm);
  drawNumbers(ctx, now, ox, oy, Zm);
}

// ---------- textos sobre a cena (em pixels de tela, sempre nítidos) ----------
function fancyText(ctx, text, x, y, color, size, weight = 'bold', font = 'Cinzel, Georgia, serif') {
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.textAlign = 'center';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(3, size / 3.5); ctx.strokeStyle = 'rgba(10,6,2,0.9)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color; ctx.fillText(text, x, y);
}

function drawLabels(ctx, labels, now, Zm) {
  for (const l of labels) {
    const x = l.sx * Zm, y = l.sy * Zm;
    if (l.title) { fancyText(ctx, l.title, x, y, '#fde68a', 14); continue; }
    let yy = y;
    if (l.hp != null) {
      const w = 44;
      ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(x - w / 2 - 1.5, yy - 1.5, w + 3, l.mp != null ? 10 : 7);
      const fr = Math.max(0, Math.min(1, l.hp));
      ctx.fillStyle = fr > 0.6 ? '#22c55e' : fr > 0.3 ? '#eab308' : '#ef4444';
      ctx.fillRect(x - w / 2, yy, w * fr, 4);
      if (l.mp != null) { ctx.fillStyle = '#3b82f6'; ctx.fillRect(x - w / 2, yy + 5, w * Math.max(0, Math.min(1, l.mp)), 2.5); }
      yy -= 5;
    }
    fancyText(ctx, l.name, x, yy, l.color, l.npc ? 12 : 12.5);
    if (l.npc) fancyText(ctx, '💬', x, yy - 16, '#fff', 12, 'normal', 'sans-serif');
    const e = l.e;
    if (!e) continue;
    // barra de conjuração
    if (e.cast && e.cast.end > now) {
      const pr = (now - e.cast.start) / (e.cast.end - e.cast.start), w = 54;
      ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillRect(x - w / 2 - 1, y + 14, w + 2, 6);
      ctx.fillStyle = '#a78bfa'; ctx.fillRect(x - w / 2, y + 15, w * pr, 4);
    }
    // grito da habilidade (estilo arcade)
    if (e.shout && e.shoutUntil > now) {
      const t = 1 - (e.shoutUntil - now) / 1600;
      const s = t < 0.1 ? 1 + (0.1 - t) * 5 : 1;
      ctx.save(); ctx.globalAlpha = t > 0.8 ? (1 - t) * 5 : 1;
      fancyText(ctx, e.shout, x, yy - 20 - t * 8, '#fef08a', 15 * s, '900');
      ctx.restore();
    }
    // balão de chat
    if (e.say && e.sayUntil > now) {
      ctx.font = '13px "Crimson Text", Georgia, serif';
      const text = e.say, w = Math.min(240, ctx.measureText(text).width) + 16;
      const by = yy - (e.shout && e.shoutUntil > now ? 46 : 22);
      ctx.fillStyle = 'rgba(245,235,210,0.96)'; ctx.strokeStyle = '#6b4a2b'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(x - w / 2, by - 20, w, 20, 6); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 4, by); ctx.lineTo(x, by + 5); ctx.lineTo(x + 4, by); ctx.fill();
      ctx.fillStyle = '#2b1d0e'; ctx.textAlign = 'center'; ctx.fillText(text, x, by - 6, 230);
    }
  }
}

// números de dano saltitantes
function drawNumbers(ctx, now, ox, oy, Zm) {
  G.nums = G.nums.filter(n => now - n.t0 < 1200 && now >= n.t0 - 5000);
  for (const n of G.nums) {
    if (now < n.t0) continue;
    const t = (now - n.t0) / 1200;
    const bx = (n.wx + ox) * Zm, by = (n.wy + oy) * Zm;
    const arc = Math.sin(Math.min(1, t * 1.3) * Math.PI * 0.85);
    const x = bx + n.vx * t * 46, y = by - 30 - arc * 46 - t * 10;
    const pop = t < 0.12 ? 1 + (0.12 - t) * 7 : 1;
    const size = (n.big ? 26 : n.small ? 15 : 21) * pop;
    ctx.save();
    ctx.globalAlpha = t > 0.75 ? (1 - t) * 4 : 1;
    if (n.crit) {
      ctx.fillStyle = 'rgba(255,200,40,0.35)';
      ctx.beginPath();
      for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8, r = k % 2 ? 14 : 30; ctx.lineTo(x + Math.cos(a) * r * pop, y - 8 + Math.sin(a) * r * pop * 0.7); }
      ctx.fill();
      fancyText(ctx, 'CRÍTICO!', x, y - 26 * pop, '#fff7ed', 11, '900');
    }
    fancyText(ctx, n.text, x, y, n.color, size, '900', '"Trebuchet MS", Impact, sans-serif');
    ctx.restore();
  }
}

// ---------- minimapa ----------
const MINI = (() => {
  const c = document.createElement('canvas');
  c.width = MAP_W; c.height = MAP_H;
  const m = c.getContext('2d');
  const cols = { [T.WATER]: '#2a5f9a', [T.SAND]: '#d9c58c', [T.GRASS]: '#5c9e3d', [T.FOREST]: '#3a7029', [T.STONE]: '#9a9a95', [T.DIRT]: '#9b7549', [T.BRIDGE]: '#8b5a2b', [T.COBBLE]: '#c9c2b0', [T.SWAMP]: '#4b5a30', [T.DEAD]: '#a39562' };
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const i = y * MAP_W + x, o = WORLD.obj[i];
    m.fillStyle = WORLD.bld[i] >= 0 ? '#7c2d12' : (o === O.TREE || o === O.PINE) ? '#24501b' : (o === O.FENCE ? '#5b3a1e' : cols[WORLD.ground[i]]);
    m.fillRect(x, y, 1, 1);
  }
  return c;
})();

// minimapa girado 45° para ficar igual à visão isométrica
function renderMinimap(ctx, size) {
  const s = size / MAP_W / Math.SQRT2;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.rotate(Math.PI / 4);
  ctx.scale(s, s);
  ctx.translate(-MAP_W / 2, -MAP_H / 2);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(MINI, 0, 0);
  ctx.fillStyle = '#ef4444';
  for (const id in G.monsters) { const e = G.monsters[id]; ctx.fillRect(e.x, e.y, 1.4, 1.4); }
  for (const id in G.players) {
    const e = G.players[id];
    ctx.fillStyle = id === G.myId ? '#fff' : '#60a5fa';
    ctx.fillRect(e.x - 1.5, e.y - 1.5, 4, 4);
  }
  ctx.restore();
}
