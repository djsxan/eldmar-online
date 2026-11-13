// ============================================================
//  SPRITES — personagens, NPCs e monstros em pixel art.
//  Heróis: 4 direções (S = frente, N = costas, E = lado; W = E espelhado),
//  8 quadros de caminhada, ataques, animações de espera e "sentado".
// ============================================================
const HW = 40, HH = 52, HAX = 20, HAY = 48; // tela do herói; pés na linha 47
const B = 2; // deslocamento vertical (desenho original com pés na linha 45)

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
  captain: () => Object.assign(heroLook('knight', 'iron', '#2c3f6b'), { head: 'none', hairStyle: 'short', hair: tone('#2a2420'), body: tone('#6f7682'), cape: true, capeTone: tone('#24365c'), shield: null, weapon: 'sword', pauldron: 'round', scar: true }),
};

// ---------- pose: braços, arma, corpo ----------
function heroPose(L, P) {
  const v = P.view, wf = P.walk, walking = wf >= 0 && !P.sit;
  const ph = walking ? wf / 8 * Math.PI * 2 : 0;
  const bob = walking ? ((wf % 4 === 1 || wf % 4 === 2) ? -1 : 0) : (P.breath ? 0 : 0);
  const oy = (P.sit ? 5 : 0) + bob + B;
  const s = Math.sin(ph);
  // ombros e mãos padrão (A = braço da arma, F = outro braço)
  let sA, sF, hA, hF;
  if (v === 'E') { sA = [20, 27 + oy]; sF = [21, 26 + oy]; hA = [20 + s * 3, 35 + oy]; hF = [21 - s * 3, 34 + oy]; }
  else if (v === 'S') { sA = [25, 27 + oy]; sF = [15, 27 + oy]; hA = [26.5, 35 + oy + s]; hF = [13.5, 35 + oy - s]; }
  else { sA = [15, 27 + oy]; sF = [25, 27 + oy]; hA = [13.5, 35 + oy - s]; hF = [26.5, 35 + oy + s]; }
  const side = v === 'S' ? 1 : v === 'N' ? -1 : 1; // para onde fica o braço da arma (+x)
  const at = (sh, dx, dy) => [sh[0] + dx * (v === 'N' ? -1 : 1), sh[1] + dy];
  let wAng = L.weapon === 'staff' || L.weapon === 'starstaff' || L.weapon === 'druidstaff' || L.weapon === 'spear' ? 0.08 : 2.5;
  if (L.weapon && L.weapon.endsWith('bow')) wAng = 0;
  let pull = 0, shieldUp = false, mouth = false, eyeShift = 0, glow = 0, kickLeg = 0;
  const act = P.act, idle = P.idle;
  if (act) {
    const f = act.f;
    switch (act.k) {
      case 'swing': case 'bash': {
        const angs = [-0.5, -1.0, 0.3, 1.3, 2.1, 2.5];
        const hands = [[2, -9], [1, -10], [6, -5], [7, -1], [5, 5], [3, 7]];
        wAng = angs[f]; hA = at(sA, hands[f][0], hands[f][1]);
        if (act.k === 'bash') glow = 1;
        break;
      }
      case 'spin': wAng = 1.57; hA = at(sA, 7, 1); break;
      case 'block': shieldUp = true; break;
      case 'shout': mouth = true; hA = at(sA, 5, -9); hF = at(sF, -5, -9); wAng = 0.2; break;
      case 'thrust': { const t = [0.2, 0.6, 1.2, 1.4, 1.0, 0.5][f]; wAng = t; hA = at(sA, 4 + t * 2, -2 + t); glow = f >= 2 && f <= 3 ? 1 : 0; break; }
      case 'cast': hA = at(sA, 4, -8 - (f % 2)); hF = at(sF, -4, -8 - ((f + 1) % 2)); wAng = 0.15; glow = 1; break;
      case 'shoot': case 'shootup': pull = f < 4 ? (f + 1) / 4 : 0; break;
    }
  } else if (idle) {
    const f = idle.f;
    switch (idle.k) {
      case 'look': eyeShift = [0, -1, -1, 0, 1, 1, 0, 0][f]; break;
      case 'stretch': { const u = Math.sin(f / 7 * Math.PI); hA = at(sA, 2, -10 * u); hF = at(sF, -2, -10 * u); if (u > 0.5) wAng = 0.2; mouth = u > 0.8; break; }
      case 'yawn': mouth = f >= 2 && f <= 5; if (mouth) hF = at(sF, 4 * (v === 'S' ? 1 : 1), -4); break;
      case 'kick': kickLeg = [0, 1, 2, 1, 2, 1, 0, 0][f]; break;
      case 'polish': hA = at(sA, -3, -3); hF = at(sF, 3, -2); wAng = L.weapon && L.weapon.includes('staff') ? 0 : 1.57; glow = f % 4 === 1 ? 1 : 0; break;
      case 'pray': hA = v === 'E' ? [23, 29 + oy] : [20.5, 30 + oy]; hF = v === 'E' ? [23, 29 + oy] : [19.5, 30 + oy]; break;
      case 'salute': hA = at(sA, -1, -8); break;
      case 'drink': hA = at(sA, -3, -7 + (f % 4 === 1 ? -1 : 0)); break;
      case 'read': hA = at(sA, -4, -4); hF = at(sF, 4, -4); break;
      case 'wave': hA = at(sA, 4, -10 + (f % 2) * 2); break;
    }
  }
  if (P.carry) { hA = at(sA, -2, -10); hF = at(sF, 2, -10); }
  if (L.weapon && L.weapon.endsWith('bow') && !P.carry && !(idle && idle.k === 'stretch')) {
    if (v === 'E') hA = [25, 30 + oy - (act && act.k === 'shootup' ? 3 : 0)];
    if (pull) hF = v === 'E' ? [25 - pull * 6, 30 + oy] : hF;
  }
  return { v, oy, ph, s, walking, sA, sF, hA, hF, wAng, pull, shieldUp, mouth, eyeShift, glow, kickLeg, side };
}

