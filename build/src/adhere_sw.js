// 時刻表の遵守チェック: 1日を通して動かし、各停車駅の到着・発車が時刻表の「分」に収まっているかを調べる
const fs = require('fs');
const D = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const TT = JSON.parse(fs.readFileSync('tt.json', 'utf8'));
const hs = s => String(Math.floor(s / 3600) % 24).padStart(2, '0') + ':' + String(Math.floor(s / 60) % 60).padStart(2, '0') + ':' + String(Math.floor(s % 60)).padStart(2, '0');
const DAYS = (process.argv[2] || 'wd,hd').split(','), VERB = +(process.argv[3] || 10), DT = 2;
eval(fs.readFileSync('src/core.js', 'utf8') + fs.readFileSync('src/ttcore.js', 'utf8') + `
for (const day of DAYS) {
  const list = TT[day].map(ttDecode).filter(t => t.ev.length > 1); ttOvertakes(list); ttCouple(list, day); ttLink(list); list.sort((a, b) => a.start - b.start);
  const pl = ttPlanner(true); list.forEach(pl.pre); list.forEach(pl.plan); pl.finish(); const UNITS = pl.units;
  // --- 静的チェック: 作った運行計画そのものが時刻表の分に収まっているか
  let stops = 0, sLate = 0, sEarly = 0; const sEx = [];
  for (const t of list) { if (!t.route) continue; t.ev.forEach((e, i) => { if (e.wait) return; stops++; const k = i + t.k0;
    if (i > 0 && t.A[k] > (e.arr === e.dep ? e.dep : e.arr) * 60 + 59.5) { sLate++; if (sEx.length < 4) sEx.push(t.no + ' ' + e.name + ' 計画着' + hs(t.A[k]) + ' 時刻表' + hs(e.arr * 60)); }
    if (i < t.ev.length - 1 && t.P[k] < e.dep * 60 - 0.5) sEarly++; }); }
  // --- 動的チェック: 追従(前の列車に付く)込みで実際に動かす
  list.push(...UNITS); list.sort((a, b) => a.start - b.start); let uLate = 0, uMax = 0;
  let ptr = 0, act = [], lastT = NaN, close = 0, swaps = 0, giveups = 0;
  const gvAt = {}, gvEx = []; const prevOrder = new Map(), closeSet = new Set(), lateBy = {}, blockAt = {}; let dLate = 0, dLate2 = 0, maxLate = 0; const dEx = [];
  for (const t of list) { t.kk = 0; t.id = list.indexOf(t); }
  for (let T = 4.4 * 3600; T < 25.6 * 3600; T += DT) {
    while (ptr < list.length && list[ptr].start <= T) act.push(list[ptr++]);
    act = act.filter(t => { if (ttTarget(t, T)) return true; t.sv = null; t.gone = true; return false; });
    ttFollow(act, T, lastT); lastT = T;
    const occ = new Map();
    for (const t of act) {
      // 到着の判定
      const sd = t.sd, m = Math.min(sd.length, t.A.length);
      while (t.kk < m && t.s >= sd[t.kk] - 0.3) {
        const i = t.kk - t.k0, e = t.ev[i];
        if (e && !e.wait && i > 0 && !t.dh) {   // 回送は時刻表に無い(推定の時刻)ので数えない
          const lim = (e.arr === e.dep ? e.dep : e.arr) * 60 + 59.5, late = T - lim;
          if (late > 0) { dLate++; if (late > 60) dLate2++; lateBy[e.name] = (lateBy[e.name] || 0) + 1; if (late > maxLate) maxLate = late;
            if (dEx.length < 40 && late > 20) dEx.push((t.blkBy ? '[' + t.blkBy.no + ' ' + t.blkBy.names[0] + '>' + t.blkBy.names[t.blkBy.names.length-1] + '] ' : '') + t.no + ' ' + TYPES[t.type].name + ' ' + t.names[0] + '>' + t.names[t.names.length - 1] + ' @' + e.name + ' 着' + hs(T) + ' (時刻表 ' + hs(e.arr * 60) + ') ' + (t.lastBlk || '')); } }
        t.kk++;
      }
      if (t.blk > FOLLOW_GIVEUP) { giveups++; if (!t.gv) { t.gv = 1; const b = t.blkBy, gg = segAt(t.route, Math.max(0, Math.min(t.route.total, t.s))), nm = edgeStation[gg.e] >= 0 ? ST[edgeStation[gg.e]].name : '駅間'; gvAt[nm] = (gvAt[nm] || 0) + 1; if (gvEx.length < VERB) gvEx.push(hs(T) + ' ' + t.no + ' ' + TYPES[t.type].name + ' ' + t.names[0] + '>' + t.names[t.names.length - 1] + ' ← ' + b.no + ' ' + TYPES[b.type].name + ' ' + b.names[0] + '>' + b.names[b.names.length - 1] + (b.next ? '(折返待ち→' + b.next.no + ')' : '') + (b.prev ? '(prev)' : '') + ' @' + nm + ' y' + gg.ay); } } else t.gv = 0;
      if (t.unit && T >= t.end - DT && !t.uc) { t.uc = 1; const lag = t.tgt - t.s; if (lag > 3) uLate++; if (lag > uMax) uMax = lag; }
      const r = t.route, sc = Math.max(0, Math.min(r.total, t.s)), g = segAt(r, sc), L = g.d1 - g.d0, tt_ = g.t0 + (g.t1 - g.t0) * (L > 0 ? (sc - g.d0) / L : 0);
      const k = g.e * 2 + g.d; if (!occ.has(k)) occ.set(k, []); occ.get(k).push({ t, u: (g.d ? 1 - tt_ : tt_) * E[g.e].len });
      if (t.tgt - t.s > 25) { const nm = edgeStation[g.e] >= 0 ? ST[edgeStation[g.e]].name : '駅間'; t.lastBlk = '手前:' + nm; if (!t.cnt) { t.cnt = 1; blockAt[nm] = (blockAt[nm] || 0) + 1; } } else t.cnt = 0;
    }
    for (const [k, l] of occ) { if (l.length < 2) continue;
      for (let a = 0; a < l.length; a++) for (let b = a + 1; b < l.length; b++) {
        const A = l[a], B = l[b]; if (A.t.next === B.t || B.t.next === A.t || A.t.cplWith === B.t || B.t.cplWith === A.t) continue;
        const id = A.t.id + '-' + B.t.id + '-' + k, d = A.u - B.u;
        if (Math.abs(d) < 9) closeSet.add(id);
        const po = prevOrder.get(id); if (po && Math.sign(d) && Math.sign(d) !== po) { swaps++; const nm = edgeStation[k >> 1] >= 0 ? ST[edgeStation[k >> 1]].name : '駅間'; console.log('    SW', hs(T), A.t.no, TYPES[A.t.type].name, A.t.names[0] + '>' + A.t.names[A.t.names.length - 1], '/', B.t.no, TYPES[B.t.type].name, B.t.names[0] + '>' + B.t.names[B.t.names.length - 1], '@' + nm, 'e' + (k >> 1), 'blk', (A.t.blk || 0).toFixed(0), (B.t.blk || 0).toFixed(0), 'dw', !!A.t.dwelling, !!B.t.dwelling); }
        prevOrder.set(id, Math.sign(d));
      } }
  }
  const top = o => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 10).map(x => x.join(':')).join(' ');
  console.log('==', day, '列車', list.length, '停車', stops);
  console.log(' 計画(静的): 時刻表の分より遅い到着', sLate, ' 早発', sEarly, sEx.join(' ; '));
  console.log(' 実走(動的): 分を過ぎた到着', dLate, '(' + (dLate / stops * 100).toFixed(2) + '%)', ' うち1分超', dLate2, ' 最大', Math.round(maxLate) + '秒');
  console.log('   遅れた駅:', top(lateBy));
  console.log('   つかえた場所:', top(blockAt));
  console.log(' 同じ線: 重なった組', closeSet.size, ' 追い越し', swaps, ' 例外通過(フレーム)', giveups);
  console.log(' 増結:', UNITS.length, '本  連結時に所定位置に届いていない', uLate, ' 最大ずれ', Math.round(uMax) + 'px');
  console.log('   例外通過の場所:', top(gvAt)); gvEx.forEach(x => console.log('    GV', x));
  dEx.forEach(x => console.log('   ', x));
}
`);
