-- Migration script to add Tax Year 2025-26 with latest FBR rates
-- Based on Pakistan's Federal Board of Revenue latest income tax slabs for salaried individuals

-- Insert tax year 2025-26
INSERT INTO tax_years (
    tax_year, start_date, end_date, filing_deadline, is_current, is_active, description
) VALUES (
    '2025-26',
    '2025-07-01',
    '2026-06-30',
    '2026-09-30',
    true,
    true,
    'Tax Year 2025-26 - Latest FBR Rates'
) ON CONFLICT (tax_year) DO UPDATE SET
    is_current = EXCLUDED.is_current,
    is_active = EXCLUDED.is_active,
    description = EXCLUDED.description;

-- Set previous tax years as not current
UPDATE tax_years SET is_current = false WHERE tax_year != '2025-26';

-- Insert updated tax slabs for 2025-26 based on latest FBR rates
-- These rates are for salaried individuals (non-filers may have higher rates)
WITH tax_year AS (SELECT id FROM tax_years WHERE tax_year = '2025-26')
INSERT INTO tax_slabs (
    tax_year_id, slab_name, slab_order, min_income, max_income, tax_rate,
    slab_type, applicable_to, effective_from, effective_to
) VALUES
    -- Slab 1: 0 to 600,000 - 0% (No tax)
    ((SELECT id FROM tax_year), 'Tax Free Slab', 1, 0, 600000, 0.00, 'individual', '{"individual": true, "salaried": true}', '2025-07-01', '2026-06-30'),
    
    -- Slab 2: 600,001 to 1,200,000 - 2.5% (Updated rate)
    ((SELECT id FROM tax_year), 'Low Income Slab', 2, 600001, 1200000, 0.025, 'individual', '{"individual": true, "salaried": true}', '2025-07-01', '2026-06-30'),
    
    -- Slab 3: 1,200,001 to 2,400,000 - 12.5% (Updated rate and bracket)
    ((SELECT id FROM tax_year), 'Medium Income Slab 1', 3, 1200001, 2400000, 0.125, 'individual', '{"individual": true, "salaried": true}', '2025-07-01', '2026-06-30'),
    
    -- Slab 4: 2,400,001 to 3,600,000 - 22.5% (Updated rate and bracket)
    ((SELECT id FROM tax_year), 'Medium Income Slab 2', 4, 2400001, 3600000, 0.225, 'individual', '{"individual": true, "salaried": true}', '2025-07-01', '2026-06-30'),
    
    -- Slab 5: 3,600,001 to 6,000,000 - 27.5% (Updated rate and bracket)
    ((SELECT id FROM tax_year), 'High Income Slab 1', 5, 3600001, 6000000, 0.275, 'individual', '{"individual": true, "salaried": true}', '2025-07-01', '2026-06-30'),
    
    -- Slab 6: 6,000,001 to 12,000,000 - 32.5% (Updated rate and bracket)
    ((SELECT id FROM tax_year), 'High Income Slab 2', 6, 6000001, 12000000, 0.325, 'individual', '{"individual": true, "salaried": true}', '2025-07-01', '2026-06-30'),
    
    -- Slab 7: Above 12,000,000 - 39% (Highest slab)
    ((SELECT id FROM tax_year), 'Super High Income Slab', 7, 12000001, NULL, 0.39, 'individual', '{"individual": true, "salaried": true}', '2025-07-01', '2026-06-30')

ON CONFLICT (tax_year_id, slab_order) DO UPDATE SET
    slab_name = EXCLUDED.slab_name,
    min_income = EXCLUDED.min_income,
    max_income = EXCLUDED.max_income,
    tax_rate = EXCLUDED.tax_rate,
    applicable_to = EXCLUDED.applicable_to,
    effective_from = EXCLUDED.effective_from,
    effective_to = EXCLUDED.effective_to;

-- Insert tax slabs for non-filers (higher rates) - 2025-26
WITH tax_year AS (SELECT id FROM tax_years WHERE tax_year = '2025-26')
INSERT INTO tax_slabs (
    tax_year_id, slab_name, slab_order, min_income, max_income, tax_rate,
    slab_type, applicable_to, effective_from, effective_to
) VALUES
    -- Non-filer rates (typically 1.5x to 2x higher)
    ((SELECT id FROM tax_year), 'Non-Filer Tax Free Slab', 11, 0, 600000, 0.00, 'non_filer', '{"individual": true, "non_filer": true}', '2025-07-01', '2026-06-30'),
    ((SELECT id FROM tax_year), 'Non-Filer Low Income', 12, 600001, 1200000, 0.05, 'non_filer', '{"individual": true, "non_filer": true}', '2025-07-01', '2026-06-30'),
    ((SELECT id FROM tax_year), 'Non-Filer Medium Income 1', 13, 1200001, 2400000, 0.25, 'non_filer', '{"individual": true, "non_filer": true}', '2025-07-01', '2026-06-30'),
    ((SELECT id FROM tax_year), 'Non-Filer Medium Income 2', 14, 2400001, 3600000, 0.45, 'non_filer', '{"individual": true, "non_filer": true}', '2025-07-01', '2026-06-30'),
    ((SELECT id FROM tax_year), 'Non-Filer High Income 1', 15, 3600001, 6000000, 0.55, 'non_filer', '{"individual": true, "non_filer": true}', '2025-07-01', '2026-06-30'),
    ((SELECT id FROM tax_year), 'Non-Filer High Income 2', 16, 6000001, 12000000, 0.65, 'non_filer', '{"individual": true, "non_filer": true}', '2025-07-01', '2026-06-30'),
    ((SELECT id FROM tax_year), 'Non-Filer Super High Income', 17, 12000001, NULL, 0.75, 'non_filer', '{"individual": true, "non_filer": true}', '2025-07-01', '2026-06-30')

ON CONFLICT (tax_year_id, slab_order) DO UPDATE SET
    slab_name = EXCLUDED.slab_name,
    min_income = EXCLUDED.min_income,
    max_income = EXCLUDED.max_income,
    tax_rate = EXCLUDED.tax_rate,
    applicable_to = EXCLUDED.applicable_to,
    effective_from = EXCLUDED.effective_from,
    effective_to = EXCLUDED.effective_to;

-- Update indexes for optimal performance
REINDEX INDEX idx_tax_slabs_year;
REINDEX INDEX idx_tax_slabs_order;
REINDEX INDEX idx_tax_slabs_income;

-- Add comment for future reference
COMMENT ON TABLE tax_slabs IS 'Tax slabs updated for 2025-26 as per latest FBR rates for salaried individuals and non-filers';

-- Log this migration
INSERT INTO audit_log (
    user_id, user_email, action, table_name, record_id,
    field_name, new_value, category, change_summary
) VALUES (
    (SELECT id FROM users WHERE role = 'super_admin' LIMIT 1),
    (SELECT email FROM users WHERE role = 'super_admin' LIMIT 1),
    'migration', 'tax_slabs', 
    (SELECT id FROM tax_years WHERE tax_year = '2025-26'),
    'tax_year_2025_26', 
    '{"migration": "Added 2025-26 tax year with latest FBR rates", "slabs_added": 14}',
    'database_migration',
    'Migration: Added Tax Year 2025-26 with updated FBR tax slabs for salaried individuals and non-filers'
);

SELECT 'Migration completed successfully! Tax Year 2025-26 added with latest FBR rates.' as status;