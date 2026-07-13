-- ═══════════════════════════════════════════════════════════
-- PropNest — FULL SETUP (idempotent; safe to re-run)
-- schema -> seed -> seed_part2 -> seed_payments -> R3 -> R6 -> R7 -> R8
-- ═══════════════════════════════════════════════════════════


-- ▼▼▼ schema.sql ▼▼▼
-- ═══════════════════════════════════════════════════════════
-- PropNest DATABASE SCHEMA
-- Run this entire file in your Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- Self-heal: the signup trigger lives on auth.users (auth schema), so a prior
-- `drop schema public cascade` can leave it orphaned, pointing at a profiles
-- table that no longer exists — which then blocks ALL new-user creation.
-- Drop it up front; it is recreated (hardened) further down this file.
drop trigger if exists trg_new_user_profile on auth.users;
drop function if exists handle_new_user() cascade;

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
  -- ── Coverage engine: DERIVED CACHE of (payments + room rent). ──
  -- Written ONLY by the JS engine (rebuildStudentCoverage); never hand-authored.
  -- Nullable: a student with no payment yet has no coverage.
  coverage_start         date,
  coverage_end           date,
  daily_rate             numeric(8,2),
  next_due_date          date,
  billing_anchor_date    date,
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
    -- Superset: keeps the original Zimbabwe methods (EcoCash/Zipit/Swipe) so a
    -- port onto Trevis's live data never rejects an existing payment, plus the
    -- generic methods the new UI offers. Widen here (additive) rather than swap.
    check (payment_method in ('Cash','EcoCash','Bank Transfer','Zipit','Swipe','Mobile Money','Card')),
  receipt_number text,
  month_year     text not null,  -- derived: 'YYYY-MM' format
  notes          text,
  -- ── Per-payment coverage slice (what this payment bought). Derived cache. ──
  coverage_start_date date,
  coverage_end_date   date,
  days_covered        integer,
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
-- 5b. STUDENT TRANSFERS (audit trail of room changes)
-- ─────────────────────────────────────────────
create table if not exists student_transfers (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references students(id) on delete cascade,
  from_room_id  uuid not null references rooms(id),
  to_room_id    uuid not null references rooms(id),
  transfer_date date not null default current_date,
  reason        text,
  performed_by  uuid references auth.users(id),
  created_at    timestamptz default now(),
  constraint different_rooms check (from_room_id != to_room_id)
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
-- SECURITY DEFINER + pinned search_path so it resolves `profiles` correctly and
-- runs with the function owner's rights during auth.users insert (Supabase signup).
-- EXCEPTION guard: a failure here must NOT block user creation in auth.users.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (NEW.id, NEW.email, 'MANAGER')
  on conflict (id) do nothing;
  return NEW;
exception
  when others then
    -- Never break signup; profile can be created/repaired later.
    raise warning 'handle_new_user failed for %: %', NEW.id, SQLERRM;
    return NEW;
end;
$$;

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
alter table student_transfers   enable row level security;
alter table profiles            enable row level security;

-- Helper function: check if current user is admin
-- SECURITY DEFINER + search_path so its read of `profiles` bypasses RLS (the
-- definer owns the table and is not FORCE-RLS), preventing policy recursion.
create or replace function is_admin()
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from profiles
     where id = auth.uid()
       and role = 'ADMIN'
  );
$$;

-- Helper function: get current user's assigned property_id
create or replace function my_property_id()
returns uuid
language sql security definer stable
set search_path = public
as $$
  select property_id from profiles where id = auth.uid();
$$;

-- RPC: the app reads the signed-in user's profile through this (authService.js).
-- SECURITY DEFINER so it bypasses the profiles RLS policy entirely — this is the
-- canonical, recursion-free way to load role/property for the current user.
create or replace function get_my_profile()
returns table (id uuid, email text, full_name text, role text, property_id uuid)
language sql security definer stable
set search_path = public
as $$
  select p.id, p.email, p.full_name, p.role, p.property_id
  from profiles p
  where p.id = auth.uid();
$$;

grant execute on function is_admin()        to authenticated, anon;
grant execute on function my_property_id()   to authenticated, anon;
grant execute on function get_my_profile()   to authenticated, anon;

-- ── PROPERTIES ──
drop policy if exists "Admin full access to properties" on properties;
create policy "Admin full access to properties" on properties
  for all using (is_admin());

drop policy if exists "Manager can read own property" on properties;
create policy "Manager can read own property" on properties
  for select using (
    is_admin() or id = my_property_id()
  );

-- ── ROOMS ──
drop policy if exists "Admin full access to rooms" on rooms;
create policy "Admin full access to rooms" on rooms
  for all using (is_admin());

drop policy if exists "Manager can read own property rooms" on rooms;
create policy "Manager can read own property rooms" on rooms
  for select using (
    is_admin() or property_id = my_property_id()
  );

-- ── STUDENTS ──
drop policy if exists "Admin full access to students" on students;
create policy "Admin full access to students" on students
  for all using (is_admin());

drop policy if exists "Manager can read students in own property" on students;
create policy "Manager can read students in own property" on students
  for select using (
    is_admin() or
    room_id in (
      select id from rooms where property_id = my_property_id()
    )
  );

-- ── PAYMENTS ──
drop policy if exists "Admin full access to payments" on payments;
create policy "Admin full access to payments" on payments
  for all using (is_admin());

drop policy if exists "Manager can read payments in own property" on payments;
create policy "Manager can read payments in own property" on payments
  for select using (
    is_admin() or
    student_id in (
      select s.id from students s
      join rooms r on r.id = s.room_id
      where r.property_id = my_property_id()
    )
  );

drop policy if exists "Manager can insert payments" on payments;
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
drop policy if exists "Admin full access to obligations" on monthly_obligations;
create policy "Admin full access to obligations" on monthly_obligations
  for all using (is_admin());

drop policy if exists "Manager can read own property obligations" on monthly_obligations;
create policy "Manager can read own property obligations" on monthly_obligations
  for select using (
    is_admin() or
    student_id in (
      select s.id from students s
      join rooms r on r.id = s.room_id
      where r.property_id = my_property_id()
    )
  );

-- ── STUDENT TRANSFERS ──
drop policy if exists "Admin full access to transfers" on student_transfers;
create policy "Admin full access to transfers" on student_transfers
  for all using (is_admin());

drop policy if exists "Manager can read own property transfers" on student_transfers;
create policy "Manager can read own property transfers" on student_transfers
  for select using (
    is_admin() or
    student_id in (
      select s.id from students s
      join rooms r on r.id = s.room_id
      where r.property_id = my_property_id()
    )
  );

-- ── PROFILES ──
drop policy if exists "Users can read own profile" on profiles;
create policy "Users can read own profile" on profiles
  for select using (id = auth.uid() or is_admin());

drop policy if exists "Admin can manage all profiles" on profiles;
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

-- ═══════════════════════════════════════════════════════════
-- ROLE GRANTS  (CRITICAL after a `drop schema public cascade`)
-- ═══════════════════════════════════════════════════════════
-- Dropping & recreating the public schema wipes the default privileges Supabase
-- pre-configures, so the anon/authenticated/service_role roles end up with NO
-- table privileges -> "permission denied for table" (403) on every query, before
-- RLS is even consulted. Re-grant table/sequence/function access (RLS still
-- governs which ROWS each user sees) and restore default privileges so future
-- tables are covered too.
grant usage on schema public to anon, authenticated, service_role;

grant all on all tables    in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all functions in schema public to anon, authenticated, service_role;

alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on functions to anon, authenticated, service_role;


-- ▼▼▼ seed.sql ▼▼▼
-- ═══════════════════════════════════════════════════════════
-- DEMO SEED DATA — Portfolio clone (English names)
-- Same UUIDs / rooms / payments as production seed, names anonymized.
-- Run AFTER schema.sql, BEFORE seed_payments.sql.
-- Property names are DEMO placeholders (rename in the UI/settings as you go).
-- ═══════════════════════════════════════════════════════════

-- ── PROPERTIES (demo names) ──
INSERT INTO properties (id, name, location, color_accent) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'Maple Court',    'Riverside', '#22D3EE'),
  ('a1000000-0000-0000-0000-000000000002', 'Oakwood',        'Riverside', '#A78BFA'),
  ('a1000000-0000-0000-0000-000000000003', 'Birchgate',      'Riverside', '#F59E0B'),
  ('a1000000-0000-0000-0000-000000000004', 'Cedar House',    'Riverside', '#FB7185')
ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════
-- MAPLE COURT ROOMS
-- ═══════════════════════════════════════════════════════════
INSERT INTO rooms (id, property_id, room_number, bed_capacity, rent_per_bed, notes) VALUES
  ('b1000000-0001-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001','Room 1',4,110.00,NULL),
  ('b1000000-0001-0000-0000-000000000002','a1000000-0000-0000-0000-000000000001','Room 2',2,150.00,NULL),
  ('b1000000-0001-0000-0000-000000000003','a1000000-0000-0000-0000-000000000001','Room 3',2,130.00,'Over-capacity: 3 students in 2-bed room'),
  ('b1000000-0001-0000-0000-000000000004','a1000000-0000-0000-0000-000000000001','Room 4',2,150.00,NULL),
  ('b1000000-0001-0000-0000-000000000005','a1000000-0000-0000-0000-000000000001','Room 5',2,150.00,NULL),
  ('b1000000-0001-0000-0000-000000000006','a1000000-0000-0000-0000-000000000001','Room 6',2,150.00,NULL),
  ('b1000000-0001-0000-0000-000000000007','a1000000-0000-0000-0000-000000000001','Room 7',2,150.00,NULL),
  ('b1000000-0001-0000-0000-000000000008','a1000000-0000-0000-0000-000000000001','Room 8',3,130.00,NULL),
  ('b1000000-0001-0000-0000-000000000009','a1000000-0000-0000-0000-000000000001','Room 9',4,110.00,NULL),
  ('b1000000-0001-0000-0000-000000000010','a1000000-0000-0000-0000-000000000001','Room 10',4,110.00,NULL),
  ('b1000000-0001-0000-0000-000000000011','a1000000-0000-0000-0000-000000000001','Room 11',1,180.00,NULL),
  ('b1000000-0001-0000-0000-000000000012','a1000000-0000-0000-0000-000000000001','Room 12',3,130.00,NULL),
  ('b1000000-0001-0000-0000-000000000013','a1000000-0000-0000-0000-000000000001','Room 13',3,130.00,NULL),
  ('b1000000-0001-0000-0000-000000000014','a1000000-0000-0000-0000-000000000001','Room 14',2,150.00,NULL),
  ('b1000000-0001-0000-0000-000000000015','a1000000-0000-0000-0000-000000000001','Room 15',2,150.00,NULL),
  ('b1000000-0001-0000-0000-000000000016','a1000000-0000-0000-0000-000000000001','Room 16',2,150.00,NULL),
  ('b1000000-0001-0000-0000-000000000017','a1000000-0000-0000-0000-000000000001','Room 17',2,150.00,NULL),
  ('b1000000-0001-0000-0000-000000000018','a1000000-0000-0000-0000-000000000001','Room 18',5,110.00,NULL),
  ('b1000000-0001-0000-0000-000000000019','a1000000-0000-0000-0000-000000000001','Room 19',1,300.00,NULL),
  ('b1000000-0001-0000-0000-000000000020','a1000000-0000-0000-0000-000000000001','Room 20',1,360.00,NULL),
  ('b1000000-0001-0000-0000-000000000021','a1000000-0000-0000-0000-000000000001','Room 21',1,180.00,NULL)
