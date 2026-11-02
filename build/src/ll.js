// 同じ運行番号で続く2本のうち、両数が変わる組を全部出す
const fs = require('fs');
const D = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const TT = JSON.parse(fs.readFileSync('tt.json', 'utf8'));
const hm = m => String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
eval(fs.readFileSync('src/core.js', 'utf8') + fs.readFileSync('src/ttcore.js', 'utf8') + `
for (const day of ['wd', 'hd']) { const list = TT[day].map(ttDecode).filter(t => t.ev.length > 1); ttOvertakes(list); ttCouple(list, day); ttLink(list);
  const endCars = x => { if (!x.cpl) return x.cars; const q = x.names.indexOf('品川'); return x.cpl.side === 'front' && q > x.cpl.i && q < x.names.length - 1 ? x.cars : 12; };
  const g = new Map(); for (const t of list) { const k = ttRunOf(t).key; if (k) (g.get(k) || g.set(k, []).get(k)).push(t); }
  const rows = [], cnt = {};
  for (const [k, l] of g) { l.sort((a, b) => a.ev[0].dep - b.ev[0].dep);
    for (let i = 1; i < l.length; i++) { const a = l[i - 1], b = l[i], ca = endCars(a), cb = b.cars; if (ca === cb || (b.added4 && b.prev === a)) continue;
      const key = ca + '→' + cb; cnt[key] = (cnt[key] || 0) + 1;
      if (ca === 6 && cb === 4) rows.push([a.ev[a.ev.length - 1].arr, k, a, b]); } }
  console.log('==', day, JSON.stringify(cnt));
  rows.sort((x, y) => x[0] - y[0]).forEach(([_, k, a, b]) => { const ea = a.ev[a.ev.length - 1], same = ea.name === b.ev[0].name;
    console.log([k, a.no, TYPES[a.type].name, a.names[0] + ' ' + hm(a.ev[0].dep), ea.name + ' ' + hm(ea.arr), b.no, TYPES[b.type].name, b.ev[0].name + ' ' + hm(b.ev[0].dep), b.names[b.names.length - 1] + ' ' + hm(b.ev[b.ev.length - 1].arr), same ? (b.ev[0].dep - ea.arr) + '分' : '駅が違う'].join(' | ')); }); }
`);