// ---------- partes ----------
function drawLegs(pc, L, Q, P) {
  const { v, oy, ph, walking } = Q;
  const legC = L.legs, bootC = L.boots;
  if (P.sit) {
    if (v === 'E') {
      pc.l(19, 40 + oy - 5 + 5, 25, 40 + oy - 5 + 5, legC.b, 3); pc.l(25, 40 + oy, 25, 43 + B, legC.d, 3);
      pc.r(24, 43 + B, 5, 3, bootC.b);
    } else { pc.r(14, 40 + oy, 12, 3, legC.b); pc.r(13, 42 + B, 5, 3, bootC.b); pc.r(22, 42 + B, 5, 3, bootC.b); }
    return;
  }
  if (v === 'E') {
    const s = Math.sin(ph), c = Math.cos(ph);
    const hip = [20, 36 + oy];
    const feet = [[20 - s * 4, 45 + B - Math.max(0, -c) * (walking ? 2 : 0)], [20 + s * 4, 45 + B - Math.max(0, c) * (walking ? 2 : 0)]];
    if (Q.kickLeg) feet[1] = [24 + Q.kickLeg, 43 + B - Q.kickLeg];
    feet.forEach(([fx, fy], k) => {
      const t = k === 0 ? legC.d : legC.b, bt = k === 0 ? bootC.d : bootC.b;
      pc.l(hip[0] - 0.5 + k, hip[1], fx, fy - 3, t, 3);
      pc.r(Math.round(fx) - 1, Math.round(fy) - 3, 5, 3, bt);
      pc.p(Math.round(fx) + 3, Math.round(fy) - 1, bt);
    });
    return;
  }
  const s = Math.sin(ph);
  const liftL = walking ? Math.max(0, s) * 2 : 0, liftR = walking ? Math.max(0, -s) * 2 : 0;
  let kick = Q.kickLeg;
  [[16, liftL], [21, liftR + (kick ? kick : 0)]].forEach(([x, lift], k) => {
    const top = 36 + oy, bot = 45 + B - Math.round(lift);
    const t = (k === 0) === (v === 'S') ? legC.b : legC.d;
    pc.r(x, top, 3, bot - top - 2, t);
    pc.p(x, top, legC.l);
    pc.r(x - (k === 0 ? 1 : 0), bot - 3, 4, 3, k === 0 ? bootC.b : bootC.d);
    pc.p(x - (k === 0 ? 1 : 0), bot - 3, bootC.l);
  });
}

