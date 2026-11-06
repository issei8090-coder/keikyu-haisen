// 平常時の運行計画を組み立て時に計算して固定する(2026-11-05、ユーザー「待避などの計算をなくして固定化したい」)
//   node tools/mkfix.js wd hd   → fix/plan_wd.json.gz など(assemble.py が index.html に埋める)
//   ブラウザの ttLoad と同じ手順: ttDecode → ttOps → ttOvertakes → ttCouple → ttLink → ttPlanner(pre/plan/finish) → ttHensei(予備の park を記録)
//   ・列車どうしの参照は {$r: 番号}。経路の segs は e/t0/t1 だけ残し、残り(d0 d1 ax ay bx by)は読み込み時に作り直す(作り直して同じになるかここで確かめる)
//   ・ttRes(線ごとに押さえた時間帯)は [e, [[a, b, 列車の番号, 印], ..]]
const fs = require('fs'), zlib = require('zlib'), crypto = require('crypto');
const D = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const TT = JSON.parse(fs.readFileSync('tt.json', 'utf8'));
const HENSEI_SRC = fs.readFileSync('src/hensei.js', 'utf8');
const hs0 = HENSEI_SRC.slice(0, HENSEI_SRC.indexOf('const hsDesc')).replace('/*HENSEI*/null', fs.existsSync('hensei.json') ? fs.readFileSync('hensei.json', 'utf8') : 'null');
const USER_OPS_FILE = fs.existsSync('ops_user.json') ? JSON.parse(fs.readFileSync('ops_user.json', 'utf8')) : null;
const days = process.argv.slice(2).length ? process.argv.slice(2) : ['wd', 'hd'];
if (!fs.existsSync('fix')) fs.mkdirSync('fix');
const key = require('./fixkey.js')();
eval(fs.readFileSync('src/core.js', 'utf8') + fs.readFileSync('src/ttcore.js', 'utf8') + hs0 + fs.readFileSync('src/fixload.js', 'utf8') + `
for (const day of days) {
  const t0 = Date.now();
  const list = TT[day].map(ttDecode).filter(t => t.ev.length > 1); ttOps(list); const ot = ttOvertakes(list); ttCouple(list, day);
  const g = ttLinkG(list); let nl = 0; for (;;) { const r = g.next(); if (r.done) { nl = r.value; break; } }
  list.sort((a, b) => a.start - b.start);
  const pl = ttPlanner(true); list.forEach(pl.pre); list.forEach(pl.plan); list.push(...pl.finish());
  const parked = new Map(), park0 = pl.park;
  const plW = Object.assign({}, pl, { park: (st, cars, no) => { const u = park0(st, cars, no); if (u) parked.set(String(no), u); return u; } });
  const n0 = list.length; ttHensei(list, plW); const reserve = list.splice(n0);
  console.log(day, 'plan', (Date.now() - t0) / 1000, 's', list.length, 'reserve', reserve.length);
  const all = list.concat(reserve), idx = new Map(all.map((t, i) => [t, i]));
  // 列車でない object が2つ以上の場所から参照されていないか(固定すると別々の object になる)
  const seen = new Map(), shared = new Map(), maps = new Map();
  const walk = (o, path, depth) => { if (!o || typeof o !== 'object' || depth > 6) return;
    if (o instanceof Map || o instanceof Set) { maps.set(path, (maps.get(path) || 0) + 1); return; }
    if (seen.has(o)) { if (!idx.has(o)) shared.set(path + ' = ' + seen.get(o), (shared.get(path + ' = ' + seen.get(o)) || 0) + 1); return; } seen.set(o, path);
    for (const k of Object.keys(o)) { const v = o[k]; if (v && typeof v === 'object' && !idx.has(v)) walk(v, path + '.' + (Array.isArray(o) ? '[]' : k), depth + 1); } };
  for (const t of all) walk(t, 't', 0);
  if (maps.size) console.log('  Map/Set(落とす):', [...maps].map(([p, n]) => p + ' ' + n).join(', '));
  if (shared.size) console.log('  共有 object:', [...shared].slice(0, 12).map(([p, n]) => p + ' ' + n).join(' | '));
  const SKIP = FIX_SKIP, SD = new Map(); for (const [nm, L] of SIDINGS) L.forEach((h, i) => SD.set(h, [nm, i]));
  const out = fixEncode(list, parked, pl.res, { units: pl.units.length, siding: pl.stat.siding, tandem: pl.stat.tandem || 0, nl, waits: ot ? ot.waits : 0 }, key, day);
  if (out.objs.length) console.log('  共有 object', out.objs.length);
  const js = JSON.stringify(out), gz = zlib.gzipSync(js, { level: 9 });
  // 戻して同じになるか(列車の参照は番号、Map/Set と SKIP は除く、キーの順は問わない)
  const R = fixRevive(JSON.parse(js)), ridx = new Map(R.list.concat([...R.reserve.values()].filter(u => !R.list.includes(u))).map((t, i) => [t, i]));
  const RALL = R.list.concat(reserve.map(u => R.reserve.get([...parked].find(([, v]) => v === u)[0])));
  const ridx2 = new Map(RALL.map((t, i) => [t, i]));
  const canon = (v, ix, top) => { if (v === null || typeof v !== 'object') return typeof v === 'number' ? (isFinite(v) ? Math.round(v * 1e6) / 1e6 : String(v)) : v;
    if (!top && ix.has(v)) return '#' + ix.get(v); if (v instanceof Map || v instanceof Set) return undefined;
    if (SD.has(v)) return 'SD' + SD.get(v).join(':');
    if (Array.isArray(v)) return v.map(x => { const y = canon(x, ix, false); return y === undefined ? null : y; });
    const o = {}; for (const k of Object.keys(v).sort()) { if (SKIP.has(k)) continue; const y = canon(v[k], ix, false); if (y !== undefined) o[k] = y; } return o; };
  let diff = 0, first = null;
  all.forEach((t, i) => { const a = JSON.stringify(canon(t, idx, true)), b = JSON.stringify(canon(RALL[i], ridx2, true)); if (a !== b) { diff++; if (!first) { let j = 0; while (a[j] === b[j]) j++; first = t.no + ' @' + j + ' ' + a.slice(Math.max(0, j - 80), j + 60) + ' ||| ' + b.slice(Math.max(0, j - 80), j + 60); } } });
  const ra = JSON.stringify([...pl.res].map(([e, L]) => [e, L.map(r => r.map(x => canon(x, idx, false)))])), rb = JSON.stringify([...R.res].map(([e, L]) => [e, L.map(r => r.map(x => canon(x, ridx2, false)))]));
  console.log('  戻して違う列車', diff, 'res', ra === rb ? '同じ' : '違う', first || '');
  fs.writeFileSync('fix/plan_' + day + '.json.gz', gz);
  console.log('  segs を作り直せない', out.bad, 'JSON', (js.length / 1e6).toFixed(1) + 'MB', 'gzip', (gz.length / 1e6).toFixed(2) + 'MB');
}
`);
