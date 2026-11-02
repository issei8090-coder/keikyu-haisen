# 京成の時刻表サイト(keisei.ekitan.com)から、駅ページ→列車ID一覧→列車ごとの時刻表 を集める
# 使い方: python -I ks_crawl.py stations | trains   (ks/ フォルダに保存。取得済みは飛ばす)
import sys, io, os, re, json, time, html, urllib.request, urllib.parse
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
BASE = 'https://keisei.ekitan.com/search/timetable/'
LINES = {'京成本線', '押上線', '北総線', '成田スカイアクセス線', '芝山鉄道線'}
def get(url, tries=3):
    for k in range(tries):
        try:
            r = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA, 'Accept-Language': 'ja'}), timeout=40)
            return r.read().decode('utf-8', 'replace')
        except Exception as e:
            err = e; time.sleep(2 + 3 * k)
    print('FAIL', url, err); return None
os.makedirs('ks/st', exist_ok=True); os.makedirs('ks/tr', exist_ok=True)
mode = sys.argv[1]
if mode == 'stations':
    st = json.load(open('ks/stcodes.json', encoding='utf-8')); ids = {}
    for s in st:
        if s['line'] not in LINES: continue
        for dc, dn in s['dirs']:
            f = 'ks/st/%s_d%s.html' % (s['code'], dc)
            if not os.path.exists(f):
                h = get(BASE + 'station/%s/d%s?dw=0' % (s['code'], dc))
                if h is None: continue
                open(f, 'w', encoding='utf-8').write(h); time.sleep(0.4)
            h = open(f, encoding='utf-8').read()
            n = 0
            for tx, sf, date, tm, dw in re.findall(r"openOneTrainTimetable\('([^']+)','(\d+)','(\d+)','(\d+)','(\d)'", h):
                ids.setdefault(tx + '|' + dw, [tx, sf, date, tm, dw]); n += 1
            print(s['line'], s['name'], dn, n // 2, flush=True)
    json.dump(ids, open('ks/ids.json', 'w', encoding='utf-8'))
    print('trains', len(ids), 'weekday', sum(1 for k in ids if k.endswith('|0')), 'holiday', sum(1 for k in ids if k.endswith('|1')))
else:
    ids = json.load(open('ks/ids.json', encoding='utf-8')); res = {}
    if os.path.exists('ks/trains.json'): res = json.load(open('ks/trains.json', encoding='utf-8'))
    todo = [k for k in ids if k not in res]; print('todo', len(todo), flush=True)
    for i, k in enumerate(todo):
        tx, sf, date, tm, dw = ids[k]
        h = get(BASE + 'onetraintimetable/?tx=%s&sf=%s&date=%s&time=%s&dw=%s' % (urllib.parse.quote(tx), sf, date, tm, dw))
        if h is None: continue
        b = h[h.find('列車時刻表'):]
        head = re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', b[:b.find('<table')] if '<table' in b else b[:1500]))).strip()
        rows = []
        for tr in re.findall(r'<tr[^>]*>(.*?)</tr>', b, re.S):
            c = [re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', x))).strip() for x in re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', tr, re.S)]
            if len(c) >= 3 and c[0] not in ('駅', '…', ''): rows.append(c[:3])
        res[k] = {'head': head, 'rows': rows}
        if i % 50 == 49:
            json.dump(res, open('ks/trains.json', 'w', encoding='utf-8'), ensure_ascii=False); print(i + 1, '/', len(todo), flush=True)
        time.sleep(0.25)
    json.dump(res, open('ks/trains.json', 'w', encoding='utf-8'), ensure_ascii=False)
    print('done', len(res))
