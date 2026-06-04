-- phase-z2: single-use privileged tokens (SEC-02 / SEC-08)
--
-- The admin-assisted "login as user" bypass token is a one-shot credential:
-- a super-admin mints it, the client exchanges it once at /api/login for a
-- session. Without a consumption record it could be replayed within its TTL.
-- We give each bypass token a jti and record it here when consumed; the login
-- route inserts ON CONFLICT DO NOTHING and treats a 0-row result as a replay.
--
-- expires_at lets a periodic cleanup drop rows after the token would have
-- expired anyway. Idempotent — safe to re-run.

CREATE TABLE IF NOT EXISTS consumed_tokens (
  jti         UUID PRIMARY KEY,
  purpose     VARCHAR(64) NOT NULL,
  consumed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at  TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_consumed_tokens_expires ON consumed_tokens(expires_at);
