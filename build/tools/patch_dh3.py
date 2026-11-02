# 回送の作り直し(1回だけ実行するパッチ)
#  1. 成田空港の回送は京成成田に止まり、通常列車を先に通してから進む(途中で通常列車を追い抜かない・追い抜かれない時刻を選ぶ)
#  2. 京成成田始発・終着で前後の運用が無い列車は、宗吾参道との間を回送で出入りする(上り始発は中線へ入って折り返す)。
#     京成成田止まりのライナーが同じ運用で成田空港始発になるときは、京成成田→成田空港の回送にする
#  3. スカイライナーは京成高砂の車庫にも出入りする: 京成上野始発・終着で前後の運用が無いライナーは、京成高砂との間を回送で走る
import io
p = 'src/ttcore.js'; s = io.open(p, encoding='utf-8').read()
def rep(a, b):
    global s
    assert s.count(a) == 1, a[:70]
    s = s.replace(a, b)

rep("""    const placed = [];   // { cat, k, ta, td }  k = 線(0・1)。アクセス特急の線は1本なので k = 0""",
"""    // 京成本線(上野〜成田空港)を同じ向きに走る列車との前後関係。回送は、途中で通常列車を追い抜く・追い抜かれることになる時刻を選ばない(通常列車を優先)
    const P1 = OT_POS[1], L1p = P1 ? OT_LINES[1].filter(n => P1.has(n)).map(n => P1.get(n)) : [], prof1 = [];
    const addProf = t => { if (!P1) return; const off = ksVia(t) !== 'main', pts = []; t.ev.forEach((e, i) => { if (P1.has(e.name) && !(off && (e.name === NRT || e.name === NRT2))) pts.push([P1.get(e.name), t.A[i + t.k0], t.P[i + t.k0]]); });
      if (pts.length < 2) return; const dir = Math.sign(pts[pts.length - 1][0] - pts[0][0]); if (!dir || pts.some((q, k) => k && Math.sign(q[0] - pts[k - 1][0]) !== dir)) return;
      prof1.push({ t, pts, dir, lo: Math.min(pts[0][0], pts[pts.length - 1][0]), hi: Math.max(pts[0][0], pts[pts.length - 1][0]), t0: pts[0][1], t1: pts[pts.length - 1][2] }); };
    for (const t of list) addProf(t);
    const at1 = (o, q) => { const pts = o.pts; for (let k = 0; k < pts.length; k++) { if (Math.abs(pts[k][0] - q) < 1e-6) return [pts[k][1], pts[k][2]]; if (k + 1 < pts.length && (q - pts[k][0]) * (q - pts[k + 1][0]) < 0) { const x = pts[k][2] + (pts[k + 1][1] - pts[k][2]) * (q - pts[k][0]) / (pts[k + 1][0] - pts[k][0]); return [x, x]; } } return null; };
    // X を dep(秒)に出て Y に arr(秒)に着く回送が、同じ向きの列車と前後を入れ替えずに走れるか(0 = 走れる)
    const ordLine = (X, Y, dep, arr) => { if (!P1 || !P1.has(X) || !P1.has(Y)) return 0; const pX = P1.get(X), pY = P1.get(Y), dir = Math.sign(pY - pX), lo = Math.min(pX, pY), hi = Math.max(pX, pY);
      const smp = L1p.filter(q => q >= lo - 1e-6 && q <= hi + 1e-6);
      for (const o of prof1) { if (o.dir !== dir || o.t1 < dep - 300 || o.t0 > arr + 300 || o.hi <= lo || o.lo >= hi) continue; let s0 = 0, bad = false, cnt = 0;
        for (const q of smp) { const x = at1(o, q); if (!x) continue; cnt++; const my = dep + (arr - dep) * (q - pX) / (pY - pX), a = Math.abs(q - pX) < 1e-6 ? x[1] : x[0], b = Math.abs(q - pY) < 1e-6 ? x[0] : x[1];
          const sg = my < a - 40 ? -1 : my > b + 40 ? 1 : 0; if (!sg || (s0 && sg !== s0)) bad = true; s0 = sg || s0; }
        if (bad && cnt >= 2) return 6; }
      return 0; };
    const NA = '京成成田', RUN_NA = 8, RUN_SG = 5;   // 回送の走る分: 成田空港〜京成成田、京成成田〜宗吾参道
    const waitNA = f => { for (const x of [1, 2, 3, 4, 5, 6, 8, 10, 12]) if (!f(x)) return x; return 2; };   // 京成成田で待つ分: 通常列車と前後が入れ替わらない最初の分
    const placed = [];   // { cat, k, ta, td }  k = 線(0・1)。アクセス特急の線は1本なので k = 0""")

