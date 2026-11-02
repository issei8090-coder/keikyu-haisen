import sys,io
sys.path.insert(0, sys.argv[1])
sys.stdout=io.TextIOWrapper(sys.stdout.buffer,encoding='utf-8',errors='replace')
import fitz
d=fitz.open(sys.argv[2]); out=sys.argv[3]
print(len(d), d[0].rect)
for i in [0,1,2,3]:
    d[i].get_pixmap(dpi=110).save(f"{out}/p{i}.png")
    t=d[i].get_text(); print('---',i,len(t)); print(t[:700])
print('TOC',d.get_toc()[:40])
