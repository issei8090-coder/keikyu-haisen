import io
p='src/dcmd.js'; s=io.open(p,encoding='utf-8').read()
def rep(a,b):
    global s
    assert s.count(a)==1, a[:70]; s=s.replace(a,b)
rep("  if (S && YARD_ST.has(name)) ok = true;", "  if (S && (YARD_ST.has(name) || SIDINGS.has(name))) ok = true;   // 検車区・引上線のある駅")
# 折り返し: ホームでそのまま / 引上線に入って
rep("""  if (s.turn !== false) { const a = dEndPoint(t, true), r = dynPath({ e: a.e, t: a.t, d: 1 - a.d }, goals, {}); if (r && r.wrong) wrong = true; else if (r) tries.push({ legs: r.legs, cost: r.cost + 60, turn: true }); }
  tries.sort""", """  if (s.turn !== false) { const a = dEndPoint(t, true), r = dynPath({ e: a.e, t: a.t, d: 1 - a.d }, goals, {}); if (r && r.wrong) wrong = true; else if (r) tries.push({ legs: r.legs, cost: r.cost + 60, turn: true }); }
  if (s.turn !== false && !tries.some(x => x.turn)) { const a = dEndPoint(t, false), r = dynPath({ e: a.e, t: a.t, d: a.d }, goals, { rev: true, revCost: 150 }); if (r && r.wrong) wrong = true; else if (r && r.legs.length > 1) tries.push({ legs: r.legs, cost: r.cost + 60, turn: true }); }   // 引上線に入って折り返す
  tries.sort""")
rep("""    if (s.turn !== false) { const r = dynPath({ e: F.e, t: F.t, d: 1 - F.d }, goals, {}); if (r && r.wrong) wrong = true; else if (r && (!best || r.cost + 60 < best.cost)) best = r; }""",
"""    if (s.turn !== false) { const r = dynPath({ e: F.e, t: F.t, d: 1 - F.d }, goals, {}); if (r && r.wrong) wrong = true; else if (r && (!best || r.cost + 60 < best.cost)) best = r; }
    if (s.turn !== false && !best) { const r = dynPath({ e: R.e, t: R.t, d: R.d }, goals, { rev: true, revCost: 150 }); if (r && r.wrong) wrong = true; else if (r) best = r; }   // 引上線に入って折り返す""")
io.open(p,'w',encoding='utf-8').write(s); print('ok')
