(function(root){
 'use strict';
 const columns=[
  ['source','ชนิดบันทึก'],['date','วันเวลา'],['month','เดือน'],['employeeId','รหัสพนักงาน'],['employeeName','พนักงาน'],
  ['action','รายการ'],['requestedPoints','แต้มที่ขอปรับ'],['pointChange','แต้มที่มีผล'],['balanceBefore','ยอดก่อน'],['balanceAfter','ยอดหลัง'],
  ['streakBefore','Clean ก่อน'],['streakAfter','Clean หลัง'],['cases','Investigation'],['repeatCases','เคสซ้ำ'],
  ['kpi','KPI ครบ'],['top','Top Performance'],['extra','Point พิเศษ'],['reason','เหตุผล / รายละเอียด'],
  ['performedBy','รหัสผู้ดำเนินการ'],['performedByName','ผู้ดำเนินการ'],['reference','รหัสรายการ'],['beforeDetail','ค่าก่อนแก้'],['afterDetail','ค่าหลังแก้']
 ];
 function cell(value){
  const original=String(value??'');
  const safe=/^[\s]*[=+@-]/.test(original)&&!/^[-+]?\d+(?:\.\d+)?$/.test(original)||/^[\t\r\n]/.test(original)?"'"+original:original;
  return '"'+safe.replace(/"/g,'""')+'"';
 }
 function toCsv(rows){
  const ordered=[...rows].sort((a,b)=>String(a.date||'').localeCompare(String(b.date||''))||String(a.source||'').localeCompare(String(b.source||''))||String(a.employeeName||'').localeCompare(String(b.employeeName||'')));
  return '\uFEFF'+[columns.map(([,title])=>cell(title)).join(','),...ordered.map(row=>columns.map(([key])=>cell(row[key])).join(','))].join('\r\n')+'\r\n';
 }
 function download(csv,filename){
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download=filename;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
 }
 const api={columns,toCsv,download};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.CEExport=api;
})(typeof globalThis!=='undefined'?globalThis:this);
