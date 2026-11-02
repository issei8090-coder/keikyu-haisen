import sys, json, math
sys.path.insert(0, sys.argv[1])
from PIL import Image, ImageDraw
d=json.load(open(sys.argv[2])); out=sys.argv[3]
W,H=d['W'],d['H']
segs=[s[:] for s in d['segs']]
# decor: short vertical ticks
decor=[]; tr=[]
for s in segs:
    t,x1,y1,x2,y2=s
    if t=='V' and y2-y1<12: decor.append([x1,y1,x2,y2])
    else: tr.append([float(x1),float(y1),float(x2),float(y2),t])
# leftover pixel components bridge endpoints
left=set(map(tuple,d['left']))
seenp=set(); bridges=0
for p0 in list(left):
    if p0 in seenp: continue
    st=[p0]; seenp.add(p0); c=[]
    while st:
        a,b=st.pop(); c.append((a,b))
        for dx in (-1,0,1):
            for dy in (-1,0,1):
                q=(a+dx,b+dy)
                if q in left and q not in seenp: seenp.add(q); st.append(q)
    eps=[]
    for i,s in enumerate(tr):
        for o in (0,2):
            if any(max(abs(s[o]-a),abs(s[o+1]-b))<=1 for a,b in c): eps.append((s[o],s[o+1]))
    eps=list(dict.fromkeys(eps))
    if len(eps)==2 and eps[0]!=eps[1]:
        tr.append([eps[0][0],eps[0][1],eps[1][0],eps[1][1],'B']); bridges+=1
    elif len(eps)>2: print('multi',eps)
print('bridges',bridges)
PATCH=json.load(open(sys.argv[4])) if len(sys.argv)>4 else {}
for x1,y1,x2,y2 in PATCH.get('add',[]): tr.append([float(x1),float(y1),float(x2),float(y2),'M'])
# endpoint clustering (chebyshev<=1)
pts=[]
for i,s in enumerate(tr): pts.append((i,0)); pts.append((i,2))
def P(k): i,o=k; return tr[i][o],tr[i][o+1]
par={k:k for k in pts}
def find(a):
    while par[a]!=a: par[a]=par[par[a]]; a=par[a]
    return a
for a in pts:
    for b in pts:
        if a<b:
            (x,y),(u,v)=P(a),P(b)
            if max(abs(x-u),abs(y-v))<=1: par[find(a)]=find(b)
groups={}
for k in pts: groups.setdefault(find(k),[]).append(k)
for g in groups.values():
    if len(g)>1:
        hs=[k for k in g if tr[k[0]][4]=='H'] or g
        x,y=P(hs[0])
        for i,o in g: tr[i][o]=x; tr[i][o+1]=y
# T snap
def proj(px,py,s):
    x1,y1,x2,y2=s[:4]; dx,dy=x2-x1,y2-y1; L=dx*dx+dy*dy
    if L==0: return None
    t=((px-x1)*dx+(py-y1)*dy)/L
    if t<=0.02 or t>=0.98: return None
    qx,qy=x1+t*dx,y1+t*dy
    return qx,qy,math.hypot(px-qx,py-qy)
for i,s in enumerate(tr):
    for o in (0,2):
        x,y=s[o],s[o+1]
        best=None
        for j,s2 in enumerate(tr):
            if j==i: continue
            r=proj(x,y,s2)
            if r and r[2]<=1.01 and (best is None or r[2]<best[2]): best=r
        if best: s[o],s[o+1]=round(best[0],2),round(best[1],2)
# dots: add as vertices
dots=[]
seen=set()
for x,y in d['dots']:
    if any(abs(x-a)<=2 and abs(y-b)<=2 for a,b in seen): continue
    if any(p[0]-2<=x<=p[2]+2 and p[1]-2<=y<=p[3]+2 for p in d['plats']): continue
    seen.add((x,y)); dots.append([x,y])
json.dump({'W':W,'H':H,'segs':[[s[0],s[1],s[2],s[3]] for s in tr],'decor':decor,'plats':d['plats'],'dots':dots},open(out+'/graph0.json','w'))
print(len(tr),'track segs',len(decor),'decor',len(dots),'dots',dots)
