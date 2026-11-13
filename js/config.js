// ============================================================
//  CONFIGURAÃ‡ÃƒO â€” classes, skins, habilidades, monstros, missÃµes.
//  Mexa aqui para balancear o jogo.
// ============================================================
const GAME_NAME = 'World of Sxan';
const VERSION = 'v0.6.2';
const VERSION_NAME = 'HerÃ³is Forjados';

const PLAYER_SPEED = 3.6;          // tiles por segundo
const OUT_OF_COMBAT_MS = 5000;     // sem lutar por 5s = fora de combate (regenera)
const DOWNED_MS = 30000;           // tempo caÃ­do antes de renascer no templo
const REVIVE_MS = 3000;            // segurar F por 3s para reanimar
const VIEW_RADIUS = 20;            // distÃ¢ncia (tiles) que cada jogador "enxerga" na rede

// dmg: [mÃ­nimo base, mÃ­nimo por nÃ­vel], [mÃ¡ximo base, mÃ¡ximo por nÃ­vel]
const CLASSES = {
  knight: {
    name: 'Cavaleiro', role: 'Tank',
    desc: 'Veterano de armadura pesada. Segura a linha de frente, atrai os inimigos e protege os companheiros.',
    hp: [150, 24], mp: [30, 4], armor: 0.3, range: 1.45, atkMs: 1100, crit: 0.05,
    dmg: [[5, 1.6], [10, 2.4]], stats: { vida: 5, mana: 1, dano: 3, alcance: 1 },
    passive: { name: 'Pele de AÃ§o', desc: 'Recebe 30% menos dano de todas as fontes.' },
  },
  archer: {
    name: 'Atirador', role: 'Dano Ã  distÃ¢ncia',
    desc: 'CaÃ§ador paciente das fronteiras. Abate os alvos de longe com precisÃ£o letal.',
    hp: [105, 15], mp: [50, 6], armor: 0.1, range: 6, atkMs: 950, crit: 0.2,
    dmg: [[4, 1.4], [8, 2.2]], stats: { vida: 3, mana: 2, dano: 4, alcance: 5 },
    passive: { name: 'Olho de Ãguia', desc: '20% de chance de acerto crÃ­tico (dano x1.8).' },
  },
  mage: {
    name: 'Mago', role: 'Magia / Cura',
    desc: 'Erudito das artes antigas. Domina fogo e gelo e mantÃ©m os aliados de pÃ©.',
    hp: [90, 11], mp: [100, 13], armor: 0, range: 5.5, atkMs: 1250, crit: 0.05,
    dmg: [[3, 1.0], [6, 1.6]], stats: { vida: 2, mana: 5, dano: 5, alcance: 4 },
    passive: { name: 'Mente Arcana', desc: 'Regenera mana duas vezes mais rÃ¡pido.' },
  },
};

// Skins (visuais) de cada vocaÃ§Ã£o
const SKINS = {
  knight: [
    { id: 'iron', name: 'Guarda de Ferro', rarity: 'Comum' },
    { id: 'dragon', name: 'Cavaleiro DracÃ´nico', rarity: 'Rara' },
    { id: 'sun', name: 'Paladino da Aurora', rarity: 'LendÃ¡ria' },
  ],
  archer: [
    { id: 'scout', name: 'Batedor da Fronteira', rarity: 'Comum' },
    { id: 'winter', name: 'Patrulheiro do Inverno', rarity: 'Rara' },
    { id: 'sylvan', name: 'Arqueiro SÃ­lfide', rarity: 'LendÃ¡ria' },
  ],
  mage: [
    { id: 'adept', name: 'Adepto Arcano', rarity: 'Comum' },
    { id: 'astral', name: 'Arquimago Astral', rarity: 'Rara' },
    { id: 'druid', name: 'Druida Ancestral', rarity: 'LendÃ¡ria' },
  ],
};

