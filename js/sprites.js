// ============================================================
//  SPRITES — heróis (esqueleto com membros dinâmicos), NPCs,
//  monstros e ícones, em pixel art realista (resolução 2x).
// ============================================================
// ---------- visual de cada skin ----------
function heroLook(cls, skinId, accentHex) {
  const A = tone(accentHex || '#8b2e2e');
  const L = {
    skin: tone('#d8a47f'), hair: tone('#4a3424'), hairStyle: 'short', beard: null, eyes: px('#20160e'),
    armor: 'plate', body: tone('#a3a9b3'), body2: tone('#5b3a22'), accent: A, legs: tone('#4b4a52'), boots: tone('#3b2a1f'),
    cape: false, capeTone: tone(shadeHex(accentHex, -0.25)), head: 'none', headTone: tone('#a3a9b3'), plume: A,
    weapon: null, shield: null, pauldron: null, quiver: false, trim: tone('#c9a24a'), orb: '#7fb2ff', pattern: null, extra: null,
  };
  switch (cls + ':' + skinId) {
    case 'knight:iron': Object.assign(L, { armor: 'plate', head: 'greathelm', cape: true, weapon: 'sword', shield: 'kite', pauldron: 'round' }); break;
    case 'knight:dragon': Object.assign(L, {
      armor: 'plate', body: tone('#4a2326'), body2: tone('#2a1416'), headTone: tone('#3a1c1e'), head: 'horned', cape: true,
      capeTone: tone('#5a1414'), weapon: 'darkblade', shield: 'dragon', pauldron: 'spike', legs: tone('#2c2224'), boots: tone('#1e1517'),
      trim: tone('#b8442e'), pattern: 'scales', extra: 'ember' }); break;
    case 'knight:sun': Object.assign(L, {
      armor: 'plate', body: tone('#e3dccb'), body2: tone('#b58a3a'), headTone: tone('#d9b65a'), head: 'winged', cape: true,
      capeTone: tone('#f0ead8'), weapon: 'goldsword', shield: 'sun', pauldron: 'wing', legs: tone('#cfc6b0'), boots: tone('#8a6a34'),
      trim: tone('#e2b74e'), extra: 'halo' }); break;
    case 'archer:scout': Object.assign(L, { armor: 'leather', body: tone('#5d6b3c'), body2: tone('#6b4a2b'), head: 'hood', weapon: 'bow', quiver: true, legs: tone('#5a4636'), boots: tone('#4a3220'), hair: tone('#6b4423') }); break;
    case 'archer:winter': Object.assign(L, {
      armor: 'leather', body: tone('#3f5a78'), body2: tone('#d9dde2'), head: 'furhood', headTone: tone('#e4e7ea'), weapon: 'frostbow', quiver: true,
      legs: tone('#3b4656'), boots: tone('#cfd5dc'), cape: true, capeTone: tone('#c9d0d8'), hair: tone('#c9c2b8'), extra: 'frost' }); break;
    case 'archer:sylvan': Object.assign(L, {
      armor: 'leather', body: tone('#3e7449'), body2: tone('#c9a24a'), head: 'circlet', hairStyle: 'long', hair: tone('#e0c27a'), weapon: 'elfbow',
      quiver: true, legs: tone('#2f5236'), boots: tone('#6b4a2b'), cape: true, capeTone: tone(shadeHex(accentHex, -0.1)), pattern: 'leaves', skin: tone('#e8c3a0'), extra: 'leaf' }); break;
    case 'mage:adept': Object.assign(L, { armor: 'robe', body: A, body2: tone(shadeHex(accentHex, -0.45)), head: 'wizard', headTone: tone(shadeHex(accentHex, -0.2)), weapon: 'staff', beard: tone('#cfc9c0'), hair: tone('#cfc9c0') }); break;
    case 'mage:astral': Object.assign(L, {
      armor: 'robe', body: tone('#22305e'), body2: tone('#141c3a'), head: 'astralhood', headTone: tone('#1b2550'), weapon: 'starstaff', orb: '#c9e1ff',
      pattern: 'stars', trim: tone('#d9c27a'), cape: true, capeTone: tone(shadeHex(accentHex, -0.3)), extra: 'orbit', hair: tone('#e8e4dc') }); break;
    case 'mage:druid': Object.assign(L, {
      armor: 'robe', body: tone('#5c4a33'), body2: tone('#3f5a32'), head: 'antlerhood', headTone: tone('#4a6b38'), weapon: 'druidstaff', orb: '#9be37a',
      beard: tone('#d8d2c4'), hair: tone('#d8d2c4'), pattern: 'leaves', trim: tone('#8fbf5a'), extra: 'leaf' }); break;
  }
  return L;
}
function shadeHex(hex, amt) {
  const [r, g, b] = rgbOf(hex || '#888888'); const t = amt < 0 ? 0 : 255, f = Math.abs(amt);
  const h = v => Math.round(v + (t - v) * f).toString(16).padStart(2, '0');
  return '#' + h(r) + h(g) + h(b);
}
const NPC_LOOKS = {
  priest: () => Object.assign(heroLook('mage', 'adept', '#e9e2cf'), { body: tone('#e9e2cf'), body2: tone('#c9a24a'), head: 'hood', accent: tone('#f2ecdc'), weapon: 'book', beard: null, hair: tone('#6b4a2b'), skin: tone('#e2b896') }),
  merchant: () => Object.assign(heroLook('archer', 'scout', '#2f5a3a'), { armor: 'vest', body: tone('#7a3b22'), body2: tone('#d6c9a8'), head: 'cap', headTone: tone('#2f5a3a'), weapon: null, quiver: false, beard: tone('#5a3a22'), hair: tone('#5a3a22') }),
  innkeeper: () => Object.assign(heroLook('archer', 'scout', '#8b3a22'), { armor: 'vest', body: tone('#8b3a22'), body2: tone('#ece6d6'), head: 'none', hairStyle: 'long', hair: tone('#a8562a'), weapon: 'mug', quiver: false, skin: tone('#e8b994') }),
  guard: () => Object.assign(heroLook('knight', 'iron', '#2c4a7a'), { head: 'helm', cape: false, weapon: 'spear', shield: null, beard: tone('#5a4a3a') }),
  smith: () => Object.assign(heroLook('archer', 'scout', '#5a3a22'), { armor: 'vest', body: tone('#5a4a3e'), body2: tone('#6b4423'), head: 'none', hair: tone('#3a2a1e'), hairStyle: 'short', beard: tone('#6a3a1e'), weapon: 'hammer', quiver: false, skin: tone('#c8906a') }),
  captain: () => Object.assign(heroLook('knight', 'iron', '#2c3f6b'), { head: 'none', hairStyle: 'short', hair: tone('#2a2420'), body: tone('#6f7682'), cape: true, capeTone: tone('#24365c'), shield: null, weapon: 'sword', pauldron: 'round', scar: true }),
};

// ============================================================
//  ESQUELETO DOS HERÓIS — juntas (ombro, cotovelo, quadril, joelho)
//  num "3D simplificado" projetado para 4 vistas. Cada animação é
//  uma sequência de poses (keyframes) interpoladas.
//  Eixos do corpo: f = frente, s = lado, v = para baixo.
// ============================================================
const HW = 88, HH = 116, HAX = 44, HAY = 108;
const BODY = { thigh: 13, shin: 14, neck: -24, head: -31, shoulder: 8.5, hip: 4, upper: 11, fore: 10.5 };

const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul3 = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dir3 = (th, ph, side) => [Math.sin(th) * Math.cos(ph), side * Math.sin(ph), Math.cos(th) * Math.cos(ph)];
function proj(p, view) {
  if (view === 'E') return [p[0] + p[1] * 0.28, p[2], p[1]];
  if (view === 'S') return [p[1], p[2], p[0]];
  return [-p[1], p[2], -p[0]];
}

// ---------- poses-base por classe ----------
const BASE = {
  knight: { aA: [0.3, 0.12, 0.55], aB: [0.55, 0.2, 0.9], wp: 0.55, tl: 0.02 },
  archer: { aA: [0.12, 0.12, 0.35], aB: [0.06, 0.1, 0.25], wp: 3.14, tl: 0 },
  mage: { aA: [0.4, 0.16, 0.85], aB: [0.15, 0.12, 0.4], wp: 3.1, tl: 0.02 },
};
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => t * t * (3 - 2 * t);

