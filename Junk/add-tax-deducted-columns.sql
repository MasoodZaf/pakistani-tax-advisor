-- Add tax_deducted columns for each income field in final_min_income_forms table
-- This creates the 3-column structure: Amount/Receipt, Tax Deducted, Tax Chargeable

-- Drop existing calculated columns first
ALTER TABLE final_min_income_forms
DROP COLUMN IF EXISTS subtotal,
DROP COLUMN IF EXISTS grand_total;

-- Add tax_deducted fields for each income category
ALTER TABLE final_min_income_forms
-- Salary Income
ADD COLUMN IF NOT EXISTS salary_u_s_12_7_tax_deducted DECIMAL(15,2) DEFAULT 0,

-- Dividend & Interest Income
ADD COLUMN IF NOT EXISTS dividend_u_s_150_0pc_share_profit_reit_spv_tax_deducted DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS dividend_u_s_150_35pc_share_profit_other_spv_tax_deducted DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS dividend_u_s_150_7_5pc_ipp_shares_tax_deducted DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS dividend_u_s_150_31pc_atl_tax_deducted DECIMAL(15,2) DEFAULT 0,

-- Return on Investment in Sukuk
ADD COLUMN IF NOT EXISTS return_on_investment_sukuk_u_s_151_1a_10pc_tax_deducted DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS return_on_investment_sukuk_u_s_151_1a_12_5pc_tax_deducted DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS return_on_investment_sukuk_u_s_151_1a_25pc_tax_deducted DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS return_invest_exceed_1m_sukuk_saa_12_5pc_tax_deducted DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS return_invest_not_exceed_1m_sukuk_saa_10pc_tax_deducted DECIMAL(15,2) DEFAULT 0,

-- Profit on Debt
ADD COLUMN IF NOT EXISTS profit_debt_151a_saa_sab_atl_10pc_non_atl_20pc_tax_deducted DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS profit_debt_national_savings_defence_39_14a_tax_deducted DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS interest_income_profit_debt_7b_up_to_5m_tax_deducted DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS prize_raffle_lottery_quiz_promotional_156_tax_deducted DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS prize_bond_cross_world_puzzle_156_tax_deducted DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS bonus_shares_companies_236f_tax_deducted DECIMAL(15,2) DEFAULT 0,

-- Employment Termination & Benefits
ADD COLUMN IF NOT EXISTS employment_termination_benefits_12_6_avg_rate_tax_deducted DECIMAL(15,2) DEFAULT 0,

-- Salary Arrears
ADD COLUMN IF NOT EXISTS salary_arrears_12_7_relevant_rate_tax_deducted DECIMAL(15,2) DEFAULT 0,

-- Capital Gain
ADD COLUMN IF NOT EXISTS capital_gain_tax_deducted DECIMAL(15,2) DEFAULT 0;

-- Add tax_chargeable calculated columns (system calculated based on TY2025 rates)
ALTER TABLE final_min_income_forms
-- Salary Income (calculated at normal rates)
ADD COLUMN IF NOT EXISTS salary_u_s_12_7_tax_chargeable DECIMAL(15,2) DEFAULT 0,

-- Dividend & Interest Income (different rates as per Excel)
ADD COLUMN IF NOT EXISTS dividend_u_s_150_0pc_share_profit_reit_spv_tax_chargeable DECIMAL(15,2) GENERATED ALWAYS AS (
  COALESCE(dividend_u_s_150_0pc_share_profit_reit_spv, 0) * 0.00  -- 0% rate
) STORED,
ADD COLUMN IF NOT EXISTS dividend_u_s_150_35pc_share_profit_other_spv_tax_chargeable DECIMAL(15,2) GENERATED ALWAYS AS (
  COALESCE(dividend_u_s_150_35pc_share_profit_other_spv, 0) * 0.35  -- 35% rate
) STORED,
ADD COLUMN IF NOT EXISTS dividend_u_s_150_7_5pc_ipp_shares_tax_chargeable DECIMAL(15,2) GENERATED ALWAYS AS (
  COALESCE(dividend_u_s_150_7_5pc_ipp_shares, 0) * 0.075  -- 7.5% rate
) STORED,
ADD COLUMN IF NOT EXISTS dividend_u_s_150_31pc_atl_tax_chargeable DECIMAL(15,2) GENERATED ALWAYS AS (
  COALESCE(dividend_u_s_150_31pc_atl, 0) * 0.31  -- 31% rate
) STORED,

