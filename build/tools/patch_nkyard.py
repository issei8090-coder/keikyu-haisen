# 神奈川新町の検車区(2026-11-04、ユーザー「西馬込・神奈川新町に列車を並べる」)
#  参考図 kq/web/pr_keikyu_main_020_04 (haisenryakuzu.net) の新町検車区: 駅の横浜方・下側に約15線。
#  今の図では駅の下の行き止まり 358 (611,334) を東へ延ばし、はしご状の分岐から右へ車庫の線を並べる。
#  車庫の線はそれぞれ1本の辺(分岐点→行き止まり)にする(core.js yardOf は行き止まりに付いた辺の長さで線の長さを見る)
#  使い方: build フォルダで python tools/patch_nkyard.py → build2.py で data.json を作り直す
import json, io, shutil, os
p = 'cfg.json'
if not os.path.exists('_tmp/cfg.before_nkyard.json'): shutil.copy(p, '_tmp/cfg.before_nkyard.json')
c = json.load(io.open('_tmp/cfg.before_nkyard.json', encoding='utf-8'))
X0, Y0 = 611, 334          # 今の行き止まり(子安方の留置線 356 から入る)
LX, LY = 616, 334          # はしごの始まり
NT, Y1, DY, SL, XE = 10, 340.0, 6.2, 0.4, 692   # 列車は太さ4.4(縁6.4)で描くので線の間隔は6.2。10線×奥・手前=20本(平日の最大20本)
segs = [[X0, Y0, LX, LY]]
prev = (LX, LY)
for i in range(NT):
    y = round(Y1 + DY * i, 2); x = round(LX + (y - LY) * SL, 2)
    segs.append([prev[0], prev[1], x, y])      # はしご
    segs.append([x, y, XE, y])                 # 車庫の線
    prev = (x, y)
c['add2'] = c['add2'] + segs
io.open(p, 'w', encoding='utf-8').write(json.dumps(c, ensure_ascii=False, separators=(', ', ': ')))
print('add2 +', len(segs))
