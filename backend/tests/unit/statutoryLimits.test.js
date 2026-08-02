/**
 * statutoryLimits — the pure statutory rules.
 *
 * Every case here is drawn from PM-FINAL-AUDIT (2026-08-02) §5, §8 and §12.
 * The rate bundle is a fixture with the same shape TaxRateService.getAllRates
 * returns, seeded with the real 2025-26 values from
 * `phase-b-rate-tables-and-seed.sql` — no rate is hardcoded in the source under
 * test, so changing a fixture value here changes the expected answer, which is
 * exactly the property we want.
 */

jest.mock('../../src/config/database', () => ({ pool: { query: jest.fn() } }));
jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const {
  capDonationU61,
  capPensionU63,
  capEducationU60D,
  capProfessionalU60C,
  behboodReliefCl6,
  superTaxU4C,
  bindRates,
} = require('../../src/helpers/statutoryLimits');

const RATES = {
  creditCaps: {
    donation_u61: { rate: 0.3, fixedAmount: 0 },
    donation_u61_associate: { rate: 0.15, fixedAmount: 0 },
    pension_u63: { rate: 0.2, fixedAmount: 0 },
  },
  deductionThresholds: {
    prof_expenses_max_taxable_income: { rate: 0, fixedAmount: 1500000 },
    prof_expenses_pos_amount_pct: { rate: 0.05, fixedAmount: 0 },
    prof_expenses_taxable_income_pct: { rate: 0.25, fixedAmount: 0 },
    education_max_taxable_income: { rate: 0, fixedAmount: 1500000 },
    education_per_child_cap: { rate: 0, fixedAmount: 60000 },
    education_max_children: { rate: 0, fixedAmount: 2 },
  },
  reductions: {
    behbood_certificate_max_rate: { rate: 0.05, fixedAmount: 0 },
  },
  // Seeded exactly as phase-b does: min_amount is the integer-rupee spelling of
  // "where income exceeds X", which is what created the gaps.
  superTax: [
    { tier: 'tier_1', rate: 0.01, minIncome: 150000001, maxIncome: 200000000 },
    { tier: 'tier_2', rate: 0.02, minIncome: 200000001, maxIncome: 250000000 },
    { tier: 'tier_3', rate: 0.03, minIncome: 250000001, maxIncome: 300000000 },
    { tier: 'tier_4', rate: 0.04, minIncome: 300000001, maxIncome: 350000000 },
    { tier: 'tier_5', rate: 0.06, minIncome: 350000001, maxIncome: 400000000 },
    { tier: 'tier_6', rate: 0.08, minIncome: 400000001, maxIncome: 500000000 },
    { tier: 'tier_7', rate: 0.1, minIncome: 500000001, maxIncome: 999999999999 },
  ],
};

describe('s.61 — charitable donation cap', () => {
  test('30% of taxable income, 15% to an associate', () => {
    expect(capDonationU61(1000000, false, RATES)).toBe(300000);
    expect(capDonationU61(1000000, true, RATES)).toBe(150000);
  });

  test('nil income → nil cap, and negative income cannot invert it', () => {
    expect(capDonationU61(0, false, RATES)).toBe(0);
    expect(capDonationU61(-5000000, false, RATES)).toBe(0);
  });

  test('throws rather than defaulting when the rate is not configured', () => {
    expect(() => capDonationU61(1000000, false, { creditCaps: {} })).toThrow(
      /donation_u61.*not configured/
    );
  });
});

describe('s.63 — pension contribution cap', () => {
  test('20% of taxable income', () => {
    expect(capPensionU63(1000000, RATES)).toBe(200000);
  });
});

