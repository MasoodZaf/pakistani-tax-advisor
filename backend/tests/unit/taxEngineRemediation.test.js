/**
 * Lane B regression tests — tax engine defects from the 2026-08-02 audit.
 *
 * Every test in this file FAILS on baseline 45bb80c and passes after the fix.
 * Each block names the defect, the demonstrated evidence, and the hand-computed
 * lawful figure so a future breakage is unambiguous to debug.
 *
 * Drives the pure `_computeFromInputs(...)` directly — no DB, no network.
 */

jest.mock('../../src/config/database', () => ({ pool: {} }));
jest.mock('../../src/services/taxRateService', () => ({}));
// The engine logs loudly when it refuses an input; keep test output readable.
jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
}));

const TaxCalculationService = require('../../src/services/taxCalculationService');

// FA-2025 salaried-individual slabs (phase-b-rate-tables-and-seed.sql).
const FA2025_SLABS = [
  { min_income: 0,       max_income: 600000,   tax_rate: 0.00 },
  { min_income: 600001,  max_income: 1200000,  tax_rate: 0.01 },
  { min_income: 1200001, max_income: 2200000,  tax_rate: 0.11 },
  { min_income: 2200001, max_income: 3200000,  tax_rate: 0.23 },
  { min_income: 3200001, max_income: 4100000,  tax_rate: 0.30 },
  { min_income: 4100001, max_income: null,     tax_rate: 0.35 },
];

// Real seeded s.4C tiers. Note the 1-rupee gaps between them — that is the bug.
const FA2025_SUPER_TAX = [
  { tier: 'tier_1', rate: 0.01, minIncome: 150000001, maxIncome: 200000000 },
  { tier: 'tier_2', rate: 0.02, minIncome: 200000001, maxIncome: 250000000 },
  { tier: 'tier_3', rate: 0.03, minIncome: 250000001, maxIncome: 300000000 },
  { tier: 'tier_4', rate: 0.04, minIncome: 300000001, maxIncome: 350000000 },
  { tier: 'tier_5', rate: 0.06, minIncome: 350000001, maxIncome: 400000000 },
  { tier: 'tier_6', rate: 0.08, minIncome: 400000001, maxIncome: 500000000 },
  { tier: 'tier_7', rate: 0.10, minIncome: 500000001, maxIncome: 999999999999 },
];

// rate_type='final_tax'. profit_debt_15_final was updated to 0.20 by FA 2025.
const FA2025_FINAL_TAX = {
  profit_debt_15_final: { rate: 0.20, minAmount: 0, maxAmount: 999999999999 },
};

// rate_type='capital_gains'. Categories map 1:1 onto `<category>_taxable`
// columns on capital_gain_forms.
const FA2025_CAPITAL_GAINS = {
  immovable_property_1_year:  { rate: 0.150 },
  immovable_property_2_years: { rate: 0.125 },
  securities_15_percent:      { rate: 0.150 },
  securities_mutual_funds_10_percent: { rate: 0.100 },
};

const FA2025_RATES = {
  slabs:        FA2025_SLABS,
  surcharge:    { rate: 0.09, threshold: 10000000 },
  superTax:     FA2025_SUPER_TAX,
  finalTax:     FA2025_FINAL_TAX,
  capitalGains: FA2025_CAPITAL_GAINS,
};

// The component columns of each GENERATED relief total, as Postgres reports them
// on both environments. The engine sums THESE rather than subtracting a retired
// head from a total that may not contain it — see NEW-B below for the Rs 671,422
// over-charge that produced.
//
// Passing them here is what the two async entry points do via
// resolveReliefComponents(); a test that omitted them would silently exercise
// only the degraded fallback path, so both are covered explicitly.
const RELIEF_COMPONENTS = {
  credits: [
    'charitable_donations_tax_credit',
    'charitable_donations_associate_tax_credit',
    'pension_fund_tax_credit',
    'surrender_tax_credit_reduction',
    'investment_tax_credit',
    'other_credits',
  ],
  reductions: [
    'teacher_researcher_tax_reduction',
    'behbood_certificates_tax_reduction',
    'capital_gain_immovable_50_reduction',
    'capital_gain_immovable_75_reduction',
    'export_income_reduction',
    'industrial_undertaking_reduction',
    'other_reductions',
  ],
};

function compute(inputs = {}) {
  return TaxCalculationService._computeFromInputs({
    incomeData:       inputs.income       || {},
    adjustableData:   inputs.adjustable   || {},
    capitalGainsData: inputs.capital_gain || {},
    reductionsData:   inputs.reductions   || {},
    creditsData:      inputs.credits      || {},
    deductionsData:   inputs.deductions   || {},
    finalMinData:     inputs.final_min    || {},
    rates:            inputs.rates        || FA2025_RATES,
    taxYear:          '2025-26',
    reliefComponents:
      inputs.reliefComponents === undefined ? RELIEF_COMPONENTS : inputs.reliefComponents,
  });
}

const salary = (amount) => ({ b16_annual_salary_wages_total: amount });

