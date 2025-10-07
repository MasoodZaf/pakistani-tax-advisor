-- Migration to update income_forms table structure to match new form
-- This migration adds new fields for the detailed salary structure and removes unused fields

-- First, add new columns for the detailed structure
ALTER TABLE income_forms
ADD COLUMN IF NOT EXISTS basic_salary NUMERIC(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS allowances_excluding_bonus_medical NUMERIC(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS pension_from_ex_employer NUMERIC(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS employment_termination_payment NUMERIC(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS other_cash_benefits NUMERIC(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS annual_salary_and_wages NUMERIC(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS other_taxable_subsidies_non_cash NUMERIC(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_non_cash_benefits NUMERIC(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS multiple_employers_during_tax_year VARCHAR(1);

-- Update the multiple employer field name constraint
ALTER TABLE income_forms DROP CONSTRAINT IF EXISTS valid_multiple_employer;
ALTER TABLE income_forms ADD CONSTRAINT valid_multiple_employers_during_tax_year
    CHECK (multiple_employers_during_tax_year IN ('Y', 'N') OR multiple_employers_during_tax_year IS NULL);

-- Rename existing fields to match new structure
ALTER TABLE income_forms RENAME COLUMN employer_contribution TO employer_contribution_approved_funds;
ALTER TABLE income_forms RENAME COLUMN other_sources TO income_from_other_sources;
ALTER TABLE income_forms RENAME COLUMN other_taxable TO taxable_value_car_provided_by_employer;

-- Update computed columns for totals
ALTER TABLE income_forms
ADD COLUMN IF NOT EXISTS total_gross_income NUMERIC(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS net_taxable_income NUMERIC(15,2) DEFAULT 0;

-- Create indexes for new fields
CREATE INDEX IF NOT EXISTS idx_income_forms_annual_salary ON income_forms(annual_salary_and_wages);
CREATE INDEX IF NOT EXISTS idx_income_forms_total_non_cash ON income_forms(total_non_cash_benefits);
CREATE INDEX IF NOT EXISTS idx_income_forms_gross_income ON income_forms(total_gross_income);

-- Add comments to new fields for documentation
COMMENT ON COLUMN income_forms.basic_salary IS 'Basic salary amount';
COMMENT ON COLUMN income_forms.allowances_excluding_bonus_medical IS 'Allowances excluding bonus and medical allowance';
COMMENT ON COLUMN income_forms.pension_from_ex_employer IS 'Pension received from ex-employer';
COMMENT ON COLUMN income_forms.employment_termination_payment IS 'Employment Termination payment (Section 12 (2) e iii)';
COMMENT ON COLUMN income_forms.other_cash_benefits IS 'Other cash benefits (LFA, Children education, etc.)';
COMMENT ON COLUMN income_forms.annual_salary_and_wages IS 'Total Annual Salary and Wages (calculated)';
COMMENT ON COLUMN income_forms.other_taxable_subsidies_non_cash IS 'Other taxable subsidies and non cash benefits';
COMMENT ON COLUMN income_forms.total_non_cash_benefits IS 'Total non cash benefits (calculated)';
COMMENT ON COLUMN income_forms.multiple_employers_during_tax_year IS 'Do You have more than one employer during Tax Year (Y/N)';

-- Optional: Drop unused columns (commented out for safety - can be uncommented after migration testing)
-- ALTER TABLE income_forms DROP COLUMN IF EXISTS monthly_salary;
-- ALTER TABLE income_forms DROP COLUMN IF EXISTS car_allowance;
-- ALTER TABLE income_forms DROP COLUMN IF EXISTS other_exempt;
-- ALTER TABLE income_forms DROP COLUMN IF EXISTS multiple_employer;

-- Update trigger to handle new fields
CREATE OR REPLACE FUNCTION update_income_forms_calculated_fields()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculate Annual Salary and Wages
    NEW.annual_salary_and_wages = COALESCE(NEW.basic_salary, 0) +
                                 COALESCE(NEW.allowances_excluding_bonus_medical, 0) +
                                 COALESCE(NEW.bonus, 0) +
                                 COALESCE(NEW.medical_allowance, 0) +
                                 COALESCE(NEW.pension_from_ex_employer, 0) +
                                 COALESCE(NEW.employment_termination_payment, 0) +
                                 COALESCE(NEW.other_cash_benefits, 0);

    -- Calculate Total Non-cash Benefits
    NEW.total_non_cash_benefits = COALESCE(NEW.employer_contribution_approved_funds, 0) +
                                 COALESCE(NEW.taxable_value_car_provided_by_employer, 0) +
                                 COALESCE(NEW.other_taxable_subsidies_non_cash, 0);

    -- Calculate Total Gross Income
    NEW.total_gross_income = COALESCE(NEW.annual_salary_and_wages, 0) +
                            COALESCE(NEW.total_non_cash_benefits, 0) +
                            COALESCE(NEW.income_from_other_sources, 0);

    -- Calculate Net Taxable Income
    NEW.net_taxable_income = NEW.total_gross_income;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS calculate_income_forms_totals ON income_forms;
CREATE TRIGGER calculate_income_forms_totals
    BEFORE INSERT OR UPDATE ON income_forms
    FOR EACH ROW
    EXECUTE FUNCTION update_income_forms_calculated_fields();

-- Update existing records to calculate new totals
UPDATE income_forms SET updated_at = CURRENT_TIMESTAMP;

COMMIT;