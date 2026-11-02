# 時刻表に無かった浅草橋発着の2本を足す(平日・土休日とも)。何度実行してもよい
#   浅草橋 5:00発 → 青砥(平日 5:15着 / 土休日 5:16着)   京成高砂 0:11発 押上止まり → 浅草橋 0:29着 まで延ばす
# 途中駅の時刻は、同じ区間を各駅に止まるほかの列車の駅間の分を、所要時間に合わせて当てはめたもの(推定)
import io, json
TT = json.load(io.open('tt.json', encoding='utf-8'))
S = TT['st']; ix = S.index
NORTH = ['浅草橋', '蔵前', '浅草', '本所吾妻橋', '押上', '京成曳舟', '八広', '四ツ木', '京成立石', '青砥']
SOUTH = ['押上', '本所吾妻橋', '浅草', '蔵前', '浅草橋']
def stops(tr): a = tr[3]; return [(a[i], a[i + 1], a[i + 2]) for i in range(0, len(a), 3)]
def ref(day, names, late):
    want = [ix(n) for n in names]; best = None
    for tr in TT[day]:
        st = stops(tr); ids = [s[0] for s in st]
        if want[0] not in ids: continue
        k = ids.index(want[0])
        if ids[k:k + len(want)] != want: continue
        seg = st[k:k + len(want)]
        if best is None or (seg[0][1] > best[0][0][1]) == late: best = (seg, tr)
    return best
for day, arr in (('wd', 5 * 60 + 15), ('hd', 5 * 60 + 16)):
    # 1. 浅草橋 5:00発 青砥行き
    if not any(tr[3][0] == ix('浅草橋') and tr[3][1] + tr[3][2] == 300 for tr in TT[day]):
        seg, r = ref(day, NORTH, False); t0 = seg[0][1] + seg[0][2]; tot = seg[-1][1] - t0; a = []
        for i, (s, ar, dw) in enumerate(seg):
            if i == 0: a += [s, 300, 0]
            elif i == len(seg) - 1: a += [s, arr, 0]
            else: a += [s, 300 + round((ar - t0) * (arr - 300) / tot), 0]
        tr = ['504T', r[1], '青砥', a] + [8] + list(r[5:]) if len(r) > 5 else ['504T', r[1], '青砥', a, 8]
        if len(tr) > 8: tr[8] = 0
        TT[day].append(tr); print(day, '足した 504T', [(S[a[i]], a[i + 1]) for i in range(0, len(a), 3)], '参考', r[0])
    # 2. 京成高砂 0:11発 → 浅草橋 0:29着
    for tr in TT[day]:
        a = tr[3]
        if a[0] == ix('京成高砂') and a[1] + a[2] == 1451 and a[-3] == ix('押上'):
            seg, r = ref(day, SOUTH, True); t0 = seg[0][1] + seg[0][2]; tot = seg[-1][1] - t0; end = 1469
            a[-1] = 1 if end - a[-2] - tot >= 1 else 0; d0 = a[-2] + a[-1]
            for i, (s, ar, dw) in enumerate(seg[1:]):
                a += [s, end if i == len(seg) - 2 else d0 + round((ar - t0) * (end - d0) / tot), 0]
            if tr[2]: tr[2] = '浅草橋'
            print(day, '延ばした', tr[0], [(S[a[i]], a[i + 1]) for i in range(0, len(a), 3)][-6:], '参考', r[0])
json.dump(TT, io.open('tt.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
