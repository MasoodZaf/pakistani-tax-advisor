-- phase-z19: retire two reliefs the app grants that the law does not, and add
--            the s.60D limb it was missing.
--
-- Every change here is a tax_rates_config data change with an FBR/statutory
-- citation. No code, no rate invented. Sourced from FBR + PwC Pakistan
-- (Worldwide Tax Summaries, reviewed 19-Jan-2026) and the Finance Act 2025
-- commentary — see the per-item references below.
--
-- ===========================================================================
-- 1. TEACHER / RESEARCHER 25% REBATE — EXPIRED FOR TAX YEAR 2026
-- ===========================================================================
-- History, because the record is genuinely confusing:
--   * The rebate lived in clause (2), Part III, Second Schedule.
--   * Finance Act 2022 OMITTED it entirely.
--   * In Nov-2024 FBR issued notices treating TY2023/TY2024 claims as invalid.
--   * Finance Act 2025 restored it RETROSPECTIVELY via a NEW clause (3A),
--     Part III, Second Schedule — "deemed effective from 1 July 2022" and
--     "shall cease to have effect after 30 June 2025".
--
-- So the rebate is available for TAX YEARS 2023, 2024 and 2025 ONLY, and is
-- NOT available for TAX YEAR 2026 ONWARDS.
--
-- ⚠ THE YEAR LABELS MATTER AND ARE EASY TO GET BACKWARDS:
--   Pakistan's "tax year 2026" = 1 Jul 2025 – 30 Jun 2026 = this app's '2025-26'
--   Pakistan's "tax year 2025" = 1 Jul 2024 – 30 Jun 2025 = this app's '2024-25'
-- The app's CURRENT filing year ('2025-26') is therefore exactly the first year
-- in which the rebate does NOT exist — while the app has been granting it at
-- 25%, understating tax for every teacher and researcher who claimed it.
--
-- Action: deactivate for '2025-26'. LEAVE '2024-25' ACTIVE — the rebate is
-- lawful there and deactivating it would over-charge anyone still filing or
-- revising TY2025 (which they may do until ~30 Sep 2026, i.e. right now).
--
-- The citation was also wrong: the rows cite "ITO 2001 s.100C", which is the
-- NON-PROFIT ORGANISATION tax credit (100% credit for NPOs/trusts/welfare
-- societies u/s 100C) and has nothing to do with teachers. Corrected to the
-- Second Schedule clause on the row that remains.
--
-- ===========================================================================
-- 2. "PROFESSIONAL EXPENSES u/s 60C" — NO STATUTORY BASIS
-- ===========================================================================
-- The three prof_expenses_* rows cite "ITO 2001 s.60C" and implement
-- min(5% of POS amount, 25% of taxable income) for taxable income <= Rs 1.5M.
-- Both halves of that are wrong:
--
--   (a) s.60C was the DEDUCTIBLE ALLOWANCE FOR PROFIT ON DEBT — the allowance
--       for profit/share in rent paid on a loan used to construct or acquire a
--       house, capped at the lower of 50% of taxable income or Rs 2,000,000.
--       It was never about professional or point-of-sale expenses.
--   (b) s.60C was OMITTED by Finance Act 2022 and is not in force.
--
--   (Finance Act 2025 did reintroduce a HOUSING-LOAN relief, but as a TAX
--    CREDIT — profit on debt on a house up to 2,500 sq ft or a flat up to
--    2,000 sq ft, not claimable again for 15 years. That is a credit against
--    tax, NOT this deductible allowance, and it is not implemented here. It is
--    a genuine missing FEATURE, listed in the app's residual risk — not a
--    justification for these rows.)
--
-- The giveaway is the numbers themselves: 5% and 25% with a Rs 1.5M threshold
-- are limbs (a) and (b) of s.60D (education expenses) — see item 3. These rows
-- are s.60D mis-transcribed into a deduction that does not exist, and their
-- effect is to grant relief with no legal basis, i.e. to UNDERSTATE tax.
-- Measured live on staging before this migration: a salary of 1,400,000 with
-- "professional expenses" of 1,000,000 had its tax cut from Rs 28,000 to
-- Rs 4,500 on the strength of these rows alone.
--
-- Action: deactivate for BOTH years. Nothing is deleted, so the rows and this
-- explanation survive for review, and reactivating is one UPDATE if the owner's
-- tax counsel identifies a basis we could not find.
--
-- ===========================================================================
-- 3. s.60D — THE MISSING LIMBS
-- ===========================================================================
-- s.60D allows a deductible allowance for TUITION FEE paid, capped at the
-- LEAST of:
--     (a) 5% of the total tuition fee paid
--     (b) 25% of the individual's taxable income
--     (c) Rs 60,000 x number of children
-- The app configured only (c). Limb (a) is added here as a distinct row, and
-- limb (b) — which the engine already looks for under the key
-- education_taxable_income_pct — is seeded so it starts binding with no code
-- change. Both values (5%, 25%) are the ones previously mislabelled as
-- prof_expenses_*, now placed on the section they actually belong to.
--
-- ⚠ NOT CHANGED, NEEDS THE PRIMARY TEXT: the threshold. Sources disagree on
-- whether s.60D(2) reads "less than" Rs 1,500,000 or "does not exceed" it. The
-- app currently enforces strict "<". The difference affects exactly one
-- taxpayer — the one whose taxable income is precisely Rs 1,500,000 — so it is
-- left as-is rather than flipped on a secondary source. Flagged for counsel.
--
-- Apply:  psql -d tax_advisor -f backend/database/migrations/phase-z19-fa2025-expired-and-misattributed-reliefs.sql
--
-- IDEMPOTENT AND RE-RUNNABLE: UPDATEs are absolute assignments, and the two
-- INSERTs use DELETE-then-INSERT (the pattern already used by the CGT seeds),
-- so the end state is identical however many times this runs.
--
-- ROLLBACK (restores the pre-migration behaviour, i.e. re-introduces both
-- unlawful reliefs — an availability escape hatch, not a correctness one):
--     UPDATE tax_rates_config SET is_active = true
--      WHERE tax_year = '2025-26' AND rate_category = 'teacher_researcher';
--     UPDATE tax_rates_config SET is_active = true
--      WHERE rate_category LIKE 'prof_expenses%';
--     DELETE FROM tax_rates_config
--      WHERE rate_category IN ('education_tuition_fee_pct','education_taxable_income_pct');

