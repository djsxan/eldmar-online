// ============================================================
//  MUNDO EM 3D DE VERDADE (bairro de teste — test3d.html)
//  A placa de vídeo desenha tudo em tempo real: a profundidade é
//  resolvida pelo z-buffer, telhados/paredes somem por partes,
//  silhuetas mostram quem está atrás das paredes. Reaproveita os
//  modelos de scene3d.js (cenário) e render3d.js (personagens).
//  Unidades: 1 tile = 1 unidade (≈ 2 m); X = x do mapa, Z = y do mapa.
// ============================================================
const W3 = { ok: false, rot: 0, rotA: 0, ents: new Map(), bld: [], gates: [] };
const WALL_Y = h3(FLOOR_PX);                    // altura do alto da muralha
const CH_S = 0.5;                               // personagens: metros -> tiles

(function initWorld3D() {
  if (typeof THREE === 'undefined') return;
  const mobile = matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  const cv = document.createElement('canvas'); cv.id = 'w3d';
  cv.style.cssText = 'position:fixed;inset:0;display:block;width:100%;height:100%;z-index:0';
  document.body.insertBefore(cv, document.body.firstChild);
  const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: !mobile, powerPreference: 'high-performance' });
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1c2a30);
  const hemi = new THREE.HemisphereLight(0xb4c0d6, 0x5a4430, 0.62); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffcf94, 2.6);
  sun.castShadow = true; sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03;
  const sc = sun.shadow.camera; sc.left = -22; sc.right = 22; sc.top = 22; sc.bottom = -22; sc.near = 1; sc.far = 120;
  sun.shadow.camera.layers.enableAll();
  scene.add(sun); scene.add(sun.target);
  const ec = document.createElement('canvas'); ec.width = 64; ec.height = 32;
  const ex = ec.getContext('2d'), eg = ex.createLinearGradient(0, 0, 0, 32);
  eg.addColorStop(0, '#e8d8b8'); eg.addColorStop(0.48, '#b8b0a0'); eg.addColorStop(0.52, '#6a5a44'); eg.addColorStop(1, '#2a2218');
  ex.fillStyle = eg; ex.fillRect(0, 0, 64, 32);
  const envTex = new THREE.CanvasTexture(ec); envTex.mapping = THREE.EquirectangularReflectionMapping; envTex.encoding = THREE.sRGBEncoding;
  scene.environment = new THREE.PMREMGenerator(renderer).fromEquirectangular(envTex).texture;
  const cam = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 400);
  Object.assign(W3, { ok: true, mobile, renderer, scene, cam, sun, hemi, cv, ray: new THREE.Raycaster() });
  // silhuetas: mostram jogadores e monstros atrás de paredes (desenho extra só onde estão escondidos)
  const sil = c => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.42, depthFunc: THREE.GreaterDepth, depthWrite: false });
  W3.silMats = { 1: sil(0xffd060), 2: sil(0x60a8ff), 3: sil(0xff5040) };
  // tom dourado e bordas escuras (barato: um div por cima)
  const ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:1;background:radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(14,8,2,0.55) 100%), linear-gradient(rgba(255,190,110,0.10), rgba(255,190,110,0) 45%, rgba(30,14,4,0.10))';
  document.body.insertBefore(ov, cv.nextSibling);
  // o canvas 2D do jogo fica transparente por cima (só falas e avisos)
  const g2 = document.getElementById('game'); if (g2) { g2.style.position = 'fixed'; g2.style.zIndex = 2; g2.style.background = 'transparent'; g2.style.pointerEvents = 'auto'; }
})();

// ---------- juntar malhas por material (menos chamadas de desenho = mais rápido) ----------
function mergeGeos(geos, needColor) {
  let n = 0; for (const g of geos) n += g.attributes.position.count;
  if (!n) return null;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), col = needColor ? new Float32Array(n * 3) : null;
  let o = 0;
  for (const g of geos) {
    const p = g.attributes.position, c = p.count;
    if (!g.attributes.normal) g.computeVertexNormals();
    pos.set(p.array.length === c * 3 ? p.array : Float32Array.from({ length: c * 3 }, (_, k) => p.getComponent(Math.floor(k / 3), k % 3)), o * 3);
    nor.set(g.attributes.normal.array.subarray(0, c * 3), o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array.subarray(0, c * 2), o * 2);
    if (col) { if (g.attributes.color) col.set(g.attributes.color.array.subarray(0, c * 3), o * 3); else col.fill(1, o * 3, (o + c) * 3); }
    o += c;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  if (col) g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeBoundingSphere(); g.computeBoundingBox();
  return g;
}
function mergeGroup(root, cast = true) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), buckets = new Map(), m4 = new THREE.Matrix4();
  root.traverse(o => { if (!o.isMesh || !o.visible || o.isInstancedMesh) return; let b = buckets.get(o.material); if (!b) buckets.set(o.material, b = []); b.push(o); });
  const out = new THREE.Group();
  for (const [m, list] of buckets) {
    const geos = list.map(o => { const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()); m4.multiplyMatrices(inv, o.matrixWorld); g.applyMatrix4(m4); if (m4.determinant() < 0) { const p = g.attributes.position.array; for (let i = 0; i < p.length; i += 9) for (let k = 0; k < 3; k++) { const t = p[i + 3 + k]; p[i + 3 + k] = p[i + 6 + k]; p[i + 6 + k] = t; } g.computeVertexNormals(); } return g; });
    const merged = mergeGeos(geos, !!m.vertexColors); geos.forEach(g => g.dispose());
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, m); mesh.castShadow = cast; mesh.receiveShadow = true; out.add(mesh);
  }
  return out;
}

