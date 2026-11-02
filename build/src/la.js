const fs = require('fs');
const D = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const TT = JSON.parse(fs.readFileSync('tt.json', 'utf8'));
const CORE = process.argv[2] || 'src/core.js', TC = process.argv[3] || 'src/ttcore.js';
eval(fs.readFileSync(CORE, 'utf8') + fs.readFileSync(TC, 'utf8') + `
for (const day of ['wd', 'hd']) { const list = TT[day].map(ttDecode).filter(t => t.ev.length > 1); ttOvertakes(list); ttCouple(list, day); ttLink(list); list.sort((a, b) => a.start - b.start);
  const pl = ttPlanner(true); list.forEach(pl.pre); list.forEach(pl.plan); pl.finish();
  // 単線区間: 成田湯川の東の端〜空港第2ビルの西の端 のうち、どの駅にも属さない線(信号場の待避線は除く)
  const yu = stByName.get('成田湯川'), b2 = stByName.get('空港第2ビル'), nk = stByName.get('根古屋信号場');
  const occ = [];   // {t, dir, t0, t1, e}
  for (const t of list) { if (!t.route || !t.names.includes('空港第2ビル') || ksVia(t) !== 'access') continue;
    for (const g of t.route.segs) { if (edgeStation[g.e] >= 0 || E[g.e].dir !== 0) continue; const xa = Math.min(g.ax, g.bx), ya = g.ay;
      const inS = (ya > 1340 && ya < 1400 && xa > 612) || (ya > 1700 && ya < 1760 && xa > 440 && xa < 470); if (!inS) continue;
      const tm = d => { let T0 = t.start, T1 = t.end; for (let i = 0; i < 40; i++) { const m = (T0 + T1) / 2; ttTarget(t, m); if (t.tgt < d) T0 = m; else T1 = m; } return T0; };
      occ.push({ t, dir: Math.sign(g.bx - g.ax), t0: tm(g.d0), t1: tm(g.d1), e: g.e }); } }
  let head = 0; const seen = new Set();
  for (const a of occ) for (const b of occ) { if (a.e !== b.e || a.dir <= 0 || b.dir >= 0) continue; if (a.t0 < b.t1 && b.t0 < a.t1) { const k = a.t.no + '/' + b.t.no; if (!seen.has(k)) { seen.add(k); head++; const hs = x => new Date(x * 1000).toISOString().substr(11, 8), ev = t => t.ev.filter(e => ['印旛日本医大', '成田湯川', '根古屋信号場', '空港第2ビル'].includes(e.name)).map(e => e.name + ' ' + hs(t.A[t.ev.indexOf(e) + t.k0]) + '-' + hs(t.P[t.ev.indexOf(e) + t.k0]) + (e.thru ? 'T' : '') + (e.meet ? 'M' : '')).join(' | '); console.log('  HEAD e' + a.e, (a.e === 353 || N[E[a.e].a].x < 655 && N[E[a.e].a].y < 1400 ? '湯川〜根古屋' : '根古屋〜第2ビル'), '下り', a.t.no, TYPES[a.t.type].name, hs(a.t0) + '-' + hs(a.t1), '/ 上り', b.t.no, TYPES[b.t.type].name, hs(b.t0) + '-' + hs(b.t1)); console.log('     ', ev(a.t)); console.log('     ', ev(b.t)); } } }
  const meets = list.filter(t => t.ev.some(e => e.meet)).length;
  const ue = stByName.get('京成上野'), es = [...new Set(ue.stops.map(([e]) => e))].sort((a, b) => N[E[a].a].y - N[E[b].a].y), c = {};
  for (const t of list) { if (!t.route) continue; const n = t.names.length; if (t.names[n - 1] !== '京成上野') continue; const e = t.route.stopE[n - 1 + t.k0], ty = t.tseg ? t.tseg[t.tseg.length - 1][1] : t.type;
    const k = (ty === 'liner' ? 'ライナー' : ty === 'local' ? '普通' : '特急など') + ' ' + (es.indexOf(e) + 1) + '番線'; c[k] = (c[k] || 0) + 1; }
  console.log(day, '根古屋で待つ列車', meets, '本 | 単線区間で正面から重なる組', head, '| 上野着:', Object.keys(c).sort().map(k => k + ' ' + c[k]).join(', ')); }
`);
