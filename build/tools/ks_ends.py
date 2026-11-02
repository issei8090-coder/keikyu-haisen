# 各図の線路の端点(行き止まり・図の端)と、ホーム・駅名を一覧にする
import json, sys, io, math
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
P = json.load(open('ks/svg/parsed.json', encoding='utf-8'))
SHEETS = ['pr_hokuso_020_01'] if len(sys.argv) > 1 else ['pr_keisei_main_020_0%d' % i for i in range(1, 9)] + ['pr_keisei_oshiage_020_01', 'pr_hokuso_020_02', 'pr_hokuso_020_03', 'pr_hokuso_020_04', 'pr_keisei_naritakuko_020_05', 'pr_keisei_higashinarita_010_01', 'pr_shibayama_010_01']
def onseg(p, s):
    x1, y1, x2, y2 = s; dx, dy = x2 - x1, y2 - y1; L2 = dx * dx + dy * dy
    if L2 == 0: return False
    t = ((p[0] - x1) * dx + (p[1] - y1) * dy) / L2
    return -0.02 <= t <= 1.02 and math.hypot(p[0] - (x1 + t * dx), p[1] - (y1 + t * dy)) < 0.9
for nm in SHEETS:
    r = P[nm]; T = r['tracks'] + r['dashes']; vb = r['vb']
    ends = []
    for i, s in enumerate(T):
        for p in ((s[0], s[1]), (s[2], s[3])):
            if not any(j != i and onseg(p, o) for j, o in enumerate(T)): ends.append(p)
    isl = [q for q in r['rects'] if 40 < q[2] < 75 and 5 < q[3] < 13]
    print('==', nm.replace('pr_', ''), 'vb', vb[2], vb[3], 'tracks', len(T), 'islands', len(isl))
    print('   ends:', ' '.join('(%.0f,%.0f)' % p for p in sorted(ends)))
    print('   names:', ' '.join('%s@%.0f,%.0f' % (t[2], t[0], t[1]) for t in r['texts'] if len(t[2]) < 14))
