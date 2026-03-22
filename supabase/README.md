# Supabase migrations

รัน SQL ใน **Supabase Dashboard → SQL Editor** (วางโค้ดแล้วกด Run)

## สร้างตารางสำหรับ Webhook / ประวัติ

**ถ้า error แบบ "could not find the table"** แปลว่าตารางยังไม่มี ให้รันไฟล์นี้ก่อน:

- **`00_setup_vending.sql`** — สร้างตาราง `vending_transactions` + RLS + Realtime (รันครั้งเดียวพอ)

หลังรันแล้ว ปุ่ม "จำลอง Webhook" และ API webhook จะทำงานได้

**ถ้า webhook / Postman error:** `Could not find the 'credit_after' column`  
→ รัน **`vending_transactions_credit_after.sql`** แล้วรอสักครู่ (หรือ Redeploy แอป) ให้ schema cache อัปเดต — API ฝั่งแอปจะ retry แบบไม่ใส่ `credit_after` ชั่วคราวได้ แต่ควรรัน SQL ให้ครบเพื่อประวัติและหน้าสแกน QR

## ตารางอื่น (ถ้าใช้)

- **`vending_member_migration.sql`** — ตารางสมาชิก (id, email, credit, point) บันทึกหลัง sign up
- **`vending_member_user_profile.sql`** — เพิ่มคอลัมน์ `user_name`, `tel_no` สำหรับแก้ไขในหน้าโปรไฟล์
- **`vending_topup_token_migration.sql`** — ตาราง `vending_topup_token` + Realtime สำหรับ QR เติมเงินที่ตู้
- **`vending_transactions_credit_after.sql`** — คอลัมน์ `credit_after` ใน `vending_transactions` (ยอดหลังรายการ = newCredit จาก webhook) สำหรับอัปเดตยอดบนเมนู
- **`vending_member_credit_point.sql`** — เพิ่มคอลัมน์ credit, point (รันถ้าสร้างตารางไปก่อนแล้ว)
- **`vending_member_realtime.sql`** — เปิด Realtime ให้ vending_member (ยอดเงิน/คะแนนอัปเดตแบบ realtime)
- `vending_qr_tokens_migration.sql` — ตาราง token สำหรับ Dynamic QR
- `user_profiles_migration.sql` — โปรไฟล์ user (ถ้ามีใช้)
