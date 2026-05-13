-- ═══════════════════════════════════════════════════════════
-- TREVIS PRODUCTION DATABASE SCHEMA
-- Run this entire file in your Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────
-- 1. PROPERTIES
-- ─────────────────────────────────────────────
create table if not exists properties (
  id           uuid primary key default gen_random_uuid(),
  name         text not null unique,
  location     text,
  color_accent text,
  created_at   timestamptz default now()
);

-- ─────────────────────────────────────────────
-- 2. ROOMS
-- ─────────────────────────────────────────────
create table if not exists rooms (
  id           uuid primary key default gen_random_uuid(),
  property_id  uuid references properties(id) on delete cascade,
  room_number  text not null,
  bed_capacity integer not null,
  rent_per_bed numeric(10,2) not null,
  notes        text,
  created_at   timestamptz default now(),
  unique(property_id, room_number)
);

-- ─────────────────────────────────────────────
-- 3. STUDENTS
-- ─────────────────────────────────────────────
create table if not exists students (
  id                     uuid primary key default gen_random_uuid(),
  full_name              text not null,
  phone                  text,
  national_id            text,
  emergency_contact_name text,
  emergency_contact_phone text,
  room_id                uuid references rooms(id) on delete set null,
  check_in_date          date,
  check_out_date         date,
  payment_plan           text default 'Monthly',
  status                 text default 'ACTIVE'
    check (status in ('ACTIVE','VACATED','SUSPENDED')),
  notes                  text,
  data_flags             text,  -- pipe-separated flag descriptions for Data Quality view
  created_at             timestamptz default now(),
  created_by             uuid references auth.users(id)
);

-- ─────────────────────────────────────────────
-- 4. PAYMENTS
-- ─────────────────────────────────────────────
create table if not exists payments (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid references students(id) on delete cascade,
  amount         numeric(10,2) not null,
  payment_date   date not null,
  payment_method text default 'Cash'
    check (payment_method in ('Cash','EcoCash','Bank Transfer','Zipit','Swipe')),
  receipt_number text,
  month_year     text not null,  -- derived: 'YYYY-MM' format
  notes          text,
  recorded_by    uuid references auth.users(id),
  created_at     timestamptz default now()
);

-- ─────────────────────────────────────────────
-- 5. MONTHLY OBLIGATIONS
-- ─────────────────────────────────────────────
create table if not exists monthly_obligations (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid references students(id) on delete cascade,
  month       date not null,  -- always first of month: '2026-05-01'
  amount_due  numeric(10,2) not null,
  amount_paid numeric(10,2) default 0,
  balance     numeric(10,2) generated always as (amount_due - amount_paid) stored,
  status      text default 'OVERDUE'
    check (status in ('PAID','PARTIAL','OVERDUE')),
  due_date    date,
  updated_at  timestamptz default now(),
  unique(student_id, month)
);

-- ─────────────────────────────────────────────
-- 6. PROFILES (linked to auth.users)
-- ─────────────────────────────────────────────
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text,
  role        text default 'MANAGER'
    check (role in ('ADMIN','MANAGER')),
  property_id uuid references properties(id),
  created_at  timestamptz default now()
);

-- ═══════════════════════════════════════════════════════════
-- TRIGGERS
-- ═══════════════════════════════════════════════════════════

-- Trigger function: update monthly_obligation when a payment is recorded
create or replace function update_monthly_obligation()
returns trigger as $$
declare
  v_student_id uuid;
  v_month      date;
  v_amount_due numeric(10,2);
  v_total_paid numeric(10,2);
  v_new_status text;
begin
  v_student_id := NEW.student_id;
  -- Derive the first of month from payment month_year (stored as 'YYYY-MM')
  v_month := to_date(NEW.month_year || '-01', 'YYYY-MM-DD');

  -- Sum all payments for this student in this month
  select coalesce(sum(amount), 0)
    into v_total_paid
    from payments
   where student_id = v_student_id
     and month_year = NEW.month_year;

  -- Get amount_due from the obligation record
  select amount_due into v_amount_due
    from monthly_obligations
   where student_id = v_student_id
     and month = v_month;

  -- If no obligation record exists yet, create one
  if v_amount_due is null then
    -- Get rent from student's room
    select r.rent_per_bed into v_amount_due
      from students s
      join rooms r on r.id = s.room_id
     where s.id = v_student_id;

    v_amount_due := coalesce(v_amount_due, 0);

    insert into monthly_obligations (student_id, month, amount_due, amount_paid, status, due_date)
    values (v_student_id, v_month, v_amount_due, v_total_paid,
            case when v_total_paid >= v_amount_due then 'PAID'
                 when v_total_paid > 0 then 'PARTIAL'
                 else 'OVERDUE' end,
            v_month);
    return NEW;
  end if;

  -- Determine new status
  if v_total_paid >= v_amount_due then
    v_new_status := 'PAID';
  elsif v_total_paid > 0 then
    v_new_status := 'PARTIAL';
  else
    v_new_status := 'OVERDUE';
  end if;

  -- Update the obligation record
  update monthly_obligations
     set amount_paid = v_total_paid,
         status      = v_new_status,
         updated_at  = now()
   where student_id = v_student_id
     and month = v_month;

  return NEW;
