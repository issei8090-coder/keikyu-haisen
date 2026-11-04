// ===== 運用の編集 =====
// 時刻表の列車の時刻は変えない。変えられるのは、時刻表に無いもの: 次・前の運用(つなぎ方)、番線(待避線・留置線も)、終着駅での折り返し方(引上線と、入る・戻る時刻)、
// 1日の始まり・終わり(夜間留置・検車区からの出庫/への入庫)、回送(駅・通過/停車・時刻・番線)、時刻表に無い通過待ち(推定)
// 編集はこのブラウザ(localStorage kq-opsuser)と、編集キーがあればリポジトリ(cloud.js)に保存。計画への当て方は ttcore.js の ttUserOps・ttPlanner
// 保存の形: USER_OPS[日] = { link:[{a,d,st}], cut:[{a,st,d}], dh:[回送], del:[{no,from,dep}], train:{キー: {plat, turn, fin, begin, wait}} }(キー = ttUKey)
let opsDirty = false, opsSelA = null, opsSelD = null, opsStn = '', opsClr = 0, opsVan = new Map(), opsDh = null;
function opsLoadStore() { try { const s = localStorage.getItem('kq-opsuser'); if (s) return JSON.parse(s); } catch (e) { } return JSON.parse(JSON.stringify(USER_OPS_FILE || {})); }
USER_OPS = opsLoadStore();
const opsDayObj = () => { const d = ttDay || 'wd'; if (!USER_OPS[d]) USER_OPS[d] = {}; const o = USER_OPS[d]; for (const k of ['link', 'cut', 'dh', 'del']) if (!o[k]) o[k] = []; if (!o.train || Array.isArray(o.train)) o.train = {}; return o; };
const opsEsc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function opsSave() { USER_OPS.saved = Date.now(); if (typeof ttGeoSig === 'function') USER_OPS.geo = ttGeoSig(); try { localStorage.setItem('kq-opsuser', JSON.stringify(USER_OPS)); } catch (e) { } if (typeof cloudPush === 'function') cloudPush('ops', USER_OPS); opsDirty = true; opsRender(); if (ttSel) opsTrainPanel(ttSel); }
const opsTy = t => (TYPES[t.type] || { name: t.type }).name;
const opsArr = t => t.ev[t.ev.length - 1].arr, opsDep = t => t.ev[0].dep;
const opsLast = t => t.names[t.names.length - 1];
const opsReal = t => t && t.names && t.names.length >= 2 && !t.unit && !t.cut;
const opsFind = key => ttList.find(t => opsReal(t) && ttUKey(t) === key);
const opsCo = t => { try { return ttRunOf(t).co || ''; } catch (e) { return ''; } };
const opsT = (t, i) => { const e = t.ev[i]; return e.as != null ? ttSHMS(e.as) : hm(i === 0 ? e.dep : e.arr); };
const STN_NAMES = [...new Set(TT.st)].filter(s => stByName.has(s));
// 駅の番線(ホームの線)。番号は図の上から数えた順(実際の番線の番号とは限らない)。選ぶと図の上で光らせる
function opsTracks(st) {
  const s = stByName.get(st); if (!s) return [];
  if (typeof mainThru === 'function') mainThru();
  const es = [...new Set(s.stops.map(([e]) => e))].sort((a, b) => (N[E[a].a].y + N[E[a].b].y) - (N[E[b].a].y + N[E[b].b].y) || N[E[a].a].x - N[E[b].a].x);
  return es.map((e, i) => ({ e, label: `${i + 1}本目` + (E[e].dir > 0 ? '(→)' : E[e].dir < 0 ? '(←)' : '(⇄)') + (MAINTHRU ? (MAINTHRU.has(e) ? ' 本線' : ' 副本線・待避線') : '') }));
}
// 列車がその駅を通る向きで入れる線だけ(両方向の線と、同じ向きの線)。終着・始発駅は向きを変えるので全部
function opsTracksFor(t, i) {
  const all = opsTracks(t.names[i]); if (!t.route || i === 0 || i === t.names.length - 1) return all;
  const d = t.route.stopD[i + t.k0]; let sg = 0; for (const g of t.route.segs) if (g.d0 <= d && d <= g.d1) { sg = Math.sign(g.bx - g.ax); break; }
  if (!sg) return all;
  const set = t.uset && t.uset.plat, f = set ? set[t.names[i]] : null, cur = t.route.stopE[i];
  return all.filter(x => !E[x.e].dir || E[x.e].dir === sg || x.e === cur || x.e === +f);
}
const opsSidings = st => (SIDINGS.get(st) || []).slice().sort((a, b) => N[a.node].y - N[b.node].y || N[a.node].x - N[b.node].x);
function opsTrackLabel(st, e) { if (e == null) return ''; const x = opsTracks(st).find(x => x.e === +e); if (x) return x.label; const sd = (SIDINGS.get(st) || []).find(s => s.e === +e); return sd ? sd.label : '線' + e; }
const opsHLp = el('path', { class: 'opshl' }, gRoute);
function opsHL(e) { if (e == null || e === '' || isNaN(+e) || !E[+e]) { opsHLp.setAttribute('d', ''); return; } const a = N[E[+e].a], b = N[E[+e].b]; opsHLp.setAttribute('d', `M${a.x} ${a.y}L${b.x} ${b.y}`); }
const opsTrackOpts = (st, sel, withSd, list) => '<option value="">自動</option>' + (list || opsTracks(st)).map(x => `<option value="${x.e}"${+sel === x.e && sel !== '' && sel != null ? ' selected' : ''}>${opsEsc(x.label)}</option>`).join('') + (withSd ? opsSidings(st).map(sd => `<option value="${sd.e}"${+sel === sd.e ? ' selected' : ''}>${opsEsc(sd.label)}</option>`).join('') : '');
const opsSdOpts = (st, sel, auto) => (auto ? `<option value="">${opsEsc(auto)}</option>` : '') + opsSidings(st).map(sd => `<option value="${sd.e}"${+sel === sd.e ? ' selected' : ''}>${opsEsc(sd.label)}</option>`).join('');
// 列車の設定を書き換える(時刻表の列車・自動の回送は U.train[キー]、手で足した回送はその回送の項目)
function opsEdit(t, fn) {
  if (t.user) fn(t.user);
  else { const U = opsDayObj(), k = ttUKey(t), o = U.train[k] || {}; fn(o); for (const x of Object.keys(o)) if (o[x] == null || o[x] === '' || (typeof o[x] === 'object' && !Object.keys(o[x]).length)) delete o[x]; if (Object.keys(o).length) { o.no = t.no; U.train[k] = o; } else delete U.train[k]; }
  opsSave();
}
const opsSetOf = t => t.user ? t.user : (opsDayObj().train[ttUKey(t)] || {});
// 12両で止まる途中の駅(ttcore の splitStations と同じ決まり)・自動の切り離しの説明
function opsSplitSts(t) { if (!t || !t.names || t.unit || t.cut) return []; const n = t.names.length, ci = t.names.indexOf('金沢文庫'), si = t.names.indexOf('品川'), sj = t.names.indexOf('泉岳寺'), L = [];
  for (let q = 1; q < n - 1; q++) { if (t.ev[q].thru || (si >= 0 && sj >= 0 && (sj > si ? q > si : q < si))) continue; if (t.cpl && t.cpl.unit ? q > t.cpl.i : t.cars === 12 && (ci < 0 || q <= ci)) L.push(t.names[q]); } return L; }
