# 事故・支障(src/dinc.js)を disp.js から呼ぶ所(2026-11-06)。dinc.js は assemble.py が disp.js のうしろにつなぐ(node の検査は自分でつなぐ。無ければ何もしない)
import io, os, shutil
p = 'src/disp.js'; b = '_tmp/disp.js.before_inc'
if not os.path.exists(b): shutil.copy(p, b)
raw = io.open(p, encoding='utf-8', newline='').read(); crlf = '\r\n' in raw; s = raw.replace('\r\n', '\n')
if 'dIncStep' in s: raise SystemExit('already')
def rep(a, c):
    global s
    if s.count(a) != 1: raise SystemExit('nf: ' + a[:70] + ' %d' % s.count(a))
    s = s.replace(a, c)
rep("  if (!(dt > 0 && dt < 90)) { dispReset(act); dLastT = T; return; }",
    "  if (!(dt > 0 && dt < 90)) { dispReset(act); dLastT = T; return; }\n  if (typeof dIncStep === 'function') dIncStep(act, T);   // 事故・支障の始まり・終わり(src/dinc.js)")
rep("  if (obs < Infinity) stopAt = Math.min(stopAt, obs - 8);",
    "  if (obs < Infinity) stopAt = Math.min(stopAt, obs - 8);\n  if (p.incStop != null && p.incStop < stopAt) { stopAt = p.incStop; why = '事故・故障'; }   // 車両故障・人身事故で止まる")
rep("    if (T < st.P || T < p.arrT + Math.max(st.minDw, p.paxDw || 0) || p.hold || p.needJ0 != null) return;",
    "    if (T < st.P || T < p.arrT + Math.max(st.minDw, p.paxDw || 0) || p.hold || p.needJ0 != null || (p.incDw != null && T < p.incDw)) return;")
rep("function dPaxSec(t, name, dn, T, gap) {   // その間隔で待っていた客の乗り降りにかかる秒\n  const C = D_PAXCFG, n = 2 * dPaxRate(name, dn, T) * Math.max(0, Math.min(gap, C.gapMax)),",
    "function dPaxSec(t, name, dn, T, gap, mul) {   // その間隔で待っていた客の乗り降りにかかる秒(mul = 客の倍率: JR の振替輸送など)\n  const C = D_PAXCFG, n = 2 * dPaxRate(name, dn, T) * (mul || 1) * Math.max(0, Math.min(gap, C.gapMax)),")
rep("rA = dPaxSec(t, st.name, dn, arrT, gA),",
    "rA = dPaxSec(t, st.name, dn, arrT, gA, typeof dIncPaxMul === 'function' ? dIncPaxMul(st.name, arrT) : 1),")
rep("  dRecApply(); dPaxPlan(list);", "  dRecApply(); dPaxPlan(list); if (typeof dIncReset === 'function') dIncReset();")
if crlf: s = s.replace('\n', '\r\n')
io.open(p, 'w', encoding='utf-8', newline='').write(s); print('ok')
