# 成田空港の回送: (1) 空港第2ビルで待てるようにする  (3) スカイライナー・アクセス特急の回送は成田スカイアクセス線・北総線経由で京成高砂へ
#  単線(成田湯川〜根古屋信号場〜空港第2ビル)では、根古屋信号場で止まって行き違いを待つ。1回だけ実行するパッチ
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

cut("    const naIn = (A, commit) =>", "    // j.kind:", r"""    // 京成成田を dp(秒)に出る下りの回送 / ar(秒)に着く上りの回送の、京成成田での待ち方
    const naIn = (dp, commit) => waitNA(w => ordLine(DH_ST, NA, (w ? dp - w : dp + 5) - RS, w ? dp - w : dp + 5) || !sgClear((w ? dp - w : dp + 5) - RS), w => w ? [dp - w, dp] : [dp + 5, dp + 5], 1, commit);
    const naOut = (ar, commit) => waitNA(w => ordLine(NA, DH_ST, w ? ar + w : ar - 20, (w ? ar + w : ar - 20) + RS), w => w ? [ar, ar + w] : [ar - 20, ar - 20], -1, commit);
    const memo = new Map(), probe = (key, f) => { if (!memo.has(key)) memo.set(key, f()); return memo.get(key); };   // 確かめた結果の覚え書き。記録が増えたら捨てる
    // ----- 空港第2ビルで待つ -----  行き違いのできる駅なので、回送はここで単線(〜成田空港)の空きを待てる。待つ間は同じ向きの列車がこの駅に来ないこと
    const U2 = [0, 60, 120, 180, 240, 300, 420, 540], R2 = RN - T2, SW = 125;   // 待つ秒の候補、京成成田〜空港第2ビルを走る秒、空港第2ビルに止まってから単線を走る秒
    const b2D = (a, b, self) => !S.d.some(x => x !== self && (x[2] != null ? x[2] < b + 40 && a - 40 < x[0] : x[0] > a - 40 && x[0] < b + 40));
    const b2U = (a, b, self) => !S.u.some(x => x !== self && (x[2] != null ? x[1] < b + 40 && a - 40 < x[2] : x[1] > a - 40 && x[1] < b + 40));
    // ----- 成田スカイアクセス線・北総線経由(京成高砂の車庫と行き来する) -----
    //  成田湯川〜根古屋信号場〜空港第2ビルは単線。向かい合う列車とは根古屋信号場(待避線は1本)か空港第2ビルで行き違う。北総線内は通常列車と前後を入れ替えない速さで走る
    const NK = '根古屋信号場', YU = '成田湯川', R = THRU_REF, hasAcc = stByName.has(NK) && stByName.has(YU) && stByName.has(TAKA);
    const refT = (t, nm) => { const q = t.names.indexOf(nm); if (q >= 0) return [t.A[q + t.k0], t.P[q + t.k0]]; const w = (t.pass || []).find(x => x.name === nm); if (w) return [w.t, w.t]; const r = R[nm]; if (r == null) return null;
      for (let i = 0; i + 1 < t.names.length; i++) { const ra = R[t.names[i]], rb = R[t.names[i + 1]]; if (ra == null || rb == null || (r - ra) * (r - rb) >= 0) continue; const x = t.P[i + t.k0] + (t.A[i + 1 + t.k0] - t.P[i + t.k0]) * (r - ra) / (rb - ra); return [x, x]; } return null; };
    const sec = { s1d: [], s1u: [], s2d: [], s2u: [], nk: [] }, rProf = [];   // 単線の2区間(1 = 湯川〜根古屋、2 = 根古屋〜第2ビル)にいる時間、根古屋で待っている時間、北総線内の列車の動き
    const addR = t => { const acc = ksVia(t) === 'access', pts = []; t.names.forEach((nm, i) => { const r = R[nm]; if (r == null || r < 10 || r > 32.5 || (!acc && r > 28.4)) return; pts.push([r, t.A[i + t.k0], t.P[i + t.k0]]); });
      for (const w of t.pass || []) { const r = R[w.name]; if (acc && r != null && r > 10 && r <= 32.5 && !pts.some(q => q[0] === r)) pts.push([r, w.t, w.t]); }
      if (pts.length < 2) return; const d0 = Math.sign(pts[pts.length - 1][0] - pts[0][0]); pts.sort((x, y) => (x[0] - y[0]) * d0); if (!d0 || pts.some((q, k) => k && q[1] < pts[k - 1][2] - 1)) return;
      rProf.push({ t, pts, dir: d0, lo: Math.min(pts[0][0], pts[pts.length - 1][0]), hi: Math.max(pts[0][0], pts[pts.length - 1][0]), t0: pts[0][1], t1: pts[pts.length - 1][2] }); };
    if (hasAcc) for (const t of list) { addR(t); if (ksVia(t) !== 'access' || !t.names.includes(NRT2)) continue; const tY = refT(t, YU), tN = refT(t, NK), tB = refT(t, NRT2); if (!tY || !tN || !tB) continue;
      if (tY[0] < tB[0]) { sec.s1d.push([tY[1], tN[0]]); sec.s2d.push([tN[1], tB[0]]); } else { sec.s2u.push([tB[1], tN[0]]); sec.s1u.push([tN[1], tY[0]]); }
      if (tN[1] - tN[0] > 20) sec.nk.push([tN[0], tN[1]]); }
    const RSTN = Object.keys(R).filter(n => R[n] >= 10 && R[n] <= 32.5 && stByName.has(n)), RV = RSTN.map(n => R[n]);
    const atR = (o, r) => { const pts = o.pts; for (let k = 0; k < pts.length; k++) { if (Math.abs(pts[k][0] - r) < 1e-6) return [pts[k][1], pts[k][2]]; if (k + 1 < pts.length && (r - pts[k][0]) * (r - pts[k + 1][0]) < 0) { const x = pts[k][2] + (pts[k + 1][1] - pts[k][2]) * (r - pts[k][0]) / (pts[k + 1][0] - pts[k][0]); return [x, x]; } } return null; };
    // 北総線内(京成高砂〜成田湯川)を r0→r1 に dep〜arr(秒)で走る回送が、同じ向きの列車と前後を入れ替えないか(0 = 走れる)
    const ordR = (r0, r1, dep, arr) => { const dir = Math.sign(r1 - r0), lo = Math.min(r0, r1), hi = Math.max(r0, r1);
      for (const o of rProf) { if (o.dir !== dir || o.t1 < dep - 300 || o.t0 > arr + 300 || o.hi <= lo || o.lo >= hi) continue; let s0 = 0, bad = false, cnt = 0;
        for (const r of RV) { if (r < lo - 1e-6 || r > hi + 1e-6) continue; const x = atR(o, r); if (!x) continue; cnt++; const my = dep + (arr - dep) * (r - r0) / (r1 - r0), a = Math.abs(r - r0) < 1e-6 ? x[1] : x[0], b = Math.abs(r - r1) < 1e-6 ? x[0] : x[1];
          const sg = my < a - 45 ? -1 : my > b + 45 ? 1 : 0; if (!sg || (s0 && sg !== s0)) bad = true; s0 = sg || s0; }
        if (bad && cnt >= 2) return 6; }
      return 0; };
    const hit = (l, a, b, m) => l.some(([x, y]) => x < b + m && a - m < y), close = (l, a, b) => l.some(([x, y]) => Math.abs(x - a) < 50 || (x - a) * (y - b) < 0);   // 向かい合う列車と重なる / 同じ向きの列車と近すぎる・入れ替わる
    const UN = [0, 60, 120, 180, 240, 300, 420, 540, 660, 780], DUR = [1350, 1500, 1680, 1920, 2160, 2400], N2 = 100, N1 = 110;   // 根古屋で待つ秒、湯川〜高砂を走る秒、根古屋〜第2ビル・湯川〜根古屋を走る秒
    // 上り: 成田空港 P 発 → (空港第2ビル) → (根古屋) → 成田湯川 → 京成高砂
    const accOut = (P, self) => { if (!hasAcc) return null;
      for (const u2 of U2) { const a2 = P + (u2 ? SW : T2), p2 = a2 + u2; if (u2 && !b2U(a2, p2, self)) continue;
        for (const un of UN) { const aN = p2 + N2, pN = aN + un, tY = pN + N1;
          if (hit(sec.s2d, p2, aN, 15) || close(sec.s2u, p2, aN) || hit(sec.s1d, pN, tY, 15) || close(sec.s1u, pN, tY) || (un ? hit(sec.nk, aN, pN, 30) : false)) continue;
          for (const du of DUR) if (!ordR(32.5, 10, tY, tY + du)) return { route: 'acc', P, a2, p2, u2, aN, pN, un, tY, du }; } }
      return null; };
    // 下り: 京成高砂 → 成田湯川 → (根古屋) → (空港第2ビル) → 成田空港 A 着
    const accIn = (A, self) => { if (!hasAcc) return null;
      for (const u2 of U2) { const p2 = A - (u2 ? SW : T2), a2 = p2 - u2; if (u2 && !b2D(a2, p2, self)) continue;
        for (const un of UN) { const pN = a2 - N2, aN = pN - un, tY = aN - N1;
          if (hit(sec.s2u, pN, a2, 15) || close(sec.s2d, pN, a2) || hit(sec.s1u, tY, aN, 15) || close(sec.s1d, tY, aN) || (un ? hit(sec.nk, aN, pN, 30) : false)) continue;
          for (const du of DUR) if (!ordR(10, 32.5, tY - du, tY)) return { route: 'acc', A, a2, p2, u2, aN, pN, un, tY, du }; } }
      return null; };
    // 京成成田経由(宗吾参道の車庫と行き来する)
    const sgIn = (A, self, commit) => { for (const u2 of U2) { const p2 = A - (u2 ? SW : T2), a2 = p2 - u2; if (u2 && !b2D(a2, p2, self)) continue; const dp = a2 - R2; if (ordLine(NA, NRT2, dp, a2)) continue; const w = naIn(dp, commit); if (w < 0) continue; return { route: 'sg', A, a2, p2, u2, dp, w }; } return null; };
    const sgOut = (P, self, commit) => { for (const u2 of U2) { const a2 = P + (u2 ? SW : T2), p2 = a2 + u2; if (u2 && !b2U(a2, p2, self)) continue; const ar = p2 + R2; if (ordLine(NRT2, NA, p2, ar)) continue; const w = naOut(ar, commit); if (w < 0) continue; return { route: 'sg', P, a2, p2, u2, ar, w }; } return null; };
    // 回送の経路: スカイライナー・アクセス特急はアクセス線経由(だめなら京成成田経由)、本線の列車は京成成田経由
    const planIn = (cat, A, self, commit) => (cat !== 'main' ? accIn(A, self) : null) || sgIn(A, self, commit);
    const planOut = (cat, P, self, commit) => (cat !== 'main' ? accOut(P, self) : null) || sgOut(P, self, commit);
    const stop2 = pl => pl.u2 ? evS(NRT2, pl.a2, pl.p2) : thru(NRT2, pl.a2);
    const passR = (t, tY, du, down) => { t.pass = RSTN.filter(n => R[n] > 10 && R[n] <= 32.5).map(n => ({ name: n, t: down ? tY - du * (32.5 - R[n]) / 22.5 : tY + du * (32.5 - R[n]) / 22.5, ref: true })); };
    // 計画から列車(停車駅と時刻)を作る。あわせて、使う線・時間を記録する
    const mkIn = (j, pl, src) => { const tail = [stop2(pl), evS(NRT, pl.A, pl.A + 25)]; let ev;
      if (src) ev = [evS(NA, pl.a2 - R2 - 60, pl.a2 - R2), ...tail];
      else if (pl.route === 'acc') { ev = [evS(TAKA, pl.tY - pl.du - 55, pl.tY - pl.du), ...(pl.un ? [evS(NK, pl.aN, pl.pN)] : []), ...tail];
        sec.s1d.push([pl.tY, pl.aN]); sec.s2d.push([pl.pN, pl.a2]); if (pl.un) sec.nk.push([pl.aN, pl.pN]); }
      else ev = pl.w ? [evS(DH_ST, pl.dp - pl.w - RS - 55, pl.dp - pl.w - RS), evS(NA, pl.dp - pl.w, pl.dp), ...tail] : [evS(DH_ST, pl.dp + 5 - RS - 55, pl.dp + 5 - RS), thru(NA, pl.dp + 5), ...tail];
      const dh = mk(j.d, ev, j.cat); if (pl.route === 'acc' && !src) { passR(dh, pl.tY, pl.du, true); if (!pl.un) dh.pass.push({ name: NK, t: pl.aN, ref: true }); }
      ttSchedule(dh); addProf(dh); if (hasAcc) addR(dh); return dh; };
    const mkOut = (j, pl, cat) => { const head = [evS(NRT, pl.P - 60, pl.P), stop2(pl)]; let ev;
      if (pl.route === 'acc') { ev = [...head, ...(pl.un ? [evS(NK, pl.aN, pl.pN)] : []), evS(TAKA, pl.tY + pl.du, pl.tY + pl.du + 25)];
        sec.s2u.push([pl.p2, pl.aN]); sec.s1u.push([pl.pN, pl.tY]); if (pl.un) sec.nk.push([pl.aN, pl.pN]); }
      else ev = pl.w ? [...head, evS(NA, pl.ar, pl.ar + pl.w), evS(DH_ST, pl.ar + pl.w + RS, pl.ar + pl.w + RS + 25)] : [...head, thru(NA, pl.ar - 20), evS(DH_ST, pl.ar - 20 + RS, pl.ar - 20 + RS + 25)];
      const dh = mk(j.a, ev, cat); if (pl.route === 'acc') { passR(dh, pl.tY, pl.du, false); if (!pl.un) dh.pass.push({ name: NK, t: pl.aN, ref: true }); }
      ttSchedule(dh); addProf(dh); if (hasAcc) addR(dh); return dh; };
""")

