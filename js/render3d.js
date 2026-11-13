// ============================================================
//  RENDER 3D — personagens e monstros "pré-renderizados" (como no
//  Diablo II): cada um é montado como um modelo 3D com materiais
//  reais (metal, couro, tecido, pele), iluminado e fotografado
//  em 8 direções e 12 quadros por animação. As imagens viram
//  sprites 2D guardados em cache. Usa Three.js só para isso.
// ============================================================
const R3 = { ok: false };
const U = 46;          // unidades de arte do mundo por metro do modelo
const PXU = 1.35;       // pixels da imagem por unidade de arte
const FRAME_W = 120, FRAME_H = 150, FOOT_Y = 128; // quadro em unidades de arte (pés em FOOT_Y)

(function init3D() {
  if (typeof THREE === 'undefined') return;
  try {
    const W = Math.round(FRAME_W * PXU), H = Math.round(FRAME_H * PXU);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(W, H, false);
    renderer.setClearColor(0x000000, 0);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    const scene = new THREE.Scene();
    // câmera ortográfica isométrica (inclinação de 30°, como o mapa)
    const wU = FRAME_W / U, hU = FRAME_H / U;
    const footFromTop = FOOT_Y / U;
    const cam = new THREE.OrthographicCamera(-wU / 2, wU / 2, footFromTop, footFromTop - hU, -20, 20);
    const el = Math.PI / 6;
    cam.position.set(0, Math.sin(el) * 10, Math.cos(el) * 10);
    cam.lookAt(0, 0, 0);
    // o ponto (0,0,0) deve cair nos pés: ajusta o frustum pela projeção
    cam.updateMatrixWorld(); cam.updateProjectionMatrix();
    const v = new THREE.Vector3(0, 0, 0).project(cam);
    const shiftY = (v.y + 1) / 2 * hU - (hU - footFromTop);
    cam.top -= shiftY; cam.bottom -= shiftY; cam.updateProjectionMatrix();
    // luzes de estúdio: principal quente (cima/esquerda), preenchimento frio e contraluz
    scene.add(new THREE.HemisphereLight(0xcfd8ff, 0x3a2e22, 0.55));
    const key = new THREE.DirectionalLight(0xfff0d8, 2.1); key.position.set(-4, 7, 5); scene.add(key);
    const fill = new THREE.DirectionalLight(0x8aa8ff, 0.55); fill.position.set(5, 2, 3); scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffe6c0, 1.2); rim.position.set(2, 4, -6); scene.add(rim);
    // ambiente para reflexos do metal (céu claro em cima, chão escuro embaixo)
    const ec = document.createElement('canvas'); ec.width = 64; ec.height = 32;
    const ex = ec.getContext('2d'), eg = ex.createLinearGradient(0, 0, 0, 32);
    eg.addColorStop(0, '#dfe8f4'); eg.addColorStop(0.48, '#a8b4c4'); eg.addColorStop(0.52, '#5a4a3a'); eg.addColorStop(1, '#1a1410');
    ex.fillStyle = eg; ex.fillRect(0, 0, 64, 32);
    ex.fillStyle = 'rgba(255,240,200,0.9)'; ex.beginPath(); ex.arc(18, 8, 4, 0, 7); ex.fill();
    const envTex = new THREE.CanvasTexture(ec); envTex.mapping = THREE.EquirectangularReflectionMapping; envTex.encoding = THREE.sRGBEncoding;
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromEquirectangular(envTex).texture;
    Object.assign(R3, { ok: true, renderer, scene, cam, W, H });
  } catch (e) { console.warn('3D indisponível:', e); }
})();

// ---------- materiais ----------
const MATS = new Map();
function mat(hex, kind = 'cloth', extra = {}) {
  const key = hex + kind + JSON.stringify(extra);
  let m = MATS.get(key);
  if (m) return m;
  const base = { color: new THREE.Color(hex).convertSRGBToLinear() };
  const P = {
    metal: { metalness: 0.9, roughness: 0.32 }, gold: { metalness: 1, roughness: 0.25 }, darkmetal: { metalness: 0.85, roughness: 0.45 },
    leather: { metalness: 0.05, roughness: 0.72 }, cloth: { metalness: 0, roughness: 0.92 }, skin: { metalness: 0, roughness: 0.62 },
    wood: { metalness: 0, roughness: 0.8 }, fur: { metalness: 0, roughness: 1 }, bone: { metalness: 0, roughness: 0.7 }, slime: { metalness: 0.1, roughness: 0.15, transparent: true, opacity: 0.82 },
    hair: { metalness: 0.05, roughness: 0.55 }, gem: { metalness: 0.2, roughness: 0.1 },
  }[kind] || {};
  m = new THREE.MeshStandardMaterial({ ...base, ...P, ...extra });
  if (extra.emissive) m.emissive = new THREE.Color(extra.emissive).convertSRGBToLinear();
  MATS.set(key, m);
  return m;
}
// geometrias reutilizadas
const GEO = {};
function geo(name, make) { return GEO[name] || (GEO[name] = make()); }
const capG = (r, len) => geo('cap' + r + '_' + len, () => new THREE.CapsuleGeometry(r, len, 6, 12));
const sphG = (r) => geo('sph' + r, () => new THREE.SphereGeometry(r, 20, 14));
const cylG = (r1, r2, h, s = 14) => geo(`cyl${r1}_${r2}_${h}_${s}`, () => new THREE.CylinderGeometry(r1, r2, h, s));
const boxG = (x, y, z) => geo(`box${x}_${y}_${z}`, () => new THREE.BoxGeometry(x, y, z));
const coneG = (r, h, s = 14) => geo(`cone${r}_${h}_${s}`, () => new THREE.ConeGeometry(r, h, s));
const torG = (r, t, arc = Math.PI * 2) => geo(`tor${r}_${t}_${arc}`, () => new THREE.TorusGeometry(r, t, 8, 24, arc));
function mesh(g, m, x = 0, y = 0, z = 0) { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); return o; }
function joint(parent, x, y, z) { const j = new THREE.Group(); j.position.set(x, y, z); parent.add(j); return j; }

