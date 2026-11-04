# 金沢文庫の検車区 その7: 昼の留置の組(platPair)でも、まだ決めていない入庫の番線を避ける・出庫をほかの番線から出す
#  例: 730D(7:57着)→902D(9:02発)の組が下り本線から出て、8:58に同じ線へ着く 852D が入庫できなかった
#  使い方: build フォルダで python tools/patch_kbyard7.py(前の版は _tmp/ttcore.before_kbyard7.js)
import io, os, shutil
def load(p): return io.open(p, encoding='utf-8', newline='').read()
def save(p, s): io.open(p, 'w', encoding='utf-8', newline='').write(s)
def rep(s, a, b, n=1):
    c = s.count(a); assert c == n, (c, a[:90]); return s.replace(a, b)

p = 'src/ttcore.js'
if not os.path.exists('_tmp/ttcore.before_kbyard7.js'): shutil.copy(p, '_tmp/ttcore.before_kbyard7.js')
s = load(p); NL = '\r\n' if '\r\n' in s else '\n'; s = s.replace('\r\n', '\n')

# altStart: 試す処理を渡せるように
s = rep(s, "      const altStart = (q, avoid) => { const d = q.d,", "      const altStart = (q, tryFn) => { const d = q.d,")
s = rep(s, "          if (platYard(q, avoid)) { stat.yardAlt = (stat.yardAlt || 0) + 1; return true; }",
           "          if (tryFn()) { stat.yardAlt = (stat.yardAlt || 0) + 1; return true; }")
# platPair: avoid を出庫側へ
s = rep(s, "      const platPair = (qi, qo) => { const ci = platModes(qi), co = platModes(qo);", "      const platPair = (qi, qo, avoid) => { const ci = platModes(qi), co = platModes(qo);")
s = rep(s, "            const v = platTry(qo, co, k, slot, m, sh, x => vi.some(a => ok(a, x))); if (!v) continue;",
           "            const v = platTry(qo, co, k, slot, m, sh, x => vi.some(a => ok(a, x)), avoid); if (!v) continue;")
s = rep(s, "        const miss = q => { if (q.out ? !(platYard(q, pend) || altStart(q, pend) || platYard(q) || altStart(q)) : !platYard(q)) stat.yardMiss = (stat.yardMiss || 0) + 1; }, back = [];",
           "        const miss = q => { if (q.out ? !(platYard(q, pend) || altStart(q, () => platYard(q, pend)) || platYard(q) || altStart(q, () => platYard(q))) : !platYard(q)) stat.yardMiss = (stat.yardMiss || 0) + 1; }, back = [];")
s = rep(s, "        for (const [qi, qo] of pairs) { if (platPair(qi, qo)) stat.yardMid",
           "        for (const [qi, qo] of pairs) { if (platPair(qi, qo, pend) || altStart(qo, () => platPair(qi, qo, pend)) || platPair(qi, qo) || altStart(qo, () => platPair(qi, qo))) stat.yardMid")
save(p, s.replace('\n', NL)); print('ttcore ok')
