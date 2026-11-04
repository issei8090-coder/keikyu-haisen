# 金沢文庫の検車区 その8: 昼の留置の組で、出庫の番線にあとから着く入庫があり出庫をほかの番線へ回せないときは、その入庫(とその組)を先に決める
#  例: 730D→902D(9:02発、e395 から。e691 は 800A でふさがり)と、8:57:30 に e395 へ着く 852D(→1302T)
#  まだ決めていない入庫を避ける幅は着いて300秒まで・出庫は車庫を出る時刻 x から見る
#  使い方: build フォルダで python tools/patch_kbyard8.py(前の版は _tmp/ttcore.before_kbyard8.js から作る)
import io, os, shutil
def load(p): return io.open(p, encoding='utf-8', newline='').read()
def save(p, s): io.open(p, 'w', encoding='utf-8', newline='').write(s)
def rep(s, a, b, n=1):
    c = s.count(a); assert c == n, (c, a[:90]); return s.replace(a, b)

p = 'src/ttcore.js'
if not os.path.exists('_tmp/ttcore.before_kbyard8.js'): shutil.copy(p, '_tmp/ttcore.before_kbyard8.js')
s = load('_tmp/ttcore.before_kbyard8.js'); NL = '\r\n' if '\r\n' in s else '\n'; s = s.replace('\r\n', '\n')

s = rep(s, "          if (x < STAY0 + 60 || !okX(x) || !isFreeAt(pe, a1 - 10, dep0, d) || (avoid && avoid(pe, a1 - 10, dep0))) return null;",
           "          if (x < STAY0 + 60 || !okX(x) || !isFreeAt(pe, a1 - 10, dep0, d) || (avoid && avoid(pe, x, dep0))) return null;")
s = rep(s, "q.T - 10 < b && a < q.T + 130);   // まだ決めていない入庫が着く番線",
           "q.T - 10 < b && a < q.T + 300);   // まだ決めていない入庫が着く番線")
s = rep(s, "if (qi) { qi.pair = qo.pair = true; pairs.push([qi, qo]); } }",
           "if (qi) { qi.pair = qo.pair = true; qi.mate = qo; qo.mate = qi; pairs.push([qi, qo]); } }")
s = rep(s, "        for (const [qi, qo] of pairs) { if (platPair(qi, qo, pend) || altStart(qo, () => platPair(qi, qo, pend)) || platPair(qi, qo) || altStart(qo, () => platPair(qi, qo))) stat.yardMid",
           "        const tryPair = (qi, qo) => platPair(qi, qo, pend) || altStart(qo, () => platPair(qi, qo, pend));\n"
           "        const place = (q, m, dep) => m ? (tryPair(q, m) || (first(q, m, dep + 1) && tryPair(q, m)) || platPair(q, m) || altStart(m, () => platPair(q, m))) : platYard(q);\n"
           "        const first = (qi, qo, dep = 0) => { const pe = (platModes(qo) || {}).pe; let n = 0; if (dep > 3) return 0;   // この出庫の番線にあとから着く入庫を先に決める(その組の出庫の番線についても順に)\n"
           "          for (const q of reqs) { if (q.out || q === qi || done(q) || (q.pe || (q.pe = (platModes(q) || {}).pe)) !== pe || q.T < qo.T - 900 || q.T > qo.T + 300) continue;\n"
           "            const m = q.pair && q.mate && !done(q.mate) ? q.mate : null;\n"
           "            if (altEnd(q, () => place(q, m, dep)) || place(q, m, dep)) { n++; stat.yardFirst = (stat.yardFirst || 0) + 1; if (m) stat.yardMid = (stat.yardMid || 0) + 1; } }\n"
           "          return n; };\n"
           "        for (const [qi, qo] of pairs) { if (done(qi) && done(qo)) continue; if (tryPair(qi, qo) || (first(qi, qo) && tryPair(qi, qo)) || altEnd(qi, () => tryPair(qi, qo)) || platPair(qi, qo) || altStart(qo, () => platPair(qi, qo))) stat.yardMid")
s = rep(s, ": !platYard(q)) stat.yardMiss", ": !(platYard(q) || altEnd(q, () => platYard(q)))) stat.yardMiss")
# 入庫の列車をほかの番線に着ける(altStart の着く側): 経路の終わりの番線を変え、計画の番線の押さえを移して試す。だめなら元に戻す
s = rep(s, "        return false; };\n      const MID_GAP = 600;",
           "        return false; };\n"
           "      const altEnd = (q, tryFn) => { const t = q.t, n = t.names.length, old = t.route, e1 = old.stopE[old.stopE.length - 1], oldSd = t.sd, oldPe = q.pe, sx0 = stByName.get(st);\n"
           "        if (t.tail || t.userCut || (t.uset && t.uset.fin)) return false;\n"
           "        for (const [e] of sx0.stops) { if (e === e1 || isNaN(stopX[e])) continue;\n"
           "          const mine = (res.get(e1) || []).filter(v => v[2] === t); if (mine.some(v => !isFreeAt(e, v[0], v[1], t))) continue;\n"
           "          let r = null; try { r = buildTimedRoute(t.names, t.long, Object.assign({}, optOf(t), { isFree: (i, x) => i === n - 1 ? x === e : x === old.stopE[i] })); } catch (err) { r = null; }\n"
           "          if (!r || r.stopD.length !== old.stopD.length || r.stopE[r.stopE.length - 1] !== e || t.names.some((_, i) => i < n - 1 && r.stopE[i] !== old.stopE[i])) continue;\n"
           "          t.route = r; t.sd = undefined; q.pe = e; res.set(e1, (res.get(e1) || []).filter(v => v[2] !== t)); for (const v of mine) reserve(e, v[0], v[1], t);\n"
           "          if (tryFn()) { stat.yardAltIn = (stat.yardAltIn || 0) + 1; return true; }\n"
           "          t.route = old; t.sd = oldSd; q.pe = oldPe; res.set(e, (res.get(e) || []).filter(v => v[2] !== t)); for (const v of mine) reserve(e1, v[0], v[1], t);\n"
           "        }\n"
           "        return false; };\n"
           "      const MID_GAP = 600;")
save(p, s.replace('\n', NL)); print('ttcore ok')
