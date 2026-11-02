// 成田空港のホームと単線の使われ方を時刻順に出す: node src/de.js wd 10:40 11:30
const fs = require('fs');
const D = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const TT = JSON.parse(fs.readFileSync('tt.json', 'utf8'));
const day = process.argv[2] || 'wd', hm = s => { const [h, m] = s.split(':'); return h * 3600 + m * 60; }, T0 = hm(process.argv[3]), T1 = hm(process.argv[4]);
eval(fs.readFileSync('src/core.js', 'utf8') + fs.readFileSync('src/ttcore.js', 'utf8') + `
const hs = s => String(Math.floor(s / 3600) % 24).padStart(2, '0') + ':' + String(Math.floor(s / 60) % 60).padStart(2, '0') + ':' + String(Math.floor(s % 60)).padStart(2, '0');
const list = TT[day].map(ttDecode).filter(t => t.ev.length > 1); ttOvertakes(list); ttCouple(list, day); ttLink(list);
const rows = [];
for (const t of list) { const q = t.names.indexOf('成田空港'), q2 = t.names.indexOf('空港第2ビル'); if (q < 0) continue; const n = t.names.length;
  const a = t.A[q + t.k0], p = t.P[q + t.k0]; const x = q === n - 1 ? a : p; if (x < T0 || x > T1) continue;
  rows.push([x, (q === n - 1 ? '着 ' : '発 ') + hs(x) + ' ' + t.no + ' ' + t.type + (t.dh ? '(回送)' : '') + ' ' + t.names[0] + '>' + t.names[n - 1] + ' 第2ビル ' + (q2 >= 0 ? hs(t.A[q2 + t.k0]) + '/' + hs(t.P[q2 + t.k0]) : '-') + ' 線' + (t.forceEnd != null ? t.forceEnd : (t.prev && t.prev.forceEnd != null ? t.prev.forceEnd : '?')) + ' 前' + (t.prev ? t.prev.no + (t.prev.dh ? '回' : '') : '-') + ' 次' + (t.next ? t.next.no + (t.next.dh ? '回' : '') : '-') + ' ' + (t.dhCat || '')]); }
rows.sort((a, b) => a[0] - b[0]); for (const r of rows) console.log(r[1]);
console.log(JSON.stringify(list.dhJobs.filter(j => j.ta < T1 && j.td > T0)));
`);
