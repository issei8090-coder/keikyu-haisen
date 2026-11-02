const fs = require('fs');
const D = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const TT = JSON.parse(fs.readFileSync('tt.json', 'utf8'));
function hm(m) { return String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); }
const VERB = process.argv[2] ? +process.argv[2] : 12;
eval(fs.readFileSync('src/core.js', 'utf8') + fs.readFileSync('src/ttcore.js', 'utf8') + `
for (const day of ['wd', 'hd']) {
  const list = TT[day].map(ttDecode).filter(t => t.ev.length > 1);
  const OT = ttOvertakes(list); ttCouple(list, day); ttLink(list); list.sort((a, b) => a.start - b.start);
  const pl = ttPlanner(true); list.forEach(pl.pre); list.forEach(pl.plan); pl.finish(); const UNITS = pl.units;
  const kinds = {}; let shown = 0; const bad = new Set();
  const flag = (t, kind, msg) => { kinds[kind] = (kinds[kind] || 0) + 1; bad.add(t); if (shown++ < VERB) console.log('  [' + kind + ']', t.no || '(番号なし)', TYPES[t.type].name, t.names[0], hm(t.ev[0].dep), '→', t.names[t.names.length - 1], '|', msg); };
  for (const t of list) {
    if (!t.route) { flag(t, 'no-route', ''); continue; }
    const sd = t.route.stopD, m = Math.min(sd.length, t.A.length);
    // 基準: 占有・折り返しを考えない素直な経路
    const base = buildTimedRoute(t.names, t.long, { exitStart: t.exitStart, exitEnd: t.exitEnd });
    const label = k => { const i = k - t.k0; return i < 0 ? '(入線)' : i >= t.names.length ? '(引上/出口)' : t.names[i]; };
    for (let k = 0; k + 1 < m; k++) {
      const dist = sd[k + 1] - sd[k], dt = t.A[k + 1] - t.P[k], v = dist / dt;
      const i = k - t.k0;
      const bd = base && i >= 0 && i + 1 < t.names.length ? base.stopD[k + 1 - t.k0 + (t.exitStart ? 1 : 0)] - base.stopD[k - t.k0 + (t.exitStart ? 1 : 0)] : null;
      if (dt <= 0) flag(t, 'time<=0', label(k) + '→' + label(k + 1) + ' dt=' + dt);
      else if (v > 6) flag(t, 'too-fast', label(k) + '→' + label(k + 1) + ' ' + dist.toFixed(0) + 'px in ' + dt.toFixed(0) + 's (' + hm(Math.floor(t.P[k] / 60)) + ')' + (bd != null ? ' base ' + bd.toFixed(0) + 'px' : ''));
      else if (bd != null && dist > bd * 1.5 + 40) flag(t, 'detour', label(k) + '→' + label(k + 1) + ' ' + dist.toFixed(0) + 'px vs base ' + bd.toFixed(0) + 'px (' + hm(Math.floor(t.P[k] / 60)) + ')');
    }
    // 経路内の折り返し回数
    let rev = 0; const where = [];
    for (let j = 1; j < t.route.segs.length; j++) { const a = t.route.segs[j - 1], b = t.route.segs[j]; if (a.e === b.e && a.d !== b.d) { rev++; where.push(ST[edgeStation[a.e]] ? ST[edgeStation[a.e]].name : '?'); } }
    if (rev >= 2) flag(t, 'multi-reverse', where.join(','));
    // 駅順の逆戻り(同じ駅に2回止まる)
    if (new Set(t.names).size !== t.names.length) flag(t, 'dup-station', t.names.join(' '));
  }
  console.log(day, 'trains', list.length, 'flagged trains', bad.size, JSON.stringify(kinds));
}
`);
