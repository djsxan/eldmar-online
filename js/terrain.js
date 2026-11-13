// ============================================================
//  TERRENO PINTADO — o chão é pintado em blocos (chunks) com os
//  materiais se misturando suavemente (como tinta), mais pinceladas
//  de grama, pedras e flores. A água fica por baixo, animada.
// ============================================================
const CHUNK = 128;           // tamanho do bloco em unidades de arte
const TEXR = 1.8;            // texels por unidade de arte
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

// ---------- materiais realistas com relevo ----------
// Cada material vira uma textura repetível de 4x4 tiles com cor e altura.
// A luz do sol (fixa) é calculada pelo relevo e já vem embutida.
const MT = 64, MTS = 256, MTP = MTS / MT;           // texels por tile, tamanho, período em tiles
const SUN3 = (() => { const v = [-0.85, 1.5, 0.45], l = Math.hypot(...v); return v.map(c => c / l); })();
function pn(x, y, f, s) {                            // ruído de valor periódico (repete a cada MTP tiles)
  const P = MTP * f, X = x * f, Y = y * f, xi = Math.floor(X), yi = Math.floor(Y), u = smooth(X - xi), v = smooth(Y - yi);
  const m = a => ((a % P) + P) % P;
  const a = hash2(m(xi), m(yi), s), b = hash2(m(xi + 1), m(yi), s), c = hash2(m(xi), m(yi + 1), s), d = hash2(m(xi + 1), m(yi + 1), s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, f, s, o = 4) { let t = 0, a = 0.5, n = 0; for (let i = 0; i < o; i++) { t += pn(x, y, f, s + i * 17) * a; n += a; a *= 0.5; f *= 2; } return t / n; }
function cells(x, y, f, s, jit = 0.85) {             // células (pedras): distância à 1ª e 2ª mais próximas e id da célula
  const P = MTP * f, X = x * f, Y = y * f, xi = Math.floor(X), yi = Math.floor(Y);
  let d1 = 9, d2 = 9, id = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = xi + i, cy = yi + j, mx = ((cx % P) + P) % P, my = ((cy % P) + P) % P;
    const px_ = cx + 0.5 + (hash2(mx, my, s) - 0.5) * jit, py = cy + 0.5 + (hash2(mx, my, s + 1) - 0.5) * jit;
    const d = Math.hypot(X - px_, Y - py);
    if (d < d1) { d2 = d1; d1 = d; id = hash2(mx, my, s + 2); } else if (d < d2) d2 = d;
  }
  return [d1, d2, id];
}
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const HX = h => rgbOf(h);
// cada material: (u, v) em tiles -> [altura 0..1, cor]
const MATDEF = {
  grass: (u, v) => {
    const n = fbm(u, v, 1.5, 11), f = fbm(u, v, 9, 12, 3), blade = pn(u * 1.0, v * 3.2, 14, 13) * pn(u * 3.2, v, 14, 14);
    const h = n * 0.35 + f * 0.35 + blade * 0.5;
    let c = mixc(HX('#3e5a26'), HX('#6a8a3e'), clamp(n * 1.3 - 0.15 + f * 0.3, 0, 1));
    if (blade > 0.55) c = mixc(c, HX('#8aa850'), (blade - 0.55) * 1.6);
    if (hash2(Math.floor(u * 40), Math.floor(v * 40), 15) < 0.025) c = mixc(c, HX('#c8c070'), 0.5);
    return [h, c];
  },
  forest: (u, v) => {
    const n = fbm(u, v, 2, 21), f = fbm(u, v, 10, 22, 3), [d1, , id] = cells(u, v, 9, 23, 1);
    const leaf = d1 < 0.32 && id < 0.55;
    const h = n * 0.4 + f * 0.3 + (leaf ? 0.35 - d1 : 0);
    let c = mixc(HX('#26361c'), HX('#46582a'), clamp(n * 1.2 - 0.1, 0, 1));
    if (leaf) c = mixc(HX('#5a4224'), HX('#8a6a34'), id * 1.8);
    return [h, c];
  },
  dirt: (u, v) => {
    const n = fbm(u, v, 2, 31), f = fbm(u, v, 12, 32, 3), [d1, , id] = cells(u, v, 7, 33, 0.9);
    const peb = id < 0.4 ? Math.max(0, 0.3 - d1) / 0.3 : 0;
    const h = n * 0.4 + f * 0.25 + peb * 0.6;
    let c = mixc(HX('#4e3a26'), HX('#7a5e40'), clamp(n * 1.3 - 0.2 + f * 0.2, 0, 1));
    if (peb > 0) c = mixc(c, mixc(HX('#7a746a'), HX('#a49c8c'), id * 2.5), Math.min(1, peb * 2));
    return [h, c];
  },
  sand: (u, v) => {
    const n = fbm(u, v, 1.5, 41), w = Math.sin((u * 0.8 + v * 0.35) * Math.PI * 2 * 2 + fbm(u, v, 1, 42) * 6) * 0.5 + 0.5, g = hash2(Math.floor(u * 64), Math.floor(v * 64), 43);
    const h = w * 0.35 + n * 0.3 + g * 0.12;
    return [h, mixc(HX('#a48e64'), HX('#d0bc90'), clamp(n * 0.9 + w * 0.25 + g * 0.15 - 0.1, 0, 1))];
  },
  stone: (u, v) => {
    const n = fbm(u, v, 2, 51), [d1, d2, id] = cells(u, v, 2.5, 52, 1), crack = clamp((d2 - d1) * 9, 0, 1);
    const h = n * 0.45 + crack * 0.4 + fbm(u, v, 14, 53, 2) * 0.15;
    let c = mixc(HX('#55524b'), HX('#8e8a80'), clamp(n * 1.1 + id * 0.25 - 0.15, 0, 1));
    c = mixc(HX('#2e2c28'), c, 0.4 + crack * 0.6);
    return [h, c];
  },
  cobble: (u, v) => {
    const [d1, d2, id] = cells(u, v, 5, 61, 0.8), e = clamp((d2 - d1) * 3.2, 0, 1), dome = Math.sqrt(e);
    const f = fbm(u, v, 16, 62, 2);
    const h = dome * 0.85 + f * 0.15;
    let c = mixc(HX('#55524b'), HX('#88837a'), id * 0.8 + f * 0.3);
    c = mixc(HX('#2a2822'), c, clamp(e * 3, 0, 1));
    if (e < 0.18 && hash2(Math.floor(u * 20), Math.floor(v * 20), 63) < 0.3) c = mixc(c, HX('#4a6a2a'), 0.6);   // musgo nas juntas
    return [h, c];
  },
  floor: (u, v) => {
    const row = Math.floor(v * 2), off = row % 2 ? 0.5 : 0, uu = u * 1.5 + off, cu = Math.floor(uu), cv = row;
    const fu = uu - cu, fv = v * 2 - row, edge = Math.min(fu, 1 - fu, fv, 1 - fv) * 2;
    const id = hash2(((cu % 6) + 6) % 6, ((cv % 8) + 8) % 8, 71), f = fbm(u, v, 10, 72, 3);
    const bev = clamp(edge * 9, 0, 1);
    const h = bev * 0.75 + f * 0.25 - (fbm(u, v, 5, 73, 2) > 0.7 ? 0.2 : 0);
    let c = mixc(HX('#66625a'), HX('#9a948a'), id * 0.8 + f * 0.25);
    c = mixc(HX('#2a2824'), c, clamp(edge * 14, 0, 1));
    return [h, c];
  },
  wood: (u, v) => {
    const p = Math.floor(v * 4), fv = v * 4 - p, g = fbm(u * 0.25, v * 6, 4, 81, 3), id = hash2(p % 16, 0, 82);
    const h = clamp(Math.min(fv, 1 - fv) * 10, 0, 1) * 0.7 + g * 0.3;
    let c = mixc(HX('#4a3220'), HX('#7a5434'), id * 0.7 + g * 0.4);
    c = mixc(HX('#1e140a'), c, clamp(Math.min(fv, 1 - fv) * 14, 0, 1));
    return [h, c];
  },
  swamp: (u, v) => {
    const n = fbm(u, v, 1.5, 91), f = fbm(u, v, 8, 92, 3), wet = clamp((0.42 - n) * 6, 0, 1);
    const h = n * 0.6 + f * 0.3 * (1 - wet);
    let c = mixc(HX('#2a3220'), HX('#4a5432'), clamp(n * 1.3 + f * 0.3 - 0.2, 0, 1));
    c = mixc(c, HX('#1a2420'), wet * 0.8);
    if (f > 0.62 && !wet) c = mixc(c, HX('#5e7a34'), 0.5);
    return [h, c, wet];
  },
  dead: (u, v) => {
    const n = fbm(u, v, 2, 101), [d1, d2] = cells(u, v, 4, 102, 1), crack = clamp((d2 - d1) * 12, 0, 1), blade = pn(u, v * 3, 14, 103);
    const h = n * 0.3 + crack * 0.4 + blade * 0.3;
    let c = mixc(HX('#5e5638'), HX('#9a8c5a'), clamp(n + blade * 0.3 - 0.2, 0, 1));
    c = mixc(HX('#3a321e'), c, 0.5 + crack * 0.5);
    return [h, c];
  },
  shallow: (u, v) => { const n = fbm(u, v, 2, 111), w = fbm(u, v, 6, 112, 2); return [n * 0.5 + w * 0.3, mixc(HX('#5e7e7a'), HX('#8aa8a0'), n)]; },
  cliff: (u, v) => { const n = fbm(u, v, 2, 121), [d1, d2] = cells(u, v, 3, 122, 1), cr = clamp((d2 - d1) * 8, 0, 1); return [n * 0.5 + cr * 0.4, mixc(HX('#2e2c28'), mixc(HX('#4c4942'), HX('#6e6a60'), n), cr)]; },
};
const MAT_OF = { [T.GRASS]: 'grass', [T.FOREST]: 'forest', [T.SAND]: 'sand', [T.STONE]: 'stone', [T.DIRT]: 'dirt', [T.BRIDGE]: 'wood', [T.COBBLE]: 'cobble', [T.SWAMP]: 'swamp', [T.DEAD]: 'dead', [T.SHALLOW]: 'shallow', [T.CLIFF]: 'cliff', [T.FLOORSTONE]: 'floor' };
const MTEX = {};
function matTex(name) {
  let M = MTEX[name];
  if (M) return M;
  const fn = MATDEF[name], H = new Float32Array(MTS * MTS), C = new Float32Array(MTS * MTS * 3), WET = new Float32Array(MTS * MTS);
  for (let j = 0; j < MTS; j++) for (let i = 0; i < MTS; i++) {
    const r = fn(i / MT, j / MT), k = j * MTS + i;
    H[k] = r[0]; C[k * 3] = r[1][0]; C[k * 3 + 1] = r[1][1]; C[k * 3 + 2] = r[1][2]; WET[k] = r[2] || 0;
  }
  // luz pelo relevo (sol fixo) + oclusão nas partes baixas
  const L = new Float32Array(MTS * MTS * 3), HT = new Float32Array(MTS * MTS), K = 2.2, flat = 0.42 + 0.75 * SUN3[1];
  for (let j = 0; j < MTS; j++) for (let i = 0; i < MTS; i++) {
    const k = j * MTS + i, xl = j * MTS + ((i + MTS - 1) % MTS), xr = j * MTS + ((i + 1) % MTS), yu = ((j + MTS - 1) % MTS) * MTS + i, yd = ((j + 1) % MTS) * MTS + i;
    const dx = (H[xr] - H[xl]) * K, dz = (H[yd] - H[yu]) * K, nl = Math.hypot(dx, 1, dz);
    const lam = Math.max(0, (-dx * SUN3[0] + SUN3[1] - dz * SUN3[2]) / nl);
    let sh = (0.42 + 0.75 * lam) / flat * (0.78 + 0.3 * H[k]);
    let spec = WET[k] > 0.2 ? Math.pow(Math.max(0, lam), 18) * 60 * WET[k] : 0;
    L[k * 3] = C[k * 3] * sh + spec; L[k * 3 + 1] = C[k * 3 + 1] * sh + spec; L[k * 3 + 2] = C[k * 3 + 2] * sh + spec;
    HT[k] = H[k];
  }
  M = MTEX[name] = { L, H: HT };
  return M;
}
// cor de grama por região (tingimento sobre a textura da grama)
const ZTINT = {};
function zoneTint(z) {
  if (ZTINT[z]) return ZTINT[z];
  const base = rgbOf('#5a7a38'), zc = ZONEC[z] ? rgbOf(ZONEC[z][1]) : base;
  return ZTINT[z] = [zc[0] / base[0], zc[1] / base[1], zc[2] / base[2]];
}
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
  const tw = [0, 0, 0, 0], tm = [null, null, null, null], tz = [0, 0, 0, 0], sc = [0, 0, 0, 0];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const wx = X0 + (i + 0.5) / TEXR, wy = Y0 + (j + 0.5) / TEXR;
    const t = unIso(wx, wy);
    const fx = t.x + (vnoise(t.x * 1.1, t.y * 1.1, 21) - 0.5) * 0.7, fy = t.y + (vnoise(t.x * 1.1 + 9.3, t.y * 1.1, 22) - 0.5) * 0.7;
    const x0 = Math.floor(fx), y0 = Math.floor(fy), u = smooth(fx - x0), v = smooth(fy - y0);
    // posição na textura do material (segue o chão em perspectiva isométrica)
    const ti = ((Math.floor((t.x + 0.5) * MT) % MTS) + MTS) % MTS, tj = ((Math.floor((t.y + 0.5) * MT) % MTS) + MTS) % MTS, tk = tj * MTS + ti;
    let water = 0, best = -9, n = 0;
    for (let q = 0; q < 4; q++) {
      const tx = x0 + (q & 1), ty = y0 + (q >> 1), wgt = ((q & 1) ? u : 1 - u) * ((q >> 1) ? v : 1 - v);
      if (wgt < 0.001) continue;
      const [gt, zt] = tileInfo(tx, ty);
      if (gt === T.WATER) { water += wgt; continue; }
      const M = matTex(MAT_OF[gt] || 'grass');
      // mistura pela altura: pedras aparecem por cima da grama nas bordas
      const score = wgt + M.H[tk] * 0.45;
      tw[n] = wgt; tm[n] = M; tz[n] = gt === T.GRASS ? zt : -1; sc[n] = score; if (score > best) best = score; n++;
    }
    const k = (j * N + i) * 4;
    if (!n) { D[k + 3] = 0; continue; }
    let r = 0, gg = 0, bb = 0, aw = 0;
    for (let q = 0; q < n; q++) {
      const w = Math.max(0, sc[q] - (best - 0.22)); if (w <= 0) continue;
      const L = tm[q].L; let cr = L[tk * 3], cg = L[tk * 3 + 1], cb = L[tk * 3 + 2];
      if (tz[q] >= 0) { const zt2 = zoneTint(tz[q]); cr *= zt2[0]; cg *= zt2[1]; cb *= zt2[2]; }
      r += cr * w; gg += cg * w; bb += cb * w; aw += w;
    }
    r /= aw; gg /= aw; bb /= aw;
    // variação grande (manchas de luz e cor) para não repetir
    const big = 0.88 + vnoise(wx / 40, wy / 22, 5) * 0.2 + (vnoise(wx / 9, wy / 5, 6) - 0.5) * 0.06;
    r *= big; gg *= big; bb *= big;
    if (water > 0.02) { const f = clamp(water * 2.2, 0, 1); r *= 1 - f * 0.4; gg *= 1 - f * 0.32; bb *= 1 - f * 0.2; }
    D[k] = clamp(r, 0, 255); D[k + 1] = clamp(gg, 0, 255); D[k + 2] = clamp(bb, 0, 255);
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
      for (let k = 0; k < 5; k++) {
        const ox = (R() - 0.5) * 56, oy = (R() - 0.5) * 26; if (Math.abs(ox) / 32 + Math.abs(oy) / 16 > 1) continue;
        const c = cols[R() < 0.5 ? 2 : 0], h = 3 + R() * 4;
        g2.strokeStyle = `rgba(${c[0] + 18},${c[1] + 22},${c[2] + 10},${0.55 + R() * 0.3})`; g2.lineWidth = 0.7;
        g2.beginPath(); g2.moveTo(p.sx + ox, p.sy + oy); g2.lineTo(p.sx + ox + (R() - 0.5) * 2.5, p.sy + oy - h); g2.stroke();
      }
    } else if (gt === T.DEAD) {
      for (let k = 0; k < 4; k++) { const ox = (R() - 0.5) * 50, oy = (R() - 0.5) * 22; curve(g2, p.sx + ox, p.sy + oy, p.sx + ox - 1, p.sy + oy - 3, p.sx + ox + (R() - 0.5) * 3, p.sy + oy - 6, 'rgba(176,160,100,0.7)', 0.7); }
    } else if (gt === T.BRIDGE) {
      const alongX = WORLD.rdir[i] === 1;
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