BEGIN;

-- 1 ---------------------------------------------- teacher rebate: TY2026 only
UPDATE tax_rates_config
   SET is_active = false,
       description = 'EXPIRED for tax year 2026 onwards. Clause (3A), Part III, '
                  || 'Second Schedule (inserted by Finance Act 2025) restored the '
                  || '25% rebate retrospectively from 1-Jul-2022 but it ceases to '
                  || 'have effect after 30-Jun-2025. Tax year 2026 = 1-Jul-2025 to '
                  || '30-Jun-2026 = this row''s 2025-26. Do NOT reactivate without '
                  || 'a Finance Act that extends it.',
       fbr_reference = '2nd Sched Pt III cl.(3A) — ceased after 30-Jun-2025 (FA 2025)'
 WHERE tax_year = '2025-26'
   AND rate_type = 'reduction'
   AND rate_category = 'teacher_researcher';

-- Correct the citation on the year where the rebate IS lawful. s.100C is the
-- NPO credit; it was never the authority for this rebate.
UPDATE tax_rates_config
   SET fbr_reference = '2nd Sched Pt III cl.(3A) (FA 2025, retrospective from 1-Jul-2022)',
       description = 'Full-time teacher/researcher at an HEC/Board-recognised '
                  || 'non-profit education or research institution: 25% reduction '
                  || 'in tax payable on salary income. Lawful for tax years 2023, '
                  || '2024 and 2025 only.'
 WHERE tax_year = '2024-25'
   AND rate_type = 'reduction'
   AND rate_category = 'teacher_researcher';

