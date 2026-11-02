# 回送に融通を持たせる(1回だけ実行するパッチ)
#  ・時刻を20秒刻みで選ぶ(ev の as/ds に秒で持たせる)  ・早く着いて待つ/遅く出る幅を20分以上に広げる
#  ・京成成田の宗吾参道側のポイントで交差する時間幅を、実際の動き(出る列車は動き出しが遅い)に合わせて広げる
import io
p = 'src/ttcore.js'; s = io.open(p, encoding='utf-8').read()
def rep(a, b):
    global s
    assert s.count(a) == 1, a[:70]
    s = s.replace(a, b)
def cut(a, b, new):
    global s
    i = s.index(a); j = s.index(b, i)
    s = s[:i] + new + s[j:]

# 終着駅の到着も、秒で指定されていればそれを使う
rep("    if (i === n - 1 && !t.exitEnd) a = e.arr * 60 + 30;", "    if (i === n - 1 && !t.exitEnd && e.as == null) a = e.arr * 60 + 30;")

# ポイントの時間幅
rep("    const thInOK = x => !thOut.some(([a, b]) => a < x + 5 && x - 50 < b), thOutOK = x => !thIn.some(([a, b]) => a < x + 60 && x - 5 < b);",
    "    const thInOK = x => !thOut.some(([a, b]) => a < x + 5 && x - 80 < b), thOutOK = x => !thIn.some(([a, b]) => a < x + 110 && x - 5 < b);\n    const addIn = x => thIn.push([x - 80, x + 5]), addOut = x => thOut.push([x - 5, x + 110]);   // 入る列車は着く80秒前から、出る列車は発車後110秒までポイントにかかる")
rep("if (q > 0 && w0(t.names[q - 1]) && e !== NA_E[0] && !t.ev[q].thru) thIn.push([t.A[q + t.k0] - 50, t.A[q + t.k0] + 5]);", "if (q > 0 && w0(t.names[q - 1]) && e !== NA_E[0] && !t.ev[q].thru) addIn(t.A[q + t.k0]);")
rep("if (q < n - 1 && w0(t.names[q + 1])) thOut.push([t.P[q + t.k0] - 5, t.P[q + t.k0] + 60]);", "if (q < n - 1 && w0(t.names[q + 1])) addOut(t.P[q + t.k0]);")

