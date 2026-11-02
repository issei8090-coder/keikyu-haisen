const EXIT_N = '京成千葉線(千葉中央方面)';   // 図の外へ出る先(列車ごとの指定が無いとき)
const RUN_MAX = 30;       // 同じ運行番号の列車どうしなら、ここまであいていても同じ車両の折り返しとみなす(分)
const TURN_MAX = 20;      // 途中駅で折り返し待ちとみなす最大時間(分)。これより長いものは回送で出入りしたとみなす
const TERMINI = new Set(['羽田空港第1・第2ターミナル', '浦賀', '三崎口', '逗子・葉山', '小島新田', '西馬込', '京成上野', '成田空港', '芝山千代田']);   // 行き止まりの終着駅
const FAST = new Set(['kaitoku', 'tokkyu', 'apkaitoku', 'wing', 'access', 'tsukin', 'liner']);
const TANDEM = 15;
const PLAT_GAP = 40;     // 同じ番線で、前の列車が出てから次が着くまでなるべく空ける秒(空けられる番線が無ければ5秒)        // 同じ線に2本入るとき(縦列停車)の間隔
const SIDING_MIN = 5;     // 折り返しがこの分数以上なら、いったん引上線へ上げる
const MAINL = '泉岳寺 品川 北品川 新馬場 青物横丁 鮫洲 立会川 大森海岸 平和島 大森町 梅屋敷 京急蒲田 雑色 六郷土手 京急川崎 八丁畷 鶴見市場 京急鶴見 花月総持寺 生麦 京急新子安 子安 神奈川新町 京急東神奈川 神奈川 横浜 戸部 日ノ出町 黄金町 南太田 井土ヶ谷 弘明寺 上大岡 屏風浦 杉田 京急富岡 能見台 金沢文庫 金沢八景 追浜 京急田浦 安針塚 逸見 汐入 横須賀中央 県立大学 堀ノ内 京急大津 馬堀海岸 浦賀'.split(' ');
function ttDecode(tr) {
  const ev = [];
  for (let i = 0; i < tr[3].length; i += 3) ev.push({ name: TT.st[tr[3][i]], arr: tr[3][i + 1], dep: tr[3][i + 1] + tr[3][i + 2] });
  // 行き先: 都営・京急の時刻表で「京成高砂行き」でも、京成の時刻表で先までつながっている列車(781K など)は終点を行き先にする
  const t = { no: tr[0], type: TT.ty[tr[1]], dest: tr[2] && !(tr[2] === '京成高砂' && ev[ev.length - 1].name !== '京成高砂' && ev.some(e => e.name === '京成高砂')) ? tr[2] : ev[ev.length - 1].name, cars: tr[4] || 0, fl: tr[5] || 0, x0: tr[6] || '', x1: tr[7] || '', tseg: tr[8] ? tr[8].map(([i, y]) => [i, TT.ty[y]]) : null, ev, tt: true, s: 0, g: null, route: undefined, prev: null, next: null, k0: 0 };
  ttSchedule(t);
  return t;
}
// 時刻表(分単位)から、各停車駅の到着・発車の秒を決める。ev に as/ds(秒)があればそれを使う(推定した通過待ち)
function ttSchedule(t) {
  const ev = t.ev, names = t.names = ev.map(e => e.name), n = ev.length;
  t.k0 = 0;
  t.exitStart = t.fl & 1 ? (t.x0 || EXIT_N) : null;   // 図の外(京成千葉線など)から入ってくる
  t.exitEnd = t.fl & 2 ? (t.x1 || EXIT_N) : null;     // 図の外へ出ていく
  t.long = ev.map((e, i) => (i > 0 && i < n - 1 && ((e.wait && !e.thru) || e.ot)) ? 2 : (i > 0 && i < n - 1 && e.dep - e.arr >= 2 && !e.ovr) ? 1 : 0);   // 2: 待避・接続待ち 1: 長く止まるだけ
  const A = [], P = [];
  ev.forEach((e, i) => {
    const single = e.arr === e.dep;
    // 時刻表は分単位。同じ分の「発車」と「到着」がぶつからないよう、発車は分の頭、到着は分の後半とみなす
    let a = i === 0 ? e.dep * 60 - 25 : (single ? e.dep * 60 + 20 : e.arr * 60 + 25);   // 1分の中で止まる駅は15秒ほど(京急の停車は短い)
    let d = i === 0 ? e.dep * 60 + 5 : e.dep * 60 + (single ? 35 : 5);
    if (e.as != null) { a = e.as; d = e.ds; }
    if (i === n - 1 && !t.exitEnd && e.as == null) a = e.arr * 60 + 30;
    if (i > 0 && e.early != null && e.as == null) a = Math.min(a, P[i - 1] + e.early);   // 時刻表に発車時刻しか無い駅: 前の駅からふつうに走って着き、発車まで止まっている
    if (i > 0) a = Math.max(a, P[i - 1] + 20);
    d = e.thru ? a : Math.max(d, a + 10);
    if (i === n - 1) d = a + 25;
    A.push(a); P.push(d);
  });
  if (t.exitStart) { A.unshift(A[0] - 20); P.unshift(A[0]); t.k0 = 1; }
  if (t.exitEnd) { A.push(P[P.length - 1] + 20); P.push(A[A.length - 1]); }
  t.A = A; t.P = P; t.start = A[0]; t.end = P[P.length - 1];
}
// ===== 運行番号と車両の所属 =====
// 列車番号から求める。運行番号は奇数で、上り(北行)の列車番号は運行番号から1を引いた偶数なので、偶数なら1を足す(1726T → 27T、1012 → 13)
//  ・末尾の記号が所属: H=京急 K=京成 T=都営 N=北総 F=新京成。京急線内だけの記号(A・B・C・D・SH など)は京急車
//  ・記号の無い番号・途中に記号が入る番号(9B12)は、走る場所から京成車か京急車か決める
//  ・スカイライナー(8AE12)の数字は号数で、1日同じ車両が名乗る番号ではない(chain: false)
const RUN_CO = { H: '京急', K: '京成', T: '都営', N: '北総', F: '新京成' };
function ttRunOf(t) {
  if (t.run !== undefined) return t.run;
  // 実際の運用表に載っている列車は、その運用の名前(01T・A01・AE01 など)が運行番号。車両の所属も末尾の文字で決まる(列車番号の末尾が A・C・D の京急線内列車でも、H の運用なら京急車)
  if (t.ops && !/行路/.test(t.ops.id)) { const id = t.ops.id, m = /[A-Z]+/.exec(id)[0], c = m === 'A' || m === 'AE' ? '京成' : RUN_CO[m] || '京急'; return t.run = { num: id, co: c, chain: true, key: c + ' ' + id, duty: id }; }
  const no = t.no || ''; let m, num = '', co = '', chain = true;
  const odd = v => { const n = +v; return n % 2 ? n : n + 1; };
  const ks = () => { const st = stByName.get(t.ev[0].name); return st && st.stops.length && N[E[st.stops[0][0]].a].y > KS_Y; };
  if ((m = /^(\d{1,2})(\d{2})([A-Z]{1,2})[a-z]?$/.exec(no))) { num = odd(m[2]) + m[3]; co = RUN_CO[m[3]] || '京急'; }
  else if ((m = /^(\d{1,2})([A-Z]{1,2})(\d{2})[a-z]?$/.exec(no))) { chain = m[2] !== 'AE'; num = m[2] + (chain ? String(odd(m[3])).padStart(2, '0') : m[3]); co = '京成'; }
  else if ((m = /^(\d{1,2})(\d{2})[a-z]?$/.exec(no))) { num = String(odd(m[2])).padStart(2, '0'); co = ks() ? '京成' : '京急'; }
  else { num = no; co = no ? (ks() ? '京成' : '京急') : ''; chain = false; }
  return t.run = { num, co, chain, key: chain && num ? co + ' ' + num : null, duty: t.ops ? t.ops.id : null };   // duty: 京急の行路番号(運用表にある列車だけ)
}
// ===== 実際の運用表 =====
// tt.json の ops(tools/mk_ops.js が運用表から作る)を列車に当てはめる。 t.ops = { id: 運用の名前, auth: 折り返しの相手まで分かっている }
//  t.opsNext = 着いたあと、そのまま折り返して走る列車   t.opsBrk = 入庫などをはさんで次に走る列車
const LINK_FIX = { wd: [['6AE10', '8AE11']] };
// 成田空港に着いたあと、印旛日本医大まで回送して始発になるライナー(平日 5AE11 → 6AE10。運用表 AE11 の、表に載っていない部分)
const INB_FIX = { wd: { '5AE11': '6AE10' } };
const OPS_MAX = 90;   // 車庫の無い駅で、運用表どおりにホームや引上線で待たせる時間の上限(分)。これより長くあくときは、いったん車庫へ回送したものとみなす
function ttOps(list) {
  if (list.opsDone || typeof TT === 'undefined' || !TT.ops) return; list.opsDone = true;
  const by = new Map(list.map(t => [t.no + '@' + t.ev[0].dep, t]));
  let ops = null, best = 0;   // 平日・土休日のどちらの表かは、当てはまる列車の数で決める
  for (const d in TT.ops) { let n = 0; for (const k in TT.ops[d]) if (by.has(k)) n++; if (n > best) { best = n; ops = TT.ops[d]; list.day = d; } }
  if (!ops || best < Object.keys(ops).length * 0.9) return;
  // 途中の駅(金沢文庫・京成高砂)で車両を取り替える列車: その駅で2本に分ける。前半分はその駅止まり(車庫へ)、後ろ半分はその駅始発(車庫から)。
  // 列車番号は同じ。t.swapOut / t.swapIn でたがいを指す
  for (const [k, t] of [...by]) { const o = ops[k], q = o && o[4]; if (!q || q <= 0 || q >= t.ev.length - 1 || t.split) continue;
    const mid = t.ev[q], b = Object.assign({}, t, { ev: [Object.assign({}, mid, { arr: mid.dep }), ...t.ev.slice(q + 1)], fl: t.fl & 2, x0: '', prev: null, next: null, route: undefined,
      tseg: t.tseg ? (l => l.length && l[0][0] === 0 ? l : [[0, t.tseg.filter(([i]) => i <= q).pop()[1]], ...l])(t.tseg.filter(([i]) => i > q).map(([i, y]) => [i - q, y])) : null });
    t.ev = [...t.ev.slice(0, q), Object.assign({}, mid, { dep: mid.arr })]; t.fl &= 1; t.x1 = ''; if (t.tseg) t.tseg = t.tseg.filter(([i]) => i <= q);
    t.split = b.split = true; t.swapOut = b; b.swapIn = t; delete b.A; delete b.P;
    ttSchedule(t); ttSchedule(b); list.push(b); by.set(b.no + '@' + b.ev[0].dep, b); }
  for (const [k, t] of by) { const o = ops[k]; if (!o || !o[0]) continue; t.ops = { id: o[0], auth: !o[3] }; t.run = undefined; t.opsNext = by.get(o[1]) || null; t.opsBrk = by.get(o[2]) || null;
    if (!o[3] && /[TKNH]$|行路/.test(o[0]) && t.cars && t.cars < 8) { t.cars0 = t.cars; t.cars = 8; } }   // 直通運用と京急の行路表(8両の運用)に載っている列車は8両。時刻表の両数が違っていても、同じ車両が続けて走る
  // 運用表に無いスカイライナー(平日 6AE10): 列車番号の下2桁から運用を決める。運用 AEnn は nn(下り・奇数)と nn-1(上り)、それに30・60を足した番号を使う(例: 6AE10 は AE11)
  for (const t of list) { const m = /^\d{1,2}AE(\d{2})$/.exec(t.no); if (!m || t.ops) continue; let b = +m[1] % 30; if (b % 2 === 0) b++; const id = 'AE' + String(b).padStart(2, '0'); if (list.some(x => x.ops && x.ops.id === id)) { t.ops = { id, auth: false }; t.run = undefined; } }
}
// ===== 追い抜きの推定 =====
// 時刻表では「通過」でも、後から来た列車に先を越されているなら、途中の待避できる駅で待っていたはず。
// その駅に「通過待ち」の停車を挿入する(例: 子安の外線で待つ急行)。停車中に抜かれる場合は待避線側のホームへ。
// 追い抜きを調べる路線(駅の並び)。京急本線のほか、京成本線、押上線〜北総線〜成田スカイアクセス線
const OT_LINES = [MAINL,
  '京成上野 日暮里 新三河島 町屋 千住大橋 京成関屋 堀切菖蒲園 お花茶屋 青砥 京成高砂 京成小岩 江戸川 国府台 市川真間 菅野 京成八幡 鬼越 京成中山 東中山 京成西船 海神 京成船橋 大神宮下 船橋競馬場 谷津 京成津田沼 京成大久保 実籾 八千代台 京成大和田 勝田台 志津 ユーカリが丘 京成臼井 京成佐倉 大佐倉 京成酒々井 宗吾参道 公津の杜 京成成田 空港第2ビル 成田空港'.split(' '),
  '押上 京成曳舟 八広 四ツ木 京成立石 青砥 京成高砂 新柴又 矢切 北国分 秋山 東松戸 松飛台 大町 新鎌ヶ谷 西白井 白井 小室 千葉ニュータウン中央 印西牧の原 印旛日本医大 成田湯川 空港第2ビル 成田空港'.split(' '),
  // スカイライナーの道筋(上野〜高砂〜北総線〜成田空港)。青砥にも高砂にも止まらない列車は上の2つでは道筋が途切れるので、その列車が追い抜く場合だけここで調べる
  '京成上野 日暮里 新三河島 町屋 千住大橋 京成関屋 堀切菖蒲園 お花茶屋 青砥 京成高砂 新柴又 矢切 北国分 秋山 東松戸 松飛台 大町 新鎌ヶ谷 西白井 白井 小室 千葉ニュータウン中央 印西牧の原 印旛日本医大 成田湯川 空港第2ビル 成田空港'.split(' ')];
