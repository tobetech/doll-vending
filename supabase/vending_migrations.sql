-- ตารางสำหรับบันทึกการซื้อจากตู้กด (รับจาก webhook)
-- รันใน Supabase SQL Editor

create table if not exists public.vending_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  machine_id text not null,
  product_id text,
  product_name text,
  amount numeric not null default 0,
  status text not null default 'success' check (status in ('success', 'failed', 'pending')),
  created_at timestamptz not null default now(),
  webhook_received_at timestamptz default now()
);

alter table public.vending_transactions enable row level security;

create policy "Users can read own vending transactions"
  on public.vending_transactions for select
  using (auth.uid() = user_id);

create index if not exists idx_vending_transactions_user_id
  on public.vending_transactions(user_id);
create index if not exists idx_vending_transactions_created_at
  on public.vending_transactions(created_at desc);
