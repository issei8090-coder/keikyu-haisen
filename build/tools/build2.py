import sys, json, math
sys.path.insert(0, sys.argv[1])
from PIL import Image, ImageDraw
g=json.load(open(sys.argv[2])); img=Image.open(sys.argv[3]).convert('RGB'); out=sys.argv[4]
cfg=json.load(open(sys.argv[5],encoding='utf-8'))
W,H=g['W'],max(g['H'],cfg.get('H',0))
segs=[s+[0] for s in g['segs']]
# remove row-end marker junk
segs=[s for s in segs if not (s[1]!=s[3] and math.hypot(s[0]-s[2],s[1]-s[3])<12 and (max(s[0],s[2])>=693 or min(s[0],s[2])<=10))]
eps=[(s[0],s[1]) for s in segs]+[(s[2],s[3]) for s in segs]
def near(x,y,r=4):
    b=min(eps,key=lambda p:math.hypot(p[0]-x,p[1]-y))
    return b if math.hypot(b[0]-x,b[1]-y)<=r else (float(x),float(y))
for x1,y1,x2,y2,*f in cfg.get('add',[]):
    a=near(x1,y1); b=near(x2,y2); segs.append([a[0],a[1],b[0],b[1],(f[0] if f else 0)])
def killed(s):
    for x1,y1,x2,y2 in cfg.get('kill',[]):
        if all(x1<=s[i]<=x2 and y1<=s[i+1]<=y2 for i in (0,2)): return True
    return False
segs=[s for s in segs if not killed(s)]
bars=[]
for s in list(segs):
    if s[0]==s[2]:
        n=sum(1 for o in segs if o is not s and any(abs(o[i]-s[0])<1 and min(s[1],s[3])-1<=o[i+1]<=max(s[1],s[3])+1 for i in (0,2)))
        if n>=4: segs.remove(s); bars.append(s[:4])
print('bars',bars)
for x1,y1,x2,y2,*f in cfg.get('add2',[]): segs.append([float(x1),float(y1),float(x2),float(y2),(f[0] if f else 0)])
def inter(a,b):
    x1,y1,x2,y2=a[:4]; x3,y3,x4,y4=b[:4]
    den=(x1-x2)*(y3-y4)-(y1-y2)*(x3-x4)
    if abs(den)<1e-9: return None
    t=((x1-x3)*(y3-y4)-(y1-y3)*(x3-x4))/den
    u=((x1-x3)*(y1-y2)-(y1-y3)*(x1-x2))/den
    if 0<=t<=1 and 0<=u<=1: return (round(x1+t*(x2-x1),2),round(y1+t*(y2-y1),2))
verts=set()
for s in segs: verts.add((s[0],s[1])); verts.add((s[2],s[3]))
isH=lambda s: s[1]==s[3]
isV=lambda s: s[0]==s[2]
for i,a in enumerate(segs):
    if not isH(a) or a[4]: continue
    for b in segs:
        if isH(b) or isV(b) or b[4]: continue
        p=inter(a,b)
        if p: verts.add(p)
plats=[];hatch=[]
for p in g['plats']:
    x0,y0,x1,y1=p
    wh=sum(1 for y in range(y0,y1+1) for x in range(x0,x1+1) if img.getpixel((x,y))==(255,255,255))
    (hatch if wh>3 or (x1-x0)*(y1-y0)>600 else plats).append(p)
hatch=[p for p in hatch if not (p[2]-p[0]<8)]
plats=[p for p in plats if p[2]-p[0]>=12]
for x0,y0,x1,y1 in cfg.get('hatch',[]):
    for p in list(plats):
        if x0<=p[0] and p[2]<=x1 and y0<=p[1] and p[3]<=y1: plats.remove(p); hatch.append(p)
for x0,y0,x1,y1 in cfg.get('hatchKill',[]):
    hatch=[p for p in hatch if not (x0<=p[0] and p[2]<=x1 and y0<=p[1] and p[3]<=y1)]
for x0,y0,x1,y1 in cfg.get('platKill',[]):
    plats=[p for p in plats if not (x0<=p[0] and p[2]<=x1 and y0<=p[1] and p[3]<=y1)]
