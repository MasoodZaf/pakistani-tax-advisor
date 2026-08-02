-- phase-z16: per-disposal capital-gains capture + the post-FA-2024 rate.
--
-- SUPERSEDES the capital_gain_forms.acquisition_date column added in phase-z14.
-- That column was the wrong shape and is dropped below. See "WHY A CHILD TABLE".
--
-- ---------------------------------------------------------------------------
-- WHY A CHILD TABLE (and not per-bucket date columns)
-- ---------------------------------------------------------------------------
-- FA-2024 taxes gain on immovable property ACQUIRED ON OR AFTER 1-Jul-2024 at a
-- flat 15% for ATL persons, irrespective of holding period. Property acquired
-- BEFORE that date keeps the graduated ladder (15/12.5/10/7.5/5/2.5/NIL). So the
-- regime is a property of each DISPOSAL, not of the return.
--
-- capital_gain_forms has seven immovable-property buckets
-- (immovable_property_1_year_taxable … immovable_property_over_6_years_taxable),
-- each an aggregate figure. A single scalar acquisition_date on that table can
-- answer the regime question for at most one property — a taxpayer with one
-- pre-2024 and one post-2024 disposal has two answers and one field, so any
-- engine reading it would be guessing. Lane B was right to decline to wire it.
--
-- Seven per-bucket date columns were the other candidate. Rejected: it fixes
-- one-property-per-bucket but still cannot represent TWO disposals in the SAME
-- bucket in the same year, which is not exotic — two flats sold in one year,
-- both held 2-3 years, one acquired either side of 1-Jul-2024. It would also
-- have to be extended column-by-column for every future dimension.
--
-- One row per disposal is the only shape that answers the question in every
-- case. It costs lane D a repeater UI, which is why the migration is additive:
-- the seven bucket columns are LEFT IN PLACE and keep working untouched.
--
-- ---------------------------------------------------------------------------
-- NULL / ABSENCE SEMANTICS — deliberately preserved from phase-z14
-- ---------------------------------------------------------------------------
-- NO disposal rows for a return  => legacy return, use the bucket columns and
--                                   the pre-FA-2024 ladder.
-- Disposal row, acquisition_date NULL => acquisition date not stated; still the
--                                   pre-FA-2024 ladder.
-- Absence is never evidence of a post-1-Jul-2024 acquisition. This is what stops
-- historical returns being silently re-rated the day the column ships, and it
-- must survive any later change here.
--
-- Apply:  psql -d tax_advisor -f backend/database/migrations/phase-z16-capital-gain-disposals.sql
--
-- IDEMPOTENT AND RE-RUNNABLE. CREATE TABLE / CREATE INDEX / ADD COLUMN use
-- IF NOT EXISTS; DROP COLUMN uses IF EXISTS; the rate seed uses the
-- DELETE-then-INSERT pattern already established by phase-h-cgt-rate-seeds.sql,
-- which converges to the same single row however many times it runs.
--
-- ROLLBACK:
--     DROP TABLE IF EXISTS capital_gain_disposals;
--     DELETE FROM tax_rates_config WHERE tax_year='2025-26'
--       AND rate_type='capital_gains' AND rate_category='immovable_property_post_fa2024_atl';
--   (Re-adding capital_gain_forms.acquisition_date is not part of rollback —
--    nothing ever read it and nothing ever wrote it.)

BEGIN;

-- 1 -------------------------------------------------- drop the wrong-shape scalar
-- Added by phase-z14, never populated, never read by any code. Dropping it now
-- is free; leaving a field that cannot answer the question it names is a trap
-- for whoever wires this next. phase-z14 is left untouched (migrations here are
-- append-only) so this also converges any branch/CI database that already ran it.
ALTER TABLE capital_gain_forms
  DROP COLUMN IF EXISTS acquisition_date;

