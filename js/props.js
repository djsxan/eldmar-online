// ============================================================
//  PROPS — objetos do cenário em pixel art (gerados e guardados
//  em cache): vegetação, móveis, castelo, montanha e construções.
// ============================================================
const FLOOR_H = 24;               // altura de um andar (pixels lógicos)
const FLOOR_PX = FLOOR_H * ART;    // altura de um andar na tela de arte
function sprA(key, w, h, ax, ay, draw, opts = {}) { return sprite(key, w, h, ax, ay, draw, { ...opts, k: ART }); }
const CLIFF_H = [0, 20, 34, 48, 62];

function hv(x, y, s) { return hash2(x | 0, y | 0, s); }

// ---------- vegetação ----------
function treeSprite(v, w, tint) {
  return sprA(`tree|${v}|${w}|${tint}`, 44, 54, 22, 50, pc => {
    const pal = tint === 1 ? ['#2d5a2a', '#3f7a34', '#5a9a42', '#7ab852'] : tint === 2 ? ['#6a4a1e', '#9a6a24', '#c4902e', '#e0b44a'] : tint === 3 ? ['#24402a', '#2f5a36', '#3f7244', '#58905a'] : ['#2f5e26', '#447f30', '#62a03e', '#86c052'];
    const C4 = pal.map(h => px(h));
    const bark = tone('#5a3e26');
    // tronco com raízes
    pc.poly([19, 50, 25, 50, 24, 30, 20, 30], 0, (x) => x < 21 ? bark.l : x > 22 ? bark.d : bark.b);
    pc.poly([15, 50, 19, 47, 20, 50], bark.d); pc.poly([25, 50, 29, 50, 24, 47], bark.d);
    pc.l(21, 44, 21, 34, bark.dd, 1); pc.l(23, 47, 23, 38, bark.l, 1);
    pc.l(22, 34, 15, 27, bark.b, 2); pc.l(22, 33, 29, 26, bark.d, 2);
    const sway = w - 1; // -1, 0, 1
    const rnd = (k) => hash2(v, k, 77);
    const blobs = [[22, 22, 13, 10], [13, 27, 8, 7], [31, 27, 8, 7], [16, 15, 8, 7], [28, 15, 8, 7], [22, 10, 8, 6]];
    for (let k = 0; k < blobs.length; k++) {
      const [bx, by, rx, ry] = blobs[k];
      const sx = bx + (rnd(k) - 0.5) * 3 + sway * (by < 18 ? 1 : 0), sy = by + (rnd(k + 9) - 0.5) * 2;
      pc.e(sx, sy, rx, ry, 0, (x, y, nx, ny) => {
        const l = -nx * 0.5 - ny * 0.8 + (hash2(x, y, 3) - 0.5) * 0.5;
        const t = l + dith(x, y) * 0.5;
        return t > 0.75 ? C4[3] : t > 0.25 ? C4[2] : t > -0.35 ? C4[1] : C4[0];
      });
    }
    if (tint === 0 && v === 1) for (let k = 0; k < 5; k++) pc.p(12 + rnd(k + 20) * 20, 12 + rnd(k + 30) * 18, px('#c0392b'));
  });
}
function pineSprite(v, w) {
  return sprA(`pine|${v}|${w}`, 32, 56, 16, 52, pc => {
    const C3 = [px('#163a24'), px('#1f4e2e'), px('#2d6a3c'), px('#46875a')];
    pc.r(14, 42, 4, 10, px('#4a3020'));
    for (let k = 0; k < 4; k++) {
      const top = 6 + k * 10, half = 6 + k * 3, sway = (w - 1) * (3 - k) * 0.5;
      pc.poly([16 + sway, top - 4, 16 + half + sway * 0.3, top + 12, 16 - half + sway * 0.3, top + 12], 0, (x, y) => {
        const t = (16 - x) / half * 0.6 - (y - top) / 16 + dith(x, y) * 0.4;
        return t > 0.5 ? C3[3] : t > 0.05 ? C3[2] : t > -0.5 ? C3[1] : C3[0];
      });
    }
  });
}
function rockSprite(v, mossy) {
  return sprA(`rock|${v}|${mossy}`, 28, 22, 14, 18, pc => {
    const s = 0.8 + hash2(v, 1, 5) * 0.35, r = tone('#7d7b74');
    pc.e(14, 12, 11 * s, 7 * s, 0, (x, y, nx, ny) => { const l = -nx * 0.6 - ny + (hash2(x, y, 2) - 0.5) * 0.4 + dith(x, y) * 0.3; return l > 0.6 ? r.ll : l > 0 ? r.l : l > -0.6 ? r.b : r.d; });
    pc.e(10, 9, 4 * s, 3 * s, 0, (x, y, nx, ny) => ny < 0 ? r.ll : 0);
    if (mossy) pc.e(12, 7, 6 * s, 2, 0, (x, y) => hash2(x, y, 4) < 0.7 ? px('#5a7a3a') : 0);
  });
}
function bushSprite(v, w) {
  return sprA(`bush|${v}|${w}`, 26, 20, 13, 17, pc => {
    const C4 = [px('#24521f'), px('#336e2a'), px('#4a8c36'), px('#6aa848')];
    for (const [bx, by, r] of [[8, 11, 6], [18, 11, 6], [13, 7, 7]]) pc.e(bx + (by < 9 ? w - 1 : 0), by, r, r * 0.8, 0, (x, y, nx, ny) => { const t = -nx * 0.4 - ny + dith(x, y) * 0.5; return t > 0.8 ? C4[3] : t > 0.2 ? C4[2] : t > -0.5 ? C4[1] : C4[0]; });
    if (v === 2) for (let k = 0; k < 5; k++) pc.p(6 + hash2(k, 1, 9) * 14, 5 + hash2(k, 2, 9) * 9, px('#7a2a4a'));
  });
}
function grassSprite(v, w, dry) {
  return sprA(`tg|${v}|${w}|${dry}`, 24, 18, 12, 15, pc => {
    const cols = dry ? [px('#a8955a'), px('#c4b070'), px('#8a7a44')] : [px('#3f7a2e'), px('#5a9a3e'), px('#2f6224')];
    for (let k = 0; k < 9; k++) {
      const bx = 3 + hash2(v, k, 1) * 18, ht = 6 + hash2(v, k, 2) * 7, bend = (w - 1) * 1.5 + (hash2(v, k, 3) - 0.5) * 2;
      pc.l(bx, 15, bx + bend * 0.5, 15 - ht * 0.5, cols[k % 3], 1); pc.l(bx + bend * 0.5, 15 - ht * 0.5, bx + bend, 15 - ht, cols[(k + 1) % 3], 1);
    }
  }, { outline: false });
}
function smallSprite(kind, v, w) {
  switch (kind) {
    case 'mushroom': return sprA(`mush|${v}`, 20, 14, 10, 12, pc => {
      const glow = v >= 2;
      for (let k = 0; k < 3; k++) { const x = 4 + k * 5 + hash2(v, k, 1) * 2, s = 0.7 + hash2(v, k, 2) * 0.5; pc.r(x, 12 - 4 * s, 2, 4 * s, px('#ece4d0')); pc.e(x + 1, 12 - 4 * s, 3 * s, 2 * s, 0, (xx, yy, nx, ny) => ny > 0.3 ? 0 : glow ? px('#5ac8f0') : (hash2(xx, yy, 3) < 0.15 ? px('#f4efe2') : px('#b83a2a'))); }
    });
    case 'reeds': return sprA(`reeds|${v}|${w}`, 22, 26, 11, 23, pc => {
      for (let k = 0; k < 6; k++) { const x = 3 + hash2(v, k, 1) * 16, ht = 12 + hash2(v, k, 2) * 9, b = (w - 1) * 1.5; pc.l(x, 23, x + b, 23 - ht, px('#5d7a2e'), 1); if (k % 2 === 0) pc.r(Math.round(x + b) - 1, Math.round(23 - ht), 2, 4, px('#5a3a22')); }
    });
    case 'stump': return sprA('stump', 18, 14, 9, 12, pc => { const b = tone('#5a3e26'); pc.r(3, 4, 12, 7, b.b); pc.r(3, 4, 3, 7, b.l); pc.e(9, 4, 6, 2.5, px('#b08a5a')); pc.e(9, 4, 3, 1.2, px('#8a6a42')); pc.e(9, 11, 6, 1.6, b.d); });
    case 'log': return sprA(`log|${v}`, 32, 16, 16, 12, pc => { const b = tone('#6b4a2b'); const d = v ? 1 : -1; pc.l(5, 8 + d * 2, 26, 8 - d * 2, b.b, 5); pc.l(6, 7 + d * 2, 25, 7 - d * 2, b.l, 1); pc.e(26, 8 - d * 2, 2, 2.5, px('#b08a5a')); });
    case 'deadtree': return sprA(`dead|${v}`, 36, 46, 18, 42, pc => { const c = px('#4a3d33'), c2 = px('#5e4f42'); pc.l(18, 42, 19, 18, c, 3); pc.l(19, 26, 10, 14, c2, 2); pc.l(10, 14, 6, 6, c2, 1); pc.l(19, 22, 28, 12, c, 2); pc.l(28, 12, 30, 4, c, 1); pc.l(19, 18, 18, 6, c2, 1); pc.l(12, 17, 8, 15, c2, 1); });
    case 'grave': return sprA(`grave|${v}`, 18, 22, 9, 19, pc => { pc.e(9, 18, 8, 3, px('#4e4636')); const s = tone('#8e8c84'); pc.poly([4, 18, 4, 7, 6, 4, 12, 4, 14, 7, 14, 18], 0, (x) => x < 6 ? s.l : x > 12 ? s.d : s.b); pc.r(8, 7, 2, 7, s.dd); pc.r(6, 9, 6, 2, s.dd); if (v) pc.e(12, 16, 3, 1.5, px('#4f6a32')); });
    case 'tent': return sprA('tent', 46, 42, 23, 36, pc => { const h = tone('#7a5634'); pc.poly([3, 36, 23, 6, 25, 40], 0, (x, y) => (x + y) % 6 === 0 ? h.d : h.b); pc.poly([25, 40, 23, 6, 43, 36], 0, (x, y) => (x + y) % 6 === 0 ? h.dd : h.d); pc.poly([20, 38, 23, 22, 27, 39], px('#24180e')); pc.l(23, 6, 20, 1, px('#3a2a1e'), 1); pc.l(23, 6, 27, 1, px('#3a2a1e'), 1); });
    case 'barrel': return sprA('barrel', 16, 20, 8, 18, pc => { const b = tone('#7a4f26'); pc.e(8, 10, 6, 8, 0, (x) => x < 5 ? b.l : x > 10 ? b.d : b.b); pc.r(2, 5, 12, 1, px('#3f3f46')); pc.r(2, 14, 12, 1, px('#3f3f46')); pc.e(8, 3, 5, 1.6, px('#94632f')); });
    case 'crate': return sprA('crate', 22, 22, 11, 19, pc => { const w2 = tone('#9a7040'); pc.poly([1, 7, 11, 2, 21, 7, 11, 12], w2.l); pc.poly([1, 7, 11, 12, 11, 20, 1, 15], w2.b); pc.poly([11, 12, 21, 7, 21, 15, 11, 20], w2.d); pc.l(1, 7, 11, 20, w2.dd, 1); pc.l(21, 7, 11, 20, w2.dd, 1); });
    case 'hay': return sprA('hay', 28, 22, 14, 19, pc => { const h = tone('#cfa94a'); pc.e(14, 12, 12, 8, 0, (x, y, nx, ny) => hash2(x, y, 1) < 0.2 ? h.d : ny < -0.3 ? h.l : h.b); });
    case 'bench': return sprA('bench', 26, 16, 13, 13, pc => { const w2 = tone('#8a6440'); pc.l(3, 7, 21, 4, w2.b, 3); pc.l(3, 10, 21, 7, w2.l, 2); pc.r(4, 10, 2, 4, w2.dd); pc.r(19, 8, 2, 4, w2.dd); });
    case 'rubblebig': return sprA(`rb|${v}`, 30, 20, 15, 16, pc => { const s = tone('#8a8478'); for (let k = 0; k < 6; k++) pc.e(6 + hash2(v, k, 1) * 18, 9 + hash2(v, k, 2) * 6, 3 + hash2(v, k, 3) * 4, 2 + hash2(v, k, 4) * 2.5, 0, (x, y, nx, ny) => ny < -0.3 ? s.l : nx > 0.4 ? s.d : s.b); });
    case 'dummy': return sprA('dummy', 18, 32, 9, 29, pc => { pc.r(8, 10, 2, 19, px('#5a3a22')); pc.l(2, 14, 16, 14, px('#6b4a2b'), 2); pc.e(9, 16, 4, 6, px('#cfa94a')); pc.e(9, 7, 3.5, 3.5, px('#d9bb6a')); pc.p(8, 6, px('#3a2a1e')); pc.p(10, 6, px('#3a2a1e')); });
    case 'statue': return sprA('statue', 22, 44, 11, 41, pc => {
      const s = tone('#9a968c'); pc.r(3, 33, 16, 8, s.d); pc.r(3, 33, 16, 2, s.l);
      pc.poly([7, 33, 15, 33, 14, 18, 8, 18], 0, (x) => x < 10 ? s.l : s.b); pc.e(11, 14, 3.5, 4, s.b); pc.l(14, 20, 18, 9, s.l, 2); pc.l(18, 9, 18, 3, s.ll, 1);
      pc.r(11, 13, 1, 1, s.dd); pc.e(8, 26, 2, 4, px('#5a7a3a')); pc.p(16, 22, px('#5a7a3a'));
    });
    case 'well': return sprA('well', 32, 42, 16, 38, pc => { const s = tone('#8e8c84'); pc.e(16, 30, 12, 6, s.d); pc.r(4, 24, 24, 6, s.b); pc.e(16, 24, 12, 6, s.l); pc.e(16, 24, 9, 4, px('#1e3046')); pc.r(5, 6, 2, 19, px('#5a3a22')); pc.r(25, 6, 2, 19, px('#5a3a22')); pc.poly([1, 8, 16, 0, 31, 8, 16, 12], px('#7a3a2a')); pc.l(6, 10, 26, 10, px('#4a2f17'), 1); pc.r(17, 14, 4, 4, px('#6b4423')); });
    case 'stall': return sprA('stall', 38, 36, 19, 32, pc => { pc.r(4, 6, 2, 26, px('#5a3a22')); pc.r(32, 6, 2, 26, px('#5a3a22')); pc.poly([3, 22, 19, 28, 35, 22, 19, 16], px('#8a6440')); pc.r(3, 22, 16, 5, px('#6b4a2b')); for (let k = 0; k < 6; k++) pc.e(9 + k * 4, 20 + (k % 2), 1.8, 1.6, px(['#b83a2a', '#d9a62a', '#5a8a2a', '#c86a2a'][k % 4])); for (let k = 0; k < 6; k++) pc.poly([1 + k * 6, 4 + k * 0.6, 7 + k * 6, 4 + k * 0.6, 7 + k * 6, 10, 1 + k * 6, 10], px(k % 2 ? '#ece6d6' : '#9a2a22')); });
    case 'spikes': return sprA('spikes', 30, 22, 15, 19, pc => { for (const [a, b] of [[-8, 2], [0, -1], [8, 2]]) { pc.l(15 + a - 5, 18 + b, 15 + a + 3, 18 + b - 15, px('#6b4a2b'), 2); pc.l(15 + a + 5, 18 + b, 15 + a - 3, 18 + b - 15, px('#5a3a22'), 2); } });
    case 'anvil': return sprA('anvil', 22, 18, 11, 15, pc => { const m = tone('#4a4c52'); pc.r(7, 9, 8, 6, px('#5a3a22')); pc.poly([3, 5, 19, 5, 17, 9, 5, 9], 0, (x, y, lx, ly) => lit(m, ly < 6.5 ? 0.6 : -0.1, x, y)); pc.poly([19, 5, 22, 6, 19, 7], m.d); });
    case 'weaponrack': return sprA('wrack', 26, 30, 13, 26, pc => { const w2 = tone('#6b4a2b'); pc.l(3, 26, 3, 8, w2.b, 2); pc.l(23, 22, 23, 4, w2.d, 2); pc.l(3, 12, 23, 8, w2.l, 2); pc.l(3, 22, 23, 18, w2.b, 2); for (let k = 0; k < 4; k++) { const x = 6 + k * 4.5; pc.l(x, 24 - k * 0.8, x + 1, 2 + k * 0.4, px('#c8ccd2'), 1); pc.l(x - 1.5, 18 - k * 0.8, x + 2.5, 18 - k * 0.8, px('#8a6a2a'), 1); } });
    case 'cart': return sprA('cart', 40, 28, 20, 22, pc => { const w2 = tone('#7a5634'); pc.poly([4, 10, 26, 4, 36, 10, 14, 16], w2.l); pc.poly([4, 10, 14, 16, 14, 20, 4, 14], w2.b); pc.poly([14, 16, 36, 10, 36, 14, 14, 20], w2.d); for (let k = 0; k < 5; k++) pc.e(12 + k * 4, 9 - k * 0.8, 2.5, 1.8, px('#c9a24a', -0.1 * (k % 2))); pc.e(10, 20, 4, 4.5, 0, (x, y, nx, ny) => nx * nx + ny * ny > 0.55 ? px('#4a3020') : px('#7a5634')); pc.e(30, 15, 4, 4.5, 0, (x, y, nx, ny) => nx * nx + ny * ny > 0.55 ? px('#4a3020') : px('#7a5634')); pc.l(36, 12, 40, 14, w2.d, 1); });
    case 'table': return sprA('table', 30, 20, 15, 16, pc => { const w2 = tone('#7a5634'); pc.poly([2, 8, 15, 2, 28, 8, 15, 14], 0, (x, y) => lit(w2, 0.3 + (hash2(x >> 2, y, 3) - 0.5) * 0.3, x, y)); pc.r(4, 9, 2, 7, w2.dd); pc.r(24, 9, 2, 7, w2.dd); pc.r(14, 13, 2, 6, w2.dd); pc.r(11, 6, 3, 3, px('#a0662a')); pc.r(11, 5, 3, 1, px('#f2ead8')); pc.e(18, 8, 2.5, 1.2, px('#d8d2c4')); });
  }
}
function fenceSprite(alongX) {
  return sprA(`fence|${alongX}`, 36, 32, 18, 26, pc => {
    const dx = alongX ? 8 : -8, w2 = tone('#7a5634');
    for (const k of [-1, 0, 1]) {
      const x = 18 + dx * k * 1.05, y = 24 + 4 * k * 1.05;
      pc.r(Math.round(x) - 2, Math.round(y) - 18, 4, 18, k === 0 ? w2.b : w2.d);
      pc.r(Math.round(x) - 2, Math.round(y) - 18, 1, 18, w2.l);
      pc.e(x, y - 18, 2, 2.4, w2.l);
    }
    pc.l(18 - dx * 1.05, 24 - 4 * 1.05 - 12, 18 + dx * 1.05, 24 + 4 * 1.05 - 12, w2.dd, 2);
    pc.l(18 - dx * 1.05, 24 - 4 * 1.05 - 5, 18 + dx * 1.05, 24 + 4 * 1.05 - 5, w2.dd, 2);
  });
}
function flameDraw(pc, cx, by, s, f) {
  const o = [0, 1, 0, -1][f % 4];
  pc.poly([cx - 3 * s, by, cx - 2 * s, by - 5 * s, cx + o, by - 9 * s, cx + 2 * s, by - 5 * s, cx + 3 * s, by], px('#d8402a'));
  pc.poly([cx - 2 * s, by, cx - s, by - 4 * s, cx - o * 0.5, by - 7 * s, cx + s, by - 4 * s, cx + 2 * s, by], px('#f08a2a'));
  pc.e(cx, by - 1.5 * s, 1 * s, 2 * s, px('#ffe08a'));
}
function animSprite(kind, f) {
  switch (kind) {
    case 'torch': return sprA(`torch|${f}`, 12, 34, 6, 31, pc => { pc.r(5, 12, 2, 19, px('#4a2f17')); pc.r(3, 10, 6, 3, px('#5a5a56')); flameDraw(pc, 6, 10, 1, f); }, { outline: false });
    case 'campfire': return sprA(`fire|${f}`, 24, 26, 12, 21, pc => { for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2; pc.e(12 + Math.cos(a) * 8, 19 + Math.sin(a) * 3.5, 2.5, 1.6, px('#6b6b66')); } pc.l(6, 19, 18, 17, px('#4a2f17'), 2); pc.l(6, 17, 18, 19, px('#3b2414'), 2); flameDraw(pc, 12, 18, 1.6, f); });
    case 'brazier': return sprA(`braz|${f}`, 18, 30, 9, 27, pc => { pc.l(5, 27, 9, 17, px('#3a3a3a'), 1); pc.l(13, 27, 9, 17, px('#3a3a3a'), 1); pc.e(9, 15, 6, 2.5, px('#4a4a4a')); pc.r(3, 13, 12, 3, px('#2e2e2e')); flameDraw(pc, 9, 13, 1.3, f); });
    case 'lamp': return sprA(`lamp`, 18, 46, 6, 43, pc => { pc.r(4, 40, 5, 3, px('#26262a')); pc.r(5, 8, 2, 33, px('#2a2a2e')); pc.l(6, 8, 12, 7, px('#2a2a2e'), 1); pc.r(10, 8, 5, 6, px('#ffd890')); pc.poly([9, 8, 16, 8, 12.5, 4], px('#2a2a2e')); });
    case 'banner': return sprA(`ban|${f}`, 22, 50, 4, 47, pc => { pc.r(3, 2, 2, 45, px('#4a2f17')); pc.e(4, 2, 1.6, 1.6, px('#c9a24a')); const w2 = [0, 1, 2, 1][f]; const c = tone('#2a3f6b'); pc.poly([5, 4, 17 + w2, 5, 17 + w2 * 1.5, 26, 11 + w2, 22, 5, 26], 0, (x, y) => (x + y) % 7 === 0 ? c.d : c.b); pc.e(11 + w2 * 0.6, 13, 2.5, 2.5, px('#c9a24a')); });
    case 'fountain': return sprA(`fount|${f}`, 42, 36, 21, 30, pc => {
      const s = tone('#9a968c');
      pc.e(21, 26, 18, 8, s.d); pc.e(21, 24, 18, 8, s.l); pc.e(21, 24, 15, 6, 0, (x, y) => hash2(x + f, y, 1) < 0.08 ? px('#cfe8ff') : px('#3f78b0'));
      pc.r(19, 10, 4, 14, s.b); pc.r(19, 10, 1, 14, s.ll); pc.e(21, 10, 5, 2.5, s.l); pc.e(21, 10, 3.5, 1.5, px('#3f78b0'));
      for (let k = 0; k < 8; k++) { const t = ((f / 4) + k / 8) % 1, a = k * Math.PI / 4; pc.p(21 + Math.cos(a) * 11 * t, 6 + t * 16 - Math.sin(t * Math.PI) * 6 + Math.sin(a) * 3 * t, px('#d6ecff')); }
    });
  }
}

