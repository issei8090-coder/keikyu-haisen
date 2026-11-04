# 回送の編集: 始まり・終わりが引上線・留置線のとき(2026-11-04、ユーザー「回送の発車駅は引上線の場合もあるから、そこの発車時刻」
#  「消えるところが引上線の場合、番線表示のところにも引上線がないとおかしい」)
#  1) 番線の欄: 最初の駅(前の列車なし)に「〇〇から出る」、最後の駅(次の列車なし)に「〇〇へ入る」として引上線・留置線を出す。
#     選ぶと begin/fin = {mode:'sd', sd} にする(下の「始まり・終わり」と同じ設定)。ホームを選び直すと戻す。
#  2) 時刻: 引上線から出るなら最初の行の「着」の欄に「引上線を出る」(begin.out)、引上線へ入るなら最後の行の「発」の欄に「ホームを出る」(fin.lv)。
#  3) ttcore: begin.out があれば、引上線を出る時刻からホームに着く時刻を決める(enterFrom の leave)。発が空なら引上線を出て2分後に発車。
#  使い方: build フォルダで python tools/patch_dhsd.py
import io

def patch(p, pairs):
    s = io.open(p, encoding='utf-8', newline='').read()
    NL = '\r\n' if '\r\n' in s else '\n'
    for a, b in pairs:
        a = a.replace('\n', NL); b = b.replace('\n', NL)
        if b in s: continue
        assert s.count(a) == 1, (p, a[:80], s.count(a))
        s = s.replace(a, b)
    io.open(p, 'w', encoding='utf-8', newline='').write(s); print(p, 'ok')

patch('src/opsui.js', [
 # 行の着・発・番線
 ("<td>${i ? `<input data-s=\"arr\" value=\"${opsEsc(s.arr || '')}\" placeholder=\"${i < S.length - 1 && s.pass ? '通過' : ''}\">` : ''}</td><td>${i < S.length - 1 && !(i && s.pass) ? `<input data-s=\"dep\" value=\"${opsEsc(s.dep || '')}\">` : ''}</td><td>${s.st ? `<select data-s=\"plat\" data-hl>${opsTrackOpts(s.st, s.plat)}</select>` : ''}</td>",
  "<td>${i ? `<input data-s=\"arr\" value=\"${opsEsc(s.arr || '')}\" placeholder=\"${i < S.length - 1 && s.pass ? '通過' : ''}\">` : bSd ? `<input data-x=\"begin.out\" value=\"${opsEsc(b.out || '')}\" placeholder=\"引上線を出る\" title=\"引上線・留置線を出る時刻(空ならホームに発車の約2分前に着くように)\">` : ''}</td><td>${i < S.length - 1 && !(i && s.pass) ? `<input data-s=\"dep\" value=\"${opsEsc(s.dep || '')}\"${!i && bSd ? ' placeholder=\"空なら出て2分後\"' : ''}>` : i === S.length - 1 && fSd ? `<input data-x=\"fin.lv\" value=\"${opsEsc(f.lv || '')}\" placeholder=\"ホームを出る\" title=\"ホームを出て引上線・留置線へ入る時刻(空なら着いて40秒後)\">` : ''}</td><td>${s.st ? `<select data-s=\"plat\" data-hl>${opsDhPlatOpts(s, i, S.length, x)}</select>` : ''}</td>"),
 # bSd/fSd
 ("  const b = x.begin || {}, f = x.fin || {};\n  box.innerHTML = `<div class=\"opsform\"><label>列車番号",
  "  const b = x.begin || {}, f = x.fin || {}, bSd = !x.prev && b.mode === 'sd', fSd = !x.next && f.mode === 'sd';\n  box.innerHTML = `<div class=\"opsform\"><label>列車番号"),
 # 番線の選択肢
 ("function opsDhFill() {",
  "// 回送の番線の選択肢: ホームの番線に加えて、最初の駅(前の列車なし)は「〇〇から出る」、最後の駅(次の列車なし)は「〇〇へ入る」の引上線・留置線\n"
  "function opsDhPlatOpts(s, i, n, x) {\n"
  "  const first = i === 0 && !x.prev, last = i === n - 1 && !x.next, g = first ? x.begin : last ? x.fin : null, cur = g && g.mode === 'sd' ? 'sd:' + g.sd : null;\n"
  "  let h = opsTrackOpts(s.st, cur ? '' : s.plat);\n"
  "  if ((first || last) && opsSidings(s.st).length) h += `<optgroup label=\"${first ? '引上線・留置線から出る' : '引上線・留置線へ入る'}\">` + opsSidings(s.st).map(sd => `<option value=\"sd:${sd.e}\"${cur === 'sd:' + sd.e ? ' selected' : ''}>${opsEsc(sd.label)}${first ? 'から出る' : 'へ入る'}</option>`).join('') + '</optgroup>';\n"
  "  return h;\n"
  "}\n"
  "function opsDhFill() {"),
 # 選んだとき
 ("  if (f === 'pass') st.pass = !!s.value; else if (f === 'plat') st.plat = s.value === '' ? '' : +s.value; else st[f] = s.value.trim();",
  "  if (f === 'plat') {   // 引上線・留置線(sd:辺)を選んだら始まり・終わりの設定に。ホームの番線を選び直したら引上線の設定を外す\n"
  "    const i = +tr.dataset.i, gk = i === 0 && !x.prev ? 'begin' : i === x.stops.length - 1 && !x.next ? 'fin' : null;\n"
  "    if (s.value.startsWith('sd:')) { if (gk) { x[gk] = Object.assign({}, x[gk], { mode: 'sd', sd: +s.value.slice(3) }); st.plat = ''; } opsDhRender(); return; }\n"
  "    if (gk && x[gk] && x[gk].mode === 'sd') { delete x[gk]; st.plat = s.value === '' ? '' : +s.value; opsDhRender(); return; }\n"
  "  }\n"
  "  if (f === 'pass') st.pass = !!s.value; else if (f === 'plat') st.plat = s.value === '' ? '' : +s.value; else st[f] = s.value.trim();"),
])

