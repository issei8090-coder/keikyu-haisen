// ===== 配線グラフと経路探索 =====
const N = D.nodes.map(p => ({ x: p[0], y: p[1] }));
const E = D.edges.map(e => ({ a: e[0], b: e[1], dir: e[2], over: !!e[3], portal: false }));
D.portals.forEach(p => E.push({ a: p[0], b: p[1], dir: 0, portal: true }));
// 向きの推定の誤り(cfg.json の nodir にも入れてある。data.json を作り直せば不要): 京急川崎の真ん中の線(y=201)は北からだけ入れる下り側の線で、引上線から戻って下りへ出る列車も使う。品川の3番線(y=53)は泉岳寺側が行き止まりで、着いた普通がそのまま下りへ折り返す
[[641, 200, 663, 202], [209, 52, 224, 54]].forEach(([x0, y0, x1, y1]) => D.edges.forEach((e, i) => { const a = D.nodes[e[0]], b = D.nodes[e[1]], x = (a[0] + b[0]) / 2; if (a[1] === b[1] && x >= x0 && x <= x1 && a[1] >= y0 && a[1] <= y1) { e[2] = 0; E[i].dir = 0; } }));
const NE = E.length;
E.forEach(e => {
  const dx = N[e.b].x - N[e.a].x, dy = N[e.b].y - N[e.a].y;
  e.len = e.portal ? 0 : Math.hypot(dx, dy);
  e.vx = e.len ? dx / e.len : 0; e.vy = e.len ? dy / e.len : 0;
});
let ROUTE_NAMES = null, ROUTE_PO = '';   // 経路探索中の列車の停車駅
const LANE_SWITCH = 30;   // 内線⇔外線の渡り線を使うコスト(内線に入ってすぐ外線へ戻るようなジグザグを防ぐ)
const LANE_PEN = 1.3;   // 内線/外線の使い分けは「好み」程度。番線がふさがっていれば反対側の線に入る(1線1列車を優先)
let ROUTE_CLS = null;
E.forEach(e => {
  if (e.portal) return;
  const y = N[e.a].y, xm = (N[e.a].x + N[e.b].x) / 2;
  if (y !== N[e.b].y && xm > 440 && xm < 640 && Math.min(y, N[e.b].y) >= 528 && Math.max(y, N[e.b].y) <= 566) { e.lane = 'x'; return; }   // 内線と外線をつなぐ渡り線
  if (y !== N[e.b].y || xm < 440 || xm > 640 || y < 520 || y > 570) return;
  if (Math.abs(y - 541) < 1.5 || Math.abs(y - 552) < 1.5) e.lane = 'in';
  else if (y <= 533 || (y >= 560 && y <= 565)) e.lane = 'out';
});
const adj = N.map(() => []);
E.forEach((e, i) => { adj[e.a].push(i); adj[e.b].push(i); });

// 根古屋信号場(成田湯川〜空港第2ビルの単線区間にある行き違い場所)を、ホームの無い駅として扱う
(() => {
  const yu = D.stations.find(s => s.name === '成田湯川'); if (!yu || D.stations.some(s => s.name === '根古屋信号場')) return;
  const xe = Math.max(...yu.plats.map(p => p[2])), ys = yu.plats.map(p => (p[1] + p[3]) / 2), used = new Set(D.stations.flatMap(s => s.pass.concat(s.stops.map(x => x[0]))));
  const es = []; D.edges.forEach((e, i) => { const a = D.nodes[e[0]], b = D.nodes[e[1]]; if (a[1] === b[1] && e[2] !== 0 && !used.has(i) && Math.min(a[0], b[0]) > xe + 30 && ys.some(y => Math.abs(a[1] - y) < 25) && Math.abs(a[0] - b[0]) > 15) es.push(i); });
  if (es.length !== 2) return;
  // 1線スルー: まっすぐな線(長いほう)は上下とも通過列車が走り、もう一方は上下共用の待避線
  const len_ = i => Math.abs(D.nodes[D.edges[i][0]][0] - D.nodes[D.edges[i][1]][0]); es.sort((a, b) => len_(b) - len_(a)); es.forEach(i => { D.edges[i][2] = 0; E[i].dir = 0; });
  const mid = i => (D.nodes[D.edges[i][0]][0] + D.nodes[D.edges[i][1]][0]) / 2, cx = (mid(es[0]) + mid(es[1])) / 2, top = Math.min(...es.map(i => D.nodes[D.edges[i][0]][1]));
  D.stations.push({ name: '根古屋信号場', cx, lx: cx, ly: top - 6, plats: [], stops: es.map(i => [i, mid(i)]), pass: es.slice(), row: yu.row, sig: true, sigStraight: es[0], sigSiding: es[1] });
})();
const ST = D.stations;
const OUTER_ONLY = new Set(['子安']);   // 内線=通過線(ホームなし)、外線=待避線(停車はこちらだけ)
ST.forEach(s => {
  if (!OUTER_ONLY.has(s.name)) return;
  const ys = s.stops.map(([e]) => D.nodes[D.edges[e][0]][1]), lo = Math.min(...ys), hi = Math.max(...ys);
  s.stops = s.stops.filter((st, i) => ys[i] === lo || ys[i] === hi);
});
const stByName = new Map(ST.map(s => [s.name, s]));
const edgeStation = new Int16Array(NE).fill(-1);
const stopX = new Float64Array(NE).fill(NaN);
ST.forEach((s, i) => {
  s.stopMap = new Map(s.stops.map(([e, x]) => [e, x]));
  s.stopMap.name = s.name;
  s.stops.forEach(([e, x]) => { edgeStation[e] = i; stopX[e] = x; });
  s.pass.forEach(e => { edgeStation[e] = i; });
});
const PO_STATIONS = [];   // ホームのない通過線が別にある駅
ST.forEach(s => {
  const through = s.pass.filter(e => isNaN(stopX[e]) && D.edges[e][2] !== 0);
  if (!through.length || s.name === '金沢文庫') return;
  PO_STATIONS.push(s.name);
  s.stops.forEach(([e]) => { E[e].po = s.name; });
});
const EXITS = {};
D.exits.forEach(([n, name]) => { (EXITS[name] = EXITS[name] || new Set()).add(n); });

