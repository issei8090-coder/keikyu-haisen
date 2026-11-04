# 金沢文庫の検車区 その5: 昼の留置(朝〜昼に入庫した車両を、あとで出庫する列車に使う)
#  原因: 出庫はすべて「1日の始まりから車庫にいる」、入庫はすべて「1日の終わりまで車庫にいる」扱いだった。
#   夕方に出る車両(1302T 13:05 など)が朝から奥の線をふさぎ、朝〜昼に入庫する車両(730D 7:57 など)の入る場所が無かった。
#  - 入庫(着いた順)と出庫(出る順)を、同じ両数・30分以上あくものどうしで組にする(早く入った車両から使う)
#  - 組は同じ車庫の線・位置に入って出る(入って出るまでの間だけ線をふさぐ)。入庫の車両 → 出庫の車両 → 列車 とつながる
#  - 組にできなければ今までどおり別々に(1日の始まりから / 1日の終わりまで)
#  使い方: build フォルダで python tools/patch_kbyard5.py(前の版は _tmp/ttcore.before_kbyard5.js)
import io, os, shutil
def load(p): return io.open(p, encoding='utf-8', newline='').read()
def save(p, s): io.open(p, 'w', encoding='utf-8', newline='').write(s)
def rep(s, a, b, n=1):
    c = s.count(a); assert c == n, (c, a[:90]); return s.replace(a, b)

p = 'src/ttcore.js'
if not os.path.exists('_tmp/ttcore.before_kbyard5.js'): shutil.copy(p, '_tmp/ttcore.before_kbyard5.js')
s = load(p); NL = '\r\n' if '\r\n' in s else '\n'; s = s.replace('\r\n', '\n')

i0 = s.index("      const platYard = q => {\n")
i1 = s.index("      reqs.sort((x, y) => (y.out - x.out) || (x.out ? y.T - x.T : x.T - y.T));")
old = s[i0:i1]
assert old.count("const platYard") == 1 and old.rstrip().endswith("};"), old[-200:]

