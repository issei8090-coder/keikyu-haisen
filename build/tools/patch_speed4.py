# ttLinkG の区切りを増やす(折り返し列車のために回送をどかす処理・見送った回送の入れ直し)。計算の中身・順番は変えない
import io
p = 'src/ttcore.js'
s = io.open(p, encoding='utf-8').read()
def rep(old, new):
    global s
    assert s.count(old) == 1, (old, s.count(old))
    s = s.replace(old, new)
rep("        for (const j of jobs) { const v = j.v; if (j.kind !== 'fix' || !pen(v, null, null, v)) continue;",
    "        for (const j of jobs) { yield; const v = j.v; if (j.kind !== 'fix' || !pen(v, null, null, v)) continue;")
rep("        for (const j of moved) { const b = choose(j); if (!b.n) { j.skip = false; apply(j, b); } } } }",
    "        for (const j of moved) { yield; const b = choose(j); if (!b.n) { j.skip = false; apply(j, b); } } } }")
rep("        for (const j of jobs) { if (!j.skip || j.kind === 'fix') continue; const t = j.t;",
    "        for (const j of jobs) { if (!j.skip || j.kind === 'fix') continue; yield; const t = j.t;")
rep("          for (const o of near) if (retry(j, [o])) { got = true; break; }",
    "          for (const o of near) { yield; if (retry(j, [o])) { got = true; break; } }")
io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('ok')
