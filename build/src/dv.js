// 京成上野の各番線にいる列車(時刻順): node src/dv.js wd 6:00 9:30
const fs = require('fs');
const D = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const TT = JSON.parse(fs.readFileSync('tt.json', 'utf8'));
const [day, F0, F1] = [process.argv[2] || 'wd', process.argv[3] || '6:00', process.argv[4] || '9:30'];
const hm = x => { const [h, m] = x.split(':'); return +h * 60 + +m; }, hs = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
eval(fs.readFileSync('src/core.js', 'utf8') + fs.readFileSync('src/ttcore.js', 'utf8') + `
const list = TT[day].map(ttDecode).filter(t => t.ev.length > 1); ttOvertakes(list); ttCouple(list, day); ttLink(list);
const es = [...new Set(stByName.get('京成上野').stops.map(([e]) => e))].sort((a, b) => N[E[a].a].y - N[E[b].a].y);
for (const t of list) { const n = t.names.length; if (t.names[n - 1] !== '京成上野') continue; const a = t.ev[n - 1].arr, d = t.next ? t.next.ev[0].dep : a; if (d < hm(F0) || a > hm(F1)) continue;
  console.log((es.indexOf(t.forceEnd) + 1) + '番線', hs(a), '-', hs(d), t.no, t.dh ? '回送' : t.type, '→', t.next ? t.next.no : '-'); }
`);
