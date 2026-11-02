const fs = require('fs');
const D = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const TT = JSON.parse(fs.readFileSync('tt.json', 'utf8'));
function hs(s) { s = Math.floor(s); return String(Math.floor(s / 3600) % 24).padStart(2, '0') + ':' + String(Math.floor(s / 60) % 60).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }
eval(fs.readFileSync('src/core.js', 'utf8') + fs.readFileSync('src/ttcore.js', 'utf8') + `
const day = 'wd', DT = 2;
const list = TT[day].map(ttDecode).filter(t => t.ev.length > 1); ttOvertakes(list); ttCouple(list, day); ttLink(list); list.sort((a, b) => a.start - b.start);
const pl = ttPlanner(true); list.forEach(pl.pre); list.forEach(pl.plan); pl.finish(); list.push(...pl.units); list.sort((a, b) => a.start - b.start);
let ptr = 0, act = [], lastT = NaN; const ev = [], cnt = {};
const nameAt = (t, s) => { const g = segAt(t.route, Math.max(0, Math.min(t.route.total, s))); return edgeStation[g.e] >= 0 ? ST[edgeStation[g.e]].name : '駅間'; };
for (let T = 4.4 * 3600; T < 25.6 * 3600; T += DT) {
  while (ptr < list.length && list[ptr].start <= T) act.push(list[ptr++]);
  act = act.filter(t => { if (ttTarget(t, T)) return true; t.ps = null; return false; });
  ttFollow(act, T, lastT); lastT = T;
  for (const t of act) { if (t.blkBy && t.blk > 0) { const b = t.blkBy; t.lastBy = b.no + ' ' + TYPES[b.type].name + ' ' + b.names[0] + '>' + b.names[b.names.length - 1] + ' e' + segAt(b.route, Math.max(0, Math.min(b.route.total, b.s))).e + (b.dwelling ? ' dwell' : '') + ' @' + hs(T); } const y = posAt(t.route, t.s).y; if (y < 1020) { t.ps = t.s; continue; }
    if (t.ps != null) { const v = (t.s - t.ps) / DT; if (v > 5 || v < -0.5) { const k = (v < 0 ? 'back ' : v > 20 ? 'jump ' : 'fast ') + nameAt(t, t.s); cnt[k] = (cnt[k] || 0) + 1; if (!t.rep) { t.rep = 1; ev.push(v.toFixed(1) + 'px/s ' + hs(T) + ' ' + t.no + ' ' + TYPES[t.type].name + ' ' + t.names[0] + '>' + t.names[t.names.length - 1] + ' @' + nameAt(t, t.s) + ' lag ' + (t.tgt - t.s).toFixed(0) + (t.lastBy ? ' by ' + t.lastBy : '')); } } }
    t.ps = t.s; }
}
console.log(Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 40).map(x => x.join(':')).join('  '));
console.log(ev.length); ev.slice(0, 40).forEach(x => console.log(x));
`);
