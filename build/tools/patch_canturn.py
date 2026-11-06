# dCanTurn: 手書きの駅の一覧をやめ、線路から決める(正しい向きのホームから折り返して、隣の駅へ短い逆線だけで行けるか)
import io, re, sys
p = 'src/dcmd.js'; s = io.open(p, encoding='utf-8').read()
i = s.index('const dCanTurn = name =>'); j = s.index('\n', i)
new = """const D_TURNC = new Map();
function dCanTurn(name) {
  if (D_TURNC.has(name)) return D_TURNC.get(name);
  let ok = false; const S = stByName.get(name);
  if (S && YARD_ST.has(name)) ok = true;
  if (S && !ok) {
    const near = new Set(); for (const sec of DSEC) { const L = [...sec.stInfo].sort((a, b) => a[1].km - b[1].km).map(x => x[0]), k = L.indexOf(name); if (k < 0) continue; for (const q of [k - 2, k - 1, k + 1, k + 2]) if (L[q] && L[q] !== name) near.add(L[q]); }
    const goals = [...near].flatMap(n => dStationGoals(n, 0)).map(g => Object.assign(g, { pen: 0 }));
    for (const [e, x] of S.stops) { if (dSecOf[e] < 0 || ok) continue; const sp = paramOf(e, x);
      for (const d of [0, 1]) { const ed = E[e]; if (ed.dir && Math.sign((d ? -1 : 1) * ed.vx) === -ed.dir) continue;   // 正しい向きで着いた列車
        const r = dynPath({ e, t: sp, d: 1 - d }, goals, { maxCost: 900 }); if (r && !r.wrong) { ok = true; break; } } }
  }
  D_TURNC.set(name, ok); return ok;
}"""
s = s[:i] + new + s[j:]
io.open(p, 'w', encoding='utf-8').write(s); print('ok')
