// ============================================================
//  DRAGÃO (serpe) — as asas são as patas da frente; anda apoiado nos punhos das asas
//  modelo 3D, poses no chão e no voo, "foto" em quadro ampliado e recortado
// ============================================================
const DRAGON_FRAMES = { idle: 4, walk: 8, bite: 6, breath: 8, tail: 8, roar: 6, sleep: 2, fly: 8, flyfire: 4, carry: 4, takeoff: 6, land: 6 };
const DRAGON_MS = { bite: 700, breath: 2000, tail: 900, roar: 1300, takeoff: 1100, land: 800 };
const DRAGON_K = 8, DRAGON_Q = 0.4, DRAGON_S = 2.2, ALT_PX = 44;   // DRAGON_S: tamanho (1,8x o antigo); ALT_PX: pixels por unidade de altura de voo
let _dragon = null;
function dragonTex(kind) {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d');
  x.fillStyle = '#808080'; x.fillRect(0, 0, S, S);
  if (kind === 'belly') { for (let y = 0; y < S; y += 21) { const gr = x.createLinearGradient(0, y, 0, y + 21); gr.addColorStop(0, '#d0d0d0'); gr.addColorStop(0.8, '#9a9a9a'); gr.addColorStop(1, '#3a3a3a'); x.fillStyle = gr; x.fillRect(0, y, S, 21); } }
  else { const s = 18; for (let row = 0; row < S / (s * 0.55) + 2; row++) for (let col = -1; col < S / s + 1; col++) { const cx = col * s + (row % 2) * s / 2, cy = row * s * 0.55; const gr = x.createRadialGradient(cx, cy - s * 0.2, 1, cx, cy, s * 0.62); gr.addColorStop(0, '#e8e8e8'); gr.addColorStop(0.7, '#9a9a9a'); gr.addColorStop(1, '#303030'); x.fillStyle = gr; x.beginPath(); x.arc(cx, cy, s * 0.6, 0, Math.PI); x.fill(); } }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(kind === 'belly' ? 1 : 6, kind === 'belly' ? 5 : 6); return t;
}
function dmat(hex, kind, extra = {}) { const tex = dragonTex(kind); return new THREE.MeshStandardMaterial({ color: new THREE.Color(hex).convertSRGBToLinear(), roughness: kind === 'belly' ? 0.75 : 0.42, metalness: 0.15, map: tex, bumpMap: tex, bumpScale: 0.06, ...extra }); }

