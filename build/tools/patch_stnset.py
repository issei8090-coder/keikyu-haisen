# 駅ごとの設定(運用の編集「まとめて」タブ): 始発がホームに着く時刻・終着の列車がホームを出る時刻・折り返しの最短を、駅ごと/全駅まとめて変えられるようにする
# USER_OPS.stn = { _all: {in, out, turn}, 駅名: {in, out, turn} }(分。空欄=基準)。平日・土休日とも同じ
p = 'src/ttcore.js'; s = open(p, encoding='utf-8').read()
if 'function ttStn(' in s: print('already'); raise SystemExit
def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (a, s.count(a)); s = s.replace(a, b)
# 1) 設定を読む関数(ファイルの先頭の定数の後)
rep("const PLAT_GAP = 40;", """// 駅ごとの設定(運用の編集「まとめて」): USER_OPS.stn = { _all: {in, out, turn}, 駅名: {...} }(分)。空欄の駅は _all、_all も空欄ならいつもの値
//  in = 始発の列車がホームに着いている(発車の何分前)、out = 終着の列車がホームを出る(着いて何分後。引上線・車庫へ入る列車も)、turn = 折り返しの最短(分)
function ttStn(st, k) {
  const S = typeof USER_OPS !== 'undefined' && USER_OPS && USER_OPS.stn; if (!S) return null;
  const g = o => o && o[k] != null && o[k] !== '' && !isNaN(+o[k]) ? +o[k] : null;
  const v = g(S[st]); return v != null ? v : g(S._all);
}
const PLAT_GAP = 40;""")
# 2) 時刻表から時刻を作るところ: 始発駅に着く時刻・終着駅を出る時刻
rep("    let a = i === 0 ? e.dep * 60 - 25 : (single ? e.dep * 60 + 20 : e.arr * 60 + 25);",
    "    const sIn = i === 0 ? ttStn(e.name, 'in') : null;\n    let a = i === 0 ? e.dep * 60 - (sIn != null ? Math.max(10, sIn * 60) : 25) : (single ? e.dep * 60 + 20 : e.arr * 60 + 25);")
rep("    if (i === n - 1) d = a + 25;",
    "    if (i === n - 1) { const sOut = ttStn(e.name, 'out'); d = a + (sOut != null ? Math.max(10, sOut * 60) : 25); }")
# 3) 折り返しの最短
rep("    pairUp(as, ds, TURN_MIN, 30, ", "    pairUp(as, ds, ttStn(st, 'turn') != null ? ttStn(st, 'turn') : TURN_MIN, 30, ")
rep("    pairUp(as, ds, minTurn || TURN_MIN, TURN_MAX, ", "    pairUp(as, ds, minTurn || (ttStn(st, 'turn') != null ? ttStn(st, 'turn') : TURN_MIN), TURN_MAX, ")
# 4) 引上線・車庫から始発の列車がホームへ入る時刻(入る前に線を出る時刻の候補)
rep("      for (const from of [dep0 - 110, dep0 - 80, dep0 - 150]) for (const sd of sds) {",
    "      const sIn = ttStn(stn, 'in'), fr = sIn != null ? [0, 30, -30].map(x => dep0 - sIn * 60 - 40 + x) : [dep0 - 110, dep0 - 80, dep0 - 150];\n      for (const from of fr) for (const sd of sds) {")
# 5) 終着の列車が引上線・車庫へ入る(ホームを出る)時刻
rep("        if (!isFreeAt(sd.e, ta + 45, ta + 110, t)) continue;",
    "        const sOut = ttStn(stn, 'out'), lv0 = sOut != null ? Math.max(20, sOut * 60) : 40;\n        if (!isFreeAt(sd.e, ta + lv0 + 5, ta + lv0 + 70, t)) continue;")
rep("const out = r.stopD[r.stopD.length - 1] - r.stopD[r.stopD.length - 2], leave = ta + 40,", "const out = r.stopD[r.stopD.length - 1] - r.stopD[r.stopD.length - 2], leave = ta + lv0,")
rep("        reserve(sd.e, ta + 45, t.end, t); stat.deadOut", "        reserve(sd.e, ta + lv0 + 5, t.end, t); stat.deadOut")
open(p, 'w', encoding='utf-8').write(s); print('ok')
