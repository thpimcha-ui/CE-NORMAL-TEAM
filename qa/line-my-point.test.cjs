'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{createHmac}=require('node:crypto');
const L=require('../functions/line-my-point.cjs');
const Web=require('../public/rules.js'),Server=require('../functions/rules.cjs');
const team=[{id:'a',name:'Pond',role:'employee',active:true,points:1250,streak:3},{id:'b',role:'employee',active:true,streak:6},{id:'c',role:'employee',active:true,streak:3},{id:'d',role:'employee',active:false,streak:20},{id:'o',role:'admin',active:true,streak:18}];
test('LINE and web use identical tier and active employee rank logic',()=>{
 assert.deepEqual(Server.standing(team[0],team),Web.standing(team[0],team));
 assert.deepEqual(Server.standing(team[0],team),{tier:'Diamond',nextTier:'Master',monthsToNext:2,rank:2,total:3,tied:true});
 assert.match(L.scoreText(team[0],team),/Point: 1,250 P\nTier: Diamond\nเหลืออีก: 2 Clean Streak → Master\nอันดับทีม: #2 \(อันดับร่วม\) \/ 3/);
 assert.equal(Server.standing(team[4],team).rank,null);
});
test('LINE webhook signature validates raw bytes',()=>{
 const raw=Buffer.from('{"events":[]}'),sig=createHmac('sha256','secret').update(raw).digest('base64');
 assert.equal(L.validSignature(raw,sig,'secret'),true);
 assert.equal(L.validSignature(Buffer.from('{"events":[] }'),sig,'secret'),false);
 assert.equal(L.validSignature(raw,'broken','secret'),false);
});
test('historical months close once, in order, after month end',()=>{
 const D=require('../functions/domain.cjs'),employee={id:'a',name:'A',role:'employee',active:true,points:0,streak:0};
 const base={employees:[employee],requests:[],startMonth:'2026-10',checks:{},teamTop:false,now:'2027-02-01T10:00:00+07:00'};
 const oct=D.closeMonth({...base,months:[],month:'2026-10'});
 assert.equal(oct.entries[0].balanceAfter,5);
 assert.throws(()=>D.closeMonth({...base,months:[oct],month:'2026-10'}));
 assert.throws(()=>D.closeMonth({...base,months:[oct],month:'2026-12'}));
 const nov=D.closeMonth({...base,employees:[{...employee,points:5,streak:1}],months:[oct],month:'2026-11'});
 assert.equal(nov.entries[0].balanceAfter,10);
});
