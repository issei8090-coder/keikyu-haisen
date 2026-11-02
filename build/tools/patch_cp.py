def patch(p, pairs):
    s = open(p, encoding='utf-8').read()
    for a, b in pairs:
        assert s.count(a) == 1, (p, a, s.count(a))
        s = s.replace(a, b)
    open(p, 'w', encoding='utf-8').write(s)

patch('src/ttcore.js', [
 # --- 増結の対象を決める
 ("// 折り返しの自動判定: 終着した列車を、同じ駅から次に出る列車につなぐ", '''// ===== 金沢文庫の増結 =====
// 平日朝の上り特急・快特は、金沢文庫で4両を足して12両になる(時刻表では2分以上の停車)。
//  品川行き   → 3番線(内線)。後ろ=金沢八景寄りに連結
//  泉岳寺行き → 4番線(外線)。前=上大岡寄りに連結。品川で前4両を切り離す
const COUPLE_ST = '金沢文庫', COUPLE_LEN = 6, COUPLE_FROM = 6 * 60, COUPLE_TO = 9 * 60;
function ttCouple(list, day) {
  if (day !== 'wd') return 0;
  let n = 0;
  for (const t of list) {
    const i = t.names.indexOf(COUPLE_ST), m = t.names.length;
    if (i <= 0 || i >= m - 1 || (t.type !== 'tokkyu' && t.type !== 'kaitoku') || t.cars !== 8) continue;
    const e = t.ev[i];
    if (e.dep - e.arr < 2 || e.arr < COUPLE_FROM || e.arr >= COUPLE_TO || t.names.indexOf('上大岡') < i) continue;
    const side = t.names[m - 1] === '品川' ? 'rear' : t.names[m - 1] === '泉岳寺' ? 'front' : null;
    if (!side) continue;
    t.cpl = { i, side, e: null, t0: null, t1: Infinity };
    n++;
  }
  return n;
}
// 両数による見た目の長さ(前後への延長)。12両の下りは金沢文庫で後ろ4両を切り離すとみなす
function ttShape(t, T) {
  let b = 0, f = 0;
  if (t.cpl && t.cpl.t0 != null) { if (T >= t.cpl.t0 && T < t.cpl.t1) { if (t.cpl.side === 'rear') b = COUPLE_LEN; else f = COUPLE_LEN; } }
  else if (t.cars === 12) {
    if (t.c12 === undefined) { const i = t.names.indexOf(COUPLE_ST); t.c12 = i > 0 && i < t.names.length - 1 ? t.P[i + t.k0] : Infinity; }
    if (T < t.c12) b = COUPLE_LEN;
  }
  t.extB = b; t.extF = f;
}
// 折り返しの自動判定: 終着した列車を、同じ駅から次に出る列車につなぐ'''),
 # --- planner
 ("  const stat = { siding: 0, moved: 0 };", '''  const stat = { siding: 0, moved: 0, couple: 0 };
  const units = [];        // 増結車(金沢文庫で連結する4両)
  // 増結する列車が入る番線: 上り(品川方面)に使える内線=3番線 / 外線=4番線
  const cplEdge = side => { const c = stByName.get(COUPLE_ST).stops.map(([e]) => e).filter(e => E[e].lane === (side === 'rear' ? 'in' : 'out') && E[e].dir !== 1).sort((a, b) => E[a].dir - E[b].dir); return c.length ? c[0] : null; };
  const unitCands = new Map();   // 番線 → 増結車が向きを変えずに入れる留置線(近い順)
  const unitRoutes = (e, nextName) => {
    if (unitCands.has(e)) return unitCands.get(e);
    const sx = stByName.get(COUPLE_ST).stops.find(s => s[0] === e)[1], l = [];
    for (const sd of SIDINGS.get(COUPLE_ST) || []) {
      if (N[sd.node].x < sx) continue;   // 車庫のある金沢八景側から出てくる
      const r = buildTimedRoute([COUPLE_ST, nextName], [0, 0], { startAt: { e: sd.e, t: sd.t }, startExtra: true, isFree: (i, f) => i !== 0 || f === e });
      if (!r || r.stopE[0] !== e) continue;
      let last = 0, rev = 0;
      for (const g of r.segs) { if (g.d0 >= r.stopD[1]) break; const s = Math.sign(g.bx - g.ax); if (s && last && s !== last) rev++; if (s) last = s; }
      if (!rev) l.push({ sd, r });
    }
    l.sort((a, b) => a.r.stopD[1] - b.r.stopD[1]);
    unitCands.set(e, l);
    return l;
  };
  function addUnit(t) {
    const c = t.cpl, k = c.i + t.k0, Am = t.A[k], Pm = t.P[k], front = c.side === 'front';
    const cands = unitRoutes(c.e, t.names[c.i + 1]);
    if (!cands.length) { t.cpl = null; return; }
    // 前に付く車両は先にホームで待ち、後ろに付く車両は本体が着いてから入ってくる
    const arrive = front ? Am - 70 : Math.max(Am + 20, Math.min(Am + 40, Pm - 45));
    const mvOf = x => Math.max(20, Math.min(50, x.r.stopD[1] / 2));
    const x = cands.find(x => isFreeAt(x.sd.e, arrive - mvOf(x) - 120, arrive, t)) || cands[0];
    const mv = mvOf(x), d = x.r.stopD[1], gap = 6 + COUPLE_LEN / 2;
    const u = { no: t.no, type: t.type, dest: t.dest, cars: 4, len: COUPLE_LEN, unit: true, cplWith: t, tt: true, s: 0, g: null, prev: null, next: null, k0: 0,
      names: [COUPLE_ST], ev: [{ name: COUPLE_ST, arr: Math.floor(arrive / 60), dep: t.ev[c.i].dep }],
      route: Object.assign({}, x.r, { total: d + gap + 2 }), A: [arrive - mv - 120, arrive], P: [arrive - mv, front ? Am + 20 : arrive + 15], off: [0, front ? gap : -gap] };
    u.start = u.A[0]; u.end = u.P[1];
    reserve(x.sd.e, u.start, arrive, t);
    const q = t.names.indexOf('品川');
    c.t0 = u.end; c.t1 = q > c.i && q < t.names.length - 1 ? t.P[q + t.k0] : Infinity; c.unit = u;
    units.push(u); stat.couple++;
  }'''),
 ("    let b = t.P[k] + 5;\n    if (last && t.next && !t.tail) b = t.next.ev[0].dep * 60 + 5;\n    return [t.A[k] - 5, b];",
  "    let b = t.P[k] + 5;\n    if (last && t.next && !t.tail) b = t.next.ev[0].dep * 60 + 5;\n    if (t.cpl && i === t.cpl.i && t.cpl.side === 'front') return [t.A[k] - 110, b];   // 先に入って待つ増結車の分\n    return [t.A[k] - 5, b];"),
 ("  function pre(t) {\n", '''  function pre(t) {
    if (t.cpl) {
      t.cpl.e = cplEdge(t.cpl.side);
      if (t.cpl.e == null) t.cpl = null;
      else { const s = span(t, t.cpl.i); reserve(t.cpl.e, s[0], s[1], t); res.get(t.cpl.e)[res.get(t.cpl.e).length - 1][3] = true; }
    }
'''),
 ("      isFree: (i, e) => { if (i === n - 1 && t.forceEnd != null) return e === t.forceEnd;", "      isFree: (i, e) => { if (t.cpl && i === t.cpl.i) return e === t.cpl.e; if (i === n - 1 && t.forceEnd != null) return e === t.forceEnd;"),
 ("    t.route = route;\n    if (!route) return;\n    t.off = [];", '''    t.route = route;
    if (t.cpl) { const l0 = res.get(t.cpl.e); if (l0) res.set(t.cpl.e, l0.filter(r => !(r[3] && r[2] === t))); }
    if (!route) return;
    if (t.cpl && route.stopE[t.cpl.i] !== t.cpl.e) t.cpl = null;   // 決めた番線に入れなかったら増結しない
    t.off = [];'''),
 ("      if (i > 0) {\n        let before = 0, after = 0;", "      if (i > 0 && !(t.cpl && i === t.cpl.i)) {\n        let before = 0, after = 0;"),
 ("      const s = span(t, i); reserve(e, s[0], s[1]);\n    });\n  }\n  return { pre, plan, stat };",
  "      const s = span(t, i); reserve(e, s[0], s[1]);\n    });\n    if (t.cpl) addUnit(t);\n  }\n  return { pre, plan, stat, units };"),
 # --- target / follow
 ("  t.tgt = s;\n  return true;", "  t.tgt = s;\n  ttShape(t, T);\n  return true;"),
 ("        if (o.t === t) continue;\n        const dL = g.d0 + (o.u - u0);", "        if (o.t === t || o.t.cplWith === t || t.cplWith === o.t) continue;   // 連結する相手にはくっつく\n        const dL = g.d0 + (o.u - u0) - (o.t.extB || 0) - (t.extF || 0);"),
])

