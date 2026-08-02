-- phase-z20: make the three open legal questions ANSWERABLE IN THE APP, and add
--            the storage the FA-2025 housing-loan credit needs.
--
-- Context: phase-z19 retired two reliefs the law no longer grants and recorded
-- three questions its research could not settle from a primary source. Those
-- questions were written up in a report, which means the app was silently
-- shipping one particular answer to each of them with no way for the owner or
-- their tax counsel to review or change it.
--
-- This migration adds what is needed for those decisions to live in the
-- application, at Admin -> Statutory Reliefs:
--
--   1. `deduction_threshold/education_threshold_inclusive` — the s.60D(2)
--      comparison operator, as data rather than as a `<` in the source.
--   2. `credits_forms.housing_loan_*` — the columns the FA-2025 housing-loan
--      profit-on-debt TAX CREDIT needs, plus regeneration of `total_credits` so
--      the new credit is actually counted.
--
-- NOTHING here enables a relief. The threshold row is seeded with the strict
-- reading that already ships, and the housing-loan credit has NO rate row at
-- all, so it stays switched off and its input stays hidden until the owner
-- supplies the statutory parameters. Adding storage is not the same as granting
-- relief, and the conservative default is what a missing answer must produce.
--
-- ===========================================================================
-- 1. s.60D(2) THRESHOLD OPERATOR — "less than" vs "does not exceed"
-- ===========================================================================
-- Sources disagree on the wording. It changes the answer for exactly one
-- taxpayer: the one whose taxable income is precisely Rs 1,500,000. Below the
-- threshold both readings allow the allowance; above it, neither does.
--
-- tax_rate = 0 -> strict `<`   (a taxpayer AT the threshold is NOT eligible)
-- tax_rate = 1 -> inclusive `<=` (a taxpayer AT the threshold IS eligible)
--
-- Seeded at 0, which is what the code did before this row existed, so applying
-- this migration changes no taxpayer's liability. `statutoryLimits.js` also
-- treats an ABSENT row as strict, so the two agree and neither widens a relief
-- on account of missing configuration.
--
-- ===========================================================================
-- 2. FA-2025 HOUSING-LOAN PROFIT-ON-DEBT TAX CREDIT — storage only
-- ===========================================================================
-- The repealed s.60C gave a DEDUCTIBLE ALLOWANCE for profit on debt on a house.
-- Finance Act 2025 brought housing relief back as a TAX CREDIT instead — profit
-- on debt on a house up to 2,500 sq ft or a flat up to 2,000 sq ft, not
-- claimable again for 15 years.
--
-- The app does not implement it, so this is the one item in the phase-z19
-- research that runs AGAINST the taxpayer: anyone entitled to the credit is
-- currently over-paying. The reason it is not simply switched on here is that
-- the research could not establish the quantum from a primary source, and a
-- guessed ceiling on a credit is precisely the error that produced the bogus
-- "professional expenses u/s 60C" allowance in the first place.
--
-- So: three columns, `total_credits` regenerated to include the credit, and no
-- rate row. `capHousingLoanProfitCredit()` returns 0 with no configuration and
-- the Credits form does not render the input. The owner enables it by supplying
-- the parameters, with an audit entry naming the authority.
--
-- ⚠ REGENERATING `total_credits` — THE TRAP THAT BIT phase-z15
-- -----------------------------------------------------------
-- `total_credits` is a GENERATED STORED column and it CANNOT be altered in
-- place; it has to be dropped and recreated. Its component list differs between
-- environments (fresh installs from schema.sql vs databases that have been
-- through phase-t/phase-u), so hardcoding the expression breaks on whichever
-- environment was not the one it was written against. phase-z15 was written
-- against a schema.sql-only database and would have failed on BOTH prod and
-- staging.
--
-- This migration therefore INTROSPECTS the existing expression, appends one
-- term to it, and aborts by name if it cannot read what it is replacing. It
-- never installs a partial sum.
--
-- Apply:
--   psql -d tax_advisor -f backend/database/migrations/phase-z20-housing-loan-credit-and-relief-settings.sql
--
-- IDEMPOTENT: ADD COLUMN IF NOT EXISTS; the seed is DELETE-then-INSERT; the
-- regeneration is skipped when the column already includes the new term.
--
-- ROLLBACK:
--   ALTER TABLE credits_forms DROP COLUMN IF EXISTS housing_loan_profit_yn;
--   ALTER TABLE credits_forms DROP COLUMN IF EXISTS housing_loan_profit_amount;
--   -- (drop + recreate total_credits WITHOUT the housing_loan_profit_tax_credit
--   --  term first, then drop that column)
--   DELETE FROM tax_rates_config
--    WHERE rate_category = 'education_threshold_inclusive';
--   DELETE FROM tax_rates_config
--    WHERE rate_category = 'housing_loan_profit_on_debt';

BEGIN;

-- 1 ------------------------------------------- s.60D threshold operator as data
DELETE FROM tax_rates_config
 WHERE rate_type = 'deduction_threshold'
   AND rate_category = 'education_threshold_inclusive';

