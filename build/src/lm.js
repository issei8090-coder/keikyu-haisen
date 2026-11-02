// 6両→4両の組が、いま図の上でどう扱われているか(着いた6両はどうなるか、出る4両はどこから来るか)
const fs = require('fs');
const D = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const TT = JSON.parse(fs.readFileSync('tt.json', 'utf8'));
const hm = m => String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
eval(fs.readFileSync('src/core.js', 'utf8') + fs.readFileSync('src/ttcore.js', 'utf8') + `
for (const day of ['wd', 'hd']) { const list = TT[day].map(ttDecode).filter(t => t.ev.length > 1); ttOvertakes(list); ttCouple(list, day); ttLink(list); list.sort((a, b) => a.start - b.start);
  const pl = ttPlanner(true); list.forEach(pl.pre); list.forEach(pl.plan); pl.finish();
  const g = new Map(); for (const t of list) { const k = ttRunOf(t).key; if (k) (g.get(k) || g.set(k, []).get(k)).push(t); }
  const c = { a: {}, b: {} }; const ex = [];
  for (const [k, l] of g) { l.sort((a, b) => a.ev[0].dep - b.ev[0].dep);
    for (let i = 1; i < l.length; i++) { const a = l[i - 1], b = l[i]; if (a.cpl || a.cars === b.cars || !((a.cars === 6 && b.cars === 4) || (a.cars === 4 && b.cars === 6))) continue;
      const st = a.ev[a.ev.length - 1].name; if (st !== b.ev[0].name) continue;
      const ka = a.next ? '別の列車として折り返す(' + a.next.cars + '両 ' + a.next.no + ' ' + hm(a.next.ev[0].dep) + '発)' : a.tail || a.deadOut ? '引上線・車庫へ' : 'ホームで消える';
      const kb = b.prev ? '別の列車から折り返す(' + b.prev.cars + '両 ' + b.prev.no + ' ' + hm(b.prev.ev[b.prev.ev.length - 1].arr) + '着)' : b.fromSiding || b.deadIn ? '引上線・車庫から' : 'ホームに現れる';
      const s = x => x.replace(/\\(.*\\)/, ''); c.a[st + ' ' + a.cars + '両: ' + s(ka)] = (c.a[st + ' ' + a.cars + '両: ' + s(ka)] || 0) + 1; c.b[st + ' ' + b.cars + '両: ' + s(kb)] = (c.b[st + ' ' + b.cars + '両: ' + s(kb)] || 0) + 1;
      if (ex.length < 6) ex.push(k + ' ' + st + ' | ' + a.no + '(' + a.cars + '両 ' + hm(a.ev[a.ev.length - 1].arr) + '着) → ' + ka + ' | ' + b.no + '(' + b.cars + '両 ' + hm(b.ev[0].dep) + '発) ← ' + kb); } }
  console.log('==', day); console.log('着いた列車:', JSON.stringify(c.a)); console.log('出る列車:', JSON.stringify(c.b)); ex.forEach(x => console.log('  ', x)); }
`);
