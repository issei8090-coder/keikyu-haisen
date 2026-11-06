# 12両の下りは金沢文庫で4両を切り離し、その先は8両(2026-11-05、ユーザー「京急線の12両は金沢文庫(下りは京急川崎)を境に増解結。久里浜方面へ12両のまま行く旅客列車は無い」)
#  これまで: 時刻表の両数12のまま京急久里浜・三崎口に着いていた(見た目だけ ttShape で金沢文庫から短くしていた)ので、
#            8両の列車への折り返しや久里浜検車区への入庫ができず、消えていた(平日 800A・802A・1910A・2020A など)。
#  ここでは: 金沢文庫に止まって金沢八景より先へ行く12両の列車は t.cars = 8・t.c12pre = true(金沢文庫までは前に4両つないで見せる)。
#            運転指令の長さ(dLen)も、金沢文庫までは12両。
#  あわせて: 昼の留置の検車区(YARD_CFG mid、京急久里浜)では、入庫をホームで最長30分まで待てる(ユーザー「京急久里浜で停車する時間を長くしたらいい」)
#  使い方: build フォルダで python tools/patch_c12pre.py(前の版 _tmp/*.before_c12pre)
import io, os, shutil
def edit(p, pairs):
    b = '_tmp/' + os.path.basename(p) + '.before_c12pre'
    if not os.path.exists(b): shutil.copy(p, b)
    raw = io.open(b, encoding='utf-8', newline='').read(); crlf = '\r\n' in raw; s = raw.replace('\r\n', '\n')
    for a, c in pairs:
        if a not in s: raise SystemExit('見つからない: ' + p + ' ' + a[:70])
        s = s.replace(a, c, 1)
    if crlf: s = s.replace('\n', '\r\n')
    io.open(p, 'w', encoding='utf-8', newline='').write(s); print('ok', p)

edit('src/ttcore.js', [
  ("  if (!t.cars && ev.every(e => DAISHI_ST.has(e.name))) t.cars = 4;",
   "  if (!t.cars && ev.every(e => DAISHI_ST.has(e.name))) t.cars = 4;\n"
   "  if (t.cars === 12) { const i = ev.findIndex(e => e.name === '金沢文庫'); if (i > 0 && i < ev.length - 1 && ev.slice(i + 1).some(e => e.name === '金沢八景')) { t.cars = 8; t.c12pre = true; } }   // 12両の下りは金沢文庫で4両を切り離す(その先は8両)"),
  ("  else if (t.cars === 12) {", "  else if (t.cars === 12 || t.c12pre) {"),
  ("      const OUT_SH = [0, -30, -60, -90, -120, -180, -240, -300], IN_SH = [0, 30, 60, 90, 120, 180, 240, 300, 420, 600];",
   "      const OUT_SH = [0, -30, -60, -90, -120, -180, -240, -300], IN_SH = [0, 30, 60, 90, 120, 180, 240, 300, 420, 600].concat(YARD_CFG[st] && YARD_CFG[st].mid ? [900, 1200, 1500, 1800] : []);   // 昼の留置の駅はホームで長く待って入庫してよい"),
])
edit('src/disp.js', [
  ("const dLen = t => t.cut || t.unit ? 4 * DTR.carLen : Math.max(36, (t.cars || 6) * DTR.carLen);",
   "const dLen = t => t.cut || t.unit ? 4 * DTR.carLen : Math.max(36, ((t.cars || 6) + (t.c12pre && (t.extB || t.extF) ? 4 : 0)) * DTR.carLen);   // c12pre: 金沢文庫で4両を切り離す下り(ttShape が切り離すまで extB/extF を付ける)"),
])
