-- Update income_forms table to match Excel 2025 structure
-- Detail of Income Subject to Normal Taxation

-- Drop old columns that don't match new structure (if they exist)
-- ALTER TABLE income_forms DROP COLUMN IF EXISTS monthly_salary;
-- ALTER TABLE income_forms DROP COLUMN IF EXISTS car_allowance;

-- Add new columns for Payments By Employer section
ALTER TABLE income_forms ADD COLUMN IF NOT EXISTS annual_basic_salary DECIMAL(15,2) DEFAULT 0;
ALTER TABLE income_forms ADD COLUMN IF NOT EXISTS allowances_excluding_bonus_medical DECIMAL(15,2) DEFAULT 0;
ALTER TABLE income_forms ADD COLUMN IF NOT EXISTS bonus DECIMAL(15,2) DEFAULT 0;
ALTER TABLE income_forms ADD COLUMN IF NOT EXISTS medical_allowance DECIMAL(15,2) DEFAULT 0;
ALTER TABLE income_forms ADD COLUMN IF NOT EXISTS pension_from_ex_employer DECIMAL(15,2) DEFAULT 0;
ALTER TABLE income_forms ADD COLUMN IF NOT EXISTS employment_termination_payment DECIMAL(15,2) DEFAULT 0;
ALTER TABLE income_forms ADD COLUMN IF NOT EXISTS retirement_from_approved_funds DECIMAL(15,2) DEFAULT 0;
ALTER TABLE income_forms ADD COLUMN IF NOT EXISTS directorship_fee DECIMAL(15,2) DEFAULT 0;
ALTER TABLE income_forms ADD COLUMN IF NOT EXISTS other_cash_benefits DECIMAL(15,2) DEFAULT 0;
ALTER TABLE income_forms ADD COLUMN IF NOT EXISTS income_exempt_from_tax DECIMAL(15,2) DEFAULT 0;

-- Add computed column for Annual Salary and Wages (sum of above)
ALTER TABLE income_forms ADD COLUMN IF NOT EXISTS annual_salary_and_wages_total DECIMAL(15,2) DEFAULT 0;

-- Add new columns for Non Cash Benefits section
ALTER TABLE income_forms ADD COLUMN IF NOT EXISTS employer_contribution_provident DECIMAL(15,2) DEFAULT 0;
ALTER TABLE income_forms ADD COLUMN IF NOT EXISTS taxable_car_value DECIMAL(15,2) DEFAULT 0;
ALTER TABLE income_forms ADD COLUMN IF NOT EXISTS other_taxable_subsidies DECIMAL(15,2) DEFAULT 0;
ALTER TABLE income_forms ADD COLUMN IF NOT EXISTS non_cash_benefit_exempt DECIMAL(15,2) DEFAULT 0;

-- Add computed column for Total Non Cash Benefits
ALTER TABLE income_forms ADD COLUMN IF NOT EXISTS total_non_cash_benefits DECIMAL(15,2) DEFAULT 0;

-- Add new columns for Other Income (Subject to minimum tax) section
ALTER TABLE income_forms ADD COLUMN IF NOT EXISTS profit_on_debt_15 DECIMAL(15,2) DEFAULT 0;
ALTER TABLE income_forms ADD COLUMN IF NOT EXISTS profit_on_debt_12_5 DECIMAL(15,2) DEFAULT 0;

-- Add computed column for Other Income Subject to Minimum Tax
ALTER TABLE income_forms ADD COLUMN IF NOT EXISTS other_income_subject_min_tax_total DECIMAL(15,2) DEFAULT 0;

-- Add new columns for Other Income (Not Subject to minimum tax) section
ALTER TABLE income_forms ADD COLUMN IF NOT EXISTS rent_income DECIMAL(15,2) DEFAULT 0;
ALTER TABLE income_forms ADD COLUMN IF NOT EXISTS other_taxable_income_others DECIMAL(15,2) DEFAULT 0;

-- Add computed column for Other Income Not Subject to Minimum Tax
ALTER TABLE income_forms ADD COLUMN IF NOT EXISTS other_income_not_subject_min_tax_total DECIMAL(15,2) DEFAULT 0;

-- Add total taxable income computation
ALTER TABLE income_forms ADD COLUMN IF NOT EXISTS total_taxable_income DECIMAL(15,2) DEFAULT 0;