// ---------- castelo ----------
function wallSprite(v, low, ivy) {
  const H = low ? 10 : FLOOR_H;
  return sprA(`wall|${v}|${low}|${ivy}`, 34, 18 + H + 2, 17, 9 + H, pc => {
    const st = tone('#8f8a7e'), top = 1;
    const o = [17, top];
    const P = (x, y, z) => [o[0] + (x - y) * 16, o[1] + 8 + (x + y) * 8 + H - z]; // x,y em [-0.5,0.5]
    const A = P(-0.5, -0.5, H), Bp = P(0.5, -0.5, H), Cp = P(0.5, 0.5, H), D = P(-0.5, 0.5, H);
    const Cb = P(0.5, 0.5, 0), Db = P(-0.5, 0.5, 0), Bb = P(0.5, -0.5, 0);
    const brick = (x, y, base) => {
      const row = Math.floor((y + 1) / 4), off = row % 2 ? 3 : 0;
      if ((y + 1) % 4 === 0 || (x + off) % 7 === 0) return base.d;
      return hash2(x, y >> 2, v) < 0.15 ? base.l : base.b;
    };
    pc.poly([D[0], D[1], Cp[0], Cp[1], Cb[0], Cb[1], Db[0], Db[1]], 0, (x, y) => brick(x, y, st));
    pc.poly([Cp[0], Cp[1], Bp[0], Bp[1], Bb[0], Bb[1], Cb[0], Cb[1]], 0, (x, y) => brick(x, y, tone('#75705f')));
    // topo (piso do andar 1) com bordas gastas
    pc.poly([A[0], A[1], Bp[0], Bp[1], Cp[0], Cp[1], D[0], D[1]], 0, (x, y) => hash2(x, y, v + 3) < 0.08 ? st.d : (x + y) % 9 === 0 ? st.b : st.l);
    if (low) for (let k = 0; k < 6; k++) pc.p(D[0] + hash2(v, k, 1) * 30, D[1] - 1 - hash2(v, k, 2) * 2, st.d);
    if (ivy) for (let k = 0; k < 40; k++) { const x = Math.floor(D[0] + 2 + hash2(v, k, 5) * 28), y = Math.floor(D[1] + 2 + hash2(v, k, 6) * (H - 2)); if (pc.g(x, y)) pc.p(x, y, k % 3 ? px('#3f6a2e') : px('#5a8a3a')); }
    for (let k = 0; k < 3; k++) { const x = Math.floor(D[0] + 4 + hash2(v, k, 8) * 24), y = Math.floor(D[1] + H * 0.5 + hash2(v, k, 9) * H * 0.3); pc.p(x, y, st.dd); pc.p(x + 1, y + 1, st.dd); }
  });
}
function gateSprite() {
  return sprA('gate', 34, 44, 17, 33, pc => {
    const st = tone('#8f8a7e'), H = FLOOR_H;
    const o = [17, 1];
    const P = (x, y, z) => [o[0] + (x - y) * 16, o[1] + 8 + (x + y) * 8 + H - z];
    const A = P(-0.5, -0.5, H), Bp = P(0.5, -0.5, H), Cp = P(0.5, 0.5, H), D = P(-0.5, 0.5, H);
    const Cm = P(0.5, 0.5, H - 8), Dm = P(-0.5, 0.5, H - 8), Bm = P(0.5, -0.5, H - 8);
    pc.poly([D[0], D[1], Cp[0], Cp[1], Cm[0], Cm[1], Dm[0], Dm[1]], st.b);
    pc.poly([Cp[0], Cp[1], Bp[0], Bp[1], Bm[0], Bm[1], Cm[0], Cm[1]], tone('#75705f').b);
    pc.poly([A[0], A[1], Bp[0], Bp[1], Cp[0], Cp[1], D[0], D[1]], st.l);
    for (let x = Dm[0]; x < Cm[0]; x++) { const t = (x - Dm[0]) / (Cm[0] - Dm[0]); const y = Dm[1] + (Cm[1] - Dm[1]) * t; pc.p(x, y + Math.sin(t * Math.PI) * -3 + 1, st.d); }
  });
}
function towerSprite(v) {
  return sprA(`tower|${v}`, 60, 80, 30, 66, pc => {
    const st = tone('#8f8a7e'), R = 22, H = FLOOR_H + 14, cx = 30, base = 66;
    // corpo cilíndrico (pixels reais)
    const k = pc.k;
    for (let y = (base - H - R) * k; y <= (base + R * 0.5 + 1) * k; y++) for (let x = (cx - R) * k; x <= (cx + R) * k; x++) {
      const lx = (x + 0.5) / k, ly = (y + 0.5) / k, nx = (lx - cx) / R; if (Math.abs(nx) > 1) continue;
      const ey = Math.sqrt(1 - nx * nx) * R * 0.5;
      if (ly > base + ey || ly < base - H + ey) continue;
      const row = Math.floor(ly / 3);
      const mortar = Math.floor(ly * 3) % 9 === 0 || (Math.floor((Math.asin(nx) + 2) * 10 + (row % 2) * 0.5) % 3 === 0 && Math.floor(lx * 3) % 3 === 0);
      const l = -nx * 0.75 + (hash2(Math.floor(lx * 1.5), row, v) - 0.5) * 0.35 - (ly - (base - H)) / H * 0.25;
      pc.P(x, y, mortar ? st.dd : lit(st, l, x, y));
    }
    // topo
    pc.e(cx, base - H, R, R * 0.5, 0, (x, y) => hash2(x, y, v) < 0.06 ? st.d : st.l);
    pc.e(cx, base - H, R - 4, R * 0.5 - 2, 0, (x, y) => (x + y) % 8 === 0 ? st.d : px('#8a857a'));
    // ameias quebradas
    for (let k = 0; k < 12; k++) {
      const a = k / 12 * Math.PI * 2; if (hash2(v, k, 3) < 0.35) continue;
      const mx = cx + Math.cos(a) * (R - 2), my = base - H + Math.sin(a) * (R * 0.5 - 1);
      const hgt = 4 + Math.floor(hash2(v, k, 4) * 3);
      pc.r(Math.round(mx) - 2, Math.round(my) - hgt, 4, hgt, Math.cos(a) < 0 ? st.l : st.b);
    }
    // janela/seteira e hera
    pc.r(cx - 1, base - H + 12, 2, 7, px('#1e1a14'));
    for (let k = 0; k < 50; k++) { const x = Math.floor(cx - R + 3 + hash2(v, k, 5) * 18), y = Math.floor(base - H + 10 + hash2(v, k, 6) * (H - 8)); if (pc.g(x, y)) pc.p(x, y, k % 3 ? px('#3f6a2e') : px('#5a8a3a')); }
  });
}
function stairsSprite(dir) {
  return sprA(`stairs|${dir}`, 34, 44, 17, 33, pc => {
    const st = tone('#9a948a'), H = FLOOR_H;
    const o = [17, 1];
    const P = (x, y, z) => [o[0] + (x - y) * 16, o[1] + 8 + (x + y) * 8 + H - z];
    // degraus subindo na direção dir (1:+x 2:-x 3:+y 4:-y)
    const n = 5;
    for (let k = 0; k < n; k++) {
      const z = (k + 1) * H / n;
      let a0, a1;
      if (dir === 1) { a0 = -0.5 + k / n; a1 = 0.5; }
      if (dir === 2) { a0 = -0.5; a1 = 0.5 - k / n; }
      if (dir === 3) { a0 = -0.5 + k / n; a1 = 0.5; }
      if (dir === 4) { a0 = -0.5; a1 = 0.5 - k / n; }
      const ax = dir <= 2, Q = (u, w, zz) => ax ? P(u, w, zz) : P(w, u, zz);
      const A = Q(a0, -0.5, z), Bp = Q(a1, -0.5, z), Cp = Q(a1, 0.5, z), D = Q(a0, 0.5, z);
      const Cb = Q(a1, 0.5, z - H / n), Db = Q(a0, 0.5, z - H / n), Bb = Q(a1, -0.5, z - H / n);
      pc.poly([A[0], A[1], Bp[0], Bp[1], Cp[0], Cp[1], D[0], D[1]], st.l);
      pc.poly([D[0], D[1], Cp[0], Cp[1], Cb[0], Cb[1], Db[0], Db[1]], st.b);
      pc.poly([Cp[0], Cp[1], Bp[0], Bp[1], Bb[0], Bb[1], Cb[0], Cb[1]], st.d);
    }
  });
}
function slabSprite(v) {
  return sprA('slab|' + v, 34, 22, 17, 9, pc => {
    const st = tone('#8a857a');
    const o = [17, 1];
    const P = (x, y, z) => [o[0] + (x - y) * 16, o[1] + 8 + (x + y) * 8 - z];
    const A = P(-0.5, -0.5, 0), Bp = P(0.5, -0.5, 0), Cp = P(0.5, 0.5, 0), D = P(-0.5, 0.5, 0);
    pc.poly([A[0], A[1], Bp[0], Bp[1], Cp[0], Cp[1], D[0], D[1]], 0, (x, y, lx, ly) => {
      const a1 = (lx - ly * 2 + 40) / 6, a2 = (lx + ly * 2) / 6;
      if (a1 % 1 < 0.12 || a2 % 1 < 0.12) return st.dd;
      return lit(st, (hash2(Math.floor(a1), Math.floor(a2), v) - 0.5) * 0.6 + 0.15, x, y);
    });
    const Cb = P(0.5, 0.5, -3), Db = P(-0.5, 0.5, -3), Bb = P(0.5, -0.5, -3);
    pc.poly([D[0], D[1], Cp[0], Cp[1], Cb[0], Cb[1], Db[0], Db[1]], st.d);
    pc.poly([Cp[0], Cp[1], Bp[0], Bp[1], Bb[0], Bb[1], Cb[0], Cb[1]], st.dd);
  });
}

