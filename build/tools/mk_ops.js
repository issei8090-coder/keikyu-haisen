// 実際の運用表(ops/*_wd.txt, *_hd.txt)を時刻表の列車に当てはめて、tt.json の ops に書き込む。
//   node tools/mk_ops.js        (tt.json を作り直したら、これも実行し直す)
// ops[day][列車番号@始発時刻] = [運用の名前, 次に折り返す列車, 入庫をはさんで次に走る列車, 0/1(1=図の列車の一部にしか当たらない)]
const fs = require('fs'), parse = require('./ops_parse.js');
const D = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const TT = JSON.parse(fs.readFileSync('tt.json', 'utf8'));
const hm = m => String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
const FILES = ['kq', 'ks', 'th'];   // 後のものほど優先(直通運用の T・K・N・H の名前を、京急の行路番号より優先する)
eval(fs.readFileSync('src/core.js', 'utf8') + fs.readFileSync('src/ttcore.js', 'utf8') + `
TT.ops = {};
for (const day of ['wd', 'hd']) { const list = TT[day].map(ttDecode).filter(t => t.ev.length > 1), ops = TT.ops[day] = {}; const key = t => t.no + '@' + t.ev[0].dep;
  const eq = (a, b) => a != null && (a - b) % 1440 === 0, near = (a, b) => a != null && Math.abs(((a - b) % 1440 + 1440 + 720) % 1440 - 720) <= 3;
  const find = x => { let r = null; for (const t of list) { const i = t.ev.findIndex(e => e.name === x.from && eq(e.dep != null ? e.dep : e.arr, x.dep)); if (i < 0) continue; const j = t.ev.findIndex((e, k) => k > i && e.name === x.to && (near(e.arr, x.arr) || eq(e.dep, x.arr)));
      const q = { t, i, j, full: i === 0 && j === t.ev.length - 1 }; if (j >= 0 && (q.full || !r || r.j < 0)) { r = q; if (q.full) break; } else if (!r) r = q; } return r && r.j >= 0 ? r : null; };
  for (const f of FILES) { const file = 'ops/' + f + '_' + day + '.txt'; if (!fs.existsSync(file)) continue; const c = { 運用: 0, 列車: 0, 当てはまる: 0, 一部: 0, 無い: 0, 折り返し: 0, 食い違い: 0 }; const miss = [];
    for (const d of parse(file)) { c.運用++; let p = null, pq = null;
      for (const x of d.trips) { c.列車++; const q = find(x);
        if (!q) { c.無い++; miss.push(d.id + ' ' + x.from + hm(x.dep) + '→' + x.to + hm(x.arr)); }
        else { const last = q.t.ev.length - 1; let k = key(q.t); const o0 = ops[k] || (ops[k] = ['', 0, 0, 0]); let o = o0;
          // 列車の一部にしか当たらない = 途中の駅で車両を取り替える。後ろ半分(q.i から終点)・前半分(始発から q.j)を別の列車として扱う
          if (!q.full && q.i > 0 && q.j === last) { c.一部++; if (!o0.full) { o0[4] = q.i; k = q.t.no + '@' + q.t.ev[q.i].dep; o = ops[k] || (ops[k] = ['', 0, 0, 0]); o[0] = d.id; q.kStart = k; q.kEnd = k; } }
          else if (!q.full && q.i === 0 && q.j < last) { c.一部++; if (!o0.full) { o0[0] = d.id; o0[3] = 0; o0[4] = q.j; q.kStart = k; q.kEnd = k; } }
          else { o[0] = d.id; if (q.full) { c.当てはまる++; o[3] = 0; o[4] = 0; q.kStart = k; q.kEnd = k; } else { c.一部++; if (!o0.full) o[3] = 1; } }
          if (q.full) Object.defineProperty(o, 'full', { value: true, enumerable: false, configurable: true });
          if (p && pq && pq.kEnd && q.kStart && p.to === x.from && pq.kEnd !== q.kStart) { const po = ops[pq.kEnd], slot = x.brk ? 2 : 1; if (po[slot] && po[slot] !== q.kStart) c.食い違い++; po[slot] = q.kStart; if (!x.brk) { po[2] = 0; c.折り返し++; } } }
        p = x; pq = q; } }
    console.log(day, file, JSON.stringify(c)); miss.forEach(m => console.log('   時刻表に無い:', m)); }
  console.log(day, '運用の分かった列車', Object.keys(ops).length, '/', list.length); }
fs.writeFileSync('tt.json', JSON.stringify(TT));
`);
