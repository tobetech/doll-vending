-- โทเค็น QR เติมเงินผ่านตู้เติมเงิน
-- Flow: แอปสร้าง token (pending) → ตู้สแกน QR → validate ล็อก token (locked) → ลูกค้าใส่จำนวนเงิน → webhook สำเร็จ (completed + เพิ่ม credit)
-- รันใน Supabase → SQL Editor

create table if not exists public.vending_topup_token (
  token uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending', 'locked', 'completed')),
  amount numeric,
  machine_id text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.vending_topup_token enable row level security;

-- API (service role) เขียนได้ทุกอย่าง; ผู้ใช้ล็อกอินอ่านได้เฉพาะแถวของตัวเอง (สำหรับ Realtime/poll)
drop policy if exists "No anon topup token" on public.vending_topup_token;
drop policy if exists "Users read own topup tokens" on public.vending_topup_token;

create policy "No anon topup token"
  on public.vending_topup_token for all
  using (false)
  with check (false);

create policy "Users read own topup tokens"
  on public.vending_topup_token for select
  using (auth.uid() = user_id);

create index if not exists idx_vending_topup_token_user_id
  on public.vending_topup_token(user_id);
create index if not exists idx_vending_topup_token_expires_at
  on public.vending_topup_token(expires_at);

-- Realtime (แอปหน้าเติมเงิน subscribe อัปเดตเมื่อ completed)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'vending_topup_token'
  ) then
    alter publication supabase_realtime add table public.vending_topup_token;
  end if;
end $$;
