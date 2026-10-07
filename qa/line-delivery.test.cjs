'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),L=require('../functions/line-delivery.cjs');
test('stable retry keys and private notification content',()=>{
 assert.equal(L.retryKey('requests/a'),L.retryKey('requests/a'));assert.notEqual(L.retryKey('requests/a'),L.retryKey('requests/b'));
 assert.match(L.retryKey('requests/a'),/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-a[a-f0-9]{3}-[a-f0-9]{12}$/);
 const body=L.payload('U'+'a'.repeat(32));assert.equal(body.messages.length,1);assert.match(body.messages[0].template.actions[0].uri,/\?view=requests$/);
 assert.throws(()=>L.payload('C'+'a'.repeat(32)));
});
test('lease, terminal statuses and retry expiry prevent duplicate/spam delivery',()=>{
 assert.equal(L.decision(null,100),'send');
 for(const status of ['accepted','failed','skipped'])assert.equal(L.decision({status},100),'done');
 assert.equal(L.decision({firstAttemptAt:1,attempts:1,leaseUntil:200},100),'busy');
 assert.equal(L.decision({firstAttemptAt:1,attempts:1,leaseUntil:0},100),'send');
 assert.equal(L.decision({firstAttemptAt:1,attempts:8},100),'expired');
 assert.equal(L.decision({firstAttemptAt:1,attempts:1},L.MAX_AGE+1),'expired');
});
test('LINE accepted retry is success; permanent failures stop and transient failures retry',async()=>{
 const args={token:'test-only',body:L.payload('U'+'a'.repeat(32)),key:L.retryKey('a')};
 let seen;
 const accepted=await L.push({...args,fetchImpl:async(url,options)=>{seen={url,options};return new Response(null,{status:200});}});
 assert.equal(accepted.status,'accepted');assert.equal(seen.options.headers['X-Line-Retry-Key'],args.key);
 assert.equal((await L.push({...args,fetchImpl:async()=>new Response(null,{status:409,headers:{'x-line-accepted-request-id':'accepted'}})})).status,'accepted');
 for(const status of [400,401,403,409,429])assert.equal((await L.push({...args,fetchImpl:async()=>new Response(null,{status})})).status,'failed');
 await assert.rejects(L.push({...args,fetchImpl:async()=>new Response(null,{status:503})}));
 await assert.rejects(L.push({...args,fetchImpl:async()=>{throw new Error('timeout');}}));
});
