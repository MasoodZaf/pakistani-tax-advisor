-- Phase V: add tax_returns.income_profile (jsonb) — captures the user's
-- selected income streams from the onboarding wizard.
--
-- The column is defined in `prisma/schema.prisma` (line 976) but no migration
-- ever added it to the deployed `schema.sql`-initialized cluster. Result:
-- `POST /api/tax-forms/income-profile` errored on every onboarding, the
-- Settings page rendered no Income Streams checkmarks, and the form-loading
-- flow that branches on income_profile silently fell back to "salaried-only".
--
-- The default matches the Prisma definition so existing rows look as if they
-- went through onboarding with the salaried-only flow.
--
-- Apply:  psql -d tax_advisor -f backend/database/migrations/phase-v-add-income-profile-column.sql

BEGIN;

ALTER TABLE tax_returns
  ADD COLUMN IF NOT EXISTS income_profile JSONB
    DEFAULT '{"primary":"salaried","addons":[]}'::jsonb;

-- Idempotency: re-running is safe.

COMMIT;