ON CONFLICT (id) DO NOTHING;

-- ── MAPLE COURT STUDENTS ──
INSERT INTO students (id, full_name, room_id, check_in_date, status, notes, data_flags) VALUES
  -- Room 1
  ('c1000001-0000-0000-0000-000000000001','James Carter','b1000000-0001-0000-0000-000000000001',NULL,'ACTIVE',NULL,NULL),
  ('c1000001-0000-0000-0000-000000000002','Emily Brooks','b1000000-0001-0000-0000-000000000001',NULL,'ACTIVE',NULL,NULL),
  ('c1000001-0000-0000-0000-000000000003','Daniel Okafor','b1000000-0001-0000-0000-000000000001',NULL,'ACTIVE',NULL,NULL),
  ('c1000001-0000-0000-0000-000000000004','Chloe Bennett','b1000000-0001-0000-0000-000000000001',NULL,'ACTIVE',NULL,NULL),
  -- Room 2
  ('c1000001-0000-0000-0000-000000000005','Priya Sharma','b1000000-0001-0000-0000-000000000002',NULL,'ACTIVE',NULL,NULL),
  ('c1000001-0000-0000-0000-000000000006','Megan Lawson','b1000000-0001-0000-0000-000000000002',NULL,'ACTIVE',NULL,NULL),
  -- Room 3 (3 students in 2-bed)
  ('c1000001-0000-0000-0000-000000000007','Grace Adeyemi','b1000000-0001-0000-0000-000000000003',NULL,'ACTIVE',NULL,'OVER_CAPACITY'),
  ('c1000001-0000-0000-0000-000000000008','Hannah Reid','b1000000-0001-0000-0000-000000000003',NULL,'ACTIVE',NULL,'OVER_CAPACITY'),
  ('c1000001-0000-0000-0000-000000000009','Sophia Mensah','b1000000-0001-0000-0000-000000000003',NULL,'ACTIVE',NULL,'OVER_CAPACITY'),
  -- Room 4
  ('c1000001-0000-0000-0000-000000000010','Olivia Walsh','b1000000-0001-0000-0000-000000000004',NULL,'ACTIVE',NULL,NULL),
  ('c1000001-0000-0000-0000-000000000011','Tariq Hassan','b1000000-0001-0000-0000-000000000004',NULL,'ACTIVE','Replaces former tenant Fiona Doyle from Feb',NULL),
  -- Room 5 (2 beds, 2 students)
  ('c1000001-0000-0000-0000-000000000012','Naomi Clarke','b1000000-0001-0000-0000-000000000005',NULL,'ACTIVE',NULL,NULL),
  ('c1000001-0000-0000-0000-000000000013','Maya Fernandez','b1000000-0001-0000-0000-000000000005',NULL,'ACTIVE',NULL,NULL),
  -- Room 6
  ('c1000001-0000-0000-0000-000000000014','Ruby Hayes','b1000000-0001-0000-0000-000000000006','2025-12-30','ACTIVE',NULL,NULL),
  ('c1000001-0000-0000-0000-000000000015','Laura Mitchell','b1000000-0001-0000-0000-000000000006',NULL,'ACTIVE','Moved from Room 5 per correction',NULL),
  -- Room 7 (anonymous payment)
  ('c1000001-0000-0000-0000-000000000016','Vivian Acheampong','b1000000-0001-0000-0000-000000000007',NULL,'ACTIVE',NULL,NULL),
  ('c1000001-0000-0000-0000-000000000017','Unassigned - MC-R7','b1000000-0001-0000-0000-000000000007',NULL,'ACTIVE','Anonymous payment recorded, identity unknown','ANONYMOUS_PLACEHOLDER'),
  -- Room 8 (3 beds)
  ('c1000001-0000-0000-0000-000000000018','Faith Adebayo','b1000000-0001-0000-0000-000000000008',NULL,'ACTIVE',NULL,NULL),
  ('c1000001-0000-0000-0000-000000000019','Isabel Romero','b1000000-0001-0000-0000-000000000008',NULL,'ACTIVE',NULL,NULL),
  ('c1000001-0000-0000-0000-000000000020','Chloe Daniels','b1000000-0001-0000-0000-000000000008',NULL,'ACTIVE',NULL,NULL),
  -- Room 9
  ('c1000001-0000-0000-0000-000000000021','Ashley Turner','b1000000-0001-0000-0000-000000000009',NULL,'ACTIVE',NULL,NULL),
  ('c1000001-0000-0000-0000-000000000022','Patricia Nwosu','b1000000-0001-0000-0000-000000000009',NULL,'ACTIVE',NULL,NULL),
  ('c1000001-0000-0000-0000-000000000023','Olivia Nyathi','b1000000-0001-0000-0000-000000000009',NULL,'ACTIVE','Paid $106 not $110','PARTIAL_UNDERPAYMENT'),
  ('c1000001-0000-0000-0000-000000000024','Tara Mensah','b1000000-0001-0000-0000-000000000009',NULL,'ACTIVE',NULL,NULL),
  -- Room 10
  ('c1000001-0000-0000-0000-000000000025','Simon Phillips','b1000000-0001-0000-0000-000000000010',NULL,'ACTIVE',NULL,NULL),
  ('c1000001-0000-0000-0000-000000000026','Unassigned - MC-R10','b1000000-0001-0000-0000-000000000010',NULL,'ACTIVE','Anonymous $110 payment','ANONYMOUS_PLACEHOLDER'),
  ('c1000001-0000-0000-0000-000000000027','Thandi Sibanda','b1000000-0001-0000-0000-000000000010',NULL,'ACTIVE',NULL,NULL),
  ('c1000001-0000-0000-0000-000000000028','Tessa Goodman','b1000000-0001-0000-0000-000000000010',NULL,'ACTIVE',NULL,NULL),
  -- Room 11 (1 bed)
  ('c1000001-0000-0000-0000-000000000029','Nathan Shaw','b1000000-0001-0000-0000-000000000011',NULL,'ACTIVE',NULL,NULL),
  -- Room 12 (3 beds)
  ('c1000001-0000-0000-0000-000000000030','Sandra Mwale','b1000000-0001-0000-0000-000000000012',NULL,'ACTIVE',NULL,NULL),
  ('c1000001-0000-0000-0000-000000000031','Jade Cooper','b1000000-0001-0000-0000-000000000012',NULL,'ACTIVE',NULL,NULL),
  ('c1000001-0000-0000-0000-000000000032','Unassigned - MC-R12','b1000000-0001-0000-0000-000000000012',NULL,'ACTIVE','Unnamed row with payment','ANONYMOUS_PLACEHOLDER'),
  -- Room 13
  ('c1000001-0000-0000-0000-000000000033','Trevor Banda','b1000000-0001-0000-0000-000000000013',NULL,'ACTIVE',NULL,NULL),
  ('c1000001-0000-0000-0000-000000000034','Rachel Owusu','b1000000-0001-0000-0000-000000000013',NULL,'ACTIVE',NULL,NULL),
  ('c1000001-0000-0000-0000-000000000035','Jennifer Stone','b1000000-0001-0000-0000-000000000013',NULL,'ACTIVE',NULL,NULL),
  -- Room 14
  ('c1000001-0000-0000-0000-000000000036','Faith Caldwell','b1000000-0001-0000-0000-000000000014',NULL,'ACTIVE',NULL,NULL),
  ('c1000001-0000-0000-0000-000000000037','Sasha Petrov','b1000000-0001-0000-0000-000000000014',NULL,'ACTIVE',NULL,NULL),
  -- Room 15
  ('c1000001-0000-0000-0000-000000000038','Teresa Mwangi','b1000000-0001-0000-0000-000000000015',NULL,'ACTIVE','Name corrected from earlier spelling',NULL),
  ('c1000001-0000-0000-0000-000000000039','Johan Kruger','b1000000-0001-0000-0000-000000000015',NULL,'ACTIVE',NULL,NULL),
  -- Room 16
  ('c1000001-0000-0000-0000-000000000040','Tony Mhango','b1000000-0001-0000-0000-000000000016',NULL,'ACTIVE',NULL,NULL),
  ('c1000001-0000-0000-0000-000000000041','Vivian Jenkins','b1000000-0001-0000-0000-000000000016',NULL,'ACTIVE','Replaces former tenant Teresa Mwangi',NULL),
  -- Room 17
  ('c1000001-0000-0000-0000-000000000042','Michaela Kane','b1000000-0001-0000-0000-000000000017',NULL,'ACTIVE',NULL,NULL),
  ('c1000001-0000-0000-0000-000000000043','Felicity Dube','b1000000-0001-0000-0000-000000000017',NULL,'ACTIVE','Moved from Room 4',NULL),
  -- Room 18
  ('c1000001-0000-0000-0000-000000000044','Tendai Moyo','b1000000-0001-0000-0000-000000000018',NULL,'ACTIVE',NULL,NULL),
  ('c1000001-0000-0000-0000-000000000045','Tanya Grant','b1000000-0001-0000-0000-000000000018',NULL,'ACTIVE',NULL,NULL),
  ('c1000001-0000-0000-0000-000000000046','Priscilla Owusu','b1000000-0001-0000-0000-000000000018',NULL,'ACTIVE',NULL,NULL),
  ('c1000001-0000-0000-0000-000000000047','Tasha Kennedy','b1000000-0001-0000-0000-000000000018',NULL,'ACTIVE',NULL,NULL),
  ('c1000001-0000-0000-0000-000000000048','Ivan Petrenko','b1000000-0001-0000-0000-000000000018',NULL,'ACTIVE','Date serial 31 invalid, stored null','INVALID_DATE'),
  -- Room 19
  ('c1000001-0000-0000-0000-000000000049','Pamela West','b1000000-0001-0000-0000-000000000019',NULL,'ACTIVE',NULL,NULL),
  -- Room 20
  ('c1000001-0000-0000-0000-000000000050','Robert Maposa','b1000000-0001-0000-0000-000000000020',NULL,'ACTIVE','Balance $180',NULL),
  -- Room 21
  ('c1000001-0000-0000-0000-000000000051','Kelly Chuma','b1000000-0001-0000-0000-000000000021',NULL,'ACTIVE',NULL,NULL)
ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════
-- OAKWOOD ROOMS
-- ═══════════════════════════════════════════════════════════
INSERT INTO rooms (id, property_id, room_number, bed_capacity, rent_per_bed, notes) VALUES
  ('b1000000-0002-0000-0000-000000000001','a1000000-0000-0000-0000-000000000002','Room 1',1,260.00,NULL),
  ('b1000000-0002-0000-0000-000000000002','a1000000-0000-0000-0000-000000000002','Room 2',2,130.00,NULL),
  ('b1000000-0002-0000-0000-000000000003','a1000000-0000-0000-0000-000000000002','Room 3',3,120.00,NULL),
  ('b1000000-0002-0000-0000-000000000004','a1000000-0000-0000-0000-000000000002','Room 4',2,130.00,NULL),
  ('b1000000-0002-0000-0000-000000000005','a1000000-0000-0000-0000-000000000002','Room 5',3,120.00,NULL),
  ('b1000000-0002-0000-0000-000000000006','a1000000-0000-0000-0000-000000000002','Room 6',4,100.00,NULL),
  ('b1000000-0002-0000-0000-000000000007','a1000000-0000-0000-0000-000000000002','Room 7',2,130.00,NULL),
  ('b1000000-0002-0000-0000-000000000008','a1000000-0000-0000-0000-000000000002','Room 8',2,130.00,NULL),
  ('b1000000-0002-0000-0000-000000000009','a1000000-0000-0000-0000-000000000002','Room 9',2,130.00,NULL),
  ('b1000000-0002-0000-0000-000000000010','a1000000-0000-0000-0000-000000000002','Room 10',2,130.00,NULL),
  ('b1000000-0002-0000-0000-000000000011','a1000000-0000-0000-0000-000000000002','Room 11',3,120.00,NULL),
  ('b1000000-0002-0000-0000-000000000012','a1000000-0000-0000-0000-000000000002','Room 12',3,120.00,NULL),
  ('b1000000-0002-0000-0000-000000000013','a1000000-0000-0000-0000-000000000002','Room 13',1,150.00,NULL)
