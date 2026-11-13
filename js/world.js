// ============================================================
//  MUNDO — mapa gerado por código (igual para todos: usa sempre a
//  mesma semente). Tem 2 andares: 0 = chão, 1 = muralhas/torres.
// ============================================================
const MAP_W = 256, MAP_H = 256, CENTER = 128, SAFE_R = 38;
const C = CENTER;

const T = { WATER: 0, SAND: 1, GRASS: 2, FOREST: 3, STONE: 4, DIRT: 5, BRIDGE: 6, COBBLE: 7, SWAMP: 8, DEAD: 9, SHALLOW: 10, CLIFF: 11, FLOORSTONE: 12 };
const O = {
  NONE: 0, TREE: 1, PINE: 2, ROCK: 3, BUSH: 4, FLOWER: 5, FOUNTAIN: 6, LAMP: 7, TALLGRASS: 8, MUSHROOM: 9,
  REEDS: 10, LILY: 11, STUMP: 12, DEADTREE: 13, GRAVE: 14, BONES: 15, TENT: 16, CAMPFIRE: 17, FENCE: 18,
  TORCH: 19, BARREL: 20, CRATE: 21, HAY: 22, WELL: 23, STALL: 24, BENCH: 25, BANNER: 26, LOG: 27,
  FLOWERBED: 28, SPIKES: 29, WALL: 30, TOWER: 31, PART: 32, GATE: 33, STAIRS: 34, RUBBLE: 35, RUBBLEBIG: 36,
  STATUE: 37, BRAZIER: 38, DUMMY: 39, WATERFALL: 40, LOWWALL: 41, IVY: 42, ANVIL: 43, WEAPONRACK: 44, CART: 45, TABLE: 46,
};
const BLOCKING = new Set([O.TREE, O.PINE, O.ROCK, O.FOUNTAIN, O.LAMP, O.STUMP, O.DEADTREE, O.GRAVE, O.TENT,
  O.CAMPFIRE, O.FENCE, O.TORCH, O.BARREL, O.CRATE, O.HAY, O.WELL, O.STALL, O.BANNER, O.LOG, O.SPIKES,
  O.WALL, O.TOWER, O.PART, O.RUBBLEBIG, O.STATUE, O.BRAZIER, O.DUMMY, O.WATERFALL, O.LOWWALL, O.ANVIL, O.WEAPONRACK, O.CART, O.TABLE]);
// objetos rasteiros (vão direto para o chão pré-desenhado)
const FLAT = new Set([O.FLOWER, O.LILY, O.FLOWERBED, O.BONES, O.RUBBLE, O.IVY]);
const DIRS8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

