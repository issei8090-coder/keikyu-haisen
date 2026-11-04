# 金沢文庫の検車区 その3
#  - 向きを変えない出入り(通り抜け): 能見台から着いて文庫で終わる下り(上の線に着く)はそのまま右へ進んで車庫へ、
#    文庫始発の上り(下の線から出る)は車庫から左へ出てそのままホームへ。車庫側の車両の頭 = 列車の頭、向きも同じ
#  - 向きを変える形を先に試し、だめなら通り抜け(どちらも道の長さ400まで。全線を回る遠回りを選ばない)
#  - 1線の本数: 最大6本(長さ132〜152の線で、奥から 2+21×i に 12両(18)まで入る)
import io
def load(p): return io.open(p, encoding='utf-8', newline='').read()
def save(p, s): io.open(p, 'w', encoding='utf-8', newline='').write(s)
def rep(s, a, b, n=1):
    c = s.count(a); assert c == n, (c, a[:90]); return s.replace(a, b)
p = 'src/ttcore.js'; s = load(p); NL = '\r\n' if '\r\n' in s else '\n'; s = s.replace('\r\n', '\n')
s = rep(s, "Math.max(1, Math.min(4, Math.floor((tr.len - 23) / 21) + 1))", "Math.max(1, Math.min(6, Math.floor((tr.len - 23) / 21) + 1))")
a = """        const tailX = hx - sgn * L, tp = paramOf(pe, tailX); if (!(tp >= 0 && tp <= 1)) return;   // 体の反対の端(ここが車庫側の車両の頭になる)
        const kDir = 1 - g.d;   // 車庫側の車両の進む向きは列車と逆
        for (const sh of q.out ? P_OUT : P_IN) { for (const k of order()) { const tr = Y.tracks[k];
          for (let slot = 0; slot < cap(tr, L); slot++) {
            let R = null;
            const key = (q.out ? 'po' : 'pi') + k + ':' + slot + ':' + pe + ':' + Math.round(tailX * 10);
"""
b = """        const modes = [];   // [車庫側の車両の頭の x, 進む向き]: 向きを変える(頭 = 体の反対の端、向きは逆)/ 通り抜け(頭も向きも同じ)
        { const tailX = hx - sgn * L, tp = paramOf(pe, tailX); if (tp >= 0 && tp <= 1) modes.push([tailX, 1 - g.d]); }
        modes.push([hx, g.d]);
        for (const [kx, kDir] of modes) { const tp = paramOf(pe, kx);
        for (const sh of q.out ? P_OUT : P_IN) { for (const k of order()) { const tr = Y.tracks[k];
          for (let slot = 0; slot < cap(tr, L); slot++) {
            let R = null;
            const key = (q.out ? 'po' : 'pi') + k + ':' + slot + ':' + pe + ':' + Math.round(kx * 10) + ':' + kDir;
"""
s = rep(s, a, b)
s = rep(s, "if (q.out) { const pm = new Map([[pe, tailX]]); pm.name = st;", "if (q.out) { const pm = new Map([[pe, kx]]); pm.name = st;")
s = rep(s, "!r.revs.length && r.total > 5) R = {", "!r.revs.length && r.total > 5 && r.total <= 400) R = {")
s = rep(s, "if (!r.fail && !r.revs.length) { const len = r.total - slotTrim(tr, slot, L);", "if (!r.fail && !r.revs.length && r.total <= 400) { const len = r.total - slotTrim(tr, slot, L);")
s = rep(s, """              t.next = K; reserve(pe, ta, leave + 10, t); occ[k].push({ slot, a: x, b: STAY1, xs: [x] }); units.push(K); stat.yardIn = (stat.yardIn || 0) + 1; addIv(K); addIv(t); return;
            }
          } } }
      };""", """              t.next = K; reserve(pe, ta, leave + 10, t); occ[k].push({ slot, a: x, b: STAY1, xs: [x] }); units.push(K); stat.yardIn = (stat.yardIn || 0) + 1; addIv(K); addIv(t); return;
            }
          } } } }
      };""")
save(p, s.replace('\n', NL)); print('ttcore ok')
