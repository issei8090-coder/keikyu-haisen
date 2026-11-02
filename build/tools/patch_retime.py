# 計画の秒を、時刻表の「分」の中で物理的に走れる秒に割り振り直す(区間の中の停車駅だけ)
import shutil
p = 'src/disp.js'
s = open(p, encoding='utf-8').read()
shutil.copy(p, '_tmp/disp/disp.js.before_retime')
def rep(a, b):
    global s
    assert s.count(a) == 1, a[:70]
    s = s.replace(a, b)

rep("""function dispPlan(list) {""", """// ===== 計画の秒の割り振り直し =====
// 時刻表は分単位。計画(ttcore)は着を「分+10〜25秒」、発を「分+35秒」のように決めているので、駅間が1分の普通は35秒で走る計画になり、物理的に走れない。
// 区間の中の停車駅について、時刻表の分(計画の秒の分)の中で、加速・ブレーキ・制限速度から求めた最短の走行時間で走れる秒に直す。
// 計画の秒はなるべく変えない: 走れない所だけ、発車を分の中で早める(後ろから)。それでも無理なら着を遅らせる(前から)
const D_RETIME = !(DC.dispatch && DC.dispatch.retime === false);
let D_RETIME_STAT = null;
// 経路上の位置 x0 から x1 まで(先頭の位置)、止まって出て止まるまでの最短の時間(秒)。信号は全部進行とみなす
function dMinRun(t, x0, x1) {
  const dp = t.dp, L = dLen(t), ds = 5, n = Math.max(2, Math.ceil((x1 - x0) / ds)), h = (x1 - x0) / n, vm = new Float64Array(n + 1), v = new Float64Array(n + 1);
  for (let i = 0; i <= n; i++) { const x = x0 + h * i; let w = KMH(ASP.G); for (const l of dp.lim) { if (l.m0 > x) break; if (x >= l.m0 && x - L <= l.m1) w = Math.min(w, l.v); } vm[i] = w; }
  v[0] = 0; for (let i = 0; i < n; i++) { const a = v[i] < D_ACCV ? D_ACC : D_ACC * D_ACCV / Math.max(v[i], 0.1); v[i + 1] = Math.min(vm[i + 1], Math.sqrt(v[i] * v[i] + 2 * a * h)); }
  v[n] = 0; for (let i = n; i > 0; i--) v[i - 1] = Math.min(v[i - 1], Math.sqrt(v[i] * v[i] + 2 * D_BRK * h));
  let T = 0; for (let i = 0; i < n; i++) T += h / Math.max(0.3, (v[i] + v[i + 1]) / 2);
  return T;
}
function dRetime(list) {
  const st = { trains: 0, moved: 0, late: 0, maxShift: 0 };
  for (const t of list) {
    if (!t.route || t.unit || t.cut || !t.A || !t.P || !t.sd) continue;
    if (!t.route.segs.some(g => dSecOf[g.e] >= 0)) continue;
    t.dp = null; const dp = dPrep(t), L = dLen(t);
    // 区間の中の停車駅(通過は除く)
    const S = dp.stops.filter(x => !x.thru && x.name && dSecOf[segAt(t.route, Math.max(0, Math.min(t.route.total, t.sd[x.k]))).e] >= 0);
    if (S.length < 2) continue;
    const A = S.map(x => t.A[x.k]), P = S.map(x => t.P[x.k]), A0 = A.slice(), P0 = P.slice(), R = [];
    for (let i = 0; i + 1 < S.length; i++) R.push(dMinRun(t, dStopX(S[i], L), dStopX(S[i + 1], L)) * 1.03 + 3);   // 最短の3%と3秒の余裕
    // 停車駅が続いていない(間に区間の外の駅がある)組は使わない
    for (let i = 0; i + 1 < S.length; i++) { let ok = true; for (let k = S[i].k + 1; k < S[i + 1].k; k++) { const ev = t.ev[k - t.k0]; if (!(ev && ev.thru)) ok = false; } if (!ok) R[i] = 0; }
    const lo = x => Math.floor(x / 60) * 60, dw = i => Math.min(DTR.minDwell, Math.max(0, P0[i] - A0[i]));
    // 後ろから: 次の着に間に合うように発車を(分の中で)早める
    for (let i = S.length - 2; i >= 0; i--) {
      if (!R[i]) continue;
      if (P[i] > A[i + 1] - R[i]) P[i] = Math.max(lo(P0[i]), A[i + 1] - R[i]);
      if (A[i] > P[i] - dw(i)) A[i] = Math.max(lo(A0[i]), Math.min(A[i], P[i] - dw(i)));
    }
    // 前から: それでも走れない所は、着(と発)を遅らせる
    for (let i = 0; i + 1 < S.length; i++) {
      if (R[i] && A[i + 1] < P[i] + R[i]) { A[i + 1] = P[i] + R[i]; st.late++; }
      if (P[i + 1] < A[i + 1] + dw(i + 1)) P[i + 1] = A[i + 1] + dw(i + 1);
    }
    let moved = false;
    for (let i = 0; i < S.length; i++) {
      if (Math.abs(A[i] - A0[i]) > 0.5 || Math.abs(P[i] - P0[i]) > 0.5) moved = true;
      st.maxShift = Math.max(st.maxShift, Math.abs(A[i] - A0[i]), Math.abs(P[i] - P0[i]));
    }
    st.trains++;
    if (!moved) continue;
    st.moved++;
    // 停車駅の間の通過点は、元の時刻の比で置き直す
    for (let i = 0; i + 1 < S.length; i++) {
      for (let k = S[i].k + 1; k < S[i + 1].k; k++) { const f = (t.A[k] - P0[i]) / Math.max(1, A0[i + 1] - P0[i]); t.A[k] = t.P[k] = P[i] + f * (A[i + 1] - P[i]); }
    }
    for (let i = 0; i < S.length; i++) { t.A[S[i].k] = A[i]; t.P[S[i].k] = P[i]; }
    t.kn = null; t.dp = null;
  }
  return st;
}
function dispPlan(list) {
  if (D_RETIME) D_RETIME_STAT = dRetime(list);""")
open(p, 'w', encoding='utf-8').write(s)
print('ok')