function drawTorso(pc, L, Q, P) {
  const { v, oy } = Q, E = v === 'E';
  const x0 = E ? 17 : 15, x1 = E ? 23 : 24, top = 26 + oy;
  const bt = L.body;
  const shadeAt = (x, y) => { const t = (x - x0) / (x1 - x0); return t < 0.22 ? bt.l : t > 0.78 ? bt.d : bt.b; };
  if (L.armor === 'robe') {
    const hem = Q.walking ? Math.round(Q.s) : 0;
    const bl = E ? 15 + hem : 13, br = E ? 25 + hem : 26;
    pc.poly([x0, top, x1 + 1, top, br + 1, 45 + B, bl, 45 + B], 0, (x, y) => {
      const t = (x - bl) / (br - bl); const pat = L.pattern === 'stars' && hash2(x, y, 7) < 0.07 ? L.trim.ll : L.pattern === 'leaves' && hash2(x, y, 9) < 0.09 ? L.body2.l : 0;
      return pat || (t < 0.25 ? bt.l : t > 0.75 ? bt.d : bt.b);
    });
    pc.r(bl, 44 + B, br - bl + 1, 2, L.trim.b);
    if (!E && v === 'S') pc.r(19, top + 2, 2, 45 + B - top - 3, L.trim.d);
    pc.r(x0, 34 + oy, x1 - x0 + 1, 2, L.body2.b);
    pc.p(E ? 21 : 19, 34 + oy, L.trim.l); pc.p(E ? 21 : 20, 35 + oy, L.trim.b);
    return;
  }
  // tronco (placas / couro / colete)
  pc.poly([x0 + 1, top, x1, top, x1 + 1, top + 1, x1 + 1, 36 + oy, x0, 36 + oy, x0, top + 1], 0, shadeAt);
  if (L.armor === 'plate') {
    if (L.pattern === 'scales') for (let y = top + 2; y < 35 + oy; y += 2) for (let x = x0 + 1; x <= x1; x += 2) pc.p(x + (y % 4 === 0 ? 1 : 0), y, bt.d);
    if (!E && v === 'S') {
      pc.r(18, top + 2, 4, 1, bt.ll);
      // tabardo
      pc.r(18, top + 3, 4, 12, L.accent.b); pc.r(18, top + 3, 1, 12, L.accent.l); pc.r(21, top + 3, 1, 12, L.accent.d);
      pc.p(19, top + 6, L.trim.l); pc.p(20, top + 6, L.trim.b); pc.p(19, top + 7, L.trim.b); pc.p(20, top + 7, L.trim.d);
    } else if (E) { pc.r(20, top + 3, 3, 12, L.accent.b); pc.r(22, top + 3, 1, 12, L.accent.d); }
    pc.r(x0, 35 + oy, x1 - x0 + 2, 2, L.body2.b);
    pc.p(E ? 21 : 19, 35 + oy, L.trim.ll);
  } else if (L.armor === 'leather') {
    pc.r(x0 - (E ? 0 : 1), 36 + oy, x1 - x0 + (E ? 2 : 4), 3, bt.d);
    if (L.pattern === 'leaves') for (let y = top + 1; y < 38 + oy; y += 3) for (let x = x0; x <= x1; x += 3) pc.p(x + (y % 2), y, L.body2.b);
    if (v === 'S') { pc.p(19, top + 3, L.body2.d); pc.p(20, top + 4, L.body2.d); pc.p(19, top + 5, L.body2.d); pc.p(20, top + 6, L.body2.d); }
    pc.r(x0, 34 + oy, x1 - x0 + 2, 2, L.body2.b);
    pc.p(E ? 21 : 19, 34 + oy, L.trim.l);
    if (v !== 'N') pc.r(E ? 18 : 22, 35 + oy, 2, 2, L.body2.d);
  } else if (L.armor === 'vest') {
    if (v !== 'N') pc.r(E ? 19 : 17, top + 2, E ? 4 : 6, 12, L.body2.b);
    pc.r(x0, 34 + oy, x1 - x0 + 2, 1, L.body2.d);
  }
}

function drawPauldrons(pc, L, Q) {
  if (!L.pauldron) return;
  const { v, oy } = Q, b = L.body;
  const list = v === 'E' ? [[20, 27.5 + oy]] : [[15, 27.5 + oy], [25, 27.5 + oy]];
  for (const [x, y] of list) {
    pc.e(x, y, 3.3, 2.4, 0, (xx, yy, nx, ny) => ny < -0.3 ? b.ll : nx < 0 ? b.l : b.b);
    if (L.pauldron === 'spike') { pc.p(x - 1, y - 3, b.l); pc.p(x - 1, y - 4, b.ll); pc.p(x + 1, y - 3, b.l); }
    if (L.pauldron === 'wing') { pc.p(x + (x < 20 ? -2 : 2), y - 3, L.trim.ll); pc.p(x + (x < 20 ? -3 : 3), y - 4, L.trim.l); pc.p(x + (x < 20 ? -1 : 1), y - 3, L.trim.b); }
    pc.p(x, y + 1, L.trim.b);
  }
}

function drawArm(pc, L, sh, hand, far) {
  const sleeve = L.armor === 'robe' ? L.body : L.armor === 'plate' ? L.body : L.armor === 'vest' ? tone('#d9d2c2') : L.body;
  const c = far ? sleeve.d : sleeve.b;
  pc.l(sh[0], sh[1], hand[0], hand[1] - 1, c, L.armor === 'robe' ? 3 : 2);
  if (L.armor === 'leather' || L.armor === 'plate') pc.l(hand[0] - (hand[0] - sh[0]) * 0.35, hand[1] - 1 - (hand[1] - sh[1]) * 0.35, hand[0], hand[1] - 1, far ? L.body2.d : L.body2.b, 2);
  pc.r(Math.round(hand[0]) - 1, Math.round(hand[1]) - 1, 2, 2, far ? L.skin.d : L.skin.b);
}

