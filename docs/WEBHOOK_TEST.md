# วิธีทดสอบ Webhook ตู้จำหน่ายสินค้า

เมื่อตู้กดทำรายการสำเร็จ ตู้จะส่ง **POST** มาที่ API แล้วแอปจะรับผลผ่าน Supabase Realtime และแสดง "สำเร็จ" แล้วกลับหน้าเมนู

---

## 1. ทดสอบในแอป (โหมด Development)

1. รันแอป: `npm run dev`
2. เข้าสู่ระบบแล้วไปหน้า **สแกน QR** (`/vending`)
3. ด้านล่างการ์ดจะมีบล็อก **"ทดสอบเมื่อตู้กดส่ง webhook กลับมา"**
4. กดปุ่ม **"จำลอง Webhook (ตู้กดทำรายการสำเร็จ)"**
5. แอปจะส่ง POST ไปที่ API → ถ้าสำเร็จจะแสดงป๊อปอัป "สำเร็จ" แล้วกลับหน้าเมนูทันที (ไม่ต้องรอ Realtime)

ถ้ากดแล้วไม่มีอะไรเกิดขึ้น หรือขึ้นข้อความ error สีแดงใต้ปุ่ม ให้เช็ค:
- ตัวแอปและ API รันที่เดียวกัน (เช่น `localhost:3000`) และมี env `SUPABASE_SERVICE_ROLE_KEY` ตั้งไว้
- Supabase → Table Editor → ตาราง `vending_transactions` ถูกสร้างแล้ว

ปุ่มนี้แสดงเฉพาะเมื่อ `NODE_ENV=development` เท่านั้น

---

## 2. ทดสอบด้วย Postman (จำลองตู้กดทำรายการสำเร็จ)

### ขั้นตอน

1. เปิด **Postman** แล้วสร้าง request ใหม่ หรือ import collection จากโฟลเดอร์ `docs/postman/`.

2. **Method:** `POST`

3. **URL**
   - รัน local: `http://localhost:3000/api/webhook/vending`
   - ถ้า deploy แล้ว: `https://<โดเมนของคุณ>/api/webhook/vending`

4. **Headers**
   - `Content-Type` = `application/json`

5. **Body** เลือก **raw** และ **JSON** แล้วใส่ตัวอย่างด้านล่าง (แทน `YOUR_USER_ID` ด้วย UUID จริง):

```json
{
  "userId": "YOUR_USER_ID",
  "machineId": "machine-01",
  "productId": "item-001",
  "productName": "สินค้าทดสอบ",
  "amount": 25
}
```

**ฟิลด์ที่บังคับ:** `userId`, `machineId`  
**ฟิลด์ที่ไม่บังคับ:** `productId`, `productName`, `amount`, `transactionId`

6. กด **Send**  
   - ถ้าสำเร็จจะได้ response ประมาณ `{ "ok": true, "transactionId": "...", "createdAt": "..." }`  
   - แอปจะรู้ว่าตู้ทำรายการสำเร็จได้ 2 แบบ:  
     - **Realtime** (ทันที): ถ้าเปิด Realtime ให้ตาราง `vending_transactions` ใน Supabase แล้ว  
     - **Polling** (ภายใน ~3 วินาที): แอปจะตรวจสอบรายการใหม่ทุก 3 วินาที ถ้า Postman ส่งสำเร็จแล้ว แอปจะแสดง "สำเร็จ" แล้วกลับหน้าเมนูภายในไม่เกิน 3 วินาทีแม้ไม่ได้เปิด Realtime

### Import Collection

ใน Postman: **Import** → เลือกไฟล์  
`docs/postman/Vending-Webhook.postman_collection.json`  

จากนั้นตั้งค่า variables ใน collection: `baseUrl` = URL ของแอป, `userId` = UUID ของ user ที่จะทดสอบ

---

## 3. ทดสอบด้วย curl (จำลองตู้กดส่ง Webhook)

ใช้เมื่อต้องการทดสอบจากเครื่องอื่น หรือจากสคริปต์/ตู้กดจริง

### Endpoint

```
POST https://<โดเมนของคุณ>/api/webhook/vending
Content-Type: application/json
```

### Body (JSON)

