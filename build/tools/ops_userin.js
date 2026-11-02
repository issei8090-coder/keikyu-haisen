// 画面の「運用の編集」→「書き出す」で保存した ops_user.json を build に取り込む(assemble.py が index.html に入れる)
// node tools/ops_userin.js [ops_user.json のパス(省略時はダウンロードフォルダ)]
const fs = require('fs'), path = require('path'), os = require('os');
const src = process.argv[2] || path.join(os.homedir(), 'Downloads', 'ops_user.json');
const j = JSON.parse(fs.readFileSync(src, 'utf8'));
if (fs.existsSync('ops_user.json')) fs.copyFileSync('ops_user.json', 'ops_user.json.bak');
fs.writeFileSync('ops_user.json', JSON.stringify(j, null, 1));
for (const d of Object.keys(j)) { const o = j[d] || {}; console.log(d, 'つなぐ', (o.link || []).length, '切る', (o.cut || []).length, '回送', (o.dh || []).length, '自動の回送を消す', (o.del || []).length); }
console.log('取り込みました → ops_user.json(前のものは ops_user.json.bak)。python tools/assemble.py で index.html に入ります');