const REVERSE = 250;    // 駅での折り返し(スイッチバック)のコスト
const WRONG_WAY = 4;   // 逆線走行のコスト倍率(左側通行を優先)
const paramOf = (e, x) => (x - N[E[e].a].x) / (N[E[e].b].x - N[E[e].a].x);
const pointOn = (e, t) => ({ x: N[E[e].a].x + (N[E[e].b].x - N[E[e].a].x) * t, y: N[E[e].a].y + (N[E[e].b].y - N[E[e].a].y) * t });

function edgeCost(f, d, frac) {
  const e = E[f];
  if (e.portal) return 0.01;
  const s = d ? -1 : 1;
  const wrong = e.dir && Math.sign(s * e.vx) === -e.dir;
  return e.len * frac * (wrong ? WRONG_WAY : 1) * (e.lane && e.lane !== 'x' && ROUTE_CLS && e.lane !== ROUTE_CLS ? LANE_PEN : 1) + (e.lane === 'x' && ROUTE_CLS ? LANE_SWITCH * frac : 0) + (e.lane && e.lane !== 'x' && ROUTE_CLS && e.lane !== ROUTE_CLS && !isNaN(stopX[f]) ? 45 * frac : 0) + (e.po && ROUTE_NAMES && !ROUTE_NAMES.has(e.po) ? 40 * frac : 0);
}

class Heap {
  constructor() { this.c = []; this.k = []; }
  get size() { return this.c.length; }
  push(c, k) {
    const C = this.c, K = this.k; let i = C.length; C.push(c); K.push(k);
    while (i > 0) { const p = (i - 1) >> 1; if (C[p] <= c) break; C[i] = C[p]; K[i] = K[p]; i = p; }
    C[i] = c; K[i] = k;
  }
  pop() {
    const C = this.c, K = this.k; const rc = C[0], rk = K[0]; const c = C.pop(), k = K.pop(); const n = C.length;
    if (n) {
      let i = 0;
      for (;;) { let l = 2 * i + 1; if (l >= n) break; if (l + 1 < n && C[l + 1] < C[l]) l++; if (C[l] >= c) break; C[i] = C[l]; K[i] = K[l]; i = l; }
      C[i] = c; K[i] = k;
    }
    return [rc, rk];
  }
}

