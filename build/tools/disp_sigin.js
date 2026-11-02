// 画面の「信号機を編集」→「書き出す」で保存した disp_signals.json を disp_cfg.json の signals に取り込む
// node tools/disp_sigin.js [disp_signals.json のパス(省略時はダウンロードフォルダ)]
const fs = require('fs'), path = require('path'), os = require('os');
const src = process.argv[2] || path.join(os.homedir(), 'Downloads', 'disp_signals.json');
const j = JSON.parse(fs.readFileSync(src, 'utf8'));
if (!j.list) throw new Error(src + ' に list がありません');
const cfgP = 'disp_cfg.json', txt = fs.readFileSync(cfgP, 'utf8'), cfg = JSON.parse(txt);
const old = cfg.signals || {};
const secs = Object.keys(j.list);
let body = '  "signals": {\n    "kill": ' + JSON.stringify(old.kill || []) + ', "add": ' + JSON.stringify(old.add || []) + ',\n    "saved": ' + (j.saved || Date.now()) + ',\n    "list": {\n';
body += secs.map(id => '      "' + id + '": [\n' + j.list[id].map(s => '        ' + JSON.stringify(s)).join(',\n') + '\n      ]').join(',\n');
body += '\n    }\n  }\n';
const i = txt.lastIndexOf('  "signals":');
if (i < 0) throw new Error('disp_cfg.json に signals が見つかりません');
const out = txt.slice(0, i) + body + '}\n';
JSON.parse(out);   // 壊れていないか
fs.copyFileSync(cfgP, cfgP + '.bak');
fs.writeFileSync(cfgP, out);
for (const id of secs) { const L = j.list[id], k = {}; for (const s of L) k[s.k] = (k[s.k] || 0) + 1; console.log(id, L.length + '基', JSON.stringify(k), '推定の位置のまま', L.filter(s => s.est).length); }
console.log('取り込みました →', cfgP, '(前のものは disp_cfg.json.bak)');