// ---------- montagem do humanoide ----------
// L = visual (heroLook / NPC_LOOKS), com tons em .hex
function buildHumanoid(L, opts = {}) {
  const S = opts.scale || 1;
  const root = new THREE.Group();
  const hips = joint(root, 0, 0.95 * S, 0);
  const spine = joint(hips, 0, 0.02 * S, 0);
  const R = {};
  const hx = h => (h && h.hex) || h || '#888888';
  const armorK = L.armor === 'plate' ? (L.pattern === 'scales' ? 'darkmetal' : (L.head === 'winged' ? 'gold' : 'metal')) : L.armor === 'leather' ? 'leather' : 'cloth';
  const bodyM = mat(hx(L.body), armorK), body2M = mat(hx(L.body2), L.armor === 'plate' ? 'leather' : 'leather');
  const skinM = mat(hx(L.skin), 'skin'), legM = mat(hx(L.legs), L.armor === 'plate' ? armorK : 'cloth'), bootM = mat(hx(L.boots), 'leather');
  const accM = mat(hx(L.accent), 'cloth'), trimM = mat(hx(L.trim), 'gold');
  const robe = L.armor === 'robe';
  // tronco
  const chest = joint(spine, 0, 0.28 * S, 0);
  const torso = mesh(capG(0.17 * S, 0.3 * S), bodyM, 0, 0.02 * S, 0); torso.scale.set(1.15, 1, 0.75); chest.add(torso);
  const belly = mesh(capG(0.14 * S, 0.12 * S), bodyM, 0, -0.2 * S, 0); belly.scale.set(1.1, 1, 0.75); spine.add(belly);
  const belt = mesh(cylG(0.165 * S, 0.165 * S, 0.06 * S), body2M, 0, -0.06 * S, 0); belt.scale.set(1.05, 1, 0.78); spine.add(belt);
  const buckle = mesh(boxG(0.06 * S, 0.05 * S, 0.02 * S), trimM, 0, -0.06 * S, 0.13 * S); spine.add(buckle);
  if (L.armor === 'plate') {
    const tab = mesh(boxG(0.16 * S, 0.5 * S, 0.02 * S), accM, 0, -0.08 * S, 0.135 * S); chest.add(tab);
    const em = mesh(boxG(0.07 * S, 0.07 * S, 0.012 * S), trimM, 0, 0.06 * S, 0.15 * S); em.rotation.z = Math.PI / 4; chest.add(em);
  }
  if (L.armor === 'vest') { const ap = mesh(boxG(0.22 * S, 0.5 * S, 0.02 * S), body2M, 0, -0.12 * S, 0.12 * S); chest.add(ap); }
  if (robe) {
    const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(new THREE.Vector2(0.17 + t * t * 0.17 + t * 0.05, -t * 0.82)); }
    const rg = geo('robe' + S, () => new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p.x * S, p.y * S)), 20));
    const rb = mesh(rg, mat(hx(L.body), 'cloth'), 0, -0.04 * S, 0); rb.scale.set(1, 1, 0.82); spine.add(rb);
    const hem = mesh(torG(0.38 * S, 0.018 * S), trimM, 0, -0.86 * S, 0); hem.rotation.x = Math.PI / 2; hem.scale.set(1, 0.82, 1); spine.add(hem);
    R.robe = rb;
  }
  // pescoço e cabeça
  const neckJ = joint(chest, 0, 0.27 * S, 0);
  neckJ.add(mesh(cylG(0.055 * S, 0.06 * S, 0.1 * S), skinM, 0, 0.03 * S, 0));
  const head = joint(neckJ, 0, 0.16 * S, 0);
  buildHead(head, L, S, skinM, accM, trimM);
  // braços
  const arm = (side) => {
    const sh = joint(chest, side * 0.22 * S, 0.17 * S, 0);
    const up = mesh(capG(robe ? 0.07 * S : 0.058 * S, 0.2 * S), robe ? mat(hx(L.body), 'cloth') : (L.armor === 'plate' ? bodyM : mat(hx(L.armor === 'vest' ? '#cfc6b4' : L.body.hex || L.body), L.armor === 'leather' ? 'leather' : 'cloth')), 0, -0.14 * S, 0); sh.add(up);
    if (L.pauldron) {
      const pM = L.pauldron === 'wing' ? trimM : bodyM;
      const pd = mesh(sphG(0.11 * S), pM, side * 0.02 * S, 0.0, 0); pd.scale.set(1.15, 0.8, 1); sh.add(pd);
      if (L.pauldron === 'spike') for (let k = 0; k < 2; k++) { const sp = mesh(coneG(0.025 * S, 0.12 * S, 8), bodyM, side * (0.03 + k * 0.04) * S, 0.1 * S, (k - 0.5) * 0.06 * S); sp.rotation.z = -side * 0.4; sh.add(sp); }
      if (L.pauldron === 'wing') { const wg = mesh(boxG(0.02 * S, 0.14 * S, 0.1 * S), mat('#f4efe2', 'cloth'), side * 0.1 * S, 0.1 * S, 0); wg.rotation.z = -side * 0.5; sh.add(wg); }
    }
    const el = joint(sh, 0, -0.29 * S, 0);
    const fM = L.armor === 'plate' ? bodyM : L.armor === 'leather' ? body2M : robe ? mat(hx(L.body), 'cloth') : skinM;
    el.add(mesh(capG(robe ? 0.075 * S : 0.05 * S, 0.18 * S), fM, 0, -0.12 * S, 0));
    if (robe) { const cuff = mesh(torG(0.075 * S, 0.012 * S), trimM, 0, -0.22 * S, 0); cuff.rotation.x = Math.PI / 2; el.add(cuff); }
    const hand = joint(el, 0, -0.27 * S, 0);
    hand.add(mesh(sphG(0.045 * S), L.armor === 'plate' ? bodyM : skinM, 0, 0, 0));
    return { sh, el, hand };
  };
  R.A = arm(-1); R.B = arm(1);
  // pernas
  const leg = (side) => {
    const hp = joint(hips, side * 0.1 * S, 0, 0);
    hp.add(mesh(capG(0.075 * S, 0.3 * S), legM, 0, -0.21 * S, 0));
    const kn = joint(hp, 0, -0.43 * S, 0);
    if (L.armor === 'plate') kn.add(mesh(sphG(0.065 * S), bodyM, 0, 0, 0.03 * S));
    kn.add(mesh(capG(0.062 * S, 0.24 * S), legM, 0, -0.17 * S, 0));
    const boot = mesh(capG(0.068 * S, 0.14 * S), bootM, 0, -0.3 * S, 0); kn.add(boot);
    const ft = joint(kn, 0, -0.43 * S, 0);
    const foot = mesh(boxG(0.1 * S, 0.07 * S, 0.22 * S), bootM, 0, 0.02 * S, 0.05 * S); ft.add(foot);
    return { hp, kn, ft };
  };
  R.LA = leg(-1); R.LB = leg(1);
  // capa (malha que dobra conforme o movimento)
  if (L.cape) {
    const cg = new THREE.PlaneGeometry(0.5 * S, 1.05 * S, 4, 10);
    cg.translate(0, -0.52 * S, 0);
    const cape = new THREE.Mesh(cg, mat(hx(L.capeTone), 'cloth', { side: THREE.DoubleSide }));
    cape.position.set(0, 0.24 * S, -0.13 * S); chest.add(cape);
    R.cape = cape; R.capeBase = Float32Array.from(cg.attributes.position.array);
  }
  // aljava
  if (L.quiver) {
    const q = mesh(cylG(0.06 * S, 0.05 * S, 0.5 * S), mat('#5a3a22', 'leather'), 0.08 * S, 0, -0.16 * S); q.rotation.z = -0.35; chest.add(q);
    for (let k = 0; k < 5; k++) { const ar = mesh(cylG(0.006 * S, 0.006 * S, 0.12 * S, 5), mat('#e8e2d0', 'cloth'), 0.15 * S + (k - 2) * 0.012 * S, 0.27 * S, -0.16 * S + (k % 2) * 0.02 * S); ar.rotation.z = -0.35; chest.add(ar); const fl = mesh(boxG(0.025 * S, 0.04 * S, 0.004 * S), mat('#a83226', 'cloth'), 0.16 * S + (k - 2) * 0.012 * S, 0.32 * S, -0.16 * S + (k % 2) * 0.02 * S); fl.rotation.z = -0.35; chest.add(fl); }
  }
  // arma e escudo
  R.weapon = buildWeapon(L, S, trimM);
  if (R.weapon) R.A.hand.add(R.weapon.obj);
  if (L.shield) { const sh = buildShield(L, S, accM, trimM); sh.position.set(0.02 * S, 0, 0.09 * S); R.B.hand.add(sh); R.shield = sh; }
  Object.assign(R, { root, hips, spine, chest, head, neckJ });
  return R;
}

