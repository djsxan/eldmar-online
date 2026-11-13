// ============================================================
//  SPRITES — personagens, monstros e NPCs desenhados com formas.
//  Tudo é desenhado "olhando para a direita"; para a esquerda o
//  desenho é espelhado. Os pés ficam no ponto (0, 0).
// ============================================================
const _shadeCache = new Map();
function shade(hex, amt) {
  const key = hex + amt;
  let v = _shadeCache.get(key);
  if (v) return v;
  const n = parseInt(hex.slice(1), 16);
  let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const t = amt < 0 ? 0 : 255, f = Math.abs(amt);
  r = Math.round(r + (t - r) * f); g = Math.round(g + (t - g) * f); b = Math.round(b + (t - b) * f);
  v = `rgb(${r},${g},${b})`;
  _shadeCache.set(key, v);
  return v;
}

const ANIM_MS = { swing: 380, bash: 460, spin: 520, shout: 650, block: 550, shoot: 420, shootup: 520, thrust: 380, cast: 600, bite: 320 };
const easeOut = t => 1 - (1 - t) * (1 - t);

function animProgress(o, now) {
  if (!o.anim) return { a: null, p: -1 };
  const p = (now - o.anim.t0) / (ANIM_MS[o.anim.a] || 400);
  return p >= 0 && p <= 1 ? { a: o.anim.a, p } : { a: null, p: -1 };
}

function ell(ctx, x, y, rx, ry, color) { ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); }
function circ(ctx, x, y, r, color) { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
function rect(ctx, x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); }
function poly(ctx, pts, color, stroke) {
  ctx.beginPath(); ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
  if (color) { ctx.fillStyle = color; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 0.8; ctx.stroke(); }
}
function rrect(ctx, x, y, w, h, r, color) { ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); }
function line(ctx, x1, y1, x2, y2, color, w = 1) { ctx.strokeStyle = color; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
function shadowAt(ctx, x, y, rx, ry) { ell(ctx, x, y, rx, ry, 'rgba(0,0,0,0.28)'); }

// ---------- pernas genéricas ----------
function legs(ctx, sw, lift, pants, boots, knee) {
  // perna de trás (mais escura)
  const lx = -3 - sw * 2.5, rx = 1 + sw * 2.5;
  const ly = sw > 0 ? lift : 0, ry = sw < 0 ? lift : 0;
  rect(ctx, lx, -14 - ly, 4, 10, shade(pants, -0.25));
  rrect(ctx, lx - 0.5, -5 - ly, 5.5, 5, 1.5, shade(boots, -0.25));
  rect(ctx, rx, -14 - ry, 4, 10, pants);
  rrect(ctx, rx - 0.5, -5 - ry, 5.5, 5, 1.5, boots);
  rect(ctx, rx + 3, -4 - ry, 2, 4, boots);
  if (knee) { circ(ctx, lx + 2, -9 - ly, 2, shade(knee, -0.2)); circ(ctx, rx + 2, -9 - ry, 2.2, knee); }
}

// ---------- espada ----------
function sword(ctx, len, glow) {
  if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = 8; }
  poly(ctx, [-1.6, 0, 1.6, 0, 1.4, -len, 0, -len - 3, -1.4, -len], '#d9dee5');
  ctx.shadowBlur = 0;
  line(ctx, 0, -1, 0, -len, '#9aa3ad', 0.8);
  rect(ctx, -4.5, -1, 9, 2.2, '#c99a2e');
  rect(ctx, -1, 1, 2, 4, '#5a3a1e');
  circ(ctx, 0, 5.5, 1.6, '#c99a2e');
}

// ---------- HERÓIS ----------
function drawHero(ctx, sx, sy, o, now) {
  const { a, p } = animProgress(o, now);
  const walk = o.walking;
  const ph = now / 85;
  const sw = walk ? Math.sin(ph) : 0;
  const lift = walk ? Math.max(0, Math.abs(Math.sin(ph)) * 2) : 0;
  const bob = walk ? Math.abs(Math.cos(ph)) * 1.4 : Math.sin(now / 650) * 0.5;
  const face = o.face || 1, back = !!o.back;

  ctx.save();
  ctx.translate(sx, sy);
  if (o.hitAt && now - o.hitAt < 220) ctx.translate(-2.5 * face, 0);
  shadowAt(ctx, 0, 1, 12, 4.5);
  if (face < 0) ctx.scale(-1, 1);
  if (a === 'spin') ctx.scale(Math.cos(p * Math.PI * 4) >= 0 ? 1 : -1, 1);
  ctx.translate(0, -bob);
  const hit = o.hitAt && now - o.hitAt < 120;
  if (hit) ctx.filter = 'brightness(2.2)';

  if (o.cls === 'knight') drawKnight(ctx, o, now, a, p, sw, lift, back);
  else if (o.cls === 'archer') drawArcher(ctx, o, now, a, p, sw, lift, back);
  else drawMage(ctx, o, now, a, p, sw, lift, back);

  ctx.filter = 'none';
  ctx.restore();
}

