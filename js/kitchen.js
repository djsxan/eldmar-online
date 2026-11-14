// ============================================================
//  COZINHA — fogões nas casas e na taverna. F perto de um fogão abre as receitas;
//  cozinhar leva alguns segundos (mexendo a panela) e treina a habilidade Cozinha.
// ============================================================
function nearStove(r = 1.8) { const me = G.me; if (!me) return null; let best = null, bd = r; for (const k of KITCHENS) { const d = Math.hypot(k.x - me.x, k.y - me.y); if (d < bd) { bd = d; best = k; } } return best; }
function haveFor(rc) {
  const inv = (G.me && G.me.inv) || {};
  for (const k in rc.need) { if (k === 'meat') { if ((inv.venison || 0) + (inv.pork || 0) < rc.need[k]) return false; } else if ((inv[k] || 0) < rc.need[k]) return false; }
  return true;
}
function openCook() {
  let el = $('cookpanel');
  if (!el) {
    el = document.createElement('div'); el.id = 'cookpanel'; el.className = 'gpanel';
    el.innerHTML = '<div class="gp-head"><span>Fogão</span><button class="gp-x">✕</button></div><div id="cook-list"></div><div class="gp-note">Cozinhar leva alguns segundos; fique perto do fogão. Quanto mais você cozinha, mais a comida sacia.</div>';
    document.body.appendChild(el); el.querySelector('.gp-x').onclick = () => el.classList.add('hidden');
  }
  const box = el.querySelector('#cook-list'); box.innerHTML = '';
  for (const id in RECIPES) {
    const rc = RECIPES[id], ok = haveFor(rc), b = document.createElement('button');
    b.className = 'tr-node' + (ok ? ' can' : ' locked'); b.style.width = '100%'; b.style.margin = '3px 0';
    b.innerHTML = '<b>' + rc.name + '</b><span>' + Object.entries(rc.need).map(([k, n]) => n + 'x ' + (k === 'meat' ? 'carne crua' : LOOT[k].name)).join(' + ') + '</span>';
    b.title = rc.desc; b.onclick = () => { if (!haveFor(rc)) { showToast('Faltam ingredientes.'); return; } const st = nearStove(2.2); Net.send({ t: 'cookat', r: id }); el.classList.add('hidden'); G.busyUntil = performance.now() + 3100; G.busyFace = st ? { x: st.x, y: st.y } : null; G.me.anim = { a: 'cook', t0: performance.now(), ms: 3000 }; };
    box.appendChild(b);
  }
  el.classList.remove('hidden');
}