const Z = { VILLAGE: 0, FIELDS: 1, FOREST: 2, SWAMP: 3, BONES: 4, ORCS: 5, WILD: 6, OUTSKIRTS: 7 };
const ZONES = [
  { name: 'Cidadela de Eldmar', stars: 0, mons: [] },
  { name: 'Campos de Eldmar', stars: 1, mons: ['rat', 'rat', 'slime'] },
  { name: 'Bosque Sombrio', stars: 2, mons: ['wolf', 'wolf', 'spider'] },
  { name: 'Pântano Pútrido', stars: 2, mons: ['toad', 'toad', 'slime'] },
  { name: 'Colinas de Ossos', stars: 3, mons: ['skeleton', 'skeleton', 'spider'] },
  { name: 'Acampamento Orc', stars: 3, mons: ['goblin', 'goblin', 'orc'] },
  { name: 'Terras Selvagens', stars: 4, mons: ['orc', 'troll', 'skeleton', 'orc'] },
  { name: 'Arredores de Eldmar', stars: 0, mons: [] },
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

// ---------- cidade de Eldmar (coordenadas relativas ao centro) ----------
const CASTLE = { x0: C - 32, y0: C - 32, x1: C + 33, y1: C + 33 };   // muralha externa
const KEEP = { x0: C - 9, y0: C - 22, x1: C + 10, y1: C - 3 };       // castelo central
const BH = (kind, w, h, H, RH, name, extra) => ({ kind, w, h, H, RH, name: name || '', wall: Math.round(H * 19.6), roof: Math.round(RH * 19.6), ...extra });
const BUILDINGS = [
  { x: C - 28, y: C - 29, ...BH('temple', 9, 8, 5.6, 4.2, 'Catedral da Aurora') },
  { x: C + 13, y: C - 7, ...BH('shop', 5, 5, 4.4, 2.8, 'Empório do Borin') },
  { x: C + 21, y: C + 8, ...BH('smith', 6, 5, 3.4, 2.4, 'Forja de Hrodgar') },
  { x: C - 16, y: C + 22, ...BH('tavern', 7, 6, 4.6, 3.2, 'Taverna do Javali') },
  { x: C + 5, y: C + 22, ...BH('barracks', 8, 5, 3.8, 2.6, 'Quartel da Guarda') },
  { x: C - 28, y: C + 24, ...BH('stable', 5, 4, 2.8, 2.0, 'Estábulo') },
  { x: C + 13, y: C + 0, ...BH('shop', 5, 4, 5.0, 2.6, 'Boticário de Elva', { v: 1 }) },
  { x: C + 21, y: C - 8, ...BH('shop', 6, 5, 5.4, 3.0, 'Arcanos & Varinhas', { v: 2 }) },
  { x: C + 13, y: C + 9, ...BH('shop', 5, 5, 4.8, 2.8, 'Alfaiataria Real', { v: 3 }) },
  { x: C + 21, y: C + 15, ...BH('shop', 6, 4, 4.2, 2.6, 'Pergaminhos & Mapas', { v: 4 }) },
];
// portas: em frente à face de baixo (+y) de cada construção
const doorOf = b => ({ x: b.x + b.w / 2 - 0.5, y: b.y + b.h + 0.8 });
const BLD_BY = k => BUILDINGS.find(b => b.kind === k);
const NPCS = [
  { id: 'priest', name: 'Irmã Lúmina', kind: 'priest', ...doorOf(BUILDINGS[0]) },
  { id: 'merchant', name: 'Borin, o Mercador', kind: 'merchant', ...doorOf(BUILDINGS[1]) },
  { id: 'innkeeper', name: 'Greta, a Taverneira', kind: 'innkeeper', ...doorOf(BUILDINGS[3]) },
  { id: 'smith', name: 'Hrodgar, o Ferreiro', kind: 'smith', ...doorOf(BUILDINGS[2]) },
  { id: 'captain', name: 'Capitã Mirela Varn', kind: 'captain', ...doorOf(BUILDINGS[4]) },
  { id: 'guard1', name: 'Sentinela Aldric', kind: 'guard', x: C - 3, y: C + 30.4 },
  { id: 'guard2', name: 'Sentinela Bren', kind: 'guard', x: C + 4, y: C + 30.4 },
  { id: 'guard3', name: 'Sentinela Odo', kind: 'guard', x: C - 1.4, y: C - 29.4 },
  { id: 'guard4', name: 'Sentinela Wyn', kind: 'guard', x: C + 2.4, y: C - 29.4 },
];
NPCS[0].x += 1.5; // a sacerdotisa fica ao lado da porta, para não bloquear
const TEMPLE_SPAWN = { x: BUILDINGS[0].x + 4, y: BUILDINGS[0].y + BUILDINGS[0].h + 2 };
const MOUNTAIN = { x: 50, y: 52, r: 20 };
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
      else if (g === T.FOREST) o = r < 0.2 ? O.TREE : r < 0.3 ? O.BUSH : r < 0.4 ? O.TALLGRASS : O.NONE;
      else o = r < 0.02 ? O.TREE : r < 0.04 ? O.BUSH : r < 0.14 ? O.FLOWER : r < 0.22 ? O.TALLGRASS : r < 0.224 ? O.ROCK : O.NONE;
    } else if (z === Z.FIELDS) {
      if (g === T.FOREST) o = r < 0.2 ? O.TREE : r < 0.26 ? O.PINE : r < 0.32 ? O.BUSH : r < 0.35 ? O.MUSHROOM : r < 0.42 ? O.TALLGRASS : O.NONE;
      else o = r < 0.025 ? O.TREE : r < 0.06 ? O.BUSH : r < 0.075 ? O.ROCK : r < 0.17 ? O.FLOWER : r < 0.27 ? O.TALLGRASS : r < 0.275 ? O.LOG : O.NONE;
    } else if (z === Z.FOREST) {
      if (g === T.FOREST) o = r < 0.2 ? O.TREE : r < 0.34 ? O.PINE : r < 0.4 ? O.BUSH : r < 0.45 ? O.MUSHROOM : r < 0.47 ? O.STUMP : r < 0.55 ? O.TALLGRASS : r < 0.56 ? O.LOG : O.NONE;
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
      else if (g === T.FOREST) o = r < 0.28 ? O.PINE : r < 0.38 ? O.TREE : r < 0.42 ? O.BUSH : r < 0.45 ? O.MUSHROOM : O.NONE;
      else o = r < 0.06 ? O.TREE : r < 0.1 ? O.PINE : r < 0.14 ? O.ROCK : r < 0.18 ? O.BUSH : r < 0.3 ? O.TALLGRASS : r < 0.33 ? O.FLOWER : O.NONE;
    }
    obj[i] = o;
  }
  // árvores ao pé da montanha
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const i = idx(x, y);
    if (ground[i] === T.CLIFF || ground[i] === T.WATER || zone[i] === Z.VILLAGE) continue;
    const d = Math.hypot(x - MOUNTAIN.x, y - MOUNTAIN.y);
    if (d < MOUNTAIN.r + 4 && obj[i] === O.NONE && R(x, y, 50) < 0.3) obj[i] = R(x, y, 51) < 0.6 ? O.PINE : O.ROCK;
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
    if (isGate(x, y)) { set(x, y, T.FLOORSTONE, O.GATE); fl1[i] = 1; continue; }
    set(x, y, null, O.WALL); fl1[i] = 1;
  }
  for (const [tx, ty] of towers) {
    for (let y = ty; y <= ty + 1; y++) for (let x = tx; x <= tx + 1; x++) { set(x, y, T.FLOORSTONE, O.PART); fl1[idx(x, y)] = 1; }
    obj[idx(tx + 1, ty + 1)] = O.TOWER;
    tvar[idx(tx + 1, ty + 1)] = Math.floor(R(tx, ty, 2) * 3);
  }
  for (const [tx, ty] of gateTowers) tvar[idx(tx + 1, ty + 1)] = 3;
  reserve(x0, y0, x1, y0 + 1); reserve(x0, y1 - 1, x1, y1); reserve(x0, y0, x0 + 1, y1); reserve(x1 - 1, y0, x1, y1);

  // ---- castelo central (Hogwarts/Porto Real): muralha própria, salão no andar de cima ----
  const kt = [[KEEP.x0, KEEP.y0], [KEEP.x1 - 1, KEEP.y0], [KEEP.x0, KEEP.y1 - 1], [KEEP.x1 - 1, KEEP.y1 - 1], [C - 3, KEEP.y1 - 1], [C + 3, KEEP.y1 - 1], [KEEP.x0, C - 13], [KEEP.x1 - 1, C - 13]];
  const inKT = (x, y) => kt.some(([tx, ty]) => x >= tx && x <= tx + 1 && y >= ty && y <= ty + 1);
  for (let y = KEEP.y0; y <= KEEP.y1; y++) for (let x = KEEP.x0; x <= KEEP.x1; x++) {
    const i = idx(x, y), onWall = x === KEEP.x0 || x === KEEP.x1 || y === KEEP.y0 || y === KEEP.y1;
    set(x, y, T.FLOORSTONE, O.NONE);
    if (inKT(x, y)) continue;
    if (onWall) {
      if (y === KEEP.y1 && (x === C || x === C + 1)) { set(x, y, null, O.GATE); fl1[i] = 1; continue; }
      set(x, y, null, O.WALL); fl1[i] = 1;
    } else fl1[i] = 2;
  }
  for (const [tx, ty] of kt) {
    for (let y = ty; y <= ty + 1; y++) for (let x = tx; x <= tx + 1; x++) { set(x, y, T.FLOORSTONE, O.PART); fl1[idx(x, y)] = 1; }
    obj[idx(tx + 1, ty + 1)] = O.TOWER; tvar[idx(tx + 1, ty + 1)] = 3;
  }
  reserve(KEEP.x0 - 2, KEEP.y0 - 2, KEEP.x1 + 2, KEEP.y1 + 2);

  // ---- escadas de 2 degraus (rampas) até a muralha ----
  const stairs = [[C - 8, y1 - 2, 3], [C + 9, y1 - 2, 3], [C + 6, y0 + 2, 4], [x0 + 2, C + 10, 2], [x1 - 2, C - 6, 1], [KEEP.x0 + 2, C - 9, 2]];
  for (const [sx, sy, d] of stairs) {
    const dx = d === 1 ? 1 : d === 2 ? -1 : 0, dy = d === 3 ? 1 : d === 4 ? -1 : 0;
    for (let k = 0; k < 2; k++) { const x = sx + dx * k, y = sy + dy * k, i = idx(x, y); set(x, y, T.FLOORSTONE, O.STAIRS); stair[i] = d; stairK[i] = k; fl1[i] = 3; }
    reserve(sx - 1, sy - 1, sx + 1, sy + 1); reserve(sx - dx * 2 - 1, sy - dy * 2 - 1, sx - dx * 2 + 1, sy - dy * 2 + 1);
  }

  // ---- ruas e praças da cidade ----
  const street = (ax, ay, bx, by) => { for (let y = ay; y <= by; y++) for (let x = ax; x <= bx; x++) { set(x, y, T.COBBLE, O.NONE); rdir[idx(x, y)] = bx - ax > by - ay ? 1 : 2; } reserve(ax, ay, bx, by); };
  street(C - 1, KEEP.y1 + 1, C + 2, y1 - 1);              // avenida real (portão principal -> castelo)
  street(C, y0 + 1, C + 1, KEEP.y0 - 1);                  // rua do portão norte
  street(KEEP.x0 - 2, KEEP.y0 - 2, KEEP.x1 + 2, KEEP.y0 - 1); street(KEEP.x0 - 2, KEEP.y1 + 1, KEEP.x1 + 2, KEEP.y1 + 2); // anel do castelo
  street(KEEP.x0 - 2, KEEP.y0, KEEP.x0 - 1, KEEP.y1); street(KEEP.x1 + 1, KEEP.y0, KEEP.x1 + 2, KEEP.y1);
  street(x0 + 2, C + 5, x1 - 2, C + 6);                    // rua do mercado (leste-oeste)
  street(C + 19, C - 20, C + 20, y1 - 3);                  // beco dos mercadores (estreito, como o Beco Diagonal)
  street(C - 10, C + 8, C + 11, C + 19);                   // praça do mercado
  street(x0 + 2, C - 16, KEEP.x0 - 3, C - 15);             // rua do templo
  street(C - 24, C - 20, C - 23, C + 5);
  street(C - 24, C + 19, C + 18, C + 20);                  // rua de baixo
  street(KEEP.x1 + 3, C - 24, x1 - 2, C - 23);
  for (const b of BUILDINGS) { const d = doorOf(b); reserve(Math.floor(d.x) - 1, b.y + b.h, Math.ceil(d.x) + 1, b.y + b.h + 1); }

  // ---- construções fixas + casas geradas (cidade densa, com vielas entre elas) ----
  const free = (ax, ay, w, h) => { for (let y = ay - 1; y <= ay + h; y++) for (let x = ax - 1; x <= ax + w; x++) { if (!inb(x, y) || used[idx(x, y)] || bld[idx(x, y)] >= 0) return false; if (x <= x0 + 1 || x >= x1 - 1 || y <= y0 + 1 || y >= y1 - 1) return false; } return true; };
  const houses = [];
  for (let k = 0; k < 1400 && houses.length < 46; k++) {
    const w = 4 + Math.floor(R(k, 1, 700) * 3), h = 4 + Math.floor(R(k, 2, 700) * 2);
    const x = x0 + 3 + Math.floor(R(k, 3, 700) * (x1 - x0 - 6 - w)), y = y0 + 3 + Math.floor(R(k, 4, 700) * (y1 - y0 - 6 - h));
    if (!free(x, y, w, h)) continue;
    const floors = R(k, 5, 700);
    const H = floors < 0.35 ? 3.2 : floors < 0.8 ? 4.4 : 5.6, RH = 2.2 + R(k, 6, 700) * 1.2;
    const hb = { x, y, ...BH('house', w, h, H, RH, '', { v: Math.floor(R(k, 7, 700) * 6) }) };
    houses.push(hb);
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) bld[idx(xx, yy)] = -2; // marcador temporário
  }
  BUILDINGS.push(...houses);
  BUILDINGS.forEach((b, bi) => {
    for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) { bld[idx(x, y)] = bi; obj[idx(x, y)] = O.NONE; ground[idx(x, y)] = T.COBBLE; }
  });

  // ---- decoração ----
  const nearBld = (x, y) => { for (let yy = y - 1; yy <= y + 1; yy++) for (let xx = x - 1; xx <= x + 1; xx++) if (bld[idx(xx, yy)] >= 0) return true; return false; };
  const deco = (x, y, o) => { const i = idx(x, y); if (bld[i] < 0 && !stair[i] && !fl1[i] && !nearBld(x, y)) obj[i] = o; };
  const decoAny = (x, y, o) => { const i = idx(x, y); if (bld[i] < 0 && !stair[i] && !fl1[i]) obj[i] = o; };
  // praça do mercado
  decoAny(C, C + 13, O.FOUNTAIN);
  for (const [dx, dy] of [[-8, 9], [-5, 9], [6, 9], [9, 9], [-8, 17], [-5, 17], [6, 17], [9, 17], [-9, 13], [10, 13]]) decoAny(C + dx, C + dy, O.STALL);
  for (const [dx, dy] of [[-3, 11], [4, 11], [-3, 15], [4, 15]]) decoAny(C + dx, C + dy, O.BENCH);
  for (const [dx, dy] of [[-10, 10], [11, 10], [-10, 18], [11, 18], [-6, 12], [7, 15]]) decoAny(C + dx, C + dy, (dx + dy) % 2 ? O.BARREL : O.CRATE);
  decoAny(C - 7, C + 14, O.CART);
  // avenida real: postes de luz, estandartes e estátuas na frente do castelo
  for (let y = KEEP.y1 + 4; y < y1 - 2; y += 5) { decoAny(C - 2, y, O.LAMP); decoAny(C + 3, y, O.LAMP); }
  decoAny(C - 3, KEEP.y1 + 2, O.STATUE); decoAny(C + 4, KEEP.y1 + 2, O.STATUE);
  decoAny(C - 1, KEEP.y1 + 1, O.BRAZIER); decoAny(C + 2, KEEP.y1 + 1, O.BRAZIER);
  decoAny(C - 2, y1 - 2, O.BRAZIER); decoAny(C + 3, y1 - 2, O.BRAZIER);
  decoAny(C - 1, y0 + 1, O.BRAZIER); decoAny(C + 2, y0 + 1, O.BRAZIER);
  for (let y = C - 18; y < y1 - 4; y += 6) { decoAny(C + 18, y, O.LAMP); decoAny(C + 21, y + 3, O.LAMP); }
  for (let x = x0 + 5; x < x1 - 4; x += 7) { if (Math.abs(x - C) > 4) { decoAny(x, C + 4, O.LAMP); } }
  // bandeiras do castelo
  for (const x of [KEEP.x0 + 4, KEEP.x0 + 8, KEEP.x1 - 4, KEEP.x1 - 8]) decoAny(x, KEEP.y1 + 2, O.BANNER);
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
    if (used[i] || bld[i] >= 0 || obj[i] !== O.NONE || nearBld(x, y) || fl1[i]) continue;
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
    obj[i] = r < 0.06 ? O.TREE : r < 0.09 ? O.BUSH : r < 0.2 ? O.TALLGRASS : r < 0.26 ? O.FLOWER : O.NONE;
  }
  for (const n of NPCS) obj[idx(Math.round(n.x), Math.round(n.y))] = O.NONE;

  return { ground, obj, zone, bld, fl1, stair, stairK, tvar, rdir, height, flow, river };
}

