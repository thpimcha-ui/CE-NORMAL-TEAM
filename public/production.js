'use strict';
let firebaseAuth,callFunction,authSDK,busy=false,initialized=false,readTimer;
function defaultAnnouncement(){return {title:'ประกาศถึงทีม',body:'',active:false,version:0};}
const api=async data=>{if(!callFunction)throw new Error('ระบบกำลังเชื่อมต่อ');return (await callFunction(data)).data;};
function queueReadSync(){clearTimeout(readTimer);readTimer=setTimeout(()=>api({action:'read',ids:readSet(),operationId:uid()}).catch(()=>toast('ยังบันทึกสถานะอ่านไม่ได้')),400);}
function loginScreen(){return `<main class="login-layout"><section class="login-story"><div class="brand"><span class="brand-symbol">${coin('brand-coin')}</span><div><div class="brand-word">NMP<span class="accent">.</span></div><div class="brand-caption">CE · NORMAL POINT</div></div></div><div class="login-intro"><span class="overline">ทีม CE · NORMAL POINT</span><h1>เก็บความคลีน<br>ปลดล็อกรางวัล<span class="accent">.</span></h1><p>ทุกเดือนที่ตั้งใจ มีความหมาย<br>สะสมแต้ม แล้วให้รางวัลตัวเอง</p></div><div class="login-tiers">${TIERS.map(t=>`<div>${emblem(t,true)}<span style="color:${t.color}">${t.name}</span></div>`).join('')}</div></section><section class="login-card"><span class="pill lime">ยินดีต้อนรับกลับมา</span><h2>พร้อมไปต่อหรือยัง?</h2><p>เข้าสู่ระบบด้วยบัญชีของทีม</p><form id="real-login"><label>ชื่อผู้ใช้<input name="username" autocomplete="username" required maxlength="100" placeholder="เช่น ce016"></label><label>รหัสผ่าน<input type="password" name="password" autocomplete="current-password" required></label><div id="login-error" class="error-text" role="alert"></div><button class="primary" type="submit" ${initialized?'':'disabled'}>${initialized?'เข้าสู่ระบบ':'กำลังเชื่อมต่อ…'}</button></form><p class="login-note">ไม่มีสมัครสมาชิกเอง · ขอรับบัญชีจาก Supervisor<br>ลืมรหัสผ่าน ให้ Supervisor ออกรหัสชั่วคราวใหม่</p></section></main>`;}
function passwordScreen(me){app.innerHTML=`<main class="login-layout"><section class="login-card"><span class="pill lime">สวัสดี ${esc(me.name)}</span><h2>ตั้งรหัสของตัวเองก่อน</h2><p>ใช้รหัสใหม่อย่างน้อย 10 ตัว และต่างจากรหัสชั่วคราว</p><form id="new-password"><label>รหัสใหม่<input name="password" type="password" minlength="10" maxlength="128" autocomplete="new-password" required></label><label>ยืนยันรหัสใหม่<input name="confirm" type="password" minlength="10" maxlength="128" autocomplete="new-password" required></label><div class="error-text" id="login-error" role="alert"></div><button class="primary" type="submit">บันทึกรหัสส่วนตัว</button></form><button class="text-button" data-action="logout">ออกจากระบบ</button></section></main>`;}
async function refresh(showAnnouncementOnLogin=false){
 const data=await api({action:'state',...(loggedIn?{knownRevision:state.revision}:{})});
 if(data.unchanged)return;
 if(data.mustChangePassword){loggedIn=false;passwordScreen(data.me);return;}
 const first=!loggedIn;state=data;currentEmployeeId=data.me.id;role=data.role;loggedIn=true;
 if(first){view=role==='admin'?'overview':'home';selectedMonth=state.closedMonths.length?nextMonth([...state.closedMonths].sort().at(-1)):state.startMonth;reportMonth=[...state.closedMonths].sort().at(-1)||state.startMonth;}
 if(!dialog.open)render();
 if(showAnnouncementOnLogin&&role==='employee')showAnnouncement();
}
function errorText(error){const code=error.code||'';return /invalid-credential|wrong-password|user-not-found/.test(code)?'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง':/too-many-requests/.test(code)?'ลองหลายครั้งเกินไป กรุณารอสักครู่':/network/.test(code)?'เชื่อมต่อไม่ได้ กรุณาตรวจอินเทอร์เน็ต':error.message?.replace(/^Firebase:\s*/,'')||'ทำรายการไม่สำเร็จ';}
async function runTask(data,message){
 if(busy)return;busy=true;const buttons=[...document.querySelectorAll('button[type="submit"],.dialog-actions button')];buttons.forEach(b=>b.disabled=true);
 try{const result=await api({...data,operationId:uid()});if(dialog.open)dialog.close();await refresh();if(message)toast(message);return result;}
 catch(error){toast(errorText(error));throw error;}
 finally{busy=false;buttons.filter(b=>b.isConnected).forEach(b=>b.disabled=false);}
}
function temporaryCredential(result){openDialog('บัญชีพร้อมแล้ว',`<p>ส่งข้อมูลนี้ให้เจ้าของบัญชีเป็นการส่วนตัว<br>รหัสนี้แสดงเฉพาะครั้งนี้ หากปิดแล้วลืม ให้สร้างรหัสชั่วคราวใหม่</p><div class="highlight"><span>ชื่อผู้ใช้</span><strong>${esc(result.username)}</strong></div><div class="highlight"><span>รหัสชั่วคราว</span><code>${esc(result.temporaryPassword)}</code></div><p>ครั้งแรกต้องตั้งรหัสของตัวเองก่อนใช้งาน</p>`,`<button class="primary" data-action="dismiss">บันทึกไว้แล้ว</button>`);}
async function uploadPhoto(file){
 if(!file)return;const error=document.getElementById('photo-error');
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024){error.textContent='ใช้ JPG, PNG หรือ WebP ไม่เกิน 5 MB';return;}
 try{const bitmap=await createImageBitmap(file),canvas=document.createElement('canvas');canvas.width=canvas.height=320;const side=Math.min(bitmap.width,bitmap.height);canvas.getContext('2d').drawImage(bitmap,(bitmap.width-side)/2,(bitmap.height-side)/2,side,side,0,0,320,320);bitmap.close();await runTask({action:'profile',photo:canvas.toDataURL('image/jpeg',.82)},'บันทึกรูปแล้ว ✦');}catch(e){if(error.isConnected)error.textContent=errorText(e);}
}
document.addEventListener('click',async event=>{
 const b=event.target.closest('[data-action]');if(!b||b.disabled)return;const {action,id}=b.dataset;
 const actions=['confirm-redeem','confirm-request','confirm-close','confirm-employee','remove-photo','reset-password','confirm-password-reset','refresh','logout'];
 if(actions.includes(action)){
  event.preventDefault();event.stopImmediatePropagation();
  try{
   if(action==='logout'){await authSDK.signOut(firebaseAuth);if(dialog.open)dialog.close();loggedIn=false;state={employees:[],requests:[],rewards:[],logs:[],closedMonths:[],monthlyRecords:{}};render();return;}
   if(action==='refresh'){await refresh();toast('ข้อมูลล่าสุดแล้ว');return;}
   if(action==='reset-password'){openDialog('ออกรหัสชั่วคราวใหม่?',`<p>${esc(employee(id).name)} จะต้องเข้าสู่ระบบด้วยรหัสใหม่ และตั้งรหัสส่วนตัวอีกครั้ง</p>`,`<button class="secondary" data-action="dismiss">กลับ</button><button class="primary" data-action="confirm-password-reset" data-id="${id}">ออกรหัสใหม่</button>`);return;}
   const task=action==='confirm-redeem'?{action:'redeem',rewardId:id}:action==='confirm-request'?{action:'decide',id,status:b.dataset.status}:action==='confirm-close'?{action:'closeMonth',month:selectedMonth,checks,teamTop,expectedRevision:state.revision}:action==='confirm-employee'?{action:'toggleEmployee',id}:action==='remove-photo'?{action:'profile',photo:null}:{action:'resetPassword',id};
   const result=await runTask(task,'บันทึกเรียบร้อย ✦');if(action==='confirm-password-reset')temporaryCredential(result);if(action==='confirm-close'){reportMonth=selectedMonth;selectedMonth=nextMonth(selectedMonth);checks={};teamTop=false;render();}
  }catch{}
  return;
 }
 if(action==='dismiss'){dialog.close();return;}
 if(!loggedIn)return;
 switch(action){
  case 'nav':view=b.dataset.view;render();window.scrollTo(0,0);break;
  case 'filter':filter=b.dataset.filter;render();break;
  case 'redeem':askRedeem(id);break;
  case 'request':askRequest(id,b.dataset.status);break;
  case 'close-month':askClose();break;
  case 'profile':profile();break;
  case 'add-reward':editReward();break;
  case 'edit-reward':editReward(id);break;
  case 'remove-reward-photo':draftRewardPhoto=null;document.getElementById('reward-image-preview').innerHTML='<div class="image-empty">เพิ่มรูปให้รางวัลน่าแลกขึ้น</div>';b.disabled=true;break;
  case 'add-employee':addEmployee();break;
  case 'toggle-employee':askEmployee(id);break;
  case 'read-announcement':showAnnouncement();break;
  case 'edit-announcement':editAnnouncement();break;
  case 'report-detail':reportDetail();break;
  case 'report-month':reportMonth=b.dataset.month;render();break;
  case 'view-closed-report':reportMonth=b.dataset.month;view='overview';render();break;
 }
},true);
document.addEventListener('submit',async event=>{
 const form=event.target;event.preventDefault();event.stopImmediatePropagation();const data=new FormData(form),error=document.getElementById('form-error')||document.getElementById('login-error');
 try{
  if(form.id==='real-login'){
   const username=String(data.get('username')).trim().toLowerCase(),email=username.includes('@')?username:username+'@cenolmal.app';
   const button=form.querySelector('button');button.disabled=true;try{await authSDK.signInWithEmailAndPassword(firebaseAuth,email,String(data.get('password')));}finally{if(button.isConnected)button.disabled=false;}return;
  }
  if(form.id==='new-password'){
   if(data.get('password')!==data.get('confirm'))throw new Error('รหัสผ่านสองช่องไม่ตรงกัน');
   const button=form.querySelector('button');button.disabled=true;try{await api({action:'changePassword',password:String(data.get('password'))});await authSDK.signOut(firebaseAuth);toast('บันทึกรหัสแล้ว เข้าสู่ระบบด้วยรหัสใหม่ได้เลย');}finally{if(button.isConnected)button.disabled=false;}return;
  }
  if(!loggedIn||busy)return;
  let task;
  if(form.id==='employee-form')task={action:'createEmployee',name:String(data.get('name')),username:String(data.get('username'))};
  if(form.id==='announcement-form')task={action:'announcement',title:String(data.get('title')),body:String(data.get('body')),active:data.has('active')};
  if(form.id==='budget-form')task={action:'budget',budget:Number(data.get('budget'))};
  if(form.id==='delivery-form')task={action:'deliver',id:form.dataset.id,paidAmount:Number(data.get('paid'))};
  if(form.id==='reward-form'){
   if(photoBusy)throw new Error('รอรูปภาพสักครู่');const old=state.rewards.find(r=>r.id===form.dataset.id);
   task={action:'reward',id:form.dataset.id,reward:{name:String(data.get('name')),description:String(data.get('description')),cost:Number(data.get('cost')),value:Number(data.get('value')),stock:Number(data.get('stock')),type:old?.type||String(data.get('type')),active:data.has('active'),photo:draftRewardPhoto}};
  }
  if(!task)return;const result=await runTask(task,'บันทึกเรียบร้อย ✦');if(form.id==='employee-form')temporaryCredential(result);
 }catch(e){if(error?.isConnected)error.textContent=errorText(e);else toast(errorText(e));}
},true);
(async()=>{
 if(window.CE_QA_FIXTURE)return;
 render();
 try{
  const [appSDK,aSDK,fSDK]=await Promise.all([import('https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js'),import('https://www.gstatic.com/firebasejs/11.10.0/firebase-functions.js')]);
  authSDK=aSDK;const firebase=appSDK.initializeApp({apiKey:'AIzaSyAUiuOs0Hg1bT8PvYy3M42zj9VL84yrxts',authDomain:'cenolmal.firebaseapp.com',projectId:'cenolmal',storageBucket:'cenolmal.firebasestorage.app',messagingSenderId:'736326565007',appId:'1:736326565007:web:3ba5f4969a1405891584fa'});
  firebaseAuth=aSDK.getAuth(firebase);await aSDK.setPersistence(firebaseAuth,aSDK.browserSessionPersistence);callFunction=fSDK.httpsCallable(fSDK.getFunctions(firebase,'asia-southeast1'),'ceLiteApi');initialized=true;
  aSDK.onAuthStateChanged(firebaseAuth,async user=>{if(!user){loggedIn=false;render();return;}try{await refresh(true);}catch(e){loggedIn=false;await aSDK.signOut(firebaseAuth);toast(errorText(e));}});
  setInterval(()=>{if(loggedIn&&!document.hidden&&!busy&&!dialog.open)refresh().catch(()=>{});},60000);
  window.addEventListener('focus',()=>{if(loggedIn&&!busy&&!dialog.open)refresh().catch(()=>{});});
 }catch(e){initialized=false;render();const error=document.getElementById('login-error');if(error)error.textContent='เชื่อมต่อระบบไม่ได้ กรุณารีเฟรชหน้า';}
})();