// keyframes: [progresso, {campos}] — campos ausentes ficam na pose-base
const ACTS = {
  // ---- Cavaleiro (preparação -> impacto rápido -> acompanhamento) ----
  swing: [[0, {}], [0.28, { aA: [2.9, 0.3, 0.5], wp: 3.6, tl: -0.2, tw: -0.6, kn: -0.25 }], [0.42, { aA: [1.6, 0.15, 0.1], wp: 1.9, tl: 0.15, tw: 0.2, kn: -0.3 }], [0.52, { aA: [0.7, 0.05, 0.05], wp: 0.9, tl: 0.34, tw: 0.55, lA: [0.5, -0.25], kn: -0.38 }], [0.78, { aA: [0.55, 0.1, 0.2], wp: 0.7, tl: 0.25, tw: 0.45, kn: -0.2 }], [1, {}]],
  bash: [[0, {}], [0.36, { aA: [3.1, 0.15, 0.3], aB: [3.0, -0.05, 0.4], wp: 3.5, tl: -0.3, kn: -0.2 }], [0.5, { aA: [1.3, 0.05, 0.05], aB: [1.2, 0, 0.15], wp: 1.4, tl: 0.48, kn: -0.8 }], [0.72, { aA: [1.1, 0.05, 0.1], aB: [1.0, 0, 0.2], wp: 1.25, tl: 0.42, kn: -0.72 }], [1, {}]],
  spin: [[0, { tw: 0 }], [0.2, { aA: [1.2, 1.2, 0.2], wp: 1.57, tw: -0.9, kn: -0.4, tl: 0.12 }], [0.75, { aA: [1.3, 1.25, 0.05], wp: 1.57, tw: 6.0, kn: -0.45 }], [0.88, { tw: 6.45, kn: -0.3, tl: 0.1 }], [1, { tw: 6.28 }]],
  block: [[0, {}], [0.18, { aB: [1.65, 0.05, 0.4], aA: [0.6, 0.1, 0.9], wp: 2.2, tl: 0.2, kn: -0.6 }], [0.82, { aB: [1.6, 0.05, 0.4], aA: [0.6, 0.1, 0.9], wp: 2.2, tl: 0.2, kn: -0.6 }], [1, {}]],
  warcry: [[0, {}], [0.22, { aA: [0.6, 0.2, 1.2], aB: [0.6, 0.3, 1.2], tl: 0.25, kn: -0.35 }], [0.42, { aA: [3.1, 0.3, 0.05], aB: [1.2, 1.1, 0.2], wp: 3.14, tl: -0.28, ht: -0.45, mouth: 1 }], [0.85, { aA: [3.05, 0.3, 0.08], aB: [1.2, 1.1, 0.2], wp: 3.14, tl: -0.24, ht: -0.4, mouth: 1 }], [1, {}]],
  // ---- Atirador ----
  shoot: [[0, {}], [0.15, { aA: [1.5, 0, 0], aB: [1.4, 0.05, -0.4], tw: 0.45, pull: 0.2, tl: -0.05 }], [0.55, { aA: [1.57, 0, 0], aB: [1.25, 0.12, -2.35], tw: 0.55, pull: 1, tl: -0.08 }], [0.62, { aA: [1.62, 0, 0], aB: [0.9, 0.5, -2.7], tw: 0.55, pull: 0, tl: 0.06 }], [0.85, { aA: [1.5, 0, 0], aB: [0.7, 0.4, -1.5], tw: 0.4 }], [1, {}]],
  double: [[0, {}], [0.14, { aA: [1.55, 0, 0], aB: [1.3, 0.1, -2.2], tw: 0.5, pull: 1 }], [0.24, { aA: [1.62, 0, 0], aB: [1.0, 0.4, -2.6], tw: 0.5, pull: 0, tl: 0.05 }], [0.46, { aA: [1.55, 0, 0], aB: [1.3, 0.1, -2.2], tw: 0.5, pull: 1, tl: -0.04 }], [0.56, { aA: [1.62, 0, 0], aB: [1.0, 0.4, -2.6], tw: 0.5, pull: 0, tl: 0.06 }], [1, {}]],
  pierce: [[0, {}], [0.3, { aA: [1.5, 0, 0], aB: [1.3, 0.1, -1.0], tw: 0.6, kn: -0.7, tl: 0.18, pull: 0.4 }], [0.68, { aA: [1.52, 0, 0], aB: [1.2, 0.15, -2.55], tw: 0.65, kn: -0.7, tl: 0.18, pull: 1, glow: 1 }], [0.74, { aA: [1.65, 0, 0], aB: [0.8, 0.5, -2.8], tw: 0.6, tl: -0.2, pull: 0 }], [0.9, { tl: -0.1, tw: 0.3 }], [1, {}]],
  rain: [[0, {}], [0.3, { aA: [2.6, 0, 0], aB: [2.25, 0.1, -2.15], tl: -0.34, tw: 0.4, pull: 1, kn: -0.3 }], [0.58, { aA: [2.65, 0, 0], aB: [1.9, 0.4, -2.6], tl: -0.36, tw: 0.4, pull: 0 }], [1, {}]],
  dash: [[0, {}], [0.25, { tl: 0.2, kn: -0.85, aA: [-0.5, 0.2, 0.3], aB: [-0.6, 0.2, 0.3] }], [0.5, { tl: 0.5, lA: [0.85, -0.4], lB: [-0.75, -0.7], aA: [-1.0, 0.25, 0.4], aB: [-1.0, 0.25, 0.4] }], [1, {}]],
  // ---- Mago ----
  bolt: [[0, {}], [0.3, { aA: [0.3, 0.1, 1.2], wp: 2.4, tl: -0.12, aB: [0.5, 0.3, 0.8] }], [0.48, { aA: [1.4, 0.1, 0.05], wp: 1.35, aB: [1.4, 0.3, 0.05], tl: 0.24, glow: 1 }], [0.75, { aA: [1.3, 0.1, 0.1], wp: 1.3, aB: [1.2, 0.3, 0.1], tl: 0.16, glow: 1 }], [1, {}]],
  fireball: [[0, {}], [0.38, { aB: [-0.7, 0.4, 1.6], aA: [0.9, 0.2, 0.6], wp: 2.6, tw: -0.5, tl: -0.12, kn: -0.25 }], [0.55, { aB: [1.6, 0.05, 0.05], aA: [0.8, 0.2, 0.6], wp: 2.5, tw: 0.45, tl: 0.26, glow: 1 }], [0.8, { aB: [1.4, 0.1, 0.1], tw: 0.35, tl: 0.18 }], [1, {}]],
  nova: [[0, {}], [0.38, { aA: [2.9, 0.15, 0.3], aB: [2.8, -0.1, 0.4], wp: 3.1, tl: -0.16 }], [0.55, { aA: [0.7, 0.1, 0.4], aB: [0.8, 0.1, 0.5], wp: 0.05, tl: 0.34, kn: -0.85, glow: 1 }], [0.78, { aA: [0.75, 0.1, 0.4], wp: 0.1, tl: 0.3, kn: -0.7, glow: 1 }], [1, {}]],
  heal: [[0, {}], [0.4, { aA: [2.1, 0.9, 0.2], aB: [2.1, 0.9, 0.2], wp: 2.8, ht: -0.32, glow: 1 }], [0.8, { aA: [2.25, 1.0, 0.2], aB: [2.25, 1.0, 0.2], wp: 2.8, ht: -0.32, glow: 1 }], [1, {}]],
  meteor: [[0, { aA: [2.9, 0.2, 0.2], aB: [2.9, 0.1, 0.2], wp: 3.1, ht: -0.25 }], [0.35, { aA: [3.1, 0.25, 0.1], aB: [3.1, 0.15, 0.1], wp: 3.14, ht: -0.4, tl: -0.2, glow: 1 }], [0.52, { aA: [0.95, 0.2, 0.2], aB: [1.0, 0.15, 0.2], wp: 1.6, tl: 0.42, kn: -0.6, glow: 1 }], [0.8, { aA: [0.9, 0.2, 0.25], wp: 1.5, tl: 0.32, kn: -0.45 }], [1, {}]],
  cast: [[0, { aA: [2.0, 0.6, 0.6], aB: [2.0, 0.7, 0.6], wp: 2.9, glow: 1 }], [0.5, { aA: [2.3, 0.7, 0.4], aB: [2.3, 0.8, 0.4], wp: 3.0, glow: 1 }], [1, { aA: [2.0, 0.6, 0.6], aB: [2.0, 0.7, 0.6], wp: 2.9, glow: 1 }]],
  // ---- variações de ataque ----
  kick: [[0, {}], [0.28, { lA: [1.35, -2.0], lB: [-0.1, -0.35], tl: -0.2, aA: [0.7, 0.7, 0.5], aB: [0.6, 0.7, 0.5], wp: 1.1 }], [0.45, { lA: [1.85, 0.05], lB: [-0.25, -0.15], tl: -0.5, aA: [0.3, 0.95, 0.2], aB: [0.3, 0.95, 0.2], wp: 0.6 }], [0.62, { lA: [1.8, 0.0], lB: [-0.25, -0.15], tl: -0.45, aA: [0.3, 0.9, 0.2], aB: [0.3, 0.9, 0.2] }], [0.82, { lA: [0.7, -0.9], tl: -0.15 }], [1, {}]],
  execute: [[0, {}], [0.35, { aA: [3.1, 0.1, 0.2], aB: [3.0, -0.05, 0.3], wp: 3.4, tl: -0.35, ht: -0.3, kn: -0.2 }], [0.5, { aA: [1.2, 0.05, 0.05], aB: [1.1, 0, 0.1], wp: 1.2, tl: 0.6, kn: -0.95, mouth: 1 }], [0.8, { aA: [1.0, 0.05, 0.1], aB: [1.0, 0, 0.15], wp: 1.0, tl: 0.5, kn: -0.85 }], [1, {}]],
  quiver: [[0, {}], [0.25, { aB: [2.9, 0.3, 2.6], aA: [1.2, 0, 0], tw: -0.3, ht: 0.1 }], [0.4, { aB: [2.6, 0.2, 2.3], aA: [1.4, 0, 0], tw: -0.2 }], [0.65, { aA: [1.57, 0, 0], aB: [1.25, 0.12, -2.4], tw: 0.55, pull: 1, tl: -0.08 }], [0.72, { aA: [1.62, 0, 0], aB: [0.9, 0.5, -2.7], tw: 0.55, pull: 0, tl: 0.06 }], [1, {}]],
  turnshot: [[0, {}], [0.15, { aA: [1.55, 0, 0], aB: [1.3, 0.1, -2.2], tw: 0.5, pull: 1 }], [0.24, { aA: [1.62, 0, 0], aB: [1.0, 0.4, -2.6], tw: 0.5, pull: 0 }], [0.5, { yaw: 3.14, aA: [1.4, 0, 0], aB: [1.2, 0.1, -1.6], tw: 0.3, pull: 0.5, kn: -0.3 }], [0.66, { yaw: 3.14, aA: [1.55, 0, 0], aB: [1.3, 0.1, -2.3], tw: 0.5, pull: 1 }], [0.74, { yaw: 3.14, aA: [1.62, 0, 0], aB: [1.0, 0.4, -2.6], tw: 0.5, pull: 0 }], [0.9, { yaw: 3.14 }], [1, { yaw: 6.28 }]],
  dualcast: [[0, {}], [0.35, { aA: [0.4, 0.3, 1.4], aB: [0.4, 0.3, 1.4], wp: 2.2, tl: -0.15, glow: 1 }], [0.52, { aA: [1.5, 0.25, 0.05], aB: [1.5, 0.25, 0.05], wp: 1.4, tl: 0.25, glow: 1 }], [0.8, { aA: [1.4, 0.25, 0.1], aB: [1.4, 0.25, 0.1], wp: 1.3, tl: 0.18, glow: 1 }], [1, {}]],
  turncast: [[0, {}], [0.2, { aB: [1.5, 0.1, 0.05], aA: [0.8, 0.2, 0.6], wp: 2.4, tl: 0.2, glow: 1 }], [0.3, { aB: [1.3, 0.1, 0.1], glow: 1 }], [0.55, { yaw: 3.14, aB: [0.5, 0.3, 1.2], tl: -0.1, kn: -0.3, glow: 1 }], [0.7, { yaw: 3.14, aB: [1.55, 0.1, 0.05], aA: [0.8, 0.2, 0.6], wp: 2.4, tl: 0.22, glow: 1 }], [0.9, { yaw: 3.14 }], [1, { yaw: 6.28 }]],
  // ---- emojis ----
  salute: [[0, {}], [0.25, { aB: [2.55, 0.15, 2.5], ht: -0.08 }], [0.75, { aB: [2.55, 0.15, 2.5], ht: -0.08 }], [1, {}]],
  point: [[0, {}], [0.2, { aB: [1.6, 0.05, 0.05], tw: 0.25, ht: 0.05 }], [0.8, { aB: [1.6, 0.05, 0.05], tw: 0.25, ht: 0.05 }], [1, {}]],
  // ---- combate direcional ----
  atk_over:   [[0, {}], [0.36, { aA: [2.9, 0.25, 1.5], wp: 3.7, tl: -0.12, ht: -0.15 }], [0.5, { aA: [0.85, 0.1, 0.1], wp: 0.6, tl: 0.35, ht: 0.15 }], [0.62, { aA: [0.6, 0.12, 0.15], wp: 0.3, tl: 0.3 }], [1, {}]],
  atk_under:  [[0, {}], [0.36, { aA: [-0.7, 0.35, 0.3], wp: -1.0, tl: 0.3 }], [0.5, { aA: [1.9, 0.12, 0.2], wp: 2.4, tl: -0.15 }], [0.62, { aA: [2.1, 0.12, 0.25], wp: 2.6, tl: -0.12 }], [1, {}]],
  atk_slashR: [[0, {}], [0.36, { tw: 0.95, yaw: 0.35, aA: [2.05, 0.15, 1.45], wp: 2.75, tl: 0.02 }], [0.47, { tw: 0.1, yaw: 0, aA: [1.5, 0.1, 0.35], wp: 1.75 }], [0.55, { tw: -0.85, yaw: -0.45, aA: [1.45, 0.05, 0.15], wp: 1.6, tl: 0.15 }], [0.66, { tw: -0.95, yaw: -0.5, aA: [1.3, 0.05, 0.25], wp: 1.4, tl: 0.12 }], [1, {}]],
  atk_slashL: [[0, {}], [0.36, { tw: -0.95, yaw: -0.35, aA: [1.7, -0.55, 1.35], wp: 2.45, tl: 0.02 }], [0.47, { tw: -0.1, yaw: 0, aA: [1.5, -0.1, 0.4], wp: 1.8 }], [0.55, { tw: 0.85, yaw: 0.45, aA: [1.45, 0.55, 0.15], wp: 1.6, tl: 0.15 }], [0.66, { tw: 0.95, yaw: 0.5, aA: [1.3, 0.6, 0.25], wp: 1.4, tl: 0.12 }], [1, {}]],
  atk_stab:   [[0, {}], [0.36, { aA: [0.55, 0.2, 1.95], wp: 1.5, tl: -0.08, lA: [-0.25, -0.2] }], [0.5, { aA: [1.52, 0.05, 0.05], wp: 1.55, tl: 0.3, lA: [0.5, -0.3], lB: [-0.35, -0.1] }], [0.62, { aA: [1.5, 0.05, 0.08], wp: 1.55, tl: 0.28, lA: [0.45, -0.3] }], [1, {}]],
  parry:      [[0, { aA: [1.35, 0.55, 1.35], wp: 2.7, aB: [1.25, 0.25, 1.0], tl: 0.05 }], [1, { aA: [1.35, 0.55, 1.35], wp: 2.7, aB: [1.25, 0.25, 1.0], tl: 0.05 }]],
  // cavaleiro: saudação e apontar com a espada (braço da espada)
  salute_k: [[0, {}], [0.25, { aA: [1.35, 0.12, 1.25], wp: 3.05, ht: -0.08 }], [0.75, { aA: [1.35, 0.12, 1.25], wp: 3.05, ht: -0.08 }], [1, {}]],
  point_k: [[0, {}], [0.2, { aA: [1.55, 0.05, 0.05], wp: 1.6, tw: -0.25, ht: 0.05 }], [0.8, { aA: [1.55, 0.05, 0.05], wp: 1.6, tw: -0.25, ht: 0.05 }], [1, {}]],
  dance: [[0, { aA: [2.6, 0.7, 0.4], aB: [0.5, 0.6, 1.2], tw: 0.35, lA: [0.4, -0.6], kn: -0.2, ht: 0.1 }], [0.25, { aA: [1.4, 0.9, 0.9], aB: [1.4, 0.9, 0.9], tw: 0, kn: -0.45 }], [0.5, { aA: [0.5, 0.6, 1.2], aB: [2.6, 0.7, 0.4], tw: -0.35, lB: [0.4, -0.6], kn: -0.2, ht: -0.1 }], [0.75, { aA: [1.4, 0.9, 0.9], aB: [1.4, 0.9, 0.9], tw: 0, kn: -0.45 }], [1, { aA: [2.6, 0.7, 0.4], aB: [0.5, 0.6, 1.2], tw: 0.35, lA: [0.4, -0.6], kn: -0.2, ht: 0.1 }]],
  // ---- reação ao golpe ----
  hurt: [[0, {}], [0.25, { tl: -0.38, aA: [0.7, 0.55, 0.6], aB: [0.7, 0.55, 0.6], ht: -0.45, kn: -0.35 }], [1, {}]],
};
const ACT_MS = { kick: 520, execute: 720, quiver: 760, turnshot: 950, dualcast: 560, turncast: 950, salute: 1200, point: 1300, dance: 900, hurt: 300, swing: 440, bash: 560, spin: 560, block: 650, warcry: 700, shoot: 440, double: 620, pierce: 640, rain: 560, dash: 560, bolt: 400, fireball: 520, nova: 620, heal: 680, meteor: 720, cast: 600, bite: 320 };
const IDLES = {
  look: [[0, {}], [0.25, { hw: 0.6 }], [0.6, { hw: -0.6 }], [1, {}]],
  stretch: [[0, {}], [0.4, { aA: [3.0, 0.3, 0.2], aB: [3.0, 0.3, 0.2], tl: -0.12, mouth: 1, wp: 3.1 }], [0.7, { aA: [3.0, 0.3, 0.2], aB: [3.0, 0.3, 0.2], tl: -0.12, wp: 3.1 }], [1, {}]],
  yawn: [[0, {}], [0.3, { aB: [1.4, 0.15, 1.9], ht: -0.15, mouth: 1 }], [0.7, { aB: [1.4, 0.15, 1.9], ht: -0.15, mouth: 1 }], [1, {}]],
  kick: [[0, {}], [0.3, { lA: [0.6, -0.3] }], [0.5, { lA: [0.1, 0] }], [0.7, { lA: [0.6, -0.3] }], [1, {}]],
  polish: [[0, {}], [0.3, { aA: [1.3, 0.0, 0.9], aB: [1.2, 0.0, 1.2], wp: 1.57, tl: 0.1, ht: 0.25 }], [0.8, { aA: [1.3, 0.0, 0.9], aB: [1.25, 0.0, 1.0], wp: 1.57, tl: 0.1, ht: 0.25 }], [1, {}]],
  pray: [[0, {}], [0.3, { aA: [1.0, -0.1, 1.5], aB: [1.0, -0.1, 1.5], ht: 0.25 }], [0.85, { aA: [1.0, -0.1, 1.5], aB: [1.0, -0.1, 1.5], ht: 0.25 }], [1, {}]],
  salute: [[0, {}], [0.3, { aA: [2.4, 0.4, 1.4] }], [0.8, { aA: [2.4, 0.4, 1.4] }], [1, {}]],
  drink: [[0, {}], [0.3, { aA: [1.5, 0.1, 1.8], ht: -0.2 }], [0.7, { aA: [1.5, 0.1, 1.8], ht: -0.25 }], [1, {}]],
  read: [[0, {}], [0.2, { aA: [0.9, 0.0, 1.1], aB: [0.9, 0.0, 1.1], ht: 0.3 }], [0.9, { aA: [0.9, 0.0, 1.1], aB: [0.9, 0.0, 1.1], ht: 0.3 }], [1, {}]],
  wave: [[0, {}], [0.25, { aA: [2.6, 0.5, 0.5] }], [0.45, { aA: [2.6, 0.8, 0.2] }], [0.65, { aA: [2.6, 0.5, 0.5] }], [1, {}]],
};

