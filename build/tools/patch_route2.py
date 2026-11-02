p='src/disp.js'; s=open(p,encoding='utf-8').read()
a="""    for (const de of l.path) { const si = edgeStation[de >> 1]; if (si >= 0) { stN = ST[si].name; break; } }"""
b="""    for (const de of l.path) { const si = edgeStation[de >> 1]; if (si >= 0) { stN = ST[si].name; break; } }
    if (!stN) { let de = l.path[l.path.length - 1], len = 0;   // 進路の先の信号機までに駅が無ければ、まっすぐ 800m 先まで見る
      for (let g = 0; g < 40 && len < 800 && !stN; g++) { const sc = dSuccOf(de).filter(f => !E[f >> 1].portal); if (!sc.length) break; let b = sc[0]; for (const f of sc) if (dDot(de, f) > dDot(de, b)) b = f; de = b; len += dEm[de >> 1]; const si = edgeStation[de >> 1]; if (si >= 0) stN = ST[si].name; } }"""
assert s.count(a)==1; s=s.replace(a,b); open(p,'w',encoding='utf-8').write(s); print('ok')
