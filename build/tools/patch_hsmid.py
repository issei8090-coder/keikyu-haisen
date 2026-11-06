# 引上線(入出庫線)で向きを変える検車区にも「昼の留置」(入庫した車両があとの出庫になる)を入れる(2026-11-05、久里浜検車区)
#  これまで: 引上線方式(hs)の検車区は、入庫=その日の終わりまで線をふさぐ・出庫=1日の始まりからいる、だけ。
#  久里浜は昼に入って夕方に出る車両が多く、線が足りずに消える/現れるが平日32本残った。
#  YARD_CFG の mid: true の駅だけ、ホームで向きを変える検車区(platPair)と同じ組み方で、同じ両数・30分以上あとの出庫と組にする。
#  使い方: build フォルダで python tools/patch_hsmid.py(src/ttcore.js と src/core.js を書き換える。前の版は _tmp/ttcore.before_hsmid.js)
import io, os, shutil
p = 'src/ttcore.js'
if not os.path.exists('_tmp/ttcore.before_hsmid.js'): shutil.copy(p, '_tmp/ttcore.before_hsmid.js')
raw = io.open('_tmp/ttcore.before_hsmid.js', encoding='utf-8', newline='').read()
crlf = '\r\n' in raw
s = raw.replace('\r\n', '\n')
A = "      for (const q of reqs) {\n        if (q.out) {   // 出庫: 車庫の線 → 引上線(折り返し) → ホーム\n"
Z = "        if (!(q.out ? q.d.prev : q.t.next)) stat.yardMiss = (stat.yardMiss || 0) + 1;\n      }\n"
i = s.index(A); j = s.index(Z, i) + len(Z)
NEW = r"""      // 引上線で向きを変える検車区: 1回の出入り(車庫の線 k・位置 slot・引上線 h・時刻のずらし sh)を試す。okX(x) = 車庫の線での出入りの時刻 x で線が空いているか
      //  返り値 { x, go }。出庫の go(mid): mid = { x: 昼に入庫した車両が車庫の線に着いた時刻, mk: () => 入庫の K を作る } / 入庫の go(xOut): あとで出庫する時刻(無ければ1日の終わりまで)
      const hsTry = (q, k, slot, h, sh, okX) => {
        const tr = Y.tracks[k];
        if (q.out) {   // 出庫: 車庫の線 → 引上線(折り返し) → ホーム
          const d = q.d, L = (d.cars || 8) * 1.5, dep0 = q.T, sIn = ttStn(st, 'in'), a10 = sIn != null ? dep0 - sIn * 60 : dep0 - 60;
          const R = route(Y.pos(tr.node, slotTrim(tr, slot, L)), h.set, h.trim, 'o' + k + ':' + slot + ':' + h.node); if (!R) return null;
          const a1 = a10 + sh, mv = MV(R.total), tBack = Math.max(15, Math.min(90, h.dist / 2.5)), from = a1 - tBack - REV, x = from - mv;
          if (x < STAY0 + 60 || !okX(x) || !isFreeAt(h.e, x - 10, a1 + 10, d)) return null;
          const lg = legOut(d, h); if (!lg) return null;
          { // 動きの通る分岐点
            const s1 = lg.stopD[1], P0 = Math.max(from, a1 - Math.max(15, Math.min(90, s1 / 2.5)));
            const np = nodePass(R.segs, R.total, L, x_ => x + (from - x) * x_ / R.total, P0).concat(nodePass(lg.segs, s1, L, x_ => x_ >= s1 ? a1 : P0 + (a1 - P0) * x_ / s1, dep0, -Infinity, s1));
            const pg = lg.segs.find(g => g.d0 <= s1 + 1e-6 && s1 <= g.d1 + 1e-6);
            const by = clash(np, d, sh < 0 && pg ? { e: pg.e, a: a1, b: a10 } : null); if (by) { stat.yardClash = (stat.yardClash || 0) + 1; return null; }
          }
          return { x, go: mid => {
            if (!enterFrom(d, h, from, a1)) return null;
            const midK = mid ? mid.mk() : null, s0 = mid ? mid.x : STAY0;
            const K = { no: d.no, type: 'kaiso', dest: st, cars: d.cars, fl: 0, x0: '', x1: '', tseg: null, tt: true, s: 0, g: null, k0: 0, yard: 'out', yardSt: st, yardTr: tr.label + slotName(tr, slot, L), yardMid: !!mid, stay: !mid, dh: true,
              names: [st], ev: [{ name: st, arr: Math.floor(s0 / 60), dep: Math.floor(x / 60) }], route: R, A: [s0, from], P: [x, from], start: s0, end: from, prev: midK, next: d };
            if (midK) midK.next = K;
            d.prev = K; d.deadIn = 'yard'; reserve(h.e, x - 10, a1 + 10, d); if (!mid) occ[k].push({ slot, a: STAY0, b: x, xs: [x] }); units.push(K); stat.yardOut = (stat.yardOut || 0) + 1; addIv(K); addIv(d); return K; } };
        }
        // 入庫: ホーム → 引上線(折り返し) → 車庫の線
        const t = q.t, L = (t.cars || 8) * 1.5, ta = q.T, sOut = ttStn(st, 'out'), leave0 = ta + (sOut != null ? Math.max(20, sOut * 60) : 40);
        const R = route({ e: h.e, t: h.t }, tr.via && new Set([tr.node]), slotTrim(tr, slot, L), 'i' + k + ':' + slot + ':' + h.node); if (!R) return null;
        const r = legIn(t, h); if (!r) return null;
        const n = r.stopD.length, leave = leave0 + sh, out = r.stopD[n - 1] - r.stopD[n - 2], tOut = Math.max(15, Math.min(45, out / 2.5)), atH = leave + tOut, go = atH + REV, mv = MV(R.total), x = go + mv;
        if (!okX(x) || !isFreeAt(h.e, leave + 5, go + 10, t)) return null;
        { // 動きの通る分岐点(ホームを遅く出るなら、その間のホームも)
          const s0 = r.stopD[n - 2], s1 = r.stopD[n - 1], mvT = x_ => x_ <= s0 ? (x_ < s0 - 1e-6 ? ta : leave) : leave + (atH - leave) * (x_ - s0) / (s1 - s0);
          const np = nodePass(r.segs, s1, L, (x_, back) => x_ <= s0 && !back ? ta : mvT(x_), go, s0 - L, s1).concat(nodePass(R.segs, R.total, L, x_ => go + (x - go) * x_ / R.total, x + 30));
          const pg = r.segs.find(g => g.d0 <= s0 + 1e-6 && s0 <= g.d1 + 1e-6);
          const by = clash(np, t, sh > 0 && pg ? { e: pg.e, a: leave0, b: leave } : null); if (by) { stat.yardClash = (stat.yardClash || 0) + 1; return null; }
        }
        return { x, go: xOut => {
          const b = xOut || STAY1;
          t.route = r; t.sd = undefined; t.tail = h; t.deadOut = 'yard';
          t.P[t.P.length - 1] = leave; t.A.push(atH); t.P.push(go); t.end = go;
          const K = { no: t.no, type: 'kaiso', dest: st, cars: t.cars, fl: 0, x0: '', x1: '', tseg: null, tt: true, s: 0, g: null, k0: 0, yard: 'in', yardSt: st, yardTr: tr.label + slotName(tr, slot, L), yardMid: !!xOut, stay: !xOut, dh: true,
            names: [st], ev: [{ name: st, arr: Math.floor(x / 60), dep: Math.floor(b / 60) }], route: R, A: [go, x], P: [go, b], start: go, end: b, prev: t, next: null };
          t.next = K; reserve(h.e, leave + 5, go + 10, t); occ[k].push({ slot, a: x, b, xs: xOut ? [x, xOut] : [x] }); units.push(K); stat.yardIn = (stat.yardIn || 0) + 1; addIv(K); addIv(t); return K; } };
      };
      const hsYard = q => {   // 1本だけ(1日の始まりから / 1日の終わりまで車庫に)
        const L = ((q.out ? q.d : q.t).cars || 8) * 1.5;
        for (const sh of q.out ? OUT_SH : IN_SH) for (const k of order()) { const tr = Y.tracks[k];
          for (let slot = 0; slot < cap(tr, L); slot++) for (const h of viaOf(q, tr)) {
            const v = hsTry(q, k, slot, h, sh, q.out ? x => fits(k, slot, STAY0, x, [x]) : x => fits(k, slot, x, STAY1, [x]));
            if (v && v.go(null)) return true; } }
        return false; };
      const hsPair = (qi, qo) => {   // 昼の留置: 入庫した車両がそのまま同じ線から出庫
        const Li = (qi.t.cars || 8) * 1.5, Lo = (qo.d.cars || 8) * 1.5;
        for (const k of order()) { const tr = Y.tracks[k];
          for (let slot = 0; slot < Math.min(cap(tr, Li), cap(tr, Lo)); slot++) {
            const vi = [];
            for (const h of viaOf(qi, tr)) for (const sh of IN_SH) { const v = hsTry(qi, k, slot, h, sh, x => fits(k, slot, x, x + MID_GAP, [x])); if (v) { vi.push(v); break; } }
            if (!vi.length) continue;
            const ok = (a, x) => x >= a.x + MID_GAP && fits(k, slot, a.x, x, [a.x, x]);
            for (const h of viaOf(qo, tr)) for (const sh of OUT_SH) {
              const v = hsTry(qo, k, slot, h, sh, x => vi.some(a => ok(a, x))); if (!v) continue;
              const a = vi.find(a => ok(a, v.x)); if (v.go({ x: a.x, mk: () => a.go(v.x) })) return true; }
          } }
        return false; };
      if (YARD_CFG[st] && YARD_CFG[st].mid) {
        const ins = reqs.filter(q => !q.out).sort((x, y) => x.T - y.T), outs = reqs.filter(q => q.out).sort((x, y) => x.T - y.T), pairs = [];
        for (const qo of outs) { const qi = ins.find(q => !q.pair && (q.t.cars || 8) === (qo.d.cars || 8) && q.T + 1800 <= qo.T); if (qi) { qi.pair = qo.pair = true; pairs.push([qi, qo]); } }
        const miss = q => { if (!hsYard(q)) stat.yardMiss = (stat.yardMiss || 0) + 1; }, back = [];
        for (const q of reqs) if (q.out && !q.pair) miss(q);
        for (const [qi, qo] of pairs) { if (hsPair(qi, qo)) stat.yardMid = (stat.yardMid || 0) + 1; else back.push(qi, qo); }
        for (const q of back) if (q.out) miss(q);
        for (const q of back) if (!q.out) miss(q);
        for (const q of reqs) if (!q.out && !q.pair) miss(q);
        continue;
      }
      for (const q of reqs) {
        if (!hsYard(q)) stat.yardMiss = (stat.yardMiss || 0) + 1;
      }
"""
s = s[:i] + NEW + s[j:]
# MID_GAP は platPair の手前で定義されている(ここより前)ので、そのまま使える
assert s.index('const MID_GAP') < s.index('const hsTry')
if crlf: s = s.replace('\n', '\r\n')
io.open(p, 'w', encoding='utf-8', newline='').write(s); print('ttcore ok')

p = 'src/core.js'
c = io.open(p, encoding='utf-8', newline='').read()
a = "'京急久里浜': { hsBox: [[15, 833, 30, 840]] }"
if a in c: c = c.replace(a, "'京急久里浜': { hsBox: [[15, 833, 30, 840]], mid: true }")
io.open(p, 'w', encoding='utf-8', newline='').write(c); print('core', 'mid: true' in c)