| ชื่อ       | บังคับ | ความหมาย                          |
|-----------|--------|------------------------------------|
| `userId`  | ใช่    | UUID ของ user ที่สแกน QR (จาก Supabase Auth) |
| `machineId` | ใช่  | รหัสตู้กด (เช่น `"machine-01"`)     |
| `productId` | ไม่  | รหัสสินค้า                         |
| `productName` | ไม่ | ชื่อสินค้า                      |
| `amount`  | ไม่    | จำนวนเงิน (ตัวเลข)                 |
| `transactionId` | ไม่ | UUID ถ้าต้องการกำหนดเอง        |

### วิธีหา User ID

- **ในแอป (โหมด dev):** หน้า สแกน QR จะแสดง User ID ใต้ปุ่มทดสอบ
- **Supabase Dashboard:** Authentication → Users → ดูคอลัมน์ UID
- **จากแอปหลังล็อกอิน:** เปิด DevTools → Console แล้วรัน  
  `(await window.__supabase?.auth.getUser())?.data?.user?.id`  
  (ถ้าแอป expose supabase ที่ window)

### ตัวอย่างคำสั่ง (รันบนเครื่องที่รันแอป)

แทนที่ `YOUR_USER_ID` ด้วย UUID จริง และถ้ารัน local ใช้ `http://localhost:3000`:

```bash
# รันแอป local (พอร์ต 3000)
curl -X POST http://localhost:3000/api/webhook/vending \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "YOUR_USER_ID",
    "machineId": "test-machine-01",
    "productName": "สินค้าทดสอบ",
    "amount": 25
  }'
```

ตัวอย่าง response เมื่อสำเร็จ:

```json
{
  "ok": true,
  "transactionId": "uuid-ที่สร้างในฐานข้อมูล",
  "createdAt": "2025-03-15T..."
}
```

### ทดสอบจากเครื่องอื่น / Production

ถ้าแอป deploy แล้ว (เช่น Vercel):

```bash
curl -X POST https://your-app.vercel.app/api/webhook/vending \
  -H "Content-Type: application/json" \
  -d '{"userId":"YOUR_USER_ID","machineId":"machine-01"}'
```

---

## 4. Flow การทำงาน

1. User เปิดหน้าสแกน QR → แอปสร้าง token และแสดง QR
2. User นำ QR ไปสแกนที่ตู้กด
3. ตู้กดทำรายการแล้วส่ง **POST** ไปที่ `/api/webhook/vending` พร้อม `userId` (จาก QR/token) และ `machineId`
4. API แทรกแถวลงตาราง `vending_transactions` (status: success)
5. แอป subscribe Supabase Realtime อยู่แล้ว → ได้ event INSERT
6. แอปแสดง "สำเร็จ" แล้ว redirect ไปหน้าเมนู

ถ้าต้องการทดสอบ **สถานะล้มเหลว** ตู้กดอาจส่ง status อื่น (ถ้า API รองรับ) หรือแทรกแถวใน `vending_transactions` ด้วย `status: 'failed'` ผ่าน backend ของตู้ที่มี service role / API ที่รองรับ

---

## 5. ให้ตู้กดจริงส่ง Webhook แล้วแอปรับผลทันที (Realtime)

แอปฟัง Supabase Realtime อยู่แล้ว ถ้าตู้กดส่ง webhook → API แทรกแถวใน `vending_transactions` → แอปจะได้ event และแสดง "สำเร็จ" อัตโนมัติ **เฉพาะเมื่อเปิด Realtime ให้ตารางนี้แล้ว**

ใน Supabase ให้ทำอย่างใดอย่างหนึ่ง:

- **SQL Editor:** รัน `supabase/vending_realtime.sql` (คำสั่ง `alter publication supabase_realtime add table public.vending_transactions;`)
- **Dashboard:** Database → Replication → เปิดตาราง `vending_transactions`

ถ้าไม่ได้เปิด Realtime ตู้กดส่ง webhook แล้วรายการจะบันทึกในตารางและโผล่ในประวัติ แต่แอปที่อยู่หน้าสแกนจะไม่แสดงป๊อปอัป "สำเร็จ" ทันที (ปุ่ม "จำลอง Webhook" ในโหมด dev ยังทำงานได้เพราะแอปจำลองผลหลังเรียก API สำเร็จโดยไม่พึ่ง Realtime)
