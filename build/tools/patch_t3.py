# 土休日の時刻表で、羽田空港第3ターミナルで切れている列車に、終点の第1・第2ターミナルを足す(運用表の到着時刻に合わせる)。何度実行してもよい
import io, json
TT = json.load(io.open('tt.json', encoding='utf-8'))
i3 = TT['st'].index('羽田空港第3ターミナル'); i1 = TT['st'].index('羽田空港第1・第2ターミナル')
ARR = {'1416T': 886, '1400D': 866}   # 運用表で分かっている到着時刻(14:46)。ほかは第3ターミナルの3分後
n = 0
for day in ('wd', 'hd'):
    for tr in TT[day]:
        a = tr[3]
        if a[-3] == i3:
            a += [i1, ARR.get(tr[0], a[-2] + 3), 0]; n += 1; print(day, tr[0], a[-2])
        elif a[-3] == i1 and tr[0] in ARR and day == 'hd' and len(a) > 5 and a[-6] == i3: a[-2] = ARR[tr[0]]
json.dump(TT, io.open('tt.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(n, '本を直した')
