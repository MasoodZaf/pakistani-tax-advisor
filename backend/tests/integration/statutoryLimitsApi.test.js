/**
 * Statutory limits on the WRITE PATH — raw authenticated POSTs, no UI.
 *
 * This is the regression suite for the finding that failed the QA audit:
 * "no statutory limit in this application is enforced anywhere except in the
 * browser" (PM-FINAL-AUDIT §12). Every test here posts straight to the API the
 * way QA did and asserts on the values that actually reach the INSERT.
 *
 * ALL OF THESE FAIL ON 45bb80c: the credits, reductions and capital-gains
 * routes had no validation attached at all, and the deductions route's only
 * check was `children > 2`.
 *
 * DB and rate service are mocked; the router, middleware and saveFormData are
 * the real code.
 */

const express = require('express');
const request = require('supertest');

// ── DB mock: routes on SQL text, so it does not break when call order shifts ──
let stored; // per-test stored form rows
let captured; // { table, values: {column: value} } of the last INSERT
// First INSERT of the request. tax_computation_forms is written twice now —
// once on the client path (which must carry no client figures) and once by
// the engine populate — so "the client's value never reached the table" has
// to be asserted against the client-path INSERT, not the last one.
let capturedFirst;

const mockQuery = jest.fn(async (sql, params = []) => {
  const s = String(sql);

  // The clamp derives its component set from the GENERATED total's own
  // definition rather than a hand-kept name list (that list going stale is the
  // exact defect being regression-tested here — see F-05). These are the real
  // expressions Postgres reports for the two tables, copied verbatim from
  // phase-t-realign-form-tables.sql, so a parser change that stops handling the
  // real format fails here rather than in production.
  if (/generation_expression/.test(s)) {
    const expr = GENERATED_TOTALS[`${params[0]}.${params[1]}`];
    if (!expr) return { rows: [] };
    return { rows: [{ generation_expression: expr, is_generated: 'ALWAYS' }] };
  }
  if (/information_schema\.columns/.test(s)) {
    // Every key any test posts must be an "allowed column" or saveFormData
    // silently drops it and the assertion would pass for the wrong reason.
    return { rows: ALLOWED_COLUMNS.map((column_name) => ({ column_name })) };
  }
  if (/FROM tax_years/.test(s)) return { rows: [{ id: 'ty-uuid', tax_year: '2025-26' }] };
  if (/INSERT INTO tax_returns/.test(s)) return { rows: [{ id: 'tr-uuid' }] };
  if (/FROM tax_returns/.test(s)) return { rows: [{ id: 'tr-uuid' }] };
  if (/FROM income_forms/.test(s)) return { rows: stored.income ? [stored.income] : [] };
  if (/FROM deductions_forms/.test(s))
    return { rows: stored.deductions ? [stored.deductions] : [] };
  if (/FROM credits_forms/.test(s)) return { rows: stored.credits ? [stored.credits] : [] };
  if (/FROM reductions_forms/.test(s))
    return { rows: stored.reductions ? [stored.reductions] : [] };

  const insert = s.match(/^INSERT INTO (\w+) \(([^)]+)\)/);
  if (insert) {
    const columns = insert[2].split(',').map((c) => c.trim());
    const values = {};
    columns.forEach((c, i) => {
      values[c] = params[i];
    });
    captured = { table: insert[1], values };
    if (!capturedFirst) capturedFirst = captured;
    return { rows: [values] };
  }
  return { rows: [] };
});

// Verbatim from phase-t-realign-form-tables.sql. `total_credits` sums ELEVEN
// components; the pass that failed QA clamped four of them by name, and
// `surrender_tax_credit_reduction` — an ordinary editable input on the shipping
// Credits form — carried Rs 9,000,000 through unclamped into a refund claim.
const GENERATED_TOTALS = {
  'credits_forms.total_credits':
    '(((((COALESCE(charitable_donations_tax_credit, (0)::numeric) '
    + '+ COALESCE(charitable_donations_associate_tax_credit, (0)::numeric)) '
    + '+ COALESCE(pension_fund_tax_credit, (0)::numeric)) '
    + '+ COALESCE(surrender_tax_credit_reduction, (0)::numeric)) '
    + '+ COALESCE(investment_tax_credit, (0)::numeric)) '
    + '+ COALESCE(other_credits, (0)::numeric))',
  'reductions_forms.total_reductions':
    '((((((COALESCE(teacher_researcher_tax_reduction, (0)::numeric) '
    + '+ COALESCE(behbood_certificates_tax_reduction, (0)::numeric)) '
    + '+ COALESCE(capital_gain_immovable_50_reduction, (0)::numeric)) '
    + '+ COALESCE(capital_gain_immovable_75_reduction, (0)::numeric)) '
    + '+ COALESCE(export_income_reduction, (0)::numeric)) '
    + '+ COALESCE(industrial_undertaking_reduction, (0)::numeric)) '
    + '+ COALESCE(other_reductions, (0)::numeric))',
};

