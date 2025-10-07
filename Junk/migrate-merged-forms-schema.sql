-- Migration to update database schema for merged Tax Reductions, Credits and Deductions form
-- This migration adds new fields to support the comprehensive Excel-based form structure

-- ========================================
-- Update reductions_forms table
-- ========================================

-- Add new fields for tax reductions
ALTER TABLE reductions_forms
ADD COLUMN IF NOT EXISTS teacher_researcher_amount DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS teacher_researcher_tax_reduction DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS behbood_certificates_amount DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS behbood_certificates_tax_reduction DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS capital_gain_immovable_50_reduction DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS capital_gain_immovable_75_reduction DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS teacher_researcher_reduction_yn VARCHAR(1) DEFAULT '',
ADD COLUMN IF NOT EXISTS behbood_certificates_reduction_yn VARCHAR(1) DEFAULT '',
ADD COLUMN IF NOT EXISTS total_tax_reductions DECIMAL(15,2) DEFAULT 0;

-- Update existing teacher fields mapping
UPDATE reductions_forms SET
  teacher_researcher_amount = COALESCE(teacher_amount, 0),
  teacher_researcher_tax_reduction = COALESCE(teacher_reduction, 0)
WHERE teacher_amount IS NOT NULL OR teacher_reduction IS NOT NULL;

-- ========================================
-- Update credits_forms table
-- ========================================

-- Add new fields for tax credits with proper naming
ALTER TABLE credits_forms
ADD COLUMN IF NOT EXISTS charitable_donations_amount DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS charitable_donations_tax_credit DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS charitable_donations_associate_amount DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS charitable_donations_associate_tax_credit DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS pension_fund_amount DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS pension_fund_tax_credit DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS surrender_tax_credit_amount DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS surrender_tax_credit_reduction DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS charitable_donations_u61_yn VARCHAR(1) DEFAULT '',
ADD COLUMN IF NOT EXISTS charitable_donations_associate_yn VARCHAR(1) DEFAULT '',
ADD COLUMN IF NOT EXISTS pension_fund_u63_yn VARCHAR(1) DEFAULT '',
ADD COLUMN IF NOT EXISTS surrender_tax_credit_investments_yn VARCHAR(1) DEFAULT '',
ADD COLUMN IF NOT EXISTS total_tax_credits DECIMAL(15,2) DEFAULT 0;

-- Update existing charitable donation fields mapping
UPDATE credits_forms SET
  charitable_donations_amount = COALESCE(charitable_donation, 0),
  pension_fund_amount = COALESCE(pension_contribution, 0)
WHERE charitable_donation IS NOT NULL OR pension_contribution IS NOT NULL;

-- ========================================
-- Update deductions_forms table
-- ========================================

-- Add new fields for deductible allowances
ALTER TABLE deductions_forms
ADD COLUMN IF NOT EXISTS educational_expenses_amount DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS educational_expenses_children_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS zakat_paid_amount DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS educational_expenses_yn VARCHAR(1) DEFAULT '',
ADD COLUMN IF NOT EXISTS zakat_paid_ordinance_yn VARCHAR(1) DEFAULT '',
ADD COLUMN IF NOT EXISTS total_deduction_from_income DECIMAL(15,2) DEFAULT 0;

-- Update existing zakat fields mapping
UPDATE deductions_forms SET
  zakat_paid_amount = COALESCE(zakat, 0)
WHERE zakat IS NOT NULL;

-- ========================================
-- Create computed column updates
-- ========================================

-- Drop existing computed columns for tax reductions and recreate with new fields
ALTER TABLE reductions_forms DROP COLUMN IF EXISTS total_reductions;
ALTER TABLE reductions_forms
ADD COLUMN total_reductions DECIMAL(15,2) GENERATED ALWAYS AS (
    COALESCE(teacher_researcher_tax_reduction, 0) +
    COALESCE(behbood_certificates_tax_reduction, 0) +
    COALESCE(capital_gain_immovable_50_reduction, 0) +
    COALESCE(capital_gain_immovable_75_reduction, 0) +
    COALESCE(export_income_reduction, 0) +
    COALESCE(industrial_undertaking_reduction, 0) +
    COALESCE(other_reductions, 0)
) STORED;