function drawHead(pc, L, Q, P) {
  const { v, oy, eyeShift, mouth } = Q, E = v === 'E', N = v === 'N';
  const cx = E ? 20.5 : 20, cy = 20 + oy;
  const sk = L.skin;
  const helmFull = L.head === 'greathelm' || L.head === 'horned' || L.head === 'winged';
  // pescoço + cabeça
  if (!helmFull) {
    pc.e(cx, cy, 4.6, 4.8, 0, (x, y, nx, ny) => (E ? nx < -0.4 : nx > 0.45) || ny > 0.6 ? sk.d : nx < -0.3 && ny < -0.2 && !E ? sk.l : sk.b);
    if (!N) {
      if (E) { pc.p(23 + Math.max(0, eyeShift), 20 + oy, L.eyes); pc.p(25, 21 + oy, sk.b); pc.p(25, 22 + oy, sk.d); if (mouth) pc.p(23, 23 + oy, px('#5a2a22')); }
      else { pc.p(17 + eyeShift, 21 + oy, L.eyes); pc.p(22 + eyeShift, 21 + oy, L.eyes); pc.p(17 + eyeShift, 20 + oy, sk.d); pc.p(22 + eyeShift, 20 + oy, sk.d); if (mouth) pc.r(19, 23 + oy, 2, 1, px('#5a2a22')); else pc.r(19, 23 + oy, 2, 1, sk.d); }
      if (L.scar && !E) { pc.p(21, 19 + oy, px('#a05a4a')); pc.p(22, 20 + oy, px('#a05a4a')); }
    }
    // cabelo
    const hair = L.hair;
    if (hair && L.head !== 'hood' && L.head !== 'furhood' && L.head !== 'astralhood' && L.head !== 'antlerhood') {
      pc.e(cx, cy - 1, 4.8, 4.6, 0, (x, y, nx, ny) => {
        const edge = N ? true : E ? (nx < 0.1 || ny < -0.45) : ny < -0.35 || (Math.abs(nx) > 0.82 && ny < 0.3);
        return edge ? (ny < -0.6 ? hair.l : hair.b) : 0;
      });
      if (L.hairStyle === 'long') { if (!E) { pc.r(15, cy, 2, 7, hair.b); pc.r(23, cy, 2, 7, hair.d); } else pc.r(16, cy, 3, 8, hair.b); if (N) pc.r(16, cy, 8, 7, hair.b); }
    }
    if (L.beard && !N) {
      if (E) { pc.r(21, 22 + oy, 4, 3, L.beard.b); pc.p(22, 25 + oy, L.beard.d); }
      else { pc.r(16, 22 + oy, 8, 3, L.beard.b); pc.r(17, 25 + oy, 6, 2, L.beard.b); pc.r(18, 27 + oy, 4, 1, L.beard.d); if (mouth) pc.r(19, 23 + oy, 2, 1, px('#5a2a22')); }
    }
  }
  const H = L.headTone;
  switch (L.head) {
    case 'greathelm': case 'horned': case 'winged': {
      pc.e(cx, cy, 5, 5.3, 0, (x, y, nx, ny) => (E ? nx < -0.35 : nx > 0.45) ? H.d : nx < -0.25 && ny < 0 && !E ? H.ll : ny < -0.55 ? H.l : H.b);
      if (!N) {
        if (E) { pc.r(21, 20 + oy, 5, 1, px('#14100c')); pc.p(24, 22 + oy, px('#14100c')); pc.p(24, 23 + oy, px('#14100c')); }
        else { pc.r(16, 20 + oy, 8, 1, px('#14100c')); pc.r(19, 21 + oy, 2, 3, H.d); pc.p(18, 23 + oy, px('#14100c')); pc.p(21, 23 + oy, px('#14100c')); }
      }
      pc.r(Math.round(cx) - (E ? 1 : 1), cy - 6, 2, 2, L.trim.b);
      if (L.head === 'greathelm') { // penacho
        const pl = L.plume;
        if (E) { pc.l(19, cy - 6, 14, cy - 9, pl.b, 2); pc.l(15, cy - 9, 12, cy - 5, pl.d, 2); pc.p(17, cy - 8, pl.l); }
        else { pc.l(20, cy - 6, 20, cy - 10, pl.b, 2); pc.p(19, cy - 10, pl.l); pc.l(21, cy - 10, 23, cy - 7, pl.d, 2); }
      } else if (L.head === 'horned') {
        const hn = tone('#d9ceb2');
        if (E) { pc.l(18, cy - 3, 15, cy - 7, hn.b, 2); pc.p(14, cy - 9, hn.l); pc.l(22, cy - 4, 25, cy - 8, hn.d, 2); }
        else { pc.l(15, cy - 2, 12, cy - 6, hn.b, 2); pc.p(12, cy - 8, hn.l); pc.l(24, cy - 2, 27, cy - 6, hn.d, 2); pc.p(27, cy - 8, hn.l); }
        pc.p(cx, cy - 5, px('#e04a2a'));
      } else {
        const wg = tone('#f4efe2');
        const wing = (x, d) => { pc.l(x, cy - 2, x + d * 4, cy - 8, wg.b, 2); pc.l(x + d, cy - 1, x + d * 5, cy - 5, wg.l, 1); pc.p(x + d * 5, cy - 9, wg.ll); };
        if (E) wing(17, -1); else { wing(15, -1); wing(24, 1); }
      }
      break;
    }
    case 'hood': case 'furhood': case 'astralhood': case 'antlerhood': {
      pc.e(cx, cy - 0.5, 5.2, 5.4, 0, (x, y, nx, ny) => {
        const face = !N && (E ? (nx > 0.15 && ny > -0.3) : (Math.abs(nx) < 0.62 && ny > -0.38 && ny < 0.85));
        if (face) return 0;
        const pat = L.head === 'astralhood' && hash2(x, y, 3) < 0.1 ? L.trim.ll : 0;
        return pat || ((E ? nx < -0.3 : nx > 0.4) ? H.d : ny < -0.5 ? H.l : H.b);
      });
      if (!E && !N) { pc.r(15, cy + 3, 2, 6, H.d); pc.r(23, cy + 3, 2, 6, H.d); }
      if (E) pc.poly([16, cy + 1, 18, cy + 1, 16, cy + 9], H.d);
      if (L.head === 'furhood') {
        const fr = tone('#f2f2ee');
        if (!N) { if (E) pc.l(21, cy - 4, 21, cy + 4, fr.b, 2); else { pc.l(16, cy - 3, 16, cy + 4, fr.b, 1); pc.l(24, cy - 3, 24, cy + 4, fr.b, 1); pc.r(17, cy - 4, 7, 1, fr.l); } }
        pc.poly([16, cy - 4, 17, cy - 8, 19, cy - 5], fr.b); pc.poly([21, cy - 5, 23, cy - 8, 24, cy - 4], fr.d);
      }
      if (L.head === 'astralhood') { if (!N) pc.r(E ? 21 : 17, cy - 3, E ? 4 : 7, 1, L.trim.l); pc.p(E ? 23 : 20, cy - 4, px('#bfe3ff')); }
      if (L.head === 'antlerhood') {
        const an = tone('#cdbb94');
        const antler = (x, d) => { pc.l(x, cy - 4, x + d * 3, cy - 10, an.b, 1); pc.l(x + d * 2, cy - 8, x + d * 5, cy - 10, an.b, 1); pc.l(x + d * 1, cy - 6, x - d, cy - 9, an.d, 1); pc.p(x + d * 3, cy - 11, an.l); };
        if (E) antler(19, -1); else { antler(17, -1); antler(23, 1); }
        pc.p(cx - 2, cy - 5, px('#7cc24a')); pc.p(cx + 2, cy - 5, px('#5aa23a'));
      }
      break;
    }
    case 'circlet':
      if (!N) pc.r(E ? 18 : 16, cy - 3, E ? 7 : 8, 1, L.trim.b);
      if (!N) pc.p(E ? 23 : 20, cy - 3, px('#6fe0a8'));
      if (E) pc.p(16, cy - 1, px('#e8c3a0')); // orelha pontuda
      else { pc.p(14, cy - 1, L.skin.b); pc.p(25, cy - 1, L.skin.d); }
      break;
    case 'wizard': {
      pc.e(cx, cy - 4, 7.5, 1.8, H.d);
      const tip = E ? [15, cy - 17] : [17, cy - 17];
      pc.poly([cx - 4.5, cy - 4, cx + 4.5, cy - 4, cx + 1.5, cy - 11, tip[0], tip[1], cx - 2, cy - 10], 0, (x, y) => x < cx - 1 ? H.d : x > cx + 2 ? H.b : H.l);
      pc.r(Math.round(cx - 4), cy - 6, 8, 1, L.trim.b);
      if (!N) { pc.p(cx, cy - 9, L.trim.ll); pc.p(cx - 1, cy - 8, L.trim.l); pc.p(cx + 1, cy - 8, L.trim.l); }
      break;
    }
    case 'cap':
      pc.e(cx + (E ? 1 : 0), cy - 4, 6, 1.5, H.d); pc.e(cx, cy - 6, 4, 2.5, H.b);
      pc.l(cx - 3, cy - 7, cx - 6, cy - 11, px('#b8382a'), 1);
      break;
    case 'helm':
      pc.e(cx, cy - 2.5, 5, 3.5, 0, (x, y, nx, ny) => ny > 0.5 ? 0 : nx > 0.4 ? H.d : H.b);
      pc.e(cx, cy - 0.5, 6, 1.2, H.d);
      break;
  }
}

