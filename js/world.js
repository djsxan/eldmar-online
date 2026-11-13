// ============================================================
//  MUNDO — mapa gerado por código. É igual para todos os jogadores
//  porque usa sempre a mesma "semente" de números aleatórios.
// ============================================================
const MAP_W = 128, MAP_H = 128, CENTER = 64, SAFE_R = 10;

// Tipos de chão
const T = { WATER: 0, SAND: 1, GRASS: 2, FOREST: 3, STONE: 4, DIRT: 5, BRIDGE: 6, COBBLE: 7, SWAMP: 8, DEAD: 9 };
// Objetos em cima do chão
const O = {
  NONE: 0, TREE: 1, PINE: 2, ROCK: 3, BUSH: 4, FLOWER: 5, FOUNTAIN: 6, LAMP: 7, TALLGRASS: 8, MUSHROOM: 9,
  REEDS: 10, LILY: 11, STUMP: 12, DEADTREE: 13, GRAVE: 14, BONES: 15, TENT: 16, CAMPFIRE: 17, FENCE: 18,
  TORCH: 19, BARREL: 20, CRATE: 21, HAY: 22, WELL: 23, STALL: 24, BENCH: 25, BANNER: 26, LOG: 27,
  FLOWERBED: 28, SPIKES: 29,
};
const BLOCKING = new Set([O.TREE, O.PINE, O.ROCK, O.FOUNTAIN, O.LAMP, O.STUMP, O.DEADTREE, O.GRAVE, O.TENT,
  O.CAMPFIRE, O.FENCE, O.TORCH, O.BARREL, O.CRATE, O.HAY, O.WELL, O.STALL, O.BANNER, O.LOG, O.SPIKES]);
// Objetos rasteiros (desenhados junto com o chão)
const FLAT = new Set([O.FLOWER, O.LILY, O.FLOWERBED, O.BONES]);
const DIRS8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

// Zonas de dificuldade
const Z = { VILLAGE: 0, FIELDS: 1, FOREST: 2, SWAMP: 3, BONES: 4, ORCS: 5, WILD: 6 };
const ZONES = [
  { name: 'Vilarejo de Eldmar', stars: 0, mons: [] },
  { name: 'Campos de Eldmar', stars: 1, mons: ['rat', 'rat', 'slime'] },
  { name: 'Bosque Sombrio', stars: 2, mons: ['wolf', 'wolf', 'spider'] },
  { name: 'Pântano Pútrido', stars: 2, mons: ['toad', 'toad', 'slime'] },
  { name: 'Colinas de Ossos', stars: 3, mons: ['skeleton', 'skeleton', 'spider'] },
  { name: 'Acampamento Orc', stars: 3, mons: ['goblin', 'goblin', 'orc'] },
  { name: 'Terras Selvagens', stars: 4, mons: ['orc', 'troll', 'skeleton', 'orc'] },
];

// Número pseudo-aleatório determinístico a partir de (x, y, semente)
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
  for (let i = 0; i < 4; i++) {
    total += vnoise(x * freq, y * freq, s + i * 17) * amp;
    norm += amp; amp *= 0.5; freq *= 2;
  }
  return total / norm;
}

function zoneOf(x, y) {
  const dx = x - CENTER, dy = y - CENTER;
  if (Math.max(Math.abs(dx - 0.5), Math.abs(dy - 0.5)) <= SAFE_R + 1.5) return Z.VILLAGE;
  const d = Math.hypot(dx, dy) + (vnoise(x / 8, y / 8, 55) - 0.5) * 7;
  if (d < 23) return Z.FIELDS;
  if (d > 45) return Z.WILD;
  // ângulo na TELA (norte = para cima na tela)
  const sx = dx - dy, sy = dx + dy;
  const a = Math.atan2(sy, sx) + (vnoise(x / 10, y / 10, 77) - 0.5) * 0.6;
  const q = Math.PI / 4;
  if (a >= -3 * q && a < -q) return Z.FOREST;
  if (a >= -q && a < q) return Z.SWAMP;
  if (a >= q && a < 3 * q) return Z.BONES;
  return Z.ORCS;
}

