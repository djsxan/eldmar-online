// ============================================================
//  DRAGÃO — modelo 3D, poses e "foto" em quadro ampliado
//  (é grande demais para o quadro normal dos monstros)
// ============================================================
const DRAGON_FRAMES = { idle: 4, walk: 8, bite: 6, breath: 6, tail: 8, roar: 6, sleep: 2 };
const DRAGON_MS = { bite: 700, breath: 1700, tail: 900, roar: 1300 };
const DRAGON_K = 5.6, DRAGON_Q = 0.42, DRAGON_S = 1.6;   // DRAGON_S: tamanho do dragão (o Chefe Orc é 1.45)   // tamanho do quadro (x o normal) e resolução da foto
let _dragon = null;

function buildDragon() {
  const root = new THREE.Group(), R = { root }; root.scale.setScalar(DRAGON_S);
  const sc = mat('#3a1414', 'leather'), sc2 = mat('#4e1a16', 'leather'), belly = mat('#8a5a38', 'leather'), horn = mat('#ddd0b0', 'bone');
  const memb = mat('#3a1210', 'leather', { side: THREE.DoubleSide }), claw = mat('#1a1410', 'bone');
  const eyeM = mat('#ffb030', 'gem', { emissive: '#ff7a10', emissiveIntensity: 3 }), shut = mat('#200a08', 'leather');
  const body = new THREE.Group(); root.add(body); R.body = body;
  // tronco
  const tor = mesh(capG(0.55, 1.5), sc, 0, 0, 0); tor.rotation.x = Math.PI / 2; body.add(tor);
  const chest = mesh(sphG(0.64), sc, 0, 0.06, 0.62); chest.scale.set(1, 0.95, 1.05); body.add(chest); R.chest = chest;
  const bel = mesh(capG(0.42, 1.35), belly, 0, -0.24, 0.1); bel.rotation.x = Math.PI / 2; body.add(bel);
  for (let k = 0; k < 9; k++) { const sp = mesh(coneG(0.09 - k * 0.004, 0.32 - k * 0.012, 6), horn, 0, 0.56 - Math.abs(k - 3) * 0.02, 0.95 - k * 0.27); sp.rotation.x = -0.35; body.add(sp); }
  // pescoço: 4 articulações (o eixo +y de cada uma segue o pescoço)
  let p = joint(body, 0, 0.28, 1.0); R.neck = [];
  for (let k = 0; k < 4; k++) {
    p.add(mesh(capG(0.25 - k * 0.03, 0.34), sc, 0, 0.21, 0));
    p.add(mesh(capG(0.17 - k * 0.025, 0.3), belly, 0, 0.2, 0.09));
    const sp = mesh(coneG(0.06, 0.22, 6), horn, 0, 0.2, -0.22 + k * 0.02); sp.rotation.x = -1.1; p.add(sp);
    R.neck.push(p); p = joint(p, 0, 0.42, 0);
  }
  const head = p; R.head = head;
  head.add(mesh(boxG(0.44, 0.34, 0.6), sc, 0, 0.06, 0.22));
  const snout = mesh(boxG(0.32, 0.22, 0.5), sc2, 0, 0.02, 0.72); head.add(snout);
  for (const s of [-1, 1]) {
    const h1 = mesh(coneG(0.065, 0.62, 8), horn, s * 0.16, 0.28, -0.12); h1.rotation.set(-1.05, 0, s * 0.25); head.add(h1);
    const h2 = mesh(coneG(0.04, 0.3, 6), horn, s * 0.24, 0.12, 0.05); h2.rotation.set(-1.3, 0, s * 0.7); head.add(h2);
    const e = mesh(sphG(0.055), eyeM, s * 0.18, 0.15, 0.42); head.add(e); (R.eyes = R.eyes || []).push(e);
    const ec = mesh(boxG(0.1, 0.02, 0.07), shut, s * 0.18, 0.15, 0.43); ec.visible = false; head.add(ec); (R.shut = R.shut || []).push(ec);
    head.add(mesh(sphG(0.03), shut, s * 0.08, 0.1, 0.96));
  }
  const jaw = joint(head, 0, -0.1, 0.12); R.jaw = jaw;
  jaw.add(mesh(boxG(0.3, 0.1, 0.78), sc2, 0, -0.04, 0.38));
  for (let k = 0; k < 6; k++) for (const s of [-1, 1]) { const t = mesh(coneG(0.022, 0.09, 5), horn, s * 0.12, 0.04, 0.2 + k * 0.12); jaw.add(t); }
  for (let k = 0; k < 5; k++) for (const s of [-1, 1]) { const t = mesh(coneG(0.022, 0.08, 5), horn, s * 0.13, -0.11, 0.55 + k * 0.1); t.rotation.x = Math.PI; head.add(t); }
  const glow = mesh(sphG(0.16), mat('#ffcc40', 'gem', { emissive: '#ff8a10', emissiveIntensity: 4, transparent: true, opacity: 0.9 }), 0, -0.04, 0.75); glow.visible = false; head.add(glow); R.glow = glow;
  // cauda: 7 articulações para trás
  let t = joint(body, 0, 0.05, -1.0); R.tail = [];
  for (let k = 0; k < 7; k++) {
    const r = 0.32 - k * 0.04, seg = mesh(capG(r, 0.36), sc, 0, 0, -0.26); seg.rotation.x = Math.PI / 2; t.add(seg);
    const sp = mesh(coneG(0.06 - k * 0.006, 0.2, 6), horn, 0, r * 0.95, -0.26); sp.rotation.x = -0.5; t.add(sp);
    R.tail.push(t); t = joint(t, 0, 0, -0.5);
  }
  const tip = mesh(coneG(0.2, 0.42, 4), horn, 0, 0, -0.1); tip.rotation.x = -Math.PI / 2; tip.scale.set(1, 1, 0.3); t.add(tip);
  // pernas (quadril -> joelho -> pé com garras)
  R.legs = [];
  for (const [x, z, fr] of [[-0.48, 0.62, 1], [0.48, 0.62, 1], [-0.5, -0.62, 0], [0.5, -0.62, 0]]) {
    const hip = joint(body, x, -0.18, z), th = mesh(capG(fr ? 0.2 : 0.25, 0.5), sc, 0, -0.33, 0); hip.add(th);
    const knee = joint(hip, 0, -0.68, 0); knee.add(mesh(capG(0.15, 0.46), sc2, 0, -0.3, 0));
    const ft = joint(knee, 0, -0.62, 0); ft.add(mesh(boxG(0.3, 0.12, 0.42), sc2, 0, -0.02, 0.1));
    for (const q of [-0.1, 0, 0.1]) { const c = mesh(coneG(0.03, 0.14, 5), claw, q, -0.04, 0.34); c.rotation.x = Math.PI / 2; ft.add(c); }
    R.legs.push({ hip, knee, ft, fr, x });
  }
  // asas: braço, antebraço e membrana em leque
  const fan = (pts, m) => { const pos = []; for (let i = 1; i < pts.length - 1; i++) pos.push(...pts[0], ...pts[i], ...pts[i + 1]); const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return new THREE.Mesh(g, m); };
  R.wings = [];
  for (const s of [-1, 1]) {
    const sh = joint(body, s * 0.42, 0.48, 0.5);
    const arm = mesh(cylG(0.07, 0.055, 1.3, 8), sc, s * 0.65, 0, 0); arm.rotation.z = Math.PI / 2; sh.add(arm);
    const m1 = fan([[0, 0, 0], [s * 1.3, 0, 0], [s * 0.9, -0.05, -0.9], [0, -0.1, -1.2]], memb); sh.add(m1);
    const el = joint(sh, s * 1.3, 0, 0);
    const fa = mesh(cylG(0.055, 0.035, 1.6, 8), sc, s * 0.8, 0, 0); fa.rotation.z = Math.PI / 2; el.add(fa);
    for (const [fx, fz] of [[1.6, 0.05], [1.4, -0.75], [0.95, -1.35]]) { const fb = mesh(cylG(0.025, 0.012, Math.hypot(fx, fz), 5), sc, s * fx / 2, 0, fz / 2); fb.rotation.z = Math.PI / 2; fb.rotation.y = -s * Math.atan2(fz, fx); el.add(fb); }
    const m2 = fan([[0, 0, 0], [s * 1.6, 0, 0.05], [s * 1.4, -0.04, -0.75], [s * 0.95, -0.06, -1.35], [s * -0.4, -0.1, -1.2]], memb); el.add(m2);
    el.add(mesh(coneG(0.04, 0.2, 5), horn, s * 0.05, 0.1, 0));
    R.wings.push({ sh, el, s, m1, m2 });
  }
  return R;
}