function opsSplitAuto(t) {
  if (t.cpl && t.cpl.unit) { const v = ttList.find(u => u.cut && u.cplWith === t && !u.userSplit); if (v) return `品川で前4両を引上線へ${v.into ? ' → ' + v.into.no + 'の車両' : '(そのあと回送)'}`; return t.cpl.side === 'front' ? '品川で前4両を切り離し' : '終着まで12両'; }
  const ci = t.names.indexOf('金沢文庫'); return ci > 0 && ci < t.names.length - 1 ? '金沢文庫で後ろ4両を切り離し(消える)' : '終着まで12両';
}
// ===== 運用のつなぎ(次・前) =====
function opsNextCands(a) { const st = opsLast(a), ta = opsArr(a); return ttList.filter(d => opsReal(d) && d !== a && d.names[0] === st && !d.exitStart && opsDep(d) >= ta && opsDep(d) - ta <= 240).sort((x, y) => opsDep(x) - opsDep(y)).slice(0, 30); }
function opsPrevCands(d) { const st = d.names[0], td = opsDep(d); return ttList.filter(a => opsReal(a) && a !== d && opsLast(a) === st && !a.exitEnd && opsArr(a) <= td && td - opsArr(a) <= 240).sort((x, y) => opsArr(y) - opsArr(x)).slice(0, 30); }
const opsMark = (a, d) => (a.cars && d.cars && carsMismatch(a, d) ? ' ※両数' + a.cars + '→' + d.cars : '') + (opsCo(a) && opsCo(d) && opsCo(a) !== opsCo(d) ? ' ※' + opsCo(a) + '車→' + opsCo(d) + '車' : '');
const carsMismatch = (a, d) => a.cars !== d.cars && !(a.cpl && d.cars === 12);
function opsLinkSet(a, d) {   // a のあと d につなぐ(d = null なら a のあとを切る)
  const U = opsDayObj(), st = opsLast(a);
  U.link = U.link.filter(x => !(x.a === a.no && x.st === st) && !(d && x.d === d.no && x.st === st)); U.cut = U.cut.filter(x => !(x.a === a.no && x.st === st) && !(d && x.d === d.no && x.st === st));
  if (a.user) a.user.next = d ? d.no : '';
  if (d && d.user) d.user.prev = a.no;
  if (!d) { if (a.next && !a.user) U.cut.push({ a: a.no, st, d: a.next.no }); if (a.next && a.next.user) a.next.user.prev = ''; }
  else if (!a.user && !d.user) U.link.push({ a: a.no, d: d.no, st });
  opsSave();
}
function opsPrevCut(d) { const a = d.prev; if (!a) return; const U = opsDayObj(), st = d.names[0]; U.link = U.link.filter(x => !(x.d === d.no && x.st === st)); if (d.user) d.user.prev = ''; else if (a.user) a.user.next = ''; else U.cut.push({ a: a.no, st, d: d.no }); opsSave(); }
// ===== 車両の1日(つながりをたどる) =====
function opsChain(t) { let h = t, n = 0; while (h.prev && n++ < 100) h = h.prev; const L = []; let x = h; n = 0; while (x && n++ < 150) { L.push(x); x = x.next; } return L; }
// ===== 運用表: 車両の1日を、始まり → 列車 → 折り返し → … → 終わり の順に1枚で見せて、その場で直す =====
// 列車の行は時刻表のまま(見るだけ)。直せるのは: 始まり(夜間留置・留置線・車庫・別の駅から回送)、折り返し(ホーム・引上線・時刻・番線・次の列車)、終わり
let opsOpvDh = null;   // 「回送で来る・行く」を選んで、まだ回送を作っていない行(キー|begin/fin)
const opsSdSel = (st, cur, withPlat) => `<option value="">自動</option>${withPlat ? `<option value="plat"${cur === 'plat' ? ' selected' : ''}>ホームで折り返す</option>` : ''}${opsSidings(st).map(sd => `<option value="sd:${sd.e}"${cur === 'sd:' + sd.e ? ' selected' : ''}>${opsEsc(sd.label)}で折り返す</option>`).join('')}`;
function opsOpv(t, ch, b0, e1) {
  const H = [], h = ch[0], z = ch[ch.length - 1], kh = opsEsc(ttUKey(h)), kz = opsEsc(ttUKey(z));
  // 始まり
  { const st = h.names[0], b = opsSetOf(h).begin || {}, cur = b.mode === 'sd' ? 'sd:' + b.sd : b.mode || '', dhOpen = opsOpvDh === ttUKey(h) + '|begin', can = !h.prev && !h.exitStart;
    H.push(`<div class="opv-end ${b0[0] ? 'ok' : 'ng'}" data-tk="${kh}"><div class="opv-h"><span class="opv-tag">${b0[0] ? '始まり' : '現れる'}</span><span>${opsEsc(b0[1])}${h.fromSiding ? ` <small>(${ttSHMS(h.P[0])} に出て ${ttSHMS(h.A[1])} ホーム)</small>` : ''}</span></div>`
      + (can ? `<div class="opv-f"><label>どこから<select data-k="beginx"><option value="">${b0[0] ? '自動(上のとおり)' : '未設定(突然現れる)'}</option><option value="plat"${cur === 'plat' ? ' selected' : ''}>${opsEsc(st)} ホームで夜間留置</option>${opsSidings(st).map(sd => `<option value="sd:${sd.e}"${cur === 'sd:' + sd.e ? ' selected' : ''}>${opsEsc(st)} ${opsEsc(sd.label)}で夜間留置</option>`).join('')}${DEPOT_NAME[st] ? `<option value="depot"${cur === 'depot' ? ' selected' : ''}>${opsEsc(DEPOT_NAME[st])}から出庫</option>` : ''}<option value="dh"${dhOpen ? ' selected' : ''}>別の駅の車庫・留置線から回送で来る…</option></select></label>`
        + (b.mode === 'sd' || b.mode === 'depot' ? `<label>ホームに着く<input data-k="begin.back" value="${opsEsc(b.back || '')}" placeholder="${ttSHMS(opsDep(h) * 60 - 110)}"></label>` : '')
        + `<label>${opsEsc(st)}の番線<select data-plat="${opsEsc(st)}" data-hl>${opsTrackOpts(st, (opsSetOf(h).plat || {})[st], false, opsTracksFor(h, 0))}</select></label>`
        + (dhOpen ? opsOpvDhForm(st, null, h) : '') + `</div>` : '') + `</div>`);
  }
  ch.forEach((x, i) => {
    const kx = opsEsc(ttUKey(x)), n = x.names.length;
    H.push(`<div class="opv-tr${x === t ? ' on' : ''}${x.dh ? ' dh' : ''}" data-go="${kx}"><span class="opv-t">${opsT(x, 0)}<br>${opsT(x, n - 1)}</span><span class="opv-m"><b>${opsEsc(x.no)}</b> ${opsEsc(opsTy(x))} ${x.cars || '?'}両${x.dh ? (x.user ? ' <i>手で足した回送</i>' : ' <i>自動の回送</i>') : ''}<br>${opsEsc(x.names[0])} → ${opsEsc(opsLast(x))}${n > 2 ? ` <small>(途中${n - 2}駅)</small>` : ''}</span><span class="opv-b">${x.dh && x.user ? `<button data-b="dhfix" data-tk="${kx}">回送を直す</button>` : ''}<button data-go="${kx}">細かく</button></span></div>`);
    if (i < ch.length - 1) {   // 折り返し・つなぎ
      const y = ch[i + 1], st = opsLast(x), u = opsSetOf(x).turn || {}, cur = u.mode === 'sd' ? 'sd:' + u.sd : u.mode || '', nc = opsNextCands(x); if (!nc.includes(y)) nc.unshift(y);
      const same = y.names[0] === st;
      H.push(`<div class="opv-turn" data-tk="${kx}"><div class="opv-h"><span class="opv-tag">${same ? '折り返し' : 'つなぎ'}</span><span>${opsEsc(st)} ${opsT(x, n - 1)}着 → ${opsT(y, 0)}発 <small>(${Math.round(opsDep(y) - opsArr(x))}分)</small><br><small>いま: ${opsEsc(opsTurnTxt(x))}</small></span></div><div class="opv-f">`
        + (same && opsSidings(st).length ? `<label>折り返し方<select data-k="turnx">${opsSdSel(st, cur, true)}</select></label>` + (u.mode === 'sd' ? `<label>ホームを出る<input data-k="turn.lv" value="${opsEsc(u.lv || '')}" placeholder="${ttSHMS(opsArr(x) * 60 + 40)}"></label><label>ホームに戻る<input data-k="turn.back" value="${opsEsc(u.back || '')}" placeholder="${ttSHMS(opsDep(y) * 60 - 50)}"></label>` : '') : '')
        + `<label>着く番線<select data-plat="${opsEsc(st)}" data-hl>${opsTrackOpts(st, (opsSetOf(x).plat || {})[st], false, opsTracksFor(x, n - 1))}</select></label>`
        + `<label>次の列車<select data-k="next">${nc.map(d => `<option value="${opsEsc(ttUKey(d))}"${d === y ? ' selected' : ''}>${opsT(d, 0)}発 ${opsEsc(d.no)} ${opsEsc(opsTy(d))} ${d.cars || '?'}両 ${opsEsc(opsLast(d))}行${d.prev && d.prev !== x ? '(いまは' + opsEsc(d.prev.no) + 'から)' : ''}</option>`).join('')}</select></label><button data-b="cut">ここで切る</button></div></div>`);
    }
  });
  // 終わり
  { const st = opsLast(z), f = opsSetOf(z).fin || {}, cur = f.mode === 'sd' ? 'sd:' + f.sd : f.mode || '', dhOpen = opsOpvDh === ttUKey(z) + '|fin', can = !z.next && !z.exitEnd;
    H.push(`<div class="opv-end ${e1[0] ? 'ok' : 'ng'}" data-tk="${kz}"><div class="opv-h"><span class="opv-tag">${e1[0] ? '終わり' : '消える'}</span><span>${opsEsc(e1[1])}</span></div>`
      + (can ? `<div class="opv-f"><label>どこへ<select data-k="finx"><option value="">${e1[0] ? '自動(上のとおり)' : '未設定(消える)'}</option><option value="plat"${cur === 'plat' ? ' selected' : ''}>${opsEsc(st)} ホームで夜間留置</option>${opsSidings(st).map(sd => `<option value="sd:${sd.e}"${cur === 'sd:' + sd.e ? ' selected' : ''}>${opsEsc(st)} ${opsEsc(sd.label)}へ入って夜間留置</option>`).join('')}${DEPOT_NAME[st] ? `<option value="depot"${cur === 'depot' ? ' selected' : ''}>${opsEsc(DEPOT_NAME[st])}へ入庫</option>` : ''}<option value="dh"${dhOpen ? ' selected' : ''}>別の駅の車庫・留置線まで回送で行く…</option></select></label>`
        + (f.mode === 'sd' || f.mode === 'depot' ? `<label>ホームを出る<input data-k="fin.lv" value="${opsEsc(f.lv || '')}" placeholder="${ttSHMS(opsArr(z) * 60 + 40)}"></label>` : '')
        + `<label>${opsEsc(st)}の番線<select data-plat="${opsEsc(st)}" data-hl>${opsTrackOpts(st, (opsSetOf(z).plat || {})[st], false, opsTracksFor(z, z.names.length - 1))}</select></label>`
        + (dhOpen ? opsOpvDhForm(st, z, null) : '') + `</div>` : '') + `</div>`);
  }
  return `<h3 class="opsh">運用表(この車両の1日・${ch.length}本)</h3><div class="opv">${H.join('')}</div>`;
}
function opsOpvDhForm(st, a, d) {   // 回送で来る・行く駅を選ぶ
  const sp = opsDhSpots(st, a, d), mm = s => Math.round(s / 60) + '分';
  return `<label>車庫・留置線のある駅<select data-dhsp>${sp.map(x => `<option value="${opsEsc(x.st)}">${opsEsc(x.st)}${x.depot ? '(' + opsEsc(DEPOT_NAME[x.st]) + ')' : ''} ${mm(a ? x.go : x.back)}${x.rev ? `(${opsEsc(st)}で向きを変える)` : ''}</option>`).join('') || '<option value="">回送で行ける駅がありません</option>'}</select></label><button data-b="${a ? 'mkdhend' : 'mkdhbegin'}" class="primary"${sp.length ? '' : ' disabled'}>回送を作る</button>`;
}
function opsOpvChange(t, s) {   // 運用表の選び(始まり・終わり・折り返し方)。扱ったら true
  const k = s.dataset.k, v = s.value;
  if (k === 'beginx' || k === 'finx') { const g = k === 'beginx' ? 'begin' : 'fin', key = ttUKey(t) + '|' + g;
    if (v === 'dh') { opsOpvDh = key; opsTrainPanel($('opstrain').tr); return true; }
    if (opsOpvDh === key) opsOpvDh = null;
    opsEdit(t, o => { const old = o[g] || {}; if (!v) delete o[g]; else if (v === 'plat') o[g] = { mode: 'plat' }; else if (v === 'depot') o[g] = { mode: 'depot', lv: old.lv, back: old.back }; else o[g] = { mode: 'sd', sd: +v.slice(3), lv: old.lv, back: old.back }; });
    return true; }
  if (k === 'turnx') { opsEdit(t, o => { const old = o.turn || {}; if (!v) delete o.turn; else if (v === 'plat') o.turn = { mode: 'plat' }; else o.turn = { mode: 'sd', sd: +v.slice(3), lv: old.lv, back: old.back }; }); return true; }
  if (s.matches('[data-dhsp]')) return true;
  return false;
}
function opsOpvClick(t, el) {
  const b = el.closest('button[data-b]'); if (!b) return false; const k = b.dataset.b;
  if (k === 'mkdhbegin' || k === 'mkdhend') { const box = b.closest('.opv-f'), sel = box && box.querySelector('[data-dhsp]'), X = sel && sel.value; if (!X) return true;
    opsOpvDh = null; if (k === 'mkdhbegin') opsDhSet(null, t, X, t.names[0]); else opsDhSet(t, null, X, opsLast(t)); return true; }
  if (k === 'cut') { opsLinkSet(t, null); return true; }
  if (k === 'dhfix' && t.user) { opsDhOpen(JSON.parse(JSON.stringify(t.user)), opsDayObj().dh.indexOf(t.user)); return true; }
  return false;
}
function opsBeginTxt(h) {
  const st = h.names[0], e0 = h.route ? h.route.segs[0].e : null;
  if (h.exitStart) return [1, `図の外から入ってくる(${h.names[0]})`];
  if (h.vStart === 'depot') return [1, `${DEPOT_NAME[st] || st + 'の車庫'}から出庫`];
  if (h.fromSiding && h.stay) return [1, `${st} ${h.fromSiding.label || '留置線'}で夜間留置 → ${ttSHMS(h.A[1])} ホームへ`];
  if (h.stay) return [1, `${st} ${opsTrackLabel(st, e0)}で夜間留置`];
  if (h.vStart === 'split' && h.formed) return [1, `${h.formed[0].no} が${st}で切り離した4両(運用の編集)`];
  if (h.formed) return [1, `品川で切り離した4両を組み合わせる(推定)`];
  if (h.fromSiding) return [0, `${st} ${h.fromSiding.label || '引上線'}に突然現れる(前の運用が未設定)`];
  return [0, `${st}に突然現れる(前の運用が未設定)`];
}
function opsEndTxt(t) {
  const st = opsLast(t);
  if (t.exitEnd) return [1, `図の外へ出ていく`];
  if (t.vEnd === 'depot') return [1, `${DEPOT_NAME[st] || st + 'の車庫'}へ入庫(${ttSHMS(t.P[t.names.length - 1 + t.k0])} ホームを出る)`];
  if (t.vEnd === 'sd' || (t.stay && t.tail)) return [1, `${st} ${t.tail ? t.tail.label : '留置線'}へ入って夜間留置`];
  if (t.stay) return [1, `${st} ${opsTrackLabel(st, t.route && t.route.segs[t.route.segs.length - 1].e)}で夜間留置`];
  if (t.tail) return [0, `${st} ${t.tail.label || '引上線'}へ入って消える(次の運用が未設定)`];
  return [0, `${st}で消える(次の運用が未設定)`];
}
function opsTurnTxt(a) {
  const d = a.next, st = opsLast(a);
  if (!d) return '';
  if (d.names[0] !== st) return `${st} → ${d.names[0]}(駅が違う。回送が要ります)`;
  if (a.tail && d.fromSiding === a.tail) return `${st} ${a.tail.label || '引上線'}で折り返し(ホーム発 ${ttSHMS(a.P[a.names.length - 1 + a.k0])} → ホーム着 ${ttSHMS(d.A[1])})`;
  return `${st} ${opsTrackLabel(st, a.route && a.route.stopE[a.names.length - 1])}で折り返し`;
}
const opsLine = t => `${opsT(t, 0)} ${opsEsc(t.names[0])} → ${opsEsc(opsLast(t))} ${opsT(t, t.ev.length - 1)}`;
// ===== 列車を選んだときの「運用の設定」 =====
function opsTrainPanel(t) {
  const box = $('opstrain'); if (!box) return;
  if (!t || !opsReal(t)) { box.hidden = true; box.innerHTML = ''; opsHL(null); return; }
  box.hidden = false; box.tr = t;
  const set = opsSetOf(t), n = t.names.length, st0 = t.names[0], st1 = opsLast(t), H = [];
  // ぶつかり・反映できなかったこと(原因の列車を開く・空いている番線へ移す)
  const probs = [...(t.userErr || []).map(s => `<div class="opswarn">${opsEsc(s)}</div>`), ...(t.userConf || []).map((c, i) => `<div class="opswarn">${opsEsc(c.text)}${c.by.length ? '<div class="opsby">原因: ' + c.by.map(b => `<span><button data-go="${opsEsc(b.key)}">${opsEsc(b.no)} を開く</button><button data-mv="${i}|${opsEsc(b.key)}">${opsEsc(b.no)} を空いている番線へ</button></span>`).join('') + '</div>' : ''}</div>`)];
  if (probs.length) H.push(`<div class="opsprob">${probs.join('')}</div>`);
  // 車両の1日
  const ch = opsChain(t), b0 = opsBeginTxt(ch[0]), e1 = opsEndTxt(ch[ch.length - 1]);
  H.push(opsOpv(t, ch, b0, e1));
  // 前・次の運用
  const pc = opsPrevCands(t), nc = t.exitEnd ? [] : opsNextCands(t);
  if (t.prev && !pc.includes(t.prev)) pc.unshift(t.prev);
  if (t.next && !nc.includes(t.next)) nc.unshift(t.next);
  H.push(`<h3 class="opsh">前・次の運用</h3><div class="opsform1">`
    + (t.exitStart ? '' : `<label>前の運用(${opsEsc(st0)}に着く列車)<select data-k="prev"><option value="">なし(1日の始まり)</option>${pc.map(a => `<option value="${opsEsc(ttUKey(a))}"${a === t.prev ? ' selected' : ''}>${opsT(a, a.ev.length - 1)}着 ${opsEsc(a.no)} ${opsEsc(opsTy(a))} ${a.cars || '?'}両 ${opsEsc(a.names[0])}から${a.next && a.next !== t ? ' ・今は' + opsEsc(a.next.no) + 'へ' : ''}${opsEsc(opsMark(a, t))}</option>`).join('')}</select></label>`)
    + (t.exitEnd ? '' : `<label>次の運用(${opsEsc(st1)}から出る列車)<select data-k="next"><option value="">なし(1日の終わり)</option>${nc.map(d => `<option value="${opsEsc(ttUKey(d))}"${d === t.next ? ' selected' : ''}>${opsT(d, 0)}発 ${opsEsc(d.no)} ${opsEsc(opsTy(d))} ${d.cars || '?'}両 ${opsEsc(opsLast(d))}行き${d.prev && d.prev !== t ? ' ・今は' + opsEsc(d.prev.no) + 'から' : ''}${opsEsc(opsMark(t, d))}</option>`).join('')}</select></label>`)
    + `</div><div class="opssel">${!t.next && !t.exitEnd ? '<button data-b="dhafter">ほかの駅へ回送を出す</button>' : ''}${!t.prev && !t.exitStart ? '<button data-b="dhbefore">ほかの駅から回送で来る</button>' : ''}</div>`);
  // 1日の始まり(前の運用なし)
  if (!t.prev && !t.exitStart) {
    const b = set.begin || {}, sds = opsSidings(st0);
    H.push(`<h3 class="opsh">1日の始まり(${opsEsc(st0)})</h3><div class="opsform"><label>扱い<select data-k="begin.mode"><option value="">未設定(突然現れる)</option><option value="plat"${b.mode === 'plat' ? ' selected' : ''}>ホームで夜間留置</option>${sds.length ? `<option value="sd"${b.mode === 'sd' ? ' selected' : ''}>留置線で夜間留置 → 出庫</option>` : ''}${DEPOT_NAME[st0] ? `<option value="depot"${b.mode === 'depot' ? ' selected' : ''}>${opsEsc(DEPOT_NAME[st0])}から出庫</option>` : ''}</select></label>`
      + (b.mode === 'sd' || (b.mode === 'depot' && sds.length) ? `<label>${b.mode === 'sd' ? '留置線' : '通る線'}<select data-k="begin.sd" data-hl>${opsSdOpts(st0, b.sd, b.mode === 'depot' ? '自動' : '')}</select></label><label>ホームに着く時刻(出庫)<input data-k="begin.back" value="${opsEsc(b.back || '')}" placeholder="${ttSHMS(opsDep(t) * 60 - 110)}"></label>` : '')
      + `</div>`);
  }
  // 終着駅で: 折り返し方 / 1日の終わり
  if (!t.exitEnd) {
    const sds = opsSidings(st1);
    if (t.next && t.next.names[0] === st1) {
      const u = set.turn || {}, cur = t.tail && t.next.fromSiding === t.tail;
      H.push(`<h3 class="opsh">${opsEsc(st1)}での折り返し(→ ${opsEsc(t.next.no)} ${opsT(t.next, 0)}発)</h3><div class="opsform"><label>折り返し方<select data-k="turn.mode"><option value="">自動(${cur ? opsEsc(t.tail.label || '引上線') : 'ホーム'})</option><option value="plat"${u.mode === 'plat' ? ' selected' : ''}>ホームで(引上線を使わない)</option>${sds.length ? `<option value="sd"${u.mode === 'sd' ? ' selected' : ''}>引上線・留置線で</option>` : ''}</select></label>`
        + (u.mode === 'sd' ? `<label>線<select data-k="turn.sd" data-hl>${opsSdOpts(st1, u.sd != null ? u.sd : sds[0].e)}</select></label><label>ホームを出る(入庫)<input data-k="turn.lv" value="${opsEsc(u.lv || '')}" placeholder="${cur ? ttSHMS(t.P[n - 1 + t.k0]) : ttSHMS(opsArr(t) * 60 + 70)}"></label><label>ホームに着く(出庫)<input data-k="turn.back" value="${opsEsc(u.back || '')}" placeholder="${cur ? ttSHMS(t.next.A[1]) : ttSHMS(opsDep(t.next) * 60 - 50)}"></label>` : '')
        + `</div>`);
    } else if (!t.next) {
      const f = set.fin || {};
      H.push(`<h3 class="opsh">1日の終わり(${opsEsc(st1)})</h3><div class="opsform"><label>扱い<select data-k="fin.mode"><option value="">未設定(消える)</option><option value="plat"${f.mode === 'plat' ? ' selected' : ''}>ホームで夜間留置</option>${sds.length ? `<option value="sd"${f.mode === 'sd' ? ' selected' : ''}>留置線へ入って夜間留置</option>` : ''}${DEPOT_NAME[st1] ? `<option value="depot"${f.mode === 'depot' ? ' selected' : ''}>${opsEsc(DEPOT_NAME[st1])}へ入庫</option>` : ''}</select></label>`
        + (f.mode === 'sd' || (f.mode === 'depot' && sds.length) ? `<label>${f.mode === 'sd' ? '留置線' : '通る線'}<select data-k="fin.sd" data-hl>${opsSdOpts(st1, f.sd, f.mode === 'depot' ? '自動' : '')}</select></label><label>ホームを出る時刻(入庫)<input data-k="fin.lv" value="${opsEsc(f.lv || '')}" placeholder="${ttSHMS(opsArr(t) * 60 + 70)}"></label>` : '')
        + `</div>`);
    }
  }
  // 切り離し(12両で止まる途中の駅があるとき)
  { const sts = opsSplitSts(t), sp = set.split || {};
    if (sts.length) {
      const cpl = t.cpl && t.cpl.unit, st = sp.st && sts.includes(sp.st) ? sp.st : (cpl && sts.includes('品川') ? '品川' : sts.includes('金沢文庫') ? '金沢文庫' : sts[0]), q = t.names.indexOf(st), side = cpl ? t.cpl.side : sp.side === 'front' ? 'front' : 'rear';
      const dc = ttList.filter(d => opsReal(d) && d.names[0] === st && opsDep(d) >= t.ev[q].dep + 2 && opsDep(d) - t.ev[q].dep <= 180).sort((x, y) => opsDep(x) - opsDep(y)).slice(0, 30);
      const done = t.splitDone, auto = opsSplitAuto(t);
      H.push(`<h3 class="opsh">切り離し(12両 → 8両)</h3><div class="opsform"><label>切り離した4両<select data-k="split.mode"><option value="">自動(${opsEsc(auto)})</option><option value="sd"${sp.mode === 'sd' ? ' selected' : ''}>引上線・留置線に残す(その日はそこ)</option><option value="depot"${sp.mode === 'depot' ? ' selected' : ''}>車庫線へ入る(入庫)</option><option value="link"${sp.mode === 'link' ? ' selected' : ''}>その駅から出る列車になる</option></select></label>`
        + (sp.mode ? `<label>駅<select data-k="split.st">${sts.map(x => `<option${x === st ? ' selected' : ''}>${opsEsc(x)}</option>`).join('')}</select></label>`
          + (cpl ? `<label>切り離す側<select disabled><option>${side === 'front' ? '前の4両' : '後ろの4両'}(増結した側)</option></select></label>` : `<label>切り離す側<select data-k="split.side"><option value="rear"${side === 'rear' ? ' selected' : ''}>後ろの4両</option><option value="front"${side === 'front' ? ' selected' : ''}>前の4両</option></select></label>`)
          + `<label>入る線<select data-k="split.sd" data-hl>${opsSdOpts(st, sp.sd, '自動')}</select></label>`
          + (sp.mode === 'link' ? `<label>なる列車(${opsEsc(st)}から出る)<select data-k="split.d"><option value="">選ぶ</option>${dc.map(d => `<option value="${opsEsc(ttUKey(d))}"${ttUKey(d) === sp.d ? ' selected' : ''}>${opsT(d, 0)}発 ${opsEsc(d.no)} ${opsEsc(opsTy(d))} ${d.cars || '?'}両 ${opsEsc(opsLast(d))}${d.prev ? '(前の運用あり)' : ''}</option>`).join('')}</select></label>` : '')
          + `<label>4両が動き出す時刻<input data-k="split.lv" value="${opsEsc(sp.lv || '')}" placeholder="${ttSHMS(side === 'front' ? t.P[q + t.k0] - 25 : t.P[q + t.k0] + 40)}"></label>` : '')
        + `</div>` + (done ? `<p class="hint">いま: ${opsEsc(done.st)}で${done.side === 'front' ? '前' : '後ろ'}の4両を ${ttSHMS(done.at)} に${opsEsc(opsTrackLabel(done.st, done.sd))}へ${done.d ? ` → ${opsEsc(done.d.no)}(${opsT(done.d, 0)}発)になる` : done.mode === 'sd' ? '入れて、その日はそこ' : '入れて入庫'}</p>` : ''));
    }
  }
  // 番線(ホームが2本以上ある駅だけ)
  const rows = t.names.map((nm, i) => ({ nm, i, tr: opsTracksFor(t, i) })).filter(r => r.tr.length > 1 || (set.plat && set.plat[r.nm] != null));
  if (rows.length) H.push(`<h3 class="opsh">番線(番号は図の上から数えた線。選ぶと図で光ります)</h3><div class="opsplat">` + rows.map(r => { const cur = t.route ? t.route.stopE[r.i] : null, e = t.ev[r.i];
    return `<label><span>${opsEsc(r.nm)} <small>${e.thru ? '通過 ' + opsT(t, r.i) : opsT(t, r.i)}${e.wait ? ' 待' : ''}</small></span><select data-plat="${opsEsc(r.nm)}" data-hl>${opsTrackOpts(r.nm, set.plat ? set.plat[r.nm] : null, false, r.tr)}</select><small class="cur" data-hlv="${cur == null ? '' : cur}">いま ${opsEsc(opsTrackLabel(r.nm, cur))}</small></label>`; }).join('') + `</div>`);
  // 通過待ち(時刻表に無いもの)
  if (!t.dh) {
    const ws = t.ev.map((e, i) => ({ e, i })).filter(x => x.e.wait && x.i > 0 && x.i < n - 1);
    const cand = opsPassStations(t);
    const w = set.wait || {};
    H.push(`<h3 class="opsh">通過待ち(時刻表に無いもの)</h3><ul class="opse">` + ws.map(x => `<li><span>${opsEsc(x.e.name)} ${ttSHMS(x.e.as)}〜${ttSHMS(x.e.ds)} ${x.e.user ? '(指定)' : '(推定)'}</span><button data-wdel="${opsEsc(x.e.name)}|${x.e.user ? 1 : 0}">✕</button></li>`).join('') + (w.del || []).map(s => `<li><span class="hint">${opsEsc(s)} の推定の通過待ちを消しています</span><button data-wundo="${opsEsc(s)}">戻す</button></li>`).join('') + (ws.length || (w.del || []).length ? '' : '<li class="hint">ありません</li>') + `</ul>`
      + (cand.length ? `<div class="opsform"><label>待つ駅<select id="opwst">${cand.map((c, i) => `<option value="${i}">${opsEsc(c.st)}(${opsEsc(c.after)}の次)</option>`).join('')}</select></label><label>着く〜出る(秒まで可)<span class="inline"><input id="opwas" placeholder="${ttSHMS(cand[0].tc - 30)}"><input id="opwds" placeholder="${ttSHMS(cand[0].tc + 60)}"></span></label></div><div class="btns"><button data-b="wadd">通過待ちを足す</button></div>` : ''));
  }
  // 回送そのもの
  if (t.dh) H.push(`<h3 class="opsh">この回送</h3><div class="opssel">${t.user ? '<button data-b="dhfix">駅・時刻・番線を直す</button><button data-b="dhdel" class="danger">この回送を消す</button>' : '<button data-b="dhcopy">自動の回送を手で直す</button><button data-b="dhdel" class="danger">この自動の回送を消す</button>'}</div>`);
  H.push(`<div class="btns"><button data-b="apply" class="primary">反映(計算し直す)</button></div>${opsDirty ? '<p class="opswarn">反映していない編集があります</p>' : ''}`);
  box.innerHTML = `<details open><summary>運用の設定(時刻表の時刻は変えません)</summary>${H.join('')}</details>`;
}
// 経路の上で止まらずに通っている駅(通過待ちを入れられる駅)と、そこを通る見込みの時刻
function opsPassStations(t) {
  if (!t.route) return [];
  const out = [], seen = new Set(t.names), D = t.route.stopD;
  for (const g of t.route.segs) { const si = edgeStation[g.e]; if (si < 0) continue; const nm = ST[si].name; if (seen.has(nm)) continue; seen.add(nm);
    const d = (g.d0 + g.d1) / 2; let k = 0; while (k + 1 < D.length && D[k + 1] < d) k++;
    const i = k - t.k0; if (i < 0 || i >= t.names.length - 1) continue;
    const p0 = t.P[k], a1 = t.A[k + 1], f = (d - D[k]) / Math.max(1, D[k + 1] - D[k]);
    out.push({ st: nm, after: t.names[i], tc: p0 + (a1 - p0) * f }); }
  return out;
}
function opsMoveCause(t, ci, key) {   // 原因の列車を、その駅の空いている番線へ移す
  const c = (t.userConf || [])[ci], x = opsFind(key); if (!c || !x) return;
  const i = x.names.indexOf(c.st);
  if (i < 0) { opsMsg(`${x.no} は ${c.st} に止まらない列車です。${x.no} を開いて直してください`); return; }
  const k = i + x.k0, a = x.A[k] - 5, b = i === x.names.length - 1 && x.next ? Math.max(x.next.ev[0].dep * 60 + 5, x.P[k] + 5) : x.P[k] + 5;
  const busy = e => (ttRes && ttRes.get(e) || []).some(r => r[0] < b && a < r[1] && r[2] !== x && r[2] !== x.next && r[2] !== x.prev);
  const alt = opsTracks(c.st).map(r => r.e).filter(e => e !== c.e && !busy(e));
  if (!alt.length) { opsMsg(`${c.st} に ${x.no} が ${ttSHMS(a)}〜${ttSHMS(b)} に入れる空いた番線がありません`); return; }
  opsEdit(x, o => { o.plat = Object.assign({}, o.plat, { [c.st]: alt[0] }); });
  opsMsg(`${x.no} の ${c.st} の番線を ${opsTrackLabel(c.st, alt[0])} にしました。「反映」で計算し直します`);
}
function opsMsg(s) { const m = $('opstrain').querySelector('.opsnote') || (() => { const p = document.createElement('p'); p.className = 'opsnote hint'; $('opstrain').prepend(p); return p; })(); m.textContent = s; }
function opsGoKey(key) { const x = opsFind(key); if (!x) return; if (x.g) ttSelect(x); else { opsJump(opsDep(x)); ttSelect(x); } }
$('opstrain').addEventListener('click', e => {
  const tkE = e.target.closest('[data-tk]'), t = tkE ? opsFind(tkE.dataset.tk) : $('opstrain').tr; if (!t) return;
  if (opsOpvClick(t, e.target)) return;
  const go = e.target.closest('[data-go]'); if (go) { opsGoKey(go.dataset.go); return; }
  const mv = e.target.closest('[data-mv]'); if (mv) { const [ci, key] = mv.dataset.mv.split('|'); opsMoveCause(t, +ci, key); return; }
  const wd = e.target.closest('[data-wdel]'); if (wd) { const [st, u] = wd.dataset.wdel.split('|'); opsEdit(t, o => { const w = o.wait || {}; if (+u) w.add = (w.add || []).filter(x => x.st !== st); else w.del = [...new Set([...(w.del || []), st])]; o.wait = w; }); return; }
  const wu = e.target.closest('[data-wundo]'); if (wu) { opsEdit(t, o => { const w = o.wait || {}; w.del = (w.del || []).filter(s => s !== wu.dataset.wundo); o.wait = w; }); return; }
  const b = e.target.closest('button[data-b]'); if (!b) return;
  const k = b.dataset.b;
  if (k === 'apply') { opsDirty = false; ttLoad(ttDay); }
  else if (k === 'dhafter') opsDhOpen({ no: '回' + t.no, cars: t.cars || 8, prev: t.no, stops: [{ st: opsLast(t), dep: ttSHMS(opsArr(t) * 60 + 300) }, { st: '', arr: '' }] }, -1);
  else if (k === 'dhbefore') opsDhOpen({ no: '回' + t.no, cars: t.cars || 8, next: t.no, stops: [{ st: '', dep: '' }, { st: t.names[0], arr: ttSHMS(opsDep(t) * 60 - 300) }] }, -1);
  else if (k === 'dhfix') opsDhOpen(JSON.parse(JSON.stringify(t.user)), opsDayObj().dh.indexOf(t.user));
  else if (k === 'dhcopy' || (k === 'dhdel' && !t.user)) {
    const U = opsDayObj(); U.del.push({ no: t.no, from: t.names[0], dep: hm(opsDep(t)) });
    if (k === 'dhcopy') { const x = { no: t.no, cars: t.cars || 8, prev: t.prev ? t.prev.no : '', next: t.next ? t.next.no : '', stops: t.ev.map((e, i) => ({ st: e.name, arr: i ? ttSHMS(t.A[i + t.k0]) : '', dep: i < t.ev.length - 1 ? ttSHMS(t.P[i + t.k0]) : '', pass: !!e.thru, plat: t.route && t.route.stopE[i] != null ? t.route.stopE[i] : '' })) }; opsSave(); opsDhOpen(x, -1); }
    else opsSave();
  }
  else if (k === 'dhdel') { const U = opsDayObj(); U.dh.splice(U.dh.indexOf(t.user), 1); opsSave(); }
  else if (k === 'wadd') { const c = opsPassStations(t)[+$('opwst').value]; if (!c) return; const as = $('opwas').value.trim() || ttSHMS(c.tc - 30), ds = $('opwds').value.trim() || ttSHMS(c.tc + 60);
    if (ttHMS(as) == null || ttHMS(ds) == null) { opsMsg('時刻は 10:15 か 10:15:30 の形で入れてください'); return; }
    opsEdit(t, o => { const w = o.wait || {}; w.add = (w.add || []).filter(x => x.st !== c.st).concat([{ st: c.st, after: c.after, as, ds }]); o.wait = w; }); }
});
$('opstrain').addEventListener('change', e => {
  const s = e.target, tkE = s.closest('[data-tk]'), t = tkE ? opsFind(tkE.dataset.tk) : $('opstrain').tr; if (!t) return;
  if (opsOpvChange(t, s)) return;
  if (s.dataset.plat != null) { const st = s.dataset.plat, v = s.value; opsEdit(t, o => { o.plat = Object.assign({}, o.plat); if (v === '') delete o.plat[st]; else o.plat[st] = +v; }); return; }
  const k = s.dataset.k; if (!k) return;
  if (k === 'prev') { if (!s.value) opsPrevCut(t); else { const a = opsFind(s.value); if (a) opsLinkSet(a, t); } return; }
  if (k === 'next') { const d = s.value ? opsFind(s.value) : null; opsLinkSet(t, d); return; }
  const [grp, f] = k.split('.');
  let v = s.value.trim();
  if ((f === 'lv' || f === 'back') && v && ttHMS(v) == null) { opsMsg('時刻は 10:15 か 10:15:30 の形で入れてください'); return; }
  opsEdit(t, o => { const g = Object.assign({}, o[grp]); if (v === '') delete g[f]; else g[f] = f === 'sd' ? +v : v; if (f === 'mode' && !v) { delete o[grp]; return; } if (f === 'mode' && v === 'sd' && g.sd == null && grp !== 'split') { const sd = opsSidings(grp === 'begin' ? t.names[0] : opsLast(t))[0]; if (sd) g.sd = sd.e; } o[grp] = g; });
});
$('opstrain').addEventListener('focusin', e => { const s = e.target; if (s.matches('select[data-hl]')) opsHL(s.value); });
$('opstrain').addEventListener('mouseover', e => { const s = e.target.closest('select[data-hl],[data-hlv]'); if (s) opsHL(s.dataset.hlv != null ? s.dataset.hlv : s.value); });
$('opstrain').addEventListener('input', e => { if (e.target.matches('select[data-hl]')) opsHL(e.target.value); });
// ===== 回送の編集(駅・停車/通過・時刻・番線、始まり・終わり) =====
function opsDhOpen(x, idx) { if (!x.stops) x.stops = [{ st: x.from || '', dep: x.dep || '' }, { st: x.to || '', arr: x.arr || '' }]; opsDh = { x, idx }; opsDockShow('edit'); opsDhRender(); $('dhed').scrollIntoView({ block: 'nearest' }); }
function opsDhRender() {
  const box = $('dhed'); if (!opsDh) { box.innerHTML = `<div class="btns"><button data-d="new">回送を新しく作る</button></div>`; return; }
  const x = opsDh.x, S = x.stops, st0 = S[0].st, st1 = S[S.length - 1].st;
  const stOpts = v => '<option value=""></option>' + STN_NAMES.map(s => `<option${s === v ? ' selected' : ''}>${opsEsc(s)}</option>`).join('');
  const d0s = ttHMS(S[0].dep), a1s = ttHMS(S[S.length - 1].arr), d0 = d0s == null ? null : d0s / 60, a1 = a1s == null ? null : a1s / 60;   // 分
  const pc = st0 ? ttList.filter(a => opsReal(a) && !a.dh && opsLast(a) === st0 && !a.exitEnd && (d0 == null || (opsArr(a) <= d0 && d0 - opsArr(a) <= 300))).sort((p, q) => opsArr(q) - opsArr(p)).slice(0, 40) : [];
  const nc = st1 ? ttList.filter(d => opsReal(d) && !d.dh && d.names[0] === st1 && !d.exitStart && (a1 == null || (opsDep(d) >= a1 && opsDep(d) - a1 <= 300))).sort((p, q) => opsDep(p) - opsDep(q)).slice(0, 40) : [];
  const b = x.begin || {}, f = x.fin || {};
  box.innerHTML = `<div class="opsform"><label>列車番号<input data-x="no" value="${opsEsc(x.no || '')}"></label><label>両数<select data-x="cars">${[2, 4, 6, 8, 10, 12].map(c => `<option${+x.cars === c ? ' selected' : ''}>${c}</option>`).join('')}</select></label></div>
  <table class="dhst"><thead><tr><th>駅</th><th></th><th>着</th><th>発</th><th>番線</th><th></th></tr></thead><tbody>${S.map((s, i) => `<tr data-i="${i}"><td><select data-s="st">${stOpts(s.st)}</select></td><td>${i && i < S.length - 1 ? `<select data-s="pass"><option value="">停車</option><option value="1"${s.pass ? ' selected' : ''}>通過</option></select>` : i ? '着' : '発'}</td><td>${i ? `<input data-s="arr" value="${opsEsc(s.arr || '')}" placeholder="${i < S.length - 1 && s.pass ? '通過' : ''}">` : ''}</td><td>${i < S.length - 1 && !(i && s.pass) ? `<input data-s="dep" value="${opsEsc(s.dep || '')}">` : ''}</td><td>${s.st ? `<select data-s="plat" data-hl>${opsTrackOpts(s.st, s.plat)}</select>` : ''}</td><td><button data-d="add" title="この下に駅を足す">＋</button>${S.length > 2 ? '<button data-d="rm" title="この駅を消す">✕</button>' : ''}</td></tr>`).join('')}</tbody></table>
  <div class="btns"><button data-d="fill">あいだの駅を埋める(経路の駅)</button><button data-d="time">空いた時刻をならす</button></div>
  <div class="opsform"><label>前の列車(${opsEsc(st0 || '発駅')}に着く)<select data-x="prev"><option value="">なし</option>${pc.map(a => `<option value="${opsEsc(a.no)}"${a.no === x.prev ? ' selected' : ''}>${opsT(a, a.ev.length - 1)}着 ${opsEsc(a.no)} ${opsEsc(opsTy(a))} ${a.cars}両</option>`).join('')}${x.prev && !pc.some(a => a.no === x.prev) ? `<option selected>${opsEsc(x.prev)}</option>` : ''}</select></label>
  <label>次の列車(${opsEsc(st1 || '着駅')}から出る)<select data-x="next"><option value="">なし</option>${nc.map(d => `<option value="${opsEsc(d.no)}"${d.no === x.next ? ' selected' : ''}>${opsT(d, 0)}発 ${opsEsc(d.no)} ${opsEsc(opsTy(d))} ${d.cars}両</option>`).join('')}${x.next && !nc.some(d => d.no === x.next) ? `<option selected>${opsEsc(x.next)}</option>` : ''}</select></label>
  ${!x.prev && st0 ? `<label>始まり(前の列車なし)<select data-x="begin.mode"><option value="">突然現れる</option><option value="plat"${b.mode === 'plat' ? ' selected' : ''}>ホームで夜間留置</option>${opsSidings(st0).length ? `<option value="sd"${b.mode === 'sd' ? ' selected' : ''}>留置線から出庫</option>` : ''}${DEPOT_NAME[st0] ? `<option value="depot"${b.mode === 'depot' ? ' selected' : ''}>${opsEsc(DEPOT_NAME[st0])}から出庫</option>` : ''}</select></label>${b.mode === 'sd' ? `<label>留置線<select data-x="begin.sd" data-hl>${opsSdOpts(st0, b.sd)}</select></label>` : ''}` : ''}
  ${!x.next && st1 ? `<label>終わり(次の列車なし)<select data-x="fin.mode"><option value="">消える</option><option value="plat"${f.mode === 'plat' ? ' selected' : ''}>ホームで夜間留置</option>${opsSidings(st1).length ? `<option value="sd"${f.mode === 'sd' ? ' selected' : ''}>留置線へ入庫</option>` : ''}${DEPOT_NAME[st1] ? `<option value="depot"${f.mode === 'depot' ? ' selected' : ''}>${opsEsc(DEPOT_NAME[st1])}へ入庫</option>` : ''}</select></label>${f.mode === 'sd' ? `<label>留置線<select data-x="fin.sd" data-hl>${opsSdOpts(st1, f.sd)}</select></label>` : ''}` : ''}</div>
  ${x.next && st1 && opsSidings(st1).length ? `<div class="opsform"><label>着いたあと(${opsEsc(st1)})<select data-x="turn.mode"><option value="">自動</option><option value="plat"${(x.turn || {}).mode === 'plat' ? ' selected' : ''}>ホームで待つ</option><option value="sd"${(x.turn || {}).mode === 'sd' ? ' selected' : ''}>引上線・留置線で待つ</option></select></label>${(x.turn || {}).mode === 'sd' ? `<label>線<select data-x="turn.sd" data-hl>${opsSdOpts(st1, (x.turn || {}).sd)}</select></label><label>ホームを出る<input data-x="turn.lv" value="${opsEsc((x.turn || {}).lv || '')}"></label><label>ホームに着く<input data-x="turn.back" value="${opsEsc((x.turn || {}).back || '')}"></label>` : ''}</div>` : ''}
  <p class="hint">時刻は 10:15 か 10:15:30。通過駅は「着」に通る時刻。途中で止まって待つ(待避)なら停車にして着と発を入れ、番線に待避線を選びます。</p>
  <div class="btns"><button data-d="save" class="primary">${opsDh.idx >= 0 ? 'この回送を直す' : '回送を追加'}</button><button data-d="cancel">やめる</button></div><p id="dhmsg" class="hint"></p>`;
}
function opsDhFill() {   // 経路の上で通る駅を、隣り合う2駅のあいだに通過として入れる(時刻は距離で割り振る)
  const S = opsDh.x.stops, out = [S[0]];
  for (let i = 1; i < S.length; i++) {
    const a = S[i - 1], b = S[i];
    if (a.st && b.st && stByName.has(a.st) && stByName.has(b.st)) {
      let r = null; try { r = buildTimedRoute([a.st, b.st], [0, 0], {}); } catch (e) { r = null; }
      if (r) { const seen = new Set([a.st, b.st]), mids = [];
        for (const g of r.segs) { const si = edgeStation[g.e]; if (si < 0) continue; const nm = ST[si].name; if (seen.has(nm)) continue; seen.add(nm); mids.push({ st: nm, d: (g.d0 + g.d1) / 2 }); }
        const t0 = ttHMS(a.dep || a.arr), t1 = ttHMS(b.arr || b.dep);
        for (const m of mids) out.push({ st: m.st, pass: true, arr: t0 != null && t1 != null ? ttSHMS(t0 + (t1 - t0) * m.d / r.total) : '' }); }
    }
    out.push(b);
  }
  opsDh.x.stops = out;
}
function opsDhTime() {   // 空いている時刻を、前後の決まった時刻のあいだで均等に
  const S = opsDh.x.stops, tv = s => ttHMS(s.dep || s.arr);
  for (let i = 1; i < S.length - 1; i++) { if (tv(S[i]) != null) continue; let j = i - 1, k = i + 1; while (k < S.length && tv(S[k]) == null) k++; if (k >= S.length || tv(S[j]) == null) continue;
    const t0 = ttHMS(S[j].dep || S[j].arr), t1 = ttHMS(S[k].arr || S[k].dep); for (let q = i; q < k; q++) { const v = ttSHMS(t0 + (t1 - t0) * (q - j) / (k - j)); if (S[q].pass) S[q].arr = v; else { S[q].arr = v; S[q].dep = v; } } i = k; }
}
$('dhed').addEventListener('click', e => {
  const b = e.target.closest('button[data-d]'); if (!b) return; const k = b.dataset.d;
  if (k === 'new') { opsDhOpen({ no: '回送', cars: 8, stops: [{ st: '', dep: '' }, { st: '', arr: '' }] }, -1); return; }
  if (!opsDh) return;
  const tr = b.closest('tr[data-i]'), i = tr ? +tr.dataset.i : -1, S = opsDh.x.stops;
  if (k === 'add') S.splice(i + 1, 0, { st: '', pass: false, arr: '', dep: '' });
  else if (k === 'rm') S.splice(i, 1);
  else if (k === 'fill') opsDhFill();
  else if (k === 'time') opsDhTime();
  else if (k === 'cancel') { opsDh = null; opsHL(null); }
  else if (k === 'save') {
    const x = opsDh.x, bad = [];
    x.stops.forEach((s, j) => { if (!s.st) bad.push(`${j + 1}行目の駅`); const need = j === 0 ? [s.dep] : j === x.stops.length - 1 ? [s.arr] : s.pass ? [s.arr] : [s.arr || s.dep]; if (need.some(v => ttHMS(v) == null)) bad.push(`${s.st || j + 1 + '行目'}の時刻`); });
    if (bad.length) { $('dhmsg').textContent = '入っていない・形が違う: ' + bad.join('・') + '(時刻は 10:15 か 10:15:30)'; return; }
    x.cars = +x.cars || 8; x.from = x.stops[0].st; x.dep = x.stops[0].dep; x.to = x.stops[x.stops.length - 1].st; x.arr = x.stops[x.stops.length - 1].arr;
    const U = opsDayObj(); if (opsDh.idx >= 0 && U.dh[opsDh.idx]) U.dh[opsDh.idx] = x; else U.dh.push(x);
    opsDh = null; opsSave(); $('dhed').insertAdjacentHTML('beforeend', '<p class="hint">保存しました。「反映」で計算し直します</p>'); return;
  }
  opsDhRender();
});
$('dhed').addEventListener('change', e => {
  if (!opsDh) return; const s = e.target, x = opsDh.x;
  if (s.dataset.x) { const [g, f] = s.dataset.x.split('.'); if (f) { x[g] = Object.assign({}, x[g]); if (s.value === '') { if (f === 'mode') delete x[g]; else delete x[g][f]; } else x[g][f] = f === 'sd' ? +s.value : s.value; if (f === 'mode' && s.value === 'sd' && x[g].sd == null) { const sd = opsSidings(g === 'begin' ? x.stops[0].st : x.stops[x.stops.length - 1].st)[0]; if (sd) x[g].sd = sd.e; } } else x[g] = s.value; opsDhRender(); return; }
  const tr = s.closest('tr[data-i]'); if (!tr || !s.dataset.s) return; const st = x.stops[+tr.dataset.i], f = s.dataset.s;
  if (f === 'pass') st.pass = !!s.value; else if (f === 'plat') st.plat = s.value === '' ? '' : +s.value; else st[f] = s.value.trim();
  if (f === 'st' || f === 'pass') { if (f === 'st') st.plat = ''; opsDhRender(); }
});
$('dhed').addEventListener('focusin', e => { if (e.target.matches('select[data-hl]')) opsHL(e.target.value); });
$('dhed').addEventListener('input', e => { if (e.target.matches('select[data-hl]')) opsHL(e.target.value); });
// ===== 駅ごとの「消える・現れる」 =====
function opsCollect() {
  opsVan = new Map(); const g = s => opsVan.get(s) || (opsVan.set(s, { ends: [], starts: [] }), opsVan.get(s));
  for (const t of ttList) {
    if (!opsReal(t)) continue;
    if (!t.next && !t.exitEnd) g(opsLast(t)).ends.push(t);
    if (!t.prev && !t.exitStart) g(t.names[0]).starts.push(t);
  }
}
const opsSettled = (t, k) => k === 'a' ? !!(t.stay || t.vEnd) : !!(t.stay || t.vStart || t.formed);
function opsRender() {
  const box = $('opscard'); if (!box) return;
  const U = opsDayObj(), st = [...opsVan].map(([s, v]) => ({ s, e: v.ends.filter(t => !opsSettled(t, 'a')).length, d: v.starts.filter(t => !opsSettled(t, 'd')).length, ok: v.ends.filter(t => opsSettled(t, 'a')).length + v.starts.filter(t => opsSettled(t, 'd')).length })).filter(x => x.e + x.d + x.ok).sort((a, b) => (b.e + b.d) - (a.e + a.d));
  const tot = st.reduce((a, x) => [a[0] + x.e, a[1] + x.d, a[2] + x.ok], [0, 0, 0]);
  $('opsstat').innerHTML = ttDay ? `${ttDay === 'wd' ? '平日' : '土休日'}: <b class="${tot[0] + tot[1] ? 'opsng' : ''}">消える ${tot[0]} 本・現れる ${tot[1]} 本</b>(夜間留置・入出庫 ${tot[2]} 本は除く)` + (opsDirty ? '<br><b class="opswarn">反映していない編集があります。「反映」で計算し直します。</b>' : '') : '時刻表を選ぶと使えます';
  if (!opsStn || !opsVan.has(opsStn)) opsStn = st.length ? st[0].s : '';
  $('opsst').innerHTML = st.map(x => `<option value="${opsEsc(x.s)}"${x.s === opsStn ? ' selected' : ''}>${opsEsc(x.s)}　消${x.e}・現${x.d}${x.ok ? '・留置/入出庫' + x.ok : ''}</option>`).join('');
  const v = opsVan.get(opsStn) || { ends: [], starts: [] };
  const rows = [...v.ends.map(t => ({ t, k: 'a', m: opsArr(t) })), ...v.starts.map(t => ({ t, k: 'd', m: opsDep(t) }))].sort((a, b) => a.m - b.m);
  $('opsvan').innerHTML = rows.map((r, i) => { const t = r.t, on = (r.k === 'a' ? opsSelA : opsSelD) === t, ok = opsSettled(t, r.k);
    const where = r.k === 'a' ? `${t.names[0]}から` : `${opsLast(t)}行き`;
    const how = ok ? (r.k === 'a' ? opsEndTxt(t)[1] : opsBeginTxt(t)[1]) : '';
    return `<li class="${r.k === 'a' ? 'oa' : 'od'}${on ? ' on' : ''}${ok ? ' fine' : ''}" data-i="${i}"><span class="om">${hm(r.m)}</span><span class="ok">${ok ? (r.k === 'a' ? '終' : '始') : r.k === 'a' ? '消' : '現'}</span><span class="on2">${opsEsc(t.no)}</span><span class="ow">${opsEsc(opsTy(t))} ${t.cars || '?'}両 ${opsCo(t) ? opsEsc(opsCo(t)) + '車 ' : ''}${opsEsc(where)}${how ? ' ・' + opsEsc(how) : ''}${t.dh ? ' ・回送' : ''}</span><span class="ob"><button data-b="open" title="この列車の運用の設定を開く">開く</button></span></li>`; }).join('') || '<li class="hint">この駅に消える・現れる列車はありません</li>';
  $('opsvan').rows = rows;
  $('opslink').disabled = !(opsSelA && opsSelD);
  $('opslink').textContent = opsSelA && opsSelD ? `${opsSelA.no} → ${opsSelD.no} をつなぐ` + opsMark(opsSelA, opsSelD) : '消える1本と現れる1本を選んでつなぐ';
  opsDhSetRender();
  // 編集の一覧
  const L = [];
  U.link.forEach((x, i) => L.push(`<li><span>${x.auto ? '<i>案</i> ' : ''}つなぐ ${opsEsc(x.a)} → ${opsEsc(x.d)}(${opsEsc(x.st)})</span><button data-x="link:${i}">✕</button></li>`));
  U.cut.forEach((x, i) => L.push(`<li><span>切る ${opsEsc(x.a)} のあと${x.d ? '(' + opsEsc(x.d) + ' へつながない)' : ''}(${opsEsc(x.st)})</span><button data-x="cut:${i}">✕</button></li>`));
  U.dh.forEach((x, i) => { const S = x.stops || [{ st: x.from, dep: x.dep }, { st: x.to, arr: x.arr }]; L.push(`<li><span>回送 ${opsEsc(x.no)} ${opsEsc(S[0].st)} ${opsEsc(S[0].dep)} → ${opsEsc(S[S.length - 1].st)} ${opsEsc(S[S.length - 1].arr)} ${x.cars}両${S.length > 2 ? '(' + (S.length - 2) + '駅経由)' : ''}${x.prev ? ' 前:' + opsEsc(x.prev) : ''}${x.next ? ' 次:' + opsEsc(x.next) : ''}</span><button data-e="${i}">直す</button><button data-x="dh:${i}">✕</button></li>`); });
  U.del.forEach((x, i) => L.push(`<li><span>自動の回送を消す ${opsEsc(x.no)}(${opsEsc(x.from)} ${opsEsc(x.dep)}発)</span><button data-x="del:${i}">✕</button></li>`));
  const lab = { plat: '番線', turn: '折り返し', fin: '1日の終わり', begin: '1日の始まり', wait: '通過待ち' }, mode = { plat: 'ホーム', sd: '留置線', depot: '入出庫' };
  for (const [k, o] of Object.entries(U.train)) { const [no, s0, m] = k.split('@'); const parts = Object.keys(o).filter(p => lab[p]).map(p => lab[p] + (o[p] && o[p].mode ? ':' + mode[o[p].mode] : p === 'plat' ? ':' + Object.keys(o.plat).join('・') : ''));
    L.push(`<li><span>${o.auto || (o.fin && o.fin.auto) || (o.begin && o.begin.auto) || (o.turn && o.turn.auto) ? '<i>案</i> ' : ''}${opsEsc(no)}(${opsEsc(s0)} ${hm(+m)}発) ${opsEsc(parts.join('、'))}</span><button data-go="${opsEsc(k)}">開く</button><button data-t="${opsEsc(k)}">✕</button></li>`); }
  $('opsedits').innerHTML = L.join('') || '<li class="hint">まだ編集はありません</li>';
  const ms = ttList.length ? ttUserCheck(ttList) : [];
  $('opsmsg').innerHTML = ms.length ? `<details${ms.length < 8 ? ' open' : ''}><summary class="opswarn">反映できなかった・ぶつかっている編集 ${ms.length} 件</summary>${ms.map(s => `<div class="opswarn">${opsEsc(s)}</div>`).join('')}</details>` : '';
  if (!opsDh && !$('dhed').innerHTML) opsDhRender();
}
// 案を作る: 消える列車を、同じ駅で後から出る同じ所属の列車につなぐ(4時間以内・着いた順)。そのあいだホームが空いていればホームで、
// 空いていなければ空いている引上線で折り返す。どちらも空かなければつながない。残りは車庫のある駅なら入出庫、朝・夜は空いている線で夜間留置
// 空きは計画で押さえた時間帯(ttRes)と、この案で決めた分を見る
function opsPropose(stations) {
  const U = opsDayObj(); let nl = 0, nf = 0, nb = 0, nsd = 0;
  const add = new Map(), mine = new Set();
  const free = (e, a, b, x, y) => e != null && !(ttRes && ttRes.get(e) || []).some(r => r[0] < b && a < r[1] && r[2] !== x && r[2] !== y && !(r[2] && (r[2].prev === x || r[2].next === y))) && !(add.get(e) || []).some(r => r[0] < b && a < r[1]);
  const take = (e, a, b) => { if (!add.has(e)) add.set(e, []); add.get(e).push([a, b]); };
  const setT = (t, g, v) => { if (t.user) { if (!t.user[g]) t.user[g] = v; return true; } const k = ttUKey(t), o = U.train[k] || { no: t.no }; if (o[g]) return false; o[g] = v; U.train[k] = o; return true; };
  const lastE = t => t.route ? t.route.stopE[t.names.length - 1] : null, firstE = t => t.route ? t.route.stopE[0] : null;
  const S0 = 4 * 3600, S1 = 26 * 3600;
  for (const st of stations) {
    const v = opsVan.get(st); if (!v) continue;
    const ends = v.ends.filter(t => !opsSettled(t, 'a')).sort((a, b) => opsArr(a) - opsArr(b)), starts = v.starts.filter(t => !opsSettled(t, 'd')).sort((a, b) => opsDep(a) - opsDep(b)), used = new Set();
    const minTurn = noRev(st) ? SHINA_TURN : 2, sds = opsSidings(st);
    for (const a of ends) {
      const ta = opsArr(a), A = a.A[a.A.length - 1] || ta * 60, e = lastE(a); let done = false;
      for (const d of starts.filter(d => !used.has(d) && opsDep(d) >= ta + minTurn && opsDep(d) - ta <= 240 && opsCo(d) === opsCo(a)).slice(0, 6)) {
        const D = opsDep(d) * 60;
        if (!noRev(st) && free(e, A - 5, D + 5, a, d)) { take(e, A - 5, D + 5); }
        else { const sd = sds.find(sd => free(sd.e, A + 40, D - 50, a, d)); if (!sd || D - A < 360) continue; take(sd.e, A + 40, D - 50); setT(a, 'turn', { mode: 'sd', sd: sd.e, auto: 1 }); nsd++; }
        used.add(d); U.link.push({ a: a.no, d: d.no, st, auto: 1 }); nl++; done = true; break;
      }
      if (done) continue;
      if (DEPOT_NAME[st]) { if (setT(a, 'fin', { mode: 'depot', auto: 1 })) nf++; continue; }
      if (ta < 21 * 60) continue;
      if (free(e, A - 5, S1, a, null)) { take(e, A - 5, S1); if (setT(a, 'fin', { mode: 'plat', auto: 1 })) nf++; continue; }
      const sd = sds.find(sd => free(sd.e, A + 40, S1, a, null)); if (sd) { take(sd.e, A + 40, S1); if (setT(a, 'fin', { mode: 'sd', sd: sd.e, auto: 1 })) nf++; }
    }
    for (const d of starts) {
      if (used.has(d)) continue;
      const D = opsDep(d) * 60, e = firstE(d);
      if (DEPOT_NAME[st]) { if (setT(d, 'begin', { mode: 'depot', auto: 1 })) nb++; continue; }
      if (opsDep(d) > 9 * 60) continue;
      if (free(e, S0, D + 5, d, null)) { take(e, S0, D + 5); if (setT(d, 'begin', { mode: 'plat', auto: 1 })) nb++; continue; }
      const sd = sds.find(sd => free(sd.e, S0, D - 50, d, null)); if (sd) { take(sd.e, S0, D - 50); if (setT(d, 'begin', { mode: 'sd', sd: sd.e, auto: 1 })) nb++; }
    }
  }
  opsSave();
  return `案: つなぐ ${nl}(うち引上線で折り返し ${nsd})・終わりの扱い ${nf}・始まりの扱い ${nb}。「反映」で計算し直します(案は編集の一覧に「案」と出ます。番線が空かないものは案にしていません)`;
}
function opsDropAuto() {
  const U = opsDayObj(); U.link = U.link.filter(x => !x.auto);
  for (const [k, o] of Object.entries(U.train)) { for (const g of ['fin', 'begin', 'turn']) if (o[g] && o[g].auto) delete o[g]; if (!Object.keys(o).some(p => p !== 'no')) delete U.train[k]; }
  opsSave();
}
function opsRefresh() { opsCollect(); if (opsSelA && !ttList.includes(opsSelA)) opsSelA = null; if (opsSelD && !ttList.includes(opsSelD)) opsSelD = null; opsRender(); if (ttSel && ttList.includes(ttSel)) opsTrainPanel(ttSel); }
function opsJump(m) { ttClock = Math.max(0, m * 60 - 90); $('ttime').value = Math.floor(ttClock / 60); if (typeof ttUpdate === 'function') ttUpdate(); }
$('opsst').onchange = () => { opsStn = $('opsst').value; opsRender(); };
$('opsvan').addEventListener('click', e => {
  const li = e.target.closest('li[data-i]'); if (!li) return; const r = $('opsvan').rows[+li.dataset.i]; if (!r) return;
  const b = e.target.closest('button[data-b]');
  if (b && b.dataset.b === 'open') { opsGoKey(ttUKey(r.t)); return; }
  if (r.k === 'a') opsSelA = opsSelA === r.t ? null : r.t; else opsSelD = opsSelD === r.t ? null : r.t;
  opsRender();
});
$('opslink').onclick = () => { if (!opsSelA || !opsSelD) return; const a = opsSelA, d = opsSelD; opsSelA = opsSelD = null; opsLinkSet(a, d); };
$('opsprop').onclick = () => { $('opspmsg').textContent = opsPropose([opsStn]); };
$('opspropall').onclick = () => { $('opspmsg').textContent = opsPropose([...opsVan.keys()]); };
$('opspropdel').onclick = () => { opsDropAuto(); $('opspmsg').textContent = '案を消しました。「反映」で計算し直します'; };
$('opsedits').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return; const U = opsDayObj();
  if (b.dataset.x) { const [k, i] = b.dataset.x.split(':'); U[k].splice(+i, 1); opsSave(); }
  else if (b.dataset.e != null) { opsDhOpen(JSON.parse(JSON.stringify(U.dh[+b.dataset.e])), +b.dataset.e); }
  else if (b.dataset.t) { delete U.train[b.dataset.t]; opsSave(); }
  else if (b.dataset.go) opsGoKey(b.dataset.go);
});
$('opsapply').onclick = () => { opsDirty = false; ttLoad(ttDay); };
$('opsexp').onclick = () => {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(USER_OPS, null, 1)], { type: 'application/json' }));
  a.download = 'ops_user.json'; a.click(); $('opspmsg').textContent = 'ops_user.json を書き出しました(ダウンロード)';
};
$('opsimp').onclick = () => $('opsfile').click();
$('opsfile').onchange = () => { const f = $('opsfile').files[0]; if (!f) return; f.text().then(s => { try { USER_OPS = JSON.parse(s); opsSave(); $('opspmsg').textContent = f.name + ' を読み込みました。「反映」で計算し直します'; } catch (e) { $('opspmsg').textContent = '読み込めませんでした: ' + e.message; } }); $('opsfile').value = ''; };
$('opsclr').onclick = () => {
  if (Date.now() - opsClr > 3000) { opsClr = Date.now(); $('opsclr').textContent = 'もう一度押すと消します'; setTimeout(() => { $('opsclr').textContent = 'ブラウザの編集を消す'; }, 3000); return; }
  try { localStorage.removeItem('kq-opsuser'); } catch (e) { } USER_OPS = JSON.parse(JSON.stringify(USER_OPS_FILE || {})); $('opsclr').textContent = 'ブラウザの編集を消す'; opsSave();
};
opsDhRender();
// ===== 回送をセットで足す =====
// 駅で消える列車・現れる列車から、車庫・留置線のある駅との回送を作る: 往復してつなぐ(消 → 回送で行って折り返す → 回送で戻る → 現)、入庫(消 → 回送 → 車庫)、出庫(車庫 → 回送 → 現)
// 走る時間は、時刻表でその2駅を走る列車のいちばん速い時間(停車を含む)。編集の一覧の「直す」で駅・時刻・番線を細かく直せる
const opsRunMemo = new Map();
function opsRun(a, b) {   // 秒(見つからなければ null)
  const k = a + '|' + b; if (opsRunMemo.has(k)) return opsRunMemo.get(k); let best = null;
  for (const t of ttList) { if (t.dh || !t.names) continue; const i = t.names.indexOf(a), j = t.names.indexOf(b); if (i < 0 || j < 0 || i >= j) continue;
    const e0 = t.ev[i], e1 = t.ev[j], d = (e1.as != null ? e1.as : e1.arr * 60) - (e0.ds != null ? e0.ds : e0.dep * 60); if (d > 0 && (best == null || d < best)) best = d; }
  opsRunMemo.set(k, best); return best;
}
// 時刻表に p → s → x の順に止まる列車があるか(x が、p から s へ来た向きの先にある)
const opsOrdMemo = new Map();
function opsInOrder(p, s, x) { if (!p || !x) return true; const k = p + '|' + s + '|' + x; if (opsOrdMemo.has(k)) return opsOrdMemo.get(k);
  const v = ttList.some(t => { if (!t.names) return false; const i = t.names.indexOf(p), j = t.names.indexOf(s), m = t.names.indexOf(x); return i >= 0 && j > i && m > j; }); opsOrdMemo.set(k, v); return v; }
