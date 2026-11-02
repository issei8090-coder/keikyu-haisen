# 運行番号どおりの折り返しを増やす(青砥・品川の食い違いの原因への対処)。1回だけ実行するパッチ
import io
p = 'src/ttcore.js'; s = io.open(p, encoding='utf-8').read()
def rep(old, new):
    global s
    assert s.count(old) == 1, old; s = s.replace(old, new)
# 1) 金沢文庫で前に増結した4両は品川で切り離すので、品川より先まで行く列車は8両で終着する
rep("  const carsOf = a => a.cpl ? 12 : a.cars;   // 金沢文庫で増結した列車は12両で終着する",
    "  // 金沢文庫で増結した列車は12両で終着する。ただし前に付けた4両は品川で切り離すので、品川より先まで行く列車は元の両数で終着する\n"
    "  const carsOf = a => { if (!a.cpl) return a.cars; const q = a.names.indexOf(SHINA); return a.cpl.side === 'front' && q > a.cpl.i && q < a.names.length - 1 ? a.cars : 12; };")
# 2) 途中駅でも、同じ運行番号なら 30 分までつなぐ(青砥の21分折り返しなど)
rep("DEPOT_ST.has(st) ? DEPOT_MAX : TURN_MAX);", "DEPOT_ST.has(st) ? DEPOT_MAX : RUN_MAX);")
rep("const TURN_MAX = 20;", "const RUN_MAX = 30;       // 同じ運行番号の列車どうしなら、ここまであいていても同じ車両の折り返しとみなす(分)\nconst TURN_MAX = 20;")
# 3) 「着いてすぐ出る」組も、同じ運行番号の相手がいればそちらを選ぶ
rep("      const d = ds.find(d => !d.prev && d !== a && tDep(d) >= ta && tDep(d) <= ta + 3 && carsOf(a) === d.cars && d.names[1] !== from);",
    "      const cs = ds.filter(d => !d.prev && d !== a && tDep(d) >= ta && tDep(d) <= ta + 3 && carsOf(a) === d.cars && d.names[1] !== from), ka = ttRunOf(a).key;\n"
    "      const d = (ka && cs.find(d => ttRunOf(d).key === ka)) || cs[0];")
# 4) 品川で4両を足して12両で折り返す組も、同じ運行番号の列車を優先する
rep("      const a = as.find(a => !a.next && carsOf(a) === 8 && tDep(d) >= tArr(a) + minTurn && tDep(d) <= tArr(a) + TURN_MAX);",
    "      const c8 = as.filter(a => !a.next && carsOf(a) === 8 && tDep(d) >= tArr(a) + minTurn && tDep(d) <= tArr(a) + TURN_MAX), kd = ttRunOf(d).key;\n"
    "      const a = (kd && c8.find(a => ttRunOf(a).key === kd)) || c8[0];")
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('patched')