// start:{e,t}  targets:[Map(edge→停止x)] 順に停車  exitSet:終点が路線外(ノード集合)のとき
function findRoute(start, targets, exitSet, onlyDir, revAny, prefDir) {
  const K = targets.length, size = (K + 1) * NE * 2;
  const dist = new Float64Array(size).fill(Infinity), prev = new Int32Array(size).fill(-1);
  const heap = new Heap();
  for (let d = 0; d < 2; d++) {
    if (onlyDir != null && d !== onlyDir) continue;
    let k = 0;
    if (K > 0 && targets[0].has(start.e)) {
      const ts = paramOf(start.e, targets[0].get(start.e));
      if (d === 0 ? ts >= start.t - 1e-6 : ts <= start.t + 1e-6) k = 1;
    }
    const key = (k * NE + start.e) * 2 + d;
    dist[key] = edgeCost(start.e, d, d === 0 ? 1 - start.t : start.t) + (prefDir != null && d !== prefDir ? REVERSE : 0);
    heap.push(dist[key], key);
  }
  let goal = -1, maxK = 0;
  while (heap.size) {
    const [c, key] = heap.pop();
    if (c > dist[key]) continue;
    const d = key & 1, ek = key >> 1, e = ek % NE, k = (ek - e) / NE;
    const node = d ? E[e].a : E[e].b;
    if (k > maxK) maxK = k;
    if (k === K && (!exitSet || exitSet.has(node))) { goal = key; break; }
    if (prev[key] >= 0 && !isNaN(stopX[e]) && (revAny || (k > 0 && targets[k - 1].has(e)))) {
      const nk = key ^ 1, nc = c + REVERSE;
      if (nc < dist[nk]) { dist[nk] = nc; prev[nk] = key; heap.push(nc, nk); }
    }
    const ee = E[e], s1 = d ? -1 : 1;
    for (const f of adj[node]) {
      if (f === e) continue;
      const fe = E[f], d2 = fe.a === node ? 0 : 1;
      let turn = 0;
      if (!ee.portal && !fe.portal) {
        const dot = s1 * (d2 ? -1 : 1) * (ee.vx * fe.vx + ee.vy * fe.vy);
        if (dot <= -0.2) continue;
        if (dot < 0.99) turn = 0.3;
      }
      const k2 = (k < K && targets[k].has(f)) ? k + 1 : k;
      const nk = (k2 * NE + f) * 2 + d2, nc = c + edgeCost(f, d2, 1) + turn;
      if (nc < dist[nk]) { dist[nk] = nc; prev[nk] = key; heap.push(nc, nk); }
    }
  }
  if (goal < 0) return { fail: true, maxK };
  const states = [];
  for (let key = goal; key >= 0; key = prev[key]) {
    const d = key & 1, ek = key >> 1, e = ek % NE;
    states.push({ e, d, k: (ek - e) / NE });
  }
  states.reverse();
  const segs = [], stops = [], revs = [];
  let dcur = 0, jump = false, pk = 0, revT = null;
  states.forEach((st, i) => {
    const ee = E[st.e];
    if (ee.portal) { jump = true; return; }
    let t0 = st.d ? 1 : 0, t1 = st.d ? 0 : 1;
    if (i === 0) t0 = start.t;
    if (revT != null) { t0 = revT; revT = null; }
    const nx = states[i + 1];
    if (nx && nx.e === st.e && nx.d !== st.d) { t1 = revT = paramOf(st.e, stopX[st.e]); revs.push(ST[edgeStation[st.e]].name); }
    if (st.k > pk) {
      const ts = paramOf(st.e, targets[pk].get(st.e));
      stops.push({ d: dcur + Math.abs(ts - t0) * ee.len, name: targets[pk].name });
      if (i === states.length - 1 && !exitSet) t1 = ts;
      pk = st.k;
    }
    const a = pointOn(st.e, t0), b = pointOn(st.e, t1);
    const d1 = dcur + Math.abs(t1 - t0) * ee.len;
    segs.push({ e: st.e, d: st.d, t0, t1, d0: dcur, d1, ax: a.x, ay: a.y, bx: b.x, by: b.y, jump });
    jump = false; dcur = d1;
  });
  if (exitSet) stops.push({ d: dcur, name: null });
  return { segs, total: dcur, stops, revs, cost: dist[goal], exit: !!exitSet };
}

// 種別ごとの停車駅
const S = s => new Set(s.split(' '));
const BRANCH = '京急大津 馬堀海岸 浦賀 六浦 神武寺 逗子・葉山 新大津 北久里浜 京急久里浜 YRP野比 京急長沢 津久井浜 三浦海岸 三崎口 小島新田 大師橋 東門前 川崎大師 鈴木町 港町';
const KAITOKU = '押上 本所吾妻橋 浅草 蔵前 浅草橋 東日本橋 人形町 日本橋 宝町 東銀座 新橋 大門 三田 高輪台 五反田 戸越 中延 馬込 西馬込 泉岳寺 品川 京急蒲田 京急川崎 横浜 上大岡 金沢文庫 金沢八景 横須賀中央 堀ノ内 羽田空港第3ターミナル 羽田空港第1・第2ターミナル ' + BRANCH;
const AIRPORT = ' 糀谷 大鳥居 穴守稲荷 天空橋';
const TYPES = {
  kaitoku: { name: '快特', short: '快特', color: '#12964a', stops: S(KAITOKU) },
  tokkyu: { name: '特急', short: '特急', color: '#e0261c', stops: S(KAITOKU + ' 青物横丁 平和島 神奈川新町 追浜 汐入' + AIRPORT) },
  kyuko: { name: '急行', short: '急行', color: '#0c8fd6', stops: S('泉岳寺 品川 青物横丁 立会川 平和島 京急蒲田 京急川崎 京急鶴見 神奈川新町 京急東神奈川 横浜 日ノ出町 井土ヶ谷 弘明寺 上大岡 杉田 能見台 金沢文庫 金沢八景 追浜 京急田浦 安針塚 逸見 汐入 横須賀中央 県立大学 堀ノ内 ' + BRANCH + AIRPORT) },
  local: { name: '普通', short: '普通', color: '#3b3f46', stops: null },
  apkaitoku: { name: 'エアポート快特', short: 'AP快特', color: '#f07f00', stops: S('泉岳寺 品川 羽田空港第3ターミナル 羽田空港第1・第2ターミナル') },
  wing: { name: 'ウィング', short: 'Wing', color: '#7b3fb5', stops: S('') },
  kaisoku: { name: '快速', short: '快速', color: '#d6408f', stops: null },
  access: { name: 'アクセス特急', short: 'ア特', color: '#f07f00', stops: null },
  tsukin: { name: '通勤特急', short: '通特', color: '#00a0b4', stops: null },
  liner: { name: 'スカイライナー', short: 'SL', color: '#1b3fa8', stops: null },
  mliner: { name: 'ライナー(本線経由)', short: 'ライナー', color: '#7a4fb5', stops: null },   // モーニングライナー・イブニングライナー(表示用)
  kaiso: { name: '回送', short: '回送', color: '#8a8f98', stops: S('') },
};