cut("      else if (j.kind === 'in') { const Ds = dSec(j.d);", "      return best; };", r"""      else if (j.kind === 'in') { const Ds = dSec(j.d);   // 発車の150秒〜25分前に着く(5分前ごろを優先)
        for (const A of near(Ds - 1500, Ds - 150, Ds - 300)) { const sIn = [A - SW, A]; let op = null;
          for (const k of ks(cat)) { const v = { cat, k, ta: A, td: Ds, sIn, A }; let n = pen(v, sIn, null, v0);
            if (!n) { if (op == null) op = probe('i' + cat + A, () => ordPen(prof.d, [null, null, A - T2, A]) + (planIn(cat, A, v0.sIn, false) ? 0 : 7)); n = op; v.op = op; }
            if (!best || n < best.n) best = { n, v }; }
          if (best.n === 0) break; } }
      else { const Ta = aSec(j.a);   // 到着の120秒〜20分後に出る(3分後ごろを優先)
        for (const P of near(Ta + 120, Ta + 1200, Ta + 180)) { const sOut = [P, P + SW]; let op = null;
          // アクセス特急で着いて運用が終わる列車は、1番線がふさがっていればスカイライナーのホーム(車止め側)に入る
          for (const c of cat === 'access' ? ['access', 'liner'] : [cat]) for (const k of ks(c)) { const v = { cat: c, k, ta: Ta, td: P, sOut, P }; let n = pen(v, null, sOut, v0);
            if (!n) { if (op == null) op = probe('o' + cat + P, () => ordPen(prof.u, [null, null, P + T2, P]) + (planOut(cat, P, v0.sOut, false) ? 0 : 7)); n = op; v.op = op; }
            n += c !== cat ? 1 : 0; if (!best || n < best.n) best = { n, v }; }
          if (best.n === 0) break; } }
""")

