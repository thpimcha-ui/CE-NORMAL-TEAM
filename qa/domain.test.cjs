'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),D=require('../functions/domain.cjs');
const employee={id:'a',name:'A',role:'employee',active:true,points:10,streak:5};
const now='2026-10-07T15:00:00+07:00';
test('Investigation deducts old balance, resets streak, never creates debt',()=>{
 const report=D.closeMonth({employees:[employee],requests:[],months:[],startMonth:'2026-09',month:'2026-09',checks:{a:{cases:10,kpi:true}},teamTop:true,now});
 assert.equal(report.entries[0].balanceAfter,0);assert.equal(report.entries[0].delta,-10);assert.equal(report.entries[0].streakAfter,0);assert.equal(report.entries[0].kpiBonus,0);assert.equal(report.entries[0].teamBonus,1);
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
test('server rejects malformed images, negative budgets and unbounded reward inputs',()=>{
 assert.throws(()=>D.image('javascript:alert(1)'));assert.throws(()=>D.int(-1,0,100,'bad'));assert.throws(()=>D.rewardInput({name:'X',description:'X',type:'cash',active:true,cost:1,value:1000,stock:4,photo:null},null,[],2026));
});
test('extra points are added per person before investigation deduction',()=>{
 const report=D.closeMonth({employees:[employee],requests:[],months:[],startMonth:'2026-09',month:'2026-09',checks:{a:{cases:2,kpi:false,extra:3}},teamTop:false,now});
 const entry=report.entries[0];assert.equal(entry.extraBonus,3);assert.equal(entry.calculated,6);assert.equal(entry.balanceAfter,16);assert.equal(entry.streakAfter,0);
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