rep("""    const evIn = ta => [{ name: DH_ST, arr: ta - DH_RUN[0], dep: ta - DH_RUN[0] }, { name: '京成成田', arr: ta - DH_RUN[1], dep: ta - DH_RUN[1], thru: true }, { name: NRT2, arr: ta - DH_RUN[2], dep: ta - DH_RUN[2], thru: true }, { name: NRT, arr: ta, dep: ta }];
    const evOut = td => [{ name: NRT, arr: td, dep: td }, { name: NRT2, arr: td + DH_RUN[2], dep: td + DH_RUN[2], thru: true }, { name: '京成成田', arr: td + DH_RUN[1], dep: td + DH_RUN[1], thru: true }, { name: DH_ST, arr: td + DH_RUN[0], dep: td + DH_RUN[0] }];""",
"""    // 宗吾参道 → 京成成田(通常列車を先に通して待つ) → 成田空港。src = 京成成田から出る回送(京成成田止まりの列車がそのまま成田空港へ向かう)
    const evIn = (ta, src) => { const m = ta - RUN_NA; if (src) return [{ name: NA, arr: m, dep: m }, { name: NRT2, arr: ta - DH_RUN[2], dep: ta - DH_RUN[2], thru: true }, { name: NRT, arr: ta, dep: ta }];
      const x = waitNA(x => ordLine(DH_ST, NA, (m - x - RUN_SG) * 60 + 5, (m - x) * 60 + 30));
      return [{ name: DH_ST, arr: m - x - RUN_SG, dep: m - x - RUN_SG }, { name: NA, arr: m - x, dep: m }, { name: NRT2, arr: ta - DH_RUN[2], dep: ta - DH_RUN[2], thru: true }, { name: NRT, arr: ta, dep: ta }]; };
    const evOut = td => { const m = td + RUN_NA, y = waitNA(y => ordLine(NA, DH_ST, (m + y) * 60 + 5, (m + y + RUN_SG) * 60 + 30));
      return [{ name: NRT, arr: td, dep: td }, { name: NRT2, arr: td + DH_RUN[2], dep: td + DH_RUN[2], thru: true }, { name: NA, arr: m, dep: m + y }, { name: DH_ST, arr: m + y + RUN_SG, dep: m + y + RUN_SG }]; };""")

rep("""          const op = ordPen(prof.d, [(D - L - DH_RUN[0]) * 60 + 5, (D - L - DH_RUN[1]) * 60 + 10, (D - L - DH_RUN[2]) * 60 + 10, A]);""",
    """          const op = ordPen(prof.d, [null, null, (D - L - DH_RUN[2]) * 60 + 10, A]) + ordLine(NA, NRT, (D - L - RUN_NA) * 60 + 5, A);""")
rep("""          const op = ordPen(prof.u, [(T0 + w + DH_RUN[0]) * 60 + 30, (T0 + w + DH_RUN[1]) * 60 + 10, (T0 + w + DH_RUN[2]) * 60 + 10, P]);""",
    """          const op = ordPen(prof.u, [null, null, (T0 + w + DH_RUN[2]) * 60 + 10, P]) + ordLine(NRT, NA, P, (T0 + w + RUN_NA) * 60 + 30);""")