new = """      // 列車のホームでの動き方の候補: [車庫側の車両の頭がある線, その x, 線の上の位置, 進む向き]。向きを変える(頭 = 体の反対の端、向きは逆)/ 通り抜け(頭も向きも同じ)
      const platModes = q => {
        const o = q.out ? q.d : q.t, L = (o.cars || 8) * 1.5, r0 = o.route, g = q.out ? r0.segs[0] : r0.segs[r0.segs.length - 1];
        const pe = q.out ? r0.stopE[0] : r0.stopE[r0.stopE.length - 1]; if (g.e !== pe || isNaN(stopX[pe])) return null;
        const hx = q.out ? g.ax : g.bx, sgn = Math.sign(g.bx - g.ax); if (!sgn) return null;   // 頭の位置と進む向き(+1 = 右へ)
        const modes = [];
        { const D0 = q.out ? L : r0.total - L, sg = r0.segs.find(v => v.d0 <= D0 + 1e-6 && D0 <= v.d1 + 1e-6);
          if (sg && D0 >= 0 && D0 <= r0.total && !E[sg.e].portal) { const tq = sg.d1 > sg.d0 ? sg.t0 + (sg.t1 - sg.t0) * (D0 - sg.d0) / (sg.d1 - sg.d0) : sg.t0, pt = pointOn(sg.e, tq); modes.push([sg.e, pt.x, tq, 1 - sg.d]); } }
        modes.push([pe, hx, paramOf(pe, hx), g.d]);
        return { o, L, pe, modes };
      };
      // 1つの線・位置・動き方・時刻のずらしで動けるか。okX(x) = 車庫の線での出入りの時刻 x で線が空いているか(先に見る)
      //  返り値 { x, go }。出庫の go(mid): mid = { K: 昼に入庫した車両, x: 入った時刻 } なら、その車両が出ていく形にする
      //  入庫の go(xOut): xOut = あとで出庫する時刻(無ければ1日の終わりまで車庫に)
      const platTry = (q, c, k, slot, m, sh, okX) => {
        const { o, L, pe } = c, [ke, kx, tp, kDir] = m, tr = Y.tracks[k];
        let R = null;
        const key = (q.out ? 'po' : 'pi') + k + ':' + slot + ':' + ke + ':' + Math.round(tp * 1000) + ':' + kDir;
        if (rc.has(key)) R = rc.get(key); else {
          if (q.out) { const pm = new Map([[ke, kx]]); pm.name = st; const r = findRoute(Y.pos(tr.node, slotTrim(tr, slot, L)), [pm], null, null, false);
            if (!r.fail && r.segs.length && r.segs[r.segs.length - 1].e === ke && r.segs[r.segs.length - 1].d === kDir && Math.abs(r.segs[r.segs.length - 1].t1 - tp) < 0.02 && !r.revs.length && r.total > 5 && r.total <= 400) R = { segs: r.segs, total: r.total, stopD: [0, r.total], stopE: [r.segs[0].e, ke] }; }
          else { const r = findRoute({ e: ke, t: tp }, [], new Set([tr.node]), kDir, false);
            if (!r.fail && !r.revs.length && r.total <= 400) { const len = r.total - slotTrim(tr, slot, L); if (len > 5) { const segs = cutAt(r, len); R = { segs, total: len, stopD: [0, len], stopE: [ke, segs[segs.length - 1].e] }; } } }
          rc.set(key, R);
        }
        if (!R) return null;
        const mv = MV(R.total);
        if (q.out) {
          const d = o, dep0 = q.T, a1 = Math.min(d.A[0], dep0 - 120) + sh, x = a1 - mv;
          if (x < STAY0 + 60 || !okX(x) || !isFreeAt(pe, a1 - 10, dep0, d)) return null;
          const np = nodePass(R.segs, R.total, L, x_ => x + (a1 - x) * x_ / R.total, dep0);
          if (clash(np, d, { e: pe, a: a1, b: dep0 })) { stat.yardClash = (stat.yardClash || 0) + 1; return null; }
          return { x, go: mid => {
            const s0 = mid ? x : STAY0;
            const K = { no: d.no, type: 'kaiso', dest: st, cars: d.cars, fl: 0, x0: '', x1: '', tseg: null, tt: true, s: 0, g: null, k0: 0, yard: 'out', yardSt: st, yardTr: tr.label + slotName(tr, slot, L), yardPlat: true, yardMid: !!mid, stay: !mid, dh: true,
              names: [st], ev: [{ name: st, arr: Math.floor(s0 / 60), dep: Math.floor(x / 60) }], route: R, A: [s0, a1], P: [x, a1], start: s0, end: a1, prev: mid ? mid.K : null, next: d };
            if (mid) mid.K.next = K;
            d.prev = K; d.deadIn = 'yard'; d.A[0] = Math.min(d.A[0], a1); d.start = Math.min(d.start, a1);
            reserve(pe, a1 - 10, dep0, d); if (!mid) occ[k].push({ slot, a: STAY0, b: x, xs: [x] }); units.push(K); stat.yardOut = (stat.yardOut || 0) + 1; addIv(K); addIv(d); return K; } };
        }
        const t = o, ta = q.T, leave = ta + 120 + sh, x = leave + mv;
        if (!okX(x) || !isFreeAt(pe, ta, leave + 10, t)) return null;
        const np = nodePass(R.segs, R.total, L, x_ => leave + (x - leave) * x_ / R.total, x + 30);
        if (clash(np, t, { e: pe, a: ta, b: leave })) { stat.yardClash = (stat.yardClash || 0) + 1; return null; }
        return { x, go: xOut => {
          const b = xOut || STAY1;
          t.P[t.P.length - 1] = Math.max(t.P[t.P.length - 1], leave); t.end = Math.max(t.end, leave); t.deadOut = 'yard';
          const K = { no: t.no, type: 'kaiso', dest: st, cars: t.cars, fl: 0, x0: '', x1: '', tseg: null, tt: true, s: 0, g: null, k0: 0, yard: 'in', yardSt: st, yardTr: tr.label + slotName(tr, slot, L), yardPlat: true, yardMid: !!xOut, stay: !xOut, dh: true,
            names: [st], ev: [{ name: st, arr: Math.floor(x / 60), dep: Math.floor(b / 60) }], route: R, A: [leave, x], P: [leave, b], start: leave, end: b, prev: t, next: null };
          t.next = K; reserve(pe, ta, leave + 10, t); occ[k].push({ slot, a: x, b, xs: xOut ? [x, xOut] : [x] }); units.push(K); stat.yardIn = (stat.yardIn || 0) + 1; addIv(K); addIv(t); return K; } };
      };
      const platYard = q => { const c = platModes(q); if (!c) return false;   // 1本だけ(1日の始まりから / 1日の終わりまで車庫に)
        for (const m of c.modes) for (const sh of q.out ? P_OUT : P_IN) for (const k of order()) for (let slot = 0; slot < cap(Y.tracks[k], c.L); slot++) {
          const v = platTry(q, c, k, slot, m, sh, q.out ? x => fits(k, slot, STAY0, x, [x]) : x => fits(k, slot, x, STAY1, [x]));
          if (v) { v.go(null); return true; } }
        return false; };
      const MID_GAP = 600;   // 昼の留置: 車庫の線に入ってから出るまで最低10分
      const platPair = (qi, qo) => { const ci = platModes(qi), co = platModes(qo); if (!ci || !co) return false;   // 昼の留置: 入庫した車両がそのまま同じ線から出庫
        for (const k of order()) for (let slot = 0; slot < Math.min(cap(Y.tracks[k], ci.L), cap(Y.tracks[k], co.L)); slot++) {
          const vi = [];
          for (const m of ci.modes) { for (const sh of P_IN) { const v = platTry(qi, ci, k, slot, m, sh, x => fits(k, slot, x, x + MID_GAP, [x])); if (v) { vi.push(v); break; } } }
          if (!vi.length) continue;
          const ok = (a, x) => x >= a.x + MID_GAP && fits(k, slot, a.x, x, [a.x, x]);
          for (const m of co.modes) for (const sh of P_OUT) {
            const v = platTry(qo, co, k, slot, m, sh, x => vi.some(a => ok(a, x))); if (!v) continue;
            const a = vi.find(a => ok(a, v.x)), K = a.go(v.x); v.go({ K, x: a.x }); return true; }
        }
        return false; };
"""
s = s[:i0] + new + s[i1:]

