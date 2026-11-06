// 固定した計画の鍵: 計画に効く入力ファイルの中身のハッシュ(assemble.py で同じものを計算し、違えば埋めない = 開くときに計算する)
const fs = require('fs'), crypto = require('crypto');
module.exports = () => { const h = crypto.createHash('sha1');
  for (const f of ['data.json', 'tt.json', 'src/core.js', 'src/ttcore.js', 'hensei.json', 'ops_user.json']) { h.update(f + ':'); if (fs.existsSync(f)) h.update(fs.readFileSync(f)); }
  return h.digest('hex').slice(0, 16); };
if (require.main === module) console.log(module.exports());