const WORLD = generateWorld();
const NPC_AT = new Set(NPCS.map(n => Math.round(n.y) * MAP_W + Math.round(n.x)));

function inBounds(x, y) { return x >= 0 && y >= 0 && x < MAP_W && y < MAP_H; }
// tile (inteiro) andável no andar z
function walkableTile(x, y, z = 0) {
  if (!inBounds(x, y)) return false;
  const i = y * MAP_W + x;
  if (z === 1) return WORLD.fl1[i] > 0;
  const g = WORLD.ground[i];
  return g !== T.WATER && g !== T.CLIFF && !BLOCKING.has(WORLD.obj[i]) && WORLD.bld[i] < 0 && !NPC_AT.has(i);
}
// posição livre (contínua) — testa um círculo de raio r
function canStand(x, y, z = 0, r = 0.28) {
  return walkableTile(Math.round(x - r), Math.round(y - r), z) && walkableTile(Math.round(x + r), Math.round(y - r), z) &&
    walkableTile(Math.round(x - r), Math.round(y + r), z) && walkableTile(Math.round(x + r), Math.round(y + r), z);
}
function zoneAt(x, y) { x = Math.round(x); y = Math.round(y); return inBounds(x, y) ? WORLD.zone[y * MAP_W + x] : Z.WILD; }
function inSafe(x, y) { return zoneAt(x, y) === Z.VILLAGE; }
function tileAt(x, y) { return Math.round(y) * MAP_W + Math.round(x); }
// telhado/andar acima? (para esconder o andar 1 quando o jogador está embaixo)
function covered(x, y) { const i = tileAt(x, y); return WORLD.fl1[i] > 0; }

