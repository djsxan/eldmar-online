// ============================================================
//  TERRENO — o chão é desenhado pixel a pixel em blocos (chunks)
//  de 128x128 e guardado. As bordas entre grama, terra, areia e
//  água são "entortadas" com ruído para não parecerem quadradas.
//  A água fica transparente no chunk e é animada por baixo.
// ============================================================
const CHUNK = 128;
const TW = 32, TH = 16;
function iso(x, y) { return { sx: (x - y) * 16, sy: (x + y) * 8 }; }
function unIso(px_, py_) { const a = px_ / 16, b = py_ / 8; return { x: (a + b) / 2, y: (b - a) / 2 }; }

const MAT_PAL = {
  [T.GRASS]: ['#4a7a34', '#5a8c3c', '#6b9c44', '#7eae50'],
  [T.FOREST]: ['#30552a', '#3a6530', '#467436', '#53823e'],
  [T.SAND]: ['#bca372', '#cbb282', '#d8c294', '#e4d2a8'],
  [T.STONE]: ['#6f6d66', '#7f7c74', '#8f8c83', '#a19e94'],
  [T.DIRT]: ['#6e5236', '#7d5f3e', '#8c6c48', '#9a7a54'],
  [T.BRIDGE]: ['#5e3e22', '#6f4a2a', '#7f5832', '#8e663c'],
  [T.COBBLE]: ['#6b675e', '#7c776d', '#8c877c', '#9c978b'],
  [T.SWAMP]: ['#343e24', '#3e4a2a', '#4a5632', '#56623a'],
  [T.DEAD]: ['#7a6f44', '#887c4e', '#978a58', '#a59864'],
  [T.SHALLOW]: ['#6a8a8a', '#7a9a98', '#8aaaa6', '#9ab8b2'],
  [T.CLIFF]: ['#4a463e', '#55514a', '#605b52', '#6b665c'],
  [T.FLOORSTONE]: ['#77736a', '#868278', '#959086', '#a39e93'],
};
const ZONE_GRASS_PAL = {
  [Z.FOREST]: ['#365e2c', '#416c32', '#4d7a3a', '#5a8842'],
  [Z.ORCS]: ['#5e7434', '#6c823c', '#7a9044', '#889e4c'],
  [Z.BONES]: ['#5e6440', '#6a7048', '#767c52', '#82885c'],
  [Z.SWAMP]: ['#405c30', '#4a6836', '#56743e', '#628046'],
};
const PALX = {}; // paletas convertidas para inteiros
function palOf(g, z) {
  const key = g === T.GRASS && ZONE_GRASS_PAL[z] ? 'g' + z : g;
  let p = PALX[key];
  if (!p) { p = (g === T.GRASS && ZONE_GRASS_PAL[z] ? ZONE_GRASS_PAL[z] : MAT_PAL[g] || MAT_PAL[T.GRASS]).map(h => px(h)); PALX[key] = p; }
  return p;
}
const NOWARP = new Set([T.COBBLE, T.BRIDGE, T.FLOORSTONE, T.CLIFF]);

function sampleMat(fx, fy) {
  const tx = Math.round(fx), ty = Math.round(fy);
  if (!inBounds(tx, ty)) return [T.WATER, Z.WILD, -1];
  const i0 = ty * MAP_W + tx, g0 = WORLD.ground[i0];
  if (NOWARP.has(g0)) return [g0, WORLD.zone[i0], i0];
  const wx = fx + (vnoise(fx * 1.2, fy * 1.2, 21) - 0.5) * 0.62, wy = fy + (vnoise(fx * 1.2 + 9.3, fy * 1.2, 22) - 0.5) * 0.62;
  const x = Math.round(wx), y = Math.round(wy);
  if (!inBounds(x, y)) return [T.WATER, Z.WILD, -1];
  const i = y * MAP_W + x, g = WORLD.ground[i];
  if (NOWARP.has(g) && g !== T.CLIFF) return [g0, WORLD.zone[i0], i0];
  return [g, WORLD.zone[i], i];
}

const chunks = new Map();
function chunkKey(cx, cy) { return cx * 1000 + cy; }

