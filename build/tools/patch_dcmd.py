# 指令の指示と臨時の列車(src/dcmd.js)のための差し込み: disp.js / tt.js / assemble.py
import io, sys
def sub(path, pairs):
    s = io.open(path, encoding='utf-8', newline='').read()
    for a, b in pairs:
        if b in s: continue
        n = s.count(a)
        if n != 1: sys.exit('%s: %d 件 %r' % (path, n, a[:80]))
        s = s.replace(a, b)
    io.open(path, 'w', encoding='utf-8', newline='').write(s)
    print('ok', path)

sub('src/disp.js', [
    # 盤面から外した列車(運転打ち切り・置き換え)は動かさない・在線に数えない
    ("      if (!t.route || t.unit || t.cut || t.yard) continue;\n      const dp = dPrep(t);",
     "      if (!t.route || t.unit || t.cut || t.yard || (t.gOut != null && Tk >= t.gOut)) continue;\n      const dp = dPrep(t);"),
    ("    if (!t.route || t.s == null || isNaN(t.s)) continue;\n    let sp;",
     "    if (!t.route || t.s == null || isNaN(t.s) || (t.gOut != null && D_NOW >= t.gOut)) continue;\n    let sp;"),
    # 救援: 指令の指示で、故障した列車(t.gTgt)のいる区間へ 15km/h で入る(無閉塞運転)
    ("{ if (yudoOK && o.t.dStill && dYudoDirOK(t, s, o)) res = 2; else",
     "{ if ((yudoOK && o.t.dStill && dYudoDirOK(t, s, o)) || o.t === t.gTgt) res = 2; else"),
    ("{ if (shunt && yudoOK && dStandLock(k)) { res = 2; continue; }",
     "{ if (k.t === t.gTgt || (shunt && yudoOK && dStandLock(k))) { res = 2; continue; }"),
    ("if (o && !dPartner(o.t, t) && !(shunt && yudoOK",
     "if (o && !dPartner(o.t, t) && o.t !== t.gTgt && !(shunt && yudoOK"),
    ("const q = D_OCCN.get(nd); if (q && !dPartner(q, t) && !(yudoOK && q.dStill))",
     "const q = D_OCCN.get(nd); if (q && !dPartner(q, t) && q !== t.gTgt && !(yudoOK && q.dStill))"),
    ("  if (obs < Infinity) stopAt = Math.min(stopAt, obs - 8);",
     "  if (obs < Infinity) stopAt = Math.min(stopAt, obs - (p.obsT && p.obsT === t.gTgt ? 1.5 : 8));   // 救援: 連結するので間を詰める"),
])
sub('src/tt.js', [
    ("cs = ttList.filter(t => t.g || t.ph || (t.start <= T && t.end >= L));",
     "cs = ttList.concat(typeof D_DYN !== 'undefined' ? D_DYN : []).filter(t => t.g || t.ph || (t.start <= T && t.end >= L));"),
    ("  for (const t of ttList) {\n    if (!dispTarget(t, T))",
     "  for (const t of ttList.concat(typeof D_DYN !== 'undefined' ? D_DYN : [])) {   // 臨時の列車(指令の指示 src/dcmd.js)も\n    if (!dispTarget(t, T))"),
    ("  const T = ttClock, n = t.names.length; if (t.yard)",
     "  if (t.dyn) { const p = t.ph; if (t.parked) return t.parked + ' 留置'; if (t.stayAt) return t.stayAt + ' 待機'; if (!p) return '区間の外'; const st = t.dp.stops[p.k]; return p.mode === 'dwell' ? (st && st.name ? st.name + ' 停車中' : '停車中') : '→' + (t.dest || ''); }\n  const T = ttClock, n = t.names.length; if (t.yard)"),
])
sub('tools/assemble.py', [
    ("disp=disp+chr(10)+open('src/dinc.js',encoding='utf-8').read()   # 事故・支障",
     "disp=disp+chr(10)+open('src/dinc.js',encoding='utf-8').read()+chr(10)+open('src/dcmd.js',encoding='utf-8').read()   # 事故・支障、指令の指示と臨時の列車"),
])
