-- ═══════════════════════════════════════════════════════════
-- SPRINT 3 DATA FIXES — Run in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

-- Fix 1: Delete phantom Room 10 from NEW HOUSE
DELETE FROM rooms
WHERE property_id = 'a1000000-0000-0000-0000-000000000004'
  AND room_number = 'Room 10';

-- Fix 2a: Insert missing payments for Dorcas Sajeni (NH Room 4)
INSERT INTO payments (student_id, amount, payment_date, payment_method, month_year, notes)
SELECT 'c1000004-0000-0000-0000-000000000009', 150, '2026-05-01', 'Cash', '2026-05', 'Corrected — was showing OVERDUE'
WHERE NOT EXISTS (
  SELECT 1 FROM payments WHERE student_id = 'c1000004-0000-0000-0000-000000000009' AND month_year = '2026-05'
);

-- Fix 2b: Insert missing payment for Nerrisa Zindowe (NH Room 7)
INSERT INTO payments (student_id, amount, payment_date, payment_method, month_year, notes)
SELECT 'c1000004-0000-0000-0000-000000000019', 110, '2026-05-01', 'Cash', '2026-05', 'Corrected — was showing OVERDUE'
WHERE NOT EXISTS (
  SELECT 1 FROM payments WHERE student_id = 'c1000004-0000-0000-0000-000000000019' AND month_year = '2026-05'
);

-- Fix 2c: Correct name spelling — SHALOME → SALOME Shumbaimwe (KF Room 12)
UPDATE students SET full_name = 'Salome Shumbaimwe'
WHERE id = 'c1000001-0000-0000-0000-000000000030';

-- Fix 2d: Correct name — The Chase Room 5 student
-- First find which student needs correction
UPDATE students SET full_name = 'Rufaro Mbano'
WHERE room_id = 'b1000000-0002-0000-0000-000000000005'
  AND (full_name ILIKE '%rufaro%' OR full_name ILIKE '%rifaro%');

-- Fix 3: Update monthly_obligations for corrected payments
-- For Dorcas Sajeni
INSERT INTO monthly_obligations (student_id, month, amount_due, amount_paid, status)
VALUES ('c1000004-0000-0000-0000-000000000009', '2026-05-01', 150, 150, 'PAID')
ON CONFLICT (student_id, month) DO UPDATE SET amount_paid = 150, status = 'PAID';

-- For Nerrisa Zindowe
INSERT INTO monthly_obligations (student_id, month, amount_due, amount_paid, status)
VALUES ('c1000004-0000-0000-0000-000000000019', '2026-05-01', 110, 110, 'PAID')
ON CONFLICT (student_id, month) DO UPDATE SET amount_paid = 110, status = 'PAID';

-- Fix 3b: Recalculate ALL obligations where paid >= due but status != PAID
UPDATE monthly_obligations
SET status = 'PAID'
WHERE amount_paid >= amount_due AND status != 'PAID';

-- ═══════════════════════════════════════════════════════════
-- NEW TABLES FOR SPRINT 3
-- ═══════════════════════════════════════════════════════════

-- Monthly snapshots for historical tracking
CREATE TABLE IF NOT EXISTS monthly_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_month date NOT NULL,
  property_id uuid REFERENCES properties(id),
  total_students integer,
  total_expected numeric,
  total_collected numeric,
  total_arrears numeric,
  collection_rate numeric,
  occupancy_rate numeric,
  created_at timestamptz DEFAULT now(),
  UNIQUE(property_id, snapshot_month)
);

-- Report generation logs
CREATE TABLE IF NOT EXISTS report_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  generated_by uuid REFERENCES auth.users(id),
  generated_at timestamptz DEFAULT now(),
  report_month varchar(7),
  report_type varchar(20) DEFAULT 'CSV'
);

