-- Phase P-3: drop the user FKs on audit_log.
--
-- Root cause of the user-delete 500 ("audit_log_user_id_fkey" violation):
-- There's a DB trigger `audit_trigger_function` that fires on every DELETE
-- and inserts an audit row with OLD.user_id. During a CASCADE delete of a
-- user's tax_return, the trigger runs — but the user has already been
-- removed, so the FK check on audit_log.user_id → users.id fails.
--
-- The FKs were trying to do two incompatible things:
--   1. Keep audit rows live-linked to users (what the FK enforces).
--   2. Preserve audit history after the user is gone (what SET NULL implies).
--
-- The audit log is a HISTORICAL record. The right model: user_id / user_email
-- are plain string columns, not FK-validated. That preserves the record
-- verbatim forever.
--
-- Safe: drops the constraints only. Data stays identical.
-- If you later want strict referential integrity, re-introduce as a deferred
-- FK or normalize to a separate "deleted_users" shadow table.

BEGIN;

ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_user_id_fkey;
ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS fk_user_email;

-- Keep an index on user_id for audit queries by user.
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);

COMMIT;
