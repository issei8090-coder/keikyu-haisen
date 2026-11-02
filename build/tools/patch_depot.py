# 車庫のある終着駅(西馬込)で、運行番号どうしをつなぎ、長く止まる車両は車庫の線へ入れる。1回だけ実行するパッチ
import io
p = 'src/ttcore.js'; s = io.open(p, encoding='utf-8').read()
def rep(old, new):
    global s
    assert s.count(old) == 1, old; s = s.replace(old, new)
rep("""  const pairUp = (as, ds, minT, maxT, ok, runMax) => {
    for (const d of ds) {""", """  const pairUp = (as, ds, minT, maxT, ok, runMax) => {
    // runMax を渡した駅では、まず同じ運行番号の列車どうしをつなぐ(同じ車両がそのまま折り返す)。残りは時刻の近さでつなぐ
    if (runMax) for (const d of ds) {
      const kd = ttRunOf(d).key; if (d.prev || !kd) continue;
      const td = tDep(d); let best = null;
      for (const a of as) if (!a.next && a !== d && ttRunOf(a).key === kd && tArr(a) + 1 <= td && td <= tArr(a) + runMax && ok(a, d) && (!best || tArr(a) > tArr(best))) best = a;
      if (best) { best.next = d; d.prev = best; best.runLink = true; }
    }
    for (const d of ds) {""")
rep("    pairUp(as, ds, TURN_MIN, 30, (a, d) => pairOK(st, a, d), 12);", "    pairUp(as, ds, TURN_MIN, 30, (a, d) => pairOK(st, a, d));")
rep("    pairUp(as, ds, minTurn || TURN_MIN, TURN_MAX, (a, d) => carsOf(a) === d.cars && pairOK(st, a, d));",
    "    pairUp(as, ds, minTurn || TURN_MIN, TURN_MAX, (a, d) => carsOf(a) === d.cars && pairOK(st, a, d), DEPOT_ST.has(st) ? DEPOT_MAX : 0);")
rep("    } else if (st === '京成上野') {", "    } else if (DEPOT_ST.has(st)) general(st, as, ds);   // 車庫のある終着駅: 長く止まる車両は車庫の線へ入れる\n    else if (st === '京成上野') {")
rep("const SHINA = '品川'", "// 車庫へ出入りできる終着駅。ここでは運行番号が同じ列車どうしをつなぎ、折り返しまで長くあく車両はいったん車庫の線へ入れる\nconst DEPOT_ST = new Set(['西馬込']), DEPOT_MAX = 60;\nconst SHINA = '品川'")
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('patched')
