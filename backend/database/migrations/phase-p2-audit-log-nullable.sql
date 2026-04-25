-- Phase P-2: allow NULL on audit_log.user_id / user_email.
--
-- The FK on audit_log.user_id is ON DELETE SET NULL (compliance: audit rows
-- must survive the account's deletion). But the column was declared NOT NULL
-- — so the cascade actually failed with:
--   "null value in column \"user_id\" of relation \"audit_log\" violates not-null"
-- That's why user delete was 500'ing even after the FK cascade fix in phase-p.
--
-- Audit log rows with user_id = NULL represent "the account existed but has
-- since been deleted." user_email is still stored as a string so the actor
-- remains identifiable for regulatory purposes.

BEGIN;

ALTER TABLE audit_log ALTER COLUMN user_id    DROP NOT NULL;
ALTER TABLE audit_log ALTER COLUMN user_email DROP NOT NULL;

COMMIT;
