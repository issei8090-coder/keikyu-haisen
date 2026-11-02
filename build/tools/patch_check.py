# 信号機の置き方の確かめ(規定の目安から外れているものに印と理由)
import shutil
def patch(p, reps):
    s = open(p, encoding='utf-8').read()
    shutil.copy(p, '_tmp/disp/' + p.split('/')[-1] + '.before_check')
    for a, b in reps:
        assert s.count(a) == 1, (p, a[:70])
        s = s.replace(a, b)
    open(p, 'w', encoding='utf-8').write(s)

CHECK = r"""
// ===== 置き方の確かめ(鉄道信号の規定の目安。スキル tetsudo-shingou) =====
// D_SIGWARN: 信号機 → [理由]、D_LOCWARN: 信号機の無い場所(守られていない分岐)の [{sec, km, by, down, msg}]
const D_SIGWARN = new Map(), D_LOCWARN = [];
const D_ANAME = { R: '停止', YY: '警戒', Y: '注意', YG: '減速', YGF: '抑速', G: '進行' };
const dNP = list => (list || []).filter(f => !E[f >> 1].portal);
// 信号機から前へ(分岐ではまっすぐ): 最初の分岐(sw: 距離・対向/背向)と次の信号機(nx: 中継を除く)
function dWalkF(s, max) {
  let de = s.de, u = s.u, len = 0, sw = null, nx = null;
  for (let g = 0; g < 80 && len <= max; g++) {
    const L = dEm[de >> 1];
    if (!nx) { const ns = (sigByDe.get(de) || []).find(x => x !== s && x.u > u + 0.01 && x.kind !== '中継'); if (ns) nx = { s: ns, d: len + ns.u - u }; }
    len += L - u;
    const sc = dNP(dSuccOf(de));
    if (!sw && len <= max) { if (sc.length >= 2) sw = { d: len, t: '対向' }; else if (sc.length === 1 && dNP(dPred.get(sc[0])).length >= 2) sw = { d: len, t: '背向' }; }
    if ((sw && nx) || !sc.length) break;
    let b = sc[0]; for (const f of sc) if (dDot(de, f) > dDot(de, b)) b = f; de = b; u = 0;
  }
  return { sw, nx };
}
// 信号機から後ろへ: 止まるホーム(st)と最初の分岐(sw)
function dWalkB(s, max) {
  let de = s.de, uE = s.u, len = 0, sw = null, st = null;
  for (let g = 0; g < 80 && len <= max && !st; g++) {
    const e = de >> 1, x = stopX[e];
    if (!isNaN(x) && edgeStation[e] >= 0) { const us = dStopU(e, de & 1, x); if (us <= uE + 0.01) { st = { d: len + uE - us, name: ST[edgeStation[e]].name }; break; } }
    len += uE;
    const pr = dNP(dPred.get(de));
    if (!sw && (pr.length >= 2 || pr.some(p => dNP(dSuccOf(p)).length >= 2))) sw = { d: len };
    if (!pr.length) break;
    let b = pr[0]; for (const f of pr) if (dDot(f, de) > dDot(b, de)) b = f; de = b; uE = dEm[de >> 1];
  }
  return { st, sw };
}
const dVlineAt = (si, km) => { let v = ASP.G; for (const [k0, k1, w] of DSEC[si].vmax || []) if (km >= k0 && km <= k1) v = Math.min(v, w); return v; };
function dSigCheck() {
  D_SIGWARN.clear(); D_LOCWARN.length = 0;
  const add = (s, m) => { if (!D_SIGWARN.has(s)) D_SIGWARN.set(s, []); D_SIGWARN.get(s).push(m); };
  const nAsp = (n, L) => n === 0 ? 'R' : n === 1 ? (L < 260 ? 'YY' : 'Y') : n === 2 ? 'YG' : n === 3 ? 'YGF' : 'G';
  const grp = new Map();
  for (const s of SIGS) {
    if (s.kind === '中継') continue;
    const k = s.de + ':' + Math.round(s.u / 4); if (!grp.has(k)) grp.set(k, []); grp.get(k).push(s);
    if (s.toE === -1) add(s, '指定した進路の線が見つかりません');
    const vl = dVlineAt(s.sec, s.km), f = dWalkF(s, 1500);
    if (s.kind === '場内') {
      const need = vl < 100 ? 80 : 100;
      if (!f.sw || (f.nx && f.nx.d < f.sw.d && f.nx.s.kind === '閉塞')) add(s, '先に分岐がありません(場内は分岐の手前に置く。分岐の無い所なら閉塞)');
      else if (f.sw.d < need) add(s, `最初の分岐(${f.sw.t})まで ${Math.round(f.sw.d)}m。${need}m以上が目安(駅間の最高速度 ${vl < 100 ? '100km/h未満' : '100km/h以上'})`);
    }
    if (s.kind === '出発') {
      const b = dWalkB(s, 500);
      if (!b.st) add(s, '手前500m以内に止まるホームがありません');
      else if (b.sw && b.sw.d < b.st.d) add(s, `ホーム(${b.st.name})と出発の間に分岐があります。出発は分岐の手前に置く`);
      if (f.sw && f.sw.d < D_OVR) add(s, `過走余裕 ${Math.round(f.sw.d)}m(${D_OVR}m未満): 先の分岐がほかの列車に使われているとき、手前の信号機は警戒(出せなければ停止)`);
    }
    if (s.kind === '閉塞' && f.sw && (!f.nx || f.sw.d < f.nx.d)) add(s, `区間の中に分岐(${Math.round(f.sw.d)}m先)があります。分岐を含む所は場内・出発で守る`);
    // 区間の長さと現示: 次の信号機の現示まで落としきれるか(常用ブレーキ・空走3秒)
    if (f.nx && s.kind !== '入換') {
      const L = f.nx.d; let worst = null;
      for (let n = 0; n <= 3; n++) {
        const A1 = dHeadAsp(s, nAsp(n + 1, L)), A2 = dHeadAsp(f.nx.s, nAsp(n, 1e9));
        const v1 = Math.min(ASP[A1] != null ? ASP[A1] : ASP.G, vl), v2 = A2 === 'R' ? 0 : Math.min(ASP[A2] != null ? ASP[A2] : ASP.G, vl);
        if (v1 <= v2) continue;
        const need = v1 / 3.6 * 3 + (v1 * v1 - v2 * v2) / (7.2 * DTR.brake);
        if (need > L && (!worst || need - L > worst.need - L)) worst = { need, A1, A2, v1, v2 };
      }
      if (worst) add(s, `区間 ${Math.round(L)}m: ${D_ANAME[worst.A1]}(${worst.v1}km/h)から次の${D_ANAME[worst.A2]}(${worst.v2}km/h)まで落とすには約${Math.round(worst.need)}m要る`);
    }
  }
  for (const [, g] of grp) if (g.length >= 2 && g.some(s => !(s.spec && s.spec.to))) for (const s of g) add(s, `同じ場所に信号機が${g.length}基あります。それぞれに進路を指定する`);
  // 守られていない分岐: 対向・背向とも、手前 500m 以内に場内・出発・入換が無い
  for (let si = 0; si < DSEC.length; si++) for (const e of DSEC[si].edges) for (const d of [0, 1]) {
    if (!dAllowed(e, d) || E[e].portal) continue; const de = e * 2 + d, sc = dNP(dSuccOf(de));
    const facing = sc.length >= 2, trailing = sc.length === 1 && dNP(dPred.get(sc[0])).length >= 2; if (!facing && !trailing) continue;
    let ok = false, x = de, uE = dEm[e], len = 0;
    for (let g = 0; g < 60 && len <= 500 && !ok; g++) {
      if ((sigByDe.get(x) || []).some(q => q.u <= uE + 0.01 && (q.kind === '場内' || q.kind === '出発' || q.kind === '入換'))) { ok = true; break; }
      len += uE; const pr = dNP(dPred.get(x)); if (!pr.length || dSecOf[pr[0] >> 1] < 0) break;
      let b = pr[0]; for (const f of pr) if (dDot(f, x) > dDot(b, x)) b = f; x = b; uE = dEm[x >> 1];
    }
    if (!ok) { const P = dPosOf(de, dEm[e]); D_LOCWARN.push({ sec: si, km: P.km, by: P.by, down: dDn(de) === 1, msg: `${facing ? '対向' : '背向'}の分岐 ${P.km.toFixed(3)}km(${dDn(de) ? '下り' : '上り'}方向)を守る場内・出発・入換が、手前500m以内にありません` }); }
  }
}
"""

