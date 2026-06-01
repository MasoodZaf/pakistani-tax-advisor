/**
 * Unit tests for TaxCalculationService — the heart of the app.
 *
 * Approach:
 *   - Drive the pure `_computeFromInputs(...)` directly (no DB, no fetches).
 *   - Inject a fixed FA-2025 rate table so each test is deterministic.
 *   - Hand-compute every expected value in the test header so any future
 *     breakage is unambiguous to debug ("expected 185,000 from these
 *     specific inputs and these specific slabs — got X").
 *
 * Coverage targets:
 *   - Simple salaried, well under all thresholds
 *   - Surcharge breach (>10m)
 *   - Refund vs. payable swing (WHT > or < chargeable)
 *   - Reductions and credits stacking
 *   - All-CGT, no salary
 *   - Super-tax breach (>150m)
 *   - Empty inputs → all zeros, no NaN
 *   - Negative-protection: income reductions don't push numbers below zero
 */

// taxCalculationService imports config/database at the top of the module,
// which enforces DB_PASSWORD even though `_computeFromInputs` never touches
// the pool. Stub both `database` and `TaxRateService` so the unit test runs
// without any env or DB dependency.
jest.mock('../../src/config/database', () => ({ pool: {} }));
jest.mock('../../src/services/taxRateService', () => ({}));

const TaxCalculationService = require('../../src/services/taxCalculationService');

// FA-2025 salaried-individual slabs (matches `phase-b-rate-tables-and-seed.sql`).
// `min_income` uses the DB's "starts-at" convention (601 for the slab whose
// breakpoint is 600). `calculateProgressiveTax` normalises this internally.
const FA2025_SLABS = [
  { min_income: 0,       max_income: 600000,   tax_rate: 0.00 },
  { min_income: 600001,  max_income: 1200000,  tax_rate: 0.01 },
  { min_income: 1200001, max_income: 2200000,  tax_rate: 0.11 },
  { min_income: 2200001, max_income: 3200000,  tax_rate: 0.23 },
  { min_income: 3200001, max_income: 4100000,  tax_rate: 0.30 },
  { min_income: 4100001, max_income: null,     tax_rate: 0.35 },
];

// FA-2025 surcharge: 9% on normal income tax once taxable income > 10m.
const FA2025_SURCHARGE = { rate: 0.09, threshold: 10000000 };

// FA-2025 super-tax tiers (s.4C, Division IIA).
const FA2025_SUPER_TAX = [
  { tier: 'tier_1', rate: 0.01, minIncome: 150000001, maxIncome: 200000000 },
  { tier: 'tier_2', rate: 0.02, minIncome: 200000001, maxIncome: 250000000 },
  { tier: 'tier_3', rate: 0.03, minIncome: 250000001, maxIncome: 300000000 },
  { tier: 'tier_4', rate: 0.04, minIncome: 300000001, maxIncome: 350000000 },
  { tier: 'tier_5', rate: 0.06, minIncome: 350000001, maxIncome: 400000000 },
  { tier: 'tier_6', rate: 0.08, minIncome: 400000001, maxIncome: 500000000 },
  { tier: 'tier_7', rate: 0.10, minIncome: 500000001, maxIncome: 999999999999 },
];

const FA2025_RATES = {
  slabs:    FA2025_SLABS,
  surcharge: FA2025_SURCHARGE,
  superTax:  FA2025_SUPER_TAX,
};

// Helper: build the income data shape `_computeFromInputs` reads from.
function income({ salary = 0, otherMin = 0, otherNoMin = 0, nonCash = 0 } = {}) {
  return {
    b16_annual_salary_wages_total:    salary,
    b23_total_non_cash_benefits:      nonCash,
    b28_other_income_min_tax_total:   otherMin,
    b33_other_income_no_min_tax_total: otherNoMin,
  };
}