# 成田空港の回送: 京成成田での待ちを秒で選ぶ
cut("    const thOK = (dir, st) =>", "    const placed = [];", r"""    const RS = RUN_SG * 60 + 25;   // 宗吾参道〜京成成田を走る秒
    const evS = (name, a, d, x) => Object.assign({ name, arr: Math.floor(a / 60), dep: Math.floor(d / 60), as: a, ds: d }, x || {});   // 秒で時刻を決めた停車
    const near = (lo, hi, pref) => { const l = []; for (let x = lo; x <= hi; x += 20) l.push(x); return l.sort((u, v) => Math.abs(u - pref) - Math.abs(v - pref)); };   // 20秒刻みの候補を、pref に近い順に
    // 京成成田で待つ秒(0 = 止まらずに通る、-1 = どう待ってもぶつかる): 通常列車と前後が入れ替わらず、中線が空いていて、ポイントで交差しない最初の秒。
    //  stay(w) = [着, 発](秒)、f(w) = 宗吾参道との間で通常列車と前後が入れ替わる
    const waitNA = (f, stay, dir) => { for (let w = 40; w <= 1500; w += 20) { const st = stay(w); if (f(w) || !midFree(st[0], st[1]) || jump(dir, st) || !(dir > 0 ? thInOK(st[0]) : thOutOK(st[1]))) continue; midBusy.push(st); if (dir > 0) addIn(st[0]); else addOut(st[1]); return w; }
      const ps = stay(0)[0]; if (f(0) || jump(dir, [ps, ps]) || !mainFree(dir, ps) || !(midFree(ps, ps) || termFree(ps)) || (dir < 0 && !thOutOK(ps))) return -1; if (dir < 0) addOut(ps); return 0; };   // 止まらずに通るのは本線が空いているときだけ。成田の始発・終着がいる間は、中線も空いていること
""")
cut("    // 宗吾参道 → 京成成田(通常列車を先に通して待つ) → 成田空港。", "    // j.kind:", r"""    // 宗吾参道 → 京成成田(通常列車を先に通して待つ) → 成田空港。src = 京成成田から出る回送(京成成田止まりの列車がそのまま成田空港へ向かう)
    const evIn = (ta, src) => { const m = ta - RUN_NA, dp = m * 60 + 5, tail = [{ name: NRT2, arr: ta - DH_RUN[2], dep: ta - DH_RUN[2], thru: true }, { name: NRT, arr: ta, dep: ta }]; if (src) return [{ name: NA, arr: m, dep: m }, ...tail];
      const w = waitNA(w => ordLine(DH_ST, NA, (w ? dp - w : dp + 5) - RS, w ? dp - w : dp + 5), w => w ? [dp - w, dp] : [dp + 5, dp + 5], 1); if (w < 0) return null;
      return w ? [evS(DH_ST, dp - w - RS - 55, dp - w - RS), evS(NA, dp - w, dp), ...tail] : [{ name: DH_ST, arr: m - RUN_SG, dep: m - RUN_SG }, { name: NA, arr: m, dep: m, thru: true }, ...tail]; };
    const evOut = td => { const m = td + RUN_NA, ar = m * 60 + 30, head = [{ name: NRT, arr: td, dep: td }, { name: NRT2, arr: td + DH_RUN[2], dep: td + DH_RUN[2], thru: true }];
      const w = waitNA(w => ordLine(NA, DH_ST, w ? ar + w : ar - 20, (w ? ar + w : ar - 20) + RS), w => w ? [ar, ar + w] : [ar - 20, ar - 20], -1); if (w < 0) return null;
      return w ? [...head, evS(NA, ar, ar + w), evS(DH_ST, ar + w + RS, ar + w + RS + 25)] : [...head, { name: NA, arr: m, dep: m, thru: true }, { name: DH_ST, arr: m + RUN_SG, dep: m + RUN_SG }]; };
""")

