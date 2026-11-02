// 駅間の最短時間と時刻表の比べ: 列車を1本ずつ、ほかの列車がいない状態で(制限いっぱいで)走らせる
// node tools/disp_free.js wd [holdDep=1|0]   → _tmp/disp/free_<日>_<hold>.json と表
const fs = require('fs');
const D = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const TT = JSON.parse(fs.readFileSync('tt.json', 'utf8'));
const day = process.argv[2] || 'wd', hold = (process.argv[3] || '1') === '1';
const cfg = JSON.parse(fs.readFileSync('disp_cfg.json', 'utf8'));
cfg.dispatch = Object.assign({}, cfg.dispatch, { early: 99999, holdDep: hold });
const hs = s => String(Math.floor(s / 3600) % 24).padStart(2, '0') + ':' + String(Math.floor(s / 60) % 60).padStart(2, '0') + ':' + String(Math.floor(s % 60)).padStart(2, '0');
eval(fs.readFileSync('src/core.js', 'utf8') + fs.readFileSync('src/ttcore.js', 'utf8') + fs.readFileSync('src/disp.js', 'utf8').replace('/*DISPCFG*/', JSON.stringify(cfg)) + `
const raw = JSON.parse(fs.readFileSync('_tmp/disp/plan_' + day + '.json', 'utf8'));
const fix = o => { if (Array.isArray(o)) { for (let i = 0; i < o.length; i++) { const v = o[i]; if (v && typeof v === 'object') { if (v.$ref != null) o[i] = raw[v.$ref]; else fix(v); } } } else for (const k in o) { const v = o[k]; if (v && typeof v === 'object') { if (v.$ref != null) o[k] = raw[v.$ref]; else fix(v); } } };
raw.forEach(fix);
const list = raw.filter(t => t && t.route && !t.unit && !t.cut);
dispPlan(list);
const NAME = { local: '普通', exp: '急行' };
const rows = [];
let done = 0; const t0 = Date.now();
for (const t of list) {
  if (!t.route.segs.some(g => dSecOf[g.e] >= 0)) continue;
  D_OCC.clear(); D_OCCN.clear(); D_LOCK.clear(); D_LOCKN.clear(); D_LOG = [];
  t.ph = null; t.dLocks = null; t.dp = null; t.dWait = null; t.sv = null; t.dHeld = false; t.dHi = null; t.was = false; t.gone = false;
  const sv = t.prev; t.prev = null;
  let lastT = NaN;
  for (let T = t.start - 2; T < t.end + 900; T += 1) {
    const live = dispTarget(t, T) ? [t] : [];
    if (!live.length && t.was) break; if (live.length) t.was = true;
    ttFollow(live, T, lastT); dispStep(live, T, lastT); lastT = T;
  }
  t.prev = sv;
  const arr = new Map(); for (const x of D_LOG) if (x.t === t && x.name && !x.exit && !x.onset && !x.emer) arr.set(x.name, x.T);
  const dp = t.dp; if (!dp) continue;
  const st = dp.stops.filter(x => !x.thru && x.name);
  for (let i = 0; i + 1 < st.length; i++) {
    const a = st[i], b = st[i + 1]; if (!arr.has(a.name) || !arr.has(b.name)) continue;
    const free = arr.get(b.name) - a.P, sch = b.A - a.P;
    rows.push({ no: t.no, type: t.type, a: a.name, b: b.name, sch, free: Math.round(free), mar: Math.round(sch - free), at: hs(a.P) });
  }
  if (++done % 100 === 0) console.error(done, ((Date.now() - t0) / 1000).toFixed(0) + 's');
}
fs.writeFileSync('_tmp/disp/free_' + day + '_' + (hold ? 1 : 0) + '.json', JSON.stringify(rows));
// 駅間ごとのまとめ
const g = new Map(); for (const r of rows) { const k = r.a + '→' + r.b; if (!g.has(k)) g.set(k, []); g.get(k).push(r); }
const out = [];
for (const [k, l] of g) { const m = l.map(r => r.mar).sort((a, b) => a - b); out.push({ k, n: l.length, min: m[0], med: m[Math.floor(m.length / 2)], neg: l.filter(r => r.mar < 0).length, worst: l.sort((a, b) => a.mar - b.mar)[0] }); }
out.sort((a, b) => a.min - b.min);
console.log('列車', done, '駅間の組', rows.length, '時刻表より最短が長い(走れない)組', rows.filter(r => r.mar < 0).length);
console.log('駅間 本数 余裕の最小 中央 足りない本数 (最小の列車)');
for (const o of out) console.log(o.k, o.n, o.min, o.med, o.neg, '(' + o.worst.no + ' ' + o.worst.type + ' ' + o.worst.at + ' 時刻表' + o.worst.sch + '秒 最短' + o.worst.free + '秒)');
`);
