# 都営浅草線の配線を cfg.json に追加する(haisenryakuzu.net の図を参考に手で起こしたもの。北=左になるよう180度回して配置)
import json, sys, shutil
PAIR = sys.argv[1] if len(sys.argv) > 1 else 'a'
shutil.copy('cfg.json', 'cfg.pre_asakusa.json') if not __import__('os').path.exists('cfg.pre_asakusa.json') else None
c = json.load(open('cfg.pre_asakusa.json', encoding='utf-8'))
U, L = 905, 916          # 押上〜三田の段: 上の線(右向き=泉岳寺方面) / 下の線(左向き=押上方面)
add, plat, nodir = [], [], []
# --- 本線
add += [[6, U, 692, U], [6, L, 692, L]]
# --- 押上(2面4線、前後に両渡り)
add += [[30, U, 41, U - 11], [41, U - 11, 69, U - 11], [69, U - 11, 80, U], [30, L, 41, L + 11], [41, L + 11, 69, L + 11], [69, L + 11, 80, L]]
add += [[14, U, 25, L], [14, L, 25, U], [84, U, 95, L], [84, L, 95, U]]
plat += [[43, U - 8, 67, U - 3], [43, L + 3, 67, L + 8]]
side = lambda cx: [[cx - 12, U - 8, cx + 12, U - 3], [cx - 12, L + 3, cx + 12, L + 8]]
island = lambda cx, u=U, l=L: [[cx - 12, u + 3, cx + 12, l - 3]]
R1 = [('押上', 55, None), ('本所吾妻橋', 105, side), ('浅草', 155, side), ('蔵前', 205, side), ('浅草橋', 265, island), ('東日本橋', 320, side), ('人形町', 370, island),
      ('日本橋', 420, side), ('宝町', 470, side), ('東銀座', 520, side), ('新橋', 570, side), ('大門', 620, side), ('三田', 665, island)]
for nm, cx, f in R1:
    if f: plat += f(cx)
# --- 浅草橋の蔵前寄り: 中線(折り返し用)
M = (U + L) / 2
add += [[222, M, 244, M], [244, M, 249.5, U], [244, M, 249.5, L]]
# --- 新橋〜大門の渡り線
add += [[590, U, 601, L]]
# --- 西馬込方面の段
U2, L2 = 960, 971
add += [[12, U2, 430, U2], [12, L2, 430, L2]]
R2 = [('高輪台', 60), ('五反田', 120), ('戸越', 180), ('中延', 240), ('馬込', 300)]
for nm, cx in R2: plat += island(cx, U2, L2)
plat += [[358, U2 - 8, 382, U2 - 3], [358, L2 + 3, 382, L2 + 8]]      # 西馬込(相対式)
add += [[330, U2, 341, L2], [330, L2, 341, U2]]                        # 馬込寄りの両渡り
add += [[400, L2, 412, L2 + 12], [412, L2 + 12, 470, L2 + 12], [424, L2 + 12, 435, L2 + 23], [435, L2 + 23, 470, L2 + 23], [447, L2 + 23, 458, L2 + 34], [458, L2 + 34, 470, L2 + 34]]   # 馬込車両検修場への線
nodir += [[341.5, 950, 480, 1012], [215, M - 1, 250, M + 1]]
c['add2'] = c.get('add2', []) + add
c['platAdd'] = c.get('platAdd', []) + plat
c['nodir'] = c.get('nodir', []) + nodir
c['rows'] = c['rows'] + [[862, 940], [940, 1020]]
c['H'] = 1020
c['names'] = c['names'] + [n for n, _, _ in R1] + [n for n, _ in R2] + ['西馬込']
# --- 泉岳寺とのつなぎ: 押上方面の出口だった線 → 三田へ、西馬込方面の出口だった線 → 高輪台へ
c['exits'] = [[6, U, '京成線(青砥方面)'], [6, L, '京成線(青砥方面)']]
c['portals'] = c['portals'] + [[12, 47, 692, U], [12, 59, 692, L]] + ([[133, 70, 12, U2], [125, 80, 12, L2]] if PAIR == 'a' else [[133, 70, 12, L2], [125, 80, 12, U2]])
c['text'] = [[20, 876, '都営浅草線 (押上〜三田)'], [20, 938, '都営浅草線 (高輪台〜西馬込)'], [440, 976, '馬込車両検修場']]
json.dump(c, open('cfg.json', 'w', encoding='utf-8'), ensure_ascii=False)
print('ok', len(add), len(plat))
