# 運転指令のタブに、別の区間の一部をはめ込む(tabs[].inc = [{sec, km:[a,b], off, dy}])
# 例: 浅草線「三田・泉岳寺・高輪台〜戸越」に、京急の区間の泉岳寺(京急キロ -0.55〜0.62)を都営キロ -6.9 の位置へ
import io
p = 'src/dispui.js'
s = io.open(p, encoding='utf-8', newline='').read()
NL = '\r\n' if '\r\n' in s else '\n'
def rep(a, b, n=1):
    global s
    c = s.count(a)
    assert c == n, (c, a[:80])
    s = s.replace(a, b)

# タブの部品
rep("DSEC.forEach((sec, si) => sec.tabs.forEach((tb, ti) => dTabs.push({ si, name: tb.name, km0: tb.km[0], km1: tb.km[1] })));",
    "DSEC.forEach((sec, si) => sec.tabs.forEach((tb, ti) => { const T = { si, name: tb.name, km0: tb.km[0], km1: tb.km[1] }; T.parts = [{ si, km0: T.km0, km1: T.km1, off: 0, dy: 0 }]; for (const q of tb.inc || []) { const s2 = DSEC.findIndex(x => x.id === q.sec); if (s2 >= 0 && s2 !== si) T.parts.push({ si: s2, km0: q.km[0], km1: q.km[1], off: q.off || 0, dy: q.dy || 0 }); } dTabs.push(T); }));   // inc: ほかの区間の一部をはめ込む(区間の計算はそのまま、画面だけ)" + NL +
    "const dPart = (tb, si) => tb.parts.find(p => p.si === si);" + NL +
    "const dInTab = (tb, si, km, tol = 0) => { const p = dPart(tb, si); return !!p && km >= p.km0 - tol && km <= p.km1 + tol; };")
rep("""  const sec = DSEC[tb.si]; let y0 = Infinity, y1 = -Infinity;
  for (const e of sec.edges) { const a = E[e].a, b = E[e].b; if (Math.max(dKm[a], dKm[b]) < tb.km0 || Math.min(dKm[a], dKm[b]) > tb.km1) continue; y0 = Math.min(y0, dBy[a], dBy[b]); y1 = Math.max(y1, dBy[a], dBy[b]); }""".replace('\n', NL),
    """  let y0 = Infinity, y1 = -Infinity;
  for (const P of tb.parts) for (const e of DSEC[P.si].edges) { const a = E[e].a, b = E[e].b; if (Math.max(dKm[a], dKm[b]) < P.km0 || Math.min(dKm[a], dKm[b]) > P.km1) continue; y0 = Math.min(y0, dBy[a] + P.dy, dBy[b] + P.dy); y1 = Math.max(y1, dBy[a] + P.dy, dBy[b] + P.dy); }""".replace('\n', NL))
rep("  tb.X = km => (km - tb.km0) * D_KMPX; tb.Y = by => (by - y0) * D_YS + D_TOP;",
    "  tb.X = (km, si) => { const P = si == null ? tb.parts[0] : dPart(tb, si) || tb.parts[0]; return (km + P.off - tb.km0) * D_KMPX; };" + NL +
    "  tb.Y = (by, si) => { const P = si == null ? tb.parts[0] : dPart(tb, si) || tb.parts[0]; return (by + P.dy - y0) * D_YS + D_TOP; };")

# ホームと駅名・線路・区間の外へつながる所
rep("""  for (const [nm, info] of sec.stInfo) {
    if (info.km + info.len / 2000 < tb.km0 || info.km - info.len / 2000 > tb.km1) continue;
    const s = stByName.get(nm), dy = sec.sc.rows[info.row].dy, x0 = tb.X(info.km - info.len / 2000), x1 = tb.X(info.km + info.len / 2000);""".replace('\n', NL),
    """  for (const P of tb.parts) { const sec = DSEC[P.si]; for (const [nm, info] of sec.stInfo) {
    if (info.km + info.len / 2000 < P.km0 || info.km - info.len / 2000 > P.km1) continue;
    const s = stByName.get(nm), dy = sec.sc.rows[info.row].dy, x0 = tb.X(info.km - info.len / 2000, P.si), x1 = tb.X(info.km + info.len / 2000, P.si);""".replace('\n', NL))