const DV = (x, y, z) => new THREE.Vector3(x, y, z), _dgUp = new THREE.Vector3(0, 1, 0);
// coloca um osso (cilindro de altura 1) entre dois pontos
function dgBone(m, a, b, r) { const d = new THREE.Vector3().subVectors(b, a), l = d.length() || 1e-3; m.position.copy(a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(_dgUp, d.multiplyScalar(1 / l)); m.scale.set(r, l, r); }

function buildDragon() {
  const root = new THREE.Group(), R = { root }; root.scale.setScalar(DRAGON_S);
  const sc = dmat('#3e0f0c', 'scale'), sc2 = dmat('#5a1812', 'scale'), belly = dmat('#9a6a42', 'belly'), horn = mat('#d8c8a4', 'bone'), dark = dmat('#1c0a08', 'scale');
  const memb = mat('#3a0f0b', 'leather', { side: THREE.DoubleSide, emissive: '#2a0604', emissiveIntensity: 0.25 }), claw = mat('#141010', 'bone');
  const eyeM = mat('#ffb030', 'gem', { emissive: '#ff7a10', emissiveIntensity: 3 }), shut = mat('#200a08', 'leather');
  const body = new THREE.Group(); root.add(body); R.body = body;
  // tronco: peito largo (músculos das asas), quadril forte
  const tor = mesh(capG(0.5, 1.5), sc, 0, 0, -0.05); tor.rotation.x = Math.PI / 2; body.add(tor);
  const chest = mesh(sphG(0.62), sc, 0, 0.08, 0.6); chest.scale.set(1.08, 1, 1.05); body.add(chest); R.chest = chest;
  const bel = mesh(capG(0.4, 1.3), belly, 0, -0.22, 0.05); bel.rotation.x = Math.PI / 2; body.add(bel);
  for (const s of [-1, 1]) { const shd = mesh(sphG(0.26), sc, s * 0.36, 0.2, 0.62); shd.scale.set(0.9, 0.8, 1.2); body.add(shd); const hp = mesh(sphG(0.36), sc, s * 0.3, 0.0, -0.62); hp.scale.set(0.85, 0.95, 1.2); body.add(hp); }
  for (let k = 0; k < 9; k++) { const sp = mesh(coneG(0.09 - k * 0.004, 0.32 - k * 0.012, 6), dark, 0, 0.52 - Math.abs(k - 3) * 0.02, 0.95 - k * 0.27); sp.rotation.x = -0.35; body.add(sp); }
  const ridge = mesh(capG(0.2, 1.6), dark, 0, 0.32, 0); ridge.rotation.x = Math.PI / 2; ridge.scale.set(1, 1, 0.6); body.add(ridge);
  // pescoço longo: 5 articulações
  let p = joint(body, 0, 0.28, 1.0); R.neck = [];
  for (let k = 0; k < 5; k++) {
    p.add(mesh(capG(0.25 - k * 0.025, 0.32), sc, 0, 0.2, 0));
    p.add(mesh(capG(0.17 - k * 0.02, 0.28), belly, 0, 0.19, 0.09));
    const sp = mesh(coneG(0.06, 0.22, 6), horn, 0, 0.2, -0.22 + k * 0.02); sp.rotation.x = -1.1; p.add(sp);
    R.neck.push(p); p = joint(p, 0, 0.4, 0);
  }
  const head = p; R.head = head; head.scale.setScalar(1.35);
  { const sk = mesh(sphG(0.27), sc, 0, 0.08, 0.2); sk.scale.set(0.95, 0.72, 1.35); head.add(sk); const sn = mesh(cylG(0.1, 0.19, 0.72, 10), sc2, 0, 0.03, 0.68); sn.rotation.x = Math.PI / 2; sn.scale.set(1, 1, 0.7); head.add(sn); const tp = mesh(sphG(0.1), sc2, 0, 0.03, 1.03); tp.scale.set(1, 0.75, 0.9); head.add(tp); const ri = mesh(capG(0.05, 0.5), dark, 0, 0.17, 0.55); ri.rotation.x = Math.PI / 2 + 0.12; head.add(ri); }
  for (const s of [-1, 1]) { const br = mesh(boxG(0.14, 0.07, 0.3), sc, s * 0.17, 0.24, 0.36); br.rotation.set(0.25, s * 0.25, 0); head.add(br); const ck = mesh(coneG(0.05, 0.22, 5), horn, s * 0.24, -0.02, 0.2); ck.rotation.set(-1.4, 0, s * 1.1); head.add(ck); }
  for (const s of [-1, 1]) {
    const h1 = mesh(coneG(0.07, 0.75, 8), horn, s * 0.16, 0.28, -0.14); h1.rotation.set(-1.1, 0, s * 0.28); head.add(h1);
    const h2 = mesh(coneG(0.04, 0.32, 6), horn, s * 0.24, 0.12, 0.05); h2.rotation.set(-1.3, 0, s * 0.7); head.add(h2);
    for (let k = 0; k < 3; k++) { const fr = mesh(coneG(0.03, 0.18, 5), horn, s * 0.25, -0.08, 0.05 - k * 0.12); fr.rotation.set(-1.6, 0, s * 1.3); head.add(fr); }
    const e = mesh(sphG(0.055), eyeM, s * 0.18, 0.15, 0.42); head.add(e); (R.eyes = R.eyes || []).push(e);
    const ec = mesh(boxG(0.1, 0.02, 0.07), shut, s * 0.18, 0.15, 0.43); ec.visible = false; head.add(ec); (R.shut = R.shut || []).push(ec);
    head.add(mesh(sphG(0.03), shut, s * 0.08, 0.1, 0.96));
  }
  const jaw = joint(head, 0, -0.1, 0.12); R.jaw = jaw;
  { const jw = mesh(cylG(0.08, 0.14, 0.82, 10), sc2, 0, -0.05, 0.4); jw.rotation.x = Math.PI / 2; jw.scale.set(1, 1, 0.55); jaw.add(jw); const tg = mesh(capG(0.05, 0.4), mat('#8a2a2a', 'leather'), 0, 0.0, 0.4); tg.rotation.x = Math.PI / 2; jaw.add(tg); }
  for (let k = 0; k < 6; k++) for (const s of [-1, 1]) jaw.add(mesh(coneG(0.022, 0.09, 5), horn, s * 0.12, 0.04, 0.2 + k * 0.12));
  for (let k = 0; k < 5; k++) for (const s of [-1, 1]) { const t = mesh(coneG(0.022, 0.08, 5), horn, s * 0.13, -0.11, 0.55 + k * 0.1); t.rotation.x = Math.PI; head.add(t); }
  const glow = mesh(sphG(0.16), mat('#ffcc40', 'gem', { emissive: '#ff8a10', emissiveIntensity: 4, transparent: true, opacity: 0.9 }), 0, -0.04, 0.75); glow.visible = false; head.add(glow); R.glow = glow;
  // cauda longa: 9 articulações e ponta em lança
  let t = joint(body, 0, 0.05, -1.0); R.tail = [];
  for (let k = 0; k < 9; k++) {
    const r = Math.max(0.07, 0.3 - k * 0.028), seg = mesh(capG(r, 0.36), sc, 0, 0, -0.26); seg.rotation.x = Math.PI / 2; t.add(seg);
    const sp = mesh(coneG(Math.max(0.025, 0.06 - k * 0.005), 0.18, 6), horn, 0, r * 0.95, -0.26); sp.rotation.x = -0.5; t.add(sp);
    R.tail.push(t); t = joint(t, 0, 0, -0.48);
  }
  const tip = mesh(coneG(0.22, 0.46, 4), horn, 0, 0, -0.1); tip.rotation.x = -Math.PI / 2; tip.scale.set(1, 1, 0.3); t.add(tip);
  // só duas pernas (atrás): as patas da frente são as asas
  R.legs = [];
  for (const s of [-1, 1]) {
    const hip = joint(body, s * 0.5, -0.1, -0.6); hip.add(mesh(capG(0.32, 0.55), sc, 0, -0.33, 0.04));
    const knee = joint(hip, 0, -0.7, 0.08); knee.add(mesh(capG(0.16, 0.48), sc2, 0, -0.3, 0));
    const ft = joint(knee, 0, -0.64, 0); ft.add(mesh(boxG(0.34, 0.13, 0.46), sc2, 0, -0.02, 0.12));
    for (const q of [-0.12, 0, 0.12]) { const c = mesh(coneG(0.035, 0.18, 5), claw, q, -0.04, 0.4); c.rotation.x = Math.PI / 2; ft.add(c); }
    const bc = mesh(coneG(0.03, 0.14, 5), claw, 0, -0.03, -0.14); bc.rotation.x = -Math.PI / 2; ft.add(bc);
    R.legs.push({ hip, knee, ft, s });
  }
  // asas = braços: úmero, antebraço, punho com garra (onde se apoia no chão) e três dedos longos com membrana
  const boneG = cylG(1, 0.7, 1, 8); R.wings = [];
  for (const s of [-1, 1]) {
    const W = { s, b: [] };
    for (const r of [0.11, 0.08, 0.045, 0.035, 0.03]) { const m = new THREE.Mesh(boneG, sc); W.b.push(m); body.add(m); }
    W.kE = mesh(sphG(0.1), sc); W.kW = mesh(sphG(0.085), sc); W.thumb = mesh(coneG(0.05, 0.26, 5), claw); body.add(W.kE, W.kW, W.thumb);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(8 * 9), 3));
    W.memb = new THREE.Mesh(g, memb); body.add(W.memb);
    R.wings.push(W);
  }
  return R;
}

