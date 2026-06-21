-- phase-z11: hide internal (optimize / field-help) conversations from the user-visible chat list.
-- Apply: psql -d tax_advisor -f backend/database/migrations/phase-z11-ai-conversation-internal.sql
-- Idempotent: re-runs are safe.

BEGIN;

ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS internal BOOLEAN NOT NULL DEFAULT FALSE;

COMMIT;