ON CONFLICT (id) DO NOTHING;

-- ── OAKWOOD STUDENTS ──
INSERT INTO students (id, full_name, room_id, check_in_date, status, notes, data_flags) VALUES
  ('c1000002-0000-0000-0000-000000000001','Mr Thompson','b1000000-0002-0000-0000-000000000001',NULL,'ACTIVE',NULL,NULL),
  ('c1000002-0000-0000-0000-000000000002','Elizabeth Moore','b1000000-0002-0000-0000-000000000002',NULL,'ACTIVE',NULL,NULL),
  ('c1000002-0000-0000-0000-000000000003','Lorraine Chambers','b1000000-0002-0000-0000-000000000002',NULL,'ACTIVE',NULL,NULL),
  ('c1000002-0000-0000-0000-000000000004','Tessa Bell','b1000000-0002-0000-0000-000000000003',NULL,'ACTIVE','Replaces former tenant Lisa Cohen from Feb',NULL),
  ('c1000002-0000-0000-0000-000000000005','Rita Hlatshwayo','b1000000-0002-0000-0000-000000000003',NULL,'ACTIVE',NULL,NULL),
  ('c1000002-0000-0000-0000-000000000006','Ruth Chambers','b1000000-0002-0000-0000-000000000003',NULL,'ACTIVE',NULL,NULL),
  ('c1000002-0000-0000-0000-000000000007','Natasha Cole','b1000000-0002-0000-0000-000000000004',NULL,'ACTIVE',NULL,NULL),
  ('c1000002-0000-0000-0000-000000000008','Chelsea Meyer','b1000000-0002-0000-0000-000000000004',NULL,'ACTIVE',NULL,NULL),
  ('c1000002-0000-0000-0000-000000000009','Rufaro B','b1000000-0002-0000-0000-000000000005',NULL,'ACTIVE',NULL,NULL),
  ('c1000002-0000-0000-0000-000000000010','Kamau Mwangi','b1000000-0002-0000-0000-000000000005',NULL,'ACTIVE',NULL,NULL),
  ('c1000002-0000-0000-0000-000000000011','Talia Shaw','b1000000-0002-0000-0000-000000000005',NULL,'ACTIVE',NULL,NULL),
  ('c1000002-0000-0000-0000-000000000012','Connor Nichols','b1000000-0002-0000-0000-000000000006',NULL,'ACTIVE','New student',NULL),
  ('c1000002-0000-0000-0000-000000000013','Melissa Ward','b1000000-0002-0000-0000-000000000006',NULL,'ACTIVE',NULL,NULL),
  ('c1000002-0000-0000-0000-000000000014','Gavin Chari','b1000000-0002-0000-0000-000000000006',NULL,'ACTIVE',NULL,NULL),
  ('c1000002-0000-0000-0000-000000000015','Ruvarashe Ncube','b1000000-0002-0000-0000-000000000006',NULL,'ACTIVE',NULL,NULL),
  ('c1000002-0000-0000-0000-000000000016','Olivia Chen','b1000000-0002-0000-0000-000000000007',NULL,'ACTIVE',NULL,NULL),
  ('c1000002-0000-0000-0000-000000000017','Charity Mason','b1000000-0002-0000-0000-000000000007',NULL,'ACTIVE',NULL,NULL),
  ('c1000002-0000-0000-0000-000000000018','Nicole Chikwava','b1000000-0002-0000-0000-000000000008',NULL,'ACTIVE',NULL,NULL),
  ('c1000002-0000-0000-0000-000000000019','Trinity Sibanda','b1000000-0002-0000-0000-000000000008',NULL,'ACTIVE',NULL,NULL),
  ('c1000002-0000-0000-0000-000000000020','Ayan Mansoor','b1000000-0002-0000-0000-000000000009',NULL,'ACTIVE',NULL,NULL),
  ('c1000002-0000-0000-0000-000000000021','Amanda Dawson','b1000000-0002-0000-0000-000000000009',NULL,'ACTIVE',NULL,NULL),
  ('c1000002-0000-0000-0000-000000000022','Sharon Rivera','b1000000-0002-0000-0000-000000000010',NULL,'ACTIVE',NULL,NULL),
  ('c1000002-0000-0000-0000-000000000023','Reuben Langa','b1000000-0002-0000-0000-000000000010',NULL,'ACTIVE',NULL,NULL),
  ('c1000002-0000-0000-0000-000000000024','Fiona Khumalo','b1000000-0002-0000-0000-000000000011',NULL,'ACTIVE','New student',NULL),
  ('c1000002-0000-0000-0000-000000000025','Bianca Harris','b1000000-0002-0000-0000-000000000011',NULL,'ACTIVE',NULL,NULL),
  ('c1000002-0000-0000-0000-000000000026','Thando Phiri','b1000000-0002-0000-0000-000000000011',NULL,'ACTIVE',NULL,NULL),
  ('c1000002-0000-0000-0000-000000000027','Natalie Kemp','b1000000-0002-0000-0000-000000000012',NULL,'ACTIVE',NULL,NULL),
  ('c1000002-0000-0000-0000-000000000028','Leona Zhou','b1000000-0002-0000-0000-000000000012',NULL,'ACTIVE',NULL,NULL),
  ('c1000002-0000-0000-0000-000000000029','Natasha Jordan','b1000000-0002-0000-0000-000000000012',NULL,'ACTIVE',NULL,NULL),
  ('c1000002-0000-0000-0000-000000000030','Judith Katsande','b1000000-0002-0000-0000-000000000013',NULL,'ACTIVE',NULL,NULL)
ON CONFLICT (id) DO NOTHING;


