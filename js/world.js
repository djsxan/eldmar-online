// ============================================================
//  MUNDO — mapa gerado por código (igual para todos: usa sempre a
//  mesma semente). Tem 2 andares: 0 = chão, 1 = muralhas/torres.
// ============================================================
const MAP_W = 128, MAP_H = 128, CENTER = 64, SAFE_R = 18;
const C = CENTER;

const T = { WATER: 0, SAND: 1, GRASS: 2, FOREST: 3, STONE: 4, DIRT: 5, BRIDGE: 6, COBBLE: 7, SWAMP: 8, DEAD: 9, SHALLOW: 10, CLIFF: 11, FLOORSTONE: 12 };
const O = {
  NONE: 0, TREE: 1, PINE: 2, ROCK: 3, BUSH: 4, FLOWER: 5, FOUNTAIN: 6, LAMP: 7, TALLGRASS: 8, MUSHROOM: 9,
  REEDS: 10, LILY: 11, STUMP: 12, DEADTREE: 13, GRAVE: 14, BONES: 15, TENT: 16, CAMPFIRE: 17, FENCE: 18,
  TORCH: 19, BARREL: 20, CRATE: 21, HAY: 22, WELL: 23, STALL: 24, BENCH: 25, BANNER: 26, LOG: 27,
  FLOWERBED: 28, SPIKES: 29, WALL: 30, TOWER: 31, PART: 32, GATE: 33, STAIRS: 34, RUBBLE: 35, RUBBLEBIG: 36,
  STATUE: 37, BRAZIER: 38, DUMMY: 39, WATERFALL: 40, LOWWALL: 41, IVY: 42,
};
const BLOCKING = new Set([O.TREE, O.PINE, O.ROCK, O.FOUNTAIN, O.LAMP, O.STUMP, O.DEADTREE, O.GRAVE, O.TENT,
  O.CAMPFIRE, O.FENCE, O.TORCH, O.BARREL, O.CRATE, O.HAY, O.WELL, O.STALL, O.BANNER, O.LOG, O.SPIKES,
  O.WALL, O.TOWER, O.PART, O.RUBBLEBIG, O.STATUE, O.BRAZIER, O.DUMMY, O.WATERFALL, O.LOWWALL]);
// objetos rasteiros (vão direto para o chão pré-desenhado)
const FLAT = new Set([O.FLOWER, O.LILY, O.FLOWERBED, O.BONES, O.RUBBLE, O.IVY]);
const DIRS8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

const Z = { VILLAGE: 0, FIELDS: 1, FOREST: 2, SWAMP: 3, BONES: 4, ORCS: 5, WILD: 6 };
const ZONES = [
  { name: 'Ruínas de Eldmar', stars: 0, mons: [] },
  { name: 'Campos de Eldmar', stars: 1, mons: ['rat', 'rat', 'slime'] },
  { name: 'Bosque Sombrio', stars: 2, mons: ['wolf', 'wolf', 'spider'] },
  { name: 'Pântano Pútrido', stars: 2, mons: ['toad', 'toad', 'slime'] },
  { name: 'Colinas de Ossos', stars: 3, mons: ['skeleton', 'skeleton', 'spider'] },
  { name: 'Acampamento Orc', stars: 3, mons: ['goblin', 'goblin', 'orc'] },
  { name: 'Terras Selvagens', stars: 4, mons: ['orc', 'troll', 'skeleton', 'orc'] },
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
  const d = Math.hypot(dx, dy) + (vnoise(x / 8, y / 8, 55) - 0.5) * 7;
  if (d < 31) return Z.FIELDS;
  if (d > 49) return Z.WILD;
  const sx = dx - dy, sy = dx + dy;
  const a = Math.atan2(sy, sx) + (vnoise(x / 10, y / 10, 77) - 0.5) * 0.6;
  const q = Math.PI / 4;
  if (a >= -3 * q && a < -q) return Z.FOREST;
  if (a >= -q && a < q) return Z.SWAMP;
  if (a >= q && a < 3 * q) return Z.BONES;
  return Z.ORCS;
}

