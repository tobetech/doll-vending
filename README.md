# Doll Vending — แอปซื้อจากตู้กด

แอปซื้อสินค้าจากตู้จำหน่ายอัตโนมัติ โดยใช้ **QR Code ประจำตัว** ตู้กดสแกน QR ยืนยันตัวตน แล้วส่ง webhook กลับมาแสดงในแอป มีระบบ Login ผ่าน **Supabase**

**เติมเงิน:** หน้าเมนู → เติมเงิน ใช้ **PromptPay (C-scan-B)** ผ่าน **Ksher** — สแกนจ่ายในแอปธนาคาร ยอดเข้า `vending_member.credit` และอัปเดตบนหน้าจอแบบ realtime (รายละเอียดและ env ดูที่ [`docs/TOPUP_MACHINE_INTEGRATION.md`](docs/TOPUP_MACHINE_INTEGRATION.md))

## การทำงาน

1. ผู้ใช้ Login (อีเมล/รหัสผ่าน) แล้วเข้า **/vending**
2. แสดง **QR ประจำตัว** (มี token แบบ Dynamic QR)
3. ตู้กดสแกน QR → เรียก API ยืนยันผู้ใช้ → จ่ายสินค้า → เรียก Webhook
4. แอปบันทึกลง Supabase และแสดงในประวัติ (realtime)
5. **เติมเงิน:** สร้างออเดอร์ Ksher → แสดง QR PromptPay → webhook/polling ยืนยันการจ่าย → บวกเครดิต

## ตั้งค่า

### 1. ติดตั้ง

```bash
cd doll-vending
npm install
```

แพ็กเกจที่เกี่ยวข้องกับ Ksher: `ksher-pay` (SDK C-scan-B)

### 2. Supabase

