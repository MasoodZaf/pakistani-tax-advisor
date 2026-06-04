-- phase-z3: income_forms FK ON DELETE CASCADE (DB-01)
--
-- phase-t-realign-form-tables.sql drops + recreates every form table, but
-- (unlike its siblings: adjustable_tax_forms, credits_forms, …) it rebuilt
-- income_forms WITHOUT the user / tax_return foreign keys. Result: deleting a
-- user leaves orphaned income_forms rows behind — i.e. salary PII is retained
-- with a dangling user_id, which both leaks data and breaks referential
-- integrity. (A schema.sql reconciliation entry can't fix this: phase-t runs
-- after schema.sql and would drop it again. This migration sorts after phase-t.)
--
-- Step 1 removes any orphans that already accumulated, step 2 adds the cascading
-- FKs so future user/return deletes clean up income_forms automatically.
-- Idempotent — guarded ADD CONSTRAINT (PG15-safe, IF NOT EXISTS landed in PG16).

DELETE FROM income_forms WHERE user_id NOT IN (SELECT id FROM users);
DELETE FROM income_forms
  WHERE tax_return_id IS NOT NULL
    AND tax_return_id NOT IN (SELECT id FROM tax_returns);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'income_forms_fk_user') THEN
    ALTER TABLE income_forms
      ADD CONSTRAINT income_forms_fk_user
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'income_forms_fk_tax_return') THEN
    ALTER TABLE income_forms
      ADD CONSTRAINT income_forms_fk_tax_return
      FOREIGN KEY (tax_return_id) REFERENCES tax_returns(id) ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END $$;
