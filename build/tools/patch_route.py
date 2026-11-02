# 進路別の信号機(spec.to): その進路を通る列車にだけかかる。同じ場所に並べて置ける
import shutil
def patch(p, reps):
    s = open(p, encoding='utf-8').read()
    shutil.copy(p, '_tmp/disp/' + p.split('/')[-1] + '.before_route')
    for a, b in reps:
        assert s.count(a) == 1, (p, a[:70])
        s = s.replace(a, b)
    open(p, 'w', encoding='utf-8').write(s)

patch('src/disp.js', [
# 置くときに進路の線を解く
("""        const s = dAddSig(p.de, p.u, SIG_KINDS.includes(sp.k) ? sp.k : '閉塞', sp.st || null, true); s.spec = sp;""",
"""        const s = dAddSig(p.de, p.u, SIG_KINDS.includes(sp.k) ? sp.k : '閉塞', sp.st || null, true); s.spec = sp;
        if (sp.to) { const q = dSigLocate(si, sp.to.km, sp.to.y, sp.to.dn != null ? sp.to.dn : sp.dn); s.toE = q ? q.de >> 1 : -1; }"""),
# 名前に進路
("""    s.name = (s.st ? s.st + ' ' : '') + (s.down == null ? '' : s.down ? '下り' : '上り') + s.kind + (s.kind === '閉塞' || s.kind === '中継' ? ' ' + s.km.toFixed(2) + 'k' : '');""",
"""    s.name = (s.st ? s.st + ' ' : '') + (s.down == null ? '' : s.down ? '下り' : '上り') + s.kind + (s.kind === '閉塞' || s.kind === '中継' ? ' ' + s.km.toFixed(2) + 'k' : '') + (s.spec && s.spec.to ? '(→' + (s.spec.to.n || '指定の進路') + ')' : '');"""),
# 経路に載せるのは、進路の指定が無いか、その進路(の線)を通る列車だけ
("""    for (const s of list) { const ts = s.f, lo = Math.min(g.t0, g.t1) - 1e-9, hi = Math.max(g.t0, g.t1) + 1e-9; if (ts < lo || ts > hi) continue; sig.push({ s, m: M[i] + Math.abs(ts - g.t0) * dEm[g.e] }); }""",
"""    for (const s of list) { const ts = s.f, lo = Math.min(g.t0, g.t1) - 1e-9, hi = Math.max(g.t0, g.t1) + 1e-9; if (ts < lo || ts > hi) continue;
      if (s.toE != null) { let ok = false; for (let k = i; k < n && M[k] - M[i] < D_TOVIEW; k++) if (segs[k].e === s.toE) { ok = true; break; } if (!ok) continue; }
      sig.push({ s, m: M[i] + Math.abs(ts - g.t0) * dEm[g.e] }); }"""),
("""function dPrep(t) {""",
"""const D_TOVIEW = 2500;   // 進路別の信号機: この距離(m)先までに指定の線を通るなら、その進路の列車
// 信号機の先の進路の選択肢: 次の信号機(中継を除く)か 1500m までの間の分岐で分かれる行き先。[{ de: 見分ける線, n: 名前, path }]
function dRouteOpts(s) {
  const leaves = [];
  const go = (de, u, len, path, br, depth) => {
    for (let g = 0; g < 80; g++) {
      const L = dEm[de >> 1], nx = (sigByDe.get(de) || []).find(x => x !== s && x.u > u + 0.01 && x.kind !== '中継');
      if (nx || len + L - u > 1500) { leaves.push({ path, br }); return; }
      len += L - u; const sc = dSuccOf(de).filter(f => !E[f >> 1].portal);
      if (!sc.length) { leaves.push({ path, br }); return; }
      if (sc.length >= 2 && depth < 3) { for (const f of sc) go(f, 0, len, path.concat([f]), br.concat([{ from: de, to: f }]), depth + 1); return; }
      let b = sc[0]; for (const f of sc) if (dDot(de, f) > dDot(de, b)) b = f; de = b; u = 0; path = path.concat([b]);
    }
    leaves.push({ path, br });
  };
  go(s.de, s.u, 0, [s.de], [], 0);
  const opts = leaves.filter(l => l.br.length).map(l => {
    const last = l.br[l.br.length - 1].to; let stN = null;
    for (const de of l.path) { const si = edgeStation[de >> 1]; if (si >= 0) { stN = ST[si].name; break; } }
    const straight = l.br.every(b => dSuccOf(b.from).every(f => dDot(b.from, f) <= dDot(b.from, b.to) + 1e-6));
    const end = l.path[l.path.length - 1], P = dPosOf(end, dEm[end >> 1] / 2);
    return { de: last, path: l.path, stN, straight, y: P.y };
  });
  // 同じ「見分ける線」になるものはまとめる
  const uniq = []; for (const o of opts) if (!uniq.some(x => x.de === o.de)) uniq.push(o);
  const ys = [...uniq].sort((a, b) => a.y - b.y);
  for (const o of uniq) {
    const r = ys.indexOf(o), pos = ys.length === 2 ? (r ? '下の線' : '上の線') : ys.length === 3 ? ['上の線', '中の線', '下の線'][r] : '上から' + (r + 1) + '本目';
    o.n = (o.stN ? o.stN + ' ' : '') + pos + (o.straight ? '・直進' : '');
  }
  return uniq;
}
function dPrep(t) {"""),
])

