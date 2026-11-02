const fs = require('fs');
const D = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const TT = JSON.parse(fs.readFileSync('tt.json', 'utf8'));
eval(fs.readFileSync('src/core.js', 'utf8') + fs.readFileSync('src/ttcore.js', 'utf8') + `
for (const day of ['wd', 'hd']) { const list = TT[day].map(ttDecode).filter(t => t.ev.length > 1); ttOvertakes(list); ttCouple(list, day); ttLink(list); list.sort((a, b) => a.start - b.start);
  const pl = ttPlanner(true); list.forEach(pl.pre); list.forEach(pl.plan); pl.finish();
  const S = '西馬込', arr = list.filter(t => t.names[t.names.length - 1] === S), dep = list.filter(t => t.names[0] === S);
  const c = { run: 0, time: 0, sid: 0, plat: 0, dout: 0, vanish: 0, din: 0, appear: 0, same: 0 };
  for (const a of arr) { if (a.next) { if (a.runLink) c.run++; else c.time++; if (a.tail) c.sid++; else c.plat++; if (ttRunOf(a).key && ttRunOf(a).key === ttRunOf(a.next).key) c.same++; } else if (a.deadOut || a.tail) c.dout++; else c.vanish++; }
  for (const d of dep) if (!d.prev) { if (d.deadIn || d.fromSiding) c.din++; else c.appear++; }
  console.log(day, S, 'arr', arr.length, 'dep', dep.length, JSON.stringify(c)); }
`);