end;
$$ language plpgsql security definer;

-- Attach trigger to payments table
drop trigger if exists trg_update_obligation on payments;
create trigger trg_update_obligation
  after insert or update on payments
  for each row execute function update_monthly_obligation();

-- Trigger function: create obligation for new student (current month)
create or replace function create_obligation_for_new_student()
returns trigger as $$
declare
  v_month      date;
  v_amount_due numeric(10,2);
begin
  v_month := date_trunc('month', current_date)::date;

  -- Get rent from room
  select r.rent_per_bed into v_amount_due
    from rooms r
   where r.id = NEW.room_id;

  if v_amount_due is not null then
    insert into monthly_obligations (student_id, month, amount_due, amount_paid, status, due_date)
    values (NEW.id, v_month, v_amount_due, 0, 'OVERDUE', v_month)
    on conflict (student_id, month) do nothing;
  end if;

  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_new_student_obligation on students;
create trigger trg_new_student_obligation
  after insert on students
  for each row execute function create_obligation_for_new_student();

-- Trigger function: auto-create profile on new user signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, email, role)
  values (NEW.id, NEW.email, 'MANAGER')
  on conflict (id) do nothing;
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_new_user_profile on auth.users;
create trigger trg_new_user_profile
  after insert on auth.users
  for each row execute function handle_new_user();

-- ═══════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════

alter table properties          enable row level security;
alter table rooms               enable row level security;
alter table students            enable row level security;
alter table payments            enable row level security;
alter table monthly_obligations enable row level security;
alter table profiles            enable row level security;

-- Helper function: check if current user is admin
create or replace function is_admin()
returns boolean as $$
  select exists (
    select 1 from profiles
     where id = auth.uid()
       and role = 'ADMIN'
  );
$$ language sql security definer stable;

-- Helper function: get current user's assigned property_id
create or replace function my_property_id()
returns uuid as $$
  select property_id from profiles where id = auth.uid();
$$ language sql security definer stable;

-- ── PROPERTIES ──
create policy "Admin full access to properties" on properties
  for all using (is_admin());

create policy "Manager can read own property" on properties
  for select using (
    is_admin() or id = my_property_id()
  );

-- ── ROOMS ──
create policy "Admin full access to rooms" on rooms
  for all using (is_admin());

create policy "Manager can read own property rooms" on rooms
  for select using (
    is_admin() or property_id = my_property_id()
  );

-- ── STUDENTS ──
create policy "Admin full access to students" on students
  for all using (is_admin());

create policy "Manager can read students in own property" on students
  for select using (
    is_admin() or
    room_id in (
      select id from rooms where property_id = my_property_id()
    )
  );

-- ── PAYMENTS ──
create policy "Admin full access to payments" on payments
  for all using (is_admin());

create policy "Manager can read payments in own property" on payments
  for select using (
    is_admin() or
    student_id in (
      select s.id from students s
      join rooms r on r.id = s.room_id
      where r.property_id = my_property_id()
    )
  );

create policy "Manager can insert payments" on payments
  for insert with check (
    is_admin() or
    student_id in (
      select s.id from students s
      join rooms r on r.id = s.room_id
      where r.property_id = my_property_id()
    )
  );

-- ── MONTHLY OBLIGATIONS ──
create policy "Admin full access to obligations" on monthly_obligations
  for all using (is_admin());

create policy "Manager can read own property obligations" on monthly_obligations
  for select using (
    is_admin() or
    student_id in (
      select s.id from students s
      join rooms r on r.id = s.room_id
      where r.property_id = my_property_id()
    )
  );

-- ── PROFILES ──
create policy "Users can read own profile" on profiles
  for select using (id = auth.uid() or is_admin());

create policy "Admin can manage all profiles" on profiles
  for all using (is_admin());

-- ═══════════════════════════════════════════════════════════
-- USEFUL VIEWS
-- ═══════════════════════════════════════════════════════════

-- Dashboard summary view: current month collection by property
create or replace view v_property_summary as
select
  p.id           as property_id,
  p.name         as property_name,
  p.color_accent,
  count(distinct r.id)                                            as room_count,
  count(distinct s.id) filter (where s.status = 'ACTIVE')        as active_students,
  coalesce(sum(mo.amount_due), 0)                                 as expected,
  coalesce(sum(mo.amount_paid), 0)                                as collected,
  coalesce(sum(mo.amount_due - mo.amount_paid), 0)                as arrears,
  count(*) filter (where mo.status = 'OVERDUE' and s.status = 'ACTIVE') as overdue_count
from properties p
left join rooms r on r.property_id = p.id
left join students s on s.room_id = r.id and s.status = 'ACTIVE'
left join monthly_obligations mo
  on mo.student_id = s.id
  and mo.month = date_trunc('month', current_date)::date
group by p.id, p.name, p.color_accent;