-- 2 ------------------------------------ "professional expenses u/s 60C": gone
UPDATE tax_rates_config
   SET is_active = false,
       description = 'DISABLED — no statutory basis. Cited s.60C, which was the '
                  || 'deductible allowance for PROFIT ON DEBT (house '
                  || 'construction/acquisition, capped at the lower of 50% of '
                  || 'taxable income or Rs 2,000,000) and was OMITTED by Finance '
                  || 'Act 2022. s.60C never covered professional or point-of-sale '
                  || 'expenses. The 5%/25%/Rs1.5M values here are s.60D''s own '
                  || 'limbs, mis-transcribed onto a deduction that does not exist. '
                  || 'Effect was to understate tax. See phase-z19 header.',
       fbr_reference = 'NO BASIS — s.60C omitted by FA 2022; never covered these expenses'
 WHERE rate_type = 'deduction_threshold'
   AND rate_category LIKE 'prof_expenses%';

-- 3 ------------------------------------------------- s.60D limbs (a) and (b)
-- Limb (a): 5% of the total tuition fee paid.
DELETE FROM tax_rates_config
 WHERE rate_type = 'deduction_threshold'
   AND rate_category = 'education_tuition_fee_pct';

INSERT INTO tax_rates_config
  (tax_year, rate_type, rate_category, tax_rate, min_amount, max_amount,
   fixed_amount, description, fbr_reference, is_active)
SELECT y.tax_year, 'deduction_threshold', 'education_tuition_fee_pct',
       0.05, 0, 0, 0,
       's.60D limb (a): allowance capped at 5% of the total tuition fee paid. '
       || 'Applied as the LEAST of (a) 5% of tuition fee, (b) 25% of taxable '
       || 'income, (c) Rs 60,000 x children.',
       'ITO 2001 s.60D', true
  FROM (SELECT DISTINCT tax_year FROM tax_rates_config
         WHERE tax_year IN ('2024-25','2025-26')) y;

-- Limb (b): 25% of taxable income. The engine already looks for this key and
-- currently skips the limb because no row exists.
DELETE FROM tax_rates_config
 WHERE rate_type = 'deduction_threshold'
   AND rate_category = 'education_taxable_income_pct';

INSERT INTO tax_rates_config
  (tax_year, rate_type, rate_category, tax_rate, min_amount, max_amount,
   fixed_amount, description, fbr_reference, is_active)
SELECT y.tax_year, 'deduction_threshold', 'education_taxable_income_pct',
       0.25, 0, 0, 0,
       's.60D limb (b): allowance capped at 25% of the individual''s taxable '
       || 'income. Applied as the LEAST of limbs (a), (b) and (c).',
       'ITO 2001 s.60D', true
  FROM (SELECT DISTINCT tax_year FROM tax_rates_config
         WHERE tax_year IN ('2024-25','2025-26')) y;

-- Report what changed, so a hand-apply shows its work.
DO $$
DECLARE
  teacher_2526 int;
  prof_active  int;
  edu_limbs    int;
BEGIN
  SELECT count(*) INTO teacher_2526 FROM tax_rates_config
   WHERE tax_year='2025-26' AND rate_category='teacher_researcher' AND is_active;
  SELECT count(*) INTO prof_active FROM tax_rates_config
   WHERE rate_category LIKE 'prof_expenses%' AND is_active;
  SELECT count(*) INTO edu_limbs FROM tax_rates_config
   WHERE rate_category IN ('education_tuition_fee_pct','education_taxable_income_pct')
     AND is_active;

  IF teacher_2526 <> 0 THEN
    RAISE EXCEPTION 'phase-z19: teacher_researcher still ACTIVE for 2025-26 (expected 0, got %)', teacher_2526;
  END IF;
  IF prof_active <> 0 THEN
    RAISE EXCEPTION 'phase-z19: prof_expenses_* still ACTIVE (expected 0, got %)', prof_active;
  END IF;
  IF edu_limbs <> 4 THEN
    RAISE EXCEPTION 'phase-z19: expected 4 s.60D limb rows (2 limbs x 2 years), got %', edu_limbs;
  END IF;

  RAISE NOTICE 'phase-z19: teacher rebate OFF for 2025-26 (kept for 2024-25), prof_expenses_* OFF for both years, s.60D limbs (a)+(b) seeded for both years.';
END $$;

COMMIT;
