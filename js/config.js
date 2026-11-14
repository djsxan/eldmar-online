// ============================================================
//  CONFIGURAÇÃO — classes, skins, habilidades, monstros, missões.
//  Mexa aqui para balancear o jogo.
// ============================================================
const GAME_NAME = 'World of Sxan';
const VERSION = 'v1.12.0';
const VERSION_NAME = 'Natureza';

const PLAYER_SPEED = 2.7;          // tiles por segundo (1 tile ≈ 2 m)
// configurações do jogador (menu de pausa)
const SET = (() => { const d = { quality: (typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches) ? 'low' : 'high', bright: 1, zoom: 1, phys: 'ragdoll', tele: 'soft', duel: false, pad: (typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches) ? 0.75 : 0.5 }; try { return Object.assign(d, JSON.parse(localStorage.getItem('wos-settings') || '{}')); } catch (e) { return d; } })();
function saveSettings() { try { localStorage.setItem('wos-settings', JSON.stringify(SET)); } catch (e) { } }
const STAIR_N = 5;                 // escadas: 5 tiles de rampa até o alto da muralha
const SKIN_LVL = [1, 10, 20];      // nível para liberar cada skin (comum, rara, lendária)
const RUN_MUL = 1.65;              // correr (SHIFT) multiplica a velocidade
const STAM_MAX = 100, STAM_DRAIN = 22, STAM_REGEN = 17, STAM_DELAY = 900; // estamina: gasta correndo, volta parado/andando
const OUT_OF_COMBAT_MS = 5000;     // sem lutar por 5s = fora de combate (regenera)
const DOWNED_MS = 30000;           // tempo caído antes de renascer no templo
const REVIVE_MS = 3000;            // segurar F por 3s para reanimar
const VIEW_RADIUS = 20;            // distância (tiles) que cada jogador "enxerga" na rede

// dmg: [mínimo base, mínimo por nível], [máximo base, máximo por nível]
const CLASSES = {
  knight: {
    name: 'Cavaleiro', role: 'Tank',
    desc: 'Veterano de armadura pesada. Segura a linha de frente, atrai os inimigos e protege os companheiros.',
    hp: [150, 24], mp: [30, 4], armor: 0.3, range: 1.45, atkMs: 1100, crit: 0.05,
    dmg: [[5, 1.6], [10, 2.4]], stats: { vida: 5, mana: 1, dano: 3, alcance: 1 },
    passive: { name: 'Pele de Aço', desc: 'Recebe 30% menos dano de todas as fontes.' },
  },
  archer: {
    name: 'Atirador', role: 'Dano à distância',
    desc: 'Caçador paciente das fronteiras. Abate os alvos de longe com precisão letal.',
    hp: [105, 15], mp: [50, 6], armor: 0.1, range: 6, atkMs: 950, crit: 0.2,
    dmg: [[4, 1.4], [8, 2.2]], stats: { vida: 3, mana: 2, dano: 4, alcance: 5 },
    passive: { name: 'Olho de Águia', desc: '20% de chance de acerto crítico (dano x1.8).' },
  },
  mage: {
    name: 'Mago', role: 'Magia / Cura',
    desc: 'Erudito das artes antigas. Domina fogo e gelo e mantém os aliados de pé.',
    hp: [90, 11], mp: [100, 13], armor: 0, range: 5.5, atkMs: 1250, crit: 0.05,
    dmg: [[3, 1.0], [6, 1.6]], stats: { vida: 2, mana: 5, dano: 5, alcance: 4 },
    passive: { name: 'Mente Arcana', desc: 'Regenera mana duas vezes mais rápido.' },
  },
};

// Skins (visuais) de cada vocação
const SKINS = {
  knight: [
    { id: 'iron', name: 'Guarda de Ferro', rarity: 'Comum' },
    { id: 'dragon', name: 'Cavaleiro Dracônico', rarity: 'Rara' },
    { id: 'sun', name: 'Paladino da Aurora', rarity: 'Lendária' },
  ],
  archer: [
    { id: 'scout', name: 'Batedor da Fronteira', rarity: 'Comum' },
    { id: 'winter', name: 'Patrulheiro do Inverno', rarity: 'Rara' },
    { id: 'sylvan', name: 'Arqueiro Sílfide', rarity: 'Lendária' },
  ],
  mage: [
    { id: 'adept', name: 'Adepto Arcano', rarity: 'Comum' },
    { id: 'astral', name: 'Arquimago Astral', rarity: 'Rara' },
    { id: 'druid', name: 'Druida Ancestral', rarity: 'Lendária' },
  ],
};

