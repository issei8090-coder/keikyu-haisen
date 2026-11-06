# 金沢検車区を配線略図の現行図(https://www.haisenryakuzu.net/documents/pr/keikyu/main/#bunko 、kq/web/parsed.json の pr_keikyu_main_020_07)から写す(2026-11-05、ユーザー「金沢検車区も新町検車区も、配線図違くない?」)
#  前の版(patch_yard2)は元図の縞の□に収まるよう 11線のはしごを手で決めていた。現行図は約17線で、金沢文庫の外側の線(入出庫線)からも 4線区間のいちばん上の線からも入れる。
#  写し方: 横 = 金沢文庫・金沢八景のホームの中心を合わせる(x_g = 401.9 + 0.6356 x_r)、
#          縦 = 入出庫線 y_r 96.5 → 今の図の 524(元図にも同じ線がある)、4線区間のいちばん上 y_r 105.9 → 532。入出庫線より上は 0.57 倍(段の境 y=480 より下に収める)。
#  駅・本線・4線区間・元図の入出庫線と渡り線はそのまま。検車区の線と、それを入出庫線・4線区間につなぐ斜め線だけを写す。
#  使い方: build フォルダで python tools/patch_kbref.py → build2.py で data.json を作り直す
import json, io, shutil, os
p = 'cfg.json'
if not os.path.exists('_tmp/cfg.before_kbref.json'): shutil.copy(p, '_tmp/cfg.before_kbref.json')
c = json.load(io.open('_tmp/cfg.before_kbref.json', encoding='utf-8'))
P = json.load(io.open('kq/web/parsed.json', encoding='utf-8'))['pr_keikyu_main_020_07']
X = lambda x: round(401.9 + 0.6356 * x, 2)
def Y(y):
    if abs(y - 105.9) < 0.3: return 532.0
    if abs(y - 96.5) < 0.3: return 524.0
    return round(524 - 0.57 * (96.5 - y), 2) if y < 96.5 else round(524 + 8 / 9.4 * (y - 96.5), 2)
segs = []
for s in P['tracks']:
    x0, y0, x1, y1 = s
    if min(x0, x1) < 171.5 or max(x0, x1) > 301: continue            # 検車区の範囲(入出庫線の始まり 172 〜 行き止まり 300)
    if max(y0, y1) > 106.1: continue                                   # 4線区間より下は写さない
    if min(y0, y1) > 105.5 and max(y0, y1) < 106.1 and abs(y0 - y1) < 0.1: continue   # 4線区間の線そのもの(今の図にある)
    if abs(y0 - 96.5) < 0.1 and abs(y1 - 96.5) < 0.1 and min(x0, x1) < 181: continue  # 入出庫線の元図と重なる所(172 まで)は今の図の線を使う
    segs.append([X(x0), Y(y0), X(x1), Y(y1)])
# 検車区の線は八景方のはしご(現行図 x 243〜262 の斜め線)で途中が切れて描かれているので、同じ高さの線は1本に通す(切れたままだと
# 留置に使える長さが行き止まりから斜め線までだけになり、夜の入庫が入りきらなかった)。八景方の斜め線は端だけでつなぐ(途中で交わる線とは分岐にしない = 5番目の値 1)
H = {}
for q in [q for q in segs if q[1] == q[3]]: H.setdefault(q[1], []).append(sorted([q[0], q[2]]))
segs = [q for q in segs if q[1] != q[3]]
for y, L in H.items():
    L.sort(); cur = L[0][:]
    for a0, a1 in L[1:]:
        if a0 - cur[1] <= 4.5: cur[1] = max(cur[1], a1)
        else: segs.append([cur[1], y, cur[0], y]); cur = [a0, a1]
    segs.append([cur[1], y, cur[0], y])
for q in segs:
    if q[1] != q[3] and min(q[0], q[2]) >= X(243) - 0.1 and max(q[0], q[2]) <= X(262) + 0.1: q.append(1)
# 元図の入出庫線(479〜520, 524)を、現行図どおり検車区の線の終わり(253.6 → 563.1)まで延ばし、金沢文庫のいちばん上のホームの線(464,530)からも入れる
for q in segs:   # 写した入出庫線(517.6〜563.1)は元図の線(〜520)と重なるので、520 から先だけにする
    if q[1] == 524.0 and q[3] == 524.0 and min(q[0], q[2]) < 520: q[0], q[2] = max(q[0], q[2]), 520
segs += [[464, 530, 469, 524], [469, 524, 479, 524]]
# 前の版の検車区(はしご 11線)を外す
OLD = [528, 490, 600, 527]
old = [s for s in c['add2'] if all(OLD[0] <= s[i] <= OLD[2] and OLD[1] <= s[i + 1] <= OLD[3] for i in (0, 2))]
c['add2'] = [s for s in c['add2'] if s not in old] + segs
for k in ([523, 527, 529, 533],):   # 元図の 524,532 → 528,528(前の版のはしごの付け根)
    if k not in c['kill']: c['kill'].append(k)
c['nodir'] = [b for b in c['nodir'] if b != [528, 496, 600, 527]]
for b in ([505, 478, 600, 530.5],):
    if b not in c['nodir']: c['nodir'].append(b)
io.open(p, 'w', encoding='utf-8').write(json.dumps(c, ensure_ascii=False, separators=(', ', ': ')))
print('写した線', len(segs), '外した前の版', len(old))
for s in segs: print(' ', s)

p = 'src/core.js'
s = io.open(p, encoding='utf-8', newline='').read()
a = "'金沢文庫': { box: [590, 494, 606, 530], plat: true }"
if a in s: s = s.replace(a, "'金沢文庫': { box: [[552, 478, 596, 529], [398, 555, 406, 590]], plat: true }")   # 上大岡方の留置線(6線)も夜間の留置に(core.js の yardOf は box を複数とれるようにした); io.open(p, 'w', encoding='utf-8', newline='').write(s); print('core ok')
