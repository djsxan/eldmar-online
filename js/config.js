// ============================================================
//  CONFIGURAÇÃO — classes, habilidades, monstros e itens.
//  Mexa aqui para balancear o jogo.
// ============================================================
const VERSION = 'v0.2.0';
const VERSION_NAME = 'Era das Vocações';

const STEP_MS = 240;           // tempo para andar 1 tile
const OUT_OF_COMBAT_MS = 5000; // sem lutar por 5s = fora de combate (regenera)

// dmg: [mínimo base, mínimo por nível], [máximo base, máximo por nível]
const CLASSES = {
  knight: {
    name: 'Cavaleiro', role: 'Tank', color: '#9ca3af',
    desc: 'Guerreiro de armadura pesada. Aguenta o dano, provoca os inimigos e protege o grupo.',
    hp: [150, 24], mp: [30, 4], armor: 0.3, range: 1, atkMs: 1100, crit: 0.05,
    dmg: [[5, 1.6], [10, 2.4]], stats: { vida: 5, mana: 1, dano: 3, alcance: 1 },
    passive: { name: 'Pele de Aço', desc: 'Recebe 30% menos dano de todas as fontes.' },
  },
  archer: {
    name: 'Atirador', role: 'Dano à distância', color: '#65a30d',
    desc: 'Mestre do arco. Ataca de longe com flechas rápidas e golpes críticos.',
    hp: [105, 15], mp: [50, 6], armor: 0.1, range: 6, atkMs: 950, crit: 0.2,
    dmg: [[4, 1.4], [8, 2.2]], stats: { vida: 3, mana: 2, dano: 4, alcance: 5 },
    passive: { name: 'Olho de Águia', desc: '20% de chance de acerto crítico (dano x1.8).' },
  },
  mage: {
    name: 'Mago', role: 'Magia / Cura', color: '#7c3aed',
    desc: 'Estudioso das artes arcanas. Lança fogo e gelo e cura os aliados.',
    hp: [90, 11], mp: [100, 13], armor: 0, range: 5, atkMs: 1250, crit: 0.05,
    dmg: [[3, 1.0], [6, 1.6]], stats: { vida: 2, mana: 5, dano: 5, alcance: 4 },
    passive: { name: 'Mente Arcana', desc: 'Regenera mana duas vezes mais rápido.' },
  },
};

// tgt: precisa de monstro como alvo · cast: tempo de conjuração (ms)
const SKILLS = {
  knight: [
    { id: 'bash', name: 'Golpe Brutal', mp: 8, cd: 4000, tgt: true, range: 1, el: 'phys',
      desc: 'Golpe esmagador: 220% de dano e atordoa o alvo por 1,2s.' },
    { id: 'warcry', name: 'Grito de Guerra', mp: 12, cd: 12000, el: 'phys',
      desc: 'Provoca todos os monstros em 5 tiles para atacarem você e reduz o dano recebido em 20% por 6s.' },
    { id: 'whirl', name: 'Redemoinho', mp: 15, cd: 8000, el: 'phys',
      desc: 'Gira a espada atingindo todos os inimigos ao redor com 160% de dano.' },
    { id: 'wall', name: 'Muralha de Ferro', mp: 20, cd: 20000, el: 'holy',
      desc: 'Ergue o escudo: reduz o dano recebido em 60% por 6s.' },
  ],
  archer: [
    { id: 'double', name: 'Tiro Duplo', mp: 6, cd: 3000, tgt: true, range: 6, el: 'phys',
      desc: 'Dispara duas flechas seguidas, cada uma com 100% de dano.' },
    { id: 'pierce', name: 'Flecha Perfurante', mp: 12, cd: 7000, tgt: true, range: 7, el: 'phys',
      desc: 'Flecha que atravessa todos os inimigos em linha reta: 180% de dano.' },
    { id: 'rain', name: 'Chuva de Flechas', mp: 18, cd: 10000, tgt: true, range: 6, el: 'phys',
      desc: 'Uma saraivada cai sobre a área do alvo: 130% de dano em todos.' },
    { id: 'agile', name: 'Passo Ágil', mp: 10, cd: 15000, el: 'wind',
      desc: 'Por 6s: anda 60% mais rápido, ataca 2x mais rápido e +10% de crítico.' },
  ],
  mage: [
    { id: 'fireball', name: 'Bola de Fogo', mp: 10, cd: 2500, tgt: true, range: 6, cast: 700, el: 'fire',
      desc: 'Conjura uma bola de fogo: 260% de dano.' },
    { id: 'nova', name: 'Nova de Gelo', mp: 18, cd: 9000, el: 'ice',
      desc: 'Explosão gélida ao seu redor (2 tiles): 140% de dano e deixa os inimigos lentos por 4s.' },
    { id: 'heal', name: 'Luz Curativa', mp: 20, cd: 6000, el: 'holy',
      desc: 'Cura você e todos os aliados em 4 tiles.' },
    { id: 'meteor', name: 'Chuva de Meteoros', mp: 35, cd: 18000, tgt: true, range: 6, cast: 1500, el: 'fire',
      desc: 'Meteoros caem na área do alvo (2 tiles): 320% de dano.' },
  ],
};

