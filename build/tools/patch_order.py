# 分岐の進路は時刻表の順に作る(先に通るはずの列車がまだ通っていなければ譲る)
import shutil
p = 'src/disp.js'
s = open(p, encoding='utf-8').read()
shutil.copy(p, '_tmp/disp/disp.js.before_order')
def rep(a, b):
    global s
    assert s.count(a) == 1, a[:70]
    s = s.replace(a, b)

# dispPlan: 分岐ごとに、通る列車と時刻表の時刻
rep("""      if (w.length) { (t.dWait || (t.dWait = {}))[k] = w; n++; }
    }
  }
  return n;
}""", """      if (w.length) { (t.dWait || (t.dWait = {}))[k] = w; n++; }
    }
  }
  // 分岐ごとに、通る列車とその時刻(時刻表)。進路を時刻表の順に作るのに使う
  D_NODEQ.clear();
  for (const o of list) {
    if (!o.route || !o.kn || o.unit || o.cut) continue;
    for (const g of o.route.segs) {
      if (dSecOf[g.e] < 0 || E[g.e].portal) continue; const nd = g.d ? E[g.e].a : E[g.e].b; if (adj[nd].length < 3) continue;
      const T = dKnT(o, g.d1); if (isNaN(T)) continue;
      if (!D_NODEQ.has(nd)) D_NODEQ.set(nd, []); D_NODEQ.get(nd).push({ o, d: g.d1, T });
    }
  }
  for (const [, q] of D_NODEQ) q.sort((a, b) => a.T - b.T);
  return n;
}""")

# dFree: 順序
rep("""function dFree(t, b, yudoOK) {""", """const D_NODEQ = new Map();   // 分岐 → [{o 列車, d 経路上の位置, T 時刻表で通る時刻}](時刻の順)
let D_NOW = 0;
// 列車 o が分岐(c)をもう通り過ぎたか
function dNodePassed(o, c) {
  if (o.ph) { const dpo = dPrep(o); return o.ph.m - o.ph.L / 2 > dpo.s2m(c.d) + 1; }
  if (o.sv != null && o.route) return o.s - dLen(o) / 2 > c.d + 1;
  if (D_NOW > o.end + 5) return true;
  return c.T - D_NOW > 300;   // まだ現れていない列車は、5分以上先なら気にしない
}
// 列車 o が分岐に着きそうな時刻
function dNodeEta(o, c) {
  if (o.sv != null) { let eta = D_NOW + Math.max(0, dKnT(o, c.d) - dKnT(o, o.s)); if (o.ph && o.ph.mode === 'run' && o.ph.v < 0.1) eta += Math.min(o.ph.waitT || 0, D_SWAP); return eta; }
  return c.T + Math.max(0, D_NOW - o.start);
}
// o が(前の列車などを介して)t を待っているか
function dChainTo(o, t) {
  let x = o;
  for (let g = 0; g < 10 && x; g++) { const nx = x.dByT || (x.ph && x.ph.v < 0.1 ? x.ph.obsT || x.ph.waitFor : null); if (!nx || nx === x) return false; if (nx === t || dPartner(nx, t)) return true; x = nx; }
  return false;
}
// 区間 b の分岐を、時刻表で先に通るはずの列車(まだ通っていない・5分以上は遅れていない・自分を待っていない)
function dOrderBlock(t, b) {
  if (!D_NODEQ.size || !b.nodes.length || !t.kn) return null;
  for (const { n: nd, m } of b.nodes) {
    const q = D_NODEQ.get(nd); if (!q) continue;
    const tT = dSchedAt(t, m); if (isNaN(tT)) continue;
    for (const c of q) {
      if (c.T >= tT - 1) break;
      if (c.T < tT - 1200) continue;
      const o = c.o; if (o === t || dPartner(o, t)) continue;
      if (dNodePassed(o, c)) continue;
      if (dNodeEta(o, c) > Math.max(D_NOW, tT) + D_SWAP) continue;
      if (dChainTo(o, t)) continue;
      return o;
    }
  }
  return null;
}
function dFree(t, b, yudoOK) {""")
rep("""  for (const { n: nd } of b.nodes) { const o = D_LOCKN.get(nd); if (o && !dPartner(o.t, t)) { t.dWhy = '分岐の進路 ' + o.t.no; t.dByT = o.t; return 0; } const q = D_OCCN.get(nd); if (q && !dPartner(q, t) && !(yudoOK && q.dStill)) { t.dWhy = '分岐に在線 ' + q.no; t.dByT = q; return 0; } }
  return res;""", """  for (const { n: nd } of b.nodes) { const o = D_LOCKN.get(nd); if (o && !dPartner(o.t, t)) { t.dWhy = '分岐の進路 ' + o.t.no; t.dByT = o.t; return 0; } const q = D_OCCN.get(nd); if (q && !dPartner(q, t) && !(yudoOK && q.dStill)) { t.dWhy = '分岐に在線 ' + q.no; t.dByT = q; return 0; } }
  { const o = dOrderBlock(t, b); if (o) { t.dWhy = '順序 ' + o.no; t.dByT = o; return 0; } }   // 分岐の進路は時刻表の順に
  return res;""")
rep("""function dispStep(act, T, lastT) {
  const dt = T - lastT;""", """function dispStep(act, T, lastT) {
  const dt = T - lastT; D_NOW = T;""")
open(p, 'w', encoding='utf-8').write(s)
print('ok')
