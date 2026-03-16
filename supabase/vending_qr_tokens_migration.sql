-- โทเค็นสำหรับ Dynamic QR (ใช้ครั้งเดียว, หมดอายุใน 3 นาที)
-- รันใน Supabase SQL Editor หลัง vending_migrations.sql

create table if not exists public.vending_qr_tokens (
  token uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

-- เฉพาะ API ที่ใช้ service role จะอ่าน/เขียนตารางนี้ (ไม่เปิด RLS ให้ anon)
alter table public.vending_qr_tokens enable row level security;

-- ป้องกัน anon อ่าน/เขียน (API ใช้ service role ซึ่ง bypass RLS)
create policy "No anon access"
  on public.vending_qr_tokens for all
  using (false)
  with check (false);

create index if not exists idx_vending_qr_tokens_expires_at
  on public.vending_qr_tokens(expires_at);
create index if not exists idx_vending_qr_tokens_user_id
  on public.vending_qr_tokens(user_id);
