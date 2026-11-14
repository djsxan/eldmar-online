// ============================================================
//  PROPS — objetos do cenário pintados à mão (gerados por código
//  e guardados em cache). Unidades = unidades de arte do mundo
//  (meio tile = 32 x 16). Fogo, água e bandeiras são animados
//  ao vivo no render, para ficarem fluidos.
// ============================================================
const FLOOR_H = 24;
const FLOOR_PX = 176;                      // altura da muralha (≈ 9 m)
const CLIFF_H = [0, 40, 68, 96, 124];       // alturas dos penhascos
const TPAL = {                              // folhagem por clima
  0: ['#1f3a1a', '#2d5224', '#3e6a2e', '#55853a', '#79a650'],   // carvalho dos campos
  1: ['#22401f', '#30582a', '#447234', '#5e8e40', '#86b25a'],   // selvagem, mais vivo
  2: ['#5a3412', '#80501a', '#a87024', '#cc952e', '#e8bc4a'],   // outono
  3: ['#132a1c', '#1c3a26', '#284c30', '#36603a', '#4c7a48'],   // bosque sombrio
};
const ISO = (x, y, z = 0) => [(x - y) * 32, (x + y) * 16 - z];

// ---------- vegetação ----------
function treeSprite(v, w, tint) {
  return paint(`tree|${v}|${tint}`, 110, 140, 55, 128, (c, R) => {
    const pal = TPAL[tint] || TPAL[0];
    // tronco afunilado com raízes
    c.fillStyle = lgrad(c, 47, 0, 63, 0, [[0, '#6e5236'], [0.45, '#4e3824'], [1, '#2a1c10']]);
    c.beginPath(); c.moveTo(44, 128); c.quadraticCurveTo(50, 104, 51, 72); c.lineTo(59, 72); c.quadraticCurveTo(60, 104, 66, 128); c.closePath(); c.fill();
    shape(c, [44, 128, 36, 131, 49, 121], '#3e2c1c'); shape(c, [66, 128, 76, 130, 61, 121], '#2a1c10');
    for (let i = 0; i < 9; i++) { const x = 50 + R() * 9; curve(c, x, 126, x + (R() - 0.5) * 3, 104, x + (R() - 0.5) * 2, 80, 'rgba(20,12,6,0.35)', 0.7); }
    curve(c, 55, 84, 44, 74, 34, 64, '#4a3420', 3.4); curve(c, 56, 82, 67, 70, 78, 62, '#3a2818', 3);
    // copa em camadas
    const blobs = [[55, 54, 34, 26], [32, 66, 20, 16], [78, 64, 20, 16], [40, 40, 20, 16], [70, 38, 20, 16], [55, 26, 18, 14]];
    for (const [bx, by, rx, ry] of blobs) foliage(c, R, bx + (R() - 0.5) * 6, by + (R() - 0.5) * 4, rx, ry, pal, 120, 3.6);
    // luz de borda (sol vindo de cima/esquerda)
    c.globalCompositeOperation = 'source-atop';
    c.fillStyle = lgrad(c, 20, 10, 90, 100, [[0, 'rgba(255,240,180,0.18)'], [0.5, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,30,0.25)']]); c.fillRect(0, 0, 110, 140);
    c.globalCompositeOperation = 'source-over';
    if (tint === 0 && v === 1) for (let i = 0; i < 7; i++) dab(c, 28 + R() * 54, 30 + R() * 40, 1.6, 1.6, '#a8281e');
  });
}
function pineSprite(v, w) {
  return paint(`pine|${v}`, 72, 150, 36, 140, (c, R) => {
    c.fillStyle = lgrad(c, 32, 0, 40, 0, [[0, '#5a4028'], [1, '#2a1c10']]); c.fillRect(32, 104, 8, 36);
    const pal = ['#0e2216', '#163222', '#22462e', '#30603c', '#4a7c52'];
    for (let k = 0; k < 5; k++) {
      const top = 10 + k * 20, half = 12 + k * 6.5;
      c.fillStyle = pal[0];
      c.beginPath(); c.moveTo(36, top - 8); c.quadraticCurveTo(36 + half * 0.4, top + 10, 36 + half, top + 28); c.quadraticCurveTo(36, top + 32, 36 - half, top + 28); c.quadraticCurveTo(36 - half * 0.4, top + 10, 36, top - 8); c.fill();
      for (let i = 0; i < 70; i++) {
        const t = R(), sx = 36 + (R() * 2 - 1) * half * t, sy = top - 6 + t * 32;
        const l = -(sx - 36) / half * 0.6 - (sy - top) / 40 + (R() - 0.5) * 0.5;
        const col = pal[l > 0.4 ? 4 : l > 0 ? 3 : l > -0.4 ? 2 : 1];
        stroke(c, [sx, sy, sx + (sx > 36 ? 3 : -3), sy + 2.5], col, 1.4);
      }
    }
  });
}
function deadTreeSprite(v) {
  return paint(`dead|${v}`, 80, 100, 40, 92, (c, R) => {
    const col = '#4a3e34', col2 = '#625244';
    const branch = (x, y, a, len, w, d) => {
      const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
      curve(c, x, y, (x + x2) / 2 + (R() - 0.5) * 6, (y + y2) / 2 + (R() - 0.5) * 6, x2, y2, d % 2 ? col : col2, w);
      if (d > 0) { branch(x2, y2, a - 0.5 - R() * 0.3, len * 0.68, w * 0.62, d - 1); branch(x2, y2, a + 0.4 + R() * 0.3, len * 0.66, w * 0.6, d - 1); }
    };
    branch(40, 92, -Math.PI / 2 + (R() - 0.5) * 0.2, 34, 7, 3);
    shape(c, [33, 92, 40, 82, 48, 92], '#3a2e24');
  });
}
function bushSprite(v, w) {
  return paint(`bush|${v}`, 60, 46, 30, 40, (c, R) => {
    const pal = ['#1b3618', '#284c22', '#37632c', '#4c7c3a', '#6a9a4c'];
    for (const [bx, by, r] of [[18, 28, 14], [42, 28, 14], [30, 18, 16]]) foliage(c, R, bx, by, r, r * 0.8, pal, 90, 2.8);
    if (v === 2) for (let i = 0; i < 8; i++) dab(c, 12 + R() * 36, 12 + R() * 22, 1.3, 1.3, '#6a1a3a');
  });
}
function rockSprite(v, mossy) {
  return paint(`rock|${v}|${mossy}`, 64, 48, 32, 40, (c, R) => {
    const s = 0.85 + R() * 0.3, base = '#7a776e';
    const pts = []; for (let i = 0; i < 9; i++) { const a = Math.PI + i / 8 * Math.PI, r = (22 + R() * 6) * s; pts.push(32 + Math.cos(a) * r * 1.15, 38 + Math.sin(a) * r * 0.85); }
    pts.push(32 + 25 * s, 40, 32 - 25 * s, 40);
    shape(c, pts, lgrad(c, 10, 10, 50, 44, [[0, '#a6a398'], [0.5, base], [1, '#45433d']]));
    for (let i = 0; i < 6; i++) { const x = 16 + R() * 32, y = 18 + R() * 16; shape(c, [x, y, x + 6 + R() * 6, y - 3, x + 5, y + 5], R() < 0.5 ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.15)'); }
    curve(c, 22, 24, 30, 30, 28, 38, 'rgba(0,0,0,0.3)', 0.8);
    if (mossy) for (let i = 0; i < 26; i++) dab(c, 18 + R() * 24, 16 + R() * 8, 1.8 + R() * 2, 1.2, R() < 0.5 ? '#4a6a2c' : '#5e7e36');
  });
}
function grassSprite(v, w, dry) {
  return paint(`tg|${v}|${dry}`, 54, 40, 27, 34, (c, R) => {
    const cols = dry ? ['#8a7a48', '#a8955a', '#c4b070', '#6a5c34'] : ['#2f5a22', '#3f7230', '#58903e', '#76aa50'];
    for (let i = 0; i < 26; i++) {
      const x = 6 + R() * 42, ht = 12 + R() * 18, b = (R() - 0.5) * 10;
      curve(c, x, 34, x + b * 0.3, 34 - ht * 0.6, x + b, 34 - ht, cols[Math.floor(R() * 4)], 1 + R() * 0.8);
    }
  });
}
function smallSprite(kind, v = 0, w) {
  switch (kind) {
    case 'mushroom': return paint(`mush|${v}`, 44, 30, 22, 26, (c, R) => {
      const glow = v >= 2;
      for (let k = 0; k < 3; k++) {
        const x = 10 + k * 11 + R() * 4, s = 0.7 + R() * 0.6;
        c.fillStyle = lgrad(c, x - 2, 0, x + 2, 0, [[0, '#f0e8d4'], [1, '#b8ac94']]); c.fillRect(x - 1.8 * s, 26 - 9 * s, 3.6 * s, 9 * s);
        c.fillStyle = glow ? rgrad(c, x - 2, 26 - 10 * s, 0, 8 * s, [[0, '#c8f4ff'], [0.5, '#48b8e8'], [1, '#1e5a7a']]) : rgrad(c, x - 2, 26 - 10 * s, 0, 8 * s, [[0, '#e86048'], [0.6, '#a82a1e'], [1, '#5a120c']]);
        c.beginPath(); c.ellipse(x, 26 - 9 * s, 7 * s, 4.5 * s, 0, Math.PI, 0); c.fill();
        if (!glow) for (let i = 0; i < 3; i++) dab(c, x - 4 * s + R() * 8 * s, 26 - 11 * s + R() * 2 * s, 0.9 * s, 0.7 * s, '#f4ece0');
      }
    });
    case 'reeds': return paint(`reeds|${v}`, 44, 60, 22, 54, (c, R) => {
      for (let i = 0; i < 12; i++) { const x = 6 + R() * 32, ht = 26 + R() * 22, b = (R() - 0.5) * 8; curve(c, x, 54, x, 54 - ht * 0.5, x + b, 54 - ht, R() < 0.5 ? '#5a7a2e' : '#47662a', 1.2); if (i % 2 === 0) dab(c, x + b, 54 - ht + 3, 1.6, 4.2, '#5a3820'); }
    });
    case 'stump': return paint('stump', 40, 32, 20, 26, (c, R) => {
      c.fillStyle = lgrad(c, 6, 0, 34, 0, [[0, '#6e5236'], [1, '#2e2014']]); c.fillRect(7, 10, 26, 16);
      dab(c, 20, 26, 13, 4, '#2e2014'); dab(c, 20, 10, 13, 5, '#b8956a');
      for (let r = 9; r > 1; r -= 2.5) { c.strokeStyle = 'rgba(80,50,25,0.5)'; c.lineWidth = 0.7; c.beginPath(); c.ellipse(20, 10, r * 1.3, r * 0.5, 0, 0, 7); c.stroke(); }
    });
    case 'log': return paint(`log|${v}`, 70, 34, 35, 26, (c, R) => {
      const d = v ? 1 : -1;
      c.save(); c.translate(35, 18); c.rotate(d * 0.32);
      c.fillStyle = lgrad(c, 0, -7, 0, 7, [[0, '#7a5a3a'], [1, '#2e2014']]); c.fillRect(-28, -7, 56, 14);
      for (let i = 0; i < 6; i++) stroke(c, [-26 + R() * 50, -5 + R() * 10, -20 + R() * 50, -5 + R() * 10], 'rgba(0,0,0,0.25)', 0.6);
      dab(c, 28, 0, 4, 7, '#b8956a'); dab(c, 28, 0, 2, 3.5, '#8a6a42');
      if (R() < 0.6) for (let i = 0; i < 10; i++) dab(c, -18 + R() * 20, -6 + R() * 3, 1.6, 1, '#4e6a2a');
      c.restore();
    });
    case 'deadtree': return deadTreeSprite(v);
    case 'grave': return paint(`grave|${v}`, 40, 48, 20, 42, (c, R) => {
      dab(c, 20, 41, 17, 6, '#3a3424');
      c.fillStyle = lgrad(c, 8, 0, 32, 0, [[0, '#a8a59c'], [0.6, '#7e7b72'], [1, '#4e4c46']]);
      c.beginPath(); c.moveTo(9, 41); c.lineTo(9, 16); c.quadraticCurveTo(20, 2, 31, 16); c.lineTo(31, 41); c.closePath(); c.fill();
      c.fillStyle = 'rgba(30,28,24,0.55)'; c.fillRect(18.5, 14, 3, 18); c.fillRect(13, 19, 14, 3);
      for (let i = 0; i < 14; i++) dab(c, 10 + R() * 20, 30 + R() * 10, 1.5, 1, R() < 0.5 ? '#4e6a2c' : '#3a5222');
    });
    case 'tent': return paint('tent', 100, 90, 50, 78, (c, R) => {
      shape(c, [6, 78, 50, 10, 54, 86], lgrad(c, 6, 0, 54, 0, [[0, '#8a6440'], [1, '#6a4a2c']]));
      shape(c, [54, 86, 50, 10, 94, 78], lgrad(c, 54, 0, 94, 0, [[0, '#5a3e24'], [1, '#3a2814']]));
      shape(c, [44, 82, 50, 46, 58, 84], '#1a120a');
      for (let i = 0; i < 12; i++) stroke(c, [10 + i * 3.5, 74 - i * 5, 14 + i * 3.5, 72 - i * 5], 'rgba(30,20,10,0.4)', 0.6);
      stroke(c, [50, 10, 44, 0], '#3a2a1e', 2); stroke(c, [50, 10, 58, 1], '#3a2a1e', 2);
      shape(c, [58, 2, 76, 6, 58, 12], '#7a1a14');
    });
    case 'barrel': return paint('barrel', 34, 42, 17, 38, (c, R) => {
      c.fillStyle = lgrad(c, 4, 0, 30, 0, [[0, '#8a6038'], [0.4, '#a87a48'], [1, '#4a3018']]);
      c.beginPath(); c.ellipse(17, 22, 13, 17, 0, 0, 7); c.fill();
      c.fillStyle = '#3a3a3e'; c.fillRect(4, 10, 26, 2.2); c.fillRect(4, 32, 26, 2.2);
      dab(c, 17, 6.5, 11, 3.5, '#6a4a28'); dab(c, 17, 6.5, 9, 2.6, '#8a6a42');
    });
    case 'crate': return paint('crate', 46, 46, 23, 40, (c, R) => {
      shape(c, [3, 15, 23, 5, 43, 15, 23, 25], '#b08858'); shape(c, [3, 15, 23, 25, 23, 41, 3, 31], '#8a6438'); shape(c, [23, 25, 43, 15, 43, 31, 23, 41], '#5e4022');
      stroke(c, [3, 15, 23, 41], 'rgba(40,25,10,0.6)', 1.4); stroke(c, [43, 15, 23, 41], 'rgba(30,18,8,0.6)', 1.4); stroke(c, [3, 31, 23, 25], 'rgba(40,25,10,0.5)', 1.2);
    });
    case 'hay': return paint('hay', 60, 46, 30, 40, (c, R) => {
      dab(c, 30, 26, 26, 17, '#b8922e');
      for (let i = 0; i < 120; i++) { const a = R() * Math.PI * 2, d = Math.sqrt(R()), x = 30 + Math.cos(a) * 24 * d, y = 26 + Math.sin(a) * 15 * d; stroke(c, [x, y, x + (R() - 0.5) * 6, y - 2 - R() * 3], ['#d8b44a', '#e8cc6a', '#a8822a'][Math.floor(R() * 3)], 0.8); }
    });
    case 'bench': return paint('bench', 56, 34, 28, 28, (c, R) => {
      stroke(c, [6, 16, 48, 8], '#7a5634', 6); stroke(c, [6, 22, 48, 14], '#9a7448', 4);
      c.fillStyle = '#3a2814'; c.fillRect(9, 22, 3, 8); c.fillRect(42, 16, 3, 8);
    });
    case 'well': return paint('well', 68, 90, 34, 80, (c, R) => {
      c.fillStyle = texPattern(c, 'stone', '#8a8478'); c.fillRect(8, 50, 52, 18);
      c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(40, 50, 20, 18);
      dab(c, 34, 68, 26, 9, '#6a665e'); dab(c, 34, 50, 26, 9, '#a09a8e'); dab(c, 34, 50, 20, 6, '#14202a');
      c.fillStyle = '#5a3a22'; c.fillRect(10, 12, 4, 40); c.fillRect(54, 12, 4, 40);
      shape(c, [2, 16, 34, 0, 66, 16, 34, 24], lgrad(c, 0, 0, 68, 0, [[0, '#8a3a2a'], [1, '#4a1a12']]));
      stroke(c, [12, 20, 56, 20], '#3a2414', 2); stroke(c, [36, 20, 36, 36], '#d8ccaa', 0.8); c.fillStyle = '#6b4423'; c.fillRect(32, 34, 8, 8);
    });
    case 'stall': return paint('stall', 82, 76, 41, 68, (c, R) => {
      c.fillStyle = '#4a3020'; c.fillRect(8, 12, 4, 56); c.fillRect(70, 12, 4, 56);
      shape(c, [6, 46, 41, 58, 76, 46, 41, 34], '#8a6440'); shape(c, [6, 46, 41, 58, 41, 66, 6, 54], '#5a3e24');
      for (let i = 0; i < 9; i++) dab(c, 18 + i * 6, 42 + (i % 2) * 3, 3, 2.6, ['#a82a1e', '#d8a028', '#5a8a2a', '#c86a2a'][i % 4]);
      for (let i = 0; i < 7; i++) shape(c, [2 + i * 11.4, 6 + i * 1.2, 13.4 + i * 11.4, 6 + i * 1.2, 13.4 + i * 11.4, 18, 2 + i * 11.4, 18], i % 2 ? '#e8e0cc' : '#8a1e18');
    });
    case 'spikes': return paint('spikes', 64, 46, 32, 40, (c, R) => { for (const [a, b] of [[-16, 3], [0, -2], [16, 3]]) { stroke(c, [32 + a - 10, 40 + b, 32 + a + 6, 40 + b - 32], '#6b4a2b', 3.5); stroke(c, [32 + a + 10, 40 + b, 32 + a - 6, 40 + b - 32], '#4a3018', 3.5); } });
    case 'rubblebig': return paint(`rb|${v}`, 64, 42, 32, 34, (c, R) => { for (let k = 0; k < 8; k++) { const x = 10 + R() * 44, y = 18 + R() * 14, r = 5 + R() * 8; c.fillStyle = lgrad(c, x - r, y - r, x + r, y + r, [[0, '#a8a296'], [1, '#55524a']]); c.beginPath(); c.ellipse(x, y, r, r * 0.65, R(), 0, 7); c.fill(); } });
    case 'dummy': return paint('dummy', 40, 70, 20, 64, (c, R) => {
      c.fillStyle = '#5a3a22'; c.fillRect(18, 20, 4, 44); stroke(c, [4, 30, 36, 30], '#6b4a2b', 4);
      dab(c, 20, 36, 9, 13, '#c8a04a'); for (let i = 0; i < 20; i++) stroke(c, [12 + R() * 16, 26 + R() * 20, 12 + R() * 16, 26 + R() * 20], 'rgba(120,80,20,0.4)', 0.6);
      dab(c, 20, 15, 7, 7, '#d8b866'); dab(c, 17, 13, 1, 1, '#3a2a1e'); dab(c, 23, 13, 1, 1, '#3a2a1e');
    });
    case 'statue': return paint('statue', 48, 96, 24, 90, (c, R) => {
      c.fillStyle = texPattern(c, 'stone', '#8c887e'); c.fillRect(6, 72, 36, 18);
      c.fillStyle = lgrad(c, 14, 0, 34, 0, [[0, '#b4b0a6'], [1, '#6a6760']]);
      c.beginPath(); c.moveTo(14, 72); c.lineTo(17, 38); c.lineTo(31, 38); c.lineTo(34, 72); c.closePath(); c.fill();
      dab(c, 24, 30, 7, 8, '#a4a096'); stroke(c, [31, 42, 40, 18], '#a8a49a', 4); stroke(c, [40, 18, 40, 4], '#c8c4ba', 2);
      for (let i = 0; i < 18; i++) dab(c, 14 + R() * 20, 50 + R() * 30, 1.5, 1, '#4e6a2c');
    });
    case 'cave': return paint('cave', 140, 110, 70, 100, (c, R) => {
      c.fillStyle = '#6e6a62'; c.beginPath(); c.ellipse(70, 70, 66, 40, 0, Math.PI, 0); c.lineTo(136, 100); c.lineTo(4, 100); c.closePath(); c.fill();
      c.fillStyle = '#0a0806'; c.beginPath(); c.ellipse(70, 100, 24, 34, 0, Math.PI, 0); c.fill();
    });
    case 'chest': return paint('chest' + v, 40, 34, 20, 30, (c, R) => {
      c.fillStyle = '#6a4220'; c.fillRect(6, 12, 28, 18); c.fillStyle = '#3a3a40'; c.fillRect(10, 12, 3, 18); c.fillRect(27, 12, 3, 18);
      c.fillStyle = v ? '#4a2c14' : '#7a5028'; c.fillRect(6, v ? 2 : 6, 28, 7); c.fillStyle = '#e2b74e'; c.fillRect(18, 14, 4, 5);
    });
    case 'anvil': return paint('anvil', 48, 40, 24, 34, (c, R) => {
      c.fillStyle = '#4a3020'; c.fillRect(16, 20, 16, 14);
      c.fillStyle = lgrad(c, 0, 10, 0, 22, [[0, '#8a8e96'], [1, '#3a3c42']]);
      c.beginPath(); c.moveTo(6, 10); c.lineTo(40, 10); c.lineTo(46, 13); c.lineTo(40, 16); c.lineTo(36, 22); c.lineTo(12, 22); c.lineTo(8, 16); c.closePath(); c.fill();
      stroke(c, [8, 11, 40, 11], 'rgba(255,255,255,0.4)', 1);
    });
    case 'weaponrack': return paint('wrack', 56, 64, 28, 58, (c, R) => {
      stroke(c, [6, 58, 6, 18], '#5a3a22', 4); stroke(c, [50, 50, 50, 10], '#4a3018', 4); stroke(c, [6, 26, 50, 18], '#6b4a2b', 3.5); stroke(c, [6, 48, 50, 40], '#5a3a22', 3.5);
      for (let k = 0; k < 4; k++) { const x = 13 + k * 10; stroke(c, [x, 52 - k * 1.6, x + 2, 4 + k], lgrad(c, x, 0, x + 3, 0, [[0, '#e0e4ea'], [1, '#7a7e86']]), 2.2); stroke(c, [x - 3, 40 - k * 1.6, x + 5, 40 - k * 1.6], '#8a6a2a', 2); }
    });
    case 'cart': return paint('cart', 88, 62, 44, 50, (c, R) => {
      shape(c, [8, 22, 56, 8, 80, 22, 30, 36], '#9a7448'); shape(c, [8, 22, 30, 36, 30, 46, 8, 32], '#6e5032'); shape(c, [30, 36, 80, 22, 80, 32, 30, 46], '#4e3820');
      for (let i = 0; i < 6; i++) dab(c, 26 + i * 8, 20 - i * 1.6, 5, 3.6, ['#c9a24a', '#b8902e'][i % 2]);
      for (const [x, y] of [[22, 44], [66, 34]]) { c.strokeStyle = '#3a2814'; c.lineWidth = 2.4; c.beginPath(); c.ellipse(x, y, 9, 10, 0, 0, 7); c.stroke(); for (let a = 0; a < 6; a++) stroke(c, [x, y, x + Math.cos(a) * 8, y + Math.sin(a) * 9], '#5a3a22', 1.2); }
      stroke(c, [80, 26, 88, 30], '#4e3820', 3);
    });
    case 'table': return paint('table', 66, 44, 33, 36, (c, R) => {
      shape(c, [4, 18, 33, 4, 62, 18, 33, 32], c.fillStyle = texPattern(c, 'wood', '#7a5634'));
      shape(c, [4, 18, 33, 32, 33, 35, 4, 21], '#4a3018'); shape(c, [33, 32, 62, 18, 62, 21, 33, 35], '#3a2410');
      c.fillStyle = '#3a2410'; c.fillRect(8, 20, 4, 14); c.fillRect(54, 20, 4, 14); c.fillRect(31, 33, 4, 10);
      c.fillStyle = '#8a5424'; c.fillRect(24, 10, 6, 7); c.fillStyle = '#f2ead8'; c.fillRect(24, 9, 6, 2); dab(c, 40, 16, 5, 2.4, '#d8d2c4');
    });
  }
}
function fenceSprite(alongX) {
  return paint(`fence|${alongX}`, 76, 66, 38, 54, (c, R) => {
    const dx = alongX ? 16 : -16;
    for (const k of [-1, 0, 1]) {
      const x = 38 + dx * k * 1.05, y = 52 + 8 * k * 1.05;
      c.fillStyle = lgrad(c, x - 4, 0, x + 4, 0, [[0, '#8a6440'], [1, '#4a3018']]);
      c.beginPath(); c.moveTo(x - 4, y); c.lineTo(x - 4, y - 36); c.lineTo(x, y - 44); c.lineTo(x + 4, y - 36); c.lineTo(x + 4, y); c.closePath(); c.fill();
    }
    stroke(c, [38 - dx * 1.05, 52 - 8 * 1.05 - 24, 38 + dx * 1.05, 52 + 8 * 1.05 - 24], '#3a2410', 3);
    stroke(c, [38 - dx * 1.05, 52 - 8 * 1.05 - 10, 38 + dx * 1.05, 52 + 8 * 1.05 - 10], '#3a2410', 3);
  });
}
// partes estáticas dos objetos animados (o fogo/água é desenhado ao vivo)
function animSprite(kind) {
  switch (kind) {
    case 'torch': return paint('torch', 24, 70, 12, 64, c => { c.fillStyle = lgrad(c, 9, 0, 15, 0, [[0, '#5a3a22'], [1, '#2a1a0e']]); c.fillRect(10, 22, 4, 42); c.fillStyle = '#4a4a4e'; c.fillRect(7, 18, 10, 6); });
    case 'campfire': return paint('fire', 52, 48, 26, 38, (c, R) => { for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; dab(c, 26 + Math.cos(a) * 17, 36 + Math.sin(a) * 7, 5, 3.4, '#6a6760'); dab(c, 25 + Math.cos(a) * 17, 35 + Math.sin(a) * 7, 3, 2, '#8a877e'); } stroke(c, [12, 36, 40, 32], '#3a2414', 4.5); stroke(c, [12, 32, 40, 36], '#2a1a0e', 4.5); softDab(c, 26, 34, 10, '#ff8a30', 0.5); });
    case 'brazier': return paint('braz', 40, 66, 20, 60, c => { stroke(c, [10, 60, 20, 36], '#2e2e30', 2.4); stroke(c, [30, 60, 20, 36], '#2e2e30', 2.4); stroke(c, [20, 60, 20, 36], '#3a3a3c', 2); c.fillStyle = lgrad(c, 6, 0, 34, 0, [[0, '#5a5a5e'], [1, '#222224']]); c.beginPath(); c.moveTo(6, 26); c.lineTo(34, 26); c.lineTo(28, 36); c.lineTo(12, 36); c.closePath(); c.fill(); softDab(c, 20, 27, 8, '#ff7a20', 0.6); });
    case 'lamp': return paint('lamp', 36, 96, 12, 90, c => { c.fillStyle = '#26262a'; c.fillRect(8, 82, 10, 8); c.fillStyle = lgrad(c, 10, 0, 15, 0, [[0, '#4a4a50'], [1, '#18181c']]); c.fillRect(11, 18, 4, 66); stroke(c, [13, 18, 26, 16], '#2a2a2e', 2); c.fillStyle = 'rgba(255,220,150,0.95)'; c.fillRect(21, 18, 10, 13); stroke(c, [20, 18, 32, 18], '#2a2a2e', 1.2); shape(c, [19, 18, 33, 18, 26, 10], '#2a2a2e'); });
    case 'banner': return paint('banpole', 16, 104, 6, 98, c => { c.fillStyle = lgrad(c, 4, 0, 8, 0, [[0, '#6a4a2a'], [1, '#2a1a0e']]); c.fillRect(4, 4, 4, 94); dab(c, 6, 4, 3, 3, '#c9a24a'); });
    case 'fountain': return paint('fount', 96, 80, 48, 64, (c, R) => {
      dab(c, 48, 56, 42, 18, '#55524a'); c.fillStyle = texPattern(c, 'stone', '#9a968c'); c.beginPath(); c.ellipse(48, 52, 42, 18, 0, 0, 7); c.fill();
      dab(c, 48, 50, 35, 13, '#2c5e8a'); softDab(c, 40, 46, 16, '#9cd0f0', 0.35);
      c.fillStyle = lgrad(c, 42, 0, 54, 0, [[0, '#b4b0a6'], [1, '#6a6760']]); c.fillRect(43, 20, 10, 30); dab(c, 48, 20, 11, 5, '#a8a49a'); dab(c, 48, 19, 8, 3, '#3a6e9a');
    });
  }
}

// ---------- castelo ----------
function blockFaces(c, H, opts) {
  // bloco isométrico de 1 tile (meio 32x16), base em (34, 18+H)
  const o = [34, 18 + H];
  const P = (x, y, z) => [o[0] + (x - y) * 32, o[1] + (x + y) * 16 - z];
  const A = P(-0.5, -0.5, H), B = P(0.5, -0.5, H), Cc = P(0.5, 0.5, H), D = P(-0.5, 0.5, H);
  const Cb = P(0.5, 0.5, 0), Db = P(-0.5, 0.5, 0), Bb = P(0.5, -0.5, 0);
  return { P, A, B, C: Cc, D, Cb, Db, Bb };
}
function wallSprite(v, low, ivy) {
  const H = low ? 20 : FLOOR_PX;
  return paint(`wall|${v}|${low}|${ivy}`, 68, 40 + H, 34, 18 + H, (c, R) => {
    const F = blockFaces(c, H);
    c.fillStyle = texPattern(c, 'stone', '#8e897e'); shape(c, [...F.D, ...F.C, ...F.Cb, ...F.Db], c.fillStyle);
    shape(c, [...F.D, ...F.C, ...F.Cb, ...F.Db], lgrad(c, 0, F.D[1], 0, F.Db[1], [[0, 'rgba(255,240,210,0.08)'], [1, 'rgba(0,0,0,0.25)']]));
    c.fillStyle = texPattern(c, 'stone', '#6f6a60'); shape(c, [...F.C, ...F.B, ...F.Bb, ...F.Cb], c.fillStyle);
    shape(c, [...F.C, ...F.B, ...F.Bb, ...F.Cb], 'rgba(10,10,30,0.25)');
    shape(c, [...F.A, ...F.B, ...F.C, ...F.D], lgrad(c, F.A[0], F.A[1], F.C[0], F.C[1], [[0, '#b4ae9f'], [1, '#8a8478']]));
    for (let i = 0; i < 14; i++) dab(c, F.D[0] + R() * 64, F.A[1] + 4 + R() * 24, 1 + R() * 2, 0.6, 'rgba(60,55,45,0.35)');
    if (low) for (let i = 0; i < 10; i++) dab(c, F.D[0] + 4 + R() * 56, F.D[1] - 2 + R() * 4, 2 + R() * 3, 1.5, '#7a756a');
    if (ivy) for (let i = 0; i < 90; i++) { const t = R(), x = F.D[0] + 4 + t * 58, y = F.D[1] + t * 32 * 0 + (R() * H * 0.9) + (x - F.D[0]) * 0.5 * 0; const yy = F.D[1] + (F.C[1] - F.D[1]) * t + R() * H * 0.95; dab(c, x, yy, 1.6 + R() * 1.4, 1.2, ['#2a4a20', '#3a5e2a', '#4e7636'][Math.floor(R() * 3)], R() * 3); }
    for (let i = 0; i < 12; i++) dab(c, F.Db[0] + R() * 64, F.Db[1] - 2 + (R() - 0.5) * 6 + R() * 16 * (R() < 0.5 ? 0 : 1) * 0, 2 + R() * 2, 1.2, 'rgba(60,80,40,0.45)');
  });
}
function gateSprite() {
  return paint('gate', 68, 88, 34, 66, c => {
    const H = FLOOR_PX, F = blockFaces(c, H);
    const Cm = F.P(0.5, 0.5, H - 16), Dm = F.P(-0.5, 0.5, H - 16), Bm = F.P(0.5, -0.5, H - 16);
    c.fillStyle = texPattern(c, 'stone', '#8e897e'); shape(c, [...F.D, ...F.C, ...Cm, ...Dm], c.fillStyle);
    c.fillStyle = texPattern(c, 'stone', '#6f6a60'); shape(c, [...F.C, ...F.B, ...Bm, ...Cm], c.fillStyle);
    shape(c, [...F.C, ...F.B, ...Bm, ...Cm], 'rgba(10,10,30,0.25)');
    shape(c, [...F.A, ...F.B, ...F.C, ...F.D], '#a8a294');
    c.strokeStyle = '#3a362e'; c.lineWidth = 2; c.beginPath(); c.moveTo(Dm[0], Dm[1]); c.quadraticCurveTo((Dm[0] + Cm[0]) / 2, (Dm[1] + Cm[1]) / 2 - 10, Cm[0], Cm[1]); c.stroke();
    for (let i = 0; i < 7; i++) { const t = (i + 0.5) / 7; stroke(c, [Dm[0] + (Cm[0] - Dm[0]) * t, Dm[1] + (Cm[1] - Dm[1]) * t - 4, Dm[0] + (Cm[0] - Dm[0]) * t, Dm[1] + (Cm[1] - Dm[1]) * t + 6], '#2a2620', 1.2); }
  });
}
function towerSprite(v) {
  return paint(`tower|${v}`, 120, 170, 60, 140, (c, R) => {
    const Rr = 44, H = FLOOR_PX + 30, cx = 60, base = 140;
    c.save();
    c.beginPath(); c.moveTo(cx - Rr, base - H); c.lineTo(cx - Rr, base); c.ellipse(cx, base, Rr, Rr * 0.5, 0, Math.PI, 0, true); c.lineTo(cx + Rr, base - H); c.closePath(); c.clip();
    c.fillStyle = texPattern(c, 'stone', '#8e897e'); c.fillRect(0, 0, 120, 170);
    c.fillStyle = lgrad(c, cx - Rr, 0, cx + Rr, 0, [[0, 'rgba(255,240,210,0.15)'], [0.35, 'rgba(255,240,210,0.05)'], [0.7, 'rgba(0,0,20,0.25)'], [1, 'rgba(0,0,20,0.5)']]); c.fillRect(0, 0, 120, 170);
    for (let i = 0; i < 120; i++) { const t = R(); if (t > 0.45) continue; dab(c, cx - Rr + 6 + t * 60, base - H + 20 + R() * (H - 10), 1.6 + R() * 1.4, 1.2, ['#2a4a20', '#3a5e2a', '#4e7636'][Math.floor(R() * 3)], R() * 3); }
    c.restore();
    // topo
    c.fillStyle = lgrad(c, cx - Rr, base - H, cx + Rr, base - H, [[0, '#b8b2a4'], [1, '#86806f']]); c.beginPath(); c.ellipse(cx, base - H, Rr, Rr * 0.5, 0, 0, 7); c.fill();
    c.fillStyle = '#7e786c'; c.beginPath(); c.ellipse(cx, base - H, Rr - 7, Rr * 0.5 - 4, 0, 0, 7); c.fill();
    for (let k = 0; k < 14; k++) {
      const a = k / 14 * Math.PI * 2; if (R() < 0.25) continue;
      const mx = cx + Math.cos(a) * (Rr - 4), my = base - H + Math.sin(a) * (Rr * 0.5 - 2), hgt = 9 + R() * 4;
      c.fillStyle = Math.cos(a) < 0 ? '#a8a294' : '#77715f'; c.fillRect(mx - 4, my - hgt, 8, hgt);
      c.fillStyle = '#c4beb0'; c.fillRect(mx - 4, my - hgt, 8, 2);
    }
    c.fillStyle = '#1e1a14'; c.fillRect(cx - 2, base - H + 28, 4, 14); c.beginPath(); c.arc(cx, base - H + 28, 2, Math.PI, 0); c.fill();
  });
}
function stairsSprite(dir) {
  return paint(`stairs|${dir}`, 68, 88, 34, 66, c => {
    const H = FLOOR_PX, o = [34, 18 + H];
    const P = (x, y, z) => [o[0] + (x - y) * 32, o[1] + (x + y) * 16 - z];
    const n = 8;
    for (let k = 0; k < n; k++) {
      const z = (k + 1) * H / n;
      let a0 = -0.5, a1 = 0.5;
      if (dir === 1 || dir === 3) a0 = -0.5 + k / n; else a1 = 0.5 - k / n;
      const ax = dir <= 2, Q = (u, w, zz) => ax ? P(u, w, zz) : P(w, u, zz);
      const A = Q(a0, -0.5, z), B = Q(a1, -0.5, z), Cc = Q(a1, 0.5, z), D = Q(a0, 0.5, z);
      const Cb = Q(a1, 0.5, z - H / n), Db = Q(a0, 0.5, z - H / n), Bb = Q(a1, -0.5, z - H / n);
      shape(c, [...A, ...B, ...Cc, ...D], '#aaa496'); shape(c, [...D, ...Cc, ...Cb, ...Db], '#827c70'); shape(c, [...Cc, ...B, ...Bb, ...Cb], '#5e594f');
    }
  });
}
function slabSprite(v) {
  return paint(`slab|${v}`, 68, 44, 34, 18, (c, R) => {
    const o = [34, 2];
    const P = (x, y, z) => [o[0] + (x - y) * 32, o[1] + 16 + (x + y) * 16 - z];
    const A = P(-0.5, -0.5, 0), B = P(0.5, -0.5, 0), Cc = P(0.5, 0.5, 0), D = P(-0.5, 0.5, 0);
    shape(c, [...A, ...B, ...Cc, ...D], '#8e897e');
    for (let i = 0; i < 6; i++) { const t = (i + 1) / 7; stroke(c, [A[0] + (D[0] - A[0]) * t, A[1] + (D[1] - A[1]) * t, B[0] + (Cc[0] - B[0]) * t, B[1] + (Cc[1] - B[1]) * t], 'rgba(40,36,30,0.35)', 0.8); }
    for (let i = 0; i < 20; i++) dab(c, 10 + R() * 48, 6 + R() * 26, 2 + R() * 4, 1, R() < 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)');
    const Cb = P(0.5, 0.5, -6), Db = P(-0.5, 0.5, -6), Bb = P(0.5, -0.5, -6);
    shape(c, [...D, ...Cc, ...Cb, ...Db], '#6a655a'); shape(c, [...Cc, ...B, ...Bb, ...Cb], '#4e4a42');
  });
}

// ---------- montanha ----------
function cliffSprite(h, v, snow) {
  const H = CLIFF_H[h];
  return paint('cliff|' + h + '|' + v + '|' + snow, 104, 70 + H, 52, 34 + H, (c, R) => {
    const cx = 52, base = 34 + H;
    // rochas irregulares empilhadas (maiores que o tile, para se fundirem com as vizinhas)
    const rocks = [];
    const layers = Math.max(2, Math.round(H / 26));
    for (let l = 0; l < layers; l++) {
      const y = base - (l + 0.5) * (H / layers);
      for (let q = 0; q < 3; q++) rocks.push([cx + (R() - 0.5) * 50, y + (R() - 0.5) * 10 + 8, 18 + R() * 14, 14 + R() * 10]);
    }
    rocks.sort((p, q) => q[1] - p[1] < 0 ? -1 : 1);
    for (const [x, y, rx, ry] of rocks) {
      const pts = []; for (let i = 0; i < 9; i++) { const an = i / 9 * Math.PI * 2, rr = 0.75 + R() * 0.3; pts.push(x + Math.cos(an) * rx * rr, y + Math.sin(an) * ry * rr); }
      shape(c, pts, lgrad(c, x - rx, y - ry, x + rx, y + ry, [[0, '#9a9486'], [0.45, '#6e695e'], [1, '#34312b']]));
      for (let i = 0; i < 3; i++) { const fx = x + (R() - 0.6) * rx, fy = y - ry * 0.3 + (R() - 0.5) * ry; shape(c, [fx, fy, fx + 6 + R() * 6, fy - 2, fx + 3, fy + 5], 'rgba(255,250,235,0.1)'); }
      curve(c, x - rx * 0.4, y - ry * 0.5, x - rx * 0.1, y, x - rx * 0.3, y + ry * 0.6, 'rgba(15,12,10,0.35)', 0.8);
    }
    // topo: neve, rocha nua ou grama
    const top = snow ? ['#eef2f5', '#c4ccd6'] : h >= 3 ? ['#8e887a', '#6a6558'] : ['#5a7a3c', '#3c5828'];
    const ty = base - H;
    for (let i = 0; i < 9; i++) { const x = cx + (R() - 0.5) * 60, y = ty + (R() - 0.5) * 14, r = 10 + R() * 10; dab(c, x, y, r, r * 0.5, R() < 0.5 ? top[0] : top[1]); }
    if (!snow && h < 3) for (let i = 0; i < 26; i++) { const x = cx + (R() - 0.5) * 60, y = ty + (R() - 0.5) * 14; stroke(c, [x, y, x + (R() - 0.5) * 2, y - 3 - R() * 3], R() < 0.5 ? '#6a8a44' : '#4a6a30', 0.8); }
    if (snow) for (let i = 0; i < 6; i++) { const x = cx + (R() - 0.5) * 50; stroke(c, [x, ty + 6, x + (R() - 0.5) * 4, ty + 16 + R() * 14], 'rgba(235,242,248,0.8)', 2.4); }
  });
}

// ---------- construções ----------
function buildingSprite(b, night) {
  const w = b.w, h = b.h, H = b.wall * 2, RH = b.roof * 2;
  const ox = h * 32 + 12, oy = H + RH + 70, W = (w + h) * 32 + 24, HT = oy + (w + h) * 16 + 10;
  return paint(`bld|${b.x}|${b.y}|${night ? 1 : 0}`, W, HT, ox, oy, (c, R) => {
    const P = (x, y, z) => [ox + (x - y) * 32, oy + (x + y) * 16 - z];
    const style = {
      temple: { wall: '#d8d0bc', roof: '#3a5480', tex: 'stone', roofTex: 'shingle', trim: '#c9a24a' },
      shop: { wall: '#e0cfa6', roof: '#943828', tex: 'plaster', roofTex: 'shingle', trim: '#4a2f17' },
      tavern: { wall: '#d6c296', roof: '#8a6a2a', tex: 'plaster', roofTex: 'thatch', trim: '#3a2410' },
      house: { wall: '#ddd0b0', roof: b.x % 2 ? '#7a3828' : '#8a7a3a', tex: 'plaster', roofTex: b.x % 2 ? 'shingle' : 'thatch', trim: '#4a2f17' },
      smith: { wall: '#7e796e', roof: '#45403c', tex: 'stone', roofTex: 'shingle', trim: '#2a1e14' },
      barracks: { wall: '#928c80', roof: '#5a3a30', tex: 'stone', roofTex: 'shingle', trim: '#2a1e14' },
      stairtower: { wall: '#a29c90', roof: '#3e4a66', tex: 'stone', roofTex: 'shingle', trim: '#2a1e14' },
      castle: { wall: '#b4ad9c', roof: '#3e4a66', tex: 'stone', roofTex: 'shingle', trim: '#c9a24a' },
      stable: { wall: '#8a6a44', roof: '#9a7a2e', tex: 'wood', roofTex: 'thatch', trim: '#3a2410' },
    }[b.kind];
    const timber = style.tex === 'plaster';
    // sombra de contato
    shape(c, [...P(-0.2, h + 0.2, 0), ...P(w + 0.3, h + 0.3, 0), ...P(w + 0.3, -0.2, 0)], 'rgba(0,0,0,0.25)');
    const L = [...P(0, h, 0), ...P(w, h, 0), ...P(w, h, H), ...P(0, h, H)];
    const Rt = [...P(w, h, 0), ...P(w, 0, 0), ...P(w, 0, H), ...P(w, h, H)];
    c.fillStyle = texPattern(c, style.tex, style.wall); shape(c, L, c.fillStyle);
    shape(c, L, lgrad(c, 0, P(0, h, H)[1], 0, P(0, h, 0)[1], [[0, 'rgba(255,240,210,0.12)'], [1, 'rgba(0,0,0,0.18)']]));
    c.fillStyle = texPattern(c, style.tex, shadeH(style.wall, -0.18)); shape(c, Rt, c.fillStyle);
    shape(c, Rt, 'rgba(10,10,40,0.22)');
    // base de pedra
    if (style.tex !== 'stone') { const bh = 10; c.fillStyle = texPattern(c, 'stone', '#77736a'); shape(c, [...P(0, h, 0), ...P(w, h, 0), ...P(w, h, bh), ...P(0, h, bh)], c.fillStyle); shape(c, [...P(w, h, 0), ...P(w, 0, 0), ...P(w, 0, bh), ...P(w, h, bh)], c.fillStyle); shape(c, [...P(w, h, 0), ...P(w, 0, 0), ...P(w, 0, bh), ...P(w, h, bh)], 'rgba(0,0,30,0.25)'); }
    // enxaimel
    if (timber) {
      const beam = (a, b2) => stroke(c, [...a, ...b2], style.trim, 3);
      for (let k = 0; k <= w; k++) beam(P(k, h, 10), P(k, h, H));
      for (let k = 0; k <= h; k++) beam(P(w, h - k, 10), P(w, h - k, H));
      beam(P(0, h, H * 0.55), P(w, h, H * 0.55)); beam(P(w, h, H * 0.55), P(w, 0, H * 0.55));
      beam(P(0, h, H - 1.5), P(w, h, H - 1.5)); beam(P(w, h, H - 1.5), P(w, 0, H - 1.5));
      for (let k = 0; k < w; k++) beam(P(k, h, 10), P(k + 1, h, H * 0.55));
    }
    // janelas em arco
    const win = (face, u) => {
      const Fp = face === 'L' ? (uu, z) => P(uu * w, h, z) : (uu, z) => P(w, h - uu * h, z);
      const n = face === 'L' ? w : h, ww = 0.3 / n, z0 = H * 0.45, z1 = H * 0.8;
      const a = Fp(u - ww, z0), b2 = Fp(u + ww, z0), cc = Fp(u + ww, z1), d = Fp(u - ww, z1), top = Fp(u, z1 + 5);
      const glass = night ? rgrad(c, (a[0] + cc[0]) / 2, (a[1] + cc[1]) / 2, 0, 12, [[0, '#fff0b8'], [1, '#e89838']]) : lgrad(c, d[0], d[1], b2[0], b2[1], [[0, '#5a7a94'], [1, '#1e2c3a']]);
      c.fillStyle = style.trim; c.beginPath(); c.moveTo(a[0] - 2, a[1] + 1.5); c.lineTo(b2[0] + 2, b2[1] + 1.5); c.lineTo(cc[0] + 2, cc[1]); c.quadraticCurveTo(top[0], top[1] - 3, d[0] - 2, d[1]); c.closePath(); c.fill();
      c.fillStyle = glass; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b2[0], b2[1]); c.lineTo(cc[0], cc[1]); c.quadraticCurveTo(top[0], top[1], d[0], d[1]); c.closePath(); c.fill();
      stroke(c, [(a[0] + b2[0]) / 2, (a[1] + b2[1]) / 2, (d[0] + cc[0]) / 2, (d[1] + cc[1]) / 2 - 2], style.trim, 1);
    };
    const wins = b.kind === 'temple' ? [['R', 0.25], ['R', 0.75], ['L', 0.2], ['L', 0.8]] : b.kind === 'house' || b.kind === 'stable' ? [['R', 0.5], ['L', 0.22]] : [['R', 0.3], ['R', 0.72], ['L', 0.16], ['L', 0.84]];
    for (const [f, u] of wins) win(f, u);
    // porta em arco
    { const Fp = (uu, z) => P(uu * w, h, z), dw = 0.42 / w, dz = b.kind === 'temple' ? 36 : 26;
      const a = Fp(0.5 - dw, 0), b2 = Fp(0.5 + dw, 0), cc = Fp(0.5 + dw, dz), d = Fp(0.5 - dw, dz), top = Fp(0.5, dz + 10);
      c.fillStyle = '#2a1a0e'; c.beginPath(); c.moveTo(a[0] - 2, a[1]); c.lineTo(b2[0] + 2, b2[1]); c.lineTo(cc[0] + 2, cc[1]); c.quadraticCurveTo(top[0], top[1] - 4, d[0] - 2, d[1]); c.closePath(); c.fill();
      c.fillStyle = texPattern(c, 'wood', '#6a4424'); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b2[0], b2[1]); c.lineTo(cc[0], cc[1]); c.quadraticCurveTo(top[0], top[1], d[0], d[1]); c.closePath(); c.fill();
      dab(c, cc[0] - 4, (cc[1] + b2[1]) / 2, 1.3, 1.3, '#c9a24a'); }
    // telhado
    const o = 0.42, ridgeX = w >= h;
    const A = P(-o, -o, H), B = P(w + o, -o, H), Cc = P(w + o, h + o, H), D = P(-o, h + o, H);
    const r1 = ridgeX ? P(h * 0.5, h / 2, H + RH) : P(w / 2, w * 0.5, H + RH), r2 = ridgeX ? P(w - h * 0.5, h / 2, H + RH) : P(w / 2, h - w * 0.5, H + RH);
    const roofFill = dark => { c.fillStyle = texPattern(c, style.roofTex, dark ? shadeH(style.roof, -0.3) : style.roof); return c.fillStyle; };
    if (ridgeX) {
      shape(c, [...A, ...B, ...r2, ...r1], roofFill(true)); shape(c, [...A, ...r1, ...D], roofFill(true));
      shape(c, [...B, ...Cc, ...r2], roofFill(true)); shape(c, [...B, ...Cc, ...r2], 'rgba(0,0,30,0.2)');
      shape(c, [...D, ...Cc, ...r2, ...r1], roofFill(false));
      shape(c, [...D, ...Cc, ...r2, ...r1], lgrad(c, 0, r1[1], 0, D[1], [[0, 'rgba(255,240,200,0.15)'], [1, 'rgba(0,0,0,0.15)']]));
    } else {
      shape(c, [...A, ...r1, ...r2, ...D], roofFill(true)); shape(c, [...A, ...B, ...r1], roofFill(true));
      shape(c, [...D, ...Cc, ...r2], roofFill(false));
      shape(c, [...B, ...Cc, ...r2, ...r1], roofFill(false)); shape(c, [...B, ...Cc, ...r2, ...r1], 'rgba(0,0,30,0.2)');
    }
    stroke(c, [...r1, ...r2], shadeH(style.roof, 0.25), 3);
    curve(c, D[0], D[1] + 1, (D[0] + Cc[0]) / 2, (D[1] + Cc[1]) / 2 + 3, Cc[0], Cc[1] + 1, shadeH(style.roof, -0.45), 2);
    curve(c, Cc[0], Cc[1] + 1, (Cc[0] + B[0]) / 2, (Cc[1] + B[1]) / 2 + 3, B[0], B[1] + 1, shadeH(style.roof, -0.55), 2);
    // extras
    const mid = [(r1[0] + r2[0]) / 2, (r1[1] + r2[1]) / 2];
    if (b.kind === 'temple') {
      const [tx, ty] = mid;
      c.fillStyle = texPattern(c, 'stone', style.wall); c.fillRect(tx - 11, ty - 38, 22, 38); c.fillStyle = 'rgba(0,0,30,0.25)'; c.fillRect(tx, ty - 38, 11, 38);
      c.fillStyle = '#1e1810'; c.beginPath(); c.moveTo(tx - 5, ty - 12); c.lineTo(tx - 5, ty - 26); c.arc(tx, ty - 26, 5, Math.PI, 0); c.lineTo(tx + 5, ty - 12); c.fill();
      dab(c, tx, ty - 20, 3, 3, '#c9a24a');
      shape(c, [tx - 15, ty - 38, tx, ty - 68, tx + 15, ty - 38], c.fillStyle = texPattern(c, 'shingle', style.roof)); shape(c, [tx, ty - 68, tx + 15, ty - 38, tx, ty - 38], 'rgba(0,0,30,0.25)');
      softDab(c, tx, ty - 74, 8, '#ffe28a', 0.5); dab(c, tx, ty - 74, 4, 4, '#e2b74e');
    }
    if (b.kind === 'tavern' || b.kind === 'house' || b.kind === 'smith') {
      const cp = P(w * 0.3, h * 0.35, H + RH * 0.75);
      c.fillStyle = texPattern(c, 'stone', '#7a766c'); c.fillRect(cp[0] - 6, cp[1] - 26, 12, 28); c.fillStyle = 'rgba(0,0,30,0.3)'; c.fillRect(cp[0], cp[1] - 26, 6, 28); c.fillStyle = '#4a463e'; c.fillRect(cp[0] - 8, cp[1] - 28, 16, 4);
    }
    if (b.kind === 'shop' || b.kind === 'tavern' || b.kind === 'smith') {
      const p = P(w * 0.82, h, 10 + (H - 10) * 0.48);
      stroke(c, [p[0], p[1] - 6, p[0] + 18, p[1] - 2], '#2a2a2e', 2);
      c.fillStyle = texPattern(c, 'wood', '#7a5634'); c.fillRect(p[0] + 8, p[1], 20, 16); c.strokeStyle = '#3a2414'; c.lineWidth = 1.2; c.strokeRect(p[0] + 8, p[1], 20, 16);
      if (b.kind === 'shop') { dab(c, p[0] + 18, p[1] + 8, 4.5, 4.5, '#e2b74e'); dab(c, p[0] + 17, p[1] + 7, 1.5, 1.5, '#fff0b0'); }
      else if (b.kind === 'tavern') { c.fillStyle = '#d8a83a'; c.fillRect(p[0] + 14, p[1] + 4, 7, 9); c.fillStyle = '#fff4d8'; c.fillRect(p[0] + 14, p[1] + 3, 7, 2.4); }
      else { stroke(c, [p[0] + 13, p[1] + 12, p[0] + 23, p[1] + 4], '#c8ccd2', 2); stroke(c, [p[0] + 12, p[1] + 5, p[0] + 16, p[1] + 9], '#8a6a2a', 2); }
    }
  });
}
function buildingWindows(b) {
  const w = b.w, h = b.h, H = b.wall * 2, zc = H * 0.62;
  const list = b.kind === 'temple' ? [['R', 0.25], ['R', 0.75], ['L', 0.2], ['L', 0.8]] : b.kind === 'house' || b.kind === 'stable' ? [['R', 0.5], ['L', 0.22]] : [['R', 0.3], ['R', 0.72], ['L', 0.16], ['L', 0.84]];
  return list.map(([f, u]) => f === 'L' ? [b.x - 0.5 + u * w, b.y - 0.5 + h, zc] : [b.x - 0.5 + w, b.y - 0.5 + h - u * h, zc]);
}