// tgt: precisa de monstro como alvo Â· cast: tempo de conjuraÃ§Ã£o (ms)
const SKILLS = {
  knight: [
    { id: 'bash', name: 'Golpe Brutal', mp: 8, cd: 4000, tgt: true, range: 1.6, el: 'phys',
      desc: 'Golpe esmagador: 220% de dano e atordoa o alvo por 1,4s.' },
    { id: 'warcry', name: 'Grito de Guerra', mp: 12, cd: 12000, el: 'phys',
      desc: 'Atrai todos os inimigos em 5 tiles e reduz o dano recebido em 20% por 6s.' },
    { id: 'whirl', name: 'Redemoinho', mp: 15, cd: 8000, el: 'phys',
      desc: 'Gira a lÃ¢mina atingindo todos ao redor (1,8 tile) com 160% de dano.' },
    { id: 'wall', name: 'Muralha de Ferro', mp: 20, cd: 20000, el: 'holy',
      desc: 'Ergue o escudo: reduz o dano recebido em 60% por 6s.' },
  ],
  archer: [
    { id: 'double', name: 'Tiro Duplo', mp: 6, cd: 3000, tgt: true, range: 6.5, el: 'phys',
      desc: 'Duas flechas seguidas, cada uma com 100% de dano.' },
    { id: 'pierce', name: 'Flecha Perfurante', mp: 12, cd: 7000, tgt: true, range: 7, el: 'phys',
      desc: 'Atravessa todos os inimigos em linha reta: 180% de dano.' },
    { id: 'rain', name: 'Chuva de Flechas', mp: 18, cd: 10000, tgt: true, range: 6.5, el: 'phys',
      desc: 'Saraivada sobre a Ã¡rea do alvo: 130% de dano em todos.' },
    { id: 'agile', name: 'Passo Ãgil', mp: 10, cd: 15000, el: 'wind',
      desc: 'Por 6s: anda 60% mais rÃ¡pido, ataca 2x mais rÃ¡pido e +10% de crÃ­tico.' },
  ],
  mage: [
    { id: 'fireball', name: 'Bola de Fogo', mp: 10, cd: 2500, tgt: true, range: 6.5, cast: 700, el: 'fire',
      desc: 'Conjura uma bola de fogo: 260% de dano.' },
    { id: 'nova', name: 'Nova de Gelo', mp: 18, cd: 9000, el: 'ice',
      desc: 'ExplosÃ£o gÃ©lida ao redor (2,5 tiles): 140% de dano e lentidÃ£o por 4s.' },
    { id: 'heal', name: 'Luz Curativa', mp: 20, cd: 6000, el: 'holy',
      desc: 'Cura vocÃª e os aliados em 4 tiles. Reanima aliados caÃ­dos.' },
    { id: 'meteor', name: 'Chuva de Meteoros', mp: 35, cd: 18000, tgt: true, range: 6.5, cast: 1500, el: 'fire',
      desc: 'Meteoros caem na Ã¡rea do alvo (2,5 tiles): 320% de dano.' },
  ],
};

// Monstros. speed em tiles/s Â· aggro = distÃ¢ncia em que percebe o jogador
const MON = {
  rat:      { name: 'Ratazana',          hp: 18,  dmg: [1, 4],   xp: 6,   gold: [1, 3],   speed: 1.7, atk: 1400, aggro: 4 },
  slime:    { name: 'Lodo Vivo',         hp: 32,  dmg: [2, 5],   xp: 12,  gold: [2, 5],   speed: 1.2, atk: 1500, aggro: 4 },
  wolf:     { name: 'Lobo Cinzento',     hp: 60,  dmg: [4, 10],  xp: 28,  gold: [3, 8],   speed: 2.6, atk: 1100, aggro: 6 },
  spider:   { name: 'Aranha-TecelÃ£',     hp: 70,  dmg: [5, 11],  xp: 32,  gold: [4, 9],   speed: 2.2, atk: 1200, aggro: 5 },
  toad:     { name: 'Sapo-Boi do Brejo', hp: 80,  dmg: [5, 12],  xp: 35,  gold: [4, 10],  speed: 1.5, atk: 1300, aggro: 5 },
  goblin:   { name: 'Saqueador Goblin',  hp: 90,  dmg: [6, 14],  xp: 45,  gold: [8, 16],  speed: 2.3, atk: 1100, aggro: 6 },
  skeleton: { name: 'Esqueleto Errante', hp: 120, dmg: [8, 16],  xp: 60,  gold: [6, 14],  speed: 1.7, atk: 1300, aggro: 6 },
  orc:      { name: 'Orc Guerreiro',     hp: 180, dmg: [10, 22], xp: 95,  gold: [12, 25], speed: 2.0, atk: 1300, aggro: 7 },
  troll:    { name: 'Troll da Montanha', hp: 420, dmg: [18, 36], xp: 260, gold: [30, 60], speed: 1.5, atk: 1700, aggro: 6, big: true },
};
const MON_TYPES = Object.keys(MON);