describe('s.60D — education expense allowance', () => {
  // AUDIT §5 case 2: edu 5,000,000 claimed for 2 children. Lawful 120,000.
  test('2 children → Rs 120,000, not the Rs 5,000,000 that was claimed', () => {
    expect(capEducationU60D(1400000, 2, RATES)).toBe(120000);
  });

  // AUDIT §5 case 3a: children_count=1 stored fine and 5,000,000 was deducted.
  test('1 child → Rs 60,000', () => {
    expect(capEducationU60D(1400000, 1, RATES)).toBe(60000);
  });

  test('children are capped at 2 regardless of what is claimed', () => {
    expect(capEducationU60D(1400000, 9, RATES)).toBe(120000);
    expect(capEducationU60D(1400000, -3, RATES)).toBe(0);
    expect(capEducationU60D(1400000, 1.9, RATES)).toBe(60000); // truncated, not rounded
  });

  // AUDIT §5 case 4b/4c + D4: the statute says "less than", the app used <=,
  // and above the threshold there was no server gate at all.
  test('eligibility is strictly LESS THAN the threshold', () => {
    expect(capEducationU60D(1499999, 2, RATES)).toBe(120000);
    expect(capEducationU60D(1500000, 2, RATES)).toBe(0); // exactly at → NOT eligible
    expect(capEducationU60D(1500001, 2, RATES)).toBe(0);
  });
});

describe('s.60C — professional expenses (POS)', () => {
  // AUDIT §5 case 5: prof 1,000,000 claimed alone. Lawful 50,000.
  test('lower of 5% of POS and 25% of taxable income', () => {
    expect(capProfessionalU60C(1400000, 1000000, RATES)).toBe(50000); // 5% POS binds
    expect(capProfessionalU60C(100000, 1000000, RATES)).toBe(25000); // 25% income binds
  });

  test('eligibility is strictly LESS THAN the threshold', () => {
    expect(capProfessionalU60C(1500000, 1000000, RATES)).toBe(0);
    expect(capProfessionalU60C(1499999, 1000000, RATES)).toBeGreaterThan(0);
  });

  test('no POS amount → no allowance', () => {
    expect(capProfessionalU60C(1400000, 0, RATES)).toBe(0);
  });
});

describe('2nd Sched Pt III cl.6 — Behbood relief', () => {
  // AUDIT §13.1 reference case. The app wrote profit × 5% = 50,000 into the
  // RELIEF field; 50,000 is the CEILING. Correct relief is 226,875.
  test('relief is the tax charged ABOVE the 5% ceiling, at the average rate', () => {
    const profit = 1000000;
    const taxOnProfitAtAvgRate = profit * 0.276875; // 27.6875% average on 11.2M base
    expect(behboodReliefCl6(profit, taxOnProfitAtAvgRate, RATES)).toBe(226875);
  });

  test('is NOT profit × 5%', () => {
    const wrongAnswer = 1000000 * 0.05;
    expect(behboodReliefCl6(1000000, 276875, RATES)).not.toBe(wrongAnswer);
  });

  // AUDIT §8, low-slab direction: taxable 800,000, profit 500,000. The tax
  // attributable to the profit (~1,250) is already under the 25,000 ceiling, so
  // relief is nil. The app granted 25,000 — 12.5× the taxpayer's entire normal
  // tax — and the excess spilled over to erase unrelated CGT.
  test('below the ceiling there is no relief at all', () => {
    expect(behboodReliefCl6(500000, 1250, RATES)).toBe(0);
  });

  test('never negative', () => {
    expect(behboodReliefCl6(500000, 0, RATES)).toBe(0);
  });
});

