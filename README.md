# CE Normal Point Lite

เว็บไซต์ไทยสำหรับทีม CE ใช้ Firebase Authentication เดิม และ API ฝั่งเซิร์ฟเวอร์สำหรับทุกการแก้ข้อมูล

## สถานะการปล่อย

เว็บทดลองอยู่ที่ https://ce-normal-point-pilot-thkittoz.netlify.app/ ในทีม Netlify `thkittoz` และเปิดให้เข้าถึงหน้าเข้าสู่ระบบแล้ว
API ใช้ collection ชื่อ `ceLitePreview*` แยกจากเว็บเดิม บัญชีเข้าสู่ระบบยังเป็นบัญชี Firebase เดิม
ฐานทดลองเริ่ม ส.ค. 2569 โดยพนักงาน 15 คนมี 0 NMP / 0 Clean Streak และยังไม่ปิดเดือน การตั้งเดือนเริ่มถูกบันทึกใน Audit แล้ว
การสร้างบัญชีหรือออกรหัสชั่วคราวเปลี่ยน Firebase Authentication จริง แม้อยู่เว็บทดสอบ
ข้อมูลเดิม `users`, `rewards`, `history` และ `home.html` เก็บไว้ครบ

## กติกา

| Tier | Clean ต่อเนื่อง | แต้มรายเดือน |
|---|---|---|
| Gold | 0–2 เดือน | 5 NMP |
| Diamond | 3–5 เดือน | 6 NMP |
| Master | 6–10 เดือน | 7 NMP |
| Predator | 11 เดือนขึ้นไป | 10 NMP |

KPI ครบรายคนเพิ่ม 2 NMP เมื่อไม่มี Investigation; ผู้ได้ Top Performance เพิ่ม 5 NMP และเพื่อนที่ KPI ครบเพิ่ม 1 NMP ในเดือนที่มี Top
Supervisor เพิ่ม Point พิเศษรายคนตอนปิดเดือน หรือปรับแต้มสะสมทันทีโดยระบุเหตุผลทุกครั้ง
การปรับแต้ม การอนุมัติรางวัล และการปิด/แก้เดือนเขียน Log แยกแบบไม่เขียนทับค่าเดิม Supervisor ส่งออก CSV ไฟล์เดียวจากหน้า “ทีมของเรา” ได้ โดยคอลัมน์ชนิดบันทึกแยกประวัติแต้มปัจจุบันจาก Log การจัดการ
Investigation หักเคสแรกของแต่ละเรื่อง 2 NMP และเคสซ้ำเรื่องเดิมในเดือนนั้นหัก 4 NMP ถึงแต้มสะสม ยอดต่ำสุด 0 และรีเซ็ต Clean Streak
แลกรางวัลกันแต้มเมื่อส่งคำขอ หักจริงเมื่ออนุมัติ และไม่หักซ้ำตอนส่งมอบ
เงินรางวัลจำกัด 3 คนต่อปี คนละ 1 ครั้ง ใครส่งก่อนจองก่อน
ใช้ Tier ก่อนปิดเดือนคิดแต้ม ปิดเดือนใหม่ตามลำดับเดือนที่จบแล้ว และแก้เดือนที่ปิดได้โดยคำนวณเดือนถัดไปใหม่
ต้นแบบกำหนดเดือนแรกเป็นสิงหาคม 2569 สำหรับพนักงานทั้ง 15 คน โดยเริ่ม 0 NMP / 0 Clean Streak; เดือนก่อนหน้านั้นปิดไม่ได้ การใช้กติกานี้กับ Firebase จริงต้องสำรองและย้ายข้อมูลตั้งต้นก่อน

## LINE My Point สำหรับเว็บทดลอง

