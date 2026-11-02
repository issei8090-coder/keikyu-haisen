# 土休日 スカイライナー10号(9AE06)は、京成公式の時刻表どおり 成田空港 9:58発・空港第2ビル 10:02発。
# いったん 9:53 に変えたものを元に戻す。何度実行してもよい
import io, json
TT = json.load(io.open('tt.json', encoding='utf-8'))
for tr in TT['hd']:
    a = tr[3]
    if tr[0] == '9AE06' and TT['st'][a[0]] == '成田空港' and a[1] == 593 and a[4] == 596: a[1] = 598; a[4] = 602; print('reverted')
json.dump(TT, io.open('tt.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
