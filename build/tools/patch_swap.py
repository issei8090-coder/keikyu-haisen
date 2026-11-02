# 京急の終着駅(浦賀など)での車両交換: 両数の違う列車どうしは折り返しとしてつながない。1回だけ実行するパッチ
import io
p = 'src/ttcore.js'; s = io.open(p, encoding='utf-8').read()
def rep(old, new):
    global s
    assert s.count(old) == 1, old; s = s.replace(old, new)
rep("    pairUp(as, ds, TURN_MIN, 30, (a, d) => pairOK(st, a, d), 30);   // 行き止まりの終着駅でも、同じ運行番号どうしを先につなぐ",
    "    // 行き止まりの終着駅でも、同じ運行番号どうしを先につなぐ。\n"
    "    // 京急の終着駅では、両数の違う列車はつながない(浦賀の車両交換: 着いた車両は回送で出ていき、別の車両が回送で入ってくる)。\n"
    "    // 京成・北総側は時刻表に両数が無く仮の値なので、両数では判断しない\n"
    "    const realCars = (() => { const ss = stByName.get(st); return ss && ss.stops.length && N[E[ss.stops[0][0]].a].y < 890; })();\n"
    "    pairUp(as, ds, TURN_MIN, 30, (a, d) => pairOK(st, a, d) && (!realCars || carsOf(a) === d.cars), 30);\n"
    "    if (realCars) for (const a of as) if (!a.next) { const k = ttRunOf(a).key, d = k && ds.find(d => ttRunOf(d).key === k && tDep(d) >= tArr(a) && tDep(d) <= tArr(a) + 30 && carsOf(a) !== d.cars); if (d) { a.swapOut = d; d.swapIn = a; } }")
io.open(p, 'w', encoding='utf-8', newline='').write(s)

p = 'src/tt.js'; s = io.open(p, encoding='utf-8').read()
old = "  $('ttlinkinfo').innerHTML = [lk('前の運用', t.prev), lk('折り返し後', t.next)].filter(Boolean).join('<br>')"
rep(old, "  const sw = t.swapOut ? `${t.names[t.names.length - 1]}で車両交換: この${t.cars}両は回送で出ていき、${t.swapOut.cars}両の別の車両が ${t.swapOut.no} になる(推定)` : t.swapIn ? `${t.names[0]}で車両交換: ${t.swapIn.no}(${t.swapIn.cars}両)に代わって、回送で入ってきた${t.cars}両(推定)` : '';\n"
    + "  $('ttlinkinfo').innerHTML = [lk('前の運用', t.prev), lk('折り返し後', t.next), sw].filter(Boolean).join('<br>')")
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('patched')