// tiles alcançáveis a partir do templo (monstros só nascem nesses)
const REACH = (() => {
  const r = new Uint8Array(MAP_W * MAP_H), q = [[TEMPLE_SPAWN.x, TEMPLE_SPAWN.y]];
  r[TEMPLE_SPAWN.y * MAP_W + TEMPLE_SPAWN.x] = 1;
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
  return clamp((WORLD.stairK[ty * MAP_W + tx] + 0.5 + along) / 2, 0, 1);
}
// posição livre para quem está na altura z (contínua, 0..1)
function canStandZ(x, y, z, r = 0.24) {
  const h0 = stairH(x, y);
  if (h0 >= 0) return Math.abs(h0 - z) <= 0.4; // em cima da rampa só importa a altura
  const L = z >= 0.5 ? 1 : 0;
  for (const [ox, oy] of [[-r, -r], [r, -r], [-r, r], [r, r]]) {
    const tx = Math.round(x + ox), ty = Math.round(y + oy);
    if (!inBounds(tx, ty)) return false;
    const i = ty * MAP_W + tx;
    if (WORLD.stair[i]) continue;
    if (!walkableTile(tx, ty, L)) return false;
  }
  const h = stairH(x, y);
  if (h >= 0 && Math.abs(h - z) > 0.4) return false; // não entra na rampa pela lateral
  return true;
}
// altura resultante depois de andar até (x, y)
function heightAt(x, y, z) { const h = stairH(x, y); return h >= 0 ? h : (z >= 0.5 ? 1 : 0); }
