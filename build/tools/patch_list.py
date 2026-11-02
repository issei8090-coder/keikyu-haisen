# 在線列車の一覧と「本日の運用」のポップアップを追加する(1回だけ実行するパッチ)
import io
p = 'src/template.html'; s = io.open(p, encoding='utf-8').read()
def rep(old, new):
    global s
    assert s.count(old) == 1, old; s = s.replace(old, new)
rep('      <ul id="list"></ul>', '      <ul id="list"></ul>\n      <ul id="ttlist"></ul>')
rep("  #empty, .hint {", """  ul#ttlist { list-style:none; margin:0; padding:0; max-height:420px; overflow-y:auto; }
  #ttlist li { display:flex; align-items:center; gap:6px; padding:3px 6px; border-radius:6px; cursor:pointer; font-size:12.5px; }
  #ttlist li:hover { background:#f3f5f9; }
  #ttlist li.sel { background:#e8ecff; }
  #ttlist .dot { flex:none; width:9px; height:9px; border-radius:50%; }
  #ttlist b { white-space:nowrap; }
  #ttlist .rn { color:var(--sub); font-size:11px; white-space:nowrap; }
  #ttlist small { color:var(--sub); margin-left:auto; font-size:11px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:11.5em; text-align:right; }
  #ttops { position:fixed; z-index:50; background:#fff; border:1px solid #cfd5e3; border-radius:8px; box-shadow:0 6px 22px rgba(20,30,60,.18); padding:8px 10px; font-size:12px; max-width:380px; pointer-events:none; }
  #ttops h3 { margin:0 0 4px; font-size:12.5px; }
  #ttops ol { list-style:none; margin:0; padding:0; }
  #ttops li { display:flex; gap:6px; padding:1px 2px; white-space:nowrap; }
  #ttops li.cur { font-weight:700; background:#eef2ff; border-radius:4px; }
  #ttops li span.tm { color:var(--sub); font-variant-numeric:tabular-nums; }
  #ttops p { margin:4px 0 0; color:var(--sub); font-size:11px; }
  #empty, .hint {""")
rep("</body>", '<div id="ttops" hidden></div>\n</body>')
io.open(p, 'w', encoding='utf-8', newline='').write(s)

p = 'src/ui.js'; s = io.open(p, encoding='utf-8').read()
rep("  $('count').textContent = trains.length;\n  $('empty').hidden = trains.length > 0;",
    "  $('count').textContent = trains.length + (window.ttActiveN || 0);\n  $('empty').hidden = trains.length + (window.ttActiveN || 0) > 0;")
io.open(p, 'w', encoding='utf-8', newline='').write(s)

p = 'src/tt.js'; s = io.open(p, encoding='utf-8').read()
rep("  $('ttcount').textContent = `運行中 ${act.length} 本`;", "  $('ttcount').textContent = `運行中 ${act.length} 本`;\n  ttActive = act;")
rep("      t.g.addEventListener('click', ev => { ev.stopPropagation(); ttSelect(t); });",
    "      t.g.addEventListener('click', ev => { ev.stopPropagation(); ttSelect(t); });\n      t.g.addEventListener('mouseenter', ev => ttOpsShow(t, ev)); t.g.addEventListener('mousemove', ttOpsMove); t.g.addEventListener('mouseleave', ttOpsHide);")