// tgt: precisa de monstro como alvo · cast: tempo de conjuração (ms)
const SKILLS = {
  knight: [
    { id: 'bash', name: 'Golpe Brutal', mp: 8, cd: 4000, tgt: true, range: 1.6, el: 'phys',
      desc: 'Golpe esmagador: 220% de dano e atordoa o alvo por 1,4s.' },
    { id: 'warcry', name: 'Grito de Guerra', mp: 12, cd: 12000, el: 'phys',
      desc: 'Atrai todos os inimigos em 5 tiles e reduz o dano recebido em 20% por 6s.' },
    { id: 'whirl', name: 'Redemoinho', mp: 15, cd: 8000, el: 'phys',
      desc: 'Gira a lâmina atingindo todos ao redor (1,8 tile) com 160% de dano.' },
    { id: 'wall', name: 'Muralha de Ferro', mp: 20, cd: 20000, el: 'holy',
      desc: 'Ergue o escudo: reduz o dano recebido em 60% por 6s.' },
  ],
  archer: [
    { id: 'double', name: 'Tiro Duplo', mp: 6, cd: 3000, tgt: true, range: 6.5, el: 'phys',
      desc: 'Duas flechas seguidas, cada uma com 100% de dano.' },
    { id: 'pierce', name: 'Flecha Perfurante', mp: 12, cd: 7000, tgt: true, range: 7, el: 'phys',
      desc: 'Atravessa todos os inimigos em linha reta: 180% de dano.' },
    { id: 'rain', name: 'Chuva de Flechas', mp: 18, cd: 10000, tgt: true, range: 6.5, el: 'phys',
      desc: 'Saraivada sobre a área do alvo: 130% de dano em todos.' },
    { id: 'agile', name: 'Passo Ágil', mp: 10, cd: 15000, el: 'wind',
      desc: 'Por 6s: anda 60% mais rápido, ataca 2x mais rápido e +10% de crítico.' },
  ],
  mage: [
    { id: 'fireball', name: 'Bola de Fogo', mp: 10, cd: 2500, tgt: true, range: 6.5, cast: 700, el: 'fire',
      desc: 'Conjura uma bola de fogo: 260% de dano.' },
    { id: 'nova', name: 'Nova de Gelo', mp: 18, cd: 9000, el: 'ice',
      desc: 'Explosão gélida ao redor (2,5 tiles): 140% de dano e lentidão por 4s.' },
    { id: 'heal', name: 'Luz Curativa', mp: 20, cd: 6000, el: 'holy',
      desc: 'Cura você e os aliados em 4 tiles. Reanima aliados caídos.' },
    { id: 'meteor', name: 'Chuva de Meteoros', mp: 35, cd: 18000, tgt: true, range: 6.5, cast: 1500, el: 'fire',
      desc: 'Meteoros caem na área do alvo (2,5 tiles): 320% de dano.' },
  ],
};

