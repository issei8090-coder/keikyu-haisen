# 運転指令: 単線の方向(方向てこ)(2026-11-05)
#  京急久里浜〜YRP野比の単線で、上り 553H と下り 560H が両側から入って向かい合い、約1時間止まった(全線の運転指令で「普通が待避しない」の元。
#  三崎口方面の上りが何十分も遅れ、待避駅で「抜く列車が5分以上遅れる → 普通を先に出す」になっていた)。
#  信号機ごとの区間(閉塞)しか見ていなかったので、反対向きの列車がそれぞれ単線の途中まで進路を取れた。
#  ここでは: 区間の中で上下両方向に使われる線(ホームでない・行き止まりでない)を、次数2の点でつながる「単線のまとまり」にし、
#            列車が進路を取るとそのまとまりの向きを押さえる。押さえている列車がまとまりを出る(進路も在線も無くなる)まで、反対向きの列車は進路を取れない。
#  使い方: build フォルダで python tools/patch_sgl.py(前の版 _tmp/disp.js.before_sgl)
import io, os, shutil
p = 'src/disp.js'
b = '_tmp/disp.js.before_sgl'
if not os.path.exists(b): shutil.copy(p, b)
raw = io.open(b, encoding='utf-8', newline='').read(); crlf = '\r\n' in raw; s = raw.replace('\r\n', '\n')
def R(a, c):
    global s
    if a not in s: raise SystemExit('見つからない: ' + a[:80])
    s = s.replace(a, c, 1)

R("function dFree(t, b, yudoOK, order, shunt) {\n  let res = 1; t.dWhy = ''; t.dByT = null;",
  """// 単線のまとまり: エッジ → { run, o }(o = そのエッジの a→b がまとまりの向きの +1 か -1)。run.lock = { dir, hold: Set(列車) }
const D_SGL = new Map();
function dSglBuild(list) {
  D_SGL.clear(); const dirs = new Map();
  for (const t of list) { if (!t.route || !t.route.segs) continue; for (const g of t.route.segs) { if (dSecOf[g.e] < 0 || E[g.e].portal) continue; const v = g.t1 > g.t0 ? 1 : g.t1 < g.t0 ? 2 : 0; if (v) dirs.set(g.e, (dirs.get(g.e) || 0) | v); } }
  const ok = e => dirs.get(e) === 3 && isNaN(stopX[e]) && adj[E[e].a].length > 1 && adj[E[e].b].length > 1;
  let nRun = 0;
  for (const [e0] of dirs) { if (D_SGL.has(e0) || !ok(e0)) continue;
    const run = { id: e0, lock: null, edges: [e0] }; D_SGL.set(e0, { run, o: 1 }); nRun++;
    for (const fwd of [true, false]) {   // b の側へ(向き +)、a の側へ(向き -)のばす
      let prev = e0, n = fwd ? E[e0].b : E[e0].a;
      for (let g = 0; g < 400 && adj[n].length === 2; g++) { const f = adj[n][0] === prev ? adj[n][1] : adj[n][0]; if (D_SGL.has(f) || !ok(f)) break;
        const o = fwd ? (E[f].a === n ? 1 : -1) : (E[f].b === n ? 1 : -1); D_SGL.set(f, { run, o }); run.edges.push(f); prev = f; n = E[f].a === n ? E[f].b : E[f].a; } } }
  return nRun;
}
const dSglHas = (run, h) => run.edges.some(e => (D_LOCK.get(e) || []).some(k => k.t === h) || (D_OCC.get(e) || []).some(o => o.t === h));
function dSglBlocked(t, b) {   // 反対向きに押さえている列車(いなければ null)
  for (const sp of b.spans) { const S = D_SGL.get(sp.e); if (!S) continue; const L = S.run.lock; if (!L) continue;
    const g = t.route.segs[sp.i], d = Math.sign(g.t1 - g.t0) * S.o; if (!d || L.dir === d) continue;
    for (const h of [...L.hold]) if (h === t || dPartner(h, t) || !dSglHas(S.run, h)) L.hold.delete(h);
    if (!L.hold.size) { S.run.lock = null; continue; }
    return L.hold.values().next().value; }
  return null;
}
function dSglLock(t, b) {
  for (const sp of b.spans) { const S = D_SGL.get(sp.e); if (!S) continue; const g = t.route.segs[sp.i], d = Math.sign(g.t1 - g.t0) * S.o; if (!d) continue;
    const L = S.run.lock; if (!L || L.dir !== d) S.run.lock = { dir: d, hold: new Set([t]) }; else L.hold.add(t); }
}
function dFree(t, b, yudoOK, order, shunt) {
  let res = 1; t.dWhy = ''; t.dByT = null;
  { const o = dSglBlocked(t, b); if (o) { t.dWhy = '単線 ' + o.no; t.dByT = o; return 0; } }   // 単線を反対向きに押さえている列車がいる""")
R("function dLock(t, b, kind) {\n", "function dLock(t, b, kind) {\n  dSglLock(t, b);\n")
R("  { const dir = new Map(); D_BI.clear();", "  D_SGLN = dSglBuild(list);   // 単線のまとまり(方向てこ)\n  { const dir = new Map(); D_BI.clear();")
R("const D_BI = new Set();", "const D_BI = new Set();\nlet D_SGLN = 0;   // 単線のまとまりの数")
s = s.replace("D_LOCK.clear(); D_LOCKN.clear();", "D_LOCK.clear(); D_LOCKN.clear(); for (const [, S] of D_SGL) S.run.lock = null;")
if crlf: s = s.replace('\n', '\r\n')
io.open(p, 'w', encoding='utf-8', newline='').write(s); print('ok')
