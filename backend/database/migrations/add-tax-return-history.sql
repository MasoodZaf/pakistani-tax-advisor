-- Migration: Tax Return History — Prior Year Upload Feature
-- Phase 5 of Pakistan Tax App corrections

CREATE TABLE IF NOT EXISTS tax_return_history (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tax_year        VARCHAR(9) NOT NULL,           -- e.g. '2024-25'
    source_format   VARCHAR(10) NOT NULL           -- 'json', 'excel', 'manual'
                    CHECK (source_format IN ('json', 'excel', 'manual')),
    raw_data        JSONB,                          -- parsed raw fields as-uploaded
    mapped_data     JSONB,                          -- normalized to our field names
    rate_flags      JSONB,                          -- fields flagged for rate-change review
    upload_date     TIMESTAMP DEFAULT NOW(),
    is_verified     BOOLEAN DEFAULT FALSE,
    notes           TEXT,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tax_history_user ON tax_return_history(user_id);
CREATE INDEX IF NOT EXISTS idx_tax_history_year  ON tax_return_history(user_id, tax_year);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_tax_return_history_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tax_return_history_updated_at ON tax_return_history;
CREATE TRIGGER tax_return_history_updated_at
    BEFORE UPDATE ON tax_return_history
    FOR EACH ROW EXECUTE FUNCTION update_tax_return_history_updated_at();