// arma presa na mão (ângulo: 0 = para cima, + = para a frente)
function drawWeapon(pc, L, Q, kind, hand, ang, glowOn) {
  const flipX = Q.v === 'N' ? -1 : 1;
  const dx = Math.sin(ang) * flipX, dy = -Math.cos(ang);
  const [hx, hy] = hand;
  const at = k => [hx + dx * k, hy + dy * k];
  switch (kind) {
    case 'sword': case 'darkblade': case 'goldsword': {
      const len = kind === 'darkblade' ? 15 : 13;
      const blade = kind === 'darkblade' ? tone('#3a2a2c') : tone('#d4d9e0');
      const edge = kind === 'darkblade' ? px('#e0482a') : px('#ffffff');
      const guard = kind === 'goldsword' ? L.trim : kind === 'darkblade' ? tone('#6a1c1c') : tone('#9a7a3a');
      const g0 = at(-3); pc.l(hx, hy, g0[0], g0[1], px('#4a3020'), 1); pc.p(g0[0], g0[1], guard.b);
      const p1 = at(1), p2 = at(len);
      pc.l(p1[0], p1[1], p2[0], p2[1], blade.b, 2);
      const q1 = at(2), q2 = at(len - 1); pc.l(q1[0] - dy * 0.5, q1[1] + dx * 0.5, q2[0], q2[1], glowOn ? px('#ffd27a') : edge, 1);
      pc.l(hx - dy * 2.5, hy + dx * 2.5, hx + dy * 2.5, hy - dx * 2.5, guard.b, 1);
      if (kind === 'goldsword') { const t = at(len + 1); pc.p(t[0], t[1], px('#fff4c8')); }
      break;
    }
    case 'staff': case 'starstaff': case 'druidstaff': {
      const pole = kind === 'starstaff' ? tone('#b8c0cc') : tone('#6b4a2b');
      const a = at(-10), b2 = at(15);
      if (kind === 'druidstaff') { for (let k = -10; k < 15; k += 3) { const p1 = at(k), p2 = at(k + 3); pc.l(p1[0] + (k % 2), p1[1], p2[0] - (k % 2), p2[1], pole.b, 1); } }
      else { pc.l(a[0], a[1], b2[0], b2[1], pole.b, 1); pc.l(a[0] + 1, a[1], b2[0] + 1, b2[1], pole.d, 1); }
      const o = at(17), oc = tone(L.orb);
      if (kind === 'starstaff') { pc.poly([o[0], o[1] - 3, o[0] + 2, o[1], o[0], o[1] + 3, o[0] - 2, o[1]], oc.b); pc.p(o[0] - 1, o[1] - 1, oc.ll); }
      else { pc.e(o[0] + 0.5, o[1] + 0.5, 2.2, 2.2, 0, (x, y, nx, ny) => nx < -0.2 && ny < -0.2 ? oc.ll : oc.b); }
      if (kind === 'druidstaff') { pc.p(o[0] - 2, o[1] - 2, px('#5aa23a')); pc.p(o[0] + 2, o[1] - 1, px('#7cc24a')); pc.p(o[0] + 1, o[1] - 3, px('#4a8a2a')); }
      else pc.l(o[0] - 2, o[1] + 2, o[0] + 2, o[1] + 2, L.trim.b, 1);
      if (glowOn) { pc.p(o[0] - 3, o[1], oc.ll); pc.p(o[0] + 3, o[1], oc.ll); pc.p(o[0], o[1] - 4, oc.ll); }
      break;
    }
    case 'bow': case 'frostbow': case 'elfbow': {
      const wood = kind === 'frostbow' ? tone('#cfe2f0') : kind === 'elfbow' ? L.trim : tone('#7a4a22');
      const up = Q.v === 'E' ? 1 : 0;
      if (Q.v === 'E') {
        const tilt = ang ? -0.5 : 0;
        const pts = [];
        for (let t = -1; t <= 1.001; t += 0.25) pts.push([hx + 1 + (1 - t * t) * 3 + t * tilt * 4, hy + t * 10]);
        for (let k = 0; k < pts.length - 1; k++) pc.l(pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1], k % 4 === 0 ? wood.l : wood.b, 1);
        const top = pts[0], bot = pts[pts.length - 1], pullX = hx + 1 - Q.pull * 6;
        pc.l(top[0], top[1], pullX, hy, px('#e8e2d0'), 1); pc.l(pullX, hy, bot[0], bot[1], px('#e8e2d0'), 1);
        if (Q.pull > 0) { pc.l(pullX, hy, hx + 7, hy, px('#d6c9a8'), 1); pc.p(hx + 8, hy, px('#c0c6ce')); }
        if (kind === 'elfbow') { pc.p(top[0], top[1] - 1, px('#6fe0a8')); pc.p(bot[0], bot[1] + 1, px('#6fe0a8')); }
      } else {
        // de frente/costas: arco na vertical ao lado
        const x = hx + (Q.v === 'S' ? 1 : -1);
        for (let t = -1; t <= 1.001; t += 0.2) pc.p(x + (1 - t * t) * 2 * (Q.v === 'S' ? 1 : -1), hy - 2 + t * 9, wood.b);
        pc.l(x, hy - 11, x, hy + 7, px('#e8e2d0'), 1);
      }
      break;
    }
    case 'spear': { const a = at(-12), b2 = at(16); pc.l(a[0], a[1], b2[0], b2[1], px('#6b4a2b'), 1); const t = at(19); pc.poly([b2[0] - 1.5, b2[1], b2[0] + 1.5, b2[1], t[0], t[1]], px('#d4d9e0')); break; }
    case 'book': pc.r(hx - 2, hy - 2, 5, 4, px('#6a1f22')); pc.r(hx - 2, hy - 2, 1, 4, px('#c9a24a')); break;
    case 'mug': pc.r(hx - 1, hy - 3, 3, 4, px('#a0662a')); pc.r(hx - 1, hy - 4, 3, 1, px('#f2ead8')); pc.p(hx + 2, hy - 2, px('#a0662a')); break;
  }
}

