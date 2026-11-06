# patch_sigdiff の続き: 「全部消す」「推定に戻す」ボタンと、保存先(cloud.js)から読むときに del / noest / v を落とさない
import io
def patch(p, pairs):
    s = io.open(p, encoding='utf-8', newline='').read()
    crlf = chr(13) + chr(10) in s
    for a, b in pairs:
        if crlf: a, b = a.replace(chr(10), chr(13) + chr(10)), b.replace(chr(10), chr(13) + chr(10))
        assert s.count(a) == 1, (p, a[:80], s.count(a))
        s = s.replace(a, b)
    io.open(p, 'w', encoding='utf-8', newline='').write(s)

patch('src/dispui.js', [
("D_SIGMAN = D_SIGMAN || { saved: 0, list: {} }; D_SIGMAN.list[id] = []; dSigApply(null); };",
 "D_SIGMAN = D_SIGMAN || { saved: 0, list: {}, v: 2 }; D_SIGMAN.list[id] = []; (D_SIGMAN.noest || (D_SIGMAN.noest = {}))[id] = 1; dSigApply(null); };"),
("if (D_SIGMAN) delete D_SIGMAN.list[id]; dSigApply(null); };",
 "if (D_SIGMAN) { delete D_SIGMAN.list[id]; if (D_SIGMAN.del) delete D_SIGMAN.del[id]; if (D_SIGMAN.noest) delete D_SIGMAN.noest[id]; } dSigApply(null); };"),
])
patch('src/cloud.js', [
("D_SIGMAN = { saved: sig.saved, list: sig.list };", "D_SIGMAN = { saved: sig.saved, list: sig.list, v: sig.v, del: sig.del || {}, noest: sig.noest || {} };"),
("cloudPush('signals', D_SIGMAN);", "cloudPush('signals', typeof dSigData === 'function' ? dSigData() : D_SIGMAN);"),
])
print('ok')