function plan(start, typeKey, dest, onlyDir) {
  const exitSet = EXITS[dest] || null;
  const destMap = exitSet ? null : stByName.get(dest).stopMap;
  const r0 = findRoute(start, destMap ? [destMap] : [], exitSet, onlyDir, true);
  if (r0.fail) return null;
  const startSt = edgeStation[start.e], names = [], ty = TYPES[typeKey];
  r0.segs.forEach(sg => {
    const si = edgeStation[sg.e];
    if (si < 0 || si === startSt) return;
    const nm = ST[si].name;
    if (nm !== dest && !names.includes(nm) && (!ty.stops || ty.stops.has(nm) || r0.revs.includes(nm))) names.push(nm);
  });
  if (!names.length) return r0;
  const targets = names.map(n => stByName.get(n).stopMap);
  if (destMap) targets.push(destMap);
  // ホームに入れない駅があれば、その駅を通過扱いにして再探索
  for (let i = 0; i < 12; i++) {
    const r = findRoute(start, targets, exitSet, onlyDir, false);
    if (!r.fail) return r;
    if (r.maxK >= targets.length - (destMap ? 1 : 0)) break;
    if (typeof PLAN_LOG !== 'undefined') PLAN_LOG.push(targets[r.maxK].name);
    targets.splice(r.maxK, 1);
  }
  return r0;
}

// ===== 経路上の位置計算 =====
function segAt(r, d) {
  let lo = 0, hi = r.segs.length - 1;
  while (lo < hi) { const m = (lo + hi) >> 1; if (r.segs[m].d1 < d) lo = m + 1; else hi = m; }
  return r.segs[lo];
}
function ptOnSeg(sg, d) {
  const L = sg.d1 - sg.d0, f = L > 0 ? (d - sg.d0) / L : 0;
  return { x: sg.ax + (sg.bx - sg.ax) * f, y: sg.ay + (sg.by - sg.ay) * f };
}
function segDir(sg) { const s = sg.d ? -1 : 1; return [s * E[sg.e].vx, s * E[sg.e].vy]; }
function posAt(r, d) {
  if (d < 0) { const sg = r.segs[0], v = segDir(sg); return { x: sg.ax + v[0] * d, y: sg.ay + v[1] * d }; }
  if (d > r.total) { const sg = r.segs[r.segs.length - 1], v = segDir(sg), o = d - r.total; return { x: sg.bx + v[0] * o, y: sg.by + v[1] * o }; }
  return ptOnSeg(segAt(r, d), d);
}
function locate(r, d) {
  d = Math.max(0, Math.min(r.total, d));
  const sg = segAt(r, d), L = sg.d1 - sg.d0, f = L > 0 ? (d - sg.d0) / L : 0;
  return { e: sg.e, t: sg.t0 + (sg.t1 - sg.t0) * f, dir: sg.d };
}
function pathD(r, dA, dB) {
  let s = '', first = true;
  const add = (p, brk) => { s += (brk || first ? 'M' : 'L') + p.x.toFixed(1) + ' ' + p.y.toFixed(1); first = false; };
  if (dA < 0) add(posAt(r, dA), true);
  for (const sg of r.segs) {
    if (sg.d1 < dA || sg.d0 > dB) continue;
    add(ptOnSeg(sg, Math.max(dA, sg.d0)), sg.jump && sg.d0 >= dA);
    add(ptOnSeg(sg, Math.min(dB, sg.d1)), false);
  }
  if (dB > r.total) add(posAt(r, dB), false);
  return s;
}

