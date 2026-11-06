// ===== 指令から無線で指示する(行っとけダイヤ): 行先・種別の変更、打ち切り・回送、臨時折り返し、臨時停車、速度の制限、抑止 =====
// 指示は段の並び(src/dcmd.js の dOrder)。出す前に確かめ(dPreCheck)、できないなら運転士が理由を返す
const G_TYPES = [['', 'そのまま'], ['local', '普通'], ['kyuko', '急行'], ['tokkyu', '特急'], ['kaitoku', '快特'], ['apkaitoku', 'エアポート快特'], ['kaiso', '回送']];
const G_STOPS = [['orig', '元の停車駅'], ['type', '種別の停車駅'], ['all', '各駅に停車']];
const G_TURN = [['', '自動'], ['go', 'そのまま進む'], ['turn', '折り返す']];
let G_ALLST = null;
const gAllStations = () => G_ALLST || (G_ALLST = (() => { const L = []; DSEC.forEach(sec => [...sec.stInfo].sort((a, b) => a[1].km - b[1].km).forEach(([n]) => { if (!L.includes(n) && stByName.get(n)) L.push(n); })); return L; })());
function gCmdOpen(t, opt = {}) {
  const box = $('radiocmd'); if (!box) return;
  if (!t || !t.ph) { G.cmd = null; box.hidden = false; box.innerHTML = '<p class="dp-sub">この列車は運転指令の区間の外にいるので、無線で指示できません。</p>'; return; }
  const p = gDriver(t); let th = G.th.find(x => x.p === p && x.cmdTh);
  if (!th) { th = gThread(p, `${t.no} への指示`, null); th.cmdTh = true; gSay(th, `${t.no} 運転士の${p.name.split(' ')[0]}です。どうぞ。`, null, 0); }
  const ah = dAheadStations(t, 80), nx = ah.find(x => x.stop) || ah[0];
  G.cmd = { t, th, rows: [{ to: nx ? nx.name : '', type: '', stops: 'orig', turn: '' }], after: 'park', cap: opt.cap || null, inc: opt.inc || null };
  gCmdRender(); gRender();
  const sec = $('radiosec'); if (sec && sec.scrollIntoView) sec.scrollIntoView({ block: 'nearest' });
}
function gCmdPreset(k) {
  const c = G.cmd, t = c.t, ah = dAheadStations(t, 80), stops = ah.filter(x => x.stop), nx = stops[0] || ah[0], last = ah[ah.length - 1], turn = ah.filter(x => dCanTurn(x.name));
  const R = (to, type, st, tn) => ({ to: to ? to.name || to : '', type: type || '', stops: st || 'orig', turn: tn || '' });
  const home = t.names && t.names[0] && stByName.get(t.names[0]) && gAllStations().includes(t.names[0]) ? t.names[0] : gAllStations()[0];
  if (k === 'cut') { c.rows = [R(nx)]; c.after = 'park'; }
  else if (k === 'dest') { c.rows = [R(turn[0] || nx)]; c.after = 'stay'; }
  else if (k === 'turn') { c.rows = [R(turn[0] || nx), R(home, 'local', 'all', 'turn')]; c.after = 'stay'; }
  else if (k === 'kawasaki') { const a = nx, b = turn.find(x => ah.indexOf(x) > ah.indexOf(a)) || turn[0] || a; c.rows = [R(a), R(b, 'kaiso', 'orig', 'go'), R(home, 'local', 'all', 'turn')]; c.after = 'stay'; }
  else if (k === 'local') { c.rows = [R(last, 'local', 'all')]; c.after = 'stay'; }
  else if (k === 'back') { const mid = stops[Math.min(3, stops.length - 1)] || nx; c.rows = [R(mid, 'local', 'all'), R(last, '', 'orig', 'go')]; c.after = 'stay'; }
  else if (k === 'extra') { const pass = ah.find(x => !x.stop) || nx; c.rows = [R(pass), R(last, '', 'orig', 'go')]; c.after = 'stay'; }
  else if (k === 'kaiso') { c.rows = [R(nx)]; c.after = 'park'; }
  gCmdRender();
}
function gCmdSteps(c) {
  const rows = c.rows.filter(r => r.to), dest = [...rows].reverse().find(r => r.type !== 'kaiso');
  return rows.map(r => ({ to: r.to, type: r.type || undefined, stops: r.type === 'kaiso' ? 'orig' : r.type && r.stops === 'orig' ? 'type' : r.stops, turn: r.turn === 'turn' ? true : r.turn === 'go' ? false : null, dest: dest ? dest.to : r.to }));
}
const gCapOf = t => t.dyn ? t.capK : t.gCap;
function gCmdRender() {
  const box = $('radiocmd'), c = G.cmd; if (!box) return;
  if (!c) { box.hidden = true; box.innerHTML = ''; return; }
  const t = c.t, ah = t.ph ? dAheadStations(t, 80) : [], all = gAllStations(), atTerminal = !!(t.stayAt && t.ph && t.ph.done), ty = TYPES[t.shown || t.type];
  const opt = (L, v) => L.map(([k, n]) => `<option value="${k}"${k === v ? ' selected' : ''}>${n}</option>`).join('');
  const stOpt = i => i === 0 && !atTerminal ? ah.map(x => [x.name, x.name + (x.stop ? '' : '(通過駅)') + (dCanTurn(x.name) ? ' ⇄' : '')]) : all.map(n => [n, n + (dCanTurn(n) ? ' ⇄' : '')]);
  const steps = gCmdSteps(c), pre = !t.ph ? '運転指令の区間の外です' : steps.length ? dPreCheck(t, steps) : '', cap = gCapOf(t);
  const row = (r, i) => `<div class="rrow"><span>${i + 1}</span><select data-cf="to" data-ri="${i}"><option value="">駅を選ぶ</option>${opt(stOpt(i), r.to)}</select><select data-cf="type" data-ri="${i}">${opt(G_TYPES, r.type)}</select>` +
    `<select data-cf="stops" data-ri="${i}"${r.type === 'kaiso' ? ' disabled' : ''}>${opt(G_STOPS, r.stops)}</select>${i ? `<select data-cf="turn" data-ri="${i}">${opt(G_TURN, r.turn)}</select>` : ''}${c.rows.length > 1 ? `<button data-cx="${i}" title="この段を消す">×</button>` : ''}</div>`;
  box.hidden = false;
  box.innerHTML = `<div class="rcmd"><div class="rcmd-hd"><b>${t.no}</b> <span style="color:${ty ? ty.color : ''}">${ty ? ty.name : ''}</span> ${shortDest(t.dest)}行き ${t.cars || ''}両<button data-cc="close" class="rcx" title="閉じる">×</button></div>` +
    `<div class="rpre">${[['cut', '次の駅で打ち切り→回送'], ['dest', '行先変更'], ['turn', '臨時折り返し'], ['kawasaki', '打ち切り→回送→折り返し'], ['local', '各停に変更'], ['back', '途中まで各停→元の種別'], ['extra', '臨時停車'], ['kaiso', '回送にする']].map(([k, n]) => `<button data-cp="${k}">${n}</button>`).join('')}</div>` +
    `<div class="rsub">${atTerminal ? `${t.stayAt}に到着しています。次の行路の行先を全駅から選べます。` : '段ごとに「どこまで・種別・停車駅・(2段目から)進むか折り返すか」。'} ⇄ = 折り返し・留置のできる駅</div>` +
    c.rows.map(row).join('') +
    `<div class="rrow2"><button data-cc="add">＋ 段を足す</button><span>そのあと</span><select data-cf="after">${opt([['park', '留置線・検車区へ回送'], ['stay', 'その駅で待機']], c.after)}</select></div>` +
    `<div class="rrow2"><span>速度</span>${[[15, '15'], [25, '25'], [45, '45'], [0, '解除']].map(([v, n]) => `<button data-cs="${v}" class="${(v ? cap === v : cap == null) ? 'on' : ''}">${n}</button>`).join('')}<span>km/h</span><button data-cc="hold" class="${t.ph && t.ph.hold ? 'on' : ''}">${t.ph && t.ph.hold ? '抑止を解除' : '抑止'}</button></div>` +
    `<div class="rtxt">${steps.length ? dOrderText(steps, c.after) : '駅を選んでください'}${c.cap ? `(${c.cap}km/h以下)` : ''}</div>` +
    `${pre ? `<div class="rerr">${pre}</div>` : ''}<button data-cc="go" class="rgo"${pre || !steps.length ? ' disabled' : ''}>この指示を出す</button></div>`;
}
function gCmdSend() {
  const c = G.cmd; if (!c) return; const t = c.t, th = c.th, p = th.p, steps = gCmdSteps(c), after = c.after, cap = c.cap, txt = dOrderText(steps, after);
  gMe(th, txt + (cap ? `(${cap}km/h以下で)` : '') + '。');
  const err = t.ph ? dPreCheck(t, steps) : '区間の外です';
  if (err) { gSay(th, `指令、それはできません。${err}`, null, gDelay(p, 15)); G.cmd = null; gCmdRender(); gRender(); return; }
  const d = gDelay(p, 20); gSay(th, `了解、${txt}。`, null, d);
  gLater(d + 5, () => {
    if (c.inc) { const o = c.inc; if (t.ph) { t.ph.incStop = null; t.ph.incDw = null; } o.ok = true; o.dur = Math.max(0, D_NOW - o.T0); }
    const r = dOrder(t, steps, D_NOW, { after, cap }); if (!r.ok) { gSay(th, `できませんでした。${r.msg}`, null, 5); return; }
    r.job.why = '指令'; gScore('判断', 1, `${t.no}: ${txt}`);
    r.job.onFail = (x, e) => gSay(th, `${e}。次の指示をください。`, null, 5);
    r.job.onDone = x => gSay(th, `${x.stayAt}に着きました。次の指示を待ちます。`, null, 5);
    r.job.onPark = x => gSay(th, `${x.parked}に入りました。`, null, 5);
    if (c.inc) { const o = c.inc; r.job.onPark = x => { gSay(th, `${x.parked}に入りました。`, null, 5); gAfterCut(o); }; }
    dCmdLog(D_NOW, t, `${t.no}: ${txt}`); });
  G.cmd = null; gCmdRender(); gRender();
}
{ const sec = $('radiosec');
  sec.addEventListener('click', e => { const c = G.cmd; if (!c) return; const b = e.target.closest('[data-cp],[data-cx],[data-cc],[data-cs]'); if (!b) return;
    if (b.dataset.cp) gCmdPreset(b.dataset.cp);
    else if (b.dataset.cx != null) { c.rows.splice(+b.dataset.cx, 1); if (!c.rows.length) c.rows.push({ to: '', type: '', stops: 'orig', turn: '' }); gCmdRender(); }
    else if (b.dataset.cs != null) { const v = +b.dataset.cs || null, t = c.t; if (t.dyn) t.capK = v; else t.gCap = v; gMe(c.th, v ? `${v}km/h以下で運転してください。` : '速度の制限を解除します。'); gSay(c.th, v ? `了解、${v}km/h以下で運転します。` : '了解、制限解除。', null, gDelay(c.th.p, 10)); gCmdRender(); gRender(); }
    else if (b.dataset.cc === 'add') { const L = c.rows[c.rows.length - 1]; c.rows.push({ to: '', type: L && L.type ? L.type : '', stops: L && L.type ? L.stops : 'orig', turn: '' }); gCmdRender(); }
    else if (b.dataset.cc === 'hold') { const t = c.t; if (t.ph) { t.ph.hold = !t.ph.hold; gMe(c.th, t.ph.hold ? 'その場で抑止します。' : '抑止を解除します。発車してください。'); gSay(c.th, '了解。', null, gDelay(c.th.p, 8)); } gCmdRender(); gRender(); }
    else if (b.dataset.cc === 'close') { G.cmd = null; gCmdRender(); }
    else if (b.dataset.cc === 'go') gCmdSend(); });
  sec.addEventListener('change', e => { const c = G.cmd, x = e.target.closest('[data-cf]'); if (!c || !x) return; const f = x.dataset.cf;
    if (f === 'after') c.after = x.value; else { const r = c.rows[+x.dataset.ri]; if (!r) return; r[f] = x.value; if (f === 'type' && x.value) r.stops = x.value === 'local' ? 'all' : 'type'; }
    gCmdRender(); });
}
{ const f = gReset; gReset = function () { G.cmd = null; gCmdRender(); if (typeof dynReset === 'function') dynReset(); return f.apply(this, arguments); }; }