function opsDhSpots(st, a, d) {   // 回送で行ける車庫・留置線のある駅。着いた向きのまま行ける(a)・出る向きのまま戻れる(d)駅を先に、その中で車庫のある駅、近い順
  const L = [], pa = a && a.names[a.names.length - 2], nd = d && d.names[1];
  for (const x of new Set([...Object.keys(DEPOT_NAME), ...SIDINGS.keys()])) { if (x === st || !stByName.has(x)) continue; const go = opsRun(st, x), back = opsRun(x, st); if (go == null || back == null || Math.max(go, back) > 45 * 60) continue;
    const rev = (a && !opsInOrder(pa, st, x)) || (d && !opsInOrder(x, st, nd));   // st で向きを変えることになる
    L.push({ st: x, go, back, depot: !!DEPOT_NAME[x], rev }); }
  return L.sort((p, q) => (p.rev - q.rev) || (q.depot - p.depot) || ((p.go + p.back) - (q.go + q.back))).slice(0, 10);
}
const DH_DWELL = 180, DH_TURN = 240;   // 着いてから回送で出るまで・回送が着いてから次の列車が出るまで(秒)、折り返す駅で止まっている最短(秒)
function opsDhNo(base, U) { let no = base + '回'; for (let i = 2; U.dh.some(x => x.no === no); i++) no = base + '回' + i; return no; }
function opsDhSetRender() {
  const box = $('opsdhset'); if (!box) return; const a = opsSelA, d = opsSelD, st = opsStn;
  if (!a && !d) { box.innerHTML = '<p class="hint">消・現を選ぶと、車庫・留置線のある駅との回送をセットで足せます(往復してつなぐ・入庫・出庫)。</p>'; return; }
  const sp = opsDhSpots(st, a, d), mm = s => Math.round(s / 60) + '分', rv = x => x.rev ? `(${st}で向きを変える)` : '';
  let opts = [], what = '';
  if (a && d) { const gap = (opsDep(d) - opsArr(a)) * 60; what = `${a.no} → 回送で往復 → ${d.no}(あいだ ${mm(gap)})`;
    opts = sp.filter(x => DH_DWELL * 2 + x.go + x.back + DH_TURN <= gap).map(x => ({ v: x.st, l: `${x.st}${x.depot ? '(' + DEPOT_NAME[x.st] + ')' : ''} 行き${mm(x.go)}・帰り${mm(x.back)}・そこで${mm(gap - DH_DWELL * 2 - x.go - x.back)}${rv(x)}` })); }
  else if (a) { what = `${a.no}(${opsLast(a)} ${hm(opsArr(a))}着)のあと回送で入庫`; opts = sp.map(x => ({ v: x.st, l: `${x.st}${x.depot ? '(' + DEPOT_NAME[x.st] + ')' : ''} ${mm(x.go)}${rv(x)}` })); }
  else { what = `回送で出庫して ${d.no}(${d.names[0]} ${hm(opsDep(d))}発)`; opts = sp.map(x => ({ v: x.st, l: `${x.st}${x.depot ? '(' + DEPOT_NAME[x.st] + ')' : ''} ${mm(x.back)}${rv(x)}` })); }
  box.innerHTML = `<div class="opsform"><label>${opsEsc(what)}<select id="opsdhsp">${opts.map(o => `<option value="${opsEsc(o.v)}">${opsEsc(o.l)}</option>`).join('') || '<option value="">回送で行ける車庫・留置線の駅がありません(時間が足りない)</option>'}</select></label></div>`
    + `<div class="btns"><button id="opsdhgo"${opts.length ? '' : ' disabled'}>${a && d ? '回送で往復してつなぐ' : a ? '回送で入庫する' : '回送で出庫する'}</button></div>`;
  $('opsdhgo').onclick = () => { const x = $('opsdhsp').value; if (x) opsDhSet(a, d, x); };
}
function opsDhSet(a, d, X, st0) {   // 回送を作って保存する(st0 = 消える・現れる駅。省略すると選んでいる駅)
  const U = opsDayObj(), st = st0 || opsStn, go = opsRun(st, X), back = opsRun(X, st), add = [];
  const mk = (no, from, dep, to, arr, cars) => ({ no, cars, stops: [{ st: from, dep: ttSHMS(dep) }, { st: to, arr: ttSHMS(arr) }], from, dep: ttSHMS(dep), to, arr: ttSHMS(arr) });
  if (a) { const dep = opsArr(a) * 60 + DH_DWELL, x = mk(opsDhNo(a.no, U), st, dep, X, dep + go, a.cars || 8); x.prev = a.no; add.push(x); }
  if (d) { const arr = opsDep(d) * 60 - DH_DWELL, x = mk(opsDhNo(d.no, U), X, arr - back, st, arr, d.cars || (a && a.cars) || 8); x.next = d.no; add.push(x); }
  if (a && d) { add[0].next = add[1].no; add[1].prev = add[0].no; }   // 行きと帰りをつなぐ(折り返し方は自動。直すで車庫線・時刻を決められる)
  else if (a) add[0].fin = DEPOT_NAME[X] ? { mode: 'depot' } : { mode: 'sd', sd: (opsSidings(X)[0] || {}).e };
  else add[0].begin = DEPOT_NAME[X] ? { mode: 'depot' } : { mode: 'sd', sd: (opsSidings(X)[0] || {}).e };
  U.dh.push(...add); opsSelA = opsSelD = null; opsSave();
  $('opspmsg').textContent = `回送を足しました: ${add.map(x => `${x.no} ${x.from} ${x.dep.slice(0, 5)} → ${x.to} ${x.arr.slice(0, 5)}`).join('、')}。「反映」で計算し直します(時刻・番線は編集の一覧の「直す」で直せます)`;
}
// ===== 番線使用図 =====
// 駅の線(ホーム・待避線・引上線・留置線)ごとに、計画で押さえた時間帯(ttRes)を帯で出す。同じ線を同時に使っている帯(縦列・ぶつかり)は赤
// 帯を押すと、その列車の運用の設定を開いて時計をその時刻へ。線の名前に乗せると図の上で光る。探すのは人、ここは見る道具だけ
let occSt = '', occT0 = 7 * 3600, occW = 7200, occCnt = null, occCntRes = null, occGeo = null;
// 図に出す駅: 時刻表の駅に、時刻表に無い駅(根古屋信号場など、ホームの無い行き違い場所)を、図の上でいちばん近い駅のあとに足す
const OCC_STNS = (() => { const L = STN_NAMES.slice();
  for (const s of ST) { if (L.includes(s.name) || !s.stops || !s.stops.length) continue;
    let k = -1, bd = Infinity; L.forEach((n, i) => { const o = stByName.get(n); if (!o || o.row !== s.row) return; const d = Math.abs(o.cx - s.cx); if (d < bd) { bd = d; k = i; } });
    L.splice(k + 1, 0, s.name); }
  return L; })();
