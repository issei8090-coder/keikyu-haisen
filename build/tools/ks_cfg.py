# 京成本線・押上線・北総線・成田スカイアクセス線・東成田線・芝山鉄道線の配線を cfg.json に追加する
# 元データ: haisenryakuzu.net の配線図SVG(ks/svg/parsed.json)。図ごとに縮小して並べ、図どうしは「つなぎ」(※)で結ぶ
import json, sys, io, os, math, shutil
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
if not os.path.exists('cfg.pre_keisei.json'): shutil.copy('cfg.json', 'cfg.pre_keisei.json')
c = json.load(open('cfg.pre_keisei.json', encoding='utf-8'))
P = json.load(open('ks/svg/parsed.json', encoding='utf-8'))
SX, SY = 0.42, 0.6
K = 'pr_keisei_main_020_0'
# 図 → (左上の置き場所 x, y, 使う範囲 xa, xb)
Y0 = 1040
LAY = {
    'M1': (K + '1', 20, Y0, None, None), 'M2': (K + '2', 350, Y0, None, None),
    'OS': ('pr_keisei_oshiage_020_01', 20, Y0 + 200, 130, 520), 'H1': ('pr_hokuso_020_01', 200, Y0 + 110, 470, None), 'H2': ('pr_hokuso_020_02', 322, Y0 + 200, None, None),
    'H3': ('pr_hokuso_020_03', 20, Y0 + 310, None, None), 'H4': ('pr_hokuso_020_04', 262, Y0 + 310, None, None), 'N5': ('pr_keisei_naritakuko_020_05', 572, Y0 + 310, None, 290),
    'M3': (K + '3', 20, Y0 + 430, None, None), 'M4': (K + '4', 350, Y0 + 430, None, None),
    'M5': (K + '5', 20, Y0 + 535, None, None), 'M6': (K + '6', 350, Y0 + 535, None, None),
    'M7': (K + '7', 20, Y0 + 675, None, None), 'M8': (K + '8', 350, Y0 + 675, None, None),
    'SB': ('pr_shibayama_010_01', 470, Y0 + 790, 107, None),
}
HEAD = [(20, Y0 - 8, '京成本線 (京成上野〜京成高砂)'), (20, Y0 + 192, '京成押上線'), (205, Y0 + 192, '北総線 (新柴又〜新鎌ヶ谷)'), (20, Y0 + 302, '北総線 (西白井〜印旛日本医大)・成田スカイアクセス線'),
        (20, Y0 + 422, '京成本線 (京成小岩〜谷津)'), (20, Y0 + 527, '京成本線 (京成津田沼〜京成佐倉)'), (20, Y0 + 667, '京成本線 (大佐倉〜成田空港)'), (470, Y0 + 795, '東成田線・芝山鉄道線')]
def tf(k, x, y):
    nm, ox, oy, xa, xb = LAY[k]; return (round(ox + (x - (xa or 0)) * SX, 2), round(oy + y * SY, 2))
def clip(s, xa, xb):
    x1, y1, x2, y2 = s
    if x1 > x2: x1, y1, x2, y2 = x2, y2, x1, y1
    lo = xa if xa is not None else -1e9; hi = xb if xb is not None else 1e9
    if x2 < lo or x1 > hi: return None
    if x1 == x2: return [x1, y1, x2, y2]
    f = lambda x: y1 + (y2 - y1) * (x - x1) / (x2 - x1)
    a, b = max(x1, lo), min(x2, hi)
    if b - a < 1e-6: return None
    return [a, f(a), b, f(b)]
