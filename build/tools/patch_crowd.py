# 乗降客数で停車時間を決める(2026-11-06、ユーザー「混雑率などにより乗降時間は変わる、それで遅れが出る」)
#  build/pax.json(駅別1日平均乗降人員 2025年度、tools/pax_kq.py)を disp.js の D_PAX に埋める(/*PAX*/ null)
#  平常時(時刻表どおり)は時刻表の発車のまま。遅れて前の列車との間があくと、そのぶん待っている客が増えて乗り降りが長くなる:
#    要る停車 = min(時刻表の停車, R(時刻表の間隔)) + max(0, R(実際の間隔) − R(時刻表の間隔))
#    R(間隔) = 戸の開け閉め 10秒 + 乗り降りの人数 ÷ 扉の数 × 1人あたりの秒(1扉に15人を超える混み方では 1.5倍)
#    乗り降りの人数 = 2 × その方向の1秒あたりの客 × 間隔、1秒あたりの客 = 乗降人員/2 × 時間帯の割合/3600 × 方向の割合
#  時間帯の割合・方向の割合・1人あたりの秒・扉の数(1両3扉)は推定(D_PAXCFG で直せる)
import io, os, shutil
p = 'src/disp.js'; b = '_tmp/disp.js.before_crowd'
if not os.path.exists(b): shutil.copy(p, b)
raw = io.open(p, encoding='utf-8', newline='').read(); crlf = '\r\n' in raw; s = raw.replace('\r\n', '\n')
if 'D_PAX' in s: raise SystemExit('already')
def rep(a, c):
    global s
    if s.count(a) != 1: raise SystemExit('nf: ' + a[:70] + ' %d' % s.count(a))
    s = s.replace(a, c)
