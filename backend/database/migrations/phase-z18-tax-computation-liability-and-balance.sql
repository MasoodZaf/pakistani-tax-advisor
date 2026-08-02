-- phase-z18: two wrong figures stored in tax_computation_forms generated columns.
--
-- DEFECT 1 — balance_payable does not subtract withholding.
--   It is currently  <liability expression> - advance_tax_paid.
--   The engine credits withholding tax AND s.147 advance tax, but only the
--   latter is subtracted here. The stored figure therefore OVER-STATES what the
--   taxpayer owes by their entire withholding — for a salaried filer that is
--   most of their tax, since salary tax is deducted at source u/s 149.
--   Lane C correctly refused to paper over this by writing creditable payments
--   into a column named for advance tax; the fix is a real column for the real
--   quantity, which this migration adds (withholding_tax_paid).
--
-- DEFECT 2 — total_tax_liability omits super_tax.
--   A filer above the s.4C threshold has a stored liability short by exactly
--   their super tax. super_tax is a real column (phase-t1-add-super-tax-column)
--   that nothing ever added to the total.
--
-- Both are STORED generated columns, so the wrong values were recomputed and
-- re-stored on every write. There is no good cohort and no cutoff date, and
-- equally the fix applies retroactively to every row the moment it lands.
--
-- ---------------------------------------------------------------------------
-- WHY THIS INTROSPECTS (same discipline as phase-z15)
-- ---------------------------------------------------------------------------
-- Migrations here are applied BY HAND, PER ENVIRONMENT, with no ledger, so the
-- column set of tax_computation_forms is not guaranteed identical across prod,
-- staging and CI. The expressions are therefore assembled at apply time from
-- the columns that actually exist, the migration PRINTS what it assembled, and
-- it ABORTS BY NAME rather than installing a partial expression. Silently
-- summing a subset is the defect being fixed; it must not be the fix's own
-- failure mode.
--
-- A generated column may not reference another generated column, so
-- balance_payable cannot read total_tax_liability — the liability expression is
-- inlined into both.
--
-- Apply:  psql -d tax_advisor -f backend/database/migrations/phase-z18-tax-computation-liability-and-balance.sql
--
-- IDEMPOTENT, RE-RUNNABLE, CONVERGENT: both columns are dropped and recreated
-- unconditionally, so the end state is the same however many times it runs and
-- whatever the expressions were beforehand.
--
-- LOCKING / DATA: adding STORED generated columns rewrites the table under
-- ACCESS EXCLUSIVE. tax_computation_forms is one row per return, so this is
-- sub-second. NO USER DATA IS AT RISK — both columns are fully derived. The new
-- withholding_tax_paid column IS user data, but it is additive and defaults to
-- 0, which reproduces today's behaviour until lane C starts populating it.
--
-- ROLLBACK (restores the previous, wrong, figures — availability escape hatch
-- only; run `\d tax_computation_forms` first if unsure of the local dialect):
--   ALTER TABLE tax_computation_forms DROP COLUMN IF EXISTS balance_payable;
--   ALTER TABLE tax_computation_forms DROP COLUMN IF EXISTS total_tax_liability;
--   ALTER TABLE tax_computation_forms ADD COLUMN total_tax_liability numeric(15,2)
--     GENERATED ALWAYS AS (COALESCE(normal_income_tax,0::numeric)
--       + COALESCE(surcharge_amount,0::numeric) + COALESCE(capital_gains_tax,0::numeric)
--       - COALESCE(tax_reductions,0::numeric)   - COALESCE(tax_credits,0::numeric)
--       + COALESCE(final_fixed_tax,0::numeric)) STORED;
--   ALTER TABLE tax_computation_forms ADD COLUMN balance_payable numeric(15,2)
--     GENERATED ALWAYS AS (COALESCE(normal_income_tax,0::numeric)
--       + COALESCE(surcharge_amount,0::numeric) + COALESCE(capital_gains_tax,0::numeric)
--       - COALESCE(tax_reductions,0::numeric)   - COALESCE(tax_credits,0::numeric)
--       + COALESCE(final_fixed_tax,0::numeric)  - COALESCE(advance_tax_paid,0::numeric)) STORED;
--   (withholding_tax_paid may be left in place; it is inert without the above.)

BEGIN;

-- The quantity balance_payable was missing. Additive, defaults to 0 so the
-- stored balance is unchanged until lane C populates it.
ALTER TABLE tax_computation_forms
  ADD COLUMN IF NOT EXISTS withholding_tax_paid NUMERIC(15,2) DEFAULT 0;

COMMENT ON COLUMN tax_computation_forms.withholding_tax_paid IS
  'Total creditable withholding tax (adjustable WHT deducted at source, e.g. u/s 149 on salary). Subtracted from balance_payable ALONGSIDE advance_tax_paid — the two are different statutory quantities and must not be conflated: advance_tax_paid is s.147 only.';

