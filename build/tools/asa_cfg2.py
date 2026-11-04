# 都営浅草線の配線を haisenryakuzu.net の配線図SVG(asa/web/parsed.json、tools/asa_svg.py で作る)から取り込み直す。
# 元の図は 西馬込=左・押上=右。この図では京急に合わせて 北(押上)=左 なので、180度回して置く(左側通行の上下線の並びがそのまま保てる)。
# 上段(y 862-940) = 押上〜三田、下段(y 940-1020) = 高輪台〜西馬込・馬込車両検修場。泉岳寺は京急の図のものを使う。
# 使い方(build フォルダで): python -I tools/asa_svg.py . → python -I tools/asa_cfg2.py   (cfg.json を書き換える。元は cfg.before_asa2.json)
import json, os, shutil, io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
if not os.path.exists('cfg.before_asa2.json'): shutil.copy('cfg.json', 'cfg.before_asa2.json')
c = json.load(open('cfg.before_asa2.json', encoding='utf-8'))
P = json.load(open('asa/web/parsed.json', encoding='utf-8'))
inA = lambda y: 862 <= y < 1020
c['add2'] = [s for s in c['add2'] if not (inA(s[1]) or inA(s[3]))]
c['platAdd'] = [p for p in c['platAdd'] if not inA(p[1])]
c['nodir'] = [p for p in c['nodir'] if not (inA(p[1]) or inA(p[3]))]
c['text'] = [t for t in c['text'] if not inA(t[1])]
# 京急側: いま公開している data.json と同じ向きにそろえる(cfg から作り直すと向きが変わる4本)
FIXD = [[648, 200, 657, 202, -1], [648, 211, 657, 213, -1], [648, 188, 657, 190, 1], [648, 171, 657, 173, 1]]
c['dir'] = [d for d in c.get('dir', []) if d not in FIXD] + FIXD

SX = 0.538
U, L = 905, 916            # 上段の本線: 上=泉岳寺方面(右向き) / 下=押上方面
U2, L2 = 1000, 1011        # 下段の本線: 上=西馬込方面(右向き) / 下=泉岳寺方面
# 図ごとの写し方: x' = ox + (xr - x) * SX、y は本線の高さを合わせて上下を返す
def mk(ox, xr, ya, yb, Ua, Lb, sy_out=None, ylim=None):
    # 元の図の ya(上の本線) → Lb(下の線)、yb(下の本線) → Ua(上の線)
    sy = (Lb - Ua) / (yb - ya)
    def f(x, y):
        if ylim is not None and abs(y - ylim) <= 0.2: y = ylim   # 本線(わずかに斜めに描かれている)を境目の高さにそろえる
        if sy_out is not None and y > ylim: yy = Ua - (ylim - yb) * sy - (y - ylim) * sy_out   # 車庫の部分は縦を詰める
        else: yy = Lb - (y - ya) * sy
        return [round(ox + (xr - x) * SX, 2), round(yy, 2)]
    return f
S3 = mk(6, 735.1, 55.2, 73.6, U, L)                         # 押上〜人形町
S2 = mk(6 + 735.1 * SX, 723.7, 18.2, 36.5, U, L)            # 日本橋〜三田
S1 = mk(12, 723.2, 18.6, 37.4, U2, L2, sy_out=0.46, ylim=37.4)   # 高輪台〜西馬込・車庫
SHEETS = [('pr_asakusa_020_03', S3, None, None), ('pr_asakusa_020_02', S2, 184, None), ('pr_asakusa_020_01', S1, None, None)]
DROP = [[369.0, 36.5, 378.8, 54.7],      # 汐留(大江戸線)への連絡線
        [187.0, 37.2, 179.5, 42.1],      # 西馬込: 車庫への線の分岐(横切る点で本線とつながるので重複)
        [477.2, 36.5, 482.2, 45.6], [482.2, 45.6, 546.1, 45.6], [551.0, 36.5, 546.1, 45.6]]   # 東銀座の線のくぼみ(描き方だけ) → まっすぐに
