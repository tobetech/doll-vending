-- เพิ่มสถานะ scan_timeout สำหรับแจ้งแอปเมื่อตู้หมดเวลารอสแกน QR (ESP32 → POST /api/webhook/vending-topup-scan-timeout)
-- รันใน Supabase SQL Editor หลัง vending_topup_token_migration.sql

alter table public.vending_topup_token
  drop constraint if exists vending_topup_token_status_check;

alter table public.vending_topup_token
  add constraint vending_topup_token_status_check
  check (status in ('pending', 'locked', 'completed', 'scan_timeout'));