const OT_BONLY = [null, null, null, t => !t.names.includes('青砥') && !t.names.includes('京成高砂')];
const OT_POS = [];
let MAINPOS = null;
function ttOvertakes(list) {
  ttOps(list);   // 途中で車両を取り替える列車を分けるので、待避の推定より先に当てはめる
  // 成田空港を出た上り列車の空港第2ビル: 時刻表は発車時刻だけ(成田空港から4〜5分後)。実際は2分ほどで着いて発車を待つ。
  // そのままだと単線(成田空港〜空港第2ビル)を4〜5分かけて走ることになり、単線がずっとふさがってしまう
  for (const t of list) { const q1 = t.names.indexOf(NRT), q2 = t.names.indexOf(NRT2); if (q1 < 0 || q2 !== q1 + 1) continue; const e = t.ev[q2]; if (e.thru || e.early != null || e.as != null || t.A[q2 + t.k0] - t.P[q1 + t.k0] <= 170) continue; e.early = 130; ttSchedule(t); }
  const tot = { waits: 0, at: {}, loops: 0, loopAt: {}, passFix: 0 };
  OT_LINES.forEach((L, li) => {
    const ML = L.filter(n => stByName.has(n));
    if (ML.length < 3 || OT_POS[li]) return;
    const r = buildTimedRoute(ML, ML.map(() => 0), {}); if (r) OT_POS[li] = new Map(ML.map((n, i) => [n, r.stopD[i]]));
  });
  ttThru(list); tot.thruShift = ttThruShift(list) + ttInbaShift(list);
  OT_LINES.forEach((L, li) => {
    const ML = L.filter(n => stByName.has(n));
    if (ML.length < 3 || !OT_POS[li]) return;
    if (li === 0) MAINPOS = OT_POS[0];
    const st = ttOvertakesLine(list, ML, OT_POS[li], OT_BONLY[li]);
    tot.waits += st.waits; tot.loops += st.loops; tot.passFix += st.passFix || 0;
    for (const k in st.at) tot.at[k] = (tot.at[k] || 0) + st.at[k];
    for (const k in st.loopAt) tot.loopAt[k] = (tot.loopAt[k] || 0) + st.loopAt[k];
  });
  // ほかの列車を抜く駅では、長く止まっていても待避線側へは寄せない(e.ovr): 抜かれる列車が待避線にいるので、抜く側は本線に止まる
  for (const t of list) for (const e of t.ev) for (const b of e.otBy || []) { const i = b.names.indexOf(e.name), x = i > 0 ? b.ev[i] : null; if (x && !x.ot && !x.wait && !x.thru && !x.ovr) { x.ovr = true; b.long[i] = 0; } }
  // スカイアクセス線経由で長く無停車の列車は、途中の各駅の通過時刻も所要時間の比で決める(図の長さのままだと、長く描かれた区間で遅くなる)
  for (const t of list) { if (ksVia(t) !== 'access') continue;
    for (let i = 0; i + 1 < t.ev.length; i++) { const ra = THRU_REF[t.ev[i].name], rb = THRU_REF[t.ev[i + 1].name]; if (ra == null || rb == null || Math.abs(rb - ra) < 2.5) continue;
      const d0 = t.P[i + t.k0], a1 = t.A[i + 1 + t.k0];
      for (const nm in THRU_REF) { const r = THRU_REF[nm]; if ((r - ra) * (r - rb) >= 0 || !stByName.has(nm)) continue;
        const l = t.pass || (t.pass = []); if (!l.some(x => x.name === nm)) l.push({ name: nm, t: d0 + (a1 - d0) * (r - ra) / (rb - ra), ref: true }); } } }
  return tot;
}
// 京成高砂を通過する列車(スカイライナーなど)に、高砂の「通過点」を入れる。止まらずに通るが、番線の使い分け(北総方面は3番線など)は停車列車と同じになる
// スカイライナーの道筋のおおよその所要時間(日暮里からの分)。北総線内は区間ごとの標準走行時間(高砂〜東松戸 6.5分、〜新鎌ヶ谷 4.25、〜千葉NT中央 7.75、〜印旛日本医大 6.25、〜成田湯川 5.5、〜空港第2ビル 4.75)の比で割り振った
const THRU_REF = { '京成上野': -4, '日暮里': 0, '青砥': 8, '京成高砂': 10, '新柴又': 11, '矢切': 12, '北国分': 12.9, '秋山': 13.8, '東松戸': 14.8, '松飛台': 16, '大町': 16.9, '新鎌ヶ谷': 18, '西白井': 19.1, '白井': 20.4, '小室': 21.8, '千葉ニュータウン中央': 23.7, '印西牧の原': 26, '印旛日本医大': 28.4, '成田湯川': 32.5, '根古屋信号場': 34.3, '空港第2ビル': 36, '成田空港': 38 };
// ===== 成田湯川〜根古屋信号場の単線区間 =====
// 上りと下りが同時に入らないよう、行き違う場所を決める:
//  (1) 成田湯川のホームで行き違う(上りが先に湯川へ着いてから、下りが発車)  (2) 信号場で行き違う(下りが信号場に着くまで、上りは信号場を出ない)
// あわせて、信号場での停車は最大 10 分とし、超える分は駅のホームで待つ
function ttSingle(list) {
  const NK = '根古屋信号場', YU = '成田湯川', R = THRU_REF, RUN1 = 150, RUN2 = 135, MAXW = 600;
  if (!stByName.has(NK) || list.singleDone) return; list.singleDone = true;
  const info = t => {   // この区間を通る列車の、湯川・信号場・第2ビルの停車(無ければ null)
    const q2 = t.names.indexOf(NRT2); if (q2 < 0 || ksVia(t) !== 'access') return null;
    const qy = t.names.indexOf(YU), qn = t.names.indexOf(NK);
    let down, qx;   // qx: 湯川より西側の直近の点
    for (let i = q2 - 1; i >= 0; i--) if (R[t.names[i]] != null && R[t.names[i]] < R[YU]) { down = true; qx = i; break; } else if (t.names[i] !== YU && t.names[i] !== NK) break;
    if (!down) for (let i = q2 + 1; i < t.names.length; i++) if (R[t.names[i]] != null && R[t.names[i]] < R[YU]) { down = false; qx = i; break; } else if (t.names[i] !== YU && t.names[i] !== NK) break;
    if (down === undefined) return null;
    return { t, down, q2, qy: qy >= 0 && !t.ev[qy].thru ? qy : -1, qn, qx };
  };
  const set = (t, q, as, ds) => { const e = t.ev[q]; e.as = as; e.ds = ds; };
  const A = (t, q) => t.A[q + t.k0], P = (t, q) => t.P[q + t.k0];
  const all = list.map(info).filter(Boolean);
  // 信号場での停車は最大 10 分: 下りは湯川の発車を遅らせ、上りは早く出て湯川で待つ
  for (const x of all) { if (x.qn < 0 || x.qy < 0) continue; const t = x.t, e = t.ev[x.qn]; if (e.ds - e.as <= MAXW) continue;
    if (x.down) { e.as = e.ds - MAXW; set(t, x.qy, A(t, x.qy), e.as - RUN1); } else { e.ds = e.as + MAXW; set(t, x.qy, e.ds + RUN1, P(t, x.qy)); }
    ttSchedule(t); }
  // 各列車が 湯川〜信号場 にいる時間
  const tm = x => { const t = x.t;
    const yT = x.py != null ? x.py : x.qy >= 0 ? (x.down ? P(t, x.qy) : A(t, x.qy)) : (() => { const b = x.down ? A(t, x.q2) : P(t, x.q2), o = x.down ? P(t, x.qx) : A(t, x.qx); return b + (o - b) * (R[NRT2] - R[YU]) / (R[NRT2] - R[t.names[x.qx]]); })();
    const nT = x.qn >= 0 ? (x.down ? A(t, x.qn) : P(t, x.qn)) : x.pn != null ? x.pn : x.qy >= 0 ? (x.down ? yT + RUN1 : yT - RUN1) : (() => { const b = x.down ? A(t, x.q2) : P(t, x.q2), o = x.down ? P(t, x.qx) : A(t, x.qx); return b + (o - b) * (R[NRT2] - R[NK]) / (R[NRT2] - R[t.names[x.qx]]); })();
    return { yT, nT }; };
  let fixed = 0;
  // 成田湯川で2分以上止まる列車は、スカイライナーを先に通してから発車する: 発車の直後に通る計算のライナーは、発車の前に通す(単線なので途中では抜けない)
  const setPass = (t, nm, v) => { const l = t.pass || (t.pass = []), o = l.find(w => w.name === nm); if (o) { o.t = v; o.ref = true; } else l.push({ name: nm, t: v, ref: true }); };
  for (const l of all) { if (l.qy >= 0 || l.qn >= 0) continue; const yT = tm(l).yT;
    for (const o of all) { if (o.down !== l.down || o.qy < 0 || o.t.ev[o.qy].dep - o.t.ev[o.qy].arr < 2) continue; const D = P(o.t, o.qy);
      if (!(yT > D - 20 && yT < D + 150)) continue;
      const y = D - 35; setPass(l.t, YU, y); l.py = y; if (l.down) { l.pn = y + RUN1 * 0.8; setPass(l.t, NK, l.pn); } fixed++; break; } }
  for (let pass = 0; pass < 3; pass++) for (const d of all) { if (!d.down) continue; for (const u of all) { if (u.down) continue;
    const a = tm(d), b = tm(u); if (!(a.yT < b.yT + 10 && b.nT < a.nT + 10)) continue;   // 下り [湯川発, 信号場着] と 上り [信号場発, 湯川着] が重なる
    const ut = u.t, dt = d.t;
    // (1) 湯川で行き違う: 上りが早めに湯川へ着く
    if (u.qy >= 0 && d.qy >= 0) { const aY = a.yT - 20, dN = aY - RUN1, lo = u.qn >= 0 ? ut.ev[u.qn].as + 30 : P(ut, u.q2) + RUN2;
      if (dN >= lo && aY >= (u.qn >= 0 ? A(ut, u.qn) : P(ut, u.q2)) && aY <= P(ut, u.qy) - 10) { if (u.qn >= 0) ut.ev[u.qn].ds = dN; set(ut, u.qy, aY, P(ut, u.qy)); ttSchedule(ut); fixed++; continue; } }
    // (2) 信号場で行き違う: 下りが信号場に入るまで、上りは信号場にとどまる(通過列車なら、その時刻に通るよう速さを落とす)
    const need = a.nT + 15;
    if (u.qn >= 0) { const lim = u.qy >= 0 ? ut.ev[u.qy].dep * 60 + 50 : Infinity; if (need + RUN1 <= lim) { ut.ev[u.qn].ds = need; if (u.qy >= 0) set(ut, u.qy, Math.max(A(ut, u.qy), need + RUN1), Math.max(P(ut, u.qy), need + RUN1 + 20)); ttSchedule(ut); fixed++; } }
    else if (u.qy < 0 && need - (P(ut, u.q2) + RUN2) >= 40 && u.qx === u.q2 + 1) {   // 通過列車が信号場で40秒以上待つことになる: 走りながらではすれ違えないので、待避線に止まって待つ
      const as = P(ut, u.q2) + RUN2, i = u.q2; ut.ev.splice(i + 1, 0, { name: NK, arr: Math.floor(as / 60), dep: Math.floor(need / 60), as, ds: need, wait: true, meet: true });
      if (ut.tseg) ut.tseg = ut.tseg.map(([k, y]) => [k > i ? k + 1 : k, y]);
      if (ut.pass) ut.pass = ut.pass.filter(w => w.name !== NK); setPass(ut, YU, need + RUN1 * 0.8); u.qn = i + 1; u.qx++; ttSchedule(ut); fixed++; }
    else if (u.qy < 0) { u.pn = need; const l = ut.pass || (ut.pass = []); const o = l.find(w => w.name === NK); if (o) o.t = need; else l.push({ name: NK, t: need, ref: true });
      const oy = l.find(w => w.name === YU); if (oy) oy.t = need + RUN1 * 0.8; else l.push({ name: YU, t: need + RUN1 * 0.8, ref: true }); fixed++; }
  } }
  // 信号場で待つ列車が続くとき: 前の列車が出る直前に次が着く計算なら、次の列車は前が出てから入る(待避線は1本)
  const ws = all.filter(x => x.qn >= 0).sort((a, b) => a.t.ev[a.qn].as - b.t.ev[b.qn].as);
  for (let i = 1; i < ws.length; i++) { const p = ws[i - 1].t.ev[ws[i - 1].qn], x = ws[i], e = x.t.ev[x.qn];
    if (ws[i - 1].down !== x.down || !(e.as < p.ds + 10 && p.ds - e.as <= 90 && e.ds - (p.ds + 10) >= 30)) continue;   // 同じ向きどうしだけ(向かい合う列車は信号場で並んでから出る)
    e.as = p.ds + 10; if (x.down && x.qy >= 0) set(x.t, x.qy, A(x.t, x.qy), e.as - RUN1); ttSchedule(x.t); fixed++; }
  // 空港第2ビル〜成田空港も単線: 下りが成田空港に着く前に上りが出る計算になったら、上りの発車を下りの到着の後へずらす(次の駅まで1分以上残る場合だけ)
  const dn = list.filter(t => { const n = t.names.length; return n > 1 && t.names[n - 1] === NRT && t.names[n - 2] === NRT2; }), up = list.filter(t => t.names[0] === NRT && t.names[1] === NRT2);
  for (const u of up) { let need = 0; const p0 = u.P[u.k0], a1 = u.A[u.k0 + 1];
    for (const d of dn) { const n = d.names.length, da = d.A[n - 1 + d.k0], dp = d.P[n - 2 + d.k0]; if (p0 < da && dp < a1 && da - p0 <= 150) need = Math.max(need, da + 10); }
    if (need && a1 - need >= 60) { u.ev[0].as = u.A[u.k0]; u.ev[0].ds = need; ttSchedule(u); fixed++; } }
  // どちらの線で待つか: 待っている間に通過列車が通る列車は待避線。その列車と同時に待つもう1本は、まっすぐな線
  const thru = all.filter(x => x.qn < 0).map(x => tm(x).nT);
  for (const x of ws) { const e = x.t.ev[x.qn]; e.must = thru.some(v => v > e.as - 20 && v < e.ds + 20); }
  for (const x of ws) { const e = x.t.ev[x.qn]; if (e.must) { e.sid = true; continue; }
    e.sid = !ws.some(o => { const f = o.t.ev[o.qn]; return o !== x && f.as < e.ds && e.as < f.ds && (f.must || f.sid === true); }); }
  return fixed;
}
function ttThru(list) {
  // [駅, その列車が走る路線(OT_POS の番号)]。八広は中線が上下共用の待避線なので、通過列車は外側の線を通す
  for (const [TK, line] of [['京成高砂', t => ksVia(t) === 'access' ? 3 : 1], ['八広', () => 2], ['印旛日本医大', t => ksVia(t) === 'access' ? 3 : -1], ['小室', () => 2]]) {
    if (!stByName.has(TK)) continue;
    for (const t of list) {
      if (t.thruDone && t.thruDone[TK]) continue; (t.thruDone || (t.thruDone = {}))[TK] = true;
      const P = OT_POS[line(t)]; if (!P || !P.has(TK) || t.names.includes(TK)) continue;
      const p = P.get(TK);
      for (let i = 0; i + 1 < t.ev.length; i++) {
        const a = t.ev[i], b = t.ev[i + 1]; if (!P.has(a.name) || !P.has(b.name)) continue;
        const pa = P.get(a.name), pb = P.get(b.name); if ((p - pa) * (p - pb) >= 0) continue;
        if (TK === '八広' && (a.name === NRT || a.name === NRT2 || b.name === NRT || b.name === NRT2)) break;
        // スカイアクセス線経由は、図の長さではなくおおよその所要時間(分)の比で通過時刻を決める(図は北総線内が長く描かれている)
        const R = THRU_REF, f = R[TK] != null && R[a.name] != null && R[b.name] != null && ksVia(t) === 'access' ? (R[TK] - R[a.name]) / (R[b.name] - R[a.name]) : (p - pa) / (pb - pa);
        const d0 = t.P[i + t.k0], a1 = t.A[i + 1 + t.k0], x = d0 + (a1 - d0) * f;
        t.ev.splice(i + 1, 0, { name: TK, arr: Math.floor(x / 60), dep: Math.floor(x / 60), as: x, ds: x, wait: true, thru: true });
        if (t.tseg) t.tseg = t.tseg.map(([k, y]) => [k > i ? k + 1 : k, y]);
        ttSchedule(t); break;
      }
    }
  }
  // 成田湯川〜空港第2ビルは単線。この区間に時刻表で 7 分以上かけている列車(アクセス特急)は、根古屋信号場で止まって対向のスカイライナーを待っている
  const NK = '根古屋信号場', YU = '成田湯川';
  if (stByName.has(NK)) for (const t of list) {
    if (t.meetDone) continue; t.meetDone = true;
    for (let i = 0; i + 1 < t.ev.length; i++) { const a = t.ev[i].name, b = t.ev[i + 1].name, down = a === YU && b === NRT2;
      if (!down && !(a === NRT2 && b === YU)) continue;
      const d0 = t.P[i + t.k0], a1 = t.A[i + 1 + t.k0]; if (a1 - d0 < 7 * 60) break;
      const as = d0 + (down ? 150 : 135), ds = a1 - (down ? 135 : 150);   // 成田湯川〜空港第2ビルは止まらなければ約4分45秒(信号場はほぼ中間)
      t.ev.splice(i + 1, 0, { name: NK, arr: Math.floor(as / 60), dep: Math.floor(ds / 60), as, ds, wait: true, meet: true });
      if (t.tseg) t.tseg = t.tseg.map(([k, y]) => [k > i ? k + 1 : k, y]);
      ttSchedule(t); break; }
  }
  // スカイライナーどうしが単線区間でかち合うときは、先に信号場に着くほうが待避線で止まって行き違う
  if (stByName.has(NK) && !list.linerMeetDone) { list.linerMeetDone = true;
    const R = THRU_REF, ln = [];
    for (const t of list) { if (t.ev.some(e => e.name === NK || e.name === YU && !e.thru)) continue;
      for (let i = 0; i + 1 < t.ev.length; i++) { const a = t.ev[i].name, b = t.ev[i + 1].name;
        if (b === NRT2 && R[a] != null && R[a] < R[YU]) ln.push({ t, i, down: true, tB: t.A[i + 1 + t.k0], tX: t.P[i + t.k0], rX: R[a] });
        else if (a === NRT2 && R[b] != null && R[b] < R[YU]) ln.push({ t, i, down: false, tB: t.P[i + t.k0], tX: t.A[i + 1 + t.k0], rX: R[b] }); } }
    const at = (l, r) => l.tB + (l.tX - l.tB) * (R[NRT2] - r) / (R[NRT2] - l.rX);   // その地点を通る時刻
    for (const d of ln) { if (!d.down || d.done) continue;
      for (const u of ln) { if (u.down || u.done || d.done) continue;
        const dY = at(d, R[YU]), uY = at(u, R[YU]); if (!(dY < uY && u.tB < d.tB)) continue;   // 単線区間にいる時間が重なる
        const dN = at(d, R[NK]), uN = u.tB + 110; let w = null;
        if (uN <= d.tB - 110) w = { l: u, as: uN, ds: Math.max(uN + 30, d.tB - 110 + 20) };          // 上りが先に着く: 上りが待つ
        else if (uN + 15 <= d.tB - 135) w = { l: d, as: Math.min(dN, uN - 40), ds: d.tB - 135 };      // 下りが先に着いて待つ
        if (!w) continue;
        const t = w.l.t; t.ev.splice(w.l.i + 1, 0, { name: NK, arr: Math.floor(w.as / 60), dep: Math.floor(w.ds / 60), as: w.as, ds: w.ds, wait: true, meet: true });
        if (t.tseg) t.tseg = t.tseg.map(([k, y]) => [k > w.l.i ? k + 1 : k, y]);
        ttSchedule(t); w.l.done = true; for (const o of ln) if (o.t === t && o !== w.l && o.i > w.l.i) o.i++; } }
  }
  ttSingle(list);
}
// 高砂を通過する時刻は推定(時刻表に無い)なので、1〜2分ずれる。通る番線に別の列車が止まっている時間帯に当たったら、その列車が入る前(無理なら出た後)へずらす。
// 止まっている列車が長く停車していて、隣の番線へ移れる(待避)ならそのまま
// 印旛日本医大始発の上り列車は、スカイライナーが通過してから発車する: 発車の直後に通る計算になったライナーは、発車の前に通るよう通過時刻を早める
function ttInbaShift(list) {
  const IB = '印旛日本医大', L = OT_LINES[2], west = n => { const k = L.indexOf(n); return k >= 0 && k < L.indexOf(IB); };
  const deps = list.filter(t => t.names[0] === IB && west(t.names[1])).map(t => t.P[t.k0]); let n = 0;
  for (const t of list) { const q = t.names.indexOf(IB); if (q <= 0 || !t.ev[q].thru || t.ev[q].shifted || q + 1 >= t.names.length || !west(t.names[q + 1])) continue;
    const k = q + t.k0, x = t.A[k], lo = t.P[k - 1] + (x - t.P[k - 1]) * 0.6;
    const D = deps.filter(d => x > d - 45 && x < d + 300).sort((a, b) => a - b)[0]; if (D == null) continue;
    const y = Math.max(lo, D - 50); const e = t.ev[q]; e.as = e.ds = y; e.arr = e.dep = Math.floor(y / 60); e.shifted = true; ttSchedule(t); n++; }
  return n;
}
let TAKA_STOPS = [];
function ttThruShift(list) {
  const TK = '京成高砂'; if (!stByName.has(TK) || !stByName.has(NRT)) return 0;
  const stops = [], thrus = [];
  for (const t of list) { const q = t.names.indexOf(TK); if (q < 0) continue; const k = q + t.k0, pl = takaPref(t, q)[0];
    if (t.ev[q].thru) { if (!t.ev[q].shifted) thrus.push({ t, q, pl }); } else stops.push({ t, pl, a: t.A[k], d: t.P[k], dwell: t.ev[q].dep - t.ev[q].arr }); }
  const other = { 1: 2, 2: 1, 3: 4, 4: 3 }; let n = 0;
  TAKA_STOPS = stops;
  // 通過列車は空いているほうの線を通れるので、困るのは同じ向きの2線がどちらもふさがっているときだけ
  const at = (pl, x, self) => stops.filter(s => s.t !== self && s.pl === pl && x > s.a - 30 && x < s.d + 30);
  const blockers = (pl, x, self) => { const p = at(pl, x, self), o = at(other[pl], x, self); return p.length && o.length ? p.concat(o) : []; };
  for (const { t, q, pl } of thrus) {
    const k = q + t.k0, x = t.A[k], lo = t.P[k - 1] + (x - t.P[k - 1]) * 0.6, hi = t.A[k + 1] - (t.A[k + 1] - x) * 0.6;
    let bl = blockers(pl, x, t); if (!bl.length) continue;
    const cands = [];
    for (let step = 0, y = x; step < 4; step++) { const b = blockers(pl, y, t); if (!b.length) { cands.push(y); break; } y = Math.min(...b.map(s => s.a)) - 35; }
    for (let step = 0, y = x; step < 4; step++) { const b = blockers(pl, y, t); if (!b.length) { cands.push(y); break; } y = Math.max(...b.map(s => s.d)) + 35; }
    const ok = cands.filter(y => y >= lo && y <= hi && Math.abs(y - x) <= 200).sort((u, v) => Math.abs(u - x) - Math.abs(v - x))[0];
    if (ok == null) continue;
    const e = t.ev[q]; e.as = e.ds = ok; e.arr = e.dep = Math.floor(ok / 60); e.shifted = true; ttSchedule(t); n++;
  }
  return n;
}
const HK_NOLOOP = new Set('新柴又 北国分 秋山 松飛台 大町 西白井 白井 小室 千葉ニュータウン中央 印西牧の原 印旛日本医大'.split(' '));
function ttOvertakesLine(list, MAINL, MAINPOS, bOnly) {
  // 待避できる駅(方向別): その方向に使えるホームの線が2本以上、またはホームのない通過線が別にある
  const canWait = (name, dir) => {
    if (HK_NOLOOP.has(name)) return false;   // 北総線内で待避できるのは 矢切・東松戸・新鎌ヶ谷・成田湯川 だけ
    const s = stByName.get(name), ok = e => E[e].dir === 0 || E[e].dir === dir;
    const st = [...new Set(s.stops.map(([e]) => e))].filter(ok);
    if (!st.length) return false;
    return st.length >= 2 || s.pass.some(e => ok(e) && isNaN(stopX[e]));
  };
  const profs = [], POSNAME = new Map([...MAINPOS].map(([n, d]) => [Math.round(d * 10), n]));
  for (const t of list) {
    const pts = [];
    // 空港第2ビル・成田空港は京成本線とスカイアクセス線の両方にある: その列車が通らないほうの路線では数えない
    const lineVia = MAINPOS.has('京成成田') ? 'main' : MAINPOS.has('成田湯川') ? 'access' : null, off = lineVia && ksVia(t) !== lineVia;
    t.ev.forEach((e, i) => { if (MAINPOS.has(e.name) && !(off && (e.name === NRT || e.name === NRT2))) pts.push({ p: MAINPOS.get(e.name), a: t.A[i + t.k0], d: t.P[i + t.k0], i, name: e.name, dwell: e.dep - e.arr }); });
    if (pts.length < 2) continue;
    const dir = Math.sign(pts[pts.length - 1].p - pts[0].p);
    if (!dir || pts.some((q, k) => k > 0 && Math.sign(q.p - pts[k - 1].p) !== dir)) continue;
    profs.push({ t, pts, dir, acc: ksVia(t) === 'access', lo: Math.min(pts[0].p, pts[pts.length - 1].p), hi: Math.max(pts[0].p, pts[pts.length - 1].p), t0: pts[0].a, t1: pts[pts.length - 1].d });
  }
  const timeAt = (pr, p) => { let m = pr.taM; if (!m) m = pr.taM = new Map(); let v = m.get(p); if (v === undefined) m.set(p, v = timeAt0(pr, p)); return v; };   // 同じ列車・同じ位置は何度も聞かれるので覚えておく
  const timeAt0 = (pr, p) => {   // その位置の到着・発車時刻(通過なら同じ値を線形補間)
    if (p < pr.lo - 1e-6 || p > pr.hi + 1e-6) return null;
    const pts = pr.pts;
    for (let k = 0; k < pts.length; k++) {
      if (Math.abs(pts[k].p - p) < 1e-6) return { a: pts[k].a, d: pts[k].d, stop: true };
      if (k + 1 < pts.length && (p - pts[k].p) * (p - pts[k + 1].p) < 0) {
        // スカイアクセス線経由の列車は、所要時間の比で通過時刻を見積もる
        const R = THRU_REF, nm = POSNAME.get(Math.round(p * 10)), ra = R[pts[k].name], rb = R[pts[k + 1].name], useR = pr.acc && nm != null && R[nm] != null && ra != null && rb != null && (R[nm] - ra) * (R[nm] - rb) < 0;
        const f = useR ? (R[nm] - ra) / (rb - ra) : (p - pts[k].p) / (pts[k + 1].p - pts[k].p), x = pts[k].d + (pts[k + 1].a - pts[k].d) * f;
        return { a: x, d: x, stop: false };
      }
    }
    return null;
  };
  const stat = { waits: 0, at: {}, loops: 0, loopAt: {} };
  // 隣どうしの停車駅の間を、いちばん速い列車が走る時間。時刻表に発車時刻しか無い駅(着と発が同じ分)で、前の駅からの時間がこれより1分半以上長ければ、
  // 早く着いてその駅で待っているとみなせる(early = ふつうに走れば着ける時刻)
  const legMin = new Map();
  for (const pr of profs) for (let k = 0; k + 1 < pr.pts.length; k++) { const a = pr.pts[k], b = pr.pts[k + 1]; if (b.i !== a.i + 1) continue; const key = pr.dir + a.name + '>' + b.name, v = b.a - a.d; if (!(legMin.get(key) <= v)) legMin.set(key, v); }
  const early = (A, m) => { const w = A.pts[m], pv = A.pts[m - 1]; if (!pv || w.i !== pv.i + 1 || w.dwell !== 0 || A.t.ev[w.i].thru || A.t.ev[pv.i].thru) return w.a; const mn = legMin.get(A.dir + pv.name + '>' + w.name); return mn != null && w.a - pv.d >= mn + 90 ? pv.d + mn : w.a; };
  const legOv = new Map();    // 区間の途中で抜かれる(時刻表では通過の駅で待つ): "列車|k" → {A, k, ov:[B]}
  const stopOv = new Map();   // 停車駅で抜かれる: ev → {A, m, tb:[]}
  for (const A of profs) {
    const others = profs.filter(B => B !== A && B.dir === A.dir && B.t0 < A.t1 && A.t0 < B.t1 && (!bOnly || bOnly(B.t)));
    for (const B of others) {
      // Aの停車駅を順に見て、「Bがまだ後ろにいる最後の駅 k1」と「Bがもう先に行っている最初の駅 k2」を探す
      let k1 = -1;
      for (let k = 0; k < A.pts.length; k++) {
        const q = A.pts[k], x = timeAt(B, q.p);
        if (!x) { k1 = -1; continue; }
        if (x.d >= q.d) { k1 = k; continue; }
        // 抜く列車の道筋がこの駅から始まる(手前の様子が分からない)が、停車中に後から来て先に出ていく: この駅で抜かれる
        if (k1 < 0 && q.i > 0 && k + 1 < A.pts.length && x.a >= q.a && q.dwell >= 2 && canWait(q.name, A.dir)) { const e = A.t.ev[q.i]; if (!stopOv.has(e)) stopOv.set(e, { A, m: k, tb: [], bs: [] }); stopOv.get(e).tb.push(x.a); stopOv.get(e).bs.push(B); break; }
        if (!(x.a <= q.a - 20) || k1 < 0) continue;
        const k2 = k;
        const noMid = k2 === k1 + 1 && A.pts[k2].i === A.pts[k1].i + 1 && !MAINL.some(nm => { const p = MAINPOS.get(nm); return (p - A.pts[k1].p) * (p - A.pts[k2].p) < 0 && canWait(nm, A.dir); });
          // 長い無停車区間を走る列車(スカイライナー)は通過時刻の推定が数分ずれる: 近くに2分以上止まる待避駅があれば、そこで抜かれるとみなす
        let far = null;
          if (bOnly) for (let m = Math.max(0, k1 - 6); m < Math.min(A.pts.length - 1, k2 + 6); m++) {
            const w = A.pts[m]; if (w.dwell < 2 || !canWait(w.name, A.dir)) continue;
            const x = timeAt(B, w.p); if (!x) continue;
            const gap = Math.abs(x.a - (w.a + w.d) / 2);
            if (gap <= 360 && (!far || gap < far.gap)) far = { m, tb: x.a, gap };
          }
        if (far) far.gap = 0;
        if (!far && k2 === k1 + 1 && !noMid) {
          if (A.pts[k2].i === A.pts[k1].i + 1 && A.pts[k2].a - A.pts[k1].d >= 60) { const key = profs.indexOf(A) + '|' + k1; if (!legOv.has(key)) legOv.set(key, { A, k: k1, ov: [] }); legOv.get(key).ov.push(B); }
        } else {
          let best = far;
          // 時刻表で2分以上止まる駅は待避の可能性が高いので優先する(直前の停車駅 k1 も、長く止まっているなら候補に入れる)
          // 候補が複数あれば、抜く列車が通る時刻にいちばん無理なく止まっていられる駅にする(同じなら手前の駅)
          for (let m = A.pts[k1].dwell >= 2 ? k1 : k1 + 1; m < k2 && !far; m++) {
            const w = A.pts[m]; if (!canWait(w.name, A.dir)) continue;
            const xb = timeAt(B, w.p), tb = xb.a, ea = early(A, m), gap = (tb < ea ? ea - tb : xb.d > w.d ? xb.d - w.d : 0) - (w.dwell >= 2 || w.d - ea >= 120 ? 60 : 0);   // 抜く列車もこの駅に止まるなら、その発車まで止まっていられるか
            if (!best || gap < best.gap) best = { m, tb, gap };
          }
          // 追いつかれる先の駅に早く着いて待てるなら、そこも候補(神奈川新町を先に出て子安で抜かれる普通など)
          if (!far && k2 + 1 < A.pts.length) { const w = A.pts[k2], ea = early(A, k2), x2 = ea < w.a && canWait(w.name, A.dir) ? timeAt(B, w.p) : null;
            if (x2) { const gap = (x2.a < ea + 30 ? ea + 30 - x2.a : 0) - 60; if (!best || gap < best.gap) best = { m: k2, tb: x2.a, gap }; } }
          // 間に待避できる駅が無い → 実際にはもっと手前の待避駅で抜かれている(分単位の時刻のずれ)。そこで少し長く待たせる
          // 追いつかれる先の駅が待避駅で、着く直前に追いつかれる計算なら、その駅に先に着いてから抜かれる(新鎌ヶ谷・千住大橋でスカイライナーを待つ普通など)。
          // 少し早く着けば間に合う場合だけ(京成・北総)
          if (!best && k2 + 1 < A.pts.length) { const w = A.pts[k2], pv = A.pts[k2 - 1], x2 = timeAt(B, w.p), ss = stByName.get(w.name);
            if (x2 && !x2.stop && x2.a - 50 >= pv.d + (w.a - pv.d) * 0.5 && N[E[ss.stops[0][0]].a].y > KS_Y && canWait(w.name, A.dir)) best = { m: k2, tb: x2.a, gap: 0 }; }
          if (!best) for (let m = k1; m >= Math.max(0, k1 - 3); m--) {   // 始発駅なら、抜く列車が通ってから発車する
            const w = A.pts[m]; if (!canWait(w.name, A.dir) && !(m === 0 && w.i === 0 && HK_NOLOOP.has(w.name))) continue;   // 始発駅では、待避線が無くても発車を待てる
            const x = timeAt(B, w.p); if (x && x.a <= w.d + 240) best = { m, tb: x.a, gap: 0 };
            break;
          }
          if (best) { const e = A.t.ev[A.pts[best.m].i]; if (!stopOv.has(e)) stopOv.set(e, { A, m: best.m, tb: [], bs: [] }); stopOv.get(e).tb.push(best.tb); stopOv.get(e).bs.push(B); }
        }
        break;
      }
    }
  }
  // 停車駅で抜かれる: 待避線側に入り、抜く列車が通る間は止まっているように到着を早め・発車を遅らせる
  for (const [e, o] of stopOv) {
    const A = o.A, w = A.pts[o.m], pv = A.pts[o.m - 1], nx = A.pts[o.m + 1];
    const lo = pv ? Math.min(pv.d + (w.a - pv.d) * 0.5, early(A, o.m)) : w.a, hi = w.d + (nx.a - w.d) * 0.5;
    // 抜く列車がこの駅を通る時刻: 停車駅の間を一定の速さで走るとした推定(tb)を、待避する列車が止まっていられる時間帯に合わせて直す。
    // 直した時刻は抜く列車の「通過時刻」として持たせる(速さは区間平均の1.5倍まで)
    const tps = o.tb.map((tb, n) => {
      const B = o.bs[n], pts = B.pts; let k = -1;
      for (let q = 0; q + 1 < pts.length; q++) if ((w.p - pts[q].p) * (w.p - pts[q + 1].p) < 0) { k = q; break; }
      if (k < 0) return tb;   // 抜く列車もこの駅に停車する
      const v = Math.abs(pts[k + 1].p - pts[k].p) / (pts[k + 1].a - pts[k].d);
      // スカイアクセス線経由の列車は tb が所要時間の目安から出ているので、そこから大きく動かさない(図の長さで速さを測ると、長く描かれた区間でずれる)
      const rr = B.acc && THRU_REF[e.name] != null && THRU_REF[pts[k].name] != null && THRU_REF[pts[k + 1].name] != null;
      const a0 = rr ? Math.max(tb - 90, lo + 40) : Math.max(pts[k].d + Math.abs(w.p - pts[k].p) / (1.5 * v), lo + 40), a1 = rr ? Math.min(tb + 90, hi - 30) : Math.min(pts[k + 1].a - Math.abs(pts[k + 1].p - w.p) / (1.5 * v), hi - 30);
      if (a0 > a1) return tb;
      const tp = Math.max(a0, Math.min(a1, tb));
      if (Math.abs(tp - tb) > 3) { const l = B.t.pass || (B.t.pass = []); if (!l.some(x => x.name === e.name)) { l.push({ name: e.name, t: tp, ref: rr }); stat.passFix = (stat.passFix || 0) + 1; } }
      return tp;
    });
    const as = Math.max(lo, Math.min(w.a, Math.min(...tps) - 50)), ds = Math.min(hi, Math.max(w.d, Math.max(...tps) + 30));
    e.ot = true; e.as = as; e.ds = ds; e.otBy = o.bs.map(B => B.t);
    stat.loops++; stat.loopAt[e.name] = (stat.loopAt[e.name] || 0) + 1;
  }
  // 区間の途中で抜かれる: 途中の待避できる駅に「通過待ち」を挿入
  const inserts = [];
  for (const { A, k, ov } of legOv.values()) {
    const q = A.pts[k], r = A.pts[k + 1], span = r.a - q.d;
    const cands = MAINL.filter(nm => { const p = MAINPOS.get(nm); return (p - q.p) * (p - r.p) < 0 && canWait(nm, A.dir); });
    let best = null;
    for (const nm of cands) {
      const p = MAINPOS.get(nm), fr = (p - q.p) / (r.p - q.p);
      const eA = q.d + fr * span * 0.5, lD = r.a - (1 - fr) * span * 0.5;
      const tb = ov.map(B => timeAt(B, p).a).filter(x => x - 20 >= eA && x + 20 <= lD);
      if (tb.length < ov.length) continue;
      const cross = Math.abs((q.d + fr * span) - tb[0]);   // 素直に走った場合にちょうど追いつかれる駅に近いほど良い
      if (!best || cross < best.cross) best = { nm, cross, as: Math.max(eA, Math.min(...tb) - 60), ds: Math.min(lD, Math.max(...tb) + 40) };
    }
    if (!best) continue;
    inserts.push({ t: A.t, after: q.i, ev: { name: best.nm, arr: Math.floor(best.as / 60), dep: Math.floor(best.ds / 60), as: best.as, ds: best.ds, wait: true } });
    stat.waits++; stat.at[best.nm] = (stat.at[best.nm] || 0) + 1;
  }
  inserts.sort((a, b) => b.after - a.after).forEach(x => x.t.ev.splice(x.after + 1, 0, x.ev));
  for (const t of list) if (t.ev.some(e => e.ot || e.wait)) ttSchedule(t);
  return stat;
}
// ===== 金沢文庫の増結 =====
// 平日朝の上り特急・快特は、金沢文庫で4両を足して12両になる(時刻表では2分以上の停車)。
//  品川行き   → 3番線(内線)。後ろ=金沢八景寄りに連結
//  泉岳寺行き → 4番線(外線)。前=上大岡寄りに連結。品川で前4両を切り離す
const COUPLE_ST = '金沢文庫', COUPLE_LEN = 6, COUPLE_FROM = 6 * 60, COUPLE_TO = 9 * 60;
function ttCouple(list, day) {
  if (day !== 'wd') return 0;
  let n = 0;
  for (const t of list) {
    const i = t.names.indexOf(COUPLE_ST), m = t.names.length;
    if (i <= 0 || i >= m - 1 || (t.type !== 'tokkyu' && t.type !== 'kaitoku') || t.cars !== 8) continue;
    const e = t.ev[i];
    if (e.dep - e.arr < 2 || e.arr < COUPLE_FROM || e.arr >= COUPLE_TO || t.names.indexOf('上大岡') < i) continue;
    const side = t.names[m - 1] === '品川' ? 'rear' : t.names.indexOf('泉岳寺') > i ? 'front' : null;   // 品川止まり / 品川から先(泉岳寺・浅草線方面)へ行く列車
    if (!side) continue;
    t.cpl = { i, side, e: null, t0: null, t1: Infinity };
    n++;
  }
  return n;
}
// 両数による見た目の長さ(前後への延長)。12両の下りは金沢文庫で後ろ4両を切り離すとみなす
function ttShape(t, T) {
  let b = 0, f = 0;
  if (t.cpl && t.cpl.t0 != null) { if (T >= t.cpl.t0 && T < t.cpl.t1) { if (t.cpl.side === 'rear') b = COUPLE_LEN; else f = COUPLE_LEN; } }
  else if (t.cars === 12) {
    if (t.c12 === undefined) { const i = t.names.indexOf(COUPLE_ST); t.c12 = i > 0 && i < t.names.length - 1 ? t.P[i + t.k0] : Infinity; }
    if (T < t.c12) b = COUPLE_LEN;
  }
  t.extB = b; t.extF = f;
}
// 折り返しの自動判定: 終着した列車を、同じ駅から次に出る列車につなぐ
const DAISHI = new Set(['港町', '鈴木町', '川崎大師', '東門前', '大師橋', '小島新田']);
// ttLink(list): 折り返し・回送を一気に計算する(node の検査用)。ブラウザは ttLinkG を少しずつ進める
// ===== 運用の編集(画面の「運用の編集」で直したもの。build/ops_user.json とブラウザの保存を合わせた USER_OPS) =====
//  link: 終着の列車 a を、同じ駅の始発 d につなぐ   cut: a のあとのつながりを切る(ほかの列車にもつながない)
//  dh: 回送を足す(発駅・発時刻・着駅・着時刻・両数・前の列車・次の列車)   del: 自動で作った回送を消す
//  計画でつなげなかったもの(引上線が空いていないなど)は list.userMsg に書き、画面に出す
const ttHM = s => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(s == null ? '' : s).trim()); if (!m) return null; let h = +m[1]; if (h < 4) h += 24; return h * 60 + +m[2]; };
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
function ttLink(list) { const g = ttLinkG(list); for (;;) { const r = g.next(); if (r.done) return r.value; } }
function* ttLinkG(list) {
  ttOps(list);
  // 浅草線へ直通する車両(運行番号の末尾が K・T・N・H)は8両。京成・北総線内だけを走る列車は両数が時刻表に無く仮に6両としていたので、この運行番号なら8両にそろえる
  for (const t of list) { if (t.cars !== 6 || !/\d(K|T|N|H)$/.test(ttRunOf(t).num)) continue; const st = stByName.get(t.ev[0].name); if (st && st.stops.length && N[E[st.stops[0][0]].a].y > 890) t.cars = 8; }
  const arr = new Map(), dep = new Map();
  const add = (m, k, t) => { if (!m.has(k)) m.set(k, []); m.get(k).push(t); };
  for (const t of list) {
    if (!t.exitEnd) add(arr, t.names[t.names.length - 1], t);
    if (!t.exitStart) add(dep, t.names[0], t);
  }
  const tArr = a => a.ev[a.ev.length - 1].arr, tDep = d => d.ev[0].dep;
  // 金沢文庫で増結した列車は12両で終着する。ただし前に付けた4両は品川で切り離すので、品川より先まで行く列車は元の両数で終着する
  const carsOf = a => { if (!a.cpl) return a.cars; const q = a.names.indexOf(SHINA); return a.cpl.side === 'front' && q > a.cpl.i && q < a.names.length - 1 ? a.cars : 12; };
  const pairs = [];
  const unpair = a => { a.next.prev = null; a.next = null; };
  // 行き止まりの終着駅: 着いた列車は次に出る列車になる(両数は問わない)。到着順に空いている番線へ。
  // 番線が足りないときは、先に待っていた列車を「回送で出ていった」とみなして番線を空ける
  // 折り返しの相手選び: 発車する列車ごとに「折り返しに必要な時間を満たす、いちばん後に着いた列車」をつなぐ。
  // 着いた順につなぐと、1本で回せるところに2本が長く居座ってしまう。余った列車は回送で出入りしたとみなす
  const TURN_MIN = 3;
  // 実際の運用表がある列車は、そのとおりにつなぐ(両数・運行番号・時間の決まりより優先)。表で「ここで終わり」となっている列車は、ほかの列車につながない
  const opsOK = (a, d) => a.swapOut !== d && ((!(a.ops && a.ops.auth) && !(d.ops && d.ops.auth)) || a.opsBrk === d);   // 車両を取り替える駅では、前半分と後ろ半分をつながない
  for (const a of list) { const d = a.opsNext; if (!d || d.prev || a.next || a.exitEnd || d.exitStart) continue; const w = tDep(d) - tArr(a); if (w < 0) continue;
    if (!(a.ops.auth && d.ops && d.ops.auth) && carsOf(a) !== d.cars) { const ss = stByName.get(d.names[0]); if (ss && ss.stops.length && N[E[ss.stops[0][0]].a].y < 890) continue; }   // 運用表が列車の一部にしか当たらず、京急線内で両数も違う組は、同じ車両とは言い切れないのでつながない
    if (w <= (DEPOT_ST.has(d.names[0]) ? DEPOT_MAX : OPS_MAX)) { a.next = d; d.prev = a; a.opsF = true; } else a.opsBrk = d; }
  // ユーザー指定の折り返し(運用表に無い列車): 平日 6AE10(印旛日本医大7:00→上野7:46)は上野で8AE11(8:00発)として折り返す
  for (const [x, y] of LINK_FIX[list.day] || []) { const d = list.find(t => t.no === y && !t.prev), a = d && list.find(t => t.no === x && !t.next && t.names[t.names.length - 1] === d.names[0] && tArr(t) <= tDep(d)); if (a) { a.next = d; d.prev = a; a.opsF = true; } }
  const pairUp = (as, ds, minT, maxT, ok, runMax) => {
    // runMax を渡した駅では、まず同じ運行番号の列車どうしをつなぐ(同じ車両がそのまま折り返す)。残りは時刻の近さでつなぐ
    if (runMax) for (const d of ds) {
      const kd = ttRunOf(d).key; if (d.prev || !kd) continue;
      const td = tDep(d); let best = null;
      for (const a of as) if (!a.next && a !== d && ttRunOf(a).key === kd && tArr(a) + 1 <= td && td <= tArr(a) + runMax && ok(a, d) && (!best || tArr(a) > tArr(best))) best = a;
      if (best) { best.next = d; d.prev = best; best.runLink = true; }
    }
    for (const d of ds) {
      if (d.prev) continue;
      const td = tDep(d);
      let best = null;
      for (const lo of minT > 1 ? [minT, 1] : [minT]) {
        for (const a of as) if (!a.next && a !== d && tArr(a) + lo <= td && td <= tArr(a) + maxT && ok(a, d) && (!best || tArr(a) > tArr(best))) best = a;
        if (best) break;
      }
      if (best) { best.next = d; d.prev = best; }
    }
  };
  // 折り返しの相手として認める組み合わせ:
  //  ・ライナー(スカイライナーなど)はライナーにだけ折り返す。相手がいなければ回送
  //  ・成田空港では、成田スカイアクセス線から来た列車はスカイアクセス線へ、京成本線から来た列車は本線へ戻る
  const via = ksVia;
  const pairOK = (st, a, d) => opsOK(a, d) && (a.type === 'liner') === (d.type === 'liner') && (st !== '成田空港' || via(a) === via(d));
  const terminus = (as, ds, edges, st, prefOf, gap) => {   // gap: 前の列車が出てから次が入るまでの最小の分
    // 行き止まりの終着駅でも、同じ運行番号どうしを先につなぐ。
    // 京急の終着駅では、両数の違う列車はつながない(浦賀の車両交換: 着いた車両は回送で出ていき、別の車両が回送で入ってくる)。
    // 京成・北総側は時刻表に両数が無く仮の値なので、両数では判断しない
    const realCars = (() => { const ss = stByName.get(st); return ss && ss.stops.length && N[E[ss.stops[0][0]].a].y < 890; })();
    pairUp(as, ds, TURN_MIN, 30, (a, d) => pairOK(st, a, d) && (!realCars || carsOf(a) === d.cars), 30);
    if (realCars) for (const a of as) if (!a.next) { const k = ttRunOf(a).key, d = k && ds.find(d => ttRunOf(d).key === k && tDep(d) >= tArr(a) && tDep(d) <= tArr(a) + 30 && carsOf(a) !== d.cars); if (d) { a.swapOut = d; d.swapIn = a; } }
    const plats = [...new Set(edges)].map(e => ({ e, a: null, free: -1 }));
    for (const a of as) {
      const ta = tArr(a);
      let p = plats.filter(p => p.free + (gap || 0) <= ta).sort((x, y) => x.free - y.free)[0];
      if (p && prefOf) { const fr = plats.filter(p => p.free + (gap || 0) <= ta), want = prefOf(a).map(e => fr.find(p => p.e === e)).filter(Boolean)[0]; if (want) p = want; }
      if (!p) {
        p = plats.reduce((m, q) => q.free < m.free ? q : m);
        if (p.a && p.a.next && !p.a.opsF) unpair(p.a);
      }
      a.forceEnd = p.e; p.a = a;
      p.free = a.next ? tDep(a.next) : ta + 1;
    }
  };
  // 途中駅: 同じ両数どうしを到着の早い順に。番線・引上線の数より多く居座る場合は、いちばん長く待つ組を外す
  const general = (st, as, ds) => {
    const minTurn = noRev(st) ? SHINA_TURN : 0;
    const cap = new Set(stByName.get(st).stops.map(([e]) => e)).size + (SIDINGS.get(st) || []).length, kept = [];
    // まず「着いてすぐ(3分以内)に出る」組をつなぐ: 列車番号が変わるだけで同じ列車が走り続ける場合(京急蒲田での折り返しなど)
    for (const a of minTurn ? [] : as) {
      if (a.next) continue;
      const ta = tArr(a);
      const from = a.names[a.names.length - 2];   // 来た方向へそのまま戻るものは「走り続ける」とはみなさない
      const cs = ds.filter(d => !d.prev && d !== a && tDep(d) >= ta && tDep(d) <= ta + 3 && carsOf(a) === d.cars && d.names[1] !== from && opsOK(a, d)), ka = ttRunOf(a).key;
      const d = (ka && cs.find(d => ttRunOf(d).key === ka)) || cs[0];
      if (d) { a.next = d; d.prev = a; kept.push(a); }
    }
    pairUp(as, ds, minTurn || TURN_MIN, TURN_MAX, (a, d) => (carsOf(a) === d.cars || (st === SHINA && d.cars === 12 && carsOf(a) === 8 && ttRunOf(a).key && ttRunOf(a).key === ttRunOf(d).key)) && pairOK(st, a, d), DEPOT_ST.has(st) ? DEPOT_MAX : RUN_MAX);
    if (st === SHINA) for (const d of ds) if (d.prev && d.cars === 12 && carsOf(d.prev) === 8) d.added4 = true;   // 同じ運行番号で8両→12両: 品川で4両を足す
    for (const a of as) {
      if (!a.next || kept.includes(a)) continue;
      const ta = tArr(a);
      kept.push(a);
      for (;;) {
        const here = kept.filter(p => p.next && tArr(p) <= ta && tDep(p.next) > ta);
        if (here.length <= cap) break;
        const hs = here.filter(p => !p.opsF); if (!hs.length) break;   // 運用表どおりの組は外さない
        unpair(hs.reduce((m, p) => tDep(p.next) > tDep(m.next) ? p : m));
      }
    }
    // 品川: 8両で着いた列車に4両を足して、12両の列車として折り返す(夕方の12両快特)
    if (st === SHINA) for (const d of ds) {
      if (d.prev || d.cars !== 12) continue;
      const c8 = as.filter(a => !a.next && carsOf(a) === 8 && tDep(d) >= tArr(a) + minTurn && tDep(d) <= tArr(a) + TURN_MAX && opsOK(a, d)), kd = ttRunOf(d).key;
      const a = (kd && c8.find(a => ttRunOf(a).key === kd)) || c8[0];
      if (a) { a.next = d; d.prev = a; d.added4 = true; }
    }
  };
  for (const [st, as0] of arr) {
    const as = as0.slice().sort((a, b) => tArr(a) - tArr(b));
    const ds = (dep.get(st) || []).slice().sort((a, b) => tDep(a) - tDep(b));
    if (st === NRT && nrtEdges()) {   // 成田空港: スカイライナー・アクセス特急・本線の列車で使うホームが分かれている
      for (const c of ['liner', 'access', 'main']) terminus(as.filter(t => nrtCat(t) === c), ds.filter(t => nrtCat(t) === c), nrtEdges()[c], st);
      // 2・3番線(本線)と 4・5番線(スカイライナー)は同じ線路の手前と奥: 手前に本線の列車がいる間は、奥のライナーは出入りできない。それを避けて線路を選び直す
      nrtAssign(as);
    } else if (DEPOT_ST.has(st)) general(st, as, ds);   // 車庫のある終着駅: 長く止まる車両は車庫の線へ入れる
    else if (st === '京成上野') {   // 1・4番線(外側)=普通、2番線=スカイライナー、3番線=特急・快速特急。ふさがっていれば他の番線
      const es = [...new Set(stByName.get(st).stops.map(([e]) => e))].sort((a, b) => N[E[a].a].y - N[E[b].a].y);
      const ty = a => { const y = a.tseg ? a.tseg[a.tseg.length - 1][1] : a.type; return y; };
      terminus(as, ds, es, st, es.length === 4 ? a => { const y = ty(a); return y === 'liner' ? [es[1], es[2]] : y === 'local' ? [es[0], es[3]] : [es[2], es[1], es[3], es[0]]; } : null, 1);
    } else if (TERMINI.has(st)) terminus(as, ds, stByName.get(st).stops.map(([e]) => e), st);
    else if (st === '京急川崎') {   // 大師線ホーム(地平)は行き止まり、本線は途中駅として扱う
      const isD = t => t.names.some(n => DAISHI.has(n));
      terminus(as.filter(isD), ds.filter(isD), stByName.get(st).stops.map(([e]) => e).filter(e => N[E[e].a].y < 180), st);
      general(st, as.filter(t => !isD(t)), ds.filter(t => !isD(t)));
    } else general(st, as, ds);
  }
  function nrtAssign(as) {
    {
      const g = nrtEdges(), yOf = e => N[E[e].a].y, trk = [0, 1].map(k => ({ main: g.main.slice().sort((a, b) => yOf(a) - yOf(b))[k], liner: g.liner.slice().sort((a, b) => yOf(a) - yOf(b))[k], m: [], l: [] }));
      const hit = (l, a, b) => l.some(([x, y]) => x < b && a < y);
      for (const a of as) {
        const c = nrtCat(a); if (c === 'access') continue;
        const ta = tArr(a), td = a.next ? tDep(a.next) : ta + 1; let best = null;
        for (const k of trk) {
          let bad = 0;
          // 同じ分に「着く列車」と「出る列車」があるときは、単線(空港第2ビル〜成田空港)なので着くほうが先に入る。だから同じ分も重なりとして数える
          if (c === 'liner') bad = (hit(k.l, ta - 0.5, td + 1) ? 4 : 0) + (hit(k.m, ta - 1, ta + 1) ? 2 : 0) + (hit(k.m, td - 1, td + 1) ? 2 : 0);
          else bad = (hit(k.m, ta - 0.5, td + 1) ? 4 : 0) + k.l.filter(([x, y]) => (y >= ta && y < td + 1) || (x >= ta && x < td + 1)).length * 2;
          if (!best || bad < best.bad) best = { k, bad };
        }
        (c === 'liner' ? best.k.l : best.k.m).push([ta, td]); a.forceEnd = c === 'liner' ? best.k.liner : best.k.main;
      }
    }
  }
  // ===== 成田空港の回送(送り込み・引き上げ) =====
  // 成田空港には車庫が無い。前の運用の無い始発列車は宗吾参道(宗吾車両基地)から回送で入り、次の運用の無い終着列車は宗吾参道へ回送で出ていく。
  // 回送の時刻は時刻表に無いので推定。ホームの使い方(成田空港にいる1回分 = v)を全部並べて、ぶつからない時刻と線を選ぶ:
  //  ・島式ホームの2本の線は、上野寄り(本線 M)と車止め側(スカイライナー L)の縦列。L へ出入りする瞬間は、同じ線の M が空いていること
  //  ・空港第2ビル〜成田空港は単線。向かい合う列車と同時に入らない
  if (!list.dhDone && stByName.has(DH_ST) && stByName.has(NRT) && nrtEdges()) { list.dhDone = true;
    const g = nrtEdges(), yOf = e => N[E[e].a].y, srt = l => l.slice().sort((x, y) => yOf(x) - yOf(y)), EM = srt(g.main), EL = srt(g.liner);
    const S = { d: [], u: [] };   // 単線にいる時間(秒)。d = 成田空港へ向かう、u = 成田空港から出る
    for (const t of list) { const q1 = t.names.indexOf(NRT), q2 = t.names.indexOf(NRT2); if (q1 < 0 || q2 < 0 || Math.abs(q1 - q2) !== 1) continue;
      if (q2 < q1) S.d.push([t.P[q2 + t.k0], t.A[q1 + t.k0], t.A[q2 + t.k0]]); else S.u.push([t.P[q1 + t.k0], t.A[q2 + t.k0], t.P[q2 + t.k0]]); }   // 3つ目 = 空港第2ビルに着く時刻(下り)・出る時刻(上り)
    const aSec = t => t.A[t.A.length - 1], dSec = t => t.P[t.k0];
    // 宗吾参道〜京成成田〜空港第2ビル を同じ向きに走る列車。回送は、これらを途中で追い抜いたり、止まっている横を通り抜けたりしない時刻にする
    const PTS = [DH_ST, '京成成田', NRT2, NRT], prof = { d: [], u: [] };
    for (const t of list) { const pts = []; t.names.forEach((nm, i) => { const q = PTS.indexOf(nm); if (q >= 0) pts.push([q, t.A[i + t.k0], t.P[i + t.k0]]); }); if (pts.length < 2) continue; (pts[1][0] > pts[0][0] ? prof.d : prof.u).push(pts); }
    const ordPen = (l, my) => { for (const pts of l) { let ps = 0; for (const [q, A, P] of pts) { const m = my[q]; if (m == null) continue; if ((q === 1 || q === 2) && m > A - 30 && m < P + 40) return 6; const sg = Math.sign(m - (q === 3 ? (l === prof.u ? P : A) : (A + P) / 2)); if (ps && sg !== ps) return 6; ps = sg; } } return 0; };
    // 京成本線(上野〜成田空港)を同じ向きに走る列車との前後関係。回送は、途中で通常列車を追い抜く・追い抜かれることになる時刻を選ばない(通常列車を優先)
    const P1 = OT_POS[1], L1p = P1 ? OT_LINES[1].filter(n => P1.has(n)).map(n => P1.get(n)) : [], prof1 = [];
    const addProf = t => { if (!P1) return; const off = ksVia(t) !== 'main', pts = []; t.ev.forEach((e, i) => { if (P1.has(e.name) && !(off && (e.name === NRT || e.name === NRT2))) pts.push([P1.get(e.name), t.A[i + t.k0], t.P[i + t.k0]]); });
      if (pts.length < 2) return; const dir = Math.sign(pts[pts.length - 1][0] - pts[0][0]); if (!dir || pts.some((q, k) => k && Math.sign(q[0] - pts[k - 1][0]) !== dir)) return;
      prof1.push({ t, pts, dir, lo: Math.min(pts[0][0], pts[pts.length - 1][0]), hi: Math.max(pts[0][0], pts[pts.length - 1][0]), t0: pts[0][1], t1: pts[pts.length - 1][2] }); };
    for (const t of list) addProf(t);
    const at1 = (o, q) => { const c = o.c || (o.c = new Map()); let r = c.get(q); if (r === undefined) { r = at1x(o, q); c.set(q, r); } return r; };   // 同じ問い合わせが何万回も来るので覚えておく
    const at1x = (o, q) => { const pts = o.pts; for (let k = 0; k < pts.length; k++) { if (Math.abs(pts[k][0] - q) < 1e-6) return [pts[k][1], pts[k][2]]; if (k + 1 < pts.length && (q - pts[k][0]) * (q - pts[k + 1][0]) < 0) { const x = pts[k][2] + (pts[k + 1][1] - pts[k][2]) * (q - pts[k][0]) / (pts[k + 1][0] - pts[k][0]); return [x, x]; } } return null; };
    // X を dep(秒)に出て Y に arr(秒)に着く回送が、同じ向きの列車と前後を入れ替えずに走れるか(0 = 走れる)
    const olMemo = new Map(); let olN = -1;
    const ordLine = (X, Y, dep, arr) => { if (!P1 || !P1.has(X) || !P1.has(Y)) return 0; if (olN !== prof1.length) { olMemo.clear(); olN = prof1.length; } const key = X + '|' + Y + '|' + dep + '|' + arr; let r = olMemo.get(key); if (r === undefined) { r = ordLineX(X, Y, dep, arr); olMemo.set(key, r); } return r; };
    const ordLineX = (X, Y, dep, arr) => { const pX = P1.get(X), pY = P1.get(Y), dir = Math.sign(pY - pX), lo = Math.min(pX, pY), hi = Math.max(pX, pY);
      const smp = L1p.filter(q => q >= lo - 1e-6 && q <= hi + 1e-6);
      for (const o of prof1) { if (o.dir !== dir || o.t1 < dep - 300 || o.t0 > arr + 300 || o.hi <= lo || o.lo >= hi) continue; let s0 = 0, bad = false, cnt = 0;
        for (const q of smp) { const x = at1(o, q); if (!x) continue; cnt++; const my = dep + (arr - dep) * (q - pX) / (pY - pX), a = Math.abs(q - pX) < 1e-6 ? x[1] : x[0], b = Math.abs(q - pY) < 1e-6 ? x[0] : x[1];
          const sg = my < a - 40 ? -1 : my > b + 40 ? 1 : 0; if (!sg || (s0 && sg !== s0)) bad = true; s0 = sg || s0; }
        if (bad && cnt >= 2) return 6; }
      return 0; };
    const NA = '京成成田', RUN_NA = 8, RUN_SG = 5;   // 回送の走る分: 成田空港〜京成成田、京成成田〜宗吾参道
    // 京成成田の中線(待避・折り返しに使う上下共用の線)がふさがっている時間(秒): 東成田・芝山千代田へ出入りする列車、待避する列車、成田で始発・終着になる列車、ほかの回送
    const MIDG = +(typeof process !== 'undefined' && process.env.DH_MG || 110), MIDP = +(typeof process !== 'undefined' && process.env.DH_MP || 100);
    const midBusy = [], midFree = (a, b, self) => !midBusy.some(([x, y, o]) => o !== self && x < b + MIDG && a - MIDP < y);   // 前の列車が出てから100秒はあける(動き出しが遅い)
    for (const t of list) { const q = t.names.indexOf(NA); if (q < 0) continue; const n = t.names.length, hig = t.names.includes('東成田') || t.names.includes('芝山千代田');
      if (!(q === 0 || q === n - 1 || t.ev[q].ot || t.ev[q].wait || t.ev[q].dep - t.ev[q].arr >= 3)) continue;
      midBusy.push([q === 0 && !t.prev ? t.P[t.k0] - 300 : t.A[q + t.k0], q === n - 1 ? (t.next ? t.next.P[t.next.k0] : t.A[q + t.k0] + 360) : t.P[q + t.k0], t, q === 0 && !t.prev ? 1 : q === n - 1 && !t.next ? 2 : 0]); }   // 4つ目 = 送り込み(1)・引き上げ(2)が決まる前の仮の予約(発車前5分・到着後6分)   // 前後の運用が無い始発・終着は、回送の出入りで5〜6分ホームにいるものとする
    // 京成成田で待つ分(0 = 止まらずに通る): 通常列車と前後が入れ替わらず、中線が空いている最初の分。stay(x) = [着, 発](秒)
    // 京成成田の本線(下り=5番線、上り=1番線)に列車がいる時間。どの線に入るかは番線の決まり(ttAllowNa)の「基本」で見積もる
    const mainBusy = { 1: [], '-1': [] }, mainFree = (dir, x) => !mainBusy[dir].some(([a, b]) => a - 60 < x && x < b + 90);
    const thIn = [], thOut = [], termBusy = [], termFree = x => !termBusy.some(([a, b]) => a - 60 < x && x < b + 90);
    const thInOK = x => !thOut.some(([a, b]) => a < x + 5 && x - 150 < b), thOutOK = x => !thIn.some(([a, b]) => a < x + 150 && x - 5 < b);
    const addIn = x => thIn.push([x - 150, x + 5]), addOut = x => thOut.push([x - 5, x + 150]);   // 入る列車は着く150秒前から、出る列車は発車後150秒までポイントにかかる(8両の列車はゆっくり出入りする)   // 回送が西から入る時刻 x・西へ出る時刻 x に、交差する動きが無い
    if (P1) for (const t of list) { const q = t.names.indexOf(NA), n = t.names.length; if (q < 0 || n < 2) continue;
      const w0 = nm => P1.has(nm) && P1.get(nm) < P1.get(NA); ttAllowNa(t); if (!NA_E) break;
      let e = t.na ? t.na.pref : null;
      if (e == null) { if (q === n - 1) e = t.type === 'liner' && w0(t.names[q - 1]) ? NA_E[0] : NA_E[1]; else if (q === 0) e = w0(t.names[1]) ? NA_E[1] : NA_E[0]; else e = w0(t.names[q - 1]) ? NA_E[0] : NA_E[2]; }
      // 宗吾参道側のポイント: 西から来て中線・1番線へ入る動き(thIn)と、西へ出ていく動き(thOut)は、同時だと交差する
      if (q > 0 && w0(t.names[q - 1]) && e !== NA_E[0] && !t.ev[q].thru) addIn(t.A[q + t.k0]);
      if (q < n - 1 && w0(t.names[q + 1])) addOut(t.P[q + t.k0]);
      if (q === 0 || q === n - 1) termBusy.push(q === 0 ? [t.prev ? t.A[t.k0] : t.P[t.k0] - 300, t.P[t.k0]] : [t.A[q + t.k0], t.next ? t.next.P[t.next.k0] : t.A[q + t.k0] + 360]);
      const dir = e === NA_E[0] ? 1 : e === NA_E[2] ? -1 : 0; if (!dir) continue;   // 中線にいる列車は midBusy で数える
      mainBusy[dir].push((q === 0 ? [t.prev ? t.A[t.k0] : t.P[t.k0] - 300, t.P[t.k0]] : q === n - 1 ? [t.A[q + t.k0], t.next ? t.next.P[t.next.k0] : t.A[q + t.k0] + 360] : [t.A[q + t.k0], t.P[q + t.k0]]).concat([t])); }
    const pNAq = P1 ? P1.get(NA) : null, jump = (dir, st) => prof1.some(o => { if (o.dir !== dir) return false; const x = at1(o, pNAq); return !!x && x[1] - x[0] > 15 && x[0] < st[0] && x[0] > st[0] - 3600 && x[1] > st[1] - 30; });   // 先に着いて止まっている列車を置いて先に出ることになる
    const RS = RUN_SG * 60 + 25;   // 宗吾参道〜京成成田を走る秒
    // 宗吾参道の上の線(下り本線)から出る回送: 車庫から出てホームにいる間(発車の150秒前〜40秒後)に、下りの列車が宗吾参道を通らない・止まらないこと
    const pSG = P1 ? P1.get(DH_ST) : null, sgClear = dp => pSG == null || (!prof1.some(o => { if (o.t1 < dp - 300 || o.t0 > dp + 300) return false; const x = at1(o, pSG); return !!x && (o.dir === 1 ? x[0] < dp + 40 && x[1] > dp - 150 : x[1] > dp - 150 && x[1] < dp - 10); }) && !sgEnd.some(a => a > dp - 180 && a < dp + 30) && !sgStart.some(a => a > dp - 120 && a < dp + 120));   // 宗吾参道始発の列車(車庫から出てくる)とも前後120秒あける   // 上りの列車も、車庫からホームへ出てくる間(発車の150〜10秒前)に宗吾参道を出ていくと交差する。宗吾参道に着いて車庫へ入る回送とも重ねない
    // 宗吾参道で止まって車庫へ入る列車(芝山千代田から来る宗吾参道止まりなど・ほかの回送)が着く時刻。回送は着く線(下の線)が同じなので、前150秒・後90秒あける
    const sgEnd = []; for (const t of list) if (t.names.length > 1 && t.names[t.names.length - 1] === DH_ST) sgEnd.push(t.A[t.names.length - 1 + t.k0]);
    const sgEndOK = x => !sgEnd.some(a => a > x - 150 && a < x + 90);
    const sgStart = []; for (const t of list) if (t.names.length > 1 && t.names[0] === DH_ST && !t.dh) sgStart.push(t.P[t.k0]);
    const sgStay = (a, b) => pSG == null || !prof1.some(o => { if (o.dir !== 1 || o.t1 < a - 300 || o.t0 > b + 300) return false; const x = at1(o, pSG); return !!x && x[0] < b + 40 && x[1] > a - 60; });   // 宗吾参道の上の線に a〜b 秒いる間、下りの列車が来ない
    const evS = (name, a, d, x) => Object.assign({ name, arr: Math.floor(a / 60), dep: Math.floor(d / 60), as: a, ds: d }, x || {});   // 秒で時刻を決めた停車
    const near = (lo, hi, pref) => { const l = []; for (let x = lo; x <= hi; x += 20) l.push(x); return l.sort((u, v) => Math.abs(u - pref) - Math.abs(v - pref)); };   // 20秒刻みの候補を、pref に近い順に
    // 京成成田で待つ秒(0 = 止まらずに通る、-1 = どう待ってもぶつかる): 通常列車と前後が入れ替わらず、中線が空いていて、ポイントで交差しない最初の秒。
    //  stay(w) = [着, 発](秒)、f(w) = 宗吾参道との間で通常列車と前後が入れ替わる
    // 成田空港側から1番線に着く上りの列車の時刻。中線から成田空港側へ出る回送は、東側のポイントでこれと交差するので前40秒・後160秒あける(着く列車は1分以上前からポイントにかかる)
    const westNA = nm => !!P1 && P1.has(nm) && P1.get(nm) < P1.get(NA);
    const naUpE = []; if (P1) for (const t of list) { const q = t.names.indexOf(NA); if (q > 0 && P1.has(t.names[q - 1]) && P1.get(t.names[q - 1]) > P1.get(NA)) naUpE.push(t.A[q + t.k0]); }
    const eastOK = x => !naUpE.some(a => a > x - 40 && a < x + 160);
    const waitNA = (f, stay, dir, commit) => { for (let w = 40; w <= 1500; w += 20) { const st = stay(w); if (f(w) || !midFree(st[0], st[1]) || jump(dir, st) || !(dir > 0 ? thInOK(st[0]) && eastOK(st[1]) : thOutOK(st[1]))) continue; if (commit) { midBusy.push(st); if (dir > 0) addIn(st[0]); else addOut(st[1]); } return w; }
      const ps = stay(0)[0]; if (f(0) || jump(dir, [ps, ps]) || !mainFree(dir, ps) || !(midFree(ps, ps) || termFree(ps)) || (dir < 0 && !thOutOK(ps))) return -1; if (dir < 0 && commit) addOut(ps); return 0; };   // 止まらずに通るのは本線が空いているときだけ。成田の始発・終着がいる間は、中線も空いていること
    const envN = (k, d) => +(typeof process !== 'undefined' && process.env[k] || d), WI = envN('DH_WI', 2400), WO = envN('DH_WO', 2400), MI = envN('DH_MI', 120), MO = envN('DH_MO', 100), PI = envN('DH_PI', 120), PO = envN('DH_PO', 120);   // 成田空港の回送: 送り込みは発車の MI〜WI 秒前に着く、引き上げは到着の MO〜WO 秒後に出る。ホームをふさぐ時間が短い時刻(PI 秒前・PO 秒後)から順に試す
    const placed = [];   // { cat, k, ta, td }  k = 線(0・1)。アクセス特急の線は1本なので k = 0
    const pen = (v, sIn, sOut, self) => { let n = 0;
      for (const o of placed) { if (o === self || (o.k !== v.k && !(v.cat === 'access' && o.cat === 'access'))) continue;
        if (o.cat === v.cat) { if (o.ta < v.td + 25 && v.ta - 25 < o.td) n += 8; continue; }
        if (v.cat === 'access' || o.cat === 'access') continue;
        const L = v.cat === 'liner' ? v : o, M = v.cat === 'liner' ? o : v;   // 奥の列車が出入りする瞬間に、手前に列車がいる
        if (M.ta < L.ta + 35 && L.ta - 35 < M.td) n += 5; if (M.ta < L.td + 100 && L.td - 35 < M.td) n += 5; }   // 奥から出る列車は動き出しが遅いので、手前に次が着くまで100秒あける
      if (sIn) { if (S.u.some(x => x !== self.sOut && x[0] < sIn[1] + SM && sIn[0] - SM < x[1] - ST)) n += 10; if (S.d.some(x => x !== self.sIn && Math.abs(x[1] - sIn[1]) < 50)) n += 3;
        if (S.d.some(x => x !== self.sIn && x[2] != null && sIn[0] > x[2] - 25 && sIn[0] < x[0] + CL)) n += 10; }   // 空港第2ビルに止まっている列車を、止まらない回送が追い抜かない
      if (sOut) { if (S.d.some(x => x !== self.sIn && x[0] + ST < sOut[1] + SM && sOut[0] - SM < x[1])) n += 10; if (S.u.some(x => x !== self.sOut && Math.abs(x[0] - sOut[0]) < 50)) n += 3;
        if (S.u.some(x => x !== self.sOut && x[2] != null && sOut[1] > x[1] - 25 && sOut[1] < x[2] + CL)) n += 10; }
      return n; };
    const ks = cat => cat === 'access' ? [0] : [0, 1];
    const edgeOf = v => v.cat === 'access' ? null : (v.cat === 'liner' ? EL : EM)[v.k];
    const as = (arr.get(NRT) || []).slice().sort((x, y) => aSec(x) - aSec(y)), ds = (dep.get(NRT) || []).slice().sort((x, y) => dSec(x) - dSec(y));
    const mk = (base, ev, cat) => { const t = { no: base.no, type: 'kaiso', dest: ev[ev.length - 1].name, cars: base.cars, fl: 0, x0: '', x1: '', tseg: null, ev, tt: true, s: 0, g: null, route: undefined, prev: null, next: null, k0: 0, dh: true, dhCat: cat, ops: base.ops ? { id: base.ops.id, auth: false } : undefined };
      list.push(t); return t; };
    // 成田空港の回送の時刻は秒で決める。A = 成田空港に着く秒、P = 成田空港を出る秒。京成成田〜成田空港は RN 秒、空港第2ビルは成田空港の T2 秒手前
    const RN = RUN_NA * 60 + 25, T2 = 110, thru = (name, x) => ({ name, arr: Math.floor(x / 60), dep: Math.floor(x / 60), as: x, ds: x, thru: true });
    // 運用表で同じ運用の、すぐ前・すぐ後の列車(駅が変わってつながる組を探すのに使う)。あいだが OPS_MAX 分以内のものだけ
    const SK = '京成佐倉', RK = 6 * 60 + 25;   // RK = 宗吾参道〜京成佐倉を走る秒
    const opsL = new Map(); for (const t of list) if (t.ops && t.ops.id && !t.dh) { const l = opsL.get(t.ops.id) || []; l.push(t); opsL.set(t.ops.id, l); }
    for (const l of opsL.values()) l.sort((x, y) => tDep(x) - tDep(y));
    const opsPrev = d => { const l = d.ops && opsL.get(d.ops.id), i = l ? l.indexOf(d) : -1; return i > 0 && tArr(l[i - 1]) <= tDep(d) && tDep(d) - tArr(l[i - 1]) <= OPS_MAX ? l[i - 1] : null; };
    const opsNx = a => { const l = a.ops && opsL.get(a.ops.id), i = l ? l.indexOf(a) : -1; return i >= 0 && i + 1 < l.length && tDep(l[i + 1]) >= tArr(a) && tDep(l[i + 1]) - tArr(a) <= OPS_MAX ? l[i + 1] : null; };   // OPS_MAX 分より長くあくものは、いったん車庫に入ったとみなす
    // 京成佐倉で始発・終着になる上り側の列車がホームにいる時間(秒)。回送は a〜b 秒にいちばん下の線に入るので、その前後90秒にほかの始発・終着がいないこと
    const wSK = nm => !!P1 && P1.has(nm) && P1.has(SK) && P1.get(nm) < P1.get(SK), skBusy = [];   // 上り側(上野方面へ出る始発・成田方面から来る終着)だけ数える。下りは上の線を使う
    for (const t of list) { const n = t.names.length; if (n < 2) continue; if (t.names[0] === SK && wSK(t.names[1])) skBusy.push([t, t.prev ? t.A[t.k0] : t.P[t.k0] - 300, t.P[t.k0]]); if (t.names[n - 1] === SK && !wSK(t.names[n - 2])) skBusy.push([t, t.A[n - 1 + t.k0], t.next ? t.next.P[t.next.k0] : t.A[n - 1 + t.k0] + 360]); }
    const skFree = (a, b, self) => !skBusy.some(([t, x, y]) => t !== self && x < b + 90 && a - 90 < y);
    // 京成佐倉の着く線: いちばん下の線(上りの始発・下りの終着が使う)
    const skEnd = dh => { const ss = stByName.get(SK), l = ss ? [...new Set(ss.stops.map(([x]) => x))].sort((x, y) => yOf(x) - yOf(y)) : []; if (l.length && E[l[l.length - 1]].dir !== 1) dh.forceEnd = l[l.length - 1]; };
    // 京成成田での待ち方(秒。0 = 通過、-1 = 無理)。commit = 中線・ポイントの使用を記録する
    // 京成成田を dp(秒)に出る下りの回送 / ar(秒)に着く上りの回送の、京成成田での待ち方
    const SM = +(typeof process !== 'undefined' && process.env.DH_SM || 5), ST = +(typeof process !== 'undefined' && process.env.DH_ST2 || 0), SR = +(typeof process !== 'undefined' && process.env.DH_SR || 90);   // 単線: 向かい合う列車との余裕(秒)、空港第2ビルのホームにいる分として差し引く秒、回送が単線を走る秒
    const naIn = (dp, commit) => waitNA(w => ordLine(DH_ST, NA, (w ? dp - w : dp + 5) - RS, w ? dp - w : dp + 5) || !sgClear((w ? dp - w : dp + 5) - RS), w => w ? [dp - w, dp] : [dp + 5, dp + 5], 1, commit);
    const naOut = (ar, commit) => waitNA(w => ordLine(NA, DH_ST, w ? ar + w : ar - 20, (w ? ar + w : ar - 20) + RS) || !sgEndOK((w ? ar + w : ar - 20) + RS), w => w ? [ar, ar + w] : [ar - 20, ar - 20], -1, commit);
    const memo = new Map(), probe = (key, f) => { if (!memo.has(key)) memo.set(key, f()); return memo.get(key); };   // 確かめた結果の覚え書き。記録が増えたら捨てる
    // ----- 空港第2ビルで待つ -----  行き違いのできる駅なので、回送はここで単線(〜成田空港)の空きを待てる。待つ間は同じ向きの列車がこの駅に来ないこと
    const U2 = [0, 60, 120, 180, 240, 300, 420, 540], R2 = RN - T2, SW = SR, CL = +(typeof process !== 'undefined' && process.env.DH_CL || 25);   // 待つ秒の候補、京成成田〜空港第2ビルを走る秒、空港第2ビルに止まってから単線を走る秒
    const b2D = (a, b, self) => !S.d.some(x => x !== self && (x[2] != null ? x[2] < b + CL && a - CL < x[0] : x[0] > a - CL && x[0] < b + CL));
    const b2U = (a, b, self) => !S.u.some(x => x !== self && (x[2] != null ? x[1] < b + CL && a - CL < x[2] : x[1] > a - CL && x[1] < b + CL));
    // ----- 成田スカイアクセス線・北総線経由(京成高砂の車庫と行き来する) -----
    //  成田湯川〜根古屋信号場〜空港第2ビルは単線。向かい合う列車とは根古屋信号場(待避線は1本)か空港第2ビルで行き違う。北総線内は通常列車と前後を入れ替えない速さで走る
    const NK = '根古屋信号場', YU = '成田湯川', INB = '印旛日本医大', R = THRU_REF, IBK = (R[YU] - R[INB]) / (R[YU] - R[TAKA]), hasAcc = stByName.has(NK) && stByName.has(YU) && stByName.has(TAKA);
    const refT = (t, nm) => { const q = t.names.indexOf(nm); if (q >= 0) return [t.A[q + t.k0], t.P[q + t.k0]]; const w = (t.pass || []).find(x => x.name === nm); if (w) return [w.t, w.t]; const r = R[nm]; if (r == null) return null;
      for (let i = 0; i + 1 < t.names.length; i++) { const ra = R[t.names[i]], rb = R[t.names[i + 1]]; if (ra == null || rb == null || (r - ra) * (r - rb) >= 0) continue; const x = t.P[i + t.k0] + (t.A[i + 1 + t.k0] - t.P[i + t.k0]) * (r - ra) / (rb - ra); return [x, x]; } return null; };
    const sec = { s1d: [], s1u: [], s2d: [], s2u: [], nk: [] }, rProf = [];   // 単線の2区間(1 = 湯川〜根古屋、2 = 根古屋〜第2ビル)にいる時間、根古屋で待っている時間、北総線内の列車の動き
    const addR = t => { const acc = ksVia(t) === 'access', pts = []; t.names.forEach((nm, i) => { const r = R[nm]; if (r == null || r < 10 || r > 32.5 || (!acc && r > 28.4)) return; pts.push([r, t.A[i + t.k0], t.P[i + t.k0], !!(t.ev[i].ot || t.ev[i].wait)]); });
      for (const w of t.pass || []) { const r = R[w.name]; if (acc && r != null && r > 10 && r <= 32.5 && !pts.some(q => q[0] === r)) pts.push([r, w.t, w.t]); }
      if (pts.length < 2) return; const d0 = Math.sign(pts[pts.length - 1][0] - pts[0][0]); pts.sort((x, y) => (x[0] - y[0]) * d0); if (!d0 || pts.some((q, k) => k && q[1] < pts[k - 1][2] - 1)) return;
      rProf.push({ t, pts, dir: d0, lo: Math.min(pts[0][0], pts[pts.length - 1][0]), hi: Math.max(pts[0][0], pts[pts.length - 1][0]), t0: pts[0][1], t1: pts[pts.length - 1][2] }); };
    if (hasAcc) for (const t of list) { addR(t); if (ksVia(t) !== 'access' || !t.names.includes(NRT2)) continue; const tY = refT(t, YU), tN = refT(t, NK), tB = refT(t, NRT2); if (!tY || !tN || !tB) continue;
      if (tY[0] < tB[0]) { sec.s1d.push([tY[1], tN[0]]); sec.s2d.push([tN[1], tB[0]]); } else { sec.s2u.push([tB[1], tN[0]]); sec.s1u.push([tN[1], tY[0]]); }
      if (tN[1] - tN[0] > 20) { const qn = t.names.indexOf(NK); sec.nk.push([tN[0], tN[1], qn >= 0 && t.ev[qn].sid === false]); } }
    const RSTN = Object.keys(R).filter(n => R[n] >= 10 && R[n] <= 32.5 && stByName.has(n)), RV = RSTN.map(n => R[n]);
    const atR = (o, r) => { let m = o.rc; if (!m) m = o.rc = new Map(); let v = m.get(r); if (v === undefined) m.set(r, v = atR0(o, r)); return v; };   // 同じ列車・同じ位置は覚えておく
    const atR0 = (o, r) => { const pts = o.pts; for (let k = 0; k < pts.length; k++) { if (Math.abs(pts[k][0] - r) < 1e-6) return [pts[k][1], pts[k][2], pts[k][3]]; if (k + 1 < pts.length && (r - pts[k][0]) * (r - pts[k + 1][0]) < 0) { const x = pts[k][2] + (pts[k + 1][1] - pts[k][2]) * (r - pts[k][0]) / (pts[k + 1][0] - pts[k][0]); return [x, x]; } } return null; };
    // 北総線内(京成高砂〜成田湯川)を r0→r1 に dep〜arr(秒)で走る回送が、同じ向きの列車と前後を入れ替えないか(0 = 走れる)
    const orMemo = new Map(); let orN = -1;
    const ordR = (r0, r1, dep, arr) => { if (orN !== rProf.length) { orMemo.clear(); orN = rProf.length; } const key = r0 + '|' + r1 + '|' + dep + '|' + arr; let r = orMemo.get(key); if (r === undefined) { r = ordRX(r0, r1, dep, arr); orMemo.set(key, r); } return r; };
    const ordRX = (r0, r1, dep, arr) => { const dir = Math.sign(r1 - r0), lo = Math.min(r0, r1), hi = Math.max(r0, r1);
      for (const o of rProf) { if (o.dir !== dir || o.t1 < dep - 300 || o.t0 > arr + 300 || o.hi <= lo || o.lo >= hi) continue; let s0 = 0, bad = false, cnt = 0;
        for (const r of RV) { if (r < lo - 1e-6 || r > hi + 1e-6) continue; const x = atR(o, r); if (!x) continue; cnt++; const my = dep + (arr - dep) * (r - r0) / (r1 - r0), st = Math.abs(r - r0) < 1e-6, a = st ? x[1] - 75 : x[0], b = Math.abs(r - r1) < 1e-6 ? x[0] : st ? x[1] + 15 : x[1];   // 出発駅(車庫から出る)では、先に出るなら2分以上前、あとから出るなら1分以上あと
          // 待避線で待っている列車(スカイライナーに抜かれる普通など)は、止まっている間に追い抜いてよい
          if (x[2] && s0 >= 0 && x[1] - x[0] >= 90 && my > x[0] + 25 && my < x[1] - 30) { s0 = -1; continue; }
          const mb = Math.abs(r - r1) < 1e-6 && r1 <= 10 ? 90 : 45;   // 京成高砂に着くときは、前を通った列車から90秒あける(高砂の手前で詰まる)
          const sg = my < a - 45 ? -1 : my > b + mb ? 1 : 0; if (!sg || (s0 && sg !== s0)) bad = true; s0 = sg || s0; }
        if (bad && cnt >= 2) return 6; }
      return 0; };
    // 京成高砂を通過して北総線へ向かう下りの列車(スカイライナーなど)の時刻。車庫から3番線に出てくる回送は、これとも重ねない
    let tkBl = null;   // tkFree で避ける高砂の停車(3番線・高砂止まり・3番線に回る4番線の列車)
    const tk4Full = o => TAKA_STOPS.some(p => p !== o && p.pl === 4 && p.a < o.d + 30 && o.a < p.d + 30);   // 4番線がふさがっていて、3番線に回ってくる下りの列車
    const tkThruDn = []; for (const t of list) { const q = t.names.indexOf(TAKA); if (q <= 0 || q >= t.names.length - 1 || !t.ev[q].thru) continue; const nx = t.names[q + 1], L2 = OT_LINES[2]; if (L2.indexOf(nx) > L2.indexOf(TAKA) && (OT_LINES[1].indexOf(nx) < 0 || ksVia(t) === 'access' || t.type === 'liner')) tkThruDn.push(t.A[q + t.k0]); }
    const hit = (l, a, b, m) => l.some(([x, y]) => x < b + m && a - m < y), nkSid = l => l.filter(x => !x[2]), nkStr = t => sec.nk.some(x => x[2] && x[0] < t + 30 && t - 30 < x[1]), tkFree = t0 => { let v = tkMemo.get(t0); if (v === undefined) { if (!tkBl) tkBl = TAKA_STOPS.filter(o => o.pl === 3 || o.t.names[o.t.names.length - 1] === TAKA || o.pl === 4 && tk4Full(o)); v = !tkBl.some(o => o.a < t0 + 90 && t0 - 120 < o.d) && !TAKA_STOPS.some(o => o.pl === 4 && o.d > t0 - 160 && o.d < t0 - 15) && !tkThruDn.some(x => x > t0 - 100 && x < t0 + 40) && !tkUpT.some(y => y > t0 - 40 && y < t0 + 60); tkMemo.set(t0, v); } return v; }, tkMemo = new Map(), close = (l, a, b) => l.some(([x, y]) => Math.abs(x - a) < 50 || (x - a) * (y - b) < 0);   // 向かい合う列車と重なる / 同じ向きの列車と近すぎる・入れ替わる
    const UN = [0, 60, 120, 180, 240, 300, 420, 540, 660, 780], DUR = [1350, 1500, 1680, 1920, 2160, 2400], DURI = Array.from({ length: 36 }, (_, i) => 1350 + i * 30), N2 = 100, N1 = 110;   // 根古屋で待つ秒、湯川〜高砂を走る秒、根古屋〜第2ビル・湯川〜根古屋を走る秒
    // 上り: 成田空港 P 発 → (空港第2ビル) → (根古屋) → 成田湯川 → 京成高砂
    // 京成高砂に上りで入る列車(本線から来る列車も、北総線から来る列車も)の時刻。北総線から高砂に着く回送は、合流するところで重ならないよう前100秒・後40秒あける
    const tkUpT = []; if (hasAcc) for (const t of list) { const q = t.names.indexOf(TAKA); if (q > 0 && q < t.names.length - 1 && OT_LINES[1].indexOf(t.names[q + 1]) >= 0 && OT_LINES[1].indexOf(t.names[q + 1]) < OT_LINES[1].indexOf(TAKA) || q > 0 && OT_LINES[2].indexOf(t.names[q + 1]) >= 0 && OT_LINES[2].indexOf(t.names[q + 1]) < OT_LINES[2].indexOf(TAKA)) tkUpT.push(t.A[q + t.k0]); }
    const tkIn = x => !tkUpT.some(y => y > x - 100 && y < x + 40) && !TAKA_STOPS.some(o => o.pl === 3 && o.d > x - 90 && o.d < x + 30);   // 北総線へ出ていく下りの列車(3番線)とも交差する
    // 北総線内を、駅と駅の間で速さを変えて(止まって)走る: 前の列車の後ろ・後ろの列車の前に、各駅で45秒以上あけて収まる時刻の並びを、前から順に決める。
    //  r0 を t0 秒に出て r1 に着く。want = r1 に着く秒(null = いちばん早く)。待避線で待っている前の列車は、止まっている間に追い抜いてよい
    const GAPR = envN('DH_GAPR', 1);
    const gapR = (r0, r1, t0, want) => { const dir = Math.sign(r1 - r0), lo = Math.min(r0, r1), hi = Math.max(r0, r1), sts = RV.filter(r => r >= lo - 1e-6 && r <= hi + 1e-6).sort((a, b) => (a - b) * dir);
      const os = rProf.filter(o => o.dir === dir && o.t1 > t0 - 600 && o.t0 < t0 + 4000 && o.hi > lo && o.lo < hi), side = new Map(), ts = [t0];
      for (const o of os) { const x = atR(o, r0); if (!x) continue; const sd = x[1] < t0 ? 1 : -1; side.set(o, sd); if (sd === 1 ? t0 < x[1] + 75 : t0 > x[0] - 15) return null; }   // 出発駅: 先に出た列車の75秒後、あとから来る列車の15秒前まで
      for (let k = 1; k < sts.length; k++) { const r = sts[k], last = k === sts.length - 1; let lb = ts[k - 1] + Math.abs(r - sts[k - 1]) * 60, ub = Infinity;
        for (const o of os) { const x = atR(o, r); if (!x) continue; let sd = side.get(o); if (sd == null) { sd = x[1] < lb ? 1 : -1; side.set(o, sd); }
          if (sd === 1) { if (!last && x[2] && x[1] - x[0] >= 90 && lb > x[0] + 25 && lb < x[1] - 30) { side.set(o, -1); ub = Math.min(ub, x[1] - 30); continue; } lb = Math.max(lb, (last ? x[0] : x[1]) + (Math.abs(o.pts[0][0] - r) < 1e-6 ? 90 : 45)); }   // その駅から出る始発の列車(待避線・引上線から出てくる)の後ろは90秒
          else ub = Math.min(ub, x[0] - 45); }
        if (last && want != null) { if (want < lb || want > ub) return null; ts.push(want); } else { if (lb > ub) return null; ts.push(lb); } }
      return { sts, ts }; };
    const gapPass = g => g.sts.slice(0, -1).map((r, k) => ({ name: RSTN[RV.indexOf(r)], t: g.ts[k], ref: true })).filter(w => R[w.name] > 10 && R[w.name] <= 32.5);
    // 北総線内の待避できる駅(新鎌ヶ谷・東松戸)で止まって、後ろの列車を先に行かせる。そこで a〜b 秒に止まっている同じ向きの列車がいないこと
    const HWS = ['新鎌ヶ谷', '東松戸'].filter(n => R[n] != null && stByName.has(n)), HWW = [120, 240, 360, 480, 600], HWON = envN('DH_HW', 1);
    const hwFree = (n, a, b, dir) => !rProf.some(o => { if (o.dir !== dir || o.t1 < a - 300 || o.t0 > b + 300) return false; const x = atR(o, R[n]); return !!x && x[1] - x[0] > 15 && x[0] < b + 30 && a - 30 < x[1]; });
    const accOut = (P, self, ib) => { if (!hasAcc) return null;   // ib = { lo, hi }: 印旛日本医大に lo〜hi 秒に着く(そこで止まる回送)。途中で長く待たない(第2ビルは3分・根古屋は5分まで。残りは成田空港のホームで待つ)
      for (const u2 of U2) { const a2 = P + (u2 ? SW : T2), p2 = a2 + u2; if (u2 && !b2U(a2, p2, self)) continue;
        for (const un of UN) { const aN = p2 + N2, pN = aN + un, tY = pN + N1;
          if (hit(sec.s2d, p2, aN, 15) || close(sec.s2u, p2, aN) || hit(sec.s1d, pN, tY, 15) || close(sec.s1u, pN, tY) || (un ? hit(nkSid(sec.nk), aN, pN, 30) : hit(nkSid(sec.nk), aN, aN, 20) && nkStr(aN))) continue;
          for (const du of ib ? DURI : DUR) { if (!ib && !tkIn(tY + du)) continue; if (ib) { if (un > 300 || u2 > 180) break; const tI = tY + du * IBK; if (tI >= ib.lo && tI <= ib.hi && !ordR(R[YU], R[INB], tY, tI)) return { route: 'acc', P, a2, p2, u2, aN, pN, un, tY, du, nkS: !un && nkStr(aN), tI }; continue; }
            if (!ordR(32.5, 10, tY, tY + du)) return { route: 'acc', P, a2, p2, u2, aN, pN, un, tY, du, tT: tY + du, nkS: !un && nkStr(aN) }; }
          if (!ib && GAPR) { const g0 = gapR(32.5, 10, tY, null); if (g0) for (let tT = g0.ts[g0.ts.length - 1]; tT <= tY + 2700; tT += 20) { if (!tkIn(tT)) continue; const g = gapR(32.5, 10, tY, tT); if (g) return { route: 'acc', P, a2, p2, u2, aN, pN, un, tY, du: tT - tY, tT, gp: g, nkS: !un && nkStr(aN) }; } }
          if (!ib && HWON) for (const n of HWS) for (const w of HWW) for (const du of DUR) { const rS = R[n], tS = tY + du * (32.5 - rS) / 22.5, tT = tY + du + w;
            if (tkIn(tT) && hwFree(n, tS, tS + w, -1) && !ordR(32.5, rS, tY, tS) && !ordR(rS, 10, tS + w, tT)) return { route: 'acc', P, a2, p2, u2, aN, pN, un, tY, du, tT, hw: { name: n, t: tS, w }, nkS: !un && nkStr(aN) }; } } }
      return null; };
    // 下り: 京成高砂 → 成田湯川 → (根古屋) → (空港第2ビル) → 成田空港 A 着
    const accIn = (A, self) => { if (!hasAcc) return null;
      for (const u2 of U2) { const p2 = A - (u2 ? SW : T2), a2 = p2 - u2; if (u2 && !b2D(a2, p2, self)) continue;
        for (const un of UN) { const pN = a2 - N2, aN = pN - un, tY = aN - N1;
          if (hit(sec.s2u, pN, a2, 15) || close(sec.s2d, pN, a2) || hit(sec.s1u, tY, aN, 15) || close(sec.s1d, tY, aN) || (un ? hit(nkSid(sec.nk), aN, pN, 30) : hit(nkSid(sec.nk), aN, aN, 20) && nkStr(aN))) continue;
          for (const du of DUR) if (tkFree(tY - du) && !ordR(10, 32.5, tY - du, tY)) return { route: 'acc', A, a2, p2, u2, aN, pN, un, tY, du, t0: tY - du, nkS: !un && nkStr(aN) };
          if (GAPR) for (let t0 = tY - 1350; t0 >= tY - 2700; t0 -= 30) { if (!tkFree(t0)) continue; const g = gapR(10, 32.5, t0, tY); if (g) return { route: 'acc', A, a2, p2, u2, aN, pN, un, tY, du: tY - t0, t0, gp: g, nkS: !un && nkStr(aN) }; }
          if (HWON) for (const n of HWS) for (const w of HWW) for (const du of DUR) { const rS = R[n], t0 = tY - du - w, tS = t0 + du * (rS - 10) / 22.5;
            if (tkFree(t0) && hwFree(n, tS, tS + w, 1) && !ordR(10, rS, t0, tS) && !ordR(rS, 32.5, tS + w, tY)) return { route: 'acc', A, a2, p2, u2, aN, pN, un, tY, du, t0, hw: { name: n, t: tS, w }, nkS: !un && nkStr(aN) }; } } }
      return null; };
    // 京成成田経由(宗吾参道の車庫と行き来する)
    const sgIn = (A, self, commit) => { for (const u2 of U2) { const p2 = A - (u2 ? SW : T2), a2 = p2 - u2; if (u2 && !b2D(a2, p2, self)) continue; const dp = a2 - R2; if (ordLine(NA, NRT2, dp, a2)) continue; const w = naIn(dp, commit); if (w < 0) continue; return { route: 'sg', A, a2, p2, u2, dp, w }; } return null; };
    const sgOut = (P, self, commit) => { for (const u2 of U2) { const a2 = P + (u2 ? SW : T2), p2 = a2 + u2; if (u2 && !b2U(a2, p2, self)) continue; const ar = p2 + R2; if (ordLine(NRT2, NA, p2, ar)) continue; const w = naOut(ar, commit); if (w < 0) continue; return { route: 'sg', P, a2, p2, u2, ar, w }; } return null; };
    // 回送の経路: スカイライナー・アクセス特急はアクセス線経由(だめなら京成成田経由)、本線の列車は京成成田経由
    const MACC = envN('DH_MACC', 1);   // 本線の列車も、京成成田経由がだめならアクセス線経由で高砂へ
    const planIn = (cat, A, self, commit) => (cat !== 'main' ? accIn(A, self) : null) || sgIn(A, self, commit) || (cat === 'main' && MACC ? accIn(A, self) : null);
    const planOut = (cat, P, self, commit, ib) => ib ? accOut(P, self, ib) : (cat !== 'main' ? accOut(P, self) : null) || sgOut(P, self, commit) || (cat === 'main' && MACC ? accOut(P, self) : null);
    const stop2 = pl => pl.u2 ? evS(NRT2, pl.a2, pl.p2) : thru(NRT2, pl.a2);
    const passR = (t, tY, du, down, hw) => { const rS = hw ? R[hw.name] : null; t.pass = RSTN.filter(n => R[n] > 10 && R[n] <= 32.5 && !(hw && n === hw.name)).map(n => ({ name: n, t: (down ? tY - du * (32.5 - R[n]) / 22.5 - (hw && R[n] < rS ? hw.w : 0) : tY + du * (32.5 - R[n]) / 22.5 + (hw && R[n] < rS ? hw.w : 0)), ref: true })); };   // hw = 途中の駅で止まって待つ(その手前・先で時刻がずれる)
    // 計画から列車(停車駅と時刻)を作る。あわせて、使う線・時間を記録する
    const mkIn = (j, pl, src, sk) => { const tail = [stop2(pl), evS(NRT, pl.A, pl.A + 25)]; let ev;
      if (src) ev = [evS(NA, pl.a2 - R2 - 60, pl.a2 - R2), ...tail];
      else if (pl.route === 'acc') { const t0 = pl.t0 != null ? pl.t0 : pl.tY - pl.du; ev = [evS(TAKA, t0 - 55, t0), ...(pl.hw ? [evS(pl.hw.name, pl.hw.t, pl.hw.t + pl.hw.w, { wait: true })] : []), ...(pl.un ? [evS(NK, pl.aN, pl.pN)] : pl.nkS ? [thru(NK, pl.aN)] : []), ...tail];
        sec.s1d.push([pl.tY, pl.aN]); sec.s2d.push([pl.pN, pl.a2]); if (pl.un) sec.nk.push([pl.aN, pl.pN]); }
      else ev = pl.w ? [evS(DH_ST, pl.dp - pl.w - RS - 55, pl.dp - pl.w - RS), evS(NA, pl.dp - pl.w, pl.dp), ...tail] : [evS(DH_ST, pl.dp + 5 - RS - 55, pl.dp + 5 - RS), thru(NA, pl.dp + 5), ...tail];
      if (sk && !src && pl.route !== 'acc') { ev[0] = evS(DH_ST, sk.sp + RK, ev[0].ds); ev.unshift(evS(SK, sk.sp - 60, sk.sp)); }   // 京成佐倉から来る
      const dh = mk(j.d, ev, j.cat); if (pl.route === 'acc' && !src) { if (pl.gp) dh.pass = gapPass(pl.gp); else passR(dh, pl.tY, pl.du, true, pl.hw); if (!pl.un && !pl.nkS) dh.pass.push({ name: NK, t: pl.aN, ref: true }); }
      ttSchedule(dh); addProf(dh); if (hasAcc) addR(dh); return dh; };
    const mkOut = (j, pl, cat, sk, inb) => { const head = [evS(NRT, pl.P - 60, pl.P), stop2(pl)]; let ev;
      if (pl.route === 'acc') { ev = [...head, ...(pl.un ? [evS(NK, pl.aN, pl.pN)] : pl.nkS ? [thru(NK, pl.aN)] : []), ...(pl.hw ? [evS(pl.hw.name, pl.hw.t, pl.hw.t + pl.hw.w, { wait: true })] : []), evS(TAKA, pl.tT || pl.tY + pl.du, (pl.tT || pl.tY + pl.du) + 25)]; if (!inb) { tkUpT.push(pl.tT || pl.tY + pl.du); tkMemo.clear(); }
        sec.s2u.push([pl.p2, pl.aN]); sec.s1u.push([pl.pN, pl.tY]); if (pl.un) sec.nk.push([pl.aN, pl.pN]); }
      else { ev = pl.w ? [...head, evS(NA, pl.ar, pl.ar + pl.w), evS(DH_ST, pl.ar + pl.w + RS, pl.ar + pl.w + RS + 25)] : [...head, thru(NA, pl.ar - 20), evS(DH_ST, pl.ar - 20 + RS, pl.ar - 20 + RS + 25)]; sgEnd.push(ev[ev.length - 1].as); }
      if (sk) { const e = ev[ev.length - 1]; ev[ev.length - 1] = evS(DH_ST, e.as, sk.dp); ev.push(evS(SK, sk.dp + RK, sk.dp + RK + 25)); }   // そのまま京成佐倉まで行く
      if (inb) ev[ev.length - 1] = evS(INB, inb.t, inb.t + 25);   // 印旛日本医大で止まる
      const dh = mk(j.a, ev, cat); if (pl.route === 'acc') { if (pl.gp) dh.pass = gapPass(pl.gp); else passR(dh, pl.tY, pl.du, false, pl.hw); if (inb) dh.pass = dh.pass.filter(w => R[w.name] > R[INB]); if (!pl.un && !pl.nkS) dh.pass.push({ name: NK, t: pl.aN, ref: true }); }
      ttSchedule(dh); addProf(dh); if (hasAcc) addR(dh); return dh; };
    // j.kind: 'fix' = 折り返しが決まっている(線だけ選ぶ)  'in' = 回送で入ってくる(着く時刻も選ぶ)  'out' = 回送で出ていく(出る時刻も選ぶ)
    // 印旛日本医大まで回送する列車(INB_FIX): 着いてよいのは、印旛日本医大始発の上りの列車が出て150秒後から、つながる列車の発車50秒前まで(印旛日本医大は2線で、ほかの折り返しと重ねない)
    const ibOf = a => { const no = (INB_FIX[list.day] || {})[a.no], d = no && list.find(t => t.no === no && !t.prev && t.names[0] === INB); if (!d) return null; const D = d.P[d.k0];
      const lo = Math.max(0, ...list.filter(t => t !== d && t.names[0] === INB && t.P[t.k0] <= D).map(t => t.P[t.k0] + 150)); return { lo, hi: D - 50, d }; };   // 前の列車は引上線からホームへ入ってくるので、それが出て150秒後から
    const jobs = [...as.filter(a => a.next).map(a => ({ kind: 'fix', a, cat: nrtCat(a), t: aSec(a) })), ...as.filter(a => !a.next).map(a => ({ kind: 'out', a, cat: nrtCat(a), t: aSec(a), ib: ibOf(a) })), ...ds.filter(d => !d.prev).map(d => ({ kind: 'in', d, cat: nrtCat(d), t: dSec(d) }))].sort((x, y) => x.t - y.t);
    const choose = j => { let best = null; const v0 = j.v || {}, cat = j.cat;
      if (j.kind === 'fix') { for (const k of ks(cat)) { const v = { cat, k, ta: aSec(j.a), td: dSec(j.a.next) }, n = pen(v, null, null, v0); if (!best || n < best.n) best = { n, v }; } }
      else if (j.kind === 'in') { const Ds = dSec(j.d);   // 発車の150秒〜25分前に着く(5分前ごろを優先)
        for (const A of j.win ? near(...j.win) : near(Ds - WI, Ds - MI, Ds - PI)) { const sIn = [A - SW, A]; let op = null; if (j.naOK && !j.naOK(A)) continue;
          for (const k of ks(cat)) { const v = { cat, k, ta: A, td: Ds, sIn, A }; let n = pen(v, sIn, null, v0);
            if (!n) { if (op == null) op = j.win ? ordPen(prof.d, [null, null, A - T2, A]) : probe('i' + cat + A, () => ordPen(prof.d, [null, null, A - T2, A]) + (planIn(cat, A, v0.sIn, false) ? 0 : 7)); n = op; v.op = op; }   // j.win = 京成成田から来る回送(着く時刻の範囲)
            if (!best || n < best.n) best = { n, v }; }
          if (best.n === 0) break; } }
      else { const Ta = aSec(j.a);   // 到着の120秒〜20分後に出る(3分後ごろを優先)
        for (const P of near(Ta + MO, Ta + WO, Ta + PO)) { const sOut = [P, P + SW]; let op = null;
          // アクセス特急で着いて運用が終わる列車は、1番線がふさがっていればスカイライナーのホーム(車止め側)に入る
          for (const c of cat === 'access' ? ['access', 'liner'] : [cat]) for (const k of ks(c)) { const v = { cat: c, k, ta: Ta, td: P, sOut, P }; let n = pen(v, null, sOut, v0);
            if (!n) { if (op == null) op = probe('o' + cat + P + (j.ib ? 'i' : ''), () => ordPen(prof.u, [null, null, P + T2, P]) + (planOut(cat, P, v0.sOut, false, j.ib) ? 0 : 7)); n = op; v.op = op; }
            n += c !== cat ? 1 : 0; if (!best || n < best.n) best = { n, v }; }
          if (best.n === 0) break; } }
      return best; };
    const apply = (j, best) => { const o = j.v, v = best.v;
      if (o) { placed.splice(placed.indexOf(o), 1); if (o.sIn) S.d.splice(S.d.indexOf(o.sIn), 1); if (o.sOut) S.u.splice(S.u.indexOf(o.sOut), 1); }
      placed.push(v); if (v.sIn) S.d.push(v.sIn); if (v.sOut) S.u.push(v.sOut); j.v = v; v.job = j; j.n = best.n; };
    for (const j of jobs) { apply(j, choose(j)); yield; }
    // いったん全部置いてから、ぶつかっているものを中心に選び直す(あとから置いた列車のことも見て決め直す)
    for (let round = 0; round < 4; round++) { let ch = 0;
      for (const j of jobs) { yield; const cur = pen(j.v, j.v.sIn, j.v.sOut, j.v) + (j.v.op || 0); if (!cur) continue; const b = choose(j); if (b.n < cur) { apply(j, b); ch++; } }
      if (!ch) break; }
    // どう選んでもぶつかる回送は走らせない(その列車は今までどおり、発車の直前にホームに現れる・着いてすぐ消える)。
    // 外したぶん空きができるので、残りをもう一度選び直す
    const stat = { n: 0, skip: 0 };
    for (let round = 0; round < 6; round++) { let ch = 0;
      for (const j of jobs) { yield; const v = j.v; if (j.kind === 'fix') { const cur = pen(v, null, null, v); if (cur) { const b = choose(j); if (b.n < cur) { apply(j, b); ch++; } } continue; }
        if (j.skip) { if (v.cat !== 'access' && pen(v, null, null, v)) { const w = Object.assign({}, v, { k: 1 - v.k }); if (pen(w, null, null, v) < pen(v, null, null, v)) { v.k = w.k; ch++; } } continue; }
        if (!(pen(v, v.sIn, v.sOut, v) + (v.op || 0))) continue;
        const b = choose(j); if (b.n < 2) { apply(j, b); ch++; continue; }
        j.skip = true; ch++; if (v.sIn) { S.d.splice(S.d.indexOf(v.sIn), 1); v.sIn = null; v.ta = v.td - 30; } if (v.sOut) { S.u.splice(S.u.indexOf(v.sOut), 1); v.sOut = null; v.td = v.ta + 30; } }
      if (!ch) break; }
    // 折り返しの列車(時刻を動かせない)がぶつかっていて、もう一方の線をふさいでいるのが回送だけなら、回送のほうをどかして選び直させる
    { const pair = (v, o) => { if (o.k !== v.k && !(v.cat === 'access' && o.cat === 'access')) return 0; if (o.cat === v.cat) return o.ta < v.td + 25 && v.ta - 25 < o.td ? 8 : 0; if (v.cat === 'access' || o.cat === 'access') return 0;
        const L = v.cat === 'liner' ? v : o, M = v.cat === 'liner' ? o : v; return (M.ta < L.ta + 35 && L.ta - 35 < M.td ? 5 : 0) + (M.ta < L.td + 100 && L.td - 35 < M.td ? 5 : 0); };
      const unplace = j => { const v = j.v; j.skip = true; if (v.sIn) { S.d.splice(S.d.indexOf(v.sIn), 1); v.sIn = null; v.ta = v.td - 30; } if (v.sOut) { S.u.splice(S.u.indexOf(v.sOut), 1); v.sOut = null; v.td = v.ta + 30; } };
      for (let round = 0; round < 3; round++) { const moved = [];
        for (const j of jobs) { yield; const v = j.v; if (j.kind !== 'fix' || !pen(v, null, null, v)) continue;
          for (const k of ks(v.cat)) { const w = Object.assign({}, v, { k }), cs = placed.filter(o => o !== v && pair(w, o)); if (!cs.length || !cs.every(o => o.job && o.job.kind !== 'fix')) continue;
            for (const o of cs) if (!o.job.skip) { unplace(o.job); moved.push(o.job); } else if (o.k !== undefined && o.cat !== 'access') o.k = 1 - o.k;
            v.k = k; break; } }
        if (!moved.length) break; memo.clear();
        for (const j of moved) { yield; const b = choose(j); if (!b.n) { j.skip = false; apply(j, b); } } } }
    // 見送った回送を、ほかの回送をどかして入れ直す: 近い時刻の回送を1本(だめなら2本)いったん外し、見送った回送を先に置いてから、外したものを選び直す。全部置けたときだけ採用する
    { const lift = o => { const v = o.v; placed.splice(placed.indexOf(v), 1); if (v.sIn) S.d.splice(S.d.indexOf(v.sIn), 1); if (v.sOut) S.u.splice(S.u.indexOf(v.sOut), 1); };
      const drop = o => { const v = o.v; placed.push(v); if (v.sIn) S.d.push(v.sIn); if (v.sOut) S.u.push(v.sOut); };
      const EJ = envN('DH_EJ', 1), EW = envN('DH_EW', 1500);
      const retry = (j, os) => { const jv = j.v, jn = j.n, ovs = os.map(o => [o.v, o.n]); for (const o of os) lift(o); memo.clear();
        const b = choose(j); let ok = b.n < 2; if (ok) { apply(j, b); memo.clear(); }
        const done = []; if (ok) for (const o of os) { const b2 = choose(o); if (b2.n >= 2) { ok = false; break; } drop(o); apply(o, b2); done.push(o); memo.clear(); }
        if (ok) { j.skip = false; return true; }
        // 元に戻す
        os.forEach((o, i) => { if (done.includes(o)) apply(o, { v: ovs[i][0], n: ovs[i][1] }); else drop(o); }); if (j.v !== jv) apply(j, { v: jv, n: jn }); memo.clear(); return false; };
      for (let round = 0; round < 3 && EJ; round++) { let ch = 0;
        for (const j of jobs) { if (!j.skip || j.kind === 'fix') continue; yield; const t = j.t;
          const b0 = choose(j); if (b0.n < 2) { apply(j, b0); j.skip = false; memo.clear(); ch++; continue; }
          const near = jobs.filter(o => o !== j && o.kind !== 'fix' && !o.skip && Math.abs(o.t - t) < EW).sort((x, y) => Math.abs(x.t - t) - Math.abs(y.t - t)); let got = false;
          for (const o of near) { yield; if (retry(j, [o])) { got = true; break; } }
          if (!got && EJ > 1) { const nn = near.slice(0, 6); for (let a = 0; a < nn.length && !got; a++) for (let c = a + 1; c < nn.length && !got; c++) if (retry(j, [nn[a], nn[c]])) got = true; }
          if (got) ch++; }
        if (!ch) break; } }
    // それでも残ったもの: 近い時刻の列車と2本まとめて線を入れ替えてみる(1本ずつでは良くならない組み合わせ)
    const pOf = j => pen(j.v, j.v.sIn, j.v.sOut, j.v);
    for (const j of jobs) { yield; if (j.v.cat === 'access' || !pOf(j)) continue;
      const win = jobs.filter(o => o.v.cat !== 'access' && o.v.ta < j.v.td + 2400 && j.v.ta - 2400 < o.v.td), tot = () => win.reduce((m, o) => m + pOf(o), 0);
      let best = tot(), bo = null, bj = false;
      for (const o of win) for (const fj of [false, true]) { if (o === j && !fj) continue; if (o !== j) o.v.k = 1 - o.v.k; if (fj) j.v.k = 1 - j.v.k; const x = tot(); if (x < best) { best = x; bo = o; bj = fj; } if (o !== j) o.v.k = 1 - o.v.k; if (fj) j.v.k = 1 - j.v.k; }
      if (bo) { if (bo !== j) bo.v.k = 1 - bo.v.k; if (bj) j.v.k = 1 - j.v.k; } }
    // 時刻の順に決めたあと、見送ったものをもう一度試す(あとから決まった回送のおかげで空きが分かることがある)。SENT に来たら見直しを積む
    const SENT = { sent: true }, queue = [...jobs, SENT];
    for (const j of queue) { yield; if (j === SENT) { for (const r of jobs) { if (r.kind === 'fix' || r.retried || (r.kind === 'in' ? r.d.prev : r.a.next)) continue; r.retried = true; yield; memo.clear(); const b = choose(r); if (b && b.n === 0) { apply(r, b); r.skip = false; stat.skip--; queue.push(r); } } continue; }
      let v = j.v, e = edgeOf(v);
      if (j.kind === 'fix') { if (e != null) j.a.forceEnd = e; continue; }
      if (j.kind === 'out' && v.cat !== j.cat) j.a.dhCat = v.cat;   // 着く列車そのものも、そのホームへ入る
      if (j.skip) { stat.skip++; if (j.kind === 'out' && e != null) j.a.forceEnd = e; if (j.kind === 'in' && e != null) j.d.nrtE = e; continue; }   // 見送った始発も、選んだ線に現れる
      stat.n++;
      if (j.kind === 'in') {
        // 京成成田止まりのライナーが、同じ運用で成田空港始発になる(運用表では駅が変わってつながる): 京成成田から成田空港へ回送する
        //  運用表で前の列車が京成成田止まりの場合(アクセス特急・本線の列車も)も同じ。成田で6分より長く待つことになるなら、いったん宗吾参道へ戻す(中線は東成田・芝山の列車や成田止まりでふさがっていて、長く置けない)
        const rk = j.d.type === 'liner' ? ttRunOf(j.d).key : null, sa = x => tArr(x) * 60 + 30, dpN = v.A - RN, po = opsPrev(j.d);
        const okS = x => x.names[x.names.length - 1] === NA && !x.next && !x.exitEnd && !x.dh && !x.swapOut && sa(x) <= dpN - 150;
        let src = null; for (const x of [...(rk ? (arr.get(NA) || []).filter(x => x.type === 'liner' && ttRunOf(x).key === rk) : []), ...(po ? [po] : [])]) { if (!okS(x)) continue;
          if (sa(x) >= dpN - 360) { src = x; break; }
          // 長く待つ: 着いた上の線(4番線)でそのまま待ち、成田空港側へ出る(向きを変えないので西側のポイントを渡らない)。待つ間に来る成田空港行きの通過列車は中線を通す
          if (sa(x) >= dpN - 2700 && westNA(x.names[x.names.length - 2])) { const s0 = sa(x);
            // 上の線で s0〜e0 秒待てるか: 待つ間に上の線に入る列車は、成田空港行きの通過列車なら中線を通す(中線が空いていて、両側のポイントで交差しない)
            const holdChk = (e0, Av) => { const hold = mainBusy[1].filter(([p, q, o]) => o !== x && p < e0 + 45 && s0 - 30 < q);
              const divs = hold.map(([p, q, o]) => { const k = o ? o.names.indexOf(NA) : -1; return k > 0 && k < o.names.length - 1 && westNA(o.names[k - 1]) && !westNA(o.names[k + 1]) && o.names[k + 1] !== '東成田' && o.names[k + 1] !== '芝山千代田' && !o.dh && o.A[k + o.k0] > s0 + 5 ? { o, a: o.A[k + o.k0], d: o.P[k + o.k0] } : null; });
              return divs.every(z => z && midFree(z.a - 60, z.d + 30, z.o) && thInOK(z.a) && eastOK(z.d)) && eastOK(e0) && !ordLine(NA, NRT2, e0, Av - T2) ? divs : null; };
            let divs = holdChk(dpN, v.A);
            if (!divs) { j.win = [s0 + 150 + RN, dSec(j.d) - MI, s0 + 150 + RN]; j.naOK = A => !!holdChk(A - RN, A); const b = choose(j); delete j.win; delete j.naOK; memo.clear(); if (b && b.n === 0) { apply(j, b); v = j.v; e = edgeOf(v); divs = holdChk(v.A - RN, v.A); } }   // 成田空港に早めに着いて、空港のホームで待つ
            if (divs) { const e0 = v.A - RN; src = x; x.naHold = [s0, e0]; for (const z of divs) { z.o.naDiv = true; midBusy.push([z.a - 60, z.d + 30, z.o]); addIn(z.a); } stat.naHold = (stat.naHold || 0) + 1; break; } }
        }
        // 計画を確定する。ほかの回送とぶつかったら、いまの状態で時刻を選び直す
        let pl = src ? { route: 'sg', A: v.A, a2: v.A - T2, p2: v.A - T2, u2: 0 } : planIn(j.cat, v.A, v.sIn, true); memo.clear();
        if (!pl) { const b = choose(j); if (b.n < 2) { apply(j, b); v = j.v; e = edgeOf(v); pl = planIn(j.cat, v.A, v.sIn, true); memo.clear(); } }
        if (!pl) { stat.n--; stat.skip++; if (e != null) j.d.nrtE = e; continue; }
        if (pl.u2) { v.sIn[0] = pl.p2; v.sIn[2] = pl.a2; }   // 空港第2ビルに止まっている時間
        // 運用表で前の列車が京成佐倉止まり: 京成佐倉から宗吾参道を経て来る。京成佐倉で待つのは10分まで。宗吾参道では上の線(下り本線)に止まるので、待つのは2分まで・その間に下りの列車が来ないこと。
        //  それより長くあくときは、京成佐倉から宗吾参道の車庫へ回送して入れる(成田空港へは車庫から出ていく)
        let sk = null, skD = null; if (!src && pl.route === 'sg' && po && po.names[po.names.length - 1] === SK && !po.next && !po.exitEnd && !po.dh && stByName.has(SK)) { const x0 = pl.w ? pl.dp - pl.w - RS : pl.dp + 5 - RS;
          for (let sp = x0 - RK - 40; sp >= x0 - RK - 120 && sp >= sa(po) + 100 && sp <= sa(po) + 600; sp -= 20) if (!ordLine(SK, DH_ST, sp, sp + RK) && sgStay(sp + RK, x0)) { sk = { sp }; break; }
          if (!sk) for (let sp = sa(po) + 100; sp + RK + 100 <= x0; sp += 20) if (!ordLine(SK, DH_ST, sp, sp + RK) && sgStay(sp + RK, sp + RK + 25)) { skD = sp; break; } }
        const dh = mkIn(j, pl, src, sk); dh.next = j.d; j.d.prev = dh; if (sk) { po.next = dh; dh.prev = po; stat.fromSK = (stat.fromSK || 0) + 1; }
        if (skD != null) { const d1 = mk(po, [evS(SK, skD - 60, skD), evS(DH_ST, skD + RK, skD + RK + 25)], null); d1.dhCat = undefined; ttSchedule(d1); addProf(d1); po.next = d1; d1.prev = po; stat.skDepot = (stat.skDepot || 0) + 1; } if (e != null) dh.forceEnd = e; if (pl.route === 'acc') stat.acc = (stat.acc || 0) + 1; if (pl.u2) stat.wait2 = (stat.wait2 || 0) + 1; if (pl.un) stat.waitNK = (stat.waitNK || 0) + 1;
        if (src) { src.next = dh; dh.prev = src; stat.fromNA = (stat.fromNA || 0) + 1; } }
      else { let pl = planOut(j.cat, v.P, v.sOut, true, j.ib); memo.clear();
        if (!pl) { const b = choose(j); if (b.n < 2) { apply(j, b); v = j.v; e = edgeOf(v); pl = planOut(j.cat, v.P, v.sOut, true, j.ib); memo.clear(); } }
        if (v.cat !== j.cat) j.a.dhCat = v.cat;
        if (!pl) { stat.n--; stat.skip++; if (e != null) j.a.forceEnd = e; continue; }
        if (pl.u2) { v.sOut[1] = pl.a2; v.sOut[2] = pl.p2; }
        // 運用表で次の列車が京成佐倉始発: 宗吾参道で時機を見てから、京成佐倉のいちばん下の線へ入る
        let sk = null; const d2 = pl.route === 'sg' && stByName.has(SK) ? opsNx(j.a) : null;
        if (d2 && d2.names[0] === SK && !d2.prev && !d2.dh && !d2.swapIn) { const sgA = pl.w ? pl.ar + pl.w + RS : pl.ar - 20 + RS, lim = tDep(d2) * 60 - 100;
          for (let w = 40; w <= 1500 && sgA + w + RK <= lim; w += 20) if (!ordLine(DH_ST, SK, sgA + w, sgA + w + RK) && skFree(sgA + w + RK, tDep(d2) * 60, d2)) { sk = { dp: sgA + w }; break; } }
        const inb = j.ib && pl.tI != null && !j.ib.d.prev ? { t: pl.tI, d: j.ib.d } : null;
        const dh = mkOut(j, pl, v.cat, sk, inb); j.a.next = dh; dh.prev = j.a; if (inb) { dh.next = inb.d; inb.d.prev = dh; stat.toINB = (stat.toINB || 0) + 1; } if (sk) { dh.next = d2; d2.prev = dh; skEnd(dh); stat.toSK = (stat.toSK || 0) + 1; } if (e != null) j.a.forceEnd = e; if (pl.route === 'acc') stat.acc = (stat.acc || 0) + 1; if (pl.u2) stat.wait2 = (stat.wait2 || 0) + 1; if (pl.un) stat.waitNK = (stat.waitNK || 0) + 1; } }
    // ----- 京成成田: 前後の運用が無い始発・終着は、宗吾参道との間を回送で出入りする -----
    //  上りの始発(モーニングライナーなど)は、宗吾参道から来て中線へ入り、向きを変えて発車する
    { const s = stByName.get(NA), es = s ? [...new Set(s.stops.map(([x]) => x))].sort((x, y) => yOf(x) - yOf(y)) : [], mid = es.length === 3 ? es[1] : null, pNA = P1 ? P1.get(NA) : null;
      const west = nm => P1 && P1.has(nm) && P1.get(nm) < pNA;
      // 1番線(上り本線)がふさがっている時間: 上りで通る列車のうち、中線へ回らないもの
      const u1Busy = [], u1Free = (a, b, self) => !u1Busy.some(([x, y, o]) => o !== self && x < b + 60 && a - 60 < y);
      for (const t of list) { const q = t.names.indexOf(NA), n = t.names.length; if (q <= 0 || q >= n - 1 || west(t.names[q - 1]) || !west(t.names[q + 1])) continue; const e = t.ev[q], pv = t.names[q - 1];
        if (e.ot || e.wait || e.dep - e.arr >= 3 || t.type === 'liner') continue;   // これらは中線へ入る
        u1Busy.push([t.A[q + t.k0], t.P[q + t.k0], t]); }
      // 5番線(下り本線)に下りの列車がいる時間
      const d5Busy = [], d5Free = (a, b, self, div) => !d5Busy.some(([x, y, o]) => o !== self && !(div && o && x > a + 5 && dnArrT.some(z => z.t === o && z.thr)) && x < b + 60 && a - 30 < y) && !mainBusy[1].some(([x, y, o]) => o !== self && !(div && o && x > a + 5 && dnArrT.some(z => z.t === o && z.thr)) && x < b + 60 && a - 30 < y);   // div = あとから来る成田空港行きの通過列車は中線へ回せるので数えない(divOK で確かめる)   // 上の線に止まる終着の列車なども(mainBusy)
      for (const t of list) if (t.naHold) d5Busy.push([t.naHold[0] - 30, t.naHold[1], t]);   // 上の線で待って成田空港へ向かうライナー
      // 成田空港の回送で京成成田を止まらずに通るもの: 上りは1番線、下りは上の線を通る
      for (const t of list) { if (!t.dh) continue; const q = t.names.indexOf(NA), n = t.names.length; if (q <= 0 || q >= n - 1 || !t.ev[q].thru) continue; const x = t.A[q + t.k0]; (west(t.names[q + 1]) ? u1Busy : d5Busy).push([x - 20, x + 20, t]); }
      for (const t of list) { const q = t.names.indexOf(NA), n = t.names.length; if (q <= 0 || q >= n - 1 || !west(t.names[q - 1]) || west(t.names[q + 1])) continue; d5Busy.push([t.A[q + t.k0], t.P[q + t.k0], t]); }
      // 上の線(4・5番線)から西へ折り返して出る列車は、ポイントまで下り本線を逆に走る: 出る前後に下りの列車が着かないこと
      const dnArr = [], dnArrT = []; for (const t of list) { const q = t.names.indexOf(NA); if (q > 0 && west(t.names[q - 1])) { dnArr.push(t.A[q + t.k0]); dnArrT.push({ t, a: t.A[q + t.k0], d: t.P[q + t.k0], thr: q < t.names.length - 1 && !west(t.names[q + 1]) && t.names[q + 1] !== '東成田' && t.names[q + 1] !== '芝山千代田' }); } }
      // 上の線でライナーが待つ間に来る下りの列車: 成田空港へ通り抜ける列車なら中線を通す(中線が空いていて、両側のポイントで交差しないとき)
      const divOK = (a0, b0) => dnArrT.filter(o => o.a > a0 + 5 && o.a < b0 + 150).every(o => !o.t.dh && o.thr && midFree(o.a - 60, o.d + 30, o.t) && thInOK(o.a) && eastOK(o.d));
      const divDo = (a0, b0) => { for (const o of dnArrT.filter(o => o.a > a0 + 5 && o.a < b0 + 150)) { o.t.naDiv = true; midBusy.push([o.a - 60, o.d + 30, o.t]); addIn(o.a); } };
      const d5Dep = x => !dnArr.some(t => t > x - 40 && t < x + 240);
      // 1番線に上りの列車がいる時間(中線へ回る予定の列車も、中線がふさがっていれば1番線に入るので数える)
      const upAll = []; for (const t of list) { const q = t.names.indexOf(NA), n = t.names.length; if (q <= 0 || west(t.names[q - 1])) continue; upAll.push([t.A[q + t.k0], q < n - 1 ? t.P[q + t.k0] : t.next ? t.next.P[t.next.k0] : t.A[q + t.k0] + 360, t]); }
      const u1Clear = (a, b, self) => !upAll.some(([x, y, o]) => o !== self && x < b + 90 && a - 90 < y);
      if (pNA != null) {
        // 送り込み: 宗吾参道 → 京成成田。発車の100秒前〜25分前に着く(4分前ごろを優先)。早く着いたぶんはホームで待つ
        // 送り込みを決める前に、成田始発の仮の予約(発車前5分)を外す。発車の早い順に、実際に使う時間だけを入れていく(見送ったものは発車前1分だけ)
        for (let i = midBusy.length - 1; i >= 0; i--) if (midBusy[i][3] === 1 && !midBusy[i][2].prev) midBusy.splice(i, 1);
        for (const d of (dep.get(NA) || []).slice().sort((x, y) => tDep(x) - tDep(y))) { yield; if (d.prev || d.exitStart || d.dh || d.swapIn) continue;
          const D = tDep(d), Ds = D * 60 + 5, upSt = west(d.names[1]), fix = (NA_DH_FIX[list.day] || {})[d.no + '@' + D]; let A = null, trk = null;
          const run = x => !ordLine(DH_ST, NA, x - RS, x) && sgClear(x - RS), cands = near(Ds - 1500, Ds - envN('DH_NAMI', 60), Ds - 240);
          const tryT = (name, ok) => { if (A != null) return; for (const x of cands) if (run(x) && ok(x)) { A = x; trk = name; return; } };
          if (fix) { A = fix.m * 60 + 30; trk = fix.u1 ? 'u1' : 'mid'; }
          if (upSt) {   // 上りの始発: 中線(直前5分に別の列車がいたら避ける) → 1番線 → 中線
            tryT('mid', x => thInOK(x) && midFree(x - 300, Ds, d)); tryT('u1', x => thInOK(x) && u1Free(x, Ds, d) && u1Clear(x, Ds, d)); tryT('mid', x => thInOK(x) && midFree(x, Ds, d)); tryT('d5', x => d5Free(x, Ds) && thOutOK(Ds) && d5Dep(Ds));   // どれも取れなければ上の線(4・5番線)に入れて、そこから折り返す
          } else { tryT('d5', x => d5Free(x, Ds)); tryT('mid', x => thInOK(x) && midFree(x, Ds, d)); }   // 下りの始発: 5番線 → 中線
          if (A == null) { if (upSt) midBusy.push([Ds - 60, Ds, d]); stat.skipNA = (stat.skipNA || 0) + 1; (list.dhSkip = list.dhSkip || []).push('成田 送り込み ' + d.no + ' ' + D + ' ' + d.names[1] + ' 走れる' + cands.filter(run).length + ' 中線' + cands.filter(x => midFree(x, Ds, d)).length + ' ポイント' + cands.filter(thInOK).length); continue; }
          (trk === 'mid' ? midBusy : trk === 'u1' ? u1Busy : d5Busy).push([A, Ds]); if (trk !== 'd5') addIn(A); dnArr.push(A);
          const dh = mk(d, [evS(DH_ST, A - RS - 55, A - RS), evS(NA, A, A + 25)], null); dh.dhCat = undefined; ttSchedule(dh); addProf(dh); dh.next = d; d.prev = dh;
          if (trk === 'u1') { dh.naU1 = true; stat.naU1 = (stat.naU1 || 0) + 1; } if (trk === 'd5' && upSt) { dh.naD5 = true; stat.naD5 = (stat.naD5 || 0) + 1; } if (trk === 'mid' && !upSt) dh.naMidIn = true; stat.na = (stat.na || 0) + 1; }
        // 引き上げ: 京成成田 → 宗吾参道。到着の100秒後〜20分後に出る(3分後ごろを優先)。それまでは着いたホームで待つ
        // 引き上げも同じ: 決まる前の仮の予約(到着後6分)を外し、着いた順に実際に使う時間だけを入れる(見送ったものは到着後1分だけ)
        for (let i = midBusy.length - 1; i >= 0; i--) if (midBusy[i][3] === 2 && !midBusy[i][2].next) midBusy.splice(i, 1);
        for (const a of (arr.get(NA) || []).slice().sort((x, y) => tArr(x) - tArr(y))) { yield; if (a.next || a.exitEnd || a.dh || a.swapOut) continue;
          const T0 = tArr(a), Ta = T0 * 60 + 30, run = x => !ordLine(NA, DH_ST, x, x + RS) && thOutOK(x) && sgEndOK(x + RS), nx = opsNx(a), cands = near(Ta + envN('DH_NAMO', 60), Ta + 1200, nx && nx.names[0] === SK && !nx.prev ? Ta + 100 : Ta + 180); let P = null;   // 次が京成佐倉始発なら、なるべく早く出る
          // 下りのライナーは上の線(4番線)に着く: 次の下り列車が来る前に出る。間に合わないときは中線に着けて待つ
          if (a.type === 'liner' && west(a.names[a.names.length - 2])) { for (const x of near(Ta + 60, Ta + envN('DH_NAL', 2400), Ta + 180)) if (run(x) && d5Free(Ta - 30, x, a, true) && d5Dep(x) && divOK(Ta, x)) { P = x; d5Busy.push([Ta - 30, P]); divDo(Ta, x); break; } if (P == null) a.naMid = true; }   // 上の線にいる間は、ほかの列車を入れない
          if (P == null && (!west(a.names[a.names.length - 2]) || thInOK(Ta))) for (const x of cands) if (run(x) && midFree(Ta, x, a)) { P = x; midBusy.push([Ta, P]); break; }   // 西から中線へ入るときは、宗吾参道側のポイントで出ていく列車と交差しない
          // 中線がふさがっている: 1番線(上り本線)に着けて、上りの列車が来る前に出る。西から来た列車は上の線(4・5番線)でもよい
          const fromW = west(a.names[a.names.length - 2]);
          if (P == null && (!fromW || thInOK(Ta))) for (const x of cands) if (run(x) && u1Free(Ta - 30, x, a) && u1Clear(Ta - 30, x, a)) { P = x; u1Busy.push([Ta - 30, P]); a.naMid = false; a.naU1 = true; stat.naU1 = (stat.naU1 || 0) + 1; break; }
          if (P == null && a.type !== 'liner' && fromW) for (const x of cands) if (run(x) && d5Free(Ta - 30, x) && d5Dep(x)) { P = x; d5Busy.push([Ta - 30, P]); a.naD5 = true; stat.naD5 = (stat.naD5 || 0) + 1; break; }
          if (P == null) { a.naMid = false; if (!fromW) midBusy.push([Ta - 30, Ta + 60, a]); stat.skipNA = (stat.skipNA || 0) + 1; (list.dhSkip = list.dhSkip || []).push('成田 引き上げ ' + a.no + ' ' + T0 + ' ' + a.names[a.names.length - 2] + ' 前後' + cands.filter(x => !ordLine(NA, DH_ST, x, x + RS)).length + ' ポイント' + cands.filter(thOutOK).length + ' 中線' + cands.filter(x => midFree(Ta, x, a)).length); continue; }   // 回送を付けない: いつものホームに着いて消える
          addOut(P);
          // 同じ運用の次の列車が京成佐倉始発(運用表では駅が変わってつながる): 宗吾参道で少し止まって時機を見てから、京成佐倉のいちばん下の線へ入る
          const id = a.ops && a.ops.id, sgA = P + RS, d2 = id && stByName.has(SK) ? list.filter(x => x.ops && x.ops.id === id && !x.prev && !x.dh && x.names[0] === SK && tDep(x) * 60 >= sgA + RK + 60 && tDep(x) <= T0 + 90).sort((x, y) => tDep(x) - tDep(y))[0] : null;
          if (d2) { const lim = tDep(d2) * 60 - 60; let dp = null; for (let w = 0; w <= 1500 && sgA + w + RK <= lim; w += 20) if (!ordLine(NA, SK, P, sgA + w + RK) && (w || !ordLine(NA, DH_ST, P, sgA)) && !ordLine(DH_ST, SK, sgA + w, sgA + w + RK) && skFree(sgA + w + RK, tDep(d2) * 60, d2)) { dp = sgA + w; break; }   // 間に合わなければ宗吾参道は止まらずに通る
            if (dp != null) { const dh = mk(a, [evS(NA, P - 60, P), dp === sgA ? thru(DH_ST, sgA) : evS(DH_ST, sgA, dp), evS(SK, dp + RK, dp + RK + 25)], null); dh.dhCat = undefined; ttSchedule(dh); addProf(dh); a.next = dh; dh.prev = a; dh.next = d2; d2.prev = dh; skEnd(dh);
              stat.na = (stat.na || 0) + 1; stat.toSK = (stat.toSK || 0) + 1; continue; } }
          const dh = mk(a, [evS(NA, P - 60, P), evS(DH_ST, P + RS, P + RS + 25)], null); dh.dhCat = undefined; ttSchedule(dh); addProf(dh); a.next = dh; dh.prev = a; sgEnd.push(P + RS); stat.na = (stat.na || 0) + 1; } } }
    // ----- 京成上野: スカイライナーは京成高砂の車庫(高砂検車区)にも出入りする -----
    //  前の運用の無い上野始発のライナーは高砂から回送で来る。次の運用の無い上野止まりのライナーは高砂へ回送で戻る(青砥・日暮里は通過)
    { const UE = '京成上野', RUN_UE = 14, s = stByName.get(UE), es = s ? [...new Set(s.stops.map(([x]) => x))].sort((x, y) => yOf(x) - yOf(y)) : [];
      const RUNS = [RUN_UE, 16, 18, 20, 22, 24, 26, 28];   // 走る分。前を走る普通を追い抜かないよう、取れなければゆっくり走る
      const evU = (m0, rev, run) => { if (run !== RUN_UE) { const pT = P1.get(TAKA), pU = P1.get(UE), fr = n => (P1.get(n) - pT) / (pU - pT), s0 = m0 * 60 + 5, s1 = (m0 + run) * 60 + 30, at = n => rev ? s0 + (s1 - s0) * (1 - fr(n)) : s0 + (s1 - s0) * fr(n);
          return rev ? [evS(UE, s0 - 55, s0), thru('日暮里', at('日暮里')), thru('青砥', at('青砥')), evS(TAKA, s1, s1 + 25)] : [evS(TAKA, s0 - 55, s0), thru('青砥', at('青砥')), thru('日暮里', at('日暮里')), evS(UE, s1, s1 + 25)]; }
        const l = [{ name: TAKA, arr: m0, dep: m0 }, { name: '青砥', arr: m0 + 2, dep: m0 + 2, thru: true }, { name: '日暮里', arr: m0 + run - 4, dep: m0 + run - 4, thru: true }, { name: UE, arr: m0 + run, dep: m0 + run }];
        return rev ? l.reverse().map((e, i) => { const t = m0 + run - (e.arr - m0); return Object.assign({}, e, { arr: t, dep: t }); }) : l; };
      // どの時刻でも取れないとき(朝のラッシュなど): 前を走る列車のすぐ後ろ(各駅で90秒あと)に付いて走る。lo〜hi = 上野に着く(送り込み)・上野を出る(引き上げ)秒の範囲
      const GAPF = envN('DH_GF', 80), MGF = envN('DH_MF', 75), MGR = envN('DH_MR', 50), ueIn = [];   // ueIn = 上野へ送り込む回送 [線, 着く分]
      const follow = (down, lo, hi, okU, ex, tm) => {   // tm = 上野で隣の線に着く列車との余裕(秒。違う線に入るときだけ)   // ex = 最後の1区間(上野の手前)をゆっくり走って遅らせる秒(着くホームが空くのを待つ)
        const pT = P1.get(TAKA), pU = P1.get(UE), dir = Math.sign(down ? pT - pU : pU - pT), l0 = Math.min(pT, pU), h0 = Math.max(pT, pU); let best = null;
        const sts = OT_LINES[1].filter(n => P1.has(n) && P1.get(n) > l0 - 1e-6 && P1.get(n) < h0 + 1e-6 && stByName.has(n)).sort((x, y) => (P1.get(x) - P1.get(y)) * dir), last = sts.length - 1;
        if (sts[0] !== (down ? UE : TAKA) || sts[last] !== (down ? TAKA : UE)) return null;
        for (const o of prof1) { if (o.dir !== dir || o.lo > l0 + 1e-6 || o.hi < h0 - 1e-6) continue; const xs = sts.map(n => at1(o, P1.get(n))); if (xs.some(x => !x)) continue;
          for (const gp of down ? [GAPF, GAPF - 10] : [GAPF, GAPF - 10, GAPF + 20]) {   // 取れなければ、前の列車との間を10秒詰める(送り込みは20秒広げるのも試す)
          const ts = xs.map((x, k) => k === last ? x[0] + gp + 15 : x[1] + gp);   // 各駅を、前の列車が出た gp 秒あとに通る
          // 途中の駅で合流してきた列車(押上線から青砥へ来る列車など)が前に入ったら、その駅からはその列車の gp 秒あとを通る
          for (let k = 1; k <= last; k++) { let sh = 0; for (const g of prof1) { if (g === o || g.dir !== dir || g.t1 < ts[k] - 900 || g.t0 > ts[k]) continue; const x = at1(g, P1.get(sts[k])); if (!x) continue; const y = k === last ? x[0] + 15 : x[1]; if (y < ts[k] && y > ts[k] - gp) sh = Math.max(sh, y + gp - ts[k]); }
            if (sh) for (let k2 = k; k2 <= last; k2++) ts[k2] += sh; }
          if (ex) ts[last] += ex;
          if (!down && TAKA_STOPS.some(o => o.pl === 3 && o.a < ts[0] - 20 && ts[0] - 70 < o.d)) continue;   // 高砂の車庫からホームへ出てくる間(発車の70〜25秒前)に、北総線へ向かう下りの列車(3番線)がいない
          const u = down ? ts[0] : ts[last];
          if (u < lo || u > hi || (okU && !okU(u)) || (best && Math.abs(u - (down ? lo : hi)) >= Math.abs(best.u - (down ? lo : hi))) || ts.some((t, k) => k && t < ts[k - 1] + 20)) continue;
          // ほかの同じ向きの列車と、どの駅でも MGF 秒以上離れていて、前後が入れ替わらない
          let bad = false; for (const g of prof1) { if (g === o || g.dir !== dir || g.t1 < ts[0] - 300 || g.t0 > ts[last] + 300) continue; let s0 = 0;
            const qa = g.t.names.indexOf('青砥'), oshi = qa >= 0 && [g.t.names[qa - 1], g.t.names[qa + 1]].some(n => n && !P1.has(n));   // 押上線へ出入りする列車: 青砥では上野方面と線が分かれる(同時に入って同時に出られる)ので、青砥では比べない
            for (let k = 0; k <= last && !bad; k++) { if (oshi && sts[k] === '青砥') continue; const x = at1(g, P1.get(sts[k])); if (!x) continue;
              // 待避線で待っている普通(スカイライナーに抜かれる列車)は、止まっている間に追い抜いてよい
              if (k && k < last && s0 >= 0 && x[1] - x[0] >= 90 && ts[k] > x[0] + 25 && ts[k] < x[1] - 30) { const q = g.t.names.indexOf(sts[k]), e = q >= 0 ? g.t.ev[q] : null; if (e && (e.ot || e.wait)) { s0 = -1; continue; } }
              // 後ろから来る列車がこの駅に止まるなら、着く MGR 秒前に通り過ぎればよい(止まる列車は減速して入ってくる)
              const q2 = k ? g.t.names.indexOf(sts[k]) : -1, mA = tm && k === last ? tm : q2 >= 0 && !g.t.ev[q2].thru && x[1] > x[0] ? MGR : MGF;
              const sg = ts[k] < (k === 0 ? x[1] : x[0]) - mA ? -1 : ts[k] > (k === last ? x[0] : x[1]) + MGF ? 1 : 0; if (!sg || (s0 && sg !== s0)) bad = true; s0 = sg || s0; }
            if (bad) break; }
          if (!bad) { best = { u, sts, ts }; break; } } }
        return best; };
      const evF = c => c.sts.map((n, k) => k === 0 ? evS(n, c.ts[0] - (n === TAKA ? 25 : 55), c.ts[0]) : k === c.sts.length - 1 ? evS(n, c.ts[k], c.ts[k] + 25) : thru(n, c.ts[k]));
      if (P1 && P1.has(UE) && P1.has(TAKA) && stByName.has('青砥') && stByName.has('日暮里')) {
        for (const d of (dep.get(UE) || []).slice().sort((x, y) => tDep(x) - tDep(y))) { yield; if (d.prev || d.dh || d.type !== 'liner') continue;
          const D = tDep(d); let m = null, run = 0; for (const r of RUNS) { for (const x of r === RUN_UE ? [6, 5, 7, 8, 9, 10, 12, 14, 16, 18, 20, 22, 25, 28, 30] : [6, 5, 7, 8, 9, 10, 12, 14]) if (!ordLine(TAKA, UE, (D - x - r) * 60 + 5, (D - x) * 60 + 30)) { m = D - x; run = r; break; } if (m != null) break; }
          // 取れなければ、上野の手前をゆっくり走って、空いたライナーのホームに入る(着いてから発車まで、そのホームにほかの列車がいないこと)
          const fE = u => { const m0 = Math.floor(u / 60); return es.length === 4 && [es[1], es[2]].some(e => !(arr.get(UE) || []).some(a => a.forceEnd === e && tArr(a) <= D && m0 <= (a.next ? tDep(a.next) : tArr(a) + 1)) && !ueIn.some(([e2, m2, d2]) => e2 === e && m2 <= D && m0 <= d2)); };
          let fc = m == null ? follow(false, (D - 14) * 60, (D - 3) * 60) : null; for (const ex of [60, 90, 120, 150]) if (m == null && !fc) { yield; fc = follow(false, (D - 14) * 60, (D - 3) * 60, fE, ex); }
          // それでも取れなければ、1・4番線(普通のホーム)に着けて待つ。その間にその線へ着く普通は、空いているほかの線へ回す
          let mv = null; if (m == null && !fc && es.length === 4) { const ue = arr.get(UE) || [], stay = x => [tArr(x), x.next ? tDep(x.next) : tArr(x) + 1];
            const freeF = (f, a0, b0, skip) => !ue.some(y => y !== skip && y.forceEnd === f && stay(y)[0] <= b0 && a0 <= stay(y)[1]) && !ueIn.some(([e2, m2, d2]) => e2 === f && m2 <= b0 && a0 <= d2);
            const plan = (e, m0) => { if (ue.some(y => y.forceEnd === e && stay(y)[0] <= m0 && m0 <= stay(y)[1])) return null; const mvs = [];
              for (const y of ue.filter(y => y.forceEnd === e && stay(y)[0] > m0 && stay(y)[0] <= D)) { const [a0, b0] = stay(y), f = [es[2], es[1], es[0], es[3]].find(f => f !== e && freeF(f, a0, b0, y) && !mvs.some(([z, g2]) => g2 === f && stay(z)[0] <= b0 && a0 <= stay(z)[1])); if (f == null) return null; mvs.push([y, f]); }
              return mvs; };
            for (const e of [es[0], es[3]]) { yield; fc = follow(false, (D - 14) * 60, (D - 3) * 60, u => !!plan(e, Math.floor(u / 60)), 0, 30); if (fc) { mv = { e, l: plan(e, Math.floor(fc.u / 60)) }; break; } } }
          if (fc) { m = Math.floor(fc.u / 60); stat.ueF = (stat.ueF || 0) + 1; }
          if (m == null) { stat.skipUE = (stat.skipUE || 0) + 1; (list.dhSkip = list.dhSkip || []).push('上野 送り込み ' + d.no + ' ' + D); continue; }
          const dh = mk(d, fc ? evF(fc) : evU(m - run, false, run), null); dh.dhCat = undefined; ttSchedule(dh); addProf(dh); dh.next = d; d.prev = dh; stat.ue = (stat.ue || 0) + 1;
          if (mv) { dh.forceEnd = mv.e; ueIn.push([mv.e, m, D]); for (const [y, f] of mv.l) y.forceEnd = f; stat.ueSwap = (stat.ueSwap || 0) + 1; continue; }
          // 着く線: ライナーのホーム(2・3番線)、ふさがっていれば1・4番線。着いてから発車まで、ほかの列車・送り込みの回送がいないこと
          if (es.length === 4) { const busy = e => (arr.get(UE) || []).some(a => a.forceEnd === e && tArr(a) <= D && m <= (a.next ? tDep(a.next) : tArr(a) + 1)) || ueIn.some(([e2, m2, d2]) => e2 === e && m2 <= D && m <= d2); const e = [es[1], es[2], es[0], es[3]].find(e => !busy(e)); if (e != null) { dh.forceEnd = e; ueIn.push([e, m, D]); } } }
        for (const a of (arr.get(UE) || []).slice().sort((x, y) => tArr(x) - tArr(y))) { yield; if (a.next || a.dh || a.type !== 'liner') continue;
          // 着く線(a.forceEnd)に次の列車がすぐ来て出る時間が無いときは、着いた時に空いていて長く空いている別の線(ライナーのホーム、なければ1・4番線)に着ける
          const T0 = tArr(a), occ = e => (arr.get(UE) || []).some(x => x !== a && x.forceEnd === e && tArr(x) <= T0 + 1 && (x.next ? tDep(x.next) : tArr(x) + 1) >= T0 - 1) || ueIn.some(([e2, m2, d2]) => e2 === e && m2 <= T0 + 1 && d2 >= T0 - 1);
          const nxOf = e => Math.min(...(arr.get(UE) || []).filter(x => x !== a && x.forceEnd === e && tArr(x) > T0).map(tArr), ...ueIn.filter(([e2, m2]) => e2 === e && m2 > T0).map(([, m2]) => m2), Infinity);   // 同じ線に次の列車・送り込みの回送が着く前に出る
          let m = null, run = 0, fc = null, nxA = nxOf(a.forceEnd);
          for (const e of [a.forceEnd, ...(es.length === 4 ? [es[1], es[2], es[3], es[0]] : [])]) { if (e == null || (e !== a.forceEnd && (occ(e) || nxOf(e) < T0 + 8))) continue; yield; const nx = nxOf(e);
            for (const r of RUNS) { for (const y of [4, 5, 3, 6, 7, 8, 9, 10, 12, 14, 16, 18, 20, 22, 25, 28, 31, 34, 37, 40]) if (T0 + y < nx - 1 && !ordLine(UE, TAKA, (T0 + y) * 60 + 5, (T0 + y + r) * 60 + 30)) { m = T0 + y; run = r; break; } if (m != null) break; }
            fc = m == null ? follow(true, (T0 + 3) * 60, Math.min(T0 + envN('DH_UO', 20), nx - 1) * 60) : null; if (fc) { m = Math.floor(fc.u / 60); stat.ueF = (stat.ueF || 0) + 1; }
            if (m != null) { if (e !== a.forceEnd) { a.forceEnd = e; stat.ueMove = (stat.ueMove || 0) + 1; } nxA = nx; break; } }
          if (m == null) { stat.skipUE = (stat.skipUE || 0) + 1; (list.dhSkip = list.dhSkip || []).push('上野 引き上げ ' + a.no + ' ' + T0 + ' 次の到着 ' + nxA); continue; }
          const dh = mk(a, fc ? evF(fc) : evU(m, true, run), null); dh.dhCat = undefined; ttSchedule(dh); addProf(dh); a.next = dh; dh.prev = a; stat.ue = (stat.ue || 0) + 1; } } }
    // 見送った回送について、候補の時刻がどの条件で落ちたかを数える(調査用): pen=成田空港のホーム・単線、ord=空港第2ビルでの前後、line=京成成田〜成田空港の前後、na=京成成田での待ち合わせ
    if (typeof process !== 'undefined' && process.env.DH_DIAG) list.dhDiag = jobs.filter(j => j.kind !== 'fix' && !(j.kind === 'in' ? j.d.prev : j.a.next)).map(j => { const c = { pen: 0, ord: 0, line: 0, na: 0, ok: 0 }, v0 = j.v, cats = j.kind === 'out' && j.cat === 'access' ? ['access', 'liner'] : [j.cat];
      const Ds = j.kind === 'in' ? dSec(j.d) : 0, Ta = j.kind === 'out' ? aSec(j.a) : 0;
      for (const x of j.kind === 'in' ? near(Ds - WI, Ds - MI, Ds - PI) : near(Ta + MO, Ta + WO, Ta + PO)) { const sI = j.kind === 'in' ? [x - SW, x] : null, sO = j.kind === 'out' ? [x, x + SW] : null; let pm = 99;
        for (const cc of cats) for (const k of ks(cc)) pm = Math.min(pm, pen({ cat: cc, k, ta: j.kind === 'in' ? x : Ta, td: j.kind === 'in' ? Ds : x }, sI, sO, v0));
        if (pm) { let pb = 99; for (const cc of cats) for (const k of ks(cc)) pb = Math.min(pb, pen({ cat: cc, k, ta: j.kind === 'in' ? x : Ta, td: j.kind === 'in' ? Ds : x }, null, null, v0)); const ps = pen({ cat: 'access', k: 9, ta: 0, td: 0 }, sI, sO, v0); if (pb) c.berth = (c.berth || 0) + 1; if (ps) c.single = (c.single || 0) + 1; }
        if (pm) c.pen++; else if (j.kind === 'in' ? ordPen(prof.d, [null, null, x - T2, x]) : ordPen(prof.u, [null, null, x + T2, x])) c.ord++; else if (!(j.kind === 'in' ? planIn(j.cat, x, v0.sIn, false) : planOut(j.cat, x, v0.sOut, false, j.ib))) c.na++; else c.ok++; }
      return Object.assign({ kind: j.kind, no: (j.a || j.d).no, cat: j.cat, type: (j.a || j.d).type, t: j.t }, c); });
    list.dhStat = stat; list.dhJobs = jobs.map(j => ({ kind: j.kind, no: (j.a || j.d).no, cat: j.cat, k: j.v.k, m: j.v.m, skip: !!j.skip, pen: pen(j.v, j.v.sIn, j.v.sOut, j.v), op: j.v.op || 0, ta: j.v.ta, td: j.v.td }));
  }
  ttUserOps(list);
  let n = 0;
  for (const a of list) {
    const d = a.next; if (!d) continue;
    n++;
    // 到着した列車はすぐ次の列車に切り替わり、発車時刻までホームで待つ
    const at = a.A[a.A.length - 1];
    a.end = Math.min(a.end, Math.max(at + 3, d.P[0] - 12));
    d.A[0] = a.end; d.start = a.end; d.P[0] = Math.max(d.P[0], a.end + 8);
  }
  return n;
}
// ===== 品川の番線の使い方 =====
//  1番線: 横浜方面(下り)  2番線: 泉岳寺方面と品川止まり(下りは出ない)  3番線(一番下・泉岳寺側は行き止まり): 品川止まりの普通がそのまま下りの普通に折り返す・ウィング号の降車
// 品川止まりは引上線へ上げてから1番線に入れて折り返す
// 車庫へ出入りできる終着駅。ここでは運行番号が同じ列車どうしをつなぎ、折り返しまで長くあく車両はいったん車庫の線へ入れる
const DEPOT_ST = new Set(['西馬込', '京成高砂', '京成津田沼', '京成臼井', '宗吾参道', '印旛日本医大', '金沢文庫']), DEPOT_MAX = 240;
const SHINA = '品川', SHINA_TURN = 4, SHINA_AM = 10 * 60;
const NOREV = new Set([SHINA, '泉岳寺', '青砥', '京成高砂']);
// 京成・北総の途中駅も、ホームでそのまま折り返すと逆線を走ることになるので同じ扱い(行き止まりの終着駅は除く)
const noRev = nm => NOREV.has(nm) || (!TERMINI.has(nm) && stByName.has(nm) && stByName.get(nm).stops.length > 0 && N[E[stByName.get(nm).stops[0][0]].a].y > KS_Y);   // ホームでそのまま逆向きに折り返せない駅(引上線を使う)
let SHINA_E = null;
function ttAllowShina(t) {
  if (!SHINA_E) { const l = stByName.get(SHINA).stops.map(([e]) => e).sort((a, b) => N[E[a].a].y - N[E[b].a].y); SHINA_E = l.length === 3 ? l : []; }
  if (!SHINA_E.length) return null;
  const q = t.names.indexOf(SHINA);
  if (q < 0) return null;
  const n = t.names.length, down = q < n - 1 ? t.names[q + 1] !== '泉岳寺' : q > 0 && t.names[q - 1] === '泉岳寺';   // 泉岳寺から来て品川止まりの列車も下り(1番線)
  const p3 = q === n - 1 && (t.type === 'local' || t.type === 'wing');
  return (i, e) => i !== q || (t.sh3 ? e === SHINA_E[2] : down ? e === SHINA_E[0] : e === SHINA_E[1] || (p3 && e === SHINA_E[2]));   // sh3 = 3番線で折り返す(着く列車と、折り返して出る列車)
}
// ===== 京成高砂の番線の使い方 =====
//  1番線: 京成本線(小岩方)から来る上り   2番線: 北総線から来る上り・当駅始発の上り
//  3番線: 北総線・成田スカイアクセス線へ行く下り、京成本線へ行く優等列車   4番線: 京成本線へ行く普通・当駅止まり(車庫へ入る列車)
//  図では上から 4・3・2・1番線。どれも「基本」で、ふさがっているときは同じ方向のもう一方の番線を使う
const TAKA = '京成高砂';
let TAKA_E = null;
function takaPref(t, q) {
  const n = t.names.length, prev = q > 0 ? t.names[q - 1] : null, next = q < n - 1 ? t.names[q + 1] : null;
  const hokuso = x => x === '根古屋信号場' || (OT_LINES[2].indexOf(x) > OT_LINES[2].indexOf(TAKA) && ((x !== NRT && x !== NRT2) || ksVia(t) === 'access'));   // 根古屋信号場(アクセス線の回送が止まる)も北総線側
  const west = x => { const k = OT_LINES[1].indexOf(x); return k >= 0 && k < OT_LINES[1].indexOf(TAKA); };   // 高砂を通過する列車は、次の停車駅が青砥とは限らない
  const up = next ? west(next) : !west(prev);   // 上り = 青砥方面へ向かう。当駅止まりは来た方向で決める
  // [基本の番線, ふさがっているときの番線]。1線に2本入れるより、基本と違う番線を使うほうを優先する
  let ok;
  // 上りは行き先で決まる(どこから来たかは関係ない): 京成上野方面=中線(2番線)、押上方面=外線(1番線)。青砥でも同じ並びになり、同時に入って同時に出る
  const L2 = OT_LINES[2], toOshiage = t.names.slice(q + 1).some(x => { const k = L2.indexOf(x); return k >= 0 && k < L2.indexOf('青砥'); });
  if (up) ok = toOshiage ? [1, 1] : [2, 2];
  else ok = !next ? [4, 3] : hokuso(next) ? [3, 4] : [4, 3];   // 下り: 3番線=北総線・成田スカイアクセス線、4番線=京成本線(種別によらない)

  return ok;
}
// 停車列車が実際に入る番線: 基本の番線。ただし高砂で(停車する列車に)抜かれるときは、抜く列車の番線を空けて隣へ(隣に同時に止まる列車がいれば移らない)
function takaPlat(t, q) {
  let ok = takaPlatA(t, q);
  // 自分が抜く相手が基本の番線に止まったまま(隣へ移れなかった)なら、抜く側が隣の番線に入る。
  // 待避でなくても、同じ番線に長く止まっている列車の停車中に着いて先に出る(または当駅止まりで車庫へ引き上げる)場合も同じ
  const k = q + t.k0, other = { 1: 2, 2: 1, 3: 4, 4: 3 }[ok[0]];
  const inWay = o => { if (o.t === t) return false; const qo = o.t.names.indexOf(TAKA); if (qo < 0) return false; const by = o.t.ev[qo].otBy; return ((!!by && by.includes(t)) || (o.a < t.A[k] && o.d > t.P[k])) && takaPlatA(o.t, qo)[0] === ok[0]; };   // o.a・o.d は時刻表どおりの停車時間(折り返し待ちで前の列車の到着まで延ばした分は含めない)
  if (TAKA_STOPS.some(inWay) && !TAKA_STOPS.some(o => o.t !== t && !inWay(o) && o.pl === other && o.a < t.P[k] + 20 && t.A[k] < o.d + 20)) ok = [other, other];
  return ok;
}
function takaPlatA(t, q) {
  let ok = takaPref(t, q);
  const by = t.ev[q].otBy && t.ev[q].otBy.filter(b => { const k = b.names.indexOf(TAKA); return !(k >= 0 && b.ev[k].thru); });
  if (by && by.length) { const bp = new Set(by.map(b => { const k = b.names.indexOf(TAKA); return k < 0 ? 0 : takaPref(b, k)[0]; })), other = { 1: 2, 2: 1, 3: 4, 4: 3 }[ok[0]];
    const k = q + t.k0, busy = TAKA_STOPS.some(o => o.t !== t && o.pl === other && o.a < t.P[k] + 20 && t.A[k] < o.d + 20);
    if (bp.has(ok[0]) && !bp.has(other) && !busy) ok = [other, other]; else if (bp.has(ok[1]) && ok[1] !== ok[0]) ok = [ok[0], ok[0]]; }
  return ok;
}
function ttAllowTaka(t) {
  if (TAKA_E === null) { const s = stByName.get(TAKA), l = s ? [...new Set(s.stops.map(([e]) => e))].sort((a, b) => N[E[a].a].y - N[E[b].a].y) : []; TAKA_E = l.length === 4 ? { 4: l[0], 3: l[1], 2: l[2], 1: l[3] } : false; }
  if (!TAKA_E) return null;
  const q = t.names.indexOf(TAKA);
  if (q < 0) return null;
  let ok;
  if (t.ev[q].thru) {   // 通過列車: 基本の線に列車が止まっていて、隣の線が空いているなら隣を通る
    ok = takaPref(t, q);
    const x = t.A[q + t.k0], o2 = { 1: 2, 2: 1, 3: 4, 4: 3 }[ok[0]];
    const on = pl => TAKA_STOPS.some(s => { if (s.t === t) return false; const k = s.t.names.indexOf(TAKA); if (k < 0) return false; const kk = k + s.t.k0; return x > s.t.A[kk] - 30 && x < s.t.P[kk] + 30 && takaPlat(s.t, k)[0] === pl; });
    if (on(ok[0]) && !on(o2)) ok = [o2, o2];
  } else ok = takaPlat(t, q);
  const set = new Set(ok.map(k => TAKA_E[k]));
  t.taka = { q, pref: TAKA_E[ok[0]], alt: TAKA_E[ok[1]] };   // 基本の番線が空いている間は、もう一方へ入れない
  return (i, e) => i !== q || set.has(e);
}
// ===== 成田空港・空港第2ビルの番線の使い方 =====
//  空港第2ビル: 1・2番線(成田空港寄りの半分)=成田スカイアクセス線、 3・4番線(上野寄りの半分)=京成本線
//  成田空港: 1番線(いちばん下の線路)=アクセス特急、 2・3番線(島式ホームの上野寄り)=京成本線、 4・5番線(車止め側)=スカイライナー
const NRT = '成田空港', NRT2 = '空港第2ビル';
// 京成成田始発への送り込み回送のうち、着く分と線を個別に決めたもの(ユーザー指定)。キー = 列車番号@発車の分
//  平日7:35〜7:40ごろ: 65K運用(764K 7:40発)は中線へ7:34着、87K運用(786K 7:45発)は1番線へ7:40着。どちらも1分早く入れて、たがいに重ならないようにする
const NA_DH_FIX = { wd: { '764K@460': { m: 454, u1: false }, '786K@465': { m: 460, u1: true } } };
const DH_ST = '宗吾参道', DH_RUN = [13, 8, 2];   // 回送が成田空港から 宗吾参道・京成成田・空港第2ビル まで走る分(止まらない)
const KS_MAINONLY = new Set(['京成成田', '公津の杜', '宗吾参道', '京成佐倉', '京成津田沼', '京成船橋', '京成八幡']);
const ksVia = t => t.names.some(n => KS_MAINONLY.has(n)) ? 'main' : 'access';
const nrtCat = t => t.dhCat || (t.type === 'liner' ? 'liner' : ksVia(t));   // 回送(dhCat)は、つながる営業列車と同じホームを使う
let NRT_E = null;
function nrtEdges() {
  if (NRT_E === null) {
    const uniq = nm => { const s = stByName.get(nm); return s ? [...new Set(s.stops.map(([e]) => e))] : []; };
    const mx = e => (N[E[e].a].x + N[E[e].b].x) / 2, avg = l => l.reduce((m, e) => m + mx(e), 0) / l.length;
    const a = uniq(NRT), b = uniq(NRT2);
    if (a.length === 5 && b.length === 4) {
      const low = Math.max(...a.map(e => N[E[e].a].y)), isl = a.filter(e => N[E[e].a].y < low), xa = avg(isl), xb = avg(b);
      NRT_E = { liner: isl.filter(e => mx(e) > xa), main: isl.filter(e => mx(e) < xa), access: a.filter(e => N[E[e].a].y === low), b_access: b.filter(e => mx(e) > xb), b_main: b.filter(e => mx(e) < xb) };
    } else NRT_E = false;
  }
  return NRT_E;
}
function ttAllowNarita(t) {
  const g = nrtEdges(); if (!g) return null;
  const q1 = t.names.indexOf(NRT), q2 = t.names.indexOf(NRT2);
  if (q1 < 0 && q2 < 0) return null;
  const s1 = new Set(g[nrtCat(t)]), s2 = new Set(ksVia(t) === 'access' ? g.b_access : g.b_main);
  return (i, e) => (i !== q1 || (t.nrtE != null && i === 0 ? e === t.nrtE : s1.has(e))) && (i !== q2 || s2.has(e));   // nrtE = 回送で入らない始発の線(回送の計算で選んだもの)
}
// ===== 八広の番線の使い方 =====
//  外側の2線が上り・下りの本線、中線は上下共用の待避線(抜かれる列車だけが入る)
const MIDLOOP = ['八広', '小室'], MIDLOOP_E = {};
function ttAllowMid(t, ST_) {
  if (MIDLOOP_E[ST_] === undefined) { const s = stByName.get(ST_), l = s ? [...new Set(s.stops.map(([e]) => e))].sort((a, b) => N[E[a].a].y - N[E[b].a].y) : []; MIDLOOP_E[ST_] = l.length === 3 ? l : false; }
  const Y = MIDLOOP_E[ST_]; if (!Y) return null;
  const q = t.names.indexOf(ST_);
  if (q <= 0 || q >= t.names.length - 1) return null;
  const L = OT_LINES[2], e = t.ev[q], k1 = L.indexOf(t.names[q + 1]), k0 = L.indexOf(t.names[q - 1]), kq = L.indexOf(ST_);
  const down = k1 >= 0 ? k1 > kq : k0 >= 0 ? k0 < kq : true;
  const wait = !e.thru && (e.ot || e.wait || e.dep - e.arr >= 2);
  const want = wait ? Y[1] : down ? Y[0] : Y[2];
  return (i, ed) => i !== q || ed === want;
}
// ===== 青砥の下りホームの使い方 =====
//  どこから来たかではなく、この先どちらへ進むかで決まる: 3番線(北側)=京成本線方面、4番線(南側)=北総線・成田スカイアクセス線方面。ふさがっていればもう一方
const AOTO = '青砥';
let AOTO_E = null;
function ttAllowAoto(t) {
  if (AOTO_E === null) { const s = stByName.get(AOTO), l = s ? [...new Set(s.stops.map(([e]) => e))].filter(e => E[e].dir === 1).sort((a, b) => N[E[a].a].y - N[E[b].a].y) : []; AOTO_E = l.length === 2 ? l : false; }
  t.aoto = null;
  if (!AOTO_E) return null;
  const q = t.names.indexOf(AOTO);
  if (q < 0 || q >= t.names.length - 1) return null;
  const L1 = OT_LINES[1], L2 = OT_LINES[2], after = t.names.slice(q + 1);
  const east = x => L1.indexOf(x) > L1.indexOf(AOTO) || L2.indexOf(x) > L2.indexOf(AOTO);
  if (!east(after[0])) return null;   // 上り
  const hokuso = after.some(x => L2.indexOf(x) > L2.indexOf(TAKA) && ((x !== NRT && x !== NRT2) || ksVia(t) === 'access'));
  const main = after.some(x => L1.indexOf(x) > L1.indexOf(TAKA) && ((x !== NRT && x !== NRT2) || ksVia(t) === 'main'));
  if (!hokuso && !main) return null;   // 高砂止まりはどちらでも
  const ok = hokuso ? [AOTO_E[1], AOTO_E[0]] : [AOTO_E[0], AOTO_E[1]], set = new Set(ok);
  t.aoto = { q, pref: ok[0], alt: ok[1] };
  return (i, e) => i !== q || set.has(e);
}
// 根古屋信号場: 止まって待つ列車は待避線へ(まっすぐな線はスカイライナーが通る)
function ttAllowNekoya(t) {
  t.nk = null;
  const s = stByName.get('根古屋信号場'); if (!s) return null;
  const q = t.names.indexOf(s.name); if (q < 0) return null;
  const want = t.ev[q].sid === false ? s.sigStraight : s.sigSiding;
  return (i, e) => i !== q || e === want;
}
// ===== 京成成田の番線の使い方 =====
//  図の下の線 = 1番線(上り本線)   中線 = 2・3番線(上りの副本線)   上の線 = 4・5番線(下り本線。4番線は降車専用)
//  ・上り: ふつうは1番線(東成田・芝山千代田から来る列車も)。抜かれる列車、3分以上止まる列車は2番線(中線)
//  ・下り: 成田空港・東成田・芝山千代田方面とも5番線。中線へ入るのは、後ろの列車に抜かれるときだけ
//  ・当駅で向きを変えて折り返す列車、モーニングライナーなど当駅始発の上り、待ち合わせる回送は中線
//  ・ライナー: 上りは3番線(中線)、下りの当駅止まりは4番線(上の線の降車専用ホーム)
//  どれも「基本」で、ふさがっていればもう一方(ok = [基本, もう一方])
let NA_E = null;
function ttAllowNa(t) {
  t.na = null;
  if (NA_E === null) { const s = stByName.get('京成成田'), l = s ? [...new Set(s.stops.map(([e]) => e))].sort((a, b) => N[E[a].a].y - N[E[b].a].y) : []; NA_E = l.length === 3 ? l : false; }
  if (!NA_E) return null;
  const q = t.names.indexOf('京成成田'), n = t.names.length; if (q < 0) return null;
  const D5 = NA_E[0], MID = NA_E[1], U1 = NA_E[2];
  const L = OT_LINES[1], kq = L.indexOf('京成成田'), west = nm => { const k = L.indexOf(nm); return k >= 0 && k < kq; };
  const branch = nm => nm === '東成田' || nm === '芝山千代田', liner = t.type === 'liner';
  let ok = null;
  if (q > 0 && q < n - 1) {   // 途中駅として通る
    const fromW = west(t.names[q - 1]), toW = west(t.names[q + 1]); if (fromW === toW) return null;
    const e = t.ev[q], dwell = e.dep - e.arr, held = !e.thru && (e.ot || e.wait || (t.dh && dwell >= 1));
    if (fromW) ok = held || t.naDiv ? [MID, D5] : [D5, MID];   // naDiv = 上の線でライナーが待っているので中線を通る
    else ok = held || (!e.thru && dwell >= 3) || (liner && !e.thru) ? [MID, U1] : [U1, MID];   // 上りのライナーは3番線(中線の反対側のホーム)。東成田・芝山千代田から来る上りも、長く止まらなければ1番線
  } else if (q === n - 1 && q > 0 && t.next) {   // 当駅止まりで、次の列車(折り返し・回送)になる
    const fromW = west(t.names[q - 1]), nx = t.next, back = nx.names[0] === '京成成田' && nx.names.length > 1 && west(nx.names[1]) === fromW;
    if (liner && fromW && !t.dh) ok = t.naU1 ? [U1, MID] : t.naMid ? [MID, D5] : [D5, MID];   // 下りのライナーは4番線(上の線の降車専用ホーム)に着く
    else if (t.dh) ok = back ? (t.naU1 ? [U1, MID] : t.naD5 ? [D5, MID] : [MID, D5]) : (t.naMidIn ? [MID, D5] : [D5, MID]);   // 宗吾参道から来た回送: 上りの始発になるなら中線で向きを変える(中線が使えないときは1番線へ入る)
    else if (back) ok = fromW ? (t.naU1 ? [U1, MID] : t.naD5 ? [D5, MID] : [MID, D5]) : [MID, MID];         // 向きを変えて戻る: 中線(東側へ戻れるのは中線だけ)
    else { const side = fromW ? D5 : U1, long = nx.ev[0].dep - t.ev[q].arr >= 3 && !(t.naU1 && !fromW); ok = long ? [MID, side] : [side, MID]; }   // そのまま先へ進む: 進む向きの本線。発車まで3分以上あるなら本線をあけて中線で待つ
  } else if (q === 0 && n > 1 && !t.prev) ok = west(t.names[1]) ? [MID, U1] : [D5, MID];   // 前の運用の無い当駅始発
  if (!ok) return null;
  const set = new Set(ok); t.na = { q, pref: ok[0], alt: ok[1] };
  return (i, e) => i !== q || set.has(e);
}
// ===== 宗吾参道の回送の線 =====
//  上から 下り本線・中線(上り本線)・下の線(車庫側)。回送はできるだけ本線をあけて、通常列車が中線を使えるようにする
//  ・車庫から出て京成成田方面へ向かう回送: 上の線(下り本線)から出る。ふさがっていれば下の線
//  ・京成成田方面から来て宗吾参道で止まる回送(車庫へ入る・待ち合わせる)、上野方面へ出る回送: 下の線。ふさがっていれば中線
let SG_E = null;
function ttAllowSg(t) {
  t.sg = null;
  const q = t.dh ? t.names.indexOf('宗吾参道') : -1, n = t.names.length;
  if (q < 0 || n < 2 || t.ev[q].thru) return null;
  if (SG_E === null) { const s = stByName.get('宗吾参道'), l = s ? [...new Set(s.stops.map(([e]) => e))].sort((a, b) => N[E[a].a].y - N[E[b].a].y) : []; SG_E = l.length === 3 ? l : false; }
  if (!SG_E) return null;
  const L = OT_LINES[1], kq = L.indexOf('宗吾参道'), west = nm => { const k = L.indexOf(nm); return k >= 0 && k < kq; };
  const down = q < n - 1 ? !west(t.names[q + 1]) : west(t.names[q - 1]);   // 京成成田方面へ進む
  const ok = down ? [SG_E[0], SG_E[2]] : [SG_E[2], SG_E[1]];
  const set = new Set(ok); t.sg = { q, pref: ok[0], alt: ok[1] };
  return (i, e) => i !== q || set.has(e);
}
function ttAllow(t) {
  const fs = [ttAllowShina(t), ttAllowTaka(t), ttAllowAoto(t), ttAllowNekoya(t), ttAllowNarita(t), ttAllowNa(t), ttAllowSg(t), ...MIDLOOP.map(n => ttAllowMid(t, n))].filter(Boolean);
  return fs.length ? (i, e) => fs.every(f => f(i, e)) : null;
}
// ===== 番線の占有管理つきで、発車の早い列車から順に経路を確定していく =====
function ttPlanner(useSiding) {
  mainThru();
  const res = new Map();   // edge → [[from, to], ...]
  const stat = { siding: 0, moved: 0, couple: 0 };
  const units = [], cplList = [], planned = [];        // 増結車(金沢文庫で連結する4両)
  // 増結する列車が入る番線: 上り(品川方面)に使える内線=3番線 / 外線=4番線
  const cplEdge = side => { const c = stByName.get(COUPLE_ST).stops.map(([e]) => e).filter(e => E[e].lane === (side === 'rear' ? 'in' : 'out') && E[e].dir !== 1).sort((a, b) => E[a].dir - E[b].dir); return c.length ? c[0] : null; };
  const unitCands = new Map();   // 番線 → 増結車が向きを変えずに入れる留置線(近い順)
  const unitRoutes = (e, nextName) => {
    if (unitCands.has(e)) return unitCands.get(e);
    const sx = stByName.get(COUPLE_ST).stops.find(s => s[0] === e)[1], l = [];
    for (const sd of SIDINGS.get(COUPLE_ST) || []) {
      if (N[sd.node].x < sx) continue;   // 車庫のある金沢八景側から出てくる
      const r = buildTimedRoute([COUPLE_ST, nextName], [0, 0], { startAt: { e: sd.e, t: sd.t }, startExtra: true, isFree: (i, f) => i !== 0 || f === e });
      if (!r || r.stopE[0] !== e) continue;
      let last = 0, rev = 0;
      for (const g of r.segs) { if (g.d0 >= r.stopD[1]) break; const s = Math.sign(g.bx - g.ax); if (s && last && s !== last) rev++; if (s) last = s; }
      if (!rev) l.push({ sd, r });
    }
    l.sort((a, b) => a.r.stopD[1] - b.r.stopD[1]);
    unitCands.set(e, l);
    return l;
  };
  function addUnit(t) {
    const c = t.cpl, k = c.i + t.k0, Am = t.A[k], Pm = t.P[k], front = c.side === 'front';
    const cands = unitRoutes(c.e, t.names[c.i + 1]);
    if (!cands.length) { t.cpl = null; return; }
    // 前に付く車両は先にホームで待ち、後ろに付く車両は本体が着いてから入ってくる
    let arrive = Math.max(Am + 20, Math.min(Am + 40, Pm - 45));
    if (front) {   // 前の列車が出たあと、本体が着く少し前に入る
      let busy = -Infinity;
      for (const r of res.get(c.e) || []) if (r[2] !== t && r[0] < Am - 20 && r[1] > busy) busy = r[1];
      arrive = Math.max(Am - 80, Math.min(Am - 15, busy + 10));
    }
    const mvOf = x => Math.max(20, Math.min(50, x.r.stopD[1] / 2));
    const x = cands.find(x => isFreeAt(x.sd.e, arrive - mvOf(x) - 120, arrive, t)) || cands[0];
    const mv = mvOf(x), d = x.r.stopD[1], gap = 6 + COUPLE_LEN / 2;
    const u = { no: t.no, type: t.type, dest: t.dest, cars: 4, len: COUPLE_LEN, unit: true, cplWith: t, tt: true, s: 0, g: null, prev: null, next: null, k0: 0,
      names: [COUPLE_ST], ev: [{ name: COUPLE_ST, arr: Math.floor(arrive / 60), dep: t.ev[c.i].dep }],
      route: Object.assign({}, x.r, { total: d + gap + COUPLE_LEN }), A: [arrive - mv - 120, arrive], P: [arrive - mv, front ? Am + 20 : arrive + 15], off: [0, front ? gap : -gap] };
    u.start = u.A[0]; u.end = u.P[1];
    reserve(x.sd.e, u.start, arrive, t);
    const q = t.names.indexOf('品川');
    c.t0 = u.end; c.t1 = q > c.i && q < t.names.length - 1 ? t.P[q + t.k0] : Infinity; c.unit = u;
    units.push(u); stat.couple++;
  }
  const isFreeAt = (e, a, b, own) => { const l = res.get(e); if (!l) return true; for (const r of l) if (r[0] < b && a < r[1] && r[2] !== own) return false; return true; };
  // 成田空港: 島式ホームの2本の線は、上野寄り(本線の列車)と車止め側(スカイライナー)が同じ線路の縦列。
  //  ・車止め側へ出入りする列車は、その瞬間に上野寄りが空いていないと通れない
  //  ・上野寄りに止まる列車は、止まっている間に奥の列車が出入りしない線を選ぶ
  const nrtFree = (t, i, e) => {
    if (t.names[i] !== NRT) return true;
    const g = nrtEdges(); if (!g) return true;
    const isL = g.liner.includes(e), isM = g.main.includes(e); if (!isL && !isM) return true;
    const p = (isL ? g.main : g.liner).find(x => Math.abs(N[E[x].a].y - N[E[e].a].y) < 1); if (p == null) return true;
    const s = span(t, i), l = (res.get(p) || []).filter(r => r[2] !== t && r[2] !== t.next && r[2] !== t.prev);
    if (isL) return !l.some(r => (r[0] < s[0] + 25 && s[0] - 20 < r[1]) || (r[0] < s[1] + 20 && s[1] - 25 < r[1]));
    return !l.some(r => [r[0] + 5, r[1] - 5].some(m => m > s[0] - 20 && m < s[1] + 20));
  };
  const reserve = (e, a, b, own) => { if (!res.has(e)) res.set(e, []); res.get(e).push([a, b, own]); };
  // 下調べで、どの列車がどの番線を使いそうか(押さえはしない)。途中駅で長く折り返す列車が、あとから来る列車の番線をふさがないようにするのに使う
  const soft = new Map();
  const softFree = (e, a, b, t, np) => !(soft.get(e) || []).some(r => r[0] < b && a < r[1] && r[2] !== t && r[2] !== t.next && r[2] !== t.prev && !(np && r[2].route !== undefined));   // np: もう計画した列車の下調べは見ない(本予約がある)
  const span = (t, i) => {   // i番目の駅でホームを使う時間帯
    const k = i + t.k0, last = i === t.names.length - 1;
    let b = t.P[k] + 5;
    if (last && t.next && !t.tail) b = Math.max(t.next.ev[0].dep * 60 + 5, t.next.ev[0].ds || 0);
    if (t.cpl && i === t.cpl.i) return [t.A[k] - (t.cpl.side === 'front' ? 50 : 5), b + 35];   // 先に入って待つ増結車の分と、12両が出きるまでの分
    return [t.A[k] - 5, b];
  };
  // 下調べ: その番線にしか入れない列車(例: 逗子線から金沢八景に入る列車)の分を先に押さえておく
  const clsOf = t => t.cpl ? (t.cpl.side === 'rear' ? 'in' : 'out') : FAST.has(t.type) ? 'in' : 'out';
  function pre(t) {
    { const st = t.names[t.names.length - 1];   // 運用の編集でつないだ組: 先に計画する列車に引上線を取られないよう、発車前の約3分を押さえておく(plan の最初で外す)
      if (t.userLink && t.next === t.userLink && !t.exitEnd && !t.dh && SIDINGS.has(st) && noRev(st)) { const sd = SIDINGS.get(st)[0], dep0 = t.next.ev[0].dep * 60; reserve(sd.e, dep0 - 200, dep0 - 50, t); const l = res.get(sd.e); l[l.length - 1][3] = true; l[l.length - 1][4] = 'upre'; t.upre = sd.e; } }
    if (t.cpl) {
      t.cpl.e = cplEdge(t.cpl.side);
      if (t.cpl.e == null) t.cpl = null;
      else { const s = span(t, t.cpl.i); reserve(t.cpl.e, s[0], s[1], t); res.get(t.cpl.e)[res.get(t.cpl.e).length - 1][3] = true; }
    }
    const r = buildTimedRoute(t.names, t.long, { exitStart: t.exitStart, exitEnd: t.exitEnd, probe: true, cls: clsOf(t), allow: ttAllow(t) });
    if (!r) return;
    r.stopE.forEach((e, i) => { if (e != null && r.only[i] && !(t.cpl && i === t.cpl.i)) { const s = span(t, i); reserve(e, s[0], s[1], t); res.get(e)[res.get(e).length - 1][3] = true; } });
    r.stopE.forEach((e, i) => { if (e == null || (t.ev[i] && t.ev[i].thru)) return; const s = span(t, i); if (!soft.has(e)) soft.set(e, []); soft.get(e).push([s[0], s[1], t]); });
  }
  function plan(t) {
    if (t.route !== undefined) return;
    if (t.upre != null) { const l = res.get(t.upre); if (l) res.set(t.upre, l.filter(r => !(r[4] === 'upre' && r[2] === t))); }
    if (t.preRes != null) { const l = res.get(t.preRes); if (l) res.set(t.preRes, l.filter(r => !(r[3] && r[2] === t))); }
    const n = t.names.length;
    let startAt = null, startExtra = false;
    if (t.fromSiding) { startAt = { e: t.fromSiding.e, t: t.fromSiding.t }; startExtra = true; }
    else if (t.prev && t.prev.route) { const g = t.prev.route.segs[t.prev.route.segs.length - 1]; startAt = { e: g.e, t: g.t1 }; }
    const opt = { cls: clsOf(t), allow: ttAllow(t), exitStart: t.exitStart, exitEnd: t.exitEnd, startAt, startExtra, after: t.next && !t.exitEnd ? t.next.names[1] : null, longTurn: t.next && !TERMINI.has(t.names[n - 1]) && span(t, n - 1)[1] - span(t, n - 1)[0] > 300 ? 600 : 0,
      isFree: (i, e) => { if (t.cpl && i === t.cpl.i) return e === t.cpl.e; for (const pf of [t.taka, t.aoto, t.nk, t.na, t.sg]) if (pf && i === pf.q && e === pf.alt && pf.alt !== pf.pref) { const s = span(t, i); if (isFreeAt(pf.pref, s[0], s[1], t)) return false; } if (i === n - 1 && t.forceEnd != null) return e === t.forceEnd; const s = span(t, i);
        // 途中駅(京急川崎など)で5分以上止まって折り返す: ほかの列車が通る予定の番線は、ほかに空いた番線があれば使わない
        if (i === n - 1 && t.next && s[1] - s[0] > 300 && !TERMINI.has(t.names[i])) { const ok = x => isFreeAt(x, s[0], s[1], t) && softFree(x, s[0], s[1], t); if (!ok(e) && [...stByName.get(t.names[i]).stopMap.keys()].some(x => x !== e && ok(x))) return false; }
        // 同じ番線で前の列車の発車と次の着が近すぎない(40秒は空ける)番線があれば、そちらを選ぶ。どれも無ければ今までどおり(5秒)
        if (isFreeAt(e, s[0], s[1], t) && nrtFree(t, i, e)) { if (isFreeAt(e, s[0] - PLAT_GAP, s[1] + PLAT_GAP, t)) return true;
          const al = ttAllow(t), alt = [...stByName.get(t.names[i]).stopMap.keys()].some(x => x !== e && (!al || al(i, x)) && isFreeAt(x, s[0] - PLAT_GAP, s[1] + PLAT_GAP, t) && nrtFree(t, i, x));
          if (!alt) return true; }
        // 待避で長く止まる列車: 先にいる列車がすぐ(LATE_IN秒以内に)出ていくなら、出たあとに入ることにして空きとみなす
        if (i > 0 && i < n - 1 && t.ev[i].ot && !t.cpl && (E[e].dir || t.names[i] === '京成成田') && s[1] - s[0] > LATE_IN + 90 && isFreeAt(e, s[0] + LATE_IN, s[1], t)) {
          let x = -Infinity; for (const r of res.get(e) || []) if (r[2] !== t && r[0] < s[1] && s[0] < r[1] && r[1] > x) x = r[1];
          if (x + 5 <= t.ev[i].arr * 60 + 80) { (t.lateIn || (t.lateIn = {}))[i] = e; return true; }   // 時刻表の到着の分から20秒過ぎまで
        }
        return false; } };
    let route = null;
    // 引上線に上げる折り返し
    const nx = t.next, ta = t.A[t.A.length - 1];
    // 品川の3番線: 普通(とウィング号)の品川止まりは3番線に入って、そのまま下りの列車として折り返す(引上線を使わない)。3番線がふさがっていれば今までどおり
    if (nx && t.names[n - 1] === SHINA && SHINA_E && SHINA_E.length === 3 && !t.exitEnd && !t.dh && !t.cpl && (t.type === 'local' || t.type === 'wing') && nx.names[1] !== '泉岳寺' && nx.route === undefined) {
      const e3 = SHINA_E[2], dep0 = nx.ev[0].dep * 60;
      if (isFreeAt(e3, ta - 45, dep0 + 45, t) && softFree(e3, ta - 45, dep0 + 45, t)) {
        t.sh3 = nx.sh3 = true;
        const r = buildTimedRoute(t.names, t.long, Object.assign({}, opt, { isFree: (i, e) => i === n - 1 ? e === e3 : opt.isFree(i, e) }));
        if (r && r.stopE[n - 1] === e3) { route = r; stat.sh3 = (stat.sh3 || 0) + 1; } else t.sh3 = nx.sh3 = false;
      }
    }
    if (!route && useSiding && nx && !t.exitEnd && nx.ev[0].dep - t.ev[n - 1].arr >= (noRev(t.names[n - 1]) ? SHINA_TURN : SIDING_MIN) && SIDINGS.has(t.names[n - 1])) {
      const dep0 = nx.ev[0].dep * 60;
      // 縦列停車できない駅(金沢文庫)では、ふさがったホームへ入る引上げは使わない。代わりに、空いたホームから向きを変えて留置線へ下がる形も試す
      const strict = NO_TANDEM.has(t.names[n - 1]);
      sidingLoop:
      for (const rev of strict ? [false, true] : [false]) for (const sd of SIDINGS.get(t.names[n - 1])) {
        // 折り返しに余裕があれば、ホームで待ってから発車の少し前に引上線へ入る(引上線は1本しかない駅が多い。着いてから次の発車までずっと押さえると、ほかの折り返しが入れない)
        const LATE = dep0 - 50 - 45 - 60 - 45;   // 戻り・引上線にいる1分・入りの時間
        // 引上線を使うのは、ホームを出て(着いて40秒後・待つなら LATE)から、戻った列車がホームに着く(発車の50秒前)まで
        const SB = dep0 - 50;
        let late = LATE > ta + 60 && isFreeAt(sd.e, LATE, SB, t);
        // 引上線が着いた直後はふさがっている(前の列車が出ていない)が、少しあとなら空く: ホームで待ってから入る(LATE より早い時刻を、遅い順に試す)。待つ間ホームが空いていること(出たあと、次にそのホームへ入る列車まで60秒あける)
        const mids = []; if (!isFreeAt(sd.e, ta + 40, SB, t)) for (let L = LATE - 20; L > ta + 60; L -= 20) { if (isFreeAt(sd.e, L, SB, t)) mids.push(L); else break; }
        if (!late && !mids.length && !isFreeAt(sd.e, ta + 40, SB, t)) continue;
        // 戻る先は、次の列車が入れる番線だけ(番線の決まりがある駅)
        const al0 = ttAllow(nx), full0 = stByName.get(nx.names[0]).stopMap; let m0 = full0;
        if (al0) { const f = new Map([...full0].filter(([e]) => al0(0, e))); f.name = full0.name; if (f.size) m0 = f; }
        const back = findRoute({ e: sd.e, t: sd.t }, [m0, stByName.get(nx.names[1]).stopMap], null, null, false);
        if (back.fail || back.stops[0].d > 170) continue;
        { // 引上線から戻ったあと、次の駅まで逆線を走ることになる引上線は使わない
          let ww = 0; for (const g of cutAt(back, back.total)) { const e = E[g.e], sdir = Math.sign(g.bx - g.ax); if (e.dir && sdir && sdir !== e.dir) ww += g.d1 - g.d0; }
          if (ww > 30) continue;
        }
        const back1 = findRoute({ e: sd.e, t: sd.t }, [m0], null, null, false);
        if (back1.fail || back1.cost > back1.total * 1.5 + 25) continue;   // 戻りで逆線を渡り歩くなら使わない
        t.tail = sd;
        const r = buildTimedRoute(t.names, t.long, Object.assign({}, opt, { tail: sd, after: null, tailRev: rev }));
        if (!r || r.stopD.length !== t.k0 + n + 1) { t.tail = null; continue; }
        if (strict && !isFreeAt(r.stopE[n - 1], ta - 5, ta + 45, t)) { t.tail = null; continue; }
        { // 引上線へ行くために、終着ホームへ逆線を渡って入るような経路は使わない
          const d0 = r.stopD[t.k0 + n - 2], d1 = r.stopD[t.k0 + n - 1]; let wrong = 0;
          for (const g of r.segs) { if (g.d1 <= d0 || g.d0 >= d1) continue; const e = E[g.e], sdir = Math.sign(g.bx - g.ax); if (e.dir && sdir && sdir !== e.dir) wrong += g.d1 - g.d0; }
          if (wrong > 20) { t.tail = null; continue; }
        }
        const rb = buildTimedRoute(t.names, t.long, opt);   // 引上線のために終着ホームへの入り方が不自然になるなら使わない
        if (rb && r.stopD[t.k0 + n - 1] > rb.stopD[t.k0 + n - 1] + 40) { t.tail = null; continue; }
        const pok = (L, m) => isFreeAt(r.stopE[n - 1], ta - 5, L + 5 + (m || 0), t) && softFree(r.stopE[n - 1], ta - 5, L + 5 + (m || 0), t, true); let lv = late ? LATE : ta + 40;   // lv = ホームを出て引上線へ向かう時刻
        if (late && !pok(LATE)) { const m = mids.find(L => pok(L, 60)); if (m != null) lv = m; else { late = false; lv = ta + 40; if (!isFreeAt(sd.e, ta + 40, SB, t)) { t.tail = null; continue; } } }   // 待つホームが空いていなければ、すぐ引上線へ   // 待つホームを、あとで計画するほかの列車(下調べ)も使わないこと
        route = r;
        const out = r.stopD[r.stopD.length - 1] - r.stopD[r.stopD.length - 2];
        const leave = lv, tOut = Math.max(15, Math.min(45, out / 2.5)), tBack = Math.max(15, Math.min(45, back.stops[0].d / 2.5));
        t.P[t.P.length - 1] = leave; t.A.push(leave + tOut); t.P.push(leave + tOut); t.end = leave + tOut;
        nx.fromSiding = sd; nx.k0 = 1;
        nx.A[0] = dep0 - 50; nx.P[0] = Math.max(dep0, nx.P[0]);
        nx.A.unshift(t.end); nx.P.unshift(dep0 - 50 - tBack); nx.start = t.end;
        reserve(sd.e, lv, SB, t); stat.siding++; if (late) stat.sidingLate = (stat.sidingLate || 0) + 1; if (late && lv !== LATE) stat.sidingMid = (stat.sidingMid || 0) + 1;
        { // 引上線から戻ってくるホームを先に押さえておく(あとから来た列車がそこへ入り、戻る列車が別のホームへ回り込むのを防ぐ)
          const pe = cutAt(back, back.stops[0].d).pop().e, al = ttAllow(nx);
          if (lateEnter(nx, pe)) { const x = nx.ev[0].ds - 22; if (x > nx.A[1]) { nx.A[1] = x; nx.P[0] = Math.max(nx.P[0], x - tBack); } }   // 通過列車が行ってからホームへ戻る
          if (!al || al(0, pe)) { reserve(pe, nx.A[1] - 5 - tBack, dep0 + 5, nx); res.get(pe)[res.get(pe).length - 1][3] = true; nx.preRes = pe; }
        }
        break sidingLoop;
      }
    }
    if (!route && nx && noRev(t.names[n - 1]) && !t.exitEnd && t.names[n - 1] !== '京成成田' && !t.dh) {   // 回送は、着いた向きのまま次の列車になる   // 京成成田は中線(上下共用)で向きを変えられる: 着いたホームからそのまま折り返す
      // 品川ではホームでそのまま下りに折り返せない。引上線が使えなければ、着いた列車は回送で出たとみなし、次の列車は1番線から出す
      const d = nx; t.next = null; d.prev = null; stat.unpaired = (stat.unpaired || 0) + 1;
      t.end = t.P[t.P.length - 1] = t.A[t.A.length - 1] + 25;
      d.A[0] = d.ev[0].dep * 60 - 25; d.P[0] = d.ev[0].ds != null ? Math.max(d.ev[0].ds, d.ev[0].dep * 60 + 5) : d.ev[0].dep * 60 + 5; d.start = d.A[0];
      opt.after = null;
    }
    if (!route) route = buildTimedRoute(t.names, t.long, opt);
    if (!route && t.forceEnd != null) { t.forceEnd = null; route = buildTimedRoute(t.names, t.long, opt); }
    if (!route && startAt) { route = buildTimedRoute(t.names, t.long, Object.assign({}, opt, { startAt: null, startExtra: false })); t.unlinked = true; if (t.fromSiding) { t.A.shift(); t.P.shift(); t.k0 = 0; t.fromSiding = null; } }
    t.route = route; t._opt = opt;
    if (route) planned.push(t);
    if (t.cpl) { const l0 = res.get(t.cpl.e); if (l0) res.set(t.cpl.e, l0.filter(r => !(r[3] && r[2] === t))); }
    if (!route) return;
    if (t.cpl && route.stopE[t.cpl.i] !== t.cpl.e) t.cpl = null;   // 決めた番線に入れなかったら増結しない
    t.off = [];
    if (t.cpl) cplList.push(t);
    route.stopE.forEach((e, i) => {
      if (e == null) return;
      const l0 = res.get(e);
      if (l0) res.set(e, l0.filter(r => !(r[3] && r[2] === t)));   // 下調べで押さえた分は本予約に置き換える
      // 同じ線に同時に入る列車がいれば縦列で止める(先着が前、後着がその後ろ)
      const last = i === n - 1, k = i + t.k0;
      if (t.lateIn && t.lateIn[i] === e) {   // 先にいる列車が出るのを待って入る
        const s0 = span(t, i); let x = -Infinity; for (const r of res.get(e) || []) if (r[2] !== t && !r[3] && r[0] < s0[1] && s0[0] < r[1] && r[1] > x) x = r[1];
        if (x > -Infinity && x + 5 > t.A[k]) { t.A[k] = x + 5; if (t.ev[i].as != null) t.ev[i].as = x + 5; }
      }
      const sp = span(t, i);
      if (i === 0 && t.prev && !t.fromSiding && t.prev.route && t.prev.off) {
        // 折り返し前の列車が縦列で止まっていたら、その位置から出発する
        const po = t.prev.off[t.prev.k0 + t.prev.names.length - 1], pg = t.prev.route.segs[t.prev.route.segs.length - 1];
        if (po && !t.prev.tail) t.off[k] = pg.d === route.segs[0].d ? po : -po;
      }
      if (i > 0 && !(t.cpl && i === t.cpl.i) && !t.ev[i].thru) {   // 通過するだけの駅では縦列にしない
        let before = 0, after = 0;
        for (const r of res.get(e) || []) if (r[2] !== t && !r[3] && r[0] < sp[1] && sp[0] < r[1]) { if (r[0] <= sp[0]) before++; else after++; }
        if (before) t.off[k] = -TANDEM * before; else if (after) t.off[k] = TANDEM * 0.6;
        if (before || after) stat.tandem = (stat.tandem || 0) + 1;
      }
      const s = span(t, i); reserve(e, s[0], s[1], t);
    });
  }
  // 全列車の番線が決まってから、増結車の入線時刻を決める
  // 品川始発の列車 d を、引上線 sd から1番線へ入れる形に作り直す(番線は変えない)。from = 引上線に現れる時刻
  const lateEnter = (d, e0) => d.ev[0].ot && d.ev[0].ds != null && d.ev[0].ds > d.ev[0].dep * 60 + 20 && !stByName.get(d.names[0]).stops.some(([e]) => e !== e0 && (!E[e].dir || E[e].dir === E[e0].dir));
  function enterFrom(d, sd, from, a1) {   // a1: ホームに戻る時刻(省略すると発車の50秒前)
    const dep0 = d.ev[0].dep * 60; if (a1 == null) a1 = dep0 - 50;
    const opt = Object.assign({}, d._opt, { startAt: { e: sd.e, t: sd.t }, startExtra: true, tail: d.tail || null, after: d.tail ? null : d._opt.after, isFree: (i, e) => e === d.route.stopE[i] });
    const r = buildTimedRoute(d.names, d.long, opt);
    if (!r || r.stopD.length !== d.route.stopD.length + 1 || r.stopD[1] > 400 || d.names.some((_, i) => r.stopE[i] !== d.route.stopE[i])) return false;
    const tBack = Math.max(15, Math.min(90, r.stopD[1] / 2.5));
    if (r.stopD[1] / (a1 - Math.max(from, a1 - tBack)) > 4.5) return false;   // その時間では速すぎる: もっと早く出るか、近い線を使う
    d.route = r; d.fromSiding = sd; d.k0 = 1; d.sd = undefined; d.c12 = undefined;
    d.A[0] = a1; d.P[0] = Math.max(dep0, d.P[0]);   // 始発駅で追い抜かれてから出る列車は、遅らせた発車時刻を保つ
    // 待避線の無い始発駅(印旛日本医大など)で、通過列車を先に通してから出る列車: 通過列車が行ってからホームへ入る
    if (lateEnter(d, r.stopE[0])) d.A[0] = Math.max(d.A[0], d.ev[0].ds - 22);
    d.A.unshift(from); d.P.unshift(Math.max(from, d.A[0] - tBack)); d.start = from;
    if (d.off) d.off.unshift(undefined);
    return true;
  }
  // 品川で前後の運用がつながらなかった列車: ホームに突然現れたり消えたりさせず、引上線から回送で出入りさせる
  const optOf = t => t.fromSiding && t.k0 === 1 ? Object.assign({}, t._opt, { startAt: { e: t.fromSiding.e, t: t.fromSiding.t }, startExtra: true }) : t._opt;   // あとから引上線から出すことにした列車(enterFrom)は、経路を作り直すとき引上線から始める
  function deadhead() { for (const stn of new Set([SHINA, TAKA, ...DEPOT_ST, ...SIDINGS.keys()])) deadheadAt(stn); }   // 京成高砂は高砂検車区(車庫)の線から出入りする。引上線のある駅(泉岳寺など)も、折り返しの相手のいない終着・始発は引上線から出入りする
  function deadheadAt(stn) {
    const sds = SIDINGS.get(stn) || [];
    for (const d of planned) {
      if (d.names[0] !== stn || d.prev || d.exitStart || d.fromSiding || d.k0 !== 0) continue;
      const dep0 = d.ev[0].dep * 60;
      for (const from of [dep0 - 110, dep0 - 80, dep0 - 150]) for (const sd of sds) {
        if (d.fromSiding || !isFreeAt(sd.e, from, dep0 - 20, d) || !enterFrom(d, sd, from)) continue;
        d.deadIn = true; reserve(sd.e, from, dep0 - 20, d); stat.deadIn = (stat.deadIn || 0) + 1;
        break;
      }
    }
    for (const t of planned) {
      const n = t.names.length;
      if (t.names[n - 1] !== stn || t.next || t.exitEnd || t.tail) continue;
      const ta = t.A[t.A.length - 1];
      for (const sd of sds) {
        if (!isFreeAt(sd.e, ta + 45, ta + 110, t)) continue;
        const r = buildTimedRoute(t.names, t.long, Object.assign({}, optOf(t), { tail: sd, after: null, isFree: (i, e) => e === t.route.stopE[i] }));
        if (!r || r.stopD.length !== t.route.stopD.length + 1 || t.names.some((_, i) => r.stopE[i] !== t.route.stopE[i])) continue;
        const out = r.stopD[r.stopD.length - 1] - r.stopD[r.stopD.length - 2], leave = ta + 40, tOut = Math.max(15, Math.min(45, out / 2.5));
        t.route = r; t.sd = undefined; t.tail = sd; t.deadOut = true;
        t.P[t.P.length - 1] = leave; t.A.push(leave + tOut); t.P.push(leave + tOut + 20); t.end = leave + tOut + 20;
        reserve(sd.e, ta + 45, t.end, t); stat.deadOut = (stat.deadOut || 0) + 1;
        break;
      }
    }
  }
  // ===== 品川で切り離した前4両 =====
  // いったん引上線へ上げ、品川始発で「どこからともなく現れる」列車(折り返し相手のいない列車)の車両として使う。
  // 4両×2本で8両、×3本で12両。使い道のない車両は引上線へ入ったあと回送で出ていったとみなす
  const CUT_ST = '品川', CUT_WAIT = 30 * 60, CUT_LEAD = 150;
  function detach() {
    const sds = SIDINGS.get(CUT_ST) || [], cuts = [];
    for (const u of units.slice()) {
      const t = u.cplWith, c = t.cpl;
      if (c.side !== 'front') continue;
      const q = t.names.indexOf(CUT_ST);
      if (q <= c.i || q >= t.names.length - 1) continue;
      const k = q + t.k0, d0 = t.route.stopD[k] - 2, g = segAt(t.route, d0), L = g.d1 - g.d0, tp = g.t0 + (g.t1 - g.t0) * (L > 0 ? (d0 - g.d0) / L : 0);
      const routes = sds.map(sd => {
        const r = buildTimedRoute([CUT_ST], [0], { startAt: { e: g.e, t: tp }, startExtra: true, tail: sd, isFree: (i, e) => e === t.route.stopE[q] });
        if (!r || r.stopD.length !== 3) return null;
        let last = 0, rev = 0;
        for (const s of r.segs) { const x = Math.sign(s.bx - s.ax); if (x && last && x !== last) rev++; if (x) last = x; }
        return rev ? null : r;
      });
      if (routes.some(Boolean)) cuts.push({ t, q, at: t.P[k] - 25, routes, used: false });
    }
    cuts.sort((a, b) => a.at - b.at);
    const mvOf = r => Math.max(20, Math.min(45, r.total / 2.5));
    const mk = (x, j, n, end, into) => {   // 切り離した車両(引上線 j の奥から n 本目に止まる)
      const t = x.t, r = x.routes[j], mv = mvOf(r), gap = 8 + COUPLE_LEN / 2;
      const v = { no: t.no, type: t.type, dest: t.dest, cars: 4, len: COUPLE_LEN, unit: true, cut: true, into, cplWith: t, tt: true, s: 0, g: null, prev: null, next: null, k0: 0,
        names: [CUT_ST], ev: [{ name: CUT_ST, arr: t.ev[x.q].arr, dep: Math.floor(x.at / 60) }], route: r,
        sd: [gap, Math.max(gap + 1, r.total - n * (COUPLE_LEN + 1))], A: [x.at, x.at + mv], P: [x.at, Math.max(end, x.at + mv + 5)], off: [] };
      v.start = x.at; v.end = v.P[1];
      t.cpl.t1 = x.at; x.used = true; x.v = v;
      units.push(v);
      return v;
    };
    // 品川始発で前の運用がない列車に、待っている車両を古い順に割り当てる
    const deps = planned.filter(d => d.names[0] === CUT_ST && !d.prev && !d.exitStart && !d.fromSiding && d.k0 === 0 && (d.cars === 4 || d.cars === 8 || d.cars === 12)).sort((a, b) => a.ev[0].dep - b.ev[0].dep);
    for (const d of deps) {
      const dep0 = d.ev[0].dep * 60, need = d.cars / 4;
      const pool = cuts.filter(x => !x.used && x.at + CUT_LEAD <= dep0 && dep0 - x.at <= CUT_WAIT);
      if (pool.length < need) continue;
      const use = pool.slice(0, need);
      for (let j = 0; j < sds.length; j++) {
        const sd = sds[j];
        if (use.some(x => !x.routes[j]) || !isFreeAt(sd.e, use[0].at, dep0, d)) continue;
        const lastArr = Math.max(...use.map(x => x.at + mvOf(x.routes[j])));
        if (!enterFrom(d, sd, lastArr)) continue;
        use.forEach((x, n) => mk(x, j, n, lastArr, d));
        d.formed = use.map(x => x.t);
        reserve(sd.e, use[0].at, dep0, d); stat.formed = (stat.formed || 0) + 1;
        break;
      }
    }
    // 残り: 引上線が空いていればそこへ引き上げて(回送で)消える
    for (const x of cuts) {
      if (x.used) continue;
      const mvE = j => x.at + mvOf(x.routes[j]) + 40;
      let j = sds.findIndex((sd, j) => x.routes[j] && isFreeAt(sd.e, x.at, mvE(j), null));
      if (j < 0) continue;
      mk(x, j, 0, mvE(j), null); reserve(sds[j].e, x.at, mvE(j), x.t);
    }
  }
  // 折り返しの相手が見つからなかった終着と始発: 同じ駅・同じ線(ホームか引上線)で、終着のあとに始発が出るなら同じ車両とみなしてつなぐ
  // (終着した車両がホームや引上線で消え、始発がそこへ突然現れるのを防ぐ)。両数が同じで、その間ほかの列車がその線を使わないものだけ、時刻の早い順に
  const lastE = t => t.route.segs[t.route.segs.length - 1].e, firstE = t => t.route.segs[0].e;
  const busy = (e, a, b, x, y) => (res.get(e) || []).some(r => r[0] < b && a < r[1] && r[2] !== x && r[2] !== y);
  const carsEnd = a => (a.cars || 0) + (a.cpl && a.cpl.unit && !(a.cpl.t1 < Infinity) ? 4 : 0);   // 後ろに4両をつないだまま着く列車(金沢文庫で増結した品川行き)は12両
  // ホームに着いたまま相手のいない列車 a を、ホームで待たせてから引上線 sd へ入れ、引上線から出る始発 d の車両にする(d は sd から出るか、ホームから出るなら引上線から入れ直す)
  const viaSiding = (a, d, sd) => {
    const ta = a.A[a.A.length - 1], pe = lastE(a), dep0 = d.ev[0].dep * 60, own = d.fromSiding === sd && d.k0 === 1;
    if (d.fromSiding && !own) return false;
    const r = buildTimedRoute(a.names, a.long, Object.assign({}, optOf(a), { tail: sd, after: null, isFree: (i, e) => e === a.route.stopE[i] }));
    if (!r || r.stopD.length !== a.route.stopD.length + 1 || a.names.some((_, i) => r.stopE[i] !== a.route.stopE[i])) return false;
    const out = r.stopD[r.stopD.length - 1] - r.stopD[r.stopD.length - 2], tOut = Math.max(15, Math.min(45, out / 2.5)), pd = own ? null : d.route.stopE[0];
    // ホームから出る d は、引上線から早めにホームへ戻して待たせてもよい(a1 = ホームに戻る時刻。発車の50秒前から10分前まで)。その間ホームが空いていること
    for (let a1 = dep0 - 50; a1 >= dep0 - 600; a1 -= 30) {
      if (!own && busy(pd, a1 - 5 - PLAT_GAP, dep0 + 5 + PLAT_GAP, a, d)) break;
      const sEnd = own ? dep0 - 20 : a1 + 30, dOut = own ? d.P[0] : a1 - 90;   // 引上線を空ける時刻(戻ってホームに着いてから30秒)と、引上線を出る時刻(戻りはいちばん長くて90秒)
      let L = null;
      for (let x = Math.floor(dOut - 60 - tOut); x >= ta + 40; x -= 20) {   // 引上線に1分はいてから出る。ホームで待つのは遅い順に
        if (busy(sd.e, x - 60, sEnd + 90, a, d)) break;   // 前後の引上線の出入りと、入る前60秒・空けたあと90秒は重ねない(運転で少し遅れても次の列車を止めない)
        if (!busy(pe, ta, x + 5 + 60, a, d)) { L = x; break; }   // 待つホームに、ほかの列車が(出たあと60秒以内に)入らない
      }
      if (L == null) { if (own) break; continue; }
      if (!own && !enterFrom(d, sd, L + tOut, a1)) continue;
      a.route = r; a.sd = undefined; a.tail = sd; a.P[a.P.length - 1] = L; a.A.push(L + tOut); a.P.push(L + tOut); a.end = L + tOut;
      reserve(pe, ta, L + 5, a); reserve(sd.e, L, sEnd, a); if (!own) reserve(pd, a1 - 5, dep0 + 5, d);
      a.next = d; d.prev = a; d.A[0] = Math.min(d.A[0], a.end); d.start = a.end; stat.relink3 = (stat.relink3 || 0) + 1;
      return true;
    }
    return false;
  };
  function relink() {
    const byStn = new Map();
    for (const d of planned) { if (!d.route || d.unit || d.cut || d.prev || d.exitStart) continue; const k = d.names[0]; if (!byStn.has(k)) byStn.set(k, []); byStn.get(k).push(d); }
    const ar = planned.filter(t => t.route && !t.unit && !t.cut && !t.next && !t.exitEnd).sort((x, y) => x.end - y.end);
    const pass = opsOnly => { for (const a of ar) {
      if (a.next || a.userCut) continue;
      const ds = byStn.get(a.names[a.names.length - 1]); if (!ds) continue; const e = lastE(a), sd = a.tail;
      const cand = ds.filter(d => !d.prev && !d.userCutP && (!opsOnly || d === a.opsNext) && d.start >= a.end - 5 && d.ev[0].dep * 60 - a.end < 7200 && (d.cars || 0) === carsEnd(a)).sort((x, y) => x.start - y.start);
      for (const d of cand) {
        if (firstE(d) === e) {   // 同じ線(同じ引上線・同じホーム)から出る始発: そのまま止まっていて、始発になる
          if (busy(e, a.end, d.start, a, d)) continue;
          a.next = d; d.prev = a; reserve(e, a.end, d.start, a);
          d.A[0] = Math.min(d.A[0], a.end); d.start = a.end; stat.relink = (stat.relink || 0) + 1; break;
        }
        if (!sd) { if (!noRev(a.names[a.names.length - 1]) && !opsOnly) continue; if ((SIDINGS.get(a.names[a.names.length - 1]) || []).some(s2 => viaSiding(a, d, s2))) break; continue; }   // ホームでそのまま折り返せない駅(と運用表で決まった相手)は、引上線を通して折り返す
        if (d.fromSiding || d.k0 !== 0) continue;   // 引上線に入った車両を、ホームから出る始発に使う: 引上線からホームへ入れる
        const dep0 = d.ev[0].dep * 60; let ok = false;
        for (const from of [dep0 - 110, dep0 - 80, dep0 - 150]) { if (from < a.end + 30 || busy(sd.e, a.end, dep0 - 20, a, d) || !enterFrom(d, sd, from)) continue; ok = true; break; }
        if (!ok) continue;
        a.next = d; d.prev = a; reserve(sd.e, a.end, dep0 - 20, a);
        d.A[0] = Math.min(d.A[0], a.end); d.start = a.end; stat.relink2 = (stat.relink2 || 0) + 1; break;
      }
    } };
    pass(true); pass(false);   // 運用表で決まった相手を先につなぐ(ほかの列車に取られないように)
  }
  // ===== 夜間の留置(滞泊) =====
  // 朝の始発で前の運用が無い列車: その線(ホーム・引上線)を朝それまでだれも使わないなら、前の夜からそこに止まっていた車両とみなす(1日の始まり STAY0 から置く)
  // 夜の終着で次の運用が無い列車: そのあとその線をだれも使わないなら、そのまま朝まで止めておく(1日の終わり STAY1 まで)
  const STAY0 = 4 * 3600, STAY1 = 26 * 3600, STAY_AM = 8 * 3600, STAY_PM = 22 * 3600;
  function stay() {
    const busy = (e, a, b, x) => (res.get(e) || []).some(r => r[0] < b && a < r[1] && r[2] !== x) || planned.some(o => o !== x && o.route && o.A && o.start < b && a < o.end && o.route.segs.some(g => { if (g.e !== e) return false; const u = [tAt(o, g.d0), tAt(o, g.d1)]; return Math.min(u[0][0], u[1][0]) - 30 < b && a < Math.max(u[0][1], u[1][1]) + 30; }));   // 止まらずに通るだけの列車もその線を使えないので見る(その線を通る時刻の前後30秒)
    function tAt(o, d) {   // 経路上の位置 d を列車 o が通る時刻 [最初, 最後](停車中なら着〜発)
      const D = o.route.stopD, A = o.A, P = o.P, n = Math.min(D.length, A.length);
      if (d <= D[0] + 1) return [o.start, P[0]];
      for (let k = 0; k < n; k++) { if (Math.abs(d - D[k]) <= 1) return [A[k], P[k]]; if (k + 1 < n && d < D[k + 1]) { const x = P[k] + (A[k + 1] - P[k]) * (d - D[k]) / Math.max(1, D[k + 1] - D[k]); return [x, x]; } }
      return [P[n - 1], o.end];
    }
    for (const d of planned) {
      if (!d.route || d.unit || d.cut || d.prev || d.exitStart || d.start > STAY_AM) continue;
      const e = d.route.segs[0].e; if (busy(e, STAY0, d.start, d)) continue;
      reserve(e, STAY0, d.start, d); d.A[0] = STAY0; d.start = STAY0; d.stay = true; stat.stayAM = (stat.stayAM || 0) + 1;
    }
    for (const a of planned) {
      if (!a.route || a.unit || a.cut || a.next || a.exitEnd || a.end < STAY_PM) continue;
      const e = a.route.segs[a.route.segs.length - 1].e; if (busy(e, a.end, STAY1, a)) continue;
      reserve(e, a.end, STAY1, a); a.P[a.P.length - 1] = STAY1; a.end = STAY1; a.stay = true; stat.stayPM = (stat.stayPM || 0) + 1;
    }
  }
  const finish = () => { cplList.splice(0).forEach(addUnit); detach(); deadhead(); relink(); stay(); return units; };
  return { pre, plan, stat, units, finish };
}

