# 画面全体を京急の淡い青を軸にした落ち着いた配色に(2026-11-05、ユーザー「もっと上質なデザインに、京急の淡い青とか」)
#  ダーク: 青みのある濃紺の面 + 淡い青(#7cbcf0)のアクセント(上に乗る文字は濃紺)。ライト: 白地 + 青(#2f86c9)。京急の赤は上の細い帯だけ。
#  運転指令の盤: 濃紺の地に淡い青の光、格子・ホーム・タブ・目盛りも淡い青の系統。進路=ミント、在線=コーラル、選択=金。
#  順番: patch_dispdesign → この patch(_tmp/ui/template.html.before_kqblue から作るので何度当てても同じ)
import io, os, shutil
p = 'src/template.html'; b = '_tmp/ui/template.html.before_kqblue'
if not os.path.exists(b): shutil.copy(p, b)
s = io.open(b, encoding='utf-8', newline='').read(); NL = '\r\n' if '\r\n' in s else '\n'
def rep(a, c, label, n=1):
    global s
    a = a.replace('\n', NL); c = c.replace('\n', NL)
    assert s.count(a) == n, (label, s.count(a)); s = s.replace(a, c)
# ---- トークン(ダーク)
rep("""    --bg:#0b1018; --surface:#111925; --surface-2:#172131; --surface-3:#1e2a3d; --elev:#1a2433;
    --line:#243044; --line-2:#33425b;
    --ink:#e6ebf2; --ink-2:#c3ccd8; --sub:#8b97a8; --faint:#7d899b;
    --accent:#2563eb; --accent-ink:#fff; --accent-soft:rgba(59,130,246,.18);""",
"""    --bg:#08111d; --surface:#0d1828; --surface-2:#122136; --surface-3:#192b45; --elev:#112035;
    --line:#1b2b42; --line-2:#28405f;
    --ink:#e9f1fb; --ink-2:#c5d4e7; --sub:#8ea3bf; --faint:#7a91ae;
    --accent:#7cbcf0; --accent-ink:#04203d; --accent-soft:rgba(124,188,240,.15); --accent-2:#a9d4f5;""", 'tok-dark')
rep("    --map-bg:#0d141f; --track:#86a8ff; --plat:#2f4fb8; --stname:#c9d7ff; --pink:#ff5aac;\n    --halo:#0d141f;\n    --board-bg:#0a0e14; --board-line:#232c3a;\n    --shadow:0 10px 30px rgba(0,0,0,.45);",
    "    --map-bg:#0a1524; --track:#8ab9ec; --plat:#3d6fb0; --stname:#cfe3f8; --pink:#ff5aac;\n    --halo:#0a1524;\n    --board-bg:#0a1524; --board-line:#1b2b42;\n    --shadow:0 14px 36px rgba(0,8,22,.55);", 'tok-map')
# ---- トークン(ライト)
rep("""    --bg:#eef1f6; --surface:#fff; --surface-2:#f5f7fa; --surface-3:#e9edf3; --elev:#fff;
    --line:#dde2ea; --line-2:#c9d1dd;
    --ink:#1a2230; --ink-2:#344054; --sub:#5f6b7d; --faint:#6b7585;
    --accent:#1d4ed8; --accent-soft:rgba(29,78,216,.10);""",
"""    --bg:#edf3f9; --surface:#fff; --surface-2:#f4f8fc; --surface-3:#e5eef7; --elev:#fff;
    --line:#d8e3ee; --line-2:#c2d3e4;
    --ink:#132238; --ink-2:#2f4560; --sub:#5a6f88; --faint:#677c95;
    --accent:#2f86c9; --accent-ink:#fff; --accent-soft:rgba(47,134,201,.12); --accent-2:#1f6aa6;""", 'tok-light')