// pontos da asa no espaço do corpo: fechada (punho no chão, dedos dobrados ao longo do flanco) ou aberta (batendo: flap)
function wingPts(s, spread, flap, gy, gz, glift) {
  const S = [s * 0.44, 0.36, 0.62], H = [s * 0.45, 0.05, -0.85];
  const Wf = [s * 1.0, gy + glift, 1.1 + gz];
  const fold = { E: [s * 1.12, S[1] + 0.3, 0.7 + gz * 0.4], W: Wf, F1: [s * 0.84, S[1] + 0.12, S[2] - 0.55], F2: [s * 0.88, S[1] - 0.22, S[2] - 1.15], F3: [s * 0.86, S[1] - 0.5, S[2] - 1.5] };
  const rot = (P, k) => { const a = flap * k, L = P[0], y = P[1]; return [s * (L * Math.cos(a) - y * Math.sin(a)) + S[0], L * Math.sin(a) + y * Math.cos(a) + S[1], P[2] + S[2]]; };
  const open = { E: rot([1.0, 0.05, 0.32], 1), W: rot([2.2, 0.05, 0.08], 1.1), F1: rot([3.6, 0, -0.5], 1.35), F2: rot([3.15, 0, -1.4], 1.3), F3: rot([2.45, 0, -1.75], 1.2) };
  const L = k => DV(fold[k][0] + (open[k][0] - fold[k][0]) * spread, fold[k][1] + (open[k][1] - fold[k][1]) * spread, fold[k][2] + (open[k][2] - fold[k][2]) * spread);
  return { S: DV(...S), H: DV(...H), E: L('E'), W: L('W'), F1: L('F1'), F2: L('F2'), F3: L('F3') };
}
function setWing(W, P) {
  const r = [0.11, 0.08, 0.045, 0.035, 0.03], seg = [[P.S, P.E], [P.E, P.W], [P.W, P.F1], [P.W, P.F2], [P.W, P.F3]];
  seg.forEach(([a, b], i) => dgBone(W.b[i], a, b, r[i]));
  W.kE.position.copy(P.E); W.kW.position.copy(P.W); W.thumb.position.copy(P.W); W.thumb.rotation.set(Math.PI * 0.72, 0, 0);
  const mid = (a, b, k) => a.clone().lerp(b, 0.5).lerp(P.W, k);   // borda recortada entre os dedos
  const M12 = mid(P.F1, P.F2, 0.16), M23 = mid(P.F2, P.F3, 0.16), M3H = mid(P.F3, P.H, 0.22);
  const tri = [P.S, P.E, P.W, P.W, P.F1, M12, P.W, M12, P.F2, P.W, P.F2, M23, P.W, M23, P.F3, P.W, P.F3, M3H, P.W, M3H, P.H, P.W, P.H, P.S];
  const pos = W.memb.geometry.attributes.position; tri.forEach((v, i) => pos.setXYZ(i, v.x, v.y, v.z)); pos.needsUpdate = true;
  W.memb.geometry.computeVertexNormals(); W.memb.geometry.computeBoundingSphere();
}

