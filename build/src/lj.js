// 運行番号では続くのに、図の折り返しが別の相手になっている組を、駅ごとに理由つきで出す
const fs = require('fs');
const D = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const TT = JSON.parse(fs.readFileSync('tt.json', 'utf8'));
const STN = (process.argv[2] || '青砥,品川').split(','), day = process.argv[3] || 'wd';
const hm = m => String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
eval(fs.readFileSync('src/core.js', 'utf8') + fs.readFileSync('src/ttcore.js', 'utf8') + `
const list = TT[day].map(ttDecode).filter(t => t.ev.length > 1); ttOvertakes(list); ttCouple(list, day); ttLink(list);
const g = new Map(); for (const t of list) { const k = ttRunOf(t).key; if (k) (g.get(k) || g.set(k, []).get(k)).push(t); }
const d = t => t ? t.no + ' ' + t.names[0] + hm(t.ev[0].dep) + '>' + t.names[t.names.length - 1] + hm(t.ev[t.ev.length - 1].arr) + ' ' + t.cars + '両' + (t.cpl ? '(増結)' : '') : '-';
for (const s of STN) { const why = {}; let shown = 0;
  for (const l of g.values()) { l.sort((a, b) => a.ev[0].dep - b.ev[0].dep);
    for (let i = 1; i < l.length; i++) { const a = l[i - 1], b = l[i]; if (a.ev[a.ev.length - 1].name !== s || b.ev[0].name !== s || a.next === b) continue;
      const gap = b.ev[0].dep - a.ev[a.ev.length - 1].arr; if (gap < 0 || gap > 30) continue;
      const r = gap < 1 ? '0分' : gap > 20 ? '20分超' : a.cars !== b.cars ? '両数が違う ' + a.cars + '→' + b.cars : a.next && b.prev ? '両方とも別の相手' : a.next ? '着いた列車が別の相手へ' : b.prev ? '出る列車が別の相手から' : 'どちらも相手なし(gap ' + gap + ')';
      why[r] = (why[r] || 0) + 1;
      if (shown++ < 8) console.log('  ', s, 'gap', gap, '|', d(a), '→(運番)', d(b), '| 実際: 着→', d(a.next), ' / 発←', d(b.prev)); } }
  console.log(s, JSON.stringify(why)); }
`);