// estados: idle, walk, bite, breath, tail, roar, sleep — t de 0 a 1 dentro do ciclo/ação
function poseDragon(R, st, t) {
  const ph = t * Math.PI * 2, ease = x => x * x * (3 - 2 * x);
  R.body.position.set(0, 1.42, 0); R.body.rotation.set(0, 0, 0); R.chest.scale.set(1, 0.95, 1.05);
  const N = [0.95, -0.25, -0.35, -0.3]; R.neck.forEach((j, k) => j.rotation.set(N[k], 0, 0));
  R.head.rotation.set(-0.08, 0, 0); R.jaw.rotation.set(0.05, 0, 0); R.glow.visible = false;
  R.eyes.forEach(e => e.visible = true); R.shut.forEach(e => e.visible = false);
  R.tail.forEach((j, k) => j.rotation.set(k === 0 ? -0.18 : 0.06, Math.sin(ph - k * 0.7) * 0.08, 0));
  let spread = 0;
  const legs = (amp, kn) => R.legs.forEach((L, i) => { const off = (i === 0 || i === 3) ? 0 : Math.PI; L.hip.rotation.set(0.15 + Math.sin(ph + off) * amp, 0, 0); L.knee.rotation.set(-0.45 - Math.max(0, Math.sin(ph + off + 1.2)) * kn, 0, 0); L.ft.rotation.set(0.3, 0, 0); });
  legs(0, 0);
  if (st === 'idle') { R.chest.scale.set(1 + Math.sin(ph) * 0.03, 0.95 + Math.sin(ph) * 0.03, 1.05); R.neck[0].rotation.x += Math.sin(ph) * 0.04; }
  else if (st === 'walk') { legs(0.42, 0.6); R.body.position.y += Math.abs(Math.sin(ph)) * 0.05; R.body.rotation.z = Math.sin(ph) * 0.03; R.neck[0].rotation.y = Math.sin(ph) * 0.06; R.tail.forEach((j, k) => j.rotation.y = Math.sin(ph - k * 0.6) * 0.16); }
  else if (st === 'bite') {
    const back = t < 0.4 ? ease(t / 0.4) : 0, lunge = t >= 0.4 && t < 0.7 ? ease((t - 0.4) / 0.3) : t >= 0.7 ? 1 - ease((t - 0.7) / 0.3) : 0;
    R.neck[0].rotation.x = 0.95 - back * 0.45 + lunge * 0.6; R.neck[1].rotation.x = -0.25 + lunge * 0.1; R.neck[2].rotation.x = -0.35 + lunge * 0.2; R.neck[3].rotation.x = -0.3 + lunge * 0.15;
    R.head.rotation.x = -0.08 - back * 0.3 + lunge * 0.25; R.jaw.rotation.x = t > 0.3 && t < 0.62 ? 0.7 : 0.05;
  }
  else if (st === 'breath') {
    const k = ease(Math.min(1, t / 0.55)), fire = t > 0.6;
    R.neck[0].rotation.x = 0.95 - (1 - k) * 0.35 + k * 0.35; R.neck[1].rotation.x = -0.25 + k * 0.08; R.neck[2].rotation.x = -0.35 + k * 0.12; R.neck[3].rotation.x = -0.3 + k * 0.1;
    R.head.rotation.x = -0.08 + k * 0.25; R.jaw.rotation.x = 0.05 + k * 0.7; R.chest.scale.set(1 + (1 - k) * 0.08, 1 + (1 - k) * 0.08, 1.08);
    R.glow.visible = true; R.glow.scale.setScalar(fire ? 1.4 + Math.sin(t * 40) * 0.3 : 0.4 + k * 0.6);
  }
  else if (st === 'tail') {
    const w = t < 0.3 ? -ease(t / 0.3) * 0.4 : -0.4 + ease((t - 0.3) / 0.7) * 1.5;
    R.body.rotation.y = w * 0.4; R.tail.forEach((j, k) => j.rotation.y = w * (0.22 + k * 0.03)); R.neck[0].rotation.y = -w * 0.3; spread = 0.25;
  }
  else if (st === 'roar') {
    const k = ease(Math.min(1, t / 0.35));
    R.neck[0].rotation.x = 0.95 - k * 0.55; R.neck[1].rotation.x = -0.25 - k * 0.05; R.neck[2].rotation.x = -0.35 + k * 0.05; R.head.rotation.x = -0.08 - k * 0.55; R.jaw.rotation.x = 0.05 + k * 0.8;
    R.body.position.y += k * 0.12; spread = k; R.chest.scale.set(1 + k * 0.06, 1 + k * 0.06, 1.08);
  }
  else if (st === 'sleep') {
    R.body.position.y = 0.55; R.chest.scale.set(1 + Math.sin(ph) * 0.04, 0.95 + Math.sin(ph) * 0.04, 1.05);
    R.legs.forEach(L => { L.hip.rotation.set(L.fr ? -1.25 : -1.0, 0, 0); L.knee.rotation.set(2.2, 0, 0); L.ft.rotation.set(-0.9, 0, 0); });
    R.neck[0].rotation.set(1.45, 0.3, 0); R.neck.slice(1).forEach(j => j.rotation.set(0, 0.45, 0)); R.head.rotation.set(0.25, 0.3, 0);
    R.tail.forEach((j, k) => j.rotation.set(k === 0 ? 0.1 : 0.02, 0.32, 0));
    R.eyes.forEach(e => e.visible = false); R.shut.forEach(e => e.visible = true);
  }
  // asas: dobradas para trás (spread 0) ou abertas (1)
  for (const W of R.wings) { const s = W.s, f = 1 - spread; W.sh.rotation.set(0, s * (0.1 + f * 1.35), -s * (0.6 - f * 0.05)); W.el.rotation.set(0, -s * (0.3 + f * 2.55), 0); const k = 0.3 + spread * 0.7; W.m1.scale.set(1, 1, k); W.m2.scale.set(1, 1, k); }
}