add, plat, nameAt, nodir = [], [], [], []
ALIAS = {'空港第2ビル': '空港第2ビル', '新鎌ヶ谷': '新鎌ヶ谷'}
SKIP = {'OS': {'押上', '青砥'}, 'SB': set(), 'N5': {'空港第2ビル', '成田空港'}, 'M2': set(), 'H1': {'京成高砂'}}
for k, (nm, ox, oy, xa, xb) in LAY.items():
    r = P[nm]; n0 = len(add)
    # ほぼ水平な線は水平にそろえる(ホームの判定と向きの判定は水平な線が前提)
    for t in r['tracks'] + r['dashes']:
        if 0 < abs(t[1] - t[3]) <= 0.8 and abs(t[0] - t[2]) > 3: t[1] = t[3] = round((t[1] + t[3]) / 2, 1)
    # 水平な線にわずかにずれて接している端点は、その線の高さにそろえる(つなぎ目で線が斜めにならないように)
    hz = [t for t in r['tracks'] + r['dashes'] if t[1] == t[3]]
    for t in r['tracks'] + r['dashes']:
        for i in (0, 2):
            for h in hz:
                if h is not t and min(h[0], h[2]) - 0.8 <= t[i] <= max(h[0], h[2]) + 0.8 and 0 < abs(t[i + 1] - h[1]) <= 0.8:
                    if t[1] == t[3]: t[1] = t[3] = h[1]
                    else: t[i + 1] = h[1]
                    break
    for s in r['tracks'] + r['dashes']:
        q = clip(s, xa, xb)
        if not q: continue
        a = tf(k, q[0], q[1]); b = tf(k, q[2], q[3])
        if math.hypot(a[0] - b[0], a[1] - b[1]) > 0.3: add.append([a[0], a[1], b[0], b[1]])
    # ホーム: 島式=灰色の四角、相対式=細い線の束
    pl = [[q[0], q[1], q[0] + q[2], q[1] + q[3]] for q in r['rects'] if 40 < q[2] < 75 and 5 < q[3] < 13]
    bars = [[q[0], q[1], q[0] + q[2], q[1] + q[3]] for q in r['rects'] if 40 < q[2] < 75 and q[3] < 1.6]
    for p in r['dpaths']:
        for s in p:
            if s[1] == s[3] and 40 < abs(s[2] - s[0]) < 75: bars.append([min(s[0], s[2]), s[1], max(s[0], s[2]), s[1]])
    groups = []
    for b in sorted(bars, key=lambda b: (round(b[0]), b[1])):
        for g in groups:
            if abs(g[0] - b[0]) < 3 and abs(g[2] - b[2]) < 3 and b[1] - g[3] < 4: g[3] = max(g[3], b[3]); g[1] = min(g[1], b[1]); break
        else: groups.append(b[:])
    side = []; cand = []
    for g in groups:   # 相対式ホームは、面している線路のすぐ脇に置き直す
        ym = (g[1] + g[3]) / 2; cxg = (g[0] + g[2]) / 2
        ys = sorted(set(t[1] for t in r['tracks'] if t[1] == t[3] and min(t[0], t[2]) <= cxg <= max(t[0], t[2]) and abs(t[1] - ym) <= 19), key=lambda v: abs(abs(v - ym) - 13.5))   # ホームの線は、面する線路から約13.5離して描かれている
        if k == 'M8' and cxg > 450: ys.sort(key=lambda v: -v)   # 成田空港の1番線(アクセス特急)は、いちばん下の行き止まりの線路に面している
        if ys: cand.append((abs(abs(ys[0] - ym) - 13.5), g, ym, ys))
    claimed = []   # 1本の線路を2つの相対式ホームが取り合ったら、合い方の悪いほうを次の候補へ回す
    for fit, g, ym, ys in sorted(cand, key=lambda c: (len(c[3]), c[0])):   # 候補が1つしかないホームを先に決める
        for ty in ys:
            if any(t == ty and min(g[2], q[2]) - max(g[0], q[0]) > 10 for t, q in claimed): continue
            claimed.append((ty, g)); side.append([g[0], ty, g[2], 1 if ym > ty else -1]); break
    labs = [(t[0] + 8 * len(t[2]), t[1], t[2]) for t in r['texts'] if len(t[2]) <= 10 and '方' not in t[2] and '線' not in t[2] and '（信）' not in t[2] and '凡例' not in t[2] and '基地' not in t[2] and '検車区' not in t[2] and '工事' not in t[2]]
    for p in pl:
        cx = (p[0] + p[2]) / 2
        if (xa is not None and cx < xa) or (xb is not None and cx > xb): continue
        # 近くに線路(水平)があるホームだけ
        if not any(s[1] == s[3] and min(s[0], s[2]) <= cx <= max(s[0], s[2]) and (0 < p[1] - s[1] <= 11 or 0 < s[1] - p[3] <= 11) for s in r['tracks']): continue
        lab = min(labs, key=lambda l: abs(l[0] - cx)) if labs else None
        if not lab or abs(lab[0] - cx) > 75 or lab[2] in SKIP.get(k, ()): continue
        a = tf(k, p[0], p[1]); b = tf(k, p[2], p[3])
        plat.append([a[0], a[1], b[0], b[1]]); nameAt.append([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, ALIAS.get(lab[2], lab[2])])
    for x0, ty, x1, sgn in side:
        cx = (x0 + x1) / 2
        if (xa is not None and cx < xa) or (xb is not None and cx > xb): continue
        lab = min(labs, key=lambda l: abs(l[0] - cx)) if labs else None
        if not lab or abs(lab[0] - cx) > 75 or lab[2] in SKIP.get(k, ()): continue
        a = tf(k, x0, ty); b = tf(k, x1, ty)
        q = [a[0], a[1] + 3, b[0], a[1] + 8] if sgn > 0 else [a[0], a[1] - 8, b[0], a[1] - 3]
        plat.append(q); nameAt.append([(q[0] + q[2]) / 2, (q[1] + q[3]) / 2, ALIAS.get(lab[2], lab[2])])
    print(k, nm, 'segs', len(add) - n0, 'stations', sorted(set(n[2] for n in nameAt[-60:] if True))[:0])
