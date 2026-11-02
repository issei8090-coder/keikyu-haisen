# 遅れを取り戻す速さ(ttFollow の vcap)を、根拠のある駅間の最高速度で抑える。時刻表どおりの位置(ttTarget)は変えない
#  対象: 京急本線 品川〜横浜 120 km/h・横浜〜浦賀 110 km/h(京急公式ハンドブック2013–2014 の快特の最高速度。現行値の再確認は未了)
#  km/h → 図上の速さ: その列車が実際に走る経路の駅間の図上長(t.sd) ÷ 公式営業キロ(build/keikyu_mainline_station_distances.csv)
#  時刻表どおりに走るときの速さ(t.vpk)より遅くはしないので、時刻表どおりの列車の動きは変わらない
import io
p = 'src/ttcore.js'
s = io.open(p, encoding='utf-8').read()
def rep(old, new):
    global s
    assert s.count(old) == 1, (old, s.count(old))
    s = s.replace(old, new)

rep("t.sd = t.route.stopD.map((d, k, a) => t.off && t.off[k] ? Math.max(k ? a[k - 1] + 1 : -30, Math.min(d + t.off[k], k + 1 < a.length ? a[k + 1] - 1 : t.route.total)) : d); t.kn = null; }",
    "t.sd = t.route.stopD.map((d, k, a) => t.off && t.off[k] ? Math.max(k ? a[k - 1] + 1 : -30, Math.min(d + t.off[k], k + 1 < a.length ? a[k + 1] - 1 : t.route.total)) : d); t.kn = null; t.vlim = null; }")
rep("      f = f < ra ? v * f * f / (2 * ra) : f > 1 - rb ? 1 - v * (1 - f) * (1 - f) / (2 * rb) : v * (f - ra / 2);\n",
    "      f = f < ra ? v * f * f / (2 * ra) : f > 1 - rb ? 1 - v * (1 - f) * (1 - f) / (2 * rb) : v * (f - ra / 2);\n"
    "      t.vpk = t.vs * v;   // 時刻表どおりに走るときの、この区間の最高の速さ\n")
rep("const LATE_IN = 50;\n",
    "const LATE_IN = 50;\n"
    "// ===== 駅間の最高速度(根拠のあるものだけ)。遅れを取り戻すときにこれを超えない =====\n"
    "// 京急本線の営業キロ(京急公式 営業キロ程表 2023-10-01、泉岳寺起点の累計。MAINL と同じ順。build/keikyu_mainline_station_distances.csv)\n"
    "const KQ_KM = [0, 1.2, 1.9, 2.6, 3.4, 3.9, 4.7, 6.0, 6.9, 7.7, 8.4, 9.2, 10.6, 11.8, 13.0, 14.3, 15.0, 16.5, 17.3, 18.1, 19.5, 20.5, 21.2, 21.7, 22.7, 23.4, 24.6, 26.0, 26.8, 27.7, 28.9, 30.3, 32.0, 34.2, 35.5, 37.9, 38.6, 40.7, 42.1, 44.0, 45.7, 48.3, 49.4, 50.4, 51.1, 52.3, 53.5, 54.3, 55.4, 56.7];\n"
    "// 京急公式ハンドブック2013–2014: 快特の最高速度 品川〜横浜 120 km/h・横浜以南 110 km/h。ほかの種別もこれより速くはないので全種別の上限に使う(現行値の再確認は未了)。\n"
    "// 泉岳寺〜品川・支線・都営・京成・北総は根拠のある km/h と km の組が無いので上限なし。曲線・分岐器の局所制限(八ツ山橋25 など)は駅間内の位置が未確定なので入れない\n"
    "const VLIM_SEC = [['品川', '横浜', 120], ['横浜', '浦賀', 110]];\n"
    "const vlimKm = new Map(MAINL.map((n, i) => [n, KQ_KM[i]]));\n"
    "// 停車駅 k→k+1 の区間の上限を、その列車が実際に走る経路の図上長(t.sd)で 図上単位/秒 に直す。根拠の無い区間は Infinity\n"
    "function ttVLim(t, k) {\n"
    "  const L = t.vlim || (t.vlim = []);\n"
    "  if (L[k] !== undefined) return L[k];\n"
    "  let v = Infinity;\n"
    "  const i = k - t.k0, a = i >= 0 ? vlimKm.get(t.names[i]) : null, b = i >= 0 ? vlimKm.get(t.names[i + 1]) : null;\n"
    "  if (a != null && b != null && a !== b && t.sd[k + 1] > t.sd[k]) {\n"
    "    const lo = Math.min(a, b), hi = Math.max(a, b);\n"
    "    let kmh = 0;   // またぐ区間のうち高いほう(低い値で抑えすぎない)。根拠の無い部分を含むなら上限なし\n"
    "    for (let x = lo; x < hi - 1e-9; ) {\n"
    "      const sec = VLIM_SEC.find(([p, q]) => vlimKm.get(p) <= x + 1e-9 && x < vlimKm.get(q) - 1e-9);\n"
    "      if (!sec) { kmh = 0; break; }\n"
    "      kmh = Math.max(kmh, sec[2]); x = vlimKm.get(sec[1]);\n"
    "    }\n"
    "    if (kmh) v = kmh / 3600 * (t.sd[k + 1] - t.sd[k]) / (hi - lo);\n"
    "  }\n"
    "  return L[k] = v;\n"
    "}\n"
    "// 位置 s がどの停車駅間(k→k+1)にあるか。駅の上・範囲外は -1\n"
    "function ttStopK(t, s) { const sd = t.sd; if (!sd || sd.length < 2) return -1; let k = 0; while (k + 2 < sd.length && sd[k + 1] <= s) k++; return s >= sd[k] && s < sd[k + 1] ? k : -1; }\n")
rep("    const vcap = Math.min(FOLLOW_VMAX, Math.max(FOLLOW_VMIN, FOLLOW_BOOST * (t.vs || 2)));\n",
    "    let vcap = Math.min(FOLLOW_VMAX, Math.max(FOLLOW_VMIN, FOLLOW_BOOST * (t.vs || 2)));\n"
    "    // 駅間の最高速度(ttVLim)も超えない。ただし時刻表どおりの速さ(t.vpk)より遅くはしない\n"
    "    const vk = ttStopK(t, s0), vl = vk < 0 ? Infinity : ttVLim(t, vk);\n"
    "    if (vl < vcap) vcap = Math.max(vl, t.vpk || 0);\n")
io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('ok')