function buildChunk(cx, cy) {
  const W = CHUNK, H = CHUNK, X0 = cx * CHUNK, Y0 = cy * CHUNK;
  const SW = W + 2, SH = H + 2;
  const mat = new Uint8Array(SW * SH), zon = new Uint8Array(SW * SH);
  for (let j = 0; j < SH; j++) for (let i = 0; i < SW; i++) {
    const t = unIso(X0 + i - 1 + 0.5, Y0 + j - 1 + 0.5);
    const [g, z] = sampleMat(t.x, t.y);
    mat[j * SW + i] = g; zon[j * SW + i] = z;
  }
  const d = new Uint32Array(W * H);
  const isW = g => g === T.WATER;
  const foam = px('#e8f4f4', 0, 170), wet = px('#5a6a5a', 0, 255), shallowA = [px('#7fb0b8', 0, 110), px('#6aa0ac', 0, 70)];
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const k = (j + 1) * SW + (i + 1), g = mat[k], wx = X0 + i, wy = Y0 + j;
    const up = mat[k - SW], dn = mat[k + SW], lf = mat[k - 1], rt = mat[k + 1];
    if (isW(g)) {
      // espuma e água rasa perto da margem
      if (!isW(up) || !isW(lf) || !isW(rt)) d[j * W + i] = foam;
      else if (!isW(dn)) d[j * W + i] = shallowA[0];
      else {
        const t = unIso(wx, wy), dpt = DEPTH[Math.round(t.y) * MAP_W + Math.round(t.x)];
        if (dpt === 0 && dith(wx, wy) < 0.5) d[j * W + i] = shallowA[1];
      }
      continue;
    }
    const pal = palOf(g, zon[k]);
    let n = vnoise(wx / 7, wy / 4, 5) * 0.6 + vnoise(wx / 2.5, wy / 1.6, 6) * 0.4;
    let idx = n + (dith(wx, wy) - 0.5) * 0.35;
    let c;
    // texturas por material
    if (g === T.COBBLE || g === T.FLOORSTONE) {
      const t = unIso(wx, wy), sc = g === T.COBBLE ? 3 : 2;
      const fx = t.x * sc + 0.5, fy = t.y * sc + 0.5, ox = fx - Math.floor(fx), oy = fy - Math.floor(fy);
      const cell = hash2(Math.floor(fx), Math.floor(fy), 9);
      if (ox < 0.1 || oy < 0.1) c = pal[0];
      else c = pal[1 + Math.min(2, Math.floor(cell * 3 + (ox + oy < 0.5 ? 0.6 : 0)))];
      if (hash2(wx, wy, 12) < 0.03) c = palOf(T.GRASS, 0)[1];
    } else if (g === T.BRIDGE) {
      const t = unIso(wx, wy);
      const alongX = Math.round(t.y) === CENTER || Math.round(t.y) === CENTER + 1;
      const q = (alongX ? t.x : t.y) * 4, f = q - Math.floor(q);
      c = f < 0.14 ? pal[0] : pal[1 + Math.floor(hash2(Math.floor(q), 1, 3) * 3)];
    } else {
      c = pal[idx < 0.32 ? 0 : idx < 0.5 ? 1 : idx < 0.68 ? 2 : 3];
      const r = hash2(wx, wy, 31);
      if ((g === T.GRASS || g === T.FOREST) && r < 0.05) c = pal[r < 0.025 ? 3 : 0];
      if (g === T.FOREST && r > 0.985) c = px('#6a5030');
      if ((g === T.DIRT || g === T.SAND) && r < 0.025) c = pal[3];
      if (g === T.DEAD && r < 0.05) c = px('#b4a46a');
      if (g === T.SWAMP && vnoise(wx / 5, wy / 3, 44) > 0.7) c = px('#5a7038');
      if (g === T.SHALLOW) { c = (c & 0x00ffffff) | (150 << 24); if (r < 0.05) c = px('#8a8678'); }
    }
    // borda escura entre materiais diferentes (contorno suave do terreno)
    if (up !== g && !isW(up) && g !== T.SHALLOW) c = pal[0];
    // margem molhada perto da água
    if ((isW(dn) || isW(rt)) && g !== T.BRIDGE && g !== T.SHALLOW) c = wet;
    d[j * W + i] = c >>> 0;
  }
  // decalques (flores, ossos, entulho...) por tile
  const can = document.createElement('canvas'); can.width = W; can.height = H;
  const cctx = can.getContext('2d');
  cctx.putImageData(new ImageData(new Uint8ClampedArray(d.buffer), W, H), 0, 0);
  const tl = unIso(X0, Y0), tr = unIso(X0 + W, Y0), bl = unIso(X0, Y0 + H), br = unIso(X0 + W, Y0 + H);
  const minX = Math.max(0, Math.floor(Math.min(tl.x, tr.x, bl.x, br.x)) - 1), maxX = Math.min(MAP_W - 1, Math.ceil(Math.max(tl.x, tr.x, bl.x, br.x)) + 1);
  const minY = Math.max(0, Math.floor(Math.min(tl.y, tr.y, bl.y, br.y)) - 1), maxY = Math.min(MAP_H - 1, Math.ceil(Math.max(tl.y, tr.y, bl.y, br.y)) + 1);
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
    const o = WORLD.obj[y * MAP_W + x];
    if (!FLAT.has(o)) continue;
    const p = iso(x, y), sx = p.sx - X0, sy = p.sy - Y0;
    if (sx < -20 || sy < -12 || sx > W + 20 || sy > H + 12) continue;
    const s = decalSprite(o, (x * 7 + y * 3) % 4);
    cctx.drawImage(s.c, Math.round(sx - s.ax), Math.round(sy - s.ay));
  }
  return can;
}

