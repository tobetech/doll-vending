# เติมเงิน — Ksher PromptPay (หลัก) และตู้เติมเงิน (ทางเลือก)

แอปใช้ **Ksher C-scan-B** สร้าง **PromptPay QR** ในหน้า **เมนู → เติมเงิน** ผู้ใช้สแกนจ่ายจากแอปธนาคาร เมื่อชำระสำเร็จ ระบบบวกยอดเข้า **`vending_member.credit`** กับยอดเดิม และบันทึก **`vending_transactions`** (`machine_id`: `ksher-promptpay`)

Flow แยกจาก **ตู้เติมเงิน** (สแกน QR ที่แอปแล้วตู้รับเงินสด / ระบบตู้) — ส่วนนั้นยังรองรับผ่าน `vending_topup_token` หากคุณรัน migration และเชื่อมตู้ตามด้านล่าง

---

## ส่วน A — เติมเงินผ่าน Ksher (PromptPay ในแอป)

### Flow

1. ผู้ใช้ล็อกอิน → **เมนู → เติมเงิน** → กรอกจำนวนเงิน (บาท)
2. แอปเรียก **`POST /api/vending/ksher/create-order`** → สร้างแถว `ksher_topup_orders` สถานะ `pending` → เรียก Ksher `orderCreate` (`channel: promptpay`) → ได้รูป QR เป็น **base64** ใน field `reserved1` (ส่งกลับเป็น `qrImageBase64`)
3. ผู้ใช้สแกน QR จ่ายภายในเวลาที่กำหนด
4. เมื่อจ่ายสำเร็จ:
   - **Webhook:** Ksher ส่ง **POST** ไปที่ URL ที่ลงทะเบียน (โดยตรง **`/api/webhook/ksher`** หรือผ่าน **n8n** แล้วค่อยส่งต่อ — ดูหัวข้อด้านล่าง) → ตรวจลายเซ็นด้วย `checkSignature` → เรียก `completeKsherTopupByMerchantOrderId` (อัปเดต `pending` → `paid`, บวกเครดิต, insert ธุรกรรม)
   - **สำรอง:** แอป **poll** **`POST /api/vending/ksher/order-status`** → ถ้า Ksher รายงานจ่ายแล้วจะ complete เช่นกัน
5. แอปฟัง **Realtime** บนตาราง `ksher_topup_orders` และแสดง **ยอดเงินคงเหลือ** ใหม่

### ฐานข้อมูล (Ksher)

รันใน Supabase SQL Editor:

**`supabase/ksher_topup_orders_migration.sql`**

- ตาราง `public.ksher_topup_orders` (`merchant_order_id`, `amount_baht`, `amount_ksher`, `status`, `ksher_instance`, …)
- RLS: ผู้ใช้อ่านได้เฉพาะแถวของตัวเอง
- เพิ่มตารางเข้า **supabase_realtime** เพื่ออัปเดต UI เมื่อสถานะเป็น `paid`

### Environment (Ksher)

| ตัวแปร | ความหมาย |
|--------|----------|
| `KSHER_HOST` | Base URL ของ Ksher API (ไม่มี trailing slash) |
| `KSHER_TOKEN` | Token ร้านค้า |
| `KSHER_WEBHOOK_URL` | **แนะนำ:** URL เต็มของ endpoint ที่ลงทะเบียนใน Ksher dashboard **ต้องเหมือนกับที่ใช้ verify ลายเซ็นในโค้ด** (เช่น `https://your-domain.com/api/webhook/ksher`) |
| `NEXT_PUBLIC_APP_URL` | ถ้าไม่ตั้ง `KSHER_WEBHOOK_URL` ระบบจะใช้ `{NEXT_PUBLIC_APP_URL}/api/webhook/ksher` แทน |

ถ้าไม่มี URL สำหรับ verify (ทั้งคู่ว่าง) webhook จะ **ข้ามการตรวจลายเซ็น** และ log warning — **ไม่แนะนำใน production**

### ทางเลือก: Webhook Ksher → n8n → แอป + MQTT ไปตู้

แอปนี้**ไม่ส่ง MQTT** เอง — ถ้าต้องการให้ตู้ ESP32 รู้ผลหลังจ่าย ให้ใช้ **n8n** เป็น hub:

