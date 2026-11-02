# 運転指令(実距離・信号)の画面と運転を index.html に組み込む
p = 'src/template.html'; s = open(p, encoding='utf-8').read()
def rep(a, b):
    global s
    assert a in s, a[:70]
    s = s.replace(a, b, 1)
if '/*DISPUI*/' not in s:
    rep("""  <h1>京急線 配線図シミュレーター</h1>""", """  <h1>京急線 配線図シミュレーター</h1>
  <div class="views"><button id="vmap" class="on">配線図</button><button id="vdisp">運転指令</button></div>""")
    rep("""    <label><input id="ttrunno" type="checkbox" checked> 運行番号・所属と交互に表示</label>""", """    <label><input id="ttrunno" type="checkbox" checked> 運行番号・所属と交互に表示</label>
    <label title="泉岳寺〜京急川崎は、実際の距離・加減速・速度制限・信号の現示に従って走らせる"><input id="dispon" type="checkbox" checked> 実距離・信号で運転(泉岳寺〜京急川崎)</label>""")
    rep("""  <div class="mapwrap"><svg id="map" xmlns="http://www.w3.org/2000/svg"></svg></div>""", """  <div class="mapwrap"><svg id="map" xmlns="http://www.w3.org/2000/svg"></svg></div>
  <div class="boardwrap" id="boardwrap" hidden>
    <div id="btabs"></div>
    <div class="bscroll"><svg id="board" xmlns="http://www.w3.org/2000/svg"></svg></div>
    <p class="bnote">横方向は実際のキロ程(駅の営業キロを目印に比例配分)。信号機の位置・ホームの長さ・速度制限は推定で、build/disp_cfg.json で直せます。緑の線=確保された進路、列車は実際の長さ、ラベルは列車番号・速度(km/h)・遅れ。信号機をクリックすると停止を指示できます。</p>
  </div>""")
    rep("""  <aside>
    <section>
      <h2>列車を投入</h2>""", """  <aside>
    <section id="dispsec" hidden>
      <h2>運転指令(泉岳寺〜京急川崎)</h2>
      <div id="dispbox"></div>
    </section>
    <section>
      <h2>列車を投入</h2>""")
    rep("""  @media (max-width: 900px)""", """  /* 運転指令 */
  .views { display:flex; gap:0; }
  .views button { border-radius:0; padding:5px 12px; }
  .views button:first-child { border-radius:7px 0 0 7px; }
  .views button:last-child { border-radius:0 7px 7px 0; border-left:none; }
  .views button.on { background:var(--accent); border-color:var(--accent); color:#fff; font-weight:600; }
  .boardwrap { flex:1; min-width:0; background:#10151d; border:1px solid #2a3240; border-radius:10px; padding:8px; color:#c9d1dc; }
  #btabs { display:flex; flex-wrap:wrap; gap:4px; margin-bottom:6px; }
  #btabs button { background:#1b2330; border-color:#2f3a4b; color:#c9d1dc; font-size:13px; }
  #btabs button.on { background:#2f6fde; border-color:#2f6fde; color:#fff; font-weight:600; }
  .bscroll { overflow-x:auto; }
  svg#board { display:block; width:100%; min-width:900px; height:auto; user-select:none; }
  .bnote { font-size:11.5px; color:#8792a2; margin:6px 2px 0; }
  .bk-track { fill:none; stroke:#5b6676; stroke-width:1.6; stroke-linecap:round; }
  .bk-plat { fill:#2a3446; stroke:#3d4a60; stroke-width:.6; }
  .bk-st { font-size:11px; fill:#e3e8ef; text-anchor:middle; font-weight:600; }
  .bk-stkm { font-size:8px; fill:#8792a2; text-anchor:middle; }
  .bk-tick { stroke:#4a5566; stroke-width:.8; }
  .bk-km { font-size:8.5px; fill:#8792a2; text-anchor:middle; }
  .bk-bnd { fill:none; stroke:#8792a2; stroke-width:.8; stroke-dasharray:1.5 1; }
  .bk-lock { fill:none; stroke:#29c45a; stroke-width:3.4; stroke-opacity:.55; stroke-linecap:butt; pointer-events:none; }
  .bk-train { cursor:pointer; }
  .bk-occ { fill:none; stroke:#ff4d3d; stroke-width:5.4; stroke-linecap:butt; }
  .bk-body { fill:none; stroke-width:3; stroke-linecap:butt; }
  .bk-train.sel .bk-occ { stroke:#ffd23d; }
  .bk-sig { cursor:pointer; }
  .bk-sig .bk-head { fill:#05070a; stroke:#6b7686; stroke-width:.5; }
  .bk-sig .bk-post { stroke:#6b7686; stroke-width:.7; }
  .bk-sig.blk .bk-head { stroke:#4c5666; }
  .bk-sig.man .bk-head { stroke:#ff4d3d; stroke-width:1.2; }
  .bk-sig.sel .bk-head { stroke:#ffd23d; stroke-width:1.2; }
  .bk-lab { cursor:pointer; }
  .bk-labline { stroke:#6b7686; stroke-width:.5; }
  .bk-labbox { fill:#0b0f15; stroke-width:.8; }
  .bk-lab.sel .bk-labbox { fill:#3a3210; }
  .bk-labt { font-size:7.4px; font-weight:700; font-variant-numeric:tabular-nums; }
  .bk-late { font-size:7.4px; font-weight:700; fill:#ffab40; }
  #dispbox { font-size:12.5px; }
  .dp-title { font-weight:700; font-size:14px; }
  .dp-sub { color:var(--sub); font-size:12px; margin:2px 0 6px; }
  .dp-tab { border-collapse:collapse; width:100%; margin:4px 0; }
  .dp-tab th { text-align:left; color:var(--sub); font-weight:500; padding:1px 8px 1px 0; white-space:nowrap; vertical-align:top; }
  .dp-tab td { padding:1px 0; }
  .dp-tab td.late { color:#c22; font-weight:600; }
  .dp-asp { display:inline-block; padding:0 6px; border-radius:4px; color:#fff; font-weight:700; font-size:11.5px; }
  .a-R { background:#d92b20; } .a-KD { background:#777; } .a-YY, .a-Y { background:#d9a300; } .a-YG, .a-YGF { background:linear-gradient(90deg,#d9a300 50%,#1f9d4a 50%); } .a-G { background:#1f9d4a; }
  .dp-ev { list-style:none; margin:0; padding:0; max-height:220px; overflow:auto; font-size:12px; }
  .dp-ev li { padding:1px 0; }
  .dp-ev li span { color:var(--sub); margin-right:6px; font-variant-numeric:tabular-nums; }
  .dp-ev li.k-emer, .dp-ev li.k-spad { color:#c22; }
  .dp-ev li.k-wait { color:#8a5a00; }
  @media (max-width: 900px)""")
    rep("""/*CORE*/
/*UI*/""", """/*CORE*/
/*DISP*/
/*UI*/
/*DISPUI*/""")
    open(p, 'w', encoding='utf-8').write(s)

