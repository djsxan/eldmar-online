// ============================================================
//  QUEDAS E CORPOS
//  - humanoides (jogadores, goblins, orcs, esqueletos, bandidos, trolls...): RAGDOLL real
//    (15 pontos com massa ligados por ossos, gravidade, chão e atrito; a pose resultante move o esqueleto 3D)
//  - bichos (lobo, cervo, aranha...) e dragão: tombam com física de corpo rígido (giram, quicam e assentam)
//  - SET.phys === 'staged': queda encenada leve (gira o desenho em 2D e mostra a pose final calculada uma vez)
// ============================================================
const FALLS = {};
const RAG_DT = 1 / 60;
const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// ---------- esqueleto 3D de quem caiu ----------
function rigOf(f) {
  if (f.hero) { const lk = f.hero.cls + ':' + f.hero.skin + ':' + f.hero.color; if (!_rigs.get(lk)) heroSprite3D(f.hero.cls, f.hero.skin, f.hero.color, { dir: 0, walk: -1 }); return _rigs.get(lk); }
  if (MON_LOOK[f.type]) { if (!_rigs.get('mon:' + f.type)) monSprite3D(f.type, -1, -1, 0); return _rigs.get('mon:' + f.type); }
  if (f.type === 'dragon') { if (!_dragon) _dragon = buildDragon(); return _dragon; }
  if (!_rigs.get('crt:' + f.type)) monSprite3D(f.type, -1, -1, 0); return _rigs.get('crt:' + f.type);
}
function yawOf(dir) { const a = (dir || 0) * Math.PI / 4; return Math.atan2(0.5 * Math.sin(a), Math.cos(a)); }
// direção no mapa -> direção no espaço do modelo (câmera isométrica)
function mapToModel(dx, dy) { const x = dx - dy, z = dx + dy, l = Math.hypot(x, z) || 1; return [x / l, z / l]; }

// ---------- ragdoll (verlet) ----------
const RAG_BONES = [['pel', 'nek'], ['nek', 'hed'], ['nek', 'shA'], ['nek', 'shB'], ['shA', 'shB'], ['shA', 'elA'], ['elA', 'haA'], ['shB', 'elB'], ['elB', 'haB'],
  ['pel', 'hpA'], ['pel', 'hpB'], ['hpA', 'hpB'], ['hpA', 'knA'], ['knA', 'ftA'], ['hpB', 'knB'], ['knB', 'ftB'],
  ['shA', 'hpA'], ['shB', 'hpB'], ['shA', 'hpB'], ['shB', 'hpA'], ['hed', 'shA'], ['hed', 'shB']];
