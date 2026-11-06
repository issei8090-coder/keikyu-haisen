// ===== 編成表: 3検車区(久里浜・新町・金沢)の京急車の編成(build/hensei.json = ユーザー提供の Excel を tools/hensei.py で変換) =====
// その日の京急車の「車両のつながり」(折り返し・入出庫でつながる列車の並び)ごとに、所属の検車区と両数から編成を当てはめる(推定)。
//  ・所属: 朝に車庫から出るつながりはその車庫、夜に車庫へ入るつながりはその車庫、どちらでもなければ走り始める駅の地域(新町=横浜より北・空港線・大師線、金沢=戸部〜金沢八景・逗子線、久里浜=追浜より南・久里浜線)
//  ・両数が同じ編成から。所属の検車区に空きが無ければ近い検車区から借りる。12両の列車は 8両+4両。2100形は泉岳寺より先(都営線)へは入れない
//  ・同じ編成を使い回すのは時間が重ならないときだけ。駅で消えた車両は、同じ駅であとから現れるつながりに優先して当てる(消える/現れるは同じ車両のことが多い)
//  ・金沢文庫の増結車(4両)は品川で切り離されたあと、その4両でできる列車まで同じ編成
const HENSEI = /*HENSEI*/null;
const HS_KANA = new Set('戸部 日ノ出町 黄金町 南太田 井土ヶ谷 弘明寺 上大岡 屏風浦 杉田 京急富岡 能見台 金沢文庫 金沢八景 六浦 神武寺 逗子・葉山'.split(' '));
const HS_KURI = new Set('追浜 京急田浦 安針塚 逸見 汐入 横須賀中央 県立大学 堀ノ内 京急大津 馬堀海岸 浦賀 新大津 北久里浜 京急久里浜 YRP野比 京急長沢 津久井浜 三浦海岸 三崎口'.split(' '));
const HS_YARD = { '神奈川新町': '新町', '金沢文庫': '金沢', '京急久里浜': '久里浜' };
const HS_NEAR = { 新町: ['新町', '金沢', '久里浜'], 金沢: ['金沢', '新町', '久里浜'], 久里浜: ['久里浜', '金沢', '新町'] };
const HS_GAP = 1200;   // 別の駅で消えた車両を使い回すときにあける秒(回送で動く時間)
const hsZone = st => HS_KURI.has(st) ? '久里浜' : HS_KANA.has(st) ? '金沢' : '新町';
let HS = null;   // { F: 編成(当てはめた結果つき), jobs, miss }
const HS_ST = { 新町: '神奈川新町', 金沢: '金沢文庫', 久里浜: '京急久里浜' };
function ttHensei(all, pl) {
  HS = null; if (!HENSEI || !HENSEI.length) return null;
  const F = HENSEI.map(h => Object.assign({}, h, { free: -Infinity, at: null, jobs: [] }));
  for (const t of all) { t.hs = null; t.hs2 = null; }
  const jobs = [], jobOfHead = new Map();
  const tEnd = x => x.ev[x.ev.length - 1].arr * 60;
  for (const h of all) {
    if (h.prev || h.unit) continue;
    const ch = []; for (let x = h, g = 0; x && g < 400; x = x.next, g++) ch.push(x);
    const real = ch.filter(x => !x.yard); if (!real.length || ttRunOf(real[0]).co !== '京急') continue;
    const a = ch[0], z = ch[ch.length - 1];
    const J = { ch, s: a.yard ? (a.yardMid ? a.A[0] : -1) : a.ev[0].dep * 60, e: z.yard ? (z.yardMid ? z.P[1] : 1e9) : tEnd(z),
      st0: a.yard ? a.yardSt : a.names[0], st1: z.yard ? z.yardSt : z.names[z.names.length - 1],
      cars: Math.min(...real.map(x => x.cars === 12 ? 8 : x.cars)), direct: real.some(x => x.names.includes('泉岳寺')),
      dep: a.yard && HS_YARD[a.yardSt] ? HS_YARD[a.yardSt] : z.yard && HS_YARD[z.yardSt] ? HS_YARD[z.yardSt] : hsZone(a.yard ? a.yardSt : a.names[0]), yard0: !!a.yard };
    jobs.push(J); jobOfHead.set(h, J);
    const c12 = real.filter(x => x.cars === 12);   // 時刻表で12両の列車: 後ろ(前)の4両は別の編成
    if (c12.length) jobs.push({ ch: c12, sub: true, s: c12[0].ev[0].dep * 60 - 1, e: tEnd(c12[c12.length - 1]), st0: c12[0].names[0], st1: c12[c12.length - 1].names[c12[c12.length - 1].names.length - 1], cars: 4, direct: c12.some(x => x.names.includes('泉岳寺')), dep: J.dep });
  }
  // 増結車(金沢文庫)・切り離した4両(品川): 増結車 → それを連結した列車のつながりの中で切り離された4両 → その4両でできる列車
  const cuts = all.filter(x => x.cut), covered = new Set();
  for (const u of all.filter(x => x.unit && !x.cut)) {
    const J = { ch: [u], unit: true, s: u.start, e: u.end, st0: '金沢文庫', st1: '金沢文庫', cars: 4, direct: false, dep: '金沢' };
    for (let x = u.cplWith, g = 0; x && g < 60; g++) {
      const v = cuts.find(c => c.cplWith === x); if (v) { J.ch.push(v); J.e = v.end; J.st1 = v.names[0]; J.into = v.into; break; }
      J.e = tEnd(x); J.st1 = x.names[x.names.length - 1];
      const n = x.next; if (!n || !(n.cars === 12 || (n.cpl && n.cpl.unit === u))) break; x = n; if (n.cars === 12) { J.ch.push(n); covered.add(n); }   // 12両のまま折り返す列車へ続く
    }
    jobs.push(J);
  }
  for (const S of jobs.filter(J => J.sub)) S.ch = S.ch.filter(x => !covered.has(x));   // 増結車がそのまま12両の列車になる所は、増結車の編成
  for (let i = jobs.length - 1; i >= 0; i--) if (jobs[i].sub && !jobs[i].ch.length) jobs.splice(i, 1);
  for (const v of cuts) if (!jobs.some(J => J.ch.includes(v))) {   // 12両の列車から切り離した4両: その12両の列車の4両(sub)の続き
    const S = jobs.find(J => J.sub && J.ch.includes(v.cplWith)); if (S) { S.ch.push(v); S.e = Math.max(S.e, v.end); S.st1 = v.names[0]; S.into = v.into; }
    else jobs.push({ ch: [v], s: v.start, e: v.end, st0: v.names[0], st1: v.names[0], cars: 4, direct: false, dep: '新町' });
  }
  jobs.sort((p, q) => p.s - q.s);
  const miss = {};
  for (const J of jobs) {
    let f = J.pre && J.pre.free <= J.s + 600 ? J.pre : null;
    if (!f) {
      const ok = (f, gap) => f.cars === J.cars && J.s - f.free >= gap && !(J.direct && f.kei === '2100形');
      const k21 = x => !J.direct && x.kei === '2100形' ? 0 : 1;   // 都営線に入らないつながりには 2100形を先に(ほかの形式を直通のために残す)
      // 1) 同じ駅で消えた車両(いちばん最近消えたもの。検車区は問わない) 2) 所属の検車区のまだ使っていない編成 3) 20分以上あいた編成(回送で動いたとみなす) 4) 近い検車区から借りる
      f = F.filter(x => x.at === J.st0 && ok(x, 0)).sort((p, q) => q.free - p.free)[0];
      for (const dep of HS_NEAR[J.dep] || HS_NEAR['新町']) {
        if (f) break;
        const c = F.filter(x => x.dep === dep).sort((p, q) => k21(p) - k21(q));
        f = c.find(x => x.free === -Infinity && ok(x, 0)) || c.filter(x => ok(x, HS_GAP)).sort((p, q) => k21(p) - k21(q) || p.free - q.free)[0];
      }
      // 5) それでも無ければ、ほかの駅で消えたばかりの編成でも(時刻表の上で車両が足りない所。消える/現れるの多い品川の夕方など)
      for (const dep of HS_NEAR[J.dep] || HS_NEAR['新町']) { if (f) break; f = F.filter(x => x.dep === dep && ok(x, 0)).sort((p, q) => k21(p) - k21(q) || p.free - q.free)[0]; if (f) J.tight = true; }
    }
    if (!f) { miss[J.cars] = (miss[J.cars] || 0) + 1; J.f = null; continue; }
    J.f = f; f.free = J.e; f.at = J.st1; f.jobs.push(J);
    for (const x of J.ch) if ((J.sub || J.unit) && !x.unit) x.hs2 = f; else x.hs = f;   // 12両の列車の4両側は hs2
    if (J.into) { const D = jobOfHead.get(J.into); if (D) D.pre = f; }
  }
  // 予備: 今日の運用が無い編成は、所属の検車区の空いている車庫の線に1日中止めておく(pl.park)
  let nRes = 0;
  if (pl && pl.park) for (const f of F) { if (f.jobs.length) continue; const st = HS_ST[f.dep], u = st && pl.park(st, f.cars, f.f); if (!u) continue;
    u.hs = f; all.push(u); f.jobs.push({ ch: [u], reserve: true, s: u.start, e: u.end, st0: st, st1: st, cars: f.cars, dep: f.dep, f }); f.free = u.end; f.at = st; nRes++; }
  return HS = { F, jobs, miss, nRes };
}
// 列車の編成名(連結中は「8両+4両」の2つ)
function hsName(t) {
  if (!t || !t.hs) return '';
  const u = t.cpl && t.cpl.unit && t.cpl.unit.hs && !(ttClock >= t.cpl.t1) ? t.cpl.unit.hs : null, s2 = t.hs2 && !(t.c12 != null && ttClock >= t.c12) ? t.hs2 : null;
  return t.hs.f + (u ? '+' + u.f : s2 ? '+' + s2.f : '');
}
const hsDesc = f => `${f.f}(${f.kei} ${f.cars}両・${f.dep}検車区${f.chk ? '・要照合' : ''})`;
function hsLine(t) {
  if (!HENSEI) return '';
  if (!t.hs) return '<div class="hsline">編成: 当てはまる編成なし(京急車以外、または同じ両数の編成が足りない)</div>';
  const u = t.cpl && t.cpl.unit && t.cpl.unit.hs ? t.cpl.unit.hs : t.hs2 || null;
  return `<div class="hsline">編成: <b>${hsDesc(t.hs)}</b>${u ? ' + ' + hsDesc(u) : ''}<br><small>車両 ${t.hs.nos.join('・')}${t.hs.since ? '　編成期間 ' + t.hs.since + '〜' : ''}</small><br><small>編成の当てはめは所属の検車区と両数からの推定</small></div>`;
}
// 列車の詳細に編成を足す
{ const f = ttSelect; ttSelect = function (t) { const r = f.apply(this, arguments); if (t && HENSEI) { const b = $('ttlinkinfo'); if (b) b.insertAdjacentHTML('beforeend', hsLine(t)); } return r; }; }
// ===== 運用の編集の下の「編成表」タブ: 検車区ごとの編成と、その日の運用・いまの居場所 =====
{ const bar = document.querySelector('#opsdock .dtabs'), dock = $('opsdock');
  if (bar && dock) {
    const b = document.createElement('button'); b.id = 'dtabhs'; b.textContent = '編成表'; b.title = '3検車区(久里浜・新町・金沢)の編成と、その日に当てはめた運用・いまの居場所'; bar.appendChild(b);
    const p = document.createElement('div'); p.id = 'dockhs'; p.className = 'dpane'; p.hidden = true; dock.appendChild(p);
    b.onclick = () => opsDockShow('hs');
    const f = opsDockShow; opsDockShow = function (tab) {
      if (tab === 'hs') { f('edit'); $('dockedit').hidden = true; $('dtabedit').classList.remove('on'); if ($('dockbulk')) { $('dockbulk').hidden = true; $('dtabbulk').classList.remove('on'); } p.hidden = false; b.classList.add('on'); hsRender(); return; }
      if (tab) { p.hidden = true; b.classList.remove('on'); }
      return f.apply(this, arguments);
    };
    p.addEventListener('click', e => { const r = e.target.closest('[data-hs]'); if (!r) return; const fm = HS && HS.F.find(x => x.f === r.dataset.hs); const t = fm && hsWhere(fm).t; if (t && t.g) ttSelect(t); });
    p.addEventListener('change', e => { if (e.target.id === 'hsdep' || e.target.id === 'hscars') { hsFilter = { dep: $('hsdep').value, cars: $('hscars').value }; hsRender(); } });
    setInterval(() => { if (!p.hidden) hsRender(true); }, 2000);
  }
}
let hsFilter = { dep: '', cars: '' };
// 編成のいまの居場所: 走っている(または車庫・ホームにいる)列車
function hsWhere(f) {
  const T = ttClock, act = (ttActive || []).filter(t => t.hs === f || t.hs2 === f || (t.cpl && t.cpl.unit && t.cpl.unit.hs === f && !(T >= t.cpl.t1)));
  if (act.length) { const t = act.find(x => !x.unit) || act[0]; return { t, s: t.yard ? `${t.yardSt}の車庫 ${t.yardTr}` : `${TYPES[t.shown || t.type].name} ${t.dest}行き${t.no ? ' ' + t.no : ''} ・ ${ttWhere(t)}` }; }
  if (!f.jobs.length) return { s: '今日は運用なし(検車区で待機)' };
  const J0 = f.jobs[0], Jz = f.jobs[f.jobs.length - 1];
  if (T < J0.s) return { s: `${J0.st0} で待機(${J0.yard0 ? '車庫' : '夜間留置など'})` };
  if (T > Jz.e) return { s: `${Jz.st1} で運用を終えた` };
  const prev = f.jobs.filter(J => J.e <= T).pop(); return { s: prev ? `${prev.st1} で消えたまま(次の運用待ち・推定)` : '' };
}
function hsRender(soft) {
  const p = $('dockhs'); if (!p || p.hidden) return;
  if (!HENSEI) { p.innerHTML = '<p class="hint">編成表が入っていません(build/hensei.json)。</p>'; return; }
  if (!HS) { p.innerHTML = '<p class="hint">運行の計算が終わると、編成を当てはめます。</p>'; return; }
  const deps = ['久里浜', '新町', '金沢'], fl = hsFilter;
  const rows = HS.F.filter(f => (!fl.dep || f.dep === fl.dep) && (!fl.cars || f.cars === +fl.cars));
  const fmt = J => { const r = J.ch.filter(x => !x.yard && !x.unit), a = r[0], z = r[r.length - 1]; return J.reserve ? `予備(${J.st0} ${J.ch[0].yardTr})` : a ? `${hm(a.ev[0].dep)} ${a.names[0]} → ${hm(z.ev[z.ev.length - 1].arr)} ${z.names[z.names.length - 1]}(${r.length}本)` : (J.unit ? '増結車' : '車庫'); };
  const body = rows.map(f => { const w = hsWhere(f); return `<tr data-hs="${f.f}" class="${w.t ? 'on' : ''}${w.t && w.t === ttSel ? ' sel' : ''}"><td><b>${f.f}</b>${f.chk ? '<span class="hschk" title="公開資料から再構成・要照合">要照合</span>' : ''}</td><td>${f.kei}</td><td>${f.cars}両</td><td>${f.dep}</td><td>${w.s}</td><td class="hsj">${f.jobs.map(fmt).join('<br>') || '-'}</td></tr>`; }).join('');
  const sum = deps.map(d => { const a = HS.F.filter(f => f.dep === d), u = a.filter(f => f.jobs.some(J => !J.reserve)), rv = a.filter(f => f.jobs.some(J => J.reserve)); return `${d} ${u.length}/${a.length}${rv.length ? '(予備 ' + rv.length + ')' : ''}`; }).join('　');
  const miss = Object.entries(HS.miss).map(([c, n]) => `${c}両 ${n}本`).join('・');
  const tb = `<table class="hstab"><thead><tr><th>編成</th><th>形式</th><th>両数</th><th>検車区</th><th>いま</th><th>今日の運用(推定)</th></tr></thead><tbody>${body}</tbody></table>`;
  if (soft && p.querySelector('.hstab')) { p.querySelector('.hstab').outerHTML = tb; return; }
  p.innerHTML = `<div class="hsbar"><b>編成表</b><label>検車区 <select id="hsdep"><option value="">すべて</option>${deps.map(d => `<option${fl.dep === d ? ' selected' : ''}>${d}</option>`).join('')}</select></label><label>両数 <select id="hscars"><option value="">すべて</option>${[4, 6, 8].map(c => `<option value="${c}"${fl.cars == c ? ' selected' : ''}>${c}両</option>`).join('')}</select></label><span class="hint">今日使う編成 ${sum}${miss ? '　編成が足りず当てられなかったつながり: ' + miss : ''}　行を押すとその列車を選びます</span></div>` + tb +
    '<p class="hint">編成表はユーザー提供の「京急電鉄_3車両基地_編成表」。運用への当てはめは推定(朝いる車庫・夜に入る車庫・走り始める地域を所属とみなし、同じ両数の編成を順に当てる。消えた車両は同じ駅で次に現れる列車に当てる。2100形は都営線に入らない列車だけ)。</p>';
}