// estados: idle, walk, bite, breath, tail, roar, sleep, fly, flyfire, carry, takeoff, land — t de 0 a 1
function poseDragon(R, st, t) {
  const ph = t * Math.PI * 2, ease = x => x * x * (3 - 2 * x);
  R.body.position.set(0, 1.3, 0); R.body.rotation.set(-0.06, 0, 0); R.chest.scale.set(1.08, 1, 1.05);
  const N = [1.2, -0.02, -0.18, -0.3, -0.38]; R.neck.forEach((j, k) => j.rotation.set(N[k], 0, 0));
  R.head.rotation.set(-0.1, 0, 0); R.jaw.rotation.set(0.05, 0, 0); R.glow.visible = false;
  R.eyes.forEach(e => e.visible = true); R.shut.forEach(e => e.visible = false);
  R.tail.forEach((j, k) => j.rotation.set(k === 0 ? -0.12 : 0.05, Math.sin(ph - k * 0.7) * 0.07, 0));
  let spread = 0, flap = 0; const gz = [0, 0], gl = [0, 0];
  const legs = (amp, kn) => R.legs.forEach(L => { const off = L.s > 0 ? 0 : Math.PI; L.hip.rotation.set(0.38 + Math.sin(ph + off) * amp, 0, 0); L.knee.rotation.set(-0.8 - Math.max(0, Math.sin(ph + off + 1.2)) * kn, 0, 0); L.ft.rotation.set(0.42, 0, 0); });
  const tuck = (h, k, f) => R.legs.forEach(L => { L.hip.rotation.set(h, 0, 0); L.knee.rotation.set(k, 0, 0); L.ft.rotation.set(f, 0, 0); });
  legs(0, 0);
  const flying = st === 'fly' || st === 'flyfire' || st === 'carry';
  if (st === 'idle') { R.chest.scale.set(1.08 + Math.sin(ph) * 0.03, 1 + Math.sin(ph) * 0.03, 1.05); R.neck[0].rotation.x += Math.sin(ph) * 0.04; }
  else if (st === 'walk') {
    legs(0.42, 0.6); R.body.position.y += Math.abs(Math.sin(ph)) * 0.05; R.body.rotation.z = Math.sin(ph) * 0.03; R.neck[0].rotation.y = Math.sin(ph) * 0.06; R.tail.forEach((j, k) => j.rotation.y = Math.sin(ph - k * 0.6) * 0.16);
    for (let i = 0; i < 2; i++) { const o = ph + (i ? 0 : Math.PI); gz[i] = Math.sin(o) * 0.35; gl[i] = Math.max(0, Math.cos(o)) * 0.25; }
  }
  else if (st === 'bite') {
    const back = t < 0.4 ? ease(t / 0.4) : 0, lunge = t >= 0.4 && t < 0.7 ? ease((t - 0.4) / 0.3) : t >= 0.7 ? 1 - ease((t - 0.7) / 0.3) : 0;
    R.neck[0].rotation.x = 1.2 - back * 0.45 + lunge * 0.5; R.neck[1].rotation.x = -0.2 + lunge * 0.1; R.neck[2].rotation.x = -0.25 + lunge * 0.2; R.neck[3].rotation.x = -0.25 + lunge * 0.15;
    R.head.rotation.x = -0.1 - back * 0.3 + lunge * 0.25; R.jaw.rotation.x = t > 0.3 && t < 0.62 ? 0.7 : 0.05; R.body.rotation.x = -0.06 + lunge * 0.08;
  }
  else if (st === 'breath') {
    // inspira (peito estufa, pescoço recua), depois o jato varre na frente
    const inh = ease(Math.min(1, t / 0.35)), fire = t > 0.35, k = fire ? ease(Math.min(1, (t - 0.35) / 0.15)) : 0;
    R.neck[0].rotation.x = 1.2 - inh * 0.3 + k * 0.4; R.neck[1].rotation.x = -0.2 + k * 0.08; R.neck[2].rotation.x = -0.25 + k * 0.12; R.neck[3].rotation.x = -0.25 + k * 0.15;
    R.head.rotation.x = -0.1 - inh * 0.2 + k * 0.45; R.jaw.rotation.x = 0.05 + k * 0.75; R.chest.scale.set(1.08 + (fire ? 0 : inh * 0.1), 1 + (fire ? 0 : inh * 0.1), 1.08);
    R.glow.visible = true; R.glow.scale.setScalar(fire ? 1.4 + Math.sin(t * 40) * 0.3 : 0.3 + inh * 0.6); spread = 0.15; flap = 0.2;
  }
  else if (st === 'tail') {
    const w = t < 0.3 ? -ease(t / 0.3) * 0.4 : -0.4 + ease((t - 0.3) / 0.7) * 1.5;
    R.body.rotation.y = w * 0.4; R.tail.forEach((j, k) => j.rotation.y = w * (0.2 + k * 0.025)); R.neck[0].rotation.y = -w * 0.3; spread = 0.3; flap = 0.3;
  }
  else if (st === 'roar') {
    const k = ease(Math.min(1, t / 0.35));
    R.neck[0].rotation.x = 1.2 - k * 0.75; R.neck[1].rotation.x = -0.2 - k * 0.05; R.neck[2].rotation.x = -0.25 + k * 0.05; R.head.rotation.x = -0.1 - k * 0.55; R.jaw.rotation.x = 0.05 + k * 0.8;
    R.body.position.y += k * 0.25; R.body.rotation.x = -0.06 - k * 0.2; spread = k * 0.8; flap = k * 0.45; R.chest.scale.set(1.08 + k * 0.06, 1 + k * 0.06, 1.08);
  }
  else if (st === 'sleep') {
    R.body.position.y = 0.55; R.body.rotation.x = 0; R.chest.scale.set(1.08 + Math.sin(ph) * 0.04, 1 + Math.sin(ph) * 0.04, 1.05);
    R.legs.forEach(L => { L.hip.rotation.set(-1.0, 0, 0); L.knee.rotation.set(2.2, 0, 0); L.ft.rotation.set(-0.9, 0, 0); });
    R.neck[0].rotation.set(1.62, 0.3, 0); R.neck.slice(1).forEach(j => j.rotation.set(0.08, 0.3, 0)); R.head.rotation.set(-0.35, 0.25, 0); R.jaw.rotation.x = 0.02;
    R.tail.forEach((j, k) => j.rotation.set(k === 0 ? 0.12 : 0.03, 0.34, 0));
    R.eyes.forEach(e => e.visible = false); R.shut.forEach(e => e.visible = true);
  }
  else if (flying) {
    // voo: corpo deitado, pernas recolhidas (ou para a frente segurando a presa), asas batendo
    R.body.position.y = 1.5 - Math.sin(ph) * 0.12; R.body.rotation.x = 0.04; spread = 1; flap = Math.sin(ph) * 0.62 + 0.12;
    if (st === 'carry') tuck(-0.55, -0.35, -0.2); else tuck(1.15, 0.5, 0.7);
    const NF = [1.4, -0.12, -0.12, -0.12, -0.1]; R.neck.forEach((j, k) => j.rotation.set(NF[k], Math.sin(ph - k) * 0.03, 0)); R.head.rotation.x = -0.15;
    R.tail.forEach((j, k) => j.rotation.set(k === 0 ? 0.02 : 0, Math.sin(ph - k * 0.6) * 0.05, 0));
    if (st === 'flyfire') { R.neck[2].rotation.x += 0.2; R.neck[3].rotation.x += 0.3; R.neck[4].rotation.x += 0.2; R.head.rotation.x = 0.35; R.jaw.rotation.x = 0.75; R.glow.visible = true; R.glow.scale.setScalar(1.4 + Math.sin(t * 50) * 0.3); }
  }
  else if (st === 'takeoff') {
    const k = ease(Math.min(1, t * 1.6)); spread = k; flap = Math.cos(t * Math.PI * 3) * 0.8;
    R.body.position.y = 1.42 + t * 0.5; R.body.rotation.x = -0.15 * (1 - t); tuck(0.3 + t * 0.6, -0.2 + t * 0.5, 0.3);
    R.neck[0].rotation.x = 1.1; R.head.rotation.x = -0.2;
  }
  else if (st === 'land') {
    const c = t > 0.65 ? ease((t - 0.65) / 0.35) : 0; spread = 1 - c * 0.85; flap = 0.75 - t * 0.6;
    R.body.position.y = 1.55 - c * 0.35; R.body.rotation.x = -0.18 + c * 0.1; tuck(-0.45 + c * 0.6, -0.6 + c * 0.15, 0.3);
    R.neck[0].rotation.x = 0.8 + c * 0.6; R.head.rotation.x = -0.25 + c * 0.2; R.jaw.rotation.x = c * 0.4;
  }
  const gy = -R.body.position.y + 0.06;
  R.wings.forEach((W, i) => setWing(W, wingPts(W.s, spread, flap, gy, gz[i], gl[i])));
}