// Monstros. speed em tiles/s · aggro = distância em que percebe o jogador
const MON = {
  // fauna (beh: flee = foge ao ser atacada · retal = revida · pred = predador que só caça os fracos). Animais não carregam ouro: o lucro vem dos recursos.
  rat:      { name: 'Ratazana',          hp: 18,  dmg: [1, 3],   xp: 5,   gold: [0, 0],   speed: 2.2, atk: 1400, aggro: 0, beh: 'flee' },
  deer:     { name: 'Cervo',             hp: 45,  dmg: [0, 0],   xp: 14,  gold: [0, 0],   speed: 3.6, atk: 1400, aggro: 0, beh: 'flee' },
  boar:     { name: 'Javali',            hp: 85,  dmg: [5, 11],  xp: 30,  gold: [0, 0],   speed: 2.6, atk: 1300, aggro: 0, beh: 'retal' },
  slime:    { name: 'Lodo Vivo',         hp: 32,  dmg: [2, 5],   xp: 12,  gold: [2, 5],   speed: 1.2, atk: 1500, aggro: 4 },
  wolf:     { name: 'Lobo Cinzento',     hp: 60,  dmg: [4, 10],  xp: 28,  gold: [0, 0],   speed: 2.8, atk: 1100, aggro: 7, beh: 'pred' },
  spider:   { name: 'Aranha-Tecelã',     hp: 50,  dmg: [3, 7],   xp: 20,  gold: [0, 0],   speed: 2.4, atk: 1200, aggro: 0, beh: 'flee' },
  toad:     { name: 'Sapo-Boi do Brejo', hp: 55,  dmg: [3, 7],   xp: 20,  gold: [0, 0],   speed: 1.8, atk: 1300, aggro: 0, beh: 'flee' },
  goblin:   { name: 'Saqueador Goblin',  hp: 90,  dmg: [6, 14],  xp: 45,  gold: [8, 16],  speed: 2.3, atk: 1100, aggro: 6 },
  skeleton: { name: 'Esqueleto Errante', hp: 120, dmg: [8, 16],  xp: 60,  gold: [6, 14],  speed: 1.7, atk: 1300, aggro: 6 },
  orc:      { thrower: true, name: 'Orc Guerreiro',     hp: 180, dmg: [10, 22], xp: 95,  gold: [12, 25], speed: 2.0, atk: 1300, aggro: 7 },
  // thrower: arremessa pedras de longe
  troll:    { thrower: true, name: 'Troll da Montanha', hp: 420, dmg: [18, 36], xp: 260, gold: [30, 60], speed: 1.5, atk: 1700, aggro: 6, big: true, boss: true, trophy: 'trolltusk' },
  // inimigos dos bastiões
  bandit:   { name: 'Bandido',           hp: 110, dmg: [7, 14],  xp: 50,  gold: [6, 14],  speed: 2.3, atk: 1100, aggro: 6 },
  deserter: { name: 'Desertor',          hp: 170, dmg: [9, 19],  xp: 80,  gold: [10, 22], speed: 2.0, atk: 1250, aggro: 6 },
  wisp:     { name: 'Fogo-Fátuo',        hp: 60,  dmg: [4, 8],   xp: 45,  gold: [0, 0],   speed: 2.6, atk: 1500, aggro: 7, drain: 10, cs: 1.7 },
  // chefes (ao morrer deixam um baú para quem lutou)
  orcchief: { thrower: true, name: 'Grukk, Chefe Orc',  hp: 750, dmg: [16, 30], xp: 420, gold: [60, 100], speed: 1.9, atk: 1400, aggro: 7, big: true, boss: true, base: 'orc', trophy: 'orcbanner' },
  cryptlord: { name: 'Senhor da Cripta', hp: 620, dmg: [14, 26], xp: 400, gold: [40, 80], speed: 1.7, atk: 1350, aggro: 7, big: true, boss: true, base: 'skeleton', trophy: 'cryptcrown' },
  deserterchief: { name: 'Capitão Varrick', hp: 680, dmg: [15, 28], xp: 410, gold: [70, 120], speed: 2.0, atk: 1250, aggro: 7, big: true, boss: true, base: 'deserter', trophy: 'insignia' },
  dragon:   { name: 'Drakhar, o Flagelo Rubro', hp: 2800, dmg: [30, 48], xp: 1600, gold: [150, 260], speed: 1.5, atk: 1700, aggro: 6, big: true, boss: true, dragon: true, rad: 2.4, trophy: 'dragonscale' },
  elderslime: { name: 'Lodo Ancião',     hp: 480, dmg: [10, 20], xp: 300, gold: [0, 0],   speed: 1.1, atk: 1600, aggro: 6, big: true, boss: true, base: 'slime', cs: 1.9, trophy: 'slimecore' },
};
for (const k in MON) MON[k].speed *= 0.75; // escala nova do mundo
const MON_TYPES = Object.keys(MON);

