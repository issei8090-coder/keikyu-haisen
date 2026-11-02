const fs = require('fs');
const D = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const TT = JSON.parse(fs.readFileSync('tt.json', 'utf8'));
eval(fs.readFileSync('src/core.js', 'utf8') + fs.readFileSync('src/ttcore.js', 'utf8') + `
mainThru();
for (const nm of process.argv[2].split(',')) { console.log(nm, 'plats', JSON.stringify(stByName.get(nm).plats), 'cx', stByName.get(nm).cx); for (const sd of SIDINGS.get(nm) || []) console.log('  siding e' + sd.e, 'node(' + N[sd.node].x.toFixed(0) + ',' + N[sd.node].y.toFixed(0) + ')', 'edge (' + N[E[sd.e].a].x.toFixed(0) + ',' + N[E[sd.e].a].y.toFixed(0) + ')-(' + N[E[sd.e].b].x.toFixed(0) + ',' + N[E[sd.e].b].y.toFixed(0) + ')', 'trim', sd.trim); }
`);
