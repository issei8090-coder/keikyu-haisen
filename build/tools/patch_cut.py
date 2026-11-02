def patch(p, pairs):
    s = open(p, encoding='utf-8').read()
    for a, b in pairs:
        assert s.count(a) == 1, (p, a, s.count(a))
        s = s.replace(a, b)
    open(p, 'w', encoding='utf-8').write(s)

patch('src/ttcore.js', [
 # 12両で着いた列車は12両の列車として折り返す
 ("      const d = ds.find(d => !d.prev && d !== a && tDep(d) >= ta && tDep(d) <= ta + 3 && a.cars === d.cars && d.names[1] !== from);",
  "      const d = ds.find(d => !d.prev && d !== a && tDep(d) >= ta && tDep(d) <= ta + 3 && carsOf(a) === d.cars && d.names[1] !== from);"),
 ("      const d = ds.find(d => !d.prev && d !== a && tDep(d) >= ta && tDep(d) <= ta + TURN_MAX && a.cars === d.cars);",
  "      const d = ds.find(d => !d.prev && d !== a && tDep(d) >= ta && tDep(d) <= ta + TURN_MAX && carsOf(a) === d.cars);"),
 ("  const tArr = a => a.ev[a.ev.length - 1].arr, tDep = d => d.ev[0].dep;",
  "  const tArr = a => a.ev[a.ev.length - 1].arr, tDep = d => d.ev[0].dep;\n  const carsOf = a => a.cpl ? 12 : a.cars;   // 金沢文庫で増結した列車は12両で終着する"),
 ("    t.route = route;\n", "    t.route = route;\n    if (route) planned.push(t);\n"),
 ("  const units = [], cplList = [];", "  const units = [], cplList = [], planned = [];"),
 ("  const finish = () => { cplList.splice(0).forEach(addUnit); return units; };", '''  // ===== 品川で切り離した前4両 =====
  // いったん引上線へ上げ、品川始発で「どこからともなく現れる」列車(折り返し相手のいない列車)の車両として使う。
  // 4両×2本で8両、×3本で12両。使い道のない車両は引上線へ入ったあと回送で出ていったとみなす
  const CUT_ST = '品川', CUT_WAIT = 30 * 60, CUT_LEAD = 150;
  function detach() {
    const sds = SIDINGS.get(CUT_ST) || [], cuts = [];
    for (const u of units.slice()) {
      const t = u.cplWith, c = t.cpl;
      if (c.side !== 'front') continue;
      const q = t.names.indexOf(CUT_ST);
      if (q <= c.i || q >= t.names.length - 1) continue;
      const k = q + t.k0, d0 = t.route.stopD[k] - 2, g = segAt(t.route, d0), L = g.d1 - g.d0, tp = g.t0 + (g.t1 - g.t0) * (L > 0 ? (d0 - g.d0) / L : 0);
      const routes = sds.map(sd => {
        const r = buildTimedRoute([CUT_ST], [0], { startAt: { e: g.e, t: tp }, startExtra: true, tail: sd, isFree: (i, e) => e === t.route.stopE[q] });
        if (!r || r.stopD.length !== 3) return null;
        let last = 0, rev = 0;
        for (const s of r.segs) { const x = Math.sign(s.bx - s.ax); if (x && last && x !== last) rev++; if (x) last = x; }
        return rev ? null : r;
      });
      if (routes.some(Boolean)) cuts.push({ t, q, at: t.P[k] - 25, routes, used: false });
    }
    cuts.sort((a, b) => a.at - b.at);
    const mvOf = r => Math.max(20, Math.min(45, r.total / 2.5));
    const mk = (x, j, n, end, into) => {   // 切り離した車両(引上線 j の奥から n 本目に止まる)
      const t = x.t, r = x.routes[j], mv = mvOf(r), gap = 8 + COUPLE_LEN / 2;
      const v = { no: t.no, type: t.type, dest: t.dest, cars: 4, len: COUPLE_LEN, unit: true, cut: true, into, cplWith: t, tt: true, s: 0, g: null, prev: null, next: null, k0: 0,
        names: [CUT_ST], ev: [{ name: CUT_ST, arr: t.ev[x.q].arr, dep: Math.floor(x.at / 60) }], route: r,
        sd: [gap, Math.max(gap + 1, r.total - n * (COUPLE_LEN + 1))], A: [x.at, x.at + mv], P: [x.at, Math.max(end, x.at + mv + 5)], off: [] };
      v.start = x.at; v.end = v.P[1];
      t.cpl.t1 = x.at; x.used = true; x.v = v;
      units.push(v);
      return v;
    };
    // 品川始発で前の運用がない列車に、待っている車両を古い順に割り当てる
    const deps = planned.filter(d => d.names[0] === CUT_ST && !d.prev && !d.exitStart && !d.fromSiding && d.k0 === 0 && (d.cars === 4 || d.cars === 8 || d.cars === 12)).sort((a, b) => a.ev[0].dep - b.ev[0].dep);
    for (const d of deps) {
      const dep0 = d.ev[0].dep * 60, need = d.cars / 4;
      const pool = cuts.filter(x => !x.used && x.at + CUT_LEAD <= dep0 && dep0 - x.at <= CUT_WAIT);
      if (pool.length < need) continue;
      const use = pool.slice(0, need);
      for (let j = 0; j < sds.length; j++) {
        const sd = sds[j];
        if (use.some(x => !x.routes[j]) || !isFreeAt(sd.e, use[0].at, dep0, d)) continue;
        const opt = { cls: clsOf(d), exitEnd: d.exitEnd, startAt: { e: sd.e, t: sd.t }, startExtra: true, tail: d.tail || null,
          after: d.next && !d.exitEnd && !d.tail ? d.next.names[1] : null, isFree: (i, e) => e === d.route.stopE[i] };
        const r = buildTimedRoute(d.names, d.long, opt);
        if (!r || r.stopD.length !== d.route.stopD.length + 1 || r.stopD[1] > 170 || d.names.some((_, i) => r.stopE[i] !== d.route.stopE[i])) continue;
        const lastArr = Math.max(...use.map(x => x.at + mvOf(x.routes[j]))), tBack = Math.max(15, Math.min(45, r.stopD[1] / 2.5));
        use.forEach((x, n) => mk(x, j, n, lastArr, d));
        d.route = r; d.fromSiding = sd; d.k0 = 1; d.formed = use.map(x => x.t); d.sd = undefined; d.c12 = undefined;
        d.A[0] = dep0 - 50; d.P[0] = dep0;
        d.A.unshift(lastArr); d.P.unshift(Math.max(lastArr, dep0 - 50 - tBack)); d.start = lastArr;
        if (d.off) d.off.unshift(undefined);
        reserve(sd.e, use[0].at, dep0, d); stat.formed = (stat.formed || 0) + 1;
        break;
      }
    }
    // 残り: 引上線が空いていればそこへ引き上げて(回送で)消える
    for (const x of cuts) {
      if (x.used) continue;
      const mvE = j => x.at + mvOf(x.routes[j]) + 40;
      let j = sds.findIndex((sd, j) => x.routes[j] && isFreeAt(sd.e, x.at, mvE(j), null));
      if (j < 0) continue;
      mk(x, j, 0, mvE(j), null); reserve(sds[j].e, x.at, mvE(j), x.t);
    }
  }
  const finish = () => { cplList.splice(0).forEach(addUnit); detach(); return units; };'''),
])

