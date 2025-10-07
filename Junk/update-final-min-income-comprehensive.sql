-- Update final_min_income_forms table to match comprehensive Excel structure
-- Adding all missing fields from the Excel reference

-- First, drop the existing calculated columns to allow for updates
ALTER TABLE final_min_income_forms
DROP COLUMN IF EXISTS subtotal,
DROP COLUMN IF EXISTS grand_total;

-- Add missing dividend fields
ALTER TABLE final_min_income_forms
ADD COLUMN IF NOT EXISTS dividend_u_s_150_0pc_share_profit_reit_spv DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS dividend_u_s_150_35pc_share_profit_other_spv DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS dividend_u_s_150_7_5pc_ipp_shares DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS dividend_u_s_150_31pc_atl DECIMAL(15,2) DEFAULT 0;

-- Add missing investment/interest fields
ALTER TABLE final_min_income_forms
ADD COLUMN IF NOT EXISTS return_on_investment_sukuk_u_s_151_1a_25pc DECIMAL(15,2) DEFAULT 0;

-- Add specific profit on debt fields
ALTER TABLE final_min_income_forms
ADD COLUMN IF NOT EXISTS interest_income_profit_on_debt_u_s_7b_profit_up_to_5m DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS prize_on_prize_bond_cross_world_puzzle_u_s_156 DECIMAL(15,2) DEFAULT 0;

-- Add bonus shares field with correct name
ALTER TABLE final_min_income_forms
ADD COLUMN IF NOT EXISTS bonus_shares_issued_by_companies_u_s_236f_value_received DECIMAL(15,2) DEFAULT 0;

-- Add salary arrears with specific calculation method
ALTER TABLE final_min_income_forms
ADD COLUMN IF NOT EXISTS salary_arrears_u_s_12_7_chargeable_tax_relevant_rate DECIMAL(15,2) DEFAULT 0;

-- Add notes/description columns for user guidance
ALTER TABLE final_min_income_forms
ADD COLUMN IF NOT EXISTS field_notes JSONB DEFAULT '{}';

-- Re-create the calculated subtotal column with all fields
ALTER TABLE final_min_income_forms
ADD COLUMN subtotal DECIMAL(15,2) GENERATED ALWAYS AS (
  COALESCE(salary_u_s_12_7, 0) +
  COALESCE(dividend_u_s_150_exempt_profit_rate_mlt_30, 0) +
  COALESCE(dividend_u_s_150_31_atl_15pc, 0) +
  COALESCE(dividend_u_s_150_56_10_shares, 0) +
  COALESCE(dividend_u_s_150_0pc_share_profit_reit_spv, 0) +
  COALESCE(dividend_u_s_150_35pc_share_profit_other_spv, 0) +
  COALESCE(dividend_u_s_150_7_5pc_ipp_shares, 0) +
  COALESCE(dividend_u_s_150_31pc_atl, 0) +
  COALESCE(return_on_investment_sukuk_u_s_151_1a_10pc, 0) +
  COALESCE(return_on_investment_sukuk_u_s_151_1a_12_5pc, 0) +
  COALESCE(return_on_investment_sukuk_u_s_151_1a_25pc, 0) +
  COALESCE(return_on_investment_sukuk_u_s_151_1b_15pc, 0) +
  COALESCE(return_on_investment_exceeding_1_million_sukuk_u_s_saa_12_5pc_u_s_151_1a, 0) +
  COALESCE(return_on_investment_not_exceeding_1_million_sukuk_u_s_saa_10pc_u_s_151_1a, 0) +
  COALESCE(profit_on_debt_u_s_151a_saa_sab_part_ii_second_schedule_atl_10pc_non_atl_20pc, 0) +
  COALESCE(profit_on_debt_national_savings_certificates_including_defence_saving_pertaining_to_services_u_s_39_14a, 0) +
  COALESCE(profit_on_debt_u_s_7b, 0) +
  COALESCE(interest_income_profit_on_debt_u_s_7b_profit_up_to_5m, 0) +
  COALESCE(prize_on_raffle_lottery_quiz_as_promotional_offer_u_s_156, 0) +
  COALESCE(prize_on_prize_bond_cross_world_puzzle_u_s_156, 0) +
  COALESCE(bonus_shares_issued_by_companies_u_s_236f, 0) +
  COALESCE(bonus_shares_issued_by_companies_u_s_236f_value_received, 0) +
  COALESCE(employment_termination_benefits_u_s_12_6_chargeable_to_tax_at_average_rate, 0) +
  COALESCE(salary_arrears_u_s_12_7_chargeable_to_tax_at_relevant_rate, 0) +
  COALESCE(salary_arrears_u_s_12_7_chargeable_tax_relevant_rate, 0)
) STORED;

