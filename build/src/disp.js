// ===== 運転指令: 区間ごとの実距離配線・信号機・列車の運動 =====
// 配線図の x 座標を、駅の営業キロを目印に実際のキロ程へ写す(駅と駅の間は比例)。信号機の位置は配線から推定(disp_cfg.json で直せる)。
// 区間の中の時刻表列車は、実距離(m)・加減速・速度制限・信号の現示に従って走る。区間の外は今までどおり(ttFollow)。
const DISP_CFG = /*DISPCFG*/;
const DC = DISP_CFG, DTR = DC.train, ASP = DC.aspects;
const D_SCOPE = (() => { if (typeof process !== 'undefined' && process.env) return process.env.SCOPE || 'kq'; try { return localStorage.getItem('kq-disp-scope') || 'kq'; } catch (e) { return 'kq'; } })();   // 運転指令の範囲: 'kq' 京急だけ / 'all' 京急+都営浅草線
if (D_SCOPE === 'kq') DC.sections = DC.sections.filter(sc => sc.id.startsWith('kq'));   // 直通列車は泉岳寺(区間の端)で時刻表どおりに出入りする
const KMH = v => v / 3.6;
const D_ACC = KMH(DTR.acc), D_ACCV = KMH(DTR.accV), D_BRK = KMH(DTR.brake), D_BMAX = KMH(DTR.brakeMax), D_EMER = KMH(DTR.emer);
const DISP_FALL = 25;   // 区間外のエッジは 図上1 = 25m とみなす(区間外では運動に使わない。位置の換算をそろえるだけ)
const dSecOf = new Int16Array(NE).fill(-1);   // エッジ → 区間番号(区間外は -1)
const dEm = new Float64Array(NE);             // エッジの実長(m)
const dKm = new Float64Array(N.length).fill(NaN), dBy = new Float64Array(N.length).fill(NaN);   // ノードのキロ程と、運転指令図での縦位置
const DSEC = [], SIGS = [];
const sigByDe = new Map();   // 有向エッジ(e*2+d) → その上の信号機(進む向きの距離 u の順)
// 通れる向き: 線の向きの指定(dir)は経路づくり(core.js)では「なるべく使わない」だけなので、時刻表の計画で実際に通る向き(D_USED)は通れることにする
const D_USED = new Set();
const dAllowed = (e, d) => E[e].portal || !E[e].dir || Math.sign((d ? -1 : 1) * E[e].vx) !== -E[e].dir || D_USED.has(e * 2 + d);
const dEnd = de => (de & 1) ? E[de >> 1].a : E[de >> 1].b;
const dBeg = de => (de & 1) ? E[de >> 1].b : E[de >> 1].a;
const dVec = de => { const e = E[de >> 1], s = (de & 1) ? -1 : 1; return [s * e.vx, s * e.vy]; };
const dSucc = new Map(), dPred = new Map();
// つながりの角度を見るための向き: 実際の距離(キロ程)で描いた向き。元の図(GIF をなぞったもの)は斜めの線の描き方がいびつで、
// 京急川崎の線4 への渡りなどが折り返しと誤判定されていた(2026-11-01)。キロ程で同じ位置にある線(縦の線)だけ元の図の向き
function dVecK(de) {
  const e = E[de >> 1], s = (de & 1) ? -1 : 1, kx = (dKm[e.b] - dKm[e.a]) * 1000, ky = (dBy[e.b] - dBy[e.a]) * 0.5;
  if (!isFinite(kx) || !isFinite(ky) || Math.abs(kx) < 3) return dVec(de);
  const l = Math.hypot(kx, ky); return [s * kx / l, s * ky / l];
}
function dSuccOf(de) {
  let r = dSucc.get(de); if (r) return r;
  r = []; const e = de >> 1, n = dEnd(de), v = dVecK(de);
  for (const f of adj[n]) {
    if (f === e || dSecOf[f] < 0) continue;
    const d2 = E[f].a === n ? 0 : 1; if (!dAllowed(f, d2)) continue;
    if (!E[e].portal && !E[f].portal) { const w = dVecK(f * 2 + d2); if (v[0] * w[0] + v[1] * w[1] <= -0.2) continue; }
    r.push(f * 2 + d2);
  }
  dSucc.set(de, r); return r;
}
// 線路としてつながっている先(線の向きの決まり・計画で使うかは見ない)。信号機の進路を選ぶときに使う(引上線・上りから下りへの渡り・逆線も出す)
const dSuccP = new Map();
function dSuccPhys(de) {
  let r = dSuccP.get(de); if (r) return r;
  r = []; const e = de >> 1, n = dEnd(de), v = dVecK(de);
  for (const f of adj[n]) {
    if (f === e || dSecOf[f] < 0) continue;
    const d2 = E[f].a === n ? 0 : 1;
    if (!E[e].portal && !E[f].portal) { const w = dVecK(f * 2 + d2); if (v[0] * w[0] + v[1] * w[1] <= -0.2) continue; }
    r.push(f * 2 + d2);
  }
  dSuccP.set(de, r); return r;
}
const dDot = (a, b) => { if (E[a >> 1].portal || E[b >> 1].portal) return 1; const v = dVec(a), w = dVec(b); return v[0] * w[0] + v[1] * w[1]; };
// ===== 図の x → キロ程(2026-11-04 作り直し) =====
// 前は駅のホームの端だけを目印に、その間を図の長さで比例配分していた。図の描き方しだいでポイントの斜め線が数百mになったり、引上線が列車より短くなったりした。
// いまは段ごとに、(1) 隣の線へ渡る斜め線は横に layout.turnout m(線の間隔1つぶん。斜め線の縦の長さに比例)、(2) 行き止まりの引上線・留置線は列車が入る長さ以上(layout.siding m、区間ごとに sc.siding)、
// (3) 残り(ふつうの線)で駅と駅のキロ程の差を埋める。足りないときは (1)(2) を同じ割合で縮める。端の外側(終点の先)は (1)(2) をそのまま使う。
const D_LAY = Object.assign({ turnout: 45, siding: 236, fmin: 2, endMax: 12 }, DC.layout || {});
// 画面で直した配線(運転指令の「配線を編集」): st = { 駅名: { km, len(m) } }、len = { 線の鍵: 長さ(m) }。線の鍵は両端の点の図の座標(作り直しても変わらないように)
const D_LAYKEY = 'kq-disp-layout';
let D_LAYEDIT = { saved: 0, st: {}, len: {} };
try { const j = JSON.parse(localStorage.getItem(D_LAYKEY) || 'null'); if (j && j.saved) D_LAYEDIT = Object.assign({ st: {}, len: {} }, j); } catch (e) { }
const dEdgeKey = e => { const a = N[E[e].a], b = N[E[e].b]; return [a.x.toFixed(1) + ',' + a.y.toFixed(1), b.x.toFixed(1) + ',' + b.y.toFixed(1)].sort().join('~'); };
const D_LAYWARN = [];   // 並べ方で無理に伸ばした所(点検用)
const dStDef = new Map();   // 駅の元の値(cfg)
function dRowLayout(sc, r, nrow, A) {
  if (!A || A.length < 2) return null;
  const xs = []; N.forEach((p, n) => { if (nrow[n] === r && adj[n].length) xs.push(p.x); });
  for (const a of A) xs.push(a[0]);
  xs.sort((a, b) => a - b);
  const X = []; for (const x of xs) if (!X.length || x - X[X.length - 1] > 0.25) X.push(x);
  const nI = X.length - 1; if (nI < 1) return null;
  const w = new Float64Array(nI), req = new Float64Array(nI), reqD = new Float64Array(nI); for (let k = 0; k < nI; k++) w[k] = X[k + 1] - X[k];
  const idx = x => { let lo = 0, hi = X.length - 1; while (lo < hi) { const k = (lo + hi + 1) >> 1; if (X[k] <= x + 0.26) lo = k; else hi = k - 1; } return lo; };
  const cover = (xa, xb, d, R = req) => { const i = idx(Math.min(xa, xb)), j = idx(Math.max(xa, xb)); for (let k = i; k < j; k++) R[k] = Math.max(R[k], d); };
  const inRow = e => !E[e].portal && nrow[E[e].a] === r && nrow[E[e].b] === r;
  const dxOf = e => Math.abs(N[E[e].b].x - N[E[e].a].x), dyOf = e => Math.abs(N[E[e].b].y - N[E[e].a].y);
  const rowE = []; E.forEach((e, i) => { if (inRow(i)) rowE.push(i); });
  // 線の間隔(図): 斜め線の縦の長さの中央値
  const dys = rowE.filter(e => dyOf(e) >= 0.8 && dxOf(e) >= 0.3).map(dyOf).sort((a, b) => a - b);
  const sp = (sc.layout && sc.layout.sp) || (dys.length ? dys[dys.length >> 1] : 6);
  const turn = (sc.layout && sc.layout.turnout) || D_LAY.turnout;
  for (const e of rowE) { const dx = dxOf(e), dy = dyOf(e); if (dy < 0.5 || dx < 0.3) continue; const u = Math.max(0.3, Math.min(4, dy / sp)); cover(N[E[e].a].x, N[E[e].b].x, turn * u / 1000 / dx, reqD); }
  // 行き止まりの線(ホームの無いもの): 分岐までの真っすぐな線全体で、列車が入る長さ
  const sid = sc.siding || D_LAY.siding, dead = [];
  N.forEach((p, n) => {
    if (nrow[n] !== r || adj[n].length !== 1 || D.exits.some(q => q[0] === n) || D.portals.some(q => q.includes(n))) return;
    let cur = n, e = adj[n][0], run = [], plat = false, guard = 0;
    while (guard++ < 50 && inRow(e) && dyOf(e) < 0.5) { run.push(e); if (!isNaN(stopX[e])) plat = true; const nx = E[e].a === cur ? E[e].b : E[e].a; if (adj[nx].length !== 2) break; const f = adj[nx].find(x => x !== e); cur = nx; e = f; }
    if (plat || !run.length) return;
    let x0 = Infinity, x1 = -Infinity; for (const f of run) { x0 = Math.min(x0, N[E[f].a].x, N[E[f].b].x); x1 = Math.max(x1, N[E[f].a].x, N[E[f].b].x); }
    if (x1 - x0 < 0.3) return;
    cover(x0, x1, sid / 1000 / (x1 - x0)); dead.push([x0, x1]);
  });
  // 単独の引上線(ほかの行き止まりと x が重ならない=検車区・留置線の並びではない): 長さをちょうど sid に。
  //   同じ x の線は同じ縮尺になるので、駅の先の引上線が隣の本線の駅間ぶんまで伸びていた(京急久里浜 703m・三浦海岸 663m)。cfg の layout.capSiding:false で前の扱い
  const reqC = new Float64Array(nI);
  if (!(sc.layout && sc.layout.capSiding === false) && !(DC.layout && DC.layout.capSiding === false))
    for (const [x0, x1] of dead) if (!dead.some(q => q !== undefined && (q[0] !== x0 || q[1] !== x1) && q[0] < x1 - 0.3 && x0 < q[1] - 0.3)) cover(x0, x1, sid / 1000 / (x1 - x0), reqC);
  // 画面で長さを指定した線: その長さちょうど(斜め線・引上線の決まりより優先)
  const reqX = new Float64Array(nI);
  for (const e of rowE) { const m = D_LAYEDIT.len[dEdgeKey(e)]; if (!(m > 0)) continue; const dx = dxOf(e); if (dx < 0.3) continue; cover(N[E[e].a].x, N[E[e].b].x, m / 1000 / dx, reqX); }
  // 目印(駅のホームの端・段の切れ目)の間を埋める
  const fmin = D_LAY.fmin / 1000, dens = new Float64Array(nI).fill(NaN), Aa = A.map(a => [idx(a[0]), a[1]]).sort((p, q) => p[0] - q[0]);
  let useC = true; const fill = [], dv = (k, f) => reqX[k] > 0 ? reqX[k] : useC && reqC[k] > 0 ? Math.max(reqC[k], reqD[k]) : reqD[k] > 0 ? Math.max(reqD[k], req[k]) : Math.max(req[k], f);   // 斜め線のかかる所は決めた長さちょうど(駅間が長くても伸ばさない)
  for (let q = 0; q + 1 < Aa.length; q++) {
    const [i0, k0] = Aa[q], [i1, k1] = Aa[q + 1]; if (i1 <= i0) continue;
    const K = Math.max(1e-4, k1 - k0), g = f => { let s = 0; for (let k = i0; k < i1; k++) s += dv(k, f) * w[k]; return s; };
    useC = true; if (g(1e3) < K) useC = false;   // 目印の間を引上線の上限のままでは埋められない(泉岳寺の引上線は浅草線とのつなぎ目で長さが決まる): その間は上限を使わない
    if (g(fmin) >= K) { const s = K / g(fmin); for (let k = i0; k < i1; k++) dens[k] = dv(k, fmin) * s; fill.push(fmin * s); continue; }
    let lo = fmin, hi = fmin, it0 = 0; while (g(hi) < K && it0++ < 40) hi *= 2;
    if (g(hi) < K) { const s = K / Math.max(1e-12, g(hi)); for (let k = i0; k < i1; k++) dens[k] = dv(k, hi) * s; fill.push(hi); if (typeof D_LAYWARN !== 'undefined') D_LAYWARN.push({ sc: sc.id, r, x0: X[i0], x1: X[i1] }); continue; }   // 目印の間が決めた長さの線(斜め線・長さ指定)だけ: 同じ割合で伸ばす(前は止まらなかった)
    for (let it = 0; it < 60; it++) { const mid = (lo + hi) / 2; if (g(mid) < K) lo = mid; else hi = mid; }
    for (let k = i0; k < i1; k++) dens[k] = dv(k, hi); fill.push(hi);
  }
  useC = true;
  const iA = Aa[0][0], iZ = Aa[Aa.length - 1][0], endF = D_LAY.endMax / 1000;
  const d0 = Math.min(endF, fill.length ? fill[0] : endF), d1 = Math.min(endF, fill.length ? fill[fill.length - 1] : endF);
  for (let k = 0; k < iA; k++) dens[k] = dv(k, d0);
  for (let k = iZ; k < nI; k++) dens[k] = dv(k, d1);
  for (let k = 0; k < nI; k++) if (isNaN(dens[k])) dens[k] = dv(k, fmin);
  const K = new Float64Array(X.length); K[iA] = Aa[0][1];
  for (let k = iA; k < nI; k++) K[k + 1] = K[k] + dens[k] * w[k];
  for (let k = iA - 1; k >= 0; k--) K[k] = K[k + 1] - dens[k] * w[k];
  // 目印は正確に(縮めた丸めの誤差を消す)
  for (const [i, km] of Aa) K[i] = km;
  return { X, K, d0, d1, sp, dead };
}
// 段の切れ目(※ の接続): 前の段の右端と次の段の左端に、駅間の距離を図上の長さで按分したキロ程を置く(同じ区間の中の段どうし)
//   目印がまだ無い段(逗子線の金沢八景寄りの短い段など)は、支線のつなぎの目印を入れたあとでもう一度呼ぶ
function dSecPortals(nrow, anc) {
  D.portals.forEach(([na, nb]) => {
    let ra = nrow[na], rb = nrow[nb]; if (ra < 0 || rb < 0 || ra === rb) return;
    if (ra > rb) { [na, nb] = [nb, na]; [ra, rb] = [rb, ra]; }
    const xa = N[na].x, xb = N[nb].x, A = anc[ra].filter(p => p[0] <= xa).pop(), B = anc[rb].find(p => p[0] >= xb);
    if (!A || !B) return;
    const P = (xa - A[0]) + (B[0] - xb), kp = A[1] + (B[1] - A[1]) * (xa - A[0]) / Math.max(1, P);
    if (!anc[ra].some(p => Math.abs(p[0] - xa) < 1.5)) anc[ra].push([xa, kp]);
    if (!anc[rb].some(p => Math.abs(p[0] - xb) < 1.5)) anc[rb].push([xb, kp]);
    anc[ra].sort((p, q) => p[0] - q[0]); anc[rb].sort((p, q) => p[0] - q[0]);
  });
}
// 画面に出すキロ程: kmNeg = 符号を反転して載せた区間(都営浅草線)、kmMirror = M - キロ程 で載せた区間(空港線・大師線: 図で本線と逆の向きに延びるので、分かれる駅で本線と同じ軸のまま折り返す)。どちらも2回かけると元に戻る
const dKmShow = (sc, k) => sc.kmNeg ? -k : sc.kmMirror != null ? sc.kmMirror - k : k;
const D_JOIN = [];   // 線でじかにつながる区間どうしのつなぎの線: { e, so 支線の側の区間, no その点, sin 本線の側の区間, ni その点 }
function dInit() {
  D_LAYWARN.length = 0; dSecOf.fill(-1); dKm.fill(NaN); dBy.fill(NaN); DSEC.length = 0; dSucc.clear(); dSuccP.clear(); sigByDe.clear(); SIGS.length = 0;   // 配線を直したときにやり直せるように
  // 1) 区間ごとに: 段の割り当て・駅のホームの端(目印)・同じ区間の段の切れ目
  const SI = DC.sections.map((sc, si) => {
    const inR = (q, x, y) => x >= q[0] && x <= q[1] && y >= q[2] && y <= q[3];
    const rowOf = (x, y) => sc.rows.findIndex(r => r.rects.some(q => inR(q, x, y)));
    const nrow = N.map((p, n) => adj[n].length ? rowOf(p.x, p.y) : -1);
    const anc = sc.rows.map(() => []), stInfo = new Map();
    for (const [nm, km0, c] of sc.stations) {
      const s = stByName.get(nm); if (!s || !s.stops.length) continue;
      const len0 = c <= 30 ? c * DTR.carLen : c;   // 両数(18m × 両数)か m
      dStDef.set(nm, { km: km0, len: len0 });
      const o = D_LAYEDIT.st[nm], km = o && isFinite(o.km) ? o.km : km0, len = o && o.len > 0 ? o.len : len0;   // 画面で直した値
      const r = nrow[E[s.stops[0][0]].a]; if (r < 0) continue;
      const ps = s.plats.length ? s.plats : [[s.cx, 0, s.cx, 0]], px0 = Math.min(...ps.map(p => p[0])), px1 = Math.max(...ps.map(p => p[2])), h = len / 2000;
      // 目印はホームの四角形の端ではなく、列車が止まる点を中心にする(元の図では止まる点と四角形が100m以上離れて描かれている駅がある: 大門・三田・五反田など)
      //   止まる点は線(エッジ)の途中にあり、エッジの中のキロ程は両端の点から一直線に決まるので、目印はそのエッジの両端に置く(止まる点がちょうど駅のキロ程になるように)
      const sx = s.stops.filter(([e]) => !E[e].portal && nrow[E[e].a] === r && nrow[E[e].b] === r).map(([e, x]) => ({ e, x })).sort((p, q) => p.x - q.x);
      let best = [], cur = []; for (const q of sx) { if (cur.length && q.x - cur[cur.length - 1].x > 6) cur = []; cur.push(q); if (cur.length > best.length) best = cur.slice(); }
      const w = Math.max(2, px1 - px0); let xc = (px0 + px1) / 2, x0 = px0, x1 = px1;
      if (best.length) {
        const q = best[0], a = E[q.e].a, b = E[q.e].b, xa = Math.min(N[a].x, N[b].x), xb = Math.max(N[a].x, N[b].x), dxE = Math.max(1e-6, xb - xa), f = (q.x - xa) / dxE, Lp = 2 * h * dxE / w;
        xc = q.x; x0 = xa; x1 = xb; anc[r].push([xa, km - f * Lp], [xb, km + (1 - f) * Lp]);
      } else anc[r].push([px0, km - h], [px1, km + h]);
      stInfo.set(nm, { km, len, x0, x1, xc, row: r });
    }
    anc.forEach(a => a.sort((p, q) => p[0] - q[0]));
    dSecPortals(nrow, anc);
    return { sc, si, nrow, anc, stInfo, done: false };
  });
  // 2) ほかの区間とのつなぎ目(泉岳寺 ⇔ 都営浅草線など)。sc.link = { sec: 相手の区間, off }: 相手のキロ程 + off = この区間のキロ程
  //    つなぎ目の点が駅の並びの外側(段の端)にあれば、両側の駅の間の実距離を図の長さで按分した所に置く。内側(京急の図で泉岳寺と品川の間から下へ出る高輪台方面の線)なら
  //    その区間の並べ方を崩さないよう目印にせず、相手の側をその位置に合わせる(少し離して、画面でつなぎの斜め線が見えるようにする)
  const conv = (to, from, km) => { const lt = SI[to].sc.link, lf = SI[from].sc.link; if (lt && lt.sec === SI[from].sc.id) return km + lt.off; if (lf && lf.sec === SI[to].sc.id) return km - lf.off; return NaN; };
  const near = (S, r, x) => { let best = null; for (const p of S.anc[r]) if (!best || Math.abs(p[0] - x) < Math.abs(best[0] - x)) best = p; return best; };
  const outside = (S, r, x) => { const a = S.anc[r]; return !a.length || x < a[0][0] - 0.1 || x > a[a.length - 1][0] + 0.1; };
  const D_LINKGAP = D_LAY.linkGap != null ? D_LAY.linkGap : 0.08, defer = [];
  D.portals.forEach(([na, nb]) => {
    const sa = SI.findIndex(S => S.nrow[na] >= 0), sb = SI.findIndex(S => S.nrow[nb] >= 0); if (sa < 0 || sb < 0 || sa === sb || isNaN(conv(sa, sb, 0))) return;
    const A = SI[sa], B = SI[sb], ra = A.nrow[na], rb = B.nrow[nb], xa = N[na].x, xb = N[nb].x, oa = outside(A, ra, xa), ob = outside(B, rb, xb);
    if (oa && ob) {
      const PA = near(A, ra, xa), PB = near(B, rb, xb); if (!PA || !PB) return;
      const kB = conv(sa, sb, PB[1]), pa = Math.abs(xa - PA[0]), pb = Math.abs(xb - PB[0]), J = PA[1] + (kB - PA[1]) * pa / Math.max(1e-6, pa + pb);
      const g = Math.sign(PA[1] - kB) * D_LINKGAP / 2;   // 両側を少し離して、画面でつなぎの線が見えるようにする
      A.anc[ra].push([xa, J + g]); B.anc[rb].push([xb, conv(sb, sa, J - g)]); A.anc[ra].sort((p, q) => p[0] - q[0]); B.anc[rb].sort((p, q) => p[0] - q[0]);
    } else if (oa) defer.push([sa, ra, na, sb, nb]);
    else if (ob) defer.push([sb, rb, nb, sa, na]);
  });
  // 2b) ※ ではなく線でじかにつながる区間どうし(京急蒲田 ⇔ 空港線、京急川崎 ⇔ 大師線、金沢八景 ⇔ 逗子線、堀ノ内 ⇔ 久里浜線)。支線の側(sc.link のある側)の区間にその線を入れ、
  //     支線の側の端の点には、本線の段の並べ方をその x までそのまま延ばしたキロ程(+off)を目印に置く。つなぎの線の長さは本線の段の縮尺で決まる(画面の「配線を編集」で直せる)
  D_JOIN.length = 0;
  E.forEach((e, i) => {
    if (e.portal) return; const sa = SI.findIndex(S => S.nrow[e.a] >= 0), sb = SI.findIndex(S => S.nrow[e.b] >= 0); if (sa < 0 || sb < 0 || sa === sb) return;
    const la = SI[sa].sc.link, lb = SI[sb].sc.link;
    if (la && la.sec === SI[sb].sc.id) D_JOIN.push({ e: i, so: sa, no: e.a, sin: sb, ni: e.b });
    else if (lb && lb.sec === SI[sa].sc.id) D_JOIN.push({ e: i, so: sb, no: e.b, sin: sa, ni: e.a });
  });
  // 3) 区間ごとに並べ方を決めてキロ程を入れる
  SI.forEach(S => {
    const { sc, si, nrow, anc, stInfo } = S;
    for (const [so, ro, no, sin, ni] of defer) { if (so !== si || !SI[sin].done || isNaN(dKm[ni])) continue;
      const k = conv(so, sin, dKm[ni]), P = near(S, ro, N[no].x); if (!P) continue;
      const kk = k + Math.sign(P[1] - k) * D_LINKGAP, ex = anc[ro].find(q => Math.abs(q[0] - N[no].x) < 0.3);   // 同じ所に2本(複線)なら、駅に近いほうに合わせる(どちらの線もつなぎの斜め線が見える)
      if (ex) { if (Math.abs(P[1] - kk) < Math.abs(P[1] - ex[1])) ex[1] = kk; } else anc[ro].push([N[no].x, kk]); anc[ro].sort((p, q) => p[0] - q[0]); }
    let nj = 0;
    for (const J of D_JOIN) { if (J.so !== si || !SI[J.sin].done) continue; const S2 = SI[J.sin], r2 = S2.nrow[J.ni], ro = nrow[J.no], x = N[J.no].x; if (r2 < 0 || ro < 0 || !S2.kmAt) continue;
      const k = conv(si, J.sin, S2.kmAt(r2, x)); if (!isFinite(k) || anc[ro].some(q => Math.abs(q[0] - x) < 0.3)) continue;
      // 支線の駅の目印と向きが逆にならないように(並べ方は x とともにキロ程が増える)
      const lo = anc[ro].filter(q => q[0] < x).pop(), hi = anc[ro].find(q => q[0] > x);
      if ((lo && k <= lo[1] + 0.005) || (hi && k >= hi[1] - 0.005)) { const a = lo ? lo[1] : (hi[1] - 0.1), b = hi ? hi[1] : (lo[1] + 0.1); anc[ro].push([x, a + (b - a) * ((x - (lo ? lo[0] : x - 1)) / Math.max(1e-6, (hi ? hi[0] : x + 1) - (lo ? lo[0] : x - 1)))]); }
      else anc[ro].push([x, k]);
      anc[ro].sort((p, q) => p[0] - q[0]); nj++; }
    if (nj) dSecPortals(nrow, anc);
    const lay = DC.layout && DC.layout.off ? sc.rows.map(() => null) : sc.rows.map((_, r) => dRowLayout(sc, r, nrow, anc[r]));
    const kmAt = (r, x) => {
      const Ly = lay[r]; if (Ly) { const X = Ly.X, K = Ly.K, n = X.length; if (x <= X[0]) return K[0] - (X[0] - x) * Ly.d0; if (x >= X[n - 1]) return K[n - 1] + (x - X[n - 1]) * Ly.d1; let lo = 0, hi = n - 1; while (hi - lo > 1) { const k = (lo + hi) >> 1; if (X[k] <= x) lo = k; else hi = k; } return K[lo] + (K[hi] - K[lo]) * (x - X[lo]) / Math.max(1e-9, X[hi] - X[lo]); }
      const a = anc[r]; if (!a.length) return NaN;
      if (a.length === 1) return a[0][1];
      let i = 0; while (i + 2 < a.length && a[i + 1][0] < x) i++;
      const [x0, k0] = a[i], [x1, k1] = a[i + 1], sl = Math.min(0.012, (k1 - k0) / Math.max(1e-6, x1 - x0));
      if (x < x0 && i === 0) return k0 + (x - x0) * sl;
      if (x > x1) return k1 + (x - x1) * sl;
      return k0 + (k1 - k0) * (x - x0) / Math.max(1e-6, x1 - x0);
    };
    S.kmAt = kmAt;
    N.forEach((p, n) => { if (nrow[n] >= 0) { dKm[n] = kmAt(nrow[n], p.x); dBy[n] = p.y + sc.rows[nrow[n]].dy; } });
    // ホームの四角形ごとの位置: その四角形に接する線で列車が止まる点を中心に(京急蒲田の空港線側のように、駅の中心から離れた所に止まる線もある)
    for (const [nm, info] of stInfo) { const s = stByName.get(nm);
      const st = s.stops.filter(([e]) => !E[e].portal && nrow[E[e].a] === info.row && nrow[E[e].b] === info.row).map(([e, x]) => { const f = paramOf(e, x), a = E[e].a, b = E[e].b; return { x, y: N[a].y + (N[b].y - N[a].y) * f, km: dKm[a] + (dKm[b] - dKm[a]) * f }; });
      info.pk = s.plats.map(p => { const c = st.filter(q => q.y >= p[1] - 7 && q.y <= p[3] + 7).sort((u, v) => u.x - v.x); if (!c.length) return [info.km];   // 四角形ごとに、止まる点のかたまり(x が6以内)ごとの中心
        const out = []; let g = []; const flush = () => { if (g.length) out.push(g.reduce((a, q) => a + q.km, 0) / g.length); g = []; };
        for (const q of c) { if (g.length && q.x - g[g.length - 1].x > 6) flush(); g.push(q); } flush(); return out; });
      const pf = DC.platFix && DC.platFix[nm]; if (pf) info.pf = pf.map(r => ({ km: kmAt(info.row, r[0]), y0: r[1], y1: r[2] })); }   // 画面だけのホームの四角形の指定 [止まる点の x, 上の y, 下の y](京急蒲田: 普通専用の片面ホームと、優等・空港線の島式)
    for (const [n, y] of Object.entries(sc.byFix || {})) if (nrow[+n] >= 0) dBy[+n] = y + sc.rows[nrow[+n]].dy;   // 画面だけの縦位置の手直し(点の番号: 図の y)。長さの計算は元の図の y のまま
    const edges = [];
    E.forEach((e, i) => { if (nrow[e.a] >= 0 && nrow[e.b] >= 0 && (e.portal || nrow[e.a] === nrow[e.b])) { dSecOf[i] = si; edges.push(i); } });
    for (const J of D_JOIN) if (J.so === si && SI[J.sin].done) { dSecOf[J.e] = si; edges.push(J.e); }   // つなぎの線は支線の側の区間に入れる(本線の側の点のキロ程は本線の区間で決めたもの。同じ軸なので線の中の位置もそのまま)
    const bnd = new Set(); edges.forEach(i => [E[i].a, E[i].b].forEach(n => { if (adj[n].some(f => dSecOf[f] !== si)) bnd.add(n); }));
    DSEC.push({ sc, id: sc.id, name: sc.name, edges, stInfo, bnd, tabs: sc.tabs, vmax: (D_LAYEDIT.vmax && D_LAYEDIT.vmax[sc.id]) || sc.vmax });   // 速度制限は画面で直したものがあればそちら
    S.done = true;
  });
  E.forEach((e, i) => {
    if (dSecOf[i] < 0) { dEm[i] = e.len * DISP_FALL; return; }
    dEm[i] = e.portal ? 0 : Math.max(Math.abs(dKm[e.b] - dKm[e.a]) * 1000, Math.abs(N[e.b].y - N[e.a].y) * 2.5, 1);
  });
  // 前からつながる有向エッジ
  dBuildPred();
  dBuildSignals();
}
// ===== 信号機の推定 =====
// 1) 各駅のホームの先(停止位置 + ホーム長の半分 + 8m)に出発信号(分岐の無い駅は閉塞信号)
// 2) 対向の分岐(進む先が2つ以上)の 60m 手前に場内信号(300m 以内の手前にほかの信号機があれば不要)
// 3) 合流の手前 40m(各方向とも)
// 4) 信号機の間が 700m を超える一本道は、550m 以下になるよう閉塞信号を等間隔に入れる
// 手で置いた信号機(signals.list、区間ごと)があれば推定はせず、それだけを使う。種類: 場内・出発・閉塞・入換(進むと25km/h)・中継(区切りにならず、先の信号機の現示を知らせるだけ)
const SIG_RANK = { '出発': 0, '場内': 1, '駅内場内': 1, '入換': 2, '閉塞': 3, '中継': 4 };
const SIG_KINDS = ['場内', '駅内場内', '出発', '閉塞', '入換', '中継'];   // 駅内場内: 駅の構内(場内信号機の内側)で、長い構内や構内の分岐を区切る場内信号機(第2場内)
const dIsHome = k => k === '場内' || k === '駅内場内';
// 信号機の灯(出せる現示)。spec.h。無ければ全部出せる。出せない現示は、警戒→注意、それ以外は一つ上(進行の側)、上に無ければ下へ置き換える
const SIG_HEADS = {
  '5抑': { name: '5灯+抑速', a: ['R', 'YY', 'Y', 'YG', 'YGF', 'G'] },
  '5灯': { name: '5灯', a: ['R', 'YY', 'Y', 'YG', 'G'] },
  '4警': { name: '4灯(警戒あり)', a: ['R', 'YY', 'Y', 'G'] },
  '4減': { name: '4灯(減速あり)', a: ['R', 'Y', 'YG', 'G'] },
  '3灯': { name: '3灯', a: ['R', 'Y', 'G'] },
  '2注': { name: '2灯(停止・注意)', a: ['R', 'Y'] },
  '2進': { name: '2灯(停止・進行)', a: ['R', 'G'] },
};
const ASP_ORD = ['R', 'YY', 'Y', 'YG', 'YGF', 'G'];
// spec.noG: 進行の灯を黒く塗った信号機(進行を出さない。進行のときは一つ下の現示)
const dHeadAv = sp => { const H = sp && SIG_HEADS[sp.h], a = H ? H.a : ASP_ORD; return sp && sp.noG ? a.filter(x => x !== 'G') : a; };
function dHeadAsp(s, a) {
  const sp = s && s.spec; if (!sp || (!SIG_HEADS[sp.h] && !sp.noG)) return a;
  const av = dHeadAv(sp); if (av.includes(a)) return a;
  const i = ASP_ORD.indexOf(a); if (i < 0) return a;
  for (let j = i + 1; j < ASP_ORD.length; j++) if (av.includes(ASP_ORD[j])) return ASP_ORD[j];
  for (let j = i - 1; j >= 0; j--) if (av.includes(ASP_ORD[j])) return ASP_ORD[j];
  return 'R';
}
const D_SIGKEY = 'kq-disp-signals';   // ブラウザで編集した一覧(cfg より新しければこちらを使う)
let D_SIGMAN = DC.signals.list ? { saved: DC.signals.saved || 0, list: DC.signals.list } : null;
try { const j = JSON.parse(localStorage.getItem(D_SIGKEY) || 'null'); if (j && j.list && (!D_SIGMAN || (j.saved || 0) > D_SIGMAN.saved)) D_SIGMAN = j; } catch (e) { }
const D_SIGLOST = [];   // 一覧にあるが線路が見つからなかったもの
// キロ程・図の縦位置(元の図の y)・向きから、有向エッジ上の位置へ
const dDn = de => { const v = dVec(de); return (Math.abs(v[0]) > 0.05 ? v[0] > 0 : v[1] > 0) ? 1 : 0; };   // 向き: 1 = 下り(図の右へ。縦の線では下へ)
function dSigLocate(si, km, y, dn, any) {   // any: 線の向きの決まりを見ない(進路の先の線を探すとき)
  let best = null, bd = 1.5;
  for (const e of DSEC[si].edges) {
    if (E[e].portal) continue; const a = E[e].a, b = E[e].b, k0 = Math.min(dKm[a], dKm[b]), k1 = Math.max(dKm[a], dKm[b]);
    if (km < k0 - 1e-4 || km > k1 + 1e-4) continue;
    const vert = k1 - k0 < 1e-4, ya = N[a].y, yb = N[b].y;
    if (vert && (y < Math.min(ya, yb) - 0.05 || y > Math.max(ya, yb) + 0.05)) continue;
    const f = Math.max(0, Math.min(1, vert ? (y - ya) / ((yb - ya) || 1e-9) : (km - dKm[a]) / (dKm[b] - dKm[a]))), dd = vert ? 0 : Math.abs(ya + (yb - ya) * f - y);
    for (const d of [0, 1]) { if ((!any && !dAllowed(e, d)) || dDn(e * 2 + d) !== (dn ? 1 : 0) || dd >= bd) continue; bd = dd; best = { de: e * 2 + d, u: (d ? 1 - f : f) * dEm[e] }; }
  }
  return best;
}
// 有向エッジ上の位置 → キロ程・図の位置
function dPosOf(de, u) { const e = de >> 1, a = E[e].a, b = E[e].b, f = (de & 1) ? 1 - u / Math.max(1e-9, dEm[e]) : u / Math.max(1e-9, dEm[e]); return { f, km: dKm[a] + (dKm[b] - dKm[a]) * f, by: dBy[a] + (dBy[b] - dBy[a]) * f, y: N[a].y + (N[b].y - N[a].y) * f }; }
// 進む向きに dm(m)ずらす(分岐ではまっすぐな側へ)
function dShift(de, u, dm) {
  for (let g = 0; g < 40; g++) {
    const L = dEm[de >> 1], x = u + dm;
    if (x >= 0 && x <= L) return { de, u: x };
    if (x > L) { const sc = dSuccOf(de).filter(f => !E[f >> 1].portal); if (!sc.length) return { de, u: L - 0.5 }; let b = sc[0]; for (const f of sc) if (dDot(de, f) > dDot(de, b)) b = f; dm -= L - u; de = b; u = 0; }
    else { const pr = (dPred.get(de) || []).filter(f => !E[f >> 1].portal); if (!pr.length) return { de, u: 0.5 }; let b = pr[0]; for (const f of pr) if (dDot(f, de) > dDot(b, de)) b = f; dm += u; de = b; u = dEm[de >> 1]; }
  }
  return { de, u };
}
// 手で置いた信号機を足す(est=1 = 推定の位置のまま、は足さない)
function dManAdd(si, man, reps) {
  for (const sp of man) { if (sp.est) continue;
    const p = dSigLocate(si, sp.km, sp.y, sp.dn); if (!p) { D_SIGLOST.push(sp); continue; }
    if (sp.k === '中継') { reps.push({ de: p.de, e: p.de >> 1, d: p.de & 1, u: p.u, kind: '中継', st: sp.st || null, asp: 'R', man: false, spec: sp, usr: true }); continue; }
    const s = dAddSig(p.de, p.u, SIG_KINDS.includes(sp.k) ? sp.k : '閉塞', sp.st || null, true); s.spec = sp; s.usr = true;
    if (sp.to) { const q = dSigLocate(si, sp.to.km, sp.to.y, sp.to.dn != null ? sp.to.dn : sp.dn, true) || dSigLocate(si, sp.to.km, sp.to.y, sp.to.dn != null ? 1 - sp.to.dn : 1 - sp.dn, true); s.toE = q ? q.de >> 1 : -1; }
  }
}
// 推定の信号機を1基外す(p の位置から r m 以内でいちばん近いもの。手で置いたものは外さない)
function dManDrop(p, r) {
  const L = sigByDe.get(p.de); if (!L) return null; let bi = -1, bd = r;
  L.forEach((s, i) => { if (s.usr) return; const d = Math.abs(s.u - p.u); if (d <= bd) { bd = d; bi = i; } });
  return bi >= 0 ? L.splice(bi, 1)[0] : null;
}
function dAddSig(de, u, kind, st, exact) {
  const L = dEm[de >> 1]; u = Math.max(0.5, Math.min(L - 0.5, u));
  const list = sigByDe.get(de) || []; if (!sigByDe.has(de)) sigByDe.set(de, list);
  const near = exact ? null : list.find(s => Math.abs(s.u - u) < 25);
  if (near) { if (SIG_RANK[kind] < SIG_RANK[near.kind]) { near.kind = kind; near.st = st || near.st; } return near; }
  const s = { de, e: de >> 1, d: de & 1, u, kind, st: st || null, asp: 'R', man: false };
  list.push(s); list.sort((a, b) => a.u - b.u); return s;
}
// de の終点から dist 手前(合流で分かれたら、それぞれの枝)に置く。range 以内の手前にすでに信号機があれば置かない
function dPlaceBack(de, uEnd, dist, range, kind, st, depth = 0) {
  const list = sigByDe.get(de) || [];
  if (list.some(s => s.u <= uEnd + 0.01 && s.u >= uEnd - range)) return;
  if (uEnd - dist >= 0) { dAddSig(de, uEnd - dist, kind, st); return; }
  const pr = dPred.get(de) || [];
  if (!pr.length || depth > 6) { dAddSig(de, Math.min(uEnd, 1), kind, st); return; }
  for (const p of pr) dPlaceBack(p, dEm[p >> 1], dist - uEnd, range - uEnd, kind, st, depth + 1);
}
function dPlaceFwd(de, u, kind, st) {
  for (let g = 0; g < 8 && u > dEm[de >> 1]; g++) { const sc = dSuccOf(de); if (sc.length !== 1 || (dPred.get(sc[0]) || []).length > 1) { u = Math.max(1, dEm[de >> 1] - 15); break; } u -= dEm[de >> 1]; de = sc[0]; }   // 先に分岐があれば、その 15m 手前
  return dAddSig(de, u, kind, st);
}
const dStopU = (e, d, x) => { const ts = paramOf(e, x); return (d ? 1 - ts : ts) * dEm[e]; };
function dBuildSignals() {
  D_SIGLOST.length = 0;
  const reps = [];
  for (const sec of DSEC) {
    const ES = new Set(sec.edges), deg = n => adj[n].filter(f => ES.has(f)).length, si = DSEC.indexOf(sec);
    for (const [nm, info] of sec.stInfo) info.sw = N.some((p, n) => deg(n) >= 3 && Math.abs(dKm[n] - info.km) <= info.len / 2000 + 0.3);
    const man = D_SIGMAN && D_SIGMAN.list[sec.id], noest = !!(D_SIGMAN && D_SIGMAN.noest && D_SIGMAN.noest[sec.id]);
    sec.entries = []; for (const e of sec.edges) for (const d of [0, 1]) { const de = e * 2 + d; if (dAllowed(e, d) && !E[e].portal && sec.bnd.has(dBeg(de)) && !(dPred.get(de) || []).length) sec.entries.push(de); }
    if (man && noest) { dManAdd(si, man, reps); continue; }   // 「全部消す」にした区間: 手で置いた信号機だけ
    // 推定(駅の作りに沿って。スキル tetsudo-shingou):
    const NP = l => (l || []).filter(f => !E[f >> 1].portal);
    const isSwEnd = de => { const sc = NP(dSuccOf(de)); return sc.length >= 2 || (sc.length === 1 && NP(dPred.get(sc[0])).length >= 2); };
    const isSwBeg = de => { const pr = NP(dPred.get(de)); return pr.length >= 2 || pr.some(q => NP(dSuccOf(q)).length >= 2); };
    // ホームの先(u0 から先)を線路に沿ってたどる: 'dead' = すぐ(150m 以内)車止め、'sw' = 次の駅のホームより手前に分岐がある(停車場なので出発)、'plain' = 分岐なし
    //   駅の中心から±0.3km で分岐を探していたので、図の縮尺で分岐が少し離れた終着駅(羽田空港第1・第2ターミナル・小島新田など)に出発が無かった
    function dAhead(de, u0) {
      let x = de, len = -u0;
      for (let g = 0; g < 40 && len < 700; g++) {
        const e = x >> 1; len += dEm[e];
        if (g > 0 && !isNaN(stopX[e]) && edgeStation[e] >= 0) return 'plain';   // 次の駅のホーム
        const sc = NP(dSuccOf(x));
        if (!sc.length) return (dSuccOf(x) || []).length ? 'plain' : adj[dEnd(x)].length <= 1 ? (len < 150 ? 'dead' : 'sw') : 'plain';   // 車止め(遠ければ引上線への入換の区切りなので出発)
        if (sc.length >= 2 || NP(dPred.get(sc[0])).length >= 2) return 'sw';
        if (dSecOf[sc[0] >> 1] < 0) return 'plain';
        x = sc[0];
      }
      return 'plain';
    }
    // 1) ホームの先: 分岐のある駅(停車場)は出発、無い駅(停留場)は閉塞。先に分岐があれば、その 15m 手前
    const platIn = [];   // ホームの入口 [de, u, 駅名](あとで手前の信号機が遠ければ閉塞を置く)
    for (const [nm, info] of sec.stInfo) {
      const s = stByName.get(nm), hasSw = info.sw;
      for (const [e, x] of s.stops) for (const d of [0, 1]) if (ES.has(e) && dAllowed(e, d)) { const u0 = dStopU(e, d, x) + info.len / 2 + 8, ah = dAhead(e * 2 + d, u0);
        if (ah === 'dead') continue;   // ホームの先が車止め(終着駅の行き止まりの側): 信号機は要らない
        dPlaceFwd(e * 2 + d, u0, hasSw || ah === 'sw' ? '出発' : '閉塞', nm); platIn.push([e * 2 + d, dStopU(e, d, x) - info.len / 2, nm]); }
    }
    const des = []; for (const e of sec.edges) for (const d of [0, 1]) if (dAllowed(e, d) && !E[e].portal) des.push(e * 2 + d);
    // 2) 分岐(対向・背向)ごとに、手前をさかのぼって何があるかで決める
    //    手前 150m 以内に信号機・ホームの停止位置 → 置かない(出発などが守る)
    //    行き止まり(引上線など)から → 入換を 20m 手前
    //    300m 以上まっすぐ(駅のいちばん外の分岐) → 第1場内を 100m(100km/h 未満は 80m)手前
    //    ホームより先(進む向き)にあり、手前 150m 以上分岐が無い → ホームの無い線(通過線)の出口なので出発を 15m 手前
    //    それ以外(駅の中の分岐) → 手前の信号機から 250m 以上離れていれば第2場内を 60m 手前(長い構内を区切る)
    const siS = DSEC.indexOf(sec), inner = [];
    const beyondPlat = de => { const P = dPosOf(de, dEm[de >> 1]), dn = dDn(de) === 1;
      for (const [, info] of sec.stInfo) { const h = info.len / 2000; if (Math.abs(P.km - info.km) > h + 0.6) continue; if (dn ? P.km > info.km + h + 0.005 : P.km < info.km - h - 0.005) return true; }
      return false; };
    const backSig = (de, max) => {   // de の終点から手前へ、いちばん近い信号機までの距離
      let x = de, uE = dEm[de >> 1], len = 0;
      for (let g = 0; g < 60 && len < max; g++) {
        const q = (sigByDe.get(x) || []).filter(q => q.u <= uE + 0.01 && q.kind !== '中継'); if (q.length) return len + uE - Math.max(...q.map(q => q.u));
        len += uE; const pr = NP(dPred.get(x)); if (!pr.length || dSecOf[pr[0] >> 1] < 0) return Infinity;
        let b = pr[0]; for (const f of pr) if (dDot(f, x) > dDot(b, x)) b = f; x = b; uE = dEm[x >> 1];
      }
      return Infinity; };
    for (const de of des) {
      if (!isSwEnd(de)) continue;
      const facing = NP(dSuccOf(de)).length >= 2, vl = dVlineAt(siS, dPosOf(de, dEm[de >> 1]).km), need = vl < 100 ? 80 : 100;
      let x = de, uE = dEm[de >> 1], len = 0, what = 'plain';
      for (let g = 0; g < 60 && len < 600; g++) {
        const e = x >> 1;
        if ((sigByDe.get(x) || []).some(q => q.u <= uE + 0.01 && len + uE - q.u < 150)) { what = 'sig'; break; }
        if (!isNaN(stopX[e]) && edgeStation[e] >= 0 && dStopU(e, x & 1, stopX[e]) <= uE + 0.01 && len + uE - dStopU(e, x & 1, stopX[e]) < 150) { what = 'stop'; break; }
        len += uE;
        const pr = NP(dPred.get(x));
        // 手前が無い: 区間の端(図の外へ続く)はまっすぐな線、線路の終わり(車止め)は行き止まり、それ以外はこの向きに列車が来ない線
        if (!pr.length) { what = (dPred.get(x) || []).length ? 'plain' : adj[dBeg(x)].length <= 1 ? 'dead' : 'none'; break; }
        if (dSecOf[pr[0] >> 1] < 0) break;
        if (pr.length >= 2 || pr.some(q => NP(dSuccOf(q)).length >= 2)) { what = 'sw'; break; }
        let b = pr[0]; for (const f of pr) if (dDot(f, x) > dDot(b, x)) b = f; x = b; uE = dEm[x >> 1];
      }
      if (what === 'sig' || what === 'stop' || what === 'none') continue;
      if (what === 'dead') { dPlaceBack(de, dEm[de >> 1], 20, 60, '入換', null); continue; }
      if (what === 'sw') {
        if (len >= 150 && beyondPlat(de)) dPlaceBack(de, dEm[de >> 1], 15, 150, '出発', null);
        else if (!(facing ? len >= 300 : false)) inner.push(de);
        else dPlaceBack(de, dEm[de >> 1], need, need + 50, '場内', null);
        continue;
      }
      dPlaceBack(de, dEm[de >> 1], need, need + 50, '場内', null);
    }
    // 第2場内: 手前の信号機に近いものから順に(置くたびに距離が変わる)
    inner.sort((a, b) => backSig(a, 900) - backSig(b, 900));
    for (const de of inner) { if (backSig(de, 900) > 250) dPlaceBack(de, dEm[de >> 1], 60, 110, '駅内場内', null); }
    // ホームの入口の手前 250m 以内に信号機が無ければ、入口の 40m 手前に閉塞(出発が停止のとき、遠くの信号機から警戒 25km/h で這わない)
    for (const [de, uIn] of platIn) {
      let x = de, uE = uIn, len = 0, far = Infinity;
      for (let g = 0; g < 60 && len < 900; g++) {
        const q = (sigByDe.get(x) || []).filter(q => q.u <= uE + 0.01 && q.kind !== '中継'); if (q.length) { far = len + uE - Math.max(...q.map(q => q.u)); break; }
        len += Math.max(0, uE); const pr = NP(dPred.get(x)); if (!pr.length || dSecOf[pr[0] >> 1] < 0) break;
        let b = pr[0]; for (const f of pr) if (dDot(f, x) > dDot(b, x)) b = f; x = b; uE = dEm[x >> 1];
      }
      if (far > 250 && far < Infinity) dPlaceBack(de, uIn, 40, 40, '閉塞', null);
    }
    // 区間の入口(図の外から入ってくる所)も信号機の区切りとみなす
    const entries = sec.entries;
    // 3) 分岐の無い一本道に、約 BLK m ごとの閉塞信号(分岐の出口からは 60m 以上あける)
    const BLK = (DC.dispatch && DC.dispatch.blockLen) || 300;
    const walk = (de, u0) => {   // de 上の u0 から先へ、次の信号機・分岐・合流・区間の端まで。[{de,u0,u1}] と全長
      const path = []; let len = 0, cur = de, u = u0;
      for (let g = 0; g < 60; g++) {
        const L = dEm[cur >> 1], nx = (sigByDe.get(cur) || []).find(s => s.u > u + 0.01);
        if (nx) { path.push({ de: cur, u0: u, u1: nx.u }); len += nx.u - u; return { path, len, end: 'sig' }; }
        path.push({ de: cur, u0: u, u1: L }); len += L - u;
        const sc = NP(dSuccOf(cur)); if (sc.length !== 1 || NP(dPred.get(sc[0])).length > 1) return { path, len, end: 'sw' };
        cur = sc[0]; u = 0;
      }
      return { path, len, end: 'far' };
    };
    const starts = [];
    for (const [de, list] of sigByDe) if (dSecOf[de >> 1] === DSEC.indexOf(sec)) for (const s of list) starts.push([de, s.u, 0]);
    for (const de of entries) starts.push([de, 0, 0]);
    for (const de of des) if (isSwBeg(de) && !(sigByDe.get(de) || []).some(s => s.u < 60)) starts.push([de, 0, 60]);
    for (const [de, u, off] of starts) {
      const w = walk(de, u), k = Math.round((w.len - off) / BLK); if (k < 2) continue;
      const step = (w.len - off) / k;
      for (let i = 1; i < k; i++) { let x = off + step * i; for (const p of w.path) { const l = p.u1 - p.u0; if (x <= l) { dAddSig(p.de, p.u0 + x, '閉塞', null); break; } x -= l; } }
    }
  }
  // 推定の信号機を手で直したもの(手で置いた一覧の無い区間だけ)
  const auto = de => !(D_SIGMAN && D_SIGMAN.noest && D_SIGMAN.noest[DSEC[dSecOf[de >> 1]].id]);
  for (const id of DC.signals.kill || []) for (const [de, list] of sigByDe) { if (!auto(de)) continue; const i = list.findIndex(s => dSigId(s) === id); if (i >= 0) list.splice(i, 1); }
  for (const a of DC.signals.add || []) if (auto(a.e * 2 + a.d)) dAddSig(a.e * 2 + a.d, a.u, a.kind || '閉塞', a.st || null);
  // 手で直した区間: 今の推定から、消した推定・置き換えた推定を外して、手で置いた信号機を足す
  if (D_SIGMAN) { const legacy = D_SIGMAN.v !== 2;
    DSEC.forEach((sec, si) => { const man = D_SIGMAN.list[sec.id]; if (!man || (D_SIGMAN.noest && D_SIGMAN.noest[sec.id])) return;
      for (const x of (D_SIGMAN.del && D_SIGMAN.del[sec.id]) || []) { const p = dSigLocate(si, x.km, x.y, x.dn); if (p) dManDrop(p, 15); }
      for (const sp of man) { if (sp.est) continue;
        if (sp.from) { const p = dSigLocate(si, sp.from.km, sp.from.y, sp.from.dn); if (p) dManDrop(p, 15); }
        else if (legacy) { const p = dSigLocate(si, sp.km, sp.y, sp.dn); const g = p && dManDrop(p, 60); if (g) { const P = dPosOf(g.de, g.u); sp.from = { k: g.kind, km: Math.round(P.km * 1e4) / 1e4, y: Math.round(P.y * 100) / 100, dn: dDn(g.de) }; } }
      }
      for (let i = man.length - 1; i >= 0; i--) if (man[i].est) man.splice(i, 1);   // 推定の位置のままのものは持たない(いつも今の推定を使う)
      dManAdd(si, man, reps); });
    if (legacy) D_SIGMAN.v = 2; }
  for (const [, list] of sigByDe) for (const s of list) SIGS.push(s);
  SIGS.push(...reps);
  SIGS.forEach((s, i) => {
    s.i = i; s.id = dSigId(s); const P = dPosOf(s.de, s.u);
    s.f = P.f; s.km = P.km; s.by = P.by;
    const v = dVec(s.de); s.down = v[0] > 0.05 ? true : v[0] < -0.05 ? false : null;
    s.sec = dSecOf[s.e];
    if (!s.st) { let best = null, bd = 0.9; const lk = DSEC[s.sec].sc.link && DSEC.find(q => q.id === DSEC[s.sec].sc.link.sec && !q.sc.kmNeg && !DSEC[s.sec].sc.kmNeg), jk = D_JOIN.filter(J => J.so === s.sec).map(J => dKm[J.ni]); for (const [nm, info] of [...DSEC[s.sec].stInfo, ...(lk ? [...lk.stInfo].filter(([, q]) => jk.some(k => Math.abs(k - q.km) < 0.9)) : [])]) { const d = Math.abs(info.km - s.km); if (d < bd) { bd = d; best = nm; } } s.st = s.kind === '閉塞' ? null : best; }   // 支線の分かれ目の信号機は、本線の駅(京急蒲田など。同じ軸)も候補に(つなぎの線のそばの駅だけ。本線と軸が同じなので、久里浜線の北久里浜〜京急久里浜に浦賀の名前が付いていた)
    const sc = DSEC[s.sec].sc; s.dn = s.down == null ? null : sc.kmMirror != null ? !s.down : s.down;   // 名前の上り・下り(空港線・大師線は図で本線と逆向きに載せているので、図の右向き=京急蒲田・京急川崎へ向かう=上り)。s.down は図の向き(描く側)のまま
    s.name = (s.st ? s.st + ' ' : '') + (s.dn == null ? '' : s.dn ? '下り' : '上り') + s.kind + (s.kind === '閉塞' || s.kind === '中継' ? ' ' + dKmShow(sc, s.km).toFixed(2) + 'k' : '') + (s.spec && s.spec.to ? '(→' + (s.spec.to.n || '指定の進路') + ')' : '');
  });
  // 中継信号機: まっすぐ先の、最初の(区切りになる)信号機
  for (const s of reps) {
    let de = s.de, u = s.u; s.next = null;
    for (let g = 0; g < 40 && !s.next; g++) {
      const nx = (sigByDe.get(de) || []).find(x => x.u > u + 0.01); if (nx) { s.next = nx; break; }
      const sc = dSuccOf(de); if (!sc.length) break; let b = sc[0]; for (const f of sc) if (dDot(de, f) > dDot(de, b)) b = f; de = b; u = -1;
    }
  }
}