function sampleKeys(keys, p) {
  let a = keys[0], b = keys[keys.length - 1];
  for (let i = 0; i < keys.length - 1; i++) if (p >= keys[i][0] && p <= keys[i + 1][0]) { a = keys[i]; b = keys[i + 1]; break; }
  const t = ease((p - a[0]) / ((b[0] - a[0]) || 1));
  return { a: a[1], b: b[1], t };
}
function mixField(base, a, b, t, key) {
  const va = a[key] ?? base[key], vb = b[key] ?? base[key];
  if (va == null && vb == null) return undefined;
  if (Array.isArray(va) || Array.isArray(vb)) { const x = va || vb, y = vb || va; return x.map((v, i) => lerp(v, y[i], t)); }
  return lerp(va ?? 0, vb ?? 0, t);
}

// calcula a pose final (ângulos) a partir de caminhada + ação + idle
function buildPose(cls, P) {
  const base = BASE[cls] || BASE.knight;
  const Q = { aA: base.aA.slice(), aB: base.aB.slice(), wp: base.wp, tl: base.tl, tw: 0, lA: [0.04, -0.06], lB: [-0.04, -0.06], kn: 0, drop: 0, ht: 0, hw: 0, mouth: 0, pull: 0, glow: 0 };
  if (P.walk >= 0) {
    // ciclo de passada: a perna de apoio fica quase reta; o joelho dobra quando a perna avança
    const ph = P.walk / 12 * Math.PI * 2;
    const heavy = cls === 'knight' ? 1 : cls === 'mage' ? 0.6 : 0.4;
    const run = P.run ? 1 : 0, amp = (0.42 + (1 - heavy) * 0.06) * (1 + run * 0.45);
    const leg = p => {
      const hip = Math.sin(p) * amp;
      const swing = Math.max(0, Math.sin(p + 1.2));            // fase em que a perna vai para a frente
      const knee = -(Math.pow(swing, 1.4) * (0.95 + heavy * 0.2)) - 0.06 - (Math.cos(p) > 0.85 ? 0.12 : 0);
      return [hip, knee];
    };
    Q.lA = leg(ph); Q.lB = leg(ph + Math.PI);
    const armSw = (0.32 - heavy * 0.1) * (1 + run * 0.8);
    if (run) { Q.tl += 0.16; Q.aA[2] += cls === 'knight' ? 0 : 0.5; Q.aB[2] += 0.6; }
    Q.aB[0] += Math.sin(ph) * armSw; Q.aB[2] += 0.15 + Math.max(0, Math.sin(ph)) * 0.25;
    if (cls !== 'knight') { Q.aA[0] += -Math.sin(ph) * armSw * 0.7; Q.aA[2] += 0.1 + Math.max(0, -Math.sin(ph)) * 0.2; }
    Q.tl += 0.06 + heavy * 0.05;
    Q.tw += -Math.sin(ph) * (0.06 + heavy * 0.06);          // ombros giram ao contrário do quadril
    Q.sway = Math.sin(ph) * (0.035 + heavy * 0.02);            // quadril balança para os lados
    Q.ht += Math.abs(Math.cos(ph)) * 0.03;
  }
  const apply = (keys, p) => {
    const { a, b, t } = sampleKeys(keys, p);
    for (const k of ['aA', 'aB', 'wp', 'tl', 'tw', 'lA', 'lB', 'kn', 'drop', 'ht', 'hw', 'mouth', 'pull', 'glow', 'yaw']) {
      if (a[k] == null && b[k] == null) continue;
      const v = mixField(Q, a, b, t, k);
      if (v !== undefined) Q[k] = v;
    }
  };
  if (P.act && ACTS[P.act.k]) apply(ACTS[P.act.k], (P.act.f + 0.5) / 12);
  else if (P.idle && IDLES[P.idle.k]) apply(IDLES[P.idle.k], (P.idle.f + 0.5) / 12);
  if (P.sl) { Q.lA = [1.4, -0.12]; Q.lB = [0.35, -2.15]; Q.tl = -0.6; Q.tw = 0; Q.aA = [0.5, 1.0, 0.25]; Q.aB = [0.3, 1.1, 0.35]; Q.drop = 10; }
  else if (P.cr) {
    const ph = P.walk >= 0 ? P.walk / 12 * Math.PI * 2 : 0, s = P.walk >= 0 ? 0.3 : 0;
    Q.lA = [1.05 + Math.sin(ph) * s, -1.95 - Math.max(0, Math.sin(ph + 1.2)) * 0.35]; Q.lB = [0.7 + Math.sin(ph + Math.PI) * s, -1.55 - Math.max(0, Math.sin(ph + Math.PI + 1.2)) * 0.35];
    Q.tl += 0.42; Q.drop = 6; if (!P.act) { Q.aA[0] += 0.25; Q.aB[0] += 0.25; }
  }
  if (P.hs && !P.sl) {
    const br = P.br != null ? [0, 0.6, 1, 0.6][P.br] : 0;
    if (P.hs === 1) {
      // exausto: curvado, cabeça baixa, respiração pesada; andando, braços caídos arrastando a arma e passos arrastados
      Q.tl += 0.32 + br * 0.12; Q.ht = (Q.ht || 0) + 0.2 + br * 0.06;
      // braços pendurados na vertical (compensa a curvatura do tronco) e a ponta da arma arrastando atrás
      if (!P.act) { const t = Q.tl; Q.aA = [-t * 0.9, 0.16, 0.08]; Q.aB = [-t * 0.85, 0.14, 0.12]; const arm = Q.aA[0] + Q.aA[2]; Q.wp = cls === 'knight' ? arm + 0.25 : cls === 'mage' ? arm + Math.PI + 0.35 : Q.wp; }
      if (P.walk >= 0 && !P.cr && P.run) {
        // corrida exausta: tronco despencado, cabeça pendendo, passos pesados e desiguais, braços soltos balançando
        const ph = P.walk / 12 * Math.PI * 2;
        Q.tl += 0.18 + Math.abs(Math.sin(ph)) * 0.1; Q.ht += 0.12 + Math.abs(Math.cos(ph)) * 0.1;
        Q.lA = [Q.lA[0] * 0.85, Q.lA[1] * 0.75 - 0.1]; Q.lB = [Q.lB[0] * 0.7, Q.lB[1] * 0.6 - 0.1];
        Q.sway = (Q.sway || 0) * 2.6; Q.tw *= 1.6;
        if (!P.act) { const t = Q.tl; Q.aA = [-t * 0.7 + Math.sin(ph) * 0.55, 0.22, 0.25]; Q.aB = [-t * 0.7 - Math.sin(ph) * 0.5, 0.2, 0.3]; const arm = Q.aA[0] + Q.aA[2]; Q.wp = cls === 'knight' ? arm + 0.35 : cls === 'mage' ? arm + Math.PI + 0.45 : Q.wp; }
      } else if (P.walk >= 0 && !P.cr) { Q.lA = [Q.lA[0] * 0.55, Q.lA[1] * 0.4 - 0.04]; Q.lB = [Q.lB[0] * 0.55, Q.lB[1] * 0.4 - 0.04]; Q.tw *= 0.4; }
    }
    else if (P.hs === 3) {
      // de joelhos: um joelho no chão, mão no peito, arrastando-se devagar
      const ph = P.walk >= 0 ? P.walk / 12 * Math.PI * 2 : 0, s = P.walk >= 0 ? 0.18 : 0;
      Q.lA = [1.5 + Math.sin(ph) * s, -1.55]; Q.lB = [0.05 + Math.sin(ph + Math.PI) * s, -1.62];
      Q.tl = 0.3 + br * 0.08; Q.tw = 0; Q.sway = 0; Q.drop = 10; Q.ht = (Q.ht || 0) + 0.15 + br * 0.04;
      if (!P.act) { Q.aB = [0.85, 0.3, 2.05]; Q.aA = [0.15, 0.25, 0.25]; Q.wp = cls === 'knight' ? -0.2 : Q.wp; }
    }
    else { Q.tl += 0.36 + br * 0.07; if (!P.act) Q.aB = [0.85, 0.3, 2.05]; if (P.walk >= 0 && !P.cr) Q.lB = [Q.lB[0] * 0.45, -0.1]; Q.ht = (Q.ht || 0) + br * 0.04; }
  }
  if (P.down) { Q.aA = [0.5, 0.75, 0.6]; Q.aB = [0.25, 0.85, 0.35]; Q.lA = [0.35, -0.6]; Q.lB = [0.05, -0.12]; Q.tl = 0; Q.tw = 0.18; Q.ht = -0.25; Q.sway = 0; }
  // perna ferida: manca (a perna machucada quase não dobra, passo curto, tronco pende); braço da arma ferido pende
  if (P.limp && !P.sl && !P.sit) {
    const k = [0, 0.35, 0.7, 1][P.limp];
    if (P.walk >= 0) { Q.lB = [Q.lB[0] * (1 - k * 0.6), Q.lB[1] * (1 - k * 0.8)]; Q.sway = (Q.sway || 0) + Math.sin(P.walk / 12 * Math.PI * 2) * 0.08 * k; Q.tw += 0.12 * k; }
    Q.tl += 0.08 * k; if (P.limp >= 3 && !P.act) Q.aB = [0.35, 0.4, 0.6];
  }
  if (P.armw && !P.act) { Q.aA = [Q.tl * -0.5, 0.18, 0.12]; Q.wp = cls === 'knight' ? Q.aA[0] + Q.aA[2] + 0.2 : Q.wp; }
  if (P.sit === 'g') { Q.lA = [2.45, -2.35]; Q.lB = [2.2, -2.0]; Q.drop = 12; Q.aA = [1.15, 0.35, 1.35]; Q.aB = [1.05, 0.4, 1.25]; Q.tl = -0.22; Q.ht = 0.12; }
  else if (P.sit) { Q.lA = [1.5, -1.55]; Q.lB = [1.45, -1.5]; Q.drop = 12; Q.aA = [0.45, 0.25, 0.7]; Q.aB = [0.45, 0.25, 0.7]; Q.tl = -0.02; }
  if (P.carry) { Q.aA = [2.75, 0.25, 0.4]; Q.aB = [2.75, 0.25, 0.4]; Q.wp = 0.4; }
  if (Q.kn) { Q.lA = [Q.lA[0] - Q.kn * 0.5, Q.lA[1] + Q.kn]; Q.lB = [Q.lB[0] - Q.kn * 0.5, Q.lB[1] + Q.kn]; }
  return Q;
}

