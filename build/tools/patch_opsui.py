# 運用の編集の画面: tt.js・template.html・assemble.py
def patch(p, pairs):
    s = open(p, encoding='utf-8', newline='').read()
    NL = '\r\n' if '\r\n' in s else '\n'
    for a, b in pairs:
        a = a.replace('\n', NL); b = b.replace('\n', NL)
        assert s.count(a) == 1, (p, s.count(a), a[:70])
        s = s.replace(a, b)
    open(p, 'w', encoding='utf-8', newline='').write(s)

patch('src/tt.js', [
    ("const TT = /*TT*/;\n", "const TT = /*TT*/;\nconst USER_OPS_FILE = /*OPSUSER*/null;   // 運用の編集(build/ops_user.json)\nlet USER_OPS = null;   // ↑とブラウザの保存を合わせたもの(opsui.js)\n"),
    ("    else { list.push(...pl.finish()); D_DAY = ttDay; dispPlan(list); dispReady = true; ",
     "    else { list.push(...pl.finish()); D_DAY = ttDay; dispPlan(list); dispReady = true; if (typeof opsRefresh === 'function') opsRefresh(); "),
    ("  $('ttlinkinfo').innerHTML = [lk('前の運用', t.prev)", "  $('ttlinkinfo').innerHTML = (typeof opsSelBtns === 'function' ? opsSelBtns(t) : '') + [lk('前の運用', t.prev)"),
    ("{\n  const m = location.hash.match(/tt=", "/*OPSUI*/\n{\n  const m = location.hash.match(/tt="),
])

patch('src/template.html', [
    ("""    <details class="card" id="addcard" open>""", """    <details class="card" id="opscard">
      <summary>運用の編集</summary>
      <p id="opsstat" class="hint"></p>
      <label class="row"><span>駅</span><select id="opsst"></select></label>
      <ul id="opsvan" class="opsl"></ul>
      <div class="btns"><button id="opslink" class="primary" disabled>消える1本と現れる1本を選んでつなぐ</button></div>
      <h3 class="opsh">回送を追加</h3>
      <div class="opsform">
        <label>列車番号<input id="dhno" placeholder="回607C"></label>
        <label>両数<select id="dhcars"><option>4</option><option>6</option><option selected>8</option><option>12</option></select></label>
        <label>発駅<select id="dhfrom"></select></label>
        <label>発<input id="dhdep" placeholder="10:15"></label>
        <label>着駅<select id="dhto"></select></label>
        <label>着<input id="dharr" placeholder="10:40"></label>
        <label>前の列車<input id="dhprev" placeholder="(発駅に着く列車)"></label>
        <label>次の列車<input id="dhnext" placeholder="(着駅から出る列車)"></label>
      </div>
      <div class="btns"><button id="dhadd">回送を追加</button></div>
      <p id="dhmsg" class="hint"></p>
      <h3 class="opsh">編集の一覧</h3>
      <ul id="opsedits" class="opse"></ul>
      <div id="opsmsg"></div>
      <div class="btns"><button id="opsapply" class="primary">反映(計算し直す)</button></div>
      <div class="btns"><button id="opsexp">書き出す</button><button id="opsimp">読み込む</button><button id="opsclr" class="danger">ブラウザの編集を消す</button></div>
      <input id="opsfile" type="file" accept=".json,application/json" hidden>
      <p class="hint">駅を選ぶと、その駅で消える列車(消)と現れる列車(現)が時刻順に出ます。消と現を1本ずつ押して「つなぐ」。「回送」で、その列車につながる回送の入力欄が埋まります。地図で列車を選ぶと、詳細につながりを切る・回送を直すボタンが出ます。編集はこのブラウザに保存されます。いつも効くようにするには「書き出す」で ops_user.json を保存して渡してください。</p>
    </details>
    <details class="card" id="addcard" open>"""),
    ("""  #empty, .hint {""", """  .opsl { list-style:none; margin:8px 0; padding:0; max-height:300px; overflow:auto; border:1px solid var(--line); border-radius:var(--r-s); }
  .opsl li { display:flex; align-items:center; gap:6px; padding:4px 6px; font-size:12px; border-bottom:1px solid var(--line); cursor:pointer; }
  .opsl li:hover { background:var(--surface-2); }
  .opsl li.on { background:var(--accent-soft); outline:1px solid var(--accent); }
  .opsl .om { font-family:var(--font-num); color:var(--ink-2); }
  .opsl .ok { font-weight:700; padding:0 4px; border-radius:4px; }
  .opsl li.oa .ok { color:var(--bad); background:var(--bad-soft); }
  .opsl li.od .ok { color:var(--ok); background:var(--accent-soft); }
  .opsl .on2 { font-family:var(--font-num); font-weight:700; min-width:58px; }
  .opsl .ow { flex:1; color:var(--sub); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .opsl .ob button, .opse button, .opssel button { padding:2px 7px; min-height:24px; font-size:11.5px; }
  .opsh { font-size:12px; color:var(--sub); margin:12px 0 6px; }
  .opsform { display:grid; grid-template-columns:1fr 1fr; gap:6px; }
  .opsform label { display:flex; flex-direction:column; gap:2px; font-size:11.5px; color:var(--sub); }
  .opsform input { border:1px solid var(--line-2); border-radius:var(--r-s); padding:5px 8px; min-height:30px; background:var(--surface-2); color:var(--ink); font:inherit; font-size:12.5px; }
  .opse { list-style:none; margin:0; padding:0; }
  .opse li { display:flex; align-items:center; gap:6px; font-size:12px; padding:3px 0; border-bottom:1px solid var(--line); }
  .opse li span { flex:1; }
  .opswarn { color:var(--warn); font-size:12px; margin:4px 0; }
  .opssel { display:flex; flex-wrap:wrap; gap:4px; margin:4px 0 6px; }
  #empty, .hint {"""),
])

p = 'tools/assemble.py'
s = open(p, encoding='utf-8').read()
a = "tt=open('src/tt.js',encoding='utf-8').read().replace('/*TT*/',open('tt.json',encoding='utf-8').read())"
assert s.count(a) == 1
s = s.replace(a, "import os\nopsu=open('ops_user.json',encoding='utf-8').read() if os.path.exists('ops_user.json') else '{}'\n" + a + ".replace('/*OPSUSER*/null',opsu).replace('/*OPSUI*/',open('src/opsui.js',encoding='utf-8').read())")
open(p, 'w', encoding='utf-8').write(s)
print('ok')