// ===== 置き方の確かめ(鉄道信号の規定の目安。スキル tetsudo-shingou) =====
// D_SIGWARN: 信号機 → [理由]、D_LOCWARN: 信号機の無い場所(守られていない分岐)の [{sec, km, by, down, msg}]
const D_SIGWARN = new Map(), D_LOCWARN = [];
const D_ANAME = { R: '停止', YY: '警戒', Y: '注意', YG: '減速', YGF: '抑速', G: '進行' };
const dNP = list => (list || []).filter(f => !E[f >> 1].portal);
// 信号機から前へ(分岐ではまっすぐ): 最初の分岐(sw: 距離・対向/背向)と次の信号機(nx: 中継を除く)
function dWalkF(s, max) {
  let de = s.de, u = s.u, len = 0, sw = null, nx = null;
  for (let g = 0; g < 80 && len <= max; g++) {
    const L = dEm[de >> 1];
    if (!nx) { const ns = (sigByDe.get(de) || []).find(x => x !== s && x.u > u + 0.01 && x.kind !== '中継'); if (ns) nx = { s: ns, d: len + ns.u - u }; }
    len += L - u;
    const sc = dNP(dSuccOf(de));
    if (!sw && len <= max) { if (sc.length >= 2) sw = { d: len, t: '対向' }; else if (sc.length === 1 && dNP(dPred.get(sc[0])).length >= 2) sw = { d: len, t: '背向' }; }
    if ((sw && nx) || !sc.length) break;
    let b = sc[0]; for (const f of sc) if (dDot(de, f) > dDot(de, b)) b = f; de = b; u = 0;
  }
  return { sw, nx };
}
// 信号機から後ろへ: 止まるホーム(st)と最初の分岐(sw)
function dWalkB(s, max) {
  let de = s.de, uE = s.u, len = 0, sw = null, st = null;
  for (let g = 0; g < 80 && len <= max && !st; g++) {
    const e = de >> 1, x = stopX[e];
    if (!isNaN(x) && edgeStation[e] >= 0) { const us = dStopU(e, de & 1, x); if (us <= uE + 0.01) { st = { d: len + uE - us, name: ST[edgeStation[e]].name }; break; } }
    len += uE;
    const pr = dNP(dPred.get(de));
    if (!sw && (pr.length >= 2 || pr.some(p => dNP(dSuccOf(p)).length >= 2))) sw = { d: len };
    if (!pr.length) break;
    let b = pr[0]; for (const f of pr) if (dDot(f, de) > dDot(b, de)) b = f; de = b; uE = dEm[de >> 1];
  }
  return { st, sw };
}
const dVlineAt = (si, km) => { let v = ASP.G; for (const [k0, k1, w] of DSEC[si].vmax || []) if (km >= k0 && km <= k1) v = Math.min(v, w); return v; };
function dSigCheck() {
  D_SIGWARN.clear(); D_LOCWARN.length = 0;
  const add = (s, m) => { if (!D_SIGWARN.has(s)) D_SIGWARN.set(s, []); D_SIGWARN.get(s).push(m); };
  const nAsp = (n, L) => n === 0 ? 'R' : n === 1 ? (L < 260 ? 'YY' : 'Y') : n === 2 ? 'YG' : n === 3 ? 'YGF' : 'G';
  const grp = new Map();
  for (const s of SIGS) {
    if (s.kind === '中継') continue;
    const k = s.de + ':' + Math.round(s.u / 4); if (!grp.has(k)) grp.set(k, []); grp.get(k).push(s);
    if (s.toE === -1) add(s, '指定した進路の線が見つかりません');
    const vl = dVlineAt(s.sec, s.km), f = dWalkF(s, 1500);
    if (s.kind === '場内') {
      const need = vl < 100 ? 80 : 100;
      if (!f.sw || (f.nx && f.nx.d < f.sw.d && f.nx.s.kind === '閉塞')) add(s, '先に分岐がありません(場内は分岐の手前に置く。分岐の無い所なら閉塞)');
      else if (f.sw.d < need) add(s, `最初の分岐(${f.sw.t})まで ${Math.round(f.sw.d)}m。${need}m以上が目安(駅間の最高速度 ${vl < 100 ? '100km/h未満' : '100km/h以上'})`);
    }
    if (s.kind === '駅内場内' && !f.sw && !(f.nx && f.nx.s.kind === '出発')) add(s, '先に分岐も出発信号機もありません(駅内場内は構内の分岐やホームの手前に置く)');
    if (s.kind === '出発') {
      const b = dWalkB(s, 500);
      if (!b.st && !b.sw) add(s, '手前500m以内に止まるホームも分岐もありません');
      else if (b.st && b.sw && b.sw.d < b.st.d) add(s, `ホーム(${b.st.name})と出発の間に分岐があります。出発は分岐の手前に置く`);
      if (f.sw && f.sw.d < D_OVR) add(s, `過走余裕 ${Math.round(f.sw.d)}m(${D_OVR}m未満): 先の分岐がほかの列車に使われているとき、手前の信号機は警戒(出せなければ停止)`);
    }
    if (s.kind === '閉塞' && f.sw && (!f.nx || f.sw.d < f.nx.d)) add(s, `区間の中に分岐(${Math.round(f.sw.d)}m先)があります。分岐を含む所は場内・出発で守る`);
    // 区間の長さと現示: 次の信号機の現示まで落としきれるか(常用最大ブレーキ・空走3秒。C-ATS は照査を超えると常用最大で落とす)
    if (f.nx && s.kind !== '入換') {
      const L = f.nx.d; let worst = null;
      for (let n = 0; n <= 3; n++) {
        const A1 = dHeadAsp(s, nAsp(n + 1, L)), A2 = dHeadAsp(f.nx.s, nAsp(n, 1e9));
        const v1 = Math.min(ASP[A1] != null ? ASP[A1] : ASP.G, vl), v2 = A2 === 'R' ? 0 : Math.min(ASP[A2] != null ? ASP[A2] : ASP.G, vl);
        if (v1 <= v2) continue;
        const need = v1 / 3.6 * 3 + (v1 * v1 - v2 * v2) / (7.2 * DTR.brakeMax);
        if (need > L && (!worst || need - L > worst.need - L)) worst = { need, A1, A2, v1, v2 };
      }
      if (worst) add(s, `区間 ${Math.round(L)}m: ${D_ANAME[worst.A1]}(${worst.v1}km/h)から次の${D_ANAME[worst.A2]}(${worst.v2}km/h)まで落とすには約${Math.round(worst.need)}m要る(常用最大 ${DTR.brakeMax}km/h/s・空走3秒)`);
    }
  }
  for (const [, g] of grp) if (g.length >= 2 && g.some(s => !(s.spec && s.spec.to))) for (const s of g) add(s, `同じ場所に信号機が${g.length}基あります。それぞれに進路を指定する`);
  // 守られていない分岐: 対向・背向とも、手前 500m 以内に場内・出発・入換が無い
  for (let si = 0; si < DSEC.length; si++) for (const e of DSEC[si].edges) for (const d of [0, 1]) {
    if (!dAllowed(e, d) || E[e].portal) continue; const de = e * 2 + d, sc = dNP(dSuccOf(de));
    const facing = sc.length >= 2, trailing = sc.length === 1 && dNP(dPred.get(sc[0])).length >= 2; if (!facing && !trailing) continue;
    let ok = false, x = de, uE = dEm[e], len = 0;
    for (let g = 0; g < 60 && len <= 500 && !ok; g++) {
      if ((sigByDe.get(x) || []).some(q => q.u <= uE + 0.01 && (dIsHome(q.kind) || q.kind === '出発' || q.kind === '入換'))) { ok = true; break; }
      len += uE; const pr = dNP(dPred.get(x)); if (!pr.length && !(dPred.get(x) || []).length && adj[dBeg(x)].length > 1) { ok = true; break; }   // この向きに列車が来ない線
      if (!pr.length || dSecOf[pr[0] >> 1] < 0) break;
      let b = pr[0]; for (const f of pr) if (dDot(f, x) > dDot(b, x)) b = f; x = b; uE = dEm[x >> 1];
    }
    if (!ok) { const P = dPosOf(de, dEm[e]); D_LOCWARN.push({ sec: si, km: P.km, by: P.by, down: dDn(de) === 1, msg: `${facing ? '対向' : '背向'}の分岐 ${dKmShow(DSEC[si].sc, P.km).toFixed(3)}km(${(dDn(de) === 1) !== (DSEC[si].sc.kmMirror != null) ? '下り' : '上り'}方向)を守る場内・出発・入換が、手前500m以内にありません` }); }
  }
}
// 信号機を置き直す(画面で編集したとき)。列車の経路の表は作り直す
function dRebuildSignals(list) {
  const keep = []; for (const t of list || []) if (t.ph) keep.push([t, t.ph]);   // 走っている列車の状態(停車中か・次の停車駅・速さ・遅れ)
  sigByDe.clear(); SIGS.length = 0; dBuildSignals(); dSigCheck();
  for (const t of list || []) { t.ph = null; t.dLocks = null; t.dStill = false; t.dp = null; }
  D_LOCK.clear(); D_LOCKN.clear(); for (const [, S] of D_SGL) S.run.lock = null;
  // 画面で信号機を置き直したとき: 状態を捨てると、停車中の列車が発車時刻を待たずに走り出し(次の停車駅を飛ばす)、速さも時刻表の速さに変わり、時刻表の終わりを過ぎて走っていた列車は消えた。新しい信号機で区間を取り直し、状態はそのまま続ける
  for (const [t, o] of keep) { const dp = dPrep(t), rg = dp.ranges.find(r => o.m >= r.m0 - 0.01 && (o.m < r.m1 || (r.i1 === t.route.segs.length && o.m <= r.m1 + 1))); if (rg) dStart(t, D_NOW, rg, o); }
}
function dSigId(s) { return s.e + (s.d ? 'b' : 'f') + Math.round(s.u); }