patch('src/dispui.js', [
# 同じ場所の信号機を縦に並べる
("""  // 信号機
  for (const s of SIGS) {
    if (s.sec !== tb.si || s.km < tb.km0 || s.km > tb.km1) continue;""",
"""  // 信号機(同じ場所に複数あるときは縦に並べる)
  { const cnt = new Map(); for (const s of SIGS) { const k = s.de + ':' + Math.round(s.u / 4); s.stackI = cnt.get(k) || 0; cnt.set(k, s.stackI + 1); } }
  for (const s of SIGS) {
    if (s.sec !== tb.si || s.km < tb.km0 || s.km > tb.km1) continue;"""),
("""  const up = s.down !== false, oy = up ? -10 : 10, dir = s.down === false ? -1 : 1;""",
"""  const up = s.down !== false, oy = (up ? -10 : 10) + (up ? -11 : 11) * (s.stackI || 0), dir = s.down === false ? -1 : 1;"""),
("""  if (dEdit) el('text', { x: 0, y: up ? -8 : 15, class: 'bk-sigk' }, g, SIG_MARK[s.kind] || '');""",
"""  if (dEdit) el('text', { x: dir > 0 ? 6 : -6, y: 3, class: 'bk-sigk', 'text-anchor': dir > 0 ? 'start' : 'end' }, g, (SIG_MARK[s.kind] || '') + (s.spec && s.spec.to ? '→' : ''));"""),
# 編集パネル: 進路の行
("""      `<p class="dp-sub">出せる現示: ${dHeadText(sp)}</p>` +""",
"""      `<p class="dp-sub">出せる現示: ${dHeadText(sp)}</p>` +
      `<div class="se-row"><span>進路</span><button data-sr="-1" class="${sp && sp.to ? '' : 'on'}">全部の進路</button>${dRouteOpts(s).map((o, i) => `<button data-sr="${i}" class="${sp && sp.to && s.toE === (o.de >> 1) ? 'on' : ''}">${o.n}</button>`).join('') || '<span class="dp-sub">この先に分岐がありません</span>'}</div>` +
      (s.toE === -1 ? `<p class="dp-sub" style="color:#ff7a7a">指定の進路の線が見つかりません(配線が変わった?)</p>` : '') +
      `<p class="dp-sub">進路を選ぶと、その進路へ進む列車にだけかかります。同じ場所に進路ごとの信号機を並べるときに使います。</p>` +"""),
("""      box.querySelectorAll('[data-sh]').forEach(b =>""",
"""      box.querySelectorAll('[data-sr]').forEach(b => b.onclick = () => {
        const sp = dSpecFor(s), i = +b.dataset.sr;
        if (i < 0) delete sp.to; else { const o = dRouteOpts(s)[i], P = dPosOf(o.de, dEm[o.de >> 1] / 2); sp.to = { km: dR4(P.km), y: dR2(P.y), dn: dDn(o.de), n: o.n }; }
        delete sp.est; dSigApply(sp); });
      box.querySelectorAll('[data-sh]').forEach(b =>"""),
# 進路の線を図で示す(選んでいる信号機)
])
print('ok')
