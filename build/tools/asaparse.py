# 京急時刻表PDFの「都営浅草線・京成押上線・北総線・成田スカイアクセス 連絡時刻」のページを読む
# 使い方: python -I asaparse.py pylib schedule_all.pdf asa.json
import sys, io, json, re, unicodedata, collections
sys.path.insert(0, sys.argv[1])
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
import pymupdf as fitz
doc = fitz.open(sys.argv[2]); out = sys.argv[3]
ASA = '押上 本所吾妻橋 浅草 蔵前 浅草橋 東日本橋 人形町 日本橋 宝町 東銀座 新橋 大門 三田 泉岳寺 西馬込'.split()
KEISEI = '京成曳舟 八広 四ツ木 京成立石 青砥 京成高砂 東松戸 新鎌ヶ谷 千葉ニュータウン中央 印西牧の原 印旛日本医大 空港第2ビル 成田空港'.split()
KQ = '品川 京急蒲田 羽田空港第3ターミナル 羽田空港第1・第2ターミナル'.split()
KNOWN = {s: s for s in ASA + KEISEI + KQ}
KNOWN.update({'羽田空港第3ターミナル発': '羽田空港第3ターミナル', '羽田空港第1・第2ターミナル着': '羽田空港第1・第2ターミナル', '川': '品川', '田': '三田', '門': '大門', '橋': '新橋', '町': '宝町', '草': '浅草', '前': '蔵前', '上': '押上', '砥': '青砥'})
def norm(s): return unicodedata.normalize('NFKC', s).replace(' ', '').replace('　', '').replace('ケ', 'ヶ').replace('.', '')
def is_hira(ch): return '぀' <= ch <= 'ゟ'
def spans(p):
    for b in p.get_text('dict')['blocks']:
        for l in b.get('lines', []):
            for s in l['spans']:
                if s['text'].strip(): yield s
cx = lambda s: (s['bbox'][0] + s['bbox'][2]) / 2
cy = lambda s: (s['bbox'][1] + s['bbox'][3]) / 2
unknown = collections.Counter()
def parse_page(pi):
    sp = list(spans(doc[pi]))
    marks = [s for s in sp if s['text'].strip() in ('着', '発', '〃') and s['bbox'][0] < 200 and 'Zikoku' not in s['font']]
    if not marks: return []
    mode = collections.Counter(round(m['bbox'][0]) for m in marks).most_common(1)[0][0]
    marks = [m for m in marks if abs(m['bbox'][0] - mode) <= 1.5]
    namesp = [s for s in sp if 'Zikoku' not in s['font'] and 'Retsuban' not in s['font'] and 'EdiF' not in s['font']
              and not all(is_hira(c) or c in 'ー・' for c in s['text'].strip()) and s['text'].strip() not in ('着', '発', '〃')]
    rows = []
    for m in sorted(marks, key=cy):
        y = cy(m); mx = m['bbox'][0]
        cand = [s for s in namesp if s['bbox'][2] <= mx + 1 and s['bbox'][0] > mx - 70 and abs(cy(s) - y) <= 2.6]
        txt = norm(''.join(s['text'] for s in sorted(cand, key=lambda s: s['bbox'][0])))
        name = None
        for i in range(len(txt)):
            if txt[i:] in KNOWN and (len(txt[i:]) > 1 or i == len(txt) - 1): name = KNOWN[txt[i:]]; break
        if name is None: unknown[txt] += 1; continue
        rows.append({'y': y, 'name': name, 'mark': m['text'].strip()})
    if not rows: return []
    tables = [[rows[0]]]
    for r in rows[1:]:
        if r['y'] - tables[-1][-1]['y'] > 60: tables.append([r])
        else: tables[-1].append(r)
    times = [s for s in sp if 'Zikoku' in s['font'] and re.fullmatch(r'\d{3,4}', s['text'].strip())]
    nums = [s for s in sp if 'Retsuban' in s['font']]
    offs = sorted(cy(s) - min(rows, key=lambda r: abs(r['y'] - cy(s)))['y'] for s in times)
    off = offs[len(offs) // 2] if offs else 0
    res = []
    for ti, tb in enumerate(tables):
        y0 = tb[0]['y'] - 3.4; y1 = tb[-1]['y'] + 3.4
        top = (tables[ti - 1][-1]['y'] + 20) if ti else 0
        xmin = mode + 8
        tt = [s for s in times if y0 <= cy(s) <= y1 and cx(s) > xmin]
        cols = []
        for s in sorted(tt, key=cx):
            if cols and cx(s) - cols[-1]['x'] < 5: cols[-1]['sp'].append(s)
            else: cols.append({'x': cx(s), 'sp': [s]})
        for c in cols:
            xs = sorted(cx(s) for s in c['sp']); med = xs[len(xs) // 2]
            c['sp'] = [s for s in c['sp'] if abs(cx(s) - med) <= 2.2]
            ev = []
            for s in sorted(c['sp'], key=cy):
                k = min(range(len(tb)), key=lambda k: abs(tb[k]['y'] + off - cy(s)))
                if abs(cy(s) - off - tb[k]['y']) > 1.3: continue
                t = s['text'].strip(); h = int(t[:-2]); m = int(t[-2:])
                if h < 3: h += 24
                ev.append([k, tb[k]['name'], tb[k]['mark'], h * 60 + m])
            if len(ev) < 2: continue
            nn = sorted([s for s in nums if abs(cx(s) - med) < 6.5 and top < cy(s) < y1], key=cy)
            ny = cy(nn[0]) if nn else top
            ds = [s for s in sp if abs(cx(s) - med) < 5 and ny + 4 < cy(s) < y0 and 'Zikoku' not in s['font'] and 'Retsuban' not in s['font'] and 'EdiF' not in s['font']]
            dest = norm(''.join(s['text'].strip() for s in sorted(ds, key=cy)))
            parts = [q for q in re.findall(r'[぀-ヿ一-鿿・A-Za-z0-9]+', dest) if not q.isdigit()]
            res.append({'page': pi, 'tab': ti, 'nums': [s['text'].strip() for s in nn], 'dest': parts[-1] if parts else '', 'rows': [[r['name'], r['mark']] for r in tb], 'ev': ev})
    return res
o = {}
for tag, pages in (('wd', range(66, 76)), ('hd', range(134, 144))):
    l = []
    for p in pages:
        r = parse_page(p); l += r
        print(tag, 'page', p, 'cols', len(r), 'tables', sorted(set(t['tab'] for t in r)))
    o[tag] = l
json.dump(o, open(out, 'w', encoding='utf-8'), ensure_ascii=False)
print('unknown', unknown.most_common(30))
t = o['wd'][0]; print(t['rows']); print(t['nums'], t['dest'], t['ev'])
for t in o['wd'][1:5] + [x for x in o['wd'] if x['tab'] == 1][:3]: print(t['page'], t['tab'], t['nums'], t['dest'], [(e[1], e[2], e[3]) for e in t['ev']])
