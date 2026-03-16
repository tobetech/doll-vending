-- เพิ่มคอลัมน์ credit (ยอดเงิน) และ point (คะแนน) ใน vending_member
-- รันใน Supabase → SQL Editor

alter table public.vending_member
  add column if not exists credit numeric not null default 0,
  add column if not exists point integer not null default 0;
