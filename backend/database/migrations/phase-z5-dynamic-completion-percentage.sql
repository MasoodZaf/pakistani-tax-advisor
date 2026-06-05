-- Phase Z5: make form_completion_status.completion_percentage (and its sibling
-- all_forms_complete flag) reflect the user's ACTIVE income profile instead of
-- a fixed 12-form denominator.
--
-- Background
-- ----------
-- completion_percentage was a STORED generated column computed as:
--     (count of the 12 *_complete booleans) * 100 / 12
-- and all_forms_complete required all 12 booleans to be true.
--
-- Two of those forms are conditional: capital_gain and final_tax are only shown
-- to a user whose income profile selects the relevant addons (the web form's
-- deriveActiveSteps logic in Frontend/src/contexts/TaxFormContext.js). A salaried
-- filer with neither capital gains nor final-tax income therefore completes every
-- form they're shown, yet the stored percentage caps at 10/12 = 83% and
-- all_forms_complete can never become true — which is the common case, not an edge
-- case. The web form's own progress bar (activeSteps-based) shows 100% for the same
-- user, so the two disagree.
--
-- Fix: convert both generated columns to plain columns and let the backend
-- (recalculateFormCompletion in taxFormsShared.js) write the dynamic value, whose
-- denominator counts only the forms active for that user's profile. This migration
-- converts the columns and backfills existing rows so nobody sees a stale value
-- before their next form save.
--
-- Active-form rule (mirrors deriveActiveSteps on the web):
--   always active (10): income, final_min_income, adjustable_tax, reductions,
--     credits, deductions, expenses, wealth, wealth_reconciliation, tax_computation
--   capital_gain : active iff addons ∩ {property_gain, securities}
--   final_tax    : active iff addons ∩ {bank_profit, dividends, securities, prizes}
--
-- Apply:  psql -d tax_advisor -f backend/database/migrations/phase-z5-dynamic-completion-percentage.sql
-- Safe to run multiple times (DROP EXPRESSION IF EXISTS + idempotent backfill).

BEGIN;

-- 1. Convert the generated columns to plain columns, preserving stored values.
--    DROP EXPRESSION (Postgres 14+) keeps the column and its current data.
--    IF EXISTS makes this a no-op when the column is already plain (re-runs).
ALTER TABLE form_completion_status
  ALTER COLUMN completion_percentage DROP EXPRESSION IF EXISTS,
  ALTER COLUMN all_forms_complete    DROP EXPRESSION IF EXISTS;

-- 2. Plain columns need defaults — the registration INSERT (auth.js) and the
--    prior-year row creation don't list these columns, so they fall back to the
--    column default.
ALTER TABLE form_completion_status
  ALTER COLUMN completion_percentage SET DEFAULT 0,
  ALTER COLUMN all_forms_complete    SET DEFAULT false;

-- 3. Backfill every existing row with the dynamic value so the new column never
--    shows a stale (or NULL) value before the user's next form save.
UPDATE form_completion_status fcs
SET completion_percentage = calc.pct,
    all_forms_complete    = calc.all_complete
FROM (
  SELECT
    f.id,
    ROUND(c.completed * 100.0 / c.denom)::int AS pct,
    (c.completed = c.denom)                   AS all_complete
  FROM form_completion_status f
  LEFT JOIN tax_returns tr
    ON tr.user_id = f.user_id AND tr.tax_year = f.tax_year
  -- Which conditional forms are active for this user's income profile. The jsonb
  -- `?` operator tests element existence in the addons array; COALESCE handles a
  -- missing tax_returns row (LEFT JOIN) or absent income_profile as salaried-only.
  CROSS JOIN LATERAL (
    SELECT
      COALESCE((tr.income_profile -> 'addons') ? 'property_gain', false)
        OR COALESCE((tr.income_profile -> 'addons') ? 'securities', false) AS cg_active,
      COALESCE((tr.income_profile -> 'addons') ? 'bank_profit', false)
        OR COALESCE((tr.income_profile -> 'addons') ? 'dividends', false)
        OR COALESCE((tr.income_profile -> 'addons') ? 'securities', false)
        OR COALESCE((tr.income_profile -> 'addons') ? 'prizes', false)    AS ft_active
  ) act
  -- Denominator = 10 always-active forms + active conditionals.
  -- Numerator   = completed forms, counting a conditional only when it is active.
  CROSS JOIN LATERAL (
    SELECT
      10 + (CASE WHEN act.cg_active THEN 1 ELSE 0 END)
         + (CASE WHEN act.ft_active THEN 1 ELSE 0 END) AS denom,
        (CASE WHEN f.income_form_complete                 THEN 1 ELSE 0 END)
      + (CASE WHEN f.final_min_income_form_complete        THEN 1 ELSE 0 END)
      + (CASE WHEN f.adjustable_tax_form_complete          THEN 1 ELSE 0 END)
      + (CASE WHEN f.reductions_form_complete              THEN 1 ELSE 0 END)
      + (CASE WHEN f.credits_form_complete                 THEN 1 ELSE 0 END)
      + (CASE WHEN f.deductions_form_complete              THEN 1 ELSE 0 END)
      + (CASE WHEN f.expenses_form_complete                THEN 1 ELSE 0 END)
      + (CASE WHEN f.wealth_form_complete                  THEN 1 ELSE 0 END)
      + (CASE WHEN f.wealth_reconciliation_form_complete   THEN 1 ELSE 0 END)
      + (CASE WHEN f.tax_computation_form_complete         THEN 1 ELSE 0 END)
      + (CASE WHEN act.cg_active AND f.capital_gain_form_complete THEN 1 ELSE 0 END)
      + (CASE WHEN act.ft_active AND f.final_tax_form_complete    THEN 1 ELSE 0 END)
        AS completed
  ) c
) calc
WHERE fcs.id = calc.id;

COMMIT;