// Union of every column the tests touch across the four form tables.
const ALLOWED_COLUMNS = [
  'tax_return_id',
  'user_id',
  'user_email',
  'tax_year_id',
  'tax_year',
  'is_complete',
  'last_updated_by',
  // deductions
  'professional_expenses_amount',
  'educational_expenses_amount',
  'educational_expenses_children_count',
  'educational_expenses_yn',
  'zakat_paid_amount',
  'ushr',
  'tax_paid_foreign_country',
  'advance_tax',
  'other_deductions',
  'total_deduction_from_income',
  // credits
  'charitable_donations_amount',
  'charitable_donations_tax_credit',
  'charitable_donations_associate_amount',
  'charitable_donations_associate_tax_credit',
  'pension_fund_amount',
  'pension_fund_tax_credit',
  'surrender_tax_credit_reduction',
  'other_credits',
  'total_tax_credits',
  // reductions
  'behbood_certificates_amount',
  'behbood_certificates_tax_reduction',
  'teacher_researcher_tax_reduction',
  'total_tax_reductions',
  // capital gains
  'property_1_year',
  'total_capital_gain',
  // deductions — s.60D limb (a), phase-z14
  'tuition_fee_amount',
  // tax computation (client must not be able to write any of these)
  'normal_income_tax',
  'surcharge_amount',
  'capital_gains_tax',
  'tax_reductions',
  'deductible_allowances',
  'final_fixed_tax',
  'income_from_salary',
  // final tax / expenses / wealth
  'dividend_u_s_150_tax_chargeable',
  'total_expenses',
  'rent',
  'some_yn',
  'total_assets',
  'income_exempt_from_tax',
  'increase_decrease_in_assets',
];

jest.mock('../../src/config/database', () => ({ pool: { query: (...a) => mockQuery(...a) } }));

jest.mock('../../src/middleware/auth', () => (req, _res, next) => {
  req.user = { id: '11111111-1111-1111-1111-111111111111', email: 'qa@example.com' };
  next();
});

jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

// Real 2025-26 values from phase-b-rate-tables-and-seed.sql, in the shape
// TaxRateService.getAllRates returns. Mocked so the limit middleware does not
// have to be fed nine separate rate SELECTs.
const RATES = {
  taxYear: '2025-26',
  slabs: [
    { min_income: 0, max_income: 600000, tax_rate: 0, fixed_amount: 0 },
    { min_income: 600001, max_income: 1200000, tax_rate: 0.01, fixed_amount: 0 },
    { min_income: 1200001, max_income: 2200000, tax_rate: 0.11, fixed_amount: 6000 },
    { min_income: 2200001, max_income: 3200000, tax_rate: 0.23, fixed_amount: 116000 },
    { min_income: 3200001, max_income: 4100000, tax_rate: 0.3, fixed_amount: 346000 },
    { min_income: 4100001, max_income: null, tax_rate: 0.35, fixed_amount: 616000 },
  ],
  surcharge: { rate: 0.09, threshold: 10000000 },
  superTax: [{ tier: 'tier_1', rate: 0.01, minIncome: 150000001, maxIncome: 200000000 }],
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
  reductions: { behbood_certificate_max_rate: { rate: 0.05, fixedAmount: 0 } },
  finalTax: {},
  withholding: {},
  capitalGains: {},
};

jest.mock('../../src/services/taxRateService', () => ({
  getAllRates: jest.fn(async () => RATES),
  purgeCache: jest.fn(),
}));

function buildApp() {
  const router = require('../../src/modules/IncomeTax/routes/taxForms');
  const app = express();
  app.use(express.json());
  app.use('/api/tax-forms', router);
  return app;
}

/** Salary that produces a given taxable income once allowances are applied. */
/**
 * `total` is the taxpayer's whole declared income; `nonSalary` is how much of it
 * is NOT salary (profit on debt and the like), with the remainder as salary.
 *
 * The split matters for Behbood/Pensioners' Benefit relief: certificate profit
 * IS profit on debt, so it can only come out of the non-salary bucket. A
 * pure-salary filer has no certificate profit to relieve, and treating total
 * income as the ceiling let one claim relief on salary — see the abuse case at
 * the end of the Behbood block.
 */
