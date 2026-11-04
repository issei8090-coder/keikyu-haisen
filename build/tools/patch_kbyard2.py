# 金沢文庫の検車区 その2: 「ホームで向きを変える」検車区(YARD_CFG.plat)と、1線に3本以上並べる
#  core.js:  YARD_ST に金沢文庫、YARD_CFG = { 金沢文庫: { box, plat } }。plat の駅は box の中の行き止まりだけを車庫の線にする(引上線は使わない)
#  ttcore.js yard():
#   - 出庫(plat): 車庫の線 → (向きはそのまま)ホームに入る。始発列車 d の体と同じ場所(頭が逆の端)で止まり、d として向きを変えて出る
#   - 入庫(plat): 終着列車 t がホームで向きを変え、そのまま車庫の線へ
#   - 1線の本数: plat の駅は長さに応じて最大4本(奥から 2, 23, 44, 65 の位置。12両=18 でも重ならない間隔 21)
#   - fits(): 奥の車両が出入りする時刻に手前に車両がいたらだめ、を何本でも見る(2本のときは今までと同じ)
import io
def load(p): return io.open(p, encoding='utf-8', newline='').read()
def save(p, s): io.open(p, 'w', encoding='utf-8', newline='').write(s)
def rep(s, a, b, n=1):
    c = s.count(a); assert c == n, (c, a[:90]); return s.replace(a, b)

# ---- core.js
p = 'src/core.js'; s = load(p); NL = '\r\n' if '\r\n' in s else '\n'; s = s.replace('\r\n', '\n')
s = rep(s, "const YARD_ST = new Set(['西馬込', '神奈川新町']);",
"const YARD_ST = new Set(['西馬込', '神奈川新町', '金沢文庫']);\n"
"// plat: 引上線を使わず、ホームで向きを変えて車庫の線と行き来する駅。box = 車庫の線の行き止まりがある範囲 [x0, y0, x1, y1]\n"
"const YARD_CFG = { '金沢文庫': { box: [545, 450, 705, 516], plat: true } };")
a = "    const hs = [], rest = [];\n"
b = """    const hs = [], rest = [], yc = YARD_CFG[name];
    if (yc && yc.plat) {   // ホームで向きを変える検車区: 範囲の中の行き止まりが車庫の線
      const [x0, y0, x1, y1] = yc.box, tracks = [];
      for (const n of dead) { const q = N[n]; if (q.x < x0 || q.x > x1 || q.y < y0 || q.y > y1 || E[adj[n][0]].len < 12) continue; tracks.push({ node: n, e: adj[n][0], len: E[adj[n][0]].len, via: [], y: q.y }); }
      tracks.sort((a, b) => b.y - a.y || a.node - b.node); tracks.forEach((t, i) => { t.i = i; t.label = '車庫' + (i + 1) + '番'; });
      Y = tracks.length ? { name, hs: [], tracks, pos, plat: true, pm } : null;
      YARDS.set(name, Y); return Y;
    }
"""
s = rep(s, a, b)
save(p, s.replace('\n', NL)); print('core ok')