plats+=cfg.get('platAdd',[])
groups=[]
for p in sorted(plats,key=lambda p:(p[1],p[0])):
    for gr in groups:
        q=gr[-1]
        ov=min(p[2],q[2])-max(p[0],q[0])
        if ov>0.5*min(p[2]-p[0],q[2]-q[0]) and p[1]-max(r[3] for r in gr)<20: gr.append(p); break
    else: groups.append([p])
for gr in groups:
    x0=min(p[0] for p in gr)-3; x1=max(p[2] for p in gr)+4; y0=min(p[1] for p in gr)-17; y1=max(p[3] for p in gr)+17
    for sg in segs:
        if sg[1]==sg[3] and y0<=sg[1]<=y1:
            xa,xb=sorted((sg[0],sg[2]))
            for x in (x0,x1):
                if xa+1<x<xb-1: verts.add((float(x),sg[1]))
for x,y in cfg.get('splitAt',[]): verts.add((float(x),float(y)))   # 線の途中に区切りを入れる(運転指令の並べ方で、真っすぐな所に駅間の長さを持たせるため)
verts=list(verts)
rep={}
for v in verts:
    for w in rep.values():
        if math.hypot(v[0]-w[0],v[1]-w[1])<0.7: rep[v]=w; break
    else: rep[v]=v
edges=set(); eflag={}
for s in segs:
    x1,y1,x2,y2,f=s; dx,dy=x2-x1,y2-y1; L=math.hypot(dx,dy)
    if L==0: continue
    on=[]
    for v in verts:
        t=((v[0]-x1)*dx+(v[1]-y1)*dy)/(L*L)
        if -1e-6<=t<=1+1e-6 and math.hypot(v[0]-(x1+t*dx),v[1]-(y1+t*dy))<0.6:
            if f and 0.02<t<0.98: continue
            on.append((t,rep[v]))
    on.sort()
    for a,b in zip(on,on[1:]):
        if a[1]!=b[1]:
            k=(min(a[1],b[1]),max(a[1],b[1])); edges.add(k)
            if f: eflag[k]=1
edges=list(edges)
def stats(edges):
    adj={}
    for a,b in edges: adj.setdefault(a,[]).append(b); adj.setdefault(b,[]).append(a)
    return adj
adj=stats(edges); comp={}; cl=[]
for v in adj:
    if v in comp: continue
    st=[v]; comp[v]=len(cl); tot=0
    while st:
        a=st.pop()
        for b in adj[a]:
            tot+=math.hypot(a[0]-b[0],a[1]-b[1])
            if b not in comp: comp[b]=len(cl); st.append(b)
    cl.append(tot/2)
edges=[e for e in edges if cl[comp[e[0]]]>=25]
ch=True
while ch:
    ch=False; adj=stats(edges)
    for e in list(edges):
        a,b=e; L=math.hypot(a[0]-b[0],a[1]-b[1])
        if L<3.6 and (len(adj[a])==1 or len(adj[b])==1): edges.remove(e); ch=True; break
adj=stats(edges)
nodes=sorted(adj.keys(), key=lambda p:(p[1],p[0])); nid={v:i for i,v in enumerate(nodes)}
E=[[nid[a],nid[b],0,eflag.get((a,b),0)] for a,b in edges]
decor=cfg.get('decorAdd',[])+bars+[d for d in g['decor'] if not any(x0<=d[0]<=x1 and y0<=d[1]<=y1 for x0,y0,x1,y1 in cfg.get('decorKill',[])) and any(abs(d[0]-v[0])<=1.5 and d[1]-1<=v[1]<=d[3]+1 for v in nodes)]
def band_override(x,y):
    for x0,y0,x1,y1 in cfg.get('nodir',[]):
        if x0<=x<=x1 and y0<=y<=y1: return True
    return False
