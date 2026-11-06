# 運転指令の画面を整える(2026-11-05、ユーザー「もっと余裕を持たせたい」「安物っぽく見えてデザインがあまり好きではない」)
#  盤: 駅名を各駅の線路のすぐ上に(今までは盤のいちばん上=金沢検車区の高さに揃っていて、線路から300px以上離れていた)、
#      タブを切り替えたら本線が見える高さへ、0.5kmごとの薄い格子、落ち着いた色、列車の札は文字の幅に合わせ種別色の帯つき・間隔を広く。
#  枠: タブと編集バーを上に固定、盤は枠の中でスクロール(横のスクロールバーがいつも見える)、下に凡例、長い説明は「図の見方」に畳む。
#  右: 見出しをいまのタブ名に、出来事は「時刻 | 内容」の2列、数字は3つのタイルに。
#  使い方: build フォルダで python tools/patch_dispdesign.py(元の版は _tmp/ui/*.before_design)
import io, os, shutil
os.makedirs('_tmp/ui', exist_ok=True)
def load(p):
    b = '_tmp/ui/' + os.path.basename(p) + '.before_design'
    if not os.path.exists(b): shutil.copy(p, b)
    s = io.open(b, encoding='utf-8', newline='').read()
    return s, ('\r\n' if '\r\n' in s else '\n')
def rep(s, a, b, nl, label):
    a = a.replace('\n', nl); b = b.replace('\n', nl)
    assert s.count(a) == 1, (label, s.count(a))
    return s.replace(a, b)

# ---------- dispui.js ----------
p = 'src/dispui.js'; s, NL = load(p)
s = rep(s, "let dLay = false, dLaySel = null;   // 配線の編集中・選んだ線か駅\n",
"let dLay = false, dLaySel = null;   // 配線の編集中・選んだ線か駅\nlet dLastTab = -1;   // 前に組み立てたタブ(切り替えたときだけ本線の高さへスクロールする)\n", NL, 'lasttab')
# 0.5km ごとの薄い格子(盤の高さいっぱい)
s = rep(s, """    const x = tb.X(k), major = Math.abs(k - Math.round(k)) < 1e-6;
    el('line', { x1: x, y1: tb.H - 30, x2: x, y2: tb.H - (major ? 20 : 25), class: 'bk-tick' }, gB.static);""",
"""    const x = tb.X(k), major = Math.abs(k - Math.round(k)) < 1e-6;
    el('line', { x1: x, y1: 0, x2: x, y2: tb.H - 30, class: 'bk-grid' + (major ? ' maj' : '') }, gB.static);
    el('line', { x1: x, y1: tb.H - 30, x2: x, y2: tb.H - (major ? 20 : 25), class: 'bk-tick' }, gB.static);""", NL, 'grid')