1. ใน **Ksher dashboard** ลงทะเบียน webhook URL เป็น **Webhook node ของ n8n** (ไม่ใช่ URL ของ Vercel โดยตรง)
2. บน **Vercel** ตั้ง **`KSHER_WEBHOOK_URL`** ให้ตรง **ทุกตัวอักษร** กับ URL นั้น (URL ของ n8n) — เพราะ `checkSignature` คำนวณจาก URL ที่ Ksher ลงทะเบียน ถ้าไม่ตรงลายเซ็นจะไม่ผ่าน
3. ใน workflow n8n:
   - รับ **POST** body จาก Ksher (เก็บ JSON เดิมทั้งก้อน)
   - โหนด **HTTP Request** ส่งต่อ **POST** ไป `https://<โดเมนแอป>/api/webhook/ksher` พร้อม body เดิม (และ header ที่จำเป็นถ้า Ksher ส่งมา)
   - หลังได้ response 200 จากแอป (หรือเมื่อแยกจาก body ว่าเป็นสถานะจ่ายสำเร็จ) ใช้โหนด **MQTT** ใน n8n publish ไป broker ของคุณ — topic/payload ออกแบบเองให้ตู้ subscribe (เช่น `vending/vm-01/topup/paid` + JSON มี `merchantOrderId`)

**หมายเหตุ:** ถ้า n8n แก้ไข body ก่อนส่งต่อ ลายเซ็นอาจไม่ตรง — ควร **forward body ดิบ** ตามที่ Ksher ส่งมา

### API — สร้างออเดอร์ + QR

- **POST** `https://<โดเมน>/api/vending/ksher/create-order`
- **Headers:** `Authorization: Bearer <access_token>`, `Content-Type: application/json`
- **Body:**
  ```json
  {
    "amount": 100,
    "refresh_token": "optional — ใช้เมื่อ access ใกล้หมดอายุ"
  }
  ```
- **ข้อจำกัด:** `amount` เป็นบาท, ช่วงประมาณ **1–500,000** (ตามโค้ดฝั่งเซิร์ฟเวอร์)
- **Response ตัวอย่าง (200):**
  ```json
  {
    "merchantOrderId": "kstu_xxxxxxxx",
    "amountBaht": 100,
    "qrImageBase64": "<base64 ของรูป QR>"
  }
  ```
- ถ้า Ksher ไม่ส่ง `reserved1` จะได้ error `ksher_no_qr` และแถวอาจถูกทำเป็น `failed`

### API — เช็คสถานะ (polling)

- **POST** `https://<โดเมน>/api/vending/ksher/order-status`
- **Headers:** `Authorization: Bearer <access_token>`
- **Body:**
  ```json
  {
    "merchantOrderId": "kstu_xxxxxxxx",
    "refresh_token": "optional"
  }
  ```
- **Response เมื่อจ่ายแล้ว (200):**
  ```json
  {
    "status": "paid",
    "amountBaht": 100,
    "newCredit": 350.5,
    "duplicate": false
  }
  ```
  (`duplicate: true` เมื่อ complete ซ้ำ — idempotent)

### Webhook — Ksher → แอป

- **POST** `https://<โดเมน>/api/webhook/ksher`
- ลงทะเบียน URL นี้ใน **Ksher dashboard** ให้ตรงกับ **`KSHER_WEBHOOK_URL`** (หรือกับ URL ที่สร้างจาก `NEXT_PUBLIC_APP_URL`)
- Payload ประมวลผลฝั่งเซิร์ฟเวอร์: ตรวจ `message` / `code` ว่าเป็นสถานะจ่ายสำเร็จ, แยก `merchant_order_id` หรือหาจาก `ksher_instance` ที่ map กับออเดอร์

### ความปลอดภัย (Ksher)

- ใช้ **`checkSignature`** จาก SDK `ksher-pay` กับ URL ที่ตรงกับที่ลงทะเบียน
- ถ้าลายเซ็นไม่ผ่าน → **401 Invalid signature** — ตรวจสอบว่า URL ใน dashboard กับ `KSHER_WEBHOOK_URL` / `NEXT_PUBLIC_APP_URL` ตรงกันทุกตัวอักษร (รวม scheme และ path)

## ส่วน B — ตู้เติมเงิน (สแกน QR ที่แอป → ตู้รับเงิน)

ใช้เมื่อต้องการให้ลูกค้าแสกน QR บนมือถือที่**ตู้เติมเงิน** แล้วตู้เป็นคนรับเงินและแจ้ง webhook (ไม่ผ่าน Ksher)

### Flow

1. ลูกค้าเปิดแอป **เมนู → เติมเงิน** — ถ้าแอปของคุณยังสร้าง QR แบบนี้ได้ ข้อมูลใน QR จะเป็น JSON:
   ```json
   { "type": "topup", "token": "uuid" }
   ```
   (โปรดตรวจสอบโค้ดปัจจุบันของหน้า topup — **เวอร์ชันหลักของโปรเจกต์นี้ใช้ Ksher แทน QR ตู้นี้บนหน้าเดียวกัน**)
2. **ตู้เติมเงิน** สแกน QR แล้วเรียก **Validate** → ได้ `userId` (token เปลี่ยนเป็น `locked`)
3. ตู้ให้ลูกค้าใส่จำนวนเงิน / รับเงินสด ตามระบบของตู้
4. เมื่อรายการสำเร็จ ตู้เรียก **Webhook** พร้อม `token`, `userId`, `amount`, `machineId` → เพิ่ม `credit` ใน `vending_member` และบันทึก `vending_transactions`

