// 京成高砂→京成上野の上り列車(青砥・日暮里・上野の時刻): node src/du.js wd 6:30 8:30
const fs = require('fs');
const D = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const TT = JSON.parse(fs.readFileSync('tt.json', 'utf8'));
const [day, F0, F1] = [process.argv[2] || 'wd', process.argv[3] || '6:30', process.argv[4] || '8:30'];
const hm = x => { const [h, m] = x.split(':'); return h * 3600 + m * 60; }, hs = s => String(Math.floor(s / 3600)).padStart(2, '0') + ':' + String(Math.floor(s / 60) % 60).padStart(2, '0') + ':' + String(Math.round(s) % 60).padStart(2, '0');
eval(fs.readFileSync('src/core.js', 'utf8') + fs.readFileSync('src/ttcore.js', 'utf8') + `
const list = TT[day].map(ttDecode).filter(t => t.ev.length > 1); ttOvertakes(list); ttCouple(list, day); ttLink(list);
const rows = []; for (const t of list) { const i = t.names.indexOf('京成上野'), j = t.names.indexOf('京成高砂'), k = t.names.indexOf('日暮里'), a = t.names.indexOf('青砥'); if (j < 0 || i < 0 || i > j) continue; const x = t.P[i + t.k0]; if (x < hm(F0) || x > hm(F1)) continue;
  rows.push([x, t.no + ' ' + (t.dh ? '回送' : t.type) + ' 上野' + hs(x) + ' 青砥' + (a >= 0 ? hs(t.P[a + t.k0]) : '-') + ' 日暮里' + (k >= 0 ? hs(t.A[k + t.k0]) : '-') + ' 高砂' + hs(t.A[j + t.k0]) + ' 停車' + (j - i)]); }
rows.sort((a, b) => a[0] - b[0]).forEach(r => console.log(r[1]));
`);
