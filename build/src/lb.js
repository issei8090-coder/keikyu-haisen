const fs = require('fs');
const D = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const TT = JSON.parse(fs.readFileSync('tt.json', 'utf8'));
eval(fs.readFileSync('src/core.js', 'utf8') + fs.readFileSync('src/ttcore.js', 'utf8') + `
for (const day of ['wd', 'hd']) { const list = TT[day].map(ttDecode).filter(t => t.ev.length > 1); ttOvertakes(list);
  const m = list.filter(t => t.ev.some(e => e.meet)), w = m.map(t => { const e = t.ev.find(e => e.meet); return (e.ds - e.as) / 60; });
  const ln = m.filter(t => t.type === 'liner').length;
  console.log(day, 'wait trains', m.length, 'liners', ln, 'wait min: min', Math.min(...w).toFixed(1), 'median', w.sort((a, b) => a - b)[w.length >> 1].toFixed(1), 'max', Math.max(...w).toFixed(1)); }
`);