# 駅名: その駅の線路・ホームのすぐ上に
s = rep(s, """    s.plats.forEach((p, i) => { for (const k of (info.pk && info.pk[i]) || [info.km]) { const px0 = tb.X(k - info.len / 2000, P.si), px1 = tb.X(k + info.len / 2000, P.si), y0 = tb.Y(p[1] + dy, P.si), y1 = tb.Y(p[3] + 1 + dy, P.si); top = Math.min(top, y0); el('rect', { x: px0, y: y0 + 3, width: px1 - px0, height: Math.max(3, y1 - y0 - 6), class: 'bk-plat' }, gB.static); } });   // 線によって止まる点が離れている駅(京急蒲田の空港線側など)は、それぞれの所に
    { const tx = el('text', { x: (x0 + x1) / 2, y: 18, class: 'bk-st' + (dLay ? ' lay' : '') + (dLaySel && dLaySel.st === nm ? ' laysel' : '') }, gB.static, nm); if (dLay) tx.addEventListener('click', ev => { ev.stopPropagation(); dLaySel = { st: nm, si: P.si }; dBuildBoard(); }); }
    el('text', { x: (x0 + x1) / 2, y: 31, class: 'bk-stkm' }, gB.static, dKmShow(sec.sc, info.km).toFixed(1) + 'km');""",
"""    s.plats.forEach((p, i) => { for (const k of (info.pk && info.pk[i]) || [info.km]) { const px0 = tb.X(k - info.len / 2000, P.si), px1 = tb.X(k + info.len / 2000, P.si), y0 = tb.Y(p[1] + dy, P.si), y1 = tb.Y(p[3] + 1 + dy, P.si); top = Math.min(top, y0); el('rect', { x: px0, y: y0 + 3, width: px1 - px0, height: Math.max(3, y1 - y0 - 6), rx: 2, class: 'bk-plat' }, gB.static); } });   // 線によって止まる点が離れている駅(京急蒲田の空港線側など)は、それぞれの所に
    // 駅名はその駅の線路のいちばん上の少し上に(信号機・列車の札の入る 60px を空ける)。盤のいちばん上に揃えると、検車区のある区間では線路から遠く離れていた
    //  ホームのある駅は、ホームのすぐ上の線まで(上に検車区が張り出している金沢八景などで、駅名が検車区の上へ行かないように)
    { const pTop = top; for (const e of sec.edges) { const a = E[e].a, b = E[e].b; if (E[e].portal) continue; const k0 = Math.min(dKm[a], dKm[b]), k1 = Math.max(dKm[a], dKm[b]);
      if (k1 < info.km - info.len / 2000 - 0.06 || k0 > info.km + info.len / 2000 + 0.06) continue; const ya = tb.Y(dBy[a], P.si), yb = tb.Y(dBy[b], P.si);
      if (isFinite(pTop) && Math.min(ya, yb) < pTop - 40) continue; top = Math.min(top, ya, yb); } }
    const ny = isFinite(top) ? Math.max(16, top - 60) : 18; dStY.push(ny);
    { const tx = el('text', { x: (x0 + x1) / 2, y: ny, class: 'bk-st' + (dLay ? ' lay' : '') + (dLaySel && dLaySel.st === nm ? ' laysel' : '') }, gB.static, nm); if (dLay) tx.addEventListener('click', ev => { ev.stopPropagation(); dLaySel = { st: nm, si: P.si }; dBuildBoard(); }); }
    el('text', { x: (x0 + x1) / 2, y: ny + 13, class: 'bk-stkm' }, gB.static, dKmShow(sec.sc, info.km).toFixed(1) + 'km');""", NL, 'stname')