// Construções do vilarejo (x, y = canto de trás; w x h tiles)
const C = CENTER;
const BUILDINGS = [
  { kind: 'temple', name: 'Templo da Aurora', x: C - 9, y: C - 9, w: 5, h: 5, wall: 62, roof: 30 },
  { kind: 'shop', name: 'Empório do Borin', x: C + 3, y: C - 9, w: 4, h: 4, wall: 44, roof: 26 },
  { kind: 'tavern', name: 'Taverna do Javali', x: C - 9, y: C + 3, w: 4, h: 5, wall: 48, roof: 28 },
  { kind: 'house', name: '', x: C + 6, y: C + 5, w: 3, h: 3, wall: 36, roof: 22 },
  { kind: 'house', name: '', x: C + 3, y: C + 7, w: 3, h: 3, wall: 34, roof: 22 },
];
// Personagens fixos (NPCs)
const NPCS = [
  { id: 'priest', name: 'Irmã Lúmina', kind: 'priest', x: C - 6, y: C - 3 },
  { id: 'merchant', name: 'Borin, o Mercador', kind: 'merchant', x: C + 5, y: C - 4 },
  { id: 'innkeeper', name: 'Greta, a Taverneira', kind: 'innkeeper', x: C - 4, y: C + 5 },
  { id: 'guard1', name: 'Guarda Aldric', kind: 'guard', x: C - 1, y: C - 10 },
  { id: 'guard2', name: 'Guarda Bren', kind: 'guard', x: C + 2, y: C + 10 },
];
const TEMPLE_SPAWN = { x: C - 5, y: C - 2 };

