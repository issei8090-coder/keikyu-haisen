# 「本日の運用」の小窓: その列車の車両が走る分だけを出す(両数が変わる所=別の車両 で区切り、当てた列車を含む区間だけ)。1回だけ実行するパッチ
import io
p = 'src/tt.js'; s = io.open(p, encoding='utf-8').read()
def rep(old, new):
    global s
    assert s.count(old) == 1, old; s = s.replace(old, new)
a = s.index("  const n = rows.length, f = rows[0], last = rows[n - 1], end = x => x.names[x.names.length - 1];")
b = s.index("  box.classList.toggle('wide', n > 20);")
s = s[:a] + r"""  const end = x => x.names[x.names.length - 1];
  // 終着時の両数: 金沢文庫で増結した列車は12両。ただし前に付けた4両は品川で切り離すので、品川より先まで行く列車は元の両数
  const endCars = x => { if (!x.cpl) return x.cars; const q = x.names.indexOf('品川'); return x.cpl.side === 'front' && q > x.cpl.i && q < x.names.length - 1 ? x.cars : 12; };
  // 同じ運行番号でも、両数が変わる所は別の車両。当てた列車と同じ車両が走る分だけを残す
  const other = (p, x) => endCars(p) !== x.cars && !(x.added4 && x.prev === p);
  if (r.key) { const k = rows.indexOf(t); let i0 = k, i1 = k; while (i0 > 0 && !other(rows[i0 - 1], rows[i0])) i0--; while (i1 < rows.length - 1 && !other(rows[i1], rows[i1 + 1])) i1++;
    var before = i0 > 0 ? rows[i0 - 1] : null, after = i1 < rows.length - 1 ? rows[i1 + 1] : null; rows = rows.slice(i0, i1 + 1); }
  const n = rows.length, f = rows[0], last = rows[n - 1];
  const li = (x, i) => { const ty = TYPES[x.type], p = rows[i - 1]; let gap = '';
    if (p) { const w = x.ev[0].dep - p.ev[p.ev.length - 1].arr; if (end(p) !== x.names[0]) gap = `<li class="gap">${end(p)} → ${x.names[0]} は回送か入出庫(推定)</li>`; else if (w >= 40) gap = `<li class="gap">${end(p)}で ${w >= 60 ? Math.floor(w / 60) + '時間' + (w % 60 ? w % 60 + '分' : '') : w + '分'} 休み</li>`; }
    return gap + `<li class="${x === t ? 'cur' : ''}"><span class="tm">${hm(x.ev[0].dep)}→${hm(x.ev[x.ev.length - 1].arr)}</span><span style="color:${ty.color}">${ty.name}</span><span>${x.names[0]}→${end(x)}</span><span class="tm">${x.no || ''}</span><span class="tm">${x.cars}両${x.cpl ? '+4' : ''}</span></li>`; };
  const note = [];
  if (before) note.push(`この前の ${before.no}(${endCars(before)}両)は別の車両`);
  if (after) note.push(`この後の ${after.no}(${after.cars}両)は別の車両`);
  box.innerHTML = `<h3>本日の運用　${r.num} ${r.co}車　${f.cars}両　(${n}本)</h3><ol>${rows.map(li).join('')}</ol>` +
    `<p>${hm(f.ev[0].dep)} ${f.names[0]}から / ${hm(last.ev[last.ev.length - 1].arr)} ${end(last)}まで。${r.key ? '同じ運行番号・同じ両数の列車を並べたもの' : '折り返しのつながり(時刻からの推定)'}${note.length ? '<br>' + note.join(' / ') : ''}</p>`;
""" + s[b:]
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('patched')
