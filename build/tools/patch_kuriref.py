# 久里浜検車区を現行図に合わせて引き直す(2026-11-05、ユーザー指摘「京急久里浜の車庫違うよ」)
#  参考: https://www.haisenryakuzu.net/documents/pr/keikyu/kurihama/ (021_01.svg)
#  現行図: 北久里浜〜京急久里浜の間の久里浜工場(信)。検車区は上り本線(図の下)の下にあり、
#    ・はしごは「北久里浜側」の上り本線から右下へ下り、車庫の線は京急久里浜の方へ伸びて行き止まり(約10線)
#    ・京急久里浜のすぐ北久里浜方で上り本線から入出庫線(本線の下に並ぶ線)が分かれ、北久里浜側の行き止まりまで続く。
#      京急久里浜から来た車両は入出庫線を北久里浜側の端まで進み、向きを変えてはしごから車庫の線へ入る(出るときは逆)
#  前の patch_kuriyard.py は京急久里浜側(144,830)から左下へのはしごで、入り方が逆だった。
#  図の座標: 上り本線 y=830(左=北久里浜方、右=京急久里浜 x≈172〜)。
#  使い方: build フォルダで python tools/patch_kuriref.py → build2.py で data.json を作り直す
import json, io, shutil, os
p = 'cfg.json'
if not os.path.exists('_tmp/cfg.before_kuriref.json'): shutil.copy(p, '_tmp/cfg.before_kuriref.json')
c = json.load(io.open('_tmp/cfg.before_kuriref.json', encoding='utf-8'))
# 前の版(patch_kuriyard)のはしご・車庫の線を外す
old = [s for s in c['add2'] if max(s[0], s[2]) <= 145 and 830 <= min(s[1], s[3]) and max(s[1], s[3]) <= 856]
c['add2'] = [s for s in c['add2'] if s not in old]
segs = []
# 入出庫線: 上り本線 (158,830) から左下へ分かれ、y=836 を北久里浜方の行き止まり x=22 まで
SY, SX0, SX1 = 836, 60, 152   # 向きを変える端は x=60(久里浜工場(信)のあたり。x=22 だとホームまで約1kmを入換25km/hで走り、出庫が6分遅れた)
segs += [[158, 830, SX1, SY], [SX1, SY, SX0, SY]]
# はしご: 上り本線 (90,830) から右下へ(入出庫線 y=836 と交わる所は分岐)、車庫の線 10本は右(京急久里浜方)へ x=150 で行き止まり
LX, LY, NT, T0, DT, XE = 90, 830, 10, 839, 2, 170   # 車庫の線の行き止まり x=170(京急久里浜のホームの手前。8両 4〜5本ずつ)
pts = [(LX, LY), (LX + (SY - LY), SY)]
for i in range(NT):
    y = T0 + DT * i; pts.append((LX + (y - LY), y))
for a, b in zip(pts, pts[1:]): segs.append([a[0], a[1], b[0], b[1]])
for (x, y) in pts[2:]: segs.append([x, y, XE, y])
c['add2'] += segs
c["nodir"] = [b for b in c["nodir"] if b not in ([86, 833, 142, 855], [15, 833, 156, 860])]
for b in ([15, 833, 172, 860],):
    if b not in c['nodir']: c['nodir'].append(b)
io.open(p, 'w', encoding='utf-8').write(json.dumps(c, ensure_ascii=False, separators=(', ', ': ')))
print('外した', len(old), '足した', len(segs))

# core.js: 久里浜は「ホームで向きを変える」検車区ではなく、入出庫線(引上線)で向きを変える検車区
p = 'src/core.js'
s = io.open(p, encoding='utf-8', newline='').read()
a = ", '京急久里浜': { box: [86, 834, 92, 855], plat: true } };   // 京急久里浜 = 久里浜検車区(北久里浜〜京急久里浜の間)"
if a in s: s = s.replace(a, " };   // 京急久里浜 = 久里浜検車区(北久里浜〜京急久里浜の間)は入出庫線の北久里浜方の端で向きを変える(引上線と同じ扱い)")
io.open(p, 'w', encoding='utf-8', newline='').write(s); print('core', 'plat: true } };' in s)