-- Return on Investment in Sukuk (different rates)
ADD COLUMN IF NOT EXISTS return_on_investment_sukuk_u_s_151_1a_10pc_tax_chargeable DECIMAL(15,2) GENERATED ALWAYS AS (
  COALESCE(return_on_investment_sukuk_u_s_151_1a_10pc, 0) * 0.10  -- 10% rate
) STORED,
ADD COLUMN IF NOT EXISTS return_on_investment_sukuk_u_s_151_1a_12_5pc_tax_chargeable DECIMAL(15,2) GENERATED ALWAYS AS (
  COALESCE(return_on_investment_sukuk_u_s_151_1a_12_5pc, 0) * 0.125  -- 12.5% rate
) STORED,
ADD COLUMN IF NOT EXISTS return_on_investment_sukuk_u_s_151_1a_25pc_tax_chargeable DECIMAL(15,2) GENERATED ALWAYS AS (
  COALESCE(return_on_investment_sukuk_u_s_151_1a_25pc, 0) * 0.25  -- 25% rate
) STORED,
ADD COLUMN IF NOT EXISTS return_invest_exceed_1m_sukuk_saa_12_5pc_tax_chargeable DECIMAL(15,2) GENERATED ALWAYS AS (
  COALESCE(return_invest_exceed_1m_sukuk_saa_12_5pc, 0) * 0.125  -- 12.5% rate
) STORED,
ADD COLUMN IF NOT EXISTS return_invest_not_exceed_1m_sukuk_saa_10pc_tax_chargeable DECIMAL(15,2) GENERATED ALWAYS AS (
  COALESCE(return_invest_not_exceed_1m_sukuk_saa_10pc, 0) * 0.10  -- 10% rate
) STORED,

-- Profit on Debt (different rates)
ADD COLUMN IF NOT EXISTS profit_debt_151a_saa_sab_atl_10pc_non_atl_20pc_tax_chargeable DECIMAL(15,2) GENERATED ALWAYS AS (
  COALESCE(profit_debt_151a_saa_sab_atl_10pc_non_atl_20pc, 0) * 0.10  -- ATL 10%, assuming ATL for calculation
) STORED,
ADD COLUMN IF NOT EXISTS profit_debt_national_savings_defence_39_14a_tax_chargeable DECIMAL(15,2) DEFAULT 0, -- Calculated at relevant year rate
ADD COLUMN IF NOT EXISTS interest_income_profit_debt_7b_up_to_5m_tax_chargeable DECIMAL(15,2) GENERATED ALWAYS AS (
  COALESCE(interest_income_profit_debt_7b_up_to_5m, 0) * 0.15  -- 15% rate for 7B
) STORED,
ADD COLUMN IF NOT EXISTS prize_raffle_lottery_quiz_promotional_156_tax_chargeable DECIMAL(15,2) GENERATED ALWAYS AS (
  COALESCE(prize_raffle_lottery_quiz_promotional_156, 0) * 0.20  -- 20% rate for prizes
) STORED,
ADD COLUMN IF NOT EXISTS prize_bond_cross_world_puzzle_156_tax_chargeable DECIMAL(15,2) GENERATED ALWAYS AS (
  COALESCE(prize_bond_cross_world_puzzle_156, 0) * 0.20  -- 20% rate for prize bonds
) STORED,
ADD COLUMN IF NOT EXISTS bonus_shares_companies_236f_tax_chargeable DECIMAL(15,2) GENERATED ALWAYS AS (
  COALESCE(bonus_shares_companies_236f, 0) * 0.15  -- 15% rate for bonus shares
) STORED,

-- Employment Termination & Benefits (at average rate - calculated separately)
ADD COLUMN IF NOT EXISTS employment_termination_benefits_12_6_avg_rate_tax_chargeable DECIMAL(15,2) DEFAULT 0,

-- Salary Arrears (at relevant rate - calculated separately)
ADD COLUMN IF NOT EXISTS salary_arrears_12_7_relevant_rate_tax_chargeable DECIMAL(15,2) DEFAULT 0,

-- Capital Gain (linked to capital gain sheet)
ADD COLUMN IF NOT EXISTS capital_gain_tax_chargeable DECIMAL(15,2) DEFAULT 0;

-- Re-create subtotal and grand total with all amounts
ALTER TABLE final_min_income_forms
ADD COLUMN subtotal_amount DECIMAL(15,2) GENERATED ALWAYS AS (
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
  COALESCE(interest_income_profit_debt_7b_up_to_5m, 0) +
  COALESCE(prize_raffle_lottery_quiz_promotional_156, 0) +
  COALESCE(prize_bond_cross_world_puzzle_156, 0) +
  COALESCE(bonus_shares_companies_236f, 0) +
  COALESCE(employment_termination_benefits_12_6_avg_rate, 0) +
  COALESCE(salary_arrears_12_7_relevant_rate, 0)
) STORED,

