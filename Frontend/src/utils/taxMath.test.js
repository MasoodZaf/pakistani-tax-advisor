import {
  progressiveTax,
  averageTaxRate,
  totalIncomeExcludingCG,
  normalTaxBase,
  preAllowanceTaxableIncome,
  behboodReliefCl6,
} from './taxMath';

// FBR 2025-26 salaried slabs, in the shape tax_rates_config serves them
// (min_income seeded as "starts-at", max_income null on the open top slab).
const SLABS_2025_26 = [
  { min_income: 0,       max_income: 600000,  tax_rate: 0 },
  { min_income: 600001,  max_income: 1200000, tax_rate: 0.01 },
  { min_income: 1200001, max_income: 2200000, tax_rate: 0.11 },
  { min_income: 2200001, max_income: 3200000, tax_rate: 0.23 },
  { min_income: 3200001, max_income: 4100000, tax_rate: 0.30 },
  { min_income: 4100001, max_income: null,    tax_rate: 0.35 },
];

const BEHBOOD_MAX_RATE = 0.05; // 2nd Sched Pt III cl.6 ceiling, from the DB

describe('progressiveTax', () => {
  it('matches the FBR worked example at the top slab', () => {
    // 616,000 + 0.35 × (9,700,000 − 4,100,000) = 2,576,000
    expect(progressiveTax(9700000, SLABS_2025_26)).toBe(2576000);
  });

  it('is zero below the exemption limit and at the break-point', () => {
    expect(progressiveTax(600000, SLABS_2025_26)).toBe(0);
    expect(progressiveTax(0, SLABS_2025_26)).toBe(0);
  });

  it('walks brackets, not a flat marginal rate', () => {
    // 1,200,000 → 1% of the 600,000 above the exemption limit.
    expect(progressiveTax(1200000, SLABS_2025_26)).toBe(6000);
  });

  it('returns 0 rather than guessing when rates have not loaded', () => {
    expect(progressiveTax(9700000, [])).toBe(0);
    expect(progressiveTax(9700000, undefined)).toBe(0);
  });

  it('does not depend on the order slabs arrive in', () => {
    const shuffled = [...SLABS_2025_26].reverse();
    expect(progressiveTax(11200000, shuffled)).toBe(progressiveTax(11200000, SLABS_2025_26));
  });
});

describe('averageTaxRate', () => {
  it('is the effective rate, not the marginal rate', () => {
    // 3,101,000 / 11,200,000 = 27.6875% — while the marginal rate is 35%.
    expect(averageTaxRate(11200000, SLABS_2025_26)).toBeCloseTo(0.276875, 10);
  });
});

