# 京成の時刻表サイトから集めた列車(ks/trains.json)を tt.json に足す
#  - 浅草線へ直通する列車: すでにある列車(京急PDF・都営データ由来)の押上の時刻と突き合わせ、京成側の停車駅をつなぐ
#  - 京成線内だけの列車: 新しい列車として追加。千葉線・千原線へ入る列車は京成津田沼から図の外へ出る
import json, sys, io, re, glob, unicodedata, collections, os, shutil
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
if not os.path.exists('tt.asa.json'): shutil.copy('tt.json', 'tt.asa.json')
tt = json.load(open('tt.asa.json', encoding='utf-8'))
TR = json.load(open('ks/trains.json', encoding='utf-8'))
D = json.load(open('data.json', encoding='utf-8'))
DIAG = set(s['name'] for s in D['stations'])
# 同じ列車が路線ごとに別のIDで載っているので、列車番号と平日/土休日でまとめる(停車駅の多いほうを残す)
_best = {}
for k, v in TR.items():
    tx, d = k.split('|'); kk = (re.sub(r'[a-z]+$', '', tx.split('-')[-1]), d, v['rows'][0][2] if v['rows'] else '')   # 末尾の a/b は途中で種別が変わる列車の区間(同じ列車)
    if kk not in _best or len(v['rows']) > len(TR[_best[kk]]['rows']) or (len(v['rows']) == len(TR[_best[kk]]['rows']) and k < _best[kk]): _best[kk] = k
print('crawled', len(TR), 'unique trains', len(_best))
TR = {k: TR[k] for k in _best.values()}
# 同じ列車が「京成線内の区間だけ」と「全区間」の2通り(列車番号も別)で載っていることがある: 他の列車の一部になっているものは捨てる
def _sig(v): return [(r[0], r[2] or r[1]) for r in v['rows']]
_idx = collections.defaultdict(list)
for k, v in TR.items():
    for i, x in enumerate(_sig(v)): _idx[(k.split('|')[1],) + x].append((k, i))
_drop = set()
for k, v in TR.items():
    sg = _sig(v); d = k.split('|')[1]
    if len(sg) < 2: continue
    for k2, i in _idx[(d,) + sg[0]]:
        if k2 == k or k2 in _drop: continue
        s2 = _sig(TR[k2])
        if len(s2) > len(sg) and s2[i:i + len(sg) - 1] == sg[:-1] and i + len(sg) <= len(s2) and s2[i + len(sg) - 1][0] == sg[-1][0]: _drop.add(k); break
        if len(s2) == len(sg) and s2 == sg and k2 < k: _drop.add(k); break
print('sub-runs dropped', len(_drop))
TR = {k: v for k, v in TR.items() if k not in _drop}
def nz(n):
    n = unicodedata.normalize('NFKC', n).replace('ケ', 'ヶ').strip()
    return {'空港第2ビル(成田第2・第3ターミナル)': '空港第2ビル', '成田空港(成田第1ターミナル)': '成田空港'}.get(n, n)
