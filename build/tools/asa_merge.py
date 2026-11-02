# 京急の時刻表(tt.keikyu.json)に、都営浅草線内の時刻(asa/asa.json)を足して tt.json を作る
#  - 京急へ直通する列車: 京急側の列車に浅草線内の停車駅をつなぐ
#  - 浅草線内だけの列車(西馬込〜押上・京成方面): 新しい列車として追加
#  - 西馬込〜泉岳寺の途中駅は時刻表に無いので、営業キロで按分した推定時刻を入れる
#  - 列車の6番目の値: 1=京成線から来る  2=京成線へ行く
import json, sys, io, collections
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
tt = json.load(open('tt.keikyu.json', encoding='utf-8')); asa = json.load(open('asa/asa.json', encoding='utf-8'))
ASA = '押上 本所吾妻橋 浅草 蔵前 浅草橋 東日本橋 人形町 日本橋 宝町 東銀座 新橋 大門 三田 泉岳寺 西馬込'.split()
KEISEI = set('京成曳舟 八広 四ツ木 京成立石 青砥 京成高砂 東松戸 新鎌ヶ谷 千葉ニュータウン中央 印西牧の原 印旛日本医大 空港第2ビル 成田空港'.split())
MID = [('高輪台', 1.4), ('五反田', 2.1), ('戸越', 3.7), ('中延', 4.8), ('馬込', 5.7)]; KM = 6.9   # 泉岳寺からの営業キロ
ST = tt['st'] + [s for s in ASA if s not in tt['st']] + [m[0] for m in MID]
SI = {s: i for i, s in enumerate(ST)}
def decode(tr): return {'no': tr[0], 'ty': tr[1], 'dest': tr[2], 'ev': [[tt['st'][tr[3][i]], tr[3][i + 1], tr[3][i + 1] + tr[3][i + 2]] for i in range(0, len(tr[3]), 3)], 'cars': tr[4], 'fl': 0}
out = {'st': ST, 'ty': tt['ty']}
# 都営交通のオープンデータ(公共交通オープンデータセンター公開API、列車別時刻表)。西馬込〜泉岳寺の区間列車と途中駅の時刻に使う
ODPT = json.load(open('asa/odpt_tt.json', encoding='utf-8'))
EN = dict(zip('Oshiage HonjoAzumabashi Asakusa Kuramae Asakusabashi HigashiNihombashi Ningyocho Nihombashi Takaracho HigashiGinza Shimbashi Daimon Mita Sengakuji Takanawadai Gotanda Togoshi Nakanobu Magome NishiMagome'.split(),
              '押上 本所吾妻橋 浅草 蔵前 浅草橋 東日本橋 人形町 日本橋 宝町 東銀座 新橋 大門 三田 泉岳寺 高輪台 五反田 戸越 中延 馬込 西馬込'.split()))
def hm(x):
    h, m = x.split(':'); h = int(h); return (h + 24 if h < 3 else h) * 60 + int(m)
def odpt(day):
    cal = 'Weekday' if day == 'wd' else 'SaturdayHoliday'; res = []
    for x in ODPT:
        if not x['odpt:calendar'].endswith(cal): continue
        ev = []
        for o in x['odpt:trainTimetableObject']:
            nm = EN[(o.get('odpt:departureStation') or o.get('odpt:arrivalStation')).split('.')[-1]]
            a = o.get('odpt:arrivalTime') or o.get('odpt:departureTime'); d = o.get('odpt:departureTime') or o.get('odpt:arrivalTime')
            ev.append([nm, hm(a), hm(d)])
        og = (x.get('odpt:originStation') or [''])[0]; dg = (x.get('odpt:destinationStation') or [''])[0]
        res.append({'no': x.get('odpt:trainNumber', ''), 'ev': ev, 'og': og, 'dg': dg})
    return res
