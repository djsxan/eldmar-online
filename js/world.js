// ============================================================
//  MUNDO — mapa gerado por código (igual para todos: usa sempre a
//  mesma semente). Tem 2 andares: 0 = chão, 1 = muralhas/torres.
// ============================================================
const TEST3D = typeof window !== 'undefined' && !!window.TEST3D;   // bairro de teste em 3D
const MAP_W = TEST3D ? 80 : 256, MAP_H = TEST3D ? 80 : 256, CENTER = TEST3D ? 40 : 128, SAFE_R = 38;
const C = CENTER;

const T = { WATER: 0, SAND: 1, GRASS: 2, FOREST: 3, STONE: 4, DIRT: 5, BRIDGE: 6, COBBLE: 7, SWAMP: 8, DEAD: 9, SHALLOW: 10, CLIFF: 11, FLOORSTONE: 12 };
const O = {
  NONE: 0, TREE: 1, PINE: 2, ROCK: 3, BUSH: 4, FLOWER: 5, FOUNTAIN: 6, LAMP: 7, TALLGRASS: 8, MUSHROOM: 9,
  REEDS: 10, LILY: 11, STUMP: 12, DEADTREE: 13, GRAVE: 14, BONES: 15, TENT: 16, CAMPFIRE: 17, FENCE: 18,
  TORCH: 19, BARREL: 20, CRATE: 21, HAY: 22, WELL: 23, STALL: 24, BENCH: 25, BANNER: 26, LOG: 27,
  FLOWERBED: 28, SPIKES: 29, WALL: 30, TOWER: 31, PART: 32, GATE: 33, STAIRS: 34, RUBBLE: 35, RUBBLEBIG: 36,
  STATUE: 37, BRAZIER: 38, DUMMY: 39, WATERFALL: 40, LOWWALL: 41, IVY: 42, ANVIL: 43, WEAPONRACK: 44, CART: 45, TABLE: 46, CAVE: 47, HOARD: 48, ARMORPILE: 49, RUINTOWER: 50, OAK: 51, BIRCH: 52, WILLOW: 53, FERN: 54, ROOTS: 55, SHROOMS: 56, BERRY: 57, HERB: 58, BOULDER: 59, GUILLOTINE: 60, STOOL: 61, STAGEFLOOR: 62,
};
const BLOCKING = new Set([O.TREE, O.PINE, O.ROCK, O.FOUNTAIN, O.STUMP, O.DEADTREE, O.GRAVE, O.TENT,
  O.CAMPFIRE, O.FENCE, O.BARREL, O.CRATE, O.HAY, O.WELL, O.STALL, O.LOG, O.SPIKES,
  O.WALL, O.TOWER, O.PART, O.RUBBLEBIG, O.CAVE, O.HOARD, O.RUINTOWER, O.OAK, O.BIRCH, O.WILLOW, O.BOULDER, O.GUILLOTINE, O.STOOL, O.STATUE, O.BRAZIER, O.DUMMY, O.WATERFALL, O.LOWWALL, O.ANVIL, O.WEAPONRACK, O.CART, O.TABLE]);
// objetos soltos que dá para pegar e arremessar (dano base)
const THROWABLE = { [O.BARREL]: 18, [O.CRATE]: 20, [O.ROCK]: 26 };
// objetos rasteiros (vão direto para o chão pré-desenhado)
const FLAT = new Set([O.FLOWER, O.LILY, O.FLOWERBED, O.BONES, O.RUBBLE, O.IVY, O.STAGEFLOOR]);
const BEDS = [];
const KITCHENS = [];   // fogões (casas e taverna): { x, y, bi }
const FRUIT_STOOL = { x: -1, y: -1 };
const STAGE = { x: -1, y: -1 };   // cadafalso da guilhotina (centro do tablado 3x3)   // camas do térreo (onde dá para deitar e dormir): { x, y, dx, dy (travesseiro -> pés), bi }
const DIRS8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

const Z = { VILLAGE: 0, FIELDS: 1, FOREST: 2, SWAMP: 3, BONES: 4, ORCS: 5, WILD: 6, OUTSKIRTS: 7 };
const ZONES = [
  { name: 'Cidadela de Sxan', stars: 0, mons: [] },
  { name: 'Campos de Sxan', stars: 1, mons: ['rat', 'deer', 'deer', 'boar'] },
  { name: 'Bosque Sombrio', stars: 2, mons: ['wolf', 'wolf', 'spider', 'deer', 'boar'] },
  { name: 'Pântano Pútrido', stars: 2, mons: ['toad', 'toad', 'rat'] },
  { name: 'Colinas de Ossos', stars: 3, mons: ['spider', 'rat', 'wolf'] },
  { name: 'Terras do Oeste', stars: 3, mons: ['boar', 'wolf', 'deer'] },
  { name: 'Terras Selvagens', stars: 4, mons: ['wolf', 'boar', 'deer', 'spider'] },
  { name: 'Arredores de Sxan', stars: 0, mons: [] },
];

function hash2(x, y, s) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function smooth(t) { return t * t * (3 - 2 * t); }
function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const u = smooth(x - xi), v = smooth(y - yi);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s);
  const c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, s) {
  let total = 0, amp = 1, freq = 1, norm = 0;
  for (let i = 0; i < 4; i++) { total += vnoise(x * freq, y * freq, s + i * 17) * amp; norm += amp; amp *= 0.5; freq *= 2; }
  return total / norm;
}

function zoneOf(x, y) {
  const dx = x - CENTER, dy = y - CENTER;
  if (Math.max(Math.abs(dx - 0.5), Math.abs(dy - 0.5)) <= SAFE_R + 1.5) return Z.VILLAGE;
  const d = Math.hypot(dx, dy) + (vnoise(x / 12, y / 12, 55) - 0.5) * 10;
  if (d < 62) return Z.OUTSKIRTS;
  if (d < 82) return Z.FIELDS;
  if (d > 106) return Z.WILD;
  const sx = dx - dy, sy = dx + dy;
  const a = Math.atan2(sy, sx) + (vnoise(x / 16, y / 16, 77) - 0.5) * 0.6;
  const q = Math.PI / 4;
  if (a >= -3 * q && a < -q) return Z.FOREST;
  if (a >= -q && a < q) return Z.SWAMP;
  if (a >= q && a < 3 * q) return Z.BONES;
  return Z.ORCS;
}

