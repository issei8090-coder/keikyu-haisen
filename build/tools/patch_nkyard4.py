# 検車区 その4(2026-11-04): 車庫の出入りが駅の手前の分岐・渡りで本線の列車とかち合わないようにする
#  平日 636・627・2344(子安方の引上線 351 → 上りの緩行線 y=317 を横切って下りのホームへ)が上りの列車と (594,317) で数秒重なっていた。
#  yard() で、駅の近く(BOX)の分岐点(ノード)ごとに「ほかの列車がいる時間」を計画の A/P から出しておき、
#  出入りの動き(車庫の線⇄引上線⇄ホーム)が前後 YMG 秒以内に同じ分岐点を使うなら、時刻をずらして試す
#  (出庫: ホームに早めに入る 0〜-300秒、入庫: ホームを遅めに出る 0〜+600秒。ホームのふさがりも同じ方法で見る)
import io
p = 'src/ttcore.js'
s = io.open(p, encoding='utf-8', newline='').read(); NL = '\r\n' if '\r\n' in s else '\n'
s = s.replace('\r\n', '\n')
a0 = s.index("        if (q.out) {   // 出庫: 車庫の線 → 引上線(折り返し) → ホーム")
a1 = s.index("        if (!(q.out ? q.d.prev : q.t.next)) stat.yardMiss")
new = r"""        if (q.out) {   // 出庫: 車庫の線 → 引上線(折り返し) → ホーム
          const d = q.d, L = (d.cars || 8) * 1.5, dep0 = q.T, sIn = ttStn(st, 'in'), a10 = sIn != null ? dep0 - sIn * 60 : dep0 - 60;
          let done = false;
          for (const sh of OUT_SH) { for (const k of order()) { const tr = Y.tracks[k];
            for (let slot = 0; slot < cap(tr, L) && !done; slot++) for (const h of viaOf(q, tr)) {
              const R = route(Y.pos(tr.node, slotTrim(tr, slot, L)), h.set, h.trim, 'o' + k + ':' + slot + ':' + h.node); if (!R) continue;
              const a1 = a10 + sh, mv = MV(R.total), tBack = Math.max(15, Math.min(90, h.dist / 2.5)), from = a1 - tBack - REV, x = from - mv;
              if (x < STAY0 + 60 || !fits(k, slot, STAY0, x, [x]) || !isFreeAt(h.e, x - 10, a1 + 10, d)) continue;
              const lg = legOut(d, h); if (!lg) continue;
              { // 動きの通る分岐点
                const s1 = lg.stopD[1], P0 = Math.max(from, a1 - Math.max(15, Math.min(90, s1 / 2.5))), it = [];
                for (const g of R.segs) it.push({ e: g.e, a: x + (from - x) * g.d0 / R.total, b: g.d1 + L >= R.total ? P0 : x + (from - x) * (g.d1 + L) / R.total });
                for (const g of lg.segs) { if (g.d0 >= s1) break; it.push({ e: g.e, a: P0 + (a1 - P0) * g.d0 / s1, b: g.d1 + L >= s1 ? dep0 : P0 + (a1 - P0) * (g.d1 + L) / s1 }); }
                const by = clash(it, d); if (by) { stat.yardClash = (stat.yardClash || 0) + 1; continue; }
              }
              if (!enterFrom(d, h, from, a1)) continue;
              const K = { no: d.no, type: 'kaiso', dest: st, cars: d.cars, fl: 0, x0: '', x1: '', tseg: null, tt: true, s: 0, g: null, k0: 0, yard: 'out', yardSt: st, yardTr: tr.label + (cap(tr, L) > 1 ? (slot ? '(手前)' : '(奥)') : ''), stay: true, dh: true,
                names: [st], ev: [{ name: st, arr: Math.floor(STAY0 / 60), dep: Math.floor(x / 60) }], route: R, A: [STAY0, from], P: [x, from], start: STAY0, end: from, prev: null, next: d };
              d.prev = K; d.deadIn = 'yard'; reserve(h.e, x - 10, a1 + 10, d); occ[k].push({ slot, a: STAY0, b: x, xs: [x] }); units.push(K); stat.yardOut = (stat.yardOut || 0) + 1; addIv(K); addIv(d); done = true; break;
            }
            if (done) break; }
            if (done) break; }
        } else {   // 入庫: ホーム → 引上線(折り返し) → 車庫の線
          const t = q.t, L = (t.cars || 8) * 1.5, ta = q.T, sOut = ttStn(st, 'out'), leave0 = ta + (sOut != null ? Math.max(20, sOut * 60) : 40);
          let done = false;
          for (const sh of IN_SH) { for (const k of order()) { const tr = Y.tracks[k];
            for (let slot = 0; slot < cap(tr, L) && !done; slot++) for (const h of viaOf(q, tr)) {
              const R = route({ e: h.e, t: h.t }, tr.via && new Set([tr.node]), slotTrim(tr, slot, L), 'i' + k + ':' + slot + ':' + h.node); if (!R) continue;
              const r = legIn(t, h); if (!r) continue;
              const n = r.stopD.length, leave = leave0 + sh, out = r.stopD[n - 1] - r.stopD[n - 2], tOut = Math.max(15, Math.min(45, out / 2.5)), atH = leave + tOut, go = atH + REV, mv = MV(R.total), x = go + mv;
              if (!fits(k, slot, x, STAY1, [x]) || !isFreeAt(h.e, leave + 5, go + 10, t)) continue;
              { // 動きの通る分岐点(ホームにいる間も)
                const s0 = r.stopD[n - 2], s1 = r.stopD[n - 1], it = [{ e: r.stopE[n - 2], a: ta, b: leave }];
                for (const g of r.segs) { if (g.d1 <= s0 - L) continue; it.push({ e: g.e, a: g.d0 <= s0 ? ta : leave + (atH - leave) * (g.d0 - s0) / (s1 - s0), b: g.d1 + L >= s1 ? go : leave + (atH - leave) * Math.max(0, g.d1 + L - s0) / (s1 - s0) }); }
                for (const g of R.segs) it.push({ e: g.e, a: go + (x - go) * g.d0 / R.total, b: g.d1 + L >= R.total ? x + 30 : go + (x - go) * (g.d1 + L) / R.total });
                const by = clash(it, t); if (by) { stat.yardClash = (stat.yardClash || 0) + 1; continue; }
              }
              t.route = r; t.sd = undefined; t.tail = h; t.deadOut = 'yard';
              t.P[t.P.length - 1] = leave; t.A.push(atH); t.P.push(go); t.end = go;
              const K = { no: t.no, type: 'kaiso', dest: st, cars: t.cars, fl: 0, x0: '', x1: '', tseg: null, tt: true, s: 0, g: null, k0: 0, yard: 'in', yardSt: st, yardTr: tr.label + (cap(tr, L) > 1 ? (slot ? '(手前)' : '(奥)') : ''), stay: true, dh: true,
                names: [st], ev: [{ name: st, arr: Math.floor(x / 60), dep: Math.floor(STAY1 / 60) }], route: R, A: [go, x], P: [go, STAY1], start: go, end: STAY1, prev: t, next: null };
              t.next = K; reserve(h.e, leave + 5, go + 10, t); occ[k].push({ slot, a: x, b: STAY1, xs: [x] }); units.push(K); stat.yardIn = (stat.yardIn || 0) + 1; addIv(K); addIv(t); done = true; break;
            }
            if (done) break; }
            if (done) break; }
        }
"""
s = s[:a0] + new + s[a1:]
# 下ごしらえ(viaOf の直後)
a = "      const viaOf = (q, tr) => q.hs.filter(h => tr.via.includes(h));\n"
assert s.count(a) == 1
b = a + r"""      // 駅の近くの分岐点ごとの「列車がいる時間」(計画の A/P を線形に補間。前 = 先頭が着く時刻、後 = 最後尾が抜ける時刻)
      const sx = stByName.get(st), inBox = nd => Math.abs(N[nd].x - sx.cx) < 140 && Math.abs(N[nd].y - sx.ly) < 110, ivs = new Map(), YMG = 15;
      const tAt = (o, x, back) => { const sd = o.route.stopD, A = o.A, P = o.P; if (x <= sd[0] + 0.5) return back ? P[0] : A[0]; for (let i = 0; i + 1 < sd.length; i++) { if (Math.abs(x - sd[i + 1]) < 0.5) return back ? P[i + 1] : A[i + 1]; if (x < sd[i + 1]) return P[i] + (A[i + 1] - P[i]) * (x - sd[i]) / (sd[i + 1] - sd[i]); } return back ? o.end : A[A.length - 1]; };
      const addIv = o => { const r = o.route; if (!r || !r.segs || !r.stopD || !o.A || o.A.length !== r.stopD.length) return; const L = (o.cars || 8) * 1.5;
        for (const g of r.segs) { const e = E[g.e]; if (e.portal || (!inBox(e.a) && !inBox(e.b))) continue; const a = tAt(o, g.d0, false), b = g.d1 + L >= r.total ? o.end : tAt(o, g.d1 + L, true);
          for (const nd of [e.a, e.b]) if (inBox(nd)) { if (!ivs.has(nd)) ivs.set(nd, []); ivs.get(nd).push([a, b, o]); } } };
      for (const o of planned) addIv(o); for (const o of units) addIv(o);
      const clash = (it, own) => { for (const q of it) { const e = E[q.e]; if (e.portal) continue; for (const nd of [e.a, e.b]) for (const v of ivs.get(nd) || []) { const o = v[2]; if (o === own || o.no === own.no || o === own.prev || o === own.next) continue; if (q.a - YMG < v[1] && v[0] < q.b + YMG) return o; } } return null; };
      const lgC = new Map(), legOut = (d, h) => { const k = 'o' + d.no + ':' + h.node; if (lgC.has(k)) return lgC.get(k); const r = buildTimedRoute(d.names, d.long, Object.assign({}, d._opt, { startAt: { e: h.e, t: h.t }, startExtra: true, tail: d.tail || null, after: d.tail ? null : d._opt.after, isFree: (i, e) => e === d.route.stopE[i] })); const v = r && r.stopD.length === d.route.stopD.length + 1 && r.stopD[1] <= 400 && d.names.every((_, i) => r.stopE[i] === d.route.stopE[i]) ? r : null; lgC.set(k, v); return v; };
      const legIn = (t, h) => { const k = 'i' + t.no + ':' + h.node; if (lgC.has(k)) return lgC.get(k); const r = buildTimedRoute(t.names, t.long, Object.assign({}, optOf(t), { tail: h, tailMax: 320, tailRev: true, after: null, isFree: (i, e) => e === t.route.stopE[i] })); const v = r && r.stopD.length === t.route.stopD.length + 1 && t.names.every((_, i) => r.stopE[i] === t.route.stopE[i]) ? r : null; lgC.set(k, v); return v; };
      const OUT_SH = [0, -30, -60, -90, -120, -180, -240, -300], IN_SH = [0, 30, 60, 90, 120, 180, 240, 300, 420, 600];
"""
s = s.replace(a, b)
s = s.replace('\n', NL)
io.open(p, 'w', encoding='utf-8', newline='').write(s); print('ok')
