'use strict';
(()=>{
 let installPrompt,installed=false;
 const standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
 const button=document.createElement('button');button.className='pwa-launcher';button.textContent='＋ เพิ่มลงมือถือ';button.hidden=standalone();
 const help=document.createElement('dialog');help.className='pwa-dialog';help.setAttribute('aria-label','ติดตั้ง CE Point');
 const isIOS=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 help.innerHTML=`<h2>CE Point อยู่ใกล้ขึ้นอีกนิด ✦</h2><p>เพิ่มไอคอนบนหน้าจอ แล้วแตะเข้าใช้งานได้เลย</p><ol>${isIOS?'<li>เปิดเว็บนี้ด้วย Safari</li><li>แตะเมนูแชร์ แล้วเลือก <strong>เพิ่มไปยังหน้าจอโฮม</strong></li><li>เปิดตัวเลือก “เปิดเป็นแอปหน้าเว็บ” ถ้ามี แล้วกดเพิ่ม</li>':'<li>เปิดเว็บนี้ด้วย Chrome หรือ Edge</li><li>เปิดเมนู ⋮ แล้วเลือก <strong>ติดตั้งแอป</strong> หรือ <strong>เพิ่มลงหน้าจอหลัก</strong></li><li>ยืนยันเพิ่ม CE Point</li>'}</ol><p>ใช้บัญชี CE เดิม · ต้องเชื่อมต่ออินเทอร์เน็ตเพื่อทำรายการ</p><button type="button">เข้าใจแล้ว</button>`;
 help.querySelector('button').addEventListener('click',()=>help.close());
 button.addEventListener('click',async()=>{if(installPrompt){const prompt=installPrompt;installPrompt=null;await prompt.prompt();const choice=await prompt.userChoice;if(choice.outcome==='accepted')button.hidden=true;}else help.showModal();});
 window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;button.hidden=standalone();});
 window.addEventListener('appinstalled',()=>{installPrompt=null;installed=true;button.hidden=true;help.close();});
 const offline=document.createElement('div');offline.className='pwa-connection';offline.setAttribute('role','status');offline.textContent='ออฟไลน์อยู่ · เชื่อมต่อเน็ตก่อนทำรายการนะ';
 const connection=()=>offline.hidden=navigator.onLine;window.addEventListener('online',connection);window.addEventListener('offline',connection);connection();
 document.body.append(button,help,offline);
 new MutationObserver(()=>{button.hidden=installed||standalone()||Boolean(document.querySelector('#dialog[open]'));}).observe(document.getElementById('dialog'),{attributes:true,attributeFilter:['open']});
 if('serviceWorker' in navigator&&!window.CE_QA_FIXTURE)window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));
})();