function generateWorld() {
  const N = MAP_W * MAP_H;
  const ground = new Uint8Array(N), obj = new Uint8Array(N), zone = new Uint8Array(N);
  const bld = new Int8Array(N).fill(-1);
  const R = (x, y, s) => hash2(x, y, s);

  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const i = y * MAP_W + x;
      const dx = x - CENTER, dy = y - CENTER;
      const edge = Math.sqrt(dx * dx + dy * dy) / (MAP_W / 2);
      const h = fbm(x / 18, y / 18, 7) + 0.3 - edge * edge * 0.68;
      const z = zoneOf(x, y);
      zone[i] = z;
      const n1 = fbm(x / 9, y / 9, 99), n2 = fbm(x / 6, y / 6, 31);

      let g;
      if (h < 0.35 || x < 2 || y < 2 || x > MAP_W - 3 || y > MAP_H - 3) g = T.WATER;
      else if (h < 0.39) g = T.SAND;
      else switch (z) {
        case Z.FIELDS: g = n1 > 0.64 ? T.FOREST : T.GRASS; break;
        case Z.FOREST: g = n1 > 0.42 ? T.FOREST : T.GRASS; break;
        case Z.SWAMP: g = n2 > 0.66 ? T.WATER : n2 > 0.4 ? T.SWAMP : T.GRASS; break;
        case Z.BONES: g = n2 > 0.6 ? T.DIRT : T.DEAD; break;
        case Z.ORCS: g = n1 > 0.5 ? T.DIRT : (n2 > 0.5 ? T.DEAD : T.GRASS); break;
        case Z.WILD: g = n2 > 0.7 ? T.STONE : n1 > 0.55 ? T.FOREST : T.GRASS; break;
        default: g = T.GRASS;
      }
      if (z === Z.VILLAGE && g !== T.WATER) g = T.GRASS;
      ground[i] = g;

      // vegetação e objetos por zona
      const r = R(x, y, 4242);
      let o = O.NONE;
      if (z === Z.VILLAGE) o = O.NONE;
      else if (g === T.WATER) { if ((z === Z.SWAMP && r < 0.12) || (z === Z.FIELDS && r < 0.02)) o = O.LILY; }
      else if (g === T.SAND) { if (r < 0.025) o = O.ROCK; else if (r < 0.06) o = O.REEDS; }
      else if (z === Z.FIELDS) {
        if (g === T.FOREST) o = r < 0.2 ? O.TREE : r < 0.26 ? O.PINE : r < 0.32 ? O.BUSH : r < 0.35 ? O.MUSHROOM : r < 0.42 ? O.TALLGRASS : O.NONE;
        else o = r < 0.025 ? O.TREE : r < 0.06 ? O.BUSH : r < 0.075 ? O.ROCK : r < 0.17 ? O.FLOWER : r < 0.26 ? O.TALLGRASS : r < 0.265 ? O.LOG : O.NONE;
      } else if (z === Z.FOREST) {
        if (g === T.FOREST) o = r < 0.2 ? O.TREE : r < 0.34 ? O.PINE : r < 0.4 ? O.BUSH : r < 0.45 ? O.MUSHROOM : r < 0.47 ? O.STUMP : r < 0.54 ? O.TALLGRASS : r < 0.55 ? O.LOG : O.NONE;
        else o = r < 0.06 ? O.TREE : r < 0.1 ? O.BUSH : r < 0.24 ? O.TALLGRASS : r < 0.28 ? O.FLOWER : r < 0.29 ? O.STUMP : O.NONE;
      } else if (z === Z.SWAMP) {
        if (g === T.SWAMP) o = r < 0.05 ? O.DEADTREE : r < 0.17 ? O.REEDS : r < 0.21 ? O.MUSHROOM : r < 0.28 ? O.TALLGRASS : r < 0.29 ? O.LOG : O.NONE;
        else o = r < 0.08 ? O.REEDS : r < 0.11 ? O.TREE : r < 0.15 ? O.BUSH : r < 0.26 ? O.TALLGRASS : O.NONE;
      } else if (z === Z.BONES) {
        if (g === T.DEAD) o = r < 0.04 ? O.GRAVE : r < 0.08 ? O.BONES : r < 0.12 ? O.DEADTREE : r < 0.15 ? O.ROCK : r < 0.22 ? O.TALLGRASS : O.NONE;
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
  }

  // Estradas saindo do vilarejo nas 4 direções (com pontes sobre a água)
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const px = dy !== 0 ? 1 : 0, py = dx !== 0 ? 1 : 0;
    let lastLand = 0;
    for (let k = 1; k < CENTER - 2; k++) {
      for (let w = 0; w < 2; w++) {
        const x = CENTER + dx * k + px * w, y = CENTER + dy * k + py * w;
        if (ground[y * MAP_W + x] !== T.WATER) lastLand = k;
      }
    }
    for (let k = 0; k <= lastLand; k++) {
      for (let w = -1; w < 3; w++) {
        const x = CENTER + dx * k + px * w, y = CENTER + dy * k + py * w;
        const i = y * MAP_W + x;
        if (w < 0 || w > 1) { if (BLOCKING.has(obj[i])) obj[i] = O.NONE; continue; } // acostamento livre
        ground[i] = ground[i] === T.WATER ? T.BRIDGE : (k <= SAFE_R + 1 ? T.COBBLE : T.DIRT);
        obj[i] = O.NONE;
      }
    }
  }

  // ---------- Vilarejo ----------
  const set = (x, y, g, o) => { const i = y * MAP_W + x; if (g != null) ground[i] = g; if (o != null) obj[i] = o; };
  const isRoad = (x, y) => (x === C || x === C + 1 || y === C || y === C + 1);
  // praça de pedra
  for (let y = C - 3; y <= C + 4; y++) for (let x = C - 3; x <= C + 4; x++) set(x, y, T.COBBLE, O.NONE);
  // caminhos até as portas
  for (let x = C - 9; x <= C - 3; x++) { set(x, C - 4, T.COBBLE); set(x, C - 3, T.COBBLE); }
  for (let y = C - 9; y <= C - 3; y++) set(C + 5, y, T.COBBLE);
  for (let y = C - 5; y <= C - 3; y++) { set(C + 4, y, T.COBBLE); set(C + 6, y, T.COBBLE); }
  for (let x = C - 5; x <= C - 3; x++) { set(x, C + 5, T.COBBLE); set(x, C + 4, T.COBBLE); }
  for (let y = C + 5; y <= C + 9; y++) set(C + 2, y, T.COBBLE);
  for (let x = C + 2; x <= C + 7; x++) set(x, C + 4, T.COBBLE);

  // paliçada com portões nas estradas
  const P = SAFE_R + 1;
  for (let k = -P; k <= P + 1; k++) {
    for (const [x, y] of [[C + k, C - P], [C + k, C + P + 1], [C - P, C + k], [C + P + 1, C + k]]) {
      if (isRoad(x, y)) continue;
      const nearGate = (x === C - 1 || x === C + 2 || y === C - 1 || y === C + 2);
      set(x, y, null, nearGate ? O.TORCH : O.FENCE);
    }
  }

  // construções
  BUILDINGS.forEach((b, bi) => {
    for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) { bld[y * MAP_W + x] = bi; obj[y * MAP_W + x] = O.NONE; }
  });

  // decoração
  set(C, C, null, O.FOUNTAIN);
  for (const [x, y] of [[C - 3, C - 3], [C + 4, C - 3], [C - 3, C + 4], [C + 4, C + 4]]) set(x, y, null, O.LAMP);
  const deco = [
    [C - 2, C - 2, O.BENCH], [C + 3, C + 3, O.BENCH], [C + 7, C - 5, O.STALL], [C + 8, C - 3, O.STALL],
    [C + 3, C - 6, O.CRATE], [C + 7, C - 7, O.BARREL], [C + 7, C - 8, O.CRATE],
    [C - 5, C + 3, O.BARREL], [C - 5, C + 7, O.BARREL], [C - 4, C + 8, O.BENCH], [C - 5, C + 8, O.BARREL],
    [C + 7, C + 3, O.WELL], [C + 9, C + 9, O.HAY], [C + 9, C + 3, O.HAY], [C + 9, C + 4, O.CRATE],
    [C - 4, C - 8, O.BANNER], [C - 4, C - 6, O.BANNER], [C - 9, C - 3, O.LAMP], [C - 2, C + 8, O.LAMP], [C + 8, C - 9, O.LAMP],
    [C - 8, C - 2, O.FLOWERBED], [C - 7, C - 2, O.FLOWERBED], [C + 5, C + 9, O.FLOWERBED], [C + 6, C + 9, O.FLOWERBED],
    [C - 9, C + 9, O.TREE], [C + 9, C - 1, O.TREE], [C - 2, C + 10, O.TREE], [C + 10, C + 7, O.PINE], [C - 8, C + 9, O.BUSH],
    [C - 10, C - 1, O.BUSH], [C + 8, C + 9, O.FLOWERBED], [C - 7, C + 10, O.TALLGRASS], [C + 4, C + 10, O.TALLGRASS],
  ];
  for (const [x, y, o] of deco) if (bld[y * MAP_W + x] < 0 && !isRoad(x, y)) set(x, y, null, o);
  for (let k = 0; k < 40; k++) { // flores espalhadas na grama do vilarejo
    const x = C - SAFE_R + Math.floor(R(k, 1, 900) * SAFE_R * 2), y = C - SAFE_R + Math.floor(R(k, 2, 900) * SAFE_R * 2);
    const i = y * MAP_W + x;
    if (ground[i] === T.GRASS && obj[i] === O.NONE && bld[i] < 0) obj[i] = R(k, 3, 900) < 0.5 ? O.FLOWER : O.TALLGRASS;
  }
  for (const n of NPCS) obj[n.y * MAP_W + n.x] = O.NONE;

  return { ground, obj, zone, bld };
}

