create extension if not exists pgcrypto;

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  booking_code text unique not null,
  full_name text not null check (char_length(trim(full_name)) between 2 and 120),
  phone text not null check (phone ~ '^[0-9]{9,10}$'),
  service text not null check (service in ('practice','theory','renew')),
  booking_date date not null,
  time_slot text not null default '07:00 – สิ้นสุดการเรียน' check (time_slot = '07:00 – สิ้นสุดการเรียน'),
  queue_number integer not null check (queue_number between 1 and 10),
  status text not null default 'รอเรียกคิว' check (status in ('รอเรียกคิว','กำลังดำเนินการ','เสร็จสิ้น')),
  created_at timestamptz not null default now(),
  unique (booking_date, service, queue_number)
);

create index if not exists bookings_lookup_idx on public.bookings (booking_code, phone);
create index if not exists bookings_day_service_idx on public.bookings (booking_date, service);
alter table public.bookings enable row level security;

drop policy if exists bookings_insert_public on public.bookings;
create policy bookings_insert_public on public.bookings for insert to anon, authenticated with check (true);
revoke select on table public.bookings from anon, authenticated;

update public.bookings set time_slot = '07:00 – สิ้นสุดการเรียน' where time_slot <> '07:00 – สิ้นสุดการเรียน';
alter table public.bookings alter column time_slot set default '07:00 – สิ้นสุดการเรียน';
alter table public.bookings drop constraint if exists bookings_time_slot_check;
alter table public.bookings add constraint bookings_time_slot_check check (time_slot = '07:00 – สิ้นสุดการเรียน');

create or replace function public.create_booking(p_full_name text, p_phone text, p_service text, p_booking_date date, p_time_slot text)
returns public.bookings language plpgsql security definer set search_path = public
as $$
declare v_day integer; v_queue integer; v_booking public.bookings;
begin
  v_day := extract(dow from p_booking_date);
  if p_service = 'practice' and v_day = 0 then raise exception 'บริการภาคปฏิบัติเปิดวันจันทร์ถึงเสาร์'; end if;
  if p_service = 'theory' and v_day <> 0 then raise exception 'บริการภาคทฤษฎีเปิดเฉพาะวันอาทิตย์'; end if;
  if p_service not in ('practice','theory','renew') then raise exception 'ไม่พบบริการที่เลือก'; end if;
  select coalesce(max(queue_number), 0) + 1 into v_queue from public.bookings where booking_date = p_booking_date and service = p_service;
  if v_queue > 10 then raise exception 'คิวของบริการนี้เต็มแล้ว'; end if;
  insert into public.bookings (booking_code, full_name, phone, service, booking_date, time_slot, queue_number)
  values ('RDS-' || upper(substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 6)), trim(p_full_name), p_phone, p_service, p_booking_date, '07:00 – สิ้นสุดการเรียน', v_queue)
  returning * into v_booking;
  return v_booking;
end;
$$;

create or replace function public.find_booking(p_booking_code text, p_phone text)
returns setof public.bookings language sql security definer set search_path = public
as $$ select * from public.bookings where booking_code = upper(trim(p_booking_code)) and phone = p_phone limit 1 $$;

create or replace function public.list_day_bookings(p_service text, p_booking_date date)
returns setof public.bookings language sql security definer set search_path = public
as $$ select * from public.bookings where service = p_service and booking_date = p_booking_date order by queue_number $$;

create or replace function public.get_today_queue_count(p_booking_date date)
returns integer language sql security definer set search_path = public
as $$ select count(*)::integer from public.bookings where booking_date = p_booking_date and status = 'รอเรียกคิว' $$;

grant execute on function public.create_booking(text,text,text,date,text) to anon, authenticated;
grant execute on function public.find_booking(text,text) to anon, authenticated;
grant execute on function public.list_day_bookings(text,date) to anon, authenticated;
grant execute on function public.get_today_queue_count(date) to anon, authenticated;
