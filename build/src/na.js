// 京成成田で折り返す列車: 着く線と出る線が同じか
const fs = require('fs');
const D = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const TT = JSON.parse(fs.readFileSync('tt.json', 'utf8'));
const hm = m => String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
const day = process.argv[2] || 'wd', STN = process.argv[3] || '京成成田';
eval(fs.readFileSync('src/core.js', 'utf8') + fs.readFileSync('src/ttcore.js', 'utf8') + `
const list = TT[day].map(ttDecode).filter(t => t.ev.length > 1); ttOvertakes(list); ttCouple(list, day); ttLink(list); list.sort((a, b) => a.start - b.start);
const pl = ttPlanner(true); list.forEach(pl.pre); list.forEach(pl.plan); pl.finish();
const st = stByName.get(STN), es = [...new Set(st.stops.map(([e]) => e))].sort((a, b) => N[E[a].a].y - N[E[b].a].y), ln = e => es.indexOf(e) >= 0 ? '線' + (es.indexOf(e) + 1) : 'e' + e;
const des = t => t.no + ' ' + TYPES[t.type].name + ' ' + t.names[0] + hm(t.ev[0].dep) + '→' + t.names[t.names.length - 1] + hm(t.ev[t.ev.length - 1].arr);
const c = { 折り返し: 0, 同じ線: 0, 違う線: 0, 着いて消える: 0, 現れて出る: 0 };
for (const a of list.filter(t => t.route && !t.exitEnd && t.names[t.names.length - 1] === STN).sort((x, y) => x.ev[x.ev.length - 1].arr - y.ev[y.ev.length - 1].arr)) { const ea = a.route.stopE[a.names.length - 1], d = a.next;
  if (!d || !d.route) { c.着いて消える++; console.log('  消える', hm(a.ev[a.ev.length - 1].arr), des(a), ln(ea), a.tail ? '(引上線・車庫へ)' : ''); continue; }
  const ed = d.route.stopE[0]; c.折り返し++; if (ea === ed || a.tail) c.同じ線++; else { c.違う線++; console.log('  違う線', des(a), ln(ea), '→', des(d), ln(ed)); }
  if (a.type === 'kaitoku' || d.type === 'kaitoku') console.log('  快特', hm(a.ev[a.ev.length - 1].arr), des(a), ln(ea), a.tail ? '引上線' : '', '→', des(d), ln(ed)); }
for (const d of list.filter(t => t.route && !t.exitStart && t.names[0] === STN && !t.prev)) { c.現れて出る++; console.log('  現れる', hm(d.ev[0].dep), des(d), ln(d.route.stopE[0]), d.fromSiding ? '(引上線・車庫から)' : ''); }
console.log('==', day, STN, JSON.stringify(c));
`);
