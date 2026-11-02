# ユーザーがつないだ組は、引上線を発車前の約3分(戻り・引上線にいる時間)だけ先に押さえる
p = 'src/ttcore.js'
s = open(p, encoding='utf-8', newline='').read()
NL = '\r\n' if '\r\n' in s else '\n'
def rep(a, b):
    global s
    a = a.replace('\n', NL); b = b.replace('\n', NL)
    assert s.count(a) == 1, (s.count(a), a[:60]); s = s.replace(a, b)
rep("""  function pre(t) {
    if (t.cpl) {""", """  function pre(t) {
    { const st = t.names[t.names.length - 1];   // 運用の編集でつないだ組: 先に計画する列車に引上線を取られないよう、発車前の約3分を押さえておく(plan の最初で外す)
      if (t.userLink && t.next === t.userLink && !t.exitEnd && !t.dh && SIDINGS.has(st) && noRev(st)) { const sd = SIDINGS.get(st)[0], dep0 = t.next.ev[0].dep * 60; reserve(sd.e, dep0 - 200, dep0 - 50, t); const l = res.get(sd.e); l[l.length - 1][3] = true; l[l.length - 1][4] = 'upre'; t.upre = sd.e; } }
    if (t.cpl) {""")
rep("""  function plan(t) {
    if (t.route !== undefined) return;""", """  function plan(t) {
    if (t.route !== undefined) return;
    if (t.upre != null) { const l = res.get(t.upre); if (l) res.set(t.upre, l.filter(r => !(r[4] === 'upre' && r[2] === t))); }""")
open(p, 'w', encoding='utf-8', newline='').write(s); print('ok')
