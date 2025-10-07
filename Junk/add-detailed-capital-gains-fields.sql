-- Migration to add detailed capital gains fields to match Excel structure
-- This adds all the specific fields for different holding periods and securities types

-- ========================================
-- Add detailed immovable property fields
-- ========================================

ALTER TABLE capital_gain_forms
ADD COLUMN IF NOT EXISTS immovable_property_1_year_taxable DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS immovable_property_1_year_deducted DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS immovable_property_1_year_carryable DECIMAL(15,2) DEFAULT 0,

ADD COLUMN IF NOT EXISTS immovable_property_2_years_taxable DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS immovable_property_2_years_deducted DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS immovable_property_2_years_carryable DECIMAL(15,2) DEFAULT 0,

ADD COLUMN IF NOT EXISTS immovable_property_3_years_taxable DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS immovable_property_3_years_deducted DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS immovable_property_3_years_carryable DECIMAL(15,2) DEFAULT 0,

ADD COLUMN IF NOT EXISTS immovable_property_4_years_taxable DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS immovable_property_4_years_deducted DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS immovable_property_4_years_carryable DECIMAL(15,2) DEFAULT 0,

ADD COLUMN IF NOT EXISTS immovable_property_5_years_taxable DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS immovable_property_5_years_deducted DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS immovable_property_5_years_carryable DECIMAL(15,2) DEFAULT 0,

ADD COLUMN IF NOT EXISTS immovable_property_6_years_taxable DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS immovable_property_6_years_deducted DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS immovable_property_6_years_carryable DECIMAL(15,2) DEFAULT 0,

ADD COLUMN IF NOT EXISTS immovable_property_over_6_years_taxable DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS immovable_property_over_6_years_deducted DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS immovable_property_over_6_years_carryable DECIMAL(15,2) DEFAULT 0;

-- ========================================
-- Add detailed securities fields
-- ========================================

ALTER TABLE capital_gain_forms
ADD COLUMN IF NOT EXISTS securities_before_july_2013_taxable DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS securities_before_july_2013_deducted DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS securities_before_july_2013_carryable DECIMAL(15,2) DEFAULT 0,

ADD COLUMN IF NOT EXISTS securities_pmex_settled_taxable DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS securities_pmex_settled_deducted DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS securities_pmex_settled_carryable DECIMAL(15,2) DEFAULT 0,

ADD COLUMN IF NOT EXISTS securities_37a_7_5_percent_taxable DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS securities_37a_7_5_percent_deducted DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS securities_37a_7_5_percent_carryable DECIMAL(15,2) DEFAULT 0,

ADD COLUMN IF NOT EXISTS securities_mutual_funds_10_percent_taxable DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS securities_mutual_funds_10_percent_deducted DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS securities_mutual_funds_10_percent_carryable DECIMAL(15,2) DEFAULT 0,

ADD COLUMN IF NOT EXISTS securities_mutual_funds_12_5_percent_taxable DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS securities_mutual_funds_12_5_percent_deducted DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS securities_mutual_funds_12_5_percent_carryable DECIMAL(15,2) DEFAULT 0,

ADD COLUMN IF NOT EXISTS securities_other_25_percent_taxable DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS securities_other_25_percent_deducted DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS securities_other_25_percent_carryable DECIMAL(15,2) DEFAULT 0,

ADD COLUMN IF NOT EXISTS securities_12_5_percent_before_july_2022_taxable DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS securities_12_5_percent_before_july_2022_deducted DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS securities_12_5_percent_before_july_2022_carryable DECIMAL(15,2) DEFAULT 0,

ADD COLUMN IF NOT EXISTS securities_15_percent_taxable DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS securities_15_percent_deducted DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS securities_15_percent_carryable DECIMAL(15,2) DEFAULT 0;

-- ========================================
-- Update computed total columns
-- ========================================

-- Drop existing computed columns and recreate with new fields
ALTER TABLE capital_gain_forms DROP COLUMN IF EXISTS total_capital_gain;
ALTER TABLE capital_gain_forms DROP COLUMN IF EXISTS total_tax_deducted;
ALTER TABLE capital_gain_forms DROP COLUMN IF EXISTS total_tax_carryable;