-- ▼▼▼ seed_part2.sql ▼▼▼
-- ═══════════════════════════════════════════════════════════
-- DEMO SEED DATA PART 2 — Birchgate & Cedar House (English names)
-- Same UUIDs / rooms / payments as production seed_part2, names anonymized.
-- Run AFTER seed_demo.sql, BEFORE seed_payments.sql.
-- ═══════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════
-- BIRCHGATE ROOMS (no Room 4)
-- ═══════════════════════════════════════════════════════════
INSERT INTO rooms (id, property_id, room_number, bed_capacity, rent_per_bed, notes) VALUES
  ('b1000000-0003-0000-0000-000000000001','a1000000-0000-0000-0000-000000000003','Room 1',3,120.00,NULL),
  ('b1000000-0003-0000-0000-000000000002','a1000000-0000-0000-0000-000000000003','Room 2',4,100.00,NULL),
  ('b1000000-0003-0000-0000-000000000003','a1000000-0000-0000-0000-000000000003','Room 3',1,260.00,NULL),
  ('b1000000-0003-0000-0000-000000000005','a1000000-0000-0000-0000-000000000003','Room 5',2,130.00,NULL),
  ('b1000000-0003-0000-0000-000000000006','a1000000-0000-0000-0000-000000000003','Room 6',2,130.00,NULL),
  ('b1000000-0003-0000-0000-000000000007','a1000000-0000-0000-0000-000000000003','Room 7',2,130.00,NULL),
  ('b1000000-0003-0000-0000-000000000008','a1000000-0000-0000-0000-000000000003','Room 8',2,130.00,NULL),
  ('b1000000-0003-0000-0000-000000000009','a1000000-0000-0000-0000-000000000003','Room 9',3,120.00,NULL),
  ('b1000000-0003-0000-0000-000000000010','a1000000-0000-0000-0000-000000000003','Room 10',3,120.00,NULL),
  ('b1000000-0003-0000-0000-000000000011','a1000000-0000-0000-0000-000000000003','Room 11',3,120.00,NULL),
  ('b1000000-0003-0000-0000-000000000012','a1000000-0000-0000-0000-000000000003','Room 12',3,120.00,NULL),
  ('b1000000-0003-0000-0000-000000000013','a1000000-0000-0000-0000-000000000003','Room 13',2,130.00,NULL),
  ('b1000000-0003-0000-0000-000000000014','a1000000-0000-0000-0000-000000000003','Room 14',3,120.00,NULL),
  ('b1000000-0003-0000-0000-000000000015','a1000000-0000-0000-0000-000000000003','Room 15',2,130.00,NULL),
  ('b1000000-0003-0000-0000-000000000016','a1000000-0000-0000-0000-000000000003','Room 16',3,130.00,NULL),
  ('b1000000-0003-0000-0000-000000000017','a1000000-0000-0000-0000-000000000003','Room 17',3,130.00,'Incomplete: two students with no payment amount'),
  ('b1000000-0003-0000-0000-000000000018','a1000000-0000-0000-0000-000000000003','Room 18',2,150.00,NULL)
ON CONFLICT (id) DO NOTHING;

-- ── BIRCHGATE STUDENTS ──
INSERT INTO students (id, full_name, room_id, check_in_date, status, notes, data_flags) VALUES
  -- Room 1
  ('c1000003-0000-0000-0000-000000000001','Oliver Mthembu','b1000000-0003-0000-0000-000000000001',NULL,'ACTIVE',NULL,NULL),
  ('c1000003-0000-0000-0000-000000000002','William Chase','b1000000-0003-0000-0000-000000000001',NULL,'ACTIVE','4 MONTHS - flag for client clarification','UNCLEAR_NOTE'),
  ('c1000003-0000-0000-0000-000000000003','Dean Carver','b1000000-0003-0000-0000-000000000001',NULL,'ACTIVE',NULL,NULL),
  -- Room 2
  ('c1000003-0000-0000-0000-000000000004','Stanley Moran','b1000000-0003-0000-0000-000000000002',NULL,'ACTIVE',NULL,NULL),
  ('c1000003-0000-0000-0000-000000000005','Naomi Govender','b1000000-0003-0000-0000-000000000002',NULL,'ACTIVE',NULL,NULL),
  ('c1000003-0000-0000-0000-000000000006','Unassigned - BG-R2','b1000000-0003-0000-0000-000000000002',NULL,'ACTIVE','Blank name with $100 payment','ANONYMOUS_PLACEHOLDER'),
  ('c1000003-0000-0000-0000-000000000007','Trevor Thompson','b1000000-0003-0000-0000-000000000002',NULL,'ACTIVE','Date serial ~Oct 2026 is future','FUTURE_DATE'),
  -- Room 3
  ('c1000003-0000-0000-0000-000000000008','Abel Magaya','b1000000-0003-0000-0000-000000000003',NULL,'ACTIVE',NULL,NULL),
  -- Room 5
  ('c1000003-0000-0000-0000-000000000009','Tanya Patel','b1000000-0003-0000-0000-000000000005','2025-06-06','ACTIVE',NULL,NULL),
  ('c1000003-0000-0000-0000-000000000010','Nigel Marshall','b1000000-0003-0000-0000-000000000005',NULL,'ACTIVE','Moved from Room 12 in Feb',NULL),
  -- Room 6
  ('c1000003-0000-0000-0000-000000000011','Nadia Mubaya','b1000000-0003-0000-0000-000000000006',NULL,'ACTIVE',NULL,NULL),
  ('c1000003-0000-0000-0000-000000000012','Unassigned - BG-R6','b1000000-0003-0000-0000-000000000006',NULL,'ACTIVE','Blank name with $130 payment','ANONYMOUS_PLACEHOLDER'),
  -- Room 7
  ('c1000003-0000-0000-0000-000000000013','Ashley Kane','b1000000-0003-0000-0000-000000000007',NULL,'ACTIVE',NULL,NULL),
  ('c1000003-0000-0000-0000-000000000014','Prince Ntuli','b1000000-0003-0000-0000-000000000007',NULL,'ACTIVE',NULL,NULL),
  -- Room 8
  ('c1000003-0000-0000-0000-000000000015','Patrick Mukasa','b1000000-0003-0000-0000-000000000008',NULL,'ACTIVE',NULL,NULL),
  ('c1000003-0000-0000-0000-000000000016','Kuda Mguni','b1000000-0003-0000-0000-000000000008',NULL,'ACTIVE',NULL,NULL),
  -- Room 9
  ('c1000003-0000-0000-0000-000000000017','Tadiwa Mutasa','b1000000-0003-0000-0000-000000000009',NULL,'ACTIVE',NULL,NULL),
  ('c1000003-0000-0000-0000-000000000018','Umar Matemba','b1000000-0003-0000-0000-000000000009',NULL,'ACTIVE',NULL,NULL),
  ('c1000003-0000-0000-0000-000000000019','Simba Mavone','b1000000-0003-0000-0000-000000000009',NULL,'ACTIVE',NULL,NULL),
  -- Room 10
  ('c1000003-0000-0000-0000-000000000020','Victor Mawire','b1000000-0003-0000-0000-000000000010',NULL,'ACTIVE',NULL,NULL),
  ('c1000003-0000-0000-0000-000000000021','Elton Matiza','b1000000-0003-0000-0000-000000000010',NULL,'ACTIVE',NULL,NULL),
  ('c1000003-0000-0000-0000-000000000022','Vincent Choto','b1000000-0003-0000-0000-000000000010',NULL,'ACTIVE',NULL,NULL),
  -- Room 11 (invalid date)
  ('c1000003-0000-0000-0000-000000000023','Trevor Rusike','b1000000-0003-0000-0000-000000000011',NULL,'ACTIVE','Source date "31 APRIL 2025" invalid - April has 30 days','INVALID_DATE'),
  ('c1000003-0000-0000-0000-000000000024','Prosper Mache','b1000000-0003-0000-0000-000000000011',NULL,'ACTIVE',NULL,NULL),
  ('c1000003-0000-0000-0000-000000000025','Unassigned - BG-R11','b1000000-0003-0000-0000-000000000011',NULL,'ACTIVE','Row with "paid" status but no name','ANONYMOUS_PLACEHOLDER'),
  -- Room 12
  ('c1000003-0000-0000-0000-000000000026','Timothy Mahiya','b1000000-0003-0000-0000-000000000012',NULL,'ACTIVE',NULL,NULL),
  ('c1000003-0000-0000-0000-000000000027','Tafadzwa Kunaka','b1000000-0003-0000-0000-000000000012',NULL,'ACTIVE','Replaces former tenant Nigel Marshall',NULL),
  ('c1000003-0000-0000-0000-000000000028','Farai Maxwell','b1000000-0003-0000-0000-000000000012',NULL,'ACTIVE',NULL,NULL),
  -- Room 13
  ('c1000003-0000-0000-0000-000000000029','Alfred Manyama','b1000000-0003-0000-0000-000000000013',NULL,'ACTIVE',NULL,NULL),
  ('c1000003-0000-0000-0000-000000000030','Stanford Jones','b1000000-0003-0000-0000-000000000013',NULL,'ACTIVE',NULL,NULL),
  -- Room 14
  ('c1000003-0000-0000-0000-000000000031','Unassigned - BG-R14','b1000000-0003-0000-0000-000000000014',NULL,'ACTIVE','Blank first row','ANONYMOUS_PLACEHOLDER'),
  ('c1000003-0000-0000-0000-000000000032','Takudzwa Charles','b1000000-0003-0000-0000-000000000014',NULL,'ACTIVE',NULL,NULL),
  ('c1000003-0000-0000-0000-000000000033','Leroy Park','b1000000-0003-0000-0000-000000000014',NULL,'ACTIVE',NULL,NULL),
  -- Room 15
  ('c1000003-0000-0000-0000-000000000034','Samuel Mwanza','b1000000-0003-0000-0000-000000000015',NULL,'ACTIVE','PAID but no date','MISSING_DATE'),
  ('c1000003-0000-0000-0000-000000000035','Nathan Sikora','b1000000-0003-0000-0000-000000000015',NULL,'ACTIVE',NULL,NULL),
  -- Room 16
  ('c1000003-0000-0000-0000-000000000036','Tatenda Chari','b1000000-0003-0000-0000-000000000016',NULL,'ACTIVE',NULL,NULL),
  ('c1000003-0000-0000-0000-000000000037','Tanya Chawanda','b1000000-0003-0000-0000-000000000016',NULL,'ACTIVE',NULL,NULL),
  ('c1000003-0000-0000-0000-000000000038','Leon Jeremy','b1000000-0003-0000-0000-000000000016',NULL,'ACTIVE',NULL,NULL),
  -- Room 17 (two students with no payment)
  ('c1000003-0000-0000-0000-000000000039','Marvin Ngwenya','b1000000-0003-0000-0000-000000000017',NULL,'ACTIVE','Has date but no received cash amount','MISSING_PAYMENT'),
  ('c1000003-0000-0000-0000-000000000040','Ralph Newman','b1000000-0003-0000-0000-000000000017',NULL,'ACTIVE','Has date but no received cash amount','MISSING_PAYMENT'),
  ('c1000003-0000-0000-0000-000000000041','Tamara Marisa','b1000000-0003-0000-0000-000000000017',NULL,'ACTIVE',NULL,NULL),
  -- Room 18
  ('c1000003-0000-0000-0000-000000000042','Tafadzwa Chuma','b1000000-0003-0000-0000-000000000018',NULL,'ACTIVE',NULL,NULL),
  ('c1000003-0000-0000-0000-000000000043','Tina Matizi','b1000000-0003-0000-0000-000000000018',NULL,'ACTIVE',NULL,NULL)
ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════
-- CEDAR HOUSE ROOMS
-- ═══════════════════════════════════════════════════════════
INSERT INTO rooms (id, property_id, room_number, bed_capacity, rent_per_bed, notes) VALUES
  ('b1000000-0004-0000-0000-000000000001','a1000000-0000-0000-0000-000000000004','Room 1',3,130.00,NULL),
  ('b1000000-0004-0000-0000-000000000002','a1000000-0000-0000-0000-000000000004','Room 2',2,130.00,NULL),
  ('b1000000-0004-0000-0000-000000000003','a1000000-0000-0000-0000-000000000004','Room 3',3,130.00,NULL),
  ('b1000000-0004-0000-0000-000000000004','a1000000-0000-0000-0000-000000000004','Room 4',2,150.00,NULL),
  ('b1000000-0004-0000-0000-000000000005','a1000000-0000-0000-0000-000000000004','Room 5',3,130.00,NULL),
  ('b1000000-0004-0000-0000-000000000006','a1000000-0000-0000-0000-000000000004','Room 6',2,160.00,NULL),
  ('b1000000-0004-0000-0000-000000000007','a1000000-0000-0000-0000-000000000004','Room 7',4,110.00,NULL)