// ---------- cidade de Sxan (coordenadas relativas ao centro) ----------
const CASTLE = { x0: C - 32, y0: C - 32, x1: C + 33, y1: C + 33 };   // muralha externa
const KEEP = { x0: C - 9, y0: C - 22, x1: C + 10, y1: C - 3 };       // castelo central
const WALL_UNITS = 176 / (32 * Math.SQRT2 * Math.cos(Math.PI / 6));   // altura da muralha em tiles
const BH = (kind, w, h, H, RH, name, extra) => ({ kind, w, h, H, RH, floors: Math.max(1, Math.min(3, Math.round(H / 1.75))), name: name || '', wall: Math.round(H * 19.6), roof: Math.round(RH * 19.6), ...extra });
const BUILDINGS = TEST3D ? [] : [
  { x: C - 28, y: C - 29, ...BH('temple', 9, 8, 6.5, 5.0, 'Catedral da Aurora', { floors: 1 }) },
  { x: C + 13, y: C - 7, ...BH('shop', 5, 5, 4.0, 2.8, 'Empório do Borin') },
  { x: C + 21, y: C + 8, ...BH('smith', 6, 5, 2.6, 2.6, 'Forja de Hrodgar') },
  { x: C - 15, y: C + 8, ...BH('tavern', 6, 7, 4.2, 3.0, 'Taverna do Javali', { door: 'E' }) },   // de frente para a praça do mercado
  { x: C + 5, y: C + 22, ...BH('barracks', 8, 5, 4.0, 2.6, 'Quartel da Guarda') },
  { x: C - 28, y: C + 24, ...BH('stable', 5, 4, 2.6, 2.4, 'Estábulo', { floors: 1 }) },
  { x: C + 13, y: C + 0, ...BH('shop', 5, 4, 4.0, 2.8, 'Boticário de Elva', { v: 1 }) },
  { x: C + 21, y: C - 8, ...BH('shop', 6, 5, 5.4, 3.4, 'Arcanos & Varinhas', { v: 2 }) },
  { x: C + 13, y: C + 9, ...BH('shop', 5, 5, 4.0, 2.8, 'Alfaiataria Real', { v: 3 }) },
  { x: C + 21, y: C + 15, ...BH('shop', 6, 4, 2.6, 2.6, 'Pergaminhos & Mapas', { v: 4 }) },
  { x: C - 5, y: C - 19, ...BH('castle', 12, 10, 10, 6.5, 'Castelo de Sxan', { floors: 2 }) },
];
// portas: lado S (+y, padrão), N (-y), E (+x) ou W (-x). O layout interno usa um "quadro local":
// i = posição ao longo da parede da porta (largura A), j = profundidade (0 = fundo, D-1 = linha da porta)
const DOOR_V = { S: [0, 1], N: [0, -1], E: [1, 0], W: [-1, 0] };
const DOOR_ROT = { S: 0, N: Math.PI, E: Math.PI / 2, W: -Math.PI / 2 };
function bDims(b) { const s = b.door || 'S'; return s === 'S' || s === 'N' ? [b.w, b.h] : [b.h, b.w]; }
function bLocal(b, i, j) {
  const s = b.door || 'S', w = b.w, h = b.h;
  if (s === 'S') return [b.x + i, b.y + j];
  if (s === 'N') return [b.x + w - 1 - i, b.y + h - 1 - j];
  if (s === 'E') return [b.x + j, b.y + h - 1 - i];
  return [b.x + w - 1 - j, b.y + i];
}
// direção (1:+x 3:-y 5:-x 7:+y) do quadro local para o mundo
function bDir(b, d) {
  const lv = { 1: [1, 0], 3: [0, -1], 5: [-1, 0], 7: [0, 1] }[d], a = DOOR_ROT[b.door || 'S'];
  const x = lv[0] * Math.cos(a) + lv[1] * Math.sin(a), y = -lv[0] * Math.sin(a) + lv[1] * Math.cos(a);
  return Math.abs(x) > Math.abs(y) ? (x > 0 ? 1 : 5) : (y > 0 ? 7 : 3);
}
const doorCol = b => Math.floor((bDims(b)[0] - 1) / 2);
// 10 modelos de casa (A = largura da fachada com a porta, D = profundidade)
const HOUSE_TYPES = [
  { A: 4, D: 4, H: 2.4, RH: 2.4, v: 1, floors: 1 }, { A: 5, D: 4, H: 2.4, RH: 2.6, v: 0, floors: 1 }, { A: 5, D: 5, H: 2.6, RH: 2.8, v: 3, floors: 1 }, { A: 6, D: 4, H: 2.4, RH: 2.6, v: 5, floors: 1 },
  { A: 4, D: 5, H: 4.0, RH: 2.6, v: 2, floors: 2 }, { A: 5, D: 4, H: 4.0, RH: 2.8, v: 4, floors: 2 }, { A: 6, D: 5, H: 4.0, RH: 3.0, v: 0, floors: 2 }, { A: 5, D: 5, H: 4.0, RH: 2.8, v: 3, floors: 2 },
  { A: 5, D: 5, H: 5.4, RH: 3.0, v: 1, floors: 3 }, { A: 6, D: 5, H: 5.4, RH: 3.2, v: 5, floors: 3 },
];
// chave do desenho: casas do mesmo modelo e lado de porta compartilham a mesma foto
function archKey(b) { return b.arch != null ? 'h' + b.arch : 'u' + b.x + '_' + b.y; }
// ponto contínuo do quadro local (u ao longo da fachada, v em profundidade) para o mundo
function localToWorld(b, u, v) {
  const s = b.door || 'S', X0 = b.x - 0.5, Y0 = b.y - 0.5;
  if (s === 'S') return [X0 + u, Y0 + v];
  if (s === 'N') return [X0 + b.w - u, Y0 + b.h - v];
  if (s === 'E') return [X0 + v, Y0 + b.h - u];
  return [X0 + b.w - v, Y0 + u];
}
function doorTile(b) { const [A, D] = bDims(b); return bLocal(b, doorCol(b), D - 1); }
const doorOf = b => { const [x, y] = doorTile(b), v = DOOR_V[b.door || 'S']; return { x: x + v[0] * 1.3, y: y + v[1] * 1.3 }; };
// mobília dos interiores (coordenadas locais em tiles: i = coluna, j = linha; a porta fica na linha h-1)
// direções de quem senta: 1 = olha +x, 3 = olha -y, 5 = olha -x, 7 = olha +y
// escadas: o andar f sobe pela escada STAIR_AT(b, f) e o andar f+1 desce pela mesma (canto do fundo, alternando)
// escada de 2 tiles encostada na parede: andar par = parede do fundo subindo para a direita; ímpar = parede esquerda subindo para o fundo
// L = degrau de baixo, U = topo, entry = de onde se entra embaixo, arrive = onde se chega em cima
function stairSpec(b, f) {
  const [A] = bDims(b);
  // o topo fica a 1 tile da parede: em cima, chega-se no tile em frente aos degraus (na direção da subida)
  if (f % 2 === 0) return { L: [A - 3, 0], U: [A - 2, 0], dv: [1, 0], entry: [A - 4, 0], arrive: [A - 1, 0] };
  return { L: [0, 3], U: [0, 2], dv: [0, -1], entry: [0, 4], arrive: [0, 1] };
}
function floorsOf(b) { return b.kind === 'stairtower' ? 1 : (b.floors || 1); }
function interiorLayout0(b, fl = 0) {
  const [w, h] = bDims(b), F = [], taken = new Set(), key = (i, j) => i + ',' + j, dc = doorCol(b);
  const corridor = (i, j) => (fl === 0 && i === dc && j >= h - 2);
  const nF = floorsOf(b);
  // escadas deste andar (subir/descer) + o tile de chegada na frente delas ficam livres
  const stairs = [];
  if (fl < nF - 1) stairs.push(['stairup', stairSpec(b, fl)]);
  if (fl > 0) stairs.push(['stairdown', stairSpec(b, fl - 1)]);
  for (const [t, s] of stairs) {
    for (const p of [s.L, s.U, t === 'stairup' ? s.entry : s.arrive]) taken.add(key(p[0], p[1]));
    F.push({ t, i: Math.min(s.L[0], s.U[0]), j: Math.min(s.L[1], s.U[1]), w: s.dv[0] ? 2 : 1, h: s.dv[1] ? 2 : 1, block: false, dv: s.dv });
    const bp = t === 'stairup' ? s.U : s.L;   // embaixo não se pisa sob o topo; em cima o vão da escada
    F.push({ t: 'blk', i: bp[0], j: bp[1], w: 1, h: 1, block: true });
  }
  const can = (i, j) => i >= 0 && j >= 0 && i < w && j < h && !taken.has(key(i, j)) && !corridor(i, j);
  const put = (t, i, j, o = {}) => {
    const tw = o.w || 1, th = o.h || 1;
    for (let a = 0; a < tw; a++) for (let c = 0; c < th; c++) if (!can(i + a, j + c)) return false;
    for (let a = 0; a < tw; a++) for (let c = 0; c < th; c++) taken.add(key(i + a, j + c));
    F.push({ t, i, j, w: tw, h: th, block: o.block !== false, seat: o.seat, v: o.v || 0 });
    return true;
  };
  let npc = null;
  const npcAt = (i, j) => { for (const d of [0, -1, 1, -2, 2]) if (can(i + d, j)) { taken.add(key(i + d, j)); npc = { i: i + d, j }; return; } };
  const k = b.kind;
  if (fl > 0) {
    // andares de cima: quartos, depósitos e aposentos
    if (k === 'castle') { put('bed', 2, 0, { w: 2, h: 2, v: 1 }); put('chest', 4, 0); put('shelf', 5, 0); put('shelf', 6, 0); put('fireplace', w - 3, 0); if (put('table', 6, 4, { w: 2 })) { put('chair', 5, 4); put('chair', 8, 4); } put('banner', 0, 3); put('banner', 0, 6); put('candles', w - 1, 3); put('rug', 4, 3, { w: 4, h: 3, block: false }); }
    else if (k === 'tavern') { for (const i of [1, 3, 5]) if (i < w - 1) { put('bed', i, 0, { h: 2 }); } put('chest', 2, 0); put('chest', 4, 0); if (put('table', 2, h - 2)) put('chair', 3, h - 2); put('barrel', w - 1, h - 1); put('rug', 2, 3, { w: 3, block: false }); }
    else if (k === 'barracks') { for (const i of [1, 2, w - 2]) put('bunk', i, 0, { h: 2 }); put('rack', 3, 0); put('chest', 1, h - 1); put('chest', w - 2, h - 1); }
    else if (k === 'shop') { for (let i = 1; i < w - 1; i++) put(i % 2 ? 'crate' : 'barrel', i, 0); put('shelf', 0, h - 2); put('shelf', w - 1, h - 2); put('crate', 1, h - 1); put('barrel', w - 2, h - 1); }
    else if (fl === 1) { put('bed', 1, 0, { h: 2 }); put('chest', 2, 0); put('shelf', 0, h - 1); if (put('table', w - 2, h - 2)) put('chair', w - 3, h - 2); put('rug', 2, 2, { w: Math.max(1, w - 4), block: false }); }
    else { put('crate', 1, 0); put('barrel', 2, 0); put('bed', 0, h - 2, { h: 2 }); put('crate', w - 1, h - 1); put('rug', 2, 2, { w: Math.max(1, w - 4), block: false }); }
    return { F, npc: null };
  }
  if (k === 'house') {
    put('bed', 0, 0, { h: 2 }); put('fireplace', w - 2, 0); put('stove', w - 1, 0); put('chest', 1, 0); if (h >= 5) put('barrel', w - 1, 1);
    if (put('table', w - 2, h - 3)) { put('chair', w - 1, h - 3, { seat: 5 }); put('chair', w - 3, h - 3, { seat: 1 }); }
    put('shelf', 0, h - 2); if (h >= 5) put('crate', 0, h - 1);
    put('rug', dc, 1, { block: false });
  } else if (k === 'shop') {
    if (!b.v) npcAt(dc, 0);
    for (let i = 0; i < w; i++) if (i !== dc) put('shelf', i, 0, { v: b.v });
    put('counter', 1, 1, { w: w - 2, v: b.v });
    put('display', 0, h - 2, { v: b.v }); put('display', w - 1, h - 2, { v: b.v });
    if (b.v === 3) put('mannequin', w - 1, 2); else if (b.v === 2) put('orb', w - 1, 2); else if (b.v === 1) put('cauldron', w - 1, 2); else put('crate', w - 1, 2);
  } else if (k === 'smith') {
    put('forge', 0, 0, { w: 2 }); npcAt(3, 1); put('anvil', 4, 1); put('barrel', 4, 0);
    for (let j = 0; j < 3; j++) put('rack', w - 1, j);
    put('trough', 0, 2, { w: 2 });
  } else if (k === 'tavern') {
    npcAt(1, 0); put('barrel', 0, 0); put('barrel', 2, 0); put('counter', 0, 1, { w: 3 }); put('fireplace', w - 2, 0); put('shelf', 3, 0); put('stove', 4, 0) || put('stove', w - 1, 1);
    for (const [ti, tj] of [[5, 2], [1, 3], [5, 4]]) if (put('table', ti, tj)) { put('chair', ti - 1, tj, { seat: 1 }); put('chair', ti + 1, tj, { seat: 5 }); }
  } else if (k === 'temple') {
    put('altar', dc - 1, 0, { w: 3 }); npcAt(dc, 1); put('candles', 1, 0); put('candles', w - 2, 0);
    for (const j of [3, 5]) { put('pew', 1, j, { w: dc - 1, seat: 3 }); put('pew', dc + 1, j, { w: w - dc - 2, seat: 3 }); }
  } else if (k === 'barracks') {
    put('bunk', 0, 0, { h: 2 }); put('bunk', 1, 0, { h: 2 }); put('bunk', w - 1, 0, { h: 2 }); put('bunk', w - 2, 0, { h: 2 });
    npcAt(dc, 1); put('rack', 2, 0); put('rack', w - 3, 0);
    if (put('table', w - 3, 3)) { put('chair', w - 4, 3, { seat: 1 }); put('chair', w - 2, 3, { seat: 5 }); }
  } else if (k === 'stable') {
    put('hay', 0, 0); put('hay', w - 1, 0); put('trough', 1, 0, { w: w - 2 }); put('hay', 0, h - 2); put('crate', w - 1, h - 2);
  } else if (k === 'stairtower') {
    // escada interna: nenhuma mobília
  } else if (k === 'castle') {
    put('throne', dc, 0, { seat: 7 }); put('banner', dc - 2, 0); put('banner', dc + 2, 0); put('candles', dc - 4, 0); put('candles', dc + 4, 0);
    put('fireplace', 0, 1); put('fireplace', 0, h - 3);
    for (const ti of [2, w - 3]) if (put('table', ti, 3, { h: h - 5 })) for (let j = 3; j < h - 2; j++) { put('chair', ti - 1, j, { seat: 1 }); put('chair', ti + 1, j, { seat: 5 }); }
    put('rug', dc, 2, { block: false });
  }
  return { F, npc };
}
// layout final: descarta móveis que fechariam algum canto do cômodo (todo tile livre precisa ser alcançável)
const LAYOUT_MEMO = new Map();
function interiorLayout(b, fl = 0) {
  const [w, h] = bDims(b), mk = [b.kind, w, h, b.v || 0, floorsOf(b), fl].join('|');
  let L = LAYOUT_MEMO.get(mk); if (L) return L;
  L = interiorLayout0(b, fl);
  const blk = new Uint8Array(w * h), id = (i, j) => j * w + i;
  if (L.npc) blk[id(L.npc.i, L.npc.j)] = 1;
  const s0 = fl === 0 ? [doorCol(b), h - 1] : stairSpec(b, fl - 1).arrive;
  const okAll = () => {
    const seen = new Uint8Array(w * h), q = [id(s0[0], s0[1])]; seen[q[0]] = 1;
    for (let k = 0; k < q.length; k++) { const i = q[k] % w, j = (q[k] / w) | 0; for (const [a, c] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ni = i + a, nj = j + c; if (ni < 0 || nj < 0 || ni >= w || nj >= h) continue; const n = id(ni, nj); if (!blk[n] && !seen[n]) { seen[n] = 1; q.push(n); } } }
    for (let n = 0; n < w * h; n++) if (!blk[n] && !seen[n]) return false; return true;
  };
  const F = [];
  for (const f of L.F) {
    if (!f.block || f.t === 'blk') { F.push(f); if (f.block) blk[id(f.i, f.j)] = 1; continue; }
    const cells = []; for (let a = 0; a < f.w; a++) for (let c = 0; c < f.h; c++) cells.push(id(f.i + a, f.j + c));
    for (const n of cells) blk[n] = 1;
    if (okAll()) F.push(f); else for (const n of cells) blk[n] = 0;
  }
  L = { F, npc: L.npc }; LAYOUT_MEMO.set(mk, L); return L;
}
const npcIn = (b, fb) => { const L = interiorLayout(b); if (!L.npc) return fb; const [x, y] = bLocal(b, L.npc.i, L.npc.j); return { x, y }; };
const BLD_BY = k => BUILDINGS.find(b => b.kind === k);
const NPCS = TEST3D ? [] : [
  { id: 'priest', name: 'Irmã Lúmina', kind: 'priest', ...npcIn(BUILDINGS[0]) },
  { id: 'merchant', name: 'Borin, o Mercador', kind: 'merchant', ...npcIn(BUILDINGS[1]) },
  { id: 'innkeeper', name: 'Greta, a Taverneira', kind: 'innkeeper', ...npcIn(BUILDINGS[3]) },
  { id: 'smith', name: 'Hrodgar, o Ferreiro', kind: 'smith', ...npcIn(BUILDINGS[2]) },
  { id: 'captain', name: 'Capitã Mirela Varn', kind: 'captain', ...npcIn(BUILDINGS[4]) },
  { id: 'guard1', name: 'Sentinela Aldric', kind: 'guard', x: C - 3, y: C + 30.4 },
  { id: 'guard2', name: 'Sentinela Bren', kind: 'guard', x: C + 4, y: C + 30.4 },
  { id: 'guard3', name: 'Sentinela Odo', kind: 'guard', x: C - 1.4, y: C - 29.4 },
  { id: 'guard4', name: 'Sentinela Wyn', kind: 'guard', x: C + 2.4, y: C - 29.4 },
  { id: 'fruit', name: 'Marta, a Fruteira', kind: 'fruit', x: C - 3, y: C + 9, stall: [C - 3, C + 10] },
  { id: 'executioner', name: 'Mestre Corvo, o Carrasco', kind: 'executioner', x: C - 4.6, y: C + 3.4 },
];
// ---------- bairro de teste ----------
if (TEST3D) {
  BUILDINGS.push(
    { x: 26, y: 22, ...BH('house', 6, 6, 5.9, 3.6, '', { v: 0, door: 'S' }) },
    { x: 44, y: 22, ...BH('house', 5, 6, 7.4, 3.2, '', { v: 3, door: 'S' }) },
    { x: 26, y: 34, ...BH('house', 6, 5, 4.4, 3.4, '', { v: 1, door: 'N' }) },
    { x: 44, y: 34, ...BH('house', 6, 5, 5.9, 4.0, '', { v: 2, door: 'N' }) },
    { x: 53, y: 41, ...BH('shop', 6, 6, 6.2, 3.6, 'Empório do Borin', { v: 0, door: 'W' }) },
    { x: 21, y: 41, ...BH('tavern', 6, 7, 6.4, 4.2, 'Taverna do Javali', { door: 'E' }) },
    { x: 55, y: 18, ...BH('stairtower', 3, STAIR_N + 1, 5.6, 0, '', { door: 'S' }) },
  );
  NPCS.push(
    { id: 'merchant', name: 'Borin, o Mercador', kind: 'merchant', ...npcIn(BUILDINGS[4]) },
    { id: 'innkeeper', name: 'Greta, a Taverneira', kind: 'innkeeper', ...npcIn(BUILDINGS[5]) },
    { id: 'captain', name: 'Capitã Mirela Varn', kind: 'captain', x: 35.5, y: 43.5 },
    { id: 'guard1', name: 'Sentinela Aldric', kind: 'guard', x: 36.6, y: 19.8 },
    { id: 'guard2', name: 'Sentinela Bren', kind: 'guard', x: 42.4, y: 19.8 },
  );
}
const TEMPLE_SPAWN = TEST3D ? { x: 40, y: 44 } : { x: BUILDINGS[0].x + 4, y: BUILDINGS[0].y + BUILDINGS[0].h + 2 };
const MOUNTAIN = TEST3D ? { x: -100, y: -100, r: 1 } : { x: 50, y: 52, r: 20 };
// ---------- bastiões: lugares onde os inimigos se concentram (o resto do mundo é da fauna) ----------
const bpos = (a, d) => { const r = d * Math.SQRT2; return { x: Math.round(CENTER + r * (Math.cos(a) + Math.sin(a)) / 2), y: Math.round(CENTER + r * (Math.sin(a) - Math.cos(a)) / 2) }; };
const CAVE_POS = (() => { const dx = CENTER - MOUNTAIN.x, dy = CENTER - MOUNTAIN.y, l = Math.hypot(dx, dy); return { x: Math.round(MOUNTAIN.x + dx / l * (MOUNTAIN.r + 1)), y: Math.round(MOUNTAIN.y + dy / l * (MOUNTAIN.r + 1)), ux: dx / l, uy: dy / l }; })();
const BASTIONS = TEST3D ? [] : [
  { id: 'orc', name: 'Acampamento Orc', kind: 'camp', ...bpos(Math.PI, 92), r: 9, mons: { orc: 5, goblin: 6 }, boss: 'orcchief', patrol: ['goblin', 'goblin', 'orc'] },
  { id: 'crypt', name: 'Cripta das Colinas', kind: 'crypt', ...bpos(Math.PI / 2, 92), r: 9, mons: { skeleton: 9 }, boss: 'cryptlord', patrol: ['skeleton', 'skeleton'] },
  { id: 'fort', name: 'Fortim dos Desertores', kind: 'fort', ...bpos(-Math.PI / 2 + 0.6, 90), r: 9, mons: { bandit: 6, deserter: 4 }, boss: 'deserterchief', patrol: ['bandit', 'bandit', 'deserter'] },
  { id: 'pools', name: 'Poças do Pântano', kind: 'pools', ...bpos(0, 92), r: 9, mons: { slime: 7 }, boss: 'elderslime', night: { wisp: 4 } },
  // TEMPORÁRIO (testes do combate): acampamento de bandidos logo depois do portão sul, repovoa rápido
  { id: 'test', name: 'Acampamento de Bandidos (teste)', kind: 'testcamp', x: CENTER + 12, y: CENTER + 45, r: 5, mons: { bandit: 3, goblin: 2 }, fast: 15000, temp: true },
  { id: 'dragon', name: 'Covil do Dragão', kind: 'dragon', ...bpos(Math.PI / 4, 110), r: 9, mons: {}, boss: 'dragon', respawn: 1800000 },
  { id: 'cave', name: 'Caverna do Troll', kind: 'cave', x: CAVE_POS.x + Math.round(CAVE_POS.ux * 6), y: CAVE_POS.y + Math.round(CAVE_POS.uy * 6), r: 6, mons: {}, boss: 'troll' },
];
const RIVER_PTS = [[70, 74], [76, 100], [72, 128], [80, 172], [112, 198], [152, 214], [192, 234], [234, 254]];

