t=open('src/template.html',encoding='utf-8').read()
import os
opsu=open('ops_user.json',encoding='utf-8').read() if os.path.exists('ops_user.json') else '{}'
tt=open('src/tt.js',encoding='utf-8').read().replace('/*TT*/',open('tt.json',encoding='utf-8').read()).replace('/*OPSUSER*/null',opsu).replace('/*OPSUI*/',open('src/opsui.js',encoding='utf-8').read()).replace('/*TTCORE*/',open('src/ttcore.js',encoding='utf-8').read()).replace('/*GEOHIST*/null',open('geo_hist.json',encoding='utf-8').read() if os.path.exists('geo_hist.json') else 'null')
ui=open('src/ui.js',encoding='utf-8').read().replace('/*TTJS*/',tt)
import os
disp=open('src/disp.js',encoding='utf-8').read().replace('/*DISPCFG*/',open('disp_cfg.json',encoding='utf-8').read()).replace('/*DISPTUNE*/ null',open('disp_tune.json',encoding='utf-8').read() if os.path.exists('disp_tune.json') else 'null')
t=t.replace('/*DATA*/',open('data.json',encoding='utf-8').read()).replace('/*CORE*/',open('src/core.js',encoding='utf-8').read()).replace('/*DISP*/',disp).replace('/*UI*/',ui).replace('/*DISPUI*/',open('src/dispui.js',encoding='utf-8').read()+chr(10)+open('src/cloud.js',encoding='utf-8').read())
open(os.environ.get('OUT','C:/Users/user/keikyu-haisen/index.html'),'w',encoding='utf-8').write(t)
print(len(t))