ALTER TABLE capital_gain_forms
ADD COLUMN total_capital_gain DECIMAL(15,2) GENERATED ALWAYS AS (
    COALESCE(immovable_property_1_year_taxable, 0) +
    COALESCE(immovable_property_2_years_taxable, 0) +
    COALESCE(immovable_property_3_years_taxable, 0) +
    COALESCE(immovable_property_4_years_taxable, 0) +
    COALESCE(immovable_property_5_years_taxable, 0) +
    COALESCE(immovable_property_6_years_taxable, 0) +
    COALESCE(immovable_property_over_6_years_taxable, 0) +
    COALESCE(securities_before_july_2013_taxable, 0) +
    COALESCE(securities_pmex_settled_taxable, 0) +
    COALESCE(securities_37a_7_5_percent_taxable, 0) +
    COALESCE(securities_mutual_funds_10_percent_taxable, 0) +
    COALESCE(securities_mutual_funds_12_5_percent_taxable, 0) +
    COALESCE(securities_other_25_percent_taxable, 0) +
    COALESCE(securities_12_5_percent_before_july_2022_taxable, 0) +
    COALESCE(securities_15_percent_taxable, 0) +
    COALESCE(property_1_year, 0) +
    COALESCE(property_2_3_years, 0) +
    COALESCE(property_4_plus_years, 0) +
    COALESCE(securities, 0) +
    COALESCE(other_capital_gains, 0)
) STORED;

ALTER TABLE capital_gain_forms
ADD COLUMN total_tax_deducted DECIMAL(15,2) GENERATED ALWAYS AS (
    COALESCE(immovable_property_1_year_deducted, 0) +
    COALESCE(immovable_property_2_years_deducted, 0) +
    COALESCE(immovable_property_3_years_deducted, 0) +
    COALESCE(immovable_property_4_years_deducted, 0) +
    COALESCE(immovable_property_5_years_deducted, 0) +
    COALESCE(immovable_property_6_years_deducted, 0) +
    COALESCE(immovable_property_over_6_years_deducted, 0) +
    COALESCE(securities_before_july_2013_deducted, 0) +
    COALESCE(securities_pmex_settled_deducted, 0) +
    COALESCE(securities_37a_7_5_percent_deducted, 0) +
    COALESCE(securities_mutual_funds_10_percent_deducted, 0) +
    COALESCE(securities_mutual_funds_12_5_percent_deducted, 0) +
    COALESCE(securities_other_25_percent_deducted, 0) +
    COALESCE(securities_12_5_percent_before_july_2022_deducted, 0) +
    COALESCE(securities_15_percent_deducted, 0) +
    COALESCE(property_1_year_tax_deducted, 0) +
    COALESCE(property_2_3_years_tax_deducted, 0) +
    COALESCE(property_4_plus_years_tax_deducted, 0) +
    COALESCE(securities_tax_deducted, 0) +
    COALESCE(other_capital_gains_tax_deducted, 0)
) STORED;

ALTER TABLE capital_gain_forms
ADD COLUMN total_tax_carryable DECIMAL(15,2) GENERATED ALWAYS AS (
    COALESCE(immovable_property_1_year_carryable, 0) +
    COALESCE(immovable_property_2_years_carryable, 0) +
    COALESCE(immovable_property_3_years_carryable, 0) +
    COALESCE(immovable_property_4_years_carryable, 0) +
    COALESCE(immovable_property_5_years_carryable, 0) +
    COALESCE(immovable_property_6_years_carryable, 0) +
    COALESCE(immovable_property_over_6_years_carryable, 0) +
    COALESCE(securities_before_july_2013_carryable, 0) +
    COALESCE(securities_pmex_settled_carryable, 0) +
    COALESCE(securities_37a_7_5_percent_carryable, 0) +
    COALESCE(securities_mutual_funds_10_percent_carryable, 0) +
    COALESCE(securities_mutual_funds_12_5_percent_carryable, 0) +
    COALESCE(securities_other_25_percent_carryable, 0) +
    COALESCE(securities_12_5_percent_before_july_2022_carryable, 0) +
    COALESCE(securities_15_percent_carryable, 0) +
    COALESCE(property_1_year_tax_carryable, 0) +
    COALESCE(property_2_3_years_tax_carryable, 0) +
    COALESCE(property_4_plus_years_tax_carryable, 0) +
    COALESCE(securities_tax_carryable, 0) +
    COALESCE(other_capital_gains_tax_carryable, 0)
) STORED;

