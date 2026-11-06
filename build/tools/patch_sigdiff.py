# 手で置いた信号機を「推定との差分」にする
#   以前: 信号機を1つでも直すと、その区間の推定の信号機を全部そのときの位置で保存(est=1)し、以後はその一覧だけを使っていた
#         → 推定の置き方を直しても、そのブラウザでは古い出発・場内が残る。区間を全線に延ばしても古い一覧しか効かない
#   今後: 推定はいつも今の推定。保存するのは 手で置いた/直した信号機(from = 置き換えた推定の位置)・消した推定(del)・全部消した区間(noest) だけ
#   古い一覧(v が 2 でない): est=1 は捨てる。手で直したものは、同じ線の60m以内でいちばん近い推定を置き換えたものとみなす
import io
def patch(p, pairs):
    s = io.open(p, encoding='utf-8', newline='').read()
    crlf = chr(13) + chr(10) in s
    for a, b in pairs:
        if crlf: a, b = a.replace(chr(10), chr(13) + chr(10)), b.replace(chr(10), chr(13) + chr(10))
        assert s.count(a) == 1, (p, a[:80], s.count(a))
        s = s.replace(a, b)
    io.open(p, 'w', encoding='utf-8', newline='').write(s)

patch('src/disp.js', [
("""    const man = D_SIGMAN && D_SIGMAN.list[sec.id];
""", """    const man = D_SIGMAN && D_SIGMAN.list[sec.id], noest = !!(D_SIGMAN && D_SIGMAN.noest && D_SIGMAN.noest[sec.id]);
"""),
("""    if (man) {   // 手で置いた信号機だけ
      for (const sp of man) {
        const p = dSigLocate(si, sp.km, sp.y, sp.dn); if (!p) { D_SIGLOST.push(sp); continue; }
        if (sp.k === '中継') { reps.push({ de: p.de, e: p.de >> 1, d: p.de & 1, u: p.u, kind: '中継', st: sp.st || null, asp: 'R', man: false, spec: sp }); continue; }
        const s = dAddSig(p.de, p.u, SIG_KINDS.includes(sp.k) ? sp.k : '閉塞', sp.st || null, true); s.spec = sp;
        if (sp.to) { const q = dSigLocate(si, sp.to.km, sp.to.y, sp.to.dn != null ? sp.to.dn : sp.dn, true) || dSigLocate(si, sp.to.km, sp.to.y, sp.to.dn != null ? 1 - sp.to.dn : 1 - sp.dn, true); s.toE = q ? q.de >> 1 : -1; }
      }
      continue;
    }
""", """    if (man && noest) { dManAdd(si, man, reps); continue; }   // 「全部消す」にした区間: 手で置いた信号機だけ
"""),
("""  const auto = de => !(D_SIGMAN && D_SIGMAN.list[DSEC[dSecOf[de >> 1]].id]);
""", """  const auto = de => !(D_SIGMAN && D_SIGMAN.noest && D_SIGMAN.noest[DSEC[dSecOf[de >> 1]].id]);
"""),
("""  for (const [, list] of sigByDe) for (const s of list) SIGS.push(s);
  SIGS.push(...reps);
""", """  // 手で直した区間: 今の推定から、消した推定・置き換えた推定を外して、手で置いた信号機を足す
  if (D_SIGMAN) { const legacy = D_SIGMAN.v !== 2;
    DSEC.forEach((sec, si) => { const man = D_SIGMAN.list[sec.id]; if (!man || (D_SIGMAN.noest && D_SIGMAN.noest[sec.id])) return;
      for (const x of (D_SIGMAN.del && D_SIGMAN.del[sec.id]) || []) { const p = dSigLocate(si, x.km, x.y, x.dn); if (p) dManDrop(p, 15); }
      for (const sp of man) { if (sp.est) continue;
        if (sp.from) { const p = dSigLocate(si, sp.from.km, sp.from.y, sp.from.dn); if (p) dManDrop(p, 15); }
        else if (legacy) { const p = dSigLocate(si, sp.km, sp.y, sp.dn); const g = p && dManDrop(p, 60); if (g) { const P = dPosOf(g.de, g.u); sp.from = { k: g.kind, km: Math.round(P.km * 1e4) / 1e4, y: Math.round(P.y * 100) / 100, dn: dDn(g.de) }; } }
      }
      for (let i = man.length - 1; i >= 0; i--) if (man[i].est) man.splice(i, 1);   // 推定の位置のままのものは持たない(いつも今の推定を使う)
      dManAdd(si, man, reps); });
    if (legacy) D_SIGMAN.v = 2; }
  for (const [, list] of sigByDe) for (const s of list) SIGS.push(s);
  SIGS.push(...reps);
"""),
("""function dAddSig(de, u, kind, st, exact) {""", """// 手で置いた信号機を足す(est=1 = 推定の位置のまま、は足さない)
function dManAdd(si, man, reps) {
  for (const sp of man) { if (sp.est) continue;
    const p = dSigLocate(si, sp.km, sp.y, sp.dn); if (!p) { D_SIGLOST.push(sp); continue; }
    if (sp.k === '中継') { reps.push({ de: p.de, e: p.de >> 1, d: p.de & 1, u: p.u, kind: '中継', st: sp.st || null, asp: 'R', man: false, spec: sp, usr: true }); continue; }
    const s = dAddSig(p.de, p.u, SIG_KINDS.includes(sp.k) ? sp.k : '閉塞', sp.st || null, true); s.spec = sp; s.usr = true;
    if (sp.to) { const q = dSigLocate(si, sp.to.km, sp.to.y, sp.to.dn != null ? sp.to.dn : sp.dn, true) || dSigLocate(si, sp.to.km, sp.to.y, sp.to.dn != null ? 1 - sp.to.dn : 1 - sp.dn, true); s.toE = q ? q.de >> 1 : -1; }
  }
}
// 推定の信号機を1基外す(p の位置から r m 以内でいちばん近いもの。手で置いたものは外さない)
function dManDrop(p, r) {
  const L = sigByDe.get(p.de); if (!L) return null; let bi = -1, bd = r;
  L.forEach((s, i) => { if (s.usr) return; const d = Math.abs(s.u - p.u); if (d <= bd) { bd = d; bi = i; } });
  return bi >= 0 ? L.splice(bi, 1)[0] : null;
}
function dAddSig(de, u, kind, st, exact) {"""),
])

