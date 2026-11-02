import sys,io
sys.path.insert(0, sys.argv[1])
sys.stdout=io.TextIOWrapper(sys.stdout.buffer,encoding='utf-8',errors='replace')
import pymupdf as fitz
d=fitz.open(sys.argv[2])
for i,p in enumerate(d):
    t=p.get_text()
    # side title: find big vertical title chars
    sp=[s for b in p.get_text('dict')['blocks'] for l in b.get('lines',[]) for s in l['spans'] if s['size']>9]
    print(i, ''.join(s['text'] for s in sorted(sp,key=lambda s:(round(s['bbox'][0]/20),s['bbox'][1])))[:60].replace('\n',''))