function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

function generateWorld() {
  const N = MAP_W * MAP_H;
  const ground = new Uint8Array(N), obj = new Uint8Array(N), zone = new Uint8Array(N);
  const bld = new Int16Array(N).fill(-1);
  const fl1 = new Uint8Array(N);       // andar 1: 1 = muralha, 2 = assoalho, 3 = escada
  const stair = new Uint8Array(N);     // escadas: direção para onde sobem (1..4)
  const stairK = new Uint8Array(N);    // degrau da escada (0 = de baixo, 1 = de cima)
  const tvar = new Uint8Array(N);      // variação das torres (3 = torre alta com cone)
  const toff = new Uint8Array(N).fill(4); // torre centrada na linha da muralha: (ox+1)*3+(oz+1)
  const wdir = new Uint8Array(N);      // muralhas: lado de fora (1:+x 2:-x 3:+y 4:-y)
  const gateId = new Int8Array(N).fill(-1);
  const gates = [];
  const seats = [];
  const rdir = new Uint8Array(N);      // direção da estrada (1 = ao longo de x, 2 = de y)
  const height = new Uint8Array(N);    // altura dos penhascos (0..4)
  const flow = new Float32Array(N * 2); // direção da correnteza do rio
  const river = new Uint8Array(N);
  const R = (x, y, s) => hash2(x, y, s);
  const idx = (x, y) => y * MAP_W + x;
  const inb = (x, y) => x >= 0 && y >= 0 && x < MAP_W && y < MAP_H;

  // terreno base
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const i = idx(x, y), dx = x - CENTER, dy = y - CENTER;
    const edge = Math.sqrt(dx * dx + dy * dy) / (MAP_W / 2);
    const h = fbm(x / 26, y / 26, 7) + 0.32 - edge * edge * 0.45;
    const z = zoneOf(x, y);
    zone[i] = z;
    const n1 = fbm(x / 12, y / 12, 99), n2 = fbm(x / 8, y / 8, 31);
    let g;
    if (h < 0.35 || x < 2 || y < 2 || x > MAP_W - 3 || y > MAP_H - 3) g = T.WATER;
    else if (h < 0.385) g = T.SAND;
    else switch (z) {
      case Z.OUTSKIRTS: g = vnoise(x / 6, y / 6, 333) > 0.68 ? T.DEAD : n1 > 0.7 ? T.FOREST : T.GRASS; break;
      case Z.FIELDS: g = n1 > 0.64 ? T.FOREST : T.GRASS; break;
      case Z.FOREST: g = n1 > 0.42 ? T.FOREST : T.GRASS; break;
      case Z.SWAMP: g = n2 > 0.68 ? T.WATER : n2 > 0.42 ? T.SWAMP : T.GRASS; break;
      case Z.BONES: g = n2 > 0.6 ? T.DIRT : T.DEAD; break;
      case Z.ORCS: g = n1 > 0.5 ? T.DIRT : (n2 > 0.5 ? T.DEAD : T.GRASS); break;
      case Z.WILD: g = n2 > 0.7 ? T.STONE : n1 > 0.55 ? T.FOREST : T.GRASS; break;
      default: g = T.GRASS;
    }
    if (z === Z.VILLAGE) g = T.GRASS;
    ground[i] = g;
  }

  // montanha
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const d = Math.hypot(x - MOUNTAIN.x, y - MOUNTAIN.y) + (vnoise(x / 4, y / 4, 400) - 0.5) * 6;
    if (d < MOUNTAIN.r) {
      const i = idx(x, y);
      ground[i] = T.CLIFF;
      height[i] = d < MOUNTAIN.r * 0.35 ? 4 : d < MOUNTAIN.r * 0.6 ? 3 : d < MOUNTAIN.r * 0.82 ? 2 : 1;
    }
  }

  // rio
  const P = RIVER_PTS;
  const pts = [];
  for (let k = 0; k < P.length - 1; k++) {
    const p0 = P[Math.max(0, k - 1)], p1 = P[k], p2 = P[k + 1], p3 = P[Math.min(P.length - 1, k + 2)];
    for (let t = 0; t < 1; t += 0.03) pts.push([catmull(p0[0], p1[0], p2[0], p3[0], t), catmull(p0[1], p1[1], p2[1], p3[1], t)]);
  }
  pts.push(P[P.length - 1]);
  const fords = new Set([Math.floor(pts.length * 0.22), Math.floor(pts.length * 0.5), Math.floor(pts.length * 0.8)]);
  pts.forEach(([px, py], k) => {
    const nx = pts[Math.min(pts.length - 1, k + 1)], fx = nx[0] - px, fy = nx[1] - py, fl = Math.hypot(fx, fy) || 1;
    const w = 1.8 + vnoise(k / 6, 0, 81) * 1.2;
    let ford = false;
    for (const f of fords) if (Math.abs(k - f) <= 2) ford = true;
    for (let yy = Math.floor(py - 4); yy <= py + 4; yy++) for (let xx = Math.floor(px - 4); xx <= px + 4; xx++) {
      if (!inb(xx, yy) || Math.hypot(xx - px, yy - py) > w) continue;
      const i = idx(xx, yy);
      if (ground[i] === T.CLIFF) continue;
      ground[i] = ford ? T.SHALLOW : T.WATER;
      river[i] = 1;
      flow[i * 2] = fx / fl; flow[i * 2 + 1] = fy / fl;
      obj[i] = O.NONE;
    }
  });
  // lago aos pés da cachoeira
  const pool = RIVER_PTS[0];
  for (let yy = pool[1] - 5; yy <= pool[1] + 5; yy++) for (let xx = pool[0] - 5; xx <= pool[0] + 5; xx++) {
    if (Math.hypot(xx - pool[0], yy - pool[1]) < 4 && ground[idx(xx, yy)] !== T.CLIFF) { ground[idx(xx, yy)] = T.WATER; river[idx(xx, yy)] = 1; flow[idx(xx, yy) * 2] = 0.5; flow[idx(xx, yy) * 2 + 1] = 0.7; }
  }
  // cachoeira: anda do lago em direção à montanha; o primeiro penhasco vira a queda d'água
  {
    const dx = MOUNTAIN.x - pool[0], dy = MOUNTAIN.y - pool[1], L = Math.hypot(dx, dy);
    for (let s = 0; s < L; s += 0.5) {
      const x = Math.round(pool[0] + dx / L * s), y = Math.round(pool[1] + dy / L * s), i = idx(x, y);
      if (ground[i] !== T.CLIFF) { ground[i] = T.WATER; river[i] = 1; flow[i * 2] = 0.6; flow[i * 2 + 1] = 0.6; obj[i] = O.NONE; continue; }
      for (const [ax, ay] of [[0, 0], [1, -1], [-1, 1]]) {
        const j = idx(x + ax, y + ay);
        if (ground[j] !== T.CLIFF) continue;
        obj[j] = O.WATERFALL; height[j] = 3;
        for (const [fx, fy] of [[1, 0], [0, 1], [1, 1]]) { const k = idx(x + ax + fx, y + ay + fy); if (ground[k] !== T.CLIFF) { ground[k] = T.WATER; river[k] = 1; flow[k * 2] = 0.6; flow[k * 2 + 1] = 0.6; obj[k] = O.NONE; } }
        for (const [bx, by] of [[-1, 0], [0, -1], [-1, -1]]) { const k = idx(x + ax + bx, y + ay + by); if (ground[k] === T.CLIFF) height[k] = Math.max(height[k], 4); }
      }
      break;
    }
  }

  // vegetação e objetos por zona
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const i = idx(x, y), g = ground[i], z = zone[i], r = R(x, y, 4242);
    if (obj[i] !== O.NONE || g === T.CLIFF || z === Z.VILLAGE) continue;
    let o = O.NONE;
    if (g === T.WATER) { if (!river[i] && ((z === Z.SWAMP && r < 0.12) || (z === Z.FIELDS && r < 0.02))) o = O.LILY; }
    else if (g === T.SHALLOW) o = O.NONE;
    else if (g === T.SAND) { if (r < 0.025) o = O.ROCK; else if (r < 0.07) o = O.REEDS; }
    else if (z === Z.OUTSKIRTS) {
      if (g === T.DEAD) o = r < 0.55 ? O.TALLGRASS : r < 0.565 ? O.HAY : O.NONE;            // trigais
      else if (g === T.FOREST) o = r < 0.07 ? O.TREE : r < 0.13 ? O.BUSH : r < 0.25 ? O.TALLGRASS : O.NONE;
      else o = r < 0.02 ? O.TREE : r < 0.04 ? O.BUSH : r < 0.14 ? O.FLOWER : r < 0.22 ? O.TALLGRASS : r < 0.224 ? O.ROCK : O.NONE;
    } else if (z === Z.FIELDS) {
      if (g === T.FOREST) o = r < 0.07 ? O.TREE : r < 0.1 ? O.PINE : r < 0.15 ? O.BUSH : r < 0.18 ? O.MUSHROOM : r < 0.28 ? O.TALLGRASS : O.NONE;
      else o = r < 0.025 ? O.TREE : r < 0.06 ? O.BUSH : r < 0.075 ? O.ROCK : r < 0.17 ? O.FLOWER : r < 0.27 ? O.TALLGRASS : r < 0.275 ? O.LOG : O.NONE;
    } else if (z === Z.FOREST) {
      if (g === T.FOREST) o = r < 0.08 ? O.TREE : r < 0.13 ? O.PINE : r < 0.18 ? O.BUSH : r < 0.22 ? O.MUSHROOM : r < 0.235 ? O.STUMP : r < 0.32 ? O.TALLGRASS : r < 0.33 ? O.LOG : O.NONE;
      else o = r < 0.06 ? O.TREE : r < 0.1 ? O.BUSH : r < 0.25 ? O.TALLGRASS : r < 0.29 ? O.FLOWER : r < 0.3 ? O.STUMP : O.NONE;
    } else if (z === Z.SWAMP) {
      if (g === T.SWAMP) o = r < 0.05 ? O.DEADTREE : r < 0.17 ? O.REEDS : r < 0.21 ? O.MUSHROOM : r < 0.29 ? O.TALLGRASS : r < 0.3 ? O.LOG : O.NONE;
      else o = r < 0.08 ? O.REEDS : r < 0.11 ? O.TREE : r < 0.15 ? O.BUSH : r < 0.27 ? O.TALLGRASS : O.NONE;
    } else if (z === Z.BONES) {
      if (g === T.DEAD) o = r < 0.04 ? O.GRAVE : r < 0.08 ? O.BONES : r < 0.12 ? O.DEADTREE : r < 0.15 ? O.ROCK : r < 0.23 ? O.TALLGRASS : O.NONE;
      else o = r < 0.05 ? O.ROCK : r < 0.09 ? O.BONES : r < 0.1 ? O.GRAVE : O.NONE;
    } else if (z === Z.ORCS) {
      if (g === T.DIRT) o = r < 0.012 ? O.TENT : r < 0.02 ? O.CAMPFIRE : r < 0.035 ? O.SPIKES : r < 0.05 ? O.BONES : r < 0.07 ? O.ROCK : r < 0.077 ? O.CRATE : O.NONE;
      else o = r < 0.04 ? O.TREE : r < 0.08 ? O.BUSH : r < 0.18 ? O.TALLGRASS : r < 0.2 ? O.DEADTREE : O.NONE;
    } else if (z === Z.WILD) {
      if (g === T.STONE) o = r < 0.18 ? O.ROCK : r < 0.2 ? O.PINE : O.NONE;
      else if (g === T.FOREST) o = r < 0.09 ? O.PINE : r < 0.13 ? O.TREE : r < 0.17 ? O.BUSH : r < 0.2 ? O.MUSHROOM : O.NONE;
      else o = r < 0.06 ? O.TREE : r < 0.1 ? O.PINE : r < 0.14 ? O.ROCK : r < 0.18 ? O.BUSH : r < 0.3 ? O.TALLGRASS : r < 0.33 ? O.FLOWER : O.NONE;
    }
    obj[i] = o;
  }
  // espaça as árvores: nunca duas árvores/pinheiros vizinhos (sempre há caminho)
  for (let y = 1; y < MAP_H - 1; y++) for (let x = 1; x < MAP_W - 1; x++) {
    const i = idx(x, y), o = obj[i];
    if (o !== O.TREE && o !== O.PINE && o !== O.DEADTREE && o !== O.ROCK) continue;
    for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [-1, 1]]) { const j = idx(x + dx, y + dy), q = obj[j]; if (q === O.TREE || q === O.PINE || q === O.DEADTREE || q === O.ROCK || q === O.BUSH) obj[j] = O.TALLGRASS; }
  }
  // ---- natureza densa: florestas fechadas com clareiras e trilhas, bosques nos campos, salgueiros na água, riachos e poças ----
  {
    const TREES = new Set([O.TREE, O.PINE, O.OAK, O.BIRCH, O.WILLOW, O.DEADTREE]);
    for (let y = 2; y < MAP_H - 2; y++) for (let x = 2; x < MAP_W - 2; x++) {
      const i = idx(x, y), g = ground[i], z = zone[i];
      if (g === T.CLIFF || g === T.WATER || g === T.SHALLOW || g === T.SAND || g === T.BRIDGE || z === Z.VILLAGE || z === Z.OUTSKIRTS || river[i]) continue;
      if (Math.hypot(x - MOUNTAIN.x, y - MOUNTAIN.y) < MOUNTAIN.r + 1) continue;
      const clr = vnoise(x / 16, y / 16, 951), trail = Math.abs(vnoise(x / 24, y / 24, 952) - 0.5) < 0.022, grove = vnoise(x / 11, y / 11, 953), sp = vnoise(x / 9, y / 9, 954), r = R(x, y, 955), r2 = R(x, y, 956);
      let o = obj[i];
      if (trail && (z === Z.FOREST || z === Z.WILD || z === Z.FIELDS)) { obj[i] = O.NONE; ground[i] = T.DIRT; continue; }
      if (z === Z.FOREST || z === Z.WILD) {
        if (clr < 0.3) {   // clareira: grama, flores, frutas e ervas
          o = r < 0.05 ? O.FLOWER : r < 0.22 ? O.TALLGRASS : r < 0.235 ? O.BERRY : r < 0.245 ? O.HERB : r < 0.252 ? O.ROCK : O.NONE;
          if (g === T.FOREST) ground[i] = T.GRASS;
        } else {
          const dense = clr > 0.45, treeP = dense ? 0.3 : 0.16;
          if (r < treeP) o = z === Z.WILD ? (sp < 0.6 ? O.PINE : sp < 0.8 ? O.BIRCH : O.OAK) : (sp < 0.35 ? O.OAK : sp < 0.6 ? O.TREE : sp < 0.8 ? O.PINE : O.BIRCH);
          else if (r < treeP + 0.06) o = r2 < 0.22 ? O.BERRY : O.BUSH;
          else if (r < treeP + 0.17) o = O.FERN;
          else if (r < treeP + 0.19) o = r2 < 0.5 ? O.LOG : O.ROOTS;
          else if (r < treeP + 0.205) o = r2 < 0.4 ? O.SHROOMS : O.MUSHROOM;
          else if (r < treeP + 0.215) o = r2 < 0.5 ? O.BOULDER : O.ROCK;
          else if (r < treeP + 0.222) o = O.HERB;
          else if (r < treeP + 0.3) o = O.TALLGRASS; else o = O.NONE;
          if (dense) ground[i] = T.FOREST;
        }
      } else if (z === Z.FIELDS) {
        if (grove > 0.66) o = r < 0.28 ? (sp < 0.5 ? O.OAK : sp < 0.75 ? O.BIRCH : O.TREE) : r < 0.36 ? O.BUSH : r < 0.42 ? O.FERN : r < 0.45 ? O.BERRY : o;
        else if (r < 0.006) o = O.OAK; else if (r < 0.009) o = O.BOULDER; else if (r < 0.014) o = O.BERRY; else if (r < 0.017) o = O.HERB;
      } else if (z === Z.SWAMP) {
        let wet = false; for (const [dx, dy] of DIRS8) { const q = ground[idx(x + dx, y + dy)]; if (q === T.WATER || q === T.SHALLOW) wet = true; }
        if (wet && r < 0.08) o = O.WILLOW; else if (r < 0.008) o = O.WILLOW; else if (r < 0.032) o = O.HERB; else if (r < 0.06 && o === O.NONE) o = O.FERN;
      } else if (z === Z.BONES || z === Z.ORCS) { if (r < 0.006) o = O.BOULDER; }
      obj[i] = o;
    }
    // árvores e pedregulhos nunca encostados pelos lados (sempre dá para passar); nas diagonais pode
    for (let y = 1; y < MAP_H - 1; y++) for (let x = 1; x < MAP_W - 1; x++) { const i = idx(x, y); if (!TREES.has(obj[i]) && obj[i] !== O.BOULDER) continue; for (const [dx, dy] of [[1, 0], [0, 1]]) { const j = idx(x + dx, y + dy); if (TREES.has(obj[j]) || obj[j] === O.BOULDER) obj[j] = O.FERN; } }
    // riachos sinuosos com juncos nas margens
    for (let c = 0; c < 9; c++) {
      let x = 20 + Math.floor(R(c, 1, 960) * (MAP_W - 40)), y = 20 + Math.floor(R(c, 2, 960) * (MAP_H - 40)), a = R(c, 3, 960) * 6.28;
      for (let s = 0; s < 70; s++) {
        a += (vnoise(x / 6, y / 6, 961 + c) - 0.5) * 0.9; x += Math.cos(a); y += Math.sin(a);
        const X = Math.round(x), Y = Math.round(y); if (X < 3 || Y < 3 || X >= MAP_W - 3 || Y >= MAP_H - 3) break;
        const i = idx(X, Y), z = zone[i]; if (z === Z.VILLAGE || z === Z.OUTSKIRTS || ground[i] === T.CLIFF || ground[i] === T.WATER) break;
        ground[i] = T.SHALLOW; obj[i] = O.NONE;
        for (const [dx, dy] of DIRS8) { const j = idx(X + dx, Y + dy); if (ground[j] !== T.SHALLOW && ground[j] !== T.WATER && ground[j] !== T.CLIFF && R(X + dx, Y + dy, 962) < 0.25) obj[j] = O.REEDS; }
      }
    }
    // poças
    for (let c = 0; c < 70; c++) { const X = 10 + Math.floor(R(c, 4, 963) * (MAP_W - 20)), Y = 10 + Math.floor(R(c, 5, 963) * (MAP_H - 20)), z = zone[idx(X, Y)]; if (z !== Z.FOREST && z !== Z.FIELDS && z !== Z.SWAMP && z !== Z.WILD) continue; const rr = 0.8 + R(c, 6, 963) * 1.2; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const i = idx(X + dx, Y + dy); if (Math.hypot(dx, dy) <= rr && ground[i] !== T.CLIFF && ground[i] !== T.WATER) { ground[i] = T.SHALLOW; obj[i] = O.NONE; } } }
  }
  // árvores ao pé da montanha
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const i = idx(x, y);
    if (ground[i] === T.CLIFF || ground[i] === T.WATER || zone[i] === Z.VILLAGE) continue;
    const d = Math.hypot(x - MOUNTAIN.x, y - MOUNTAIN.y);
    if (d < MOUNTAIN.r + 4 && obj[i] === O.NONE && R(x, y, 50) < 0.12) obj[i] = R(x, y, 51) < 0.6 ? O.PINE : O.ROCK;
  }

  // ---- bastiões: acampamento, cripta, fortim em ruínas, poças, caverna ----
  for (const B of BASTIONS) {
    const Rr = B.r, toC = Math.atan2(CENTER - B.y, CENTER - B.x);
    for (let y = B.y - Rr - 3; y <= B.y + Rr + 3; y++) for (let x = B.x - Rr - 3; x <= B.x + Rr + 3; x++) {
      if (x < 1 || y < 1 || x >= MAP_W - 1 || y >= MAP_H - 1) continue;
      const i = idx(x, y), d = Math.hypot(x - B.x, y - B.y); if (d > Rr + 2.5) continue;
      if (B.kind === 'cave' && ground[i] === T.CLIFF) continue;   // não come a montanha
      height[i] = 0; obj[i] = O.NONE; river[i] = 0;
      const n = hash2(x, y, 901);
      ground[i] = B.kind === 'camp' ? (n < 0.7 ? T.DIRT : T.GRASS) : B.kind === 'crypt' ? (n < 0.55 ? T.DEAD : T.DIRT) : B.kind === 'fort' ? (n < 0.5 ? T.DIRT : n < 0.8 ? T.COBBLE : T.GRASS) : B.kind === 'pools' ? (n < 0.75 ? T.SWAMP : T.GRASS) : (n < 0.6 ? T.STONE : T.DIRT);
    }
    const put = (dx, dy, o) => { const x = B.x + dx, y = B.y + dy; if (x < 1 || y < 1 || x >= MAP_W - 1 || y >= MAP_H - 1) return; const i = idx(x, y); if (ground[i] !== T.WATER && ground[i] !== T.CLIFF) obj[i] = o; };
    const angGap = (a, c, w) => Math.abs(((a - c) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI) < w;
    // anel (paliçada / muro) com entrada virada para a cidade e outra nos fundos
    const ring = (rad, o, gapW, chance = 1, alt = O.NONE) => { for (let y = -rad - 1; y <= rad + 1; y++) for (let x = -rad - 1; x <= rad + 1; x++) { if (Math.abs(Math.hypot(x, y) - rad) > 0.5) continue; const a = Math.atan2(y, x); if (angGap(a, toC, gapW) || angGap(a, toC + Math.PI, gapW * 0.7)) continue; put(x, y, hash2(B.x + x, B.y + y, 905) < chance ? o : alt); } };
    const H = (dx, dy, s) => hash2(B.x + dx, B.y + dy, s);
    if (B.kind === 'camp') {
      ring(8, O.FENCE, 0.3); ring(10, O.SPIKES, 0.4, 0.3);
      for (const [x, y] of [[-4, -3], [3, -4], [-3, 4], [4, 3], [-5, 0]]) put(x, y, O.TENT);
      put(0, 0, O.CAMPFIRE); put(1, -2, O.BANNER); put(-1, 2, O.BANNER);
      for (const [x, y] of [[5, 0], [5, 1], [6, -1]]) put(x, y, O.CRATE); put(-2, -6, O.BARREL); put(0, -5, O.WEAPONRACK); put(2, 5, O.WEAPONRACK);
      for (let k = 0; k < 14; k++) { const x = Math.round((H(k, 1, 906) - 0.5) * 12), y = Math.round((H(k, 2, 906) - 0.5) * 12); if (Math.hypot(x, y) > 2 && Math.hypot(x, y) < 7 && obj[idx(B.x + x, B.y + y)] === O.NONE) put(x, y, O.BONES); }
    } else if (B.kind === 'crypt') {
      ring(8.5, O.LOWWALL, 0.3, 0.55, O.RUBBLE);
      for (let y = -7; y <= 7; y += 2) for (let x = -7; x <= 7; x += 2) { const d = Math.hypot(x, y); if (d < 3.6 || d > 7.4 || angGap(Math.atan2(y, x), toC, 0.35)) continue; put(x, y, H(x, y, 907) < 0.85 ? O.GRAVE : O.DEADTREE); }
      // mausoléu em ruínas: muro baixo 5x5 com entrada para a cidade, estátua no meio e braseiros na porta
      const hx = Math.abs(Math.cos(toC)) >= Math.abs(Math.sin(toC)), ex = hx ? Math.sign(Math.cos(toC)) * 2 : 0, ey = hx ? 0 : Math.sign(Math.sin(toC)) * 2;
      for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) { if (Math.max(Math.abs(x), Math.abs(y)) !== 2) continue; if ((Math.abs(ex) === 2 && x === ex && Math.abs(y) <= 0) || (Math.abs(ey) === 2 && y === ey && Math.abs(x) <= 0)) continue; put(x, y, O.LOWWALL); }
      put(0, 0, O.STATUE);
      const px = Math.abs(ex) === 2 ? ex + Math.sign(ex) : 0, py = Math.abs(ey) === 2 ? ey + Math.sign(ey) : 0;
      if (px) { put(px, -1, O.BRAZIER); put(px, 1, O.BRAZIER); } else { put(-1, py, O.BRAZIER); put(1, py, O.BRAZIER); }
    } else if (B.kind === 'fort') {
      ring(8, O.LOWWALL, 0.28, 0.8, O.RUBBLEBIG);
      for (const [x, y] of [[-3, -3], [3, -3], [0, 4], [-4, 2]]) put(x, y, O.TENT);
      put(0, 0, O.CAMPFIRE); put(0, -2, O.BANNER); put(-5, 1, O.WEAPONRACK); put(5, 1, O.WEAPONRACK); put(2, 5, O.DUMMY); put(3, 5, O.DUMMY);
      for (const [x, y] of [[4, -5], [5, -4]]) put(x, y, O.CRATE); for (const [x, y] of [[-4, -5], [-5, -4]]) put(x, y, O.BARREL); put(5, -1, O.CART);
      for (let k = 0; k < 10; k++) { const x = Math.round((H(k, 3, 908) - 0.5) * 14), y = Math.round((H(k, 4, 908) - 0.5) * 14); if (Math.hypot(x, y) > 2 && Math.hypot(x, y) < 7 && obj[idx(B.x + x, B.y + y)] === O.NONE) put(x, y, O.RUBBLE); }
    } else if (B.kind === 'pools') {
      for (const [px, py, pr] of [[-4, -2, 2], [3, -4, 1.6], [4, 3, 2], [-2, 4, 1.5]]) for (let y = -4; y <= 4; y++) for (let x = -4; x <= 4; x++) {
        const d = Math.hypot(x, y), X = B.x + px + x, Y = B.y + py + y, i = idx(X, Y);
        if (d <= pr) { ground[i] = T.WATER; obj[i] = H(px + x, py + y, 909) < 0.15 ? O.LILY : O.NONE; }
        else if (d <= pr + 1.3 && obj[i] === O.NONE && H(px + x, py + y, 910) < 0.4) obj[i] = O.REEDS;
      }
      for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2 + 0.3; put(Math.round(Math.cos(a) * 7.5), Math.round(Math.sin(a) * 7.5), H(k, 5, 911) < 0.6 ? O.DEADTREE : O.MUSHROOM); }
    } else if (B.kind === 'testcamp') {
      for (const [x, y] of [[-2, -2], [2, -1]]) put(x, y, O.TENT); put(0, 1, O.CAMPFIRE); put(-3, 1, O.CRATE); put(3, 2, O.BARREL);
    } else if (B.kind === 'dragon') {
      // ruínas de fortaleza queimada: mesa de rocha (nível 1) com escadaria larga, chão chamuscado, árvores carbonizadas,
      // restos de cavaleiros, estrada com estandartes e tochas; no topo, torre de vigia em ruínas, muros caídos e o ninho com o tesouro
      const PR = 5.5, BIG = Rr + 8;
      for (let y = -BIG; y <= BIG; y++) for (let x = -BIG; x <= BIG; x++) {
        const X = B.x + x, Y = B.y + y; if (X < 1 || Y < 1 || X >= MAP_W - 1 || Y >= MAP_H - 1) continue;
        const i = idx(X, Y), d = Math.hypot(x, y) + (hash2(X, Y, 913) - 0.5) * 0.8;
        if (d <= PR) { ground[i] = T.CLIFF; height[i] = 5; fl1[i] = 1; obj[i] = O.NONE; continue; }
        if (d > BIG || ground[i] === T.WATER) continue;
        height[i] = 0; river[i] = 0;
        const h = hash2(X, Y, 914), n = hash2(X, Y, 915);
        ground[i] = d < Rr + 2 ? (n < 0.55 ? T.DEAD : T.DIRT) : (n < 0.35 ? T.DEAD : n < 0.6 ? T.DIRT : ground[i]);   // chão chamuscado
        obj[i] = d < Rr ? (h < 0.08 ? O.BONES : h < 0.11 ? O.ARMORPILE : h < 0.15 ? O.RUBBLE : h < 0.18 ? O.ROCK : O.NONE)
          : (h < 0.09 ? O.DEADTREE : h < 0.12 ? O.BONES : h < 0.135 ? O.ARMORPILE : h < 0.16 ? O.ROCK : O.NONE);   // árvores carbonizadas
      }
      // topo: torre de vigia em ruínas no fundo, muros caídos, entulho e o ninho com o tesouro
      const back = toC + Math.PI, put1 = (dx, dy, o) => { const i = idx(B.x + dx, B.y + dy); if (ground[i] === T.CLIFF && fl1[i]) obj[i] = o; };
      put1(Math.round(Math.cos(back) * 3.5), Math.round(Math.sin(back) * 3.5), O.RUINTOWER);
      for (let k = -4; k <= 4; k++) { const a = back + k * 0.22; if (Math.abs(k) === 1) continue; const dx = Math.round(Math.cos(a) * 4.6), dy = Math.round(Math.sin(a) * 4.6); put1(dx, dy, hash2(dx, dy, 916) < 0.6 ? O.LOWWALL : O.RUBBLEBIG); }
      for (const [dx, dy] of [[1, 2], [-2, 1], [2, -2], [-1, -2]]) put1(dx, dy, hash2(dx, dy, 917) < 0.5 ? O.RUBBLE : O.BONES);
      put1(Math.round(Math.cos(back) * 1.5), Math.round(Math.sin(back) * 1.5), O.HOARD);
      put1(Math.round(Math.cos(back + 0.9) * 2), Math.round(Math.sin(back + 0.9) * 2), O.ARMORPILE);
      const sx = Math.abs(Math.cos(toC)) >= Math.abs(Math.sin(toC)) ? Math.sign(Math.cos(toC)) : 0, sy = sx ? 0 : Math.sign(Math.sin(toC));
      const sdir = sx > 0 ? 2 : sx < 0 ? 1 : sy > 0 ? 4 : 3;   // a rampa sobe em direção à mesa
      for (let j = 0; j < STAIR_N; j++) for (let q = -1; q <= 1; q++) {
        const X = B.x + sx * (6 + j) + sy * q, Y = B.y + sy * (6 + j) + sx * q, i = idx(X, Y);
        ground[i] = T.FLOORSTONE; height[i] = 0; obj[i] = O.STAIRS; stair[i] = sdir; stairK[i] = STAIR_N - 1 - j; fl1[i] = 3;
      }
      for (let q = -2; q <= 2; q++) { const X = B.x + sx * 5 + sy * q, Y = B.y + sy * 5 + sx * q, i = idx(X, Y); if (Math.abs(q) <= 1 && !(ground[i] === T.CLIFF)) { ground[i] = T.CLIFF; height[i] = 5; fl1[i] = 1; } if (ground[i] === T.CLIFF) obj[i] = O.NONE; }   // o topo encosta na escada
      // estrada de pedra até a escada, com estandartes rasgados e tochas dos dois lados
      for (let j = 6 + STAIR_N; j < 6 + STAIR_N + 18; j++) for (let q = -1; q <= 1; q++) {
        const X = B.x + sx * j + sy * q, Y = B.y + sy * j + sx * q; if (X < 1 || Y < 1 || X >= MAP_W - 1 || Y >= MAP_H - 1) continue; const i = idx(X, Y);
        if (ground[i] === T.WATER) continue; ground[i] = hash2(X, Y, 918) < 0.8 ? T.COBBLE : T.DIRT; obj[i] = O.NONE; height[i] = 0;
        for (const side of [-2, 2]) { if (q !== 0) continue; const k2 = idx(X + sy * side, Y + sx * side); if (ground[k2] === T.WATER) continue; obj[k2] = (j - 6 - STAIR_N) % 4 === 1 ? ((j >> 2) % 2 ? O.TORCH : O.BANNER) : obj[k2] === O.DEADTREE ? O.NONE : obj[k2]; }
      }
    } else if (B.kind === 'cave') {
      { const i = idx(CAVE_POS.x, CAVE_POS.y); ground[i] = T.STONE; height[i] = 0; obj[i] = O.CAVE; }
      for (let y = -Rr; y <= Rr; y++) for (let x = -Rr; x <= Rr; x++) { const d = Math.hypot(x, y), i = idx(B.x + x, B.y + y); if (d < 2 || d > Rr || obj[i] !== O.NONE || ground[i] === T.CLIFF) continue; const h = H(x, y, 912); obj[i] = h < 0.12 ? O.BONES : h < 0.17 ? O.ROCK : h < 0.2 ? O.RUBBLE : O.NONE; }
    }
  }

  const set = (x, y, g, o) => { const i = idx(x, y); if (g != null) ground[i] = g; if (o != null) obj[i] = o; };
  const inBox = (x, y, x0, y0, x1, y1) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
  const { x0, y0, x1, y1 } = CASTLE;
  const used = new Uint8Array(N);       // tiles reservados (ruas, praças, construções)
  const reserve = (ax, ay, bx, by) => { for (let y = ay; y <= by; y++) for (let x = ax; x <= bx; x++) if (inb(x, y)) used[idx(x, y)] = 1; };

  // área da cidade: limpa e cria o fosso
  for (let y = C - SAFE_R - 1; y <= C + SAFE_R + 2; y++) for (let x = C - SAFE_R - 1; x <= C + SAFE_R + 2; x++) {
    const i = idx(x, y);
    obj[i] = O.NONE; river[i] = 0;
    ground[i] = T.GRASS;
    if (inBox(x, y, x0 - 4, y0 - 4, x1 + 4, y1 + 4) && !inBox(x, y, x0 - 2, y0 - 2, x1 + 2, y1 + 2)) ground[i] = T.WATER; // fosso
  }

  // estradas: anel em volta do fosso + saídas para os 4 lados; portões só no sul (principal) e no norte
  const road = (x, y, dir, wide) => {
    if (!inb(x, y)) return;
    const i = idx(x, y);
    if (ground[i] === T.CLIFF) return;
    const wet = ground[i] === T.WATER || ground[i] === T.SHALLOW;
    ground[i] = wet ? T.BRIDGE : (zone[i] === Z.VILLAGE || zone[i] === Z.OUTSKIRTS ? T.COBBLE : T.DIRT);
    if (!wet && zone[i] === Z.OUTSKIRTS && (x + y) % 3 === 0 && !wide) ground[i] = T.DIRT;
    obj[i] = O.NONE; rdir[i] = dir;
  };
  const clearSide = (x, y) => { if (inb(x, y) && BLOCKING.has(obj[idx(x, y)])) obj[idx(x, y)] = O.NONE; };
  const RG = 7; // distância do anel à muralha
  for (let k = x0 - RG; k <= x1 + RG; k++) for (let w = 0; w < 2; w++) { road(k, y0 - RG + w, 1); road(k, y1 + RG - w, 1); road(x0 - RG + w, k, 2); road(x1 + RG - w, k, 2); }
  const lastLand = (sx, sy, dx, dy) => { let L = 0; for (let k = 0; k < 140; k++) { const x = sx + dx * k, y = sy + dy * k; if (!inb(x, y)) break; if (ground[idx(x, y)] !== T.WATER) L = k; } return L; };
  // sul: estrada larga (4) do portão principal até o mar
  { const L = lastLand(C, y1 + 1, 0, 1); for (let k = 1; k <= L; k++) for (let w = -1; w <= 2; w++) road(C + w, y1 + k, 2, 1); for (let k = 1; k <= L; k++) { clearSide(C - 2, y1 + k); clearSide(C + 3, y1 + k); } }
  // norte: portão secundário
  { const L = lastLand(C, y0 - 1, 0, -1); for (let k = 1; k <= L; k++) for (let w = 0; w <= 1; w++) road(C + w, y0 - k, 2); }
  // leste e oeste: saem do anel
  { const L = lastLand(x1 + RG, C, 1, 0); for (let k = 1; k <= L; k++) for (let w = 0; w <= 1; w++) road(x1 + RG + k, C + w, 1); }
  { const L = lastLand(x0 - RG, C, -1, 0); for (let k = 1; k <= L; k++) for (let w = 0; w <= 1; w++) road(x0 - RG - k, C + w, 1); }

  // chão da cidade: calçamento com canteiros de grama
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, vnoise(x / 5, y / 5, 610) > 0.7 ? T.GRASS : T.COBBLE, O.NONE);

  // ---- muralha externa, torres e portões ----
  const towers = [];
  const sideT = [-21, -11, 12, 22];
  towers.push([x0, y0], [x1 - 1, y0], [x0, y1 - 1], [x1 - 1, y1 - 1]);
  for (const t of sideT) { towers.push([C + t, y0], [C + t, y1 - 1], [x0, C + t], [x1 - 1, C + t]); }
  towers.push([C - 2, y0], [C + 2, y0]);                                   // portão norte (secundário)
  const gateTowers = [[C - 4, y1 - 1], [C + 3, y1 - 1]];                    // portão principal: torres altas
  towers.push(...gateTowers);
  const inTower = (x, y) => towers.some(([tx, ty]) => x >= tx && x <= tx + 1 && y >= ty && y <= ty + 1);
  const isGate = (x, y) => (y === y1 && x >= C - 1 && x <= C + 2) || (y === y0 && (x === C || x === C + 1));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (!(x === x0 || x === x1 || y === y0 || y === y1) || inTower(x, y)) continue;
    const i = idx(x, y);
    wdir[i] = y === y0 ? 4 : y === y1 ? 3 : x === x0 ? 2 : 1;
    if (isGate(x, y)) { set(x, y, T.FLOORSTONE, O.GATE); continue; }
    set(x, y, null, O.WALL); fl1[i] = 1;
  }
  const addGate = (gx0, gx1, gy, out, kind) => { const gi = gates.length; gates.push({ x0: gx0, x1: gx1, y: gy, out, kind }); for (let x = gx0; x <= gx1; x++) gateId[idx(x, gy)] = gi; };
  addGate(C - 1, C + 2, y1, 1, 'main'); addGate(C, C + 1, y0, -1, 'small');
  for (const [tx, ty] of towers) {
    for (let y = ty; y <= ty + 1; y++) for (let x = tx; x <= tx + 1; x++) { set(x, y, T.FLOORSTONE, O.PART); fl1[idx(x, y)] = 1; }
    obj[idx(tx + 1, ty + 1)] = O.TOWER;
    tvar[idx(tx + 1, ty + 1)] = Math.floor(R(tx, ty, 2) * 3);
    toff[idx(tx + 1, ty + 1)] = ((tx === x0 ? -1 : tx === x1 - 1 ? 1 : 0) + 1) * 3 + ((ty === y0 ? -1 : ty === y1 - 1 ? 1 : 0) + 1);
  }
  for (const [tx, ty] of gateTowers) { tvar[idx(tx + 1, ty + 1)] = 3; for (let y = ty; y <= ty + 1; y++) for (let x = tx; x <= tx + 1; x++) fl1[idx(x, y)] = 0; }
  reserve(x0, y0, x1, y0 + 1); reserve(x0, y1 - 1, x1, y1); reserve(x0, y0, x0 + 1, y1); reserve(x1 - 1, y0, x1, y1);

  // ---- castelo central (Hogwarts/Porto Real): muralha própria, salão no andar de cima ----
  const kt = [[KEEP.x0, KEEP.y0], [KEEP.x1 - 1, KEEP.y0], [KEEP.x0, KEEP.y1 - 1], [KEEP.x1 - 1, KEEP.y1 - 1], [C - 3, KEEP.y1 - 1], [C + 3, KEEP.y1 - 1], [KEEP.x0, C - 13], [KEEP.x1 - 1, C - 13]];
  const inKT = (x, y) => kt.some(([tx, ty]) => x >= tx && x <= tx + 1 && y >= ty && y <= ty + 1);
  for (let y = KEEP.y0; y <= KEEP.y1; y++) for (let x = KEEP.x0; x <= KEEP.x1; x++) {
    const i = idx(x, y), onWall = x === KEEP.x0 || x === KEEP.x1 || y === KEEP.y0 || y === KEEP.y1;
    set(x, y, vnoise(x / 3, y / 3, 620) > 0.62 ? T.GRASS : T.FLOORSTONE, O.NONE);
    if (inKT(x, y)) continue;
    if (onWall) {
      wdir[i] = y === KEEP.y0 ? 4 : y === KEEP.y1 ? 3 : x === KEEP.x0 ? 2 : 1;
      if (y === KEEP.y1 && (x === C || x === C + 1)) { set(x, y, T.FLOORSTONE, O.GATE); continue; }
      set(x, y, null, O.WALL);
    }
  }
  addGate(C, C + 1, KEEP.y1, 1, 'keep');
  for (const [tx, ty] of kt) {
    for (let y = ty; y <= ty + 1; y++) for (let x = tx; x <= tx + 1; x++) set(x, y, T.FLOORSTONE, O.PART);
    obj[idx(tx + 1, ty + 1)] = O.TOWER; tvar[idx(tx + 1, ty + 1)] = 3;
    toff[idx(tx + 1, ty + 1)] = ((tx === KEEP.x0 ? -1 : tx === KEEP.x1 - 1 ? 1 : 0) + 1) * 3 + ((ty === KEEP.y0 ? -1 : ty === KEEP.y1 - 1 ? 1 : 0) + 1);
  }
  reserve(KEEP.x0 - 2, KEEP.y0 - 2, KEEP.x1 + 2, KEEP.y1 + 2);

  // ---- escadas de 2 degraus (rampas) até a muralha ----
  // torres-escada 3x3 encostadas na muralha, porta virada para a cidade; por cima viram parte do caminho da muralha
  const stairTowers = [];   // torres-escada removidas por enquanto (pedido do jogador)
  for (const [tx, ty, door] of stairTowers) {
    BUILDINGS.push({ x: tx, y: ty, ...BH('stairtower', 3, 3, WALL_UNITS, 0, '', { door }) });
    for (let y = ty; y <= ty + 2; y++) for (let x = tx; x <= tx + 2; x++) { set(x, y, T.FLOORSTONE, O.NONE); fl1[idx(x, y)] = 1; }
    reserve(tx - 1, ty - 1, tx + 3, ty + 3);
  }

  // ---- ruas e praças da cidade ----
  const street = (ax, ay, bx, by) => { for (let y = ay; y <= by; y++) for (let x = ax; x <= bx; x++) { set(x, y, T.COBBLE, O.NONE); rdir[idx(x, y)] = bx - ax > by - ay ? 1 : 2; } reserve(ax, ay, bx, by); };
  street(C - 1, KEEP.y1 + 1, C + 2, y1 - 1);              // avenida real (portão principal -> castelo)
  street(C, y0 + 1, C + 1, KEEP.y0 - 1);                  // rua do portão norte
  street(KEEP.x0 - 2, KEEP.y0 - 2, KEEP.x1 + 2, KEEP.y0 - 1); street(KEEP.x0 - 2, KEEP.y1 + 1, KEEP.x1 + 2, KEEP.y1 + 2); // anel do castelo
  street(KEEP.x0 - 2, KEEP.y0, KEEP.x0 - 1, KEEP.y1); street(KEEP.x1 + 1, KEEP.y0, KEEP.x1 + 2, KEEP.y1);
  street(x0 + 2, C + 5, x1 - 2, C + 6);                    // rua do mercado (leste-oeste)
  street(C + 19, C - 20, C + 20, y1 - 3);                  // beco dos mercadores (estreito, como o Beco Diagonal)
  street(C - 7, C + 9, C + 8, C + 17);                     // praça do mercado
  street(x0 + 2, C - 16, KEEP.x0 - 3, C - 15);             // rua do templo
  street(C - 24, C - 20, C - 23, C + 5);
  street(C - 24, C + 19, C + 18, C + 20);                  // rua de baixo
  street(KEEP.x1 + 3, C - 24, x1 - 2, C - 23);
  for (const b of BUILDINGS) { const d = doorOf(b); reserve(Math.floor(d.x) - 1, b.y + b.h, Math.ceil(d.x) + 1, b.y + b.h + 1); }

  // ---- construções fixas + casas geradas (cidade densa, com vielas entre elas) ----
  // a casa não pode ficar sobre ruas nem outros prédios; a margem de 1 tile em volta pode ser rua (vira a calçada), mas não outro prédio
  // faixa estreita entre a muralha norte e o castelo: margem de 1 tile
  const freeNE = (ax, ay, w, h) => { for (let y = ay - 1; y <= ay + h; y++) for (let x = ax - 1; x <= ax + w; x++) { const inner = x >= ax && x < ax + w && y >= ay && y < ay + h; if (!inb(x, y) || bld[idx(x, y)] !== -1 || (used[idx(x, y)] && (inner || rdir[idx(x, y)] === 0))) return false; if (x <= x0 + 1 || x >= x1 - 1 || y <= y0 + 1) return false; } return true; };
  const free = (ax, ay, w, h, mgO) => { const mg = mgO || (ax < C - 10 ? 4 : 3); for (let y = ay - mg; y <= ay + h + mg - 1; y++) for (let x = ax - mg; x <= ax + w + mg - 1; x++) { const inner = x >= ax && x < ax + w && y >= ay && y < ay + h; if (!inb(x, y) || bld[idx(x, y)] !== -1 || (inner && used[idx(x, y)])) return false; if (x <= x0 + 1 || x >= x1 - 1 || y <= y0 + 1 || y >= y1 - 1) return false; } return true; };
  // os prédios fixos ocupam a área deles (+1 de margem) antes de sortear as casas
  for (const b of BUILDINGS) reserve(b.x - 1, b.y - 1, b.x + b.w, b.y + b.h);
  reserve(C - 22, C + 21, C - 12, C + 29);   // pracinha do bairro sul-oeste (poço, árvores e bancos)
  const houses = [];
  const roadDist = (px, py) => { let best = 99; for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) { const xx = Math.round(px) + dx, yy = Math.round(py) + dy; if (inb(xx, yy) && rdir[idx(xx, yy)] && bld[idx(xx, yy)] < 0) best = Math.min(best, Math.abs(dx) + Math.abs(dy)); } return best; };
  // 1ª rodada: cidade toda (até 12 casas); 2ª rodada: até 3 casas extras no lado oeste (canto superior esquerdo da tela)
  for (let k = 0, cap = 12; k < 20000; k++) {
    if (k === 12000) cap = houses.length + 3;
    if (k === 16000) cap = houses.length + 5;
    if (houses.length >= cap) { if (k < 12000) { k = 11999; continue; } if (k < 16000) { k = 15999; continue; } break; }
    const west = k >= 12000 && k < 16000, ne = k >= 16000;
    const x = ne ? C - 14 + Math.floor(R(k, 3, 700) * 34) : west ? x0 + 3 + Math.floor(R(k, 3, 700) * (C - 16 - x0)) : x0 + 3 + Math.floor(R(k, 3, 700) * (x1 - x0 - 10)), y = ne ? y0 + 2 + Math.floor(R(k, 4, 700) * 3) : west ? C - 24 + Math.floor(R(k, 4, 700) * 30) : y0 + 3 + Math.floor(R(k, 4, 700) * (y1 - y0 - 10));
    { const km = ne ? 1 : west ? 3 : 15; if (x + 6 > KEEP.x0 - km && x < KEEP.x1 + km && y + 6 > KEEP.y0 - km && y < KEEP.y1 + km) continue; }   // praça aberta em volta do castelo
    const sw = x < C - 4 && y > C + 12;   // bairro sul-oeste: no máximo 2 casas, bem espaçadas
    if (sw && houses.filter(hh => hh.x < C - 4 && hh.y > C + 12).length >= 2) continue;
    const nearKeep = x + 6 > KEEP.x0 - 19 && x < KEEP.x1 + 19 && y + 6 > KEEP.y0 - 19 && y < KEEP.y1 + 19, rr = R(k, 1, 700);
    const ai = nearKeep || rr < 0.55 ? Math.floor(R(k, 8, 700) * 4) : rr < 0.93 ? 4 + Math.floor(R(k, 8, 700) * 4) : 8 + Math.floor(R(k, 8, 700) * 2), T0 = HOUSE_TYPES[ai];
    let bestHb = null, bestD = 99;
    for (const door of ['S', 'N', 'E', 'W']) {
      const w = door === 'S' || door === 'N' ? T0.A : T0.D, h = door === 'S' || door === 'N' ? T0.D : T0.A;
      if (!(ne ? freeNE(x, y, w, h) : free(x, y, w, h, sw ? 5 : 0))) continue;
      const hb = { x, y, ...BH('house', w, h, T0.H, T0.RH, '', { v: T0.v, arch: ai, door, floors: T0.floors }) };
      { const [dtx, dty] = doorTile(hb), v = DOOR_V[door]; let okF = true; for (let q = 1; q <= 2; q++) { const fx = dtx + v[0] * q, fy = dty + v[1] * q; if (!inb(fx, fy) || bld[idx(fx, fy)] !== -1 || fx <= x0 + 1 || fx >= x1 - 1 || fy <= y0 + 1 || fy >= y1 - 1) okF = false; } if (!okF) continue; }
      const d0 = doorOf(hb), dd = roadDist(d0.x, d0.y);
      if (dd < bestD) { bestD = dd; bestHb = hb; }
    }
    if (!bestHb || bestD > (ne ? 40 : 9)) continue;
    const hb = bestHb, w = hb.w, h = hb.h;
    houses.push(hb);
    { const [dtx, dty] = doorTile(hb), v = DOOR_V[hb.door]; for (let q = 1; q <= 2; q++) used[idx(dtx + v[0] * q, dty + v[1] * q)] = 1; }
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) bld[idx(xx, yy)] = -2; // marcador temporário
  }
  BUILDINGS.push(...houses);
  BUILDINGS.forEach((b, bi) => {
    for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) { bld[idx(x, y)] = bi; obj[idx(x, y)] = O.NONE; ground[idx(x, y)] = T.COBBLE; }
  });

  // ---- interiores ----
  BUILDINGS.forEach((b, bi) => {
    const L = interiorLayout(b);
    for (const f of L.F) {
      placeFurniture(b, bi, f, obj, seats, idx);
    }
  });
  // ---- chão da cidade: pedra gasta, terra nas vielas, grama nos cantos, lajes na avenida ----
  for (let y = y0 + 2; y <= y1 - 2; y++) for (let x = x0 + 2; x <= x1 - 2; x++) {
    const i = idx(x, y);
    if (bld[i] >= 0 || fl1[i] || obj[i] === O.PART || obj[i] === O.GATE || obj[i] === O.STAIRS || inBox(x, y, KEEP.x0, KEEP.y0, KEEP.x1, KEEP.y1)) continue;
    const n = vnoise(x / 4, y / 4, 640), n2 = vnoise(x / 2.2, y / 2.2, 641);
    let nb = false; for (const [dx, dy] of DIRS8) if (bld[idx(x + dx, y + dy)] >= 0) nb = true;
    if (rdir[i] && Math.abs(x - C - 0.5) <= 2 && y > KEEP.y1) ground[i] = T.FLOORSTONE;              // avenida real em lajes
    else if (rdir[i]) ground[i] = n2 > 0.78 ? T.DIRT : T.COBBLE;
    else if (nb) ground[i] = n > 0.45 ? T.DIRT : n2 > 0.6 ? T.GRASS : T.COBBLE;                      // vielas entre casas
    else ground[i] = n > 0.62 ? T.GRASS : n > 0.42 ? T.DIRT : T.COBBLE;
    if (!rdir[i] && obj[i] === O.NONE && hash2(x, y, 642) < 0.05) obj[i] = O.RUBBLE;
  }
  // bancos ao ar livre também são assentos
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (obj[idx(x, y)] === O.BENCH) seats.push({ x, y, dir: 7, h: 0.45, bi: -1 });
  // ---- decoração ----
  const nearBld = (x, y) => { for (let yy = y - 1; yy <= y + 1; yy++) for (let xx = x - 1; xx <= x + 1; xx++) if (bld[idx(xx, yy)] >= 0) return true; return false; };
  // a frente de cada porta fica sempre livre
  const doorFree = new Set(); for (const b of BUILDINGS) { const [dx, dy] = doorTile(b), v = DOOR_V[b.door || 'S']; for (let k = 1; k <= 2; k++) for (const s2 of [-1, 0, 1]) doorFree.add(idx(dx + v[0] * k + (v[1] ? s2 : 0), dy + v[1] * k + (v[0] ? s2 : 0))); }
  const deco = (x, y, o) => { const i = idx(x, y); if (doorFree.has(i)) return; if (bld[i] < 0 && !stair[i] && !fl1[i] && !nearBld(x, y)) obj[i] = o; };
  const decoAny = (x, y, o) => { const i = idx(x, y); if (doorFree.has(i)) return; if (bld[i] < 0 && !stair[i] && !fl1[i]) obj[i] = o; };
  // praça do mercado
  decoAny(C, C + 13, O.FOUNTAIN);
  for (const [dx, dy] of [[-6, 10], [-3, 10], [5, 10], [7, 10], [-6, 16], [-3, 16], [5, 16], [7, 16]]) decoAny(C + dx, C + dy, O.STALL);
  for (const [dx, dy] of [[-3, 12], [4, 12], [-3, 14], [4, 14]]) decoAny(C + dx, C + dy, O.BENCH);
  for (const [dx, dy] of [[-7, 12], [8, 13], [-7, 17], [8, 17]]) decoAny(C + dx, C + dy, (dx + dy) % 2 ? O.BARREL : O.CRATE);
  decoAny(C - 6, C + 14, O.CART);
  // avenida real: postes de luz, estandartes e estátuas na frente do castelo
  for (let y = KEEP.y1 + 4; y < y1 - 2; y += 5) { decoAny(C - 2, y, O.LAMP); decoAny(C + 3, y, O.LAMP); }
  decoAny(C - 3, KEEP.y1 + 2, O.STATUE); decoAny(C + 4, KEEP.y1 + 2, O.STATUE);
  decoAny(C - 1, KEEP.y1 + 1, O.BRAZIER); decoAny(C + 2, KEEP.y1 + 1, O.BRAZIER);
  decoAny(C - 2, y1 - 2, O.BRAZIER); decoAny(C + 3, y1 - 2, O.BRAZIER);
  decoAny(C - 1, y0 + 1, O.BRAZIER); decoAny(C + 2, y0 + 1, O.BRAZIER);
  for (let y = C - 18; y < y1 - 4; y += 6) { decoAny(C + 18, y, O.LAMP); decoAny(C + 21, y + 3, O.LAMP); }
  for (let x = x0 + 5; x < x1 - 4; x += 7) { if (Math.abs(x - C) > 4) { decoAny(x, C + 4, O.LAMP); } }
  // bandeiras do castelo e pátio interno
  for (const x of [KEEP.x0 + 4, KEEP.x1 - 4]) decoAny(x, KEEP.y1 + 2, O.BANNER);
  // pracinha do sul-oeste
  { const px = C - 17, py = C + 25; for (let yy = py - 3; yy <= py + 3; yy++) for (let xx = px - 4; xx <= px + 4; xx++) { const i = idx(xx, yy); if (bld[i] < 0 && !BLOCKING.has(obj[i])) { obj[i] = O.NONE; if (Math.hypot(xx - px, (yy - py) * 1.3) < 3.2) ground[i] = T.COBBLE; } }
    for (const [x, y, o] of [[px, py, O.WELL], [px - 3, py - 2, O.TREE], [px + 3, py + 2, O.TREE], [px - 2, py + 2, O.BENCH], [px + 2, py - 2, O.BENCH], [px + 3, py - 1, O.FLOWERBED], [px - 3, py + 1, O.FLOWERBED], [px, py - 3, O.LAMP], [px, py + 3, O.LAMP]]) decoAny(x, y, o); }
  // cadafalso com guilhotina: em frente ao castelo, à esquerda da porta, diante da estátua e do estandarte (tablado 3x3 + 1 tile livre para a escada)
  { let best = null;
    for (let r = 0; r < 7 && !best; r++) for (let dy = -r; dy <= r && !best; dy++) for (let dx = -r; dx <= r && !best; dx++) {
      const cx = C - 7 + dx, cy = KEEP.y1 + 5 + dy; let ok = true;
      for (let yy = cy - 1; yy <= cy + 2 && ok; yy++) for (let xx = cx - 1; xx <= cx + 1 && ok; xx++) { const i = idx(xx, yy); if (bld[i] !== -1 || BLOCKING.has(obj[i]) || ground[i] === T.WATER || rdir[i] && yy > cy + 1) ok = false; }
      if (ok) best = [cx, cy];
    }
    if (best) { const [cx, cy] = best; for (let yy = cy - 1; yy <= cy + 1; yy++) for (let xx = cx - 1; xx <= cx + 1; xx++) obj[idx(xx, yy)] = O.STAGEFLOOR; obj[idx(cx, cy)] = O.GUILLOTINE; obj[idx(cx, cy + 2)] = O.NONE; STAGE.x = cx; STAGE.y = cy; } }
  for (const [x, y, o] of [[C - 4, KEEP.y1 - 3, O.FLOWERBED], [C + 5, KEEP.y1 - 3, O.FLOWERBED], [C - 1, KEEP.y1 - 2, O.BRAZIER], [C + 2, KEEP.y1 - 2, O.BRAZIER], [C - 6, KEEP.y1 - 2, O.BENCH], [C + 7, KEEP.y1 - 2, O.BENCH], [C - 4, KEEP.y1 - 6, O.STATUE], [C + 5, KEEP.y1 - 6, O.STATUE]]) decoAny(x, y, o);
  // catedral: cemitério e jardim
  const T0 = BUILDINGS[0];
  for (let k = 0; k < 12; k++) { const gx = T0.x + [0, 1, 2, 6, 7, 8][k % 6], gy = T0.y + T0.h + 2 + Math.floor(k / 6) * 2; deco(gx, gy, O.GRAVE); }
  deco(T0.x - 1, T0.y + T0.h + 2, O.TREE); deco(T0.x + T0.w + 1, T0.y + 2, O.TREE);
  // forja, quartel, estábulo, taverna
  const sm = BUILDINGS[2]; decoAny(sm.x - 1, sm.y + sm.h + 1, O.ANVIL); decoAny(sm.x + sm.w, sm.y + sm.h + 1, O.WEAPONRACK); decoAny(sm.x + sm.w, sm.y + 1, O.BARREL);
  const bk = BUILDINGS[4]; for (let k = 0; k < 4; k++) decoAny(bk.x + 1 + k * 2, bk.y + bk.h + 3, O.DUMMY); decoAny(bk.x + bk.w, bk.y + bk.h + 1, O.WEAPONRACK);
  const st = BUILDINGS[5]; decoAny(st.x + st.w + 1, st.y, O.HAY); decoAny(st.x + st.w + 1, st.y + 2, O.HAY); decoAny(st.x, st.y + st.h + 2, O.CART);
  for (let k = 0; k < 4; k++) decoAny(st.x - 1 + k * 2, st.y - 2, O.FENCE);
  const tv = BUILDINGS[3]; decoAny(tv.x - 1, tv.y + tv.h + 1, O.TABLE); decoAny(tv.x + tv.w, tv.y + tv.h + 1, O.TABLE); decoAny(tv.x + tv.w, tv.y + 1, O.BARREL); decoAny(tv.x + tv.w, tv.y + 2, O.BARREL);
  // beco: caixas, barris e lampiões junto às lojas
  for (let k = 0; k < 10; k++) { const y = C - 18 + k * 5; decoAny(C + 18, y + 1, k % 2 ? O.BARREL : O.CRATE); }
  // poços e árvores nos bairros
  for (const [dx, dy] of [[-18, -6], [24, -18], [-20, 14], [27, 26]]) decoAny(C + dx, C + dy, O.WELL);
  for (let k = 0; k < 160; k++) {
    const x = x0 + 3 + Math.floor(R(k, 1, 900) * (x1 - x0 - 5)), y = y0 + 3 + Math.floor(R(k, 2, 900) * (y1 - y0 - 5)), i = idx(x, y);
    if (used[i] || bld[i] >= 0 || obj[i] !== O.NONE || nearBld(x, y) || fl1[i] || doorFree.has(i)) continue;
    const r = R(k, 3, 900);
    if (ground[i] === T.GRASS) obj[i] = r < 0.25 ? O.TREE : r < 0.4 ? O.BUSH : r < 0.7 ? O.FLOWER : O.TALLGRASS;
    else if (r < 0.06) obj[i] = O.BARREL;
  }
  // tochas na estrada fora dos portões
  for (const [x, y] of [[C - 2, y1 + 6], [C + 3, y1 + 6], [C - 2, y1 + 14], [C + 3, y1 + 14], [C - 1, y0 - 6], [C + 2, y0 - 6]]) if (ground[idx(x, y)] !== T.WATER) set(x, y, null, O.TORCH);
  // arredores: bosques e flores perto do fosso
  for (let y = C - SAFE_R - 1; y <= C + SAFE_R + 2; y++) for (let x = C - SAFE_R - 1; x <= C + SAFE_R + 2; x++) {
    const i = idx(x, y);
    if (inBox(x, y, x0 - 4, y0 - 4, x1 + 4, y1 + 4) || ground[i] !== T.GRASS || obj[i] !== O.NONE) continue;
    const r = R(x, y, 77);
    obj[i] = r < 0.025 ? O.TREE : r < 0.05 ? O.BUSH : r < 0.15 ? O.TALLGRASS : r < 0.22 ? O.FLOWER : O.NONE;
  }
  for (const n of NPCS) obj[idx(Math.round(n.x), Math.round(n.y))] = O.NONE;
  { const fr = NPCS.find(n => n.id === 'fruit'); if (fr) for (const [dx, dy] of [[1, -1], [-1, -1], [1, 1], [-1, 1], [2, -1]]) { const x = fr.stall[0] + dx, y = fr.stall[1] + dy, i = idx(x, y); if (bld[i] < 0 && obj[i] === O.NONE && !(x === Math.round(fr.x) && y === Math.round(fr.y))) { obj[i] = O.STOOL; FRUIT_STOOL.x = x; FRUIT_STOOL.y = y; break; } } }
  for (let k = seats.length - 1; k >= 0; k--) if (seats[k].bi < 0) seats.splice(k, 1);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (obj[idx(x, y)] === O.BENCH) seats.push({ x, y, dir: 7, h: 0.45, bi: -1 });

  return { ground, obj, zone, bld, fl1, stair, stairK, tvar, toff, rdir, wdir, gateId, gates, seats, height, flow, river };
}

