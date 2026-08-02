/**
 * The three open legal questions, as SETTINGS.
 *
 * phase-z19's FBR research ended with three points that code cannot honestly
 * settle. Rather than shipping a silent answer to each, they became editable
 * `tax_rates_config` values with the conservative reading as the default. The
 * property these tests defend is the one that matters:
 *
 *     A MISSING OR UNANSWERED SETTING MUST NEVER WIDEN A TAXPAYER'S CLAIM.
 *
 * Get that backwards and the app grants relief it cannot cite, which is exactly
 * the defect ("professional expenses u/s 60C") that started this work.
 */

jest.mock('../../src/config/database', () => ({ pool: { query: jest.fn() } }));
jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const {
  capEducationU60D,
  capHousingLoanProfitCredit,
  housingLoanCreditConfigured,
} = require('../../src/helpers/statutoryLimits');

const BASE_THRESHOLDS = {
  education_max_taxable_income: { rate: 0, fixedAmount: 1500000 },
  education_per_child_cap: { rate: 0, fixedAmount: 60000 },
  education_max_children: { rate: 0, fixedAmount: 2 },
};

const ratesWith = (extra = {}) => ({
  deductionThresholds: { ...BASE_THRESHOLDS, ...(extra.deductionThresholds || {}) },
  creditCaps: { ...(extra.creditCaps || {}) },
});

