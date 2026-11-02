// 計画の秒を運転指令の結果で直す: node tools/disp_tune.js wd [回数] [開始時 終了時]
// 運転指令を走らせ、決まって遅れて着く・出る所の秒を、時刻表の分の中で後ろへずらす(disp_tune.json に保存)。早く着くようになった所は戻す
const fs = require('fs'), { execFileSync } = require('child_process');
const day = process.argv[2] || 'wd', N = +(process.argv[3] || 3), H0 = process.argv[4] || '4.4', H1 = process.argv[5] || '25.6';
const F = 'disp_tune.json', all = fs.existsSync(F) ? JSON.parse(fs.readFileSync(F, 'utf8')) : {};
const TU = all[day] || (all[day] = {});
for (let it = 0; it < N; it++) {
  const tmp = '_tmp/disp/tune_' + day + '.json'; fs.writeFileSync(tmp, JSON.stringify(all));
  const out = execFileSync('node', ['tools/disp_run.js', day, H0, H1], { env: Object.assign({}, process.env, { TUNE: tmp, LOGOUT: '_tmp/disp/tunelog_' + day + '.json', NL: '3' }), maxBuffer: 1 << 26 }).toString();
  const log = JSON.parse(fs.readFileSync('_tmp/disp/tunelog_' + day + '.json', 'utf8'));
  let up = 0, down = 0;
  for (const [k, dep, late] of log) {
    const u = TU[k] || [0, 0], j = dep ? 1 : 0;
    if (late > 2) { u[j] = Math.min(60, u[j] + late); up++; }
    else if (late < -8 && u[j] > 0) { u[j] = Math.max(0, u[j] + Math.round(late / 2)); down++; }
    if (u[0] || u[1]) TU[k] = u; else delete TU[k];
  }
  const sum = out.split('\n').filter(l => /^止まった|^時間|^信号冒進/.test(l)).join(' / ');
  console.log('回', it + 1, '調整', Object.keys(TU).length, '増', up, '減', down, '|', sum);
}
fs.writeFileSync(F, JSON.stringify(all)); console.log('saved', F);
