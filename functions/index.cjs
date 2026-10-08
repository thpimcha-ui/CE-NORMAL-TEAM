'use strict';
const {onCall,onRequest,HttpsError}=require('firebase-functions/v2/https');
const {defineSecret}=require('firebase-functions/params');
const {initializeApp}=require('firebase-admin/app');
const {getAuth}=require('firebase-admin/auth');
const {getFirestore,FieldValue}=require('firebase-admin/firestore');
const {randomBytes,createHash}=require('node:crypto');
const D=require('./domain.cjs');
const Line=require('./line-my-point.cjs');
initializeApp();
const db=getFirestore(),auth=getAuth();
// Deploy this worker only after both LINE secrets are configured.
exports.ceLineRequestNotification=require('./line-trigger.cjs');
// Test site uses a separate ledger. Original users/rewards/history are never written.
const PREFIX=process.env.CE_NAMESPACE||'ceLitePreview';
const col=name=>db.collection(PREFIX+name);
const control=col('Control').doc('settings');
const lineToken=defineSecret('CE_LINE_ACCESS_TOKEN'),lineSecret=defineSecret('CE_LINE_CHANNEL_SECRET');
const lineHandler=(token,secret)=>Line.createHandler({db,token,secret,prefix:PREFIX});
exports.ceLineMyPointWebhook=onRequest({region:'asia-southeast1',secrets:[lineToken,lineSecret],maxInstances:1,minInstances:0,memory:'256MiB',timeoutSeconds:60},(req,res)=>lineHandler(lineToken.value(),lineSecret.value()).webhook(req,res));
const now=()=>new Date().toLocaleString('sv-SE',{timeZone:'Asia/Bangkok'}).replace(' ','T')+'+07:00';
const rows=snapshot=>snapshot.docs.map(doc=>({id:doc.id,...doc.data()}));
const staffOnly=actor=>{if(actor.role!=='admin')throw new HttpsError('permission-denied','เฉพาะ Supervisor เท่านั้น');};
async function actorFor(req){
 if(!req.auth)throw new HttpsError('unauthenticated','กรุณาเข้าสู่ระบบ');
 const account=await auth.getUser(req.auth.uid);
 if(account.disabled)throw new HttpsError('permission-denied','บัญชีถูกปิดใช้งาน');
 if(req.auth.token.auth_time < Math.floor(new Date(account.tokensValidAfterTime).getTime()/1000))throw new HttpsError('unauthenticated','กรุณาเข้าสู่ระบบใหม่');
 const snap=await col('Members').doc(req.auth.uid).get(),actor={id:snap.id,...snap.data()};
 if(!snap.exists||!actor.active)throw new HttpsError('permission-denied','บัญชียังไม่ได้รับสิทธิ์ใช้งาน');
 if(actor.mustChangePassword&&req.data?.action!=='changePassword'&&req.data?.action!=='state')throw new HttpsError('failed-precondition','กรุณาตั้งรหัสผ่านของตัวเองก่อน');
 return actor;
}
async function stateFor(actor,knownRevision){
 if(actor.mustChangePassword)return {mustChangePassword:true,me:{id:actor.id,name:actor.name}};
 const cs=await control.get();if(!cs.exists)throw new HttpsError('failed-precondition','ยังไม่ได้ตั้งค่าระบบ');
 if(Number.isSafeInteger(knownRevision)&&knownRevision===cs.data().revision)return {unchanged:true};
 const [ms,rs,qs,hs,xs,readDoc]=await Promise.all([col('Members').get(),col('Rewards').get(),col('Requests').get(),actor.role==='employee'?col('History').where('employeeId','==',actor.id).orderBy('date','desc').limit(200).get():Promise.resolve({docs:[]}),col('Months').get(),col('Reads').doc(actor.id).get()]);
 const allMembers=rows(ms).map(e=>({id:e.id,name:e.name,username:e.username,role:e.role,active:e.active,points:e.points,streak:e.streak,photo:e.photo||null})),allRequests=rows(qs),members=allMembers.filter(e=>e.role==='employee'),me=allMembers.find(e=>e.id===actor.id),active=members.filter(e=>e.active),admin=actor.role==='admin',cfg=cs.data();
 if(!cfg)throw new HttpsError('failed-precondition','ยังไม่ได้ตั้งค่าระบบ');
 const rewards=rows(rs).map(r=>({...r,cashRemaining:r.type==='cash'?Math.max(0,r.stock-allRequests.filter(q=>q.rewardId===r.id&&q.year===r.year&&['pending','approved'].includes(q.status)).length):null}));
 const months=rows(xs),monthlyRecords=Object.fromEntries(months.map(m=>[m.month,admin?m:{...m,entries:m.entries.filter(e=>e.employeeId===actor.id)}]));
 const logs=rows(hs).filter(l=>admin||l.employeeId===actor.id);
 const standing=D.rules.standing(actor,allMembers);
 return {mode:PREFIX==='ceLitePreview'?'preview':'live',revision:cfg.revision||0,role:actor.role,me,employees:admin?members:[me],rewards:admin?rewards:rewards.filter(r=>r.active&&!r.archived),requests:admin?allRequests:allRequests.filter(r=>r.employeeId===actor.id),logs,monthlyRecords,closedMonths:months.map(m=>m.month),startMonth:cfg.startMonth,announcement:cfg.announcement||{active:false},rewardBudget:admin?cfg.rewardBudget||{}:{},supervisor:me,lineLinked:!!actor.lineUserId,notificationReads:{[admin?'admin':actor.id]:readDoc.data()?.ids||[]},teamRank:{position:standing.rank,total:standing.total,tied:standing.tied}};
}
async function mutate(actor,data){
 const op=D.text(data.operationId,80,'รหัสรายการไม่ถูกต้อง');
 if(!/^[A-Za-z0-9_-]+$/.test(op))D.fail('รหัสรายการไม่ถูกต้อง');
 const fingerprint=createHash('sha256').update(JSON.stringify(data)).digest('hex'),receipt=col('Operations').doc(actor.id+'_'+op),timestamp=now();
 return db.runTransaction(async tx=>{
  const [ctl,prior,actorDoc,ms,rs,qs,xs]=await Promise.all([tx.get(control),tx.get(receipt),tx.get(col('Members').doc(actor.id)),tx.get(col('Members')),tx.get(col('Rewards')),tx.get(col('Requests')),tx.get(col('Months'))]);
  const fresh={id:actor.id,...actorDoc.data()};
  if(!fresh.active||fresh.mustChangePassword)throw new HttpsError('permission-denied','บัญชีไม่พร้อมใช้งาน');
  if(prior.exists){if(prior.data().fingerprint!==fingerprint)D.fail('รหัสรายการซ้ำกับงานอื่น');return prior.data().result;}
  const cfg=ctl.data();if(!cfg)D.fail('ยังไม่ได้ตั้งค่าระบบ');
  const employees=rows(ms),rewards=rows(rs),requests=rows(qs),months=rows(xs),year=Number(timestamp.slice(0,4));
  let result={ok:true};
  const userRef=id=>col('Members').doc(id),reqRef=id=>col('Requests').doc(id);
  const log=(id,entry)=>tx.create(col('History').doc(id),{...entry,date:timestamp,performedBy:actor.id});
  switch(data.action){
   case 'redeem':{
    const reward=rewards.find(r=>r.id===data.rewardId),r=D.redeem({actor:fresh,reward,requests,now:timestamp});
    tx.create(reqRef(op),{...r,employeeName:fresh.name});result.requestId=op;break;
   }
   case 'decide':{
    staffOnly(fresh);const request=requests.find(r=>r.id===data.id),e=employees.find(e=>e.id===request?.employeeId),out=D.decide({request,employee:e,status:data.status,now:timestamp});
    tx.update(reqRef(data.id),{status:out.request.status,decidedAt:timestamp,decidedBy:actor.id});
    if(data.status==='approved'){tx.update(userRef(e.id),{points:out.employee.points});log(op,{employeeId:e.id,title:'แลก'+request.name,detail:'อนุมัติแล้ว',amount:-request.cost,kind:'reward'});}break;
   }
   case 'closeMonth':{
    staffOnly(fresh);
    if(data.expectedRevision!==cfg.revision)D.fail('ข้อมูลทีมเปลี่ยนแล้ว กรุณารีเฟรชและตรวจยอดใหม่');
    const report=D.closeMonth({employees,requests,months,startMonth:cfg.startMonth,month:data.month,checks:data.checks,teamTop:data.teamTop,now:timestamp});
    tx.create(col('Months').doc(data.month),{...report,closedBy:actor.id});
    for(const e of report.entries){tx.update(userRef(e.employeeId),{points:e.balanceAfter,streak:e.streakAfter});log(op+'_'+e.employeeId,{employeeId:e.employeeId,title:'สรุปแต้มประจำเดือน',detail:`${data.month} · Tier +${e.base} · KPI +${e.kpiBonus} · ทีม Top +${e.teamBonus} · Inves ${e.cases} เคส −${e.deduction}`,amount:e.delta,kind:'point'});}break;
   }
   case 'reward':{
    staffOnly(fresh);const old=rewards.find(r=>r.id===data.id),r=D.rewardInput(data.reward,old,requests,year),id=old?.id||op;
    if(!old&&r.type==='cash'&&rewards.some(x=>x.type==='cash'&&x.year===year))D.fail('ปีนี้มีเงินรางวัลแล้ว กรุณาแก้ไขรายการเดิม');
    tx.set(col('Rewards').doc(id),r);break;
   }
   case 'archiveReward':{
    staffOnly(fresh);const reward=rewards.find(r=>r.id===data.id);
    if(!reward||reward.archived)D.fail('ไม่พบรางวัลที่ต้องการนำออก');
    tx.update(col('Rewards').doc(data.id),{active:false,activeBeforeArchive:!!reward.active,archived:true,archivedAt:timestamp,archivedBy:actor.id});break;
   }
   case 'restoreReward':{
    staffOnly(fresh);const reward=rewards.find(r=>r.id===data.id);
    if(!reward?.archived)D.fail('ไม่พบรางวัลที่ต้องการคืน');
    tx.update(col('Rewards').doc(data.id),{active:reward.activeBeforeArchive===true,archived:false,restoredAt:timestamp,restoredBy:actor.id});break;
   }
   case 'announcement':{
    staffOnly(fresh);tx.update(control,{announcement:{title:D.text(data.title,90,'กรุณาระบุหัวข้อ'),body:D.text(data.body,1800,'กรุณาระบุรายละเอียด'),active:D.bool(data.active),version:(cfg.announcement?.version||0)+1,updatedAt:timestamp}});break;
   }
   case 'profile':tx.update(userRef(actor.id),{photo:D.image(data.photo),photoUpdatedAt:timestamp});break;
   case 'budget':staffOnly(fresh);tx.update(control,{['rewardBudget.'+year]:D.int(data.budget,0,10000000,'งบไม่ถูกต้อง')});break;
   case 'deliver':{
    staffOnly(fresh);const r=requests.find(r=>r.id===data.id);if(r?.status!=='approved'||r.deliveredAt)D.fail('รายการนี้ยังส่งมอบไม่ได้หรือบันทึกแล้ว');
    if(!Number.isFinite(data.paidAmount)||data.paidAmount<0||data.paidAmount>1000000)D.fail('ยอดจ่ายไม่ถูกต้อง');
    tx.update(reqRef(data.id),{deliveredAt:timestamp,paidAmount:Math.round(data.paidAmount*100)/100,deliveredBy:actor.id});break;
   }
   case 'toggleEmployee':{
    staffOnly(fresh);const e=employees.find(e=>e.id===data.id);if(!e||e.role!=='employee')D.fail('ไม่พบบัญชีพนักงาน');
    tx.update(userRef(e.id),{active:!e.active});
    if(e.active)for(const r of requests.filter(r=>r.employeeId===e.id&&r.status==='pending'))tx.update(reqRef(r.id),{status:'rejected',decidedAt:timestamp,decidedBy:actor.id});break;
   }
   case 'read':{
    if(!Array.isArray(data.ids)||data.ids.length>5000||data.ids.some(id=>typeof id!=='string'||id.length>160))D.fail('รายการแจ้งเตือนไม่ถูกต้อง');
    tx.set(col('Reads').doc(actor.id),{ids:data.ids,updatedAt:timestamp});break;
   }
   default:D.fail('ไม่พบคำสั่งนี้');
  }
  tx.update(control,{revision:(cfg.revision||0)+1,updatedAt:timestamp});
  tx.create(receipt,{fingerprint,result,createdAt:timestamp,actor:actor.id,action:data.action});
  return result;
 });
}
exports.ceLiteApi=onCall({region:'asia-southeast1',maxInstances:1,minInstances:0,memory:'256MiB',timeoutSeconds:60,concurrency:20},async req=>{
 try{
  const actor=await actorFor(req),data=req.data||{};
  if(data.action==='state')return await stateFor(actor,data.knownRevision);
  if(data.action==='prepareLineLink')return await lineHandler().prepareLink(actor,data.linkToken);
  if(data.action==='unlinkLine')return await lineHandler().unlink(actor);
  if(data.action==='changePassword'){
   if(!actor.mustChangePassword)throw new HttpsError('permission-denied','ใช้เฉพาะรหัสชั่วคราวครั้งแรก');
   const password=D.text(data.password,128,'รหัสผ่านไม่ถูกต้อง');if(password.length<10)D.fail('ใช้รหัสผ่านอย่างน้อย 10 ตัว');
   if(Date.now()/1000-req.auth.token.auth_time>300)D.fail('กรุณาเข้าสู่ระบบอีกครั้ง');
   if(createHash('sha256').update(password).digest('hex')===actor.temporaryPasswordHash)D.fail('กรุณาใช้รหัสใหม่ที่ต่างจากรหัสชั่วคราว');
   await auth.updateUser(actor.id,{password});await col('Members').doc(actor.id).update({mustChangePassword:false,temporaryPasswordHash:FieldValue.delete()});await auth.revokeRefreshTokens(actor.id);return {ok:true,signInAgain:true};
  }
  if(data.action==='createEmployee'){
   staffOnly(actor);const name=D.text(data.name,50,'กรุณาระบุชื่อ'),username=D.text(data.username,40,'ชื่อผู้ใช้ไม่ถูกต้อง').toLowerCase();
   if(!/^[a-z0-9._-]{3,40}$/.test(username))D.fail('ชื่อผู้ใช้ต้องมี 3–40 ตัว ใช้ a–z ตัวเลข . _ -');
   const existing=await col('Members').where('username','==',username).get();if(!existing.empty)D.fail('ชื่อผู้ใช้นี้มีแล้ว');
   const password=randomBytes(12).toString('base64url');
   const user=await auth.createUser({email:username+'@cenolmal.app',password,displayName:name});
   try{await db.runTransaction(async tx=>{const c=await tx.get(control);tx.create(col('Members').doc(user.uid),{name,username,role:'employee',active:true,points:0,streak:0,photo:null,mustChangePassword:true,temporaryPasswordHash:createHash('sha256').update(password).digest('hex'),createdAt:now()});tx.update(control,{revision:(c.data()?.revision||0)+1});});}
   catch(error){await auth.updateUser(user.uid,{disabled:true});throw error;}
   return {username,temporaryPassword:password};
  }
  if(data.action==='resetPassword'){
   staffOnly(actor);const m=await col('Members').doc(data.id).get();if(!m.exists||m.data().role!=='employee')D.fail('รีเซ็ตได้เฉพาะพนักงาน');
   const password=randomBytes(12).toString('base64url');
   await col('Members').doc(data.id).update({mustChangePassword:true,temporaryPasswordHash:createHash('sha256').update(password).digest('hex')});
   await auth.updateUser(data.id,{password});await auth.revokeRefreshTokens(data.id);return {username:m.data().username,temporaryPassword:password};
  }
  return await mutate(actor,data);
 }catch(error){if(error instanceof HttpsError)throw error;if(error instanceof D.DomainError)throw new HttpsError(error.code,error.message);if(error.code==='auth/email-already-exists')throw new HttpsError('already-exists','ชื่อผู้ใช้นี้มีบัญชีแล้ว');console.error('CE API failed',{code:error.code||'internal',action:req.data?.action});throw new HttpsError('internal','ทำรายการไม่สำเร็จ กรุณาลองอีกครั้ง');}
});
