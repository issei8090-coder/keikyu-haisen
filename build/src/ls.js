// 京成公式のスカイライナー時刻表(dl_sky/tables.txt)と、図の時刻表を1本ずつ比べる
const fs = require('fs');
const TT = JSON.parse(fs.readFileSync('tt.json', 'utf8'));
const hm = m => Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0');
const L = fs.readFileSync('dl_sky/tables.txt', 'utf8').split(/\r?\n/); let dir = '', day = '', cols = null, n = 0, bad = 0;
const dec = tr => { const a = tr[3], o = {}; for (let i = 0; i < a.length; i += 3) o[TT.st[a[i]]] = [a[i + 1], a[i + 1] + a[i + 2]]; return o; };
const all = { wd: TT.wd.filter(t => /AE/.test(t[0])).map(t => [t[0], dec(t)]), hd: TT.hd.filter(t => /AE/.test(t[0])).map(t => [t[0], dec(t)]) };
const used = { wd: new Set(), hd: new Set() };
for (const ln of L) {
  if (ln.startsWith('## 下り')) dir = 'd'; else if (ln.startsWith('## 上り')) dir = 'u'; else if (ln === '## 平日') day = 'wd'; else if (ln.startsWith('## 土曜')) day = 'hd';
  else if (ln.startsWith('号 |')) cols = ln.split(' | ').slice(1);
  else if (/^\d+ \|/.test(ln)) { const c = ln.split(' | '), go = c[0], ts = c.slice(1).map(x => x === '-' ? null : +x.split(':')[0] * 60 + +x.split(':')[1]); n++;
    const t = all[day].find(([no, o]) => o[cols[0]] && o[cols[0]][1] === ts[0] && Object.keys(o)[0] === cols[0]);
    if (!t) { bad++; console.log(day, dir, go + '号', hm(ts[0]) + '発', ': 図に無い'); continue; }
    used[day].add(t[0]); const diff = [];
    cols.forEach((st, i) => { const o = t[1][st], isArr = (dir === 'd' ? i >= 4 : i >= 2); if (ts[i] == null) { if (o && o[0] !== o[1]) diff.push(st + ' 公式は通過/図は停車'); return; } if (!o) { diff.push(st + ' 図に無い'); return; } const v = isArr ? o[0] : o[1]; if (v !== ts[i]) diff.push(st + ' 公式' + hm(ts[i]) + '/図' + hm(v)); });
    if (diff.length) { bad++; console.log(day, dir, go + '号', t[0], diff.join(', ')); } } }
console.log('公式', n, '本  違い', bad);
for (const d of ['wd', 'hd']) console.log(d, '公式の表に無いAE列車:', all[d].filter(([no]) => !used[d].has(no)).map(([no, o]) => no + ' ' + Object.keys(o)[0] + hm(Object.values(o)[0][1]) + '→' + Object.keys(o).pop()).join(' ; '));
