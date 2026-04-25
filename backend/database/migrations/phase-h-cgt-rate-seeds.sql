-- Phase H: seed CGT per-category rates that CapitalGainsForm auto-calculates.
-- Before this, the form hardcoded 15 rate literals; they now move to DB.
--
-- Categories mirror the frontend item.id values for a clean 1:1 lookup.
-- The previously-seeded property_atl_post_july_2024 / securities_* rows are
-- left in place — they represent separate FA 2025 dimensions the form will
-- expose in a later sprint (post-Jul-2024 acquisition cohort, filer status).
--
-- Apply:  psql -d tax_advisor -f backend/database/migrations/phase-h-cgt-rate-seeds.sql

BEGIN;

DELETE FROM tax_rates_config
 WHERE tax_year = '2025-26'
   AND rate_type = 'capital_gains'
   AND rate_category IN (
     'immovable_property_1_year',
     'immovable_property_2_years',
     'immovable_property_3_years',
     'immovable_property_4_years',
     'immovable_property_5_years',
     'immovable_property_6_years',
     'immovable_property_over_6_years',
     'securities_before_july_2013',
     'securities_pmex_settled',
     'securities_37a_7_5_percent',
     'securities_mutual_funds_10_percent',
     'securities_mutual_funds_12_5_percent',
     'securities_other_25_percent',
     'securities_12_5_percent_before_july_2022',
     'securities_15_percent'
   );

INSERT INTO tax_rates_config
  (tax_year, rate_type, rate_category, tax_rate, min_amount, max_amount, fixed_amount, description, fbr_reference, is_active)
VALUES
  -- Immovable property u/s 37(1A) — acquired BEFORE 1-Jul-2024, graduated by holding period.
  ('2025-26', 'capital_gains', 'immovable_property_1_year',              0.150, 0, 999999999999, 0, 'Immovable property u/s 37(1A) — holding ≤ 1 year',        'ITO 2001 s.37(1A)', true),
  ('2025-26', 'capital_gains', 'immovable_property_2_years',             0.125, 0, 999999999999, 0, 'Immovable property — holding 1-2 years',                  'ITO 2001 s.37(1A)', true),
  ('2025-26', 'capital_gains', 'immovable_property_3_years',             0.100, 0, 999999999999, 0, 'Immovable property — holding 2-3 years',                  'ITO 2001 s.37(1A)', true),
  ('2025-26', 'capital_gains', 'immovable_property_4_years',             0.075, 0, 999999999999, 0, 'Immovable property — holding 3-4 years',                  'ITO 2001 s.37(1A)', true),
  ('2025-26', 'capital_gains', 'immovable_property_5_years',             0.050, 0, 999999999999, 0, 'Immovable property — holding 4-5 years',                  'ITO 2001 s.37(1A)', true),
  ('2025-26', 'capital_gains', 'immovable_property_6_years',             0.025, 0, 999999999999, 0, 'Immovable property — holding 5-6 years',                  'ITO 2001 s.37(1A)', true),
  ('2025-26', 'capital_gains', 'immovable_property_over_6_years',        0.000, 0, 999999999999, 0, 'Immovable property — holding > 6 years (exempt)',         'ITO 2001 s.37(1A)', true),
  -- Securities u/s 37A — various.
  ('2025-26', 'capital_gains', 'securities_before_july_2013',            0.050, 0, 999999999999, 0, 'Securities acquired before 1-Jul-2013 @ 5%',              'ITO 2001 s.37A',    true),
  ('2025-26', 'capital_gains', 'securities_pmex_settled',                0.050, 0, 999999999999, 0, 'PMEX / cash-settled securities @ 5%',                     'ITO 2001 s.37A',    true),
  ('2025-26', 'capital_gains', 'securities_37a_7_5_percent',             0.075, 0, 999999999999, 0, 'Securities u/s 37A @ 7.5%',                               'ITO 2001 s.37A',    true),
  ('2025-26', 'capital_gains', 'securities_mutual_funds_10_percent',     0.100, 0, 999999999999, 0, 'Securities / mutual funds / REIT @ 10%',                  'ITO 2001 s.37A',    true),
  ('2025-26', 'capital_gains', 'securities_mutual_funds_12_5_percent',   0.125, 0, 999999999999, 0, 'Stock-fund mutual funds / REIT @ 12.5%',                  'ITO 2001 s.37A',    true),
  ('2025-26', 'capital_gains', 'securities_other_25_percent',            0.250, 0, 999999999999, 0, 'Non-stock-fund mutual funds / REIT @ 25%',                'ITO 2001 s.37A',    true),
  ('2025-26', 'capital_gains', 'securities_12_5_percent_before_july_2022', 0.125, 0, 999999999999, 0, 'Securities acquired before 1-Jul-2022 @ 12.5%',          'ITO 2001 s.37A',    true),
  ('2025-26', 'capital_gains', 'securities_15_percent',                  0.150, 0, 999999999999, 0, 'Securities u/s 37A @ 15%',                                'ITO 2001 s.37A',    true);

COMMIT;