# ---- ttcore.js
p = 'src/ttcore.js'; s = load(p); NL = '\r\n' if '\r\n' in s else '\n'; s = s.replace('\r\n', '\n')
s = rep(s, "      const slotTrim = (tr, slot, L) => slot ? 2 + L + 3 : 2;\n      const cap = (tr, L) => tr.len >= 2 * L + 10 ? 2 : 1;\n",
"""      const slotTrim = (tr, slot, L) => Y.plat ? 2 + slot * 21 : slot ? 2 + L + 3 : 2;
      const cap = (tr, L) => Y.plat ? Math.max(1, Math.min(4, Math.floor((tr.len - 23) / 21) + 1)) : tr.len >= 2 * L + 10 ? 2 : 1;
      const slotName = (tr, slot, L) => { const c = cap(tr, L); return c <= 1 ? '' : c === 2 ? (slot ? '(手前)' : '(奥)') : '(奥から' + (slot + 1) + '本目)'; };
""")
s = rep(s, "      const fits = (k, slot, a, b, xs) => { for (const o of occ[k]) { if (o.slot === slot && o.a < b + 30 && a < o.b + 30) return false; if (slot === 0 && o.slot === 1 && xs.some(x => o.a < x + PAD && x - PAD < o.b)) return false; if (slot === 1 && o.slot === 0 && o.xs.some(x => a < x + PAD && x - PAD < b)) return false; } return true; };",
"      const fits = (k, slot, a, b, xs) => { for (const o of occ[k]) { if (o.slot === slot && o.a < b + 30 && a < o.b + 30) return false; if (o.slot > slot && xs.some(x => o.a < x + PAD && x - PAD < o.b)) return false; if (o.slot < slot && o.xs.some(x => a < x + PAD && x - PAD < b)) return false; } return true; };   // 奥の車両の出入りの時刻に手前に車両がいてはだめ")
# 引上線の数え上げは plat では行わない
s = rep(s, "        for (const q of reqs) { q.hs = Y.hs.filter(h => can(q, h)); q.hs.forEach(h => need.set(h, need.get(h) + 1)); }",
           "        for (const q of reqs) { q.hs = Y.plat ? [] : Y.hs.filter(h => can(q, h)); q.hs.forEach(h => need.set(h, need.get(h) + 1)); }")
