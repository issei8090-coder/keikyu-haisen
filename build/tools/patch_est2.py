# 推定: 長い構内には第2場内、通過線の出口の出発はホームより先の合流だけ
import shutil
p='src/disp.js'; s=open(p,encoding='utf-8').read(); shutil.copy(p,'_tmp/disp/disp.js.before_est2')
i0=s.index("    // 2) 分岐(対向・背向)ごとに、手前をさかのぼって何があるかで決める")
i1=s.index("    // 区間の入口(図の外から入ってくる所)も信号機の区切りとみなす")
new=r"""    // 2) 分岐(対向・背向)ごとに、手前をさかのぼって何があるかで決める
    //    手前 150m 以内に信号機・ホームの停止位置 → 置かない(出発などが守る)
    //    行き止まり(引上線など)から → 入換を 20m 手前
    //    300m 以上まっすぐ(駅のいちばん外の分岐) → 第1場内を 100m(100km/h 未満は 80m)手前
    //    背向で、ホームより先(進む向き)にあり、手前 150m 以上分岐が無い → ホームの無い線(通過線)の出口なので出発を 15m 手前
    //    それ以外(駅の中の分岐) → 手前の信号機から 250m 以上離れていれば第2場内を 60m 手前(長い構内を区切る)
    const siS = DSEC.indexOf(sec), inner = [];
    const beyondPlat = de => { const P = dPosOf(de, dEm[de >> 1]), dn = dDn(de) === 1;
      for (const [, info] of sec.stInfo) { const h = info.len / 2000; if (Math.abs(P.km - info.km) > h + 0.6) continue; if (dn ? P.km > info.km + h + 0.005 : P.km < info.km - h - 0.005) return true; }
      return false; };
    const backSig = (de, max) => {   // de の終点から手前へ、いちばん近い信号機までの距離
      let x = de, uE = dEm[de >> 1], len = 0;
      for (let g = 0; g < 60 && len < max; g++) {
        const q = (sigByDe.get(x) || []).filter(q => q.u <= uE + 0.01 && q.kind !== '中継'); if (q.length) return len + uE - Math.max(...q.map(q => q.u));
        len += uE; const pr = NP(dPred.get(x)); if (!pr.length || dSecOf[pr[0] >> 1] < 0) return Infinity;
        let b = pr[0]; for (const f of pr) if (dDot(f, x) > dDot(b, x)) b = f; x = b; uE = dEm[x >> 1];
      }
      return Infinity; };
    for (const de of des) {
      if (!isSwEnd(de)) continue;
      const facing = NP(dSuccOf(de)).length >= 2, vl = dVlineAt(siS, dPosOf(de, dEm[de >> 1]).km), need = vl < 100 ? 80 : 100;
      let x = de, uE = dEm[de >> 1], len = 0, what = 'plain';
      for (let g = 0; g < 60 && len < 600; g++) {
        const e = x >> 1;
        if ((sigByDe.get(x) || []).some(q => q.u <= uE + 0.01 && len + uE - q.u < 150)) { what = 'sig'; break; }
        if (!isNaN(stopX[e]) && edgeStation[e] >= 0 && dStopU(e, x & 1, stopX[e]) <= uE + 0.01 && len + uE - dStopU(e, x & 1, stopX[e]) < 150) { what = 'stop'; break; }
        len += uE;
        const pr = NP(dPred.get(x));
        // 手前が無い: 区間の端(図の外へ続く)はまっすぐな線、線路の終わり(車止め)は行き止まり、それ以外はこの向きに列車が来ない線
        if (!pr.length) { what = (dPred.get(x) || []).length ? 'plain' : adj[dBeg(x)].length <= 1 ? 'dead' : 'none'; break; }
        if (dSecOf[pr[0] >> 1] < 0) break;
        if (pr.length >= 2 || pr.some(q => NP(dSuccOf(q)).length >= 2)) { what = 'sw'; break; }
        let b = pr[0]; for (const f of pr) if (dDot(f, x) > dDot(b, x)) b = f; x = b; uE = dEm[x >> 1];
      }
      if (what === 'sig' || what === 'stop' || what === 'none') continue;
      if (what === 'dead') { dPlaceBack(de, dEm[de >> 1], 20, 60, '入換', null); continue; }
      if (what === 'sw') {
        if (!facing && len >= 150 && beyondPlat(de)) dPlaceBack(de, dEm[de >> 1], 15, 150, '出発', null);
        else if (!(facing ? len >= 300 : false)) inner.push(de);
        else dPlaceBack(de, dEm[de >> 1], need, need + 50, '場内', null);
        continue;
      }
      dPlaceBack(de, dEm[de >> 1], need, need + 50, '場内', null);
    }
    // 第2場内: 手前の信号機に近いものから順に(置くたびに距離が変わる)
    inner.sort((a, b) => backSig(a, 900) - backSig(b, 900));
    for (const de of inner) { if (backSig(de, 900) > 250) dPlaceBack(de, dEm[de >> 1], 60, 110, '場内', null); }
"""
s=s[:i0]+new+s[i1:]; open(p,'w',encoding='utf-8').write(s); print('ok')
