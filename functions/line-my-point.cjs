'use strict';
const {createHmac,timingSafeEqual,createHash,randomBytes}=require('node:crypto');
const Rules=require('./rules.cjs');

const hash=value=>createHash('sha256').update(value).digest('hex');
function validSignature(raw,signature,secret){
 if(!Buffer.isBuffer(raw)||typeof signature!=='string'||!secret)return false;
 const actual=Buffer.from(signature,'base64'),expected=createHmac('sha256',secret).update(raw).digest();
 return actual.length===expected.length&&timingSafeEqual(actual,expected);
}
function scoreText(person,employees){
 const s=Rules.standing(person,employees);
 if(!s.rank)return 'My Point ใช้ได้เฉพาะบัญชีพนักงานที่ใช้งานอยู่';
 const next=s.nextTier?`เหลืออีก: ${s.monthsToNext} Clean Streak → ${s.nextTier}`:'Clean Streak: ถึง Tier สูงสุดแล้ว';
 return `${person.name}\nPoint: ${Number(person.points||0).toLocaleString('en-US')} P\nTier: ${s.tier}\n${next}\nอันดับทีม: #${s.rank}${s.tied?' (อันดับร่วม)':''} / ${s.total}`;
}
async function lineApi(token,path,body,fetchImpl=fetch){
 const response=await fetchImpl('https://api.line.me/v2/bot/'+path,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw new Error('LINE API '+response.status);
 return response.status===204?{}:response.json();
}
async function reply(token,replyToken,text){return lineApi(token,'message/reply',{replyToken,messages:[{type:'text',text:text.slice(0,4900)}]});}
function createHandler({db,token,secret,prefix='ceLitePreview',siteUrl='https://ce-point-lite-preview.netlify.app/',fetchImpl=fetch}){
 const col=name=>db.collection(prefix+name),members=col('Members'),links=col('LineLinks'),tokens=col('LineLinkTokens'),nonces=col('LineLinkNonces'),control=col('Control').doc('settings');
 async function myPoint(lineId){
  const link=await links.doc(lineId).get();
  if(!link.exists)return 'ยังไม่ได้เชื่อมบัญชี CE Point กับ LINE นี้ กด My Point อีกครั้งเพื่อรับลิงก์เชื่อมบัญชี';
  const personSnap=await members.doc(link.data().employeeId).get();
  if(!personSnap.exists)return 'ไม่พบบัญชี CE Point กรุณาติดต่อ Supervisor';
  const person={id:personSnap.id,...personSnap.data()};
  if(!person.active||person.role!=='employee'||person.mustChangePassword||person.lineUserId!==lineId)return 'บัญชีนี้ยังไม่พร้อมใช้งาน กรุณาติดต่อ Supervisor';
  const all=(await members.get()).docs.map(d=>({id:d.id,...d.data()}));
  return scoreText(person,all);
 }
 async function linkUrl(lineId){
  const result=await lineApi(token,'user/'+encodeURIComponent(lineId)+'/linkToken',{},fetchImpl);
  if(!/^[A-Za-z0-9_-]{10,200}$/.test(result.linkToken||''))throw new Error('Invalid LINE link token');
  await tokens.doc(hash(result.linkToken)).set({lineUserId:lineId,expiresAt:Date.now()+9*60*1000,createdAt:Date.now()});
  const url=new URL(siteUrl);url.searchParams.set('lineLinkToken',result.linkToken);
  return `เชื่อม LINE กับบัญชี CE Point ของคุณก่อนดูแต้ม\nเปิดลิงก์นี้แล้วเข้าสู่ระบบด้วยบัญชีของตัวเอง: ${url.toString()}\nลิงก์หมดอายุใน 9 นาที · ยกเลิกการเชื่อมได้ในหน้าโปรไฟล์`;
 }
 async function finishLink(lineId,link){
  if(link?.result!=='ok'||typeof link.nonce!=='string')return 'เชื่อมบัญชีไม่สำเร็จ กรุณากด My Point แล้วลองใหม่';
  const nonceRef=nonces.doc(hash(link.nonce));
  const result=await db.runTransaction(async tx=>{
   const pending=await tx.get(nonceRef);
   if(!pending.exists||pending.data().lineUserId!==lineId||pending.data().expiresAt<Date.now())return false;
   const employeeId=pending.data().employeeId,employeeRef=members.doc(employeeId),lineRef=links.doc(lineId);
   const [employeeSnap,lineSnap,settings]=await Promise.all([tx.get(employeeRef),tx.get(lineRef),tx.get(control)]);
   const person=employeeSnap.data();
   if(!person||!person.active||person.role!=='employee'||person.mustChangePassword||person.lineUserId||lineSnap.exists)return false;
   tx.update(employeeRef,{lineUserId:lineId,lineLinkedAt:new Date().toISOString()});
   tx.create(lineRef,{employeeId,linkedAt:new Date().toISOString()});
   tx.update(control,{revision:(settings.data()?.revision||0)+1});
   tx.delete(nonceRef);
   return true;
  });
  return result?'เชื่อม LINE สำเร็จแล้ว กด My Point เพื่อดูแต้มของคุณ':'เชื่อมบัญชีไม่สำเร็จหรือเคยเชื่อมแล้ว กรุณาติดต่อ Supervisor';
 }
 async function handleEvent(event){
  if(event?.source?.type!=='user'||!event.source.userId||!event.replyToken)return;
  const lineId=event.source.userId;
  let text;
  if(event.type==='accountLink')text=await finishLink(lineId,event.link);
  else if(event.postback?.data==='action=my_point'||event.message?.type==='text'&&/^my\s*point$/i.test(event.message.text?.trim()||'')){
   const link=await links.doc(lineId).get();text=link.exists?await myPoint(lineId):await linkUrl(lineId);
  }
  if(text)await reply(token,event.replyToken,text);
 }
 async function webhook(req,res){
  if(req.method!=='POST'||!validSignature(req.rawBody,req.header('x-line-signature'),secret)){res.status(403).send('Forbidden');return;}
  if(!Array.isArray(req.body?.events)){res.status(400).send('Bad request');return;}
  try{for(const event of req.body.events)await handleEvent(event);res.status(200).send('OK');}
  catch(error){console.error('CE LINE webhook failed',{message:error.message});res.status(500).send('Retry');}
 }
 async function prepareLink(employee,linkToken){
  if(employee.role!=='employee'||!employee.active||employee.mustChangePassword||employee.lineUserId)throw new Error('บัญชีนี้ยังเชื่อม LINE ไม่ได้');
  if(typeof linkToken!=='string'||!/^[A-Za-z0-9_-]{10,200}$/.test(linkToken))throw new Error('ลิงก์เชื่อมบัญชีไม่ถูกต้อง');
  const tokenRef=tokens.doc(hash(linkToken));
  const result=await db.runTransaction(async tx=>{
   const pending=await tx.get(tokenRef);
   if(!pending.exists||pending.data().expiresAt<Date.now())throw new Error('ลิงก์หมดอายุแล้ว กรุณากด My Point อีกครั้ง');
   const nonce=randomBytes(32).toString('base64url');
   tx.create(nonces.doc(hash(nonce)),{lineUserId:pending.data().lineUserId,employeeId:employee.id,expiresAt:Date.now()+9*60*1000});
   tx.delete(tokenRef);
   return nonce;
  });
  const url=new URL('https://access.line.me/dialog/bot/accountLink');url.searchParams.set('linkToken',linkToken);url.searchParams.set('nonce',result);
  return {url:url.toString()};
 }
 async function unlink(employee){
  if(employee.role!=='employee')throw new Error('ใช้ได้เฉพาะบัญชีพนักงาน');
  const employeeRef=members.doc(employee.id);
  await db.runTransaction(async tx=>{
   const current=await tx.get(employeeRef),lineId=current.data()?.lineUserId;
   if(!lineId)return;
   const linkRef=links.doc(lineId),[link,settings]=await Promise.all([tx.get(linkRef),tx.get(control)]);
   tx.update(employeeRef,{lineUserId:null,lineLinkedAt:null});
   if(link.exists&&link.data().employeeId===employee.id)tx.delete(linkRef);
   tx.update(control,{revision:(settings.data()?.revision||0)+1});
  });
  return {ok:true};
 }
 return {webhook,prepareLink,unlink,myPoint};
}
module.exports={validSignature,scoreText,createHandler,hash};