rep("let D_REC = null;", """// ===== 乗降客数と停車時間(tools/patch_crowd.py) =====
const D_PAX = (/*PAX*/ null) || null;
let D_CROWD = !!D_PAX;   // 画面の「乗降客数で停車時間」
const D_PAXCFG = Object.assign({
  // 1日の乗降のうち、その時(時)の1時間に乗り降りする割合(推定。平日は朝夕の山、土休日はなだらか)
  wd: { 4: 0.2, 5: 1.2, 6: 4.5, 7: 10.5, 8: 11.0, 9: 7.0, 10: 5.0, 11: 4.5, 12: 4.5, 13: 4.5, 14: 4.5, 15: 5.0, 16: 5.5, 17: 7.5, 18: 8.0, 19: 6.5, 20: 5.0, 21: 4.0, 22: 3.0, 23: 1.8, 24: 0.8, 25: 0.2 },
  hd: { 4: 0.2, 5: 0.8, 6: 2.5, 7: 4.5, 8: 6.0, 9: 7.0, 10: 7.5, 11: 7.5, 12: 7.0, 13: 7.0, 14: 7.0, 15: 7.0, 16: 7.0, 17: 7.0, 18: 6.5, 19: 5.5, 20: 4.5, 21: 3.5, 22: 2.5, 23: 1.5, 24: 0.7, 25: 0.2 },
  upAM: 0.6, downPM: 0.6,   // 平日 6〜9時台は上り、17〜20時台は下りに多い(それ以外は半分ずつ)
  door: 3, secPer: 1.2, crowdAt: 15, crowdMul: 1.5, base: 10, gapMax: 1200
}, (DC.dispatch && DC.dispatch.pax) || {});
const D_LASTDEP = new Map();   // 駅|向き → 最後に発車した秒(実際)
const D_PAXQ = new Map();      // 駅|向き → 止まる列車の時刻表の発車(秒、昇順)
let D_CROWDSTAT = { n: 0, sum: 0, max: 0 };
function dPaxKey(t, st) { if (!t.route || !t.sd || t.sd[st.k] == null) return null; const g = segAt(t.route, t.sd[st.k]); return st.name + '|' + dDn(g.e * 2 + g.d); }
function dPaxRate(name, dn, T) {   // その方向の客(人/秒)
  const R = D_PAX && D_PAX.駅 && D_PAX.駅[name]; if (!R) return 0;
  const C = D_PAXCFG, prof = C[D_DAY === 'hd' ? 'hd' : 'wd'], h = Math.max(4, Math.min(25, Math.floor(T / 3600)));
  let tot = 0; for (const k in prof) tot += prof[k];
  const sh = D_DAY !== 'hd' && h >= 6 && h <= 9 ? (dn ? 1 - C.upAM : C.upAM) : D_DAY !== 'hd' && h >= 17 && h <= 20 ? (dn ? C.downPM : 1 - C.downPM) : 0.5;
  return R / 2 * (prof[h] || 0) / tot / 3600 * sh;
}
function dPaxSec(t, name, dn, T, gap) {   // その間隔で待っていた客の乗り降りにかかる秒
  const C = D_PAXCFG, n = 2 * dPaxRate(name, dn, T) * Math.max(0, Math.min(gap, C.gapMax)), doors = Math.max(1, (t.cars || 8) * C.door), per = n / doors;
  return C.base + per * C.secPer * (per > C.crowdAt ? C.crowdMul : 1);
}
function dPaxNeed(t, st, arrT) {   // 着いたときに、要る停車の秒(0 = 時刻表どおり)
  if (!D_CROWD || !D_PAX || st.thru || st.k == null) return 0;
  const i = st.k - t.k0; if (i <= 0 || i >= t.names.length - 1 || t.yard || t.unit || t.cut || t.dh) return 0;
  const key = dPaxKey(t, st); if (!key) return 0; const dn = key.endsWith('|1');
  const q = D_PAXQ.get(key); let pv = -Infinity; if (q) { let lo = 0, hi = q.length; while (lo < hi) { const m = (lo + hi) >> 1; if (q[m] < st.P - 0.5) lo = m + 1; else hi = m; } if (lo > 0) pv = q[lo - 1]; }
  const gS = isFinite(pv) ? st.P - pv : D_PAXCFG.gapMax, last = D_LASTDEP.get(key), gA = last != null && last < arrT ? arrT - last : gS;
  const rS = dPaxSec(t, st.name, dn, st.P, gS), rA = dPaxSec(t, st.name, dn, arrT, gA), dwS = Math.max(0, st.P - st.A);
  return Math.min(dwS, rS) + Math.max(0, rA - rS);
}
function dPaxPlan(list) {   // dispPlan で: 駅|向きごとの時刻表の発車
  D_PAXQ.clear(); D_LASTDEP.clear(); D_CROWDSTAT = { n: 0, sum: 0, max: 0 };
  for (const t of list) { if (!t.route || !t.sd || t.yard || t.unit || t.cut || t.dh) continue;
    t.names.forEach((nm, i) => { const ev = t.ev[i]; if (!ev || ev.thru || i === t.names.length - 1) return; const k = i + t.k0; if (t.sd[k] == null) return; const g = segAt(t.route, t.sd[k]); if (dSecOf[g.e] < 0) return;
      const key = nm + '|' + dDn(g.e * 2 + g.d); if (!D_PAXQ.has(key)) D_PAXQ.set(key, []); D_PAXQ.get(key).push(t.P[k]); }); }
  for (const [, q] of D_PAXQ) q.sort((a, b) => a - b);
}
let D_REC = null;""")
rep("  D_ENTQ.sort((a, b) => a.T - b.T);
  dRecApply();", "  D_ENTQ.sort((a, b) => a.T - b.T);
  dRecApply(); dPaxPlan(list);")   # 列車の sd ができたあと
# 着いたとき(2か所)に要る停車を出す
rep("p.mode = 'dwell'; p.m = m; p.arrT = T <= st.P + 1 ? Math.min(T, st.A) : T; if (k >= dp.stops.length - 1) p.done = true; }",
    "p.mode = 'dwell'; p.m = m; p.arrT = T <= st.P + 1 ? Math.min(T, st.A) : T; p.paxDw = dPaxNeed(t, st, p.arrT); if (k >= dp.stops.length - 1) p.done = true; }")
rep("    p.v = 0; p.m = Math.max(p.m, X - L / 2); p.mode = 'dwell'; p.arrT = T; p.delay = Math.max(0, T - st.A);",
    "    p.v = 0; p.m = Math.max(p.m, X - L / 2); p.mode = 'dwell'; p.arrT = T; p.delay = Math.max(0, T - st.A); p.paxDw = dPaxNeed(t, st, T);")
rep("T < p.arrT + st.minDw ? '着いたのが遅い(最短停車) ' + (st.name || '') : null; if (c) dLoss(c, dt); }",
    "T < p.arrT + Math.max(st.minDw, p.paxDw || 0) ? (p.paxDw > st.minDw ? '乗り降り(混雑) ' : '着いたのが遅い(最短停車) ') + (st.name || '') : null; if (c) dLoss(c, dt); }")
rep("    if (T < st.P || T < p.arrT + st.minDw || p.hold || p.needJ0 != null) return;",
    "    if (T < st.P || T < p.arrT + Math.max(st.minDw, p.paxDw || 0) || p.hold || p.needJ0 != null) return;")
rep("    p.mode = 'run'; p.k++; while (p.k < dp.stops.length && dp.stops[p.k].thru) p.k++;",
    "    { const pk = dPaxKey(t, st); if (pk) D_LASTDEP.set(pk, T); const ex = Math.min(T, p.arrT + (p.paxDw || 0)) - Math.max(st.P, p.arrT + st.minDw); if (p.paxDw > st.minDw && ex > 1) { D_CROWDSTAT.n++; D_CROWDSTAT.sum += ex; D_CROWDSTAT.max = Math.max(D_CROWDSTAT.max, ex); if (ex > 30) dEvent(T, t, 'late', `${st.name || ''} で乗り降りに ${Math.round(p.paxDw)}秒(混雑・前の列車から間があいた)`); } }\n    p.mode = 'run'; p.k++; while (p.k < dp.stops.length && dp.stops[p.k].thru) p.k++;")
if crlf: s = s.replace('\n', '\r\n')
io.open(p, 'w', encoding='utf-8', newline='').write(s); print('ok')
