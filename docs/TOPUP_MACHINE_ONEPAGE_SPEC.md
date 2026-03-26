# Topup API Spec (One Page) — สำหรับทีมตู้

เอกสารนี้อธิบายสเปกฝั่งตู้สำหรับ flow เติมเงิน:
- แอปสร้าง QR payload `{ userID, action: "topup", amount, token }`
- ตู้สแกน QR แล้วไปทำรายการรับชำระเอง (เช่น Ksher)
- เมื่อชำระสำเร็จ ตู้ callback มาที่แอปเพื่อเพิ่มเครดิตผู้ใช้

---

## Base URL

- Production: `https://<your-domain>`
- Endpoint หลัก: `POST /api/webhook/vending-topup`

`Content-Type: application/json`

---

## QR Payload ที่ตู้ต้องอ่าน

ตัวอย่างข้อมูลจาก QR:

```json
{
  "userID": "8d5b2c1f-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "action": "topup",
  "amount": 100,
  "token": "7ac9cc8e-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
}
```

ความหมาย:
- `userID`: ผู้ใช้เจ้าของรายการเติมเงิน
- `action`: ต้องเป็น `"topup"`
- `amount`: จำนวนเงินที่ผู้ใช้เลือก (บาท)
- `token`: รหัสอ้างอิงรายการเติมเงิน (ใช้ตรวจสอบความถูกต้อง/กันซ้ำ)

---

## Callback เมื่อชำระสำเร็จ

### Request

`POST /api/webhook/vending-topup`

```json
{
  "token": "7ac9cc8e-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "userId": "8d5b2c1f-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "action": "topup",
  "amount": 100,
  "machineId": "vm-01",
  "transactionId": "ksher-order-12345"
}
```

Field:
- `token` (required): ต้องใช้ค่าเดียวกับใน QR
- `userId` (required): ต้องตรงกับ `userID` ใน QR
- `action` (optional but recommended): ถ้าส่งมา ต้องเป็น `"topup"`
- `amount` (required): ต้องตรงกับค่าใน QR
- `machineId` (required): รหัสเครื่องตู้
- `transactionId` (optional): รหัสรายการจากระบบรับชำระของตู้ (ใช้ trace)

### Success Response (200)

```json
{
  "ok": true,
  "transactionId": "db-transaction-id",
  "createdAt": "2026-03-26T12:34:56.000Z",
  "newCredit": 350.5
}
```

- `newCredit` คือยอดเงินคงเหลือใหม่ของผู้ใช้หลังเติมสำเร็จ

### Duplicate Response (200)

```json
{
  "ok": true,
  "duplicate": true,
  "message": "Top-up already recorded for this token"
}
```

กรณี callback ซ้ำระบบจะไม่บวกเงินซ้ำ (idempotent)

---

## Error Codes ที่ทีมตู้ต้อง handle

### 400 Bad Request

เงื่อนไขที่พบบ่อย:
- `token is required`
- `userId and machineId are required`
- `action must be topup`
- `amount must be a positive number`

การจัดการ:
- ถือเป็น payload ผิดรูปแบบ
- ไม่ต้อง retry แบบเดิม ให้แก้ข้อมูลก่อนส่งใหม่

### 404 Not Found

ตัวอย่าง:
- `Token not found for this user`

การจัดการ:
- ตรวจว่าตู้ใช้ `token`/`userId` ชุดเดียวกับที่สแกนจาก QR จริง
- ไม่ควร retry ซ้ำถ้าค่าไม่ถูกต้อง

### 409 Conflict

ตัวอย่าง:
- `amount mismatch with QR payload`
- `Token status ... is not allowed`
- `Token cannot be completed (already used or status changed)`

การจัดการ:
- ถ้า amount mismatch ให้ยกเลิกรายการและแจ้งผู้ใช้
- ถ้า token ถูกใช้/หมดสถานะ ให้แอปสร้าง QR ใหม่

### 500 Server Error

ตัวอย่าง:
- DB error / service ชั่วคราว

การจัดการ:
- retry ได้แบบ exponential backoff (เช่น 1s, 2s, 4s, สูงสุด 3-5 ครั้ง)
- ถ้ายังไม่ผ่านให้เก็บคิวส่งซ้ำและแจ้งเจ้าหน้าที่

---

## Recommended Retry Policy

- Retry เฉพาะ `5xx` หรือ network timeout
- ห้าม retry อัตโนมัติเมื่อ `4xx` (ยกเว้นมีการแก้ payload แล้วส่งใหม่)
- ใส่ `transactionId` ทุกครั้งเพื่อ trace ข้ามระบบ

---

## Integration Checklist

- ตู้ parse QR JSON ได้ครบ 4 ฟิลด์
- ตู้ส่ง callback เฉพาะหลังชำระสำเร็จจริง
- `amount` ที่ส่งกลับต้องตรงกับ QR
- เก็บ log request/response พร้อม `token`, `userId`, `machineId`, `transactionId`
- ตั้ง monitoring กรณี 409/500 เกิน threshold