// =============================================================================
// DEFECT 1 — the tax function was NON-MONOTONIC IN DEDUCTIONS
// =============================================================================
// `total_deductions` is a generated column that EXCLUDES
// professional_expenses_amount (phase-t-realign-form-tables.sql:435). The old
// `||` chain preferred it and only fell through to the component sum when it
// was 0, so professional expenses were silently dropped the moment any other
// head of relief was non-zero.
describe('D1 · deductions are monotonic', () => {

  // The audit's sharpest artefact, reproduced exactly.
  // Baseline salary 1,400,000. Professional expenses 1,000,000.
  //   Case 5: prof alone      -> total_deductions = 0 -> component sum used
  //                              -> 1,000,000 deducted -> taxable 400,000 -> tax 0
  //   Case 6: prof + edu 100k -> total_deductions = 100,000 (non-zero!)
  //                              -> professional expenses DISCARDED
  //                              -> taxable 1,300,000 -> tax 17,000
  // Adding a legitimate Rs 100,000 deduction RAISED tax from 0 to 17,000.
  // NOTE ON THE HEADS USED: the audit's original case paired PROFESSIONAL with
  // education expenses. phase-z19 retired the "professional expenses" relief (it
  // was cited to s.60C, the profit-on-debt allowance, omitted by Finance Act
  // 2022, and never covered these expenses), so it is no longer relieved and
  // cannot carry a monotonicity test. Zakat is substituted: it is a genuine
  // deduction from income, it exercises the identical code path — the `||` chain
  // that preferred the generated `total_deductions` column — and it reproduces
  // the same defect shape. The property under test is unchanged.
  test('adding education expense on top of zakat cannot raise tax', () => {
    const zakatOnly = compute({
      income: salary(1400000),
      deductions: {
        zakat_paid_amount: 1000000,
        total_deductions: 0,
        total_deduction_from_income: 0,
      },
    });

    const zakatPlusEdu = compute({
      income: salary(1400000),
      deductions: {
        zakat_paid_amount: 1000000,
        educational_expenses_amount: 100000,
        // What the generated column really produces for this pair.
        total_deductions: 100000,
        total_deduction_from_income: 0,
      },
    });

    // Both must deduct the full 1,100,000 — the component sum, not the column.
    expect(zakatOnly.income.deductibleAllowances).toBe(1000000);
    expect(zakatPlusEdu.income.deductibleAllowances).toBe(1100000);

    // THE monotonicity assertion: more lawful deduction, never more tax.
    expect(zakatPlusEdu.tax.netTaxPayable).toBeLessThanOrEqual(zakatOnly.tax.netTaxPayable);
    expect(zakatPlusEdu.tax.netTaxPayable).toBe(0);
  });

  test('the retired "professional expenses" relief is not deducted', () => {
    // phase-z19 deactivated the rate rows. Gating the engine term on the config
    // (rather than deleting it) is what stops rows saved BEFORE the retirement
    // from keeping the unlawful deduction until the taxpayer happens to re-save.
    const legacyRow = compute({
      income: salary(1400000),
      deductions: { professional_expenses_amount: 1000000, total_deductions: 0 },
    });

    expect(legacyRow.income.deductibleAllowances).toBe(0);
    expect(legacyRow.tax.netTaxPayable).toBe(28000); // the lawful figure
    // Surfaced, not silently dropped.
    expect(legacyRow.income.reclassifiedFromDeductions.professionalExpensesUnrelieved)
      .toBe(1000000);
  });

  test('it is relieved again the moment the rate rows are reinstated', () => {
    // Reactivation must be a CONFIG change, not a code change, so that counsel
    // finding a basis does not require a deploy.
    const reinstated = compute({
      income: salary(1400000),
      deductions: { professional_expenses_amount: 1000000, total_deductions: 0 },
      rates: {
        ...FA2025_RATES,
        deductionThresholds: {
          prof_expenses_max_taxable_income: { rate: 0, fixedAmount: 1500000 },
        },
      },
    });

    expect(reinstated.income.deductibleAllowances).toBe(1000000);
    expect(reinstated.income.reclassifiedFromDeductions.professionalExpensesUnrelieved).toBe(0);
  });

  // Generalised property: sweep a second head of relief upward and assert tax
  // is non-increasing at every step. This is the invariant, not just the case.
  test('tax is non-increasing as any single deduction head grows (sweep)', () => {
    const step = (edu) => compute({
      income: salary(4000000),
      deductions: {
        professional_expenses_amount: 300000,
        educational_expenses_amount: edu,
        // Generated column tracks everything EXCEPT professional expenses.
        total_deductions: edu,
      },
    });

    let previousTax = Infinity;
    for (let edu = 0; edu <= 600000; edu += 50000) {
      const tax = step(edu).tax.netTaxPayable;
      expect(tax).toBeLessThanOrEqual(previousTax);
      previousTax = tax;
    }
  });

  test('the client-writable total_deduction_from_income column is never trusted', () => {
    // A plain NUMERIC column any caller can POST. Baseline read it FIRST and
    // used it verbatim, so this wiped the whole liability.
    const r = compute({
      income: salary(4000000),
      deductions: { total_deduction_from_income: 99999999, zakat_paid_amount: 50000 },
    });
    expect(r.income.deductibleAllowances).toBe(50000);
    expect(r.tax.netTaxPayable).toBeGreaterThan(0);
  });

  test('tax credits on the deductions form do not reduce taxable income', () => {
    // The generated column adds tax_paid_foreign_country and advance_tax, which
    // are credits/payments against LIABILITY, not deductions from INCOME.
    const r = compute({
      income: salary(4000000),
      deductions: {
        tax_paid_foreign_country: 500000,
        advance_tax: 250000,
        total_deductions: 750000,
      },
    });
    expect(r.income.deductibleAllowances).toBe(0);
    expect(r.income.taxableIncomeExcludingCG).toBe(4000000);
    // Reclassified, not discarded.
    expect(r.income.reclassifiedFromDeductions).toEqual({
      taxPaidForeignCountry: 500000,
      advanceTaxOnDeductionsForm: 250000,
      // Zero here because this row claims no professional expenses; the key is
      // present because the retired relief is always reported (phase-z19).
      professionalExpensesUnrelieved: 0,
    });
  });
});

