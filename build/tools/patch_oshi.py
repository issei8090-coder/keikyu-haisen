# 押上: 外側の線(1・4番線)は、シーサスクロッシングより外でしか本線とつながらない(haisenryakuzu.net の図)。折り返す列車は内側の2・3番線を使う
p = 'src/ttcore.js'; s = open(p, encoding='utf-8').read()
if 'ttAllowOshi' in s: print('already'); raise SystemExit
fn = '''// 押上(4線): 外側の1・4番線は、京成側・浅草線側ともシーサスクロッシングより外で本線につながる → 折り返す列車は内側の2・3番線だけ。反対側へそのまま進む列車は外側も使える
let OSHI_E = null;
function ttAllowOshi(t) {
  const n = t.names.length, a = t.names[0] === '押上', z = t.names[n - 1] === '押上';
  if ((!a && !z) || n < 2) return null;
  if (OSHI_E === null) { const s = stByName.get('押上'), l = s ? [...new Set(s.stops.map(([e]) => e))].sort((x, y) => N[E[x].a].y - N[E[y].a].y) : []; OSHI_E = l.length === 4 ? new Set([l[1], l[2]]) : false; }
  if (!OSHI_E) return null;
  const ks = nm => nm === '京成曳舟';
  const thruA = a && t.prev && t.prev.names.length > 1 && ks(t.prev.names[t.prev.names.length - 2]) !== ks(t.names[1]);
  const thruZ = z && t.next && t.next.names.length > 1 && ks(t.next.names[1]) !== ks(t.names[n - 2]);
  return (i, e) => !((i === 0 && a && !thruA) || (i === n - 1 && z && !thruZ)) || OSHI_E.has(e);
}
function ttAllow(t) {'''
s = s.replace('function ttAllow(t) {', fn, 1)
s = s.replace('ttAllowSg(t), ...MIDLOOP', 'ttAllowSg(t), ttAllowOshi(t), ...MIDLOOP', 1)
open(p, 'w', encoding='utf-8').write(s); print('ok')
