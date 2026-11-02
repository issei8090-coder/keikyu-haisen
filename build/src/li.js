// 運行番号で続く2本(同じ駅でつながるもの)のうち、図の上の折り返しも同じ相手になっている割合を、駅ごとに出す
const fs = require('fs');
const D = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const TT = JSON.parse(fs.readFileSync('tt.json', 'utf8'));
eval(fs.readFileSync('src/core.js', 'utf8') + fs.readFileSync('src/ttcore.js', 'utf8') + `
for (const day of ['wd', 'hd']) { const list = TT[day].map(ttDecode).filter(t => t.ev.length > 1); ttOvertakes(list); ttCouple(list, day); ttLink(list);
  const g = new Map(); for (const t of list) { const k = ttRunOf(t).key; if (k) (g.get(k) || g.set(k, []).get(k)).push(t); }
  const st = {}; let n = 0, ok = 0;
  for (const l of g.values()) { l.sort((a, b) => a.ev[0].dep - b.ev[0].dep);
    for (let i = 1; i < l.length; i++) { const a = l[i - 1], b = l[i], s = a.ev[a.ev.length - 1].name; if (s !== b.ev[0].name || b.ev[0].dep < a.ev[a.ev.length - 1].arr) continue;
      const gap = b.ev[0].dep - a.ev[a.ev.length - 1].arr, o = st[s] || (st[s] = { n: 0, ok: 0, long: 0 }); o.n++; n++; if (a.next === b) { o.ok++; ok++; } else if (gap > 30) o.long++; } }
  console.log(day, '運行番号で同じ駅につながる組', n, ' 図の折り返しも同じ相手', ok, '(' + Math.round(ok / n * 100) + '%)');
  console.log('   ', Object.entries(st).sort((a, b) => (b[1].n - b[1].ok) - (a[1].n - a[1].ok)).slice(0, 12).map(([k, o]) => k + ' ' + o.ok + '/' + o.n + (o.long ? '(30分超' + o.long + ')' : '')).join('  ')); }
`);