function decalSprite(o, v) {
  switch (o) {
    case O.FLOWER: return sprite(`dflower|${v}`, 28, 14, 14, 7, pc => {
      const cols = ['#e889b0', '#e8c84a', '#f2ede0', '#a88ad8', '#e86a6a'];
      for (let k = 0; k < 7; k++) { const x = 4 + hash2(v, k, 1) * 20, y = 3 + hash2(v, k, 2) * 8; pc.p(x, y + 1, px('#3a6a28')); pc.p(x, y, px(cols[(k + v) % 5])); if (k % 2) pc.p(x + 1, y, px(cols[(k + v) % 5], -0.2)); }
    }, { outline: false });
    case O.FLOWERBED: return sprite(`dbed|${v}`, 30, 16, 15, 8, pc => {
      pc.poly([15, 1, 28, 8, 15, 15, 2, 8], px('#4a3220'));
      for (let k = 0; k < 10; k++) { const x = 8 + hash2(v, k, 1) * 14, y = 4 + hash2(v, k, 2) * 8; pc.p(x, y + 1, px('#3a6a28')); pc.p(x, y, px(['#c43a3a', '#e8a83a', '#d86aa8', '#f2ede0'][k % 4])); }
    });
    case O.BONES: return sprite(`dbone|${v}`, 18, 12, 9, 6, pc => { pc.l(3, 7, 13, 5, px('#d9d2bc'), 1); pc.p(2, 6, px('#d9d2bc')); pc.p(14, 4, px('#d9d2bc')); if (v % 2) { pc.e(12, 8, 2.5, 2, px('#e2dcc6')); pc.p(11, 8, px('#2a2218')); } });
    case O.RUBBLE: return sprite(`drub|${v}`, 26, 16, 13, 8, pc => { for (let k = 0; k < 7; k++) pc.e(5 + hash2(v, k, 1) * 16, 4 + hash2(v, k, 2) * 8, 1.5 + hash2(v, k, 3) * 2, 1 + hash2(v, k, 4), px('#8a8478', hash2(v, k, 5) * 0.3 - 0.15)); });
    case O.LILY: return sprite(`dlily|${v}`, 18, 10, 9, 5, pc => { pc.e(8, 5, 5, 2.6, 0, (x, y, nx, ny) => nx > 0.3 && Math.abs(ny) < 0.25 ? 0 : px('#4a8a3a')); if (v % 2) { pc.p(7, 4, px('#f2b4cc')); pc.p(8, 4, px('#f2d4e0')); } });
    case O.IVY: return sprite('divy', 4, 4, 2, 2, pc => pc.p(1, 1, px('#3f6a2e')), { outline: false });
  }
  return sprite('dnone', 1, 1, 0, 0, () => { }, { outline: false });
}

