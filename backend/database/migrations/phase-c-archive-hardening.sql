-- Phase C: harden tax_return_history as the prior-year archive.
-- Adds totals JSONB + tax_year_id FK + source_filename + imported_by,
-- enforces UNIQUE(user_id, tax_year). Idempotent.
--
-- Apply:  psql -d tax_advisor -f backend/database/migrations/phase-c-archive-hardening.sql

BEGIN;

-- 1. New columns (safe with IF NOT EXISTS).
ALTER TABLE tax_return_history
  ADD COLUMN IF NOT EXISTS tax_year_id     UUID REFERENCES tax_years(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS totals          JSONB,
  ADD COLUMN IF NOT EXISTS source_filename TEXT,
  ADD COLUMN IF NOT EXISTS imported_by     UUID REFERENCES users(id) ON DELETE SET NULL;

-- 2. Back-fill tax_year_id from the tax_year string for existing rows.
UPDATE tax_return_history h
   SET tax_year_id = ty.id
  FROM tax_years ty
 WHERE h.tax_year = ty.tax_year
   AND h.tax_year_id IS NULL;

-- 3. Enforce one archive row per user per tax year.
--    Drop old non-unique index if it exists, then add the unique constraint.
DROP INDEX IF EXISTS idx_tax_return_history_user_year;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'tax_return_history_user_year_unique'
  ) THEN
    ALTER TABLE tax_return_history
      ADD CONSTRAINT tax_return_history_user_year_unique UNIQUE (user_id, tax_year);
  END IF;
END$$;

COMMIT;