s = rep(s, "  // ホームと駅名\n", "  // ホームと駅名\n  const dStY = [];\n", NL, 'sty')
# タブを切り替えたら本線の高さへ(駅名の高さの中央値)。見出しもタブ名に
s = rep(s, """  document.querySelectorAll('#btabs button').forEach((b, i) => b.classList.toggle('on', i === dTab));
  dSigBar();
  dDraw(true);
}""", """  document.querySelectorAll('#btabs button').forEach((b, i) => b.classList.toggle('on', i === dTab));
  { const h2 = document.querySelector('#dispsec h2'); if (h2) h2.textContent = '運転指令 · ' + tb.name; }
  dSigBar();
  dDraw(true);
  if (dLastTab !== dTab) { dLastTab = dTab; const sc = document.querySelector('.bscroll');
    if (sc && dStY.length) { const v = [...dStY].sort((a, b) => a - b), med = v[Math.floor(v.length / 2)]; sc.scrollTop = Math.max(0, med - 24); sc.scrollLeft = 0; }
    const ab = document.querySelector('#btabs button.on'); if (ab && ab.scrollIntoView) ab.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
}""", NL, 'scroll')
# 列車の札: 文字の幅に合わせ、種別色の帯。上下の間隔を広く
s = rep(s, """  const placed = [];
  for (const L of labs) {
    const w = 84, up = L.right; let y = L.y + (up ? -22 : 22);
    for (let k = 0; k < 6; k++) { if (!placed.some(p => Math.abs(p.x - L.x) < w && Math.abs(p.y - y) < 15)) break; y += up ? -15 : 15; }
    placed.push({ x: L.x, y });
    const t = L.t, p = t.ph, late = p ? p.delay : 0, sp = p ? Math.round(p.v * 3.6) : null;
    const g = el('g', { class: 'bk-lab' + (t === dSel ? ' sel' : ''), transform: `translate(${L.x.toFixed(1)} ${y.toFixed(1)})` }, gB.lab);
    el('line', { x1: 0, y1: 0, x2: 0, y2: (L.y - y) * 0.8, class: 'bk-labline' }, g);
    const txt = `${t.no || TYPES[t.type].short}${sp != null ? ' ' + sp : ''}`, lt = dFmtLate(late);
    el('rect', { x: L.right ? -w + 4 : -4, y: -8, width: w, height: 15, rx: 3, class: 'bk-labbox', stroke: L.ty.color }, g);
    el('text', { x: L.right ? -w + 8 : 0, y: 3.6, class: 'bk-labt', fill: L.ty.color }, g, txt);
    if (lt) el('text', { x: L.right ? 0 : w - 8, y: 3.6, class: 'bk-late', 'text-anchor': 'end' }, g, lt);
    g.addEventListener('click', ev => { ev.stopPropagation(); dSelect(t); });
  }""", """  const placed = [], CW = 6.4;   // 札の文字1つの幅(px、数字・英字)
  for (const L of labs) {
    const t = L.t, p = t.ph, late = p ? p.delay : 0, sp = p ? Math.round(p.v * 3.6) : null;
    const no = t.no || TYPES[t.type].short, lt = dFmtLate(late), spt = sp != null ? String(sp) : '';
    const w = Math.round(13 + no.length * CW + (spt ? 6 + spt.length * CW : 0) + (lt ? 7 + lt.length * CW : 0) + 6), x0 = L.right ? -w + 4 : -4;
    const up = L.right; let y = L.y + (up ? -26 : 26);
    for (let k = 0; k < 6; k++) { if (!placed.some(q => L.x + x0 < q.x1 + 6 && q.x0 - 6 < L.x + x0 + w && Math.abs(q.y - y) < 19)) break; y += up ? -19 : 19; }
    placed.push({ x0: L.x + x0, x1: L.x + x0 + w, y });
    const g = el('g', { class: 'bk-lab' + (t === dSel ? ' sel' : ''), transform: `translate(${L.x.toFixed(1)} ${y.toFixed(1)})` }, gB.lab);
    el('line', { x1: 0, y1: up ? 8 : -8, x2: 0, y2: (L.y - y) * 0.82, class: 'bk-labline' }, g);
    el('rect', { x: x0, y: -8, width: w, height: 16, rx: 4, class: 'bk-labbox', stroke: L.ty.color }, g);
    el('rect', { x: x0, y: -8, width: 3.2, height: 16, rx: 1.6, class: 'bk-labbar', fill: L.ty.color }, g);
    let tx = x0 + 9;
    el('text', { x: tx, y: 3.8, class: 'bk-labt', fill: L.ty.color }, g, no); tx += no.length * CW + 6;
    if (spt) { el('text', { x: tx, y: 3.8, class: 'bk-labv' }, g, spt); }
    if (lt) el('text', { x: x0 + w - 6, y: 3.8, class: 'bk-late', 'text-anchor': 'end' }, g, lt);
    el('title', {}, g, `${no}${spt ? '・' + spt + 'km/h' : ''}${lt ? '・遅れ ' + lt.slice(1) : ''}`);
    g.addEventListener('click', ev => { ev.stopPropagation(); dSelect(t); });
  }""", NL, 'labels')
# 右の出来事と数字
s = rep(s, """  h += `<h2 style="margin-top:12px">最近の出来事</h2><ul class="dp-ev">${ev.map(e => `<li class="k-${e.kind}"><span>${hm(Math.floor(e.T / 60))}</span>${e.no} ${e.text}</li>`).join('') || '<li>なし</li>'}</ul>` +
    `<p class="dp-sub">非常ブレーキ ${D_STAT.emer}・信号冒進 ${D_STAT.spad}・2分以上の停止 ${D_STAT.sigwait}</p>`;""",
"""  h += `<div class="dp-stats"><div class="${D_STAT.emer ? 'bad' : ''}"><b>${D_STAT.emer}</b><span>非常ブレーキ</span></div><div class="${D_STAT.spad ? 'bad' : ''}"><b>${D_STAT.spad}</b><span>信号冒進</span></div><div class="${D_STAT.sigwait ? 'warn' : ''}"><b>${D_STAT.sigwait}</b><span>2分以上停止</span></div></div>` +
    `<h3 class="dp-h">最近の出来事</h3><ul class="dp-ev">${ev.map(e => `<li class="k-${e.kind}"><time>${hm(Math.floor(e.T / 60))}</time><span><b>${e.no}</b> ${e.text}</span></li>`).join('') || '<li class="none">なし</li>'}</ul>`;""", NL, 'events')
