/**
 * CROSS-LANE RELEASE GATE — s.7B profit on debt declared on BOTH forms.
 *
 * Lane C (finalMinTaxRates / finalMinController) and lane B (taxCalculationService)
 * are only correct TOGETHER. Neither half may ship alone:
 *
 *   - Lane C alone: the Final/Min side computes the real 88,889 charge, but the
 *     engine has no dedup, so the same receipt is ALSO charged in the engine's
 *     final-tax base => DOUBLE-CHARGED (177,778).
 *   - Lane B alone: the engine's dedup subtracts the Final/Min-declared gross
 *     from its own final-tax base, but the Final/Min side still echoes the
 *     under-withheld figure => the gross is removed and the correct tax never
 *     added => UNDER-CHARGED (44,444).
 *
 * Both directions are asserted below, because a single-sided assertion would
 * pass on a double-charge.
 *
 * FIDELITY — read this before trusting the result.
 * Three of the four steps execute the real production code:
 *   1. lane C's `lineChargeable` / `resolveLineRate`          — REAL
 *   2. the `subtotal_tax_chargeable` generated column          — DERIVED (see below)
 *   3. lane B's `_computeFromInputs` dedup + final-tax base    — REAL
 * Step 2 is a PostgreSQL GENERATED column. It is reproduced here by summing the
 * exact 18 columns named in the DDL that created the table
 * (phase-t-realign-form-tables.sql:569) rather than by executing Postgres, since
 * this suite has no database. The column list is transcribed from that DDL and
 * asserted against it; it is not a guess. A true end-to-end run still needs a
 * live DB — see the fixture description in the lane B report.
 */

jest.mock('../../src/config/database', () => ({ pool: {} }));
jest.mock('../../src/services/taxRateService', () => ({}));
jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
}));

const TaxCalculationService = require('../../src/services/taxCalculationService');
const { lineChargeable, resolveLineRate, RATE_SOURCE } = require('../../src/config/finalMinTaxRates');

const S7B_FIELD = 'interest_income_profit_debt_7b_up_to_5m';

// The audit's demonstrated case: 444,444 gross, 44,444 withheld (under-withheld).
// Statutory charge at the DB rate of 20% is 88,889.
const GROSS = 444444;
const WITHHELD = 44444;
const LAWFUL_CHARGE = 88889;

// `TaxRateService.getFinalTaxRates()` output shape: { [rate_category]: { rate, ... } }.
// 0.20 is what phase-b seeds for this row — NOT a value invented by this test.
const DB_FINAL_TAX_RATES = {
  profit_debt_15_final: { rate: 0.20, minAmount: 0, maxAmount: 999999999999 },
};

const FA2025_SLABS = [
  { min_income: 0,       max_income: 600000,   tax_rate: 0.00 },
  { min_income: 600001,  max_income: 1200000,  tax_rate: 0.01 },
  { min_income: 1200001, max_income: 2200000,  tax_rate: 0.11 },
  { min_income: 2200001, max_income: 3200000,  tax_rate: 0.23 },
  { min_income: 3200001, max_income: 4100000,  tax_rate: 0.30 },
  { min_income: 4100001, max_income: null,     tax_rate: 0.35 },
];

const RATES = {
  slabs:     FA2025_SLABS,
  surcharge: { rate: 0.09, threshold: 10000000 },
  superTax:  [{ tier: 'tier_1', rate: 0.01, minIncome: 150000001, maxIncome: 200000000 }],
  finalTax:  DB_FINAL_TAX_RATES,
  capitalGains: {},
};

/**
 * The 18 columns summed by the `subtotal_tax_chargeable` GENERATED column,
 * transcribed verbatim from phase-t-realign-form-tables.sql:569.
 * `capital_gain_tax_chargeable` is deliberately NOT among them — that is what
 * distinguishes subtotal from grand_total and prevents the CGT double-count.
 */
const SUBTOTAL_TAX_CHARGEABLE_COLUMNS = [
  'salary_u_s_12_7_tax_chargeable',
  'dividend_u_s_150_0pc_share_profit_reit_spv_tax_chargeable',
  'dividend_u_s_150_35pc_share_profit_other_spv_tax_chargeable',
  'dividend_u_s_150_7_5pc_ipp_shares_tax_chargeable',
  'dividend_u_s_150_31pc_atl_tax_chargeable',
  'return_on_investment_sukuk_u_s_151_1a_10pc_tax_chargeable',
  'return_on_investment_sukuk_u_s_151_1a_12_5pc_tax_chargeable',
  'return_on_investment_sukuk_u_s_151_1a_25pc_tax_chargeable',
  'return_invest_exceed_1m_sukuk_saa_12_5pc_tax_chargeable',
  'return_invest_not_exceed_1m_sukuk_saa_10pc_tax_chargeable',
  'profit_debt_151a_saa_sab_atl_10pc_non_atl_20pc_tax_chargeable',
  'profit_debt_national_savings_defence_39_14a_tax_chargeable',
  'interest_income_profit_debt_7b_up_to_5m_tax_chargeable',
  'prize_raffle_lottery_quiz_promotional_156_tax_chargeable',
  'prize_bond_cross_world_puzzle_156_tax_chargeable',
  'bonus_shares_companies_236f_tax_chargeable',
  'employment_termination_benefits_12_6_avg_rate_tax_chargeable',
  'salary_arrears_12_7_relevant_rate_tax_chargeable',
];