-- Drop existing computed columns for tax credits and recreate with new fields
ALTER TABLE credits_forms DROP COLUMN IF EXISTS total_credits;
ALTER TABLE credits_forms
ADD COLUMN total_credits DECIMAL(15,2) GENERATED ALWAYS AS (
    COALESCE(charitable_donations_tax_credit, 0) +
    COALESCE(charitable_donations_associate_tax_credit, 0) +
    COALESCE(pension_fund_tax_credit, 0) +
    COALESCE(surrender_tax_credit_reduction, 0) +
    COALESCE(investment_tax_credit, 0) +
    COALESCE(other_credits, 0)
) STORED;

-- Drop existing computed columns for deductions and recreate with new fields
ALTER TABLE deductions_forms DROP COLUMN IF EXISTS total_deductions;
ALTER TABLE deductions_forms
ADD COLUMN total_deductions DECIMAL(15,2) GENERATED ALWAYS AS (
    COALESCE(educational_expenses_amount, 0) +
    COALESCE(zakat_paid_amount, 0) +
    COALESCE(ushr, 0) +
    COALESCE(tax_paid_foreign_country, 0) +
    COALESCE(advance_tax, 0) +
    COALESCE(other_deductions, 0)
) STORED;

-- ========================================
-- Add helpful comments
-- ========================================

COMMENT ON COLUMN reductions_forms.teacher_researcher_amount IS 'Amount for Tax Reduction for Full Time Teacher / Researcher';
COMMENT ON COLUMN reductions_forms.teacher_researcher_tax_reduction IS 'Tax reduction amount (25% of tax payable on salary)';
COMMENT ON COLUMN reductions_forms.behbood_certificates_amount IS 'Amount for Tax Reduction on Behbood Certificates';
COMMENT ON COLUMN reductions_forms.behbood_certificates_tax_reduction IS 'Tax reduction amount for Behbood Certificates';
COMMENT ON COLUMN reductions_forms.capital_gain_immovable_50_reduction IS '50% reduction on capital gain for ex-servicemen';
COMMENT ON COLUMN reductions_forms.capital_gain_immovable_75_reduction IS '75% reduction on capital gain for ex-servicemen';

COMMENT ON COLUMN credits_forms.charitable_donations_amount IS 'Amount donated to approved charities u/s 61';
COMMENT ON COLUMN credits_forms.charitable_donations_tax_credit IS 'Tax credit for charitable donations (30% limit)';
COMMENT ON COLUMN credits_forms.charitable_donations_associate_amount IS 'Amount donated to associate organizations';
COMMENT ON COLUMN credits_forms.charitable_donations_associate_tax_credit IS 'Tax credit for associate donations (15% limit)';
COMMENT ON COLUMN credits_forms.pension_fund_amount IS 'Amount contributed to approved pension fund u/s 63';
COMMENT ON COLUMN credits_forms.pension_fund_tax_credit IS 'Tax credit for pension fund contribution (20% limit)';

COMMENT ON COLUMN deductions_forms.educational_expenses_amount IS 'Educational expenses for children (5% of amount paid or 25% of taxable income)';
COMMENT ON COLUMN deductions_forms.educational_expenses_children_count IS 'Number of children for whom tuition fee is paid';
COMMENT ON COLUMN deductions_forms.zakat_paid_amount IS 'Zakat paid under Zakat and Usher Ordinance';

-- ========================================
-- Create indexes for new fields
-- ========================================

CREATE INDEX IF NOT EXISTS idx_reductions_teacher_researcher ON reductions_forms(teacher_researcher_amount);
CREATE INDEX IF NOT EXISTS idx_credits_charitable ON credits_forms(charitable_donations_amount);
CREATE INDEX IF NOT EXISTS idx_deductions_educational ON deductions_forms(educational_expenses_amount);