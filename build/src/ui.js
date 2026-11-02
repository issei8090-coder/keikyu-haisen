// ===== 描画 =====
const NSVG = 'http://www.w3.org/2000/svg';
const svg = document.getElementById('map');
const $ = id => document.getElementById(id);
function el(tag, attrs, parent, text) {
  const e = document.createElementNS(NSVG, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (text != null) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
}
svg.setAttribute('viewBox', `0 0 ${D.W} ${D.H}`);
const defs = el('defs', {}, svg);
const pat = el('pattern', { id: 'hatch', width: 4, height: 4, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
el('line', { x1: 0, y1: 0, x2: 0, y2: 4, class: 'hatchline' }, pat);
const gStatic = el('g', {}, svg), gRoute = el('g', {}, svg), gTrains = el('g', {}, svg), gCursor = el('g', {}, svg);

D.hatch.forEach(p => el('rect', { x: p[0], y: p[1], width: p[2] - p[0] + 1, height: p[3] - p[1] + 1, class: 'hatch' }, gStatic));
ST.forEach(s => s.plats.forEach(p => el('rect', { x: p[0], y: p[1], width: p[2] - p[0] + 1, height: p[3] - p[1] + 1, class: 'plat' }, gStatic)));
let td = '';
let tdo = '';
E.forEach(e => { if (e.portal) return; const q = `M${N[e.a].x} ${N[e.a].y}L${N[e.b].x} ${N[e.b].y}`; if (e.over) tdo += q; else td += q; });
el('path', { d: tdo, class: 'track over' }, gStatic);
D.decor.forEach(d => { td += `M${d[0]} ${d[1]}L${d[2]} ${d[3]}`; });
el('path', { d: td, class: 'track' }, gStatic);
(D.platDecor || []).forEach(p => el('rect', { x: p[0], y: p[1], width: p[2] - p[0] + 1, height: p[3] - p[1] + 1, class: 'plat' }, gStatic));
ST.forEach(s => el('text', { x: s.lx, y: s.ly, class: 'stname' }, gStatic, s.label || s.name));
D.portals.forEach((p, i) => p.forEach(n => {
  const right = N[n].x > D.W / 2;
  el('text', { x: N[n].x + (right ? 7 : -7), y: N[n].y + 3.5, class: 'mark' }, gStatic, i === 10 || i === 11 ? '#' : i === 14 || i === 15 ? '◆' : i === 16 || i === 17 ? '◇' : '※');
}));
[...'都営浅草線'].forEach((c, i) => el('text', { x: 5, y: 16 + i * 10, class: 'pink' }, gStatic, c));
el('text', { x: 152, y: 84, class: 'pink' }, gStatic, '都営浅草線');
(D.text || []).forEach(([x, y, s]) => el('text', { x, y, class: 'pink' }, gStatic, s));
el('text', { x: 682, y: 170, class: 'note' }, gStatic, '(地平)');
el('text', { x: 650, y: 236, class: 'note' }, gStatic, '(高架)');

const routeHL = el('path', { class: 'routehl' }, gRoute);
const cursor = el('circle', { r: 3.2, class: 'cursor', visibility: 'hidden' }, gCursor);
const originMark = el('g', { visibility: 'hidden' }, gCursor);
el('circle', { r: 4.5, class: 'origin' }, originMark);
el('circle', { r: 1.4, class: 'origindot' }, originMark);

// ===== 状態 =====
const LEN = 12, VMAX = 30, ACC = 28, DWELL = 2.5, GAP = 5;
const trains = [];
let nextId = 1, selected = null, origin = null, running = true, speed = 1, typeKey = 'kaitoku';
const LINES = [
  ['本線', '泉岳寺 品川 北品川 新馬場 青物横丁 鮫洲 立会川 大森海岸 平和島 大森町 梅屋敷 京急蒲田 雑色 六郷土手 京急川崎 八丁畷 鶴見市場 京急鶴見 花月総持寺 生麦 京急新子安 子安 神奈川新町 京急東神奈川 神奈川 横浜 戸部 日ノ出町 黄金町 南太田 井土ヶ谷 弘明寺 上大岡 屏風浦 杉田 京急富岡 能見台 金沢文庫 金沢八景 追浜 京急田浦 安針塚 逸見 汐入 横須賀中央 県立大学 堀ノ内 京急大津 馬堀海岸 浦賀'],
  ['久里浜線', '新大津 北久里浜 京急久里浜 YRP野比 京急長沢 津久井浜 三浦海岸 三崎口'],
  ['空港線', '糀谷 大鳥居 穴守稲荷 天空橋 羽田空港第3ターミナル 羽田空港第1・第2ターミナル'],
  ['大師線', '港町 鈴木町 川崎大師 東門前 大師橋 小島新田'],
  ['逗子線', '六浦 神武寺 逗子・葉山'],
  ['都営浅草線', '押上 本所吾妻橋 浅草 蔵前 浅草橋 東日本橋 人形町 日本橋 宝町 東銀座 新橋 大門 三田 高輪台 五反田 戸越 中延 馬込 西馬込'],
  ['図の外へ', Object.keys(EXITS).join(' ')],
];
{ // 上のどれにも入っていない駅(京成・北総・芝山)はまとめて1つのグループにする
  const known = new Set(LINES.flatMap(l => l[1].split(' '))), rest = ST.map(s => s.name).filter(n => !known.has(n));
  if (rest.length) LINES.splice(LINES.length - 1, 0, ['京成・北総・芝山', rest.join(' ')]);
}
function fillSelect(sel, withExits, first) {
  sel.innerHTML = '';
  if (first) sel.add(new Option(first, ''));
  LINES.forEach(([line, names]) => {
    if (line === '図の外へ' && !withExits) return;
    const g = document.createElement('optgroup'); g.label = line;
    names.split(' ').forEach(n => g.appendChild(new Option(n, n)));
    sel.appendChild(g);
  });
}
fillSelect($('org'), true, '(図の線路をクリックして指定)');
fillSelect($('dst'), true); $('dst').value = '三崎口';
fillSelect($('redst'), true);
Object.entries(TYPES).forEach(([k, t]) => {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'chip'; b.textContent = t.name; b.dataset.k = k; b.style.setProperty('--c', t.color);
  b.onclick = () => { typeKey = k; document.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c.dataset.k === k)); };
  if (k === typeKey) b.classList.add('on');
  $('types').appendChild(b);
});
const shortDest = d => d.replace(/^(?:都営浅草線|京成線)\((.+)\)$/, '$1').replace(/^羽田空港第.*$/, m => m.includes('第3') ? '羽田空港第3T' : '羽田空港');
function msg(t, bad) { const m = $('msg'); m.textContent = t; m.className = bad ? 'bad' : ''; }

// ===== 列車 =====
function bodyPoints(t) {
  const pts = [];
  for (let d = t.s - LEN / 2; d <= t.s + LEN / 2 + 0.01; d += 2) pts.push(posAt(t.route, d));
  return pts;
}
function routeIntervals(route, center, length = LEN) {
  const lo = center - length / 2, hi = center + length / 2, spans = [];
  for (const sg of route.segs) {
    const a = Math.max(lo, sg.d0), b = Math.min(hi, sg.d1);
    if (a > b) continue;
    const L = sg.d1 - sg.d0, f0 = L > 0 ? (a - sg.d0) / L : 0, f1 = L > 0 ? (b - sg.d0) / L : 0;
    const x0 = sg.t0 + (sg.t1 - sg.t0) * f0, x1 = sg.t0 + (sg.t1 - sg.t0) * f1;
    spans.push({ e: sg.e, lo: Math.min(x0, x1) * E[sg.e].len, hi: Math.max(x0, x1) * E[sg.e].len });
  }
  return spans;
}
function occupied(route, s, except) {
  const spans = routeIntervals(route, s);
  for (const o of trains) {
    if (o === except || o.state === 'arrived') continue;
    const other = routeIntervals(o.route, o.s, o.len || LEN);
    for (const a of spans) for (const b of other) if (a.e === b.e && a.lo <= b.hi + GAP && b.lo <= a.hi + GAP) return true;
  }
  return false;
}
function addTrain(route, tk, dest, after) {
  const ty = TYPES[tk];
  const g = el('g', { class: 'train' }, gTrains);
  const t = { id: nextId++, type: tk, dest, after, route, s: 0, v: 0, ni: 0, state: 'run', dwell: 0, hold: false, pts: [], g,
    casing: el('path', { class: 'casing' }, g), body: el('path', { class: 'body', stroke: ty.color }, g),
    label: el('text', { class: 'tlabel', fill: ty.color }, g, `${ty.short} ${shortDest(dest)}`) };
  g.addEventListener('click', ev => { ev.stopPropagation(); select(t); });
  t.pts = bodyPoints(t);
  trains.push(t); drawTrain(t); renderList();
  return t;
}
function removeTrain(t) {
  const i = trains.indexOf(t); if (i < 0) return;
  trains.splice(i, 1); t.g.remove();
  if (selected === t) select(null);
  renderList();
}
function drawTrain(t) {
  const h = (t.len || (t.cars ? (t.cut || t.unit ? 4 : t.cars) * 1.5 : LEN)) / 2, d = pathD(t.route, t.s - h - (t.extB || 0), t.s + h + (t.extF || 0));
  t.casing.setAttribute('d', d); t.body.setAttribute('d', d);
  const p = posAt(t.route, t.s);
  t.label.setAttribute('x', p.x); t.label.setAttribute('y', p.y - 4.5);
}
function bestFromStation(name, tk, dest) {
  let best = null;
  const starts = EXITS[name]
    ? [...EXITS[name]].map(n => ({ e: adj[n][0], t: E[adj[n][0]].a === n ? 0 : 1 }))   // 浅草線から直通で入線
    : stByName.get(name).stops.map(([e, x]) => ({ e, t: paramOf(e, x) }));
  for (const st of starts) {
    const r = plan(st, tk, dest);
    if (r && r.total > 0.5 && !occupied(r, 0) && (!best || r.cost < best.cost)) best = r;
  }
  return best;
}
function spawn(orgName, tk, dest, after, quiet) {
  let r = null;
  if (orgName) {
    if (orgName === dest) { if (!quiet) msg('始発と行先が同じです', true); return null; }
    r = bestFromStation(orgName, tk, dest);
  } else if (origin) {
    r = plan(origin, tk, dest);
    if (r && (r.total < 0.5 || occupied(r, 0))) r = null;
  } else { if (!quiet) msg('始発駅を選ぶか、図の線路をクリックしてください', true); return null; }
  if (!r) { if (!quiet) msg('投入できません(経路がない／その位置に列車がいます)', true); return null; }
  const t = addTrain(r, tk, dest, after);
  if (!quiet) msg(`${TYPES[tk].name} ${shortDest(dest)}行きを投入しました`);
  return t;
}
function reroute(t, dest) {
  const loc = locate(t.route, t.s);
  const moving = t.state === 'run' && t.v > 0.5;
  const r = plan({ e: loc.e, t: loc.t }, t.type, dest, moving ? loc.dir : null);
  if (!r || r.total < 0.5) return false;
  t.route = r; t.s = 0; t.ni = 0; t.dest = dest; t.dwell = 0;
  if (t.state !== 'run') { t.state = 'run'; t.v = 0; }
  t.label.textContent = `${TYPES[t.type].short} ${shortDest(dest)}`;
  drawTrain(t); renderList(); updateSel();
  return true;
}
function stateText(t) {
  if (t.hold) return '抑止中';
  if (t.state === 'arrived') return `${shortDest(t.dest)} 到着`;
  if (t.state === 'dwell') return `${t.route.stops[t.ni].name} 停車中`;
  if (t.blocked) return '前方に列車(待機)';
  const nx = t.route.stops[t.ni];
  return nx && nx.name ? `次は ${nx.name}` : '走行中';
}

function step(dt) {
  // すべての列車の更新前位置から占有区間を作り、このstep中は固定して参照する。
  const occupiedSnapshot = trains.map(train => ({ train, spans: routeIntervals(train.route, train.s, train.len || LEN) }));
  for (const t of [...trains]) {
    if (t.state === 'arrived') { if (t.after === 'remove') { t.dwell -= dt; if (t.dwell <= 0) removeTrain(t); } continue; }
    if (t.hold) { t.v = 0; continue; }
    if (t.state === 'dwell') { t.dwell -= dt; if (t.dwell > 0) continue; t.state = 'run'; t.ni++; }
    const target = t.route.stops[t.ni].d;
    // 前方の列車を検知
    let limit = target; t.blocked = false;
    const front = t.s + (t.len || LEN) / 2, look = GAP + 3 + t.v * t.v / (2 * ACC);
    scan: for (let d = front + 1; d <= front + look; d += 1.5) {
      const sg = segAt(t.route, d), f = (d - sg.d0) / (sg.d1 - sg.d0), x = sg.t0 + (sg.t1 - sg.t0) * f;
      const dir = sg.d ? -1 : 1;
      for (const o of occupiedSnapshot) {
        if (o.train === t || o.train.state === 'arrived') continue;
        for (const span of o.spans) {
          if (span.e !== sg.e) continue;
          const ahead = dir > 0 ? span.lo - x * E[sg.e].len : x * E[sg.e].len - span.hi;
          if (ahead >= -1e-6) { limit = Math.min(limit, d + ahead - (t.len || LEN) / 2 - GAP); t.blocked = true; break scan; }
        }
      }
    }
    const dist = Math.max(0, limit - t.s), v0 = t.v;
    if (dist <= 1e-9) t.v = 0;
    else {
      // 1 tick後に走行距離と残りの制動距離を足しても目標を越えない終端速度上限。
      const rad = (ACC * dt) ** 2 + 8 * ACC * dist - 4 * ACC * dt * v0;
      const vBrake = rad > 0 ? Math.max(0, (-ACC * dt + Math.sqrt(rad)) / 2) : 0;
      const vAllow = Math.min(VMAX, vBrake);
      const dv = Math.max(-ACC * dt, Math.min(ACC * dt, vAllow - v0));
      const v1 = Math.max(0, v0 + dv);
      // 停止までの時間がtickより短い場合は、制動区間だけ正確な時間で積分する。
      const moveDt = v1 === 0 && v0 > 0 ? Math.min(dt, v0 / ACC) : dt;
      t.v = v1;
      t.s += (v0 + v1) * 0.5 * moveDt;
    }
    if (t.s >= target - 1e-7 && t.v <= 0.05) {
      t.v = 0;
      if (t.ni >= t.route.stops.length - 1) {
        if (t.route.exit) { removeTrain(t); continue; }
        t.state = 'arrived'; t.dwell = 3;
      } else { t.state = 'dwell'; t.dwell = DWELL; }
    }
    drawTrain(t);
  }
}
let last = performance.now(), uiT = 0;
function frame(now) {
  const real = Math.min(0.1, (now - last) / 1000); last = now;
  if (running) { let dt = real * speed; while (dt > 0) { const h = Math.min(dt, 0.05); step(h); dt -= h; } }
  ttFrame(real);
  if (selected) routeHL.setAttribute('d', selected.state === 'arrived' ? '' : pathD(selected.route, selected.s, selected.route.total));
  uiT += real; if (uiT > 0.3) { uiT = 0; updateStates(); }
  requestAnimationFrame(frame);
}

// ===== パネル =====
function renderList() {
  const ul = $('list'); ul.innerHTML = '';
  $('count').textContent = trains.length + (window.ttActiveN || 0);
  $('empty').hidden = trains.length + (window.ttActiveN || 0) > 0;
  trains.forEach(t => {
    const li = document.createElement('li');
    li.className = t === selected ? 'sel' : '';
    li.innerHTML = `<span class="dot" style="background:${TYPES[t.type].color}"></span><b>${TYPES[t.type].name}</b> ${shortDest(t.dest)}<small></small><button title="削除">×</button>`;
    li.onclick = () => select(t);
    li.querySelector('button').onclick = ev => { ev.stopPropagation(); removeTrain(t); };
    t.li = li; ul.appendChild(li);
  });
  updateStates();
}
function updateStates() {
  trains.forEach(t => { if (t.li) t.li.querySelector('small').textContent = stateText(t); });
  if (selected) $('selstate').textContent = stateText(selected);
}
function select(t) {
  if (t && ttSel) ttSelect(null);
  if (selected) selected.g.classList.remove('sel');
  selected = t;
  $('selbox').hidden = !t;
  routeHL.setAttribute('d', '');
  if (t) { t.g.classList.add('sel'); gTrains.appendChild(t.g); $('redst').value = t.dest; }
  trains.forEach(o => o.li && o.li.classList.toggle('sel', o === t));
  updateSel();
}
function updateSel() {
  const t = selected; if (!t) return;
  $('seltitle').textContent = `${TYPES[t.type].name} ${shortDest(t.dest)}行き`;
  $('seltitle').style.color = TYPES[t.type].color;
  $('hold').textContent = t.hold ? '発車させる' : '抑止する';
  $('selstops').textContent = '停車駅: ' + (t.route.stops.slice(t.ni).map(s => s.name).filter(Boolean).join(' → ') || 'なし');
  $('selstate').textContent = stateText(t);
}
$('go').onclick = () => spawn($('org').value, typeKey, $('dst').value, $('after').value);
$('org').onchange = () => { if ($('org').value) { origin = null; originMark.setAttribute('visibility', 'hidden'); } };
$('play').onclick = () => { running = !running; $('play').textContent = running ? '⏸ 一時停止' : '▶ 再開'; };
$('speed').oninput = () => { speed = Math.pow(2, +$('speed').value); $('speedv').textContent = '×' + (speed < 1 ? speed.toFixed(2) : speed.toFixed(speed % 1 ? 1 : 0)); };
$('clear').onclick = () => { [...trains].forEach(removeTrain); msg(''); };
$('labels').onchange = () => svg.classList.toggle('nolabel', !$('labels').checked);
$('hold').onclick = () => { if (selected) { selected.hold = !selected.hold; updateSel(); } };
$('del').onclick = () => { if (selected) removeTrain(selected); };
$('rego').onclick = () => {
  if (!selected) return;
  $('selmsg').textContent = reroute(selected, $('redst').value) ? '' : 'その行先への経路がありません';
};
$('demo').onclick = () => {
  [['泉岳寺', 'kaitoku', '三崎口'], ['品川', 'local', '浦賀'], ['羽田空港第1・第2ターミナル', 'kyuko', '逗子・葉山'], ['三崎口', 'tokkyu', '品川'],
   ['京急川崎', 'local', '小島新田'], ['浦賀', 'local', '品川'], ['京急久里浜', 'kaitoku', '押上'], ['横浜', 'apkaitoku', '羽田空港第1・第2ターミナル'], ['逗子・葉山', 'kyuko', '羽田空港第1・第2ターミナル'], ['小島新田', 'local', '京急川崎']]
    .forEach(([o, k, d]) => spawn(o, k, d, 'stay', true));
  msg('デモ列車を投入しました');
};

// ===== 図のクリックで投入位置を指定 =====
function svgPoint(ev) {
  const m = svg.getScreenCTM().inverse();
  return { x: ev.clientX * m.a + ev.clientY * m.c + m.e, y: ev.clientX * m.b + ev.clientY * m.d + m.f };
}
function nearestTrack(p) {
  let best = null, bd = 9;
  E.forEach((e, i) => {
    if (e.portal) return;
    const A = N[e.a];
    let t = ((p.x - A.x) * e.vx + (p.y - A.y) * e.vy) / e.len; t = Math.max(0, Math.min(1, t));
    const q = pointOn(i, t), d = Math.hypot(p.x - q.x, p.y - q.y);
    if (d < bd) { bd = d; best = { e: i, t, x: q.x, y: q.y }; }
  });
  if (best && !isNaN(stopX[best.e]) && Math.abs(best.x - stopX[best.e]) < 8) {   // ホーム付近は停止位置に吸着
    best.t = paramOf(best.e, stopX[best.e]); best.x = stopX[best.e];
  }
  return best;
}
svg.addEventListener('mousemove', ev => {
  const n = nearestTrack(svgPoint(ev));
  cursor.setAttribute('visibility', n ? 'visible' : 'hidden');
  if (n) { cursor.setAttribute('cx', n.x); cursor.setAttribute('cy', n.y); }
});
svg.addEventListener('mouseleave', () => cursor.setAttribute('visibility', 'hidden'));
svg.addEventListener('click', ev => {
  const n = nearestTrack(svgPoint(ev));
  if (!n) { select(null); ttSelect(null); return; }
  origin = { e: n.e, t: n.t };
  originMark.setAttribute('transform', `translate(${n.x} ${n.y})`); originMark.setAttribute('visibility', 'visible');
  $('org').value = '';
  const si = edgeStation[n.e];
  msg(`投入位置を指定しました${si >= 0 ? '(' + ST[si].name + ')' : ''}。種別と行先を選んで「投入」`);
});
renderList();
/*TTJS*/
if (location.hash.startsWith('#demo')) {
  $('demo').click();
  spawn('押上', 'kaitoku', '三崎口', 'stay', true); spawn('押上', 'local', '西馬込', 'stay', true);
  for (let i = 0, n = 20 * (+location.hash.slice(5) || 0); i < n; i++) step(0.05);
}
requestAnimationFrame(frame);