rep("for (const p of s.plats) { const y0 = tb.Y(p[1] + dy), y1 = tb.Y(p[3] + 1 + dy);",
    "for (const p of s.plats) { const y0 = tb.Y(p[1] + dy, P.si), y1 = tb.Y(p[3] + 1 + dy, P.si);")
rep("""(sec.sc.kmNeg ? Math.abs(info.km) : info.km).toFixed(1) + 'km');
  }""".replace('\n', NL),
    """(sec.sc.kmNeg ? Math.abs(info.km) : info.km).toFixed(1) + 'km');
  } }""".replace('\n', NL))
rep("""  let d = '';
  for (const e of sec.edges) {
    const a = E[e].a, b = E[e].b; if (E[e].portal) continue;
    if (Math.max(dKm[a], dKm[b]) < tb.km0 - 0.05 || Math.min(dKm[a], dKm[b]) > tb.km1 + 0.05) continue;
    d += `M${tb.X(dKm[a]).toFixed(1)} ${tb.Y(dBy[a]).toFixed(1)}L${tb.X(dKm[b]).toFixed(1)} ${tb.Y(dBy[b]).toFixed(1)}`;
  }""".replace('\n', NL),
    """  let d = '';
  for (const P of tb.parts) for (const e of DSEC[P.si].edges) {
    const a = E[e].a, b = E[e].b; if (E[e].portal) continue;
    if (Math.max(dKm[a], dKm[b]) < P.km0 - 0.05 || Math.min(dKm[a], dKm[b]) > P.km1 + 0.05) continue;
    d += `M${tb.X(dKm[a], P.si).toFixed(1)} ${tb.Y(dBy[a], P.si).toFixed(1)}L${tb.X(dKm[b], P.si).toFixed(1)} ${tb.Y(dBy[b], P.si).toFixed(1)}`;
  }""".replace('\n', NL))
rep("  for (const n of sec.bnd) { if (dKm[n] < tb.km0 || dKm[n] > tb.km1) continue; el('circle', { cx: tb.X(dKm[n]), cy: tb.Y(dBy[n]), r: 2.6, class: 'bk-bnd' }, gB.static); }",
    "  for (const P of tb.parts) for (const n of DSEC[P.si].bnd) { if (dKm[n] < P.km0 || dKm[n] > P.km1) continue; el('circle', { cx: tb.X(dKm[n], P.si), cy: tb.Y(dBy[n], P.si), r: 2.6, class: 'bk-bnd' }, gB.static); }")

# 信号機・守られていない分岐
rep("    if (s.sec !== tb.si || s.km < tb.km0 || s.km > tb.km1) continue;", "    if (!dInTab(tb, s.sec, s.km)) continue;")
rep("    if (w.sec !== tb.si || w.km < tb.km0 || w.km > tb.km1) continue;", "    if (!dInTab(tb, w.sec, w.km)) continue;")
rep("transform: `translate(${tb.X(w.km).toFixed(1)} ${(tb.Y(w.by) + (w.down ? -9 : 9)).toFixed(1)})` }, gB.sig);",
    "transform: `translate(${tb.X(w.km, w.sec).toFixed(1)} ${(tb.Y(w.by, w.sec) + (w.down ? -9 : 9)).toFixed(1)})` }, gB.sig);")
rep("  g.setAttribute('transform', `translate(${tb.X(s.km).toFixed(1)} ${(tb.Y(s.by) + sg * 2).toFixed(1)})`);",
    "  g.setAttribute('transform', `translate(${tb.X(s.km, s.sec).toFixed(1)} ${(tb.Y(s.by, s.sec) + sg * 2).toFixed(1)})`);")