ASA = set('本所吾妻橋 浅草 蔵前 浅草橋 東日本橋 人形町 日本橋 宝町 東銀座 新橋 大門 三田 泉岳寺 高輪台 五反田 戸越 中延 馬込 西馬込'.split())
CHIBA = set('京成幕張本郷 京成幕張 検見川 京成稲毛 みどり台 西登戸 新千葉 京成千葉 千葉中央 千葉寺 大森台 学園前 おゆみ野 ちはら台'.split())
EXIT_C = '京成千葉線(千葉中央方面)'
KSET = set(s['name'] for s in D['stations'] if s['plats'][0][1] > 1020) | {'押上'}   # 京成・北総・芝山の駅(図の下側)と押上
# 種別・行先は駅の時刻表ページから
TYMAP = {'普通': 'local', '快速': 'kaisoku', '特急': 'tokkyu', '快速特急': 'kaitoku', '快特': 'kaitoku', 'アクセス特急': 'access', '通勤特急': 'tsukin', 'エアポート快特': 'apkaitoku', 'エアポート急行': 'kyuko', '急行': 'kyuko'}
info = {}; sttype = collections.defaultdict(dict)   # sttype[(列車番号, 平日/土休日)][駅名] = その駅での種別
_code = {x['code']: nz(x['name']) for x in json.load(open('ks/stcodes.json', encoding='utf-8'))}
for f in glob.glob('ks/st/*.html'):
    h = open(f, encoding='utf-8').read(); _stn = _code.get(os.path.basename(f).split('_')[0], '')
    for m in re.finditer(r"openOneTrainTimetable\('([^']+)','\d+','\d+','\d+','(\d)'\s*\)\"\s*class=\"ekltip[^\"]*\">(.*?)</li>", h, re.S):
        ty = re.search(r'ekltraintype[^>]*>([^<]*)<', m.group(3)); de = re.search(r'ekldest[^>]*>([^<]*)<', m.group(3))
        info.setdefault(m.group(1) + '|' + m.group(2), collections.Counter())[(ty.group(1).strip() if ty else '', de.group(1).strip() if de else '')] += 1
        if ty and _stn: sttype[(re.sub(r'[a-z]+$', '', m.group(1).split('-')[-1]), m.group(2))][_stn] = ty.group(1).strip().split(':')[0]
print('type info for', len(info), 'trains;', collections.Counter(t for c in info.values() for (t, d) in c).most_common(14))
TY = tt['ty'] + [k for k in ('kaisoku', 'access', 'tsukin', 'liner') if k not in tt['ty']]
ST = tt['st'] + sorted(n for n in DIAG if n not in tt['st'])
SI = {s: i for i, s in enumerate(ST)}
def tmin(x):
    if not x: return None
    h, m = x.split(':'); h = int(h); return (h + 24 if h < 3 else h) * 60 + int(m)
