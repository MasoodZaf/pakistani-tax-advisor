-- add-wizard-sessions-table.sql
--
-- Backs the AI quick-start wizard. One session per (user_id, tax_year_id);
-- gating rules:
--   - At most ONE 'completed' session per (user, year). When present, the
--     wizard's status endpoint reports `completed: true` and the UI skips
--     the CTA banner. POST /api/wizard/reset clears it.
--   - At most ONE 'in_progress' session per (user, year). Returning to the
--     wizard while in-progress resumes from current_step.
--   - 'abandoned' sessions are unlimited (created when reset() archives the
--     previous run).
--
-- captured_data layout:
--   { "<step_id>": { "<field_key>": value, ... }, ... }
-- rough_calc is the JSON returned by /api/tax-computation preview, stored
-- so re-opening a completed session shows the same numbers without re-
-- running the math.
--
-- Idempotent: safe to re-run.

BEGIN;

CREATE TABLE IF NOT EXISTS wizard_sessions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tax_year_id     UUID NOT NULL REFERENCES tax_years(id),
    tax_year        VARCHAR(10) NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'in_progress',
    current_step    VARCHAR(50),
    captured_data   JSONB NOT NULL DEFAULT '{}'::jsonb,
    rough_calc      JSONB,
    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ,
    CONSTRAINT wizard_sessions_status_valid
      CHECK (status IN ('in_progress', 'completed', 'abandoned'))
);

-- Lookup-by-user is the hot path (status endpoint on every wizard page load).
CREATE INDEX IF NOT EXISTS wizard_sessions_user_year_idx
  ON wizard_sessions (user_id, tax_year_id);

-- Partial uniques enforce the "at most one active/completed per user-year"
-- gates without preventing multiple 'abandoned' history rows from coexisting.
CREATE UNIQUE INDEX IF NOT EXISTS wizard_sessions_one_in_progress_per_user_year
  ON wizard_sessions (user_id, tax_year_id)
  WHERE status = 'in_progress';

CREATE UNIQUE INDEX IF NOT EXISTS wizard_sessions_one_completed_per_user_year
  ON wizard_sessions (user_id, tax_year_id)
  WHERE status = 'completed';

COMMIT;
