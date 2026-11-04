# 検車区 その5(2026-11-04): patch_nkyard4 の「かち合い」の見方を細かく
#  辺の上にいる間ずっと両端の分岐点をふさぐ扱いだと、ホームの途中に止まっている列車まで分岐点をふさいでしまい厳しすぎた
#  (神奈川新町 消8/現21・西馬込 7/6 に戻った)。
#  → 分岐点(ノード)は「列車の体がそこを覆っている間」(先頭が通ってから最後尾が抜けるまで)だけ。
#     ホーム(辺)は、時刻をずらした分(出庫で早く入る・入庫で遅く出る)だけ、その辺にいる列車を見る
import io, re
p = 'src/ttcore.js'
s = io.open(p, encoding='utf-8', newline='').read(); NL = '\r\n' if '\r\n' in s else '\n'
s = s.replace('\r\n', '\n')
def rep(a, b):
    global s
    c = s.count(a); assert c == 1, (c, a[:90]); s = s.replace(a, b)
# 下ごしらえ: addIv / clash を作り直す
i0 = s.index("      const addIv = o => {"); i1 = s.index("      const lgC = new Map(),")
s = s[:i0] + r"""      // 経路の分岐点の通過: [ノード, 覆い始め, 覆い終わり]。tf(x, back) = 先頭が x に来る時刻(back なら止まっていたあと出る時刻)、endT = 終点に着いてから動くまで
      const nodePass = (segs, total, L, tf, endT, d0 = -Infinity, d1 = Infinity) => { const out = [];
        for (const g of segs) { const e = E[g.e]; if (e.portal) continue;
          for (const [tp, dd] of [[g.t0, g.d0], [g.t1, g.d1]]) { const nd = tp < 1e-6 ? e.a : tp > 1 - 1e-6 ? e.b : -1; if (nd < 0 || !inBox(nd) || dd < d0 || dd > d1) continue;
            out.push([nd, tf(dd, false), dd + L >= total ? endT : tf(dd + L, true)]); } }
        return out; };
      const eIv = new Map();   // ホームの辺にいる時間
      const addIv = o => { const r = o.route; if (!r || !r.segs || !r.stopD || !o.A || o.A.length !== r.stopD.length) return; const L = (o.cars || 8) * 1.5;
        for (const [nd, a, b] of nodePass(r.segs, r.total, L, (x, back) => tAt(o, x, back), o.end)) { if (!ivs.has(nd)) ivs.set(nd, []); ivs.get(nd).push([a, b, o]); }
        for (const g of r.segs) { const e = E[g.e]; if (e.portal || isNaN(stopX[g.e]) || !inBox(e.a)) continue; if (!eIv.has(g.e)) eIv.set(g.e, []); eIv.get(g.e).push([tAt(o, g.d0, false), g.d1 + L >= r.total ? o.end : tAt(o, g.d1 + L, true), o]); } };
      for (const o of planned) addIv(o); for (const o of units) addIv(o);
      const skip = (o, own) => o === own || o.no === own.no || o === own.prev || o === own.next;
      const clash = (np, own, plat) => { for (const [nd, a, b] of np) for (const v of ivs.get(nd) || []) if (!skip(v[2], own) && a - YMG < v[1] && v[0] < b + YMG) return v[2];
        if (plat) for (const v of eIv.get(plat.e) || []) if (!skip(v[2], own) && plat.a - YMG < v[1] && v[0] < plat.b + YMG) return v[2];
        return null; };
""" + s[i1:]
# 出庫の確かめ
i0 = s.index("              { // 動きの通る分岐点\n"); i1 = s.index("              if (!enterFrom(d, h, from, a1)) continue;")
s = s[:i0] + r"""              { // 動きの通る分岐点
                const s1 = lg.stopD[1], P0 = Math.max(from, a1 - Math.max(15, Math.min(90, s1 / 2.5)));
                const np = nodePass(R.segs, R.total, L, x_ => x + (from - x) * x_ / R.total, P0).concat(nodePass(lg.segs, s1, L, x_ => x_ >= s1 ? a1 : P0 + (a1 - P0) * x_ / s1, dep0, -Infinity, s1));
                const pg = lg.segs.find(g => g.d0 <= s1 + 1e-6 && s1 <= g.d1 + 1e-6);
                const by = clash(np, d, sh < 0 && pg ? { e: pg.e, a: a1, b: a10 } : null); if (by) { stat.yardClash = (stat.yardClash || 0) + 1; continue; }
              }
""" + s[i1:]
# 入庫の確かめ
i0 = s.index("              { // 動きの通る分岐点(ホームにいる間も)\n"); i1 = s.index("              t.route = r; t.sd = undefined; t.tail = h; t.deadOut = 'yard';")
s = s[:i0] + r"""              { // 動きの通る分岐点(ホームを遅く出るなら、その間のホームも)
                const s0 = r.stopD[n - 2], s1 = r.stopD[n - 1], mvT = x_ => x_ <= s0 ? (x_ < s0 - 1e-6 ? ta : leave) : leave + (atH - leave) * (x_ - s0) / (s1 - s0);
                const np = nodePass(r.segs, s1, L, (x_, back) => x_ <= s0 && !back ? ta : mvT(x_), go, s0 - L, s1).concat(nodePass(R.segs, R.total, L, x_ => go + (x - go) * x_ / R.total, x + 30));
                const pg = r.segs.find(g => g.d0 <= s0 + 1e-6 && s0 <= g.d1 + 1e-6);
                const by = clash(np, t, sh > 0 && pg ? { e: pg.e, a: leave0, b: leave } : null); if (by) { stat.yardClash = (stat.yardClash || 0) + 1; continue; }
              }
""" + s[i1:]
s = s.replace('\n', NL)
io.open(p, 'w', encoding='utf-8', newline='').write(s); print('ok')
