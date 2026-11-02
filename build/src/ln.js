// 実際の運用表(ops/*.txt)と、図の上の折り返しのつながり・運行番号を突き合わせる。 node src/ln.js <ファイル> <wd|hd> [-v]
const fs = require('fs');
const D = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const TT = JSON.parse(fs.readFileSync('tt.json', 'utf8'));
const hm = m => String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
const ST = { 上野: '京成上野', 成田空: '成田空港', 成田: '京成成田', 高砂: '京成高砂', 佐倉: '京成佐倉', 臼井: '京成臼井', 宗吾参: '宗吾参道', 芝山: '芝山千代田', 芝山千: '芝山千代田',
  日本医: '印旛日本医大', 羽田空: '羽田空港第1・第2ターミナル', 久里浜: '京急久里浜', 逗子: '逗子・葉山', 文庫: '金沢文庫', 蒲田: '京急蒲田', 印西牧: '印西牧の原', 新町: '神奈川新町', 新鎌谷: '新鎌ヶ谷', 海岸: '三浦海岸' };
const parse = require('../tools/ops_parse.js');
function parseOld(f) { const duties = []; let cur = null, brk = false, open = null;
  const tok = s => { let m; if ((m = s.match(/^（(.+)）$/))) return { st: ST[m[1]] || m[1] }; if ((m = s.match(/^(\D+)(\d{4})$/)) || (m = s.match(/^(\d{4})(\D+)$/))) { const [n, t] = /^\d/.test(m[1]) ? [m[2], m[1]] : [m[1], m[2]]; return { st: ST[n] || n, t: +t.slice(0, 2) * 60 + +t.slice(2) }; } };
  for (let ln of fs.readFileSync(f, 'utf8').split(/\r?\n/)) { ln = ln.replace(/地図を見る/, '').replace(/[　\s┌└┐┘─]/g, ''); if (!ln) continue;
    if (/^(AE|A)?\d+[A-Z]?$/.test(ln)) { cur = { id: ln, trips: [] }; duties.push(cur); brk = false; open = null; continue; }
    if (/^－+$/.test(ln)) { brk = true; continue; }
    const m = ln.match(/^(.+?)([→←])(.+)$/), L = m && tok(m[1]), R = m && tok(m[3]); if (!L || !R) { console.log('読めない行:', ln); continue; }
    const [a, b] = m[2] === '→' ? [L, R] : [R, L];
    if (open && a.t == null && a.st === open.via) { if (b.t == null) open.via = b.st; else { cur.trips.push({ from: open.from, dep: open.dep, to: b.st, arr: b.t, brk: open.brk }); open = null; } continue; }
    if (a.t == null) { console.log('始まりの時刻が無い:', cur.id, ln); continue; }
    if (b.t == null) { open = { from: a.st, dep: a.t, via: b.st, brk }; brk = false; continue; }
    cur.trips.push({ from: a.st, dep: a.t, to: b.st, arr: b.t, brk }); brk = false; }
  return duties; }
const [file, day, V] = process.argv.slice(2);
eval(fs.readFileSync('src/core.js', 'utf8') + fs.readFileSync('src/ttcore.js', 'utf8') + `
{ const list = TT[day].map(ttDecode).filter(t => t.ev.length > 1); ttOvertakes(list); ttCouple(list, day); ttLink(list);
  const duties = parse(file); const c = { 列車: 0, 一致: 0, 途中の一部: 0, 終着違い: 0, 無い: 0, 折り返し: 0, 折り返し一致: 0, 駅が変わる: 0, 番号一致: 0 }; const bad = [], nf = [], runbad = [], badSt = {};
  const tm = e => e.dep != null ? e.dep : e.arr, eq = (a, b) => a != null && (a - b) % 1440 === 0, near = (a, b) => a != null && Math.abs(((a - b) % 1440 + 1440 + 720) % 1440 - 720) <= 3;
  const find = x => { let r = null; for (const t of list) { const i = t.ev.findIndex(e => e.name === x.from && eq(e.dep != null ? e.dep : e.arr, x.dep)); if (i < 0) continue; const j = t.ev.findIndex((e, k) => k > i && e.name === x.to && (near(e.arr, x.arr) || eq(e.dep, x.arr)));
      const q = { t, i, j, full: i === 0 && j === t.ev.length - 1 }; if (j >= 0 && (q.full || !r || r.j < 0)) { r = q; if (q.full) break; } else if (!r) r = q; } return r; };
  const des = t => t.no + ' ' + t.names[0] + hm(t.ev[0].dep) + '→' + t.names[t.names.length - 1] + hm(t.ev[t.ev.length - 1].arr);
  for (const d of duties) { let p = null, pq = null;
    for (const x of d.trips) { c.列車++; const q = find(x), s = d.id + ' ' + x.from + hm(x.dep) + '→' + x.to + hm(x.arr);
      if (!q) { c.無い++; nf.push(s + ' : 図に無い'); } else if (q.j < 0) { c.終着違い++; nf.push(s + ' : 終着が違う 図=' + des(q.t)); } else if (q.full) c.一致++; else { c.途中の一部++; if (V) nf.push(s + ' : 図では ' + des(q.t) + ' の一部'); }
      if (q) { const r = ttRunOf(q.t).num; if (r === d.id || +r === +d.id || ('0' + r) === d.id) c.番号一致++; else runbad.push(s + ' 図の運行番号=' + r + ' (' + q.t.no + ')'); }
      if (p && !x.brk) { if (p.to !== x.from) c.駅が変わる++; else if (pq && q) { c.折り返し++; let ok = pq.t === q.t; for (let n = pq.t, k = 0; !ok && n && k < 3; n = n.next, k++) if (n.next === q.t && (k === 0 || n.next)) ok = k === 0; if (ok) c.折り返し一致++; else { badSt[x.from] = (badSt[x.from] || 0) + 1; const a = pq.t, b = q.t;
            bad.push(d.id + ' ' + x.from + ' ' + hm(p.arr) + '着→' + hm(x.dep) + '発(' + (((x.dep - p.arr) % 1440 + 1440) % 1440) + '分) | 図: 着いた' + a.no + '(' + a.cars + '両)は ' + (a.next ? a.next.no + ' ' + hm(a.next.ev[0].dep) + '発へ' : a.tail || a.deadOut ? '引上・車庫へ' : 'つながり無し') + ' / 出る' + b.no + '(' + b.cars + '両)は ' + (b.prev ? b.prev.no + ' ' + hm(b.prev.ev[b.prev.ev.length - 1].arr) + '着から' : b.fromSiding || b.deadIn ? '引上・車庫から' : 'つながり無し')); } } }
      p = x; pq = q; } }
  console.log('==', file, day, duties.length + '運用', JSON.stringify(c)); console.log('-- 見つからない・終着違い', nf.length); nf.slice(0, V ? 999 : 40).forEach(x => console.log('  ', x));
  console.log('-- 折り返しが違う', bad.length, JSON.stringify(badSt)); bad.slice(0, V ? 999 : 60).forEach(x => console.log('  ', x));
  console.log('-- 運行番号が違う', runbad.length); runbad.slice(0, V ? 999 : 25).forEach(x => console.log('  ', x)); }
`);
