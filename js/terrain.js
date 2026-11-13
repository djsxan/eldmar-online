// ============================================================
//  TERRENO PINTADO — o chão é pintado em blocos (chunks) com os
//  materiais se misturando suavemente (como tinta), mais pinceladas
//  de grama, pedras e flores. A água fica por baixo, animada.
// ============================================================
const CHUNK = 128;           // tamanho do bloco em unidades de arte
const TEXR = 1.6;            // texels por unidade (suavizado na tela = aspecto pintado)
const HTW = 32, HTH = 16;    // meio tile
function iso(x, y) { return { sx: (x - y) * HTW, sy: (x + y) * HTH }; }
function unIso(px_, py_) { const a = px_ / HTW, b = py_ / HTH; return { x: (a + b) / 2, y: (b - a) / 2 }; }

const MATC = {
  [T.GRASS]: ['#46622e', '#5a7a38', '#6e8e44'],
  [T.FOREST]: ['#2a4024', '#38522c', '#486436'],
  [T.SAND]: ['#a8946a', '#bfab80', '#d2c098'],
  [T.STONE]: ['#5e5c56', '#76736b', '#8e8a80'],
  [T.DIRT]: ['#5a4430', '#6e5438', '#826444'],
  [T.BRIDGE]: ['#4a3220', '#5e4028', '#704e32'],
  [T.COBBLE]: ['#5a5852', '#6c6962', '#7e7a72'],
  [T.SWAMP]: ['#2c3422', '#38402a', '#465034'],
  [T.DEAD]: ['#66603e', '#7a724a', '#8e8558'],
  [T.SHALLOW]: ['#6a8682', '#7a9692', '#8aa6a0'],
  [T.CLIFF]: ['#3e3b35', '#4c4942', '#5a564e'],
  [T.FLOORSTONE]: ['#66635c', '#78746c', '#8a857c'],
  [T.WATER]: ['#1e3a52', '#1e3a52', '#1e3a52'],
};
const ZONEC = {
  [Z.FOREST]: ['#2c4a2a', '#385a32', '#46683a'],
  [Z.ORCS]: ['#56602e', '#687236', '#7a8440'],
  [Z.BONES]: ['#4e5038', '#5e6044', '#6e7050'],
  [Z.SWAMP]: ['#33482a', '#3e5430', '#4a6038'],
  [Z.WILD]: ['#40603a', '#527444', '#64864e'],
  [Z.VILLAGE]: ['#4e6c30', '#62823a', '#769646'],
};
const COLX = {};
function matCols(g, z) {
  const k = g === T.GRASS && ZONEC[z] ? 'z' + z : 'g' + g;
  let c = COLX[k];
  if (!c) { c = (g === T.GRASS && ZONEC[z] ? ZONEC[z] : MATC[g] || MATC[T.GRASS]).map(rgbOf); COLX[k] = c; }
  return c;
}
function tileInfo(x, y) {
  if (!inBounds(x, y)) return [T.WATER, Z.WILD];
  const i = y * MAP_W + x; return [WORLD.ground[i], WORLD.zone[i]];
}

const chunks = new Map();
function chunkKey(cx, cy) { return cx * 1000 + cy; }