// ---------- chão: textura vista de cima, com os materiais com relevo do terreno ----------
function buildGround() {
  const ppt = W3.mobile ? 14 : 22, N = MAP_W * ppt, can = document.createElement('canvas'); can.width = can.height = N;
  const g2 = can.getContext('2d'), img = g2.createImageData(N, N), Dd = img.data;
  for (let py = 0; py < N; py++) for (let px_ = 0; px_ < N; px_++) {
    const tx = px_ / ppt - 0.5, ty = py / ppt - 0.5;
    const fx = tx + (vnoise(tx * 1.1, ty * 1.1, 21) - 0.5) * 0.7, fy = ty + (vnoise(tx * 1.1 + 9.3, ty * 1.1, 22) - 0.5) * 0.7;
    const x0 = Math.floor(fx), y0 = Math.floor(fy), u = smooth(smooth(fx - x0)), v = smooth(smooth(fy - y0));
    const ti = ((Math.floor((tx + 0.5) * MT) % MTS) + MTS) % MTS, tj = ((Math.floor((ty + 0.5) * MT) % MTS) + MTS) % MTS, tk = tj * MTS + ti;
    let r = 0, gg = 0, bb = 0, aw = 0, best = -9; const cand = [];
    for (let q = 0; q < 4; q++) {
      const cx = x0 + (q & 1), cy = y0 + (q >> 1), wgt = ((q & 1) ? u : 1 - u) * ((q >> 1) ? v : 1 - v);
      if (wgt < 0.001) continue;
      const [gt, zt] = tileInfo(cx, cy);
      const M = matTex(gt === T.WATER ? 'swamp' : MAT_OF[gt] || 'grass'), score = wgt + M.H[tk] * 0.45;
      cand.push([M, score, gt === T.GRASS ? zt : -1, gt === T.WATER]); if (score > best) best = score;
    }
    for (const [M, score, z, wet] of cand) {
      const w = Math.max(0, score - (best - 0.22)); if (w <= 0) continue;
      let cr = M.L[tk * 3], cg = M.L[tk * 3 + 1], cb = M.L[tk * 3 + 2];
      if (z >= 0) { const zt2 = zoneTint(z); cr *= zt2[0]; cg *= zt2[1]; cb *= zt2[2]; }
      if (wet) { cr *= 0.45; cg *= 0.5; cb *= 0.5; }
      r += cr * w; gg += cg * w; bb += cb * w; aw += w;
    }
    const big = 0.9 + vnoise(tx / 9, ty / 9, 5) * 0.16, k = (py * N + px_) * 4;
    Dd[k] = clamp(r / aw * big, 0, 255); Dd[k + 1] = clamp(gg / aw * big, 0, 255); Dd[k + 2] = clamp(bb / aw * big, 0, 255); Dd[k + 3] = 255;
  }
  g2.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(can); tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 8;
  const geo2 = new THREE.PlaneGeometry(MAP_W, MAP_H).rotateX(-Math.PI / 2).translate(MAP_W / 2 - 0.5, 0, MAP_H / 2 - 0.5);
  const m = new THREE.Mesh(geo2, new THREE.MeshLambertMaterial({ map: tex })); m.receiveShadow = true;
  W3.scene.add(m);
  // água: um plano só sobre os tiles de água, com ondas que se movem
  const pos = [];
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) if (WORLD.ground[y * MAP_W + x] === T.WATER) {
    const a = [x - 0.5, y - 0.5], b = [x + 0.5, y + 0.5];
    pos.push(a[0], 0.04, a[1], a[0], 0.04, b[1], b[0], 0.04, b[1], a[0], 0.04, a[1], b[0], 0.04, b[1], b[0], 0.04, a[1]);
  }
  if (pos.length) {
    const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const uvs = new Float32Array(pos.length / 3 * 2); for (let i = 0; i < pos.length / 3; i++) { uvs[i * 2] = pos[i * 3] / 6; uvs[i * 2 + 1] = pos[i * 3 + 2] / 6; }
    wg.setAttribute('uv', new THREE.BufferAttribute(uvs, 2)); wg.computeVertexNormals();
    const nt = new THREE.CanvasTexture(WAVE); nt.wrapS = nt.wrapT = THREE.RepeatWrapping;
    const wm = new THREE.MeshStandardMaterial({ color: 0x2c5664, roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.88, bumpMap: nt, bumpScale: 0.6 });
    const w = new THREE.Mesh(wg, wm); w.receiveShadow = true; W3.scene.add(w); W3.water = nt;
  }
}

