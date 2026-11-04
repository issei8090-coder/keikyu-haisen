# 金沢文庫の検車区(金沢検車区, 2026-11-04 ユーザー「金沢文庫もやって」)
#  参考図 kq/web/v_pr_keikyu_main_020_07.png: 金沢文庫と金沢八景のあいだの上り側(図の上)に約15線。
#  今の図では文庫〜八景の上の線(y=532, e1979 x524-566)の x=540 から右上へはしごを出し、右へ車庫の線を並べる(行き止まりは右端)。
#  車庫から出る車両は左へ進んで文庫の上の線のホーム(下りの始発が使う)に入り、ホームで向きを変える。
#  列車は太さ4.4(縁6.4)で描くので線の間隔は6.2。10線、長さ約130〜150で1線に最大4本。
#  使い方: build フォルダで python tools/patch_kbyard.py → build2.py で data.json を作り直す
import json, io, shutil, os
p = 'cfg.json'
if not os.path.exists('_tmp/cfg.before_kbyard.json'): shutil.copy(p, '_tmp/cfg.before_kbyard.json')
c = json.load(io.open('_tmp/cfg.before_kbyard.json', encoding='utf-8'))   # 何度当てても同じになるよう、当てる前の cfg から作る
JX, JY = 540, 532            # 上の線の分かれ目
NT, Y1, DY, SL, XE = 9, 512.0, 6.2, 0.4, 700   # 10線目(y=456.2)は図の別の部品の頂点で切れるので9線(9×4=36本)
segs = []
prev = (JX, JY)
for i in range(NT):
    y = round(Y1 - DY * i, 2); x = round(JX + (JY - y) * SL, 2)
    segs.append([prev[0], prev[1], x, y])      # はしご
    segs.append([x, y, XE, y])                 # 車庫の線
    prev = (x, y)
n = 0
for sg in segs:
    if sg not in c['add2']: c['add2'].append(sg); n += 1
nd = [545, 450, 705, 516]    # 車庫の線を向きの推定(横線の束)から外す
if nd not in c['nodir']: c['nodir'].append(nd)
io.open(p, 'w', encoding='utf-8').write(json.dumps(c, ensure_ascii=False, separators=(', ', ': ')))
print('add2 +', n)
