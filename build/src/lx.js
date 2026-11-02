// 1本の列車の動きを調べる: 各停車駅の番線と時刻、つかえた区間、速すぎ・後退・逆線・折り返し
//   node src/lx.js wd 614
const fs = require('fs');
const D = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const TT = JSON.parse(fs.readFileSync('tt.json', 'utf8'));
const hs = s => String(Math.floor(s / 3600) % 24).padStart(2, '0') + ':' + String(Math.floor(s / 60) % 60).padStart(2, '0') + ':' + String(Math.floor(s % 60)).padStart(2, '0');
const hm = m => String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
const day = process.argv[2], NOS = process.argv[3].split(','), DT = 2;
eval(fs.readFileSync('src/core.js', 'utf8') + fs.readFileSync('src/ttcore.js', 'utf8') + `
const list = TT[day].map(ttDecode).filter(t => t.ev.length > 1); ttOvertakes(list); ttCouple(list, day); ttLink(list); list.sort((a, b) => a.start - b.start);
const pl = ttPlanner(true); list.forEach(pl.pre); list.forEach(pl.plan); pl.finish(); list.push(...pl.units); list.sort((a, b) => a.start - b.start);
const des = t => t.no + ' ' + TYPES[t.type].name + ' ' + t.names[0] + hm(t.ev[0].dep) + '→' + t.names[t.names.length - 1] + hm(t.ev[t.ev.length - 1].arr) + ' ' + t.cars + '両 運行' + (ttRunOf(t).key || '');
const nameAt = (t, s) => { const g = segAt(t.route, Math.max(0, Math.min(t.route.total, s))), p = posAt(t.route, s); return (edgeStation[g.e] >= 0 ? ST[edgeStation[g.e]].name : '駅間') + ' e' + g.e + '(' + p.x.toFixed(0) + ',' + p.y.toFixed(0) + ')'; };
const W = list.filter(t => NOS.includes(t.no) && !t.unit);
for (const t of W) { console.log('==', des(t), '| 前', t.prev ? des(t.prev) : '-', '| 次', t.next ? des(t.next) : '-', '|', ['tail', 'deadOut', 'deadIn', 'fromSiding', 'unlinked', 'k0'].map(k => t[k] ? k : '').filter(Boolean).join(' '));
  if (!t.route) { console.log('  経路なし'); continue; }
  console.log('  A', t.A.length, 'stopD', t.route.stopD.length, 'start', hs(t.start), 'end', hs(t.end));
  t.ev.forEach((e, i) => { const k = i + t.k0, st = stByName.get(e.name), es = [...new Set(st.stops.map(([x]) => x))].sort((a, b) => N[E[a].a].y - N[E[b].a].y), pe = t.route.stopE[i];
    console.log('   ', e.name, hm(e.arr) + '/' + hm(e.dep), '計画', hs(t.A[k]) + '/' + hs(t.P[k]), '線' + (es.indexOf(pe) + 1) + '/' + es.length, t.off && t.off[k] ? 'off' + t.off[k] : '', ['thru', 'wait', 'ot', 'ovr'].map(x => e[x] ? x : '').filter(Boolean).join(' '), e.otBy ? 'otBy=' + e.otBy.map(b => b.no).join(',') : ''); });
  let rev = 0, last = 0, wrong = 0; const wr = [];
  for (const g of t.route.segs) { const s = Math.sign(g.bx - g.ax); if (s && last && s !== last) { rev++; wr.push('折返@' + nameAt(t, g.d0)); } if (s) last = s; const e = E[g.e]; if (e.dir && s && s !== e.dir) { wrong += g.d1 - g.d0; if (g.d1 - g.d0 > 3) wr.push('逆線 e' + g.e + ' ' + nameAt(t, (g.d0 + g.d1) / 2) + ' ' + (g.d1 - g.d0).toFixed(0)); } }
  console.log('  向きが変わる回数', rev, ' 逆線の長さ', wrong.toFixed(0), wr.slice(0, 12).join(' ; ')); }
let ptr = 0, act = [], lastT = NaN;
for (let T = 4.4 * 3600; T < 25.6 * 3600; T += DT) {
  while (ptr < list.length && list[ptr].start <= T) act.push(list[ptr++]);
  act = act.filter(t => { if (ttTarget(t, T)) return true; t.sv = null; t.ps = null; return false; });
  ttFollow(act, T, lastT); lastT = T;
  for (const t of act) { if (!W.includes(t)) continue;
    const v = t.ps != null ? (t.s - t.ps) / DT : 0, lag = t.tgt - t.s;
    const st = (t.blk > 0 || lag > 8 ? 'つかえ(' + (t.blkBy ? t.blkBy.no + ' ' + TYPES[t.blkBy.type].name : '?') + ')' : '') + (v > 5 ? ' 速い' : '') + (v < -0.5 ? ' 後退' : '') + (t.hold ? ' 発車待ち' : '') + (t.blk > FOLLOW_GIVEUP ? ' 突き抜け' : '');
    if (st !== (t.lst || '')) { console.log('  ', hs(T), t.no, st || '(通常)', nameAt(t, t.s), 'v' + v.toFixed(1), 'lag' + lag.toFixed(0)); t.lst = st; }
    t.ps = t.s; }
}
`);