// mobília -> obstáculos (PART) e assentos, no quadro do mundo
function placeFurniture(b, bi, f, obj, seats, idx) {
  if (f.t === 'stairup' || f.t === 'stairdown') return;
  if (f.t === 'stove') { const [x, y] = bLocal(b, f.i, f.j); KITCHENS.push({ x, y, bi }); }
  if (f.t === 'bed') { const [px, py] = bLocal(b, f.i + (f.w - 1) / 2, f.j), [fx, fy] = bLocal(b, f.i + (f.w - 1) / 2, f.j + f.h - 1); BEDS.push({ x: (px + fx) / 2, y: (py + fy) / 2, dx: fx - px, dy: fy - py, bi }); }
  for (let a = 0; a < f.w; a++) for (let c = 0; c < f.h; c++) { const [x, y] = bLocal(b, f.i + a, f.j + c); if (f.block) obj[idx(x, y)] = O.PART; }
  if (!f.seat) return;
  const dir = bDir(b, f.seat);
  if (f.t === 'pew') for (let a = 0; a < f.w; a++) { const [x, y] = bLocal(b, f.i + a, f.j); seats.push({ x, y, dir, h: 0.45, bi }); }
  else { const [x0, y0] = bLocal(b, f.i, f.j), [x1, y1] = bLocal(b, f.i + f.w - 1, f.j + f.h - 1); seats.push({ x: (x0 + x1) / 2, y: (y0 + y1) / 2, dir, h: f.t === 'throne' ? 0.6 : 0.45, bi }); }
}
// ---------- gerador do bairro de teste ----------
function generateDistrict() {
  const N = MAP_W * MAP_H;
  const ground = new Uint8Array(N).fill(T.GRASS), obj = new Uint8Array(N), zone = new Uint8Array(N);
  const bld = new Int16Array(N).fill(-1), fl1 = new Uint8Array(N), stair = new Uint8Array(N), stairK = new Uint8Array(N);
  const tvar = new Uint8Array(N), toff = new Uint8Array(N).fill(4), rdir = new Uint8Array(N), wdir = new Uint8Array(N), gateId = new Int8Array(N).fill(-1);
  const height = new Uint8Array(N), flow = new Float32Array(N * 2), river = new Uint8Array(N);
  const gates = [], seats = [];
  const idx = (x, y) => y * MAP_W + x, R = (x, y, s) => hash2(x, y, s);
  const WY = 17;                                     // linha da muralha
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const i = idx(x, y);
    zone[i] = y < 14 ? Z.FIELDS : Z.VILLAGE;
    if (x < 3 || y < 2 || x > MAP_W - 4 || y > MAP_H - 4) ground[i] = T.WATER;
    else if (y === 14 || y === 15) ground[i] = x >= 38 && x <= 41 ? T.BRIDGE : T.WATER;   // fosso e ponte
    else if (y > WY) ground[i] = vnoise(x / 4, y / 4, 700) > 0.62 ? T.DIRT : T.GRASS;
    else if (y < 14 && vnoise(x / 6, y / 6, 701) > 0.66) ground[i] = T.FOREST;
    if (ground[i] === T.BRIDGE) rdir[i] = 2;
  }
  const street = (ax, ay, bx, by, dir, g = T.COBBLE) => { for (let y = ay; y <= by; y++) for (let x = ax; x <= bx; x++) { ground[idx(x, y)] = g; rdir[idx(x, y)] = dir; } };
  street(38, 2, 41, 13, 2, T.DIRT);                  // estrada lá fora
  street(38, WY + 1, 41, 39, 2);                     // rua principal (portão -> praça)
  street(14, 30, 66, 31, 1);                         // rua das lanternas
  street(29, 40, 51, 54, 1);                         // praça
  for (let y = 41; y <= 53; y++) for (let x = 30; x <= 50; x++) if ((x + y) % 7 === 0 && vnoise(x / 3, y / 3, 702) > 0.5) ground[idx(x, y)] = T.FLOORSTONE;
  // muralha norte, torres e portão
  for (let x = 8; x <= 72; x++) { const i = idx(x, WY); obj[i] = O.WALL; fl1[i] = 1; wdir[i] = 4; ground[i] = T.FLOORSTONE; }
  const tower = (tx, ty, v, walk) => { for (let y = ty; y <= ty + 1; y++) for (let x = tx; x <= tx + 1; x++) { const i = idx(x, y); obj[i] = O.PART; fl1[i] = walk ? 1 : 0; ground[i] = T.FLOORSTONE; } const a = idx(tx + 1, ty + 1); obj[a] = O.TOWER; tvar[a] = v; toff[a] = (1) * 3 + 0; };
  tower(7, WY, 0, 1); tower(72, WY, 1, 1); tower(22, WY, 2, 1);
  tower(36, WY, 3, 0); tower(42, WY, 3, 0);          // torres altas do portão
  for (let x = 38; x <= 41; x++) { const i = idx(x, WY); obj[i] = O.GATE; fl1[i] = 0; gateId[i] = 0; }
  gates.push({ x0: 38, x1: 41, y: WY, out: -1, kind: 'main' });
  // construções
  BUILDINGS.forEach((b, bi) => { for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) { bld[idx(x, y)] = bi; obj[idx(x, y)] = O.NONE; ground[idx(x, y)] = T.COBBLE; } });
  // torre-escada: rampa no meio, laterais fechadas, sobe até a muralha
  BUILDINGS.forEach((b, bi) => {
    if (b.kind !== 'stairtower') return;
    const cx = b.x + 1;
    for (let j = 0; j < b.h; j++) { for (const x of [b.x, b.x + 2]) obj[idx(x, b.y + j)] = O.PART; }
    for (let j = 0; j < STAIR_N; j++) { const i = idx(cx, b.y + j); obj[i] = O.STAIRS; stair[i] = 4; stairK[i] = STAIR_N - 1 - j; fl1[i] = 3; ground[i] = T.FLOORSTONE; }
  });
  // mobília e assentos
  BUILDINGS.forEach((b, bi) => { const L = interiorLayout(b); for (const f of L.F) placeFurniture(b, bi, f, obj, seats, idx); });
  // decoração
  const put = (x, y, o) => { const i = idx(x, y); if (bld[i] < 0 && !fl1[i] && !stair[i]) obj[i] = o; };
  put(40, 47, O.FOUNTAIN);
  for (const [x, y] of [[32, 42], [48, 42], [32, 52], [48, 52]]) put(x, y, O.STALL);
  for (const [x, y] of [[37, 46], [43, 46], [37, 49], [43, 49]]) put(x, y, O.BENCH);
  for (const [x, y] of [[30, 41], [50, 41], [30, 53], [50, 53]]) put(x, y, O.TREE);
  for (let x = 16; x <= 64; x += 6) { put(x, 29, O.LAMP); put(x + 3, 32, O.LAMP); }
  for (let y = 20; y <= 38; y += 6) { put(37, y, O.LAMP); put(42, y + 3, O.LAMP); }
  put(36, 21, O.BRAZIER); put(43, 21, O.BRAZIER); put(34, 44, O.BARREL); put(46, 50, O.CRATE); put(33, 48, O.CART);
  put(20, 24, O.WELL); put(60, 26, O.TREE); put(18, 36, O.TREE); put(62, 36, O.TREE); put(52, 29, O.BANNER); put(28, 29, O.BANNER);
  for (let k = 0; k < 120; k++) { const x = 4 + Math.floor(R(k, 1, 703) * 72), y = 3 + Math.floor(R(k, 2, 703) * 10), i = idx(x, y); if (ground[i] === T.WATER || rdir[i]) continue; const r2 = R(k, 3, 703); obj[i] = r2 < 0.18 ? O.TREE : r2 < 0.3 ? O.BUSH : r2 < 0.38 ? O.ROCK : O.TALLGRASS; }
  for (let k = 0; k < 60; k++) { const x = 10 + Math.floor(R(k, 4, 704) * 60), y = WY + 3 + Math.floor(R(k, 5, 704) * 50), i = idx(x, y); if (ground[i] !== T.GRASS || obj[i] || bld[i] >= 0) continue; let near = false; for (const [dx, dy] of DIRS8) if (bld[idx(x + dx, y + dy)] >= 0) near = true; if (!near) obj[i] = R(k, 6, 704) < 0.5 ? O.FLOWER : O.TALLGRASS; }
  for (const n of NPCS) obj[idx(Math.round(n.x), Math.round(n.y))] = O.NONE;
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) if (obj[idx(x, y)] === O.BENCH) seats.push({ x, y, dir: 7, h: 0.45, bi: -1 });
  return { ground, obj, zone, bld, fl1, stair, stairK, tvar, toff, rdir, wdir, gateId, gates, seats, height, flow, river };
}
const WORLD = TEST3D ? generateDistrict() : generateWorld();
// o carrasco fica ao lado do cadafalso, perto da alavanca
if (STAGE.x >= 0) { const ex = NPCS.find(n => n.id === 'executioner'); if (ex) { const c = [[2, 0.6], [2, -0.6], [-2, 0.6], [0.6, 2]].find(([dx, dy]) => !BLOCKING.has(WORLD.obj[Math.round(STAGE.y + dy) * MAP_W + Math.round(STAGE.x + dx)])) || [2, 0.6]; ex.x = STAGE.x + c[0]; ex.y = STAGE.y + c[1]; } }
const NPC_AT = new Set(NPCS.map(n => Math.round(n.y) * MAP_W + Math.round(n.x)));