ON CONFLICT (id) DO NOTHING;

-- ── CEDAR HOUSE STUDENTS ──
INSERT INTO students (id, full_name, room_id, check_in_date, status, notes, data_flags) VALUES
  -- Room 1
  ('c1000004-0000-0000-0000-000000000001','Felicia Dawson','b1000000-0004-0000-0000-000000000001',NULL,'ACTIVE','Different person from Felicity Dube at Maple Court',NULL),
  ('c1000004-0000-0000-0000-000000000002','Ella Moore','b1000000-0004-0000-0000-000000000001',NULL,'ACTIVE',NULL,NULL),
  ('c1000004-0000-0000-0000-000000000003','Lisa Tucker','b1000000-0004-0000-0000-000000000001',NULL,'ACTIVE',NULL,NULL),
  -- Room 2
  ('c1000004-0000-0000-0000-000000000004','Shannon Mauricio','b1000000-0004-0000-0000-000000000002',NULL,'ACTIVE',NULL,NULL),
  ('c1000004-0000-0000-0000-000000000005','Diana Mahlangu','b1000000-0004-0000-0000-000000000002',NULL,'ACTIVE',NULL,NULL),
  -- Room 3 (invalid date)
  ('c1000004-0000-0000-0000-000000000006','Tanya Naidu','b1000000-0004-0000-0000-000000000003',NULL,'ACTIVE',NULL,NULL),
  ('c1000004-0000-0000-0000-000000000007','Zoe Kadama','b1000000-0004-0000-0000-000000000003',NULL,'ACTIVE',NULL,NULL),
  ('c1000004-0000-0000-0000-000000000008','Tara Chikwe','b1000000-0004-0000-0000-000000000003',NULL,'ACTIVE','Source date "30-FEB-26" invalid','INVALID_DATE'),
  -- Room 4
  ('c1000004-0000-0000-0000-000000000009','Doris Sajeni','b1000000-0004-0000-0000-000000000004',NULL,'ACTIVE',NULL,NULL),
  ('c1000004-0000-0000-0000-000000000010','Ruvarashe Tigere','b1000000-0004-0000-0000-000000000004',NULL,'ACTIVE',NULL,NULL),
  -- Room 5
  ('c1000004-0000-0000-0000-000000000011','Yolanda Mvula','b1000000-0004-0000-0000-000000000005',NULL,'ACTIVE',NULL,NULL),
  ('c1000004-0000-0000-0000-000000000012','Talia Nyoka','b1000000-0004-0000-0000-000000000005',NULL,'ACTIVE',NULL,NULL),
  ('c1000004-0000-0000-0000-000000000013','Shalom Berry','b1000000-0004-0000-0000-000000000005',NULL,'ACTIVE',NULL,NULL),
  -- Room 6
  ('c1000004-0000-0000-0000-000000000014','Tamara Chitsa','b1000000-0004-0000-0000-000000000006',NULL,'ACTIVE',NULL,NULL),
  ('c1000004-0000-0000-0000-000000000015','Tanya Nyanga','b1000000-0004-0000-0000-000000000006',NULL,'ACTIVE',NULL,NULL),
  -- Room 7
  ('c1000004-0000-0000-0000-000000000016','Thandi Ndebele','b1000000-0004-0000-0000-000000000007',NULL,'ACTIVE',NULL,NULL),
  ('c1000004-0000-0000-0000-000000000017','Elaine Zindi','b1000000-0004-0000-0000-000000000007',NULL,'ACTIVE',NULL,NULL),
  ('c1000004-0000-0000-0000-000000000018','Marcus Nyoni','b1000000-0004-0000-0000-000000000007',NULL,'ACTIVE',NULL,NULL),
  ('c1000004-0000-0000-0000-000000000019','Nerissa Zindi','b1000000-0004-0000-0000-000000000007',NULL,'ACTIVE',NULL,NULL)
ON CONFLICT (id) DO NOTHING;


-- ▼▼▼ seed_payments.sql ▼▼▼
-- ═══════════════════════════════════════════════════════════
-- TREVIS MAY 2026 PAYMENTS SEED — CORRECTED
-- Authoritative source: Implementation Plan client data
-- Run AFTER seed.sql and seed_part2.sql
-- Safe to re-run (uses ON CONFLICT DO NOTHING via trigger)
-- ═══════════════════════════════════════════════════════════

