-- phase-z15: final_tax_forms.total_final_tax must sum ALL twelve line items.
--
-- THE DEFECT
-- total_final_tax is a STORED generated column that sums only FOUR of the twelve
-- line-item groups. The other eight (added by phase-t1-add-final-tax-line-items.sql)
-- are absent from the expression, so every rupee of lottery/prize winnings, NSS and
-- Defence Savings profit, both dividend classes, both capital-gain-on-securities
-- classes and commission income contributed ZERO to the total. QA measured the
-- understatement at Rs 7,330,044 on a single test return.
--
-- It is a generated column, so the wrong figure was recomputed and re-stored on
-- every write — there is no cohort of "good" rows and no cutoff date.
--
-- ---------------------------------------------------------------------------
-- WHY THIS MIGRATION INTROSPECTS INSTEAD OF HARDCODING COLUMN NAMES
-- ---------------------------------------------------------------------------
-- The four original groups exist under TWO different naming dialects, depending
-- on whether phase-u-fix-totals-and-drop-zombies.sql has been applied:
--
--   BEFORE phase-u — root schema.sql dialect:
--       sukuk_amount * sukuk_tax_rate, debt_amount * debt_tax_rate,
--       prize_bonds_tax, other_final_tax
--       (sukuk_tax_amount / debt_tax_amount also exist here, but are themselves
--        GENERATED columns and so cannot be referenced — see below.)
--
--   AFTER phase-u — phase-u:567-577 DROPs every one of the above with CASCADE
--   and rebuilds the total over:
--       sukuk_bonds_tax_amount, debt_securities_tax_amount,
--       prize_bonds_tax_amount, other_final_tax_tax_amount
--
-- The two dialects are MUTUALLY EXCLUSIVE: an expression hardcoded for either
-- one fails with "column does not exist" on the other. And this project applies
-- migrations BY HAND, PER ENVIRONMENT, with no ledger table — prod, staging and
-- CI are not guaranteed to sit at the same point in the chain. Hardcoding one
-- dialect amounts to guessing which environment you are standing in.
--
-- So the expression is assembled AT APPLY TIME from the columns that actually
-- exist, and the migration prints exactly which terms it included. It cannot
-- silently sum a subset — which is the failure mode it exists to fix.
--
-- Two rules the assembler enforces, both learned the hard way:
--   * A generated column may not reference another generated column (Postgres
--     rejects it outright). Where a group's *_tax_amount column is itself
--     generated, the underlying multiplication is inlined instead.
--   * A group that resolves to NO usable column ABORTS the migration BY NAME,
--     rather than being quietly dropped from the sum.
--
-- Apply:  psql -d tax_advisor -f backend/database/migrations/phase-z15-final-tax-total-all-line-items.sql
--
-- PREREQUISITE: phase-t1-add-final-tax-line-items.sql (enforced below, by name).
--
-- IDEMPOTENT, RE-RUNNABLE AND CONVERGENT: it drops and recreates the column
-- unconditionally, so the end state is the full twelve-term expression whatever
-- the expression was beforehand. Running it twice leaves exactly what running it
-- once leaves.
--
-- LOCKING / DATA. Adding a STORED generated column rewrites the table and holds
-- ACCESS EXCLUSIVE for the duration — final_tax_forms is small (one row per
-- return) so this is sub-second, but it is not lock-free. NO USER DATA IS AT
-- RISK: total_final_tax is fully derived and holds nothing that cannot be
-- recomputed. The recreate recomputes every row.
--
-- ROLLBACK — restores the previous four-term total. Re-introduces the
-- understatement, so it is an availability escape hatch, not a correctness one.
-- Use the dialect matching the database you are on:
--     ALTER TABLE final_tax_forms DROP COLUMN IF EXISTS total_final_tax;
--   post-phase-u:
--     ALTER TABLE final_tax_forms ADD COLUMN total_final_tax numeric(15,2)
--       GENERATED ALWAYS AS (
--         COALESCE(sukuk_bonds_tax_amount,     0::numeric) +
--         COALESCE(debt_securities_tax_amount, 0::numeric) +
--         COALESCE(prize_bonds_tax_amount,     0::numeric) +
--         COALESCE(other_final_tax_tax_amount, 0::numeric)) STORED;
--   pre-phase-u:
--     ALTER TABLE final_tax_forms ADD COLUMN total_final_tax numeric(15,2)
--       GENERATED ALWAYS AS (
--         COALESCE(sukuk_amount, 0::numeric) * COALESCE(sukuk_tax_rate, 0.10) +
--         COALESCE(debt_amount,  0::numeric) * COALESCE(debt_tax_rate,  0.15) +
--         COALESCE(prize_bonds_tax, 0::numeric) +
--         COALESCE(other_final_tax, 0::numeric)) STORED;

BEGIN;

-- A column is usable inside a generated expression only if it exists, is live,
-- and is not itself generated.
CREATE OR REPLACE FUNCTION pg_temp.z15_col_ok(c text) RETURNS boolean AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM pg_attribute a
     WHERE a.attrelid = 'final_tax_forms'::regclass
       AND a.attname  = c
       AND a.attnum   > 0
       AND NOT a.attisdropped
       AND a.attgenerated = ''
  );
$fn$ LANGUAGE sql;

