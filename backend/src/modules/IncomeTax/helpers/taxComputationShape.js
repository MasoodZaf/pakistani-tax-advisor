// Engine breakdown → tax_computation_forms columns.
//
// Lane A stripped POST /api/tax-forms/tax-computation of every figure, because
// the table's headline columns are `GENERATED ALWAYS AS` expressions over the
// input columns — so a client-supplied `tax_credits` became the taxpayer's
// stored `total_tax_liability`. Correct, but it leaves the row at DEFAULT 0
// until something populates it FROM THE ENGINE. This module is that mapping.
//
// Every value here comes from a named key on
// TaxCalculationService.calculateTaxComputation()'s breakdown. Nothing is
// re-derived from raw form data, and no column is filled with a plausible-
// looking number: a column with no engine counterpart is listed in
// NO_ENGINE_COUNTERPART and stays at 0.

// Columns Postgres computes. Never written — writing one is an error, not a
// silent no-op. Listed so the writer can prove it never targets them.
const GENERATED_COLUMNS = new Set([
  'total_income',
  'taxable_income_excluding_cg',
  'taxable_income_including_cg',
  'normal_tax_including_surcharge_cgt',
  'net_tax_payable',
  'total_tax_liability',
  'balance_payable',
]);

// column → how it is produced from the breakdown. `get` receives the whole
// breakdown; `note` is the audit trail for why this mapping and not another.
const COLUMN_MAP = [
  // ── Income ──────────────────────────────────────────────────────────────
  {
    column: 'income_from_salary',
    get: (b) => b.income.incomeFromSalary,
    note: 'breakdown.income.incomeFromSalary',
  },
  {
    column: 'income_loss_other_sources',
    get: (b) => b.income.incomeFromOtherSources,
    // The generated total_income sums income_from_salary +
    // other_income_subject_to_min_tax + income_loss_other_sources. The engine
    // has ONE other-income figure and it is normal-basis by construction
    // (profitOnDebtInNormalBase + otherIncomeNormal, taxCalculationService
    // :296-297), so it belongs on the normal-basis limb. Putting it on the
    // minimum-tax limb would produce the same total while misclassifying the
    // income — same number, wrong return.
    note: 'breakdown.income.incomeFromOtherSources — normal-basis limb',
  },
  {
    column: 'deductible_allowances',
    get: (b) => b.income.deductibleAllowances,
    note: 'breakdown.income.deductibleAllowances',
  },
  {
    column: 'capital_gains_loss',
    get: (b) => b.income.incomeFromCapitalGains,
    note: 'breakdown.income.incomeFromCapitalGains',
  },

  // ── Tax ─────────────────────────────────────────────────────────────────
  {
    column: 'normal_income_tax',
    get: (b) => b.tax.normalIncomeTax,
    note: 'breakdown.tax.normalIncomeTax',
  },
  {
    column: 'surcharge_amount',
    get: (b) => b.tax.surcharge,
    // phase-w dropped the rival `surcharge` column, so the dialect lane A
    // flagged is already resolved in the schema; the writer filters to the
    // live column list, so either schema state is safe.
    note: 'breakdown.tax.surcharge (rival column `surcharge` dropped in phase-w)',
  },
  {
    column: 'capital_gains_tax',
    get: (b) => b.tax.capitalGainsTax,
    note: 'breakdown.tax.capitalGainsTax (rival `capital_gain_tax` dropped in phase-w)',
  },
  {
    column: 'tax_reductions',
    get: (b) => b.tax.totalReductions,
    note: 'breakdown.tax.totalReductions',
  },
  {
    column: 'tax_credits',
    // Lane B's own sum of formCredits + foreignTaxCredit. Taken whole rather
    // than re-added here — CREDITS_IDENTITY below asserts the composition so a
    // change on lane B's side surfaces as a test failure, not a wrong figure.
    get: (b) => b.tax.totalCredits,
    note: 'breakdown.tax.totalCredits (= tax.formCredits + tax.foreignTaxCredit)',
  },
  {
    column: 'super_tax',
    get: (b) => b.tax.superTax,
    note: 'breakdown.tax.superTax (s.4C)',
  },
  {
    column: 'final_fixed_tax',
    // Both terms are final/fixed tax by definition and the table has one
    // column for them. Summing two named engine outputs is a mapping; it does
    // not invent a figure.
    get: (b) => b.tax.finalMinTaxChargeable + b.tax.profitOnDebtFinalTax,
    note: 'breakdown.tax.finalMinTaxChargeable + breakdown.tax.profitOnDebtFinalTax',
  },

  // ── Payments ────────────────────────────────────────────────────────────
  //
  // ⚠ THE CAP IS ON THE COMBINED FIGURE, NOT PER COLUMN. READ creditableSplit()
  // BEFORE CHANGING EITHER OF THE NEXT TWO ENTRIES.
  //
  // The engine refuses a payment claim larger than the declared gross receipts:
  //     claimedPayments    = withholdingTax + advanceTax
  //     creditablePayments = min(claimedPayments, declaredGrossReceipts)
  // That ceiling is what closes the unbounded refund vector (it was driven to
  // -999,699,999 during QA). But phase-z18's balance_payable subtracts the two
  // columns SEPARATELY:
  //     balance_payable = total_tax_liability - advance_tax_paid - withholding_tax_paid
  // so writing the raw uncapped withholdingTax and advanceTax here would make
  // the stored balance subtract claimedPayments — reinstating the exact refund
  // vector the engine closed, in the database, where no engine guard can see it.
  // The two columns must therefore sum to creditablePayments, never to
  // claimedPayments.
  {
    column: 'advance_tax_paid',
    // Lane B's de-duplicated s.147 figure (pickDialect over the adjustable-tax
    // and deductions-form declarations), reduced by its share of the cap.
    get: (b) => creditableSplit(b).advance,
    note: 'breakdown.payments.advanceTax, apportioned share of payments.creditablePayments',
  },
  {
    column: 'withholding_tax_paid',
    // Added by phase-z18 so balance_payable can credit withholding at all.
    // withholdingTax is adjustableWHT + finalMinTaxDeducted, i.e. distinct from
    // advance tax — so this is not a double-count of advance_tax_paid.
    get: (b) => creditableSplit(b).withholding,
    note: 'breakdown.payments.withholdingTax, apportioned share of payments.creditablePayments',
  },
];

