// 駅で、同じ線に2本以上が同時に止まっている場面(縦列を含む)を数える: node src/nb.js wd [駅]
const fs = require('fs');
const D = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const TT = JSON.parse(fs.readFileSync('tt.json', 'utf8'));
const hs = s => String(Math.floor(s / 3600) % 24).padStart(2, '0') + ':' + String(Math.floor(s / 60) % 60).padStart(2, '0') + ':' + String(Math.floor(s % 60)).padStart(2, '0');
const day = process.argv[2] || 'wd', STN = process.argv[3] || '京成成田';
eval(fs.readFileSync('src/core.js', 'utf8') + fs.readFileSync('src/ttcore.js', 'utf8') + `
const list = TT[day].map(ttDecode).filter(t => t.ev.length > 1); ttOvertakes(list); ttCouple(list, day); ttLink(list); list.sort((a, b) => a.start - b.start);
const pl = ttPlanner(true); list.forEach(pl.pre); list.forEach(pl.plan); pl.finish();
const st = stByName.get(STN), es = [...new Set(st.stops.map(([e]) => e))].sort((a, b) => N[E[a].a].y - N[E[b].a].y);
const occ = [];   // { e, a, b, t } その線にいる時間。折り返しでつながる列車は1本として数える
for (const t of list) { if (!t.route) continue; t.names.forEach((nm, i) => { if (nm !== STN || t.ev[i].thru) return; const k = i + t.k0, e = t.route.stopE[i]; if (e == null) return;
  if (i === 0 && t.prev) return;   // 前の列車の続き
  let b = t.P[k]; if (i === t.names.length - 1) b = t.next ? t.next.P[t.next.k0] : t.A[k] + 25;
  occ.push({ e, a: t.A[k], b, t, nx: i === t.names.length - 1 ? t.next : null }); }); }
occ.sort((x, y) => x.a - y.a); const out = [], cnt = {};
for (let i = 0; i < occ.length; i++) for (let j = i + 1; j < occ.length && occ[j].a < occ[i].b - 20; j++) { const A = occ[i], B = occ[j]; if (A.e !== B.e) continue; const ov = Math.min(A.b, B.b) - B.a; if (ov < 20) continue;
  const ln = '線' + (es.indexOf(A.e) + 1); cnt[ln] = (cnt[ln] || 0) + 1; const d = o => o.t.no + ' ' + TYPES[o.t.type].name + (o.nx ? '→' + o.nx.no + ' ' + TYPES[o.nx.type].name : '') + ' ' + hs(o.a) + '〜' + hs(o.b);
  out.push(hs(B.a) + ' ' + ln + ' ' + Math.round(ov) + '秒 | ' + d(A) + ' | ' + d(B)); }
console.log('==', day, STN, '同じ線に同時に止まる組', out.length, JSON.stringify(cnt)); out.forEach(x => console.log('  ' + x));
`);
