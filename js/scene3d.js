// ============================================================
//  CENÁRIO 3D "PRÉ-RENDERIZADO" — árvores, rochas, construções,
//  castelo e objetos do vilarejo são montados como modelos 3D
//  (com texturas de pedra, madeira, telha, palha e relevo),
//  iluminados por um sol fixo e fotografados de cima, no mesmo
//  ângulo do mapa. As fotos viram sprites 2D guardados em cache.
//  Unidades: 1 tile = 1 unidade; X = x do mapa, Z = y do mapa.
// ============================================================
const S3 = { ok: false, budget: 4, pin: new Set(), px: 0, pinPx: 0 };
const A3 = 32 * Math.SQRT2;                 // unidades de arte por unidade 3D (na horizontal da tela)
const HV = A3 * Math.cos(Math.PI / 6);      // unidades de arte por unidade de altura
const SRS = 3.4;                            // pixels da foto por unidade de arte
const h3 = art => art / HV;                 // altura em arte -> unidades 3D

(function initScene3D() {
  if (typeof THREE === 'undefined') return;
  try {
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setClearColor(0x000000, 0);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xb4c0d6, 0x5a4430, 0.55));
    const sun = new THREE.DirectionalLight(0xffcf94, 2.9);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02;
    scene.add(sun); scene.add(sun.target);
    const fill = new THREE.DirectionalLight(0x8aa0d0, 0.32); fill.position.set(6, 3, 2); scene.add(fill);
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
    const SUN = new THREE.Vector3(-0.9, 0.95, 0.5).normalize();
    const ec = document.createElement('canvas'); ec.width = 64; ec.height = 32;
    const ex = ec.getContext('2d'), eg = ex.createLinearGradient(0, 0, 0, 32);
    eg.addColorStop(0, '#dfe8f4'); eg.addColorStop(0.48, '#b0bccb'); eg.addColorStop(0.52, '#6a5a44'); eg.addColorStop(1, '#2a2218');
    ex.fillStyle = eg; ex.fillRect(0, 0, 64, 32);
    const envTex = new THREE.CanvasTexture(ec); envTex.mapping = THREE.EquirectangularReflectionMapping; envTex.encoding = THREE.sRGBEncoding;
    scene.environment = new THREE.PMREMGenerator(renderer).fromEquirectangular(envTex).texture;
    Object.assign(S3, { ok: true, renderer, scene, sun, cam, SUN });
  } catch (e) { console.warn('cenário 3D indisponível:', e); }
})();

// ---------- fotografa um modelo: a origem cai no ponto de apoio do sprite ----------
const _bb = typeof THREE !== 'undefined' ? new THREE.Box3() : null;
function shootScene(obj) {
  const { renderer, scene, sun, cam, SUN } = S3;
  scene.add(obj);
  obj.updateMatrixWorld(true);
  _bb.setFromObject(obj);
  const { min, max } = _bb;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let q = 0; q < 8; q++) {
    const x = q & 1 ? max.x : min.x, y = q & 2 ? max.y : min.y, z = q & 4 ? max.z : min.z;
    const sx = (x - z) * 32, sy = (x + z) * 16 - y * HV;
    x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
  }
  x0 = Math.floor(x0 - 2); y0 = Math.floor(y0 - 2); x1 = Math.ceil(x1 + 2); y1 = Math.ceil(y1 + 2);
  const w = x1 - x0, h = y1 - y0;
  const k = Math.min(SRS * (SET.quality === 'low' ? 0.6 : SET.quality === 'med' ? 0.8 : 1), 2800 / Math.max(w, h)), W = Math.max(2, Math.round(w * k)), H = Math.max(2, Math.round(h * k));
  // câmera: olha de (+x, +y) para baixo, 30° de inclinação (igual ao mapa)
  cam.position.set(60, 60 * Math.SQRT2 * Math.tan(Math.PI / 6), 60); cam.lookAt(0, 0, 0);
  cam.left = x0 / A3; cam.right = x1 / A3; cam.top = -y0 / A3; cam.bottom = -y1 / A3; cam.updateProjectionMatrix();
  // sombra do sol ajustada ao tamanho do modelo
  const c = new THREE.Vector3(), sz = new THREE.Vector3(); _bb.getCenter(c); _bb.getSize(sz);
  const r = sz.length() / 2 + 0.2;
  sun.position.copy(c).addScaledVector(SUN, r + 8); sun.target.position.copy(c); sun.target.updateMatrixWorld();
  const sc = sun.shadow.camera; sc.left = -r; sc.right = r; sc.top = r; sc.bottom = -r; sc.near = 0.5; sc.far = 2 * r + 16; sc.updateProjectionMatrix();
  renderer.setSize(W, H, false);
  renderer.render(scene, cam);
  scene.remove(obj);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  cv.getContext('2d').drawImage(renderer.domElement, 0, 0);
  disposeTree(obj);
  return { c: cv, w, h, ax: -x0, ay: -y0, painted: true, s3: true };
}
function disposeTree(o) { o.traverse(m => { if (m.geometry && !m.geometry.__keep) m.geometry.dispose(); }); }

// cache com limite de fotos novas por quadro (enquanto isso, usa o desenho pintado)
const SC3 = new Map();
function scen3(key, make) {
  if (!S3.ok) return null;
  let s = SC3.get(key);
  if (s !== undefined) { SC3.delete(key); SC3.set(key, s); if (S3.pinning && !S3.pin.has(key)) { S3.pin.add(key); if (s) { S3.px -= s.c.width * s.c.height; S3.pinPx += s.c.width * s.c.height; } } return s; }
  if (S3.budget <= 0) return null;
  S3.budget--;
  if (S3.pinning) S3.pin.add(key);
  try { s = shootScene(make()); } catch (e) { console.warn('cena3d', key, e); s = null; }
  SC3.set(key, s);
  if (s && !S3.pin.has(key)) S3.px = (S3.px || 0) + s.c.width * s.c.height;
  if (s && S3.pin.has(key)) S3.pinPx = (S3.pinPx || 0) + s.c.width * s.c.height;
  if (S3.px > 90e6) for (const [k0, s0] of SC3) { if (S3.px <= 70e6) break; if (S3.pin.has(k0)) continue; SC3.delete(k0); if (s0) S3.px -= s0.c.width * s0.c.height; }
  return s;
}

// ---------- texturas procedurais (cor + relevo) ----------
const CTX3 = {};
function canvasTex(kind) {
  if (CTX3[kind]) return CTX3[kind];
  const S = 512, c = document.createElement('canvas'), b = document.createElement('canvas');
  c.width = b.width = S; c.height = b.height = S;
  const x = c.getContext('2d'), y = b.getContext('2d'), R = rng(hashStr(kind));
  const both = (f) => { f(x, false); f(y, true); };
  const gray = v => { const q = Math.round(clamp(v, 0, 1) * 255); return `rgb(${q},${q},${q})`; };
  const noiseDots = (n, rmin, rmax, aC, aB) => { for (let i = 0; i < n; i++) { const px_ = R() * S, py = R() * S, r = rmin + R() * (rmax - rmin), v = R(); x.fillStyle = `rgba(${v < 0.5 ? '0,0,0' : '255,255,255'},${aC})`; x.beginPath(); x.arc(px_, py, r, 0, 7); x.fill(); y.fillStyle = `rgba(${v < 0.5 ? '0,0,0' : '255,255,255'},${aB})`; y.beginPath(); y.arc(px_, py, r, 0, 7); y.fill(); } };
  x.scale(2, 2); y.scale(2, 2);
  { const S = 256;
  x.fillStyle = '#c8c8c8'; x.fillRect(0, 0, S, S); y.fillStyle = gray(0.5); y.fillRect(0, 0, S, S);
  if (kind === 'brick' || kind === 'stoneblock') {
    const rows = kind === 'brick' ? 14 : 8, rh = S / rows;
    x.fillStyle = '#8a857c'; x.fillRect(0, 0, S, S); y.fillStyle = gray(0.15); y.fillRect(0, 0, S, S);
    for (let r = 0; r < rows; r++) {
      const cols = kind === 'brick' ? 6 : 4, cw = S / cols, off = r % 2 ? cw / 2 : 0;
      for (let k = -1; k < cols; k++) {
        const bx = k * cw + off + 2 + R() * 2, by = r * rh + 2, bw = cw - 4 - R() * 3, bh = rh - 4;
        const v = 0.66 + R() * 0.28, gs = x.createLinearGradient(bx, by, bx + bw * 0.3, by + bh);
        gs.addColorStop(0, gray(v + 0.1)); gs.addColorStop(0.55, gray(v)); gs.addColorStop(1, gray(v - 0.14));
        x.fillStyle = gs; x.beginPath(); x.roundRect ? x.roundRect(bx, by, bw, bh, 3 + R() * 3) : x.rect(bx, by, bw, bh); x.fill();
        for (let q = 0; q < 6; q++) { x.fillStyle = `rgba(${R() < 0.5 ? '0,0,0' : '255,250,240'},${0.05 + R() * 0.07})`; x.beginPath(); x.arc(bx + R() * bw, by + R() * bh, 1 + R() * 3, 0, 7); x.fill(); }
        if (R() < 0.18) { x.fillStyle = `rgba(80,100,50,${0.12 + R() * 0.15})`; x.beginPath(); x.ellipse(bx + R() * bw, by + bh * 0.8, 4 + R() * 8, 2 + R() * 3, 0, 0, 7); x.fill(); }
        const g = y.createLinearGradient(0, by, 0, by + bh); g.addColorStop(0, gray(0.85)); g.addColorStop(0.5, gray(0.75)); g.addColorStop(1, gray(0.55));
        y.fillStyle = g; y.beginPath(); y.roundRect ? y.roundRect(bx, by, bw, bh, 5) : y.rect(bx, by, bw, bh); y.fill();
      }
    }
    noiseDots(500, 0.5, 2.5, 0.12, 0.18);
    for (let i = 0; i < 18; i++) { const sx = R() * S, sy = R() * S; x.strokeStyle = 'rgba(0,0,0,0.25)'; x.lineWidth = 1; x.beginPath(); x.moveTo(sx, sy); x.lineTo(sx + (R() - 0.5) * 20, sy + R() * 14); x.stroke(); }
  } else if (kind === 'plaster') {
    noiseDots(1800, 1, 5, 0.04, 0.08);
    for (let i = 0; i < 10; i++) { const g = x.createRadialGradient(R() * S, R() * S, 0, R() * S, R() * S, 40 + R() * 60); g.addColorStop(0, 'rgba(120,100,70,0.12)'); g.addColorStop(1, 'rgba(120,100,70,0)'); x.fillStyle = g; x.fillRect(0, 0, S, S); }
  } else if (kind === 'wood' || kind === 'bark') {
    const planks = kind === 'wood' ? 5 : 1;
    for (let p = 0; p < planks; p++) {
      const pw = S / planks, v = 0.6 + R() * 0.3;
      x.fillStyle = gray(v); x.fillRect(p * pw, 0, pw, S);
      for (let i = 0; i < 40; i++) { const gx = p * pw + R() * pw; x.strokeStyle = `rgba(0,0,0,${0.08 + R() * 0.15})`; x.lineWidth = 0.6 + R() * (kind === 'bark' ? 3 : 1.2); x.beginPath(); x.moveTo(gx, 0); x.bezierCurveTo(gx + (R() - 0.5) * 8, S / 3, gx + (R() - 0.5) * 8, S * 2 / 3, gx, S); x.stroke(); y.strokeStyle = `rgba(0,0,0,${kind === 'bark' ? 0.5 : 0.2})`; y.lineWidth = x.lineWidth * (kind === 'bark' ? 1.6 : 1); y.beginPath(); y.moveTo(gx, 0); y.bezierCurveTo(gx + (R() - 0.5) * 8, S / 3, gx + (R() - 0.5) * 8, S * 2 / 3, gx, S); y.stroke(); }
      if (kind === 'wood') { x.fillStyle = 'rgba(0,0,0,0.5)'; x.fillRect(p * pw, 0, 2, S); y.fillStyle = gray(0); y.fillRect(p * pw, 0, 3, S); }
      if (kind === 'wood' && R() < 0.7) { const kx = p * pw + pw / 2, ky = R() * S; x.fillStyle = 'rgba(40,20,10,0.4)'; x.beginPath(); x.ellipse(kx, ky, 4, 7, 0, 0, 7); x.fill(); }
    }
  } else if (kind === 'shingle' || kind === 'slate') {
    const rows = 10, rh = S / rows, cols = kind === 'slate' ? 8 : 10;
    y.fillStyle = gray(0.1); y.fillRect(0, 0, S, S); x.fillStyle = '#555'; x.fillRect(0, 0, S, S);
    for (let r = rows - 1; r >= -1; r--) for (let k = -1; k <= cols; k++) {
      const cw = S / cols * (0.85 + R() * 0.3), bx = k * (S / cols) + (r % 2 ? S / cols / 2 : 0) + (R() - 0.5) * 2, by = r * rh + (R() - 0.5) * 1.5, v = 0.55 + R() * 0.4;
      x.fillStyle = gray(v); x.beginPath(); x.moveTo(bx + 1, by); x.lineTo(bx + cw - 1, by); x.lineTo(bx + cw - 1, by + rh * 1.3); x.quadraticCurveTo(bx + cw / 2, by + rh * 1.55, bx + 1, by + rh * 1.3); x.closePath(); x.fill();
      x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(bx + 1, by + rh * 1.2, cw - 2, 2);
      const g = y.createLinearGradient(0, by, 0, by + rh * 1.4); g.addColorStop(0, gray(0.3)); g.addColorStop(1, gray(0.95));
      y.fillStyle = g; y.beginPath(); y.moveTo(bx + 1, by); y.lineTo(bx + cw - 1, by); y.lineTo(bx + cw - 1, by + rh * 1.3); y.quadraticCurveTo(bx + cw / 2, by + rh * 1.55, bx + 1, by + rh * 1.3); y.closePath(); y.fill();
    }
    noiseDots(300, 0.5, 2, 0.15, 0.1);
    for (let i = 0; i < 30; i++) { x.fillStyle = `rgba(70,90,40,${0.1 + R() * 0.16})`; x.beginPath(); x.arc(R() * S, R() * S, 2 + R() * 6, 0, 7); x.fill(); }
    for (let i = 0; i < 14; i++) { const sx = R() * S; const g2 = x.createLinearGradient(0, 0, 0, S); g2.addColorStop(0, 'rgba(0,0,0,0)'); g2.addColorStop(0.5, `rgba(30,24,18,${0.06 + R() * 0.08})`); g2.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g2; x.fillRect(sx, 0, 6 + R() * 14, S); }
  } else if (kind === 'thatch') {
    x.fillStyle = '#9a9a9a'; x.fillRect(0, 0, S, S); y.fillStyle = gray(0.4); y.fillRect(0, 0, S, S);
    for (let i = 0; i < 2600; i++) { const px_ = R() * S, py = R() * S, l = 10 + R() * 22, v = 0.45 + R() * 0.55; x.strokeStyle = gray(v); x.lineWidth = 1 + R() * 1.5; x.beginPath(); x.moveTo(px_, py); x.lineTo(px_ + (R() - 0.5) * 3, py + l); x.stroke(); y.strokeStyle = gray(v); y.lineWidth = x.lineWidth; y.beginPath(); y.moveTo(px_, py); y.lineTo(px_ + (R() - 0.5) * 3, py + l); y.stroke(); }
    for (let r = 0; r < 9; r++) { const yy = r * S / 9 + (R() - 0.5) * 4; for (let k = 0; k < 14; k++) { const xx = k * S / 14 + (R() - 0.5) * 10; x.fillStyle = 'rgba(0,0,0,' + (0.06 + R() * 0.08) + ')'; x.beginPath(); x.ellipse(xx, yy + 3, 12 + R() * 8, 3, 0, 0, Math.PI); x.fill(); y.fillStyle = gray(0.2 + R() * 0.15); y.beginPath(); y.ellipse(xx, yy + 3, 12, 3, 0, 0, Math.PI); y.fill(); } }
  } else if (kind === 'rock') {
    for (let i = 0; i < 70; i++) { const g = x.createRadialGradient(R() * S, R() * S, 0, R() * S, R() * S, 20 + R() * 50); const v = R(); g.addColorStop(0, `rgba(${v < 0.5 ? '40,38,34' : '230,225,215'},0.2)`); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, S, S); }
    noiseDots(1200, 0.5, 2.5, 0.06, 0.18);
    for (let i = 0; i < 26; i++) { const sx = R() * S, sy = R() * S; for (const c2 of [x, y]) { c2.strokeStyle = 'rgba(0,0,0,0.45)'; c2.lineWidth = 1 + R(); c2.beginPath(); c2.moveTo(sx, sy); for (let k = 0; k < 4; k++) c2.lineTo(sx + (R() - 0.5) * 40, sy + (R() - 0.5) * 40); c2.stroke(); } }
  } else if (kind === 'flag') {
    for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) {
      const v = 0.55 + R() * 0.4; x.fillStyle = gray(v);
      x.fillRect(k * 64 + 3, r * 64 + 3, 58, 58); y.fillStyle = gray(0.8); y.fillRect(k * 64 + 3, r * 64 + 3, 58, 58);
    }
    noiseDots(400, 0.5, 2, 0.1, 0.15);
  } else if (kind === 'cloth') {
    for (let i = 0; i < S; i += 2) { x.fillStyle = `rgba(0,0,0,${0.04 + R() * 0.04})`; x.fillRect(0, i, S, 1); x.fillRect(i, 0, 1, S); }
    noiseDots(300, 1, 4, 0.05, 0.08);
  } else if (kind === 'stripes') {
    for (let k = 0; k < 8; k++) { x.fillStyle = k % 2 ? '#f2ead8' : '#a8302a'; x.fillRect(k * 32, 0, 32, S); }
    for (let i = 0; i < S; i += 2) { x.fillStyle = 'rgba(0,0,0,0.05)'; x.fillRect(0, i, S, 1); }
  } else if (kind === 'iron') {
    noiseDots(1500, 0.5, 3, 0.15, 0.3);
  }
  }
  const map = new THREE.CanvasTexture(c), bump = new THREE.CanvasTexture(b);
  for (const t of [map, bump]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; }
  map.encoding = THREE.sRGBEncoding;
  return CTX3[kind] = { map, bump };
}
const SMATS = new Map();
function smat(kind, hex, o = {}) {
  const key = kind + hex + JSON.stringify(o);
  let m = SMATS.get(key);
  if (m) return m;
  const p = { color: new THREE.Color(hex).convertSRGBToLinear(), roughness: o.rough ?? 0.9, metalness: o.metal ?? 0 };
  if (kind) { const t = canvasTex(kind); p.map = t.map; p.bumpMap = t.bump; p.bumpScale = o.bump ?? 1.2; }
  if (o.side) p.side = o.side;
  if (o.vc) p.vertexColors = true;
  if (o.alphaTest) { p.alphaTest = o.alphaTest; p.transparent = false; }
  if (o.leafMap) { p.map = o.leafMap; p.alphaTest = 0.5; p.side = THREE.DoubleSide; }
  if (o.emissive) { p.emissive = new THREE.Color(o.emissive).convertSRGBToLinear(); p.emissiveIntensity = o.ei ?? 1; }
  if (o.transparent) { p.transparent = true; p.opacity = o.opacity ?? 0.8; }
  m = new THREE.MeshStandardMaterial(p);
  SMATS.set(key, m);
  return m;
}
// textura de folhas (recorte com transparência)
let _leafTex = null, _needleTex = null;
function leafTex() {
  if (_leafTex) return _leafTex;
  const S = 128, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d'), R = rng(77);
  for (let i = 0; i < 90; i++) {
    const a = R() * Math.PI * 2, d = Math.sqrt(R()) * 52, px_ = 64 + Math.cos(a) * d, py = 64 + Math.sin(a) * d;
    const v = 0.55 + R() * 0.45, ang = R() * Math.PI * 2, l = 7 + R() * 5;
    x.save(); x.translate(px_, py); x.rotate(ang);
    x.fillStyle = `rgb(${Math.round(v * 225)},${Math.round(v * 245)},${Math.round(v * 200)})`;
    x.beginPath(); x.moveTo(0, -l); x.quadraticCurveTo(l * 0.55, 0, 0, l); x.quadraticCurveTo(-l * 0.55, 0, 0, -l); x.fill();
    x.strokeStyle = 'rgba(0,0,0,0.25)'; x.lineWidth = 0.6; x.beginPath(); x.moveTo(0, -l); x.lineTo(0, l); x.stroke();
    x.restore();
  }
  _leafTex = new THREE.CanvasTexture(c); _leafTex.encoding = THREE.sRGBEncoding;
  return _leafTex;
}
function needleTex() {
  if (_needleTex) return _needleTex;
  const S = 128, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d'), R = rng(78);
  x.lineCap = 'round';
  x.strokeStyle = '#5a4a3a'; x.lineWidth = 2; x.beginPath(); x.moveTo(64, 4); x.lineTo(64, 124); x.stroke();
  for (let i = 0; i < 260; i++) {
    const t = R(), py = 6 + t * 116, side = R() < 0.5 ? -1 : 1, l = (1 - Math.abs(t - 0.45)) * 46 * (0.6 + R() * 0.4), v = 0.5 + R() * 0.5;
    x.strokeStyle = `rgb(${Math.round(v * 200)},${Math.round(v * 240)},${Math.round(v * 210)})`; x.lineWidth = 1.2 + R();
    x.beginPath(); x.moveTo(64, py); x.lineTo(64 + side * l, py + l * 0.45); x.stroke();
  }
  _needleTex = new THREE.CanvasTexture(c); _needleTex.encoding = THREE.sRGBEncoding;
  return _needleTex;
}

