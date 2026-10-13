'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Reporting=require('../functions/reporting.cjs'),CSV=require('../public/export.js');
const names=new Map([['a','บีม'],['admin','ปอนด์']]);

test('monthly point ledger exports current recalculated values and actor',()=>{
 const rows=Reporting.monthRows({month:'2026-08',closedAt:'2026-09-01T10:00:00+07:00',editedAt:'2026-10-12T12:00:00+07:00',closedBy:'admin',editedBy:'admin',topEmployeeId:'a',entries:[{employeeId:'a',cases:0,repeatCases:0,kpi:true,extraBonus:2,delta:12,balanceBefore:0,balanceAfter:12,streakBefore:0,streakAfter:1}]},names);
 assert.equal(rows.length,1);assert.equal(rows[0].source,'ประวัติแต้มปัจจุบัน');assert.equal(rows[0].balanceAfter,12);assert.equal(rows[0].performedByName,'ปอนด์');assert.equal(rows[0].top,'ใช่');
});
test('audit preserves before and after month edit without treating revision as another point transaction',()=>{
 const rows=Reporting.auditRows({id:'op1',action:'closeMonth',date:'2026-10-12T12:00:00+07:00',month:'2026-08',edited:true,performedBy:'admin',topEmployeeId:null,previousBalances:{a:20},newBalances:{a:17},previousEntries:[{employeeId:'a',cases:0,delta:7,streakAfter:1}],newEntries:[{employeeId:'a',cases:1,repeatCases:0,kpi:false,extraBonus:0,delta:3,streakAfter:0}]},names);
 assert.equal(rows.length,1);assert.equal(rows[0].action,'แก้เดือนย้อนหลัง');assert.equal(rows[0].pointChange,'');assert.equal(rows[0].balanceBefore,20);assert.equal(rows[0].balanceAfter,17);assert.match(rows[0].beforeDetail,/เคส 0/);assert.match(rows[0].afterDetail,/เคส 1/);
});
test('CSV has explicit columns, UTF-8 BOM, and neutralizes spreadsheet formulas',()=>{
 const row={source:'Log การจัดการ',date:'2026-10-12T12:00:00+07:00',employeeName:'=HYPERLINK("https://example.test")',reason:'+SUM(1,2)',pointChange:-4,balanceAfter:0};
 const csv=CSV.toCsv([row]);
 assert.ok(csv.startsWith('\uFEFF'));assert.match(csv,/"ชนิดบันทึก"/);assert.match(csv,/"ค่าก่อนแก้","ค่าหลังแก้"/);
 assert.match(csv,/"'=HYPERLINK\(""https:\/\/example.test""\)"/);assert.match(csv,/"'\+SUM\(1,2\)"/);assert.match(csv,/"-4"/);
});
test('persisted Point History excludes old or synthesized monthly duplicates',()=>{
 assert.equal(Reporting.historyRows({id:'old',date:'2026-07-31T12:00:00+07:00',kind:'adjustment',employeeId:'a'},names,'2026-08').length,0);
 assert.equal(Reporting.historyRows({id:'month',date:'2026-08-31T12:00:00+07:00',kind:'point',title:'สรุปแต้มประจำเดือน',employeeId:'a'},names,'2026-08').length,0);
 const row=Reporting.historyRows({id:'new',date:'2026-10-12T12:00:00+07:00',kind:'adjustment',employeeId:'a',performedBy:'admin',amount:-2,requestedAmount:-4,detail:'เรื่องเดิม'},names,'2026-08')[0];
 assert.equal(row.pointChange,-2);assert.equal(row.requestedPoints,-4);assert.equal(row.performedByName,'ปอนด์');
});
