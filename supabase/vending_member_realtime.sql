-- เปิด Realtime ให้ตาราง vending_member (ยอดเงิน/คะแนนอัปเดตแบบ realtime บนหน้าเมนู)
-- รันใน Supabase → SQL Editor

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'vending_member'
  ) then
    alter publication supabase_realtime add table public.vending_member;
  end if;
end $$;
