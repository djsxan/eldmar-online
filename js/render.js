// ============================================================
//  RENDER — o mundo é desenhado numa tela pequena (resolução de
//  pixel art) e depois ampliada sem suavização. Isso dá o visual
//  retrô e deixa o jogo MUITO mais leve.
// ============================================================
let SCALE = 6;                         // quantos pixels de tela por pixel de arte
const low = document.createElement('canvas'), lctx = low.getContext('2d');
const lightC = document.createElement('canvas'), lightX = lightC.getContext('2d');
let LW = 0, LH = 0, lastFrameT = performance.now();

function wind(x, y, now) { return Math.sin(now / 1400 + x * 0.37 + y * 0.21) + Math.sin(now / 530 + x * 1.1) * 0.35; }
function windFrame(x, y, now) { const w = wind(x, y, now); return w > 0.55 ? 2 : w < -0.55 ? 0 : 1; }

// ---------- dia e noite (igual para todos: usa o relógio) ----------
const DAY_CYCLE_MS = 12 * 60 * 1000;
function dayInfo() {
  const ph = (Date.now() % DAY_CYCLE_MS) / DAY_CYCLE_MS;
  const sun = Math.cos(ph * Math.PI * 2);
  const k = clamp((0.15 - sun) / 0.65, 0, 1);
  const dark = smooth(k) * 0.66;
  const dusk = Math.max(0, 1 - Math.abs(sun + 0.05) / 0.35);
  return { dark, dusk, night: dark > 0.3, phase: ph };
}

// ---------- partículas ----------
function spawnPart(kind, x, y, extra) {
  if (G.parts.length > 350) return;
  const p = { kind, x, y, vx: 0, vy: 0, t0: performance.now(), life: 1000, seed: Math.random() * 100, ...extra };
  switch (kind) {
    case 'smoke': p.life = 2600; p.vx = 0.002; p.vy = -0.006; break;
    case 'ember': p.life = 900; p.vx = (Math.random() - 0.5) * 0.01; p.vy = -0.02; break;
    case 'leaf': p.life = 4200; p.vy = 0.006; p.vx = 0.004; p.color = p.color || (Math.random() < 0.5 ? '#6a9a42' : '#b8902a'); break;
    case 'butterfly': p.life = 7000; p.color = pick(['#e889b0', '#e8d04a', '#a8c8f0', '#f0a860', '#f2ede0']); break;
    case 'firefly': p.life = 5000; break;
    case 'spark': p.life = 350 + Math.random() * 300; { const a = Math.random() * Math.PI * 2, s = 0.025 + Math.random() * 0.06; p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s * 0.6 - 0.025; } break;
    case 'sparkle': p.life = 900; p.vy = -0.015 - Math.random() * 0.01; p.vx = (Math.random() - 0.5) * 0.005; break;
    case 'dust': p.life = 450; p.vx = (Math.random() - 0.5) * 0.01; p.vy = -0.004; break;
    case 'shard': p.life = 700; { const a = Math.random() * Math.PI * 2, s = 0.02 + Math.random() * 0.04; p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s * 0.5 - 0.03; } break;
    case 'mist': p.life = 1600; p.vx = (Math.random() - 0.3) * 0.01; p.vy = -0.008; break;
    case 'snow': p.life = 1400; p.vx = (Math.random() - 0.5) * 0.006; p.vy = 0.004; break;
    case 'blood': p.life = 500; { const a = Math.random() * Math.PI * 2, s = 0.02 + Math.random() * 0.04; p.vx = Math.cos(a) * s; p.vy = -0.03 - Math.random() * 0.02; } break;
  }
  G.parts.push(p);
}
function drawParticles(ctx, ox, oy, now, dt) {
  const keep = [];
  for (const p of G.parts) {
    const age = now - p.t0;
    if (age > p.life) continue;
    keep.push(p);
    const t = age / p.life;
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.kind === 'blood' || p.kind === 'shard') p.vy += 0.00012 * dt;
    const x = Math.round(p.x + ox), y = Math.round(p.y + oy);
    switch (p.kind) {
      case 'smoke': ctx.fillStyle = `rgba(130,130,130,${0.35 * (1 - t)})`; { const r = 1 + Math.round(t * 4); ctx.fillRect(x + Math.round(Math.sin(age / 500 + p.seed) * 2) - r, y - r, r * 2, r * 2); } break;
      case 'ember': ctx.fillStyle = `rgba(255,${150 + Math.round(p.seed * 9 % 80)},60,${1 - t})`; ctx.fillRect(x, y, 1, 1); G.lights.push({ x, y, r: 6, c: '255,150,60', a: 0.5 * (1 - t) }); break;
      case 'leaf': ctx.fillStyle = p.color; ctx.globalAlpha = t > 0.8 ? (1 - t) * 5 : 1; ctx.fillRect(x + Math.round(Math.sin(age / 400 + p.seed) * 4), y, 2, 1); ctx.globalAlpha = 1; break;
      case 'butterfly': {
        const bx = x + Math.round(Math.sin(age / 900 + p.seed) * 14 + Math.sin(age / 230) * 2), by = y + Math.round(Math.cos(age / 1200 + p.seed) * 7 - 8 - Math.abs(Math.sin(age / 160)) * 2);
        ctx.globalAlpha = Math.min(1, (1 - t) * 4, t * 6); ctx.fillStyle = p.color;
        const fl = Math.abs(Math.sin(age / 60)) > 0.5; ctx.fillRect(bx - (fl ? 2 : 1), by, fl ? 2 : 1, 1); ctx.fillRect(bx + 1, by, fl ? 2 : 1, 1);
        ctx.globalAlpha = 1; break;
      }
      case 'firefly': {
        const fx = x + Math.round(Math.sin(age / 700 + p.seed) * 7), fy = y + Math.round(Math.cos(age / 900 + p.seed) * 4 - 6);
        const a = Math.max(0, Math.sin(age / 300 + p.seed)) * Math.min(1, (1 - t) * 4);
        ctx.fillStyle = `rgba(220,255,130,${a})`; ctx.fillRect(fx, fy, 1, 1);
        G.lights.push({ x: fx, y: fy, r: 9, c: '200,255,120', a: a * 0.8 }); break;
      }
      case 'spark': ctx.fillStyle = (p.color || 'rgba(255,240,180,A)').replace('A', String(1 - t)); ctx.fillRect(x, y, 1, 1); break;
      case 'sparkle': ctx.fillStyle = (p.color || 'rgba(255,240,150,A)').replace('A', String(1 - t)); ctx.fillRect(x, y - 1, 1, 3); ctx.fillRect(x - 1, y, 3, 1); break;
      case 'dust': ctx.fillStyle = `rgba(170,150,110,${0.45 * (1 - t)})`; ctx.fillRect(x - 1, y, 2 + Math.round(t * 2), 1); break;
      case 'shard': ctx.fillStyle = `rgba(210,240,255,${1 - t})`; ctx.fillRect(x, y, 1, 2); break;
      case 'mist': ctx.fillStyle = `rgba(230,245,255,${0.35 * (1 - t)})`; { const r = 1 + Math.round(t * 3); ctx.fillRect(x - r, y - r, r * 2, r * 2); } break;
      case 'snow': ctx.fillStyle = `rgba(240,248,255,${1 - t})`; ctx.fillRect(x, y, 1, 1); break;
      case 'blood': ctx.fillStyle = `rgba(150,30,30,${1 - t})`; ctx.fillRect(x, y, 1, 1); break;
    }
  }
  G.parts = keep;
}