// ───────────────────────────────────────────────────────────────────────────
describe('s.60D(2) threshold operator — "less than" vs "does not exceed"', () => {
  // Sources disagree on the wording. It changes the answer for exactly ONE
  // taxpayer: the one at precisely Rs 1,500,000. Every assertion below is at or
  // adjacent to that single point, because that is the entire disputed area.

  test('with NO setting row, the strict reading applies — the shipped behaviour', () => {
    const rates = ratesWith();
    expect(capEducationU60D(1499999, 1, undefined, rates)).toBe(60000);
    expect(capEducationU60D(1500000, 1, undefined, rates)).toBe(0);
  });

  test('explicitly strict (0) behaves identically to the row being absent', () => {
    const rates = ratesWith({
      deductionThresholds: { education_threshold_inclusive: { rate: 0, fixedAmount: 0 } },
    });
    expect(capEducationU60D(1499999, 1, undefined, rates)).toBe(60000);
    expect(capEducationU60D(1500000, 1, undefined, rates)).toBe(0);
  });

  test('inclusive (1) allows the taxpayer sitting exactly on the threshold', () => {
    const rates = ratesWith({
      deductionThresholds: { education_threshold_inclusive: { rate: 1, fixedAmount: 0 } },
    });
    expect(capEducationU60D(1500000, 1, undefined, rates)).toBe(60000);
  });

  test('neither reading changes anything ABOVE the threshold', () => {
    const strict = ratesWith();
    const inclusive = ratesWith({
      deductionThresholds: { education_threshold_inclusive: { rate: 1, fixedAmount: 0 } },
    });
    expect(capEducationU60D(1500001, 2, undefined, strict)).toBe(0);
    expect(capEducationU60D(1500001, 2, undefined, inclusive)).toBe(0);
  });

  test('a malformed setting value does not silently widen the relief', () => {
    // Only an exact 1 flips the operator. Anything else — a stray string, a
    // truthy-but-wrong number — must fall back to strict rather than being
    // treated as "set, therefore inclusive".
    for (const bad of [{ rate: 'yes' }, { rate: 2 }, { rate: 0.5 }, { rate: null }, {}]) {
      const rates = ratesWith({ deductionThresholds: { education_threshold_inclusive: bad } });
      expect(capEducationU60D(1500000, 1, undefined, rates)).toBe(0);
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('FA-2025 housing-loan profit-on-debt credit — inert until configured', () => {
  // This is the one item that runs AGAINST the taxpayer while unanswered: the
  // app does not offer the credit, so anyone entitled to it over-pays. The
  // mechanism exists; the quantum is the owner's to supply.

  test('not configured → not offered, and reported as not configured', () => {
    const rates = ratesWith();
    expect(housingLoanCreditConfigured(rates)).toBe(false);
    expect(capHousingLoanProfitCredit(5000000, 400000, rates)).toBe(0);
  });

  test('a percentage-of-income ceiling binds', () => {
    const rates = ratesWith({
      creditCaps: { housing_loan_profit_on_debt: { rate: 0.05, fixedAmount: 0 } },
    });
    expect(housingLoanCreditConfigured(rates)).toBe(true);
    // 5% of 5,000,000 = 250,000, which is less than the 400,000 paid.
    expect(capHousingLoanProfitCredit(5000000, 400000, rates)).toBe(250000);
  });

  test('an absolute rupee ceiling binds', () => {
    const rates = ratesWith({
      creditCaps: { housing_loan_profit_on_debt: { rate: 0, fixedAmount: 200000 } },
    });
    expect(capHousingLoanProfitCredit(5000000, 400000, rates)).toBe(200000);
  });

  test('the LEAST of the limbs wins when both ceilings are set', () => {
    const rates = ratesWith({
      creditCaps: { housing_loan_profit_on_debt: { rate: 0.05, fixedAmount: 100000 } },
    });
    // profit 400,000 | 5% of income 250,000 | ceiling 100,000 -> 100,000
    expect(capHousingLoanProfitCredit(5000000, 400000, rates)).toBe(100000);
  });

  test('the profit actually paid is itself a limb — a ceiling never inflates a claim', () => {
    const rates = ratesWith({
      creditCaps: { housing_loan_profit_on_debt: { rate: 0.5, fixedAmount: 2000000 } },
    });
    // Both ceilings are far above the 30,000 actually paid.
    expect(capHousingLoanProfitCredit(5000000, 30000, rates)).toBe(30000);
  });

  test('a zero limb is "switched off", not "a cap of zero"', () => {
    // Reading 0 as a binding ceiling would make a configured relief always
    // refuse, which looks identical to it not being configured at all and would
    // be impossible for an operator to diagnose from the UI.
    const rates = ratesWith({
      creditCaps: { housing_loan_profit_on_debt: { rate: 0, fixedAmount: 0 } },
    });
    expect(capHousingLoanProfitCredit(5000000, 400000, rates)).toBe(400000);
  });

  test('no profit paid → no credit, regardless of configuration', () => {
    const rates = ratesWith({
      creditCaps: { housing_loan_profit_on_debt: { rate: 0.05, fixedAmount: 2000000 } },
    });
    expect(capHousingLoanProfitCredit(5000000, 0, rates)).toBe(0);
    expect(capHousingLoanProfitCredit(5000000, -1, rates)).toBe(0);
    expect(capHousingLoanProfitCredit(5000000, null, rates)).toBe(0);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('the admin catalogue itself', () => {
  // The catalogue is the contract the settings screen renders. These assertions
  // are about honesty of presentation, not arithmetic: a settings page that
  // shows a column name and a number is not a question a tax adviser can answer.
  const { RELIEF_QUESTIONS } = require('../../src/modules/Admin/helpers/reliefQuestions');

  test('all three open questions are surfaced', () => {
    expect(RELIEF_QUESTIONS.map((q) => q.key).sort()).toEqual([
      'education_threshold_operator',
      'housing_loan_profit_credit',
      'professional_expenses_allowance',
    ]);
  });

  test('every question explains itself before asking for a decision', () => {
    for (const q of RELIEF_QUESTIONS) {
      expect(q.question.length).toBeGreaterThan(40);
      expect(q.whyItMatters.length).toBeGreaterThan(60);
      expect(q.background.length).toBeGreaterThan(120);
      expect(q.ifYouChangeIt.length).toBeGreaterThan(60);
      expect(q.citation).toBeTruthy();
      expect(q.rows.length).toBeGreaterThan(0);
    }
  });

  test('every question can be read back from its rows', () => {
    for (const q of RELIEF_QUESTIONS) {
      // A catalogue entry whose readValue throws on absent rows would make the
      // screen unopenable on a fresh tax year.
      expect(() => q.readValue(q.rows.map(() => null))).not.toThrow();
    }
  });

  test('the professional-expenses question moves ALL of its rows together', () => {
    const q = RELIEF_QUESTIONS.find((x) => x.key === 'professional_expenses_allowance');
    // The limit helper needs every one of the three; a half-enabled relief 503s
    // the whole deductions form, which is how the first fix broke the app.
    expect(q.rows).toHaveLength(3);
    expect(q.control).toBe('toggle');
  });

  test('the housing-loan question asks for parameters rather than a yes/no', () => {
    const q = RELIEF_QUESTIONS.find((x) => x.key === 'housing_loan_profit_credit');
    expect(q.control).toBe('params');
    expect(q.fields.map((f) => f.name).sort()).toEqual(['fixed_amount', 'tax_rate']);
  });
});
