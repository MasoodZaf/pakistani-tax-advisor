-- Migration: Add Dividend u/s 150 @25% (Companies with BF losses / MF 50%+ profit on debt)
-- This corresponds to FBR Excel row B7 in the Final/Minimum Tax section

ALTER TABLE final_min_income_forms
ADD COLUMN IF NOT EXISTS dividend_u_s_150_25pc_bf_losses          NUMERIC(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS dividend_u_s_150_25pc_bf_losses_tax_deducted   NUMERIC(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS dividend_u_s_150_25pc_bf_losses_tax_chargeable NUMERIC(15,2) DEFAULT 0;

COMMENT ON COLUMN final_min_income_forms.dividend_u_s_150_25pc_bf_losses
  IS 'Dividend u/s 150 @25% - From companies not paying tax due to BF losses or MF with 50%+ profit on debt (FBR Excel B7)';
COMMENT ON COLUMN final_min_income_forms.dividend_u_s_150_25pc_bf_losses_tax_deducted
  IS 'Tax deducted at source on dividend @25%';
COMMENT ON COLUMN final_min_income_forms.dividend_u_s_150_25pc_bf_losses_tax_chargeable
  IS 'Tax chargeable on dividend @25%';