ADD COLUMN subtotal_tax_deducted DECIMAL(15,2) GENERATED ALWAYS AS (
  COALESCE(salary_u_s_12_7_tax_deducted, 0) +
  COALESCE(dividend_u_s_150_0pc_share_profit_reit_spv_tax_deducted, 0) +
  COALESCE(dividend_u_s_150_35pc_share_profit_other_spv_tax_deducted, 0) +
  COALESCE(dividend_u_s_150_7_5pc_ipp_shares_tax_deducted, 0) +
  COALESCE(dividend_u_s_150_31pc_atl_tax_deducted, 0) +
  COALESCE(return_on_investment_sukuk_u_s_151_1a_10pc_tax_deducted, 0) +
  COALESCE(return_on_investment_sukuk_u_s_151_1a_12_5pc_tax_deducted, 0) +
  COALESCE(return_on_investment_sukuk_u_s_151_1a_25pc_tax_deducted, 0) +
  COALESCE(return_invest_exceed_1m_sukuk_saa_12_5pc_tax_deducted, 0) +
  COALESCE(return_invest_not_exceed_1m_sukuk_saa_10pc_tax_deducted, 0) +
  COALESCE(profit_debt_151a_saa_sab_atl_10pc_non_atl_20pc_tax_deducted, 0) +
  COALESCE(profit_debt_national_savings_defence_39_14a_tax_deducted, 0) +
  COALESCE(interest_income_profit_debt_7b_up_to_5m_tax_deducted, 0) +
  COALESCE(prize_raffle_lottery_quiz_promotional_156_tax_deducted, 0) +
  COALESCE(prize_bond_cross_world_puzzle_156_tax_deducted, 0) +
  COALESCE(bonus_shares_companies_236f_tax_deducted, 0) +
  COALESCE(employment_termination_benefits_12_6_avg_rate_tax_deducted, 0) +
  COALESCE(salary_arrears_12_7_relevant_rate_tax_deducted, 0)
) STORED,

ADD COLUMN subtotal_tax_chargeable DECIMAL(15,2) GENERATED ALWAYS AS (
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

-- Grand totals including capital gain
ADD COLUMN grand_total_amount DECIMAL(15,2) GENERATED ALWAYS AS (
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
  COALESCE(interest_income_profit_debt_7b_up_to_5m, 0) +
  COALESCE(prize_raffle_lottery_quiz_promotional_156, 0) +
  COALESCE(prize_bond_cross_world_puzzle_156, 0) +
  COALESCE(bonus_shares_companies_236f, 0) +
  COALESCE(employment_termination_benefits_12_6_avg_rate, 0) +
  COALESCE(salary_arrears_12_7_relevant_rate, 0) +
  COALESCE(capital_gain, 0)
) STORED,

ADD COLUMN grand_total_tax_deducted DECIMAL(15,2) GENERATED ALWAYS AS (
  COALESCE(salary_u_s_12_7_tax_deducted, 0) +
  COALESCE(dividend_u_s_150_0pc_share_profit_reit_spv_tax_deducted, 0) +
  COALESCE(dividend_u_s_150_35pc_share_profit_other_spv_tax_deducted, 0) +
  COALESCE(dividend_u_s_150_7_5pc_ipp_shares_tax_deducted, 0) +
  COALESCE(dividend_u_s_150_31pc_atl_tax_deducted, 0) +
  COALESCE(return_on_investment_sukuk_u_s_151_1a_10pc_tax_deducted, 0) +
  COALESCE(return_on_investment_sukuk_u_s_151_1a_12_5pc_tax_deducted, 0) +
  COALESCE(return_on_investment_sukuk_u_s_151_1a_25pc_tax_deducted, 0) +
  COALESCE(return_invest_exceed_1m_sukuk_saa_12_5pc_tax_deducted, 0) +
  COALESCE(return_invest_not_exceed_1m_sukuk_saa_10pc_tax_deducted, 0) +
  COALESCE(profit_debt_151a_saa_sab_atl_10pc_non_atl_20pc_tax_deducted, 0) +
  COALESCE(profit_debt_national_savings_defence_39_14a_tax_deducted, 0) +
  COALESCE(interest_income_profit_debt_7b_up_to_5m_tax_deducted, 0) +
  COALESCE(prize_raffle_lottery_quiz_promotional_156_tax_deducted, 0) +
  COALESCE(prize_bond_cross_world_puzzle_156_tax_deducted, 0) +
  COALESCE(bonus_shares_companies_236f_tax_deducted, 0) +
  COALESCE(employment_termination_benefits_12_6_avg_rate_tax_deducted, 0) +
  COALESCE(salary_arrears_12_7_relevant_rate_tax_deducted, 0) +
  COALESCE(capital_gain_tax_deducted, 0)
) STORED,

ADD COLUMN grand_total_tax_chargeable DECIMAL(15,2) GENERATED ALWAYS AS (
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

-- Add comments for the new columns
COMMENT ON COLUMN final_min_income_forms.subtotal_amount IS 'Subtotal of all income amounts - sum of above';
COMMENT ON COLUMN final_min_income_forms.subtotal_tax_deducted IS 'Subtotal of all tax deducted amounts';
COMMENT ON COLUMN final_min_income_forms.subtotal_tax_chargeable IS 'Subtotal of all tax chargeable amounts computed based on TY2025 rates';
COMMENT ON COLUMN final_min_income_forms.grand_total_amount IS 'Grand total including capital gain - sum of above';
COMMENT ON COLUMN final_min_income_forms.grand_total_tax_deducted IS 'Grand total of all tax deducted including capital gain';
COMMENT ON COLUMN final_min_income_forms.grand_total_tax_chargeable IS 'Grand total of all tax chargeable including capital gain';