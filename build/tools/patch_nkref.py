# 新町検車区を配線略図の現行図(kq/web/parsed.json の pr_keikyu_main_020_04)の「線の本数・はしご・入出庫線とのつながり」に合わせる(2026-11-05)
#  ユーザーの決定: 本数と入り方は現行図どおり、線の長さは元図の枠(駅の下の空き)に収まるように伸ばして留置できる本数を保つ。
#  現行図: 子安方の引上線2本(y_r 88.9 = 今の図の y325 の線 A、y_r 98.3 = y334 の線 B)。
#    A から右下へ3本のはしご → 検車区の上の組 8線(y_r 135.7〜177.8)
#    B から右下へ3本の斜め線 → 短い留置線4本(y_r 112.3〜125.7)。そのうち1本(121.7)がそのまま下の組へ続き、急なはしごで 8線(y_r 187.2〜220)
#  今の図への写し方: 駅の下の空き(x 580〜690, y 338〜388)に、上の組・下の組を間隔2.6で並べる。行き止まりは現行図の長短どおり 690/683/664。
#  元図の線 B(544〜611, y334)は 596 で切る(現行図でも B ははしごの手前で終わる)。前の版(patch_yard2 の 8線はしご、入口 J=616,334)は外す。
#  使い方: build フォルダで python tools/patch_nkref.py → build2.py で data.json を作り直す
import json, io, shutil, os
p = 'cfg.json'
if not os.path.exists('_tmp/cfg.before_nkref.json'): shutil.copy(p, '_tmp/cfg.before_nkref.json')
c = json.load(io.open('_tmp/cfg.before_nkref.json', encoding='utf-8'))
inside = (lambda s, b: all(b[0] <= s[i] <= b[2] and b[1] <= s[i + 1] <= b[3] for i in (0, 2)))
OLD = [608, 324, 692, 362]
old = [s for s in c['add2'] if inside(s, OLD)]
print('前の新町検車区の線を外す', len(old))
c['add2'] = [s for s in c['add2'] if s not in old]
segs = []
# 線 B を 596 で切る
k = [543, 333, 612, 335]
if k not in c['kill']: c['kill'].append(k)
segs.append([544, 334, 596, 334])
# B から短い留置線へ(45度)。いちばん左の斜め線がいちばん深い線へ(現行図どおり)
S1, S2, S3, S4 = 338.5, 341, 343.5, 346
segs += [[596, 334, 600.5, S1], [600.5, S1, 618, S1]]
segs += [[591, 334, 598, S2], [598, S2, 617, S2]]
segs += [[581, 334, 590.5, S3], [590.5, S3, 617, S3]]          # 121.7 = 下の組へ続く線
segs += [[590.5, S3, 593, S4], [593, S4, 613, S4]]            # 125.7 は 121.7 から分かれる
# 上の組: A の終わり (611,325) から右下へ45度のはしご U、8線
PIT = 2.6
TY = [round(349 + PIT * i, 1) for i in range(8)]
TE = [690, 690, 690, 683, 683, 683, 683, 690]                  # 現行図: 135.7/145.1/149.8/177.8 が長い
prev = (611, 325)
for y, xe in zip(TY, TE):
    x = round(611 + (y - 325), 1)
    segs += [[prev[0], prev[1], x, y], [x, y, xe, y]]; prev = (x, y)
# 下の組: 121.7 の続き (617,343.5) → (620,346.5) から急なはしご W(横0.5:縦1)、8線
LY = [round(TY[-1] + PIT * (i + 1), 1) for i in range(8)]
LE = [683] * 6 + [664, 664]                                     # 215.3/220 は短い
segs.append([617, S3, 620, 346.5])
prev = (620, 346.5)
for y, xe in zip(LY, LE):
    x = round(620 + 0.5 * (y - 346.5), 2)
    segs += [[prev[0], prev[1], x, y], [x, y, xe, y]]; prev = (x, y)
c['add2'] += segs
c['nodir'] = [b for b in c['nodir'] if b != [617, 336, 692, 362]]
# [600,307,627,309] = 新町の手前の上り本線 330-331(601〜626, y308)。前の版では向きの推定が両方向(0)で、引上線から上りホームへの出庫がここを通っていた。
#   線 B を短くすると推定が上りだけ(-1)に変わり、新町始発の上り 505K・517D(平日)が出庫できなくなったので、前と同じ両方向に固定する
#   (nodir で推定から外すと、同じ束の上下の線の推定まで変わるので、推定のあとで向きだけ上書きする cfg 'dir')
for b in ([588, 336, 692, 390],):   # 車庫の線は向きの推定(横線の束)から外す
    if b not in c['nodir']: c['nodir'].append(b)
c.setdefault('dir', [])
if [600, 307, 627, 309, 0] not in c['dir']: c['dir'].append([600, 307, 627, 309, 0])
io.open(p, 'w', encoding='utf-8').write(json.dumps(c, ensure_ascii=False, separators=(', ', ': ')))
print('add2 +', len(segs), '上の組', TY, '下の組', LY)
