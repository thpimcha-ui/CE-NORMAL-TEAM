'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),D=require('../functions/domain.cjs');
const employee={id:'a',name:'A',role:'employee',active:true,points:10,streak:5};
const now='2026-10-07T15:00:00+07:00';
test('Investigation deducts old balance, resets streak, never creates debt',()=>{
 const report=D.closeMonth({employees:[employee],requests:[],months:[],startMonth:'2026-09',month:'2026-09',checks:{a:{cases:10,kpi:true}},teamTop:true,now});
 assert.equal(report.entries[0].balanceAfter,0);assert.equal(report.entries[0].delta,-10);assert.equal(report.entries[0].streakAfter,0);assert.equal(report.entries[0].kpiBonus,0);assert.equal(report.entries[0].teamBonus,0);
});
test('old tier applies before promotion',()=>{const e=D.closeMonth({employees:[{...employee,streak:1}],requests:[],months:[],startMonth:'2026-09',month:'2026-09',checks:{},teamTop:false,now}).entries[0];assert.equal(e.base,5);assert.equal(e.streakAfter,2);});
test('duplicate, current, skipped months and stale members are rejected',()=>{
 const base={employees:[employee],requests:[],months:[],startMonth:'2026-09',month:'2026-09',checks:{},teamTop:false,now};
 for(const change of [{month:'2026-10'},{month:'2026-08'},{months:[{month:'2026-09'}]},{checks:{intruder:{cases:0,kpi:true}}},{checks:{a:{cases:-1}}}])assert.throws(()=>D.closeMonth({...base,...change}));
});
test('pending holds block overspending and close with insufficient post-deduction points',()=>{
 const reward={id:'r',name:'coffee',active:true,cost:10,value:50,type:'coffee'},requests=[{employeeId:'a',cost:5,status:'pending'}];
 assert.throws(()=>D.redeem({actor:employee,reward,requests,now}));
 assert.throws(()=>D.closeMonth({employees:[employee],requests,months:[],startMonth:'2026-09',month:'2026-09',checks:{a:{cases:10,kpi:false}},teamTop:false,now}));
});
test('removed reward cannot be redeemed or accidentally reopened by editing',()=>{
 const old={id:'r',name:'coffee',description:'coffee',active:false,archived:true,activeBeforeArchive:true,archivedAt:'2026-10-08',cost:3,value:50,type:'coffee',photo:null};
 assert.throws(()=>D.redeem({actor:employee,reward:{...old,active:true},requests:[],now}));
 const edited=D.rewardInput({...old,active:true},old,[],2026);
 assert.equal(edited.archived,true);assert.equal(edited.active,false);assert.equal(edited.activeBeforeArchive,true);assert.equal(edited.archivedAt,old.archivedAt);
});
test('cash grants three slots total and one slot per person across cash rewards',()=>{
 const reward={id:'cash',name:'cash',active:true,cost:100,value:1000,type:'cash',stock:3,year:2026};
 const actor={...employee,points:200},requests=[1,2,3].map(n=>({employeeId:'x'+n,rewardId:'cash',type:'cash',year:2026,status:n===1?'pending':'approved',cost:100}));
 assert.throws(()=>D.redeem({actor,reward,requests,now}));
 assert.throws(()=>D.redeem({actor,reward,requests:[{...requests[0],employeeId:'a',rewardId:'other'}],now}));
 assert.equal(D.redeem({actor,reward,requests:requests.slice(0,2),now}).value,1000);
});
test('approval deducts exactly once, rejection does not change balance, redemption does not change streak',()=>{
 const request={status:'pending',cost:5},out=D.decide({request,employee,status:'approved',now});assert.equal(out.employee.points,5);assert.equal(out.employee.streak,5);assert.throws(()=>D.decide({request:out.request,employee:out.employee,status:'approved',now}));
 assert.equal(D.decide({request,employee,status:'rejected',now}).employee.points,10);
});
test('server rejects malformed images, invalid integer inputs and unbounded reward inputs',()=>{
 assert.throws(()=>D.image('javascript:alert(1)'));assert.throws(()=>D.int(-1,0,100,'bad'));assert.throws(()=>D.rewardInput({name:'X',description:'X',type:'cash',active:true,cost:1,value:1000,stock:4,photo:null},null,[],2026));
});
test('extra points are added per person before investigation deduction',()=>{
 const report=D.closeMonth({employees:[employee],requests:[],months:[],startMonth:'2026-09',month:'2026-09',checks:{a:{cases:2,kpi:false,extra:3}},teamTop:false,now});
 const entry=report.entries[0];assert.equal(entry.extraBonus,3);assert.equal(entry.calculated,5);assert.equal(entry.balanceAfter,15);assert.equal(entry.streakAfter,0);
 assert.throws(()=>D.closeMonth({employees:[employee],requests:[],months:[],startMonth:'2026-09',month:'2026-09',checks:{a:{extra:1001}},teamTop:false,now}));
});
test('general reward rights decrease only on approval',()=>{
 const reward={id:'wfh',name:'WFH',description:'one day',active:true,cost:3,value:null,type:'coffee',stock:1,special:true,photo:null};
 const input=D.rewardInput(reward,null,[],2026);assert.equal(input.stock,1);assert.equal(input.value,null);assert.equal(input.special,true);
 const request=D.redeem({actor:employee,reward:{...reward,...input},requests:[],now});
 const waiting=[{...request,id:'r1',status:'pending'}];
 assert.equal(D.redeem({actor:{...employee,id:'b'},reward:{...reward,...input},requests:waiting,now}).status,'pending');
 const approved=D.decide({request:waiting[0],employee,status:'approved',now,reward:{...reward,...input},requests:waiting});
 assert.equal(approved.employee.points,7);
 assert.throws(()=>D.decide({request:{...request,id:'r2'},employee:{...employee,id:'b'},status:'approved',now,reward:{...reward,...input},requests:[approved.request]}),/สิทธิ์รางวัลครบ/);
 assert.throws(()=>D.redeem({actor:{...employee,id:'b'},reward:{...reward,...input},requests:[approved.request],now}),/สิทธิ์รางวัลครบ/);
 const rejected=D.decide({request:{...request,id:'r2'},employee:{...employee,id:'b'},status:'rejected',now,reward:{...reward,...input},requests:waiting});
 assert.equal(rejected.employee.points,10);
});
test('normal reward stock cannot drop below approvals and cash still needs a price',()=>{
 const old={id:'wfh',name:'WFH',description:'one day',active:true,cost:3,value:null,type:'coffee',stock:2,special:true,photo:null};
 const requests=[{rewardId:'wfh',status:'approved'}];
 assert.throws(()=>D.rewardInput({...old,stock:0},old,requests,2026));
 assert.throws(()=>D.rewardInput({...old,type:'cash',value:null,stock:1},null,[],2026));
});

