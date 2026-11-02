// 駅とその手前で、別々の列車が同じ線の上で重なる・すれ違う(突き抜ける)場面を探す。向きが逆の列車どうしも見る
//   node src/nrt.js wd [駅名=成田空港] [手前の駅=空港第2ビル]
const fs = require('fs');
const D = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const TT = JSON.parse(fs.readFileSync('tt.json', 'utf8'));
const hs = s => String(Math.floor(s / 3600) % 24).padStart(2, '0') + ':' + String(Math.floor(s / 60) % 60).padStart(2, '0') + ':' + String(Math.floor(s % 60)).padStart(2, '0');
const hm = m => String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
const day = process.argv[2] || 'wd', STN = process.argv[3] || '成田空港', NEXT = process.argv[4] || '空港第2ビル', DT = 2;
eval(fs.readFileSync('src/core.js', 'utf8') + fs.readFileSync('src/ttcore.js', 'utf8') + `
const list = TT[day].map(ttDecode).filter(t => t.ev.length > 1); ttOvertakes(list); ttCouple(list, day); ttLink(list); list.sort((a, b) => a.start - b.start);
const pl = ttPlanner(true); list.forEach(pl.pre); list.forEach(pl.plan); pl.finish(); list.push(...pl.units); list.sort((a, b) => a.start - b.start);
const st = stByName.get(STN), nb = stByName.get(NEXT), x0 = Math.min(st.cx, nb.cx) - 20, x1 = Math.max(st.cx, nb.cx) + 40, y0 = Math.min(...st.plats.map(p => p[1]), ...nb.plats.map(p => p[1])) - 15, y1 = Math.max(...st.plats.map(p => p[3]), ...nb.plats.map(p => p[3])) + 15;
const es = [...new Set(st.stops.map(([e]) => e))].sort((a, b) => N[E[a].a].y - N[E[b].a].y || N[E[a].a].x - N[E[b].a].x);
console.log(STN, 'の線:', es.map((e, i) => (i + 1) + '=e' + e + ' x' + Math.round(N[E[e].a].x) + '-' + Math.round(N[E[e].b].x) + ' y' + N[E[e].a].y).join('  '));
const des = t => t.no + ' ' + TYPES[t.type].name + ' ' + t.names[0] + hm(t.ev[0].dep) + '→' + t.names[t.names.length - 1] + hm(t.ev[t.ev.length - 1].arr);
console.log('回送', JSON.stringify(list.dhStat || null));
const W = list.filter(t => t.route && (t.names.includes(STN)));
let ptr = 0, act = [], lastT = NaN; const seen = new Map();
for (let T = 4.4 * 3600; T < 25.6 * 3600; T += DT) {
  while (ptr < list.length && list[ptr].start <= T) act.push(list[ptr++]);
  act = act.filter(t => { if (ttTarget(t, T)) return true; t.sv = null; t.px = null; return false; });
  ttFollow(act, T, lastT); lastT = T;
  const here = [];
  for (const t of act) { const p = posAt(t.route, t.s); const mv = t.px == null ? 0 : p.x - t.px; t.px = p.x; if (p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) continue; const g = segAt(t.route, Math.max(0, Math.min(t.route.total, t.s))); here.push({ t, x: p.x, y: p.y, e: g.e, mv, len: (t.len || (t.cars || 8) * 1.5) }); }
  for (let a = 0; a < here.length; a++) for (let b = a + 1; b < here.length; b++) { const A = here[a], B = here[b];
    if (A.t.next === B.t || B.t.next === A.t || A.t.cplWith === B.t || B.t.cplWith === A.t) continue;
    if (Math.abs(A.y - B.y) > 2.5) continue; const dx = A.x - B.x, lim = (A.len + B.len) / 2;
    const key = A.t.no + '@' + A.t.ev[0].dep + '|' + B.t.no + '@' + B.t.ev[0].dep, r = seen.get(key) || { A: A.t, B: B.t, T0: null, n: 0, sgn: Math.sign(dx), cross: false, min: 1e9 };
    if (Math.sign(dx) && r.sgn && Math.sign(dx) !== r.sgn) r.cross = true; if (Math.sign(dx)) r.sgn = Math.sign(dx);
    if (Math.abs(dx) < lim) { r.n++; if (r.T0 == null) { r.T0 = T; r.at = '(' + A.x.toFixed(0) + ',' + A.y.toFixed(0) + ') e' + A.e + '/e' + B.e; r.st = (Math.abs(A.mv) > 0.05 ? (A.mv > 0 ? '→' : '←') : '停') + ' / ' + (Math.abs(B.mv) > 0.05 ? (B.mv > 0 ? '→' : '←') : '停'); } r.min = Math.min(r.min, Math.abs(dx)); }
    seen.set(key, r); } }
const bad = [...seen.values()].filter(r => r.T0 != null).sort((a, b) => a.T0 - b.T0);
console.log('==', day, STN, 'を通る列車', W.length, ' 同じ線で重なった組', bad.length, ' うち位置が入れ替わった(突き抜け)', bad.filter(r => r.cross).length);
for (const r of bad) console.log(' ', hs(r.T0), (r.n * DT) + '秒', r.cross ? '突き抜け' : '重なり', '最小間隔' + r.min.toFixed(0), r.at, r.st, '|', des(r.A), '|', des(r.B));
`);
