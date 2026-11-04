# 運転指令: 速度制限を画面で直す(配線の編集の中)。D_LAYEDIT.vmax = { 区間id: [[k0, k1, km/h, メモ], ...] } が cfg の vmax の代わりになる(2026-11-04)
import io
def sub(p, pairs):
    s = io.open(p, encoding='utf-8').read()
    for a, b in pairs:
        assert s.count(a) == 1, (p, a[:80])
        s = s.replace(a, b)
    io.open(p, 'w', encoding='utf-8', newline='').write(s)

sub('src/disp.js', [
("""    DSEC.push({ sc, id: sc.id, name: sc.name, edges, stInfo, bnd, tabs: sc.tabs, vmax: sc.vmax });""",
"""    DSEC.push({ sc, id: sc.id, name: sc.name, edges, stInfo, bnd, tabs: sc.tabs, vmax: (D_LAYEDIT.vmax && D_LAYEDIT.vmax[sc.id]) || sc.vmax });   // 速度制限は画面で直したものがあればそちら"""),
])

sub('src/dispui.js', [
# 図の下に速度制限の帯
("""  el('line', { x1: tb.X(tb.km0), y1: tb.H - 30, x2: tb.X(tb.km1), y2: tb.H - 30, class: 'bk-tick' }, gB.static);""",
"""  el('line', { x1: tb.X(tb.km0), y1: tb.H - 30, x2: tb.X(tb.km1), y2: tb.H - 30, class: 'bk-tick' }, gB.static);
  // 速度制限の帯(線区の最高速度より低いところ)
  for (const P of tb.parts) { const V = DSEC[P.si].vmax || [], top = Math.max(...V.map(v => v[2]), 0);
    for (const [k0, k1, v, note] of V) { if (v >= top || k1 < P.km0 || k0 > P.km1) continue; const a = tb.X(Math.max(k0, P.km0), P.si), b = tb.X(Math.min(k1, P.km1), P.si);
      const g = el('g', { class: 'bk-vmax' + (v <= 45 ? ' lo' : '') }, gB.static); el('rect', { x: a, y: tb.H - 44, width: Math.max(2, b - a), height: 9, rx: 2 }, g); if (b - a > 22) el('text', { x: (a + b) / 2, y: tb.H - 36.6 }, g, v); el('title', {}, g, `${v}km/h ${note || ''}`); } }"""),
])

# パネル(配線の編集で何も選んでいないとき)に速度制限の表
sub('src/dispui.js', [
("""  } else h += '<p class="dp-sub">図の線路を押すとその線の長さ、上の駅名を押すと駅のキロ程とホームの長さを直せます。直した線は黄色で示します。</p>';""",
"""  } else {
    h += '<p class="dp-sub">図の線路を押すとその線の長さ、上の駅名を押すと駅のキロ程とホームの長さを直せます。直した線は黄色で示します。</p>';
    const si = dTabs[dTab].si, sec = DSEC[si], neg = !!sec.sc.kmNeg, V = (sec.vmax || []).map(r => r.slice()), own = !!(D_LAYEDIT.vmax && D_LAYEDIT.vmax[sec.id]);
    const dk = k => (neg ? -k : k);   // 画面のキロ程(浅草線は符号を戻す)
    key = 'vmax' + si + JSON.stringify(V);
    h += `<h2 style="margin-top:10px">速度制限(${sec.name})</h2><p class="dp-sub">${own ? '画面で直した値' : '設定ファイルの値(推定を含む)'}。図の下の帯がこの表です。km/h は線区の最高速度より低い所だけ帯になります。</p>` +
      `<table class="dp-tab lay-vm"><tr><th>から</th><th>まで</th><th>km/h</th><th>メモ</th><th></th></tr>` +
      V.map((r, i) => { const a = dk(r[0]), b = dk(r[1]), lo = Math.min(a, b), hi = Math.max(a, b);
        return `<tr data-vr="${i}"><td><input type="number" step="0.01" value="${lo.toFixed(3)}"></td><td><input type="number" step="0.01" value="${hi.toFixed(3)}"></td><td><input type="number" step="5" min="5" value="${r[2]}"></td><td><input type="text" value="${(r[3] || '').replace(/"/g, '&quot;')}"></td><td><button data-vdel="${i}" class="danger">消す</button></td></tr>`; }).join('') +
      `</table><div class="btns"><button id="vadd">行を足す</button><button id="vok">決める</button>${own ? '<button id="vreset">設定ファイルの値に戻す</button>' : ''}</div>`;
  }"""),
("""  const iv = id => { const x = $(id); return x ? +x.value : NaN; };""",
"""  const iv = id => { const x = $(id); return x ? +x.value : NaN; };
  { const si = dTabs[dTab].si, sec = DSEC[si], neg = !!sec.sc.kmNeg;
    const rows = () => [...box.querySelectorAll('[data-vr]')].map(tr => { const q = tr.querySelectorAll('input'); let a = +q[0].value, b = +q[1].value; if (neg) { a = -a; b = -b; } return [Math.min(a, b), Math.max(a, b), +q[2].value, q[3].value]; });
    const put = (V, msg) => { if (V.some(r => !isFinite(r[0]) || !isFinite(r[1]) || !(r[2] > 0))) { dSigMsg('キロ程と速度を数字で入れてください'); return; } D_LAYEDIT.vmax = D_LAYEDIT.vmax || {}; D_LAYEDIT.vmax[sec.id] = V; box._h = ''; dLayApply(msg); };
    const ba = $('vadd'); if (ba) ba.onclick = () => { const V = rows(), k = (dTabs[dTab].km0 + dTabs[dTab].km1) / 2; V.push([k - 0.1, k + 0.1, 45, '']); put(V, '速度制限の行を足しました(キロ程と速度を直して「決める」)'); };
    const bk = $('vok'); if (bk) bk.onclick = () => put(rows(), '速度制限を直しました');
    box.querySelectorAll('[data-vdel]').forEach(b => b.onclick = () => { const V = rows(); V.splice(+b.dataset.vdel, 1); put(V, '速度制限の行を消しました'); });
    const br = $('vreset'); if (br) br.onclick = () => { delete D_LAYEDIT.vmax[sec.id]; box._h = ''; dLayApply('速度制限を設定ファイルの値に戻しました'); }; }"""),
# 直したところの数に速度制限も
("""  key += '|' + L.length + '|' + T.length;""",
"""  key += '|' + L.length + '|' + T.length + '|' + dTab;"""),
])

sub('src/template.html', [
("""  .bk-ends {""", """  .bk-vmax rect { fill:#e0a030; opacity:.55; } .bk-vmax.lo rect { fill:#ff6a4d; opacity:.6; }
  .bk-vmax text { font-size:8.5px; fill:#0b0f16; font-weight:700; text-anchor:middle; pointer-events:none; }
  .lay-vm input { width:100%; min-width:0; box-sizing:border-box; font-size:12px; padding:2px 3px; }
  .lay-vm td { padding:2px; } .lay-vm th { font-size:11px; }
  .bk-ends {"""),
])
print('ok')
