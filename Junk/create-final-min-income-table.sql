-- Create final_min_income_forms table for Income Subject to Final/Fixed/Minimum/Average/Relevant/Reduced Tax

CREATE TABLE IF NOT EXISTS final_min_income_forms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tax_return_id UUID NOT NULL,
  user_id UUID NOT NULL,
  user_email VARCHAR(255) NOT NULL,
  tax_year_id UUID NOT NULL,
  tax_year VARCHAR(10) NOT NULL,
  
  -- Salary Income
  salary_u_s_12_7 DECIMAL(15,2) DEFAULT 0,
  
  -- Dividend & Interest Income
  dividend_u_s_150_exempt_profit_rate_mlt_30 DECIMAL(15,2) DEFAULT 0,
  dividend_u_s_150_31_atl_15pc DECIMAL(15,2) DEFAULT 0,
  dividend_u_s_150_56_10_shares DECIMAL(15,2) DEFAULT 0,
  
  -- Investment Returns
  return_on_investment_sukuk_u_s_151_1a_10pc DECIMAL(15,2) DEFAULT 0,
  return_on_investment_sukuk_u_s_151_1a_12_5pc DECIMAL(15,2) DEFAULT 0,
  return_on_investment_sukuk_u_s_151_1b_15pc DECIMAL(15,2) DEFAULT 0,
  return_on_investment_exceeding_1_million_sukuk_u_s_saa_12_5pc_u_s_151_1a DECIMAL(15,2) DEFAULT 0,
  return_on_investment_not_exceeding_1_million_sukuk_u_s_saa_10pc_u_s_151_1a DECIMAL(15,2) DEFAULT 0,
  
  -- Profit on Debt
  profit_on_debt_u_s_151a_saa_sab_part_ii_second_schedule_atl_10pc_non_atl_20pc DECIMAL(15,2) DEFAULT 0,
  profit_on_debt_national_savings_certificates_including_defence_saving_pertaining_to_services_u_s_39_14a DECIMAL(15,2) DEFAULT 0,
  profit_on_debt_u_s_7b DECIMAL(15,2) DEFAULT 0,
  prize_on_raffle_lottery_quiz_as_promotional_offer_u_s_156 DECIMAL(15,2) DEFAULT 0,
  bonus_shares_issued_by_companies_u_s_236f DECIMAL(15,2) DEFAULT 0,
  
  -- Employment Termination & Benefits
  employment_termination_benefits_u_s_12_6_chargeable_to_tax_at_average_rate DECIMAL(15,2) DEFAULT 0,
  
  -- Other Income Sources
  salary_arrears_u_s_12_7_chargeable_to_tax_at_relevant_rate DECIMAL(15,2) DEFAULT 0,
  
  -- Capital Gain from separate form
  capital_gain DECIMAL(15,2) DEFAULT 0,
  
  -- Calculated totals
  subtotal DECIMAL(15,2) GENERATED ALWAYS AS (
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
  ) STORED,
  
  grand_total DECIMAL(15,2) GENERATED ALWAYS AS (
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
    COALESCE(salary_arrears_u_s_12_7_chargeable_to_tax_at_relevant_rate, 0) +
    COALESCE(capital_gain, 0)
  ) STORED,
  
  -- Form completion status
  is_complete BOOLEAN DEFAULT FALSE,
  
  -- Audit fields
  last_updated_by UUID,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Foreign key constraints
  CONSTRAINT fk_final_min_income_tax_return FOREIGN KEY (tax_return_id) REFERENCES tax_returns(id),
  CONSTRAINT fk_final_min_income_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_final_min_income_tax_year FOREIGN KEY (tax_year_id, tax_year) REFERENCES tax_years(id, tax_year),
  CONSTRAINT fk_final_min_income_user_email FOREIGN KEY (user_id, user_email) REFERENCES users(id, email),
  CONSTRAINT fk_final_min_income_last_updated_by FOREIGN KEY (last_updated_by) REFERENCES users(id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_final_min_income_forms_return ON final_min_income_forms(tax_return_id);
CREATE INDEX IF NOT EXISTS idx_final_min_income_forms_user ON final_min_income_forms(user_id, user_email);
CREATE INDEX IF NOT EXISTS idx_final_min_income_forms_year ON final_min_income_forms(tax_year_id, tax_year);

-- Create update trigger for updated_at
CREATE TRIGGER update_final_min_income_forms_updated_at
    BEFORE UPDATE ON final_min_income_forms
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create audit trigger
CREATE TRIGGER audit_final_min_income_forms_trigger
    AFTER INSERT OR UPDATE OR DELETE ON final_min_income_forms
    FOR EACH ROW
    EXECUTE FUNCTION audit_trigger_function();

-- Comment on the table
COMMENT ON TABLE final_min_income_forms IS 'Income Subject to Final/Fixed/Minimum/Average/Relevant/Reduced Tax - specialized Pakistani tax categories with fixed tax rates';