// 区間ごとに種別が変わる列車(京成線内は快速・浅草線内は普通・京急線内は特急、など)の、時刻 T での種別
function ttTypeAt(t, T) { const y = ttTypeAt_(t, T); return y === 'liner' && ksVia(t) === 'main' ? 'mliner' : y; }
function ttTypeAt_(t, T) {
  if (!t.tseg) return t.type;
  let k = 0; while (k + 1 < t.names.length && t.A[k + 1 + t.k0] <= T) k++;
  let ty = t.tseg[0][1];
  for (const [i, y] of t.tseg) if (i <= k) ty = y;
  return ty;
}
// ===== 時刻表上の位置の計算と、先行列車への追従 =====
// 位置を決める節点の列: 各停車駅の到着・発車と、推定し直した通過時刻(t.pass)
function ttKnots(t) {
  const sd = t.sd, m = Math.min(sd.length, t.A.length), K = [], pass = [];
  for (const w of t.pass || []) {
    const idx = ST.indexOf(stByName.get(w.name)); let a = null, b = null;
    for (const g of t.route.segs) { if (edgeStation[g.e] === idx) { if (!a) a = g; b = g; } else if (a && g.d0 > b.d1 + 40) break; }
    if (a) pass.push({ t: w.t, d: (a.d0 + b.d1) / 2, ref: w.ref });
  }
  pass.sort((x, y) => x.d - y.d);
  // 京成上野: ホームのすぐ先に渡り線がある(図では日暮里までの3分の1ほどの位置に描かれているが、実際はホームの端)。
  // 発車したらすぐ渡り線を抜け、到着は直前に渡り線を通るように、渡り線の外側の通過時刻を決める
  // 成田空港も同じ: 空港第2ビルとの間の単線部分を、発車直後・到着直前に通る
  const TH = ttKnots.th || (ttKnots.th = (() => { const o = {}; for (const [a, b, f] of [['京成上野', '日暮里', 0.42], ['成田空港', '空港第2ビル', 0.8]]) { const st = stByName.get(a), nb = stByName.get(b); if (!st || !nb) continue;
    const right = nb.cx > st.cx, e0 = right ? Math.max(...st.plats.map(p => p[2])) : Math.min(...st.plats.map(p => p[0])), e1 = right ? Math.min(...nb.plats.map(p => p[0])) : Math.max(...nb.plats.map(p => p[2])); o[a] = e0 + f * (e1 - e0); } return o; })());
  const throat = (X, d0, d1) => { for (const g of t.route.segs) { if (g.d1 < d0 || g.d0 > d1) continue; if (Math.abs(g.ay - g.by) < 30 && (g.ax - X) * (g.bx - X) <= 0 && g.ax !== g.bx) return g.d0 + (g.d1 - g.d0) * (X - g.ax) / (g.bx - g.ax); } return null; };
  for (let k = 0; k < m; k++) {
    if (t.ev[k - t.k0] && t.ev[k - t.k0].thru) K.push({ t: t.A[k], d: sd[k], stop: false });   // 通過点: 止まらずそのままの速さで通る
    else K.push({ t: t.A[k], d: sd[k], stop: true }, { t: t.P[k], d: sd[k], stop: true });
    if (k + 1 >= m) break;
    let lt = t.P[k], ld = sd[k];
    const nmA = t.names[k - t.k0], nmB = t.names[k + 1 - t.k0], run = t.A[k + 1] - t.P[k];
    if (TH[nmA] != null && run > 90) { const d = throat(TH[nmA], sd[k], sd[k + 1]); if (d != null && d > ld + 4 && d < sd[k + 1] - 4) { K.push({ t: lt + 28, d, stop: false }); lt += 28; ld = d; } }
    let ueIn = null;
    if (TH[nmB] != null && run > 90) { const d = throat(TH[nmB], sd[k], sd[k + 1]); if (d != null && d > ld + 4 && d < sd[k + 1] - 4) ueIn = { t: t.A[k + 1] - 28, d, stop: false }; }
    const vm = (sd[k + 1] - sd[k]) / (t.A[k + 1] - t.P[k]) * 2;   // 無理な速さになる通過時刻は使わない
    for (const w of pass) {
      if (!(w.d > ld + 8 && w.d < sd[k + 1] - 8 && w.t > lt + 8 && w.t < t.A[k + 1] - 8)) continue;
      if (!w.ref && ((w.d - ld) / (w.t - lt) > vm || (sd[k + 1] - w.d) / (t.A[k + 1] - w.t) > vm)) continue;
      K.push({ t: w.t, d: w.d, stop: false }); lt = w.t; ld = w.d;
    }
    if (ueIn && ueIn.d > ld + 2 && ueIn.t > lt + 2) K.push(ueIn);
  }
  return K;
}
// 時刻 T での「時刻表どおりの位置」を t.tgt に入れる。運行時間外なら false
function ttTarget(t, T) {
  if (T < t.start || T > t.end || !t.route) return false;
  if (!t.sd) { t.sd = t.route.stopD.map((d, k, a) => t.off && t.off[k] ? Math.max(k ? a[k - 1] + 1 : -30, Math.min(d + t.off[k], k + 1 < a.length ? a[k + 1] - 1 : t.route.total)) : d); t.kn = null; t.vlim = null; }
  if (!t.kn) { t.kn = ttKnots(t); t.kj = 0; }
  const K = t.kn;
  let j = t.kj; if (j >= K.length || K[j].t > T) j = 0;
  while (j + 1 < K.length && K[j + 1].t <= T) j++;
  t.kj = j;
  const a = K[j], b = K[j + 1];
  let s = a.d; t.dwelling = true;
  if (T > a.t) {
    if (!b) return false;
    if (b.d !== a.d) {
      t.vs = (b.d - a.d) / (b.t - a.t);   // この区間の時刻表上の速さ
      let f = (T - a.t) / (b.t - a.t);
      // 加減速は停車駅の前後(最大20秒)だけ。途中は一定の速さで走り、通過点はそのままの速さで通る。
      // (区間全体をなめらかにすると、長い無停車区間の前半が遅くなり、待避駅を通る時刻が大きくずれる)
      const dt = b.t - a.t, r = Math.min(20, dt * 0.3) / dt, ra = a.stop ? r : 0, rb = b.stop ? r : 0, v = 1 / (1 - ra / 2 - rb / 2);
      f = f < ra ? v * f * f / (2 * ra) : f > 1 - rb ? 1 - v * (1 - f) * (1 - f) / (2 * rb) : v * (f - ra / 2);
      t.vpk = t.vs * v;   // 時刻表どおりに走るときの、この区間の最高の速さ
      s += (b.d - a.d) * f; t.dwelling = false;
    }
  }
  t.tgt = s;
  ttShape(t, T);
  return true;
}
const LATE_IN = 50;
// ===== 駅間の最高速度(根拠のあるものだけ)。遅れを取り戻すときにこれを超えない =====
// 京急本線の営業キロ(京急公式 営業キロ程表 2023-10-01、泉岳寺起点の累計。MAINL と同じ順。build/keikyu_mainline_station_distances.csv)
const KQ_KM = [0, 1.2, 1.9, 2.6, 3.4, 3.9, 4.7, 6.0, 6.9, 7.7, 8.4, 9.2, 10.6, 11.8, 13.0, 14.3, 15.0, 16.5, 17.3, 18.1, 19.5, 20.5, 21.2, 21.7, 22.7, 23.4, 24.6, 26.0, 26.8, 27.7, 28.9, 30.3, 32.0, 34.2, 35.5, 37.9, 38.6, 40.7, 42.1, 44.0, 45.7, 48.3, 49.4, 50.4, 51.1, 52.3, 53.5, 54.3, 55.4, 56.7];
const ASAL = '西馬込 馬込 中延 戸越 五反田 高輪台 泉岳寺 三田 大門 新橋 東銀座 宝町 日本橋 人形町 東日本橋 浅草橋 蔵前 浅草 本所吾妻橋 押上'.split(' ');
// Tokyo Metro「営業のご案内 2024-08-01」都営地下鉄線キロ程表。都営浅草線の営業キロ(0.1km単位)
const ASA_KM = [0, 1.2, 2.1, 3.2, 4.8, 5.5, 6.9, 8.0, 9.5, 10.5, 11.4, 12.2, 13.0, 13.8, 14.5, 15.2, 15.9, 16.8, 17.5, 18.3];
const HIGASHINARITA = ['京成成田', '東成田'];
const HIGASHINARITA_KM = [0, 7.1]; // 京成グループガイド2026 (2025-04-01)、運賃営業キロ
const SHIBAYAMA = ['東成田', '芝山千代田'];
const SHIBAYAMA_KM = [0, 2.2]; // 芝山鉄道の営業キロ
const KEISEI_OSHIAGE = ["押上", "京成曳舟", "八広", "四ツ木", "京成立石", "青砥"];
const KEISEI_OSHIAGE_KM = [0.0, 1.1, 2.3, 3.1, 4.6, 5.7];
const KEISEI_OSHIAGE_SEC = [["押上", "京成曳舟", {"down": {"liner": null, "limitedExpress": 75, "rapid": 75, "local": 75}, "up": {"liner": null, "limitedExpress": 75, "rapid": 75, "local": 70}}], ["京成曳舟", "八広", {"down": {"liner": null, "limitedExpress": 95, "rapid": 95, "local": 75}, "up": {"liner": null, "limitedExpress": 105, "rapid": 105, "local": 90}}], ["八広", "四ツ木", {"down": {"liner": null, "limitedExpress": 95, "rapid": 95, "local": 75}, "up": {"liner": null, "limitedExpress": 100, "rapid": 100, "local": 75}}], ["四ツ木", "京成立石", {"down": {"liner": null, "limitedExpress": 95, "rapid": 95, "local": 90}, "up": {"liner": null, "limitedExpress": 90, "rapid": 90, "local": 90}}], ["京成立石", "青砥", {"down": {"liner": null, "limitedExpress": 75, "rapid": 75, "local": 75}, "up": {"liner": null, "limitedExpress": 70, "rapid": 70, "local": 70}}]];
const KEISEI_MAIN = ["京成上野", "日暮里", "新三河島", "町屋", "千住大橋", "京成関屋", "堀切菖蒲園", "お花茶屋", "青砥", "京成高砂", "京成小岩", "江戸川", "国府台", "市川真間", "菅野", "京成八幡", "鬼越", "京成中山", "東中山", "京成西船", "海神", "京成船橋", "大神宮下", "船橋競馬場", "谷津", "京成津田沼", "京成大久保", "実籾", "八千代台", "京成大和田", "勝田台", "志津", "ユーカリが丘", "京成臼井", "京成佐倉", "大佐倉", "京成酒々井", "宗吾参道", "公津の杜", "京成成田", "空港第2ビル", "成田空港"];
const KEISEI_MAIN_KM = [0.0, 2.1, 3.4, 4.3, 5.9, 7.3, 8.8, 9.9, 11.5, 12.7, 14.5, 15.7, 16.4, 17.3, 18.2, 19.1, 20.1, 20.8, 21.6, 22.2, 23.6, 25.1, 26.4, 27.2, 28.2, 29.7, 32.1, 34.0, 36.6, 38.7, 40.3, 42.1, 43.2, 45.7, 51.0, 53.0, 55.0, 57.0, 58.6, 61.2, 68.3, 69.3];
const KEISEI_MAIN_SEC = [["京成上野", "日暮里", {"down": {"liner": null, "limitedExpress": null, "rapid": null, "local": null}, "up": {"liner": 55, "limitedExpress": 55, "rapid": 55, "local": 55}}], ["日暮里", "新三河島", {"down": {"liner": 70, "limitedExpress": 70, "rapid": 70, "local": 70}, "up": {"liner": 85, "limitedExpress": 85, "rapid": 85, "local": 65}}], ["新三河島", "町屋", {"down": {"liner": 75, "limitedExpress": 75, "rapid": 75, "local": 75}, "up": {"liner": 85, "limitedExpress": 85, "rapid": 85, "local": 75}}], ["町屋", "千住大橋", {"down": {"liner": 75, "limitedExpress": 70, "rapid": 70, "local": 70}, "up": {"liner": 75, "limitedExpress": 65, "rapid": 65, "local": 65}}], ["千住大橋", "京成関屋", {"down": {"liner": 85, "limitedExpress": 85, "rapid": 85, "local": 80}, "up": {"liner": 90, "limitedExpress": 80, "rapid": 80, "local": 80}}], ["京成関屋", "堀切菖蒲園", {"down": {"liner": 95, "limitedExpress": 85, "rapid": 85, "local": 85}, "up": {"liner": 95, "limitedExpress": 85, "rapid": 85, "local": 85}}], ["堀切菖蒲園", "お花茶屋", {"down": {"liner": 95, "limitedExpress": 95, "rapid": 95, "local": 90}, "up": {"liner": 95, "limitedExpress": 95, "rapid": 95, "local": 85}}], ["お花茶屋", "青砥", {"down": {"liner": 95, "limitedExpress": 95, "rapid": 95, "local": 85}, "up": {"liner": 95, "limitedExpress": 95, "rapid": 95, "local": 90}}], ["青砥", "京成高砂", {"down": {"liner": 65, "limitedExpress": 60, "rapid": 60, "local": 60}, "up": {"liner": 70, "limitedExpress": 60, "rapid": 60, "local": 60}}], ["京成高砂", "京成小岩", {"down": {"liner": 100, "limitedExpress": 90, "rapid": 90, "local": 90}, "up": {"liner": 100, "limitedExpress": 95, "rapid": 85, "local": 85}}], ["京成小岩", "江戸川", {"down": {"liner": 95, "limitedExpress": 90, "rapid": 90, "local": 85}, "up": {"liner": 95, "limitedExpress": 95, "rapid": 95, "local": 85}}], ["江戸川", "国府台", {"down": {"liner": 90, "limitedExpress": 90, "rapid": 90, "local": 75}, "up": {"liner": 90, "limitedExpress": 90, "rapid": 85, "local": 75}}], ["国府台", "市川真間", {"down": {"liner": 90, "limitedExpress": 90, "rapid": 75, "local": 75}, "up": {"liner": 80, "limitedExpress": 75, "rapid": 70, "local": 70}}], ["市川真間", "菅野", {"down": {"liner": 85, "limitedExpress": 85, "rapid": 85, "local": 70}, "up": {"liner": 95, "limitedExpress": 85, "rapid": 85, "local": 75}}], ["菅野", "京成八幡", {"down": {"liner": 90, "limitedExpress": 85, "rapid": 85, "local": 80}, "up": {"liner": 95, "limitedExpress": 85, "rapid": 85, "local": 80}}], ["京成八幡", "鬼越", {"down": {"liner": 85, "limitedExpress": 75, "rapid": 75, "local": 75}, "up": {"liner": 80, "limitedExpress": 75, "rapid": 75, "local": 75}}], ["鬼越", "京成中山", {"down": {"liner": 90, "limitedExpress": 90, "rapid": 90, "local": 75}, "up": {"liner": 85, "limitedExpress": 85, "rapid": 85, "local": 75}}], ["京成中山", "東中山", {"down": {"liner": 85, "limitedExpress": 85, "rapid": 85, "local": 70}, "up": {"liner": 85, "limitedExpress": 85, "rapid": 85, "local": 80}}], ["東中山", "京成西船", {"down": {"liner": 85, "limitedExpress": 75, "rapid": 75, "local": 70}, "up": {"liner": 85, "limitedExpress": 80, "rapid": 70, "local": 65}}], ["京成西船", "海神", {"down": {"liner": 85, "limitedExpress": 85, "rapid": 85, "local": 85}, "up": {"liner": 90, "limitedExpress": 80, "rapid": 80, "local": 80}}], ["海神", "京成船橋", {"down": {"liner": 80, "limitedExpress": 75, "rapid": 75, "local": 70}, "up": {"liner": 80, "limitedExpress": 75, "rapid": 75, "local": 70}}], ["京成船橋", "大神宮下", {"down": {"liner": 80, "limitedExpress": 80, "rapid": 80, "local": 60}, "up": {"liner": 80, "limitedExpress": 80, "rapid": 80, "local": 65}}], ["大神宮下", "船橋競馬場", {"down": {"liner": 90, "limitedExpress": 85, "rapid": 80, "local": 75}, "up": {"liner": 90, "limitedExpress": 90, "rapid": 80, "local": 75}}], ["船橋競馬場", "谷津", {"down": {"liner": 90, "limitedExpress": 80, "rapid": 80, "local": 80}, "up": {"liner": 95, "limitedExpress": 85, "rapid": 85, "local": 85}}], ["谷津", "京成津田沼", {"down": {"liner": 95, "limitedExpress": 85, "rapid": 85, "local": 85}, "up": {"liner": 90, "limitedExpress": 80, "rapid": 80, "local": 80}}], ["京成津田沼", "京成大久保", {"down": {"liner": 90, "limitedExpress": 85, "rapid": 85, "local": 85}, "up": {"liner": 95, "limitedExpress": 95, "rapid": 90, "local": 90}}], ["京成大久保", "実籾", {"down": {"liner": 100, "limitedExpress": 95, "rapid": 90, "local": 90}, "up": {"liner": 100, "limitedExpress": 100, "rapid": 95, "local": 95}}], ["実籾", "八千代台", {"down": {"liner": 100, "limitedExpress": 95, "rapid": 95, "local": 95}, "up": {"liner": 105, "limitedExpress": 95, "rapid": 95, "local": 95}}], ["八千代台", "京成大和田", {"down": {"liner": 105, "limitedExpress": 100, "rapid": 100, "local": 100}, "up": {"liner": 105, "limitedExpress": 95, "rapid": 90, "local": 90}}], ["京成大和田", "勝田台", {"down": {"liner": 105, "limitedExpress": 95, "rapid": 90, "local": 90}, "up": {"liner": 105, "limitedExpress": 95, "rapid": 95, "local": 95}}], ["勝田台", "志津", {"down": {"liner": 100, "limitedExpress": 95, "rapid": 95, "local": 95}, "up": {"liner": 105, "limitedExpress": 105, "rapid": 95, "local": 95}}], ["志津", "ユーカリが丘", {"down": {"liner": 105, "limitedExpress": 100, "rapid": 85, "local": 85}, "up": {"liner": 105, "limitedExpress": 95, "rapid": 85, "local": 85}}], ["ユーカリが丘", "京成臼井", {"down": {"liner": 105, "limitedExpress": 105, "rapid": 105, "local": 105}, "up": {"liner": 105, "limitedExpress": 105, "rapid": 100, "local": 100}}], ["京成臼井", "京成佐倉", {"down": {"liner": 100, "limitedExpress": 95, "rapid": 90, "local": 90}, "up": {"liner": 95, "limitedExpress": 90, "rapid": 90, "local": 90}}], ["京成佐倉", "大佐倉", {"down": {"liner": 95, "limitedExpress": 95, "rapid": 90, "local": 90}, "up": {"liner": 95, "limitedExpress": 90, "rapid": 90, "local": 90}}], ["大佐倉", "京成酒々井", {"down": {"liner": 95, "limitedExpress": 95, "rapid": 95, "local": 95}, "up": {"liner": 95, "limitedExpress": 90, "rapid": 90, "local": 90}}], ["京成酒々井", "宗吾参道", {"down": {"liner": 95, "limitedExpress": 90, "rapid": 90, "local": 90}, "up": {"liner": 100, "limitedExpress": 95, "rapid": 95, "local": 95}}], ["宗吾参道", "公津の杜", {"down": {"liner": 100, "limitedExpress": 95, "rapid": 85, "local": 85}, "up": {"liner": 105, "limitedExpress": 100, "rapid": 90, "local": 90}}], ["公津の杜", "京成成田", {"down": {"liner": 100, "limitedExpress": 95, "rapid": 70, "local": 70}, "up": {"liner": 105, "limitedExpress": 90, "rapid": 80, "local": 80}}], ["京成成田", "空港第2ビル", {"down": {"liner": 110, "limitedExpress": 105, "rapid": 105, "local": 105}, "up": {"liner": 110, "limitedExpress": 105, "rapid": 105, "local": 105}}], ["空港第2ビル", "成田空港", {"down": {"liner": 55, "limitedExpress": 55, "rapid": 55, "local": 55}, "up": {"liner": 55, "limitedExpress": 55, "rapid": 55, "local": 55}}]];
// 旧表の種別分類にない現行種別（快特・アクセス特急など）は快速欄を類似値として使う。
const keiseiSpeedClass = t => t.type === 'liner' ? 'liner' : t.type === 'tokkyu' ? 'limitedExpress' : t.type === 'local' ? 'local' : 'rapid';
// 京急公式ハンドブック2013–2014: 快特の最高速度 品川〜横浜120・横浜以南110km/h(現行値の再確認は未了)。
// 東京都交通局の現行概要: 浅草線の最高速度70km/h。営業キロと同様に、遅延回復時の上限として使用。
// 京成・芝山の105/80はファンサイト掲載の旧時刻表(No.22)ベースの暫定値。現行設備制限の公式値ではない。
// 曲線・分岐器の局所制限は駅間内の位置が未確定なので入れない。泉岳寺〜品川は会社境界をまたぐため対象外。
const VLINES = [
  { km: new Map(MAINL.map((n, i) => [n, KQ_KM[i]])), sec: [['品川', '横浜', 120], ['横浜', '浦賀', 110]] },
  { km: new Map(ASAL.map((n, i) => [n, ASA_KM[i]])), sec: [['西馬込', '押上', 70]] },
  { km: new Map(HIGASHINARITA.map((n, i) => [n, HIGASHINARITA_KM[i]])), sec: [['京成成田', '東成田', 105]] },
  { km: new Map(SHIBAYAMA.map((n, i) => [n, SHIBAYAMA_KM[i]])), sec: [['東成田', '芝山千代田', 80]] },
  { km: new Map(KEISEI_MAIN.map((n, i) => [n, KEISEI_MAIN_KM[i]])), sec: KEISEI_MAIN_SEC, conservative: true },
    { km: new Map(KEISEI_OSHIAGE.map((n, i) => [n, KEISEI_OSHIAGE_KM[i]])), sec: KEISEI_OSHIAGE_SEC, conservative: true }
];
// 停車駅 k→k+1 の区間の上限を、その列車が実際に走る経路の図上長(t.sd)で 図上単位/秒 に直す。根拠の無い区間は Infinity
function ttVLim(t, k) {
  const L = t.vlim || (t.vlim = []);
  if (L[k] !== undefined) return L[k];
  let v = Infinity;
  const i = k - t.k0, n1 = i >= 0 ? t.names[i] : null, n2 = i >= 0 ? t.names[i + 1] : null;
  if (n1 && n2 && t.sd[k + 1] > t.sd[k]) for (const line of VLINES) {
    const a = line.km.get(n1), b = line.km.get(n2);
    if (a == null || b == null || a === b) continue;
    const lo = Math.min(a, b), hi = Math.max(a, b);
    let kmh = 0;
    const direction = b > a ? 'down' : 'up';
    for (let x = lo; x < hi - 1e-9; ) {
      const sec = line.sec.find(([p, q]) => line.km.get(p) <= x + 1e-9 && x < line.km.get(q) - 1e-9);
      if (!sec) { kmh = 0; break; }
      const rule = sec[2];
      const candidate = typeof rule === 'number' ? rule : rule[direction][keiseiSpeedClass(t)];
      if (candidate == null) { kmh = 0; break; }
      kmh = line.conservative && kmh ? Math.min(kmh, candidate) : Math.max(kmh, candidate);
      x = line.km.get(sec[1]);
    }
    if (kmh) { v = kmh / 3600 * (t.sd[k + 1] - t.sd[k]) / (hi - lo); break; }
  }
  return L[k] = v;
}
// 位置 s がどの停車駅間(k→k+1)にあるか。駅の上・範囲外は -1
function ttStopK(t, s) { const sd = t.sd; if (!sd || sd.length < 2) return -1; let k = 0; while (k + 2 < sd.length && sd[k + 1] <= s) k++; return s >= sd[k] && s < sd[k + 1] ? k : -1; }
const FOLLOW_GAP = 15, FOLLOW_VMAX = 8, FOLLOW_BOOST = 1.7, FOLLOW_VMIN = 2.5, FOLLOW_GIVEUP = 75, HOLD_MAX = 90;
// 同じ線を同じ向きに走る前の列車には、重なったり追い越したりせず、間隔をあけて後ろに付く。
// 前が空いたら遅れを取り戻す(最高 FOLLOW_VMAX)。止まっている列車に長く(FOLLOW_GIVEUP秒)ふさがれたときだけ例外的に先へ進む
function ttFollow(act, T, lastT) {
  const dt = T - lastT, snap = !(dt > 0 && dt < 90);
  const occ = new Map();
  for (const t of act) {
    const s0 = t._s0 = (t.sv == null || snap) ? t.tgt : t.sv, r = t.route;
    const sc = Math.max(0, Math.min(r.total, s0)), g = segAt(r, sc), L = g.d1 - g.d0, tt_ = g.t0 + (g.t1 - g.t0) * (L > 0 ? (sc - g.d0) / L : 0);
    const k = g.e * 2 + g.d;
    if (!occ.has(k)) occ.set(k, []);
    occ.get(k).push({ t, u: (g.d ? 1 - tt_ : tt_) * E[g.e].len });
  }
  // 始発駅を出る列車は、時刻表ではもう先にいるはずの列車がまだ後ろから来ている間は発車を待つ(先に本線へ出て速い列車をふさがない)
  if (!snap) for (const t of act) {
    t.hold = false;
    const k = t.k0, s0 = t._s0;
    if (t.unit || !t.sd || k + 1 >= t.A.length || !(T > t.P[k] && T < t.P[k] + HOLD_MAX) || Math.abs(s0 - t.sd[k]) > 0.6) continue;
    const segs = t.route.segs, cur = segAt(t.route, Math.max(0, Math.min(t.route.total, s0))), fwd = new Set();
    for (const g of segs) { if (g.d1 < s0) continue; if (g.d0 > s0 + 70) break; if (g.e !== cur.e) fwd.add(g.e * 2 + g.d); }
    if (!fwd.size) continue;
    for (const o of act) {
      if (o === t || o.hold || o.unit || !FAST.has(o.type) || o.tgt - o._s0 < 5) continue;
      const os = o.route.segs; let lo = 0, hi = os.length - 1;
      while (lo < hi) { const m = (lo + hi) >> 1; if (os[m].d1 < o._s0) lo = m + 1; else hi = m; }
      let hit = -1, thruMe = false;
      for (let j = lo; j < os.length && os[j].d0 <= o._s0 + 220; j++) {
        if (os[j].e === cur.e) { thruMe = true; break; }   // 相手は自分のいる線を通る: 自分が先に出るしかない
        if (hit < 0 && fwd.has(os[j].e * 2 + os[j].d)) hit = j;
      }
      if (!thruMe && hit >= 0 && os[hit].d0 > o._s0 && o.tgt > os[hit].d0 + 5) t.hold = true;
      if (t.hold) break;
    }
  }
  let held = 0;
  for (const t of act) {
    const s0 = t._s0, r = t.route, segs = r.segs;
    // 遅れを取り戻すときも、その列車のふだんの速さの FOLLOW_BOOST 倍まで(前が空いた瞬間に猛スピードで走らない)
    let vcap = Math.min(FOLLOW_VMAX, Math.max(FOLLOW_VMIN, FOLLOW_BOOST * (t.vs || 2)));
    // 駅間の最高速度(ttVLim)も超えない。ただし時刻表どおりの速さ(t.vpk)より遅くはしない
    const vk = ttStopK(t, s0), vl = vk < 0 ? Infinity : ttVLim(t, vk);
    if (vl < vcap) vcap = Math.max(vl, t.vpk || 0);
    let want = snap ? t.tgt : t.hold ? s0 : Math.min(t.tgt, s0 + vcap * dt);
    if (snap) { t.sv = t.s = t.tgt; t.blk = 0; continue; }
    let limit = Infinity, blocker = null;
    const from = Math.max(0, s0), to = Math.max(want, s0) + FOLLOW_GAP + 2 * COUPLE_LEN;
    let lo = 0, hi = segs.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (segs[m].d1 < from) lo = m + 1; else hi = m; }
    for (let j = lo; j < segs.length && segs[j].d0 <= to; j++) {
      const g = segs[j], list = occ.get(g.e * 2 + g.d);
      if (!list) continue;
      const u0 = (g.d ? 1 - g.t0 : g.t0) * E[g.e].len;
      for (const o of list) {
        if (o.t === t || o.t.cplWith === t || t.cplWith === o.t) continue;   // 連結する相手にはくっつく
        const dL = g.d0 + (o.u - u0), gp = FOLLOW_GAP + (o.t.extB || 0) + (t.extF || 0);
        // 終着ホームでは、自分の経路の終点より先(同じ線の前方)にまだいる列車にも間隔をあける
        if (dL < g.d0 - 1e-6 || dL > g.d1 + (j === segs.length - 1 ? gp : 1e-6) || dL <= s0 + 0.5) continue;
        if (dL - gp < limit) { limit = dL - gp; blocker = o.t; }
      }
    }
    if (blocker && limit < want && want > s0 + 1e-6) {
      // 例外的に先へ進むのは、前の列車が所定の位置で止まっている(折り返し待ちなど)ときだけ。前の列車も遅れて動いている最中なら後ろで待つ
      t.blk = (t.blk || 0) + (blocker.dwelling && blocker.tgt - blocker.s < 3 ? dt : 0); t.blkBy = blocker;
      if (t.blk > FOLLOW_GIVEUP) limit = Infinity; else held++;
    } else t.blk = 0;
    let s = Math.min(want, limit);
    if (s < s0) s = Math.min(s0, t.tgt);
    t.sv = t.s = s;
  }
  return held;
}
