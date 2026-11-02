import sys
sys.path.insert(0, sys.argv[1])
from PIL import Image, ImageDraw
im = Image.open(sys.argv[2]).convert('RGB')
out = sys.argv[3]
print(im.size)
from collections import Counter
print(Counter(im.getdata()).most_common(10))
S=4
def crop(name,x0,y0,x1,y1):
    c = im.crop((x0,y0,x1,y1)).resize(((x1-x0)*S,(y1-y0)*S), Image.NEAREST)
    d = ImageDraw.Draw(c)
    for x in range((x0//10+1)*10, x1, 10):
        col=(255,160,160) if x%50 else (255,0,0)
        d.line([( (x-x0)*S,0),((x-x0)*S, 12 if x%50 else 24)], fill=col)
        if x%50==0: d.text(((x-x0)*S+2,12), str(x), fill=(255,0,0))
    for y in range((y0//10+1)*10, y1, 10):
        col=(255,160,160) if y%50 else (255,0,0)
        d.line([(0,(y-y0)*S),(12 if y%50 else 24,(y-y0)*S)], fill=col)
        d.text((26,(y-y0)*S-5), str(y), fill=(255,0,0))
    c.save(f"{out}/{name}.png")
rows=[(0,95),(85,175),(165,250),(255,350),(385,465),(500,600),(620,700),(700,775),(775,857)]
W=im.size[0]
for i,(a,b) in enumerate(rows):
    b=min(b,im.size[1])
    crop(f"r{i}a",0,a,250,b); crop(f"r{i}b",230,a,480,b); crop(f"r{i}c",460,a,W,b)
