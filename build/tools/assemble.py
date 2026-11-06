t=open('src/template.html',encoding='utf-8').read()
import os
opsu=open('ops_user.json',encoding='utf-8').read() if os.path.exists('ops_user.json') else '{}'
# 固定した平常時の計画(tools/mkfix.js → fix/plan_*.json.gz)。計画に効く入力の鍵(tools/fixkey.js と同じ計算)が合うものだけ埋める
import hashlib, gzip, base64, json
def fixkey():
    h=hashlib.sha1()
    for f in ['data.json','tt.json','src/core.js','src/ttcore.js','hensei.json','ops_user.json']:
        h.update((f+':').encode())
        if os.path.exists(f): h.update(open(f,'rb').read())
    return h.hexdigest()[:16]
FK=fixkey(); fixp={}
for day in ['wd','hd']:
    fp='fix/plan_%s.json.gz'%day
    if not os.path.exists(fp): print('fix', day, 'なし'); continue
    gz=open(fp,'rb').read(); k=json.loads(gzip.decompress(gz)).get('key')
    if k!=FK: print('fix', day, '古い(入力が変わった)ので埋めない。node tools/mkfix.js で作り直す'); continue
    fixp[day]=base64.b64encode(gz).decode(); print('fix', day, len(fixp[day]))
fixo={}
for day in ['wd','hd']:
    for sc in ['kq','all']:
        fp='fix/order_%s_%s.json.gz'%(day,sc)
        if not os.path.exists(fp): continue
        gz=open(fp,'rb').read(); k=json.loads(gzip.decompress(gz)).get('key')
        if k!=FK: print('order', day, sc, '古いので埋めない(node tools/mkorder.js で作り直す)'); continue
        fixo[day+'|'+sc]=base64.b64encode(gz).decode(); print('order', day, sc, len(fixo[day+'|'+sc]))
tt=open('src/tt.js',encoding='utf-8').read().replace('/*TT*/',open('tt.json',encoding='utf-8').read()).replace('/*OPSUSER*/null',opsu).replace('/*OPSUI*/',open('src/opsui.js',encoding='utf-8').read()).replace('/*FIXLOADJS*/',open('src/fixload.js',encoding='utf-8').read().replace('/*FIXPLAN*/null',json.dumps(fixp) if fixp else 'null').replace("/*FIXKEY*/''",json.dumps(FK)).replace('/*FIXORDER*/null',json.dumps(fixo) if fixo else 'null')).replace('/*PLANUI*/',open('src/planui.js',encoding='utf-8').read()).replace('/*HENSEIJS*/',open('src/hensei.js',encoding='utf-8').read().replace('/*HENSEI*/null',open('hensei.json',encoding='utf-8').read() if os.path.exists('hensei.json') else 'null')).replace('/*TTCORE*/',open('src/ttcore.js',encoding='utf-8').read()).replace('/*GEOHIST*/null',open('geo_hist.json',encoding='utf-8').read() if os.path.exists('geo_hist.json') else 'null')
ui=open('src/ui.js',encoding='utf-8').read().replace('/*TTJS*/',tt)
import os
disp=open('src/disp.js',encoding='utf-8').read().replace('/*PAX*/ null',open('pax.json',encoding='utf-8').read() if os.path.exists('pax.json') else 'null').replace('/*DISPCFG*/',open('disp_cfg.json',encoding='utf-8').read()).replace('/*DISPTUNE*/ null',open('disp_tune.json',encoding='utf-8').read() if os.path.exists('disp_tune.json') else 'null')
disp=disp+chr(10)+open('src/dinc.js',encoding='utf-8').read()+chr(10)+open('src/dcmd.js',encoding='utf-8').read()   # 事故・支障、指令の指示と臨時の列車
t=t.replace('/*DATA*/',open('data.json',encoding='utf-8').read()).replace('/*CORE*/',open('src/core.js',encoding='utf-8').read()).replace('/*DISP*/',disp).replace('/*UI*/',ui).replace('/*DISPUI*/',open('src/dispui.js',encoding='utf-8').read()+chr(10)+open('src/dincui.js',encoding='utf-8').read()+chr(10)+open('src/radio.js',encoding='utf-8').read()+chr(10)+open('src/radiocmd.js',encoding='utf-8').read()+chr(10)+open('src/cloud.js',encoding='utf-8').read())
open(os.environ.get('OUT','C:/Users/user/keikyu-haisen/index.html'),'w',encoding='utf-8').write(t)
print(len(t))
