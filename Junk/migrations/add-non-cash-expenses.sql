-- Migration to add non_cash_expenses field to wealth_reconciliation_forms table
-- This field is critical for proper FBR wealth reconciliation compliance

-- Check if wealth_reconciliation_forms table exists, if not create it
CREATE TABLE IF NOT EXISTS wealth_reconciliation_forms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tax_return_id UUID NOT NULL REFERENCES tax_returns(id),
    user_id UUID NOT NULL REFERENCES users(id),
    user_email VARCHAR(255) NOT NULL,
    tax_year_id UUID NOT NULL REFERENCES tax_years(id),
    tax_year VARCHAR(10) NOT NULL,

    -- Net Assets
    net_assets_current_year DECIMAL(15,2) DEFAULT 0,
    net_assets_previous_year DECIMAL(15,2) DEFAULT 0,
    net_assets_increase DECIMAL(15,2) DEFAULT 0,

    -- Inflows
    income_normal_tax DECIMAL(15,2) DEFAULT 0,
    income_exempt_from_tax DECIMAL(15,2) DEFAULT 0,
    income_final_tax DECIMAL(15,2) DEFAULT 0,
    non_cash_expenses DECIMAL(15,2) DEFAULT 0,  -- New critical field
    foreign_remittance DECIMAL(15,2) DEFAULT 0,
    inheritance DECIMAL(15,2) DEFAULT 0,
    gift_value DECIMAL(15,2) DEFAULT 0,
    asset_disposal_gain_loss DECIMAL(15,2) DEFAULT 0,
    other_inflows DECIMAL(15,2) DEFAULT 0,
    total_inflows DECIMAL(15,2) DEFAULT 0,

    -- Outflows
    personal_expenses DECIMAL(15,2) DEFAULT 0,
    adjustments_outflows DECIMAL(15,2) DEFAULT 0,
    gift_outflow DECIMAL(15,2) DEFAULT 0,
    loss_on_disposal DECIMAL(15,2) DEFAULT 0,
    total_outflows DECIMAL(15,2) DEFAULT 0,

    -- Final calculation
    calculated_net_increase DECIMAL(15,2) DEFAULT 0,
    unreconciled_difference DECIMAL(15,2) DEFAULT 0,

    -- Meta fields
    is_complete BOOLEAN DEFAULT false,
    last_updated_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_user_email FOREIGN KEY (user_id, user_email) REFERENCES users(id, email),
    CONSTRAINT fk_tax_year FOREIGN KEY (tax_year_id, tax_year) REFERENCES tax_years(id, tax_year)
);

-- If the table already exists, just add the non_cash_expenses column
ALTER TABLE wealth_reconciliation_forms
ADD COLUMN IF NOT EXISTS non_cash_expenses DECIMAL(15,2) DEFAULT 0;

-- Add comment to document the field purpose
COMMENT ON COLUMN wealth_reconciliation_forms.non_cash_expenses IS 'Non-cash expenses adjustment for wealth reconciliation (entered as positive, subtracted from inflows)';

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_wealth_reconciliation_forms_user ON wealth_reconciliation_forms(user_id, user_email);
CREATE INDEX IF NOT EXISTS idx_wealth_reconciliation_forms_return ON wealth_reconciliation_forms(tax_return_id);
CREATE INDEX IF NOT EXISTS idx_wealth_reconciliation_forms_year ON wealth_reconciliation_forms(tax_year_id, tax_year);

-- Add update trigger if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_wealth_reconciliation_forms_updated_at ON wealth_reconciliation_forms;
CREATE TRIGGER update_wealth_reconciliation_forms_updated_at
    BEFORE UPDATE ON wealth_reconciliation_forms
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add audit trigger if it doesn't exist
DROP TRIGGER IF EXISTS audit_wealth_reconciliation_forms_trigger ON wealth_reconciliation_forms;
CREATE TRIGGER audit_wealth_reconciliation_forms_trigger
    AFTER INSERT OR UPDATE OR DELETE ON wealth_reconciliation_forms
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();