function occRows(st) {
  const seen = new Set(), R = [];
  for (const x of opsTracks(st)) if (!seen.has(x.e)) { seen.add(x.e); R.push({ e: x.e, label: x.label }); }
  for (const sd of opsSidings(st)) if (!seen.has(sd.e)) { seen.add(sd.e); R.push({ e: sd.e, label: sd.label || '引上線・留置線', sd: 1 }); }
  return R;
}
function occBars(e) {   // 帯の一覧(本予約だけ)。ov = ほかの帯と時間が重なっている
  const L = (ttRes && ttRes.get(e) || []).filter(r => !r[3] && r[1] > r[0]).map(r => ({ a: r[0], b: r[1], t: r[2], ov: [] })).sort((x, y) => x.a - y.a || x.b - y.b);
  const same = (x, y) => x === y || !x || !y || x.next === y || y.next === x || x.prev === y || y.prev === x || x.unit === y || y.unit === x || (x.no && x.no === y.no);   // 同じ車両(折り返し・増結・途中で分けた列車)は重なりにしない
  for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length && L[j].a < L[i].b - 5; j++) if (!same(L[i].t, L[j].t)) { L[i].ov.push(L[j]); L[j].ov.push(L[i]); }
  return L;
}
function occCount() {   // 駅ごとの、時間が重なっている帯の数(終日)。駅を選ぶ欄に出す
  if (occCnt && occCntRes === ttRes) return occCnt;
  occCnt = new Map(); occCntRes = ttRes; if (!ttRes) return occCnt;
  for (const st of OCC_STNS) { let n = 0; for (const r of occRows(st)) n += occBars(r.e).filter(b => b.ov.length).length; occCnt.set(st, n); }
  return occCnt;
}
const occName = t => t ? (t.no || '?') + (t.dh ? '(回)' : '') : '?';
function occRender() {
  const box = $('occ'); if (!box || box.hidden) return;
  const C = occCount();
  if (!occSt || !OCC_STNS.includes(occSt)) occSt = opsStn || OCC_STNS[0] || '';
  $('occst').innerHTML = OCC_STNS.map(s => `<option value="${opsEsc(s)}"${s === occSt ? ' selected' : ''}>${opsEsc(s)}${C.get(s) ? ' ・重なり ' + C.get(s) : ''}</option>`).join('');
  $('occw').value = String(occW);
  if (!ttRes) { $('occbody').innerHTML = '<p class="hint">時刻表を読み込むと出ます</p>'; $('occinfo').textContent = ''; return; }
  const rows = occRows(occSt), t0 = occT0, t1 = occT0 + occW;
  const W = Math.max(700, $('occbody').clientWidth - 24), LW = 150, PW = W - LW, X = s => LW + (s - t0) / occW * PW, LH = 15, HEAD = 18;
  const sel = ttSel; let y = HEAD, body = '', nov = 0, nin = 0; occGeo = [];
  for (const r of rows) {
    const all = occBars(r.e), B = all.filter(b => b.b > t0 && b.a < t1); nov += all.filter(b => b.ov.length).length; nin += B.length;
    const lanes = []; for (const b of B) { let k = lanes.findIndex(end => end <= b.a); if (k < 0) { k = lanes.length; lanes.push(0); } lanes[k] = b.b; b.lane = k; }
    const h = Math.max(1, lanes.length) * LH + 6;
    body += `<g class="occ-row" data-e="${r.e}"><rect class="occ-rb" x="0" y="${y}" width="${W}" height="${h}"></rect><text class="occ-l${r.sd ? ' sd' : ''}" x="4" y="${y + 13}">${opsEsc(r.label)}</text><line class="occ-g h" x1="0" x2="${W}" y1="${y + h}" y2="${y + h}"></line>`;
    for (const b of B) {
      const xa = Math.max(LW, X(b.a)), xb = Math.min(W, X(b.b)), yy = y + 3 + b.lane * LH, i = occGeo.length; occGeo.push(b);
      const cls = ['occ-b', b.ov.length ? 'ov' : '', b.t && b.t.dh ? 'dh' : '', b.t && b.t.stay ? 'stay' : '', b.t && sel && (b.t === sel || b.t.no === sel.no) ? 'sel' : ''].filter(Boolean).join(' ');
      const tip = `${occName(b.t)} ${b.t && b.t.names ? b.t.names[0] + '→' + b.t.names[b.t.names.length - 1] : ''} ${ttSHMS(b.a)}〜${ttSHMS(b.b)}` + (b.ov.length ? `\n同時に使っている: ${b.ov.map(o => occName(o.t) + ' ' + ttSHMS(o.a) + '〜' + ttSHMS(o.b)).join('、')}` : '');
      body += `<g class="${cls}" data-i="${i}"><title>${opsEsc(tip)}</title><rect x="${xa}" y="${yy}" width="${Math.max(2, xb - xa)}" height="${LH - 2}" rx="3"></rect>${xb - xa > 30 ? `<text x="${xa + 3}" y="${yy + 10}">${opsEsc(occName(b.t))}</text>` : ''}</g>`;
    }
    body += '</g>'; y += h;
  }
  const step = occW <= 3600 ? 300 : occW <= 14400 ? 600 : 3600, lab = occW <= 14400 ? 1800 : 3600; let grid = '';
  for (let s = Math.ceil(t0 / step) * step; s <= t1; s += step) { const x = X(s), big = s % lab === 0; grid += `<line class="occ-g${big ? ' h' : ''}" x1="${x}" x2="${x}" y1="${HEAD - 4}" y2="${y}"></line>` + (big ? `<text class="occ-tx" x="${x + 2}" y="12">${ttSHMS(s).slice(0, 5)}</text>` : ''); }
  $('occbody').innerHTML = `<svg width="${W}" height="${y + 4}" viewBox="0 0 ${W} ${y + 4}">${grid}${body}<line id="occnowl" class="occ-now" x1="0" x2="0" y1="${HEAD - 4}" y2="${y}"></line></svg>`;
  occGeo.X = X; occGeo.t0 = t0; occGeo.t1 = t1; occNowLine();
  $('occinfo').textContent = `${ttSHMS(t0).slice(0, 5)}〜${ttSHMS(t1).slice(0, 5)}: ${nin} 本 ・ この駅の重なり(終日) ${nov} 本` + (rows.length ? '' : ' ・この駅には線がありません');
}
function occNowLine() { const l = $('occnowl'); if (!l || !occGeo) return; const on = ttClock >= occGeo.t0 && ttClock <= occGeo.t1, x = on ? occGeo.X(ttClock) : -10; l.setAttribute('x1', x); l.setAttribute('x2', x); }
function occOpen(st, at) { if (st) occSt = st; if (at != null) occT0 = Math.max(0, Math.floor((at - occW / 4) / 600) * 600); opsDockShow('occ'); }
$('occopen').onclick = () => occOpen(opsStn || (ttSel && ttSel.names && ttSel.names[0]), occW >= 79200 ? null : ttClock);
$('occclose').onclick = () => { opsDockShow('edit'); opsHL(null); };
$('occst').onchange = () => { occSt = $('occst').value; occRender(); };
$('occw').onchange = () => { occW = +$('occw').value; if (occW >= 79200) occT0 = 4 * 3600; else occT0 = Math.max(0, Math.floor((ttClock - occW / 4) / 600) * 600); occRender(); };
$('occprev').onclick = () => { occT0 = Math.max(0, occT0 - occW / 2); occRender(); };
$('occnext').onclick = () => { occT0 = Math.min(26 * 3600, occT0 + occW / 2); occRender(); };
$('occnow').onclick = () => { occT0 = Math.max(0, Math.floor((ttClock - occW / 4) / 600) * 600); occRender(); };
$('occstn').onclick = () => { const s = ttSel && ttSel.names; if (!s) return; const i = s.indexOf(occSt); occSt = s[(i + 1) % s.length]; occRender(); };
$('occbody').addEventListener('click', e => {
  const g = e.target.closest('g.occ-b'); if (!g || !occGeo) return; const b = occGeo[+g.dataset.i]; if (!b || !b.t) return;
  opsDockShow('edit'); opsGoKey(ttUKey(b.t)); opsJump(Math.floor(b.a / 60) + 1);
});
$('occbody').addEventListener('mouseover', e => { const r = e.target.closest('g.occ-row'); opsHL(r ? r.dataset.e : null); });
$('occbody').addEventListener('mouseleave', () => opsHL(null));
setInterval(() => { if (!$('occ').hidden) occNowLine(); }, 1000);
{ const f = opsRefresh; opsRefresh = function () { opsRunMemo.clear(); opsOrdMemo.clear(); f(); occCnt = null; occRender(); }; }
{ const f = opsTrainPanel; opsTrainPanel = function (t) { const r = f.apply(this, arguments); if (!$('occ').hidden) occRender(); return r; }; }

