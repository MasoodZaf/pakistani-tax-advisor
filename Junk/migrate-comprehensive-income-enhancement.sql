-- Comprehensive Income Form Enhancement Migration
-- Add all Pakistani tax law income categories as per Excel structure
-- Run this to upgrade income_forms table for comprehensive tax categories

-- Drop existing generated columns first
ALTER TABLE income_forms 
    DROP COLUMN IF EXISTS total_gross_income,
    DROP COLUMN IF EXISTS total_exempt_income,
    DROP COLUMN IF EXISTS total_taxable_income;

-- Add comprehensive income fields based on Pakistani tax law provisions

-- Salary Income
ALTER TABLE income_forms ADD COLUMN IF NOT EXISTS salary_u_s_12_7 DECIMAL(15,2) DEFAULT 0;

-- Dividend & Interest Income
ALTER TABLE income_forms ADD COLUMN IF NOT EXISTS dividend_u_s_150_exempt_profit_rate_mlt_30 DECIMAL(15,2) DEFAULT 0;
ALTER TABLE income_forms ADD COLUMN IF NOT EXISTS dividend_u_s_150_31_atl_15pc DECIMAL(15,2) DEFAULT 0;
ALTER TABLE income_forms ADD COLUMN IF NOT EXISTS dividend_u_s_150_56_10_shares DECIMAL(15,2) DEFAULT 0;

-- Investment Returns
ALTER TABLE income_forms ADD COLUMN IF NOT EXISTS return_on_investment_sukuk_u_s_151_1a_10pc DECIMAL(15,2) DEFAULT 0;
ALTER TABLE income_forms ADD COLUMN IF NOT EXISTS return_on_investment_sukuk_u_s_151_1a_12_5pc DECIMAL(15,2) DEFAULT 0;
ALTER TABLE income_forms ADD COLUMN IF NOT EXISTS return_on_investment_sukuk_u_s_151_1b_15pc DECIMAL(15,2) DEFAULT 0;
ALTER TABLE income_forms ADD COLUMN IF NOT EXISTS return_on_investment_exceeding_1_million_sukuk_u_s_saa_12_5pc_u_s_151_1a DECIMAL(15,2) DEFAULT 0;
ALTER TABLE income_forms ADD COLUMN IF NOT EXISTS return_on_investment_not_exceeding_1_million_sukuk_u_s_saa_10pc_u_s_151_1a DECIMAL(15,2) DEFAULT 0;

-- Profit on Debt
ALTER TABLE income_forms ADD COLUMN IF NOT EXISTS profit_on_debt_u_s_151a_saa_sab_part_ii_second_schedule_atl_10pc_non_atl_20pc DECIMAL(15,2) DEFAULT 0;
ALTER TABLE income_forms ADD COLUMN IF NOT EXISTS profit_on_debt_national_savings_certificates_including_defence_saving_pertaining_to_services_u_s_39_14a DECIMAL(15,2) DEFAULT 0;
ALTER TABLE income_forms ADD COLUMN IF NOT EXISTS profit_on_debt_u_s_7b DECIMAL(15,2) DEFAULT 0;
ALTER TABLE income_forms ADD COLUMN IF NOT EXISTS prize_on_raffle_lottery_quiz_as_promotional_offer_u_s_156 DECIMAL(15,2) DEFAULT 0;
ALTER TABLE income_forms ADD COLUMN IF NOT EXISTS bonus_shares_issued_by_companies_u_s_236f DECIMAL(15,2) DEFAULT 0;

-- Employment Termination & Benefits
ALTER TABLE income_forms ADD COLUMN IF NOT EXISTS employment_termination_benefits_u_s_12_6_chargeable_to_tax_at_average_rate DECIMAL(15,2) DEFAULT 0;

-- Other Income Sources
ALTER TABLE income_forms ADD COLUMN IF NOT EXISTS salary_arrears_u_s_12_7_chargeable_to_tax_at_relevant_rate DECIMAL(15,2) DEFAULT 0;

-- Totals fields - Subtotal, Capital Gain, Grand Total
ALTER TABLE income_forms ADD COLUMN IF NOT EXISTS subtotal DECIMAL(15,2) DEFAULT 0;
ALTER TABLE income_forms ADD COLUMN IF NOT EXISTS capital_gain DECIMAL(15,2) DEFAULT 0;
ALTER TABLE income_forms ADD COLUMN IF NOT EXISTS grand_total DECIMAL(15,2) DEFAULT 0;

-- Add generated columns for automatic calculation
ALTER TABLE income_forms ADD COLUMN subtotal_calculated DECIMAL(15,2) GENERATED ALWAYS AS (
    COALESCE(salary_u_s_12_7, 0) +
    COALESCE(dividend_u_s_150_exempt_profit_rate_mlt_30, 0) +
    COALESCE(dividend_u_s_150_31_atl_15pc, 0) +
    COALESCE(dividend_u_s_150_56_10_shares, 0) +
    COALESCE(return_on_investment_sukuk_u_s_151_1a_10pc, 0) +
    COALESCE(return_on_investment_sukuk_u_s_151_1a_12_5pc, 0) +
    COALESCE(return_on_investment_sukuk_u_s_151_1b_15pc, 0) +
    COALESCE(return_on_investment_exceeding_1_million_sukuk_u_s_saa_12_5pc_u_s_151_1a, 0) +
    COALESCE(return_on_investment_not_exceeding_1_million_sukuk_u_s_saa_10pc_u_s_151_1a, 0) +
    COALESCE(profit_on_debt_u_s_151a_saa_sab_part_ii_second_schedule_atl_10pc_non_atl_20pc, 0) +
    COALESCE(profit_on_debt_national_savings_certificates_including_defence_saving_pertaining_to_services_u_s_39_14a, 0) +
    COALESCE(profit_on_debt_u_s_7b, 0) +
    COALESCE(prize_on_raffle_lottery_quiz_as_promotional_offer_u_s_156, 0) +
    COALESCE(bonus_shares_issued_by_companies_u_s_236f, 0) +
    COALESCE(employment_termination_benefits_u_s_12_6_chargeable_to_tax_at_average_rate, 0) +
    COALESCE(salary_arrears_u_s_12_7_chargeable_to_tax_at_relevant_rate, 0)
) STORED;