const WORLD = generateWorld();
const NPC_AT = new Set(NPCS.map(n => n.y * MAP_W + n.x));

function inBounds(x, y) { return x >= 0 && y >= 0 && x < MAP_W && y < MAP_H; }
function walkable(x, y) {
  if (!inBounds(x, y)) return false;
  const i = y * MAP_W + x;
  return WORLD.ground[i] !== T.WATER && !BLOCKING.has(WORLD.obj[i]) && WORLD.bld[i] < 0 && !NPC_AT.has(i);
}
// Tiles alcançáveis a pé a partir do templo (monstros só nascem nesses)
const REACH = (() => {
  const r = new Uint8Array(MAP_W * MAP_H), q = [[TEMPLE_SPAWN.x, TEMPLE_SPAWN.y]];
  r[TEMPLE_SPAWN.y * MAP_W + TEMPLE_SPAWN.x] = 1;
  for (let i = 0; i < q.length; i++) {
    const [x, y] = q[i];
    for (const [dx, dy] of DIRS8) {
      const nx = x + dx, ny = y + dy;
      if (walkable(nx, ny) && !r[ny * MAP_W + nx]) { r[ny * MAP_W + nx] = 1; q.push([nx, ny]); }
    }
  }
  return r;
})();
function zoneAt(x, y) { return inBounds(x, y) ? WORLD.zone[y * MAP_W + x] : Z.WILD; }
// Zona protegida (vilarejo): monstros não entram e ninguém luta aqui
function inSafe(x, y) { return zoneAt(x, y) === Z.VILLAGE; }