# ---- アクセントの上の文字は --accent-ink(淡い青の上は濃紺)
rep("  .seg button.on { background:var(--accent); color:#fff; }", "  .seg button.on { background:var(--accent); color:var(--accent-ink); box-shadow:0 1px 0 rgba(255,255,255,.18) inset, 0 2px 8px rgba(124,188,240,.25); }", 'seg')
rep("background:var(--accent); border-color:var(--accent); color:#fff; }\n  .transport #play:hover", "background:var(--accent); border-color:var(--accent); color:var(--accent-ink); box-shadow:0 2px 10px rgba(124,188,240,.3); }\n  .transport #play:hover", 'play')
rep(".dtabs button.on { background:var(--accent); color:#fff; }", ".dtabs button.on { background:var(--accent); color:var(--accent-ink); }", 'dtabs')
rep("  .se-row button.on { background:var(--accent); border-color:var(--accent); color:#fff; font-weight:700; }", "  .se-row button.on { background:var(--accent); border-color:var(--accent); color:var(--accent-ink); font-weight:700; }", 'serow')
# ---- 上部バー: 面に淡い青の光、京急の赤は細く
rep("  .top::before { content:\"\"; position:absolute; left:0; right:0; top:0; height:3px; background:var(--brand); }",
    "  .top { background:linear-gradient(180deg, color-mix(in srgb, var(--accent) 7%, var(--surface)), var(--surface)); }\n  .top::before { content:\"\"; position:absolute; left:0; right:0; top:0; height:2px; background:var(--brand); }", 'top')
rep("  .transport { display:flex; align-items:center; gap:10px; flex:1; min-width:420px; padding:3px 10px 3px 4px; background:var(--surface-2); border:1px solid var(--line); border-radius:12px; }",
    "  .transport { display:flex; align-items:center; gap:10px; flex:1; min-width:420px; padding:3px 10px 3px 4px; background:var(--surface-2); border:1px solid var(--line); border-radius:12px; box-shadow:0 1px 0 rgba(255,255,255,.03) inset; }", 'transport')
rep("  section, .card { background:var(--surface); border:1px solid var(--line); border-radius:var(--r); padding:12px 14px; }",
    "  section, .card { background:linear-gradient(180deg, color-mix(in srgb, var(--accent) 4%, var(--surface)), var(--surface) 60%); border:1px solid var(--line); border-radius:var(--r); padding:12px 14px; box-shadow:0 1px 0 rgba(255,255,255,.025) inset; }", 'card')
# ---- 運転指令の盤
rep("  .boardwrap { --b-bg:#0b0f15; --b-head:#0f141c; --b-line:#1d2531; --b-line-2:#2a3443; --b-ink:#dfe5ee; --b-sub:#8390a2; --b-faint:#5f6b7c; --b-acc:#4d8dff;\n    flex:1; min-width:0; display:flex; flex-direction:column; overflow:hidden; background:var(--b-bg); border:1px solid var(--b-line); border-radius:12px; color:var(--b-ink); }",
    "  .boardwrap { --b-bg:#0a1524; --b-head:#0c1a2d; --b-line:#18283e; --b-line-2:#24405f; --b-ink:#e6f0fb; --b-sub:#8aa2c0; --b-faint:#6c86a6; --b-acc:#7cbcf0;\n    flex:1; min-width:0; display:flex; flex-direction:column; overflow:hidden; background:radial-gradient(1400px 520px at 18% -8%, rgba(124,188,240,.09), transparent 62%), var(--b-bg); border:1px solid var(--b-line); border-radius:12px; color:var(--b-ink); box-shadow:var(--shadow); }", 'board')
rep("  .bhead { flex:none; display:flex; flex-direction:column; gap:10px; padding:12px 14px 10px; background:var(--b-head); border-bottom:1px solid var(--b-line); }",
    "  .bhead { flex:none; display:flex; flex-direction:column; gap:10px; padding:12px 14px 10px; background:linear-gradient(180deg, rgba(124,188,240,.06), rgba(124,188,240,0)), var(--b-head); border-bottom:1px solid var(--b-line); }", 'bhead')
