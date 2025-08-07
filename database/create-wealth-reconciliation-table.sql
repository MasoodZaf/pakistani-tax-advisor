-- Create wealth_reconciliation_forms table for FBR compliance
CREATE TABLE IF NOT EXISTS wealth_reconciliation_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_return_id UUID REFERENCES tax_returns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  user_email VARCHAR(255) NOT NULL,
  tax_year_id UUID REFERENCES tax_years(id) ON DELETE CASCADE,
  tax_year VARCHAR(10) NOT NULL,
  
  -- Net Assets (automatically populated from wealth_forms)
  net_assets_current_year DECIMAL(15,2) DEFAULT 0,
  net_assets_previous_year DECIMAL(15,2) DEFAULT 0,
  net_assets_increase DECIMAL(15,2) DEFAULT 0,
  
  -- Inflows (automatically populated from other forms)
  income_normal_tax DECIMAL(15,2) DEFAULT 0,
  income_exempt_from_tax DECIMAL(15,2) DEFAULT 0,
  income_final_tax DECIMAL(15,2) DEFAULT 0,
  
  -- Adjustments and Other Inflows (user input required)
  foreign_remittance DECIMAL(15,2) DEFAULT 0,
  inheritance DECIMAL(15,2) DEFAULT 0,
  gift_value DECIMAL(15,2) DEFAULT 0,
  asset_disposal_gain_loss DECIMAL(15,2) DEFAULT 0,
  other_inflows DECIMAL(15,2) DEFAULT 0,
  
  -- Total Inflows (calculated in application)
  total_inflows DECIMAL(15,2) DEFAULT 0,
  
  -- Outflows (user input required)
  personal_expenses DECIMAL(15,2) DEFAULT 0 NOT NULL,
  adjustments_outflows DECIMAL(15,2) DEFAULT 0,
  gift_outflow DECIMAL(15,2) DEFAULT 0,
  loss_on_disposal DECIMAL(15,2) DEFAULT 0,
  
  -- Total Outflows (calculated in application)
  total_outflows DECIMAL(15,2) DEFAULT 0,
  
  -- Final Calculations (calculated in application)
  calculated_net_increase DECIMAL(15,2) DEFAULT 0,
  
  -- CRITICAL: Unreconciled difference - MUST be zero for FBR compliance
  unreconciled_difference DECIMAL(15,2) DEFAULT 0,
  
  -- Form completion status
  is_complete BOOLEAN DEFAULT FALSE,
  last_updated_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT unique_wealth_reconciliation_per_user_year UNIQUE (user_id, user_email, tax_year_id),
  CONSTRAINT wealth_reconciliation_personal_expenses_positive CHECK (personal_expenses >= 0)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_wealth_reconciliation_user_year 
ON wealth_reconciliation_forms (user_id, tax_year_id);

CREATE INDEX IF NOT EXISTS idx_wealth_reconciliation_completion 
ON wealth_reconciliation_forms (is_complete, tax_year_id);

-- Add comments for documentation
COMMENT ON TABLE wealth_reconciliation_forms IS 'Critical FBR compliance form - reconciles net worth increase with declared income and expenses';
COMMENT ON COLUMN wealth_reconciliation_forms.unreconciled_difference IS 'CRITICAL: Must be zero (0) for FBR tax return submission approval';
COMMENT ON COLUMN wealth_reconciliation_forms.personal_expenses IS 'Required field - personal/living expenses during the tax year';

-- Create update trigger for updated_at
CREATE OR REPLACE FUNCTION update_wealth_reconciliation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER wealth_reconciliation_updated_at
    BEFORE UPDATE ON wealth_reconciliation_forms
    FOR EACH ROW
    EXECUTE FUNCTION update_wealth_reconciliation_updated_at();

-- Grant appropriate permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON wealth_reconciliation_forms TO postgres;

COMMIT;