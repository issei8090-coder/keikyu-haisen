# haisenryakuzu.net の配線図SVG(京成・北総・芝山)を読んで、線路・ホーム・駅名を取り出す
# 使い方: python -I ks_svg.py pylib   → kq/web/parsed.json と確認用の画像 ks/svg/v_*.png
import re, sys, json, glob, io, os
sys.path.insert(0, sys.argv[1])
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
from PIL import Image, ImageDraw
def parse(f):
    s = open(f, encoding='utf-8').read()
    vb = [float(v) for v in re.search(r'viewBox="([^"]+)"', s).group(1).split()]
    sm = re.search(r'<style[^>]*>(.*?)</style>', s, re.S); style = sm.group(1) if sm else ''
    props = {}
    for sel, body in re.findall(r'([^{}]+)\{([^{}]*)\}', style):
        for c in re.findall(r'\.([\w-]+)', sel):
            props.setdefault(c, {}).update({k: v.strip() for k, v in re.findall(r'([\w-]+)\s*:\s*([^;]+);?', body)})
    def kind(cls, a=None):
        p = {}
        for c in cls.split(): p.update(props.get(c, {}))
        if a: p.update({k: v for k, v in a.items() if k.startswith('stroke')})
        st = p.get('stroke', '').lower(); w = float(re.sub(r'[^\d.]', '', p.get('stroke-width', '1')) or 1)
        if st == '#002060' and w >= 1.2: return 'dash' if 'stroke-dasharray' in p else 'track'
        return 'other'
    body = s[s.index('</style>'):] if sm else s[s.index('<svg'):]
    tracks, dashes, rects, dpaths = [], [], [], []
    for m in re.finditer(r'<line\b([^>]*)/?>', body):
        a = dict(re.findall(r'([\w-]+)="([^"]*)"', m.group(1))); k = kind(a.get('class', ''), a)
        seg = [float(a.get(q, 0)) for q in ('x1', 'y1', 'x2', 'y2')]
        if k == 'track': tracks.append(seg)
        elif k == 'dash': dashes.append(seg)
    for m in re.finditer(r'<polyline\b([^>]*)/?>', body):
        a = dict(re.findall(r'([\w-]+)="([^"]*)"', m.group(1))); k = kind(a.get('class', ''), a)
        pts = [float(v) for v in re.findall(r'-?(?:\d+\.?\d*|\.\d+)', a.get('points', ''))]
        sg = [pts[i:i + 4] for i in range(0, len(pts) - 3, 2)]
        if k == 'track': tracks += sg
        elif k == 'dash': dashes += sg
        else: dpaths.append(sg)
    for m in re.finditer(r'<rect\b([^>]*)/?>', body):
        a = dict(re.findall(r'([\w-]+)="([^"]*)"', m.group(1)))
        if a.get('class') and kind(a['class']) == 'other' and 'fill:#FFFFFF' in json.dumps(props.get(a['class'].split()[-1], {})).upper().replace('"', '').replace(' ', ''): continue
        if 'transform' in a or 'id' in a: continue
        rects.append([float(a.get('x', 0)), float(a.get('y', 0)), float(a.get('width', 0)), float(a.get('height', 0))])
    for m in re.finditer(r'<path\b([^>]*)/?>', body):
        a = dict(re.findall(r'([\w-]+)="([^"]*)"', m.group(1))); d = a.get('d', '')
        k = kind(a.get('class', ''), a)
        # 絶対座標の折れ線だけ対応 (M x,y L x,y / h / v)
        cur = None; start = None; segs = []
        for cmd, arg in re.findall(r'([MLHVhvlmzZ])([^MLHVhvlmzZ]*)', d):
            n = [float(v) for v in re.findall(r'-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?', arg)]
            if cmd == 'M': cur = n[:2]; start = cur
            elif cmd == 'm': cur = [cur[0] + n[0], cur[1] + n[1]] if cur else n[:2]; start = cur
            elif cmd in 'Ll':
                for i in range(0, len(n) - 1, 2):
                    nx = n[i:i + 2] if cmd == 'L' else [cur[0] + n[i], cur[1] + n[i + 1]]; segs.append(cur + nx); cur = nx
            elif cmd in 'Hh':
                for v in n: nx = [v if cmd == 'H' else cur[0] + v, cur[1]]; segs.append(cur + nx); cur = nx
            elif cmd in 'Vv':
                for v in n: nx = [cur[0], v if cmd == 'V' else cur[1] + v]; segs.append(cur + nx); cur = nx
        if k == 'track': tracks += segs
        elif k == 'dash': dashes += segs
        else: dpaths.append(segs)
    texts = []
    for m in re.finditer(r'<text\b([^>]*)>(.*?)</text>', body, re.S):
        tr = re.search(r'matrix\(([^)]+)\)|translate\(([^)]+)\)', m.group(1))
        if not tr: continue
        n = [float(v) for v in re.findall(r'-?[\d.]+', tr.group(1) or tr.group(2))]
        x, y = (n[4], n[5]) if tr.group(1) else (n[0], n[1])
        t = re.sub(r'<[^>]+>', '', m.group(2)).strip()
        if re.search(r'[぀-鿿]', t): texts.append([x, y, t])
    return {'vb': vb, 'tracks': tracks, 'dashes': dashes, 'rects': rects, 'dpaths': dpaths, 'texts': texts}
out = {}
for f in sorted(glob.glob('kq/web/*.svg')):
    r = parse(f); nm = os.path.basename(f)[:-4]; out[nm] = r
    S = 2.6; vb = r['vb']
    im = Image.new('RGB', (int(vb[2] * S), int(vb[3] * S)), 'white'); d = ImageDraw.Draw(im)
    for x, y, w, h in r['rects']: d.rectangle([x * S, y * S, (x + w) * S, (y + h) * S], fill=(150, 150, 150))
    for p in r['dpaths']:
        for a in p: d.line([v * S for v in a], fill=(220, 0, 0), width=1)
    for a in r['dashes']: d.line([v * S for v in a], fill=(0, 170, 0), width=2)
    for a in r['tracks']: d.line([v * S for v in a], fill=(0, 0, 220), width=2)
    for x in range(0, int(vb[2]), 50): d.text((x * S, 2), str(x), fill=(255, 0, 0))
    for y in range(0, int(vb[3]), 25): d.text((2, y * S), str(y), fill=(255, 0, 0))
    im.save('kq/web/v_%s.png' % nm)
    print(nm, 'tracks', len(r['tracks']), 'dash', len(r['dashes']), 'rects', len(r['rects']), 'paths', len(r['dpaths']), [t[2] for t in r['texts']][:10])
json.dump(out, open('kq/web/parsed.json', 'w', encoding='utf-8'), ensure_ascii=False)