-- Add comments for clarity
COMMENT ON COLUMN income_forms.annual_basic_salary IS 'Annual Basic Salary from employer';
COMMENT ON COLUMN income_forms.allowances_excluding_bonus_medical IS 'Allowances excluding bonus and medical allowance';
COMMENT ON COLUMN income_forms.bonus IS 'Bonus amount from employer';
COMMENT ON COLUMN income_forms.medical_allowance IS 'Medical allowance where medical facility not provided by employer';
COMMENT ON COLUMN income_forms.pension_from_ex_employer IS 'Pension received from ex-employer';
COMMENT ON COLUMN income_forms.employment_termination_payment IS 'Employment Termination payment Section 12 (2) e iii';
COMMENT ON COLUMN income_forms.retirement_from_approved_funds IS 'Amount received on retirement from approved funds (Provident, pension, gratuity)';
COMMENT ON COLUMN income_forms.directorship_fee IS 'Directorship Fee u/s 149(3)';
COMMENT ON COLUMN income_forms.other_cash_benefits IS 'Other cash benefits (LFA, Children education, etc.)';
COMMENT ON COLUMN income_forms.income_exempt_from_tax IS 'Income Exempt from tax (negative value)';

COMMENT ON COLUMN income_forms.employer_contribution_provident IS 'Employer Contribution to Approved Provident Funds';
COMMENT ON COLUMN income_forms.taxable_car_value IS 'Taxable value of Car provided by employer';
COMMENT ON COLUMN income_forms.other_taxable_subsidies IS 'Other taxable subsidies and non cash benefits';
COMMENT ON COLUMN income_forms.non_cash_benefit_exempt IS 'Non cash benefit exempt from tax (negative value)';

COMMENT ON COLUMN income_forms.profit_on_debt_15 IS 'Profit on Debt u/s 151 @ 15% (Profit on debt Exceeding Rs 5m)';
COMMENT ON COLUMN income_forms.profit_on_debt_12_5 IS 'Profit on Debt u/s 151A @ 12.5% (Sukook Exceeding Rs 5m)';

COMMENT ON COLUMN income_forms.rent_income IS 'Other taxable income - Rent income';
COMMENT ON COLUMN income_forms.other_taxable_income_others IS 'Other taxable income - Others';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_income_forms_annual_basic_salary ON income_forms(annual_basic_salary);
CREATE INDEX IF NOT EXISTS idx_income_forms_total_taxable_income ON income_forms(total_taxable_income);

-- Create function to automatically calculate totals
CREATE OR REPLACE FUNCTION calculate_income_totals()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculate Annual Salary and Wages Total
    NEW.annual_salary_and_wages_total := COALESCE(NEW.annual_basic_salary, 0) +
                                        COALESCE(NEW.allowances_excluding_bonus_medical, 0) +
                                        COALESCE(NEW.bonus, 0) +
                                        COALESCE(NEW.medical_allowance, 0) +
                                        COALESCE(NEW.pension_from_ex_employer, 0) +
                                        COALESCE(NEW.employment_termination_payment, 0) +
                                        COALESCE(NEW.retirement_from_approved_funds, 0) +
                                        COALESCE(NEW.directorship_fee, 0) +
                                        COALESCE(NEW.other_cash_benefits, 0) +
                                        COALESCE(NEW.income_exempt_from_tax, 0);

    -- Calculate Total Non Cash Benefits
    NEW.total_non_cash_benefits := COALESCE(NEW.employer_contribution_provident, 0) +
                                  COALESCE(NEW.taxable_car_value, 0) +
                                  COALESCE(NEW.other_taxable_subsidies, 0) +
                                  COALESCE(NEW.non_cash_benefit_exempt, 0);

    -- Calculate Other Income Subject to Minimum Tax Total
    NEW.other_income_subject_min_tax_total := COALESCE(NEW.profit_on_debt_15, 0) +
                                             COALESCE(NEW.profit_on_debt_12_5, 0);

    -- Calculate Other Income Not Subject to Minimum Tax Total
    NEW.other_income_not_subject_min_tax_total := COALESCE(NEW.rent_income, 0) +
                                                 COALESCE(NEW.other_taxable_income_others, 0);

    -- Calculate Total Taxable Income
    NEW.total_taxable_income := NEW.annual_salary_and_wages_total +
                               NEW.total_non_cash_benefits +
                               NEW.other_income_subject_min_tax_total +
                               NEW.other_income_not_subject_min_tax_total;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically calculate totals on insert/update
DROP TRIGGER IF EXISTS trigger_calculate_income_totals ON income_forms;
CREATE TRIGGER trigger_calculate_income_totals
    BEFORE INSERT OR UPDATE ON income_forms
    FOR EACH ROW
    EXECUTE FUNCTION calculate_income_totals();

-- Update existing records to calculate totals (if any exist)
UPDATE income_forms SET updated_at = CURRENT_TIMESTAMP;