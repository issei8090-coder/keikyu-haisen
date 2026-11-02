# 待避まわりの直し(何度実行してもよい。すでに当たっていれば何もしない)
#  1. 時刻表に発車時刻しか無い駅では、前の駅からふつうに走って早く着き、そこで抜かれることがある(子安など)
#  2. スカイアクセス線経由の列車が抜く時刻は、図の長さではなく所要時間の目安(THRU_REF)から決める
#  3. 待避線が、出ていく列車と数十秒だけ重なるなら、出たあとに入る(本線に止まって後ろの列車をふさがない)
#  4. 止まっている列車は「つかえている」と数えない(行き止まりの駅で縦列に止まっているとき)
import io
p = 'src/ttcore.js'; s = io.open(p, encoding='utf-8').read(); n = 0
def rep(a, b):
    global s, n
    if b in s: return
    assert s.count(a) == 1, a[:60]
    s = s.replace(a, b); n += 1

# 1
rep("""  const stat = { waits: 0, at: {}, loops: 0, loopAt: {} };
  const legOv = new Map();""",
"""  const stat = { waits: 0, at: {}, loops: 0, loopAt: {} };
  // 隣どうしの停車駅の間を、いちばん速い列車が走る時間。時刻表に発車時刻しか無い駅(着と発が同じ分)で、前の駅からの時間がこれより1分半以上長ければ、
  // 早く着いてその駅で待っているとみなせる(early = ふつうに走れば着ける時刻)
  const legMin = new Map();
  for (const pr of profs) for (let k = 0; k + 1 < pr.pts.length; k++) { const a = pr.pts[k], b = pr.pts[k + 1]; if (b.i !== a.i + 1) continue; const key = pr.dir + a.name + '>' + b.name, v = b.a - a.d; if (!(legMin.get(key) <= v)) legMin.set(key, v); }
  const early = (A, m) => { const w = A.pts[m], pv = A.pts[m - 1]; if (!pv || w.i !== pv.i + 1 || w.dwell !== 0 || A.t.ev[w.i].thru || A.t.ev[pv.i].thru) return w.a; const mn = legMin.get(A.dir + pv.name + '>' + w.name); return mn != null && w.a - pv.d >= mn + 90 ? pv.d + mn : w.a; };
  const legOv = new Map();""")
rep("""            const tb = timeAt(B, w.p).a, gap = (tb < w.a ? w.a - tb : tb > w.d ? tb - w.d : 0) - (w.dwell >= 2 ? 60 : 0);
            if (!best || gap < best.gap) best = { m, tb, gap };
          }""",
"""            const tb = timeAt(B, w.p).a, ea = early(A, m), gap = (tb < ea ? ea - tb : tb > w.d ? tb - w.d : 0) - (w.dwell >= 2 || w.d - ea >= 120 ? 60 : 0);
            if (!best || gap < best.gap) best = { m, tb, gap };
          }
          // 追いつかれる先の駅に早く着いて待てるなら、そこも候補(神奈川新町を先に出て子安で抜かれる普通など)
          if (!far && k2 + 1 < A.pts.length) { const w = A.pts[k2], ea = early(A, k2), x2 = ea < w.a && canWait(w.name, A.dir) ? timeAt(B, w.p) : null;
            if (x2) { const gap = (x2.a < ea + 30 ? ea + 30 - x2.a : 0) - 60; if (!best || gap < best.gap) best = { m: k2, tb: x2.a, gap }; } }""")
rep("""    const lo = pv ? pv.d + (w.a - pv.d) * 0.5 : w.a, hi = w.d + (nx.a - w.d) * 0.5;""",
    """    const lo = pv ? Math.min(pv.d + (w.a - pv.d) * 0.5, early(A, o.m)) : w.a, hi = w.d + (nx.a - w.d) * 0.5;""")
# 2
rep("""      const a0 = Math.max(pts[k].d + Math.abs(w.p - pts[k].p) / (1.5 * v), lo + 40), a1 = Math.min(pts[k + 1].a - Math.abs(pts[k + 1].p - w.p) / (1.5 * v), hi - 30);""",
    """      // スカイアクセス線経由の列車は tb が所要時間の目安から出ているので、そこから大きく動かさない(図の長さで速さを測ると、長く描かれた区間でずれる)
      const rr = B.acc && THRU_REF[e.name] != null && THRU_REF[pts[k].name] != null && THRU_REF[pts[k + 1].name] != null;
      const a0 = rr ? Math.max(tb - 45, lo + 40) : Math.max(pts[k].d + Math.abs(w.p - pts[k].p) / (1.5 * v), lo + 40), a1 = rr ? Math.min(tb + 45, hi - 30) : Math.min(pts[k + 1].a - Math.abs(pts[k + 1].p - w.p) / (1.5 * v), hi - 30);""")
# 3
rep("""if (i === n - 1 && t.forceEnd != null) return e === t.forceEnd; const s = span(t, i); return isFreeAt(e, s[0], s[1], t); } };""",
    """if (i === n - 1 && t.forceEnd != null) return e === t.forceEnd; const s = span(t, i); if (isFreeAt(e, s[0], s[1], t)) return true;
        // 待避で長く止まる列車: 先にいる列車がすぐ(LATE_IN秒以内に)出ていくなら、出たあとに入ることにして空きとみなす
        if (i > 0 && i < n - 1 && t.ev[i].ot && !t.cpl && E[e].dir && s[1] - s[0] > LATE_IN + 90 && isFreeAt(e, s[0] + LATE_IN, s[1], t)) { (t.lateIn || (t.lateIn = {}))[i] = e; return true; }
        return false; } };""")
rep("""      const sp = span(t, i), last = i === n - 1, k = i + t.k0;
      if (i === 0 && t.prev""",
    """      const last = i === n - 1, k = i + t.k0;
      if (t.lateIn && t.lateIn[i] === e) {   // 先にいる列車が出るのを待って入る
        const s0 = span(t, i); let x = -Infinity; for (const r of res.get(e) || []) if (r[2] !== t && !r[3] && r[0] < s0[1] && s0[0] < r[1] && r[1] > x) x = r[1];
        if (x > -Infinity && x + 5 > t.A[k]) { t.A[k] = x + 5; if (t.ev[i].as != null) t.ev[i].as = x + 5; }
      }
      const sp = span(t, i);
      if (i === 0 && t.prev""")
rep("""const FOLLOW_GAP = 15,""", """const LATE_IN = 50;
const FOLLOW_GAP = 15,""")
# 4
rep("""    if (blocker && limit < want) {""", """    if (blocker && limit < want && want > s0 + 1e-6) {""")
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('patched', n)