// ---------- ajudantes de geometria ----------
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
function mk(g, m, cast = true) { const o = new THREE.Mesh(g, m); o.castShadow = cast; o.receiveShadow = true; return o; }
function grp(...a) { const g = new THREE.Group(); a.forEach(o => o && g.add(o)); return g; }
// UV pelo mundo (as texturas continuam de uma peça para outra)
function wuv(g, s = 1) {
  const p = g.attributes.position, n = g.attributes.normal, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i)), x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    let u, v;
    if (ay >= ax && ay >= az) { u = x; v = z; } else if (ax >= az) { u = z; v = y; } else { u = x; v = y; }
    uv[i * 2] = u * s; uv[i * 2 + 1] = v * s;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}
const BOX = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
const CYL = (r1, r2, h, x, y, z, s = 12) => new THREE.CylinderGeometry(r1, r2, h, s).translate(x, y, z);
function wbox(w, h, d, x, y, z, m, s = 1) { return mk(wuv(BOX(w, h, d, x, y, z), s), m); }
// deforma vértices com ruído (pedras, troncos irregulares)
function jitter(g, amt, seed, flatBottom) {
  const p = g.attributes.position, R = rng(seed), cache = new Map();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), key = `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
    let d = cache.get(key); if (!d) { d = [(R() - 0.5) * amt, (R() - 0.5) * amt, (R() - 0.5) * amt]; cache.set(key, d); }
    p.setXYZ(i, x + d[0], flatBottom && y <= flatBottom ? y : y + d[1], z + d[2]);
  }
  g.computeVertexNormals();
  return g;
}
// cores por vértice (musgo em cima, neve, etc.)
function vcolor(g, fn) {
  const p = g.attributes.position, n = g.attributes.normal, col = new Float32Array(p.count * 3), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) { fn(c, p.getX(i), p.getY(i), p.getZ(i), n.getY(i)); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
// cartões de folhas (planos com textura recortada), com normais "de copa" para luz macia
function leafCards(cards, center, size) {
  const pos = [], nor = [], uv = [], idx = [];
  const q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3();
  cards.forEach((cd, k) => {
    e.set(cd.rx, cd.ry, cd.rz); q.setFromEuler(e);
    const s = (cd.s || size) / 2, nn = V3(cd.x - center.x, (cd.y - center.y) * 1.2 + 0.35, cd.z - center.z).normalize();
    const corners = [[-s, -s, 0, 0], [s, -s, 1, 0], [s, s, 1, 1], [-s, s, 0, 1]];
    for (const [a, b, u, w] of corners) { v.set(a, b, 0).applyQuaternion(q); pos.push(cd.x + v.x, cd.y + v.y, cd.z + v.z); nor.push(nn.x, nn.y, nn.z); uv.push(u, w); }
    const o = k * 4; idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}
// copa: aglomerados de cartões numa elipse
function crown(R, cx, cy, cz, rx, ry, n, size, leafM, coreHex) {
  const cards = [];
  for (let i = 0; i < n; i++) {
    const a = R() * Math.PI * 2, el = Math.acos(R() * 2 - 1), d = 0.55 + Math.sqrt(R()) * 0.45;
    cards.push({ x: cx + Math.sin(el) * Math.cos(a) * rx * d, y: cy + Math.cos(el) * ry * d, z: cz + Math.sin(el) * Math.sin(a) * rx * d, rx: R() * 6, ry: R() * 6, rz: R() * 6, s: size * (0.75 + R() * 0.5) });
  }
  const g = grp(mk(leafCards(cards, V3(cx, cy, cz), size), leafM));
  if (coreHex) { const core = jitter(new THREE.IcosahedronGeometry(1, 1), 0.25, Math.floor(R() * 1e6)).scale(rx * 0.62, ry * 0.6, rx * 0.62).translate(cx, cy, cz); g.add(mk(core, smat(null, coreHex, { rough: 1 }))); }
  return g;
}
// galho/tronco afunilado entre dois pontos
function limb(a, b, r1, r2, m, seg = 7) {
  const d = new THREE.Vector3().subVectors(b, a), L = d.length();
  const g = new THREE.CylinderGeometry(r2, r1, L, seg, 3);
  const o = mk(g, m); o.position.copy(a).addScaledVector(d, 0.5);
  o.quaternion.setFromUnitVectors(V3(0, 1, 0), d.normalize());
  return o;
}

// ============================================================
//  VEGETAÇÃO E ROCHAS
// ============================================================
const LEAF_TINT = { 0: '#6a9a40', 1: '#78ac48', 2: '#d89a34', 3: '#4a7444' };
const CORE_TINT = { 0: '#2a4a1e', 1: '#305824', 2: '#6a4416', 3: '#1c3420' };
function mTree(v, tint) {
  const R = rng(101 + v * 13 + tint * 7), bark = smat('bark', '#6a5038', { bump: 2 });
  const g = grp();
  const top = V3((R() - 0.5) * 0.15, 1.15, (R() - 0.5) * 0.15);
  g.add(limb(V3(0, -0.05, 0), top, 0.15, 0.1, bark, 9));
  // raízes
  for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 + R(); g.add(limb(V3(0, 0.18, 0), V3(Math.cos(a) * 0.28, -0.02, Math.sin(a) * 0.28), 0.07, 0.025, bark, 6)); }
  // galhos e copas
  const leafM = smat(null, LEAF_TINT[tint] || LEAF_TINT[0], { leafMap: leafTex(), rough: 0.8 });
  const blobs = [[0, 1.9, 0, 0.78, 0.62]];
  for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + R() * 0.8, d = 0.45 + R() * 0.15; blobs.push([Math.cos(a) * d, 1.55 + R() * 0.55, Math.sin(a) * d, 0.42 + R() * 0.12, 0.38 + R() * 0.08]); }
  for (const [bx, by, bz, rx, ry] of blobs) {
    if (bx || bz) g.add(limb(V3(top.x * 0.8, 1.0 + R() * 0.2, top.z * 0.8), V3(bx * 0.8, by - 0.15, bz * 0.8), 0.07, 0.03, bark, 6));
    g.add(crown(R, bx, by, bz, rx, ry, Math.round(rx * 110), 0.44, leafM, CORE_TINT[tint] || CORE_TINT[0]));
  }
  if (tint === 0 && v === 1) for (let k = 0; k < 12; k++) { const a = R() * 6.28, el = R() * 1.2; g.add(mk(new THREE.SphereGeometry(0.035, 6, 5).translate(Math.cos(a) * 0.75 * Math.cos(el - 0.4), 2.0 + Math.sin(el) * 0.5, Math.sin(a) * 0.75 * Math.cos(el - 0.4)), smat(null, '#b0281e', { rough: 0.4 }))); }
  return g;
}
function mPine(v) {
  const R = rng(201 + v * 11), bark = smat('bark', '#5a4030', { bump: 2 });
  const g = grp(limb(V3(0, -0.05, 0), V3(0, 3.1, 0), 0.1, 0.03, bark, 8));
  const nm = smat(null, '#5e9060', { leafMap: needleTex(), rough: 0.85 });
  const core = smat(null, '#1e3a26', { rough: 1 });
  const layers = 7, H0 = 0.55, H1 = 3.3;
  for (let l = 0; l < layers; l++) {
    const t = l / (layers - 1), y = H0 + t * (H1 - H0 - 0.3), rad = (1 - t) * 0.72 + 0.12;
    g.add(mk(jitter(new THREE.ConeGeometry(rad * 0.8, 0.55, 10, 1, true), 0.05, 300 + l + v * 9).translate(0, y + 0.15, 0), core));
    const n = Math.round(10 + rad * 22);
    // cada cartão aponta para fora e cai um pouco (galho de pinheiro)
    const pos = [], nor = [], uv = [], idx = [], q = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, 'YXZ'), vv = new THREE.Vector3();
    for (let k = 0; k < n; k++) {
      const a = k / n * Math.PI * 2 + R() * 0.3, d = rad * (0.15 + R() * 0.1), cy = y + 0.12 + R() * 0.08, sz = rad * 0.9 + 0.12;
      e.set(0, -a + Math.PI / 2, 0); q.setFromEuler(e);
      const droop = 0.35 + R() * 0.25, nn = V3(Math.cos(a), 0.9, Math.sin(a)).normalize(), wdt = sz * 0.32;
      // cartão no plano horizontal, saindo do tronco para fora e caindo
      const pts = [[-wdt, 0, 0, 0], [wdt, 0, 1, 0], [wdt, sz, 1, 1], [-wdt, sz, 0, 1]];
      for (const [a2, b2, u, w] of pts) {
        vv.set(a2, -b2 * droop, b2).applyQuaternion(q);
        pos.push(Math.cos(a) * d + vv.x, cy + vv.y, Math.sin(a) * d + vv.z); nor.push(nn.x, nn.y, nn.z); uv.push(u, w);
      }
      const o = k * 4; idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
    }
    const cg = new THREE.BufferGeometry();
    cg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); cg.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); cg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); cg.setIndex(idx);
    g.add(mk(cg, nm));
  }
  return g;
}
function mDeadTree(v) {
  const R = rng(301 + v * 5), bark = smat('bark', '#5a4c42', { bump: 2 }), g = grp();
  const branch = (a, dir, len, r, d) => {
    const b = a.clone().addScaledVector(dir, len);
    b.x += (R() - 0.5) * 0.1; b.z += (R() - 0.5) * 0.1;
    g.add(limb(a, b, r, r * 0.65, bark, 6));
    if (d > 0) for (let k = 0; k < 2; k++) {
      const nd = dir.clone().applyAxisAngle(V3(1, 0, 0), (R() - 0.5) * 1.3).applyAxisAngle(V3(0, 0, 1), (R() - 0.5) * 1.3);
      nd.y = Math.abs(nd.y) * 0.8 + 0.2; nd.normalize();
      branch(b, nd, len * 0.68, r * 0.62, d - 1);
    }
  };
  branch(V3(0, -0.05, 0), V3(0, 1, 0), 1.0, 0.12, 3);
  for (let k = 0; k < 3; k++) { const a = k * 2.1 + R(); g.add(limb(V3(0, 0.15, 0), V3(Math.cos(a) * 0.3, -0.02, Math.sin(a) * 0.3), 0.07, 0.02, bark, 5)); }
  return g;
}
function mBush(v) {
  const R = rng(401 + v * 3), leafM = smat(null, '#5a8a3a', { leafMap: leafTex(), rough: 0.8 }), g = grp();
  for (const [x, z, r] of [[-0.2, 0.05, 0.3], [0.2, -0.05, 0.3], [0, 0, 0.36]]) g.add(crown(R, x, r * 0.85, z, r, r * 0.8, 46, 0.32, leafM, '#18301a'));
  if (v === 2) for (let k = 0; k < 14; k++) { const a = R() * 6.28; g.add(mk(new THREE.SphereGeometry(0.03, 6, 5).translate(Math.cos(a) * 0.35, 0.2 + R() * 0.4, Math.sin(a) * 0.35), smat(null, '#6a1a3a', { rough: 0.35 }))); }
  return g;
}
function rockGeo(seed, r, sx, sy, sz) {
  const g = new THREE.IcosahedronGeometry(r, 2), p = g.attributes.position, R = rng(seed), off = [R() * 9, R() * 9, R() * 9];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), n = vnoise(x * 3 / r * 0.4 + off[0], z * 3 / r * 0.4 + y * 2 + off[1], 7) * 0.35 + vnoise(x * 7 / r * 0.4 + off[2], y * 7, 8) * 0.12;
    const k = 0.78 + n; p.setXYZ(i, x * k * sx, Math.max(-r * 0.25, y * k) * sy, z * k * sz);
  }
  g.computeVertexNormals();
  return wuv(g, 1.6);
}
function mRock(v, mossy) {
  const g = rockGeo(500 + v * 7, 0.42, 1.25, 0.8, 1.05).translate(0, 0.14, 0);
  vcolor(g, (c, x, y, z, ny) => { const m = mossy && ny > 0.35 && vnoise(x * 6, z * 6, 9) > 0.35; c.set(m ? '#5a7a34' : '#77726a'); c.convertSRGBToLinear(); });
  const out = grp(mk(g, smat('rock', '#ffffff', { vc: true, bump: 1.2 })));
  if (v === 1) out.add(mk(rockGeo(520, 0.16, 1.2, 0.8, 1).translate(0.42, 0.06, 0.18), smat('rock', '#9c968a', { bump: 2.5 })));
  return out;
}
function mGrass(v, dry) {
  const R = rng(601 + v * 5 + (dry ? 50 : 0)), pos = [], col = [], idx = [], c = new THREE.Color();
  const pal = dry ? ['#8a7a48', '#a8955a', '#c4b070', '#6a5c34'] : ['#2f5a22', '#3f7230', '#58903e', '#76aa50'];
  let n = 0;
  for (let b = 0; b < 34; b++) {
    const a = R() * 6.28, d = Math.sqrt(R()) * 0.3, x = Math.cos(a) * d, z = Math.sin(a) * d, ht = 0.3 + R() * 0.32, lean = (R() - 0.5) * 0.35, la = R() * 6.28, w = 0.025 + R() * 0.015, fa = R() * 6.28;
    const segs = 3;
    c.set(pal[Math.floor(R() * 4)]).convertSRGBToLinear();
    for (let s2 = 0; s2 <= segs; s2++) {
      const t = s2 / segs, bend = lean * t * t, ww = w * (1 - t * 0.9);
      const px_ = x + Math.cos(la) * bend, pz = z + Math.sin(la) * bend, py = ht * t;
      pos.push(px_ - Math.cos(fa) * ww, py, pz - Math.sin(fa) * ww, px_ + Math.cos(fa) * ww, py, pz + Math.sin(fa) * ww);
      const sh = 0.45 + t * 0.6;
      col.push(c.r * sh, c.g * sh, c.b * sh, c.r * sh, c.g * sh, c.b * sh);
    }
    for (let s2 = 0; s2 < segs; s2++) { const o = n + s2 * 2; idx.push(o, o + 1, o + 3, o, o + 3, o + 2); }
    n += (segs + 1) * 2;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
  g.computeVertexNormals();
  const nr = g.attributes.normal; for (let i = 0; i < nr.count; i++) nr.setXYZ(i, nr.getX(i) * 0.3, 0.9, nr.getZ(i) * 0.3);
  return grp(mk(g, smat(null, '#ffffff', { vc: true, side: THREE.DoubleSide, rough: 0.8 }), false));
}
function mMushroom(v) {
  const R = rng(701 + v), glow = v >= 2, g = grp();
  for (let k = 0; k < 3; k++) {
    const x = (k - 1) * 0.16 + (R() - 0.5) * 0.06, z = (R() - 0.5) * 0.15, s = 0.7 + R() * 0.6;
    g.add(mk(CYL(0.025 * s, 0.035 * s, 0.14 * s, x, 0.07 * s, z, 8), smat(null, '#e8dfca', { rough: 0.7 })));
    const capM = glow ? smat(null, '#48b8e8', { emissive: '#3ab0ff', ei: 1.6, rough: 0.4 }) : smat(null, '#a82a1e', { rough: 0.45 });
    g.add(mk(new THREE.SphereGeometry(0.09 * s, 14, 8, 0, 6.28, 0, Math.PI / 2).scale(1, 0.65, 1).translate(x, 0.13 * s, z), capM));
    if (!glow) for (let i = 0; i < 4; i++) { const a = R() * 6.28; g.add(mk(new THREE.SphereGeometry(0.012 * s, 5, 4).translate(x + Math.cos(a) * 0.05 * s, 0.17 * s, z + Math.sin(a) * 0.05 * s), smat(null, '#f4ece0'))); }
  }
  return g;
}
function mReeds(v) {
  const R = rng(801 + v), g = grp(), stem = smat(null, '#5a7a2e', { rough: 0.8 }), head = smat(null, '#5a3820', { rough: 0.9 });
  for (let k = 0; k < 14; k++) {
    const a = R() * 6.28, d = Math.sqrt(R()) * 0.28, x = Math.cos(a) * d, z = Math.sin(a) * d, ht = 0.6 + R() * 0.55, lx = (R() - 0.5) * 0.15, lz = (R() - 0.5) * 0.15;
    g.add(limb(V3(x, 0, z), V3(x + lx, ht, z + lz), 0.012, 0.006, stem, 4));
    if (k % 2 === 0) g.add(limb(V3(x + lx * 0.85, ht * 0.85, z + lz * 0.85), V3(x + lx * 0.97, ht * 0.97, z + lz * 0.97), 0.028, 0.028, head, 6));
  }
  return g;
}

// ============================================================
//  OBJETOS DO VILAREJO (1 unidade ≈ 1 metro)
// ============================================================
const WOOD = () => smat('wood', '#8a6440'), DWOOD = () => smat('wood', '#5a3e26'), IRON = () => smat('iron', '#4a4a50', { metal: 0.85, rough: 0.45 }), STONE = () => smat('rock', '#9a958a', { bump: 2 });
function mBarrel() {
  const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(new THREE.Vector2(0.24 + Math.sin(t * Math.PI) * 0.05, t * 0.8)); }
  const g = new THREE.LatheGeometry(pts, 18);
  const o = grp(mk(g, smat('wood', '#9a6e40')));
  o.add(mk(CYL(0.25, 0.25, 0.02, 0, 0.79, 0, 18), smat('wood', '#7a5430')));
  for (const y of [0.12, 0.4, 0.68]) o.add(mk(new THREE.TorusGeometry(0.24 + Math.sin(y / 0.8 * Math.PI) * 0.05 + 0.006, 0.014, 6, 24).rotateX(Math.PI / 2).translate(0, y, 0), IRON()));
  return o;
}
function mCrate() {
  const o = grp(wbox(0.6, 0.6, 0.6, 0, 0.3, 0, smat('wood', '#9a7448'), 1.6));
  const fm = smat('wood', '#6a4a2a');
  for (const [w, h, d, x, y, z] of [[0.64, 0.07, 0.07, 0, 0.035, 0.3], [0.64, 0.07, 0.07, 0, 0.565, 0.3], [0.07, 0.6, 0.07, -0.3, 0.3, 0.3], [0.07, 0.6, 0.07, 0.3, 0.3, 0.3], [0.07, 0.07, 0.64, 0.3, 0.035, 0], [0.07, 0.07, 0.64, 0.3, 0.565, 0], [0.07, 0.6, 0.07, 0.3, 0.3, -0.3]]) o.add(wbox(w, h, d, x, y, z, fm, 2));
  const diag = mk(BOX(0.06, 0.78, 0.04, 0, 0, 0), fm); diag.position.set(0, 0.3, 0.31); diag.rotation.z = 0.78; o.add(diag);
  return o;
}
function mHay() {
  const m = smat('thatch', '#c8a850', { bump: 2 });
  const g = new THREE.CylinderGeometry(0.32, 0.32, 0.9, 16).rotateZ(Math.PI / 2).translate(0, 0.32, 0);
  const o = grp(mk(wuv(g, 1.6), m));
  for (const x of [-0.25, 0.25]) o.add(mk(new THREE.TorusGeometry(0.325, 0.012, 5, 20).rotateY(Math.PI / 2).translate(x, 0.32, 0), smat(null, '#6a4a2a')));
  o.add(mk(wuv(new THREE.CylinderGeometry(0.26, 0.26, 0.7, 14).rotateZ(Math.PI / 2).translate(0.15, 0.82, 0.05), 1.6), m));
  return o;
}
function mBench() {
  const w = WOOD(), o = grp(wbox(1.1, 0.06, 0.32, 0, 0.45, 0, w, 2));
  for (const x of [-0.45, 0.45]) o.add(wbox(0.07, 0.45, 0.28, x, 0.22, 0, DWOOD(), 2));
  return o;
}
function mWell() {
  const pts = [new THREE.Vector2(0.38, 0), new THREE.Vector2(0.52, 0), new THREE.Vector2(0.52, 0.7), new THREE.Vector2(0.38, 0.7), new THREE.Vector2(0.38, 0)];
  const o = grp(mk(wuv(new THREE.LatheGeometry(pts, 20), 2), smat('brick', '#a8a294', { bump: 1.5 })));
  o.add(mk(CYL(0.38, 0.38, 0.02, 0, 0.45, 0, 20), smat(null, '#1a2e3a', { rough: 0.1 })));
  for (const x of [-0.45, 0.45]) o.add(wbox(0.08, 1.6, 0.08, x, 0.8, 0, DWOOD(), 2));
  o.add(mk(new THREE.CylinderGeometry(0.035, 0.035, 0.9, 8).rotateZ(Math.PI / 2).translate(0, 1.25, 0), DWOOD()));
  const roofM = smat('shingle', '#8a3a2a');
  for (const s of [-1, 1]) { const r = mk(wuv(BOX(1.15, 0.04, 0.5, 0, 0, 0), 2), roofM); r.position.set(0, 1.72, s * 0.2); r.rotation.x = s * 0.62; o.add(r); }
  o.add(mk(CYL(0.09, 0.07, 0.14, 0.1, 0.95, 0, 10), smat('wood', '#7a5430')));
  return o;
}
function mStall() {
  const o = grp(wbox(1.4, 0.08, 0.7, 0, 0.8, 0, WOOD(), 1.5), wbox(1.36, 0.7, 0.04, 0, 0.42, 0.33, DWOOD(), 1.5));
  for (const [x, z] of [[-0.66, -0.32], [0.66, -0.32], [-0.66, 0.32], [0.66, 0.32]]) o.add(wbox(0.06, z < 0 ? 1.95 : 1.65, 0.06, x, z < 0 ? 0.975 : 0.825, z, DWOOD(), 2));
  const aw = new THREE.PlaneGeometry(1.5, 0.9, 1, 1).rotateX(-Math.PI / 2 + 0.33).translate(0, 1.8, 0.05);
  o.add(mk(aw, smat('stripes', '#ffffff', { side: THREE.DoubleSide, bump: 0.3 })));
  const R = rng(5), cols = ['#c8402a', '#e8b030', '#7aa03a', '#d86a20'];
  for (let k = 0; k < 14; k++) o.add(mk(new THREE.SphereGeometry(0.06, 8, 6).translate(-0.55 + (k % 7) * 0.18, 0.89, -0.15 + Math.floor(k / 7) * 0.2 + R() * 0.04), smat(null, cols[k % 4], { rough: 0.5 })));
  return o;
}
function mTent() {
  const sh = new THREE.Shape(); sh.moveTo(-0.75, 0); sh.lineTo(0.75, 0); sh.lineTo(0, 1.2); sh.closePath();
  const hole = new THREE.Path(); hole.moveTo(-0.22, 0.02); hole.lineTo(0.22, 0.02); hole.lineTo(0, 0.6); hole.closePath(); sh.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(sh, { depth: 1.8, bevelEnabled: false }).translate(0, 0, -0.9).rotateY(Math.PI / 2);
  const o = grp(mk(wuv(g, 1.2), smat('cloth', '#a07a4c', { side: THREE.DoubleSide, bump: 0.6 })));
  o.add(mk(new THREE.BufferGeometry().setFromPoints([V3(0.88, 0.02, -0.22), V3(0.88, 0.02, 0.22), V3(0.88, 0.6, 0)]), smat(null, '#1a120a', { side: THREE.DoubleSide })));
  o.add(mk(new THREE.CylinderGeometry(0.025, 0.025, 2.1, 6).rotateZ(Math.PI / 2).translate(0, 1.22, 0), DWOOD()));
  o.add(mk(CYL(0.02, 0.02, 0.5, 1.02, 1.4, 0, 6), DWOOD()));
  o.add(mk(new THREE.PlaneGeometry(0.35, 0.2).translate(1.2, 1.55, 0), smat('cloth', '#8a1a14', { side: THREE.DoubleSide })));
  return o;
}
function mSpikes() {
  const o = grp(), m = smat('bark', '#6b4a2b', { bump: 1.5 });
  for (const x of [-0.35, 0, 0.35]) for (const s of [-1, 1]) o.add(limb(V3(x - s * 0.25, 0, -0.2), V3(x + s * 0.25, 0.85, 0.25), 0.05, 0.005, m, 6));
  o.add(limb(V3(-0.6, 0.35, 0), V3(0.6, 0.35, 0), 0.05, 0.05, m, 6));
  return o;
}
function mRubble(v) {
  const o = grp(), R = rng(901 + v), m = smat('rock', '#a29c90', { bump: 2.5 });
  for (let k = 0; k < 7; k++) o.add(mk(rockGeo(910 + k + v * 10, 0.12 + R() * 0.12, 1.2, 0.8, 1).translate((R() - 0.5) * 0.8, 0.06, (R() - 0.5) * 0.6), m));
  o.add(wbox(0.4, 0.22, 0.25, 0.1, 0.11, 0.1, smat('brick', '#9a958a'), 1));
  return o;
}
function mDummy() {
  const o = grp(wbox(0.08, 1.7, 0.08, 0, 0.85, 0, DWOOD(), 2), wbox(0.9, 0.07, 0.07, 0, 1.3, 0, DWOOD(), 2));
  const sack = smat('cloth', '#b89a68', { bump: 1.5 });
  o.add(mk(new THREE.CapsuleGeometry(0.2, 0.4, 4, 12).translate(0, 1.1, 0), sack));
  o.add(mk(new THREE.SphereGeometry(0.15, 12, 10).translate(0, 1.6, 0), sack));
  o.add(mk(new THREE.TorusGeometry(0.2, 0.015, 5, 16).rotateX(Math.PI / 2).translate(0, 1.0, 0), smat(null, '#5a3a20')));
  return o;
}
function mStatue() {
  const st = smat('rock', '#b8b2a4', { bump: 1.2 }), o = grp(wbox(0.8, 0.5, 0.8, 0, 0.25, 0, smat('brick', '#8e897e'), 1.5), wbox(0.9, 0.08, 0.9, 0, 0.54, 0, st, 1.5));
  const robe = [new THREE.Vector2(0.3, 0), new THREE.Vector2(0.24, 0.5), new THREE.Vector2(0.2, 1.05), new THREE.Vector2(0.24, 1.2), new THREE.Vector2(0.08, 1.3), new THREE.Vector2(0, 1.3)];
  o.add(mk(new THREE.LatheGeometry(robe, 16).translate(0, 0.58, 0), st));
  o.add(mk(new THREE.SphereGeometry(0.13, 14, 12).translate(0, 2.0, 0), st));
  o.add(mk(new THREE.SphereGeometry(0.16, 14, 10, 0, 6.28, 0, 1.6).translate(0, 2.0, -0.02), st));
  o.add(mk(BOX(0.06, 1.0, 0.02, 0.0, 1.35, 0.32), st));
  o.add(mk(BOX(0.3, 0.05, 0.05, 0, 1.75, 0.32), st));
  for (const s of [-1, 1]) o.add(limb(V3(s * 0.25, 1.75, 0), V3(s * 0.06, 1.68, 0.3), 0.07, 0.06, st, 8));
  return o;
}
function mAnvil() {
  const sh = new THREE.Shape(); sh.moveTo(-0.32, 0); sh.lineTo(0.2, 0); sh.quadraticCurveTo(0.42, 0.02, 0.5, 0.1); sh.lineTo(0.2, 0.12); sh.lineTo(-0.32, 0.12); sh.closePath();
  const top = new THREE.ExtrudeGeometry(sh, { depth: 0.2, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 1 }).translate(0, 0.62, -0.1);
  const o = grp(mk(top, smat('iron', '#3a3a40', { metal: 0.9, rough: 0.35 })), mk(BOX(0.22, 0.2, 0.16, -0.04, 0.52, 0), IRON()));
  o.add(mk(wuv(CYL(0.26, 0.3, 0.42, -0.04, 0.21, 0, 14), 2), smat('bark', '#6a4a2a', { bump: 2 })));
  return o;
}
function mWeaponRack() {
  const o = grp(wbox(1.1, 0.06, 0.06, 0, 1.1, 0, DWOOD(), 2), wbox(1.1, 0.06, 0.06, 0, 0.35, 0, DWOOD(), 2));
  for (const x of [-0.5, 0.5]) o.add(wbox(0.07, 1.25, 0.07, x, 0.62, 0, DWOOD(), 2));
  const steel = smat(null, '#c8ccd4', { metal: 0.9, rough: 0.3 });
  for (let k = 0; k < 4; k++) {
    const x = -0.33 + k * 0.22;
    if (k % 2) { o.add(mk(BOX(0.05, 0.9, 0.012, x, 0.75, 0.05), steel)); o.add(mk(BOX(0.2, 0.03, 0.04, x, 1.18, 0.05), smat(null, '#8a6a2a', { metal: 0.8, rough: 0.4 }))); }
    else { o.add(mk(CYL(0.015, 0.015, 1.6, x, 0.9, 0.05, 6), DWOOD())); o.add(mk(new THREE.ConeGeometry(0.04, 0.16, 6).translate(x, 1.78, 0.05), steel)); }
  }
  return o;
}
function mCart() {
  const o = grp(wbox(1.4, 0.08, 0.9, 0, 0.55, 0, WOOD(), 1.5));
  for (const [w, d, x, z] of [[1.4, 0.05, 0, 0.45], [1.4, 0.05, 0, -0.45], [0.05, 0.9, -0.7, 0]]) o.add(wbox(w, 0.28, d, x, 0.73, z, DWOOD(), 1.5));
  for (const z of [-0.5, 0.5]) {
    o.add(mk(new THREE.TorusGeometry(0.36, 0.04, 6, 20).translate(0.1, 0.38, z), DWOOD()));
    for (let k = 0; k < 6; k++) { const sp = mk(BOX(0.03, 0.7, 0.03, 0, 0, 0), DWOOD()); sp.position.set(0.1, 0.38, z); sp.rotation.z = k * Math.PI / 6; o.add(sp); }
    o.add(mk(new THREE.CylinderGeometry(0.07, 0.07, 0.1, 10).rotateX(Math.PI / 2).translate(0.1, 0.38, z), IRON()));
  }
  for (const z of [-0.3, 0.3]) o.add(limb(V3(0.7, 0.55, z), V3(1.6, 0.25, z * 0.8), 0.03, 0.025, DWOOD(), 6));
  o.add(mk(wuv(new THREE.CylinderGeometry(0.22, 0.22, 0.8, 12).rotateZ(Math.PI / 2).translate(-0.15, 0.82, 0), 1.6), smat('thatch', '#c8a850')));
  return o;
}
function mTable() {
  const o = grp(wbox(1.1, 0.06, 0.7, 0, 0.75, 0, WOOD(), 1.5));
  for (const [x, z] of [[-0.48, -0.28], [0.48, -0.28], [-0.48, 0.28], [0.48, 0.28]]) o.add(wbox(0.06, 0.72, 0.06, x, 0.36, z, DWOOD(), 2));
  o.add(mk(CYL(0.05, 0.045, 0.13, -0.2, 0.85, 0.05, 10), smat('wood', '#8a5424')));
  o.add(mk(CYL(0.05, 0.045, 0.13, 0.25, 0.85, -0.1, 10), smat('wood', '#8a5424')));
  o.add(mk(CYL(0.13, 0.11, 0.05, 0.05, 0.8, 0.12, 14), smat(null, '#c8b8a0', { rough: 0.5 })));
  return o;
}
function mFence(alongX) {
  const o = grp(), m = smat('wood', '#7a5a38'), R = rng(alongX ? 3 : 4);
  for (const t of [-0.5, 0.5]) { const p = wbox(0.08, 1.0, 0.08, alongX ? t : 0, 0.5, alongX ? 0 : t, m, 2); p.rotation.z = (R() - 0.5) * 0.08; o.add(p); }
  for (const y of [0.35, 0.75]) o.add(wbox(alongX ? 1.08 : 0.05, 0.08, alongX ? 0.05 : 1.08, 0, y, 0, m, 2));
  return o;
}
function mTorch() {
  return grp(mk(CYL(0.03, 0.04, 1.05, 0, 0.52, 0, 8), DWOOD()), mk(CYL(0.08, 0.05, 0.12, 0, 1.1, 0, 10), IRON()), mk(CYL(0.065, 0.065, 0.03, 0, 1.15, 0, 10), smat(null, '#2a1a10', { emissive: '#ff6a20', ei: 0.6 })));
}
function mCampfire() {
  const o = grp(), R = rng(9), st = smat('rock', '#8a877e', { bump: 2 });
  for (let k = 0; k < 9; k++) { const a = k / 9 * 6.28; o.add(mk(rockGeo(930 + k, 0.09, 1.2, 0.8, 1).translate(Math.cos(a) * 0.36, 0.04, Math.sin(a) * 0.36), st)); }
  for (let k = 0; k < 4; k++) { const a = k * 0.8 + 0.3; o.add(limb(V3(Math.cos(a) * 0.3, 0.02, Math.sin(a) * 0.3), V3(-Math.cos(a) * 0.05, 0.22, -Math.sin(a) * 0.05), 0.04, 0.03, smat('bark', '#3a2414'), 6)); }
  o.add(mk(CYL(0.2, 0.22, 0.04, 0, 0.02, 0, 12), smat(null, '#3a1a0a', { emissive: '#ff5010', ei: 1.4 })));
  return o;
}
function mBrazier() {
  const o = grp(), ir = IRON();
  for (let k = 0; k < 3; k++) { const a = k / 3 * 6.28; o.add(limb(V3(Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3), V3(Math.cos(a) * 0.08, 0.7, Math.sin(a) * 0.08), 0.022, 0.022, ir, 6)); }
  const bowl = [new THREE.Vector2(0.08, 0), new THREE.Vector2(0.28, 0.1), new THREE.Vector2(0.32, 0.18)];
  o.add(mk(new THREE.LatheGeometry(bowl, 16).translate(0, 0.68, 0), smat('iron', '#3a3a3e', { metal: 0.8, rough: 0.5, side: THREE.DoubleSide })));
  o.add(mk(CYL(0.2, 0.2, 0.04, 0, 0.8, 0, 14), smat(null, '#3a1208', { emissive: '#ff5a10', ei: 0.9 })));
  return o;
}
function mLamp() {
  const ir = IRON(), o = grp(mk(CYL(0.1, 0.12, 0.16, 0, 0.08, 0, 10), ir), mk(CYL(0.035, 0.04, 1.75, 0, 0.95, 0, 8), ir));
  o.add(limb(V3(0, 1.78, 0), V3(0.24, 1.8, -0.24), 0.02, 0.02, ir, 6));
  o.add(mk(BOX(0.16, 0.2, 0.16, 0.22, 1.62, -0.22), smat(null, '#ffd890', { emissive: '#ffcc70', ei: 1.4, rough: 0.2 })));
  o.add(mk(new THREE.ConeGeometry(0.14, 0.1, 4).rotateY(Math.PI / 4).translate(0.22, 1.77, -0.22), ir));
  return o;
}
function mBannerPole() {
  return grp(mk(CYL(0.035, 0.045, 2.4, 0.06, 1.2, -0.06, 8), DWOOD()), mk(new THREE.SphereGeometry(0.06, 10, 8).translate(0.06, 2.42, -0.06), smat(null, '#c9a24a', { metal: 1, rough: 0.3 })));
}
function mFountain() {
  const st = smat('brick', '#b4ae9f', { bump: 1.4 }), o = grp();
  const rim = [new THREE.Vector2(0.62, 0), new THREE.Vector2(0.8, 0), new THREE.Vector2(0.8, 0.36), new THREE.Vector2(0.68, 0.38), new THREE.Vector2(0.62, 0.36), new THREE.Vector2(0.62, 0)];
  o.add(mk(wuv(new THREE.LatheGeometry(rim, 8), 2.5), st));
  o.add(mk(CYL(0.64, 0.64, 0.02, 0, 0.3, 0, 8), smat(null, '#3a6a8a', { rough: 0.05, metal: 0.2 })));
  o.add(mk(wuv(CYL(0.1, 0.14, 0.9, 0, 0.7, 0, 10), 3), st));
  const bowl = [new THREE.Vector2(0.06, 0), new THREE.Vector2(0.3, 0.08), new THREE.Vector2(0.34, 0.14), new THREE.Vector2(0.3, 0.14), new THREE.Vector2(0.06, 0.06)];
  o.add(mk(new THREE.LatheGeometry(bowl, 14).translate(0, 1.02, 0), st));
  o.add(mk(CYL(0.04, 0.06, 0.14, 0, 1.2, 0, 8), st));
  return o;
}
function mStump() {
  const o = grp(mk(jitter(CYL(0.2, 0.25, 0.32, 0, 0.16, 0, 12), 0.03, 11, 0.01), smat('bark', '#5e4630', { bump: 2 })));
  o.add(mk(CYL(0.19, 0.19, 0.01, 0, 0.325, 0, 12), smat(null, '#b8956a', { rough: 0.9 })));
  for (let k = 0; k < 4; k++) { const a = k * 1.6; o.add(limb(V3(0, 0.12, 0), V3(Math.cos(a) * 0.34, -0.01, Math.sin(a) * 0.34), 0.06, 0.02, smat('bark', '#5e4630'), 5)); }
  return o;
}
function mLog(v) {
  const g = new THREE.CylinderGeometry(0.15, 0.17, 1.2, 12).rotateZ(Math.PI / 2).rotateY(v ? 0.6 : -0.6).translate(0, 0.15, 0);
  const o = grp(mk(g, smat('bark', '#6a4a30', { bump: 2 })));
  const end = mk(new THREE.CircleGeometry(0.15, 12).rotateY(Math.PI / 2).translate(0.601, 0, 0).rotateY(v ? 0.6 : -0.6).translate(0, 0.15, 0), smat(null, '#b8956a'));
  o.add(end);
  return o;
}
function mGrave(v) {
  const sh = new THREE.Shape(); sh.moveTo(-0.22, 0); sh.lineTo(0.22, 0); sh.lineTo(0.22, 0.5); sh.quadraticCurveTo(0.22, 0.75, 0, 0.78); sh.quadraticCurveTo(-0.22, 0.75, -0.22, 0.5); sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.1, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 1 }).translate(0, 0, -0.05).rotateY(v ? 0.25 : -0.15);
  const o = grp(mk(wuv(g, 2), smat('rock', '#9a968c', { bump: 2 })));
  o.add(mk(BOX(0.04, 0.3, 0.01, 0, 0.45, 0.07).rotateY(v ? 0.25 : -0.15), smat(null, '#3a362e')));
  o.add(mk(BOX(0.18, 0.04, 0.01, 0, 0.52, 0.07).rotateY(v ? 0.25 : -0.15), smat(null, '#3a362e')));
  o.add(mk(BOX(0.5, 0.06, 0.9, 0, 0.03, 0.45), smat('rock', '#5a5040')));
  return o;
}

// ============================================================
//  CASTELO, PENHASCOS E CONSTRUÇÕES
// ============================================================
const WALL_H = h3(FLOOR_PX);                 // altura da muralha (andar de cima)
const BLD_K = 1;                              // alturas vêm direto de cada construção (b.H / b.RH)
const ivyM = () => smat(null, '#3e6a2e', { leafMap: leafTex(), rough: 0.85 });
function ivyCards(R, faces, n, H) {
  const cards = [];
  for (let i = 0; i < n; i++) {
    const f = faces[Math.floor(R() * faces.length)], t = R() - 0.5, y = Math.pow(R(), 0.7) * H * 0.95;
    cards.push(f === 'z' ? { x: t, y, z: 0.51 + R() * 0.03, rx: 0, ry: (R() - 0.5) * 0.6, rz: R() * 6, s: 0.18 + R() * 0.12 } : { x: 0.51 + R() * 0.03, y, z: t, rx: 0, ry: Math.PI / 2 + (R() - 0.5) * 0.6, rz: R() * 6, s: 0.18 + R() * 0.12 });
  }
  return mk(leafCards(cards, V3(0, H * 0.5, 0), 0.2), ivyM());
}
function merlonRow(o, side, H, m) {
  // side: 1:+x 2:-x 3:+y(z) 4:-y(z); 2 ameias por tile na borda indicada
  for (const t of [-0.25, 0.25]) {
    const g = new THREE.BoxGeometry(side <= 2 ? 0.22 : 0.32, 0.42, side <= 2 ? 0.32 : 0.22);
    const e = side === 1 ? [0.39, t] : side === 2 ? [-0.39, t] : side === 3 ? [t, 0.39] : [t, -0.39];
    o.add(mk(wuv(g.translate(e[0], H + 0.21, e[1]), 1.5), m));
  }
  const lip = side <= 2 ? new THREE.BoxGeometry(0.22, 0.14, 1) : new THREE.BoxGeometry(1, 0.14, 0.22);
  const e = side === 1 ? [0.39, 0] : side === 2 ? [-0.39, 0] : side === 3 ? [0, 0.39] : [0, -0.39];
  o.add(mk(wuv(lip.translate(e[0], H + 0.07, e[1]), 1.5), m));
}
function mWall(v, low, ivy, od, ends) {
  const R = rng(1001 + v * 3 + (low ? 50 : 0) + (ivy ? 9 : 0) + (od || 0) * 101), o = grp();
  if (low) {
    const H = 0.5;
    o.add(wbox(1, H, 0.8, 0, H / 2, 0, smat('stoneblock', '#8e897e', { bump: 1.6 }), 1.2));
    for (let k = 0; k < 4; k++) o.add(mk(rockGeo(1010 + k + v * 7, 0.12 + R() * 0.08, 1.3, 0.7, 1).translate((R() - 0.5) * 0.8, H + 0.03, (R() - 0.5) * 0.5), smat('rock', '#8a857a', { bump: 2 })));
    return o;
  }
  const H = WALL_H, capM = smat('stoneblock', '#b0a998', { bump: 1 });
  const alongX = od === 3 || od === 4 || !od, eL = 0, eR = ends & 2 ? 0.35 : 0, len = 1 + eL + eR, off = (eR - eL) / 2;
  o.add(gwall(alongX ? len : 1, H - 0.08, alongX ? 1 : len, alongX ? off : 0, (H - 0.08) / 2, alongX ? 0 : off, 'brick', '#a29c90', H, v, 1, 1.4));
  o.add(wbox(alongX ? len : 1, 0.08, alongX ? 1 : len, alongX ? off : 0, H - 0.04, alongX ? 0 : off, capM, 1));
  // base mais larga do lado de fora (sapata) e cordão de pedra no topo
  const out = od || 3, sx = out === 1 ? 1 : out === 2 ? -1 : 0, sz = out === 3 ? 1 : out === 4 ? -1 : 0;
  o.add(wbox(sx ? 0.14 : 1, 0.5, sz ? 0.14 : 1, sx * 0.53, 0.25, sz * 0.53, smat('stoneblock', '#8a857a', { bump: 1.4 }), 1.2));
  o.add(wbox(sx ? 0.08 : 1, 0.1, sz ? 0.08 : 1, sx * 0.53, H - 0.25, sz * 0.53, capM, 1.2));
  merlonRow(o, out, H, capM);
  if (ivy) o.add(ivyCards(R, out === 1 || out === 2 ? ['x'] : ['z'], 50, H));
  return o;
}
function mGate(alongX) {
  const o = grp(), H = WALL_H, top = 0.5;
  const lint = wbox(1, top, 1, 0, H - top / 2, 0, smat('stoneblock', '#a29c90', { bump: 1.4 }), 1.4); o.add(lint);
  const ir = smat('iron', '#2e2e32', { metal: 0.85, rough: 0.5 });
  // grade levadiça erguida (só as pontas aparecem)
  for (let k = 0; k < 7; k++) {
    const t = -0.42 + k * 0.14, bar = new THREE.BoxGeometry(0.035, 0.32, 0.035).translate(alongX ? t : 0, H - top - 0.14, alongX ? 0 : t);
    o.add(mk(bar, ir));
    o.add(mk(new THREE.ConeGeometry(0.03, 0.09, 4).rotateX(Math.PI).translate(alongX ? t : 0, H - top - 0.34, alongX ? 0 : t), ir));
  }
  o.add(mk(new THREE.BoxGeometry(alongX ? 1 : 0.04, 0.04, alongX ? 0.04 : 1).translate(0, H - top - 0.08, 0), ir));
  // pedras do arco
  for (let k = 0; k < 5; k++) { const t = -0.4 + k * 0.2; o.add(mk(new THREE.BoxGeometry(alongX ? 0.18 : 1.02, 0.1, alongX ? 1.02 : 0.18).translate(alongX ? t : 0, H - top - 0.02 + Math.cos(t * 2.4) * 0.02, alongX ? 0 : t), smat('stoneblock', '#8e897e'))); }
  return o;
}
function cylUV(g, su, sv) {
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)); uv.setXY(i, (a / (Math.PI * 2) + 0.5) * su, p.getY(i) * sv); }
  return g;
}
function mTower(v, off) {
  const R = rng(1101 + v), o = grp(), spire = v === 3, r = 1.12, H = spire ? 9.5 : WALL_H;
  const st = smat('brick', '#a29c90', { bump: 1.4 });
  o.add(mk(cylUV(new THREE.CylinderGeometry(r, r + 0.04, H, 28, 4, true).translate(0, H / 2, 0), 6, 1), st));
  o.add(mk(cylUV(new THREE.CylinderGeometry(r + 0.1, r + 0.14, 0.35, 28).translate(0, 0.175, 0), 6, 1), smat('stoneblock', '#8e897e')));
  // cornija e ameias
  o.add(mk(cylUV(new THREE.CylinderGeometry(r + 0.1, r, 0.14, 28, 1, true).translate(0, H + 0.07, 0), 6, 1), smat('stoneblock', '#b4ae9f')));
  o.add(mk(CYL(r + 0.1, r + 0.1, 0.02, 0, H + 0.14, 0, 28), smat('stoneblock', '#8a857a')));
  const n = 14;
  for (let k = 0; k < n; k++) {
    if (k % 2 || spire) continue;
    const a = k / n * Math.PI * 2, m = mk(wuv(new THREE.BoxGeometry(0.3, 0.3, 0.2), 1.5), smat('stoneblock', '#b4ae9f'));
    m.position.set(Math.cos(a) * (r + 0.02), H + 0.29, Math.sin(a) * (r + 0.02)); m.rotation.y = -a + Math.PI / 2; o.add(m);
  }
  // seteiras viradas para a frente
  for (const [a, y] of [[Math.PI / 4, 1.2], [Math.PI / 4 + 0.9, 1.9], [Math.PI / 4 - 1.0, 0.8]]) {
    const s = mk(new THREE.BoxGeometry(0.08, 0.4, 0.1), smat(null, '#141210')); s.position.set(Math.cos(a) * (r - 0.02), y, Math.sin(a) * (r - 0.02)); s.rotation.y = -a + Math.PI / 2; o.add(s);
  }
  // bandeira no alto
  if (spire) {
    const roofM = smat('slate', '#3e4a66', { bump: 1.6 });
    o.add(mk(cylUV(new THREE.ConeGeometry(r + 0.28, 3.2, 28, 6, true).translate(0, H + 0.14 + 1.6, 0), 8, 1.2), roofM));
    o.add(mk(new THREE.SphereGeometry(0.09, 10, 8).translate(0, H + 3.4, 0), smat(null, '#e2b74e', { metal: 1, rough: 0.3 })));
    o.add(mk(CYL(0.015, 0.015, 0.9, 0, H + 3.8, 0, 6), DWOOD()));
    o.add(mk(new THREE.PlaneGeometry(0.6, 0.32, 4, 1).translate(0.31, H + 4.05, 0), smat('cloth', '#7a1a1c', { side: THREE.DoubleSide })));
    for (const [a, y] of [[Math.PI / 4, H * 0.55], [Math.PI / 4 + 0.7, H * 0.8]]) { const w = mk(new THREE.BoxGeometry(0.22, 0.42, 0.1), smat(null, '#ffd890', { emissive: '#7a5a20', ei: 0.4 })); w.position.set(Math.cos(a) * (r - 0.02), y, Math.sin(a) * (r - 0.02)); w.rotation.y = -a + Math.PI / 2; o.add(w); }
  }
  if (v === 0) { o.add(mk(CYL(0.02, 0.02, 1.1, 0, H + 0.6, 0, 6), DWOOD())); const f = mk(new THREE.PlaneGeometry(0.55, 0.35, 4, 1).translate(0.29, H + 0.95, 0), smat('cloth', '#2c447a', { side: THREE.DoubleSide })); o.add(f); }
  // hera do lado iluminado
  const cards = [];
  for (let i = 0; i < 60; i++) { const a = Math.PI / 2 + (R() - 0.5) * 1.6, y = Math.pow(R(), 0.8) * H * 0.85; cards.push({ x: Math.cos(a) * (r + 0.03), y, z: Math.sin(a) * (r + 0.03), rx: 0, ry: -a + Math.PI / 2, rz: R() * 6, s: 0.2 + R() * 0.12 }); }
  o.add(mk(leafCards(cards, V3(0, 1, 0), 0.2), ivyM()));
  return o;
}
function mStairs(dir, part) {
  const o = grp(), H = WALL_H / STAIR_N, n = 4, m = smat('stoneblock', '#aaa496', { bump: 1.2 }), base = (part || 0) * H, ax = dir <= 2;
  if (base > 0) o.add(wbox(1, base, 1, 0, base / 2, 0, smat('brick', '#958f84', { bump: 1.2 }), 1));
  for (let k = 0; k < n; k++) {
    const zt = base + (k + 1) * H / n, len = 1 - k / n, c = (dir === 1 || dir === 3) ? 0.5 - len / 2 : -0.5 + len / 2;
    o.add(wbox(ax ? len : 1, H / n, ax ? 1 : len, ax ? c : 0, zt - H / n / 2, ax ? 0 : c, m, 1.5));
  }
  return o;
}
function mSlab(v) {
  const o = grp(wbox(1, 0.15, 1, 0, -0.075, 0, smat('stoneblock', '#857f74', { bump: 1 }), 1));
  return o;
}
function mCliff(h, v, snow) {
  const R = rng(1201 + h * 17 + v * 5 + (snow ? 3 : 0)), o = grp(), H = h3(CLIFF_H[h]);
  const rockM = smat('rock', '#ffffff', { vc: true, bump: 1.6 });
  const topC = snow ? '#eef2f5' : h >= 3 ? '#9a9484' : '#5a7a3c';
  const layers = Math.max(2, Math.round(H / 0.55));
  for (let l = 0; l <= layers; l++) {
    const y = l === layers ? H - 0.15 : (l + 0.35) / layers * H, n = l === layers ? 2 : 3;
    for (let q = 0; q < n; q++) {
      const rr = l === layers ? 0.5 : 0.4 + R() * 0.2, g = rockGeo(1300 + l * 7 + q + v * 31 + h * 101, rr, 1.35, l === layers ? 0.55 : 0.95, 1.25).translate((R() - 0.5) * 1.0, y, (R() - 0.5) * 1.0);
      vcolor(g, (c, x, yy, z, ny) => { const top = ny > 0.55 && yy > H - 0.35; const t = clamp(yy / (H + 0.3), 0, 1); c.set(top ? topC : '#9a9486'); if (!top) c.multiplyScalar(0.5 + t * 0.5); c.convertSRGBToLinear(); });
      o.add(mk(g, rockM));
    }
  }
  return o;
}
// ---------- portão (arco + duas folhas de madeira) ----------
function mGateHouse(gt, f) {
  const n = gt.x1 - gt.x0 + 1, main = gt.kind === 'main', gh = main ? 6.4 : WALL_H, o = grp();
  const L = -(n - 0.5), Rr = 0.5, cx = -(n - 1) / 2, rx = (n - 0.3) / 2, spring = main ? 2.9 : 2.2, ry = Math.min(rx * 0.85, gh - spring - 0.5);
  const st = smat('brick', '#a29c90', { bump: 1.4 }), capM = smat('stoneblock', '#b0a998', { bump: 1 });
  // parte de cima do arco
  const sh = new THREE.Shape(); sh.moveTo(L, spring); sh.lineTo(L, gh); sh.lineTo(Rr, gh); sh.lineTo(Rr, spring); sh.lineTo(cx + rx, spring);
  for (let k = 1; k <= 20; k++) { const t = k / 20 * Math.PI; sh.lineTo(cx + rx * Math.cos(t), spring + ry * Math.sin(t)); }
  sh.lineTo(L, spring);
  o.add(mk(wuv(new THREE.ExtrudeGeometry(sh, { depth: 1, bevelEnabled: false }).translate(0, 0, -0.5), 1), st));
  for (const jx of [L + (cx - rx - L) / 2, Rr - (Rr - cx - rx) / 2]) o.add(wbox(Math.max(0.12, cx - rx - L), spring, 1, jx, spring / 2, 0, st, 1));
  // pedras do arco (aduelas) na face de fora
  for (let k = 0; k <= 10; k++) { const t = k / 10 * Math.PI, m = mk(new THREE.BoxGeometry(0.2, 0.32, 0.08), capM); m.position.set(cx + (rx + 0.12) * Math.cos(t), spring + (ry + 0.12) * Math.sin(t), gt.out * 0.52); m.rotation.z = t - Math.PI / 2; o.add(m); }
  // cornija e ameias dos dois lados
  o.add(wbox(n, 0.1, 1.08, cx, gh - 0.05, 0, capM, 1));
  for (let k = 0; k < n * 2; k++) for (const zz of [0.42, -0.42]) o.add(mk(wuv(new THREE.BoxGeometry(0.3, 0.42, 0.2).translate(L + 0.25 + k * 0.5, gh + 0.21, zz), 1.5), capM));
  if (main) {
    // brasão e lanternas na fachada do portão principal
    const shield = mk(new THREE.CylinderGeometry(0.34, 0.34, 0.06, 6).rotateX(Math.PI / 2).translate(cx, spring + ry + 0.42, gt.out * 0.55), smat(null, '#7a1a1c', { rough: 0.5 }));
    o.add(shield); o.add(mk(new THREE.SphereGeometry(0.12, 10, 8).translate(cx, spring + ry + 0.42, gt.out * 0.6), smat(null, '#e2b74e', { metal: 1, rough: 0.3 })));
    for (const lx of [L + 0.1, Rr - 0.1]) o.add(mk(new THREE.BoxGeometry(0.14, 0.2, 0.14).translate(lx, 1.6, gt.out * 0.6), smat(null, '#ffd890', { emissive: '#ffbb60', ei: 1.4 })));
  }
  // folhas das portas: giram para dentro da cidade conforme f (0 fechado, 1 aberto)
  const woodM = smat('wood', '#6a4424', { bump: 1.6 }), ir = IRON();
  const zin = -gt.out * 0.3, ang = f * 1.5;
  const topAt = xw => spring + ry * Math.sqrt(Math.max(0, 1 - ((xw - cx) / rx) ** 2));
  for (const side of [-1, 1]) {
    const hinge = cx + side * rx, lw = rx - 0.02, ls = new THREE.Shape();
    ls.moveTo(0, 0); ls.lineTo(lw, 0);
    for (let k = 0; k <= 12; k++) { const u = lw * (1 - k / 12); ls.lineTo(u, topAt(hinge - side * u) - 0.02); }
    ls.lineTo(0, 0);
    const leaf = grp(mk(wuv(new THREE.ExtrudeGeometry(ls, { depth: 0.09, bevelEnabled: false }).translate(0, 0, -0.045), 1.4), woodM));
    for (const y of [0.35, spring * 0.55, spring - 0.1]) leaf.add(mk(new THREE.BoxGeometry(lw * 0.96, 0.07, 0.11).translate(lw / 2, y, 0), ir));
    leaf.add(mk(new THREE.TorusGeometry(0.07, 0.015, 5, 12).translate(lw - 0.18, spring * 0.5, gt.out * 0.06), ir));
    const pv = grp(leaf); pv.position.set(hinge, 0, zin); pv.userData.leaf = (side === -1 ? 1 : -1) * (gt.out > 0 ? 1 : -1);
    if (side === 1) leaf.scale.x = -1;
    pv.rotation.y = (side === -1 ? 1 : -1) * ang * (gt.out > 0 ? 1 : -1);
    o.add(pv);
  }
  return o;
}
function gateHouseSprite(gi) {
  const gt = WORLD.gates[gi], f = (G.gateF && G.gateF[gi]) || 0, q = Math.round(f * 4);
  return scen3('gh|' + gi + '|' + q, () => mGateHouse(gt, q / 4)) || (q ? null : gateSprite(true));
}
// ---------- torre-escada (3x3): por fora uma torre de pedra; cortada mostra a escada em espiral ----------
function mStairTower(b, cut) {
  const o = grp(), H = WALL_H, cx = 1.5, cz = 1.5, t = 0.22, wallM = smat('brick', '#a29c90', { bump: 1.4 }), capM = smat('stoneblock', '#b0a998', { bump: 1 });
  const hw = 0.35, dc = 1.5, dw = 0.7, dh = 1.15;
  // piso e chão do alto (passarela)
  o.add(wbox(3, 0.06, 3, cx, 0.03, cz, smat('stoneblock', '#8e887c', { bump: 1 }), 1));
  if (!cut) o.add(wbox(3, 0.12, 3, cx, H - 0.06, cz, smat('stoneblock', '#9a948a', { bump: 1 }), 1));
  // paredes: as do fundo (lado oposto à câmera) sempre inteiras; as da frente cortadas quando você está dentro
  const knee = cut ? { S: ['front', 'right'], N: ['back', 'left'], E: ['front', 'left'], W: ['back', 'right'] }[b.realDoor || 'S'] : [];
  const fh = f => knee.includes(f) ? hw : H;
  o.add(gwall(t, fh('left'), 3, t / 2, fh('left') / 2, cz, 'brick', '#a29c90', H, 2.1, 1, 1.4));
  o.add(gwall(3, fh('back'), t, cx, fh('back') / 2, t / 2, 'brick', '#a29c90', H, 2.2, 1, 1.4));
  o.add(gwall(t, fh('right'), 3, 3 - t / 2, fh('right') / 2, cz, 'brick', '#a29c90', H, 2.3, 1, 1.4));
  const fr = knee.includes('front') ? hw : dh;
  if (dc - dw / 2 > 0) o.add(gwall(dc - dw / 2, fh('front'), t, (dc - dw / 2) / 2, fh('front') / 2, 3 - t / 2, 'brick', '#a29c90', H, 2.4, 1, 1.4));
  o.add(gwall(3 - dc - dw / 2, fh('front'), t, (dc + dw / 2 + 3) / 2, fh('front') / 2, 3 - t / 2, 'brick', '#a29c90', H, 2.5, 1, 1.4));
  if (!knee.includes('front')) o.add(gwall(dw, H - dh, t, dc, dh + (H - dh) / 2, 3 - t / 2, 'brick', '#a29c90', H, 2.6, 1, 1.4));
  if (!cut) {
    // porta em arco, seteiras e ameias
    const doorM = smat('wood', '#5a3a1e', { bump: 1.5 });
    o.add(mk(new THREE.BoxGeometry(dw - 0.06, dh - 0.04, 0.05).translate(dc, (dh - 0.04) / 2, 3 + 0.01), doorM));
    o.add(mk(new THREE.CylinderGeometry(dw / 2, dw / 2, 0.06, 14, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2).translate(dc, dh, 3 + 0.01), capM));
    for (const [x, y, z, ry] of [[3.02, H * 0.45, 1.5, Math.PI / 2], [3.02, H * 0.75, 1.0, Math.PI / 2], [1.0, H * 0.6, 3.02, 0]]) { const a = mk(new THREE.BoxGeometry(0.1, 0.42, 0.05), smat(null, '#141210')); a.position.set(x, y, z); a.rotation.y = ry; o.add(a); }
    for (let k = 0; k < 6; k++) for (const [x, z, w2, d2] of [[0.25 + k * 0.5, 2.9, 0.3, 0.2], [2.9, 0.25 + k * 0.5, 0.2, 0.3], [0.25 + k * 0.5, 0.1, 0.3, 0.2], [0.1, 0.25 + k * 0.5, 0.2, 0.3]]) if (k % 2 === 0) o.add(mk(wuv(new THREE.BoxGeometry(w2, 0.42, d2).translate(x, H + 0.21, z), 1.5), capM));
    o.add(wbox(3.12, 0.12, 3.12, cx, H - 0.02, cz, capM, 1));
    // alçapão no alto (por onde se desce)
    o.add(mk(new THREE.BoxGeometry(0.7, 0.03, 0.7).translate(cx, H + 0.02, cz), smat('wood', '#4a2f17', { bump: 1.2 })));
  }
  // escada em espiral: degraus em leque subindo em volta de um pilar central
  const pillarM = smat('stoneblock', '#9a948a', { bump: 1.2 }), stepM = smat('stoneblock', '#b4ae9f', { bump: 1.2 });
  // escada reta de 1 tile no centro, subindo para o fundo, com uma abertura escura no alto
  { const n = 8; for (let k = 0; k < n; k++) o.add(wbox(0.8, (k + 1) * 0.32, 0.9 / n, cx, (k + 1) * 0.16, cz + 0.45 - (k + 0.5) * 0.9 / n, stepM, 2)); for (const x of [cx - 0.44, cx + 0.44]) o.add(wbox(0.06, 2.6, 0.9, x, 1.3, cz, pillarM, 2)); o.add(mk(new THREE.BoxGeometry(0.8, 0.02, 0.9).translate(cx, 0.07, cz), smat(null, '#c8a050', { emissive: '#6a4a10', ei: 0.25, transparent: true, opacity: 0.3 }), false)); }
  if (cut) { const lp = new THREE.PointLight(0xffc070, 0.9, 3.5); lp.position.set(cx + 0.8, 1.2, cz + 0.8); o.add(lp); }
  return o;
}
// ---------- construções do vilarejo ----------
const BSTYLE = {
  temple: { wall: '#d8d0bc', roof: '#46587a', tex: 'brick', roofTex: 'slate', trim: '#c9a24a' },
  shop: { wall: '#e6d6b0', roof: '#9a3c2a', tex: 'plaster', roofTex: 'shingle', trim: '#4a2f17' },
  tavern: { wall: '#dccaa0', roof: '#a8883a', tex: 'plaster', roofTex: 'thatch', trim: '#3a2410' },
  smith: { wall: '#8e897e', roof: '#4e4844', tex: 'brick', roofTex: 'slate', trim: '#2a1e14' },
  barracks: { wall: '#9c968a', roof: '#5e4034', tex: 'brick', roofTex: 'shingle', trim: '#2a1e14' },
  stable: { wall: '#9a7850', roof: '#b0903a', tex: 'wood', roofTex: 'thatch', trim: '#3a2410' },
  stairtower: { wall: '#a29c90', roof: '#3e4a66', tex: 'brick', roofTex: 'slate', trim: '#2a1e14' },
};
// variações de casas e lojas (cores de reboco, telhados e madeira)
const HVAR = [
  { wall: '#e4d8bc', roof: '#8a3a2a', roofTex: 'shingle', trim: '#4a2f17' },
  { wall: '#d8c8a0', roof: '#a8943e', roofTex: 'thatch', trim: '#3a2410' },
  { wall: '#e8e0cc', roof: '#4e5464', roofTex: 'slate', trim: '#2e2218' },
  { wall: '#d4b890', roof: '#7a3426', roofTex: 'shingle', trim: '#3a2410' },
  { wall: '#cfc4ae', roof: '#6a5a4a', roofTex: 'slate', trim: '#4a3020' },
  { wall: '#e2cfa8', roof: '#9a8034', roofTex: 'thatch', trim: '#5a3a1e' },
];
function styleOf(b) {
  if (b.kind === 'house' || (b.kind === 'shop' && b.v)) { const h = HVAR[(b.v || 0) % HVAR.length]; return { tex: 'plaster', ...h }; }
  return BSTYLE[b.kind];
}
function bldDims(b) { return { H: b.H || h3(b.wall * 2), RH: b.RH || h3(b.roof * 2) }; }
function bldWinList(b) { return b.kind === 'temple' ? [['R', 0.25], ['R', 0.75], ['L', 0.2], ['L', 0.8]] : b.kind === 'house' || b.kind === 'stable' ? [['R', 0.5], ['L', 0.22]] : [['R', 0.3], ['R', 0.72], ['L', 0.16], ['L', 0.84]]; }
// telhado: cada face é um polígono com UV que segue a inclinação
function roofFace(pts, m) {
  const a = pts[0], b = pts[1], e = new THREE.Vector3().subVectors(b, a).normalize();
  let n = new THREE.Vector3().subVectors(pts[1], pts[0]).cross(new THREE.Vector3().subVectors(pts[2], pts[0])).normalize();
  if (n.y < 0) { pts = pts.slice().reverse(); n.negate(); }
  const s = new THREE.Vector3().crossVectors(n, e).normalize();
  const pos = [], uv = [];
  const tri = (p, q, r) => { for (const v of [p, q, r]) { pos.push(v.x, v.y, v.z); const d = new THREE.Vector3().subVectors(v, a); uv.push(d.dot(e) * 1.2, d.dot(s) * 1.2); } };
  tri(pts[0], pts[1], pts[2]); if (pts.length === 4) tri(pts[0], pts[2], pts[3]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return mk(g, m);
}
// sujeira e umidade: escurece a base das paredes (cor por vértice)
function grime(g, H, seed) {
  const p = g.attributes.position, col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const y = p.getY(i), t = clamp(y / Math.min(1.4, H), 0, 1), n = 0.9 + vnoise(p.getX(i) * 2 + seed, p.getZ(i) * 2, 3) * 0.1, v = (0.62 + 0.38 * Math.sqrt(t)) * n; col[i * 3] = v; col[i * 3 + 1] = v * 0.98; col[i * 3 + 2] = v * 0.94; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
function gwall(w, h, d, x, y, z, kind, hex, H, seed, sc = 0.7, bump = 1.2) {
  const g = new THREE.BoxGeometry(w, h, d, Math.max(1, Math.round(w * 2)), Math.max(2, Math.round(h * 2)), Math.max(1, Math.round(d * 2))).translate(x, y, z);
  wuv(g, sc); grime(g, H, seed);
  return mk(g, smat(kind, hex, { vc: true, bump }));
}
function mCastle(b, night) {
  const w = b.w, h = b.h, { H, RH } = bldDims(b), o = grp(), seed = 3.7;
  const wallC = '#b4ad9c', roofM = smat('slate', '#3e4a66', { bump: 1.6 }), capM = smat('stoneblock', '#c4bcaa', { bump: 1 }), gold = smat(null, '#e2b74e', { metal: 1, rough: 0.3 });
  const glassM = night ? smat(null, '#ffd890', { emissive: '#ffb850', ei: 1.6, rough: 0.3 }) : smat(null, '#24323e', { rough: 0.08, metal: 0.4 });
  o.add(gwall(w, H, h, w / 2, H / 2, h / 2, 'brick', wallC, H, seed, 0.8, 1.4));
  o.add(wbox(w + 0.12, 0.6, h + 0.12, w / 2, 0.3, h / 2, smat('stoneblock', '#8a857a', { bump: 1.5 }), 1));
  o.add(wbox(w + 0.14, 0.14, h + 0.14, w / 2, H - 0.07, h / 2, capM, 1));
  // janelas góticas altas em duas fileiras
  const gwin = (x, y, z, ry, tall) => { const g = grp(); const ww = 0.5, wh = tall ? 1.5 : 0.9; g.add(mk(new THREE.BoxGeometry(ww + 0.14, wh + 0.1, 0.08), capM)); g.add(mk(new THREE.ConeGeometry(ww / 2 + 0.07, 0.45, 4, 1).rotateY(Math.PI / 4).scale(1, 1, 0.25).translate(0, wh / 2 + 0.2, 0), capM)); g.add(mk(new THREE.BoxGeometry(ww, wh, 0.04).translate(0, 0, 0.03), glassM)); g.add(mk(new THREE.BoxGeometry(0.03, wh, 0.05).translate(0, 0, 0.05), capM)); g.position.set(x, y, z); g.rotation.y = ry; o.add(g); };
  const dc = doorCol(b) + 0.5;
  for (let k = 0; k < 6; k++) { const u = (k + 0.5) * w / 6; if (Math.abs(u - dc) > 1.2) gwin(u, 1.6, h + 0.03, 0, true); gwin(u, H - 1.3, h + 0.03, 0, false); }
  for (let k = 0; k < 5; k++) { const u = (k + 0.5) * h / 5; gwin(w + 0.03, 1.6, u, Math.PI / 2, true); gwin(w + 0.03, H - 1.3, u, Math.PI / 2, false); }
  // ameias no alto das paredes
  for (let k = 0; k < w * 2; k++) o.add(mk(wuv(new THREE.BoxGeometry(0.3, 0.4, 0.22).translate(0.25 + k * 0.5, H + 0.2, h - 0.05), 1.5), capM));
  for (let k = 0; k < h * 2; k++) o.add(mk(wuv(new THREE.BoxGeometry(0.22, 0.4, 0.3).translate(w - 0.05, H + 0.2, 0.25 + k * 0.5), 1.5), capM));
  // telhado de quatro águas inclinado
  const ov = 0.1, A = V3(ov, H, ov), B = V3(w - ov, H, ov), C = V3(w - ov, H, h - ov), D = V3(ov, H, h - ov), r1 = V3(h / 2, H + RH, h / 2), r2 = V3(w - h / 2, H + RH, h / 2);
  for (const f of [[D, C, r2, r1], [B, A, r1, r2], [A, D, r1], [C, B, r2]]) o.add(roofFace(f, roofM));
  // torres nos cantos com telhado cônico
  for (const [tx, tz] of [[0, 0], [w, 0], [0, h], [w, h]]) {
    const th = H + 5, tr = 1.05;
    o.add(mk(cylUV(new THREE.CylinderGeometry(tr, tr + 0.06, th, 24, 4, true).translate(tx, th / 2, tz), 6, 1), smat('brick', wallC, { bump: 1.4 })));
    o.add(mk(cylUV(new THREE.CylinderGeometry(tr + 0.12, tr, 0.16, 24, 1, true).translate(tx, th + 0.08, tz), 6, 1), capM));
    o.add(mk(cylUV(new THREE.ConeGeometry(tr + 0.25, 2.8, 24, 4, true).translate(tx, th + 0.16 + 1.4, tz), 8, 1.2), roofM));
    o.add(mk(new THREE.SphereGeometry(0.09, 10, 8).translate(tx, th + 3.05, tz), gold));
    for (const a of [Math.PI / 4, Math.PI / 4 + 0.8]) { const wnd = mk(new THREE.BoxGeometry(0.2, 0.5, 0.1), glassM); wnd.position.set(tx + Math.cos(a) * tr, th * 0.7, tz + Math.sin(a) * tr); wnd.rotation.y = -a + Math.PI / 2; o.add(wnd); }
  }
  // torre de menagem central (alta, estilo Hogwarts)
  { const cx = w / 2, cz = 2.3, s2 = 3.2, th = H + 11;
    o.add(gwall(s2, th, s2, cx, th / 2, cz, 'brick', wallC, th, seed + 1, 0.8, 1.4));
    o.add(wbox(s2 + 0.2, 0.16, s2 + 0.2, cx, th - 0.08, cz, capM, 1));
    for (const [x, z, ry] of [[cx, cz + s2 / 2 + 0.03, 0], [cx + s2 / 2 + 0.03, cz, Math.PI / 2]]) { gwin(x, th - 1.4, z, ry, true); gwin(x, th - 3.6, z, ry, false); }
    o.add(mk(new THREE.ConeGeometry(s2 * 0.82, 4.2, 4, 1).rotateY(Math.PI / 4).translate(cx, th + 2.1, cz), roofM));
    o.add(mk(new THREE.SphereGeometry(0.14, 10, 8).translate(cx, th + 4.3, cz), gold));
    o.add(mk(CYL(0.02, 0.02, 1.2, cx, th + 4.9, cz, 6), DWOOD()));
    o.add(mk(new THREE.PlaneGeometry(0.9, 0.5, 4, 1).translate(cx + 0.46, th + 5.2, cz), smat('cloth', '#7a1a1c', { side: THREE.DoubleSide })));
  }
  // entrada principal: portal alto em arco, escadaria e estandartes
  { const g = grp(), dw = 1.6, dh = 2.8;
    g.add(mk(new THREE.BoxGeometry(dw + 0.5, dh + 0.3, 0.2).translate(0, (dh + 0.3) / 2, 0.06), capM));
    g.add(mk(new THREE.BoxGeometry(dw, dh, 0.06).translate(0, dh / 2, 0.17), smat('wood', '#5a3a1e', { bump: 1.5 })));
    g.add(mk(new THREE.CylinderGeometry(dw / 2, dw / 2, 0.06, 16, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2).translate(0, dh, 0.17), smat('wood', '#5a3a1e')));
    for (let k = 0; k < 3; k++) g.add(wbox(dw + 1.4 - k * 0.3, 0.15, 0.5, 0, 0.075 + k * 0.15, 0.6 - k * 0.2, smat('stoneblock', '#9a948a'), 1.5));
    for (const sx of [-1.25, 1.25]) { g.add(mk(new THREE.PlaneGeometry(0.6, 1.8).translate(sx, 2.6, 0.2), smat('cloth', '#7a1a1c', { side: THREE.DoubleSide }))); g.add(mk(new THREE.CircleGeometry(0.18, 12).translate(sx, 2.9, 0.21), gold)); }
    g.position.set(dc, 0, h); o.add(g); }
  return o;
}
// monta o prédio no quadro local (porta virada para +z) e gira para o lado certo;
// a origem fica no canto da área do prédio (igual ao desenho antigo)
function localB(b) { const [A, D] = bDims(b); return { ...b, w: A, h: D, door: 'S', x: b.arch != null ? 40 + b.arch * 7 : b.x, y: b.arch != null ? 40 + b.arch * 13 : b.y }; }
function placeRot(b, inner) {
  const [A, D] = bDims(b), root = grp(), mid = grp(inner);
  inner.position.set(-A / 2, 0, -D / 2);
  mid.rotation.y = DOOR_ROT[b.door || 'S']; mid.position.set(b.w / 2, 0, b.h / 2); root.add(mid);
  return root;
}
function mBuildingRot(b, night) { return placeRot(b, mBuilding(localB(b), night)); }
function mBuilding(b, night) {
  if (b.kind === 'castle') return mCastle(b, night);
  if (b.kind === 'stairtower') return mStairTower(b, false);
  const w = b.w, h = b.h, { H, RH } = bldDims(b), o = grp(), R = rng(b.x * 31 + b.y * 7), seed = b.x * 0.37 + b.y;
  const st = styleOf(b);
  const trimM = smat('wood', st.trim, { bump: 1 }), stoneM = '#8e887c';
  const floors = b.floors || Math.max(1, Math.round(H / 1.5)), fh = H / floors;
  const timber = st.tex === 'plaster';
  // térreo de pedra nas casas de 2+ andares; andares de cima em enxaimel avançando sobre a rua
  const jet = timber && floors >= 2 ? 0.22 : 0;
  const baseH = timber && floors >= 2 ? fh : 0;
  if (baseH) {
    o.add(gwall(w, baseH, h, w / 2, baseH / 2, h / 2, 'brick', stoneM, H, seed, 0.9, 1.5));
    o.add(gwall(w + jet, H - baseH, h + jet, w / 2 + jet / 2, baseH + (H - baseH) / 2, h / 2 + jet / 2, 'plaster', st.wall, H + 2, seed, 0.6, 0.8));
    // vigas que sustentam o andar avançado
    for (let k = 0; k <= w; k++) { const m = mk(new THREE.BoxGeometry(0.1, 0.1, jet + 0.14), trimM); m.position.set(Math.min(w - 0.05, Math.max(0.05, k)), baseH - 0.05, h + jet / 2 - 0.02); o.add(m); }
    for (let k = 0; k <= h; k++) { const m = mk(new THREE.BoxGeometry(jet + 0.14, 0.1, 0.1), trimM); m.position.set(w + jet / 2 - 0.02, baseH - 0.05, Math.min(h - 0.05, Math.max(0.05, k))); o.add(m); }
  } else {
    o.add(gwall(w, H, h, w / 2, H / 2, h / 2, st.tex, st.wall, H, seed, st.tex === 'brick' ? 0.8 : 0.7, st.tex === 'plaster' ? 0.8 : 1.4));
    if (st.tex !== 'brick') o.add(wbox(w + 0.08, 0.45, h + 0.08, w / 2, 0.22, h / 2, smat('stoneblock', '#8a857a', { bump: 1.5 }), 1.2));
  }
  const W2 = w + jet, H2 = h + jet;          // medidas da parte de cima (com o avanço)
  // enxaimel
  if (timber) {
    const beam = (x0, y0, z0, x1, y1, z1) => { const a = V3(x0, y0, z0), c = V3(x1, y1, z1), d = new THREE.Vector3().subVectors(c, a), L = d.length(); const m = mk(new THREE.BoxGeometry(0.1, L, 0.05), trimM); m.position.copy(a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(V3(0, 1, 0), d.normalize()); return m; };
    const y0 = baseH || 0.45, fz = (baseH ? H2 : h) + 0.025, fx = (baseH ? W2 : w) + 0.025, ww = baseH ? W2 : w, hh = baseH ? H2 : h;
    const nX = Math.max(2, Math.round(ww / 0.9)), nZ = Math.max(2, Math.round(hh / 0.9));
    for (let k = 0; k <= nX; k++) o.add(beam(k * ww / nX, y0, fz, k * ww / nX, H, fz));
    for (let k = 0; k <= nZ; k++) o.add(beam(fx, y0, k * hh / nZ, fx, H, k * hh / nZ));
    for (let f = 0; f <= floors; f++) { const y = f === floors ? H - 0.05 : Math.max(y0, f * fh); if (y < y0 - 0.01) continue; o.add(beam(0, y, fz, ww, y, fz)); o.add(beam(fx, y, 0, fx, y, hh)); }
    for (let k = 0; k < nX; k++) if (k % 2 === 0) o.add(beam(k * ww / nX, y0, fz, (k + 1) * ww / nX, Math.min(H, y0 + fh * 0.6), fz));
    for (let k = 0; k < nZ; k++) if (k % 2 === 1) o.add(beam(fx, y0, (k + 1) * hh / nZ, fx, Math.min(H, y0 + fh * 0.6), k * hh / nZ));
  } else if (st.tex === 'brick') {
    // pedras de canto alternadas (cunhais)
    for (const [x, z] of [[w, h], [0, h], [w, 0]]) for (let y = 0; y < H - 0.1; y += 0.36) { const big = Math.round(y / 0.36) % 2; o.add(wbox(big ? 0.36 : 0.22, 0.32, big ? 0.22 : 0.36, x, y + 0.17, z, smat('stoneblock', shadeH(st.wall, 0.06)), 1.4)); }
    o.add(wbox(w + 0.1, 0.16, h + 0.1, w / 2, H - 0.08, h / 2, smat('stoneblock', shadeH(st.wall, 0.08)), 1.4));
  }
  // janelas em arco com venezianas, uma fileira por andar
  const glassM = night ? smat(null, '#ffd890', { emissive: '#ffb850', ei: 1.6, rough: 0.3 }) : smat(null, '#24323e', { rough: 0.08, metal: 0.4 });
  const shutM = smat('wood', ['#3e5a3a', '#6a2a22', '#3a4a6a', '#5a4026'][(b.v || 0) % 4], { bump: 1 });
  const winAt = (face, u, y, small) => {
    const ww = small ? 0.32 : 0.38, wh = Math.min(small ? 0.5 : 0.62, fh * 0.42), gO = grp();
    gO.add(mk(new THREE.BoxGeometry(ww + 0.1, wh + 0.08, 0.06), trimM));
    gO.add(mk(new THREE.CylinderGeometry(ww / 2 + 0.05, ww / 2 + 0.05, 0.06, 14, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2).translate(0, wh / 2, 0), trimM));
    gO.add(mk(new THREE.BoxGeometry(ww, wh, 0.02).translate(0, 0, 0.025), glassM));
    gO.add(mk(new THREE.CylinderGeometry(ww / 2, ww / 2, 0.02, 14, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2).translate(0, wh / 2, 0.025), glassM));
    gO.add(mk(new THREE.BoxGeometry(0.03, wh + ww / 2, 0.03).translate(0, ww / 4, 0.04), trimM));
    gO.add(mk(new THREE.BoxGeometry(ww, 0.03, 0.03).translate(0, 0, 0.04), trimM));
    gO.add(mk(new THREE.BoxGeometry(ww + 0.16, 0.05, 0.12).translate(0, -wh / 2 - 0.04, 0.04), smat('stoneblock', '#9a948a')));
    if (timber) for (const sgn of [-1, 1]) { const sh = mk(wuv(new THREE.BoxGeometry(ww * 0.52, wh + 0.1, 0.03), 3), shutM); sh.position.set(sgn * (ww * 0.78 + 0.05), 0, 0.05); sh.rotation.y = sgn * 0.25; gO.add(sh); }
    if (timber && R() < 0.4) { gO.add(mk(new THREE.BoxGeometry(ww + 0.1, 0.1, 0.16).translate(0, -wh / 2 - 0.12, 0.1), trimM)); for (let k = 0; k < 4; k++) gO.add(mk(new THREE.SphereGeometry(0.05, 6, 5).translate(-ww / 2 + 0.06 + k * ww / 3.4, -wh / 2 - 0.03, 0.12), smat(null, ['#c83a3a', '#e8b030', '#e86aa8', '#f2ede0'][k % 4], { rough: 0.6 }))); }
    const jz = y > baseH && baseH ? jet : 0;
    if (face === 'L') gO.position.set(u, y, h + jz + 0.02); else { gO.position.set(w + jz + 0.02, y, u); gO.rotation.y = Math.PI / 2; }
    o.add(gO);
  };
  const doorX = doorCol(b) + 0.5;
  for (let f = 0; f < floors; f++) {
    const y = f * fh + fh * 0.55;
    const nL = Math.max(1, Math.floor(w / 1.5)), nR = Math.max(1, Math.floor(h / 1.5));
    for (let k = 0; k < nL; k++) { const u = (k + 0.5) * w / nL; if (f === 0 && Math.abs(u - doorX) < 0.8) continue; winAt('L', u, y, f > 0); }
    for (let k = 0; k < nR; k++) winAt('R', (k + 0.5) * h / nR, y, f > 0);
  }
  // porta em arco
  {
    const dw = b.kind === 'temple' ? 1.3 : 0.95, dh = b.kind === 'temple' ? 2.5 : 1.85, gD = grp();
    gD.add(mk(new THREE.BoxGeometry(dw + 0.2, dh + 0.08, 0.08).translate(0, dh / 2, 0), smat('stoneblock', '#8e897e')));
    gD.add(mk(new THREE.CylinderGeometry(dw / 2 + 0.1, dw / 2 + 0.1, 0.08, 16, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2).translate(0, dh, 0), smat('stoneblock', '#8e897e')));
    const doorM = smat('wood', '#6e4626', { bump: 1.5 });
    gD.add(mk(new THREE.BoxGeometry(dw, dh, 0.04).translate(0, dh / 2, 0.03), doorM));
    gD.add(mk(new THREE.CylinderGeometry(dw / 2, dw / 2, 0.04, 16, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2).translate(0, dh, 0.03), doorM));
    for (const y of [0.35, dh - 0.3]) gD.add(mk(new THREE.BoxGeometry(dw * 0.9, 0.05, 0.02).translate(0, y, 0.06), IRON()));
    gD.add(mk(new THREE.SphereGeometry(0.035, 8, 6).translate(dw * 0.32, dh * 0.5, 0.07), smat(null, '#c9a24a', { metal: 1, rough: 0.3 })));
    gD.add(mk(new THREE.BoxGeometry(dw + 0.5, 0.12, 0.5).translate(0, 0.06, 0.25), smat('stoneblock', '#8a857a')));   // degrau
    gD.position.set(doorX, 0, h + 0.02); gD.scale.setScalar(0.62);
    o.add(gD);
  }
  // telhado: duas águas (oitões) ou quatro águas, com beiral
  const ov = 0.42, roofM = smat(st.roofTex, st.roof, { bump: st.roofTex === 'thatch' ? 2 : 1.6 }), ridgeX = W2 >= H2;
  const gable = b.kind === 'house' ? (b.v || 0) % 2 === 0 : b.kind === 'shop' || b.kind === 'barracks';
  const A = V3(-ov, H, -ov), B = V3(W2 + ov, H, -ov), C = V3(W2 + ov, H, H2 + ov), D = V3(-ov, H, H2 + ov);
  let r1, r2;
  if (gable) { r1 = ridgeX ? V3(-ov, H + RH, H2 / 2) : V3(W2 / 2, H + RH, -ov); r2 = ridgeX ? V3(W2 + ov, H + RH, H2 / 2) : V3(W2 / 2, H + RH, H2 + ov); }
  else { r1 = ridgeX ? V3(H2 / 2, H + RH, H2 / 2) : V3(W2 / 2, H + RH, W2 / 2); r2 = ridgeX ? V3(W2 - H2 / 2, H + RH, H2 / 2) : V3(W2 / 2, H + RH, H2 - W2 / 2); }
  const faces = gable ? (ridgeX ? [[D, C, r2, r1], [B, A, r1, r2]] : [[A, D, r2, r1], [C, B, r1, r2]]) : (ridgeX ? [[D, C, r2, r1], [B, A, r1, r2], [A, D, r1], [C, B, r2]] : [[A, D, r2, r1], [C, B, r1, r2], [B, A, r1], [D, C, r2]]);
  for (const f of faces) { const pts = f.filter((p, i) => i === 0 || !p.equals(f[i - 1])); if (pts.length >= 3) o.add(roofFace(pts, roofM)); }
  if (gable) {
    // oitões (paredes triangulares nas pontas) com uma janelinha
    const gm = smat(timber ? 'plaster' : st.tex, shadeH(st.wall, -0.12), { bump: 1, side: THREE.DoubleSide });
    const tri = (p, q, t) => { const g = new THREE.BufferGeometry().setFromPoints([p, q, t]); g.computeVertexNormals(); wuv(g, 0.7); return mk(g, gm); };
    if (ridgeX) { o.add(tri(V3(W2, H, 0), V3(W2, H, H2), V3(W2, H + RH * (H2 / 2) / (H2 / 2 + ov), H2 / 2))); o.add(tri(V3(0, H, H2), V3(0, H, 0), V3(0, H + RH * (H2 / 2) / (H2 / 2 + ov), H2 / 2))); }
    else { o.add(tri(V3(0, H, H2), V3(W2, H, H2), V3(W2 / 2, H + RH * (W2 / 2) / (W2 / 2 + ov), H2))); o.add(tri(V3(W2, H, 0), V3(0, H, 0), V3(W2 / 2, H + RH * (W2 / 2) / (W2 / 2 + ov), 0))); }
    const gw = mk(new THREE.CircleGeometry(0.18, 12), glassM);
    if (ridgeX) { gw.position.set(W2 + 0.03, H + RH * 0.3, H2 / 2); gw.rotation.y = Math.PI / 2; } else { gw.position.set(W2 / 2, H + RH * 0.3, H2 + 0.03); }
    o.add(gw);
  }
  const edge = smat('wood', shadeH(st.roof, -0.5));
  for (const [p, q] of [[D, C], [C, B]]) { const d = new THREE.Vector3().subVectors(q, p), L = d.length(); const m = mk(new THREE.BoxGeometry(L, 0.1, 0.06), edge); m.position.copy(p).addScaledVector(d, 0.5); m.position.y -= 0.05; m.rotation.y = -Math.atan2(d.z, d.x); o.add(m); }
  if (!r1.equals(r2)) { const d = new THREE.Vector3().subVectors(r2, r1); o.add(limb(r1.clone().addScaledVector(d, -0.02), r2.clone().addScaledVector(d, 0.02), 0.07, 0.07, smat(st.roofTex === 'thatch' ? 'thatch' : 'stoneblock', shadeH(st.roof, st.roofTex === 'thatch' ? -0.1 : 0.15)), 8)); }
  // água-furtada (janela no telhado) nas casas grandes
  if (!gable && RH > 2.4 && W2 >= 5) { const dx = W2 * 0.35, gD = grp(); gD.add(wbox(0.8, 0.8, 0.9, 0, 0.4, 0, smat('plaster', st.wall), 1)); gD.add(mk(new THREE.ConeGeometry(0.66, 0.55, 4).rotateY(Math.PI / 4).translate(0, 1.07, 0), roofM)); const gw = mk(new THREE.BoxGeometry(0.38, 0.46, 0.02).translate(0, 0.42, 0.46), glassM); gD.add(gw); gD.position.set(dx, H + RH * 0.3, H2 - (H2 / 2) * 0.62); o.add(gD); }
  // chaminé
  if (b.kind === 'tavern' || b.kind === 'house' || b.kind === 'smith') {
    const cx = W2 * 0.3, cz = H2 * 0.35, top = H + RH * 0.85 + 0.6;
    o.add(wbox(0.46, top - H + 0.2, 0.46, cx, (top + H - 0.2) / 2, cz, smat('brick', '#8a8478', { bump: 1.4 }), 2));
    o.add(wbox(0.56, 0.1, 0.56, cx, top + 0.05, cz, smat('stoneblock', '#6a665e'), 2));
  }
  // catedral: torre do sino com flecha e sol dourado + vitrais
  if (b.kind === 'temple') {
    const mx = W2 * 0.5, mz = H2 * 0.5, base = H + RH * 0.3, th = RH * 0.7 + 7;
    o.add(gwall(1.5, th, 1.5, mx, base + th / 2, mz, 'brick', st.wall, th + base, seed, 0.8, 1.2));
    for (const [dx, dz, ry] of [[0, 0.76, 0], [0.76, 0, Math.PI / 2]]) { const a = mk(new THREE.BoxGeometry(0.5, 0.9, 0.04), smat(null, '#141210')); a.position.set(mx + dx, base + th - 0.7, mz + dz); a.rotation.y = ry; o.add(a); }
    o.add(mk(new THREE.BoxGeometry(1.65, 0.14, 1.65).translate(mx, base + th, mz), smat('stoneblock', '#b4ae9f')));
    o.add(mk(new THREE.ConeGeometry(1.1, 3.2, 4).rotateY(Math.PI / 4).translate(mx, base + th + 1.65, mz), roofM));
    o.add(mk(new THREE.SphereGeometry(0.16, 14, 10).translate(mx, base + th + 3.4, mz), smat(null, '#e2b74e', { metal: 1, rough: 0.25, emissive: '#6a5010', ei: 0.6 })));
    const rose = mk(new THREE.CircleGeometry(0.6, 20), smat(null, night ? '#ffcc80' : '#2e2440', { emissive: night ? '#ffaa40' : '#000000', ei: night ? 1.4 : 0, rough: 0.15, metal: 0.3 }));
    rose.position.set(w * 0.5, H * 0.76, h + 0.05); o.add(rose);
    o.add(mk(new THREE.TorusGeometry(0.62, 0.06, 6, 24).translate(w * 0.5, H * 0.76, h + 0.05), smat('stoneblock', '#b4ae9f')));
  }
  // letreiros grandes com emblema 3D + vitrine com mercadorias (o prédio se explica sozinho)
  if (b.kind === 'shop' || b.kind === 'tavern' || b.kind === 'smith') {
    const kind = b.kind === 'shop' ? 'shop' + (b.v || 0) : b.kind;
    const x = Math.min(w - 0.35, doorX + 0.75), y = Math.min(fh * 0.85, 1.35), gS = grp();
    gS.add(mk(new THREE.BoxGeometry(0.05, 0.05, 0.75).translate(0, 0.05, 0.37), IRON()));
    gS.add(mk(new THREE.TorusGeometry(0.12, 0.012, 4, 10, Math.PI).rotateY(Math.PI / 2).translate(0, -0.05, 0.6), IRON()));
    gS.add(mk(wuv(new THREE.BoxGeometry(0.05, 0.62, 0.7).translate(0, -0.38, 0.6), 2), smat('wood', '#6a4a2c')));
    gS.add(mk(new THREE.BoxGeometry(0.06, 0.66, 0.74).translate(0, -0.38, 0.6), smat('wood', '#3a2414')).translateX(-0.01));
    const em = grp(); em.position.set(0.06, -0.38, 0.6);
    const goldM = smat(null, '#e2b74e', { metal: 1, rough: 0.3 });
    if (kind === 'shop0') { for (let k = 0; k < 4; k++) em.add(mk(new THREE.CylinderGeometry(0.11, 0.11, 0.035, 16).rotateZ(Math.PI / 2).translate(0.02, -0.12 + k * 0.05, -0.08 + k * 0.03), goldM)); em.add(mk(new THREE.SphereGeometry(0.11, 10, 8).scale(0.6, 1, 1).translate(0.03, 0.05, 0.12), smat('cloth', '#a88a5a'))); }
    else if (kind === 'shop1') { em.add(mk(new THREE.SphereGeometry(0.13, 12, 10).translate(0.03, -0.06, 0), smat(null, '#3ad878', { emissive: '#1a8a4a', ei: 0.9, rough: 0.1, transparent: true, opacity: 0.85 }))); em.add(mk(new THREE.CylinderGeometry(0.04, 0.05, 0.14, 8).translate(0.03, 0.12, 0), smat(null, '#c8e8d8', { rough: 0.1 }))); em.add(mk(new THREE.CylinderGeometry(0.045, 0.045, 0.04, 8).translate(0.03, 0.2, 0), smat('wood', '#6a4a2c'))); }
    else if (kind === 'shop2') { const st2 = new THREE.Shape(); for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2 + Math.PI / 2, rr = k % 2 ? 0.08 : 0.2; st2[k ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr); } em.add(mk(new THREE.ExtrudeGeometry(st2, { depth: 0.03, bevelEnabled: false }).rotateY(Math.PI / 2), smat(null, '#b080ff', { emissive: '#6a3ad8', ei: 1.2, rough: 0.3 }))); em.add(mk(new THREE.CylinderGeometry(0.012, 0.012, 0.42, 6).rotateX(0.7).translate(0.04, -0.05, 0), smat('wood', '#3a2414'))); }
    else if (kind === 'shop3') { for (const a of [0.6, -0.6]) { const bl = mk(new THREE.BoxGeometry(0.02, 0.4, 0.05), smat(null, '#c8ccd4', { metal: 0.9, rough: 0.3 })); bl.rotation.x = a; bl.position.set(0.03, 0, 0); em.add(bl); } for (const z of [-0.09, 0.09]) em.add(mk(new THREE.TorusGeometry(0.05, 0.015, 6, 12).rotateY(Math.PI / 2).translate(0.03, -0.17, z), goldM)); }
    else if (kind === 'shop4') { em.add(mk(new THREE.CylinderGeometry(0.06, 0.06, 0.42, 12).rotateX(Math.PI / 2).translate(0.04, 0.05, 0), smat('cloth', '#e8dcb8'))); em.add(mk(new THREE.BoxGeometry(0.02, 0.22, 0.36).translate(0.03, -0.1, 0), smat('cloth', '#e0d2a8'))); for (const z of [-0.21, 0.21]) em.add(mk(new THREE.CylinderGeometry(0.03, 0.03, 0.08, 8).rotateX(Math.PI / 2).translate(0.04, 0.05, z), smat('wood', '#5a3a1e'))); }
    else if (kind === 'tavern') { em.add(mk(new THREE.CylinderGeometry(0.12, 0.1, 0.28, 12).translate(0.06, -0.02, 0), smat('wood', '#a8783a'))); em.add(mk(new THREE.CylinderGeometry(0.12, 0.12, 0.06, 12).translate(0.06, 0.13, 0), smat(null, '#f4ead4', { rough: 0.9 }))); em.add(mk(new THREE.TorusGeometry(0.07, 0.02, 5, 10, Math.PI).rotateY(Math.PI / 2).rotateX(Math.PI / 2).translate(0.06, 0, 0.15), smat('wood', '#7a5428'))); }
    else if (kind === 'smith') { em.add(mk(new THREE.BoxGeometry(0.1, 0.1, 0.36).translate(0.04, 0.02, 0), smat(null, '#3a3a40', { metal: 0.9, rough: 0.4 }))); em.add(mk(new THREE.BoxGeometry(0.1, 0.12, 0.14).translate(0.04, -0.09, 0), smat(null, '#3a3a40', { metal: 0.9, rough: 0.4 }))); const hm = grp(mk(new THREE.BoxGeometry(0.03, 0.34, 0.03), smat('wood', '#6a4a2c')), mk(new THREE.BoxGeometry(0.07, 0.07, 0.15).translate(0, 0.16, 0), smat(null, '#9a9ca4', { metal: 0.9 }))); hm.position.set(0.07, 0.12, 0.12); hm.rotation.x = -0.8; em.add(hm); }
    gS.add(em);
    gS.position.set(x, y, h + (y > baseH && baseH ? jet : 0)); gS.scale.setScalar(0.72);
    o.add(gS);
    // vitrine saliente com mercadorias ao lado da porta (térreo)
    if (b.kind === 'shop') {
      const vx = doorX + 1.45 < w - 0.6 ? doorX + 1.45 : doorX - 1.45, gV = grp(), wd = 1.25, ht = 0.95, y0 = 0.55;
      gV.add(mk(wuv(new THREE.BoxGeometry(wd + 0.16, 0.12, 0.42).translate(0, y0 - 0.06, 0.16), 2), trimM));
      gV.add(mk(wuv(new THREE.BoxGeometry(wd + 0.16, 0.1, 0.42).translate(0, y0 + ht + 0.05, 0.16), 2), trimM));
      for (const ex of [-wd / 2 - 0.04, wd / 2 + 0.04]) gV.add(mk(new THREE.BoxGeometry(0.08, ht, 0.42).translate(ex, y0 + ht / 2, 0.16), trimM));
      gV.add(mk(new THREE.BoxGeometry(wd, ht, 0.02).translate(0, y0 + ht / 2, 0.36), smat(null, '#9ab8c8', { rough: 0.05, metal: 0.2, transparent: true, opacity: 0.32 }), false));
      gV.add(mk(new THREE.BoxGeometry(wd, ht, 0.02).translate(0, y0 + ht / 2, -0.02), smat(null, '#1a1410')));
      const cols = [['#c8a050', '#8a5a2a', '#d8d0b0'], ['#3ad878', '#d84a6a', '#5aa8f0'], ['#6a3ad8', '#2a2a6a', '#e2b74e'], ['#c83a3a', '#3a5ac8', '#e8d8b0'], ['#e8dcb8', '#c8b080', '#8a6a3a']][b.v || 0];
      for (let k = 0; k < 7; k++) { const it = k % 3, c = cols[k % 3], px = -wd / 2 + 0.15 + k * (wd - 0.3) / 6, py = y0 + 0.08 + (k % 2) * 0.42;
        const m = (b.v === 1) ? new THREE.CylinderGeometry(0.04, 0.05, 0.16, 8) : (b.v === 2) ? new THREE.BoxGeometry(0.08, 0.2, 0.14) : (b.v === 3) ? new THREE.CylinderGeometry(0.06, 0.06, 0.26, 10).rotateZ(Math.PI / 2) : (b.v === 4) ? new THREE.CylinderGeometry(0.035, 0.035, 0.26, 8).rotateZ(Math.PI / 2) : (it ? new THREE.SphereGeometry(0.07, 8, 6) : new THREE.BoxGeometry(0.14, 0.14, 0.14));
        gV.add(mk(m.translate(px, py + 0.08, 0.16), smat(null, c, { rough: b.v === 1 ? 0.1 : 0.6, emissive: b.v === 2 && it === 2 ? '#8a6a20' : undefined, ei: 0.5 }))); }
      gV.add(mk(new THREE.PlaneGeometry(wd + 0.5, 0.6).rotateX(-Math.PI / 2 + 0.55).translate(0, y0 + ht + 0.32, 0.42), smat('stripes', '#ffffff', { side: THREE.DoubleSide, bump: 0.3 })));
      gV.position.set(vx, 0, h + 0.02); gV.scale.setScalar(0.66); o.add(gV);
    }
    // lampião ao lado da porta
    const lp = grp(mk(new THREE.BoxGeometry(0.04, 0.04, 0.25).translate(0, 0, 0.12), IRON()), mk(new THREE.BoxGeometry(0.14, 0.2, 0.14).translate(0, -0.12, 0.25), smat(null, '#ffd890', { emissive: '#ffbb60', ei: night ? 1.6 : 0.6 })));
    lp.position.set(doorX - 0.55, 1.15, h + 0.02); lp.scale.setScalar(0.7); o.add(lp);
  }
  if (b.kind === 'tavern' || b.kind === 'shop') { const br = mBarrel(); br.scale.setScalar(0.8); br.position.set(w + 0.32, 0, h * 0.25); o.add(br); }
  if (b.kind === 'stable') { const hy = mHay(); hy.position.set(w + 0.5, 0, h * 0.5); hy.rotation.y = Math.PI / 2; o.add(hy); }
  if (b.kind === 'smith') { o.add(mk(CYL(0.3, 0.34, 0.5, w + 0.45, 0.25, 0.7, 12), smat('brick', '#6a665e'))); o.add(mk(CYL(0.26, 0.26, 0.03, w + 0.45, 0.51, 0.7, 12), smat(null, '#3a1208', { emissive: '#ff5a10', ei: 0.8 }))); }
  return o;
}

// ============================================================
//  INTERIORES (aparecem quando o telhado some)
// ============================================================
function mInterior(b, fl = 0) {
  const [w, h] = bDims(b), { H } = bldDims(b), o = grp(), L = interiorLayout(b, fl), R = rng(b.x * 13 + b.y), nF = floorsOf(b);
  const stoneK = b.kind === 'temple' || b.kind === 'castle' || b.kind === 'smith' || b.kind === 'barracks';
  const floorM = stoneK ? smat('stoneblock', b.kind === 'castle' ? '#a8a092' : '#8e887c', { bump: 1 }) : smat('wood', b.kind === 'stable' ? '#8a6a3e' : '#7a5232', { bump: 1.2 });
  const wallM = stoneK ? smat('brick', b.kind === 'castle' ? '#b4ad9c' : '#a29c90', { bump: 1.2 }) : smat('plaster', '#e2d6bc', { bump: 0.7 });
  const trimM = smat('wood', '#4a2f17'), hw = Math.min(H / nF, b.kind === 'castle' || b.kind === 'temple' ? 5 : 2.3), t = 0.16;
  o.add(mk(wuv(new THREE.BoxGeometry(w, 0.06, h).translate(w / 2, 0.03, h / 2), 1), floorM));
  // quais paredes (no quadro local) ficam viradas para a câmera depende do lado da porta
  const knee = { S: ['front', 'right'], N: ['back', 'left'], E: ['front', 'left'], W: ['back', 'right'] }[b.realDoor || 'S'];
  const KH = 0.34, wallH = f => knee.includes(f) ? KH : hw, dx = doorCol(b) + 0.5;
  const lightWin = smat(null, '#ffe2a8', { emissive: '#ffcc80', ei: 0.7, rough: 0.3 }), capM = smat('stoneblock', '#b0a998', { bump: 1 });
  const wallSeg = (f, w2, d2, x, z) => { const hh = wallH(f); o.add(mk(wuv(new THREE.BoxGeometry(w2, hh, d2).translate(x, hh / 2, z), 0.7), wallM)); if (hh === KH) o.add(mk(new THREE.BoxGeometry(w2 + 0.02, 0.05, d2 + 0.04).translate(x, KH + 0.025, z), capM)); };
  wallSeg('back', w, t, w / 2, t / 2); wallSeg('left', t, h, t / 2, h / 2); wallSeg('right', t, h, w - t / 2, h / 2);
  if (dx - 0.6 > 0) wallSeg('front', dx - 0.6, t, (dx - 0.6) / 2, h - t / 2);
  if (w - dx - 0.6 > 0) wallSeg('front', w - dx - 0.6, t, (dx + 0.6 + w) / 2, h - t / 2);
  if (!knee.includes('front')) o.add(mk(wuv(new THREE.BoxGeometry(1.2, hw - 1.3, t).translate(dx, 1.3 + (hw - 1.3) / 2, h - t / 2), 0.7), wallM));
  if (fl > 0 && !knee.includes('front')) o.add(mk(wuv(new THREE.BoxGeometry(1.2, 1.3, t).translate(dx, 0.65, h - t / 2), 0.7), wallM));
  if (fl > 0) o.add(mk(wuv(new THREE.BoxGeometry(w, 0.18, h).translate(w / 2, -0.09, h / 2), 1), smat('wood', '#4e3420', { bump: 1 })));
  // janelas com luz entrando, só nas paredes inteiras
  if (!knee.includes('back')) for (let k = 0; k < Math.floor(w / 2); k++) o.add(mk(new THREE.BoxGeometry(0.42, 0.6, 0.03).translate(1 + k * 2, hw * 0.6, t + 0.02), lightWin));
  if (!knee.includes('left')) for (let k = 0; k < Math.floor(h / 2); k++) o.add(mk(new THREE.BoxGeometry(0.03, 0.6, 0.42).translate(t + 0.02, hw * 0.6, 1 + k * 2), lightWin));
  if (!knee.includes('right')) for (let k = 0; k < Math.floor(h / 2); k++) o.add(mk(new THREE.BoxGeometry(0.03, 0.6, 0.42).translate(w - t - 0.02, hw * 0.6, 1 + k * 2), lightWin));
  if (!knee.includes('front')) for (let k = 0; k < Math.floor(w / 2); k++) if (Math.abs(1 + k * 2 - dx) > 0.9) o.add(mk(new THREE.BoxGeometry(0.42, 0.6, 0.03).translate(1 + k * 2, hw * 0.6, h - t - 0.02), lightWin));
  // luz quente no meio do cômodo
  { const pl = new THREE.PointLight(0xffd09a, 0.7, Math.max(w, h) * 1.2); pl.position.set(w / 2, 1.6, h / 2); o.add(pl); }
  // móveis
  const W_ = () => smat('wood', '#7a5434', { bump: 1 }), DW = () => smat('wood', '#4e3420', { bump: 1 });
  const cloth = c => smat('cloth', c, { bump: 0.5 });
  for (const f of L.F) {
    const cx = f.i + f.w / 2, cz = f.j + f.h / 2, g = grp();
    const backZ = f.j === 0, backX = f.i === 0;
    switch (f.t) {
      case 'bed': g.add(wbox(0.9, 0.3, f.h - 0.15, 0, 0.15, 0, W_(), 2)); g.add(mk(new THREE.BoxGeometry(0.82, 0.14, f.h - 0.3).translate(0, 0.37, 0.02), cloth('#e8e0cc'))); g.add(mk(new THREE.BoxGeometry(0.86, 0.06, (f.h - 0.3) * 0.6).translate(0, 0.46, 0.2), cloth(['#7a2a2a', '#2a4a7a', '#3a6a3a'][f.i % 3]))); g.add(mk(new THREE.BoxGeometry(0.5, 0.1, 0.25).translate(0, 0.48, -(f.h - 0.3) / 2 + 0.15), cloth('#f4eedc'))); g.add(wbox(0.9, 0.7, 0.08, 0, 0.35, -(f.h - 0.15) / 2, DW(), 2)); break;
      case 'bunk': for (const y of [0.15, 1.0]) { g.add(wbox(0.85, 0.12, f.h - 0.2, 0, y + 0.12, 0, W_(), 2)); g.add(mk(new THREE.BoxGeometry(0.78, 0.1, f.h - 0.35).translate(0, y + 0.24, 0), cloth('#9a8a6a'))); } for (const [px, pz] of [[-0.4, -(f.h - 0.2) / 2], [0.4, -(f.h - 0.2) / 2], [-0.4, (f.h - 0.2) / 2], [0.4, (f.h - 0.2) / 2]]) g.add(wbox(0.06, 1.4, 0.06, px, 0.7, pz, DW(), 2)); break;
      case 'fireplace': { const fx = backZ ? 0 : -0.25, fz = backZ ? -0.25 : 0; g.add(wbox(backZ ? 0.95 : 0.5, 1.5, backZ ? 0.5 : 0.95, fx, 0.75, fz, smat('brick', '#8a8478', { bump: 1.4 }), 1.5)); g.add(mk(new THREE.BoxGeometry(backZ ? 0.55 : 0.08, 0.5, backZ ? 0.08 : 0.55).translate(fx + (backZ ? 0 : 0.22), 0.35, fz + (backZ ? 0.22 : 0)), smat(null, '#140c06'))); g.add(mk(new THREE.ConeGeometry(0.18, 0.34, 6).translate(fx + (backZ ? 0 : 0.2), 0.3, fz + (backZ ? 0.2 : 0)), smat(null, '#ff9a30', { emissive: '#ff7a10', ei: 2.2 }))); g.add(wbox(backZ ? 1.1 : 0.62, 0.1, backZ ? 0.62 : 1.1, fx, 1.0, fz, smat('stoneblock', '#9a948a'), 2)); const pl = new THREE.PointLight(0xff9a40, 1.6, 4.5); pl.position.set(fx + (backZ ? 0 : 0.5), 0.6, fz + (backZ ? 0.5 : 0)); g.add(pl); break; }
      case 'barrel': { const br = mBarrel(); br.scale.setScalar(0.75); g.add(br); break; }
      case 'crate': { const cr = mCrate(); cr.scale.setScalar(0.8); g.add(cr); break; }
      case 'chest': g.add(wbox(0.7, 0.42, 0.45, 0, 0.21, 0, W_(), 2)); g.add(mk(new THREE.CylinderGeometry(0.225, 0.225, 0.7, 10, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).translate(0, 0.42, 0), W_())); for (const x of [-0.25, 0.25]) g.add(mk(new THREE.BoxGeometry(0.05, 0.5, 0.47).translate(x, 0.3, 0), IRON())); break;
      case 'table': g.add(wbox(f.w - 0.15, 0.06, f.h - 0.15, 0, 0.74, 0, W_(), 1.5)); for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(wbox(0.06, 0.72, 0.06, px * (f.w / 2 - 0.15), 0.36, pz * (f.h / 2 - 0.15), DW(), 2)); for (let k = 0; k < Math.max(2, f.h * 2); k++) { const z = -f.h / 2 + 0.3 + k * (f.h - 0.6) / Math.max(1, f.h * 2 - 1); g.add(mk(new THREE.CylinderGeometry(0.045, 0.04, 0.12, 8).translate((k % 2 ? 0.2 : -0.2) * Math.min(1, f.w), 0.83, z), smat('wood', '#8a5424'))); if (k % 3 === 0) g.add(mk(new THREE.CylinderGeometry(0.12, 0.1, 0.03, 12).translate(0, 0.78, z + 0.1), smat(null, '#c8b8a0', { rough: 0.5 }))); } g.add(mk(new THREE.CylinderGeometry(0.025, 0.025, 0.16, 6).translate(0, 0.85, 0), smat(null, '#f4ecd8', { emissive: '#ffcc66', ei: 0.4 }))); break;
      case 'chair': { const sd = f.seat; g.add(wbox(0.42, 0.05, 0.42, 0, 0.45, 0, W_(), 2)); for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(wbox(0.04, 0.45, 0.04, px * 0.18, 0.22, pz * 0.18, DW(), 2)); const bx = sd === 1 ? -0.19 : sd === 5 ? 0.19 : 0, bz = sd === 7 ? -0.19 : sd === 3 ? 0.19 : 0; g.add(wbox(bx ? 0.04 : 0.42, 0.5, bz ? 0.04 : 0.42, bx, 0.72, bz, DW(), 2)); break; }
      case 'pew': g.add(wbox(f.w - 0.1, 0.06, 0.42, 0, 0.45, -0.05, W_(), 2)); g.add(wbox(f.w - 0.1, 0.55, 0.05, 0, 0.75, 0.17, W_(), 2)); for (const px of [-(f.w - 0.2) / 2, (f.w - 0.2) / 2]) g.add(wbox(0.06, 0.95, 0.46, px, 0.47, 0, DW(), 2)); break;
      case 'shelf': { const along = backZ; g.add(wbox(along ? 0.9 : 0.35, 1.8, along ? 0.35 : 0.9, along ? 0 : -0.3, 0.9, along ? -0.3 : 0, DW(), 2)); const cols = [['#c8a050', '#8a5a2a', '#d8d0b0', '#6a8a4a'], ['#3ad878', '#d84a6a', '#5aa8f0', '#e8c040'], ['#6a2a2a', '#2a3a6a', '#3a5a2a', '#7a5a2a'], ['#c83a3a', '#3a5ac8', '#e8d8b0', '#8a3ac8'], ['#e8dcb8', '#c8b080', '#d8c8a0', '#a88a5a']][f.v || 0]; for (let sy = 0; sy < 4; sy++) { g.add(wbox(along ? 0.86 : 0.3, 0.03, along ? 0.3 : 0.86, along ? 0 : -0.28, 0.25 + sy * 0.45, along ? -0.28 : 0, W_(), 2)); for (let k = 0; k < 4; k++) { const off = -0.3 + k * 0.2, c = cols[(k + sy) % 4]; const gm = f.v === 1 ? new THREE.CylinderGeometry(0.04, 0.05, 0.16, 8) : f.v === 2 ? new THREE.BoxGeometry(0.06, 0.24, 0.16) : f.v === 3 ? new THREE.CylinderGeometry(0.07, 0.07, 0.22, 8).rotateZ(Math.PI / 2) : new THREE.CylinderGeometry(0.06, 0.07, 0.15, 8); g.add(mk(gm.translate(along ? off : -0.28, 0.35 + sy * 0.45, along ? -0.28 : off), smat(null, c, { rough: f.v === 1 ? 0.1 : 0.6 }))); } } break; }
      case 'counter': g.add(wbox(f.w - 0.05, 0.95, 0.6, 0, 0.475, 0, smat('wood', '#5a3a1e', { bump: 1.2 }), 1.5)); g.add(wbox(f.w + 0.05, 0.07, 0.7, 0, 0.98, 0, W_(), 1.5)); for (let k = 0; k < f.w * 2; k++) g.add(mk((k % 2 ? new THREE.CylinderGeometry(0.05, 0.045, 0.14, 8) : new THREE.BoxGeometry(0.16, 0.1, 0.12)).translate(-f.w / 2 + 0.3 + k * 0.5, 1.08, 0), smat(null, ['#c8a050', '#8a5a2a', '#3ad878', '#d84a6a', '#e8dcb8'][(k + (f.v || 0)) % 5], { rough: 0.5 }))); break;
      case 'display': g.add(wbox(0.85, 0.75, 0.6, 0, 0.375, 0, W_(), 2)); for (let k = 0; k < 5; k++) g.add(mk(new THREE.SphereGeometry(0.06, 8, 6).translate(-0.3 + k * 0.15, 0.82, (k % 2) * 0.15 - 0.07), smat(null, ['#e8b030', '#c83a3a', '#3ad878', '#5aa8f0', '#e8e0c8'][(k + (f.v || 0)) % 5], { rough: 0.4 }))); break;
      case 'mannequin': g.add(wbox(0.06, 1.1, 0.06, 0, 0.55, 0, DW(), 2)); g.add(mk(new THREE.CylinderGeometry(0.17, 0.12, 0.6, 10).translate(0, 1.3, 0), cloth('#7a2a5a'))); g.add(mk(new THREE.CylinderGeometry(0.22, 0.12, 0.5, 10).translate(0, 0.85, 0), cloth('#5a1a3a'))); break;
      case 'orb': g.add(wbox(0.6, 0.8, 0.6, 0, 0.4, 0, cloth('#2a1a4a'), 2)); g.add(mk(new THREE.SphereGeometry(0.17, 16, 12).translate(0, 1.0, 0), smat(null, '#b080ff', { emissive: '#7a4ae8', ei: 1.4, rough: 0.1 }))); break;
      case 'cauldron': g.add(mk(new THREE.SphereGeometry(0.32, 14, 10, 0, 6.28, Math.PI * 0.3, Math.PI * 0.7).translate(0, 0.42, 0), smat(null, '#1e1e22', { metal: 0.6, rough: 0.5, side: THREE.DoubleSide }))); g.add(mk(new THREE.CylinderGeometry(0.26, 0.26, 0.02, 14).translate(0, 0.6, 0), smat(null, '#3ad878', { emissive: '#1a9a4a', ei: 1.3 }))); break;
      case 'forge': g.add(wbox(1.8, 0.8, 0.85, 0, 0.4, -0.05, smat('brick', '#6a665e', { bump: 1.4 }), 1.5)); g.add(mk(new THREE.BoxGeometry(1.2, 0.05, 0.55).translate(0, 0.82, 0), smat(null, '#3a1208', { emissive: '#ff5a10', ei: 2 }))); g.add(mk(new THREE.ConeGeometry(0.8, 0.9, 4).rotateY(Math.PI / 4).translate(0, 1.9, -0.15), smat('brick', '#5a564e'))); g.add(wbox(0.4, 1.0, 0.4, 0, 2.6, -0.25, smat('brick', '#5a564e'), 1.5)); { const pl = new THREE.PointLight(0xff7a30, 1.8, 5); pl.position.set(0, 1.1, 0.4); g.add(pl); } break;
      case 'anvil': g.add(mAnvil()); break;
      case 'stairup': { const sm = smat('wood', '#6a4a2c', { bump: 1.2 }), n = 7; for (let s2 = 0; s2 < n; s2++) g.add(wbox(0.8, (s2 + 1) * 0.3, 0.86 / n, 0, (s2 + 1) * 0.15, 0.43 - (s2 + 0.5) * 0.86 / n, sm, 2)); for (const x of [-0.42, 0.42]) { g.add(limb(V3(x, 0.55, 0.45), V3(x, 2.4, -0.4), 0.025, 0.025, DW(), 5)); g.add(wbox(0.05, 0.6, 0.05, x, 0.3, 0.45, DW(), 2)); } g.add(mk(new THREE.BoxGeometry(0.9, 0.04, 0.9).translate(0, 0.075, 0), smat(null, '#c8a050', { emissive: '#6a4a10', ei: 0.25, transparent: true, opacity: 0.35 }), false)); break; }
      case 'stairdown': { g.add(mk(new THREE.BoxGeometry(0.8, 0.02, 0.86).translate(0, 0.07, 0), smat(null, '#120c06'))); const sm = smat('wood', '#6a4a2c', { bump: 1.2 }); for (let s2 = 0; s2 < 3; s2++) g.add(wbox(0.78, 0.06, 0.2, 0, 0.04 - s2 * 0.0, 0.32 - s2 * 0.22, sm, 2)); for (const x of [-0.44, 0.44]) { g.add(wbox(0.05, 0.75, 0.9, x, 0.38, 0, DW(), 2)); } g.add(wbox(0.9, 0.75, 0.05, 0, 0.38, -0.45, DW(), 2)); g.add(mk(new THREE.BoxGeometry(0.9, 0.04, 0.9).translate(0, 0.08, 0), smat(null, '#c8a050', { emissive: '#6a4a10', ei: 0.25, transparent: true, opacity: 0.3 }), false)); break; }
      case 'rack': g.add(mWeaponRack().rotateY(backZ ? 0 : Math.PI / 2)); break;
      case 'trough': g.add(wbox(f.w - 0.2, 0.4, 0.5, 0, 0.2, 0, W_(), 2)); g.add(mk(new THREE.BoxGeometry(f.w - 0.35, 0.02, 0.36).translate(0, 0.36, 0), smat(null, '#3a5a6a', { rough: 0.1 }))); break;
      case 'hay': g.add(mHay()); break;
      case 'altar': g.add(wbox(f.w - 0.3, 0.95, 0.75, 0, 0.475, 0, smat('stoneblock', '#d8d0bc'), 1.5)); g.add(mk(new THREE.BoxGeometry(f.w - 0.2, 0.03, 0.8).translate(0, 0.96, 0), cloth('#e8e0cc'))); g.add(mk(new THREE.BoxGeometry(0.6, 0.6, 0.02).translate(0, 0.62, 0.39), cloth('#7a1a1c'))); g.add(mk(new THREE.TorusGeometry(0.3, 0.04, 6, 20).translate(0, 1.8, -0.3), smat(null, '#e2b74e', { metal: 1, rough: 0.3, emissive: '#6a5010', ei: 0.5 }))); for (const x of [-0.6, 0.6]) g.add(mk(new THREE.CylinderGeometry(0.03, 0.03, 0.22, 6).translate(x, 1.08, 0), smat(null, '#f4ecd8', { emissive: '#ffcc66', ei: 0.8 }))); break;
      case 'candles': g.add(mk(new THREE.CylinderGeometry(0.03, 0.12, 1.2, 8).translate(0, 0.6, 0), smat(null, '#c9a24a', { metal: 0.9, rough: 0.35 }))); for (let k = 0; k < 3; k++) g.add(mk(new THREE.CylinderGeometry(0.025, 0.025, 0.14, 6).translate((k - 1) * 0.12, 1.28, 0), smat(null, '#fff4d8', { emissive: '#ffcc66', ei: 1.4 }))); { const pl = new THREE.PointLight(0xffc070, 0.8, 3); pl.position.set(0, 1.4, 0.2); g.add(pl); } break;
      case 'throne': g.add(wbox(1.6, 0.25, 1.4, 0, 0.125, 0, smat('stoneblock', '#a8a092'), 1.5)); g.add(mk(new THREE.BoxGeometry(1.5, 0.02, 1.3).translate(0, 0.26, 0.1), cloth('#7a1a1c'))); g.add(wbox(0.7, 0.2, 0.6, 0, 0.6, 0.05, smat(null, '#c9a24a', { metal: 0.8, rough: 0.35 }), 2)); g.add(mk(new THREE.BoxGeometry(0.62, 0.08, 0.52).translate(0, 0.72, 0.05), cloth('#9a1a1c'))); g.add(wbox(0.75, 1.5, 0.12, 0, 1.2, -0.25, smat(null, '#c9a24a', { metal: 0.8, rough: 0.35 }), 2)); g.add(mk(new THREE.ConeGeometry(0.08, 0.2, 6).translate(-0.3, 2.05, -0.25), smat(null, '#e2b74e', { metal: 1 }))); g.add(mk(new THREE.ConeGeometry(0.08, 0.2, 6).translate(0.3, 2.05, -0.25), smat(null, '#e2b74e', { metal: 1 }))); for (const x of [-0.36, 0.36]) g.add(wbox(0.1, 0.35, 0.55, x, 0.85, 0.05, smat(null, '#c9a24a', { metal: 0.8, rough: 0.35 }), 2)); break;
      case 'banner': g.add(mk(new THREE.PlaneGeometry(0.7, 2.2).translate(0, 1.8, -0.4), smat('cloth', '#7a1a1c', { side: THREE.DoubleSide }))); g.add(mk(new THREE.CircleGeometry(0.2, 12).translate(0, 2.2, -0.39), smat(null, '#e2b74e', { metal: 1, rough: 0.3 }))); break;
      case 'rug': g.add(mk(new THREE.BoxGeometry(Math.min(3, w - 1.4), 0.015, Math.min(h - 1.4, b.kind === 'castle' ? h - 3 : 2)).translate(0, 0.07, b.kind === 'castle' ? (h - 3) / 2 - 0.5 : 0.5), cloth(b.kind === 'castle' ? '#8a1a1c' : ['#7a3a2a', '#3a4a6a', '#5a6a3a'][f.i % 3]))); break;
    }
    g.position.set(cx, 0, cz); g.userData.furn = 1;
    { const sx = f.w > 1 || f.h > 1 || f.t === 'rug' || f.t === 'stairup' || f.t === 'stairdown' ? 1 : 0.62; if (f.t === 'stairup' || f.t === 'stairdown') { o.add(g); continue; } g.scale.set(sx, 0.55, sx); if (sx < 1) g.position.set(cx + (backX ? -0.15 : 0), 0, cz + (backZ ? -0.15 : 0)); }
    o.add(g);
  }
  return o;
}
function interiorSprite(b, fl = 0) {
  const key = 'in|' + archKey(b) + '|' + (b.door || 'S') + '|' + fl;
  return scen3(key, () => b.kind === 'stairtower' ? placeRot(b, mStairTower({ ...localB(b), realDoor: b.door || 'S' }, true)) : placeRot(b, mInterior({ ...localB(b), realDoor: b.door || 'S' }, fl)));
}
// ============================================================
//  LIGAÇÃO: troca os desenhos pintados pelas fotos 3D (quando
//  prontas). Enquanto a foto não fica pronta, usa o pintado.
// ============================================================
(function hookScenery() {
  if (!S3.ok) return;
  const wrap = (name, key, make) => {
    const orig = window[name];
    window[name] = function (...a) { return scen3(key(...a), () => make(...a)) || orig.apply(null, a); };
  };
  wrap('treeSprite', (v, w, t) => `tr|${v}|${t}`, (v, w, t) => sc(mTree(v, t || 0), 1.35));
  wrap('pineSprite', v => `pi|${v}`, v => sc(mPine(v), 1.35));
  wrap('deadTreeSprite', v => `dt|${v}`, v => sc(mDeadTree(v), 1.25));
  wrap('bushSprite', v => `bu|${v}`, v => sc(mBush(v), 0.8));
  wrap('rockSprite', (v, m) => `ro|${v}|${m}`, (v, m) => mRock(v, m));
  wrap('grassSprite', (v, w, d) => `gr|${v}|${d}`, (v, w, d) => sc(mGrass(v, d), 0.7));
  const SMALL = { mushroom: mMushroom, reeds: mReeds, stump: mStump, log: mLog, deadtree: mDeadTree, grave: mGrave, tent: mTent, barrel: mBarrel, crate: mCrate, hay: mHay, bench: mBench, well: mWell, stall: mStall, spikes: mSpikes, rubblebig: mRubble, dummy: mDummy, statue: mStatue, anvil: mAnvil, weaponrack: mWeaponRack, cart: mCart, table: mTable };
  const PS = { barrel: 0.5, crate: 0.5, hay: 0.55, bench: 0.5, well: 0.72, stall: 0.6, tent: 0.75, spikes: 0.7, rubblebig: 0.8, dummy: 0.55, statue: 1.0, anvil: 0.5, weaponrack: 0.55, cart: 0.6, table: 0.5, grave: 0.6, stump: 0.75, log: 0.8, mushroom: 0.8, reeds: 0.8, deadtree: 1.25 };
  const sc = (g, k) => { g.scale.setScalar(k); return g; };
  const origSmall = window.smallSprite;
  window.smallSprite = function (kind, v = 0, w) { const f = SMALL[kind]; return (f && scen3(`sm|${kind}|${v}`, () => sc(f(v), PS[kind] || 1))) || origSmall(kind, v, w); };
  const ANIM = { torch: mTorch, campfire: mCampfire, brazier: mBrazier, lamp: mLamp, banner: mBannerPole, fountain: mFountain };
  const origAnim = window.animSprite;
  const PA = { torch: 0.8, campfire: 0.7, brazier: 0.6, lamp: 1, banner: 1, fountain: 1.15 };
  window.animSprite = function (kind) { const f = ANIM[kind]; return (f && scen3(`an|${kind}`, () => sc(f(), PA[kind] || 1))) || origAnim(kind); };
  wrap('fenceSprite', a => `fe|${a ? 1 : 0}`, a => { const g = mFence(a); g.scale.set(1, 0.6, 1); return g; });
  wrap('wallSprite', (v, low, ivy, od, e) => `wa|${v}|${low ? 1 : 0}|${ivy ? 1 : 0}|${od | 0}|${e | 0}`, (v, low, ivy, od, e) => mWall(v, low, ivy, od, e | 0));
  wrap('gateSprite', a => `ga|${a ? 1 : 0}`, a => mGate(a));
  wrap('towerSprite', (v, off) => `to|${v}|${off ?? 4}`, (v, off) => { const g = mTower(v), o = off ?? 4; g.position.set((Math.floor(o / 3) - 1) * 0.5, 0, (o % 3 - 1) * 0.5); return grp(g); });
  wrap('stairsSprite', (d, k) => `st|${d}|${k | 0}`, (d, k) => mStairs(d, k | 0));
  wrap('slabSprite', v => `sl|${v}`, v => mSlab(v));
  wrap('cliffSprite', (h, v, s) => `cl|${h}|${v}|${s}`, (h, v, s) => mCliff(h, v, s));
  wrap('buildingSprite', (b, n) => `bd|${archKey(b)}|${b.door || 'S'}`, (b, n) => mBuildingRot(b, false));
  // luzes das janelas na altura nova das paredes
  window.buildingWindows = function (b) {
    if (b.kind === 'stairtower') return [];
    const [A, D] = bDims(b), H = bldDims(b).H, out = [], fl = b.floors || 1, fh = H / fl;
    for (let f = 0; f < fl; f++) { const zc = (f * fh + fh * 0.55) * HV; for (let k = 0; k < Math.floor(A / 1.5); k++) { const [x, y] = localToWorld(b, (k + 0.5) * A / Math.floor(A / 1.5), D); out.push([x, y, zc]); } for (let k = 0; k < Math.floor(D / 1.5); k++) for (const u of [0, A]) { const [x, y] = localToWorld(b, u, (k + 0.5) * D / Math.floor(D / 1.5)); out.push([x, y, zc]); } }
    return out;
  };
})();
// altura de uma construção na tela (para nomes e fumaça)
function bldTopArt(b) { return (b.wall + b.roof) * 2 * (S3.ok ? BLD_K : 1); }
