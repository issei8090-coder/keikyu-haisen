# 京成公式のスカイライナー時刻表ページ(dl_sky/page.html)から表を取り出して dl_sky/tables.txt に書く
import io, re, sys, html
s = open(sys.argv[1], 'rb').read().decode('utf-8', 'replace')
out = []
for m in re.finditer(r'<(h[1-6]|table)\b[^>]*>([\s\S]*?)</\1>', s):
    tag, body = m.group(1), m.group(2)
    if tag != 'table':
        t = re.sub(r'<[^>]+>', '', body).strip()
        if t: out.append('## ' + html.unescape(t))
        continue
    out.append('[table @%d]' % m.start())
    for r in re.findall(r'<tr\b[^>]*>([\s\S]*?)</tr>', body):
        cells = [html.unescape(re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', c)).strip()) for c in re.findall(r'<t[hd]\b[^>]*>([\s\S]*?)</t[hd]>', r)]
        out.append(' | '.join(cells))
io.open('dl_sky/tables.txt', 'w', encoding='utf-8').write('\n'.join(out))
print(len(out))
