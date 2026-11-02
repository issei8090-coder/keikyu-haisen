// 列車の停車・通過時刻を出す: node src/dg.js wd 17AE13 18AE32
const fs = require('fs');
const D = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const TT = JSON.parse(fs.readFileSync('tt.json', 'utf8'));
const day = process.argv[2] || 'wd', nos = process.argv.slice(3);
eval(fs.readFileSync('src/core.js', 'utf8') + fs.readFileSync('src/ttcore.js', 'utf8') + `
const hs = s => String(Math.floor(s / 3600) % 24).padStart(2, '0') + ':' + String(Math.floor(s / 60) % 60).padStart(2, '0') + ':' + String(Math.floor(s % 60)).padStart(2, '0');
const list = TT[day].map(ttDecode).filter(t => t.ev.length > 1); ttOvertakes(list); ttCouple(list, day); ttLink(list);
for (const t of list) { if (!nos.includes(t.no)) continue; console.log('==', t.no, t.type, t.dh ? '回送' : '', t.names[0], '>', t.names[t.names.length - 1]);
  console.log('  ' + t.ev.map((e, i) => e.name + ' ' + hs(t.A[i + t.k0]) + '/' + hs(t.P[i + t.k0]) + (e.thru ? ' 通' : '') + (e.ot ? ' 抜かれ' : '') + (e.wait ? ' 待' : '') + (e.sid != null ? ' sid=' + e.sid : '')).join(String.fromCharCode(10) + '  '));
  if (t.pass) console.log('  pass ' + t.pass.map(w => w.name + ' ' + hs(w.t)).join(', ')); }
`);