// Missões secundárias (repetíveis) dadas pela Capitã no pátio do castelo
const QUESTS = [
  { id: 'q_rat', name: 'Praga nos Celeiros', mon: 'rat', count: 8, xp: 80, gold: 30, desc: 'As ratazanas estão devorando as reservas de grãos. Elimine 8 delas nos Campos.' },
  { id: 'q_slime', name: 'Lodo nas Valas', mon: 'slime', count: 6, xp: 120, gold: 40, desc: 'Os lodos vivos estão entupindo as valas de irrigação. Destrua 6.' },
  { id: 'q_wolf', name: 'Uivos no Bosque', mon: 'wolf', count: 6, xp: 260, gold: 70, desc: 'Uma alcateia vem atacando os lenhadores no Bosque Sombrio. Abata 6 lobos.' },
  { id: 'q_spider', name: 'Teias na Trilha', mon: 'spider', count: 5, xp: 280, gold: 75, desc: 'Aranhas-tecelãs fecharam a trilha dos caçadores. Mate 5.' },
  { id: 'q_toad', name: 'O Brejo Inquieto', mon: 'toad', count: 6, xp: 300, gold: 80, desc: 'Os sapos-boi do pântano estão cada vez mais agressivos. Elimine 6.' },
  { id: 'q_goblin', name: 'Saque Interrompido', mon: 'goblin', count: 8, xp: 520, gold: 120, desc: 'Saqueadores goblins roubaram uma caravana. Derrube 8 deles no Acampamento Orc.' },
  { id: 'q_skeleton', name: 'Descanso aos Mortos', mon: 'skeleton', count: 8, xp: 600, gold: 130, desc: 'Os mortos das Colinas de Ossos se levantaram. Devolva 8 deles ao descanso.' },
  { id: 'q_orc', name: 'Lâminas do Oeste', mon: 'orc', count: 6, xp: 800, gold: 180, desc: 'Orcs guerreiros preparam um ataque. Enfraqueça as fileiras: 6 orcs.' },
  { id: 'q_troll', name: 'O Gigante da Montanha', mon: 'troll', count: 1, xp: 1000, gold: 250, desc: 'Um troll desceu da montanha da cachoeira. Derrube-o.' },
];
const MAX_ACTIVE_QUESTS = 3;

const ITEMS = {
  hp: { name: 'Poção de Vida', price: 20, desc: 'Recupera 35% da vida.' },
  mp: { name: 'Poção de Mana', price: 25, desc: 'Recupera 40% da mana.' },
  water: { name: 'Odre (5 goles)', price: 12, desc: 'Água para a viagem. Clique para beber; encha na água (F).' },
  band: { name: 'Bandagem', price: 8, desc: 'Estanca o sangramento da pior ferida. Tecla B (perto do fogo, sem bandagem, cauteriza).' },
};

