// ============================================================
//  RENDER — mundo pintado em resolução de tela.
//  Sombras projetadas pelo sol, clima e atmosfera por região,
//  luzes à noite e correção de cor cinematográfica.
// ============================================================
let SCALE = 2;                                  // pixels de tela por unidade de arte (zoom contínuo)
const lightC = document.createElement('canvas'), lightX = lightC.getContext('2d');
const shadowC = document.createElement('canvas'), shadowX = shadowC.getContext('2d');
const holeC = document.createElement('canvas'), holeX = holeC.getContext('2d');
let lastFrameT = performance.now(), SPAWN_MUL = 1;

function wind(x, y, now) { return Math.sin(now / 1400 + x * 0.37 + y * 0.21) + Math.sin(now / 530 + x * 1.1) * 0.35; }

// ---------- dia e noite (igual para todos: usa o relógio) ----------
const DAY_CYCLE_MS = 12 * 60 * 1000;
function dayInfo() {
  const ph = (Date.now() % DAY_CYCLE_MS) / DAY_CYCLE_MS;
  const sun = Math.cos(ph * Math.PI * 2);
  const k = clamp((0.15 - sun) / 0.65, 0, 1);
  const dark = smooth(k) * 0.62;
  const dusk = Math.max(0, 1 - Math.abs(sun + 0.05) / 0.35);
  return { dark, dusk, night: dark > 0.3, phase: ph, sun };
}
// direção da sombra (o sol cruza o céu da esquerda para a direita)
function sunShadow(day) {
  const t = ((day.phase + 0.25) % 1) * 2;       // 0..1 de dia, 1..2 de noite
  // luz fixa: o sol fica sempre na mesma posição (mesma luz do cenário 3D)
  return { lx: 1.2, ly: 0.17, a: t <= 1 ? 0.44 * (1 - day.dark) : 0.12 };
}
// clima global (chuva em alguns períodos — igual para todos)
function weatherNow() {
  const t = Date.now() / 1000;
  const rain = clamp((Math.sin(t / 260) + Math.sin(t / 97) * 0.4 - 0.75) * 2.2, 0, 1);
  return { rain, wind: 0.6 + Math.sin(t / 40) * 0.4 };
}
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
  if (SPAWN_MUL !== 1) { p.x *= SPAWN_MUL; p.y *= SPAWN_MUL; }
  p.vx *= ART; p.vy *= ART;
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
    if (p.kind === 'blood' || p.kind === 'shard') p.vy += 0.00012 * ART * dt;
    const x = Math.round(p.x + ox), y = Math.round(p.y + oy);
    switch (p.kind) {
      case 'smoke': softDab(ctx, x + Math.sin(age / 500 + p.seed) * 4, y, 5 + t * 14, '#8a8a8a', 0.4 * (1 - t)); break;
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
      case 'mist': softDab(ctx, x, y, 6 + t * 12, '#eef6ff', 0.4 * (1 - t)); break;
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
function glowDot(ctx, x, y, r, inner, outer) { if (!(r > 0.05)) return; const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, inner); g.addColorStop(1, outer); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); }