test('new tier boundaries are based only on clean streak',()=>{
 const expected={0:'Gold',1:'Gold',2:'Gold',3:'Diamond',5:'Diamond',6:'Master',10:'Master',11:'Predator',12:'Predator',20:'Predator'};
 for(const [streak,name] of Object.entries(expected))assert.equal(D.rules.tier(Number(streak)).name,name);
});
test('August 2026 baseline starts all 15 pilot employees at zero and blocks earlier months',()=>{
 const people=Array.from({length:15},(_,i)=>({...employee,id:`staff${i+1}`,name:`Staff ${i+1}`,points:999,streak:9}));
 const input={employees:people,requests:[],months:[],startMonth:'2026-08',checks:{},topEmployeeId:null,now:'2026-10-09T12:00:00+07:00'};
 assert.throws(()=>D.reviseMonth({...input,month:'2026-07'}),/เดือนเริ่มระบบ/);
 assert.throws(()=>D.reviseMonth({...input,month:'2026-09'}),/เรียง/);
 const august=D.reviseMonth({...input,month:'2026-08'});
 assert.equal(august.months[0].entries.length,15);
 assert.ok(august.months[0].entries.every(entry=>entry.balanceBefore===0&&entry.streakBefore===0));
 const september=D.reviseMonth({...input,months:august.months,month:'2026-09'});
 assert.equal(september.months[1].entries.length,15);
 assert.ok(september.months[1].entries.every(entry=>entry.streakBefore===1));
});
test('named Top awards five to winner and one to clean KPI teammates',()=>{
 const people=[{...employee,points:0,streak:0},{...employee,id:'b',name:'บี',points:0,streak:0},{...employee,id:'c',name:'ซี',points:0,streak:0}];
 const plan=D.reviseMonth({employees:people,requests:[],months:[],startMonth:'2026-01',month:'2026-01',checks:{a:{kpi:true},b:{kpi:true},c:{cases:1,kpi:false}},topEmployeeId:'b',now:'2026-10-09T12:00:00+07:00'});
 assert.equal(plan.months[0].entries.find(e=>e.employeeId==='a').balanceAfter,8);
 assert.equal(plan.months[0].entries.find(e=>e.employeeId==='b').balanceAfter,12);
 assert.equal(plan.months[0].entries.find(e=>e.employeeId==='c').balanceAfter,3);
 assert.equal(D.rules.summarize(plan.months[0]).topName,'บี');
});
test('editing a past month replays later months and approved rewards from zero without debt',()=>{
 const person={...employee,points:999,streak:9};
 const base={employees:[person],requests:[],startMonth:'2026-01',now:'2026-10-09T12:00:00+07:00',topEmployeeId:null};
 const jan=D.reviseMonth({...base,months:[],month:'2026-01',checks:{}});
 const request={employeeId:'a',cost:8,status:'approved',decidedAt:'2026-02-15T12:00:00+07:00'};
 const feb=D.reviseMonth({...base,requests:[request],months:jan.months,month:'2026-02',checks:{}});
 assert.equal(feb.months[1].entries[0].balanceAfter,5);
 const corrected=D.reviseMonth({...base,requests:[request],months:feb.months,month:'2026-01',checks:{a:{extra:5}}});
 assert.equal(corrected.months[0].entries[0].balanceAfter,10);
 assert.equal(corrected.months[1].entries[0].balanceBefore,2);
 assert.equal(corrected.months[1].entries[0].balanceAfter,7);
 assert.equal(corrected.balances.get('a').points,7);
 assert.equal(corrected.balances.get('a').streak,2);
 assert.throws(()=>D.reviseMonth({...base,months:jan.months,month:'2026-03',checks:{}}),/เรียง/);
});


