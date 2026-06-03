-- Phase Y: cache for the AI tax-efficiency analysis.
--
-- The /api/ai-consultant/optimize call costs a ~10s DeepSeek round-trip. We
-- cache the structured result per (user, tax_year) keyed by an input hash of
-- the figures that feed it (tax chargeable, credits, allowances, claimed
-- reliefs). On the next visit, if nothing relevant changed we return the cached
-- analysis instantly; when the user edits a form the hash changes and it re-runs.
--
-- Apply:  psql -d tax_advisor -f backend/database/migrations/phase-y-ai-optimizations.sql

CREATE TABLE IF NOT EXISTS ai_optimizations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL,
  tax_year    VARCHAR(10) NOT NULL,
  input_hash  VARCHAR(64) NOT NULL,
  analysis    JSONB,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ai_optimizations_user_year_unique UNIQUE (user_id, tax_year)
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_optimizations_fk_user') THEN
    ALTER TABLE ai_optimizations
      ADD CONSTRAINT ai_optimizations_fk_user
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;