function drawShield(pc, L, Q, hand) {
  const k = L.shield;
  if (!k) return;
  const E = Q.v === 'E';
  let [cx, cy] = hand; cy -= 2;
  if (Q.shieldUp) { cx = E ? 25 : 20; cy = 27 + Q.oy; }
  const rim = k === 'dragon' ? tone('#2a1416') : L.trim, field = k === 'dragon' ? tone('#3a1a1c') : k === 'sun' ? tone('#f0ead8') : L.accent;
  const w = E && !Q.shieldUp ? 2 : 4;
  if (k === 'sun') {
    pc.e(cx, cy, w + 0.6, 5, rim.b); pc.e(cx, cy, w - 0.6, 4, field.b);
    pc.e(cx, cy, Math.max(1, w - 2.5), 1.6, L.trim.ll);
  } else {
    pc.poly([cx - w, cy - 5, cx + w + 1, cy - 5, cx + w + 1, cy + 2, cx + 0.5, cy + 7, cx - w, cy + 2], rim.b);
    pc.poly([cx - w + 1, cy - 4, cx + w, cy - 4, cx + w, cy + 2, cx + 0.5, cy + 5.5, cx - w + 1, cy + 2], 0, (x) => x < cx ? field.b : field.d);
    if (w >= 3) {
      if (k === 'dragon') { pc.p(cx, cy - 1, px('#e0482a')); pc.p(cx + 1, cy - 1, px('#ff8a4a')); pc.p(cx, cy, px('#8a1c1c')); }
      else { pc.r(cx, cy - 3, 1, 7, L.trim.l); pc.r(cx - 2, cy - 1, 5, 1, L.trim.l); }
    }
  }
}

