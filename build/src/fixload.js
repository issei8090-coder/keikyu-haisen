// ===== 固定した平常時の計画(tools/mkfix.js が作り、assemble.py が埋める) =====
// FIXPLAN[day] = gzip した JSON の base64。開くときに戻して ttList にし、番線・待避・折り返しの計算(約2〜3分)を飛ばす
const FIXPLAN = /*FIXPLAN*/null;
const FIXKEY = /*FIXKEY*/'';
const FIXORDER = /*FIXORDER*/null;   // 基準の走りの記録(tools/mkorder.js)。'日|範囲' → gzip の base64
const fixOrderCache = new Map();
async function fixOrderLoad(day) {   // D_REC(src/disp.js)を、この日・いまの運転指令の範囲の記録にする
  D_REC = null; const k = day + '|' + (typeof D_SCOPE !== 'undefined' ? D_SCOPE : 'kq');
  if (!FIXORDER || !FIXORDER[k] || typeof DecompressionStream !== 'function') return null;
  if (!fixOrderCache.has(k)) { const J = await fixGunzip(fixUnB64(FIXORDER[k])); fixOrderCache.set(k, { n: new Map(J.n), e: new Map(J.e), w: new Map(J.w) }); }
  D_REC = fixOrderCache.get(k); return D_REC;
}   // 計画に効く入力ファイルの鍵(tools/fixkey.js)。保存した計画・書き出したファイルがいまの配線・時刻表のものか確かめる
async function fixHash(s) { const b = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(s)); return [...new Uint8Array(b)].slice(0, 8).map(x => x.toString(16).padStart(2, '0')).join(''); }
// このブラウザの保存(IndexedDB kq-plan)。同じ日の計画は新しい2つだけ残す
function fixIdb(op, key, val) {
  return new Promise(res => { let rq; try { rq = indexedDB.open('kq-plan', 1); } catch (e) { res(null); return; }
    rq.onupgradeneeded = () => rq.result.createObjectStore('plan');
    rq.onerror = () => res(null);
    rq.onsuccess = () => { const db = rq.result, tx = db.transaction('plan', op === 'get' ? 'readonly' : 'readwrite'), st = tx.objectStore('plan');
      if (op === 'get') { const g = st.get(key); g.onsuccess = () => res(g.result ? g.result.bin : null); g.onerror = () => res(null); return; }
      const day = key.split('|').slice(0, 2).join('|'), now = Date.now();
      st.put({ bin: val, at: now }, key);
      const c = st.openCursor(); const keep = [];
      c.onsuccess = () => { const cur = c.result; if (cur) { if (String(cur.key).startsWith(day + '|') || !String(cur.key).startsWith(FIXKEY + '|')) keep.push([cur.key, cur.value.at || 0]); cur.continue(); return; }
        keep.filter(([k]) => !String(k).startsWith(FIXKEY + '|')).forEach(([k]) => st.delete(k));   // 配線・時刻表が古いもの
        keep.filter(([k]) => String(k).startsWith(day + '|')).sort((a, b) => b[1] - a[1]).slice(2).forEach(([k]) => st.delete(k)); };
      tx.oncomplete = () => res(true); tx.onerror = () => res(null); };
  });
}
function fixRevive(F) {
  const T = F.trains, O = F.objs || [], done = new Set();
  const segsOf = ([d0, L]) => { let dcur = d0; return L.map(x => {
    let g; if (typeof x === 'number') g = x >= 0 ? { e: x, d: 0, t0: 0, t1: 1, jump: false } : { e: -x - 1, d: 1, t0: 1, t1: 0, jump: false };
    else if (Array.isArray(x)) g = { e: x[0], d: x[1], t0: x[2], t1: x[3], jump: !!x[4] };
    else { const s = fix(x.$g); dcur = s.d1; return s; }
    const a = pointOn(g.e, g.t0), b = pointOn(g.e, g.t1), d1 = dcur + Math.abs(g.t1 - g.t0) * E[g.e].len;
    const s = { e: g.e, d: g.d, t0: g.t0, t1: g.t1, d0: dcur, d1, ax: a.x, ay: a.y, bx: b.x, by: b.y, jump: g.jump }; dcur = d1; return s; }); };
  const val = v => { if (!v || typeof v !== 'object') return v;
    if (v.$r != null) return T[v.$r]; if (v.$o != null) return fix(O[v.$o]); if (v.$sd) return SIDINGS.get(v.$sd[0])[v.$sd[1]]; if (v.$n != null) return Number(v.$n);
    return fix(v); };
  function fix(o) {
    if (done.has(o)) return o; done.add(o);
    if (Array.isArray(o)) { for (let i = 0; i < o.length; i++) o[i] = val(o[i]); return o; }
    for (const k of Object.keys(o)) { if (k === '$s') continue; o[k] = val(o[k]); }
    if (o.$s) { o.segs = segsOf(o.$s); delete o.$s; }
    return o;
  }
  T.forEach(fix);
  const res = new Map(F.res.map(([e, L]) => [e, L.map(r => r.map(val))]));
  const reserve = new Map(F.reserve.map(([no, i]) => [no, T[i]]));
  const list = T.slice(0, F.n);
  return { list, reserve, res, info: F.info };
}
// 計画(ttPlanner と ttHensei のあと、dispPlan の前の列車)を固定の形にする。parked = 予備の編成(f.f → 列車)
const FIX_SKIP = new Set(['g', 'li2', 'hs', 'hs2']);
function fixEncode(list, parked, resMap, info, key, day) {
  const reserve = [...parked.values()].filter(u => !list.includes(u)), all = list.concat(reserve), idx = new Map(all.map((t, i) => [t, i]));
  const SKIP = FIX_SKIP;
  // 2か所以上から参照される object は表 objs に1つだけ入れて {$o: 番号}。引上線(SIDINGS の要素)は {$sd: [駅名, 番号]}(読み込み側の SIDINGS の同じ object に戻す)
  const SD = new Map(); for (const [nm, L] of SIDINGS) L.forEach((h, i) => SD.set(h, [nm, i]));
  const isRoute = v => !Array.isArray(v) && Array.isArray(v.segs) && 'stopD' in v;
  const cnt = new Map(), count = o => { if (!o || typeof o !== 'object' || idx.has(o) || SD.has(o) || o instanceof Map || o instanceof Set) return;
    const c = (cnt.get(o) || 0) + 1; cnt.set(o, c); if (c > 1) return;
    for (const k of Object.keys(o)) { if (!Array.isArray(o) && (SKIP.has(k) || (k === 'segs' && isRoute(o)))) continue; count(o[k]); } };
  for (const t of all) for (const k of Object.keys(t)) if (!SKIP.has(k)) count(t[k]);
  const oid = new Map(), objs = []; for (const [o, c] of cnt) if (c > 1 && !idx.has(o)) { oid.set(o, objs.length); objs.push(null); }
  const enc = (v, k, top) => {
    if (v === null || typeof v !== 'object') return typeof v === 'number' && !isFinite(v) ? { $n: String(v) } : v;
    if (!top && idx.has(v)) return { $r: idx.get(v) };
    if (SD.has(v)) return { $sd: SD.get(v) };
    if (!top && oid.has(v)) return { $o: oid.get(v) };
    return enc1(v, k); };
  const enc1 = (v, k) => {
    if (v instanceof Map || v instanceof Set) return undefined;
    if (typeof v.nodeType === 'number') return undefined;   // 画面の要素
    if (Array.isArray(v)) return v.map(x => { const y = enc(x); return y === undefined ? null : y; });
    if (isRoute(v)) { const o = {}; for (const kk of Object.keys(v)) { if (kk === 'segs') continue; const y = enc(v[kk], kk); if (y !== undefined) o[kk] = y; } o.$s = encSegs(v.segs); return o; }
    const o = {}; for (const kk of Object.keys(v)) { if (SKIP.has(kk)) continue; const y = enc(v[kk], kk); if (y !== undefined) o[kk] = y; } return o; };
  let bad = 0;
  const encSegs = segs => { const out = []; let dcur = segs.length ? segs[0].d0 : 0;
    for (const sg of segs) { const L = E[sg.e].len, d1 = dcur + Math.abs(sg.t1 - sg.t0) * L, a = pointOn(sg.e, sg.t0), b = pointOn(sg.e, sg.t1);
      const same = Math.abs(sg.d0 - dcur) < 1e-6 && Math.abs(sg.d1 - d1) < 1e-6 && Math.abs(a.x - sg.ax) < 1e-6 && Math.abs(a.y - sg.ay) < 1e-6 && Math.abs(b.x - sg.bx) < 1e-6 && Math.abs(b.y - sg.by) < 1e-6;
      const extra = Object.keys(sg).filter(k => !['e', 'd', 't0', 't1', 'd0', 'd1', 'ax', 'ay', 'bx', 'by', 'jump'].includes(k));
      if (!same || extra.length) { bad++; out.push({ $g: enc(Object.assign({}, sg)) }); dcur = sg.d1; continue; }
      const full = !sg.jump && ((sg.t0 === 0 && sg.t1 === 1 && sg.d === 0) || (sg.t0 === 1 && sg.t1 === 0 && sg.d === 1));
      out.push(full ? (sg.d ? -sg.e - 1 : sg.e) : [sg.e, sg.d, sg.t0, sg.t1, sg.jump ? 1 : 0]); dcur = d1; }
    return [segs.length ? segs[0].d0 : 0, out]; };
  const trains = all.map(t => enc(t, '', true));
  for (const [o, i] of oid) objs[i] = enc(o, '', true);   // 表の中身(同じ object の2回目以降は $o)
  const res = [...resMap].map(([e, L]) => [e, L.map(r => r.map(x => x && typeof x === 'object' ? (idx.has(x) ? { $r: idx.get(x) } : enc(x)) : x))]);
  return { v: 1, key, day, n: list.length, trains, objs, reserve: [...parked].map(([no, u]) => [no, idx.get(u)]), res, info, bad };
}
async function fixGzip(obj) { const s = new Blob([JSON.stringify(obj)]).stream().pipeThrough(new CompressionStream('gzip')); return new Uint8Array(await new Response(s).arrayBuffer()); }
async function fixGunzip(bin) { return JSON.parse(await new Response(new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip'))).text()); }
const fixB64 = bin => { let s = ''; for (let i = 0; i < bin.length; i += 0x8000) s += String.fromCharCode.apply(null, bin.subarray(i, i + 0x8000)); return btoa(s); };
const fixUnB64 = b64 => Uint8Array.from(atob(b64), c => c.charCodeAt(0));
async function fixLoad(day) {   // → fixRevive の結果、無ければ null
  if (!FIXPLAN || !FIXPLAN[day] || typeof DecompressionStream !== 'function') return null;
  const bin = fixUnB64(FIXPLAN[day]), F = fixRevive(await fixGunzip(bin)); F.bin = bin; return F;
}
