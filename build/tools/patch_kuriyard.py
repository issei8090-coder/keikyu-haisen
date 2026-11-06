# 久里浜検車区(2026-11-05、ユーザー提供の配線略図 https://www.haisenryakuzu.net/documents/pr/keikyu/kurihama/ を参考に)
#  現行図: 北久里浜〜京急久里浜の間の「久里浜工場(信号場)」に、上り側(図の下)の久里浜検車区(約10線)と下り側(図の上)の久里浜工場。
#          京急久里浜の三崎口方に引上線は無い(元図 keikyu_s_1.gif の 209〜229,819 の行き止まりは古い配線)。
#  元図では検車区が縞の□(x104-133 y836-853)と短い行き止まり数本だけで、朝の出庫14本が三崎口方の引上線1本から出入りする計画になり、
#  運転指令で京急久里浜が詰まっていた。
#  ここでは: 元図の検車区の短い線と引上線を外し、縞の□の場所に、京急久里浜側(736 = 144,830 の上り本線)から左下へのはしごで 10線を引く(現行図の約10線)。
#   実物は北久里浜側から入り入出庫線で向きを変えるが、ここでは金沢文庫と同じ「ホームで向きを変える検車区」(YARD_CFG plat)として扱う。
#  使い方: build フォルダで python tools/patch_kuriyard.py → build2.py で data.json を作り直す
import json, io, shutil, os
p = 'cfg.json'
if not os.path.exists('_tmp/cfg.before_kuriyard.json'): shutil.copy(p, '_tmp/cfg.before_kuriyard.json')
c = json.load(io.open('_tmp/cfg.before_kuriyard.json', encoding='utf-8'))
KILL = [[47, 836, 104, 840],    # 元図の検車区の線 48〜103,839 と 91〜97 の短い線
        [84, 829, 103, 848],    # 85,830 → 102,847 の斜めの行き止まり
        [133, 829, 145, 840],   # 134〜144,839 と 144,830 → 134,839 のV字の行き止まり
        [205, 818, 230, 820]]   # 京急久里浜の三崎口方の引上線 206〜229,819(駅の出口 206〜209 は足し直す)
for k in KILL:
    if k not in c['kill']: c['kill'].append(k)
segs = [[206, 819, 209, 819]]
JX, JY, NT, Y0, DY, XE = 144, 830, 10, 835.0, 2.0, 88
x0 = JX - (Y0 - JY)
prev = (JX, JY)
for i in range(NT):
    y = round(Y0 + DY * i, 2); x = round(x0 - DY * i, 2)
    segs += [[prev[0], prev[1], x, y], [x, y, XE, y]]; prev = (x, y)
old = [s for s in c['add2'] if 90 <= min(s[0], s[2]) and max(s[0], s[2]) <= 210 and 818 <= min(s[1], s[3]) and max(s[1], s[3]) <= 856]
c['add2'] = [s for s in c['add2'] if s not in old] + segs
c['nodir'] = [b for b in c['nodir'] if b != [40, 838, 150, 850]]
for b in ([86, 833, 142, 855],):
    if b not in c['nodir']: c['nodir'].append(b)
hk = [103, 835, 134, 854]
c['hatchKill'] = [h for h in c.get('hatchKill', []) if h != hk] + [hk]
io.open(p, 'w', encoding='utf-8').write(json.dumps(c, ensure_ascii=False, separators=(', ', ': ')))
print('add2 +', len(segs), '外した add2', len(old))

# core.js: 検車区の駅と、ホームで向きを変える検車区の範囲
p = 'src/core.js'
s = io.open(p, encoding='utf-8', newline='').read()
a = "const YARD_ST = new Set(['西馬込', '神奈川新町', '金沢文庫']);"
if a in s: s = s.replace(a, "const YARD_ST = new Set(['西馬込', '神奈川新町', '金沢文庫', '京急久里浜']);")
a = "const YARD_CFG = { '金沢文庫': { box: [590, 494, 606, 530], plat: true } };"
if a in s: s = s.replace(a, "const YARD_CFG = { '金沢文庫': { box: [590, 494, 606, 530], plat: true }, '京急久里浜': { box: [86, 834, 92, 855], plat: true } };   // 京急久里浜 = 久里浜検車区(北久里浜〜京急久里浜の間)")
io.open(p, 'w', encoding='utf-8', newline='').write(s); print('core', "'京急久里浜'" in s)
