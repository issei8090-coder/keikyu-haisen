const fs = require('fs');
const D = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const TT = JSON.parse(fs.readFileSync('tt.json', 'utf8'));
function hs(s) { s = Math.floor(s); return String(Math.floor(s / 3600) % 24).padStart(2, '0') + ':' + String(Math.floor(s / 60) % 60).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }
eval(fs.readFileSync('src/core.js', 'utf8') + fs.readFileSync('src/ttcore.js', 'utf8') + `
for (const day of ['wd', 'hd']) { const list = TT[day].map(ttDecode).filter(t => t.ev.length > 1); ttOvertakes(list); ttCouple(list, day); ttLink(list); list.sort((a, b) => a.start - b.start);
  const pl = ttPlanner(true); list.forEach(pl.pre); list.forEach(pl.plan); pl.finish();
  const b2 = stByName.get('空港第2ビル'), na = stByName.get('成田空港'), x0 = Math.max(...b2.plats.map(p => p[2])), x1 = Math.min(...na.plats.map(p => p[0]));
  const occ = [];
  for (const t of list) { if (!t.route || !t.names.includes('成田空港')) continue;
    const tm = d => { let T0 = t.start, T1 = t.end; for (let i = 0; i < 40; i++) { const m = (T0 + T1) / 2; ttTarget(t, m); if (t.tgt < d) T0 = m; else T1 = m; } return T0; };
    let d0 = null, d1 = null, dir = 0;
    for (const g of t.route.segs) { const y = (g.ay + g.by) / 2, xa = Math.min(g.ax, g.bx), xb = Math.max(g.ax, g.bx); if (y < 1715 || y > 1745 || xb <= x0 + 1 || xa >= x1 - 4 || edgeStation[g.e] >= 0) continue; if (d0 == null) d0 = g.d0; d1 = g.d1; dir = Math.sign(g.bx - g.ax) || dir; }
    if (d0 != null) occ.push({ t, dir, t0: tm(d0), t1: tm(d1) }); }
  let head = 0; const ex = [];
  for (const a of occ) for (const b of occ) { if (a.dir <= 0 || b.dir >= 0) continue; const ov = Math.min(a.t1, b.t1) - Math.max(a.t0, b.t0); if (ov > 0) { head++; if (ex.length < 5) ex.push(a.t.no + '→' + hs(a.t0) + '-' + hs(a.t1).slice(3) + ' / ' + b.t.no + '←' + hs(b.t0) + '-' + hs(b.t1).slice(3)); } }
  console.log(day, '空港第2ビル〜成田空港 単線で正面から重なる組', head, '/ 通る列車', occ.length, '| x', x0.toFixed(0), x1.toFixed(0)); ex.forEach(x => console.log('   ', x)); }
`);
