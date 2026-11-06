// ===== 無線(ゲーム): CPU の運転士・駅員/駅長・検車区・ほかの指令員と、選択式で話す =====
// 時間は止めない(倍速のまま)。返事は相手の腕前・忙しさで数十秒〜数分(運転の時刻)あとに来る
// 事故・支障(src/dinc.js)が起きると相手から無線が入る。選んだ指示で、抑止・徐行・自走・打ち切り・救援・運転再開・振替輸送などが決まる
// 評価(G.sc)は観点ごとに点を足し引きして、あとで勤務の結果に出す
let D_GAME = true;
const G = { th: [], seq: 0, q: [], sc: [], people: new Map() };
const G_SEI = '佐藤 鈴木 高橋 田中 伊藤 渡辺 山本 中村 小林 加藤 吉田 山田 佐々木 山口 松本 井上 木村 林 斎藤 清水 山崎 森 池田 橋本 阿部 石川 山下 中島 石井 小川 前田 岡田 長谷川 藤田 後藤 近藤 村上 遠藤 青木 坂本 斉藤 福田 太田 西村 藤井 金子 岡本 藤原 中野 三浦 原田 松田 竹内 小野 田村 中山 和田 石田 上田 森田 原 柴田 酒井 工藤 横山 宮崎 宮本 内田 高木 安藤 島田 谷口 大野 高田 丸山 今井 河野 藤本 村田 武田 上野 杉山 増田 小山 大塚 平野 菅原 久保 松井 千葉 岩崎 桜井 木下 野口 松尾 菊地 野村 新井'.split(' ');
const G_MEI = '大輔 健太 翔太 拓也 直樹 和也 達也 大樹 雄太 誠 隆 浩二 修 剛 学 聡 亮 悠斗 蓮 颯太 美咲 彩 由佳 真由美 恵 舞 千尋 綾香 結衣 陽菜'.split(' ');
const gHash = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
// 相手: kind = driver(運転士) / station(駅長・駅員) / depot(検車区) / desk(ほかの指令員)
function gPerson(kind, key, extra) {
  const k = kind + '|' + key; if (G.people.has(k)) return G.people.get(k);
  const h = gHash(k), r = n => (gHash(k + n) % 1000) / 1000;
  const p = Object.assign({ kind, key, name: G_SEI[h % G_SEI.length] + ' ' + G_MEI[(h >>> 8) % G_MEI.length], years: 1 + Math.floor(r('y') * 34), care: r('c'), skill: 1 + Math.floor(r('s') * 5) }, extra || {});
  p.trait = p.years >= 20 ? 'ベテラン' : p.years <= 3 ? '新人' : '中堅'; p.mood = p.care > 0.66 ? '慎重' : p.care < 0.33 ? 'せっかち' : 'ふつう';
  p.role = { driver: '運転士', station: p.big ? '駅長' : '駅員', depot: '検車区', desk: p.desk || '指令員' }[kind];
  G.people.set(k, p); return p;
}
const G_BIG = new Set('品川 京急蒲田 京急川崎 横浜 上大岡 金沢文庫 金沢八景 横須賀中央 堀ノ内 京急久里浜 羽田空港第1・第2ターミナル 泉岳寺 神奈川新町'.split(' '));
const gDriver = t => gPerson('driver', t.hs ? t.hs.f : t.no, { train: t });
const gStation = st => gPerson('station', st, { st, big: G_BIG.has(st) });
const gDepot = d => gPerson('depot', d, { depot: d });
const gDesk = d => gPerson('desk', d, { desk: d });
const gWho = p => `${p.kind === 'driver' ? (p.train ? p.train.no + ' ' : '') + '運転士' : p.kind === 'station' ? p.st + (p.big ? ' 駅長' : ' 駅') : p.kind === 'depot' ? p.depot + '検車区' : p.desk} ${p.name}`;
// 返事にかかる秒: 腕前が低い・新人ほど遅い。慎重な人は確認に時間をかける
const gDelay = (p, base) => Math.round(base * (1.4 - p.skill * 0.12) * (p.trait === '新人' ? 1.3 : 1) * (0.8 + p.care * 0.5) * (0.85 + Math.random() * 0.3));
// ----- 会話の筋(スレッド) -----
function gThread(p, title, inc) { const th = { id: ++G.seq, p, title, inc, msgs: [], choices: null, open: true, unread: 0, T0: D_NOW }; G.th.unshift(th); if (G.th.length > 60) G.th.length = 60; return th; }
function gSay(th, text, choices, delay) {   // 相手が話す(delay 秒後)。choices = [{ l: 指令の返事, f: (th) => {} }]
  const fire = () => { th.msgs.push({ T: D_NOW, me: false, text }); th.choices = choices || null; th.askT = D_NOW; th.unread++; gRender(); };
  if (delay > 0) G.q.push({ T: D_NOW + delay, f: fire }); else fire();
}
function gMe(th, text) { th.msgs.push({ T: D_NOW, me: true, text }); }
function gPick(id, i) {
  const th = G.th.find(x => x.id === id); if (!th || !th.choices || !th.choices[i]) return;
  const c = th.choices[i]; th.choices = null; th.unread = 0;
  const wait = D_NOW - (th.askT || D_NOW); gScore('速さ', wait < 60 ? 2 : wait < 180 ? 1 : wait < 600 ? -1 : -3, `${th.title}: 返事まで ${Math.round(wait)}秒`);
  gMe(th, c.l); if (c.f) c.f(th); gRender();
}
const gLater = (sec, f) => G.q.push({ T: D_NOW + sec, f });
function gScore(axis, pts, why) { G.sc.push({ T: D_NOW, axis, pts, why }); }
function gStep(act, T) {
  if (!G.q.length) return;
  const due = G.q.filter(x => x.T <= T); if (!due.length) return;
  G.q = G.q.filter(x => x.T > T); for (const x of due) { try { x.f(); } catch (e) { console.error(e); } }
}
function gReset() { G.th.length = 0; G.q.length = 0; G.sc.length = 0; G.seq = 0; gRender(); }
// ----- 位置・駅のことば -----
function gNextStop(t) { const p = t.ph, dp = t.dp; if (!p || !dp) return null; for (let k = p.k; k < dp.stops.length; k++) { const s = dp.stops[k]; if (!s.thru && s.m >= p.m - 1) return s; } return null; }
function gBetween(t) { const p = t.ph, dp = t.dp; if (!p || !dp) return ''; let a = null, b = null; for (const s of dp.stops) { if (!s.name) continue; if (s.m <= p.m + 1) a = s.name; else { b = s.name; break; } } return p.mode === 'dwell' ? (dp.stops[p.k] && dp.stops[p.k].name || '') + '駅' : (a && b ? `${a}〜${b}間` : a || b || ''); }
// 後続の列車(同じ区間・同じ向きで、うしろにいるいちばん近い列車)
function gFollower(t) { const k = dTrainKm(t); if (!k) return null; let best = null, bd = Infinity;
  for (const o of ttActive || []) { if (o === t || !o.ph || o.yard || o.unit || o.cut || o.gOut != null) continue; const q = dTrainKm(o); if (!q || q.si !== k.si || q.dn !== k.dn) continue; const d = k.dn ? k.km - q.km : q.km - k.km; if (d > 0.05 && d < bd) { bd = d; best = o; } }
  return best ? { t: best, km: bd } : null; }
