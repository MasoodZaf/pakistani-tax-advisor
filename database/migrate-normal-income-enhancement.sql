-- Normal Income Form Enhancement Migration
-- Add fields for "Detail of Income Subject to Normal Taxation" form
-- This is the PRIMARY income form that drives all tax calculations

-- Add new fields to income_forms table for Normal Taxation structure
-- Keep existing fields for backward compatibility

-- Employment Status
ALTER TABLE income_forms ADD COLUMN IF NOT EXISTS multiple_employers_during_tax_year VARCHAR(1) DEFAULT NULL;

-- Taxable Payments by Employer (enhanced)
-- monthly_salary already exists
-- bonus already exists
ALTER TABLE income_forms ADD COLUMN IF NOT EXISTS taxable_value_car_provided_by_employer DECIMAL(15,2) DEFAULT 0;
ALTER TABLE income_forms ADD COLUMN IF NOT EXISTS other_taxable_payments_by_employer DECIMAL(15,2) DEFAULT 0;
ALTER TABLE income_forms ADD COLUMN IF NOT EXISTS total_taxable_salary_per_salary_certificate DECIMAL(15,2) DEFAULT 0;

-- Tax Exempt Payments by Employer (enhanced)
-- medical_allowance already exists
ALTER TABLE income_forms ADD COLUMN IF NOT EXISTS employer_contribution_approved_funds DECIMAL(15,2) DEFAULT 0;
ALTER TABLE income_forms ADD COLUMN IF NOT EXISTS other_tax_exempt_payments_by_employer DECIMAL(15,2) DEFAULT 0;
ALTER TABLE income_forms ADD COLUMN IF NOT EXISTS total_exempt_payments DECIMAL(15,2) DEFAULT 0;

-- Income from Other Sources 
-- other_sources already exists, but rename for clarity
ALTER TABLE income_forms ADD COLUMN IF NOT EXISTS income_from_other_sources DECIMAL(15,2) DEFAULT 0;

-- Total income calculations (these are the KEY fields that drive tax calculations)
ALTER TABLE income_forms ADD COLUMN IF NOT EXISTS total_gross_income_normal DECIMAL(15,2) DEFAULT 0;
ALTER TABLE income_forms ADD COLUMN IF NOT EXISTS net_taxable_income_normal DECIMAL(15,2) DEFAULT 0;

-- Add generated columns for automatic calculation of Normal Income totals
-- This replaces the old generated columns with comprehensive calculation
ALTER TABLE income_forms ADD COLUMN total_taxable_salary_calculated DECIMAL(15,2) GENERATED ALWAYS AS (
    COALESCE(monthly_salary, 0) + 
    COALESCE(bonus, 0) + 
    COALESCE(taxable_value_car_provided_by_employer, 0) + 
    COALESCE(other_taxable_payments_by_employer, 0)
) STORED;

ALTER TABLE income_forms ADD COLUMN total_exempt_payments_calculated DECIMAL(15,2) GENERATED ALWAYS AS (
    COALESCE(medical_allowance, 0) + 
    COALESCE(employer_contribution_approved_funds, 0) + 
    COALESCE(other_tax_exempt_payments_by_employer, 0)
) STORED;

ALTER TABLE income_forms ADD COLUMN total_gross_income_calculated DECIMAL(15,2) GENERATED ALWAYS AS (
    -- Taxable salary + exempt payments + other sources
    (COALESCE(monthly_salary, 0) + 
     COALESCE(bonus, 0) + 
     COALESCE(taxable_value_car_provided_by_employer, 0) + 
     COALESCE(other_taxable_payments_by_employer, 0)) +
    (COALESCE(medical_allowance, 0) + 
     COALESCE(employer_contribution_approved_funds, 0) + 
     COALESCE(other_tax_exempt_payments_by_employer, 0)) +
    COALESCE(income_from_other_sources, 0)
) STORED;

ALTER TABLE income_forms ADD COLUMN net_taxable_income_calculated DECIMAL(15,2) GENERATED ALWAYS AS (
    -- Only taxable payments + other sources (exempt payments are not taxed)
    (COALESCE(monthly_salary, 0) + 
     COALESCE(bonus, 0) + 
     COALESCE(taxable_value_car_provided_by_employer, 0) + 
     COALESCE(other_taxable_payments_by_employer, 0)) +
    COALESCE(income_from_other_sources, 0)
) STORED;

-- Add indexes for performance on key calculation fields
CREATE INDEX IF NOT EXISTS idx_income_forms_total_gross_calculated ON income_forms(total_gross_income_calculated);
CREATE INDEX IF NOT EXISTS idx_income_forms_net_taxable_calculated ON income_forms(net_taxable_income_calculated);
CREATE INDEX IF NOT EXISTS idx_income_forms_multiple_employers ON income_forms(multiple_employers_during_tax_year);

-- Add constraints to ensure data integrity
ALTER TABLE income_forms ADD CONSTRAINT chk_multiple_employers_values 
    CHECK (multiple_employers_during_tax_year IS NULL OR multiple_employers_during_tax_year IN ('Y', 'N'));

-- Add comments for documentation
COMMENT ON COLUMN income_forms.multiple_employers_during_tax_year IS 'Y/N - Does taxpayer have multiple employers during tax year';
COMMENT ON COLUMN income_forms.taxable_value_car_provided_by_employer IS 'Taxable value of company car provided by employer';
COMMENT ON COLUMN income_forms.other_taxable_payments_by_employer IS 'Other taxable payments/benefits from employer';
COMMENT ON COLUMN income_forms.total_taxable_salary_per_salary_certificate IS 'Total taxable salary as shown on salary certificate';
COMMENT ON COLUMN income_forms.employer_contribution_approved_funds IS 'Employer contribution to provident fund and approved funds';
COMMENT ON COLUMN income_forms.other_tax_exempt_payments_by_employer IS 'Other tax exempt payments by employer';
COMMENT ON COLUMN income_forms.total_exempt_payments IS 'Total of all tax exempt payments';
COMMENT ON COLUMN income_forms.income_from_other_sources IS 'Income from sources other than employment';
COMMENT ON COLUMN income_forms.total_gross_income_normal IS 'Total gross income for normal taxation (user entered)';
COMMENT ON COLUMN income_forms.net_taxable_income_normal IS 'Net taxable income for normal taxation (user entered)';
COMMENT ON COLUMN income_forms.total_taxable_salary_calculated IS 'Auto-calculated total taxable salary';
COMMENT ON COLUMN income_forms.total_exempt_payments_calculated IS 'Auto-calculated total exempt payments';
COMMENT ON COLUMN income_forms.total_gross_income_calculated IS 'Auto-calculated total gross income (PRIMARY for tax calculations)';
COMMENT ON COLUMN income_forms.net_taxable_income_calculated IS 'Auto-calculated net taxable income (PRIMARY for tax calculations)';

-- Update table comment
COMMENT ON TABLE income_forms IS 'Primary income forms for Normal Taxation - drives all main tax calculations. Contains both normal taxation and final/minimum tax income fields.';

-- Display success message
SELECT 'Normal Income Form Enhancement Migration completed successfully!' AS message;
SELECT 'This form is now the PRIMARY income form that drives all tax calculations.' AS note;