// ===== 時刻表運転 =====
const TT = /*TT*/;
const USER_OPS_FILE = /*OPSUSER*/null;   // 運用の編集(build/ops_user.json)
let USER_OPS = null;   // ↑とブラウザの保存を合わせたもの(opsui.js)
/*TTCORE*/
const gTT = el('g', {}, null); svg.insertBefore(gTT, gTrains);
let ttRes = null;   // 計画で押さえた線の時間帯(運用の編集で、空いている番線を探すのに使う)
let ttToken = 0, ttDay = '', ttClock = 7 * 3600, ttRate = 30, ttList = [], ttSel = null, ttDrag = false;
const hm = m => String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
function ttKill(t) { if (t.g) { t.g.remove(); t.g = null; } if (ttSel === t) ttSelect(null); }
function ttLoad(day) {
  ttList.forEach(ttKill); dispReset(ttList); dispReady = false; D_EV.length = 0; D_STAT = { spad: 0, emer: 0, sigwait: 0 };
  ttDay = day;
  ttPlanNow = null;
  if (day && !ttFixFail && ttFixAllowed()) { const token = ++ttToken; ttList = []; $('ttinfo').textContent = '固定の計画を読み込み中…';
    Promise.all([ttFixFind(day), fixOrderLoad(day).catch(e => { console.error(e); return null; })]).then(([F]) => { if (token !== ttToken) return; if (!F) { ttFixFail = true; ttLoad(day); return; } ttLoadFixed(day, F); }).catch(err => { console.error(err); if (token !== ttToken) return; ttFixFail = true; ttLoad(day); });
    return; }
  ttFixFail = false; if (day && typeof fixOrderLoad === 'function') fixOrderLoad(day).catch(e => console.error(e));   // 計算の間に読み込む(dispPlan で使う)
  ttList = day ? TT[day].map(ttDecode).filter(t => t.ev.length > 1) : [];
  if (day) ttOps(ttList);   // 実際の運用表を当てはめる(運行番号・所属・折り返し)
  const ot = day && $('ttwait').checked ? ttOvertakes(ttList) : null;
  if (day && $('ttcouple').checked) ttCouple(ttList, day);
  const token = ++ttToken;
  if (day && $('ttlink').checked) {   // 折り返し・回送の計算は重いので、少しずつ進めて画面を止めない
    const g = ttLinkG(ttList);
    const step = () => {
      if (token !== ttToken) return;
      const t0 = performance.now();
      for (;;) { const r = g.next(); if (r.done) { ttLoad2(day, token, r.value, ot); return; } if (performance.now() - t0 > 30) break; }
      $('ttinfo').textContent = `折り返し・回送を計算中…`; setTimeout(step, 0);
    };
    $('ttinfo').textContent = `折り返し・回送を計算中…`; setTimeout(step, 0);
  } else ttLoad2(day, token, 0, ot);
}
// 固定の計画(src/fixload.js): 埋めてある計画(運用の編集がファイルのまま)か、このブラウザに保存した計画(運用の編集のハッシュが同じ)を使う。無ければ開くときに計算して保存
let ttFixFail = false, ttPlanNow = null;   // ttPlanNow = { day, bin(gzip), hash, info, src } いま走っている計画(書き出しに使う)
function ttFixAllowed() {
  if (typeof FIXKEY === 'undefined' || typeof DecompressionStream !== 'function' || ($('ttfix') && !$('ttfix').checked)) return false;
  return ['ttlink', 'ttsiding', 'ttwait', 'ttcouple'].every(id => !$(id) || $(id).checked);
}
const ttOpsStr = o => { const a = Object.assign({}, o || {}); delete a.saved; delete a.geo; delete a.geoMoved; return JSON.stringify(a, Object.keys(a).sort()); };
async function ttFixFind(day) {
  const hash = await fixHash(ttOpsStr(USER_OPS));
  if (ttOpsStr(USER_OPS) === ttOpsStr(USER_OPS_FILE)) { const F = await fixLoad(day); if (F) { F.hash = hash; F.src = '埋め込み'; return F; } }
  const bin = await fixIdb('get', FIXKEY + '|' + day + '|' + hash); if (!bin) return null;
  const F = fixRevive(await fixGunzip(bin)); F.bin = bin; F.hash = hash; F.src = 'このブラウザに保存'; return F;
}
function ttLoadFixed(day, F) {
  ttPlanNow = { day, bin: F.bin, hash: F.hash, info: F.info, src: F.src };
  ttList = F.list;
  if (typeof ttHensei === 'function') ttHensei(ttList, { park: (st, cars, no) => F.reserve.get(String(no)) || null });
  ttRes = F.res; D_DAY = ttDay; dispPlan(ttList); dispReady = true; if (typeof opsRefresh === 'function') opsRefresh();
  const I = F.info; $('ttinfo').textContent = '固定の計画(' + F.src + ')・' + (D_REC_STAT ? `基準の順 ${D_REC_STAT.node + D_REC_STAT.ent} 件・` : '時刻表の順・') + (I.units ? `金沢文庫の増結 ${I.units} 本・` : '') + `折り返し ${I.nl} 件(うち引上線 ${I.siding} 件)・縦列停車 ${I.tandem} 件・通過待ちを推定 ${I.waits} 件`;
}
// 計算した計画を固定の形にして、このブラウザに保存(次に開くときは計算しない)。dispPlan で列車に足す前に形にする
function ttFixSave(day, token, list, parked, res, info) {
  let obj; try { obj = fixEncode(list, parked, res, info, FIXKEY, day); } catch (e) { console.error(e); return; }
  Promise.all([fixGzip(obj), fixHash(ttOpsStr(USER_OPS))]).then(([bin, hash]) => {
    if (token !== ttToken) return; ttPlanNow = { day, bin, hash, info, src: '計算' };
    return fixIdb('put', FIXKEY + '|' + day + '|' + hash, bin);
  }).catch(e => console.error(e));
}
function ttLoad2(day, token, nl, ot) {
  ttList.sort((a, b) => a.start - b.start);
  // 番線の占有を見ながら、早い列車から順に経路を確定(少しずつ計算)
  const pl = ttPlanner($('ttlink').checked && $('ttsiding').checked), list = ttList;
  let idx = 0, pre = 0;
  const work = () => {
    if (token !== ttToken) return;
    const t0 = performance.now();
    while (pre < list.length && performance.now() - t0 < 30) pl.pre(list[pre++]);
    while (pre >= list.length && idx < list.length && performance.now() - t0 < 30) pl.plan(list[idx++]);
    if (idx < list.length) { $('ttinfo').textContent = `経路を計算中… ${Math.round((pre + idx) / list.length * 50)}%`; setTimeout(work, 0); }
    else { list.push(...pl.finish());
      const parked = new Map(), n0 = list.length, plW = Object.assign({}, pl, { park: (st, cars, no) => { const u = pl.park(st, cars, no); if (u) parked.set(String(no), u); return u; } });
      if (typeof ttHensei === 'function') ttHensei(list, plW);
      if (ttFixAllowed()) ttFixSave(day, token, list.slice(0, n0), parked, pl.res, { units: pl.units.length, siding: pl.stat.siding, tandem: pl.stat.tandem || 0, nl, waits: ot ? ot.waits : 0 });
      ttRes = pl.res; D_DAY = ttDay; dispPlan(list); dispReady = true; if (typeof opsRefresh === 'function') opsRefresh(); $('ttinfo').textContent = (pl.units.length ? `金沢文庫の増結 ${pl.units.length} 本・` : '') + (nl ? `折り返し ${nl} 件(うち引上線 ${pl.stat.siding} 件)・縦列停車 ${pl.stat.tandem || 0} 件` + (ot ? `・通過待ちを推定 ${ot.waits} 件` : '') : ''); }
  };
  if (day) work(); else $('ttinfo').textContent = '時刻表運転はOFFです';
  if (!day) $('ttcount').textContent = '';
}
let ttLastT = NaN;
const ttRun = t => ttRunOf(t);   // 運行番号と所属(ttcore.js)
// 列車のラベル: 「種別 行先」と「運行番号 所属」を数秒ごとに交互に表示する
function ttLabelText(t) {
  if (t.cut) return '切離4両'; if (t.unit) return '増結4両'; if (t.yard) return '車庫';
  const ty = TYPES[t.shown || t.type], alt = $('ttrunno') && $('ttrunno').checked && Math.floor(Date.now() / 3000) % 2 === 1, r = alt ? ttRun(t) : null;
  return r && r.num ? `${r.num} ${r.co}車` : `${ty.short} ${shortDest(t.dest)}`;
}
// ===== 在線列車の一覧(時刻表で走っている列車すべて) =====
let ttActive = [];
function ttWhere(t) {   // いまどこにいるか
  if (t.dyn) { const p = t.ph; if (t.parked) return t.parked + ' 留置'; if (t.stayAt) return t.stayAt + ' 待機'; if (!p) return '区間の外'; const st = t.dp.stops[p.k]; return p.mode === 'dwell' ? (st && st.name ? st.name + ' 停車中' : '停車中') : '→' + (t.dest || ''); }
  const T = ttClock, n = t.names.length; if (t.yard) return t.yardSt + ' ' + t.yardTr; if (t.unit || t.cut) return t.cut ? '品川' : '金沢文庫';
  let k = -1; for (let i = 0; i < n; i++) if (t.A[i + t.k0] <= T) k = i;
  if (k < 0) return t.names[0] + ' 入線';
  const stopAt = i => !t.ev[i].thru;
  if (T <= t.P[k + t.k0] && stopAt(k)) return t.names[k] + (k === n - 1 ? ' 着' : ' 停車中');
  if (k >= n - 1) return t.names[n - 1] + ' 着';
  let a = k, b = k + 1; while (a > 0 && !stopAt(a)) a--; while (b < n - 1 && !stopAt(b)) b++;
  return t.names[a] + '→' + t.names[b];
}
function ttListRender() {
  const ul = $('ttlist'); if (!ul) return;
  const act = ttDay ? ttActive.filter(t => t.g) : [];
  window.ttActiveN = act.length; $('count').textContent = trains.length + act.length; $('empty').hidden = trains.length + act.length > 0;
  const key = act.map(t => t.no + '|' + t.start).join(',');
  if (ul.dataset.key !== key) {
    ul.dataset.key = key; ul.innerHTML = '';
    act.slice().sort((a, b) => (ttRun(a).co + ttRun(a).num).localeCompare(ttRun(b).co + ttRun(b).num, 'ja')).forEach(t => {
      const li = document.createElement('li'), r = ttRun(t);
      li.innerHTML = `<span class="dot"></span><b></b><span class="rn">${t.unit || t.cut || t.yard ? '' : r.num + ' ' + r.co}${typeof hsName === 'function' && hsName(t) ? ' <i class="hsn">' + hsName(t) + '</i>' : ''}</span><small></small>`;
      li.onclick = () => { ttSelect(t); }; li.onmouseenter = ev => ttOpsShow(t, ev); li.onmousemove = ttOpsMove; li.onmouseleave = ttOpsHide;
      t.li2 = li; ul.appendChild(li); });
  }
  for (const t of act) { const li = t.li2; if (!li) continue; const ty = TYPES[t.shown || t.type], s = (t.cut ? '切離4両' : t.unit ? '増結4両' : t.yard ? '車庫 ' + t.yardTr : ty.name + ' ' + shortDest(t.dest));
    if (li._s !== s) { li._s = s; li.children[1].textContent = s; li.children[0].style.background = ty.color; }
    const w = ttWhere(t); if (li._w !== w) { li._w = w; li.children[3].textContent = w; }
    li.classList.toggle('sel', t === ttSel); }
}
setInterval(ttListRender, 1000);
// ===== 本日の運用: その車両が1日に走る列車を、折り返しのつながりでたどって並べる =====
function ttOpsShow(t, ev) {
  const box = $('ttops'); if (!box) return;
  if (t.unit || t.cut) { box.innerHTML = `<h3>${t.cut ? '品川で切り離した4両' : '金沢文庫の増結車(4両)'}</h3>`; box.hidden = false; ttOpsMove(ev); return; }
  const r = ttRun(t); let rows;
  if (r.duty) rows = ttList.filter(x => !x.unit && !x.cut && !x.yard && ttRun(x).duty === r.duty).sort((a, b) => a.ev[0].dep - b.ev[0].dep);   // 実際の運用表にある列車: その運用の列車を1日ぶん
  else if (r.key) rows = ttList.filter(x => !x.unit && !x.cut && !x.yard && ttRun(x).key === r.key).sort((a, b) => a.ev[0].dep - b.ev[0].dep);   // 同じ運行番号の列車を1日ぶん
  else { let f = t, guard = 0; while (f.prev && guard++ < 200) f = f.prev; rows = []; for (let x = f, g = 0; x && g < 200; x = x.next, g++) rows.push(x); }   // 号数で走る列車(スカイライナーなど)は折り返しのつながりで
  const end = x => x.names[x.names.length - 1];
  // 終着時の両数: 金沢文庫で増結した列車は12両。ただし前に付けた4両は品川で切り離すので、品川より先まで行く列車は元の両数
  const endCars = x => { if (!x.cpl) return x.cars; const q = x.names.indexOf('品川'); return x.cpl.side === 'front' && q > x.cpl.i && q < x.names.length - 1 ? x.cars : 12; };
  // 同じ運行番号でも、両数が変わる所は別の車両。当てた列車と同じ車両が走る分だけを残す
  const other = (p, x) => endCars(p) !== x.cars && !(x.added4 && x.prev === p);
  if (r.key && !r.duty) { const k = rows.indexOf(t); let i0 = k, i1 = k; while (i0 > 0 && !other(rows[i0 - 1], rows[i0])) i0--; while (i1 < rows.length - 1 && !other(rows[i1], rows[i1 + 1])) i1++;
    var before = i0 > 0 ? rows[i0 - 1] : null, after = i1 < rows.length - 1 ? rows[i1 + 1] : null; rows = rows.slice(i0, i1 + 1); }
  const n = rows.length, f = rows[0], last = rows[n - 1];
  const li = (x, i) => { const ty = TYPES[x.type], p = rows[i - 1]; let gap = '';
    if (p) { const w = x.ev[0].dep - p.ev[p.ev.length - 1].arr; if (end(p) !== x.names[0]) gap = `<li class="gap">${end(p)} → ${x.names[0]} は回送か入出庫(推定)</li>`; else if (w >= 40) gap = `<li class="gap">${end(p)}で ${w >= 60 ? Math.floor(w / 60) + '時間' + (w % 60 ? w % 60 + '分' : '') : w + '分'} 休み</li>`; }
    return gap + `<li class="${x === t ? 'cur' : ''}"><span class="tm">${hm(x.ev[0].dep)}→${hm(x.ev[x.ev.length - 1].arr)}</span><span style="color:${ty.color}">${ty.name}</span><span>${x.names[0]}→${end(x)}</span><span class="tm">${x.no || ''}</span><span class="tm">${x.cars}両${x.cpl ? '+4' : ''}</span></li>`; };
  const note = [];
  if (before) note.push(`この前の ${before.no}(${endCars(before)}両)は別の車両`);
  if (after) note.push(`この後の ${after.no}(${after.cars}両)は別の車両`);
  box.innerHTML = `<h3>本日の運用　${r.duty && r.duty !== r.num ? r.duty + '　' : ''}${r.num} ${r.co}車　${f.cars}両　(${n}本)${t.hs ? '　編成 ' + t.hs.f + (t.hs2 ? '+' + t.hs2.f : '') : ''}</h3><ol>${rows.map(li).join('')}</ol>` +
    `<p>${hm(f.ev[0].dep)} ${f.names[0]}から / ${hm(last.ev[last.ev.length - 1].arr)} ${end(last)}まで。${r.duty ? '実際の運用表のとおり' : r.key ? '同じ運行番号・同じ両数の列車を並べたもの' : '折り返しのつながり(時刻からの推定)'}${note.length ? '<br>' + note.join(' / ') : ''}</p>`;
  box.classList.toggle('wide', n > 20);
  box.hidden = false; ttOpsMove(ev);
}
function ttOpsMove(ev) { const box = $('ttops'); if (!box || box.hidden || !ev) return; const w = box.offsetWidth, h = box.offsetHeight; let x = ev.clientX + 14, y = ev.clientY + 14;
  if (x + w > innerWidth - 6) x = ev.clientX - w - 14; if (y + h > innerHeight - 6) y = Math.max(6, innerHeight - h - 6); box.style.left = Math.max(6, x) + 'px'; box.style.top = y + 'px'; }
