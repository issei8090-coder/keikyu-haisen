# 運行番号で1日の運用をつなぐ(表示と、折り返しの相手選び)。1回だけ実行するパッチ
import io
p = 'src/ttcore.js'; s = io.open(p, encoding='utf-8').read()
def rep(old, new):
    global s
    assert s.count(old) == 1, old; s = s.replace(old, new)
rep("// ===== 追い抜きの推定 =====", r"""// ===== 運行番号と車両の所属 =====
// 列車番号から求める。運行番号は奇数で、上り(北行)の列車番号は運行番号から1を引いた偶数なので、偶数なら1を足す(1726T → 27T、1012 → 13)
//  ・末尾の記号が所属: H=京急 K=京成 T=都営 N=北総 F=新京成。京急線内だけの記号(A・B・C・D・SH など)は京急車
//  ・記号の無い番号・途中に記号が入る番号(9B12)は、走る場所から京成車か京急車か決める
//  ・スカイライナー(8AE12)の数字は号数で、1日同じ車両が名乗る番号ではない(chain: false)
const RUN_CO = { H: '京急', K: '京成', T: '都営', N: '北総', F: '新京成' };
function ttRunOf(t) {
  if (t.run !== undefined) return t.run;
  const no = t.no || ''; let m, num = '', co = '', chain = true;
  const odd = v => { const n = +v; return n % 2 ? n : n + 1; };
  const ks = () => { const st = stByName.get(t.ev[0].name); return st && st.stops.length && N[E[st.stops[0][0]].a].y > KS_Y; };
  if ((m = /^(\d{1,2})(\d{2})([A-Z]{1,2})[a-z]?$/.exec(no))) { num = odd(m[2]) + m[3]; co = RUN_CO[m[3]] || '京急'; }
  else if ((m = /^(\d{1,2})([A-Z]{1,2})(\d{2})[a-z]?$/.exec(no))) { chain = m[2] !== 'AE'; num = m[2] + (chain ? String(odd(m[3])).padStart(2, '0') : m[3]); co = '京成'; }
  else if ((m = /^(\d{1,2})(\d{2})[a-z]?$/.exec(no))) { num = String(odd(m[2])).padStart(2, '0'); co = ks() ? '京成' : '京急'; }
  else { num = no; co = no ? (ks() ? '京成' : '京急') : ''; chain = false; }
  return t.run = { num, co, chain, key: chain && num ? co + ' ' + num : null };
}
// ===== 追い抜きの推定 =====""")
rep("""  const pairUp = (as, ds, minT, maxT, ok) => {
    for (const d of ds) {""", """  const pairUp = (as, ds, minT, maxT, ok) => {
    // まず、同じ運行番号の列車どうしをつなぐ(同じ車両がそのまま折り返す)。残りは時刻の近さでつなぐ
    for (const d of ds) {
      const kd = ttRunOf(d).key; if (d.prev || !kd) continue;
      const td = tDep(d); let best = null;
      for (const a of as) if (!a.next && a !== d && ttRunOf(a).key === kd && tArr(a) + 1 <= td && td <= tArr(a) + maxT && ok(a, d) && (!best || tArr(a) > tArr(best))) best = a;
      if (best) { best.next = d; d.prev = best; }
    }
    for (const d of ds) {""")
io.open(p, 'w', encoding='utf-8', newline='').write(s)

p = 'src/tt.js'; s = io.open(p, encoding='utf-8').read()
a = s.index("// 運行番号と車両の所属: 列車番号から求める。"); b = s.index("// 列車のラベル: ")
s = s[:a] + "const ttRun = t => ttRunOf(t);   // 運行番号と所属(ttcore.js)\n" + s[b:]
a = s.index("function ttOpsShow(t, ev) {"); b = s.index("function ttOpsMove(ev)")
s = s[:a] + r"""function ttOpsShow(t, ev) {
  const box = $('ttops'); if (!box) return;
  if (t.unit || t.cut) { box.innerHTML = `<h3>${t.cut ? '品川で切り離した4両' : '金沢文庫の増結車(4両)'}</h3>`; box.hidden = false; ttOpsMove(ev); return; }
  const r = ttRun(t); let rows;
  if (r.key) rows = ttList.filter(x => !x.unit && !x.cut && ttRun(x).key === r.key).sort((a, b) => a.ev[0].dep - b.ev[0].dep);   // 同じ運行番号の列車を1日ぶん
  else { let f = t, guard = 0; while (f.prev && guard++ < 200) f = f.prev; rows = []; for (let x = f, g = 0; x && g < 200; x = x.next, g++) rows.push(x); }   // 号数で走る列車(スカイライナーなど)は折り返しのつながりで
  const n = rows.length, f = rows[0], last = rows[n - 1], end = x => x.names[x.names.length - 1];
  const li = (x, i) => { const ty = TYPES[x.type], p = rows[i - 1]; let gap = '';
    if (p) { const w = x.ev[0].dep - p.ev[p.ev.length - 1].arr; if (end(p) !== x.names[0]) gap = `<li class="gap">${end(p)} → ${x.names[0]} は回送(推定)</li>`; else if (w >= 40) gap = `<li class="gap">${end(p)}で ${w >= 60 ? Math.floor(w / 60) + '時間' + (w % 60 ? w % 60 + '分' : '') : w + '分'} 休み</li>`; }
    return gap + `<li class="${x === t ? 'cur' : ''}"><span class="tm">${hm(x.ev[0].dep)}→${hm(x.ev[x.ev.length - 1].arr)}</span><span style="color:${ty.color}">${ty.name}</span><span>${x.names[0]}→${end(x)}</span><span class="tm">${x.no || ''}</span></li>`; };
  box.innerHTML = `<h3>本日の運用　${r.num} ${r.co}車　(${n}本)</h3><ol>${rows.map(li).join('')}</ol>` +
    `<p>${hm(f.ev[0].dep)} ${f.names[0]}から / ${hm(last.ev[last.ev.length - 1].arr)} ${end(last)}まで。${r.key ? '同じ運行番号の列車を並べたもの' : '折り返しのつながり(時刻からの推定)'}</p>`;
  box.hidden = false; ttOpsMove(ev);
}
""" + s[b:]
io.open(p, 'w', encoding='utf-8', newline='').write(s)

p = 'src/template.html'; s = io.open(p, encoding='utf-8').read()
rep("  #ttops li.cur {", "  #ttops li.gap { color:var(--sub); font-size:11px; padding-left:8px; }\n  #ttops { max-height:calc(100vh - 12px); overflow:hidden; }\n  #ttops li.cur {")
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('patched')