### 1) Validate token (หลังสแกน QR)

- **POST** `https://<โดเมนแอป>/api/vending/topup-validate`
- **Headers:** `Content-Type: application/json`
- **Body:**
  ```json
  { "token": "uuid จาก QR" }
  ```

**Response สำเร็จ (200):**
```json
{
  "success": true,
  "userId": "uuid",
  "email": "user@example.com"
}
```

**ล้มเหลว (404):** token หมดอายุ / ใช้แล้ว / ไม่ใช่สถานะ `pending`

หมายเหตุ: คำขอที่สำเร็จจะเปลี่ยนสถานะ token จาก `pending` → `locked` (ใช้ได้หนึ่งครั้งต่อหนึ่งรายการเติมเงิน)

### 2) Webhook แจ้งเติมเงินสำเร็จ (ตู้)

- **POST** `https://<โดเมนแอป>/api/webhook/vending-topup`
- **Headers:** `Content-Type: application/json`
- **Body:**
  ```json
  {
    "token": "uuid เดียวกับใน QR",
    "userId": "uuid จากขั้น validate",
    "amount": 100,
    "machineId": "topup-machine-01",
    "transactionId": "optional-uuid"
  }
  ```

| ฟิลด์ | บังคับ | ความหมาย |
|--------|--------|-----------|
| `token` | ใช่ | ต้องตรงกับ token ที่ validate แล้ว (สถานะ `locked`) |
| `userId` | ใช่ | ต้องตรงกับเจ้าของ token |
| `amount` | ใช่ | จำนวนเงินที่เติม (บาท) มากกว่า 0 |
| `machineId` | ใช่ | รหัสตู้เติมเงิน |
| `transactionId` | ไม่ | ใส่ได้ถ้าต้องการกำหนด id รายการใน `vending_transactions` |

**Response สำเร็จ (200):**
```json
{
  "ok": true,
  "transactionId": "...",
  "createdAt": "...",
  "newCredit": 250.5
}
```

**ซ้ำ (token completed แล้ว):** `ok: true`, `duplicate: true`

**ข้อผิดพลาด:** `409` ถ้ายังไม่ได้ validate หรือ token/user ไม่ตรงกับสถานะ `locked`

### 3) หมดเวลารอสแกน QR (ESP32 → แอป)

เมื่อตู้นับถอยหลังจบก่อนที่ลูกค้าจะให้สแกน QR (หรือยกเลิกที่ตู้) ให้เรียก endpoint นี้เพื่ออัปเดต token เป็นสถานะ **`scan_timeout`** — แอปจะแสดงข้อความว่าไม่ได้ทำรายการภายในเวลาที่กำหนด แล้วกลับหน้าเมนู

- **POST** `https://<โดเมนแอป>/api/webhook/vending-topup-scan-timeout`
- **Headers:** `Content-Type: application/json`  
  ถ้าตั้ง **`VENDING_TOPUP_MACHINE_SECRET`** ใน environment ต้องแนบ **`Authorization: Bearer <secret>`** หรือ **`X-Vending-Topup-Secret: <secret>`**
- **Body:**
  ```json
  {
    "token": "uuid เดียวกับใน QR",
    "machineId": "topup-machine-01"
  }
  ```
  (`machineId` ไม่บังคับ — ถ้าส่งจะบันทึกลง `vending_topup_token.machine_id`)

**Response สำเร็จ (200):** `{ "ok": true, "updated": true }`

**สถานะอื่น:** `404` ไม่พบ token · `409` token ถูกล็อกแล้ว (สแกน/validate แล้ว) จึงไม่ยกเลิกด้วย timeout นี้ · `200` พร้อม `duplicate: true` ถ้าเป็น `scan_timeout` อยู่แล้ว · `200` พร้อม `skipped: true` ถ้าเติมเงินสำเร็จไปแล้ว (`completed`)

**ฐานข้อมูล:** รัน **`supabase/vending_topup_token_scan_timeout_migration.sql`** เพื่ออนุญาตค่า `status = scan_timeout` (ครั้งเดียวหลัง migration ตารางหลัก)

### ฐานข้อมูล (ตู้เติมเงิน)

รัน SQL: **`supabase/vending_topup_token_migration.sql`** ใน Supabase SQL Editor

ตาราง: `public.vending_topup_token`  
Real-time: เปิด publication ให้ตารางนี้ (สคริปต์จัดการให้) เพื่อแอปอัปเดตเมื่อเติมเงินสำเร็จ

### ความปลอดภัย (ตู้)

- Webhook นี้ไม่มีลายเซ็นในตัวอย่าง — ถ้าต้องการให้ตั้ง **secret header** หรือ **IP allowlist** ควรเพิ่มใน API ภายหลัง
