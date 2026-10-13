'use strict';

const value=(v)=>v===undefined||v===null?'':v;
const detail=e=>e?`เคส ${e.cases||0} · ซ้ำ ${e.repeatCases||0} · KPI ${e.kpi?'ครบ':'ไม่ครบ'} · พิเศษ ${e.extraBonus||0} · แต้มสุทธิ ${e.delta??e.calculated??''}`:'';
const identity=(id,names,snapshotName)=>({employeeId:id||'',employeeName:snapshotName||names.get(id)||id||''});
const actor=(id,names,snapshotName)=>({performedBy:id||'',performedByName:snapshotName||names.get(id)||id||''});

function monthRows(record,names){
 return (record.entries||[]).map(entry=>({source:'ประวัติแต้มปัจจุบัน',date:record.editedAt||record.closedAt||'',month:record.month||'',...identity(entry.employeeId,names,entry.name),action:'ผลปิดเดือนล่าสุด',requestedPoints:'',pointChange:value(entry.delta),balanceBefore:value(entry.balanceBefore),balanceAfter:value(entry.balanceAfter),streakBefore:value(entry.streakBefore),streakAfter:value(entry.streakAfter),cases:value(entry.cases),repeatCases:value(entry.repeatCases),kpi:entry.kpi?'ใช่':'ไม่',top:record.topEmployeeId===entry.employeeId?'ใช่':'ไม่',extra:value(entry.extraBonus),reason:entry.repeatIssue||'',...actor(record.editedBy||record.closedBy,names),reference:record.month||'',beforeDetail:'',afterDetail:detail(entry)}));
}
function historyRows(entry,names,startMonth){
 if(!entry.date||entry.date.slice(0,7)<startMonth||(entry.kind==='point'&&entry.title==='สรุปแต้มประจำเดือน'))return [];
 return [{source:'ประวัติแต้มปัจจุบัน',date:entry.date,month:entry.date.slice(0,7),...identity(entry.employeeId,names,entry.employeeName),action:entry.title||entry.kind||'รายการแต้ม',requestedPoints:value(entry.requestedAmount),pointChange:value(entry.amount),balanceBefore:value(entry.balanceBefore),balanceAfter:value(entry.balanceAfter),streakBefore:'',streakAfter:'',cases:'',repeatCases:'',kpi:'',top:'',extra:'',reason:entry.detail||'',...actor(entry.performedBy,names,entry.performedByName),reference:entry.id||'',beforeDetail:'',afterDetail:''}];
}
function auditRows(entry,names){
 const base={source:'Log การจัดการ',date:entry.date||'',month:entry.month||entry.date?.slice(0,7)||'',...actor(entry.performedBy,names,entry.performedByName),reference:entry.id||''};
 if(entry.action==='closeMonth'){
  const old=new Map((entry.previousEntries||[]).map(e=>[e.employeeId,e]));
  return (entry.newEntries||[]).map(next=>({source:base.source,date:base.date,month:entry.month||'',...identity(next.employeeId,names,next.name),action:entry.edited?'แก้เดือนย้อนหลัง':'ปิดเดือน',requestedPoints:'',pointChange:'',balanceBefore:value(entry.previousBalances?.[next.employeeId]),balanceAfter:value(entry.newBalances?.[next.employeeId]),streakBefore:value(old.get(next.employeeId)?.streakAfter),streakAfter:value(next.streakAfter),cases:value(next.cases),repeatCases:value(next.repeatCases),kpi:next.kpi?'ใช่':'ไม่',top:entry.topEmployeeId===next.employeeId?'ใช่':'ไม่',extra:value(next.extraBonus),reason:entry.edited?'คำนวณเดือนถัดไปใหม่':'',performedBy:base.performedBy,performedByName:base.performedByName,reference:base.reference,beforeDetail:detail(old.get(next.employeeId)),afterDetail:detail(next)}));
 }
 return [{...base,...identity(entry.employeeId,names,entry.employeeName),action:entry.label||entry.action||'',requestedPoints:value(entry.requestedAmount),pointChange:value(entry.amount),balanceBefore:value(entry.balanceBefore),balanceAfter:value(entry.balanceAfter),streakBefore:'',streakAfter:'',cases:'',repeatCases:'',kpi:'',top:'',extra:'',reason:entry.reason||'',beforeDetail:entry.beforeDetail||'',afterDetail:entry.afterDetail||''}];
}
module.exports={monthRows,historyRows,auditRows};
