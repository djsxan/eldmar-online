// ============================================================
//  PIXEL — "pincel" de pixel art. Desenha sprites num buffer,
//  aplica contorno suave e guarda em cache.
//  Suporta escala (k): o desenho usa coordenadas "lógicas" e é
//  rasterizado k vezes mais detalhado (pixel art realista).
// ============================================================
const ART = 2; // resolução da arte (2 = dobro de detalhe)
const _rgbCache = new Map();
function rgbOf(hex) {
  let v = _rgbCache.get(hex);
  if (!v) { const n = parseInt(hex.slice(1), 16); v = [n >> 16, (n >> 8) & 255, n & 255]; _rgbCache.set(hex, v); }
  return v;
}
function px(hex, amt = 0, a = 255) {
  let [r, g, b] = rgbOf(hex);
  if (amt) { const t = amt < 0 ? 0 : 255, f = Math.abs(amt); r += (t - r) * f; g += (t - g) * f; b += (t - b) * f; }
  return ((a << 24) | (Math.round(b) << 16) | (Math.round(g) << 8) | Math.round(r)) >>> 0;
}
function pxMix(hexA, hexB, t) {
  const a = rgbOf(hexA), b = rgbOf(hexB);
  return ((255 << 24) | (Math.round(a[2] + (b[2] - a[2]) * t) << 16) | (Math.round(a[1] + (b[1] - a[1]) * t) << 8) | Math.round(a[0] + (b[0] - a[0]) * t)) >>> 0;
}
// tom com 7 variações (mais tons = visual mais realista)
function tone(hex) { return { b: px(hex), l: px(hex, 0.18), ll: px(hex, 0.38), lll: px(hex, 0.6), d: px(hex, -0.2), dd: px(hex, -0.4), ddd: px(hex, -0.6), hex }; }
// escolhe um tom pela luz (-1 escuro .. 1 claro) com leve pontilhado retrô
function lit(T, l, x, y) {
  const v = l + (dith(x, y) - 0.5) * 0.22;
  return v > 0.72 ? T.ll : v > 0.38 ? T.l : v > -0.05 ? T.b : v > -0.42 ? T.d : v > -0.75 ? T.dd : T.ddd;
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
const dith = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];

