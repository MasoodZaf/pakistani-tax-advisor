-- Phase W: drop zombie plain columns on tax_computation_forms.
--
-- Background
-- ----------
-- tax_computation_forms has matched pairs of (plain DEFAULT 0, generated)
-- columns. The plains shadow live generated equivalents:
--
--   surcharge                  -> surcharge_amount (input for generated)
--   capital_gain_tax           -> capital_gains_tax (input for generated)
--   income_from_other_sources  -> other_income_subject_to_min_tax / income_loss_other_sources
--   gains_from_capital_assets  -> capital_gains_loss
--   total_tax                  -> total_tax_liability (generated)
--   tax_after_adjustments      -> net_tax_payable (generated)
--   total_tax_paid             -> balance_payable (generated, sign-flipped)
--   total_tax_paid_with_advance-> balance_payable (generated)
--   tax_payable_refundable     -> balance_payable (generated, sign-flipped)
--   income_subject_to_final_tax-> final_fixed_tax (the input column)
--
-- The pre-phase-w frontend (`TaxComputationSummary.js`) duplicated every
-- value into both the live and zombie columns. The accompanying frontend
-- commit now writes only the inputs of the generated columns; this
-- migration drops the zombies so future writes to those names error
-- loudly rather than silently shadowing the source of truth.
--
-- Apply:  psql -d tax_advisor -f backend/database/migrations/phase-w-drop-tax-computation-zombies.sql
-- Idempotent: re-runs are safe.

BEGIN;

ALTER TABLE tax_computation_forms
  DROP COLUMN IF EXISTS surcharge,
  DROP COLUMN IF EXISTS capital_gain_tax,
  DROP COLUMN IF EXISTS total_tax,
  DROP COLUMN IF EXISTS tax_after_adjustments,
  DROP COLUMN IF EXISTS income_from_other_sources,
  DROP COLUMN IF EXISTS gains_from_capital_assets,
  DROP COLUMN IF EXISTS income_subject_to_final_tax,
  DROP COLUMN IF EXISTS total_tax_paid,
  DROP COLUMN IF EXISTS total_tax_paid_with_advance,
  DROP COLUMN IF EXISTS tax_payable_refundable;

COMMIT;