function dragonSprite3D(st, f, dir) {
  if (!R3.ok) return null;
  return cache3('dg|' + st + '|' + f + '|' + dir, () => {
    if (!_dragon) _dragon = buildDragon();
    const R = _dragon, N = DRAGON_FRAMES[st] || 1; poseDragon(R, st, (f + 0.5) / N);
    const { renderer, scene, cam } = R3, K = DRAGON_K;
    const saved = [cam.left, cam.right, cam.top, cam.bottom];
    cam.left *= K; cam.right *= K; cam.top *= K; cam.bottom *= K; cam.updateProjectionMatrix();
    const W = Math.round(FRAME_W * PXU * K * DRAGON_Q), H = Math.round(FRAME_H * PXU * K * DRAGON_Q);
    renderer.setSize(W, H, false);
    const a = dir * Math.PI / 4, yaw = Math.atan2(0.5 * Math.sin(a), Math.cos(a));
    R.root.rotation.set(0, yaw, 0); R.root.position.set(0, 0, 0);
    scene.add(R.root); renderer.render(scene, cam); scene.remove(R.root);
    const c = document.createElement('canvas'); c.width = W; c.height = H; c.getContext('2d').drawImage(renderer.domElement, 0, 0);
    [cam.left, cam.right, cam.top, cam.bottom] = saved; cam.updateProjectionMatrix(); renderer.setSize(R3.W, R3.H, false);
    return { c, w: FRAME_W * K, h: FRAME_H * K, ax: FRAME_W * K / 2, ay: FOOT_Y * K, painted: true, hd: true };
  }, 'dg' + dir);
}