# 経路の線(列車・在線)
rep("""    if (dSecOf[s.e] !== tb.si) continue;
    const e = E[s.e], Em = dEm[s.e], f0 = s.lo / Em, f1 = s.hi / Em;
    const km = f => dKm[e.a] + (dKm[e.b] - dKm[e.a]) * f, by = f => dBy[e.a] + (dBy[e.b] - dBy[e.a]) * f;
    d += `M${tb.X(km(f0)).toFixed(1)} ${tb.Y(by(f0)).toFixed(1)}L${tb.X(km(f1)).toFixed(1)} ${tb.Y(by(f1)).toFixed(1)}`;""".replace('\n', NL),
    """    const si = dSecOf[s.e], P = dPart(tb, si); if (!P) continue;
    const e = E[s.e], Em = dEm[s.e], f0 = s.lo / Em, f1 = s.hi / Em;
    const km = f => dKm[e.a] + (dKm[e.b] - dKm[e.a]) * f, by = f => dBy[e.a] + (dBy[e.b] - dBy[e.a]) * f;
    if (P !== tb.parts[0] && (Math.max(km(f0), km(f1)) < P.km0 - 0.05 || Math.min(km(f0), km(f1)) > P.km1 + 0.05)) continue;   // はめ込んだ部分は、その範囲だけ
    d += `M${tb.X(km(f0), si).toFixed(1)} ${tb.Y(by(f0), si).toFixed(1)}L${tb.X(km(f1), si).toFixed(1)} ${tb.Y(by(f1), si).toFixed(1)}`;""".replace('\n', NL))
# 確保された進路
rep("""    if (dSecOf[e] !== tb.si) continue; const ed = E[e], Em = dEm[e];
    for (const k of l) { const f0 = k.lo / Em, f1 = k.hi / Em; const km = f => dKm[ed.a] + (dKm[ed.b] - dKm[ed.a]) * f, by = f => dBy[ed.a] + (dBy[ed.b] - dBy[ed.a]) * f;
      if (Math.max(km(f0), km(f1)) < tb.km0 || Math.min(km(f0), km(f1)) > tb.km1) continue;
      dl += `M${tb.X(km(f0)).toFixed(1)} ${tb.Y(by(f0)).toFixed(1)}L${tb.X(km(f1)).toFixed(1)} ${tb.Y(by(f1)).toFixed(1)}`; }""".replace('\n', NL),
    """    const si = dSecOf[e], P = dPart(tb, si); if (!P) continue; const ed = E[e], Em = dEm[e];
    for (const k of l) { const f0 = k.lo / Em, f1 = k.hi / Em; const km = f => dKm[ed.a] + (dKm[ed.b] - dKm[ed.a]) * f, by = f => dBy[ed.a] + (dBy[ed.b] - dBy[ed.a]) * f;
      if (Math.max(km(f0), km(f1)) < P.km0 || Math.min(km(f0), km(f1)) > P.km1) continue;
      dl += `M${tb.X(km(f0), si).toFixed(1)} ${tb.Y(by(f0), si).toFixed(1)}L${tb.X(km(f1), si).toFixed(1)} ${tb.Y(by(f1), si).toFixed(1)}`; }""".replace('\n', NL))
# 列車
rep("if (!dp.ranges.some(r => r.secs ? r.secs.has(tb.si) : r.sec === tb.si)) continue;",
    "if (!dp.ranges.some(r => tb.parts.some(P => r.secs ? r.secs.has(P.si) : r.sec === P.si))) continue;")
rep("""    if (km < tb.km0 - 0.2 || km > tb.km1 + 0.2) continue;
    const g0 = t.route.segs[fr.i], right = (g0.t1 > g0.t0) === (dKm[e.b] > dKm[e.a]);
    labs.push({ t, x: tb.X(km), y: tb.Y(by), right, ty });""".replace('\n', NL),
    """    if (!dInTab(tb, dSecOf[fr.e], km, 0.2)) continue;
    const g0 = t.route.segs[fr.i], right = (g0.t1 > g0.t0) === (dKm[e.b] > dKm[e.a]);
    labs.push({ t, x: tb.X(km, dSecOf[fr.e]), y: tb.Y(by, dSecOf[fr.e]), right, ty });""".replace('\n', NL))
