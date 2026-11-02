const fs = require('fs');
const D = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const TT = JSON.parse(fs.readFileSync('tt.json', 'utf8'));
eval(fs.readFileSync('src/core.js', 'utf8') + fs.readFileSync('src/ttcore.js', 'utf8') + `
for (const day of ['wd', 'hd']) { const list = TT[day].map(ttDecode).filter(t => t.ev.length > 1); const OT = ttOvertakes(list); ttCouple(list, day); ttLink(list); list.sort((a, b) => a.start - b.start);
  const pl = ttPlanner(true); list.forEach(pl.pre); list.forEach(pl.plan); pl.finish();
  const IB = '印旛日本医大', st = list.filter(t => t.names[0] === IB && t.names[1] === '印西牧の原'), ln = list.filter(t => { const q = t.names.indexOf(IB); return q > 0 && t.ev[q].thru && OT_LINES[2].indexOf(t.names[q + 1]) < OT_LINES[2].indexOf(IB); });
  let bad = 0, near = 0, ng = 0;
  for (const s of st) { const D = s.P[s.k0]; for (const l of ln) { const x = l.A[l.names.indexOf(IB) + l.k0]; if (x > D && x < D + 300) { bad++; const q = s.names.indexOf('新鎌ヶ谷'); if (q > 0 && s.ev[q].ot) ng++; } if (x <= D && x > D - 300) near++; } }
  console.log(day, '印旛日本医大始発の上り', st.length, '本 / 上りスカイライナー', ln.length, '本 | 発車前5分以内にライナーが通過', near, '| 発車後5分以内に通過(後ろから追う形)', bad, 'うち新鎌ヶ谷で待避', ng, '| ずらした本数', OT.thruShift); }
`);
