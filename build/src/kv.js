const fs = require('fs');
const D = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const TT = JSON.parse(fs.readFileSync('tt.json', 'utf8'));
function hs(s) { s = Math.floor(s); return String(Math.floor(s / 3600) % 24).padStart(2, '0') + ':' + String(Math.floor(s / 60) % 60).padStart(2, '0'); }
eval(fs.readFileSync('src/core.js', 'utf8') + fs.readFileSync('src/ttcore.js', 'utf8') + `
for (const day of ['wd', 'hd']) { const list = TT[day].map(ttDecode).filter(t => t.ev.length > 1); ttOvertakes(list); ttCouple(list, day); ttLink(list); list.sort((a, b) => a.start - b.start);
  const pl = ttPlanner(true); list.forEach(pl.pre); list.forEach(pl.plan); pl.finish();
  const L1 = OT_LINES[1], L2 = OT_LINES[2], OSH = new Set(L2.slice(0, L2.indexOf('青砥'))), UEN = new Set(L1.slice(0, L1.indexOf('青砥')));
  console.log('==', day);
  for (const stn of ['京成高砂', '青砥']) {
    const s = stByName.get(stn), es = [...new Set(s.stops.map(([e]) => e))].sort((a, b) => N[E[a].a].y - N[E[b].a].y), lab = e => '上から' + (es.indexOf(e) + 1) + '本目';
    const c = {}, rows = [];
    for (const t of list) { if (!t.route) continue; const q = t.names.indexOf(stn); if (q < 0) continue;
      const after = t.names.slice(q + 1), before = t.names.slice(0, q);
      const to = after.some(n => OSH.has(n)) ? '押上方面へ' : after.some(n => UEN.has(n)) ? '上野方面へ' : null;
      const from = before.some(n => OSH.has(n)) ? '押上方面から' : before.some(n => UEN.has(n)) ? '上野方面から' : null;
      const e = t.route.stopE[q + t.k0], th = t.ev[q].thru ? '(通過)' : '';
      if (to) { const k = '上り ' + to + th + ' ' + lab(e); c[k] = (c[k] || 0) + 1; if (!th) rows.push({ t, to, e, a: t.A[q + t.k0], d: t.P[q + t.k0] }); }
      else if (from) { const k = '下り ' + from + th + ' ' + lab(e); c[k] = (c[k] || 0) + 1; } }
    console.log(stn); Object.keys(c).sort().forEach(k => console.log('   ', k, c[k]));
    let pair = 0, same = 0, sim = 0; const ex = [];
    for (const x of rows) for (const y of rows) { if (x.to !== '上野方面へ' || y.to !== '押上方面へ') continue;
      if (Math.min(x.d, y.d) - Math.max(x.a, y.a) < 20) continue; pair++; if (x.e === y.e) { same++; if (ex.length < 3) ex.push(hs(x.a) + ' ' + x.t.no + '/' + y.t.no); } if (Math.abs(x.a - y.a) <= 60 && Math.abs(x.d - y.d) <= 60) sim++; }
    console.log('    上り: 上野行きと押上行きが同時に止まっている組', pair, ' うち到着も発車も1分以内でそろう', sim, ' 同じ線に入ってしまった', same, ex.join(' '));
  } }
`);