// ---------- construções em partes (telhado, andares de cima e cada parede separados) ----------
function mBuilding3D(b) {
  const [A, Dp] = bDims(b), { H, RH } = bldDims(b), st = styleOf(b) || BSTYLE.house, R = rng(b.x * 31 + b.y * 7), seed = b.x * 0.37 + b.y;
  const tower = b.kind === 'stairtower';
  const floors = tower ? 1 : Math.max(1, Math.round(H / 1.5)), fh = tower ? H : H / floors, t = 0.18;
  const wallK = tower ? 'brick' : st.tex === 'plaster' && floors >= 2 ? 'brick' : st.tex, wallC = wallK === 'brick' && st.tex === 'plaster' ? '#8e887c' : st.wall;
  const P = { floor: grp(), int: grp(), back: grp(), left: grp(), right: grp(), front: grp(), upper: grp(), roof: grp(), marker: grp() };
  const dc = doorCol(b) + 0.5, dw = 0.66, dh = Math.min(fh - 0.25, 1.2);
  const slab = (part, w, h, d, x, y, z, k, c, sc = 0.7) => P[part].add(gwall(w, h, d, x, y, z, k, c, H, seed, sc, k === 'plaster' ? 0.8 : 1.3));
  // piso
  P.floor.add(wbox(A, 0.06, Dp, A / 2, 0.03, Dp / 2, tower || b.kind === 'temple' || b.kind === 'smith' ? smat('stoneblock', '#8e887c', { bump: 1 }) : smat('wood', '#7a5232', { bump: 1.2 }), 1));
  // térreo: 4 paredes (a da frente com a porta)
  if (!tower) slab('back', A, fh, t, A / 2, fh / 2, t / 2, wallK, wallC);
  slab('left', t, fh, Dp, t / 2, fh / 2, Dp / 2, wallK, wallC);
  slab('right', t, fh, Dp, A - t / 2, fh / 2, Dp / 2, wallK, wallC);
  const fl = dc - dw / 2, fr = dc + dw / 2;
  if (fl > 0) slab('front', fl, fh, t, fl / 2, fh / 2, Dp - t / 2, wallK, wallC);
  if (A - fr > 0) slab('front', A - fr, fh, t, (fr + A) / 2, fh / 2, Dp - t / 2, wallK, wallC);
  slab('front', dw, fh - dh, t, dc, dh + (fh - dh) / 2, Dp - t / 2, wallK, wallC);
  // batente e porta aberta para dentro
  const trimM = smat('wood', st.trim || '#4a2f17', { bump: 1 }), stoneT = smat('stoneblock', '#9a948a', { bump: 1 });
  P.front.add(wbox(0.08, dh, t + 0.06, fl - 0.04, dh / 2, Dp - t / 2, stoneT, 2)); P.front.add(wbox(0.08, dh, t + 0.06, fr + 0.04, dh / 2, Dp - t / 2, stoneT, 2)); P.front.add(wbox(dw + 0.16, 0.1, t + 0.06, dc, dh + 0.05, Dp - t / 2, stoneT, 2));
  { const leaf = mk(wuv(new THREE.BoxGeometry(dw - 0.04, dh - 0.04, 0.05).translate((dw - 0.04) / 2, (dh - 0.04) / 2, 0), 2), smat('wood', '#6e4626', { bump: 1.5 })); const pv = grp(leaf); pv.position.set(fl + 0.02, 0, Dp - t - 0.03); pv.rotation.y = -1.25; P.int.add(pv); }
  // janelas no térreo (por fora e por dentro)
  const glassM = smat(null, '#2a3a48', { rough: 0.08, metal: 0.4 }), lightIn = smat(null, '#ffe2a8', { emissive: '#ffcc80', ei: 0.5, rough: 0.3 });
  const win = (part, x, y, z, ry) => { const g = grp(mk(new THREE.BoxGeometry(0.4, 0.5, t + 0.08), trimM), mk(new THREE.BoxGeometry(0.32, 0.42, t + 0.1), glassM)); g.add(mk(new THREE.BoxGeometry(0.03, 0.42, t + 0.12), trimM)); g.position.set(x, y, z); g.rotation.y = ry; P[part].add(g); };
  if (!tower) {
    for (let k = 0; k < Math.floor(A / 1.6); k++) { const u = (k + 0.5) * A / Math.floor(A / 1.6); if (Math.abs(u - dc) > 0.7) win('front', u, fh * 0.55, Dp - t / 2, 0); win('back', u, fh * 0.55, t / 2, 0); }
    for (let k = 0; k < Math.floor(Dp / 1.6); k++) { const u = (k + 0.5) * Dp / Math.floor(Dp / 1.6); win('left', t / 2, fh * 0.55, u, Math.PI / 2); win('right', A - t / 2, fh * 0.55, u, Math.PI / 2); }
  }
  // andares de cima (um bloco fechado, com janelas e enxaimel por fora)
  if (floors > 1) {
    const jet = st.tex === 'plaster' ? 0.16 : 0, uw = A + jet * 2, ud = Dp + jet * 2;
    P.upper.add(gwall(uw, H - fh, ud, A / 2, fh + (H - fh) / 2, Dp / 2, st.tex === 'plaster' ? 'plaster' : wallK, st.wall, H + 3, seed, 0.6, 0.8));
    P.upper.add(wbox(uw + 0.06, 0.1, ud + 0.06, A / 2, fh + 0.05, Dp / 2, trimM, 2));
    for (let f = 1; f < floors; f++) {
      const y = f * fh + fh * 0.55;
      for (let k = 0; k < Math.floor(A / 1.4); k++) { const u = (k + 0.5) * A / Math.floor(A / 1.4); for (const [z, ry] of [[Dp + jet + 0.01, 0], [-jet - 0.01, 0]]) { const g = grp(mk(new THREE.BoxGeometry(0.38, 0.5, 0.06), trimM), mk(new THREE.BoxGeometry(0.3, 0.42, 0.08), glassM)); g.position.set(u, y, z); P.upper.add(g); } }
      for (let k = 0; k < Math.floor(Dp / 1.4); k++) { const u = (k + 0.5) * Dp / Math.floor(Dp / 1.4); for (const x of [A + jet + 0.01, -jet - 0.01]) { const g = grp(mk(new THREE.BoxGeometry(0.06, 0.5, 0.38), trimM), mk(new THREE.BoxGeometry(0.08, 0.42, 0.3), glassM)); g.position.set(x, y, u); P.upper.add(g); } }
    }
    if (st.tex === 'plaster') for (let k = 0; k <= Math.round(uw / 0.9); k++) for (const z of [Dp + jet + 0.03, -jet - 0.03]) P.upper.add(mk(new THREE.BoxGeometry(0.08, H - fh, 0.04).translate(-jet + k * uw / Math.round(uw / 0.9), fh + (H - fh) / 2, z), trimM));
  } else if (!tower) {
    // térreo único: viga no alto das paredes (tampa por cima das paredes)
    P.upper.add(wbox(A, 0.12, Dp, A / 2, fh - 0.06, Dp / 2, trimM, 2));
  }
  // telhado
  if (!tower) {
    const ov = 0.35, roofM = smat(st.roofTex, st.roof, { bump: st.roofTex === 'thatch' ? 2 : 1.6 }), ridgeX = A >= Dp, gable = b.kind === 'house' ? (b.v || 0) % 2 === 0 : b.kind === 'shop';
    const jet = floors > 1 && st.tex === 'plaster' ? 0.16 : 0, x0 = -jet - ov, x1 = A + jet + ov, z0 = -jet - ov, z1 = Dp + jet + ov;
    const Aa = V3(x0, H, z0), Bb = V3(x1, H, z0), Cc = V3(x1, H, z1), Dd = V3(x0, H, z1), hw = (z1 - z0) / 2, hd = (x1 - x0) / 2;
    let r1, r2;
    if (gable) { r1 = ridgeX ? V3(x0, H + RH, (z0 + z1) / 2) : V3((x0 + x1) / 2, H + RH, z0); r2 = ridgeX ? V3(x1, H + RH, (z0 + z1) / 2) : V3((x0 + x1) / 2, H + RH, z1); }
    else { r1 = ridgeX ? V3(x0 + hw, H + RH, (z0 + z1) / 2) : V3((x0 + x1) / 2, H + RH, z0 + hd); r2 = ridgeX ? V3(x1 - hw, H + RH, (z0 + z1) / 2) : V3((x0 + x1) / 2, H + RH, z1 - hd); }
    const faces = gable ? (ridgeX ? [[Dd, Cc, r2, r1], [Bb, Aa, r1, r2]] : [[Aa, Dd, r2, r1], [Cc, Bb, r1, r2]]) : (ridgeX ? [[Dd, Cc, r2, r1], [Bb, Aa, r1, r2], [Aa, Dd, r1], [Cc, Bb, r2]] : [[Aa, Dd, r2, r1], [Cc, Bb, r1, r2], [Bb, Aa, r1], [Dd, Cc, r2]]);
    for (const f of faces) { const pts = f.filter((p, i) => i === 0 || !p.equals(f[i - 1])); if (pts.length >= 3) { const m = roofFace(pts, roofM); m.material = roofM; m.material.side = THREE.DoubleSide; P.roof.add(m); } }
    if (gable) { const gm = smat(st.tex === 'plaster' ? 'plaster' : wallK, shadeH(st.wall, -0.1), { bump: 1, side: THREE.DoubleSide }); const tri = (a, b2, c) => { const g = new THREE.BufferGeometry().setFromPoints([a, b2, c]); g.computeVertexNormals(); wuv(g, 0.7); return mk(g, gm); };
      if (ridgeX) { const ax = -jet, bx = A + jet, za = -jet, zb = Dp + jet, hy = H + RH * ((zb - za) / 2) / ((z1 - z0) / 2); P.roof.add(tri(V3(bx, H, za), V3(bx, H, zb), V3(bx, hy, (za + zb) / 2))); P.roof.add(tri(V3(ax, H, zb), V3(ax, H, za), V3(ax, hy, (za + zb) / 2))); }
      else { const za = -jet, zb = Dp + jet, ax = -jet, bx = A + jet, hy = H + RH * ((bx - ax) / 2) / ((x1 - x0) / 2); P.roof.add(tri(V3(ax, H, zb), V3(bx, H, zb), V3((ax + bx) / 2, hy, zb))); P.roof.add(tri(V3(bx, H, za), V3(ax, H, za), V3((ax + bx) / 2, hy, za))); } }
    if (!r1.equals(r2)) { const d = new THREE.Vector3().subVectors(r2, r1); P.roof.add(limb(r1.clone().addScaledVector(d, -0.02), r2.clone().addScaledVector(d, 0.02), 0.06, 0.06, smat(st.roofTex === 'thatch' ? 'thatch' : 'stoneblock', shadeH(st.roof, 0.1)), 8)); }
    if (b.kind === 'house' || b.kind === 'tavern') { const cx = A * 0.3, cz = Dp * 0.35, top = H + RH * 0.85 + 0.4; P.roof.add(wbox(0.36, top - H + 0.2, 0.36, cx, (top + H - 0.2) / 2, cz, smat('brick', '#8a8478', { bump: 1.4 }), 2)); }
  } else {
    // torre-escada: paredes de pedra até o alto da muralha, com ameias
    for (const [part, x, z, w2, d2] of [['left', 0.09, Dp / 2, 0.18, Dp], ['right', A - 0.09, Dp / 2, 0.18, Dp], ['front', A / 2, Dp - 0.09, A, 0.18]]) for (let k = 0; k < (w2 > d2 ? w2 : d2) * 2; k++) P[part].add(mk(new THREE.BoxGeometry(w2 > d2 ? 0.28 : 0.22, 0.4, w2 > d2 ? 0.22 : 0.28).translate(w2 > d2 ? 0.25 + k * 0.5 : x, H + 0.2, w2 > d2 ? z : 0.25 + k * 0.5), smat('stoneblock', '#b0a998')));
    for (const [part, x, z, w2, d2] of [['left', 0.09, Dp / 2, 0.2, Dp], ['right', A - 0.09, Dp / 2, 0.2, Dp]]) P[part].add(wbox(w2, H - fh, d2, x, fh + (H - fh) / 2, z, smat('brick', st.wall), 1));
  }
  // mobília (a mesma dos interiores antigos)
  if (!tower) { const it = mInterior(b); for (const ch of it.children.slice()) if (ch.userData.furn) P.int.add(ch); }
  // placa da loja e da taverna (pendurada ao lado da porta)
  if (b.kind === 'shop' || b.kind === 'tavern') {
    const gS = grp(mk(new THREE.BoxGeometry(0.04, 0.04, 0.5).translate(0, 0, 0.25), IRON()), mk(wuv(new THREE.BoxGeometry(0.05, 0.42, 0.5).translate(0, -0.25, 0.45), 2), smat('wood', '#6a4a2c')));
    gS.add(b.kind === 'tavern' ? mk(new THREE.CylinderGeometry(0.1, 0.08, 0.22, 10).translate(0.06, -0.25, 0.45), smat('wood', '#a8783a')) : mk(new THREE.CylinderGeometry(0.12, 0.12, 0.04, 16).rotateZ(Math.PI / 2).translate(0.05, -0.25, 0.45), smat(null, '#e2b74e', { metal: 1, rough: 0.3 })));
    gS.position.set(Math.min(A - 0.3, dc + 0.8), Math.min(fh - 0.2, 1.4), Dp); P.front.add(gS);
  }
  // marca de porta: luz suave no chão em frente à entrada
  { const m = new THREE.Mesh(new THREE.CircleGeometry(0.42, 24).rotateX(-Math.PI / 2), W3.doorMat || (W3.doorMat = new THREE.MeshBasicMaterial({ color: 0xffd890, transparent: true, opacity: 0.35, depthWrite: false })));
    m.position.set(dc, 0.07, Dp + 0.45); P.marker.add(m); }
  // monta: centro da construção no mundo, girada para a porta
  const root = new THREE.Group(), inner = new THREE.Group();
  inner.position.set(-A / 2, 0, -Dp / 2); root.add(inner);
  root.position.set(b.x - 0.5 + b.w / 2, 0, b.y - 0.5 + b.h / 2); root.rotation.y = DOOR_ROT[b.door || 'S'];
  const parts = {};
  for (const k in P) { const g = k === 'marker' ? P[k] : mergeGroup(P[k], k !== 'floor'); g.userData.part = k; inner.add(g); parts[k] = g; }
  root.updateMatrixWorld(true);
  // normais das paredes no mundo (para saber quais estão viradas para a câmera)
  const nrm = { back: [0, -1], left: [-1, 0], right: [1, 0], front: [0, 1] }, a = DOOR_ROT[b.door || 'S'];
  const wn = {}; for (const k in nrm) { const [x, z] = nrm[k]; wn[k] = [x * Math.cos(a) + z * Math.sin(a), -x * Math.sin(a) + z * Math.cos(a)]; }
  const box = new THREE.Box3().setFromObject(root);
  return { root, parts, wn, box };
}

