from pathlib import Path
import re
root=Path(__file__).resolve().parents[1]
prototype=root.parent/'ce-point-lite-v1'
app=(prototype/'app.js').read_text(encoding='utf-8')
start=app.index('function seed(){')
end=app.index("const app=document.getElementById('app')")
app=app[:start]+'''let state={employees:[],requests:[],rewards:[],logs:[],closedMonths:[],monthlyRecords:{},announcement:{active:false}};
let currentEmployeeId='',role='employee',view='home',filter='all',selectedMonth=CURRENT_MONTH,checks={},toastTimer;
let loggedIn=false,teamTop=false,reportMonth=CURRENT_MONTH,draftRewardPhoto=null,photoBusy=false;
'''+app[end:]
app=re.sub(r"const save=\(\)=>\{.*?\};\n", "const save=()=>{throw new Error('Use server API');};\n",app,count=1)
for name in ['confirmRedeem','confirmRequest','confirmClose','uploadPhoto']:
    pattern=r'^(?:async )?function '+name+r'\('
    match=re.search(pattern,app,re.M)
    if not match: raise ValueError(name)
    following=re.search(r'^function ',app[match.end():],re.M)
    stop=match.end()+following.start() if following else len(app)
    app=app[:match.start()]+app[stop:]
app=app.replace('<div class="demo-strip"><span>โหมดทดลอง · ข้อมูลตัวอย่าง ${count} คน</span><button data-action="reset">เริ่มทดลองใหม่</button></div>', '<div class="demo-strip"><span>${state.mode===\'preview\'?\'เว็บทดสอบ · ยอดแต้มสำเนา ไม่กระทบเว็บเดิม\':\'ทีม CE · Normal Point\'}</span><button data-action="refresh">รีเฟรชข้อมูล</button></div>')
role_start=app.index('<div class="role-switch"')
role_end=app.index('${notificationButton()}',role_start)
app=app[:role_start]+app[role_end:]
app=app.replace("role==='employee'?esc(self().name):'ปอนด์'",'esc(profileOwner().name)')
app=app.replace("state.employees.filter(e=>e.active).length", "state.employees.filter(e=>e.active&&e.role==='employee').length")
app=app.replace("rank=1+active.filter(x=>x.streak>e.streak).length,tied=active.filter(x=>x.streak===e.streak).length>1", "rank=state.teamRank.position,tied=state.teamRank.tied")
app=app.replace('${active.length}</span>','${state.teamRank.total}</span>')
app=app.replace("selectedMonth===nextMonth(latest)","selectedMonth===(latest?nextMonth(latest):state.startMonth)")
app=app.replace('min="2026-08"','min="${state.startMonth}"')
app=app.replace('การสร้างบัญชีในต้นแบบเป็นข้อมูลทดลอง ยังไม่ใช่บัญชีเข้าสู่ระบบจริง','ส่งชื่อผู้ใช้และรหัสชั่วคราวให้แต่ละคนเป็นการส่วนตัว · ครั้งแรกให้ตั้งรหัสของตัวเอง')
app=app.replace('ต้นแบบนี้ยังไม่สร้างบัญชีเข้าสู่ระบบจริง','ระบบสร้างรหัสชั่วคราวให้ และให้ตั้งรหัสส่วนตัวเมื่อเข้าใช้งานครั้งแรก')
app=app.replace('<button class="text-button" data-action="toggle-employee"', '<button class="text-button" data-action="reset-password" data-id="${e.id}">รหัสชั่วคราวใหม่</button><button class="text-button" data-action="toggle-employee"')
app=app.replace("const cashLeft=(reward)=>Math.max(0,reward.stock-cashUsed(reward));", "const cashLeft=(reward)=>reward.cashRemaining??Math.max(0,reward.stock-cashUsed(reward));")
app=app.replace("const eligible=rewardEligibility(r);", "const eligible=admin?{ok:false,text:''}:rewardEligibility(r);")
(root/'public/app.js').write_text(app,encoding='utf-8')
ext=(prototype/'extensions.js').read_text(encoding='utf-8')
ext=ext[:ext.index('function demoRecords()')]+ext[ext.index('function announcementBanner()'):]
click=ext.index("document.addEventListener('click'")
change=ext.index("document.addEventListener('change'",click)
ext=ext[:click]+ext[change:]
ext=ext[:ext.index("document.addEventListener('submit'")]
ext=ext.replace("document.addEventListener('DOMContentLoaded',()=>render());",'')
(root/'public/extensions.js').write_text(ext,encoding='utf-8')
enh=(prototype/'enhancements.js').read_text(encoding='utf-8')
enh=enh[:enh.index("document.addEventListener('submit'")]
enh=enh.replace("function profileOwner(){return role==='admin'?(state.supervisor??={name:'ปอนด์',photo:null}):self();}","function profileOwner(){return state.me||self();}")
enh=enh.replace('save();}',"queueReadSync();}")
(root/'public/enhancements.js').write_text(enh,encoding='utf-8')
html=(prototype/'index.html').read_text(encoding='utf-8').replace('</body>','  <script src="production.js" defer></script>\n</body>')
(root/'public/index.html').write_text(html,encoding='utf-8')
