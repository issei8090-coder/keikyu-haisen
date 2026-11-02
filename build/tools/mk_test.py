# 確認用: index.html に、列車へカーソルを当てた状態を再現するスクリプトを足した test_list.html を作る
import io
s = io.open('C:/Users/user/keikyu-haisen/index.html', encoding='utf-8').read()
js = """<script>setTimeout(()=>{try{ttListRender();
const c=ttActive.filter(t=>t.g&&!t.unit&&!t.cut);
let t=c.find(t=>ttRun(t).key&&ttList.filter(x=>ttRun(x).key===ttRun(t).key).length>8)||c[0];
ttOpsShow(t,{clientX:420,clientY:120});
const lens=[...new Set(ttList.map(x=>ttRun(x).key).filter(Boolean))].map(k=>ttList.filter(x=>ttRun(x).key===k).length).sort((a,b)=>a-b);
console.log("TESTOK list="+document.querySelectorAll("#ttlist li").length+" ops="+document.querySelectorAll("#ttops li:not(.gap)").length+" gaps="+document.querySelectorAll("#ttops li.gap").length+" title="+document.querySelector("#ttops h3").textContent+" groups="+lens.length+" median="+lens[lens.length>>1]+" max="+lens[lens.length-1]);
}catch(e){console.log("TESTERR "+e.message)}},4000)</script></body>"""
io.open('test_list.html', 'w', encoding='utf-8').write(s.replace('</body>', js))
