# 運用の編集(ユーザーが画面で直す運用)を ttcore.js に入れる
p = 'src/ttcore.js'
s = open(p, encoding='utf-8', newline='').read()
NL = '\r\n' if '\r\n' in s else '\n'
def rep(a, b, cnt=1):
    global s
    a = a.replace('\n', NL); b = b.replace('\n', NL)
    assert s.count(a) == cnt, (s.count(a), a[:80])
    s = s.replace(a, b)

# 1) ttLinkG の最後(つながりから時刻をそろえる前)でユーザーの編集を当てる
rep("""  let n = 0;
  for (const a of list) {
    const d = a.next; if (!d) continue;
    n++;""", """  ttUserOps(list);
  let n = 0;
  for (const a of list) {
    const d = a.next; if (!d) continue;
    n++;""")

# 2) 関数本体
rep("""function ttLink(list) {""", """// ===== 運用の編集(画面の「運用の編集」で直したもの。build/ops_user.json とブラウザの保存を合わせた USER_OPS) =====
//  link: 終着の列車 a を、同じ駅の始発 d につなぐ   cut: a のあとのつながりを切る(ほかの列車にもつながない)
//  dh: 回送を足す(発駅・発時刻・着駅・着時刻・両数・前の列車・次の列車)   del: 自動で作った回送を消す
//  計画でつなげなかったもの(引上線が空いていないなど)は list.userMsg に書き、画面に出す
const ttHM = s => { const m = /^(\\d{1,2}):(\\d{2})$/.exec(String(s == null ? '' : s).trim()); if (!m) return null; let h = +m[1]; if (h < 4) h += 24; return h * 60 + +m[2]; };
function ttUserOps(list) {
  const day = list.day || (typeof ttDay !== 'undefined' ? ttDay : '');
  const U = typeof USER_OPS !== 'undefined' && USER_OPS ? USER_OPS[day] : null;
  list.userMsg = [];
  if (!U) return;
  const msg = s => list.userMsg.push(s);
  const endAt = (no, st) => list.find(t => t.no === no && t.names[t.names.length - 1] === st && !t.exitEnd);
  const startAt = (no, st) => list.find(t => t.no === no && t.names[0] === st && !t.exitStart);
  const cut = a => { if (a && a.next) { a.next.prev = null; a.next = null; } };
  const cutP = d => { if (d && d.prev) { d.prev.next = null; d.prev = null; } };
  const join = (a, d, x) => { cut(a); cutP(d); a.next = d; d.prev = a; a.userLink = d; a.userEdit = x; };
  for (const x of U.del || []) {
    const i = list.findIndex(t => t.dh && !t.user && t.no === x.no && t.names[0] === x.from && (!x.dep || ttHM(x.dep) === t.ev[0].dep));
    if (i < 0) { msg(`回送 ${x.no}(${x.from} ${x.dep || ''}発)が見つからないので消せません`); continue; }
    const t = list[i]; cutP(t); cut(t); list.splice(i, 1);
  }
  for (const x of U.dh || []) {
    const d0 = ttHM(x.dep), a1 = ttHM(x.arr);
    if (d0 == null || a1 == null || a1 <= d0) { msg(`回送 ${x.no || ''}: 時刻が正しくありません(${x.dep}→${x.arr})`); continue; }
    if (!stByName.has(x.from) || !stByName.has(x.to)) { msg(`回送 ${x.no || ''}: 駅名が見つかりません(${x.from}→${x.to})`); continue; }
    const t = { no: x.no || '回送', type: 'kaiso', dest: x.to, cars: +x.cars || 8, fl: 0, x0: '', x1: '', tseg: null, ev: [{ name: x.from, arr: d0, dep: d0 }, { name: x.to, arr: a1, dep: a1 }], tt: true, s: 0, g: null, route: undefined, prev: null, next: null, k0: 0, dh: true, user: x };
    ttSchedule(t); list.push(t);
    if (x.prev) { const a = endAt(x.prev, x.from); if (!a) msg(`回送 ${t.no}: 前の列車 ${x.prev}(${x.from}止まり)が見つかりません`); else if (a.ev[a.ev.length - 1].arr > d0) msg(`回送 ${t.no}: 前の列車 ${x.prev} が着く前に発車します`); else join(a, t, x); }
    if (x.next) { const d = startAt(x.next, x.to); if (!d) msg(`回送 ${t.no}: 次の列車 ${x.next}(${x.to}始発)が見つかりません`); else if (d.ev[0].dep < a1) msg(`回送 ${t.no}: 次の列車 ${x.next} の発車に間に合いません`); else join(t, d, x); }
  }
  for (const x of U.cut || []) {
    const a = endAt(x.a, x.st); if (!a) { msg(`切る: ${x.a}(${x.st}止まり)が見つかりません`); continue; }
    cut(a); a.userCut = true;
    if (x.d) { const d = startAt(x.d, x.st); if (d) { cutP(d); d.userCutP = true; } }
  }
  for (const x of U.link || []) {
    const a = endAt(x.a, x.st), d = startAt(x.d, x.st);
    if (!a || !d) { msg(`つなぐ: ${!a ? x.a + '(' + x.st + '止まり)' : x.d + '(' + x.st + '始発)'}が見つかりません`); continue; }
    if (d.ev[0].dep < a.ev[a.ev.length - 1].arr) { msg(`つなぐ: ${x.d} は ${x.a} が着く前に発車します`); continue; }
    join(a, d, x);
  }
}
// 計画のあとで、ユーザーがつないだのにつながらなかった組を調べる
function ttUserCheck(list) {
  const out = (list.userMsg || []).slice();
  for (const a of list) if (a.userLink && a.next !== a.userLink) out.push(`${a.no} → ${a.userLink.no}(${a.names[a.names.length - 1]}): 計画でつなげませんでした` + (a.tail === null || !a.tail ? '(引上線・ホームが空いていない見込み)' : ''));
  return out;
}
function ttLink(list) {""")

# 3) 計画の relink でも、ユーザーが切ったものはつながない
rep("""      if (a.next) continue;
      const ds = byStn.get(a.names[a.names.length - 1]); if (!ds) continue; const e = lastE(a), sd = a.tail;
      const cand = ds.filter(d => !d.prev && """, """      if (a.next || a.userCut) continue;
      const ds = byStn.get(a.names[a.names.length - 1]); if (!ds) continue; const e = lastE(a), sd = a.tail;
      const cand = ds.filter(d => !d.prev && !d.userCutP && """)

open(p, 'w', encoding='utf-8', newline='').write(s)
print('ok')
