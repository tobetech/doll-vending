# สรุปการทำงานฝั่งตู้กดสินค้า (Doll Vending)

เอกสารนี้อธิบายว่าตู้กด/ระบบตู้กดต้องทำอะไรบ้างเพื่อเชื่อมกับแอป Doll Vending

---

## ภาพรวม Flow

1. ลูกค้าเปิดแอป → เข้าหน้า **สแกน QR** → แอปแสดง **QR Code** (ภายในมี **token** ใช้ได้ครั้งเดียว มีอายุประมาณ 3 นาที)
2. ลูกค้านำมือถือไป **สแกนที่ตู้กด**
3. **ตู้กด** อ่าน QR → เรียก API **Validate** ด้วย token → ได้ **userId**
4. ตู้กดทำรายการ (ตรวจสอบยอด/หักเงิน ถ้ามีระบบ) → จ่ายสินค้า
5. ตู้กดเรียก API **Webhook** ส่งผลกลับ → แอปแสดง "สำเร็จ" และกลับหน้าเมนู

---

## ขั้นตอนที่ตู้กดต้องทำ

### ขั้นที่ 1: อ่าน QR Code

- ลูกค้าแสดง QR บนมือถือ (จากแอป หน้า "สแกน QR Code ซื้อของ")
- ตู้กดใช้ **QR Scanner** อ่านค่า
- ข้อมูลใน QR เป็น **JSON** รูปแบบ:
  ```json
  {
    "token": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "amount": 150
  }
  ```
  - `token` = UUID ใช้ได้**ครั้งเดียว** และมีอายุประมาณ **3 นาที**
  - `amount` = ยอดเงินรวมที่ลูกค้ายืนยัน (บาท) — จำนวนชิ้น × ราคาต่อชิ้น (แอปใช้ 10 บาท/ชิ้น) เพื่อให้ตู้ทราบยอดสั่งซื้อ และต้องส่งค่าเดียวกันไปที่ **Validate** และใช้เป็นยอดหักใน **Webhook**

---

### ขั้นที่ 2: ตรวจสอบ Token และรับ userId (Validate)

ก่อนจะให้ซื้อหรือจ่ายสินค้า ตู้กดต้อง **ยืนยันว่า token ถูกต้อง** และดึง **userId** ของลูกค้ามาใช้ตอนส่ง webhook

**เรียก API:**

- **Method:** `POST`
- **URL:** `https://<โดเมนแอป>/api/vending/validate`
- **Headers:** `Content-Type: application/json`
- **Body (JSON):**
  ```json
  {
    "token": "ค่า token ที่ได้จาก QR",
    "amount": 150
  }
  ```
  - token ที่ล็อกยอดไว้: **ต้อง** ส่ง `amount` ให้ตรงกับใน QR — ไม่ตรงจะได้ **400** พร้อม `expectedAmount`
  - token แบบเก่า (ไม่มียอดล็อก): อาจส่งเฉพาะ `token` ได้

**ตัวอย่าง Response สำเร็จ (200):**
```json
{
  "success": true,
  "userId": "uuid-of-user",
  "email": "user@example.com",
  "amount": 150
}
```

- ค่า **`amount`** ใน response = ยอดบาทที่ตู้ควรใช้กับ webhook (หัก credit) ให้สอดคล้องกับใน QR

**ถ้า token หมดอายุ/ใช้แล้ว/ไม่ถูกต้อง (404):**
```json
{
  "success": false,
  "error": "Token invalid, expired or already used"
}
```

- ถ้าได้ **success: true** → ใช้ค่า **userId** เก็บไว้สำหรับขั้นตอนส่ง Webhook
- ถ้าได้ **success: false** → แสดงข้อความว่า QR หมดอายุหรือใช้แล้ว แนะนำให้ลูกค้าอัปเดต QR ในแอป

---

### ขั้นที่ 3: ทำรายการ (ฝั่งตู้กด)

- ตู้กดทำขั้นตอนปกติของตัวเอง เช่น
  - เลือกสินค้า / ราคา
  - ตรวจสอบยอดเงินลูกค้า (ถ้าตู้กดมีระบบเช็คยอดกับเซิร์ฟเวอร์)
  - หักเงิน (ถ้ามีระบบฝั่งตู้/backend)
  - จ่ายสินค้า
- **เมื่อทำรายการสำเร็จแล้ว** ถึงไปขั้นที่ 4

---

### ขั้นที่ 4: แจ้งผลกลับให้แอป (Webhook)

หลังจ่ายสินค้าเรียบร้อย ตู้กดต้อง **ส่ง Webhook** เพื่อให้แอปแสดง "สำเร็จ" และกลับหน้าเมนู

**เรียก API:**

- **Method:** `POST`
- **URL:** `https://<โดเมนแอป>/api/webhook/vending`
- **Headers:** `Content-Type: application/json`
- **Body (JSON):**
  ```json
  {
    "userId": "uuid จากขั้นที่ 2",
    "machineId": "รหัสตู้กด เช่น machine-01",
    "productId": "รหัสสินค้า (ไม่บังคับ)",
    "productName": "ชื่อสินค้า (ไม่บังคับ)",
    "amount": 25
  }
  ```

**ฟิลด์:**

