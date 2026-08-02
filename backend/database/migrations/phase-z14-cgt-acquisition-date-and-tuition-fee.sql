-- phase-z14: columns the statutory rules cannot be expressed without.
--
-- NOTE ON THE NAME: the remediation plan calls this migration "phase-z13".
-- That slot is already taken by phase-z13-password-reset-tokens.sql (commit
-- c59e016), so this is z14. Nothing else about the contract changes.
--
-- Three additive columns. Each one exists because the corresponding rule is
-- currently *unrepresentable*, not merely unenforced — no amount of backend
-- logic can fix them without somewhere to put the value.
--
--   1. [WITHDRAWN before any deployment] capital_gain_forms.acquisition_date
--      An earlier draft of this migration added a single DATE column here for
--      the FA-2024 capital-gains regime. It was the wrong shape: the form has
--      SEVEN independent immovable-property buckets, each potentially a
--      different property with its own acquisition date, so one scalar cannot
--      answer a per-property question. Capture moved to the capital_gain_disposals
--      child table in phase-z16-capital-gain-disposals.sql, which also drops the
--      column IF EXISTS to converge any branch/CI database that ran the earlier
--      draft. Nothing was ever deployed with it.
--
--   2. deductions_forms.tuition_fee_amount
--      s.60D limb (a) is the tuition fee actually paid; the allowance is the
--      lesser of that, 5% of the fee, and 25% of taxable income, capped by the
--      < Rs 1.5M taxable-income test. Without the paid amount stored, limb (a)
--      cannot be evaluated at all.
--
--   3. adjustable_tax_forms.is_atl
--      Withholding under Part IV is rate-differentiated by Active Taxpayer
--      status — non-filers are charged substantially higher (commonly double)
--      rates across most of the 27 heads. `is_atl` exists on
--      final_min_income_forms (phase-v) but nowhere on adjustable tax, so a
--      non-filer's withholding is computed at filer rates and the refund /
--      payable figure on the return is wrong. Same column name, type and
--      default as the phase-v precedent, deliberately.
--
-- Apply:  psql -d tax_advisor -f backend/database/migrations/phase-z14-cgt-acquisition-date-and-tuition-fee.sql
--
-- IDEMPOTENT AND RE-RUNNABLE. This project applies migrations by hand, per
-- environment, with no ledger table recording what has run — so every statement
-- below is guarded (ADD COLUMN IF NOT EXISTS / COMMENT, both no-ops on a second
-- pass). Re-running it changes nothing and touches no row data.
--
-- SAFE ONLINE. All three are additive. ADD COLUMN with a constant default does
-- not rewrite the table on PostgreSQL 11+ (these run on 15), so each takes only
-- a brief ACCESS EXCLUSIVE lock on the catalog, not a full-table rewrite.

BEGIN;

-- 1 ---------------------------------------------------------------- capital gains
-- Intentionally empty. See the WITHDRAWN note in the header: capital-gains
-- acquisition capture lives in phase-z16-capital-gain-disposals.sql.

-- 2 ------------------------------------------------------------------ deductions
-- NUMERIC(15,2) DEFAULT 0 matches the money convention used by every other
-- amount column on this table.
ALTER TABLE deductions_forms
  ADD COLUMN IF NOT EXISTS tuition_fee_amount NUMERIC(15,2) DEFAULT 0;

COMMENT ON COLUMN deductions_forms.tuition_fee_amount IS
  'Tuition fee actually paid — s.60D limb (a). Allowance = least of (this, 5% of fee, 25% of taxable income), and only where taxable income is LESS THAN Rs 1,500,000. Not part of total_deductions: that generated column is the zakat/ushr/foreign-tax/advance-tax total, whereas s.60D is a deductible allowance applied by the tax engine.';

-- 3 -------------------------------------------------------------- adjustable tax
-- NOT NULL DEFAULT true mirrors phase-v-add-is-atl-final-min.sql exactly.
-- Defaulting to filer keeps every existing row's computed withholding
-- unchanged, so applying this migration on live data moves no figures.
ALTER TABLE adjustable_tax_forms
  ADD COLUMN IF NOT EXISTS is_atl BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN adjustable_tax_forms.is_atl IS
  'Active Taxpayer List (filer) status for adjustable/withholding tax. true = filer (standard Part IV rate); false = non-filer (higher, commonly double, rate). Mirrors final_min_income_forms.is_atl (phase-v).';

COMMIT;