// ---------- efeitos de combate ----------
function tileW(x, y, z = 0) { const p = iso(x, y); return { x: p.sx, y: p.sy - z }; }
const easeOut = t => 1 - (1 - t) * (1 - t);
function ring(ctx, cx, cy, r, color, w = 1) { ctx.strokeStyle = color; ctx.lineWidth = w; ctx.beginPath(); ctx.ellipse(cx, cy, Math.max(0.1, r), Math.max(0.1, r / 2), 0, 0, Math.PI * 2); ctx.stroke(); }
function glowDot(ctx, x, y, r, inner, outer) { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, inner); g.addColorStop(1, outer); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); }

function drawEffects(ctx, ox, oy, now) {
  const keep = [];
  for (const e of G.effects) {
    const age = now - e.t0;
    if (age < 0) { keep.push(e); continue; }
    if (age > e.dur) continue;
    keep.push(e);
    const t = age / e.dur, c = tileW(e.x, e.y), cx = c.x + ox, cy = c.y + oy;
    switch (e.a) {
      case 'proj': {
        const a = e.from, b = tileW(e.tx, e.ty, 12);
        const px_ = a.x + (b.x - a.x) * t + ox, py_ = a.y + (b.y - a.y) * t + oy - Math.sin(t * Math.PI) * (e.kind === 'arrow' ? 6 : 3);
        const ang = Math.atan2(b.y - a.y, b.x - a.x);
        if (e.kind === 'arrow') {
          ctx.fillStyle = '#e8dcc0';
          for (let k = 0; k < 7; k++) ctx.fillRect(Math.round(px_ - Math.cos(ang) * k), Math.round(py_ - Math.sin(ang) * k), 1, 1);
          ctx.fillStyle = '#c0c6ce'; ctx.fillRect(Math.round(px_ + Math.cos(ang)), Math.round(py_ + Math.sin(ang)), 1, 1);
          ctx.fillStyle = '#b8382a'; ctx.fillRect(Math.round(px_ - Math.cos(ang) * 7), Math.round(py_ - Math.sin(ang) * 7), 1, 1);
        } else if (e.kind === 'bolt') {
          glowDot(ctx, px_, py_, 5, 'rgba(240,235,255,1)', 'rgba(140,110,230,0)');
          if (Math.random() < 0.6) spawnPart('sparkle', px_ - ox, py_ - oy, { color: 'rgba(196,181,253,A)', life: 400 });
          G.lights.push({ x: px_, y: py_, r: 16, c: '167,139,250', a: 0.8 });
        } else if (e.kind === 'fire') {
          glowDot(ctx, px_, py_, 8, 'rgba(255,250,220,1)', 'rgba(230,70,30,0)');
          spawnPart('ember', px_ - ox + (Math.random() - 0.5) * 4, py_ - oy + (Math.random() - 0.5) * 4);
          G.lights.push({ x: px_, y: py_, r: 36, c: '255,140,50', a: 1 });
        }
        break;
      }
      case 'whirl':
        ctx.strokeStyle = `rgba(255,255,255,${0.8 * (1 - t)})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(cx, cy - 6, 24, 12, 0, t * 12, t * 12 + 3.5); ctx.stroke();
        ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(cx, cy - 6, 28, 14, 0, t * 12 + 1, t * 12 + 4); ctx.stroke();
        if (Math.random() < 0.5) spawnPart('dust', c.x + (Math.random() - 0.5) * 30, c.y + (Math.random() - 0.5) * 10);
        break;
      case 'warcry':
        for (let k = 0; k < 3; k++) { const r = (t * 1.2 - k * 0.15) * 80; if (r > 0) ring(ctx, cx, cy, r, `rgba(230,110,90,${Math.max(0, 0.8 - t)})`, 1); }
        G.lights.push({ x: cx, y: cy - 10, r: 40 * (1 - t), c: '230,110,90', a: 0.6 });
        break;
      case 'wall': case 'agile': case 'potion': {
        const col = e.a === 'wall' ? '240,210,110' : e.a === 'agile' ? '120,220,170' : (e.k === 'hp' ? '230,110,110' : '110,150,240');
        ring(ctx, cx, cy, 5 + t * 15, `rgba(${col},${1 - t})`, 1);
        if (Math.random() < 0.6) spawnPart('sparkle', c.x + (Math.random() - 0.5) * 12, c.y - Math.random() * 16, { color: `rgba(${col},A)` });
        break;
      }
      case 'pierce': {
        const b = tileW(e.x2, e.y2);
        ctx.strokeStyle = `rgba(190,245,200,${0.9 * (1 - t)})`; ctx.lineWidth = Math.max(1, 3 * (1 - t));
        ctx.beginPath(); ctx.moveTo(cx, cy - 10); ctx.lineTo(b.x + ox, b.y + oy - 10); ctx.stroke();
        const ax = cx + (b.x + ox - cx) * Math.min(1, t * 2), ay = cy - 10 + (b.y + oy - cy) * Math.min(1, t * 2);
        ctx.fillStyle = '#efffe8'; ctx.fillRect(Math.round(ax) - 1, Math.round(ay) - 1, 3, 3);
        G.lights.push({ x: ax, y: ay, r: 20, c: '187,247,208', a: 0.8 });
        break;
      }
      case 'rain':
        for (let k = 0; k < 18; k++) {
          const tk = t * 1.6 - hash2(k, 1, e.seed) * 0.6; if (tk < 0 || tk > 1) continue;
          const tx = Math.round(cx + (hash2(k, 2, e.seed) - 0.5) * 60), ty = Math.round(cy + (hash2(k, 3, e.seed) - 0.5) * 26), yy = Math.round(ty - 70 * (1 - tk));
          ctx.fillStyle = '#e8dcc0'; ctx.fillRect(tx, yy - 6, 1, 6); ctx.fillStyle = '#c0c6ce'; ctx.fillRect(tx, yy, 1, 1);
          if (tk > 0.95) spawnPart('dust', tx - ox, ty - oy);
        }
        break;
      case 'boom': {
        const r = 5 + easeOut(t) * 17;
        glowDot(ctx, cx, cy - 7, r, `rgba(255,250,230,${1 - t})`, 'rgba(230,70,30,0)');
        if (!e.sp) { e.sp = 1; for (let k = 0; k < 12; k++) spawnPart('spark', c.x, c.y - 7, { color: 'rgba(253,186,116,A)' }); }
        G.lights.push({ x: cx, y: cy - 7, r: 60 * (1 - t), c: '255,150,60', a: 1 });
        break;
      }
      case 'nova': {
        const r = easeOut(t) * 75;
        ctx.fillStyle = `rgba(186,230,253,${0.3 * (1 - t)})`; ctx.beginPath(); ctx.ellipse(cx, cy, r, r / 2, 0, 0, Math.PI * 2); ctx.fill();
        ring(ctx, cx, cy, r, `rgba(225,242,254,${1 - t})`, 1);
        ctx.fillStyle = `rgba(225,242,254,${0.9 * (1 - t)})`;
        for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2, sx = Math.round(cx + Math.cos(a) * r * 0.85), sy = Math.round(cy + Math.sin(a) * r * 0.42), h = Math.round(9 * Math.sin(Math.min(1, t * 2) * Math.PI)); ctx.fillRect(sx, sy - h, 2, h); }
        if (!e.sp) { e.sp = 1; for (let k = 0; k < 18; k++) spawnPart('shard', c.x, c.y - 5); }
        G.lights.push({ x: cx, y: cy, r: 70 * (1 - t * 0.5), c: '186,230,253', a: 0.9 * (1 - t) });
        break;
      }
      case 'heal': case 'lvlup': {
        const gold = e.a === 'lvlup', alpha = Math.sin(t * Math.PI), w = gold ? 14 : 10, col = gold ? '240,210,110' : '150,230,150';
        const g = ctx.createLinearGradient(0, cy - 60, 0, cy);
        g.addColorStop(0, `rgba(${col},0)`); g.addColorStop(1, `rgba(${col},${0.5 * alpha})`);
        ctx.fillStyle = g; ctx.fillRect(Math.round(cx - w / 2), Math.round(cy - 60), w, 60);
        ring(ctx, cx, cy, 9 + t * 5, `rgba(${col},${alpha})`, 1);
        if (Math.random() < 0.7) spawnPart('sparkle', c.x + (Math.random() - 0.5) * 14, c.y - Math.random() * 12, { color: `rgba(${col},A)` });
        G.lights.push({ x: cx, y: cy - 15, r: 45, c: col, a: alpha });
        break;
      }
      case 'meteor':
        for (let k = 0; k < 5; k++) {
          const st = hash2(k, 4, e.seed) * 0.35, tk = (t - st) / 0.45;
          const tx = cx + (hash2(k, 5, e.seed) - 0.5) * 70, ty = cy + (hash2(k, 6, e.seed) - 0.5) * 30;
          if (tk >= 0 && tk <= 1) {
            const mx = tx - 80 * (1 - tk), my = ty - 130 * (1 - tk);
            ctx.strokeStyle = 'rgba(250,140,60,0.6)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(mx - 20, my - 32); ctx.lineTo(mx, my); ctx.stroke();
            glowDot(ctx, mx, my, 7, 'rgba(255,250,230,1)', 'rgba(120,50,15,0)');
            G.lights.push({ x: mx, y: my, r: 30, c: '255,140,50', a: 1 });
          } else if (tk > 1 && tk < 1.8) {
            const bt = (tk - 1) / 0.8;
            glowDot(ctx, tx, ty - 4, 6 + bt * 20, `rgba(255,240,200,${1 - bt})`, 'rgba(127,29,29,0)');
            if (!e['b' + k]) { e['b' + k] = 1; G.shake = Math.max(G.shake, 4); for (let q = 0; q < 10; q++) spawnPart('spark', tx - ox, ty - oy - 4, { color: 'rgba(253,186,116,A)' }); }
            G.lights.push({ x: tx, y: ty - 4, r: 65 * (1 - bt), c: '255,140,50', a: 1 });
          }
        }
        break;
    }
  }
  G.effects = keep;
}

function drawMagicCircle(ctx, cx, cy, now, el, prog) {
  const col = { fire: '250,150,70', ice: '130,210,250', holy: '240,215,110', wind: '120,220,170', phys: '230,230,230' }[el] || '196,181,253';
  ctx.save(); ctx.translate(cx, cy); ctx.scale(1, 0.5);
  ctx.strokeStyle = `rgba(${col},0.9)`; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(0, 0, 13, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 10, 0, 7); ctx.stroke();
  ctx.rotate(now / 600);
  ctx.beginPath();
  for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3, a2 = a + Math.PI * 2 / 3; ctx.moveTo(Math.cos(a) * 10, Math.sin(a) * 10); ctx.lineTo(Math.cos(a2) * 10, Math.sin(a2) * 10); }
  ctx.stroke();
  ctx.fillStyle = `rgba(${col},${0.15 + prog * 0.25})`; ctx.beginPath(); ctx.arc(0, 0, 13, 0, 7); ctx.fill();
  ctx.restore();
  G.lights.push({ x: cx, y: cy - 3, r: 30, c: col, a: 0.6 + prog * 0.4 });
}

const SHADOW = sprite('shadow', 16, 6, 8, 3, pc => pc.e(8, 3, 7, 2.6, px('#000000', 0, 70)), { outline: false });
const SHADOW_BIG = sprite('shadowb', 28, 9, 14, 4, pc => pc.e(14, 4.5, 13, 4, px('#000000', 0, 70)), { outline: false });

// ---------- desenho de entidades ----------
const DIR_VIEW = ['S', 'E', 'N', 'W']; // 0..3
const ANIM_MS = { swing: 380, bash: 460, spin: 520, shout: 650, block: 550, shoot: 420, shootup: 520, thrust: 380, cast: 600, bite: 320 };
function heroPoseFor(e, now) {
  const view0 = DIR_VIEW[e.dir || 0];
  const P = { view: view0 === 'W' ? 'E' : view0, walk: -1, act: null, idle: null, sit: false, carry: !!e.carrying };
  if (e.walking) P.walk = Math.floor(e.walkDist * 2.6) % 8;
  if (e.anim) {
    const ms = ANIM_MS[e.anim.a] || 400, t = (now - e.anim.t0) / ms;
    if (t >= 0 && t < 1) {
      P.act = { k: e.anim.a, f: Math.min(5, Math.floor(t * 6)) };
      if (e.anim.a === 'spin') { const v = ['S', 'E', 'N', 'W'][Math.floor(t * 8) % 4]; P.view = v === 'W' ? 'E' : v; P.flipSpin = v === 'W'; }
    }
  }
  if (e.cast && e.cast.end > now) P.act = { k: 'cast', f: Math.floor(now / 150) % 6 };
  if (!P.act && !e.walking && e.idleAnim) {
    const t = (now - e.idleAnim.t0) / e.idleAnim.dur;
    if (t < 1) {
      if (e.idleAnim.k === 'sit') P.sit = true;
      else P.idle = { k: e.idleAnim.k, f: Math.min(7, Math.floor(t * 8)) };
    }
  }
  return P;
}

function drawHeroEntity(ctx, e, sx, sy, now) {
  if (e.downed && !e.carriedBy) { drawLying(ctx, e, sx, sy); return; }
  const P = heroPoseFor(e, now);
  const flip = P.flipSpin != null ? P.flipSpin : DIR_VIEW[e.dir || 0] === 'W';
  blit(ctx, SHADOW, sx, sy);
  const key = e.isNpc ? 'n|' + e.kind + '|' + poseKey(P) : 'h|' + e.cls + ':' + e.skin + ':' + e.color + '|' + poseKey(P);
  const spr = e.isNpc ? npcSprite(e.kind, P) : heroSprite(e.cls, e.skin, e.color, P);
  blit(ctx, spr, sx, sy, flip);
  if (e.hitAt && now - e.hitAt < 110) { ctx.globalAlpha = 0.7; blit(ctx, whiteOf(spr, key), sx, sy, flip); ctx.globalAlpha = 1; }
}
function drawLying(ctx, e, sx, sy) {
  const spr = heroSprite(e.cls, e.skin, e.color, { view: 'S', walk: -1 });
  blit(ctx, SHADOW_BIG, sx, sy);
  ctx.save();
  ctx.translate(Math.round(sx), Math.round(sy - 2));
  ctx.rotate(-Math.PI / 2);
  ctx.drawImage(spr.c, -spr.ax, -30);
  ctx.restore();
  if (Math.random() < 0.02) spawnPart('blood', sx - G.view.ox, sy - G.view.oy - 2);
}
function drawCarried(ctx, e, sx, sy) {
  const spr = heroSprite(e.cls, e.skin, e.color, { view: 'S', walk: -1 });
  ctx.save();
  ctx.translate(Math.round(sx + 1), Math.round(sy - 36));
  ctx.rotate(-Math.PI / 2);
  ctx.drawImage(spr.c, -spr.ax, -30);
  ctx.restore();
}
function drawMonsterEntity(ctx, e, sx, sy, now) {
  const def = MON[e.type];
  let atk = -1;
  if (e.anim) { const t = (now - e.anim.t0) / ANIM_MS.bite; if (t >= 0 && t < 1) atk = Math.min(3, Math.floor(t * 4)); }
  const f = e.walking ? Math.floor(e.walkDist * 3) % 4 : (Math.floor(now / 450 + e.id) % 2) * ((e.type === 'slime' || e.type === 'toad') ? 1 : 0);
  const spr = monSprite(e.type, f, atk);
  let alpha = 1, sink = 0;
  if (e.dieAt && now > e.dieAt) { const t = Math.min(1, (now - e.dieAt) / 600); alpha = 1 - t; sink = Math.round(t * 4); }
  blit(ctx, def.big ? SHADOW_BIG : SHADOW, sx, sy);
  ctx.globalAlpha = alpha;
  const ox = e.hitAt && now - e.hitAt < 200 ? -(e.face || 1) : 0;
  blit(ctx, spr, sx + ox, sy + sink, (e.face || 1) < 0);
  if (e.hitAt && now - e.hitAt < 110) { ctx.globalAlpha = 0.75 * alpha; blit(ctx, whiteOf(spr, `m|${e.type}|${f}|${atk}`), sx + ox, sy + sink, (e.face || 1) < 0); }
  ctx.globalAlpha = 1;
  if (e.flags & 1 && Math.random() < 0.2) spawnPart('snow', sx - G.view.ox + (Math.random() - 0.5) * 12, sy - G.view.oy - Math.random() * 16);
  if (e.flags & 2) for (let k = 0; k < 3; k++) { const a = now / 180 + k * 2.1; ctx.fillStyle = '#f0d040'; ctx.fillRect(Math.round(sx + Math.cos(a) * 6), Math.round(sy - spr.ay + 2 + Math.sin(a) * 2), 1, 1); }
}
function heroExtras(e, sx, sy) {
  if (e.isNpc) return;
  const L = lookFor(e.cls + ':' + e.skin + ':' + e.color, () => heroLook(e.cls, e.skin, e.color));
  if (e.cls === 'mage' && !e.downed) G.lights.push({ x: sx + (DIR_VIEW[e.dir || 0] === 'W' ? -8 : 8), y: sy - 42, r: 16, c: '150,190,255', a: 0.6 });
  if (!e.walking && Math.random() > 0.06) return;
  switch (L.extra) {
    case 'ember': spawnPart('ember', sx - G.view.ox + (Math.random() - 0.5) * 10, sy - G.view.oy - 8 - Math.random() * 14); break;
    case 'halo': spawnPart('sparkle', sx - G.view.ox + (Math.random() - 0.5) * 12, sy - G.view.oy - 14 - Math.random() * 20, { color: 'rgba(250,225,140,A)' }); break;
    case 'frost': spawnPart('snow', sx - G.view.ox + (Math.random() - 0.5) * 12, sy - G.view.oy - 30); break;
    case 'leaf': spawnPart('leaf', sx - G.view.ox + (Math.random() - 0.5) * 10, sy - G.view.oy - 30, { color: Math.random() < 0.5 ? '#7cc24a' : '#c9a24a' }); break;
  }
}
function drawAuras(ctx, e, sx, sy, now) {
  const fl = e.flags || 0;
  if (fl & BUFF_BITS.wall) {
    const a = 0.25 + Math.sin(now / 200) * 0.08;
    ctx.strokeStyle = `rgba(240,210,110,${a + 0.3})`; ctx.fillStyle = `rgba(240,210,110,${a * 0.4})`; ctx.lineWidth = 1;
    ctx.beginPath(); for (let k = 0; k < 6; k++) { const an = k * Math.PI / 3 + now / 1000; ctx.lineTo(sx + Math.cos(an) * 11, sy - 14 + Math.sin(an) * 14); } ctx.closePath(); ctx.fill(); ctx.stroke();
    G.lights.push({ x: sx, y: sy - 14, r: 26, c: '240,210,110', a: 0.5 });
  }
  if (fl & BUFF_BITS.agile) for (let k = 0; k < 3; k++) { const an = now / 150 + k * 2.1; ctx.strokeStyle = 'rgba(120,220,170,0.7)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(sx, sy - 1 - k * 2, 8, 3, 0, an, an + 1.6); ctx.stroke(); }
  if (fl & BUFF_BITS.warcry) ring(ctx, sx, sy, 9, `rgba(230,110,90,${0.4 + Math.sin(now / 120) * 0.2})`, 1);
  if (fl & BUFF_BITS.bless && Math.random() < 0.04) spawnPart('sparkle', sx - G.view.ox, sy - G.view.oy - Math.random() * 26, { color: 'rgba(250,225,140,A)' });
  if (e.isNpc || e.downed) return;
  const L = lookFor(e.cls + ':' + e.skin + ':' + e.color, () => heroLook(e.cls, e.skin, e.color));
  if (L.extra === 'orbit') for (let k = 0; k < 3; k++) { const an = now / 500 + k * 2.1, x = Math.round(sx + Math.cos(an) * 10), y = Math.round(sy - 20 + Math.sin(an) * 4); ctx.fillStyle = '#d8ecff'; ctx.fillRect(x, y, 1, 1); G.lights.push({ x, y, r: 6, c: '200,225,255', a: 0.6 }); }
  if (L.extra === 'halo') { ctx.strokeStyle = 'rgba(250,225,140,0.75)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(sx, sy - 47, 5, 1.6, 0, 0, Math.PI * 2); ctx.stroke(); G.lights.push({ x: sx, y: sy - 46, r: 12, c: '250,225,140', a: 0.6 }); }
}

// ---------- objetos ----------
const TREE_TINT = { [Z.FOREST]: 3, [Z.SWAMP]: 3, [Z.WILD]: 1 };
function objSprite(o, x, y, now) {
  const h = hash2(x, y, 17), v = Math.floor(h * 3), i = y * MAP_W + x, z = WORLD.zone[i];
  switch (o) {
    case O.TREE: return treeSprite(v, windFrame(x, y, now), h > 0.88 && z !== Z.FOREST ? 2 : (TREE_TINT[z] || 0));
    case O.PINE: return pineSprite(v, windFrame(x, y, now));
    case O.ROCK: return rockSprite(v, z === Z.FOREST || z === Z.SWAMP ? 1 : 0);
    case O.BUSH: return bushSprite(v, windFrame(x, y, now));
    case O.TALLGRASS: return grassSprite(v, windFrame(x, y, now), z === Z.BONES || z === Z.ORCS || WORLD.ground[i] === T.DEAD ? 1 : 0);
    case O.MUSHROOM: return smallSprite('mushroom', z === Z.SWAMP || (z === Z.FOREST && h < 0.3) ? 2 + (v & 1) : v & 1);
    case O.REEDS: return smallSprite('reeds', v, windFrame(x, y, now));
    case O.STUMP: return smallSprite('stump');
    case O.LOG: return smallSprite('log', v & 1);
    case O.DEADTREE: return smallSprite('deadtree', v);
    case O.GRAVE: return smallSprite('grave', v & 1);
    case O.TENT: return smallSprite('tent');
    case O.BARREL: return smallSprite('barrel');
    case O.CRATE: return smallSprite('crate');
    case O.HAY: return smallSprite('hay');
    case O.BENCH: return smallSprite('bench');
    case O.WELL: return smallSprite('well');
    case O.STALL: return smallSprite('stall');
    case O.SPIKES: return smallSprite('spikes');
    case O.RUBBLEBIG: return smallSprite('rubblebig', v);
    case O.DUMMY: return smallSprite('dummy');
    case O.STATUE: return smallSprite('statue');
    case O.CAMPFIRE: return animSprite('campfire', Math.floor(now / 120 + x) % 4);
    case O.TORCH: return animSprite('torch', Math.floor(now / 140 + x + y) % 4);
    case O.BRAZIER: return animSprite('brazier', Math.floor(now / 130 + x) % 4);
    case O.LAMP: return animSprite('lamp', 0);
    case O.BANNER: return animSprite('banner', Math.floor(now / 260 + x) % 4);
    case O.FOUNTAIN: return animSprite('fountain', Math.floor(now / 160) % 4);
    case O.FENCE: { const isF = j => WORLD.obj[j] === O.FENCE || WORLD.obj[j] === O.TORCH; return fenceSprite(isF(i - 1) || isF(i + 1)); }
    case O.WALL: return wallSprite(v, false, h < 0.35);
    case O.LOWWALL: return wallSprite(v, true, false);
    case O.GATE: return gateSprite();
    case O.STAIRS: return stairsSprite(WORLD.stair[i]);
  }
  return null;
}
function objLight(o, sx, sy, x, y) {
  if (o === O.TORCH) G.lights.push({ x: sx, y: sy - 24, r: 40, c: '255,170,80', a: 0.9, flick: 1 });
  else if (o === O.LAMP) G.lights.push({ x: sx + 6, y: sy - 32, r: 48, c: '255,215,140', a: 1, flick: 1 });
  else if (o === O.BRAZIER) G.lights.push({ x: sx, y: sy - 18, r: 46, c: '255,160,70', a: 1, flick: 1 });
  else if (o === O.CAMPFIRE) { G.lights.push({ x: sx, y: sy - 6, r: 50, c: '255,150,60', a: 1, flick: 1 }); if (Math.random() < 0.06) spawnPart('smoke', sx - G.view.ox, sy - G.view.oy - 12); if (Math.random() < 0.08) spawnPart('ember', sx - G.view.ox, sy - G.view.oy - 6); }
  else if (o === O.MUSHROOM) { const z = zoneAt(x, y); if (z === Z.SWAMP || (z === Z.FOREST && hash2(x, y, 17) < 0.3)) G.lights.push({ x: sx, y: sy - 3, r: 14, c: '90,200,240', a: 0.55 }); }
}

// ---------- cena completa ----------
function renderWorld(now, cam, W, H) {
  const dt = Math.min(50, now - lastFrameT); lastFrameT = now;
  const lw = Math.ceil(W / SCALE) + 1, lh = Math.ceil(H / SCALE) + 1;
  if (low.width !== lw || low.height !== lh) { low.width = lw; low.height = lh; lightC.width = lw; lightC.height = lh; waterPat1 = null; }
  LW = lw; LH = lh;
  const ctx = lctx;
  ctx.imageSmoothingEnabled = false;
  const c = iso(cam.x, cam.y);
  let shx = 0, shy = 0;
  if (G.shake > 0.2) { shx = Math.round((Math.random() - 0.5) * G.shake); shy = Math.round((Math.random() - 0.5) * G.shake); G.shake *= 0.86; }
  const ox = Math.round(lw / 2 - c.sx) + shx, oy = Math.round(lh / 2 - c.sy + 14 + (cam.z ? FLOOR_H : 0)) + shy;
  G.view = { ox, oy };
  G.lights = [];
  const day = dayInfo();

  const corners = [unIso(-ox, -oy - 40), unIso(lw - ox, -oy - 40), unIso(-ox, lh - oy + 80), unIso(lw - ox, lh - oy + 80)];
  const minX = Math.max(0, Math.floor(Math.min(...corners.map(q => q.x))) - 2), maxX = Math.min(MAP_W - 1, Math.ceil(Math.max(...corners.map(q => q.x))) + 2);
  const minY = Math.max(0, Math.floor(Math.min(...corners.map(q => q.y))) - 2), maxY = Math.min(MAP_H - 1, Math.ceil(Math.max(...corners.map(q => q.y))) + 2);

  // 1) água animada + chunks do chão
  drawWater(ctx, ox, oy, lw, lh, now);
  drawRiverFlow(ctx, ox, oy, minX, maxX, minY, maxY, now);
  let budget = 2;
  const cx0 = Math.floor(-ox / CHUNK), cx1 = Math.floor((lw - ox) / CHUNK), cy0 = Math.floor(-oy / CHUNK), cy1 = Math.floor((lh - oy) / CHUNK);
  for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
    const k = chunkKey(cx, cy);
    let ch = chunks.get(k);
    if (!ch) { if (budget-- <= 0 && G.started) continue; ch = buildChunk(cx, cy); chunks.set(k, ch); }
    ctx.drawImage(ch, cx * CHUNK + ox, cy * CHUNK + oy);
  }
  if (budget > 0) { // pré-carrega chunks vizinhos aos poucos
    outer: for (let cy = cy0 - 1; cy <= cy1 + 1; cy++) for (let cx = cx0 - 1; cx <= cx1 + 1; cx++) { const k = chunkKey(cx, cy); if (!chunks.has(k)) { chunks.set(k, buildChunk(cx, cy)); break outer; } }
  }

  // 2) marcadores no chão
  const me = G.me;
  const hideUpper = me && me.z === 0 && covered(me.rx, me.ry);
  const myZ = me && me.z ? FLOOR_H : 0;
  if (G.hover && inBounds(G.hover.x, G.hover.y)) { const p = iso(G.hover.x, G.hover.y); diamondOutline(ctx, p.sx + ox, p.sy + oy - myZ, 'rgba(255,240,200,0.45)'); }
  const tgt = G.target && G.monsters[G.target];
  if (tgt) { const p = iso(tgt.rx, tgt.ry); targetRing(ctx, p.sx + ox, p.sy + oy, now); }
  if (G.pathGoal) { const p = iso(G.pathGoal.x, G.pathGoal.y); diamondOutline(ctx, p.sx + ox, p.sy + oy - myZ, `rgba(240,200,80,${0.5 + Math.sin(now / 200) * 0.3})`); }
  for (const id in G.players) { const e = G.players[id]; if (e.cast && e.cast.end > now && e.visible) { const p = iso(e.rx, e.ry); drawMagicCircle(ctx, p.sx + ox, p.sy + oy - (e.z ? FLOOR_H : 0), now, e.cast.el, (now - e.cast.start) / (e.cast.end - e.cast.start)); } }

  // 3) objetos + personagens: andar 0 e depois andar 1
  const items = [], upper = [], visTrees = [], visFlowers = [], visGrass = [];
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
    const i = y * MAP_W + x, o = WORLD.obj[i], g = WORLD.ground[i];
    const wx = (x - y) * 16, wy = (x + y) * 8, sx = wx + ox, sy = wy + oy;
    if (sx < -60 || sx > lw + 60 || sy < -20 || sy > lh + 90) continue;
    if (g === T.CLIFF) items.push({ d: x + y, k: 0, cliff: true, x, y, sx, sy, o });
    else if (o !== O.NONE && !FLAT.has(o) && o !== O.PART) {
      items.push({ d: x + y, k: 0, x, y, o, sx, sy });
      if (o === O.TREE || o === O.PINE) visTrees.push({ wx, wy });
    }
    if (o === O.FLOWER || o === O.FLOWERBED) visFlowers.push({ wx, wy });
    if ((g === T.GRASS || g === T.FOREST || g === T.SWAMP) && hash2(x, y, 5) < 0.25) visGrass.push({ wx, wy });
    if (WORLD.fl1[i] === 2 && !hideUpper) upper.push({ d: x + y, k: 5, x, y, sx, sy });
  }
  const addEnt = (e, kind) => {
    if (!e.visible) return;
    const p = iso(e.rx, e.ry), sx = p.sx + ox, sy = p.sy + oy - (e.z ? FLOOR_H : 0);
    if (sx < -40 || sx > lw + 40 || sy < -10 || sy > lh + 70) return;
    const it = { d: e.rx + e.ry, k: kind, e, sx, sy, tx: e.rx, ty: e.ry };
    if (e.z === 1) { if (!hideUpper) upper.push(it); } else items.push(it);
  };
  for (const id in G.monsters) addEnt(G.monsters[id], 1);
  for (const n of NPCS) addEnt(G.npcs[n.id], 3);
  for (const id in G.players) { const e = G.players[id]; if (!e.carriedBy) addEnt(e, 2); }
  BUILDINGS.forEach(b => {
    const D = b.x + b.w - 1 + b.y + b.h - 1, p = iso(b.x - 0.5, b.y - 0.5);
    items.push({ d: D, k: 4, b, sx: p.sx + ox, sy: p.sy + oy });
    for (const it of items) {
      if (it.k === 4) continue;
      const ix = it.k === 0 ? it.x : it.tx, iy = it.k === 0 ? it.y : it.ty;
      if (ix < b.x - 5 || iy < b.y - 5 || ix > b.x + b.w + 0.6 || iy > b.y + b.h + 0.6) continue;
      const behind = ix < b.x + b.w - 0.5 && iy < b.y + b.h - 0.5;
      it.d = behind ? Math.min(it.d, D - 0.5) : Math.max(it.d, D + 0.5);
    }
  });
  items.sort((a, b) => a.d - b.d || a.k - b.k);
  upper.sort((a, b) => a.d - b.d || a.k - b.k);

  const labels = [];
  // objetos na frente do herói ficam semitransparentes (para ele não sumir atrás de árvores/muros)
  let meX = -999, meY = -999, meD = 1e9;
  if (me && me.z === 0) { const p = iso(me.rx, me.ry); meX = p.sx + ox; meY = p.sy + oy - 14; meD = me.rx + me.ry; }
  const fadeBlit = (s, x, y, d) => {
    const l = Math.round(x) - s.ax, t = Math.round(y) - s.ay;
    const hide = d > meD && meX > l + 2 && meX < l + s.w - 2 && meY > t && meY < t + s.h - 4 && y > meY + 8;
    if (hide) ctx.globalAlpha = 0.45;
    blit(ctx, s, x, y);
    if (hide) ctx.globalAlpha = 1;
  };
  const drawItem = it => {
    if (it.k === 0) {
      if (it.cliff) {
        const i = it.y * MAP_W + it.x, h = WORLD.height[i] || 1;
        fadeBlit(cliffSprite(h, Math.floor(hash2(it.x, it.y, 3) * 4), h >= 4 ? 1 : 0), it.sx, it.sy, it.d);
        if (it.o === O.WATERFALL) {
          blit(ctx, waterfallSprite(h, Math.floor(now / 90) % 4), it.sx, it.sy);
          if (Math.random() < 0.35) spawnPart('mist', it.sx - ox + (Math.random() - 0.5) * 24, it.sy - oy + 8);
        }
        return;
      }
      if (it.o === O.TOWER) { const p = iso(it.x - 0.5, it.y - 0.5); fadeBlit(towerSprite(Math.floor(hash2(it.x, it.y, 2) * 3)), p.sx + ox, p.sy + oy, it.d); return; }
      const s = objSprite(it.o, it.x, it.y, now);
      if (s) fadeBlit(s, it.sx, it.sy, it.d);
      objLight(it.o, it.sx, it.sy, it.x, it.y);
      return;
    }
    if (it.k === 4) {
      fadeBlit(buildingSprite(it.b, day.night), it.sx, it.sy, it.d);
      if (it.b.name) { const top = iso(it.b.x + it.b.w / 2 - 0.5, it.b.y + it.b.h / 2 - 0.5); labels.push({ sx: top.sx + ox, sy: top.sy + oy - it.b.wall - it.b.roof - (it.b.kind === 'temple' ? 38 : 8), title: it.b.name }); }
      if (day.night) for (const [wx, wy, wz] of buildingWindows(it.b)) { const p = iso(wx, wy); G.lights.push({ x: p.sx + ox, y: p.sy + oy - wz + 4, r: 26, c: it.b.kind === 'temple' ? '190,210,255' : '255,190,100', a: 0.8 }); }
      if ((it.b.kind === 'tavern' || it.b.kind === 'house') && Math.random() < (it.b.kind === 'tavern' ? 0.1 : 0.04)) { const p = iso(it.b.x - 0.5 + it.b.w * 0.3, it.b.y - 0.5 + it.b.h * 0.35); spawnPart('smoke', p.sx, p.sy - it.b.wall - it.b.roof * 0.75 - 12); }
      return;
    }
    if (it.k === 5) { blit(ctx, slabSprite(Math.floor(hash2(it.x, it.y, 4) * 3)), it.sx, it.sy - FLOOR_H); return; }
    const e = it.e;
    if (it.k === 1) {
      drawMonsterEntity(ctx, e, it.sx, it.sy, now);
      if (!e.dieAt) labels.push({ sx: it.sx, sy: it.sy - monSprite(e.type, 0, -1).ay - 2, name: MON[e.type].name, color: e.id === G.target ? '#f0a8a0' : '#ece4d4', hp: e.hp / e.maxHp, e });
    } else if (it.k === 3) {
      drawHeroEntity(ctx, e, it.sx, it.sy, now);
      labels.push({ sx: it.sx, sy: it.sy - 44, name: e.name, color: '#a8e0a0', npc: e, e });
    } else {
      drawAuras(ctx, e, it.sx, it.sy, now);
      drawHeroEntity(ctx, e, it.sx, it.sy, now);
      heroExtras(e, it.sx, it.sy);
      if (e.carrying && G.players[e.carrying]) drawCarried(ctx, G.players[e.carrying], it.sx, it.sy);
      G.lights.push({ x: it.sx, y: it.sy - 14, r: 34, c: '255,240,220', a: 0.4 });
      labels.push({ sx: it.sx, sy: it.sy - (e.downed && !e.carriedBy ? 14 : 46), name: e.name, color: e.id === G.myId ? '#f4dc8a' : '#b8d0f0', hp: e.hp / e.maxHp, mp: e.id === G.myId ? e.mp / e.maxMp : null, e, player: true });
    }
  };
  for (const it of items) drawItem(it);
  for (const it of upper) drawItem(it);

  drawEffects(ctx, ox, oy, now);
  ambient(visTrees, visFlowers, visGrass, day.night);
  drawParticles(ctx, ox, oy, now, dt);

  // sombras de nuvens de dia
  if (day.dark < 0.4) {
    ctx.globalAlpha = 0.08 * (1 - day.dark / 0.4);
    ctx.fillStyle = '#0b1a2a';
    for (let k = 0; k < 4; k++) {
      const x = ((k * 411 + now * 0.006) % 1200) - 600 + c.sx + ox, y = ((k * 233 + now * 0.0025) % 700) - 350 + c.sy + oy;
      ctx.beginPath(); ctx.ellipse(x, y, 80, 30, 0, 0, 7); ctx.ellipse(x + 45, y + 10, 55, 22, 0, 0, 7); ctx.ellipse(x - 40, y + 8, 45, 20, 0, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // 4) iluminação (na resolução baixa — barato)
  if (day.dark > 0.01) {
    lightX.globalCompositeOperation = 'source-over';
    lightX.clearRect(0, 0, lw, lh);
    lightX.fillStyle = `rgba(10,12,34,${day.dark})`; lightX.fillRect(0, 0, lw, lh);
    lightX.globalCompositeOperation = 'destination-out';
    for (const L of G.lights) {
      const r = L.r * (L.flick ? 0.93 + Math.sin(now / 70 + L.x) * 0.05 : 1);
      if (L.x < -r || L.y < -r || L.x > lw + r || L.y > lh + r) continue;
      const g = lightX.createRadialGradient(L.x, L.y, 0, L.x, L.y, r);
      g.addColorStop(0, `rgba(0,0,0,${L.a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      lightX.fillStyle = g; lightX.fillRect(L.x - r, L.y - r, r * 2, r * 2);
    }
    ctx.drawImage(lightC, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    for (const L of G.lights) {
      const r = L.r * 0.7;
      if (L.x < -r || L.y < -r || L.x > lw + r || L.y > lh + r) continue;
      const g = ctx.createRadialGradient(L.x, L.y, 0, L.x, L.y, r);
      g.addColorStop(0, `rgba(${L.c},${0.2 * L.a * day.dark * 1.4})`); g.addColorStop(1, `rgba(${L.c},0)`);
      ctx.fillStyle = g; ctx.fillRect(L.x - r, L.y - r, r * 2, r * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  if (day.dusk > 0.01) { ctx.fillStyle = `rgba(255,120,40,${day.dusk * 0.1})`; ctx.fillRect(0, 0, lw, lh); }
  return labels;
}

function diamondOutline(ctx, sx, sy, color) {
  ctx.fillStyle = color;
  sx = Math.round(sx); sy = Math.round(sy);
  for (let k = 0; k <= 16; k++) { const y = k >> 1; ctx.fillRect(sx - 16 + k, sy - y, 1, 1); ctx.fillRect(sx - 16 + k, sy + y, 1, 1); ctx.fillRect(sx + 16 - k, sy - y, 1, 1); ctx.fillRect(sx + 16 - k, sy + y, 1, 1); }
}
function targetRing(ctx, sx, sy, now) {
  const r = 9 + Math.round(Math.sin(now / 150));
  ctx.fillStyle = '#e04a3a';
  for (let a = 0; a < Math.PI * 2; a += 0.12) { if (Math.floor(a / (Math.PI / 4) + now / 300) % 2) continue; ctx.fillRect(Math.round(sx + Math.cos(a) * r), Math.round(sy + Math.sin(a) * r / 2), 1, 1); }
}
function ambient(visTrees, visFlowers, visGrass, night) {
  if (G.parts.length > 280) return;
  if (visTrees.length && Math.random() < 0.05) { const t = pick(visTrees); spawnPart('leaf', t.wx + (Math.random() - 0.5) * 16, t.wy - 26); }
  let nb = 0, nf = 0;
  for (const p of G.parts) { if (p.kind === 'butterfly') nb++; else if (p.kind === 'firefly') nf++; }
  if (!night && visFlowers.length && nb < 5 && Math.random() < 0.03) { const t = pick(visFlowers); spawnPart('butterfly', t.wx, t.wy); }
  if (night && visGrass.length && nf < 26 && Math.random() < 0.25) { const t = pick(visGrass); spawnPart('firefly', t.wx + (Math.random() - 0.5) * 16, t.wy); }
}

// ---------- textos na resolução da tela (nítidos) ----------
function pxText(ctx, text, x, y, color, size, font = '"Pixelify Sans", monospace', weight = '600') {
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.textAlign = 'center';
  ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(3, size / 4); ctx.strokeStyle = 'rgba(12,8,4,0.95)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color; ctx.fillText(text, x, y);
}
function drawLabels(ctx, labels, now) {
  const S = SCALE;
  for (const l of labels) {
    const x = Math.round(l.sx * S), y = Math.round(l.sy * S);
    if (l.title) { pxText(ctx, l.title, x, y, '#f0d890', 22, '"Jacquard 24", serif', '400'); continue; }
    let yy = y;
    const e = l.e;
    if (l.hp != null && !(e && e.downed)) {
      const w = 46;
      ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillRect(x - w / 2 - 2, yy - 2, w + 4, l.mp != null ? 11 : 8);
      const fr = clamp(l.hp, 0, 1);
      ctx.fillStyle = fr > 0.6 ? '#4caf50' : fr > 0.3 ? '#d8b030' : '#d04030';
      ctx.fillRect(x - w / 2, yy, Math.round(w * fr), 4);
      if (l.mp != null) { ctx.fillStyle = '#4a74d8'; ctx.fillRect(x - w / 2, yy + 5, Math.round(w * clamp(l.mp, 0, 1)), 3); }
      yy -= 6;
    }
    pxText(ctx, l.name, x, yy, l.color, 14);
    if (l.npc && l.npc.id === 'captain' && G.me && Object.keys(G.me.quests || {}).length < MAX_ACTIVE_QUESTS) pxText(ctx, '!', x, yy - 18 + Math.round(Math.sin(now / 200) * 2), '#f0c840', 24, '"Pixelify Sans"', '700');
    else if (l.npc) pxText(ctx, '…', x, yy - 14, '#e8e0d0', 14);
    if (!e) continue;
    if (e.downed && l.player) {
      const left = Math.max(0, (e.downUntil || 0) - now);
      pxText(ctx, e.revive ? 'Reanimando...' : `Caído · ${Math.ceil(left / 1000)}s`, x, yy - 18, '#f08a7a', 13);
      if (e.revive) { const pr = clamp((now - e.revive.t0) / REVIVE_MS, 0, 1); ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillRect(x - 26, yy - 12, 52, 6); ctx.fillStyle = '#7ad87a'; ctx.fillRect(x - 25, yy - 11, Math.round(50 * pr), 4); }
    }
    if (e.cast && e.cast.end > now) {
      const pr = (now - e.cast.start) / (e.cast.end - e.cast.start), w = 54;
      ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fillRect(x - w / 2 - 1, y + 14, w + 2, 6);
      ctx.fillStyle = '#a088e8'; ctx.fillRect(x - w / 2, y + 15, Math.round(w * pr), 4);
    }
    if (e.shout && e.shoutUntil > now) {
      const t = 1 - (e.shoutUntil - now) / 1600, s = t < 0.1 ? 1 + (0.1 - t) * 5 : 1;
      ctx.save(); ctx.globalAlpha = t > 0.8 ? (1 - t) * 5 : 1;
      pxText(ctx, e.shout, x, yy - 22 - t * 8, '#f8e890', Math.round(17 * s), '"Pixelify Sans"', '700');
      ctx.restore();
    }
    if (e.say && e.sayUntil > now) {
      ctx.font = '500 14px "Pixelify Sans", monospace';
      const text = e.say, w = Math.min(260, ctx.measureText(text).width) + 16, by = yy - (e.shout && e.shoutUntil > now ? 46 : 22);
      ctx.fillStyle = '#efe4c8'; ctx.fillRect(x - w / 2, by - 21, w, 21);
      ctx.fillStyle = '#3a2814'; ctx.fillRect(x - w / 2, by - 22, w, 1); ctx.fillRect(x - w / 2, by, w, 1); ctx.fillRect(x - w / 2 - 1, by - 21, 1, 21); ctx.fillRect(x + w / 2, by - 21, 1, 21);
      ctx.fillStyle = '#efe4c8'; ctx.fillRect(x - 3, by, 6, 3); ctx.fillRect(x - 1, by + 3, 2, 2);
      ctx.fillStyle = '#2a1c0e'; ctx.textAlign = 'center'; ctx.fillText(text, x, by - 6, 250);
    }
  }
}
// números de dano saltitantes
function drawNumbers(ctx, now) {
  const S = SCALE, { ox, oy } = G.view;
  G.nums = G.nums.filter(n => now - n.t0 < 1200);
  for (const n of G.nums) {
    if (now < n.t0) continue;
    const t = (now - n.t0) / 1200;
    const bx = (n.wx + ox) * S, by = (n.wy + oy) * S;
    const arc = Math.sin(Math.min(1, t * 1.3) * Math.PI * 0.85);
    const x = bx + n.vx * t * 46, y = by - 30 - arc * 46 - t * 10;
    const pop = t < 0.12 ? 1 + (0.12 - t) * 7 : 1;
    const size = Math.round((n.big ? 28 : n.small ? 16 : 23) * pop);
    ctx.save(); ctx.globalAlpha = t > 0.75 ? (1 - t) * 4 : 1;
    if (n.crit) pxText(ctx, 'CRÍTICO!', x, y - 26 * pop, '#fff2d8', 13, '"Pixelify Sans"', '700');
    pxText(ctx, n.text, x, y, n.color, size, '"Silkscreen", "Pixelify Sans", monospace', '700');
    ctx.restore();
  }
}

// ---------- minimapa ----------
const MINI = (() => {
  const c = document.createElement('canvas'); c.width = MAP_W; c.height = MAP_H;
  const m = c.getContext('2d');
  const cols = { [T.WATER]: '#2a5a8a', [T.SAND]: '#cbb282', [T.GRASS]: '#5a8c3c', [T.FOREST]: '#3a6530', [T.STONE]: '#8a877e', [T.DIRT]: '#7d5f3e', [T.BRIDGE]: '#6f4a2a', [T.COBBLE]: '#9c978b', [T.SWAMP]: '#4a5632', [T.DEAD]: '#978a58', [T.SHALLOW]: '#6a9a9a', [T.CLIFF]: '#6b665c', [T.FLOORSTONE]: '#a39e93' };
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const i = y * MAP_W + x, o = WORLD.obj[i];
    m.fillStyle = WORLD.bld[i] >= 0 ? '#7a3a2a' : (o === O.WALL || o === O.TOWER || o === O.PART) ? '#d8d2c4' : (o === O.TREE || o === O.PINE) ? '#2a4a20' : (o === O.FENCE ? '#5a3a1e' : WORLD.ground[i] === T.CLIFF && WORLD.height[i] >= 4 ? '#e8ecef' : cols[WORLD.ground[i]]);
    m.fillRect(x, y, 1, 1);
  }
  return c;
})();
function renderMinimap(ctx, size) {
  const s = size / MAP_W / Math.SQRT2 * 1.9;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.rotate(Math.PI / 4);
  ctx.scale(s, s);
  ctx.translate(-G.me.rx, -G.me.ry);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(MINI, 0, 0);
  ctx.fillStyle = '#e04a3a';
  for (const id in G.monsters) { const e = G.monsters[id]; ctx.fillRect(e.rx - 0.7, e.ry - 0.7, 1.4, 1.4); }
  for (const id in G.players) { const e = G.players[id]; if (!e.visible) continue; ctx.fillStyle = id === G.myId ? '#ffffff' : '#6aa8f0'; ctx.fillRect(e.rx - 1.4, e.ry - 1.4, 2.8, 2.8); }
  ctx.fillStyle = '#7ad87a';
  for (const n of NPCS) ctx.fillRect(n.x - 0.8, n.y - 0.8, 1.6, 1.6);
  ctx.restore();
}