ALTER TABLE income_forms ADD COLUMN grand_total_calculated DECIMAL(15,2) GENERATED ALWAYS AS (
    COALESCE(subtotal_calculated, 0) + COALESCE(capital_gain, 0)
) STORED;

-- Add indexes for better performance on the new fields
CREATE INDEX IF NOT EXISTS idx_income_forms_comprehensive_subtotal ON income_forms(subtotal_calculated);
CREATE INDEX IF NOT EXISTS idx_income_forms_comprehensive_grand_total ON income_forms(grand_total_calculated);

-- Add comments for documentation
COMMENT ON COLUMN income_forms.salary_u_s_12_7 IS 'Salary u/s 12(7) - Basic salary income';
COMMENT ON COLUMN income_forms.dividend_u_s_150_exempt_profit_rate_mlt_30 IS 'Dividend u/s 150 (Exempt profit rate MLT 30)';
COMMENT ON COLUMN income_forms.dividend_u_s_150_31_atl_15pc IS 'Dividend u/s 150 (31% ATL u/s 15%)';
COMMENT ON COLUMN income_forms.dividend_u_s_150_56_10_shares IS 'Dividend u/s 150 @ 56/10 Shares';
COMMENT ON COLUMN income_forms.return_on_investment_sukuk_u_s_151_1a_10pc IS 'Return on Investment in Sukuk u/s 151(1A) @ 10%';
COMMENT ON COLUMN income_forms.return_on_investment_sukuk_u_s_151_1a_12_5pc IS 'Return on Investment in Sukuk u/s 151(1A) @ 12.5%';
COMMENT ON COLUMN income_forms.return_on_investment_sukuk_u_s_151_1b_15pc IS 'Return on Investment in Sukuk u/s 151(1B) @ 15%';
COMMENT ON COLUMN income_forms.return_on_investment_exceeding_1_million_sukuk_u_s_saa_12_5pc_u_s_151_1a IS 'Return on investment exceeding 1 million on sukuk u/s SAA @ 12.5% u/s 151(1A), u/s 151(1B)';
COMMENT ON COLUMN income_forms.return_on_investment_not_exceeding_1_million_sukuk_u_s_saa_10pc_u_s_151_1a IS 'Return on investment not exceeding 1 million on sukuk u/s SAA @ 10% u/s 151(1A), u/s 151(1B)';
COMMENT ON COLUMN income_forms.profit_on_debt_u_s_151a_saa_sab_part_ii_second_schedule_atl_10pc_non_atl_20pc IS 'Profit on Debt u/s (151A)/SAA/SAB of Part II, Second Schedule (ATL@10%, non-ATL@20%)';
COMMENT ON COLUMN income_forms.profit_on_debt_national_savings_certificates_including_defence_saving_pertaining_to_services_u_s_39_14a IS 'Profit on debt National Savings Certificates including Defence Saving pertaining to services u/s 39(14A)';
COMMENT ON COLUMN income_forms.profit_on_debt_u_s_7b IS 'Profit on debt u/s 7B';
COMMENT ON COLUMN income_forms.prize_on_raffle_lottery_quiz_as_promotional_offer_u_s_156 IS 'Prize on Raffle/Lottery/Quiz as promotional offer u/s 156';
COMMENT ON COLUMN income_forms.bonus_shares_issued_by_companies_u_s_236f IS 'Bonus shares issued by companies u/s 236F';
COMMENT ON COLUMN income_forms.employment_termination_benefits_u_s_12_6_chargeable_to_tax_at_average_rate IS 'Employment Termination Benefits u/s 12(6) Chargeable to Tax at Average Rate';
COMMENT ON COLUMN income_forms.salary_arrears_u_s_12_7_chargeable_to_tax_at_relevant_rate IS 'Salary Arrears u/s 12(7) Chargeable to Tax at Relevant Rate';
COMMENT ON COLUMN income_forms.subtotal IS 'Subtotal - Sum of all income fields entered by user';
COMMENT ON COLUMN income_forms.capital_gain IS 'Capital Gain from separate Capital Gain form';
COMMENT ON COLUMN income_forms.grand_total IS 'Grand Total - Subtotal + Capital Gain';
COMMENT ON COLUMN income_forms.subtotal_calculated IS 'Auto-calculated subtotal of all comprehensive income fields';
COMMENT ON COLUMN income_forms.grand_total_calculated IS 'Auto-calculated grand total (subtotal + capital gain)';

-- Update table comment
COMMENT ON TABLE income_forms IS 'Comprehensive Income forms covering all Pakistani tax law income categories as per FBR provisions';

-- Display success message
SELECT 'Comprehensive Income Form Enhancement Migration completed successfully!' AS message;