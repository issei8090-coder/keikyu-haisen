# 運転指令に都営浅草線の区間(押上〜三田、高輪台〜西馬込)を足す。泉岳寺は京急の区間(kq1)のまま。
# キロ程は都営の営業キロ(西馬込=0)の符号を反転して使う → 運転指令の図で 押上=左・西馬込=右 になり、上下線の並びが京急の図と同じになる(目盛りは kmNeg で正の数を出す)
import json, io, sys, csv
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
p = 'disp_cfg.json'; s = open(p, encoding='utf-8').read()
if '"id": "asa1"' in s: print('already'); sys.exit()
km = {r['station']: float(r['route_km']) for r in csv.DictReader(open('toei_asakusa_station_distances.csv', encoding='utf-8'))}
order = '押上 本所吾妻橋 浅草 蔵前 浅草橋 東日本橋 人形町 日本橋 宝町 東銀座 新橋 大門 三田 高輪台 五反田 戸越 中延 馬込 西馬込'.split()
sts = ', '.join('[%s, %.1f, 8]' % (json.dumps(n, ensure_ascii=False), -km[n]) for n in order)
sec = '''    {
      "id": "asa1",
      "name": "都営浅草線",
      "kmNeg": true,
      "note": "キロ程は都営の営業キロ(西馬込=0)の符号を反転(押上=-18.3)。ホームは8両。最高速度70km/h(都営浅草線)。",
      "rows": [
        { "rects": [[0, 718, 862, 940]], "dy": 0 },
        { "rects": [[0, 718, 940, 1020]], "dy": -95 }
      ],
      "stations": [%s],
      "vmax": [[-19, 1.5, 70, "都営浅草線 70km/h"], [0.08, 1.5, 25, "西馬込の先・馬込車両検修場"]],
      "tabs": [
        { "name": "押上〜人形町", "km": [-18.75, -13.45] },
        { "name": "人形町〜三田", "km": [-14.15, -7.6] },
        { "name": "三田・高輪台〜戸越", "km": [-8.4, -2.7] },
        { "name": "戸越〜西馬込・車庫", "km": [-3.6, 1.4] }
      ]
    }
''' % sts
i = s.rindex('  ],\r\n  "signals"') if '\r\n' in s else s.rindex('  ],\n  "signals"')
nl = '\r\n' if '\r\n' in s else '\n'
head = s[:i].rstrip()            # ...最後の区間の "}" まで
s = head + ',' + nl + sec.replace('\n', nl) + s[i:]
json.loads(s)
open(p, 'w', encoding='utf-8', newline='').write(s)
print('ok')
