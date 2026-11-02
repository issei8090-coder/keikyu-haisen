# 実際の運用表(tt.json の ops)のとおりに折り返しをつなぎ、運行番号・所属・「本日の運用」も運用表から出す。1回だけ実行するパッチ
import io
p = 'src/ttcore.js'; s = io.open(p, encoding='utf-8').read()
def rep(old, new, cnt=1):
    global s
    assert s.count(old) == cnt, (s.count(old), old); s = s.replace(old, new)
rep("function ttRunOf(t) {\n  if (t.run !== undefined) return t.run;\n",
    "function ttRunOf(t) {\n  if (t.run !== undefined) return t.run;\n"
    "  // 実際の運用表に載っている列車は、その運用の名前(01T・A01・AE01 など)が運行番号。車両の所属も末尾の文字で決まる(列車番号の末尾が A・C・D の京急線内列車でも、H の運用なら京急車)\n"
    "  if (t.ops && !/行路/.test(t.ops.id)) { const id = t.ops.id, m = /[A-Z]+/.exec(id)[0], c = m === 'A' || m === 'AE' ? '京成' : RUN_CO[m] || '京急'; return t.run = { num: id, co: c, chain: true, key: c + ' ' + id, duty: id }; }\n")
rep("  return t.run = { num, co, chain, key: chain && num ? co + ' ' + num : null };",
    "  return t.run = { num, co, chain, key: chain && num ? co + ' ' + num : null, duty: t.ops ? t.ops.id : null };   // duty: 京急の行路番号(運用表にある列車だけ)")
rep("// ===== 追い抜きの推定 =====",
    "// ===== 実際の運用表 =====\n"
    "// tt.json の ops(tools/mk_ops.js が運用表から作る)を列車に当てはめる。 t.ops = { id: 運用の名前, auth: 折り返しの相手まで分かっている }\n"
    "//  t.opsNext = 着いたあと、そのまま折り返して走る列車   t.opsBrk = 入庫などをはさんで次に走る列車\n"
    "const OPS_MAX = 90;   // 車庫の無い駅で、運用表どおりにホームや引上線で待たせる時間の上限(分)。これより長くあくときは、いったん車庫へ回送したものとみなす\n"
    "function ttOps(list) {\n"
    "  if (list.opsDone || typeof TT === 'undefined' || !TT.ops) return; list.opsDone = true;\n"
    "  const by = new Map(list.map(t => [t.no + '@' + t.ev[0].dep, t]));\n"
    "  let ops = null, best = 0;   // 平日・土休日のどちらの表かは、当てはまる列車の数で決める\n"
    "  for (const d in TT.ops) { let n = 0; for (const k in TT.ops[d]) if (by.has(k)) n++; if (n > best) { best = n; ops = TT.ops[d]; } }\n"
    "  if (!ops || best < Object.keys(ops).length * 0.9) return;\n"
    "  for (const [k, t] of by) { const o = ops[k]; if (!o) continue; t.ops = { id: o[0], auth: !o[3] }; t.run = undefined; if (!o[3]) { t.opsNext = by.get(o[1]) || null; t.opsBrk = by.get(o[2]) || null; } }\n"
    "}\n"
    "// ===== 追い抜きの推定 =====")
rep("function ttLink(list) {\n", "function ttLink(list) {\n  ttOps(list);\n")
rep("  const TURN_MIN = 3;\n",
    "  const TURN_MIN = 3;\n"
    "  // 実際の運用表がある列車は、そのとおりにつなぐ(両数・運行番号・時間の決まりより優先)。表で「ここで終わり」となっている列車は、ほかの列車につながない\n"
    "  const opsOK = (a, d) => (!(a.ops && a.ops.auth) && !(d.ops && d.ops.auth)) || a.opsBrk === d;\n"
    "  for (const a of list) { const d = a.opsNext; if (!d || d.prev || a.next || a.exitEnd || d.exitStart) continue; const w = tDep(d) - tArr(a); if (w < 0) continue;\n"
    "    if (w <= (DEPOT_ST.has(d.names[0]) ? DEPOT_MAX : OPS_MAX)) { a.next = d; d.prev = a; a.opsF = true; } else a.opsBrk = d; }\n")
