# 予備の編成(2026-11-05、ユーザー「運用に入っていない電車も予備としておくようにしてほしい」)
#  編成表の当てはめ(hensei.js ttHensei)で今日の運用が無い編成を、所属の検車区の「1日中空いている車庫の線」に1日中止めておく。
#  ttcore: yard() が駅ごとの車庫の線の使い方(occ など)を yState に残し、planner の park(駅, 両数, 名前) で空いている所に止まったままの列車(reserve)を作る。
#  tt.js: ttHensei(list, pl) と planner を渡す。hensei.js: 運用の無い編成を pl.park で置き、編成表に「予備」と出す。
#  使い方: build フォルダで python tools/patch_reserve.py(前の版 _tmp/*.before_reserve)
import io, os, shutil
def edit(p, pairs):
    b = '_tmp/' + os.path.basename(p) + '.before_reserve'
    if not os.path.exists(b): shutil.copy(p, b)
    raw = io.open(b, encoding='utf-8', newline='').read(); crlf = '\r\n' in raw; s = raw.replace('\r\n', '\n')
    for a, c in pairs:
        if a not in s: raise SystemExit('見つからない: ' + p + ' ' + a[:70])
        s = s.replace(a, c, 1)
    if crlf: s = s.replace('\n', '\r\n')
    io.open(p, 'w', encoding='utf-8', newline='').write(s); print('ok', p)

edit('src/ttcore.js', [
  ("      const order = () => Y.tracks.map((tr, k) => k).sort((x, y) => occ[x].length - occ[y].length || x - y);",
   "      const order = () => Y.tracks.map((tr, k) => k).sort((x, y) => occ[x].length - occ[y].length || x - y);\n"
   "      yState.set(st, { Y, occ, cap, slotTrim, slotName, fits });   // 予備の編成を置くとき(park)に使う"),
  ("  const STAY0 = 4 * 3600, STAY1 = 26 * 3600, STAY_AM = 8 * 3600, STAY_PM = 22 * 3600;",
   "  const STAY0 = 4 * 3600, STAY1 = 26 * 3600, STAY_AM = 8 * 3600, STAY_PM = 22 * 3600;\n"
   "  const yState = new Map();   // 検車区の駅 → 車庫の線の使い方(yard() が作る)\n"
   "  // 予備の編成: 検車区 st の、1日中空いている車庫の線(奥から)に cars 両の列車を1日中止めておく。置けなければ null\n"
   "  const park = (st, cars, no) => { const S = yState.get(st); if (!S) return null; const { Y, occ, cap, slotTrim, slotName, fits } = S, L = (cars || 8) * 1.5;\n"
   "    for (let k = 0; k < Y.tracks.length; k++) { const tr = Y.tracks[k];\n"
   "      for (let slot = 0; slot < cap(tr, L); slot++) { if (!fits(k, slot, STAY0, STAY1, [])) continue;\n"
   "        const other = E[tr.e].a === tr.node ? E[tr.e].b : E[tr.e].a, r = findRoute(Y.pos(tr.node, slotTrim(tr, slot, L)), [], new Set([other]), null, false); if (r.fail || !r.segs.length) continue;\n"
   "        occ[k].push({ slot, a: STAY0, b: STAY1, xs: [] });\n"
   "        return { no, type: 'kaiso', dest: st, cars, fl: 0, x0: '', x1: '', tseg: null, tt: true, s: 0, g: null, k0: 0, yard: 'out', yardSt: st, yardTr: tr.label + slotName(tr, slot, L), stay: true, dh: true, reserve: true,\n"
   "          names: [st], ev: [{ name: st, arr: Math.floor(STAY0 / 60), dep: Math.floor(STAY1 / 60) }], route: { segs: r.segs, total: r.total, stopD: [0, r.total], stopE: [r.segs[0].e, r.segs[r.segs.length - 1].e] },\n"
   "          A: [STAY0, STAY1], P: [STAY1 - 60, STAY1], start: STAY0, end: STAY1, prev: null, next: null }; } }\n"
   "    return null; };"),
  ("  return { pre, plan, stat, units, finish, res };", "  return { pre, plan, stat, units, finish, res, park };"),
])
edit('src/tt.js', [
  ("if (typeof ttHensei === 'function') ttHensei(list);", "if (typeof ttHensei === 'function') ttHensei(list, pl);"),
])
edit('src/hensei.js', [
  ("function ttHensei(all) {", "const HS_ST = { 新町: '神奈川新町', 金沢: '金沢文庫', 久里浜: '京急久里浜' };\nfunction ttHensei(all, pl) {"),
  ("  return HS = { F, jobs, miss };", """  // 予備: 今日の運用が無い編成は、所属の検車区の空いている車庫の線に1日中止めておく(pl.park)
  let nRes = 0;
  if (pl && pl.park) for (const f of F) { if (f.jobs.length) continue; const st = HS_ST[f.dep], u = st && pl.park(st, f.cars, f.f); if (!u) continue;
    u.hs = f; all.push(u); f.jobs.push({ ch: [u], reserve: true, s: u.start, e: u.end, st0: st, st1: st, cars: f.cars, dep: f.dep, f }); f.free = u.end; f.at = st; nRes++; }
  return HS = { F, jobs, miss, nRes };"""),
  ("return a ? `${hm(a.ev[0].dep)} ${a.names[0]} → ${hm(z.ev[z.ev.length - 1].arr)} ${z.names[z.names.length - 1]}(${r.length}本)` : (J.unit ? '増結車' : '車庫'); };",
   "return J.reserve ? `予備(${J.st0} ${J.ch[0].yardTr})` : a ? `${hm(a.ev[0].dep)} ${a.names[0]} → ${hm(z.ev[z.ev.length - 1].arr)} ${z.names[z.names.length - 1]}(${r.length}本)` : (J.unit ? '増結車' : '車庫'); };"),
  ("u = a.filter(f => f.jobs.length); return `${d} ${u.length}/${a.length}`; }).join('　');",
   "u = a.filter(f => f.jobs.some(J => !J.reserve)), rv = a.filter(f => f.jobs.some(J => J.reserve)); return `${d} ${u.length}/${a.length}${rv.length ? '(予備 ' + rv.length + ')' : ''}`; }).join('　');"),
])
