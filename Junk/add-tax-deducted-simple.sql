-- Add tax_deducted columns for the 3-column structure
-- Amount/Receipt, Tax Deducted, Tax Chargeable

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