// ===== 編集画面(画面の下に広げる) =====
// 地図の下に出して、地図は縮むだけ(隠さない)。タブ: 編集(駅・列車・回送・編集の一覧の4列) / 番線使用図。上の縁をドラッグで高さを変える。開いているか・高さはこのブラウザに覚える
$('opstrainbox').prepend($('opstrain'));
const opsLS = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } };
function opsDockShow(tab) {
  const d = $('opsdock'), was = !d.hidden; d.hidden = false; opsLS('kq-dock', '1'); $('opsdockbtn').classList.add('on');
  if (tab) { $('dockedit').hidden = tab !== 'edit'; $('occ').hidden = tab !== 'occ'; $('dtabedit').classList.toggle('on', tab === 'edit'); $('occopen').classList.toggle('on', tab === 'occ'); }
  if (!$('occ').hidden) occRender(); else opsRender();
  if (!was && ttSel && ttList.includes(ttSel)) opsTrainPanel(ttSel);
  if (!was) window.dispatchEvent(new Event('resize'));
}
function opsDockHide() { $('opsdock').hidden = true; opsLS('kq-dock', '0'); $('opsdockbtn').classList.remove('on'); opsHL(null); window.dispatchEvent(new Event('resize')); }
$('opsdockbtn').onclick = () => $('opsdock').hidden ? opsDockShow() : opsDockHide();
$('opsdockopen').onclick = () => opsDockShow('edit');
$('opsdockclose').onclick = opsDockHide;
$('dtabedit').onclick = () => opsDockShow('edit');
{ const h = +opsLS('kq-dockh'); if (h >= 160) $('opsdock').style.setProperty('--dockh', h + 'px'); }
$('dockgrip').addEventListener('pointerdown', e => {
  const d = $('opsdock'), y0 = e.clientY, h0 = d.getBoundingClientRect().height; e.preventDefault(); $('dockgrip').setPointerCapture(e.pointerId);
  const mv = ev => { const h = Math.max(160, Math.min(window.innerHeight * 0.85, h0 + y0 - ev.clientY)); d.style.setProperty('--dockh', Math.round(h) + 'px'); };
  const up = () => { $('dockgrip').removeEventListener('pointermove', mv); $('dockgrip').removeEventListener('pointerup', up); opsLS('kq-dockh', Math.round(d.getBoundingClientRect().height)); window.dispatchEvent(new Event('resize')); if (!$('occ').hidden) occRender(); };
  $('dockgrip').addEventListener('pointermove', mv); $('dockgrip').addEventListener('pointerup', up);
});
if (opsLS('kq-dock') === '1') opsDockShow('edit');

