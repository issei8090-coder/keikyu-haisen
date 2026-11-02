import sys,io
sys.path.insert(0, sys.argv[1])
sys.stdout=io.TextIOWrapper(sys.stdout.buffer,encoding='utf-8',errors='replace')
import pymupdf as fitz
d=fitz.open(sys.argv[2]); out=sys.argv[3]
info=[]
for i,p in enumerate(d):
    t=p.get_text(); info.append((i,len(t),len(p.get_images()),len(p.get_drawings()) if i in (5,6,60) else -1))
print(info)
for i in (5,6,60):
    d[i].get_pixmap(dpi=130).save(f"{out}/p{i}.png")
    t=d[i].get_text(); print('---',i); print(t[:1200])