// desenha o dragão no mundo (estado vem das animações do servidor e das bandeiras do snapshot)
function drawDragon(ctx, e, sx, sy, now) {
  let st = 'idle', f = Math.floor(now / 380) % DRAGON_FRAMES.idle;
  if (e.flags & 4) { st = 'sleep'; f = Math.floor(now / 1100) % 2; if (Math.random() < 0.04) spawnPart('smoke', sx - G.view.ox + (Math.random() - 0.5) * 20, sy - G.view.oy - 30); }
  else if (e.anim && DRAGON_MS[e.anim.a] && now - e.anim.t0 < DRAGON_MS[e.anim.a]) { st = e.anim.a; const N = DRAGON_FRAMES[st]; f = Math.min(N - 1, Math.floor((now - e.anim.t0) / DRAGON_MS[st] * N)); }
  else if (e.walking) { st = 'walk'; f = Math.floor(e.walkDist * 2.4) % DRAGON_FRAMES.walk; }
  const dir = e.dg != null ? e.dg : (e.dir || 0);
  const s = dragonSprite3D(st, f, dir) || dragonSprite3D('idle', 0, dir);
  let alpha = 1; if (e.dieAt && now > e.dieAt) alpha = Math.max(0, 1 - (now - e.dieAt) / 900);
  ctx.imageSmoothingEnabled = true;
  softDab(ctx, sx, sy, 90, '#000000', 0.4 * alpha);
  if (!s) return;
  pblit(ctx, s, sx, sy, alpha);
  if (e.hitAt && now - e.hitAt < 110) pblit(ctx, whiteOf(s, 'wdg|' + st + f + dir), sx, sy, 0.55 * alpha);
  G.lights.push({ x: sx, y: sy - 120, r: st === 'breath' || st === 'roar' ? 140 : 50, c: '255,150,60', a: st === 'breath' ? 1 : 0.4 });
}