LINE OA ใช้ rich menu ปุ่ม `My Point` ที่ส่งข้อความ `My Point` เข้าแชตส่วนตัว หรือพิมพ์คำเดียวกันเองได้ (Webhook รองรับ postback `action=my_point` ด้วย)
Webhook `ceLineMyPointWebhook` ตรวจ LINE signature จาก raw body ก่อนทำงาน ใช้ `CE_LINE_CHANNEL_SECRET` และ `CE_LINE_ACCESS_TOKEN` ใน Firebase Secret Manager
ผู้ใช้ต้องผูก LINE กับบัญชี CE ของตัวเองผ่าน LINE account linking ทางการก่อน ระบบเก็บความสัมพันธ์ใน `ceLitePreviewLineLinks` และอ่าน Firestore ด้วย Admin SDK ฝั่ง Cloud Function เท่านั้น
หน้าโปรไฟล์ยกเลิกการผูกได้ บัญชีที่ปิดใช้งานหรือยังไม่เปลี่ยนรหัสชั่วคราวดู My Point ไม่ได้ อันดับนับเฉพาะพนักงานที่ใช้งานอยู่ และใช้ `standing()` เดียวกับเว็บ
ปิด Auto-response มาตรฐานของ OA เพื่อไม่ให้ตอบข้อความซ้ำกับ Webhook และเปิด Webhooks ไว้
ทดสอบใน OA และเว็บทดลองก่อนเปิดทีม โดยไม่แก้ Firestore Rules เดิมหรือ collection เดิม

## บัญชี

Supervisor สร้างชื่อผู้ใช้และรับรหัสสุ่มชั่วคราวเพื่อส่งให้เจ้าของบัญชีเป็นการส่วนตัว
พนักงานต้องตั้งรหัสอย่างน้อย 10 ตัวก่อนใช้ข้อมูล รหัสส่วนตัวไม่ได้เก็บใน Firestore
ลืมรหัสให้ Supervisor ออกรหัสชั่วคราวใหม่ บัญชีพนักงานปิดใช้งานได้โดยเก็บประวัติ
ยังไม่เปิดสมัครเอง บัญชี Firebase ที่ไม่มี membership เข้า API ไม่ได้

## การติดตั้งใน Cloud Shell

```sh
cd functions
npm ci --no-audit --no-fund
cd ..
firebase emulators:exec --project demo-ce-point-lite --only auth,firestore,functions 'node --test qa/integration.test.cjs'
node --test qa/domain.test.cjs
```

`bootstrap.cjs` ใช้เฉพาะการติดตั้งใหม่ที่ยังไม่มี `ceLitePreviewControl/settings` เท่านั้น ฐานทดลองปัจจุบันตั้งต้น ส.ค. 2569 และสำรองข้อมูลก่อนเปลี่ยนไว้ใน Cloud Shell แล้ว **ห้ามรันซ้ำ**

สำหรับฐานทดลองใหม่ที่ว่างเปล่าเท่านั้น (สคริปต์ปฏิเสธการเขียนทับ และสำรองข้อมูลไว้ใน home ส่วนตัวของ Cloud Shell):

```sh
node functions/bootstrap.cjs 2026-08
firebase deploy --project cenolmal --only functions:ce-point-lite,firestore:indexes
```

**อย่า deploy `firestore:rules` ระหว่างเว็บเดิมยังใช้การเขียนจาก client**: Rules ในสาขานี้เป็นฉบับเตรียมสำหรับ cutover และให้ API เป็นผู้จัดการข้อมูลทั้งหมด
ก่อน cutover ต้องสำรองข้อมูล ตรวจยอดเดิมครั้งสุดท้ายและนำข้อมูลไป collection จริง แยกจากรายการทดสอบ
ห้ามใช้ข้อมูลรายคนหรือข้อมูลสำรองใน GitHub สาธารณะ และไม่ใช้ service account key ใน frontend

Netlify ตั้ง publish directory `public` ใช้ไฟล์ `netlify.toml` ไม่มี build command
ระบบไม่มี push notification; กระดิ่งในเว็บตรวจรายการใหม่ทุก 60 วินาที และเมื่อกลับเข้าหน้า
ประวัติหน้าเว็บแสดง 200 รายการล่าสุด โดยรายการทั้งหมดเก็บอยู่ในฐานข้อมูล

## ตรวจ 4 งานหลัก

1. เข้าใช้งานด้วย Admin และ Employee เดิม และตรวจการตั้งรหัสแรกสำหรับบัญชีใหม่
2. อัปโหลด/เปลี่ยน/ลบรูปโปรไฟล์ และรูปของรางวัล
3. ปิดเดือน ตรวจผลรวม รายคน การรีเซ็ต Tier และห้ามปิดซ้ำ
4. แลก/อนุมัติ/ปฏิเสธ/ส่งมอบ และลองส่งคำขอพร้อมกันสำหรับสิทธิ์สุดท้าย

ไฟล์ `qa/integration.test.cjs` ปฏิเสธการรันบนฐานจริงและทดสอบด้วย demo emulator เท่านั้น
