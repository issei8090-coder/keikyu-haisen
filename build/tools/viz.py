import sys, json
sys.path.insert(0, sys.argv[1])
from PIL import Image, ImageDraw
d=json.load(open(sys.argv[2])); out=sys.argv[3]
S=3
W,H=d['W'],d['H']
im=Image.new('RGB',(W*S,H*S),(255,255,255)); dr=ImageDraw.Draw(im)
for p in d['plats']: dr.rectangle([p[0]*S,p[1]*S,p[2]*S+S,p[3]*S+S],fill=(170,190,255))
col={'H':(0,0,200),'V':(0,150,0),'D':(220,120,0)}
for t,x1,y1,x2,y2 in d['segs']:
    dr.line([x1*S+1,y1*S+1,x2*S+1,y2*S+1],fill=col[t],width=1)
    for (x,y) in ((x1,y1),(x2,y2)): dr.rectangle([x*S,y*S,x*S+2,y*S+2],outline=col[t])
for x,y in d['left']: dr.rectangle([x*S,y*S,x*S+2,y*S+2],fill=(255,0,255))
for x,y in d['dots']: dr.ellipse([x*S-3,y*S-3,x*S+5,y*S+5],outline=(255,0,0))
for x in range(0,W,50):
    dr.text((x*S+2,0),str(x),fill=(255,0,0))
rows=[(0,95),(85,175),(165,250),(255,350),(385,465),(500,600),(620,700),(700,775),(775,862)]
for i,(a,b) in enumerate(rows):
    for j,(xa,xb) in enumerate(((0,370),(350,718))):
        c=im.crop((xa*S,a*S,xb*S,b*S)); dd=ImageDraw.Draw(c)
        for y in range((a//10+1)*10,b,10): dd.text((0,(y-a)*S-5),str(y),fill=(255,0,0))
        for x in range((xa//50+1)*50,xb,50): dd.text(((x-xa)*S,0),str(x),fill=(255,0,0))
        c.save(f"{out}/v{i}{'ab'[j]}.png")