describe('behboodReliefCl6', () => {
  /**
   * REFERENCE CASE (PM-FINAL-AUDIT §8 / §13.1).
   *
   *   taxable income          11,200,000
   *   Behbood profit           1,000,000  (a component of that base)
   *
   *   tax on 11,200,000     = 616,000 + 0.35 × 7,100,000 = 3,101,000
   *   average rate          = 3,101,000 / 11,200,000     = 27.6875%
   *   tax on the profit     = 1,000,000 × 27.6875%       =   276,875
   *   cl.6 ceiling (5%)     = 1,000,000 × 5%             =    50,000
   *   RELIEF                = 276,875 − 50,000           =   226,875
   *
   * Fails on 45bb80c, which wrote the CEILING (50,000) into the reduction
   * field. Also fails against the QA ticket's marginal-rate figure (300,000).
   */
  it('gives the tax charged in excess of the 5% ceiling, at the AVERAGE rate', () => {
    const { relief, averageRate, taxOnProfit, ceiling } = behboodReliefCl6({
      profit: 1000000,
      taxableIncome: 11200000,
      slabs: SLABS_2025_26,
      maxRate: BEHBOOD_MAX_RATE,
    });

    expect(averageRate).toBeCloseTo(0.276875, 10);
    expect(Math.round(taxOnProfit)).toBe(276875);
    expect(ceiling).toBe(50000);
    expect(relief).toBe(226875);

    // The two figures the fix must NOT produce.
    expect(relief).not.toBe(50000);  // 45bb80c: the ceiling assigned as relief
    expect(relief).not.toBe(300000); // marginal-rate derivation (0.35 − 0.05) × 1M
  });

  /**
   * The over-relief direction, which is the dangerous one.
   *
   *   taxable income   800,000  → tax = 1% × 200,000 = 2,000
   *   Behbood profit   500,000  → average rate 0.25% → tax attributable 1,250
   *   cl.6 ceiling     500,000 × 5% = 25,000
   *
   * 1,250 is already under the ceiling, so NO tax is charged in excess of it
   * and the relief is nil. 45bb80c granted 25,000 — 12.5× the taxpayer's entire
   * normal tax — which then spilled past the normal tax onto unrelated CGT,
   * because reductions are applied against totalTaxBeforeAdjustments.
   */
  it('gives NIL relief when the average rate is already under the ceiling', () => {
    const { relief, taxOnProfit, ceiling } = behboodReliefCl6({
      profit: 500000,
      taxableIncome: 800000,
      slabs: SLABS_2025_26,
      maxRate: BEHBOOD_MAX_RATE,
    });

    expect(Math.round(taxOnProfit)).toBe(1250);
    expect(ceiling).toBe(25000);
    expect(relief).toBe(0);
    expect(relief).not.toBe(25000); // the 45bb80c over-relief
  });

  it('never attributes more tax than was actually charged', () => {
    // Profit declared on this form but not (yet) on the Income form.
    const { relief, applicable } = behboodReliefCl6({
      profit: 1000000,
      taxableIncome: 0,
      slabs: SLABS_2025_26,
      maxRate: BEHBOOD_MAX_RATE,
    });
    expect(relief).toBe(0);
    expect(applicable).toBe(false);
  });

  it('caps the attributable component at the whole taxable base', () => {
    // Base 700,000 (tax 1,000); profit claimed as 5,000,000. Attributing the
    // full profit at the average rate would invent tax that was never charged.
    const { relief, taxOnProfit } = behboodReliefCl6({
      profit: 5000000,
      taxableIncome: 700000,
      slabs: SLABS_2025_26,
      maxRate: BEHBOOD_MAX_RATE,
    });
    expect(taxOnProfit).toBeLessThanOrEqual(progressiveTax(700000, SLABS_2025_26));
    expect(relief).toBe(0);
  });

  it('yields nothing while rates are still loading', () => {
    expect(behboodReliefCl6({ profit: 1000000, taxableIncome: 11200000, slabs: [], maxRate: 0.05 }).relief).toBe(0);
    expect(
      behboodReliefCl6({ profit: 1000000, taxableIncome: 11200000, slabs: SLABS_2025_26, maxRate: undefined }).relief
    ).toBe(0);
  });
});

describe('income bases', () => {
  it('sums the same buckets the tax engine charges the slabs on', () => {
    const ctx = {
      income: {
        total_employment_income: 1400000,
        other_income_min_tax_total: 100000,
        other_income_no_min_tax_total: 200000,
      },
    };
    expect(totalIncomeExcludingCG(ctx)).toBe(1700000);
  });

  it('nets off deductible allowances for the normal-tax base', () => {
    const ctx = {
      income: { total_employment_income: 1700000 },
      deductions: { total_deduction_from_income: 300000 },
    };
    expect(normalTaxBase(ctx)).toBe(1400000);
  });

  it('floors the normal-tax base at zero', () => {
    const ctx = {
      income: { total_employment_income: 100000 },
      deductions: { total_deduction_from_income: 300000 },
    };
    expect(normalTaxBase(ctx)).toBe(0);
  });

  it('falls back to the legacy single-column dialect', () => {
    expect(totalIncomeExcludingCG({ income: { total_taxable_income: 900000 } })).toBe(900000);
  });

  /**
   * Mirrors `preAllowanceTaxableIncome` in the server's limit middleware
   * (backend/src/middleware/validation.js `loadIncomeBases`), which is the base
   * s.60C and s.60D are tested and capped on.
   */
  describe('preAllowanceTaxableIncome', () => {
    const ctx = {
      income: { total_employment_income: 1600000 },
      deductions: {
        zakat_paid_amount: 200000,
        professional_expenses_amount: 300000,
        educational_expenses_amount: 120000,
      },
    };

    it('subtracts the non-gated allowances only', () => {
      // 1,600,000 − 200,000 Zakat. The 60C/60D claims must NOT be subtracted:
      // a taxpayer cannot become eligible for an allowance by claiming it.
      expect(preAllowanceTaxableIncome(ctx)).toBe(1400000);
    });

    it('lets live form values override the saved row', () => {
      expect(preAllowanceTaxableIncome(ctx, { zakat_paid_amount: 0 })).toBe(1600000);
    });

    it('also nets Ushr, foreign tax paid and other deductions', () => {
      expect(
        preAllowanceTaxableIncome({
          income: { total_employment_income: 1600000 },
          deductions: { ushr: 50000, tax_paid_foreign_country: 30000, other_deductions: 20000 },
        })
      ).toBe(1500000);
    });
  });
});