function buildHead(head, L, S, skinM, accM, trimM) {
  const hx = h => (h && h.hex) || h || '#888888';
  const skull = mesh(sphG(0.105 * S), skinM, 0, 0, 0); skull.scale.set(0.92, 1.05, 1); head.add(skull);
  const jaw = mesh(sphG(0.08 * S), skinM, 0, -0.05 * S, 0.02 * S); jaw.scale.set(0.9, 0.85, 1); head.add(jaw);
  const nose = mesh(coneG(0.018 * S, 0.05 * S, 6), skinM, 0, -0.01 * S, 0.1 * S); nose.rotation.x = Math.PI / 2; head.add(nose);
  for (const s of [-1, 1]) { head.add(mesh(sphG(0.014 * S), mat('#f2ece0', 'skin'), s * 0.035 * S, 0.015 * S, 0.088 * S)); head.add(mesh(sphG(0.008 * S), mat(hx(L.eyes ? '#1a140e' : '#1a140e'), 'gem'), s * 0.035 * S, 0.015 * S, 0.1 * S)); head.add(mesh(boxG(0.04 * S, 0.008 * S, 0.01 * S), mat(hx(L.hair || '#3a2a1e'), 'hair'), s * 0.036 * S, 0.04 * S, 0.095 * S)); head.add(mesh(sphG(0.025 * S), skinM, s * 0.1 * S, 0, 0)); }
  const hairM = mat(hx(L.hair || '#3a2a1e'), 'hair');
  const helm = L.head === 'greathelm' || L.head === 'horned' || L.head === 'winged';
  const hood = ['hood', 'furhood', 'astralhood', 'antlerhood'].includes(L.head);
  if (L.hair && !helm && !hood) {
    const cap = mesh(sphG(0.112 * S), hairM, 0, 0.02 * S, -0.01 * S); cap.scale.set(0.95, 0.9, 1.02); head.add(cap);
    cap.geometry = geo('hairCap' + S, () => new THREE.SphereGeometry(0.112 * S, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.55));
    if (L.hairStyle === 'long') { const back = mesh(capG(0.09 * S, 0.22 * S), hairM, 0, -0.12 * S, -0.05 * S); back.scale.set(1.1, 1, 0.6); head.add(back); }
  }
  if (L.beard) { const b = mesh(coneG(0.075 * S, 0.16 * S, 12), mat(hx(L.beard), 'hair'), 0, -0.12 * S, 0.05 * S); b.rotation.x = Math.PI; head.add(b); }
  if (L.scar) head.add(mesh(boxG(0.006 * S, 0.05 * S, 0.006 * S), mat('#9a5444', 'skin'), 0.05 * S, 0.0, 0.098 * S));
  const H = hx(L.headTone);
  if (helm) {
    const hm = L.head === 'winged' ? mat(H, 'gold') : L.head === 'horned' ? mat(H, 'darkmetal') : mat(H, 'metal');
    const g = mesh(cylG(0.118 * S, 0.122 * S, 0.24 * S, 20), hm, 0, 0.0, 0); head.add(g);
    head.add(mesh(sphG(0.118 * S), hm, 0, 0.12 * S, 0));
    head.add(mesh(boxG(0.17 * S, 0.018 * S, 0.02 * S), mat('#0c0a08', 'cloth'), 0, 0.015 * S, 0.115 * S));
    head.add(mesh(boxG(0.012 * S, 0.12 * S, 0.012 * S), hm, 0, -0.04 * S, 0.124 * S));
    if (L.head === 'greathelm') { const pl = mesh(capG(0.03 * S, 0.22 * S), mat(hx(L.plume), 'cloth'), 0, 0.26 * S, -0.08 * S); pl.rotation.x = -0.9; head.add(pl); }
    if (L.head === 'horned') for (const s of [-1, 1]) { const hn = mesh(coneG(0.035 * S, 0.22 * S, 10), mat('#d6c9aa', 'bone'), s * 0.15 * S, 0.12 * S, 0); hn.rotation.z = -s * 0.9; head.add(hn); }
    if (L.head === 'winged') for (const s of [-1, 1]) { const wg = mesh(boxG(0.012 * S, 0.16 * S, 0.12 * S), mat('#f4efe2', 'cloth'), s * 0.13 * S, 0.12 * S, -0.02 * S); wg.rotation.z = -s * 0.5; head.add(wg); }
  } else if (hood) {
    const hm = mat(H, L.head === 'furhood' ? 'fur' : 'cloth');
    const hd = mesh(geo('hood' + S, () => new THREE.SphereGeometry(0.13 * S, 20, 14, Math.PI * 0.62, Math.PI * 1.76, 0, Math.PI * 0.75)), hm, 0, 0.01 * S, -0.005 * S); head.add(hd);
    const drape = mesh(coneG(0.16 * S, 0.22 * S, 16), hm, 0, -0.14 * S, -0.03 * S); head.add(drape);
    if (L.head === 'furhood') { const rim = mesh(torG(0.1 * S, 0.025 * S), mat('#ecebe6', 'fur'), 0, 0, 0.08 * S); head.add(rim); for (const s of [-1, 1]) { const ear = mesh(coneG(0.03 * S, 0.07 * S, 6), mat('#ecebe6', 'fur'), s * 0.07 * S, 0.14 * S, 0); head.add(ear); } }
    if (L.head === 'astralhood') { const c = mesh(torG(0.108 * S, 0.008 * S), mat('#d8c070', 'gold', { emissive: '#6a5a20' }), 0, 0.05 * S, 0.01 * S); c.rotation.x = Math.PI / 2 - 0.2; head.add(c); head.add(mesh(sphG(0.014 * S), mat('#bfe3ff', 'gem', { emissive: '#4a8ac8' }), 0, 0.06 * S, 0.115 * S)); }
    if (L.head === 'antlerhood') for (const s of [-1, 1]) { const a1 = mesh(cylG(0.01 * S, 0.014 * S, 0.22 * S, 6), mat('#c8b48c', 'bone'), s * 0.08 * S, 0.2 * S, 0); a1.rotation.z = -s * 0.5; head.add(a1); const a2 = mesh(cylG(0.007 * S, 0.01 * S, 0.12 * S, 6), mat('#c8b48c', 'bone'), s * 0.15 * S, 0.26 * S, 0.02 * S); a2.rotation.z = -s * 1.1; head.add(a2); const a3 = mesh(cylG(0.006 * S, 0.009 * S, 0.1 * S, 6), mat('#c8b48c', 'bone'), s * 0.1 * S, 0.3 * S, 0); a3.rotation.z = s * 0.2; head.add(a3); }
  } else if (L.head === 'circlet') {
    const c = mesh(torG(0.105 * S, 0.008 * S), mat(hx(L.trim), 'gold'), 0, 0.04 * S, 0.01 * S); c.rotation.x = Math.PI / 2 - 0.15; head.add(c);
    head.add(mesh(sphG(0.013 * S), mat('#6fe0a8', 'gem', { emissive: '#2a8a5a' }), 0, 0.05 * S, 0.11 * S));
    for (const s of [-1, 1]) { const ear = mesh(coneG(0.02 * S, 0.07 * S, 6), skinM, s * 0.105 * S, 0.02 * S, -0.01 * S); ear.rotation.z = -s * 1.2; head.add(ear); }
  } else if (L.head === 'wizard') {
    const hm = mat(H, 'cloth');
    const brim = mesh(cylG(0.21 * S, 0.21 * S, 0.015 * S, 24), hm, 0, 0.07 * S, 0); head.add(brim);
    const cone = mesh(coneG(0.12 * S, 0.36 * S, 18), hm, 0, 0.25 * S, -0.03 * S); cone.rotation.x = -0.25; head.add(cone);
    const band = mesh(cylG(0.122 * S, 0.122 * S, 0.03 * S, 18), mat(hx(L.trim), 'gold'), 0, 0.09 * S, 0); head.add(band);
  } else if (L.head === 'cap') {
    const hm = mat(H, 'cloth'); head.add(mesh(cylG(0.15 * S, 0.15 * S, 0.012 * S, 20), hm, 0, 0.07 * S, 0.02 * S)); const top = mesh(sphG(0.11 * S), hm, 0, 0.09 * S, 0); top.scale.set(1, 0.55, 1); head.add(top);
    const fe = mesh(capG(0.01 * S, 0.14 * S), mat('#a8382a', 'cloth'), -0.08 * S, 0.17 * S, -0.04 * S); fe.rotation.z = 0.6; head.add(fe);
  } else if (L.head === 'helm') {
    const hm = mat(H, 'metal'); const top = mesh(sphG(0.12 * S), hm, 0, 0.04 * S, 0); top.scale.set(1, 0.85, 1); head.add(top); head.add(mesh(cylG(0.16 * S, 0.16 * S, 0.012 * S, 20), hm, 0, 0.02 * S, 0)); head.add(mesh(boxG(0.012 * S, 0.1 * S, 0.012 * S), hm, 0, -0.02 * S, 0.12 * S));
  }
}

