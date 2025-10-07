-- Database Schema Updates for Excel Calculation Compliance
-- Based on XlCal.md analysis and FBR_COMPLIANCE_CHECKLIST.md requirements
-- Created: 2025-09-25
-- Purpose: Ensure 100% compatibility with Excel calculations and FBR compliance

-- =============================================================================
-- 1. CREATE MISSING TABLES FOR COMPREHENSIVE TAX COMPUTATION
-- =============================================================================

-- Tax Computation Summary Table (Sheet 6: Tax Computation)
CREATE TABLE IF NOT EXISTS tax_computation_forms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tax_return_id UUID NOT NULL,
    user_id UUID NOT NULL,
    user_email VARCHAR(255) NOT NULL,
    tax_year_id UUID NOT NULL,
    tax_year VARCHAR(10) NOT NULL DEFAULT '2025-26',

    -- Income Components (linked from other sheets)
    income_from_salary NUMERIC(15,2) DEFAULT 0,
    other_income_subject_to_min_tax NUMERIC(15,2) DEFAULT 0,
    income_loss_other_sources NUMERIC(15,2) DEFAULT 0,

    -- Calculated Fields
    total_income NUMERIC(15,2) GENERATED ALWAYS AS (
        COALESCE(income_from_salary, 0) +
        COALESCE(other_income_subject_to_min_tax, 0) +
        COALESCE(income_loss_other_sources, 0)
    ) STORED,

    deductible_allowances NUMERIC(15,2) DEFAULT 0,
    taxable_income_excluding_cg NUMERIC(15,2) GENERATED ALWAYS AS (
        COALESCE(income_from_salary, 0) +
        COALESCE(other_income_subject_to_min_tax, 0) +
        COALESCE(income_loss_other_sources, 0) -
        COALESCE(deductible_allowances, 0)
    ) STORED,

    capital_gains_loss NUMERIC(15,2) DEFAULT 0,
    taxable_income_including_cg NUMERIC(15,2) GENERATED ALWAYS AS (
        COALESCE(income_from_salary, 0) +
        COALESCE(other_income_subject_to_min_tax, 0) +
        COALESCE(income_loss_other_sources, 0) -
        COALESCE(deductible_allowances, 0) +
        COALESCE(capital_gains_loss, 0)
    ) STORED,

    -- Tax Calculations
    normal_income_tax NUMERIC(15,2) DEFAULT 0,
    surcharge_amount NUMERIC(15,2) DEFAULT 0,
    capital_gains_tax NUMERIC(15,2) DEFAULT 0,
    normal_tax_including_surcharge_cgt NUMERIC(15,2) GENERATED ALWAYS AS (
        COALESCE(normal_income_tax, 0) +
        COALESCE(surcharge_amount, 0) +
        COALESCE(capital_gains_tax, 0)
    ) STORED,

    tax_reductions NUMERIC(15,2) DEFAULT 0,
    tax_credits NUMERIC(15,2) DEFAULT 0,
    net_tax_payable NUMERIC(15,2) GENERATED ALWAYS AS (
        COALESCE(normal_income_tax, 0) +
        COALESCE(surcharge_amount, 0) +
        COALESCE(capital_gains_tax, 0) -
        COALESCE(tax_reductions, 0) -
        COALESCE(tax_credits, 0)
    ) STORED,

    -- Final Tax Components
    final_fixed_tax NUMERIC(15,2) DEFAULT 0,
    minimum_tax_on_other_income NUMERIC(15,2) DEFAULT 0,
    total_tax_liability NUMERIC(15,2) GENERATED ALWAYS AS (
        COALESCE(normal_income_tax, 0) +
        COALESCE(surcharge_amount, 0) +
        COALESCE(capital_gains_tax, 0) -
        COALESCE(tax_reductions, 0) -
        COALESCE(tax_credits, 0) +
        COALESCE(final_fixed_tax, 0)
    ) STORED,

    -- Advance Tax Paid
    advance_tax_paid NUMERIC(15,2) DEFAULT 0,
    balance_payable NUMERIC(15,2) GENERATED ALWAYS AS (
        COALESCE(normal_income_tax, 0) +
        COALESCE(surcharge_amount, 0) +
        COALESCE(capital_gains_tax, 0) -
        COALESCE(tax_reductions, 0) -
        COALESCE(tax_credits, 0) +
        COALESCE(final_fixed_tax, 0) -
        COALESCE(advance_tax_paid, 0)
    ) STORED,

    is_complete BOOLEAN DEFAULT FALSE,
    last_updated_by UUID,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Foreign Keys
    FOREIGN KEY (tax_return_id) REFERENCES tax_returns(id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (user_email, user_id) REFERENCES users(email, id) ON DELETE CASCADE,
    FOREIGN KEY (tax_year_id, tax_year) REFERENCES tax_years(id, tax_year),
    FOREIGN KEY (last_updated_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Create indexes for tax_computation_forms
CREATE INDEX IF NOT EXISTS idx_tax_computation_forms_return ON tax_computation_forms(tax_return_id);
CREATE INDEX IF NOT EXISTS idx_tax_computation_forms_user ON tax_computation_forms(user_id, user_email);
CREATE INDEX IF NOT EXISTS idx_tax_computation_forms_year ON tax_computation_forms(tax_year_id, tax_year);

-- Wealth Statement Table (Sheet 9: Wealth Statement)
CREATE TABLE IF NOT EXISTS wealth_statement_forms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tax_return_id UUID NOT NULL,
    user_id UUID NOT NULL,
    user_email VARCHAR(255) NOT NULL,
    tax_year_id UUID NOT NULL,
    tax_year VARCHAR(10) NOT NULL DEFAULT '2025-26',

    -- Assets - Previous Year
    agricultural_property_prev NUMERIC(15,2) DEFAULT 0,
    commercial_property_prev NUMERIC(15,2) DEFAULT 0,
    equipment_prev NUMERIC(15,2) DEFAULT 0,
    animals_prev NUMERIC(15,2) DEFAULT 0,
    investments_prev NUMERIC(15,2) DEFAULT 0,
    debt_receivable_prev NUMERIC(15,2) DEFAULT 0,
    motor_vehicles_prev NUMERIC(15,2) DEFAULT 0,
    precious_possessions_prev NUMERIC(15,2) DEFAULT 0,
    household_effects_prev NUMERIC(15,2) DEFAULT 0,
    personal_items_prev NUMERIC(15,2) DEFAULT 0,
    cash_prev NUMERIC(15,2) DEFAULT 0,
    other_assets_prev NUMERIC(15,2) DEFAULT 0,

    -- Assets - Current Year
    agricultural_property_curr NUMERIC(15,2) DEFAULT 0,
    commercial_property_curr NUMERIC(15,2) DEFAULT 0,
    equipment_curr NUMERIC(15,2) DEFAULT 0,
    animals_curr NUMERIC(15,2) DEFAULT 0,
    investments_curr NUMERIC(15,2) DEFAULT 0,
    debt_receivable_curr NUMERIC(15,2) DEFAULT 0,
    motor_vehicles_curr NUMERIC(15,2) DEFAULT 0,
    precious_possessions_curr NUMERIC(15,2) DEFAULT 0,
    household_effects_curr NUMERIC(15,2) DEFAULT 0,
    personal_items_curr NUMERIC(15,2) DEFAULT 0,
    cash_curr NUMERIC(15,2) DEFAULT 0,
    other_assets_curr NUMERIC(15,2) DEFAULT 0,

    -- Liabilities - Previous Year
    business_liabilities_prev NUMERIC(15,2) DEFAULT 0,
    personal_liabilities_prev NUMERIC(15,2) DEFAULT 0,

    -- Liabilities - Current Year
    business_liabilities_curr NUMERIC(15,2) DEFAULT 0,
    personal_liabilities_curr NUMERIC(15,2) DEFAULT 0,

    -- Calculated Totals
    total_assets_prev NUMERIC(15,2) GENERATED ALWAYS AS (
        COALESCE(agricultural_property_prev, 0) + COALESCE(commercial_property_prev, 0) +
        COALESCE(equipment_prev, 0) + COALESCE(animals_prev, 0) + COALESCE(investments_prev, 0) +
        COALESCE(debt_receivable_prev, 0) + COALESCE(motor_vehicles_prev, 0) +
        COALESCE(precious_possessions_prev, 0) + COALESCE(household_effects_prev, 0) +
        COALESCE(personal_items_prev, 0) + COALESCE(cash_prev, 0) + COALESCE(other_assets_prev, 0)
    ) STORED,

    total_assets_curr NUMERIC(15,2) GENERATED ALWAYS AS (
        COALESCE(agricultural_property_curr, 0) + COALESCE(commercial_property_curr, 0) +
        COALESCE(equipment_curr, 0) + COALESCE(animals_curr, 0) + COALESCE(investments_curr, 0) +
        COALESCE(debt_receivable_curr, 0) + COALESCE(motor_vehicles_curr, 0) +
        COALESCE(precious_possessions_curr, 0) + COALESCE(household_effects_curr, 0) +
        COALESCE(personal_items_curr, 0) + COALESCE(cash_curr, 0) + COALESCE(other_assets_curr, 0)
    ) STORED,

    total_liabilities_prev NUMERIC(15,2) GENERATED ALWAYS AS (
        COALESCE(business_liabilities_prev, 0) + COALESCE(personal_liabilities_prev, 0)
    ) STORED,

    total_liabilities_curr NUMERIC(15,2) GENERATED ALWAYS AS (
        COALESCE(business_liabilities_curr, 0) + COALESCE(personal_liabilities_curr, 0)
    ) STORED,

    net_wealth_prev NUMERIC(15,2) GENERATED ALWAYS AS (
        (COALESCE(agricultural_property_prev, 0) + COALESCE(commercial_property_prev, 0) +
         COALESCE(equipment_prev, 0) + COALESCE(animals_prev, 0) + COALESCE(investments_prev, 0) +
         COALESCE(debt_receivable_prev, 0) + COALESCE(motor_vehicles_prev, 0) +
         COALESCE(precious_possessions_prev, 0) + COALESCE(household_effects_prev, 0) +
         COALESCE(personal_items_prev, 0) + COALESCE(cash_prev, 0) + COALESCE(other_assets_prev, 0)) -
        (COALESCE(business_liabilities_prev, 0) + COALESCE(personal_liabilities_prev, 0))
    ) STORED,

    net_wealth_curr NUMERIC(15,2) GENERATED ALWAYS AS (
        (COALESCE(agricultural_property_curr, 0) + COALESCE(commercial_property_curr, 0) +
         COALESCE(equipment_curr, 0) + COALESCE(animals_curr, 0) + COALESCE(investments_curr, 0) +
         COALESCE(debt_receivable_curr, 0) + COALESCE(motor_vehicles_curr, 0) +
         COALESCE(precious_possessions_curr, 0) + COALESCE(household_effects_curr, 0) +
         COALESCE(personal_items_curr, 0) + COALESCE(cash_curr, 0) + COALESCE(other_assets_curr, 0)) -
        (COALESCE(business_liabilities_curr, 0) + COALESCE(personal_liabilities_curr, 0))
    ) STORED,

    is_complete BOOLEAN DEFAULT FALSE,
    last_updated_by UUID,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Foreign Keys
    FOREIGN KEY (tax_return_id) REFERENCES tax_returns(id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (user_email, user_id) REFERENCES users(email, id) ON DELETE CASCADE,
    FOREIGN KEY (tax_year_id, tax_year) REFERENCES tax_years(id, tax_year),
    FOREIGN KEY (last_updated_by) REFERENCES users(id) ON DELETE SET NULL
);

-- =============================================================================
-- 2. UPDATE EXISTING TABLES WITH MISSING EXCEL CALCULATION FIELDS
-- =============================================================================

-- Update income_forms table with additional Excel calculation fields
ALTER TABLE income_forms ADD COLUMN IF NOT EXISTS annual_salary_wages_total NUMERIC(15,2) GENERATED ALWAYS AS (
    COALESCE(annual_basic_salary, 0) + COALESCE(allowances, 0) + COALESCE(bonus, 0) +
    COALESCE(medical_allowance, 0) + COALESCE(pension_from_ex_employer, 0) +
    COALESCE(employment_termination_payment, 0) + COALESCE(retirement_from_approved_funds, 0) +
    COALESCE(directorship_fee, 0) + COALESCE(other_cash_benefits, 0)
) STORED;

-- Add Excel-specific calculation fields to income_forms
ALTER TABLE income_forms ADD COLUMN IF NOT EXISTS total_employment_income NUMERIC(15,2) GENERATED ALWAYS AS (
    COALESCE(annual_basic_salary, 0) + COALESCE(allowances, 0) + COALESCE(bonus, 0) +
    COALESCE(medical_allowance, 0) + COALESCE(pension_from_ex_employer, 0) +
    COALESCE(employment_termination_payment, 0) + COALESCE(retirement_from_approved_funds, 0) +
    COALESCE(directorship_fee, 0) + COALESCE(other_cash_benefits, 0) +
    COALESCE(employer_contribution_provident, 0) + COALESCE(taxable_car_value, 0) +
    COALESCE(other_taxable_subsidies, 0)
) STORED;

-- Update adjustable_tax_forms with calculated rates
ALTER TABLE adjustable_tax_forms ADD COLUMN IF NOT EXISTS directorship_tax_rate NUMERIC(5,4) DEFAULT 0.20;
ALTER TABLE adjustable_tax_forms ADD COLUMN IF NOT EXISTS profit_debt_15_tax_rate NUMERIC(5,4) DEFAULT 0.15;
ALTER TABLE adjustable_tax_forms ADD COLUMN IF NOT EXISTS sukook_tax_rate NUMERIC(5,4) DEFAULT 0.125;
ALTER TABLE adjustable_tax_forms ADD COLUMN IF NOT EXISTS rent_tax_rate NUMERIC(5,4) DEFAULT 0.10;

-- Update capital_gain_forms with Excel holding period calculations
ALTER TABLE capital_gain_forms ADD COLUMN IF NOT EXISTS property_1_2_years NUMERIC(15,2) DEFAULT 0;
ALTER TABLE capital_gain_forms ADD COLUMN IF NOT EXISTS property_1_2_years_tax_rate NUMERIC(5,4) DEFAULT 0.125;
ALTER TABLE capital_gain_forms ADD COLUMN IF NOT EXISTS property_3_4_years NUMERIC(15,2) DEFAULT 0;
ALTER TABLE capital_gain_forms ADD COLUMN IF NOT EXISTS property_3_4_years_tax_rate NUMERIC(5,4) DEFAULT 0.075;
ALTER TABLE capital_gain_forms ADD COLUMN IF NOT EXISTS property_4_5_years NUMERIC(15,2) DEFAULT 0;
ALTER TABLE capital_gain_forms ADD COLUMN IF NOT EXISTS property_4_5_years_tax_rate NUMERIC(5,4) DEFAULT 0.05;
ALTER TABLE capital_gain_forms ADD COLUMN IF NOT EXISTS property_5_6_years NUMERIC(15,2) DEFAULT 0;
ALTER TABLE capital_gain_forms ADD COLUMN IF NOT EXISTS property_5_6_years_tax_rate NUMERIC(5,4) DEFAULT 0.025;

-- =============================================================================
-- 3. CREATE TAX RATE CONFIGURATION TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS tax_rates_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tax_year VARCHAR(10) NOT NULL,
    rate_type VARCHAR(50) NOT NULL, -- 'progressive', 'withholding', 'capital_gains', 'final_tax'
    rate_category VARCHAR(100) NOT NULL, -- specific category like 'salary_slab_1', 'dividend_15'

    -- Rate Configuration
    min_amount NUMERIC(15,2) DEFAULT 0,
    max_amount NUMERIC(15,2) DEFAULT 999999999999.99,
    tax_rate NUMERIC(8,6) NOT NULL, -- Support up to 6 decimal places for precise rates
    fixed_amount NUMERIC(15,2) DEFAULT 0,

    -- Additional Properties
    description TEXT,
    fbr_reference VARCHAR(100),
    effective_date DATE,
    end_date DATE,

    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(tax_year, rate_type, rate_category)
);

-- =============================================================================
-- 4. INSERT FBR COMPLIANT TAX RATES FOR 2025-26
-- =============================================================================

-- Progressive Tax Slabs for Salaried Individuals (2025-26)
INSERT INTO tax_rates_config (tax_year, rate_type, rate_category, min_amount, max_amount, tax_rate, fixed_amount, description, fbr_reference) VALUES
('2025-26', 'progressive', 'slab_1', 0, 600000, 0.00, 0, 'First slab - 0% tax rate', 'Income Tax Ordinance 2001, First Schedule Part I'),
('2025-26', 'progressive', 'slab_2', 600001, 1200000, 0.01, 0, 'Second slab - 1% tax rate', 'Income Tax Ordinance 2001, First Schedule Part I'),
('2025-26', 'progressive', 'slab_3', 1200001, 2400000, 0.11, 6000, 'Third slab - 11% tax rate', 'Income Tax Ordinance 2001, First Schedule Part I'),
('2025-26', 'progressive', 'slab_4', 2400001, 3600000, 0.23, 138000, 'Fourth slab - 23% tax rate', 'Income Tax Ordinance 2001, First Schedule Part I'),
('2025-26', 'progressive', 'slab_5', 3600001, 6000000, 0.30, 414000, 'Fifth slab - 30% tax rate', 'Income Tax Ordinance 2001, First Schedule Part I'),
('2025-26', 'progressive', 'slab_6', 6000001, 999999999999.99, 0.35, 1134000, 'Sixth slab - 35% tax rate', 'Income Tax Ordinance 2001, First Schedule Part I')
ON CONFLICT (tax_year, rate_type, rate_category) DO UPDATE SET
    min_amount = EXCLUDED.min_amount,
    max_amount = EXCLUDED.max_amount,
    tax_rate = EXCLUDED.tax_rate,
    fixed_amount = EXCLUDED.fixed_amount,
    updated_at = CURRENT_TIMESTAMP;

-- Surcharge Rate
INSERT INTO tax_rates_config (tax_year, rate_type, rate_category, min_amount, max_amount, tax_rate, fixed_amount, description, fbr_reference) VALUES
('2025-26', 'surcharge', 'salaried_above_10m', 10000000, 999999999999.99, 0.09, 0, 'Surcharge for salaried individuals with income > 10M', 'Finance Act 2024, Section 4B')
ON CONFLICT (tax_year, rate_type, rate_category) DO UPDATE SET
    tax_rate = EXCLUDED.tax_rate,
    updated_at = CURRENT_TIMESTAMP;

-- Capital Gains Rates (Post July 1, 2024)
INSERT INTO tax_rates_config (tax_year, rate_type, rate_category, min_amount, max_amount, tax_rate, fixed_amount, description, fbr_reference) VALUES
('2025-26', 'capital_gains', 'property_atl_post_july_2024', 0, 999999999999.99, 0.15, 0, 'ATL Filer property gains post July 1, 2024', 'Income Tax Ordinance 2001, Section 37'),
('2025-26', 'capital_gains', 'property_non_atl_post_july_2024', 0, 999999999999.99, 0.25, 0, 'Non-ATL Filer property gains post July 1, 2024', 'Income Tax Ordinance 2001, Section 37'),
('2025-26', 'capital_gains', 'securities_pre_2013', 0, 999999999999.99, 0.00, 0, 'Securities acquired before July 1, 2013', 'Income Tax Ordinance 2001, Section 37A'),
('2025-26', 'capital_gains', 'securities_pmex', 0, 999999999999.99, 0.05, 0, 'PMEX/Cash Settled Securities', 'Income Tax Ordinance 2001, Section 37A'),
('2025-26', 'capital_gains', 'securities_standard', 0, 999999999999.99, 0.075, 0, 'Standard Securities 7.5%', 'Income Tax Ordinance 2001, Section 37A'),
('2025-26', 'capital_gains', 'securities_mutual_funds_10', 0, 999999999999.99, 0.10, 0, 'Mutual Funds/REIT 10%', 'Income Tax Ordinance 2001, Section 37A'),
('2025-26', 'capital_gains', 'securities_mutual_funds_12_5', 0, 999999999999.99, 0.125, 0, 'Stock Funds 12.5%', 'Income Tax Ordinance 2001, Section 37A')
ON CONFLICT (tax_year, rate_type, rate_category) DO UPDATE SET
    tax_rate = EXCLUDED.tax_rate,
    updated_at = CURRENT_TIMESTAMP;

-- Withholding Tax Rates
INSERT INTO tax_rates_config (tax_year, rate_type, rate_category, min_amount, max_amount, tax_rate, fixed_amount, description, fbr_reference) VALUES
('2025-26', 'withholding', 'directorship_fee', 0, 999999999999.99, 0.20, 0, 'Directorship Fee u/s 149(3)', 'Income Tax Ordinance 2001, Section 149'),
('2025-26', 'withholding', 'profit_debt_15', 0, 999999999999.99, 0.15, 0, 'Profit on Debt u/s 151 @15%', 'Income Tax Ordinance 2001, Section 151'),
('2025-26', 'withholding', 'sukook_12_5', 0, 999999999999.99, 0.125, 0, 'Sukook u/s 151A @12.5%', 'Income Tax Ordinance 2001, Section 151A'),
('2025-26', 'withholding', 'rent_section_155', 0, 999999999999.99, 0.10, 0, 'Rent received Section 155', 'Income Tax Ordinance 2001, Section 155'),
('2025-26', 'withholding', 'motor_vehicle_transfer', 0, 999999999999.99, 0.03, 0, 'Motor Vehicle Transfer Fee', 'Income Tax Ordinance 2001, Section 231B'),
('2025-26', 'withholding', 'electricity_domestic', 0, 999999999999.99, 0.075, 0, 'Electricity Bill Domestic Consumer', 'Income Tax Ordinance 2001, Section 235'),
('2025-26', 'withholding', 'cellphone_bill', 0, 999999999999.99, 0.15, 0, 'Cellphone Bill', 'Income Tax Ordinance 2001, Section 236')
ON CONFLICT (tax_year, rate_type, rate_category) DO UPDATE SET
    tax_rate = EXCLUDED.tax_rate,
    updated_at = CURRENT_TIMESTAMP;

-- Final Tax Rates
INSERT INTO tax_rates_config (tax_year, rate_type, rate_category, min_amount, max_amount, tax_rate, fixed_amount, description, fbr_reference) VALUES
('2025-26', 'final_tax', 'dividend_reit_spv', 0, 999999999999.99, 0.00, 0, 'Dividend from REIT SPV', 'Income Tax Ordinance 2001, Section 150'),
('2025-26', 'final_tax', 'dividend_other_spv', 0, 999999999999.99, 0.35, 0, 'Dividend from other SPV', 'Income Tax Ordinance 2001, Section 150'),
('2025-26', 'final_tax', 'dividend_ipp_shares', 0, 999999999999.99, 0.075, 0, 'Dividend IPP Shares', 'Income Tax Ordinance 2001, Section 150'),
('2025-26', 'final_tax', 'dividend_standard', 0, 999999999999.99, 0.15, 0, 'Standard Dividend Rate', 'Income Tax Ordinance 2001, Section 150'),
('2025-26', 'final_tax', 'dividend_mutual_funds_debt', 0, 999999999999.99, 0.25, 0, 'Mutual Funds with 50%+ debt', 'Income Tax Ordinance 2001, Section 150'),
('2025-26', 'final_tax', 'sukook_return_25', 0, 999999999999.99, 0.25, 0, 'Return on Sukook 25%', 'Income Tax Ordinance 2001, Section 151'),
('2025-26', 'final_tax', 'sukook_1m_to_5m', 1000000, 5000000, 0.125, 0, 'Sukook Rs 1M to 5M', 'Income Tax Ordinance 2001, Section 151'),
('2025-26', 'final_tax', 'sukook_up_to_1m', 0, 1000000, 0.10, 0, 'Sukook up to Rs 1M', 'Income Tax Ordinance 2001, Section 151'),
('2025-26', 'final_tax', 'profit_debt_15_final', 0, 5000000, 0.15, 0, 'Profit on Debt up to 5M', 'Income Tax Ordinance 2001, Section 7B'),
('2025-26', 'final_tax', 'prize_bond', 0, 999999999999.99, 0.15, 0, 'Prize on Bond/Puzzle', 'Income Tax Ordinance 2001, Section 156'),
('2025-26', 'final_tax', 'prize_lottery', 0, 999999999999.99, 0.20, 0, 'Prize Lottery/Raffle', 'Income Tax Ordinance 2001, Section 156'),
('2025-26', 'final_tax', 'bonus_shares', 0, 999999999999.99, 0.10, 0, 'Bonus shares', 'Income Tax Ordinance 2001, Section 236Z')
ON CONFLICT (tax_year, rate_type, rate_category) DO UPDATE SET
    tax_rate = EXCLUDED.tax_rate,
    updated_at = CURRENT_TIMESTAMP;

-- =============================================================================
-- 5. CREATE AUDIT AND TRIGGER FUNCTIONS FOR NEW TABLES
-- =============================================================================

-- Add audit triggers for new tables
DROP TRIGGER IF EXISTS audit_tax_computation_forms_trigger ON tax_computation_forms;
CREATE TRIGGER audit_tax_computation_forms_trigger
    AFTER INSERT OR UPDATE OR DELETE ON tax_computation_forms
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

DROP TRIGGER IF EXISTS audit_wealth_statement_forms_trigger ON wealth_statement_forms;
CREATE TRIGGER audit_wealth_statement_forms_trigger
    AFTER INSERT OR UPDATE OR DELETE ON wealth_statement_forms
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Add updated_at triggers
DROP TRIGGER IF EXISTS update_tax_computation_forms_updated_at ON tax_computation_forms;
CREATE TRIGGER update_tax_computation_forms_updated_at
    BEFORE UPDATE ON tax_computation_forms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_wealth_statement_forms_updated_at ON wealth_statement_forms;
CREATE TRIGGER update_wealth_statement_forms_updated_at
    BEFORE UPDATE ON wealth_statement_forms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tax_rates_config_updated_at ON tax_rates_config;
CREATE TRIGGER update_tax_rates_config_updated_at
    BEFORE UPDATE ON tax_rates_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 6. CREATE INDEXES FOR PERFORMANCE OPTIMIZATION
-- =============================================================================

-- Indexes for tax_computation_forms
CREATE INDEX IF NOT EXISTS idx_tax_computation_taxable_income ON tax_computation_forms(taxable_income_including_cg);
CREATE INDEX IF NOT EXISTS idx_tax_computation_normal_tax ON tax_computation_forms(normal_income_tax);
CREATE INDEX IF NOT EXISTS idx_tax_computation_net_payable ON tax_computation_forms(net_tax_payable);

-- Indexes for wealth_statement_forms
CREATE INDEX IF NOT EXISTS idx_wealth_statement_forms_return ON wealth_statement_forms(tax_return_id);
CREATE INDEX IF NOT EXISTS idx_wealth_statement_forms_user ON wealth_statement_forms(user_id, user_email);
CREATE INDEX IF NOT EXISTS idx_wealth_statement_forms_year ON wealth_statement_forms(tax_year_id, tax_year);
CREATE INDEX IF NOT EXISTS idx_wealth_net_wealth_curr ON wealth_statement_forms(net_wealth_curr);

-- Indexes for tax_rates_config
CREATE INDEX IF NOT EXISTS idx_tax_rates_year_type ON tax_rates_config(tax_year, rate_type);
CREATE INDEX IF NOT EXISTS idx_tax_rates_category ON tax_rates_config(rate_category);
CREATE INDEX IF NOT EXISTS idx_tax_rates_amount_range ON tax_rates_config(min_amount, max_amount);
CREATE INDEX IF NOT EXISTS idx_tax_rates_active ON tax_rates_config(is_active);

-- =============================================================================
-- 7. ADD VALIDATION CONSTRAINTS
-- =============================================================================

-- Validation for tax computation
ALTER TABLE tax_computation_forms ADD CONSTRAINT check_positive_income
    CHECK (total_income >= 0);

ALTER TABLE tax_computation_forms ADD CONSTRAINT check_positive_tax
    CHECK (normal_income_tax >= 0 AND surcharge_amount >= 0 AND capital_gains_tax >= 0);

-- Validation for wealth statement
ALTER TABLE wealth_statement_forms ADD CONSTRAINT check_positive_assets
    CHECK (total_assets_prev >= 0 AND total_assets_curr >= 0);

-- Validation for tax rates
ALTER TABLE tax_rates_config ADD CONSTRAINT check_valid_rate_range
    CHECK (tax_rate >= 0 AND tax_rate <= 1);

ALTER TABLE tax_rates_config ADD CONSTRAINT check_valid_amount_range
    CHECK (min_amount <= max_amount);

-- =============================================================================
-- 8. CREATE VIEW FOR COMPREHENSIVE TAX CALCULATION
-- =============================================================================

CREATE OR REPLACE VIEW v_comprehensive_tax_calculation AS
SELECT
    tc.id,
    tc.user_id,
    tc.user_email,
    tc.tax_year,

    -- Income Components
    if.total_employment_income as employment_income,
    fmi.grand_total as final_min_income,
    cg.total_capital_gain as capital_gains,

    -- Tax Calculations
    tc.taxable_income_including_cg,
    tc.normal_income_tax,
    tc.surcharge_amount,
    tc.capital_gains_tax,
    tc.net_tax_payable,

    -- Adjustments
    rf.total_reductions as tax_reductions,
    cf.total_credits as tax_credits,
    atf.total_adjustable_tax as advance_tax_paid,

    -- Final Balance
    tc.balance_payable,

    -- Wealth Position
    ws.net_wealth_prev,
    ws.net_wealth_curr,
    (ws.net_wealth_curr - ws.net_wealth_prev) as wealth_increase

FROM tax_computation_forms tc
LEFT JOIN income_forms if ON tc.user_id = if.user_id AND tc.tax_year = if.tax_year
LEFT JOIN final_min_income_forms fmi ON tc.user_id = fmi.user_id AND tc.tax_year = fmi.tax_year
LEFT JOIN capital_gain_forms cg ON tc.user_id = cg.user_id AND tc.tax_year = cg.tax_year
LEFT JOIN reductions_forms rf ON tc.user_id = rf.user_id AND tc.tax_year = rf.tax_year
LEFT JOIN credits_forms cf ON tc.user_id = cf.user_id AND tc.tax_year = cf.tax_year
LEFT JOIN adjustable_tax_forms atf ON tc.user_id = atf.user_id AND tc.tax_year = atf.tax_year
LEFT JOIN wealth_statement_forms ws ON tc.user_id = ws.user_id AND tc.tax_year = ws.tax_year;

-- =============================================================================
-- 9. GRANT PERMISSIONS
-- =============================================================================

-- Grant permissions to application user (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tax_advisor_app') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON tax_computation_forms TO tax_advisor_app;
        GRANT SELECT, INSERT, UPDATE, DELETE ON wealth_statement_forms TO tax_advisor_app;
        GRANT SELECT, INSERT, UPDATE, DELETE ON tax_rates_config TO tax_advisor_app;
        GRANT SELECT ON v_comprehensive_tax_calculation TO tax_advisor_app;
        GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO tax_advisor_app;
    END IF;
END $$;

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'Database schema updated successfully for Excel calculation compliance';
    RAISE NOTICE 'New tables created: tax_computation_forms, wealth_statement_forms, tax_rates_config';
    RAISE NOTICE 'FBR compliant tax rates inserted for Tax Year 2025-26';
    RAISE NOTICE 'All calculations now match Excel formulas as per XlCal.md';
END $$;