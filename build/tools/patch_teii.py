# 進行定位: 止まる駅の先の信号機を発車直前まで開かないのは、分岐を曲がる進路(副本線から出る・本線へ合流する)だけ
import shutil
p='src/disp.js'; s=open(p,encoding='utf-8').read(); shutil.copy(p,'_tmp/disp/disp.js.before_teii')
a="""      if (sb && !(p.mode === 'dwell' && sb === nextStop && T >= sb.P - 30 && !dWaiting(t, sb.k, T))) break;"""
b="""      if (sb && dTurnIn(t, dBlock(t, j, rg)) && !(p.mode === 'dwell' && sb === nextStop && T >= sb.P - 30 && !dWaiting(t, sb.k, T))) break;"""
assert s.count(a)==1; s=s.replace(a,b)
a="""// 誘導(止まっている列車のいる区間へ 15km/h で入れる)ができる信号機"""
b="""// 区間の中で、経路が分岐を曲がる(まっすぐでない側へ分かれる・まっすぐでない側から合流する)か。
// 主本線をまっすぐ進む進路は進行定位(規程 第302条)なので、止まる列車にも前もって開く。曲がる進路は発車の直前まで開かない
function dTurnIn(t, b) {
  if (b.turn != null) return b.turn;
  const dp = t.dp, segs = t.route.segs; b.turn = false;
  for (const { m } of b.nodes) {
    let i = -1; for (let k = 0; k + 1 < segs.length; k++) if (Math.abs(dp.M[k + 1] - m) < 0.01) { i = k; break; } if (i < 0) continue;
    const a = segs[i], c = segs[i + 1]; if (a.e === c.e) continue;
    const da = a.e * 2 + a.d, dc = c.e * 2 + c.d, here = dDot(da, dc);
    if (dSuccOf(da).some(x => dDot(da, x) > here + 0.02) || (dPred.get(dc) || []).some(x => dDot(x, dc) > here + 0.02)) { b.turn = true; break; }
  }
  return b.turn;
}
// 誘導(止まっている列車のいる区間へ 15km/h で入れる)ができる信号機"""
assert s.count(a)==1; s=s.replace(a,b)
open(p,'w',encoding='utf-8').write(s); print('ok')
