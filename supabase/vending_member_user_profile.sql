-- เพิ่มชื่อผู้ใช้และเบอร์โทรใน vending_member (หน้าแก้ไขข้อมูลส่วนตัว)
-- รันใน Supabase → SQL Editor

alter table public.vending_member
  add column if not exists user_name text not null default '',
  add column if not exists tel_no text not null default '';

comment on column public.vending_member.user_name is 'ชื่อที่แสดง / ชื่อผู้ใช้';
comment on column public.vending_member.tel_no is 'หมายเลขโทรศัพท์';