// ---------- montagem do esqueleto ----------
function skeleton(Q, view) {
  const ct = Math.cos(Q.tw), st = Math.sin(Q.tw), cl = Math.cos(Q.tl), sl = Math.sin(Q.tl);
  // tronco: gira (tw) e inclina (tl) em volta da pelve
  const up = p => { let f = p[0] * ct - p[1] * st, s = p[0] * st + p[1] * ct, v = p[2]; const f2 = f * cl - v * sl, v2 = f * sl + v * cl; return [f2, s, v2]; };
  const upDir = d => up(d);
  const sh = side => up([0, side * BODY.shoulder, BODY.neck + 2]);
  const arm = (a, side) => {
    const s0 = sh(side), d1 = upDir(dir3(a[0], a[1], side)), el = add3(s0, mul3(d1, BODY.upper));
    const d2 = upDir(dir3(a[0] + a[2], a[1], side)), hand = add3(el, mul3(d2, BODY.fore));
    return { s: s0, e: el, h: hand, d: d2 };
  };
  const leg = (l, side) => {
    const h0 = [0, side * BODY.hip, 0], d1 = dir3(l[0], 0, side), kn = add3(h0, mul3(d1, BODY.thigh));
    const d2 = dir3(l[0] + l[1], 0, side), ft = add3(kn, mul3(d2, BODY.shin));
    return { h: h0, k: kn, f: ft };
  };
  const A = arm(Q.aA, 1), Bm = arm(Q.aB, -1), LA = leg(Q.lA, 1), LB = leg(Q.lB, -1);
  const neck = up([0, 0, BODY.neck]), head = up([0, 0, BODY.head]), pelvis = [0, 0, 0];
  const fwd = up([1, 0, 0]);
  const wdir = upDir([Math.sin(Q.wp), 0, Math.cos(Q.wp)]);
  // apoio no chão: o pé mais baixo encosta no solo
  const footV = Math.max(LA.f[2], LB.f[2]);
  const oy = HAY - 2 - footV + Q.drop * 0;
  const P2 = p => { const q = proj(p, view); return [HAX + q[0], oy + q[1], q[2]]; };
  return { A, B: Bm, LA, LB, neck, head, pelvis, fwd, wdir, P2, oy, up };
}

// ---------- desenho ----------
function drawHeroPC(pc, L, P, cls) {
  const view = P.view, Q = buildPose(cls, P), K = skeleton(Q, view), P2 = K.P2;
  const parts = [];
  const add = (d, fn) => parts.push({ d, fn });
  const capP = (a, b, ra, rb, T) => { const p1 = P2(a), p2 = P2(b); pc.cap(p1[0], p1[1], p2[0], p2[1], ra, rb, T); };
  const dOf = (...pts) => pts.reduce((s, p) => s + P2(p)[2], 0) / pts.length;
  const robe = L.armor === 'robe';
  const sleeve = L.armor === 'vest' ? tone('#cfc6b4') : L.body;
  const glove = L.armor === 'plate' ? L.body : L.armor === 'leather' ? L.body2 : L.skin;

  // capa
  if (L.cape) {
    const sway = P.walk >= 0 ? 4 : 1.5, sA = K.A.s, sB = K.B.s, back = mul3(K.fwd, -1);
    const bA = add3(add3(sA, mul3(back, 3 + sway)), [0, 0.8, 27]), bB = add3(add3(sB, mul3(back, 3 + sway)), [0, -0.8, 27]);
    add(dOf(sA, sB) - 4.5 * (view === 'N' ? -1 : 1) * 0 + (view === 'N' ? 3 : -3), () => {
      const a = P2(sA), b = P2(sB), c = P2(bB), d = P2(bA);
      const T = L.capeTone;
      pc.poly([a[0], a[1] - 1, b[0], b[1] - 1, c[0], c[1], d[0], d[1]], 0, (x, y) => lit(T, ((x * 3 + y) % 11 < 2 ? -0.5 : 0.05) - (y - a[1]) / 60, x, y));
    });
  }
  // aljava
  if (L.quiver) {
    const q0 = K.up([-4, -3, BODY.neck + 1]), q1 = K.up([-4, 3, -6]);
    add(dOf(q0, q1) - 2, () => {
      capP(q0, q1, 2.6, 2.4, tone('#5a3a22'));
      const t = P2(q0);
      for (let k = 0; k < 4; k++) { pc.P(Math.round(t[0] - 2 + k * 1.5), Math.round(t[1] - 3), px('#e8e2d0')); pc.P(Math.round(t[0] - 2 + k * 1.5), Math.round(t[1] - 4), px('#a83226')); }
    });
  }
  // pernas
  for (const [Lg, far] of [[K.LA, 0], [K.LB, 1]]) {
    add(dOf(Lg.h, Lg.k, Lg.f), () => {
      const pants = L.legs, boots = L.boots;
      capP(Lg.h, Lg.k, 3.2, 2.7, pants);
      const mid = add3(Lg.k, mul3(add3(Lg.f, mul3(Lg.k, -1)), 0.35));
      capP(Lg.k, mid, 2.6, 2.4, pants);
      capP(mid, Lg.f, 2.6, 2.3, boots);
      const toe = add3(Lg.f, mul3(K.fwd, 3.5));
      capP(Lg.f, add3(toe, [0, 0, 0.5]), 2.2, 1.8, boots);
      if (L.armor === 'plate') { const kp = P2(Lg.k); pc.e(kp[0], kp[1], 2.4, 2, 0, (x, y, nx, ny) => lit(L.body, -nx * 0.5 - ny * 0.6 + 0.3, x, y)); }
    });
  }
  // tronco
  add(0, () => {
    const pv = P2(K.pelvis), nk = P2(K.neck);
    const wS = view === 'E' ? 6.5 : 9.5, wC = view === 'E' ? 6.8 : 8.6, wW = view === 'E' ? 5.4 : 6.6, wH = view === 'E' ? 5.6 : 7.2;
    const ax = nk[0] - pv[0], ay = nk[1] - pv[1], al = Math.hypot(ax, ay) || 1, nx = -ay / al, ny = ax / al;
    const lv = [[0, wH], [0.35, wW], [0.72, wC], [1, wS]];
    const ptsR = [], ptsL = [];
    for (const [t, w] of lv) { const cx = pv[0] + ax * t, cy = pv[1] + ay * t; ptsR.push(cx + nx * w, cy + ny * w); ptsL.unshift(cx - nx * w, cy - ny * w); }
    const wAt = t => t < 0.35 ? lerp(wH, wW, t / 0.35) : t < 0.72 ? lerp(wW, wC, (t - 0.35) / 0.37) : lerp(wC, wS, (t - 0.72) / 0.28);
    const T = L.body;
    pc.poly([...ptsR, ...ptsL.slice(0)].map(v => v), 0, (x, y) => {
      const rx = x + 0.5 - pv[0], ry = y + 0.5 - pv[1], t = clamp((rx * ax + ry * ay) / (al * al), 0, 1);
      const side = (rx * nx + ry * ny) / wAt(t);
      let l = -side * 0.75 * (view === 'N' ? -1 : 1) + 0.15 - side * side * 0.25 + (t - 0.5) * 0.25;
      if (L.pattern === 'scales' && (Math.floor(x / 2) + Math.floor(y / 2)) % 2 === 0) l -= 0.25;
      if (L.pattern === 'stars' && hash2(x, y, 7) < 0.04) return L.trim.lll;
      if (L.pattern === 'leaves' && hash2(x >> 1, y >> 1, 9) < 0.12) return L.body2.l;
      return lit(T, l, x, y);
    });
    // detalhes do peito e cinto
    const at = (t, s) => [pv[0] + ax * t + nx * s, pv[1] + ay * t + ny * s];
    const beltY = 0.3;
    for (let s = -wW; s <= wW; s += 0.5) { const p = at(beltY, s); pc.P(Math.round(p[0]), Math.round(p[1]), L.body2.d); pc.P(Math.round(p[0]), Math.round(p[1]) + 1, L.body2.b); }
    { const p = at(beltY, view === 'E' ? 2 : 0); pc.e(p[0], p[1] + 0.5, 1.6, 1.4, L.trim.l); }
    if (view === 'S' && L.armor === 'plate') {
      // tabardo com brasão
      const top = at(0.85, 0), bot = at(-0.25, 0);
      pc.poly([top[0] - 3.5, top[1], top[0] + 3.5, top[1], bot[0] + 3.8, bot[1], bot[0], bot[1] + 3, bot[0] - 3.8, bot[1]], 0, (x, y) => lit(L.accent, (x - top[0]) / -6 + 0.1, x, y));
      const em = at(0.6, 0); pc.poly([em[0], em[1] - 3, em[0] + 2.5, em[1], em[0], em[1] + 3, em[0] - 2.5, em[1]], 0, (x, y) => lit(L.trim, 0.4 - (y - em[1]) / 6, x, y));
    }
    if (view === 'E' && L.armor === 'plate') { const top = at(0.8, 3), bot = at(-0.25, 3.5); pc.poly([top[0] - 1.5, top[1], top[0] + 2.5, top[1], bot[0] + 2.5, bot[1], bot[0] - 1.5, bot[1]], 0, (x, y) => lit(L.accent, -0.1, x, y)); }
    if (view === 'S' && L.armor === 'leather') for (let k = 0; k < 4; k++) { const p = at(0.45 + k * 0.1, (k % 2 ? 1 : -1)); pc.P(Math.round(p[0]), Math.round(p[1]), L.body2.dd); }
    if (L.armor === 'vest' && view !== 'N') { const a = at(0.85, view === 'E' ? 2 : -3), b = at(0.0, view === 'E' ? 3 : -3.5); pc.poly([a[0], a[1], a[0] + (view === 'E' ? 4 : 6), a[1], b[0] + (view === 'E' ? 4.5 : 7), b[1], b[0], b[1]], 0, (x, y) => lit(L.body2, 0.1, x, y)); }
    if (robe) {
      const sw = P.walk >= 0 ? Math.sin(P.walk / 8 * Math.PI * 2) * 1.5 : 0;
      const wl = at(0.32, -wW - 0.5), wr = at(0.32, wW + 0.5);
      const hemY = Math.max(P2(K.LA.f)[1], P2(K.LB.f)[1]) - 2;
      const spread = view === 'E' ? 4 : 5.5;
      pc.poly([wl[0], wl[1], wr[0], wr[1], wr[0] + spread + sw, hemY, wl[0] - spread + sw, hemY], 0, (x, y) => {
        const t = (x - (wl[0] - spread)) / (wr[0] - wl[0] + spread * 2);
        if (y >= hemY - 2) return lit(L.trim, 0.2, x, y);
        if (view === 'S' && Math.abs(x + 0.5 - (wl[0] + wr[0]) / 2 - sw * (y - wl[1]) / (hemY - wl[1])) < 1) return L.trim.b;
        if (L.pattern === 'stars' && hash2(x, y, 7) < 0.04) return L.trim.lll;
        return lit(L.body, (0.5 - t) * 1.2 * (view === 'N' ? -1 : 1) + ((x + y * 2) % 13 < 2 ? -0.4 : 0), x, y);
      });
    }
  });
  // braços
  const armPart = (Ar, isA) => () => {
    capP(Ar.s, Ar.e, robe ? 3.4 : 2.9, robe ? 3.2 : 2.4, sleeve);
    capP(Ar.e, Ar.h, robe ? 3.3 : 2.3, robe ? 2.8 : 2.0, robe ? sleeve : glove);
    if (robe) { const cuff = P2(add3(Ar.e, mul3(add3(Ar.h, mul3(Ar.e, -1)), 0.8))); pc.e(cuff[0], cuff[1], 2.6, 2.2, L.trim.b); }
    const hp = P2(Ar.h); pc.e(hp[0], hp[1], 2.1, 2.1, 0, (x, y, nx, ny) => lit(L.armor === 'plate' ? L.body : L.skin, -nx * 0.6 - ny * 0.6, x, y));
  };
  add(dOf(K.A.s, K.A.e, K.A.h) + 0.2, armPart(K.A, true));
  add(dOf(K.B.s, K.B.e, K.B.h), armPart(K.B, false));
  // ombreiras
  if (L.pauldron) for (const Ar of [K.A, K.B]) add(P2(Ar.s)[2] + 0.5, () => {
    const p = P2(Ar.s);
    pc.e(p[0], p[1] - 0.5, 3.6, 2.8, 0, (x, y, nx, ny) => lit(L.body, -nx * 0.6 - ny * 0.8 + 0.15, x, y));
    pc.l(p[0] - 3, p[1] + 1.8, p[0] + 3, p[1] + 1.8, L.trim.b, 1);
    if (L.pauldron === 'spike') { pc.l(p[0], p[1] - 2, p[0] - 1, p[1] - 6, L.body.ll, 1); pc.l(p[0] + 2, p[1] - 2, p[0] + 3, p[1] - 5, L.body.l, 1); }
    if (L.pauldron === 'wing') { pc.l(p[0], p[1] - 2, p[0] + (p[0] < HAX ? -4 : 4), p[1] - 7, L.trim.ll, 1); pc.l(p[0] + (p[0] < HAX ? -1 : 1), p[1] - 1, p[0] + (p[0] < HAX ? -5 : 5), p[1] - 4, L.trim.l, 1); }
  });
  // cabeça
  add(P2(K.head)[2] + 0.3, () => drawHead2(pc, L, P2(K.head), P2(K.neck), view, Q));
  // arma
  if (L.weapon) add(P2(K.A.h)[2] + (view === 'N' ? -0.6 : 0.6), () => drawWeapon2(pc, L, K, Q, view));
  // escudo
  if (L.shield) add(P2(K.B.h)[2] + 0.8, () => drawShield2(pc, L, K, view));

  parts.sort((a, b) => a.d - b.d);
  for (const p of parts) p.fn();
}

