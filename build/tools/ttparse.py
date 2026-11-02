import sys, io, json, re, unicodedata, collections
sys.path.insert(0, sys.argv[1])
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
import pymupdf as fitz
doc = fitz.open(sys.argv[2]); out = sys.argv[3]

MAIN = '泉岳寺 品川 北品川 新馬場 青物横丁 鮫洲 立会川 大森海岸 平和島 大森町 梅屋敷 京急蒲田 雑色 六郷土手 京急川崎 八丁畷 鶴見市場 京急鶴見 花月総持寺 生麦 京急新子安 子安 神奈川新町 京急東神奈川 神奈川 横浜 戸部 日ノ出町 黄金町 南太田 井土ヶ谷 弘明寺 上大岡 屏風浦 杉田 京急富岡 能見台 金沢文庫 金沢八景 追浜 京急田浦 安針塚 逸見 汐入 横須賀中央 県立大学 堀ノ内 京急大津 馬堀海岸 浦賀'.split()
OTHER = '新大津 北久里浜 京急久里浜 YRP野比 京急長沢 津久井浜 三浦海岸 三崎口 糀谷 大鳥居 穴守稲荷 天空橋 羽田空港第3ターミナル 羽田空港第1・第2ターミナル 港町 鈴木町 川崎大師 東門前 大師橋 小島新田 六浦 神武寺 逗子・葉山'.split()
STATIONS = MAIN + OTHER
ALIAS = {'羽田第3': '羽田空港第3ターミナル', '羽田第1・第2': '羽田空港第1・第2ターミナル', '西馬込': '西馬込', '屋敷': '梅屋敷', '敷': '梅屋敷'}
KNOWN = {s: s for s in STATIONS}; KNOWN.update(ALIAS)
def norm(s):
    s = unicodedata.normalize('NFKC', s).replace(' ', '').replace('　', '').replace('ケ', 'ヶ').replace('.', '').replace('屛', '屏')
    return s
def is_hira(ch): return '぀' <= ch <= 'ゟ'

def spans(p):
    for b in p.get_text('dict')['blocks']:
        for l in b.get('lines', []):
            for s in l['spans']:
                if s['text'].strip(): yield s
unknown = collections.Counter()

