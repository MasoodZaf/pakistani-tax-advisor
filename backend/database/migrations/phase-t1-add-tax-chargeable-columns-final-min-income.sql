-- Add tax_chargeable columns to final_min_income_forms table
-- These columns will store the auto-calculated tax chargeable based on tax year rates

ALTER TABLE final_min_income_forms
ADD COLUMN IF NOT EXISTS salary_u_s_12_7_tax_chargeable numeric(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS dividend_u_s_150_0pc_share_profit_reit_spv_tax_chargeable numeric(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS dividend_u_s_150_35pc_share_profit_other_spv_tax_chargeable numeric(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS dividend_u_s_150_7_5pc_ipp_shares_tax_chargeable numeric(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS dividend_u_s_150_31pc_atl_tax_chargeable numeric(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS return_on_investment_sukuk_u_s_151_1a_10pc_tax_chargeable numeric(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS return_on_investment_sukuk_u_s_151_1a_12_5pc_tax_chargeable numeric(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS return_on_investment_sukuk_u_s_151_1a_25pc_tax_chargeable numeric(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS return_invest_exceed_1m_sukuk_saa_12_5pc_tax_chargeable numeric(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS return_invest_not_exceed_1m_sukuk_saa_10pc_tax_chargeable numeric(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS profit_debt_151a_saa_sab_atl_10pc_non_atl_20pc_tax_chargeable numeric(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS profit_debt_national_savings_defence_39_14a_tax_chargeable numeric(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS interest_income_profit_debt_7b_up_to_5m_tax_chargeable numeric(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS prize_raffle_lottery_quiz_promotional_156_tax_chargeable numeric(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS prize_bond_cross_world_puzzle_156_tax_chargeable numeric(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS bonus_shares_companies_236f_tax_chargeable numeric(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS employment_termination_benefits_12_6_avg_rate_tax_chargeable numeric(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS salary_arrears_12_7_relevant_rate_tax_chargeable numeric(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS capital_gain_tax_chargeable numeric(15,2) DEFAULT 0;

-- Add columns for subtotal and grand total of tax chargeable
ALTER TABLE final_min_income_forms
ADD COLUMN IF NOT EXISTS subtotal_tax_chargeable numeric(15,2)
  GENERATED ALWAYS AS (
    COALESCE(salary_u_s_12_7_tax_chargeable, 0) +
    COALESCE(dividend_u_s_150_0pc_share_profit_reit_spv_tax_chargeable, 0) +
    COALESCE(dividend_u_s_150_35pc_share_profit_other_spv_tax_chargeable, 0) +
    COALESCE(dividend_u_s_150_7_5pc_ipp_shares_tax_chargeable, 0) +
    COALESCE(dividend_u_s_150_31pc_atl_tax_chargeable, 0) +
    COALESCE(return_on_investment_sukuk_u_s_151_1a_10pc_tax_chargeable, 0) +
    COALESCE(return_on_investment_sukuk_u_s_151_1a_12_5pc_tax_chargeable, 0) +
    COALESCE(return_on_investment_sukuk_u_s_151_1a_25pc_tax_chargeable, 0) +
    COALESCE(return_invest_exceed_1m_sukuk_saa_12_5pc_tax_chargeable, 0) +
    COALESCE(return_invest_not_exceed_1m_sukuk_saa_10pc_tax_chargeable, 0) +
    COALESCE(profit_debt_151a_saa_sab_atl_10pc_non_atl_20pc_tax_chargeable, 0) +
    COALESCE(profit_debt_national_savings_defence_39_14a_tax_chargeable, 0) +
    COALESCE(interest_income_profit_debt_7b_up_to_5m_tax_chargeable, 0) +
    COALESCE(prize_raffle_lottery_quiz_promotional_156_tax_chargeable, 0) +
    COALESCE(prize_bond_cross_world_puzzle_156_tax_chargeable, 0) +
    COALESCE(bonus_shares_companies_236f_tax_chargeable, 0) +
    COALESCE(employment_termination_benefits_12_6_avg_rate_tax_chargeable, 0) +
    COALESCE(salary_arrears_12_7_relevant_rate_tax_chargeable, 0)
  ) STORED,
ADD COLUMN IF NOT EXISTS grand_total_tax_chargeable numeric(15,2)
  GENERATED ALWAYS AS (
    COALESCE(salary_u_s_12_7_tax_chargeable, 0) +
    COALESCE(dividend_u_s_150_0pc_share_profit_reit_spv_tax_chargeable, 0) +
    COALESCE(dividend_u_s_150_35pc_share_profit_other_spv_tax_chargeable, 0) +
    COALESCE(dividend_u_s_150_7_5pc_ipp_shares_tax_chargeable, 0) +
    COALESCE(dividend_u_s_150_31pc_atl_tax_chargeable, 0) +
    COALESCE(return_on_investment_sukuk_u_s_151_1a_10pc_tax_chargeable, 0) +
    COALESCE(return_on_investment_sukuk_u_s_151_1a_12_5pc_tax_chargeable, 0) +
    COALESCE(return_on_investment_sukuk_u_s_151_1a_25pc_tax_chargeable, 0) +
    COALESCE(return_invest_exceed_1m_sukuk_saa_12_5pc_tax_chargeable, 0) +
    COALESCE(return_invest_not_exceed_1m_sukuk_saa_10pc_tax_chargeable, 0) +
    COALESCE(profit_debt_151a_saa_sab_atl_10pc_non_atl_20pc_tax_chargeable, 0) +
    COALESCE(profit_debt_national_savings_defence_39_14a_tax_chargeable, 0) +
    COALESCE(interest_income_profit_debt_7b_up_to_5m_tax_chargeable, 0) +
    COALESCE(prize_raffle_lottery_quiz_promotional_156_tax_chargeable, 0) +
    COALESCE(prize_bond_cross_world_puzzle_156_tax_chargeable, 0) +
    COALESCE(bonus_shares_companies_236f_tax_chargeable, 0) +
    COALESCE(employment_termination_benefits_12_6_avg_rate_tax_chargeable, 0) +
    COALESCE(salary_arrears_12_7_relevant_rate_tax_chargeable, 0) +
    COALESCE(capital_gain_tax_chargeable, 0)
  ) STORED;

COMMENT ON COLUMN final_min_income_forms.salary_u_s_12_7_tax_chargeable IS 'Tax chargeable computed based on TY2025 rates';
COMMENT ON COLUMN final_min_income_forms.dividend_u_s_150_0pc_share_profit_reit_spv_tax_chargeable IS 'Tax chargeable at 0%';
COMMENT ON COLUMN final_min_income_forms.dividend_u_s_150_35pc_share_profit_other_spv_tax_chargeable IS 'Tax chargeable at 35%/70% based on ATL';
COMMENT ON COLUMN final_min_income_forms.dividend_u_s_150_7_5pc_ipp_shares_tax_chargeable IS 'Tax chargeable at 7.5%/15%';
COMMENT ON COLUMN final_min_income_forms.dividend_u_s_150_31pc_atl_tax_chargeable IS 'Tax chargeable at 31%/15% based on ATL';
COMMENT ON COLUMN final_min_income_forms.subtotal_tax_chargeable IS 'Sum of all tax chargeable (excluding capital gain)';
COMMENT ON COLUMN final_min_income_forms.grand_total_tax_chargeable IS 'Sum of all tax chargeable (including capital gain)';
