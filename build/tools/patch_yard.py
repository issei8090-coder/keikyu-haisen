# 検車区に列車を並べる(2026-11-04、ユーザー「西馬込・神奈川新町に列車を並べる。10時の出庫も5時から置く。運行終了後も1日の終わりまで置く。出現・消滅を0に」)
#  core.js: YARD_ST の駅の車庫の線(ホームから引上線で折り返して入る行き止まり)を探す yardOf()
#  ttcore.js: finish() の yard(): 前の運用の無い始発 = 1日の始まりから車庫の線にいて、引上線へ出て折り返しホームへ。
#             次の運用の無い終着 = ホームの先の引上線へ入り、折り返して車庫の線へ。1日の終わりまでそこにいる。
#             車庫の線は1本に1編成、長い線は奥と手前に2編成(奥の出入りの前後は手前を空ける)
#  車庫の中の入換は増結車と同じ作り物の列車(t.yard = 'in' | 'out'、names は駅1つ、経路と時刻を直接持つ)。運転指令の計算からは外し、在線としては見える
import io, re
def load(p):
    s = io.open(p, encoding='utf-8', newline='').read(); return s, ('\r\n' if '\r\n' in s else '\n')
def save(p, s): io.open(p, 'w', encoding='utf-8', newline='').write(s)
def rep(s, a, b, n=1):
    c = s.count(a); assert c == n, (c, a[:90]); return s.replace(a, b)

# ---------- core.js ----------
p = 'src/core.js'; s, NL = load(p)
anchor = "// opt: exitStart, exitEnd, startAt({e,t}), startExtra(startAtが駅の手前=引上線), after(終着後に向かう駅),"
add = """// 検車区(車庫の線を1本ずつ使って、1日の始まり・終わりの列車を並べる駅)。車庫の線 = ホームから直接は行けず、ホームの先の引上線(hs)で折り返して入る行き止まり
const YARD_ST = new Set(['西馬込']);
const YARDS = new Map();
function yardOf(name) {
  if (YARDS.has(name)) return YARDS.get(name);
  let Y = null; const s = stByName.get(name);
  if (s && YARD_ST.has(name) && s.stops.length) {
    const special = new Set(); D.portals.forEach(q => q.forEach(n => special.add(n))); D.exits.forEach(([n]) => special.add(n));
    const pm = new Map(); s.stops.forEach(([e, x]) => pm.set(e, x)); pm.name = name;
    const cx = s.cx, cy = s.ly, pos = (n, trim) => { const e = adj[n][0], atA = E[e].a === n, f = Math.min(0.95, trim / E[e].len); return { node: n, e, t: atA ? f : 1 - f, trim, set: new Set([n]), len: E[e].len }; };
    const dead = []; N.forEach((q, n) => { if (adj[n].length === 1 && !special.has(n) && isNaN(stopX[adj[n][0]]) && Math.abs(q.x - cx) < 260 && Math.abs(q.y - cy) < 160) dead.push(n); });
    const hs = [], rest = [];
    for (const n of dead) { const e = adj[n][0], r = findRoute({ e, t: E[e].a === n ? 0 : 1 }, [pm], null, null, false); if (!r.fail && r.total >= 60 && r.total <= 220) hs.push(Object.assign(pos(n, Math.min(8, E[e].len * 0.8)), { dist: r.total })); else if (r.fail || r.total > 220) rest.push(n); }
    const tracks = [];
    for (const n of rest) {
      if (E[adj[n][0]].len < 12) continue;   // 短すぎる線(安全側線など)
      const via = []; for (const h of hs) { const r = findRoute({ e: h.e, t: h.t }, [], new Set([n]), null, false); if (!r.fail && r.total <= 700) via.push(h); }
      if (via.length) tracks.push({ node: n, e: adj[n][0], len: E[adj[n][0]].len, via, y: N[n].y });
    }
    tracks.sort((a, b) => a.y - b.y || a.node - b.node); tracks.forEach((t, i) => { t.i = i; t.label = '車庫' + (i + 1) + '番'; });
    const used = new Set(tracks.flatMap(t => t.via)); Y = { name, hs: hs.filter(h => used.has(h)), tracks, pos };
    if (!Y.hs.length || !tracks.length) Y = null;
  }
  YARDS.set(name, Y); return Y;
}
"""
s = rep(s, anchor, add.replace('\n', NL) + anchor)
save(p, s); print('core ok')

