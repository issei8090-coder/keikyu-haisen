# 運転指令: 配線の長さ・駅のキロ程・ホームの長さを画面で直せるようにする(2026-11-04)
import io
def sub(p, pairs):
    s = io.open(p, encoding='utf-8').read()
    for a, b in pairs:
        assert s.count(a) == 1, (p, a[:80])
        s = s.replace(a, b)
    io.open(p, 'w', encoding='utf-8', newline='').write(s)

# ---------- disp.js ----------
sub('src/disp.js', [
("""const D_LAY = Object.assign({ turnout: 45, siding: 236, fmin: 2, endMax: 12 }, DC.layout || {});""",
"""const D_LAY = Object.assign({ turnout: 45, siding: 236, fmin: 2, endMax: 12 }, DC.layout || {});
// 画面で直した配線(運転指令の「配線を編集」): st = { 駅名: { km, len(m) } }、len = { 線の鍵: 長さ(m) }。線の鍵は両端の点の図の座標(作り直しても変わらないように)
const D_LAYKEY = 'kq-disp-layout';
let D_LAYEDIT = { saved: 0, st: {}, len: {} };
try { const j = JSON.parse(localStorage.getItem(D_LAYKEY) || 'null'); if (j && j.saved) D_LAYEDIT = Object.assign({ st: {}, len: {} }, j); } catch (e) { }
const dEdgeKey = e => { const a = N[E[e].a], b = N[E[e].b]; return [a.x.toFixed(1) + ',' + a.y.toFixed(1), b.x.toFixed(1) + ',' + b.y.toFixed(1)].sort().join('~'); };
const dStDef = new Map();   // 駅の元の値(cfg)"""),
# 手で指定した長さ
("""  // 目印(駅のホームの端・段の切れ目)の間を埋める""",
"""  // 画面で長さを指定した線: その長さちょうど(斜め線・引上線の決まりより優先)
  const reqX = new Float64Array(nI);
  for (const e of rowE) { const m = D_LAYEDIT.len[dEdgeKey(e)]; if (!(m > 0)) continue; const dx = dxOf(e); if (dx < 0.3) continue; cover(N[E[e].a].x, N[E[e].b].x, m / 1000 / dx, reqX); }
  // 目印(駅のホームの端・段の切れ目)の間を埋める"""),
("""const fill = [], dv = (k, f) => reqD[k] > 0 ? Math.max(reqD[k], req[k]) : Math.max(req[k], f);""",
"""const fill = [], dv = (k, f) => reqX[k] > 0 ? reqX[k] : reqD[k] > 0 ? Math.max(reqD[k], req[k]) : Math.max(req[k], f);"""),
# dInit: やり直せるように
("""function dInit() {
  // 1) 区間ごとに""",
"""function dInit() {
  dSecOf.fill(-1); dKm.fill(NaN); dBy.fill(NaN); DSEC.length = 0; dSucc.clear(); dSuccP.clear(); sigByDe.clear(); SIGS.length = 0;   // 配線を直したときにやり直せるように
  // 1) 区間ごとに"""),
("""    for (const [nm, km, c] of sc.stations) {
      const s = stByName.get(nm); if (!s || !s.stops.length) continue;
      const len = c <= 30 ? c * DTR.carLen : c;   // 両数(18m × 両数)か m""",
"""    for (const [nm, km0, c] of sc.stations) {
      const s = stByName.get(nm); if (!s || !s.stops.length) continue;
      const len0 = c <= 30 ? c * DTR.carLen : c;   // 両数(18m × 両数)か m
      dStDef.set(nm, { km: km0, len: len0 });
      const o = D_LAYEDIT.st[nm], km = o && isFinite(o.km) ? o.km : km0, len = o && o.len > 0 ? o.len : len0;   // 画面で直した値"""),
("""dInit(); dSigCheck();
// シーサスクロッシング: 区間のエッジのうち、ノードを共有せずに図の上で交わる組(立体交差の印 over は除く)。交差点を仮のノード(N.length + 番号)にする
const D_XBY = new Map();
{ const se = [];""",
"""dInit(); dSigCheck();
// シーサスクロッシング: 区間のエッジのうち、ノードを共有せずに図の上で交わる組(立体交差の印 over は除く)。交差点を仮のノード(N.length + 番号)にする
const D_XBY = new Map();
function dBuildXby() { D_XBY.clear(); const se = [];"""),
("""    const n = N.length + id++; for (const [e, f] of [[se[i], u], [se[j], v]]) { if (!D_XBY.has(e)) D_XBY.set(e, []); D_XBY.get(e).push({ n, u: f * dEm[e] }); } } }""",
"""    const n = N.length + id++; for (const [e, f] of [[se[i], u], [se[j], v]]) { if (!D_XBY.has(e)) D_XBY.set(e, []); D_XBY.get(e).push({ n, u: f * dEm[e] }); } } }
dBuildXby();
// 画面で配線(長さ・キロ程)を直したとき: 図と長さを作り直す。走っている列車は図の上の同じ位置から続ける(運転の秒の割り振り dRetime は次に開いたときに直る)
function dRelayout(list) {
  const keep = []; for (const t of list || []) if (t.ph && t.dp) keep.push([t, t.ph, t.dp.m2s(t.ph.m)]);
  dInit(); dBuildXby(); dSigCheck();
  for (const t of list || []) { t.ph = null; t.dLocks = null; t.dStill = false; t.dp = null; t._occL = null; }
  D_LOCK.clear(); D_LOCKN.clear(); if (list && list.length) dSpawnQ(list);
  for (const [t, o, s] of keep) { const dp = dPrep(t); o.m = dp.s2m(s); const rg = dp.ranges.find(r => o.m >= r.m0 - 0.01 && (o.m < r.m1 || (r.i1 === t.route.segs.length && o.m <= r.m1 + 1))); if (rg) dStart(t, D_NOW, rg, o); }
}"""),
])