function drawHead2(pc, L, h, nk, view, Q) {
  const E = view === 'E', N = view === 'N', sk = L.skin;
  const hx = h[0] + (E ? 0.5 : 0) + Q.hw * (view === 'S' ? 0 : 1.2), hy = h[1];
  // pescoço
  pc.cap(nk[0], nk[1] - 1, hx, hy + 4, 2.2, 2.0, sk);
  const helm = L.head === 'greathelm' || L.head === 'horned' || L.head === 'winged';
  const hood = L.head === 'hood' || L.head === 'furhood' || L.head === 'astralhood' || L.head === 'antlerhood';
  const fx = E ? 1 : 0; // deslocamento do rosto no perfil
  const look = view === 'S' ? Math.round(Q.hw * 1.5) : 0;
  if (!helm) {
    pc.e(hx, hy, 5.6, 6.4, 0, (x, y, nx, ny) => lit(sk, -nx * 0.55 - ny * 0.45 + 0.2 - (E && nx < -0.3 ? 0.3 : 0), x, y));
    if (!N) {
      const ey = Math.round(hy + 0.5), mouthY = Math.round(hy + 3.5 - Q.ht * 2);
      if (E) {
        pc.P(Math.round(hx + 3), ey, L.eyes); pc.P(Math.round(hx + 3), ey - 1, sk.dd); pc.P(Math.round(hx + 2), ey - 2, L.hair ? L.hair.d : sk.dd);
        pc.P(Math.round(hx + 6), ey + 1, sk.b); pc.P(Math.round(hx + 6), ey + 2, sk.d); pc.P(Math.round(hx + 5), ey + 2, sk.dd);
        pc.P(Math.round(hx + 4), mouthY, Q.mouth > 0.5 ? px('#4a1a14') : sk.dd);
        pc.e(hx - 1.5, hy + 0.5, 1.2, 1.6, sk.d);
      } else {
        for (const ex of [-2.5, 2.5]) { const X = Math.round(hx + ex - 0.5 + look); pc.P(X, ey, px('#e8e0d0')); pc.P(X + (ex < 0 ? 1 : 0), ey, L.eyes); pc.P(X, ey - 2, L.hair ? L.hair.d : sk.dd); pc.P(X + 1, ey - 2, L.hair ? L.hair.d : sk.dd); }
        pc.P(Math.round(hx), ey + 2, sk.d); pc.P(Math.round(hx - 1), ey + 2, sk.dd);
        if (Q.mouth > 0.5) { pc.P(Math.round(hx - 1), mouthY, px('#4a1a14')); pc.P(Math.round(hx), mouthY, px('#4a1a14')); pc.P(Math.round(hx - 1), mouthY + 1, px('#4a1a14')); pc.P(Math.round(hx), mouthY + 1, px('#4a1a14')); }
        else { pc.P(Math.round(hx - 1), mouthY, sk.dd); pc.P(Math.round(hx), mouthY, sk.dd); }
        if (L.scar) { pc.P(Math.round(hx + 2), ey - 1, px('#9a5444')); pc.P(Math.round(hx + 3), ey + 1, px('#9a5444')); pc.P(Math.round(hx + 3), ey, px('#9a5444')); }
      }
    }
    if (L.hair && !hood) {
      const hr = L.hair;
      pc.e(hx, hy - 1.2, 5.9, 5.8, 0, (x, y, nx, ny) => {
        const keep = N ? true : E ? (nx < 0.15 || ny < -0.5) : (ny < -0.42 || (Math.abs(nx) > 0.82 && ny < 0.35));
        return keep ? lit(hr, -nx * 0.4 - ny * 0.7 + ((x + y) % 3 === 0 ? -0.3 : 0), x, y) : 0;
      });
      if (L.hairStyle === 'long') { const side = E ? [-3.5] : [-5, 5]; for (const sx of side) pc.cap(hx + sx, hy, hx + sx * 1.1, hy + 10, 2, 1.6, hr); if (N) pc.cap(hx, hy, hx, hy + 10, 4.5, 3.5, hr); }
    }
    if (L.beard && !N) {
      if (E) pc.e(hx + 2.5, hy + 4.5, 3.5, 3.2, 0, (x, y, nx, ny) => lit(L.beard, -ny * 0.4 + ((x + y) % 2 ? -0.2 : 0.1), x, y));
      else { pc.e(hx, hy + 4.8, 4.8, 3.8, 0, (x, y, nx, ny) => ny < -0.3 && Math.abs(nx) < 0.35 ? 0 : lit(L.beard, -nx * 0.3 - ny * 0.3 + ((x + y) % 2 ? -0.15 : 0.1), x, y)); if (Q.mouth > 0.5) pc.r(hx - 1, hy + 3.5, 2, 2, px('#4a1a14')); }
    }
  }
  const H = L.headTone;
  switch (L.head) {
    case 'greathelm': case 'horned': case 'winged': {
      pc.e(hx, hy, 6, 6.8, 0, (x, y, nx, ny) => lit(H, -nx * 0.65 - ny * 0.5 + 0.2 + (Math.abs(nx - 0.05) < 0.08 && !E ? 0.4 : 0), x, y));
      if (!N) {
        if (E) { pc.r(hx + 1, hy - 0.5, 5, 1, px('#100c08')); for (let k = 0; k < 3; k++) pc.P(Math.round(hx + 3 + (k % 2)), Math.round(hy + 2 + k), px('#100c08')); }
        else { pc.r(hx - 4.5, hy - 0.5, 9, 1, px('#100c08')); pc.r(hx - 0.5, hy + 1, 1, 4, H.d); for (const ox of [-2.5, 2.5]) { pc.P(Math.round(hx + ox), Math.round(hy + 3), px('#100c08')); pc.P(Math.round(hx + ox), Math.round(hy + 4.5), px('#100c08')); } }
      }
      pc.r(hx - 6, hy + 5.2, 12, 1.2, H.dd);
      if (L.head === 'greathelm') {
        const pl = L.plume;
        for (let k = 0; k < 9; k++) { const t = k / 8, x = hx - (E ? 1 + t * 9 : t * 2 - 1), y = hy - 6.5 - Math.sin(t * Math.PI) * 4 + t * 3; pc.e(x, y, 1.8, 1.4, 0, (xx, yy, nx, ny) => lit(pl, -ny * 0.6 + 0.1, xx, yy)); }
      } else if (L.head === 'horned') {
        const hn = tone('#d6c9aa');
        const horn = (sx, d) => { for (let k = 0; k < 8; k++) { const t = k / 7; pc.e(hx + sx + d * t * 4, hy - 3 - t * 6 + t * t * 2, 1.6 - t * 0.9, 1.6 - t * 0.9, 0, (x, y, nx, ny) => lit(hn, -nx * 0.5 - ny * 0.4 + 0.2, x, y)); } };
        if (E) horn(-2, -1); else { horn(-5, -1); horn(5, 1); }
        pc.P(Math.round(hx), Math.round(hy - 5), px('#e04a2a'));
      } else {
        const wg = tone('#f0ebde');
        const wing = (sx, d) => { for (let k = 0; k < 4; k++) pc.l(hx + sx, hy - 1 - k, hx + sx + d * (6 - k), hy - 7 - k * 1.5, k % 2 ? wg.l : wg.b, 1); };
        if (E) wing(-3, -1); else { wing(-5, -1); wing(5, 1); }
      }
      break;
    }
    case 'hood': case 'furhood': case 'astralhood': case 'antlerhood': {
      pc.e(hx, hy - 0.5, 6.6, 7.2, 0, (x, y, nx, ny) => {
        const face = !N && (E ? (nx > 0.2 && ny > -0.35 && ny < 0.8) : (Math.abs(nx) < 0.58 && ny > -0.4 && ny < 0.85));
        if (face) return 0;
        if (L.head === 'astralhood' && hash2(x, y, 3) < 0.06) return L.trim.lll;
        return lit(H, -nx * 0.6 - ny * 0.5 + 0.1 - (face ? 0 : 0), x, y);
      });
      if (!N) { const T2 = H; if (E) pc.cap(hx - 3, hy + 2, hx - 4, hy + 10, 2.5, 2, T2); else { pc.cap(hx - 5, hy + 3, hx - 6, hy + 10, 2, 2.2, T2); pc.cap(hx + 5, hy + 3, hx + 6, hy + 10, 2, 2.2, T2); } }
      if (L.head === 'furhood') {
        const fr = tone('#ecebe6');
        if (!N) pc.e(hx + (E ? 2 : 0), hy - 0.5, E ? 3 : 4.6, 5.8, 0, (x, y, nx, ny) => nx * nx + ny * ny > 0.72 ? lit(fr, -ny * 0.4 + 0.2, x, y) : 0);
        pc.poly([hx - 5, hy - 5, hx - 3.5, hy - 10, hx - 1.5, hy - 6], fr.b); pc.poly([hx + 1.5, hy - 6, hx + 3.5, hy - 10, hx + 5, hy - 5], fr.d);
      }
      if (L.head === 'astralhood' && !N) { pc.l(hx - (E ? -1 : 4), hy - 3.5, hx + 4, hy - 3.5, L.trim.l, 1); pc.e(hx + (E ? 3 : 0), hy - 4, 1, 1, px('#c8e8ff')); }
      if (L.head === 'antlerhood') {
        const an = tone('#c8b48c');
        const ant = (sx, d) => { pc.l(hx + sx, hy - 5, hx + sx + d * 4, hy - 13, an.b, 1); pc.l(hx + sx + d * 2.5, hy - 10, hx + sx + d * 7, hy - 12, an.l, 1); pc.l(hx + sx + d * 1.2, hy - 7, hx + sx - d * 1, hy - 11, an.d, 1); pc.l(hx + sx + d * 3.5, hy - 12, hx + sx + d * 3, hy - 16, an.l, 1); };
        if (E) ant(-1, -1); else { ant(-3, -1); ant(3, 1); }
      }
      break;
    }
    case 'circlet':
      if (!N) pc.l(hx - (E ? -1 : 5), hy - 3, hx + 5, hy - 3, L.trim.b, 1);
      if (!N) pc.P(Math.round(hx + (E ? 3 : 0)), Math.round(hy - 3), px('#6fe0a8'));
      if (E) { pc.P(Math.round(hx - 4), Math.round(hy - 1), sk.b); pc.P(Math.round(hx - 5), Math.round(hy - 2), sk.l); }
      else { pc.P(Math.round(hx - 6), Math.round(hy - 1), sk.b); pc.P(Math.round(hx + 5), Math.round(hy - 1), sk.d); }
      break;
    case 'wizard': {
      pc.e(hx + fx, hy - 4.5, 9, 2.2, 0, (x, y, nx, ny) => lit(H, -ny * 0.3 - 0.25, x, y));
      const tip = [hx - (E ? 7 : 4), hy - 22];
      pc.poly([hx - 5.5, hy - 5, hx + 5.5, hy - 5, hx + 2, hy - 13, tip[0], tip[1], hx - 2.5, hy - 12], 0, (x, y, lx, ly) => lit(H, (hx - lx) / 6 + 0.05 - (y - hy) / 60, x, y));
      pc.l(hx - 5, hy - 7, hx + 5, hy - 7, L.trim.b, 2);
      if (!N) pc.e(hx + (E ? 2 : 0), hy - 10, 1.2, 1.2, L.trim.ll);
      break;
    }
    case 'cap':
      pc.e(hx + fx, hy - 5, 7, 1.8, H.d); pc.e(hx, hy - 7, 5, 3, 0, (x, y, nx, ny) => lit(H, -nx * 0.5 - ny * 0.5, x, y));
      pc.l(hx - 3, hy - 9, hx - 8, hy - 15, px('#a8382a'), 1); pc.l(hx - 4, hy - 9, hx - 9, hy - 14, px('#c8584a'), 1);
      break;
    case 'helm':
      pc.e(hx, hy - 3, 6.2, 4.6, 0, (x, y, nx, ny) => ny > 0.55 ? 0 : lit(H, -nx * 0.6 - ny * 0.4 + 0.2, x, y));
      pc.e(hx, hy - 0.5, 7.5, 1.5, H.d);
      if (!N) pc.r(hx - 0.5 + (E ? 3 : 0), hy - 3, 1, 5, H.dd);
      break;
  }
}

