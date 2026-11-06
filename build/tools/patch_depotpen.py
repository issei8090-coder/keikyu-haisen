# 経路探索: 検車区の入出庫線・車庫の線を、営業列車がふつうの道として使わないようにする(2026-11-05、ユーザー「金沢文庫の一番上の線から金沢八景へ行く線がいったん車庫を通っていってる」)
#  patch_kbref で 金沢文庫のいちばん上の線(464,530)から入出庫線(y=524)へのつなぎを足したので、入出庫線 → 斜め線 → 4線区間 が本線と並ぶ近道になり、
#  平日 201本(普通・急行)が入出庫線を通っていた。
#  ここでは: DEPOT_BOX の中に両端があるエッジ(入出庫線・車庫の線)のコストを DEPOT_PEN 倍に。車庫への出入りはそこしか道が無いので今までどおり通れる。
#  使い方: build フォルダで python tools/patch_depotpen.py(前の版 _tmp/core.js.before_depotpen)
import io, os, shutil
p = 'src/core.js'
b = '_tmp/core.js.before_depotpen'
if not os.path.exists(b): shutil.copy(p, b)
raw = io.open(b, encoding='utf-8', newline='').read(); crlf = '\r\n' in raw; s = raw.replace('\r\n', '\n')
def R(a, c):
    global s
    if a not in s: raise SystemExit('見つからない: ' + a[:80])
    s = s.replace(a, c, 1)
R("const WRONG_WAY = 4;", """// 検車区の入出庫線・車庫の線(両端がこの範囲の中のエッジ)は、ほかに道があればそちらを通る(金沢文庫: 入出庫線 y=524 と金沢検車区)
const DEPOT_BOX = [[466, 476, 627, 529.5]], DEPOT_PEN = 20;
E.forEach(e => { if (!e.portal && DEPOT_BOX.some(([x0, y0, x1, y1]) => [N[e.a], N[e.b]].every(q => q.x >= x0 && q.x <= x1 && q.y >= y0 && q.y <= y1))) e.depot = true; });
const WRONG_WAY = 4;""")
R("  return e.len * frac * (wrong ? WRONG_WAY : 1)", "  return e.len * frac * (wrong ? WRONG_WAY : 1) * (e.depot ? DEPOT_PEN : 1)")
if crlf: s = s.replace('\n', '\r\n')
io.open(p, 'w', encoding='utf-8', newline='').write(s); print('ok')
