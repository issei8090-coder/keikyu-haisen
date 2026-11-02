// 運用表で駅が変わってつながる組(前の列車の終着駅 ≠ 次の列車の始発駅)が、いまのシミュレーションでどうなっているか: node src/dy.js wd
const fs = require('fs');
const D = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const TT = JSON.parse(fs.readFileSync('tt.json', 'utf8'));
const day = process.argv[2] || 'wd';
eval(fs.readFileSync('src/core.js', 'utf8') + fs.readFileSync('src/ttcore.js', 'utf8') + `
const list = TT[day].map(ttDecode).filter(t => t.ev.length > 1); ttOvertakes(list); ttCouple(list, day); ttLink(list);
const tDep = t => t.ev[0].dep, tArr = t => t.ev[t.ev.length - 1].arr;
const hm = m => String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
const by = new Map(); for (const t of list) if (t.ops && t.ops.id && !t.dh) { const l = by.get(t.ops.id) || []; l.push(t); by.set(t.ops.id, l); }
const dsc = x => !x ? '-' : x.dh ? '回送(' + x.names[0] + '→' + x.names[x.names.length - 1] + ' ' + hm(x.ev[0].dep) + '-' + hm(x.ev[x.ev.length - 1].arr) + ')' : x.no;
for (const [id, l] of by) { l.sort((x, y) => tDep(x) - tDep(y));
  for (let i = 0; i + 1 < l.length; i++) { const a = l[i], d = l[i + 1], ae = a.names[a.names.length - 1], ds = d.names[0]; if (ae === ds) continue;
    const brk = a.opsBrk === d ? '入庫' : ''; console.log(id, a.no, ae + hm(tArr(a)), '→', d.no, ds + hm(tDep(d)), brk, ' 後:', dsc(a.next), ' 前:', dsc(d.prev)); } }
`);