function buildChunk(cx, cy) {
  const X0 = cx * CHUNK, Y0 = cy * CHUNK, N = Math.ceil(CHUNK * TEXR);
  const can = document.createElement('canvas'); can.width = N; can.height = N;
  const g2 = can.getContext('2d');
  const img = g2.createImageData(N, N), D = img.data;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const wx = X0 + (i + 0.5) / TEXR, wy = Y0 + (j + 0.5) / TEXR;
    const t = unIso(wx, wy);
    const fx = t.x + (vnoise(t.x * 1.1, t.y * 1.1, 21) - 0.5) * 0.7, fy = t.y + (vnoise(t.x * 1.1 + 9.3, t.y * 1.1, 22) - 0.5) * 0.7;
    const x0 = Math.floor(fx), y0 = Math.floor(fy), u = smooth(smooth(fx - x0)), v = smooth(smooth(fy - y0));
    let r = 0, gg = 0, b = 0, aw = 0, water = 0;
    const n1 = vnoise(wx / 18, wy / 10, 5), n2 = vnoise(wx / 5, wy / 3, 6);
    for (let q = 0; q < 4; q++) {
      const tx = x0 + (q & 1), ty = y0 + (q >> 1), wgt = ((q & 1) ? u : 1 - u) * ((q >> 1) ? v : 1 - v);
      if (wgt < 0.001) continue;
      const [gt, zt] = tileInfo(tx, ty);
      if (gt === T.WATER) { water += wgt; continue; }
      const cols = matCols(gt, zt), m = clamp(n1 * 0.9 + n2 * 0.5 - 0.2, 0, 1.2);
      const a = cols[m < 0.45 ? 0 : 1], c2 = cols[m < 0.45 ? 1 : 2], tt = m < 0.45 ? m / 0.45 : (m - 0.45) / 0.75;
      r += (a[0] + (c2[0] - a[0]) * tt) * wgt; gg += (a[1] + (c2[1] - a[1]) * tt) * wgt; b += (a[2] + (c2[2] - a[2]) * tt) * wgt; aw += wgt;
    }
    const k = (j * N + i) * 4;
    if (aw < 0.001) { D[k + 3] = 0; continue; }
    r /= aw; gg /= aw; b /= aw;
    if (water > 0.02) { const f = clamp(water * 2.2, 0, 1); r *= 1 - f * 0.35; gg *= 1 - f * 0.3; b *= 1 - f * 0.2; }
    const fine = (hash2(i, j, 31) - 0.5) * 10;
    D[k] = clamp(r + fine, 0, 255); D[k + 1] = clamp(gg + fine, 0, 255); D[k + 2] = clamp(b + fine * 0.8, 0, 255);
    D[k + 3] = Math.round(255 * clamp((1 - water) * 1.9 - 0.35, 0, 1));
  }
  g2.putImageData(img, 0, 0);
  g2.save(); g2.scale(TEXR, TEXR); g2.translate(-X0, -Y0); g2.lineCap = 'round';
  const tl = unIso(X0, Y0), tr = unIso(X0 + CHUNK, Y0), bl = unIso(X0, Y0 + CHUNK), br = unIso(X0 + CHUNK, Y0 + CHUNK);
  const minX = Math.max(0, Math.floor(Math.min(tl.x, tr.x, bl.x, br.x)) - 1), maxX = Math.min(MAP_W - 1, Math.ceil(Math.max(tl.x, tr.x, bl.x, br.x)) + 1);
  const minY = Math.max(0, Math.floor(Math.min(tl.y, tr.y, bl.y, br.y)) - 1), maxY = Math.min(MAP_H - 1, Math.ceil(Math.max(tl.y, tr.y, bl.y, br.y)) + 1);
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
    const p = iso(x, y), i = y * MAP_W + x, gt = WORLD.ground[i], z = WORLD.zone[i];
    if (p.sx < X0 - 40 || p.sx > X0 + CHUNK + 40 || p.sy < Y0 - 24 || p.sy > Y0 + CHUNK + 24) continue;
    const R = rng(i * 7 + 3);
    if (gt === T.GRASS || gt === T.FOREST) {
      const cols = matCols(gt, z);
      for (let k = 0; k < 14; k++) {
        const ox = (R() - 0.5) * 56, oy = (R() - 0.5) * 26; if (Math.abs(ox) / 32 + Math.abs(oy) / 16 > 1) continue;
        const c = cols[R() < 0.5 ? 2 : 0], h = 3 + R() * 4;
        g2.strokeStyle = `rgba(${c[0] + 18},${c[1] + 22},${c[2] + 10},${0.55 + R() * 0.3})`; g2.lineWidth = 0.7;
        g2.beginPath(); g2.moveTo(p.sx + ox, p.sy + oy); g2.lineTo(p.sx + ox + (R() - 0.5) * 2.5, p.sy + oy - h); g2.stroke();
      }
    } else if (gt === T.DIRT || gt === T.SAND || gt === T.DEAD) {
      for (let k = 0; k < 6; k++) { const ox = (R() - 0.5) * 50, oy = (R() - 0.5) * 22; dab(g2, p.sx + ox, p.sy + oy, 1 + R() * 1.4, 0.7 + R() * 0.6, R() < 0.5 ? 'rgba(255,240,210,0.18)' : 'rgba(30,20,10,0.25)'); }
      if (gt === T.DEAD) for (let k = 0; k < 6; k++) { const ox = (R() - 0.5) * 50, oy = (R() - 0.5) * 22; curve(g2, p.sx + ox, p.sy + oy, p.sx + ox - 1, p.sy + oy - 3, p.sx + ox + (R() - 0.5) * 3, p.sy + oy - 6, 'rgba(176,160,100,0.7)', 0.7); }
    } else if (gt === T.COBBLE || gt === T.FLOORSTONE) {
      const big = gt === T.FLOORSTONE, n = big ? 5 : 11;
      for (let k = 0; k < n; k++) {
        const u = R() - 0.5, v = R() - 0.5, sx = p.sx + (u - v) * 32 * 0.9, sy = p.sy + (u + v) * 16 * 0.9;
        const rr = big ? 9 + R() * 3 : 5 + R() * 2.5, base = big ? 120 : 110, sh = (R() - 0.5) * 30;
        g2.fillStyle = `rgba(${base + sh},${base - 4 + sh},${base - 10 + sh},0.9)`;
        g2.beginPath(); g2.ellipse(sx, sy, rr, rr * 0.5, (R() - 0.5) * 0.4, 0, 7); g2.fill();
        g2.fillStyle = 'rgba(255,250,235,0.14)'; g2.beginPath(); g2.ellipse(sx - rr * 0.2, sy - rr * 0.12, rr * 0.6, rr * 0.22, 0, 0, 7); g2.fill();
        g2.strokeStyle = 'rgba(30,28,24,0.4)'; g2.lineWidth = 0.6; g2.beginPath(); g2.ellipse(sx, sy, rr, rr * 0.5, 0, 0.2, 2.9); g2.stroke();
      }
      if (R() < 0.35) for (let k = 0; k < 4; k++) dab(g2, p.sx + (R() - 0.5) * 40, p.sy + (R() - 0.5) * 18, 1.6, 0.8, 'rgba(70,100,40,0.6)');
    } else if (gt === T.BRIDGE) {
      const alongX = y === CENTER || y === CENTER + 1;
      for (let k = -3; k <= 3; k++) {
        const t = k / 7, a = alongX ? [32 * t, 16 * t] : [-32 * t, 16 * t], q = alongX ? [-32 * 0.48, 16 * 0.48] : [32 * 0.48, 16 * 0.48];
        g2.strokeStyle = 'rgba(30,18,8,0.55)'; g2.lineWidth = 0.9; g2.beginPath(); g2.moveTo(p.sx + a[0] - q[0], p.sy + a[1] - q[1]); g2.lineTo(p.sx + a[0] + q[0], p.sy + a[1] + q[1]); g2.stroke();
      }
    } else if (gt === T.SWAMP) {
      for (let k = 0; k < 4; k++) dab(g2, p.sx + (R() - 0.5) * 44, p.sy + (R() - 0.5) * 20, 4 + R() * 6, 2 + R() * 2, 'rgba(80,110,50,0.35)');
    }
    const o = WORLD.obj[i];
    if (o === O.FLOWER) { const cols = ['#e889b0', '#f0d050', '#f2ede0', '#a888e0', '#e86a5a']; for (let k = 0; k < 9; k++) { const ox = (R() - 0.5) * 50, oy = (R() - 0.5) * 22; stroke(g2, [p.sx + ox, p.sy + oy, p.sx + ox, p.sy + oy - 3], '#3a6a28', 0.6); dab(g2, p.sx + ox, p.sy + oy - 3.5, 1.4, 1.2, cols[Math.floor(R() * 5)]); } }
    else if (o === O.FLOWERBED) { shape(g2, [p.sx, p.sy - 13, p.sx + 26, p.sy, p.sx, p.sy + 13, p.sx - 26, p.sy], '#4a3220'); for (let k = 0; k < 16; k++) { const ox = (R() - 0.5) * 34, oy = (R() - 0.5) * 14; dab(g2, p.sx + ox, p.sy + oy - 2, 2, 1.7, ['#b83a3a', '#e8a83a', '#d86aa8', '#f2ede0'][k % 4]); dab(g2, p.sx + ox + 1, p.sy + oy, 1.6, 1, '#3a6a28'); } }
    else if (o === O.BONES) { stroke(g2, [p.sx - 8, p.sy + 2, p.sx + 8, p.sy - 2], '#d8d0b8', 1.6); dab(g2, p.sx - 9, p.sy + 2, 1.6, 1.6, '#d8d0b8'); dab(g2, p.sx + 9, p.sy - 2, 1.6, 1.6, '#d8d0b8'); if (R() < 0.5) { dab(g2, p.sx + 8, p.sy + 6, 3.6, 3, '#e2dcc6'); dab(g2, p.sx + 7, p.sy + 6, 0.8, 0.8, '#2a2218'); } }
    else if (o === O.RUBBLE) for (let k = 0; k < 8; k++) { const ox = (R() - 0.5) * 40, oy = (R() - 0.5) * 16, rr = 2 + R() * 3; dab(g2, p.sx + ox, p.sy + oy, rr, rr * 0.6, `rgb(${110 + R() * 40},${106 + R() * 40},${96 + R() * 40})`); }
    else if (o === O.LILY) { const ox = (R() - 0.5) * 20, oy = (R() - 0.5) * 8; dab(g2, p.sx + ox, p.sy + oy, 7, 3.5, '#3e7a34'); dab(g2, p.sx + ox - 1, p.sy + oy - 0.6, 5, 2.2, '#56923e'); if (R() < 0.5) dab(g2, p.sx + ox, p.sy + oy - 1.5, 2, 1.6, '#f2bcd0'); }
  }
  g2.restore();
  return can;
}

