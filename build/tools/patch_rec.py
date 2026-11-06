# 基準の走りの順を固定する(2026-11-06、ユーザー「基準の走りの順を固定」)
#  tools/mkorder.js が自動の順序変更ありで1日走らせ、分岐を通った時刻・区間に入った時刻・待避を実際にしたかを記録(fix/order_日_範囲.json.gz)
#  dispPlan の最後で、記録がある所は時刻表の時刻の代わりに記録の時刻で順を決める(D_NODEQ・D_ENTQ の T)。待避は、基準で待たなかった組を外す
#  鍵は 列車のキー(ttUKey)|分岐の点|その列車がその点を通る何回目か(計画を直しても、変わらない列車の分はそのまま使える)
import io, os, shutil
p = 'src/disp.js'; b = '_tmp/disp.js.before_rec'
if not os.path.exists(b): shutil.copy(p, b)
raw = io.open(p, encoding='utf-8', newline='').read(); crlf = '\r\n' in raw; s = raw.replace('\r\n', '\n')
if 'D_REC' in s: raise SystemExit('already')
def rep(a, c):
    global s
    if s.count(a) != 1: raise SystemExit('nf: ' + a[:70] + ' %d' % s.count(a))
    s = s.replace(a, c)
rep("function dispPlan(list) {",
"""let D_REC = null;   // 基準の走りの記録 { n: Map(鍵 → 分岐を通った秒), e: Map(鍵 → 区間に入った秒), w: Map(鍵 → 1 待避した / 0 待たずに出た) }(src/fixload.js が入れる)
const dRecKey = o => typeof ttUKey === 'function' ? ttUKey(o) : o.no;
function dRecApply() {   // dispPlan の最後: 鍵を付け、記録があれば時刻と待避を置き換える
  const R = D_REC; let nN = 0, nE = 0, nW = 0;
  for (const [nd, q] of D_NODEQ) for (const c of q) { if (c.key == null) continue; const v = R && R.n.get(c.key); if (v != null) { c.T0 = c.T; c.T = v; c.R = true; nN++; } }
  for (const [, q] of D_NODEQ) q.sort((a, b) => a.T - b.T);
  for (const c of D_ENTQ) { const v = R && R.e.get(c.key); if (v != null) { c.T0 = c.T; c.T = v; c.R = true; nE++; } }
  D_ENTQ.sort((a, b) => a.T - b.T);
  if (R) for (const t of dRecList) { if (!t.dWait) continue; for (const ks of Object.keys(t.dWait)) { const w = t.dWait[ks].filter(c => R.w.get(dRecKey(t) + '|' + ks + '|' + dRecKey(c.o)) !== 0); nW += t.dWait[ks].length - w.length; if (w.length) t.dWait[ks] = w; else delete t.dWait[ks]; } if (!Object.keys(t.dWait).length) t.dWait = null; }
  D_REC_STAT = R ? { node: nN, ent: nE, waitDrop: nW } : null;
}
let dRecList = [], D_REC_STAT = null;
function dispPlan(list) {
  dRecList = list;""")
rep("""      if (!D_NODEQ.has(nd)) D_NODEQ.set(nd, []); D_NODEQ.get(nd).push({ o, d: g.d1, T });
    }
  }""","""      if (!D_NODEQ.has(nd)) D_NODEQ.set(nd, []); const ok = dRecKey(o) + '|' + nd, oc = (occ.get(ok) || 0) + 1; occ.set(ok, oc); D_NODEQ.get(nd).push({ o, d: g.d1, T, key: ok + '|' + oc });
    }
  }""")
rep("""  D_NODEQ.clear();
  for (const o of list) {""","""  D_NODEQ.clear(); const occ = new Map();
  for (const o of list) {""")
rep("""if (i > 0) { const T = dKnT(o, segs[i].d0); if (!isNaN(T)) D_ENTQ.push({ o, ri, d: segs[i].d0, T }); } ri++; }
  }
  D_ENTQ.sort((a, b) => a.T - b.T);
  return n;""","""if (i > 0) { const T = dKnT(o, segs[i].d0); if (!isNaN(T)) D_ENTQ.push({ o, ri, d: segs[i].d0, T, key: dRecKey(o) + '|e' + ri }); } ri++; }
  }
  D_ENTQ.sort((a, b) => a.T - b.T);
  dRecApply();
  return n;""")
# 分岐の順: 自分の時刻も記録から(同じ点の自分の項目)。両方とも記録なら、30秒以内でも記録の順のまま
rep("    const tT = dKnT(t, t.dp.m2s(m)); if (isNaN(tT)) continue;",
    "    const sm = t.dp.m2s(m), own = q.find(c => c.o === t && Math.abs(c.d - sm) < 1.5), tT = own && own.R ? own.T : dKnT(t, sm); if (isNaN(tT)) continue;")
rep("      if (c.T > tT - 30 && c.o !== t) { const f = dFirstAtNext(c.o, c.T, t, tT);",
    "      if (own && own.R && c.R) { if (c.T >= tT) continue; }   // 基準の走りの順\n      else if (c.T > tT - 30 && c.o !== t) { const f = dFirstAtNext(c.o, c.T, t, tT);")
if crlf: s = s.replace('\n', '\r\n')
io.open(p, 'w', encoding='utf-8', newline='').write(s); print('ok')
