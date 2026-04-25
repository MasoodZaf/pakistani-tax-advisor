-- Migration: Add total_capital_gain_tax column to capital_gain_forms
-- This stores the gross CGT computed by CapitalGainsForm (Finance Act 2025 rates),
-- distinct from capital_gains_tax_chargeable (net CGT after WHT offset).
-- Required for TaxComputationSummary to read the correct CGT after page refresh.

ALTER TABLE capital_gain_forms
  ADD COLUMN IF NOT EXISTS total_capital_gain_tax DECIMAL(15,2) DEFAULT 0;

COMMENT ON COLUMN capital_gain_forms.total_capital_gain_tax IS
  'Gross CGT computed client-side from Finance Act 2025 rates (sum of all *_taxable × rate). '
  'Distinct from total_capital_gains_tax (old DB-computed column using legacy aggregate fields).';
