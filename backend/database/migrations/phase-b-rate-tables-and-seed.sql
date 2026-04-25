-- Phase B: unify tax rates under tax_rates_config (+ tax_slabs for slabs).
-- Removes stale duplicate progressive rows, fixes FA 2025 drift, adds missing
-- rate kinds (super_tax, credit_cap, deduction_threshold, final_tax fixes).
--
-- Safe to re-run: idempotent via DELETE-then-INSERT per rate_type+tax_year scope.
-- Apply:  psql -d tax_advisor -f backend/database/migrations/phase-b-rate-tables-and-seed.sql

BEGIN;

-- ──────────────────────────────────────────────────────────────────────────
-- 1. Remove the stale `progressive` rows from tax_rates_config.
--    tax_slabs is the authoritative source for slab data. Keeping both leads
--    to silent drift — the tax_rates_config rows had pre-FA-2025 boundaries.
-- ──────────────────────────────────────────────────────────────────────────
DELETE FROM tax_rates_config WHERE rate_type = 'progressive';

-- ──────────────────────────────────────────────────────────────────────────
-- 2. Fix FA 2025 drift on existing rows.
-- ──────────────────────────────────────────────────────────────────────────
-- Profit on debt u/s 151 (individual, final tax): FA 2025 raised from 15% to 20%.
UPDATE tax_rates_config
   SET tax_rate = 0.20, description = 'Profit on debt u/s 151, final tax (individual) — FA 2025: 20%'
 WHERE tax_year = '2025-26' AND rate_type = 'final_tax' AND rate_category = 'profit_debt_15_final';

-- ──────────────────────────────────────────────────────────────────────────
-- 3. Super tax u/s 4C (Finance Act 2025, Division IIA First Schedule).
--    Flat rate on total taxable income when income > threshold per tier.
-- ──────────────────────────────────────────────────────────────────────────
DELETE FROM tax_rates_config WHERE tax_year = '2025-26' AND rate_type = 'super_tax';

INSERT INTO tax_rates_config (tax_year, rate_type, rate_category, tax_rate, min_amount, max_amount, fixed_amount, description, fbr_reference, is_active)
VALUES
  ('2025-26', 'super_tax', 'tier_1', 0.01, 150000001, 200000000, 0, '1% on income 150M-200M', 'ITO 2001 s.4C, Division IIA', true),
  ('2025-26', 'super_tax', 'tier_2', 0.02, 200000001, 250000000, 0, '2% on income 200M-250M', 'ITO 2001 s.4C, Division IIA', true),
  ('2025-26', 'super_tax', 'tier_3', 0.03, 250000001, 300000000, 0, '3% on income 250M-300M', 'ITO 2001 s.4C, Division IIA', true),
  ('2025-26', 'super_tax', 'tier_4', 0.04, 300000001, 350000000, 0, '4% on income 300M-350M', 'ITO 2001 s.4C, Division IIA', true),
  ('2025-26', 'super_tax', 'tier_5', 0.06, 350000001, 400000000, 0, '6% on income 350M-400M', 'ITO 2001 s.4C, Division IIA', true),
  ('2025-26', 'super_tax', 'tier_6', 0.08, 400000001, 500000000, 0, '8% on income 400M-500M', 'ITO 2001 s.4C, Division IIA', true),
  ('2025-26', 'super_tax', 'tier_7', 0.10, 500000001, 999999999999, 0, '10% on income > 500M', 'ITO 2001 s.4C, Division IIA', true);

-- ──────────────────────────────────────────────────────────────────────────
-- 4. Tax credit caps (eligibility caps as % of taxable income).
--    tax_rate column reused as the cap ratio (e.g. 0.30 = 30% of taxable income).
-- ──────────────────────────────────────────────────────────────────────────
DELETE FROM tax_rates_config WHERE tax_year = '2025-26' AND rate_type = 'credit_cap';

INSERT INTO tax_rates_config (tax_year, rate_type, rate_category, tax_rate, min_amount, max_amount, fixed_amount, description, fbr_reference, is_active)
VALUES
  ('2025-26', 'credit_cap', 'donation_u61',           0.30, 0, 999999999999, 0, 'Charitable donation cap u/s 61: 30% of taxable income', 'ITO 2001 s.61', true),
  ('2025-26', 'credit_cap', 'donation_u61_associate', 0.15, 0, 999999999999, 0, 'Donation to associate u/s 61: 15% of taxable income', 'ITO 2001 s.61 proviso', true),
  ('2025-26', 'credit_cap', 'pension_u63',            0.20, 0, 999999999999, 0, 'Voluntary pension contribution u/s 63: 20% of taxable income', 'ITO 2001 s.63', true);

-- ──────────────────────────────────────────────────────────────────────────
-- 5. Deduction thresholds & caps.
--    fixed_amount column stores absolute thresholds; tax_rate stores ratios.
-- ──────────────────────────────────────────────────────────────────────────
DELETE FROM tax_rates_config WHERE tax_year = '2025-26' AND rate_type = 'deduction_threshold';