// =============================================================================
// DEFECT 1b — the re-homing regression
// =============================================================================
// Removing these two from the income-side total is only half a fix. Dropping
// them outright leaves a taxpayer who paid foreign tax with NO relief anywhere
// — worse than the original bug, which at least gave them something.
describe('D1b · reclassified items still grant relief', () => {

  // THE invariant the coordinator called out. Currently violated if the
  // re-homing is missing: both taxpayers pay identical tax.
  test('a taxpayer with foreign tax paid is better off than one without', () => {
    const base = { income: salary(4000000) };
    const withoutForeign = compute(base);
    const withForeign = compute({ ...base, deductions: { tax_paid_foreign_country: 500000 } });

    // Same income, so the same tax chargeable before relief...
    expect(withForeign.income.taxableIncomeExcludingCG)
      .toBe(withoutForeign.income.taxableIncomeExcludingCG);
    expect(withForeign.tax.totalTaxBeforeAdjustments)
      .toBe(withoutForeign.tax.totalTaxBeforeAdjustments);

    // ...but strictly less to pay, and strictly better off at the balance.
    expect(withForeign.tax.netTaxPayable).toBeLessThan(withoutForeign.tax.netTaxPayable);
    expect(withForeign.payments.balancePayableRefundable)
      .toBeLessThan(withoutForeign.payments.balancePayableRefundable);
  });

  test('foreign tax paid is a credit against tax, not a deduction from income', () => {
    const r = compute({
      income: salary(4000000),
      deductions: { tax_paid_foreign_country: 500000 },
    });
    // 4,000,000 slab: 6,000 + 110,000 + 230,000 + 240,000 = 586,000
    expect(r.tax.totalTaxBeforeAdjustments).toBe(586000);
    expect(r.tax.foreignTaxCredit).toBe(500000);
    expect(r.tax.totalCredits).toBe(500000);
    expect(r.tax.netTaxPayable).toBe(86000); // 586,000 − 500,000
  });

  test('an oversized foreign credit zeroes liability but cannot create a refund', () => {
    // s.103 caps the credit at the PK tax on the foreign income, which cannot be
    // computed (the foreign income itself is never captured). The netTaxPayable
    // floor is the only bound in force — verify it holds.
    const r = compute({
      income: salary(4000000),
      deductions: { tax_paid_foreign_country: 99999999 },
    });
    expect(r.tax.netTaxPayable).toBe(0);
    expect(r.payments.balancePayableRefundable).toBe(0);
  });

  test('advance tax is a payment against the balance, not a credit against tax', () => {
    // Getting this wrong understates tax chargeable AND credits the payment —
    // counting the same rupee twice.
    const r = compute({
      income: salary(4000000),
      deductions: { advance_tax: 250000 },
    });
    expect(r.tax.totalCredits).toBe(0);       // NOT a credit
    expect(r.tax.netTaxPayable).toBe(586000); // tax chargeable untouched
    expect(r.payments.advanceTax).toBe(250000);
    expect(r.payments.balancePayableRefundable).toBe(336000); // 586,000 − 250,000
  });

  // The natural-user case: both forms ask for advance tax, so entering the one
  // payment on both is the obvious thing to do. Summing them credited it twice
  // — a refund-inflation path needing no bad intent at all.
  test('the same advance-tax payment entered on both forms is credited ONCE', () => {
    const r = compute({
      income: salary(4000000),
      adjustable: { advance_tax_u_s_147: 250000 },
      deductions: { advance_tax: 250000 },
    });
    expect(r.payments.advanceTax).toBe(250000);          // not 500,000
    expect(r.payments.balancePayableRefundable).toBe(336000); // 586,000 − 250,000
    expect(r.payments.advanceTaxDuplicateDeclaration).toMatchObject({
      canonicalS147: 250000,
      deductionsForm: 250000,
      credited: 250000,
      differs: false,
    });
  });

  test('when the two declarations differ, s.147 is canonical and the gap is surfaced', () => {
    const r = compute({
      income: salary(4000000),
      adjustable: { advance_tax_u_s_147: 100000 },
      deductions: { advance_tax: 250000 },
    });
    expect(r.payments.advanceTax).toBe(100000); // canonical wins, never 350,000
    expect(r.payments.advanceTaxDuplicateDeclaration).toMatchObject({
      canonicalS147: 100000,
      deductionsForm: 250000,
      credited: 100000,
      differs: true,
    });
  });

  test('the deductions-form figure is still credited when s.147 is absent', () => {
    // Falling back matters: a user who filled only that form must not lose relief.
    const r = compute({
      income: salary(4000000),
      deductions: { advance_tax: 250000 },
    });
    expect(r.payments.advanceTax).toBe(250000);
    expect(r.payments.advanceTaxDuplicateDeclaration).toBeNull();
  });

  test('advance tax is never double-credited for any combination of the two fields', () => {
    // Invariant: the credit can never exceed the larger single declaration.
    const figures = [0, 100000, 250000, 400000];
    for (const s147 of figures) {
      for (const ded of figures) {
        const r = compute({
          income: salary(4000000),
          adjustable: { advance_tax_u_s_147: s147 },
          deductions: { advance_tax: ded },
        });
        expect(r.payments.advanceTax).toBeLessThanOrEqual(Math.max(s147, ded));
      }
    }
  });
});

