-- Phase Z12: user consent / agreement acceptance ledger.
--
-- Before a filer reaches the main app they must accept a small set of
-- agreements (Terms & Conditions, Privacy Policy, User Agreement, Tax
-- Consultant advisory consent). This table is the provable record of that
-- consent — one row per (user, agreement, version) — so we can:
--   * gate entry until the current versions are accepted, and
--   * re-prompt only when an agreement's version is bumped.
--
-- Each row captures who accepted, which agreement + version, when, and the
-- request IP / user-agent for a defensible audit trail. The acceptance event
-- is ALSO mirrored into audit_log (action='agreements_accepted').
--
-- Apply:  psql -d tax_advisor -f backend/database/migrations/phase-z12-user-agreement-consent.sql
-- Safe to run multiple times.

CREATE TABLE IF NOT EXISTS user_agreement_acceptances (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    agreement_key VARCHAR(64)  NOT NULL,   -- 'terms' | 'privacy' | 'user_agreement' | 'consultant_agreement'
    version       VARCHAR(32)  NOT NULL,   -- the agreement version that was accepted
    accepted_at   TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ip_address    VARCHAR(64),
    user_agent    VARCHAR(512),
    UNIQUE (user_id, agreement_key, version)
);

CREATE INDEX IF NOT EXISTS idx_user_agreement_acceptances_user
    ON user_agreement_acceptances(user_id);