for day in ('wd', 'hd'):
    trains = [decode(t) for t in tt[day]]
    first = collections.defaultdict(list); last = collections.defaultdict(list)
    for t in trains:
        if t['ev'][0][0] == '泉岳寺' and t['ev'][1][0] == '品川': first[(t['ev'][0][2], t['ev'][1][1])].append(t)
        if t['ev'][-1][0] == '泉岳寺' and t['ev'][-2][0] == '品川': last[(t['ev'][-2][2], t['ev'][-1][1])].append(t)
    st = collections.Counter(); new = []
    for c in asa[day]:
        ev = c['ev']
        # 浅草線内の停車(泉岳寺・押上は着発をまとめる)
        A = []
        for k, nm, mk, v in ev:
            if nm not in ASA: continue
            if A and A[-1][0] == nm: A[-1][2] = max(A[-1][2], v); A[-1][1] = min(A[-1][1], v)
            else: A.append([nm, v, v])
        A.sort(key=lambda e: e[1])
        A2 = []
        for e in A:
            if A2 and A2[-1][0] == e[0]: A2[-1][2] = max(A2[-1][2], e[2])
            else: A2.append(e)
        A = A2
        ks = [v for k, nm, mk, v in ev if nm in KEISEI]
        shina = [v for k, nm, mk, v in ev if nm == '品川']
        if len(A) < 2: st['浅草線内の停車が1駅以下(京急の泉岳寺始発など)'] += 1; continue
        south = ASA.index(A[-1][0]) > ASA.index(A[0][0])   # 押上→泉岳寺・西馬込の向き
        fl = 0
        if ks and min(ks) < A[0][1]: fl |= 1
        if ks and max(ks) > A[-1][2]: fl |= 2
        # 西馬込〜泉岳寺の途中駅を補う
        B = []
        for i, e in enumerate(A):
            B.append(e)
            if i + 1 < len(A) and {e[0], A[i + 1][0]} == {'泉岳寺', '西馬込'}:
                t0, t1 = e[2], A[i + 1][1]
                seq = MID if e[0] == '泉岳寺' else MID[::-1]
                for nm, km in seq:
                    f = km / KM if e[0] == '泉岳寺' else 1 - km / KM
                    v = round(t0 + (t1 - t0) * f); B.append([nm, v, v])
        A = B
        if shina and any(e[0] == '西馬込' for e in A):
            # 西馬込発着の列車と、泉岳寺で乗り継ぐ京急の列車が同じ列に書かれている: 別々の列車として扱う
            st['西馬込の列車+京急の乗り継ぎ列車(別列車)'] += 1; shina = []
            c = dict(c, nums=c['nums'][1:] if len(c['nums']) > 1 else c['nums'])
        if shina:
            sg = [e for e in A if e[0] == '泉岳寺'][0]
            if south:   # 泉岳寺 → 品川
                cand = first.get((sg[2], shina[0]), [])
                if len(cand) != 1: cand = [t for (d, s), l in first.items() for t in l if d == sg[2] and abs(s - shina[0]) <= 1]
                if len(cand) != 1: st['京急側の列車が見つからない(下り)'] += 1; print('  unmatched S', day, c['nums'], sg, shina); continue
                t = cand[0]; t['ev'] = A[:-1] + [[sg[0], sg[1], t['ev'][0][2]]] + t['ev'][1:]; t['fl'] |= fl & 1; t['asa'] = c['nums']
            else:       # 品川 → 泉岳寺
                cand = last.get((shina[0], sg[1]), [])
                if len(cand) != 1: cand = [t for (d, s), l in last.items() for t in l if s == sg[1] and abs(d - shina[0]) <= 1]
                if len(cand) != 1: st['京急側の列車が見つからない(上り)'] += 1; print('  unmatched N', day, c['nums'], sg, shina); continue
                t = cand[0]; t['ev'] = t['ev'][:-1] + [[sg[0], t['ev'][-1][1], sg[2]]] + A[1:]; t['fl'] |= fl & 2; t['asa'] = c['nums']
                if c['dest']: pass
            st['京急直通につないだ'] += 1
        else:
            kl = sorted([(v, nm) for k, nm, mk, v in ev if nm in KEISEI and v > A[-1][2]])
            dest = kl[-1][1] if (fl & 2) and kl else A[-1][0]
            new.append({'no': c['nums'][0] if c['nums'] else '', 'ty': 0, 'dest': dest, 'ev': A, 'cars': 8, 'fl': fl}); st['浅草線内の列車として追加'] += 1
    # --- 都営のデータ: (1) 西馬込〜泉岳寺だけを走る区間列車を追加 (2) 西馬込発着の列車の途中駅を、推定から実際の時刻に置き換える
    od = odpt(day); byNo = collections.defaultdict(list)
    for x in od: byNo[x['no']].append(x)
    SEC = {'泉岳寺', '高輪台', '五反田', '戸越', '中延', '馬込', '西馬込'}
    JP = {'ImbaNihonIdai': '印旛日本医大', 'KeiseiTakasago': '京成高砂', 'Aoto': '青砥', 'NaritaAirportTerminal1': '成田空港', 'InzaiMakinohara': '印西牧の原', 'KeiseiSakura': '京成佐倉', 'KeiseiNarita': '京成成田', 'ShibayamaChiyoda': '芝山千代田', 'KeiseiUeno': '京成上野', 'KeiseiTsudanuma': '京成津田沼', 'Usui': '京成臼井', 'Sogosando': '宗吾参道', 'ChibaNewtownChuo': '千葉ニュータウン中央', 'ShinKamagaya': '新鎌ヶ谷', 'HigashiNarita': '東成田'}
    # 京急のPDFに載っていない浅草線内の列車(西馬込〜泉岳寺の区間列車、朝夕の西馬込〜押上・京成方面など)を都営のデータから足す。
    # すでにある列車かどうかは、三田(無ければ高輪台)の時刻と向きで見分ける。京急へ直通する列車はPDF側を正とするので足さない
    def refkey(ev):
        n = [e[0] for e in ev]
        for ref, other in (('三田', '泉岳寺'), ('高輪台', '泉岳寺')):
            if ref in n and other in n: return (ref, n.index(ref) < n.index(other), ev[n.index(ref)][2])
        return None
    have = collections.defaultdict(list)
    for t in trains + new:
        k = refkey(t['ev'])
        if k: have[k[:2]].append(k[2])
    for x in od:
        if 'Keikyu' in x['og'] or 'Keikyu' in x['dg']: continue
        k = refkey(x['ev'])
        if not k or any(abs(v - k[2]) <= 1 for v in have[k[:2]]): continue
        fl = (0 if 'Toei.Asakusa' in x['og'] else 1) | (0 if 'Toei.Asakusa' in x['dg'] else 2)
        dest = x['ev'][-1][0] if not (fl & 2) else JP.get(x['dg'].split('.')[-1], '京成線')
        new.append({'no': x['no'], 'ty': 0, 'dest': dest, 'ev': x['ev'], 'cars': 8, 'fl': fl}); have[k[:2]].append(k[2])
        st['都営データから追加: ' + ('西馬込〜泉岳寺の区間列車' if {x['ev'][0][0], x['ev'][-1][0]} == {'泉岳寺', '西馬込'} else 'その他の浅草線内の列車')] += 1
    for t in trains + new:
        names = [e[0] for e in t['ev']]
        if '西馬込' not in names or '三田' not in names: continue
        w = t['ev'][names.index('西馬込')]
        cand = [x for x in od if any(e[0] == '西馬込' and abs(e[1] - w[1]) <= 1 for e in x['ev']) and any(e[0] == '三田' for e in x['ev']) and (x['ev'][0][0] == '西馬込') == (names.index('西馬込') < names.index('三田'))]
        if len(cand) != 1: st['途中駅は推定のまま(都営データに対応列車なし)'] += 1; continue
        m = {e[0]: e for e in cand[0]['ev']}
        for e in t['ev']:
            if e[0] in SEC and e[0] in m and e[0] not in ('泉岳寺', '西馬込'): e[1], e[2] = m[e[0]][1], m[e[0]][2]
        st['途中駅を都営データの時刻に置き換え'] += 1
    # 検査
    for t in trains + new:
        bad = [1 for a, b in zip(t['ev'], t['ev'][1:]) if b[1] < a[2]]
        if bad: st['時刻の逆転あり'] += 1; print('  order?', day, t['no'], t['ev'][:3], t['ev'][-3:])
    allt = sorted(trains + new, key=lambda t: t['ev'][0][1])
    o = []
    for t in allt:
        e = []
        for n, a, d in t['ev']: e += [SI[n], a, d - a]
        o.append([t['no'], t['ty'], t['dest'], e, t['cars'], t['fl']])
    out[day] = o
    print(day, dict(st), '列車', len(tt[day]), '→', len(o))
    print('  泉岳寺始発のまま(浅草線内なし)', sum(1 for t in trains if t['ev'][0][0] == '泉岳寺'), ' 泉岳寺止まりのまま', sum(1 for t in trains if t['ev'][-1][0] == '泉岳寺'))
    print('  新規の行先', collections.Counter((t['ev'][0][0], t['dest']) for t in new).most_common(14))
json.dump(out, open('tt.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
