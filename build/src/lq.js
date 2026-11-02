// 運用表を当てはめたあとの様子: 両数を直した列車、逗子・葉山の6両→8両、浦賀の出入り、つながりの数
const fs = require('fs');
const D = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const TT = JSON.parse(fs.readFileSync('tt.json', 'utf8'));
const hm = m => String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
eval(fs.readFileSync('src/core.js', 'utf8') + fs.readFileSync('src/ttcore.js', 'utf8') + `
for (const day of ['wd', 'hd']) { const list = TT[day].map(ttDecode).filter(t => t.ev.length > 1); ttOvertakes(list); ttCouple(list, day); const n = ttLink(list);
  const des = t => t.no + ' ' + TYPES[t.type].name + ' ' + t.names[0] + hm(t.ev[0].dep) + '→' + t.names[t.names.length - 1] + hm(t.ev[t.ev.length - 1].arr) + ' ' + (t.cars0 ? t.cars0 + '→' : '') + t.cars + '両' + (t.ops ? ' [' + t.ops.id + ']' : '');
  console.log('==', day, '列車', list.length, '運用表あり', list.filter(t => t.ops).length, 'つながり', n, '表どおり', list.filter(t => t.opsF).length);
  const c0 = list.filter(t => t.cars0); console.log('両数を8両に直した', c0.length, JSON.stringify(c0.reduce((m, t) => (m[t.cars0] = (m[t.cars0] || 0) + 1, m), {}))); c0.slice(0, 12).forEach(t => console.log('  ', des(t)));
  if (day === 'wd') for (const no of ['1304D', '1000D', '1410D', '1950DX']) { const t = list.find(t => t.no === no); if (t) console.log(' 逗子:', des(t)); }
  console.log(' 浦賀に着く'); list.filter(t => t.names[t.names.length - 1] === '浦賀').slice(0, 40).forEach(t => console.log('  ', des(t), '→', t.next ? des(t.next) : t.swapOut ? '(車両交換)' : '-'));
}
`);