// ===== 列車ごとの経路の実距離表 =====
const D_TOVIEW = 2500;   // 進路別の信号機: この距離(m)先までに指定の線を通るなら、その進路の列車
// 信号機の先の進路の選択肢: 次の信号機(中継を除く)か 1500m までの間の分岐で分かれる行き先。[{ de: 見分ける線, n: 名前, path }]
function dRouteOpts(s) {
  const leaves = [], own = edgeStation[s.de >> 1];
  // 場内なら入る駅のホーム、出発・閉塞なら次の信号機まで。ホームの線に入ったらそこで止める(その先の引上線・留置線は、その駅の出発の進路)
  const atPlat = de => { const si = edgeStation[de >> 1]; return si >= 0 && si !== own; };
  const go = (de, u, len, path, br, depth) => {
    for (let g = 0; g < 80; g++) {
      if (path.length > 1 && atPlat(de)) { leaves.push({ path, br }); return; }
      const L = dEm[de >> 1], nx = (sigByDe.get(de) || []).find(x => x !== s && x.u > u + 0.01 && x.kind !== '中継');
      if (nx || len + L - u > 1500) { leaves.push({ path, br }); return; }
      len += L - u; const sc = dSuccPhys(de).filter(f => !E[f >> 1].portal);
      if (!sc.length) { leaves.push({ path, br, dead: true }); return; }
      if (sc.length >= 2 && depth < 3) { for (const f of sc) go(f, 0, len, path.concat([f]), br.concat([{ from: de, to: f }]), depth + 1); return; }
      let b = sc[0]; for (const f of sc) if (dDot(de, f) > dDot(de, b)) b = f; de = b; u = 0; path = path.concat([b]);
    }
    leaves.push({ path, br });
  };
  go(s.de, s.u, 0, [s.de], [], 0);
  const opts = leaves.filter(l => l.br.length).map(l => {
    const last = l.br[l.br.length - 1].to; let stN = null;
    const own = edgeStation[s.de >> 1]; let left = own < 0;   // 信号機のある駅(ホームの端の出発など)は飛ばす
    for (const de of l.path) { const si = edgeStation[de >> 1]; if (si !== own) left = true; if (si >= 0 && left && si !== own) { stN = ST[si].name; break; } }
    if (!stN) { let de = l.path[l.path.length - 1], len = 0;   // 進路の先の信号機までに駅が無ければ、まっすぐ 800m 先まで見る
      for (let g = 0; g < 40 && len < 800 && !stN; g++) { const sc = dSuccPhys(de).filter(f => !E[f >> 1].portal); if (!sc.length) break; let b = sc[0]; for (const f of sc) if (dDot(de, f) > dDot(de, b)) b = f; de = b; len += dEm[de >> 1]; const si = edgeStation[de >> 1]; if (si >= 0) stN = ST[si].name; } }
    const straight = l.br.every(b => dSuccPhys(b.from).every(f => dDot(b.from, f) <= dDot(b.from, b.to) + 1e-6));
    const end = l.path[l.path.length - 1], P = dPosOf(end, dEm[end >> 1] / 2);
    // 行き止まり(引上線・留置線)、反対方向の線へ渡る(上り→下り)、逆線(線の向きと逆に走る)を見分ける
    const dead = !!l.dead && !l.path.some(de => edgeStation[de >> 1] >= 0 && !stN);
    const against = de => !D_USED.has(de) && D_USED.has(de ^ 1);   // 計画の列車がこの線を逆向きにだけ走っている(線の向きの印は推定で当てにならない)
    const rev = !dead && against(end), cross = rev && !against(s.de);   // 行き先の線を、その線の向きと逆に走る(上り線から下り線へ渡るなど)
    // 駅のホームの線で止めた進路は、そのホームの線で見分ける(渡り方が違っても行き先が同じなら同じ進路)
    return { de: atPlat(end) ? end : last, path: l.path, stN: dead ? null : stN, straight, y: P.y, dead, rev, cross, plan: l.path.every(de => dAllowed(de >> 1, de & 1)) };
  });
  // 同じ「見分ける線」になるものはまとめる
  const uniq = []; for (const o of opts) { const u = uniq.find(x => (x.de >> 1) === (o.de >> 1)); if (!u) uniq.push(o); else { u.straight = u.straight || o.straight; u.cross = u.cross && o.cross; u.rev = u.rev && o.rev; } }
  const ys = [...uniq].sort((a, b) => a.y - b.y);
  for (const o of uniq) {
    const r = ys.indexOf(o), pos = ys.length === 2 ? (r ? '下の線' : '上の線') : ys.length === 3 ? ['上の線', '中の線', '下の線'][r] : '上から' + (r + 1) + '本目';
    o.n = (o.dead ? '引上線・留置線 ' : o.stN ? o.stN + ' ' : '') + pos + (o.straight ? '・直進' : '') + (o.cross ? '・反対方向の線へ渡る' : o.rev ? '・逆線' : '');
  }
  return uniq;
}
function dPrep(t) {
  const r = t.route; if (t.dp && t.dp.r === r) return t.dp;
  const segs = r.segs, n = segs.length, M = new Float64Array(n + 1);
  let m = 0;
  for (let i = 0; i < n; i++) { M[i] = m; m += Math.abs(segs[i].t1 - segs[i].t0) * dEm[segs[i].e]; }
  M[n] = m;
  const ranges = []; let cur = null;
  // 区間どうしが「※」のつなぎ(長さ0)だけで続くところ(泉岳寺 ⇔ 都営浅草線の区間など)は、1つの続いた範囲にする。分けると、次の区間の入口の待ち合わせ(dEntryHold)を通らずに走り出し、前の列車のいる閉塞に入ってしまう
  const inSec = i => { if (dSecOf[segs[i].e] >= 0) return true; if (!E[segs[i].e].portal) return false; let a = i - 1, b = i + 1; while (a >= 0 && E[segs[a].e].portal) a--; while (b < n && E[segs[b].e].portal) b++; return a >= 0 && b < n && dSecOf[segs[a].e] >= 0 && dSecOf[segs[b].e] >= 0; };
  for (let i = 0; i < n; i++) { const g = segs[i], ins = inSec(i); if (ins && !cur) { cur = { i0: i, m0: M[i], sec: dSecOf[g.e] }; ranges.push(cur); } if (!ins && cur) { cur.i1 = i; cur.m1 = M[i]; cur = null; } }
  if (cur) { cur.i1 = n; cur.m1 = M[n]; }
  for (const r of ranges) { r.secs = new Set(); for (let i = r.i0; i < r.i1; i++) if (dSecOf[segs[i].e] >= 0) r.secs.add(dSecOf[segs[i].e]); }   // 範囲が通る区間
  const sig = [];
  for (let i = 0; i < n; i++) {
    const g = segs[i]; if (dSecOf[g.e] < 0) continue;
    const list = sigByDe.get(g.e * 2 + g.d); if (!list) continue;
    for (const s of list) { const ts = s.f, lo = Math.min(g.t0, g.t1) - 1e-9, hi = Math.max(g.t0, g.t1) + 1e-9; if (ts < lo || ts > hi) continue;
      if (s.toE != null) { let ok = false; for (let k = i; k < n && M[k] - M[i] < D_TOVIEW; k++) if (segs[k].e === s.toE) { ok = true; break; } if (!ok) continue; }
      sig.push({ s, m: M[i] + Math.abs(ts - g.t0) * dEm[g.e] }); }
  }
  sig.sort((a, b) => a.m - b.m);
  // 同じ場所に進路別の信号機があって、この列車の進路のものがあれば、進路の決まっていない(全部の進路の)信号機は使わない(残りの進路を受け持つ)
  for (let k = sig.length - 1; k >= 0; k--) { const x = sig[k]; if (x.s.toE != null) continue; if (sig.some(y => y !== x && y.s.toE != null && y.s.toE >= 0 && y.s.de === x.s.de && Math.abs(y.s.u - x.s.u) < 4)) sig.splice(k, 1); }
  // 分岐器の速度制限: 分かれる側・合流する側(まっすぐでない側)を通る区間
  const lim = [];
  for (let i = 0; i + 1 < n; i++) {
    const a = segs[i], b = segs[i + 1]; if (dSecOf[a.e] < 0 || dSecOf[b.e] < 0 || a.e === b.e) continue;
    const da = a.e * 2 + a.d, db = b.e * 2 + b.d, sc = dSuccOf(da), pr = dPred.get(db) || [];
    if (sc.length >= 2 && sc.some(x => dDot(da, x) > dDot(da, db) + 0.02)) lim.push({ m0: M[i + 1], m1: Math.max(M[i + 2], M[i + 1] + 25), v: KMH(DTR.turnout) });
    if (pr.length >= 2 && pr.some(x => dDot(x, db) > dDot(da, db) + 0.02)) lim.push({ m0: Math.min(M[i], M[i + 1] - 25), m1: M[i + 1], v: KMH(DTR.turnout) });
  }
  // 線区の最高速度(キロ程で指定)
  for (const rg of ranges) {
    for (let i = rg.i0; i < rg.i1; i++) {
      const g = segs[i], e = E[g.e]; if (e.portal || dSecOf[g.e] < 0) continue;
      const vm = DSEC[dSecOf[g.e]].vmax || [];   // 区間をまたぐ範囲もあるので、線ごとにその区間の最高速度
      const kA = dKm[e.a] + (dKm[e.b] - dKm[e.a]) * g.t0, kB = dKm[e.a] + (dKm[e.b] - dKm[e.a]) * g.t1;
      for (const [k0, k1, v] of vm) {
        const lo = Math.max(Math.min(kA, kB), k0), hi = Math.min(Math.max(kA, kB), k1); if (hi <= lo) continue;
        const fa = (lo - kA) / ((kB - kA) || 1e-9), fb = (hi - kA) / ((kB - kA) || 1e-9), ma = M[i] + Math.min(fa, fb) * (M[i + 1] - M[i]), mb = M[i] + Math.max(fa, fb) * (M[i + 1] - M[i]);
        if (v < ASP.G) lim.push({ m0: ma, m1: mb, v: KMH(v) });
      }
    }
  }
  lim.sort((a, b) => a.m0 - b.m0);
  const dp = t.dp = { r, M, total: m, ranges, sig, lim, s2m: null };
  dp.s2m = s => { if (s <= 0) return s * DISP_FALL; if (s >= r.total) return m + (s - r.total) * DISP_FALL; let lo = 0, hi = n - 1; while (lo < hi) { const k = (lo + hi) >> 1; if (segs[k].d1 < s) lo = k + 1; else hi = k; } const g = segs[lo], L = g.d1 - g.d0; return M[lo] + (L > 0 ? (s - g.d0) / L : 0) * (M[lo + 1] - M[lo]); };
  dp.m2s = x => { if (x <= 0) return x / DISP_FALL; if (x >= m) return r.total + (x - m) / DISP_FALL; let lo = 0, hi = n - 1; while (lo < hi) { const k = (lo + hi) >> 1; if (M[k + 1] < x) lo = k + 1; else hi = k; } const g = segs[lo], L = M[lo + 1] - M[lo]; return g.d0 + (L > 0 ? (x - M[lo]) / L : 0) * (g.d1 - g.d0); };
  // 経路上の [a, b](m) を、エッジごとの区間(エッジの a 側からの m)にする
  dp.spans = (a, b, out) => { out = out || []; if (b <= 0 || a >= m) return out; let lo = 0, hi = n - 1; while (lo < hi) { const k = (lo + hi) >> 1; if (M[k + 1] < a) lo = k + 1; else hi = k; }
    for (let i = lo; i < n && M[i] < b; i++) { const g = segs[i], L = M[i + 1] - M[i]; if (L <= 0) continue; const x0 = Math.max(a, M[i]), x1 = Math.min(b, M[i + 1]); if (x1 <= x0) continue;
      const p0 = g.t0 + (g.t1 - g.t0) * (x0 - M[i]) / L, p1 = g.t0 + (g.t1 - g.t0) * (x1 - M[i]) / L, Em = dEm[g.e]; out.push({ e: g.e, lo: Math.min(p0, p1) * Em, hi: Math.max(p0, p1) * Em, i, m0: x0, m1: x1 }); }
    return out; };
  // エッジ上の位置(エッジの a 側からの m) → この経路の m(その範囲を通っていなければ NaN)。from より先だけ
  dp.onRoute = (e, x, from) => { for (let i = 0; i < n; i++) { const g = segs[i]; if (g.e !== e || M[i + 1] < from) continue; const Em = dEm[e], p = x / Em, lo = Math.min(g.t0, g.t1), hi = Math.max(g.t0, g.t1); if (p < lo - 1e-9 || p > hi + 1e-9) continue; return M[i] + Math.abs(p - g.t0) * Em; } return NaN; };
  // 停車駅と時刻
  dp.stops = (t.sd || []).map((d, k) => { const i = k - t.k0, ev = t.ev[i], nm = t.names[i] || null, m = dp.s2m(d), sec = dSecOf[segAt(r, Math.max(0, Math.min(r.total, d))).e], info = sec >= 0 && nm ? DSEC[sec].stInfo.get(nm) : null;
    const wt = !!(ev && (ev.ot || ev.wait || ev.dep - ev.arr >= 1 || (t.long && t.long[i])));   // 待避・接続などで長く止まる駅
    return { m, A: t.A[k], P: t.P[k], thru: !!(ev && ev.thru), name: nm, k, half: info ? info.len / 2 : 0, minDw: wt ? DTR.minDwellWait : DTR.minDwell }; });
  for (const st of dp.stops) { const nx = sig.find(x => x.m > st.m + 1); st.xmax = nx ? nx.m - 12 : Infinity; }   // 止まる位置は、その先の信号機の手前まで
  dp.kn = (t.kn || []).map(K => ({ t: K.t, m: dp.s2m(K.d), stop: K.stop }));
  dp.blocks = [];
  return dp;
}
// 経路の区切り g が線(エッジ)の端まで行っていれば、その端の点。途中(停止位置などで分かれたところ)で終わっていれば -1
const dSegEndN = g => (g.d ? g.t1 <= 1e-6 : g.t1 >= 1 - 1e-6) ? (g.d ? E[g.e].a : E[g.e].b) : -1;
// 区間(ブロック) j: 経路上の信号機 j から j+1 まで(j = -1 は区間の入口から最初の信号機まで)
function dBlock(t, j, rg) {
  const dp = t.dp; let b = j < 0 ? dp.ranges[-1 - j].blk : dp.blocks[j]; if (b) return b;
  if (j < 0) rg = dp.ranges[-1 - j]; else { const m0 = dp.sig[j].m, r2 = dp.ranges.find(r => m0 >= r.m0 - 0.01 && m0 < r.m1); if (r2) rg = r2; }   // 信号機が入っている範囲で作る(別の範囲を渡されて終わりが手前の空のブロックが残り、押さえたつもりで先を取っていた 781K/725N 2026-11-04)
  let a = j < 0 ? rg.m0 : dp.sig[j].m;
  let z = rg.m1; for (let k = Math.max(0, j + 1); k < dp.sig.length; k++) if (dp.sig[k].m > a + 0.01) { z = Math.min(z, dp.sig[k].m); break; }   // 区間に2回目以降に入る所(j<-1)でも、先の信号機を最初から探す
  if (j < 0) { const i0 = rg.i0; let k = i0 - 1; while (k >= 0 && D_BI.has(t.route.segs[k].e)) k--; a = dp.M[k + 1]; }
  if (z === rg.m1 && rg.i1 < t.route.segs.length) { let k = rg.i1; while (k < t.route.segs.length && D_BI.has(t.route.segs[k].e)) k++; z = dp.M[k]; }
  const spans = dp.spans(a, z), nodes = [];
  for (let i = 0; i < spans.length; i++) { const g = t.route.segs[spans[i].i]; const nd = dSegEndN(g); const mEnd = dp.M[spans[i].i + 1]; if (nd >= 0 && mEnd <= z + 0.01 && mEnd > a && adj[nd].length >= 3) nodes.push({ n: nd, m: mEnd }); }
  for (const s of spans) for (const x of D_XBY.get(s.e) || []) { if (x.u <= s.lo + 0.01 || x.u >= s.hi - 0.01) continue; const g = t.route.segs[s.i], fwd = g.t1 >= g.t0; nodes.push({ n: x.n, m: fwd ? s.m0 + (x.u - s.lo) : s.m0 + (s.hi - x.u) }); }   // シーサス(ノードを共有せずに交わる渡り線)の交差点: 分岐と同じく進路で押さえる
  b = { j, a, z, spans, nodes, len: z - a }; if (j < 0) rg.blk = b; else dp.blocks[j] = b; return b;
}

