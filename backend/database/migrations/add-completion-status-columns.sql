-- Migration: add-completion-status-columns.sql
-- Adds completion tracking for 3 forms that were missing from form_completion_status:
--   final_min_income, wealth_reconciliation, tax_computation
--
-- The all_forms_complete and completion_percentage columns are generated columns
-- whose expressions must be dropped and recreated to include the new columns.
--
-- Safe to run multiple times (uses IF NOT EXISTS for new columns;
-- generated column recreation is idempotent via DROP IF EXISTS + ALTER).

BEGIN;

-- Step 1: Drop generated columns (cannot ALTER a generated column expression in-place)
ALTER TABLE form_completion_status
  DROP COLUMN IF EXISTS all_forms_complete,
  DROP COLUMN IF EXISTS completion_percentage;

-- Step 2: Add the 3 missing completion boolean columns
ALTER TABLE form_completion_status
  ADD COLUMN IF NOT EXISTS final_min_income_form_complete     BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS wealth_reconciliation_form_complete BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS tax_computation_form_complete      BOOLEAN DEFAULT FALSE;

-- Step 3: Recreate all_forms_complete as a generated column including all 12 forms
--   Original 9: income, adjustable_tax, reductions, credits, deductions,
--               final_tax, capital_gain, expenses, wealth
--   New 3:      final_min_income, wealth_reconciliation, tax_computation
ALTER TABLE form_completion_status
  ADD COLUMN all_forms_complete BOOLEAN GENERATED ALWAYS AS (
    CASE
      WHEN (
        COALESCE(income_form_complete, FALSE) AND
        COALESCE(adjustable_tax_form_complete, FALSE) AND
        COALESCE(reductions_form_complete, FALSE) AND
        COALESCE(credits_form_complete, FALSE) AND
        COALESCE(deductions_form_complete, FALSE) AND
        COALESCE(final_tax_form_complete, FALSE) AND
        COALESCE(capital_gain_form_complete, FALSE) AND
        COALESCE(expenses_form_complete, FALSE) AND
        COALESCE(wealth_form_complete, FALSE) AND
        COALESCE(final_min_income_form_complete, FALSE) AND
        COALESCE(wealth_reconciliation_form_complete, FALSE) AND
        COALESCE(tax_computation_form_complete, FALSE)
      ) THEN TRUE
      ELSE FALSE
    END
  ) STORED;

-- Step 4: Recreate completion_percentage over all 12 forms (max = 12)
ALTER TABLE form_completion_status
  ADD COLUMN completion_percentage INT GENERATED ALWAYS AS (
    (
      (CASE WHEN COALESCE(income_form_complete, FALSE)              THEN 1 ELSE 0 END) +
      (CASE WHEN COALESCE(adjustable_tax_form_complete, FALSE)      THEN 1 ELSE 0 END) +
      (CASE WHEN COALESCE(reductions_form_complete, FALSE)          THEN 1 ELSE 0 END) +
      (CASE WHEN COALESCE(credits_form_complete, FALSE)             THEN 1 ELSE 0 END) +
      (CASE WHEN COALESCE(deductions_form_complete, FALSE)          THEN 1 ELSE 0 END) +
      (CASE WHEN COALESCE(final_tax_form_complete, FALSE)           THEN 1 ELSE 0 END) +
      (CASE WHEN COALESCE(capital_gain_form_complete, FALSE)        THEN 1 ELSE 0 END) +
      (CASE WHEN COALESCE(expenses_form_complete, FALSE)            THEN 1 ELSE 0 END) +
      (CASE WHEN COALESCE(wealth_form_complete, FALSE)              THEN 1 ELSE 0 END) +
      (CASE WHEN COALESCE(final_min_income_form_complete, FALSE)    THEN 1 ELSE 0 END) +
      (CASE WHEN COALESCE(wealth_reconciliation_form_complete, FALSE) THEN 1 ELSE 0 END) +
      (CASE WHEN COALESCE(tax_computation_form_complete, FALSE)     THEN 1 ELSE 0 END)
    ) * 100 / 12
  ) STORED;

COMMIT;
