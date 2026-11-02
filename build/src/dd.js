// 見送った成田空港の回送の内訳: node src/dd.js wd
const fs = require('fs');
const D = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const TT = JSON.parse(fs.readFileSync('tt.json', 'utf8'));
const hs = s => String(Math.floor(s / 3600) % 24).padStart(2, '0') + ':' + String(Math.floor(s / 60) % 60).padStart(2, '0');
const day = process.argv[2] || 'wd'; process.env.DH_DIAG = '1';
eval(fs.readFileSync('src/core.js', 'utf8') + fs.readFileSync('src/ttcore.js', 'utf8') + `
const list = TT[day].map(ttDecode).filter(t => t.ev.length > 1); ttOvertakes(list); ttCouple(list, day); ttLink(list);
console.log(day, JSON.stringify(list.dhStat)); const tot = { pen: 0, berth: 0, single: 0, ord: 0, line: 0, na: 0, ok: 0 }, by = {};
for (const d of list.dhDiag) { for (const k in tot) tot[k] += d[k] || 0; const key = d.kind + ' ' + d.cat; by[key] = (by[key] || 0) + 1; console.log(' ', d.kind === 'in' ? '送り込み' : '引き上げ', hs(d.t), d.no, d.cat, 'ホーム・単線', d.pen, '(ホーム', d.berth || 0, '単線', (d.single || 0) + ')', '第2ビル', d.ord, '成田〜空港', d.line, '成田の待ち', d.na, '通る', d.ok); }
console.log('見送り', list.dhDiag.length, JSON.stringify(by), '候補が落ちた理由の合計', JSON.stringify(tot));
`);