// ---------- objetos repetidos (árvores, postes, barris...) com instâncias ----------
const OBJ_MAKE = () => ({
  [O.TREE]: (x, y) => { const h = hash2(x, y, 17), z = WORLD.zone[y * MAP_W + x]; const tint = h > 0.88 && z !== Z.FOREST ? 2 : (TREE_TINT[z] || 0); return ['tr' + Math.floor(h * 3) + tint, () => sc3(mTree(Math.floor(h * 3), tint), 1.35)]; },
  [O.PINE]: (x, y) => { const v = Math.floor(hash2(x, y, 17) * 3); return ['pi' + v, () => sc3(mPine(v), 1.35)]; },
  [O.DEADTREE]: (x, y) => { const v = Math.floor(hash2(x, y, 17) * 3); return ['dt' + v, () => sc3(mDeadTree(v), 1.25)]; },
  [O.BUSH]: (x, y) => { const v = Math.floor(hash2(x, y, 17) * 3); return ['bu' + v, () => sc3(mBush(v), 0.8)]; },
  [O.ROCK]: (x, y) => { const v = Math.floor(hash2(x, y, 17) * 3); return ['ro' + v, () => mRock(v, 0)]; },
  [O.TALLGRASS]: (x, y) => { const v = Math.floor(hash2(x, y, 17) * 3), dry = WORLD.ground[y * MAP_W + x] === T.DEAD ? 1 : 0; return ['gr' + v + dry, () => sc3(mGrass(v, dry), 0.7)]; },
  [O.FLOWER]: (x, y) => { const v = Math.floor(hash2(x, y, 17) * 3); return ['fl' + v, () => mFlowers(v)]; },
  [O.LAMP]: () => ['lamp', () => mLamp()],
  [O.BENCH]: () => ['bench', () => sc3(mBench(), 0.5)],
  [O.STALL]: () => ['stall', () => sc3(mStall(), 0.6)],
  [O.FOUNTAIN]: () => ['fount', () => sc3(mFountain(), 1.15)],
  [O.BARREL]: () => ['barrel', () => sc3(mBarrel(), 0.5)],
  [O.CRATE]: () => ['crate', () => sc3(mCrate(), 0.5)],
  [O.CART]: () => ['cart', () => sc3(mCart(), 0.6)],
  [O.WELL]: () => ['well', () => sc3(mWell(), 0.72)],
  [O.BRAZIER]: () => ['braz', () => sc3(mBrazier(), 0.6)],
  [O.TORCH]: () => ['torch', () => sc3(mTorch(), 0.8)],
  [O.BANNER]: () => ['banner', () => { const g = mBannerPole(); g.add(mk(new THREE.PlaneGeometry(0.55, 1.0).translate(0.36, 1.9, -0.06), smat('cloth', '#2c447a', { side: THREE.DoubleSide }))); return g; }],
  [O.HAY]: () => ['hay', () => sc3(mHay(), 0.55)],
});
function sc3(g, k) { g.scale.setScalar(k); return g; }
function mFlowers(v) { const g = grp(), R = rng(950 + v), cols = ['#e889b0', '#f0d050', '#f2ede0', '#a888e0', '#e86a5a']; for (let k = 0; k < 9; k++) { const x = (R() - 0.5) * 0.8, z = (R() - 0.5) * 0.8; g.add(mk(new THREE.CylinderGeometry(0.008, 0.008, 0.14, 4).translate(x, 0.07, z), smat(null, '#3a6a28'))); g.add(mk(new THREE.SphereGeometry(0.035, 6, 4).translate(x, 0.15, z), smat(null, cols[Math.floor(R() * 5)], { rough: 0.6 }))); } return g; }
function buildProps() {
  const make = OBJ_MAKE(), groups = new Map();
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const o = WORLD.obj[y * MAP_W + x], f = make[o]; if (!f) continue;
    const [key, mk2] = f(x, y); let g = groups.get(key); if (!g) groups.set(key, g = { mk: mk2, at: [] });
    g.at.push([x, y, (o === O.TREE || o === O.PINE || o === O.ROCK || o === O.BUSH || o === O.TALLGRASS || o === O.FLOWER) ? hash2(x, y, 33) * 6.28 : 0]);
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0);
  for (const [key, g] of groups) {
    const tpl = mergeGroup(grp(g.mk()), !key.startsWith('gr') && !key.startsWith('fl'));
    for (const ch of tpl.children) {
      const im = new THREE.InstancedMesh(ch.geometry, ch.material, g.at.length);
      g.at.forEach(([x, y, r], i) => { q.setFromAxisAngle(up, r); m4.compose(new THREE.Vector3(x, 0, y), q, one); im.setMatrixAt(i, m4); });
      im.castShadow = ch.castShadow; im.receiveShadow = true; im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere && im.computeBoundingSphere();
      W3.scene.add(im);
    }
  }
}