-- 2 ------------------------------------------------------- per-disposal capture
CREATE TABLE IF NOT EXISTS capital_gain_disposals (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Owning form. ON DELETE CASCADE so a return's disposals die with it and
    -- cannot outlive the parent as orphaned taxable figures.
    capital_gain_form_id UUID NOT NULL
                         REFERENCES capital_gain_forms(id) ON DELETE CASCADE,

    asset_type           VARCHAR(32)  NOT NULL DEFAULT 'immovable_property',

    -- Which rate bucket this disposal falls in. Holds a
    -- tax_rates_config.rate_category value for rate_type='capital_gains'
    -- (e.g. 'immovable_property_2_years', 'immovable_property_post_fa2024_atl').
    -- Deliberately NOT a foreign key and NOT a CHECK against a hardcoded list:
    -- tax_rates_config is re-seeded per tax year with DELETE-then-INSERT, which
    -- an FK would break, and a hardcoded CHECK would need editing every time a
    -- category is added — the exact brittleness that left total_final_tax
    -- summing 4 of 12 columns. The engine resolves it by lookup.
    rate_category        VARCHAR(64),

    -- The regime discriminator. NULL = not stated = pre-FA-2024 ladder.
    acquisition_date     DATE,
    disposal_date        DATE,

    gain_amount          NUMERIC(15,2) DEFAULT 0,
    tax_deducted         NUMERIC(15,2) DEFAULT 0,

    description          VARCHAR(255),

    created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- A disposal cannot be acquired after it was disposed of. Cheap, and it
    -- catches a transposed pair of dates at the write path rather than in a
    -- rate lookup months later.
    CONSTRAINT capital_gain_disposals_dates_ordered
      CHECK (acquisition_date IS NULL
             OR disposal_date IS NULL
             OR acquisition_date <= disposal_date)
);

CREATE INDEX IF NOT EXISTS idx_capital_gain_disposals_form
    ON capital_gain_disposals(capital_gain_form_id);

COMMENT ON TABLE capital_gain_disposals IS
  'One row per capital-gains disposal. Exists because the FA-2024 regime for immovable property is decided per PROPERTY (acquired on/after 1-Jul-2024 => flat 15% ATL, irrespective of holding period), which the aggregate bucket columns on capital_gain_forms cannot express. No rows for a return = legacy return, use the bucket columns + pre-FA-2024 ladder.';

COMMENT ON COLUMN capital_gain_disposals.acquisition_date IS
  'Regime discriminator. On/after 2024-07-01 => post-FA-2024 flat rate. Before => holding-period ladder. NULL = not stated; treat as pre-FA-2024, NEVER as post.';

-- 3 --------------------------------------------------- post-FA-2024 rate seed
-- A DISTINCT category, not a reuse of immovable_property_1_year. Both are 15%
-- today, but they are different rules: one is "held <= 1 year under the old
-- ladder", the other is "acquired on/after 1-Jul-2024, any holding period".
-- Conflating them means a future change to the <=1-year ladder rate would
-- silently re-rate the post-2024 regime too. Lane B's reasoning, and it is right.
--
-- Note: phase-h-cgt-rate-seeds.sql:5 claims a 'property_atl_post_july_2024' row
-- was "previously seeded" and left in place. That is STALE — no such row is
-- inserted anywhere in the repo, and QA confirmed all 15 live capital_gains
-- categories are pre-FA-2024 ladder rows. This is the first time the post-2024
-- regime is represented at all.
DELETE FROM tax_rates_config
 WHERE tax_year = '2025-26'
   AND rate_type = 'capital_gains'
   AND rate_category = 'immovable_property_post_fa2024_atl';

INSERT INTO tax_rates_config
  (tax_year, rate_type, rate_category, tax_rate, min_amount, max_amount, fixed_amount, description, fbr_reference, is_active)
VALUES
  ('2025-26', 'capital_gains', 'immovable_property_post_fa2024_atl', 0.150, 0, 999999999999, 0,
   'Immovable property ACQUIRED on/after 1-Jul-2024 — flat 15% for ATL persons, irrespective of holding period',
   'ITO 2001 s.37(1A) as amended by Finance Act 2024; First Schedule Part I Division VIII', true);

-- The NON-ATL counterpart is deliberately NOT seeded here. See the report /
-- migration README: for persons not on the ATL the post-FA-2024 gain is charged
-- at the normal slab rates under Division I, i.e. a PROGRESSIVE mechanism, not a
-- flat scalar — so it cannot be represented as one tax_rate row, and inventing a
-- number would silently give non-filers a wrong rate (the exact failure this
-- codebase already has a history of). Needs an FBR-sourced decision on the
-- mechanism before it is seeded.

COMMIT;
