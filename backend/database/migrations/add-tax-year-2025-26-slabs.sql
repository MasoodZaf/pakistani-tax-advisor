-- Migration: Add Tax Year 2025-26 with Finance Act 2025 tax slabs
-- Finance Act 2025 — applicable for Tax Year 2025-26 (July 2025 – June 2026)
-- Slabs per FBR notification; surcharge of 9% applied at application level for income > Rs 10M

-- Step 1: Deactivate TY 2024-25 as the current year
UPDATE tax_years SET is_current = false WHERE tax_year = '2024-25';

-- Step 2: Insert TY 2025-26
INSERT INTO tax_years (
    tax_year, start_date, end_date, filing_deadline, is_current, is_active, description
)
SELECT
    '2025-26',
    '2025-07-01',
    '2026-06-30',
    '2026-09-30',
    true,
    true,
    'Tax Year 2025-26 — Finance Act 2025'
WHERE NOT EXISTS (SELECT 1 FROM tax_years WHERE tax_year = '2025-26');

-- Step 3: Insert Finance Act 2025 individual slabs
WITH tax_year AS (SELECT id FROM tax_years WHERE tax_year = '2025-26')
INSERT INTO tax_slabs (
    tax_year_id, slab_name, slab_order, min_income, max_income, tax_rate,
    slab_type, applicable_to, effective_from, effective_to
)
SELECT * FROM (VALUES
    ((SELECT id FROM tax_year), 'Slab 1 — Nil',     1, 0.00,      600000.00,  0.00, 'individual', '{"individual": true}'::jsonb, '2025-07-01'::date, '2026-06-30'::date),
    ((SELECT id FROM tax_year), 'Slab 2 — 1%',      2, 600001.00, 1200000.00, 0.01, 'individual', '{"individual": true}'::jsonb, '2025-07-01'::date, '2026-06-30'::date),
    ((SELECT id FROM tax_year), 'Slab 3 — 11%',     3, 1200001.00,2200000.00, 0.11, 'individual', '{"individual": true}'::jsonb, '2025-07-01'::date, '2026-06-30'::date),
    ((SELECT id FROM tax_year), 'Slab 4 — 23%',     4, 2200001.00,3200000.00, 0.23, 'individual', '{"individual": true}'::jsonb, '2025-07-01'::date, '2026-06-30'::date),
    ((SELECT id FROM tax_year), 'Slab 5 — 30%',     5, 3200001.00,4100000.00, 0.30, 'individual', '{"individual": true}'::jsonb, '2025-07-01'::date, '2026-06-30'::date),
    ((SELECT id FROM tax_year), 'Slab 6 — 35%',     6, 4100001.00,NULL,       0.35, 'individual', '{"individual": true}'::jsonb, '2025-07-01'::date, '2026-06-30'::date)
) AS v(tax_year_id, slab_name, slab_order, min_income, max_income, tax_rate, slab_type, applicable_to, effective_from, effective_to)
WHERE NOT EXISTS (
    SELECT 1 FROM tax_slabs
    WHERE tax_year_id = (SELECT id FROM tax_years WHERE tax_year = '2025-26')
    AND slab_type = 'individual'
);

-- Verify
SELECT ty.tax_year, ts.slab_name, ts.min_income, ts.max_income, ts.tax_rate
FROM tax_slabs ts
JOIN tax_years ty ON ts.tax_year_id = ty.id
WHERE ty.tax_year = '2025-26'
ORDER BY ts.slab_order;