// ---------- montanha e cachoeira ----------
function cliffSprite(h, v, snow) {
  const H = CLIFF_H[h];
  return sprA(`cliff|${h}|${v}|${snow}`, 36, 20 + H + 6, 18, 12 + H, pc => {
    const rk = tone('#7a7466'), o = [18, 4];
    const P = (x, y, z) => [o[0] + (x - y) * 16, o[1] + 8 + (x + y) * 8 + H - z];
    const j = k => (hash2(v, k, 11) - 0.5) * 4;
    const A = P(-0.5, -0.5, H + j(1)), Bp = P(0.5, -0.5, H + j(2)), Cp = P(0.5, 0.5, H + j(3)), D = P(-0.5, 0.5, H + j(4));
    const Cb = P(0.5, 0.5, 0), Db = P(-0.5, 0.5, 0), Bb = P(0.5, -0.5, 0);
    const rock = (base) => (x, y) => { const n = hash2(x >> 1, y >> 1, v) + (hash2(x, y, 3) - 0.5) * 0.3; return (y + (x >> 2)) % 7 === 0 ? base.d : n > 0.75 ? base.l : n < 0.2 ? base.d : base.b; };
    pc.poly([D[0], D[1], Cp[0], Cp[1], Cb[0], Cb[1] + 1, Db[0], Db[1] + 1], 0, rock(rk));
    pc.poly([Cp[0], Cp[1], Bp[0], Bp[1], Bb[0], Bb[1] + 1, Cb[0], Cb[1] + 1], 0, rock(tone('#5f5a4e')));
    const topC = snow ? tone('#e8ecef') : h >= 3 ? tone('#8a8576') : tone('#5d7a3a');
    pc.poly([A[0], A[1], Bp[0], Bp[1], Cp[0], Cp[1], D[0], D[1]], 0, (x, y) => hash2(x, y, v + 1) < 0.15 ? topC.d : hash2(x, y, v + 2) < 0.2 ? topC.l : topC.b);
  });
}
function waterfallSprite(h, f) {
  const H = CLIFF_H[h];
  return sprA(`wfall|${h}|${f}`, 36, H + 30, 18, H + 12, pc => {
    const o = [18, 4];
    const P = (x, y, z) => [o[0] + (x - y) * 16, o[1] + 8 + (x + y) * 8 + H - z];
    const D = P(-0.5, 0.5, H), Cp = P(0.5, 0.5, H), Cb = P(0.5, 0.5, 0), Db = P(-0.5, 0.5, 0);
    const Bp = P(0.5, -0.5, H), Bb = P(0.5, -0.5, 0);
    const water = (x, y) => {
      const t = (y + f * 3 + Math.floor(hash2(x, 0, 5) * 8)) % 8;
      return t < 1 ? px('#ffffff', 0, 240) : t < 3 ? px('#bfe2f6', 0, 235) : px('#5aa0d8', 0, 225);
    };
    pc.poly([D[0], D[1] - 2, Cp[0], Cp[1] - 2, Cb[0], Cb[1] + 3, Db[0], Db[1] + 3], 0, water);
    pc.poly([Cp[0], Cp[1] - 2, Bp[0], Bp[1] - 2, Bb[0], Bb[1] + 3, Cb[0], Cb[1] + 3], 0, (x, y) => { const c = water(x, y); return c; });
    // espuma na base
    for (let k = 0; k < 26; k++) { const x = Db[0] + hash2(k, f, 1) * (Bb[0] - Db[0]), y = Db[1] + 1 + hash2(k, f, 2) * 6 - (x - Db[0]) * 0.25; pc.e(x, y, 1.5 + hash2(k, f, 3) * 2, 1.2, px('#f4fbff')); }
  }, { outline: false });
}

