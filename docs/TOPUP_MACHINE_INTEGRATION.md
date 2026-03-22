# ตู้เติมเงิน — เชื่อมกับ Doll Vending

## Flow

1. ลูกค้าเปิดแอป **เมนู → เติมเงิน** → ระบบสร้างแถวใน `vending_topup_token` และแสดง **QR Code**
2. ข้อมูลใน QR เป็น JSON:
   ```json
   { "type": "topup", "token": "uuid" }
   ```
3. **ตู้เติมเงิน** สแกน QR แล้วเรียก **Validate** → ได้ `userId` (token เปลี่ยนเป็น `locked`)
4. ตู้ให้ลูกค้าใส่จำนวนเงิน / รับเงินสด ตามระบบของตู้
5. เมื่อรายการสำเร็จ ตู้เรียก **Webhook** พร้อม `token`, `userId`, `amount`, `machineId` → ระบบเพิ่ม `credit` ใน `vending_member` และบันทึก `vending_transactions`

---

## 1) Validate token (หลังสแกน QR)

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

---

## 2) Webhook แจ้งเติมเงินสำเร็จ

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

---

## ฐานข้อมูล

รัน SQL: **`supabase/vending_topup_token_migration.sql`** ใน Supabase SQL Editor

ตาราง: `public.vending_topup_token`  
Real-time: เปิด publication ให้ตารางนี้ (สคริปต์จัดการให้) เพื่อแอปอัปเดตเมื่อเติมเงินสำเร็จ

---

## ความปลอดภัย

- Webhook นี้ไม่มีลายเซ็นในตัวอย่าง — ถ้าต้องการให้ตั้ง **secret header** หรือ **IP allowlist** ควรเพิ่มใน API ภายหลัง
