import sys,io,collections
sys.path.insert(0, sys.argv[1])
sys.stdout=io.TextIOWrapper(sys.stdout.buffer,encoding='utf-8',errors='replace')
import pymupdf as fitz
d=fitz.open(sys.argv[2])
def spans(p):
    for b in p.get_text('dict')['blocks']:
        for l in b.get('lines',[]):
            for s in l['spans']:
                if s['text'].strip() or 'EdiF' in s['font']: yield s
print('LEGEND')
ss=sorted(spans(d[5]),key=lambda s:(round(s['bbox'][1]/3),s['bbox'][0]))
for s in ss:
    if s['bbox'][1]<330 and s['bbox'][0]<260: print('%.0f %.0f'%(s['bbox'][0],s['bbox'][1]),repr(s['text']),s['font'][:12],'%06x'%s['color'],round(s['size'],1))
c=collections.Counter(); c2=collections.Counter()
for i in list(range(6,64)):
    for s in spans(d[i]):
        if 'EdiF' in s['font']:
            c[(repr(s['text']),'%06x'%s['color'],round(s['size'],1), s['font'][-3:])]+=1
        if 'Zikoku' in s['font'] or 'Retsuban' in s['font']: c2[(s['font'],'%06x'%s['color'])]+=1
for k,v in sorted(c.items()): print(k,v)
print(c2)