patch('src/disp.js', [
("""// 信号機を置き直す(画面で編集したとき)。列車の経路の表は作り直す""",
CHECK + """// 信号機を置き直す(画面で編集したとき)。列車の経路の表は作り直す"""),
("""  sigByDe.clear(); SIGS.length = 0; dBuildSignals();""", """  sigByDe.clear(); SIGS.length = 0; dBuildSignals(); dSigCheck();"""),
("""dInit();
// ===== 時刻表運転とのつなぎ =====""", """dInit(); dSigCheck();
// ===== 時刻表運転とのつなぎ ====="""),
])

patch('src/dispui.js', [
# 図: 印
("""    const g = el('g', { class: 'bk-sig' + (s.kind === '閉塞' ? ' blk' : '') + (s.spec && !s.spec.est ? ' usr' : ' est') }, gB.sig);
    dSigGlyph(s, g, tb);""",
"""    const g = el('g', { class: 'bk-sig' + (s.kind === '閉塞' ? ' blk' : '') + (s.spec && !s.spec.est ? ' usr' : ' est') + (dEdit && D_SIGWARN.has(s) ? ' warn' : '') }, gB.sig);
    dSigGlyph(s, g, tb);
    if (dEdit && D_SIGWARN.has(s)) { const dir = s.down === false ? -1 : 1; el('text', { x: dir > 0 ? -16 : 16, y: 3.5, class: 'bk-warn' }, g, '!'); }"""),
("""  board.classList.toggle('editing', dEdit);""",
"""  if (dEdit) for (const w of D_LOCWARN) {   // 守られていない分岐
    if (w.sec !== tb.si || w.km < tb.km0 || w.km > tb.km1) continue;
    const g = el('g', { class: 'bk-locw', transform: `translate(${tb.X(w.km).toFixed(1)} ${(tb.Y(w.by) + (w.down ? -9 : 9)).toFixed(1)})` }, gB.sig);
    el('circle', { r: 5.5 }, g); el('text', { y: 3.5 }, g, '!'); el('title', {}, g, w.msg);
  }
  board.classList.toggle('editing', dEdit);"""),
("""    el('title', {}, g, `${s.name}\\n${s.km.toFixed(3)}km(${dSigWhere(s)})`);""",
"""    el('title', {}, g, `${s.name}\\n${s.km.toFixed(3)}km(${dSigWhere(s)})` + (D_SIGWARN.has(s) ? '\\n' + D_SIGWARN.get(s).map(m => '! ' + m).join('\\n') : ''));"""),
# パネル: 選んだ信号機の注意
("""      `<div class="btns">${sp && sp.est ? '<button id="seok">この位置で確定</button>' : ''}""",
"""      (D_SIGWARN.has(s) ? `<ul class="se-warn">${D_SIGWARN.get(s).map(m => `<li>${m}</li>`).join('')}</ul>` : '<p class="dp-sub" style="color:#7fd18b">規定の目安から外れているところはありません</p>') +
      `<div class="btns">${sp && sp.est ? '<button id="seok">この位置で確定</button>' : ''}"""),
# パネル: 何も選んでいないときは一覧
("""  } else if (dEdit) h += `<p class="dp-sub">信号機の編集中:""",
"""  } else if (dEdit) {
    const si = dTabs[dTab].si, ws = SIGS.filter(x => x.sec === si && D_SIGWARN.has(x)).sort((a, b) => a.km - b.km), lw = D_LOCWARN.filter(w => w.sec === si).sort((a, b) => a.km - b.km);
    h += `<div class="dp-title">置き方の確かめ</div><p class="dp-sub">規定の目安から外れている信号機 ${ws.length}基・守られていない分岐 ${lw.length}か所(図の ! 印)</p>` +
      `<ul class="se-warn">${ws.slice(0, 60).map(x => `<li data-wi="${SIGS.indexOf(x)}" style="cursor:pointer"><b>${x.km.toFixed(3)}km ${x.name}</b>: ${D_SIGWARN.get(x).join(' / ')}</li>`).join('')}${lw.slice(0, 30).map(w => `<li>${w.msg}</li>`).join('')}</ul>`;
    h += `<p class="dp-sub">信号機の編集中:"""),
("""(ドラッグで移動、Delete キーで削除)。変えるとすぐに運転に反映され、このブラウザに保存されます。</p>`;""",
"""(ドラッグで移動、Delete キーで削除)。変えるとすぐに運転に反映され、このブラウザに保存されます。</p>`;
  }"""),
("""    const b2 = $('dpman');""",
"""    box.querySelectorAll('[data-wi]').forEach(li => li.onclick = () => dSelectSig(SIGS[+li.dataset.wi]));
    const b2 = $('dpman');"""),
# バー: 件数
("""  h += `<span id="sigmsg">${dEdMsg}</span>`;""",
"""  if (dEdit) { const n1 = SIGS.filter(x => x.sec === si && D_SIGWARN.has(x)).length, n2 = D_LOCWARN.filter(w => w.sec === si).length; h += `<span class="sg-st" style="color:${n1 + n2 ? '#ff8a7a' : '#7fd18b'}">確かめ: ${n1 + n2 ? `! ${n1}基・分岐${n2}か所` : 'なし'}</span>`; }
  h += `<span id="sigmsg">${dEdMsg}</span>`;"""),
])

patch('src/template.html', [
("""  .bk-sig.usr .bk-head { stroke:#9fb3cc; }""",
"""  .bk-sig.usr .bk-head { stroke:#9fb3cc; }
  .bk-sig.warn .bk-head { stroke:#ff5a4d; stroke-width:1.1; }
  .bk-warn { font-size:11px; font-weight:800; fill:#ff5a4d; text-anchor:middle; pointer-events:none; }
  .bk-locw circle { fill:#3a0d0d; stroke:#ff5a4d; stroke-width:1; } .bk-locw text { font-size:9px; font-weight:800; fill:#ff8a7a; text-anchor:middle; }
  .se-warn { margin:6px 0; padding-left:16px; font-size:12px; color:#ffb3aa; } .se-warn li { margin:2px 0; } .se-warn li b { color:#ffd9d3; font-weight:600; }"""),
])
print('ok')