# ---------- dispui.js ----------
sub('src/dispui.js', [
# 駅名をクリックで選ぶ
("""    el('text', { x: (x0 + x1) / 2, y: 18, class: 'bk-st' }, gB.static, nm);""",
"""    { const tx = el('text', { x: (x0 + x1) / 2, y: 18, class: 'bk-st' + (dLay ? ' lay' : '') + (dLaySel && dLaySel.st === nm ? ' laysel' : '') }, gB.static, nm); if (dLay) tx.addEventListener('click', ev => { ev.stopPropagation(); dLaySel = { st: nm, si: P.si }; dBuildBoard(); }); }"""),
# 選んだ線を光らせる
("""  el('path', { d, class: 'bk-track' }, gB.static);
  // はめ込んだ部分で""",
"""  el('path', { d, class: 'bk-track' }, gB.static);
  if (dLay && dLaySel && dLaySel.e != null) { const e = dLaySel.e, a = E[e].a, b = E[e].b, si = dSecOf[e]; if (dPart(tb, si)) el('path', { d: `M${tb.X(dKm[a], si).toFixed(1)} ${tb.Y(dBy[a], si).toFixed(1)}L${tb.X(dKm[b], si).toFixed(1)} ${tb.Y(dBy[b], si).toFixed(1)}`, class: 'bk-laysel' }, gB.static); }
  if (dLay) for (const P of tb.parts) for (const e of DSEC[P.si].edges) { if (E[e].portal || !(D_LAYEDIT.len[dEdgeKey(e)] > 0)) continue; const a = E[e].a, b = E[e].b; el('path', { d: `M${tb.X(dKm[a], P.si).toFixed(1)} ${tb.Y(dBy[a], P.si).toFixed(1)}L${tb.X(dKm[b], P.si).toFixed(1)} ${tb.Y(dBy[b], P.si).toFixed(1)}`, class: 'bk-layset' }, gB.static); }
  // はめ込んだ部分で"""),
("let dTab = 0, dSel = null, dSelSig = null, dView = 'map', dDrawT = 0;", """let dTab = 0, dSel = null, dSelSig = null, dView = 'map', dDrawT = 0;
let dLay = false, dLaySel = null;   // 配線の編集中・選んだ線か駅"""),
("  board.classList.toggle('editing', dEdit);", "  board.classList.toggle('editing', dEdit); board.classList.toggle('laying', dLay);"),
# パネル
("""function dPanel() {
  const box = $('dispbox'); if (!box) return;""",
"""function dPanel() {
  const box = $('dispbox'); if (!box) return;
  if (dLay) { dLayPanel(box); return; }"""),
# クリック
("""board.addEventListener('click', ev => {
  if (dDragJust) return;""",
"""board.addEventListener('click', ev => {
  if (dDragJust) return;
  if (dLay) { const e = dPickE(ev); dLaySel = e != null ? { e } : null; dBuildBoard(); return; }"""),
# バーのボタン
("""  let h = `<button id="sgedit" class="${dEdit ? 'on' : ''}">${dEdit ? '編集を終わる' : '信号機を編集'}</button>`;""",
"""  let h = `<button id="sgedit" class="${dEdit ? 'on' : ''}">${dEdit ? '編集を終わる' : '信号機を編集'}</button><button id="layedit" class="${dLay ? 'on' : ''}">${dLay ? '配線の編集を終わる' : '配線を編集'}</button>`;
  if (dLay) { const nL = Object.keys(D_LAYEDIT.len).length, nS = Object.keys(D_LAYEDIT.st).length;
    h += `<span class="sg-st">線路を押すと長さ、駅名を押すとキロ程・ホームの長さを直せます。直した線は黄色。いま 線${nL}本・駅${nS}駅</span><span class="sg-grp"><button id="layexp">書き出す</button><button id="layimp">読み込む</button><button id="layclr" class="danger">全部元に戻す</button></span>`; }"""),
("""  $('sgedit').onclick = () => { dEdit = !dEdit; dSigMsg(''); dBuildBoard(); };
  if (!dEdit) return;""",
"""  $('sgedit').onclick = () => { dEdit = !dEdit; if (dEdit) { dLay = false; dLaySel = null; } dSigMsg(''); dBuildBoard(); };
  $('layedit').onclick = () => { dLay = !dLay; dLaySel = null; if (dLay) dEdit = false; dSigMsg(''); dBuildBoard(); };
  if (dLay) {
    $('layexp').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(D_LAYEDIT, null, 1)], { type: 'application/json' })); a.download = 'disp_layout.json'; a.click(); dSigMsg('disp_layout.json を書き出しました'); };
    $('layimp').onclick = () => { const f = document.createElement('input'); f.type = 'file'; f.accept = '.json,application/json';
      f.onchange = () => { const r = new FileReader(); r.onload = () => { try { const j = JSON.parse(r.result); if (!j.st && !j.len) throw 0; D_LAYEDIT = Object.assign({ st: {}, len: {} }, j); dLayApply('読み込みました'); } catch (e) { dSigMsg('読み込めませんでした(disp_layout.json の形ではありません)'); } }; r.readAsText(f.files[0]); };
      f.click(); };
    $('layclr').onclick = () => { if (!confirm('画面で直した配線の長さ・駅のキロ程を全部元に戻しますか?')) return; D_LAYEDIT = { saved: 0, st: {}, len: {} }; dLayApply('全部元に戻しました'); };
  }
  if (!dEdit) return;"""),
])

