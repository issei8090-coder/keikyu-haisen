const fs = require('fs');
const D = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const TT = JSON.parse(fs.readFileSync('tt.json', 'utf8'));
eval(fs.readFileSync('src/core.js', 'utf8') + fs.readFileSync('src/ttcore.js', 'utf8') + `
for (const day of ['wd', 'hd']) { const list = TT[day].map(ttDecode).filter(t => t.ev.length > 1); ttOvertakes(list); ttCouple(list, day); ttLink(list); list.sort((a, b) => a.start - b.start);
  const pl = ttPlanner(true); list.forEach(pl.pre); list.forEach(pl.plan); pl.finish();
  const c = {};
  for (const t of list) { if (!t.route) continue;
    for (const [nm, pf, lab] of [['青砥', t.aoto, e => e === AOTO_E[0] ? '3番線' : e === AOTO_E[1] ? '4番線' : '?'], ['京成高砂', t.taka, e => e === TAKA_E[3] ? '3番線' : e === TAKA_E[4] ? '4番線' : null]]) {
      if (!pf) continue; const e = t.route.stopE[pf.q + t.k0], l = lab(e); if (!l) continue;
      const q = pf.q, after = t.names.slice(q + 1), L2 = OT_LINES[2]; if (!after.length) continue;
      const hk = after.some(x => L2.indexOf(x) > L2.indexOf('京成高砂') && ((x !== NRT && x !== NRT2) || ksVia(t) === 'access'));
      const k = nm + ' 下り ' + (hk ? '北総・スカイアクセス方面' : nm === '青砥' || after.length ? '京成本線方面' : '') + (t.ev[q].thru ? '(通過)' : '') + ' ' + l; c[k] = (c[k] || 0) + 1; } }
  console.log(day); Object.keys(c).sort().forEach(k => console.log('   ', k, c[k])); }
`);