// fotos do dragão: cache próprio (não expulsa os outros sprites) e recortadas no tamanho do desenho
const DGC = new Map();
function dragonSprite3D(st, f, dir, force) {
  if (!R3.ok) return null;
  const key = st + '|' + f + '|' + dir; let s = DGC.get(key); if (s) return s;
  if (R3.budget <= 0 && !force) return null; R3.budget--;
  if (!_dragon) _dragon = buildDragon();
  const R = _dragon, N = DRAGON_FRAMES[st] || 1; poseDragon(R, st, (f + 0.5) / N);
  const { renderer, scene, cam } = R3, K = DRAGON_K;
  const saved = [cam.left, cam.right, cam.top, cam.bottom, cam.near, cam.far];
  cam.left *= K; cam.right *= K; cam.top *= K; cam.bottom *= K; cam.near = -80; cam.far = 80; cam.updateProjectionMatrix();
  const W = Math.round(FRAME_W * PXU * K * DRAGON_Q), H = Math.round(FRAME_H * PXU * K * DRAGON_Q);
  renderer.setSize(W, H, false);
  const a = dir * Math.PI / 4, yaw = Math.atan2(0.5 * Math.sin(a), Math.cos(a));
  R.root.rotation.set(0, yaw, 0); R.root.position.set(0, 0, 0);
  scene.add(R.root); renderer.render(scene, cam); scene.remove(R.root);
  const tmp = document.createElement('canvas'); tmp.width = W; tmp.height = H; const tx = tmp.getContext('2d'); tx.drawImage(renderer.domElement, 0, 0);
  [cam.left, cam.right, cam.top, cam.bottom, cam.near, cam.far] = saved; cam.updateProjectionMatrix(); renderer.setSize(R3.W, R3.H, false);
  const d = tx.getImageData(0, 0, W, H).data; let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) if (d[(y * W + x) * 4 + 3] > 6) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const u = 1 / (PXU * DRAGON_Q);
  if (x1 < 0) s = { c: tmp, w: W * u, h: H * u, ax: FRAME_W * K / 2, ay: FOOT_Y * K };
  else {
    x0 = Math.max(0, x0 - 3); y0 = Math.max(0, y0 - 3); x1 = Math.min(W - 1, x1 + 3); y1 = Math.min(H - 1, y1 + 3);
    const cw = x1 - x0 + 1, ch = y1 - y0 + 1, c = document.createElement('canvas'); c.width = cw; c.height = ch; c.getContext('2d').drawImage(tmp, x0, y0, cw, ch, 0, 0, cw, ch);
    s = { c, w: cw * u, h: ch * u, ax: FRAME_W * K / 2 - x0 * u, ay: FOOT_Y * K - y0 * u };
  }
  s.painted = true; s.hd = true;
  DGC.set(key, s); if (DGC.size > 240) DGC.delete(DGC.keys().next().value);
  return s;
}

