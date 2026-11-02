# 会話の記録から、貼り付けられた運用表を取り出して ops/ に保存する
#   th_wd / th_hd : 直通運用(01T〜87H)   kq_wd / kq_hd : 京急の行路表
import io, json, re
src = r'C:\Users\user\.claude\projects\C--Users-user\40b6f50a-af66-492e-9d23-f6f6fd6f5415.jsonl'
got = {}
def walk(o):
    if isinstance(o, str):
        if '<pasted_content' not in o: return
        for m in re.finditer(r'<pasted_content[^>]*>([\s\S]*?)</pasted_content', o):
            s = m.group(1); k = None
            if '87H' in s and '01T' in s and '浅草橋0500' in s: k = 'th_wd' if '0633日本医' in s else 'th_hd' if '0650日本医' in s else None
            elif '行路' in s: k = 'kq_wd' if '0605横須賀' in s else 'kq_hd' if '久里浜0826→0838三崎口' in s else None
            if k: got[k] = s
    elif isinstance(o, dict):
        for v in o.values(): walk(v)
    elif isinstance(o, list):
        for v in o: walk(v)
for ln in io.open(src, encoding='utf-8'):
    if '87H' not in ln and '行路' not in ln: continue
    try: walk(json.loads(ln))
    except Exception as e: print('err', e)
for k, s in sorted(got.items()):
    ls = [l for l in s.replace('\r', '').replace('高速バスを予約', '').replace('地図を見る', '').splitlines() if l.strip()]
    if k == 'kq_wd' and '行路' not in ls[0]: ls.insert(0, '1行路')
    io.open('ops/%s.txt' % k, 'w', encoding='utf-8', newline='\n').write('\n'.join(ls) + '\n')
    print(k, len(ls))
