-- Migration to update expenses_forms table to match reference table structure
-- This script adds new columns and renames existing ones to match the reference image

-- First rename existing columns to match reference naming
ALTER TABLE expenses_forms
RENAME COLUMN rates TO rates_taxes_charges;

ALTER TABLE expenses_forms
RENAME COLUMN vehicle TO vehicle_running_maintenance;

ALTER TABLE expenses_forms
RENAME COLUMN donations TO donations_zakat_annuity;

-- Add new columns that are missing
ALTER TABLE expenses_forms
ADD COLUMN IF NOT EXISTS asset_insurance_security DECIMAL(15,2) DEFAULT 0;

ALTER TABLE expenses_forms
ADD COLUMN IF NOT EXISTS club DECIMAL(15,2) DEFAULT 0;

ALTER TABLE expenses_forms
ADD COLUMN IF NOT EXISTS functions_gatherings DECIMAL(15,2) DEFAULT 0;

ALTER TABLE expenses_forms
ADD COLUMN IF NOT EXISTS family_contribution DECIMAL(15,2) DEFAULT 0;

ALTER TABLE expenses_forms
ADD COLUMN IF NOT EXISTS net_expenses_by_taxpayer DECIMAL(15,2) DEFAULT 0;

-- Remove the old entertainment and maintenance columns since they are being reorganized
-- entertainment becomes part of functions_gatherings
-- maintenance becomes part of vehicle_running_maintenance

-- Update the total_expenses calculation to include all new fields
-- Note: This will need to be handled in application logic since PostgreSQL doesn't support
-- updating computed columns easily

-- Add comments to document the field mapping
COMMENT ON COLUMN expenses_forms.rates_taxes_charges IS 'Rates / Taxes / Charge / Cess as per reference table';
COMMENT ON COLUMN expenses_forms.vehicle_running_maintenance IS 'Vehicle Running / Maintenance as per reference table';
COMMENT ON COLUMN expenses_forms.donations_zakat_annuity IS 'Donation, Zakat, Annuity, Profit on Debt, Life Insurance Premium, etc.';
COMMENT ON COLUMN expenses_forms.asset_insurance_security IS 'Asset Insurance / Security';
COMMENT ON COLUMN expenses_forms.club IS 'Club memberships and fees';
COMMENT ON COLUMN expenses_forms.functions_gatherings IS 'Functions / Gatherings (replaces entertainment)';
COMMENT ON COLUMN expenses_forms.family_contribution IS 'Contribution in Expenses by Family Members';
COMMENT ON COLUMN expenses_forms.net_expenses_by_taxpayer IS 'Net expenses after deducting family contribution (B22 formula)';
COMMENT ON COLUMN expenses_forms.other_expenses IS 'Other Personal / Household Expenses (balancing figure)';