out = {'st': ST, 'ty': TY}
for day, dw in (('wd', '0'), ('hd', '1')):
    trains = [{'no': t[0], 'ty': t[1], 'dest': t[2], 'ev': [[tt['st'][t[3][i]], t[3][i + 1], t[3][i + 1] + t[3][i + 2]] for i in range(0, len(t[3]), 3)], 'cars': t[4], 'fl': t[5] if len(t) > 5 else 0, 'x0': '', 'x1': ''} for t in tt[day]]
    # 押上で京成へ出入りする既存の列車
    fromK = collections.defaultdict(list); toK = collections.defaultdict(list)
    for t in trains:
        if t['ev'][0][0] == '押上': fromK[t['ev'][0][2]].append(t)
        if t['ev'][-1][0] == '押上': toK[t['ev'][-1][1]].append(t)
    st = collections.Counter(); new = []
    for key, v in TR.items():
        tx, d = key.split('|')
        if d != dw: continue
        ev = []
        for nm, a, dp in v['rows']:
            a, dp = tmin(a), tmin(dp)
            if a is None and dp is None: continue
            if a is None: a = dp
            if dp is None: dp = a
            ev.append([nz(nm), a, max(a, dp)])
        if len(ev) < 2: st['時刻なし'] += 1; continue
        names = [e[0] for e in ev]
        ti = info.get(key); tyname, dname = ti.most_common(1)[0][0] if ti else ('', ''); tyname = tyname.split(':')[0]
        tykey = TYMAP.get(tyname) or ('liner' if 'ライナー' in tyname else 'local')
        no = re.sub(r'[a-z]+$', '', tx.split('-')[-1])
        if '押上' in names and any(n in ASA for n in names):
            i = names.index('押上'); south = any(n in ASA for n in names[i + 1:])   # 押上から浅草線へ入る向き
            kpart = ev[:i] if south else ev[i + 1:]
            kpart = [e for e in kpart if e[0] in DIAG]
            if not kpart: st['京成側の駅なし'] += 1; continue
            tm = ev[i][2] if south else ev[i][1]
            cand = [t for dt in (0, -1, 1) for t in (fromK if south else toK).get(tm + dt, []) if not t.get('ks')]
            if cand:
                t = cand[0]; t['ks'] = 1; t['kno'] = no
                if south: t['ev'] = kpart + [[ev[i][0], ev[i][1], t['ev'][0][2]]] + t['ev'][1:]; t['fl'] &= ~1
                else: t['ev'] = t['ev'][:-1] + [[ev[i][0], t['ev'][-1][1], ev[i][2]]] + kpart; t['fl'] &= ~2; t['dest'] = dname or kpart[-1][0]
                st['浅草線直通: 既存の列車につないだ'] += 1
            else:
                # 浅草線側に相手が見つからない: 京成線内〜押上の列車として追加
                e2 = (kpart + [ev[i]]) if south else ([ev[i]] + kpart)
                new.append({'no': no, 'ty': TY.index(tykey), 'dest': '押上' if south else (dname or e2[-1][0]), 'ev': e2, 'cars': 8, 'fl': 0, 'x0': '', 'x1': '', 'kno': no}); st['浅草線直通: 相手なし(押上までの列車として追加)'] += 1
            continue
        # 京成線内の列車
        keep = [e for e in ev if e[0] in DIAG]
        if len(keep) < 2: st['図の範囲外(千葉線内だけなど)'] += 1; continue
        fl = 0; x0 = x1 = ''
        # 千葉線・千原線へ入る列車は、京成津田沼で図から出入りする扱い(津田沼の千葉線への線路は下り側からつながらないため、出口の線路は使わない)
        if names[0] in CHIBA or names[-1] in CHIBA: st['千葉線直通(津田沼発着として扱う)'] += 1
        if any(n not in DIAG and n not in CHIBA for n in names): st['図に無い駅を含む: ' + ','.join(sorted(set(n for n in names if n not in DIAG and n not in CHIBA))[:3])] += 1
        new.append({'no': no, 'ty': TY.index(tykey), 'dest': dname or names[-1], 'ev': keep, 'cars': 6 if tykey == 'local' else 8, 'fl': fl, 'x0': x0, 'x1': x1, 'kno': no}); st['京成線内の列車として追加'] += 1
    # 京成へ出入りするはずなのに相手が見つからなかった既存の列車は、押上発着として扱う
    for t in trains:
        if t['fl']: st['既存の列車で京成側が見つからない(押上発着のまま)'] += 1; t['fl'] = 0
    for t in trains + new:
        bad = [1 for a, b in zip(t['ev'], t['ev'][1:]) if b[1] < a[2]]
        if bad: st['時刻の逆転あり'] += 1
    o = []
    for t in sorted(trains + new, key=lambda t: t['ev'][0][1]):
        e = []
        for n, a, dp in t['ev']: e += [SI[n], a, dp - a]
        # 区間ごとの種別: 京成・北総線内は京成の種別、浅草線内は普通(駅を通過する列車はエアポート快特)、京急線内は京急の種別
        nm = [x[0] for x in t['ev']]; kt = sttype.get((t.get('kno'), dw), {})
        asa_n = sum(1 for x in nm if x in ASA or x == '押上'); skip = '押上' in nm and '泉岳寺' in nm and asa_n < 14
        seg = []
        for i in range(len(nm) - 1):
            a, b = nm[i], nm[i + 1]
            if a in KSET and b in KSET:
                tn = kt.get(a) or next((kt[x] for x in nm[i:] if x in kt), None) or next((kt[x] for x in reversed(nm[:i]) if x in kt), None)
                ty = TY.index(TYMAP.get(tn) or ('liner' if tn and 'ライナー' in tn else 'local')) if tn else t['ty']
            elif (a in ASA or a == '押上') and (b in ASA or b == '押上'): ty = TY.index('apkaitoku' if skip else 'local')
            else: ty = t['ty']
            if not seg or seg[-1][1] != ty: seg.append([i, ty])
        o.append([t['no'], t['ty'], t['dest'], e, t['cars'], t['fl'], t['x0'], t['x1'], seg if len(seg) > 1 or (seg and seg[0][1] != t['ty']) else 0])
    out[day] = o
    print(day, len(tt[day]), '→', len(o)); [print('   ', k, v) for k, v in sorted(st.items(), key=lambda x: -x[1])]
json.dump(out, open('tt.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
