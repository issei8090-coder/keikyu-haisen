// ===== 編集の保存先(GitHub のファイル + Render のサーバー) =====
// 運用の編集(USER_OPS)と信号機の編集(D_SIGMAN)は、リポジトリの data/ops_user.json・data/disp_signals.json に置く。
// 読む: GitHub の raw から直接(速い)。書く: Render のサーバー経由(編集キーが要る。無料プランなので休止中は起きるまで最大1分ほど)
// このブラウザの保存(localStorage)と比べて、saved(保存した時刻)が新しいほうを使う
const CLOUD = { api: 'https://keikyu-haisen.onrender.com', raw: 'https://raw.githubusercontent.com/issei8090-coder/keikyu-haisen/main/data/' };
const CLOUD_ON = /^https?:/.test(location.protocol);   // ファイルを直接開いたとき(file://)は使わない
let cloudKey = ''; try { cloudKey = localStorage.getItem('kq-editkey') || ''; } catch (e) { }
const cloudTimer = {};
function cloudMsg(s, bad) { const el = $('cloudmsg'); if (el) { el.textContent = s; el.className = 'hint' + (bad ? ' opswarn' : ''); } }
async function cloudGet(name) {
  try { const r = await fetch(CLOUD.raw + name + '?t=' + Date.now(), { cache: 'no-store' }); return r.ok ? await r.json() : null; } catch (e) { return null; }
}
// ページを開いたとき: 保存先の編集を読み込んでから時刻表を計算する(最大4秒待つ)
async function cloudInit() {
  if (!CLOUD_ON) { cloudMsg('ファイルを直接開いているので、編集はこのブラウザだけに保存します'); return; }
  fetch(CLOUD.api + '/healthz').catch(() => { });   // サーバーを起こしておく(保存のときに速い)
  const to = new Promise(r => setTimeout(() => r('to'), 4000));
  const got = await Promise.race([Promise.all([cloudGet('ops_user.json'), cloudGet('disp_signals.json'), cloudGet('disp_layout.json')]), to]);
  if (got === 'to') { cloudMsg('保存先を読めませんでした(このブラウザの編集で動いています)', true); return; }
  const [ops, sig, lay] = got;
  if (lay && (lay.saved || 0) > ((D_LAYEDIT && D_LAYEDIT.saved) || 0)) { D_LAYEDIT = Object.assign({ st: {}, len: {} }, lay); try { localStorage.setItem(D_LAYKEY, JSON.stringify(D_LAYEDIT)); } catch (e) { } try { dRelayout([]); dTabs.forEach(dTabGeom); if (dView === 'disp') dBuildBoard(); } catch (e) { } }
  if (ops && (ops.saved || 0) > ((USER_OPS && USER_OPS.saved) || 0)) { USER_OPS = ops; try { localStorage.setItem('kq-opsuser', JSON.stringify(USER_OPS)); } catch (e) { } }
  if (sig && sig.list && (sig.saved || 0) > ((D_SIGMAN && D_SIGMAN.saved) || 0)) { D_SIGMAN = { saved: sig.saved, list: sig.list }; try { localStorage.setItem(D_SIGKEY, JSON.stringify(D_SIGMAN)); } catch (e) { } if (typeof dSigApply === 'function') try { dSigApply(null); } catch (e) { } }
  cloudMsg(cloudKey ? '編集は保存先(GitHub)に自動で保存されます' : '編集キーを入れると、編集を保存先(GitHub)に保存してほかの端末でも見られます');
}
// 編集したとき: 1.5秒まとめてからサーバーへ送る
function cloudPush(kind, data) {
  if (!CLOUD_ON) return;
  if (!cloudKey) { cloudMsg('編集キーが無いので、このブラウザだけに保存しました'); return; }
  clearTimeout(cloudTimer[kind]);
  cloudTimer[kind] = setTimeout(async () => {
    cloudMsg('保存先へ送っています…(サーバーが休止中なら起きるまで最大1分)');
    try {
      const r = await fetch(CLOUD.api + '/api/edits/' + kind, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Edit-Key': cloudKey }, body: JSON.stringify(data) });
      const j = await r.json().catch(() => ({}));
      if (r.ok) cloudMsg(`保存しました(${hm(Math.floor((Date.now() / 1000 + 9 * 3600) % 86400 / 60))}、${kind === 'ops' ? '運用の編集' : kind === 'layout' ? '配線の編集' : '信号機の編集'})`);
      else cloudMsg('保存できませんでした: ' + (j.error || r.status), true);
    } catch (e) { cloudMsg('保存先に届きませんでした(このブラウザには保存済み): ' + e.message, true); }
  }, 1500);
}
// 編集キー
if ($('cloudkey')) {
  $('cloudkey').value = cloudKey;
  $('cloudkeyset').onclick = async () => {
    const k = $('cloudkey').value.trim(); cloudMsg('確かめています…');
    try {
      const r = await fetch(CLOUD.api + '/api/check', { method: 'POST', headers: { 'X-Edit-Key': k } });
      if (!r.ok) { cloudMsg('編集キーが違います', true); return; }
      cloudKey = k; try { localStorage.setItem('kq-editkey', k); } catch (e) { }
      cloudMsg('編集キーを覚えました。これからの編集は保存先に保存されます');
      if (USER_OPS && USER_OPS.saved) cloudPush('ops', USER_OPS);
    } catch (e) { cloudMsg('サーバーに届きません(休止中なら1分ほどして、もう一度押してください)', true); }
  };
}
// 信号機の編集の保存にも送信を足す
if (typeof dSigSave === 'function') { const f = dSigSave; dSigSave = function () { f.apply(this, arguments); cloudPush('signals', D_SIGMAN); }; }
