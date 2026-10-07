'use strict';
const rules=require('./rules.cjs');
class DomainError extends Error { constructor(message){super(message);this.code='failed-precondition';} }
const fail=message=>{throw new DomainError(message);};
const int=(value,min,max,label)=>{if(!Number.isSafeInteger(value)||value<min||value>max)fail(label);return value;};
const text=(value,max,label)=>{if(typeof value!=='string'||!value.trim()||value.trim().length>max)fail(label);return value.trim();};
const bool=value=>{if(typeof value!=='boolean')fail('ค่าที่ส่งมาไม่ถูกต้อง');return value;};
const image=value=>{if(value===null)return null;if(typeof value!=='string'||value.length>500000||!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(value))fail('รูปภาพไม่ถูกต้องหรือใหญ่เกินไป');return value;};
const nextMonth=month=>{const [y,m]=month.split('-').map(Number);return `${m===12?y+1:y}-${String(m===12?1:m+1).padStart(2,'0')}`;};
const member=e=>({...e,points:int(e.points,0,10000000,'ยอดแต้มเดิมไม่ถูกต้อง'),streak:int(e.streak,0,1200,'Clean Streak เดิมไม่ถูกต้อง')});
const pending=requests=>requests.filter(r=>r.status==='pending');
const reserved=(requests,id)=>pending(requests).filter(r=>r.employeeId===id).reduce((n,r)=>n+r.cost,0);
function redeem({actor,reward,requests,now}){
 if(!actor.active||actor.role!=='employee')fail('บัญชีนี้ขอแลกรางวัลไม่ได้');
 if(!reward?.active)fail('รางวัลนี้ปิดรับแลกแล้ว');
 int(reward.cost,1,100000,'แต้มรางวัลไม่ถูกต้อง');
 if(actor.points-reserved(requests,actor.id)<reward.cost)fail('แต้มพร้อมแลกไม่เพียงพอ');
 const year=Number(now.slice(0,4));
 if(reward.type==='cash'){
  if(reward.year!==year)fail('รางวัลยังไม่เปิดรอบปีนี้');
  const claimed=requests.filter(r=>r.type==='cash'&&r.year===year&&['pending','approved'].includes(r.status));
  if(claimed.some(r=>r.employeeId===actor.id))fail('ใช้สิทธิ์เงินรางวัลปีนี้แล้ว');
  if(claimed.filter(r=>r.rewardId===reward.id).length>=reward.stock)fail('สิทธิ์รางวัลครบแล้ว');
 }
 return {employeeId:actor.id,rewardId:reward.id,name:reward.name,cost:reward.cost,value:reward.value,type:reward.type,status:'pending',date:now,year:reward.year||year};
}
function decide({request,employee,status,now}){
 if(!request||request.status!=='pending')fail('คำขอนี้ดำเนินการแล้ว');
 if(!['approved','rejected'].includes(status))fail('สถานะไม่ถูกต้อง');
 if(status==='approved'&&(!employee?.active||employee.points<request.cost))fail('บัญชีหรือแต้มไม่พร้อมอนุมัติ');
 return {request:{...request,status,decidedAt:now},employee:status==='approved'?{...employee,points:employee.points-request.cost}:employee};
}
function closeMonth({employees,requests,months,startMonth,month,checks,teamTop,now}){
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))fail('เดือนผิดรูปแบบ');
 const latest=months.map(m=>m.month).sort().at(-1),expected=latest?nextMonth(latest):startMonth;
 if(month!==expected||month>=now.slice(0,7))fail('ปิดได้เฉพาะเดือนที่จบแล้วและเรียงตามลำดับ');
 if(months.some(m=>m.month===month))fail('เดือนนี้ปิดแล้ว');
 bool(teamTop);
 const active=employees.filter(e=>e.active&&e.role==='employee');
 if(!active.length||active.length>100)fail('จำนวนทีมต้องอยู่ระหว่าง 1–100 คน');
 if(!checks||typeof checks!=='object'||Array.isArray(checks))fail('รายการตรวจไม่ถูกต้อง');
 if(Object.keys(checks).some(id=>!active.some(e=>e.id===id)))fail('สมาชิกทีมเปลี่ยนแล้ว กรุณาตรวจใหม่');
 const entries=active.map(raw=>{
  const e=member(raw),check=checks[e.id]||{},cases=int(check.cases??0,0,999,'จำนวนเคสต้องเป็น 0–999'),kpi=bool(check.kpi??false)&&cases===0;
  const result=rules.award({streak:e.streak,balance:e.points,cases,kpi,teamTop});
  if(reserved(requests,e.id)>result.after)fail(`${e.name} มีคำขอที่กันแต้มเกินยอดหลังปิดเดือน`);
  return {employeeId:e.id,name:e.name,cases,kpi,base:result.base,kpiBonus:result.kpiBonus,teamBonus:result.teamBonus,deduction:result.deduction,calculated:result.calculated,delta:result.delta,balanceBefore:e.points,balanceAfter:result.after,streakBefore:e.streak,streakAfter:result.streakAfter};
 });
 return {month,teamTop,closedAt:now,entries};
}
function rewardInput(data,old,requests,year){
 const type=old?.type||data.type;if(!['coffee','cash'].includes(type))fail('ประเภทรางวัลไม่ถูกต้อง');
 const reward={name:text(data.name,70,'กรุณาระบุชื่อรางวัล'),description:text(data.description,140,'กรุณาระบุรายละเอียด'),cost:int(data.cost,1,100000,'แต้มรางวัลไม่ถูกต้อง'),value:int(data.value,1,100000,'มูลค่ารางวัลไม่ถูกต้อง'),type,active:bool(data.active),photo:image(data.photo??null)};
 if(type==='cash'){
  reward.year=old?.year||year;reward.stock=int(data.stock,1,3,'สิทธิ์เงินรางวัลต้องเป็น 1–3');
  const used=requests.filter(r=>r.rewardId===old?.id&&r.year===reward.year&&['pending','approved'].includes(r.status)).length;
  if(reward.stock<used)fail('สิทธิ์น้อยกว่าจำนวนที่จองแล้ว');
 }
 return reward;
}
module.exports={rules,DomainError,fail,int,text,bool,image,nextMonth,member,reserved,redeem,decide,closeMonth,rewardInput};