function buildWeapon(L, S, trimM) {
  const k = L.weapon; if (!k) return null;
  const obj = new THREE.Group(); // aponta para -Y (para baixo) na mão
  const W = { obj };
  if (k === 'sword' || k === 'darkblade' || k === 'goldsword') {
    const len = (k === 'darkblade' ? 0.95 : 0.85) * S;
    const bladeM = k === 'darkblade' ? mat('#2a2224', 'darkmetal', { emissive: '#3a0a06' }) : k === 'goldsword' ? mat('#e8e8ee', 'metal', { emissive: '#3a3010' }) : mat('#cfd4dc', 'metal');
    const guardM = k === 'goldsword' ? mat('#e2b74e', 'gold') : k === 'darkblade' ? mat('#5a1818', 'darkmetal') : mat('#9a7a3a', 'gold');
    obj.add(mesh(cylG(0.018 * S, 0.02 * S, 0.16 * S, 8), mat('#3a2414', 'leather'), 0, 0.06 * S, 0));
    obj.add(mesh(sphG(0.03 * S), guardM, 0, 0.15 * S, 0));
    obj.add(mesh(boxG(0.22 * S, 0.03 * S, 0.04 * S), guardM, 0, -0.03 * S, 0));
    const blade = mesh(boxG(0.055 * S, len, 0.012 * S), bladeM, 0, -0.04 * S - len / 2, 0); obj.add(blade);
    const tip = mesh(coneG(0.04 * S, 0.1 * S, 4), bladeM, 0, -0.04 * S - len - 0.04 * S, 0); tip.rotation.x = Math.PI; tip.scale.set(1, 1, 0.25); obj.add(tip);
    if (k === 'darkblade') obj.add(mesh(boxG(0.008 * S, len, 0.014 * S), mat('#ff5a2a', 'gem', { emissive: '#e0401a' }), 0.026 * S, -0.04 * S - len / 2, 0));
  } else if (k === 'staff' || k === 'starstaff' || k === 'druidstaff') {
    const poleM = k === 'starstaff' ? mat('#b8c0cc', 'metal') : mat(k === 'druidstaff' ? '#5a4028' : '#6b4a2b', 'wood');
    obj.add(mesh(cylG(0.022 * S, 0.026 * S, 1.6 * S, 8), poleM, 0, -0.25 * S, 0));
    const orbC = L.orb || '#7fb2ff';
    const orbM = mat(orbC, 'gem', { emissive: orbC, emissiveIntensity: 1.4 });
    if (k === 'starstaff') { const o = mesh(geo('oct' + S, () => new THREE.OctahedronGeometry(0.08 * S)), orbM, 0, -1.12 * S, 0); o.scale.set(0.7, 1.2, 0.7); obj.add(o); }
    else { obj.add(mesh(sphG(0.065 * S), orbM, 0, -1.12 * S, 0)); }
    if (k === 'staff') for (let a = 0; a < 3; a++) { const cl = mesh(cylG(0.008 * S, 0.008 * S, 0.12 * S, 5), trimM, Math.cos(a * 2.1) * 0.05 * S, -1.07 * S, Math.sin(a * 2.1) * 0.05 * S); cl.rotation.z = Math.cos(a * 2.1) * 0.5; obj.add(cl); }
    if (k === 'druidstaff') for (let a = 0; a < 6; a++) { const lf = mesh(sphG(0.03 * S), mat(a % 2 ? '#5aa23a' : '#7cc24a', 'cloth'), Math.cos(a) * 0.08 * S, -1.04 * S - (a % 3) * 0.03 * S, Math.sin(a) * 0.08 * S); lf.scale.set(1, 0.4, 1.6); obj.add(lf); }
    // o cajado é segurado no meio, com o cristal para cima: inverte
    W.flip = false;
  } else if (k === 'bow' || k === 'frostbow' || k === 'elfbow') {
    const bm = k === 'frostbow' ? mat('#c4d8e8', 'gem', { emissive: '#3a6a8a' }) : k === 'elfbow' ? mat('#d8b450', 'gold') : mat('#6e4320', 'wood');
    const arc = mesh(torG(0.55 * S, 0.018 * S, Math.PI * 0.62), bm, 0, 0, 0);
    arc.rotation.z = Math.PI / 2 - Math.PI * 0.31; arc.position.set(0, 0, -0.42 * S);
    const bowG = new THREE.Group(); bowG.add(arc); bowG.rotation.y = Math.PI / 2;
    obj.add(bowG);
    const strM = new THREE.LineBasicMaterial({ color: 0xe6e0cc });
    const sg = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]);
    const str = new THREE.Line(sg, strM); obj.add(str);
    const arrow = mesh(cylG(0.008 * S, 0.008 * S, 0.7 * S, 5), mat('#d4c8a6', 'wood'), 0, 0, 0); obj.add(arrow); arrow.visible = false;
    W.bow = { arc, str, arrow, r: 0.55 * S };
  } else if (k === 'axe') {
    obj.add(mesh(cylG(0.02 * S, 0.022 * S, 0.8 * S, 8), mat('#4a3020', 'wood'), 0, -0.25 * S, 0));
    const shp = new THREE.Shape(); shp.moveTo(0, 0.12); shp.quadraticCurveTo(0.2, 0.1, 0.24, -0.02); shp.quadraticCurveTo(0.2, -0.16, 0, -0.14); shp.closePath();
    const ag = geo('axe' + S, () => { const g2 = new THREE.ExtrudeGeometry(shp, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.01, bevelSegments: 1 }); g2.scale(S, S, S); return g2; });
    const blade = mesh(ag, mat('#6a5a4a', 'darkmetal'), 0.02 * S, -0.6 * S, -0.01 * S); blade.rotation.y = Math.PI / 2; obj.add(blade);
  } else if (k === 'club') {
    const cl = mesh(cylG(0.09 * S, 0.035 * S, 0.9 * S, 10), mat('#5a3e26', 'wood'), 0, -0.4 * S, 0); obj.add(cl);
    for (let i = 0; i < 8; i++) { const sp = mesh(coneG(0.018 * S, 0.07 * S, 5), mat('#a8a29e', 'bone'), Math.cos(i) * 0.08 * S, (-0.62 - (i % 3) * 0.08) * S, Math.sin(i) * 0.08 * S); sp.rotation.z = -Math.cos(i) * 1.4; sp.rotation.x = Math.sin(i) * 1.4; obj.add(sp); }
  } else if (k === 'rustsword' || k === 'dagger') {
    const len = (k === 'dagger' ? 0.32 : 0.8) * S, bm = mat('#7a5a44', 'darkmetal');
    obj.add(mesh(cylG(0.016 * S, 0.018 * S, 0.14 * S, 8), mat('#3a2414', 'leather'), 0, 0.05 * S, 0));
    obj.add(mesh(boxG(0.16 * S, 0.025 * S, 0.035 * S), bm, 0, -0.03 * S, 0));
    obj.add(mesh(boxG(0.05 * S, len, 0.012 * S), bm, 0, -0.04 * S - len / 2, 0));
    for (let i = 0; i < 3; i++) obj.add(mesh(boxG(0.02 * S, 0.03 * S, 0.014 * S), mat('#4a2a1a', 'darkmetal'), 0.02 * S, -0.1 * S - i * len * 0.3, 0));
  } else if (k === 'spear') {
    obj.add(mesh(cylG(0.018 * S, 0.018 * S, 1.8 * S, 8), mat('#6b4a2b', 'wood'), 0, 0.2 * S, 0));
    const tip = mesh(coneG(0.04 * S, 0.18 * S, 6), mat('#cfd4dc', 'metal'), 0, 1.18 * S, 0); obj.add(tip);
    obj.rotation.x = Math.PI; W.flip = true;
  } else if (k === 'hammer') {
    obj.add(mesh(cylG(0.016 * S, 0.016 * S, 0.45 * S, 8), mat('#6b4a2b', 'wood'), 0, -0.12 * S, 0));
    const hd = mesh(boxG(0.18 * S, 0.08 * S, 0.08 * S), mat('#5a5c62', 'darkmetal'), 0, -0.34 * S, 0); obj.add(hd);
  } else if (k === 'book') {
    const b = mesh(boxG(0.16 * S, 0.2 * S, 0.04 * S), mat('#5a1a1c', 'leather'), 0, -0.04 * S, 0.06 * S); obj.add(b);
  } else if (k === 'mug') {
    obj.add(mesh(cylG(0.045 * S, 0.04 * S, 0.1 * S, 12), mat('#8a5424', 'wood'), 0, -0.02 * S, 0.05 * S));
    obj.add(mesh(cylG(0.043 * S, 0.043 * S, 0.02 * S, 12), mat('#f2ead8', 'cloth'), 0, 0.035 * S, 0.05 * S));
  }
  return W;
}
function buildShield(L, S, accM, trimM) {
  const g = new THREE.Group(), k = L.shield;
  if (k === 'sun') {
    g.add(mesh(cylG(0.24 * S, 0.24 * S, 0.035 * S, 28), mat('#e2b74e', 'gold'), 0, 0, 0));
    g.add(mesh(cylG(0.2 * S, 0.2 * S, 0.04 * S, 28), mat('#ece6d4', 'metal'), 0, 0, 0.002 * S));
    g.add(mesh(cylG(0.07 * S, 0.07 * S, 0.05 * S, 16), mat('#f0d070', 'gold', { emissive: '#6a5010' }), 0, 0, 0));
    g.children.forEach(c => c.rotation.x = Math.PI / 2);
  } else {
    const shp = new THREE.Shape(); shp.moveTo(-0.2, 0.25); shp.lineTo(0.2, 0.25); shp.lineTo(0.2, 0.0); shp.quadraticCurveTo(0.18, -0.2, 0, -0.34); shp.quadraticCurveTo(-0.18, -0.2, -0.2, 0); shp.closePath();
    const eg = geo('kite' + S, () => { const e = new THREE.ExtrudeGeometry(shp, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.015, bevelSegments: 2 }); e.scale(S, S, S); e.translate(0, 0, -0.02 * S); return e; });
    const field = k === 'dragon' ? mat('#3a1a1c', 'darkmetal') : mat((L.accent && L.accent.hex) || '#8b2e2e', 'leather');
    g.add(mesh(eg, field));
    const rimShape = mesh(eg, k === 'dragon' ? mat('#24120f', 'darkmetal') : trimM, 0, 0, -0.012 * S); rimShape.scale.set(1.08, 1.06, 1); g.add(rimShape);
    if (k === 'dragon') g.add(mesh(sphG(0.04 * S), mat('#ff5a2a', 'gem', { emissive: '#e0401a', emissiveIntensity: 1.5 }), 0, 0.02 * S, 0.03 * S));
    else { g.add(mesh(boxG(0.03 * S, 0.42 * S, 0.02 * S), trimM, 0, -0.03 * S, 0.03 * S)); g.add(mesh(boxG(0.3 * S, 0.03 * S, 0.02 * S), trimM, 0, 0.08 * S, 0.03 * S)); }
  }
  return g;
}

