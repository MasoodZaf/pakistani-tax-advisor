-- Mobile expense capture: ledger of user-logged spending throughout the year.
-- See docs/mobile-expenses-design.md for the full design rationale.
--
-- Two tables:
--   expenses        — the ledger row (one per user-logged spend)
--   receipt_files   — uploaded receipt images / PDFs (one-to-zero/one with expenses)
--
-- Idempotent: safe to run on an already-migrated database.

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── receipt_files ──────────────────────────────────────────────────────────
-- Created before expenses because expenses.receipt_id references it.
CREATE TABLE IF NOT EXISTS receipt_files (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Storage path in the object store. The actual bytes live outside Postgres
  -- (Hetzner Object Storage). Path scheme: receipts/<user_id>/<sha256>.<ext>
  storage_key  TEXT NOT NULL,

  mime_type    TEXT NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'application/pdf')),
  size_bytes   INTEGER NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 5242880),  -- 5 MB
  sha256       TEXT NOT NULL CHECK (length(sha256) = 64),

  uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (user_id, sha256)  -- same photo never stored twice for the same user
);

CREATE INDEX IF NOT EXISTS receipt_files_user_idx ON receipt_files(user_id);


-- ── expenses ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expenses (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Client-generated UUID. Mobile assigns this offline before the row ever
  -- reaches the server, so retries are idempotent via (user_id, client_id).
  client_id    UUID NOT NULL,

  -- Money. Multi-currency from day one — see decision log in the design doc.
  -- The user's native amount/currency is preserved alongside a PKR-converted
  -- value (using the rate at occurred_on) for filing-time aggregation.
  amount           NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  currency         CHAR(3)       NOT NULL DEFAULT 'PKR',
  fx_rate_to_pkr   NUMERIC(14,6),
  amount_pkr       NUMERIC(14,2) NOT NULL CHECK (amount_pkr >= 0),

  -- The event
  occurred_on    DATE NOT NULL,
  category       TEXT NOT NULL,
  description    TEXT,
  payee          TEXT,
  payment_method TEXT,  -- cash|bank|card|wallet|other

  -- Tax mapping. Resolved at filing time (not at capture). Derived
  -- automatically by rule (e.g. category='zakat' → tax_treatment='zakat')
  -- or set by the user in the web app's review screen.
  tax_year             TEXT,
  tax_treatment        TEXT,
  tax_section          TEXT,
  included_in_return   BOOLEAN NOT NULL DEFAULT FALSE,

  -- Sync metadata
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ,

  receipt_id  UUID REFERENCES receipt_files(id) ON DELETE SET NULL,

  UNIQUE (user_id, client_id),

  -- Multi-currency consistency: PKR rows have NULL fx_rate and equal amounts;
  -- non-PKR rows must have a positive fx_rate.
  CONSTRAINT expenses_currency_consistency CHECK (
    (currency = 'PKR' AND amount_pkr = amount AND fx_rate_to_pkr IS NULL)
    OR
    (currency <> 'PKR' AND fx_rate_to_pkr IS NOT NULL AND fx_rate_to_pkr > 0)
  )
);

-- Indexes
CREATE INDEX IF NOT EXISTS expenses_user_year_idx
  ON expenses(user_id, tax_year)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS expenses_user_updated_idx
  ON expenses(user_id, updated_at);  -- delta sync (`since=…`)

CREATE INDEX IF NOT EXISTS expenses_user_occurred_idx
  ON expenses(user_id, occurred_on DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS expenses_user_treatment_idx
  ON expenses(user_id, tax_year, tax_treatment)
  WHERE deleted_at IS NULL AND included_in_return = FALSE;  -- filing-time aggregation

-- Auto-touch updated_at on UPDATE (matches the codebase's convention).
CREATE OR REPLACE FUNCTION expenses_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS expenses_updated_at_trigger ON expenses;
CREATE TRIGGER expenses_updated_at_trigger
  BEFORE UPDATE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION expenses_touch_updated_at();


COMMIT;
