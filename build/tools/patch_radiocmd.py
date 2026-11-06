# 無線: 自走できるときの選択肢を増やす・打ち切った列車は消さずに回送で留置・指令から指示(src/radiocmd.js)
import io, sys
def sub(path, pairs, crlf_keep=True):
    s = io.open(path, encoding='utf-8', newline='').read()
    for a, b in pairs:
        if b in s: continue
        n = s.count(a)
        if n != 1: sys.exit('%s: %d 件 %r' % (path, n, a[:70]))
        s = s.replace(a, b)
    io.open(path, 'w', encoding='utf-8', newline='').write(s)
    print('ok', path)

sub('src/radio.js', [
("""  gSay(o.th, o.saidSelf ? `確認しました。応急処置で自走できます。45km/hまでなら走れそうです。` : `確認しました。自走できません。救援をお願いします。`, o.saidSelf ? [
    { l: '45km/h以下で次の駅まで。そこで運転を打ち切り、回送にします', f: () => gCarGo(o, true, 'cut') },
    { l: '45km/h以下で、このまま運転を続けてください', f: () => gCarGo(o, true, 'keep') },
    { l: 'その場で待機してください。救援を手配します', f: () => gRescueMenu(o) }] : [""",
"""  gSay(o.th, o.saidSelf ? `確認しました。応急処置で自走できます。45km/hまでなら走れそうです。` : `確認しました。自走できません。救援をお願いします。`, o.saidSelf ? gSelfMenu(o, true) : ["""),
("""function gCarGo(o, checked, after) {""",
"""// 自走できるときの指示: 打ち切る駅を選ぶ(行っとけ: 留置線・車庫のある駅まで行かせるなど)/続行/組み立て/救援
function gSelfMenu(o, checked) {
  const t = o.t, ah = t.ph ? dAheadStations(t, 60) : [], nx = ah.find(x => x.stop) || ah[0];
  const far = ah.filter(x => x !== nx && (dCanTurn(x.name) || YARD_ST.has(x.name))).slice(0, 5);
  const ch = [];
  if (nx) ch.push({ l: `45km/h以下で次の${nx.name}まで。お客さまを降ろして打ち切り、回送で留置線へ`, f: () => gCarGo(o, checked, nx.name) });
  for (const x of far) ch.push({ l: `45km/h以下で${x.name}まで行って打ち切り、回送で${YARD_ST.has(x.name) ? '車庫' : '留置線'}へ${x.stop ? '' : '(臨時停車)'}`, f: () => gCarGo(o, checked, x.name) });
  ch.push({ l: '45km/h以下で、このまま運転を続けてください', f: () => gCarGo(o, checked, 'keep') });
  ch.push({ l: '指示を組み立てます(行先・種別・折り返し・回送を選ぶ)', f: () => { gCarGo(o, checked, 'hold'); gCmdOpen(t, { cap: 45, inc: o }); } });
  ch.push({ l: 'その場で待機してください。救援を手配します', f: () => gRescueMenu(o) });
  return ch;
}
// 故障した列車を、駅 st で打ち切って回送で留置する(列車は消さずに走らせる)
function gCarCut(o, st, cap) {
  const t = o.t; if (!t.ph) return false;
  t.ph.incStop = null; t.ph.incDw = null;
  const r = dOrder(t, [{ to: st, stops: 'orig' }], D_NOW, { after: 'park', cap });
  if (!r.ok) { gSay(o.th, `${st}までは行けません(${r.msg})。`, gSelfMenu(o, true), 5); return false; }
  o.ok = true; o.dur = Math.max(0, D_NOW - o.T0);
  r.job.onPark = x => { gSay(o.th, `${x.parked}に入りました。`, null, 0); gAfterCut(o); };
  r.job.onFail = (x, e) => gSay(o.th, `${e}。次の指示をください。`, null, 5);
  dEvent(D_NOW, t, 'wait', `${st} で運転打ち切り(回送で留置線へ)`); gScore('運休', -2, `${t.no}: ${st}で打ち切り`);
  const chk = () => { const x = D_DYN.find(d => d.job === r.job && d.endT && d.names[d.names.length - 1] === st); if (x) { gSay(o.th, `${st}に着きました。お客さまを降ろして回送にします。`, null, 0); return; } if (D_DYN.some(d => d.job === r.job)) gLater(10, chk); }; gLater(10, chk);
  return true;
}
function gCarGo(o, checked, after) {"""),
("""  gSay(o.th, `了解、45km/h以下で${after === 'keep' ? '運転を続けます' : '次の駅まで進みます'}。`, null, gDelay(p, 20));
  gLater(gDelay(p, 30), () => { if (!t.ph) return; t.ph.incCap = KMH(45); o.keepCap = true; o.ok = true; o.dur = Math.max(0, D_NOW - o.T0); o.after = after || 'cut'; gWatchNext(o); });""",
"""  if (after === 'hold') { gSay(o.th, '了解、45km/h以下なら走れる状態で、指示を待ちます。', null, gDelay(p, 15)); return; }
  if (!after) { const s0 = gNextStop(t); after = s0 && s0.name ? s0.name : 'keep'; }
  gSay(o.th, `了解、45km/h以下で${after === 'keep' ? '運転を続けます' : after + 'まで進み、打ち切ります'}。`, null, gDelay(p, 20));
  if (after === 'keep') { gLater(gDelay(p, 30), () => { if (!t.ph) return; t.ph.incCap = KMH(45); o.keepCap = true; o.ok = true; o.dur = Math.max(0, D_NOW - o.T0); o.after = 'keep'; gWatchNext(o); }); return; }
  gLater(gDelay(p, 30), () => gCarCut(o, after, 45));"""),
("""  const ch = [];
  if (f) ch.push""", """  const ch = [];
  if (o.saidSelf) ch.push({ l: '(やはり自走させる)', f: () => gSay(o.th, 'どうしますか。', gSelfMenu(o, true), 5) });
  if (f) ch.push"""),
("""  gLater(eta, () => { if (!t.ph) return; t.ph.incCap = KMH(25); o.keepCap = true; o.ok = true; o.dur = Math.max(0, D_NOW - o.T0); o.after = 'cut';
    gSay(o.th, '救援列車と連結しました。25km/h以下で次の駅へ向かいます。', null, 0); gWatchNext(o);
    if (how === 'follow' && x.t) { const f = x.t; const st = gNextStop(t); gLater(30, () => { if (!f.ph) return; const w = () => { if (!f.ph) return; if (t.gOut != null) { f.ph.incCap = null; f.gOut = D_NOW + 150; gSay(o.th2, `${t.no} を${st ? st.name : '駅'}まで送りました。こちらもお客さまを降ろして回送になります。`, null, 0); gScore('運休', -1, `${f.no}: 救援のため打ち切り`); return; } gLater(10, w); }; w(); }); } });""",
"""  gLater(eta, () => { if (!t.ph) return; const st = gNextStop(t);
    gSay(o.th, '救援列車と連結しました。25km/h以下で次の駅へ向かいます。', null, 0);
    if (!st || !st.name || !gCarCut(o, st.name, 25)) { t.ph.incCap = KMH(25); o.keepCap = true; o.ok = true; o.dur = Math.max(0, D_NOW - o.T0); o.after = 'cut'; gWatchNext(o); }
    if (how === 'follow' && x.t) { const f = x.t; if (f.ph) f.ph.incCap = null; gSay(o.th2, `${t.no} を送り出しました。こちらは運転を続けます。`, null, 60); } });"""),
("""<label class="inl rgame"><input id="radioon" type="checkbox" checked> ゲーム</label></h2><div id="radiobox"></div>`;""",
 """<label class="inl rgame"><input id="radioon" type="checkbox" checked> ゲーム</label></h2><div id="radiocmd" hidden></div><div id="radiobox"></div>`;"""),
])
sub('src/template.html', [
("  #incsec { font-size:12.5px; } #incsec[hidden] { display:none; }",
"""  .rcmd { border:1px solid var(--accent); border-radius:8px; padding:7px 8px; margin-bottom:8px; background:var(--surface-2); display:flex; flex-direction:column; gap:6px; }
  .rcmd-hd { display:flex; align-items:center; gap:6px; } .rcmd-hd .rcx { margin-left:auto; min-height:22px; padding:0 7px; }
  .rpre { display:flex; flex-wrap:wrap; gap:4px; } .rpre button { font-size:11.5px; padding:2px 7px; min-height:24px; } .rsub { color:var(--sub); font-size:11px; line-height:1.4; }
  .rrow, .rrow2 { display:flex; align-items:center; gap:4px; flex-wrap:wrap; } .rrow > span:first-child { color:var(--sub); width:1.2em; text-align:right; }
  .rrow select, .rrow2 select { font:inherit; font-size:12px; padding:2px 4px; border:1px solid var(--line-2); border-radius:6px; background:var(--surface); color:var(--ink); max-width:12em; }
  .rrow button, .rrow2 button { font-size:11.5px; padding:1px 7px; min-height:24px; } .rrow2 button.on { background:var(--accent); color:var(--accent-ink); border-color:var(--accent); }
  .rtxt { line-height:1.45; } .rerr { color:var(--warn, #e5484d); line-height:1.4; } .rgo { font-weight:700; }
  #incsec { font-size:12.5px; } #incsec[hidden] { display:none; }"""),
])
sub('tools/assemble.py', [
("open('src/radio.js',encoding='utf-8').read()+chr(10)+open('src/cloud.js'",
 "open('src/radio.js',encoding='utf-8').read()+chr(10)+open('src/radiocmd.js',encoding='utf-8').read()+chr(10)+open('src/cloud.js'"),
])
