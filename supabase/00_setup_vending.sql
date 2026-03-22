-- ============================================================
-- รันไฟล์นี้ใน Supabase → SQL Editor → New query → วางแล้ว Run
-- จะสร้างตาราง vending_transactions + นโยบาย RLS + Realtime
-- ============================================================

-- 1) สร้างตาราง
create table if not exists public.vending_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  machine_id text not null,
  product_id text,
  product_name text,
  amount numeric not null default 0,
  credit_after numeric,
  status text not null default 'success' check (status in ('success', 'failed', 'pending')),
  created_at timestamptz not null default now(),
  webhook_received_at timestamptz default now()
);

-- 2) เปิด RLS + policy ให้ user อ่านเฉพาะรายการของตัวเอง
alter table public.vending_transactions enable row level security;

drop policy if exists "Users can read own vending transactions" on public.vending_transactions;
create policy "Users can read own vending transactions"
  on public.vending_transactions for select
  using (auth.uid() = user_id);

-- 3) Index
create index if not exists idx_vending_transactions_user_id
  on public.vending_transactions(user_id);
create index if not exists idx_vending_transactions_created_at
  on public.vending_transactions(created_at desc);

-- 4) เปิด Realtime (แอปจะรับ INSERT จาก webhook ทันที)
-- ถ้ารันแล้ว error ว่า table already in publication ให้ข้ามขั้นนี้ได้
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'vending_transactions'
  ) then
    alter publication supabase_realtime add table public.vending_transactions;
  end if;
end $$;
