-- phase-z4: correct the 2025-26 salaried slab lower bounds (TAX-04 / TAX-05)
--
-- The progressive-tax walker (CalculationService.calculateProgressiveTax) treats
-- min_income as the slab's "starts-at" value and computes effectiveLower =
-- min_income - 1 (so a slab taxes income STRICTLY above the break-point). It
-- therefore expects min_income seeded as 600001 / 1200001 / ... — exactly what
-- the 2024-25 slabs and the FBR Tax Card use.
--
-- The 2025-26 slabs were seeded one rupee low (600000 / 1200000 / ...), making
-- each marginal band 1 rupee too wide and over-charging by up to ~Rs 1 at the
-- upper boundaries. This realigns them to the FBR "amount exceeding X" semantics.
-- max_income (the ceilings) were already correct and are left untouched.
--
-- Scoped to 2025-26 individual slabs only (2024-25 is already correct).
-- Idempotent: setting a slab already at the right value is a no-op.

UPDATE tax_slabs ts
   SET min_income = CASE ts.slab_order
       WHEN 2 THEN 600001
       WHEN 3 THEN 1200001
       WHEN 4 THEN 2200001
       WHEN 5 THEN 3200001
       WHEN 6 THEN 4100001
   END
  FROM tax_years ty
 WHERE ts.tax_year_id = ty.id
   AND ty.tax_year = '2025-26'
   AND ts.slab_type = 'individual'
   AND ts.slab_order IN (2, 3, 4, 5, 6);