| ฟิลด์ | บังคับ | ความหมาย |
|--------|--------|----------|
| `userId` | ใช่ | UUID ที่ได้จาก API Validate (ขั้นที่ 2) |
| `machineId` | ใช่ | รหัสตู้กด (ใช้แยกแต่ละตู้) |
| `productId` | ไม่ | รหัสสินค้า |
| `productName` | ไม่ | ชื่อสินค้า |
| `amount` | ไม่* | จำนวนเงินที่**หักจากยอดคงเหลือ** (บาท) — ระบบคำนวณ **`vending_member.credit` ใหม่ = ยอดเดิม − amount`** แล้วบันทึกลง Supabase (เช่น credit 500, amount 10 → เหลือ 490) **ถ้าไม่ส่งหรือส่ง 0 ยอด credit จะไม่เปลี่ยน** แต่รายการยังบันทึกสำเร็จได้ |
| `transactionId` | ไม่ | UUID ของรายการ (ถ้าต้องการกำหนดเอง) |

**ชื่อฟิลด์แบบ snake_case ใช้ได้:** `user_id`, `machine_id`, `product_id`, `product_name`, `transaction_id`  
**ยอดหัก — รองรับชื่อฟิลด์ใดฟิลด์หนึ่งต่อไปนี้ (ตัวเลขหรือสตริง):** `amount`, `deduct`, `deduction`, `price`, `total`, `cost`, `baht`, `value`, `pay`, `paid`, `money`, `charge`

**Response สำเร็จ (200):**
```json
{
  "ok": true,
  "transactionId": "uuid-ที่ระบบสร้าง",
  "createdAt": "2025-03-15T...",
  "newCredit": 45.5,
  "deducted": 25
}
```
- `newCredit` = ยอดเงินคงเหลือหลังหัก (เก็บใน DB เป็น `vending_transactions.credit_after` — แอปเมนูใช้อัปเดตยอดแสดงผล)
- `deducted` = จำนวนที่หัก (เท่า `amount` ที่ส่งมา)

**ยอดเงินไม่พอ (402):**  
`amount` มากกว่า `credit` ปัจจุบัน — ไม่บันทึกรายการ ไม่หักเงิน  
```json
{
  "ok": false,
  "error": "Insufficient credit",
  "code": "insufficient_credit",
  "credit": 10,
  "required": 25
}
```

**Response ไม่สำเร็จ (400/500):**  
มี `ok: false` และ `error: "ข้อความ"` — ให้ตู้กด log ไว้เพื่อตรวจสอบ

---

## สรุป API ที่ตู้กดต้องเรียก

| ลำดับ | วัตถุประสงค์ | Method | URL | Body หลัก |
|--------|----------------|--------|-----|-----------|
| 1 | ตรวจสอบ QR และรับ userId | POST | `/api/vending/validate` | `{ "token": "...", "amount": 150 }` (ยอดจาก QR) |
| 2 | แจ้งผลรายการสำเร็จ | POST | `/api/webhook/vending` | `{ "userId": "...", "machineId": "..." }` |

- โดเมนใช้ตามที่ deploy แอป (เช่น `https://your-app.vercel.app`)
- ทั้งสอง API ไม่ต้องส่ง Authorization (เป็นแบบ server-to-server)

---

## หมายเหตุสำคัญ

1. **Token ใช้ได้ครั้งเดียว**  
   หลังเรียก Validate สำเร็จ แล้ว token นั้นจะถูก mark ว่าใช้แล้ว ลูกค้าต้องเปิดแอปแล้วให้ QR ใหม่ถ้าจะซื้ออีก

2. **ลำดับต้องตรง**  
   ต้องได้ **userId จาก Validate** ก่อน แล้วค่อยส่ง **userId เดียวกัน** ใน Webhook ตอนทำรายการสำเร็จ

3. **ยอดเงิน (credit)**  
   Webhook `/api/webhook/vending` จะ**หัก `vending_member.credit` ตามยอดใน `amount` (หรือฟิลด์ยอดที่รองรับด้านบน)** ถ้าตู้ไม่ส่งยอดหรือส่งเป็น 0 รายการจะสำเร็จได้แต่**ยอดใน Supabaseจะไม่ลด** — ให้ตรวจ body ที่ตู้ส่งจริงใน log ของเซิร์ฟเวอร์ (เช่น Vercel) หรือ Postman

4. **ทดสอบ**  
   - ใช้ Postman/curl เรียก `/api/webhook/vending` ด้วย `userId` จริง (ดู User ID ได้จากแอปโหมด dev หรือ Supabase) เพื่อทดสอบว่าแอปแสดง "สำเร็จ" และกลับเมนู
   - ดูรายละเอียดใน `docs/WEBHOOK_TEST.md`

---

## Flow แบบย่อ (สำหรับทีมตู้กด)

```
[ลูกค้าแสดง QR] → ตู้สแกน QR ได้ token + amount
       ↓
POST /api/vending/validate { "token": "...", "amount": ... }
       ↓
ได้ userId → ตู้ทำรายการ (จ่ายสินค้า)
       ↓
POST /api/webhook/vending { "userId": "...", "machineId": "..." }
       ↓
แอปแสดง "สำเร็จ" และกลับหน้าเมนู
```
