-- Phase M: align UNIQUE keys on income_forms and wealth_reconciliation_forms
-- with the ON CONFLICT target used by the registration seed loop.
--
-- Both tables already have a user-tax-year unique, but on (user_id, tax_year_id)
-- / (user_id, user_email, tax_year_id) — not on (user_id, tax_year). The seed
-- loop in routes/auth.js (and modules/Admin/routes/admin.js) uses the simpler
-- (user_id, tax_year) target to be uniform across all 13 form tables.
-- This migration adds the matching constraint (functionally equivalent since
-- tax_year ↔ tax_year_id is 1:1).
--
-- Caught by the Playwright register smoke test.
--
-- Apply:  psql -d tax_advisor -f backend/database/migrations/phase-m-income-wealth-recon-uniques.sql

BEGIN;

DO $$
BEGIN
  -- income_forms
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'income_forms_user_year_unique'
  ) THEN
    -- De-dup any existing rows (keep most recent per user+year).
    DELETE FROM income_forms WHERE id IN (
      SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                 PARTITION BY user_id, tax_year
                 ORDER BY COALESCE(updated_at, created_at) DESC, id ASC
               ) AS rn
          FROM income_forms
      ) x WHERE x.rn > 1
    );
    ALTER TABLE income_forms ADD CONSTRAINT income_forms_user_year_unique UNIQUE (user_id, tax_year);
    RAISE NOTICE 'added income_forms_user_year_unique';
  ELSE
    RAISE NOTICE 'income_forms_user_year_unique already present';
  END IF;

  -- wealth_reconciliation_forms
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'wealth_reconciliation_forms_user_year_unique'
  ) THEN
    DELETE FROM wealth_reconciliation_forms WHERE id IN (
      SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                 PARTITION BY user_id, tax_year
                 ORDER BY COALESCE(updated_at, created_at) DESC, id ASC
               ) AS rn
          FROM wealth_reconciliation_forms
      ) x WHERE x.rn > 1
    );
    ALTER TABLE wealth_reconciliation_forms
      ADD CONSTRAINT wealth_reconciliation_forms_user_year_unique UNIQUE (user_id, tax_year);
    RAISE NOTICE 'added wealth_reconciliation_forms_user_year_unique';
  ELSE
    RAISE NOTICE 'wealth_reconciliation_forms_user_year_unique already present';
  END IF;
END$$;

COMMIT;
