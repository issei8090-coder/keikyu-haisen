# 成田空港の回送にも融通を持たせる(1回だけ実行するパッチ)
#  ・成田空港に着く/出る時刻を20秒刻みで選ぶ(送り込みは発車の150秒〜25分前着、引き上げは到着の120秒〜20分後発)
#  ・時刻を選ぶ段階で、京成成田での待ち合わせ(中線の空き・ポイントの交差・宗吾参道との間の前後関係)まで確かめる
#  ・作る段階でほかの回送とぶつかったら、その場で時刻を選び直す
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

# waitNA: 確かめるだけ(commit=false)もできるようにする
rep("    const waitNA = (f, stay, dir) => { for (let w = 40; w <= 1500; w += 20) { const st = stay(w); if (f(w) || !midFree(st[0], st[1]) || jump(dir, st) || !(dir > 0 ? thInOK(st[0]) : thOutOK(st[1]))) continue; midBusy.push(st); if (dir > 0) addIn(st[0]); else addOut(st[1]); return w; }",
    "    const waitNA = (f, stay, dir, commit) => { for (let w = 40; w <= 1500; w += 20) { const st = stay(w); if (f(w) || !midFree(st[0], st[1]) || jump(dir, st) || !(dir > 0 ? thInOK(st[0]) : thOutOK(st[1]))) continue; if (commit) { midBusy.push(st); if (dir > 0) addIn(st[0]); else addOut(st[1]); } return w; }")
rep("(dir < 0 && !thOutOK(ps))) return -1; if (dir < 0) addOut(ps); return 0; };", "(dir < 0 && !thOutOK(ps))) return -1; if (dir < 0 && commit) addOut(ps); return 0; };")

cut("    // 宗吾参道 → 京成成田(通常列車を先に通して待つ) → 成田空港。", "    // j.kind:", r"""    // 成田空港の回送の時刻は秒で決める。A = 成田空港に着く秒、P = 成田空港を出る秒。京成成田〜成田空港は RN 秒、空港第2ビルは成田空港の T2 秒手前
    const RN = RUN_NA * 60 + 25, T2 = 110, thru = (name, x) => ({ name, arr: Math.floor(x / 60), dep: Math.floor(x / 60), as: x, ds: x, thru: true });
    // 京成成田での待ち方(秒。0 = 通過、-1 = 無理)。commit = 中線・ポイントの使用を記録する
    const naIn = (A, commit) => { const dp = A - RN; return waitNA(w => ordLine(DH_ST, NA, (w ? dp - w : dp + 5) - RS, w ? dp - w : dp + 5) || !sgClear((w ? dp - w : dp + 5) - RS), w => w ? [dp - w, dp] : [dp + 5, dp + 5], 1, commit); };
    const naOut = (P, commit) => { const ar = P + RN; return waitNA(w => ordLine(NA, DH_ST, w ? ar + w : ar - 20, (w ? ar + w : ar - 20) + RS), w => w ? [ar, ar + w] : [ar - 20, ar - 20], -1, commit); };
    const memo = new Map(), probe = (key, f) => { if (!memo.has(key)) memo.set(key, f()); return memo.get(key); };   // 確かめた結果の覚え書き。記録が増えたら捨てる
    // 宗吾参道 → 京成成田(通常列車を先に通して待つ) → 成田空港。src = 京成成田から出る回送(京成成田止まりの列車がそのまま成田空港へ向かう)
    const evIn = (A, src) => { const dp = A - RN, tail = [thru(NRT2, A - T2), evS(NRT, A, A + 25)]; if (src) return [evS(NA, dp - 60, dp), ...tail];
      const w = naIn(A, true); memo.clear(); if (w < 0) return null;
      return w ? [evS(DH_ST, dp - w - RS - 55, dp - w - RS), evS(NA, dp - w, dp), ...tail] : [evS(DH_ST, dp + 5 - RS - 55, dp + 5 - RS), thru(NA, dp + 5), ...tail]; };
    const evOut = P => { const ar = P + RN, head = [evS(NRT, P - 60, P), thru(NRT2, P + T2)];
      const w = naOut(P, true); memo.clear(); if (w < 0) return null;
      return w ? [...head, evS(NA, ar, ar + w), evS(DH_ST, ar + w + RS, ar + w + RS + 25)] : [...head, thru(NA, ar - 20), evS(DH_ST, ar - 20 + RS, ar - 20 + RS + 25)]; };
""")

