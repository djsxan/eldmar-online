// ============================================================
//  PAINT — "pincel" de pintura digital. Gera sprites em estilo
//  pintado à mão (traços suaves, degradês, pinceladas) usando o
//  canvas vetorial, em alta resolução, e guarda em cache.
//  Coordenadas em "unidades de arte" (as mesmas do mundo).
// ============================================================
const RS = 2.5; // resolução da textura (pixels por unidade de arte)

// gerador pseudo-aleatório determinístico
function rng(seed) { let s = (seed * 2654435761) >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; }; }
function hexA(hex, a) { const [r, g, b] = rgbOf(hex); return `rgba(${r},${g},${b},${a})`; }
function mixHex(a, b, t) { const A = rgbOf(a), Bc = rgbOf(b); const h = v => Math.round(v).toString(16).padStart(2, '0'); return '#' + h(A[0] + (Bc[0] - A[0]) * t) + h(A[1] + (Bc[1] - A[1]) * t) + h(A[2] + (Bc[2] - A[2]) * t); }
function shadeH(hex, amt) { return amt < 0 ? mixHex(hex, '#000000', -amt) : mixHex(hex, '#ffffff', amt); }

const PSPR = new Map();
// cria um sprite pintado: draw(ctx, R) desenha em unidades de arte
function paint(key, w, h, ax, ay, draw) {
  let s = PSPR.get(key);
  if (s) return s;
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * RS); c.height = Math.ceil(h * RS);
  const x = c.getContext('2d');
  x.scale(RS, RS);
  x.lineCap = 'round'; x.lineJoin = 'round';
  draw(x, rng(hashStr(key)));
  s = { c, w, h, ax, ay, painted: true };
  PSPR.set(key, s);
  return s;
}
function hashStr(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
// desenha sprite pintado (no contexto do mundo, em unidades de arte)
function pblit(ctx, s, x, y, alpha) {
  if (alpha != null) ctx.globalAlpha = alpha;
  ctx.drawImage(s.c, x - s.ax, y - s.ay, s.w, s.h);
  if (alpha != null) ctx.globalAlpha = 1;
}
// silhueta escura (para sombras projetadas)
const SHSPR = new Map();
function silhouette(s) {
  let k = SHSPR.get(s);
  if (k) return k;
  const c = document.createElement('canvas'); c.width = s.c.width; c.height = s.c.height;
  const x = c.getContext('2d'); x.drawImage(s.c, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height);
  k = { c, w: s.w, h: s.h, ax: s.ax, ay: s.ay };
  SHSPR.set(s, k);
  return k;
}

// ---------- pinceladas ----------
function dab(ctx, x, y, rx, ry, color, rot = 0) { ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.05, rx), Math.max(0.05, ry), rot, 0, Math.PI * 2); ctx.fill(); }
function softDab(ctx, x, y, r, color, a) { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, hexA(color, a)); g.addColorStop(1, hexA(color, 0)); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); }
function stroke(ctx, pts, color, w) { ctx.strokeStyle = color; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.stroke(); }
function curve(ctx, x0, y0, cx, cy, x1, y1, color, w) { ctx.strokeStyle = color; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(cx, cy, x1, y1); ctx.stroke(); }
function shape(ctx, pts, fill) { ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); }
function lgrad(ctx, x0, y0, x1, y1, stops) { const g = ctx.createLinearGradient(x0, y0, x1, y1); stops.forEach(([t, c]) => g.addColorStop(t, c)); return g; }
function rgrad(ctx, x, y, r0, r1, stops) { const g = ctx.createRadialGradient(x, y, r0, x, y, r1); stops.forEach(([t, c]) => g.addColorStop(t, c)); return g; }

// folhagem: muitas pinceladas com luz vinda de cima/esquerda
function foliage(ctx, R, cx, cy, rx, ry, pal, count, size = 3.2) {
  // massa escura de base
  dab(ctx, cx, cy + ry * 0.1, rx, ry, pal[0]);
  for (let i = 0; i < count; i++) {
    const a = R() * Math.PI * 2, d = Math.sqrt(R());
    const x = cx + Math.cos(a) * rx * d * 0.95, y = cy + Math.sin(a) * ry * d * 0.95;
    const lightv = (-(x - cx) / rx * 0.55 - (y - cy) / ry * 0.75) + (R() - 0.5) * 0.6;
    const idx = lightv > 0.7 ? 4 : lightv > 0.25 ? 3 : lightv > -0.2 ? 2 : lightv > -0.6 ? 1 : 0;
    const s = size * (0.6 + R() * 0.7);
    dab(ctx, x, y, s, s * 0.7, pal[Math.min(pal.length - 1, idx)], R() * 3);
  }
}

