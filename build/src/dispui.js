// ===== 運転指令の画面: 区間ごとの実距離配線図(信号機・在線・進路) =====
const board = $('board');
let dTab = 0, dSel = null, dSelSig = null, dView = 'map', dDrawT = 0;
const D_KMPX = 420, D_YS = 6.6, D_TOP = 72;   // D_TOP: 駅名の下に、上側の信号機・列車の札が入る余白
const ASP_COL = { R: ['#ff3b30'], KD: ['#f2f2f2'], YY: ['#ffcc00', '#ffcc00'], Y: ['#ffcc00'], YG: ['#ffcc00', '#2ee66b'], YGF: ['#ffcc00', '#2ee66b'], G: ['#2ee66b'], SH: ['#f2f2f2'] };
const ASP_NAME = { R: '停止', KD: '誘導', YY: '警戒', Y: '注意', YG: '減速', YGF: '抑速', G: '進行', SH: '入換進行' };
const dTabs = [];
DSEC.forEach((sec, si) => sec.tabs.forEach((tb, ti) => { const T = { si, name: tb.name, km0: tb.km[0], km1: tb.km[1] }; T.parts = [{ si, km0: T.km0, km1: T.km1, off: 0, dy: 0 }]; for (const q of tb.inc || []) { const s2 = DSEC.findIndex(x => x.id === q.sec); if (s2 >= 0 && s2 !== si) T.parts.push({ si: s2, km0: q.km[0], km1: q.km[1], off: q.off || 0, dy: q.dy || 0, ends: q.ends || null }); } dTabs.push(T); }));   // inc: ほかの区間の一部をはめ込む(区間の計算はそのまま、画面だけ)
const dPart = (tb, si) => tb.parts.find(p => p.si === si);
const dInTab = (tb, si, km, tol = 0) => { const p = dPart(tb, si); return !!p && km >= p.km0 - tol && km <= p.km1 + tol; };
function dTabGeom(tb) {
  let y0 = Infinity, y1 = -Infinity;
  for (const P of tb.parts) for (const e of DSEC[P.si].edges) { const a = E[e].a, b = E[e].b; if (Math.max(dKm[a], dKm[b]) < P.km0 || Math.min(dKm[a], dKm[b]) > P.km1) continue; y0 = Math.min(y0, dBy[a] + P.dy, dBy[b] + P.dy); y1 = Math.max(y1, dBy[a] + P.dy, dBy[b] + P.dy); }
  tb.y0 = y0; tb.y1 = y1; tb.W = (tb.km1 - tb.km0) * D_KMPX; tb.H = (y1 - y0) * D_YS + D_TOP + 56;
  tb.X = (km, si) => { const P = si == null ? tb.parts[0] : dPart(tb, si) || tb.parts[0]; return (km + P.off - tb.km0) * D_KMPX; };
  tb.Y = (by, si) => { const P = si == null ? tb.parts[0] : dPart(tb, si) || tb.parts[0]; return (by + P.dy - y0) * D_YS + D_TOP; };
}
dTabs.forEach(dTabGeom);
const gB = { static: null, lock: null, occ: null, sig: null, lab: null };
const dSigEl = new Map();
function dBuildBoard() {
  const tb = dTabs[dTab], sec = DSEC[tb.si];
  board.innerHTML = ''; dSigEl.clear();
  board.setAttribute('viewBox', `-20 0 ${tb.W + 40} ${tb.H}`); board.setAttribute('width', tb.W + 40); board.setAttribute('height', tb.H);
  gB.static = el('g', {}, board); gB.lock = el('g', {}, board); gB.occ = el('g', {}, board); gB.sig = el('g', {}, board); gB.lab = el('g', {}, board);
  // キロ程の目盛り
  for (let k = Math.ceil(tb.km0 * 2) / 2; k <= tb.km1; k += 0.5) {
    const x = tb.X(k), major = Math.abs(k - Math.round(k)) < 1e-6;
    el('line', { x1: x, y1: tb.H - 30, x2: x, y2: tb.H - (major ? 20 : 25), class: 'bk-tick' }, gB.static);
    if (major) el('text', { x, y: tb.H - 8, class: 'bk-km' }, gB.static, (sec.sc.kmNeg ? Math.abs(k) : k).toFixed(1) + 'km');   // kmNeg: キロ程の符号を反転して載せた区間(都営浅草線)
  }
  el('line', { x1: tb.X(tb.km0), y1: tb.H - 30, x2: tb.X(tb.km1), y2: tb.H - 30, class: 'bk-tick' }, gB.static);
  // ホームと駅名
  for (const P of tb.parts) { const sec = DSEC[P.si]; for (const [nm, info] of sec.stInfo) {
    if (info.km + info.len / 2000 < P.km0 || info.km - info.len / 2000 > P.km1) continue;
    const s = stByName.get(nm), dy = sec.sc.rows[info.row].dy, x0 = tb.X(info.km - info.len / 2000, P.si), x1 = tb.X(info.km + info.len / 2000, P.si);
    let top = Infinity;
    for (const p of s.plats) { const y0 = tb.Y(p[1] + dy, P.si), y1 = tb.Y(p[3] + 1 + dy, P.si); top = Math.min(top, y0); el('rect', { x: x0, y: y0 + 3, width: x1 - x0, height: Math.max(3, y1 - y0 - 6), class: 'bk-plat' }, gB.static); }
    el('text', { x: (x0 + x1) / 2, y: 18, class: 'bk-st' }, gB.static, nm);
    el('text', { x: (x0 + x1) / 2, y: 31, class: 'bk-stkm' }, gB.static, (sec.sc.kmNeg ? Math.abs(info.km) : info.km).toFixed(1) + 'km');
  } }
  // 線路
  let d = '';
  for (const P of tb.parts) for (const e of DSEC[P.si].edges) {
    const a = E[e].a, b = E[e].b; if (E[e].portal) continue;
    if (Math.max(dKm[a], dKm[b]) < P.km0 - 0.05 || Math.min(dKm[a], dKm[b]) > P.km1 + 0.05) continue;
    d += `M${tb.X(dKm[a], P.si).toFixed(1)} ${tb.Y(dBy[a], P.si).toFixed(1)}L${tb.X(dKm[b], P.si).toFixed(1)} ${tb.Y(dBy[b], P.si).toFixed(1)}`;
  }
  // ほかの区間とのつなぎ目(泉岳寺 ⇔ 都営浅草線): 両側とも画面にあれば線でつなぐ(計算上の長さは0。キロ程は disp.js の dInit で実距離に合わせてある)
  if (tb.parts.length > 1) for (const [na, nb] of D.portals) {
    const sa = adj[na].map(f => dSecOf[f]).find(x => x >= 0), sb = adj[nb].map(f => dSecOf[f]).find(x => x >= 0);
    if (sa == null || sb == null || sa === sb || !dInTab(tb, sa, dKm[na], 0.05) || !dInTab(tb, sb, dKm[nb], 0.05)) continue;
    d += `M${tb.X(dKm[na], sa).toFixed(1)} ${tb.Y(dBy[na], sa).toFixed(1)}L${tb.X(dKm[nb], sb).toFixed(1)} ${tb.Y(dBy[nb], sb).toFixed(1)}`;
  }
  el('path', { d, class: 'bk-track' }, gB.static);
  // はめ込んだ部分で途中で切れている線の行き先(inc の ends: { hi: 右の端, lo: 左の端 })
  for (const P of tb.parts) { if (!P.ends) continue; for (const side of ['lo', 'hi']) { const txt = P.ends[side]; if (!txt) continue;
    const kB = side === 'hi' ? P.km1 : P.km0, ys = [];
    for (const e of DSEC[P.si].edges) { const a = E[e].a, b = E[e].b; if (E[e].portal) continue; const lo = Math.min(dKm[a], dKm[b]), hi = Math.max(dKm[a], dKm[b]); if (lo < kB && hi > kB) { const f = (kB - dKm[a]) / (dKm[b] - dKm[a]); ys.push(dBy[a] + (dBy[b] - dBy[a]) * f); } }
    if (!ys.length) continue; const y = (Math.min(...ys) + Math.max(...ys)) / 2, x = tb.X(kB, P.si) + (side === 'hi' ? 46 : -46);
    el('text', { x, y: tb.Y(y, P.si) + 4, class: 'bk-ends', 'text-anchor': side === 'hi' ? 'start' : 'end' }, gB.static, side === 'hi' ? txt + ' →' : '← ' + txt); } }
  // 区間の外へつながる所
  for (const P of tb.parts) for (const n of DSEC[P.si].bnd) { if (dKm[n] < P.km0 || dKm[n] > P.km1) continue; el('circle', { cx: tb.X(dKm[n], P.si), cy: tb.Y(dBy[n], P.si), r: 2.6, class: 'bk-bnd' }, gB.static); }
  // 信号機(同じ場所に複数あるときは縦に並べる)
  { const grp = new Map(); for (const s of SIGS) { const k = s.de + ':' + Math.round(s.u / 4); if (!grp.has(k)) grp.set(k, []); grp.get(k).push(s); } for (const L of grp.values()) dStackLayout(L); }
  for (const s of SIGS) {
    if (!dInTab(tb, s.sec, s.km)) continue;
    const g = el('g', { class: 'bk-sig' + (s.kind === '閉塞' ? ' blk' : '') + (s.spec && !s.spec.est ? ' usr' : ' est') + (dEdit && D_SIGWARN.has(s) ? ' warn' : '') }, gB.sig);
    dSigGlyph(s, g, tb);
    if (dEdit && D_SIGWARN.has(s)) { const dir = s.down === false ? -1 : 1; el('text', { x: dir > 0 ? -16 : 16, y: 3.5, class: 'bk-warn' }, g, '!'); }
    el('title', {}, g, `${s.name}\n${s.km.toFixed(3)}km(${dSigWhere(s)})` + (D_SIGWARN.has(s) ? '\n' + D_SIGWARN.get(s).map(m => '! ' + m).join('\n') : ''));
    g.addEventListener('click', ev => { ev.stopPropagation(); if (dDragJust) return; dSelectSig(s); });
    g.addEventListener('pointerdown', ev => { if (!dEdit || ev.button !== 0) return; ev.stopPropagation(); dDrag = { s, g, x0: ev.clientX, y0: ev.clientY, moved: false, to: null }; });
  }
  if (dEdit) for (const w of D_LOCWARN) {   // 守られていない分岐
    if (!dInTab(tb, w.sec, w.km)) continue;
    const g = el('g', { class: 'bk-locw', transform: `translate(${tb.X(w.km, w.sec).toFixed(1)} ${(tb.Y(w.by, w.sec) + (w.down ? -9 : 9)).toFixed(1)})` }, gB.sig);
    el('circle', { r: 5.5 }, g); el('text', { y: 3.5 }, g, '!'); el('title', {}, g, w.msg);
  }
  board.classList.toggle('editing', dEdit);
  document.querySelectorAll('#btabs button').forEach((b, i) => b.classList.toggle('on', i === dTab));
  dSigBar();
  dDraw(true);
}
const dSigWhere = s => s.spec ? (s.spec.est ? '推定の位置のまま' : '指定した位置') : '推定の位置';
const SIG_MARK = { '場内': '場', '駅内場内': '内', '出発': '出', '閉塞': '閉', '入換': '入', '中継': '中' };
// 信号機の絵(実物に近い形)。灯の並びはユーザー提供の図(二灯式・三灯式・四灯式(A)(B)・五灯式(A))のまま。入換=台形3灯、誘導=斜め2灯、中継=丸に7灯。
// 単位は灯の半径=1 で、D_SIGK 倍して描く。下り(図の上側)は上へ、上り(図の下側)は下へ積む(各部品の上下はそのまま)
const D_SIGK = 2.4, D_SIGSTACK = 'h';   // 同じ場所に複数: 'h' = 1本の腕に横に並べる、'v' = 同じ柱に縦に重ねる
const SIG_LAMPS = {
  '5抑': { l: ['Y', 'Y', 'R', 'Y', 'G'], on: { R: [2], YY: [0, 3], Y: [3], YG: [1, 4], YGF: [1, 4], G: [4] } },
  '5灯': { l: ['Y', 'Y', 'R', 'Y', 'G'], on: { R: [2], YY: [0, 3], Y: [3], YG: [1, 4], G: [4] } },
  '4警': { l: ['Y', 'R', 'G', 'Y'], on: { R: [1], YY: [0, 3], Y: [3], G: [2] } },
  '4減': { l: ['Y', 'R', 'Y', 'G'], on: { R: [1], Y: [2], YG: [0, 3], G: [3] } },
  '3灯': { l: ['G', 'Y', 'R'], on: { R: [2], Y: [1], G: [0] } },
  '2注': { l: ['Y', 'R'], on: { R: [1], Y: [0] } },
  '2進': { l: ['G', 'R'], on: { R: [1], G: [0] } },
};
const LAMP_COL = { R: '#ff3b30', Y: '#ffd60a', G: '#30e070', W: '#ffe2a0' }, LAMP_OFF = '#565b63';
const RELAY_P = { T: [0, -2.05], UR: [1.46, -1.46], L: [-2.05, 0], C: [0, 0], R: [2.05, 0], LL: [-1.46, 1.46], B: [0, 2.05] };
const dLampSet = s => SIG_LAMPS[s.spec && s.spec.h] || SIG_LAMPS['5抑'];
const dSigHasYudo = s => (dIsHome(s.kind) || s.kind === '入換') && !(s.spec && s.spec.yudo === false);
// 柱の根元から外へ順の部品。p.y = 根元から部品の近い側の端まで
function dSigParts(s) {
  const P = [];
  if (dSigHasYudo(s)) P.push({ t: 'yudo', h: 5.6, w: 5.6 });
  if (s.kind === '入換') P.push({ t: 'shunt', h: 4.75, w: 6.2 });
  else if (s.kind === '中継') P.push({ t: 'relay', h: 6.7, w: 6.7 });
  else P.push({ t: 'head', h: (dLampSet(s).l.length - 1) * 2.2 + 4.1, w: 4.4 });
  let y = 2.2; for (const p of P) { p.y = y; y += p.h + .35; }
  return { P, H: y - .35, W: Math.max(...P.map(p => p.w)) };
}
// 同じ場所の信号機の並べ方。左の線路へ向かうもの(下り=図の上、上り=図の下)ほど外側・左に
function dStackLayout(L) {
  for (const s of L) { s.stX = 0; s.stY = 0; s.stArm = null; s.stLift = 0; }
  if (L.length < 2) return;
  const up = L[0].down !== false, K = D_SIGK, ty = s => s.spec && s.spec.to ? s.spec.to.y : (up ? 1e9 : -1e9);
  const A = [...L].sort((a, b) => up ? ty(a) - ty(b) : ty(b) - ty(a));
  const D = A.map(dSigParts);
  if (D_SIGSTACK === 'v') {   // 同じ柱に縦: 線路から遠いほど左の線路
    let y = 0; for (let i = A.length - 1; i >= 0; i--) { A[i].stY = y; y += (D[i].H - 2.2 + .6) * K; }
    return;
  }
  const gap = .9 * K, W = D.map(d => d.W * K), tot = W.reduce((a, b) => a + b, 0) + gap * (W.length - 1), arm = 2.4 * K;
  const order = up ? A.map((_, i) => i) : A.map((_, i) => A.length - 1 - i);
  let x = -tot / 2; const cx = [];
  for (const i of order) { cx[i] = x + W[i] / 2; x += W[i] + gap; }
  const x0 = Math.min(...cx), x1 = Math.max(...cx);
  // 高さ: 2基なら左を少し低く、3基なら真ん中を少し高く(実物に多い形)。A[0] が左の線路
  A.forEach((s, i) => { s.stX = cx[i]; s.stArm = { h: arm, x0, x1 }; s.stLift = (A.length === 2 || A.length === 3) && i === 1 ? 2.2 * K : 0; });
}
function dSigGlyph(s, g, tb) {
  const up = s.down !== false, sg = up ? -1 : 1, K = D_SIGK, D = dSigParts(s), sx = s.stX || 0, sy = s.stY || 0, arm = s.stArm;
  const NS = { 'vector-effect': 'non-scaling-stroke' };
  g.setAttribute('transform', `translate(${tb.X(s.km, s.sec).toFixed(1)} ${(tb.Y(s.by, s.sec) + sg * 2).toFixed(1)})`);
  // 腕(横に並べるとき)・柱
  if (arm) { el('line', { x1: 0, y1: 0, x2: 0, y2: sg * arm.h, class: 'bk-post' }, g); el('line', { x1: arm.x0, y1: sg * arm.h, x2: arm.x1, y2: sg * arm.h, class: 'bk-post' }, g); }
  const root = arm ? arm.h + (s.stLift || 0) : sy;
  if (arm && s.stLift) el('line', { x1: sx, y1: sg * arm.h, x2: sx, y2: sg * root, class: 'bk-post' }, g);
  if (!arm && sy) el('line', { x1: 0, y1: 0, x2: 0, y2: sg * sy, class: 'bk-post' }, g);
  const q = el('g', { transform: `translate(${sx.toFixed(1)} ${(sg * root).toFixed(1)}) scale(${K})` }, g);
  const last = D.P[D.P.length - 1];
  el('line', { x1: 0, y1: 0, x2: 0, y2: sg * (last.y + last.h / 2), class: 'bk-post', ...NS }, q);
  const o = { g, L: [], Y: null, t: last.t, key: '' };
  const lamp = (p, cx, cy, r, col, id, paint) => {
    el('circle', { cx, cy, r, fill: paint ? '#0b0b0b' : LAMP_OFF }, p); if (paint) return;
    const lg = el('g', { class: 'bk-lit', style: 'display:none' }, p);
    el('circle', { cx, cy, r: r * 1.7, fill: col, opacity: .22 }, lg); el('circle', { cx, cy, r, fill: col }, lg);
    return lg;
  };
  for (const P of D.P) {
    const p = el('g', { transform: `translate(0 ${(up ? -(P.y + P.h) : P.y).toFixed(2)})` }, q);
    if (P.t === 'yudo') {   // 誘導: 出すときだけ見せる(場所は空けておく)
      p.style.display = 'none'; o.Y = p;
      el('line', { x1: -1.35, y1: 4.2, x2: 1.35, y2: 1.4, stroke: '#6b7686', 'stroke-width': 3.7, 'stroke-linecap': 'round' }, p);
      el('line', { x1: -1.35, y1: 4.2, x2: 1.35, y2: 1.4, stroke: '#05070a', 'stroke-width': 3.1, 'stroke-linecap': 'round' }, p);
      for (const [x, y] of [[-1.35, 4.2], [1.35, 1.4]]) { el('circle', { cx: x, cy: y, r: .85, fill: LAMP_COL.W }, p); }
    } else if (P.t === 'shunt') {
      el('path', { d: 'M-1.7 0H1.7Q2.2 0 2.35 .6L3.1 4.4Q3.15 4.75 2.8 4.75H-2.8Q-3.15 4.75 -3.1 4.4L-2.35 .6Q-2.2 0 -1.7 0Z', class: 'bk-head', ...NS }, p);
      [[0, 1.55], [-1.55, 3.3], [1.55, 3.3]].forEach(([x, y], i) => o.L.push({ id: i, el: lamp(p, x, y, .85, LAMP_COL.W, i) }));
    } else if (P.t === 'relay') {
      el('circle', { cx: 0, cy: 3.35, r: 3.35, class: 'bk-head', ...NS }, p);
      for (const [k, [x, y]] of Object.entries(RELAY_P)) o.L.push({ id: k, el: lamp(p, x, 3.35 + y, .72, LAMP_COL.W, k) });
    } else {
      const H = dLampSet(s), noG = s.spec && s.spec.noG; o.ls = H;
      el('rect', { x: -2.2, y: 0, width: 4.4, height: P.h, rx: 2.2, class: 'bk-head', ...NS }, p);
      H.l.forEach((c, i) => {   // 進行なし: 進行だけに使う灯は黒く塗る
        const paint = noG && c === 'G' && Object.entries(H.on).every(([a, v]) => a === 'G' || !v.includes(i));
        const lg = lamp(p, 0, 2.05 + i * 2.2, 1, LAMP_COL[c], i, paint); if (lg) o.L.push({ id: i, el: lg });
      });
    }
  }
  if (dEdit) el('text', { x: sx + D.W * K / 2 + 3, y: sg * (root + D.H * K * .6) + 3, class: 'bk-sigk', 'text-anchor': 'start' }, g, (SIG_MARK[s.kind] || '') + (s.spec && s.spec.to ? '→' : ''));
  dSigEl.set(s, o);
}
function dLamps(s, o, blink) {
  const a = s.asp || 'R'; let on, bl = false;
  if (o.t === 'shunt') on = a !== 'R' && a !== 'KD' ? [0, 1] : [1, 2];
  else if (o.t === 'relay') on = a === 'R' ? ['L', 'C', 'R'] : a === 'G' ? ['T', 'C', 'B'] : ['UR', 'C', 'LL'];
  else {
    const H = o.ls; let k = a === 'KD' || a === 'SH' ? 'R' : a;
    if (!H.on[k]) { const i = ASP_ORD.indexOf(k); k = ASP_ORD.slice(i + 1).find(x => H.on[x]) || ASP_ORD.slice(0, Math.max(0, i)).reverse().find(x => H.on[x]) || 'R'; }
    on = H.on[k]; bl = k === 'YGF';
  }
  const key = a + (bl && !blink ? '0' : '1');
  if (o.key === key) return; o.key = key;
  for (const L of o.L) L.el.style.display = on.includes(L.id) && !(bl && !blink) ? '' : 'none';
  if (o.Y) o.Y.style.display = a === 'KD' ? '' : 'none';
}
// 列車の位置(経路上の m)のキロ程
function dKmAt(t, mm) { const fr = t.dp.spans(mm - 1, mm).pop(); if (!fr) return null; const e = E[fr.e], f = (fr.lo + fr.hi) / 2 / dEm[fr.e]; return dKm[e.a] + (dKm[e.b] - dKm[e.a]) * f; }
// 経路上の [a,b](m) を図の線にする
// 経路の外(始まりより前・終わりより先)へ、同じ線の上で延ばせる長さ(m)。車庫・引上線で経路が列車より短いときに使う
function dExtAvail(t) {
  const dp = t.dp; if (dp.extA) return dp.extA; const sg = t.route.segs; if (!sg.length) return (dp.extA = [0, 0]);
  const g0 = sg[0], g1 = sg[sg.length - 1], b0 = g0.t1 >= g0.t0 ? g0.t0 : 1 - g0.t0, f1 = g1.t1 >= g1.t0 ? 1 - g1.t1 : g1.t1;
  return (dp.extA = [dSecOf[g0.e] >= 0 ? b0 * dEm[g0.e] : 0, dSecOf[g1.e] >= 0 ? f1 * dEm[g1.e] : 0]);
}
function dExtSeg(t, back, o0, o1, tb) {   // 経路の端から o0〜o1(m) 先(back なら手前)の線
  const sg = t.route.segs, g = back ? sg[0] : sg[sg.length - 1], si = dSecOf[g.e], P = dPart(tb, si); if (!P || o1 <= o0) return '';
  const e = E[g.e], Em = dEm[g.e], sgn = g.t1 >= g.t0 ? 1 : -1, pe = back ? g.t0 : g.t1, at = o => Math.max(0, Math.min(1, pe + (back ? -sgn : sgn) * o / Em)), p0 = at(o0), p1 = at(o1); if (Math.abs(p1 - p0) * Em < 0.5) return '';
  const km = f => dKm[e.a] + (dKm[e.b] - dKm[e.a]) * f, by = f => dBy[e.a] + (dBy[e.b] - dBy[e.a]) * f;
  return `M${tb.X(km(p0), si).toFixed(1)} ${tb.Y(by(p0), si).toFixed(1)}L${tb.X(km(p1), si).toFixed(1)} ${tb.Y(by(p1), si).toFixed(1)}`;
}
function dPath(t, a, b, tb) {
  let d = '';
  if (a < 0) d += dExtSeg(t, true, Math.max(0, -b), -a, tb);
  if (b > t.dp.total) d += dExtSeg(t, false, Math.max(0, a - t.dp.total), b - t.dp.total, tb);
  for (const s of t.dp.spans(a, b)) {
    const si = dSecOf[s.e], P = dPart(tb, si); if (!P) continue;
    const e = E[s.e], Em = dEm[s.e], f0 = s.lo / Em, f1 = s.hi / Em;
    const km = f => dKm[e.a] + (dKm[e.b] - dKm[e.a]) * f, by = f => dBy[e.a] + (dBy[e.b] - dBy[e.a]) * f;
    if (P !== tb.parts[0] && (Math.max(km(f0), km(f1)) < P.km0 - 0.05 || Math.min(km(f0), km(f1)) > P.km1 + 0.05)) continue;   // はめ込んだ部分は、その範囲だけ
    d += `M${tb.X(km(f0), si).toFixed(1)} ${tb.Y(by(f0), si).toFixed(1)}L${tb.X(km(f1), si).toFixed(1)} ${tb.Y(by(f1), si).toFixed(1)}`;
  }
  return d;
}
const dFmtLate = s => s < 30 ? '' : '+' + Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
function dDraw(force) {
  if (dView !== 'disp') return;
  const now = performance.now(); if (!force && now - dDrawT < 120) return; dDrawT = now;
  const tb = dTabs[dTab]; if (!gB.occ) return;
  gB.lock.innerHTML = ''; gB.occ.innerHTML = ''; gB.lab.innerHTML = '';
  // 確保された進路(緑)
  let dl = '';
  for (const [e, l] of D_LOCK) {
    const si = dSecOf[e], P = dPart(tb, si); if (!P) continue; const ed = E[e], Em = dEm[e];
    for (const k of l) { const f0 = k.lo / Em, f1 = k.hi / Em; const km = f => dKm[ed.a] + (dKm[ed.b] - dKm[ed.a]) * f, by = f => dBy[ed.a] + (dBy[ed.b] - dBy[ed.a]) * f;
      if (Math.max(km(f0), km(f1)) < P.km0 || Math.min(km(f0), km(f1)) > P.km1) continue;
      dl += `M${tb.X(km(f0), si).toFixed(1)} ${tb.Y(by(f0), si).toFixed(1)}L${tb.X(km(f1), si).toFixed(1)} ${tb.Y(by(f1), si).toFixed(1)}`; }
  }
  el('path', { d: dl, class: 'bk-lock' }, gB.lock);
  let dOcc = '';   // 在線: 列車のいる閉塞(前後の信号機の間)の線路を赤く
  // 列車(実際の長さ)とラベル
  const labs = [];
  for (const t of ttActive || []) {
    if (!t.route || !t.g) continue; const dp = dPrep(t); if (!dp.ranges.some(r => tb.parts.some(P => r.secs ? r.secs.has(P.si) : r.sec === P.si))) continue;
    const L = t.ph ? t.ph.L : dLen(t); let m = t.ph ? t.ph.m : dp.s2m(t.s);
    { const [eb, ef] = dExtAvail(t);   // 経路の終わり(引上線・留置線の行き止まり)より先へははみ出さない: はみ出した分が描かれず、列車が縮んで見えていた。車庫に置く列車は経路が列車より短いので、同じ線の上へ延ばして描く
      if (m + L / 2 > dp.total + ef) m = dp.total + ef - L / 2; if (m - L / 2 < -eb) m = Math.min(-eb + L / 2, dp.total + ef - L / 2); }
    const d = dPath(t, m - L / 2, m + L / 2, tb); if (!d) continue;
    const ty = TYPES[t.shown || t.type];
    const g = el('g', { class: 'bk-train' + (t === dSel ? ' sel' : '') }, gB.occ);
    // 1両ずつ区切って描く(12両は8+4の継ぎ目を広く。4両の側は、増結の前後 t.cpl が無ければ南=浦賀方と推定)
    const F = m + L / 2, n = t.cut || t.unit ? 4 : Math.max(1, t.cars || Math.round(L / DTR.carLen)), cl = L / n;
    let jt = -1;
    if (n === 12) { const kf = dKmAt(t, F), kr = dKmAt(t, F - L); const south4 = !(t.cpl && t.cpl.side === 'front'); jt = kf != null && kr != null && (kf > kr) === south4 ? 4 : 8; }
    if (t === dSel) el('path', { d, class: 'bk-selc' }, g);
    for (let i = 0; i < n; i++) { const dc = dPath(t, F - (i + 1) * cl + (i + 1 === jt ? 3 : 1.2), F - i * cl - (i === jt ? 3 : 1.2), tb); if (dc) el('path', { d: dc, class: 'bk-car', stroke: ty.color }, g); }
    if (!dp.sigB || dp.sigB.src !== dp.sig) { dp.sigB = dp.sig.filter(x => x.s.kind !== '中継'); dp.sigB.src = dp.sig; }
    { let a = F - L - 400, z = F + 400; for (const x of dp.sigB) { if (x.m <= F - L) a = Math.max(a, x.m); else if (x.m >= F) { z = Math.min(z, x.m); break; } } dOcc += dPath(t, Math.max(a, F - L - 400), z, tb); }
    g.addEventListener('click', ev => { ev.stopPropagation(); dSelect(t); });
    // 車庫・留置線で止まっている列車: 札を上下に出すと隣の線の列車に重なって隠すので、列車の後ろ(行き止まり側)の横に小さく
    if (t.yard && !t.ph) { const bb = g.getBBox(); if (bb.width + bb.height > 0) {
      const fr0 = dp.spans(0, Math.min(dp.total, 5))[0], g0 = fr0 && t.route.segs[fr0.i], e0 = fr0 && E[fr0.e], right = !g0 || (g0.t1 > g0.t0) === (dKm[e0.b] > dKm[e0.a]);
      const yl = el('text', { x: right ? bb.x - 4 : bb.x + bb.width + 4, y: bb.y + bb.height / 2 + 3.4, class: 'bk-yardl' + (t === dSel ? ' sel' : ''), 'text-anchor': right ? 'end' : 'start', fill: ty.color }, gB.lab, t.no || TYPES[t.type].short);
      yl.addEventListener('click', ev => { ev.stopPropagation(); dSelect(t); }); } continue; }
    // ラベルは先頭の位置に
    const fr = dp.spans(m + L / 2 - 1, m + L / 2).pop(); if (!fr) continue;
    const e = E[fr.e], f = (fr.lo + fr.hi) / 2 / dEm[fr.e], km = dKm[e.a] + (dKm[e.b] - dKm[e.a]) * f, by = dBy[e.a] + (dBy[e.b] - dBy[e.a]) * f;
    if (!dInTab(tb, dSecOf[fr.e], km, 0.2)) continue;
    const g0 = t.route.segs[fr.i], right = (g0.t1 > g0.t0) === (dKm[e.b] > dKm[e.a]);
    labs.push({ t, x: tb.X(km, dSecOf[fr.e]), y: tb.Y(by, dSecOf[fr.e]), right, ty });
  }
  if (dOcc) el('path', { d: dOcc, class: 'bk-occb' }, gB.lock);
  // ラベルの重なりを上下にずらす
  labs.sort((a, b) => a.x - b.x);
  const placed = [];
  for (const L of labs) {
    const w = 84, up = L.right; let y = L.y + (up ? -22 : 22);
    for (let k = 0; k < 6; k++) { if (!placed.some(p => Math.abs(p.x - L.x) < w && Math.abs(p.y - y) < 15)) break; y += up ? -15 : 15; }
    placed.push({ x: L.x, y });
    const t = L.t, p = t.ph, late = p ? p.delay : 0, sp = p ? Math.round(p.v * 3.6) : null;
    const g = el('g', { class: 'bk-lab' + (t === dSel ? ' sel' : ''), transform: `translate(${L.x.toFixed(1)} ${y.toFixed(1)})` }, gB.lab);
    el('line', { x1: 0, y1: 0, x2: 0, y2: (L.y - y) * 0.8, class: 'bk-labline' }, g);
    const txt = `${t.no || TYPES[t.type].short}${sp != null ? ' ' + sp : ''}`, lt = dFmtLate(late);
    el('rect', { x: L.right ? -w + 4 : -4, y: -8, width: w, height: 15, rx: 3, class: 'bk-labbox', stroke: L.ty.color }, g);
    el('text', { x: L.right ? -w + 8 : 0, y: 3.6, class: 'bk-labt', fill: L.ty.color }, g, txt);
    if (lt) el('text', { x: L.right ? 0 : w - 8, y: 3.6, class: 'bk-late', 'text-anchor': 'end' }, g, lt);
    g.addEventListener('click', ev => { ev.stopPropagation(); dSelect(t); });
  }
  // 信号機の現示
  const blink = Math.floor(Date.now() / 375) % 2 === 0;
  for (const [s, o] of dSigEl) {
    dLamps(s, o, blink);
    o.g.classList.toggle('man', !!s.man); o.g.classList.toggle('sel', s === dSelSig);
  }
  dPanel();
}
function dSelect(t) { dSel = t; dSelSig = null; if (t && typeof ttSelect === 'function') ttSelect(t); dDraw(true); }
function dSelectSig(s) { dSelSig = s; dSel = null; dDraw(true); }
// 右側の運転指令パネル
function dPanel() {
  const box = $('dispbox'); if (!box) return;
  const t = dSel && dSel.g ? dSel : null, s = dSelSig;
  let h = '';
  if (t) {
    const p = t.ph, ty = TYPES[t.shown || t.type], r = ttRun(t);
    h += `<div class="dp-title" style="color:${ty.color}">${ty.name} ${shortDest(t.dest)}行き　${t.no || ''}</div><div class="dp-sub">運行番号 ${r.num || '-'} ${r.co || ''}車　${t.cars || '?'}両</div>`;
    if (p) {
      const dp = t.dp, nx = dp.sig.slice(p.lastSig + 1).find(x => x.m > p.m + p.L / 2), st = dp.stops[p.k];
      const a = nx ? nx.s.asp : null;
      h += `<table class="dp-tab"><tr><th>速度</th><td><b>${Math.round(p.v * 3.6)}</b> km/h</td></tr>` +
        `<tr><th>状態</th><td>${p.mode === 'dwell' ? (st && st.name ? st.name + ' 停車中' : '停車中') : p.v < 0.1 ? '停止' + (p.why ? '(' + p.why + ')' : '') : '走行中'}${p.hold ? '・抑止中' : ''}</td></tr>` +
        (() => { const od = dOffDelay(t, D_NOW); return `<tr><th>遅れ</th><td class="${od > 60 ? 'late' : ''}">${od <= 0 ? '定時' : (od >= 60 ? Math.floor(od / 60) + '分' : '') + Math.floor(od % 60) + '秒'}<span class="dp-sub">(時刻表の分に対して)</span></td></tr>`; })() +
        `<tr><th>次の信号</th><td>${nx ? `<span class="dp-asp a-${a}">${ASP_NAME[a] || ''}</span> ${nx.s.name}(${Math.round(nx.m - p.m - p.L / 2)}m先)` : 'なし'}</td></tr>` +
        `<tr><th>次の停車</th><td>${st && st.name ? `${st.name} ${hm(Math.floor(st.A / 60))}着(${Math.round(st.m - p.m)}m先)` : '-'}</td></tr></table>` +
        `<div class="btns"><button id="dphold">${p.hold ? '抑止を解除' : '抑止する'}</button></div>`;
    } else h += `<p class="dp-sub">この区間の外を走行中(時刻表どおりの位置)</p>`;
  } else if (s && dEdit) {
    const sp = s.spec;
    h += `<div class="dp-title">信号機を編集</div><div class="dp-sub">${s.name}・${s.km.toFixed(3)}km(${dSigWhere(s)})</div>` +
      `<div class="se-row"><span>種類</span>${SIG_KINDS.map(k => `<button data-sk="${k}" class="${s.kind === k ? 'on' : ''}">${k}</button>`).join('')}</div>` +
      `<div class="se-row"><span>向き</span><button data-sd="1" class="${dDn(s.de) ? 'on' : ''}">下り →</button><button data-sd="0" class="${dDn(s.de) ? '' : 'on'}">← 上り</button></div>` +
      `<div class="se-row"><span>灯</span><button data-sh="" class="${sp && sp.h ? '' : 'on'}">全部</button>${Object.entries(SIG_HEADS).map(([k, H]) => `<button data-sh="${k}" class="${sp && sp.h === k ? 'on' : ''}" title="${H.a.map(a => ASP_NAME[a]).join('・')}">${H.name}</button>`).join('')}</div>` +
      `<div class="se-row"><span>進行</span><button data-sg="0" class="${sp && sp.noG ? '' : 'on'}">出す</button><button data-sg="1" class="${sp && sp.noG ? 'on' : ''}" title="進行の灯を黒く塗った信号機。進行のときは一つ下の現示を出す">進行なし(黒塗り)</button></div>` +
      `<p class="dp-sub">出せる現示: ${dHeadText(sp)}</p>` +
      ((dIsHome(s.kind) || s.kind === '入換') ? `<div class="se-row"><span>誘導</span><button data-sy="1" class="${sp && sp.yudo === false ? '' : 'on'}">誘導信号機あり</button><button data-sy="0" class="${sp && sp.yudo === false ? 'on' : ''}">なし</button></div>` : '') +
      `<div class="se-row"><span>進路</span><button data-sr="-1" class="${sp && sp.to ? '' : 'on'}">全部の進路</button>${dRouteOpts(s).map((o, i) => `<button data-sr="${i}" class="${sp && sp.to && s.toE === (o.de >> 1) ? 'on' : ''}">${o.n}</button>`).join('') || '<span class="dp-sub">この先に分岐がありません</span>'}</div>` +
      (s.toE === -1 ? `<p class="dp-sub" style="color:#ff7a7a">指定の進路の線が見つかりません(配線が変わった?)</p>` : '') +
      `<p class="dp-sub">進路を選ぶと、その進路へ進む列車にだけかかります。同じ場所に進路ごとの信号機を並べるときに使います。</p>` +
      (() => { const sib = dSiblings(s), used = new Set(sib.map(x => x.toE).filter(x => x != null)), ro = dRouteOpts(s);
        return `<div class="se-row"><span>同じ場所に</span>${ro.map((o, i) => used.has(o.de >> 1) ? '' : `<button data-sa="${i}" title="この信号機と同じ位置・同じ種類で、この進路用の信号機を足します">＋ ${o.n}</button>`).join('')}<button data-sa="-1">＋ もう1基</button></div>` +
          (sib.length > 1 ? `<p class="dp-sub">この場所の信号機 ${sib.length}基: ${sib.map(x => `<a href="#" data-ss="${SIGS.indexOf(x)}" style="${x === s ? 'font-weight:bold' : ''}">${x.kind}${x.spec && x.spec.to ? '(' + x.spec.to.n + ')' : '(全部)'}</a>`).join('・')}</p>` : ''); })() +
      `<div class="se-row"><span>位置</span><input id="sekm" type="number" step="0.001" value="${s.km.toFixed(4)}"> km</div>` +
      `<div class="se-row"><span>動かす</span>${[-50, -10, -1, 1, 10, 50].map(d => `<button data-sm="${d}">${d > 0 ? '+' : ''}${d}m</button>`).join('')}</div>` +
      `<p class="dp-sub">+ は列車の進む向き(信号機の先)へ。図の上でドラッグしても動かせます。</p>` +
      (D_SIGWARN.has(s) ? `<ul class="se-warn">${D_SIGWARN.get(s).map(m => `<li>${m}</li>`).join('')}</ul>` : '<p class="dp-sub" style="color:#7fd18b">規定の目安から外れているところはありません</p>') +
      `<div class="btns">${sp && sp.est ? '<button id="seok">この位置で確定</button>' : ''}<button id="sedel" class="danger">この信号機を消す</button></div>`;
  } else if (s) {
    h += `<div class="dp-title">${s.name}</div><div class="dp-sub">${s.km.toFixed(3)}km・${s.down == null ? '' : s.down ? '下り方向' : '上り方向'}(${dSigWhere(s)})</div>` +
      `<p>現示: <span class="dp-asp a-${s.asp}">${ASP_NAME[s.asp] || s.asp}</span>${s.asp && ASP[s.asp] != null && s.asp !== 'R' ? ' ' + ASP[s.asp] + 'km/h' : ''}</p>` +
      `<p class="dp-sub">灯: ${s.spec && SIG_HEADS[s.spec.h] ? SIG_HEADS[s.spec.h].name : '指定なし'}${s.spec && s.spec.noG ? '・進行なし' : ''}(${dHeadText(s.spec)})</p>` +
      `<div class="btns"><button id="dpman">${s.man ? '停止の指示を解除' : '停止を指示する'}</button></div>`;
  } else if (dEdit) {
    const tb = dTabs[dTab], ws = SIGS.filter(x => dInTab(tb, x.sec, x.km) && D_SIGWARN.has(x)).sort((a, b) => a.km - b.km), lw = D_LOCWARN.filter(w => dInTab(tb, w.sec, w.km)).sort((a, b) => a.km - b.km);
    h += `<div class="dp-title">置き方の確かめ</div><p class="dp-sub">規定の目安から外れている信号機 ${ws.length}基・守られていない分岐 ${lw.length}か所(図の ! 印)</p>` +
      `<ul class="se-warn">${(() => { const G = []; for (const x of ws) { const k = x.km.toFixed(3) + x.name + D_SIGWARN.get(x).join(); const g = G.find(q => q.k === k); if (g) g.n++; else G.push({ k, x, n: 1 }); } return G; })().slice(0, 60).map(({ x, n }) => `<li data-wi="${SIGS.indexOf(x)}" style="cursor:pointer"><b>${x.km.toFixed(3)}km ${x.name}${n > 1 ? `(並んだ線に ${n}基)` : ''}</b>: ${D_SIGWARN.get(x).join(' / ')}</li>`).join('')}${lw.slice(0, 30).map(w => `<li>${w.msg}</li>`).join('')}</ul>`;
    h += `<p class="dp-sub">信号機の編集中: 線路をクリックすると、上の「置く種類」「向き」の信号機を置きます。信号機をクリックすると種類・向き・位置を直せます(ドラッグで移動、Delete キーで削除)。変えるとすぐに運転に反映され、このブラウザに保存されます。</p>`;
  }
  else h += `<p class="dp-sub">図の列車か信号機をクリックすると、ここに詳しく表示します。</p>`;
  const ev = D_EV.slice(-12).reverse();
  h += `<h2 style="margin-top:12px">最近の出来事</h2><ul class="dp-ev">${ev.map(e => `<li class="k-${e.kind}"><span>${hm(Math.floor(e.T / 60))}</span>${e.no} ${e.text}</li>`).join('') || '<li>なし</li>'}</ul>` +
    `<p class="dp-sub">非常ブレーキ ${D_STAT.emer}・信号冒進 ${D_STAT.spad}・2分以上の停止 ${D_STAT.sigwait}</p>`;
  if (box._h !== h) {
    box.innerHTML = h; box._h = h;
    const b1 = $('dphold'); if (b1) b1.onclick = () => { if (t && t.ph) { t.ph.hold = !t.ph.hold; dDraw(true); } };
    box.querySelectorAll('[data-wi]').forEach(li => li.onclick = () => dSelectSig(SIGS[+li.dataset.wi]));
    const b2 = $('dpman'); if (b2) b2.onclick = () => { if (s) { s.man = !s.man; dSigShow(ttActive || []); dDraw(true); } };
    if (s && dEdit) {
      box.querySelectorAll('[data-sk]').forEach(b => b.onclick = () => { const sp = dSpecFor(s); sp.k = b.dataset.sk; delete sp.est; dSigApply(sp); });
      box.querySelectorAll('[data-sd]').forEach(b => b.onclick = () => {
        const dn = +b.dataset.sd; if (dn === dDn(s.de)) return; const sp = dSpecFor(s);
        if (!dSigLocate(s.sec, sp.km, sp.y, dn)) { dSigMsg('この線路は' + (dn ? '下り' : '上り') + '方向には走れません'); return; }
        sp.dn = dn; delete sp.est; dSigApply(sp); });
      box.querySelectorAll('[data-sm]').forEach(b => b.onclick = () => dSigMoveBy(s, +b.dataset.sm));
      box.querySelectorAll('[data-sy]').forEach(b => b.onclick = () => { const sp = dSpecFor(s); if (+b.dataset.sy) delete sp.yudo; else sp.yudo = false; delete sp.est; dSigApply(sp); });
      box.querySelectorAll('[data-sr]').forEach(b => b.onclick = () => {
        const sp = dSpecFor(s), i = +b.dataset.sr;
        if (i < 0) delete sp.to; else { const o = dRouteOpts(s)[i], P = dPosOf(o.de, dEm[o.de >> 1] / 2); sp.to = { km: dR4(P.km), y: dR2(P.y), dn: dDn(o.de), n: o.n }; }
        delete sp.est; dSigApply(sp); });
      box.querySelectorAll('[data-sa]').forEach(b => b.onclick = () => {
        const sp0 = dSpecFor(s), i = +b.dataset.sa, sp = { k: sp0.k, km: sp0.km, y: sp0.y, dn: sp0.dn };
        if (sp0.h) sp.h = sp0.h; if (sp0.yudo === false) sp.yudo = false; if (sp0.noG) sp.noG = true;
        if (i >= 0) { const o = dRouteOpts(s)[i], P = dPosOf(o.de, dEm[o.de >> 1] / 2); sp.to = { km: dR4(P.km), y: dR2(P.y), dn: dDn(o.de), n: o.n }; }   // 元の信号機が「全部の進路」のままなら、足した進路以外(残りの進路)を受け持つ
        dSecList(s.sec).push(sp); dSigMsg(i >= 0 && !sp0.to ? '同じ場所に足しました(「全部の進路」の信号機は残りの進路を受け持ちます)' : '同じ場所に信号機を足しました'); dSigApply(sp); });
      box.querySelectorAll('[data-ss]').forEach(a => a.onclick = ev => { ev.preventDefault(); dSelectSig(SIGS[+a.dataset.ss]); });
      box.querySelectorAll('[data-sg]').forEach(b => b.onclick = () => { const sp = dSpecFor(s); if (+b.dataset.sg) sp.noG = true; else delete sp.noG; delete sp.est; dSigApply(sp); });
      box.querySelectorAll('[data-sh]').forEach(b => b.onclick = () => { const sp = dSpecFor(s); if (b.dataset.sh) sp.h = b.dataset.sh; else delete sp.h; delete sp.est; dSigApply(sp); });
      const ik = $('sekm'); if (ik) ik.onchange = () => { const k = +ik.value; if (isFinite(k)) dSigMoveBy(s, (k - s.km) * 1000 * (dDn(s.de) ? 1 : -1)); };
      const bo = $('seok'); if (bo) bo.onclick = () => { const sp = dSpecFor(s); delete sp.est; dSigApply(sp); };
      const bd = $('sedel'); if (bd) bd.onclick = () => dSigDelete(s);
    }
  }
}
// 同じ場所(同じ線・同じ向き・4m以内)にある信号機
function dSiblings(s) { return SIGS.filter(x => x.sec === s.sec && x.de === s.de && Math.abs(x.u - s.u) < 4); }
// ===== 信号機の編集(手で置く)。一覧は区間ごとに D_SIGMAN.list[区間id] = [{k 種類, km, y 元の図の縦位置, dn 1=下り}] =====
let dEdit = false, dEdKind = '閉塞', dEdHead = '', dEdDn = 1, dDrag = null, dDragJust = false, dEdMsg = '';
const dR4 = x => Math.round(x * 1e4) / 1e4, dR2 = x => Math.round(x * 100) / 100;
const dHeadText = sp => dHeadAv(sp).map(a => ASP_NAME[a]).join('・');
function dSpecAt(de, u, k) { const P = dPosOf(de, u); return { k, km: dR4(P.km), y: dR2(P.y), dn: dDn(de) }; }
// この区間の一覧(まだ無ければ、いまの推定の信号機から作る)
function dSecList(si) {
  const id = DSEC[si].id;
  if (!D_SIGMAN) D_SIGMAN = { saved: 0, list: {} };
  if (!D_SIGMAN.list[id]) D_SIGMAN.list[id] = SIGS.filter(s => s.sec === si).map(s => { const sp = dSpecAt(s.de, s.u, s.kind); sp.est = 1; s.spec = sp; return sp; });
  return D_SIGMAN.list[id];
}
function dSpecFor(s) { dSecList(s.sec); return s.spec; }
function dSigSave() { D_SIGMAN.saved = Date.now(); try { localStorage.setItem(D_SIGKEY, JSON.stringify(D_SIGMAN)); } catch (e) { } }
// 一覧を保存して信号機を置き直す(列車は今の位置のまま、進路を取り直す)
function dSigApply(selSp) {
  dSigSave(); dRebuildSignals(ttList); if (typeof ttActive !== 'undefined') dSigShow(ttActive || []);
  dSelSig = selSp ? SIGS.find(s => s.spec === selSp) || null : null; dSel = null;
  if (D_SIGLOST.length) dSigMsg(`線路の見つからない信号機が ${D_SIGLOST.length} 基あります`);
  dBuildBoard();
}
function dSigMsg(t) { dEdMsg = t; const m = $('sigmsg'); if (m) m.textContent = t; }
function dSigMoveBy(s, dm) { const sp = dSpecFor(s), p = dShift(s.de, s.u, dm), n = dSpecAt(p.de, p.u, sp.k); Object.assign(sp, { km: n.km, y: n.y, dn: n.dn }); delete sp.est; dSigApply(sp); }
function dSigDelete(s) { const L = dSecList(s.sec), i = L.indexOf(dSpecFor(s)); if (i >= 0) L.splice(i, 1); dSigApply(null); }
// 画面の点 → いちばん近い線路(向き dn に走れるもの)
function dPick(ev, dn) {
  const tb = dTabs[dTab], pt = board.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
  const q = pt.matrixTransform(board.getScreenCTM().inverse());
  let best = null, bd = 14;
  for (const P of tb.parts) for (const e of DSEC[P.si].edges) {
    if (E[e].portal) continue; let d = -1; for (const x of [0, 1]) if (dAllowed(e, x) && dDn(e * 2 + x) === dn) d = x; if (d < 0) continue;
    const a = E[e].a, b = E[e].b; if (Math.max(dKm[a], dKm[b]) < P.km0 - 0.05 || Math.min(dKm[a], dKm[b]) > P.km1 + 0.05) continue;
    const ax = tb.X(dKm[a], P.si), ay = tb.Y(dBy[a], P.si), dx = tb.X(dKm[b], P.si) - ax, dy = tb.Y(dBy[b], P.si) - ay, L2 = dx * dx + dy * dy; if (L2 < 1e-6) continue;
    const f = Math.max(0, Math.min(1, ((q.x - ax) * dx + (q.y - ay) * dy) / L2)), dd = Math.hypot(ax + dx * f - q.x, ay + dy * f - q.y);
    if (dd < bd) { bd = dd; best = { de: e * 2 + d, u: (d ? 1 - f : f) * dEm[e] }; }
  }
  return best;
}
board.addEventListener('click', ev => {
  if (dDragJust) return;
  if (dEdit) {
    const p = dPick(ev, dEdDn); if (!p) { dSigMsg('近くに' + (dEdDn ? '下り' : '上り') + '方向に走れる線路がありません'); return; }
    // すでにある信号機の近く(同じ線・同じ向きで8m以内)なら、同じ位置に重ねて置く(進路ごとに並べる信号機)
    const near = SIGS.filter(x => x.sec === dSecOf[p.de >> 1] && x.de === p.de && Math.abs(x.u - p.u) < 8).sort((a, b) => Math.abs(a.u - p.u) - Math.abs(b.u - p.u))[0];
    const sp = near && near.spec ? Object.assign(dSpecAt(p.de, near.u, dEdKind), { km: near.spec.km, y: near.spec.y, dn: near.spec.dn }) : dSpecAt(p.de, near ? near.u : p.u, dEdKind);
    if (dEdHead && dEdKind !== '入換' && dEdKind !== '中継') sp.h = dEdHead; dSecList(dSecOf[p.de >> 1]).push(sp); dSigMsg(near ? near.name + ' と同じ位置に置きました(進路を選ぶと進路ごとの信号機になります)' : ''); dSigApply(sp); return;
  }
  dSel = null; dSelSig = null; dDraw(true);
});
board.addEventListener('pointermove', ev => {
  const d = dDrag; if (!d) return;
  if (!d.moved && Math.hypot(ev.clientX - d.x0, ev.clientY - d.y0) < 4) return;
  d.moved = true; const p = dPick(ev, dDn(d.s.de)); if (!p) return;
  d.to = p; const P = dPosOf(p.de, p.u), tb = dTabs[dTab], up = d.s.down !== false;
  d.g.setAttribute('transform', `translate(${tb.X(P.km, dSecOf[p.de >> 1]).toFixed(1)} ${(tb.Y(P.by, dSecOf[p.de >> 1]) + (up ? -10 : 10)).toFixed(1)})`);
});
window.addEventListener('pointerup', () => {
  const d = dDrag; dDrag = null; if (!d || !d.moved) return;
  dDragJust = true; setTimeout(() => { dDragJust = false; }, 0);
  if (!d.to) { dBuildBoard(); return; }
  const sp = dSpecFor(d.s), n = dSpecAt(d.to.de, d.to.u, sp.k); Object.assign(sp, { km: n.km, y: n.y, dn: n.dn }); delete sp.est; dSigApply(sp);
});
window.addEventListener('keydown', ev => {
  if (!dEdit || !dSelSig || dView !== 'disp' || /INPUT|SELECT|TEXTAREA/.test(document.activeElement && document.activeElement.tagName)) return;
  if (ev.key === 'Delete' || ev.key === 'Backspace') { ev.preventDefault(); dSigDelete(dSelSig); }
});
// 図の上の編集バー
function dSigBar() {
  const bar = $('sigbar'); if (!bar) return;
  const si = dTabs[dTab].si, id = DSEC[si].id, L = D_SIGMAN && D_SIGMAN.list[id], n = SIGS.filter(s => s.sec === si).length;
  let h = `<button id="sgedit" class="${dEdit ? 'on' : ''}">${dEdit ? '編集を終わる' : '信号機を編集'}</button>`;
  h += `<span class="sg-st">${L ? `手で置いた信号機 ${n}基` + (L.some(x => x.est) ? `(うち推定の位置のまま ${L.filter(x => x.est).length}基)` : '') : `推定の信号機 ${n}基`}</span>`;
  if (dEdit) {
    h += `<span class="sg-grp"><span>置く種類</span>${SIG_KINDS.map(k => `<button data-ek="${k}" class="${k === dEdKind ? 'on' : ''}">${k}</button>`).join('')}</span>` +
      `<span class="sg-grp"><span>灯</span><select id="sghead"><option value="">全部</option>${Object.entries(SIG_HEADS).map(([k, H]) => `<option value="${k}"${k === dEdHead ? ' selected' : ''}>${H.name}</option>`).join('')}</select></span>` +
      `<span class="sg-grp"><span>向き</span><button data-ed="1" class="${dEdDn ? 'on' : ''}">下り →</button><button data-ed="0" class="${dEdDn ? '' : 'on'}">← 上り</button></span>` +
      `<span class="sg-grp"><button id="sgexp">書き出す</button><button id="sgimp">読み込む</button><button id="sgclr" class="danger">この区間を全部消す</button><button id="sgauto">推定に戻す</button></span>`;
  }
  if (dEdit) { const n1 = SIGS.filter(x => x.sec === si && D_SIGWARN.has(x)).length, n2 = D_LOCWARN.filter(w => w.sec === si).length; h += `<span class="sg-st" style="color:${n1 + n2 ? '#ff8a7a' : '#7fd18b'}">確かめ: ${n1 + n2 ? `! ${n1}基・分岐${n2}か所` : 'なし'}</span>`; }
  h += `<span id="sigmsg">${dEdMsg}</span>`;
  bar.innerHTML = h;
  $('sgedit').onclick = () => { dEdit = !dEdit; dSigMsg(''); dBuildBoard(); };
  if (!dEdit) return;
  bar.querySelectorAll('[data-ek]').forEach(b => b.onclick = () => { dEdKind = b.dataset.ek; dSigBar(); });
  bar.querySelectorAll('[data-ed]').forEach(b => b.onclick = () => { dEdDn = +b.dataset.ed; dSigBar(); });
  $('sghead').onchange = ev => { dEdHead = ev.target.value; };
  $('sgexp').onclick = () => {
    dSecList(si); if (!D_SIGMAN.saved) dSigSave();
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify({ saved: D_SIGMAN.saved, list: D_SIGMAN.list }, null, 1)], { type: 'application/json' }));
    a.download = 'disp_signals.json'; a.click(); dSigMsg('disp_signals.json を書き出しました(ダウンロード)');
  };
  $('sgimp').onclick = () => {
    const f = document.createElement('input'); f.type = 'file'; f.accept = '.json,application/json';
    f.onchange = () => { const r = new FileReader(); r.onload = () => { try { const j = JSON.parse(r.result); if (!j.list) throw 0; D_SIGMAN = { saved: 0, list: j.list }; dSigMsg('読み込みました'); dSigApply(null); } catch (e) { dSigMsg('読み込めませんでした(disp_signals.json の形ではありません)'); } }; r.readAsText(f.files[0]); };
    f.click();
  };
  $('sgclr').onclick = () => { if (!confirm('この区間の信号機を全部消しますか?(推定に戻すこともできます)')) return; D_SIGMAN = D_SIGMAN || { saved: 0, list: {} }; D_SIGMAN.list[id] = []; dSigApply(null); };
  $('sgauto').onclick = () => { if (!confirm('この区間で手で置いた信号機をやめて、推定の位置に戻しますか?')) return; if (D_SIGMAN) delete D_SIGMAN.list[id]; dSigApply(null); };
}
dTabs.forEach((tb, i) => { const b = document.createElement('button'); b.textContent = tb.name; b.onclick = () => { dTab = i; dBuildBoard(); }; $('btabs').appendChild(b); });
function dSetView(v) {
  dView = v;
  $('vmap').classList.toggle('on', v === 'map'); $('vdisp').classList.toggle('on', v === 'disp');
  document.querySelector('.mapwrap').hidden = v !== 'map'; $('boardwrap').hidden = v !== 'disp'; $('dispsec').hidden = v !== 'disp';
  if (v === 'disp') dBuildBoard();
}
$('vmap').onclick = () => dSetView('map'); $('vdisp').onclick = () => dSetView('disp');
$('dispon').onchange = () => { dispOn = $('dispon').checked; };
if (location.hash.includes('disp')) dSetView('disp');
