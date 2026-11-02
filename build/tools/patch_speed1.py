# tkFree(高砂の車庫から出る回送の空き確認)を速くする。結果は同じ(入力は ttLink の間変わらないので覚えておく)
import io
p = 'src/ttcore.js'
s = io.open(p, encoding='utf-8').read()
old = "tkFree = t0 => !TAKA_STOPS.some(o => (o.pl === 3 || o.t.names[o.t.names.length - 1] === TAKA || o.pl === 4 && tk4Full(o)) && o.a < t0 + 90 && t0 - 120 < o.d) && !TAKA_STOPS.some(o => o.pl === 4 && o.d > t0 - 160 && o.d < t0 - 15) && !tkThruDn.some(x => x > t0 - 100 && x < t0 + 40) && !tkUpT.some(y => y > t0 - 40 && y < t0 + 60),"
new = "tkFree = t0 => { let v = tkMemo.get(t0); if (v === undefined) { if (!tkBl) tkBl = TAKA_STOPS.filter(o => o.pl === 3 || o.t.names[o.t.names.length - 1] === TAKA || o.pl === 4 && tk4Full(o)); v = !tkBl.some(o => o.a < t0 + 90 && t0 - 120 < o.d) && !TAKA_STOPS.some(o => o.pl === 4 && o.d > t0 - 160 && o.d < t0 - 15) && !tkThruDn.some(x => x > t0 - 100 && x < t0 + 40) && !tkUpT.some(y => y > t0 - 40 && y < t0 + 60); tkMemo.set(t0, v); } return v; }, tkMemo = new Map(),"
assert s.count(old) == 1
s = s.replace(old, new)
# tkBl は tkFree より前に宣言しておく(tk4Full の行の直後)
anchor = "    const tk4Full = o => "
assert s.count(anchor) == 1
s = s.replace(anchor, "    let tkBl = null;   // tkFree で避ける高砂の停車(3番線・高砂止まり・3番線に回る4番線の列車)\n" + anchor)
io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('ok')
