// 運転指令(実距離・信号)の検査: node _tmp/disp/run.js wd [開始時 終了時]
const fs = require('fs');
const D = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const TT = JSON.parse(fs.readFileSync('tt.json', 'utf8'));
const day = process.argv[2] || 'wd', H0 = +(process.argv[3] || 4.4), H1 = +(process.argv[4] || 25.6), DT = +(process.env.DT || 1);
const hs = s => String(Math.floor(s / 3600) % 24).padStart(2, '0') + ':' + String(Math.floor(s / 60) % 60).padStart(2, '0') + ':' + String(Math.floor(s % 60)).padStart(2, '0');
const src = fs.readFileSync('src/core.js', 'utf8') + fs.readFileSync('src/ttcore.js', 'utf8') + fs.readFileSync(process.env.DISPJS || 'src/disp.js', 'utf8').replace('/*DISPCFG*/', fs.readFileSync(process.env.CFG || 'disp_cfg.json', 'utf8')).replace('/*DISPTUNE*/ null', process.env.NOTUNE || !fs.existsSync(process.env.TUNE || 'disp_tune.json') ? 'null' : fs.readFileSync(process.env.TUNE || 'disp_tune.json', 'utf8'));
eval(src + `
const raw = JSON.parse(fs.readFileSync('_tmp/disp/plan_' + day + '.json', 'utf8'));
const fix = o => { if (Array.isArray(o)) { for (let i = 0; i < o.length; i++) { const v = o[i]; if (v && typeof v === 'object') { if (v.$ref != null) o[i] = raw[v.$ref]; else fix(v); } } } else for (const k in o) { const v = o[k]; if (v && typeof v === 'object') { if (v.$ref != null) o[k] = raw[v.$ref]; else fix(v); } } };
raw.forEach(fix);
const list = process.env.ONLY ? raw.filter(t => process.env.ONLY.split(',').includes(t.no)) : raw; list.sort((a, b) => a.start - b.start);
console.log('信号機', SIGS.length, '区間エッジ', DSEC.map(s => s.edges.length).join(','), '入口', DSEC.map(s => s.entries.length).join(','));
{ const cnt = {}; for (const t of list) { const c = cnt[t.no] = (cnt[t.no] || 0) + 1; if (c > 1) t.no = t.no + '#' + c; } }
D_DAY = day; console.log('待避', dispPlan(list), '秒の割り振り直し', JSON.stringify(D_RETIME_STAT)); D_LOG = []; D_LOSS = new Map();
const MM = new Map(), MMT = new Map();   // 先の信号機が進行・注意なのに止まっている
const VAN = [];   // 走りきらずに消えた列車(区間を通る列車だけ)
const LW = new Map(); let ptr = 0, act = [], cand = [], lastT = NaN; const t0 = Date.now(); let coll = 0; const collSet = new Set(), collEx = [];
for (let T = H0 * 3600; T < H1 * 3600; T += DT) {
  while (ptr < list.length && list[ptr].start <= T) cand.push(list[ptr++]);
  const live = [];
  for (const t of cand) { if (dispTarget(t, T)) { live.push(t); t.was = true; } else { if (t.was) { if (t.route && t.s < t.route.total - 20 && (t.dIn != null ? t.dIn : (t.dIn = t.route.segs.some(g => dSecOf[g.e] >= 0)))) { VAN.push(hs(T) + ' ' + t.no + ' 残り' + Math.round(t.route.total - t.s) + ' ' + (t.ph ? 'P' : 'f') + '[' + (t.dWhy || '') + ']'); } dispKill(t); t.sv = null; t.gone = true; } else if (T > t.end + 3600) t.gone = true; } }
  cand = cand.filter(t => !t.gone); act = live;
  if (process.env.SUB && T - lastT > 2.01) { const L = lastT, n = Math.ceil((T - L) / 2); let t0 = L;   // ブラウザ(tt.js)と同じく2秒以下に分けて進める
    for (let i = 1; i < n; i++) { const t1 = L + (T - L) * i / n, a = []; for (const t of cand) if (dispTarget(t, t1)) a.push(t); ttFollow(a, t1, t0); dispStep(a, t1, t0); t0 = t1; } lastT = t0; }
  ttFollow(live, T, lastT); dispStep(live, T, lastT); lastT = T;
  if (process.env.MISM && Math.floor(T) % 5 === 0) for (const t of live) { const p = t.ph, dp = t.dp; if (!dp || !dp.sig.length) continue; let j, why, still;   // 検査用: 先の信号機が進行・注意なのに止まっている列車
    if (p) { const st = dp.stops[p.k]; still = p.v < 0.1 && (p.mode === 'run' || (p.mode === 'dwell' && st && (process.env.MISM === '2' ? T < st.P - 40 && dMajorStop(t, st) : T >= st.P + 5 && T >= p.arrT + st.minDw))); j = p.lastSig + 1; why = p.mode + ' ' + (p.why || '') + '[' + (t.dWhy || '') + ']' + (p.waitFor ? ' 待避待ち ' + p.waitFor.no : '') + (p.needJ0 != null ? ' 進路待ち' : '') + (p.hold ? ' 抑止' : ''); if (dp.sig[j] && dp.sig[j].m - (p.m + p.L / 2) > 400) still = false; }
    else { const m = dp.s2m(t.s); j = dp.sig.findIndex(x => x.m > m); still = t.tgt - t.s > 3 && t.sv != null; why = '区間外 [' + (t.dWhy || '') + ']'; if (j < 0 || dp.sig[j].m - m > 400) still = false; }
    if (!still || j < 0 || !dp.sig[j]) continue; const S = dp.sig[j].s, a = S.asp; if (!a || a === 'R' || a === 'KD' || a === 'SH') continue;
    const k = t.no + ' ' + (S.name || S.kind) + ' ' + a + ' ' + why; MM.set(k, (MM.get(k) || 0) + 5); if (!MMT.has(k)) MMT.set(k, hs(T)); }
  if (process.env.LOSSW) for (const t of live) if (t.ph && t.ph.v < 0.1 && t.ph.mode === 'run' && (t.ph.why || '').includes(process.env.LOSSW)) { const k = t.no + ' ' + (t.dWhy || '') + ' @' + hs(Math.floor(T / 60) * 60); LW.set(k, (LW.get(k) || 0) + DT); }   // 検査用: LOSSW=信号機の名前 → どの列車が何に止められたか
  if (process.env.PROBE && process.env.PROBE.split(',').map(Number).includes(Math.floor(T))) { const r = eval(process.env.PROBEJS); if (process.env.PROBEOUT) fs.writeFileSync(process.env.PROBEOUT, String(r)); else console.log('PROBE', hs(T), r); }   // 検査用: PROBE=秒 PROBEJS=式
  if (process.env.DBG && Math.floor(T) % (+process.env.DBGS || 10) === 0) for (const t of live) if (process.env.DBG.split(',').includes(t.no)) { const p = t.ph, dp = t.dp; console.log('DBG', hs(T), t.no, p ? ('m=' + p.m.toFixed(0) + ' v=' + (p.v * 3.6).toFixed(0) + ' ' + p.mode + ' k=' + p.k + ' sig=' + p.lastSig + ' why=' + p.why + '[' + (t.dWhy || '') + ']' + (p.obsT ? ' OBS=' + p.obsT.no + (p.obsT.ph ? 'P' : 'f') + ' s=' + p.obsT.s.toFixed(1) + ' tgt=' + (p.obsT.tgt||0).toFixed(1) + ' m=' + Math.round(p.obsT.ph ? p.obsT.ph.m : p.obsT.dp ? p.obsT.dp.s2m(p.obsT.s) : 0) : '') + ' late=' + Math.round(p.delay) + (p.waitFor ? ' WAIT=' + p.waitFor.no + '(' + (p.waitFor.ph ? 'P m=' + Math.round(p.waitFor.ph.m) + ' ' + p.waitFor.ph.why + '[' + (p.waitFor.dWhy||'') + ']' : 'f s=' + (p.waitFor.s||0).toFixed(0)) + ')' : '') + ' locks=' + [...(t.dLocks || new Map()).keys()].join(',') + (dp.sig[p.lastSig + 1] ? ' next=' + dp.sig[p.lastSig + 1].s.name + '@' + dp.sig[p.lastSig + 1].m.toFixed(0) : '')) : 'outside s=' + t.s.toFixed(1) + ' tgt=' + (t.tgt || 0).toFixed(1) + ' [' + (t.dWhy || '') + ']' + (t.dByT ? ' by=' + t.dByT.no : '') + (t.blkBy && t.blk != null ? ' follow=' + t.blkBy.no + (t.blkBy.ph ? 'P' : 'f') + ' s=' + t.blkBy.s.toFixed(0) + '[' + (t.blkBy.dWhy || '') + ']' : '')); }
  // 区間内での重なり
  if (Math.floor(T) % 5 === 0) { dBuildOcc(live); for (const [e, l] of D_OCC) { if (dSecOf[e] < 0 || l.length < 2) continue; for (let i = 0; i < l.length; i++) for (let j = i + 1; j < l.length; j++) { const a = l[i], b = l[j]; if (dPartner(a.t, b.t) || a.t.cut || b.t.cut || a.t.unit || b.t.unit) continue; if (Math.min(a.hi, b.hi) - Math.max(a.lo, b.lo) > 1) { const key = [a.t.no, b.t.no].sort().join('/'); if (!collSet.has(key)) { collSet.add(key); coll++; if (collEx.length < 15) collEx.push(hs(T) + ' ' + key + ' e' + e + ' ' + (a.t.ph ? 'P' : 'f') + (b.t.ph ? 'P' : 'f')); } } } } }
}
const el = (Date.now() - t0) / 1000;
if (process.env.LOGOUT) fs.writeFileSync(process.env.LOGOUT, JSON.stringify(D_LOG.filter(x => x.k != null && x.t && !isNaN(x.late) && x.t.ev[x.k - x.t.k0]).map(x => [dTuneKey(x.t, x.k - x.t.k0), x.dep ? 1 : 0, Math.round(x.late)])));   // 秒の調整(disp_tune)用: [列車|駅|分, 発なら1, 遅れ秒]
if (process.env.LOSSW) { const g = new Map(); for (const [k, v] of LW) { const kk = k.replace(/ @.*/, ''); const x = g.get(kk) || { v: 0, t: k.replace(/.* @/, '') }; x.v += v; g.set(kk, x); } [...g].sort((a, b) => b[1].v - a[1].v).slice(0, 30).forEach(([k, x]) => console.log('  LOSSW', x.v + 's', k, 'from', x.t)); }
{ const L = [...D_LOSS].sort((a, b) => b[1] - a[1]); console.log('止まった・発車が遅れた秒数の合計', Math.round(L.reduce((s, x) => s + x[1], 0))); L.slice(0, +(process.env.NL || 25)).forEach(([k, v]) => console.log('  損失', Math.round(v) + 's', k)); }
{ const live = act.filter(t => t.ph); console.log('終了時に区間内', live.length, '止まって5分以上', live.filter(t => t.ph.waitT > 300 || (t.ph.mode === 'dwell' && t.ph.delay > 300)).length);
  live.filter(t => t.ph.waitT > 300 || (t.ph.mode === 'dwell' && t.ph.delay > 300)).slice(0, 25).forEach(t => { const p = t.ph, dp = t.dp, nx = dp.sig[p.lastSig + 1]; console.log('  停滞', t.no, p.mode, 'm=' + Math.round(p.m), '遅れ' + Math.round(p.delay), 'why=' + p.why, '[' + (t.dWhy || '') + ']', p.waitFor ? '待避待ち ' + p.waitFor.no : '', nx ? '次 ' + nx.s.name : '', 'locks', [...t.dLocks.keys()].join(','), dp.stops[p.k] ? dp.stops[p.k].name : '', p.obsT ? 'OBS ' + p.obsT.no : '', 'v=' + (p.v*3.6).toFixed(0), 'front=' + Math.round(p.m + p.L/2), nx ? 'sig@' + Math.round(nx.m) : ''); }); }
const ons = D_LOG.filter(x => x.onset); const ob = {}; for (const x of ons) { const k = x.where.replace(/\[.*\]/, '') + (x.wait ? ' 待避待ち' : '') + ' →' + x.st; ob[k] = (ob[k] || []); ob[k].push(x.t.no + '@' + hs(x.T) + x.where.replace(/^[^\[]*/, '')); }
Object.entries(ob).sort((a, b) => b[1].length - a[1].length).slice(0, 14).forEach(([k, v]) => console.log('  2分遅れの始まり', v.length, k, v.slice(0, 4).join(' ')));
const emer = D_LOG.filter(x => x.emer); emer.slice(0, +(process.env.NE || 0)).forEach(x => console.log('  非常', hs(x.T), x.no, x.emer, Math.round(x.v) + '→' + Math.round(x.vT), Math.round(x.m)));
const arr = D_LOG.filter(x => !x.exit && !x.dep && !x.emer && !x.onset && !isNaN(x.late)), ex = D_LOG.filter(x => x.exit && !x.onset && !isNaN(x.late));
const q = (a, f) => a.filter(f).length;
console.log('時間', el.toFixed(1) + 's', '着', arr.length, '遅れ>30s', q(arr, x => x.late > 30), '>60s', q(arr, x => x.late > 60), '>180s', q(arr, x => x.late > 180), '最大', Math.round(Math.max(0, ...arr.map(x => x.late))) + 's', '平均', (arr.reduce((s, x) => s + x.late, 0) / arr.length).toFixed(1) + 's');
console.log('区間を出た', ex.length, '遅れ>60s', q(ex, x => x.late > 60), '>180s', q(ex, x => x.late > 180), '最大', Math.round(Math.max(0, ...ex.map(x => x.late))) + 's');
if (process.env.MISM) { const g = [...MM].sort((a, b) => b[1] - a[1]); console.log('進行・注意なのに止まっている', g.length, '件', g.reduce((s, x) => s + x[1], 0) + '秒'); g.slice(0, 30).forEach(([k, v]) => console.log('  不一致', v + 's', MMT.get(k), k)); }
console.log('走りきらずに消えた', VAN.length, VAN.slice(0, +(process.env.NV || 12)).join(' | '));
console.log('信号冒進', D_STAT.spad, '非常ブレーキ', D_STAT.emer, '2分以上の信号待ち', D_STAT.sigwait, '重なり', coll);
collEx.forEach(x => console.log('  重なり', x));
for (const e of D_EV) if (e.kind === 'late' && /601秒|60[0-9]秒/.test(e.text)) console.log('  600秒待ち', hs(e.T), e.no, e.text);
const by = {}; for (const e of D_EV) { const k = e.kind + ' ' + e.text.replace(/\d+秒/, 'N秒'); by[k] = (by[k] || 0) + 1; }
Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 25).forEach(([k, n]) => console.log('  ', n, k));
{ const c = new Map(); for (const x of arr) c.set(x.t, (c.get(x.t) || 0) + 1); [...c].sort((a, b) => b[1] - a[1]).slice(0, 5).forEach(([t, n]) => console.log('  着の回数', t.no, n, D_LOG.filter(x => x.t === t && !x.onset).slice(0, 6).map(x => (x.exit ? 'EXIT' : x.name) + '@' + hs(x.T)).join(' '))); }
const seg = {}, lastBy = {};
const lastBy2 = new Map(); for (const x of D_LOG) { if (x.emer || x.onset || x.dep || isNaN(x.late)) continue; const pv = lastBy2.get(x.t); if (pv && !x.exit && !pv.exit) { const k = pv.name + '→' + x.name; const g = seg[k] || (seg[k] = { n: 0, sum: 0 }); g.n++; g.sum += x.late - pv.late; (g.ex || (g.ex = [])).push(x.no + '@' + hs(x.T) + '+' + Math.round(x.late - pv.late)); } lastBy2.set(x.t, x); }
Object.entries(seg).sort((a, b) => b[1].sum - a[1].sum).slice(0, 16).forEach(([k, g]) => console.log('  増えた遅れ', k, '本数', g.n, '合計', Math.round(g.sum) + 's', '平均', Math.round(g.sum / g.n) + 's', g.ex.slice(0, 6).join(' ')));
const worst = arr.slice().sort((a, b) => b.late - a.late).slice(0, 12); worst.forEach(x => console.log('  遅れ', x.no, x.name, Math.round(x.late) + 's', hs(x.T)));
`);
