-- Migration: add-super-tax-column.sql
-- Adds super_tax column to tax_computation_forms.
-- Super tax u/s 4C, ITO 2001 (Finance Act 2025): charged on persons with
-- income exceeding Rs 150 million at progressive flat rates (1%–10%).
-- Safe to run multiple times (IF NOT EXISTS guard).

BEGIN;

ALTER TABLE tax_computation_forms
  ADD COLUMN IF NOT EXISTS super_tax DECIMAL(15,2) DEFAULT 0;

COMMIT;