rep("""      if (j.kind === 'in') { const dh = mk(j.d, evIn(v.m), j.cat); ttSchedule(dh); dh.next = j.d; j.d.prev = dh; if (e != null) dh.forceEnd = e; }
      else { const dh = mk(j.a, evOut(v.m), v.cat); ttSchedule(dh); j.a.next = dh; dh.prev = j.a; if (e != null) j.a.forceEnd = e; } }
    list.dhStat = stat;""",
"""      if (j.kind === 'in') {
        // 京成成田止まりのライナーが、同じ運用で成田空港始発になる(運用表では駅が変わってつながる): 京成成田から成田空港へ回送する
        const rk = j.d.type === 'liner' ? ttRunOf(j.d).key : null, src = rk ? (arr.get(NA) || []).find(x => !x.next && !x.exitEnd && !x.dh && x.type === 'liner' && ttRunOf(x).key === rk && tArr(x) <= v.m - RUN_NA - 3 && tArr(x) >= v.m - RUN_NA - 70) : null;
        const dh = mk(j.d, evIn(v.m, src), j.cat); ttSchedule(dh); addProf(dh); dh.next = j.d; j.d.prev = dh; if (e != null) dh.forceEnd = e; if (src) { src.next = dh; dh.prev = src; stat.fromNA = (stat.fromNA || 0) + 1; } }
      else { const dh = mk(j.a, evOut(v.m), v.cat); ttSchedule(dh); addProf(dh); j.a.next = dh; dh.prev = j.a; if (e != null) j.a.forceEnd = e; } }
    // ----- 京成成田: 前後の運用が無い始発・終着は、宗吾参道との間を回送で出入りする -----
    //  上りの始発(モーニングライナーなど)は、宗吾参道から来て中線へ入り、向きを変えて発車する
    { const s = stByName.get(NA), es = s ? [...new Set(s.stops.map(([x]) => x))].sort((x, y) => yOf(x) - yOf(y)) : [], mid = es.length === 3 ? es[1] : null, pNA = P1 ? P1.get(NA) : null;
      const west = nm => P1 && P1.has(nm) && P1.get(nm) < pNA;
      if (pNA != null) {
        for (const d of (dep.get(NA) || []).slice().sort((x, y) => tDep(x) - tDep(y))) { if (d.prev || d.exitStart || d.dh || d.swapIn) continue;
          const D = tDep(d); let m = null; for (const x of [5, 4, 6, 7, 8, 3, 9, 10, 12, 14]) if (!ordLine(DH_ST, NA, (D - x - RUN_SG) * 60 + 5, (D - x) * 60 + 30)) { m = D - x; break; }
          if (m == null) { stat.skipNA = (stat.skipNA || 0) + 1; continue; }
          const dh = mk(d, [{ name: DH_ST, arr: m - RUN_SG, dep: m - RUN_SG }, { name: NA, arr: m, dep: m }], null); dh.dhCat = undefined; ttSchedule(dh); addProf(dh); dh.next = d; d.prev = dh; if (mid != null && west(d.names[1])) dh.forceEnd = mid; stat.na = (stat.na || 0) + 1; }
        for (const a of (arr.get(NA) || []).slice().sort((x, y) => tArr(x) - tArr(y))) { if (a.next || a.exitEnd || a.dh || a.swapOut) continue;
          const T0 = tArr(a); let m = null; for (const y of [4, 5, 3, 6, 7, 8, 9, 10, 12, 14]) if (!ordLine(NA, DH_ST, (T0 + y) * 60 + 5, (T0 + y + RUN_SG) * 60 + 30)) { m = T0 + y; break; }
          if (m == null) { stat.skipNA = (stat.skipNA || 0) + 1; continue; }
          const dh = mk(a, [{ name: NA, arr: m, dep: m }, { name: DH_ST, arr: m + RUN_SG, dep: m + RUN_SG }], null); dh.dhCat = undefined; ttSchedule(dh); addProf(dh); a.next = dh; dh.prev = a; stat.na = (stat.na || 0) + 1; } } }
    // ----- 京成上野: スカイライナーは京成高砂の車庫(高砂検車区)にも出入りする -----
    //  前の運用の無い上野始発のライナーは高砂から回送で来る。次の運用の無い上野止まりのライナーは高砂へ回送で戻る(青砥・日暮里は通過)
    { const UE = '京成上野', RUN_UE = 14, s = stByName.get(UE), es = s ? [...new Set(s.stops.map(([x]) => x))].sort((x, y) => yOf(x) - yOf(y)) : [];
      const evU = (m0, rev) => { const l = [{ name: TAKA, arr: m0, dep: m0 }, { name: '青砥', arr: m0 + 2, dep: m0 + 2, thru: true }, { name: '日暮里', arr: m0 + RUN_UE - 4, dep: m0 + RUN_UE - 4, thru: true }, { name: UE, arr: m0 + RUN_UE, dep: m0 + RUN_UE }];
        return rev ? l.reverse().map((e, i) => { const t = m0 + RUN_UE - (e.arr - m0); return Object.assign({}, e, { arr: t, dep: t }); }) : l; };
      if (P1 && P1.has(UE) && P1.has(TAKA) && stByName.has('青砥') && stByName.has('日暮里')) {
        for (const d of (dep.get(UE) || []).slice().sort((x, y) => tDep(x) - tDep(y))) { if (d.prev || d.dh || d.type !== 'liner') continue;
          const D = tDep(d); let m = null; for (const x of [6, 5, 7, 8, 9, 10, 12, 14, 16]) if (!ordLine(TAKA, UE, (D - x - RUN_UE) * 60 + 5, (D - x) * 60 + 30)) { m = D - x; break; }
          if (m == null) { stat.skipUE = (stat.skipUE || 0) + 1; continue; }
          const dh = mk(d, evU(m - RUN_UE, false), null); dh.dhCat = undefined; ttSchedule(dh); addProf(dh); dh.next = d; d.prev = dh; stat.ue = (stat.ue || 0) + 1;
          if (es.length === 4) { const busy = e => (arr.get(UE) || []).some(a => a.forceEnd === e && tArr(a) <= D && m <= (a.next ? tDep(a.next) : tArr(a) + 1)); const e = [es[1], es[2]].find(e => !busy(e)); if (e != null) dh.forceEnd = e; } }
        for (const a of (arr.get(UE) || []).slice().sort((x, y) => tArr(x) - tArr(y))) { if (a.next || a.dh || a.type !== 'liner') continue;
          const T0 = tArr(a); let m = null; for (const y of [4, 5, 3, 6, 7, 8, 9, 10, 12, 14]) if (!ordLine(UE, TAKA, (T0 + y) * 60 + 5, (T0 + y + RUN_UE) * 60 + 30)) { m = T0 + y; break; }
          if (m == null) { stat.skipUE = (stat.skipUE || 0) + 1; continue; }
          const dh = mk(a, evU(m, true), null); dh.dhCat = undefined; ttSchedule(dh); addProf(dh); a.next = dh; dh.prev = a; stat.ue = (stat.ue || 0) + 1; } } }
    list.dhStat = stat;""")
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('patched')
