-- phase-z17: s.60C professional-expenses input + the non-ATL rate question.
--
-- Apply:  psql -d tax_advisor -f backend/database/migrations/phase-z17-professional-expenses-and-non-atl-rates.sql
--
-- IDEMPOTENT AND RE-RUNNABLE: ADD COLUMN IF NOT EXISTS, and the rate seed uses
-- the DELETE-then-INSERT pattern established by phase-h-cgt-rate-seeds.sql,
-- which converges to the same single row however many times it runs.
--
-- ROLLBACK:
--   ALTER TABLE deductions_forms DROP COLUMN IF EXISTS professional_expenses_pos_amount;
--   DELETE FROM tax_rates_config WHERE tax_year='2025-26'
--     AND rate_type='final_tax' AND rate_category='profit_debt_15_final_non_atl';

BEGIN;

-- 1 -------------------------------------------------- s.60C professional expenses
-- Placed on deductions_forms alongside tuition_fee_amount (phase-z14): both are
-- deductible-allowance INPUTS, not components of the zakat/ushr/foreign-tax
-- total. Deliberately NOT added to the total_deductions generated column for
-- the same reason.
--
-- NAME: 'pos_amount' is carried over verbatim from the shared contract's
-- capProfessionalU60C(taxableIncome, posAmount). The expansion of "POS" is not
-- documented anywhere in the repo and I did not invent one — if it turns out to
-- mean something specific, rename before lane D builds a field label around it.
ALTER TABLE deductions_forms
  ADD COLUMN IF NOT EXISTS professional_expenses_pos_amount NUMERIC(15,2) DEFAULT 0;

COMMENT ON COLUMN deductions_forms.professional_expenses_pos_amount IS
  'Professional-expenses input for the s.60C allowance: least of (5% of this amount, 25% of taxable income), and only where taxable income is LESS THAN Rs 1,500,000. THE RATE IS NOT SEEDED — the s.60C / s.100C citation conflict is flagged out of scope in REMEDIATION-PLAN.md and needs an owner/legal decision. Storing the input is safe; computing an allowance from an invented rate is not.';

-- 2 ---------------------------- profit on debt u/s 151, non-ATL — WITHDRAWN
-- An earlier revision of this migration seeded
--   ('2025-26','final_tax','profit_debt_15_final_non_atl', 0.400, …)
-- derived from Tenth Schedule Rule 1 (non-ATL rates increased by 100%) applied
-- to the seeded filer rate of 0.20.
--
-- IT HAS BEEN REMOVED, on the reasoning that flagged it in the first place: the
-- doubling is a RULE, and seeding it per-head duplicates that rule 27+ times and
-- will drift the moment a filer rate changes. Worse, a derived scalar sitting in
-- a rate table is indistinguishable to the next reader from one transcribed off
-- an FBR rate card — and this codebase keeps getting hurt by exactly that
-- confusion. Rule 1 is routed to lane B as a mechanism over the filer rate.
--
-- The interim state is deliberately the honest one: with no row present, lane C
-- raises its `nonAtlRateMissing` flag rather than quietly charging a non-filer
-- the filer rate.
--
-- The DELETE stays (with no INSERT after it) so that any environment which
-- already applied the earlier revision converges — this is what removes the row.
DELETE FROM tax_rates_config
 WHERE tax_year = '2025-26'
   AND rate_type = 'final_tax'
   AND rate_category = 'profit_debt_15_final_non_atl';

-- 3 ----------------------------------------- DELIBERATELY NOT SEEDED (flagged)
--
-- (a) Immovable property acquired on/after 1-Jul-2024, NON-ATL.
--     Not seeded because it is not a flat rate and therefore cannot be one row.
--     Where the ATL case is a flat 15% irrespective of holding period, the
--     non-ATL case is charged at the NORMAL SLAB RATES under Division I of
--     Part I of the First Schedule — a progressive mechanism, subject to a
--     floor. Seeding any single scalar here would be wrong by construction, and
--     picking one would silently mis-rate every non-filer property disposal.
--     Needs a mechanism decision (likely: resolve through the existing slab
--     engine rather than tax_rates_config), not a number.
--     => OWNER/LANE B DECISION REQUIRED. capital_gain_disposals.rate_category
--        can already carry a distinct value for it once the mechanism is fixed.
--
-- (b) education_taxable_income_pct.
--     Not seeded, on the same footing as the s.60C / s.100C rate: the plan says
--     do not invent a rate, and I have no sourced value for it.
--     => OWNER DECISION REQUIRED.

COMMIT;
