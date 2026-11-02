const fs = require('fs');
const D = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const TT = JSON.parse(fs.readFileSync('tt.json', 'utf8'));
function hs(s) { s = Math.floor(s); return String(Math.floor(s / 3600) % 24).padStart(2, '0') + ':' + String(Math.floor(s / 60) % 60).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }
const day = process.argv[2] || 'wd';
eval(fs.readFileSync('src/core.js', 'utf8') + fs.readFileSync('src/ttcore.js', 'utf8') + `
const DT = 2;
const list = TT[day].map(ttDecode).filter(t => t.ev.length > 1); ttOvertakes(list); ttCouple(list, day); ttLink(list); list.sort((a, b) => a.start - b.start);
const pl = ttPlanner(true); list.forEach(pl.pre); list.forEach(pl.plan); pl.finish(); list.push(...pl.units); list.sort((a, b) => a.start - b.start);
list.forEach((t, i) => t.id = i);
let ptr = 0, act = [], lastT = NaN; const ev = new Map(), cnt = {};
for (let T = 4.4 * 3600; T < 25.6 * 3600; T += DT) {
  while (ptr < list.length && list[ptr].start <= T) act.push(list[ptr++]);
  act = act.filter(t => ttTarget(t, T));
  ttFollow(act, T, lastT); lastT = T;
  const near = [];
  for (const t of act) { const p = posAt(t.route, t.s); if (p.x < 75 && p.y > 1040 && p.y < 1095) { const g = segAt(t.route, Math.max(0, Math.min(t.route.total, t.s))); near.push({ t, p, e: g.e, dir: Math.sign(g.bx - g.ax) }); } }
  for (const a of near) for (const b of near) { if (a.t.id >= b.t.id || a.t === b.t) continue; if (a.t.next === b.t || b.t.next === a.t) continue;
    if (Math.hypot(a.p.x - b.p.x, a.p.y - b.p.y) < 6) { const k = a.t.no + '/' + b.t.no; if (!ev.has(k)) { ev.set(k, hs(T) + ' ' + a.t.no + (a.dir > 0 ? '→' : '←') + ' / ' + b.t.no + (b.dir > 0 ? '→' : '←') + ' e' + a.e + '/e' + b.e + ' x' + a.p.x.toFixed(0) + ',y' + a.p.y.toFixed(0) + (a.t.dwelling ? ' 停' : '') + (b.t.dwelling ? ' 停' : '')); const kk = (a.e === b.e ? 'same ' : 'cross ') + (edgeStation[a.e] >= 0 ? 'platform' : 'throat'); cnt[kk] = (cnt[kk] || 0) + 1; } } }
}
list.forEach((t, i) => t.id = i);
console.log(day, JSON.stringify(cnt), ev.size); [...ev.values()].slice(0, 14).forEach(x => console.log('  ', x));
`);
