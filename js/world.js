// ============================================================
//  MUNDO — mapa gerado por código (é igual para todos os jogadores,
//  porque usa sempre a mesma "semente" de números aleatórios)
// ============================================================
const MAP_W = 96, MAP_H = 96, CENTER = 48, SAFE_R = 6;

// Tipos de chão
const T = { WATER: 0, SAND: 1, GRASS: 2, FOREST: 3, STONE: 4, DIRT: 5, BRIDGE: 6 };
// Objetos em cima do chão
const O = { NONE: 0, TREE: 1, PINE: 2, ROCK: 3, BUSH: 4, FLOWER: 5, FOUNTAIN: 6, LAMP: 7 };
const BLOCKING = new Set([O.TREE, O.PINE, O.ROCK, O.FOUNTAIN, O.LAMP]);
const DIRS8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

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

function generateWorld() {
  const ground = new Uint8Array(MAP_W * MAP_H);
  const obj = new Uint8Array(MAP_W * MAP_H);

  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const i = y * MAP_W + x;
      const dx = x - CENTER, dy = y - CENTER;
      const edge = Math.sqrt(dx * dx + dy * dy) / (MAP_W / 2);
      // altura: ruído + formato de ilha (mais baixo nas bordas)
      const h = fbm(x / 16, y / 16, 7) + 0.25 - edge * edge * 0.6;

      let g;
      if (h < 0.35 || x < 2 || y < 2 || x > MAP_W - 3 || y > MAP_H - 3) g = T.WATER;
      else if (h < 0.40) g = T.SAND;
      else g = fbm(x / 10, y / 10, 99) > 0.55 ? T.FOREST : T.GRASS;

      const town = Math.abs(dx) <= SAFE_R && Math.abs(dy) <= SAFE_R;
      if (town) g = T.STONE;
      ground[i] = g;

      let o = O.NONE;
      const r = hash2(x, y, 4242);
      if (g === T.FOREST) {
        if (r < 0.26) o = O.TREE; else if (r < 0.34) o = O.PINE; else if (r < 0.40) o = O.BUSH;
      } else if (g === T.GRASS) {
        if (r < 0.035) o = O.TREE; else if (r < 0.05) o = O.ROCK; else if (r < 0.09) o = O.BUSH; else if (r < 0.16) o = O.FLOWER;
      } else if (g === T.SAND) {
        if (r < 0.03) o = O.ROCK;
      }
      obj[i] = o;
    }
  }

  // Estradas saindo da cidade nas 4 direções (com pontes sobre a água)
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const px = dy !== 0 ? 1 : 0, py = dx !== 0 ? 1 : 0; // perpendicular (largura 2)
    let lastLand = 0;
    for (let k = SAFE_R + 1; k < CENTER - 2; k++) {
      for (let w = 0; w < 2; w++) {
        const x = CENTER + dx * k + px * w, y = CENTER + dy * k + py * w;
        if (ground[y * MAP_W + x] !== T.WATER) lastLand = k;
      }
    }
    for (let k = SAFE_R + 1; k <= lastLand; k++) {
      for (let w = 0; w < 2; w++) {
        const x = CENTER + dx * k + px * w, y = CENTER + dy * k + py * w;
        const i = y * MAP_W + x;
        ground[i] = ground[i] === T.WATER ? T.BRIDGE : T.DIRT;
        obj[i] = O.NONE;
      }
    }
  }

  // Cidade: fonte no centro e postes de luz nos cantos
  obj[CENTER * MAP_W + CENTER] = O.FOUNTAIN;
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    obj[(CENTER + sy * SAFE_R) * MAP_W + (CENTER + sx * SAFE_R)] = O.LAMP;
  }

  return { ground, obj };
}

const WORLD = generateWorld();

function inBounds(x, y) { return x >= 0 && y >= 0 && x < MAP_W && y < MAP_H; }
function walkable(x, y) {
  if (!inBounds(x, y)) return false;
  const i = y * MAP_W + x;
  return WORLD.ground[i] !== T.WATER && !BLOCKING.has(WORLD.obj[i]);
}
// Zona protegida (cidade): monstros não entram e ninguém luta aqui
function inSafe(x, y) { return Math.abs(x - CENTER) <= SAFE_R && Math.abs(y - CENTER) <= SAFE_R; }