function drawKnight(ctx, o, now, a, p, sw, lift, back) {
  const col = o.color, steel = '#b8c0cb', steelD = '#7d8794', steelL = '#e3e8ee';
  const wave = Math.sin(now / 300) * 1.5 + sw * 1.5;
  const cape = () => {
    poly(ctx, [-6, -30, 5, -30, 4, -8, -2 + wave, -4, -10 + wave, -6], shade(col, -0.3));
    poly(ctx, [-6, -30, -1, -30, -3 + wave, -5, -10 + wave, -6], shade(col, -0.45));
  };
  // ângulo da espada
  let ang = -0.35, shieldUp = 0, armsUp = 0;
  if (a === 'swing' || a === 'bash') {
    const t = easeOut(p);
    ang = p < 0.25 ? -0.35 - (p / 0.25) * 2.2 : -2.55 + (t - 0.1) * 4.3;
  } else if (a === 'spin') ang = 1.45;
  else if (a === 'block') shieldUp = Math.sin(p * Math.PI) * 6 + 4;
  else if (a === 'shout') { armsUp = Math.sin(p * Math.PI); ang = -0.35 - armsUp * 1.2; }
  if (o.buffs && o.buffs.wall > now) shieldUp = Math.max(shieldUp, 6);

  if (!back) cape();
  legs(ctx, sw, lift, steelD, '#3a3530', steel);
  // tronco (armadura)
  const g = ctx.createLinearGradient(-7, 0, 7, 0);
  g.addColorStop(0, steelD); g.addColorStop(0.45, steelL); g.addColorStop(1, steel);
  rrect(ctx, -7, -31, 14, 18, 4, g);
  rect(ctx, -6, -14, 12, 3, steelD); // saia de malha
  for (let i = -5; i < 6; i += 2) circ(ctx, i, -11.5, 0.8, '#5c6470');
  if (!back) {
    // tabardo com brasão
    poly(ctx, [-4, -28, 4, -28, 4.5, -11, 0, -8, -4.5, -11], col);
    poly(ctx, [-4, -28, -1, -28, -1.5, -9.5, -4.5, -11], shade(col, -0.2));
    poly(ctx, [0, -25, 2.5, -21, 0, -16, -2.5, -21], '#e7c158');
    rect(ctx, -6, -16, 12, 2.2, '#5b3a1f');
    rect(ctx, -1.5, -16.5, 3, 3, '#e7c158');
  } else {
    rect(ctx, -6, -16, 12, 2.2, '#5b3a1f');
  }
  // braço da espada (direita)
  ctx.save();
  ctx.translate(6, -24);
  ctx.rotate(ang * 0.35);
  rrect(ctx, -1.5, 0, 4, 10, 2, steel);
  rrect(ctx, -2, 8, 5, 4, 1.5, steelD);
  ctx.restore();
  // espada
  const swordDraw = () => {
    ctx.save();
    const hx = 7 + Math.sin(ang * 0.35) * -4, hy = -14 - armsUp * 8;
    ctx.translate(hx, hy);
    ctx.rotate(ang);
    sword(ctx, 19, a === 'bash' ? '#fb923c' : null);
    ctx.restore();
    // rastro do golpe
    if ((a === 'swing' || a === 'bash') && p > 0.25 && p < 0.85) {
      const t = (p - 0.25) / 0.6;
      ctx.strokeStyle = a === 'bash' ? `rgba(255,170,80,${0.8 - t * 0.6})` : `rgba(255,255,255,${0.75 - t * 0.6})`;
      ctx.lineWidth = a === 'bash' ? 5 : 3.5;
      ctx.beginPath(); ctx.arc(hx, hy, 20, -Math.PI / 2 - 1.9, -Math.PI / 2 - 1.9 + t * 3.6); ctx.stroke();
    }
  };
  if (back) swordDraw();
  // ombreiras
  ell(ctx, -6.5, -29, 4.5, 3.2, steel); ell(ctx, -6.5, -29.8, 3.5, 1.6, steelL);
  ell(ctx, 6.5, -29, 4.5, 3.2, steel); ell(ctx, 6.5, -29.8, 3.5, 1.6, steelL);
  // elmo
  const hg = ctx.createLinearGradient(-7, 0, 7, 0);
  hg.addColorStop(0, steelD); hg.addColorStop(0.5, steelL); hg.addColorStop(1, steel);
  rrect(ctx, -6.5, -45, 13, 14, [6, 6, 2, 2], hg);
  if (!back) {
    rect(ctx, -1, -39.5, 7.5, 1.8, '#1f2328');
    line(ctx, 2, -45, 2, -32, steelD, 0.8);
    for (let i = 0; i < 3; i++) circ(ctx, 4 + (i % 2), -35 + i * 1.3, 0.5, '#1f2328');
  }
  rect(ctx, -6.5, -33, 13, 2, steelD);
  // penacho
  const pl = Math.sin(now / 250) * 1.2;
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.moveTo(-1, -45); ctx.quadraticCurveTo(-6, -53 + pl, -13, -46 + pl); ctx.quadraticCurveTo(-7, -49, -2, -43); ctx.fill();
  ctx.strokeStyle = shade(col, 0.3); ctx.lineWidth = 0.7;
  ctx.beginPath(); ctx.moveTo(-2, -46); ctx.quadraticCurveTo(-6, -50 + pl, -11, -46.5 + pl); ctx.stroke();
  if (back) cape();
  // escudo
  if (!back || shieldUp) {
    const sy = -27 - shieldUp, sx = -9 + shieldUp * 0.8;
    poly(ctx, [sx, sy, sx + 10, sy, sx + 10, sy + 9, sx + 5, sy + 16, sx, sy + 9], '#c99a2e');
    poly(ctx, [sx + 1.2, sy + 1.2, sx + 8.8, sy + 1.2, sx + 8.8, sy + 8.6, sx + 5, sy + 14.2, sx + 1.2, sy + 8.6], col);
    poly(ctx, [sx + 1.2, sy + 1.2, sx + 5, sy + 1.2, sx + 5, sy + 14.2, sx + 1.2, sy + 8.6], shade(col, -0.2));
    rect(ctx, sx + 4.2, sy + 2.5, 1.6, 10, '#e7c158');
    rect(ctx, sx + 2, sy + 5.5, 6, 1.6, '#e7c158');
  }
  if (!back) swordDraw();
}

