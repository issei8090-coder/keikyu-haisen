// 運用表で、前の列車の終着駅と次の列車の始発駅が違う(駅が変わってつながる)組の一覧: node src/dx.js [wd|hd]
const fs = require('fs'), parse = require('../tools/ops_parse.js');
const hm = m => String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
for (const day of (process.argv[2] || 'wd,hd').split(',')) for (const f of ['kq', 'ks', 'th']) {
  const file = 'ops/' + f + '_' + day + '.txt'; if (!fs.existsSync(file)) continue;
  for (const d of parse(file)) { let p = null;
    for (const x of d.trips) { if (p && p.to !== x.from) console.log(day, f, d.id, p.to + hm(p.arr), '→', x.from + hm(x.dep), x.brk ? '(入庫)' : '', (x.dep - p.arr) + '分'); p = x; } }
}