// ===== 運転の状態 =====
let dispOn = true, dispReady = true;   // dispReady: 時刻表の経路と待避の計算(dispPlan)が終わるまでは走らせない
const D_OCC = new Map(), D_OCCN = new Map(), D_LOCK = new Map(), D_LOCKN = new Map();
const D_EV = [];
let D_LOSS = null;   // 検査用: 予定外に止まった・発車が遅れた秒数を原因ごとに足す(disp_run で Map を入れる)
const dLoss = (k, dt) => D_LOSS.set(k, (D_LOSS.get(k) || 0) + dt);   // 出来事の記録(非常ブレーキ・信号冒進・長い信号待ちなど)
let D_STAT = { spad: 0, emer: 0, sigwait: 0 };
const dPartner = (a, b) => a === b || a.cplWith === b || b.cplWith === a || a.next === b || b.next === a;   // 連結の相手・折り返しの前後(同じ車両)
const dLen = t => t.cut || t.unit ? 4 * DTR.carLen : Math.max(36, ((t.cars || 6) + (t.c12pre && (t.extB || t.extF) ? 4 : 0)) * DTR.carLen);   // c12pre: 金沢文庫で4両を切り離す下り(ttShape が切り離すまで extB/extF を付ける)
function dEvent(T, t, kind, text) { D_EV.push({ T, no: t ? t.no : '', kind, text }); if (D_EV.length > 400) D_EV.splice(0, D_EV.length - 400); }
// 1台ぶんの占有(エッジごとの区間)
function dOccOf(t) {
  const dp = dPrep(t), m = t.ph ? t.ph.m : dp.s2m(t.s), L = t.ph ? t.ph.L : dLen(t);
  return dp.spans(m - L / 2, m + L / 2);
}
function dBuildOcc(act) {
  D_OCC.clear(); D_OCCN.clear();
  for (const t of act) {
    if (!t.route || t.s == null || isNaN(t.s) || (t.gOut != null && D_NOW >= t.gOut)) continue;
    let sp; if (!t.ph && t._occS === t.s && t._occR === t.route && t._occC === t.cars && t._occL) sp = t._occL; else { sp = dOccOf(t); if (!t.ph) { t._occS = t.s; t._occR = t.route; t._occC = t.cars; t._occL = sp; } else t._occL = null; }   // 区間の外の列車は1回の中で動かないので、前の結果を使う(軽くするため)
    for (const s of sp) {
      if (!D_OCC.has(s.e)) D_OCC.set(s.e, []); D_OCC.get(s.e).push({ t, lo: s.lo, hi: s.hi, i: s.i });
      const Em = dEm[s.e]; if (s.lo < 12) D_OCCN.set(E[s.e].a, t); if (s.hi > Em - 12) D_OCCN.set(E[s.e].b, t);
      for (const x of D_XBY.get(s.e) || []) if (x.u >= s.lo - 12 && x.u <= s.hi + 12) D_OCCN.set(x.n, t);   // シーサスの交差点にかかっている
    }
    t.dOcc = sp; if (!t.ph) t.dStill = !!t.dwelling;
  }
}
// 区間 b を t のために確保できるか。0 = できない, 1 = できる, 2 = 誘導(止まっている列車の後ろへ)
const D_NODEQ = new Map();   // 分岐 → [{o 列車, d 経路上の位置, T 時刻表で通る時刻}](時刻の順)
let D_NOW = 0;
const D_ORDER = !(DC.dispatch && DC.dispatch.order === false);   // 分岐の進路を時刻表の順に作る(不具合を直した後の 2026-11-01 の検査で、平日 3分超 36→34・土休日 20→0)
// 列車 o が分岐(c)をもう通り過ぎたか
function dNodePassed(o, c) {
  if (o.ph) { const dpo = dPrep(o); return o.ph.m - o.ph.L / 2 > dpo.s2m(c.d) + 1; }
  if (o.sv != null && o.route) { const dpo = dPrep(o); return dpo.s2m(o.s) - dLen(o) / 2 > dpo.s2m(c.d) + 1; }   // s は図の上の長さ、列車の長さはメートル
  if (D_NOW > o.end + 5) return true;
  return c.T - D_NOW > 300;   // まだ現れていない列車は、5分以上先なら気にしない
}
// 列車 o が分岐に着きそうな時刻
function dNodeEta(o, c) {
  if (o.sv != null) { let eta = D_NOW + Math.max(0, dKnT(o, c.d) - dKnT(o, o.s)); if (o.ph && o.ph.mode === 'run' && o.ph.v < 0.1) eta += Math.min(o.ph.waitT || 0, D_SWAP); return eta; }
  if (o.prev && o.prev.ph) return c.T + Math.max(0, o.prev.ph.delay || 0);   // まだ現れていない折り返しの列車: 前の運用(同じ車両)の遅れだけ遅れる
  return c.T + Math.max(0, D_NOW - o.start);
}
// o が(前の列車などを介して)t を待っているか
function dChainTo(o, t) {
  let x = o;
  for (let g = 0; g < 10 && x; g++) { const nx = x.dByT || (x.ph && x.ph.v < 0.1 ? x.ph.obsT || x.ph.waitFor : null); if (!nx || nx === x) return false; if (nx === t || dPartner(nx, t)) return true; x = nx; }
  return false;
}
// 分岐の時刻がほぼ同じ(推定の時刻どうし)なら、そのあと両方が止まる最初の駅に o が先に着くか(着かないなら null)
function dFirstAtNext(o, cT, t, tT) {
  const later = (x, T0) => { const r = []; x.names.forEach((nm, i) => { const k = i + x.k0, ev = x.ev[i]; if (!(ev && ev.thru) && x.A[k] > T0) r.push([nm, x.A[k]]); }); return r; };
  const lo = new Map(later(o, cT - 1));
  for (const [nm, a] of later(t, tT)) if (lo.has(nm)) return lo.get(nm) < a;
  return null;
}
// 区間 b の分岐を、時刻表で先に通るはずの列車(まだ通っていない・5分以上は遅れていない・自分を待っていない)
function dOrderBlock(t, b) {
  if (!D_ORDER || !t.kn) return null;
  const oe = D_ENTORD ? dEntOrder(t, b) : null; if (oe) return oe;
  if (!D_NODEQ.size || !b.nodes.length) return null;
  for (const { n: nd, m } of b.nodes) {
    const q = D_NODEQ.get(nd); if (!q) continue;
    const sm = t.dp.m2s(m), own = q.find(c => c.o === t && Math.abs(c.d - sm) < 1.5), tT = own && own.R ? own.T : dKnT(t, sm); if (isNaN(tT)) continue;   // 相手の時刻(D_NODEQ)と同じ式で(dSchedAt はメートルで割り振るので、区間の外から長く止まらない列車ではずれる)
    for (const c of q) {
      if (c.T >= tT + 30) break;
      if (own && own.R && c.R) { if (c.T >= tT) continue; }   // 基準の走りの順
      else if (c.T > tT - 30 && c.o !== t) { const f = dFirstAtNext(c.o, c.T, t, tT); if (f === false || (f == null && c.T >= tT - 1)) continue; }   // 30秒以内に並ぶときは、次に両方が止まる駅に着く順
      else if (c.T >= tT - 1) continue;
      if (c.T < tT - 1200) continue;
      const o = c.o; if (o === t || dPartner(o, t)) continue;
      if (dNodePassed(o, c)) continue;
      const eta = dNodeEta(o, c); if (D_AUTO && eta > Math.max(D_NOW, tT) + D_SWAP) continue;
      if (!o.ph && eta > D_NOW + 60 && !(o.prev && o.prev.ph) && !(o.sv != null && o.route && dSecOf[segAt(o.route, Math.max(0, Math.min(o.route.total, o.s))).e] >= 0)) continue;   // 現れたばかりで区間の中にいる列車も同じ   // 前の運用が区間の中にいる折り返し(引上線から出る列車など)は区間の中の列車と同じに扱う   // 区間の外の列車には、すぐ(60秒以内に)来るときだけ譲る(譲らない版は土休日の3分超が 0→20 本に増えた)
      if (dChainTo(o, t)) { if (!D_AUTO) dDeadLog(t, o, '分岐'); continue; }
      const pv = !o.ph && o.prev && o.prev.ph && o.prev !== t && !dChainTo(o.prev, t) ? o.prev : null;   // 前の運用(同じ車両)が区間の中を走ってくる・着いたところの折り返しの列車(もうすぐ現れる)
      if (D_AUTO && ((o.dHeld && !pv) || (o.ph && o.ph.mode === 'run' && o.ph.v < 0.1 && (o.ph.waitT || 0) > 20))) continue;   // 相手が止められている(動けない)なら譲らない
      // 同じ相手に 90 秒以上譲ったら、順序を変えて先に行く
      const w = t.dOrdW || (t.dOrdW = new Map()); const mv = o.ph || (pv && pv.ph); if (!w.has(o) || (mv && mv.v > 0.5)) w.set(o, D_NOW); if (D_AUTO && D_NOW - w.get(o) > 90) continue;   // 相手が動いている間は数えない
      return o;
    }
  }
  return null;
}
// 区間の外から入ってくる列車(入口の区間)が、区間 b と同じ線路を使い、自分が b に着くより30秒以上前に入口に着くなら、先に入れる
// 区間の入口のすぐ内側で合流・単線を共用する所(京急蒲田の空港線: 600T が2分半前に進路を取り、空港線から着く 853D が入口で5分待った 2026-11-01)は分岐が区間の外にあり、D_NODEQ では順序がつかなかった
const D_ENTQ = [];   // [{o 列車, ri 何番目の区間, d 入口の位置(図), T 時刻表で入口を通る時刻}](時刻の順)
const D_ENTORD = !(DC.dispatch && DC.dispatch.entOrder === false);
function dEntOrder(t, b) {
  if (!D_ENTQ.length) return null;
  const tB = dKnT(t, t.dp.m2s(b.a)); if (isNaN(tB)) return null;
  const tE = D_NOW + Math.max(0, tB - dKnT(t, t.s));   // 自分が b に着きそうな時刻
  let lo = 0, hi = D_ENTQ.length; while (lo < hi) { const k = (lo + hi) >> 1; if (D_ENTQ[k].T < D_NOW - D_SWAP) lo = k + 1; else hi = k; }
  for (let i = lo; i < D_ENTQ.length; i++) {
    const c = D_ENTQ[i]; if (c.T > tE + D_SWAP) break;
    const o = c.o; if (o === t || dPartner(o, t) || o.ph || o.sv == null || !o.route || o.unit || o.cut || o.yard) continue;   // 区間の外に見えている列車だけ
    const dpo = dPrep(o), rg = dpo.ranges[c.ri]; if (!rg || dpo.s2m(o.s) >= rg.m0) continue;
    const eta = D_NOW + Math.max(0, dKnT(o, c.d) - dKnT(o, o.s)); if (eta > tE - 30 || (D_AUTO && eta > D_NOW + D_SWAP)) continue;
    if (o.dLocks && o.dLocks.has(-1 - c.ri)) continue;
    let hit = false; for (const ob of dEntNeed(o, rg, dBlock(o, -1 - c.ri, rg), dLen(o))) { for (const x of ob.spans) { for (const y of b.spans) if (x.e === y.e && x.lo < y.hi - 0.5 && y.lo < x.hi - 0.5) { hit = true; break; } if (hit) break; } if (hit) break; }
    if (!hit || dChainTo(o, t)) continue;
    const w = t.dOrdW || (t.dOrdW = new Map()); if (!w.has(o)) w.set(o, D_NOW); if (D_AUTO && D_NOW - w.get(o) > 90) continue;   // 同じ相手に 90 秒以上譲ったら先に行く
    return o;
  }
  return null;
}
// 止まっている列車が次に動く向き(エッジ e の上で、a→b なら +1、b→a なら -1、分からなければ 0)。着いて終わった列車は、同じ車両の次の運用の向き
function dNextDir(o, e) {
  const tr = o.t, sg = tr.route && tr.route.segs; if (!sg) return 0;
  const done = tr.ph ? tr.ph.done : tr.s >= tr.route.total - 0.5;
  if (!done && o.i != null && sg[o.i] && sg[o.i].e === e) return Math.sign(sg[o.i].t1 - sg[o.i].t0);
  const nx = done ? tr.next : null, ns = nx && nx.route && nx.route.segs; if (ns) for (let k = 0; k < Math.min(6, ns.length); k++) if (ns[k].e === e) return Math.sign(ns[k].t1 - ns[k].t0);
  return 0;
}
// 誘導で止まっている列車の後ろへ入ってよいか: その列車が、こちらへ向かって出ていくなら入れない(堀ノ内で、始発の下りが待つホームへ上りを誘導で入れ、互いに相手の前をふさいだ)
const dYudoDirOK = (t, s, o) => { const g = t.route.segs[s.i]; if (!g || g.e !== s.e) return true; const dn = dNextDir(o, s.e); return dn === 0 || dn === Math.sign(g.t1 - g.t0); };
// 止まっている列車が、いま止まっている区間に持っている進路(入換信号機なら、その後ろへ入ってよい)
const dStandLock = k => !!(k.t.dStill && k.t.ph && (k.j < 0 || k.j === k.t.ph.lastSig));
// 単線のまとまり: エッジ → { run, o }(o = そのエッジの a→b がまとまりの向きの +1 か -1)。run.lock = { dir, hold: Set(列車) }
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
  { const o = dSglBlocked(t, b); if (o) { t.dWhy = '単線 ' + o.no; t.dByT = o; return 0; } }   // 単線を反対向きに押さえている列車がいる   // dByT: ふさいでいる列車(待避の行き詰まりを見るのに使う)
  for (const s of b.spans) for (const q of D_SPAWNQ.get(s.e) || []) { const o = q.t; if (o !== t && !dPartner(o, t) && o !== t.next && o.sv == null && !o.ph && D_NOW >= o.start - 120 && D_NOW <= o.start + 600 && q.lo <= s.hi && s.lo <= q.hi) { t.dWhy = '入線待ち ' + o.no; t.dByT = o; return 0; } }   // これから(前の運用なしで)ホームに現れる列車の場所へは、現れる2分前から進路を取らない
  for (const s of b.spans) {
    for (const o of D_OCC.get(s.e) || []) if (!dPartner(o.t, t) && o.lo <= s.hi + 2 && s.lo <= o.hi + 2) { if ((yudoOK && o.t.dStill && dYudoDirOK(t, s, o)) || o.t === t.gTgt) res = 2; else { t.dWhy = '在線 ' + o.t.no; t.dByT = o.t; return 0; } }
    for (const k of D_LOCK.get(s.e) || []) if (!dPartner(k.t, t) && k.lo < s.hi - 0.5 && s.lo < k.hi - 0.5) { if (k.t === t.gTgt || (shunt && yudoOK && dStandLock(k))) { res = 2; continue; } t.dWhy = '進路 ' + k.t.no; t.dByT = k.t; return 0; }
  }
  for (const { n: nd } of b.nodes) { const o = D_LOCKN.get(nd); if (o && !dPartner(o.t, t) && o.t !== t.gTgt && !(shunt && yudoOK && dStandLock(o) && (res = 2))) { t.dWhy = '分岐の進路 ' + o.t.no; t.dByT = o.t; return 0; } const q = D_OCCN.get(nd); if (q && !dPartner(q, t) && q !== t.gTgt && !(yudoOK && q.dStill)) { t.dWhy = '分岐に在線 ' + q.no; t.dByT = q; return 0; } }
  if (order) { const o = dOrderBlock(t, b); if (o) { t.dWhy = '順序 ' + o.no; t.dByT = o; return 0; } }   // 分岐の進路は時刻表の順に(区間の中を走っている列車が前方の進路を取るときだけ)
  return res;
}
function dLock(t, b, kind) {
  dSglLock(t, b);
  for (const s of b.spans) { if (!D_LOCK.has(s.e)) D_LOCK.set(s.e, []); D_LOCK.get(s.e).push({ t, lo: s.lo, hi: s.hi, j: b.j, m1: s.m1 }); }
  for (const { n: nd, m } of b.nodes) D_LOCKN.set(nd, { t, j: b.j, m });
  (t.dLocks || (t.dLocks = new Map())).set(b.j, kind);
}
const dBlk = (t, j) => j < 0 ? t.dp.ranges[-1 - j].blk : t.dp.blocks[j];
function dUnlock(t, j) {
  const b = dBlk(t, j);
  if (b) { for (const s of b.spans) { const l = D_LOCK.get(s.e); if (l) { const k = l.findIndex(x => x.t === t && x.j === j); if (k >= 0) l.splice(k, 1); } } for (const { n: nd } of b.nodes) { const o = D_LOCKN.get(nd); if (o && o.t === t && o.j === j) D_LOCKN.delete(nd); } }
  b && (b.rel = null, b.ovrOK = false);
  t.dLocks.delete(j);
}
// 区分解錠: 後ろが通り過ぎた分岐・線路から先に解く(駅に止まっている列車が、通った分岐をふさぎ続けない)
function dRelPart(t, b, tail) {
  for (const s of b.spans) { if (s.m1 >= tail - 1) continue; const l = D_LOCK.get(s.e); if (!l) continue; const k = l.findIndex(x => x.t === t && x.j === b.j && x.lo === s.lo); if (k >= 0) l.splice(k, 1); }
  for (const { n: nd, m } of b.nodes) { if (m >= tail - 15) continue; const o = D_LOCKN.get(nd); if (o && o.t === t && o.j === b.j) D_LOCKN.delete(nd); }
}
function dUnlockAll(t) { if (!t.dLocks) return; for (const j of [...t.dLocks.keys()]) dUnlock(t, j); }
// 過走余裕: 経路上の信号機 j1(停止を現示していて、列車が手前で止まる)の先 D_OVR(m)以内にある分岐と、そこまでの線路が、ほかの列車に使われていないか
const D_OVR = (DC.dispatch && DC.dispatch.overrun) || 100;
function dOverrunClear(t, j1) {
  const dp = t.dp, a = dp.sig[j1].m, sp = dp.spans(a, a + D_OVR); let zEnd = -1; const nodes = [];
  for (const s of sp) { const g = t.route.segs[s.i], nd = dSegEndN(g), mEnd = dp.M[s.i + 1]; if (nd >= 0 && mEnd > a && mEnd <= a + D_OVR + 0.01 && adj[nd].length >= 3) { nodes.push(nd); zEnd = Math.max(zEnd, mEnd); } }
  if (!nodes.length) return true;
  for (const nd of nodes) { const o = D_LOCKN.get(nd); if (o && !dPartner(o.t, t)) return false; const q = D_OCCN.get(nd); if (q && !dPartner(q, t)) return false; }
  for (const s of sp) {
    if (s.m0 >= zEnd) break;
    for (const o of D_OCC.get(s.e) || []) if (!dPartner(o.t, t) && o.lo <= s.hi && s.lo <= o.hi) return false;
    for (const k of D_LOCK.get(s.e) || []) if (!dPartner(k.t, t) && k.lo < s.hi - 0.5 && s.lo < k.hi - 0.5) return false;
  }
  return true;
}
// 区間の中で、経路が分岐を曲がる(まっすぐでない側へ分かれる・まっすぐでない側から合流する)か。
// (未使用: 主本線の出発を進行定位にすると、終着駅などで進路を早く取りすぎて詰まる。いまは閉塞信号機だけ前もって開く)
function dTurnIn(t, b) {
  if (b.turn != null) return b.turn;
  const dp = t.dp, segs = t.route.segs; b.turn = false;
  for (const { m } of b.nodes) {
    let i = -1; for (let k = 0; k + 1 < segs.length; k++) if (Math.abs(dp.M[k + 1] - m) < 0.01) { i = k; break; } if (i < 0) continue;
    const a = segs[i], c = segs[i + 1]; if (a.e === c.e) continue;
    const da = a.e * 2 + a.d, dc = c.e * 2 + c.d, here = dDot(da, dc);
    if (dSuccOf(da).some(x => dDot(da, x) > here + 0.02) || (dPred.get(dc) || []).some(x => dDot(x, dc) > here + 0.02)) { b.turn = true; break; }
  }
  return b.turn;
}
// 信号機 k が、この列車が手前の駅に止まるので押さえていないだけで、その先の区間が今空いているか(進行定位の見せ方)
function dVirtOpen(t, k) {
  const p = t.ph, dp = t.dp; if (!p || k >= dp.sig.length || k < 1) return false;
  const S = dp.sig[k], P = dp.sig[k - 1]; if (S.s.man) return false;
  const latched = !!(t.dVO && t.dVO.has(k));   // 一度見せた現示
  const st = dp.stops.find(x => !x.thru && x.k >= (dp.stops[p.k] ? dp.stops[p.k].k : 0) && x.m < S.m && x.m > P.m - 400);
  if (!st || dStopX(st, p.L) > S.m - 0.5) return false;
  const b = dBlock(t, k, p.rg), w = t.dWhy, by = t.dByT, f = dFree(t, b, false); t.dWhy = w; t.dByT = by;
  if (f === 1) { (t.dVO || (t.dVO = new Set())).add(k); return true; }
  if (!latched) return false;
  // 先がふさがった: 次の信号機の手前で警戒(25km/h)まで常用ブレーキで落とせるなら現示を下げる(先の出発が停止なのに場内が進行のままにしない)。間に合わない近さなら下げない
  const nx = dp.sig[p.lastSig + 1], front = p.m + p.L / 2, V = KMH(ASP.YY);
  if (nx && nx.m - front > Math.max(0, p.v * p.v - V * V) / (2 * D_BRK) + 30) { t.dVO.delete(k); return false; }
  return true;
}
// 誘導(止まっている列車のいる区間へ 15km/h で入れる)ができる信号機: 手で置いたものは、誘導信号機の付いた場内・入換だけ
const dYudoSig = s => !s || !s.spec || ((dIsHome(s.kind) || s.kind === '入換') && s.spec.yudo !== false);
// 信号機 j の現示(t から見て): その先に確保できている区間の数で決まる
function dAspect(t, j) {
  const lk = t.dLocks; if (!lk || !lk.has(j)) return 'R';
  if (lk.get(j) === 2) return 'KD';
  if (t.dp.sig[j] && t.dp.sig[j].s.kind === '入換') return dManualCap(t.dp.sig[j].s, 'SH');   // 入換信号機の進行(25km/h)
  let n = 0; for (let k = j; k < j + 5 && lk.has(k) && lk.get(k) !== 2; k++) n++;
  if (D_VOPEN && n >= 1 && n < 4 && dVirtOpen(t, j + n)) n = 4;
  const sg = t.dp.sig[j] && t.dp.sig[j].s;
  if (n === 1) {
    const b = t.dp.blocks[j]; let a = b && b.len < 260 ? 'YY' : 'Y';
    // 過走余裕: 次の(止まる)信号機の先の分岐がほかの列車に使われているなら警戒。警戒を出せない信号機は、空くまで停止
    // 一度「空いている」と決めた現示は、列車が近づいてから下げない(上げるのはよい)
    if (j + 1 < t.dp.sig.length && !(b && b.ovrOK) && !dOverrunClear(t, j + 1)) { const H = sg && sg.spec && SIG_HEADS[sg.spec.h]; a = !H || H.a.includes('YY') ? 'YY' : 'R'; } else if (b) b.ovrOK = true;
    return dManualCap(sg, dHeadAsp(sg, a));
  }
  return dManualCap(sg, dHeadAsp(sg, n === 2 ? 'YG' : n === 3 ? 'YGF' : 'G'));
}
const dAspV = a => KMH(ASP[a] != null ? ASP[a] : ASP.G);
// 時刻表上で、経路の位置 m(中心)に居るはずの時刻
function dSchedAt(t, m) {
  const K = t.dp.kn; if (!K.length) return NaN;
  if (m <= K[0].m) return K[0].t;
  for (let i = 0; i + 1 < K.length; i++) { const a = K[i], b = K[i + 1]; if (m >= a.m && m <= b.m) return b.m > a.m ? a.t + (b.t - a.t) * (m - a.m) / (b.m - a.m) : a.t; }
  return K[K.length - 1].t;
}
// 次の時刻の目標(停車・通過)までに、間に合う中で一番遅い巡航速度
// 時刻表の余裕を全部ゆっくり走ることに使わない: 次の時刻より D_EARLY 秒早く着くように走り、駅で待つ(実際の運転に近い速さ)
// 速さの下限 D_CRUISEMIN(制限速度に対する割合)も選べる。0.85 にすると早く着きすぎて、朝のラッシュで順序が崩れ遅れが増えた(2026-11-01)
const D_TEII = !!(DC.dispatch && DC.dispatch.teii);   // (試験用・既定は切)主本線の出発を、止まる列車にも前もって押さえさせる。止まっている間ずっと先を押さえるので品川などで行き詰まった(2026-11-01)
// 進行定位の見せ方: 止まる駅の出発の先が今空いていれば、押さえなくても手前の信号機は進行側の現示を見せる(規程 第314条)。押さえるのは発車の直前
const D_VOPEN = !(DC.dispatch && DC.dispatch.vopen === false);
const D_HOLDDEP = !(DC.dispatch && DC.dispatch.holdDep === false);   // false: 止まる駅の先の信号機も前もって開く(規程 第314条の進行定位。試験用)
const D_EARLY = DC.dispatch && DC.dispatch.early != null ? DC.dispatch.early : 20;
const D_CRUISEMIN = DC.dispatch && DC.dispatch.cruiseMin != null ? DC.dispatch.cruiseMin : 0;
function dCruise(p, D, tau, stop, vCap) { return Math.max(dCruise0(p, D, Math.max(1.5, tau - D_EARLY), stop, vCap), vCap * D_CRUISEMIN); }
function dCruise0(p, D, tau, stop, vCap) {
  const a = D_ACC * 0.8, b = D_BRK, v0 = p.v;
  const time = v => { let t = 0, d = 0; if (v > v0) { t += (v - v0) / a; d += (v * v - v0 * v0) / (2 * a); } else { t += (v0 - v) / b; d += (v0 * v0 - v * v) / (2 * b); }
    if (stop) { t += v / b; d += v * v / (2 * b); } const c = D - d; return c >= 0 ? t + c / Math.max(0.1, v) : t + c / Math.max(0.1, v) * 0.5; };
  if (tau <= 1 || time(vCap) > tau) return vCap;
  let lo = KMH(20), hi = vCap; if (time(lo) <= tau) return lo;
  for (let i = 0; i < 14; i++) { const mid = (lo + hi) / 2; if (time(mid) <= tau) hi = mid; else lo = mid; }
  return hi;
}
// 停車するときの先頭の位置: ホームの先端(ホームより長い列車はホームの中心に合わせる)
const dStopX = (st, L) => Math.min(st.m + Math.max(L / 2, st.half - 5), st.xmax);
// 物理の運転を始める(区間に入ったとき・始発)
function dStart(t, T, rg, o) {   // o: 信号機を置き直す前の状態(dRebuildSignals)
  const dp = t.dp, m = o ? o.m : dp.s2m(t.s), L = dLen(t);
  t.dEntLim = null; const p = t.ph = { fresh: true, m, v: 0, L, rg, mode: 'run', k: 0, blkV: Infinity, lastSig: -1, waitT: 0, delay: 0, hold: false, done: false, emer: false, arrT: NaN };
  if (o) for (const x of ['fresh', 'v', 'mode', 'k', 'blkV', 'waitT', 'waitW', 'delay', 'hold', 'done', 'emer', 'arrT', 'waitFor', 'obsT', 'why']) p[x] = o[x];   // 置き直す前の状態のまま(停車中・次の停車駅・速さ)
  // 次の停車駅
  let k = 0; while (k < dp.stops.length && (dp.stops[k].thru || dp.stops[k].m + 0.5 < m)) k++;
  if (o) k = o.k; else p.k = k;
  const st = dp.stops[k];
  if (o) ;
  else if (st && m > st.m - 2 && m <= Math.max(st.m, dStopX(st, L) - L / 2) + 2) { p.mode = 'dwell'; p.m = m; p.arrT = T <= st.P + 1 ? Math.min(T, st.A) : T; p.paxDw = dPaxNeed(t, st, p.arrT); if (k >= dp.stops.length - 1) p.done = true; }
  else {   // 走っている途中で区間に入った: 時刻表どおりの速さから始める
    const K = dp.kn.find(x => x.m > m + 5 && x.t > T);
    p.v = K ? Math.min(KMH(ASP.G), Math.max(KMH(30), (K.m - m) / Math.max(10, K.t - T) * 1.15)) : KMH(60);
    const lm = dp.lim.find(x => m + L / 2 >= x.m0 && m - L / 2 <= x.m1); if (lm) p.v = Math.min(p.v, lm.v);
  }
  // すでに通り過ぎた信号機
  for (let j = 0; j < dp.sig.length; j++) if (dp.sig[j].m <= m + L / 2) p.lastSig = j;
  // 今いる区間を確保(入口の区間・始発ホームの区間)
  const ri = dp.ranges.indexOf(rg), j0 = p.lastSig >= 0 ? p.lastSig : -1 - ri;
  t.dLocks = t.dLocks || new Map();
  if (!t.dLocks.has(j0)) {
    const b0 = dBlock(t, j0, rg);
    // 止まっている列車(始発など)は、前方の分岐までの進路を発車の直前まで取らない(ほかの列車の進路をふさがない)。体の下の線路は在線でふさがっている
    if (p.mode === 'dwell' && b0.nodes.some(x => x.m > m + L / 2 + 1)) p.needJ0 = j0; else dLock(t, b0, 1);
  }
  t.dStill = p.v < 0.1;
}
function dStop(t) { t.dVO = null; const L = t.ph ? t.ph.L : dLen(t), tail = (t.ph ? t.ph.m : t.dp.s2m(t.s)) - L / 2; if (t.dLocks) for (const j of [...t.dLocks.keys()]) { const b = dBlk(t, j); if (!b || b.z <= tail + 0.5 || b.z <= (t.ph ? t.ph.rg.m1 : 0) + 0.5) dUnlock(t, j); } t.ph = null; t.dStill = false; }
// 区間の中の列車を1歩(dt 秒)進める
function dStepTrain(t, T, dt) {
  const p = t.ph, dp = t.dp, L = p.L, rg = p.rg, front = p.m + L / 2, tail = p.m - L / 2;
  // 通過した信号機: その現示の速さが次の信号機まで効く
  while (p.lastSig + 1 < dp.sig.length && dp.sig[p.lastSig + 1].m <= front) {
    const j = p.lastSig + 1, a = dAspect(t, j);
    if (a === 'R') { D_STAT.spad++; dEvent(T, t, 'spad', `${dp.sig[j].s.name} を停止現示で越えた`); }
    p.blkV = a === 'R' ? KMH(ASP.KD) : dAspV(a); p.lastSig = j;
  }
  // 後ろが抜けた区間を解放
  for (const j of [...t.dLocks.keys()]) { const b = dBlk(t, j); if (!b) continue; if (tail > b.z + 0.5) { dUnlock(t, j); continue; } if (tail > b.a) dRelPart(t, b, tail); }
  // 前方の区間を確保(信号機を開く)
  const nextStop = dp.stops[p.k], stopX = nextStop ? dStopX(nextStop, L) : Infinity;
  t.dWhy = ''; t.dByT = null;
  const look = Math.max(2200, p.v * p.v / (2 * D_BRK) + 900);
  if (p.needJ0 != null) {   // 止まっている区間の進路: 発車できる時刻(30秒前)になってから取る
    const s0 = dp.stops[p.k];
    if (!p.hold && (!s0 || (T >= s0.P - (t.lockEarly || 30) && !dWaiting(t, s0.k, T)))) { const b = dBlock(t, p.needJ0, rg); if (dFree(t, b, false, true) === 1) { dLock(t, b, 1); p.needJ0 = null; } }   // 発車の進路も時刻表の順に
  }
  // 自分の前(次の信号機まで)に別の列車がいるなら、その先の区間は取らない(前の列車が先に進む。途中から始めたときに時刻表の位置で同じ区間に2本置かれ、後ろの列車が先の区間を取って、前の列車と互いに動けなくなった)
  let ahead = null; { const S1 = dp.sig[p.lastSig + 1]; if (S1 && S1.m > front + 0.5) for (const sp of dp.spans(front + 0.5, S1.m)) { for (const o of D_OCC.get(sp.e) || []) if (o.t !== t && !o.t.cut && !o.t.unit && !dPartner(o.t, t) && o.lo <= sp.hi + 1 && sp.lo <= o.hi + 1) { ahead = o.t; break; } if (ahead) break; } }
  for (let j = p.lastSig + 1, n = 0; p.needJ0 == null && j < dp.sig.length && n < 5; j++, n++) {
    if (t.dLocks.has(j)) continue;
    if (ahead) { t.dWhy = '在線 ' + ahead.no; break; }
    const S = dp.sig[j]; if (S.m > rg.m1 + 0.01 || S.m - front > look) break;
    if (S.s.man || S.s.manualAsp === 'R' || p.hold) break;
    // 停車する駅の出発信号は、発車時刻の30秒前まで開かない(その先を本線の列車に空けておく)
    {   // 止まる駅より先は、その駅を発車できる時刻(30秒前)になるまで開かない
      let sb = null; for (let q = p.k; q < dp.stops.length; q++) { const x = dp.stops[q]; if (x.thru) continue; if (dStopX(x, L) < S.m - 0.5) sb = x; else break; }
      if (sb && D_HOLDDEP && S.s.kind !== '閉塞' && (!D_TEII || dTurnIn(t, dBlock(t, j, rg))) && !(p.mode === 'dwell' && sb === nextStop && T >= sb.P - 30 && !dWaiting(t, sb.k, T))) break;
    }
    const b = dBlock(t, j, rg), yudo = nextStop && stopX > b.a && stopX <= b.z + L && dYudoSig(S.s);
    const f = dFree(t, b, yudo, true, S.s.kind === '入換'); if (!f) break;
    dLock(t, b, f);
    if (f === 2) break;
  }
  // 停車中
  if (p.mode === 'dwell') {
    p.v = 0; t.dStill = true;
    const st = dp.stops[p.k];
    if (!st) { p.done = true; return; }
    if (p.k >= dp.stops.length - 1) { p.done = true; return; }
    p.delay = Math.max(0, T - st.P);
    if (T >= st.P && D_LOSS) { const c = p.hold ? '抑止' : p.needJ0 != null ? '発車の進路待ち ' + (st.name || '') + (t.dWhy ? '[' + t.dWhy.replace(/ .*/, '') + ']' : '') : T < p.arrT + Math.max(st.minDw, p.paxDw || 0) ? (p.paxDw > st.minDw ? '乗り降り(混雑) ' : '着いたのが遅い(最短停車) ') + (st.name || '') : null; if (c) dLoss(c, dt); }
    if (T < st.P || T < p.arrT + Math.max(st.minDw, p.paxDw || 0) || p.hold || p.needJ0 != null || (p.incDw != null && T < p.incDw)) return;
    const wo = dWaiting(t, st.k, T); p.waitFor = wo; if (wo) { if (D_LOSS) dLoss('待避で発車待ち ' + (st.name || ''), dt); return; }
    if (D_LOG) D_LOG.push({ t, no: t.no, dep: true, name: st.name, k: st.k, late: T - st.P, T });   // 発車の記録(秒の調整 disp_tune で使う)
    { const pk = dPaxKey(t, st); if (pk) D_LASTDEP.set(pk, T); const ex = Math.min(T, p.arrT + (p.paxDw || 0)) - Math.max(st.P, p.arrT + st.minDw); if (p.paxDw > st.minDw && ex > 1) { D_CROWDSTAT.n++; D_CROWDSTAT.sum += ex; D_CROWDSTAT.max = Math.max(D_CROWDSTAT.max, ex); if (ex > 30) dEvent(T, t, 'late', `${st.name || ''} で乗り降りに ${Math.round(p.paxDw)}秒(混雑・前の列車から間があいた)`); } }
    p.mode = 'run'; p.k++; while (p.k < dp.stops.length && dp.stops[p.k].thru) p.k++;
    { const ev = st.k - t.k0 < t.names.length - 1 && t.ev[st.k - t.k0], od = ev ? T - (ev.dep * 60 + 59) : 0; if (od > 0) dEvent(T, t, 'late', `${st.name || ''} を時刻表より ${Math.round(od)}秒 遅れて発車`); }   // 遅れは時刻表の分(その分の59秒まで)に対して
  }
  // 速さの上限を集める
  const st = dp.stops[p.k], X = st ? dStopX(st, L) : dp.total + L / 2;
  let cur = Math.min(p.blkV, KMH(ASP.G)), vT = Infinity, why = '';
  if (p.incCap != null) cur = Math.min(cur, p.incCap);   // 指令の徐行・故障車の自走(src/radio.js)
  const brakeTo = (x, V) => { const dist = Math.max(0, x - front); return Math.max(V, -D_BRK * dt + Math.sqrt(D_BRK * D_BRK * dt * dt + V * V + 2 * D_BRK * dist)); };
  let stopAt = X;
  for (const l of dp.lim) { if (l.m0 > front + 1500) break; if (front >= l.m0 && tail <= l.m1) cur = Math.min(cur, l.v); else if (l.m0 > front) vT = Math.min(vT, brakeTo(l.m0, l.v)); }
  for (let j = p.lastSig + 1; j < dp.sig.length; j++) {
    const S = dp.sig[j]; if (S.m - front > 2500) break;
    const a = dAspect(t, j);
    if (a === 'R') { stopAt = Math.min(stopAt, S.m - 10); why = S.s.name; break; }
    const V = dAspV(a); if (V < cur) vT = Math.min(vT, brakeTo(S.m, V));
    if (a === 'KD') { vT = Math.min(vT, brakeTo(S.m, V)); }
  }
  // 前の列車(信号の抜けがあっても、ぶつからないように)
  let obs = Infinity; p.obsT = null;
  for (const s of dp.spans(front, front + Math.max(400, p.v * p.v / (2 * D_BRK) + 80))) for (const o of D_OCC.get(s.e) || []) {
    if (dPartner(o.t, t) || o.hi < s.lo - 1 || o.lo > s.hi + 1) continue;
    const g = t.route.segs[s.i], fwd = g.t1 >= g.t0, x = fwd ? Math.max(o.lo, s.lo) : Math.min(o.hi, s.hi);
    const mm = dp.M[s.i] + Math.abs(x / dEm[g.e] - g.t0) * dEm[g.e]; if (mm > front - 0.5 && mm < obs) { obs = mm; p.obsT = o.t; }
  }
  if (obs < Infinity) stopAt = Math.min(stopAt, obs - (p.obsT && p.obsT === t.gTgt ? 1.5 : 8));   // 救援: 連結するので間を詰める
  if (p.incStop != null && p.incStop < stopAt) { stopAt = p.incStop; why = '事故・故障'; }   // 車両故障・人身事故で止まる
  vT = Math.min(vT, cur, brakeTo(stopAt, 0));   // 安全のための上限(信号・制限・前の列車)
  // 時刻表より早く走らない(次の時刻の目標に間に合う一番遅い速さ)。こちらはゆるやかに落とす
  const K = dp.kn.find(x => x.m > p.m + 1);
  let vC = Infinity;
  if (K) vC = dCruise(p, K.m - p.m, K.t - T, K.stop, Math.min(cur, KMH(ASP.G)));
  // 加減速
  if (p.fresh && vT < p.v) p.v = vT;
  const v0 = p.v, acc = v0 < D_ACCV ? D_ACC : Math.max(KMH(0.6), D_ACC * D_ACCV / v0);
  if (p.fresh) { p.fresh = false; if (vT < p.v) p.v = vT; }
  let v1;
  if (Math.min(vT, vC) >= v0) v1 = Math.min(vT, vC, v0 + acc * dt);
  else if (vT >= v0) v1 = Math.max(vC, v0 - D_BRK * 0.6 * dt);
  else {
    const need = (v0 - vT) / dt;
    if (need > D_BMAX + 1e-6) { v1 = Math.max(vT, v0 - D_EMER * dt); if (!p.emer && v0 - vT > D_BMAX * dt + 0.3) { p.emer = true; D_STAT.emer++; dEvent(T, t, 'emer', `非常ブレーキ(${why || '速度超過'})`); if (D_LOG) D_LOG.push({ no: t.no, emer: why || 'lim', T, v: v0 * 3.6, vT: vT * 3.6, m: p.m }); } }
    else { v1 = Math.max(vT, v0 - D_BMAX * dt); p.emer = false; }
    v1 = Math.min(v1, Math.max(vC, v0 - D_BRK * 0.6 * dt));
  }
  let ds = (v0 + v1) / 2 * dt;
  if (front + ds > stopAt) { ds = Math.max(0, stopAt - front); v1 = Math.min(v1, ds > 0.05 ? v1 : 0); }
  p.m += ds; p.v = Math.max(0, v1);
  t.dStill = p.v < 0.1;
  p.why = p.v < 0.1 && stopAt < X - 1 ? why || (obs < Infinity ? '前の列車' : '') : '';
  if (D_LOSS && p.why) dLoss('止められた ' + p.why + (t.dWhy ? '[' + t.dWhy.replace(/ .*/, '') + ']' : ''), dt);
  if (p.v < 0.1 && stopAt < X - 1) { p.waitT += dt; if (p.waitT > 120 && !p.waitW) { p.waitW = true; D_STAT.sigwait++; dEvent(T, t, 'wait', `${why || '前の列車'} で2分以上停止`); } } else { p.waitT = 0; p.waitW = false; }
  // 停車駅に着いた
  if (st && front >= X - 0.3 && p.v < 0.2) {
    p.v = 0; p.m = Math.max(p.m, X - L / 2); p.mode = 'dwell'; p.arrT = T; p.delay = Math.max(0, T - st.A); p.paxDw = dPaxNeed(t, st, T);
    if (D_LOG) D_LOG.push({ t, no: t.no, name: st.name, k: st.k, late: T - st.A, T });
    if (p.k >= dp.stops.length - 1) p.done = true;
  }
  if (!st && p.m >= dp.total - 0.5) p.done = true;
  const late = dSchedAt(t, p.m); if (p.mode === 'run' && !isNaN(late)) p.delay = Math.max(0, T - late);
  if (D_LOG && p.delay > 120 && !t.dOnset) { t.dOnset = 1; D_LOG.push({ t, onset: true, T, where: (p.why || '') + '[' + (t.dWhy || '') + ']', wait: p.waitFor ? p.waitFor.no : '', st: st ? st.name : '' }); }
}
// 区間に入るときに確保する区間: 入口の区間と、すぐ先(700m以内)の信号機の先の区間(その手前で止まる駅がなければ)
function dEntNeed(t, rg, b, L) {
  const dp = t.dp, need = [b];
  const j0 = dp.sig.findIndex(x => x.m >= rg.m0 - 0.01 && x.m < rg.m1);
  if (j0 >= 0 && dp.sig[j0].m - rg.m0 < 700 && !dp.sig[j0].s.man) { const st = dp.stops.find(x => !x.thru && x.m > rg.m0); if (!(st && dStopX(st, L) < dp.sig[j0].m)) need.push(dBlock(t, j0, rg)); }
  return need;
}
// 区間の外から入ってくる列車: 入口の区間が空くまで手前で待たせる
function dEntryHold(t, rg) {
  t.dByT = null; const dp = t.dp, L = dLen(t), m = dp.s2m(t.s);
  const j = -1 - dp.ranges.indexOf(rg), b = dBlock(t, j, rg);
  if (m + L / 2 < b.a - 150 || m > rg.m0) return;
  if (t.dLocks && t.dLocks.has(j)) return;
  const need = dEntNeed(t, rg, b, L);
  if (need.every(x => dFree(t, x, false) === 1)) { need.forEach(x => dLock(t, x, 1)); t.dEntLim = null; return; }
  const lim = dp.m2s(b.a - L / 2 - 15), keep = t.dHi != null && t.dHiR === t.route ? Math.max(lim, t.dHi) : lim; if (t.s > lim) t.s = t.sv = Math.min(t.s, keep);   // 手前で止める(もう越えていたら、今の位置で止める)
  t.dEntLim = keep; t.dEntR = t.route;   // 次の回も、追従(ttFollow)で進んだ分を占有を作る前に戻す(入口の手前の分岐に体が出たり戻ったりして、出ていく列車が止められていた 2026-11-01)
}
// 時刻表運転の1フレームごと(ttFollow のあと)に呼ぶ
let dLastT = NaN;
// 画面の進み方を速くすると1回の時間が長くなる(×300 で約5秒)。5秒刻みでは進路の取り方・止まり方が粗くなり全線で詰まった(2秒刻みなら1秒刻みと同じ)ので、2秒以下に分けて進める
function dispStep(act, T, lastT) {
  const dt = T - lastT;
  if (dt > 2.01 && dt < 90 && dispOn && dispReady) { const n = Math.ceil(dt / 2); let t0 = lastT; for (let i = 1; i <= n; i++) { const t1 = lastT + dt * i / n; dispStep1(act, t1, t0); t0 = t1; } return; }
  return dispStep1(act, T, lastT);
}
function dispStep1(act, T, lastT) {
  const dt = T - lastT; D_NOW = T;
  if (!dispOn || !dispReady) { if (D_LOCK.size || act.some(t => t.ph)) dispReset(act); return; }
  if (!(dt > 0 && dt < 90)) { dispReset(act); dLastT = T; return; }
  if (typeof dIncStep === 'function') dIncStep(act, T);   // 事故・支障の始まり・終わり(src/dinc.js)
  // 区間を出た直後など、物理で走った列車が時刻表の位置より先にいるとき、追従(ttFollow)で後ろへ戻さない
  for (const t of act) { if (t.dHi != null && t.dHiR === t.route && t.s < t.dHi) t.s = t.sv = t.dHi; if (!t.ph && t.dEntLim != null && t.dEntR === t.route && t.s > t.dEntLim) t.s = t.sv = t.dEntLim; }   // 入口で待っている列車は、入口が空くまで止めた位置より先へ出さない
  const n = Math.max(1, Math.ceil(dt / 0.5)), h = dt / n;
  for (let k = 1; k <= n; k++) {
    const Tk = lastT + h * k;
    dBuildOcc(act);
    for (const t of act) {
      if (!t.route || t.unit || t.cut || t.yard || (t.gOut != null && Tk >= t.gOut)) continue;
      const dp = dPrep(t);
      if (!dp.ranges.length) continue;
      const m = t.ph ? t.ph.m : dp.s2m(t.s);
      let rg = dp.ranges.find(r => m >= r.m0 - 0.01 && (m < r.m1 || (r.i1 === t.route.segs.length && m <= r.m1 + 1)));   // 区間の中で終わる経路は、終点にいても区間内
      if (t.ph && t.ph.rg !== rg) { if (D_LOG) D_LOG.push({ t, no: t.no, exit: true, late: Tk - dSchedAt(t, t.ph.m), T: Tk }); dStop(t); }
      if (!t.ph && !rg) {
        if (t.dLocks && t.dLocks.size) { const tail = m - dLen(t) / 2; for (const j of [...t.dLocks.keys()]) { const b = dBlk(t, j); if (b && tail > b.z + 0.5) dUnlock(t, j); } }
        const nx = dp.ranges.find(r => r.m0 > m); if (nx) dEntryHold(t, nx); continue;
      }
      if (!t.ph) dStart(t, Tk, rg);
      dStepTrain(t, Tk, h);
      t.s = t.sv = dp.m2s(t.ph.m);
    }
  }
  for (const t of act) { if (t.dHiR !== t.route) { t.dHiR = t.route; t.dHi = t.s; } else if (!(t.s <= t.dHi)) t.dHi = t.s; }
  dSigShow(act);
  dLastT = T;
}
function dispReset(act) {
  for (const t of act || []) { t.ph = null; t.dLocks = null; t.dStill = false; t.dHi = null; t.dVO = null; t.dOver = false; t.dEntLim = null; }
  D_LOCK.clear(); D_LOCKN.clear(); for (const [, S] of D_SGL) S.run.lock = null; D_NEEDWARM = true; D_DEADLOG.clear();
}
// 途中の時刻から始めたとき(時刻を飛ばした・スライダーを動かした): 全列車を時刻表の位置に置いてすぐ信号で走らせると、
// 閉塞の間隔より近い列車から詰まりが連鎖する。表示する前に D_WARM 秒前から、画面に出さずに早回しで走らせておく
let D_NEEDWARM = true;
const D_WARM = (DC.dispatch && DC.dispatch.warm) || 600;
function dWarm(list, T) {
  const cand = list.filter(t => t.route && !(t.start > T || t.end < T - D_WARM - 900) && dThru(t));
  for (const t of list) { t.dHeld = false; t.dHeldMid = false; t.dOver = false; }   // 前の運用を待っていた印は作り直す(残っていると、早回しで始発駅から出し直され、時刻表より何十分も遅れて走った)
  let last = NaN;
  for (let x = T - D_WARM; x < T - 0.5; x += 2) {
    const act = []; for (const t of cand) { if (dispTarget(t, x)) act.push(t); else { dispKill(t); t.sv = null; } }
    ttFollow(act, x, last); dispStep(act, x, last); last = x;
  }
  D_NEEDWARM = false;
  return last;
}
// 表示する現示: 近づいている列車から見た現示。列車の来ていない閉塞信号は、その先の空き具合から
// 止まる駅の出発(発車の30秒前まで押さえない)を、列車の進路の上で先がいくつ空いているかで見せる(進行定位の見え方。押さえはしない)
// 時刻表(分)に対する遅れ: 次に止まる駅の着(止まっている間は発)の分を過ぎた秒。秒の計画とのずれは遅れにしない
function dOffDelay(t, T) {
  const p = t.ph; if (!p) return 0; const st = t.dp.stops[p.k]; if (!st) return 0; const ev = t.ev[st.k - t.k0]; if (!ev) return 0;
  if (p.mode === 'dwell' && st.k - t.k0 >= t.names.length - 1) return 0;   // 終着駅で引上線へ入るのを待っている間は遅れではない
  return Math.max(0, T - ((p.mode === 'dwell' ? ev.dep : ev.arr) * 60 + 59));
}
function dVirtAsp(t, j) {
  const p = t.ph, dp = t.dp, w = t.dWhy, by = t.dByT; let n = 0;
  for (let k = j; k < Math.min(dp.sig.length, j + 4); k++) { const b = dBlock(t, k, p.rg); if (!b || dFree(t, b, false) !== 1) break; n++; }
  t.dWhy = w; t.dByT = by;
  return dHeadAsp(dp.sig[j].s, n === 0 ? 'R' : n === 1 ? 'Y' : n === 2 ? 'YG' : n === 3 ? 'YGF' : 'G');
}
// 待避で、追い抜く列車を待っている(この駅の出発は停止のまま)
const dWaitNow = t => { const st = t.dp.stops[t.ph.k]; return !!(st && t.dWait && t.dWait[st.k] && dWaiting(t, st.k, D_NOW)); };
const D_ASPRANK = { R: 0, KD: 0, SH: 0, YY: 1, Y: 1, YG: 2, YGF: 3, G: 4 };
// 手動現示は自動連動の安全側にだけ作用する。要求が自動現示より進行側なら自動現示を維持。
function dManualCap(s, safe) {
  const req = s && s.manualAsp;
  if (safe === 'SH') return req === 'R' ? 'R' : safe;
  if (!req || !ASP_ORD.includes(req)) return safe;
  const ri = ASP_ORD.indexOf(req), si = ASP_ORD.indexOf(safe);
  return ri <= si ? req : safe;
}
// 主要駅か(ホームの線が3本以上: 泉岳寺・品川・平和島・京急蒲田・京急川崎)。出発信号は停止定位で、止まっている列車には発車の少し前まで停止を見せる。ほかの駅の出発は進行のままでよい
function dMajorStop(t, st) {
  if (st.major != null) return st.major; const s = st.name && stByName.get(st.name);
  return (st.major = !st.name || !!(s && s.stopMap.size > 2));   // 引上線(名前のない止まる位置)から出る信号も停止定位
}
function dSigShow(act) {
  for (const s of SIGS) s.asp = null;
  for (const t of act) {
    const p = t.ph; if (!p) continue; const dp = t.dp;
    for (let j = p.lastSig + 1, n = 0; j < dp.sig.length && n < 6; j++, n++) {
      const S = dp.sig[j].s;
      // 手前の信号機が進行定位(dVirtOpen)で進行を見せているなら、この信号機(押さえる前の場内・出発)も先の空き具合の現示を見せる
      const dwSt = p.mode === 'dwell' && dp.stops[p.k], early = dwSt && (p.needJ0 != null || (D_NOW < dwSt.P - 30 && dMajorStop(t, dwSt)));   // 主要駅で止まっている列車の前の信号機は、発車の30秒前(進路を押さえる時)まで停止のまま。分岐のない駅の出発は進行のままでよい
      if (S.asp == null) S.asp = !t.dLocks.has(j) && D_VOPEN && j > 0 && t.dLocks.has(j - 1) && S.kind !== '入換' && !p.hold && !dWaitNow(t) && !early && dVirtOpen(t, j) ? dVirtAsp(t, j) : dAspect(t, j);
      if (!t.dLocks.has(j)) break; }
    for (let j = Math.min(dp.sig.length - 1, p.lastSig + 6); j > p.lastSig + 1; j--) {
      const A = dp.sig[j - 1].s, B = dp.sig[j].s; if (A.asp == null || B.asp == null || A.kind === '中継' || A.asp === 'KD' || A.asp === 'SH') continue;
      const rb = D_ASPRANK[B.asp] != null ? D_ASPRANK[B.asp] : 4; if ((D_ASPRANK[A.asp] || 0) > rb + 1) A.asp = dHeadAsp(A, ['Y', 'YG', 'YGF', 'G', 'G'][rb]);
    }
  }
  for (const s of SIGS) if (s.asp == null && s.kind !== '中継') s.asp = s.man ? 'R' : s.kind === '閉塞' ? dDefAsp(s) : 'R';
  for (const s of SIGS) if (s.kind !== '中継' && s.asp != null) s.asp = dManualCap(s, s.asp);
  for (const s of SIGS) if (s.kind === '中継') s.asp = s.next ? s.next.asp : 'R';   // 中継信号機は先の信号機の現示
}
// 列車の来ていない閉塞信号: まっすぐ先の区間がいくつ空いているか
function dDefAsp(s) {
  let n = 0, de = s.de, u = s.u, stopAt = null;
  for (let blk = 0; blk < 4; blk++) {
    let free = true, found = false;
    for (let g = 0; g < 30 && !found; g++) {
      const L = dEm[de >> 1], nx = (sigByDe.get(de) || []).find(x => x.u > u + 0.01), u1 = nx ? nx.u : L;
      const e = de >> 1, lo = (de & 1) ? L - u1 : u, hi = (de & 1) ? L - u : u1;
      for (const o of D_OCC.get(e) || []) if (o.lo <= hi && lo <= o.hi) free = false;
      for (const k of D_LOCK.get(e) || []) if (k.lo <= hi && lo <= k.hi) free = false;
      if (nx) { de = nx.de; u = nx.u; found = true; if (nx.man) free = false; else if (nx.kind !== '閉塞' && nx.kind !== '中継') stopAt = nx; break; }
      const sc = dSuccOf(de); if (!sc.length) { found = true; break; }
      let best = sc[0]; for (const x of sc) if (dDot(de, x) > dDot(de, best)) best = x; de = best; u = 0;
    }
    if (!free) break; n++;
    // 先が場内・出発・入換: その現示(列車が進路を取っていなければ停止)の分だけ先が空いている
    if (stopAt) { const a = stopAt.asp && stopAt.asp !== 'KD' && stopAt.asp !== 'SH' ? stopAt.asp : 'R'; n += a === 'R' ? 0 : a === 'YY' || a === 'Y' ? 1 : a === 'YG' ? 2 : 3; break; }
  }
  return dHeadAsp(s, n === 0 ? 'R' : n === 1 ? 'Y' : n === 2 ? 'YG' : n === 3 ? 'YGF' : 'G');
}
dInit(); dSigCheck();
// シーサスクロッシング: 区間のエッジのうち、ノードを共有せずに図の上で交わる組(立体交差の印 over は除く)。交差点を仮のノード(N.length + 番号)にする
const D_XBY = new Map();
function dBuildXby() { D_XBY.clear(); const se = []; for (let e = 0; e < NE; e++) if (dSecOf[e] >= 0 && !E[e].portal) se.push(e); let id = 0;
  for (let i = 0; i < se.length; i++) for (let j = i + 1; j < se.length; j++) { const a = E[se[i]], b = E[se[j]]; if (a.over || b.over || a.a === b.a || a.a === b.b || a.b === b.a || a.b === b.b) continue;
    const p1 = N[a.a], p2 = N[a.b], q1 = N[b.a], q2 = N[b.b], d = (p2.x - p1.x) * (q2.y - q1.y) - (p2.y - p1.y) * (q2.x - q1.x); if (Math.abs(d) < 1e-9) continue;
    const u = ((q1.x - p1.x) * (q2.y - q1.y) - (q1.y - p1.y) * (q2.x - q1.x)) / d, v = ((q1.x - p1.x) * (p2.y - p1.y) - (q1.y - p1.y) * (p2.x - p1.x)) / d; if (!(u > 0.001 && u < 0.999 && v > 0.001 && v < 0.999)) continue;
    const n = N.length + id++; for (const [e, f] of [[se[i], u], [se[j], v]]) { if (!D_XBY.has(e)) D_XBY.set(e, []); D_XBY.get(e).push({ n, u: f * dEm[e] }); } } }