function drawArcher(ctx, o, now, a, p, sw, lift, back) {
  const col = o.color, leather = '#6b4a2b', tunic = '#4c6a37', skin = '#e9b98f';
  const wave = Math.sin(now / 320) * 1.2 + sw;
  const quiver = () => {
    ctx.save(); ctx.translate(-4, -22); ctx.rotate(-0.35);
    rrect(ctx, -2.5, -11, 5, 15, 1.5, '#5a3a1e');
    rect(ctx, -2.5, -8, 5, 1.2, '#c99a2e');
    for (let i = 0; i < 4; i++) { line(ctx, -1.5 + i, -11, -1.8 + i * 1.1, -15, '#d6c9a8', 0.8); poly(ctx, [-2.2 + i * 1.1, -15, -1.2 + i * 1.1, -15, -1.7 + i * 1.1, -18], '#dc2626'); }
    ctx.restore();
  };
  if (!back) quiver();
  // capa curta
  poly(ctx, [-6, -30, 5, -30, 3, -14, -3 + wave, -12, -9 + wave, -15], shade(col, -0.35));
  legs(ctx, sw, lift, '#5b4636', '#3d2a1a');
  // botas altas
  rect(ctx, -3 - sw * 2.5 - 0.5, -9 - (sw > 0 ? lift : 0), 5.5, 1.5, '#7a5634');
  rect(ctx, 1 + sw * 2.5 - 0.5, -9 - (sw < 0 ? lift : 0), 5.5, 1.5, '#7a5634');
  // túnica
  poly(ctx, [-6.5, -30, 6.5, -30, 7.5, -10, -7.5, -10], tunic);
  poly(ctx, [-6.5, -30, -1, -30, -1.5, -10, -7.5, -10], shade(tunic, -0.2));
  if (!back) { for (let i = 0; i < 3; i++) line(ctx, -1, -27 + i * 3, 2, -26 + i * 3, '#2e3f22', 0.8); }
  rect(ctx, -7, -17, 14, 2.5, leather);
  rect(ctx, -1.5, -17.5, 3, 3.2, '#c99a2e');
  if (!back) { rrect(ctx, 3, -16, 4, 4, 1, '#7a5634'); }
  // capuz e manto nos ombros
  poly(ctx, [-8, -31, 8, -31, 6, -25, -6, -25], col);
  // cabeça
  if (!back) {
    circ(ctx, 0.5, -36, 6.2, skin);
    circ(ctx, 3.2, -37, 0.9, '#2b1d14');
    line(ctx, 1.8, -39, 4.4, -39.3, '#5a3a1e', 0.8);
    rect(ctx, 2, -33, 2.5, 0.8, '#b07a5a');
  }
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.arc(0, -37, 7.2, back ? 0 : Math.PI * 0.85, back ? Math.PI * 2 : Math.PI * 2.15, false);
  ctx.lineTo(-7, -30); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-6, -40); ctx.quadraticCurveTo(-12, -38, -10, -31); ctx.lineTo(-5, -33); ctx.fill();
  if (back) quiver();
  // braço + arco
  let pull = 0, bowAng = 0;
  if (a === 'shoot') pull = p < 0.6 ? p / 0.6 : 0;
  if (a === 'shootup') { pull = p < 0.6 ? p / 0.6 : 0; bowAng = -0.7; }
  ctx.save();
  ctx.translate(8, -22);
  ctx.rotate(bowAng);
  // braço da frente
  rrect(ctx, -4, -1.5, 6, 3.2, 1.5, tunic);
  rect(ctx, -1, -1.8, 3, 3.6, leather);
  // arco
  ctx.strokeStyle = '#7c4a1e'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(1, -15); ctx.quadraticCurveTo(9, 0, 1, 15); ctx.stroke();
  ctx.strokeStyle = '#c99a2e'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(4.2, -2); ctx.lineTo(4.6, 2); ctx.stroke();
  const px = 1 - pull * 9;
  line(ctx, 1, -15, px, 0, '#e5e7eb', 0.6); line(ctx, px, 0, 1, 15, '#e5e7eb', 0.6);
  if (pull > 0) { line(ctx, px, 0, 12, 0, '#d6c9a8', 1); poly(ctx, [12, -1.5, 15, 0, 12, 1.5], '#9ca3af'); }
  // mão de trás puxando
  circ(ctx, px - 1, 0, 1.8, skin);
  ctx.restore();
}

