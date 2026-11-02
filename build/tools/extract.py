import sys, json, math
sys.path.insert(0, sys.argv[1])
from PIL import Image, ImageDraw
im = Image.open(sys.argv[2]).convert('RGB')
out = sys.argv[3]
W,H = im.size
px = im.load()
BLUE=(0,0,221); WHITE=(255,255,255)
M=[[px[x,y] in (BLUE,WHITE) for x in range(W)] for y in range(H)]
def get(m,x,y): return 0<=x<W and 0<=y<H and m[y][x]
def comps(m):
    seen=[[False]*W for _ in range(H)]; res=[]
    for y in range(H):
        for x in range(W):
            if m[y][x] and not seen[y][x]:
                st=[(x,y)]; seen[y][x]=True; c=[]
                while st:
                    a,b=st.pop(); c.append((a,b))
                    for dx in (-1,0,1):
                        for dy in (-1,0,1):
                            u,v=a+dx,b+dy
                            if 0<=u<W and 0<=v<H and m[v][u] and not seen[v][u]:
                                seen[v][u]=True; st.append((u,v))
                res.append(c)
    return res
# platforms: 5x5 full cores
core=[[False]*W for _ in range(H)]
for y in range(2,H-2):
    for x in range(2,W-2):
        if M[y][x] and all(M[y+j][x+i] for i in range(-2,3) for j in range(-2,3)): core[y][x]=True
plats=[]
for c in comps(core):
    xs=[p[0] for p in c]; ys=[p[1] for p in c]
    x0,x1,y0,y1=min(xs)-2,max(xs)+2,min(ys)-2,max(ys)+2
    plats.append([x0,y0,x1,y1])
    for y in range(y0,y1+1):
        for x in range(x0,x1+1): M[y][x]=False
# dots 3x3
dots=[]
for y in range(1,H-1):
    for x in range(1,W-1):
        if all(M[y+j][x+i] for i in (-1,0,1) for j in (-1,0,1)): dots.append((x,y))
# text removal
removed=0
for c in comps(M):
    xs=[p[0] for p in c]; ys=[p[1] for p in c]
    w=max(xs)-min(xs)+1; h=max(ys)-min(ys)+1
    if w<=13 and h<=13:
        # keep if it is a plain thin line (pixels count ~ max(w,h))
        if len(c) <= max(w,h)+2 and max(w,h)>=6: continue
        for (a,b) in c: M[b][a]=False
        removed+=1
segs=[]; used=[[False]*W for _ in range(H)]
hv=[[False]*W for _ in range(H)]
for y in range(H):
    x=0
    while x<W:
        if M[y][x]:
            x2=x
            while x2+1<W and M[y][x2+1]: x2+=1
            if x2-x+1>=5:
                segs.append(['H',x,y,x2,y])
                for i in range(x,x2+1): used[y][i]=True; hv[y][i]=True
            x=x2+1
        else: x+=1
for x in range(W):
    y=0
    while y<H:
        if M[y][x]:
            y2=y
            while y2+1<H and M[y2+1][x]: y2+=1
            if y2-y+1>=5:
                segs.append(['V',x,y,x,y2])
                for i in range(y,y2+1): used[i][x]=True; hv[i][x]=True
            y=y2+1
        else: y+=1
for dy in (1,-1):
    for y in range(H):
        for x in range(W):
            if M[y][x] and not get(M,x-1,y-dy):
                x2,y2=x,y; n=1; free=0 if hv[y][x] else 1
                while get(M,x2+1,y2+dy):
                    x2+=1; y2+=dy; n+=1
                    if not hv[y2][x2]: free+=1
                if n>=4 and free>=2:
                    segs.append(['D',x,y,x2,y2])
                    a,b=x,y
                    for i in range(n): used[b][a]=True; a+=1; b+=dy
left=[(x,y) for y in range(H) for x in range(W) if M[y][x] and not used[y][x]]
print('plats',len(plats),'dots',len(dots),'segs',len(segs),'textcomps',removed,'leftover',len(left))
json.dump({'W':W,'H':H,'plats':plats,'dots':dots,'segs':segs,'left':left}, open(out+'/raw.json','w'))
