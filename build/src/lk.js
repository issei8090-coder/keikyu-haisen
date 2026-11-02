// 金沢文庫の増結: 連結する予定の列車と、実際に増結車を置けた列車を並べる
const fs = require('fs');
const D = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const TT = JSON.parse(fs.readFileSync('tt.json', 'utf8'));
const SRC = process.argv[2] || 'src/ttcore.js';
const hm = m => String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
eval(fs.readFileSync('src/core.js', 'utf8') + fs.readFileSync(SRC, 'utf8') + `
const list = TT.wd.map(ttDecode).filter(t => t.ev.length > 1); ttOvertakes(list); ttCouple(list, 'wd'); ttLink(list); list.sort((a, b) => a.start - b.start);
const pl = ttPlanner(true); list.forEach(pl.pre); list.forEach(pl.plan); const units = pl.finish();
const want = list.filter(t => t.cpl), got = new Set(units.filter(u => u.unit).map(u => u.cplWith));
console.log('予定', want.length, '置けた', got.size);
for (const t of want) if (!got.has(t)) console.log('  置けなかった:', t.no, TYPES[t.type].name, t.dest, '金沢文庫', hm(t.ev[t.cpl.i].dep), t.cpl.side, 'prev', t.prev && t.prev.no);
`);