function drawMage(ctx, o, now, a, p, sw, lift, back) {
  const col = o.color, trim = '#e7c158', skin = '#efc9a3';
  const hem = Math.sin(now / 280) * 0.8 + sw * 1.5;
  let staffAng = 0.08, raise = 0, orbBoost = 0;
  if (a === 'cast') { raise = Math.sin(p * Math.PI) * 7; orbBoost = Math.sin(p * Math.PI); }
  if (a === 'thrust') { staffAng = p < 0.5 ? p * 2 * 1.1 : (1 - p) * 2 * 1.1; orbBoost = 0.6; }
  if (o.cast && o.cast.end > now) { raise = 6; orbBoost = 0.7 + Math.sin(now / 80) * 0.3; }

  const staff = () => {
    ctx.save();
    ctx.translate(9, -18 - raise);
    ctx.rotate(staffAng);
    ctx.strokeStyle = '#6b4423'; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(0, 18); ctx.lineTo(0, -28); ctx.stroke();
    circ(ctx, 0, 4, 1.4, '#4a2f17'); circ(ctx, 0, -12, 1.3, '#4a2f17');
    // garras segurando o cristal
    ctx.strokeStyle = '#c99a2e'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(-3, -30); ctx.quadraticCurveTo(0, -27, 3, -30); ctx.stroke();
    const pulse = 0.6 + Math.sin(now / 200) * 0.2 + orbBoost * 0.6;
    const gr = ctx.createRadialGradient(0, -32, 0.5, 0, -32, 8 + orbBoost * 6);
    gr.addColorStop(0, `rgba(220,240,255,${Math.min(1, pulse)})`); gr.addColorStop(0.35, `rgba(96,165,250,${pulse * 0.8})`); gr.addColorStop(1, 'rgba(96,165,250,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, -32, 8 + orbBoost * 6, 0, Math.PI * 2); ctx.fill();
    circ(ctx, 0, -32, 3, '#93c5fd'); circ(ctx, -1, -33, 1.1, '#fff');
    for (let k = 0; k < 3; k++) {
      const an = now / 400 + k * 2.1;
      circ(ctx, Math.cos(an) * 6, -32 + Math.sin(an) * 3, 0.8, '#dbeafe');
    }
    ctx.restore();
  };
  if (back) staff();
  // pés
  if (o.walking) {
    rrect(ctx, -4 - sw * 2, -3, 5, 3, 1.5, '#3b2a1e');
    rrect(ctx, 1 + sw * 2, -3, 5, 3, 1.5, '#4a3526');
  } else { rrect(ctx, -2, -2.5, 6, 2.5, 1.2, '#4a3526'); }
  // túnica longa
  const g = ctx.createLinearGradient(-9, 0, 9, 0);
  g.addColorStop(0, shade(col, -0.35)); g.addColorStop(0.5, col); g.addColorStop(1, shade(col, -0.1));
  poly(ctx, [-6, -31, 6, -31, 9 + hem, -2, -9 + hem, -2], g);
  rect(ctx, -9 + hem, -4, 18, 2, trim);
  if (!back) {
    poly(ctx, [-1, -28, 1, -28, 1.5 + hem * 0.5, -4, -1.5 + hem * 0.5, -4], trim);
    for (let i = 0; i < 3; i++) circ(ctx, 0, -25 + i * 4, 0.6, shade(col, -0.4));
  }
  rect(ctx, -6.5, -19, 13, 2.5, shade(col, -0.45));
  rect(ctx, -1.5, -19.5, 3, 3, trim);
  // mangas largas
  poly(ctx, [5, -29, 9, -27, 12, -17 - raise, 7, -16 - raise], shade(col, -0.15));
  rect(ctx, 6.5, -17.5 - raise, 5.5, 1.5, trim);
  circ(ctx, 9.5, -16.5 - raise, 2, skin);
  poly(ctx, [-5, -29, -9, -27, -10, -17, -5, -18], shade(col, -0.3));
  // ombros
  ell(ctx, 0, -30, 7.5, 2.5, shade(col, 0.1));
  // cabeça
  if (!back) {
    circ(ctx, 0.5, -35.5, 6, skin);
    circ(ctx, 3, -36.5, 0.9, '#1f2937');
    // barba
    poly(ctx, [-3, -33, 5.5, -33, 3, -26, 0, -27], '#d6d3d1');
    line(ctx, 1, -32, 1.5, -28, '#a8a29e', 0.6);
    rect(ctx, 1.5, -33.5, 3, 0.8, '#a8a29e');
  } else {
    circ(ctx, 0, -35.5, 6, '#d6d3d1');
  }
  // chapéu pontudo
  ell(ctx, 0, -40.5, 11, 3.2, shade(col, -0.3));
  const tipX = -7 + Math.sin(now / 500) * 1.5;
  poly(ctx, [-6, -41, 6, -41, 2, -52, tipX, -60, -2, -50], shade(col, -0.15));
  poly(ctx, [-6, -41, -1, -41, -2, -50, tipX, -60], shade(col, -0.35));
  rect(ctx, -6, -43.5, 12, 2.4, trim);
  if (!back) poly(ctx, [2, -49, 2.8, -47.2, 4.6, -47, 3.2, -45.8, 3.6, -44, 2, -45, 0.4, -44, 0.8, -45.8, -0.6, -47, 1.2, -47.2], trim);
  if (!back) staff();
}

// ---------- humanoide genérico (NPCs e monstros) ----------
function drawPerson(ctx, o, now) {
  const s = o.scale || 1;
  const walk = o.walking, ph = now / (o.slow ? 120 : 85);
  const sw = walk ? Math.sin(ph) : 0, lift = walk ? Math.abs(Math.sin(ph)) * 2 : 0;
  ctx.save();
  ctx.scale(s, s);
  if (o.hunch) ctx.translate(0, 2);
  legs(ctx, sw, lift, o.pants, o.boots, o.knee);
  // tronco
  const tw = o.wide ? 17 : 14;
  rrect(ctx, -tw / 2, -31, tw, 18, 4, o.top);
  poly(ctx, [-tw / 2, -29, -1, -29, -1, -13, -tw / 2, -13], 'rgba(0,0,0,0.15)');
  if (o.ribs) for (let i = 0; i < 4; i++) line(ctx, -4, -27 + i * 3, 4, -27 + i * 3, o.ribs, 1.2);
  if (o.apron) { rrect(ctx, -4.5, -24, 9, 14, 1.5, o.apron); }
  if (o.belt) { rect(ctx, -tw / 2, -16, tw, 2.2, o.belt); rect(ctx, -1.2, -16.4, 2.4, 3, '#c99a2e'); }
  if (o.armor) { ell(ctx, -tw / 2 + 1, -29, 4.5, 3, o.armor); ell(ctx, tw / 2 - 1, -29, 4.5, 3, o.armor); rect(ctx, -3, -28, 6, 8, o.armor); }
  // braço de trás
  rrect(ctx, -tw / 2 - 2.5, -28, 3.5, 12, 1.5, shade(o.skinArm || o.skin, -0.2));
  // cabeça
  const hy = o.hunch ? -33 : -36;
  if (o.ears) {
    poly(ctx, [-4, hy - 1, -12, hy - 5, -5, hy + 2], o.skin);
    poly(ctx, [4, hy - 1, 11, hy - 6, 5, hy + 2], o.skin);
  }
  circ(ctx, 0.5, hy, o.headR || 6.2, o.skin);
  if (o.skull) {
    circ(ctx, -1, hy - 0.5, 1.8, '#111'); circ(ctx, 3.2, hy - 0.5, 1.8, '#111');
    circ(ctx, -1, hy - 0.5, 0.8, o.eyes); circ(ctx, 3.2, hy - 0.5, 0.8, o.eyes);
    for (let i = 0; i < 4; i++) rect(ctx, -1.5 + i * 1.6, hy + 3.5, 1, 1.6, '#111');
  } else {
    circ(ctx, 3.2, hy - 0.8, 1, o.eyes || '#1f2937');
    if (o.tusks) { poly(ctx, [1.5, hy + 3, 2.5, hy + 0.5, 3.2, hy + 3], '#f5f5f4'); poly(ctx, [4.5, hy + 3, 5.3, hy + 0.5, 6, hy + 3], '#f5f5f4'); }
    if (o.mouth) rect(ctx, 2, hy + 3, 3, 0.8, o.mouth);
  }
  if (o.beard) poly(ctx, [-3, hy + 2, 5.5, hy + 2, 3, hy + 8, -1, hy + 7], o.beard);
  if (o.mustache) { ctx.strokeStyle = o.mustache; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(0.5, hy + 2.6); ctx.quadraticCurveTo(3, hy + 1.5, 6, hy + 3.5); ctx.stroke(); }
  if (o.hair) { ctx.fillStyle = o.hair; ctx.beginPath(); ctx.arc(0, hy - 1, 6.5, Math.PI * 0.9, Math.PI * 2.05); ctx.fill(); }
  if (o.hat === 'hood') { ctx.fillStyle = o.hatColor; ctx.beginPath(); ctx.arc(0, hy - 0.5, 7.4, Math.PI * 0.8, Math.PI * 2.1); ctx.lineTo(-7, hy + 6); ctx.fill(); }
  if (o.hat === 'cap') { ell(ctx, 1, hy - 4.5, 8, 2.4, o.hatColor); rrect(ctx, -4.5, hy - 10, 10, 6, [4, 4, 0, 0], o.hatColor); if (o.feather) { ctx.strokeStyle = o.feather; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-3, hy - 8); ctx.quadraticCurveTo(-8, hy - 14, -11, hy - 10); ctx.stroke(); } }
  if (o.hat === 'helm') { rrect(ctx, -6.5, hy - 8, 13, 9, [6, 6, 1, 1], o.hatColor); rect(ctx, -7.5, hy, 15, 1.8, shade(o.hatColor, -0.25)); line(ctx, 1, hy - 8, 1, hy + 3, shade(o.hatColor, 0.3), 1.2); }
  if (o.hat === 'horns') { rrect(ctx, -6.5, hy - 8, 13, 7, [6, 6, 1, 1], o.hatColor); poly(ctx, [-6, hy - 5, -11, hy - 13, -4, hy - 7], '#e7e5e4'); poly(ctx, [6, hy - 5, 11, hy - 13, 4, hy - 7], '#e7e5e4'); }
  // braço da frente + item
  const atk = o.atk || 0;
  ctx.save();
  ctx.translate(tw / 2 - 0.5, -27);
  ctx.rotate(-atk * 1.6 + 0.15);
  rrect(ctx, -1.5, 0, 4, 12, 1.8, o.skinArm || o.skin);
  ctx.translate(0.5, 12);
  if (o.item === 'dagger') { rect(ctx, -0.8, -1, 1.6, 3, '#4a2f17'); poly(ctx, [-1.2, 2, 1.2, 2, 0, 9], '#cbd5e1'); }
  if (o.item === 'sword') { ctx.rotate(Math.PI); sword(ctx, 14); }
  if (o.item === 'axe') { ctx.rotate(Math.PI); rect(ctx, -1, -2, 2, 20, '#5a3a1e'); poly(ctx, [1, -14, 8, -19, 9, -9, 1, -11], '#9ca3af'); }
  if (o.item === 'club') { ctx.rotate(Math.PI - 0.2); poly(ctx, [-1.5, 0, 1.5, 0, 4, -22, -4, -22], '#6b4a2b'); circ(ctx, 0, -22, 4.5, '#6b4a2b'); circ(ctx, -2, -23, 1, '#a8a29e'); circ(ctx, 2, -20, 1, '#a8a29e'); }
  if (o.item === 'spear') { ctx.rotate(Math.PI); rect(ctx, -0.8, -16, 1.6, 34, '#6b4423'); poly(ctx, [-2, -16, 2, -16, 0, -23], '#cbd5e1'); }
  if (o.item === 'mug') { rrect(ctx, -2, -1, 5, 6, 1, '#a16207'); rect(ctx, -2, -1.5, 5, 1.8, '#fef3c7'); }
  if (o.item === 'book') { rect(ctx, -3, -1, 6, 7, '#7f1d1d'); rect(ctx, -2.5, -0.5, 1, 6, '#e7c158'); }
  if (o.item === 'scales') { line(ctx, 0, 0, 0, 5, '#c99a2e', 1); line(ctx, -4, 5, 4, 5, '#c99a2e', 1); ell(ctx, -4, 7, 2, 1, '#c99a2e'); ell(ctx, 4, 7, 2, 1, '#c99a2e'); }
  ctx.restore();
  ctx.restore();
}

