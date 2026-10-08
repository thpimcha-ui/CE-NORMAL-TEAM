'use strict';

function coin(className='') {
  return `<span class="point-coin ${className}" role="img" aria-label="เหรียญ Point"></span>`;
}
function signed(number) { return number > 0 ? `+${number}` : String(number); }
function announcementBanner() {
  const a=state.announcement;
  if(!a?.active||!a.title)return '';
  return `<aside class="announcement-banner"><div class="announcement-mark">${icon('spark')}</div><div><small>ประกาศจาก Supervisor</small><strong>${esc(a.title)}</strong></div><button class="text-button" data-action="read-announcement">อ่านประกาศ</button></aside>`;
}
function showAnnouncement() {
  const a=state.announcement;if(!a?.active||!a.title)return;
  openDialog('ประกาศถึงทีม',`<div class="announcement-dialog"><span class="pill lime">จาก Supervisor</span><h3>${esc(a.title)}</h3><p class="announcement-body">${esc(a.body)}</p><small class="muted">อัปเดต ${dateText(a.updatedAt||TODAY)}</small></div>`,`<button class="primary" data-action="dismiss">รับทราบ ไปต่อเลย</button>`);
}
function editAnnouncement() {
  const a=state.announcement||defaultAnnouncement();
  openDialog('ประกาศถึงทีม',`<form id="announcement-form" class="dialog-fields"><label>หัวข้อประกาศ<input name="title" value="${esc(a.title)}" maxlength="90" required></label><label>รายละเอียด<textarea name="body" rows="6" maxlength="1800" required>${esc(a.body)}</textarea></label><label class="check"><input name="active" type="checkbox" ${a.active?'checked':''}>แสดงประกาศเมื่อเข้าสู่ระบบ</label><p>พนักงานจะเห็นประกาศนี้หลังเข้าสู่ระบบ และอ่านซ้ำจากหน้าหลักได้</p><div id="form-error" class="error-text" role="alert"></div><div class="dialog-actions"><button type="button" class="secondary" data-action="dismiss">กลับ</button><button class="primary" type="submit">บันทึกประกาศ</button></div></form>`);
}
function donut(summary) {
  const pct=summary.people?summary.clean/summary.people*100:0;
  return `<div class="donut-layout"><div class="donut-chart" role="img" aria-label="พนักงาน Clean ${summary.clean} คน มี Investigation ${summary.affected} คน จากทั้งหมด ${summary.people} คน" style="--clean-percent:${pct}%;${summary.people?'':'background:var(--line)'}"><div><strong>${summary.clean}<small>/${summary.people}</small></strong><span>คน Clean</span></div></div><div class="donut-legend"><div><span class="legend-dot clean"></span><span>ไม่มี Inves</span><strong>${summary.clean} คน</strong></div><div><span class="legend-dot inves"></span><span>มี Inves</span><strong>${summary.affected} คน</strong></div><p>รวม ${summary.cases} เคส<br>หนึ่งคนอาจมีมากกว่า 1 เคส</p></div></div>`;
}
function trendChart() {
  const months=[];let [year,month]=reportMonth.split('-').map(Number);
  for(let i=5;i>=0;i--){const d=new Date(year,month-1-i,1);months.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);}
  const rows=months.map(m=>({month:m,summary:CERules.summarize(state.monthlyRecords[m])}));
  const max=Math.max(1,...rows.map(r=>r.summary?.cases??0));
  return `<div class="trend-chart" role="group" aria-label="จำนวน Investigation ย้อนหลัง 6 เดือน"><div class="chart-scale"><span>${max} เคส</span><span>0</span></div><div class="bar-plot">${rows.map(r=>{
    const n=r.summary?.cases;
    return `<button class="bar-column ${r.month===reportMonth?'selected':''}" data-action="report-month" data-month="${r.month}" ${n===undefined?'disabled':''} aria-label="${monthText(r.month)} ${n===undefined?'ไม่มีข้อมูล':n+' เคส'}"><span class="bar-value">${n===undefined?'—':n}</span><span class="bar-space"><span class="bar-fill ${n===undefined?'no-data':''}" style="height:${n===undefined?3:Math.max(n===0?1:3,n/max*100)}%"></span></span><span class="bar-label">${new Date(r.month+'-01T12:00:00').toLocaleDateString('th-TH',{month:'short'})}</span></button>`;
  }).join('')}</div></div>`;
}
function reportDetail() {
  const record=state.monthlyRecords[reportMonth];
  if(!record)return toast('เดือนนี้ยังไม่มีรายละเอียดรายคน');
  openDialog('รายละเอียด '+monthText(reportMonth),`<p>Investigation นับเป็นเคส ส่วน Clean นับเป็นคน</p><div class="report-detail-list">${record.entries.map(e=>`<div><span>${esc(e.name)}</span><span class="${e.cases?'negative':'accent'}">${e.cases?e.cases+' เคส':'Clean'}</span></div>`).join('')}</div>`,`<button class="primary" data-action="dismiss">ปิด</button>`);
}
async function rewardPhoto(file) {
  if(!file)return;
  const error=document.getElementById('form-error');
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024){error.textContent='ใช้ JPG, PNG หรือ WebP ไม่เกิน 5 MB';return;}
  photoBusy=true;
  const submit=document.querySelector('#reward-form button[type="submit"]');submit.disabled=true;
  try{
    const bitmap=await createImageBitmap(file),canvas=document.createElement('canvas');
    const ratio=Math.min(1,800/bitmap.width,600/bitmap.height);
    canvas.width=Math.round(bitmap.width*ratio);canvas.height=Math.round(bitmap.height*ratio);
    canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
    draftRewardPhoto=canvas.toDataURL('image/jpeg',.84);
    document.getElementById('reward-image-preview').innerHTML=`<img src="${draftRewardPhoto}" alt="ภาพตัวอย่างรางวัล">`;
    document.querySelector('[data-action="remove-reward-photo"]').disabled=false;error.textContent='';
  }catch{error.textContent='เปิดรูปนี้ไม่ได้ กรุณาลองรูปอื่น';}
  finally{photoBusy=false;if(submit.isConnected)submit.disabled=false;}
}
function restoreFocusedControl(selector) {
  const scroll=window.scrollY;render();window.scrollTo(0,scroll);
  if(selector)document.querySelector(selector)?.focus({preventScroll:true});
}
document.addEventListener('input',event=>{
  const input=event.target,id=input.dataset.cases||input.dataset.extra;
  if(!id)return;
  const n=Number(input.value),isCase=!!input.dataset.cases,max=isCase?999:1000;
  if(!Number.isInteger(n)||n<0||n>max)return;
  checks[id]??={};
  if(isCase){checks[id].cases=n;if(n)checks[id].kpi=false;}
  else checks[id].extra=n;
  const row=input.closest('tr'),kpi=row.querySelector('[data-check="kpi"]');
  if(isCase){kpi.disabled=n>0;if(n)kpi.checked=false;kpi.nextElementSibling.textContent=kpi.checked?'ครบ':'ยังไม่ครบ';}
  const results=closingResults(),r=results.find(x=>x.e.id===id),cell=row.lastElementChild;
  const delta=cell.querySelector('strong');delta.textContent=signed(r.delta);delta.className=r.delta<0?'negative':'accent';
  cell.querySelector('.balance-after').textContent=`เหลือ ${r.after} NMP`;
  document.querySelector('.closing-total strong').textContent=`${signed(results.reduce((n,x)=>n+x.delta,0))} NMP`;
  document.querySelector('.closing-total small').textContent=`Investigation ${results.reduce((n,x)=>n+x.cases,0)} เคส · KPI ครบ ${results.filter(x=>x.kpi).length} คน · Point พิเศษ +${results.reduce((n,x)=>n+x.extra,0)}${teamTop?' · ทีม Top +1 ทุกคน':''}`;
});
document.addEventListener('change',event=>{
  const target=event.target;
  if(target.dataset.check){const {id,check}=target.dataset;checks[id]??={};checks[id][check]=target.checked;restoreFocusedControl(`[data-check="${check}"][data-id="${id}"]`);}
  if(target.dataset.cases){
    const id=target.dataset.cases,n=Number(target.value);
    if(!Number.isInteger(n)||n<0||n>999){target.value=checks[id]?.cases||0;return toast('จำนวนเคสต้องเป็นจำนวนเต็ม 0–999');}
    checks[id]??={};checks[id].cases=n;if(n)checks[id].kpi=false;restoreFocusedControl(`[data-cases="${id}"]`);
  }
  if(target.dataset.extra){
    const id=target.dataset.extra,n=Number(target.value);
    if(!Number.isInteger(n)||n<0||n>1000){target.value=checks[id]?.extra||0;return toast('Point พิเศษต้องเป็นจำนวนเต็ม 0–1000');}
    checks[id]??={};checks[id].extra=n;restoreFocusedControl(`[data-extra="${id}"]`);
  }
  if(target.id==='team-top'){teamTop=target.checked;restoreFocusedControl('#team-top');}
  if(target.id==='month-picker'){selectedMonth=target.value;checks={};teamTop=false;render();}
  if(target.id==='report-month'){reportMonth=target.value;render();}
  if(target.id==='profile-input')uploadPhoto(target.files[0]);
  if(target.id==='reward-image-input')rewardPhoto(target.files[0]);
  if(target.name==='type'&&target.closest('#reward-form')){
    const cash=target.value==='cash',stock=document.querySelector('#stock-label input'),value=document.querySelector('#reward-form [name="value"]');
    document.querySelector('#stock-label span').textContent=cash?`จำนวนสิทธิ์ปี ${YEAR}`:'จำนวนสิทธิ์ทั้งหมด';
    stock.max=cash?3:999;stock.required=true;value.required=cash;
    if(cash&&Number(stock.value)>3)stock.value=3;
  }
});
