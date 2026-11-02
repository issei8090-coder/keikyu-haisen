const fs = require('fs');
const D = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const TT = JSON.parse(fs.readFileSync('tt.json', 'utf8'));
function hs(s) { s = Math.floor(s); return String(Math.floor(s / 3600) % 24).padStart(2, '0') + ':' + String(Math.floor(s / 60) % 60).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }
const day = process.argv[2], T0 = +process.argv[3] * 3600, T1 = +process.argv[4] * 3600, STEP = +(process.argv[5] || 30);
eval(fs.readFileSync('src/core.js', 'utf8') + fs.readFileSync('src/ttcore.js', 'utf8') + `
const DT = 2;
const list = TT[day].map(ttDecode).filter(t => t.ev.length > 1); ttOvertakes(list); ttCouple(list, day); ttLink(list); list.sort((a, b) => a.start - b.start);
const pl = ttPlanner(true); list.forEach(pl.pre); list.forEach(pl.plan); pl.finish(); list.push(...pl.units); list.sort((a, b) => a.start - b.start);
let ptr = 0, act = [], lastT = NaN; const seen = new Set();
const inArea = p => (p.y > 1340 && p.y < 1400 && p.x > 575) || (p.y > 1700 && p.y < 1760 && p.x > 440 && p.x < 530);
for (let T = 4.4 * 3600; T < T1; T += DT) {
  while (ptr < list.length && list[ptr].start <= T) act.push(list[ptr++]);
  act = act.filter(t => ttTarget(t, T));
  ttFollow(act, T, lastT); lastT = T;
  if (T < T0 || T % STEP) continue;
  const rows = [];
  for (const t of act) { const p = posAt(t.route, t.s); if (!inArea(p)) continue; seen.add(t); const g = segAt(t.route, Math.max(0, Math.min(t.route.total, t.s)));
    rows.push(t.no + (Math.sign(g.bx - g.ax) > 0 ? '→' : '←') + ' x' + p.x.toFixed(0) + ',y' + p.y.toFixed(0) + ' e' + g.e + (edgeStation[g.e] >= 0 ? '(' + ST[edgeStation[g.e]].name.slice(0, 3) + ')' : '') + (t.dwelling ? '停' : '') + (t.tgt - t.s > 8 ? ' 遅' + (t.tgt - t.s).toFixed(0) : '')); }
  console.log(hs(T), rows.join('  |  '));
}
for (const t of seen) console.log(t.no, TYPES[t.type].name, t.names[0] + '>' + t.names[t.names.length - 1], t.ev.filter(e => ['印旛日本医大', '成田湯川', '根古屋信号場', '空港第2ビル', '成田空港'].includes(e.name)).map(e => e.name + ' ' + hs(t.A[t.ev.indexOf(e) + t.k0]) + '-' + hs(t.P[t.ev.indexOf(e) + t.k0]).slice(3) + (e.thru ? 'T' : '') + (e.meet ? 'M' : '') + ' e' + t.route.stopE[t.ev.indexOf(e) + t.k0]).join(' | '), 'pass', (t.pass || []).filter(w => ['成田湯川', '根古屋信号場'].includes(w.name)).map(w => w.name + hs(w.t)).join(','));
const nk = stByName.get('根古屋信号場'); console.log('straight e' + nk.sigStraight, 'siding e' + nk.sigSiding);
`);
