// 回送の本数だけを出す(診断なし・時間を計る): node src/df.js wd
const fs = require('fs');
const D = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const TT = JSON.parse(fs.readFileSync('tt.json', 'utf8'));
const day = process.argv[2] || 'wd';
eval(fs.readFileSync('src/core.js', 'utf8') + fs.readFileSync('src/ttcore.js', 'utf8') + `
const list = TT[day].map(ttDecode).filter(t => t.ev.length > 1); ttOvertakes(list); ttCouple(list, day); const t0 = Date.now(); ttLink(list);
console.log(day, process.env.DH_EJ || '', (Date.now() - t0) / 1000 + '秒', JSON.stringify(list.dhStat)); if (process.argv[3]) console.log((list.dhSkip || []).join(String.fromCharCode(10)));
`);
