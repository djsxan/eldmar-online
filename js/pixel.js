// ============================================================
//  PIXEL — "pincel" de pixel art. Desenha sprites pixel a pixel
//  num buffer, aplica contorno automático e guarda em cache.
//  Cada sprite é gerado UMA vez; depois é só copiar (rápido).
// ============================================================
const _rgbCache = new Map();
function rgbOf(hex) {
  let v = _rgbCache.get(hex);
  if (!v) { const n = parseInt(hex.slice(1), 16); v = [n >> 16, (n >> 8) & 255, n & 255]; _rgbCache.set(hex, v); }
  return v;
}
// cor (hex) -> inteiro 32 bits (ABGR), com clarear (+) / escurecer (-)
function px(hex, amt = 0, a = 255) {
  let [r, g, b] = rgbOf(hex);
  if (amt) { const t = amt < 0 ? 0 : 255, f = Math.abs(amt); r += (t - r) * f; g += (t - g) * f; b += (t - b) * f; }
  return ((a << 24) | (Math.round(b) << 16) | (Math.round(g) << 8) | Math.round(r)) >>> 0;
}
function pxMix(hexA, hexB, t) {
  const a = rgbOf(hexA), b = rgbOf(hexB);
  return ((255 << 24) | (Math.round(a[2] + (b[2] - a[2]) * t) << 16) | (Math.round(a[1] + (b[1] - a[1]) * t) << 8) | Math.round(a[0] + (b[0] - a[0]) * t)) >>> 0;
}
// tom (hex) com variações prontas
function tone(hex) { return { b: px(hex), l: px(hex, 0.28), ll: px(hex, 0.5), d: px(hex, -0.28), dd: px(hex, -0.5), hex }; }

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
const dith = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];

class PC {
  constructor(w, h) { this.w = w; this.h = h; this.d = new Uint32Array(w * h); }
  p(x, y, c) { x = Math.floor(x); y = Math.floor(y); if (x >= 0 && y >= 0 && x < this.w && y < this.h && c) this.d[y * this.w + x] = c; }
  g(x, y) { x = Math.floor(x); y = Math.floor(y); return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.d[y * this.w + x] : 0; }
  r(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.p(x + i, y + j, c); }
  // elipse cheia (teste no centro do pixel). shade(x,y,nx,ny) opcional devolve cor
  e(cx, cy, rx, ry, c, shade) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
      if (nx * nx + ny * ny <= 1) this.p(x, y, shade ? shade(x, y, nx, ny) : c);
    }
  }
  // linha (Bresenham), com espessura opcional
  l(x0, y0, x1, y1, c, w = 1) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (let n = 0; n < 400; n++) {
      if (w <= 1) this.p(x0, y0, c);
      else { const o = Math.floor((w - 1) / 2); this.r(x0 - o, y0 - o, w, w, c); }
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  // polígono cheio (regra par-ímpar no centro do pixel)
  poly(pts, c, shade) {
    let minY = Infinity, maxY = -Infinity;
    for (let i = 1; i < pts.length; i += 2) { minY = Math.min(minY, pts[i]); maxY = Math.max(maxY, pts[i]); }
    const n = pts.length / 2;
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      const yc = y + 0.5, xs = [];
      for (let i = 0; i < n; i++) {
        const ax = pts[i * 2], ay = pts[i * 2 + 1], bx = pts[((i + 1) % n) * 2], by = pts[((i + 1) % n) * 2 + 1];
        if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) xs.push(ax + (yc - ay) / (by - ay) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2)
        for (let x = Math.ceil(xs[k] - 0.5); x <= Math.floor(xs[k + 1] - 0.5); x++) this.p(x, y, shade ? shade(x, y) : c);
    }
  }
  // contorno de 1 pixel: cor escura derivada do vizinho (fica mais suave que preto)
  outline(k = 0.32, skipBottom = false) {
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
      out[y * w + x] = ((255 << 24) | (Math.round(b + 8) << 16) | (Math.round(g + 6) << 8) | Math.round(r + 10)) >>> 0;
    }
    this.d = out;
  }
  canvas() {
    const c = document.createElement('canvas'); c.width = this.w; c.height = this.h;
    const id = new ImageData(new Uint8ClampedArray(this.d.buffer.slice(0)), this.w, this.h);
    c.getContext('2d').putImageData(id, 0, 0);
    return c;
  }
  white() {
    const c = document.createElement('canvas'); c.width = this.w; c.height = this.h;
    const d = new Uint32Array(this.d.length);
    for (let i = 0; i < d.length; i++) if (this.d[i]) d[i] = 0xffffffff;
    c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(d.buffer), this.w, this.h), 0, 0);
    return c;
  }
}

// cache de sprites: key -> { c, w, h, ax, ay, white? }
const SPR = new Map();
let sprBuilds = 0;
function sprite(key, w, h, ax, ay, draw, opts = {}) {
  let s = SPR.get(key);
  if (s) return s;
  const pc = new PC(w, h);
  draw(pc);
  if (opts.outline !== false) pc.outline(opts.k || 0.32, opts.skipBottom);
  s = { c: pc.canvas(), w, h, ax, ay, pc: opts.keepWhite ? pc : null };
  SPR.set(key, s);
  sprBuilds++;
  if (SPR.size > 6000) { const first = SPR.keys().next().value; SPR.delete(first); }
  return s;
}
function whiteOf(s, key) {
  let w = SPR.get(key + '|w');
  if (w) return w;
  const c = document.createElement('canvas'); c.width = s.w; c.height = s.h;
  const x = c.getContext('2d');
  x.drawImage(s.c, 0, 0);
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = '#fff'; x.fillRect(0, 0, s.w, s.h);
  w = { c, w: s.w, h: s.h, ax: s.ax, ay: s.ay };
  SPR.set(key + '|w', w);
  return w;
}
// desenha sprite em posição inteira (espelhado se flip)
function blit(ctx, s, x, y, flip) {
  x = Math.round(x); y = Math.round(y);
  if (!flip) ctx.drawImage(s.c, x - s.ax, y - s.ay);
  else { ctx.save(); ctx.translate(x, y); ctx.scale(-1, 1); ctx.drawImage(s.c, -s.ax, -s.ay); ctx.restore(); }
}
