-- Adds SSO columns to users so a Google/Apple identity can be linked.
--
-- Email+password login coexists: existing users keep their password_hash;
-- SSO-first users get NULL password_hash, NOT NULL (sso_provider, sso_subject).
--
-- Idempotent: safe to re-run.

BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS sso_provider VARCHAR(20),
  ADD COLUMN IF NOT EXISTS sso_subject  VARCHAR(255);

-- Drop the NOT NULL on password_hash so SSO-only users can exist. Existing
-- rows already have a hash; new SSO-only signups will leave it NULL.
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- (sso_provider, sso_subject) uniquely identifies an external identity.
-- Partial unique index — only enforced when both columns are populated.
CREATE UNIQUE INDEX IF NOT EXISTS users_sso_identity_uniq
  ON users (sso_provider, sso_subject)
  WHERE sso_provider IS NOT NULL AND sso_subject IS NOT NULL;

-- A user must have *some* way to authenticate. Either a password_hash, OR
-- a linked SSO identity. Otherwise the row is dead.
ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_has_auth_method;
ALTER TABLE users
  ADD CONSTRAINT users_has_auth_method CHECK (
    password_hash IS NOT NULL
    OR (sso_provider IS NOT NULL AND sso_subject IS NOT NULL)
  );

COMMIT;
