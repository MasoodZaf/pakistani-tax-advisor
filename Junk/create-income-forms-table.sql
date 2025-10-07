-- Create income_forms table to store the Detail of Income Subject to Normal Taxation
CREATE TABLE IF NOT EXISTS income_forms (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tax_year VARCHAR(10) NOT NULL DEFAULT '2025-26',

    -- Payments By Employer - Annual Salary and Wages (Input Fields)
    annual_basic_salary DECIMAL(15,2) DEFAULT 0,
    allowances DECIMAL(15,2) DEFAULT 0,
    bonus DECIMAL(15,2) DEFAULT 0,
    medical_allowance DECIMAL(15,2) DEFAULT 0,
    pension_from_ex_employer DECIMAL(15,2) DEFAULT 0,
    employment_termination_payment DECIMAL(15,2) DEFAULT 0,
    retirement_from_approved_funds DECIMAL(15,2) DEFAULT 0,
    directorship_fee DECIMAL(15,2) DEFAULT 0,
    other_cash_benefits DECIMAL(15,2) DEFAULT 0,

    -- Calculated Fields for Payments By Employer
    income_exempt_from_tax DECIMAL(15,2) GENERATED ALWAYS AS (-(annual_basic_salary + allowances + bonus)) STORED,
    employment_termination_total DECIMAL(15,2) GENERATED ALWAYS AS (
        annual_basic_salary + allowances + bonus + medical_allowance +
        pension_from_ex_employer + employment_termination_payment +
        retirement_from_approved_funds + directorship_fee + other_cash_benefits
    ) STORED,

    -- Non cash benefits (Input Fields)
    employer_contribution_provident DECIMAL(15,2) DEFAULT 0,
    taxable_car_value DECIMAL(15,2) DEFAULT 0,
    other_taxable_subsidies DECIMAL(15,2) DEFAULT 0,

    -- Calculated Fields for Non cash benefits
    non_cash_benefit_exempt DECIMAL(15,2) GENERATED ALWAYS AS (
        -((employer_contribution_provident + taxable_car_value + other_taxable_subsidies) * 0.1)
    ) STORED,
    total_non_cash_benefits DECIMAL(15,2) GENERATED ALWAYS AS (
        employer_contribution_provident + taxable_car_value + other_taxable_subsidies
    ) STORED,

    -- Other Income (Subject to minimum tax) (Input Fields)
    profit_on_debt_15_percent DECIMAL(15,2) DEFAULT 0,
    profit_on_debt_12_5_percent DECIMAL(15,2) DEFAULT 0,

    -- Calculated Fields for Other Income (Subject to minimum tax)
    other_income_min_tax_total DECIMAL(15,2) GENERATED ALWAYS AS (
        profit_on_debt_15_percent + profit_on_debt_12_5_percent
    ) STORED,

    -- Other Income (Not Subject to minimum tax) (Input Fields)
    other_taxable_income_rent DECIMAL(15,2) DEFAULT 0,
    other_taxable_income_others DECIMAL(15,2) DEFAULT 0,

    -- Calculated Fields for Other Income (Not Subject to minimum tax)
    other_income_no_min_tax_total DECIMAL(15,2) GENERATED ALWAYS AS (
        other_taxable_income_rent + other_taxable_income_others
    ) STORED,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Unique constraint to ensure one record per user per tax year
    UNIQUE(user_id, tax_year)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_income_forms_user_tax_year ON income_forms(user_id, tax_year);
CREATE INDEX IF NOT EXISTS idx_income_forms_tax_year ON income_forms(tax_year);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_income_forms_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_income_forms_updated_at ON income_forms;
CREATE TRIGGER trigger_update_income_forms_updated_at
    BEFORE UPDATE ON income_forms
    FOR EACH ROW
    EXECUTE FUNCTION update_income_forms_updated_at();

-- Add comments to describe the table and important columns
COMMENT ON TABLE income_forms IS 'Stores Detail of Income Subject to Normal Taxation for tax returns';
COMMENT ON COLUMN income_forms.tax_year IS 'Tax year in format YYYY-YY (e.g., 2025-26)';
COMMENT ON COLUMN income_forms.income_exempt_from_tax IS 'Calculated as negative sum of basic salary, allowances, and bonus';
COMMENT ON COLUMN income_forms.employment_termination_total IS 'Sum of all employment-related payments';
COMMENT ON COLUMN income_forms.non_cash_benefit_exempt IS 'Calculated as 10% exemption on non-cash benefits';
COMMENT ON COLUMN income_forms.total_non_cash_benefits IS 'Sum of all non-cash benefits';
COMMENT ON COLUMN income_forms.other_income_min_tax_total IS 'Sum of income subject to minimum tax';
COMMENT ON COLUMN income_forms.other_income_no_min_tax_total IS 'Sum of income not subject to minimum tax';