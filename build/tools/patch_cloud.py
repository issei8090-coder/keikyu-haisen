# 編集の保存先(cloud.js)をつなぐ
def patch(p, pairs):
    s = open(p, encoding='utf-8', newline='').read()
    NL = '\r\n' if '\r\n' in s else '\n'
    for a, b in pairs:
        a = a.replace('\n', NL); b = b.replace('\n', NL)
        assert s.count(a) == 1, (p, s.count(a), a[:70]); s = s.replace(a, b)
    open(p, 'w', encoding='utf-8', newline='').write(s)
patch('src/tt.js', [("""  $('ttday').value = (m && m[1]) || 'wd'; ttLoad($('ttday').value);
  if (m) { ttClock = (+m[2] * 60 + +m[3]) * 60; $('ttime').value = ttClock / 60; }""",
"""  $('ttday').value = (m && m[1]) || 'wd';
  if (m) { ttClock = (+m[2] * 60 + +m[3]) * 60; $('ttime').value = ttClock / 60; }
  // 保存先(cloud.js)の編集を読んでから計算する。cloud.js は同じ script の後ろなので、読み終わってから(マイクロタスク)呼ぶ
  Promise.resolve().then(() => typeof cloudInit === 'function' ? cloudInit() : null).catch(() => { }).then(() => ttLoad($('ttday').value));""")])
patch('src/opsui.js', [("function opsSave() { try { localStorage.setItem('kq-opsuser', JSON.stringify(USER_OPS)); } catch (e) { } opsDirty = true; opsRender(); }",
"function opsSave() { USER_OPS.saved = Date.now(); try { localStorage.setItem('kq-opsuser', JSON.stringify(USER_OPS)); } catch (e) { } if (typeof cloudPush === 'function') cloudPush('ops', USER_OPS); opsDirty = true; opsRender(); }")])
patch('src/template.html', [("""      <summary>運用の編集</summary>
      <p id="opsstat" class="hint"></p>""", """      <summary>運用の編集</summary>
      <div class="inline"><input id="cloudkey" type="password" placeholder="編集キー" autocomplete="off"><button id="cloudkeyset">キーを使う</button></div>
      <p id="cloudmsg" class="hint"></p>
      <p id="opsstat" class="hint"></p>"""),
("""  .opse { list-style:none;""", """  #cloudkey { flex:1; min-width:0; border:1px solid var(--line-2); border-radius:var(--r-s); padding:5px 8px; min-height:32px; background:var(--surface-2); color:var(--ink); font:inherit; }
  .opse { list-style:none;""")])
p = 'tools/assemble.py'; s = open(p, encoding='utf-8').read()
a = ".replace('/*DISPUI*/',open('src/dispui.js',encoding='utf-8').read())"
assert s.count(a) == 1
s = s.replace(a, ".replace('/*DISPUI*/',open('src/dispui.js',encoding='utf-8').read()+'\n'+open('src/cloud.js',encoding='utf-8').read())")
s = s.replace("open('C:/Users/user/keikyu-haisen/index.html','w',encoding='utf-8').write(t)", "open(os.environ.get('OUT','C:/Users/user/keikyu-haisen/index.html'),'w',encoding='utf-8').write(t)")
open(p, 'w', encoding='utf-8').write(s)
print('ok')