// 予備車・デトのいる検車区と、現場までのキロ
const G_DEPOT = { 新町: '神奈川新町', 金沢: '金沢文庫', 久里浜: '京急久里浜' }, G_DETO = { 新町: 'デト11・12形', 久里浜: 'デト15・16形' };
function gDepotKm(d) { const st = G_DEPOT[d]; for (const s of DSEC) if (s.stInfo.has(st)) return s.stInfo.get(st).km; return null; }
function gNearDepots(t, onlyDeto) { const k = dTrainKm(t); if (!k) return []; return Object.keys(G_DEPOT).filter(d => !onlyDeto || G_DETO[d]).map(d => ({ d, km: Math.abs((gDepotKm(d) ?? k.km) - k.km) })).sort((a, b) => a.km - b.km); }
// ===== 事故が起きたとき =====
const G_SYM = ['ブレーキが緩みません', '主回路の故障表示が出ています', 'パンタグラフ付近から異音がします', '戸閉め(ドア)の表示灯が点きません', '主電動機の過電流で止まりました'];
function gIncOn(o, T) {
  if (!D_GAME) return;
  if (o.kind === 'car' && o.t) { o.hold = true; o.dur = Infinity; gCar(o); }
  else if (o.kind === 'block') { o.hold = true; gBlock(o); }
  else if (o.kind === 'dwell') gDwell(o);
  else if (o.kind === 'jr') { o.acc = false; gJr(o); }
}
function gIncReady(o) { if (!D_GAME) return; if (o.kind === 'block') gBlockReady(o); }
function gIncOff(o) { }
// ----- 車両故障 -----
function gCar(o) {
  const t = o.t, p = gDriver(t), th = gThread(p, `${t.no} 車両故障`, o); o.th = th; o.sym = G_SYM[gHash(t.no + o.id) % G_SYM.length];
  const where = gBetween(t) || o.at;
  gSay(th, `指令、こちら ${t.no} 運転士の${p.name.split(' ')[0]}です。${where}で停車しました。${o.sym}。`, gCarMenu(o), 0);
}
function gCarMenu(o) { return [
  { l: '状態を確かめて、自走できるか報告してください', f: th => gCarCheck(o) },
  { l: '確かめずに、そのまま次の駅まで進んでください', f: th => gCarGo(o, false) },
  { l: 'その場で待機してください。救援を手配します', f: th => gRescueMenu(o) }]; }
