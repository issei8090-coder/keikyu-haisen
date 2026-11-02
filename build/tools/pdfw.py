import sys,io
sys.path.insert(0, sys.argv[1])
sys.stdout=io.TextIOWrapper(sys.stdout.buffer,encoding='utf-8',errors='replace')
import pymupdf as fitz
d=fitz.open(sys.argv[2]); pg=d[int(sys.argv[3])]
x0,y0,x1,y1=map(float,sys.argv[4:8])
for b in pg.get_text('dict')['blocks']:
    for l in b.get('lines',[]):
        for s in l['spans']:
            bx=s['bbox']
            if bx[0]>=x0 and bx[2]<=x1 and bx[1]>=y0 and bx[3]<=y1 and s['text'].strip():
                print('%.1f %.1f %.1f %.1f'%tuple(bx), repr(s['text']), s['font'], '%06x'%s['color'], round(s['size'],1))