rep("function ttLabels() {", r"""// ===== 在線列車の一覧(時刻表で走っている列車すべて) =====
let ttActive = [];
function ttWhere(t) {   // いまどこにいるか
  const T = ttClock, n = t.names.length; if (t.unit || t.cut) return t.cut ? '品川' : '金沢文庫';
  let k = -1; for (let i = 0; i < n; i++) if (t.A[i + t.k0] <= T) k = i;
  if (k < 0) return t.names[0] + ' 入線';
  const stopAt = i => !t.ev[i].thru;
  if (T <= t.P[k + t.k0] && stopAt(k)) return t.names[k] + (k === n - 1 ? ' 着' : ' 停車中');
  if (k >= n - 1) return t.names[n - 1] + ' 着';
  let a = k, b = k + 1; while (a > 0 && !stopAt(a)) a--; while (b < n - 1 && !stopAt(b)) b++;
  return t.names[a] + '→' + t.names[b];
}
function ttListRender() {
  const ul = $('ttlist'); if (!ul) return;
  const act = ttDay ? ttActive.filter(t => t.g) : [];
  window.ttActiveN = act.length; $('count').textContent = trains.length + act.length; $('empty').hidden = trains.length + act.length > 0;
  const key = act.map(t => t.no + '|' + t.start).join(',');
  if (ul.dataset.key !== key) {
    ul.dataset.key = key; ul.innerHTML = '';
    act.slice().sort((a, b) => (ttRun(a).co + ttRun(a).num).localeCompare(ttRun(b).co + ttRun(b).num, 'ja')).forEach(t => {
      const li = document.createElement('li'), r = ttRun(t);
      li.innerHTML = `<span class="dot"></span><b></b><span class="rn">${t.unit || t.cut ? '' : r.num + ' ' + r.co}</span><small></small>`;
      li.onclick = () => { ttSelect(t); }; li.onmouseenter = ev => ttOpsShow(t, ev); li.onmousemove = ttOpsMove; li.onmouseleave = ttOpsHide;
      t.li2 = li; ul.appendChild(li); });
  }
  for (const t of act) { const li = t.li2; if (!li) continue; const ty = TYPES[t.shown || t.type], s = (t.cut ? '切離4両' : t.unit ? '増結4両' : ty.name + ' ' + shortDest(t.dest));
    if (li._s !== s) { li._s = s; li.children[1].textContent = s; li.children[0].style.background = ty.color; }
    const w = ttWhere(t); if (li._w !== w) { li._w = w; li.children[3].textContent = w; }
    li.classList.toggle('sel', t === ttSel); }
}
setInterval(ttListRender, 1000);
// ===== 本日の運用: その車両が1日に走る列車を、折り返しのつながりでたどって並べる =====
function ttOpsShow(t, ev) {
  const box = $('ttops'); if (!box) return;
  if (t.unit || t.cut) { box.innerHTML = `<h3>${t.cut ? '品川で切り離した4両' : '金沢文庫の増結車(4両)'}</h3>`; box.hidden = false; ttOpsMove(ev); return; }
  let f = t, guard = 0; while (f.prev && guard++ < 200) f = f.prev;
  const rows = []; for (let x = f, g = 0; x && g < 200; x = x.next, g++) rows.push(x);
  const r = ttRun(t), n = rows.length, last = rows[n - 1];
  const li = x => { const ty = TYPES[x.type]; return `<li class="${x === t ? 'cur' : ''}"><span class="tm">${hm(x.ev[0].dep)}→${hm(x.ev[x.ev.length - 1].arr)}</span><span style="color:${ty.color}">${ty.name}</span><span>${x.names[0]}→${x.names[x.names.length - 1]}</span><span class="tm">${x.no || ''}</span></li>`; };
  box.innerHTML = `<h3>本日の運用　${r.num} ${r.co}車　(${n}本)</h3><ol>${rows.map(li).join('')}</ol>` +
    `<p>${f.fromSiding || f.deadIn ? f.names[0] + 'に回送で入線' : f.names[0] + 'から出庫'} / ${last.tail || last.deadOut ? last.names[last.names.length - 1] + '着後、引上線・車庫へ' : last.names[last.names.length - 1] + 'で運用終了'}。折り返しのつながりは時刻からの推定</p>`;
  box.hidden = false; ttOpsMove(ev);
}
function ttOpsMove(ev) { const box = $('ttops'); if (!box || box.hidden || !ev) return; const w = box.offsetWidth, h = box.offsetHeight; let x = ev.clientX + 14, y = ev.clientY + 14;
  if (x + w > innerWidth - 6) x = ev.clientX - w - 14; if (y + h > innerHeight - 6) y = Math.max(6, innerHeight - h - 6); box.style.left = Math.max(6, x) + 'px'; box.style.top = y + 'px'; }
function ttOpsHide() { const box = $('ttops'); if (box) box.hidden = true; }
function ttLabels() {""")
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('patched')
