# 久里浜検車区: 向きを変える線(hs)を入出庫線の北久里浜方の端だけに(工場側の線 42,810 で向きを変えると上下の本線を2回横切るため)
import io
p = 'src/core.js'
s = io.open(p, encoding='utf-8', newline='').read()
a = " };   // 京急久里浜 = 久里浜検車区(北久里浜〜京急久里浜の間)は入出庫線の北久里浜方の端で向きを変える(引上線と同じ扱い)"
b = ", '京急久里浜': { hsBox: [[15, 833, 30, 840]] } };   // 京急久里浜 = 久里浜検車区(北久里浜〜京急久里浜の間)は入出庫線の北久里浜方の端で向きを変える(引上線と同じ扱い。hsBox = 向きを変えてよい行き止まりの範囲)"
if a in s: s = s.replace(a, b)
a = "if (!r.fail && r.total >= 60 && r.total <= 220) hs.push("
b = "if (yc && yc.hsBox && !yc.hsBox.some(([x0, y0, x1, y1]) => N[n].x >= x0 && N[n].x <= x1 && N[n].y >= y0 && N[n].y <= y1)) { rest.push(n); continue; } if (!r.fail && r.total >= 60 && r.total <= 220) hs.push("
if a in s and 'yc.hsBox' not in s: s = s.replace(a, b)
io.open(p, 'w', encoding='utf-8', newline='').write(s); print('hsBox' in s, s.count('yc.hsBox'))