# 配線の編集の本体(dispui.js の末尾に足す)
LAY = r"""
// ===== 配線の編集(長さ・駅のキロ程・ホームの長さ) =====
function dPickE(ev) {   // 押した所にいちばん近い線(向きは問わない)
  const tb = dTabs[dTab], pt = board.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
  const q = pt.matrixTransform(board.getScreenCTM().inverse()); let best = null, bd = 12;
  for (const P of tb.parts) for (const e of DSEC[P.si].edges) {
    if (E[e].portal) continue; const a = E[e].a, b = E[e].b; if (Math.max(dKm[a], dKm[b]) < P.km0 - 0.05 || Math.min(dKm[a], dKm[b]) > P.km1 + 0.05) continue;
    const ax = tb.X(dKm[a], P.si), ay = tb.Y(dBy[a], P.si), dx = tb.X(dKm[b], P.si) - ax, dy = tb.Y(dBy[b], P.si) - ay, L2 = dx * dx + dy * dy; if (L2 < 1e-6) continue;
    const f = Math.max(0, Math.min(1, ((q.x - ax) * dx + (q.y - ay) * dy) / L2)), dd = Math.hypot(ax + dx * f - q.x, ay + dy * f - q.y);
    if (dd < bd) { bd = dd; best = e; }
  }
  return best;
}
function dLaySave() { D_LAYEDIT.saved = Date.now(); try { localStorage.setItem(D_LAYKEY, JSON.stringify(D_LAYEDIT)); } catch (e) { } if (typeof cloudPush === 'function') cloudPush('layout', D_LAYEDIT); }
function dLayApply(msg) {
  dLaySave(); dRelayout(typeof ttList !== 'undefined' ? ttList : []); dTabs.forEach(dTabGeom);
  if (typeof ttActive !== 'undefined') dSigShow(ttActive || []);
  dSigMsg(msg || ''); dBuildBoard();
}
// 線の種類(説明用)
function dEdgeKind(e) {
  const a = E[e].a, b = E[e].b, dy = Math.abs(N[b].y - N[a].y), dead = adj[a].length === 1 || adj[b].length === 1, plat = !isNaN(stopX[e]);
  return plat ? 'ホームの線' : dy >= 0.5 ? 'ポイント・渡り線(斜めの線)' : dead ? '行き止まりの線(引上線・留置線・車庫)' : '線路';
}
function dLayPanel(box) {
  let h = '<div class="dp-title">配線を編集</div>', key = 'none';
  const S = dLaySel;
  if (S && S.e != null) {
    const e = S.e, k = dEdgeKey(e), set = D_LAYEDIT.len[k], a = E[e].a, b = E[e].b, sec = DSEC[dSecOf[e]];
    const near = [...sec.stInfo].map(([nm, i]) => [nm, Math.abs(i.km - (dKm[a] + dKm[b]) / 2)]).sort((p, q) => p[1] - q[1])[0];
    key = 'e' + e + '|' + dEm[e].toFixed(1) + '|' + set;
    h += `<div class="dp-sub">${sec.name}・${dEdgeKind(e)}・${near ? near[0] + ' 付近' : ''}</div>` +
      `<table class="dp-tab"><tr><th>いまの長さ</th><td><b>${Math.round(dEm[e])}</b> m</td></tr><tr><th>キロ程</th><td>${Math.min(dKm[a], dKm[b]).toFixed(3)}〜${Math.max(dKm[a], dKm[b]).toFixed(3)} km</td></tr>` +
      `<tr><th>指定</th><td>${set ? set + ' m(手で指定)' : 'なし(自動: 斜めの線は線の間隔1つで' + D_LAY.turnout + 'm、行き止まりは列車が入る長さ、ほかは駅間の残り)'}</td></tr></table>` +
      (Math.abs(N[b].x - N[a].x) < 0.3 ? '<p class="dp-sub" style="color:#ff8a7a">この線は元の図で真縦なので、長さを指定できません</p>' :
      `<div class="se-row"><span>長さ</span><input id="laylen" type="number" min="1" step="1" value="${Math.round(set || dEm[e])}"> m <button id="layok">決める</button>${set ? '<button id="laydel">指定をやめる</button>' : ''}</div>` +
      `<div class="se-row"><span>足す</span>${[-50, -10, 10, 50].map(d => `<button data-ld="${d}">${d > 0 ? '+' : ''}${d}m</button>`).join('')}</div>` +
      (set && Math.abs(set - dEm[e]) > 2 ? `<p class="dp-sub" style="color:#ffcc66">指定 ${set}m が駅と駅のキロ程の間に収まらないので、${Math.round(dEm[e])}m に縮めています(駅のキロ程か、ほかの線の長さを見直してください)</p>` : '') +
      '<p class="dp-sub">長さを変えると、駅のキロ程はそのままで、同じ駅間のほかのふつうの線が伸び縮みします。運転の計算(距離)もこの長さになります。</p>');
  } else if (S && S.st) {
    const nm = S.st, info = DSEC[S.si].stInfo.get(nm), df = dStDef.get(nm) || {}, o = D_LAYEDIT.st[nm];
    key = 'st' + nm + '|' + JSON.stringify(o || {}) + info.km + info.len;
    h += `<div class="dp-sub">${DSEC[S.si].name}・${nm}</div>` +
      `<div class="se-row"><span>キロ程</span><input id="laykm" type="number" step="0.01" value="${(DSEC[S.si].sc.kmNeg ? -info.km : info.km).toFixed(3)}"> km <span class="dp-sub">(元 ${(DSEC[S.si].sc.kmNeg ? -df.km : df.km).toFixed(3)})</span></div>` +
      `<div class="se-row"><span>ホーム</span><input id="laypl" type="number" min="18" step="1" value="${Math.round(info.len)}"> m <span class="dp-sub">(${(info.len / DTR.carLen).toFixed(1)}両ぶん・元 ${df.len}m)</span></div>` +
      `<div class="se-row"><span>両数で</span>${[4, 6, 8, 10, 12].map(n => `<button data-lc="${n}">${n}両</button>`).join('')}</div>` +
      `<div class="btns"><button id="layst">決める</button>${o ? '<button id="laystdel">元に戻す</button>' : ''}</div>` +
      '<p class="dp-sub">キロ程は駅の中心(列車が止まる点)。ホームの長さを変えると、出発信号機の推定の位置と止まる位置も変わります。</p>';
  } else h += '<p class="dp-sub">図の線路を押すとその線の長さ、上の駅名を押すと駅のキロ程とホームの長さを直せます。直した線は黄色で示します。</p>';
  const L = Object.entries(D_LAYEDIT.len), T = Object.entries(D_LAYEDIT.st);
  h += `<h2 style="margin-top:12px">直したところ</h2>` + (L.length + T.length ? '<ul class="dp-ev">' + T.map(([nm, o]) => `<li><a href="#" data-lsn="${nm}">${nm}</a> ${o.km != null ? 'キロ程 ' + o.km : ''} ${o.len ? 'ホーム ' + o.len + 'm' : ''}</li>`).join('') +
    L.map(([k, m]) => { let e = -1; for (let i = 0; i < E.length; i++) if (dSecOf[i] >= 0 && !E[i].portal && dEdgeKey(i) === k) { e = i; break; } return `<li>${e >= 0 ? `<a href="#" data-lse="${e}">線 ${dKm[E[e].a].toFixed(2)}km 付近</a>` : '(線が見つかりません) ' + k} ${m}m</li>`; }).join('') + '</ul>' : '<p class="dp-sub">まだありません</p>');
  key += '|' + L.length + '|' + T.length;
  if (box._h === key) return; box._h = key; box.innerHTML = h;
  const iv = id => { const x = $(id); return x ? +x.value : NaN; };
  const setLen = m => { const k = dEdgeKey(S.e); if (!(m > 0)) return; D_LAYEDIT.len[k] = Math.round(m); dLayApply(`線の長さを ${Math.round(m)}m にしました`); };
  const bo = $('layok'); if (bo) bo.onclick = () => setLen(iv('laylen'));
  const il = $('laylen'); if (il) il.onkeydown = ev => { if (ev.key === 'Enter') setLen(iv('laylen')); };
  box.querySelectorAll('[data-ld]').forEach(b => b.onclick = () => setLen((D_LAYEDIT.len[dEdgeKey(S.e)] || dEm[S.e]) + +b.dataset.ld));
  const bd = $('laydel'); if (bd) bd.onclick = () => { delete D_LAYEDIT.len[dEdgeKey(S.e)]; dLayApply('長さの指定をやめました(自動に戻しました)'); };
  box.querySelectorAll('[data-lc]').forEach(b => b.onclick = () => { const x = $('laypl'); if (x) x.value = +b.dataset.lc * DTR.carLen; });
  const bs = $('layst'); if (bs) bs.onclick = () => { const nm = S.st, neg = DSEC[S.si].sc.kmNeg, k = iv('laykm'), pl = iv('laypl'), df = dStDef.get(nm) || {};
    if (!isFinite(k) || !(pl > 0)) { dSigMsg('キロ程とホームの長さを数字で入れてください'); return; }
    const o = {}; const km = neg ? -k : k; if (Math.abs(km - df.km) > 1e-6) o.km = Math.round(km * 10000) / 10000; if (Math.abs(pl - df.len) > 0.5) o.len = Math.round(pl);
    if (Object.keys(o).length) D_LAYEDIT.st[nm] = o; else delete D_LAYEDIT.st[nm]; dLayApply(nm + ' を直しました'); };
  const bsd = $('laystdel'); if (bsd) bsd.onclick = () => { delete D_LAYEDIT.st[S.st]; dLayApply(S.st + ' を元に戻しました'); };
  box.querySelectorAll('[data-lse]').forEach(a => a.onclick = ev => { ev.preventDefault(); const e = +a.dataset.lse, i = dTabs.findIndex(tb => tb.parts.some(P => P.si === dSecOf[e] && dKm[E[e].a] >= P.km0 - 0.05 && dKm[E[e].a] <= P.km1 + 0.05)); if (i >= 0) dTab = i; dLaySel = { e }; dBuildBoard(); });
  box.querySelectorAll('[data-lsn]').forEach(a => a.onclick = ev => { ev.preventDefault(); const nm = a.dataset.lsn, si = DSEC.findIndex(s => s.stInfo.has(nm)); if (si < 0) return; const i = dTabs.findIndex(tb => tb.parts.some(P => P.si === si)); if (i >= 0) dTab = i; dLaySel = { st: nm, si }; dBuildBoard(); });
}
"""
s = io.open('src/dispui.js', encoding='utf-8').read()
s = s.rstrip('\n') + '\n' + LAY
io.open('src/dispui.js', 'w', encoding='utf-8', newline='').write(s)

