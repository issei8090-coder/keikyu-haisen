# 走っている間の自動の順序変更をやめる(2026-11-05、ユーザー「待避などの計算をなくして固定化」→「両方」: 遅れたら遅れたまま、順序変更は手で)
#  D_AUTO = false(既定。画面の「自動で順序を変える」で入れられる)のとき:
#   ・dOrderBlock(分岐の進路を時刻表の順に): 相手が5分以上遅れそう・相手が止められている・90秒譲った、で先に行くのをやめる
#   ・dEntOrder(区間の外から入ってくる列車): 5分以上先・90秒譲った、で先に行くのをやめる
#   ・dWaiting(待避): 時刻表の発車から5分を過ぎた・抜く列車が5分以上遅れそう、で先に出すのをやめる
#  残すもの(これが無いと永久に動けなくなる): 相手が(前の列車などを介して)こちらを待っているときは先に行く(dChainTo・待避の dead)。そのときは運転の記録に「行き詰まり」と出す
import io, os, shutil
p = 'src/disp.js'; b = '_tmp/disp.js.before_noauto'
if not os.path.exists(b): shutil.copy(p, b)
raw = io.open(b, encoding='utf-8', newline='').read(); crlf = '\r\n' in raw; s = raw.replace('\r\n', '\n')
def rep(a, c, n=1):
    global s
    if s.count(a) != n: raise SystemExit('nf: ' + a[:80] + ' count %d' % s.count(a))
    s = s.replace(a, c)
rep("const D_SWAP = (DC.dispatch && DC.dispatch.swapAfter) || 300;",
    "const D_SWAP = (DC.dispatch && DC.dispatch.swapAfter) || 300;\nlet D_AUTO = !!(DC.dispatch && DC.dispatch.autoReorder);   // 走っている間に順序を自動で変える(遅れた相手を待たずに先に行く・待避をやめる)。既定は切 = 固定の順序(手で変える)\nconst D_DEADLOG = new Set();   // 行き詰まりで順序を変えた組(運転の記録に1回だけ出す)\nfunction dDeadLog(t, o, where) { const k = t.no + '>' + o.no; if (D_DEADLOG.has(k)) return; D_DEADLOG.add(k); dEvent(D_NOW, t, 'wait', `行き詰まり: ${o.no} がこの列車を待っているので先に出しました(${where})`); }")
rep("      const eta = dNodeEta(o, c); if (eta > Math.max(D_NOW, tT) + D_SWAP) continue;",
    "      const eta = dNodeEta(o, c); if (D_AUTO && eta > Math.max(D_NOW, tT) + D_SWAP) continue;")
rep("      if (dChainTo(o, t)) continue;\n      const pv",
    "      if (dChainTo(o, t)) { if (!D_AUTO) dDeadLog(t, o, '分岐'); continue; }\n      const pv")
rep("      if ((o.dHeld && !pv) || (o.ph && o.ph.mode === 'run' && o.ph.v < 0.1 && (o.ph.waitT || 0) > 20)) continue;",
    "      if (D_AUTO && ((o.dHeld && !pv) || (o.ph && o.ph.mode === 'run' && o.ph.v < 0.1 && (o.ph.waitT || 0) > 20))) continue;")
rep("if (!w.has(o) || (mv && mv.v > 0.5)) w.set(o, D_NOW); if (D_NOW - w.get(o) > 90) continue;",
    "if (!w.has(o) || (mv && mv.v > 0.5)) w.set(o, D_NOW); if (D_AUTO && D_NOW - w.get(o) > 90) continue;")
rep("if (eta > tE - 30 || eta > D_NOW + D_SWAP) continue;",
    "if (eta > tE - 30 || (D_AUTO && eta > D_NOW + D_SWAP)) continue;")
rep("const w = t.dOrdW || (t.dOrdW = new Map()); if (!w.has(o)) w.set(o, D_NOW); if (D_NOW - w.get(o) > 90) continue;",
    "const w = t.dOrdW || (t.dOrdW = new Map()); if (!w.has(o)) w.set(o, D_NOW); if (D_AUTO && D_NOW - w.get(o) > 90) continue;")
rep("  const st = t.dp.stops[k]; if (st && T > st.P + D_WAITMAX) return null;",
    "  const st = t.dp.stops[k]; if (D_AUTO && st && T > st.P + D_WAITMAX) return null;")
rep("    if (eta > (st ? st.P : T) + D_SWAP) continue;",
    "    if (D_AUTO && eta > (st ? st.P : T) + D_SWAP) continue;")
rep("    if (dead) continue;\n    return o;",
    "    if (dead) { if (!D_AUTO) dDeadLog(t, o, '待避'); continue; }\n    return o;")
rep("  D_LOCK.clear(); D_LOCKN.clear(); for (const [, S] of D_SGL) S.run.lock = null; D_NEEDWARM = true;",
    "  D_LOCK.clear(); D_LOCKN.clear(); for (const [, S] of D_SGL) S.run.lock = null; D_NEEDWARM = true; D_DEADLOG.clear();")
if crlf: s = s.replace('\n', '\r\n')
io.open(p, 'w', encoding='utf-8', newline='').write(s); print('ok')