// jato de fogo: do focinho até o chão (varrendo no chão; reto e para baixo no voo)
function drawJet(ctx, e, sx, fy, now) {
  const J = e.jet, k = Math.min(1, (now - J.t0) / J.ms), a = J.air ? J.a0 : J.a0 + (J.a1 - J.a0) * k, z = (e.z || 0) * FLOOR_PX;
  const h0 = J.air ? 70 : 75, n = J.air ? 10 : 20, len = J.len;
  const ox = G.view.ox, oy = G.view.oy, base = iso(e.rx, e.ry), pt = q => { const d = J.d0 + len * q, p = iso(e.rx + Math.cos(a) * d, e.ry + Math.sin(a) * d); return [p.sx + ox, p.sy + oy - z - (J.air ? (e.alt || 0) * ALT_PX * (1 - q) : 0) - h0 * Math.pow(1 - q, 1.4)]; };
  // núcleo brilhante: faixa larga que esquenta do branco ao vermelho
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
  for (const [w, col] of [[34, 'rgba(255,90,20,0.28)'], [18, 'rgba(255,170,60,0.5)'], [7, 'rgba(255,245,200,0.75)']]) { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); for (let q = 0; q <= 1.001; q += 0.1) { const [x, y] = pt(q); q ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); }
  ctx.restore();
  for (let i = n; i >= 0; i--) {
    const q = i / n, d = J.d0 + len * q, p = iso(e.rx + Math.cos(a) * d, e.ry + Math.sin(a) * d);
    const x = p.sx + ox, y = p.sy + oy - z - (J.air ? (e.alt || 0) * ALT_PX * (1 - q) : 0) - h0 * Math.pow(1 - q, 1.4);
    liveFlame(ctx, x + Math.sin(now / 37 + i) * 4, y, 0.7 + q * 1.3, now, i * 7.3 + J.t0);
    if (Math.random() < 0.25) spawnPart('ember', x - ox, y - oy - 10);
    if (i === n) G.lights.push({ x, y: y - 20, r: 170, c: '255,140,40', a: 1, flick: 1 });
  }
  if (Math.random() < 0.3) spawnPart('smoke', base.sx + Math.cos(a) * (J.d0 + len) * 32, base.sy - 40);
}
function drawOnFire(ctx, x, y, now, seed) {
  liveFlame(ctx, x - 5, y - 6, 0.55, now, seed); liveFlame(ctx, x + 6, y - 20, 0.45, now, seed + 3); liveFlame(ctx, x, y - 32, 0.4, now, seed + 7);
  G.lights.push({ x, y: y - 24, r: 70, c: '255,140,50', a: 0.9, flick: 1 }); if (Math.random() < 0.15) spawnPart('smoke', x - G.view.ox, y - G.view.oy - 44);
}