// ---------- castelo e vila ----------
const CASTLE = { x0: C - 7, y0: C - 7, x1: C + 8, y1: C + 8 };          // muralha externa
const KEEP = { x0: C - 2, y0: C - 2, x1: C + 3, y1: C + 3 };            // torre de menagem
const BUILDINGS = [
  { kind: 'temple', name: 'Capela da Aurora', x: C - 15, y: C - 15, w: 5, h: 5, wall: 30, roof: 20 },
  { kind: 'shop', name: 'Empório do Borin', x: C + 11, y: C - 15, w: 4, h: 4, wall: 22, roof: 16 },
  { kind: 'tavern', name: 'Taverna do Javali', x: C - 15, y: C + 11, w: 4, h: 5, wall: 24, roof: 18 },
  { kind: 'house', name: '', x: C + 11, y: C + 11, w: 3, h: 3, wall: 18, roof: 14 },
  { kind: 'house', name: '', x: C + 15, y: C + 11, w: 3, h: 3, wall: 18, roof: 14 },
  { kind: 'house', name: '', x: C + 11, y: C + 15, w: 3, h: 3, wall: 17, roof: 13 },
];
const NPCS = [
  { id: 'priest', name: 'Irmã Lúmina', kind: 'priest', x: C - 12.5, y: C - 9 },
  { id: 'merchant', name: 'Borin, o Mercador', kind: 'merchant', x: C + 13, y: C - 9.5 },
  { id: 'innkeeper', name: 'Greta, a Taverneira', kind: 'innkeeper', x: C - 9.5, y: C + 13 },
  { id: 'captain', name: 'Capitã Mirela Varn', kind: 'captain', x: C + 4, y: C + 5.5 },
  { id: 'guard1', name: 'Sentinela Aldric', kind: 'guard', x: C - 1, y: C - 17 },
  { id: 'guard2', name: 'Sentinela Bren', kind: 'guard', x: C + 2, y: C + 18 },
];
const TEMPLE_SPAWN = { x: C - 11, y: C - 8 };
// Pontos de rio: da cachoeira (montanha ao norte) até o mar
const MOUNTAIN = { x: 24, y: 25, r: 11 };
const RIVER_PTS = [[34, 35], [39, 50], [37, 68], [43, 89], [62, 98], [84, 107], [103, 125]];

function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