// ---------- muralha, torres, portão e escadas ----------
function buildWalls() {
  const walls = grp(), stairs = grp();
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const i = y * MAP_W + x, o = WORLD.obj[i];
    if (o === O.WALL) { const wd = WORLD.wdir[i], ax = wd === 3 || wd === 4, isT = j => WORLD.obj[j] === O.PART || WORLD.obj[j] === O.TOWER, e = (isT(ax ? i - 1 : i - MAP_W) ? 1 : 0) | (isT(ax ? i + 1 : i + MAP_W) ? 2 : 0); const g = mWall(Math.floor(hash2(x, y, 17) * 3), false, hash2(x, y, 17) < 0.3, wd, e); g.position.set(x, 0, y); walls.add(g); }
    else if (o === O.TOWER) { const off = WORLD.toff[i], g = mTower(WORLD.tvar[i]); g.position.set(x - 0.5 + (Math.floor(off / 3) - 1) * 0.5, 0, y - 0.5 + (off % 3 - 1) * 0.5); walls.add(g); }
    else if (o === O.STAIRS) { const g = mStairs(WORLD.stair[i], WORLD.stairK[i]); g.position.set(x, 0, y); stairs.add(g); }
  }
  W3.scene.add(mergeGroup(walls)); W3.scene.add(mergeGroup(stairs));
  // portões: folhas animadas
  WORLD.gates.forEach((gt, gi) => {
    const g = mGateHouse(gt, 0); g.position.set(gt.x1, 0, gt.y);
    const leaves = []; g.traverse(o => { if (o.userData.leaf) leaves.push(o); });
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    W3.scene.add(g); W3.gates[gi] = leaves;
  });
}