function drawWeapon2(pc, L, K, Q, view) {
  const P2 = K.P2, hand = K.A.h, w = K.wdir, kind = L.weapon;
  const pt = d => P2(add3(hand, mul3(w, d)));
  const glowOn = Q.glow > 0.5;
  switch (kind) {
    case 'sword': case 'darkblade': case 'goldsword': {
      const len = kind === 'darkblade' ? 25 : 22;
      const blade = kind === 'darkblade' ? tone('#3a2c2e') : tone('#c8ced6');
      const guard = kind === 'goldsword' ? L.trim : kind === 'darkblade' ? tone('#5a1818') : tone('#8a6a34');
      const g0 = pt(-4), g1 = pt(0), b0 = pt(1.5), b1 = pt(len);
      pc.cap(g0[0], g0[1], g1[0], g1[1], 1.1, 1.1, tone('#4a3020'));
      pc.e(g0[0], g0[1], 1.5, 1.5, guard.l);
      pc.cap(b0[0], b0[1], b1[0], b1[1], 1.7, 0.5, blade);
      pc.l(b0[0], b0[1], b1[0], b1[1], glowOn ? px('#ffd07a') : kind === 'darkblade' ? px('#e0482a') : blade.lll, 1);
      // guarda perpendicular
      const sx = b1[1] - b0[1], sy = -(b1[0] - b0[0]), sl = Math.hypot(sx, sy) || 1;
      pc.l(g1[0] - sx / sl * 4, g1[1] - sy / sl * 4, g1[0] + sx / sl * 4, g1[1] + sy / sl * 4, guard.b, 2);
      break;
    }
    case 'staff': case 'starstaff': case 'druidstaff': {
      const pole = kind === 'starstaff' ? tone('#aeb6c2') : kind === 'druidstaff' ? tone('#5a4028') : tone('#6b4a2b');
      const a = pt(-14), b = pt(24);
      if (kind === 'druidstaff') { for (let k = -14; k < 24; k += 4) { const p1 = pt(k), p2 = pt(k + 4); pc.cap(p1[0] + (k % 8 ? 0.6 : -0.6), p1[1], p2[0], p2[1], 1.2, 1.1, pole); } }
      else pc.cap(a[0], a[1], b[0], b[1], 1.1, 1.0, pole);
      const o = pt(27), oc = tone(L.orb);
      if (kind === 'starstaff') { pc.poly([o[0], o[1] - 4.5, o[0] + 2.8, o[1], o[0], o[1] + 4.5, o[0] - 2.8, o[1]], 0, (x, y, lx, ly) => lit(oc, (o[0] - lx) / 3 + 0.4, x, y)); }
      else {
        pc.e(o[0], o[1], 3.2, 3.2, 0, (x, y, nx, ny) => lit(oc, -nx * 0.7 - ny * 0.7 + 0.5, x, y));
        if (kind === 'staff') { pc.l(o[0] - 3, o[1] + 3, o[0] - 1, o[1] + 1, L.trim.b, 1); pc.l(o[0] + 3, o[1] + 3, o[0] + 1, o[1] + 1, L.trim.b, 1); }
      }
      if (kind === 'druidstaff') for (let k = 0; k < 5; k++) pc.e(o[0] + Math.cos(k * 1.3) * 4, o[1] + Math.sin(k * 1.3) * 3, 1.4, 1, px(k % 2 ? '#5aa23a' : '#7cc24a'));
      if (glowOn) for (let k = 0; k < 6; k++) { const an = k / 6 * Math.PI * 2; pc.P(Math.round(o[0] + Math.cos(an) * 5.5), Math.round(o[1] + Math.sin(an) * 5.5), oc.lll); }
      break;
    }
    case 'bow': case 'frostbow': case 'elfbow': {
      const wood = kind === 'frostbow' ? tone('#c4d8e8') : kind === 'elfbow' ? L.trim : tone('#6e4320');
      // eixo do arco: perpendicular à direção de tiro, curvado para a frente
      const shoot = K.up([Math.sin(Q.aA[0]), 0, Math.cos(Q.aA[0])]);
      const axis = K.up([Math.cos(Q.aA[0]), 0, -Math.sin(Q.aA[0])]);
      const tipA = add3(hand, mul3(axis, 13)), tipB = add3(hand, mul3(axis, -13));
      let prev = null;
      for (let t = -1; t <= 1.001; t += 0.125) {
        const p = add3(add3(hand, mul3(axis, t * 13)), mul3(shoot, (1 - t * t) * 3.5 - 1));
        const q = P2(p);
        if (prev) pc.cap(prev[0], prev[1], q[0], q[1], 1.1, 1.1, wood);
        prev = q;
      }
      const pullP = Q.pull > 0.05 ? add3(hand, mul3(shoot, -1 - Q.pull * 11)) : add3(hand, mul3(shoot, -1));
      const a = P2(tipA), b = P2(tipB), c = P2(pullP);
      pc.l(a[0], a[1], c[0], c[1], px('#e6e0cc'), 0.5); pc.l(c[0], c[1], b[0], b[1], px('#e6e0cc'), 0.5);
      if (Q.pull > 0.05) { const tip = P2(add3(hand, mul3(shoot, 5))); pc.l(c[0], c[1], tip[0], tip[1], px('#d4c8a6'), 1); pc.P(Math.round(tip[0]), Math.round(tip[1]), Q.glow > 0.5 ? px('#d8ffd0') : px('#c0c6ce')); pc.P(Math.round(c[0]), Math.round(c[1]), px('#a83226')); }
      if (kind === 'elfbow') { pc.P(Math.round(a[0]), Math.round(a[1]) - 1, px('#6fe0a8')); pc.P(Math.round(b[0]), Math.round(b[1]) + 1, px('#6fe0a8')); }
      break;
    }
    case 'hammer': { const a = pt(-4), b = pt(12); pc.cap(a[0], a[1], b[0], b[1], 1, 1, tone('#6b4a2b')); const h1 = pt(10), h2 = pt(15); pc.cap(h1[0] - 3, h1[1], h2[0] + 3, h2[1], 2.4, 2.4, tone('#5a5c62')); break; }
    case 'spear': { const a = pt(-16), b = pt(24); pc.cap(a[0], a[1], b[0], b[1], 1, 1, tone('#6b4a2b')); const t = pt(30); pc.cap(b[0], b[1], t[0], t[1], 1.8, 0.4, tone('#c8ced6')); break; }
    case 'book': { const h = P2(hand); pc.r(h[0] - 3, h[1] - 4, 6, 5, px('#5a1a1c')); pc.r(h[0] - 3, h[1] - 4, 1, 5, px('#c9a24a')); pc.r(h[0] - 2, h[1] - 4, 4, 1, px('#e8e0cc')); break; }
    case 'mug': { const h = P2(hand); pc.r(h[0] - 2, h[1] - 5, 4, 5, px('#8a5424')); pc.r(h[0] - 2, h[1] - 6, 4, 1.5, px('#f2ead8')); pc.P(Math.round(h[0] + 2), Math.round(h[1] - 3), px('#8a5424')); break; }
  }
}

