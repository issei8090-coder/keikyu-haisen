const fs = require('fs');
const D = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const TT = JSON.parse(fs.readFileSync('tt.json', 'utf8'));
const hs = s => String(Math.floor(s / 3600) % 24).padStart(2, '0') + ':' + String(Math.floor(s / 60) % 60).padStart(2, '0') + ':' + String(Math.floor(s % 60)).padStart(2, '0');
eval(fs.readFileSync('src/core.js', 'utf8') + fs.readFileSync('src/ttcore.js', 'utf8') + `
const day = process.argv[2]; const list = TT[day].map(ttDecode).filter(t => t.ev.length > 1); ttOvertakes(list);
for (const t of list.filter(t => process.argv[3].split(',').includes(t.no))) { console.log(t.no, t.names[0], '>', t.names[t.names.length - 1]); t.ev.forEach((e, i) => console.log('  ', e.name, hs(t.A[i + t.k0]), hs(t.P[i + t.k0]), ['thru', 'wait', 'ot', 'shifted', 'ovr'].filter(x => e[x]).join(' '), (e.otBy || []).map(b => b.no).join(','))); console.log('  pass', (t.pass || []).map(w => w.name + ' ' + hs(w.t) + (w.ref ? ' ref' : '')).join(' | ')); }
`);