// ===== まとめて(駅ごとの時間・列車の番線を一括で変える) =====
// 駅の時間は USER_OPS.stn(平日・土休日とも。ttcore.js の ttStn が読む)、列車の番線は その日の U.train[キー].plat
const BK_KQ = new Set([...MAINL, ...BRANCH.split(' '), ...AIRPORT.trim().split(' '), '羽田空港第3ターミナル', '羽田空港第1・第2ターミナル']);
const BK_TOEI = new Set(ASAL.filter(n => n !== '泉岳寺'));
const bkGroup = st => BK_KQ.has(st) ? 'kq' : BK_TOEI.has(st) ? 'toei' : 'ks';
const BK_K = [['in', '始発がホームに着く', '発車の何分前'], ['out', '終着の列車がホームを出る', '着いて何分後'], ['turn', '折り返しの最短', '分']];
let bkSel = new Set(), bkQ = '', bkHit = [];
function bkCounts() {
  const c = new Map(); const g = st => { if (!c.has(st)) c.set(st, { o: 0, z: 0 }); return c.get(st); };
  for (const t of ttList) { if (!opsReal(t) || t.dh) continue; g(t.names[0]).o++; g(opsLast(t)).z++; }
  return c;
}
const bkStnObj = () => { if (!USER_OPS.stn) USER_OPS.stn = {}; return USER_OPS.stn; };
function bkSetVal(st, k, v) {
  const S = bkStnObj(); v = String(v == null ? '' : v).trim();
  if (v === '' || isNaN(+v)) { if (S[st]) { delete S[st][k]; if (!Object.keys(S[st]).length) delete S[st]; } }
  else { S[st] = Object.assign({}, S[st], { [k]: Math.max(0, +v) }); }
}
const bkFmt = v => v == null || v === '' ? '' : String(v);
function bkStations() {
  const C = bkCounts(), all = [...new Set([...STN_NAMES])];
  return all.filter(st => stByName.has(st)).map(st => ({ st, c: C.get(st) || { o: 0, z: 0 }, g: bkGroup(st) }));
}
function bulkRender() {
  const box = $('dockbulk'); if (!box || box.hidden) return;
  const S = USER_OPS.stn || {}, A = S._all || {}, L = bkStations().filter(x => !bkQ || x.st.includes(bkQ));
  const inp = (st, k, v, ph) => `<input class="bkv" data-st="${opsEsc(st)}" data-k="${k}" value="${opsEsc(bkFmt(v))}" placeholder="${opsEsc(ph)}" inputmode="decimal" aria-label="${opsEsc(st)} ${k}">`;
  const def = { in: '0.4', out: '0.4', turn: '3' };
  const rows = L.map(({ st, c }) => { const o = S[st] || {}; return `<tr><td><input type="checkbox" class="bkck" data-st="${opsEsc(st)}"${bkSel.has(st) ? ' checked' : ''}></td><td>${opsEsc(st)}</td><td class="n">${c.o || ''}</td><td class="n">${c.z || ''}</td>${BK_K.map(([k]) => `<td>${inp(st, k, o[k], bkFmt(A[k]) || def[k])}</td>`).join('')}</tr>`; }).join('');
  const day = ttDay === 'hd' ? '土休日' : '平日';
  const tySet = [...new Set(ttList.filter(opsReal).map(t => t.type))];
  box.innerHTML = `<div class="bkwrap">
  <section class="bkcol"><h3 class="dh">駅ごとの時間(平日・土休日とも)</h3>
    <p class="hint">単位は分(0.5 = 30秒)。空欄の駅は「全駅の基準」の値、基準も空欄ならいつもの値(始発は発車の25秒前に着く・終着は25秒でホームを出る(引上線・車庫へは40秒)・折り返しは3分以上)。変えたら「反映(計算し直す)」。</p>
    <div class="bkbar"><span>選ぶ:</span><button data-bk="all">全部</button><button data-bk="kq">京急</button><button data-bk="toei">都営</button><button data-bk="ks">京成・北総・芝山</button><button data-bk="o">始発のある駅</button><button data-bk="z">終着のある駅</button><button data-bk="none">外す</button><input id="bkq" placeholder="駅名で絞る" value="${opsEsc(bkQ)}" style="width:9em"></div>
    <div class="bkbar"><span>選んだ <b>${bkSel.size}</b> 駅に:</span>${BK_K.map(([k, nm, u]) => `<label>${nm} <input id="bkset-${k}" inputmode="decimal" style="width:4em"> ${u}</label>`).join('')}<button data-bk="put" class="primary">入れる</button><button data-bk="clear">空欄に戻す</button></div>
    <div class="bktw"><table class="bkt"><thead><tr><th></th><th>駅</th><th title="この日の始発の本数">始発</th><th title="この日の終着の本数">終着</th>${BK_K.map(([, nm, u]) => `<th>${nm}<br><small>${u}</small></th>`).join('')}</tr></thead>
    <tbody><tr class="bkall"><td></td><td><b>全駅の基準</b></td><td></td><td></td>${BK_K.map(([k]) => `<td>${inp('_all', k, A[k], def[k])}</td>`).join('')}</tr>${rows}</tbody></table></div>
  </section>
  <section class="bkcol"><h3 class="dh">列車の番線をまとめて(${day})</h3>
    <div class="bkbar"><label>駅 <select id="bkst">${STN_NAMES.map(s => `<option${s === (bkHit.st || opsStn) ? ' selected' : ''}>${opsEsc(s)}</option>`).join('')}</select></label>
      <label>扱い <select id="bkkind"><option value="o">始発</option><option value="z">終着</option><option value="s">止まる列車</option><option value="a">通過も含む</option></select></label>
      <label>時刻 <input id="bkt0" value="${opsEsc(bkHit.t0 || '04:00')}" style="width:4.5em">〜<input id="bkt1" value="${opsEsc(bkHit.t1 || '26:00')}" style="width:4.5em"></label>
      <label>種別 <select id="bkty"><option value="">全部</option>${tySet.map(y => `<option value="${opsEsc(y)}">${opsEsc((TYPES[y] || { name: y }).name)}</option>`).join('')}</select></label>
      <label>次の駅 <input id="bknx" placeholder="(空欄=全部)" style="width:7em"></label><button data-bk="find" class="primary">探す</button></div>
    <div id="bkres">${bkResHTML()}</div>
  </section></div>`;
  if (bkHit.kind) $('bkkind').value = bkHit.kind; if (bkHit.ty != null) $('bkty').value = bkHit.ty; if (bkHit.nx) $('bknx').value = bkHit.nx;
}
function bkResHTML() {
  if (!bkHit.list) return '<p class="hint">駅・扱い・時刻・種別で列車を探して、選んだ列車の番線をまとめて指定します(その駅で使う線)。1本ずつ直すときは「編集」タブの列車の運用で。</p>';
  const st = bkHit.st, L = bkHit.list;
  const cur = t => { const p = opsSetOf(t).plat; return p && p[st] != null ? opsTrackLabel(st, p[st]) : ''; };
  return `<p class="hint">${opsEsc(st)}: ${L.length} 本${L.length > 300 ? '(先頭の300本を表示)' : ''}</p>
    <div class="bkbar"><button data-bk="hall">全部選ぶ</button><button data-bk="hnone">外す</button><label>番線 <select id="bkplat">${opsTrackOpts(st, null, false)}</select></label><button data-bk="pset" class="primary">選んだ列車に指定</button><button data-bk="pdel">選んだ列車の指定を消す</button></div>
    <ul class="opsl bkl">${L.slice(0, 300).map((x, i) => `<li><label><input type="checkbox" class="bkh" data-i="${i}"${x.on ? ' checked' : ''}> ${opsEsc(x.t.no || '?')} ${opsEsc(opsTy(x.t))} ${opsLine(x.t)}</label><small>${opsEsc(opsTrackLabel(st, x.t.route ? x.t.route.stopE[x.i + x.t.k0] : null))}${cur(x.t) ? ' 指定: ' + opsEsc(cur(x.t)) : ''}</small></li>`).join('')}</ul>`;
}
function bkFind() {
  const st = $('bkst').value, kind = $('bkkind').value, t0 = ttHM($('bkt0').value), t1 = ttHM($('bkt1').value), ty = $('bkty').value, nx = $('bknx').value.trim();
  const L = [];
  for (const t of ttList) {
    if (!opsReal(t) || t.dh) continue;
    const i = t.names.indexOf(st); if (i < 0) continue;
    if (kind === 'o' && i !== 0) continue; if (kind === 'z' && i !== t.names.length - 1) continue; if (kind === 's' && t.ev[i].thru) continue;
    const m = i === 0 ? t.ev[i].dep : t.ev[i].arr; if (t0 != null && m < t0) continue; if (t1 != null && m > t1) continue;
    if (ty && t.type !== ty) continue;
    if (nx && t.names[i + 1] !== nx && !(i === t.names.length - 1 && t.next && t.next.names[1] === nx)) continue;
    L.push({ t, i, on: true });
  }
  L.sort((a, b) => (a.i === 0 ? a.t.ev[0].dep : a.t.ev[a.i].arr) - (b.i === 0 ? b.t.ev[0].dep : b.t.ev[b.i].arr));
  bkHit = { st, kind, t0: $('bkt0').value, t1: $('bkt1').value, ty, nx, list: L };
  $('bkres').innerHTML = bkResHTML();
}
function bkPlat(v) {
  if (!bkHit.list) return; const st = bkHit.st; let n = 0;
  for (const x of bkHit.list.slice(0, 300)) { if (!x.on) continue; opsEdit(x.t, o => { o.plat = Object.assign({}, o.plat); if (v === '' || v == null) delete o.plat[st]; else o.plat[st] = +v; }); n++; }
  opsDirty = true; $('bkres').innerHTML = bkResHTML();
  const p = document.createElement('p'); p.className = 'opswarn'; p.textContent = `${n} 本の${v === '' ? '指定を消しました' : '番線を指定しました'}。「反映(計算し直す)」で計画に入ります。`; $('bkres').prepend(p);
}
$('dockbulk').addEventListener('click', e => {
  const b = e.target.closest('[data-bk]'); if (!b) return; const k = b.dataset.bk, L = bkStations();
  const pick = f => { bkSel = new Set(L.filter(f).map(x => x.st)); bulkRender(); };
  if (k === 'all') pick(x => !bkQ || x.st.includes(bkQ));
  else if (k === 'kq' || k === 'toei' || k === 'ks') pick(x => x.g === k);
  else if (k === 'o') pick(x => x.c.o > 0); else if (k === 'z') pick(x => x.c.z > 0);
  else if (k === 'none') { bkSel.clear(); bulkRender(); }
  else if (k === 'put' || k === 'clear') {
    if (!bkSel.size) { alertless('先に駅を選んでください'); return; }
    for (const st of bkSel) for (const [q] of BK_K) { if (k === 'clear') bkSetVal(st, q, ''); else { const v = $('bkset-' + q).value; if (v.trim() !== '') bkSetVal(st, q, v); } }
    opsSave(); opsDirty = true; bulkRender();
  }
  else if (k === 'find') bkFind();
  else if (k === 'hall' || k === 'hnone') { (bkHit.list || []).forEach(x => x.on = k === 'hall'); $('bkres').innerHTML = bkResHTML(); }
  else if (k === 'pset') bkPlat($('bkplat').value);
  else if (k === 'pdel') bkPlat('');
});
function alertless(s) { const p = $('dockbulk').querySelector('.bkmsg') || (() => { const x = document.createElement('p'); x.className = 'opswarn bkmsg'; $('dockbulk').prepend(x); return x; })(); p.textContent = s; }
$('dockbulk').addEventListener('change', e => {
  const c = e.target;
  if (c.classList.contains('bkck')) { if (c.checked) bkSel.add(c.dataset.st); else bkSel.delete(c.dataset.st); const b = $('dockbulk').querySelector('.bkbar b'); if (b) b.textContent = bkSel.size; return; }
  if (c.classList.contains('bkv')) { bkSetVal(c.dataset.st, c.dataset.k, c.value); opsSave(); opsDirty = true; return; }
  if (c.classList.contains('bkh')) { const x = bkHit.list && bkHit.list[+c.dataset.i]; if (x) x.on = c.checked; return; }
});
$('dockbulk').addEventListener('input', e => { if (e.target.id === 'bkq') { bkQ = e.target.value.trim(); const pos = e.target.selectionStart; bulkRender(); const q = $('bkq'); q.focus(); try { q.setSelectionRange(pos, pos); } catch (er) { } } });
$('dtabbulk').onclick = () => opsDockShow('bulk');
{ const f = opsDockShow; opsDockShow = function (tab) {
  if (tab === 'bulk') { f(); $('dockedit').hidden = true; $('occ').hidden = true; $('dtabedit').classList.remove('on'); $('occopen').classList.remove('on'); $('dockbulk').hidden = false; $('dtabbulk').classList.add('on'); bulkRender(); return; }
  if (tab) { $('dockbulk').hidden = true; $('dtabbulk').classList.remove('on'); }
  return f.apply(this, arguments);
}; }
{ const f = opsRefresh; opsRefresh = function () { const r = f.apply(this, arguments); if (!$('dockbulk').hidden) { if (bkHit.list) bkHit.list = null; bulkRender(); } return r; }; }
