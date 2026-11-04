# 金沢文庫の検車区 その6
#  - 出庫で、計画の番線が直前の列車でふさがっているとき(例: 648 6:13発の下り本線に 576 が 6:10〜6:11 停車)、
#    同じ駅のほかの番線から出す(車庫へ行ける番線だけ。列車の経路を作り直して、その番線の押さえも移す)
#  - 出庫は、まだ決めていない入庫の列車が着く番線・時刻(着いてから130秒)を先に避けて試す(852D 8:58着 と 902D の出庫)
#  使い方: build フォルダで python tools/patch_kbyard6.py(前の版は _tmp/ttcore.before_kbyard6.js)
import io, os, shutil
def load(p): return io.open(p, encoding='utf-8', newline='').read()
def save(p, s): io.open(p, 'w', encoding='utf-8', newline='').write(s)
def rep(s, a, b, n=1):
    c = s.count(a); assert c == n, (c, a[:90]); return s.replace(a, b)

p = 'src/ttcore.js'
if not os.path.exists('_tmp/ttcore.before_kbyard6.js'): shutil.copy(p, '_tmp/ttcore.before_kbyard6.js')
s = load(p); NL = '\r\n' if '\r\n' in s else '\n'; s = s.replace('\r\n', '\n')

s = rep(s, "      const platTry = (q, c, k, slot, m, sh, okX) => {", "      const platTry = (q, c, k, slot, m, sh, okX, avoid) => {")
s = rep(s, "          if (x < STAY0 + 60 || !okX(x) || !isFreeAt(pe, a1 - 10, dep0, d)) return null;\n",
           "          if (x < STAY0 + 60 || !okX(x) || !isFreeAt(pe, a1 - 10, dep0, d) || (avoid && avoid(pe, a1 - 10, dep0))) return null;\n")
a = """      const platYard = q => { const c = platModes(q); if (!c) return false;   // 1本だけ(1日の始まりから / 1日の終わりまで車庫に)
        for (const m of c.modes) for (const sh of q.out ? P_OUT : P_IN) for (const k of order()) for (let slot = 0; slot < cap(Y.tracks[k], c.L); slot++) {
          const v = platTry(q, c, k, slot, m, sh, q.out ? x => fits(k, slot, STAY0, x, [x]) : x => fits(k, slot, x, STAY1, [x]));
          if (v) { v.go(null); return true; } }
        return false; };
"""
b = """      const platYard = (q, avoid) => { const c = platModes(q); if (!c) return false;   // 1本だけ(1日の始まりから / 1日の終わりまで車庫に)
        for (const m of c.modes) for (const sh of q.out ? P_OUT : P_IN) for (const k of order()) for (let slot = 0; slot < cap(Y.tracks[k], c.L); slot++) {
          const v = platTry(q, c, k, slot, m, sh, q.out ? x => fits(k, slot, STAY0, x, [x]) : x => fits(k, slot, x, STAY1, [x]), avoid);
          if (v) { v.go(null); return true; } }
        return false; };
      // 出庫の列車をほかの番線から出す: 経路を作り直し、計画の番線の押さえをその番線へ移して試す。だめなら元に戻す
      const altStart = (q, avoid) => { const d = q.d, e0 = d.route.stopE[0], sx0 = stByName.get(st), old = d.route, oldSd = d.sd;
        for (const [e] of sx0.stops) { if (e === e0 || isNaN(stopX[e])) continue;
          const mine = (res.get(e0) || []).filter(v => v[2] === d); if (mine.some(v => !isFreeAt(e, v[0], v[1], d))) continue;
          let r = null; try { r = buildTimedRoute(d.names, d.long, Object.assign({}, d._opt, { isFree: (i, x) => i === 0 ? x === e : x === old.stopE[i] })); } catch (err) { r = null; }
          if (!r || r.stopD.length !== old.stopD.length || r.stopE[0] !== e || d.names.some((_, i) => i && r.stopE[i] !== old.stopE[i])) continue;
          d.route = r; d.sd = undefined; res.set(e0, (res.get(e0) || []).filter(v => v[2] !== d)); for (const v of mine) reserve(e, v[0], v[1], d);
          if (platYard(q, avoid)) { stat.yardAlt = (stat.yardAlt || 0) + 1; return true; }
          d.route = old; d.sd = oldSd; res.set(e, (res.get(e) || []).filter(v => v[2] !== d)); for (const v of mine) reserve(e0, v[0], v[1], d);
        }
        return false; };
"""
s = rep(s, a, b)

a = """        const miss = q => { if (!platYard(q)) stat.yardMiss = (stat.yardMiss || 0) + 1; }, back = [];
"""
b = """        const done = q => q.out ? !!q.d.prev : !!q.t.next;
        const pend = (pe, a, b) => reqs.some(q => !q.out && !done(q) && (q.pe || (q.pe = (platModes(q) || {}).pe)) === pe && q.T - 10 < b && a < q.T + 130);   // まだ決めていない入庫が着く番線
        const miss = q => { if (q.out ? !(platYard(q, pend) || altStart(q, pend) || platYard(q) || altStart(q)) : !platYard(q)) stat.yardMiss = (stat.yardMiss || 0) + 1; }, back = [];
"""
s = rep(s, a, b)
save(p, s.replace('\n', NL)); print('ttcore ok')
