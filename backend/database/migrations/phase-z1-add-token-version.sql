-- phase-z1: revocable JWTs (SEC-01)
--
-- Adds users.token_version. It is embedded in every newly-issued user JWT and
-- compared on each authenticated request; bumping it (on password change)
-- instantly invalidates every token minted with the old value — giving us
-- stateless session revocation without a server-side token store.
--
-- Backward-compatible: existing tokens in the wild carry no token_version, so
-- the auth middleware skips the check for them and they simply expire normally.
-- Idempotent — safe to re-run.

ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;