# 車庫など、向きを決めない範囲(図の座標で指定)
for k, x0, y0, x1, y1 in [('M2', 440, 20, 640, 240), ('M5', 80, 110, 340, 145), ('M5', 80, 20, 270, 70), ('M7', 165, 38, 440, 215), ('H4', 190, 60, 440, 120), ('M4', 90, 10, 170, 30), ('M8', 440, 5, 600, 62)]:
    a = tf(k, x0, y0); b = tf(k, x1, y1); nodir.append([a[0], a[1], b[0], b[1]])
# 図どうしのつなぎ
LINK = [('M1', 723, 36, 'M2', 0, 58), ('M1', 723, 55, 'M2', 0, 76), ('OS', 520, 54, 'M2', 148, 114), ('OS', 520, 73, 'M2', 148, 133),
        ('M2', 723, 254, 'M3', 0, 27), ('M2', 723, 273, 'M3', 0, 46), ('M2', 615, 198, 'H1', 470, 179), ('M2', 615, 208, 'H1', 470, 198), ('H1', 723, 179, 'H2', 0, 28), ('H1', 723, 198, 'H2', 0, 46),
        ('M3', 723, 27, 'M4', 0, 37), ('M3', 723, 45, 'M4', 0, 55), ('M4', 723, 36, 'M5', 0, 55), ('M4', 723, 55, 'M5', 0, 73),
        ('M5', 723, 91, 'M6', 0, 27), ('M5', 723, 109, 'M6', 0, 46), ('M6', 723, 27, 'M7', 0, 19), ('M6', 723, 46, 'M7', 0, 37),
        ('M7', 704, 28, 'M8', 0, 91), ('M7', 704, 37, 'M8', 0, 109), ('M8', 271, 91, 'SB', 107, 28), ('M8', 271, 109, 'SB', 107, 46),
        ('H2', 723, 28, 'H3', 0, 27), ('H2', 723, 46, 'H3', 0, 46), ('H3', 526, 27, 'H4', 0, 37), ('H3', 526, 46, 'H4', 0, 56),
        ('H4', 625, 28, 'N5', 0, 27), ('H4', 625, 56, 'N5', 0, 46), ('N5', 290, 27, 'M8', 246, 18)]