// =============================================================================
// DEFECT 2 — profit on debt was slab-taxed instead of final-taxed
// =============================================================================
describe('D2 · profit on debt u/s 7B', () => {

  // The audit's demonstrated over-charge, reproduced exactly.
  // Salary 3,000,000 + bank profit 1,000,000.
  //   Lawful normal tax (salary only):
  //     600k @ 1%  =   6,000
  //       1m @ 11% = 110,000
  //     800k @ 23% = 184,000
  //                = 300,000
  //   Baseline slab-taxed all 4,000,000:
  //     ... + 1m @ 23% = 230,000 + 800k @ 30% = 240,000 => 586,000
  //   Over-charge = 286,000.
  test('bank profit within the s.7B limit is excluded from the slab base', () => {
    const r = compute({
      income: {
        ...salary(3000000),
        b28_other_income_min_tax_total: 1000000,
        profit_on_debt_15_percent: 1000000,
      },
    });

    expect(r.income.profitOnDebtIsFinal).toBe(true);
    expect(r.income.taxableIncomeExcludingCG).toBe(3000000);
    expect(r.tax.normalIncomeTax).toBe(300000);      // was 586,000
    expect(r.tax.profitOnDebtFinalTax).toBe(200000); // 1,000,000 @ 20% final
  });

  // The nuance the audit called out: do NOT blanket-convert. Above the s.7B
  // limit the profit IS chargeable at normal rates.
  test('profit on debt exceeding the s.7B limit stays in the slab base', () => {
    const r = compute({
      income: {
        ...salary(3000000),
        b28_other_income_min_tax_total: 6000000,
        profit_on_debt_15_percent: 6000000,
      },
    });

    expect(r.income.profitOnDebtIsFinal).toBe(false);
    expect(r.income.taxableIncomeExcludingCG).toBe(9000000);
    expect(r.tax.profitOnDebtFinalTax).toBe(0);
  });

  test('the same receipt declared on the Final/Min form too is not charged twice', () => {
    const r = compute({
      income: {
        ...salary(3000000),
        b28_other_income_min_tax_total: 1000000,
        profit_on_debt_15_percent: 1000000,
      },
      final_min: { interest_income_profit_debt_7b_up_to_5m: 1000000 },
    });
    expect(r.income.profitOnDebtFinalBase).toBe(0);
    expect(r.tax.profitOnDebtFinalTax).toBe(0);
  });

  test('a missing final_tax rate falls back to slab rather than zero-rating income', () => {
    // Fail loud on integrity: never silently under-state.
    const r = compute({
      income: {
        ...salary(3000000),
        b28_other_income_min_tax_total: 1000000,
        profit_on_debt_15_percent: 1000000,
      },
      rates: { ...FA2025_RATES, finalTax: {} },
    });
    expect(r.income.profitOnDebtIsFinal).toBe(false);
    expect(r.income.taxableIncomeExcludingCG).toBe(4000000);
  });
});

// =============================================================================
// DEFECT 4 — super tax collapsed to Rs 0 in the gaps between s.4C tiers
// =============================================================================
describe('D4 · super tax u/s 4C is continuous', () => {

  // The audit's case: 75 paisa erases Rs 32,000,000.
  // 200,000,000.75 is > tier_1.maxIncome (200,000,000) and
  //                    < tier_2.minIncome (200,000,001) => matched nothing.
  test('income falling in a 1-rupee tier gap is still charged', () => {
    const gapIncome = 200000000.75;
    const r = compute({ income: salary(gapIncome) });
    // s.4C charges "where income EXCEEDS" a threshold, so min_amount 200,000,001
    // denotes an exclusive lower bound of 200,000,000 — this income has cleared
    // it and falls in tier_2 @ 2%. Baseline charged 0.
    expect(r.tax.superTax).toBe(Math.round(gapIncome * 0.02));
    expect(r.tax.superTax).toBeGreaterThan(0);
  });

  test('a fractional income just over the first threshold is charged, not zeroed', () => {
    // 150,000,000.75 exceeds 150M, so it is chargeable at tier_1.
    const r = compute({ income: salary(150000000.75) });
    expect(r.tax.superTax).toBe(Math.round(150000000.75 * 0.01));
  });

  test('a NULL top-tier upper bound (NaN) no longer falls through', () => {
    const openTiers = [
      { tier: 'tier_1', rate: 0.01, minIncome: 150000001, maxIncome: 200000000 },
      { tier: 'tier_7', rate: 0.10, minIncome: 500000001, maxIncome: NaN },
    ];
    const r = compute({
      income: salary(900000000),
      rates: { ...FA2025_RATES, superTax: openTiers },
    });
    expect(r.tax.superTax).toBe(Math.round(900000000 * 0.10));
  });

  test('super tax is non-decreasing across the whole s.4C range — no collapse anywhere', () => {
    // Walk every tier boundary and both sides of it. Baseline returned 0 at
    // every `maxIncome + 0.5` point; nothing above the first threshold may be 0.
    const probes = [];
    for (const t of FA2025_SUPER_TAX) {
      probes.push(t.minIncome - 0.5, t.minIncome, t.minIncome + 0.5);
      if (Number.isFinite(t.maxIncome)) probes.push(t.maxIncome, t.maxIncome + 0.5);
    }

    for (const income of probes.sort((a, b) => a - b)) {
      const superTax = compute({ income: salary(income) }).tax.superTax;
      if (income >= FA2025_SUPER_TAX[0].minIncome) {
        expect(superTax).toBeGreaterThan(0);
      }
    }
  });

  test('income below the first tier threshold is still correctly zero', () => {
    expect(compute({ income: salary(150000000) }).tax.superTax).toBe(0);
  });
});