test('repeat Investigation within one month costs four after the first case and resets next month',()=>{
 const run=(checks,months=[])=>D.reviseMonth({employees:[{...employee,points:999,streak:9}],requests:[],months,startMonth:'2026-01',month:months.length?'2026-02':'2026-01',checks,topEmployeeId:null,now:'2026-10-09T12:00:00+07:00'});
 const distinct=run({a:{cases:2}});
 const repeated=run({a:{cases:2,repeatCases:1,repeatIssue:'Invoice number'}});
 assert.equal(distinct.months[0].entries[0].deduction,4);
 assert.equal(repeated.months[0].entries[0].deduction,6);
 assert.equal(repeated.months[0].entries[0].balanceAfter,0);
 assert.equal(repeated.months[0].entries[0].streakAfter,0);
 const next=run({a:{cases:1}},repeated.months);
 assert.equal(next.months[1].entries[0].deduction,2);
 assert.equal(next.months[1].entries[0].repeatCases,0);
 assert.equal(D.rules.summarize(repeated.months[0]).repeatCases,1);
});

test('repeat case count and issue are validated before month close',()=>{
 const base={employees:[employee],requests:[],months:[],startMonth:'2026-01',month:'2026-01',topEmployeeId:null,now:'2026-10-09T12:00:00+07:00'};
 assert.throws(()=>D.reviseMonth({...base,checks:{a:{cases:1,repeatCases:1,repeatIssue:'Invoice number'}}}),/จำนวนเคสซ้ำ/);
 assert.throws(()=>D.reviseMonth({...base,checks:{a:{cases:2,repeatCases:1}}}),/ระบุเรื่อง/);
 const result=D.reviseMonth({...base,checks:{a:{cases:3,repeatCases:2,repeatIssue:'Invoice number'}}});
 assert.equal(result.months[0].entries[0].deduction,10);
});


test('Supervisor point adjustment requires reason, respects pending holds, and leaves Tier untouched',()=>{
 const e={...employee,points:10,streak:5};
 const plus=D.adjustPoints({employee:e,amount:5,reason:'แก้ไขแต้มตกหล่น'});
 assert.equal(plus.balanceAfter,15);assert.equal(plus.amount,5);assert.equal(e.streak,5);
 const floor=D.adjustPoints({employee:e,amount:-20,reason:'แก้ไขรายการซ้ำ'});
 assert.equal(floor.balanceAfter,0);assert.equal(floor.amount,-10);
 assert.throws(()=>D.adjustPoints({employee:e,amount:0,reason:'ทดสอบ'}));
 assert.throws(()=>D.adjustPoints({employee:{...e,points:0},amount:-2,reason:'รายการผิดซ้ำ'}),/ไม่เปลี่ยน/);
 assert.throws(()=>D.adjustPoints({employee:e,amount:2,reason:'x'}));
 assert.throws(()=>D.adjustPoints({employee:e,amount:-9,reason:'แก้ไขรายการซ้ำ',requests:[{employeeId:'a',cost:5,status:'pending'}]}),/กันไว้/);
});

test('historical month edit replays manual adjustments and updates their actual history amount',()=>{
 const person={...employee,points:999,streak:9};
 const base={employees:[person],requests:[],startMonth:'2026-01',now:'2026-10-09T12:00:00+07:00',topEmployeeId:null};
 const jan=D.reviseMonth({...base,months:[],month:'2026-01',checks:{}});
 const adjustment={id:'j1',employeeId:'a',date:'2026-02-10T12:00:00+07:00',requestedAmount:-7,amount:-5};
 const feb=D.reviseMonth({...base,months:jan.months,month:'2026-02',checks:{},adjustments:[adjustment]});
 assert.equal(feb.adjustmentResults[0].amount,-5);
 assert.equal(feb.balances.get('a').points,5);
 const corrected=D.reviseMonth({...base,months:feb.months,month:'2026-01',checks:{a:{extra:5}},adjustments:[adjustment]});
 assert.equal(corrected.adjustmentResults[0].amount,-7);
 assert.equal(corrected.balances.get('a').points,8);
 assert.equal(corrected.balances.get('a').streak,2);
});