# 京成成田の始発・終着の回送
cut("      if (pNA != null) {\n        for (const d of (dep.get(NA) || [])", "    // ----- 京成上野", r"""      if (pNA != null) {
        // 送り込み: 宗吾参道 → 京成成田。発車の100秒前〜25分前に着く(4分前ごろを優先)。早く着いたぶんはホームで待つ
        for (const d of (dep.get(NA) || []).slice().sort((x, y) => tDep(x) - tDep(y))) { if (d.prev || d.exitStart || d.dh || d.swapIn) continue;
          const D = tDep(d), Ds = D * 60 + 5, upSt = west(d.names[1]), fix = (NA_DH_FIX[list.day] || {})[d.no + '@' + D]; let A = null, trk = null;
          const run = x => !ordLine(DH_ST, NA, x - RS, x), cands = near(Ds - 1500, Ds - 100, Ds - 240);
          const tryT = (name, ok) => { if (A != null) return; for (const x of cands) if (run(x) && ok(x)) { A = x; trk = name; return; } };
          if (fix) { A = fix.m * 60 + 30; trk = fix.u1 ? 'u1' : 'mid'; }
          if (upSt) {   // 上りの始発: 中線(直前5分に別の列車がいたら避ける) → 1番線 → 中線
            tryT('mid', x => thInOK(x) && midFree(x - 300, Ds, d)); tryT('u1', x => thInOK(x) && u1Free(x, Ds, d)); tryT('mid', x => thInOK(x) && midFree(x, Ds, d));
          } else { tryT('d5', x => d5Free(x, Ds)); tryT('mid', x => thInOK(x) && midFree(x, Ds, d)); }   // 下りの始発: 5番線 → 中線
          if (A == null) { stat.skipNA = (stat.skipNA || 0) + 1; continue; }
          (trk === 'mid' ? midBusy : trk === 'u1' ? u1Busy : d5Busy).push([A, Ds]); if (trk !== 'd5') addIn(A);
          const dh = mk(d, [evS(DH_ST, A - RS - 55, A - RS), evS(NA, A, A + 25)], null); dh.dhCat = undefined; ttSchedule(dh); addProf(dh); dh.next = d; d.prev = dh;
          if (trk === 'u1') { dh.naU1 = true; stat.naU1 = (stat.naU1 || 0) + 1; } if (trk === 'mid' && !upSt) dh.naMidIn = true; stat.na = (stat.na || 0) + 1; }
        // 引き上げ: 京成成田 → 宗吾参道。到着の100秒後〜20分後に出る(3分後ごろを優先)。それまでは着いたホームで待つ
        for (const a of (arr.get(NA) || []).slice().sort((x, y) => tArr(x) - tArr(y))) { if (a.next || a.exitEnd || a.dh || a.swapOut) continue;
          const T0 = tArr(a), Ta = T0 * 60 + 30, run = x => !ordLine(NA, DH_ST, x, x + RS) && thOutOK(x), cands = near(Ta + 100, Ta + 1200, Ta + 180); let P = null;
          // 下りのライナーは上の線(4番線)に着く: 次の下り列車が来る前に出る。間に合わないときは中線に着けて待つ
          if (a.type === 'liner' && west(a.names[a.names.length - 2])) { for (const x of cands) if (run(x) && d5Free(Ta - 30, x)) { P = x; break; } if (P == null) a.naMid = true; }
          if (P == null) for (const x of cands) if (run(x) && midFree(Ta, x, a)) { P = x; midBusy.push([Ta, P]); break; }
          if (P == null) { a.naMid = false; stat.skipNA = (stat.skipNA || 0) + 1; continue; }   // 回送を付けない: いつものホームに着いて消える
          addOut(P);
          // 同じ運用の次の列車が京成佐倉始発(運用表では駅が変わってつながる): 宗吾参道で少し止まって時機を見てから、京成佐倉のいちばん下の線へ入る
          const SK = '京成佐倉', RK = 6 * 60 + 25, id = a.ops && a.ops.id, sgA = P + RS, d2 = id && stByName.has(SK) ? list.filter(x => x.ops && x.ops.id === id && !x.prev && !x.dh && x.names[0] === SK && tDep(x) * 60 >= sgA + 40 + RK + 100 && tDep(x) <= T0 + 90).sort((x, y) => tDep(x) - tDep(y))[0] : null;
          if (d2) { const lim = tDep(d2) * 60 - 100; let dp = null; for (let w = 40; w <= 1500 && sgA + w + RK <= lim; w += 20) if (!ordLine(DH_ST, SK, sgA + w, sgA + w + RK)) { dp = sgA + w; break; }
            if (dp != null) { const dh = mk(a, [evS(NA, P - 60, P), evS(DH_ST, sgA, dp), evS(SK, dp + RK, dp + RK + 25)], null); dh.dhCat = undefined; ttSchedule(dh); addProf(dh); a.next = dh; dh.prev = a; dh.next = d2; d2.prev = dh;
              const ss = stByName.get(SK), l = [...new Set(ss.stops.map(([x]) => x))].sort((x, y) => yOf(x) - yOf(y)); if (l.length && E[l[l.length - 1]].dir !== 1) dh.forceEnd = l[l.length - 1];
              stat.na = (stat.na || 0) + 1; stat.toSK = (stat.toSK || 0) + 1; continue; } }
          const dh = mk(a, [evS(NA, P - 60, P), evS(DH_ST, P + RS, P + RS + 25)], null); dh.dhCat = undefined; ttSchedule(dh); addProf(dh); a.next = dh; dh.prev = a; stat.na = (stat.na || 0) + 1; } } }
""")
# 下りの始発への送り込みが中線に入るとき
rep("    if (liner && fromW && !t.dh) ok = t.naMid ? [MID, D5] : [D5, MID];", "    if (liner && fromW && !t.dh) ok = t.naMid ? [MID, D5] : [D5, MID];")
rep("    else if (t.dh) ok = back ? (t.naU1 ? [U1, MID] : [MID, D5]) : [D5, MID];", "    else if (t.dh) ok = back ? (t.naU1 ? [U1, MID] : [MID, D5]) : (t.naMidIn ? [MID, D5] : [D5, MID]);")
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('patched')
