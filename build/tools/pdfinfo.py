import sys
sys.path.insert(0, sys.argv[1])
from pypdf import PdfReader
r=PdfReader(sys.argv[2]); print('pages',len(r.pages))
for i in (0,1):
    p=r.pages[i]; print('--- page',i,p.mediabox); t=p.extract_text() or ''; print(len(t)); print(t[:1500])
