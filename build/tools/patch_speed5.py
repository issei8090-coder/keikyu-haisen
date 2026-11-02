# ttLinkG の区切りを増やす(京成上野の回送: 付いて走る方式を試すたび)。計算の中身・順番は変えない
import io
p = 'src/ttcore.js'
s = io.open(p, encoding='utf-8').read()
def rep(old, new):
    global s
    assert s.count(old) == 1, (old, s.count(old))
    s = s.replace(old, new)
rep("for (const ex of [60, 90, 120, 150]) if (m == null && !fc) fc = follow(false, (D - 14) * 60, (D - 3) * 60, fE, ex);",
    "for (const ex of [60, 90, 120, 150]) if (m == null && !fc) { yield; fc = follow(false, (D - 14) * 60, (D - 3) * 60, fE, ex); }")
rep("            for (const e of [es[0], es[3]]) { fc = follow(false,",
    "            for (const e of [es[0], es[3]]) { yield; fc = follow(false,")
rep("nxOf(e) < T0 + 8))) continue; const nx = nxOf(e);",
    "nxOf(e) < T0 + 8))) continue; yield; const nx = nxOf(e);")
io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('ok')