function drawCape(pc, L, Q, over) {
  if (!L.cape) return;
  const { v, oy, walking, s } = Q;
  const c = L.capeTone, wv = walking ? Math.round(s * 1.5) : 0;
  if (v === 'E') {
    pc.poly([18, 26 + oy, 21, 26 + oy, 20, 40 + oy, 15 - wv, 44 + B, 12 - wv, 42 + B], 0, (x, y) => x < 16 ? c.d : c.b);
  } else if (v === 'S' && !over) {
    pc.poly([14, 27 + oy, 26, 27 + oy, 27 + wv, 44 + B, 13 + wv, 44 + B], c.d);
  } else if (v === 'N' && over) {
    pc.poly([14, 27 + oy, 26, 27 + oy, 27 + wv, 44 + B, 13 + wv, 44 + B], 0, (x, y) => (x + y) % 5 === 0 ? c.d : x < 17 ? c.l : x > 23 ? c.d : c.b);
    pc.r(15, 27 + oy, 10, 1, L.trim.b);
  }
}

function drawQuiver(pc, L, Q, over) {
  if (!L.quiver) return;
  const { v, oy } = Q, q = tone('#5a3a22');
  const fl = (x, y) => { pc.p(x, y, px('#e8e2d0')); pc.p(x + 1, y - 1, px('#b8382a')); pc.p(x + 2, y, px('#e8e2d0')); };
  if (v === 'E' && !over) { pc.l(15, 26 + oy, 17, 37 + oy, q.b, 3); fl(13, 25 + oy); fl(15, 24 + oy); }
  else if (v === 'S' && !over) { fl(12, 24 + oy); fl(14, 23 + oy); }
  else if (v === 'N' && over) { pc.l(16, 25 + oy, 23, 37 + oy, q.b, 3); pc.l(16, 25 + oy, 23, 37 + oy, q.d, 1); fl(14, 23 + oy); fl(16, 22 + oy); }
}

