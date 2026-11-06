// ===== 指令の指示と臨時の列車(行っとけダイヤ) =====
// 時刻表に無い列車(臨時の列車 D_DYN)を、運転指令の物理・信号でそのまま走らせる。
// 指示は「段の並び」: 例 [京急蒲田まで営業(元の停車駅)] → [京急川崎まで回送] → [折り返して普通 品川行き] → [留置]
//   段 = { to: 駅名, type: 種別のキー('kaiso' = 回送), stops: 'orig'(元の列車の停車駅) | 'type'(種別の停車駅) | 'all'(各駅), turn: true(この段の初めに折り返す) | false(進む) | null(近いほう), dest, no }
//   最後の段の後 = 'park'(いちばん近い空いている留置線・検車区へ回送) | 'stay'(その駅で待つ)
// 元の列車は、置き換えた時点で盤面から外し(t.gOut)、同じ場所・同じ速さで臨時の列車が続きを走る
const D_DYN = [];
let D_DYNN = 0;
if (typeof TYPES !== 'undefined' && !TYPES.kyuen) TYPES.kyuen = { name: '救援', short: '救援', color: '#e8a33a', stops: new Set() };
const D_DYNQ = [];   // [{T, f}] 時刻になったら呼ぶ
const dynLater = (T, f) => D_DYNQ.push({ T, f });
// ----- 経路探索(折り返しは ホームの停止位置・行き止まり で。ban のエッジは通らない)-----
// st = { e, t(0..1), d(0: a→b / 1: b→a / null) }, goals = [{ e, t, d?, pen? }]
function dynPath(st, goals, opt = {}) {
  const ban = opt.ban || null, REV = opt.revCost != null ? opt.revCost : 120, rev = !!opt.rev, WW = opt.wrong || 25, WWMAX = opt.wwMax != null ? opt.wwMax : 450;   // 逆線は渡り線までの短い距離だけ(WWMAX m)
  const dist = new Map(), ent = new Map(), prev = new Map(), H = new Heap(), gd = [], gk = [];
  const mul = (e, d) => { const x = E[e]; return (x.dir && Math.sign((d ? -1 : 1) * x.vx) === -x.dir ? WW : 1) * (x.depot && !opt.depotOK ? 5 : 1); };
  const cost = (e, d, a, b) => E[e].portal ? 0.01 : Math.abs(b - a) * E[e].len * mul(e, d);
  const push = (key, c, pe, from, kind) => { if (c < (dist.get(key) ?? Infinity)) { dist.set(key, c); ent.set(key, pe); prev.set(key, { from, kind }); H.push(c, key); } };
  for (const d of [0, 1]) if (st.d == null || st.d === d) push(st.e * 2 + d, 0, st.t, -1, 'start');
  let goal = -1;
  while (H.size) {
    const [c, key] = H.pop();
    if (key < 0) { goal = -1 - key; break; }
    if (c > dist.get(key) + 1e-9) continue;
    if (opt.maxCost && c > opt.maxCost) break;
    const e = key >> 1, d = key & 1, pe = ent.get(key), x = E[e];
    goals.forEach((g, gi) => { if (g.e !== e || (g.d != null && g.d !== d)) return; if (d ? g.t > pe + 1e-6 : g.t < pe - 1e-6) return;
      const gc = c + cost(e, d, pe, g.t) + (g.pen || 0); if (gc < (gd[gi] ?? Infinity)) { gd[gi] = gc; gk[gi] = key; H.push(gc, -1 - gi); } });
    const node = d ? x.a : x.b;
    if (rev && !x.portal) {
      let pr = null;
      if (!isNaN(stopX[e])) pr = paramOf(e, stopX[e]);
      else if (adj[node].length === 1) { const f = Math.min(0.5, 6 / x.len); pr = d ? f : 1 - f; }
      if (pr != null && (d ? pr < pe - 1e-4 : pr > pe + 1e-4)) push(e * 2 + (1 - d), c + cost(e, d, pe, pr) + REV, pr, key, 'rev');
    }
    const ce = c + cost(e, d, pe, d ? 0 : 1), s1 = d ? -1 : 1;
    for (const f of adj[node]) {
      if (f === e || (ban && ban.has(f))) continue;
      const fe = E[f], d2 = fe.a === node ? 0 : 1; let turn = 0;
      if (!x.portal && !fe.portal) { const dot = s1 * (d2 ? -1 : 1) * (x.vx * fe.vx + x.vy * fe.vy); if (dot <= -0.2) continue; if (dot < 0.99) turn = 0.3; }
      push(f * 2 + d2, ce + turn, d2 ? 1 : 0, key, 'go');
    }
  }
  if (goal < 0) return null;
  const g = goals[goal], states = [];
  for (let k = gk[goal]; ;) { const pv = prev.get(k); states.push({ key: k, pe: ent.get(k), kind: pv.kind }); if (pv.kind === 'start') break; k = pv.from; }
  states.reverse();
  const legs = []; let segs = [], dcur = 0, jump = false;
  const close = () => { if (segs.length && dcur > 0.05) legs.push({ segs, total: dcur, stops: [], revs: [], dyn: true }); segs = []; dcur = 0; jump = false; };
  for (let i = 0; i < states.length; i++) {
    const s = states[i], e = s.key >> 1, d = s.key & 1, nx = states[i + 1];
    if (E[e].portal) { jump = true; continue; }
    const t0 = s.pe, t1 = !nx ? g.t : nx.kind === 'rev' ? nx.pe : d ? 0 : 1;
    if (Math.abs(t1 - t0) > 1e-9) { const a = pointOn(e, t0), b = pointOn(e, t1), d1 = dcur + Math.abs(t1 - t0) * E[e].len; segs.push({ e, d, t0, t1, d0: dcur, d1, ax: a.x, ay: a.y, bx: b.x, by: b.y, jump }); jump = false; dcur = d1; }
    if (nx && nx.kind === 'rev') close();
  }
  close();
  let ww = 0; for (const L of legs) for (const q of L.segs) { const x = E[q.e]; if (x.dir && Math.sign((q.d ? -1 : 1) * x.vx) === -x.dir) ww += Math.abs(q.t1 - q.t0) * dEm[q.e]; }
  if (ww > WWMAX) return { wrong: ww };   // 渡り線が無く、逆線を長く走ることになる
  return legs.length ? { legs, cost: gd[goal], goal: g, ww } : null;
}
// 経路 r の [s0, s1](図の長さ)を切り出す
function dRouteSlice(r, s0, s1) {
  s0 = Math.max(0, s0); s1 = Math.min(r.total, s1); const segs = [];
  for (const g of r.segs) { if (g.d1 <= s0 + 1e-9 || g.d0 >= s1 - 1e-9) continue; const L = g.d1 - g.d0, fa = L > 0 ? (Math.max(s0, g.d0) - g.d0) / L : 0, fb = L > 0 ? (Math.min(s1, g.d1) - g.d0) / L : 1;
    const t0 = g.t0 + (g.t1 - g.t0) * fa, t1 = g.t0 + (g.t1 - g.t0) * fb, a = pointOn(g.e, t0), b = pointOn(g.e, t1);
    segs.push({ e: g.e, d: g.d, t0, t1, d0: Math.max(s0, g.d0) - s0, d1: Math.min(s1, g.d1) - s0, ax: a.x, ay: a.y, bx: b.x, by: b.y, jump: !!g.jump && g.d0 >= s0 }); }
  return { segs, total: Math.max(0, s1 - s0), stops: [], revs: [], dyn: true };
}
// 経路の上にあるホーム(駅名と止まる位置)
function dRouteStations(r) {
  const out = [];
  for (const g of r.segs) { if (isNaN(stopX[g.e]) || edgeStation[g.e] < 0) continue; const ts = paramOf(g.e, stopX[g.e]); if (ts < Math.min(g.t0, g.t1) - 1e-6 || ts > Math.max(g.t0, g.t1) + 1e-6) continue;
    const name = ST[edgeStation[g.e]].name, d = g.d0 + Math.abs(ts - g.t0) * E[g.e].len; if (out.length && out[out.length - 1].name === name) continue; out.push({ name, d }); }
  return out;
}
// 列車の先頭・後ろの位置(経路の上の点と向き)
function dEndPoint(t, front) {
  const p = t.ph, dp = t.dp, m = front ? p.m + p.L / 2 : p.m - p.L / 2, s = Math.max(0, Math.min(t.route.total, dp.m2s(m))), g = segAt(t.route, s), L = g.d1 - g.d0;
  return { e: g.e, t: g.t0 + (g.t1 - g.t0) * (L > 0 ? (s - g.d0) / L : 0), d: g.d, s };
}
// 種別の停車駅か
const dTypeStops = (type, name) => { const ty = TYPES[type]; if (!ty || type === 'kaiso' || type === 'kyuen') return false; return !ty.stops || ty.stops.has(name); };
// ----- 臨時の列車を作る -----
// o: { no, type, dest, cars, route, T, wait, stops: [{d, name, A?, P?, ev?}], from, to, prev, v0, cap, onEnd, run, hs, hs2, gTgt }
function dynMake(o) {
  const t = { dyn: true, no: o.no, type: o.type || 'kaiso', dest: o.dest || '', cars: o.cars || 8, route: o.route, start: o.T, end: Infinity, k0: 0, tt: true,
    run: o.run || { num: o.no, co: '京急', chain: false, key: null, duty: null }, prev: o.prev || null, next: null, gTgt: o.gTgt || null, hs: o.hs || null, hs2: o.hs2 || null,
    capK: o.cap || null, onEnd: o.onEnd || null, v0: o.v0 != null ? o.v0 : null, why: o.why || '', plan: o.plan || null };
  t.sd = [0, o.route.total]; t.A = [o.T, 1e9]; t.P = [o.T, 1e9]; t.names = ['', '']; t.ev = [null, null];
  const dp0 = dPrep(t), L = dLen(t), m0 = L / 2 + (o.g0 != null ? o.g0 : 0), mEnd = Math.max(m0, dp0.total - L / 2 - 1);
  const S = [];
  if (!(o.v0 > 0.5)) S.push({ m: m0, name: o.from || '', A: o.T, P: o.T + (o.wait || 0), ev: o.fromEv || null });   // 止まっているところから: 最初の停車(発車の時刻まで待つ)
  for (const x of o.stops || []) { const m = dp0.s2m(x.d); if (m > m0 + 5 && m < mEnd - 5) S.push({ m, name: x.name, A: x.A != null ? x.A : -1e9, P: x.P != null ? x.P : -1e9, ev: x.ev || null }); }
  S.push({ m: mEnd, name: o.to || '', A: -1e9, P: -1e9, ev: null });
  t.sd = S.map(x => dp0.m2s(x.m)); t.A = S.map(x => x.A); t.P = S.map(x => x.P); t.names = S.map(x => x.name); t.ev = S.map(x => x.ev);
  t.dp = null; dPrep(t);
  t.s = t.sv = t.tgt = o.v0 > 0.5 ? dp0.m2s(m0) : t.sd[0];
  D_DYN.push(t); return t;
}
function dynTarget(t, T) {
  if (t.gOut != null && T >= t.gOut) return false;
  if (T < t.start) return false;
  if (t.next && T >= t.next.start) return false;
  t.tgt = t.s; t.dwelling = !t.ph || t.ph.mode === 'dwell'; return true;
}
{ const f = dispTarget; dispTarget = function (t, T) { return t.dyn ? dynTarget(t, T) : f(t, T); }; }
{ const f = dStart; dStart = function (t, T, rg, o) { const r = f.apply(this, arguments); if (t.dyn && !o && t.v0 != null && t.ph) { t.ph.v = t.v0; t.ph.mode = 'run'; t.v0 = null; t.dStill = false; } return r; }; }
{ const f = dIncStep; dIncStep = function (act, T) { const r = f.apply(this, arguments); dynStep(act, T); return r; }; }
// 毎ステップ: 速さの制限・段の終わり・救援の連結・時刻の来た処理
function dynStep(act, T) {
  if (D_DYNQ.length) { const due = D_DYNQ.filter(x => x.T <= T); if (due.length) { for (const x of due) D_DYNQ.splice(D_DYNQ.indexOf(x), 1); for (const x of due) { try { x.f(T); } catch (e) { console.error(e); } } } }
  for (const t of act) {
    const p = t.ph; if (!p) continue;
    const cap = t.capK != null ? t.capK : t.gCap; if (cap != null) p.incCap = KMH(cap); else if (t.gCapWas) { p.incCap = null; } t.gCapWas = cap != null;
    if (t.dyn && p.done && !t.endT && !(t.gOut != null)) { t.endT = T; if (t.onEnd) { try { t.onEnd(t, T); } catch (e) { console.error(e); } } }
    if (t.gTgt && !t.gCplT && p.v < 0.1) { const g = dGapTo(t, t.gTgt); if (g != null && g < 4) { t.gCplT = T; if (t.onCouple) { try { t.onCouple(t, T); } catch (e) { console.error(e); } } } }
  }
  for (let i = D_DYN.length - 1; i >= 0; i--) { const t = D_DYN[i]; if ((t.gOut != null && T > t.gOut + 5) || (t.next && T > t.next.start + 5) || T < t.start - 3600) { if (typeof ttKill === 'function' && t.g) ttKill(t); dispKill(t); D_DYN.splice(i, 1); } }
}
// 救援の列車 r の先頭から、t までの距離(r の経路の上)
function dGapTo(r, t) {
  const p = r.ph; if (!p || !t.dOcc) return null; const front = p.m + p.L / 2; let best = Infinity;
  for (const sp of t.dOcc) for (const x of [sp.lo, sp.hi]) { const m = r.dp.onRoute(sp.e, x, front - 3); if (!isNaN(m) && m >= front - 3) best = Math.min(best, m - front); }
  return best < Infinity ? best : null;
}
// ----- 置き換え -----
// 列車を盤面から外す(その場で。次のコマから臨時の列車が続きを走る)
function dRetire(t, T) { t.gOut = T; if (t.dLocks) dUnlockAll(t); t.ph = null; t.dStill = false; }
// 留置先の候補: 引上線・留置線・検車区の線(計画で使っていない・空いている)
function dParkGoals(L) {
  const G = [], used = e => D_USED.has(e * 2) || D_USED.has(e * 2 + 1);
  for (const [name, list] of SIDINGS) for (const s of list) G.push({ e: s.e, t: s.t, d: E[s.e].a === s.node ? 1 : 0, name: name + ' 引上線', pen: used(s.e) ? 6000 : 0 });
  for (const st of YARD_ST) { const Y = yardOf(st); if (!Y) continue; for (const tr of Y.tracks) { const atA = E[tr.e].a === tr.node, f = Math.min(0.5, 6 / E[tr.e].len); G.push({ e: tr.e, t: atA ? f : 1 - f, d: atA ? 1 : 0, name: st + ' ' + tr.label, pen: 0 }); } }
  return G.filter(g => dSecOf[g.e] >= 0 && !(D_OCC.get(g.e) || []).length && !(D_LOCK.get(g.e) || []).length && !D_DYN.some(x => x.parkE === g.e)).map(g => Object.assign(g, { pen: g.pen + (dEm[g.e] >= L * 0.9 ? 0 : 600) }));
}
// 駅のホーム(行き先の候補)
function dStationTracks(name) {
  const s = stByName.get(name); if (!s) return [];
  return s.stops.map(([e, x]) => ({ e, x, y: (dBy[E[e].a] + dBy[E[e].b]) / 2 }))
    .filter(q => dSecOf[q.e] >= 0).sort((a, b) => a.y - b.y || a.e - b.e)
    .map((q, i) => ({ e: q.e, i, label: `上から${i + 1}番線` }));
}
function dStationGoals(name, L, track = '') {
  const s = stByName.get(name); if (!s) return [];
  // 運転主任の選び方: いまふさがっている番線・これから15分のうちに列車が入る番線は避ける(入ってくる列車と互いに待ち合って動けなくなる)
  const soon = e => { let n = 0; for (const [o, k] of D_PLAT.get(e) || []) if (o.gOut == null && o.P[k] > D_NOW && o.A[k] < D_NOW + 900) n++; return n; };
  const tracks = dStationTracks(name).filter(q => track === '' || q.i === +track), selected = new Set(tracks.map(q => q.e));
  return s.stops.filter(([e]) => selected.has(e)).map(([e, x]) => ({ e, t: paramOf(e, x), d: null, name, pen: ((D_OCC.get(e) || []).some(o => o.t.gOut == null) ? 300 : 0) + soon(e) * 250 }));
}
let D_CMDLOG = [];
const dCmdLog = (T, t, text) => { D_CMDLOG.push({ T, no: t ? t.no : '', text }); if (D_CMDLOG.length > 200) D_CMDLOG.shift(); dEvent(T, t, 'wait', '指令: ' + text); };
// 指示を出す前の確かめ: 各段の行き先へ、前の段の終わりから(進むか折り返して)行けるか。だめなら理由
// 1段ぶんの経路: F = 列車の先頭、R = 後ろ(どちらも経路の上の点と向き)。進む / ホームで折り返す / 引上線に入って折り返す
function dFindStep(F, R, s, goals) {
  const tries = []; let wrong = false;
  if (s.turn !== true) { const r = dynPath({ e: R.e, t: R.t, d: R.d }, goals, {}); if (r && r.wrong) wrong = true; else if (r) tries.push({ legs: r.legs, cost: r.cost, turn: false, goal: r.goal }); }
  if (s.turn !== false) { const r = dynPath({ e: F.e, t: F.t, d: 1 - F.d }, goals, {}); if (r && r.wrong) wrong = true; else if (r) tries.push({ legs: r.legs, cost: r.cost + 60, turn: true, goal: r.goal }); }
  if (s.turn !== false && !tries.some(x => x.turn)) { const r = dynPath({ e: R.e, t: R.t, d: R.d }, goals, { rev: true, revCost: 150 }); if (r && r.wrong) wrong = true; else if (r && r.legs.length > 1) tries.push({ legs: r.legs, cost: r.cost + 60, turn: true, goal: r.goal }); }   // 引上線に入って折り返す
  tries.sort((x, y) => x.cost - y.cost);
  return { best: tries[0] || null, wrong };
}
const dLegEnd = best => { const L = best.legs[best.legs.length - 1], g = L.segs[L.segs.length - 1]; return { e: g.e, t: g.t1, d: g.d }; };
// 段 s の経路。次の段 nx があれば、そこへ行ける番線を選ぶ(だめな番線を外して探し直す)
function dStepPlan(F, R, s, nx, L) {
  let goals = dStationGoals(s.to, L, s.track == null ? '' : s.track); if (!goals.length) return { err: s.track != null && s.track !== '' ? `${s.to}の指定した番線は運転指令の区間にありません` : `${s.to}のホームが運転指令の区間にありません` };
  let wrong = false, last = null;
  for (let k = 0; k < 8 && goals.length; k++) {
    const r = dFindStep(F, R, s, goals); wrong = wrong || r.wrong; if (!r.best) break;
    if (!nx || nx.park) return { best: r.best };
    const E1 = dLegEnd(r.best), g2 = dStationGoals(nx.to, L, nx.track == null ? '' : nx.track); if (!g2.length) return { err: `${nx.to}のホームが運転指令の区間にありません` };
    const r2 = dFindStep(E1, E1, nx, g2); if (r2.best) return { best: r.best };
    last = r2; const ge = r.best.goal.e; goals = goals.filter(g => g.e !== ge);
  }
  if (last) return { err: `${s.to}から${nx.to}へは${nx.turn === false ? '進めません' : '折り返せません'}(${last.wrong ? '近くに渡り線がありません' : '経路がありません'})`, next: true };
  return { err: s.track != null && s.track !== '' ? `${s.to}の指定番線へ入る経路がありません` : wrong ? `${s.to}へは、ここからは行けません(折り返しに使える渡り線がありません)` : `${s.to}への経路がありません` };
}
// 指示を出す前の確かめ: 各段の行き先へ、前の段の終わりから(進むか折り返して)行けるか。だめなら理由
function dPreCheck(t, steps) {
  let F = dEndPoint(t, true), R = dEndPoint(t, false);
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i]; if (s.park) return null;
  const r = dStepPlan(F, R, s, steps[i + 1], 0); if (r.err) return r.err;
    F = R = dLegEnd(r.best);
  }
  return null;
}
// 段の並びを実行する。t = 今走っている列車(時刻表の列車でも臨時の列車でも)。返り値: { ok, msg }
function dOrder(t, steps, T, opt = {}) {
  const p = t.ph; if (!p) return { ok: false, msg: '運転指令の区間の外にいるので指示できません' };
  if (!steps.length && opt.after !== 'park') return { ok: false, msg: '指示がありません' };
  if (!steps.length) steps = [{ park: true }];
  { const e = dPreCheck(t, steps); if (e) return { ok: false, msg: e }; }
  const job = { t0: t, steps: steps.slice(), after: opt.after || 'stay', i: 0, no: t.no, cars: t.cars, hs: t.hs, hs2: t.hs2, base: t.dyn ? t.base || t : t, cap: opt.cap, log: [] };
  // 1段目: いまの位置から。止まっているなら(駅で)発車の時刻まで待つ
  const st0 = p.mode === 'dwell' ? t.dp.stops[p.k] : null;
  const r = dStepRoute(t, job.steps[0], job, T, true); if (!r) return { ok: false, msg: job.err || '経路が見つかりません' };
  dRetire(t, T);
  // 新しい指令で行路を置き換えたら、旧時刻表の発車時刻は引き継がない。実到着から最低15秒だけ停車する。
  dRunStep(job, r, T, { prev: null, v0: p.mode === 'dwell' ? 0 : p.v, wait: st0 ? Math.max(0, (p.arrT || T) + 15 - T) : 0, fromName: st0 ? st0.name : '' });
  return { ok: true, msg: job.msg || '', job };
}
// 段 s の経路(いまの列車の位置から)。first = 置き換える最初の段(元の列車の経路の続きを優先)
function dStepRoute(t, s, job, T, first) {
  const p = t.ph, L = p.L;
  if (s.park) {   // 留置: いちばん近い空いている線へ(折り返しあり)
    const G = dParkGoals(L); if (!G.length) { job.err = '空いている留置線・検車区の線がありません'; return null; }
    const a = dEndPoint(t, false), res = dynPath({ e: a.e, t: a.t, d: a.d }, G, { rev: true, revCost: 150, depotOK: true });
    if (!res || res.wrong) { job.err = '留置線への経路が見つかりません'; return null; }
    return { legs: res.legs, goal: res.goal, turn: false };
  }
  const nx = job.steps[job.i + 1];
  // 元の列車の経路にその駅があれば、その経路の続き(時刻表の時刻も使う)。次の段がそこからできるときだけ
  if (first && !t.dyn && s.turn !== true && (s.track == null || s.track === '')) {
    const k = t.dp.stops.findIndex(x => x.name === s.to && x.m > p.m - 1);
    if (k >= 0) { const st = t.dp.stops[k], fr = Math.min(st.m + Math.max(L / 2, st.half - 5), st.xmax) + 1, s0 = t.dp.m2s(p.m - L / 2), s1 = Math.min(t.route.total, t.dp.m2s(fr)), rt = dRouteSlice(t.route, s0, s1);
      let ok = !nx || nx.park; if (!ok) { const g = rt.segs[rt.segs.length - 1], E1 = { e: g.e, t: g.t1, d: g.d }, g2 = dStationGoals(nx.to, L, nx.track == null ? '' : nx.track); ok = g2.length && !!dFindStep(E1, E1, nx, g2).best; }
      if (ok) return { legs: [rt], turn: false, orig: true }; }
  }
  const r = dStepPlan(dEndPoint(t, true), dEndPoint(t, false), s, nx, L);
  if (r.err) { job.err = r.err; return null; }
  return r.best;
}
// 段を走る臨時の列車を出す(脚 = 折り返しで区切った経路。脚ごとに1本の臨時の列車をつなぐ)
function dRunStep(job, r, T, o) {
  const s = job.steps[job.i] || { park: true }, legs = r.legs, base = job.base;
  const type = s.park ? 'kaiso' : s.type || base.type, dest = s.park ? '回送' : s.dest || s.to;
  let prev = o.prev;
  const mkLeg = (li, T1, v0, wait, fromName) => {
    const route = legs[li], last = li === legs.length - 1;
    let stops = [];
    if (!s.park && type !== 'kaiso') {
      const want = name => s.stops === 'all' ? true : s.stops === 'orig' ? (base.names || []).some((n, i) => n === name && !(base.ev[i] && base.ev[i].thru)) || name === s.to : dTypeStops(type, name);
      const tm = new Map(); if (r.orig && s.stops !== 'all' && base.dp) for (const x of base.dp.stops) if (x.name && !x.thru) tm.set(x.name, x);   // 元の時刻(続きのときだけ)
      stops = dRouteStations(route).filter(x => x.name !== s.to && want(x.name)).map(x => { const y = tm.get(x.name); return { d: x.d, name: x.name, A: y ? y.A : null, P: y ? y.P : null, ev: y ? { arr: y.A / 60, dep: y.P / 60 } : null }; });
    }
    const D = dynMake({ no: s.no || job.no, type, dest, cars: job.cars, route, T: T1, wait, v0, stops, from: fromName || '', to: last && !s.park ? s.to : '', prev, hs: job.hs, hs2: job.hs2, cap: s.cap || job.cap || null, why: job.why });
    D.base = base; D.job = job;
    if (prev) prev.next = D; prev = D;
    if (last && s.park) D.parkE = r.goal.e;
    D.onEnd = (x, Tz) => {
      if (!last) { const nx = mkLeg(li + 1, Tz, 0, 90, ''); nx.lockEarly = 150; return; }   // 折り返し(運転士が反対側の運転台へ、約1分半)。着いたらすぐ折り返しの進路を作る(後ろの列車を手前の信号で止める。入り込まれると互いに動けない)
      const dw = type !== 'kaiso' && !s.park ? 60 : 20;   // お客さまを降ろす
      if (s.park) { dCmdLog(Tz, x, `${x.no} ${r.goal.name}に留置`); x.parked = r.goal.name; if (job.onPark) job.onPark(x, Tz); return; }
      job.i++;
      if (job.i >= job.steps.length) {
        if (job.after === 'park') { job.steps.push({ park: true }); }
        else { x.stayAt = s.to; if (job.onDone) job.onDone(x, Tz); return; }
      }
      // 次の段の経路はすぐ決めて進路を押さえる(お客さまを降ろす・折り返す時間は、その場で待つ)
      const nr = dStepRoute(x, job.steps[job.i], job, Tz, false); if (!nr) { dCmdLog(Tz, x, `${x.no}: ${job.err}`); x.stayAt = s.to; if (job.onFail) job.onFail(x, job.err); return; }
      const D2 = dRunStep(job, nr, Tz, { prev: x, v0: 0, wait: dw + (nr.turn ? 75 : 0), fromName: s.to }); D2.lockEarly = 150;
    };
    return D;
  };
  const D = mkLeg(0, T, o.v0, o.wait || 0, o.fromName);
  if (!job.first) job.first = D;
  return D;
}
// 指示の文章(画面・無線)
function dOrderText(steps, after) {
  const w = steps.map(s => s.park ? '留置線へ回送' : `${s.turn ? '折り返して' : ''}${s.to}${s.track != null && s.track !== '' ? `(${dStationTracks(s.to).find(x => x.i === +s.track)?.label || '指定番線'})` : ''}まで${s.type === 'kaiso' ? '回送' : (TYPES[s.type] ? TYPES[s.type].name : '') + (s.stops === 'all' ? '(各駅に停車)' : '')}`);
  if (after === 'park') w.push('そのあと留置線へ回送');
  return w.join(' → ');
}
// 列車の前方の駅(経路の上で、まだ着いていない駅)。via = 止まる駅か
function dAheadStations(t, max = 40) {
  const p = t.ph; if (!p) return [];
  const all = dRouteStations(t.route), out = [];
  for (const x of all) { const m = t.dp.s2m(x.d); if (m < p.m - 2) continue; if (p.mode === 'dwell' && Math.abs(m - p.m) < 3) continue; out.push({ name: x.name, m, stop: t.dp.stops.some(s => s.name === x.name && !s.thru) }); if (out.length >= max) break; }
  return out;
}
// 駅に引上線・渡り線・検車区があるか(折り返し・打ち切りの候補を出すとき)
const D_TURNC = new Map();
function dCanTurn(name) {
  if (D_TURNC.has(name)) return D_TURNC.get(name);
  let ok = false; const S = stByName.get(name);
  if (S && (YARD_ST.has(name) || SIDINGS.has(name))) ok = true;   // 検車区・引上線のある駅
  if (S && !ok) {
    const near = new Set(); for (const sec of DSEC) { const L = [...sec.stInfo].sort((a, b) => a[1].km - b[1].km).map(x => x[0]), k = L.indexOf(name); if (k < 0) continue; for (const q of [k - 2, k - 1, k + 1, k + 2]) if (L[q] && L[q] !== name) near.add(L[q]); }
    const goals = [...near].flatMap(n => dStationGoals(n, 0)).map(g => Object.assign(g, { pen: 0 }));
    for (const [e, x] of S.stops) { if (dSecOf[e] < 0 || ok) continue; const sp = paramOf(e, x);
      for (const d of [0, 1]) { const ed = E[e]; if (ed.dir && Math.sign((d ? -1 : 1) * ed.vx) === -ed.dir) continue;   // 正しい向きで着いた列車
        const r = dynPath({ e, t: sp, d: 1 - d }, goals, { maxCost: 900 }); if (r && !r.wrong) { ok = true; break; } } }
  }
  D_TURNC.set(name, ok); return ok;
}
// 臨時の列車をすべて消す(1日の始めに戻したとき)
function dynReset() { for (const t of D_DYN) { if (typeof ttKill === 'function' && t.g) ttKill(t); dispKill(t); } D_DYN.length = 0; D_DYNQ.length = 0; }