# つなぎ目の端は短い枝として消されないよう、外側へ少し延ばす
def ext(k, x, y):
    px, py = tf(k, x, y); best = None
    for sg in add:
        for (ax, ay, bx, by) in ((sg[0], sg[1], sg[2], sg[3]), (sg[2], sg[3], sg[0], sg[1])):
            d = math.hypot(ax - px, ay - py)
            if d < 2.5 and (best is None or d < best[0]): best = (d, ax, ay, bx, by)
    if not best: print('link end not found', k, x, y); return (px, py)
    d, ax, ay, bx, by = best; L = math.hypot(ax - bx, ay - by); ux, uy = (ax - bx) / L, (ay - by) / L
    ex, ey = round(ax + ux * 7, 2), round(ay + uy * 7, 2)
    add.append([ax, ay, ex, ey]); return (ex, ey)
portals = [list(ext(a, x1, y1)) + list(ext(b, x2, y2)) for a, x1, y1, b, x2, y2 in LINK]
o1 = ext('OS', 130, 54); o2 = ext('OS', 130, 73)
portals += [[6, 916, o1[0], o1[1]], [6, 905, o2[0], o2[1]]]      # 浅草線の押上 ⇔ 京成押上線(京成曳舟方)
# 京成上野: 2番線と3番線の線路が近すぎて列車がくっついて見えるので、3・4番線側(線路とホーム)を下へずらす
UE_DY = 6.0
_ux = tf('M1', 0, 0)[0]
def _ue(x, y): return x < _ux + 32 and y > Y0 + 30.5 and y < Y0 + 50
_xa, _xb = round(_ux + 30.78, 2), round(_ux + 32.99, 2)   # ホームの端と、渡り線の始まり
for sg in list(add):
    x0, y0, x1, y1 = sg
    if y0 == y1 and _ue(min(x0, x1), y0) and max(x0, x1) > _xb + 0.5:   # 日暮里まで続く長い線: ホームの端で切って、ホーム側だけずらす
        lo, hi = min(x0, x1), max(x0, x1); add.remove(sg)
        add += [[lo, round(y0 + UE_DY, 2), _xa, round(y0 + UE_DY, 2)], [_xa, round(y0 + UE_DY, 2), _xb, y0], [_xb, y0, hi, y0]]
        continue
    for i in (0, 2):
        if _ue(sg[i], sg[i + 1]): sg[i + 1] = round(sg[i + 1] + UE_DY, 2)
for q in plat:
    if _ue((q[0] + q[2]) / 2, (q[1] + q[3]) / 2): q[1] = round(q[1] + UE_DY, 2); q[3] = round(q[3] + UE_DY, 2)
for n in nameAt:
    if _ue(n[0], n[1]): n[1] = round(n[1] + UE_DY, 2)
c['add2'] += add; c['platAdd'] += plat; c['nodir'] += nodir; c['nameAt'] = nameAt
c['rows'] = c['rows'] + [[1020, 2100]]; c['H'] = Y0 + 870
c['deadendNoDirY'] = 1020
c['portals'] = c['portals'] + portals
c['exits'] = [[tf('M5', 330, y)[0], tf('M5', 330, y)[1], '京成千葉線(千葉中央方面)'] for y in (119, 128, 137)]
c['text'] = c.get('text', []) + [[x, y, s] for x, y, s in HEAD]
json.dump(c, open('cfg.json', 'w', encoding='utf-8'), ensure_ascii=False)
print('segs', len(add), 'plats', len(plat), 'stations', len(set(n[2] for n in nameAt)), 'portals', len(portals))
print(' '.join(sorted(set(n[2] for n in nameAt))))
