-- ═══════════════════════════════════════════════════════════
-- SCHEMA COMPATIBILITY PROBE — run against TREVIS's DB (or the shadow copy)
--
-- Before pointing PropNest's code at Trevis's database, confirm his schema has
-- every column + function PropNest reads/writes. Run this in his SQL Editor; any
-- row marked MISSING is a gap to reconcile (add the column/function, or make
-- PropNest tolerant) BEFORE go-live. This is exactly the class of issue we hit
-- locally (students.updated_at, the absent transfer RPC) — caught up front here.
--
-- Read-only: SELECT only, writes nothing.
-- ═══════════════════════════════════════════════════════════

-- 1) Columns PropNest's queries depend on
with required_cols(tbl, col, used_by) as (
  values
    ('properties','name','dashboard/grouping'),
    ('properties','location','property cards'),
    ('properties','color_accent','coverage rows (getAllStudentsCoverage)'),
    ('rooms','room_number','everywhere'),
    ('rooms','bed_capacity','occupancy + beds'),
    ('rooms','rent_per_bed','engine (daily rate)'),
    ('rooms','is_active','room filter'),
    ('rooms','notes','room notes'),
    ('students','full_name','everywhere'),
    ('students','status','engine (ACTIVE-only)'),
    ('students','room_id','transfer / assignment'),
    ('students','coverage_start','derived cache'),
    ('students','coverage_end','engine status (the truth)'),
    ('students','daily_rate','outstanding calc'),
    ('students','next_due_date','derived cache'),
    ('students','data_flags','data quality'),
    ('students','check_in_date','calendar check-ins'),
    ('students','check_out_date','vacate'),
    ('students','national_id','tenant profile'),
    ('students','phone','tenant profile'),
    ('students','payment_plan','tenant profile'),
    ('students','notes','tenant profile'),
    ('payments','amount','engine'),
    ('payments','payment_date','engine'),
    ('payments','payment_method','ledger'),
    ('payments','receipt_number','ledger'),
    ('payments','month_year','month rollups'),
    ('payments','notes','ledger'),
    ('payments','recorded_by','audit'),
    ('payments','coverage_start_date','rebuild writes this'),
    ('payments','coverage_end_date','rebuild writes this'),
    ('payments','days_covered','rebuild writes this'),
    ('monthly_obligations','amount_due','expected/collected'),
    ('monthly_obligations','amount_paid','expected/collected'),
    ('monthly_obligations','status','obligations'),
    ('monthly_obligations','month','current-month match')
)
select
  r.tbl as table_name,
  r.col as column_name,
  r.used_by,
  case when c.column_name is null then 'MISSING ❌' else 'ok' end as present
from required_cols r
left join information_schema.columns c
  on c.table_schema = 'public' and c.table_name = r.tbl and c.column_name = r.col
order by (c.column_name is null) desc, r.tbl, r.col;

-- 2) Functions (RPCs) PropNest may call. execute_student_transfer is required for
--    the Transfer feature; the rest are legacy admin/settings actions — MISSING is
--    only a problem if the corresponding screen is used.
with required_fns(fn, used_by) as (
  values
    ('execute_student_transfer','Transfer feature (required)'),
    ('recalculate_all_balances','admin recalc (optional)'),
    ('recalculate_student_balances','admin recalc (optional)'),
    ('generate_monthly_obligations','settings: generate obligations (optional)'),
    ('save_monthly_snapshot','settings: monthly snapshot (optional)')
)
select
  f.fn as function_name,
  f.used_by,
  case when p.proname is null then 'MISSING ❌' else 'ok' end as present
from required_fns f
left join pg_proc p on p.proname = f.fn
left join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
group by f.fn, f.used_by, p.proname
order by (p.proname is null) desc, f.fn;
