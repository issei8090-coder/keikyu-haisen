// ===== 独立した検査(運転指令 disp.js の判定の関数・数え方を使わない) =====
// 使ってよいのは「データ」だけ: 配線(N, E, adj)、区間のエッジ(dSecOf)、エッジの実長(dEm)、信号機の置き場所(SIGS の de/u/kind/toE/name)、駅(ST, edgeStation)、列車の計画(t.route, t.sd, t.A, t.P, t.ev, t.names, t.next/prev, cplWith, cut/unit)と、表示に使う位置 t.s。
// 使わないもの: D_OCC, D_LOCK, dFree, dBlock, dPrep(t.dp), dPartner, dLen, D_LOG, D_STAT, ph.lastSig, dAspect など(運転指令の考え違いを、検査も一緒に見逃さないため)。
// node(tools/indep_check.js)からも、ブラウザ(tools/indep_browser.js が注入)からも使う。
function IC_make(opt) {
  opt = opt || {};
  const CARL = opt.carLen || 18, FALL = 25, VIN = (opt.vmaxIn || 130) / 3.6, FOLLOWV = 8;
  const hs = s => { s = Math.round(s); return String(Math.floor(s / 3600)).padStart(2, '0') + ':' + String(Math.floor(s / 60) % 60).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
  const inSec = e => e >= 0 && dSecOf[e] >= 0 && !E[e].portal;
  // ---- 信号機を自前で読む: 有向エッジ → [{p: エッジの a 側からの割合, s}](中継は区切りにならないので除く) ----
  const SIGI = new Map();
  for (const s of SIGS) { if (s.kind === '中継') continue; const L = dEm[s.e] || 1, p = s.d ? 1 - s.u / L : s.u / L; const k = s.e * 2 + s.d; if (!SIGI.has(k)) SIGI.set(k, []); SIGI.get(k).push({ p, s }); }
  // ---- 平面交差(ノードを共有しないのに図の上で交わる区間のエッジ。ダイヤモンドクロッシング・立体交差) ----
  const XS = [];
  { const se = []; for (let e = 0; e < E.length; e++) if (inSec(e)) se.push(e);
    for (let i = 0; i < se.length; i++) for (let j = i + 1; j < se.length; j++) {
      const a = E[se[i]], b = E[se[j]]; if (a.a === b.a || a.a === b.b || a.b === b.a || a.b === b.b) continue;
      const p1 = N[a.a], p2 = N[a.b], q1 = N[b.a], q2 = N[b.b], d = (p2.x - p1.x) * (q2.y - q1.y) - (p2.y - p1.y) * (q2.x - q1.x); if (Math.abs(d) < 1e-9) continue;
      const u = ((q1.x - p1.x) * (q2.y - q1.y) - (q1.y - p1.y) * (q2.x - q1.x)) / d, v = ((q1.x - p1.x) * (p2.y - p1.y) - (q1.y - p1.y) * (p2.x - p1.x)) / d;
      if (u > 0.001 && u < 0.999 && v > 0.001 && v < 0.999) XS.push({ id: XS.length, e1: se[i], p1: u, e2: se[j], p2: v, over: !!(a.over || b.over), x: p1.x + (p2.x - p1.x) * u, y: p1.y + (p2.y - p1.y) * u });
    } }
  const XBY = new Map(); for (const x of XS) for (const [e, p] of [[x.e1, x.p1], [x.e2, x.p2]]) { if (!XBY.has(e)) XBY.set(e, []); XBY.get(e).push({ x, p }); }
  // ---- 経路ごとの表(自前): 実距離、区切り(信号機・区間の入口/出口・終点)、分岐、平面交差 ----
  const RI = new Map();
  function ri(r) {
    let o = RI.get(r); if (o) return o;
    const sg = r.segs, n = sg.length, M = new Float64Array(n + 1); let m = 0;
    for (let i = 0; i < n; i++) { M[i] = m; m += Math.abs(sg[i].t1 - sg[i].t0) * (inSec(sg[i].e) ? dEm[sg[i].e] : (E[sg[i].e].portal ? 0 : E[sg[i].e].len * FALL)); }
    M[n] = m;
    const mAt = (i, p) => M[i] + Math.abs(p - sg[i].t0) * (inSec(sg[i].e) ? dEm[sg[i].e] : E[sg[i].e].len * FALL);
    const bnd = [], nodes = [], xs = [];
    for (let i = 0; i < n; i++) {
      const g = sg[i], ins = inSec(g.e), lo = Math.min(g.t0, g.t1) - 1e-9, hi = Math.max(g.t0, g.t1) + 1e-9;
      const pv = i > 0 ? inSec(sg[i - 1].e) || (E[sg[i - 1].e].portal && i > 1 && inSec(sg[i - 2].e)) : false;
      if (ins && !pv && !E[g.e].portal) bnd.push({ m: M[i], type: 'entry', name: '区間の入口' });
      if (!ins && !E[g.e].portal && i > 0 && (inSec(sg[i - 1].e) || (E[sg[i - 1].e].portal && i > 1 && inSec(sg[i - 2].e)))) bnd.push({ m: M[i], type: 'exit', name: '区間の出口' });
      if (!ins) continue;
      for (const q of SIGI.get(g.e * 2 + g.d) || []) {
        if (q.p < lo || q.p > hi) continue;
        if (q.s.toE != null) { let ok = false; for (let k = i; k < n && M[k] - M[i] < 2500; k++) if (sg[k].e === q.s.toE) { ok = true; break; } if (!ok) continue; }
        bnd.push({ m: mAt(i, q.p), type: 'sig', name: q.s.name, kind: q.s.kind, s: q.s });
      }
      const atEnd = g.d ? g.t1 <= 1e-6 : g.t1 >= 1 - 1e-6; if (atEnd) { const nd = g.d ? E[g.e].a : E[g.e].b; if (adj[nd].filter(f => inSec(f)).length >= 3) nodes.push({ n: nd, m: M[i + 1] }); }
      for (const { x, p } of XBY.get(g.e) || []) if (p >= lo && p <= hi) xs.push({ id: x.id, m: mAt(i, p), over: x.over });
    }
    bnd.push({ m, type: 'end', name: '経路の終わり' });
    bnd.sort((a, b) => a.m - b.m);
    // 同じ位置の区切りは1つに(進路別の信号機が並ぶ所)
    const B = []; for (const b of bnd) { const l = B[B.length - 1]; if (l && Math.abs(l.m - b.m) < 1) { if (b.type === 'sig' && l.type !== 'sig') B[B.length - 1] = b; continue; } B.push(b); }
    o = { r, M, total: m, bnd: B, nodes, xs, mAt };
    RI.set(r, o); return o;
  }
  function s2m(o, s) {
    const r = o.r, sg = r.segs; if (s <= 0) return s * FALL; if (s >= r.total) return o.total + (s - r.total) * FALL;
    let lo = 0, hi = sg.length - 1; while (lo < hi) { const k = (lo + hi) >> 1; if (sg[k].d1 < s) lo = k + 1; else hi = k; }
    const g = sg[lo], L = g.d1 - g.d0; return o.M[lo] + (L > 0 ? (s - g.d0) / L : 0) * (o.M[lo + 1] - o.M[lo]);
  }
  function segIdx(o, x) { const M = o.M; let lo = 0, hi = o.r.segs.length - 1; while (lo < hi) { const k = (lo + hi) >> 1; if (M[k + 1] < x) lo = k + 1; else hi = k; } return lo; }
  // 経路の [a, b](m)→ エッジごとの区間(a 側からの m)
  function spans(o, a, b) {
    const out = [], sg = o.r.segs, M = o.M; if (b <= 0 || a >= o.total) return out;
    for (let i = segIdx(o, Math.max(0, a)); i < sg.length && M[i] < b; i++) {
      const g = sg[i], L = M[i + 1] - M[i]; if (L <= 0) continue; const x0 = Math.max(a, M[i]), x1 = Math.min(b, M[i + 1]); if (x1 <= x0) continue;
      const Em = inSec(g.e) ? dEm[g.e] : E[g.e].len * FALL, p0 = g.t0 + (g.t1 - g.t0) * (x0 - M[i]) / L, p1 = g.t0 + (g.t1 - g.t0) * (x1 - M[i]) / L;
      out.push({ e: g.e, lo: Math.min(p0, p1) * Em, hi: Math.max(p0, p1) * Em, sec: inSec(g.e) });
    }
    return out;
  }
  function figPos(r, s) { const sg = r.segs; s = Math.max(0, Math.min(r.total, s)); let lo = 0, hi = sg.length - 1; while (lo < hi) { const k = (lo + hi) >> 1; if (sg[k].d1 < s) lo = k + 1; else hi = k; } const g = sg[lo], L = g.d1 - g.d0, f = L > 0 ? (s - g.d0) / L : 0; return { x: g.ax + (g.bx - g.ax) * f, y: g.ay + (g.by - g.ay) * f, e: g.e }; }
  // 同じ車両(連結の相手・折り返しの前後・切り離した4両とその元/行き先)
  const partner = (a, b) => a === b || a.next === b || b.next === a || a.prev === b || b.prev === a || a.cplWith === b || b.cplWith === a || a.into === b || b.into === a || !!(a.formed && a.formed.includes(b)) || !!(b.formed && b.formed.includes(a)) || (a.cplWith && b.cplWith && a.cplWith === b.cplWith);
  const Lm = t => Math.max(36, (t.cars || 6) * CARL);
  const kind = t => t.cut ? '切離' : t.unit ? '増結' : '';
  // ---- 状態 ----
  const ST_ = new Map();   // 列車 → {T, r, s, m, sec, ...}
  const FIRST = new Map(), LAST = new Map(), REAP = [], GONE = [];
  const F = { jump: [], back: [], mism: [], dbl: new Map(), dblOut: new Map(), sigpass: [], sigperm: [], blk: new Map(), two: [], stopmiss: [], early: [], arr: [], dep: [], entry: [] };
  const lim = (a, n) => a.length < n;
  let prevAct = new Set(), lastT = NaN, frames = 0;
  function trainVk(t) { if (t._icVk != null) return t._icVk; let v = 0; const sd = t.sd || []; for (let k = 0; k + 1 < sd.length; k++) { const dt = (t.A[k + 1] || 0) - (t.P[k] || 0); if (dt > 1) v = Math.max(v, (sd[k + 1] - sd[k]) / dt); } return t._icVk = v; }
  // 区切り: 前の位置 x より先の最初の区切り
  const nextB = (o, x) => { for (const b of o.bnd) if (b.m > x + 0.01) return b; return o.bnd[o.bnd.length - 1]; };
  const prevB = (o, x) => { let r = null; for (const b of o.bnd) { if (b.m <= x + 0.01) r = b; else break; } return r; };
  function bodyIdx(act) {   // エッジ → [{t, lo, hi}](表示の位置 t.s と列車の長さから)
    const occ = new Map();
    for (const t of act) { const q = ST_.get(t); if (!q) continue; for (const sp of q.body) { if (!occ.has(sp.e)) occ.set(sp.e, []); occ.get(sp.e).push({ t, lo: sp.lo, hi: sp.hi, sec: sp.sec }); } }
    return occ;
  }
  // 区間 [a,b] にほかの列車の体があるか(エッジの重なり・分岐の点に体がかかる・平面交差の点に体がかかる)
  function conflicts(t, o, a, b, occ, ex) {
    const hit = [];
    const sp = spans(o, a, b);
    for (const s of sp) { if (!s.sec) continue; for (const x of occ.get(s.e) || []) { if (x.t === t || partner(x.t, t) || (ex && ex.has(x.t))) continue; if (Math.min(x.hi, s.hi) - Math.max(x.lo, s.lo) > 0.5) hit.push({ o: x.t, how: '線路 e' + s.e }); } }
    for (const nd of o.nodes) { if (nd.m <= a + 0.5 || nd.m >= b - 0.5) continue;
      for (const f of adj[nd.n]) { const Em = dEm[f], atA = E[f].a === nd.n; for (const x of occ.get(f) || []) { if (x.t === t || partner(x.t, t) || (ex && ex.has(x.t))) continue; if (atA ? x.lo < 1 : x.hi > Em - 1) hit.push({ o: x.t, how: '分岐の点 n' + nd.n }); } } }
    for (const c of o.xs) { if (c.m <= a || c.m >= b || c.over) continue; const X = XS[c.id];   // over(立体交差の印)は交わらない
      for (const [e, p] of [[X.e1, X.p1], [X.e2, X.p2]]) { const u = p * dEm[e]; for (const x of occ.get(e) || []) { if (x.t === t || partner(x.t, t) || (ex && ex.has(x.t))) continue; if (x.lo <= u + 2 && x.hi >= u - 2) hit.push({ o: x.t, how: (c.over ? '立体交差?' : '平面交差') + ' x' + c.id }); } } }
    const u = new Map(); for (const h of hit) if (!u.has(h.o)) u.set(h.o, h); return [...u.values()];
  }
  // 1フレームごと(T: 時刻、act: 表示している列車)
  function frame(T, act, note) {
    frames++; const dt = T - lastT, now = new Set(act);
    // 消えた列車
    for (const t of prevAct) if (!now.has(t)) { const q = ST_.get(t), c = t.cplWith || t.into, qc = c && ST_.get(c), cd = q && qc ? Math.hypot(q.fig.x - qc.fig.x, q.fig.y - qc.fig.y) : NaN; LAST.set(t, { T: lastT, s: q ? q.s : t.s, r: t.route, sec: q ? q.sec : false, rest: q ? q.rest : 0, cd, fig: q ? q.fig : null }); ST_.delete(t); }
    // 位置
    const cur = [];
    for (const t of act) {
      if (!t.route || t.s == null || isNaN(t.s)) continue;
      const o = ri(t.route), m = s2m(o, t.s), L = Lm(t), q0 = ST_.get(t);
      const g = figPos(t.route, t.s), sec = inSec(g.e);
      const q = { T, r: t.route, o, s: t.s, m, L, sec, fig: g, body: spans(o, m - L / 2, m + L / 2), rest: t.route.total - t.s, v: q0 && q0.r === t.route && dt > 0 ? (m - q0.m) / dt : 0 };
      if (!FIRST.has(t)) FIRST.set(t, { T, s: t.s, r: t.route, sec, fig: g });
      else if (!q0 && LAST.has(t)) { const l = LAST.get(t), lp = figPos(l.r, l.s); if (REAP.length < 400) REAP.push({ t, T, from: l.T, d: Math.hypot(lp.x - g.x, lp.y - g.y), ds: t.s - l.s }); }
      // 飛び・後戻り
      if (q0 && dt > 0 && dt < 90) {
        if (q0.r === t.route) {
          const dm = m - q0.m, both = q0.sec && sec, allow = both ? VIN * dt + 3 : (Math.max(FOLLOWV, 1.5 * trainVk(t)) * dt + 1.5) * FALL;
          if (dm > allow && lim(F.jump, 300)) F.jump.push({ T, t, dm, allow, sec: both, s0: q0.s, s1: t.s, note });
          if (dm < -1 && lim(F.back, 300)) F.back.push({ T, t, dm, sec: both, s0: q0.s, s1: t.s, note });
        } else { const d = Math.hypot(q0.fig.x - g.x, q0.fig.y - g.y); if (d > 2 && lim(F.jump, 300)) F.jump.push({ T, t, dm: NaN, fig: d, routeChange: true, note }); }
      }
      if (t.ph && Math.abs(t.ph.m - m) > 2 && !t._icMis) { t._icMis = 1; if (lim(F.mism, 100)) F.mism.push({ T, t, phm: t.ph.m, m }); }   // 物理の位置と表示の位置(t.s)が違う
      ST_.set(t, q); cur.push(t);
    }
    // 同じ車両が2か所に(折り返しの前と後ろが同時に見えている)
    for (const t of cur) { const n = t.next; if (n && now.has(n) && ST_.get(n)) { const a = ST_.get(t).fig, b = ST_.get(n).fig, d = Math.hypot(a.x - b.x, a.y - b.y); if (!t._icTwo) { t._icTwo = { T, T1: T, t, n, d, dmax: d }; if (lim(F.two, 400)) F.two.push(t._icTwo); } else { t._icTwo.T1 = T; t._icTwo.dmax = Math.max(t._icTwo.dmax, d); } } }
    const occ = bodyIdx(cur);
    // 二重在線(区間の中: 実距離で体が重なる。区間の外: 図の上で中心が 2 以内)
    for (const [e, l] of occ) { if (l.length < 2) continue; for (let i = 0; i < l.length; i++) for (let j = i + 1; j < l.length; j++) { const a = l[i], b = l[j]; if (a.t === b.t || partner(a.t, b.t)) continue;
      const ov = Math.min(a.hi, b.hi) - Math.max(a.lo, b.lo); const key = [a.t.no, b.t.no].sort().join('/');
      if (a.sec && ov > 0.5) { const x = F.dbl.get(key); if (!x) F.dbl.set(key, { T0: T, T1: T, a: a.t, b: b.t, e, ov, n: 1 }); else { x.T1 = T; x.n++; x.ov = Math.max(x.ov, ov); } }
      else if (!a.sec) { const qa = ST_.get(a.t), qb = ST_.get(b.t); if (qa && qb && !qa.sec && !qb.sec && Math.hypot(qa.fig.x - qb.fig.x, qa.fig.y - qb.fig.y) < 2) { const x = F.dblOut.get(key); if (!x) F.dblOut.set(key, { T0: T, T1: T, a: a.t, b: b.t, e, n: 1, fig: qa.fig, da: qa.r.segs.find(g => g.e === e).d, db: qb.r.segs.find(g => g.e === e) ? qb.r.segs.find(g => g.e === e).d : -1 }); else { x.T1 = T; x.n++; } } } } }
    // 信号機を越えた: 越えた瞬間に、その先の閉塞(次の区切りまで)にほかの列車がいないか
    for (const t of cur) {
      const q = ST_.get(t), p = PREV.get(t); if (!p || p.r !== t.route || !(dt > 0 && dt < 90)) continue;
      const o = q.o, f0 = p.m + q.L / 2, f1 = q.m + q.L / 2; if (f1 <= f0) continue;
      for (const b of o.bnd) { if (b.m <= f0 || b.m > f1) continue; if (b.type !== 'sig' && b.type !== 'entry') continue;
        const nb = nextB(o, b.m), hit = conflicts(t, o, b.m, nb.m, occ);
        if (!hit.length) continue;
        const v = q.v * 3.6, perm = (b.kind === '入換' && v <= 26) || (v <= 16.5 && (b.kind === '場内' || b.kind === '駅内場内' || b.type === 'entry') && hit.every(h => { const qo = ST_.get(h.o); return qo && Math.abs(qo.v) < 0.2 && h.how.startsWith('線路'); }));
        const rec = { T, t, b, nb, v, hit: hit.map(h => h.o.no + (h.o.ph ? '' : '(物理なし)') + ' ' + h.how + ' m=' + Math.round((ST_.get(h.o) || {}).m)), note, ph: !!t.ph, kind: kind(t), m: q.m };
        if (perm) { if (lim(F.sigperm, 300)) F.sigperm.push(rec); } else if (lim(F.sigpass, 300)) F.sigpass.push(rec);
      }
    }
    // 閉塞の重なり: 各列車の「後ろの端から、前の端の先の最初の区切りまで」が、ほかの列車の体と重ならないか(毎フレーム)
    for (const t of cur) {
      const q = ST_.get(t); if (!q.sec) continue; const o = q.o, fr = q.m + q.L / 2, nb = nextB(o, fr), pb = prevB(o, fr);
      const hit = conflicts(t, o, fr, nb.m, occ);
      for (const h of hit) { const key = t.no + '→' + h.o.no; const qo = ST_.get(h.o); const x = F.blk.get(key);
        if (!x) F.blk.set(key, { T0: T, T1: T, t, o: h.o, tph: !!t.ph, oph: !!h.o.ph, how: h.how, from: pb ? pb.name : '?', fromK: pb ? pb.kind || pb.type : '', to: nb.name, vmax: Math.abs(q.v), n: 1, note, ostill: qo && Math.abs(qo.v) < 0.2, pos: Math.round(q.m) + '/' + Math.round(qo ? qo.m : 0) }); else { x.T1 = T; x.n++; x.vmax = Math.max(x.vmax, Math.abs(q.v)); if (!(qo && Math.abs(qo.v) < 0.2)) x.ostill = false; } }
    }
    // 駅: 停まった・発車した時刻(区間の中の停車駅だけ)
    for (const t of cur) {
      const q = ST_.get(t), o = q.o; if (!t.sd || !t.ev || t.unit || t.cut) continue;
      const S = t._icS || (t._icS = t.sd.map((d, k) => { const i = k - t.k0, ev = t.ev[i]; if (!ev || i < 0 || i >= t.names.length) return null; const g = figPos(t.route, d); if (!inSec(g.e)) return null; return { k, i, name: t.names[i], ev, M: s2m(o, d), thru: !!ev.thru, arrT: NaN, depT: NaN, near: false, done: false, last: i === t.names.length - 1, first: i === 0 }; }));
      const still = Math.abs(q.v) < 0.3 && FIRST.get(t).T < T;
      for (const st of S) { if (!st || st.done) continue;
        const at = q.m > st.M - q.L / 2 - 20 && q.m < st.M + 140; if (q.m <= st.M - q.L / 2 - 20) st.came = true; if (FIRST.get(t).T === T && at) st.pre = true;
        if (at) { st.near = true; if (still || (st.first && FIRST.get(t).T === T)) { if (isNaN(st.arrT)) st.arrT = T; st.moveT = NaN; } else if (!isNaN(st.arrT) && isNaN(st.moveT)) st.moveT = T; }   // moveT: 止まったあと初めて動いていたフレーム(発車はその1フレームの間)
        else if (st.near && q.m >= st.M + 140) { st.done = true; st.depT = !isNaN(st.moveT) ? st.moveT : T; fin(t, st); }
      }
    }
    PREV.clear(); for (const t of cur) PREV.set(t, ST_.get(t));
    prevAct = now; lastT = T;
  }
  const PREV = new Map();
  function fin(t, st) {
    if (st.thru) return;
    if (isNaN(st.arrT)) { if (st.came && lim(F.stopmiss, 200)) F.stopmiss.push({ t, name: st.name, ev: st.ev }); return; }
    const aL = st.arrT - (st.ev.arr * 60 + 59), dE = st.depT - st.ev.dep * 60;
    if (!st.first && !st.pre) F.arr.push({ t, name: st.name, late: aL, T: st.arrT });
    if (!st.last) { F.dep.push({ t, name: st.name, late: st.depT - (st.ev.dep * 60 + 59), T: st.depT }); if (dE < -0.5 && lim(F.early, 300)) F.early.push({ t, name: st.name, T: st.depT, dep: st.ev.dep, by: -dE }); }
  }
  // 終わりに: 消えた・現れなかった列車の分類
  function finish(list, H0, H1, isSec) {
    for (const t of prevAct) { const q = ST_.get(t); if (q) LAST.set(t, { T: lastT, s: q.s, r: t.route, sec: q.sec, rest: q.rest, alive: true }); }
    const out = { never: [], mid: [], endNoNext: [], nextFar: [], nextLate: [], cpl: [], ok: 0 };
    for (const t of list) {
      if (!t.route) continue; const sec = isSec(t);
      const f = FIRST.get(t), l = LAST.get(t);
      const due = t.start >= H0 * 3600 + 5 && t.start < H1 * 3600 - 120;   // 窓の中で現れるはずの列車
      if (!f) { if (due && sec) out.never.push(t); continue; }
      if (l.alive) continue;
      const o = ri(t.route), restM = o.total - s2m(o, l.s);
      if (restM > 20) { if ((t.unit || t.cut) && l.cd < 30) { out.cpl.push({ t, T: l.T, cd: l.cd }); continue; } const n = t.next, fn = n && FIRST.get(n), lp = figPos(t.route, l.s); out.mid.push({ t, T: l.T, rest: restM, sec: l.sec, s: l.s, total: t.route.total, end: t.end, fig: l.fig, n, nT: fn ? fn.T : NaN, nd: fn ? Math.hypot(lp.x - fn.fig.x, lp.y - fn.fig.y) : NaN, nfig: fn ? fn.fig : null }); continue; }
      const n = t.next;
      if (!n) { if (sec) out.endNoNext.push({ t, T: l.T, at: t.names[t.names.length - 1] }); continue; }
      const fn = FIRST.get(n);
      if (!fn) { if (sec && l.T < H1 * 3600 - 300) out.nextLate.push({ t, n, T: l.T, nstart: n.start }); continue; }
      const lp = figPos(t.route, l.s), d = Math.hypot(lp.x - fn.fig.x, lp.y - fn.fig.y);
      if (d > 3) out.nextFar.push({ t, n, T: l.T, T2: fn.T, d, from: lp, to: fn.fig });
      else out.ok++;
    }
    return out;
  }
  function report(list, H0, H1, isSec, NV) {
    NV = NV || 12; const L = [], fin_ = finish(list, H0, H1, isSec), no = t => t.no + (t.cut ? '(切離)' : t.unit ? '(増結)' : '');
    const top = (a, n) => a.slice(0, n || NV);
    L.push('フレーム ' + frames);
    L.push('[消える] 一度も現れなかった(区間を通る) ' + fin_.never.length + ' : ' + top(fin_.never).map(t => no(t) + ' ' + hs(t.start) + '〜' + hs(t.end) + ' ' + t.names[0] + '→' + t.names[t.names.length - 1] + (t.prev ? ' 前=' + t.prev.no : '')).join(' | '));
    const art = x => x.n && !isNaN(x.nT) && x.nd <= 5 && x.nT - x.T <= 10 && x.end - x.T < 10;   // コマの切れ目: 終わりの時刻の直前のコマで見えたのが最後で、次の列車がすぐそばに続いた(DT が大きいときに出る。消えてはいない)
    const artN = fin_.mid.filter(art).length; fin_.mid = fin_.mid.filter(x => !art(x));
    L.push('[消える] 経路の途中(残り20m超)で見えなくなった(コマの切れ目 ' + artN + ' 件を除く) ' + fin_.mid.length + ' (区間の中で ' + fin_.mid.filter(x => x.sec).length + ') : ' + top(fin_.mid.sort((a, b) => b.sec - a.sec)).map(x => hs(x.T) + ' ' + no(x.t) + ' 残り' + Math.round(x.rest) + 'm' + (x.sec ? '[区間内]' : '[区間外]') + ' end=' + hs(x.end) + (x.fig ? ' 図(' + Math.round(x.fig.x) + ',' + Math.round(x.fig.y) + ')' : '') + (x.n ? (isNaN(x.nT) ? ' 次の ' + x.n.no + ' は現れず' : ' → 次の ' + x.n.no + ' が ' + hs(x.nT) + ' に図(' + Math.round(x.nfig.x) + ',' + Math.round(x.nfig.y) + ')に現れた(' + x.nd.toFixed(0) + '離れて)') : '')).join(' | ') + ' / 連結・切り離しで相手と一緒になった ' + fin_.cpl.length);
    L.push('[消える] 区間を通る列車が終点で消え、折り返しの相手が無い ' + fin_.endNoNext.length + ' : ' + Object.entries(fin_.endNoNext.reduce((a, x) => (a[x.at] = (a[x.at] || 0) + 1, a), {})).map(x => x.join(' ')).join(', '));
    L.push('[消える] 終点に着いたが、折り返しの列車が窓の中で現れない ' + fin_.nextLate.length + ' : ' + top(fin_.nextLate).map(x => hs(x.T) + ' ' + no(x.t) + '→' + x.n.no + '(予定 ' + hs(x.nstart) + ')').join(' | '));
    L.push('[ワープ] 折り返しの前と後ろで位置が違う(図で3より遠い) ' + fin_.nextFar.length + ' : ' + top(fin_.nextFar).map(x => hs(x.T) + ' ' + no(x.t) + '→' + x.n.no + ' ' + hs(x.T2) + ' 距離' + x.d.toFixed(1) + ' (' + Math.round(x.from.x) + ',' + Math.round(x.from.y) + ')→(' + Math.round(x.to.x) + ',' + Math.round(x.to.y) + ')').join(' | '));
    const two = F.two.slice().sort((a, b) => (b.T1 - b.T) - (a.T1 - a.T) || b.dmax - a.dmax); L.push('[二か所] 折り返しの前と後ろが同時に見えている ' + F.two.length + ' (5秒以上 ' + F.two.filter(x => x.T1 - x.T >= 5).length + '、離れて ' + F.two.filter(x => x.dmax > 1).length + ') : ' + top(two).map(x => hs(x.T) + '〜' + hs(x.T1) + ' ' + no(x.t) + '+' + no(x.n) + ' 距離' + x.dmax.toFixed(1)).join(' | '));
    L.push('[再出現] 一度消えてまた現れた ' + REAP.length + ' : ' + top(REAP).map(x => hs(x.from) + '→' + hs(x.T) + ' ' + no(x.t) + ' 図で' + x.d.toFixed(1) + ' s' + (x.ds >= 0 ? '+' : '') + x.ds.toFixed(1)).join(' | '));
    const jin = F.jump.filter(x => x.sec), jout = F.jump.filter(x => !x.sec);
    L.push('[ワープ] 1フレームで動ける距離を超えた: 区間の中 ' + jin.length + ' 区間の外 ' + jout.length + ' : ' + top(jin.concat(jout)).map(x => hs(x.T) + ' ' + no(x.t) + (x.routeChange ? ' 経路が変わり図で' + x.fig.toFixed(1) : ' ' + Math.round(x.dm) + 'm(上限' + Math.round(x.allow) + ') s ' + x.s0.toFixed(1) + '→' + x.s1.toFixed(1)) + (x.sec ? '[区間内]' : '[区間外]') + (x.note ? ' ' + x.note : '')).join(' | '));
    L.push('[後戻り] ' + F.back.length + ' (区間内 ' + F.back.filter(x => x.sec).length + ') : ' + top(F.back).map(x => hs(x.T) + ' ' + no(x.t) + ' ' + Math.round(x.dm) + 'm s ' + x.s0.toFixed(1) + '→' + x.s1.toFixed(1) + (x.sec ? '[区間内]' : '[区間外]') + (x.note ? ' ' + x.note : '')).join(' | '));
    L.push('[表示と物理のずれ] ph.m と t.s が2m超違う ' + F.mism.length + ' : ' + top(F.mism).map(x => hs(x.T) + ' ' + no(x.t) + ' ph.m=' + Math.round(x.phm) + ' 表示=' + Math.round(x.m)).join(' | '));
    const dbl = [...F.dbl.values()].sort((a, b) => b.n - a.n);
    L.push('[二重在線] 区間の中で体が重なった組 ' + dbl.length + ' : ' + top(dbl).map(x => hs(x.T0) + '〜' + hs(x.T1) + ' ' + no(x.a) + (x.a.ph ? '' : '(外)') + '/' + no(x.b) + (x.b.ph ? '' : '(外)') + ' e' + x.e + ' 最大' + Math.round(x.ov) + 'm ' + x.n + '回').join(' | '));
    const dbo = [...F.dblOut.values()].sort((a, b) => b.n - a.n);
    L.push('[二重在線(区間の外・図)] 中心が図で2以内 ' + dbo.length + ' : ' + top(dbo, 8).map(x => hs(x.T0) + '〜' + hs(x.T1) + ' ' + no(x.a) + '/' + no(x.b) + ' ' + x.n + '回 図(' + Math.round(x.fig.x) + ',' + Math.round(x.fig.y) + ') e' + x.e + (x.da === x.db ? ' 同じ向き' : ' 逆向き')).join(' | '));
    L.push('[冒進?] 先の閉塞にほかの列車がいるのに信号機・区間の入口を越えた ' + F.sigpass.length + ' : ' + top(F.sigpass).map(x => hs(x.T) + ' ' + no(x.t) + (x.ph ? '' : '(物理なし)') + ' ' + x.b.name + '@' + Math.round(x.b.m) + ' ' + Math.round(x.v) + 'km/h 先=' + x.hit.join(',')).join(' | '));
    L.push('[誘導・入換らしい] 止まっている列車のいる閉塞へ25km/h以下で ' + F.sigperm.length + ' : ' + top(F.sigperm, 6).map(x => hs(x.T) + ' ' + no(x.t) + ' ' + x.b.name + ' ' + Math.round(x.v) + 'km/h 先=' + x.hit.join(',')).join(' | '));
    const blk = [...F.blk.values()].sort((a, b) => b.n - a.n);
    const okB = x => (x.fromK === '入換' && x.vmax * 3.6 <= 26) || (x.vmax * 3.6 <= 16.5 && x.ostill), bperm = blk.filter(okB), bbad = blk.filter(x => !okB(x));
    L.push('[同じ閉塞に2本] 前の端から次の区切りまでに、ほかの列車の体: ' + bbad.length + ' (ゆっくり・相手が止まっている ' + bperm.length + ') : ' + top(bbad).map(x => hs(x.T0) + '〜' + hs(x.T1) + ' ' + no(x.t) + (x.tph ? '' : '(物理なし)') + '→' + no(x.o) + (x.oph ? '' : '(物理なし)') + ' ' + x.how + ' [' + x.from + '→' + x.to + '] 最高' + Math.round(x.vmax * 3.6) + 'km/h m=' + x.pos).join(' | '));
    L.push('[停車駅を通過] ' + F.stopmiss.length + ' : ' + top(F.stopmiss).map(x => no(x.t) + ' ' + x.name + ' ' + x.ev.arr).join(' | '));
    L.push('[早発] 時刻表の分より前に発車 ' + F.early.length + ' : ' + top(F.early).map(x => hs(x.T) + ' ' + no(x.t) + ' ' + x.name + ' 発' + Math.floor(x.dep / 60) + ':' + String(x.dep % 60).padStart(2, '0') + ' の ' + Math.round(x.by) + '秒前').join(' | '));
    const q = (a, f) => a.filter(f).length, mx = a => a.length ? Math.max(...a.map(x => x.late)) : 0;
    L.push('[時刻] 着(公式の分の59秒まで) ' + F.arr.length + ' 過ぎた ' + q(F.arr, x => x.late > 0) + ' 1分超 ' + q(F.arr, x => x.late > 60) + ' 2分超 ' + q(F.arr, x => x.late > 120) + ' 最大 ' + Math.round(mx(F.arr)) + 's | 発 ' + F.dep.length + ' 過ぎた ' + q(F.dep, x => x.late > 0) + ' 1分超 ' + q(F.dep, x => x.late > 60) + ' 最大 ' + Math.round(mx(F.dep)) + 's');
    L.push('  着の遅れ上位: ' + F.arr.slice().sort((a, b) => b.late - a.late).slice(0, 8).map(x => no(x.t) + ' ' + x.name + ' +' + Math.round(x.late) + 's@' + hs(x.T)).join(' | '));
    return { text: L.join('\n'), fin: fin_, F, REAP };
  }
  return { frame, report, finish, F, ri, s2m, XS, partner, hs, inSec };
}
if (typeof module !== 'undefined') module.exports = { IC_make };
