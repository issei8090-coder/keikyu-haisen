# 種類ごとの役割: 過走余裕(止まる信号機の先 100m 以内の分岐)と、誘導信号機
import shutil
def patch(p, reps):
    s = open(p, encoding='utf-8').read()
    shutil.copy(p, '_tmp/disp/' + p.split('/')[-1] + '.before_role')
    for a, b in reps:
        assert s.count(a) == 1, (p, a[:70])
        s = s.replace(a, b)
    open(p, 'w', encoding='utf-8').write(s)

patch('src/disp.js', [
("""  const sg = t.dp.sig[j] && t.dp.sig[j].s;
  if (n === 1) { const b = t.dp.blocks[j]; return dHeadAsp(sg, b && b.len < 260 ? 'YY' : 'Y'); }""",
"""  const sg = t.dp.sig[j] && t.dp.sig[j].s;
  if (n === 1) {
    const b = t.dp.blocks[j]; let a = b && b.len < 260 ? 'YY' : 'Y';
    // 過走余裕: 次の(止まる)信号機の先の分岐がほかの列車に使われているなら警戒。警戒を出せない信号機は、空くまで停止
    if (j + 1 < t.dp.sig.length && !dOverrunClear(t, j + 1)) { const H = sg && sg.spec && SIG_HEADS[sg.spec.h]; a = !H || H.a.includes('YY') ? 'YY' : 'R'; }
    return dHeadAsp(sg, a);
  }"""),
("""// 信号機 j の現示(t から見て): その先に確保できている区間の数で決まる""",
"""// 過走余裕: 経路上の信号機 j1(停止を現示していて、列車が手前で止まる)の先 D_OVR(m)以内にある分岐と、そこまでの線路が、ほかの列車に使われていないか
const D_OVR = (DC.dispatch && DC.dispatch.overrun) || 100;
function dOverrunClear(t, j1) {
  const dp = t.dp, a = dp.sig[j1].m, sp = dp.spans(a, a + D_OVR); let zEnd = -1; const nodes = [];
  for (const s of sp) { const g = t.route.segs[s.i], nd = g.d ? E[g.e].a : E[g.e].b, mEnd = dp.M[s.i + 1]; if (mEnd > a && mEnd <= a + D_OVR + 0.01 && adj[nd].length >= 3) { nodes.push(nd); zEnd = Math.max(zEnd, mEnd); } }
  if (!nodes.length) return true;
  for (const nd of nodes) { const o = D_LOCKN.get(nd); if (o && !dPartner(o.t, t)) return false; const q = D_OCCN.get(nd); if (q && !dPartner(q, t)) return false; }
  for (const s of sp) {
    if (s.m0 >= zEnd) break;
    for (const o of D_OCC.get(s.e) || []) if (!dPartner(o.t, t) && o.lo <= s.hi && s.lo <= o.hi) return false;
    for (const k of D_LOCK.get(s.e) || []) if (!dPartner(k.t, t) && k.lo < s.hi - 0.5 && s.lo < k.hi - 0.5) return false;
  }
  return true;
}
// 誘導(止まっている列車のいる区間へ 15km/h で入れる)ができる信号機: 手で置いたものは、誘導信号機の付いた場内・入換だけ
const dYudoSig = s => !s || !s.spec || ((s.kind === '場内' || s.kind === '入換') && s.spec.yudo !== false);
// 信号機 j の現示(t から見て): その先に確保できている区間の数で決まる"""),
("""    const b = dBlock(t, j, rg), yudo = nextStop && stopX > b.a && stopX <= b.z + L;""",
"""    const b = dBlock(t, j, rg), yudo = nextStop && stopX > b.a && stopX <= b.z + L && dYudoSig(S.s);"""),
])

patch('src/dispui.js', [
("""      `<div class="se-row"><span>進路</span>""",
"""      ((s.kind === '場内' || s.kind === '入換') ? `<div class="se-row"><span>誘導</span><button data-sy="1" class="${sp && sp.yudo === false ? '' : 'on'}">誘導信号機あり</button><button data-sy="0" class="${sp && sp.yudo === false ? 'on' : ''}">なし</button></div>` : '') +
      `<div class="se-row"><span>進路</span>"""),
("""      box.querySelectorAll('[data-sr]').forEach(b => b.onclick = () => {""",
"""      box.querySelectorAll('[data-sy]').forEach(b => b.onclick = () => { const sp = dSpecFor(s); if (+b.dataset.sy) delete sp.yudo; else sp.yudo = false; delete sp.est; dSigApply(sp); });
      box.querySelectorAll('[data-sr]').forEach(b => b.onclick = () => {"""),
])
print('ok')
