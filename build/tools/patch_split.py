# 運用表が列車の一部にしか当たらない場合(途中の金沢文庫・京成高砂で車両を取り替える列車)を、その駅で2本に分けて扱う。1回だけ実行するパッチ
#   ops[day][列車番号@始発時刻][4] = 分ける駅の番号(ev の添字)。後ろ半分の運用は ops[day][列車番号@その駅の発車時刻] に入る
import io
def patch(p, pairs):
    s = io.open(p, encoding='utf-8').read()
    for a, b in pairs:
        if b in s: continue
        assert s.count(a) == 1, a[:70]
        s = s.replace(a, b)
    io.open(p, 'w', encoding='utf-8', newline='').write(s)

patch('tools/mk_ops.js', [
("""        else { const k = key(q.t), o = ops[k] || (ops[k] = ['', 0, 0, 0]); o[0] = d.id; if (q.full) { c.当てはまる++; o[3] = 0; } else { c.一部++; if (!ops[k].full) o[3] = 1; }
          if (q.full) Object.defineProperty(o, 'full', { value: true, enumerable: false, configurable: true });
          if (p && pq && pq.j === pq.t.ev.length - 1 && q.i === 0 && p.to === x.from && pq.t !== q.t) { const po = ops[key(pq.t)], slot = x.brk ? 2 : 1; if (po[slot] && po[slot] !== k) c.食い違い++; po[slot] = k; if (!x.brk) { po[2] = 0; c.折り返し++; } } }
        p = x; pq = q; } }""",
"""        else { const last = q.t.ev.length - 1; let k = key(q.t); const o0 = ops[k] || (ops[k] = ['', 0, 0, 0]); let o = o0;
          // 列車の一部にしか当たらない = 途中の駅で車両を取り替える。後ろ半分(q.i から終点)・前半分(始発から q.j)を別の列車として扱う
          if (!q.full && q.i > 0 && q.j === last) { c.一部++; if (!o0.full) { o0[4] = q.i; k = q.t.no + '@' + q.t.ev[q.i].dep; o = ops[k] || (ops[k] = ['', 0, 0, 0]); o[0] = d.id; q.kStart = k; q.kEnd = k; } }
          else if (!q.full && q.i === 0 && q.j < last) { c.一部++; if (!o0.full) { o0[0] = d.id; o0[3] = 0; o0[4] = q.j; q.kStart = k; q.kEnd = k; } }
          else { o[0] = d.id; if (q.full) { c.当てはまる++; o[3] = 0; o[4] = 0; q.kStart = k; q.kEnd = k; } else { c.一部++; if (!o0.full) o[3] = 1; } }
          if (q.full) Object.defineProperty(o, 'full', { value: true, enumerable: false, configurable: true });
          if (p && pq && pq.kEnd && q.kStart && p.to === x.from && pq.kEnd !== q.kStart) { const po = ops[pq.kEnd], slot = x.brk ? 2 : 1; if (po[slot] && po[slot] !== q.kStart) c.食い違い++; po[slot] = q.kStart; if (!x.brk) { po[2] = 0; c.折り返し++; } } }
        p = x; pq = q; } }"""),
])

patch('src/ttcore.js', [
("""  const by = new Map(list.map(t => [t.no + '@' + t.ev[0].dep, t]));
  let ops = null, best = 0;   // 平日・土休日のどちらの表かは、当てはまる列車の数で決める
  for (const d in TT.ops) { let n = 0; for (const k in TT.ops[d]) if (by.has(k)) n++; if (n > best) { best = n; ops = TT.ops[d]; } }
  if (!ops || best < Object.keys(ops).length * 0.9) return;
""",
"""  const by = new Map(list.map(t => [t.no + '@' + t.ev[0].dep, t]));
  let ops = null, best = 0;   // 平日・土休日のどちらの表かは、当てはまる列車の数で決める
  for (const d in TT.ops) { let n = 0; for (const k in TT.ops[d]) if (by.has(k)) n++; if (n > best) { best = n; ops = TT.ops[d]; } }
  if (!ops || best < Object.keys(ops).length * 0.9) return;
  // 途中の駅(金沢文庫・京成高砂)で車両を取り替える列車: その駅で2本に分ける。前半分はその駅止まり(車庫へ)、後ろ半分はその駅始発(車庫から)。
  // 列車番号は同じ。t.swapOut / t.swapIn でたがいを指す
  for (const [k, t] of [...by]) { const o = ops[k], q = o && o[4]; if (!q || q <= 0 || q >= t.ev.length - 1 || t.split) continue;
    const mid = t.ev[q], b = Object.assign({}, t, { ev: [Object.assign({}, mid, { arr: mid.dep }), ...t.ev.slice(q + 1)], fl: t.fl & 2, x0: '', prev: null, next: null, route: undefined,
      tseg: t.tseg ? (l => l.length && l[0][0] === 0 ? l : [[0, t.tseg.filter(([i]) => i <= q).pop()[1]], ...l])(t.tseg.filter(([i]) => i > q).map(([i, y]) => [i - q, y])) : null });
    t.ev = [...t.ev.slice(0, q), Object.assign({}, mid, { dep: mid.arr })]; t.fl &= 1; t.x1 = ''; if (t.tseg) t.tseg = t.tseg.filter(([i]) => i <= q);
    t.split = b.split = true; t.swapOut = b; b.swapIn = t; delete b.A; delete b.P;
    ttSchedule(t); ttSchedule(b); list.push(b); by.set(b.no + '@' + b.ev[0].dep, b); }
"""),
("""function ttOvertakes(list) {
""", """function ttOvertakes(list) {
  ttOps(list);   // 途中で車両を取り替える列車を分けるので、待避の推定より先に当てはめる
"""),
])
print('patched')
