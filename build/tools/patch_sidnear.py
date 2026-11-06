# 引上線の判定: 行き止まりの点が別の駅のホームのすぐ横(x 8・y 6 以内。子安の横の神奈川新町の引上線は x 12、京成西船の横の東中山は x 10 なので残る)にあるなら、その駅の線とみなして引上線にしない(2026-11-05)
#  逗子・葉山の y=739 の線(e708)はホーム [175,742,192,748] の手前 x=170 で終わり、図の px で近い神武寺の引上線と判定されて
#  「引上線への出入りの線は両方向」で神武寺〜逗子・葉山の下り線 e1138 の向きが消え、下り線に上りの閉塞が3つ並んでいた(使われない信号機)。
import io, os, shutil
p = 'src/core.js'; b = '_tmp/core.js.before_sidnear'
if not os.path.exists(b): shutil.copy(p, b)
raw = io.open(b, encoding='utf-8', newline='').read(); crlf = '\r\n' in raw; s = raw.replace('\r\n', '\n')
a = "    const name = ST[edgeStation[r.segs[r.segs.length - 1].e]].name;\n"
c = a + "    if (ST.some(s => s.name !== name && (s.plats || []).some(p => N[n].x >= p[0] - 8 && N[n].x <= p[2] + 8 && N[n].y >= p[1] - 6 && N[n].y <= p[3] + 6))) return;   // 別の駅のホームのすぐ横の行き止まり(図でホームの手前で切れた線。逗子・葉山)は引上線にしない\n"
if s.count(a) != 1: raise SystemExit('nf')
s = s.replace(a, c)
if crlf: s = s.replace('\n', '\r\n')
io.open(p, 'w', encoding='utf-8', newline='').write(s); print('ok')