-- ========================================
-- Add helpful comments
-- ========================================

COMMENT ON COLUMN capital_gain_forms.immovable_property_1_year_taxable IS 'Capital Gains on Immovable Property u/s 37(1A) where holding period does not exceed 1 year';
COMMENT ON COLUMN capital_gain_forms.immovable_property_2_years_taxable IS 'Capital Gains on Immovable Property u/s 37(1A) where holding period exceeds 1 year but does not exceed 2 years';
COMMENT ON COLUMN capital_gain_forms.immovable_property_3_years_taxable IS 'Capital Gains on Immovable Property u/s 37(1A) where holding period exceeds 2 years but does not exceed 3 years';
COMMENT ON COLUMN capital_gain_forms.immovable_property_4_years_taxable IS 'Capital Gains on Immovable Property u/s 37(1A) where holding period exceeds 3 years but does not exceed 4 years';
COMMENT ON COLUMN capital_gain_forms.immovable_property_5_years_taxable IS 'Capital Gains on Immovable Property u/s 37(1A) where holding period exceeds 4 years but does not exceed 5 years';
COMMENT ON COLUMN capital_gain_forms.immovable_property_6_years_taxable IS 'Capital Gains on Immovable Property u/s 37(1A) where holding period exceeds 5 years but does not exceed 6 years';
COMMENT ON COLUMN capital_gain_forms.immovable_property_over_6_years_taxable IS 'Capital Gains on Immovable Property u/s 37(1A) where holding period exceeds 6 years';

COMMENT ON COLUMN capital_gain_forms.securities_before_july_2013_taxable IS 'Capital Gain on Securities u/s 37A @5% acquired before 1-Jul-2013';
COMMENT ON COLUMN capital_gain_forms.securities_pmex_settled_taxable IS 'Capital Gain on Securities u/s 37A @5% (PMEX/Cash Settled Securities)';
COMMENT ON COLUMN capital_gain_forms.securities_37a_7_5_percent_taxable IS 'Capital Gain on Securities u/s 37A @7.5%';
COMMENT ON COLUMN capital_gain_forms.securities_mutual_funds_10_percent_taxable IS 'Capital Gain on Securities / Mutual Funds / Collective Schemes / REIT u/s 37A @10%';
COMMENT ON COLUMN capital_gain_forms.securities_mutual_funds_12_5_percent_taxable IS 'Capital Gain on Securities / Mutual Funds / Collective Schemes / REIT (for stock funds) u/s 37A @12.5%';
COMMENT ON COLUMN capital_gain_forms.securities_other_25_percent_taxable IS 'Capital Gain on Securities / Mutual Funds / Collective Schemes / REIT (Other than stock funds) u/s 37A @25%';
COMMENT ON COLUMN capital_gain_forms.securities_12_5_percent_before_july_2022_taxable IS 'Capital Gain on Securities u/s 37A @12.5% (Securities acquired before July 01, 2022 regardless of holding period)';
COMMENT ON COLUMN capital_gain_forms.securities_15_percent_taxable IS 'Capital Gain on Securities u/s 37A @15%';

-- ========================================
-- Create indexes for new fields
-- ========================================

CREATE INDEX IF NOT EXISTS idx_capital_gains_immovable_1_year ON capital_gain_forms(immovable_property_1_year_taxable);
CREATE INDEX IF NOT EXISTS idx_capital_gains_securities_before_2013 ON capital_gain_forms(securities_before_july_2013_taxable);
CREATE INDEX IF NOT EXISTS idx_capital_gains_securities_12_5_before_2022 ON capital_gain_forms(securities_12_5_percent_before_july_2022_taxable);