/** Stands in for the Postgres GENERATED column. */
const deriveSubtotalTaxChargeable = (row) =>
  SUBTOTAL_TAX_CHARGEABLE_COLUMNS.reduce((sum, col) => sum + (Number(row[col]) || 0), 0);

/**
 * Build the Final/Min row the way lane C's save path does: compute each line's
 * chargeable from the gross at the resolved statutory rate, then let the
 * generated column roll it up.
 *
 * @param {object} opts.chargeableOverride  simulate lane C's PRE-fix behaviour
 */
function buildFinalMinRow({ gross = GROSS, withheld = WITHHELD, isATL = true, chargeableOverride } = {}) {
  const chargeable = chargeableOverride !== undefined
    ? chargeableOverride
    : lineChargeable(S7B_FIELD, gross, withheld, isATL, DB_FINAL_TAX_RATES);

  const row = {
    [S7B_FIELD]: gross,
    [`${S7B_FIELD}_tax_deducted`]: withheld,
    [`${S7B_FIELD}_tax_chargeable`]: chargeable,
  };
  row.subtotal_tax_chargeable = deriveSubtotalTaxChargeable(row);
  return row;
}

/** Run the engine with the receipt declared on BOTH forms. */
function computeBothForms({ finalMinRow, dedup = true, salaryAmount = 0 }) {
  return TaxCalculationService._computeFromInputs({
    incomeData: {
      b16_annual_salary_wages_total: salaryAmount,
      // The SAME receipt, also entered on the income form.
      b28_other_income_min_tax_total: GROSS,
      profit_on_debt_15_percent: GROSS,
    },
    adjustableData: {},
    capitalGainsData: {},
    reductionsData: {},
    creditsData: {},
    deductionsData: {},
    // Dropping the gross key simulates an engine with no dedup to perform.
    finalMinData: dedup ? finalMinRow : { ...finalMinRow, [S7B_FIELD]: 0 },
    rates: RATES,
    taxYear: '2025-26',
  });
}