// ---------- personagens: o mesmo esqueleto 3D, posado a cada quadro ----------
function rigFor3(e, kind) {
  let r = W3.ents.get(e);
  if (r) return r;
  let R, type = 'hero';
  if (kind === 'm') {
    if (MON_LOOK[e.type]) { R = buildHumanoid(lookFor('mon:' + e.type, MON_LOOK[e.type]), { scale: MON_SCALE[e.type] }); scaryMonster(e.type, R, MON_SCALE[e.type]); type = 'monh'; }
    else { R = buildCreature(e.type); scaryCreature(e.type, R); type = 'crt'; }
  } else if (kind === 'n') { R = buildHumanoid(lookFor('npc:' + e.kind, NPC_LOOKS[e.kind])); type = 'npc'; }
  else { const lk = e.cls + ':' + e.skin + ':' + e.color; R = buildHumanoid(lookFor(lk, () => heroLook(e.cls, e.skin, e.color))); epicHero(R, lookFor(lk, () => heroLook(e.cls, e.skin, e.color)), 1, e.skin); }
  R.root.scale.setScalar(CH_S);
  const layer = kind === 'm' ? 3 : kind === 'n' ? 4 : (e.id === G.myId ? 1 : 2);
  R.root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.layers.set(layer); } });
  r = { R, type, kind, yaw: 0, layer, look: kind === 'p' ? e.cls + e.skin + e.color : '' };
  W3.scene.add(R.root); W3.ents.set(e, r);
  return r;
}
const _v = typeof THREE !== 'undefined' ? new THREE.Vector3() : null;
function dirVec(d) { const a = (d | 0) * Math.PI / 4, sx = Math.sin(a), sy = Math.cos(a); return [(sx + 2 * sy) / 2, (2 * sy - sx) / 2]; }
function poseEnt(e, kind, now) {
  const r = rigFor3(e, kind), R = r.R;
  const hidden = !e.visible && e.id !== G.myId || (e.dieAt && now > e.dieAt + 600) || e.carriedBy;
  R.root.visible = !hidden; if (hidden) return r;
  let cls = kind === 'n' ? (NPC_CLS[e.kind] || 'knight') : kind === 'm' ? 'knight' : e.cls;
  if (r.type === 'crt') {
    const moving = e.walking || (e.buf && e.buf.length > 1 && dist(e.rx, e.ry, e.lx ?? e.rx, e.ly ?? e.ry) > 0.001);
    const ph = now / 160, atk = e.atkAt && now - e.atkAt < 420 ? Math.sin((now - e.atkAt) / 420 * Math.PI) : 0;
    R.legs.forEach((j, i) => { j.rotation.x = Math.sin(ph + (i % 2 ? Math.PI : 0) + (i >= 2 ? Math.PI : 0)) * (moving ? 0.5 : 0.05); });
    R.body.position.z = atk * 0.18; R.body.rotation.x = atk * 0.15; if (R.head) R.head.rotation.x = -atk * 0.4;
    if (R.blob) R.blob.scale.set(1 + atk * 0.15 + Math.sin(ph) * 0.05, 0.7 - atk * 0.1 - Math.sin(ph) * 0.05, 1 + atk * 0.1);
  } else {
    const P = heroPoseFor(e, now);
    if (e.walking && !P.sit) { P.walk = (e.walkDist * (cls === 'knight' ? 8.5 : 9.5) / (e.running ? 1.45 : 1)) % 12; }
    if (kind === 'm') { P.act = e.atkAt && now - e.atkAt < 440 ? { k: e.type === 'troll' || e.type === 'orc' ? 'bash' : 'swing', f: Math.min(11, Math.floor((now - e.atkAt) / 440 * 12)) } : P.act; }
    if (e.hitAt && now - e.hitAt < 300 && !P.act) P.act = { k: 'hurt', f: Math.min(11, Math.floor((now - e.hitAt) / 300 * 12)) };
    const Q = buildPose(cls, P); if (e.type === 'troll') Q.tl += 0.25;
    applyPose(R, Q, P, P.walk >= 0 ? P.walk / 12 * Math.PI * 2 : 0);
  }
  // direção: suave
  const [dx, dy] = dirVec(e.dir || 0), ty = Math.atan2(dx, dy);
  let d = ty - r.yaw; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; r.yaw += d * 0.25;
  const by = (e.z || 0) * WALL_Y;
  R.root.rotation.set(e.downed && !e.carriedBy ? -Math.PI / 2 : 0, r.yaw, 0, 'YXZ');
  R.root.position.set(e.rx, by, e.ry);
  // pés no chão
  if (r.type !== 'crt' && !e.downed) {
    R.root.updateMatrixWorld(true);
    let minY = Infinity; for (const f of [R.LA.ft, R.LB.ft]) { f.getWorldPosition(_v); minY = Math.min(minY, _v.y); }
    if (e.sit && !e.sit.chair) { R.hips.getWorldPosition(_v); minY = Math.min(minY, _v.y - 0.06); }
    R.root.position.y += by - minY + 0.015;
  } else if (e.downed) R.root.position.y = by + 0.12;
  if (e.dieAt) { const t = (now - e.dieAt) / 600; R.root.position.y -= Math.max(0, t) * 0.4; }
  return r;
}

