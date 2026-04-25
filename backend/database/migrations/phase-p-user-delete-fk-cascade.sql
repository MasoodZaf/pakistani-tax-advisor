-- Phase P: fix user-delete FK cascade.
--
-- Four FK constraints on the users table were NO ACTION, which blocked every
-- admin user-delete even though sibling FKs on the same table were CASCADE.
-- Postgres evaluates each FK independently — a single NO ACTION is enough to
-- refuse the delete with "violates foreign key constraint fk_user_email".
--
-- Seen from the Admin > User Management UI:
--   "update or delete on table \"users\" violates foreign key constraint
--    \"fk_user_email\" on table \"tax_returns\""
--
-- Fix per-table:
--   tax_returns.fk_user_email                    → CASCADE (matches fk_user)
--   adjustable_tax_forms.fk_user_email           → CASCADE (matches fk_user)
--   adjustable_tax_forms.fk_last_updated_by      → SET NULL (audit breadcrumb)
--   personal_information.user_id FK              → CASCADE (deleted-user's PII should go)
--
-- Apply:  psql -d tax_advisor -f backend/database/migrations/phase-p-user-delete-fk-cascade.sql

BEGIN;

-- ── 1. tax_returns.fk_user_email → CASCADE ────────────────────────────────
ALTER TABLE tax_returns DROP CONSTRAINT IF EXISTS fk_user_email;
ALTER TABLE tax_returns
  ADD CONSTRAINT fk_user_email
  FOREIGN KEY (user_email) REFERENCES users(email)
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ── 2. adjustable_tax_forms.fk_user_email → CASCADE ──────────────────────
-- The sibling fk_user on (user_id) is already CASCADE; this one just needs
-- to agree so it stops vetoing the delete.
ALTER TABLE adjustable_tax_forms DROP CONSTRAINT IF EXISTS fk_user_email;
ALTER TABLE adjustable_tax_forms
  ADD CONSTRAINT fk_user_email
  FOREIGN KEY (user_email) REFERENCES users(email)
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ── 3. adjustable_tax_forms.fk_last_updated_by → SET NULL ────────────────
-- last_updated_by is an audit breadcrumb; we want the row to survive the
-- deleter's account going away, same policy as other *_last_updated_by FKs.
ALTER TABLE adjustable_tax_forms DROP CONSTRAINT IF EXISTS fk_last_updated_by;
ALTER TABLE adjustable_tax_forms
  ADD CONSTRAINT fk_last_updated_by
  FOREIGN KEY (last_updated_by) REFERENCES users(id)
  ON DELETE SET NULL ON UPDATE NO ACTION;

-- ── 4. personal_information.user_id → CASCADE ────────────────────────────
-- PII of a deleted account should not linger; compliance + GDPR reflex.
DO $$
DECLARE
  pk_name TEXT;
BEGIN
  SELECT c.conname INTO pk_name
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
   WHERE t.relname = 'personal_information'
     AND c.contype = 'f'
     AND (
       SELECT a.attname
         FROM pg_attribute a
        WHERE a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
        LIMIT 1
     ) = 'user_id';
  IF pk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE personal_information DROP CONSTRAINT %I', pk_name);
  END IF;
END$$;

ALTER TABLE personal_information
  ADD CONSTRAINT personal_information_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id)
  ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