const NPC_LOOK = {
  priest: { skin: '#f1c9a5', top: '#f5f0e1', pants: '#e7e0cc', boots: '#a18a6a', apron: '#e7c158', hat: 'hood', hatColor: '#fbf7ea', item: 'book', eyes: '#1e3a8a' },
  merchant: { skin: '#e0ac80', top: '#7c2d12', pants: '#3f3f46', boots: '#3b2a1e', apron: '#d6c9a8', belt: '#3b2a1e', hat: 'cap', hatColor: '#166534', feather: '#dc2626', mustache: '#4a2f17', item: 'scales' },
  innkeeper: { skin: '#f0c19c', top: '#9a3412', pants: '#44403c', boots: '#3b2a1e', apron: '#f5f5f4', hair: '#b45309', item: 'mug', wide: true },
  guard: { skin: '#e2b48c', top: '#1e3a8a', pants: '#475569', boots: '#1f2937', armor: '#9ca3af', belt: '#3b2a1e', hat: 'helm', hatColor: '#9ca3af', item: 'spear', knee: '#9ca3af', beard: '#57534e' },
};
function drawNPC(ctx, n, sx, sy, now) {
  ctx.save();
  ctx.translate(sx, sy + Math.sin(now / 700 + n.x) * 0.4);
  shadowAt(ctx, 0, 1, 11, 4);
  if (n.face < 0) ctx.scale(-1, 1);
  drawPerson(ctx, NPC_LOOK[n.kind], now);
  ctx.restore();
}