// ---------- câmera girando de 90 em 90 graus ----------
function camDir() { const a = W3.rotA; return new THREE.Vector3(Math.cos(a) + Math.sin(a), 0, -Math.sin(a) + Math.cos(a)).normalize(); }
function rotateCam(d) { W3.rot = (W3.rot + d + 4) % 4; }
window.addEventListener('keydown', e => { if (!G.started || (document.activeElement && document.activeElement.tagName === 'INPUT')) return; if (e.key === 'PageUp') { rotateCam(1); e.preventDefault(); } else if (e.key === 'PageDown') { rotateCam(-1); e.preventDefault(); } });
window.addEventListener('mousedown', e => { if (e.button === 1 && G.started) { rotateCam(e.shiftKey ? -1 : 1); e.preventDefault(); } });
{ const box = document.createElement('div'); box.id = 'rot-btns'; box.innerHTML = '<button data-r="1" title="Girar câmera (PageUp)">⟲</button><button data-r="-1" title="Girar câmera (PageDown)">⟳</button>'; document.body.appendChild(box);
  box.querySelectorAll('button').forEach(b => b.addEventListener('click', () => rotateCam(+b.dataset.r)));
  const st = document.createElement('style'); st.textContent = '#rot-btns{position:fixed;top:316px;right:12px;z-index:5;display:flex;flex-direction:column;gap:6px}#rot-btns button{width:36px;height:36px;border-radius:50%;border:0;color:#e8d29a;font-size:18px;cursor:pointer;background:radial-gradient(#3a302a,#141010);box-shadow:0 0 0 1px #000,0 0 0 3px #8a6a2a}'; document.head.appendChild(st); }