cut("        let evs = evIn(v.A, src);", "    // ----- 京成成田: 前後の運用が無い始発・終着は", r"""        // 計画を確定する。ほかの回送とぶつかったら、いまの状態で時刻を選び直す
        let pl = src ? { route: 'sg', A: v.A, a2: v.A - T2, p2: v.A - T2, u2: 0 } : planIn(j.cat, v.A, v.sIn, true); memo.clear();
        if (!pl) { const b = choose(j); if (b.n < 2) { apply(j, b); v = j.v; e = edgeOf(v); pl = planIn(j.cat, v.A, v.sIn, true); memo.clear(); } }
        if (!pl) { stat.n--; stat.skip++; continue; }
        if (pl.u2) { v.sIn[0] = pl.p2; v.sIn[2] = pl.a2; }   // 空港第2ビルに止まっている時間
        const dh = mkIn(j, pl, src); dh.next = j.d; j.d.prev = dh; if (e != null) dh.forceEnd = e; if (pl.route === 'acc') stat.acc = (stat.acc || 0) + 1; if (pl.u2) stat.wait2 = (stat.wait2 || 0) + 1; if (pl.un) stat.waitNK = (stat.waitNK || 0) + 1;
        if (src) { src.next = dh; dh.prev = src; stat.fromNA = (stat.fromNA || 0) + 1; } }
      else { let pl = planOut(j.cat, v.P, v.sOut, true); memo.clear();
        if (!pl) { const b = choose(j); if (b.n < 2) { apply(j, b); v = j.v; e = edgeOf(v); pl = planOut(j.cat, v.P, v.sOut, true); memo.clear(); } }
        if (v.cat !== j.cat) j.a.dhCat = v.cat;
        if (!pl) { stat.n--; stat.skip++; if (e != null) j.a.forceEnd = e; continue; }
        if (pl.u2) { v.sOut[1] = pl.a2; v.sOut[2] = pl.p2; }
        const dh = mkOut(j, pl, v.cat); j.a.next = dh; dh.prev = j.a; if (e != null) j.a.forceEnd = e; if (pl.route === 'acc') stat.acc = (stat.acc || 0) + 1; if (pl.u2) stat.wait2 = (stat.wait2 || 0) + 1; if (pl.un) stat.waitNK = (stat.waitNK || 0) + 1; } }
""")
# 調査用の集計を新しい関数に合わせる
rep("else if (j.kind === 'in' ? ordLine(NA, NRT, x - RN, x) : ordLine(NRT, NA, x, x + RN)) c.line++; else if ((j.kind === 'in' ? naIn(x, false) : naOut(x, false)) < 0) c.na++; else c.ok++; }",
    "else if (!(j.kind === 'in' ? planIn(j.cat, x, v0.sIn, false) : planOut(j.cat, x, v0.sOut, false))) c.na++; else c.ok++; }")
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('patched')