class PC {
  constructor(w, h, k = 1) { this.k = k; this.w = Math.ceil(w * k); this.h = Math.ceil(h * k); this.d = new Uint32Array(this.w * this.h); }
  P(x, y, c) { if (x >= 0 && y >= 0 && x < this.w && y < this.h && c) this.d[y * this.w + x] = c; }
  // pixel lógico (vira um bloco k x k)
  p(x, y, c) { const k = this.k, X = Math.floor(x * k), Y = Math.floor(y * k); for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) this.P(X + i, Y + j, c); }
  g(x, y) { const X = Math.floor(x * this.k), Y = Math.floor(y * this.k); return X >= 0 && Y >= 0 && X < this.w && Y < this.h ? this.d[Y * this.w + X] : 0; }
  r(x, y, w, h, c) { const k = this.k; for (let Y = Math.round(y * k); Y < Math.round((y + h) * k); Y++) for (let X = Math.round(x * k); X < Math.round((x + w) * k); X++) this.P(X, Y, c); }
  e(cx, cy, rx, ry, c, shade) {
    const k = this.k; cx *= k; cy *= k; rx *= k; ry *= k;
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
      if (nx * nx + ny * ny <= 1) this.P(x, y, shade ? shade(x, y, nx, ny) : c);
    }
  }
  l(x0, y0, x1, y1, c, w = 1) {
    const k = this.k; w = Math.max(1, Math.round(w * k));
    x0 = Math.round(x0 * k); y0 = Math.round(y0 * k); x1 = Math.round(x1 * k); y1 = Math.round(y1 * k);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    const o = Math.floor((w - 1) / 2);
    for (let n = 0; n < 2000; n++) {
      if (w <= 1) this.P(x0, y0, c); else for (let j = 0; j < w; j++) for (let i = 0; i < w; i++) this.P(x0 - o + i, y0 - o + j, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  // polígono cheio. shade(xRaw, yRaw, xLógico, yLógico)
  poly(pts, c, shade) {
    const k = this.k, n = pts.length / 2;
    let minY = Infinity, maxY = -Infinity;
    for (let i = 1; i < pts.length; i += 2) { minY = Math.min(minY, pts[i] * k); maxY = Math.max(maxY, pts[i] * k); }
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      const yc = y + 0.5, xs = [];
      for (let i = 0; i < n; i++) {
        const ax = pts[i * 2] * k, ay = pts[i * 2 + 1] * k, bx = pts[((i + 1) % n) * 2] * k, by = pts[((i + 1) % n) * 2 + 1] * k;
        if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) xs.push(ax + (yc - ay) / (by - ay) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let q = 0; q + 1 < xs.length; q += 2)
        for (let x = Math.ceil(xs[q] - 0.5); x <= Math.floor(xs[q + 1] - 0.5); x++) this.P(x, y, shade ? shade(x, y, (x + 0.5) / k, (y + 0.5) / k) : c);
    }
  }
  // cápsula afunilada (membros): sombreada como um cilindro
  cap(ax, ay, bx, by, ra, rb, T, lightSide = -1) {
    const k = this.k; ax *= k; ay *= k; bx *= k; by *= k; ra *= k; rb *= k;
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1, L = Math.sqrt(L2);
    const nx = -dy / L, ny = dx / L; // normal
    const minX = Math.floor(Math.min(ax - ra, bx - rb)), maxX = Math.ceil(Math.max(ax + ra, bx + rb));
    const minY = Math.floor(Math.min(ay - ra, by - rb)), maxY = Math.ceil(Math.max(ay + ra, by + rb));
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const px_ = x + 0.5 - ax, py_ = y + 0.5 - ay;
      let t = (px_ * dx + py_ * dy) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const r = ra + (rb - ra) * t;
      const qx = px_ - dx * t, qy = py_ - dy * t, d2 = qx * qx + qy * qy;
      if (d2 > r * r) continue;
      const side = (qx * nx + qy * ny) / (r || 1); // -1..1 através do membro
      const e = Math.sqrt(d2) / (r || 1);
      const l = -(nx * side * 0.6 + ny * side * 0.8) * 0.95 + 0.12 - e * e * 0.3 + (lightSide - -1) * 0;
      this.P(x, y, lit(T, l, x, y));
    }
  }
  outline(k = 0.38, skipBottom = false) {
    const w = this.w, h = this.h, src = this.d, out = new Uint32Array(src);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (src[y * w + x]) continue;
      let n = 0;
      if (x > 0 && src[y * w + x - 1]) n = src[y * w + x - 1];
      else if (x < w - 1 && src[y * w + x + 1]) n = src[y * w + x + 1];
      else if (y > 0 && src[(y - 1) * w + x]) n = src[(y - 1) * w + x];
      else if (!skipBottom && y < h - 1 && src[(y + 1) * w + x]) n = src[(y + 1) * w + x];
      if (!n || (n >>> 24) < 200) continue;
      const r = (n & 255) * k, g = ((n >> 8) & 255) * k, b = ((n >> 16) & 255) * k;
      out[y * w + x] = ((255 << 24) | (Math.round(b + 6) << 16) | (Math.round(g + 5) << 8) | Math.round(r + 8)) >>> 0;
    }
    this.d = out;
  }
  canvas() {
    const c = document.createElement('canvas'); c.width = this.w; c.height = this.h;
    c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(this.d.buffer.slice(0)), this.w, this.h), 0, 0);
    return c;
  }
}

// cache de sprites: key -> { c, w, h, ax, ay } (já na resolução final)
const SPR = new Map();
function sprite(key, w, h, ax, ay, draw, opts = {}) {
  let s = SPR.get(key);
  if (s) return s;
  const k = opts.k || 1;
  const pc = new PC(w, h, k);
  draw(pc);
  if (opts.outline !== false) pc.outline(opts.ok || 0.38, opts.skipBottom);
  s = { c: pc.canvas(), w: pc.w, h: pc.h, ax: Math.round(ax * k), ay: Math.round(ay * k) };
  SPR.set(key, s);
  if (SPR.size > 2600) { const first = SPR.keys().next().value; SPR.delete(first); }
  return s;
}
function whiteOf(s, key) {
  let w = SPR.get(key + '|w');
  if (w) return w;
  const c = document.createElement('canvas'); c.width = s.w; c.height = s.h;
  const x = c.getContext('2d');
  x.drawImage(s.c, 0, 0);
  x.globalCompositeOperation = 'source-in'; x.fillStyle = '#fff'; x.fillRect(0, 0, s.w, s.h);
  w = { c, w: s.w, h: s.h, ax: s.ax, ay: s.ay };
  SPR.set(key + '|w', w);
  return w;
}
function blit(ctx, s, x, y, flip) {
  x = Math.round(x); y = Math.round(y);
  if (!flip) ctx.drawImage(s.c, x - s.ax, y - s.ay);
  else { ctx.save(); ctx.translate(x, y); ctx.scale(-1, 1); ctx.drawImage(s.c, -s.ax, -s.ay); ctx.restore(); }
}