# ---------- template.html(色) ----------
sub('src/template.html', [
("""  .bk-ends {""", """  .bk-laysel { fill:none; stroke:#4ea3ff; stroke-width:7; stroke-linecap:round; opacity:.75; pointer-events:none; }
  .bk-layset { fill:none; stroke:#ffd23f; stroke-width:3.2; stroke-linecap:round; pointer-events:none; }
  .bk-st.lay { cursor:pointer; text-decoration:underline dotted; }
  .bk-st.laysel { fill:#4ea3ff; }
  svg#board.laying { cursor:pointer; }
  .bk-ends {"""),
])

# ---------- cloud.js ----------
sub('src/cloud.js', [
("""  const got = await Promise.race([Promise.all([cloudGet('ops_user.json'), cloudGet('disp_signals.json')]), to]);
  if (got === 'to') { cloudMsg('保存先を読めませんでした(このブラウザの編集で動いています)', true); return; }
  const [ops, sig] = got;""",
"""  const got = await Promise.race([Promise.all([cloudGet('ops_user.json'), cloudGet('disp_signals.json'), cloudGet('disp_layout.json')]), to]);
  if (got === 'to') { cloudMsg('保存先を読めませんでした(このブラウザの編集で動いています)', true); return; }
  const [ops, sig, lay] = got;
  if (lay && (lay.saved || 0) > ((D_LAYEDIT && D_LAYEDIT.saved) || 0)) { D_LAYEDIT = Object.assign({ st: {}, len: {} }, lay); try { localStorage.setItem(D_LAYKEY, JSON.stringify(D_LAYEDIT)); } catch (e) { } try { dRelayout([]); dTabs.forEach(dTabGeom); if (dView === 'disp') dBuildBoard(); } catch (e) { } }"""),
("""${kind === 'ops' ? '運用の編集' : '信号機の編集'}""", """${kind === 'ops' ? '運用の編集' : kind === 'layout' ? '配線の編集' : '信号機の編集'}"""),
])

# ---------- server ----------
sub('../server/server.js', [
("""const FILES = { ops: 'data/ops_user.json', signals: 'data/disp_signals.json' };
const LABEL = { ops: '運用の編集', signals: '信号機の編集' };""",
"""const FILES = { ops: 'data/ops_user.json', signals: 'data/disp_signals.json', layout: 'data/disp_layout.json' };
const LABEL = { ops: '運用の編集', signals: '信号機の編集', layout: '配線の編集' };"""),
])
print('ok')
