// 成田空港のホームの割り当て(計画)を時刻順に出す: node src/dj.js wd 10.5 11.3
const fs = require('fs');
const D = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const TT = JSON.parse(fs.readFileSync('tt.json', 'utf8'));
const hs = s => String(Math.floor(s / 3600) % 24).padStart(2, '0') + ':' + String(Math.floor(s / 60) % 60).padStart(2, '0') + ':' + String(Math.floor(s % 60)).padStart(2, '0');
const day = process.argv[2] || 'wd', a = +process.argv[3] * 3600, b = +process.argv[4] * 3600;
eval(fs.readFileSync('src/core.js', 'utf8') + fs.readFileSync('src/ttcore.js', 'utf8') + `
const list = TT[day].map(ttDecode).filter(t => t.ev.length > 1); ttOvertakes(list); ttCouple(list, day); ttLink(list);
for (const j of list.dhJobs.slice().sort((x, y) => x.ta - y.ta)) if (j.td > a && j.ta < b) console.log(j.cat.padEnd(6), 'k' + j.k, hs(j.ta), '〜', hs(j.td), ({ fix: '折り返し', in: '送り込み', out: '引き上げ' })[j.kind], j.no, j.skip ? '(見送り)' : '', j.pen ? 'pen' + j.pen : '');
`);