// ---------- pose: aplica os ângulos (mesma lógica de buildPose) ----------
function applyPose(R, Q, P, walkPh) {
  const set = (o, x = 0, y = 0, z = 0) => { o.rotation.set(x, y, z, 'XZY'); };
  set(R.spine, Q.tl, Q.tw, 0);
  set(R.head, Q.ht * 0.8, Q.hw * 0.6, 0);
  // braços: pitch (θ), abertura (φ), cotovelo (β). A = direito (-x), B = esquerdo (+x)
  set(R.A.sh, -Q.aA[0], 0, -Q.aA[1]); set(R.A.el, -Math.max(0, Q.aA[2]) + Math.min(0, Q.aA[2]) * -1 * -1, 0, 0);
  set(R.B.sh, -Q.aB[0], 0, Q.aB[1]); set(R.B.el, -Math.max(0, Q.aB[2]) + Math.min(0, Q.aB[2]) * -1 * -1, 0, 0);
  R.A.el.rotation.x = -Q.aA[2]; R.B.el.rotation.x = -Q.aB[2];
  set(R.LA.hp, -Q.lA[0], 0, 0); R.LA.kn.rotation.x = -Q.lA[1];
  set(R.LB.hp, -Q.lB[0], 0, 0); R.LB.kn.rotation.x = -Q.lB[1];
  R.LA.ft.rotation.x = Q.lA[0] + Q.lA[1]; R.LB.ft.rotation.x = Q.lB[0] + Q.lB[1];
  // arma: ângulo absoluto no plano do corpo
  if (R.weapon) {
    const rel = Q.wp - (Q.aA[0] + Q.aA[2]);
    if (R.weapon.bow) {
      R.weapon.obj.rotation.set(-rel + Math.PI, 0, 0);
      const b = R.weapon.bow, r = b.r, pull = Q.pull || 0;
      const top = new THREE.Vector3(0, r * 0.82, -r * 0.42 + r * 0.42), bot = new THREE.Vector3(0, -r * 0.82, 0);
      const mid = new THREE.Vector3(0, 0, -0.02 - pull * 0.5);
      b.str.geometry.setFromPoints([new THREE.Vector3(0, r * 0.81, -0.03), mid, new THREE.Vector3(0, -r * 0.81, -0.03)]);
      b.arrow.visible = pull > 0.05; b.arrow.rotation.x = Math.PI / 2; b.arrow.position.set(0, 0, 0.32 - pull * 0.5);
    } else R.weapon.obj.rotation.x = (R.weapon.flip ? Math.PI : 0) - rel;
  }
  // capa: dobra para trás conforme o movimento
  if (R.cape) {
    const pos = R.cape.geometry.attributes.position, base = R.capeBase, sway = (P.walk >= 0 ? 0.32 : 0.1) + Math.sin(walkPh) * 0.05;
    for (let i = 0; i < pos.count; i++) {
      const y = base[i * 3 + 1], t = -y / 1.05;
      const bx = base[i * 3]; pos.setXYZ(i, bx * (1 + t * 0.3), y * Math.cos(sway * t * 0.6), -Math.sin(sway * t) * t * 0.5 - t * 0.06 + (bx * bx) * 1.6 * (1 - t * 0.5) + Math.sin(t * 9 + bx * 20) * 0.012);
    }
    pos.needsUpdate = true; R.cape.geometry.computeVertexNormals();
  }
  if (R.robe) R.robe.rotation.z = Math.sin(walkPh) * (P.walk >= 0 ? 0.05 : 0);
}

// ---------- foto do modelo ----------
const _rigs = new Map();
const tmpV = typeof THREE !== 'undefined' ? new THREE.Vector3() : null;
function shoot3D(R, dir, extraRotX) {
  const { renderer, scene, cam, W, H } = R3;
  // direção na tela -> giro do modelo
  const a = dir * Math.PI / 4, yaw = Math.atan2(0.5 * Math.sin(a), Math.cos(a));
  R.root.rotation.set(0, yaw, 0);
  if (extraRotX) { R.root.rotation.set(extraRotX, yaw, 0, 'YXZ'); }
  // apoia o pé mais baixo no chão
  R.root.position.set(0, 0, 0);
  R.root.updateMatrixWorld(true);
  if (!extraRotX) {
    let minY = Infinity;
    for (const f of [R.LA.ft, R.LB.ft]) { f.getWorldPosition(tmpV); minY = Math.min(minY, tmpV.y); }
    R.root.position.y = -minY + 0.035;
  } else R.root.position.y = 0.12;
  scene.add(R.root);
  renderer.render(scene, cam);
  scene.remove(R.root);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  c.getContext('2d').drawImage(renderer.domElement, 0, 0);
  return { c, w: FRAME_W, h: FRAME_H, ax: FRAME_W / 2, ay: FOOT_Y, painted: true, hd: true };
}
const SPR3 = new Map();
R3.budget = 99; R3.last = new Map();
// limite de imagens 3D novas por quadro: sem engasgos; enquanto isso usa a última imagem pronta
function cache3(key, make, who) {
  let s = SPR3.get(key);
  if (s) { SPR3.delete(key); SPR3.set(key, s); if (who) R3.last.set(who, s); return s; }
  if (R3.budget <= 0 && who && R3.last.has(who)) return R3.last.get(who);
  R3.budget--;
  s = make(); SPR3.set(key, s); if (who) R3.last.set(who, s);
  if (SPR3.size > 900) SPR3.delete(SPR3.keys().next().value);
  return s;
}
function rigFor(key, L, opts) { let r = _rigs.get(key); if (!r) { r = buildHumanoid(L, opts); _rigs.set(key, r); } return r; }
function pose3Key(P) { return (P.dir | 0) + '|' + (P.walk >= 0 ? 'w' + P.walk : '') + (P.act ? P.act.k + P.act.f : '') + (P.idle ? P.idle.k + P.idle.f : '') + (P.sit ? 's' : '') + (P.carry ? 'c' : '') + (P.down ? 'd' : ''); }
function heroSprite3D(cls, skin, color, P) {
  const lk = cls + ':' + skin + ':' + color;
  return cache3('h3|' + lk + '|' + pose3Key(P) , () => {
    const L = lookFor(lk, () => heroLook(cls, skin, color));
    let R = _rigs.get(lk); if (!R) { R = buildHumanoid(L); epicHero(R, L, 1, skin); _rigs.set(lk, R); }
    const Q = buildPose(cls, P);
    applyPose(R, Q, P, P.walk >= 0 ? P.walk / 12 * Math.PI * 2 : 0);
    return shoot3D(R, P.dir | 0, P.down ? -Math.PI / 2 : 0);
  }, 'h|' + lk + (P.down ? 'd' : '') + (P.dir | 0));
}
function npcSprite3D(kind, P) {
  return cache3('n3|' + kind + '|' + pose3Key(P), () => {
    const L = lookFor('npc:' + kind, NPC_LOOKS[kind]);
    const R = rigFor('npc:' + kind, L);
    const Q = buildPose(NPC_CLS[kind] || 'knight', P);
    applyPose(R, Q, P, 0);
    return shoot3D(R, P.dir | 0, 0);
  }, 'n|' + kind + (P.dir | 0));
}