-- Re-create the grand total column
ALTER TABLE final_min_income_forms
ADD COLUMN grand_total DECIMAL(15,2) GENERATED ALWAYS AS (
  COALESCE(salary_u_s_12_7, 0) +
  COALESCE(dividend_u_s_150_exempt_profit_rate_mlt_30, 0) +
  COALESCE(dividend_u_s_150_31_atl_15pc, 0) +
  COALESCE(dividend_u_s_150_56_10_shares, 0) +
  COALESCE(dividend_u_s_150_0pc_share_profit_reit_spv, 0) +
  COALESCE(dividend_u_s_150_35pc_share_profit_other_spv, 0) +
  COALESCE(dividend_u_s_150_7_5pc_ipp_shares, 0) +
  COALESCE(dividend_u_s_150_31pc_atl, 0) +
  COALESCE(return_on_investment_sukuk_u_s_151_1a_10pc, 0) +
  COALESCE(return_on_investment_sukuk_u_s_151_1a_12_5pc, 0) +
  COALESCE(return_on_investment_sukuk_u_s_151_1a_25pc, 0) +
  COALESCE(return_on_investment_sukuk_u_s_151_1b_15pc, 0) +
  COALESCE(return_on_investment_exceeding_1_million_sukuk_u_s_saa_12_5pc_u_s_151_1a, 0) +
  COALESCE(return_on_investment_not_exceeding_1_million_sukuk_u_s_saa_10pc_u_s_151_1a, 0) +
  COALESCE(profit_on_debt_u_s_151a_saa_sab_part_ii_second_schedule_atl_10pc_non_atl_20pc, 0) +
  COALESCE(profit_on_debt_national_savings_certificates_including_defence_saving_pertaining_to_services_u_s_39_14a, 0) +
  COALESCE(profit_on_debt_u_s_7b, 0) +
  COALESCE(interest_income_profit_on_debt_u_s_7b_profit_up_to_5m, 0) +
  COALESCE(prize_on_raffle_lottery_quiz_as_promotional_offer_u_s_156, 0) +
  COALESCE(prize_on_prize_bond_cross_world_puzzle_u_s_156, 0) +
  COALESCE(bonus_shares_issued_by_companies_u_s_236f, 0) +
  COALESCE(bonus_shares_issued_by_companies_u_s_236f_value_received, 0) +
  COALESCE(employment_termination_benefits_u_s_12_6_chargeable_to_tax_at_average_rate, 0) +
  COALESCE(salary_arrears_u_s_12_7_chargeable_to_tax_at_relevant_rate, 0) +
  COALESCE(salary_arrears_u_s_12_7_chargeable_tax_relevant_rate, 0) +
  COALESCE(capital_gain, 0)
) STORED;

-- Add comments for the new fields
COMMENT ON COLUMN final_min_income_forms.dividend_u_s_150_0pc_share_profit_reit_spv IS 'Dividend u/s 150 @0% share of profit from REIT SPV';
COMMENT ON COLUMN final_min_income_forms.dividend_u_s_150_35pc_share_profit_other_spv IS 'Dividend u/s 150 @35% share of profit from other SPV';
COMMENT ON COLUMN final_min_income_forms.dividend_u_s_150_7_5pc_ipp_shares IS 'Dividend u/s 150 @7.5% IPP Shares';
COMMENT ON COLUMN final_min_income_forms.return_on_investment_sukuk_u_s_151_1a_25pc IS 'Return on Investment in Sukuk u/s 151(1A) @ 25%';
COMMENT ON COLUMN final_min_income_forms.interest_income_profit_on_debt_u_s_7b_profit_up_to_5m IS 'Interest Income - Profit on debt u/s 7B (Profit up to 5m)';
COMMENT ON COLUMN final_min_income_forms.prize_on_prize_bond_cross_world_puzzle_u_s_156 IS 'Prize on Prize Bond/Cross world puzzle u/s 156';
COMMENT ON COLUMN final_min_income_forms.field_notes IS 'JSON field containing notes and descriptions for user guidance';