function compute(inputs) {
  return TaxCalculationService._computeFromInputs({
    incomeData:        inputs.income        || {},
    adjustableData:    inputs.adjustable    || {},
    capitalGainsData:  inputs.capital_gain  || {},
    reductionsData:    inputs.reductions    || {},
    creditsData:       inputs.credits       || {},
    deductionsData:    inputs.deductions    || {},
    finalMinData:      inputs.final_min     || {},
    rates:             inputs.rates         || FA2025_RATES,
    taxYear:           '2025-26',
  });
}

describe('TaxCalculationService._computeFromInputs', () => {

  // ── A. Simple salaried, well under thresholds ───────────────────────────────
  // Salary 2.5m. Slab walk:
  //   0-600k    @  0%       =     0
  //   600k-1.2m @  1% × 600k =  6,000
  //   1.2m-2.2m @ 11% ×  1m  = 110,000
  //   2.2m-2.5m @ 23% × 300k = 69,000
  //   ─────────────────────────────
  //   Normal tax              = 185,000
  // Surcharge: 0 (income < 10m).  Super tax: 0.  No WHT → 185k payable.
  test('salary 2.5m, no other income, no WHT', () => {
    const r = compute({ income: income({ salary: 2500000 }) });
    expect(r.income.totalIncome).toBe(2500000);
    expect(r.income.taxableIncomeExcludingCG).toBe(2500000);
    expect(r.tax.normalIncomeTax).toBe(185000);
    expect(r.tax.surcharge).toBe(0);
    expect(r.tax.superTax).toBe(0);
    expect(r.tax.totalTaxChargeable).toBe(185000);
    expect(r.payments.balancePayableRefundable).toBe(185000);
  });

  // ── B. Refund swing: same salary as A, but WHT 250k > tax 185k → 65k refund ─
  test('refund when WHT exceeds chargeable tax', () => {
    const r = compute({
      income:     income({ salary: 2500000 }),
      adjustable: { total_tax_collected: 250000 },
    });
    expect(r.tax.totalTaxChargeable).toBe(185000);
    expect(r.payments.withholdingTax).toBe(250000);
    expect(r.payments.balancePayableRefundable).toBe(-65000);
  });

  // ── C. Surcharge breach: salary 15m ─────────────────────────────────────────
  // Slab walk on 15m:
  //   600k @ 1%     =   6,000
  //   1m   @ 11%    = 110,000
  //   1m   @ 23%    = 230,000
  //   900k @ 30%    = 270,000
  //   10.9m @ 35%   = 3,815,000
  //   ─────────────────────────
  //   Normal tax    = 4,431,000
  // Surcharge: 9% of 4,431,000 = 398,790.
  test('surcharge applies above 10m taxable income (FA 2025: 9%)', () => {
    const r = compute({ income: income({ salary: 15000000 }) });
    expect(r.tax.normalIncomeTax).toBe(4431000);
    expect(r.tax.surcharge).toBe(398790);
    expect(r.tax.totalTaxBeforeAdjustments).toBe(4431000 + 398790);
    expect(r.tax.totalTaxChargeable).toBe(4431000 + 398790);
  });

  // ── D. Reductions + credits stack ───────────────────────────────────────────
  // Salary 5m → tax: 6,000 + 110,000 + 230,000 + 270,000 + 315,000 = 931,000.
  // Reductions 100k, credits 50k → net 781,000.
  test('total reductions and credits subtract from chargeable tax', () => {
    const r = compute({
      income:     income({ salary: 5000000 }),
      reductions: { total_tax_reductions: 100000 },
      credits:    { total_tax_credits:    50000 },
    });
    expect(r.tax.normalIncomeTax).toBe(931000);
    expect(r.tax.totalReductions).toBe(100000);
    expect(r.tax.totalCredits).toBe(50000);
    expect(r.tax.netTaxPayable).toBe(931000 - 100000 - 50000);
  });

  // ── E. Reductions + credits cannot push net tax below zero ──────────────────
  // Salary 1m → tax 4,000 (1% × 400k). If user claims 1m credit, net is 0,
  // not -996,000.
  test('credits exceeding tax floor at zero (Math.max(0, ...))', () => {
    const r = compute({
      income:  income({ salary: 1000000 }),
      credits: { total_tax_credits: 1000000 },
    });
    expect(r.tax.normalIncomeTax).toBeGreaterThan(0);
    expect(r.tax.netTaxPayable).toBe(0);
  });

  // ── F. CGT-only (no salary) ─────────────────────────────────────────────────
  // Salary 0, capital gain 1.5m, CGT (per-form computed) 175k.
  // Taxable excl CG = 0 → normal tax = 0, surcharge = 0.
  // Total chargeable = CGT = 175k.
  test('all-CGT: no salary, only capital-gains tax flows through', () => {
    const r = compute({
      income:       income({ salary: 0 }),
      capital_gain: { total_capital_gain: 1500000, total_capital_gain_tax: 175000 },
    });
    expect(r.income.incomeFromSalary).toBe(0);
    expect(r.income.incomeFromCapitalGains).toBe(1500000);
    expect(r.income.taxableIncomeExcludingCG).toBe(0);
    expect(r.income.taxableIncomeIncludingCG).toBe(1500000);
    expect(r.tax.normalIncomeTax).toBe(0);
    expect(r.tax.surcharge).toBe(0);
    expect(r.tax.capitalGainsTax).toBe(175000);
    expect(r.tax.totalTaxChargeable).toBe(175000);
  });

  // ── F2. CGT is NOT double-counted via the Final/Min mirror (audit UX-03) ─────
  // A capital-gains filer's CGT (175k) lives canonically on the Capital Gains
  // form (capital_gains_tax_chargeable) AND is auto-mirrored into the Final/Min
  // form's capital_gain_tax_chargeable row, which feeds grand_total_tax_chargeable.
  // The computation must add CGT ONCE (via capitalGainsTax), so the final-min
  // contribution uses subtotal_tax_chargeable (CGT-excluded), not grand_total.
  //   capitalGainsTax       = 175,000  (from the Capital Gains form)
  //   final-min subtotal    =  50,000  (e.g. a dividend line)
  //   final-min grand_total = 225,000  (= subtotal + 175k mirrored CGT)
  //   Correct total         = 175,000 + 50,000 = 225,000   (NOT 400,000)
  test('CGT is not double-counted through the Final/Min grand-total mirror (UX-03)', () => {
    const r = compute({
      capital_gain: { total_capital_gain: 1500000, capital_gains_tax_chargeable: 175000 },
      final_min: {
        subtotal_tax_chargeable:     50000,
        capital_gain_tax_chargeable: 175000, // mirrored from the Capital Gains form
        grand_total_tax_chargeable:  225000, // subtotal + mirror
      },
    });
    expect(r.tax.capitalGainsTax).toBe(175000);
    expect(r.tax.finalMinTaxChargeable).toBe(50000);   // subtotal, NOT grand_total
    expect(r.tax.totalTaxChargeable).toBe(225000);     // CGT counted exactly once
    expect(r.tax.totalTaxChargeable).not.toBe(400000); // the old double-counted figure
  });

  // ── F3. UX-03 back-compat: derive the CGT-excluded total when the subtotal ───
  // column is absent (rows written before phase-u re-added subtotal_tax_chargeable).
  test('UX-03 fallback: grand_total − capital_gain when subtotal column is absent', () => {
    const r = compute({
      capital_gain: { total_capital_gain: 1500000, capital_gains_tax_chargeable: 175000 },
      final_min: {
        // no subtotal_tax_chargeable (older row)
        capital_gain_tax_chargeable: 175000,
        grand_total_tax_chargeable:  225000,
      },
    });
    expect(r.tax.finalMinTaxChargeable).toBe(50000);  // 225,000 − 175,000
    expect(r.tax.totalTaxChargeable).toBe(225000);
  });

  // ── G. Super tax (s.4C) breach ──────────────────────────────────────────────
  // Salary 175m → falls in tier_1 (150m–200m @ 1%).
  // Super tax = 175,000,000 × 0.01 = 1,750,000.
  test('super tax 4C: tier_1 (150m-200m @ 1%)', () => {
    const r = compute({ income: income({ salary: 175000000 }) });
    expect(r.income.taxableIncomeIncludingCG).toBe(175000000);
    expect(r.tax.superTax).toBe(1750000);
    expect(r.tax.totalTaxChargeable).toBe(r.tax.netTaxPayable + 1750000);
  });

  // ── H. Empty input → no NaN, all zeros ──────────────────────────────────────
  // Pin defensive behaviour. A user with an unsaved-blank form should produce
  // all-zero outputs, not NaN/Infinity.
  test('empty inputs produce all-zero finite outputs', () => {
    const r = compute({});
    const numbers = [
      r.income.totalIncome, r.income.taxableIncomeExcludingCG,
      r.tax.normalIncomeTax, r.tax.surcharge, r.tax.totalTaxChargeable,
      r.tax.superTax, r.payments.withholdingTax,
      r.payments.balancePayableRefundable,
    ];
    for (const n of numbers) {
      expect(Number.isFinite(n)).toBe(true);
      expect(n).toBe(0);
    }
  });

  // ── I. Deductible allowances reduce taxable income ──────────────────────────
  // Salary 5m, deductions 500k → taxable = 4.5m, not 5m.
  // Slab walk on 4.5m:
  //   600k @ 1% = 6,000
  //   1m  @ 11% = 110,000
  //   1m  @ 23% = 230,000
  //   900k @ 30% = 270,000
  //   400k @ 35% = 140,000
  //   ─────────────────
  //   Normal tax  = 756,000
  test('deductible allowances reduce taxable income', () => {
    const r = compute({
      income:     income({ salary: 5000000 }),
      deductions: { total_deductions: 500000 },
    });
    expect(r.income.deductibleAllowances).toBe(500000);
    expect(r.income.taxableIncomeExcludingCG).toBe(4500000);
    expect(r.tax.normalIncomeTax).toBe(756000);
  });

  // ── J. Withholding tax flow-through ─────────────────────────────────────────
  // Saved data uses `total_adjustable_tax`; preview uses `total_tax_collected`.
  // Either field name should populate the same payments.withholdingTax slot.
  test('withholding tax is read from either total_tax_collected or total_adjustable_tax', () => {
    const a = compute({
      income:     income({ salary: 2500000 }),
      adjustable: { total_tax_collected: 100000 },
    });
    const b = compute({
      income:     income({ salary: 2500000 }),
      adjustable: { total_adjustable_tax: 100000 },
    });
    expect(a.payments.withholdingTax).toBe(100000);
    expect(b.payments.withholdingTax).toBe(100000);
    expect(a.payments.balancePayableRefundable).toBe(b.payments.balancePayableRefundable);
  });

  // ── K. Advance tax under s.147 reduces balance like withholding ─────────────
  test('advance tax u/s 147 stacks with WHT to reduce balance', () => {
    const r = compute({
      income:     income({ salary: 2500000 }),
      adjustable: { total_tax_collected: 100000, advance_tax_u_s_147: 50000 },
    });
    // Tax 185k − WHT 100k − advance 50k = 35k payable.
    expect(r.payments.balancePayableRefundable).toBe(35000);
  });

  // ── L. Salary-tier breakdown buckets ────────────────────────────────────────
  // Sanity: incomeFromSalary should equal salary + non-cash benefits, and
  // incomeFromOtherSources should equal min-tax + no-min-tax other-income
  // totals. These two derivations are the source of frequent dashboard
  // surprises if someone fiddles with column aliasing.
  test('income buckets are derived from the right component fields', () => {
    const r = compute({
      income: income({ salary: 5000000, nonCash: 400000, otherMin: 200000, otherNoMin: 100000 }),
    });
    expect(r.income.incomeFromSalary).toBe(5400000);
    expect(r.income.incomeFromOtherSources).toBe(300000);
    expect(r.income.totalIncome).toBe(5700000);
  });
});