rep("  const pairOK = (st, a, d) => (a.type === 'liner')", "  const pairOK = (st, a, d) => opsOK(a, d) && (a.type === 'liner')")
rep("        if (p.a && p.a.next) unpair(p.a);", "        if (p.a && p.a.next && !p.a.opsF) unpair(p.a);")
rep("    for (const a of minTurn ? [] : as) {\n      const ta = tArr(a);", "    for (const a of minTurn ? [] : as) {\n      if (a.next) continue;\n      const ta = tArr(a);")
rep("carsOf(a) === d.cars && d.names[1] !== from), ka", "carsOf(a) === d.cars && d.names[1] !== from && opsOK(a, d)), ka")
rep("        unpair(here.reduce((m, p) => tDep(p.next) > tDep(m.next) ? p : m));",
    "        const hs = here.filter(p => !p.opsF); if (!hs.length) break;   // 運用表どおりの組は外さない\n        unpair(hs.reduce((m, p) => tDep(p.next) > tDep(m.next) ? p : m));")
rep("tDep(d) <= tArr(a) + TURN_MAX), kd = ttRunOf(d).key;", "tDep(d) <= tArr(a) + TURN_MAX && opsOK(a, d)), kd = ttRunOf(d).key;")
io.open(p, 'w', encoding='utf-8', newline='').write(s)

p = 'src/tt.js'; s = io.open(p, encoding='utf-8').read()
rep("  ttDay = day; ttList = day ? TT[day].map(ttDecode).filter(t => t.ev.length > 1) : [];\n",
    "  ttDay = day; ttList = day ? TT[day].map(ttDecode).filter(t => t.ev.length > 1) : [];\n  if (day) ttOps(ttList);   // 実際の運用表を当てはめる(運行番号・所属・折り返し)\n")
rep("  if (r.key) rows = ttList.filter(x => !x.unit && !x.cut && ttRun(x).key === r.key)",
    "  if (r.duty) rows = ttList.filter(x => !x.unit && !x.cut && ttRun(x).duty === r.duty).sort((a, b) => a.ev[0].dep - b.ev[0].dep);   // 実際の運用表にある列車: その運用の列車を1日ぶん\n"
    "  else if (r.key) rows = ttList.filter(x => !x.unit && !x.cut && ttRun(x).key === r.key)")
rep("  if (r.key) { const k = rows.indexOf(t); let i0 = k", "  if (r.key && !r.duty) { const k = rows.indexOf(t); let i0 = k")
rep("<h3>本日の運用　${r.num} ${r.co}車　", "<h3>本日の運用　${r.duty && r.duty !== r.num ? r.duty + '　' : ''}${r.num} ${r.co}車　")
rep("${r.key ? '同じ運行番号・同じ両数の列車を並べたもの'", "${r.duty ? '実際の運用表のとおり' : r.key ? '同じ運行番号・同じ両数の列車を並べたもの'")
rep("'　運行番号 ' + ttRun(t).num + '(' + ttRun(t).co + '車)　'", "'　運行番号 ' + ttRun(t).num + '(' + ttRun(t).co + '車)' + (ttRun(t).duty && ttRun(t).duty !== ttRun(t).num ? ' ' + ttRun(t).duty : '') + '　'")
io.open(p, 'w', encoding='utf-8', newline='').write(s)

p = 'tools/patch_t3.py'; s = io.open(p, encoding='utf-8').read()
rep("ARR = {'1416T': 886}", "ARR = {'1416T': 886, '1400D': 866}")
rep("            a += [i1, ARR.get(tr[0], a[-2] + 3), 0]; n += 1; print(day, tr[0], a[-2])",
    "            a += [i1, ARR.get(tr[0], a[-2] + 3), 0]; n += 1; print(day, tr[0], a[-2])\n        elif a[-3] == i1 and tr[0] in ARR and day == 'hd' and len(a) > 5 and a[-6] == i3: a[-2] = ARR[tr[0]]")
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('patched')