patch('src/dispui.js', [
("""  if (!D_SIGMAN) D_SIGMAN = { saved: 0, list: {} };
  if (!D_SIGMAN.list[id]) D_SIGMAN.list[id] = SIGS.filter(s => s.sec === si).map(s => { const sp = dSpecAt(s.de, s.u, s.kind); sp.est = 1; s.spec = sp; return sp; });
  return D_SIGMAN.list[id];
}
function dSpecFor(s) { dSecList(s.sec); return s.spec; }
function dSigSave() { D_SIGMAN.saved = Date.now(); try { localStorage.setItem(D_SIGKEY, JSON.stringify(D_SIGMAN)); } catch (e) { } }""",
"""  if (!D_SIGMAN) D_SIGMAN = { saved: 0, list: {}, v: 2 };
  if (!D_SIGMAN.list[id]) D_SIGMAN.list[id] = [];   // 手で置いた・直した信号機だけ(推定はいつも今の推定)
  return D_SIGMAN.list[id];
}
// 信号機の一覧の項目(推定の信号機なら、その位置で作る。直すと from の推定を置き換える)
function dSpecFor(s) {
  if (!s.spec) { const sp = dSpecAt(s.de, s.u, s.kind); sp.est = 1; sp.from = { k: s.kind, km: sp.km, y: sp.y, dn: sp.dn }; dSecList(s.sec).push(sp); s.spec = sp; }
  return s.spec;
}
// 保存する形(推定の位置のままのものは持たない)
function dSigData() { const list = {}; for (const [k, L] of Object.entries(D_SIGMAN.list)) list[k] = L.filter(x => !x.est); return { saved: D_SIGMAN.saved, v: 2, list, del: D_SIGMAN.del || {}, noest: D_SIGMAN.noest || {} }; }
function dSigSave() { D_SIGMAN.saved = Date.now(); D_SIGMAN.v = 2; try { localStorage.setItem(D_SIGKEY, JSON.stringify(dSigData())); } catch (e) { } }"""),
("""function dSigDelete(s) { const L = dSecList(s.sec), i = L.indexOf(dSpecFor(s)); if (i >= 0) L.splice(i, 1); dSigApply(null); }""",
"""function dSigDelete(s) {   // 推定の信号機を消したときは「消した」を覚える(次に推定を作り直しても戻らない)
  const L = dSecList(s.sec), sp = s.spec, id = DSEC[s.sec].id, D = D_SIGMAN.del || (D_SIGMAN.del = {});
  const tomb = x => (D[id] || (D[id] = [])).push({ k: x.k, km: x.km, y: x.y, dn: x.dn });
  if (!sp || sp.est) tomb(dSpecAt(s.de, s.u, s.kind)); else if (sp.from) tomb(sp.from);
  if (sp) { const i = L.indexOf(sp); if (i >= 0) L.splice(i, 1); }
  dSigApply(null);
}"""),
("""  h += `<span class="sg-st">${L ? `手で置いた信号機 ${n}基` + (L.some(x => x.est) ? `(うち推定の位置のまま ${L.filter(x => x.est).length}基)` : '') : `推定の信号機 ${n}基`}</span>`;""",
"""  { const nu = L ? L.filter(x => !x.est).length : 0, nd = ((D_SIGMAN && D_SIGMAN.del && D_SIGMAN.del[id]) || []).length, ne = D_SIGMAN && D_SIGMAN.noest && D_SIGMAN.noest[id];
    h += `<span class="sg-st">信号機 ${n}基(${ne ? '推定なし・手で置いたものだけ' : '推定' + (nu || nd ? `+手で置いた・直した ${nu}基${nd ? `・消した推定 ${nd}基` : ''}` : '')})</span>`; }"""),
("""a.href = URL.createObjectURL(new Blob([JSON.stringify({ saved: D_SIGMAN.saved, list: D_SIGMAN.list }, null, 1)]""",
"""a.href = URL.createObjectURL(new Blob([JSON.stringify(dSigData(), null, 1)]"""),
("""D_SIGMAN = { saved: 0, list: j.list }; dSigMsg(""", """D_SIGMAN = { saved: 0, list: j.list, v: j.v, del: j.del || {}, noest: j.noest || {} }; dSigMsg("""),
])
s = io.open('src/dispui.js', encoding='utf-8').read()
i = s.index("$('sgclr').onclick"); j = s.index('\n', s.index("$('sgauto').onclick"))
print(s[i:j])
