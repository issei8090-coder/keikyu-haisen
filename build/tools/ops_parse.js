// 運用表(テキスト)を読む。1行 = 「駅 時刻 →/← 時刻 駅」。（駅）は途中の経由駅で、次の行に続く。－－－ は入庫などの切れ目
const fs = require('fs');
const ST = { 上野: '京成上野', 成田空: '成田空港', 成田: '京成成田', 高砂: '京成高砂', 佐倉: '京成佐倉', 臼井: '京成臼井', 宗吾参: '宗吾参道', 芝山: '芝山千代田', 芝山千: '芝山千代田',
  日本医: '印旛日本医大', 印旛医: '印旛日本医大', 羽田空: '羽田空港第1・第2ターミナル', 羽田: '羽田空港第1・第2ターミナル', 久里浜: '京急久里浜', 逗子: '逗子・葉山', 文庫: '金沢文庫', 八景: '金沢八景', 蒲田: '京急蒲田',
  印西牧: '印西牧の原', 新町: '神奈川新町', 新鎌谷: '新鎌ヶ谷', 海岸: '三浦海岸', 三浦海: '三浦海岸', 横須賀: '横須賀中央' };
module.exports = function parse(f) { const duties = []; let cur = null, brk = false, open = null;
  const tok = s => { let m; if ((m = s.match(/^（(.+)）$/))) return { st: ST[m[1]] || m[1] }; if ((m = s.match(/^(\D+)(\d{4})$/)) || (m = s.match(/^(\d{4})(\D+)$/))) { const [n, t] = /^\d/.test(m[1]) ? [m[2], m[1]] : [m[1], m[2]]; return { st: ST[n] || n, t: +t.slice(0, 2) * 60 + +t.slice(2) }; } };
  for (let ln of fs.readFileSync(f, 'utf8').split(/\r?\n/)) { ln = ln.replace(/地図を見る|高速バスを予約/g, '').replace(/[　\s┌└┐┘─]/g, ''); if (!ln) continue;
    if (/^((AE|A)?\d+[A-Z]?|\d+行路)$/.test(ln)) { cur = { id: ln, trips: [] }; duties.push(cur); brk = false; open = null; continue; }
    if (/^－+$/.test(ln)) { brk = true; continue; }
    const m = ln.match(/^(.+?)([→←])(.+)$/), L = m && tok(m[1]), R = m && tok(m[3]); if (!L || !R) { console.log('読めない行:', f, ln); continue; }
    const [a, b] = m[2] === '→' ? [L, R] : [R, L];
    if (open && a.t == null && a.st === open.via) { if (b.t == null) open.via = b.st; else { cur.trips.push({ from: open.from, dep: open.dep, to: b.st, arr: b.t, brk: open.brk }); open = null; } continue; }
    if (a.t == null) { console.log('始まりの時刻が無い:', f, cur.id, ln); continue; }
    if (b.t == null) { open = { from: a.st, dep: a.t, via: b.st, brk }; brk = false; continue; }
    cur.trips.push({ from: a.st, dep: a.t, to: b.st, arr: b.t, brk }); brk = false; }
  return duties; };