-- Usable in a generated expression only if it exists, is live, and is not
-- itself generated.
CREATE OR REPLACE FUNCTION pg_temp.z18_col_ok(c text) RETURNS boolean AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM pg_attribute a
     WHERE a.attrelid = 'tax_computation_forms'::regclass
       AND a.attname  = c
       AND a.attnum   > 0
       AND NOT a.attisdropped
       AND a.attgenerated = ''
  );
$fn$ LANGUAGE sql;

DO $$
DECLARE
  liability text[] := ARRAY[]::text[];
  missing   text[] := ARRAY[]::text[];
  item      text;
  sign      text;
  liab_expr text;
  bal_expr  text;
  -- The liability expression, term by term, as (column, sign). super_tax is the
  -- new one; everything else reproduces the existing definition exactly so this
  -- migration changes ONLY what it says it changes.
  spec text[][] := ARRAY[
    ['normal_income_tax',  '+'],
    ['surcharge_amount',   '+'],
    ['capital_gains_tax',  '+'],
    ['tax_reductions',     '-'],
    ['tax_credits',        '-'],
    ['final_fixed_tax',    '+'],
    ['super_tax',          '+']   -- DEFECT 2: omitted until now
  ];
BEGIN
  FOR i IN 1 .. array_length(spec, 1) LOOP
    item := spec[i][1];
    sign := spec[i][2];
    IF pg_temp.z18_col_ok(item) THEN
      liability := array_append(liability, format('%s COALESCE(%I, 0::numeric)', sign, item));
    ELSIF item = 'super_tax' THEN
      missing := array_append(missing,
        'super_tax  [apply phase-t1-add-super-tax-column.sql first]');
    ELSE
      missing := array_append(missing, item);
    END IF;
  END LOOP;

  -- The two payment credits subtracted from the liability to give the balance.
  FOREACH item IN ARRAY ARRAY['advance_tax_paid','withholding_tax_paid'] LOOP
    IF NOT pg_temp.z18_col_ok(item) THEN
      missing := array_append(missing, item || '  [payment credit]');
    END IF;
  END LOOP;

  IF array_length(missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION E'phase-z18 cannot build the expressions — unresolved column(s):\n  %',
      array_to_string(missing, E'\n  ');
  END IF;

  IF array_length(liability, 1) <> 7 THEN
    RAISE EXCEPTION 'phase-z18 expected 7 liability terms, assembled %. Refusing to install a partial expression.',
      array_length(liability, 1);
  END IF;

  liab_expr := array_to_string(liability, ' ');
  -- Leading '+' would be a syntax error.
  liab_expr := ltrim(liab_expr, '+ ');

  -- DEFECT 1: subtract BOTH payment credits.
  bal_expr := liab_expr
           || ' - COALESCE(advance_tax_paid, 0::numeric)'
           || ' - COALESCE(withholding_tax_paid, 0::numeric)';

  -- Deliberately not CASCADE: if a view has come to depend on either column,
  -- abort inside the transaction rather than silently destroying it.
  EXECUTE 'ALTER TABLE tax_computation_forms DROP COLUMN IF EXISTS balance_payable';
  EXECUTE 'ALTER TABLE tax_computation_forms DROP COLUMN IF EXISTS total_tax_liability';

  EXECUTE format(
    'ALTER TABLE tax_computation_forms ADD COLUMN total_tax_liability numeric(15,2) GENERATED ALWAYS AS (%s) STORED',
    liab_expr);
  EXECUTE format(
    'ALTER TABLE tax_computation_forms ADD COLUMN balance_payable numeric(15,2) GENERATED ALWAYS AS (%s) STORED',
    bal_expr);

  RAISE NOTICE E'phase-z18:\n  total_tax_liability = %\n  balance_payable     = %', liab_expr, bal_expr;
END $$;

COMMENT ON COLUMN tax_computation_forms.total_tax_liability IS
  'Normal tax + surcharge + CGT - reductions - credits + final/fixed tax + SUPER TAX. super_tax was omitted before phase-z18, understating the liability of every filer above the s.4C threshold by exactly their super tax.';

COMMENT ON COLUMN tax_computation_forms.balance_payable IS
  'total_tax_liability less BOTH payment credits: advance_tax_paid (s.147) and withholding_tax_paid (tax deducted at source). Before phase-z18 only advance tax was subtracted, over-stating what a salaried taxpayer owes by their entire withholding.';

COMMIT;

-- NOT CHANGED, FLAGGED INSTEAD: minimum_tax_on_other_income is a real column on
-- this table and is absent from total_tax_liability, exactly as super_tax was.
-- It may be a third instance of the same defect, or it may be deliberately
-- excluded because minimum tax interacts with the normal-tax charge rather than
-- adding to it. That is a tax question, not a schema one, and nobody asked me to
-- change it — so it is left alone and raised for lane B / the owner.
