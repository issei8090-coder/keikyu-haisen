// 1日ぶんの運行計画(経路つき)を作って JSON に保存: node _tmp/disp/mkplan.js wd
const fs = require('fs');
const D = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const TT = JSON.parse(fs.readFileSync('tt.json', 'utf8'));
const day = process.argv[2] || 'wd';
const USER_OPS = fs.existsSync('ops_user.json') ? JSON.parse(fs.readFileSync('ops_user.json', 'utf8')) : null;   // 運用の編集
eval(fs.readFileSync('src/core.js', 'utf8') + fs.readFileSync('src/ttcore.js', 'utf8') + `
const t0 = Date.now();
const list = TT[day].map(ttDecode).filter(t => t.ev.length > 1); ttOps(list); ttOvertakes(list); ttCouple(list, day); ttLink(list); list.sort((a, b) => a.start - b.start);
const pl = ttPlanner(true); list.forEach(pl.pre); list.forEach(pl.plan); list.push(...pl.finish()); list.sort((a, b) => a.start - b.start);
console.log('plan', (Date.now() - t0) / 1000, 's', list.length);
const idx = new Map(list.map((t, i) => [t, i]));
const out = JSON.stringify(list, function (k, v) { if (k !== '' && v && typeof v === 'object' && idx.has(v) && this !== list) return { $ref: idx.get(v) }; if (v instanceof Map || v instanceof Set) return undefined; if (k === 'g' || k === 'li2') return undefined; return v; });
fs.writeFileSync('_tmp/disp/plan_' + day + '.json', out); console.log('saved', out.length);
`);