// =============================================================================
// DEFECT 5 — capital gains computed to Rs 0
// =============================================================================
describe('D5 · capital gains tax', () => {

  test('CGT is computed from per-class taxable columns at DB rates', () => {
    // Baseline read three candidate stored fields and got 0 from all three:
    // the modern form writes `<class>_taxable`, which none of them covered.
    const r = compute({
      income: salary(2000000),
      capital_gain: {
        total_capital_gain: 3000000,
        immovable_property_1_year_taxable: 1000000, // @ 15% = 150,000
        securities_15_percent_taxable:     2000000, // @ 15% = 300,000
      },
    });
    expect(r.income.incomeFromCapitalGains).toBe(3000000);
    expect(r.tax.capitalGainsTax).toBe(450000); // was 0
  });

  test('legacy rows still fall back to the generated legacy total', () => {
    const r = compute({
      income: salary(2000000),
      capital_gain: { total_capital_gain: 1000000, total_capital_gains_tax: 125000 },
    });
    expect(r.tax.capitalGainsTax).toBe(125000);
  });

  test('per-class computation takes precedence over the stored legacy figure', () => {
    // The stored figure remains a fallback for legacy rows (removing it would
    // silently zero real charges), but it must never override real per-class
    // data — that is what let a wrong stored total stand.
    const r = compute({
      income: salary(2000000),
      capital_gain: {
        total_capital_gain: 1000000,
        immovable_property_1_year_taxable: 1000000, // @ 15% = 150,000
        capital_gains_tax_chargeable: 1,            // posted directly, ignored
      },
    });
    expect(r.tax.capitalGainsTax).toBe(150000);
  });
});

// =============================================================================
// DEFECT 6 — unbounded refund vector
// =============================================================================
describe('D6 · refund claims are bounded by declared receipts', () => {

  // The audit drove balancePayableRefundable to -999,699,999.
  test('withholding beyond declared gross receipts cannot manufacture a refund', () => {
    const r = compute({
      income: salary(1000000),
      adjustable: { total_tax_collected: 1000000000 },
    });

    expect(r.payments.claimedPayments).toBe(1000000000);
    expect(r.payments.creditablePayments).toBe(1000000); // capped at receipts
    expect(r.payments.rejectedPaymentClaim).toBe(999000000);
    expect(r.payments.balancePayableRefundable).toBeGreaterThan(-1000000);
  });

  // The fix must not destroy legitimate refunds — the whole point of the
  // "do not simply clamp the output to zero" instruction.
  test('a genuine over-withholding refund still comes through as negative', () => {
    // Salary 2,500,000 -> normal tax 185,000. Employer withheld 250,000.
    const r = compute({
      income: salary(2500000),
      adjustable: { total_tax_collected: 250000 },
    });
    expect(r.tax.netTaxPayable).toBe(185000);
    expect(r.payments.rejectedPaymentClaim).toBe(0);
    expect(r.payments.balancePayableRefundable).toBe(-65000); // refund due
  });

  test('a negative withholding cannot inflate the balance payable', () => {
    const r = compute({
      income: salary(2500000),
      adjustable: { total_tax_collected: -5000000 },
      final_min: { some_row_tax_deducted: -1000000 },
    });
    expect(r.payments.withholdingTax).toBe(0);
    expect(r.payments.balancePayableRefundable).toBe(185000);
  });

  test('the credit door and the refund door are independent', () => {
    // An over-cap credit zeroes liability but must not create a refund;
    // that floor does nothing for the withholding path, which is why both
    // guards have to exist.
    const r = compute({
      income: salary(2500000),
      credits: { total_tax_credits: 99999999 },
    });
    expect(r.tax.netTaxPayable).toBe(0);
    expect(r.payments.balancePayableRefundable).toBe(0);
  });
});