// Monstros. aggro = distância em que percebe o jogador
const MON = {
  rat:      { name: 'Ratazana',       hp: 18,  dmg: [1, 4],   xp: 6,   gold: [1, 3],   speed: 650, atk: 1400, aggro: 4 },
  slime:    { name: 'Gosma',          hp: 32,  dmg: [2, 5],   xp: 12,  gold: [2, 5],   speed: 800, atk: 1500, aggro: 4 },
  wolf:     { name: 'Lobo Cinzento',  hp: 60,  dmg: [4, 10],  xp: 28,  gold: [3, 8],   speed: 430, atk: 1100, aggro: 6 },
  spider:   { name: 'Aranha Gigante', hp: 70,  dmg: [5, 11],  xp: 32,  gold: [4, 9],   speed: 500, atk: 1200, aggro: 5 },
  toad:     { name: 'Sapo do Brejo',  hp: 80,  dmg: [5, 12],  xp: 35,  gold: [4, 10],  speed: 720, atk: 1300, aggro: 5 },
  goblin:   { name: 'Goblin',         hp: 90,  dmg: [6, 14],  xp: 45,  gold: [8, 16],  speed: 460, atk: 1100, aggro: 6 },
  skeleton: { name: 'Esqueleto',      hp: 120, dmg: [8, 16],  xp: 60,  gold: [6, 14],  speed: 600, atk: 1300, aggro: 6 },
  orc:      { name: 'Orc Guerreiro',  hp: 180, dmg: [10, 22], xp: 95,  gold: [12, 25], speed: 520, atk: 1300, aggro: 7 },
  troll:    { name: 'Troll da Montanha', hp: 420, dmg: [18, 36], xp: 260, gold: [30, 60], speed: 660, atk: 1700, aggro: 6, big: true },
};

const ITEMS = {
  hp: { name: 'Poção de Vida', price: 20, desc: 'Recupera 35% da vida.' },
  mp: { name: 'Poção de Mana', price: 25, desc: 'Recupera 40% da mana.' },
};

const BUFF_NAMES = {
  warcry: 'Grito de Guerra', wall: 'Muralha de Ferro', agile: 'Passo Ágil',
  bless: 'Bênção da Aurora', mead: 'Hidromel',
};

const need = l => Math.floor(20 * Math.pow(l, 1.75));          // xp para passar de nível
const maxHpFor = (cls, l) => Math.floor(CLASSES[cls].hp[0] + CLASSES[cls].hp[1] * (l - 1));
const maxMpFor = (cls, l) => Math.floor(CLASSES[cls].mp[0] + CLASSES[cls].mp[1] * (l - 1));
const cheb = (ax, ay, bx, by) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));
const rint = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
