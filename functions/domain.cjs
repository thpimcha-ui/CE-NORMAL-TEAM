'use strict';
const rules=require('./rules.cjs');
class DomainError extends Error { constructor(message){super(message);this.code='failed-precondition';} }
const fail=message=>{throw new DomainError(message);};
const int=(value,min,max,label)=>{if(!Number.isSafeInteger(value)||value<min||value>max)fail(label);return value;};
const text=(value,max,label)=>{if(typeof value!=='string'||!value.trim()||value.trim().length>max)fail(label);return value.trim();};
const bool=value=>{if(typeof value!=='boolean')fail('ค่าที่ส่งมาไม่ถูกต้อง');return value;};
const image=value=>{if(value===null)return null;if(typeof value!=='string'||value.length>500000||!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(value))fail('รูปภาพไม่ถูกต้องหรือใหญ่เกินไป');return value;};
const nextMonth=month=>{const [y,m]=month.split('-').map(Number);return `${m===12?y+1:y}-${String(m===12?1:m+1).padStart(2,'0')}`;};
const repeatInput=(check,cases)=>{const repeatCases=int(check.repeatCases??0,0,Math.max(0,cases-1),'จำนวนเคสซ้ำต้องไม่เกินเคสทั้งหมดลบหนึ่ง');return {repeatCases,repeatIssue:repeatCases?text(check.repeatIssue,140,'กรุณาระบุเรื่องที่เกิดซ้ำ'):''};};
const member=e=>({...e,points:int(e.points,0,10000000,'ยอดแต้มเดิมไม่ถูกต้อง'),streak:int(e.streak,0,1200,'Clean Streak เดิมไม่ถูกต้อง')});
const pending=requests=>requests.filter(r=>r.status==='pending');
const reserved=(requests,id)=>pending(requests).filter(r=>r.employeeId===id).reduce((n,r)=>n+r.cost,0);
function redeem({actor,reward,requests,now}){
 if(!actor.active||actor.role!=='employee')fail('บัญชีนี้ขอแลกรางวัลไม่ได้');
 if(!reward?.active||reward.archived)fail('รางวัลนี้ปิดรับแลกแล้ว');
 int(reward.cost,1,100000,'แต้มรางวัลไม่ถูกต้อง');
 if(actor.points-reserved(requests,actor.id)<reward.cost)fail('แต้มพร้อมแลกไม่เพียงพอ');
 if(reward.type!=='cash'&&reward.stock!=null&&requests.filter(r=>r.rewardId===reward.id&&r.status==='approved').length>=reward.stock)fail('สิทธิ์รางวัลครบแล้ว');
 const year=Number(now.slice(0,4));
 if(reward.type==='cash'){
  if(reward.year!==year)fail('รางวัลยังไม่เปิดรอบปีนี้');
  const claimed=requests.filter(r=>r.type==='cash'&&r.year===year&&['pending','approved'].includes(r.status));
  if(claimed.some(r=>r.employeeId===actor.id))fail('ใช้สิทธิ์เงินรางวัลปีนี้แล้ว');
  if(claimed.filter(r=>r.rewardId===reward.id).length>=reward.stock)fail('สิทธิ์รางวัลครบแล้ว');
 }
 return {employeeId:actor.id,rewardId:reward.id,name:reward.name,cost:reward.cost,value:reward.value,type:reward.type,status:'pending',date:now,year:reward.year||year};
}
function decide({request,employee,status,now,reward,requests=[]}){
 if(!request||request.status!=='pending')fail('คำขอนี้ดำเนินการแล้ว');
 if(!['approved','rejected'].includes(status))fail('สถานะไม่ถูกต้อง');
 if(status==='approved'&&(!employee?.active||employee.points<request.cost))fail('บัญชีหรือแต้มไม่พร้อมอนุมัติ');
 if(status==='approved'&&request.type!=='cash'&&reward?.stock!=null&&requests.filter(r=>r.rewardId===request.rewardId&&r.status==='approved').length>=reward.stock)fail('สิทธิ์รางวัลครบแล้ว กรุณาปฏิเสธคำขอนี้');
 return {request:{...request,status,decidedAt:now},employee:status==='approved'?{...employee,points:employee.points-request.cost}:employee};
}
function adjustPoints({employee,amount,reason,requests=[]}){
 if(!employee||employee.role!=='employee')fail('ปรับแต้มได้เฉพาะพนักงาน');
 const before=member(employee).points,requestedAmount=int(amount,-1000,1000,'ปรับ Point ได้ครั้งละ −1000 ถึง +1000');
 if(requestedAmount===0)fail('จำนวน Point ต้องไม่เป็น 0');
 const detail=text(reason,140,'กรุณาระบุเหตุผล');
 if(detail.length<3)fail('เหตุผลต้องมีอย่างน้อย 3 ตัวอักษร');
 const after=Math.max(0,Math.min(10000000,before+requestedAmount));
 if(after===before)fail('ยอดแต้มไม่เปลี่ยน กรุณาตรวจจำนวนที่ปรับ');
 if(requestedAmount<0&&reserved(requests,employee.id)>after)fail('แต้มหลังปรับน้อยกว่าแต้มที่กันไว้ในคำขอรางวัล');
 return {requestedAmount,amount:after-before,balanceBefore:before,balanceAfter:after,reason:detail};
}
function closeMonth({employees,requests,months,startMonth,month,checks,teamTop=false,topEmployeeId=null,now}){
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))fail('เดือนผิดรูปแบบ');
 const latest=months.map(m=>m.month).sort().at(-1),expected=latest?nextMonth(latest):startMonth;
 if(month!==expected||month>=now.slice(0,7))fail('ปิดได้เฉพาะเดือนที่จบแล้วและเรียงตามลำดับ');
 if(months.some(m=>m.month===month))fail('เดือนนี้ปิดแล้ว');
 bool(teamTop);
 const selectedTop=topEmployeeId||null;
 if(selectedTop!==null&&typeof selectedTop!=='string')fail('Top Performance ไม่ถูกต้อง');
 if(selectedTop&&teamTop)fail('เลือก Top Performance ได้แบบเดียว');
 const active=employees.filter(e=>e.active&&e.role==='employee');
 if(!active.length||active.length>100)fail('จำนวนทีมต้องอยู่ระหว่าง 1–100 คน');
 if(selectedTop&&!active.some(e=>e.id===selectedTop))fail('ไม่พบพนักงาน Top Performance');
 if(!checks||typeof checks!=='object'||Array.isArray(checks))fail('รายการตรวจไม่ถูกต้อง');
 if(Object.keys(checks).some(id=>!active.some(e=>e.id===id)))fail('สมาชิกทีมเปลี่ยนแล้ว กรุณาตรวจใหม่');
 const entries=active.map(raw=>{
  const e=member(raw),check=checks[e.id]||{},cases=int(check.cases??0,0,999,'จำนวนเคสต้องเป็น 0–999'),kpi=bool(check.kpi??false)&&cases===0,extra=int(check.extra??0,0,1000,'Point พิเศษต้องเป็น 0–1000'),{repeatCases,repeatIssue}=repeatInput(check,cases);
  const result=rules.award({streak:e.streak,balance:e.points,cases,repeatCases,kpi,top:selectedTop===e.id,teamTop:selectedTop ? selectedTop!==e.id : teamTop,extra});
  if(reserved(requests,e.id)>result.after)fail(`${e.name} มีคำขอที่กันแต้มเกินยอดหลังปิดเดือน`);
  return {employeeId:e.id,name:e.name,cases,repeatCases,repeatIssue,kpi,base:result.base,kpiBonus:result.kpiBonus,teamBonus:result.teamBonus,extraBonus:result.extraBonus,deduction:result.deduction,calculated:result.calculated,delta:result.delta,balanceBefore:e.points,balanceAfter:result.after,streakBefore:e.streak,streakAfter:result.streakAfter};
 });
 return {month,teamTop,topEmployeeId:selectedTop,closedAt:now,entries};
}
function reviseMonth({employees,requests,months,startMonth,month,checks,topEmployeeId,adjustments=[],now}){
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||month<startMonth||month>=now.slice(0,7))fail('เลือกได้เฉพาะเดือนที่จบแล้วตั้งแต่เดือนเริ่มระบบ');
 if(months.length>240)fail('ประวัติเดือนมากเกินกว่าจะคำนวณในครั้งเดียว');
 const old=months.find(m=>m.month===month),latest=months.map(m=>m.month).sort().at(-1);
 if(!old&&month!==(latest?nextMonth(latest):startMonth))fail('กรุณาปิดเดือนเรียงจากเดือนเริ่มระบบ');
 if(!checks||typeof checks!=='object'||Array.isArray(checks))fail('รายการตรวจไม่ถูกต้อง');
 const participants=old?old.entries.map(e=>({id:e.employeeId,name:e.name})):employees.filter(e=>e.active&&e.role==='employee');
 if(!participants.length||participants.length>100)fail('จำนวนทีมต้องอยู่ระหว่าง 1–100 คน');
 if(Object.keys(checks).some(id=>!participants.some(e=>e.id===id)))fail('สมาชิกทีมในเดือนนี้ไม่ตรงกัน กรุณาตรวจใหม่');
 const top=topEmployeeId||null;
 if(top!==null&&(typeof top!=='string'||!participants.some(e=>e.id===top)))fail('Top Performance ไม่ถูกต้อง');
 const entries=participants.map(e=>{const check=checks[e.id]||{},cases=int(check.cases??0,0,999,'จำนวนเคสต้องเป็น 0–999'),{repeatCases,repeatIssue}=repeatInput(check,cases);return {employeeId:e.id,name:employees.find(x=>x.id===e.id)?.name||e.name,cases,repeatCases,repeatIssue,kpi:bool(check.kpi??false)&&cases===0,extraBonus:int(check.extra??0,0,1000,'Point พิเศษต้องเป็น 0–1000')};});
 const draft={...old,month,topEmployeeId:top,teamTop:false,closedAt:old?.closedAt||now,editedAt:old?now:null,entries};
 const rebuilt=rules.replay({employees,requests,months:[...months.filter(m=>m.month!==month),draft],startMonth,adjustments});
 return {...rebuilt,edited:!!old};
}
function rewardInput(data,old,requests,year){
 const type=old?.type||data.type;if(!['coffee','cash'].includes(type))fail('ประเภทรางวัลไม่ถูกต้อง');
 const reward={name:text(data.name,70,'กรุณาระบุชื่อรางวัล'),description:text(data.description,140,'กรุณาระบุรายละเอียด'),cost:int(data.cost,1,100000,'แต้มรางวัลไม่ถูกต้อง'),value:data.value==null?null:int(data.value,1,100000,'มูลค่ารางวัลไม่ถูกต้อง'),type,special:bool(data.special??false),active:old?.archived?false:bool(data.active),archived:Boolean(old?.archived),photo:image(data.photo??null)};
 if(old?.archived){reward.activeBeforeArchive=old.activeBeforeArchive===true;if(old.archivedAt)reward.archivedAt=old.archivedAt;if(old.archivedBy)reward.archivedBy=old.archivedBy;}
 if(type==='cash'){
  if(reward.value===null)fail('เงินรางวัลต้องระบุมูลค่า');
  reward.year=old?.year||year;reward.stock=int(data.stock,1,3,'สิทธิ์เงินรางวัลต้องเป็น 1–3');
  const used=requests.filter(r=>r.rewardId===old?.id&&r.year===reward.year&&['pending','approved'].includes(r.status)).length;
  if(reward.stock<used)fail('สิทธิ์น้อยกว่าจำนวนที่จองแล้ว');
 }else{
  reward.stock=data.stock==null&&old&&old.stock==null?null:int(data.stock,1,999,'สิทธิ์รางวัลต้องเป็น 1–999');
  const used=requests.filter(r=>r.rewardId===old?.id&&r.status==='approved').length;
  if(reward.stock!=null&&reward.stock<used)fail('สิทธิ์น้อยกว่าจำนวนที่อนุมัติแล้ว');
 }
 return reward;
}
module.exports={rules,DomainError,fail,int,text,bool,image,nextMonth,member,reserved,redeem,decide,adjustPoints,closeMonth,reviseMonth,rewardInput};
