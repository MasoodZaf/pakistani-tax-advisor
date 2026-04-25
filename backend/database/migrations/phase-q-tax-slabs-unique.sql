-- Phase Q: add UNIQUE(tax_year_id, slab_type, slab_order) on tax_slabs.
-- Needed for the rates-bundle `ON CONFLICT ... DO UPDATE` upsert. Also
-- closes a data-integrity gap: currently you could insert a duplicate
-- slab (same year, type, order) without any constraint noticing.
--
-- Apply:  psql -d tax_advisor -f backend/database/migrations/phase-q-tax-slabs-unique.sql

BEGIN;

-- De-dup any existing duplicates, keeping the most recently updated.
DELETE FROM tax_slabs WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY tax_year_id, slab_type, slab_order
             ORDER BY COALESCE(updated_at, created_at) DESC, id ASC
           ) AS rn
      FROM tax_slabs
  ) x WHERE rn > 1
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tax_slabs_year_type_order_unique'
  ) THEN
    ALTER TABLE tax_slabs
      ADD CONSTRAINT tax_slabs_year_type_order_unique
      UNIQUE (tax_year_id, slab_type, slab_order);
  END IF;
END$$;

COMMIT;
