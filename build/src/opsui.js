// ===== 運用の編集(画面で運用をつなぐ・切る、回送を足す・直す・消す) =====
// 編集はこのブラウザ(localStorage kq-opsuser)に保存。「書き出す」で ops_user.json になり、node tools/ops_userin.js で build に取り込むと index.html に入る
// 計画への当て方は ttcore.js の ttUserOps(ttLink の最後)。反映ボタンで計算し直す
let opsDirty = false, opsSelA = null, opsSelD = null, opsStn = '', opsClr = 0, opsVan = new Map();
function opsLoadStore() { try { const s = localStorage.getItem('kq-opsuser'); if (s) return JSON.parse(s); } catch (e) { } return JSON.parse(JSON.stringify(USER_OPS_FILE || {})); }
USER_OPS = opsLoadStore();
const opsDayObj = () => { const d = ttDay || 'wd'; if (!USER_OPS[d]) USER_OPS[d] = {}; const o = USER_OPS[d]; for (const k of ['link', 'cut', 'dh', 'del']) if (!o[k]) o[k] = []; return o; };
const opsEsc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function opsSave() { USER_OPS.saved = Date.now(); try { localStorage.setItem('kq-opsuser', JSON.stringify(USER_OPS)); } catch (e) { } if (typeof cloudPush === 'function') cloudPush('ops', USER_OPS); opsDirty = true; opsRender(); }
const opsTy = t => (TYPES[t.type] || { name: t.type }).name;
// 駅ごとの「消える(相手のない終着)・現れる(前の運用のない始発)」
function opsCollect() {
  opsVan = new Map(); const g = s => opsVan.get(s) || (opsVan.set(s, { ends: [], starts: [] }), opsVan.get(s));
  for (const t of ttList) {
    if (!t.names || t.names.length < 2 || t.unit || t.cut) continue;
    if (!t.next && !t.exitEnd) g(t.names[t.names.length - 1]).ends.push(t);
    if (!t.prev && !t.exitStart) g(t.names[0]).starts.push(t);
  }
}
const opsArr = t => t.ev[t.ev.length - 1].arr, opsDep = t => t.ev[0].dep;
function opsRender() {
  const box = $('opscard'); if (!box) return;
  const U = opsDayObj(), st = [...opsVan].map(([s, v]) => ({ s, e: v.ends.length, d: v.starts.length, n: v.ends.filter(t => !t.stay).length + v.starts.filter(t => !t.stay).length })).filter(x => x.e + x.d).sort((a, b) => b.n - a.n);
  const tot = st.reduce((a, x) => [a[0] + x.e, a[1] + x.d], [0, 0]);
  $('opsstat').innerHTML = ttDay ? `${ttDay === 'wd' ? '平日' : '土休日'}: 消える ${tot[0]} 本・現れる ${tot[1]} 本(夜間留置を含む)` + (opsDirty ? '<br><b class="opswarn">反映していない編集があります。「反映」で計算し直します。</b>' : '') : '時刻表を選ぶと使えます';
  if (!opsStn || !opsVan.has(opsStn)) opsStn = st.length ? st[0].s : '';
  $('opsst').innerHTML = st.map(x => `<option value="${opsEsc(x.s)}"${x.s === opsStn ? ' selected' : ''}>${opsEsc(x.s)}　消${x.e}・現${x.d}</option>`).join('');
  const v = opsVan.get(opsStn) || { ends: [], starts: [] };
  const rows = [...v.ends.map(t => ({ t, k: 'a', m: opsArr(t) })), ...v.starts.map(t => ({ t, k: 'd', m: opsDep(t) }))].sort((a, b) => a.m - b.m);
  $('opsvan').innerHTML = rows.map((r, i) => { const t = r.t, on = (r.k === 'a' ? opsSelA : opsSelD) === t;
    const where = r.k === 'a' ? `${t.names[0]}から` : `${t.names[t.names.length - 1]}行き`;
    return `<li class="${r.k === 'a' ? 'oa' : 'od'}${on ? ' on' : ''}" data-i="${i}"><span class="om">${hm(r.m)}</span><span class="ok">${r.k === 'a' ? '消' : '現'}</span><span class="on2">${opsEsc(t.no)}</span><span class="ow">${opsEsc(opsTy(t))} ${t.cars || '?'}両 ${opsEsc(where)}${t.stay ? ' ・夜間留置' : ''}${t.dh ? ' ・回送' : ''}</span><span class="ob"><button data-b="go" title="この時刻へ">時刻へ</button><button data-b="dh" title="${r.k === 'a' ? 'この列車のあとに回送を出す' : 'この列車の前に回送で来る'}">回送</button></span></li>`; }).join('') || '<li class="hint">この駅に消える・現れる列車はありません</li>';
  $('opsvan').rows = rows;
  $('opslink').disabled = !(opsSelA && opsSelD);
  $('opslink').textContent = opsSelA && opsSelD ? `${opsSelA.no} → ${opsSelD.no} をつなぐ` : '消える1本と現れる1本を選んでつなぐ';
  // 編集の一覧
  const L = [];
  U.link.forEach((x, i) => L.push(`<li><span>つなぐ ${opsEsc(x.a)} → ${opsEsc(x.d)}(${opsEsc(x.st)})</span><button data-x="link:${i}">✕</button></li>`));
  U.cut.forEach((x, i) => L.push(`<li><span>切る ${opsEsc(x.a)} のあと${x.d ? '(' + opsEsc(x.d) + ' へつながない)' : ''}(${opsEsc(x.st)})</span><button data-x="cut:${i}">✕</button></li>`));
  U.dh.forEach((x, i) => L.push(`<li><span>回送 ${opsEsc(x.no)} ${opsEsc(x.from)} ${opsEsc(x.dep)} → ${opsEsc(x.to)} ${opsEsc(x.arr)} ${x.cars}両${x.prev ? ' 前:' + opsEsc(x.prev) : ''}${x.next ? ' 次:' + opsEsc(x.next) : ''}</span><button data-e="dh:${i}">直す</button><button data-x="dh:${i}">✕</button></li>`));
  U.del.forEach((x, i) => L.push(`<li><span>自動の回送を消す ${opsEsc(x.no)}(${opsEsc(x.from)} ${opsEsc(x.dep)}発)</span><button data-x="del:${i}">✕</button></li>`));
  $('opsedits').innerHTML = L.join('') || '<li class="hint">まだ編集はありません</li>';
  const ms = ttList.length ? ttUserCheck(ttList) : [];
  $('opsmsg').innerHTML = ms.map(s => `<div class="opswarn">${opsEsc(s)}</div>`).join('');
}
function opsRefresh() { opsCollect(); if (opsSelA && !ttList.includes(opsSelA)) opsSelA = null; if (opsSelD && !ttList.includes(opsSelD)) opsSelD = null; opsRender(); }
function opsJump(m) { ttClock = Math.max(0, m * 60 - 90); $('ttime').value = Math.floor(ttClock / 60); }
function opsForm(x) { for (const k of ['no', 'from', 'dep', 'to', 'arr', 'cars', 'prev', 'next']) if (x[k] != null) $('dh' + k).value = x[k]; $('opscard').open = true; $('dhno').scrollIntoView({ block: 'nearest' }); }
// 選んだ列車の詳細に出すボタン
function opsSelBtns(t) {
  if (!t || t.unit || t.cut) return '';
  const b = [];
  if (t.next) b.push(`<button data-op="cutn">次(${opsEsc(t.next.no)})とのつながりを切る</button>`);
  if (t.prev) b.push(`<button data-op="cutp">前(${opsEsc(t.prev.no)})とのつながりを切る</button>`);
  if (!t.next && !t.exitEnd) b.push(`<button data-op="dha">着いたあと回送を出す</button>`);
  if (t.dh) b.push(`<button data-op="dhfix">この回送を直す</button><button data-op="dhdel" class="danger">この回送を消す</button>`);
  return b.length ? `<div class="opssel">${b.join('')}</div>` : '';
}
function opsSelAct(op) {
  const t = ttSel; if (!t) return; const U = opsDayObj();
  if (op === 'cutn') U.cut.push({ a: t.no, st: t.names[t.names.length - 1], d: t.next.no });
  else if (op === 'cutp') U.cut.push({ a: t.prev.no, st: t.names[0], d: t.no });
  else if (op === 'dha') { opsForm({ no: '回' + t.no, from: t.names[t.names.length - 1], dep: hm(opsArr(t) + 5), prev: t.no, cars: t.cars || 8, to: '', arr: '', next: '' }); return; }
  else if (op === 'dhdel' || op === 'dhfix') {
    const x = t.user ? t.user : { no: t.no, from: t.names[0], dep: hm(opsDep(t)), to: t.names[t.names.length - 1], arr: hm(opsArr(t)), cars: t.cars || 8, prev: t.prev ? t.prev.no : '', next: t.next ? t.next.no : '' };
    if (t.user) U.dh.splice(U.dh.indexOf(t.user), 1); else U.del.push({ no: t.no, from: t.names[0], dep: hm(opsDep(t)) });
    if (op === 'dhfix') opsForm(Object.assign({}, x, { no: t.user ? x.no : '回' + t.no.replace(/^回/, '') }));
  }
  opsSave();
}
$('ttlinkinfo').addEventListener('click', e => { const b = e.target.closest('button[data-op]'); if (b) opsSelAct(b.dataset.op); });
$('opsst').onchange = () => { opsStn = $('opsst').value; opsRender(); };
$('opsvan').addEventListener('click', e => {
  const li = e.target.closest('li[data-i]'); if (!li) return; const r = $('opsvan').rows[+li.dataset.i]; if (!r) return;
  const b = e.target.closest('button[data-b]');
  if (b && b.dataset.b === 'go') { opsJump(r.m); return; }
  if (b && b.dataset.b === 'dh') {
    const t = r.t;
    if (r.k === 'a') opsForm({ no: '回' + t.no, from: opsStn, dep: hm(r.m + 5), prev: t.no, cars: t.cars || 8, to: '', arr: '', next: '' });
    else opsForm({ no: '回' + t.no, to: opsStn, arr: hm(r.m - 5), next: t.no, cars: t.cars || 8, from: '', dep: '', prev: '' });
    return;
  }
  if (r.k === 'a') opsSelA = opsSelA === r.t ? null : r.t; else opsSelD = opsSelD === r.t ? null : r.t;
  opsRender();
});
$('opslink').onclick = () => { if (!opsSelA || !opsSelD) return; opsDayObj().link.push({ a: opsSelA.no, d: opsSelD.no, st: opsStn }); opsSelA = opsSelD = null; opsSave(); };
$('dhadd').onclick = () => {
  const x = {}; for (const k of ['no', 'from', 'dep', 'to', 'arr', 'cars', 'prev', 'next']) x[k] = $('dh' + k).value.trim();
  x.cars = +x.cars || 8; if (!x.no) x.no = '回送';
  if (ttHM(x.dep) == null || ttHM(x.arr) == null) { $('dhmsg').textContent = '時刻は 10:15 の形で入れてください(0〜3時台は翌日の深夜として扱います)'; return; }
  if (ttHM(x.arr) <= ttHM(x.dep)) { $('dhmsg').textContent = '着の時刻が発の時刻より前です'; return; }
  if (!x.from || !x.to) { $('dhmsg').textContent = '発駅と着駅を選んでください'; return; }
  $('dhmsg').textContent = `回送 ${x.no} を追加しました。「反映」で計算し直します`;
  opsDayObj().dh.push(x); opsSave();
};
$('opsedits').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return; const U = opsDayObj();
  if (b.dataset.x) { const [k, i] = b.dataset.x.split(':'); U[k].splice(+i, 1); opsSave(); }
  else if (b.dataset.e) { const [k, i] = b.dataset.e.split(':'); const x = U[k].splice(+i, 1)[0]; opsForm(x); opsSave(); }
});
$('opsapply').onclick = () => { opsDirty = false; ttLoad(ttDay); };
$('opsexp').onclick = () => {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(USER_OPS, null, 1)], { type: 'application/json' }));
  a.download = 'ops_user.json'; a.click(); $('dhmsg').textContent = 'ops_user.json を書き出しました(ダウンロード)';
};
$('opsimp').onclick = () => $('opsfile').click();
$('opsfile').onchange = () => { const f = $('opsfile').files[0]; if (!f) return; f.text().then(s => { try { USER_OPS = JSON.parse(s); opsSave(); $('dhmsg').textContent = f.name + ' を読み込みました。「反映」で計算し直します'; } catch (e) { $('dhmsg').textContent = '読み込めませんでした: ' + e.message; } }); $('opsfile').value = ''; };
$('opsclr').onclick = () => {
  if (Date.now() - opsClr > 3000) { opsClr = Date.now(); $('opsclr').textContent = 'もう一度押すと消します'; setTimeout(() => { $('opsclr').textContent = 'ブラウザの編集を消す'; }, 3000); return; }
  try { localStorage.removeItem('kq-opsuser'); } catch (e) { } USER_OPS = JSON.parse(JSON.stringify(USER_OPS_FILE || {})); $('opsclr').textContent = 'ブラウザの編集を消す'; opsSave();
};
{ const names = [...new Set(TT.st)].filter(s => stByName.has(s)); const o = '<option value=""></option>' + names.map(s => `<option>${opsEsc(s)}</option>`).join(''); $('dhfrom').innerHTML = o; $('dhto').innerHTML = o; }