# タブ: 線名(小さく)+ 区間
s = rep(s, "dTabs.forEach((tb, i) => { const b = document.createElement('button'); b.textContent = tb.name; b.onclick = () => { dTab = i; dBuildBoard(); }; $('btabs').appendChild(b); });",
"""dTabs.forEach((tb, i) => { const b = document.createElement('button'), sp = tb.name.indexOf(' '), ln = sp > 0 ? tb.name.slice(0, sp) : '', rg = sp > 0 ? tb.name.slice(sp + 1) : tb.name;
  b.innerHTML = `<span class="btl"><i style="--lc:${/都営/.test(ln) ? '#e85298' : '#e60012'}"></i>${ln}</span><span class="btr">${rg}</span>`; b.title = tb.name;
  b.onclick = () => { dTab = i; dBuildBoard(); }; $('btabs').appendChild(b); });""", NL, 'tabs')
io.open(p, 'w', encoding='utf-8', newline='').write(s); print('dispui ok')

s = rep(s, "const D_KMPX = 420, D_YS = 6.6, D_TOP = 72;", "const D_KMPX = 420, D_YS = 6.6, D_TOP = 128;", NL, 'dtop')   # 上のホームの上に駅名(ホームから60px上)が入るだけ空ける
io.open(p, 'w', encoding='utf-8', newline='').write(s); print('dispui dtop ok')

# ---------- template.html ----------
p = 'src/template.html'; s, NL = load(p)
a0 = s.index('  /* ===== 運転指令(盤はどちらのテーマでも暗い) ===== */')
a1 = s.index('  .dp-ev li.k-wait { color:var(--note); }') + len('  .dp-ev li.k-wait { color:var(--note); }')
old = s[a0:a1]
keep = []   # 編集まわり(信号機・配線の編集)の細かい決まりはそのまま残す
for ln in old.replace('\r\n', '\n').split('\n'):
    if any(k in ln for k in ('.bk-yardl', '.bk-laysel', '.bk-layset', '.bk-st.lay', 'svg#board.laying', '.lay-vm', '.bk-yardl.sel', '.bk-sig', '.bk-warn', '.bk-locw', '.se-warn', '.bk-sigk', 'svg#board.editing', '.sg-grp', '.sg-st', '.se-row', '.a-R', '.dp-asp', '.dp-tab', '.dp-title', '.dp-sub', '#dispbox')):
        keep.append(ln)