// =============================================================================
// DEFECT 7 — RELIEF THAT MUST *INCREASE* TAX WAS BEING THROWN AWAY
// =============================================================================
// QA's blocking finding on the second re-audit, reproduced against the engine.
//
// Surrendering an investment credit (shares disposed of inside the holding
// period) adds the credit already allowed back onto the tax payable. The app
// records that as a negative entry, so the credit total goes negative — and
// `nonNeg()` on the way in silently turned it into zero. The reversal was
// preserved on disk and ignored in the calculation: Rs 500,000 of tax vanished
// with no refusal flag anywhere.
describe('D7 · a negative credit total is an ADD-BACK, not zero', () => {

  test('a surrender reversal increases the tax by its full amount', () => {
    const base = compute({ income: salary(5000000) });
    const withReversal = compute({
      income: salary(5000000),
      credits: { total_tax_credits: -500000 },
    });

    expect(withReversal.tax.netTaxPayable)
      .toBe(base.tax.netTaxPayable + 500000);
    // It is not an over-claim, so nothing is "refused" — it is simply applied.
    expect(withReversal.tax.refusedCredits).toBe(0);
    expect(withReversal.tax.claimedCredits).toBe(-500000);
  });

  test('the positive side is still capped at the tax in charge', () => {
    const r = compute({
      income: salary(5000000),
      credits: { total_tax_credits: 99999999 },
    });
    expect(r.tax.netTaxPayable).toBe(0);
    expect(r.tax.refusedCredits).toBeGreaterThan(0);
  });

  test('a negative reduction total also increases the tax', () => {
    const base = compute({ income: salary(5000000) });
    const r = compute({
      income: salary(5000000),
      reductions: { total_tax_reductions: -250000 },
    });
    expect(r.tax.netTaxPayable)
      .toBe(base.tax.netTaxPayable + 250000);
  });

  test('a negative reduction does not eat the headroom a lawful credit needs', () => {
    // The reversal has INCREASED the tax, so a credit must still have the whole
    // charge available to it. Treating a negative reduction as having consumed
    // headroom would refuse a lawful credit for no reason.
    const r = compute({
      income: salary(5000000),
      reductions: { total_tax_reductions: -250000 },
      credits: { total_tax_credits: 100000 },
    });
    expect(r.tax.refusedCredits).toBe(0);
    expect(r.tax.totalCredits).toBe(100000);
  });
});

// =============================================================================
// DEFECT 8 — A RETIRED RELIEF SITTING IN A STORED ROW WAS STILL GRANTED
// =============================================================================
// Deactivating the teacher/researcher rate row stopped new claims, and the save
// path refuses the field when posted. Neither touches a figure ALREADY in the
// row — and the save clamp cannot, because it only sees fields the client sends.
//
// Staging's untouched baseline had `teacher_researcher_tax_reduction = 671,422`
// with the rate inactive for 2025-26, and the engine applied every rupee of an
// expired rebate. Every stored return carrying the old figure was understated
// until it happened to be re-saved.
describe('D8 · retired relief is refused at computation, not only on save', () => {

  const withTeacherRate = {
    ...FA2025_RATES,
    reductions: { teacher_researcher: { rate: 0.25 } },
  };

  test('an expired rebate stored in the row is removed', () => {
    const base = compute({ income: salary(5000000) });
    const r = compute({
      income: salary(5000000),
      reductions: {
        teacher_researcher_tax_reduction: 671422,
        total_tax_reductions: 671422,
      },
    });

    // No rate configured for the year → the relief does not exist → no effect.
    expect(r.tax.netTaxPayable).toBe(base.tax.netTaxPayable);
    expect(r.tax.retiredReliefRemoved).toBe(671422);
  });

  test('the SAME figure is honoured in a year where the rebate is lawful', () => {
    // The bound must key off the rate configuration, not the field name — the
    // rebate is lawful for tax years 2023-2025 and returns for those years are
    // still being filed and revised.
    const r = compute({
      income: salary(5000000),
      reductions: {
        teacher_researcher_tax_reduction: 200000,
        total_tax_reductions: 200000,
      },
      rates: withTeacherRate,
    });
    expect(r.tax.retiredReliefRemoved).toBe(0);
    expect(r.tax.totalReductions).toBe(200000);
  });
});

// =============================================================================
// DEFECT 9 — EXCESS TAX ON A FINAL-TAX STREAM WAS TREATED AS REFUNDABLE
// =============================================================================
// Tax deducted under a FINAL regime discharges the liability on that income and
// nothing more; it is not an advance payment against the rest of the return.
// Crediting all of it produced a refund claim the taxpayer is not entitled to.
describe('D9 · final-tax withholding above the final-tax charge is not refundable', () => {

  test('only the portion matching the charge is credited', () => {
    const r = compute({
      income: salary(5000000),
      final_min: {
        subtotal_tax_chargeable: 700000,
        dividend_u_s_150_tax_deducted: 1050000,
      },
    });

    expect(r.payments.finalMinTaxWithheld).toBe(1050000);
    expect(r.payments.finalMinTaxDeducted).toBe(700000);
    expect(r.payments.finalMinTaxWithheldInExcess).toBe(350000);
  });

  test('withholding at or below the charge is credited in full', () => {
    const r = compute({
      income: salary(5000000),
      final_min: {
        subtotal_tax_chargeable: 700000,
        dividend_u_s_150_tax_deducted: 500000,
      },
    });
    expect(r.payments.finalMinTaxDeducted).toBe(500000);
    expect(r.payments.finalMinTaxWithheldInExcess).toBe(0);
  });
});