// ---------- MONSTROS ----------
function drawMonster(ctx, e, sx, sy, now) {
  const f = e.face || 1;
  const { p } = animProgress(e, now);
  const lunge = p >= 0 ? Math.sin(p * Math.PI) : 0;
  ctx.save();
  ctx.translate(sx, sy);
  if (lunge && e.anim) {
    const dx = (e.anim.tx - e.x) - (e.anim.ty - e.y), dy = ((e.anim.tx - e.x) + (e.anim.ty - e.y)) / 2;
    const l = Math.hypot(dx, dy) || 1;
    ctx.translate(dx / l * lunge * 7, dy / l * lunge * 4);
  }
  if (e.hitAt && now - e.hitAt < 220) ctx.translate(-2.5 * f, -1);
  if (e.dieAt && now > e.dieAt) {
    const t = Math.min(1, (now - e.dieAt) / 600);
    ctx.globalAlpha = 1 - t; ctx.translate(0, t * 6); ctx.scale(1 + t * 0.2, 1 - t * 0.6);
  }
  const hit = e.hitAt && now - e.hitAt < 120;
  const slowed = e.flags & 1;
  if (hit) ctx.filter = 'brightness(2.4)';
  else if (slowed) ctx.filter = 'hue-rotate(160deg) saturate(0.6) brightness(1.2)';
  const walk = e.walking;
  let h = 30;
  const def = MON[e.type];
  const sc = def && def.big ? 1.55 : 1;
  shadowAt(ctx, 0, 1, 13 * sc, 5 * sc);
  if (f < 0) ctx.scale(-1, 1);
  switch (e.type) {
    case 'rat': h = drawRat(ctx, now, walk, lunge); break;
    case 'slime': h = drawSlime(ctx, now, e, lunge); break;
    case 'wolf': h = drawWolf(ctx, now, walk, lunge); break;
    case 'spider': h = drawSpider(ctx, now, walk, lunge); break;
    case 'toad': h = drawToad(ctx, now, lunge); break;
    case 'goblin':
      drawPerson(ctx, { scale: 0.82, skin: '#6d9b3a', top: '#6b4a2b', pants: '#4b3a2a', boots: '#3b2a1e', belt: '#3b2a1e', ears: true, eyes: '#fde047', item: 'dagger', atk: lunge, walking: walk, mouth: '#1f2937', hunch: true }, now);
      h = 36; break;
    case 'skeleton':
      drawPerson(ctx, { skin: '#ece8da', top: '#d6d1bf', pants: '#cfc9b6', boots: '#a8a294', skull: true, ribs: '#8a8574', eyes: '#ef4444', item: 'sword', atk: lunge, walking: walk, skinArm: '#e2ddcc' }, now);
      h = 44; break;
    case 'orc':
      drawPerson(ctx, { scale: 1.12, wide: true, skin: '#5f8a43', top: '#4a3020', pants: '#3d2b1a', boots: '#27180d', armor: '#6b7280', belt: '#27180d', tusks: true, eyes: '#f43f5e', item: 'axe', atk: lunge, walking: walk, hat: 'horns', hatColor: '#4b5563' }, now);
      h = 50; break;
    case 'troll':
      drawPerson(ctx, { scale: sc, wide: true, skin: '#7c8b9a', top: '#57534e', pants: '#44403c', boots: '#7c8b9a', tusks: true, eyes: '#facc15', item: 'club', atk: lunge, walking: walk, slow: true, hunch: true, headR: 7, belt: '#292524' }, now);
      if (true) { circ(ctx, -3 * sc, -44 * sc, 2.5, '#4d7c0f'); circ(ctx, 2 * sc, -46 * sc, 2, '#3f6212'); }
      h = 60; break;
  }
  ctx.filter = 'none';
  ctx.restore();
  // atordoado: estrelinhas girando
  if (e.flags & 2) {
    for (let k = 0; k < 3; k++) {
      const an = now / 180 + k * 2.1;
      ctx.fillStyle = '#fde047';
      ctx.beginPath(); ctx.arc(sx + Math.cos(an) * 9, sy - h - 2 + Math.sin(an) * 3, 1.8, 0, Math.PI * 2); ctx.fill();
    }
  }
  return h;
}

function drawRat(ctx, now, walk, lunge) {
  const leg = walk ? Math.sin(now / 45) * 1.5 : 0;
  ctx.strokeStyle = '#d4a5a5'; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(-9, -5); ctx.bezierCurveTo(-16, -3, -19, -10, -15 + Math.sin(now / 200) * 2, -14); ctx.stroke();
  rect(ctx, -6 + leg, -3, 2, 3, '#6b625a'); rect(ctx, 4 - leg, -3, 2, 3, '#6b625a');
  const g = ctx.createLinearGradient(0, -12, 0, -1);
  g.addColorStop(0, '#9a8f84'); g.addColorStop(1, '#6b625a');
  ell(ctx, 0, -6.5, 11, 6.5, g);
  for (let i = 0; i < 5; i++) line(ctx, -7 + i * 3, -11, -8 + i * 3, -9, '#7a7067', 0.7);
  ell(ctx, 10 + lunge * 2, -8, 5.5, 4.2, '#8a7f75');
  circ(ctx, 7, -13, 3, '#8a7f75'); circ(ctx, 7, -13, 1.8, '#d9a5a5');
  circ(ctx, 15 + lunge * 2, -8, 1.3, '#f0a0a0');
  circ(ctx, 11.5 + lunge * 2, -9.5, 1.1, '#111');
  line(ctx, 14, -7, 18, -9, '#ddd', 0.5); line(ctx, 14, -7, 18, -6, '#ddd', 0.5);
  if (lunge > 0.3) { rect(ctx, 14 + lunge * 2, -6, 1, 2, '#fff'); }
  return 18;
}

