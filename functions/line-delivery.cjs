'use strict';
const {createHash}=require('node:crypto');
const MAX_AGE=23*60*60*1000,MAX_ATTEMPTS=8,LEASE=120000;
function retryKey(id){const h=createHash('sha256').update('ce-line-request:'+id).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;}
function payload(recipient){
 if(!/^U[a-f0-9]{32}$/.test(recipient))throw new Error('LINE_RECIPIENT_INVALID');
 return {to:recipient,messages:[{type:'template',altText:'CE Point · มีคำขอแลกรางวัลใหม่',template:{type:'buttons',title:'มีคำขอแลกรางวัลใหม่ ✦',text:'ทีมส่งคำขอมาแล้ว แตะเปิดเว็บเพื่อดูรายละเอียดและอนุมัติ',actions:[{type:'uri',label:'เปิดคำขอ',uri:'https://ce-point-lite-preview.netlify.app/?view=requests'}]}}]};
}
function decision(record,now){
 if(record?.status==='accepted'||record?.status==='failed'||record?.status==='skipped')return 'done';
 if(record&&(now-record.firstAttemptAt>=MAX_AGE||record.attempts>=MAX_ATTEMPTS))return 'expired';
 if(record?.leaseUntil>now)return 'busy';
 return 'send';
}
async function push({token,body,key,fetchImpl=fetch}){
 const response=await fetchImpl('https://api.line.me/v2/bot/message/push',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json','X-Line-Retry-Key':key},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 // 409 with accepted-request-id proves LINE already accepted this exact retry key.
 if(response.ok||(response.status===409&&response.headers.get('x-line-accepted-request-id')))return {status:'accepted',httpStatus:response.status};
 if(response.status>=500)throw new Error('LINE_TRANSIENT_'+response.status);
 return {status:'failed',httpStatus:response.status};
}
module.exports={retryKey,payload,decision,push,MAX_AGE,MAX_ATTEMPTS,LEASE};