FILL = {'pr_asakusa_020_02': [[477.2, 36.5, 551.0, 36.5]]}
near = lambda a, b: all(abs(p - q) < 0.15 for p, q in zip(a, b))
add, plat = [], []
for nm, f, xa, xb in SHEETS:
    r = P[nm]
    tr = [t[:] for t in r['tracks']] + [t[:] for t in FILL.get(nm, [])]
    for t in tr:   # ほぼ水平な線は水平に
        if 0 < abs(t[1] - t[3]) <= 0.8 and abs(t[0] - t[2]) > 3: t[1] = t[3] = round((t[1] + t[3]) / 2, 1)
    segs = []
    for t in tr:
        if any(near(t, d) for d in DROP): continue
        x1, y1, x2, y2 = t
        if xa is not None and max(x1, x2) < xa: continue
        if xa is not None and min(x1, x2) < xa:
            if y1 != y2: continue
            x1, x2 = max(x1, xa), max(x2, xa)
        # 車庫の縦詰めの境目をまたぐ斜めの線は境目で分ける
        if nm.endswith('01') and min(y1, y2) < 37.4 < max(y1, y2):
            xm = x1 + (x2 - x1) * (37.4 - y1) / (y2 - y1); segs += [[x1, y1, xm, 37.4], [xm, 37.4, x2, y2]]
        else: segs.append([x1, y1, x2, y2])
    for x1, y1, x2, y2 in segs:
        a, b = f(x1, y1), f(x2, y2)
        if abs(a[0] - b[0]) + abs(a[1] - b[1]) > 0.3: add.append(a + b)
    hz = [f(t[0], t[1]) + f(t[2], t[3]) for t in segs if t[1] == t[3]]
    def trackY(cx, ym, lim=9):   # 写した先で、cx を通る水平な線のうち ym にいちばん近いもの
        c2 = [h[1] for h in hz if min(h[0], h[2]) <= cx <= max(h[0], h[2])]
        c2 = sorted(c2, key=lambda y: abs(y - ym)); return c2[0] if c2 and abs(c2[0] - ym) <= lim else None
    # 島式ホーム(灰色の四角): 上下の線路の間
    seen = set()
    for x, y, w, h in r['rects']:
        if not (40 < w < 75 and 5 < h < 13) or (x, y) in seen: continue
        seen.add((x, y))
        if xa is not None and x < xa: continue
        p, q = f(x + w, y + h), f(x, y)
        cx = (p[0] + q[0]) / 2
        up = [h2[1] for h2 in hz if min(h2[0], h2[2]) <= cx <= max(h2[0], h2[2]) and h2[1] < p[1]]
        dn = [h2[1] for h2 in hz if min(h2[0], h2[2]) <= cx <= max(h2[0], h2[2]) and h2[1] > q[1]]
        if not up or not dn: print('island?', nm, x, y); continue
        plat.append([round(p[0], 1), max(up) + 3, round(q[0], 1), min(dn) - 3])
    # 相対式ホーム(細い2重線): 面している線路の脇
    for pth in r['dpaths']:
        s = pth[0]
        if s[1] != s[3] or not (40 < abs(s[2] - s[0]) < 75): continue
        x0, x1 = sorted((s[0], s[2]))
        if xa is not None and x0 < xa: continue
        p, q = f(x1, s[1]), f(x0, s[1]); cx = (p[0] + q[0]) / 2
        ty = trackY(cx, p[1], 15)
        if ty is None: print('side?', nm, s); continue
        sg = 1 if p[1] > ty else -1
        y0, y1 = sorted((ty + 3 * sg, ty + 8 * sg))
        plat.append([round(p[0], 1), y0, round(q[0], 1), y1])
c['add2'] += add
c['platAdd'] += plat
xs = lambda f, x: f(x, 0)[0]
c['nodir'] += [[xs(S1, 262), 940, 400, 1020],                         # 西馬込(終着)と車庫: 両方向
               [xs(S3, 332), (U + L) / 2 - 1, xs(S3, 272), (U + L) / 2 + 1],   # 浅草橋の中線
               [4, U - 13, xs(S3, 612), L + 13]]                        # 押上(京成からの列車が折り返す): 両方向
c['text'] += [[20, 876, '都営浅草線 (押上〜三田)'], [20, 950, '都営浅草線 (高輪台〜西馬込)'], [400, 975, '馬込車両検修場']]
# 泉岳寺・京成押上線とのつなぎ(本線の端の高さは前と同じ。下段だけ高さが変わった)
po = [p for p in c['portals'] if not (inA(p[1]) and p[0] < 20 and 940 <= p[1]) and not (inA(p[3]) and 940 <= p[3])]
po += [[133, 70, 12, U2], [125, 80, 12, L2]]
c['portals'] = po
json.dump(c, open('cfg.json', 'w', encoding='utf-8'), ensure_ascii=False)
print('ok add', len(add), 'plat', len(plat), 'portals', len(po))
for p in sorted(plat, key=lambda p: (p[1] > 940, p[0])): print('  plat', p)