a = """      for (const q of reqs) {
        if (Y.plat) { platYard(q); if (!(q.out ? q.d.prev : q.t.next)) stat.yardMiss = (stat.yardMiss || 0) + 1; continue; }
"""
b = """      if (Y.plat) {
        // 昼の留置の組: 出庫を出る順に、同じ両数で30分以上前に着いた入庫のうち早く着いたものと組にする
        const ins = reqs.filter(q => !q.out).sort((x, y) => x.T - y.T), outs = reqs.filter(q => q.out).sort((x, y) => x.T - y.T), pairs = [];
        for (const qo of outs) { const qi = ins.find(q => !q.pair && (q.t.cars || 8) === (qo.d.cars || 8) && q.T + 1800 <= qo.T); if (qi) { qi.pair = qo.pair = true; pairs.push([qi, qo]); } }
        const miss = q => { if (!platYard(q)) stat.yardMiss = (stat.yardMiss || 0) + 1; }, back = [];
        for (const q of reqs) if (q.out && !q.pair) miss(q);
        for (const [qi, qo] of pairs) { if (platPair(qi, qo)) stat.yardMid = (stat.yardMid || 0) + 1; else { qi.pair = qo.pair = false; back.push(qi, qo); } }
        for (const q of back) if (q.out) miss(q);
        for (const q of reqs) if (!q.out && !q.pair) miss(q);
        continue;
      }
      for (const q of reqs) {
"""
s = rep(s, a, b)
save(p, s.replace('\n', NL)); print('ttcore ok')

# ---- tt.js: 列車の詳細(昼の留置)
p = 'src/tt.js'; s = load(p); NL = '\r\n' if '\r\n' in s else '\n'; s = s.replace('\r\n', '\n')
a = "    $('ttno').textContent = t.yard === 'out' ? `1日の始まりから留置 → ${hm2(t.P[0])} 出庫` : `${hm2(t.A[1])} 入庫 → 1日の終わりまで留置`;"
b = "    $('ttno').textContent = t.yard === 'out' ? `${t.yardMid ? hm2(t.A[0]) + ' 昼の留置から' : '1日の始まりから留置'} → ${hm2(t.P[0])} 出庫` : `${hm2(t.A[1])} 入庫 → ${t.yardMid ? hm2(t.P[1]) + ' まで昼の留置' : '1日の終わりまで留置'}`;"
s = rep(s, a, b)
save(p, s.replace('\n', NL)); print('tt ok')
