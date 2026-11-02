// 独立した検査: node tools/indep_check.js wd 5 10
// 運転指令(disp.js)は動かすだけ。合否は tools/indep_lib.js が、位置(t.s)・配線・信号機の置き場所だけから自前で出す。
// 環境変数:
//   MODE=browser(既定: ブラウザの ttUpdate と同じ回し方。毎コマ全列車に dispTarget、2秒以下に分ける、途中から始めたら dWarm) / MODE=run(tools/disp_run.js と同じ回し方)
//   DT=1(1コマの秒。×300 の速い再生は約5) / SUB=1(MODE=run で2秒以下に分ける) / WARM=0(MODE=browser で最初の早回しをしない)
//   JUMP=8.0>7.0,9>9.5  時刻 8.0 時に達したらスライダーで 7.0 時へ動かす(ドラッグ中のコマ → 放す → 早回し)。25.5>4.5 は1日の終わりで最初に戻るのと同じ
//   NV=件数(例の数)  OUT=ファイル(結果を JSON でも書く)
const fs = require('fs');
const D = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const TT = JSON.parse(fs.readFileSync('tt.json', 'utf8'));
const day = process.argv[2] || 'wd', H0 = +(process.argv[3] || 5), H1 = +(process.argv[4] || 10), DT = +(process.env.DT || 1), MODE = process.env.MODE || 'browser';
const src = fs.readFileSync('src/core.js', 'utf8') + fs.readFileSync('src/ttcore.js', 'utf8') + fs.readFileSync(process.env.DISPJS || 'src/disp.js', 'utf8').replace('/*DISPCFG*/', fs.readFileSync(process.env.CFG || 'disp_cfg.json', 'utf8')).replace('/*DISPTUNE*/ null', process.env.NOTUNE || !fs.existsSync(process.env.TUNE || 'disp_tune.json') ? 'null' : fs.readFileSync(process.env.TUNE || 'disp_tune.json', 'utf8'));
const LIB = fs.readFileSync(__dirname + '/indep_lib.js', 'utf8').replace(/if \(typeof module[^\n]*\n?/, '');
eval(src + '\n' + LIB + `
const raw = JSON.parse(fs.readFileSync('_tmp/disp/plan_' + day + '.json', 'utf8'));
const fix = o => { if (Array.isArray(o)) { for (let i = 0; i < o.length; i++) { const v = o[i]; if (v && typeof v === 'object') { if (v.$ref != null) o[i] = raw[v.$ref]; else fix(v); } } } else for (const k in o) { const v = o[k]; if (v && typeof v === 'object') { if (v.$ref != null) o[k] = raw[v.$ref]; else fix(v); } } };
raw.forEach(fix);
const list = raw; list.sort((a, b) => a.start - b.start);
{ const cnt = {}; for (const t of list) { const c = cnt[t.no] = (cnt[t.no] || 0) + 1; if (c > 1) t.no = t.no + '#' + c; } }
D_DAY = day; dispPlan(list); D_LOG = []; D_LOSS = new Map();
const IC = IC_make({ carLen: DTR.carLen });
const isSec = t => t.route && t.route.segs.some(g => IC.inSec(g.e));
console.log('独立検査', day, H0 + '〜' + H1 + '時', 'MODE=' + MODE, 'DT=' + DT, process.env.SUB ? 'SUB' : '', process.env.JUMP ? 'JUMP=' + process.env.JUMP : '', '信号機', SIGS.length, '平面交差', IC.XS.length, IC.XS.map(x => 'e' + x.e1 + '×e' + x.e2 + (x.over ? '(over)' : '') + '@' + Math.round(x.x) + ',' + Math.round(x.y)).join(' '));
const JUMPS = (process.env.JUMP || '').split(',').filter(Boolean).map(x => x.split('>').map(Number)).map(([a, b]) => ({ at: a * 3600, to: b * 3600, done: false }));
const t0 = Date.now(); let frames = 0, note = '';
if (MODE === 'run') {
  // tools/disp_run.js と同じ回し方
  let ptr = 0, cand = [], lastT = NaN;
  for (let T = H0 * 3600; T < H1 * 3600; T += DT) {
    while (ptr < list.length && list[ptr].start <= T) cand.push(list[ptr++]);
    const live = [];
    for (const t of cand) { if (dispTarget(t, T)) { live.push(t); t.was = true; } else { if (t.was) { dispKill(t); t.sv = null; t.gone = true; } else if (T > t.end + 3600) t.gone = true; } }
    cand = cand.filter(t => !t.gone);
    if (process.env.SUB && T - lastT > 2.01) { const L = lastT, n = Math.ceil((T - L) / 2); let q0 = L;
      for (let i = 1; i < n; i++) { const t1 = L + (T - L) * i / n, a = []; for (const t of cand) if (dispTarget(t, t1)) a.push(t); ttFollow(a, t1, q0); dispStep(a, t1, q0); q0 = t1; } lastT = q0; }
    ttFollow(live, T, lastT); dispStep(live, T, lastT); lastT = T;
    IC.frame(T, live, ''); frames++;
  }
} else {
  // ブラウザ(src/tt.js の ttUpdate)と同じ回し方。t.g は「画面に出ている」印の代わり
  let ttLastT = NaN;
  const update = (T, drag) => {
    if (D_NEEDWARM && dispOn && dispReady && !drag && isFinite(T) && process.env.WARM !== '0') ttLastT = dWarm(list, T);
    { const L = drag ? NaN : ttLastT;
      if (dispOn && dispReady && isFinite(L) && T - L > 2.01 && T - L < 90) {
        const n = Math.ceil((T - L) / 2), cs = list.filter(t => t.g || t.ph || (t.start <= T && t.end >= L)); let q0 = L;
        for (let i = 1; i < n; i++) { const t1 = L + (T - L) * i / n, a = []; for (const t of cs) { if (!dispTarget(t, t1)) { t.g = null; dispKill(t); t.sv = null; continue; } a.push(t); } ttFollow(a, t1, q0); dispStep(a, t1, q0); q0 = t1; }
        ttLastT = q0;
      } }
    const act = [];
    for (const t of list) { if (!dispTarget(t, T)) { t.g = null; dispKill(t); t.sv = null; continue; } act.push(t); }
    ttFollow(act, T, drag ? NaN : ttLastT);
    dispStep(act, T, drag ? NaN : ttLastT);
    ttLastT = T;
    for (const t of act) t.g = true;
    return act;
  };
  let T = H0 * 3600, end = H1 * 3600, guard = 0;
  const STOPAT = process.env.STOPAT ? +process.env.STOPAT * 3600 : NaN;   // JUMP のあと、この時刻で終える(25.5>4.5 のように戻すとき)
  if (JUMPS.some(j => isNaN(j.at) || isNaN(j.to))) throw new Error('JUMP の書き方: JUMP="8>7.2"(引用符で囲む)');
  while ((T < end || JUMPS.some(j => j.done)) && guard++ < 1e6) {
    if (JUMPS.length && JUMPS.every(j => j.done) && (T >= STOPAT || (isNaN(STOPAT) && T >= end))) break;
    const J = JUMPS.find(j => !j.done && T >= j.at);
    if (J) { J.done = true; update(J.to, true); note = 'スライダー ' + IC.hs(J.at) + '→' + IC.hs(J.to); T = J.to; IC.frame(T, list.filter(t => t.g), note); frames++; console.log('  ' + note); T += DT; continue; }   // ドラッグ中のコマ(放した次のコマで早回し)
    const act = update(T, false); IC.frame(T, act, note); frames++; if (note && frames % 60 === 0) note = '';
    if (process.env.PROBE && process.env.PROBE.split(',').map(Number).some(x => Math.floor(T) === x)) console.log('PROBE', IC.hs(T), eval(process.env.PROBEJS));   // 検査用: PROBE=秒 PROBEJS=式(act=表示中の列車, list=全列車)
    T += DT;
  }
}
const R = IC.report(list, H0, H1, isSec, +(process.env.NV || 12));
console.log(R.text);
console.log('時間', ((Date.now() - t0) / 1000).toFixed(1) + 's', 'コマ', frames, '| 参考(運転指令自身の数え): 冒進', D_STAT.spad, '非常', D_STAT.emer);
if (process.env.OUT) { const F = R.F, no = t => t.no; fs.writeFileSync(process.env.OUT, JSON.stringify({ day, H0, H1, MODE, DT, never: R.fin.never.map(no), mid: R.fin.mid.map(x => [no(x.t), x.T, Math.round(x.rest), x.sec]), nextFar: R.fin.nextFar.map(x => [no(x.t), no(x.n), x.T, x.d]), jump: F.jump.map(x => [no(x.t), x.T, x.dm, x.sec]), sigpass: F.sigpass.map(x => [no(x.t), x.T, x.b.name, x.v, x.hit]), dbl: [...F.dbl.values()].map(x => [no(x.a), no(x.b), x.T0, x.T1]), early: F.early.map(x => [no(x.t), x.name, x.T, x.by]) }, null, 1)); }
`);
