# Supabase migrations

รัน SQL ใน **Supabase Dashboard → SQL Editor** (วางโค้ดแล้วกด Run)

## สร้างตารางสำหรับ Webhook / ประวัติ

**ถ้า error แบบ "could not find the table"** แปลว่าตารางยังไม่มี ให้รันไฟล์นี้ก่อน:

- **`00_setup_vending.sql`** — สร้างตาราง `vending_transactions` + RLS + Realtime (รันครั้งเดียวพอ)

หลังรันแล้ว ปุ่ม "จำลอง Webhook" และ API webhook จะทำงานได้

## ตารางอื่น (ถ้าใช้)

- **`vending_member_migration.sql`** — ตารางสมาชิก (id, email, credit, point) บันทึกหลัง sign up
- **`vending_member_credit_point.sql`** — เพิ่มคอลัมน์ credit, point (รันถ้าสร้างตารางไปก่อนแล้ว)
- **`vending_member_realtime.sql`** — เปิด Realtime ให้ vending_member (ยอดเงิน/คะแนนอัปเดตแบบ realtime)
- `vending_qr_tokens_migration.sql` — ตาราง token สำหรับ Dynamic QR
- `user_profiles_migration.sql` — โปรไฟล์ user (ถ้ามีใช้)
