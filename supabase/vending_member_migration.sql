-- ตารางสมาชิก (บันทึกหลัง sign up)
-- รันใน Supabase → SQL Editor

create table if not exists public.vending_member (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  credit numeric not null default 0,
  point integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.vending_member enable row level security;

-- ให้ user แทรก/อัปเดตเฉพาะแถวของตัวเอง (ใช้ตอน sign up และอัปเดต email)
create policy "Users can insert own row"
  on public.vending_member for insert
  with check (auth.uid() = id);

create policy "Users can update own row"
  on public.vending_member for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Users can read own row"
  on public.vending_member for select
  using (auth.uid() = id);
