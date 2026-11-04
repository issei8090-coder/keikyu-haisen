# 神奈川新町の検車区 その2(2026-11-04)
#  1) 車庫の入口(616,334)を子安方の引上線の線(y=325、351〜355)ともつなぐ: 355 (609,325) → (616,334)。
#     下りへ出る列車は 351 で折り返して上の島のホームへ、品川から着く列車もホームで折り返して 351 へ入れる(参考図でも車庫は y=325 側の線から分かれる)
#  2) ttcore.js yard() の入庫: ホームで向きを変えて引上線へ入るのを許す(tailRev。品川から着いて終わる列車)
import json, io
p = 'cfg.json'
c = json.load(io.open(p, encoding='utf-8'))
seg = [609, 325, 616, 334]
if seg not in c['add2']:
    c['add2'].append(seg)
    io.open(p, 'w', encoding='utf-8').write(json.dumps(c, ensure_ascii=False, separators=(', ', ': ')))
    print('cfg ok')

p = 'src/ttcore.js'
s = io.open(p, encoding='utf-8', newline='').read()
a = "{ tail: h, tailMax: 320, after: null, isFree: (i, e) => e === t.route.stopE[i] }"
b = "{ tail: h, tailMax: 320, tailRev: true, after: null, isFree: (i, e) => e === t.route.stopE[i] }"
if a in s:
    assert s.count(a) == 1
    s = s.replace(a, b); io.open(p, 'w', encoding='utf-8', newline='').write(s); print('ttcore ok')

# 3) 車庫の線・入口の横線を向きの推定(build2 の横線の束)から外す。入れないと束に入って駅の上り線が下り扱い(dir 1)になる
c = json.load(io.open('cfg.json', encoding='utf-8'))
nd = [610, 333, 700, 405]
if nd not in c['nodir']:
    c['nodir'].append(nd)
    io.open('cfg.json', 'w', encoding='utf-8').write(json.dumps(c, ensure_ascii=False, separators=(', ', ': ')))
    print('nodir ok')