// desenha o dragão no mundo: sombra no chão e o corpo na altura do voo
function drawDragon(ctx, e, sx, sy, now) {
  const dtA = Math.min(0.1, (now - (e._altT0 || now)) / 1000); e._altT0 = now; e.alt = (e.alt || 0) + ((e.altT || 0) - (e.alt || 0)) * Math.min(1, dtA * 4);
  const alt = e.alt, fy = sy - alt * ALT_PX;
  const held = [];
  for (const id in G.players) { const p = G.players[id]; if (p.grab && p.grab.mid === e.id && now < p.grab.until) held.push(p); }
  let st = 'idle', f = Math.floor(now / 380) % DRAGON_FRAMES.idle;
  const jetOn = e.jet && now - e.jet.t0 < e.jet.ms;
  if (e.flags & 4) { st = 'sleep'; f = Math.floor(now / 1100) % 2; if (Math.random() < 0.04) spawnPart('smoke', sx - G.view.ox + (Math.random() - 0.5) * 30, sy - G.view.oy - 50); }
  else if (e.anim && DRAGON_MS[e.anim.a] && now - e.anim.t0 < DRAGON_MS[e.anim.a]) { st = e.anim.a; const N = DRAGON_FRAMES[st]; f = Math.min(N - 1, Math.floor((now - e.anim.t0) / DRAGON_MS[st] * N)); }
  else if (alt > 0.35) { st = jetOn && e.jet.air ? 'flyfire' : held.length ? 'carry' : 'fly'; f = Math.floor(now / 100) % DRAGON_FRAMES[st]; }
  else if (e.walking) { st = 'walk'; f = Math.floor(e.walkDist * 1.6) % DRAGON_FRAMES.walk; }
  const dir = e.dg != null ? e.dg : (e.dir || 0);
  let s = dragonSprite3D(st, f, dir, !e._dgs); if (s) e._dgs = s; else s = e._dgs || null;
  let alpha = 1; if (e.dieAt && now > e.dieAt) alpha = Math.max(0, 1 - (now - e.dieAt) / 900);
  ctx.imageSmoothingEnabled = true;
  // sombra: grande e escura no chão, mais larga e clara quanto mais alto
  const sh = 1 / (1 + alt * 0.2);
  softDab(ctx, sx, sy, 130 * (1 + alt * 0.06), '#000000', 0.55 * alpha * Math.max(0.55, sh)); if (alt > 0.35) { softDab(ctx, sx - 60, sy, 150, '#000000', 0.22 * alpha); softDab(ctx, sx + 60, sy, 150, '#000000', 0.22 * alpha); }
  if (s) { pblit(ctx, s, sx, fy, alpha); if (e.hitAt && now - e.hitAt < 110) pblit(ctx, whiteOf(s, 'wdg|' + st + f + dir), sx, fy, 0.55 * alpha); }
  for (const p of held) { const hs = heroSprite3D(p.cls, p.skin, p.color, { dir: p.dir || 0, walk: -1, act: { k: 'hurt', f: 6 } }); if (hs) { ctx.save(); ctx.translate(sx, fy - 10); ctx.rotate(Math.sin(now / 160) * 0.25); pblit(ctx, woundOf(hs, woundLevel(p)), 0, 0); ctx.restore(); } }
  if (jetOn) drawJet(ctx, e, sx, fy, now);
  G.lights.push({ x: sx, y: fy - 160, r: st === 'breath' || st === 'roar' || st === 'flyfire' ? 160 : 60, c: '255,150,60', a: st === 'breath' || st === 'flyfire' ? 1 : 0.4 });
}