# 確かめの一覧
rep("const si = dTabs[dTab].si, ws = SIGS.filter(x => x.sec === si && D_SIGWARN.has(x)).sort((a, b) => a.km - b.km), lw = D_LOCWARN.filter(w => w.sec === si).sort((a, b) => a.km - b.km);",
    "const tb = dTabs[dTab], ws = SIGS.filter(x => dInTab(tb, x.sec, x.km) && D_SIGWARN.has(x)).sort((a, b) => a.km - b.km), lw = D_LOCWARN.filter(w => dInTab(tb, w.sec, w.km)).sort((a, b) => a.km - b.km);")
# 図の点 → 線路
rep("""  const tb = dTabs[dTab], sec = DSEC[tb.si], pt = board.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;""".replace('\n', NL),
    """  const tb = dTabs[dTab], pt = board.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;""".replace('\n', NL))
rep("""  for (const e of sec.edges) {
    if (E[e].portal) continue; let d = -1; for (const x of [0, 1]) if (dAllowed(e, x) && dDn(e * 2 + x) === dn) d = x; if (d < 0) continue;
    const a = E[e].a, b = E[e].b, ax = tb.X(dKm[a]), ay = tb.Y(dBy[a]), dx = tb.X(dKm[b]) - ax, dy = tb.Y(dBy[b]) - ay, L2 = dx * dx + dy * dy; if (L2 < 1e-6) continue;""".replace('\n', NL),
    """  for (const P of tb.parts) for (const e of DSEC[P.si].edges) {
    if (E[e].portal) continue; let d = -1; for (const x of [0, 1]) if (dAllowed(e, x) && dDn(e * 2 + x) === dn) d = x; if (d < 0) continue;
    const a = E[e].a, b = E[e].b; if (Math.max(dKm[a], dKm[b]) < P.km0 - 0.05 || Math.min(dKm[a], dKm[b]) > P.km1 + 0.05) continue;
    const ax = tb.X(dKm[a], P.si), ay = tb.Y(dBy[a], P.si), dx = tb.X(dKm[b], P.si) - ax, dy = tb.Y(dBy[b], P.si) - ay, L2 = dx * dx + dy * dy; if (L2 < 1e-6) continue;""".replace('\n', NL))
rep("const near = SIGS.filter(x => x.sec === dTabs[dTab].si && x.de === p.de",
    "const near = SIGS.filter(x => x.sec === dSecOf[p.de >> 1] && x.de === p.de")
rep("dSecList(dTabs[dTab].si).push(sp);", "dSecList(dSecOf[p.de >> 1]).push(sp);")
rep("d.g.setAttribute('transform', `translate(${tb.X(P.km).toFixed(1)} ${(tb.Y(P.by) + (up ? -10 : 10)).toFixed(1)})`);",
    "d.g.setAttribute('transform', `translate(${tb.X(P.km, dSecOf[p.de >> 1]).toFixed(1)} ${(tb.Y(P.by, dSecOf[p.de >> 1]) + (up ? -10 : 10)).toFixed(1)})`);")
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('dispui ok')

# 設定: 泉岳寺を浅草線のタブへ移す
import json, re
q = 'disp_cfg.json'
t = io.open(q, encoding='utf-8', newline='').read()
a1 = '{ "name": "泉岳寺〜立会川", "km": [-0.55, 4.95] }'
b1 = '{ "name": "品川〜立会川", "km": [0.55, 4.95] }'
a2 = '{ "name": "三田・高輪台〜戸越", "km": [-8.4, -2.7] }'
b2 = '{ "name": "三田・泉岳寺・高輪台〜戸越", "km": [-8.4, -2.7], "inc": [{ "sec": "kq1", "km": [-0.55, 0.55], "off": -6.9, "dy": 858, "note": "泉岳寺(京急の区間で走らせ、画面だけここへ。都営キロ 三田-8.0 高輪台-5.5 の間)" }] }'
assert t.count(a1) == 1 and t.count(a2) == 1
t = t.replace(a1, b1).replace(a2, b2)
json.loads(t)
io.open(q, 'w', encoding='utf-8', newline='').write(t)
print('cfg ok')
