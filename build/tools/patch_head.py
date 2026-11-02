# 信号機の灯(出せる現示)を選べるようにする
import shutil
def patch(p, reps):
    s = open(p, encoding='utf-8').read()
    shutil.copy(p, '_tmp/disp/' + p.split('/')[-1] + '.before_head')
    for a, b in reps:
        assert s.count(a) == 1, (p, a[:60])
        s = s.replace(a, b)
    open(p, 'w', encoding='utf-8').write(s)

patch('src/disp.js', [
("""const SIG_KINDS = ['場内', '出発', '閉塞', '入換', '中継'];""",
"""const SIG_KINDS = ['場内', '出発', '閉塞', '入換', '中継'];
// 信号機の灯(出せる現示)。spec.h。無ければ全部出せる。出せない現示は、警戒→注意、それ以外は一つ上(進行の側)、上に無ければ下へ置き換える
const SIG_HEADS = {
  '5抑': { name: '5灯+抑速', a: ['R', 'YY', 'Y', 'YG', 'YGF', 'G'] },
  '5': { name: '5灯', a: ['R', 'YY', 'Y', 'YG', 'G'] },
  '4警': { name: '4灯(警戒あり)', a: ['R', 'YY', 'Y', 'G'] },
  '4減': { name: '4灯(減速あり)', a: ['R', 'Y', 'YG', 'G'] },
  '3': { name: '3灯', a: ['R', 'Y', 'G'] },
  '2注': { name: '2灯(停止・注意)', a: ['R', 'Y'] },
  '2進': { name: '2灯(停止・進行)', a: ['R', 'G'] },
};
const ASP_ORD = ['R', 'YY', 'Y', 'YG', 'YGF', 'G'];
function dHeadAsp(s, a) {
  const H = s && s.spec && SIG_HEADS[s.spec.h]; if (!H || H.a.includes(a)) return a;
  const i = ASP_ORD.indexOf(a); if (i < 0) return a;
  for (let j = i + 1; j < ASP_ORD.length; j++) if (H.a.includes(ASP_ORD[j])) return ASP_ORD[j];
  for (let j = i - 1; j >= 0; j--) if (H.a.includes(ASP_ORD[j])) return ASP_ORD[j];
  return 'R';
}"""),
("""  let n = 0; for (let k = j; k < j + 5 && lk.has(k) && lk.get(k) !== 2; k++) n++;
  if (n === 1) { const b = t.dp.blocks[j]; return b && b.len < 260 ? 'YY' : 'Y'; }
  return n === 2 ? 'YG' : n === 3 ? 'YGF' : 'G';""",
"""  let n = 0; for (let k = j; k < j + 5 && lk.has(k) && lk.get(k) !== 2; k++) n++;
  const sg = t.dp.sig[j] && t.dp.sig[j].s;
  if (n === 1) { const b = t.dp.blocks[j]; return dHeadAsp(sg, b && b.len < 260 ? 'YY' : 'Y'); }
  return dHeadAsp(sg, n === 2 ? 'YG' : n === 3 ? 'YGF' : 'G');"""),
("""  return n === 0 ? 'R' : n === 1 ? 'Y' : n === 2 ? 'YG' : 'G';
}""",
"""  return dHeadAsp(s, n === 0 ? 'R' : n === 1 ? 'Y' : n === 2 ? 'YG' : 'G');
}"""),
])

patch('src/dispui.js', [
# 編集パネル: 灯の行
("""      `<div class="se-row"><span>位置</span><input id="sekm\"""",
"""      `<div class="se-row"><span>灯</span><button data-sh="" class="${sp && sp.h ? '' : 'on'}">全部</button>${Object.entries(SIG_HEADS).map(([k, H]) => `<button data-sh="${k}" class="${sp && sp.h === k ? 'on' : ''}" title="${H.a.map(a => ASP_NAME[a]).join('・')}">${H.name}</button>`).join('')}</div>` +
      `<p class="dp-sub">出せる現示: ${dHeadText(sp)}</p>` +
      `<div class="se-row"><span>位置</span><input id="sekm\""""),
("""      box.querySelectorAll('[data-sm]').forEach(b => b.onclick = () => dSigMoveBy(s, +b.dataset.sm));""",
"""      box.querySelectorAll('[data-sm]').forEach(b => b.onclick = () => dSigMoveBy(s, +b.dataset.sm));
      box.querySelectorAll('[data-sh]').forEach(b => b.onclick = () => { const sp = dSpecFor(s); if (b.dataset.sh) sp.h = b.dataset.sh; else delete sp.h; delete sp.est; dSigApply(sp); });"""),
# 見るだけのパネルにも灯
("""      `<p>現示: <span class="dp-asp a-${s.asp}">${ASP_NAME[s.asp] || s.asp}</span>${s.asp && ASP[s.asp] != null && s.asp !== 'R' ? ' ' + ASP[s.asp] + 'km/h' : ''}</p>` +""",
"""      `<p>現示: <span class="dp-asp a-${s.asp}">${ASP_NAME[s.asp] || s.asp}</span>${s.asp && ASP[s.asp] != null && s.asp !== 'R' ? ' ' + ASP[s.asp] + 'km/h' : ''}</p>` +
      `<p class="dp-sub">灯: ${s.spec && SIG_HEADS[s.spec.h] ? SIG_HEADS[s.spec.h].name : '指定なし'}(${dHeadText(s.spec)})</p>` +"""),
# 置くときの灯
("""let dEdit = false, dEdKind = '閉塞', dEdDn = 1,""", """let dEdit = false, dEdKind = '閉塞', dEdHead = '', dEdDn = 1,"""),
("""const dR4 = x => Math.round(x * 1e4) / 1e4, dR2 = x => Math.round(x * 100) / 100;""",
"""const dR4 = x => Math.round(x * 1e4) / 1e4, dR2 = x => Math.round(x * 100) / 100;
const dHeadText = sp => (sp && SIG_HEADS[sp.h] ? SIG_HEADS[sp.h].a : ASP_ORD).map(a => ASP_NAME[a]).join('・');"""),
("""    const sp = dSpecAt(p.de, p.u, dEdKind); dSecList(dTabs[dTab].si).push(sp);""",
"""    const sp = dSpecAt(p.de, p.u, dEdKind); if (dEdHead && dEdKind !== '入換' && dEdKind !== '中継') sp.h = dEdHead; dSecList(dTabs[dTab].si).push(sp);"""),
("""      `<span class="sg-grp"><span>向き</span><button data-ed="1\"""",
"""      `<span class="sg-grp"><span>灯</span><select id="sghead"><option value="">全部</option>${Object.entries(SIG_HEADS).map(([k, H]) => `<option value="${k}"${k === dEdHead ? ' selected' : ''}>${H.name}</option>`).join('')}</select></span>` +
      `<span class="sg-grp"><span>向き</span><button data-ed="1\""""),
("""  bar.querySelectorAll('[data-ed]').forEach(b => b.onclick = () => { dEdDn = +b.dataset.ed; dSigBar(); });""",
"""  bar.querySelectorAll('[data-ed]').forEach(b => b.onclick = () => { dEdDn = +b.dataset.ed; dSigBar(); });
  $('sghead').onchange = ev => { dEdHead = ev.target.value; };"""),
])
print('ok')
