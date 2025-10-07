-- Create comprehensive final_min_income_forms table matching Excel structure
-- Income Subject to Final/Fixed/Minimum/Average/Relevant/Reduced Tax

-- Drop table if exists to recreate with all fields
DROP TABLE IF EXISTS final_min_income_forms CASCADE;

CREATE TABLE final_min_income_forms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tax_return_id UUID NOT NULL,
  user_id UUID NOT NULL,
  user_email VARCHAR(255) NOT NULL,
  tax_year_id UUID NOT NULL,
  tax_year VARCHAR(10) NOT NULL,

  -- Salary Income
  salary_u_s_12_7 DECIMAL(15,2) DEFAULT 0,

  -- Dividend & Interest Income (comprehensive fields from Excel)
  dividend_u_s_150_0pc_share_profit_reit_spv DECIMAL(15,2) DEFAULT 0,
  dividend_u_s_150_35pc_share_profit_other_spv DECIMAL(15,2) DEFAULT 0,
  dividend_u_s_150_7_5pc_ipp_shares DECIMAL(15,2) DEFAULT 0,
  dividend_u_s_150_31pc_atl DECIMAL(15,2) DEFAULT 0,

  -- Return on Investment in Sukuk (comprehensive fields)
  return_on_investment_sukuk_u_s_151_1a_10pc DECIMAL(15,2) DEFAULT 0,
  return_on_investment_sukuk_u_s_151_1a_12_5pc DECIMAL(15,2) DEFAULT 0,
  return_on_investment_sukuk_u_s_151_1a_25pc DECIMAL(15,2) DEFAULT 0,
  -- Shortened field names to avoid PostgreSQL identifier limit
  return_invest_exceed_1m_sukuk_saa_12_5pc DECIMAL(15,2) DEFAULT 0,
  return_invest_not_exceed_1m_sukuk_saa_10pc DECIMAL(15,2) DEFAULT 0,

  -- Profit on Debt (comprehensive fields)
  profit_debt_151a_saa_sab_atl_10pc_non_atl_20pc DECIMAL(15,2) DEFAULT 0,
  profit_debt_national_savings_defence_39_14a DECIMAL(15,2) DEFAULT 0,
  profit_debt_u_s_7b DECIMAL(15,2) DEFAULT 0,
  interest_income_profit_debt_7b_up_to_5m DECIMAL(15,2) DEFAULT 0,
  prize_raffle_lottery_quiz_promotional_156 DECIMAL(15,2) DEFAULT 0,
  prize_bond_cross_world_puzzle_156 DECIMAL(15,2) DEFAULT 0,
  bonus_shares_companies_236f DECIMAL(15,2) DEFAULT 0,

  -- Employment Termination & Benefits
  employment_termination_benefits_12_6_avg_rate DECIMAL(15,2) DEFAULT 0,

  -- Salary Arrears
  salary_arrears_12_7_relevant_rate DECIMAL(15,2) DEFAULT 0,

  -- Capital Gain from separate form
  capital_gain DECIMAL(15,2) DEFAULT 0,

  -- Field descriptions and notes (JSONB for flexibility)
  field_notes JSONB DEFAULT '{}',

  -- Calculated totals (using stored generated columns)
  subtotal DECIMAL(15,2) GENERATED ALWAYS AS (
    COALESCE(salary_u_s_12_7, 0) +
    COALESCE(dividend_u_s_150_0pc_share_profit_reit_spv, 0) +
    COALESCE(dividend_u_s_150_35pc_share_profit_other_spv, 0) +
    COALESCE(dividend_u_s_150_7_5pc_ipp_shares, 0) +
    COALESCE(dividend_u_s_150_31pc_atl, 0) +
    COALESCE(return_on_investment_sukuk_u_s_151_1a_10pc, 0) +
    COALESCE(return_on_investment_sukuk_u_s_151_1a_12_5pc, 0) +
    COALESCE(return_on_investment_sukuk_u_s_151_1a_25pc, 0) +
    COALESCE(return_invest_exceed_1m_sukuk_saa_12_5pc, 0) +
    COALESCE(return_invest_not_exceed_1m_sukuk_saa_10pc, 0) +
    COALESCE(profit_debt_151a_saa_sab_atl_10pc_non_atl_20pc, 0) +
    COALESCE(profit_debt_national_savings_defence_39_14a, 0) +
    COALESCE(profit_debt_u_s_7b, 0) +
    COALESCE(interest_income_profit_debt_7b_up_to_5m, 0) +
    COALESCE(prize_raffle_lottery_quiz_promotional_156, 0) +
    COALESCE(prize_bond_cross_world_puzzle_156, 0) +
    COALESCE(bonus_shares_companies_236f, 0) +
    COALESCE(employment_termination_benefits_12_6_avg_rate, 0) +
    COALESCE(salary_arrears_12_7_relevant_rate, 0)
  ) STORED,

  grand_total DECIMAL(15,2) GENERATED ALWAYS AS (
    COALESCE(salary_u_s_12_7, 0) +
    COALESCE(dividend_u_s_150_0pc_share_profit_reit_spv, 0) +
    COALESCE(dividend_u_s_150_35pc_share_profit_other_spv, 0) +
    COALESCE(dividend_u_s_150_7_5pc_ipp_shares, 0) +
    COALESCE(dividend_u_s_150_31pc_atl, 0) +
    COALESCE(return_on_investment_sukuk_u_s_151_1a_10pc, 0) +
    COALESCE(return_on_investment_sukuk_u_s_151_1a_12_5pc, 0) +
    COALESCE(return_on_investment_sukuk_u_s_151_1a_25pc, 0) +
    COALESCE(return_invest_exceed_1m_sukuk_saa_12_5pc, 0) +
    COALESCE(return_invest_not_exceed_1m_sukuk_saa_10pc, 0) +
    COALESCE(profit_debt_151a_saa_sab_atl_10pc_non_atl_20pc, 0) +
    COALESCE(profit_debt_national_savings_defence_39_14a, 0) +
    COALESCE(profit_debt_u_s_7b, 0) +
    COALESCE(interest_income_profit_debt_7b_up_to_5m, 0) +
    COALESCE(prize_raffle_lottery_quiz_promotional_156, 0) +
    COALESCE(prize_bond_cross_world_puzzle_156, 0) +
    COALESCE(bonus_shares_companies_236f, 0) +
    COALESCE(employment_termination_benefits_12_6_avg_rate, 0) +
    COALESCE(salary_arrears_12_7_relevant_rate, 0) +
    COALESCE(capital_gain, 0)
  ) STORED,

  -- Form completion status
  is_complete BOOLEAN DEFAULT FALSE,

  -- Audit fields
  last_updated_by UUID,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_final_min_income_forms_return ON final_min_income_forms(tax_return_id);