// ---------- construções ----------
function buildingSprite(b, night) {
  const w = b.w, h = b.h, H = b.wall, RH = b.roof;
  const ox = h * 16 + 6, oy = H + RH + 30, W = (w + h) * 16 + 12, HT = oy + (w + h) * 8 + 6;
  return sprA(`bld|${b.x}|${b.y}|${night ? 1 : 0}`, W, HT, ox, oy, pc => {
    const P = (x, y, z) => [ox + (x - y) * 16, oy + (x + y) * 8 - z]; // x,y relativos ao canto de trás
    const style = {
      temple: { wall: '#d9d2c0', wallR: '#bdb5a2', roof: '#3d5a86', trim: '#c9a24a', stone: true },
      shop: { wall: '#e4d4b0', wallR: '#c9b892', roof: '#9a3a2a', trim: '#5a3a1e' },
      tavern: { wall: '#ddc9a0', wallR: '#c2ae86', roof: '#7a5a2a', trim: '#4a2f17', thatch: true },
      house: { wall: '#e2d6ba', wallR: '#c8bc9e', roof: b.x % 2 ? '#7a3a2a' : '#6a6a3a', trim: '#5a3a1e', thatch: !(b.x % 2) },
      smith: { wall: '#8a857a', wallR: '#6f6b62', roof: '#4a4440', trim: '#3a2a1e', stone: true },
      barracks: { wall: '#9a948a', wallR: '#7c776d', roof: '#5a3a30', trim: '#3a2a1e', stone: true },
      stable: { wall: '#9a7048', wallR: '#7a5434', roof: '#8a6a2a', trim: '#4a2f17', thatch: true },
    }[b.kind];
    const wl = tone(style.wall), wr = tone(style.wallR), tr = tone(style.trim), rf = tone(style.roof);
    const base = style.stone ? 0 : 5;
    // faces: esquerda (x de 0..w em y=h) e direita (y de h..0 em x=w)
    const faceL = (sx, sy) => { const u = (sx - ox) / 16 + h; const z = oy + (u + h) * 8 - sy; return [u / w, z]; };
    const faceR = (sx, sy) => { const t = (sx - ox) / 16 - w + h; const z = oy + (w + h - t) * 8 - sy; return [t / h, z]; };
    const tex = (face, uz, x, y) => {
      const [u, z] = uz, n = face === 'L' ? w : h, base2 = face === 'L' ? wl : wr;
      if (z < base) return hash2(x >> 1, y >> 1, 4) < 0.3 ? px('#6f6b62') : px('#85817a');
      if (style.stone) { const row = Math.floor(z / 4); return (Math.floor(z) % 4 === 0 || Math.floor(u * n * 4 + (row % 2) * 0.5) % 2 === 0 && x % 3 === 0) ? base2.d : hash2(x, y >> 2, 6) < 0.12 ? base2.l : base2.b; }
      // enxaimel
      const uu = u * n, fr = uu - Math.floor(uu);
      if (fr < 0.06 || fr > 0.94 || Math.abs(z - (base + (H - base) * 0.5)) < 1 || z > H - 2) return tr.b;
      if (Math.abs((fr - 0.5) - (z - base) / (H - base) * 0.8 + 0.4) < 0.05 && z < base + (H - base) * 0.5) return tr.d;
      return hash2(x, y, 8) < 0.06 ? base2.d : base2.b;
    };
    // sombra
    pc.poly([...P(0, h, 0), ...P(w + 0.8, h + 0.4, 0), ...P(w + 0.8, 0.4, 0)], px('#000000', 0, 60));
    const L0 = P(0, h, 0), L1 = P(w, h, 0), L2 = P(w, h, H), L3 = P(0, h, H);
    const R0 = P(w, h, 0), R1 = P(w, 0, 0), R2 = P(w, 0, H), R3 = P(w, h, H);
    pc.poly([...L0, ...L1, ...L2, ...L3], 0, (x, y, lx, ly) => tex('L', faceL(lx, ly), x, y));
    pc.poly([...R0, ...R1, ...R2, ...R3], 0, (x, y, lx, ly) => tex('R', faceR(lx, ly), x, y));
    // janelas arredondadas
    const winC = night ? px('#ffcf7a') : px('#2c3a4a'), winL = night ? px('#fff0c0') : px('#4a6078');
    const window_ = (face, u, z0, z1) => {
      const F = face === 'L' ? (uu, z) => P(uu * w, h, z) : (uu, z) => P(w, h - uu * h, z);
      const ww = 0.32 / (face === 'L' ? w : h);
      const a = F(u - ww, z0), b2 = F(u + ww, z0), c = F(u + ww, z1), d = F(u - ww, z1);
      pc.poly([a[0] - 1, a[1] + 1, b2[0] + 1, b2[1] + 1, c[0] + 1, c[1] - 1, d[0] - 1, d[1] - 1], tr.d);
      pc.poly([...a, ...b2, ...c, ...d], 0, (x, y) => (y + x) % 5 === 0 ? winL : winC);
      const top = F(u, z1 + 2); pc.e(top[0], top[1] + 1, 2.5, 1.5, tr.d);
    };
    const zw0 = base + (H - base) * 0.45, zw1 = base + (H - base) * 0.82;
    if (b.kind === 'temple') { window_('R', 0.25, H * 0.3, H * 0.75); window_('R', 0.75, H * 0.3, H * 0.75); window_('L', 0.2, H * 0.3, H * 0.75); window_('L', 0.8, H * 0.3, H * 0.75); }
    else if (b.kind === 'house') { window_('R', 0.5, zw0, zw1); window_('L', 0.22, zw0, zw1); }
    else { window_('R', 0.3, zw0, zw1); window_('R', 0.72, zw0, zw1); window_('L', 0.15, zw0, zw1); window_('L', 0.85, zw0, zw1); }
    // porta em arco (face esquerda, no meio)
    { const F = (uu, z) => P(uu * w, h, z), dw = 0.42 / w, dz = b.kind === 'temple' ? 18 : 13;
      const a = F(0.5 - dw, 0), b2 = F(0.5 + dw, 0), c = F(0.5 + dw, dz), d = F(0.5 - dw, dz);
      pc.poly([...a, ...b2, ...c, ...d], 0, (x, y) => x % 3 === 0 ? px('#3a2414') : px('#5a3a22'));
      const t = F(0.5, dz); pc.e(t[0], t[1] + 1, 4, 2.5, px('#4a2f17')); pc.p(c[0] - 2, (c[1] + b2[1]) / 2, px('#c9a24a')); }
    // telhado arredondado
    const o = 0.4, ridgeX = w >= h;
    const A = P(-o, -o, H), Bp = P(w + o, -o, H), Cp = P(w + o, h + o, H), D = P(-o, h + o, H);
    let r1, r2;
    if (ridgeX) { r1 = P(h * 0.5, h / 2, H + RH); r2 = P(w - h * 0.5, h / 2, H + RH); }
    else { r1 = P(w / 2, w * 0.5, H + RH); r2 = P(w / 2, h - w * 0.5, H + RH); }
    const roofTex = (base2, dark) => (x, y) => {
      if (style.thatch) { const n = hash2(x, y >> 1, 3); return (y % 3 === 0 && n < 0.6) ? base2.d : n > 0.85 ? base2.l : dark ? base2.d : base2.b; }
      return (y % 4 === 0) ? base2.d : ((x + (Math.floor(y / 4) % 2) * 3) % 6 === 0 ? base2.d : dark ? base2.d : base2.b);
    };
    if (ridgeX) {
      pc.poly([...A, ...Bp, ...r2, ...r1], 0, roofTex(rf, true));
      pc.poly([...A, ...r1, ...D], 0, roofTex(rf, true));
      pc.poly([...Bp, ...Cp, ...r2], 0, roofTex(tone(style.roof), true));
      pc.poly([...D, ...Cp, ...r2, ...r1], 0, roofTex(rf, false));
    } else {
      pc.poly([...A, ...r1, ...r2, ...D], 0, roofTex(rf, true));
      pc.poly([...A, ...Bp, ...r1], 0, roofTex(rf, true));
      pc.poly([...D, ...Cp, ...r2], 0, roofTex(rf, false));
      pc.poly([...Bp, ...Cp, ...r2, ...r1], 0, roofTex(rf, false));
    }
    // beiral ondulado (menos ângulos retos)
    for (let t = 0; t <= 1; t += 0.02) {
      const x = D[0] + (Cp[0] - D[0]) * t, y = D[1] + (Cp[1] - D[1]) * t;
      pc.p(x, y + 1 + Math.round(Math.sin(t * Math.PI * (w * 2)) * 0.8), rf.d);
      const x2 = Cp[0] + (Bp[0] - Cp[0]) * t, y2 = Cp[1] + (Bp[1] - Cp[1]) * t;
      pc.p(x2, y2 + 1 + Math.round(Math.sin(t * Math.PI * (h * 2)) * 0.8), rf.dd);
    }
    pc.l(r1[0], r1[1], r2[0], r2[1], rf.l, 2);
    // extras
    const mid = [(r1[0] + r2[0]) / 2, (r1[1] + r2[1]) / 2];
    if (b.kind === 'temple') {
      const [tx, ty] = mid;
      pc.r(tx - 5, ty - 18, 10, 18, wl.b); pc.r(tx, ty - 18, 5, 18, wr.b);
      pc.e(tx, ty - 12, 2.5, 4, px('#2a2218')); pc.e(tx, ty - 10, 1.5, 1.5, px('#c9a24a'));
      pc.poly([tx - 7, ty - 18, tx, ty - 32, tx + 7, ty - 18], rf.b); pc.poly([tx, ty - 32, tx + 7, ty - 18, tx, ty - 18], rf.d);
      pc.e(tx, ty - 35, 2.5, 2.5, tr.l);
      for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; pc.p(tx + Math.cos(a) * 4.5, ty - 35 + Math.sin(a) * 4.5, tr.b); }
    }
    if (b.kind === 'tavern' || b.kind === 'house' || b.kind === 'smith') {
      const c = P(w * 0.3, h * 0.35, H + RH * 0.75);
      pc.r(c[0] - 3, c[1] - 12, 6, 13, px('#7d7a72')); pc.r(c[0], c[1] - 12, 3, 13, px('#5f5c55')); pc.r(c[0] - 4, c[1] - 13, 8, 2, px('#5f5c55'));
    }
    if (b.kind === 'shop' || b.kind === 'tavern') {
      const p = P(w * 0.82, h, base + (H - base) * 0.45);
      pc.l(p[0], p[1] - 3, p[0] + 8, p[1] - 1, px('#2a2a2e'), 1);
      pc.r(p[0] + 4, p[1], 10, 8, px('#6b4423')); pc.r(p[0] + 5, p[1] + 1, 8, 6, px('#9a7040'));
      if (b.kind === 'shop') { pc.e(p[0] + 9, p[1] + 4, 2.2, 2.2, px('#e2b74e')); }
      else { pc.r(p[0] + 7, p[1] + 2, 3, 4, px('#e2b74e')); pc.r(p[0] + 7, p[1] + 2, 3, 1, px('#fff4d8')); pc.p(p[0] + 10, p[1] + 3, px('#e2b74e')); }
    }
  }, { k: 0.28 });
}
// posições das janelas (para as luzes noturnas)
function buildingWindows(b) {
  const w = b.w, h = b.h, H = b.wall, base = b.kind === 'temple' ? 0 : 5;
  const zc = b.kind === 'temple' ? H * 0.52 : base + (H - base) * 0.63;
  const list = b.kind === 'temple' ? [['R', 0.25], ['R', 0.75], ['L', 0.2], ['L', 0.8]] : b.kind === 'house' ? [['R', 0.5], ['L', 0.22]] : [['R', 0.3], ['R', 0.72], ['L', 0.15], ['L', 0.85]];
  return list.map(([f, u]) => f === 'L' ? [b.x - 0.5 + u * w, b.y - 0.5 + h, zc] : [b.x - 0.5 + w, b.y - 0.5 + h - u * h, zc]);
}
