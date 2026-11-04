# 金沢文庫の検車区 その4
#  - 向きを変える位置: 文庫のホームの線は長さ22しかなく、8両(12)の体の端は隣の線にはみ出す。体の反対の端を列車の経路に沿って求める
#    (出庫: 始発列車の経路の先頭から L、入庫: 終着列車の経路の終わりから L)。車庫側の車両はその線・その位置に、経路と逆向きで止まる/出る
#  - ホームのふさがり: 出庫は発車の40秒前まで遅く入ってよい、入庫は着いて60秒後から出てよい
import io
def load(p): return io.open(p, encoding='utf-8', newline='').read()
def save(p, s): io.open(p, 'w', encoding='utf-8', newline='').write(s)
def rep(s, a, b, n=1):
    c = s.count(a); assert c == n, (c, a[:90]); return s.replace(a, b)
p = 'src/ttcore.js'; s = load(p); NL = '\r\n' if '\r\n' in s else '\n'; s = s.replace('\r\n', '\n')
s = rep(s, "      const P_OUT = [0, -30, -60, -90, -120, -180, -240, -300, -420, -600], P_IN = [0, 30, 60, 90, 120, 180, 240, 300, 420, 600];",
           "      const P_OUT = [0, -30, -60, -90, -120, -180, -240, -300, -420, -600, 30, 60, 80], P_IN = [0, 30, 60, 90, 120, 180, 240, 300, 420, 600, -30, -60];")
a = """        const modes = [];   // [車庫側の車両の頭の x, 進む向き]: 向きを変える(頭 = 体の反対の端、向きは逆)/ 通り抜け(頭も向きも同じ)
        { const tailX = hx - sgn * L, tp = paramOf(pe, tailX); if (tp >= 0 && tp <= 1) modes.push([tailX, 1 - g.d]); }
        modes.push([hx, g.d]);
        for (const [kx, kDir] of modes) { const tp = paramOf(pe, kx);
"""
b = """        const modes = [];   // [車庫側の車両の頭がある線, その x, 線の上の位置, 進む向き]: 向きを変える(頭 = 体の反対の端、向きは逆)/ 通り抜け(頭も向きも同じ)
        { const D0 = q.out ? L : r0.total - L, sg = r0.segs.find(v => v.d0 <= D0 + 1e-6 && D0 <= v.d1 + 1e-6);
          if (sg && D0 >= 0 && D0 <= r0.total && !E[sg.e].portal) { const tq = sg.d1 > sg.d0 ? sg.t0 + (sg.t1 - sg.t0) * (D0 - sg.d0) / (sg.d1 - sg.d0) : sg.t0, pt = pointOn(sg.e, tq); modes.push([sg.e, pt.x, tq, 1 - sg.d]); } }
        modes.push([pe, hx, paramOf(pe, hx), g.d]);
        for (const [ke, kx, tp, kDir] of modes) {
"""
s = rep(s, a, b)
s = rep(s, "const key = (q.out ? 'po' : 'pi') + k + ':' + slot + ':' + pe + ':' + Math.round(kx * 10) + ':' + kDir;",
           "const key = (q.out ? 'po' : 'pi') + k + ':' + slot + ':' + ke + ':' + Math.round(tp * 1000) + ':' + kDir;")
s = rep(s, "if (q.out) { const pm = new Map([[pe, kx]]); pm.name = st;", "if (q.out) { const pm = new Map([[ke, kx]]); pm.name = st;")
s = rep(s, "r.segs[r.segs.length - 1].e === pe && r.segs[r.segs.length - 1].d === kDir && !r.revs.length && r.total > 5 && r.total <= 400) R = { segs: r.segs, total: r.total, stopD: [0, r.total], stopE: [r.segs[0].e, pe] }; }",
           "r.segs[r.segs.length - 1].e === ke && r.segs[r.segs.length - 1].d === kDir && Math.abs(r.segs[r.segs.length - 1].t1 - tp) < 0.02 && !r.revs.length && r.total > 5 && r.total <= 400) R = { segs: r.segs, total: r.total, stopD: [0, r.total], stopE: [r.segs[0].e, ke] }; }")
s = rep(s, "else { const r = findRoute({ e: pe, t: tp }, [], new Set([tr.node]), kDir, false);", "else { const r = findRoute({ e: ke, t: tp }, [], new Set([tr.node]), kDir, false);")
s = rep(s, "R = { segs, total: len, stopD: [0, len], stopE: [pe, segs[segs.length - 1].e] }; } } }", "R = { segs, total: len, stopD: [0, len], stopE: [ke, segs[segs.length - 1].e] }; } } }")
save(p, s.replace('\n', NL)); print('ttcore ok')