rep("  #btabs { display:flex; gap:6px; overflow-x:auto; scrollbar-width:thin; scrollbar-color:#2a3443 transparent; padding-bottom:2px; }", "  #btabs { display:flex; gap:6px; overflow-x:auto; scrollbar-width:thin; scrollbar-color:#24405f transparent; padding-bottom:2px; }", 'btabs')
rep("  #btabs button:hover { background:#141b26; border-color:#364256; }", "  #btabs button:hover { background:rgba(124,188,240,.06); border-color:#2f5076; }", 'btabh')
rep("  #btabs .tr { font-size:13px; font-weight:700; color:#c3ccd8; white-space:nowrap; }".replace('.tr ', '.btr '), "  #btabs .btr { font-size:13px; font-weight:700; color:#c8d8ea; white-space:nowrap; letter-spacing:.02em; }", 'btr')
rep("  #btabs button.on { background:#132036; border-color:#355fae; box-shadow:inset 0 -2px 0 var(--b-acc); }", "  #btabs button.on { background:linear-gradient(180deg, rgba(124,188,240,.18), rgba(124,188,240,.08)); border-color:rgba(124,188,240,.6); box-shadow:inset 0 -2px 0 var(--b-acc), 0 4px 14px rgba(124,188,240,.12); }", 'btabon')
rep("  #btabs button.on .btr { color:#fff; } #btabs button.on .btl { color:#9fb4d6; }", "  #btabs button.on .btr { color:#fff; } #btabs button.on .btl { color:#a9d4f5; }", 'btabon2')
rep("  #sigbar button:hover { background:#141b26; }", "  #sigbar button:hover { background:rgba(124,188,240,.07); }", 'sbh')
rep("  #sigbar button.on { background:var(--b-acc); border-color:var(--b-acc); color:#fff; font-weight:700; }", "  #sigbar button.on { background:var(--b-acc); border-color:var(--b-acc); color:#04203d; font-weight:700; }", 'sbon')
rep("  .bscroll { flex:1; min-height:0; overflow:auto; scrollbar-color:#2a3443 transparent; }", "  .bscroll { flex:1; min-height:0; overflow:auto; scrollbar-color:#24405f transparent; }", 'bscroll')
rep("  .bfoot details[open] summary { background:#141b26; }", "  .bfoot details[open] summary { background:rgba(124,188,240,.08); }", 'bfoot1')
rep("background:#121923; border:1px solid var(--b-line-2); border-radius:10px; box-shadow:0 12px 30px rgba(0,0,0,.5); line-height:1.75; color:#b6c0cd;", "background:#0f1e33; border:1px solid var(--b-line-2); border-radius:10px; box-shadow:0 14px 34px rgba(0,8,22,.6); line-height:1.75; color:#b9cbe0;", 'bfoot2')
rep("  .bfoot summary { cursor:pointer; color:#aab6c6;", "  .bfoot summary { cursor:pointer; color:#a9c4e2;", 'bfoot3')
# 盤の絵
rep("  .bk-grid { stroke:#fff; stroke-opacity:.022; stroke-width:1; } .bk-grid.maj { stroke-opacity:.05; }", "  .bk-grid { stroke:#7cbcf0; stroke-opacity:.035; stroke-width:1; } .bk-grid.maj { stroke-opacity:.075; }", 'grid')
rep("  .bk-track { fill:none; stroke:#525d6e;", "  .bk-track { fill:none; stroke:#4f6886;", 'track')
rep("  .bk-plat { fill:#1a2331; stroke:#33415a; stroke-width:.8; }", "  .bk-plat { fill:rgba(124,188,240,.09); stroke:rgba(124,188,240,.38); stroke-width:.8; }", 'plat')
rep("  .bk-st { font-size:14.5px; fill:#e9eef5;", "  .bk-st { font-size:14.5px; fill:#eef5fd;", 'st')
rep("stroke:#0b0f15; stroke-width:4px; stroke-linejoin:round; }", "stroke:#0a1524; stroke-width:4px; stroke-linejoin:round; }", 'stk')
rep("  .bk-stkm { font:10px var(--font-num); fill:#6c7889; text-anchor:middle; paint-order:stroke; stroke:#0b0f15; stroke-width:3px; }", "  .bk-stkm { font:10px var(--font-num); fill:#7fa6cc; text-anchor:middle; paint-order:stroke; stroke:#0a1524; stroke-width:3px; letter-spacing:.04em; }", 'stkm')
rep("  .bk-tick { stroke:#2c3646; stroke-width:.8; }", "  .bk-tick { stroke:#28405f; stroke-width:.8; }", 'tick')
rep("  .bk-km { font:10.5px var(--font-num); fill:#6c7889; text-anchor:middle; }", "  .bk-km { font:10.5px var(--font-num); fill:#6f8fb3; text-anchor:middle; }", 'km')
rep("  .bk-ends { font-size:11px; fill:#8390a2; font-weight:700; }", "  .bk-ends { font-size:11px; fill:#8aa9cc; font-weight:700; }", 'ends')
rep("  .bk-vmax rect { fill:#b98a2e; opacity:.42; } .bk-vmax.lo rect { fill:#c4553f; opacity:.5; }", "  .bk-vmax rect { fill:#c9a24a; opacity:.38; } .bk-vmax.lo rect { fill:#d2694f; opacity:.48; }", 'vmax')
rep("  .bk-lock { fill:none; stroke:#3ccf8e;", "  .bk-lock { fill:none; stroke:#5fdcae;", 'lock')
rep("  .bk-occb { fill:none; stroke:#f0605a;", "  .bk-occb { fill:none; stroke:#ff6f6f;", 'occb')
rep("  .bk-occ { fill:none; stroke:#f0605a;", "  .bk-occ { fill:none; stroke:#ff6f6f;", 'occ')
rep("  .bk-train.sel .bk-occ { stroke:#fbbf24; }", "  .bk-train.sel .bk-occ { stroke:#ffd36b; }", 'selocc')
rep("  .bk-selc { fill:none; stroke:#fbbf24;", "  .bk-selc { fill:none; stroke:#ffd36b;", 'selc')
rep("  .bk-labline { stroke:#3a4556; stroke-width:.8; stroke-dasharray:2 2; }", "  .bk-labline { stroke:#3a5778; stroke-width:.8; stroke-dasharray:2 2; }", 'labline')
rep("  .bk-labbox { fill:#0f151e; fill-opacity:.95; stroke-width:1; stroke-opacity:.5; }", "  .bk-labbox { fill:#0c1a2c; fill-opacity:.95; stroke-width:1; stroke-opacity:.5; }", 'labbox')
rep("  .bk-lab.sel .bk-labbox { fill:#2a2410; stroke:#fbbf24; stroke-opacity:1; }", "  .bk-lab.sel .bk-labbox { fill:#2a2612; stroke:#ffd36b; stroke-opacity:1; }", 'labsel')
rep("  .bk-labv { font:10.5px var(--font-num); fill:#8f9bab;", "  .bk-labv { font:10.5px var(--font-num); fill:#8fb0d4;", 'labv')
rep("  .bk-late { font:700 10.5px var(--font-num); fill:#fbbf24;", "  .bk-late { font:700 10.5px var(--font-num); fill:#ffc95c;", 'late')
rep("  .bk-sig .bk-head { fill:#05070a; stroke:#6b7686; stroke-width:.5; }", "  .bk-sig .bk-head { fill:#050a12; stroke:#5d7898; stroke-width:.5; }", 'sighead')
rep("  .bk-sig .bk-post { stroke:#6b7686; stroke-width:.7; }", "  .bk-sig .bk-post { stroke:#5d7898; stroke-width:.7; }", 'sigpost')
rep("  .bk-sig.blk .bk-head { stroke:#4c5666; }", "  .bk-sig.blk .bk-head { stroke:#46607e; }", 'sigblk')
rep("  .bk-sig.usr .bk-head { stroke:#9fb3cc; }", "  .bk-sig.usr .bk-head { stroke:#a9d4f5; }", 'sigusr')
rep("#sigmsg { color:#fbbf24; }", "#sigmsg { color:#ffc95c; }", 'sigmsg')
# 凡例の色
rep('<i style="background:#3ccf8e"></i>確保された進路', '<i style="background:#5fdcae"></i>確保された進路', 'lg1')
rep('<i style="background:#f0605a"></i>在線(閉塞)', '<i style="background:#ff6f6f"></i>在線(閉塞)', 'lg2')
rep('<i style="background:#b98a2e;opacity:.8;height:6px"></i>速度制限', '<i style="background:#c9a24a;opacity:.75;height:6px"></i>速度制限', 'lg3')
rep('<span style="color:#fbbf24">遅れ</span>', '<span style="color:#ffc95c">遅れ</span>', 'lg4')
# 右の欄の数字タイル
rep("  .dp-stats div { background:var(--surface-2); border:1px solid var(--line); border-radius:8px; padding:7px 9px 6px; }", "  .dp-stats div { background:linear-gradient(180deg, color-mix(in srgb, var(--accent) 8%, var(--surface-2)), var(--surface-2)); border:1px solid var(--line); border-radius:9px; padding:8px 10px 7px; }", 'stats')
io.open(p, 'w', encoding='utf-8', newline='').write(s); print('kqblue ok')