function ttOpsHide() { const box = $('ttops'); if (box) box.hidden = true; }
function ttLabels() { for (const t of ttList || []) if (t.g && t.label) { const s = ttLabelText(t); if (t.lbl !== s) { t.label.textContent = s; t.lbl = s; } } }
setInterval(ttLabels, 400);
function ttUpdate() {
  const T = ttClock, act = [];
  if (T === ttLastT && !ttDrag && !D_NEEDWARM && ttUpdate.list === ttList) { for (const t of ttActive) if (t.g) drawTrain(t); return; }   // 一時停止中(時刻が進んでいない): 動かさない。dt=0 だと追従が時刻表の位置へ戻し(snap)、運転指令が作り直し(dispReset→dWarm 約2秒)を毎コマ繰り返して、列車が前後に飛び・遅れて走っている列車が消えた
  if (D_NEEDWARM && dispOn && dispReady && !ttDrag && $('ttfollow').checked && isFinite(T)) ttLastT = dWarm(ttList, T);   // 途中から始めたときは少し前から早回し(disp.js)
  // 進み方を速くすると1回の時間が長くなる(×300 で約5秒)。区間の外の列車の動きと運転指令を、2秒以下ずつ交互に進める(5秒刻みでは区間の入口を跳び越えて全線で詰まった)
  { const L = ttDrag ? NaN : ttLastT;
    if (dispOn && dispReady && $('ttfollow').checked && isFinite(L) && T - L > 2.01 && T - L < 90) {
      const n = Math.ceil((T - L) / 2), cs = ttList.concat(typeof D_DYN !== 'undefined' ? D_DYN : []).filter(t => t.g || t.ph || (t.start <= T && t.end >= L)); let t0 = L;   // この間に走る列車だけを見る(軽くするため)
      for (let i = 1; i < n; i++) { const t1 = L + (T - L) * i / n, a = []; for (const t of cs) { if (!dispTarget(t, t1)) { if (t.g) ttKill(t); dispKill(t); t.sv = null; continue; } a.push(t); } ttFollow(a, t1, t0); dispStep(a, t1, t0); t0 = t1; }
      ttLastT = t0;
    } }
  for (const t of ttList.concat(typeof D_DYN !== 'undefined' ? D_DYN : [])) {   // 臨時の列車(指令の指示 src/dcmd.js)も
    if (!dispTarget(t, T)) { if (t.g) ttKill(t); dispKill(t); t.sv = null; continue; }   // 区間内で遅れている列車は、時刻表の終わりを過ぎても走らせる(disp.js)
    act.push(t);
  }
  ttFollow(act, T, ttDrag || !$('ttfollow').checked ? NaN : ttLastT);
  dispStep(act, T, ttDrag ? NaN : ttLastT);   // 泉岳寺〜京急川崎: 実距離・信号で走らせる
  ttLastT = T;
  for (const t of act) {
    const tk = ttTypeAt(t, T);
    if (!t.g) {
      const ty = TYPES[tk]; t.shown = tk;
      t.g = el('g', { class: t.yard ? 'train yardu' : 'train' }, gTT);
      t.casing = el('path', { class: 'casing' }, t.g); t.body = el('path', { class: 'body', stroke: ty.color }, t.g);
      t.label = el('text', { class: 'tlabel', fill: ty.color }, t.g, t.cut ? '切離4両' : t.unit ? '増結4両' : t.yard ? '車庫' : `${ty.short} ${shortDest(t.dest)}`);
      t.lbl = null;
      t.g.addEventListener('click', ev => { ev.stopPropagation(); ttSelect(t); });
      t.g.addEventListener('mouseenter', ev => ttOpsShow(t, ev)); t.g.addEventListener('mousemove', ttOpsMove); t.g.addEventListener('mouseleave', ttOpsHide);
    }
    if (t.shown !== tk && !t.unit && !t.yard) {   // 種別が切り替わる駅に着いたら、色と表示を変える
      const ty = TYPES[tk]; t.shown = tk;
      t.body.setAttribute('stroke', ty.color); t.label.setAttribute('fill', ty.color); t.lbl = null;
      if (ttSel === t) ttSelect(t);
    }
    drawTrain(t);
  }
  $('ttcount').textContent = `運行中 ${act.length} 本`;
  ttActive = act; ttUpdate.list = ttList;
}
function ttSelect(t) {
  if (ttSel && ttSel.g) ttSel.g.classList.remove('sel');
  ttSel = t; $('ttbox').hidden = !t;
  if (typeof opsTrainPanel === 'function') opsTrainPanel(t && !t.unit && !t.cut && !t.yard ? t : null);
  if (!t) { routeHL.setAttribute('d', ''); return; }
  if (selected) select(null);
  ttSel = t; $('ttbox').hidden = false;
  t.g.classList.add('sel');
  const ty = TYPES[t.shown || t.type];
  if (t.cut) {   // 品川で切り離した前4両
    const m = t.cplWith, d = t.into;
    $('tttitle').textContent = '切り離した4両(品川)'; $('tttitle').style.color = ty.color;
    $('ttno').textContent = `${ty.name} ${m.dest}行き${m.no ? ' (' + m.no + ')' : ''} の前4両。品川 ${hm(m.ev[m.names.indexOf('品川')].arr)}着`;
    $('ttlinkinfo').innerHTML = d ? `引上線で待ち、品川 ${hm(d.ev[0].dep)}発 ${TYPES[d.type].name} ${d.dest}行き${d.no ? ' (' + d.no + ')' : ''}(${d.cars}両)の車両になる(推定)` : '引上線へ(このあとは回送扱い)';
    $('ttstops').innerHTML = `<li><span>${hm(Math.floor(t.A[0] / 60))}</span>品川で切り離し → 引上線へ</li>`;
    return;
  }
  if (t.yard) {   // 検車区の車庫の線にいる車両(1日の始まりから出庫まで / 入庫から1日の終わりまで)
    const o = t.yard === 'out' ? t.next : t.prev, oty = o ? TYPES[o.type] : ty, hm2 = x => hm(Math.floor(x / 60));
    $('tttitle').textContent = `${t.yardSt}の車庫 ${t.yardTr}`; $('tttitle').style.color = oty.color;
    $('ttno').textContent = t.yard === 'out' ? `${t.yardMid ? hm2(t.A[0]) + ' 昼の留置から' : '1日の始まりから留置'} → ${hm2(t.P[0])} 出庫` : `${hm2(t.A[1])} 入庫 → ${t.yardMid ? hm2(t.P[1]) + ' まで昼の留置' : '1日の終わりまで留置'}`;
    $('ttlinkinfo').innerHTML = o ? (t.yard === 'out' ? `出庫後: ${oty.name} ${o.dest}行き${o.no ? ' (' + o.no + ')' : ''} ${t.yardSt} ${hm(o.ev[0].dep)}発` : `入庫前: ${oty.name} ${o.names[0]}発${o.no ? ' (' + o.no + ')' : ''} ${t.yardSt} ${hm(o.ev[o.ev.length - 1].arr)}着`) + '<br>ホームの先の引上線で折り返して出入り' : '';
    $('ttstops').innerHTML = t.yard === 'out' ? `<li><span>${hm2(t.P[0])}</span>車庫の線を出る</li><li><span>${hm2(t.A[1])}</span>引上線で折り返し</li>` : `<li><span>${hm2(t.A[0])}</span>引上線で折り返し</li><li><span>${hm2(t.A[1])}</span>車庫の線に入る</li>`;
    return;
  }
  if (t.unit) {   // 増結車
    const m = t.cplWith, c = m.cpl, e = m.ev[c.i], rear = c.side === 'rear';
    $('tttitle').textContent = `増結車(4両) → ${ty.name} ${m.dest}行き`; $('tttitle').style.color = ty.color;
    $('ttno').textContent = `金沢文庫 ${hm(e.dep)}発の ${ty.name}${m.no ? ' (' + m.no + ')' : ''} に連結`;
    $('ttlinkinfo').innerHTML = `金沢文庫始発の車両(空車で入線)<br>${rear ? '3番線・後ろ(金沢八景寄り)' : '4番線・前(上大岡寄り)'}に連結して12両に`;
    $('ttstops').innerHTML = `<li><span>${hm(Math.floor(t.A[1] / 60))}頃</span>金沢文庫 ${rear ? '3' : '4'}番線に入線</li><li><span>${hm(e.dep)}</span>金沢文庫 発(${ty.name}の${rear ? '後ろ' : '前'}4両として)</li>`;
    return;
  }
  $('tttitle').textContent = `${ty.name} ${t.dest}行き`; $('tttitle').style.color = ty.color;
  $('ttno').textContent = (t.no ? '列車番号 ' + t.no + '　運行番号 ' + ttRun(t).num + '(' + ttRun(t).co + '車)' + (ttRun(t).duty && ttRun(t).duty !== ttRun(t).num ? ' ' + ttRun(t).duty : '') + '　' : '') + `${t.names[0]} ${hm(t.ev[0].dep)} → ${t.names[t.names.length - 1]} ${hm(t.ev[t.ev.length - 1].arr)}`;
  const lk = (lab, o) => o ? `${lab}: ${TYPES[o.type].name} ${o.names[0]} ${hm(o.ev[0].dep)} → ${o.names[o.names.length - 1]} ${hm(o.ev[o.ev.length - 1].arr)}${o.no ? ' (' + o.no + ')' : ''}` : '';
  const sw = t.swapOut ? `${t.names[t.names.length - 1]}で車両交換: この${t.cars}両は回送で出ていき、${t.swapOut.cars}両の別の車両が ${t.swapOut.no} になる(推定)` : t.swapIn ? `${t.names[0]}で車両交換: ${t.swapIn.no}(${t.swapIn.cars}両)に代わって、回送で入ってきた${t.cars}両(推定)` : '';
  $('ttlinkinfo').innerHTML = [lk('前の運用', t.prev), lk('折り返し後', t.next), sw].filter(Boolean).join('<br>') + (t.off && t.off.some(Boolean) ? '<br>縦列停車あり' : '') + (t.tail ? (t.deadOut ? '<br>到着後、引上線へ(このあと回送・推定)' : '<br>到着後、引上線へ') : '') + (t.formed ? `<br>品川で切り離された4両×${t.formed.length}本で組成(推定): ${t.formed.map(m => m.no).join('・')} の前4両` : '') + (t.tseg ? '<br>種別: ' + t.tseg.map(([i, y], n) => (n ? t.names[i] + 'から' : '') + TYPES[y].name).join(' → ') : '') + (t.added4 ? '<br>品川で4両を足して12両に(推定)' : '') + (t.deadIn === 'exit' ? '<br>泉岳寺方から回送で入線(推定)' : '') + (t.deadOut === 'exit' ? '<br>到着後、泉岳寺方へ回送(推定)' : '') + (t.fromSiding ? (t.deadIn ? '<br>引上線から入線(回送で到着・推定)' : '<br>引上線から入線') : '') + (t.cpl ? `<br>8両編成 → 金沢文庫で4両増結(${t.cpl.side === 'rear' ? '3番線・後ろ=金沢八景寄り' : '4番線・前=上大岡寄り'})して12両` + (t.cpl.t1 < Infinity ? '、品川で前4両を切り離し' : '') : t.cars ? `<br>${t.cars}両編成` + (t.cars === 12 && t.names.indexOf('金沢文庫') > 0 && t.names.indexOf('金沢文庫') < t.names.length - 1 ? '(金沢文庫で後ろ4両を切り離し)' : '') : '');
  $('ttstops').innerHTML = t.ev.filter(e => !e.thru).map(e => e.wait ? `<li class="w"><span>${hm(e.arr)}頃</span>${e.name}(通過待ち・推定)</li>` : `<li><span>${e.arr !== e.dep ? hm(e.arr) + '着 ' : ''}${hm(e.dep)}</span>${e.name}${e.ot ? '(待避)' : ''}${t.cpl && t.ev[t.cpl.i] === e ? '(4両増結)' : ''}</li>`).join('');
}
function ttFrame(real) {
  if (!ttDay) return;
  if (running && !ttDrag) {
    ttClock += Math.min(real * ttRate, dispOn && dispReady ? 60 : Infinity);   // 運転指令が動いている間は1コマ60秒まで(画面が重くて1コマが90秒を超えると、運転指令が作り直しになり詰まって見えた)
    if (ttClock > 25.5 * 3600) ttClock = 4.5 * 3600;
    $('ttime').value = Math.floor(ttClock / 60);
  }
  const c = Math.floor(ttClock);
  $('clock').textContent = hm(Math.floor(c / 60)) + ':' + String(c % 60).padStart(2, '0');
  ttUpdate();
  if (ttSel && ttSel.g && ttSel.ph) { const p = ttSel.ph; $('ttlate').textContent = `実距離・信号で運転中 ${Math.round(p.v * 3.6)}km/h` + (p.delay >= 30 ? `・${Math.floor(p.delay / 60)}分${Math.floor(p.delay % 60)}秒遅れ` : '・定時') + (p.why ? `(${p.why})` : ''); $('ttlate').className = p.delay >= 60 ? 'late' : ''; }
  else if (ttSel && ttSel.g) { const lag = ttSel.tgt - ttSel.s; $('ttlate').textContent = lag > 8 ? '前の列車につかえて、時刻表の位置より後ろにいます' : (ttSel.dwelling ? '停車中(時刻表どおり)' : '時刻表どおり走行中'); $('ttlate').className = lag > 8 ? 'late' : ''; }
  if (ttSel) routeHL.setAttribute('d', ttSel.g ? pathD(ttSel.route, ttSel.s, ttSel.route.total) : '');
  if (typeof dDraw === 'function') dDraw();
}
$('ttday').onchange = () => ttLoad($('ttday').value);
$('ttlink').onchange = () => ttLoad(ttDay);
$('ttsiding').onchange = () => ttLoad(ttDay);
$('ttwait').onchange = () => ttLoad(ttDay);
$('ttcouple').onchange = () => ttLoad(ttDay);
$('ttfix').onchange = () => { ttFixFail = false; ttLoad(ttDay); };
$('ttrate').onchange = () => { ttRate = +$('ttrate').value; };
$('ttime').oninput = () => { ttDrag = true; ttClock = +$('ttime').value * 60; };
$('ttime').onchange = () => { ttDrag = false; };
/*OPSUI*/
{
  const m = location.hash.match(/tt=(wd|hd)?,?(\d+):(\d+)/);
  $('ttday').value = (m && m[1]) || 'wd';
  if (m) { ttClock = (+m[2] * 60 + +m[3]) * 60; $('ttime').value = ttClock / 60; }
  // 保存先(cloud.js)の編集を読んでから計算する。cloud.js は同じ script の後ろなので、読み終わってから(マイクロタスク)呼ぶ
  Promise.resolve().then(() => typeof cloudInit === 'function' ? cloudInit() : null).catch(() => { }).then(() => ttLoad($('ttday').value));
}

/*HENSEIJS*/
/*FIXLOADJS*/
/*PLANUI*/