function drawHeroPC(pc, L, P) {
  const Q = heroPose(L, P);
  const { v } = Q;
  const weaponIsBow = L.weapon && L.weapon.endsWith('bow');
  if (v === 'N') {
    if (L.weapon) drawWeapon(pc, L, Q, L.weapon, Q.hA, Q.wAng, Q.glow);
    drawShield(pc, L, Q, Q.hF);
    drawLegs(pc, L, Q, P);
    drawTorso(pc, L, Q, P);
    drawArm(pc, L, Q.sA, Q.hA, false); drawArm(pc, L, Q.sF, Q.hF, false);
    drawPauldrons(pc, L, Q);
    drawHead(pc, L, Q, P);
    drawCape(pc, L, Q, true);
    drawQuiver(pc, L, Q, true);
    return;
  }
  if (v === 'E') {
    drawCape(pc, L, Q, false);
    drawQuiver(pc, L, Q, false);
    drawArm(pc, L, Q.sF, Q.hF, true);
    if (!Q.shieldUp) drawShield(pc, L, Q, Q.hF);
    drawLegs(pc, L, Q, P);
    drawTorso(pc, L, Q, P);
    drawPauldrons(pc, L, Q);
    drawHead(pc, L, Q, P);
    if (L.weapon && !weaponIsBow) drawWeapon(pc, L, Q, L.weapon, Q.hA, Q.wAng, Q.glow);
    drawArm(pc, L, Q.sA, Q.hA, false);
    if (L.weapon && weaponIsBow) drawWeapon(pc, L, Q, L.weapon, Q.hA, Q.wAng, Q.glow);
    if (Q.shieldUp) drawShield(pc, L, Q, Q.hF);
    return;
  }
  // S (frente)
  drawCape(pc, L, Q, false);
  drawQuiver(pc, L, Q, false);
  drawLegs(pc, L, Q, P);
  drawTorso(pc, L, Q, P);
  drawArm(pc, L, Q.sF, Q.hF, false);
  drawArm(pc, L, Q.sA, Q.hA, false);
  drawPauldrons(pc, L, Q);
  drawHead(pc, L, Q, P);
  drawShield(pc, L, Q, Q.hF);
  if (L.weapon) drawWeapon(pc, L, Q, L.weapon, Q.hA, Q.wAng, Q.glow);
}

function poseKey(P) {
  return P.view + (P.walk >= 0 ? P.walk : '-') + (P.act ? P.act.k + P.act.f : '') + (P.idle ? P.idle.k + P.idle.f : '') + (P.sit ? 's' : '') + (P.carry ? 'c' : '');
}
const _lookCache = new Map();
function lookFor(key, make) { let l = _lookCache.get(key); if (!l) { l = make(); _lookCache.set(key, l); } return l; }
function heroSprite(cls, skin, color, P) {
  const lk = cls + ':' + skin + ':' + color;
  const L = lookFor(lk, () => heroLook(cls, skin, color));
  return sprite('h|' + lk + '|' + poseKey(P), HW, HH, HAX, HAY, pc => drawHeroPC(pc, L, P));
}
function npcSprite(kind, P) {
  const L = lookFor('npc:' + kind, NPC_LOOKS[kind]);
  return sprite('n|' + kind + '|' + poseKey(P), HW, HH, HAX, HAY, pc => drawHeroPC(pc, L, P));
}

// ---------- MONSTROS (vista lateral, olhando para a direita) ----------
const MON_SIZE = { rat: [36, 26], slime: [32, 28], wolf: [44, 34], spider: [44, 30], toad: [38, 30], goblin: [36, 44], skeleton: [36, 50], orc: [44, 54], troll: [64, 70] };
function monSprite(type, f, atk) {
  const [w, h] = MON_SIZE[type];
  return sprite(`m|${type}|${f}|${atk}`, w, h, w >> 1, h - 3, pc => drawMonsterPC(pc, type, f, atk, w, h));
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
  });
}
