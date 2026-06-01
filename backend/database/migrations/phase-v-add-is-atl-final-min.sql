-- phase-v: Active Taxpayer (filer) status on final_min_income_forms.
--
-- Drives which final-tax rate applies on the Final/Min Income form (audit
-- TAX-01): a non-filer pays the higher (≈ double) rate per the FBR Tax Card
-- 2025-26. The form now asks "Are you an Active Taxpayer?" and the backend
-- computes each line's tax_chargeable = gross × (filer ? atl : non-filer) rate.
--
-- Safe to apply online: additive, NOT NULL with a default, and the app already
-- works without it (the chargeable is computed from the submitted answer at save
-- time; the column is only for persistence + form pre-fill). Idempotent.

ALTER TABLE final_min_income_forms
  ADD COLUMN IF NOT EXISTS is_atl BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN final_min_income_forms.is_atl IS
  'Active Taxpayer List (filer) status. true = filer (lower final-tax rate); false = non-filer (higher rate). FBR Tax Card 2025-26 — see config/finalMinTaxRates.js.';