function incomeRow(total, nonSalary = 0) {
  return {
    annual_salary_wages_total: String(Math.max(0, total - nonSalary)),
    total_non_cash_benefits: '0',
    other_income_min_tax_total: String(nonSalary),
    other_income_no_min_tax_total: '0',
  };
}

const num = (v) => Number(v);

beforeEach(() => {
  jest.resetModules();
  mockQuery.mockClear();
  captured = undefined;
  capturedFirst = undefined;
  stored = { income: incomeRow(1400000) };
  // Reset any standing rate override a previous test installed.
  require('../../src/services/taxRateService').getAllRates.mockImplementation(async () => RATES);
});

// ───────────────────────────────────────────────────────────────────────────
describe('POST /deductions — s.60D education expense (AUDIT §5)', () => {
  test('case 3a: 5,000,000 claimed for 1 child is stored as 60,000, not 5,000,000', async () => {
    // On 45bb80c this stored 5,000,000 and took a lawful Rs 21,400 liability
    // to Rs 0. children_count=1 passed the only guard that existed.
    const res = await request(buildApp()).post('/api/tax-forms/deductions').send({
      taxYear: '2025-26',
      educational_expenses_amount: 5000000,
      educational_expenses_children_count: 1,
    });

    expect(res.status).toBe(200);
    expect(num(captured.values.educational_expenses_amount)).toBe(60000);
    expect(num(captured.values.total_deduction_from_income)).toBe(60000);
    expect(res.body.statutory_adjustments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'educational_expenses_amount',
          claimed: 5000000,
          allowed: 60000,
        }),
      ])
    );
  });

  test('case 2: 5,000,000 for 2 children is stored as 120,000', async () => {
    const res = await request(buildApp()).post('/api/tax-forms/deductions').send({
      taxYear: '2025-26',
      educational_expenses_amount: 5000000,
      educational_expenses_children_count: 2,
    });

    expect(res.status).toBe(200);
    expect(num(captured.values.educational_expenses_amount)).toBe(120000);
  });

  test('case 4c: salary 1,500,001 gets the allowance zeroed — there was no server gate at all', async () => {
    stored.income = incomeRow(1500001);

    const res = await request(buildApp()).post('/api/tax-forms/deductions').send({
      taxYear: '2025-26',
      educational_expenses_amount: 120000,
      educational_expenses_children_count: 2,
    });

    expect(res.status).toBe(200);
    expect(num(captured.values.educational_expenses_amount)).toBe(0);
  });

  test('D4: eligibility is "less than", so exactly 1,500,000 is not eligible', async () => {
    stored.income = incomeRow(1500000);

    await request(buildApp()).post('/api/tax-forms/deductions').send({
      taxYear: '2025-26',
      educational_expenses_amount: 120000,
      educational_expenses_children_count: 2,
    });

    expect(num(captured.values.educational_expenses_amount)).toBe(0);
  });

  test('D5: the threshold is measured on TAXABLE income, not gross', async () => {
    // Gross 1,600,000, but 250,000 of Zakat brings taxable to 1,350,000. The
    // browser summed gross and wrongly DENIED this taxpayer the allowance.
    stored.income = incomeRow(1600000);

    await request(buildApp()).post('/api/tax-forms/deductions').send({
      taxYear: '2025-26',
      zakat_paid_amount: 250000,
      educational_expenses_amount: 120000,
      educational_expenses_children_count: 2,
    });

    expect(num(captured.values.educational_expenses_amount)).toBe(120000);
  });

  test('the child-count gate still rejects, and its limit now comes from the DB', async () => {
    const res = await request(buildApp()).post('/api/tax-forms/deductions').send({
      taxYear: '2025-26',
      educational_expenses_amount: 180000,
      educational_expenses_children_count: 3,
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/capped at 2 children/);
  });

  test('a negative amount is rejected outright, not clamped', async () => {
    const res = await request(buildApp())
      .post('/api/tax-forms/deductions')
      .send({ taxYear: '2025-26', educational_expenses_amount: -5000000 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });
});

describe('POST /deductions — s.60C professional expenses (AUDIT §5 case 5)', () => {
  test('1,000,000 claimed against a 1,000,000 POS is stored as 50,000', async () => {
    await request(buildApp()).post('/api/tax-forms/deductions').send({
      taxYear: '2025-26',
      professional_expenses_amount: 1000000,
      professional_expenses_pos_amount: 1000000,
    });

    expect(num(captured.values.professional_expenses_amount)).toBe(50000);
  });

  test('with no POS supplied the 25%-of-taxable-income limb still binds', async () => {
    await request(buildApp())
      .post('/api/tax-forms/deductions')
      .send({ taxYear: '2025-26', professional_expenses_amount: 1000000 });

    expect(num(captured.values.professional_expenses_amount)).toBe(350000); // 25% of 1,400,000
  });

  test('D2: the total the engine reads is recomputed, so both allowances count', async () => {
    // AUDIT §5 case 6: adding a second legitimate deduction RAISED the tax,
    // because professional expenses fell out of the total. Non-monotonic.
    await request(buildApp()).post('/api/tax-forms/deductions').send({
      taxYear: '2025-26',
      professional_expenses_amount: 50000,
      professional_expenses_pos_amount: 1000000,
      educational_expenses_amount: 100000,
      educational_expenses_children_count: 2,
    });

    expect(num(captured.values.total_deduction_from_income)).toBe(150000);
  });

  test('an inflated client-supplied total cannot bypass the component caps', async () => {
    // The engine reads total_deduction_from_income FIRST. Clamping the
    // components while trusting this number would leave the hole wide open.
    const res = await request(buildApp()).post('/api/tax-forms/deductions').send({
      taxYear: '2025-26',
      educational_expenses_amount: 60000,
      educational_expenses_children_count: 1,
      total_deduction_from_income: 5000000,
    });

    expect(num(captured.values.total_deduction_from_income)).toBe(60000);
    expect(res.body.statutory_adjustments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'total_deduction_from_income',
          claimed: 5000000,
          allowed: 60000,
        }),
      ])
    );
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('POST /credits — s.61 / s.63 caps (AUDIT §12 blocker 1, F-05 door 1)', () => {
  // Every figure below is on taxable income 1,000,000, where the FA-2025
  // salaried slabs charge 1% on the excess over 600,000:
  //     normal tax   = 4,000
  //     average rate = 4,000 / 1,000,000 = 0.004
  // The statutory credit is `(A/B) × C` — the average rate applied to the
  // eligible amount — NOT the eligible amount itself.
  //
  // The first remediation pass clamped at C and these tests asserted C. That
  // is roughly two orders of magnitude too generous at this income, and QA
  // proved it was not academic: with the clamp firing and logging, a taxable
  // income of 3,000,000 still went from a 300,000 liability to nil, because
  // the "cap" of 900,000 dwarfed the 90,000 the statute actually allows.
  // The expectations here are re-based onto the correct arithmetic.

  test('a donation credit is the average rate applied to 30% of taxable income', async () => {
    stored.income = incomeRow(1000000); // taxable 1,000,000, no allowances stored

    const res = await request(buildApp()).post('/api/tax-forms/credits').send({
      taxYear: '2025-26',
      charitable_donations_amount: 9999999,
      charitable_donations_tax_credit: 9999999,
      total_tax_credits: 9999999,
    });

    expect(res.status).toBe(200);
    // eligible = min(9,999,999, 30% × 1,000,000) = 300,000 → × 0.004 = 1,200
    expect(num(captured.values.charitable_donations_tax_credit)).toBe(1200);
    expect(num(captured.values.total_tax_credits)).toBe(1200);
  });

  test('the associate proviso is 15%, not 30%', async () => {
    stored.income = incomeRow(1000000);

    await request(buildApp()).post('/api/tax-forms/credits').send({
      taxYear: '2025-26',
      charitable_donations_associate_amount: 9999999,
      charitable_donations_associate_tax_credit: 9999999,
    });

    // eligible = 15% × 1,000,000 = 150,000 → × 0.004 = 600
    expect(num(captured.values.charitable_donations_associate_tax_credit)).toBe(600);
  });

  test('pension credit is capped at 20% of taxable income', async () => {
    stored.income = incomeRow(1000000);

    await request(buildApp())
      .post('/api/tax-forms/credits')
      .send({ taxYear: '2025-26', pension_fund_amount: 9999999, pension_fund_tax_credit: 9999999 });

    // eligible = 20% × 1,000,000 = 200,000 → × 0.004 = 800
    expect(num(captured.values.pension_fund_tax_credit)).toBe(800);
  });

  test('a credit with no underlying contribution is refused entirely', async () => {
    // There is no s.61 credit without a donation. Posting a bare credit figure
    // with no amount behind it used to be accepted at face value.
    stored.income = incomeRow(1000000);

    await request(buildApp()).post('/api/tax-forms/credits').send({
      taxYear: '2025-26',
      charitable_donations_tax_credit: 1000,
      total_tax_credits: 99999999,
    });

    expect(num(captured.values.charitable_donations_tax_credit)).toBe(0);
    expect(num(captured.values.total_tax_credits)).toBe(0);
  });

  test('an inflated total_tax_credits cannot bypass the per-credit caps', async () => {
    stored.income = incomeRow(1000000);

    await request(buildApp()).post('/api/tax-forms/credits').send({
      taxYear: '2025-26',
      charitable_donations_amount: 250000,
      charitable_donations_tax_credit: 1000,
      total_tax_credits: 99999999,
    });

    // eligible = min(250,000, 300,000) = 250,000 → × 0.004 = 1,000, which is
    // exactly what was claimed, so the head stands and only the total is cut.
    expect(num(captured.values.charitable_donations_tax_credit)).toBe(1000);
    expect(num(captured.values.total_tax_credits)).toBe(1000);
  });

  test('F-05: a credit head with NO statutory rule is still bounded by the tax in charge', async () => {
    // `other_credits` is a free-text head with no percentage the app can apply,
    // and it was not on the hand-written clamp list. The component set now comes
    // from the generated total's own definition, so a head cannot escape simply
    // by not having been thought of.
    stored.income = incomeRow(1000000); // normal tax 4,000

    const res = await request(buildApp()).post('/api/tax-forms/credits').send({
      taxYear: '2025-26',
      other_credits: 9000000,
    });

    expect(res.status).toBe(200);
    expect(num(captured.values.other_credits)).toBe(4000);
    expect(res.body.statutory_adjustments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'other_credits',
          claimed: 9000000,
          allowed: 4000,
        }),
      ])
    );
  });

  test('surrendering a credit ADDS tax back — a positive figure is refused outright', async () => {
    // QA's refund-claim payload. Bounding it at the tax in charge is NOT enough
    // and a live re-test proved it: Rs 9,000,000 clamped to the full Rs 7,126,000
    // liability still took the whole charge to nil. The field records a REVERSAL
    // (shares disposed of inside the holding period), the generated total adds it
    // with a plus sign, and the form documents it as a negative entry — so a
    // positive value reduces tax by the amount that should have increased it.
    stored.income = incomeRow(1000000);

    const res = await request(buildApp()).post('/api/tax-forms/credits').send({
      taxYear: '2025-26',
      surrender_tax_credit_reduction: 9000000,
    });

    expect(res.status).toBe(200);
    expect(num(captured.values.surrender_tax_credit_reduction)).toBe(0);
    expect(num(captured.values.total_tax_credits ?? 0)).toBe(0);
    expect(res.body.statutory_adjustments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'surrender_tax_credit_reduction', allowed: 0 }),
      ])
    );
  });

  test('a genuine negative surrender is preserved — it must increase the tax', async () => {
    stored.income = incomeRow(1000000);

    await request(buildApp()).post('/api/tax-forms/credits').send({
      taxYear: '2025-26',
      surrender_tax_credit_reduction: -15000,
      total_tax_credits: -15000,
    });

    expect(num(captured.values.surrender_tax_credit_reduction)).toBe(-15000);
    expect(num(captured.values.total_tax_credits)).toBe(-15000);
  });

  test('R-01: credits saved BEFORE the income form are not destroyed', async () => {
    // The clamp used to run against a zero base, write zeros, and never restore
    // them. Nothing in the UI requires the income form first, so this was
    // ordinary use — and it pushes tax UP, so no taxpayer reports it.
    stored.income = null;

    const res = await request(buildApp()).post('/api/tax-forms/credits').send({
      taxYear: '2025-26',
      charitable_donations_amount: 250000,
      charitable_donations_tax_credit: 1000,
    });

    expect(res.status).toBe(200);
    expect(num(captured.values.charitable_donations_amount)).toBe(250000);
    expect(num(captured.values.charitable_donations_tax_credit)).toBe(1000);
    // The user is told the check is deferred rather than left to assume it passed.
    expect(res.body.statutory_adjustments).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'tax_credits' })])
    );
  });

  test('the declared donation itself is NOT capped — only the credit is', async () => {
    // A taxpayer may lawfully give away more than 30% of taxable income; they
    // simply get no credit on the excess. Rejecting the amount would be wrong.
    stored.income = incomeRow(1000000);

    await request(buildApp()).post('/api/tax-forms/credits').send({
      taxYear: '2025-26',
      charitable_donations_amount: 900000,
      charitable_donations_tax_credit: 0,
    });

    expect(num(captured.values.charitable_donations_amount)).toBe(900000);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('POST /reductions — Behbood cl.6 (AUDIT §8)', () => {
  test('taxable 800,000 with 500,000 of Behbood profit gets NIL relief, not 25,000', async () => {
    // Tax attributable to the profit at the average rate is ~1,250, already
    // under the 25,000 ceiling. The app granted 25,000 — 12.5× the taxpayer's
    // entire normal tax — and the excess spilled over into unrelated CGT.
    // 500,000 of the 800,000 is certificate profit, which is what a real
    // Behbood holder declares.
    stored.income = incomeRow(800000, 500000);

    const res = await request(buildApp()).post('/api/tax-forms/reductions').send({
      taxYear: '2025-26',
      behbood_certificates_amount: 500000,
      behbood_certificates_tax_reduction: 25000,
      total_tax_reductions: 25000,
    });

    expect(res.status).toBe(200);
    expect(num(captured.values.behbood_certificates_tax_reduction)).toBe(0);
    expect(num(captured.values.total_tax_reductions)).toBe(0);
  });

  test('relief is granted where the 5% ceiling really is breached', async () => {
    // Taxable 11,200,000 → normal tax 3,101,000 → average 27.6875%.
    // Profit 1,000,000 → tax on profit 276,875, ceiling 50,000 → relief 226,875.
    stored.income = incomeRow(11200000, 1000000);

    await request(buildApp()).post('/api/tax-forms/reductions').send({
      taxYear: '2025-26',
      behbood_certificates_amount: 1000000,
      behbood_certificates_tax_reduction: 999999,
    });

    expect(num(captured.values.behbood_certificates_tax_reduction)).toBe(226875);
  });

  test('teacher rebate is REFUSED for a year where no rate is configured', async () => {
    // Clause (3A), Pt III, 2nd Sched ceased to have effect after 30-Jun-2025, so
    // it is unavailable for tax year 2026 = this app's 2025-26. phase-z19
    // deactivates the row; is_active filtering then drops it from the rate set,
    // so it arrives here as undefined. The field is user-editable, so a typed
    // figure must be refused server-side and not merely left un-autocalculated.
    stored.income = incomeRow(5000000);
    delete RATES.reductions.teacher_researcher;

    await request(buildApp()).post('/api/tax-forms/reductions').send({
      taxYear: '2025-26',
      teacher_researcher_reduction_yn: 'Y',
      teacher_researcher_tax_reduction: 250000,
    });

    expect(num(captured.values.teacher_researcher_tax_reduction)).toBe(0);
  });

  test('teacher rebate is allowed, but capped, for a year where it IS lawful', async () => {
    // Guards against the inverse error: blocking the rebate in the years it is
    // genuinely available (tax years 2023-2025) would over-charge a teacher who
    // is still filing or revising TY2025.
    stored.income = incomeRow(5000000);
    RATES.reductions.teacher_researcher = { rate: 0.25, fixedAmount: 0 };

    await request(buildApp()).post('/api/tax-forms/reductions').send({
      taxYear: '2024-25',
      teacher_researcher_reduction_yn: 'Y',
      teacher_researcher_tax_reduction: 9999999, // wildly inflated
    });

    // 5,000,000 → normal tax 931,000; 25% → 232,750.
    expect(num(captured.values.teacher_researcher_tax_reduction)).toBe(232750);
    delete RATES.reductions.teacher_researcher;
  });

  test('an inflated total_tax_reductions is recomputed from the components', async () => {
    // Uses the teacher field WITH its rate configured, so the component is
    // lawful and survives. (It previously posted 5,000 with no rate configured;
    // the teacher guard now correctly refuses that, which made the total 0 and
    // stopped this test exercising the recompute it exists to test.)
    // Income 5,000,000 → normal tax 931,000 → 25% rebate 232,750.
    stored.income = incomeRow(5000000);
    RATES.reductions.teacher_researcher = { rate: 0.25, fixedAmount: 0 };

    await request(buildApp()).post('/api/tax-forms/reductions').send({
      taxYear: '2024-25',
      teacher_researcher_reduction_yn: 'Y',
      teacher_researcher_tax_reduction: 232750,
      total_tax_reductions: 88888888,
    });

    expect(num(captured.values.total_tax_reductions)).toBe(232750);
    delete RATES.reductions.teacher_researcher;
  });

  test('a pure-salary filer cannot invent certificate profit', async () => {
    // Found by live re-test on staging AFTER the first bound went in. Bounding
    // the profit by TOTAL income let a filer whose entire income was salary
    // claim all of it as Behbood profit: Rs 22,700,000 of "certificate profit"
    // yielded Rs 5,991,000 of relief on money that was never profit on debt.
    // Certificate profit is profit on debt, so non-salary income is the ceiling.
    stored.income = incomeRow(11200000, 0); // every rupee is salary

    const res = await request(buildApp()).post('/api/tax-forms/reductions').send({
      taxYear: '2025-26',
      behbood_certificates_amount: 11200000,
      behbood_certificates_tax_reduction: 3051000,
    });

    expect(res.status).toBe(200);
    expect(num(captured.values.behbood_certificates_amount)).toBe(0);
    expect(num(captured.values.behbood_certificates_tax_reduction)).toBe(0);
    expect(res.body.statutory_adjustments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'behbood_certificates_amount', allowed: 0 }),
      ])
    );
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('POST /adjustable-tax — the refund vector (AUDIT §12 blocker 2)', () => {
  test('withheld tax cannot exceed the gross receipt it was withheld from', async () => {
    const res = await request(buildApp()).post('/api/tax-forms/adjustable-tax').send({
      taxYear: '2025-26',
      salary_employees_149_gross_receipt: 9700000,
      salary_employees_149_tax_collected: 999699999,
    });

    expect(res.status).toBe(400);
    expect(res.body.details.join(' ')).toMatch(/cannot exceed the gross receipt/);
  });

  test('negative withholding is rejected', async () => {
    const res = await request(buildApp())
      .post('/api/tax-forms/adjustable-tax')
      .send({ taxYear: '2025-26', salary_employees_149_tax_collected: -500000 });

    expect(res.status).toBe(400);
  });

  test('an ordinary high-earner WHT well over the old 10,000,000 ceiling is accepted', async () => {
    // The dead validator's arbitrary max would have rejected this lawful save.
    const res = await request(buildApp()).post('/api/tax-forms/adjustable-tax').send({
      taxYear: '2025-26',
      salary_employees_149_gross_receipt: 90000000,
      salary_employees_149_tax_collected: 30000000,
    });

    expect(res.status).not.toBe(400);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('POST /capital-gains — validator is attached at all', () => {
  test('a negative gain is rejected', async () => {
    const res = await request(buildApp())
      .post('/api/tax-forms/capital-gains')
      .send({ taxYear: '2025-26', property_1_year: -1000000 });

    expect(res.status).toBe(400);
  });

  test('a large lawful disposal above the old 50,000,000 ceiling is accepted', async () => {
    const res = await request(buildApp())
      .post('/api/tax-forms/capital-gains')
      .send({ taxYear: '2025-26', property_1_year: 120000000, total_capital_gain: 120000000 });

    expect(res.status).toBe(200);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('enforcement failure is loud, never silent', () => {
  test('a missing rate configuration returns 503 and writes nothing', async () => {
    const TaxRateService = require('../../src/services/taxRateService');
    TaxRateService.getAllRates.mockImplementationOnce(async () => ({
      ...RATES,
      deductionThresholds: {},
    }));

    const res = await request(buildApp()).post('/api/tax-forms/deductions').send({
      taxYear: '2025-26',
      educational_expenses_amount: 5000000,
      educational_expenses_children_count: 1,
    });

    expect(res.status).toBe(503);
    expect(captured).toBeUndefined();
    // No internal identifiers, table names or stack traces reach the client.
    expect(JSON.stringify(res.body)).not.toMatch(/deduction_threshold|Error:|at Object/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Round 2 — the six POSTs that still had no validator
// ═══════════════════════════════════════════════════════════════════════════

describe('POST /tax-computation — server-computed fields are not client-writable', () => {
  test('a forged liability is discarded entirely, not stored', async () => {
    // On 45bb80c this route was `auth` + saveFormData with nothing between.
    // normal_income_tax/tax_credits are the inputs to the GENERATED columns
    // net_tax_payable, total_tax_liability and balance_payable — so Postgres
    // computed the taxpayer's liability out of numbers the taxpayer supplied.
    const res = await request(buildApp()).post('/api/tax-forms/tax-computation').send({
      taxYear: '2025-26',
      normal_income_tax: 0,
      surcharge_amount: 0,
      tax_credits: 99999999,
      deductible_allowances: 99999999,
    });

    expect(res.status).toBe(200);
    expect(capturedFirst.table).toBe('tax_computation_forms');
    expect(capturedFirst.values).not.toHaveProperty('normal_income_tax');
    expect(capturedFirst.values).not.toHaveProperty('tax_credits');
    expect(capturedFirst.values).not.toHaveProperty('deductible_allowances');
    expect(capturedFirst.values).not.toHaveProperty('surcharge_amount');
    // And the forged figures are nowhere in what was ultimately stored.
    expect(Number(captured.values.tax_credits || 0)).not.toBe(99999999);
    expect(Number(captured.values.deductible_allowances || 0)).not.toBe(99999999);
    expect(res.body.statutory_adjustments[0].dropped_fields).toEqual(
      expect.arrayContaining(['normal_income_tax', 'tax_credits', 'deductible_allowances'])
    );
  });

  test('the completion flag still gets through — the form remains usable', async () => {
    const res = await request(buildApp())
      .post('/api/tax-forms/tax-computation')
      .send({ taxYear: '2025-26', isComplete: true, normal_income_tax: 12345 });

    expect(res.status).toBe(200);
    expect(capturedFirst.values.is_complete).toBe(true);
    expect(capturedFirst.values).not.toHaveProperty('normal_income_tax');
    expect(Number(captured.values.normal_income_tax || 0)).not.toBe(12345);
  });
});

describe('POST /final-tax, /final-min-income, /expenses — shape validators wired', () => {
  test.each([
    ['/api/tax-forms/final-tax', { dividend_u_s_150_tax_chargeable: -50000 }],
    ['/api/tax-forms/final-min-income', { dividend_u_s_150_tax_chargeable: -50000 }],
    ['/api/tax-forms/expenses', { rent: -250000 }],
  ])('%s rejects a negative money field', async (path, body) => {
    const res = await request(buildApp())
      .post(path)
      .send({ taxYear: '2025-26', ...body });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });

  test('final-tax accepts a large lawful figure — no invented ceiling', async () => {
    const res = await request(buildApp())
      .post('/api/tax-forms/final-tax')
      .send({ taxYear: '2025-26', dividend_u_s_150_tax_chargeable: 250000000 });

    expect(res.status).toBe(200);
  });

  test('a non-numeric field is passed through untouched, not rejected', async () => {
    const res = await request(buildApp())
      .post('/api/tax-forms/expenses')
      .send({ taxYear: '2025-26', rent: 250000, some_yn: 'Y' });

    expect(res.status).toBe(200);
  });
});

describe('POST /wealth_forms, /wealth_reconciliation_forms — signed figures survive', () => {
  test('reconciliation accepts negative values (income_exempt_from_tax is negative by construction)', async () => {
    const res = await request(buildApp()).post('/api/tax-forms/wealth_reconciliation_forms').send({
      taxYear: '2025-26',
      income_exempt_from_tax: -1300000,
      increase_decrease_in_assets: -450000,
    });

    expect(res.status).toBe(200);
    expect(num(captured.values.income_exempt_from_tax)).toBe(-1300000);
  });

  test('the wealth statement still rejects an overflowing figure', async () => {
    const res = await request(buildApp())
      .post('/api/tax-forms/wealth_forms')
      .send({ taxYear: '2025-26', total_assets: 1e15 });

    expect(res.status).toBe(400);
  });
});

describe('s.60D limb (a) — tuition fee (phase-z14)', () => {
  test('a Rs 30,000 fee caps the allowance below the Rs 120,000 child limb', async () => {
    await request(buildApp()).post('/api/tax-forms/deductions').send({
      taxYear: '2025-26',
      tuition_fee_amount: 30000,
      educational_expenses_amount: 120000,
      educational_expenses_children_count: 2,
    });

    // s.60D grants the LEAST of the limbs: 30,000 < 120,000.
    expect(num(captured.values.educational_expenses_amount)).toBe(30000);
    // The fee itself is a stated fact, not a claim — never clamped.
    expect(num(captured.values.tuition_fee_amount)).toBe(30000);
    // ...and deliberately not part of the allowance total.
    expect(num(captured.values.total_deduction_from_income)).toBe(30000);
  });

  test('no fee stated → the taxpayer is not zeroed by the limb', async () => {
    await request(buildApp()).post('/api/tax-forms/deductions').send({
      taxYear: '2025-26',
      educational_expenses_amount: 120000,
      educational_expenses_children_count: 2,
    });

    expect(num(captured.values.educational_expenses_amount)).toBe(120000);
  });

  test('limb (b) starts binding the moment the rate row is seeded — no code change', async () => {
    const TaxRateService = require('../../src/services/taxRateService');
    // The deductions chain consults getAllRates more than once, so this must be
    // a standing implementation for the test, not mockImplementationOnce.
    TaxRateService.getAllRates.mockImplementation(async () => ({
      ...RATES,
      deductionThresholds: {
        ...RATES.deductionThresholds,
        education_taxable_income_pct: { rate: 0.25, fixedAmount: 0 },
      },
    }));
    stored.income = incomeRow(400000);

    await request(buildApp()).post('/api/tax-forms/deductions').send({
      taxYear: '2025-26',
      educational_expenses_amount: 120000,
      educational_expenses_children_count: 2,
    });

    // least of (120,000 children limb, 25% x 400,000 = 100,000)
    expect(num(captured.values.educational_expenses_amount)).toBe(100000);
  });
});
