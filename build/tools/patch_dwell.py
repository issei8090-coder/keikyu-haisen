# 停車時間: 京急のふつうの停車はとても短い(15秒ほど)。待避・接続で止まる駅は今のまま
import shutil, json
def patch(p, pairs):
    s = open(p, encoding='utf-8').read()
    shutil.copy(p, '_tmp/disp/' + p.split('/')[-1] + '.before_dwell')
    for a, b in pairs:
        assert s.count(a) == 1, a[:70]
        s = s.replace(a, b)
    open(p, 'w', encoding='utf-8').write(s)
patch('src/ttcore.js', [(
"    let a = i === 0 ? e.dep * 60 - 25 : (single ? e.dep * 60 + 10 : e.arr * 60 + 25);",
"    let a = i === 0 ? e.dep * 60 - 25 : (single ? e.dep * 60 + 20 : e.arr * 60 + 25);   // 1分の中で止まる駅は15秒ほど(京急の停車は短い)"),
])
patch('src/disp.js', [
("    return { m, A: t.A[k], P: t.P[k], thru: !!(ev && ev.thru), name: nm, k, half: info ? info.len / 2 : 0 }; });",
 "    const wt = !!(ev && (ev.ot || ev.wait || ev.dep - ev.arr >= 1 || (t.long && t.long[i])));   // 待避・接続などで長く止まる駅\n"
 "    return { m, A: t.A[k], P: t.P[k], thru: !!(ev && ev.thru), name: nm, k, half: info ? info.len / 2 : 0, minDw: wt ? DTR.minDwellWait : DTR.minDwell }; });"),
("T < p.arrT + DTR.minDwell ? '着いたのが遅い(最短停車)'", "T < p.arrT + st.minDw ? '着いたのが遅い(最短停車)'"),
("    if (T < st.P || T < p.arrT + DTR.minDwell || p.hold", "    if (T < st.P || T < p.arrT + st.minDw || p.hold"),
("dw = i => Math.min(DTR.minDwell, Math.max(0, P0[i] - A0[i]));", "dw = i => Math.min(S[i].minDw, Math.max(0, P0[i] - A0[i]));"),
])
c = open('disp_cfg.json', encoding='utf-8').read()
a = '"minDwell": 20,'
assert c.count(a) == 1
c = c.replace(a, '"minDwell": 12, "minDwellWait": 20,')
open('disp_cfg.json', 'w', encoding='utf-8').write(c)
print('ok')
