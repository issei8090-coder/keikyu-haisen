# 待避の行き詰まり判定(dWaiting): 抜く列車が駅で停車中(発車時刻前)なら「ふさがれている」とみなさない(2026-11-05、ユーザー「普通が優等待避をしない(生麦・南太田・逸見)」)
#  dByT(ふさいでいる列車)は dFree が止めたときに書き、停車中は書き直されない。前に普通の後ろで止められた優等の dByT に普通が残っていて、
#  優等が手前の駅に止まっている間に「行き詰まる → 普通を先に出す」になっていた(生麦 610 ← 728D)。
import io, os, shutil
p = 'src/disp.js'; b = '_tmp/disp.js.before_waitdead'
if not os.path.exists(b): shutil.copy(p, b)
raw = io.open(b, encoding='utf-8', newline='').read(); crlf = '\r\n' in raw; s = raw.replace('\r\n', '\n')
a = "    for (let g = 0; g < 10 && x && !dead; g++) { const nx = x.dByT || (x.ph && x.ph.v < 0.1 ? x.ph.obsT || x.ph.waitFor : null); if (nx === t || (nx && dPartner(nx, t))) dead = true; x = nx === x ? null : nx; }"
c = "    for (let g = 0; g < 10 && x && !dead; g++) { const xp = x.ph, xs = xp && xp.mode === 'dwell' && x.dp && x.dp.stops[xp.k], idle = xp && (xp.v >= 0.1 || (xs && T < xs.P));   // 走っている・発車時刻前の停車中は、ふさがれていない\n      const nx = idle ? null : x.dByT || (xp && xp.v < 0.1 ? xp.obsT || xp.waitFor : null); if (nx === t || (nx && dPartner(nx, t))) dead = true; x = nx === x ? null : nx; }"
if a not in s: raise SystemExit('nf')
s = s.replace(a, c)
if crlf: s = s.replace('\n', '\r\n')
io.open(p, 'w', encoding='utf-8', newline='').write(s); print('ok')
