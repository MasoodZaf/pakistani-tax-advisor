-- phase-z7: let tax_return_history accept FBR 114(1) PDF uploads.
--
-- The PDF upload path (taxHistory.js + fbrPdfParser.js) stores
-- source_format = 'fbr_pdf_114_1' (13 chars), but the table shipped with
-- VARCHAR(10) and — on clusters built from add-tax-return-history.sql — a
-- CHECK allowing only ('json','excel','manual'). Every PDF upload failed
-- with "value too long for type character varying(10)".
--
-- Idempotent: ALTER TYPE is repeatable; the constraint is dropped (IF EXISTS)
-- and re-added in the same transaction.

BEGIN;

ALTER TABLE tax_return_history
  ALTER COLUMN source_format TYPE VARCHAR(20);

ALTER TABLE tax_return_history
  DROP CONSTRAINT IF EXISTS tax_return_history_source_format_check;

ALTER TABLE tax_return_history
  ADD CONSTRAINT tax_return_history_source_format_check
  CHECK (source_format IN ('json', 'excel', 'manual', 'fbr_pdf_114_1'));

COMMIT;
