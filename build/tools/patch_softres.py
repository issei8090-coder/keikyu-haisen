# 途中駅で長く折り返す列車は、ほかの列車が通る予定(下調べの経路)の番線を避ける
import shutil
p = 'src/ttcore.js'
s = open(p, encoding='utf-8').read()
shutil.copy(p, '_tmp/disp/ttcore.js.before_softres')
def rep(a, b):
    global s
    assert s.count(a) == 1, a[:70]
    s = s.replace(a, b)
rep("""  const reserve = (e, a, b, own) => { if (!res.has(e)) res.set(e, []); res.get(e).push([a, b, own]); };""",
"""  const reserve = (e, a, b, own) => { if (!res.has(e)) res.set(e, []); res.get(e).push([a, b, own]); };
  // 下調べで、どの列車がどの番線を使いそうか(押さえはしない)。途中駅で長く折り返す列車が、あとから来る列車の番線をふさがないようにするのに使う
  const soft = new Map();
  const softFree = (e, a, b, t) => !(soft.get(e) || []).some(r => r[0] < b && a < r[1] && r[2] !== t && r[2] !== t.next && r[2] !== t.prev);""")
rep("""    r.stopE.forEach((e, i) => { if (e != null && r.only[i] && !(t.cpl && i === t.cpl.i)) { const s = span(t, i); reserve(e, s[0], s[1], t); res.get(e)[res.get(e).length - 1][3] = true; } });""",
"""    r.stopE.forEach((e, i) => { if (e != null && r.only[i] && !(t.cpl && i === t.cpl.i)) { const s = span(t, i); reserve(e, s[0], s[1], t); res.get(e)[res.get(e).length - 1][3] = true; } });
    r.stopE.forEach((e, i) => { if (e == null || (t.ev[i] && t.ev[i].thru)) return; const s = span(t, i); if (!soft.has(e)) soft.set(e, []); soft.get(e).push([s[0], s[1], t]); });""")
rep("""if (i === n - 1 && t.forceEnd != null) return e === t.forceEnd; const s = span(t, i); if (isFreeAt(e, s[0], s[1], t) && nrtFree(t, i, e)) return true;""",
"""if (i === n - 1 && t.forceEnd != null) return e === t.forceEnd; const s = span(t, i);
        // 途中駅(京急川崎など)で5分以上止まって折り返す: ほかの列車が通る予定の番線は、ほかに空いた番線があれば使わない
        if (i === n - 1 && t.next && s[1] - s[0] > 300 && !TERMINI.has(t.names[i])) { const ok = x => isFreeAt(x, s[0], s[1], t) && softFree(x, s[0], s[1], t); if (!ok(e) && [...stByName.get(t.names[i]).stopMap.keys()].some(x => x !== e && ok(x))) return false; }
        if (isFreeAt(e, s[0], s[1], t) && nrtFree(t, i, e)) return true;""")
open(p, 'w', encoding='utf-8').write(s)
print('ok')