INSERT INTO tax_rates_config
  (tax_year, rate_type, rate_category, tax_rate, min_amount, max_amount,
   fixed_amount, description, fbr_reference, is_active)
SELECT y.tax_year, 'deduction_threshold', 'education_threshold_inclusive',
       0, 0, 0, 0,
       'How to read the s.60D(2) income threshold. 0 = "less than" Rs 1,500,000 '
       || '(strict: a taxpayer AT the threshold is NOT eligible). 1 = "does not '
       || 'exceed" (inclusive: a taxpayer AT the threshold IS eligible). Sources '
       || 'disagree on the wording; the strict reading ships because it declines '
       || 'a relief at the boundary rather than granting one that may not exist. '
       || 'Editable at Admin -> Statutory Reliefs — record the authority in the '
       || 'note when changing it.',
       'ITO 2001 s.60D(2) — wording unsettled, see description', true
  FROM (SELECT DISTINCT tax_year FROM tax_rates_config
         WHERE tax_year IN ('2024-25','2025-26')) y;

-- 2 --------------------------------- housing-loan credit: columns, no rate row
ALTER TABLE credits_forms
  ADD COLUMN IF NOT EXISTS housing_loan_profit_yn VARCHAR(1) DEFAULT '-';
ALTER TABLE credits_forms
  ADD COLUMN IF NOT EXISTS housing_loan_profit_amount DECIMAL(15,2) DEFAULT 0;
ALTER TABLE credits_forms
  ADD COLUMN IF NOT EXISTS housing_loan_profit_tax_credit DECIMAL(15,2) DEFAULT 0;

DO $$
DECLARE
  current_expr text;
  is_gen       text;
  new_expr     text;
BEGIN
  SELECT generation_expression, is_generated
    INTO current_expr, is_gen
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name  = 'credits_forms'
     AND column_name = 'total_credits';

  IF current_expr IS NULL THEN
    RAISE EXCEPTION
      'phase-z20: credits_forms.total_credits not found. Refusing to guess the '
      'credit total — apply phase-t/phase-u first.';
  END IF;

  IF is_gen <> 'ALWAYS' THEN
    -- Some environments carry total_credits as an ordinary column written by the
    -- application instead of a generated one. Nothing to regenerate there, and
    -- silently converting it would change how every existing row behaves.
    RAISE NOTICE
      'phase-z20: credits_forms.total_credits is not GENERATED in this database; '
      'leaving it alone. The new credit is summed by the application layer, which '
      'derives its component set by introspection.';
    RETURN;
  END IF;

  IF position('housing_loan_profit_tax_credit' in current_expr) > 0 THEN
    RAISE NOTICE 'phase-z20: total_credits already includes the housing-loan credit; skipping.';
    RETURN;
  END IF;

  -- Append exactly ONE term to whatever this database actually has. The existing
  -- expression is never rewritten, so environments that differ stay different in
  -- the ways they legitimately differ.
  new_expr := '(' || current_expr || ' + COALESCE(housing_loan_profit_tax_credit, (0)::numeric))';

  EXECUTE 'ALTER TABLE credits_forms DROP COLUMN total_credits';
  EXECUTE 'ALTER TABLE credits_forms ADD COLUMN total_credits DECIMAL(15,2) '
       || 'GENERATED ALWAYS AS ' || new_expr || ' STORED';

  RAISE NOTICE 'phase-z20: total_credits regenerated with the housing-loan credit term.';
END $$;

-- Verify the end state, so a hand-apply shows its work and a partial apply fails
-- loudly instead of looking successful.
DO $$
DECLARE
  threshold_rows int;
  housing_rate   int;
  cols           int;
BEGIN
  SELECT count(*) INTO threshold_rows FROM tax_rates_config
   WHERE rate_category = 'education_threshold_inclusive' AND is_active AND tax_rate = 0;
  SELECT count(*) INTO housing_rate FROM tax_rates_config
   WHERE rate_category = 'housing_loan_profit_on_debt';
  SELECT count(*) INTO cols FROM information_schema.columns
   WHERE table_schema='public' AND table_name='credits_forms'
     AND column_name IN ('housing_loan_profit_yn','housing_loan_profit_amount',
                         'housing_loan_profit_tax_credit');

  IF threshold_rows <> 2 THEN
    RAISE EXCEPTION 'phase-z20: expected 2 threshold-operator rows seeded strict, got %', threshold_rows;
  END IF;
  IF housing_rate <> 0 THEN
    RAISE EXCEPTION
      'phase-z20: a housing_loan_profit_on_debt rate row exists (%). This migration must '
      'NOT enable the credit — its quantum is an open question for the owner''s counsel.',
      housing_rate;
  END IF;
  IF cols <> 3 THEN
    RAISE EXCEPTION 'phase-z20: expected 3 housing-loan columns on credits_forms, got %', cols;
  END IF;

  RAISE NOTICE 'phase-z20: s.60D operator seeded STRICT (no liability change); housing-loan credit storage ready and DISABLED pending counsel.';
END $$;

COMMIT;
