// 配線(data.json)の「駅の何本目の線か」の表を geo_hist.json に足す。配線を作り直す前の data.json で流しておくと、
// その配線で保存した運用の編集(番線・引上線の指定)を、作り直したあとの配線の線に置き換えられる(ttcore.js の ttGeoMigrate)。
// 使い方(build フォルダで): node tools/geo_hist.js 前の配線の data.json   … 先に足したものほど古い。保存に geo が無いもの(古い保存)は最初の表の配線とみなす
const fs = require('fs');
const file = process.argv[2] || 'data.json';
const D = JSON.parse(fs.readFileSync(file, 'utf8'));
const TT = { st: [] };
eval(fs.readFileSync('src/core.js', 'utf8') + `
const sig = (() => { let h = 0; for (const e of D.edges) h = (h * 31 + e[0] * 7 + e[1]) % 1000000007; return D.nodes.length + '/' + D.edges.length + '/' + h; })();
const map = {};
for (const s of ST) {
  const es = [...new Set(s.stops.map(([e]) => e))].sort((a, b) => (N[E[a].a].y + N[E[a].b].y) - (N[E[b].a].y + N[E[b].b].y) || N[E[a].a].x - N[E[b].a].x);
  es.forEach((e, i) => { map[e] = [s.name, 'p', i]; });
}
for (const [st, l] of SIDINGS) l.slice().sort((a, b) => N[a.node].y - N[b.node].y || N[a.node].x - N[b.node].x).forEach((sd, i) => { map[sd.e] = [st, 's', i]; });
const H = fs.existsSync('geo_hist.json') ? JSON.parse(fs.readFileSync('geo_hist.json', 'utf8')) : [];
if (H.some(h => h.sig === sig)) console.log('already', sig);
else { H.push({ sig, file, at: new Date().toISOString().slice(0, 10), map }); fs.writeFileSync('geo_hist.json', JSON.stringify(H)); console.log('added', sig, Object.keys(map).length); }
`);