// saque dos monstros (vai para o inventário; o mercador compra)
// agachar (C) e deslizar (C + Shift correndo)
// estados de vida: à beira da morte < 25%; de joelhos < 15% (anda 50% mais devagar, sem habilidades, ataque mais fraco)
const DYING_HP = 0.25, KNEEL_HP = 0.15, KNEEL_MUL = 0.5, AID_MS = 2000, AID_HEAL = 0.2;
const CROUCH_MUL = 0.5, SLIDE_MS = 600, SLIDE_COST = 22;
const LOOT = {
  rattail:  { name: 'Rabo de Ratazana', price: 4,   icon: '〰', color: '#c8a090', desc: 'Fino e pelado. Alguém paga por isso.' },
  goo:      { name: 'Gosma Viva',       price: 6,   icon: '●', color: '#6ad84a', desc: 'Ainda se mexe um pouco.' },
  pelt:     { name: 'Pele de Lobo',     price: 22,  icon: '▰', color: '#9a9a9a', desc: 'Grossa e quente. Os alfaiates adoram.' },
  silk:     { name: 'Seda de Aranha',   price: 14,  icon: '❋', color: '#e8e8f0', desc: 'Fio resistente como corda.' },
  toadskin: { name: 'Couro de Sapo',    price: 13,  icon: '◆', color: '#7a9a4a', desc: 'Úmido e elástico.' },
  trinket:  { name: 'Bugiganga Goblin', price: 20,  icon: '✧', color: '#e8c040', desc: 'Roubada de alguém, com certeza.' },
  bone:     { name: 'Osso Antigo',      price: 18,  icon: '✕', color: '#e8dcc0', desc: 'Velho, mas ainda inteiro.' },
  tusk:     { name: 'Presa de Orc',     price: 28,  icon: '◣', color: '#f0e8d0', desc: 'Troféu de guerra.' },
  trollheart: { name: 'Coração de Troll', price: 120, icon: '♥', color: '#c83a3a', desc: 'Ainda quente. Raríssimo.' },
  hide:     { name: 'Couro de Cervo',   price: 16,  icon: '▰', color: '#b08050', desc: 'Couro macio, bom para botas e luvas.' },
  venison:  { name: 'Carne de Cervo',   price: 9,   icon: '◖', color: '#c85a4a', desc: 'Carne crua. Asse no fogo (F perto de uma fogueira) ou coma crua (pode passar mal).' },
  boartusk: { name: 'Presa de Javali',  price: 18,  icon: '◣', color: '#e8dcc0', desc: 'Curva e afiada como faca.' },
  pork:     { name: 'Carne de Javali',  price: 11,  icon: '◖', color: '#d87a6a', desc: 'Carne crua. Asse no fogo (F perto de uma fogueira) ou coma crua (pode passar mal).' },
  pouch:    { name: 'Bolsa Roubada',    price: 26,  icon: '◍', color: '#a8844a', desc: 'Moedas de algum viajante azarado.' },
  rustblade: { name: 'Lâmina Enferrujada', price: 24, icon: '⟋', color: '#a87a5a', desc: 'Espada de um soldado que fugiu da guerra.' },
  wispdust: { name: 'Pó Fantasma',      price: 32,  icon: '✺', color: '#8affd0', desc: 'Brilha fraquinho no escuro.' },
  orcbanner: { name: 'Estandarte de Grukk', price: 160, icon: '⚑', color: '#c83a2a', desc: 'Troféu do chefe do Acampamento Orc.' },
  cryptcrown: { name: 'Coroa do Senhor da Cripta', price: 180, icon: '♛', color: '#d8c070', desc: 'Ouro velho e frio, tirado de um morto.' },
  insignia: { name: 'Insígnia do Capitão', price: 170, icon: '✠', color: '#c8c8d0', desc: 'Prova de que Varrick caiu.' },
  slimecore: { name: 'Núcleo do Lodo Ancião', price: 130, icon: '◉', color: '#5ad84a', desc: 'Pulsa como um coração verde.' },
  trolltusk: { name: 'Presa do Troll',  price: 150, icon: '◣', color: '#f0e8d0', desc: 'Do tamanho de um braço.' },
  dragonscale: { name: 'Escama de Dragão', price: 420, icon: '⬢', color: '#c83a2a', desc: 'Dura como aço e ainda morna. O troféu mais raro de Sxan.' },
  bread:    { name: 'Pão',              price: 4,   icon: '◒', color: '#d8a860', desc: 'Pão dormido da taverna. Mata a fome. Clique para comer.' },
  cookedmeat: { name: 'Carne Assada',   price: 12,  icon: '◖', color: '#a8582a', desc: 'Carne de caça assada no fogo. Alimenta bem. Clique para comer.' },
  berries:  { name: 'Frutas Silvestres', price: 3, icon: '❀', color: '#c8283a', desc: 'Colhidas no mato. Matam um pouco a fome. Clique para comer.' },
  herb:     { name: 'Erva Medicinal',   price: 8,   icon: '❦', color: '#6aa84a', desc: 'Mastigue para baixar a febre e estancar sangramentos leves. Clique para usar.' },
  ointment: { name: 'Unguento',         price: 25,  icon: '⚱', color: '#7ab86a', desc: 'Ervas e banha. Cura infecção. Clique para usar.' },
  firewood: { name: 'Lenha',            price: 5,   icon: '≡', color: '#8a6a3a', desc: 'Clique para acender uma fogueira à sua frente (dura 3 min).' },
  gem:      { name: 'Gema Bruta',       price: 55,  icon: '◈', color: '#5ad0f0', desc: 'Pedra preciosa sem lapidar.' },
};
// recursos de cada criatura: [item, chance]
const MON_LOOT = {
  rat: [['rattail', 0.85]], deer: [['hide', 1], ['venison', 0.75]], boar: [['boartusk', 0.9], ['pork', 0.8]], wolf: [['pelt', 0.95]],
  bandit: [['pouch', 0.35]], deserter: [['rustblade', 0.4]], wisp: [['wispdust', 0.6]],
  spider: [['silk', 0.85]], toad: [['toadskin', 0.85]], slime: [['goo', 0.55]], goblin: [['trinket', 0.55]], skeleton: [['bone', 0.55]], orc: [['tusk', 0.55]], troll: [['trollheart', 1]],
};
const INV_SLOTS = 24;
// modo criador (O Tecelão): abrir com ?criador e digitar a senha. Aqui fica só o hash SHA-256 da senha.
const DEV_HASH = '33345481d244e1b08304a2f808f595f84bffc248ffbb9169fd6bb9dd41e0ab68';
// bastiões: cada monstro volta ~3 min depois de morrer (sem jogador perto); chefe ~10 min; o baú do chefe dura 2 min
const BASTION_RESPAWN = 180000, BOSS_RESPAWN = 600000, CHEST_MS = 120000, MAX_WILD = 200;
// ===== corpo: partes, feridas e sangramento (fase 1) =====
const BODY_PARTS = ['head', 'torso', 'armA', 'armB', 'legL', 'legR'];
const BODY_NAMES = { head: 'Cabeça', torso: 'Tronco', armA: 'Braço da arma', armB: 'Outro braço', legL: 'Perna esquerda', legR: 'Perna direita' };
const PART_STATE = h => h > 70 ? 0 : h > 40 ? 1 : h > 15 ? 2 : 3;   // 0 saudável · 1 ferido · 2 grave · 3 quebrado
const PART_STATE_NAMES = ['saudável', 'ferido', 'grave', 'quebrado'];
// onde cada porte de inimigo costuma acertar: [cabeça, tronco, braços, pernas]
const HIT_ZONES = { low: [0.04, 0.3, 0.16, 0.5], mid: [0.14, 0.42, 0.24, 0.2], high: [0.26, 0.46, 0.2, 0.08] };
const HIT_CAT = t => ['rat', 'wolf', 'spider', 'toad', 'boar', 'deer', 'slime', 'elderslime'].includes(t) ? 'low' : ['troll', 'orc', 'orcchief', 'dragon', 'deserterchief', 'cryptlord'].includes(t) ? 'high' : 'mid';
// mira com o mouse: cabeça erra mais e machuca mais; pernas deixam o alvo lento
const AIM_ACC = { head: 0.7, torso: 0.95, legs: 0.85 }, AIM_DMG = { head: 1.5, torso: 1, legs: 0.8 };
const BLEED_RATE = [0, 0.25, 0.6, 1.0];   // % da vida por segundo, por ferida (ferido / grave / quebrado)
const LEG_SPEED = [1, 0.85, 0.62, 0.38], ARM_DMG = [1, 0.85, 0.6, 0.35];
// ===== combate corpo a corpo direcional (estilo Chivalry) =====
// arma corpo a corpo de cada vocação: alcance, dano e velocidade (multiplicadores)
const MELEE = { knight: { wpn: 'espada', reach: 1.0, dmg: 1.0, spd: 1.0 }, archer: { wpn: 'adaga', reach: 0.8, dmg: 0.7, spd: 0.82 }, mage: { wpn: 'cajado', reach: 1.15, dmg: 0.6, spd: 1.1 } };
// golpes: W preparação, R impacto, C recuperação (ms); alcance (tiles); arco (meio-ângulo, rad); dano; parte do corpo; fôlego
const STRIKES = {
  over:   { n: 'de cima',   W: 430, R: 150, C: 430, reach: 1.6,  arc: 0.45, mult: 1.25, zone: 'head',  st: 11 },
  under:  { n: 'de baixo',  W: 360, R: 150, C: 380, reach: 1.5,  arc: 0.55, mult: 0.9,  zone: 'legs',  st: 8 },
  slashL: { n: 'lateral',   W: 390, R: 170, C: 400, reach: 1.55, arc: 1.15, mult: 1.0,  zone: 'torso', st: 9, multi: 2 },
  slashR: { n: 'lateral',   W: 390, R: 170, C: 400, reach: 1.55, arc: 1.15, mult: 1.0,  zone: 'torso', st: 9, multi: 2 },
  stab:   { n: 'estocada',  W: 330, R: 130, C: 360, reach: 1.9,  arc: 0.24, mult: 0.95, zone: 'torso', st: 7 },
  bite:   { n: 'mordida',   W: 340, R: 120, C: 480, reach: 1.25, arc: 0.6,  mult: 1.0,  zone: 'legs',  st: 0 },
};
const PARRY_PERFECT = 300, PARRY_ARC = 1.15, RIPOSTE_MS = 1300, FEINT_COST = 10, CST_MAX = 100, CST_REGEN = 24;
const DODGE = { dist: 1.4, ms: 230, iframe: 280, cost: 18, cd: 650 }, KICK = { reach: 1.35, arc: 0.6, W: 240, stun: 1000, cost: 12, push: 1.8 };
// monstros com arma: golpes que usam, chance de bloquear e quanto a preparação é mais lenta (dá tempo de reagir)
const MON_MELEE = {
  goblin: { s: ['slashL', 'slashR', 'stab'], blk: 0.1, W: 1.2 }, orc: { s: ['over', 'slashL', 'slashR'], blk: 0.2, W: 1.35 }, skeleton: { s: ['slashL', 'slashR', 'over', 'stab'], blk: 0.15, W: 1.25 },
  bandit: { s: ['stab', 'slashL', 'slashR', 'under'], blk: 0.15, W: 1.1 }, deserter: { s: ['over', 'under', 'slashL', 'slashR', 'stab'], blk: 0.3, W: 1.15 },
  deserterchief: { s: ['over', 'under', 'slashL', 'slashR', 'stab'], blk: 0.4, W: 1.05 }, orcchief: { s: ['over', 'slashL', 'slashR', 'under'], blk: 0.3, W: 1.3 },
  cryptlord: { s: ['over', 'under', 'slashL', 'slashR', 'stab'], blk: 0.35, W: 1.15 }, troll: { s: ['over', 'slashL', 'slashR'], blk: 0, W: 1.55 },
};
// membros perdidos (bits) — decepados por golpe crítico cortante na direção certa
const LOST = { head: 1, armA: 2, armB: 4, legL: 8, legR: 16 };
const LOST_NAMES = { head: 'a cabeça', armA: 'o braço da arma', armB: 'o outro braço', legL: 'a perna esquerda', legR: 'a perna direita' };
const SEVER_FROM = { slashL: [['head', 0.35], ['armA', 0.35], ['armB', 0.3]], slashR: [['head', 0.35], ['armA', 0.35], ['armB', 0.3]], over: [['head', 0.25], ['armA', 0.4], ['armB', 0.35]], under: [['legL', 0.5], ['legR', 0.5]] };
// ===== sobrevivência (fase 4) e morte permanente (fase 5) =====
const SURV = { foodMin: 45, waterMin: 30, coldMin: 5, infectChance: 0.12 };   // minutos até esvaziar / esfriar
const PERMADEATH = true;   // morrer (sangrar até o fim, desistir, decapitação) apaga o personagem; cair da conexão nunca mata
const FOOD = { bread: 28, cookedmeat: 40, venison: 22, pork: 22, berries: 12 };
const KNOCK_MS = 1700, PROSTH_PRICE = 150, RITUAL_PRICE = 600;
const STRIKE_PART = { head: ['head', 'head', 'torso', 'armA'], legs: ['legL', 'legR', 'legL', 'torso'], torso: ['torso', 'torso', 'armA', 'armB'] };
const BUFF_NAMES = { warcry: 'Grito de Guerra', wall: 'Muralha de Ferro', agile: 'Passo Ágil', bless: 'Bênção da Aurora', mead: 'Hidromel', whet: 'Lâmina Afiada' };
const BUFF_BITS = { wall: 16, agile: 32, bless: 64, warcry: 128 };

const need = l => Math.floor(20 * Math.pow(l, 1.75));
const maxHpFor = (cls, l) => Math.floor(CLASSES[cls].hp[0] + CLASSES[cls].hp[1] * (l - 1));
const maxMpFor = (cls, l) => Math.floor(CLASSES[cls].mp[0] + CLASSES[cls].mp[1] * (l - 1));
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const rint = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
