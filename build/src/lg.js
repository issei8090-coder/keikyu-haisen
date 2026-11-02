// 西馬込の引上線・車庫線が、折り返しに使える経路になっているかを調べる
const fs = require('fs');
const D = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const TT = JSON.parse(fs.readFileSync('tt.json', 'utf8'));
eval(fs.readFileSync('src/core.js', 'utf8') + fs.readFileSync('src/ttcore.js', 'utf8') + `
mainThru();
const st = stByName.get('西馬込'), nb = stByName.get('馬込');
console.log('platform edges', [...st.stopMap.keys()].map(e => e + ' y' + N[E[e].a].y + ' dir' + E[e].dir).join(', '));
for (const sd of SIDINGS.get('西馬込')) {
  const back = findRoute({ e: sd.e, t: sd.t }, [st.stopMap, nb.stopMap], null, null, false);
  let ww = 0; if (!back.fail) for (const g of cutAt(back, back.total)) { const e = E[g.e], sdir = Math.sign(g.bx - g.ax); if (e.dir && sdir && sdir !== e.dir) ww += g.d1 - g.d0; }
  const back1 = findRoute({ e: sd.e, t: sd.t }, [st.stopMap], null, null, false);
  const r = buildTimedRoute(['馬込', '西馬込'], [0, 0], { tail: sd, after: null });
  const rb = buildTimedRoute(['馬込', '西馬込'], [0, 0], {});
  console.log('siding node', N[sd.node].x + ',' + N[sd.node].y, 'e' + sd.e, '| back fail', !!back.fail, 'd', back.fail ? '-' : back.stops[0].d.toFixed(0), 'into e' + (back.fail ? '-' : cutAt(back, back.stops[0].d).pop().e), 'wrongway', ww.toFixed(0),
    '| back1 cost', back1.fail ? 'fail' : back1.cost.toFixed(0) + ' total ' + back1.total.toFixed(0), '| route to siding', r ? 'ok stops ' + r.stopD.map(x => x.toFixed(0)).join('/') + ' plat e' + r.stopE[1] : 'FAIL', '| plain plat e' + (rb ? rb.stopE[1] + ' d ' + rb.stopD[1].toFixed(0) : '-'));
}
`);
