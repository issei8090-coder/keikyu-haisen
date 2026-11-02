// 指定した列車の動きを時間を追って出す: node src/lv.js wd 1184K,1132T 10:58 11:02 [刻み秒]
const fs = require('fs');
const D = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const TT = JSON.parse(fs.readFileSync('tt.json', 'utf8'));
const hs = s => String(Math.floor(s / 3600) % 24).padStart(2, '0') + ':' + String(Math.floor(s / 60) % 60).padStart(2, '0') + ':' + String(Math.floor(s % 60)).padStart(2, '0');
const sec = x => { const [h, m] = x.split(':'); return h * 3600 + m * 60; };
const day = process.argv[2], NOS = process.argv[3].split(','), T0 = sec(process.argv[4]), T1 = sec(process.argv[5]), STEP = +(process.argv[6] || 10), DT = 2;
eval(fs.readFileSync('src/core.js', 'utf8') + fs.readFileSync('src/ttcore.js', 'utf8') + `
const list = TT[day].map(ttDecode).filter(t => t.ev.length > 1); ttOvertakes(list); ttCouple(list, day); ttLink(list); list.sort((a, b) => a.start - b.start);
const pl = ttPlanner(true); list.forEach(pl.pre); list.forEach(pl.plan); pl.finish(); list.push(...pl.units); list.sort((a, b) => a.start - b.start);
let ptr = 0, act = [], lastT = NaN;
const at = (t, s) => { const g = segAt(t.route, Math.max(0, Math.min(t.route.total, s))), p = posAt(t.route, s); return 'e' + g.e + (g.d ? '<' : '>') + ' (' + p.x.toFixed(0) + ',' + p.y.toFixed(0) + ')' + (edgeStation[g.e] >= 0 ? ST[edgeStation[g.e]].name : ''); };
for (const no of NOS) { const t = list.find(t => t.no === no && !t.unit); if (!t || !t.route) continue; const seen = []; for (const g of t.route.segs) { const d = g.e + (g.d ? '<' : '>'); if (seen[seen.length - 1] !== d) seen.push(d); }
  console.log(no, 'stopD', t.route.stopD.map(d => d.toFixed(0)).join(','), 'total', t.route.total.toFixed(0), 'A', t.A.map(hs).join(','), 'P', t.P.map(hs).join(',')); console.log('   edges', seen.slice(0, 40).join(' ')); }
for (let T = Math.min(4.4 * 3600, T0 - 3600); T < T1; T += DT) {
  while (ptr < list.length && list[ptr].start <= T) act.push(list[ptr++]);
  act = act.filter(t => { if (ttTarget(t, T)) return true; t.sv = null; return false; });
  ttFollow(act, T, lastT); lastT = T;
  if (T < T0 || (T - T0) % STEP) continue;
  for (const t of act) if (NOS.includes(t.no) && !t.unit) console.log(hs(T), t.no, 's', t.s.toFixed(0), 'tgt', t.tgt.toFixed(0), at(t, t.s), t.dwelling ? 'dwell' : '', t.hold ? 'hold' : '', t.blk ? 'blk' + t.blk.toFixed(0) + ' by ' + t.blkBy.no + ' ' + at(t.blkBy, t.blkBy.s) : '');
}
`);