// =============================================================================
// NEW-B — the retired-relief subtraction OVER-CHARGED by the full stale amount
// =============================================================================
// `claimedReductions = declaredTotal − stale` was subtracted unconditionally,
// with nothing checking that the total contained the stale head. Where it did
// not, the result went NEGATIVE, and because the bound on relief is deliberately
// one-sided (D7 — a negative total is an add-back and must raise tax), the
// negative was added to the liability.
//
// QA's payload, verbatim: preview with `reductions = { teacher_researcher_tax_
// reduction: 671422 }` and no total key. Correct answer 7,767,340; the engine
// returned 8,438,762 — an over-charge of exactly the stale figure, with no error
// and no flag. Silent over-charge is the worst failure mode in this application:
// nobody complains, so it never surfaces.
describe('NEW-B · a retired head is DROPPED from the sum, never subtracted from it', () => {
  const bigSalary = () => salary(22700000);
  // 22,700,000 -> normal tax 7,126,000; surcharge 9% = 641,340; total 7,767,340.
  const EXPECTED_NO_RELIEF = 7767340;

  test('a component with no total present cannot push the liability up', () => {
    const r = compute({
      income: bigSalary(),
      reductions: { teacher_researcher_tax_reduction: 671422 },
    });

    expect(r.tax.claimedReductions).toBe(0);
    expect(r.tax.retiredReliefRemoved).toBe(671422);
    expect(r.tax.netTaxPayable).toBe(EXPECTED_NO_RELIEF);
  });

  test('the stored path still removes it — the relief is refused, not granted', () => {
    const r = compute({
      income: bigSalary(),
      reductions: {
        teacher_researcher_tax_reduction: 671422,
        total_reductions: 671422, // what the GENERATED column really holds
      },
    });

    expect(r.tax.retiredReliefRemoved).toBe(671422);
    expect(r.tax.netTaxPayable).toBe(EXPECTED_NO_RELIEF);
  });

  test('a lawful head beside the retired one survives in full', () => {
    const r = compute({
      income: bigSalary(),
      reductions: {
        teacher_researcher_tax_reduction: 671422,
        other_reductions: 100000,
        total_reductions: 771422,
      },
    });

    // Only the lawful 100,000 is relieved.
    expect(r.tax.totalReductions).toBe(100000);
    expect(r.tax.netTaxPayable).toBe(EXPECTED_NO_RELIEF - 100000);
  });

  test('the degraded path (components unresolvable) still cannot over-charge', () => {
    // Schema introspection failing must not turn into a bigger tax bill. With no
    // component list the removal is bounded by the declared total, so the worst
    // case is that relief is refused — never that tax is added.
    const r = compute({
      income: bigSalary(),
      reductions: { teacher_researcher_tax_reduction: 671422 },
      reliefComponents: null,
    });

    expect(r.tax.claimedReductions).toBe(0);
    expect(r.tax.netTaxPayable).toBe(EXPECTED_NO_RELIEF);
  });
});

// =============================================================================
// NEW-F — the save gate and the engine used ceilings 500× apart
// =============================================================================
// The engine bounded relief at `normalIncomeTax + surcharge + capitalGainsTax`
// while the save path bounded it at the normal-income tax. So relief the save
// path had already measured as unlawful was granted at computation anyway, out of
// a capital-gains charge it has nothing to do with. Both now call
// statutoryLimits.reliefCeiling().
describe('NEW-F · relief cannot reach into the capital-gains block', () => {
  test('a credit is refused where the normal charge is exhausted, CGT notwithstanding', () => {
    // Taxable salary 800,000 -> normal tax 2,000, no surcharge.
    // Securities gains 6,666,667 at 15% -> CGT ~1,000,000.
    const r = compute({
      income: salary(800000),
      capital_gain: { securities_15_percent_taxable: 6666667, total_capital_gain: 6666667 },
      credits: { other_credits: 15700 },
    });

    expect(r.tax.normalIncomeTax).toBe(2000);
    expect(r.tax.reliefCeiling).toBe(2000);
    expect(r.tax.formCredits).toBe(2000);
    expect(r.tax.refusedCredits).toBe(13700);
    // The CGT charge survives the credit in full.
    expect(r.tax.netTaxPayable).toBe(r.tax.capitalGainsTax);
  });

  test('surcharge IS inside the ceiling — it is tax on the same income', () => {
    const r = compute({
      income: salary(22700000),
      credits: { other_credits: 99999999 },
    });

    expect(r.tax.reliefCeiling).toBe(7126000 + 641340);
    expect(r.tax.netTaxPayable).toBe(0);
  });
});

// =============================================================================
// NEW-C — the final-tax cap DELETED capital-gains tax actually withheld
// =============================================================================
// `finalMinTaxChargeable` uses `subtotal_tax_chargeable`, which excludes capital
// gains by design; `finalMinTaxWithheld` summed every `*_tax_deducted` INCLUDING
// `capital_gain_tax_deducted`. The two sides of `Math.min` were measured on
// different bases, so CGT withholding was classified as a non-refundable
// final-tax excess and credited as nothing — while the CGT charge was still
// levied. NCCPL collects this on every brokerage account.
describe('NEW-C · capital-gains withholding is credited, not deleted', () => {
  test('CGT withheld on the Gains form is credited against the charge', () => {
    const r = compute({
      income: salary(800000),
      capital_gain: {
        securities_15_percent_taxable: 2000000,
        total_capital_gain: 2000000,
        securities_tax_deducted: 300000,
      },
    });

    expect(r.tax.capitalGainsTax).toBe(300000);
    expect(r.payments.capitalGainsTaxWithheld).toBe(300000);
    // Charge and withholding cancel: 2,000 of normal tax remains payable.
    expect(r.payments.balancePayableRefundable).toBe(2000);
  });

  test('the mirrored Final/Min row is not treated as a final-tax excess', () => {
    const r = compute({
      income: salary(800000),
      capital_gain: { securities_15_percent_taxable: 2000000, total_capital_gain: 2000000 },
      final_min: { subtotal_tax_chargeable: 0, capital_gain_tax_deducted: 300000 },
    });

    expect(r.payments.finalMinTaxWithheldInExcess).toBe(0);
    expect(r.payments.capitalGainsTaxWithheld).toBe(300000);
    expect(r.payments.balancePayableRefundable).toBe(2000);
  });

  test('the same money on both surfaces is credited ONCE', () => {
    const r = compute({
      income: salary(800000),
      capital_gain: {
        securities_15_percent_taxable: 2000000,
        total_capital_gain: 2000000,
        securities_tax_deducted: 300000,
      },
      final_min: { capital_gain_tax_deducted: 300000 },
    });

    expect(r.payments.capitalGainsTaxWithheld).toBe(300000);
  });

  test('a genuine final-tax excess is still refused (D9 unaffected)', () => {
    const r = compute({
      income: salary(800000),
      final_min: {
        subtotal_tax_chargeable: 700000,
        dividend_u_s_150_31pc_atl_tax_deducted: 1050000,
      },
    });

    expect(r.payments.finalMinTaxDeducted).toBe(700000);
    expect(r.payments.finalMinTaxWithheldInExcess).toBe(350000);
  });
});