function inBounds(x, y) { return x >= 0 && y >= 0 && x < MAP_W && y < MAP_H; }
// tile (inteiro) andável no andar z
function walkableTile(x, y, z = 0) {
  if (!inBounds(x, y)) return false;
  const i = y * MAP_W + x;
  if (z === 1) return WORLD.fl1[i] > 0;
  const g = WORLD.ground[i];
  return g !== T.WATER && g !== T.CLIFF && !BLOCKING.has(WORLD.obj[i]) && !NPC_AT.has(i);
}
// objetos redondos: colidem só no tamanho real (círculo), não no tile inteiro
const OBJ_R = { [O.TREE]: 0.38, [O.PINE]: 0.34, [O.OAK]: 0.44, [O.BIRCH]: 0.26, [O.WILLOW]: 0.4, [O.ROCK]: 0.34, [O.STUMP]: 0.24, [O.DEADTREE]: 0.3, [O.GRAVE]: 0.28, [O.CAMPFIRE]: 0.3,
  [O.BARREL]: 0.28, [O.CRATE]: 0.32, [O.HOARD]: 0.5, [O.HAY]: 0.38, [O.BRAZIER]: 0.24, [O.DUMMY]: 0.22, [O.STATUE]: 0.4, [O.ANVIL]: 0.3, [O.WEAPONRACK]: 0.32, [O.WELL]: 0.46 };