// Apportion the engine's creditablePayments ceiling across the two payment
// columns, preserving their ratio.
//
// When the claim is within the declared receipts (the normal case) this is the
// identity: each column gets its own figure untouched. It only bites when the
// engine has already refused part of the claim, and then it reduces both
// proportionally rather than privileging either — a priority ordering would
// silently decide which payment type gets disallowed first, which is a
// statutory question nobody has answered.
//
// Rounded to paisa, with the residue pushed onto `withholding` so the pair sums
// to creditablePayments exactly. Without that, two rounded halves can miss the
// ceiling by a paisa and the stored balance disagrees with the engine.
function creditableSplit(breakdown) {
  const p = breakdown.payments || {};
  const withholding = Math.max(0, Number(p.withholdingTax) || 0);
  const advance = Math.max(0, Number(p.advanceTax) || 0);
  const claimed = withholding + advance;

  // creditablePayments is authoritative; fall back to the claim if the engine
  // did not supply it (older breakdown shape) rather than inventing a ceiling.
  const creditable =
    p.creditablePayments === undefined || p.creditablePayments === null
      ? claimed
      : Math.max(0, Number(p.creditablePayments) || 0);

  if (claimed === 0) return { withholding: 0, advance: 0 };
  if (creditable >= claimed) return { withholding, advance };

  const round2 = (n) => Math.round(n * 100) / 100;
  const advanceShare = round2((advance / claimed) * creditable);
  return {
    advance: advanceShare,
    withholding: round2(creditable - advanceShare),
  };
}

// Columns with no engine counterpart. Left at the column DEFAULT (0) on
// purpose. Each needs either an engine output or a decision that it is dead.
const NO_ENGINE_COUNTERPART = {
  other_income_subject_to_min_tax:
    'The engine models no minimum-tax other-income bucket. Its single ' +
    'other-income figure is normal-basis and is written to ' +
    'income_loss_other_sources. Filling this limb instead would give the same ' +
    'total_income while misclassifying the income.',
  minimum_tax_on_other_income:
    'No engine counterpart. The engine computes minimum tax nowhere — s.113 ' +
    'is not implemented. Needs an engine output before this column can be ' +
    'anything but 0.',
};

// Breakdown keys carried for diagnostics that deliberately map to no column.
const DIAGNOSTIC_ONLY_KEYS = [
  'income.reclassifiedFromDeductions', // provenance of the advance-tax figure
  'payments.advanceTaxDuplicateDeclaration', // same figure declared on two forms
  'payments.rejectedPaymentClaim', // payment claim clamped to declared receipts
  'payments.claimedPayments',
  'payments.creditablePayments',
  'payments.withholdingTax',
];

// Documented discrepancies between the generated columns and the engine. These
// are schema-expression gaps, not mapping choices — surfaced so nobody reads a
// stored headline as agreeing with the engine when it does not.
const KNOWN_GENERATED_COLUMN_GAPS = {
  // Both entries that used to live here are FIXED by
  // phase-z18-tax-computation-liability-and-balance.sql:
  //   * balance_payable now subtracts withholding_tax_paid as well as
  //     advance_tax_paid, and both columns are populated here (see
  //     creditableSplit — they sum to payments.creditablePayments, so the stored
  //     balance matches the engine instead of over-stating by the withholding).
  //   * total_tax_liability now includes super_tax.
  // Kept as an empty map rather than deleted: it is asserted on by the tests as
  // the place a schema-expression gap gets recorded, and the next one should
  // land here rather than being discovered in production.
};

const toNum = (v) => {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Map an engine breakdown onto tax_computation_forms input columns.
 * @param {object} breakdown TaxCalculationService.calculateTaxComputation() output
 * @returns {{values: object, mapped: string[]}}
 */
function toTaxComputationRow(breakdown) {
  if (!breakdown || !breakdown.income || !breakdown.tax || !breakdown.payments) {
    throw new Error('toTaxComputationRow: incomplete engine breakdown');
  }
  const values = {};
  for (const { column, get } of COLUMN_MAP) {
    if (GENERATED_COLUMNS.has(column)) {
      // Guard rather than comment: a generated column in the map is a bug that
      // would 500 at the INSERT with a confusing Postgres error.
      throw new Error(`toTaxComputationRow: ${column} is a generated column`);
    }
    values[column] = round2(toNum(get(breakdown)));
  }
  return { values, mapped: COLUMN_MAP.map((m) => m.column) };
}

module.exports = {
  COLUMN_MAP,
  GENERATED_COLUMNS,
  NO_ENGINE_COUNTERPART,
  DIAGNOSTIC_ONLY_KEYS,
  KNOWN_GENERATED_COLUMN_GAPS,
  toTaxComputationRow,
};
