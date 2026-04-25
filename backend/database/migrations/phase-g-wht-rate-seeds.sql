-- Phase G: seed the remaining withholding-tax rate categories that
-- AdjustableTaxForm auto-calculates. Before this, several rates (motor-vehicle
-- leasing, telephone/internet bills, prepaid cards) existed only as hardcoded
-- multipliers in the React form. Idempotent.
--
-- Apply:  psql -d tax_advisor -f backend/database/migrations/phase-g-wht-rate-seeds.sql

BEGIN;

-- TY 2025-26
DELETE FROM tax_rates_config
 WHERE tax_year = '2025-26'
   AND rate_type = 'withholding'
   AND rate_category IN (
     'motor_vehicle_leasing_231b1a',
     'telephone_bill_236_1e',
     'prepaid_telephone_card_236_1b',
     'phone_unit_236_1c',
     'internet_bill_236_1d',
     'prepaid_internet_card_236_1e',
     'profit_debt_151_20',
     'sukook_151a',
     'rent_section_155_individual',
     'electricity_bill_235',
     'motor_vehicle_transfer_231b2',
     'functions_gatherings_236cb_atl',
     'functions_gatherings_236cb_nonatl'
   );

INSERT INTO tax_rates_config
  (tax_year, rate_type, rate_category, tax_rate, min_amount, max_amount, fixed_amount, description, fbr_reference, is_active)
VALUES
  ('2025-26', 'withholding', 'motor_vehicle_leasing_231b1a',      0.04,  0, 999999999999, 0, 'Leasing of motor vehicle u/s 231B(1A) — 4%',                'ITO 2001 s.231B(1A)', true),
  ('2025-26', 'withholding', 'telephone_bill_236_1e',             0.15,  0, 999999999999, 0, 'Telephone bill u/s 236(1)(e) — 15%',                        'ITO 2001 s.236',      true),
  ('2025-26', 'withholding', 'prepaid_telephone_card_236_1b',     0.15,  0, 999999999999, 0, 'Prepaid telephone card u/s 236(1)(b) — 15%',                'ITO 2001 s.236',      true),
  ('2025-26', 'withholding', 'phone_unit_236_1c',                 0.15,  0, 999999999999, 0, 'Phone unit u/s 236(1)(c) — 15%',                            'ITO 2001 s.236',      true),
  ('2025-26', 'withholding', 'internet_bill_236_1d',              0.15,  0, 999999999999, 0, 'Internet bill u/s 236(1)(d) — 15%',                         'ITO 2001 s.236',      true),
  ('2025-26', 'withholding', 'prepaid_internet_card_236_1e',      0.15,  0, 999999999999, 0, 'Prepaid internet card u/s 236(1)(e) — 15%',                 'ITO 2001 s.236',      true),
  ('2025-26', 'withholding', 'profit_debt_151_20',                0.20,  0, 999999999999, 0, 'Profit on debt u/s 151 — FA 2025 raised from 15% to 20%',   'ITO 2001 s.151',      true),
  ('2025-26', 'withholding', 'sukook_151a',                       0.125, 0, 999999999999, 0, 'Sukook profit u/s 151A — 12.5%',                            'ITO 2001 s.151A',     true),
  ('2025-26', 'withholding', 'rent_section_155_individual',       0.15,  0, 999999999999, 0, 'Rent deduction u/s 155 (individual) — 15%',                 'ITO 2001 s.155',      true),
  ('2025-26', 'withholding', 'electricity_bill_235',              0.075, 0, 999999999999, 0, 'Electricity bill (domestic) u/s 235 — 7.5%',                'ITO 2001 s.235',      true),
  ('2025-26', 'withholding', 'motor_vehicle_transfer_231b2',      0.03,  0, 999999999999, 0, 'Motor vehicle transfer fee u/s 231B(2) — 3%',               'ITO 2001 s.231B(2)',  true),
  ('2025-26', 'withholding', 'functions_gatherings_236cb_atl',    0.10,  0, 999999999999, 0, 'Functions/gatherings u/s 236CB — filer 10%',                'ITO 2001 s.236CB',    true),
  ('2025-26', 'withholding', 'functions_gatherings_236cb_nonatl', 0.20,  0, 999999999999, 0, 'Functions/gatherings u/s 236CB — non-filer 20%',            'ITO 2001 s.236CB',    true);

COMMIT;
