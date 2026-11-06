# 信号機の推定: ホームの手前に信号機が無い(出発はあるのに場内が無い)駅の手前に閉塞信号機(2026-11-05、ユーザー「神奈川新町から子安で20km/hで動いていて遅すぎる」)
#  子安の上り: 出発(止まる位置の66m先)はあるが場内が無く、手前の信号機は神奈川新町を出てすぐ(約480m手前)。
#  出発が停止なので過走余裕(100m)が足りず、その信号機が警戒(25km/h)になり、新町から子安まで25km/hで走っていた。
#  ここでは: 1)で置いたホームの先の出発・閉塞ごとに、ホームの入口から手前の信号機までが 250m を超えていれば、入口の 40m 手前に閉塞信号機を置く
#            (警戒は最後の約150mだけになる)。手で置いた信号機の区間には効かない(推定だけ)。
#  使い方: build フォルダで python tools/patch_platsig.py(前の版 _tmp/disp.js.before_platsig)
import io, os, shutil
p = 'src/disp.js'
b = '_tmp/disp.js.before_platsig'
if not os.path.exists(b): shutil.copy(p, b)
raw = io.open(b, encoding='utf-8', newline='').read(); crlf = '\r\n' in raw; s = raw.replace('\r\n', '\n')
def R(a, c):
    global s
    if a not in s: raise SystemExit('見つからない: ' + a[:80])
    s = s.replace(a, c, 1)
R("""    // 1) ホームの先: 分岐のある駅(停車場)は出発、無い駅(停留場)は閉塞。先に分岐があれば、その 15m 手前
    for (const [nm, info] of sec.stInfo) {""", """    // 1) ホームの先: 分岐のある駅(停車場)は出発、無い駅(停留場)は閉塞。先に分岐があれば、その 15m 手前
    const platIn = [];   // ホームの入口 [de, u, 駅名](あとで手前の信号機が遠ければ閉塞を置く)
    for (const [nm, info] of sec.stInfo) {""")
R("""        if (ah === 'dead') continue;   // ホームの先が車止め(終着駅の行き止まりの側): 信号機は要らない
        dPlaceFwd(e * 2 + d, u0, hasSw || ah === 'sw' ? '出発' : '閉塞', nm); }""", """        if (ah === 'dead') continue;   // ホームの先が車止め(終着駅の行き止まりの側): 信号機は要らない
        dPlaceFwd(e * 2 + d, u0, hasSw || ah === 'sw' ? '出発' : '閉塞', nm); platIn.push([e * 2 + d, dStopU(e, d, x) - info.len / 2, nm]); }""")
R("""    for (const de of inner) { if (backSig(de, 900) > 250) dPlaceBack(de, dEm[de >> 1], 60, 110, '駅内場内', null); }""",
  """    for (const de of inner) { if (backSig(de, 900) > 250) dPlaceBack(de, dEm[de >> 1], 60, 110, '駅内場内', null); }
    // ホームの入口の手前 250m 以内に信号機が無ければ、入口の 40m 手前に閉塞(出発が停止のとき、遠くの信号機から警戒 25km/h で這わない)
    for (const [de, uIn] of platIn) {
      let x = de, uE = uIn, len = 0, far = Infinity;
      for (let g = 0; g < 60 && len < 900; g++) {
        const q = (sigByDe.get(x) || []).filter(q => q.u <= uE + 0.01 && q.kind !== '中継'); if (q.length) { far = len + uE - Math.max(...q.map(q => q.u)); break; }
        len += Math.max(0, uE); const pr = NP(dPred.get(x)); if (!pr.length || dSecOf[pr[0] >> 1] < 0) break;
        let b = pr[0]; for (const f of pr) if (dDot(f, x) > dDot(b, x)) b = f; x = b; uE = dEm[x >> 1];
      }
      if (far > 250 && far < Infinity) dPlaceBack(de, uIn, 40, 40, '閉塞', null);
    }""")
if crlf: s = s.replace('\n', '\r\n')
io.open(p, 'w', encoding='utf-8', newline='').write(s); print('ok')