function solidTile(x, y, L) {
  if (!inBounds(x, y)) return true;
  const i = y * MAP_W + x;
  const g = WORLD.ground[i], o = WORLD.obj[i];
  if (L === 1) return !(WORLD.fl1[i] > 0) || (g === T.CLIFF && BLOCKING.has(o) && !OBJ_R[o]);
  return g === T.WATER || g === T.CLIFF || (BLOCKING.has(o) && !OBJ_R[o]);
}
function roundHit(x, y, r, top = false) {
  const tx = Math.round(x), ty = Math.round(y);
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const xx = tx + dx, yy = ty + dy; if (!inBounds(xx, yy)) continue;
    const i = yy * MAP_W + xx; if ((WORLD.ground[i] === T.CLIFF && WORLD.fl1[i] > 0) !== top) continue;
    const rr = OBJ_R[WORLD.obj[i]] || (NPC_AT.has(i) ? 0.3 : 0);
    if (rr && (x - xx) * (x - xx) + (y - yy) * (y - yy) < (rr + r) * (rr + r)) return true;
  }
  return false;
}
// posição livre (contínua) — testa um círculo de raio r
// paredes das construções (finas), com abertura na porta
function wallHit(x, y, r) {
  const tx = Math.round(x), ty = Math.round(y);
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!inBounds(tx + dx, ty + dy)) continue;
    const bi = WORLD.bld[(ty + dy) * MAP_W + tx + dx]; if (bi < 0) continue;
    const b = BUILDINGS[bi], X0 = b.x - 0.5, X1 = X0 + b.w, Y0 = b.y - 0.5, Y1 = Y0 + b.h, t = 0.12;
    if (x < X0 - r - t || x > X1 + r + t || y < Y0 - r - t || y > Y1 + r + t) continue;
    const s = b.door || 'S', [dtx, dty] = doorTile(b), gap = 0.62 - r;
    const nL = Math.abs(x - X0) < r + t, nR = Math.abs(x - X1) < r + t, nT = Math.abs(y - Y0) < r + t, nB = Math.abs(y - Y1) < r + t;
    if (nL && !(s === 'W' && Math.abs(y - dty) <= gap)) return true;
    if (nR && !(s === 'E' && Math.abs(y - dty) <= gap)) return true;
    if (nT && !(s === 'N' && Math.abs(x - dtx) <= gap)) return true;
    if (nB && !(s === 'S' && Math.abs(x - dtx) <= gap)) return true;
  }
  return false;
}
// passagem entre dois tiles vizinhos (para o caminho do clique): só entra/sai de construção pela porta
function edgeOk(ax, ay, bx, by) {
  const B = (x, y) => WORLD.bld[y * MAP_W + x];
  const a = B(ax, ay), c = B(bx, by);
  if (ax !== bx && ay !== by) return a === c && B(ax, by) === a && B(bx, ay) === a;
  if (a === c) return true;
  const inB = a >= 0 ? a : c, ix = a >= 0 ? ax : bx, iy = a >= 0 ? ay : by, ox = a >= 0 ? bx : ax, oy = a >= 0 ? by : ay;
  if (a >= 0 && c >= 0) return false;
  const b = BUILDINGS[inB], [dtx, dty] = doorTile(b), v = DOOR_V[b.door || 'S'];
  return ix === dtx && iy === dty && ox === ix + v[0] && oy === iy + v[1];
}
// andares de cima: só dentro do prédio, sem móveis, paredes fechadas (sem porta)
const FLOOR_BLOCK = new Map();
function floorBlocked(bi, fl) {
  const k = bi * 4 + fl; let s = FLOOR_BLOCK.get(k); if (s) return s;
  s = new Set(); const b = BUILDINGS[bi];
  for (const f of interiorLayout(b, fl).F) if (f.block) for (let a = 0; a < f.w; a++) for (let c = 0; c < f.h; c++) { const [x, y] = bLocal(b, f.i + a, f.j + c); s.add(y * MAP_W + x); }
  FLOOR_BLOCK.set(k, s); return s;
}
function canStandFloor(x, y, bi, fl, r = 0.24) {
  const b = BUILDINGS[bi]; if (!b) return false;
  const t = 0.14, X0 = b.x - 0.5 + t + r, X1 = b.x - 0.5 + b.w - t - r, Y0 = b.y - 0.5 + t + r, Y1 = b.y - 0.5 + b.h - t - r;
  if (x < X0 || x > X1 || y < Y0 || y > Y1) return false;
  const bl = floorBlocked(bi, fl);
  for (const [ox, oy] of [[-r, -r], [r, -r], [-r, r], [r, r]]) if (bl.has(Math.round(y + oy) * MAP_W + Math.round(x + ox))) return false;
  return true;
}
// tile da escada (mundo) e chegada (na frente dela)
// escada entre o andar f e f+1 em coordenadas do mundo
function stairWorld(b, f) { const s = stairSpec(b, f), w = p => bLocal(b, p[0], p[1]); return { L: w(s.L), U: w(s.U), entry: w(s.entry), arrive: w(s.arrive) }; }
function stairTile(b, f) { return stairWorld(b, f).L; }
function stairArrive(b, f, up = true) { const s = stairWorld(b, f); return up ? s.arrive : s.entry; }
function canStand(x, y, z = 0, r = 0.28) {
  if (z === 0 && (wallHit(x, y, r) || roundHit(x, y, r))) return false;
  for (const [ox, oy] of [[-r, -r], [r, -r], [-r, r], [r, r]]) if (solidTile(Math.round(x + ox), Math.round(y + oy), z)) return false;
  return true;
}
function zoneAt(x, y) { x = Math.round(x); y = Math.round(y); return inBounds(x, y) ? WORLD.zone[y * MAP_W + x] : Z.WILD; }
function inSafe(x, y) { return zoneAt(x, y) === Z.VILLAGE; }
function tileAt(x, y) { return Math.round(y) * MAP_W + Math.round(x); }
// telhado/andar acima? (para esconder o andar 1 quando o jogador está embaixo)
function covered(x, y) { const i = tileAt(x, y); return WORLD.fl1[i] > 0; }
function bldAt(x, y) { const tx = Math.round(x), ty = Math.round(y); if (!inBounds(tx, ty)) return -1; const bi = WORLD.bld[ty * MAP_W + tx]; if (bi < 0) return -1; const b = BUILDINGS[bi]; return x > b.x - 0.5 && x < b.x + b.w - 0.5 && y > b.y - 0.5 && y < b.y + b.h - 0.5 ? bi : -1; }