new = """  /* ===== 運転指令(盤はどちらのテーマでも暗い) ===== */
  .boardwrap { --b-bg:#0b0f15; --b-head:#0f141c; --b-line:#1d2531; --b-line-2:#2a3443; --b-ink:#dfe5ee; --b-sub:#8390a2; --b-faint:#5f6b7c; --b-acc:#4d8dff;
    flex:1; min-width:0; display:flex; flex-direction:column; overflow:hidden; background:var(--b-bg); border:1px solid var(--b-line); border-radius:12px; color:var(--b-ink); }
  .bhead { flex:none; display:flex; flex-direction:column; gap:10px; padding:12px 14px 10px; background:var(--b-head); border-bottom:1px solid var(--b-line); }
  #btabs { display:flex; gap:6px; overflow-x:auto; scrollbar-width:thin; scrollbar-color:#2a3443 transparent; padding-bottom:2px; }
  #btabs button { flex:none; flex-direction:column; align-items:flex-start; gap:2px; min-height:0; padding:6px 13px 7px; background:transparent; border:1px solid var(--b-line-2); border-radius:9px; line-height:1.2; color:var(--b-sub); }
  #btabs button:hover { background:#141b26; border-color:#364256; }
  #btabs .btl { display:flex; align-items:center; gap:6px; font-size:10.5px; letter-spacing:.06em; color:var(--b-faint); }
  #btabs .btl i { width:6px; height:6px; border-radius:50%; background:var(--lc); flex:none; }
  #btabs .btr { font-size:13px; font-weight:700; color:#c3ccd8; white-space:nowrap; }
  #btabs button.on { background:#132036; border-color:#355fae; box-shadow:inset 0 -2px 0 var(--b-acc); }
  #btabs button.on .btr { color:#fff; } #btabs button.on .btl { color:#9fb4d6; }
  #sigbar { display:flex; flex-wrap:wrap; align-items:center; gap:6px 12px; font-size:12px; }
  #sigbar button { background:transparent; border-color:var(--b-line-2); color:#c3ccd8; font-size:12px; padding:3px 10px; min-height:28px; border-radius:7px; }
  #sigbar button:hover { background:#141b26; }
  #sigbar button.on { background:var(--b-acc); border-color:var(--b-acc); color:#fff; font-weight:700; }
  #sigbar button.danger { color:#ff8a80; }
  .bscroll { flex:1; min-height:0; overflow:auto; scrollbar-color:#2a3443 transparent; }
  svg#board { display:block; user-select:none; margin:6px 10px 4px; }
  .bfoot { flex:none; display:flex; flex-wrap:wrap; align-items:center; gap:6px 18px; padding:8px 14px; border-top:1px solid var(--b-line); background:var(--b-head); font-size:11.5px; color:var(--b-sub); }
  .bfoot .lg { display:inline-flex; align-items:center; gap:7px; white-space:nowrap; }
  .bfoot .lg i { display:inline-block; width:20px; height:3px; border-radius:2px; }
  .bfoot .lg i.cars { height:5px; background:repeating-linear-gradient(90deg,#c4cad3 0 5px,transparent 5px 6.5px); }
  .bfoot details { margin-left:auto; position:relative; }
  .bfoot summary { cursor:pointer; color:#aab6c6; list-style:none; padding:2px 8px; border:1px solid var(--b-line-2); border-radius:7px; }
  .bfoot summary::-webkit-details-marker { display:none; }
  .bfoot details[open] summary { background:#141b26; }
  .bfoot details p { position:absolute; right:0; bottom:calc(100% + 8px); width:min(560px,70vw); margin:0; padding:12px 14px; background:#121923; border:1px solid var(--b-line-2); border-radius:10px; box-shadow:0 12px 30px rgba(0,0,0,.5); line-height:1.75; color:#b6c0cd; z-index:5; }
  /* 盤の絵 */
  .bk-grid { stroke:#fff; stroke-opacity:.022; stroke-width:1; } .bk-grid.maj { stroke-opacity:.05; }
  .bk-track { fill:none; stroke:#525d6e; stroke-width:2.4; stroke-linecap:round; stroke-linejoin:round; }
  .bk-plat { fill:#1a2331; stroke:#33415a; stroke-width:.8; }
  .bk-st { font-size:14.5px; fill:#e9eef5; text-anchor:middle; font-weight:700; letter-spacing:.08em; paint-order:stroke; stroke:#0b0f15; stroke-width:4px; stroke-linejoin:round; }
  .bk-stkm { font:10px var(--font-num); fill:#6c7889; text-anchor:middle; paint-order:stroke; stroke:#0b0f15; stroke-width:3px; }
  .bk-tick { stroke:#2c3646; stroke-width:.8; }
  .bk-km { font:10.5px var(--font-num); fill:#6c7889; text-anchor:middle; }
  .bk-bnd { fill:none; stroke:#7a8596; stroke-width:.8; stroke-dasharray:1.5 1; }
  .bk-ends { font-size:11px; fill:#8390a2; font-weight:700; }
  .bk-vmax rect { fill:#b98a2e; opacity:.42; } .bk-vmax.lo rect { fill:#c4553f; opacity:.5; }
  .bk-vmax text { font:700 8.5px var(--font-num); fill:#f3e6c8; text-anchor:middle; pointer-events:none; }
  .bk-lock { fill:none; stroke:#3ccf8e; stroke-width:3.4; stroke-opacity:.8; stroke-linecap:round; pointer-events:none; }
  .bk-occb { fill:none; stroke:#f0605a; stroke-width:3.4; stroke-linecap:round; pointer-events:none; }
  .bk-train { cursor:pointer; }
  .bk-occ { fill:none; stroke:#f0605a; stroke-width:8; stroke-linecap:butt; }
  .bk-body { fill:none; stroke-width:4.4; stroke-linecap:butt; }
  .bk-train.sel .bk-occ { stroke:#fbbf24; }
  .bk-car { fill:none; stroke-width:6.5; stroke-linecap:butt; }
  .bk-car[stroke="#3b3f46"] { stroke:#c4cad3; }
  .bk-selc { fill:none; stroke:#fbbf24; stroke-width:11; stroke-linecap:round; stroke-opacity:.55; }
  .bk-lab { cursor:pointer; }
  .bk-labline { stroke:#3a4556; stroke-width:.8; stroke-dasharray:2 2; }
  .bk-labbox { fill:#0f151e; fill-opacity:.95; stroke-width:1; stroke-opacity:.5; }
  .bk-lab:hover .bk-labbox { stroke-opacity:1; }
  .bk-lab.sel .bk-labbox { fill:#2a2410; stroke:#fbbf24; stroke-opacity:1; }
  .bk-labt { font:700 10.5px var(--font-num); font-variant-numeric:tabular-nums; }
  :root:not([data-theme="light"]) .bk-labt[fill="#3b3f46"], .bk-labt[fill="#3b3f46"] { fill:#d0d6de; }
  .bk-labbar[fill="#3b3f46"] { fill:#9aa4b1; }
  .bk-labv { font:10.5px var(--font-num); fill:#8f9bab; font-variant-numeric:tabular-nums; }
  .bk-late { font:700 10.5px var(--font-num); fill:#fbbf24; font-variant-numeric:tabular-nums; }
""" + '\n'.join(keep) + """
  #sigbar .sg-st, .sg-st { color:var(--b-sub, #8792a2); } #sigmsg { color:#fbbf24; }
  #dispsec { border-left:3px solid var(--accent); }
  .dp-h { font-size:12px; font-weight:700; color:var(--sub); letter-spacing:.06em; margin:14px 0 4px; }
  .dp-stats { display:grid; grid-template-columns:repeat(3,1fr); gap:6px; margin-top:12px; }
  .dp-stats div { background:var(--surface-2); border:1px solid var(--line); border-radius:8px; padding:7px 9px 6px; }
  .dp-stats b { display:block; font:700 18px/1.1 var(--font-num); color:var(--ink); }
  .dp-stats span { font-size:10.5px; color:var(--sub); white-space:nowrap; }
  .dp-stats .bad b { color:var(--bad); } .dp-stats .warn b { color:var(--note); }
  .dp-ev { list-style:none; margin:0; padding:0; max-height:280px; overflow:auto; font-size:12px; }
  .dp-ev li { display:grid; grid-template-columns:40px 1fr; gap:8px; padding:5px 2px; border-bottom:1px solid var(--line); line-height:1.45; }
  .dp-ev li:last-child { border-bottom:none; }
  .dp-ev li time { color:var(--sub); font-family:var(--font-num); font-variant-numeric:tabular-nums; }
  .dp-ev li b { font-family:var(--font-num); font-weight:700; color:var(--ink); }
  .dp-ev li.none { display:block; color:var(--sub); }
  .dp-ev li.k-emer span, .dp-ev li.k-spad span { color:var(--bad); }
  .dp-ev li.k-wait span { color:var(--note); }"""