DO $$
DECLARE
  terms   text[] := ARRAY[]::text[];
  missing text[] := ARRAY[]::text[];
  item    text;
  expr    text;
  -- The eight phase-t1 line items. Plain columns in every dialect.
  new_items text[] := ARRAY[
    'lottery_crossword_winnings_tax_amount',
    'profit_govt_securities_tax_amount',
    'profit_defence_savings_tax_amount',
    'dividend_listed_companies_tax_amount',
    'dividend_other_tax_amount',
    'capital_gain_securities_short_tax_amount',
    'capital_gain_securities_long_tax_amount',
    'commission_agents_tax_amount'
  ];
BEGIN
  ---------------------------------------------------------------- group 1 sukuk
  IF pg_temp.z15_col_ok('sukuk_bonds_tax_amount') THEN
    terms := array_append(terms, 'COALESCE(sukuk_bonds_tax_amount, 0::numeric)');
  ELSIF pg_temp.z15_col_ok('sukuk_amount') AND pg_temp.z15_col_ok('sukuk_tax_rate') THEN
    terms := array_append(terms, 'COALESCE(sukuk_amount, 0::numeric) * COALESCE(sukuk_tax_rate, 0.10)');
  ELSE
    missing := array_append(missing, 'sukuk (neither sukuk_bonds_tax_amount nor sukuk_amount*sukuk_tax_rate)');
  END IF;

  ----------------------------------------------------------------- group 2 debt
  IF pg_temp.z15_col_ok('debt_securities_tax_amount') THEN
    terms := array_append(terms, 'COALESCE(debt_securities_tax_amount, 0::numeric)');
  ELSIF pg_temp.z15_col_ok('debt_amount') AND pg_temp.z15_col_ok('debt_tax_rate') THEN
    terms := array_append(terms, 'COALESCE(debt_amount, 0::numeric) * COALESCE(debt_tax_rate, 0.15)');
  ELSE
    missing := array_append(missing, 'debt (neither debt_securities_tax_amount nor debt_amount*debt_tax_rate)');
  END IF;

  ---------------------------------------------------------- group 3 prize bonds
  IF pg_temp.z15_col_ok('prize_bonds_tax_amount') THEN
    terms := array_append(terms, 'COALESCE(prize_bonds_tax_amount, 0::numeric)');
  ELSIF pg_temp.z15_col_ok('prize_bonds_tax') THEN
    terms := array_append(terms, 'COALESCE(prize_bonds_tax, 0::numeric)');
  ELSE
    missing := array_append(missing, 'prize_bonds (neither prize_bonds_tax_amount nor prize_bonds_tax)');
  END IF;

  ---------------------------------------------------------------- group 4 other
  IF pg_temp.z15_col_ok('other_final_tax_tax_amount') THEN
    terms := array_append(terms, 'COALESCE(other_final_tax_tax_amount, 0::numeric)');
  ELSIF pg_temp.z15_col_ok('other_final_tax') THEN
    terms := array_append(terms, 'COALESCE(other_final_tax, 0::numeric)');
  ELSE
    missing := array_append(missing, 'other_final_tax (neither other_final_tax_tax_amount nor other_final_tax)');
  END IF;

  -------------------------------------------------- groups 5-12 phase-t1 items
  FOREACH item IN ARRAY new_items LOOP
    IF pg_temp.z15_col_ok(item) THEN
      terms := array_append(terms, format('COALESCE(%I, 0::numeric)', item));
    ELSE
      missing := array_append(missing, (item || '  [apply phase-t1-add-final-tax-line-items.sql first]'));
    END IF;
  END LOOP;

  ------------------------------------------------------------------ abort loudly
  IF array_length(missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION E'phase-z15 cannot build total_final_tax — unresolved line-item group(s):\n  %',
      array_to_string(missing, E'\n  ');
  END IF;

  IF array_length(terms, 1) <> 12 THEN
    RAISE EXCEPTION 'phase-z15 expected 12 terms, assembled %. Refusing to install a partial total.',
      array_length(terms, 1);
  END IF;

  ---------------------------------------------------------------------- install
  -- Deliberately NOT "DROP ... CASCADE". phase-u used CASCADE, which would
  -- silently destroy any view that had come to depend on this column. If a
  -- dependency exists, abort inside the transaction and let a human look at it.
  EXECUTE 'ALTER TABLE final_tax_forms DROP COLUMN IF EXISTS total_final_tax';

  expr := array_to_string(terms, E'\n    + ');
  EXECUTE format(
    'ALTER TABLE final_tax_forms ADD COLUMN total_final_tax numeric(15,2) GENERATED ALWAYS AS (%s) STORED',
    expr
  );

  RAISE NOTICE E'phase-z15: total_final_tax rebuilt over % terms:\n    %',
    array_length(terms, 1), array_to_string(terms, E'\n    + ');
END $$;

COMMENT ON COLUMN final_tax_forms.total_final_tax IS
  'Sum of ALL twelve final-tax line-item groups, assembled by phase-z15 from whichever column dialect the database is on. Every new line item MUST be added to that assembler — the previous definition covered 4 of 12 and understated the total by Rs 7,330,044 on a QA return. Stored generated column: recomputed on every write, so the fix applies retroactively to all rows.';

COMMIT;
