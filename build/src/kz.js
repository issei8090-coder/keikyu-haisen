const fs = require('fs');
const D = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const TT = JSON.parse(fs.readFileSync('tt.json', 'utf8'));
function hs(s) { s = Math.floor(s); return String(Math.floor(s / 3600) % 24).padStart(2, '0') + ':' + String(Math.floor(s / 60) % 60).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }
const day = process.argv[2], NOS = process.argv[3].split(',');
eval(fs.readFileSync('src/core.js', 'utf8') + fs.readFileSync('src/ttcore.js', 'utf8') + `
const DT = 2;
const list = TT[day].map(ttDecode).filter(t => t.ev.length > 1); ttOvertakes(list); ttCouple(list, day); ttLink(list); list.sort((a, b) => a.start - b.start);
const pl = ttPlanner(true); list.forEach(pl.pre); list.forEach(pl.plan); pl.finish(); list.push(...pl.units); list.sort((a, b) => a.start - b.start);
let ptr = 0, act = [], lastT = NaN;
const nameAt = (t, s) => { const g = segAt(t.route, Math.max(0, Math.min(t.route.total, s))); return (edgeStation[g.e] >= 0 ? ST[edgeStation[g.e]].name : '駅間') + ' e' + g.e; };
for (let T = 4.4 * 3600; T < 25.6 * 3600; T += DT) {
  while (ptr < list.length && list[ptr].start <= T) act.push(list[ptr++]);
  act = act.filter(t => ttTarget(t, T));
  ttFollow(act, T, lastT); lastT = T;
  for (const t of act) { if (!NOS.includes(t.no)) continue; const lag = t.tgt - t.s, st = (lag > 12 ? 'L' : '') + (t.hold ? 'H' : '') + (t.blkBy && lag > 12 ? t.blkBy.no : '');
    if (st !== t.pst) { console.log(hs(T), t.no, 'lag', lag.toFixed(0), '@' + nameAt(t, t.s), t.hold ? 'HOLD' : '', lag > 12 && t.blkBy ? 'by ' + t.blkBy.no + ' ' + t.blkBy.names[0] + '>' + t.blkBy.names[t.blkBy.names.length - 1] + ' @' + nameAt(t.blkBy, t.blkBy.s) + (t.blkBy.dwelling ? ' dwell' : '') + ' blk' + (t.blk || 0) : ''); t.pst = st; } }
}
`);