function tileW1(x, y, z = 0) { const p = iso(x, y); return { x: p.sx / ART, y: p.sy / ART - z }; }
function drawEffects(ctx, ox, oy, now) {
  const l0 = G.lights.length;
  ctx.save(); ctx.scale(ART, ART); SPAWN_MUL = ART;
  drawEffects1(ctx, ox / ART, oy / ART, now);
  ctx.restore(); SPAWN_MUL = 1;
  for (let i = l0; i < G.lights.length; i++) { G.lights[i].x *= ART; G.lights[i].y *= ART; }
}
function drawEffects1(ctx, ox, oy, now) {
  const keep = [];
  for (const e of G.effects) {
    const age = now - e.t0;
    if (age < 0) { keep.push(e); continue; }
    if (age > e.dur) continue;
    keep.push(e);
    const t = age / e.dur, c = tileW1(e.x, e.y), cx = c.x + ox, cy = c.y + oy;
    switch (e.a) {
      case 'proj': {
        const a = { x: e.from.x / ART, y: e.from.y / ART }, b = tileW1(e.tx, e.ty, 12);
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
        const b = tileW1(e.x2, e.y2);
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

function drawMagicCircle(ctx, cx2, cy2, now, el, prog) {
  const l0 = G.lights.length; ctx.save(); ctx.scale(ART, ART);
  drawMagicCircle1(ctx, cx2 / ART, cy2 / ART, now, el, prog);
  ctx.restore();
  for (let i = l0; i < G.lights.length; i++) { G.lights[i].x *= ART; G.lights[i].y *= ART; }
}
function drawMagicCircle1(ctx, cx, cy, now, el, prog) {
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

const SHADOW = sprite('shadow', 16, 6, 8, 3, pc => pc.e(8, 3, 7, 2.6, px('#000000', 0, 80)), { outline: false, k: ART });
const SHADOW_BIG = sprite('shadowb', 28, 9, 14, 4, pc => pc.e(14, 4.5, 13, 4, px('#000000', 0, 80)), { outline: false, k: ART });

// ---------- desenho de entidades ----------
const DIR_VIEW = ['S', 'E', 'N', 'W']; // 0..3
function heroPoseFor(e, now) {
  const view0 = DIR_VIEW[e.dir || 0];
  const P = { view: view0 === 'W' ? 'E' : view0, walk: -1, act: null, idle: null, sit: false, carry: !!e.carrying };
  P.dir = e.dir || 0;
  if (e.walking) { P.walk = Math.floor(e.walkDist * (e.cls === 'knight' ? 8.5 : 9.5) / (e.running ? 1.45 : 1)) % 12; if (e.running) P.run = 1; }
  if (e.anim) {
    const ms = ACT_MS[e.anim.a] || 400, t = (now - e.anim.t0) / ms;
    if (t >= 0 && t < 1 && ACTS[e.anim.a]) P.act = { k: e.anim.a, f: Math.min(11, Math.floor(t * 12)) };
  }
  if (e.cast && e.cast.end > now) P.act = { k: 'cast', f: Math.floor(now / 70) % 12 };
  if (e.sit && !P.act) { P.sit = e.sit.chair ? 'c' : 'g'; P.walk = -1; return P; }
  if (!P.act && !e.walking && e.idleAnim) {
    const t = (now - e.idleAnim.t0) / e.idleAnim.dur;
    if (t < 1) {
      if (e.idleAnim.k === 'sit') P.sit = true;
      else P.idle = { k: e.idleAnim.k, f: Math.min(11, Math.floor(t * 12)) };
    }
  }
  return P;
}

function drawHeroEntity(ctx, e, sx, sy, now) {
  if (R3.ok) {
    if (e.downed && !e.carriedBy) { const s = heroSprite3D(e.cls, e.skin, e.color, { dir: e.dir || 0, walk: -1, down: true }); ctx.imageSmoothingEnabled = true; pblit(ctx, s, sx, sy); return; }
    const P = heroPoseFor(e, now);
    if (!P.act && e.hitAt && now - e.hitAt < 300) P.act = { k: 'hurt', f: Math.min(11, Math.floor((now - e.hitAt) / 300 * 12)) };
    const s = e.isNpc ? npcSprite3D(e.kind, P) : heroSprite3D(e.cls, e.skin, e.color, P);
    ctx.imageSmoothingEnabled = true;
    softDab(ctx, sx, sy, 10, '#000000', 0.35);
    const kb = knockOf(e, now); sx += kb.x * 0.6; sy += kb.y * 0.6;
    pblit(ctx, s, sx, sy);
    if (e.hitAt && now - e.hitAt < 110) pblit(ctx, whiteOf(s, 'w3|' + e.id + (e.cls || e.kind)), sx, sy, 0.65);
    return;
  }
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
  ctx.translate(Math.round(sx), Math.round(sy - 5));
  ctx.rotate(-Math.PI / 2);
  ctx.drawImage(spr.c, -spr.ax, -76);
  ctx.restore();
  if (Math.random() < 0.02) spawnPart('blood', sx - G.view.ox, sy - G.view.oy - 4);
}
function drawCarried(ctx, e, sx, sy) {
  if (R3.ok) { const s = heroSprite3D(e.cls, e.skin, e.color, { dir: 2, walk: -1, down: true }); pblit(ctx, s, sx, sy - 70); return; }
  const spr = heroSprite(e.cls, e.skin, e.color, { view: 'S', walk: -1 });
  ctx.save();
  ctx.translate(Math.round(sx + 2), Math.round(sy - 70));
  ctx.rotate(-Math.PI / 2);
  ctx.drawImage(spr.c, -spr.ax, -76);
  ctx.restore();
}
// empurrão do golpe: sai e volta em ~250 ms
function knockOf(e, now) {
  const k = e.knock; if (!k) return { x: 0, y: 0, dx: 0 };
  const t = (now - k.t0) / 260; if (t >= 1) return { x: 0, y: 0, dx: k.dx };
  const p = Math.sin(Math.min(1, t * 1.6) * Math.PI) * (1 - t * 0.3) * 9 * k.s;
  return { x: k.dx * p, y: k.dy * p, dx: k.dx };
}
// queda nos golpes fortes: tomba, fica um instante e levanta
function fallAngle(ms) {
  const t = ms / 1100; if (t >= 1) return 0;
  return (t < 0.25 ? t / 0.25 : t < 0.65 ? 1 : 1 - (t - 0.65) / 0.35) * 1.15;
}
const MON_H = { rat: 30, slime: 40, wolf: 58, spider: 52, toad: 44, goblin: 68, skeleton: 92, orc: 104, troll: 150 };
function drawMonsterEntity(ctx, e, sx, sy, now) {
  if (R3.ok) {
    let atk = -1;
    if (e.anim) { const t = (now - e.anim.t0) / ACT_MS.bite; if (t >= 0 && t < 1) atk = Math.min(7, Math.floor(t * 8)); }
    const f = e.walking ? Math.floor(e.walkDist * 4) % 8 : -1;
    const hurtF = e.hitAt && now - e.hitAt < 300 && atk < 0 && MON_LOOK[e.type] ? Math.min(11, Math.floor((now - e.hitAt) / 300 * 12)) : -1;
    const s = monSprite3D(e.type, hurtF >= 0 ? -1 : f, atk, e.dir || 0, hurtF);
    let alpha = 1, sink = 0;
    const kb = knockOf(e, now); sx += kb.x; sy += kb.y;
    if (e.dieAt && now > e.dieAt) { const t = Math.min(1, (now - e.dieAt) / 600); alpha = 1 - t; sink = t * 8; }
    ctx.imageSmoothingEnabled = true;
    softDab(ctx, sx, sy, MON[e.type].big ? 34 : 18, '#000000', 0.35 * alpha);
    const fall = e.fallAt ? fallAngle(now - e.fallAt) * (kb.dx >= 0 ? 1 : -1) : 0;
    if (fall) { ctx.save(); ctx.translate(sx, sy + sink); ctx.rotate(fall); pblit(ctx, s, 0, 0, alpha); ctx.restore(); }
    else pblit(ctx, s, sx, sy + sink, alpha);
    if (e.hitAt && now - e.hitAt < 110 && !fall) pblit(ctx, whiteOf(s, `wm|${e.type}|${f}|${atk}|${e.dir || 0}|${hurtF}`), sx, sy + sink, 0.7 * alpha);
    if (e.flags & 1 && Math.random() < 0.2) spawnPart('snow', sx - G.view.ox + (Math.random() - 0.5) * 24, sy - G.view.oy - Math.random() * 40);
    if (e.flags & 2) for (let k = 0; k < 3; k++) { const a = now / 180 + k * 2.1; dab(ctx, sx + Math.cos(a) * 12, sy - MON_H[e.type] * 0.55 - 4 + Math.sin(a) * 4, 2, 2, '#f0d040'); }
    return;
  }
  const def = MON[e.type];
  let atk = -1;
  if (e.anim) { const t = (now - e.anim.t0) / ACT_MS.bite; if (t >= 0 && t < 1) atk = Math.min(3, Math.floor(t * 4)); }
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
  if (e.flags & 1 && Math.random() < 0.2) spawnPart('snow', sx - G.view.ox + (Math.random() - 0.5) * 24, sy - G.view.oy - Math.random() * 32);
  if (e.flags & 2) for (let k = 0; k < 3; k++) { const a = now / 180 + k * 2.1; ctx.fillStyle = '#f0d040'; ctx.fillRect(Math.round(sx + Math.cos(a) * 12), Math.round(sy - spr.ay + 4 + Math.sin(a) * 4), 2, 2); }
}
function heroExtras(e, sx, sy) {
  if (e.isNpc) return;
  const L = lookFor(e.cls + ':' + e.skin + ':' + e.color, () => heroLook(e.cls, e.skin, e.color));
  if (e.cls === 'mage' && !e.downed) G.lights.push({ x: sx + (DIR_VIEW[e.dir || 0] === 'W' ? -14 : 14), y: sy - 84, r: 16, c: '150,190,255', a: 0.6 });
  if (!e.walking && Math.random() > 0.06) return;
  switch (L.extra) {
    case 'ember': spawnPart('ember', sx - G.view.ox + (Math.random() - 0.5) * 20, sy - G.view.oy - 16 - Math.random() * 30); break;
    case 'halo': spawnPart('sparkle', sx - G.view.ox + (Math.random() - 0.5) * 24, sy - G.view.oy - 24 - Math.random() * 40, { color: 'rgba(250,225,140,A)' }); break;
    case 'frost': spawnPart('snow', sx - G.view.ox + (Math.random() - 0.5) * 24, sy - G.view.oy - 60); break;
    case 'leaf': spawnPart('leaf', sx - G.view.ox + (Math.random() - 0.5) * 20, sy - G.view.oy - 60, { color: Math.random() < 0.5 ? '#7cc24a' : '#c9a24a' }); break;
  }
}
function drawAuras(ctx, e, sx2, sy2, now) {
  const l0 = G.lights.length; ctx.save(); ctx.scale(ART, ART); SPAWN_MUL = ART;
  drawAuras1(ctx, e, sx2 / ART, sy2 / ART, now);
  ctx.restore(); SPAWN_MUL = 1;
  for (let i = l0; i < G.lights.length; i++) { G.lights[i].x *= ART; G.lights[i].y *= ART; }
}
function drawAuras1(ctx, e, sx, sy, now) {
  const fl = e.flags || 0;
  if (fl & BUFF_BITS.wall) {
    const a = 0.25 + Math.sin(now / 200) * 0.08;
    ctx.strokeStyle = `rgba(240,210,110,${a + 0.3})`; ctx.fillStyle = `rgba(240,210,110,${a * 0.4})`; ctx.lineWidth = 1;
    ctx.beginPath(); for (let k = 0; k < 6; k++) { const an = k * Math.PI / 3 + now / 1000; ctx.lineTo(sx + Math.cos(an) * 13, sy - 18 + Math.sin(an) * 18); } ctx.closePath(); ctx.fill(); ctx.stroke();
    G.lights.push({ x: sx, y: sy - 14, r: 26, c: '240,210,110', a: 0.5 });
  }
  if (fl & BUFF_BITS.agile) for (let k = 0; k < 3; k++) { const an = now / 150 + k * 2.1; ctx.strokeStyle = 'rgba(120,220,170,0.7)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(sx, sy - 1 - k * 2, 8, 3, 0, an, an + 1.6); ctx.stroke(); }
  if (fl & BUFF_BITS.warcry) ring(ctx, sx, sy, 9, `rgba(230,110,90,${0.4 + Math.sin(now / 120) * 0.2})`, 1);
  if (fl & BUFF_BITS.bless && Math.random() < 0.04) spawnPart('sparkle', sx - G.view.ox / ART, sy - G.view.oy / ART - Math.random() * 36, { color: 'rgba(250,225,140,A)' });
  if (e.isNpc || e.downed) return;
  const L = lookFor(e.cls + ':' + e.skin + ':' + e.color, () => heroLook(e.cls, e.skin, e.color));
  if (L.extra === 'orbit') for (let k = 0; k < 3; k++) { const an = now / 500 + k * 2.1, x = Math.round(sx + Math.cos(an) * 10), y = Math.round(sy - 20 + Math.sin(an) * 4); ctx.fillStyle = '#d8ecff'; ctx.fillRect(x, y, 1, 1); G.lights.push({ x, y, r: 6, c: '200,225,255', a: 0.6 }); }
  if (L.extra === 'halo') { ctx.strokeStyle = 'rgba(250,225,140,0.75)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(sx, sy - 44, 5, 1.6, 0, 0, Math.PI * 2); ctx.stroke(); G.lights.push({ x: sx, y: sy - 44, r: 12, c: '250,225,140', a: 0.6 }); }
}

// ---------- objetos ----------
// ---------- objetos ----------
const TREE_TINT = { [Z.FOREST]: 3, [Z.SWAMP]: 3, [Z.WILD]: 1 };
const SWAY = { [O.TREE]: 0.035, [O.PINE]: 0.025, [O.BUSH]: 0.03, [O.TALLGRASS]: 0.09, [O.REEDS]: 0.08 };
const CASTS = new Set([O.TREE, O.PINE, O.DEADTREE, O.BUSH, O.ROCK, O.WALL, O.LOWWALL, O.STATUE, O.LAMP, O.BANNER, O.TENT, O.WELL, O.STALL, O.HAY, O.BARREL, O.CRATE, O.CART, O.GRAVE, O.DUMMY, O.WEAPONRACK, O.STUMP, O.TORCH, O.BRAZIER, O.FENCE, O.GATE]);
function objSprite(o, x, y) {
  const h = hash2(x, y, 17), v = Math.floor(h * 3), i = y * MAP_W + x, z = WORLD.zone[i];
  switch (o) {
    case O.TREE: return treeSprite(v, 1, h > 0.88 && z !== Z.FOREST ? 2 : (TREE_TINT[z] || 0));
    case O.PINE: return pineSprite(v);
    case O.ROCK: return rockSprite(v, z === Z.FOREST || z === Z.SWAMP ? 1 : 0);
    case O.BUSH: return bushSprite(v);
    case O.TALLGRASS: return grassSprite(v, 1, z === Z.BONES || z === Z.ORCS || WORLD.ground[i] === T.DEAD ? 1 : 0);
    case O.MUSHROOM: return smallSprite('mushroom', z === Z.SWAMP || (z === Z.FOREST && h < 0.3) ? 2 + (v & 1) : v & 1);
    case O.REEDS: return smallSprite('reeds', v);
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
    case O.ANVIL: return smallSprite('anvil');
    case O.WEAPONRACK: return smallSprite('weaponrack');
    case O.CART: return smallSprite('cart');
    case O.TABLE: return smallSprite('table');
    case O.CAMPFIRE: return animSprite('campfire');
    case O.TORCH: return animSprite('torch');
    case O.BRAZIER: return animSprite('brazier');
    case O.LAMP: return animSprite('lamp');
    case O.BANNER: return animSprite('banner');
    case O.FOUNTAIN: return animSprite('fountain');
    case O.FENCE: { const isF = j => WORLD.obj[j] === O.FENCE || WORLD.obj[j] === O.TORCH; return fenceSprite(isF(i - 1) || isF(i + 1)); }
    case O.WALL: { const wd = WORLD.wdir[i], ax = wd === 3 || wd === 4, isT = j => WORLD.obj[j] === O.PART || WORLD.obj[j] === O.TOWER, e = (isT(ax ? i - 1 : i - MAP_W) ? 1 : 0) | (isT(ax ? i + 1 : i + MAP_W) ? 2 : 0); return wallSprite(v, false, h < 0.35, wd, e); }
    case O.LOWWALL: return wallSprite(v, true, false);
    case O.GATE: { const gi = WORLD.gateId[i]; if (gi < 0) return gateSprite(true); return x === WORLD.gates[gi].x1 ? gateHouseSprite(gi) : null; }
    case O.STAIRS: return stairsSprite(WORLD.stair[i], WORLD.stairK[i]);
  }
  return null;
}
function drawSway(ctx, s, x, y, k, alpha) {
  if (!k) { pblit(ctx, s, x, y, alpha); return; }
  ctx.save(); ctx.translate(x, y); ctx.transform(1, 0, k, 1, 0, 0); pblit(ctx, s, 0, 0, alpha); ctx.restore();
}
// partes animadas ao vivo (fogo, bandeira, água)
function liveParts(ctx, o, sx, sy, x, y, now) {
  switch (o) {
    case O.TORCH: liveFlame(ctx, sx, sy - 36, 0.5, now, x * 3 + y); G.lights.push({ x: sx, y: sy - 40, r: 42, c: '255,170,80', a: 0.95, flick: 1 }); if (Math.random() < 0.04) spawnPart('ember', sx - G.view.ox, sy - G.view.oy - 60); break;
    case O.BRAZIER: liveFlame(ctx, sx, sy - 21, 0.6, now, x + y * 5); G.lights.push({ x: sx, y: sy - 28, r: 50, c: '255,160,70', a: 1, flick: 1 }); if (Math.random() < 0.08) spawnPart('ember', sx - G.view.ox, sy - G.view.oy - 50); break;
    case O.CAMPFIRE: liveFlame(ctx, sx, sy - 4, 0.9, now, x * 7 + y); G.lights.push({ x: sx, y: sy - 16, r: 56, c: '255,150,60', a: 1, flick: 1 }); if (Math.random() < 0.08) spawnPart('smoke', sx - G.view.ox, sy - G.view.oy - 30); if (Math.random() < 0.1) spawnPart('ember', sx - G.view.ox, sy - G.view.oy - 16); break;
    case O.LAMP: { const f = 0.85 + Math.sin(now / 90 + x) * 0.08; softDab(ctx, sx + 14, sy - 66, 10 * f, '#ffd890', 0.55); G.lights.push({ x: sx + 14, y: sy - 66, r: 50, c: '255,215,140', a: 1, flick: 1 }); break; }
    case O.BANNER: {
      const top = sy - 94, left = sx + 2, wv = now / 420 + x * 0.7;
      ctx.beginPath(); ctx.moveTo(left, top);
      for (let k = 0; k <= 8; k++) { const t = k / 8; ctx.lineTo(left + t * 28, top + Math.sin(wv + t * 3) * 2.5 * t); }
      for (let k = 8; k >= 0; k--) { const t = k / 8; ctx.lineTo(left + t * 28 - 2 * t, top + 46 + Math.sin(wv + t * 3 + 1) * 3 * t - (t > 0.5 ? (t - 0.5) * 10 : 0)); }
      ctx.closePath(); ctx.fillStyle = lgrad(ctx, left, 0, left + 28, 0, [[0, '#1e3058'], [0.5, '#2c447a'], [1, '#1a284a']]); ctx.fill();
      dab(ctx, left + 13, top + 20 + Math.sin(wv + 1.5) * 1.5, 5, 5, '#c9a24a'); dab(ctx, left + 13, top + 20 + Math.sin(wv + 1.5) * 1.5, 2.4, 2.4, '#1e3058');
      break;
    }
    case O.FOUNTAIN: {
      for (let k = 0; k < 18; k++) {
        const t = ((now / 1100) + k / 18) % 1, a = k / 18 * Math.PI * 2;
        const px_ = sx + Math.cos(a) * 26 * t, py = sy - 46 + t * 34 - Math.sin(t * Math.PI) * 14 + Math.sin(a) * 9 * t;
        dab(ctx, px_, py, 1.4, 1.4, `rgba(210,235,255,${0.85 - t * 0.5})`);
      }
      softDab(ctx, sx, sy - 44, 6, '#e8f6ff', 0.6);
      break;
    }
  }
}
function drawWaterfallLive(ctx, sx, sy, H, now) {
  const top = sy - H + 4, bot = sy + 16, t = now / 1000;
  // cortina de água com bordas irregulares (mais estreita no alto)
  ctx.save();
  ctx.beginPath();
  for (let k = 0; k <= 10; k++) { const f = k / 10, y = top + (bot - top) * f, w = 18 + f * 16 + Math.sin(t * 3 + f * 9) * 1.5; ctx.lineTo(sx - 4 - w + Math.sin(f * 5 + t) * 2, y); }
  for (let k = 10; k >= 0; k--) { const f = k / 10, y = top + (bot - top) * f, w = 18 + f * 16 + Math.sin(t * 3 + f * 9 + 2) * 1.5; ctx.lineTo(sx - 4 + w + Math.sin(f * 4 - t) * 2, y); }
  ctx.closePath(); ctx.clip();
  ctx.fillStyle = lgrad(ctx, 0, top, 0, bot, [[0, 'rgba(170,215,240,0.95)'], [0.5, 'rgba(110,170,215,0.92)'], [1, 'rgba(225,242,255,0.97)']]);
  ctx.fillRect(sx - 60, top - 4, 120, bot - top + 8);
  for (let k = 0; k < 34; k++) {
    const xx = sx - 4 + (hash2(k, 3, 5) - 0.5) * 66, sp = 0.7 + hash2(k, 4, 5) * 0.6, ph = (t * 1.4 * sp + hash2(k, 5, 5)) % 1;
    const y1 = top + ph * (bot - top + 30) - 24, y2 = y1 + 10 + hash2(k, 6, 5) * 16;
    ctx.strokeStyle = 'rgba(255,255,255,' + (0.3 + hash2(k, 7, 5) * 0.45) + ')'; ctx.lineWidth = 0.8 + hash2(k, 8, 5) * 1.8;
    ctx.beginPath(); ctx.moveTo(xx, y1); ctx.lineTo(xx + Math.sin(ph * 3) * 1.5, y2); ctx.stroke();
  }
  ctx.restore();
  // espuma e névoa na base
  for (let k = 0; k < 10; k++) { const f = (t * 0.8 + k / 10) % 1; softDab(ctx, sx - 4 + (hash2(k, 9, 3) - 0.5) * 70, bot - 2 - f * 10, 8 + f * 12, '#f4fbff', 0.6 * (1 - f)); }
  softDab(ctx, sx - 4, top + 2, 14, '#e8f6ff', 0.35);
}

// ---------- sombras projetadas ----------
function castShadow(s, x, y, sh, k) {
  const sil = silhouette(s);
  shadowX.setTransform(k, 0, -sh.lx * k, -sh.ly * k, x * k, y * k);
  shadowX.drawImage(sil.c, -sil.ax, -sil.ay, sil.w, sil.h);
}

// ---------- atmosfera por região ----------
const ZATM = {
  [Z.VILLAGE]: { tint: [255, 196, 120], ta: 0.2, fog: 0.05, fogC: [240, 200, 150], rays: 0.35, crows: 0, embers: 0, dust: 0, snow: 0, rainBias: 0 },
  [Z.FIELDS]: { tint: [255, 230, 170], ta: 0.08, fog: 0.04, fogC: [230, 235, 225], rays: 0.2, crows: 0, embers: 0, dust: 0, snow: 0, rainBias: 0 },
  [Z.FOREST]: { tint: [120, 170, 160], ta: 0.16, fog: 0.16, fogC: [170, 200, 185], rays: 1, crows: 0, embers: 0, dust: 0, snow: 0, rainBias: 0 },
  [Z.SWAMP]: { tint: [130, 160, 100], ta: 0.22, fog: 0.42, fogC: [140, 165, 135], rays: 0, crows: 0.2, embers: 0, dust: 0, snow: 0, rainBias: 0.45 },
  [Z.BONES]: { tint: [140, 140, 155], ta: 0.3, fog: 0.3, fogC: [160, 160, 170], rays: 0, crows: 1, embers: 0, dust: 1, snow: 0, rainBias: 0.1 },
  [Z.ORCS]: { tint: [235, 150, 80], ta: 0.18, fog: 0.16, fogC: [150, 115, 90], rays: 0, crows: 0.3, embers: 1, dust: 0.5, snow: 0, rainBias: 0 },
  [Z.WILD]: { tint: [170, 200, 235], ta: 0.14, fog: 0.14, fogC: [215, 225, 235], rays: 0.2, crows: 0.2, embers: 0, dust: 0, snow: 0, rainBias: 0.1 },
};
const ATM = { tint: [255, 214, 150], ta: 0.1, fog: 0, fogC: [230, 220, 200], rays: 0, crows: 0, embers: 0, dust: 0, snow: 0, rain: 0 };
function updateAtmosphere(px_, py, dt) {
  const z = zoneAt(px_, py), tgt = ZATM[z] || ZATM[Z.FIELDS];
  const nearMountain = dist(px_, py, MOUNTAIN.x, MOUNTAIN.y) < MOUNTAIN.r + 10 ? 1 : 0;
  const w = weatherNow();
  const k = Math.min(1, dt * 0.0012);
  for (const key of ['ta', 'fog', 'rays', 'crows', 'embers', 'dust']) ATM[key] += (tgt[key] - ATM[key]) * k;
  for (let i = 0; i < 3; i++) { ATM.tint[i] += (tgt.tint[i] - ATM.tint[i]) * k; ATM.fogC[i] += (tgt.fogC[i] - ATM.fogC[i]) * k; }
  ATM.snow += (nearMountain - ATM.snow) * k;
  ATM.rain += (clamp(w.rain + tgt.rainBias * (w.rain > 0 ? 1 : 0.35), 0, 1) * (nearMountain ? 0.3 : 1) - ATM.rain) * k;
  ATM.wind = w.wind;
}
const FOG_TEX = (() => {
  const S = 256, c = document.createElement('canvas'); c.width = S; c.height = S;
  const x = c.getContext('2d'), R = rng(99);
  for (let i = 0; i < 70; i++) { const px_ = R() * S, py = R() * S, r = 20 + R() * 60; for (const [ox, oy] of [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S]]) softDab(x, px_ + ox, py + oy, r, '#ffffff', 0.18 + R() * 0.2); }
  return c;
})();
let fogPat = null;
function drawAtmosphere(ctx, W, H, now, day, cam) {
  const t = now / 1000;
  // névoa (duas camadas com movimento lento, presa ao mundo)
  if (ATM.fog > 0.01) {
    if (!fogPat) fogPat = ctx.createPattern(FOG_TEX, 'repeat');
    const c = iso(cam.x, cam.y);
    ctx.save();
    for (let l = 0; l < 2; l++) {
      const sp = l ? 9 : 5, sc = l ? 1.6 : 2.4;
      ctx.setTransform(sc, 0, 0, sc * 0.7, -((c.sx * SCALE * (l ? 0.9 : 0.75) + t * sp * 6) % (256 * sc)), -((c.sy * SCALE * (l ? 0.9 : 0.75) + t * sp) % (256 * sc * 0.7)));
      ctx.globalAlpha = ATM.fog * (l ? 0.7 : 0.9);
      ctx.fillStyle = fogPat; ctx.fillRect(0, 0, W / sc + 512, H / (sc * 0.7) + 512);
    }
    ctx.restore();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = `rgba(${ATM.fogC.map(Math.round).join(',')},${ATM.fog * 0.6})`; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
  }
  // raios de sol entre as árvores (de dia)
  if (ATM.rays > 0.05 && !day.night) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 5; k++) {
      const x = ((k * 397 + t * 8) % (W + 400)) - 200, w2 = 60 + hash2(k, 1, 2) * 90, a = ATM.rays * (0.05 + Math.sin(t * 0.4 + k) * 0.03) * (1 - day.dark);
      if (a <= 0) continue;
      const g = ctx.createLinearGradient(x, 0, x + H * 0.45, H); g.addColorStop(0, `rgba(255,240,190,${a})`); g.addColorStop(1, 'rgba(255,240,190,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + w2, 0); ctx.lineTo(x + w2 + H * 0.45, H); ctx.lineTo(x + H * 0.45, H); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  // chuva
  if (ATM.rain > 0.02) {
    const n = Math.floor(320 * ATM.rain), wx = 2.2 + ATM.wind * 2;
    ctx.strokeStyle = `rgba(190,205,225,${0.25 + ATM.rain * 0.3})`; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = 0; k < n; k++) {
      const sp = 0.8 + hash2(k, 1, 7) * 0.5, x = (hash2(k, 2, 7) * (W + 200) + t * 120 * wx * sp) % (W + 200) - 100, y = (hash2(k, 3, 7) * (H + 100) + t * 900 * sp) % (H + 100) - 50;
      ctx.moveTo(x, y); ctx.lineTo(x - wx * 5, y - 18 * sp);
    }
    ctx.stroke();
    ctx.fillStyle = `rgba(210,225,240,${0.3 * ATM.rain})`;
    for (let k = 0; k < n / 4; k++) { const ph = (t * 3 + hash2(k, 4, 8)) % 1, x = hash2(k, 5, 8 + Math.floor(t * 3 + hash2(k, 4, 8))) * W, y = hash2(k, 6, 8 + Math.floor(t * 3 + hash2(k, 4, 8))) * H; ctx.beginPath(); ctx.ellipse(x, y, 2 + ph * 5, (2 + ph * 5) * 0.4, 0, 0, 7); ctx.fill(); }
    ctx.fillStyle = `rgba(20,28,40,${0.18 * ATM.rain})`; ctx.fillRect(0, 0, W, H);
    if (ATM.rain > 0.75 && (Math.floor(t / 7) % 5 === 0) && (t % 7) < 0.15) { ctx.fillStyle = 'rgba(230,235,255,0.35)'; ctx.fillRect(0, 0, W, H); }
  }
  // neve perto da montanha
  if (ATM.snow > 0.02) {
    ctx.fillStyle = `rgba(245,250,255,${0.8 * ATM.snow})`;
    for (let k = 0; k < 160 * ATM.snow; k++) { const sp = 0.5 + hash2(k, 1, 9) * 0.7, x = (hash2(k, 2, 9) * W + t * 30 * ATM.wind * sp + Math.sin(t + k) * 12) % W, y = (hash2(k, 3, 9) * H + t * 50 * sp) % H, r = 1 + sp * 1.6; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); }
  }
  // poeira (colinas)
  if (ATM.dust > 0.05) {
    ctx.fillStyle = `rgba(200,190,160,${0.35 * ATM.dust})`;
    for (let k = 0; k < 60; k++) { const x = (hash2(k, 2, 11) * W + t * 60 * (0.5 + hash2(k, 1, 11))) % W, y = (hash2(k, 3, 11) * H + Math.sin(t + k) * 20) % H; ctx.fillRect(x, y, 2, 1); }
  }
  // brasas (acampamento orc)
  if (ATM.embers > 0.05) {
    for (let k = 0; k < 45; k++) { const ph = (t * (0.08 + hash2(k, 1, 12) * 0.08) + hash2(k, 2, 12)) % 1, x = hash2(k, 3, 12) * W + Math.sin(t * 2 + k) * 14, y = H * (1 - ph); ctx.fillStyle = `rgba(255,${140 + (k % 5) * 20},60,${ATM.embers * Math.sin(ph * Math.PI) * 0.8})`; ctx.fillRect(x, y, 2, 2); }
  }
  // corvos
  if (ATM.crows > 0.1) {
    ctx.strokeStyle = `rgba(20,18,20,${0.8 * ATM.crows})`; ctx.lineWidth = 1.6;
    for (let k = 0; k < 4; k++) {
      const ph = (t * 0.035 + hash2(k, 1, 13)) % 1, x = -60 + ph * (W + 120), y = H * (0.15 + hash2(k, 2, 13) * 0.35) + Math.sin(t * 0.8 + k) * 20, f = Math.sin(t * 9 + k * 2) * 5;
      ctx.beginPath(); ctx.moveTo(x - 9, y - f); ctx.quadraticCurveTo(x - 4, y - 3, x, y); ctx.quadraticCurveTo(x + 4, y - 3, x + 9, y - f); ctx.stroke();
    }
  }
}

// ---------- cena completa ----------
function renderWorld(ctx, now, cam, W, H, dpr) {
  const dt = Math.min(50, now - lastFrameT); lastFrameT = now;
  const k = dpr * SCALE, vw = W / SCALE, vh = H / SCALE;
  const c = iso(cam.x, cam.y);
  let shx = 0, shy = 0;
  if (G.shake > 0.2) { shx = (Math.random() - 0.5) * G.shake; shy = (Math.random() - 0.5) * G.shake; G.shake *= 0.86; }
  if (holeC.width !== Math.round(W * dpr) || holeC.height !== Math.round(H * dpr)) { holeC.width = Math.round(W * dpr); holeC.height = Math.round(H * dpr); }
  const ox = vw / 2 - c.sx + shx, oy = vh / 2 - c.sy + 30 + (cam.z || 0) * FLOOR_PX + shy;
  G.view = { ox, oy };
  G.lights = [];
  const day = dayInfo(), sh = sunShadow(day);
  updateAtmosphere(cam.x, cam.y, dt);

  ctx.setTransform(k, 0, 0, k, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const corners = [unIso(-ox, -oy - 140), unIso(vw - ox, -oy - 140), unIso(-ox, vh - oy + 260), unIso(vw - ox, vh - oy + 260)];
  const minX = Math.max(0, Math.floor(Math.min(...corners.map(q => q.x))) - 2), maxX = Math.min(MAP_W - 1, Math.ceil(Math.max(...corners.map(q => q.x))) + 2);
  const minY = Math.max(0, Math.floor(Math.min(...corners.map(q => q.y))) - 2), maxY = Math.min(MAP_H - 1, Math.ceil(Math.max(...corners.map(q => q.y))) + 2);

  // 1) água + detalhes
  drawWater(ctx, { x0: 0, y0: 0, x1: vw, y1: vh }, now, day);
  ctx.save(); ctx.translate(ox, oy); drawWaterDetail(ctx, minX, maxX, minY, maxY, now, day); ctx.restore();
  // 2) chão pintado
  let budget = G.started ? 2 : 6;
  const cx0 = Math.floor(-ox / CHUNK), cx1 = Math.floor((vw - ox) / CHUNK), cy0 = Math.floor(-oy / CHUNK), cy1 = Math.floor((vh - oy) / CHUNK);
  for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
    const key = chunkKey(cx, cy);
    let ch = chunks.get(key);
    if (!ch) { if (budget-- <= 0) continue; ch = buildChunk(cx, cy); chunks.set(key, ch); }
    ctx.drawImage(ch, cx * CHUNK + ox - 0.3, cy * CHUNK + oy - 0.3, CHUNK + 0.6, CHUNK + 0.6);
  }
  if (budget > 0) { outer: for (let cy = cy0 - 1; cy <= cy1 + 1; cy++) for (let cx = cx0 - 1; cx <= cx1 + 1; cx++) { const key = chunkKey(cx, cy); if (!chunks.has(key)) { chunks.set(key, buildChunk(cx, cy)); break outer; } } }

  // 3) marcadores
  const me = G.me;
  const hideUpper = me && me.z < 0.5 && covered(me.rx, me.ry);
  const myZ = me ? (me.z || 0) * FLOOR_PX : 0;
  if (G.hover && inBounds(G.hover.x, G.hover.y)) { const p = iso(G.hover.x, G.hover.y); diamondOutline(ctx, p.sx + ox, p.sy + oy - myZ, 'rgba(255,240,200,0.35)'); }
  const tgt = G.target && G.monsters[G.target];
  if (tgt) { const p = iso(tgt.rx, tgt.ry); targetRing(ctx, p.sx + ox, p.sy + oy, now); }
  if (G.pathGoal) { const p = iso(G.pathGoal.x, G.pathGoal.y); diamondOutline(ctx, p.sx + ox, p.sy + oy - myZ, `rgba(240,200,80,${0.45 + Math.sin(now / 200) * 0.3})`); }
  for (const id in G.players) { const e = G.players[id]; if (e.cast && e.cast.end > now && e.visible) { const p = iso(e.rx, e.ry); drawMagicCircle(ctx, p.sx + ox, p.sy + oy - (e.z || 0) * FLOOR_PX, now, e.cast.el, (now - e.cast.start) / (e.cast.end - e.cast.start)); } }

  // 4) coleta dos itens
  const items = [], upper = [], visTrees = [], visFlowers = [], visGrass = [];
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
    const i = y * MAP_W + x, o = WORLD.obj[i], g = WORLD.ground[i];
    const wx = (x - y) * HTW, wy = (x + y) * HTH, sx = wx + ox, sy = wy + oy;
    if (sx < -140 || sx > vw + 140 || sy < -60 || sy > vh + 300) continue;
    if (g === T.CLIFF) items.push({ d: x + y, k: 0, cliff: true, x, y, sx, sy, o });
    else if (o !== O.NONE && !FLAT.has(o) && o !== O.PART) { items.push({ d: x + y, k: 0, x, y, o, sx, sy }); if (o === O.TREE || o === O.PINE) visTrees.push({ wx, wy }); }
    if (o === O.FLOWER || o === O.FLOWERBED) visFlowers.push({ wx, wy });
    if ((g === T.GRASS || g === T.FOREST || g === T.SWAMP) && hash2(x, y, 5) < 0.25) visGrass.push({ wx, wy });
    if (WORLD.fl1[i] === 2 && !hideUpper) upper.push({ d: x + y, k: 5, x, y, sx, sy });
  }
  const addEnt = (e, kind) => {
    if (!e.visible) return;
    const p = iso(e.rx, e.ry), sx = p.sx + ox, sy = p.sy + oy - (e.z || 0) * FLOOR_PX;
    if (sx < -100 || sx > vw + 100 || sy < -40 || sy > vh + 200) return;
    const it = { d: e.rx + e.ry, k: kind, e, sx, sy, tx: e.rx, ty: e.ry };
    if ((e.z || 0) >= 0.5) { if (!hideUpper) upper.push(it); } else items.push(it);
  };
  for (const id in G.monsters) addEnt(G.monsters[id], 1);
  for (const n of NPCS) addEnt(G.npcs[n.id], 3);
  for (const id in G.players) { const e = G.players[id]; if (!e.carriedBy) addEnt(e, 2); }
  const inB = me && (me.z || 0) < 0.5 ? bldAt(me.rx, me.ry) : -1;
  G.bA = G.bA || {};
  BUILDINGS.forEach((b, bi) => {
    const D = b.x + b.w - 1 + b.y + b.h - 1, p = iso(b.x - 0.5, b.y - 0.5);
    if (p.sx + ox < -900 || p.sx + ox > vw + 900 || p.sy + oy < -900 || p.sy + oy > vh + 600) return;
    let a = G.bA[bi] ?? 1; const tg = bi === inB ? 0 : 1; a += (tg - a) * Math.min(1, dt / 110); if (Math.abs(a - tg) < 0.03) a = tg; G.bA[bi] = a;
    if (a < 1) items.push({ d: D - 0.02, k: 6, b, sx: p.sx + ox, sy: p.sy + oy });
    if (a > 0) items.push({ d: D, k: 4, b, bi, a, sx: p.sx + ox, sy: p.sy + oy });
    for (const it of items) {
      if (it.k === 4 || it.k === 6) continue;
      const ix = it.k === 0 ? it.x : it.tx, iy = it.k === 0 ? it.y : it.ty;
      if (ix < b.x - 5 || iy < b.y - 5 || ix > b.x + b.w + 2.5 || iy > b.y + b.h + 2.5) continue;
      const behind = ix < b.x + b.w - 0.5 && iy < b.y + b.h - 0.5;
      const inside = ix > b.x - 0.5 && ix < b.x + b.w - 0.5 && iy > b.y - 0.5 && iy < b.y + b.h - 0.5;
      if (a < 1 && inside) it.d = D + 0.01 + (ix + iy - b.x - b.y) * 0.001;   // dentro da construção aberta: depois do piso
      else it.d = behind ? Math.min(it.d, D - 0.5) : Math.max(it.d, D + 0.5);
    }
  });
  items.sort((a, b) => a.d - b.d || a.k - b.k);
  upper.sort((a, b) => a.d - b.d || a.k - b.k);

  // 5) sombras projetadas (todas numa camada, depois aplicadas de uma vez)
  if (shadowC.width !== Math.round(W * dpr) || shadowC.height !== Math.round(H * dpr)) { shadowC.width = Math.round(W * dpr); shadowC.height = Math.round(H * dpr); }
  shadowX.setTransform(1, 0, 0, 1, 0, 0); shadowX.clearRect(0, 0, shadowC.width, shadowC.height);
  const shAlpha = sh.a * (1 - ATM.rain * 0.6) * (1 - ATM.fog * 0.6);
  if (shAlpha > 0.02) {
    for (const it of items) {
      if (it.k === 0 && !it.cliff && CASTS.has(it.o)) { const s = objSprite(it.o, it.x, it.y); if (s) castShadow(s, it.sx, it.sy, sh, k); }
      else if (it.k === 0 && it.o === O.TOWER) { const p = iso(it.x - 0.5, it.y - 0.5); castShadow(towerSprite(WORLD.tvar[it.y * MAP_W + it.x], WORLD.toff[it.y * MAP_W + it.x]), p.sx + ox, p.sy + oy, sh, k); }
      else if (it.k === 4) castShadow(buildingSprite(it.b, day.night), it.sx, it.sy, sh, k);
      else if (it.k === 1 && !it.e.dieAt) castShadow(R3.ok ? monSprite3D(it.e.type, -1, -1, 0) : monSprite(it.e.type, 0, -1), it.sx, it.sy, sh, k);
      else if ((it.k === 2 || it.k === 3) && !it.e.downed) castShadow(R3.ok ? (it.e.isNpc ? npcSprite3D(it.e.kind, { dir: 0, walk: -1 }) : heroSprite3D(it.e.cls, it.e.skin, it.e.color, { dir: 0, walk: -1 })) : (it.e.isNpc ? npcSprite(it.e.kind, { view: 'S', walk: -1 }) : heroSprite(it.e.cls, it.e.skin, it.e.color, { view: 'S', walk: -1 })), it.sx, it.sy, sh, k);
    }
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = shAlpha; ctx.drawImage(shadowC, 0, 0); ctx.restore();
  }

  // 6) desenho em ordem de profundidade
  const labels = [];
  let meX = -999, meY = -999, meD = 1e9;
  if (me && (me.z || 0) < 0.5) { const p = iso(me.rx, me.ry); meX = p.sx + ox; meY = p.sy + oy - 22; meD = me.rx + me.ry; }
  // em vez de deixar o objeto todo transparente, abre um círculo suave em volta do personagem
  const holeOf = (s, x, y, d, yf) => {
    if (meD >= 1e9) return false;
    const l = x - s.ax, t = y - s.ay;
    return d > meD && meX > l - 20 && meX < l + s.w + 20 && meY > t - 20 && meY < t + s.h && (yf ?? y) > meY + 14;
  };
  const drawHole = (s, x, y, alpha) => {
    const l = x - s.ax, t = y - s.ay, kk = k;
    const px0 = Math.max(0, Math.floor(l * kk)), py0 = Math.max(0, Math.floor(t * kk)), px1 = Math.min(holeC.width, Math.ceil((l + s.w) * kk)), py1 = Math.min(holeC.height, Math.ceil((t + s.h) * kk));
    if (px1 <= px0 || py1 <= py0) return;
    holeX.setTransform(1, 0, 0, 1, 0, 0); holeX.globalCompositeOperation = 'source-over'; holeX.clearRect(px0, py0, px1 - px0, py1 - py0);
    holeX.setTransform(kk, 0, 0, kk, 0, 0); holeX.imageSmoothingEnabled = true; pblit(holeX, s, x, y, alpha);
    holeX.globalCompositeOperation = 'destination-out';
    const R0 = 26, R1 = 58, g = holeX.createRadialGradient(meX, meY + 6, R0, meX, meY + 6, R1);
    g.addColorStop(0, 'rgba(0,0,0,0.92)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    holeX.fillStyle = g; holeX.save(); holeX.translate(meX, meY + 6); holeX.scale(1, 1.25); holeX.translate(-meX, -meY - 6); holeX.fillRect(meX - R1, meY + 6 - R1, R1 * 2, R1 * 2); holeX.restore();
    holeX.globalCompositeOperation = 'source-over';
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(holeC, px0, py0, px1 - px0, py1 - py0, px0, py0, px1 - px0, py1 - py0); ctx.restore();
  };
  const blitV = (s, x, y, d, yf, alpha) => { if (holeOf(s, x, y, d, yf)) drawHole(s, x, y, alpha); else pblit(ctx, s, x, y, alpha); };
  const fadeA = (s, x, y, d, yf) => {
    const l = x - s.ax, t = y - s.ay;
    return d > meD && meX > l + 6 && meX < l + s.w - 6 && meY > t && meY < t + s.h - 10 && (yf ?? y) > meY + 18 ? (yf != null && inB >= 0 ? 0.22 : 0.42) : null;
  };
  const drawItem = it => {
    if (it.k === 0) {
      if (it.cliff) {
        const i = it.y * MAP_W + it.x, h = WORLD.height[i] || 1, s = cliffSprite(h, Math.floor(hash2(it.x, it.y, 3) * 4), h >= 4 ? 1 : 0);
        blitV(s, it.sx, it.sy, it.d);
        if (it.o === O.WATERFALL) { drawWaterfallLive(ctx, it.sx, it.sy, CLIFF_H[h], now); if (Math.random() < 0.5) spawnPart('mist', it.sx - ox + (Math.random() - 0.5) * 50, it.sy - oy + 18); }
        return;
      }
      if (it.o === O.TOWER) { const p = iso(it.x - 0.5, it.y - 0.5), s = towerSprite(WORLD.tvar[it.y * MAP_W + it.x], WORLD.toff[it.y * MAP_W + it.x]); blitV(s, p.sx + ox, p.sy + oy, it.d); return; }
      const s = objSprite(it.o, it.x, it.y);
      if (s) { const sw = SWAY[it.o] ? wind(it.x, it.y, now) * SWAY[it.o] * (0.7 + ATM.wind * 0.6) : 0; if (s.h > 60 && holeOf(s, it.sx, it.sy, it.d)) drawHole(s, it.sx, it.sy); else drawSway(ctx, s, it.sx, it.sy, sw); }
      liveParts(ctx, it.o, it.sx, it.sy, it.x, it.y, now);
      if (it.o === O.MUSHROOM) { const z = zoneAt(it.x, it.y); if (z === Z.SWAMP || (z === Z.FOREST && hash2(it.x, it.y, 17) < 0.3)) G.lights.push({ x: it.sx, y: it.sy - 8, r: 16, c: '90,200,240', a: 0.6 }); }
      return;
    }
    if (it.k === 6) { const s = interiorSprite(it.b); if (s) pblit(ctx, s, it.sx, it.sy); return; }
    if (it.k === 4) {
      const s = buildingSprite(it.b, day.night);
      blitV(s, it.sx, it.sy, it.d, it.sy + (it.b.w + it.b.h) * HTH, it.a < 1 ? it.a : null);
      if (day.night) for (const [wx, wy, wz] of buildingWindows(it.b)) { const p = iso(wx, wy); G.lights.push({ x: p.sx + ox, y: p.sy + oy - wz, r: 28, c: it.b.kind === 'temple' ? '190,210,255' : '255,190,100', a: 0.85 }); }
      if ((it.b.kind === 'tavern' || it.b.kind === 'house' || it.b.kind === 'smith') && Math.random() < (it.b.kind !== 'house' ? 0.14 : 0.05)) { const p = iso(it.b.x - 0.5 + it.b.w * 0.3, it.b.y - 0.5 + it.b.h * 0.35); spawnPart('smoke', p.sx, p.sy - (bldTopArt(it.b) * 0.9 + 30)); }
      if (it.b.kind === 'smith') { const p = iso(it.b.x - 0.5 + it.b.w * 0.5, it.b.y - 0.5 + it.b.h); G.lights.push({ x: p.sx + ox, y: p.sy + oy - 16, r: 62, c: '255,130,50', a: 1, flick: 1 }); if (Math.random() < 0.1) spawnPart('ember', p.sx, p.sy - 20); }
      return;
    }
    if (it.k === 5) { pblit(ctx, slabSprite(Math.floor(hash2(it.x, it.y, 4) * 3)), it.sx, it.sy - FLOOR_PX); return; }
    const e = it.e;
    ctx.imageSmoothingEnabled = false;
    if (it.k === 1) {
      drawMonsterEntity(ctx, e, it.sx, it.sy, now);
    } else if (it.k === 3) {
      drawHeroEntity(ctx, e, it.sx, it.sy, now);
      labels.push({ sx: it.sx, sy: it.sy - (R3.ok ? 56 : 78), name: e.name, color: '#b8e0a8', npc: e, e });
    } else {
      ctx.imageSmoothingEnabled = true; drawAuras(ctx, e, it.sx, it.sy, now); ctx.imageSmoothingEnabled = false;
      drawHeroEntity(ctx, e, it.sx, it.sy, now);
      heroExtras(e, it.sx, it.sy);
      if (e.carrying && G.players[e.carrying]) drawCarried(ctx, G.players[e.carrying], it.sx, it.sy);
      G.lights.push({ x: it.sx, y: it.sy - 30, r: 34, c: '255,240,220', a: 0.4 });
      labels.push({ sx: it.sx, sy: it.sy - (e.downed && !e.carriedBy ? 20 : (R3.ok ? 58 : 80)), name: e.name, color: e.id === G.myId ? '#f4dc8a' : '#b8d0f0', hp: e.hp / e.maxHp, mp: e.id === G.myId ? e.mp / e.maxMp : null, e, player: true });
    }
    ctx.imageSmoothingEnabled = true;
  };
  for (const it of items) drawItem(it);
  for (const it of upper) drawItem(it);

  drawEffects(ctx, ox, oy, now);
  ambient(visTrees, visFlowers, visGrass, day.night);
  drawParticles(ctx, ox, oy, now, dt);

  // 7) iluminação noturna (camada em resolução reduzida = luz suave)
  if (day.dark > 0.01) {
    const lw = Math.ceil(vw / 2), lh = Math.ceil(vh / 2);
    if (lightC.width !== lw || lightC.height !== lh) { lightC.width = lw; lightC.height = lh; }
    lightX.setTransform(0.5, 0, 0, 0.5, 0, 0);
    lightX.globalCompositeOperation = 'source-over';
    lightX.clearRect(0, 0, vw, vh);
    lightX.fillStyle = `rgba(8,12,34,${day.dark})`; lightX.fillRect(0, 0, vw, vh);
    lightX.globalCompositeOperation = 'destination-out';
    for (const L of G.lights) {
      const r = L.r * 2 * (L.flick ? 0.93 + Math.sin(now / 70 + L.x) * 0.05 : 1);
      if (!(r > 0.1) || L.x < -r || L.y < -r || L.x > vw + r || L.y > vh + r) continue;
      const g = lightX.createRadialGradient(L.x, L.y, 0, L.x, L.y, r);
      g.addColorStop(0, `rgba(0,0,0,${L.a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      lightX.fillStyle = g; lightX.fillRect(L.x - r, L.y - r, r * 2, r * 2);
    }
    ctx.drawImage(lightC, 0, 0, vw, vh);
    ctx.globalCompositeOperation = 'lighter';
    for (const L of G.lights) {
      const r = L.r * 2 * 0.7;
      if (!(r > 0.1) || L.x < -r || L.y < -r || L.x > vw + r || L.y > vh + r) continue;
      const g = ctx.createRadialGradient(L.x, L.y, 0, L.x, L.y, r);
      g.addColorStop(0, `rgba(${L.c},${0.22 * L.a * day.dark * 1.4})`); g.addColorStop(1, `rgba(${L.c},0)`);
      ctx.fillStyle = g; ctx.fillRect(L.x - r, L.y - r, r * 2, r * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // 8) atmosfera e correção de cor (em pixels de tela)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawAtmosphere(ctx, W, H, now, day, cam);
  if (day.dusk > 0.01) { ctx.fillStyle = `rgba(255,120,40,${day.dusk * 0.1})`; ctx.fillRect(0, 0, W, H); }
  // fim de tarde dourado: tudo um pouco mais escuro e quente, com brilho no alto da tela
  if (!day.night) { ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = 'rgb(228,206,176)'; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over';
    if (!GOLD || GOLD.height !== H) { GOLD = ctx.createLinearGradient(0, 0, 0, H); GOLD.addColorStop(0, 'rgba(255,190,110,0.16)'); GOLD.addColorStop(0.45, 'rgba(255,190,110,0)'); GOLD.addColorStop(1, 'rgba(40,20,10,0.12)'); GOLD.height = H; }
    ctx.fillStyle = GOLD; ctx.fillRect(0, 0, W, H); }
  ctx.globalCompositeOperation = 'soft-light';
  ctx.fillStyle = day.night ? 'rgba(60,80,150,0.35)' : `rgba(${ATM.tint.map(Math.round).join(',')},${0.25 + ATM.ta})`; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over';
  if (!VIGNETTE || VIGNETTE.width !== W || VIGNETTE.height !== H) {
    VIGNETTE = document.createElement('canvas'); VIGNETTE.width = W; VIGNETTE.height = H;
    const v = VIGNETTE.getContext('2d'), g = v.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    g.addColorStop(0, 'rgba(12,6,2,0)'); g.addColorStop(1, 'rgba(12,6,2,0.7)'); v.fillStyle = g; v.fillRect(0, 0, W, H);
  }
  ctx.drawImage(VIGNETTE, 0, 0);
  return labels;
}
let VIGNETTE = null, GOLD = null;
function diamondOutline(ctx, sx, sy, color) {
  ctx.strokeStyle = color; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(sx, sy - HTH); ctx.lineTo(sx + HTW, sy); ctx.lineTo(sx, sy + HTH); ctx.lineTo(sx - HTW, sy); ctx.closePath(); ctx.stroke();
}
function targetRing(ctx, sx, sy, now) {
  const r = 18 + Math.sin(now / 150) * 1.5;
  ctx.strokeStyle = 'rgba(220,60,40,0.9)'; ctx.lineWidth = 1.6;
  for (let q = 0; q < 4; q++) { const a = q * Math.PI / 2 + now / 600; ctx.beginPath(); ctx.ellipse(sx, sy, r, r / 2, 0, a, a + 1.0); ctx.stroke(); }
  softDab(ctx, sx, sy, r * 0.9, '#d83a28', 0.12);
}
function ambient(visTrees, visFlowers, visGrass, night) {
  if (G.parts.length > 280) return;
  if (visTrees.length && Math.random() < 0.06 * (0.6 + ATM.wind)) { const t = pick(visTrees); spawnPart('leaf', t.wx + (Math.random() - 0.5) * 32, t.wy - 60); }
  let nb = 0, nf = 0;
  for (const p of G.parts) { if (p.kind === 'butterfly') nb++; else if (p.kind === 'firefly') nf++; }
  if (!night && ATM.rain < 0.3 && visFlowers.length && nb < 5 && Math.random() < 0.03) { const t = pick(visFlowers); spawnPart('butterfly', t.wx, t.wy); }
  if ((night || ATM.rays > 0.6) && visGrass.length && nf < (night ? 30 : 10) && Math.random() < 0.25) { const t = pick(visGrass); spawnPart('firefly', t.wx + (Math.random() - 0.5) * 32, t.wy); }
}
// ---------- textos na resolução da tela (nítidos) ----------
function pxText(ctx, text, x, y, color, size, font = '"Alegreya Sans SC", "Alegreya Sans", serif', weight = '700') {
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
    if (l.title) { pxText(ctx, l.title, x, y, '#ecd9a0', 17, '"Cinzel", serif', '700'); continue; }
    let yy = y;
    const e = l.e;
    if (false) {
      const w = 46;
      ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillRect(x - w / 2 - 2, yy - 2, w + 4, l.mp != null ? 11 : 8);
      const fr = clamp(l.hp, 0, 1);
      ctx.fillStyle = fr > 0.6 ? '#4caf50' : fr > 0.3 ? '#d8b030' : '#d04030';
      ctx.fillRect(x - w / 2, yy, Math.round(w * fr), 4);
      if (l.mp != null) { ctx.fillStyle = '#4a74d8'; ctx.fillRect(x - w / 2, yy + 5, Math.round(w * clamp(l.mp, 0, 1)), 3); }
      yy -= 6;
    }
    if (l.npc && l.npc.id === 'captain' && G.me && Object.keys(G.me.quests || {}).length < MAX_ACTIVE_QUESTS) pxText(ctx, '!', x, yy - 18 + Math.round(Math.sin(now / 200) * 2), '#f0c840', 26, '"Cinzel", serif', '900');
    if (!e) continue;
    if (e.downed && l.player) {
      const left = Math.max(0, (e.downUntil || 0) - now);
      pxText(ctx, e.revive ? 'Reanimando...' : `Caído · ${Math.ceil(left / 1000)}s`, x, yy - 18, '#f08a7a', 13);
      if (e.revive) { const pr = clamp((now - e.revive.t0) / REVIVE_MS, 0, 1); ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillRect(x - 26, yy - 12, 52, 6); ctx.fillStyle = '#7ad87a'; ctx.fillRect(x - 25, yy - 11, Math.round(50 * pr), 4); }
    }
    if (false) {
      const pr = (now - e.cast.start) / (e.cast.end - e.cast.start), w = 54;
      ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fillRect(x - w / 2 - 1, y + 14, w + 2, 6);
      ctx.fillStyle = '#a088e8'; ctx.fillRect(x - w / 2, y + 15, Math.round(w * pr), 4);
    }
    if (e.shout && e.shoutUntil > now) {
      const t = 1 - (e.shoutUntil - now) / 1600, s = t < 0.1 ? 1 + (0.1 - t) * 5 : 1;
      ctx.save(); ctx.globalAlpha = t > 0.8 ? (1 - t) * 5 : 1;
      pxText(ctx, e.shout, x, yy - 22 - t * 8, '#f6e4a0', Math.round(18 * s), '"Cinzel", serif', '900');
      ctx.restore();
    }
    if (e.say && e.sayUntil > now) {
      ctx.font = 'italic 500 15px "Alegreya", serif';
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
    if (n.crit) pxText(ctx, 'CRÍTICO!', x, y - 26 * pop, '#fff2d8', 13, '"Cinzel", serif', '900');
    pxText(ctx, n.text, x, y, n.color, size, '"Cinzel", serif', '900');
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
  { const f = typeof fogLayer === 'function' && fogLayer(); if (f) { ctx.imageSmoothingEnabled = true; ctx.drawImage(f, 0, 0); ctx.imageSmoothingEnabled = false; } }
  ctx.fillStyle = '#e04a3a';
  for (const id in G.monsters) { const e = G.monsters[id]; ctx.fillRect(e.rx - 0.7, e.ry - 0.7, 1.4, 1.4); }
  for (const id in G.players) { const e = G.players[id]; if (!e.visible) continue; ctx.fillStyle = id === G.myId ? '#ffffff' : '#6aa8f0'; ctx.fillRect(e.rx - 1.4, e.ry - 1.4, 2.8, 2.8); }
  ctx.fillStyle = '#7ad87a';
  for (const n of NPCS) ctx.fillRect(n.x - 0.8, n.y - 0.8, 1.6, 1.6);
  ctx.restore();
}