-- ══════════════════════════════════════
-- KING FISHER PAYMENTS
-- Partials: Onenhlanha ($106/$110), Ropafadzo ($180/$360)
-- All others: PAID in full
-- ══════════════════════════════════════
INSERT INTO payments (student_id, amount, payment_date, payment_method, month_year, notes) VALUES
  -- Room 1: 4×$110 = $440 ALL PAID
  ('c1000001-0000-0000-0000-000000000001',110,'2026-06-18','Cash',2026-06,NULL),
  ('c1000001-0000-0000-0000-000000000002',110,'2026-06-12','Cash',2026-06,NULL),
  ('c1000001-0000-0000-0000-000000000003',110,'2026-06-05','Cash',2026-06,NULL),
  ('c1000001-0000-0000-0000-000000000004',110,'2026-06-15','Cash',2026-06,NULL),
  -- Room 2: 2×$150 = $300 ALL PAID
  ('c1000001-0000-0000-0000-000000000005',150,'2026-06-09','Cash',2026-06,NULL),
  ('c1000001-0000-0000-0000-000000000006',150,'2026-06-20','Cash',2026-06,NULL),
  -- Room 3: 3×$130 = $390 ALL PAID
  ('c1000001-0000-0000-0000-000000000007',130,'2026-06-02','Cash',2026-06,NULL),
  ('c1000001-0000-0000-0000-000000000008',130,'2026-06-14','Cash',2026-06,NULL),
  ('c1000001-0000-0000-0000-000000000009',130,'2026-06-18','Cash',2026-06,NULL),
  -- Room 4: 2×$150 = $300 ALL PAID
  ('c1000001-0000-0000-0000-000000000010',150,'2026-06-12','Cash',2026-06,NULL),
  ('c1000001-0000-0000-0000-000000000011',150,'2026-06-05','Cash',2026-06,NULL),
  -- Room 5: 2×$150 = $300 ALL PAID
  ('c1000001-0000-0000-0000-000000000012',150,'2026-06-15','Cash',2026-06,NULL),
  ('c1000001-0000-0000-0000-000000000013',150,'2026-06-09','Cash',2026-06,NULL),
  -- Room 6: 2×$150 = $300 ALL PAID
  ('c1000001-0000-0000-0000-000000000014',150,'2026-06-20','Cash',2026-06,NULL),
  ('c1000001-0000-0000-0000-000000000015',150,'2026-05-25','Cash',2026-06,NULL),
  -- Room 7: Vimbai PAID, UNASSIGNED PAID
  ('c1000001-0000-0000-0000-000000000016',150,'2026-05-28','Cash',2026-06,NULL),
  ('c1000001-0000-0000-0000-000000000017',150,'2026-05-26','Cash',2026-06,'Anonymous payment'),
  -- Room 8: Fadzaishe+Faith+Chiedza ALL PAID $130 (per implementation plan)
  ('c1000001-0000-0000-0000-000000000018',130,'2026-05-24','Cash',2026-06,NULL),
  ('c1000001-0000-0000-0000-000000000019',130,'2026-05-18','Cash',2026-06,NULL),
  ('c1000001-0000-0000-0000-000000000020',130,'2026-05-22','Cash',2026-06,NULL),
  -- Room 9: Ashley+Priscilla+Tariro PAID, Onenhlanha PARTIAL ($106 of $110)
  ('c1000001-0000-0000-0000-000000000021',110,'2026-06-09','Cash',2026-06,NULL),
  ('c1000001-0000-0000-0000-000000000022',110,'2026-06-20','Cash',2026-06,NULL),
  ('c1000001-0000-0000-0000-000000000023',106,'2026-06-02','Cash',2026-06,'Paid $106 not $110'),
  ('c1000001-0000-0000-0000-000000000024',110,'2026-06-14','Cash',2026-06,NULL),
  -- Room 10: 4×$110 ALL PAID
  ('c1000001-0000-0000-0000-000000000025',110,'2026-06-18','Cash',2026-06,NULL),
  ('c1000001-0000-0000-0000-000000000026',110,'2026-06-12','Cash',2026-06,'Anonymous'),
  ('c1000001-0000-0000-0000-000000000027',110,'2026-06-05','Cash',2026-06,NULL),
  ('c1000001-0000-0000-0000-000000000028',110,'2026-06-15','Cash',2026-06,NULL),
  -- Room 11: $180 PAID
  ('c1000001-0000-0000-0000-000000000029',180,'2026-06-09','Cash',2026-06,NULL),
  -- Room 12: Shalome+Jady+UNASSIGNED ALL PAID $130 (per implementation plan)
  ('c1000001-0000-0000-0000-000000000030',130,'2026-06-20','Cash',2026-06,NULL),
  ('c1000001-0000-0000-0000-000000000031',130,'2026-06-02','Cash',2026-06,NULL),
  ('c1000001-0000-0000-0000-000000000032',130,'2026-06-14','Cash',2026-06,'Anonymous payment'),
  -- Room 13: 3×$130 ALL PAID
  ('c1000001-0000-0000-0000-000000000033',130,'2026-06-18','Cash',2026-06,NULL),
  ('c1000001-0000-0000-0000-000000000034',130,'2026-06-12','Cash',2026-06,NULL),
  ('c1000001-0000-0000-0000-000000000035',130,'2026-05-25','Cash',2026-06,NULL),
  -- Room 14: 2×$150 ALL PAID
  ('c1000001-0000-0000-0000-000000000036',150,'2026-05-28','Cash',2026-06,NULL),
  ('c1000001-0000-0000-0000-000000000037',150,'2026-05-26','Cash',2026-06,NULL),
  -- Room 15: 2×$150 ALL PAID
  ('c1000001-0000-0000-0000-000000000038',150,'2026-05-24','Cash',2026-06,NULL),
  ('c1000001-0000-0000-0000-000000000039',150,'2026-05-18','Cash',2026-06,NULL),
  -- Room 16: 2×$150 ALL PAID
  ('c1000001-0000-0000-0000-000000000040',150,'2026-05-22','Cash',2026-06,NULL),
  ('c1000001-0000-0000-0000-000000000041',150,'2026-06-18','Cash',2026-06,NULL),
  -- Room 17: 2×$150 ALL PAID
  ('c1000001-0000-0000-0000-000000000042',150,'2026-06-12','Cash',2026-06,NULL),
  ('c1000001-0000-0000-0000-000000000043',150,'2026-06-05','Cash',2026-06,NULL),
  -- Room 18: 5×$110 ALL PAID
  ('c1000001-0000-0000-0000-000000000044',110,'2026-06-15','Cash',2026-06,NULL),
  ('c1000001-0000-0000-0000-000000000045',110,'2026-06-09','Cash',2026-06,NULL),
  ('c1000001-0000-0000-0000-000000000046',110,'2026-06-20','Cash',2026-06,NULL),
  ('c1000001-0000-0000-0000-000000000047',110,'2026-06-02','Cash',2026-06,NULL),
  ('c1000001-0000-0000-0000-000000000048',110,'2026-06-14','Cash',2026-06,NULL),
  -- Room 19: $300 PAID
  ('c1000001-0000-0000-0000-000000000049',300,'2026-06-18','Cash',2026-06,NULL),
  -- Room 20: Ropafadzo PARTIAL ($180 of $360)
  ('c1000001-0000-0000-0000-000000000050',180,'2026-06-12','Cash',2026-06,'Balance $180'),
  -- Room 21: $180 PAID
  ('c1000001-0000-0000-0000-000000000051',180,'2026-06-05','Cash',2026-06,NULL);

-- ══════════════════════════════════════
-- THE CHASE PAYMENTS (Expected $3,470 | Collected $3,470 = 100%)
-- 27 students, 0 overdue
-- ══════════════════════════════════════
INSERT INTO payments (student_id, amount, payment_date, payment_method, month_year, notes) VALUES
  -- Room 1: $260
  ('c1000002-0000-0000-0000-000000000001',260,'2026-06-15','Cash',2026-06,NULL),
  -- Room 2: 2×$130
  ('c1000002-0000-0000-0000-000000000002',130,'2026-06-09','Cash',2026-06,NULL),
  ('c1000002-0000-0000-0000-000000000003',130,'2026-06-20','Cash',2026-06,NULL),
  -- Room 3: 3×$120
  ('c1000002-0000-0000-0000-000000000004',120,'2026-05-25','Cash',2026-06,NULL),
  ('c1000002-0000-0000-0000-000000000005',120,'2026-05-28','Cash',2026-06,NULL),
  ('c1000002-0000-0000-0000-000000000006',120,'2026-05-26','Cash',2026-06,NULL),
  -- Room 4: 2×$130
  ('c1000002-0000-0000-0000-000000000007',130,'2026-05-24','Cash',2026-06,NULL),
  ('c1000002-0000-0000-0000-000000000008',130,'2026-05-18','Cash',2026-06,NULL),
  -- Room 5: 3×$120
  ('c1000002-0000-0000-0000-000000000009',120,'2026-05-22','Cash',2026-06,NULL),
  ('c1000002-0000-0000-0000-000000000010',120,'2026-06-09','Cash',2026-06,NULL),
  ('c1000002-0000-0000-0000-000000000011',120,'2026-06-20','Cash',2026-06,NULL),
  -- Room 6: 4×$100
  ('c1000002-0000-0000-0000-000000000012',100,'2026-06-02','Cash',2026-06,NULL),
  ('c1000002-0000-0000-0000-000000000013',100,'2026-06-14','Cash',2026-06,NULL),
  ('c1000002-0000-0000-0000-000000000014',100,'2026-06-18','Cash',2026-06,NULL),
  ('c1000002-0000-0000-0000-000000000015',100,'2026-06-12','Cash',2026-06,NULL),
  -- Room 7: 2×$130
  ('c1000002-0000-0000-0000-000000000016',130,'2026-06-05','Cash',2026-06,NULL),
  ('c1000002-0000-0000-0000-000000000017',130,'2026-06-15','Cash',2026-06,NULL),
  -- Room 8: 2×$130
  ('c1000002-0000-0000-0000-000000000018',130,'2026-06-09','Cash',2026-06,NULL),
  ('c1000002-0000-0000-0000-000000000019',130,'2026-06-20','Cash',2026-06,NULL),
  -- Room 9: 2×$130
  ('c1000002-0000-0000-0000-000000000020',130,'2026-06-02','Cash',2026-06,NULL),
  ('c1000002-0000-0000-0000-000000000021',130,'2026-06-14','Cash',2026-06,NULL),
  -- Room 10: 2×$130
  ('c1000002-0000-0000-0000-000000000022',130,'2026-06-18','Cash',2026-06,NULL),
  ('c1000002-0000-0000-0000-000000000023',130,'2026-06-12','Cash',2026-06,NULL),
  -- Room 11: 3×$120
  ('c1000002-0000-0000-0000-000000000024',120,'2026-05-25','Cash',2026-06,NULL),
  ('c1000002-0000-0000-0000-000000000025',120,'2026-05-28','Cash',2026-06,NULL),
  ('c1000002-0000-0000-0000-000000000026',120,'2026-05-26','Cash',2026-06,NULL),
  -- Room 12: 3×$120
  ('c1000002-0000-0000-0000-000000000027',120,'2026-05-24','Cash',2026-06,NULL),
  ('c1000002-0000-0000-0000-000000000028',120,'2026-05-18','Cash',2026-06,NULL),
  ('c1000002-0000-0000-0000-000000000029',120,'2026-05-22','Cash',2026-06,NULL),
  -- Room 13: $150
  ('c1000002-0000-0000-0000-000000000030',150,'2026-06-18','Cash',2026-06,NULL);