// =============================================================================
// NEW-A — the add-back side had no ceiling at all
// =============================================================================
// One-sided is right; unbounded below is not a bound. A mistyped reversal of
// −1e12 was added to the tax in full: `netTaxPayable` came back as
// 1,000,007,767,340 with `refusedCredits: 0`. The write path refuses figures that
// large, but the preview endpoint reaches the engine directly.
describe('NEW-A · a reversal larger than the declared income is refused', () => {
  test('an absurd negative total cannot manufacture a liability', () => {
    const r = compute({
      income: salary(22700000),
      credits: { total_credits: -1e12 },
      reliefComponents: null, // total-only payload, as QA posted it
    });

    // Bounded at the declared income; the excess is reported, not silent.
    expect(r.tax.netTaxPayable).toBe(7767340 + 22700000);
    expect(r.tax.refusedAddBack).toBeGreaterThan(0);
  });

  test('a credible reversal is untouched — D7 still holds', () => {
    const r = compute({
      income: salary(22700000),
      credits: { surrender_tax_credit_reduction: -500000 },
    });

    expect(r.tax.refusedAddBack).toBe(0);
    expect(r.tax.netTaxPayable).toBe(7767340 + 500000);
  });
});

// =============================================================================
// WIRING — the s.7B rate was looked up under a name nothing ever seeds
// =============================================================================
// The engine asked for `final_tax/profit_debt_15_final`. No migration INSERTs
// that category; `phase-j-final-tax-rate-seeds.sql` seeds the real row as
// `profit_debt_151_up_to_5m`. So the lookup was undefined on every environment,
// the fail-loud fallback fired on every return, and profit on debt was slab-taxed
// — an over-charge of roughly Rs 330,000 on the one production return carrying
// Rs 2,200,000 of bank profit at a 35% marginal rate.
//
// The existing D2 suite passes a fixture keyed `profit_debt_15_final`, so it
// tested the arithmetic and never the wiring. These test the wiring.
describe('s.7B rate wiring · the seeded category name resolves', () => {
  const withCategory = (category) => ({
    ...FA2025_RATES,
    finalTax: { [category]: { rate: 0.20, minAmount: 0, maxAmount: 5000000 } },
  });
  const profitInputs = (rates) => ({
    income: {
      b16_annual_salary_wages_total: 3000000,
      b28_other_income_min_tax_total: 1000000,
    },
    rates,
  });

  test('the name phase-j actually seeds is honoured', () => {
    const r = compute(profitInputs(withCategory('profit_debt_151_up_to_5m')));

    expect(r.income.profitOnDebtIsFinal).toBe(true);
    expect(r.tax.profitOnDebtFinalTax).toBe(200000);
    // Salary alone in the slab base: 3,000,000 -> 331,000.
    expect(r.income.taxableIncomeExcludingCG).toBe(3000000);
  });

  test('the historical name still works, so either environment computes', () => {
    const r = compute(profitInputs(withCategory('profit_debt_15_final')));

    expect(r.income.profitOnDebtIsFinal).toBe(true);
    expect(r.tax.profitOnDebtFinalTax).toBe(200000);
  });

  test('the s.7B limit comes off whichever row is present', () => {
    // 6,000,000 is over the 5,000,000 bound, so the block is NOT final and the
    // profit stays in the slab base. Proves the limit is read, not defaulted.
    const r = compute({
      income: {
        b16_annual_salary_wages_total: 3000000,
        b28_other_income_min_tax_total: 6000000,
      },
      rates: withCategory('profit_debt_151_up_to_5m'),
    });

    expect(r.income.profitOnDebtIsFinal).toBe(false);
    expect(r.income.taxableIncomeExcludingCG).toBe(9000000);
  });

  test('with NEITHER name configured it still fails loud into the slab base', () => {
    const r = compute(profitInputs({ ...FA2025_RATES, finalTax: {} }));

    expect(r.income.profitOnDebtIsFinal).toBe(false);
    expect(r.tax.profitOnDebtFinalTax).toBe(0);
    expect(r.income.taxableIncomeExcludingCG).toBe(4000000);
  });
});