Hs=[(i,e) for i,e in enumerate(E) if nodes[e[0]][1]==nodes[e[1]][1] and not band_override((nodes[e[0]][0]+nodes[e[1]][0])/2,nodes[e[0]][1])]
for i,e in Hs:
    xa,xb=sorted((nodes[e[0]][0],nodes[e[1]][0])); y=nodes[e[0]][1]; xm=(xa+xb)/2
    ys=sorted(set(nodes[f[0]][1] for j,f in Hs if min(nodes[f[0]][0],nodes[f[1]][0])<=xm<=max(nodes[f[0]][0],nodes[f[1]][0])))
    k=ys.index(y); lo=k
    while lo>0 and ys[lo]-ys[lo-1]<=17: lo-=1
    hi=k
    while hi<len(ys)-1 and ys[hi+1]-ys[hi]<=17: hi+=1
    band=ys[lo:hi+1]; n=len(band); r=band.index(y)
    if n==1: e[2]=0
    elif r<n//2: e[2]=1
    elif r>=n-n//2: e[2]=-1
for x0,y0,x1,y1,dv in cfg.get('dir',[]):
    for e in E:
        mx=(nodes[e[0]][0]+nodes[e[1]][0])/2; my=(nodes[e[0]][1]+nodes[e[1]][1])/2
        if x0<=mx<=x1 and y0<=my<=y1: e[2]=dv
deg={i:len(adj[v]) for v,i in nid.items()}
def nearnode(x,y,only1=True):
    c=[i for i in range(len(nodes)) if (deg[i]==1 or not only1)]
    b=min(c,key=lambda i:math.hypot(nodes[i][0]-x,nodes[i][1]-y))
    if math.hypot(nodes[b][0]-x,nodes[b][1]-y)>=8: print('NO NODE NEAR',x,y,nodes[b]); return None
    return b
portals=[p for p in ([nearnode(a,b),nearnode(c,d)] for a,b,c,d in cfg.get('portals',[])) if None not in p]
exits=[e for e in ([nearnode(a,b),n] for a,b,n in cfg.get('exits',[])) if e[0] is not None]
pn0=set(i for p in portals for i in p)|set(e[0] for e in exits)
# 行き止まりの線(終端駅のホームや留置線)は両方向に使う: 行き止まりから最初の分岐までの向きを消す(指定した範囲だけ)
if cfg.get('deadendNoDirY') is not None:
    nb={}
    for i,e in enumerate(E): nb.setdefault(e[0],[]).append((i,e[1])); nb.setdefault(e[1],[]).append((i,e[0]))
    for v in range(len(nodes)):
        if deg[v]!=1 or nodes[v][1]<cfg['deadendNoDirY'] or v in pn0: continue
        cur=v; prev=-1
        for _ in range(60):
            nx=[(i,w) for i,w in nb[cur] if i!=prev]
            if len(nx)!=1: break
            i,w=nx[0]; E[i][2]=0; prev=i; cur=w
names=cfg.get('names',[])
rows=cfg['rows']
def rowof(y):
    for i,(a,b) in enumerate(rows):
        if a<=y<b: return i
def key(gr):
    cy=sum(p[1]+p[3] for p in gr)/2/len(gr); cx=sum(p[0]+p[2] for p in gr)/2/len(gr)
    return (rowof(cy),cx)
groups.sort(key=key)
stations=[]
for gi,gr in enumerate(groups):
    x0=min(p[0] for p in gr); x1=max(p[2] for p in gr); y0=min(p[1] for p in gr); y1=max(p[3] for p in gr)
    cx=round(sum(p[0]+p[2]+1 for p in gr)/2/len(gr),1)
    name=names[gi] if gi<len(names) else "?%d"%gi
    stops=[]; passE=[]; top=y0
    for i,e in enumerate(E):
        a,b=nodes[e[0]],nodes[e[1]]
        xa,xb=sorted((a[0],b[0]))
        if a[1]==b[1]:
            y=a[1]
            if xa<=cx<=xb and y0-17<=y<=y1+17: passE.append(i); top=min(top,y)
            elif xb>x0 and xa<x1 and y0-17<=y<=y1+17: top=min(top,y)
            for p in gr:
                ov=min(xb,p[2]+1)-max(xa,p[0])
                if ov>=0.5*(p[2]+1-p[0]) and (0<p[1]-y<=7 or 0<y-p[3]<=7):
                    sx=min(max((p[0]+p[2]+1)/2,xa+1),xb-1)
                    stops.append([i,sx])
    stations.append({'name':name,'cx':cx,'lx':cx,'ly':top-4,'plats':gr,'stops':stops,'pass':passE,'row':rowof((y0+y1)/2)})
    print(gi,name.encode('unicode_escape').decode() if not names else '', 'cx',cx,'y',y0,y1,'row',rowof((y0+y1)/2),'stops',len(stops),'pass',len(passE))
