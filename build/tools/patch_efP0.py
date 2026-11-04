# enterFrom: P[0](引上線を出る時刻)を A に from を入れる前の A[0](ホームに着く時刻)から計算する
#  以前は A.unshift(from) の後に A[0] を見ていたので、P[0] がいつも from になり、引上線からホームまで長い時間かけて這っていた
import io
p = 'src/ttcore.js'
s = io.open(p, encoding='utf-8', newline='').read()
a = "    d.A.unshift(from); d.P.unshift(Math.max(from, d.A[0] - tBack)); d.start = from;"
b = "    { const p0 = Math.max(from, d.A[0] - tBack); d.A.unshift(from); d.P.unshift(p0); } d.start = from;"
assert s.count(a) == 1
s = s.replace(a, b)
io.open(p, 'w', encoding='utf-8', newline='').write(s); print('ok')
