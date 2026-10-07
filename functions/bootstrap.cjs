'use strict';
// Run once in authorized Cloud Shell. Snapshots stay in Cloud Shell, outside Git.
const {initializeApp,applicationDefault}=require('firebase-admin/app');
const {getFirestore}=require('firebase-admin/firestore');
const {getAuth}=require('firebase-admin/auth');
const {mkdir,writeFile}=require('node:fs/promises');
const {join}=require('node:path');
const D=require('./domain.cjs');
initializeApp({credential:applicationDefault(),projectId:'cenolmal'});
const db=getFirestore(),prefix='ceLitePreview';
const approvedAdmins=new Set(['8bo6h0Bym6cHOeHuVtT1xrjjOSm1','CF4XPqE0Vlcf6O0GeTZgqOPLqq82','fg1hBSKRrSfTUi4HTjw9xiBfkBz2']);
(async()=>{
 const startMonth=process.argv[2]||new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Bangkok'}).slice(0,7);
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(startMonth))throw new Error('Invalid start month');
 const cfg=db.collection(prefix+'Control').doc('settings');if((await cfg.get()).exists)throw new Error('Already initialized; no overwrite allowed');
 const snapshots={};for(const name of ['users','rewards','history','redemptions','monthlyBatches','settings'])snapshots[name]=(await db.collection(name).get()).docs.map(d=>({id:d.id,...d.data()}));
 if(snapshots.redemptions.some(r=>['pending','PENDING'].includes(r.status)))throw new Error('Legacy pending requests must be reviewed before initialization');
 const owner=snapshots.users.find(u=>u.id==='8bo6h0Bym6cHOeHuVtT1xrjjOSm1');if(!owner?.owner||owner.username!=='thpimcha')throw new Error('Owner does not match verified account');
 const backup=join(process.env.HOME,'ce-point-private-backups',new Date().toISOString().replace(/[:.]/g,'-'));await mkdir(backup,{recursive:true,mode:0o700});await writeFile(join(backup,'original-documents.json'),JSON.stringify(snapshots,null,2),{mode:0o600});
 const batch=db.batch(),createdAt=new Date().toISOString();
 for(const u of snapshots.users){
  const authUser=await getAuth().getUser(u.id);const role=approvedAdmins.has(u.id)?'admin':'employee';
  const member=D.member({id:u.id,points:Number(u.points||0),streak:Number(u.streakMonths||0)});
  batch.create(db.collection(prefix+'Members').doc(u.id),{name:String(u.name||u.username),username:String(u.username).toLowerCase(),role,active:!authUser.disabled&&u.active!==false,points:member.points,streak:member.streak,photo:u.photoData||null,mustChangePassword:false,source:'legacy-copy',createdAt});
 }
 for(const r of snapshots.rewards)batch.create(db.collection(prefix+'Rewards').doc('legacy_'+r.id),{name:String(r.name),description:'รางวัลเดิม · ตรวจมูลค่าและกติกาก่อนเปิดรับแลก',cost:Number(r.cost),value:0,type:'coffee',active:false,photo:null,legacySource:r.id});
 const year=Number(startMonth.slice(0,4));
 batch.create(db.collection(prefix+'Rewards').doc('coffee'),{name:'กาแฟแก้วโปรด',description:'พักเติมพลังสักแก้ว เลือกร้านที่ชอบได้เลย',cost:10,value:50,type:'coffee',active:true,photo:null});
 batch.create(db.collection(prefix+'Rewards').doc('cash'),{name:'รางวัลพิเศษ 1,000 บาท',description:'3 คนต่อปี · คนละ 1 สิทธิ์ · ใครถึงก่อนแลกก่อน',cost:100,value:1000,type:'cash',stock:3,year,active:true,photo:null});
 batch.create(cfg,{startMonth,revision:0,createdAt,mode:'preview',rewardBudget:{},announcement:{title:'พื้นที่ใหม่ของทีม CE ✦',body:'เก็บความสม่ำเสมอทีละเดือน แล้วให้รางวัลตัวเอง\nเว็บนี้เป็นพื้นที่ทดสอบ ระบบใช้สำเนายอดแต้มจากเว็บเดิม',active:true,version:1,updatedAt:createdAt}});
 await batch.commit();console.log('Preview initialized:',snapshots.users.length,'accounts. Original documents unchanged. Backup:',backup);
})().catch(e=>{console.error(e.message);process.exitCode=1;});