-- Settings table for white-label / resale
CREATE TABLE IF NOT EXISTS settings (
  key varchar(50) PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- Default settings
INSERT INTO settings (key, value) VALUES
  ('currency_symbol', '$'),
  ('country_code', '263'),
  ('system_name', 'Trevis'),
  ('primary_color', '#F5A623'),
  ('grace_period_days', '5'),
  ('late_fee_enabled', 'false'),
  ('late_fee_amount', '0')
ON CONFLICT (key) DO NOTHING;

-- Add portfolio_name to properties
ALTER TABLE properties ADD COLUMN IF NOT EXISTS portfolio_name varchar(100);

-- RLS for new tables
ALTER TABLE monthly_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can read snapshots" ON monthly_snapshots FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admin can manage snapshots" ON monthly_snapshots FOR ALL USING (is_admin());
CREATE POLICY "Auth users can read report logs" ON report_logs FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth users can insert report logs" ON report_logs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Auth users can read settings" ON settings FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admin can manage settings" ON settings FOR ALL USING (is_admin());

-- Snapshot RPC function for easy saving
CREATE OR REPLACE FUNCTION save_monthly_snapshot(p_month date)
RETURNS integer AS $$
DECLARE
  prop_rec RECORD;
  cnt integer := 0;
BEGIN
  FOR prop_rec IN
    SELECT p.id as property_id,
      count(DISTINCT s.id) as total_students,
      coalesce(sum(r.rent_per_bed), 0) as total_expected,
      coalesce(sum(pay.amount), 0) as total_collected,
      r2.total_beds
    FROM properties p
    JOIN rooms r ON r.property_id = p.id
    JOIN students s ON s.room_id = r.id AND s.status = 'ACTIVE'
    LEFT JOIN payments pay ON pay.student_id = s.id
      AND pay.month_year = to_char(p_month, 'YYYY-MM')
    LEFT JOIN LATERAL (
      SELECT sum(bed_capacity) as total_beds FROM rooms WHERE property_id = p.id
    ) r2 ON true
    GROUP BY p.id, r2.total_beds
  LOOP
    INSERT INTO monthly_snapshots (snapshot_month, property_id, total_students,
      total_expected, total_collected, total_arrears, collection_rate, occupancy_rate)
    VALUES (
      p_month, prop_rec.property_id, prop_rec.total_students,
      prop_rec.total_expected, prop_rec.total_collected,
      prop_rec.total_expected - prop_rec.total_collected,
      CASE WHEN prop_rec.total_expected > 0
        THEN round((prop_rec.total_collected / prop_rec.total_expected) * 100, 1)
        ELSE 0 END,
      CASE WHEN prop_rec.total_beds > 0
        THEN round((prop_rec.total_students::numeric / prop_rec.total_beds) * 100, 1)
        ELSE 0 END
    )
    ON CONFLICT (property_id, snapshot_month) DO UPDATE SET
      total_students = EXCLUDED.total_students,
      total_expected = EXCLUDED.total_expected,
      total_collected = EXCLUDED.total_collected,
      total_arrears = EXCLUDED.total_arrears,
      collection_rate = EXCLUDED.collection_rate,
      occupancy_rate = EXCLUDED.occupancy_rate;
    cnt := cnt + 1;
  END LOOP;
  RETURN cnt;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Obligation generation RPC
CREATE OR REPLACE FUNCTION generate_monthly_obligations(p_month date)
RETURNS integer AS $$
DECLARE
  cnt integer := 0;
  stud RECORD;
BEGIN
  FOR stud IN
    SELECT s.id as student_id, r.rent_per_bed as amount_due
    FROM students s
    JOIN rooms r ON r.id = s.room_id
    WHERE s.status = 'ACTIVE'
      AND NOT EXISTS (
        SELECT 1 FROM monthly_obligations mo
        WHERE mo.student_id = s.id AND mo.month = p_month
      )
  LOOP
    INSERT INTO monthly_obligations (student_id, month, amount_due, amount_paid, status)
    VALUES (stud.student_id, p_month, stud.amount_due, 0, 'OVERDUE');
    cnt := cnt + 1;
  END LOOP;
  RETURN cnt;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