# ---------- ttcore.js ----------
p = 'src/ttcore.js'; s, NL = load(p)
anchor = "  // ===== 品川で切り離した前4両 ====="
add = r"""  // ===== 検車区(YARD_ST): 1日の始まり・終わりの列車を車庫の線に並べる =====
  function yard() {
    const MV = d => Math.max(40, Math.min(180, d / 1.5)), REV = 60, PAD = 90;
    for (const st of YARD_ST) {
      const Y = yardOf(st); if (!Y) continue;
      const occ = Y.tracks.map(() => []);   // 車庫の線ごと: {slot 0=奥 1=手前, a, b, xs 出入りの時刻}
      const rc = new Map();
      const route = (from, endSet, trimEnd, key) => { if (rc.has(key)) return rc.get(key); const r = findRoute(from, [], endSet, null, false); let R = null; if (!r.fail) { const len = r.total - trimEnd; if (len > 5) { const segs = cutAt(r, len); R = { segs, total: len, stopD: [0, len], stopE: [segs[0].e, segs[segs.length - 1].e] }; } } rc.set(key, R); return R; };
      const slotTrim = (tr, slot, L) => slot ? 2 + L + 3 : 2;
      const cap = (tr, L) => tr.len >= 2 * L + 10 ? 2 : 1;
      const fits = (k, slot, a, b, xs) => { for (const o of occ[k]) { if (o.slot === slot && o.a < b + 30 && a < o.b + 30) return false; if (slot === 0 && o.slot === 1 && xs.some(x => o.a < x + PAD && x - PAD < o.b)) return false; if (slot === 1 && o.slot === 0 && o.xs.some(x => a < x + PAD && x - PAD < b)) return false; } return true; };
      const order = () => Y.tracks.map((tr, k) => k).sort((x, y) => occ[x].length - occ[y].length || x - y);
      const reqs = [];
      for (const d of planned) if (d.route && d.names[0] === st && !d.prev && !d.exitStart && !d.fromSiding && d.k0 === 0 && !d.unit && !d.cut && !(d.uset && d.uset.begin)) reqs.push({ d, out: true, T: d.ev[0].dep * 60 });
      for (const t of planned) if (t.route && t.names[t.names.length - 1] === st && !t.next && !t.exitEnd && !t.tail && !t.unit && !t.cut && !(t.uset && t.uset.fin)) reqs.push({ t, out: false, T: t.A[t.A.length - 1] });
      reqs.sort((x, y) => x.T - y.T);
      for (const q of reqs) {
        if (q.out) {   // 出庫: 車庫の線 → 引上線(折り返し) → ホーム
          const d = q.d, L = (d.cars || 8) * 1.5, dep0 = q.T, sIn = ttStn(st, 'in'), a1 = sIn != null ? dep0 - sIn * 60 : dep0 - 60;
          let done = false;
          for (const k of order()) { const tr = Y.tracks[k];
            for (let slot = 0; slot < cap(tr, L) && !done; slot++) for (const h of tr.via) {
              const R = route(Y.pos(tr.node, slotTrim(tr, slot, L)), h.set, h.trim, 'o' + k + ':' + slot + ':' + h.node); if (!R) continue;
              const mv = MV(R.total), tBack = Math.max(15, Math.min(90, h.dist / 2.5)), from = a1 - tBack - REV, x = from - mv;
              if (x < STAY0 + 60 || !fits(k, slot, STAY0, x, [x]) || !isFreeAt(h.e, x - 10, a1 + 10, d)) continue;
              if (!enterFrom(d, h, from, a1)) continue;
              const K = { no: d.no, type: 'kaiso', dest: st, cars: d.cars, fl: 0, x0: '', x1: '', tseg: null, tt: true, s: 0, g: null, k0: 0, yard: 'out', yardSt: st, yardTr: tr.label + (cap(tr, L) > 1 ? (slot ? '(手前)' : '(奥)') : ''), stay: true, dh: true,
                names: [st], ev: [{ name: st, arr: Math.floor(STAY0 / 60), dep: Math.floor(x / 60) }], route: R, A: [STAY0, from], P: [x, from], start: STAY0, end: from, prev: null, next: d };
              d.prev = K; d.deadIn = 'yard'; reserve(h.e, x - 10, a1 + 10, d); occ[k].push({ slot, a: STAY0, b: x, xs: [x] }); units.push(K); stat.yardOut = (stat.yardOut || 0) + 1; done = true; break;
            }
            if (done) break; }
        } else {   // 入庫: ホーム → 引上線(折り返し) → 車庫の線
          const t = q.t, L = (t.cars || 8) * 1.5, ta = q.T, sOut = ttStn(st, 'out'), leave = ta + (sOut != null ? Math.max(20, sOut * 60) : 40);
          let done = false;
          for (const k of order()) { const tr = Y.tracks[k];
            for (let slot = 0; slot < cap(tr, L) && !done; slot++) for (const h of tr.via) {
              const R = route({ e: h.e, t: h.t }, tr.via && new Set([tr.node]), slotTrim(tr, slot, L), 'i' + k + ':' + slot + ':' + h.node); if (!R) continue;
              const r = buildTimedRoute(t.names, t.long, Object.assign({}, optOf(t), { tail: h, after: null, isFree: (i, e) => e === t.route.stopE[i] }));
              if (!r || r.stopD.length !== t.route.stopD.length + 1 || t.names.some((_, i) => r.stopE[i] !== t.route.stopE[i])) continue;
              const out = r.stopD[r.stopD.length - 1] - r.stopD[r.stopD.length - 2], tOut = Math.max(15, Math.min(45, out / 2.5)), atH = leave + tOut, go = atH + REV, mv = MV(R.total), x = go + mv;
              if (!fits(k, slot, x, STAY1, [x]) || !isFreeAt(h.e, leave + 5, go + 10, t)) continue;
              t.route = r; t.sd = undefined; t.tail = h; t.deadOut = 'yard';
              t.P[t.P.length - 1] = leave; t.A.push(atH); t.P.push(go); t.end = go;
              const K = { no: t.no, type: 'kaiso', dest: st, cars: t.cars, fl: 0, x0: '', x1: '', tseg: null, tt: true, s: 0, g: null, k0: 0, yard: 'in', yardSt: st, yardTr: tr.label + (cap(tr, L) > 1 ? (slot ? '(手前)' : '(奥)') : ''), stay: true, dh: true,
                names: [st], ev: [{ name: st, arr: Math.floor(x / 60), dep: Math.floor(STAY1 / 60) }], route: R, A: [go, x], P: [go, STAY1], start: go, end: STAY1, prev: t, next: null };
              t.next = K; reserve(h.e, leave + 5, go + 10, t); occ[k].push({ slot, a: x, b: STAY1, xs: [x] }); units.push(K); stat.yardIn = (stat.yardIn || 0) + 1; done = true; break;
            }
            if (done) break; }
        }
        if (!(q.out ? q.d.prev : q.t.next)) stat.yardMiss = (stat.yardMiss || 0) + 1;
      }
    }
  }
"""
s = rep(s, anchor, add.replace('\n', NL) + anchor)
s = rep(s, "const finish = () => { cplList.splice(0).forEach(addUnit); userEnds(); userSplits(); detach(); deadhead();",
           "const finish = () => { cplList.splice(0).forEach(addUnit); userEnds(); userSplits(); detach(); yard(); deadhead();")
