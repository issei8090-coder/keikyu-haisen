// 基準の走りの記録: 固定の計画(fix/plan_日.json.gz)を、自動の順序変更ありで1日走らせ、
//   分岐を通った秒・区間に入った秒・待避を実際にしたか を fix/order_日_範囲.json.gz に書く(src/disp.js の D_REC、assemble.py が埋める)
//   node --max-old-space-size=8000 tools/mkorder.js wd [範囲 kq|all](範囲は運転指令の範囲。既定 kq = 京急だけ)
const fs = require('fs'), zlib = require('zlib');
const day = process.argv[2] || 'wd', scope = process.argv[3] || 'kq'; process.env.SCOPE = scope;
const H0 = 4.4, H1 = 25.9, DT = 1;
const D = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const hs = s => String(Math.floor(s / 3600) % 24).padStart(2, '0') + ':' + String(Math.floor(s / 60) % 60).padStart(2, '0');
eval(fs.readFileSync('src/core.js', 'utf8') + fs.readFileSync('src/ttcore.js', 'utf8') + fs.readFileSync('src/fixload.js', 'utf8') + fs.readFileSync('src/disp.js', 'utf8').replace('/*DISPCFG*/', fs.readFileSync('disp_cfg.json', 'utf8')) + `
const J = JSON.parse(zlib.gunzipSync(fs.readFileSync('fix/plan_' + day + '.json.gz')).toString());
const FX = fixRevive(J), list = FX.list.concat([...FX.reserve.values()]); list.sort((a, b) => a.start - b.start);
D_AUTO = true; D_REC = null;
console.log(day, scope, '区間', DSEC.map(s => s.id).join(','), '待避', dispPlan(list));
// 調べるもの: 列車ごとに、分岐(D_NODEQ)・区間の入口(D_ENTQ)を通る位置(経路の上の長さ)の順
const probe = new Map(); const add = (o, d, key, kind) => { if (!probe.has(o)) probe.set(o, []); probe.get(o).push({ d, key, kind, T: NaN }); };
for (const [, q] of D_NODEQ) for (const c of q) add(c.o, c.d, c.key, 'n');
for (const c of D_ENTQ) add(c.o, c.d, c.key, 'e');
for (const [, L] of probe) { L.sort((a, b) => a.d - b.d); L.i = 0; }
const waits = []; for (const t of list) if (t.dWait) for (const ks of Object.keys(t.dWait)) for (const c of t.dWait[ks]) waits.push({ t, k: +ks, o: c.o, sX: c.sX, dep: NaN, pass: NaN, key: dRecKey(t) + '|' + ks + '|' + dRecKey(c.o) });
const byT = new Map(); for (const w of waits) { if (!byT.has(w.t)) byT.set(w.t, []); byT.get(w.t).push(w); if (!byT.has(w.o)) byT.set(w.o, []); byT.get(w.o).push(w); }
console.log('分岐・入口', [...probe.values()].reduce((a, L) => a + L.length, 0), '待避の組', waits.length);
const pos = t => { if (t.ph && t.dp) return t.dp.m2s(t.ph.m); return t.sv != null ? t.s : NaN; };   // 列車の中心の位置(経路の上の長さ)
let ptr = 0, cand = [], lastT = NaN; const t0 = Date.now();
for (let T = H0 * 3600; T < H1 * 3600; T += DT) {
  while (ptr < list.length && list[ptr].start <= T) cand.push(list[ptr++]);
  const live = [];
  for (const t of cand) { if (dispTarget(t, T)) { live.push(t); t.was = true; } else { if (t.was) { dispKill(t); t.sv = null; t.gone = true; } else if (T > t.end + 3600) t.gone = true; } }
  cand = cand.filter(t => !t.gone);
  ttFollow(live, T, lastT); dispStep(live, T, lastT); lastT = T;
  for (const t of live) {
    const s = pos(t); if (isNaN(s)) continue;
    const L = probe.get(t); if (L) while (L.i < L.length && s >= L[L.i].d) { L[L.i].T = T; L.i++; }
    const W = byT.get(t); if (W) for (const w of W) {
      if (w.t === t && isNaN(w.dep) && t.sd && s > t.sd[w.k] + 5) w.dep = T;
      if (w.o === t && isNaN(w.pass) && t.s > w.sX + 12) w.pass = T; }
  }
  if (Math.floor(T) % 3600 === 0) console.log(' ', hs(T), '在線', live.length, ((Date.now() - t0) / 1000).toFixed(0) + 's');
}
const n = [], e = [], w = [];
for (const [, L] of probe) for (const p of L) if (!isNaN(p.T)) (p.kind === 'n' ? n : e).push([p.key, p.T]);
let keep = 0, drop = 0; for (const x of waits) { if (isNaN(x.dep) && isNaN(x.pass)) continue; const k = !isNaN(x.pass) && (isNaN(x.dep) || x.pass <= x.dep + 1) ? 1 : 0; w.push([x.key, k]); k ? keep++ : drop++; }
const out = { v: 1, day, scope, key: J.key, at: new Date().toISOString(), n, e, w };
fs.writeFileSync('fix/order_' + day + '_' + scope + '.json.gz', zlib.gzipSync(JSON.stringify(out), { level: 9 }));
console.log('記録 分岐', n.length, '入口', e.length, '待避 した', keep, '待たずに出た', drop, ((Date.now() - t0) / 1000).toFixed(0) + 's');
`);
