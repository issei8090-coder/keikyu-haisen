# 成田空港の回送(送り込み・引き上げ)を入れる。1回だけ実行するパッチ
#  前の運用の無い成田空港始発 → 宗吾参道から回送で入ってくる   次の運用の無い成田空港止まり → 宗吾参道へ回送で出ていく
import io
p = 'src/ttcore.js'; s = io.open(p, encoding='utf-8').read()
def rep(a, b):
    global s
    assert s.count(a) == 1, a[:70]
    s = s.replace(a, b)

rep("const nrtCat = t => t.type === 'liner' ? 'liner' : ksVia(t);",
    "const nrtCat = t => t.dhCat || (t.type === 'liner' ? 'liner' : ksVia(t));   // 回送(dhCat)は、つながる営業列車と同じホームを使う")

# 番線の割り当てを関数にして、回送を足したあとでやり直せるようにする
rep("""      const g = nrtEdges(), yOf = e => N[E[e].a].y, trk = [0, 1].map(k => ({ main: g.main.slice().sort((a, b) => yOf(a) - yOf(b))[k], liner: g.liner.slice().sort((a, b) => yOf(a) - yOf(b))[k], m: [], l: [] }));
      const hit = (l, a, b) => l.some(([x, y]) => x < b && a < y);
      for (const a of as) {""",
"""      nrtAssign(as);
    } else if (DEPOT_ST.has(st)) general(st, as, ds);   // 車庫のある終着駅: 長く止まる車両は車庫の線へ入れる
    else if (st === '京成上野') {   // 1・4番線(外側)=普通、2番線=スカイライナー、3番線=特急・快速特急。ふさがっていれば他の番線
      const es = [...new Set(stByName.get(st).stops.map(([e]) => e))].sort((a, b) => N[E[a].a].y - N[E[b].a].y);
      const ty = a => { const y = a.tseg ? a.tseg[a.tseg.length - 1][1] : a.type; return y; };
      terminus(as, ds, es, st, es.length === 4 ? a => { const y = ty(a); return y === 'liner' ? [es[1], es[2]] : y === 'local' ? [es[0], es[3]] : [es[2], es[1], es[3], es[0]]; } : null, 1);
    } else if (TERMINI.has(st)) terminus(as, ds, stByName.get(st).stops.map(([e]) => e), st);
    else if (st === '京急川崎') {   // 大師線ホーム(地平)は行き止まり、本線は途中駅として扱う
      const isD = t => t.names.some(n => DAISHI.has(n));
      terminus(as.filter(isD), ds.filter(isD), stByName.get(st).stops.map(([e]) => e).filter(e => N[E[e].a].y < 180), st);
      general(st, as.filter(t => !isD(t)), ds.filter(t => !isD(t)));
    } else general(st, as, ds);
  }
  function nrtAssign(as) {
    {
      const g = nrtEdges(), yOf = e => N[E[e].a].y, trk = [0, 1].map(k => ({ main: g.main.slice().sort((a, b) => yOf(a) - yOf(b))[k], liner: g.liner.slice().sort((a, b) => yOf(a) - yOf(b))[k], m: [], l: [] }));
      const hit = (l, a, b) => l.some(([x, y]) => x < b && a < y);
      for (const a of as) {""")