// ---------- monstros ----------
const MON_LOOK = {
  goblin: () => ({ skin: tone('#6f8e3a'), hair: null, armor: 'leather', body: tone('#5a4028'), body2: tone('#3a2814'), accent: tone('#4a3020'), legs: tone('#4a3a2a'), boots: tone('#2a1d12'), trim: tone('#8a7a4a'), head: 'none', weapon: 'dagger', eyes: '#e8d040', capeTone: tone('#3a2a1e') }),
  skeleton: () => ({ skin: tone('#ddd6c2'), hair: null, armor: 'cloth', body: tone('#cfc8b2'), body2: tone('#6a5a40'), accent: tone('#4a3a2a'), legs: tone('#d6cfba'), boots: tone('#a8a08a'), trim: tone('#8a7a50'), head: 'none', weapon: 'rustsword', shield: null, capeTone: tone('#3a3028') }),
  orc: () => ({ skin: tone('#5e7f42'), hair: tone('#1c1c1c'), armor: 'plate', body: tone('#5a5e66'), body2: tone('#3a2614'), accent: tone('#6a1a14'), legs: tone('#3d2b1a'), boots: tone('#27180d'), trim: tone('#8a6a34'), head: 'horned', headTone: tone('#4b4f57'), weapon: 'axe', pauldron: 'spike', capeTone: tone('#3a1a14') }),
  troll: () => ({ skin: tone('#7b8794'), hair: null, armor: 'cloth', body: tone('#57534e'), body2: tone('#292524'), accent: tone('#44403c'), legs: tone('#44403c'), boots: tone('#7b8794'), trim: tone('#5a5248'), head: 'none', weapon: 'club', capeTone: tone('#3a3630') }),
};
const MON_SCALE = { goblin: 0.72, skeleton: 0.98, orc: 1.18, troll: 1.7 };
function buildCreature(type) {
  const root = new THREE.Group(), R = { root, legs: [], type };
  const body = new THREE.Group(); root.add(body); R.body = body;
  const legJ = (x, z, len, r, m) => { const j = joint(body, x, 0, z); j.add(mesh(capG(r, len), m, 0, -len / 2, 0)); R.legs.push(j); return j; };
  switch (type) {
    case 'rat': {
      const fur = mat('#7a6e64', 'fur'), pink = mat('#d99a96', 'skin');
      body.position.y = 0.16;
      const b = mesh(sphG(0.2), fur, 0, 0, 0); b.scale.set(0.8, 0.7, 1.35); body.add(b);
      const hd = mesh(sphG(0.11), fur, 0, 0.03, 0.27); hd.scale.set(0.85, 0.8, 1.2); body.add(hd);
      body.add(mesh(sphG(0.025), pink, 0, 0.03, 0.4));
      for (const s of [-1, 1]) { body.add(mesh(sphG(0.045), pink, s * 0.07, 0.11, 0.23)); body.add(mesh(sphG(0.014), mat('#100c08', 'gem'), s * 0.05, 0.07, 0.35)); }
      const tail = mesh(cylG(0.012, 0.006, 0.45, 6), pink, 0, 0.0, -0.45); tail.rotation.x = Math.PI / 2 + 0.3; body.add(tail);
      for (const [x, z] of [[-0.1, 0.15], [0.1, 0.15], [-0.1, -0.15], [0.1, -0.15]]) legJ(x, z, 0.1, 0.025, fur).position.y = -0.06;
      break;
    }
    case 'slime': {
      const m = mat('#5fa04a', 'slime');
      body.position.y = 0.2;
      const b = mesh(sphG(0.3), m, 0, 0, 0); b.scale.set(1, 0.7, 1); body.add(b); R.blob = b;
      body.add(mesh(sphG(0.12), mat('#2e6a24', 'slime', { opacity: 0.9 }), 0.03, -0.03, 0));
      for (const s of [-1, 1]) body.add(mesh(sphG(0.03), mat('#0c1a0a', 'gem'), s * 0.09, 0.08, 0.24));
      break;
    }
    case 'wolf': {
      const fur = mat('#6a6e76', 'fur'), dark = mat('#45484e', 'fur');
      body.position.y = 0.5;
      const b = mesh(capG(0.17, 0.5), fur, 0, 0, 0); b.rotation.x = Math.PI / 2; body.add(b);
      const neck = mesh(capG(0.12, 0.14), fur, 0, 0.12, 0.36); neck.rotation.x = 0.9; body.add(neck);
      const hd = joint(body, 0, 0.2, 0.48); R.head = hd;
      const sk = mesh(sphG(0.12), fur, 0, 0, 0); sk.scale.set(0.9, 0.85, 1.1); hd.add(sk);
      const snout = mesh(coneG(0.07, 0.2, 10), dark, 0, -0.03, 0.17); snout.rotation.x = Math.PI / 2; hd.add(snout);
      for (const s of [-1, 1]) { const ear = mesh(coneG(0.04, 0.1, 6), dark, s * 0.07, 0.12, -0.02); hd.add(ear); hd.add(mesh(sphG(0.016), mat('#e0b040', 'gem', { emissive: '#6a4a10' }), s * 0.05, 0.03, 0.1)); }
      const tail = mesh(capG(0.05, 0.3), fur, 0, 0.05, -0.45); tail.rotation.x = -0.9; body.add(tail);
      for (const [x, z] of [[-0.1, 0.25], [0.1, 0.25], [-0.1, -0.25], [0.1, -0.25]]) legJ(x, z, 0.4, 0.045, dark);
      break;
    }
    case 'spider': {
      const sh = mat('#2e2824', 'leather');
      body.position.y = 0.35;
      const ab = mesh(sphG(0.28), sh, 0, 0.05, -0.25); ab.scale.set(1, 0.85, 1.2); body.add(ab);
      const mark = mesh(boxG(0.1, 0.02, 0.18), mat('#a82a1e', 'cloth'), 0, 0.29, -0.25); mark.rotation.y = Math.PI / 4; body.add(mark);
      body.add(mesh(sphG(0.15), sh, 0, 0, 0.12));
      for (let i = 0; i < 4; i++) body.add(mesh(sphG(0.022), mat('#e0402a', 'gem', { emissive: '#8a1a0a' }), (i % 2 ? 1 : -1) * 0.04, 0.06 + Math.floor(i / 2) * 0.04, 0.25));
      for (let i = 0; i < 8; i++) {
        const s = i < 4 ? -1 : 1, k = i % 4, j = joint(body, s * 0.1, 0.02, 0.18 - k * 0.12);
        const up = mesh(cylG(0.02, 0.018, 0.38, 6), sh, s * 0.17, 0.1, 0); up.rotation.z = s * 1.0; j.add(up);
        const lo = mesh(cylG(0.016, 0.01, 0.45, 6), sh, s * 0.38, -0.12, 0); lo.rotation.z = -s * 0.35; j.add(lo);
        R.legs.push(j);
      }
      break;
    }
    case 'toad': {
      const sk = mat('#6a7638', 'skin'), bel = mat('#cdb87a', 'skin');
      body.position.y = 0.25;
      const b = mesh(sphG(0.32), sk, 0, 0, 0); b.scale.set(1.1, 0.75, 1); body.add(b);
      const bl = mesh(sphG(0.24), bel, 0, -0.08, 0.12); bl.scale.set(1, 0.6, 0.9); body.add(bl); R.sac = bl;
      for (const s of [-1, 1]) { body.add(mesh(sphG(0.08), sk, s * 0.13, 0.2, 0.15)); body.add(mesh(sphG(0.05), mat('#e0b040', 'gem'), s * 0.14, 0.24, 0.2)); }
      for (let i = 0; i < 10; i++) body.add(mesh(sphG(0.025), mat('#4a5226', 'skin'), (Math.sin(i * 7) * 0.25), 0.15 + Math.cos(i * 3) * 0.06, Math.cos(i * 5) * 0.2));
      const tongue = mesh(cylG(0.025, 0.025, 0.6, 6), mat('#c43a4a', 'skin'), 0, -0.02, 0.5); tongue.rotation.x = Math.PI / 2; tongue.visible = false; body.add(tongue); R.tongue = tongue;
      for (const [x, z] of [[-0.25, -0.1], [0.25, -0.1], [-0.18, 0.2], [0.18, 0.2]]) legJ(x, z, 0.15, 0.06, sk);
      break;
    }
  }
  return R;
}
function monSprite3D(type, f, atk, dir, hurt = -1) {
  return cache3(`m3|${type}|${f}|${atk}|${dir}|${hurt}`, () => {
    if (MON_LOOK[type]) {
      let R = _rigs.get('mon:' + type); if (!R) { R = buildHumanoid(lookFor('mon:' + type, MON_LOOK[type]), { scale: MON_SCALE[type] }); scaryMonster(type, R, MON_SCALE[type]); _rigs.set('mon:' + type, R); }
      const P = { dir, walk: atk >= 0 || hurt >= 0 ? -1 : (f >= 0 ? Math.round(f * 1.5) : -1), act: hurt >= 0 ? { k: 'hurt', f: hurt } : atk >= 0 ? { k: type === 'troll' || type === 'orc' ? 'bash' : 'swing', f: Math.min(11, Math.round(atk * 1.5)) } : null };
      const Q = buildPose('knight', P);
      if (type === 'troll') Q.tl += 0.25;
      if (type === 'goblin') Q.tl += 0.15;
      applyPose(R, Q, P, P.walk >= 0 ? P.walk / 12 * Math.PI * 2 : 0);
      return shoot3D(R, dir, 0);
    }
    let C = _rigs.get('crt:' + type);
    if (!C) { C = buildCreature(type); scaryCreature(type, C); _rigs.set('crt:' + type, C); }
    const ph = f / 8 * Math.PI * 2, lunge = atk >= 0 ? Math.sin(atk / 7 * Math.PI) : 0;
    C.legs.forEach((j, i) => { j.rotation.x = Math.sin(ph + (i % 2 ? Math.PI : 0) + (i >= 2 ? Math.PI : 0)) * (f >= 0 && atk < 0 ? 0.5 : 0.05); });
    C.body.position.z = lunge * 0.18;
    C.body.rotation.x = lunge * 0.15;
    if (C.head) C.head.rotation.x = -lunge * 0.4;
    if (C.blob) C.blob.scale.set(1 + lunge * 0.15 + Math.sin(ph) * 0.05, 0.7 - lunge * 0.1 - Math.sin(ph) * 0.05, 1 + lunge * 0.1);
    if (C.sac) C.sac.scale.set(1, 0.6 + Math.abs(Math.sin(ph)) * 0.2, 0.9);
    if (C.tongue) C.tongue.visible = lunge > 0.3;
    const { renderer, scene, cam, W, H } = R3;
    const a = dir * Math.PI / 4, yaw = Math.atan2(0.5 * Math.sin(a), Math.cos(a));
    C.root.rotation.set(0, yaw, 0); C.root.position.set(0, 0, 0);
    scene.add(C.root); renderer.render(scene, cam); scene.remove(C.root);
    const c = document.createElement('canvas'); c.width = W; c.height = H; c.getContext('2d').drawImage(renderer.domElement, 0, 0);
    return { c, w: FRAME_W, h: FRAME_H, ax: FRAME_W / 2, ay: FOOT_Y, painted: true, hd: true };
  }, 'm|' + type + dir);
}

