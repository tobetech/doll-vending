-- ออเดอร์เติมเงินผ่าน Ksher (PromptPay C-scan-B)
-- รันใน Supabase SQL Editor หลัง user_profiles / vending_member

create table if not exists public.ksher_topup_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  merchant_order_id text not null unique,
  amount_baht numeric(12, 2) not null,
  amount_ksher integer not null,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'failed', 'cancelled')),
  ksher_instance text,
  create_response jsonb,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists idx_ksher_topup_orders_user_id
  on public.ksher_topup_orders(user_id);
create index if not exists idx_ksher_topup_orders_created
  on public.ksher_topup_orders(created_at desc);
create index if not exists idx_ksher_topup_orders_instance
  on public.ksher_topup_orders(ksher_instance)
  where ksher_instance is not null;

alter table public.ksher_topup_orders enable row level security;

drop policy if exists "Users read own ksher topup orders"
  on public.ksher_topup_orders;
create policy "Users read own ksher topup orders"
  on public.ksher_topup_orders for select
  using (auth.uid() = user_id);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'ksher_topup_orders'
  ) then
    alter publication supabase_realtime add table public.ksher_topup_orders;
  end if;
end $$;
