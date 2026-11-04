# 検車区の車庫の線にいる車両はラベルを出さない(線の間隔 6.2 に対して文字 6.6px で重なって読めない)。選んだときだけ出す
import io
def rep(p, a, b):
    s = io.open(p, encoding='utf-8', newline='').read()
    if b in s: print(p, 'already'); return
    assert s.count(a) == 1, (p, s.count(a)); s = s.replace(a, b)
    io.open(p, 'w', encoding='utf-8', newline='').write(s); print(p, 'ok')
rep('src/tt.js', "      t.g = el('g', { class: 'train' }, gTT);", "      t.g = el('g', { class: t.yard ? 'train yardu' : 'train' }, gTT);")
rep('src/template.html', "  .nolabel .tlabel { display:none; }", "  .nolabel .tlabel { display:none; }\n  .yardu .tlabel { display:none; } .yardu.sel .tlabel { display:inline; }   /* 車庫の線の車両はラベルなし(選んだときだけ) */")