// ---------- substitui o desenho 2D ----------
let W3built = false;
function buildWorld3D() {
  if (W3built) return; W3built = true;
  buildGround(); buildWalls(); buildProps();
  BUILDINGS.forEach((b, bi) => { const B = mBuilding3D(b); B.bi = bi; W3.scene.add(B.root); W3.bld.push(B); });
}
const _transp = new Map();
function transpMat(m) { let t = _transp.get(m); if (!t) { t = m.clone(); t.transparent = true; t.opacity = 0.3; t.depthWrite = false; _transp.set(m, t); } return t; }
function setTransparent(B, on, cdx, cdz) {
  const key = on ? (cdx > 0 ? 1 : 0) + (cdz > 0 ? 2 : 0) + 1 : 0;
  if (B.tr === key) return; B.tr = key;
  for (const k of ['back', 'left', 'right', 'front']) {
    const [nx, nz] = B.wn[k], face = on && nx * cdx + nz * cdz > 0.2;
    B.parts[k].traverse(o => { if (!o.isMesh) return; if (face) { if (!o.userData.om) o.userData.om = o.material; o.material = transpMat(o.userData.om); } else if (o.userData.om) o.material = o.userData.om; });
  }
}
renderWorld = function (ctx, now, cam, Wd, Hd, dpr) {
  if (!W3.ok) return [];
  buildWorld3D();
  const { renderer, scene, cam: C3, sun } = W3;
  const pr = Math.min(dpr || 1, W3.mobile ? 1 : (SET.quality === 'low' ? 1 : SET.quality === 'med' ? 1.25 : 1.6));
  if (renderer.getPixelRatio() !== pr) renderer.setPixelRatio(pr);
  const sz = renderer.getSize(_v2); if (sz.x !== Wd || sz.y !== Hd) renderer.setSize(Wd, Hd, false);
  renderer.shadowMap.enabled = SET.quality !== 'low';
  // câmera: segue o personagem, ângulo isométrico, gira suave
  const tgtA = W3.rot * Math.PI / 2; let da = tgtA - W3.rotA; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2; W3.rotA += da * 0.15;
  const tx = cam.x, ty = (cam.z || 0) * WALL_Y, tz = cam.y, dir = camDir();
  C3.position.set(tx + dir.x * 60, ty + 60 * Math.SQRT2 * Math.tan(Math.PI / 6), tz + dir.z * 60); C3.lookAt(tx, ty, tz);
  const vh = Hd / SCALE / A3, vw = Wd / SCALE / A3;
  C3.left = -vw / 2; C3.right = vw / 2; C3.top = vh / 2 + 0.6; C3.bottom = -vh / 2 + 0.6; C3.updateProjectionMatrix();
  sun.position.set(tx + S3.SUN.x * 50, ty + S3.SUN.y * 50, tz + S3.SUN.z * 50); sun.target.position.set(tx, ty, tz); sun.target.updateMatrixWorld();
  // dia e noite
  const day = dayInfo(); sun.intensity = 2.6 * (1 - day.dark * 1.3); W3.hemi.intensity = 0.62 * (1 - day.dark * 0.7) + 0.08; renderer.toneMappingExposure = 1.0 - day.dark * 0.35;
  if (W3.water) { W3.water.offset.set(now / 9000, now / 14000); }
  if (W3.doorMat) W3.doorMat.opacity = 0.22 + Math.sin(now / 500) * 0.1;
  // portões
  WORLD.gates.forEach((gt, gi) => { const f = (G.gateF && G.gateF[gi]) || 0; for (const pv of (W3.gates[gi] || [])) pv.rotation.y = pv.userData.leaf * f * 1.5; });
  // personagens
  const seen = new Set();
  for (const id in G.players) { const e = G.players[id]; seen.add(e); poseEnt(e, 'p', now); }
  for (const n of NPCS) { const e = G.npcs[n.id]; if (e) { seen.add(e); poseEnt(e, 'n', now); } }
  for (const id in G.monsters) { const e = G.monsters[id]; seen.add(e); poseEnt(e, 'm', now); }
  for (const [e, r] of W3.ents) if (!seen.has(e)) { scene.remove(r.R.root); W3.ents.delete(e); }
  // construções: dentro = telhado, andares de cima e paredes viradas para a câmera somem; na frente = transparente
  const me = G.me, inB = me && (me.z || 0) < 0.5 ? bldAt(me.rx, me.ry) : -1;
  const cdx = dir.x, cdz = dir.z;
  let occ = null;
  if (me) { const from = new THREE.Vector3(me.rx, (me.z || 0) * WALL_Y + 0.5, me.ry); W3.ray.set(from, new THREE.Vector3(cdx, Math.SQRT2 * Math.tan(Math.PI / 6), cdz).normalize()); occ = W3.ray.ray; }
  const tmp = new THREE.Vector3();
  for (const B of W3.bld) {
    const inside = B.bi === inB || (BUILDINGS[B.bi].kind === 'stairtower' && me && bldAt(me.rx, me.ry) === B.bi);
    const behind = !inside && occ && occ.intersectBox(B.box, tmp) !== null;
    B.parts.roof.visible = !inside && !behind; B.parts.upper.visible = !inside && !behind;
    for (const k of ['back', 'left', 'right', 'front']) { const [nx, nz] = B.wn[k]; B.parts[k].visible = !(inside && nx * cdx + nz * cdz > 0.2); }
    setTransparent(B, behind, cdx, cdz);
  }
  // desenha: cena + silhuetas de quem está atrás das paredes
  // 1) cenário  2) silhuetas (só onde o cenário esconde alguém)  3) personagens por cima
  C3.layers.set(0); renderer.autoClear = true; renderer.render(scene, C3);
  renderer.autoClear = false; renderer.shadowMap.autoUpdate = false;
  const bg = scene.background; scene.background = null;
  for (const L of [3, 2, 1]) { scene.overrideMaterial = W3.silMats[L]; C3.layers.set(L); renderer.render(scene, C3); }
  scene.overrideMaterial = null;
  C3.layers.disableAll(); for (const L of [1, 2, 3, 4]) C3.layers.enable(L); renderer.render(scene, C3);
  scene.background = bg; renderer.shadowMap.autoUpdate = true; renderer.autoClear = true; C3.layers.enableAll();
  // canvas 2D por cima: limpo (só falas e avisos)
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  G.view = { ox: 0, oy: 0 };
  // rótulos: falas, o "!" da capitã e aviso de caído — projetados da cabeça
  const labels = [];
  const proj = (x, y, z) => { _v.set(x, y, z).project(C3); return [(_v.x + 1) / 2 * Wd / SCALE, (1 - _v.y) / 2 * Hd / SCALE]; };
  for (const id in G.players) { const e = G.players[id]; if (!e.visible && id !== G.myId) continue; const [sx, sy] = proj(e.rx, (e.z || 0) * WALL_Y + 1.15, e.ry); labels.push({ sx, sy, name: e.name, e, player: true }); }
  for (const n of NPCS) { const e = G.npcs[n.id]; if (!e) continue; const [sx, sy] = proj(e.rx, 1.15, e.ry); labels.push({ sx, sy, name: e.name, npc: e, e }); }
  return labels;
};
const _v2 = typeof THREE !== 'undefined' ? new THREE.Vector2() : null;
// cliques: raio da câmera até o chão
screenToWorld = function (mx, my) {
  const C3 = W3.cam, h = (G.me && G.me.z >= 0.5) ? WALL_Y : 0;
  const nd = new THREE.Vector2(mx / innerWidth * 2 - 1, -(my / innerHeight) * 2 + 1);
  W3.ray.setFromCamera(nd, C3);
  const r = W3.ray.ray, t = (h - r.origin.y) / r.direction.y;
  return { x: r.origin.x + r.direction.x * t, y: r.origin.z + r.direction.z * t };
};
function pickEnt(list, mx, my, yOff) {
  let best = null, bd = 34;
  for (const e of list) { if (!e || e.dieAt || (!e.visible && !e.isNpc)) continue; _v.set(e.rx, (e.z || 0) * WALL_Y + yOff, e.ry).project(W3.cam); const sx = (_v.x + 1) / 2 * innerWidth, sy = (1 - _v.y) / 2 * innerHeight, d = Math.hypot(sx - mx, sy - my); if (d < bd) { bd = d; best = e; } }
  return best;
}
monsterUnderMouse = function (mx, my) { return pickEnt(Object.values(G.monsters), mx, my, 0.35); };
npcUnderMouse = function (mx, my) { const e = pickEnt(NPCS.map(n => G.npcs[n.id]), mx, my, 0.5); return e ? NPCS.find(n => G.npcs[n.id] === e) : null; };
// teclado: a direção acompanha o giro da câmera
{ const orig = myInput; myInput = function () { const v = orig(); if (!v) return v; const a = W3.rotA, x = v[0] * Math.cos(a) + v[1] * Math.sin(a), y = -v[0] * Math.sin(a) + v[1] * Math.cos(a); return [x, y]; }; }
// minimapa gira junto com a câmera
renderMinimap = function (c2, size) {
  const s = size / MAP_W / Math.SQRT2 * 1.9;
  c2.setTransform(1, 0, 0, 1, 0, 0); c2.clearRect(0, 0, size, size); c2.save();
  c2.translate(size / 2, size / 2); c2.rotate(Math.PI / 4 - W3.rotA); c2.scale(s, s); c2.translate(-G.me.rx, -G.me.ry);
  c2.imageSmoothingEnabled = false; c2.drawImage(MINI, 0, 0);
  { const f = typeof fogLayer === 'function' && fogLayer(); if (f) { c2.imageSmoothingEnabled = true; c2.drawImage(f, 0, 0); } }
  c2.fillStyle = '#e04a3a'; for (const id in G.monsters) { const e = G.monsters[id]; c2.fillRect(e.rx - 0.7, e.ry - 0.7, 1.4, 1.4); }
  for (const id in G.players) { const e = G.players[id]; if (!e.visible) continue; c2.fillStyle = id === G.myId ? '#ffffff' : '#6aa8f0'; c2.fillRect(e.rx - 1.4, e.ry - 1.4, 2.8, 2.8); }
  c2.fillStyle = '#7ad87a'; for (const n of NPCS) c2.fillRect(n.x - 0.8, n.y - 0.8, 1.6, 1.6);
  c2.restore();
};