const RAG_MIN = [['hpA', 'ftA', 0.55], ['hpB', 'ftB', 0.55], ['shA', 'haA', 0.45], ['shB', 'haB', 0.45], ['pel', 'hed', 0.92]];   // joelho e cotovelo não dobram ao contrário
function ragStart(f, R) {
  const P = { dir: f.dir, walk: -1 }; const Q = buildPose(f.cls || 'knight', P); applyPose(R, Q, P, 0);
  R.root.position.set(0, 0, 0); R.root.rotation.set(0, yawOf(f.dir), 0); R.root.updateMatrixWorld(true);
  const w = o => o.getWorldPosition(v3());
  const pts = { pel: w(R.hips), nek: w(R.neckJ), hed: w(R.head).add(v3(0, 0.08, 0)), shA: w(R.A.sh), elA: w(R.A.el), haA: w(R.A.hand), shB: w(R.B.sh), elB: w(R.B.el), haB: w(R.B.hand), hpA: w(R.LA.hp), knA: w(R.LA.kn), ftA: w(R.LA.ft), hpB: w(R.LB.hp), knB: w(R.LB.kn), ftB: w(R.LB.ft) };
  let minY = Infinity; for (const k in pts) minY = Math.min(minY, pts[k].y); for (const k in pts) pts[k].y -= minY - 0.03;
  const prev = {}, [ix, iz] = mapToModel(f.ix, f.iy), hgt = pts.hed.y;
  for (const k in pts) { const up = pts[k].y / hgt, sp = (0.6 + up * 2.6) * f.force; prev[k] = pts[k].clone().sub(v3(ix * sp * RAG_DT, (up * 0.8 + (Math.random() - 0.5) * 0.3) * RAG_DT, iz * sp * RAG_DT)); }
  const len = {}; for (const [a, b] of RAG_BONES) len[a + b] = pts[a].distanceTo(pts[b]);
  f.rag = { pts, prev, len, pel0: pts.pel.clone(), still: 0, hipY: R.hips.position.y };
}
function ragStep(f) {
  const { pts, prev, len } = f.rag; let maxV = 0;
  for (const k in pts) { const p = pts[k], q = prev[k], vx = (p.x - q.x) * 0.992, vy = (p.y - q.y) * 0.992, vz = (p.z - q.z) * 0.992; q.copy(p); p.x += vx; p.y += vy - 9.8 * RAG_DT * RAG_DT; p.z += vz; maxV = Math.max(maxV, Math.abs(vx) + Math.abs(vy) + Math.abs(vz)); }
  for (let it = 0; it < 10; it++) {
    for (const [a, b] of RAG_BONES) { const A = pts[a], B = pts[b], L = len[a + b], d = A.distanceTo(B) || 1e-6, k = (d - L) / d * 0.5; const dx = (B.x - A.x) * k, dy = (B.y - A.y) * k, dz = (B.z - A.z) * k; A.x += dx; A.y += dy; A.z += dz; B.x -= dx; B.y -= dy; B.z -= dz; }
    for (const [a, b, fr] of RAG_MIN) { const A = pts[a], B = pts[b], L = (fr * (a[0] === 'h' && b[0] === 'f' ? len[a + 'kn' + a[2]] + len['kn' + a[2] + 'ft' + a[2]] : a === 'pel' ? len.pelnek + len.nekhed : len[a + 'el' + a[2]] + len['el' + a[2] + 'ha' + a[2]])) || 0.5, d = A.distanceTo(B) || 1e-6; if (d >= L) continue; const k = (d - L) / d * 0.5; const dx = (B.x - A.x) * k, dy = (B.y - A.y) * k, dz = (B.z - A.z) * k; A.x += dx; A.y += dy; A.z += dz; B.x -= dx; B.y -= dy; B.z -= dz; }
    for (const k in pts) { const p = pts[k], r = k === 'hed' ? 0.1 : k === 'pel' ? 0.12 : 0.05; if (p.y < r) { p.y = r; const q = prev[k]; q.x += (p.x - q.x) * 0.35; q.z += (p.z - q.z) * 0.35; } }
  }
  f.rag.still = maxV < 0.004 ? f.rag.still + 1 : 0;
  return f.rag.still > 25;
}
function aimJoint(J, childLocal, dir) {
  J.quaternion.identity(); J.updateMatrixWorld(true);
  const pq = J.getWorldQuaternion(new THREE.Quaternion()), a = childLocal.clone().normalize().applyQuaternion(pq);
  const q = new THREE.Quaternion().setFromUnitVectors(a, dir.clone().normalize());
  J.quaternion.copy(pq.clone().invert().multiply(q).multiply(pq)); J.updateMatrixWorld(true);
}
function ragApply(f, R) {
  const P = f.rag.pts, up = P.nek.clone().sub(P.pel).normalize(), side0 = P.hpB.clone().sub(P.hpA).normalize();
  const fwd = new THREE.Vector3().crossVectors(side0, up).normalize(), side = new THREE.Vector3().crossVectors(up, fwd).normalize();
  const m = new THREE.Matrix4().makeBasis(side, up, fwd); R.root.quaternion.setFromRotationMatrix(m);
  for (const j of [R.hips, R.spine, R.chest]) j.quaternion.identity();
  const off = v3(0, f.rag.hipY, 0).applyQuaternion(R.root.quaternion);
  R.root.position.copy(P.pel).sub(off); R.root.position.x -= P.pel.x - f.rag.pel0.x; R.root.position.z -= P.pel.z - f.rag.pel0.z;   // mantém no centro do quadro
  R.root.updateMatrixWorld(true);
  const d = (a, b) => P[b].clone().sub(P[a]);
  aimJoint(R.neckJ, R.head.position, d('nek', 'hed'));
  aimJoint(R.A.sh, R.A.el.position, d('shA', 'elA')); aimJoint(R.A.el, R.A.hand.position, d('elA', 'haA'));
  aimJoint(R.B.sh, R.B.el.position, d('shB', 'elB')); aimJoint(R.B.el, R.B.hand.position, d('elB', 'haB'));
  aimJoint(R.LA.hp, R.LA.kn.position, d('hpA', 'knA')); aimJoint(R.LA.kn, R.LA.ft.position, d('knA', 'ftA'));
  aimJoint(R.LB.hp, R.LB.kn.position, d('hpB', 'knB')); aimJoint(R.LB.kn, R.LB.ft.position, d('knB', 'ftB'));
  // o corpo deslizou: deslocamento na tela (arte)
  f.ox = (P.pel.x - f.rag.pel0.x) * U; f.oy = (P.pel.z - f.rag.pel0.z) * U * 0.5;
}

// ---------- corpo rígido (bichos e dragão) ----------
function rigidStart(f, R) {
  const [ix, iz] = mapToModel(f.ix, f.iy);
  f.rig = { th: 0, w: 1.2 * f.force, axis: v3(iz, 0, -ix).normalize(), bounce: 0, slide: 0, sv: 0.8 * f.force, ix, iz };
}
function rigidStep(f) {
  const r = f.rig, T = Math.PI / 2 * (f.type === 'slime' || f.type === 'elderslime' ? 0.25 : 0.95);
  r.w += Math.sin(r.th + 0.25) * 9 * RAG_DT; r.th += r.w * RAG_DT;
  if (r.th >= T) { r.th = T; if (Math.abs(r.w) > 0.6 && r.bounce < 2) { r.w = -r.w * 0.32; r.bounce++; if (f.big) G.shake = Math.max(G.shake, 7); } else r.w = 0; }
  r.slide += r.sv * RAG_DT; r.sv *= 0.9;
  f.ox = r.ix * r.slide * U; f.oy = r.iz * r.slide * U * 0.5;
  return r.th >= T && r.w === 0 && r.sv < 0.02;
}
function rigidApply(f, R) {
  const r = f.rig, q = new THREE.Quaternion().setFromAxisAngle(r.axis, r.th), qy = new THREE.Quaternion().setFromAxisAngle(v3(0, 1, 0), yawOf(f.dir));
  R.root.quaternion.copy(q.multiply(qy)); R.root.position.set(0, f.type === 'dragon' ? 0 : 0.05, 0);
  if (R.legs) R.legs.forEach((L, i) => { const j = L.hip || L; if (j && j.rotation) j.rotation.x = 0.3 + (i % 2) * 0.25; });
  if (R.blob) R.blob.scale.set(1.25, 0.45, 1.25);
}

