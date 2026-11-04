# 神奈川新町の検車区 その3(2026-11-04): 車庫の出入りで使う引上線の選び方
#  引上線が2本以上あるとき(神奈川新町: 子安方の 351 と 356)、どちらでも行ける列車が「ほかの列車にはそこしか無い」引上線を先に取ってしまうと、
#  そちらしか使えない列車(下りへ出る列車・品川から着いて入庫する列車は 351 だけ)が入れない(平日 515 が 351 を取り 578 が出られなかった)。
#  → 列車ごとに行ける引上線だけを試し、行ける列車の少ない引上線から使う
import io
p = 'src/ttcore.js'
s = io.open(p, encoding='utf-8', newline='').read(); NL = '\r\n' if '\r\n' in s else '\n'
def rep(a, b, n=1):
    global s
    c = s.count(a); assert c == n, (c, a[:80]); s = s.replace(a, b)
a = "      reqs.sort((x, y) => (y.out - x.out) || (x.out ? y.T - x.T : x.T - y.T));"
b = """      { // 列車ごとに行ける引上線(時刻を見ない)と、引上線ごとの行ける列車の数
        const can = (q, h) => { if (q.out) { const d = q.d, r = buildTimedRoute(d.names, d.long, Object.assign({}, d._opt, { startAt: { e: h.e, t: h.t }, startExtra: true, tail: d.tail || null, after: d.tail ? null : d._opt.after, isFree: (i, e) => e === d.route.stopE[i] })); return !!r && r.stopD.length === d.route.stopD.length + 1 && r.stopD[1] <= 400 && d.names.every((_, i) => r.stopE[i] === d.route.stopE[i]); }
          const t = q.t, r = buildTimedRoute(t.names, t.long, Object.assign({}, optOf(t), { tail: h, tailMax: 320, tailRev: true, after: null, isFree: (i, e) => e === t.route.stopE[i] })); return !!r && r.stopD.length === t.route.stopD.length + 1 && t.names.every((_, i) => r.stopE[i] === t.route.stopE[i]); };
        const need = new Map(Y.hs.map(h => [h, 0]));
        for (const q of reqs) { q.hs = Y.hs.filter(h => can(q, h)); q.hs.forEach(h => need.set(h, need.get(h) + 1)); }
        for (const q of reqs) q.hs.sort((x, y) => need.get(x) - need.get(y));
      }
      const viaOf = (q, tr) => q.hs.filter(h => tr.via.includes(h));
      reqs.sort((x, y) => (y.out - x.out) || (x.out ? y.T - x.T : x.T - y.T));"""
rep(a, b.replace('\n', NL))
rep("for (let slot = 0; slot < cap(tr, L) && !done; slot++) for (const h of tr.via) {", "for (let slot = 0; slot < cap(tr, L) && !done; slot++) for (const h of viaOf(q, tr)) {", 2)
io.open(p, 'w', encoding='utf-8', newline='').write(s); print('ok')
