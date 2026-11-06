// ===== 計画表: 固定の計画(番線・時刻・待避・前後の運用・編成)を見て、その場で直す =====
// 直したものは「運用の編集」(USER_OPS)に入り、「反映」で1回だけ計算し直す(結果はこのブラウザに保存 → 次からは計算しない)
// 書き出すファイル(kq_plan_日.json)= 運用の編集 + 人が読める一覧 + 計算した計画そのもの。読み込むと同じ計画で走る(手で一覧を直したら、その分を運用の編集にして計算し直す)
const PLAN_FMT = '京急配線図 運行計画';
let planNote = '', planSt = '', planW = 7200, planQ = '', planT0 = null, planMode = 'st';
const planHMS = x => x == null || isNaN(x) ? '' : ttSHMS(x);
const planTy = t => (TYPES[t.shown || t.type] || { name: t.type || '' }).name;
const planStops = t => t.names.map((nm, i) => ({ nm, i, k: i + (t.k0 || 0), ev: t.ev[i] || {} }));
const planPlat = (t, i) => t.route && t.route.stopE ? t.route.stopE[i] : null;
function planTrackOpts(t, i) {
  const st = t.names[i], set = opsSetOf(t), pin = set.plat ? set.plat[st] : null, cur = planPlat(t, i), tr = opsTracksFor(t, i);
  const o = [`<option value="">${pin == null ? '計画: ' : '自動: '}${opsEsc(opsTrackLabel(st, cur) || '—')}</option>`];
  for (const x of tr) o.push(`<option value="${x.e}"${pin != null && +pin === x.e ? ' selected' : ''}>${opsEsc(x.label)}${x.e === cur ? ' ●' : ''}</option>`);
  return o.join('');
}
function planWaitTxt(t, i) {
  const e = t.ev[i] || {}; const r = [];
  if (e.wait) r.push('通過待ち(推定)');
  if (e.ot) r.push('待避' + (e.otBy && e.otBy.length ? '(' + e.otBy.map(o => o && o.no).filter(Boolean).join('・') + ' に抜かれる)' : ''));
  return r.join(' ');
}
const planLinkTxt = x => x ? `<button class="plk" data-go="${opsEsc(ttUKey(x))}">${opsEsc(x.no)}</button>` : '<span class="hint">—</span>';
const planHs = t => t.hs ? opsEsc(t.hs.f) + (t.hs2 ? '+' + opsEsc(t.hs2.f) : '') : '';
function planRender() {
  const p = $('dockplan'); if (!p || p.hidden) return;
  if (!ttDay || !ttList.length) { p.innerHTML = '<p class="hint">時刻表を読み込むと出ます</p>'; return; }
  if (!planSt) planSt = STN_NAMES.includes('京急川崎') ? '京急川崎' : STN_NAMES[0];
  if (planT0 == null) planT0 = Math.max(0, Math.floor((ttClock - 600) / 600) * 600);
  const nEd = opsEditCount();
  const src = ttPlanNow ? `いまの計画: ${ttPlanNow.src}` : 'いまの計画: 計算(保存なし)';
  const H = [`<div class="planbar"><div class="dtabs"><button data-pm="st" class="${planMode === 'st' ? 'on' : ''}">駅で見る</button><button data-pm="tr" class="${planMode === 'tr' ? 'on' : ''}">列車で見る</button></div>`];
  if (planMode === 'st') H.push(`<select id="planst" aria-label="駅">${STN_NAMES.map(s => `<option${s === planSt ? ' selected' : ''}>${opsEsc(s)}</option>`).join('')}</select>
    <button data-pt="-1" aria-label="前の時間">◀</button><input id="plant0" type="time" step="60" value="${planHMS(planT0).slice(0, 5)}" aria-label="から"><select id="planw" aria-label="幅">${[[1800, '30分'], [3600, '1時間'], [7200, '2時間'], [14400, '4時間'], [86400, '終日']].map(([v, l]) => `<option value="${v}"${v === planW ? ' selected' : ''}>${l}</option>`).join('')}</select><button data-pt="1" aria-label="後の時間">▶</button><button data-pt="now">今の時刻</button>`);
  H.push(`<input id="planq" type="search" placeholder="列車番号" value="${opsEsc(planQ)}" aria-label="列車番号で探す"><span class="dsp"></span><span class="hint">${src}・編集 ${nEd} 件${opsDirty ? ' <b class="opswarn">反映前(上の「反映」で計算し直す)</b>' : ''}</span></div>`);
  if (planNote) H.push(`<p class="planmsg opsnote">${opsEsc(planNote)}</p>`);
  if (planMode === 'st') H.push(planStTable()); else H.push(planTrTable());
  H.push('<p class="hint plhint">番線の欄を変えると、その列車のその駅の番線を指定します(● = いまの計画で使っている線)。「反映」で計算し直し、結果はこのブラウザに保存するので、次からは開くときに計算しません。上の「書き出す」は運用の編集・人が読める一覧・計算した計画を1つの JSON にし、「読み込む」とその計画で走ります(一覧の「番線」「次」を手で書き換えたら、その分を運用の編集にして計算し直します)。</p>');
  p.innerHTML = H.join('');
}
function opsEditCount() { const U = USER_OPS && USER_OPS[ttDay]; if (!U) return 0; return (U.link || []).length + (U.cut || []).length + (U.dh || []).length + (U.del || []).length + Object.keys(U.train || {}).length; }
function planStTable() {
  const st = planSt, t0 = planT0, t1 = planW >= 86400 ? Infinity : planT0 + planW, q = planQ.trim();
  const rows = [];
  for (const t of ttList) { if (!opsReal(t)) continue; if (q && !String(t.no).includes(q)) continue;
    t.names.forEach((nm, i) => { if (nm !== st) return; const k = i + (t.k0 || 0), a = t.A[k], d = t.P[k], tm = isNaN(a) ? d : a; if (!(tm >= t0 && tm < t1)) return; rows.push({ t, i, a, d, tm }); }); }
  rows.sort((x, y) => x.tm - y.tm);
  if (!rows.length) return '<p class="hint">この時間に止まる・通る列車はありません</p>';
  const R = rows.slice(0, 400).map(({ t, i, a, d }) => { const e = t.ev[i] || {}, n = t.names.length, set = opsSetOf(t), pin = set.plat && set.plat[st] != null;
    return `<tr class="${t === ttSel ? 'sel' : ''}"><td><button class="plk" data-go="${opsEsc(ttUKey(t))}">${opsEsc(t.no)}</button></td><td>${opsEsc(planTy(t))}</td><td>${opsEsc(t.names[0])}→${opsEsc(t.names[n - 1])}</td><td>${i === 0 ? '<span class="hint">始発</span>' : planHMS(a)}</td><td>${i === n - 1 ? '<span class="hint">終着</span>' : e.thru ? '<span class="hint">通過</span>' : planHMS(d)}</td><td><select data-pp="${opsEsc(ttUKey(t))}" data-pi="${i}" class="${pin ? 'pin' : ''}">${planTrackOpts(t, i)}</select></td><td>${opsEsc(planWaitTxt(t, i))}</td><td>${i === 0 ? planLinkTxt(t.prev) : ''}</td><td>${i === n - 1 ? planLinkTxt(t.next) : ''}</td><td>${planHs(t)}</td></tr>`; });
  return `<div class="plscroll"><table class="pltab"><thead><tr><th>列車</th><th>種別</th><th>始発→終着</th><th>着</th><th>発</th><th>番線</th><th>待避</th><th>前の運用</th><th>次の運用</th><th>編成</th></tr></thead><tbody>${R.join('')}</tbody></table></div>${rows.length > 400 ? '<p class="hint">400本まで出しています。時間の幅を狭めてください</p>' : ''}`;
}
function planTrTable() {
  const q = planQ.trim(); let t = ttSel && opsReal(ttSel) && (!q || String(ttSel.no).includes(q)) ? ttSel : null;
  if (!t && q) t = ttList.find(x => opsReal(x) && String(x.no) === q) || ttList.find(x => opsReal(x) && String(x.no).includes(q));
  if (!t) return '<p class="hint">列車番号を入れるか、地図・一覧で列車を選んでください</p>';
  const n = t.names.length, nx = opsNextCands(t), pv = opsPrevCands(t);
  const sel = (list, cur, kind) => `<select data-lk="${kind}" data-k="${opsEsc(ttUKey(t))}"><option value="">${cur ? 'つながない' : '—(なし)'}</option>${list.map(x => `<option value="${opsEsc(ttUKey(x))}"${x === cur ? ' selected' : ''}>${opsEsc(x.no)} ${opsEsc(planTy(x))} ${opsEsc(kind === 'next' ? hm(opsDep(x)) + '発 ' + opsLast(x) + '行' : x.names[0] + ' ' + hm(opsArr(x)) + '着')}</option>`).join('')}${cur && !list.includes(cur) ? `<option value="${opsEsc(ttUKey(cur))}" selected>${opsEsc(cur.no)}</option>` : ''}</select>`;
  const R = planStops(t).filter(s => !s.ev.thru || planPlat(t, s.i) != null).map(({ nm, i, k, ev }) => { const set = opsSetOf(t), pin = set.plat && set.plat[nm] != null;
    return `<tr><td>${opsEsc(nm)}</td><td>${i === 0 ? '' : planHMS(t.A[k])}</td><td>${i === n - 1 ? '' : ev.thru ? '<span class="hint">通過</span>' : planHMS(t.P[k])}</td><td><select data-pp="${opsEsc(ttUKey(t))}" data-pi="${i}" class="${pin ? 'pin' : ''}">${planTrackOpts(t, i)}</select></td><td>${opsEsc(planWaitTxt(t, i))}</td></tr>`; });
  return `<div class="plhead"><b>${opsEsc(t.no)} ${opsEsc(planTy(t))} ${opsEsc(t.names[0])}→${opsEsc(t.names[n - 1])}</b> <span class="hint">${t.cars || ''}両 ${planHs(t)}</span>
    <label class="row"><span>前の運用</span>${sel(pv, t.prev, 'prev')}</label><label class="row"><span>次の運用</span>${sel(nx, t.next, 'next')}</label></div>
    <div class="plscroll"><table class="pltab"><thead><tr><th>駅</th><th>着</th><th>発</th><th>番線</th><th>待避</th></tr></thead><tbody>${R.join('')}</tbody></table></div>`;
}
// ===== 書き出し・読み込み =====
function planList(list) {   // 人が読める一覧
  return list.filter(opsReal).map(t => ({ キー: ttUKey(t), 列車: t.no, 種別: planTy(t), 両数: t.cars || null, 前: t.prev ? ttUKey(t.prev) : null, 次: t.next ? ttUKey(t.next) : null,
    停車: planStops(t).filter(s => !s.ev.thru).map(({ nm, i, k, ev }) => [nm, i === 0 ? '' : planHMS(t.A[k]), i === t.names.length - 1 ? '' : planHMS(t.P[k]), opsTrackLabel(nm, planPlat(t, i)) || '', ev.ot ? '待避' : ev.wait ? '通過待ち' : '']) }));
}
async function planExport() {
  const day = ttDay; if (!day) return;
  const hash = await fixHash(ttOpsStr(USER_OPS)), P = ttPlanNow && ttPlanNow.day === day && ttPlanNow.hash === hash && ttPlanNow.bin ? ttPlanNow : null;
  const out = { 形式: PLAN_FMT, 版: 1, 日: day, 書き出し: new Date().toISOString(), 配線と時刻表の鍵: FIXKEY, 編集の鍵: hash,
    説明: '「運用の編集」は画面の運用の編集と同じ形(番線は線の番号)。「一覧」の 番線(n本目)・次(列車のキー)は手で書き換えてよい(読み込むと運用の編集になる)。「計画」は計算した結果(書き換えない)',
    運用の編集: USER_OPS, 一覧: planList(ttList), 計画: P ? fixB64(P.bin) : null };
  if (opsDirty || !P) out.注意 = '反映していない編集があるので、計算した計画は入っていません(読み込むと計算します)';
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 1)], { type: 'application/json' })); a.download = `kq_plan_${day}.json`; a.click();
  opsMsgPlan(`kq_plan_${day}.json を書き出しました${out.計画 ? '' : '(計算した計画なし: 反映してから書き出すと、読み込んだときに計算しません)'}`);
}
function opsMsgPlan(s) { planNote = s; if ($('opspmsg')) $('opspmsg').textContent = s; planRender(); }
// 一覧の手直しを運用の編集にする(base = 書き出したときの計画の列車)。変えた件数とうまくいかなかったもの
function planDiff(rows, base, day, U) {
  const byK = new Map(base.filter(opsReal).map(t => [ttUKey(t), t])), out = { n: 0, ng: [] };
  const D = U[day] || (U[day] = {}); for (const k of ['link', 'cut', 'dh', 'del']) if (!D[k]) D[k] = []; if (!D.train || Array.isArray(D.train)) D.train = {};
  for (const r of rows || []) { const t = byK.get(r.キー); if (!t) { out.ng.push(r.キー + ': 列車が見つかりません'); continue; }
    for (const s of r.停車 || []) { const i = t.names.indexOf(s[0]); if (i < 0) continue; const was = opsTrackLabel(s[0], planPlat(t, i)) || '';
      if ((s[3] || '') === was) continue;
      const m = /^\s*(\d+)/.exec(String(s[3] || '')); const L = opsTracks(s[0]); const x = m && L[+m[1] - 1];
      if (!x) { out.ng.push(`${t.no} ${s[0]}: 番線「${s[3]}」が分かりません(1本目〜${L.length}本目)`); continue; }
      if (!opsTracksFor(t, i).some(y => y.e === x.e)) { out.ng.push(`${t.no} ${s[0]}: ${x.label} はこの列車の向きでは入れません`); continue; }
      const o = D.train[r.キー] || { no: t.no }; o.plat = Object.assign({}, o.plat, { [s[0]]: x.e }); D.train[r.キー] = o; out.n++; }
    const nxWas = t.next ? ttUKey(t.next) : null, nx = r.次 || null;
    if (nx !== nxWas) { const d = nx ? byK.get(nx) : null; if (nx && !d) { out.ng.push(`${t.no}: 次「${nx}」が見つかりません`); continue; }
      if (t.user || (d && d.user)) { out.ng.push(`${t.no}: 足した回送のつなぎは画面で直してください`); continue; }
      const st = t.names[t.names.length - 1];
      D.link = D.link.filter(x => !(x.a === t.no && x.st === st) && !(d && x.d === d.no && x.st === st)); D.cut = D.cut.filter(x => !(x.a === t.no && x.st === st) && !(d && x.d === d.no && x.st === st));
      if (d) D.link.push({ a: t.no, d: d.no, st }); else if (t.next) D.cut.push({ a: t.no, st, d: t.next.no });
      out.n++; }
  }
  return out;
}
async function planImport(f) {
  let J; try { J = JSON.parse(await f.text()); } catch (e) { opsMsgPlan('読み込めませんでした: ' + e.message); return; }
  if (!J || J.形式 !== PLAN_FMT) {   // 前の形(ops_user.json = 運用の編集だけ)
    USER_OPS = J; opsSave(); opsDirty = true; opsMsgPlan(f.name + ' を運用の編集として読み込みました。「反映」で計算し直します'); planRender(); return; }
  const day = J.日, U = J.運用の編集 || {};
  if (J.配線と時刻表の鍵 !== FIXKEY) opsMsgPlan('配線か時刻表が書き出したときと違うので、運用の編集だけ使って計算し直します');
  let base = null, bin = null;
  if (J.計画 && J.配線と時刻表の鍵 === FIXKEY) { try { bin = fixUnB64(J.計画); base = fixRevive(await fixGunzip(bin)).list; } catch (e) { console.error(e); bin = null; } }
  let d = { n: 0, ng: [] };
  if (base && J.一覧) { const now = JSON.stringify(planList(base)), was = JSON.stringify(J.一覧); if (now !== was) d = planDiff(J.一覧, base, day, U); }
  else if (J.一覧 && !base) opsMsgPlan('計算した計画が入っていないので、一覧の手直しは使えません(運用の編集だけ使います)');
  USER_OPS = U; opsSave();
  const hash = await fixHash(ttOpsStr(USER_OPS));
  if (bin && !d.n && hash === J.編集の鍵) { await fixIdb('put', FIXKEY + '|' + day + '|' + hash, bin); opsDirty = false; ttFixFail = false; if ($('ttday')) $('ttday').value = day; ttLoad(day); opsMsgPlan(`${f.name} の計画をそのまま読み込みました(計算なし)`); return; }
  opsDirty = false; ttFixFail = false; if ($('ttday')) $('ttday').value = day; ttLoad(day);
  opsMsgPlan(`${f.name} を読み込みました。` + (d.n ? `一覧の手直し ${d.n} 件を運用の編集にしました。` : '') + (d.ng.length ? `使えなかったもの ${d.ng.length} 件: ${d.ng.slice(0, 5).join(' / ')}。` : '') + '計算し直しています(1回だけ。結果はこのブラウザに保存)');
}
// ===== 画面 =====
{ const bar = document.querySelector('#opsdock .dtabs'), dock = $('opsdock');
  if (bar && dock) {
    const b = document.createElement('button'); b.id = 'dtabplan'; b.textContent = '計画表'; b.title = '固定の計画(番線・着発・待避・前後の運用・編成)を駅ごと・列車ごとに見て、その場で直す'; bar.insertBefore(b, bar.firstChild.nextSibling);
    const p = document.createElement('div'); p.id = 'dockplan'; p.className = 'dpane'; p.hidden = true; dock.appendChild(p);
    const fi = document.createElement('input'); fi.type = 'file'; fi.accept = '.json,application/json'; fi.hidden = true; fi.id = 'planfile'; dock.appendChild(fi);
    b.onclick = () => opsDockShow('plan');
    const f = opsDockShow; opsDockShow = function (tab) {
      if (tab === 'plan') { f('edit'); $('dockedit').hidden = true; $('dtabedit').classList.remove('on'); for (const [pn, bn] of [['dockbulk', 'dtabbulk'], ['dockhs', 'dtabhs'], ['occ', 'occopen']]) if ($(pn)) { $(pn).hidden = true; if ($(bn)) $(bn).classList.remove('on'); } p.hidden = false; b.classList.add('on'); planRender(); return; }
      if (tab) { p.hidden = true; b.classList.remove('on'); }
      return f.apply(this, arguments);
    };
    p.addEventListener('click', e => {
      const g = e.target.closest('[data-go]'); if (g) { opsGoKey(g.dataset.go); if (planMode === 'tr') setTimeout(planRender, 0); return; }
      const m = e.target.closest('[data-pm]'); if (m) { planMode = m.dataset.pm; planRender(); return; }
      const s = e.target.closest('[data-pt]'); if (s) { const v = s.dataset.pt; planT0 = v === 'now' ? Math.max(0, Math.floor((ttClock - 600) / 600) * 600) : Math.max(0, planT0 + (+v) * Math.min(planW, 14400)); planRender(); return; }
    });
    p.addEventListener('change', e => {
      const x = e.target;
      if (x.id === 'planst') { planSt = x.value; planRender(); return; }
      if (x.id === 'planw') { planW = +x.value; planRender(); return; }
      if (x.id === 'plant0') { const v = ttHMS(x.value); if (v != null) { planT0 = v; planRender(); } return; }
      if (x.dataset.pp != null) { const t = opsFind(x.dataset.pp), i = +x.dataset.pi; if (!t) return; const st = t.names[i], v = x.value;
        opsEdit(t, o => { o.plat = Object.assign({}, o.plat); if (v === '') delete o.plat[st]; else o.plat[st] = +v; }); opsDirty = true; planRender(); return; }
      if (x.dataset.lk) { const t = opsFind(x.dataset.k), o = x.value ? opsFind(x.value) : null; if (!t) return;
        if (x.dataset.lk === 'next') opsLinkSet(t, o); else if (o) opsLinkSet(o, t); else opsPrevCut(t);
        opsDirty = true; planRender(); return; }
    });
    p.addEventListener('input', e => { if (e.target.id === 'planq') { planQ = e.target.value; clearTimeout(planRender.tm); planRender.tm = setTimeout(() => { planRender(); const q = $('planq'); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } }, 250); } });
    p.addEventListener('focusin', e => { const s = e.target.closest('select[data-pp]'); if (s) { const t = opsFind(s.dataset.pp); if (t) opsHL(planPlat(t, +s.dataset.pi)); } });
    fi.onchange = () => { const f = fi.files[0]; if (f) planImport(f); };
    // 運用の編集の「書き出す・読み込む」も、この計画ファイルで
    if ($('opsexp')) { $('opsexp').onclick = planExport; $('opsexp').title = '運用の編集・一覧・計算した計画を1つの JSON に書き出す'; }
    if ($('opsfile')) $('opsfile').onchange = () => { const f = $('opsfile').files[0]; if (f) planImport(f); };
    { const sl = ttSelect; ttSelect = function (t) { const r = sl.apply(this, arguments); if (!p.hidden && planMode === 'tr' && t) planRender(); return r; }; }
  }
}
{ const r = opsRefresh; opsRefresh = function () { const x = r.apply(this, arguments); planRender(); return x; }; }   // 計算し直したあと・読み込んだあとに表を作り直す