function drawShield2(pc, L, K, view) {
  const k = L.shield, P2 = K.P2;
  const c3 = add3(K.B.h, mul3(K.fwd, 2));
  const c = P2(c3);
  const nScreen = proj(K.fwd, view);           // normal do escudo projetada
  const faceW = Math.max(1.6, 5.8 * Math.sqrt(Math.max(0, 1 - nScreen[0] * nScreen[0])));
  const rim = k === 'dragon' ? tone('#24120f') : L.trim, field = k === 'dragon' ? tone('#3a1a1c') : k === 'sun' ? tone('#ece6d4') : L.accent;
  const cx = c[0], cy = c[1] - 2;
  if (k === 'sun') {
    pc.e(cx, cy, faceW + 0.8, 7, 0, (x, y, nx, ny) => lit(rim, -nx * 0.5 - ny * 0.5 + 0.2, x, y));
    pc.e(cx, cy, faceW - 0.6, 5.8, 0, (x, y, nx, ny) => lit(field, -nx * 0.4 - ny * 0.4 + 0.2, x, y));
    if (faceW > 3) { pc.e(cx, cy, 2, 2, L.trim.ll); for (let a = 0; a < 8; a++) pc.l(cx + Math.cos(a * 0.785) * 2.5, cy + Math.sin(a * 0.785) * 2.5, cx + Math.cos(a * 0.785) * 4, cy + Math.sin(a * 0.785) * 4, L.trim.b, 1); }
  } else {
    const W = faceW;
    pc.poly([cx - W - 0.8, cy - 7, cx + W + 0.8, cy - 7, cx + W + 0.8, cy + 2, cx, cy + 10, cx - W - 0.8, cy + 2], 0, (x, y, lx, ly) => lit(rim, (cx - lx) / (W + 1) * 0.5 + 0.2 - (ly - cy) / 20, x, y));
    pc.poly([cx - W + 0.6, cy - 5.6, cx + W - 0.6, cy - 5.6, cx + W - 0.6, cy + 1.6, cx, cy + 8, cx - W + 0.6, cy + 1.6], 0, (x, y, lx, ly) => lit(field, (cx - lx) / W * 0.45 + 0.1 - (ly - cy) / 22, x, y));
    if (W > 3) {
      if (k === 'dragon') { pc.e(cx, cy, 2, 1.4, px('#e0482a')); pc.P(Math.round(cx), Math.round(cy), px('#2a0a08')); }
      else { pc.r(cx - 0.6, cy - 4.5, 1.2, 10, L.trim.l); pc.r(cx - 3.5, cy - 1.5, 7, 1.2, L.trim.l); }
    }
  }
}

function poseKey(P) {
  return P.view + (P.walk >= 0 ? P.walk : '-') + (P.act ? P.act.k + P.act.f : '') + (P.idle ? P.idle.k + P.idle.f : '') + (P.sit ? 's' : '') + (P.carry ? 'c' : '');
}
const _lookCache = new Map();
function lookFor(key, make) { let l = _lookCache.get(key); if (!l) { l = make(); _lookCache.set(key, l); } return l; }
function heroSprite(cls, skin, color, P) {
  const lk = cls + ':' + skin + ':' + color;
  const L = lookFor(lk, () => heroLook(cls, skin, color));
  return sprite('h|' + lk + '|' + poseKey(P), HW, HH, HAX, HAY, pc => drawHeroPC(pc, L, P, cls), { ok: 0.42 });
}
const NPC_CLS = { priest: 'mage', merchant: 'archer', innkeeper: 'archer', guard: 'knight', captain: 'knight', smith: 'knight' };
function npcSprite(kind, P) {
  const L = lookFor('npc:' + kind, NPC_LOOKS[kind]);
  return sprite('n|' + kind + '|' + poseKey(P), HW, HH, HAX, HAY, pc => drawHeroPC(pc, L, P, NPC_CLS[kind] || 'knight'), { ok: 0.42 });
}

// ---------- MONSTROS (vista lateral, olhando para a direita) ----------
const MON_SIZE = { rat: [36, 26], slime: [32, 28], wolf: [44, 34], spider: [44, 30], toad: [38, 30], goblin: [36, 44], skeleton: [36, 50], orc: [44, 54], troll: [64, 70] };
function monSprite(type, f, atk) {
  const [w, h] = MON_SIZE[type];
  return sprite(`m|${type}|${f}|${atk}`, w, h, w >> 1, h - 3, pc => drawMonsterPC(pc, type, f, atk, w, h), { k: ART });
}
function drawMonsterPC(pc, type, f, atk, w, h) {
  const ph = f / 4 * Math.PI * 2, s = Math.sin(ph), c = Math.cos(ph);
  const lg = atk >= 0 ? [0, 2, 4, 1][atk] : 0; // avanço do ataque
  const by = h - 3; // linha do chão
  switch (type) {
    case 'rat': {
      const fur = tone('#7d7066'), belly = tone('#b5a698'), pink = px('#d99a96');
      pc.l(6, by - 5, 2, by - 8 + Math.round(s), pink, 1); pc.l(2, by - 8 + Math.round(s), 3, by - 11, pink, 1);
      for (const [x, o] of [[11, s], [20, -s]]) pc.r(x + Math.round(o * 1.5), by - 3, 2, 3, fur.d);
      pc.e(16 + lg * 0.3, by - 6, 9, 5, 0, (x, y, nx, ny) => ny > 0.35 ? belly.b : ny < -0.5 ? fur.l : nx > 0.5 ? fur.d : fur.b);
      for (let i = 0; i < 5; i++) pc.p(10 + i * 3, by - 10, fur.d);
      const hx = 25 + lg;
      pc.e(hx, by - 7, 4.5, 3.5, 0, (x, y, nx, ny) => ny > 0.4 ? belly.b : fur.b);
      pc.p(hx + 4, by - 7, pink); pc.p(hx + 1, by - 8, px('#14100c'));
      pc.e(hx - 2, by - 11, 2, 2, fur.b); pc.p(hx - 2, by - 11, pink);
      pc.l(hx + 3, by - 6, hx + 6, by - 7, px('#cfc6bc'), 1);
      if (atk === 2) pc.p(hx + 3, by - 5, px('#f4f0e8'));
      break;
    }
    case 'slime': {
      const sq = Math.round(s * 1.5) + (atk >= 0 ? [0, -2, 2, 1][atk] : 0);
      const body = tone('#5f9e4a');
      pc.e(16, by - 8 + sq * 0.5, 12 + sq * 0.6, 9 - sq * 0.5, 0, (x, y, nx, ny) => {
        if (nx < -0.3 && ny < -0.3 && nx * nx + ny * ny < 0.5) return px('#cfeeb4', 0, 235);
        return ny > 0.5 ? px('#3a6e2e', 0, 235) : nx > 0.5 ? px('#4c8a3c', 0, 235) : px('#5f9e4a', 0, 230);
      });
      pc.e(17, by - 7, 4, 3, px('#3a6e2e', 0, 210));
      pc.p(18, by - 11 + sq * 0.5, px('#14200f')); pc.p(22, by - 11 + sq * 0.5, px('#14200f'));
      pc.p(9, by - 3, px('#cfeeb4', 0, 220));
      break;
    }
    case 'wolf': {
      const fur = tone('#6c6f76'), lt = tone('#a6a9ae');
      const legs = [[10, s], [14, -s], [26, -s], [30, s]];
      legs.forEach(([x, o], k) => { const t = k % 2 ? fur.d : fur.b; pc.l(x, by - 9, x + o * 2.5, by - 1, t, 2); pc.p(x + o * 2.5 + 1, by - 1, t); });
      pc.poly([8, by - 15, 2, by - 20 + Math.round(c), 1, by - 15, 6, by - 11], fur.b);
      pc.e(19 + lg * 0.4, by - 13, 12, 5.5, 0, (x, y, nx, ny) => ny < -0.45 ? lt.b : ny > 0.4 ? fur.d : fur.b);
      for (let i = 0; i < 6; i++) pc.p(10 + i * 3, by - 18 + (i % 2), lt.l);
      const hx = 31 + lg;
      pc.e(hx, by - 16, 5, 4.5, fur.b);
      pc.poly([hx + 2, by - 18, hx + 9, by - 16, hx + 9, by - 13, hx + 2, by - 13], lt.b);
      pc.p(hx + 9, by - 16, px('#14100c'));
      pc.poly([hx - 3, by - 19, hx - 1, by - 25, hx + 1, by - 19], fur.d); pc.poly([hx, by - 19, hx + 2, by - 24, hx + 3, by - 19], fur.b);
      pc.p(hx + 3, by - 17, px('#e0b040'));
      if (atk >= 1) { pc.r(hx + 3, by - 13, 6, 2, px('#5a1a1a')); pc.p(hx + 5, by - 13, px('#f4f0e8')); pc.p(hx + 7, by - 12, px('#f4f0e8')); }
      break;
    }
    case 'spider': {
      const shell = tone('#3a332e');
      for (let i = 0; i < 4; i++) {
        const o = Math.sin(ph + i * 1.4) * 2, bx = 18 + i * 3;
        pc.l(bx, by - 9, bx - 6 - i, by - 15 + o, shell.d, 1); pc.l(bx - 6 - i, by - 15 + o, bx - 10 - i, by, shell.d, 1);
        pc.l(bx, by - 9, bx + 5 + i, by - 15 - o, shell.b, 1); pc.l(bx + 5 + i, by - 15 - o, bx + 9 + i, by, shell.b, 1);
      }
      pc.e(14, by - 11, 9, 7, 0, (x, y, nx, ny) => ny < -0.5 ? shell.l : nx > 0.4 ? shell.d : shell.b);
      pc.poly([14, by - 15, 16, by - 11, 14, by - 7, 12, by - 11], px('#8a2a22'));
      pc.e(26 + lg, by - 9, 5, 4, shell.d);
      for (let i = 0; i < 4; i++) pc.p(27 + lg + (i % 2) * 2, by - 11 + (i >> 1) * 2, px('#d0402a'));
      pc.l(30 + lg, by - 7, 32 + lg + (atk >= 1 ? 1 : 0), by - 4, px('#d9cfb8'), 1);
      break;
    }
    case 'toad': {
      const sk = tone('#6e7a3a'), bel = tone('#cdb87a');
      const hop = atk >= 0 ? 0 : Math.max(0, s) * 1;
      pc.e(11, by - 2, 5, 2.5, sk.d); pc.e(25, by - 2, 5, 2.5, sk.d);
      pc.e(18, by - 8 - hop, 12, 8, 0, (x, y, nx, ny) => ny > 0.35 && nx > -0.2 ? bel.b : ny < -0.5 ? sk.l : sk.b);
      for (let i = 0; i < 7; i++) pc.p(9 + Math.floor(hash2(i, 1, 5) * 16), by - 14 + Math.floor(hash2(i, 2, 5) * 8) - hop, sk.dd);
      const sac = 2 + Math.round(Math.abs(s) * 2);
      pc.e(25, by - 4 - hop, 3 + sac * 0.4, 1.5 + sac * 0.5, bel.l);
      pc.e(21, by - 16 - hop, 3, 3, sk.b); pc.e(27, by - 15 - hop, 3, 3, sk.b);
      pc.p(22, by - 17 - hop, px('#e0b040')); pc.p(28, by - 16 - hop, px('#e0b040'));
      pc.l(22, by - 9 - hop, 30, by - 10 - hop, sk.dd, 1);
      if (atk >= 1) { const L2 = [0, 6, 12, 5][atk]; pc.l(30, by - 9, 30 + L2, by - 8, px('#c43a4a'), 2); }
      break;
    }
    default:
      drawBrutePC(pc, type, f, atk, w, h);
  }
}