-- ══════════════════════════════════════
-- MADDEN PAYMENTS (Expected $5,070 | Collected $4,700 = 93%)
-- 40 students total (but some OVERDUE)
-- ══════════════════════════════════════
INSERT INTO payments (student_id, amount, payment_date, payment_method, month_year, notes) VALUES
  -- Room 1: Obvious PAID, William PAID, Dean OVERDUE ($0)
  ('c1000003-0000-0000-0000-000000000001',120,'2026-06-12','Cash',2026-06,NULL),
  ('c1000003-0000-0000-0000-000000000002',120,'2026-06-05','Cash',2026-06,NULL),
  -- Dean: NO payment (OVERDUE)
  -- Room 2: Stanley+Nokutenda+UNASSIGNED+Tinashe ALL PAID
  ('c1000003-0000-0000-0000-000000000004',100,'2026-06-15','Cash',2026-06,NULL),
  ('c1000003-0000-0000-0000-000000000005',100,'2026-06-09','Cash',2026-06,NULL),
  ('c1000003-0000-0000-0000-000000000006',100,'2026-06-20','Cash',2026-06,'Anonymous'),
  ('c1000003-0000-0000-0000-000000000007',100,'2026-06-02','Cash',2026-06,NULL),
  -- Room 3: Abel PAID
  ('c1000003-0000-0000-0000-000000000008',260,'2026-06-14','Cash',2026-06,NULL),
  -- Room 5: Tanatswa+Nigel PAID
  ('c1000003-0000-0000-0000-000000000009',130,'2026-06-18','Cash',2026-06,NULL),
  ('c1000003-0000-0000-0000-000000000010',130,'2026-06-12','Cash',2026-06,NULL),
  -- Room 6: Nyasha PAID, UNASSIGNED OVERDUE ($0)
  ('c1000003-0000-0000-0000-000000000011',130,'2026-06-05','Cash',2026-06,NULL),
  -- UNASSIGNED-MD-R6: NO payment
  -- Room 7: Ashley+Prince PAID
  ('c1000003-0000-0000-0000-000000000013',130,'2026-06-15','Cash',2026-06,NULL),
  ('c1000003-0000-0000-0000-000000000014',130,'2026-06-09','Cash',2026-06,NULL),
  -- Room 8: Patrick+Kudakwashe PAID
  ('c1000003-0000-0000-0000-000000000015',130,'2026-06-20','Cash',2026-06,NULL),
  ('c1000003-0000-0000-0000-000000000016',130,'2026-05-25','Cash',2026-06,NULL),
  -- Room 9: Tadiwa+Umali+Sibarashe PAID
  ('c1000003-0000-0000-0000-000000000017',120,'2026-05-28','Cash',2026-06,NULL),
  ('c1000003-0000-0000-0000-000000000018',120,'2026-05-26','Cash',2026-06,NULL),
  ('c1000003-0000-0000-0000-000000000019',120,'2026-05-24','Cash',2026-06,NULL),
  -- Room 10: Victor+Elton+Vincent PAID
  ('c1000003-0000-0000-0000-000000000020',120,'2026-05-18','Cash',2026-06,NULL),
  ('c1000003-0000-0000-0000-000000000021',120,'2026-05-22','Cash',2026-06,NULL),
  ('c1000003-0000-0000-0000-000000000022',120,'2026-06-09','Cash',2026-06,NULL),
  -- Room 11: Takudzwa+Prosper+UNASSIGNED PAID
  ('c1000003-0000-0000-0000-000000000023',120,'2026-06-20','Cash',2026-06,NULL),
  ('c1000003-0000-0000-0000-000000000024',120,'2026-06-02','Cash',2026-06,NULL),
  ('c1000003-0000-0000-0000-000000000025',120,'2026-06-14','Cash',2026-06,'Anonymous'),
  -- Room 12: Timukudze+Tafadzwa+Farai PAID
  ('c1000003-0000-0000-0000-000000000026',120,'2026-06-18','Cash',2026-06,NULL),
  ('c1000003-0000-0000-0000-000000000027',120,'2026-06-12','Cash',2026-06,NULL),
  ('c1000003-0000-0000-0000-000000000028',120,'2026-06-05','Cash',2026-06,NULL),
  -- Room 13: Alfred+Stanford PAID
  ('c1000003-0000-0000-0000-000000000029',130,'2026-06-15','Cash',2026-06,NULL),
  ('c1000003-0000-0000-0000-000000000030',130,'2026-06-09','Cash',2026-06,NULL),
  -- Room 14: UNASSIGNED PAID, Takudzwa+Leroy PAID
  ('c1000003-0000-0000-0000-000000000031',120,'2026-06-20','Cash',2026-06,'Anonymous'),
  ('c1000003-0000-0000-0000-000000000032',120,'2026-06-02','Cash',2026-06,NULL),
  ('c1000003-0000-0000-0000-000000000033',120,'2026-06-14','Cash',2026-06,NULL),
  -- Room 15: Simba+Nathan PAID
  ('c1000003-0000-0000-0000-000000000034',130,'2026-06-18','Cash',2026-06,NULL),
  ('c1000003-0000-0000-0000-000000000035',130,'2026-06-12','Cash',2026-06,NULL),
  -- Room 16: Tatenda+Taonga+Leon PAID
  ('c1000003-0000-0000-0000-000000000036',130,'2026-05-25','Cash',2026-06,NULL),
  ('c1000003-0000-0000-0000-000000000037',130,'2026-05-28','Cash',2026-06,NULL),
  ('c1000003-0000-0000-0000-000000000038',130,'2026-05-26','Cash',2026-06,NULL),
  -- Room 17: Marvellous OVERDUE, Ralph OVERDUE, Tamuka PAID
  ('c1000003-0000-0000-0000-000000000041',130,'2026-05-24','Cash',2026-06,NULL),
  -- Room 18: Tafadzwa+Tinotenda PAID
  ('c1000003-0000-0000-0000-000000000042',150,'2026-05-18','Cash',2026-06,NULL),
  ('c1000003-0000-0000-0000-000000000043',150,'2026-05-22','Cash',2026-06,NULL);

-- ══════════════════════════════════════
-- NEW HOUSE PAYMENTS (Expected $2,360 | Collected $2,190 = 93%)
-- 19 students, 2 overdue
-- ══════════════════════════════════════
INSERT INTO payments (student_id, amount, payment_date, payment_method, month_year, notes) VALUES
  -- Room 1: Felicia+Ella+Lisa PAID 3×$130
  ('c1000004-0000-0000-0000-000000000001',130,'2026-06-18','Cash',2026-06,NULL),
  ('c1000004-0000-0000-0000-000000000002',130,'2026-06-12','Cash',2026-06,NULL),
  ('c1000004-0000-0000-0000-000000000003',130,'2026-06-05','Cash',2026-06,NULL),
  -- Room 2: Shalom+Diana PAID 2×$130
  ('c1000004-0000-0000-0000-000000000004',130,'2026-06-15','Cash',2026-06,NULL),
  ('c1000004-0000-0000-0000-000000000005',130,'2026-06-09','Cash',2026-06,NULL),
  -- Room 3: Tanatswa+Zvikomborero+Tafadzwa PAID 3×$130
  ('c1000004-0000-0000-0000-000000000006',130,'2026-06-20','Cash',2026-06,NULL),
  ('c1000004-0000-0000-0000-000000000007',130,'2026-06-02','Cash',2026-06,NULL),
  ('c1000004-0000-0000-0000-000000000008',130,'2026-06-14','Cash',2026-06,NULL),
  -- Room 4: Dorcus OVERDUE ($0), Ruvarashe PAID $150
  ('c1000004-0000-0000-0000-000000000010',150,'2026-06-18','Cash',2026-06,NULL),
  -- Room 5: Yolanda+Talent+Shallome PAID 3×$130
  ('c1000004-0000-0000-0000-000000000011',130,'2026-06-12','Cash',2026-06,NULL),
  ('c1000004-0000-0000-0000-000000000012',130,'2026-06-05','Cash',2026-06,NULL),
  ('c1000004-0000-0000-0000-000000000013',130,'2026-06-15','Cash',2026-06,NULL),
  -- Room 6: Tamara+Tanya PAID 2×$160
  ('c1000004-0000-0000-0000-000000000014',160,'2026-06-09','Cash',2026-06,NULL),
  ('c1000004-0000-0000-0000-000000000015',160,'2026-06-20','Cash',2026-06,NULL),
  -- Room 7: Thandisile+Alaine+Munashe PAID, Nerrisa OVERDUE
  ('c1000004-0000-0000-0000-000000000016',110,'2026-05-25','Cash',2026-06,NULL),
  ('c1000004-0000-0000-0000-000000000017',110,'2026-05-28','Cash',2026-06,NULL),
  ('c1000004-0000-0000-0000-000000000018',110,'2026-05-26','Cash',2026-06,NULL);
  -- Nerrisa: NO payment (OVERDUE)

-- ═══════════════════════════════════════════════════════════
-- VERIFICATION QUERY (run after to check totals)
-- ═══════════════════════════════════════════════════════════
-- SELECT p.name,
--   count(distinct s.id) as students,
--   sum(pay.amount) as collected,
--   sum(r.rent_per_bed) as expected
-- FROM properties p
-- JOIN rooms r ON r.property_id = p.id
-- JOIN students s ON s.room_id = r.id AND s.status = 'ACTIVE'
-- LEFT JOIN payments pay ON pay.student_id = s.id AND pay.month_year = 2026-06
-- GROUP BY p.name ORDER BY p.name;