def parse_page(pi, split_blocks):
    sp = list(spans(doc[pi]))
    cx = lambda s: (s['bbox'][0] + s['bbox'][2]) / 2
    cy = lambda s: (s['bbox'][1] + s['bbox'][3]) / 2
    marks = [s for s in sp if s['text'].strip() in ('着', '発', '〃') and s['bbox'][0] < 200 and 'Zikoku' not in s['font']]
    if not split_blocks and marks:   # keep only the real row-marker column (annotations inside the table also contain these characters)
        mode = collections.Counter(round(m['bbox'][0]) for m in marks).most_common(1)[0][0]
        marks = [m for m in marks if abs(m['bbox'][0] - mode) <= 1.5]
    # name char spans
    namesp = [s for s in sp if 'Zikoku' not in s['font'] and 'Retsuban' not in s['font'] and 'EdiF' not in s['font']
              and not all(is_hira(c) or c in 'ー・' for c in s['text'].strip()) and s['text'].strip() not in ('着', '発', '〃')]
    rows = []
    for m in sorted(marks, key=cy):
        y = cy(m); mx = m['bbox'][0]
        cand = [s for s in namesp if s['bbox'][2] <= mx + 1 and s['bbox'][0] > mx - 125 and abs(cy(s) - y) <= 5.9]
        if not cand: continue
        # try y-levels from the nearest one until a known station name is found
        name = None; first_txt = None
        for lv in sorted(cand, key=lambda s: abs(cy(s) - y)):
            ly = cy(lv)
            cl = sorted([s for s in cand if abs(cy(s) - ly) < 1.6], key=lambda s: s['bbox'][0])
            txt = norm(''.join(s['text'] for s in cl))
            if first_txt is None: first_txt = txt
            for i in range(len(txt)):
                if txt[i:] in KNOWN: name = KNOWN[txt[i:]]; break
            if name: break
        if name is None:
            unknown[first_txt] += 1; continue
        rows.append({'y': y, 'name': name, 'mx': mx})
    if not rows: return []
    # drop the "始発/終着" header rows next to 西馬込
    H = doc[pi].rect.height
    for r in [r for r in rows if r['name'] == '西馬込']:
        if r['y'] < H / 2: rows = [q for q in rows if q['y'] > r['y'] + 4]
        else: rows = [q for q in rows if q['y'] < r['y'] - 4]
    rows = [r for r in rows if r['name'] != '西馬込']
    # blocks
    blocks = [[rows[0]]]
    for r in rows[1:]:
        if split_blocks and r['y'] - blocks[-1][-1]['y'] > 15: blocks.append([r])
        else: blocks[-1].append(r)
    times = [s for s in sp if 'Zikoku' in s['font'] and re.fullmatch(r'\d{3,4}', s['text'].strip())]
    nums = [s for s in sp if 'Retsuban' in s['font']]
    offs = sorted(cy(s) - min(rows, key=lambda r: abs(r['y'] - cy(s)))['y'] for s in times)
    off = offs[len(offs) // 2] if offs else 0
    trains = []
    for bi, blk in enumerate(blocks):
        y0 = blk[0]['y'] - 3.4; y1 = blk[-1]['y'] + 3.4
        xmin = max(r['mx'] for r in blk) + 5
        tt = [s for s in times if y0 <= cy(s) <= y1 and cx(s) > xmin]
        cols = []
        for s in sorted(tt, key=cx):
            if cols and cx(s) - cols[-1]['x'] < 5: cols[-1]['sp'].append(s)
            else: cols.append({'x': cx(s), 'sp': [s]})
        top_limit = y0 if not split_blocks else y0
        prev_y1 = -1 if bi == 0 or not split_blocks else blocks[bi - 1][-1]['y'] + 3.4
        for c in cols:
            # annotations inside a column ("○○発 2107" etc.) are set slightly off the column axis: drop them
            xs = sorted(cx(s) for s in c['sp']); med = xs[len(xs) // 2]
            c['sp'] = [s for s in c['sp'] if abs(cx(s) - med) <= 2.2]
            c['x'] = med
            ev = {}
            order = []
            for s in sorted(c['sp'], key=cy):
                r = min(blk, key=lambda r: abs(r['y'] + off - cy(s)))
                if abs(cy(s) - off - r['y']) > 1.3: continue
                t = s['text'].strip(); h = int(t[:-2]); m = int(t[-2:])
                if h < 3: h += 24
                v = h * 60 + m
                if r['name'] not in ev: ev[r['name']] = [v, v]; order.append(r['name'])
                else: ev[r['name']][1] = v
            if len(order) < 2: continue
            nn = [s for s in nums if abs(cx(s) - c['x']) < 6.5 and prev_y1 < cy(s) < y0 + (8 if split_blocks else 0)]
            if split_blocks: nn = [s for s in nn if cy(s) > y0 - 12]
            num = None; col = 0
            if nn:
                n = max(nn, key=cy); num = n['text'].strip(); col = n['color']
            dest = ''
            if not split_blocks and nn:
                ny = cy(max(nn, key=cy))
                ds = [s for s in sp if abs(cx(s) - c['x']) < 5 and ny + 4 < cy(s) < y0 and 'Zikoku' not in s['font'] and 'Retsuban' not in s['font'] and 'EdiF' not in s['font']]
                dest = norm(''.join(s['text'].strip() for s in sorted(ds, key=cy)))
                parts = [q for q in re.findall(r'[぀-ヿ一-鿿・A-Za-z0-9]+', dest) if not q.isdigit()]
                dest = re.sub(r'\d*両$', '', parts[-1]) if parts else ''
            cars = 0
            if not split_blocks and nn:
                ny = cy(max(nn, key=cy))
                cs = [s for s in sp if 'Zikoku' in s['font'] and re.fullmatch(r'\d{1,2}', s['text'].strip()) and abs(cx(s) - c['x']) < 7.5 and ny < cy(s) < y0]
                if cs: cars = int(cs[-1]['text'].strip())
            trains.append({'cars': cars, 'no': num, 'express': col != 0x231f20 and num is not None, 'dest': dest, 'ev': [[n, ev[n][0], ev[n][1]] for n in order], 'page': pi})
    return trains

AIR = set('糀谷 大鳥居 穴守稲荷 天空橋 羽田空港第3ターミナル 羽田空港第1・第2ターミナル'.split())
ZUSHI = set('六浦 神武寺 逗子・葉山'.split())
KURI = set('新大津 北久里浜 京急久里浜 YRP野比 京急長沢 津久井浜 三浦海岸 三崎口'.split())
def classify(tr):
    names = [e[0] for e in tr['ev']]; S = set(names)
    idx = [MAIN.index(n) for n in names if n in MAIN]
    if S & AIR: idx.append(MAIN.index('京急蒲田'))
    if S & ZUSHI: idx.append(MAIN.index('金沢八景'))
    if S & KURI: idx.append(MAIN.index('堀ノ内'))
    if len(idx) < 2: return 'local'
    lo, hi = min(idx), max(idx)
    P = set(MAIN[lo:hi + 1]) - S
    if not P: return 'local'
    if '横浜' in P or '京急川崎' in P: return 'wing'
    if '京急蒲田' in P: return 'apkaitoku'
    if S & {'立会川', '京急鶴見', '京急東神奈川', '日ノ出町', '井土ヶ谷', '弘明寺', '杉田', '能見台'}: return 'kyuko'
    if S & {'青物横丁', '平和島', '神奈川新町', '追浜', '汐入'}: return 'tokkyu'
    return 'kaitoku'

def build(pages_main, pages_daishi, tag):
    raw = []
    for p in pages_main: raw += parse_page(p, False)
    for p in pages_daishi: raw += parse_page(p, True)
    # merge by train number
    merged = {}; res = []
    for t in raw:
        if t['no'] and t['no'] in merged:
            m = merged[t['no']]
            a0, a1 = m['ev'][0][1], m['ev'][-1][2]; b0, b1 = t['ev'][0][1], t['ev'][-1][2]
            if b0 >= a1 - 1 or b1 <= a0 + 1:   # consecutive parts of one train
                d = {e[0]: e for e in m['ev']}
                for e in t['ev']:
                    if e[0] in d: d[e[0]][1] = min(d[e[0]][1], e[1]); d[e[0]][2] = max(d[e[0]][2], e[2])
                    else: m['ev'].append(e)
                m['ev'].sort(key=lambda e: e[1])
                if b0 >= a1 - 1 and t['dest']: m['dest'] = t['dest']
                m['express'] = m['express'] or t['express']
                continue
            else: print('dup number not merged', tag, t['no'], m['page'], t['page'])
        if t['no']: merged[t['no']] = t
        res.append(t)
    for t in res:
        t['ev'].sort(key=lambda e: e[1])
        t['type'] = classify(t)
        gaps = [(x[0], y[0], y[1] - x[2]) for x, y in zip(t['ev'], t['ev'][1:]) if y[1] - x[2] > 25]
        if gaps: print('big gap', tag, t['no'], t['page'], gaps[:2])
        bad = [1 for a, b in zip(t['ev'], t['ev'][1:]) if b[1] < a[2]]
        if bad: print('time order?', tag, t['no'], t['page'], t['ev'][:4])
    res.sort(key=lambda t: t['ev'][0][1])
    print(tag, 'cars', collections.Counter(t.get('cars', 0) for t in res))
    print(tag, 'raw', len(raw), 'trains', len(res), collections.Counter(t['type'] for t in res))
    return res

wk = build(range(6, 64), [64, 65], 'weekday')
hol = build(range(78, 132), [132, 133], 'holiday')
TY = ['local', 'kyuko', 'tokkyu', 'kaitoku', 'apkaitoku', 'wing']
def comp(lst):
    o = []
    for tr in lst:
        ev = []
        for n, a, d in tr['ev']: ev += [STATIONS.index(n), a, d - a]
        o.append([tr['no'] or '', TY.index(tr['type']), tr['dest'], ev, tr.get('cars', 0)])
    return o
json.dump({'st': STATIONS, 'ty': TY, 'wd': comp(wk), 'hd': comp(hol)}, open(out, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('unknown', unknown.most_common(40))
for t in wk[:2] + wk[400:402]: print(t)
print(collections.Counter(t['dest'] for t in wk).most_common(60))
