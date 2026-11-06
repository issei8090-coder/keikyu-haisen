# 生麦を現行図(haisenryakuzu pr_keikyu_main_020_04)どおりに(2026-11-05、ユーザー「生麦駅の中線の渡線がおかしい」「生麦でも(待避を)直して」)
#  元図: 下り待避線が上下本線の間の「中線」(y=308)で、上り本線は生麦の前後で y=320 へ逃げていた。島式ホーム(348-365)と上のホーム(362-379)が左右にずれ、
#        運転指令の実距離の図では中線の出口の渡り線が 249m・中線のホームの直線が約57m しかなく、6両(108m)の普通が中線に入りきらず下り本線にはみ出して、
#        通過する優等が場内で止められ、待避が成り立たなかった。
#  現行図: 待避線は下り本線の外側(上)で片面ホーム、島式ホームは下り本線と上り本線の間、上り本線はまっすぐ。
#  ここでは: 元図の中線・上り本線の迂回・渡り線を外し、上り本線 y=308 をまっすぐ、待避線 y=287(下り本線 (330,297) から分かれ (393,297) で戻る)、
#            ホーム: 上(片面)[348,280,365,285]・島式 [348,300,365,305]。駅名の割り当て(cfg names はホームのかたまりの順)を合わせる。
#  使い方: build フォルダで python tools/patch_namamugi.py → build2.py で data.json を作り直す(前の版 _tmp/cfg.before_namamugi.json)
import json, io, shutil, os
p = 'cfg.json'
if not os.path.exists('_tmp/cfg.before_namamugi.json'): shutil.copy(p, '_tmp/cfg.before_namamugi.json')
c = json.load(io.open('_tmp/cfg.before_namamugi.json', encoding='utf-8'))
c['kill'].append([324, 296, 389, 321])          # 中線・上り本線の迂回・渡り線(両端がこの中の線だけ。上下本線の長い線は残る)
c['add2'] += [[325, 308, 388, 308],               # 上り本線(まっすぐ)
              [330, 297, 341, 287], [341, 287, 383, 287], [383, 287, 393, 297]]   # 下り待避線
c.setdefault('platKill', []).append([347, 288, 380, 318])
c.setdefault('platAdd', []).extend([[348, 280, 365, 285], [348, 300, 365, 305]])
io.open(p, 'w', encoding='utf-8').write(json.dumps(c, ensure_ascii=False, separators=(', ', ': ')))
print('ok')
# 駅名: cfg names はホームのかたまりの順番で割り当てるので、生麦のホームを変えると後ろの駅名がずれる。
#       全駅の名前を、元の図のホームの中心の位置(nameAt)で固定する(生麦は新しいホームの位置)
old = json.load(io.open('_tmp/data.before_namamugi.json', encoding='utf-8'))
have = {(round(x, 2), round(y, 2)) for x, y, nm in c.get('nameAt', [])}
add = []
for s in old['stations']:
    if s['name'] == '生麦': continue
    for p0 in s['plats']:
        x, y = round((p0[0] + p0[2]) / 2, 2), round((p0[1] + p0[3]) / 2, 2)
        if (x, y) not in have: add.append([x, y, s['name']])
add += [[356.5, 282.5, '生麦'], [356.5, 302.5, '生麦']]
c['nameAt'] = c.get('nameAt', []) + add
io.open(p, 'w', encoding='utf-8').write(json.dumps(c, ensure_ascii=False, separators=(', ', ': ')))
print('nameAt +', len(add))
# 駅の中の下り本線(345〜393, y=297)の向きの推定が 0 になったので、元どおり下り(+1)に固定する
if [329, 296, 394, 298, 1] not in c.get('dir', []): c.setdefault('dir', []).append([329, 296, 394, 298, 1])
io.open(p, 'w', encoding='utf-8').write(json.dumps(c, ensure_ascii=False, separators=(', ', ': ')))