CREATE INDEX IF NOT EXISTS idx_final_min_income_forms_user ON final_min_income_forms(user_id, user_email);
CREATE INDEX IF NOT EXISTS idx_final_min_income_forms_year ON final_min_income_forms(tax_year_id, tax_year);

-- Add descriptive comments for each field
COMMENT ON TABLE final_min_income_forms IS 'Income Subject to Final/Fixed/Minimum/Average/Relevant/Reduced Tax - comprehensive Pakistani tax categories';

COMMENT ON COLUMN final_min_income_forms.salary_u_s_12_7 IS 'Salary u/s 12(7)';
COMMENT ON COLUMN final_min_income_forms.dividend_u_s_150_0pc_share_profit_reit_spv IS 'Dividend u/s 150 @0% share of profit from REIT SPV - Green cells are input cells (Tax chargeable is computed based on TY2025 rates)';
COMMENT ON COLUMN final_min_income_forms.dividend_u_s_150_35pc_share_profit_other_spv IS 'Dividend u/s 150 @35% share of profit from other SPV - Green cells are input cells (Tax chargeable is computed based on TY2025 rates)';
COMMENT ON COLUMN final_min_income_forms.dividend_u_s_150_7_5pc_ipp_shares IS 'Dividend u/s 150 @7.5% IPP Shares - Green cells are input cells (Tax chargeable is computed based on TY2025 rates)';
COMMENT ON COLUMN final_min_income_forms.dividend_u_s_150_31pc_atl IS 'Dividend u/s 150 @31% ATL - Green cells are input cells (Tax chargeable is computed based on TY2025 rates)';
COMMENT ON COLUMN final_min_income_forms.return_on_investment_sukuk_u_s_151_1a_10pc IS 'Return on Investment in Sukuk u/s 151(1A) @ 10% - Green cells are input cells (Tax chargeable is computed based on TY2025 rates)';
COMMENT ON COLUMN final_min_income_forms.return_on_investment_sukuk_u_s_151_1a_12_5pc IS 'Return on Investment in Sukuk u/s 151(1A) @ 12.5% - Green cells are input cells (Tax chargeable is computed based on TY2025 rates)';
COMMENT ON COLUMN final_min_income_forms.return_on_investment_sukuk_u_s_151_1a_25pc IS 'Return on Investment in Sukuk u/s 151(1A) @ 25% - Green cells are input cells (Tax chargeable is computed based on TY2025 rates)';
COMMENT ON COLUMN final_min_income_forms.return_invest_exceed_1m_sukuk_saa_12_5pc IS 'If return on investment is exceeding 1 million on sukuk u/s SAA @ 12.5% u/s 151(1A), u/s 152(1DB) - Green cells are input cells (Tax chargeable is computed based on TY2025 rates)';
COMMENT ON COLUMN final_min_income_forms.return_invest_not_exceed_1m_sukuk_saa_10pc IS 'If return on investment is not exceeding 1 million on sukuk u/s SAA @ 10% u/s 151(1A), u/s 152(1DB) - Green cells are input cells (Tax chargeable is computed based on TY2025 rates)';
COMMENT ON COLUMN final_min_income_forms.profit_debt_151a_saa_sab_atl_10pc_non_atl_20pc IS 'Profit on Debt u/s (151A)/SAA/SAB of Part II, Second Schedule (ATL @10%, non-ATL @20%) - Green cells are input cells (Tax chargeable is computed based on TY2025 rates)';
COMMENT ON COLUMN final_min_income_forms.profit_debt_national_savings_defence_39_14a IS 'Profit on Debt on National Savings Certificates including Defence Saving pertaining to previous years u/s 39(14A) - Chargeable to tax at rate prevailing in the relevant year';
COMMENT ON COLUMN final_min_income_forms.profit_debt_u_s_7b IS 'Interest Income - Profit on debt u/s 7B (Profit up to 5m) - Green cells are input cells (Tax chargeable is computed based on TY2025 rates)';
COMMENT ON COLUMN final_min_income_forms.interest_income_profit_debt_7b_up_to_5m IS 'Interest Income - Profit on debt u/s 7B (Profit up to 5m) - Green cells are input cells (Tax chargeable is computed based on TY2025 rates)';
COMMENT ON COLUMN final_min_income_forms.prize_raffle_lottery_quiz_promotional_156 IS 'Prize on Raffle/Lottery/Quiz/Sale promotion u/s 156 - Green cells are input cells (Tax chargeable is computed based on TY2025 rates)';
COMMENT ON COLUMN final_min_income_forms.prize_bond_cross_world_puzzle_156 IS 'Prize on Prize Bond/Cross world puzzle u/s 156 - Green cells are input cells (Tax chargeable is computed based on TY2025 rates)';
COMMENT ON COLUMN final_min_income_forms.bonus_shares_companies_236f IS 'Bonus shares issued by companies u/s 236F - Value received is the day price on the last closeout of books in the case of listed company and the value as prescribed in case of other companies';
COMMENT ON COLUMN final_min_income_forms.employment_termination_benefits_12_6_avg_rate IS 'Salary Arrears u/s 12(7) Chargeable to Tax at Relevant Rate - Average Rate of tax for Calculation of salary arrears (0% to 100%)';
COMMENT ON COLUMN final_min_income_forms.salary_arrears_12_7_relevant_rate IS 'Salary Arrears u/s 12(7) Chargeable to Tax at Relevant Rate - Average Rate of tax for Calculation of salary arrears (0% to 100%)';
COMMENT ON COLUMN final_min_income_forms.capital_gain IS 'Capital Gain - Linked with Capital gain sheet';
COMMENT ON COLUMN final_min_income_forms.subtotal IS 'Subtotal - sum of above';
COMMENT ON COLUMN final_min_income_forms.grand_total IS 'Grand Total - sum of above';
COMMENT ON COLUMN final_min_income_forms.field_notes IS 'JSON field containing notes and descriptions for user guidance';