// ===== 時刻表列車用: 停車駅を順にたどる経路(駅ごとに区切って探索) =====
function cutAt(r, sd) {
  const out = [];
  for (const g of r.segs) {
    if (g.d0 >= sd - 1e-9) break;
    if (g.d1 <= sd + 1e-9) { out.push(g); continue; }
    const f = (sd - g.d0) / (g.d1 - g.d0);
    out.push(Object.assign({}, g, { t1: g.t0 + (g.t1 - g.t0) * f, d1: sd, bx: g.ax + (g.bx - g.ax) * f, by: g.ay + (g.by - g.ay) * f }));
    break;
  }
  return out;
}
const NO_TANDEM = new Set(['金沢文庫']), NO_TANDEM_MAX = 330;   // 縦列停車できない駅: 空いている番線があれば、遠回りしてでもそちらへ入る
const KS_Y = 1020;   // これより下(y が大きい側)が、配線図から自動で取り込んだ京成・北総・芝山の範囲
const DETOUR_MAX = 120;   // 番線を変えるために許す遠回りの上限(コスト)
const legCache = new Map();
function cachedRoute(st, tg, ex, dir, exKey) {
  const key = ROUTE_CLS + '/' + ROUTE_PO + '/' + st.e + ':' + st.t.toFixed(3) + ':' + dir + '|' + tg.map(m => m.name + '[' + [...m.keys()].join(',') + ']').join('>') + '|' + (exKey || '');
  let r = legCache.get(key);
  if (r === undefined) { r = findRoute(st, tg, ex, null, false, dir); legCache.set(key, r); }
  return r;
}
// 引上線: ホームの先にある行き止まりの線(車止めまで25〜130)。駅名 → [{node, e, t, trim}]
const SIDINGS = new Map();
{
  const allStops = new Map(); allStops.name = '*';
  ST.forEach(s => s.stops.forEach(([e, x]) => allStops.set(e, x)));
  const special = new Set();
  D.portals.forEach(p => p.forEach(n => special.add(n)));
  D.exits.forEach(([n]) => special.add(n));
  N.forEach((_, n) => {
    if (adj[n].length !== 1 || special.has(n)) return;
    const e = adj[n][0];
    if (!isNaN(stopX[e])) return;
    const atA = E[e].a === n;
    const r = findRoute({ e, t: atA ? 0 : 1 }, [allStops], null, null, false);
    if (r.fail || r.total < 25 || r.total > 130) return;
    const name = ST[edgeStation[r.segs[r.segs.length - 1].e]].name;
    const trim = Math.min(8, E[e].len * 0.8), f = trim / E[e].len;
    if (!SIDINGS.has(name)) SIDINGS.set(name, []);
    SIDINGS.get(name).push({ node: n, e, t: atA ? f : 1 - f, trim, set: new Set([n]) });
    r.segs.slice(0, -1).forEach(g => { if (isNaN(stopX[g.e]) && edgeStation[g.e] < 0) E[g.e].dir = 0; });   // 引上線への出入りの線は両方向に使う
  });
}
// 検車区(車庫の線を1本ずつ使って、1日の始まり・終わりの列車を並べる駅)。車庫の線 = ホームから直接は行けず、ホームの先の引上線(hs)で折り返して入る行き止まり
const YARD_ST = new Set(['西馬込', '神奈川新町', '金沢文庫']);
// plat: 引上線を使わず、ホームで向きを変えて車庫の線と行き来する駅。box = 車庫の線の行き止まりがある範囲 [x0, y0, x1, y1]
const YARD_CFG = { '金沢文庫': { box: [545, 450, 705, 516], plat: true } };
const YARDS = new Map();
function yardOf(name) {
  if (YARDS.has(name)) return YARDS.get(name);
  let Y = null; const s = stByName.get(name);
  if (s && YARD_ST.has(name) && s.stops.length) {
    const special = new Set(); D.portals.forEach(q => q.forEach(n => special.add(n))); D.exits.forEach(([n]) => special.add(n));
    const pm = new Map(); s.stops.forEach(([e, x]) => pm.set(e, x)); pm.name = name;
    const cx = s.cx, cy = s.ly, pos = (n, trim) => { const e = adj[n][0], atA = E[e].a === n, f = Math.min(0.95, trim / E[e].len); return { node: n, e, t: atA ? f : 1 - f, trim, set: new Set([n]), len: E[e].len }; };
    const dead = []; N.forEach((q, n) => { if (adj[n].length === 1 && !special.has(n) && isNaN(stopX[adj[n][0]]) && Math.abs(q.x - cx) < 260 && Math.abs(q.y - cy) < 160) dead.push(n); });
    const hs = [], rest = [], yc = YARD_CFG[name];
    if (yc && yc.plat) {   // ホームで向きを変える検車区: 範囲の中の行き止まりが車庫の線
      const [x0, y0, x1, y1] = yc.box, tracks = [];
      for (const n of dead) { const q = N[n]; if (q.x < x0 || q.x > x1 || q.y < y0 || q.y > y1 || E[adj[n][0]].len < 12) continue; tracks.push({ node: n, e: adj[n][0], len: E[adj[n][0]].len, via: [], y: q.y }); }
      tracks.sort((a, b) => b.y - a.y || a.node - b.node); tracks.forEach((t, i) => { t.i = i; t.label = '車庫' + (i + 1) + '番'; });
      Y = tracks.length ? { name, hs: [], tracks, pos, plat: true, pm } : null;
      YARDS.set(name, Y); return Y;
    }
    for (const n of dead) { const e = adj[n][0], r = findRoute({ e, t: E[e].a === n ? 0 : 1 }, [pm], null, null, false); if (!r.fail && r.total >= 60 && r.total <= 220) hs.push(Object.assign(pos(n, Math.min(8, E[e].len * 0.8)), { dist: r.total })); else if (r.fail || r.total > 220) rest.push(n); }
    const tracks = [];
    for (const n of rest) {
      if (E[adj[n][0]].len < 12) continue;   // 短すぎる線(安全側線など)
      const via = []; for (const h of hs) { const r = findRoute({ e: h.e, t: h.t }, [], new Set([n]), null, false); if (!r.fail && r.total <= 700) via.push(h); }
      if (via.length) tracks.push({ node: n, e: adj[n][0], len: E[adj[n][0]].len, via, y: N[n].y });
    }
    tracks.sort((a, b) => a.y - b.y || a.node - b.node); tracks.forEach((t, i) => { t.i = i; t.label = '車庫' + (i + 1) + '番'; });
    const used = new Set(tracks.flatMap(t => t.via)); Y = { name, hs: hs.filter(h => used.has(h)), tracks, pos };
    if (!Y.hs.length || !tracks.length) Y = null;
  }
  YARDS.set(name, Y); return Y;
}
// opt: exitStart, exitEnd, startAt({e,t}), startExtra(startAtが駅の手前=引上線), after(終着後に向かう駅),
//      tail(引上線), isFree(i, edge) → その時間帯に番線が空いているか
// 本線の線路: 途中駅に止まらない列車が通る線。待避する列車はここを空ける
let MAINTHRU = null;
const MAINSGN = new Map();   // 本線として使う向き(1=右向き, 2=左向き)
function mainThru() {
  if (MAINTHRU) return MAINTHRU;
  const set = new Set();
  for (const [a, b] of [['泉岳寺', '浦賀'], ['堀ノ内', '三崎口'], ['京急蒲田', '羽田空港第1・第2ターミナル'], ['金沢八景', '逗子・葉山'], ['押上', '泉岳寺'], ['泉岳寺', '西馬込'], ['京成上野', '京成高砂'], ['京成高砂', '京成津田沼'], ['京成津田沼', '京成成田'], ['京成成田', '空港第2ビル'], ['押上', '青砥'], ['京成高砂', '印旛日本医大'], ['印旛日本医大', '成田空港'], ['京成成田', '芝山千代田']]) for (const nm of [[a, b], [b, a]]) {
    const r = buildTimedRoute(nm, [0, 0], {});
    if (r) for (const g of r.segs) { set.add(g.e); const sg = Math.sign(g.bx - g.ax); if (sg) MAINSGN.set(g.e, (MAINSGN.get(g.e) || 0) | (sg > 0 ? 1 : 2)); }
  }
  // 途中で区切った駅(京成津田沼)は、始発・終着の列車が入る線まで本線に数えてしまう。通しで走る経路が通らないホームの線は本線から外す(待避に使える)
  for (const [a, b, mid] of [['京成高砂', '京成成田', '京成津田沼']]) { if (![a, b, mid].every(n => stByName.has(n))) continue;
    const thru = new Set(); let ok = true;
    for (const nm of [[a, b], [b, a]]) { const r = buildTimedRoute(nm, [0, 0], {}); if (r) for (const g of r.segs) thru.add(g.e); else ok = false; }
    if (ok) for (const [e] of stByName.get(mid).stops) if (!thru.has(e)) { set.delete(e); MAINSGN.delete(e); } }
  return MAINTHRU = set;
}
function buildTimedRoute(names, longDwell, opt) {
  ROUTE_CLS = opt.cls || null; ROUTE_NAMES = new Set(names); ROUTE_PO = PO_STATIONS.filter(n => ROUTE_NAMES.has(n)).join(',');
  try { return buildTimedRoute_(names, longDwell, opt); } finally { ROUTE_CLS = null; ROUTE_NAMES = null; ROUTE_PO = ''; }
}
function buildTimedRoute_(names, longDwell, opt) {
  let maps = names.map(n => stByName.get(n).stopMap);
  // 運用の編集で番線を指定した駅(opt.force = {駅の添字: 線}): その線だけにする。指定の線がその駅のホームに無ければ無視
  if (opt.force) maps = maps.map((m, i) => { const e = opt.force[i]; if (e == null || !m.has(+e)) return m; const f = new Map([[+e, m.get(+e)]]); f.name = m.name; f.forced = true; return f; });
  // 番線の使い方が決まっている駅(品川など): 入ってはいけない番線を最初から外す
  if (opt.allow) maps = maps.map((m, i) => { const f = new Map([...m].filter(([e]) => opt.allow(i, e))); f.name = m.name; return f.size && f.size < m.size ? f : m; });
  const afterMap = opt.after && !opt.exitEnd && !opt.tail ? stByName.get(opt.after).stopMap : null;
  const endSet = opt.exitEnd ? EXITS[opt.exitEnd] : (opt.tail ? opt.tail.set : null);
  const endKey = opt.exitEnd || (opt.tail ? 'n' + opt.tail.node : '');
  const segs = [], stopD = [0], stopE = [], only = [];
  let off = 0, cur = null, dir = null;
  const push = (gs, len) => { gs.forEach(g => segs.push(Object.assign({}, g, { d0: g.d0 + off, d1: g.d1 + off }))); off += len; stopD.push(off); const l = segs[segs.length - 1]; cur = { e: l.e, t: l.t1 }; dir = l.d; };
  const freeMap = i => {
    if (!opt.isFree) return maps[i];
    const m = new Map([...maps[i]].filter(([e]) => opt.isFree(i, e))); m.name = maps[i].name;
    return m.size ? m : maps[i];
  };
  // 次の停車駅だけでなく、その次の駅まで見てホーム(番線)を選ぶ。ふさがっている番線は避ける
  const leg = (starts, i) => {
    let best = null;
    const tryMap = (m, bias) => {
      const tg = [m]; let tgFull = null;
      if (i + 1 < maps.length) { const f = freeMap(i + 1); tg.push(f); if (f !== maps[i + 1]) tgFull = [m, maps[i + 1]]; } else if (afterMap) tg.push(afterMap);   // 次の駅も、空いている番線へ入れるかを見て決める
      const last = i + 1 >= maps.length;
      for (const st of starts) {
        let r = cachedRoute(st, tg, last ? endSet : null, dir, last ? endKey : '');
        // 次の駅の空いている番線へ入るために大回りになるなら、ふさがっていても素直な番線を目指す(逆線を走り続けるのを防ぐ)
        if (tgFull) { const rf = cachedRoute(st, tgFull, last ? endSet : null, dir, last ? endKey : ''); if (!rf.fail && (r.fail || r.cost > rf.cost + DETOUR_MAX)) r = rf; }
        if (r.fail && (tg.length > 1 || (last && endSet))) r = cachedRoute(st, [m], null, dir, '');
        if (!r.fail && (!best || r.cost + bias + (st.pen || 0) < best.cost)) best = { r, cost: r.cost + bias + (st.pen || 0) };
      }
    };
    // 空いている番線を優先するが、そのために大回り・余計な折り返しが必要になるなら素直な番線を使う(重なりは許容)
    let base = freeMap(i);
    tryMap(maps[i], 0);
    if (base !== maps[i] && best && i + 1 < maps.length && N[E[maps[i].keys().next().value].a].y > KS_Y) {   // 京成・北総の区間だけ(京急側は番線の向きが元の図どおりでないため)。終着駅ではどちら向きの線でもよい
      // 空いているからといって、反対方向の線のホームへは入らない(その先ずっと逆線を走ることになる)
      const lg = cutAt(best.r, best.r.stops[0].d).pop(), sg = lg ? Math.sign(lg.bx - lg.ax) : 0;
      if (sg) { const b2 = new Map([...base].filter(([e]) => !E[e].dir || E[e].dir === sg)); b2.name = base.name; base = b2.size ? b2 : maps[i]; }
    }
    if (base !== maps[i]) {
      const full = best; best = null;
      tryMap(base, 0);
      if (!best || (full && best.cost > full.cost + (NO_TANDEM.has(maps[i].name) ? NO_TANDEM_MAX : opt.longTurn && i === maps.length - 1 ? opt.longTurn : DETOUR_MAX))) { best = full; base = maps[i]; }   // longTurn: 途中駅で長く折り返す列車は、遠回りしてでも空いた番線へ
    }
    // 複々線の駅(金沢文庫・金沢八景)は内線/外線で役割が決まっているので、待避でも線を入れ替えない
    if (best && longDwell[i] && base.size > 1 && ![...maps[i].keys()].some(e => E[e].lane)) {   // 長時間停車(待避)は本線を空けて副本線側のホームへ
      const used = cutAt(best.r, best.r.stops[0].d).pop().e;
      // 本線(通過列車が走る線)が分かっていれば、本線に止まろうとしているときだけ副本線へ移す。すでに副本線ならそのまま
      // 反対方向の線の副本線へは入らない(入ると、その先ずっと逆線を走ることになる)
      const lg = cutAt(best.r, best.r.stops[0].d).pop(), sgn = Math.sign(lg.bx - lg.ax);
      // 京成・北総: 反対向きの本線を兼ねる中線(八広など)は、こちら向きには待避線として使える
      const isMain = e => MAINTHRU.has(e) && !(N[E[e].a].y > KS_Y && sgn && !E[e].dir && !((MAINSGN.get(e) || 0) & (sgn > 0 ? 1 : 2)));
      const alt = new Map([...base].filter(([e]) => (MAINTHRU ? !isMain(e) : e !== used) && (!E[e].dir || !sgn || E[e].dir === sgn))); alt.name = base.name;
      // 優等列車が長く止まるだけ(待避と決まっていない)なら、本線のホームが空いている間は本線に止める(京急蒲田の特急の2分停車など)
      const stay = longDwell[i] === 1 && opt.cls === 'in' && opt.isFree && opt.isFree(i, used);
      if (!stay && alt.size && (!MAINTHRU || MAINTHRU.has(used))) tryMap(alt, -70);
    }
    if (!best) return false;
    const sd = best.r.stops[0].d;
    if (opt.probe) {   // この駅で、ほかの番線に無理なく入れるか(入れないなら「この番線しか使えない列車」)
      const used = cutAt(best.r, sd).pop().e, alt = new Map([...maps[i]].filter(([e]) => e !== used)); alt.name = maps[i].name;
      const save = best; let ok = false;
      if (alt.size) { best = null; tryMap(alt, 0); ok = !!best && best.cost <= save.cost + DETOUR_MAX; }
      best = save; only[i] = !ok;
    }
    push(cutAt(best.r, sd), sd);
    stopE[i] = cur.e;
    return true;
  };
  let i = 0;
  if (opt.exitStart) { if (!leg([...EXITS[opt.exitStart]].map(n => ({ e: adj[n][0], t: E[adj[n][0]].a === n ? 0 : 1 })), 0)) return null; i = 1; }
  else if (opt.startAt && opt.startExtra) { if (!leg([opt.startAt], 0)) return null; i = 1; }
  else {
    let starts = opt.startAt ? [opt.startAt] : [...freeMap(0)].map(([e, x]) => ({ e, t: paramOf(e, x), pen: MAINTHRU && MAINTHRU.has(e) ? 40 : 0 }));   // 始発列車は、できれば本線でなく副本線側のホームから出す
    if (!opt.startAt) {   // 空いているホームから出るために逆線を走り続けるくらいなら、ふさがっていても素直なホームから出す
      const all = [...maps[0]].map(([e, x]) => ({ e, t: paramOf(e, x), pen: MAINTHRU && MAINTHRU.has(e) ? 40 : 0 }));
      if (all.length > starts.length) {
        const cst = l => { let b = Infinity; for (const st of l) { const r = cachedRoute(st, [maps[1]], null, dir, ''); if (!r.fail) b = Math.min(b, r.cost + (st.pen || 0)); } return b; };
        if (cst(starts) > cst(all) + DETOUR_MAX) starts = all;
      }
    }
    if (!leg(starts, 1)) return null;
    stopE[0] = segs[0].e; i = 2;
  }
  for (; i < maps.length; i++) if (!leg([cur], i)) return null;
  if (endSet) {
    const r = opt.tail ? findRoute(cur, [], endSet, opt.tailRev ? null : dir, false) : cachedRoute(cur, [], endSet, dir, endKey);   // 引上線へは向きを変えずに進む
    if (!r.fail && opt.tail && (r.total > (opt.tailMax || 150) || r.cost > r.total * 1.5 + (opt.tailRev ? 150 : 25))) return null;   // tailMax: 検車区の引上線(ホームから遠い線もある)   // 遠すぎる線・逆線を渡り歩く線は引上線として使わない
    if (!r.fail) { const len = r.total - (opt.tail ? opt.tail.trim : 0); if (len > 1) push(cutAt(r, len), len); else return opt.tail ? null : { segs, total: off, stopD, stopE }; }
    else if (opt.tail) return null;
  }
  return { segs, total: off, stopD, stopE, only };
}