s = rep(s, "    if (t.unit || !t.sd || k + 1 >= t.A.length", "    if (t.unit || t.yard || !t.sd || k + 1 >= t.A.length")
save(p, s); print('ttcore ok')

# ---------- disp.js: 車庫の中の入換は運転指令の計算に入れない(在線としては見える) ----------
p = 'src/disp.js'; s, NL = load(p)
n0 = len(re.findall(r'\b(\w+)\.unit \|\| \1\.cut\b', s))
s = re.sub(r'\b(\w+)\.unit \|\| \1\.cut\b', lambda m: f'{m.group(1)}.unit || {m.group(1)}.cut || {m.group(1)}.yard', s)
s = s.replace("!o.unit && !o.cut", "!o.unit && !o.cut && !o.yard")
save(p, s); print('disp ok', n0)

# ---------- tt.js: 表示 ----------
p = 'src/tt.js'; s, NL = load(p)
s = rep(s, "  if (t.cut) return '切離4両'; if (t.unit) return '増結4両';", "  if (t.cut) return '切離4両'; if (t.unit) return '増結4両'; if (t.yard) return '車庫';")
s = rep(s, "const T = ttClock, n = t.names.length; if (t.unit || t.cut) return t.cut ? '品川' : '金沢文庫';", "const T = ttClock, n = t.names.length; if (t.yard) return t.yardSt + ' ' + t.yardTr; if (t.unit || t.cut) return t.cut ? '品川' : '金沢文庫';")
s = rep(s, "${t.unit || t.cut ? '' : r.num + ' ' + r.co}", "${t.unit || t.cut || t.yard ? '' : r.num + ' ' + r.co}")
s = rep(s, "s = (t.cut ? '切離4両' : t.unit ? '増結4両' : ty.name + ' ' + shortDest(t.dest));", "s = (t.cut ? '切離4両' : t.unit ? '増結4両' : t.yard ? '車庫 ' + t.yardTr : ty.name + ' ' + shortDest(t.dest));")
s = rep(s, "rows = ttList.filter(x => !x.unit && !x.cut && ttRun(x).duty === r.duty)", "rows = ttList.filter(x => !x.unit && !x.cut && !x.yard && ttRun(x).duty === r.duty)")
s = rep(s, "rows = ttList.filter(x => !x.unit && !x.cut && ttRun(x).key === r.key)", "rows = ttList.filter(x => !x.unit && !x.cut && !x.yard && ttRun(x).key === r.key)")
s = rep(s, "t.cut ? '切離4両' : t.unit ? '増結4両' : `${ty.short} ${shortDest(t.dest)}`);", "t.cut ? '切離4両' : t.unit ? '増結4両' : t.yard ? '車庫' : `${ty.short} ${shortDest(t.dest)}`);")
s = rep(s, "    if (t.shown !== tk && !t.unit) {", "    if (t.shown !== tk && !t.unit && !t.yard) {")
s = rep(s, "opsTrainPanel(t && !t.unit && !t.cut ? t : null);", "opsTrainPanel(t && !t.unit && !t.cut && !t.yard ? t : null);")
s = rep(s, "  if (t.unit) {   // 増結車", """  if (t.yard) {   // 検車区の車庫の線にいる車両(1日の始まりから出庫まで / 入庫から1日の終わりまで)
    const o = t.yard === 'out' ? t.next : t.prev, oty = o ? TYPES[o.type] : ty, hm2 = x => hm(Math.floor(x / 60));
    $('tttitle').textContent = `${t.yardSt}の車庫 ${t.yardTr}`; $('tttitle').style.color = oty.color;
    $('ttno').textContent = t.yard === 'out' ? `1日の始まりから留置 → ${hm2(t.P[0])} 出庫` : `${hm2(t.A[1])} 入庫 → 1日の終わりまで留置`;
    $('ttlinkinfo').innerHTML = o ? (t.yard === 'out' ? `出庫後: ${oty.name} ${o.dest}行き${o.no ? ' (' + o.no + ')' : ''} ${t.yardSt} ${hm(o.ev[0].dep)}発` : `入庫前: ${oty.name} ${o.names[0]}発${o.no ? ' (' + o.no + ')' : ''} ${t.yardSt} ${hm(o.ev[o.ev.length - 1].arr)}着`) + '<br>ホームの先の引上線で折り返して出入り' : '';
    $('ttstops').innerHTML = t.yard === 'out' ? `<li><span>${hm2(t.P[0])}</span>車庫の線を出る</li><li><span>${hm2(t.A[1])}</span>引上線で折り返し</li>` : `<li><span>${hm2(t.A[0])}</span>引上線で折り返し</li><li><span>${hm2(t.A[1])}</span>車庫の線に入る</li>`;
    return;
  }
  if (t.unit) {   // 増結車""")
save(p, s); print('tt ok')
