-- ยอดเงินคงเหลือ และคะแนนสะสม (สำหรับเมนู และเติมเงิน)
-- รันใน Supabase SQL Editor

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance numeric not null default 0,
  points int not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

create policy "Users can read own profile"
  on public.user_profiles for select
  using (auth.uid() = user_id);

create policy "Users can update own profile"
  on public.user_profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can insert own profile"
  on public.user_profiles for insert
  with check (auth.uid() = user_id);