function gCarCheck(o) {
  const p = o.th.p, d = gDelay(p, o.self ? 150 : 240), lie = p.trait === '新人' && p.skill <= 2 && Math.random() < 0.25;   // 新人はたまに見立てを誤る
  o.saidSelf = lie ? !o.self : o.self;
  gSay(o.th, '了解、確認します。', null, 8);
  gSay(o.th, o.saidSelf ? `確認しました。応急処置で自走できます。45km/hまでなら走れそうです。` : `確認しました。自走できません。救援をお願いします。`, o.saidSelf ? gSelfMenu(o, true) : [
    { l: '救援を手配します。その場で待機してください', f: () => gRescueMenu(o) },
    { l: 'もう一度確かめてください', f: () => { gScore('判断', 0, '再確認'); gCarCheck(o); } }], d);
}
// 自走できるときの指示: 打ち切る駅を選ぶ(行っとけ: 留置線・車庫のある駅まで行かせるなど)/続行/組み立て/救援
function gSelfMenu(o, checked) {
  const t = o.t, ah = t.ph ? dAheadStations(t, 60) : [], nx = ah.find(x => x.stop) || ah[0];
  const far = ah.filter(x => x !== nx && (dCanTurn(x.name) || YARD_ST.has(x.name))).slice(0, 5);
  const ch = [];
  if (nx) ch.push({ l: `45km/h以下で次の${nx.name}まで。お客さまを降ろして打ち切り、回送で留置線へ`, f: () => gCarGo(o, checked, nx.name) });
  for (const x of far) ch.push({ l: `45km/h以下で${x.name}まで行って打ち切り、回送で${YARD_ST.has(x.name) ? '車庫' : '留置線'}へ${x.stop ? '' : '(臨時停車)'}`, f: () => gCarGo(o, checked, x.name) });
  ch.push({ l: '45km/h以下で、このまま運転を続けてください', f: () => gCarGo(o, checked, 'keep') });
  ch.push({ l: '指示を組み立てます(行先・種別・折り返し・回送を選ぶ)', f: () => { gCarGo(o, checked, 'hold'); gCmdOpen(t, { cap: 45, inc: o }); } });
  ch.push({ l: 'その場で待機してください。救援を手配します', f: () => gRescueMenu(o) });
  return ch;
}
// 故障した列車を、駅 st で打ち切って回送で留置する(列車は消さずに走らせる)
function gCarCut(o, st, cap) {
  const t = o.t; if (!t.ph) return false;
  t.ph.incStop = null; t.ph.incDw = null;
  const r = dOrder(t, [{ to: st, stops: 'orig' }], D_NOW, { after: 'park', cap });
  if (!r.ok) { gSay(o.th, `${st}までは行けません(${r.msg})。`, gSelfMenu(o, true), 5); return false; }
  o.ok = true; o.dur = Math.max(0, D_NOW - o.T0);
  r.job.onPark = x => { gSay(o.th, `${x.parked}に入りました。`, null, 0); gAfterCut(o); };
  r.job.onFail = (x, e) => gSay(o.th, `${e}。次の指示をください。`, null, 5);
  dEvent(D_NOW, t, 'wait', `${st} で運転打ち切り(回送で留置線へ)`); gScore('運休', -2, `${t.no}: ${st}で打ち切り`);
  const chk = () => { const x = D_DYN.find(d => d.job === r.job && d.endT && d.names[d.names.length - 1] === st); if (x) { gSay(o.th, `${st}に着きました。お客さまを降ろして回送にします。`, null, 0); return; } if (D_DYN.some(d => d.job === r.job)) gLater(10, chk); }; gLater(10, chk);
  return true;
}
function gCarGo(o, checked, after) {
  const t = o.t, p = o.th.p;
  if (!o.self) { gSay(o.th, `やってみましたが、動きません。${checked ? '先ほどの見立てが誤っていました。申し訳ありません。' : ''}`, [{ l: '了解。その場で待機してください。救援を手配します', f: () => gRescueMenu(o) }], gDelay(p, 90)); gScore('判断', checked ? -1 : -3, `${t.no}: 自走できない列車を動かそうとした`); return; }
  if (!checked) gScore('安全', -2, `${t.no}: 確かめずに故障車を動かした`); else gScore('判断', 2, `${t.no}: 確かめてから自走`);
  if (after === 'hold') { gSay(o.th, '了解、45km/h以下なら走れる状態で、指示を待ちます。', null, gDelay(p, 15)); return; }
  if (!after) { const s0 = gNextStop(t); after = s0 && s0.name ? s0.name : 'keep'; }
  gSay(o.th, `了解、45km/h以下で${after === 'keep' ? '運転を続けます' : after + 'まで進み、打ち切ります'}。`, null, gDelay(p, 20));
  if (after === 'keep') { gLater(gDelay(p, 30), () => { if (!t.ph) return; t.ph.incCap = KMH(45); o.keepCap = true; o.ok = true; o.dur = Math.max(0, D_NOW - o.T0); o.after = 'keep'; gWatchNext(o); }); return; }
  gLater(gDelay(p, 30), () => gCarCut(o, after, 45));
}
function gWatchNext(o) {   // 次の駅に着いたら(打ち切り: 客を降ろして回送で外す)
  const t = o.t, s0 = gNextStop(t); if (!s0) return;
  const chk = () => { const p = t.ph; if (!p) return; const st = p.mode === 'dwell' ? t.dp.stops[p.k] : null;
    if (st && st.name === s0.name) {
      if (o.after === 'keep') { gSay(o.th, `${st.name}に着きました。45km/h以下で続けます。`, null, 5); gScore('運休', 1, `${t.no}: 運転を続けた`); gScore('安全', -1, `${t.no}: 故障車で営業を続けた`); return; }
      p.incDw = D_NOW + 120; gSay(o.th, `${st.name}に着きました。お客さまを降ろしています。`, null, 10);
      gLater(130, () => { t.gOut = D_NOW; gSay(o.th, `お客さまを降ろしました。回送で車庫へ向かいます。`, null, 0); dEvent(D_NOW, t, 'wait', `${st.name} で運転打ち切り(回送で車庫へ)`); gScore('運休', -2, `${t.no}: ${st.name}で打ち切り`); gAfterCut(o); });
      return; }
    gLater(5, chk); };
  gLater(5, chk);
}
function gAfterCut(o) {   // 打ち切った列車の次の運用(同じ車両)をどうするか: 検車区と話す
  const t = o.t, nx = t.next; if (!nx) return;
  const ds = gNearDepots(t), d = ds[0] && ds[0].d; if (!d) return;
  const p = gDepot(d), th = gThread(p, `${nx.no} の車両`, o);
  gSay(th, `指令、${d}検車区です。${t.no} の車両は入庫させます。次の運用の ${nx.no}(${hm(nx.ev[0].dep)} ${nx.names[0]}発)はどうしますか。`, [
    { l: '予備車を出して、その運用に入れてください', f: () => { gSay(th, '了解、予備車を出します。', null, gDelay(p, 40)); gScore('運休', 2, `${nx.no}: 予備車で運転`); } },
    { l: '運休にします', f: () => { nx.gOut = 0; gSay(th, `了解、${nx.no} は運休ですね。`, null, gDelay(p, 20)); gScore('運休', -3, `${nx.no}: 運休`); } }], gDelay(p, 120));
}
// 救援: 後続の営業列車 / 予備車 / デト(いまは時間で動かす。救援列車を盤面に出すのは次の版)
function gRescueMenu(o) {
  const t = o.t, f = gFollower(t), ds = gNearDepots(t), dd = gNearDepots(t, true);
  const ch = [];
  if (o.saidSelf) ch.push({ l: '(やはり自走させる)', f: () => gSay(o.th, 'どうしますか。', gSelfMenu(o, true), 5) });
  if (f) ch.push({ l: `後続の ${f.t.no} で救援します(併結して推進)`, f: () => gRescue(o, 'follow', f) });
  if (ds[0]) ch.push({ l: `${ds[0].d}検車区から予備車を出します(約${ds[0].km.toFixed(1)}km)`, f: () => gRescue(o, 'spare', ds[0]) });
  if (dd[0]) ch.push({ l: `${dd[0].d}検車区から${G_DETO[dd[0].d]}を出します(約${dd[0].km.toFixed(1)}km)`, f: () => gRescue(o, 'deto', dd[0]) });
  gSay(o.th, '了解、待機します。救援の方法はどうしますか。', ch, gDelay(o.th.p, 15));
}
function gRescue(o, how, x) {
  const t = o.t;
  // 着くまでの秒(準備 + 距離)。後続は誘導で近づいて連結、予備車・デトは出庫の準備がある
  const prep = how === 'follow' ? 300 : how === 'spare' ? 1200 : 1800, run = how === 'follow' ? x.km * 1000 / KMH(15) : x.km * 1000 / KMH(how === 'spare' ? 45 : 35), couple = 600;
  const eta = Math.round(prep + run + couple);
  if (how === 'follow') { const f = x.t, fp = gDriver(f), th2 = gThread(fp, `${f.no} 救援`, o);
    gSay(th2, `${f.no} 運転士の${fp.name.split(' ')[0]}です。救援の指示、了解しました。誘導で ${t.no} に近づいて連結します。`, null, gDelay(fp, 30)); o.th2 = th2;
    gLater(prep + run, () => { if (f.ph) { f.ph.incCap = KMH(25); } gSay(th2, `${t.no} に連結しました。推進で次の駅へ向かいます。`, null, 0); });
    gScore('判断', 2, `${t.no}: 後続列車で救援(早い)`); }
  else { const p = gDepot(x.d), th2 = gThread(p, `${t.no} 救援`, o); o.th2 = th2; gSay(th2, `${x.d}検車区です。${how === 'spare' ? '予備車' : G_DETO[x.d]}を出します。準備に${Math.round(prep / 60)}分ほどかかります。`, null, gDelay(p, 40));
    gLater(prep, () => gSay(th2, `出庫しました。現場まで約${Math.round(run / 60)}分です。`, null, 0)); gScore('判断', how === 'deto' ? -1 : 0, `${t.no}: ${how === 'spare' ? '予備車' : 'デト'}で救援`); }
  gSay(o.th, `了解。救援を待ちます(着くまで約${Math.round(eta / 60)}分)。`, null, 10);
  gLater(eta, () => { if (!t.ph) return; const st = gNextStop(t);
    gSay(o.th, '救援列車と連結しました。25km/h以下で次の駅へ向かいます。', null, 0);
    if (!st || !st.name || !gCarCut(o, st.name, 25)) { t.ph.incCap = KMH(25); o.keepCap = true; o.ok = true; o.dur = Math.max(0, D_NOW - o.T0); o.after = 'cut'; gWatchNext(o); }
    if (how === 'follow' && x.t) { const f = x.t; if (f.ph) f.ph.incCap = null; gSay(o.th2, `${t.no} を送り出しました。こちらは運転を続けます。`, null, 60); } });
}
// ----- 人身事故・線路支障 -----
function gBlock(o) {
  const t = o.t, p = t ? gDriver(t) : gStation(o.a), th = gThread(p, `${o.a}〜${o.b} ${o.jin ? '人身事故' : '線路支障'}`, o); o.th = th;
  const msg = o.jin && t ? `指令、こちら ${t.no}。${o.a}〜${o.b}間で人身事故です。非常ブレーキで停車しました。` : `指令、${o.a}駅です。${o.a}〜${o.b}間で線路支障の連絡が入りました(${o.dir === 'both' ? '上下線' : o.dir === 'down' ? '下り線' : '上り線'})。`;
  gSay(th, msg, [
    { l: '了解。付近の列車を抑止します。警察・消防と旅客指令へ連絡します', f: () => { gScore('安全', 2, '人身事故: すぐ抑止・関係先へ連絡'); gDeskTransfer(o); gSay(th, '了解。現場の確認を続けます。', null, gDelay(p, 20)); } },
    { l: '状況をもう少し詳しく報告してください', f: () => { gSay(th, `${o.jin ? '線路内に人が立ち入り、接触しました。' : '倒木で線路がふさがっています。'}処理に${Math.round(o.dur / 60)}分ほどかかる見込みです。`, [{ l: '了解。付近の列車を抑止し、関係先へ連絡します', f: () => { gScore('安全', 1, '人身事故: 確認してから抑止'); gDeskTransfer(o); } }], gDelay(p, 60)); } }], 0);
}
function gDeskTransfer(o) {   // 旅客指令: 振替輸送・案内
  const p = gDesk('旅客指令'), th = gThread(p, `${o.a}〜${o.b} 案内`, o);
  gSay(th, `旅客指令です。${o.a}〜${o.b}間の運転見合わせ、駅とお客さまへの案内はどうしますか。JR・バスへの振替輸送もできます。`, [
    { l: '運転見合わせを案内し、振替輸送を手配してください', f: () => { gScore('案内', 3, '見合わせ案内・振替輸送'); gSay(th, '了解、振替輸送を手配します。', null, gDelay(p, 30)); } },
    { l: '運転見合わせの案内だけしてください', f: () => { gScore('案内', 1, '見合わせ案内のみ'); gSay(th, '了解。', null, gDelay(p, 20)); } }], gDelay(p, 40));
}
function gBlockReady(o) {
  const p = o.th ? o.th.p : gStation(o.a); o.readyT = D_NOW;
  gSay(o.th, `${o.jin ? '現場の処理が終わりました' : '支障物を取り除きました'}。運転を再開できます。`, [
    { l: '運転を再開してください。現場は徐行で通過してください', f: () => { o.ok = true; const w = D_NOW - o.readyT; gScore('復旧', w < 120 ? 3 : w < 300 ? 1 : -2, `${o.a}〜${o.b}: 処理が終わってから再開まで ${Math.round(w)}秒`); gSay(o.th, '了解、運転を再開します。', null, 10); } },
    { l: 'もう少し待ってください(安全を確かめる)', f: () => { gScore('安全', 1, '再開前に安全を確認'); gLater(180, () => gBlockReady(o)); } }], 0);
}
// ----- 急病人・ドア故障 -----
function gDwell(o) {
  const p = gStation(o.st), th = gThread(p, `${o.st} 急病人`, o); o.th = th;
  gSay(th, `指令、${o.st}駅です。${o.dir === 'down' ? '下り' : o.dir === 'up' ? '上り' : ''}列車で急病のお客さまが出ました。救護しています。`, [
    { l: '救急車を要請してください。救護が終わるまで発車を待ちます', f: () => { gScore('案内', 2, `${o.st}: 救護を優先`); gSay(th, '了解、救急車を要請しました。', null, gDelay(p, 30)); } },
    { l: 'ホームへお連れして、列車はすぐ発車させてください', f: () => { o.dur = Math.round(o.dur * 0.4); if (o.t && o.t.ph && o.t.ph.incDw != null) o.t.ph.incDw = Math.min(o.t.ph.incDw, D_NOW + 90); gScore('定時', 2, `${o.st}: 列車を早く出した`); gScore('案内', -1, `${o.st}: 救護を急がせた`); gSay(th, '了解、ホームで救護します。列車を出します。', null, gDelay(p, 40)); } }], 0);
}
// ----- JR の人身事故による振替輸送 -----
function gJr(o) {
  const p = gDesk('旅客指令'), th = gThread(p, `JR ${o.line || ''} 振替輸送`, o); o.th = th;
  gSay(th, `旅客指令です。JR ${o.line || ''}で人身事故、運転見合わせです。振替輸送の要請が来ています(${(o.stations || []).join('・')})。`, [
    { l: '振替輸送を受けてください', f: () => { o.acc = true; gScore('案内', 3, 'JR の振替輸送を受けた'); gSay(th, `了解、受けます。${(o.stations || []).join('・')}が混み始めます。`, null, gDelay(p, 30)); } },
    { l: '受けないでください', f: () => { o.acc = false; gScore('案内', -3, 'JR の振替輸送を断った'); gSay(th, '了解、お断りします。', null, gDelay(p, 20)); } }], 0);
}
// ===== 画面(運転指令の右の欄「無線」) =====
{ const sec = document.createElement('section'); sec.id = 'radiosec'; sec.hidden = true;
  sec.innerHTML = `<h2>無線 <span id="radiobadge" class="rbadge" hidden></span><label class="inl rgame"><input id="radioon" type="checkbox" checked> ゲーム</label></h2><div id="radiocmd" hidden></div><div id="radiobox"></div>`;
  const a = $('dispsec'); if (a) a.after(sec);
  $('radioon').onchange = () => { D_GAME = $('radioon').checked; gRender(); };
  sec.addEventListener('click', e => { const b = e.target.closest('[data-rp]'); if (b) { gPick(+b.dataset.rp, +b.dataset.ri); return; } const h = e.target.closest('[data-rt]'); if (h) { const th = G.th.find(x => x.id === +h.dataset.rt); if (th) { th.fold = !th.fold; th.unread = 0; gRender(); } } });
}
function gRender() {
  const box = $('radiobox'); if (!box) return;
  const unread = G.th.reduce((a, th) => a + (th.choices ? 1 : 0), 0), bd = $('radiobadge'); if (bd) { bd.hidden = !unread; bd.textContent = unread; }
  if (!D_GAME) { box.innerHTML = '<p class="dp-sub">ゲーム(無線)は切っています。事故は指令の指示なしで、決めた時間で終わります。</p>'; return; }
  const h = G.th.slice(0, 12).map(th => { const last = th.msgs.slice(-4), p = th.p;
    return `<div class="rth${th.choices ? ' ask' : ''}"><div class="rhd" data-rt="${th.id}"><b>${th.title}</b><span>${gWho(p)}(${p.trait}・${p.mood})</span></div>${th.fold ? '' : `<ul class="rmsg">${last.map(m => `<li class="${m.me ? 'me' : ''}"><time>${ttSHMS(m.T).slice(0, 5)}</time>${m.me ? '指令: ' : ''}${m.text}</li>`).join('')}</ul>${th.choices ? `<div class="rch">${th.choices.map((c, i) => `<button data-rp="${th.id}" data-ri="${i}">${c.l}</button>`).join('')}</div>` : ''}`}</div>`; }).join('') || '<p class="dp-sub">無線は静かです。「事故・支障」で起こすか、自動で起きるのを待ってください。</p>';
  if (box._h !== h) { box.innerHTML = h; box._h = h; }
}
{ const f = dSetView; dSetView = function (v) { const r = f.apply(this, arguments); $('radiosec').hidden = v !== 'disp'; gRender(); return r; }; $('radiosec').hidden = dView !== 'disp'; }
{ const f = dIncReset; dIncReset = function () { gReset(); return f.apply(this, arguments); }; }
setInterval(() => { if (!$('radiosec').hidden) gRender(); }, 1000);
