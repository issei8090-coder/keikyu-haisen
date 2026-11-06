# 金沢検車区: 八景方のはしご(patch_kbref で「端だけでつなぐ」印 1 を付けた斜め線)から始まる線を、斜め線に分岐としてつなぐ(2026-11-05)
#  patch_kbref では、行き止まりまで通した長い線が斜め線で切れないよう、斜め線を端だけでつないだ。ところが現行図で斜め線から
#  始まる線(左の端が斜め線の上にある線)までつながらず、浮いた線になっていた(車庫12〜15番: どのホームからも行けない)。
#  斜め線を、その上に端がある横線の位置で区切る(区切った所は頂点が同じなので分岐になる。通しの線とは今までどおり交差だけ)。
#  順番: patch_kbref → patch_nkref → この patch(cfg.json を直接直す。何度当てても同じ)
import json, io, math
p = 'cfg.json'
c = json.load(io.open(p, encoding='utf-8'))
BOX = [500, 470, 626, 532]
inb = lambda q: all(BOX[0] <= q[i] <= BOX[2] and BOX[1] <= q[i + 1] <= BOX[3] for i in (0, 2))
H = [q for q in c['add2'] if inb(q) and q[1] == q[3]]
ends = [(q[0], q[1]) for q in H] + [(q[2], q[3]) for q in H]
out, n = [], 0
for q in c['add2']:
    if not (inb(q) and len(q) >= 5 and q[4] == 1 and q[1] != q[3]): out.append(q); continue
    x0, y0, x1, y1 = q[:4]; L = math.hypot(x1 - x0, y1 - y0); cut = []
    for (x, y) in ends:
        t = ((x - x0) * (x1 - x0) + (y - y0) * (y1 - y0)) / L / L
        if 1e-3 < t < 1 - 1e-3:
            px, py = x0 + t * (x1 - x0), y0 + t * (y1 - y0)
            if math.hypot(px - x, py - y) < 0.5: cut.append((t, x, y))
    if not cut: out.append(q); continue
    cut.sort(); pts = [(x0, y0)] + [(x, y) for _, x, y in cut] + [(x1, y1)]
    for a, b in zip(pts, pts[1:]): out.append([a[0], a[1], b[0], b[1], 1])
    n += len(cut); print('斜め線', q[:4], '→ 区切り', [(x, y) for _, x, y in cut])
c['add2'] = out
# 線の長さを伸ばす(ユーザーの決定「本数と入り方は現行図、長さは伸ばして留置できる本数を保つ」): 平日の夜、昼に入って出ない列車で奥がふさがり
#  6本が入りきらなかった。八景方の短い線(車庫14〜16番 y 500/505.3/507.98 と、いちばん上の 19番 y 483.99)を、八景のホームの上の空き(駅名より上)へ x=625 まで延ばす。
EXT = {500.0: 592.64, 505.3: 592.64, 507.98: 592.64, 483.99: 586.41}
for q in c['add2']:
    if inb(q) and q[1] == q[3] and q[1] in EXT and abs(max(q[0], q[2]) - EXT[q[1]]) < 0.05:
        if q[0] > q[2]: q[0] = 625
        else: q[2] = 625
        print('延ばした', q)
io.open(p, 'w', encoding='utf-8').write(json.dumps(c, ensure_ascii=False, separators=(', ', ': ')))
print('区切った所', n)