// ---------- foto do esqueleto na pose atual ----------
function rigShot(f, R, keep) {
  const { renderer, scene, cam } = R3, big = f.type === 'dragon', K = big ? DRAGON_K : 1, Qd = big ? DRAGON_Q : 1;
  const saved = [cam.left, cam.right, cam.top, cam.bottom];
  if (big) { cam.left *= K; cam.right *= K; cam.top *= K; cam.bottom *= K; cam.updateProjectionMatrix(); }
  const W = Math.round(FRAME_W * PXU * K * Qd), H = Math.round(FRAME_H * PXU * K * Qd); renderer.setSize(W, H, false);
  scene.add(R.root); renderer.render(scene, cam); scene.remove(R.root);
  if (big) { [cam.left, cam.right, cam.top, cam.bottom] = saved; cam.updateProjectionMatrix(); }
  renderer.setSize(R3.W, R3.H, false);
  const c = keep ? document.createElement('canvas') : (f._cv || (f._cv = document.createElement('canvas'))); c.width = W; c.height = H; const x = c.getContext('2d'); x.clearRect(0, 0, W, H); x.drawImage(renderer.domElement, 0, 0);
  return { c, w: FRAME_W * K, h: FRAME_H * K, ax: FRAME_W * K / 2, ay: FOOT_Y * K, painted: true, hd: true };
}

// ---------- começar uma queda ----------
// f: { key, x, y, z, dir, ix, iy (direção do golpe no mapa), type | hero, cls, big }
function startFall(o) {
  if (!R3.ok || FALLS[o.key]) return FALLS[o.key];
  const f = FALLS[o.key] = { ...o, t0: performance.now(), force: o.force || 1, ox: 0, oy: 0, done: false };
  f.mode = o.hero || MON_LOOK[o.type] ? 'rag' : 'rigid';
  const R = rigOf(f); if (!R) { delete FALLS[o.key]; return null; }
  if (f.mode === 'rag') ragStart(f, R); else rigidStart(f, R);
  if (SET.phys === 'staged') {   // calcula a pose final de uma vez e só gira o desenho na tela durante a queda
    for (let k = 0; k < 400; k++) if (f.mode === 'rag' ? ragStep(f) : rigidStep(f)) break;
    if (f.mode === 'rag') ragApply(f, R); else rigidApply(f, R);
    f.final = rigShot(f, R, true); f.done = true; f.staged = true;
  }
  return f;
}
// atualiza e devolve a imagem a desenhar
function fallSprite(f, now) {
  if (f.done) return f.final;
  const R = rigOf(f); if (!R) return null;
  const steps = Math.min(6, Math.max(1, Math.round((now - (f.tl || f.t0)) / 16.7))); f.tl = now;
  let settled = false; for (let k = 0; k < steps && !settled; k++) settled = f.mode === 'rag' ? ragStep(f) : rigidStep(f);
  if (now - f.t0 > 3500) settled = true;
  if (f.mode === 'rag') ragApply(f, R); else rigidApply(f, R);
  if (settled) { f.final = rigShot(f, R, true); f.done = true; return f.final; }
  return rigShot(f, R, false);
}
function drawFall(ctx, f, sx, sy, now, alpha = 1, wound = 0) {
  ctx.imageSmoothingEnabled = true;
  if (f.staged && now - f.t0 < 420) {   // encenada: o desenho de pé tomba girando
    const k = (now - f.t0) / 420, s = f.stand; if (s) { const side = (f.ix - f.iy) >= 0 ? 1 : -1; ctx.save(); ctx.globalAlpha = alpha; ctx.translate(sx, sy); ctx.rotate(side * k * k * Math.PI / 2); pblit(ctx, s, 0, 0); ctx.restore(); return; }
  }
  const s = fallSprite(f, now); if (!s) return;
  const sh = f.type === 'dragon' ? 90 : MON[f.type] && MON[f.type].big ? 34 : 16;
  softDab(ctx, sx + (f.ox || 0), sy + (f.oy || 0), sh, '#000000', 0.3 * alpha);
  const img = wound && f.done ? woundOf(s, wound) : s;
  pblit(ctx, img, sx + (f.ox || 0), sy + (f.oy || 0), alpha);
}
