// ===== 事故・支障(運転指令): 手動で起こす / 自動(ランダム・シード)で起こす =====
// 種類(2026-11-06 ユーザー指定):
//   car   車両故障: その列車が常用ブレーキで止まり、n 分動けない(駅に止まっていれば発車できない)
//   block 人身事故・線路支障: 駅間の片方向か両方向が n 分通れない(中の信号機を停止にする)。人身事故はその場の列車が非常ブレーキで止まる
//   dwell 急病人・ドア故障: 駅で次に止まる(または選んだ)列車の停車が n 分延びる
//   jr    JR の人身事故による混雑(振替輸送): 乗換駅の客が何倍かになる(乗降客数で停車時間 D_CROWD と合わせて効く)
// 時間 dur(秒)。Infinity = 未定(手で解除するまで)。自動は D_INCAUTO の件数・シードから、その日の6〜23時にばらまく(起きるまで画面に出さない)
const D_INC = [];   // { id, kind, T0, dur, on, done, src: '手動'|'自動', ... }
let D_INCID = 0;
const D_INCAUTO = { on: false, n: 3, seed: 1, w: { car: 35, block: 25, dwell: 25, jr: 15 } };
const D_INCNAME = { car: '車両故障', block: '人身事故・線路支障', dwell: '急病人・ドア故障', jr: 'JR の人身事故による混雑' };
const D_JRPRESET = { '京浜東北線・東海道線': ['品川', '京急蒲田', '京急川崎', '京急鶴見', '横浜'], '横須賀線': ['品川', '横浜', '金沢八景', '逗子・葉山', '横須賀中央', '京急久里浜'], '南武線': ['京急川崎'] };
function dIncRng(seed) { let a = seed >>> 0 || 1; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
// 列車の先頭のキロ程と、区間・向き(1 = 下り)
function dTrainKm(t) {
  const p = t.ph, dp = t.dp; if (!p || !dp) return null;
  const s = dp.m2s(Math.min(p.m + p.L / 2, dp.total)), g = segAt(t.route, Math.max(0, Math.min(t.route.total, s))); if (!g || dSecOf[g.e] < 0) return null;
  const f = g.d1 > g.d0 ? (s - g.d0) / (g.d1 - g.d0) : 0, u = g.t0 + (g.t1 - g.t0) * Math.max(0, Math.min(1, f)), a = E[g.e].a, b = E[g.e].b;
  return { km: dKm[a] + (dKm[b] - dKm[a]) * u, si: dSecOf[g.e], dn: dDn(g.e * 2 + g.d) };
}
// 区間ごとの駅の並び(キロ程の順)と隣どうしの駅間
function dIncPairs() {
  const R = [];
  DSEC.forEach((sec, si) => { const L = [...sec.stInfo].map(([nm, x]) => ({ nm, km: x.km })).sort((a, b) => a.km - b.km);
    for (let i = 0; i + 1 < L.length; i++) R.push({ si, sec: sec.id, a: L[i].nm, b: L[i + 1].nm, km0: L[i].km, km1: L[i + 1].km }); });
  return R;
}
function dIncAdd(x) {
  const o = Object.assign({ id: ++D_INCID, on: false, done: false, src: '手動', dur: 600 }, x);
  // 人身事故は手動・自動を問わず、発生から最低1時間は自動解除しない
  if (o.kind === 'block' && o.jin && o.dur !== Infinity) o.dur = Math.max(3600, Number(o.dur) || 0);
  if (o.T0 == null) o.T0 = D_NOW;
  D_INC.push(o); return o;
}
function dIncClear(o) { if (!o.on) { o.done = true; o.on = false; dIncOff(o); return; } o.dur = Math.max(0, D_NOW - o.T0); }
function dIncReset() { for (const o of D_INC) if (o.on) dIncOff(o); D_INC.length = 0; D_INCID = 0; dIncAutoGen(); }
// 自動: その日の事故をシードから作る(時刻・種類・場所・時間)。列車は起きる時刻に走っている列車から選ぶ
function dIncAutoGen() {
  for (let i = D_INC.length - 1; i >= 0; i--) if (D_INC[i].src === '自動' && !D_INC[i].on && !D_INC[i].done) D_INC.splice(i, 1);
  if (!D_INCAUTO.on || !D_INCAUTO.n) return;
  const rnd = dIncRng(D_INCAUTO.seed * 7919 + (D_DAY === 'hd' ? 1 : 0)), W = D_INCAUTO.w, tot = Object.values(W).reduce((a, b) => a + b, 0);
  const pairs = dIncPairs(), pax = (D_PAX && D_PAX.駅) || {}, sts = [...new Set(DSEC.flatMap(s => [...s.stInfo.keys()]))].filter(n => pax[n]);
  const paxTot = sts.reduce((a, n) => a + pax[n], 0);
  for (let i = 0; i < D_INCAUTO.n; i++) {
    let r = rnd() * tot, kind = 'car'; for (const k of Object.keys(W)) { if ((r -= W[k]) < 0) { kind = k; break; } }
    const T0 = Math.round((6 + rnd() * 17) * 3600), o = { kind, T0, src: '自動', seed: rnd(), seed2: rnd() };
    if (kind === 'car') o.dur = Math.round((5 + rnd() * 15) * 60);
    else if (kind === 'block') { const p = pairs[Math.floor(rnd() * pairs.length)]; if (!p) continue; const jin = rnd() < 0.7; Object.assign(o, { si: p.si, a: p.a, b: p.b, km0: p.km0, km1: p.km1, dir: jin ? 'both' : rnd() < 0.5 ? 'down' : 'up', jin, dur: Math.round((jin ? 35 + rnd() * 35 : 15 + rnd() * 30) * 60) }); }
    else if (kind === 'dwell') { let x = rnd() * paxTot, st = sts[0]; for (const n of sts) { if ((x -= pax[n]) < 0) { st = n; break; } } Object.assign(o, { st, dir: rnd() < 0.5 ? 'down' : 'up', dur: Math.round((3 + rnd() * 7) * 60) }); }
    else { const ks = Object.keys(D_JRPRESET), k = ks[Math.floor(rnd() * ks.length)]; Object.assign(o, { line: k, stations: D_JRPRESET[k].filter(n => sts.includes(n)), mul: Math.round((1.5 + rnd()) * 10) / 10, dur: Math.round((30 + rnd() * 90) * 60) }); }
    dIncAdd(o);
  }
}
const dIncEnd = o => o.T0 + (o.dur == null ? Infinity : o.dur);
const dIncDirOK = (o, dn) => o.dir === 'both' || o.dir === 'any' || o.dir == null || (o.dir === 'down') === !!dn;
// 毎ステップ: 始まり・終わり
function dIncStep(act, T) {
  for (const o of D_INC) {
    if (o.done) continue;
    if (!o.on && T >= o.T0 && T < dIncEnd(o)) { if (dIncOn(o, act, T)) { o.on = true; dEvent(T, o.t || null, 'emer', `${o.src === '自動' ? '【自動】' : ''}${D_INCNAME[o.kind]}: ${dIncWhere(o)}(${o.dur === Infinity ? '解除まで' : Math.round(o.dur / 60) + '分'})`); if (typeof gIncOn === 'function') gIncOn(o, T); } }
    else if (o.on && T >= dIncEnd(o) && o.hold && !o.ok) { if (!o.ready) { o.ready = true; if (typeof gIncReady === 'function') gIncReady(o, T); } }   // ゲーム: 現場の処理が終わっても、指令が再開を指示するまで続く
    else if (o.on && T >= dIncEnd(o)) { dIncOff(o); o.on = false; o.done = true; o.Tend = T; dEvent(T, o.t || null, 'wait', `${D_INCNAME[o.kind]} 解除: ${dIncWhere(o)}`); if (typeof gIncOff === 'function') gIncOff(o, T); }
    else if (o.on) dIncKeep(o, act, T);
    else if (!o.on && T >= dIncEnd(o)) o.done = true;
  }
  if (typeof gStep === 'function') gStep(act, T);   // 無線(src/radio.js)
}
function dIncWhere(o) {
  if (o.kind === 'car') return (o.t ? o.t.no + ' ' : '') + (o.at || '');
  if (o.kind === 'block') return `${o.a}〜${o.b} ${o.dir === 'both' ? '上下線' : o.dir === 'down' ? '下り線' : '上り線'}${o.jin ? '(人身事故)' : ''}`;
  if (o.kind === 'dwell') return `${o.st}${o.dir === 'down' ? ' 下り' : o.dir === 'up' ? ' 上り' : ''}${o.t ? ' ' + o.t.no : ''}`;
  if (o.kind === 'jr') return `${o.line || ''} ${(o.stations || []).join('・')} 客×${o.mul}`;
  return '';
}
function dIncStop(t, emer) {   // 列車を止める(止まる位置を決める)
  const p = t.ph; if (!p) return false;
  if (p.mode === 'dwell') { p.incDw = Infinity; return true; }
  const B = emer ? D_EMER : D_BRK; p.incStop = p.m + p.L / 2 + p.v * p.v / (2 * B) + 1; if (emer && p.v > 0.5) { D_STAT.emer++; }
  return true;
}
function dIncOn(o, act, T) {
  if (o.kind === 'car') {
    if (o.self == null) o.self = (o.seed2 != null ? o.seed2 : Math.random()) < 0.6;   // 自走できるか(運転士が確かめるまで分からない)
    if (!o.t && o.key) o.t = act.find(t => t.ph && ttUKey(t) === o.key) || null;
    if (!o.t) { const L = act.filter(t => t.ph && !t.yard && !t.unit && !t.cut && t.ph.v > 1); if (!L.length) return false; o.t = L[Math.floor((o.seed || 0) * L.length)]; o.key = ttUKey(o.t); }
    if (!o.t.ph) return false;
    const k = dTrainKm(o.t); o.at = k ? DSEC[k.si].sc.name + ' ' + dKmShow(DSEC[k.si].sc, k.km).toFixed(2) + 'km' : ''; return dIncStop(o.t, false);
  }
  if (o.kind === 'block') {
    o.sigs = []; const lo = Math.min(o.km0, o.km1) - 0.25, hi = Math.max(o.km0, o.km1) + 0.25;
    for (const s of SIGS) { if (s.sec !== o.si || s.kind === '中継' || !(s.km >= lo && s.km <= hi) || !dIncDirOK(o, dDn(s.de))) continue; if (!s.man) { s.man = true; o.sigs.push(s); } }
    o.hit = [];
    if (o.jin) {   // その場の列車(駅間の中で、いちばん真ん中に近い列車)が非常ブレーキ
      const mid = (o.km0 + o.km1) / 2; let best = null, bd = Infinity;
      for (const t of act) { const k = dTrainKm(t); if (!k || k.si !== o.si || !dIncDirOK(o, k.dn) || k.km < Math.min(o.km0, o.km1) || k.km > Math.max(o.km0, o.km1)) continue; const d = Math.abs(k.km - mid); if (d < bd) { bd = d; best = t; } }
      if (best && dIncStop(best, true)) { o.hit.push(best); o.t = best; }
    }
    return true;
  }
  if (o.kind === 'dwell') { o.t = null; return true; }
  if (o.kind === 'jr') return true;
  return false;
}
function dIncKeep(o, act, T) {
  if (o.kind === 'car' && o.t && o.t.ph && o.t.ph.incStop == null && o.t.ph.incDw == null) dIncStop(o.t, false);   // 区間に入り直した
  if (o.kind === 'dwell' && !o.t) {   // 次にその駅に止まる列車(その向き)
    for (const t of act) { const p = t.ph; if (!p || p.mode !== 'dwell' || t.yard || t.unit || t.cut) continue; const st = t.dp.stops[p.k]; if (!st || st.name !== o.st || (o.key && ttUKey(t) !== o.key)) continue;
      const k = dTrainKm(t); if (o.dir !== 'any' && k && !dIncDirOK(o, k.dn)) continue;
      o.t = t; p.incDw = Math.max(T, p.arrT || T) + (o.dur === Infinity ? 1e9 : o.dur); if (o.dur !== Infinity) { o.dur0 = o.dur; o.dur = p.incDw - o.T0; } break; }   // 終わりは、その列車が着いてから n 分
  }
}
function dIncOff(o) {
  if (o.kind === 'car' && o.t && o.t.ph) { o.t.ph.incStop = null; o.t.ph.incDw = null; if (!o.keepCap) o.t.ph.incCap = null; }
  if (o.kind === 'block') { for (const s of o.sigs || []) s.man = false; for (const t of o.hit || []) if (t.ph) { t.ph.incStop = null; t.ph.incDw = null; } }
  if (o.kind === 'dwell' && o.t && o.t.ph) o.t.ph.incDw = null;
}
// 乗降客数の倍率(JR の振替輸送)
function dIncPaxMul(name, T) { let m = 1; for (const o of D_INC) if (o.on && o.kind === 'jr' && o.acc !== false && (o.stations || []).includes(name)) m *= o.mul || 1; return m; }   // acc = false: 振替輸送を受けなかった
