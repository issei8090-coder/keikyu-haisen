import sys, json, math
sys.path.insert(0, sys.argv[1])
from PIL import Image, ImageDraw
d=json.load(open(sys.argv[2])); out=sys.argv[3]; S=3
W,H=d['W'],d['H']
segs=d['segs']
verts=set()
for s in segs: verts.add((s[0],s[1])); verts.add((s[2],s[3]))
for x,y in d['dots']: verts.add((float(x),float(y)))
edges=[]
for s in segs:
    x1,y1,x2,y2=s; dx,dy=x2-x1,y2-y1; L=math.hypot(dx,dy)
    if L==0: continue
    on=[]
    for (px,py) in verts:
        t=((px-x1)*dx+(py-y1)*dy)/(L*L)
        if -1e-6<=t<=1+1e-6 and math.hypot(px-(x1+t*dx),py-(y1+t*dy))<0.6: on.append((t,(px,py)))
    on.sort()
    for a,b in zip(on,on[1:]):
        if a[1]!=b[1]: edges.append((a[1],b[1]))
deg={}
adj={}
for a,b in edges:
    deg[a]=deg.get(a,0)+1; deg[b]=deg.get(b,0)+1
    adj.setdefault(a,[]).append(b); adj.setdefault(b,[]).append(a)
# components
comp={}; cl=[]
for v in adj:
    if v in comp: continue
    st=[v]; comp[v]=len(cl); tot=0
    while st:
        a=st.pop()
        for b in adj[a]:
            tot+=math.hypot(a[0]-b[0],a[1]-b[1])
            if b not in comp: comp[b]=len(cl); st.append(b)
    cl.append(tot/2)
im=Image.new('RGB',(W*S,H*S),(255,255,255)); dr=ImageDraw.Draw(im)
for p in d['plats']: dr.rectangle([p[0]*S,p[1]*S,p[2]*S+S,p[3]*S+S],fill=(170,190,255))
for a,b in edges:
    small=cl[comp[a]]<25
    dr.line([a[0]*S+1,a[1]*S+1,b[0]*S+1,b[1]*S+1],fill=(255,0,255) if small else (0,0,160),width=1)
for x1,y1,x2,y2 in d['decor']: dr.line([x1*S+1,y1*S+1,x2*S+1,y2*S+1],fill=(150,150,150))
for v,n in deg.items():
    c={1:(255,0,0),2:None}.get(n,(0,170,0))
    if c: dr.rectangle([v[0]*S-1,v[1]*S-1,v[0]*S+3,v[1]*S+3],fill=c)
rows=[(0,95),(85,175),(165,250),(255,350),(385,465),(500,600),(620,700),(700,775),(775,862)]
for i,(a,b) in enumerate(rows):
    for j,(xa,xb) in enumerate(((0,370),(350,718))):
        c=im.crop((xa*S,a*S,xb*S,b*S)); dd=ImageDraw.Draw(c)
        for y in range((a//10+1)*10,b,10): dd.text((0,(y-a)*S-5),str(y),fill=(255,0,0))
        for x in range((xa//50+1)*50,xb,50): dd.text(((x-xa)*S,0),str(x),fill=(255,0,0))
        c.save(f"{out}/g{i}{'ab'[j]}.png")
print('edges',len(edges),'comps',len(cl),'small',sum(1 for c in cl if c<25))
