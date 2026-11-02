// 待避の一覧を書き出す(変更の前後を比べる用): node src/lu.js > 出力先
const fs = require('fs');
const D = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const TT = JSON.parse(fs.readFileSync('tt.json', 'utf8'));
const hm = m => String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
eval(fs.readFileSync('src/core.js', 'utf8') + fs.readFileSync('src/ttcore.js', 'utf8') + `
for (const day of ['wd', 'hd']) { const list = TT[day].map(ttDecode).filter(t => t.ev.length > 1); ttOvertakes(list);
  for (const t of list) t.ev.forEach(e => { if (e.ot || e.wait) console.log(day, t.no, TYPES[t.type].name, e.name, e.wait ? '通過待ち' : '待避', hm(e.arr) + '-' + hm(e.dep), (e.otBy || []).map(b => b.no).join(',')); }); }
`);
