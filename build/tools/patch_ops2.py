# 「本日の運用」の小窓: 両数が変わる所に「別の車両」の区切りを入れ、各行に両数を出す。1回だけ実行するパッチ
import io
p = 'src/tt.js'; s = io.open(p, encoding='utf-8').read()
def rep(old, new):
    global s
    assert s.count(old) == 1, old; s = s.replace(old, new)
rep("  const li = (x, i) => { const ty = TYPES[x.type], p = rows[i - 1]; let gap = '';\n    if (p) {",
    "  // 終着時の両数: 金沢文庫で増結した列車は12両。ただし前に付けた4両は品川で切り離すので、品川より先まで行く列車は元の両数\n"
    "  const endCars = x => { if (!x.cpl) return x.cars; const q = x.names.indexOf('品川'); return x.cpl.side === 'front' && q > x.cpl.i && q < x.names.length - 1 ? x.cars : 12; };\n"
    "  const li = (x, i) => { const ty = TYPES[x.type], p = rows[i - 1]; let gap = '';\n"
    "    if (p && r.key && endCars(p) !== x.cars && !(x.added4 && x.prev === p)) gap = `<li class=\"gap cut\">ここから別の車両(${endCars(p)}両 → ${x.cars}両)</li>`;\n"
    "    else if (p) {")
rep("<span class=\"tm\">${x.no || ''}</span></li>`; };", "<span class=\"tm\">${x.no || ''}</span><span class=\"tm\">${x.cars}両${x.cpl ? '+4' : ''}</span></li>`; };")
io.open(p, 'w', encoding='utf-8', newline='').write(s)
p = 'src/template.html'; s = io.open(p, encoding='utf-8').read()
rep("  #ttops li.gap {", "  #ttops li.gap.cut { color:#b3541e; border-top:1px dashed #d9b99f; margin-top:2px; padding-top:2px; }\n  #ttops li.gap {")
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('patched')
