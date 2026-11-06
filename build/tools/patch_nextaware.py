# 段の行き先の番線を、次の段(折り返しなど)ができる番線から選ぶ(確かめと実行で同じ関数)
import io
p = 'src/dcmd.js'; s = io.open(p, encoding='utf-8').read()
def cut(a, b, new):
    global s
    i = s.index(a); j = s.index(b, i); s = s[:i] + new + s[j:]
cut('function dPreCheck(t, steps) {', '// 段の並びを実行する。', r"""// 1段ぶんの経路: F = 列車の先頭、R = 後ろ(どちらも経路の上の点と向き)。進む / ホームで折り返す / 引上線に入って折り返す
function dFindStep(F, R, s, goals) {
  const tries = []; let wrong = false;
  if (s.turn !== true) { const r = dynPath({ e: R.e, t: R.t, d: R.d }, goals, {}); if (r && r.wrong) wrong = true; else if (r) tries.push({ legs: r.legs, cost: r.cost, turn: false, goal: r.goal }); }
  if (s.turn !== false) { const r = dynPath({ e: F.e, t: F.t, d: 1 - F.d }, goals, {}); if (r && r.wrong) wrong = true; else if (r) tries.push({ legs: r.legs, cost: r.cost + 60, turn: true, goal: r.goal }); }
  if (s.turn !== false && !tries.some(x => x.turn)) { const r = dynPath({ e: R.e, t: R.t, d: R.d }, goals, { rev: true, revCost: 150 }); if (r && r.wrong) wrong = true; else if (r && r.legs.length > 1) tries.push({ legs: r.legs, cost: r.cost + 60, turn: true, goal: r.goal }); }   // 引上線に入って折り返す
  tries.sort((x, y) => x.cost - y.cost);
  return { best: tries[0] || null, wrong };
}
const dLegEnd = best => { const L = best.legs[best.legs.length - 1], g = L.segs[L.segs.length - 1]; return { e: g.e, t: g.t1, d: g.d }; };
// 段 s の経路。次の段 nx があれば、そこへ行ける番線を選ぶ(だめな番線を外して探し直す)
function dStepPlan(F, R, s, nx, L) {
  let goals = dStationGoals(s.to, L); if (!goals.length) return { err: `${s.to}のホームが運転指令の区間にありません` };
  let wrong = false, last = null;
  for (let k = 0; k < 8 && goals.length; k++) {
    const r = dFindStep(F, R, s, goals); wrong = wrong || r.wrong; if (!r.best) break;
    if (!nx || nx.park) return { best: r.best };
    const E1 = dLegEnd(r.best), g2 = dStationGoals(nx.to, L); if (!g2.length) return { err: `${nx.to}のホームが運転指令の区間にありません` };
    const r2 = dFindStep(E1, E1, nx, g2); if (r2.best) return { best: r.best };
    last = r2; const ge = r.best.goal.e; goals = goals.filter(g => g.e !== ge);
  }
  if (last) return { err: `${s.to}から${nx.to}へは${nx.turn === false ? '進めません' : '折り返せません'}(${last.wrong ? '近くに渡り線がありません' : '経路がありません'})`, next: true };
  return { err: wrong ? `${s.to}へは、ここからは行けません(折り返しに使える渡り線がありません)` : `${s.to}への経路がありません` };
}
// 指示を出す前の確かめ: 各段の行き先へ、前の段の終わりから(進むか折り返して)行けるか。だめなら理由
function dPreCheck(t, steps) {
  let F = dEndPoint(t, true), R = dEndPoint(t, false);
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i]; if (s.park) return null;
    const r = dStepPlan(F, R, s, steps[i + 1], 0); if (r.err) return r.err;
    F = R = dLegEnd(r.best);
  }
  return null;
}
""")
cut('  const goals = dStationGoals(s.to, L); if (!goals.length) { job.err', '// 段を走る臨時の列車を出す', r"""  const nx = job.steps[job.i + 1];
  // 元の列車の経路にその駅があれば、その経路の続き(時刻表の時刻も使う)。次の段がそこからできるときだけ
  if (first && !t.dyn && s.turn !== true) {
    const k = t.dp.stops.findIndex(x => x.name === s.to && x.m > p.m - 1);
    if (k >= 0) { const st = t.dp.stops[k], fr = Math.min(st.m + Math.max(L / 2, st.half - 5), st.xmax) + 1, s0 = t.dp.m2s(p.m - L / 2), s1 = Math.min(t.route.total, t.dp.m2s(fr)), rt = dRouteSlice(t.route, s0, s1);
      let ok = !nx || nx.park; if (!ok) { const g = rt.segs[rt.segs.length - 1], E1 = { e: g.e, t: g.t1, d: g.d }, g2 = dStationGoals(nx.to, L); ok = g2.length && !!dFindStep(E1, E1, nx, g2).best; }
      if (ok) return { legs: [rt], turn: false, orig: true }; }
  }
  const r = dStepPlan(dEndPoint(t, true), dEndPoint(t, false), s, nx, L);
  if (r.err) { job.err = r.err; return null; }
  return r.best;
}
""")
io.open(p, 'w', encoding='utf-8').write(s); print('ok')