// ---------- armaduras épicas (enfeites por cima do modelo base) ----------
function epicHero(R, L, S, skin) {
  const hx = h => (h && h.hex) || h || '#888888';
  const gold = mat(hx(L.trim), 'gold'), body = mat(hx(L.body), L.armor === 'plate' ? (skin === 'dragon' ? 'darkmetal' : skin === 'sun' ? 'gold' : 'metal') : L.armor === 'leather' ? 'leather' : 'cloth');
  const glow = c => mat(c, 'gem', { emissive: c, emissiveIntensity: 1.6 });
  const runeC = { dragon: '#ff4a1a', sun: '#ffd860', iron: '#7ab0ff', scout: '#9ad87a', winter: '#9ad8ff', sylvan: '#6fe0a8', adept: '#8ab8ff', astral: '#c8e0ff', druid: '#8ee07a' }[skin] || '#ffd860';
  const ch = R.chest, sp = R.spine;
  if (L.armor === 'plate') {
    // ombreiras em camadas, gorjal, faixas douradas, saiote de placas, joia no peito
    for (const [arm, side] of [[R.A, -1], [R.B, 1]]) {
      for (let k = 0; k < 3; k++) { const p = mesh(sphG((0.13 - k * 0.018) * S), k === 0 ? body : gold, side * 0.03 * S, (-0.03 - k * 0.055) * S, 0); p.scale.set(1.3, 0.55, 1.15); arm.sh.add(p); }
      const fl = mesh(coneG(0.07 * S, 0.1 * S, 10), body, 0, -0.21 * S, 0); fl.rotation.x = Math.PI; arm.el.add(fl);
      { const r = mesh(torG(0.065 * S, 0.012 * S), gold, 0, -0.17 * S, 0); r.rotation.x = Math.PI / 2; arm.el.add(r); }
    }
    const gorget = mesh(torG(0.09 * S, 0.035 * S), body, 0, 0.24 * S, 0); gorget.rotation.x = Math.PI / 2; ch.add(gorget);
    for (const y of [0.16, -0.12]) { const band = mesh(torG(0.19 * S, 0.012 * S), gold, 0, y * S, 0); band.rotation.x = Math.PI / 2; band.scale.set(1.08, 0.72, 1); ch.add(band); }
    for (let k = 0; k < 6; k++) { const a = -Math.PI / 2 + (k - 2.5) * 0.5; const t = mesh(boxG(0.11 * S, 0.17 * S, 0.02 * S), k % 2 ? body : gold, Math.cos(a) * 0.17 * S, -0.17 * S, -Math.sin(a) * 0.13 * S); t.rotation.y = -a - Math.PI / 2; t.rotation.x = 0.15; sp.add(t); }
    ch.add(mesh(sphG(0.035 * S), glow(runeC), 0, 0.04 * S, 0.16 * S));
    for (const leg of [R.LA, R.LB]) { const kp = mesh(coneG(0.04 * S, 0.12 * S, 8), body, 0, 0.0, 0.1 * S); kp.rotation.x = Math.PI / 2; leg.kn.add(kp); }
    if (skin === 'dragon') {
      for (let k = 0; k < 5; k++) { const sp2 = mesh(coneG(0.03 * S, 0.12 * S, 6), mat('#2a1416', 'darkmetal'), 0, (0.22 - k * 0.1) * S, -0.15 * S); sp2.rotation.x = -1.1; ch.add(sp2); }
      for (let k = 0; k < 3; k++) ch.add(mesh(boxG(0.005 * S, 0.12 * S, 0.004 * S), glow(runeC), (k - 1) * 0.05 * S, -0.02 * S, 0.165 * S));
    }
    if (skin === 'sun') {
      const halo = mesh(torG(0.13 * S, 0.012 * S), glow('#ffe08a'), 0, 0.3 * S, -0.04 * S); halo.rotation.x = Math.PI / 2 - 0.3; R.head.add(halo);
      for (const s of [-1, 1]) for (let k = 0; k < 4; k++) { const f = mesh(boxG(0.012 * S, 0.34 * S - k * 0.05 * S, 0.09 * S), mat('#f6f1e4', 'cloth'), s * (0.1 + k * 0.05) * S, (0.2 + k * 0.04) * S, -0.18 * S); f.rotation.z = -s * (0.5 + k * 0.15); f.rotation.x = -0.3; ch.add(f); }
    }
    if (skin === 'iron') { const crest = mesh(boxG(0.015 * S, 0.12 * S, 0.24 * S), mat(hx(L.plume), 'cloth'), 0, 0.26 * S, -0.02 * S); R.head.add(crest); }
  } else if (L.armor === 'leather') {
    for (let k = 0; k < 10; k++) ch.add(mesh(sphG(0.012 * S), mat('#b8b0a0', 'metal'), Math.sin(k * 1.7) * 0.12 * S, (0.15 - (k % 5) * 0.06) * S, 0.135 * S));
    const collar = mesh(torG(0.13 * S, 0.05 * S), mat(skin === 'winter' ? '#f2f2ee' : '#6a4a2a', 'fur'), 0, 0.22 * S, -0.01 * S); collar.rotation.x = Math.PI / 2; ch.add(collar);
    for (const arm of [R.A, R.B]) { arm.el.add(mesh(cylG(0.06 * S, 0.06 * S, 0.12 * S, 12), mat('#4a3020', 'leather'), 0, -0.14 * S, 0)); { const r = mesh(torG(0.061 * S, 0.008 * S), gold, 0, -0.09 * S, 0); r.rotation.x = Math.PI / 2; arm.el.add(r); } }
    for (const s of [-1, 1]) sp.add(mesh(boxG(0.07 * S, 0.08 * S, 0.05 * S), mat('#5a3a22', 'leather'), s * 0.13 * S, -0.1 * S, 0.08 * S));
    if (skin === 'winter') for (const arm of [R.A, R.B]) { const m = mesh(sphG(0.13 * S), mat('#ecebe6', 'fur'), 0, 0, 0); m.scale.set(1.2, 0.7, 1.1); arm.sh.add(m); arm.sh.add(mesh(geo('ice' + S, () => new THREE.OctahedronGeometry(0.035 * S)), glow(runeC), 0, 0.08 * S, 0)); }
    if (skin === 'sylvan') for (const [arm, side] of [[R.A, -1], [R.B, 1]]) { for (let k = 0; k < 3; k++) { const lf = mesh(coneG(0.05 * S, 0.18 * S, 6), gold, side * (0.04 + k * 0.03) * S, (0.04 - k * 0.04) * S, (k - 1) * 0.05 * S); lf.rotation.z = -side * (1.2 + k * 0.2); lf.scale.set(1, 1, 0.3); arm.sh.add(lf); } arm.sh.add(mesh(sphG(0.025 * S), glow(runeC), side * 0.05 * S, 0.06 * S, 0.04 * S)); }
    if (skin === 'scout') { const cl = mesh(coneG(0.24 * S, 0.3 * S, 16), mat(hx(L.accent), 'cloth'), 0, 0.12 * S, -0.02 * S); cl.scale.set(1, 1, 0.8); ch.add(cl); }
  } else if (L.armor === 'robe') {
    const collar = mesh(cylG(0.16 * S, 0.12 * S, 0.14 * S, 16, 1, true), mat(hx(L.body2), 'cloth', { side: THREE.DoubleSide }), 0, 0.3 * S, -0.03 * S); ch.add(collar);
    const mantle = mesh(coneG(0.3 * S, 0.26 * S, 18), mat(hx(L.body2), 'cloth'), 0, 0.12 * S, 0); mantle.scale.set(1, 1, 0.85); ch.add(mantle);
    const mt = mesh(torG(0.28 * S, 0.012 * S), gold, 0, 0.0, 0); mt.rotation.x = Math.PI / 2; mt.scale.set(1, 0.85, 1); ch.add(mt);
    ch.add(mesh(sphG(0.04 * S), glow(runeC), 0, 0.05 * S, 0.16 * S));
    for (let k = 0; k < 4; k++) sp.add(mesh(boxG(0.005 * S, 0.12 * S, 0.004 * S), glow(runeC), 0, (-0.25 - k * 0.15) * S, (0.21 + k * 0.035) * S));
    if (skin === 'astral') for (let k = 0; k < 16; k++) sp.add(mesh(sphG(0.008 * S), glow('#e8f0ff'), Math.sin(k * 2.3) * 0.25 * S, (-0.1 - (k % 8) * 0.08) * S, Math.cos(k * 2.3) * 0.22 * S));
    if (skin === 'druid') for (const arm of [R.A, R.B]) for (let k = 0; k < 6; k++) arm.sh.add(mesh(sphG(0.04 * S), mat(k % 2 ? '#4a6a2a' : '#5e8236', 'cloth'), Math.sin(k) * 0.07 * S, 0.04 * S, Math.cos(k) * 0.07 * S));
    if (skin === 'adept') { const gem = mesh(sphG(0.025 * S), glow(runeC), 0, 0.1 * S, 0.12 * S); R.head.add(gem); }
  }
}

