// 運行番号でつないだ1日の運用が、どれだけ「前の列車の終着駅 = 次の列車の始発駅」でつながるかを調べる
const fs = require('fs');
const D = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const TT = JSON.parse(fs.readFileSync('tt.json', 'utf8'));
eval(fs.readFileSync('src/core.js', 'utf8') + fs.readFileSync('src/ttcore.js', 'utf8') + `
const RUN_CO = { H: '京急', K: '京成', T: '都営', N: '北総', F: '新京成' };
function run(t) { const no = t.no || ''; let m, num = '', co = ''; const odd = v => { const n = +v; return n % 2 ? n : n + 1; };
  const ks = () => { const s = stByName.get(t.names[0]); return s && s.stops.length && N[E[s.stops[0][0]].a].y > KS_Y; };
  if ((m = /^(\\d{1,2})(\\d{2})([A-Z]{1,2})[a-z]?$/.exec(no))) { num = odd(m[2]) + m[3]; co = RUN_CO[m[3]] || '京急'; }
  else if ((m = /^(\\d{1,2})([A-Z]{1,2})(\\d{2})[a-z]?$/.exec(no))) { num = m[2] + (m[2] === 'AE' ? m[3] : String(odd(m[3])).padStart(2, '0')); co = '京成'; }
  else if ((m = /^(\\d{1,2})(\\d{2})[a-z]?$/.exec(no))) { num = String(odd(m[2])).padStart(2, '0'); co = ks() ? '京成' : '京急'; }
  else { num = no; co = ks() ? '京成' : '京急'; }
  return { num, co, kind: m ? (m[3] && /[A-Z]/.test(m[3]) ? '末尾' + m[3] : /[A-Z]/.test(m[2]) ? '途中' + m[2] : '数字') : 'other' }; }
for (const day of ['wd', 'hd']) { const list = TT[day].map(ttDecode).filter(t => t.ev.length > 1); ttLink(list);
  const g = new Map(); for (const t of list) { const r = run(t); t.r = r; const k = r.co + ' ' + r.num; (g.get(k) || g.set(k, []).get(k)).push(t); }
  const st = {}; let big = 0;
  for (const [k, l] of g) { l.sort((a, b) => a.ev[0].dep - b.ev[0].dep); if (l.length > 1) big++;
    for (let i = 1; i < l.length; i++) { const a = l[i - 1], b = l[i], kind = a.r.kind, s = st[kind] || (st[kind] = { ok: 0, gapOk: 0, ovl: 0, diff: 0, linked: 0, n: 0 }); s.n++;
      const same = a.names[a.names.length - 1] === b.names[0], gap = b.ev[0].dep - a.ev[a.ev.length - 1].arr;
      if (gap < 0) s.ovl++; else if (same) { s.ok++; if (a.next === b) s.linked++; } else s.diff++; } }
  console.log(day, 'groups', g.size, 'with 2+ trains', big, 'avg trains/group', (list.length / g.size).toFixed(1));
  for (const k of Object.keys(st).sort((a, b) => st[b].n - st[a].n)) { const s = st[k]; console.log('   ', k.padEnd(6), 'pairs', String(s.n).padStart(4), ' 同じ駅でつながる', String(s.ok).padStart(4), '(' + Math.round(s.ok / s.n * 100) + '%)', ' 時刻が重なる', s.ovl, ' 駅が違う', s.diff, ' うち今の折り返しと一致', s.linked); } }
`);
