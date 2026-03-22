-- ยอดเงินคงเหลือหลังรายการ (เท่ากับ newCredit ใน webhook response)
-- แอปเมนูอ่านจาก INSERT Realtime แล้วอัปเดต "ยอดเงินคงเหลือ"
-- รันใน Supabase → SQL Editor

alter table public.vending_transactions
  add column if not exists credit_after numeric;

comment on column public.vending_transactions.credit_after is 'ยอด credit หลังรายการ (newCredit จาก webhook)';
