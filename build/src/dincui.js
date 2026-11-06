// ===== 事故・支障の設定(運行設定メニュー): 手動・自動(ランダム/シード)・発生中の一覧と解除 =====
{ const sec = document.createElement('details'); sec.id = 'incsettings';
  sec.innerHTML = `<summary>事故・支障の設定</summary><div id="incsec"><h2>事故・支障</h2>
  <div class="incf">
    <label class="row"><span>種類</span><select id="inckind">${Object.entries(D_INCNAME).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
    <div id="incopt"></div>
    <label class="row"><span>時間</span><span class="incdur"><input id="incmin" type="number" min="1" max="600" value="15"> 分 <label class="inl"><input id="incinf" type="checkbox"> 未定(解除するまで)</label></span></label>
    <label class="row"><span>起こす時刻</span><span class="incdur"><input id="incat" type="time" step="60"> <small>空欄 = いま</small></span></label>
    <div class="btns"><button id="incgo" class="primary">起こす</button></div>
    <p id="incmsg" class="dp-sub"></p>
  </div>
  <h3 class="dp-h">自動(ランダム)</h3>
  <div class="incf"><label class="inl"><input id="incauto" type="checkbox"> 自動で起こす</label>
    <label class="row"><span>1日の件数</span><input id="incn" type="number" min="1" max="30" value="3"></label>
    <label class="row"><span>シード</span><span class="incdur"><input id="incseed" type="number" min="1" value="1"> <button id="incseedr" title="シードを変える">別の日にする</button></span></label>
    <p class="dp-sub">シードが同じなら同じ事故(時刻・種類・場所・時間)が起きます。起きるまでは出しません。</p></div>
  <h3 class="dp-h">起きている・起きた事故</h3><ul id="inclist" class="dp-ev"></ul></div>`;
  const pop = $('setmenu') && $('setmenu').querySelector('.pop'); if (pop) pop.appendChild(sec);
}
function dIncOpt() {
  const k = $('inckind').value, box = $('incopt'); let h = '';
  if (k === 'car') h = `<p class="dp-sub">図で列車を選んでから「起こす」(選んでいなければ走っている列車からランダム)。<b id="incsel"></b></p>`;
  else if (k === 'block') { const P = dIncPairs(); h = `<label class="row"><span>駅間</span><select id="incpair">${P.map((p, i) => `<option value="${i}">${DSEC[p.si].sc.name} ${p.a}〜${p.b}</option>`).join('')}</select></label>
    <label class="row"><span>向き</span><select id="incdir"><option value="both">上下線</option><option value="down">下り線</option><option value="up">上り線</option></select></label>
    <label class="inl"><input id="incjin" type="checkbox" checked> 人身事故(その場の列車が非常ブレーキで止まる)</label>`; }
  else if (k === 'dwell') { const S = [...new Set(DSEC.flatMap(s => [...s.stInfo.keys()]))]; h = `<label class="row"><span>駅</span><select id="incst">${S.map(n => `<option>${n}</option>`).join('')}</select></label>
    <label class="row"><span>向き</span><select id="incdir"><option value="any">どちらでも</option><option value="down">下り</option><option value="up">上り</option></select></label>
    <label class="inl"><input id="incselt" type="checkbox"> 図で選んでいる列車にする</label>`; }
  else { h = `<label class="row"><span>JR の路線</span><select id="incline">${Object.keys(D_JRPRESET).map(n => `<option>${n}</option>`).join('')}</select></label>
    <div id="incsts" class="incsts"></div><label class="row"><span>客の倍率</span><input id="incmul" type="number" min="1.1" max="5" step="0.1" value="2"></label>
    <p class="dp-sub">「運行の設定」の「乗降客数で停車時間」が入っているときに効きます。</p>`; }
  box.innerHTML = h;
  if (k === 'jr') { const f = () => { const L = D_JRPRESET[$('incline').value] || [], S = [...new Set(DSEC.flatMap(s => [...s.stInfo.keys()]))]; $('incsts').innerHTML = L.filter(n => S.includes(n)).map(n => `<label class="inl"><input type="checkbox" value="${n}" checked> ${n}</label>`).join(''); }; $('incline').onchange = f; f(); }
  if (k === 'car' || k === 'dwell') { const m = { car: 15, dwell: 5 }[k]; $('incmin').value = m; }
  else $('incmin').value = 60;
  if (k === 'block') {
    const sync = () => { const min = $('incjin').checked ? 60 : 1; $('incmin').min = min; if (+$('incmin').value < min) $('incmin').value = min; };
    $('incjin').onchange = sync; sync();
  } else $('incmin').min = 1;
}
$('inckind').onchange = dIncOpt;
$('incgo').onclick = () => {
  const k = $('inckind').value, dur = $('incinf').checked ? Infinity : Math.max(1, +$('incmin').value || 10) * 60, at = $('incat').value ? ttHMS($('incat').value) : null;
  const o = { kind: k, dur, T0: at != null ? at : D_NOW }; const msg = s => { $('incmsg').textContent = s; };
  if (k === 'car') { const t = dSel && dSel.ph ? dSel : null; if (t) { o.key = ttUKey(t); o.t = t; } o.seed = Math.random(); }
  else if (k === 'block') { const p = dIncPairs()[+$('incpair').value]; if (!p) return msg('駅間を選んでください'); Object.assign(o, { si: p.si, a: p.a, b: p.b, km0: p.km0, km1: p.km1, dir: $('incdir').value, jin: $('incjin').checked }); }
  else if (k === 'dwell') { Object.assign(o, { st: $('incst').value, dir: $('incdir').value }); if ($('incselt').checked && dSel) o.key = ttUKey(dSel); }
  else { const L = [...document.querySelectorAll('#incsts input:checked')].map(x => x.value); if (!L.length) return msg('駅を選んでください'); Object.assign(o, { line: $('incline').value, stations: L, mul: Math.max(1.1, +$('incmul').value || 2) }); }
  dIncAdd(o); msg(`${D_INCNAME[k]} を${o.T0 > D_NOW + 1 ? ' ' + ttSHMS(o.T0) + ' に' : ''}起こします`); dIncList();
};
const dIncAutoSet = () => { D_INCAUTO.on = $('incauto').checked; D_INCAUTO.n = Math.max(0, +$('incn').value || 0); D_INCAUTO.seed = Math.max(1, +$('incseed').value || 1); dIncAutoGen(); dIncList(); };
$('incauto').onchange = dIncAutoSet; $('incn').onchange = dIncAutoSet; $('incseed').onchange = dIncAutoSet;
$('incseedr').onclick = () => { $('incseed').value = 1 + Math.floor(Math.random() * 99999); dIncAutoSet(); };
function dIncList() {
  const ul = $('inclist'); if (!ul) return;
  const L = D_INC.filter(o => o.on || o.done || o.src === '手動').slice().sort((a, b) => (b.on - a.on) || a.T0 - b.T0);
  const h = L.map(o => { const end = dIncEnd(o), st = o.on ? '発生中' : o.done ? '解除' : '予定';
    return `<li class="k-${o.on ? 'emer' : o.done ? 'late' : 'wait'}"><time>${hm(Math.floor(o.T0 / 60))}</time><span><b>${st}</b> ${o.src === '自動' ? '【自動】' : ''}${D_INCNAME[o.kind]} ${dIncWhere(o)}${end < Infinity ? `(〜${hm(Math.floor(end / 60))})` : '(解除まで)'}${!o.done ? ` <button data-inc="${o.id}">${o.on ? '解除' : '取り消す'}</button>` : ''}</span></li>`; }).join('') || '<li class="none">なし</li>';
  if (ul._h !== h) { ul.innerHTML = h; ul._h = h; }
  const sel = $('incsel'); if (sel) sel.textContent = dSel && dSel.ph ? '選んでいる列車: ' + dSel.no : '';
}
$('inclist').addEventListener('click', e => { const b = e.target.closest('[data-inc]'); if (!b) return; const o = D_INC.find(x => x.id === +b.dataset.inc); if (o) { dIncClear(o); dIncList(); } });
dIncOpt(); dIncList(); setInterval(dIncList, 1000);
