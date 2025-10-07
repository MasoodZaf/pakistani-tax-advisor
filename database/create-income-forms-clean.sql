-- Clean creation of income_forms table

-- Create the table with Excel-compliant structure
CREATE TABLE income_forms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tax_return_id UUID,
    user_id UUID NOT NULL,
    user_email VARCHAR(255),
    tax_year_id UUID,
    tax_year VARCHAR(10) NOT NULL,
    
    -- Excel Income Sheet Fields (exact mapping)
    annual_basic_salary DECIMAL(15,2) DEFAULT 0,
    allowances DECIMAL(15,2) DEFAULT 0,
    bonus DECIMAL(15,2) DEFAULT 0,
    medical_allowance DECIMAL(15,2) DEFAULT 0,
    pension_from_ex_employer DECIMAL(15,2) DEFAULT 0,
    employment_termination_payment DECIMAL(15,2) DEFAULT 0,
    retirement_from_approved_funds DECIMAL(15,2) DEFAULT 0,
    directorship_fee DECIMAL(15,2) DEFAULT 0,
    other_cash_benefits DECIMAL(15,2) DEFAULT 0,
    employer_contribution_provident DECIMAL(15,2) DEFAULT 0,
    taxable_car_value DECIMAL(15,2) DEFAULT 0,
    other_taxable_subsidies DECIMAL(15,2) DEFAULT 0,
    profit_on_debt_15_percent DECIMAL(15,2) DEFAULT 0,
    profit_on_debt_12_5_percent DECIMAL(15,2) DEFAULT 0,
    other_taxable_income_rent DECIMAL(15,2) DEFAULT 0,
    other_taxable_income_others DECIMAL(15,2) DEFAULT 0,
    
    -- Excel Calculated Fields
    income_exempt_from_tax DECIMAL(15,2) GENERATED ALWAYS AS 
        (-(COALESCE(retirement_from_approved_funds,0) + 
           COALESCE(employment_termination_payment,0) + 
           COALESCE(medical_allowance,0))) STORED,
    
    annual_salary_wages_total DECIMAL(15,2) GENERATED ALWAYS AS
        (COALESCE(annual_basic_salary,0) + 
         COALESCE(allowances,0) + 
         COALESCE(bonus,0) + 
         COALESCE(medical_allowance,0) + 
         COALESCE(pension_from_ex_employer,0) + 
         COALESCE(employment_termination_payment,0) + 
         COALESCE(retirement_from_approved_funds,0) + 
         COALESCE(directorship_fee,0) + 
         COALESCE(other_cash_benefits,0) +
         (-(COALESCE(retirement_from_approved_funds,0) + 
            COALESCE(employment_termination_payment,0) + 
            COALESCE(medical_allowance,0)))) STORED,
    
    non_cash_benefit_exempt DECIMAL(15,2) GENERATED ALWAYS AS
        (-(LEAST(COALESCE(employer_contribution_provident,0), 150000))) STORED,
    
    total_non_cash_benefits DECIMAL(15,2) GENERATED ALWAYS AS
        (COALESCE(employer_contribution_provident,0) + 
         COALESCE(taxable_car_value,0) + 
         COALESCE(other_taxable_subsidies,0) + 
         (-(LEAST(COALESCE(employer_contribution_provident,0), 150000)))) STORED,
    
    other_income_min_tax_total DECIMAL(15,2) GENERATED ALWAYS AS
        (COALESCE(profit_on_debt_15_percent,0) + 
         COALESCE(profit_on_debt_12_5_percent,0)) STORED,
    
    other_income_no_min_tax_total DECIMAL(15,2) GENERATED ALWAYS AS
        (COALESCE(other_taxable_income_rent,0) + 
         COALESCE(other_taxable_income_others,0)) STORED,
    
    total_employment_income DECIMAL(15,2) GENERATED ALWAYS AS
        ((COALESCE(annual_basic_salary,0) + 
          COALESCE(allowances,0) + 
          COALESCE(bonus,0) + 
          COALESCE(medical_allowance,0) + 
          COALESCE(pension_from_ex_employer,0) + 
          COALESCE(employment_termination_payment,0) + 
          COALESCE(retirement_from_approved_funds,0) + 
          COALESCE(directorship_fee,0) + 
          COALESCE(other_cash_benefits,0) +
          (-(COALESCE(retirement_from_approved_funds,0) + 
             COALESCE(employment_termination_payment,0) + 
             COALESCE(medical_allowance,0)))) +
         (COALESCE(employer_contribution_provident,0) + 
          COALESCE(taxable_car_value,0) + 
          COALESCE(other_taxable_subsidies,0) + 
          (-(LEAST(COALESCE(employer_contribution_provident,0), 150000))))) STORED,
    
    -- Metadata
    is_complete BOOLEAN DEFAULT false,
    last_updated_by UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Unique constraint
    CONSTRAINT income_forms_user_tax_year_unique UNIQUE (user_id, tax_year)
);

-- Test with Excel sample data
INSERT INTO income_forms (
    user_id, tax_year, annual_basic_salary, allowances, bonus, medical_allowance,
    pension_from_ex_employer, employment_termination_payment, retirement_from_approved_funds,
    directorship_fee, other_cash_benefits, employer_contribution_provident,
    taxable_car_value, other_taxable_subsidies, profit_on_debt_15_percent,
    profit_on_debt_12_5_percent, other_taxable_income_rent, other_taxable_income_others
) VALUES (
    '00000000-0000-0000-0000-000000000001', '2025-26',
    7200000, 6000000, 1500000, 720000,
    400000, 2000000, 5000000, 40000, 1200000, 720000,
    1500000, 200000, 700000, 1500000, 700000, 50000
);

-- Verify Excel calculations
SELECT 
    'TEST RESULTS' as status,
    income_exempt_from_tax as b15_result,
    CASE WHEN income_exempt_from_tax = -7720000 THEN '✅ B15 PASS' ELSE '❌ B15 FAIL' END as b15_status,
    annual_salary_wages_total as b16_result,
    CASE WHEN annual_salary_wages_total = 16340000 THEN '✅ B16 PASS' ELSE '❌ B16 FAIL' END as b16_status,
    total_non_cash_benefits as b23_result,
    CASE WHEN total_non_cash_benefits = 2270000 THEN '✅ B23 PASS' ELSE '❌ B23 FAIL' END as b23_status
FROM income_forms 
WHERE user_id = '00000000-0000-0000-0000-000000000001';

-- Clean up
DELETE FROM income_forms WHERE user_id = '00000000-0000-0000-0000-000000000001';

SELECT 'SUCCESS: income_forms table created with Excel compliance!' as final_status;