- สร้างโปรเจกต์ที่ [supabase.com](https://supabase.com)
- รัน SQL ตามลำดับใน SQL Editor:
  1. `supabase/vending_migrations.sql` (ตารางการซื้อ)
  2. `supabase/vending_qr_tokens_migration.sql` (ตารางโทเค็น Dynamic QR)
  3. `supabase/user_profiles_migration.sql` (ยอดเงินคงเหลือ และคะแนนสะสม)
  4. `supabase/ksher_topup_orders_migration.sql` (**จำเป็น** ถ้าใช้เติมเงินผ่าน Ksher)
  5. `supabase/vending_topup_token_migration.sql` (**ทางเลือก** — เฉพาะถ้าใช้ตู้เติมเงินแบบสแกน QR ที่ตู้)

### 3. Environment

คัดลอก `.env.example` เป็น `.env.local` แล้วใส่ค่า:

| ตัวแปร | หมายเหตุ |
|--------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | จาก Dashboard → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role — ใช้ API / webhook |
| `NEXT_PUBLIC_APP_URL` | URL ฐานของแอป (เช่น `https://your-app.vercel.app`) — ใช้ fallback สำหรับ verify webhook Ksher |
| `KSHER_HOST` | Host API Ksher (ตามที่ผู้ให้บริการกำหนด เช่น `https://api.ksher.net`) |
| `KSHER_TOKEN` | Token ร้านค้า Ksher |
| `KSHER_WEBHOOK_URL` | **แนะนำ:** URL เต็มของ webhook ที่ลงทะเบียนใน Ksher **ต้องตรงทุกตัวอักษร** กับที่ใช้ `checkSignature` — ถ้าใช้ n8n รับก่อน ให้ใส่ URL ของ n8n (ดู docs) |
| `N8N_TOPUP_CANCEL_WEBHOOK_URL` | (ทางเลือก) Webhook n8n เมื่อผู้ใช้กดยกเลิก QR หน้าเติมเงิน — ดู [`docs/TOPUP_MACHINE_INTEGRATION.md`](docs/TOPUP_MACHINE_INTEGRATION.md) |

### 4. รันแอป

```bash
npm run dev
```

เปิด http://localhost:3000 → ล็อกอิน → หน้าเมนู → สแกน QR (/vending), เติมเงิน, ประวัติ

### 5. Deploy บน Vercel

ใน **Project → Settings → Environment Variables** ใส่ครบทุกตัว (เลือก Production + Preview) แล้ว **Redeploy**:

| ตัวแปร | หมายเหตุ |
|--------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | จาก Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | **service_role** (ห้ามเปิดเผย) — ใช้กับ API / webhook |
| `NEXT_PUBLIC_APP_URL` | URL โดเมนจริงของ deployment |
| `KSHER_HOST`, `KSHER_TOKEN`, `KSHER_WEBHOOK_URL` | สำหรับเติมเงิน PromptPay |
| `N8N_TOPUP_CANCEL_WEBHOOK_URL` | (ถ้าใช้) ยกเลิก QR เติมเงิน → n8n |

ถ้าไม่ใส่ `NEXT_PUBLIC_*` ตอน build เคย error `supabaseUrl is required` — โค้ดล่าสุดใช้ placeholder ให้ build ผ่านได้ แต่**แอปจะใช้งาน Supabase ไม่ได้จนกว่าจะใส่ค่าจริงแล้ว build ใหม่**

**ทดสอบ Postman หลัง deploy:** ใช้ **POST** + **Body → raw → JSON** + Header `Content-Type: application/json`  
- Webhook การซื้อจากตู้: `https://<โดเมน>/api/webhook/vending`  
- Webhook Ksher (ตั้งจาก dashboard Ksher): `https://<โดเมน>/api/webhook/ksher`  
- ถ้าได้ **503** และข้อความ `server_misconfigured` = ยังไม่ได้ตั้ง **`SUPABASE_SERVICE_ROLE_KEY`** (หรือ URL) บน Vercel สำหรับ environment นั้น → ใส่แล้ว **Redeploy**

## Dynamic QR (ความปลอดภัย)

- QR ไม่ใส่ `userId` โดยตรง แต่ใส่ **token** ที่สร้างใหม่ทุก 90 วินาที
- โทเค็นหมดอายุใน **3 นาที** และ**ใช้ได้ครั้งเดียว** หลังตู้กดเรียก validate
- แอปเรียก `POST /api/vending/qr-token` (ส่ง Authorization) เพื่อขอโทเค็น แล้วแสดงใน QR

## API สำหรับตู้กด

| ใช้กับ | Method | URL | Body |
|--------|--------|-----|------|
| ยืนยันผู้ใช้ (หลังสแกน QR) | POST | `/api/vending/validate` | `{ "token": "<uuid จาก QR>" }` (แนะนำ) หรือ `{ "userId": "..." }` แบบเก่า |
| ส่ง webhook หลังจ่ายสินค้า | POST | `/api/webhook/vending` | `{ "userId", "machineId", "productName?", "amount?" }` |

## API เติมเงิน Ksher (ใช้จากแอปที่ล็อกอินแล้ว)

| Method | URL | Headers | Body (JSON) |
|--------|-----|---------|-------------|
| POST | `/api/vending/ksher/create-order` | `Authorization: Bearer <access>` | `{ "amount": 100, "refresh_token"?: "..." }` |
| POST | `/api/vending/ksher/order-status` | `Authorization: Bearer <access>` | `{ "merchantOrderId": "kstu_...", "refresh_token"?: "..." }` |
| POST | `/api/vending/topup-cancel-notify` | `Authorization: Bearer <access>` | `{ "token", "userId", "amount"?, "refresh_token"? }` → ส่งต่อไป n8n ถ้าตั้ง `N8N_TOPUP_CANCEL_WEBHOOK_URL` |

Webhook จาก Ksher → **POST** `/api/webhook/ksher` (ลงทะเบียนใน Ksher ให้ตรง `KSHER_WEBHOOK_URL`)

รายละเอียด flow, ตารางฐานข้อมูล และตู้เติมเงินแบบ QR ที่ตู้ → [`docs/TOPUP_MACHINE_INTEGRATION.md`](docs/TOPUP_MACHINE_INTEGRATION.md)  
สเปกหน้าเดียวสำหรับทีมตู้ (request/response + error code) → [`docs/TOPUP_MACHINE_ONEPAGE_SPEC.md`](docs/TOPUP_MACHINE_ONEPAGE_SPEC.md)

## โครงสร้างโฟลเดอร์

```
doll-vending/
├── app/
│   ├── api/vending/validate/       # API ให้ตู้กดยืนยัน user
│   ├── api/vending/topup-cancel-notify/  # แจ้ง n8n เมื่อยกเลิก QR เติมเงิน
│   ├── api/vending/ksher/          # สร้างออเดอร์ / เช็คสถานะ Ksher
│   ├── api/webhook/vending/        # Webhook รับการซื้อจากตู้
│   ├── api/webhook/ksher/          # Webhook จาก Ksher (เติมเงิน)
│   ├── menu/                       # หน้าเมนูหลัก (ยอดเงิน, เมนู, log out)
│   ├── menu/topup/                 # เติมเงิน (PromptPay QR)
│   ├── menu/history/               # ประวัติการใช้งาน
│   ├── login/                      # หน้าเข้าสู่ระบบ
│   ├── vending/                    # หน้าสแกน QR (นับถอยหลัง, สำเร็จ/ล้มเหลว)
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── lib/
│   ├── supabase.ts
│   ├── supabase-server.ts
│   ├── ksher-cscanb.ts             # SDK Ksher C-scan-B, แปลงยอด, verify URL
│   ├── ksher-complete-topup.ts     # บวก credit + บันทึก vending_transactions
│   ├── auth-resolve-user-id.ts     # แปลง Bearer → user id (API เติมเงิน)
│   └── types.ts
├── supabase/
│   ├── vending_migrations.sql
│   ├── vending_qr_tokens_migration.sql
│   ├── user_profiles_migration.sql
│   ├── ksher_topup_orders_migration.sql
│   └── vending_topup_token_migration.sql
├── docs/
│   └── TOPUP_MACHINE_INTEGRATION.md
├── .env.example
└── package.json
```
