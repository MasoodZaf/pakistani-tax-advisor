-- Phase Z13: self-service password reset tokens.
--
-- Backs the "Forgot password?" flow: POST /api/forgot-password issues a
-- single-use, time-limited token (emailed as a link via the SMTP/Resend
-- sender); POST /api/reset-password consumes it and sets a new password.
--
-- Only the SHA-256 HASH of the token is stored, so a DB leak can't be used to
-- reset anyone's password. Tokens are single-use (used_at) and expire
-- (expires_at, default 1h set by the app).
--
-- Apply:  psql -d tax_advisor -f backend/database/migrations/phase-z13-password-reset-tokens.sql
-- Safe to run multiple times.

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  VARCHAR(64) NOT NULL,          -- sha256(raw token), hex
    expires_at  TIMESTAMPTZ(6) NOT NULL,
    used_at     TIMESTAMPTZ(6),
    ip_address  VARCHAR(64),
    created_at  TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_prt_token_hash ON password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_prt_user       ON password_reset_tokens(user_id);