dBuildXby();
// 画面で配線(長さ・キロ程)を直したとき: 図と長さを作り直す。走っている列車は図の上の同じ位置から続ける(運転の秒の割り振り dRetime は次に開いたときに直る)
function dRelayout(list) {
  const keep = []; for (const t of list || []) if (t.ph && t.dp) keep.push([t, t.ph, t.dp.m2s(t.ph.m)]);
  dInit(); dBuildXby(); dSigCheck();
  for (const t of list || []) { t.ph = null; t.dLocks = null; t.dStill = false; t.dp = null; t._occL = null; }
  D_LOCK.clear(); D_LOCKN.clear(); for (const [, S] of D_SGL) S.run.lock = null; if (list && list.length) dSpawnQ(list);
  for (const [t, o, s] of keep) { const dp = dPrep(t); o.m = dp.s2m(s); const rg = dp.ranges.find(r => o.m >= r.m0 - 0.01 && (o.m < r.m1 || (r.i1 === t.route.segs.length && o.m <= r.m1 + 1))); if (rg) dStart(t, D_NOW, rg, o); }
}
// ===== 時刻表運転とのつなぎ =====
let D_LOG = null;   // 検査用: 着いた・区間を出た記録
// この列車を今出すか。区間内で遅れている列車は、時刻表の終わりを過ぎても着くまで走り続ける。同じ車両の次の列車はそれまで出さない
// 区間の外にいる列車も、時刻表の終わりを過ぎても経路の終わりまで走りきってから消す(区間の入口で待たされて遅れた 853D・821H が入口の前で消えていた。区間の外だけを走る列車も、前につかえて終点の少し手前で消えていた 2026-11-01)
const dThru = t => !!t.route && (t.dIn != null ? t.dIn : (t.dIn = t.route.segs.some(g => dSecOf[g.e] >= 0)));
// まだ走っている(区間の中で物理運転中・時刻表の終わりを過ぎて走りきる途中・区間の外で経路の終わりにまだ着いていない・前の運用を待っていてまだ出ていない)
const dLive = (o, T) => !!o && ((o.ph && !o.ph.done) || o.dOver || (!o.ph && o.sv != null && !o.unit && !o.cut && !o.yard && o.s < o.route.total - 0.5) || (o.dHeld && o.sv == null && T <= o.end));
function dispTarget(t, T) {
  if (t.gOut != null && T >= t.gOut) return false;   // 運転を打ち切って盤面から外した列車(src/radio.js。回送で車庫へは次の版で走らせる)
  if (dispOn && !t.ph && t.sv == null && t.prev && dLive(t.prev, T) && T >= t.start && T < t.start + 3600) { if (T < t.end) t.dHeld = true; t.dOver = false; return false; }   // 同じ車両の前の運用が終わるまで次を出さない
  if (ttTarget(t, T)) {
    t.dOver = false;
    if (dispOn && dispReady && t.sv == null && dSpawnBlocked(t)) { if (!t.dHeld) t.dHeldMid = !(t.sd && Math.abs(t.tgt - t.sd[0]) < 1); t.dHeld = true; return false; }   // 現れる場所に別の列車がいる(遅れている)なら、空くまで出さない
    if (t.dHeld) { t.dHeld = false; if (!t.dHeldMid) t.sv = t.s = t.sd ? t.sd[0] : 0; t.dHeldMid = false; } return true; }   // 前の運用を待っていた列車は、始発駅から出す。途中から始めたときに途中の位置で待たせた列車は、そのときの時刻表の位置に出す
  if (dispOn && t.ph && !t.ph.done && T > t.end && T < t.end + 3600) { t.tgt = t.route.total; t.dwelling = false; t.dOver = true; return true; }
  if (dispOn && dispReady && !t.ph && t.sv != null && !t.unit && !t.cut && T > t.end && T < t.end + 3600 && (t.dOver || T - t.end <= 90) && t.s < t.route.total - 0.5) { t.tgt = t.route.total; t.dwelling = false; t.dOver = true; return true; }   // 区間の外: 経路の終わりへ(区間の入口では dEntryHold が空くまで止める。前の列車には ttFollow で間をあけて付く)
  if (dispOn && dispReady && t.next && t.next.sv == null && !t.next.ph && T < t.next.start + 2 && T < t.end + 3600 && ((t.ph && t.ph.done) || (!t.ph && t.sv != null && t.s >= t.route.total - 0.5))) { t.dwelling = true; t.tgt = t.route.total; return true; }   // 着いた車両は、同じ車両の次の運用が出るまでその場にいる(いなくなった間に別の列車がその番線の進路を取り、次の運用が何分も出られなかった)
  t.dOver = false; return false;
}
function dSpawnBlocked(t) {
  if (!t.route || t.unit || t.cut || t.yard) return false;
  const dp = dPrep(t), m = dp.s2m(t.dHeld && !t.dHeldMid && t.sd ? t.sd[0] : t.tgt != null ? t.tgt : t.s), L = dLen(t);
  const pr = t.prev, pg = pr && pr.route && pr.route.segs[pr.route.segs.length - 1], ho = !!(pg && t.route.segs[0] && pg.e === t.route.segs[0].e && m < t.route.segs[0].d1 + L);   // 同じ車両が着いた線から折り返して出る(受け渡し): 進路はその車両がいるのを承知で(誘導などで)取られているので、進路は見ない   // 現れる位置(時刻表の位置 tgt)。t.s は前に出ていたときの位置のまま(初めは 0 = 始発駅)なので、途中から始めたとき別の場所を見て待たせていた
  for (const sp of dp.spans(m - L / 2 - 5, m + L / 2 + 5)) { if (dSecOf[sp.e] < 0) continue; for (const o of D_OCC.get(sp.e) || []) if (o.t !== t && o.t !== t.prev && !dPartner(o.t, t) && o.lo <= sp.hi && sp.lo <= o.hi) return true; for (const k of D_LOCK.get(sp.e) || []) if (k.t !== t && k.t !== t.prev && !dPartner(k.t, t) && k.lo <= sp.hi && sp.lo <= k.hi && !(ho && k.t.dLocks && k.t.dLocks.get(k.j) === 2)) return true; }   // ほかの列車が進路を取っている区間にも出さない。同じ車両の前の運用(折り返す前の列車)はふさいでいるとみなさない(消してから出すまでに1コマ空くと、そのすきに別の列車が進路を取り、何分も出られなかった)
  return false;
}
function dispKill(t) { t.dVO = null; t.dEntLim = null; if (t.dLocks) dUnlockAll(t); t.ph = null; t.dStill = false; t.dHi = null; t.dHiR = null; }   // dHi(いちばん進んだ位置)も消す: 残すと、時刻を戻した・1日が一周したあと、現れた列車が前の回の位置へ飛ぶ
// ===== 待避: 時刻表で、ある駅に止まっている間に後ろの列車が通る(追い抜く)なら、その列車が通り過ぎるまで発車しない =====
const D_SWAP = (DC.dispatch && DC.dispatch.swapAfter) || 300;
let D_AUTO = !!(DC.dispatch && DC.dispatch.autoReorder);   // 走っている間に順序を自動で変える(遅れた相手を待たずに先に行く・待避をやめる)。既定は切 = 固定の順序(手で変える)
const D_DEADLOG = new Set();   // 行き詰まりで順序を変えた組(運転の記録に1回だけ出す)
function dDeadLog(t, o, where) { const k = t.no + '>' + o.no; if (D_DEADLOG.has(k)) return; D_DEADLOG.add(k); dEvent(D_NOW, t, 'wait', `行き詰まり: ${o.no} がこの列車を待っているので先に出しました(${where})`); }
const D_WAITMAX = D_SWAP;   // 待避で、時刻表の発車からこれ以上は待たない(秒)   // 追い抜く列車の通過が、待避する列車の発車時刻よりこれ以上遅れそうなら、順序を変えて先に出す(秒)
function dKnT(o, s) { const K = o.kn; if (!K || !K.length) return NaN; if (s <= K[0].d) return K[0].t; for (let i = 0; i + 1 < K.length; i++) { const a = K[i], b = K[i + 1]; if (s >= a.d && s <= b.d) return b.d > a.d ? a.t + (b.t - a.t) * (s - a.d) / (b.d - a.d) : b.t; } return K[K.length - 1].t; }
const D_BI = new Set();
let D_SGLN = 0;   // 単線のまとまりの数
// ===== 計画の秒の割り振り直し =====
// 時刻表は分単位。計画(ttcore)は着を「分+10〜25秒」、発を「分+35秒」のように決めているので、駅間が1分の普通は35秒で走る計画になり、物理的に走れない。
// 区間の中の停車駅について、時刻表の分(計画の秒の分)の中で、加速・ブレーキ・制限速度から求めた最短の走行時間で走れる秒に直す。
// 計画の秒はなるべく変えない: 走れない所だけ、発車を分の中で早める(後ろから)。それでも無理なら着を遅らせる(前から)
const D_RETIME = !(DC.dispatch && DC.dispatch.retime === false);
// 秒の調整表(tools/disp_tune.js が運転指令を走らせて作る): D_TUNE[曜日][列車番号|駅|時刻表の着の分] = [着を遅らせる秒, 発を遅らせる秒]。時刻表の分は越えない
const D_TUNE = (/*DISPTUNE*/ null) || {};
let D_DAY = 'wd';
const D_TUNEARR = !!(DC.dispatch && DC.dispatch.tuneArr);
const dTuneKey = (t, i) => t.no.replace(/#\d+$/, '') + '|' + t.names[i] + '|' + t.ev[i].arr;
let D_RETIME_STAT = null;
// 経路上の位置 x0 から x1 まで(先頭の位置)、止まって出て止まるまでの最短の時間(秒)。信号は全部進行とみなす
function dMinRun(t, x0, x1, cap) {
  const dp = t.dp, L = dLen(t), ds = 5, n = Math.max(2, Math.ceil((x1 - x0) / ds)), h = (x1 - x0) / n, vm = new Float64Array(n + 1), v = new Float64Array(n + 1);
  for (let i = 0; i <= n; i++) { const x = x0 + h * i; let w = KMH(cap || ASP.G); for (const l of dp.lim) { if (l.m0 > x) break; if (x >= l.m0 && x - L <= l.m1) w = Math.min(w, l.v); } vm[i] = w; }
  v[0] = 0; for (let i = 0; i < n; i++) { const a = v[i] < D_ACCV ? D_ACC : D_ACC * D_ACCV / Math.max(v[i], 0.1); v[i + 1] = Math.min(vm[i + 1], Math.sqrt(v[i] * v[i] + 2 * a * h)); }
  v[n] = 0; for (let i = n; i > 0; i--) v[i - 1] = Math.min(v[i - 1], Math.sqrt(v[i] * v[i] + 2 * D_BRK * h));
  let T = 0; for (let i = 0; i < n; i++) T += h / Math.max(0.3, (v[i] + v[i + 1]) / 2);
  return T;
}
const D_PLAT = new Map();   // 番線 → [[列車, 停車の番号]](区間の中の停車)
function dRetime(list) {
  const st = { trains: 0, moved: 0, late: 0, maxShift: 0 };
  D_PLAT.clear();
  for (const o of list) { if (!o.route || !o.route.stopE || o.unit || o.cut || o.yard || !o.P) continue; o.names.forEach((nm, i) => { const e = o.route.stopE[i]; if (e == null || dSecOf[e] < 0 || (o.ev[i] && o.ev[i].thru)) return; if (!D_PLAT.has(e)) D_PLAT.set(e, []); D_PLAT.get(e).push([o, i + o.k0]); }); }
  for (const t of list) {
    if (!t.route || t.unit || t.cut || t.yard || !t.A || !t.P) continue;
    if (!t.route.segs.some(g => dSecOf[g.e] >= 0)) continue;
    if (!t.sd) ttTarget(t, t.start); if (!t.sd) continue;
    t.dp = null; const dp = dPrep(t), L = dLen(t);
    // 区間の中の停車駅(通過は除く)
    const S = dp.stops.filter(x => !x.thru && x.name && dSecOf[segAt(t.route, Math.max(0, Math.min(t.route.total, t.sd[x.k]))).e] >= 0);
    // 引上線から出る列車: 引上線(名前の無い始発の停車)も入れる。ホームまでは入換(25km/h)で走る。引上線を出られるのは着いてから60秒あと
    const sid = t.fromSiding && t.k0 === 1 && dp.stops[0] && S.length && S[0] === dp.stops[1] && dSecOf[segAt(t.route, Math.max(0, t.sd[0])).e] >= 0;
    if (sid) S.unshift(dp.stops[0]);
    if (S.length < 2) continue;
    const A = S.map(x => t.A[x.k]), P = S.map(x => t.P[x.k]), A0 = A.slice(), P0 = P.slice(), R = [];
    for (let i = 0; i + 1 < S.length; i++) R.push(dMinRun(t, dStopX(S[i], L), dStopX(S[i + 1], L), sid && i === 0 ? ASP.SH : 0) * 1.03 + 3);   // 最短の3%と3秒の余裕
    // 停車駅が続いていない(間に区間の外の駅がある)組は使わない
    for (let i = 0; i + 1 < S.length; i++) { let ok = true; for (let k = S[i].k + 1; k < S[i + 1].k; k++) { const ev = t.ev[k - t.k0]; if (!(ev && ev.thru)) ok = false; } if (!ok) R[i] = 0; }
    const lo = x => Math.floor(x / 60) * 60, dw = i => Math.min(S[i].minDw, Math.max(0, P0[i] - A0[i]));
    // 引上線から出る列車: 同じ番線から先に出る列車(品川1番線の直通など)が出てからでないと入れない。入る時刻(と発車)を分の中で後ろへ
    if (sid) { const e1 = t.route.stopE[S[1].k - t.k0]; let pv = -Infinity;
      for (const [o, k] of D_PLAT.get(e1) || []) if (o !== t && !dPartner(o, t) && o.P[k] < A[1] + 5 && o.P[k] > A[1] - 150) pv = Math.max(pv, o.P[k]);
      if (pv + 35 > A[1]) { A[1] = Math.min(pv + 35, lo(P0[1]) + 55 - S[1].minDw); P[1] = Math.max(P[1], Math.min(lo(P0[1]) + 55, A[1] + S[1].minDw)); } }
    // 後ろから: 次の着に間に合うように発車を(分の中で)早める
    for (let i = S.length - 2; i >= 0; i--) {
      if (!R[i]) continue;
      if (P[i] > A[i + 1] - R[i]) P[i] = Math.max(sid && i === 0 ? A0[0] + 60 : lo(P0[i]), A[i + 1] - R[i]);
      if (A[i] > P[i] - dw(i)) A[i] = Math.max(lo(A0[i]), Math.min(A[i], P[i] - dw(i)));
    }
    // 前から: それでも走れない所は、着(と発)を遅らせる
    for (let i = 0; i + 1 < S.length; i++) {
      if (R[i] && A[i + 1] < P[i] + R[i]) { A[i + 1] = P[i] + R[i]; st.late++; }
      if (P[i + 1] < A[i + 1] + dw(i + 1)) P[i + 1] = A[i + 1] + dw(i + 1);
    }
    // 調整表: 運転指令で決まって遅れる所は、時刻表の分の中で着・発を後ろへ(そのあと次の駅に間に合うか確かめ直す)
    const TU = D_TUNE[D_DAY];
    if (TU) { let any = false;
      for (let i = 0; i < S.length; i++) { const ix = S[i].k - t.k0, ev = t.ev[ix]; if (!ev) continue; const u = TU[dTuneKey(t, ix)]; if (!u) continue; any = true;
        const aMax = ev.arr * 60 + 57, pMax = ev.dep * 60 + 57;
        if (u[0] > 0 && D_TUNEARR) A[i] = Math.max(A[i], Math.min(aMax, A[i] + u[0]));   // 着は既定ではずらさない(ずらすとゆっくり走り、時刻表の分を越えやすくなった)
        if (u[1] > 0) P[i] = Math.max(P[i], Math.min(pMax, P[i] + u[1]));
        if (P[i] < A[i] + dw(i)) P[i] = Math.min(Math.max(P[i], A[i] + dw(i)), Math.max(P[i], pMax)); }
      if (any) for (let i = 0; i + 1 < S.length; i++) { if (R[i] && A[i + 1] < P[i] + R[i]) A[i + 1] = P[i] + R[i]; if (P[i + 1] < A[i + 1] + dw(i + 1)) P[i + 1] = A[i + 1] + dw(i + 1); }
    }
    let moved = false;
    for (let i = 0; i < S.length; i++) {
      if (Math.abs(A[i] - A0[i]) > 0.5 || Math.abs(P[i] - P0[i]) > 0.5) moved = true;
      st.maxShift = Math.max(st.maxShift, Math.abs(A[i] - A0[i]), Math.abs(P[i] - P0[i]));
    }
    st.trains++;
    if (!moved) continue;
    st.moved++;
    // 停車駅の間の通過点は、元の時刻の比で置き直す
    for (let i = 0; i + 1 < S.length; i++) {
      for (let k = S[i].k + 1; k < S[i + 1].k; k++) { const f = (t.A[k] - P0[i]) / Math.max(1, A0[i + 1] - P0[i]); t.A[k] = t.P[k] = P[i] + f * (A[i + 1] - P[i]); }
    }
    for (let i = 0; i < S.length; i++) { t.A[S[i].k] = A[i]; t.P[S[i].k] = P[i]; }
    t.kn = null; t.dp = null;
  }
  return st;
}
function dBuildPred() {
  dSucc.clear(); dPred.clear();
  for (const s of DSEC) for (const e of s.edges) for (const d of [0, 1]) { if (!dAllowed(e, d)) continue; const de = e * 2 + d; for (const f of dSuccOf(de)) { if (!dPred.has(f)) dPred.set(f, []); dPred.get(f).push(de); } }
}
// 前の運用なしで区間の中に現れる列車(引上線・ホームの始発): 線と位置。現れる前に別の列車がそこへの進路を取ると、現れられずに何分も待った(2080A)
const D_SPAWNQ = new Map();
function dSpawnQ(list) {
  D_SPAWNQ.clear();
  for (const t of list) { if (t.prev || !t.route || t.unit || t.cut || t.yard || !t.sd) continue; const dp = dPrep(t), m = dp.s2m(t.sd[0]), L = dLen(t);
    for (const sp of dp.spans(m - L / 2 - 5, m + L / 2 + 5)) { if (dSecOf[sp.e] < 0) continue; if (!D_SPAWNQ.has(sp.e)) D_SPAWNQ.set(sp.e, []); D_SPAWNQ.get(sp.e).push({ t, lo: sp.lo, hi: sp.hi }); } }
}
// ===== 乗降客数と停車時間(tools/patch_crowd.py) =====
const D_PAX = (/*PAX*/ null) || null;
let D_CROWD = !!D_PAX;   // 画面の「乗降客数で停車時間」
const D_PAXCFG = Object.assign({
  // 1日の乗降のうち、その時(時)の1時間に乗り降りする割合(推定。平日は朝夕の山、土休日はなだらか)
  wd: { 4: 0.2, 5: 1.2, 6: 4.5, 7: 10.5, 8: 11.0, 9: 7.0, 10: 5.0, 11: 4.5, 12: 4.5, 13: 4.5, 14: 4.5, 15: 5.0, 16: 5.5, 17: 7.5, 18: 8.0, 19: 6.5, 20: 5.0, 21: 4.0, 22: 3.0, 23: 1.8, 24: 0.8, 25: 0.2 },
  hd: { 4: 0.2, 5: 0.8, 6: 2.5, 7: 4.5, 8: 6.0, 9: 7.0, 10: 7.5, 11: 7.5, 12: 7.0, 13: 7.0, 14: 7.0, 15: 7.0, 16: 7.0, 17: 7.0, 18: 6.5, 19: 5.5, 20: 4.5, 21: 3.5, 22: 2.5, 23: 1.5, 24: 0.7, 25: 0.2 },
  upAM: 0.6, downPM: 0.6,   // 平日 6〜9時台は上り、17〜20時台は下りに多い(それ以外は半分ずつ)
  door: 3, secPer: 1.2, crowdAt: 15, crowdMul: 1.5, base: 10, gapMax: 1200
}, (DC.dispatch && DC.dispatch.pax) || {});
const D_LASTDEP = new Map();   // 駅|向き → 最後に発車した秒(実際)
const D_PAXQ = new Map();      // 駅|向き → 止まる列車の時刻表の発車(秒、昇順)
let D_CROWDSTAT = { n: 0, sum: 0, max: 0 };
function dPaxKey(t, st) { if (!t.route || !t.sd || t.sd[st.k] == null) return null; const g = segAt(t.route, t.sd[st.k]); return st.name + '|' + dDn(g.e * 2 + g.d); }
function dPaxRate(name, dn, T) {   // その方向の客(人/秒)
  const R = D_PAX && D_PAX.駅 && D_PAX.駅[name]; if (!R) return 0;
  const C = D_PAXCFG, prof = C[D_DAY === 'hd' ? 'hd' : 'wd'], h = Math.max(4, Math.min(25, Math.floor(T / 3600)));
  let tot = 0; for (const k in prof) tot += prof[k];
  const sh = D_DAY !== 'hd' && h >= 6 && h <= 9 ? (dn ? 1 - C.upAM : C.upAM) : D_DAY !== 'hd' && h >= 17 && h <= 20 ? (dn ? C.downPM : 1 - C.downPM) : 0.5;
  return R / 2 * (prof[h] || 0) / tot / 3600 * sh;
}
function dPaxSec(t, name, dn, T, gap, mul) {   // その間隔で待っていた客の乗り降りにかかる秒(mul = 客の倍率: JR の振替輸送など)
  const C = D_PAXCFG, n = 2 * dPaxRate(name, dn, T) * (mul || 1) * Math.max(0, Math.min(gap, C.gapMax)), doors = Math.max(1, (t.cars || 8) * C.door), per = n / doors;
  return C.base + per * C.secPer * (per > C.crowdAt ? C.crowdMul : 1);
}
function dPaxNeed(t, st, arrT) {   // 着いたときに、要る停車の秒(0 = 時刻表どおり)
  if (!D_CROWD || !D_PAX || st.thru || st.k == null) return 0;
  const i = st.k - t.k0; if (i <= 0 || i >= t.names.length - 1 || t.yard || t.unit || t.cut || t.dh) return 0;
  const key = dPaxKey(t, st); if (!key) return 0; const dn = key.endsWith('|1');
  const q = D_PAXQ.get(key); let pv = -Infinity; if (q) { let lo = 0, hi = q.length; while (lo < hi) { const m = (lo + hi) >> 1; if (q[m] < st.P - 0.5) lo = m + 1; else hi = m; } if (lo > 0) pv = q[lo - 1]; }
  const gS = isFinite(pv) ? st.P - pv : D_PAXCFG.gapMax, last = D_LASTDEP.get(key), gA = last != null && last < arrT ? arrT - last : gS;
  const rS = dPaxSec(t, st.name, dn, st.P, gS), rA = dPaxSec(t, st.name, dn, arrT, gA, typeof dIncPaxMul === 'function' ? dIncPaxMul(st.name, arrT) : 1), dwS = Math.max(0, st.P - st.A);
  return Math.min(dwS, rS) + Math.max(0, rA - rS);
}
function dPaxPlan(list) {   // dispPlan で: 駅|向きごとの時刻表の発車
  D_PAXQ.clear(); D_LASTDEP.clear(); D_CROWDSTAT = { n: 0, sum: 0, max: 0 };
  for (const t of list) { if (!t.route || !t.sd || t.yard || t.unit || t.cut || t.dh) continue;
    t.names.forEach((nm, i) => { const ev = t.ev[i]; if (!ev || ev.thru || i === t.names.length - 1) return; const k = i + t.k0; if (t.sd[k] == null) return; const g = segAt(t.route, t.sd[k]); if (dSecOf[g.e] < 0) return;
      const key = nm + '|' + dDn(g.e * 2 + g.d); if (!D_PAXQ.has(key)) D_PAXQ.set(key, []); D_PAXQ.get(key).push(t.P[k]); }); }
  for (const [, q] of D_PAXQ) q.sort((a, b) => a - b);
}
let D_REC = null;   // 基準の走りの記録 { n: Map(鍵 → 分岐を通った秒), e: Map(鍵 → 区間に入った秒), w: Map(鍵 → 1 待避した / 0 待たずに出た) }(src/fixload.js が入れる)
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
  dRecList = list;
  // 計画で通る向きを通れるようにして、つながりと信号機の推定を作り直す
  { const n0 = D_USED.size; for (const t of list) if (t.route) for (const g of t.route.segs) if (dSecOf[g.e] >= 0 && !E[g.e].portal) D_USED.add(g.e * 2 + g.d);
    if (D_USED.size !== n0) { dBuildPred(); for (const sec of DSEC) { sec.entries = []; } dRebuildSignals(list); dSigCheck(); } }
  if (D_RETIME) D_RETIME_STAT = dRetime(list);
  dSpawnQ(list);
  const bySt = new Map(), keys = new Map();
  D_SGLN = dSglBuild(list);   // 単線のまとまり(方向てこ)
  { const dir = new Map(); D_BI.clear();
    for (const o of list) { if (!o.route) continue; const sg = o.route.segs;
      for (let i = 0; i < sg.length; i++) { const ins = dSecOf[sg[i].e] >= 0; if (!ins) continue;
        for (const step of [1, -1]) { if (i + step < 0 || i + step >= sg.length || dSecOf[sg[i + step].e] >= 0) continue; let px = 0;
          for (let k = i + step; k >= 0 && k < sg.length && dSecOf[sg[k].e] < 0 && px < 50; k += step) { const g = sg[k]; px += Math.abs(g.d1 - g.d0); const v = dir.get(g.e) || 0; dir.set(g.e, v | (g.d ? 2 : 1)); } } } }
    for (const [e, v] of dir) if (v === 3) D_BI.add(e); }
  for (const o of list) {
    if (!o.route || o.unit || o.cut || o.yard) continue;
    if (!o.kn) ttTarget(o, o.start); if (!o.kn) continue;
    const ks = new Set(), seen = new Map();
    for (const g of o.route.segs) { if (dSecOf[g.e] < 0 || E[g.e].portal) continue; ks.add(g.e * 2 + g.d); const si = edgeStation[g.e]; if (si < 0) continue; if (!seen.has(si)) seen.set(si, { sX: (g.d0 + g.d1) / 2, sX1: g.d1, es: new Set() }); seen.get(si).es.add(g.e); seen.get(si).sX1 = g.d1; }
    keys.set(o, ks);
    for (const [si, x] of seen) { if (!bySt.has(si)) bySt.set(si, []); bySt.get(si).push({ o, T: dKnT(o, x.sX), TE: dKnT(o, x.sX1), sX: x.sX, es: x.es }); }   // TE = この駅を出る(通り過ぎる)時刻
  }
  let n = 0;
  for (const t of list) {
    t.dWait = null; if (!keys.has(t)) continue;
    for (let k = 0; k < (t.sd || []).length; k++) {
      const i = k - t.k0, ev = t.ev[i]; if (!ev || ev.thru || (t.P[k] - t.A[k] < 45 && !ev.ot) || k + 1 >= t.sd.length) continue;
      const g = segAt(t.route, t.sd[k]); if (dSecOf[g.e] < 0) continue; const si = edgeStation[g.e]; if (si < 0) continue;
      const ahead = new Set(); for (const h of t.route.segs) { if (h.d1 <= t.sd[k] || dSecOf[h.e] < 0 || E[h.e].portal || edgeStation[h.e] === si) continue; if (h.d0 > t.sd[k] + 80) break; ahead.add(h.e * 2 + h.d); }
      if (!ahead.size) continue;
      const w = [];
      for (const c of bySt.get(si) || []) {
        if (c.o === t || dPartner(c.o, t) || c.es.has(g.e) || !(c.T > t.A[k] + 5 && c.TE < t.P[k] + 25)) continue;   // 別の線を通って追い抜く列車だけ(止まる列車は、この駅を出る時刻で見る。着いても後から出るなら抜かない)
        const ok = keys.get(c.o); let share = false; for (const x of ahead) if (ok.has(x)) { share = true; break; }
        if (share) w.push(c);
      }
      // 時刻表の計画で決めた待避(ev.otBy: この駅で抜いていく列車)は必ず入れる
      if (ev.ot && ev.otBy) for (const o of ev.otBy) { if (w.some(c => c.o === o)) continue; const c = (bySt.get(si) || []).find(c => c.o === o); if (c && !c.es.has(g.e)) w.push(c); }
      if (w.length) { (t.dWait || (t.dWait = {}))[k] = w; n++; }
    }
  }
  // 待避の発車の秒: 抜いていく列車が次の駅を出る(通る)まで、待避している列車は出られない。時刻表の分の中で、次の駅に間に合う範囲で発車をそこまで遅らせる
  for (const t of list) {
    if (!t.dWait) continue; let moved = false;
    for (const ks of Object.keys(t.dWait)) {
      const k = +ks, i = k - t.k0; let j = i + 1; while (j < t.names.length && t.ev[j] && t.ev[j].thru) j++;
      if (j >= t.names.length) continue;
      const nm = t.names[j], kn = j + t.k0;
      let T2 = -Infinity;
      for (const c of t.dWait[k]) { const o = c.o, q = o.names.indexOf(nm); if (q < 0) continue; const x = o.P[q + o.k0]; if (x > t.P[k] - 60 && x < t.A[kn]) T2 = Math.max(T2, x + 15); }
      if (!isFinite(T2) || T2 <= t.P[k]) continue;
      if (!t.dp) dPrep(t); const dp = t.dp, L = dLen(t), s0 = dp.stops[k], s1 = dp.stops[kn]; if (!s0 || !s1) continue;
      const R = dMinRun(t, dStopX(s0, L), dStopX(s1, L)) * 1.03 + 3, P = Math.min(Math.floor(t.P[k] / 60) * 60 + 55, t.A[kn] - R, T2);
      if (P > t.P[k] + 0.5) { t.P[k] = P; moved = true; D_WAITSHIFT++; }
    }
    if (moved) { t.kn = null; t.dp = null; ttTarget(t, t.start); }
  }
  // 分岐ごとに、通る列車とその時刻(時刻表)。進路を時刻表の順に作るのに使う
  D_NODEQ.clear(); const occ = new Map();
  for (const o of list) {
    if (!o.route || !o.kn || o.unit || o.cut || o.yard) continue;
    for (const g of o.route.segs) {
      if (dSecOf[g.e] < 0 || E[g.e].portal) continue; const nd = dSegEndN(g); if (nd < 0 || adj[nd].length < 3) continue;
      const T = dKnT(o, g.d1); if (isNaN(T)) continue;
      if (!D_NODEQ.has(nd)) D_NODEQ.set(nd, []); const ok = dRecKey(o) + '|' + nd, oc = (occ.get(ok) || 0) + 1; occ.set(ok, oc); D_NODEQ.get(nd).push({ o, d: g.d1, T, key: ok + '|' + oc });
    }
  }
  for (const [, q] of D_NODEQ) q.sort((a, b) => a.T - b.T);
  D_ENTQ.length = 0;   // 区間の外から入ってくる所と時刻
  for (const o of list) {
    if (!o.route || !o.kn || o.unit || o.cut || o.yard) continue;
    const segs = o.route.segs; let ri = 0;
    for (let i = 0; i < segs.length; i++) { if (dSecOf[segs[i].e] < 0 || (i > 0 && dSecOf[segs[i - 1].e] >= 0)) continue; if (i > 0) { const T = dKnT(o, segs[i].d0); if (!isNaN(T)) D_ENTQ.push({ o, ri, d: segs[i].d0, T, key: dRecKey(o) + '|e' + ri }); } ri++; }
  }
  D_ENTQ.sort((a, b) => a.T - b.T);
  dRecApply(); dPaxPlan(list); if (typeof dIncReset === 'function') dIncReset();
  return n;
}
// 追い抜く列車がまだこの駅を通っていないか
let D_WAITSHIFT = 0;
function dWaiting(t, k, T) {
  const w = t.dWait && t.dWait[k]; if (!w) return null;
  const st = t.dp.stops[k]; if (D_AUTO && st && T > st.P + D_WAITMAX) return null;
  for (const c of w) {
    const o = c.o; if (T > o.end + 5 && !o.ph) continue; if (o.sv != null && o.s > c.sX + 12) continue; if (T < o.start - 900) continue;
    // 追い抜く列車が大きく遅れているなら、待たずに先に出す(順序変更)
    // 着きそうな時刻: いる位置から時刻表どおりに走った時刻。止められている列車は、止まっている時間ぶん遅くみる
    let eta;
    if (o.sv != null) { eta = T + Math.max(0, dKnT(o, c.sX) - dKnT(o, o.s)); if (o.ph && o.ph.mode === 'run' && o.ph.v < 0.1) eta += Math.min(o.ph.waitT, D_SWAP); }
    else eta = c.T + Math.max(0, T - o.start);
    if (D_AUTO && eta > (st ? st.P : T) + D_SWAP) continue;
    // 抜く列車が(前の列車などを介して)この列車にふさがれているなら、待つと動けなくなるので先に出す
    let x = o, dead = false;
    for (let g = 0; g < 10 && x && !dead; g++) { const xp = x.ph, xs = xp && xp.mode === 'dwell' && x.dp && x.dp.stops[xp.k], idle = xp && (xp.v >= 0.1 || (xs && T < xs.P));   // 走っている・発車時刻前の停車中は、ふさがれていない
      const nx = idle ? null : x.dByT || (xp && xp.v < 0.1 ? xp.obsT || xp.waitFor : null); if (nx === t || (nx && dPartner(nx, t))) dead = true; x = nx === x ? null : nx; }
    if (dead) { if (!D_AUTO) dDeadLog(t, o, '待避'); continue; }
    return o;
  }
  return null;
}
