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
