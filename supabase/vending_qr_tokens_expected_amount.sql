-- ยอดสั่งซื้อล็อกกับ QR token (ชิ้นละ 10 บาท — ส่งจากแอปตอนสร้าง token)
-- รันใน Supabase SQL Editor หลัง vending_qr_tokens_migration.sql

alter table public.vending_qr_tokens
  add column if not exists expected_amount numeric(12, 2);

comment on column public.vending_qr_tokens.expected_amount is
  'ยอดเงินรวม (บาท) ที่ลูกค้าเลือกตอนสร้าง QR; ตู้ต้องส่ง amount ตรงกันตอน validate; NULL = token แบบเดิมก่อน migration';
