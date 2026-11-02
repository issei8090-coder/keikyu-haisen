# ttLinkG の区切りを増やす(見送りの再試行・京成成田・京成上野の回送)。計算の中身・順番は変えない
import io
p = 'src/ttcore.js'
s = io.open(p, encoding='utf-8').read()
def rep(old, new):
    global s
    assert s.count(old) == 1, (old, s.count(old))
    s = s.replace(old, new)
rep("r.retried = true; memo.clear(); const b = choose(r);", "r.retried = true; yield; memo.clear(); const b = choose(r);")
rep("y) => tDep(x) - tDep(y))) { if (d.prev || d.exitStart || d.dh || d.swapIn) continue;", "y) => tDep(x) - tDep(y))) { yield; if (d.prev || d.exitStart || d.dh || d.swapIn) continue;")
rep("y) => tArr(x) - tArr(y))) { if (a.next || a.exitEnd || a.dh || a.swapOut) continue;", "y) => tArr(x) - tArr(y))) { yield; if (a.next || a.exitEnd || a.dh || a.swapOut) continue;")
rep("y) => tDep(x) - tDep(y))) { if (d.prev || d.dh || d.type !== 'liner') continue;", "y) => tDep(x) - tDep(y))) { yield; if (d.prev || d.dh || d.type !== 'liner') continue;")
rep("y) => tArr(x) - tArr(y))) { if (a.next || a.dh || a.type !== 'liner') continue;", "y) => tArr(x) - tArr(y))) { yield; if (a.next || a.dh || a.type !== 'liner') continue;")
io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('ok')
