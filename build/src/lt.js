// 京成高砂での様子: 指定した列車の、高砂の前後の時刻表・計画・入る番線と、同じ時間帯に高砂にいる列車
//   node src/lt.js wd 1008,10A08  [駅名]
const fs = require('fs');
const D = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const TT = JSON.parse(fs.readFileSync('tt.json', 'utf8'));
const hs = s => String(Math.floor(s / 3600) % 24).padStart(2, '0') + ':' + String(Math.floor(s / 60) % 60).padStart(2, '0') + ':' + String(Math.floor(s % 60)).padStart(2, '0');
const hm = m => String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
const day = process.argv[2] || 'wd', NOS = (process.argv[3] || '').split(','), STN = process.argv[4] || '京成高砂';
eval(fs.readFileSync('src/core.js', 'utf8') + fs.readFileSync('src/ttcore.js', 'utf8') + `
const list = TT[day].map(ttDecode).filter(t => t.ev.length > 1); ttOvertakes(list); ttCouple(list, day); ttLink(list); list.sort((a, b) => a.start - b.start);
const pl = ttPlanner(true); list.forEach(pl.pre); list.forEach(pl.plan); pl.finish();
const st = stByName.get(STN), es = [...new Set(st.stops.map(([e]) => e))].sort((a, b) => N[E[a].a].y - N[E[b].a].y);
const platOf = t => { const idx = ST.indexOf(st), o = []; for (const g of t.route.segs) if (edgeStation[g.e] === idx && !o.includes(g.e)) o.push(g.e); return o.map(e => es.indexOf(e) >= 0 ? '線' + (es.indexOf(e) + 1) + '(e' + e + ')' : 'e' + e).join('+'); };
const des = t => t.no + ' ' + TYPES[t.type].name + ' ' + t.names[0] + hm(t.ev[0].dep) + '→' + t.names[t.names.length - 1] + hm(t.ev[t.ev.length - 1].arr) + ' ' + t.cars + '両';
console.log(STN, 'の線(上から):', es.map((e, i) => (i + 1) + '=e' + e + ' y' + N[E[e].a].y).join('  '));
for (const t of list.filter(t => NOS.includes(t.no) && (STN === "-" || t.names.includes(STN)))) {
  const q = t.names.indexOf(STN);
  console.log('==', des(t), '| 前', t.prev ? des(t.prev) : '-', '| 次', t.next ? des(t.next) : '-', '|', ['tail', 'deadOut', 'deadIn', 'fromSiding', 'k0'].map(k => t[k] ? k + '=' + (typeof t[k] === 'object' ? 'obj' : t[k]) : '').filter(Boolean).join(' '));
  if (!t.route) { console.log('  経路なし'); continue; }
  console.log('  ' + STN + ':', platOf(t));
  t.ev.forEach((e, i) => { if (q >= 0 && Math.abs(i - q) > 3) return; const k = i + t.k0; console.log('   ', e.name, '時刻表', hm(e.arr) + '/' + hm(e.dep), '計画', hs(t.A[k]) + '/' + hs(t.P[k]), ['thru', 'wait', 'ot', 'sid'].map(x => e[x] ? x : '').filter(Boolean).join(' '), e.otBy ? 'otBy=' + e.otBy.map(b => b.no).join(',') : ''); });
  if (q >= 0) { const k = q + t.k0, a = t.A[k] - 240, b = t.P[k] + 240;
    for (const o of list) { if (o === t || !o.route) continue; const qq = o.names.indexOf(STN); if (qq < 0) continue; const kk = qq + o.k0; if (o.P[kk] < a || o.A[kk] > b) continue;
      console.log('      同じころ:', des(o), platOf(o), hs(o.A[kk]) + '/' + hs(o.P[kk]), o.ev[qq].thru ? '通過' : '', o.next ? '→' + o.next.no : '', o.prev ? '←' + o.prev.no : ''); } }
}
`);
