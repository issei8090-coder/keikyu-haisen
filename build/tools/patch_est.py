# 信号機の推定を、駅の作りに沿った置き方に作り直す(場内は駅のいちばん外の分岐の手前だけ、閉塞は約300m)
import shutil
p = 'src/disp.js'
s = open(p, encoding='utf-8').read()
shutil.copy(p, '_tmp/disp/disp.js.before_est')
i0 = s.index("    // 1) ホームの先\n")
i1 = s.index("  // 推定の信号機を手で直したもの")
old = s[i0:i1]
assert old.rstrip().endswith('}\n    }\n  }') or True
new = r"""    // 推定(駅の作りに沿って。スキル tetsudo-shingou):
    const NP = l => (l || []).filter(f => !E[f >> 1].portal);
    const isSwEnd = de => { const sc = NP(dSuccOf(de)); return sc.length >= 2 || (sc.length === 1 && NP(dPred.get(sc[0])).length >= 2); };
    const isSwBeg = de => { const pr = NP(dPred.get(de)); return pr.length >= 2 || pr.some(q => NP(dSuccOf(q)).length >= 2); };
    // 1) ホームの先: 分岐のある駅(停車場)は出発、無い駅(停留場)は閉塞。先に分岐があれば、その 15m 手前
    for (const [nm, info] of sec.stInfo) {
      const s = stByName.get(nm), hasSw = info.sw;
      for (const [e, x] of s.stops) for (const d of [0, 1]) if (ES.has(e) && dAllowed(e, d)) dPlaceFwd(e * 2 + d, dStopU(e, d, x) + info.len / 2 + 8, hasSw ? '出発' : '閉塞', nm);
    }
    const des = []; for (const e of sec.edges) for (const d of [0, 1]) if (dAllowed(e, d) && !E[e].portal) des.push(e * 2 + d);
    // 2) 分岐(対向・背向)ごとに、手前をさかのぼって何があるかで決める
    //    手前 150m 以内に信号機・ホーム → 置かない(出発などが守る)
    //    行き止まり(引上線など)から → 入換を 20m 手前
    //    対向で、手前 300m 以内に別の分岐 → 駅の中の分岐なので置かない。300m 以上まっすぐ → 場内を 100m(100km/h 未満は 80m)手前
    //    背向で、手前 150m 以内に別の分岐 → 置かない。150m 以上 → ホームの無い線(通過線)の出口なので出発を 15m 手前
    for (const de of des) {
      if (!isSwEnd(de)) continue;
      const facing = NP(dSuccOf(de)).length >= 2, vl = dVlineAt(DSEC.indexOf(sec), dPosOf(de, dEm[de >> 1]).km), need = vl < 100 ? 80 : 100;
      let x = de, uE = dEm[de >> 1], len = 0, what = 'plain';
      for (let g = 0; g < 60 && len < 600; g++) {
        const e = x >> 1;
        if ((sigByDe.get(x) || []).some(q => q.u <= uE + 0.01 && len + uE - q.u < 150)) { what = 'sig'; break; }
        if (!isNaN(stopX[e]) && edgeStation[e] >= 0 && dStopU(e, x & 1, stopX[e]) <= uE + 0.01 && len + uE - dStopU(e, x & 1, stopX[e]) < 400) { what = 'stop'; break; }
        len += uE;
        const pr = NP(dPred.get(x));
        if (!pr.length) { what = 'dead'; break; }
        if (dSecOf[pr[0] >> 1] < 0) break;
        if (pr.length >= 2 || pr.some(q => NP(dSuccOf(q)).length >= 2)) { what = 'sw'; break; }
        let b = pr[0]; for (const f of pr) if (dDot(f, x) > dDot(b, x)) b = f; x = b; uE = dEm[x >> 1];
      }
      if (what === 'sig' || what === 'stop') continue;
      if (what === 'dead') { dPlaceBack(de, dEm[de >> 1], 20, 60, '入換', null); continue; }
      if (what === 'sw') {
        if (facing ? len < 300 : len < 150) continue;
        if (!facing) { dPlaceBack(de, dEm[de >> 1], 15, 150, '出発', null); continue; }
      }
      dPlaceBack(de, dEm[de >> 1], need, need + 50, '場内', null);
    }
    // 区間の入口(図の外から入ってくる所)も信号機の区切りとみなす
    const entries = sec.entries;
    // 3) 分岐の無い一本道に、約 BLK m ごとの閉塞信号(分岐の出口からは 60m 以上あける)
    const BLK = (DC.dispatch && DC.dispatch.blockLen) || 300;
    const walk = (de, u0) => {   // de 上の u0 から先へ、次の信号機・分岐・合流・区間の端まで。[{de,u0,u1}] と全長
      const path = []; let len = 0, cur = de, u = u0;
      for (let g = 0; g < 60; g++) {
        const L = dEm[cur >> 1], nx = (sigByDe.get(cur) || []).find(s => s.u > u + 0.01);
        if (nx) { path.push({ de: cur, u0: u, u1: nx.u }); len += nx.u - u; return { path, len, end: 'sig' }; }
        path.push({ de: cur, u0: u, u1: L }); len += L - u;
        const sc = NP(dSuccOf(cur)); if (sc.length !== 1 || NP(dPred.get(sc[0])).length > 1) return { path, len, end: 'sw' };
        cur = sc[0]; u = 0;
      }
      return { path, len, end: 'far' };
    };
    const starts = [];
    for (const [de, list] of sigByDe) if (dSecOf[de >> 1] === DSEC.indexOf(sec)) for (const s of list) starts.push([de, s.u, 0]);
    for (const de of entries) starts.push([de, 0, 0]);
    for (const de of des) if (isSwBeg(de) && !(sigByDe.get(de) || []).some(s => s.u < 60)) starts.push([de, 0, 60]);
    for (const [de, u, off] of starts) {
      const w = walk(de, u), k = Math.round((w.len - off) / BLK); if (k < 2) continue;
      const step = (w.len - off) / k;
      for (let i = 1; i < k; i++) { let x = off + step * i; for (const p of w.path) { const l = p.u1 - p.u0; if (x <= l) { dAddSig(p.de, p.u0 + x, '閉塞', null); break; } x -= l; } }
    }
  }
"""
s = s[:i0] + new + s[i1:]
a = "  for (let g = 0; g < 8 && u > dEm[de >> 1]; g++) { const sc = dSuccOf(de); if (sc.length !== 1 || (dPred.get(sc[0]) || []).length > 1) { u = dEm[de >> 1] - 2; break; } u -= dEm[de >> 1]; de = sc[0]; }"
b = "  for (let g = 0; g < 8 && u > dEm[de >> 1]; g++) { const sc = dSuccOf(de); if (sc.length !== 1 || (dPred.get(sc[0]) || []).length > 1) { u = Math.max(1, dEm[de >> 1] - 15); break; } u -= dEm[de >> 1]; de = sc[0]; }   // 先に分岐があれば、その 15m 手前"
assert s.count(a) == 1; s = s.replace(a, b)
open(p, 'w', encoding='utf-8').write(s)
print('ok')