cut("      else if (j.kind === 'in') { const D = tDep(j.d);", "      return best; };", r"""      else if (j.kind === 'in') { const Ds = dSec(j.d);   // 発車の150秒〜25分前に着く(5分前ごろを優先)
        for (const A of near(Ds - 1500, Ds - 150, Ds - 300)) { const sIn = [A - 125, A]; let op = null;
          for (const k of ks(cat)) { const v = { cat, k, ta: A, td: Ds, sIn, A }; let n = pen(v, sIn, null, v0);
            if (!n) { if (op == null) op = probe('i' + A, () => ordPen(prof.d, [null, null, A - T2, A]) + ordLine(NA, NRT, A - RN, A) + (naIn(A, false) < 0 ? 7 : 0)); n = op; v.op = op; }
            if (!best || n < best.n) best = { n, v }; }
          if (best.n === 0) break; } }
      else { const Ta = aSec(j.a);   // 到着の120秒〜20分後に出る(3分後ごろを優先)
        for (const P of near(Ta + 120, Ta + 1200, Ta + 180)) { const sOut = [P, P + 125]; let op = null;
          // アクセス特急で着いて運用が終わる列車は、1番線がふさがっていればスカイライナーのホーム(車止め側)に入る
          for (const c of cat === 'access' ? ['access', 'liner'] : [cat]) for (const k of ks(c)) { const v = { cat: c, k, ta: Ta, td: P, sOut, P }; let n = pen(v, null, sOut, v0);
            if (!n) { if (op == null) op = probe('o' + P, () => ordPen(prof.u, [null, null, P + T2, P]) + ordLine(NRT, NA, P, P + RN) + (naOut(P, false) < 0 ? 7 : 0)); n = op; v.op = op; }
            n += c !== cat ? 1 : 0; if (!best || n < best.n) best = { n, v }; }
          if (best.n === 0) break; } }
""")

rep("    for (const j of jobs) { const v = j.v, e = edgeOf(v);\n      if (j.kind === 'fix') { if (e != null) j.a.forceEnd = e; continue; }",
    "    for (const j of jobs) { let v = j.v, e = edgeOf(v);\n      if (j.kind === 'fix') { if (e != null) j.a.forceEnd = e; continue; }")
cut("        const rk = j.d.type === 'liner' ? ttRunOf(j.d).key : null, src =", "    // ----- 京成成田: 前後の運用が無い始発・終着は", r"""        const rk = j.d.type === 'liner' ? ttRunOf(j.d).key : null, sa = x => tArr(x) * 60 + 30, src = rk ? (arr.get(NA) || []).find(x => !x.next && !x.exitEnd && !x.dh && x.type === 'liner' && ttRunOf(x).key === rk && sa(x) <= v.A - RN - 150 && sa(x) >= v.A - RN - 360) : null;   // 成田で6分より長く待つことになるなら、いったん宗吾参道へ戻す(成田のホームをふさがない)
        let evs = evIn(v.A, src);
        // ほかの回送と京成成田でぶつかった: いまの状態で時刻を選び直す
        if (!evs) { const b = choose(j); if (b.n < 2) { apply(j, b); v = j.v; e = edgeOf(v); evs = evIn(v.A, null); } }
        if (!evs) { stat.n--; stat.skip++; continue; }
        const dh = mk(j.d, evs, j.cat); ttSchedule(dh); addProf(dh); dh.next = j.d; j.d.prev = dh; if (e != null) dh.forceEnd = e; if (src) { src.next = dh; dh.prev = src; stat.fromNA = (stat.fromNA || 0) + 1; } }
      else { let evs = evOut(v.P);
        if (!evs) { const b = choose(j); if (b.n < 2) { apply(j, b); v = j.v; e = edgeOf(v); evs = evOut(v.P); } }
        if (v.cat !== j.cat) j.a.dhCat = v.cat;
        if (!evs) { stat.n--; stat.skip++; if (e != null) j.a.forceEnd = e; continue; }
        const dh = mk(j.a, evs, v.cat); ttSchedule(dh); addProf(dh); j.a.next = dh; dh.prev = j.a; if (e != null) j.a.forceEnd = e; } }
""")
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('patched')
