-- ──────────────────────────────────────────────────────────────────────────
-- phase-s: seed 2025-26 surcharge into tax_rates_config
--
-- Why: phase-b only seeds the 2024-25 surcharge (10%); the 2025-26 surcharge
-- (9% above Rs 10M per Finance Act 2025) was previously only present in
-- `backend/data/rates-bundle.json` and only landed in live DBs that had the
-- bundle replayed via the admin panel. A fresh deploy without the bundle
-- step would throw "no surcharge for 2025-26" from getSurcharge() and the
-- tax-computation flow would break.
--
-- This migration is idempotent: it deletes any existing 2025-26 surcharge
-- row before inserting the canonical FA-2025 value, so re-running it is
-- safe and re-running after a bundle apply keeps the bundle's value (which
-- is identical).
-- ──────────────────────────────────────────────────────────────────────────

BEGIN;

DELETE FROM tax_rates_config
 WHERE tax_year = '2025-26'
   AND rate_type = 'surcharge'
   AND rate_category = 'salaried_above_10m';

INSERT INTO tax_rates_config (
  tax_year, rate_type, rate_category, tax_rate,
  min_amount, max_amount, fixed_amount,
  description, fbr_reference, is_active
) VALUES (
  '2025-26', 'surcharge', 'salaried_above_10m', 0.09,
  10000000, 999999999999, 0,
  'Surcharge 9% on income tax where taxable income exceeds Rs 10M (FA 2025)',
  'Finance Act 2025, Section 4AB',
  true
);

COMMIT;

-- Post-apply check (run manually):
-- SELECT tax_year, rate_type, rate_category, tax_rate, min_amount
--   FROM tax_rates_config
--  WHERE rate_type = 'surcharge'
--  ORDER BY tax_year;
