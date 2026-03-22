# ทดสอบ API ด้วย Postman หลัง Deploy Vercel

## ตั้งค่า Postman

1. **Method:** `POST`
2. **URL:** `https://<โปรเจกต์-vercel>.vercel.app/api/webhook/vending` (หรือโดเมนของคุณ)
3. **Headers:** `Content-Type` = `application/json`
4. **Body:** เลือก **raw** + **JSON** แล้ววางตัวอย่าง:

```json
{
  "userId": "uuid-จาก-vending_member-หรือ-auth.users",
  "machineId": "machine-01",
  "productId": "item-001",
  "productName": "ทดสอบ",
  "amount": 10
}
```

## Error ที่พบบ่อย

| อาการ | สาเหตุที่เป็นไปได้ |
|--------|---------------------|
| **503** + `code: "server_misconfigured"` | บน Vercel ยังไม่มี **`SUPABASE_SERVICE_ROLE_KEY`** หรือ **`NEXT_PUBLIC_SUPABASE_URL`** ว่าง/ผิด → ไปที่ **Settings → Environment Variables** ใส่ครบทุกตัว (Production **และ** Preview ถ้าทดสอบ preview URL) แล้วกด **Redeploy** |
| **400** Invalid JSON | Body ไม่ใช่ JSON หรือลืม Header `Content-Type: application/json` |
| **404** `member_update_failed` | `userId` ไม่มีใน `vending_member` |
| **402** `insufficient_credit` | `amount` มากกว่า `credit` ปัจจุบัน |
| **405 Method Not Allowed** | ใช้ GET แทน POST |

## Environment Variables ที่ต้องมีบน Vercel

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` ← **จำเป็นสำหรับ webhook / validate / qr-token ฝั่งเซิร์ฟเวอร์**

หมายเหตุ: ค่า `NEXT_PUBLIC_*` ถูกฝังตอน **build** — หลังแก้ env ควร **Redeploy** ใหม่ทุกครั้ง
