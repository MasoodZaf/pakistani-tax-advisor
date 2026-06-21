-- phase-z11: hide internal (optimize / field-help) conversations from the user-visible chat list.
-- Apply: psql -d tax_advisor -f backend/database/migrations/phase-z11-ai-conversation-internal.sql
-- Idempotent: re-runs are safe.
-- IF EXISTS so this is a no-op where ai_conversations hasn't been created yet
-- (CI/fresh init applies schema.sql + phase-*.sql only; add-ai-consultant-tables.sql
-- runs at AI-consultant deploy time and now carries the column for fresh installs).

BEGIN;

ALTER TABLE IF EXISTS ai_conversations ADD COLUMN IF NOT EXISTS internal BOOLEAN NOT NULL DEFAULT FALSE;

COMMIT;