INSERT INTO tax_rates_config (tax_year, rate_type, rate_category, tax_rate, min_amount, max_amount, fixed_amount, description, fbr_reference, is_active)
VALUES
  ('2025-26', 'deduction_threshold', 'prof_expenses_max_taxable_income',  0,    0, 0, 1500000, 'Prof. expenses (POS) deduction requires taxable income up to Rs 1.5M', 'ITO 2001 s.60C', true),
  ('2025-26', 'deduction_threshold', 'prof_expenses_pos_amount_pct',      0.05, 0, 0, 0,       'Prof. expenses deduction: min(5% POS amount, 25% taxable income)',     'ITO 2001 s.60C', true),
  ('2025-26', 'deduction_threshold', 'prof_expenses_taxable_income_pct',  0.25, 0, 0, 0,       'Prof. expenses deduction: min(5% POS amount, 25% taxable income)',     'ITO 2001 s.60C', true),
  ('2025-26', 'deduction_threshold', 'education_max_taxable_income',      0,    0, 0, 1500000, 'Education expense deduction requires taxable income up to Rs 1.5M',    'ITO 2001 s.60D', true),
  ('2025-26', 'deduction_threshold', 'education_per_child_cap',           0,    0, 0, 60000,   'Education expense: Rs 60,000 per child (max 2 children)',              'ITO 2001 s.60D', true),
  ('2025-26', 'deduction_threshold', 'education_max_children',            0,    0, 0, 2,       'Education expense deduction: maximum 2 children',                      'ITO 2001 s.60D', true);

-- ──────────────────────────────────────────────────────────────────────────
-- 6. Reductions (tax-reduction rates, not income deductions).
-- ──────────────────────────────────────────────────────────────────────────
DELETE FROM tax_rates_config WHERE tax_year = '2025-26' AND rate_type = 'reduction';

INSERT INTO tax_rates_config (tax_year, rate_type, rate_category, tax_rate, min_amount, max_amount, fixed_amount, description, fbr_reference, is_active)
VALUES
  ('2025-26', 'reduction', 'teacher_researcher',             0.25, 0, 0, 0, 'Full-time teacher/researcher: 25% tax reduction on salary tax',  'ITO 2001 s.100C', true),
  ('2025-26', 'reduction', 'behbood_certificate_max_rate',   0.05, 0, 0, 0, 'Behbood certificate profit: tax not to exceed 5% of profit',    'ITO 2001 2nd Sched Pt III cl.6', true),
  ('2025-26', 'reduction', 'capital_gain_immovable_ex_serv_50', 0.50, 0, 0, 0, 'Capital gain on immovable property: 50% reduction (ex-serviceman, War wounded)', '2nd Sched Pt III cl.9A', true),
  ('2025-26', 'reduction', 'capital_gain_immovable_ex_serv_75', 0.75, 0, 0, 0, 'Capital gain on immovable property: 75% reduction (ex-serviceman, War wounded)', '2nd Sched Pt III cl.9A', true);

-- ──────────────────────────────────────────────────────────────────────────
-- 7. Back-fill TY 2024-25 rates for users who have existing data.
--    Conservative subset: surcharge, super_tax (had same tiers), credit_caps,
--    deduction thresholds. Rate values specific to FY 2024-25 where they differ.
-- ──────────────────────────────────────────────────────────────────────────
DELETE FROM tax_rates_config WHERE tax_year = '2024-25' AND rate_type IN ('super_tax', 'credit_cap', 'deduction_threshold', 'reduction', 'surcharge');

-- Surcharge (10% per pre-FA-2025 — note rate differs from 2025-26)
INSERT INTO tax_rates_config (tax_year, rate_type, rate_category, tax_rate, min_amount, max_amount, fixed_amount, description, fbr_reference, is_active)
VALUES ('2024-25', 'surcharge', 'salaried_above_10m', 0.10, 10000000, 999999999999, 0, 'Surcharge 10% for salaried above Rs 10M (pre-FA-2025)', 'Finance Act 2024', true);

-- Super tax 2024-25: same tiers as 2025-26 per 4C
INSERT INTO tax_rates_config (tax_year, rate_type, rate_category, tax_rate, min_amount, max_amount, fixed_amount, description, fbr_reference, is_active)
SELECT '2024-25', rate_type, rate_category, tax_rate, min_amount, max_amount, fixed_amount, description, fbr_reference, is_active
  FROM tax_rates_config
 WHERE tax_year = '2025-26' AND rate_type IN ('super_tax', 'credit_cap', 'deduction_threshold', 'reduction');

-- ──────────────────────────────────────────────────────────────────────────
-- 8. Helper view: which tax years have a complete rate set?
--    "Complete" = slabs + surcharge + super_tax all seeded. Used by the
--    frontend year dropdown ("no advance filing — current year only").
-- ──────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW tax_years_filable AS
SELECT ty.id, ty.tax_year, ty.is_current, ty.is_active
  FROM tax_years ty
 WHERE ty.is_active = true
   AND EXISTS (SELECT 1 FROM tax_slabs ts WHERE ts.tax_year_id = ty.id AND ts.slab_type = 'individual')
   AND EXISTS (SELECT 1 FROM tax_rates_config rc WHERE rc.tax_year = ty.tax_year AND rc.rate_type = 'surcharge' AND rc.is_active)
   AND EXISTS (SELECT 1 FROM tax_rates_config rc WHERE rc.tax_year = ty.tax_year AND rc.rate_type = 'super_tax' AND rc.is_active);

COMMIT;

-- Post-apply verification (run manually):
-- SELECT tax_year, rate_type, COUNT(*) FROM tax_rates_config GROUP BY tax_year, rate_type ORDER BY 1, 2;
-- SELECT * FROM tax_years_filable;