p = 'src/tt.js'; s = open(p, encoding='utf-8').read()
if 'dispStep' not in s:
    rep("""function ttLoad(day) {
  ttList.forEach(ttKill);""", """function ttLoad(day) {
  ttList.forEach(ttKill); dispReset(ttList); D_EV.length = 0; D_STAT = { spad: 0, emer: 0, sigwait: 0 };""")
    rep("""    else { list.push(...pl.finish()); $('ttinfo')""", """    else { list.push(...pl.finish()); dispPlan(list); $('ttinfo')""")
    rep("""    if (!ttTarget(t, T)) { if (t.g) ttKill(t); t.sv = null; continue; }
    act.push(t);
  }
  ttFollow(act, T, ttDrag || !$('ttfollow').checked ? NaN : ttLastT);""", """    if (!dispTarget(t, T)) { if (t.g) ttKill(t); dispKill(t); t.sv = null; continue; }   // 区間内で遅れている列車は、時刻表の終わりを過ぎても走らせる(disp.js)
    act.push(t);
  }
  ttFollow(act, T, ttDrag || !$('ttfollow').checked ? NaN : ttLastT);
  dispStep(act, T, ttDrag ? NaN : ttLastT);   // 泉岳寺〜京急川崎: 実距離・信号で走らせる""")
    rep("""  if (ttSel && ttSel.g) { const lag = ttSel.tgt - ttSel.s;""", """  if (ttSel && ttSel.g && ttSel.ph) { const p = ttSel.ph; $('ttlate').textContent = `実距離・信号で運転中 ${Math.round(p.v * 3.6)}km/h` + (p.delay >= 30 ? `・${Math.floor(p.delay / 60)}分${Math.floor(p.delay % 60)}秒遅れ` : '・定時') + (p.why ? `(${p.why})` : ''); $('ttlate').className = p.delay >= 60 ? 'late' : ''; }
  else if (ttSel && ttSel.g) { const lag = ttSel.tgt - ttSel.s;""")
    rep("""  if (ttSel) routeHL.setAttribute('d', ttSel.g ? pathD(ttSel.route, ttSel.s, ttSel.route.total) : '');
}""", """  if (ttSel) routeHL.setAttribute('d', ttSel.g ? pathD(ttSel.route, ttSel.s, ttSel.route.total) : '');
  if (typeof dDraw === 'function') dDraw();
}""")
    open(p, 'w', encoding='utf-8').write(s)

p = 'tools/assemble.py'; s = open(p, encoding='utf-8').read()
if 'DISPUI' not in s:
    rep("""t=t.replace('/*DATA*/',open('data.json',encoding='utf-8').read()).replace('/*CORE*/',open('src/core.js',encoding='utf-8').read()).replace('/*UI*/',ui)""",
        """disp=open('src/disp.js',encoding='utf-8').read().replace('/*DISPCFG*/',open('disp_cfg.json',encoding='utf-8').read())
t=t.replace('/*DATA*/',open('data.json',encoding='utf-8').read()).replace('/*CORE*/',open('src/core.js',encoding='utf-8').read()).replace('/*DISP*/',disp).replace('/*UI*/',ui).replace('/*DISPUI*/',open('src/dispui.js',encoding='utf-8').read())""")
    open(p, 'w', encoding='utf-8').write(s)
print('ok')
