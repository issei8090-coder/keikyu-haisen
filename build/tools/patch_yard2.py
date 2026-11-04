# 検車区の作り直し(2026-11-04、ユーザー「金沢の検車区でかすぎ、新町も。縮尺がおかしい」「旧の縞線の□が残っている、そこにあるんじゃないか」)
#  元図(keikyu_s_1.gif)の縞の□が検車区の場所。そこに収まる大きさで線を引き直す(前の版は線の長さ150で、文庫〜八景の間より長く八景の先まで出ていた)。
#  図の縮尺: ホーム(12両)=17、列車の長さ=両数×1.5。参考図(haisenryakuzu.net)の金沢検車区は線の長さがホームの1.5〜2倍。
#  金沢文庫: 縞の□ x521-569 y507-527。元図の分岐 438(524,532)→418(528,528) からはしごを上へ、11線(間隔2.8)、行き止まりは x=588。
#            右の短い分岐 439(566,532)→419(562,528) は使わないので消す(残すと車庫のいちばん下の線と重なって見える)。
#  神奈川新町: 縞の□ x612-663 y323-340。駅の下の行き止まり 355(609,325)・358(611,334) をそのまま延ばし、358 から上下へはしご。6線、行き止まりは x=664。
#  平日の最大の在庫: 文庫34本・新町15本(すべて8両以下)。1本ぶんの間隔は ttcore.js yard() の YPITCH=14(8両=12+2)。
#  使い方: build フォルダで python tools/patch_yard2.py → build2.py で data.json を作り直す(build2 の hatchKill も足す)
import json, io, shutil, os
p = 'cfg.json'
if not os.path.exists('_tmp/cfg.before_yard2.json'): shutil.copy(p, '_tmp/cfg.before_yard2.json')
c = json.load(io.open('_tmp/cfg.before_yard2.json', encoding='utf-8'))
inside = (lambda s, b: all(b[0] <= s[i] <= b[2] and b[1] <= s[i + 1] <= b[3] for i in (0, 2)))
OLD_KB, OLD_NK = [539, 450, 701, 533], [608, 323, 693, 405]
old = [s for s in c['add2'] if inside(s, OLD_KB) or inside(s, OLD_NK)]
print('前の検車区の線を外す', len(old))
c['add2'] = [s for s in c['add2'] if s not in old]
c['nodir'] = [b for b in c['nodir'] if b not in ([545, 450, 705, 516], [610, 333, 700, 405])]
segs = []
# 金沢文庫
JX, JY, NT, Y0, DY, SL, XE = 528, 528, 11, 526.0, 2.8, 0.5, 598
prev = (JX, JY)
for i in range(NT):
    y = round(Y0 - DY * i, 2); x = round(JX + (JY - y) * SL, 2)
    segs += [[prev[0], prev[1], x, y], [x, y, XE, y]]; prev = (x, y)
# 神奈川新町
#  ユーザー「無理に四角の中に収めなくてもいい」: ホームの上下17(y≦334)の帯に横線を置くと build2 が駅の端で区切り「駅を通る線」にするので、
#  帯の外(y≧338)へ。358(611,334) から右下へ45度のはしご(参考図でも検車区は駅の横浜方の下)、6線(間隔3)、行き止まりは x=676。
#  入口 J(616,334) へは 358(y=334 の留置線)と 355(y=325 の留置線)の両方から入れる(前の版の patch_nkyard2 と同じつながり)。
XN, NN, JX = 688, 8, 616
segs += [[611, 334, JX, 334], [609, 325, JX, 334]]
prev = (JX, 334)
for k in range(1, NN + 1):
    y = 334 + 3 * k + 1; x = JX + 3 * k + 1
    segs += [[prev[0], prev[1], x, y], [x, y, XN, y]]; prev = (x, y)
c['add2'] += segs
for b in ([528, 496, 600, 527], [617, 336, 692, 362]):   # 車庫の線は向きの推定(横線の束)から外す
    if b not in c['nodir']: c['nodir'].append(b)
k = [561, 527, 567, 533]   # 419 の短い分岐
if k not in c['kill']: c['kill'].append(k)
c['hatchKill'] = [[520, 506, 570, 528], [611, 322, 664, 341]]   # 線を引いた縞の□は消す
io.open(p, 'w', encoding='utf-8').write(json.dumps(c, ensure_ascii=False, separators=(', ', ': ')))
print('add2 +', len(segs))

# build2.py: hatchKill
p = 'tools/build2.py'
s = io.open(p, encoding='utf-8', newline='').read()
a = "for x0,y0,x1,y1 in cfg.get('platKill',[]):"
b = "for x0,y0,x1,y1 in cfg.get('hatchKill',[]):\n    hatch=[p for p in hatch if not (x0<=p[0] and p[2]<=x1 and y0<=p[1] and p[3]<=y1)]\n" + a
if 'hatchKill' not in s:
    assert s.count(a) == 1; s = s.replace(a, b, 1); io.open(p, 'w', encoding='utf-8', newline='').write(s); print('build2 ok')

# core.js: 金沢文庫の車庫の線の行き止まりの範囲
p = 'src/core.js'
s = io.open(p, encoding='utf-8', newline='').read()
a = "'金沢文庫': { box: [545, 450, 705, 516], plat: true }"
b = "'金沢文庫': { box: [590, 494, 606, 530], plat: true }"
if a in s: s = s.replace(a, b); io.open(p, 'w', encoding='utf-8', newline='').write(s); print('core ok')

# ttcore.js: 車庫の線に並べる間隔を 14(8両=12+2)に。今までは文庫21・ほかは 1〜2本(列車の長さで)
p = 'src/ttcore.js'
s = io.open(p, encoding='utf-8', newline='').read()
a = "      const slotTrim = (tr, slot, L) => Y.plat ? 2 + slot * 21 : slot ? 2 + L + 3 : 2;\n      const cap = (tr, L) => Y.plat ? Math.max(1, Math.min(6, Math.floor((tr.len - 23) / 21) + 1)) : tr.len >= 2 * L + 10 ? 2 : 1;"
b = "      const YPITCH = 14;   // 車庫の線に縦に並べる間隔(8両=12+2)。9両以上は奥に1本だけ\n      const slotTrim = (tr, slot, L) => 2 + slot * YPITCH;\n      const cap = (tr, L) => L > YPITCH - 2 ? (tr.len >= L + 4 ? 1 : 0) : Math.max(1, Math.min(6, Math.floor((tr.len - 2 - (YPITCH - 2)) / YPITCH) + 1));"
NL = '\r\n' if '\r\n' in s else '\n'; a = a.replace('\n', NL); b = b.replace('\n', NL)   # ttcore.js は CRLF
if a in s:
    s = s.replace(a, b); io.open(p, 'w', encoding='utf-8', newline='').write(s); print('ttcore ok')
else:
    print('ttcore: 既に当てたか、見つからない')
