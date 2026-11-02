# 成田空港の回送: 時刻と番線を、縦列の線・単線区間の空きを秒単位で見ながら決める形に置き換える。何度実行してもよい
import io, re
p = 'src/ttcore.js'; s = io.open(p, encoding='utf-8').read()
a = s.index("  // ===== 成田空港の回送(送り込み・引き上げ) =====")
b = s.index("  let n = 0;", a)
new = r"""  // ===== 成田空港の回送(送り込み・引き上げ) =====
  // 成田空港には車庫が無い。前の運用の無い始発列車は宗吾参道(宗吾車両基地)から回送で入り、次の運用の無い終着列車は宗吾参道へ回送で出ていく。
  // 回送の時刻は時刻表に無いので推定。ホームの使い方(成田空港にいる1回分 = v)を全部並べて、ぶつからない時刻と線を選ぶ:
  //  ・島式ホームの2本の線は、上野寄り(本線 M)と車止め側(スカイライナー L)の縦列。L へ出入りする瞬間は、同じ線の M が空いていること
  //  ・空港第2ビル〜成田空港は単線。向かい合う列車と同時に入らない
  if (!list.dhDone && stByName.has(DH_ST) && stByName.has(NRT) && nrtEdges()) { list.dhDone = true;
    const g = nrtEdges(), yOf = e => N[E[e].a].y, srt = l => l.slice().sort((x, y) => yOf(x) - yOf(y)), EM = srt(g.main), EL = srt(g.liner);
    const S = { d: [], u: [] };   // 単線にいる時間(秒)。d = 成田空港へ向かう、u = 成田空港から出る
    for (const t of list) { const q1 = t.names.indexOf(NRT), q2 = t.names.indexOf(NRT2); if (q1 < 0 || q2 < 0 || Math.abs(q1 - q2) !== 1) continue;
      if (q2 < q1) S.d.push([t.P[q2 + t.k0], t.A[q1 + t.k0], t.A[q2 + t.k0]]); else S.u.push([t.P[q1 + t.k0], t.A[q2 + t.k0], t.P[q2 + t.k0]]); }   // 3つ目 = 空港第2ビルに着く時刻(下り)・出る時刻(上り)
    const aSec = t => t.A[t.A.length - 1], dSec = t => t.P[t.k0];
    // 宗吾参道〜京成成田〜空港第2ビル を同じ向きに走る列車。回送は、これらを途中で追い抜いたり、止まっている横を通り抜けたりしない時刻にする
    const PTS = [DH_ST, '京成成田', NRT2, NRT], prof = { d: [], u: [] };
    for (const t of list) { const pts = []; t.names.forEach((nm, i) => { const q = PTS.indexOf(nm); if (q >= 0) pts.push([q, t.A[i + t.k0], t.P[i + t.k0]]); }); if (pts.length < 2) continue; (pts[1][0] > pts[0][0] ? prof.d : prof.u).push(pts); }
    const ordPen = (l, my) => { for (const pts of l) { let ps = 0; for (const [q, A, P] of pts) { const m = my[q]; if (m == null) continue; if ((q === 1 || q === 2) && m > A - 30 && m < P + 40) return 6; const sg = Math.sign(m - (q === 3 ? (l === prof.u ? P : A) : (A + P) / 2)); if (ps && sg !== ps) return 6; ps = sg; } } return 0; };
    const placed = [];   // { cat, k, ta, td }  k = 線(0・1)。アクセス特急の線は1本なので k = 0
    const pen = (v, sIn, sOut, self) => { let n = 0;
      for (const o of placed) { if (o === self || (o.k !== v.k && !(v.cat === 'access' && o.cat === 'access'))) continue;
        if (o.cat === v.cat) { if (o.ta < v.td + 25 && v.ta - 25 < o.td) n += 8; continue; }
        if (v.cat === 'access' || o.cat === 'access') continue;
        const L = v.cat === 'liner' ? v : o, M = v.cat === 'liner' ? o : v;   // 奥の列車が出入りする瞬間に、手前に列車がいる
        if (M.ta < L.ta + 35 && L.ta - 35 < M.td) n += 5; if (M.ta < L.td + 100 && L.td - 35 < M.td) n += 5; }   // 奥から出る列車は動き出しが遅いので、手前に次が着くまで100秒あける
      if (sIn) { if (S.u.some(x => x !== self.sOut && x[0] < sIn[1] + 15 && sIn[0] - 15 < x[1])) n += 10; if (S.d.some(x => x !== self.sIn && Math.abs(x[1] - sIn[1]) < 55)) n += 3;
        if (S.d.some(x => x !== self.sIn && x[2] != null && sIn[0] > x[2] - 25 && sIn[0] < x[0] + 40)) n += 10; }   // 空港第2ビルに止まっている列車を、止まらない回送が追い抜かない
      if (sOut) { if (S.d.some(x => x !== self.sIn && x[0] < sOut[1] + 15 && sOut[0] - 15 < x[1])) n += 10; if (S.u.some(x => x !== self.sOut && Math.abs(x[0] - sOut[0]) < 55)) n += 3;
        if (S.u.some(x => x !== self.sOut && x[2] != null && sOut[1] > x[1] - 25 && sOut[1] < x[2] + 40)) n += 10; }
      return n; };
    const ks = cat => cat === 'access' ? [0] : [0, 1];
    const edgeOf = v => v.cat === 'access' ? null : (v.cat === 'liner' ? EL : EM)[v.k];
    const as = (arr.get(NRT) || []).slice().sort((x, y) => aSec(x) - aSec(y)), ds = (dep.get(NRT) || []).slice().sort((x, y) => dSec(x) - dSec(y));
    const mk = (base, ev, cat) => { const t = { no: base.no, type: 'kaiso', dest: ev[ev.length - 1].name, cars: base.cars, fl: 0, x0: '', x1: '', tseg: null, ev, tt: true, s: 0, g: null, route: undefined, prev: null, next: null, k0: 0, dh: true, dhCat: cat, ops: base.ops ? { id: base.ops.id, auth: false } : undefined };
      list.push(t); return t; };
    const evIn = ta => [{ name: DH_ST, arr: ta - DH_RUN[0], dep: ta - DH_RUN[0] }, { name: '京成成田', arr: ta - DH_RUN[1], dep: ta - DH_RUN[1], thru: true }, { name: NRT2, arr: ta - DH_RUN[2], dep: ta - DH_RUN[2], thru: true }, { name: NRT, arr: ta, dep: ta }];
    const evOut = td => [{ name: NRT, arr: td, dep: td }, { name: NRT2, arr: td + DH_RUN[2], dep: td + DH_RUN[2], thru: true }, { name: '京成成田', arr: td + DH_RUN[1], dep: td + DH_RUN[1], thru: true }, { name: DH_ST, arr: td + DH_RUN[0], dep: td + DH_RUN[0] }];
    // j.kind: 'fix' = 折り返しが決まっている(線だけ選ぶ)  'in' = 回送で入ってくる(着く時刻も選ぶ)  'out' = 回送で出ていく(出る時刻も選ぶ)
    const jobs = [...as.filter(a => a.next).map(a => ({ kind: 'fix', a, cat: nrtCat(a), t: aSec(a) })), ...as.filter(a => !a.next).map(a => ({ kind: 'out', a, cat: nrtCat(a), t: aSec(a) })), ...ds.filter(d => !d.prev).map(d => ({ kind: 'in', d, cat: nrtCat(d), t: dSec(d) }))].sort((x, y) => x.t - y.t);
    const choose = j => { let best = null; const v0 = j.v || {}, cat = j.cat;
      if (j.kind === 'fix') { for (const k of ks(cat)) { const v = { cat, k, ta: aSec(j.a), td: dSec(j.a.next) }, n = pen(v, null, null, v0); if (!best || n < best.n) best = { n, v }; } }
      else if (j.kind === 'in') { const D = tDep(j.d);
        for (const L of [5, 4, 6, 3, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 20]) { const A = (D - L) * 60 + 30, sIn = [A - 125, A];
          const op = ordPen(prof.d, [(D - L - DH_RUN[0]) * 60 + 5, (D - L - DH_RUN[1]) * 60 + 10, (D - L - DH_RUN[2]) * 60 + 10, A]);
          for (const k of ks(cat)) { const v = { cat, k, ta: A, td: dSec(j.d), sIn, m: D - L, op }, n = pen(v, sIn, null, v0) + op; if (!best || n < best.n) best = { n, v }; }
          if (best.n === 0) break; } }
      else { const T0 = tArr(j.a);
        for (const w of [3, 4, 2, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 20]) { const P = (T0 + w) * 60 + 5, sOut = [P, P + 125];
          const op = ordPen(prof.u, [(T0 + w + DH_RUN[0]) * 60 + 30, (T0 + w + DH_RUN[1]) * 60 + 10, (T0 + w + DH_RUN[2]) * 60 + 10, P]);
          // アクセス特急で着いて運用が終わる列車は、1番線がふさがっていればスカイライナーのホーム(車止め側)に入る
          for (const c of cat === 'access' ? ['access', 'liner'] : [cat]) for (const k of ks(c)) { const v = { cat: c, k, ta: aSec(j.a), td: P, sOut, m: T0 + w, op }, n = pen(v, null, sOut, v0) + op + (c !== cat ? 1 : 0); if (!best || n < best.n) best = { n, v }; }
          if (best.n === 0) break; } }
      return best; };
    const apply = (j, best) => { const o = j.v, v = best.v;
      if (o) { placed.splice(placed.indexOf(o), 1); if (o.sIn) S.d.splice(S.d.indexOf(o.sIn), 1); if (o.sOut) S.u.splice(S.u.indexOf(o.sOut), 1); }
      placed.push(v); if (v.sIn) S.d.push(v.sIn); if (v.sOut) S.u.push(v.sOut); j.v = v; j.n = best.n; };
    for (const j of jobs) apply(j, choose(j));
    // いったん全部置いてから、ぶつかっているものを中心に選び直す(あとから置いた列車のことも見て決め直す)
    for (let round = 0; round < 4; round++) { let ch = 0;
      for (const j of jobs) { const cur = pen(j.v, j.v.sIn, j.v.sOut, j.v) + (j.v.op || 0); if (!cur) continue; const b = choose(j); if (b.n < cur) { apply(j, b); ch++; } }
      if (!ch) break; }
    // どう選んでもぶつかる回送は走らせない(その列車は今までどおり、発車の直前にホームに現れる・着いてすぐ消える)。
    // 外したぶん空きができるので、残りをもう一度選び直す
    const stat = { n: 0, skip: 0 };
    for (let round = 0; round < 6; round++) { let ch = 0;
      for (const j of jobs) { const v = j.v; if (j.kind === 'fix') { const cur = pen(v, null, null, v); if (cur) { const b = choose(j); if (b.n < cur) { apply(j, b); ch++; } } continue; }
        if (j.skip) { if (v.cat !== 'access' && pen(v, null, null, v)) { const w = Object.assign({}, v, { k: 1 - v.k }); if (pen(w, null, null, v) < pen(v, null, null, v)) { v.k = w.k; ch++; } } continue; }
        if (!(pen(v, v.sIn, v.sOut, v) + (v.op || 0))) continue;
        const b = choose(j); if (b.n < 2) { apply(j, b); ch++; continue; }
        j.skip = true; ch++; if (v.sIn) { S.d.splice(S.d.indexOf(v.sIn), 1); v.sIn = null; v.ta = v.td - 30; } if (v.sOut) { S.u.splice(S.u.indexOf(v.sOut), 1); v.sOut = null; v.td = v.ta + 30; } }
      if (!ch) break; }
    // それでも残ったもの: 近い時刻の列車と2本まとめて線を入れ替えてみる(1本ずつでは良くならない組み合わせ)
    const pOf = j => pen(j.v, j.v.sIn, j.v.sOut, j.v);
    for (const j of jobs) { if (j.v.cat === 'access' || !pOf(j)) continue;
      const win = jobs.filter(o => o.v.cat !== 'access' && o.v.ta < j.v.td + 2400 && j.v.ta - 2400 < o.v.td), tot = () => win.reduce((m, o) => m + pOf(o), 0);
      let best = tot(), bo = null, bj = false;
      for (const o of win) for (const fj of [false, true]) { if (o === j && !fj) continue; if (o !== j) o.v.k = 1 - o.v.k; if (fj) j.v.k = 1 - j.v.k; const x = tot(); if (x < best) { best = x; bo = o; bj = fj; } if (o !== j) o.v.k = 1 - o.v.k; if (fj) j.v.k = 1 - j.v.k; }
      if (bo) { if (bo !== j) bo.v.k = 1 - bo.v.k; if (bj) j.v.k = 1 - j.v.k; } }
    for (const j of jobs) { const v = j.v, e = edgeOf(v);
      if (j.kind === 'fix') { if (e != null) j.a.forceEnd = e; continue; }
      if (j.kind === 'out' && v.cat !== j.cat) j.a.dhCat = v.cat;   // 着く列車そのものも、そのホームへ入る
      if (j.skip) { stat.skip++; if (j.kind === 'out' && e != null) j.a.forceEnd = e; continue; }
      stat.n++;
      if (j.kind === 'in') { const dh = mk(j.d, evIn(v.m), j.cat); ttSchedule(dh); dh.next = j.d; j.d.prev = dh; if (e != null) dh.forceEnd = e; }
      else { const dh = mk(j.a, evOut(v.m), v.cat); ttSchedule(dh); j.a.next = dh; dh.prev = j.a; if (e != null) j.a.forceEnd = e; } }
    list.dhStat = stat; list.dhJobs = jobs.map(j => ({ kind: j.kind, no: (j.a || j.d).no, cat: j.cat, k: j.v.k, m: j.v.m, skip: !!j.skip, pen: pen(j.v, j.v.sIn, j.v.sOut, j.v), op: j.v.op || 0, ta: j.v.ta, td: j.v.td }));
  }
"""
s = s[:a] + new + s[b:]
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('patched')
