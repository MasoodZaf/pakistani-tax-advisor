-- Phase J: seed final_tax categories for FinalTaxForm + FinalMinIncomeForm.
--
-- Before this, both forms carried hardcoded rate literals. Aligning the DB
-- rate_category values with the frontend item.id / field-key values gives a
-- clean 1:1 lookup via useTaxRates().finalTax[id].rate.
--
-- Previously-seeded generic categories (dividend_standard, prize_bond, etc.)
-- are left in place — they represent cross-form rate pools that other
-- computations may still reference.
--
-- Apply:  psql -d tax_advisor -f backend/database/migrations/phase-j-final-tax-rate-seeds.sql

BEGIN;

-- Idempotent: clear and re-insert the form-specific category set.
DELETE FROM tax_rates_config
 WHERE tax_year = '2025-26'
   AND rate_type = 'final_tax'
   AND rate_category IN (
     'prize_bond_winnings',
     'lottery_crossword_winnings',
     'profit_govt_securities',
     'profit_defence_savings',
     'dividend_listed_companies',
     'dividend_other',
     'capital_gain_securities_less_12m',
     'capital_gain_securities_over_12m',
     'commission_agents',
     -- FinalMinIncomeForm categories
     'dividend_reit_spv_0pc',
     'dividend_other_spv_35pc',
     'dividend_ipp_7_5pc',
     'dividend_regular_15pc',
     'dividend_regular_25pc',
     'dividend_specie_15pc',
     'profit_debt_151_up_to_5m',
     'sukook_individual_up_to_1m',
     'sukook_individual_1m_to_5m',
     'sukook_individual_above_5m'
   );

INSERT INTO tax_rates_config
  (tax_year, rate_type, rate_category, tax_rate, min_amount, max_amount, fixed_amount, description, fbr_reference, is_active)
VALUES
  -- FinalTaxForm
  ('2025-26', 'final_tax', 'prize_bond_winnings',               0.150, 0, 999999999999, 0, 'Prize bonds u/s 156 — 15% final tax',                                 'ITO 2001 s.156',  true),
  ('2025-26', 'final_tax', 'lottery_crossword_winnings',        0.200, 0, 999999999999, 0, 'Lottery/raffle/quiz u/s 156A — 20% final tax',                        'ITO 2001 s.156A', true),
  ('2025-26', 'final_tax', 'profit_govt_securities',            0.100, 0, 999999999999, 0, 'NSS / Post Office profit u/s 151(1)(a) — 10% final WHT',              'ITO 2001 s.151',  true),
  ('2025-26', 'final_tax', 'profit_defence_savings',            0.100, 0, 999999999999, 0, 'Defence Savings Certificates u/s 151(1)(b) — 10% final WHT',          'ITO 2001 s.151',  true),
  ('2025-26', 'final_tax', 'dividend_listed_companies',         0.150, 0, 999999999999, 0, 'Dividend from listed companies u/s 150 — 15% final tax',              'ITO 2001 s.150',  true),
  ('2025-26', 'final_tax', 'dividend_other',                    0.250, 0, 999999999999, 0, 'Dividend from unlisted / other companies u/s 150 — 25% final tax',    'ITO 2001 s.150',  true),
  ('2025-26', 'final_tax', 'capital_gain_securities_less_12m',  0.150, 0, 999999999999, 0, 'CGT on securities held < 12 months u/s 37A — 15%',                    'ITO 2001 s.37A',  true),
  ('2025-26', 'final_tax', 'capital_gain_securities_over_12m',  0.125, 0, 999999999999, 0, 'CGT on securities held ≥ 12 months u/s 37A — 12.5%',                  'ITO 2001 s.37A',  true),
  ('2025-26', 'final_tax', 'commission_agents',                 0.120, 0, 999999999999, 0, 'Commission to stock-exchange members / agents u/s 233 — 12%',         'ITO 2001 s.233',  true),

  -- FinalMinIncomeForm — dividend sub-types u/s 150
  ('2025-26', 'final_tax', 'dividend_reit_spv_0pc',             0.000, 0, 999999999999, 0, 'Dividend from REIT/SPV (pass-through to CPPAG) — 0%',                 'ITO 2001 s.150',  true),
  ('2025-26', 'final_tax', 'dividend_other_spv_35pc',           0.350, 0, 999999999999, 0, 'Dividend from other SPV (biomass/bagasse IPP) — 35%',                 'ITO 2001 s.150',  true),
  ('2025-26', 'final_tax', 'dividend_ipp_7_5pc',                0.075, 0, 999999999999, 0, 'Dividend from IPP shares — 7.5%',                                     'ITO 2001 s.150',  true),
  ('2025-26', 'final_tax', 'dividend_regular_15pc',             0.150, 0, 999999999999, 0, 'Regular dividend (< 50% income from profit on debt) — 15%',           'ITO 2001 s.150',  true),
  ('2025-26', 'final_tax', 'dividend_regular_25pc',             0.250, 0, 999999999999, 0, 'Mutual funds / REITs with ≥ 50% income from profit on debt — 25%',    'ITO 2001 s.150',  true),
  ('2025-26', 'final_tax', 'dividend_specie_15pc',              0.150, 0, 999999999999, 0, 'Dividend in specie — 15%',                                            'ITO 2001 s.150',  true),

  -- FinalMinIncomeForm — profit on debt / sukook (individual)
  ('2025-26', 'final_tax', 'profit_debt_151_up_to_5m',          0.200, 0, 5000000,      0, 'Profit on debt u/s 151 (individual, up to Rs 5M) — 20% FA 2025',      'ITO 2001 s.151',  true),
  ('2025-26', 'final_tax', 'sukook_individual_up_to_1m',        0.100, 0, 1000000,      0, 'Sukook returns (individual, up to Rs 1M) — 10%',                      'ITO 2001 s.151A', true),
  ('2025-26', 'final_tax', 'sukook_individual_1m_to_5m',        0.125, 1000001, 5000000, 0, 'Sukook returns (individual, Rs 1-5M) — 12.5%',                       'ITO 2001 s.151A', true),
  ('2025-26', 'final_tax', 'sukook_individual_above_5m',        0.250, 5000001, 999999999999, 0, 'Sukook returns (individual, > Rs 5M) — 25% minimum tax',         'ITO 2001 s.151A', true);

COMMIT;