// tiles alcançáveis a partir do templo (monstros só nascem nesses)
const REACH = (() => {
  const sx0 = Math.round(TEMPLE_SPAWN.x), sy0 = Math.round(TEMPLE_SPAWN.y), r = new Uint8Array(MAP_W * MAP_H), q = [[sx0, sy0]];
  r[sy0 * MAP_W + sx0] = 1;
  for (let i = 0; i < q.length; i++) {
    const [x, y] = q[i];
    for (const [dx, dy] of DIRS8) {
      const nx = x + dx, ny = y + dy;
      if (walkableTile(nx, ny) && !r[ny * MAP_W + nx]) { r[ny * MAP_W + nx] = 1; q.push([nx, ny]); }
    }
  }
  return r;
})();

// ---------- escadas fluidas (rampas) ----------
// altura (0..1 andar) numa rampa, conforme a posição; -1 se não for escada
function stairH(x, y) {
  const tx = Math.round(x), ty = Math.round(y);
  if (!inBounds(tx, ty)) return -1;
  const d = WORLD.stair[ty * MAP_W + tx];
  if (!d) return -1;
  const along = d === 1 ? x - tx : d === 2 ? tx - x : d === 3 ? y - ty : ty - y;
  return clamp((WORLD.stairK[ty * MAP_W + tx] + 0.5 + along) / STAIR_N, 0, 1);
}
// posição livre para quem está na altura z (contínua, 0..1)
function canStandZ(x, y, z, r = 0.24, fl = 0, fb = -1) {
  if (fl > 0 && fb >= 0) return canStandFloor(x, y, fb, fl, r);
  const h0 = stairH(x, y);
  if (h0 >= 0) return Math.abs(h0 - z) <= 0.4; // em cima da rampa só importa a altura
  const L = z >= 0.5 ? 1 : 0;
  for (const [ox, oy] of [[-r, -r], [r, -r], [-r, r], [r, r]]) {
    const tx = Math.round(x + ox), ty = Math.round(y + oy);
    if (!inBounds(tx, ty)) return false;
    const i = ty * MAP_W + tx;
    if (WORLD.stair[i]) continue;
    if (solidTile(tx, ty, L)) return false;
  }
  if (L === 0 && (wallHit(x, y, r) || roundHit(x, y, r))) return false;
  if (L === 1 && roundHit(x, y, r, true)) return false;
  const h = stairH(x, y);
  if (h >= 0 && Math.abs(h - z) > 0.4) return false; // não entra na rampa pela lateral
  return true;
}
// altura resultante depois de andar até (x, y)
function heightAt(x, y, z) { const h = stairH(x, y); return h >= 0 ? h : (z >= 0.5 ? 1 : 0); }
