-- เปิด Realtime ให้ตาราง vending_transactions (แอปจะรับ INSERT จาก webhook ทันที)
-- รันใน Supabase SQL Editor หลังสร้างตารางแล้ว
-- ถ้าตารางอยู่ใน publication แล้ว จะไม่ทำซ้ำ (ไม่ error)

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'vending_transactions'
  ) then
    alter publication supabase_realtime add table public.vending_transactions;
  end if;
end $$;