// MissÃµes secundÃ¡rias (repetÃ­veis) dadas pela CapitÃ£ no pÃ¡tio do castelo
const QUESTS = [
  { id: 'q_rat', name: 'Praga nos Celeiros', mon: 'rat', count: 8, xp: 80, gold: 30, desc: 'As ratazanas estÃ£o devorando as reservas de grÃ£os. Elimine 8 delas nos Campos.' },
  { id: 'q_slime', name: 'Lodo nas Valas', mon: 'slime', count: 6, xp: 120, gold: 40, desc: 'Os lodos vivos estÃ£o entupindo as valas de irrigaÃ§Ã£o. Destrua 6.' },
  { id: 'q_wolf', name: 'Uivos no Bosque', mon: 'wolf', count: 6, xp: 260, gold: 70, desc: 'Uma alcateia vem atacando os lenhadores no Bosque Sombrio. Abata 6 lobos.' },
  { id: 'q_spider', name: 'Teias na Trilha', mon: 'spider', count: 5, xp: 280, gold: 75, desc: 'Aranhas-tecelÃ£s fecharam a trilha dos caÃ§adores. Mate 5.' },
  { id: 'q_toad', name: 'O Brejo Inquieto', mon: 'toad', count: 6, xp: 300, gold: 80, desc: 'Os sapos-boi do pÃ¢ntano estÃ£o cada vez mais agressivos. Elimine 6.' },
  { id: 'q_goblin', name: 'Saque Interrompido', mon: 'goblin', count: 8, xp: 520, gold: 120, desc: 'Saqueadores goblins roubaram uma caravana. Derrube 8 deles no Acampamento Orc.' },
  { id: 'q_skeleton', name: 'Descanso aos Mortos', mon: 'skeleton', count: 8, xp: 600, gold: 130, desc: 'Os mortos das Colinas de Ossos se levantaram. Devolva 8 deles ao descanso.' },
  { id: 'q_orc', name: 'LÃ¢minas do Oeste', mon: 'orc', count: 6, xp: 800, gold: 180, desc: 'Orcs guerreiros preparam um ataque. EnfraqueÃ§a as fileiras: 6 orcs.' },
  { id: 'q_troll', name: 'O Gigante da Montanha', mon: 'troll', count: 1, xp: 1000, gold: 250, desc: 'Um troll desceu da montanha da cachoeira. Derrube-o.' },
];
const MAX_ACTIVE_QUESTS = 3;

const ITEMS = {
  hp: { name: 'PoÃ§Ã£o de Vida', price: 20, desc: 'Recupera 35% da vida.' },
  mp: { name: 'PoÃ§Ã£o de Mana', price: 25, desc: 'Recupera 40% da mana.' },
};

const BUFF_NAMES = { warcry: 'Grito de Guerra', wall: 'Muralha de Ferro', agile: 'Passo Ãgil', bless: 'BÃªnÃ§Ã£o da Aurora', mead: 'Hidromel', whet: 'LÃ¢mina Afiada' };
const BUFF_BITS = { wall: 16, agile: 32, bless: 64, warcry: 128 };

const need = l => Math.floor(20 * Math.pow(l, 1.75));
const maxHpFor = (cls, l) => Math.floor(CLASSES[cls].hp[0] + CLASSES[cls].hp[1] * (l - 1));
const maxMpFor = (cls, l) => Math.floor(CLASSES[cls].mp[0] + CLASSES[cls].mp[1] * (l - 1));
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const rint = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