# 位置で駅名を指定(自動で取り込んだ路線用)
for x,y,nm in cfg.get('nameAt',[]):
    for st in stations:
        if any(p[0]-3<=x<=p[2]+3 and p[1]-3<=y<=p[3]+3 for p in st['plats']): st['name']=nm; break
for nm,x,y in cfg.get('stopAdd',[]):
    for s in stations:
        if s['name']==nm:
            for i,e in enumerate(E):
                a,b=nodes[e[0]],nodes[e[1]]
                if a[1]==b[1]==y and min(a[0],b[0])<x<max(a[0],b[0]): s['stops'].append([i,x]); break
            else: print('stopAdd failed',nm,x,y)
            break
for s in stations:
    if s['name'] in cfg.get('labelText',{}): s['label']=cfg['labelText'][s['name']]
for nm,dx,dy in cfg.get('label',[]):
    for s in stations:
        if s['name']==nm: s['lx']+=dx; s['ly']+=dy
merged={}
for s in stations:
    if s['name'] in merged:
        m=merged[s['name']]
        m['plats']+=s['plats']; m['stops']+=s['stops']; m['pass']+=s['pass']; m['ly']=min(m['ly'],s['ly'])
    else: merged[s['name']]=s
stations=list(merged.values())
data={'W':W,'H':H,'nodes':[list(n) for n in nodes],'edges':E,'portals':portals,'exits':exits,'stations':stations,'decor':decor,'hatch':hatch,'platDecor':cfg.get('platDecor',[]),'text':cfg.get('text',[])}
json.dump(data,open(out+'/data.json','w',encoding='utf-8'),ensure_ascii=False,separators=(',',':'))
print('nodes',len(nodes),'edges',len(E),'plats',len(plats),'hatch',hatch,'groups',len(groups))
pn=set(i for p in portals for i in p)|set(e[0] for e in exits)
print('deadends',[(nodes[i]) for i in range(len(nodes)) if deg[i]==1 and i not in pn])
S=3
im=Image.new('RGB',(W*S,H*S),(255,255,255)); dr=ImageDraw.Draw(im)
for p in plats: dr.rectangle([p[0]*S,p[1]*S,p[2]*S+S,p[3]*S+S],fill=(170,190,255))
for p in hatch: dr.rectangle([p[0]*S,p[1]*S,p[2]*S+S,p[3]*S+S],outline=(120,120,120))
for a,b,dv,_fl in E:
    a=nodes[a];b=nodes[b]
    dr.line([a[0]*S+1,a[1]*S+1,b[0]*S+1,b[1]*S+1],fill={1:(220,0,0),-1:(0,0,220),0:(0,0,0)}[dv],width=2)
for s in stations:
    for i,sx in s['stops']:
        y=nodes[E[i][0]][1]; dr.ellipse([sx*S-3,y*S-3,sx*S+5,y*S+5],outline=(0,160,0),width=2)
for i,v in enumerate(nodes):
    if deg[i]>=3: dr.rectangle([v[0]*S-1,v[1]*S-1,v[0]*S+3,v[1]*S+3],fill=(0,170,0))
    if deg[i]==1: dr.rectangle([v[0]*S-2,v[1]*S-2,v[0]*S+4,v[1]*S+4],fill=(255,0,255) if i not in pn else (0,200,200))
vr=[(0,95),(85,175),(165,250),(255,350),(385,465),(500,600),(620,700),(700,775),(775,862)]
for i,(a,b) in enumerate(vr):
    for j,(xa,xb) in enumerate(((0,370),(350,718))):
        c=im.crop((xa*S,a*S,xb*S,b*S)); dd=ImageDraw.Draw(c)
        for y in range((a//10+1)*10,b,10): dd.text((0,(y-a)*S-5),str(y),fill=(255,0,0))
        for x in range((xa//50+1)*50,xb,50): dd.text(((x-xa)*S,0),str(x),fill=(255,0,0))
        c.save("%s/crops/f%d%s.png"%(out,i,'ab'[j]))