rep("""        (c === 'liner' ? best.k.l : best.k.m).push([ta, td]); a.forceEnd = c === 'liner' ? best.k.liner : best.k.main;
      }
    } else if (DEPOT_ST.has(st)) general(st, as, ds);   // 車庫のある終着駅: 長く止まる車両は車庫の線へ入れる
    else if (st === '京成上野') {   // 1・4番線(外側)=普通、2番線=スカイライナー、3番線=特急・快速特急。ふさがっていれば他の番線
      const es = [...new Set(stByName.get(st).stops.map(([e]) => e))].sort((a, b) => N[E[a].a].y - N[E[b].a].y);
      const ty = a => { const y = a.tseg ? a.tseg[a.tseg.length - 1][1] : a.type; return y; };
      terminus(as, ds, es, st, es.length === 4 ? a => { const y = ty(a); return y === 'liner' ? [es[1], es[2]] : y === 'local' ? [es[0], es[3]] : [es[2], es[1], es[3], es[0]]; } : null, 1);
    } else if (TERMINI.has(st)) terminus(as, ds, stByName.get(st).stops.map(([e]) => e), st);
    else if (st === '京急川崎') {   // 大師線ホーム(地平)は行き止まり、本線は途中駅として扱う
      const isD = t => t.names.some(n => DAISHI.has(n));
      terminus(as.filter(isD), ds.filter(isD), stByName.get(st).stops.map(([e]) => e).filter(e => N[E[e].a].y < 180), st);
      general(st, as.filter(t => !isD(t)), ds.filter(t => !isD(t)));
    } else general(st, as, ds);
  }
  let n = 0;""",
"""        (c === 'liner' ? best.k.l : best.k.m).push([ta, td]); a.forceEnd = c === 'liner' ? best.k.liner : best.k.main;
      }
    }
  }
  // ===== 成田空港の回送(送り込み・引き上げ) =====
  // 成田空港には車庫が無い。前の運用の無い始発列車は宗吾参道(宗吾車両基地)から回送で入り、次の運用の無い終着列車は宗吾参道へ回送で出ていく。
  // 回送の時刻は時刻表に無いので推定: 発車の6分前ごろに着く・到着の4分後ごろに出る。空港第2ビル〜成田空港の単線で向かい合う列車と重ならない分を選ぶ
  if (!list.dhDone && stByName.has(DH_ST) && stByName.has(NRT) && nrtEdges()) { list.dhDone = true;
    const busy = { d: [], u: [] };   // 単線にいる時間(秒)。d = 成田空港へ向かう、u = 成田空港から出る
    for (const t of list) { const q1 = t.names.indexOf(NRT), q2 = t.names.indexOf(NRT2); if (q1 < 0 || q2 < 0 || Math.abs(q1 - q2) !== 1) continue;
      if (q2 < q1) busy.d.push([t.P[q2 + t.k0], t.A[q1 + t.k0]]); else busy.u.push([t.P[q1 + t.k0], t.A[q2 + t.k0]]); }
    const hitS = (l, a, b) => l.some(([x, y]) => x < b && a < y);
    const cap = { liner: 2, main: 2, access: 1 }, stay = { liner: [], main: [], access: [] };   // ホームにいる時間(分)
    for (const a of arr.get(NRT) || []) stay[nrtCat(a)].push([tArr(a), a.next ? tDep(a.next) : tArr(a) + 1]);
    for (const d of dep.get(NRT) || []) if (!d.prev) stay[nrtCat(d)].push([tDep(d) - 1, tDep(d)]);
    const mk = (base, ev, cat) => { const t = { no: base.no, type: 'kaiso', dest: ev[ev.length - 1].name, cars: base.cars, fl: 0, x0: '', x1: '', tseg: null, ev, tt: true, s: 0, g: null, route: undefined, prev: null, next: null, k0: 0, dh: true, dhCat: cat, ops: base.ops ? { id: base.ops.id, auth: false } : undefined };
      ttSchedule(t); list.push(t); return t; };
    const ins = [];
    for (const d of (dep.get(NRT) || []).slice().sort((a, b) => tDep(a) - tDep(b))) { if (d.prev || d.dh) continue;
      const D = tDep(d), cat = nrtCat(d); let pick = null;
      for (const L of [6, 5, 7, 8, 4, 9, 10, 11, 12, 3]) { const ta = D - L, A = ta * 60 + 30;
        if (hitS(busy.u, A - 190, A + 10) || busy.d.some(([x, y]) => Math.abs(y - A) < 50)) continue;
        const full = stay[cat].filter(([x, y]) => x <= D && ta <= y).length >= cap[cat];
        if (!full) { pick = L; break; } if (pick == null) pick = L; }
      const ta = D - (pick == null ? 6 : pick), dh = mk(d, [{ name: DH_ST, arr: ta - DH_RUN[0], dep: ta - DH_RUN[0] }, { name: '京成成田', arr: ta - DH_RUN[1], dep: ta - DH_RUN[1], thru: true }, { name: NRT2, arr: ta - DH_RUN[2], dep: ta - DH_RUN[2], thru: true }, { name: NRT, arr: ta, dep: ta }], cat);
      dh.next = d; d.prev = dh; ins.push(dh); busy.d.push([ta * 60 + 30 - 180, ta * 60 + 30]); stay[cat].push([ta, D]); }
    for (const a of (arr.get(NRT) || []).slice().sort((x, y) => tArr(x) - tArr(y))) { if (a.next || a.dh) continue;
      const T0 = tArr(a), cat = nrtCat(a); let pick = null;
      for (const w of [4, 5, 3, 6, 7, 8, 9, 10, 2]) { const P = (T0 + w) * 60 + 5;
        if (hitS(busy.d, P - 10, P + 190) || busy.u.some(([x]) => Math.abs(x - P) < 50)) continue;
        pick = w; break; }
      const td = T0 + (pick == null ? 4 : pick), dh = mk(a, [{ name: NRT, arr: td, dep: td }, { name: NRT2, arr: td + DH_RUN[2], dep: td + DH_RUN[2], thru: true }, { name: '京成成田', arr: td + DH_RUN[1], dep: td + DH_RUN[1], thru: true }, { name: DH_ST, arr: td + DH_RUN[0], dep: td + DH_RUN[0] }], cat);
      a.next = dh; dh.prev = a; busy.u.push([td * 60 + 5, td * 60 + 185]); stay[cat].push([T0, td]); }
    if (ins.length || true) nrtAssign([...(arr.get(NRT) || []), ...ins].sort((a, b) => tArr(a) - tArr(b)));
  }
  let n = 0;""")
rep("const NRT = '成田空港', NRT2 = '空港第2ビル';",
    "const NRT = '成田空港', NRT2 = '空港第2ビル';\nconst DH_ST = '宗吾参道', DH_RUN = [14, 9, 3];   // 回送が成田空港から 宗吾参道・京成成田・空港第2ビル まで走る分(止まらない)")
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('patched')