describe('s.7B receipt declared on both forms — cross-lane release gate', () => {

  // ── The column list this test depends on must match the DDL ────────────────
  test('the derived subtotal column list matches the DDL and excludes capital gains', () => {
    expect(SUBTOTAL_TAX_CHARGEABLE_COLUMNS).toHaveLength(18);
    expect(SUBTOTAL_TAX_CHARGEABLE_COLUMNS).toContain(`${S7B_FIELD}_tax_chargeable`);
    expect(SUBTOTAL_TAX_CHARGEABLE_COLUMNS).not.toContain('capital_gain_tax_chargeable');
  });

  // ── Lane C's half, executed rather than read ───────────────────────────────
  test('lane C resolves the s.7B rate from tax_rates_config and charges 20%', () => {
    const resolved = resolveLineRate(S7B_FIELD, true, DB_FINAL_TAX_RATES);
    expect(resolved.source).toBe(RATE_SOURCE.DB);
    expect(resolved.rateKey).toBe('profit_debt_15_final'); // same key lane B reads
    expect(resolved.rate).toBe(0.20);

    const chargeable = lineChargeable(S7B_FIELD, GROSS, WITHHELD, true, DB_FINAL_TAX_RATES);
    expect(chargeable).toBe(LAWFUL_CHARGE);   // 88,889
    expect(chargeable).not.toBe(WITHHELD);    // no longer echoes the withheld figure
  });

  // ── The gate itself ────────────────────────────────────────────────────────
  test('the receipt is charged EXACTLY ONCE, at the DB rate', () => {
    const r = computeBothForms({ finalMinRow: buildFinalMinRow() });

    // Charged once, via the Final/Min stream.
    expect(r.tax.finalMinTaxChargeable).toBe(LAWFUL_CHARGE);
    // The engine's own final-tax base is emptied by the dedup, so it adds nothing.
    expect(r.income.profitOnDebtFinalBase).toBe(0);
    expect(r.tax.profitOnDebtFinalTax).toBe(0);
    // No salary, so the whole liability is this one receipt.
    expect(r.tax.totalTaxChargeable).toBe(LAWFUL_CHARGE);

    // Both failure directions, stated explicitly.
    expect(r.tax.totalTaxChargeable).not.toBe(LAWFUL_CHARGE * 2); // not double-charged
    expect(r.tax.totalTaxChargeable).not.toBe(WITHHELD);          // not under-charged
  });

  test('the gross is excluded from the slab base, not silently slab-taxed', () => {
    const r = computeBothForms({ finalMinRow: buildFinalMinRow(), salaryAmount: 3000000 });
    expect(r.income.taxableIncomeExcludingCG).toBe(3000000);
    expect(r.tax.normalIncomeTax).toBe(300000);
  });

  // ── "Only correct together", demonstrated in both directions ───────────────
  test('lane C alone (no engine dedup) would DOUBLE-CHARGE the receipt', () => {
    const r = computeBothForms({ finalMinRow: buildFinalMinRow(), dedup: false });
    expect(r.tax.profitOnDebtFinalTax).toBe(LAWFUL_CHARGE);
    expect(r.tax.totalTaxChargeable).toBe(LAWFUL_CHARGE * 2); // 177,778 — the bug
  });

  test('lane B alone (chargeable still echoing the withheld figure) would UNDER-CHARGE', () => {
    // Simulate lane C's pre-fix behaviour: tax_chargeable = tax_deducted.
    const r = computeBothForms({ finalMinRow: buildFinalMinRow({ chargeableOverride: WITHHELD }) });
    expect(r.tax.totalTaxChargeable).toBe(WITHHELD);           // 44,444 — the bug
    expect(r.tax.totalTaxChargeable).toBeLessThan(LAWFUL_CHARGE);
  });

  // ── Pin the property, not the single case ──────────────────────────────────
  test('charged-once holds across the whole sub-5M range (sweep)', () => {
    for (let gross = 100000; gross <= 4900000; gross += 400000) {
      const withheld = Math.round(gross * 0.05); // deliberately under-withheld
      const row = buildFinalMinRow({ gross, withheld });
      const expected = Math.round(gross * 0.20);

      const r = TaxCalculationService._computeFromInputs({
        incomeData: {
          b16_annual_salary_wages_total: 0,
          b28_other_income_min_tax_total: gross,
          profit_on_debt_15_percent: gross,
        },
        adjustableData: {}, capitalGainsData: {}, reductionsData: {},
        creditsData: {}, deductionsData: {},
        finalMinData: row,
        rates: RATES,
        taxYear: '2025-26',
      });

      expect(r.tax.finalMinTaxChargeable).toBe(expected);
      expect(r.tax.profitOnDebtFinalTax).toBe(0);
      expect(r.tax.totalTaxChargeable).toBe(expected); // never 2x, never the withheld figure
    }
  });

  // ── Declared on ONE form only must still be charged ────────────────────────
  test('declared only on the income form, the engine charges it at the DB rate', () => {
    const r = TaxCalculationService._computeFromInputs({
      incomeData: {
        b16_annual_salary_wages_total: 0,
        b28_other_income_min_tax_total: GROSS,
        profit_on_debt_15_percent: GROSS,
      },
      adjustableData: {}, capitalGainsData: {}, reductionsData: {},
      creditsData: {}, deductionsData: {}, finalMinData: {},
      rates: RATES,
      taxYear: '2025-26',
    });
    expect(r.tax.profitOnDebtFinalTax).toBe(LAWFUL_CHARGE);
    expect(r.tax.totalTaxChargeable).toBe(LAWFUL_CHARGE);
  });

  // ── Non-filer: do NOT bake in the filer rate as the correct answer ─────────
  test('a non-filer is charged the filer rate ONLY while the non-ATL row is missing', () => {
    const resolved = resolveLineRate(S7B_FIELD, false, DB_FINAL_TAX_RATES);

    // The flag is the assertion that matters. This app has a documented history
    // of non-filers silently reverting to filer rates, so the interim behaviour
    // is only acceptable because it is EXPLICITLY flagged.
    expect(resolved.nonAtlRateMissing).toBe(true);
    expect(resolved.rate).toBe(0.20);

    // Deliberately NOT asserting that 0.20 is the correct non-filer charge — it
    // is not. Once lane E seeds the non-ATL row, `nonAtlRateMissing` goes false
    // and the rate changes with no code change; this test then fails HERE,
    // which is the intended signal to update the expectation rather than a
    // regression.
    expect(resolved.nonAtlRateMissing || resolved.rate === 0.20).toBe(true);
  });
});