-- ▼▼▼ R3_coverage_invariants.sql ▼▼▼
-- ═══════════════════════════════════════════════════════════
-- R3 — COVERAGE INVARIANTS (Phase 4C-A #4)
-- Defense in depth: make the coverage_start corruption physically impossible to
-- STORE, regardless of any future application bug. The DB itself rejects it.
-- ═══════════════════════════════════════════════════════════
--
-- WHY: coverage_start/end/daily_rate/next_due_date are DERIVED CACHE of the
-- payment ledger (the only truth). Two bugs this cycle wrote bad cache:
-- FLOOR rounding, and last-slice coverage_start (collapsing to start == end).
-- The app is now fixed and auto-reconciles on every mutation, but a CHECK
-- constraint is a permanent backstop: even a future regression cannot persist a
-- coverage_start that is AFTER coverage_end.
--
-- IMPORTANT: coverage_start == coverage_end is VALID (a legitimate 1-day
-- coverage, e.g. a single small payment). So the invariant is start <= end,
-- NOT start < end. NULLs are allowed (no coverage yet); CHECK passes on NULL.
--
-- SAFETY: read-only pre-flight first. Adding the constraint FAILS if any
-- existing row violates it — so run the pre-flight, repair via R2 --apply if
-- needed (expect 0 after the 2026-06-18 repair), THEN add the constraint.
-- ═══════════════════════════════════════════════════════════

-- ── PRE-FLIGHT (read-only): must return 0 before adding the constraint. ──
SELECT COUNT(*) AS violations_must_be_zero
FROM students
WHERE coverage_start IS NOT NULL
  AND coverage_end IS NOT NULL
  AND coverage_start > coverage_end;

-- If the above is 0, run the rest. If > 0, STOP: run
--   node scripts/replay_portfolio_coverage.mjs --apply
-- to repair, re-check, then proceed.

-- ── Add the invariant. ──
ALTER TABLE students
  DROP CONSTRAINT IF EXISTS coverage_start_le_end;

ALTER TABLE students
  ADD CONSTRAINT coverage_start_le_end
  CHECK (
    coverage_start IS NULL
    OR coverage_end IS NULL
    OR coverage_start <= coverage_end
  );

COMMENT ON CONSTRAINT coverage_start_le_end ON students IS
  'Phase 4C-A #4. Derived coverage cache invariant: a stored coverage_start may '
  'never be after coverage_end (start == end is valid: a 1-day coverage). '
  'Backstop against any future writer bug. Truth is the payment ledger.';

-- ── VERIFY (read-only): the constraint exists. ──
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conname = 'coverage_start_le_end';


-- ▼▼▼ R6_performance_indexes.sql ▼▼▼
-- ═══════════════════════════════════════════════════════════
-- R6 — PERFORMANCE INDEXES (safe, additive, reversible)
--
-- Targets the app's actual hot query patterns (audited from src/services/*).
-- Indexes are ADDITIVE: they only speed up reads, never change data, never
-- affect permissions/RLS, and are trivially reversible (DROP INDEX). This is the
-- safe kind of DB change — the opposite of the function-permission work.
--
-- `IF NOT EXISTS` makes this idempotent (safe to re-run).
-- ═══════════════════════════════════════════════════════════

-- ── 1) THE hot one: payments by student, ordered by date. ──
-- Runs on every coverage rebuild/replay, payment-history view, and breakdown
-- (coverageDatabaseService, paymentService, coverageRepairService). The engine
-- replays this constantly. Composite (student_id, payment_date) serves both the
-- filter AND the ORDER BY from the index.
CREATE INDEX IF NOT EXISTS idx_payments_student_date
  ON public.payments (student_id, payment_date);

-- ── 2) Students by room + status (rent-edit fan-out, room aggregation). ──
-- propertyService.rebuildRoomCoverage + room metrics: WHERE room_id=? AND status='ACTIVE'.
CREATE INDEX IF NOT EXISTS idx_students_room_status
  ON public.students (room_id, status);

-- ── 3) Students by status (portfolio fetch + R2/repair scans). ──
-- getAllStudentsCoverage (status != 'VACATED'), R2/repair (status='ACTIVE').
CREATE INDEX IF NOT EXISTS idx_students_status
  ON public.students (status);

-- ── 4) Student transfers by student (transfer history view). ──
CREATE INDEX IF NOT EXISTS idx_student_transfers_student
  ON public.student_transfers (student_id);

-- ── 5) Rooms by property (property detail / build). ──
CREATE INDEX IF NOT EXISTS idx_rooms_property
  ON public.rooms (property_id);

-- ═══════════════════════════════════════════════════════════
-- VERIFY (read-only): list the indexes we just ensured exist.
-- SELECT indexname, tablename FROM pg_indexes
-- WHERE schemaname='public'
--   AND indexname IN ('idx_payments_student_date','idx_students_room_status',
--     'idx_students_status','idx_student_transfers_student','idx_rooms_property')
-- ORDER BY tablename, indexname;
--
-- ROLLBACK (if ever needed — also harmless):
-- DROP INDEX IF EXISTS public.idx_payments_student_date;  -- etc.
-- ═══════════════════════════════════════════════════════════


-- ▼▼▼ R7_parity_objects.sql ▼▼▼
-- ═══════════════════════════════════════════════════════════
-- R7 — PARITY OBJECTS
-- Tables / columns / functions the APP references but the baseline
-- schema.sql did not create. Found by auditing every .from()/.rpc()
-- call in src against the schema. Idempotent; safe to re-run.
-- Run order: after schema.sql (and after seeds is fine too).
-- ═══════════════════════════════════════════════════════════

-- ── rooms.is_active (soft-delete flag; filtered by propertyService + recalc) ──
alter table rooms add column if not exists is_active boolean default true;

-- ── settings (white-label key/value: currency, country code, system name) ──
create table if not exists settings (
  key        varchar(50) primary key,
  value      text not null,
  updated_at timestamptz default now()
);

insert into settings (key, value) values
  ('currency_symbol', '$'),
  ('country_code',    '263'),
  ('system_name',     'PropNest')
on conflict (key) do nothing;

-- ── report_logs (audit trail of report generation) ──
create table if not exists report_logs (
  id           uuid primary key default gen_random_uuid(),
  generated_by uuid references auth.users(id),
  generated_at timestamptz default now(),
  report_month varchar(7),
  report_type  varchar(20) default 'CSV'
);

-- ── monthly_snapshots (historical month-end portfolio metrics) ──
create table if not exists monthly_snapshots (
  id              uuid primary key default gen_random_uuid(),
  snapshot_month  date not null,
  property_id     uuid references properties(id),
  total_students  integer,
  total_expected  numeric,
  total_collected numeric,
  total_arrears   numeric,
  collection_rate numeric,
  occupancy_rate  numeric,
  created_at      timestamptz default now(),
  unique(property_id, snapshot_month)
);

-- ── recalculate_student_balances(): rebuild current-month obligations from the
--    payment ledger. The app calls this after payment create/edit/delete to keep
--    monthly_obligations (and thus collected / collection-rate) in sync. ──
create or replace function recalculate_student_balances()
returns integer
language plpgsql security definer
set search_path = public
as $$
declare
  cnt integer := 0;
  stud record;
  total_paid numeric;
  room_rent numeric;
  new_status text;
  current_month date := date_trunc('month', current_date)::date;
begin
  for stud in
    select s.id, r.rent_per_bed
    from students s
    join rooms r on r.id = s.room_id
    where s.status = 'ACTIVE'
      and coalesce(r.is_active, true) = true
  loop
    select coalesce(sum(amount), 0) into total_paid
    from payments p
    where p.student_id = stud.id
      and date_trunc('month', p.payment_date) = current_month;

    room_rent := stud.rent_per_bed;
    if total_paid >= room_rent then new_status := 'PAID';
    elsif total_paid > 0      then new_status := 'PARTIAL';
    else                            new_status := 'OVERDUE';
    end if;

    insert into monthly_obligations (student_id, month, amount_due, amount_paid, status, due_date)
    values (stud.id, current_month, room_rent, total_paid, new_status, current_month)
    on conflict (student_id, month) do update
      set amount_paid = excluded.amount_paid,
          amount_due  = excluded.amount_due,
          status      = excluded.status,
          updated_at  = now();

    cnt := cnt + 1;
  end loop;
  return cnt;
end;
$$;

-- ── recalculate_all_balances(): thin wrapper the app calls in paymentService. ──
create or replace function recalculate_all_balances()
returns integer
language sql security definer
set search_path = public
as $$ select recalculate_student_balances(); $$;

-- ── RLS + policies for the new tables (consistent with the rest) ──
alter table settings          enable row level security;
alter table report_logs       enable row level security;
alter table monthly_snapshots enable row level security;

drop policy if exists "Authenticated can read settings" on settings;
create policy "Authenticated can read settings" on settings
  for select using (auth.uid() is not null);
drop policy if exists "Admin can write settings" on settings;
create policy "Admin can write settings" on settings
  for all using (is_admin());

drop policy if exists "Admin manages report_logs" on report_logs;
create policy "Admin manages report_logs" on report_logs
  for all using (is_admin());
drop policy if exists "Authenticated can insert report_logs" on report_logs;
create policy "Authenticated can insert report_logs" on report_logs
  for insert with check (auth.uid() is not null);

drop policy if exists "Admin manages snapshots" on monthly_snapshots;
create policy "Admin manages snapshots" on monthly_snapshots
  for all using (is_admin());
drop policy if exists "Manager can read own property snapshots" on monthly_snapshots;
create policy "Manager can read own property snapshots" on monthly_snapshots
  for select using (is_admin() or property_id = my_property_id());

-- ── Grants (default privileges cover these, but be explicit) ──
grant all on settings, report_logs, monthly_snapshots to anon, authenticated, service_role;
grant execute on function recalculate_student_balances() to authenticated, service_role;
grant execute on function recalculate_all_balances()     to authenticated, service_role;

-- ── Sync this month's obligations NOW from existing payments ──
select recalculate_student_balances();


-- ▼▼▼ R8_payment_methods.sql ▼▼▼
-- ═══════════════════════════════════════════════════════════
-- R8 — WIDEN payment_method CHECK to a superset (additive, non-breaking)
-- ═══════════════════════════════════════════════════════════
-- The new UI offers generic methods ("Mobile Money", "Card") that the original
-- constraint rejected, so those payments failed with a CHECK violation. Widen
-- the allowed set to include BOTH the original Zimbabwe methods (so existing
-- Trevis data and EcoCash/Zipit/Swipe keep working) AND the generic ones.
--
-- Safe to run on PropNest now and on Trevis's LIVE DB during the UI port:
-- it only ADDS allowed values, never removes one, so no existing row can break.
-- Idempotent.

DO $$
DECLARE
  conname text;
BEGIN
  -- Find and drop whatever the payment_method check constraint is currently named.
  SELECT c.conname INTO conname
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  WHERE t.relname = 'payments'
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) ILIKE '%payment_method%';

  IF conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE payments DROP CONSTRAINT %I', conname);
  END IF;
END $$;

ALTER TABLE payments
  ADD CONSTRAINT payments_payment_method_check
  CHECK (payment_method IN ('Cash','EcoCash','Bank Transfer','Zipit','Swipe','Mobile Money','Card'));

-- Verify (should return the widened definition):
SELECT pg_get_constraintdef(c.oid) AS payment_method_constraint
FROM pg_constraint c
JOIN pg_class t ON t.oid = c.conrelid
WHERE t.relname = 'payments' AND c.conname = 'payments_payment_method_check';