function drawSlime(ctx, now, e, lunge) {
  const b = Math.sin(now / 190 + e.id) * 2 + lunge * 3;
  const g = ctx.createRadialGradient(-3, -14, 2, 0, -9, 15);
  g.addColorStop(0, 'rgba(170,255,160,0.95)'); g.addColorStop(0.6, 'rgba(70,190,80,0.9)'); g.addColorStop(1, 'rgba(30,120,50,0.9)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-14 - b * 0.5, -1);
  ctx.quadraticCurveTo(-14, -18 + b, 0, -20 + b);
  ctx.quadraticCurveTo(14, -18 + b, 14 + b * 0.5, -1);
  ctx.quadraticCurveTo(0, 2, -14 - b * 0.5, -1);
  ctx.fill();
  circ(ctx, 1, -8, 3.5, 'rgba(20,90,30,0.5)');
  circ(ctx, -5, -14 + b * 0.5, 2.8, 'rgba(255,255,255,0.55)');
  circ(ctx, -2, -16 + b * 0.5, 1.2, 'rgba(255,255,255,0.7)');
  for (let k = 0; k < 2; k++) { const t = ((now / 1500) + k * 0.5) % 1; circ(ctx, -4 + k * 7, -3 - t * 12, 1 + t, `rgba(220,255,210,${0.6 - t * 0.6})`); }
  rect(ctx, 2, -12 + b * 0.5, 2, 3.5, '#0f2a14'); rect(ctx, 7, -12 + b * 0.5, 2, 3.5, '#0f2a14');
  ctx.strokeStyle = '#0f2a14'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(5.5, -7 + b * 0.5, 2.5, 0.2, Math.PI - 0.2); ctx.stroke();
  return 24;
}

function drawWolf(ctx, now, walk, lunge) {
  const leg = walk ? Math.sin(now / 50) * 2.5 : 0;
  const tail = Math.sin(now / 220) * 2;
  const fur = '#6b7079', furD = '#4b4f57', furL = '#9ca3af';
  rect(ctx, -10, -9 + leg, 3, 9 - leg, furD); rect(ctx, 6, -9 - leg, 3, 9 + leg, furD);
  ctx.fillStyle = fur;
  ctx.beginPath(); ctx.moveTo(-13, -13); ctx.quadraticCurveTo(-22, -18 + tail, -24, -10 + tail); ctx.quadraticCurveTo(-18, -12, -13, -9); ctx.fill();
  const g = ctx.createLinearGradient(0, -20, 0, -6);
  g.addColorStop(0, furL); g.addColorStop(0.5, fur); g.addColorStop(1, furD);
  ell(ctx, -1, -13, 14, 7.5, g);
  for (let i = 0; i < 6; i++) poly(ctx, [-11 + i * 3.5, -19, -9 + i * 3.5, -21.5, -7 + i * 3.5, -18.5], furL);
  rect(ctx, -8, -9 - leg, 3, 9 + leg, fur); rect(ctx, 8, -9 + leg, 3, 9 - leg, fur);
  const hx = 13 + lunge * 3;
  ell(ctx, hx, -18, 7, 6, fur);
  poly(ctx, [hx + 3, -20, hx + 12, -17, hx + 11, -13, hx + 3, -14], furL);
  circ(ctx, hx + 12, -16.5, 1.3, '#111');
  poly(ctx, [hx - 3, -22, hx - 1, -30, hx + 2, -23], fur); poly(ctx, [hx - 2, -23, hx - 1, -28, hx + 1, -23], '#c08080');
  poly(ctx, [hx + 1, -23, hx + 4, -30, hx + 5, -22], fur);
  circ(ctx, hx + 4, -19.5, 1.3, '#fbbf24'); circ(ctx, hx + 4.3, -19.5, 0.5, '#111');
  if (lunge > 0.2) { poly(ctx, [hx + 4, -13, hx + 11, -12, hx + 10, -9, hx + 5, -10], '#7f1d1d'); poly(ctx, [hx + 6, -13, hx + 7, -11, hx + 8, -13], '#fff'); }
  return 32;
}

function drawSpider(ctx, now, walk, lunge) {
  const t = now / (walk ? 60 : 400);
  ctx.strokeStyle = '#1c1917'; ctx.lineWidth = 1.8;
  for (let i = 0; i < 4; i++) {
    const ph = Math.sin(t + i * 1.3) * (walk ? 2.5 : 0.6);
    const bx = -2 + i * 3;
    ctx.beginPath(); ctx.moveTo(bx, -10); ctx.lineTo(bx - 7 - i, -17 + ph); ctx.lineTo(bx - 12 - i * 1.5, -1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(bx, -10); ctx.lineTo(bx + 6 + i, -17 - ph); ctx.lineTo(bx + 11 + i * 1.5, -1); ctx.stroke();
  }
  const g = ctx.createRadialGradient(-6, -15, 1, -5, -12, 11);
  g.addColorStop(0, '#57534e'); g.addColorStop(1, '#1c1917');
  ell(ctx, -6, -12, 10, 8, g);
  poly(ctx, [-6, -16, -4, -12, -6, -8, -8, -12], '#dc2626');
  for (let i = 0; i < 6; i++) line(ctx, -14 + i * 3, -18, -13 + i * 3, -16, '#44403c', 0.7);
  ell(ctx, 5 + lunge * 3, -9, 6, 5, '#292524');
  for (let i = 0; i < 4; i++) circ(ctx, 6 + lunge * 3 + (i % 2) * 2.5, -11 + Math.floor(i / 2) * 2, 0.9, '#ef4444');
  poly(ctx, [9 + lunge * 3, -7, 12 + lunge * 4, -4, 9 + lunge * 3, -5], '#e7e5e4');
  return 24;
}

function drawToad(ctx, now, lunge) {
  const sac = 2 + Math.sin(now / 250) * 1.5;
  const g = ctx.createLinearGradient(0, -22, 0, 0);
  g.addColorStop(0, '#7a8f3a'); g.addColorStop(1, '#4d5e22');
  ell(ctx, -8, -3, 6, 3, '#5c6e28'); ell(ctx, 8, -3, 6, 3, '#5c6e28');
  ell(ctx, 0, -10, 14, 10, g);
  for (let i = 0; i < 7; i++) circ(ctx, -9 + hash2(i, 1, 5) * 16, -16 + hash2(i, 2, 5) * 10, 1.4, '#3f4d1b');
  ell(ctx, 6, -5, 6 + sac * 0.5, 3 + sac, '#d9c27a');
  circ(ctx, 2, -19, 4, '#7a8f3a'); circ(ctx, 9, -18, 4, '#7a8f3a');
  circ(ctx, 2.5, -19.5, 2.2, '#fbbf24'); circ(ctx, 9.5, -18.5, 2.2, '#fbbf24');
  rect(ctx, 1.5, -20, 2, 1, '#111'); rect(ctx, 8.5, -19, 2, 1, '#111');
  ctx.strokeStyle = '#2e3a12'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(1, -11); ctx.quadraticCurveTo(8, -9, 14, -12); ctx.stroke();
  if (lunge > 0.1) { ctx.strokeStyle = '#e11d48'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(12, -11); ctx.lineTo(12 + lunge * 14, -9); ctx.stroke(); circ(ctx, 12 + lunge * 14, -9, 2, '#e11d48'); }
  return 26;
}

// ---------- ícones das habilidades ----------
function drawSkillIcon(ctx, id, S) {
  ctx.save();
  ctx.clearRect(0, 0, S, S);
  const bg = ctx.createRadialGradient(S / 2, S / 2, 2, S / 2, S / 2, S * 0.7);
  const tint = { bash: '#7c2d12', warcry: '#7f1d1d', whirl: '#3f3f46', wall: '#854d0e', double: '#365314', pierce: '#14532d', rain: '#1e3a2f', agile: '#065f46', fireball: '#7c2d12', nova: '#0c4a6e', heal: '#14532d', meteor: '#581c87', hp: '#450a0a', mp: '#172554' }[id] || '#333';
  bg.addColorStop(0, shade(tint, 0.25)); bg.addColorStop(1, shade(tint, -0.5));
  ctx.fillStyle = bg; ctx.fillRect(0, 0, S, S);
  ctx.translate(S / 2, S / 2);
  ctx.scale(S / 40, S / 40);
  ctx.lineCap = 'round';
  switch (id) {
    case 'bash': ctx.rotate(-0.7); sword(ctx, 22, '#fb923c'); ctx.rotate(0.7); circ(ctx, 8, 8, 4, 'rgba(251,146,60,0.7)'); break;
    case 'warcry': for (let i = 1; i <= 3; i++) { ctx.strokeStyle = `rgba(254,202,202,${1 - i * 0.25})`; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(-6, 0, i * 6, -0.9, 0.9); ctx.stroke(); } circ(ctx, -9, 0, 4, '#fecaca'); break;
    case 'whirl': ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 12, 0, 4.6); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 6, 1.5, 5.8); ctx.stroke(); poly(ctx, [12, -4, 16, 2, 8, 2], '#e5e7eb'); break;
    case 'wall': poly(ctx, [-11, -13, 11, -13, 11, 2, 0, 15, -11, 2], '#e7c158'); poly(ctx, [-8, -10, 8, -10, 8, 1, 0, 11, -8, 1], '#a16207'); rect(ctx, -1.5, -8, 3, 16, '#fde68a'); rect(ctx, -6, -3, 12, 3, '#fde68a'); break;
    case 'double': for (const o of [-4, 4]) { line(ctx, -13, 9 + o, 9, -9 + o, '#d6c9a8', 2); poly(ctx, [9, -13 + o, 14, -14 + o, 12, -8 + o], '#cbd5e1'); } break;
    case 'pierce': line(ctx, -15, 0, 12, 0, '#bbf7d0', 3); poly(ctx, [12, -5, 18, 0, 12, 5], '#ecfccb'); for (const x of [-6, 2]) { ctx.strokeStyle = '#86efac'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, 0, 6, -1.2, 1.2); ctx.stroke(); } break;
    case 'rain': for (let i = 0; i < 5; i++) { const x = -12 + i * 6, y = -10 + (i % 2) * 6; line(ctx, x, y - 6, x, y + 6, '#d6c9a8', 1.6); poly(ctx, [x - 2.5, y + 5, x + 2.5, y + 5, x, y + 10], '#cbd5e1'); } break;
    case 'agile': for (let i = 0; i < 3; i++) { ctx.strokeStyle = '#6ee7b7'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(-14, -8 + i * 8); ctx.quadraticCurveTo(0, -12 + i * 8, 13, -6 + i * 8); ctx.stroke(); } break;
    case 'fireball': { const g = ctx.createRadialGradient(3, -3, 1, 0, 0, 14); g.addColorStop(0, '#fff7cc'); g.addColorStop(0.4, '#fb923c'); g.addColorStop(1, 'rgba(220,38,38,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 14, 0, 7); ctx.fill(); poly(ctx, [-4, 6, -16, 14, -8, 2], 'rgba(251,146,60,0.7)'); break; }
    case 'nova': for (let i = 0; i < 6; i++) { ctx.save(); ctx.rotate(i * Math.PI / 3); line(ctx, 0, 0, 0, -14, '#e0f2fe', 2.2); line(ctx, 0, -8, -4, -12, '#e0f2fe', 1.6); line(ctx, 0, -8, 4, -12, '#e0f2fe', 1.6); ctx.restore(); } circ(ctx, 0, 0, 3, '#bae6fd'); break;
    case 'heal': { const g = ctx.createRadialGradient(0, 0, 1, 0, 0, 16); g.addColorStop(0, 'rgba(254,249,195,0.9)'); g.addColorStop(1, 'rgba(134,239,172,0)'); ctx.fillStyle = g; ctx.fillRect(-20, -20, 40, 40); rect(ctx, -3, -12, 6, 24, '#bbf7d0'); rect(ctx, -12, -3, 24, 6, '#bbf7d0'); break; }
    case 'meteor': for (const [x, y, r] of [[-6, -6, 6], [8, 2, 4], [-2, 10, 3]]) { line(ctx, x - r * 2, y - r * 2, x, y, 'rgba(251,146,60,0.7)', r); circ(ctx, x, y, r, '#78350f'); circ(ctx, x - r * 0.3, y - r * 0.3, r * 0.5, '#f97316'); } break;
    case 'hp': case 'mp': {
      const c = id === 'hp' ? '#dc2626' : '#2563eb';
      ell(ctx, 0, 4, 10, 10, 'rgba(255,255,255,0.25)'); ell(ctx, 0, 5, 8.5, 8.5, c); ell(ctx, -3, 2, 2.5, 3, 'rgba(255,255,255,0.6)');
      rect(ctx, -3, -12, 6, 8, 'rgba(255,255,255,0.3)'); rect(ctx, -4, -14, 8, 3, '#92400e'); break;
    }
  }
  ctx.restore();
}
