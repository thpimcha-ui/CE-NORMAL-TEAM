'use strict';
const {onDocumentCreated}=require('firebase-functions/v2/firestore');
const {defineSecret}=require('firebase-functions/params');
const {getFirestore}=require('firebase-admin/firestore');
const L=require('./line-delivery.cjs');
const token=defineSecret('CE_LINE_ACCESS_TOKEN'),recipient=defineSecret('CE_LINE_OWNER_ID');
const prefix=process.env.CE_NAMESPACE||'ceLitePreview';
module.exports=onDocumentCreated({document:prefix+'Requests/{requestId}',region:'asia-southeast1',secrets:[token,recipient],retry:true,maxInstances:1,memory:'256MiB',timeoutSeconds:60},async event=>{
 if(process.env.FUNCTIONS_EMULATOR==='true'||!event.data)return;
 const db=getFirestore(),ref=db.collection(prefix+'LineDeliveries').doc(event.params.requestId);
 const job=await db.runTransaction(async tx=>{
  const [receipt,current]=await Promise.all([tx.get(ref),tx.get(event.data.ref)]),old=receipt.data(),now=Date.now();
  const action=L.decision(old,now);
  if(action==='done')return null;
  if(action==='busy')throw new Error('LINE_DELIVERY_BUSY');
  if(action==='expired'||now-event.data.createTime.toMillis()>=L.MAX_AGE){tx.set(ref,{status:'failed',reason:'retry_window_expired',leaseUntil:0,updatedAt:now},{merge:true});return null;}
  if(!current.exists||current.data().status!=='pending'){tx.set(ref,{status:'skipped',reason:'already_processed',updatedAt:now},{merge:true});return null;}
  const body=old?.body||L.payload(recipient.value()),key=old?.key||L.retryKey(event.data.ref.path);
  const next={body,key,status:'sending',attempts:(old?.attempts||0)+1,firstAttemptAt:old?.firstAttemptAt||now,leaseUntil:now+L.LEASE,updatedAt:now};
  tx.set(ref,next);return next;
 });
 if(!job)return;
 let result;
 try{result=await L.push({token:token.value(),body:job.body,key:job.key});}
 catch(error){await ref.update({status:'retry',leaseUntil:0,updatedAt:Date.now()});throw new Error('LINE_DELIVERY_RETRY');}
 await ref.update({...result,leaseUntil:0,updatedAt:Date.now()});
 if(result.status==='failed')console.error('LINE notification failed',{status:result.httpStatus});
});