s = s[:a0] + new.replace('\n', NL) + s[a1:]
# 枠の部品: 上=タブ・編集バー、下=凡例と図の見方
a = """    <div id="btabs"></div>
    <div id="sigbar"></div>
    <div class="bscroll"><svg id="board" xmlns="http://www.w3.org/2000/svg"></svg></div>
    <p class="bnote">"""
b = """    <div class="bhead"><div id="btabs"></div><div id="sigbar"></div></div>
    <div class="bscroll"><svg id="board" xmlns="http://www.w3.org/2000/svg"></svg></div>
    <div class="bfoot"><span class="lg"><i style="background:#3ccf8e"></i>確保された進路</span><span class="lg"><i style="background:#f0605a"></i>在線(閉塞)</span><span class="lg"><i class="cars"></i>列車(1両ずつ)</span><span class="lg"><i style="background:#b98a2e;opacity:.8;height:6px"></i>速度制限</span><span class="lg" style="font-family:var(--font-num)">札 = 列車番号・速度・<span style="color:#fbbf24">遅れ</span></span><details><summary>図の見方</summary><p>"""
s = rep(s, a, b, NL, 'markup')
i = s.index('信号機をクリックすると停止を指示できます。</p>', s.index('<div class="bfoot">'))
s = s[:i] + '信号機をクリックすると停止を指示できます。</p></details></div>' + s[i + len('信号機をクリックすると停止を指示できます。</p>'):]
io.open(p, 'w', encoding='utf-8', newline='').write(s); print('template ok')