# 表示名
s = rep(s, "yardTr: tr.label + (cap(tr, L) > 1 ? (slot ? '(手前)' : '(奥)') : '')", "yardTr: tr.label + slotName(tr, slot, L)", 2)
# plat の出庫・入庫
a = "        if (q.out) {   // 出庫: 車庫の線 → 引上線(折り返し) → ホーム\n"
b = r"""        if (Y.plat) { platYard(q); if (!(q.out ? q.d.prev : q.t.next)) stat.yardMiss = (stat.yardMiss || 0) + 1; continue; }
        if (q.out) {   // 出庫: 車庫の線 → 引上線(折り返し) → ホーム
"""
s = rep(s, a, b)
a = "      reqs.sort((x, y) => (y.out - x.out) || (x.out ? y.T - x.T : x.T - y.T));   // 出庫を先に"
b = r"""      // ホームで向きを変える検車区(Y.plat): 車庫の線 ⇄ ホーム。ホームでは列車の体と同じ場所に、頭を逆の端にして止まる
      const P_OUT = [0, -30, -60, -90, -120, -180, -240, -300, -420, -600], P_IN = [0, 30, 60, 90, 120, 180, 240, 300, 420, 600];
      const platYard = q => {
        const o = q.out ? q.d : q.t, L = (o.cars || 8) * 1.5, r0 = o.route, g = q.out ? r0.segs[0] : r0.segs[r0.segs.length - 1];
        const pe = q.out ? r0.stopE[0] : r0.stopE[r0.stopE.length - 1]; if (g.e !== pe || isNaN(stopX[pe])) return;
        const hx = q.out ? g.ax : g.bx, sgn = Math.sign(g.bx - g.ax); if (!sgn) return;   // 頭の位置と進む向き(+1 = 右へ)
        const tailX = hx - sgn * L, tp = paramOf(pe, tailX); if (!(tp >= 0 && tp <= 1)) return;   // 体の反対の端(ここが車庫側の車両の頭になる)
        const kDir = 1 - g.d;   // 車庫側の車両の進む向きは列車と逆
        for (const sh of q.out ? P_OUT : P_IN) { for (const k of order()) { const tr = Y.tracks[k];
          for (let slot = 0; slot < cap(tr, L); slot++) {
            let R = null;
            const key = (q.out ? 'po' : 'pi') + k + ':' + slot + ':' + pe + ':' + Math.round(tailX * 10);
            if (rc.has(key)) R = rc.get(key); else {
              if (q.out) { const pm = new Map([[pe, tailX]]); pm.name = st; const r = findRoute(Y.pos(tr.node, slotTrim(tr, slot, L)), [pm], null, null, false);
                if (!r.fail && r.segs.length && r.segs[r.segs.length - 1].e === pe && r.segs[r.segs.length - 1].d === kDir && !r.revs.length && r.total > 5) R = { segs: r.segs, total: r.total, stopD: [0, r.total], stopE: [r.segs[0].e, pe] }; }
              else { const r = findRoute({ e: pe, t: tp }, [], new Set([tr.node]), kDir, false);
                if (!r.fail && !r.revs.length) { const len = r.total - slotTrim(tr, slot, L); if (len > 5) { const segs = cutAt(r, len); R = { segs, total: len, stopD: [0, len], stopE: [pe, segs[segs.length - 1].e] }; } } }
              rc.set(key, R);
            }
            if (!R) continue;
            const mv = MV(R.total);
            if (q.out) {
              const d = o, dep0 = q.T, a1 = Math.min(d.A[0], dep0 - 120) + sh, x = a1 - mv;
              if (x < STAY0 + 60 || !fits(k, slot, STAY0, x, [x]) || !isFreeAt(pe, a1 - 10, dep0, d)) continue;
              const np = nodePass(R.segs, R.total, L, x_ => x + (a1 - x) * x_ / R.total, dep0);
              if (clash(np, d, { e: pe, a: a1, b: dep0 })) { stat.yardClash = (stat.yardClash || 0) + 1; continue; }
              const K = { no: d.no, type: 'kaiso', dest: st, cars: d.cars, fl: 0, x0: '', x1: '', tseg: null, tt: true, s: 0, g: null, k0: 0, yard: 'out', yardSt: st, yardTr: tr.label + slotName(tr, slot, L), yardPlat: true, stay: true, dh: true,
                names: [st], ev: [{ name: st, arr: Math.floor(STAY0 / 60), dep: Math.floor(x / 60) }], route: R, A: [STAY0, a1], P: [x, a1], start: STAY0, end: a1, prev: null, next: d };
              d.prev = K; d.deadIn = 'yard'; d.A[0] = Math.min(d.A[0], a1); d.start = Math.min(d.start, a1);
              reserve(pe, a1 - 10, dep0, d); occ[k].push({ slot, a: STAY0, b: x, xs: [x] }); units.push(K); stat.yardOut = (stat.yardOut || 0) + 1; addIv(K); addIv(d); return;
            } else {
              const t = o, ta = q.T, leave = ta + 120 + sh, x = leave + mv;
              if (!fits(k, slot, x, STAY1, [x]) || !isFreeAt(pe, ta, leave + 10, t)) continue;
              const np = nodePass(R.segs, R.total, L, x_ => leave + (x - leave) * x_ / R.total, x + 30);
              if (clash(np, t, { e: pe, a: ta, b: leave })) { stat.yardClash = (stat.yardClash || 0) + 1; continue; }
              t.P[t.P.length - 1] = Math.max(t.P[t.P.length - 1], leave); t.end = Math.max(t.end, leave); t.deadOut = 'yard';
              const K = { no: t.no, type: 'kaiso', dest: st, cars: t.cars, fl: 0, x0: '', x1: '', tseg: null, tt: true, s: 0, g: null, k0: 0, yard: 'in', yardSt: st, yardTr: tr.label + slotName(tr, slot, L), yardPlat: true, stay: true, dh: true,
                names: [st], ev: [{ name: st, arr: Math.floor(x / 60), dep: Math.floor(STAY1 / 60) }], route: R, A: [leave, x], P: [leave, STAY1], start: leave, end: STAY1, prev: t, next: null };
              t.next = K; reserve(pe, ta, leave + 10, t); occ[k].push({ slot, a: x, b: STAY1, xs: [x] }); units.push(K); stat.yardIn = (stat.yardIn || 0) + 1; addIv(K); addIv(t); return;
            }
          } } }
      };
"""
s = rep(s, a, b + a)
save(p, s.replace('\n', NL)); print('ttcore ok')