patch('src/ui.js', [
 ("  const d = pathD(t.route, t.s - LEN / 2, t.s + LEN / 2);\n  t.casing.setAttribute('d', d); t.body.setAttribute('d', d);",
  "  const h = (t.len || LEN) / 2, d = pathD(t.route, t.s - h - (t.extB || 0), t.s + h + (t.extF || 0));\n  t.casing.setAttribute('d', d); t.body.setAttribute('d', d);"),
])

patch('src/tt.js', [
 ("  const nl = day && $('ttlink').checked ? ttLink(ttList) : 0;", "  const nl = day && $('ttlink').checked ? ttLink(ttList) : 0;\n  if (day && $('ttcouple').checked) ttCouple(ttList, day);"),
 ("    else $('ttinfo').textContent = nl ?", "    else { list.push(...pl.units); $('ttinfo').textContent = (pl.units.length ? `金沢文庫の増結 ${pl.units.length} 本・` : '') + (nl ?"),
 ("(ot ? `・通過待ちを推定 ${ot.waits} 件` : '') : '';\n  };", "(ot ? `・通過待ちを推定 ${ot.waits} 件` : '') : ''); }\n  };"),
 ("      t.label = el('text', { class: 'tlabel', fill: ty.color }, t.g, `${ty.short} ${shortDest(t.dest)}`);", "      t.label = el('text', { class: 'tlabel', fill: ty.color }, t.g, t.unit ? '増結4両' : `${ty.short} ${shortDest(t.dest)}`);"),
 ("  const ty = TYPES[t.type];\n  $('tttitle').textContent = `${ty.name} ${t.dest}行き`; $('tttitle').style.color = ty.color;",
  '''  const ty = TYPES[t.type];
  if (t.unit) {   // 増結車
    const m = t.cplWith, c = m.cpl, e = m.ev[c.i], rear = c.side === 'rear';
    $('tttitle').textContent = `増結車(4両) → ${ty.name} ${m.dest}行き`; $('tttitle').style.color = ty.color;
    $('ttno').textContent = `金沢文庫 ${hm(e.dep)}発の ${ty.name}${m.no ? ' (' + m.no + ')' : ''} に連結`;
    $('ttlinkinfo').innerHTML = `金沢文庫始発の車両(空車で入線)<br>${rear ? '3番線・後ろ(金沢八景寄り)' : '4番線・前(上大岡寄り)'}に連結して12両に`;
    $('ttstops').innerHTML = `<li><span>${hm(Math.floor(t.A[1] / 60))}頃</span>金沢文庫 ${rear ? '3' : '4'}番線に入線</li><li><span>${hm(e.dep)}</span>金沢文庫 発(${ty.name}の${rear ? '後ろ' : '前'}4両として)</li>`;
    return;
  }
  $('tttitle').textContent = `${ty.name} ${t.dest}行き`; $('tttitle').style.color = ty.color;'''),
 ("(t.cars ? `<br>${t.cars}両編成` : '');", "(t.cpl ? `<br>8両編成 → 金沢文庫で4両増結(${t.cpl.side === 'rear' ? '3番線・後ろ=金沢八景寄り' : '4番線・前=上大岡寄り'})して12両` + (t.cpl.t1 < Infinity ? '、品川で前4両を切り離し' : '') : t.cars ? `<br>${t.cars}両編成` + (t.cars === 12 && t.names.indexOf('金沢文庫') > 0 && t.names.indexOf('金沢文庫') < t.names.length - 1 ? '(金沢文庫で後ろ4両を切り離し)' : '') : '');"),
 ("<li><span>${e.arr !== e.dep ? hm(e.arr) + '着 ' : ''}${hm(e.dep)}</span>${e.name}${e.ot ? '(待避)' : ''}</li>`).join('');", "<li><span>${e.arr !== e.dep ? hm(e.arr) + '着 ' : ''}${hm(e.dep)}</span>${e.name}${e.ot ? '(待避)' : ''}${t.cpl && t.ev[t.cpl.i] === e ? '(4両増結)' : ''}</li>`).join('');"),
 ("$('ttwait').onchange = () => ttLoad(ttDay);", "$('ttwait').onchange = () => ttLoad(ttDay);\n$('ttcouple').onchange = () => ttLoad(ttDay);"),
])
patch('src/template.html', [
 ('<label><input id="ttfollow" type="checkbox" checked> 同じ線では追い越さない</label>', '<label><input id="ttfollow" type="checkbox" checked> 同じ線では追い越さない</label>\n    <label><input id="ttcouple" type="checkbox" checked> 金沢文庫の増結</label>'),
])
for p in ['src/check.js', 'src/adhere.js']:
    s = open(p, encoding='utf-8').read()
    s = s.replace("ttLink(list); list.sort((a, b) => a.start - b.start);", "ttLink(list); ttCouple(list, day); list.sort((a, b) => a.start - b.start);")
    s = s.replace("list.forEach(pl.pre); list.forEach(pl.plan);", "list.forEach(pl.pre); list.forEach(pl.plan); const UNITS = pl.units;")
    open(p, 'w', encoding='utf-8').write(s)
print('ok')