function generateWorld() {
  const N = MAP_W * MAP_H;
  const ground = new Uint8Array(N), obj = new Uint8Array(N), zone = new Uint8Array(N);
  const bld = new Int8Array(N).fill(-1);
  const fl1 = new Uint8Array(N);       // andar 1: 1 = muralha, 2 = assoalho, 3 = topo de escada
  const stair = new Uint8Array(N);     // escadas: direção para onde sobem (1..4)
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
    const h = fbm(x / 18, y / 18, 7) + 0.32 - edge * edge * 0.7;
    const z = zoneOf(x, y);
    zone[i] = z;
    const n1 = fbm(x / 9, y / 9, 99), n2 = fbm(x / 6, y / 6, 31);
    let g;
    if (h < 0.35 || x < 2 || y < 2 || x > MAP_W - 3 || y > MAP_H - 3) g = T.WATER;
    else if (h < 0.385) g = T.SAND;
    else switch (z) {
      case Z.FIELDS: g = n1 > 0.64 ? T.FOREST : T.GRASS; break;
      case Z.FOREST: g = n1 > 0.42 ? T.FOREST : T.GRASS; break;
      case Z.SWAMP: g = n2 > 0.68 ? T.WATER : n2 > 0.42 ? T.SWAMP : T.GRASS; break;
      case Z.BONES: g = n2 > 0.6 ? T.DIRT : T.DEAD; break;
      case Z.ORCS: g = n1 > 0.5 ? T.DIRT : (n2 > 0.5 ? T.DEAD : T.GRASS); break;
      case Z.WILD: g = n2 > 0.7 ? T.STONE : n1 > 0.55 ? T.FOREST : T.GRASS; break;
      default: g = T.GRASS;
    }
    if (z === Z.VILLAGE && g !== T.WATER) g = T.GRASS;
    if (z === Z.VILLAGE) g = T.GRASS;
    ground[i] = g;
  }

  // montanha
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const d = Math.hypot(x - MOUNTAIN.x, y - MOUNTAIN.y) + (vnoise(x / 3, y / 3, 400) - 0.5) * 4;
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
    for (let t = 0; t < 1; t += 0.04) pts.push([catmull(p0[0], p1[0], p2[0], p3[0], t), catmull(p0[1], p1[1], p2[1], p3[1], t)]);
  }
  pts.push(P[P.length - 1]);
  const fords = new Set([Math.floor(pts.length * 0.3), Math.floor(pts.length * 0.62)]);
  pts.forEach(([px, py], k) => {
    const nx = pts[Math.min(pts.length - 1, k + 1)], fx = nx[0] - px, fy = nx[1] - py, fl = Math.hypot(fx, fy) || 1;
    const w = 1.5 + vnoise(k / 6, 0, 81) * 0.9;
    let ford = false;
    for (const f of fords) if (Math.abs(k - f) <= 2) ford = true;
    for (let yy = Math.floor(py - 3); yy <= py + 3; yy++) for (let xx = Math.floor(px - 3); xx <= px + 3; xx++) {
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
  for (let yy = pool[1] - 4; yy <= pool[1] + 4; yy++) for (let xx = pool[0] - 4; xx <= pool[0] + 4; xx++) {
    if (Math.hypot(xx - pool[0], yy - pool[1]) < 3.2 && ground[idx(xx, yy)] !== T.CLIFF) { ground[idx(xx, yy)] = T.WATER; river[idx(xx, yy)] = 1; flow[idx(xx, yy) * 2] = 0.5; flow[idx(xx, yy) * 2 + 1] = 0.7; }
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
        // água na frente de cada queda
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
    else if (z === Z.FIELDS) {
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
    if (d < MOUNTAIN.r + 3 && obj[i] === O.NONE && R(x, y, 50) < 0.3) obj[i] = R(x, y, 51) < 0.6 ? O.PINE : O.ROCK;
  }

  // estradas a partir dos portões do castelo
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const px = dy !== 0 ? 1 : 0, py = dx !== 0 ? 1 : 0;
    const start = dx > 0 || dy > 0 ? 9 : 8;
    let lastLand = 0;
    for (let k = start; k < CENTER - 2; k++) for (let w = 0; w < 2; w++) {
      const x = CENTER + dx * k + px * w, y = CENTER + dy * k + py * w;
      if (ground[idx(x, y)] !== T.WATER) lastLand = k;
    }
    for (let k = start; k <= lastLand; k++) for (let w = -1; w < 3; w++) {
      const x = CENTER + dx * k + px * w, y = CENTER + dy * k + py * w, i = idx(x, y);
      if (ground[i] === T.CLIFF) continue;
      if (w < 0 || w > 1) { if (BLOCKING.has(obj[i])) obj[i] = O.NONE; continue; }
      const wet = ground[i] === T.WATER || ground[i] === T.SHALLOW;
      ground[i] = wet ? T.BRIDGE : (k <= SAFE_R + 1 ? T.COBBLE : T.DIRT);
      obj[i] = O.NONE;
    }
  }

  // ---------- vila (dentro da paliçada) ----------
  const set = (x, y, g, o) => { const i = idx(x, y); if (g != null) ground[i] = g; if (o != null) obj[i] = o; };
  const isRoad = (x, y) => x === C || x === C + 1 || y === C || y === C + 1;
  for (let y = C - SAFE_R; y <= C + SAFE_R + 1; y++) for (let x = C - SAFE_R; x <= C + SAFE_R + 1; x++) if (!isRoad(x, y)) obj[idx(x, y)] = O.NONE;
  // caminhos até as portas
  for (let x = C - 14; x <= C - 8; x++) { set(x, C - 9, T.COBBLE); set(x, C - 8, T.COBBLE); }
  for (let y = C - 11; y <= C - 8; y++) { set(C + 12, y, T.COBBLE); set(C + 13, y, T.COBBLE); }
  for (let x = C + 9; x <= C + 13; x++) set(x, C - 8, T.COBBLE);
  for (let x = C - 11; x <= C - 8; x++) { set(x, C + 13, T.COBBLE); set(x, C + 12, T.COBBLE); }
  for (let y = C + 9; y <= C + 12; y++) set(C - 8, y, T.COBBLE);
  for (let x = C + 9; x <= C + 15; x++) set(x, C + 10, T.COBBLE);
  for (let y = C + 10; y <= C + 17; y++) set(C + 14, y, T.COBBLE);
  // paliçada com portões nas estradas
  const PR = SAFE_R;
  for (let k = -PR; k <= PR + 1; k++) {
    for (const [x, y] of [[C + k, C - PR], [C + k, C + PR + 1], [C - PR, C + k], [C + PR + 1, C + k]]) {
      if (isRoad(x, y)) continue;
      const nearGate = x === C - 1 || x === C + 2 || y === C - 1 || y === C + 2;
      set(x, y, null, nearGate ? O.TORCH : O.FENCE);
    }
  }
  // construções
  BUILDINGS.forEach((b, bi) => {
    for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) { bld[idx(x, y)] = bi; obj[idx(x, y)] = O.NONE; }
  });

  // ---------- castelo em ruínas ----------
  const { x0, y0, x1, y1 } = CASTLE;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    set(x, y, T.COBBLE, O.NONE);
    if (R(x, y, 610) < 0.32) set(x, y, T.GRASS); // pátio tomado pelo mato
  }
  const breach = new Set([idx(x1, C + 4), idx(x1, C + 5), idx(C - 4, y1), idx(C - 3, y1)]);
  const low = new Set([idx(x0, C + 4), idx(C + 4, y0), idx(C + 5, y0)]);
  const towers = [[x0, y0], [x1 - 1, y0], [x0, y1 - 1], [x1 - 1, y1 - 1]];
  const inTower = (x, y) => towers.some(([tx, ty]) => x >= tx && x <= tx + 1 && y >= ty && y <= ty + 1);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const onWall = x === x0 || x === x1 || y === y0 || y === y1;
    if (!onWall || inTower(x, y)) continue;
    const i = idx(x, y);
    if (isRoad(x, y)) { set(x, y, T.FLOORSTONE, O.GATE); fl1[i] = 1; continue; }
    if (breach.has(i)) { set(x, y, T.DIRT, O.RUBBLE); continue; }
    if (low.has(i)) { set(x, y, null, O.LOWWALL); continue; }
    set(x, y, null, R(x, y, 620) < 0.3 ? O.WALL : O.WALL);
    fl1[i] = 1;
  }
  for (const [tx, ty] of towers) {
    for (let y = ty; y <= ty + 1; y++) for (let x = tx; x <= tx + 1; x++) { set(x, y, T.FLOORSTONE, O.PART); fl1[idx(x, y)] = 1; }
    obj[idx(tx + 1, ty + 1)] = O.TOWER;   // âncora = tile da frente
  }
  // torre de menagem
  for (let y = KEEP.y0; y <= KEEP.y1; y++) for (let x = KEEP.x0; x <= KEEP.x1; x++) {
    const onWall = x === KEEP.x0 || x === KEEP.x1 || y === KEEP.y0 || y === KEEP.y1;
    const i = idx(x, y);
    set(x, y, T.FLOORSTONE, O.NONE);
    if (onWall) {
      if (y === KEEP.y1 && (x === C || x === C + 1)) { set(x, y, null, O.GATE); fl1[i] = 1; continue; } // porta
      if (x === KEEP.x1 && y === C) { set(x, y, null, O.RUBBLE); continue; } // brecha
      set(x, y, null, O.WALL); fl1[i] = 1;
    } else {
      fl1[i] = (x === C + 1 && y === C + 1) || (x === C + 2 && y === C + 1) ? 0 : 2; // assoalho com buracos
    }
  }
  // escadas (andar 0 -> 1)
  const stairs = [[x0 + 1, C + 3, 2], [x1 - 1, C - 4, 1], [KEEP.x0 + 1, KEEP.y0 + 1, 4]]; // [x, y, dir]
  for (const [sx, sy, d] of stairs) { set(sx, sy, T.FLOORSTONE, O.STAIRS); stair[idx(sx, sy)] = d; fl1[idx(sx, sy)] = 3; }
  // decoração do pátio
  const deco = [
    [C - 4, C + 5, O.FOUNTAIN], [C + 5, C - 4, O.STATUE], [C - 5, C - 5, O.BRAZIER], [C + 6, C + 6, O.BRAZIER],
    [C - 5, C + 2, O.RUBBLEBIG], [C + 6, C + 1, O.RUBBLEBIG], [C + 6, C + 3, O.DUMMY], [C + 6, C + 4, O.DUMMY],
    [C - 5, C - 2, O.BANNER], [C + 2, C - 5, O.BANNER], [C - 2, C + 6, O.CRATE], [C - 1, C + 6, O.BARREL],
    [C + 1, C - 4, O.RUBBLE], [C - 4, C - 1, O.RUBBLE], [C + 4, C + 2, O.RUBBLE], [C - 3, C + 4, O.RUBBLE],
  ];
  for (const [x, y, o] of deco) set(x, y, null, o);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (obj[idx(x, y)] === O.WALL && R(x, y, 630) < 0.35) obj[idx(x, y)] = O.WALL; // hera desenhada no sprite

  // decoração da vila
  const vdeco = [
    [C - 9, C - 10, O.LAMP], [C + 10, C - 9, O.LAMP], [C - 9, C + 10, O.LAMP], [C + 10, C + 9, O.LAMP],
    [C + 15, C - 10, O.STALL], [C + 16, C - 12, O.STALL], [C + 10, C - 13, O.CRATE], [C + 15, C - 14, O.BARREL],
    [C - 11, C + 11, O.BARREL], [C - 11, C + 15, O.BARREL], [C - 10, C + 16, O.BENCH],
    [C + 16, C + 15, O.WELL], [C + 17, C + 17, O.HAY], [C + 16, C + 9, O.HAY], [C + 17, C + 9, O.CRATE],
    [C - 10, C - 14, O.BANNER], [C - 10, C - 12, O.BANNER],
    [C - 14, C - 9, O.FLOWERBED], [C - 15, C - 9, O.FLOWERBED], [C + 12, C + 17, O.FLOWERBED],
    [C - 16, C - 3, O.TREE], [C - 12, C + 4, O.TREE], [C + 15, C + 3, O.TREE], [C + 4, C - 15, O.TREE], [C - 4, C + 15, O.PINE],
    [C + 16, C - 4, O.PINE], [C - 16, C + 6, O.BUSH], [C - 3, C - 16, O.BUSH], [C + 8, C + 16, O.BUSH], [C - 16, C - 16, O.PINE],
    [C + 17, C - 17, O.TREE], [C - 17, C + 17, O.TREE], [C + 17, C + 1 + 4, O.BUSH],
  ];
  for (const [x, y, o] of vdeco) if (bld[idx(x, y)] < 0 && !isRoad(x, y)) set(x, y, null, o);
  for (let k = 0; k < 90; k++) {
    const x = C - SAFE_R + 1 + Math.floor(R(k, 1, 900) * (SAFE_R * 2 - 1)), y = C - SAFE_R + 1 + Math.floor(R(k, 2, 900) * (SAFE_R * 2 - 1));
    const i = idx(x, y);
    if (x >= x0 - 1 && x <= x1 + 1 && y >= y0 - 1 && y <= y1 + 1) continue;
    if (ground[i] === T.GRASS && obj[i] === O.NONE && bld[i] < 0) obj[i] = R(k, 3, 900) < 0.45 ? O.FLOWER : O.TALLGRASS;
  }
  for (const n of NPCS) obj[idx(Math.round(n.x), Math.round(n.y))] = O.NONE;

  return { ground, obj, zone, bld, fl1, stair, height, flow, river };
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
