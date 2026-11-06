# 運転指令の範囲を選べるようにする(2026-11-05、ユーザー「京急だけの運転指令」「選べるようにしといて」)
#  'kq' = 京急だけ(既定。都営浅草線の区間 asa1 を外す → 直通列車は泉岳寺の区間の端で時刻表どおりに出入り)、'all' = 京急+都営浅草線
#  ブラウザは localStorage 'kq-disp-scope'(変えたら読み込み直す)、node の検査は環境変数 SCOPE
import io, os, shutil
def patch(p, b, reps):
    if not os.path.exists(b): shutil.copy(p, b)
    raw = io.open(b, encoding='utf-8', newline='').read(); crlf = '\r\n' in raw; s = raw.replace('\r\n', '\n')
    for a, c in reps:
        if s.count(a) != 1: raise SystemExit('nf: ' + p + ' ' + a[:60])
        s = s.replace(a, c)
    if crlf: s = s.replace('\n', '\r\n')
    io.open(p, 'w', encoding='utf-8', newline='').write(s)
patch('src/disp.js', '_tmp/disp.js.before_scope', [(
"const DC = DISP_CFG, DTR = DC.train, ASP = DC.aspects;\n",
"const DC = DISP_CFG, DTR = DC.train, ASP = DC.aspects;\n"
"const D_SCOPE = (() => { if (typeof process !== 'undefined' && process.env) return process.env.SCOPE || 'kq'; try { return localStorage.getItem('kq-disp-scope') || 'kq'; } catch (e) { return 'kq'; } })();   // 運転指令の範囲: 'kq' 京急だけ / 'all' 京急+都営浅草線\n"
"if (D_SCOPE === 'kq') DC.sections = DC.sections.filter(sc => sc.id.startsWith('kq'));   // 直通列車は泉岳寺(区間の端)で時刻表どおりに出入りする\n")])
patch('src/template.html', '_tmp/template.before_scope.html', [(
'''  .pop label small { display:block; color:var(--sub); font-size:11px; }
''',
'''  .pop label small { display:block; color:var(--sub); font-size:11px; }
  .pop label.sel { align-items:center; justify-content:space-between; }
  .pop label.sel select { font:inherit; font-size:12px; padding:3px 6px; border:1px solid var(--line, #ccc); border-radius:6px; background:var(--surface-2, #fff); color:var(--ink); }
'''), (
'''        <label title="泉岳寺〜京急川崎は、実際の距離・加減速・速度制限・信号の現示に従って走らせる"><input id="dispon" type="checkbox" checked><span>実距離・信号で運転<small>泉岳寺〜京急川崎</small></span></label>
''',
'''        <label title="泉岳寺〜京急川崎は、実際の距離・加減速・速度制限・信号の現示に従って走らせる"><input id="dispon" type="checkbox" checked><span>実距離・信号で運転<small>泉岳寺〜京急川崎</small></span></label>
        <label title="切: 遅れた列車は遅れたまま、時刻表の順(固定)に走る。順序の変更は手で。入: 相手が5分以上遅れそう・90秒譲った・待避で5分過ぎた、で自動で先に行く(前の動き)"><input id="dispauto" type="checkbox"><span>自動で順序を変える<small>切 = 固定の順序(遅れは遅れたまま)</small></span></label>
        <label class="sel" title="変えると読み込み直します"><span>運転指令の範囲</span><select id="dispscope"><option value="kq">京急だけ(直通は泉岳寺で出入り)</option><option value="all">京急+都営浅草線</option></select></label>
''')])
patch('src/dispui.js', '_tmp/dispui.js.before_scope', [(
"$('dispon').onchange = () => { dispOn = $('dispon').checked; };",
"$('dispon').onchange = () => { dispOn = $('dispon').checked; };\n"
"$('dispauto').checked = D_AUTO; $('dispauto').onchange = () => { D_AUTO = $('dispauto').checked; };\n"
"$('dispscope').value = D_SCOPE; $('dispscope').onchange = () => { try { localStorage.setItem('kq-disp-scope', $('dispscope').value); } catch (e) { } location.reload(); };")])
print('ok')
