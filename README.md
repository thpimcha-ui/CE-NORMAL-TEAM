# CE Normal Point Lite

เว็บไซต์ไทยสำหรับทีม CE ใช้ Firebase Authentication เดิม และ API ฝั่งเซิร์ฟเวอร์สำหรับทุกการแก้ข้อมูล

## สถานะการปล่อย

สาขานี้เตรียมสำหรับเว็บทดสอบแยกใน Netlify ไม่ควรนำขึ้นเว็บเดิมก่อนทดสอบครบ
API ใช้ collection ชื่อ `ceLitePreview*` และสำเนายอดแต้มจากฐานเดิม บัญชีเข้าสู่ระบบยังเป็นบัญชี Firebase เดิม
การสร้างบัญชีหรือออกรหัสชั่วคราวเปลี่ยน Firebase Authentication จริง แม้อยู่เว็บทดสอบ
ข้อมูลเดิม `users`, `rewards`, `history` และ `home.html` เก็บไว้ครบ

## กติกา

| Tier | Clean ต่อเนื่อง | แต้มรายเดือน |
|---|---|---|
| Gold | 0–1 เดือน | 5 NMP |
| Diamond | 2–4 เดือน | 6 NMP |
| Master | 5–11 เดือน | 7 NMP |
| Predator | 12 เดือนขึ้นไป | 10 NMP |

KPI ครบรายคนเพิ่ม 1 NMP เมื่อไม่มี Investigation; ทีม Top Performance เพิ่ม 1 NMP ทุกคน
Investigation หักเคสละ 2 NMP ถึงแต้มสะสม ยอดต่ำสุด 0 และรีเซ็ต Clean Streak
แลกรางวัลกันแต้มเมื่อส่งคำขอ หักจริงเมื่ออนุมัติ และไม่หักซ้ำตอนส่งมอบ
เงินรางวัลจำกัด 3 คนต่อปี คนละ 1 ครั้ง ใครส่งก่อนจองก่อน
ใช้ Tier ก่อนปิดเดือนคิดแต้ม ปิดเดือนได้ครั้งเดียวและเรียงเดือนที่จบแล้ว
ปิดเดือนย้อนหลังได้ตั้งแต่ `startMonth` ที่กำหนดตอนเริ่มระบบเท่านั้น เดือนก่อนหน้านั้นรวมอยู่ในยอดตั้งต้นแล้วและห้ามปิดซ้ำ

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

เตรียมสำเนาทดลองครั้งเดียว (สคริปต์ปฏิเสธการเขียนทับ และสำรองข้อมูลไว้ใน home ส่วนตัวของ Cloud Shell):

```sh
node functions/bootstrap.cjs 2026-10
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