// ---------- água ----------
function drawWater(ctx, view, now, day) {
  const { x0, y0, x1, y1 } = view;
  const top = day.night ? '#0e1e30' : day.dusk > 0.3 ? '#3a4a60' : '#2a5272', bot = day.night ? '#08121e' : '#173248';
  ctx.fillStyle = lgrad(ctx, 0, y0, 0, y1, [[0, top], [1, bot]]);
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
}
function drawWaterDetail(ctx, minX, maxX, minY, maxY, now, day) {
  const t = now / 1000;
  ctx.lineCap = 'round';
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
    const i = y * MAP_W + x;
    if (WORLD.ground[i] !== T.WATER) continue;
    const p = iso(x, y), river = WORLD.river[i];
    const fx = river ? WORLD.flow[i * 2] : 0.35, fy = river ? WORLD.flow[i * 2 + 1] : 0.15;
    const dx = (fx - fy) * HTW, dy = (fx + fy) * HTH, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
    for (let k = 0; k < 3; k++) {
      const ph = ((t * (river ? 0.6 : 0.15)) + hash2(x, y, 40 + k)) % 1;
      const ox = (hash2(x, y, 50 + k) - 0.5) * 44, oy = (hash2(x, y, 60 + k) - 0.5) * 20;
      const sx = p.sx + ox + ux * (ph - 0.5) * 30, sy = p.sy + oy + uy * (ph - 0.5) * 30;
      const a = Math.sin(ph * Math.PI) * (day.night ? 0.25 : 0.5);
      ctx.strokeStyle = `rgba(200,225,240,${a})`; ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.moveTo(sx - ux * 6, sy - uy * 6); ctx.quadraticCurveTo(sx - uy * 1.5, sy + ux * 1.5, sx + ux * 6, sy + uy * 6); ctx.stroke();
    }
    if (hash2(x, y, 77) < 0.25) { const s = Math.max(0, Math.sin(t * 1.3 + hash2(x, y, 78) * 9)); if (s > 0.85) softDab(ctx, p.sx + (hash2(x, y, 79) - 0.5) * 40, p.sy + (hash2(x, y, 80) - 0.5) * 16, 4, day.night ? '#c8d8f0' : '#fff6d8', (s - 0.85) * 4); }
  }
}

const DEPTH = (() => {
  const D = new Uint8Array(MAP_W * MAP_H);
  const isLand = (x, y) => inBounds(x, y) && WORLD.ground[y * MAP_W + x] !== T.WATER;
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    if (WORLD.ground[y * MAP_W + x] !== T.WATER) continue;
    let d = 3;
    for (let r = 1; r <= 3 && d === 3; r++) for (let k = -r; k <= r; k++) if (isLand(x + k, y - r) || isLand(x + k, y + r) || isLand(x - r, y + k) || isLand(x + r, y + k)) { d = r - 1; break; }
    D[y * MAP_W + x] = d;
  }
  return D;
})();
