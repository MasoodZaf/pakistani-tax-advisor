-- phase-x-capture-vps-one-offs.sql
--
-- Captures the hand-applied SQL that was run directly on the production VPS
-- in 2026-05 but never made it into a migration file. Without this, a fresh
-- deploy from `schema.sql` + the existing phase-* migrations cannot
-- reproduce the production schema — disaster-recovery risk.
--
-- Idempotent: every statement uses IF NOT EXISTS or an equivalent guard.
-- Safe to run on the live VPS (everything below is already in place there)
-- and required for any fresh cluster build.
--
-- Source-of-truth notes by item:
--
--   1. tax_slabs.fixed_amount
--      Added by hand to support the surcharge/fixed-component math; the
--      base `schema.sql` definition of tax_slabs has only min_income,
--      max_income, and tax_rate. Default 0 preserves existing rows.
--
--   2. tax_rates_config.{min_income,max_income}
--      schema.sql created this table with min_amount / max_amount. Later
--      code expected min_income / max_income. The hot-fix added the new
--      names (kept side-by-side with the legacy columns) and mirrored the
--      values across. Both are populated on every read path; this
--      migration just makes sure the columns exist and the back-fill has
--      run.
--
--   3. tax_returns_user_year_unique
--      UNIQUE (user_id, tax_year) on tax_returns. Required by the
--      registration code's `ON CONFLICT (user_id, tax_year) DO NOTHING`
--      against tax_returns and the form_* placeholder rows. schema.sql
--      doesn't carry this constraint.
--
--   4. tax_slabs UPDATE to Finance Act 2025 rates
--      The original `add-tax-year-2025-26-slabs.sql` seeds with
--      WHERE NOT EXISTS, so on a cluster that already had (wrong) rows
--      for TY 2025-26 it was a no-op. Hand-applied UPDATE rewrote the
--      rates to the correct FA2025 schedule. Idempotent here — running
--      again sets the same values.
--
-- Apply order: t → u → v → w → x.

BEGIN;

-- ── 1. tax_slabs.fixed_amount ───────────────────────────────────────────────
ALTER TABLE tax_slabs
  ADD COLUMN IF NOT EXISTS fixed_amount DECIMAL(15,2) DEFAULT 0;

-- ── 2. tax_rates_config.{min_income,max_income} ─────────────────────────────
-- The columns are plain (not generated) because the legacy code still writes
-- to min_amount/max_amount and we needed both readable. Default values match
-- the legacy schema's min_amount/max_amount defaults so any code path that
-- selects the new names sees sensible numbers even if the back-fill hasn't
-- run for a particular row.
ALTER TABLE tax_rates_config
  ADD COLUMN IF NOT EXISTS min_income DECIMAL(15,2) DEFAULT 0;
ALTER TABLE tax_rates_config
  ADD COLUMN IF NOT EXISTS max_income DECIMAL(15,2) DEFAULT 999999999999.99;

-- Back-fill from the legacy columns for any rows where the new columns are
-- still at their defaults. Idempotent — running again is a no-op on
-- already-mirrored rows.
UPDATE tax_rates_config
   SET min_income = min_amount
 WHERE min_income IS DISTINCT FROM min_amount AND min_amount IS NOT NULL;

UPDATE tax_rates_config
   SET max_income = max_amount
 WHERE max_income IS DISTINCT FROM max_amount AND max_amount IS NOT NULL;

-- ── 3. UNIQUE(user_id, tax_year) on tax_returns ─────────────────────────────
-- ADD CONSTRAINT IF NOT EXISTS only landed in PG 16+; the live cluster runs
-- PG 15. Emulate it by checking pg_constraint first.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'tax_returns_user_year_unique'
       AND conrelid = 'tax_returns'::regclass
  ) THEN
    ALTER TABLE tax_returns
      ADD CONSTRAINT tax_returns_user_year_unique UNIQUE (user_id, tax_year);
  END IF;
END $$;

-- ── 4. Force tax_slabs to FA2025 rates for TY 2025-26 ──────────────────────
-- Updates only rows that exist; does not seed new rows (that's the seed
-- migration's job). Bound to slab_order so a row that exists at a different
-- name still gets the correct rate.
WITH ty AS (
  SELECT id FROM tax_years WHERE tax_year = '2025-26'
)
UPDATE tax_slabs
   SET min_income = v.min_income,
       max_income = v.max_income,
       tax_rate   = v.tax_rate,
       slab_name  = v.slab_name
  FROM (VALUES
    (1, 0.00,       600000.00,  0.00, 'Slab 1 — Nil'),
    (2, 600000.00,  1200000.00, 0.01, 'Slab 2 — 1%'),
    (3, 1200000.00, 2200000.00, 0.11, 'Slab 3 — 11%'),
    (4, 2200000.00, 3200000.00, 0.23, 'Slab 4 — 23%'),
    (5, 3200000.00, 4100000.00, 0.30, 'Slab 5 — 30%'),
    (6, 4100000.00, NULL,       0.35, 'Slab 6 — 35%')
  ) AS v(slab_order, min_income, max_income, tax_rate, slab_name)
 WHERE tax_slabs.tax_year_id = (SELECT id FROM ty)
   AND tax_slabs.slab_type   = 'individual'
   AND tax_slabs.slab_order  = v.slab_order;

COMMIT;
