# Doll Vending — แอปซื้อจากตู้กด

แอปซื้อสินค้าจากตู้จำหน่ายอัตโนมัติ โดยใช้ **QR Code ประจำตัว** ตู้กดสแกน QR ยืนยันตัวตน แล้วส่ง webhook กลับมาแสดงในแอป มีระบบ Login ผ่าน **Supabase**

## การทำงาน

1. ผู้ใช้ Login (อีเมล/รหัสผ่าน) แล้วเข้า **/vending**
2. แสดง **QR ประจำตัว** (มี `userId` ใน QR)
3. ตู้กดสแกน QR → เรียก API ยืนยันผู้ใช้ → จ่ายสินค้า → เรียก Webhook
4. แอปบันทึกลง Supabase และแสดงในประวัติ (realtime)

## ตั้งค่า

### 1. ติดตั้ง

```bash
cd doll-vending
npm install
```

### 2. Supabase

- สร้างโปรเจกต์ที่ [supabase.com](https://supabase.com)
- รัน SQL ตามลำดับใน SQL Editor:
  1. `supabase/vending_migrations.sql` (ตารางการซื้อ)
  2. `supabase/vending_qr_tokens_migration.sql` (ตารางโทเค็น Dynamic QR)
  3. `supabase/user_profiles_migration.sql` (ยอดเงินคงเหลือ และคะแนนสะสม)

### 3. Environment

คัดลอก `.env.example` เป็น `.env.local` แล้วใส่ค่า:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (Settings → API)

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

ถ้าไม่ใส่ `NEXT_PUBLIC_*` ตอน build เคย error `supabaseUrl is required` — โค้ดล่าสุดใช้ placeholder ให้ build ผ่านได้ แต่**แอปจะใช้งาน Supabase ไม่ได้จนกว่าจะใส่ค่าจริงแล้ว build ใหม่**

**ทดสอบ Postman หลัง deploy:** ใช้ **POST** + **Body → raw → JSON** + Header `Content-Type: application/json`  
- Webhook: `https://<โดเมน>/api/webhook/vending`  
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

## โครงสร้างโฟลเดอร์

```
doll-vending/
├── app/
│   ├── api/vending/validate/   # API ให้ตู้กดยืนยัน user
│   ├── api/webhook/vending/    # Webhook รับการซื้อจากตู้
│   ├── menu/                   # หน้าเมนูหลัก (ยอดเงิน, เมนู, log out)
│   ├── menu/topup/             # เติมเงิน
│   ├── menu/history/           # ประวัติการใช้งาน
│   ├── login/                  # หน้าเข้าสู่ระบบ
│   ├── vending/                # หน้าสแกน QR (นับถอยหลัง, สำเร็จ/ล้มเหลว แล้วกลับเมนู)
│   ├── layout.tsx
│   ├── page.tsx                # redirect ไป login หรือ menu
│   └── globals.css
├── lib/
│   ├── supabase.ts             # client (browser)
│   ├── supabase-server.ts      # server (API, ใช้ service role)
│   └── types.ts
├── supabase/
│   ├── vending_migrations.sql
│   ├── vending_qr_tokens_migration.sql
│   └── user_profiles_migration.sql
├── .env.example
└── package.json
```
