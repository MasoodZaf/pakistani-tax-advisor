-- Phase D: enforce one-form-row-per-user-per-year on all form tables.
--
-- Without these constraints, the SELECT-then-INSERT pattern in saveFormData
-- and in the registration flow races: two concurrent requests both see "no
-- existing row" and both INSERT, creating duplicates. Subsequent reads do
-- rows[0] and silently pick one → lost writes.
--
-- Step 1: de-duplicate existing rows.
-- Step 2: add UNIQUE(user_id, tax_year) per table.
--
-- Apply:  psql -d tax_advisor -f backend/database/migrations/phase-d-form-unique-constraints.sql
-- Idempotent: re-running is safe.

BEGIN;

-- De-dup helper: keeps the row with the smallest id per (user_id, tax_year)
-- group. Empty-placeholder duplicates (same-second created_at, no user-typed
-- data) are the common case from the registration-flow race; arbitrary tiebreak
-- is acceptable. For any table with meaningful divergent data, this should be
-- reviewed in a staging DB first.
DO $$
DECLARE
  t TEXT;
  deleted_count INT;
  tables TEXT[] := ARRAY[
    'adjustable_tax_forms',
    'credits_forms',
    'deductions_forms',
    'reductions_forms',
    'final_tax_forms',
    'capital_gain_forms',
    'expenses_forms',
    'final_min_income_forms',
    'tax_computation_forms',
    'wealth_forms',
    'form_completion_status'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format($sql$
      WITH ranked AS (
        SELECT id,
               ROW_NUMBER() OVER (
                 PARTITION BY user_id, tax_year
                 ORDER BY COALESCE(updated_at, created_at) DESC, id ASC
               ) AS rn
          FROM %I
      )
      DELETE FROM %I WHERE id IN (SELECT id FROM ranked WHERE rn > 1)
    $sql$, t, t);
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'de-duped % rows from %', deleted_count, t;
  END LOOP;
END$$;

-- Add UNIQUE(user_id, tax_year) per table. Wrapped in IF NOT EXISTS via
-- pg_constraint lookup so this is idempotent.
DO $$
DECLARE
  t TEXT;
  cname TEXT;
  tables TEXT[] := ARRAY[
    'adjustable_tax_forms',
    'credits_forms',
    'deductions_forms',
    'reductions_forms',
    'final_tax_forms',
    'capital_gain_forms',
    'expenses_forms',
    'final_min_income_forms',
    'tax_computation_forms',
    'wealth_forms',
    'form_completion_status'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    cname := t || '_user_year_unique';
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = cname) THEN
      EXECUTE format(
        'ALTER TABLE %I ADD CONSTRAINT %I UNIQUE (user_id, tax_year)',
        t, cname
      );
      RAISE NOTICE 'added unique constraint % on %', cname, t;
    ELSE
      RAISE NOTICE 'unique constraint % already exists on %', cname, t;
    END IF;
  END LOOP;
END$$;

COMMIT;
