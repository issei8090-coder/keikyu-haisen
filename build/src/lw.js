// 駅の線の向き・本線かどうかを出す: node src/lw.js 駅名,駅名
const fs = require('fs');
const D = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const TT = JSON.parse(fs.readFileSync('tt.json', 'utf8'));
eval(fs.readFileSync('src/core.js', 'utf8') + fs.readFileSync('src/ttcore.js', 'utf8') + `
mainThru();
for (const nm of process.argv[2].split(',')) { const st = stByName.get(nm); const es = [...new Set(st.stops.map(([e]) => e))].sort((a, b) => N[E[a].a].y - N[E[b].a].y);
  console.log(nm, es.map((e, i) => (i + 1) + '=e' + e + ' y' + N[E[e].a].y + ' x' + Math.round(N[E[e].a].x) + '-' + Math.round(N[E[e].b].x) + ' dir' + E[e].dir + ' main' + (MAINTHRU.has(e) ? MAINSGN.get(e) : '-') + (E[e].lane ? ' lane=' + E[e].lane : '')).join(' | '), 'pass:', st.pass.map(e => 'e' + e + ' dir' + E[e].dir + (isNaN(stopX[e]) ? ' noplat' : '')).join(' ')); }
`);