describe('s.4C — super tax must be continuous', () => {
  test('the threshold itself attracts nothing', () => {
    expect(superTaxU4C(150000000, RATES)).toBe(0);
  });

  test('each tier applies its flat rate to the whole income', () => {
    expect(superTaxU4C(160000000, RATES)).toBe(Math.round(160000000 * 0.01));
    expect(superTaxU4C(220000000, RATES)).toBe(Math.round(220000000 * 0.02));
    expect(superTaxU4C(600000000, RATES)).toBe(Math.round(600000000 * 0.1));
  });

  // AUDIT §12 blocker 7: "75 paisa erases Rs 32,000,000". The old
  // `income >= minIncome && income <= maxIncome` loop matched no bracket in the
  // one-rupee gap between tiers and fell through to `return 0`.
  test.each([
    ['150,000,000.75', 150000000.75, 0.01],
    ['200,000,000.50', 200000000.5, 0.02],
    ['250,000,000.75', 250000000.75, 0.03],
    ['300,000,000.75', 300000000.75, 0.04],
    ['350,000,000.75', 350000000.75, 0.06],
    ['400,000,000.75', 400000000.75, 0.08],
    ['500,000,000.75', 500000000.75, 0.1],
  ])('no tier gap at %s', (_label, income, expectedRate) => {
    expect(superTaxU4C(income, RATES)).toBe(Math.round(income * expectedRate));
  });

  test('the exact 45bb80c defect: 400,000,000.75 no longer produces Rs 0', () => {
    // Old behaviour on this input was literally 0. It is Rs 32,000,000 of tax.
    expect(superTaxU4C(400000000.75, RATES)).toBe(32000000);
    expect(superTaxU4C(400000000.75, RATES)).not.toBe(0);
  });

  test('monotonic across every tier boundary — no income earns less by earning more', () => {
    let previous = 0;
    for (let income = 149999999; income <= 600000000; income += 3333331) {
      const tax = superTaxU4C(income, RATES);
      expect(tax).toBeGreaterThanOrEqual(previous);
      previous = tax;
    }
  });

  test('throws rather than silently returning 0 when brackets are unconfigured', () => {
    expect(() => superTaxU4C(200000000, { superTax: [] })).toThrow(/no super_tax brackets/i);
  });
});

describe('bindRates — the shape other lanes code against', () => {
  test('exposes the six contract functions with the contract signatures', () => {
    const L = bindRates(RATES);
    expect(L.capDonationU61(1000000, false)).toBe(300000);
    expect(L.capPensionU63(1000000)).toBe(200000);
    expect(L.capEducationU60D(1400000, 2)).toBe(120000);
    expect(L.capProfessionalU60C(1400000, 1000000)).toBe(50000);
    expect(L.behboodReliefCl6(1000000, 276875)).toBe(226875);
    expect(L.superTaxU4C(400000000.75)).toBe(32000000);
  });
});

describe('s.60D — the three limbs (phase-z14 made limb (a) storable)', () => {
  test('the allowance is the LEAST of the limbs, not the child limb alone', () => {
    // Limb (a) tuition fee 30,000 vs limb (c) 2 x 60,000 = 120,000.
    expect(capEducationU60D(1400000, 2, 30000, RATES)).toBe(30000);
    // Fee above the child limb → the child limb binds.
    expect(capEducationU60D(1400000, 2, 500000, RATES)).toBe(120000);
  });

  test('an unstated fee does not zero the allowance', () => {
    expect(capEducationU60D(1400000, 2, undefined, RATES)).toBe(120000);
    expect(capEducationU60D(1400000, 2, null, RATES)).toBe(120000);
  });

  test('the two-argument contract signature still works', () => {
    // Other lanes code to capEducationU60D(taxableIncome, children).
    expect(capEducationU60D(1400000, 2, RATES)).toBe(120000);
    expect(capEducationU60D(1500000, 2, RATES)).toBe(0);
  });

  test('limb (b) is SKIPPED, not guessed, while its rate row is unseeded', () => {
    // There is no `education_taxable_income_pct` in tax_rates_config today.
    // Inventing 25% here would be exactly the failure mode the remediation
    // forbids, so the limb simply does not bind yet.
    expect(capEducationU60D(400000, 2, undefined, RATES)).toBe(120000);
  });

  test('seeding the limb (b) rate row makes it bind with no code change', () => {
    const seeded = {
      ...RATES,
      deductionThresholds: {
        ...RATES.deductionThresholds,
        education_taxable_income_pct: { rate: 0.25, fixedAmount: 0 },
      },
    };
    // least of (120,000 children, 25% x 400,000 = 100,000)
    expect(capEducationU60D(400000, 2, undefined, seeded)).toBe(100000);
    // and the fee still competes: least of (30,000, 100,000, 120,000)
    expect(capEducationU60D(400000, 2, 30000, seeded)).toBe(30000);
  });
});