// humanoides (goblin, esqueleto, orc, troll)
function drawBrutePC(pc, type, f, atk, w, h) {
  const k = { goblin: 0.82, skeleton: 1, orc: 1.12, troll: 1.55 }[type];
  const ph = f / 4 * Math.PI * 2, s = Math.sin(ph);
  const X = w / 2, by = h - 3;
  const S = v => v * k;
  const look = {
    goblin: { skin: tone('#6f8e3a'), top: tone('#6b4a2b'), pants: tone('#4a3a2a'), eye: px('#e8d040') },
    skeleton: { skin: tone('#e2dccb'), top: tone('#d4cdb8'), pants: tone('#c9c1aa'), eye: px('#e0402a') },
    orc: { skin: tone('#5e7f42'), top: tone('#4a3020'), pants: tone('#3d2b1a'), eye: px('#e04a4a') },
    troll: { skin: tone('#7b8794'), top: tone('#57534e'), pants: tone('#44403c'), eye: px('#e0c040') },
  }[type];
  const lean = atk >= 0 ? [0, 1, 3, 1][atk] : 0;
  const hip = [X, by - S(10)];
  // pernas
  [[-1, s], [1, -s]].forEach(([d, o], i) => {
    const fx = X + o * S(4) + d, t = i === 0 ? look.pants.d : look.pants.b;
    if (type === 'skeleton') pc.l(hip[0] + d, hip[1], fx, by - 1, i === 0 ? look.skin.d : look.skin.b, 1);
    else pc.l(hip[0] + d, hip[1], fx, by - 2, t, Math.max(2, Math.round(S(3))));
    pc.r(Math.round(fx) - 1, by - 2, Math.round(S(4)), 2, type === 'troll' ? look.skin.d : px('#2a1d12'));
  });
  // braço de trás
  const sh = [X + lean * 0.5, by - S(22)];
  pc.l(sh[0], sh[1], sh[0] - S(3) - s * 2, by - S(12), look.skin.d, type === 'skeleton' ? 1 : Math.max(2, Math.round(S(2.5))));
  // tronco
  const tw = S(type === 'skeleton' ? 6 : 8), th = S(13);
  const tx = X - tw / 2 + lean * 0.5, ty = by - S(23);
  if (type === 'skeleton') {
    pc.l(X, ty, X, ty + th, look.skin.b, 1);
    for (let i = 0; i < 4; i++) pc.l(tx, ty + 2 + i * 2.5, tx + tw, ty + 2 + i * 2.5, i % 2 ? look.skin.d : look.skin.b, 1);
    pc.r(Math.round(X - 3), Math.round(ty + th - 1), 6, 2, look.skin.d);
  } else {
    pc.e(X + lean * 0.5, ty + th / 2, tw / 2 + 1, th / 2 + 0.5, 0, (x, y, nx, ny) => nx < -0.4 ? look.top.l : nx > 0.4 ? look.top.d : look.top.b);
    if (type === 'orc') { pc.e(X + lean, ty + 2, S(4), S(2.5), px('#7a808a')); pc.p(X + lean, ty + 1, px('#b8bec8')); }
    if (type === 'troll') { pc.e(X - 2, ty + 2, 3, 2, px('#4d7c2f')); pc.e(X + 3, ty + 1, 2, 1.5, px('#3f6a22')); }
    pc.r(Math.round(tx), Math.round(ty + th - 2), Math.round(tw + 1), 2, px('#2a1d12'));
  }
  // cabeça
  const hx = X + S(2) + lean, hy = ty - S(4) + (type === 'troll' ? S(3) : 0);
  pc.e(hx, hy, S(4), S(4), 0, (x, y, nx, ny) => nx > 0.45 ? look.skin.d : ny < -0.5 ? look.skin.l : look.skin.b);
  if (type === 'goblin') { pc.poly([hx - S(3), hy - 1, hx - S(9), hy - S(4), hx - S(3), hy + 2], look.skin.b); pc.poly([hx + 2, hy - 2, hx + S(7), hy - S(5), hx + 3, hy + 1], look.skin.d); }
  if (type === 'skeleton') { pc.r(Math.round(hx), Math.round(hy - 1), 2, 2, px('#14100c')); pc.p(hx + 1, hy - 1, look.eye); pc.r(Math.round(hx), Math.round(hy + 2), 3, 1, px('#14100c')); }
  else {
    pc.p(hx + S(2), hy - 1, look.eye);
    if (type === 'orc' || type === 'troll') { pc.p(hx + S(2), hy + S(2), px('#f2ede0')); pc.p(hx + S(3.5), hy + S(2), px('#f2ede0')); }
    if (type === 'orc') { pc.e(hx - 0.5, hy - S(3), S(4.2), S(2), px('#4b4f57')); pc.l(hx - S(3), hy - S(4), hx - S(6), hy - S(8), px('#e2dccb'), 1); pc.l(hx + S(2), hy - S(4), hx + S(5), hy - S(8), px('#e2dccb'), 1); }
    if (type === 'troll') { pc.e(hx - 1, hy - S(3.5), S(3), S(1.5), px('#4d7c2f')); }
  }
  // braço da frente + arma
  const swing = atk >= 0 ? [-1.2, -1.6, 0.6, 0.2][atk] : -0.3 + s * 0.15;
  const hand = [sh[0] + Math.sin(swing + 1.4) * S(8), sh[1] + Math.cos(swing + 1.4) * S(8) + S(2)];
  pc.l(sh[0] + 1, sh[1], hand[0], hand[1], look.skin.b, type === 'skeleton' ? 1 : Math.max(2, Math.round(S(2.5))));
  const wa = swing + 0.6, dx = Math.sin(wa), dy = -Math.cos(wa);
  const at = d => [hand[0] + dx * d, hand[1] + dy * d];
  if (type === 'goblin') { const t = at(6); pc.l(hand[0], hand[1], t[0], t[1], px('#c0c6ce'), 1); }
  if (type === 'skeleton') { const t = at(12); pc.l(hand[0], hand[1], t[0], t[1], px('#9a8a70'), 2); pc.l(hand[0] - dy * 2, hand[1] + dx * 2, hand[0] + dy * 2, hand[1] - dx * 2, px('#6a5a40'), 1); }
  if (type === 'orc') { const t = at(14); pc.l(hand[0], hand[1], t[0], t[1], px('#5a3a22'), 1); const b0 = at(10); pc.poly([b0[0], b0[1], t[0] + dy * 5, t[1] - dx * 5, b0[0] + dy * 5 - dx * 3, b0[1] - dx * 5 - dy * 3], px('#9aa0a8')); }
  if (type === 'troll') { const t = at(22); pc.l(hand[0], hand[1], t[0], t[1], px('#6b4a2b'), 3); pc.e(t[0], t[1], 4, 4, px('#6b4a2b')); pc.p(t[0] - 1, t[1] - 1, px('#a8a29e')); }
}

// ---------- ícones das habilidades (16x16) ----------
function iconSprite(id) {
  return sprite('ic|' + id, 18, 18, 0, 0, pc => {
    const bgc = { bash: '#5a2a1a', warcry: '#5a1a1a', whirl: '#2e2e34', wall: '#5a441a', double: '#2a3a1a', pierce: '#1a3a24', rain: '#1a2e24', agile: '#14402e', fireball: '#5a2414', nova: '#14304a', heal: '#1e3a1a', meteor: '#3a1a4a', hp: '#3a0e0e', mp: '#0e1a3a' }[id] || '#333333';
    const bg = tone(bgc);
    pc.e(9, 9, 9, 9, 0, (x, y, nx, ny) => nx * nx + ny * ny < 0.5 ? bg.l : bg.b);
    const W = px('#f4efe2'), G = px('#e2b74e'), S2 = px('#c9ced6');
    switch (id) {
      case 'bash': pc.l(4, 14, 13, 5, S2, 2); pc.l(3, 15, 5, 13, px('#7a5a2a'), 1); pc.l(4, 11, 7, 14, G, 1); pc.e(13, 5, 2.5, 2.5, px('#ff9a4a')); break;
      case 'warcry': for (let r = 3; r <= 7; r += 2) for (let a = -0.9; a <= 0.9; a += 0.15) pc.p(6 + Math.cos(a) * r, 9 + Math.sin(a) * r, px('#ffb4a4')); pc.e(5, 9, 2, 2.5, px('#ffd8cc')); break;
      case 'whirl': for (let a = 0; a < 5; a += 0.12) pc.p(9 + Math.cos(a) * (2 + a), 9 + Math.sin(a) * (2 + a), W); break;
      case 'wall': pc.poly([4, 3, 14, 3, 14, 9, 9, 15, 4, 9], G); pc.poly([6, 5, 12, 5, 12, 9, 9, 12, 6, 9], px('#8a6a24')); pc.r(8, 5, 2, 7, px('#ffe8a0')); break;
      case 'double': pc.l(3, 13, 12, 4, px('#d6c9a8'), 1); pc.l(5, 15, 14, 6, px('#d6c9a8'), 1); pc.p(13, 3, S2); pc.p(15, 5, S2); break;
      case 'pierce': pc.l(2, 9, 14, 9, px('#bff5c8'), 2); pc.poly([13, 6, 17, 9, 13, 12], px('#e8ffe8')); pc.p(6, 7, px('#7ad89a')); pc.p(9, 11, px('#7ad89a')); break;
      case 'rain': for (let i = 0; i < 4; i++) { pc.l(4 + i * 3, 3 + (i % 2) * 3, 4 + i * 3, 10 + (i % 2) * 3, px('#d6c9a8'), 1); pc.p(4 + i * 3, 11 + (i % 2) * 3, S2); } break;
      case 'agile': for (let i = 0; i < 3; i++) for (let x = 3; x < 15; x++) pc.p(x, 5 + i * 4 + Math.round(Math.sin(x / 2 + i) * 1), px('#7ae0b4')); break;
      case 'fireball': pc.e(10, 8, 4, 4, 0, (x, y, nx, ny) => nx * nx + ny * ny < 0.3 ? px('#fff2b0') : px('#ff8a2a')); pc.l(3, 14, 7, 10, px('#d0401a'), 2); break;
      case 'nova': for (let a = 0; a < 6; a++) { const an = a * Math.PI / 3; pc.l(9, 9, 9 + Math.cos(an) * 6, 9 + Math.sin(an) * 6, px('#cfeaff'), 1); } pc.e(9, 9, 1.5, 1.5, W); break;
      case 'heal': pc.r(8, 3, 3, 12, px('#c8f5c0')); pc.r(4, 7, 11, 3, px('#c8f5c0')); pc.p(9, 4, W); break;
      case 'meteor': pc.l(3, 3, 9, 9, px('#ff8a2a'), 2); pc.e(11, 11, 3.5, 3.5, px('#7a3a14')); pc.p(10, 10, px('#ffb04a')); break;
      case 'hp': case 'mp': { const c2 = id === 'hp' ? '#c43a3a' : '#3a5ac4'; pc.e(9, 11, 5, 5, px(c2)); pc.p(7, 9, px('#ffffff')); pc.r(7, 3, 4, 4, px('#c9c2b0')); pc.r(7, 2, 4, 1, px('#7a4a22')); break; }
    }
  }, { k: ART });
}
