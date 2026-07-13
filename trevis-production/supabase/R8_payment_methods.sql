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