patch('src/tt.js', [
 ("  const nl = day && $('ttlink').checked ? ttLink(ttList) : 0;\n  if (day && $('ttcouple').checked) ttCouple(ttList, day);",
  "  if (day && $('ttcouple').checked) ttCouple(ttList, day);\n  const nl = day && $('ttlink').checked ? ttLink(ttList) : 0;"),
 ("t.unit ? '増結4両' :", "t.cut ? '切離4両' : t.unit ? '増結4両' :"),
 ("  if (t.unit) {   // 増結車\n", '''  if (t.cut) {   // 品川で切り離した前4両
    const m = t.cplWith, d = t.into;
    $('tttitle').textContent = '切り離した4両(品川)'; $('tttitle').style.color = ty.color;
    $('ttno').textContent = `${ty.name} ${m.dest}行き${m.no ? ' (' + m.no + ')' : ''} の前4両。品川 ${hm(m.ev[m.names.indexOf('品川')].arr)}着`;
    $('ttlinkinfo').innerHTML = d ? `引上線で待ち、品川 ${hm(d.ev[0].dep)}発 ${TYPES[d.type].name} ${d.dest}行き${d.no ? ' (' + d.no + ')' : ''}(${d.cars}両)の車両になる(推定)` : '引上線へ(このあとは回送扱い)';
    $('ttstops').innerHTML = `<li><span>${hm(Math.floor(t.A[0] / 60))}</span>品川で切り離し → 引上線へ</li>`;
    return;
  }
  if (t.unit) {   // 増結車
'''),
 ("(t.fromSiding ? '<br>引上線から入線' : '')", "(t.formed ? `<br>品川で切り離された4両×${t.formed.length}本で組成(推定): ${t.formed.map(m => m.no).join('・')} の前4両` : '') + (t.fromSiding ? '<br>引上線から入線' : '')"),
])
for p in ['src/check.js', 'src/adhere.js', 'src/u4.js', 'src/u5.js', 'src/u7.js']:
    s = open(p, encoding='utf-8').read()
    for day in ["day", "'wd'"]:
        s = s.replace("ttLink(list); ttCouple(list, %s);" % day, "ttCouple(list, %s); ttLink(list);" % day)
        s = s.replace("ttLink(list); if (!NOC) ttCouple(list, %s);" % day, "if (!NOC) ttCouple(list, %s); ttLink(list);" % day)
        s = s.replace("ttLink(list); const nc = ttCouple(list, %s);" % day, "const nc = ttCouple(list, %s); ttLink(list);" % day)
    assert s.index('ttCouple(list') < s.index('ttLink(list)'), p
    open(p, 'w', encoding='utf-8').write(s)
print('ok')
