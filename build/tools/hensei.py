# 京急の編成表(ユーザー提供の Excel「京急電鉄_3車両基地_編成表.xlsx」)を hensei.json に。
#  使い方: build フォルダで python tools/hensei.py [xlsx のパス]
#  出力: [{f: 編成名, kei: 形式, dep: 検車区(久里浜・新町・金沢), cars: 両数, nos: [号車順の車両番号], since: 編成期間(開始), chk: 要照合なら1}]
import sys, io, json, os
import openpyxl
src = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser('~/Downloads/京急電鉄_3車両基地_編成表.xlsx')
wb = openpyxl.load_workbook(src, data_only=True)
ws = wb['全編成一覧']
out = []
for r in ws.iter_rows(min_row=4, values_only=True):
    if not r or not r[0] or not r[2] or not str(r[0]).endswith('検車区'): continue
    dep = str(r[0]).replace('検車区', '')
    cars = int(r[4])
    nos = [str(v) for v in r[5:13] if v not in (None, '')]
    o = {'f': str(r[2]), 'kei': str(r[1]), 'dep': dep, 'cars': cars, 'nos': nos}
    if r[3]: o['since'] = str(r[3])
    if r[13] and '要照合' in str(r[13]): o['chk'] = 1
    out.append(o)
io.open('hensei.json', 'w', encoding='utf-8').write(json.dumps(out, ensure_ascii=False, separators=(',', ':')))
from collections import Counter
print(len(out), '編成', sum(o['cars'] for o in out), '両')
for k, v in sorted(Counter((o['dep'], o['cars']) for o in out).items()): print(k, v)