patch('src/ttcore.js', [
 # 回送の始発駅: 発が空で引上線を出る時刻があれば、その2分後に発車
 ("      if (i === 0) { d = D0 != null ? D0 : A0; a = d == null ? null : d - 20; }   // 始発駅: 発車の20秒前にホームに着いている",
  "      if (i === 0) { const bo = x.begin && x.begin.mode === 'sd' && !x.prev ? ttHMS(x.begin.out) : null; d = D0 != null ? D0 : A0 != null ? A0 : bo != null ? bo + 120 : null; a = d == null ? null : d - 20; }   // 始発駅: 発車の20秒前にホームに着いている(引上線から出るなら、発が空のとき出て2分後に発車)"),
 # enterFrom: 引上線を出る時刻(leave)からホームに着く時刻を決める
 ("  function enterFrom(d, sd, from, a1) {   // a1: ホームに戻る時刻(省略すると発車の50秒前)\n    const dep0 = d.ev[0].dep * 60; if (a1 == null) a1 = dep0 - 50;",
  "  function enterFrom(d, sd, from, a1, leave) {   // a1: ホームに戻る時刻(省略すると発車の50秒前)。leave: 引上線を出る時刻(あれば a1 はそこから走る時間で決める)\n    const dep0 = d.ev[0].dep * 60; if (a1 == null) a1 = dep0 - 50;"),
 ("    const tBack = Math.max(15, Math.min(90, r.stopD[1] / 2.5));\n    if (r.stopD[1] / (a1 - Math.max(from, a1 - tBack)) > 4.5) return false;",
  "    const tBack = Math.max(15, Math.min(90, r.stopD[1] / 2.5));\n    if (leave != null) a1 = Math.max(leave + 15, Math.min(dep0 - 10, leave + tBack));\n    if (r.stopD[1] / (a1 - Math.max(from, a1 - tBack)) > 4.5) return false;"),
 # 始まり(sd)で out を使う
 ("      const dep0 = d.ev[0].dep * 60; let a1 = ttHMS(b.back); if (a1 == null) a1 = dep0 - 110;\n      if (a1 > dep0 - 10) { uErr(d, `出庫: ホームに着く時刻 ${ttSHMS(a1)} が発車に近すぎます`); a1 = dep0 - 50; }\n      if (!enterFrom(d, sd, STAY0, a1)) {",
  "      const dep0 = d.ev[0].dep * 60, bo = ttHMS(b.out); let a1 = ttHMS(b.back); if (a1 == null) a1 = dep0 - 110;\n      if (bo != null && bo > dep0 - 25) uErr(d, `出庫: 引上線を出る時刻 ${ttSHMS(bo)} が発車 ${ttSHMS(dep0)} に近すぎます`);\n      if (a1 > dep0 - 10) { uErr(d, `出庫: ホームに着く時刻 ${ttSHMS(a1)} が発車に近すぎます`); a1 = dep0 - 50; }\n      if (!enterFrom(d, sd, STAY0, a1, bo != null && bo <= dep0 - 25 ? bo : null)) {"),
 # 引上線をふさぐのはホームに着くまで(引上線を出る時刻から決めたときは、決めたホームに着く時刻)
 ("      { const by = whoAt(sd.e, STAY0, a1, d); if (by.length) uConf(d, 'sd', st, sd.e, STAY0, a1, by, `出庫: ${sd.label || '留置線'}を朝 ${ttSHMS(a1)} までにほかの列車も使います`); }",
  "      a1 = d.A[1];\n      { const by = whoAt(sd.e, STAY0, a1, d); if (by.length) uConf(d, 'sd', st, sd.e, STAY0, a1, by, `出庫: ${sd.label || '留置線'}を朝 ${ttSHMS(a1)} までにほかの列車も使います`); }"),
])