// textura procedural (padrão repetível) para paredes, telhados etc.
const TEX = new Map();
function texPattern(ctx, kind, base) {
  const key = kind + base;
  let t = TEX.get(key);
  if (!t) {
    const S = 64, c = document.createElement('canvas'); c.width = S; c.height = S;
    const x = c.getContext('2d'), R = rng(hashStr(key));
    x.fillStyle = base; x.fillRect(0, 0, S, S);
    if (kind === 'stone') {
      for (let row = 0; row < 8; row++) for (let col = 0; col < 4; col++) {
        const off = row % 2 ? 8 : 0, bx = col * 16 + off, by = row * 8;
        x.fillStyle = shadeH(base, (R() - 0.5) * 0.25); x.fillRect(bx + 0.8, by + 0.8, 14.4, 6.4);
        x.fillStyle = 'rgba(255,255,255,0.10)'; x.fillRect(bx + 1, by + 1, 13, 1.2);
        x.fillStyle = 'rgba(0,0,0,0.18)'; x.fillRect(bx + 1, by + 6, 14, 1.2);
        if (bx + 16 > S) { x.fillStyle = shadeH(base, (R() - 0.5) * 0.25); x.fillRect(bx - S + 0.8, by + 0.8, 14.4, 6.4); }
      }
      for (let i = 0; i < 40; i++) dab(x, R() * S, R() * S, 0.6 + R(), 0.4 + R() * 0.6, `rgba(0,0,0,${0.08 + R() * 0.1})`);
    } else if (kind === 'plaster') {
      for (let i = 0; i < 160; i++) dab(x, R() * S, R() * S, 1 + R() * 3, 0.6 + R() * 2, shadeH(base, (R() - 0.5) * 0.12), R() * 3);
    } else if (kind === 'wood') {
      for (let i = 0; i < 8; i++) { x.fillStyle = shadeH(base, (R() - 0.5) * 0.2); x.fillRect(i * 8, 0, 7.4, S); x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(i * 8 + 7.4, 0, 0.6, S); }
      for (let i = 0; i < 30; i++) stroke(x, [R() * S, R() * S, R() * S, R() * S], 'rgba(0,0,0,0.08)', 0.4);
    } else if (kind === 'shingle') {
      for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) {
        const off = row % 2 ? 4 : 0, bx = col * 8 + off, by = row * 8;
        x.fillStyle = shadeH(base, (R() - 0.5) * 0.22); x.beginPath(); x.ellipse(bx + 4, by + 5, 4, 4.5, 0, 0, Math.PI); x.fill();
        x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(bx, by + 7.5, 8, 0.6);
      }
    } else if (kind === 'thatch') {
      for (let i = 0; i < 260; i++) { const px_ = R() * S, py = R() * S; stroke(x, [px_, py, px_ + (R() - 0.5) * 2, py + 4 + R() * 4], shadeH(base, (R() - 0.5) * 0.3), 0.6 + R() * 0.6); }
    }
    t = c; TEX.set(key, t);
  }
  const p = ctx.createPattern(t, 'repeat');
  p.setTransform(new DOMMatrix([0.5, 0, 0, 0.5, 0, 0]));
  return p;
}
// chama liveFlame no render: chama animada desenhada a cada quadro (fluida)
function liveFlame(ctx, x, y, s, now, seed) {
  const f = Math.sin(now / 90 + seed) * 0.15 + Math.sin(now / 53 + seed * 2) * 0.1;
  const h = 18 * s * (1 + f * 0.6);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  softDab(ctx, x, y - h * 0.4, h * 1.1, '#ff7a20', 0.35);
  ctx.restore();
  const layer = (col, w, hh, sway) => {
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(x - w, y);
    ctx.bezierCurveTo(x - w, y - hh * 0.5, x + sway - w * 0.3, y - hh * 0.7, x + sway, y - hh);
    ctx.bezierCurveTo(x + sway + w * 0.3, y - hh * 0.7, x + w, y - hh * 0.5, x + w, y);
    ctx.closePath(); ctx.fill();
  };
  layer('rgba(200,50,20,0.9)', 7 * s, h, Math.sin(now / 110 + seed) * 3 * s);
  layer('rgba(250,140,40,0.95)', 5 * s, h * 0.75, Math.sin(now / 80 + seed) * 2.4 * s);
  layer('rgba(255,225,120,0.95)', 2.8 * s, h * 0.45, Math.sin(now / 70 + seed) * 1.6 * s);
}
