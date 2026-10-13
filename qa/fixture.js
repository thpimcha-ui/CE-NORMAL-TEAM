document.addEventListener('DOMContentLoaded',()=>{
 const employees=[
  {id:'a',name:'บีม',username:'ce001',role:'employee',points:0,streak:0,active:true,photo:null},
  {id:'b',name:'เมย์',username:'ce002',role:'employee',points:0,streak:0,active:true,photo:null}
 ];
 const supervisor={id:'admin',name:'ปอนด์',username:'pond',role:'admin',points:0,streak:0,active:true,photo:null};
 const admin=location.pathname==='/qa-admin';
 const months=['2026-08','2026-09'];
 const records=Object.fromEntries(months.map(month=>[month,{
  month,topEmployeeId:month==='2026-09'?'a':null,teamTop:false,closedAt:month+'-28T12:00:00+07:00',
  entries:employees.map(e=>{const cases=e.id==='a'&&month==='2026-08'?2:0;return {employeeId:e.id,name:e.name,cases,repeatCases:e.id==='a'&&month==='2026-08'?1:0,repeatIssue:e.id==='a'&&month==='2026-08'?'Invoice number':'',kpi:cases===0,extraBonus:e.id==='a'&&month==='2026-09'?2:0};})
 }]));
 const monthLogs=records=>records.flatMap(m=>m.entries.map(e=>({id:'month-'+m.month+'-'+e.employeeId,employeeId:e.employeeId,title:'สรุปแต้มประจำเดือน',detail:`${m.month} · Inves ${e.cases} เคส −${e.deduction}`,amount:e.delta,kind:'point',date:`${m.month}-28T12:00:00+07:00`})));
 const requests=[{id:'r',employeeId:'b',rewardId:'coffee',name:'กาแฟแก้วโปรด',cost:10,value:50,type:'coffee',status:'pending',date:TODAY,year:YEAR}];
 const plan=CERules.replay({employees,requests,months:Object.values(records),startMonth:'2026-08'});
 for(const e of employees){const balance=plan.balances.get(e.id);e.points=balance.points;e.streak=balance.streak;}
 state={mode:'preview',revision:0,role:admin?'admin':'employee',me:admin?supervisor:employees[0],supervisor,employees:admin?employees:[employees[0]],
  rewards:[
   {id:'coffee',name:'กาแฟแก้วโปรด',description:'พักเติมพลังสักแก้ว',value:50,cost:10,type:'coffee',stock:5,remaining:5,active:true},
   {id:'wfh',name:'สิทธิ์ WFH 1 วัน',description:'อนุมัติแล้วตกลงวันกับ Supervisor',value:null,cost:15,type:'coffee',stock:2,remaining:2,special:true,active:true},
   {id:'cash',name:'รางวัลพิเศษ 1,000 บาท',description:'3 คนต่อปี · ใครถึงก่อนแลกก่อน',value:1000,cost:100,type:'cash',stock:3,year:YEAR,cashRemaining:3,active:true}
  ],requests:admin?requests:[],closedMonths:months,monthlyRecords:Object.fromEntries(plan.months.map(m=>[m.month,admin?m:{month:m.month,closedAt:m.closedAt,editedAt:m.editedAt||null,entries:m.entries.filter(e=>e.employeeId==='a')}])),logs:admin?monthLogs(plan.months):monthLogs(plan.months).filter(l=>l.employeeId==='a'),adjustments:[],
  startMonth:'2026-08',announcement:{title:'ไปต่อด้วยกัน ✦',body:'พื้นที่ทดสอบหน้าตาระบบ',active:true,version:1,updatedAt:TODAY},notificationReads:{},teamRank:{position:2,total:15,tied:false}};
 callFunction=async data=>({data:fixtureApi(data)});
 const audit=[];
 function fixtureApi(data){
  if(data.action==='state')return structuredClone(state);
  if(data.action==='exportPointRows'){
   if(!admin)throw new Error('เฉพาะ Supervisor');
   if(data.expectedRevision!==undefined&&data.expectedRevision!==state.revision)throw new Error('ข้อมูลเปลี่ยนระหว่างส่งออก');
   let rows=[];
   if(data.source==='month')rows=Object.values(state.monthlyRecords).flatMap(m=>m.entries.map(e=>({source:'ประวัติแต้มปัจจุบัน',date:m.editedAt||m.closedAt,month:m.month,employeeId:e.employeeId,employeeName:e.name,action:'ผลปิดเดือนล่าสุด',pointChange:e.delta,balanceBefore:e.balanceBefore,balanceAfter:e.balanceAfter,streakBefore:e.streakBefore,streakAfter:e.streakAfter,cases:e.cases,repeatCases:e.repeatCases,kpi:e.kpi?'ใช่':'ไม่',top:m.topEmployeeId===e.employeeId?'ใช่':'ไม่',extra:e.extraBonus,reason:e.repeatIssue||'',performedBy:'admin',performedByName:'ปอนด์',reference:m.month})));
   if(data.source==='history')rows=state.logs.filter(l=>l.kind==='adjustment'||l.kind==='reward').map(l=>({source:'ประวัติแต้มปัจจุบัน',date:l.date,month:l.date.slice(0,7),employeeId:l.employeeId,employeeName:state.employees.find(e=>e.id===l.employeeId)?.name||'',action:l.title,requestedPoints:l.requestedAmount,pointChange:l.amount,reason:l.detail,performedBy:'admin',performedByName:'ปอนด์',reference:l.id}));
   if(data.source==='audit')rows=audit;
   return {revision:state.revision,rows,nextCursor:null};
  }
  if(data.action==='adjustPoints'){
   if(!admin)throw new Error('เฉพาะ Supervisor');
   const person=state.employees.find(e=>e.id===data.id),amount=data.amount,reason=String(data.reason||'').trim();
   if(!person||!Number.isInteger(amount)||!amount||Math.abs(amount)>1000||reason.length<3||reason.length>140)throw new Error('จำนวนแต้ม หรือเหตุผลไม่ถูกต้อง');
   const before=person.points,after=Math.max(0,before+amount);
   const hold=state.requests.filter(r=>r.employeeId===person.id&&r.status==='pending').reduce((n,r)=>n+r.cost,0);
   if(amount<0&&after<hold)throw new Error('แต้มหลังปรับน้อยกว่าแต้มที่กันไว้ในคำขอรางวัล');
   if(after===before)throw new Error('ยอดแต้มไม่เปลี่ยน');
   person.points=after;
   const id='adjust-'+(++state.revision),entry={id,employeeId:person.id,title:amount>0?'เพิ่ม Point':'ลด Point',detail:reason,requestedAmount:amount,amount:after-before,kind:'adjustment',date:TODAY+'T12:00:00+07:00'};
   state.adjustments.push(entry);state.logs.push(entry);
   audit.push({source:'Log การจัดการ',date:entry.date,month:entry.date.slice(0,7),employeeId:person.id,employeeName:person.name,action:'ปรับ Point',requestedPoints:amount,pointChange:after-before,balanceBefore:before,balanceAfter:after,reason,performedBy:'admin',performedByName:'ปอนด์',reference:id});
   return {ok:true,balanceAfter:after};
  }
  if(data.action==='closeMonth'){
   if(!admin)throw new Error('เฉพาะ Supervisor');
   const old=state.monthlyRecords[data.month],latest=[...state.closedMonths].sort().at(-1);
   if(!old&&data.month!==nextMonth(latest))throw new Error('กรุณาปิดเดือนเรียงตามลำดับ');
   const participants=old?old.entries:state.employees.filter(e=>e.active);
   const entries=participants.map(e=>{const id=e.employeeId||e.id,c=data.checks[id]||{};return {employeeId:id,name:e.name,cases:Number(c.cases||0),repeatCases:Number(c.repeatCases||0),repeatIssue:c.repeatIssue||'',kpi:!!c.kpi,extraBonus:Number(c.extra||0)};});
   const draft={...(old||{}),month:data.month,teamTop:false,topEmployeeId:data.topEmployeeId||null,closedAt:old?.closedAt||TODAY,entries};
   const beforeBalances=Object.fromEntries(state.employees.map(e=>[e.id,e.points]));
   const rebuilt=CERules.replay({employees:state.employees,requests:state.requests,months:[...Object.values(state.monthlyRecords).filter(m=>m.month!==data.month),draft],startMonth:state.startMonth,adjustments:state.adjustments});
   state.monthlyRecords=Object.fromEntries(rebuilt.months.map(m=>[m.month,m]));state.closedMonths=rebuilt.months.map(m=>m.month);
   for(const e of state.employees){const balance=rebuilt.balances.get(e.id);e.points=balance.points;e.streak=balance.streak;}
   for(const change of rebuilt.adjustmentResults){const entry=state.adjustments.find(a=>a.id===change.id);if(entry)Object.assign(entry,change);}
   state.logs=[...state.logs.filter(l=>l.kind!=='point'),...monthLogs(rebuilt.months)];
   const revised=state.monthlyRecords[data.month];
   for(const entry of revised.entries){const previous=old?.entries.find(e=>e.employeeId===entry.employeeId);audit.push({source:'Log การจัดการ',date:TODAY+'T12:00:00+07:00',month:data.month,employeeId:entry.employeeId,employeeName:entry.name,action:old?'แก้เดือนย้อนหลัง':'ปิดเดือน',balanceBefore:beforeBalances[entry.employeeId],balanceAfter:state.employees.find(e=>e.id===entry.employeeId)?.points,streakBefore:previous?.streakAfter,streakAfter:entry.streakAfter,cases:entry.cases,repeatCases:entry.repeatCases,kpi:entry.kpi?'ใช่':'ไม่',top:revised.topEmployeeId===entry.employeeId?'ใช่':'ไม่',extra:entry.extraBonus,reason:old?'คำนวณเดือนถัดไปใหม่':'',performedBy:'admin',performedByName:'ปอนด์',reference:'qa-'+data.month,beforeDetail:previous?`เคส ${previous.cases} · แต้มสุทธิ ${previous.delta}`:'',afterDetail:`เคส ${entry.cases} · แต้มสุทธิ ${entry.delta}`});}
   state.revision++;return {ok:true,edited:!!old};
  }
  if(data.action==='decide'){
   if(!admin)throw new Error('เฉพาะ Supervisor');
   const request=state.requests.find(r=>r.id===data.id),person=state.employees.find(e=>e.id===request?.employeeId);
   if(!request||request.status!=='pending')throw new Error('คำขอนี้ดำเนินการแล้ว');
   if(!['approved','rejected'].includes(data.status))throw new Error('สถานะไม่ถูกต้อง');
   if(data.status==='approved'){
    if(!person?.active||person.points<request.cost)throw new Error('แต้มไม่พออนุมัติ');
    const before=person.points;
    person.points-=request.cost;
    audit.push({source:'Log การจัดการ',date:TODAY+'T12:00:00+07:00',month:TODAY.slice(0,7),employeeId:person.id,employeeName:person.name,action:'อนุมัติรางวัล',pointChange:-request.cost,balanceBefore:before,balanceAfter:person.points,reason:request.name,performedBy:'admin',performedByName:'ปอนด์',reference:request.id});
   }
   request.status=data.status;request.decidedAt=TODAY;state.revision++;return {ok:true};
  }
  if(data.action==='read'){state.notificationReads[admin?'admin':state.me.id]=data.ids;state.revision++;return {ok:true};}
  throw new Error('ตัวอย่างนี้จำลองการปิดและแก้ไขเดือนเท่านั้น');
 }
 role=state.role;loggedIn=true;currentEmployeeId=state.me.id;initialized=true;
 view=admin?(new URLSearchParams(location.search).get('view')==='rewards'?'admin-rewards':new URLSearchParams(location.search).get('view')==='monthly'?'monthly':'overview'):'home';
 selectedMonth=new URLSearchParams(location.search).get('month')||'2026-09';reportMonth='2026-09';loadMonthDraft(selectedMonth);render();
});