// ---------- monstros sombrios ----------
function scaryMonster(type, R, S) {
  const glowEye = c => mat(c, 'gem', { emissive: c, emissiveIntensity: 2 });
  const rust = mat('#6a4a32', 'darkmetal'), bone = mat('#d6cfba', 'bone');
  const head = R.head, ch = R.chest, sp = R.spine;
  if (type === 'skeleton') {
    for (let k = 0; k < 4; k++) { const rib = mesh(torG(0.13 * S, 0.012 * S, Math.PI * 1.4), bone, 0, (0.14 - k * 0.07) * S, 0.0); rib.rotation.set(Math.PI / 2, 0, Math.PI * 0.8); rib.scale.set(1.05, 0.75, 1); ch.add(rib); }
    for (const s of [-1, 1]) head.add(mesh(sphG(0.022 * S), glowEye('#ff6a1a'), s * 0.035 * S, 0.015 * S, 0.095 * S));
    const pd = mesh(sphG(0.12 * S), rust, -0.02 * S, 0, 0); pd.scale.set(1.2, 0.6, 1.1); R.A.sh.add(pd);
    const rag = mesh(boxG(0.3 * S, 0.3 * S, 0.01 * S), mat('#3a3028', 'cloth', { side: THREE.DoubleSide }), 0, -0.25 * S, 0.12 * S); sp.add(rag);
  }
  if (type === 'orc') {
    for (const s of [-1, 1]) { const tk = mesh(coneG(0.018 * S, 0.08 * S, 6), bone, s * 0.04 * S, -0.06 * S, 0.09 * S); head.add(tk); head.add(mesh(sphG(0.016 * S), glowEye('#ff3a2a'), s * 0.035 * S, 0.015 * S, 0.1 * S)); }
    head.add(mesh(boxG(0.008 * S, 0.07 * S, 0.008 * S), mat('#8a4a3a', 'skin'), 0.05 * S, 0.02 * S, 0.1 * S));
    for (let k = 0; k < 4; k++) { const pl = mesh(boxG(0.12 * S, 0.1 * S, 0.02 * S), k % 2 ? rust : mat('#4a4e56', 'darkmetal'), (k % 2 ? 0.07 : -0.06) * S, (0.12 - k * 0.08) * S, 0.14 * S); pl.rotation.z = (k - 1.5) * 0.25; ch.add(pl); }
    for (let k = 0; k < 5; k++) ch.add(mesh(sphG(0.02 * S), bone, Math.cos(k) * 0.12 * S, 0.24 * S, 0.06 * S + Math.sin(k) * 0.05 * S));
  }
  if (type === 'troll') {
    for (let k = 0; k < 9; k++) { const m = mesh(sphG(0.06 * S), mat(k % 2 ? '#3f5a22' : '#4d6a2a', 'fur'), Math.sin(k * 2) * 0.16 * S, (0.2 - k * 0.04) * S, -0.08 * S + Math.cos(k * 2) * 0.08 * S); m.scale.set(1.3, 0.5, 1); ch.add(m); }
    for (let k = 0; k < 7; k++) { const bn = mesh(cylG(0.012 * S, 0.012 * S, 0.08 * S, 5), bone, Math.cos(k * 0.6 - 1.8) * 0.15 * S, 0.18 * S - Math.abs(k - 3) * 0.015 * S, Math.sin(k * 0.6 - 1.8) * 0.1 * S + 0.12 * S); bn.rotation.z = 0.3; ch.add(bn); }
    for (const s of [-1, 1]) head.add(mesh(sphG(0.018 * S), glowEye('#e0c040'), s * 0.04 * S, 0.01 * S, 0.1 * S));
    for (const s of [-1, 1]) head.add(mesh(coneG(0.022 * S, 0.1 * S, 6), bone, s * 0.05 * S, -0.07 * S, 0.08 * S));
  }
  if (type === 'goblin') {
    for (const s of [-1, 1]) { const ear = mesh(coneG(0.035 * S, 0.18 * S, 6), mat('#6f8e3a', 'skin'), s * 0.13 * S, 0.03 * S, -0.01 * S); ear.rotation.z = -s * 1.35; head.add(ear); head.add(mesh(sphG(0.016 * S), glowEye('#e8d040'), s * 0.035 * S, 0.015 * S, 0.1 * S)); }
    const nose = mesh(coneG(0.022 * S, 0.12 * S, 6), mat('#5f7e32', 'skin'), 0, -0.01 * S, 0.14 * S); nose.rotation.x = Math.PI / 2; head.add(nose);
    for (let k = 0; k < 4; k++) { const t = mesh(boxG(0.1 * S, 0.14 * S, 0.01 * S), mat('#4a3a26', 'cloth', { side: THREE.DoubleSide }), (k - 1.5) * 0.07 * S, -0.3 * S, 0.12 * S); t.rotation.z = (k - 1.5) * 0.2; sp.add(t); }
  }
}
function scaryCreature(type, C) {
  const glowEye = c => mat(c, 'gem', { emissive: c, emissiveIntensity: 2.2 });
  const tooth = mat('#ece6d4', 'bone');
  const b = C.body;
  if (type === 'wolf' && C.head) {
    for (let k = 0; k < 6; k++) { const t = mesh(coneG(0.012, 0.05, 5), tooth, (k - 2.5) * 0.018, -0.07, 0.2 + (k % 2) * 0.02); t.rotation.x = Math.PI; C.head.add(t); }
    for (const s of [-1, 1]) C.head.add(mesh(sphG(0.02), glowEye('#ff5a2a'), s * 0.05, 0.03, 0.1));
    for (let k = 0; k < 8; k++) { const m = mesh(coneG(0.03, 0.12, 5), mat('#3a3c42', 'fur'), (k % 2 - 0.5) * 0.06, 0.18 - k * 0.01, 0.25 - k * 0.07); m.rotation.x = -0.6; b.add(m); }
  }
  if (type === 'rat') { for (const s of [-1, 1]) b.add(mesh(sphG(0.016), glowEye('#ff3a2a'), s * 0.05, 0.07, 0.355)); b.add(mesh(boxG(0.03, 0.04, 0.01), tooth, 0, -0.01, 0.39)); }
  if (type === 'spider') {
    for (let k = 0; k < 40; k++) { const h = mesh(coneG(0.008, 0.06, 4), mat('#1e1a18', 'fur'), Math.sin(k * 2.4) * 0.24, 0.05 + Math.cos(k * 1.3) * 0.2, -0.25 + Math.cos(k * 2.4) * 0.28); h.lookAt(0, 0.05, -0.25); h.rotateX(-Math.PI / 2); b.add(h); }
    for (const s of [-1, 1]) { const f = mesh(coneG(0.02, 0.1, 6), tooth, s * 0.05, -0.06, 0.24); f.rotation.x = Math.PI * 0.85; b.add(f); }
    for (let i = 0; i < 4; i++) b.add(mesh(sphG(0.026), glowEye('#ff2a1a'), (i % 2 ? 1 : -1) * 0.045, 0.06 + Math.floor(i / 2) * 0.045, 0.255));
  }
  if (type === 'slime') { const sk = mesh(sphG(0.07), mat('#e2dcc6', 'bone'), -0.05, 0.02, 0.02); sk.scale.set(1, 0.9, 1); b.add(sk); { const bn = mesh(cylG(0.01, 0.01, 0.2, 5), mat('#e2dcc6', 'bone'), 0.08, -0.05, -0.05); bn.rotation.z = 1.1; b.add(bn); } }
  if (type === 'toad') { const mouth = mesh(boxG(0.4, 0.02, 0.05), mat('#3a1a14', 'skin'), 0, -0.02, 0.3); b.add(mouth); for (const s of [-1, 1]) b.add(mesh(sphG(0.02), glowEye('#e8c040'), s * 0.14, 0.27, 0.24)); }
}