// água animada (desenhada antes dos chunks)
const WATER_TILE = (() => {
  const W = 64, H = 32, pc = new PC(W, H);
  const base = [px('#2a5a8a'), px('#2f6494'), px('#356e9e')];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const n = (Math.sin((x / W) * Math.PI * 4 + Math.sin(y / H * Math.PI * 2) * 1.5) + Math.sin((y / H) * Math.PI * 2 * 2 + x / W * Math.PI * 2)) * 0.25 + 0.5;
    pc.p(x, y, base[Math.min(2, Math.floor(n * 3 + dith(x, y) * 0.6 - 0.3 + 0.0001))] || base[0]);
  }
  for (let k = 0; k < 14; k++) { const x = Math.floor(hash2(k, 1, 7) * W), y = Math.floor(hash2(k, 2, 7) * H); pc.p(x, y, px('#6aa4d0')); pc.p(x + 1, y, px('#5a94c4')); }
  return pc.canvas();
})();
const WATER_TILE2 = (() => {
  const W = 48, H = 24, pc = new PC(W, H);
  for (let k = 0; k < 10; k++) { const x = Math.floor(hash2(k, 3, 9) * W), y = Math.floor(hash2(k, 4, 9) * H); pc.p(x, y, px('#9ccaee', 0, 200)); pc.p(x + 1, y, px('#7ab4e0', 0, 160)); pc.p(x + 2, y, px('#7ab4e0', 0, 90)); }
  return pc.canvas();
})();
let waterPat1 = null, waterPat2 = null;
function drawWater(ctx, ox, oy, lw, lh, now) {
  if (!waterPat1) { waterPat1 = ctx.createPattern(WATER_TILE, 'repeat'); waterPat2 = ctx.createPattern(WATER_TILE2, 'repeat'); }
  const t = now / 1000;
  ctx.save();
  ctx.translate(Math.round(ox + t * 2) % 64, Math.round(oy + t * 1) % 32);
  ctx.fillStyle = waterPat1; ctx.fillRect(-64, -32, lw + 128, lh + 64);
  ctx.restore();
  ctx.save();
  ctx.translate(Math.round(ox - t * 5) % 48, Math.round(oy + t * 2.5) % 24);
  ctx.fillStyle = waterPat2; ctx.fillRect(-48, -24, lw + 96, lh + 48);
  ctx.restore();
}
// correnteza do rio: tracinhos claros andando na direção do fluxo
function drawRiverFlow(ctx, ox, oy, minX, maxX, minY, maxY, now) {
  ctx.fillStyle = 'rgba(200,230,250,0.55)';
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
    const i = y * MAP_W + x;
    if (!WORLD.river[i] || WORLD.ground[i] !== T.WATER) continue;
    const fx = WORLD.flow[i * 2], fy = WORLD.flow[i * 2 + 1];
    for (let k = 0; k < 2; k++) {
      const ph = ((now / 1400) + hash2(x, y, 40 + k)) % 1;
      const tx = x - 0.5 + hash2(x, y, 50 + k) + fx * (ph - 0.5), ty = y - 0.5 + hash2(x, y, 60 + k) + fy * (ph - 0.5);
      const p = iso(tx, ty), sx = Math.round(p.sx + ox), sy = Math.round(p.sy + oy);
      const dx = (fx - fy) * 16, dy = (fx + fy) * 8, L = Math.hypot(dx, dy) || 1;
      ctx.globalAlpha = Math.sin(ph * Math.PI) * 0.8;
      ctx.fillRect(sx, sy, 1, 1); ctx.fillRect(Math.round(sx - dx / L * 2), Math.round(sy - dy / L * 2), 1, 1); ctx.fillRect(Math.round(sx - dx / L * 4), Math.round(sy - dy / L * 4), 1, 1);
    }
  }
  ctx.globalAlpha = 1;
}

// profundidade da água por tile (0 = margem)
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
