# ttLink を区切って計算できるようにする(ブラウザが固まらないように)。計算の中身・順番は変えない
#  ttcore.js: function* ttLinkG(list) にして、回送の割り当ての繰り返しごとに yield。ttLink(list) は今までどおり一気に計算する
#  tt.js: ttLoad は ttLinkG を 30ミリ秒ずつ進め、合間に画面を動かす
import io

p = 'src/ttcore.js'
s = io.open(p, encoding='utf-8').read()
def rep(old, new, cnt=1):
    global s
    assert s.count(old) == cnt, (old, s.count(old))
    s = s.replace(old, new)
rep("function ttLink(list) {\n",
    "// ttLink(list): 折り返し・回送を一気に計算する(node の検査用)。ブラウザは ttLinkG を少しずつ進める\n"
    "function ttLink(list) { const g = ttLinkG(list); for (;;) { const r = g.next(); if (r.done) return r.value; } }\n"
    "function* ttLinkG(list) {\n")
rep("    for (const j of jobs) apply(j, choose(j));\n",
    "    for (const j of jobs) { apply(j, choose(j)); yield; }\n")
rep("      for (const j of jobs) { const cur = pen(j.v, j.v.sIn, j.v.sOut, j.v) + (j.v.op || 0);",
    "      for (const j of jobs) { yield; const cur = pen(j.v, j.v.sIn, j.v.sOut, j.v) + (j.v.op || 0);")
rep("      for (const j of jobs) { const v = j.v; if (j.kind === 'fix') {",
    "      for (const j of jobs) { yield; const v = j.v; if (j.kind === 'fix') {")
rep("    for (const j of jobs) { if (j.v.cat === 'access' || !pOf(j)) continue;",
    "    for (const j of jobs) { yield; if (j.v.cat === 'access' || !pOf(j)) continue;")
rep("    for (const j of queue) { if (j === SENT) {",
    "    for (const j of queue) { yield; if (j === SENT) {")
io.open(p, 'w', encoding='utf-8', newline='\n').write(s)

p = 'src/tt.js'
s = io.open(p, encoding='utf-8').read()
rep("""  const nl = day && $('ttlink').checked ? ttLink(ttList) : 0;
  ttList.sort((a, b) => a.start - b.start);
  // 番線の占有を見ながら、早い列車から順に経路を確定(少しずつ計算)
  const token = ++ttToken, pl = ttPlanner($('ttlink').checked && $('ttsiding').checked), list = ttList;
""", """  const token = ++ttToken;
  if (day && $('ttlink').checked) {   // 折り返し・回送の計算は重いので、少しずつ進めて画面を止めない
    const g = ttLinkG(ttList);
    const step = () => {
      if (token !== ttToken) return;
      const t0 = performance.now();
      for (;;) { const r = g.next(); if (r.done) { ttLoad2(day, token, r.value, ot); return; } if (performance.now() - t0 > 30) break; }
      $('ttinfo').textContent = `折り返し・回送を計算中…`; setTimeout(step, 0);
    };
    $('ttinfo').textContent = `折り返し・回送を計算中…`; setTimeout(step, 0);
  } else ttLoad2(day, token, 0, ot);
}
function ttLoad2(day, token, nl, ot) {
  ttList.sort((a, b) => a.start - b.start);
  // 番線の占有を見ながら、早い列車から順に経路を確定(少しずつ計算)
  const pl = ttPlanner($('ttlink').checked && $('ttsiding').checked), list = ttList;
""")
io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('ok')
