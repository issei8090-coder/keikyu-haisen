// 京急配線シミュレーターの編集の保存先(Render)
// 画面の「運用の編集」「信号機の編集」を受け取り、GitHub のリポジトリの data/*.json に書く(無料プランで休止しても消えない)
// 読むのは画面が GitHub の raw から直接読む。ここは書くだけ(と確認用の GET)
// 環境変数: GITHUB_TOKEN(このリポジトリの Contents に書ける token)、EDIT_KEY(書くときの合言葉)、REPO、BRANCH、ALLOWED_ORIGIN
const http = require('http');
const { GITHUB_TOKEN, EDIT_KEY, REPO = 'issei8090-coder/keikyu-haisen', BRANCH = 'main', ALLOWED_ORIGIN = '*' } = process.env;
const PORT = process.env.PORT || 10000;
const FILES = { ops: 'data/ops_user.json', signals: 'data/disp_signals.json' };
const LABEL = { ops: '運用の編集', signals: '信号機の編集' };
const MAX = 4 * 1024 * 1024;

const gh = (path, opt = {}) => fetch('https://api.github.com/repos/' + REPO + '/contents/' + path + (opt.method ? '' : '?ref=' + BRANCH), {
  ...opt, headers: { Authorization: 'Bearer ' + GITHUB_TOKEN, Accept: 'application/vnd.github+json', 'User-Agent': 'keikyu-haisen-save', ...(opt.headers || {}) } });

async function readFile(kind) {
  const r = await gh(FILES[kind]);
  if (r.status === 404) return { sha: null, data: null };
  if (!r.ok) throw new Error('GitHub ' + r.status);
  const j = await r.json();
  return { sha: j.sha, data: JSON.parse(Buffer.from(j.content, 'base64').toString('utf8')) };
}
// 同じファイルへの書き込みは1つずつ(sha の食い違いを避ける)
const queue = {};
function writeFile(kind, data) {
  const run = async () => {
    const cur = await readFile(kind);
    const body = { message: LABEL[kind] + 'を保存', content: Buffer.from(JSON.stringify(data, null, 1) + '\n').toString('base64'), branch: BRANCH };
    if (cur.sha) body.sha = cur.sha;
    const r = await gh(FILES[kind], { method: 'PUT', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
    if (!r.ok) throw new Error('GitHub ' + r.status + ' ' + (await r.text()).slice(0, 200));
    return (await r.json()).commit.sha;
  };
  const p = (queue[kind] || Promise.resolve()).catch(() => { }).then(run);
  queue[kind] = p;
  return p;
}

function send(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': ALLOWED_ORIGIN, 'Access-Control-Allow-Methods': 'GET,PUT,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,X-Edit-Key' });
  res.end(JSON.stringify(obj));
}

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    if (req.method === 'OPTIONS') return send(res, 204, {});
    if (url.pathname === '/healthz') return send(res, 200, { ok: true, token: !!GITHUB_TOKEN, key: !!EDIT_KEY });
    const m = /^\/api\/edits\/(ops|signals)$/.exec(url.pathname);
    if (req.method === 'GET' && m) { const f = await readFile(m[1]); return send(res, 200, { data: f.data }); }
    if (req.method === 'POST' && url.pathname === '/api/check') return send(res, EDIT_KEY && req.headers['x-edit-key'] === EDIT_KEY ? 200 : 403, { ok: req.headers['x-edit-key'] === EDIT_KEY });
    if (req.method === 'PUT' && m) {
      if (!GITHUB_TOKEN || !EDIT_KEY) return send(res, 500, { error: 'サーバーの設定(GITHUB_TOKEN / EDIT_KEY)がありません' });
      if (req.headers['x-edit-key'] !== EDIT_KEY) return send(res, 403, { error: '編集キーが違います' });
      let size = 0; const chunks = [];
      for await (const c of req) { size += c.length; if (size > MAX) return send(res, 413, { error: '大きすぎます' }); chunks.push(c); }
      const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      const sha = await writeFile(m[1], data);
      return send(res, 200, { ok: true, commit: sha });
    }
    send(res, 404, { error: 'not found' });
  } catch (e) { send(res, 500, { error: String(e.message || e) }); }
}).listen(PORT, () => console.log('listening', PORT));
