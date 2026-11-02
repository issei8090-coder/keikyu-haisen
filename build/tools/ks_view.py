import sys, json
sys.path.insert(0, 'pylib')
from PIL import Image, ImageDraw
d = json.load(open('data.json', encoding='utf-8')); N = d['nodes']; E = d['edges']
x0, y0, x1, y1 = [float(v) for v in sys.argv[1:5]]; S = float(sys.argv[5]) if len(sys.argv) > 5 else 4
im = Image.new('RGB', (int((x1 - x0) * S), int((y1 - y0) * S)), 'white'); dr = ImageDraw.Draw(im)
T = lambda p: ((p[0] - x0) * S, (p[1] - y0) * S)
deg = [0] * len(N)
for e in E: deg[e[0]] += 1; deg[e[1]] += 1
for s in d['stations']:
    for p in s['plats']: dr.rectangle([T((p[0], p[1])), T((p[2] + 1, p[3] + 1))], fill=(190, 205, 255))
for a, b, dv, fl in E:
    dr.line([T(N[a]), T(N[b])], fill={1: (220, 0, 0), -1: (0, 0, 220), 0: (0, 0, 0)}[dv], width=2)
for s in d['stations']:
    for i, sx in s['stops']:
        y = N[E[i][0]][1]; px, py = T((sx, y)); dr.ellipse([px - 4, py - 4, px + 4, py + 4], outline=(0, 160, 0), width=2)
pn = set(i for p in d['portals'] for i in p) | set(e[0] for e in d['exits'])
for i, v in enumerate(N):
    if deg[i] == 1: px, py = T(v); dr.rectangle([px - 3, py - 3, px + 3, py + 3], fill=(0, 200, 200) if i in pn else (255, 0, 255))
for x in range(int(x0 // 50 + 1) * 50, int(x1), 50): dr.text(((x - x0) * S, 2), str(x), fill=(255, 0, 0))
for y in range(int(y0 // 25 + 1) * 25, int(y1), 25): dr.text((2, (y - y0) * S), str(y), fill=(255, 0, 0))
im.save(sys.argv[6] if len(sys.argv) > 6 else 'ks/view.png'); print(im.size)
