/**
 * Money-input guards on POST /api/income-form/:taxYear — QA findings F-07/08/09.
 *
 * These are raw authenticated POSTs, the way QA reproduced the defects. No UI.
 * DB is mocked; the router, the guard middleware and CalculationService are the
 * real code.
 *
 * ALL THREE REJECTION TESTS FAIL BEFORE THIS CHANGE:
 *   F-07 negative        -> was HTTP 200, stored -5000000.00
 *   F-08 14-digit amount -> was HTTP 500 (Postgres 22003 numeric overflow)
 *   F-09 junk string     -> was HTTP 200, stored 0.00 (silent data loss)
 *
 * The "still parses" block is the counter-evidence QA verified: the lenient
 * parser is load-bearing and the guard must not tighten it.
 */

const express = require('express');
const request = require('supertest');

let captured; // { table, values } of the last INSERT
let overflowOnInsert; // simulate the pre-fix Postgres behaviour

// income_forms money columns, as declared by
// database/migrations/phase-t-realign-form-tables.sql. All DECIMAL(15,2).
const MONEY_COLUMNS = [
  'annual_basic_salary', 'allowances', 'bonus', 'medical_allowance',
  'pension_from_ex_employer', 'employment_termination_payment',
  'retirement_from_approved_funds', 'directorship_fee', 'other_cash_benefits',
  'employer_contribution_provident', 'taxable_car_value', 'other_taxable_subsidies',
  'profit_on_debt_15_percent', 'profit_on_debt_12_5_percent',
  'other_taxable_income_rent', 'other_taxable_income_others',
];

const DECIMAL_15_2_MAX = 9999999999999.99;

const mockQuery = jest.fn(async (sql, params = []) => {
  const s = String(sql);

  if (/information_schema\.columns/.test(s)) {
    return {
      rows: MONEY_COLUMNS.map((column_name) => ({
        column_name,
        numeric_precision: 15,
        numeric_scale: 2,
      })),
    };
  }
  if (/FROM tax_years/.test(s)) return { rows: [{ id: 'ty-uuid', tax_year: '2025-26' }] };
  if (/INSERT INTO tax_returns/.test(s)) return { rows: [{ id: 'tr-uuid' }] };
  if (/FROM tax_returns/.test(s)) return { rows: [{ id: 'tr-uuid' }] };

  const insert = s.match(/INSERT INTO (\w+) \(([\s\S]*?)\)\s*VALUES/);
  if (insert) {
    const columns = insert[2].split(',').map((c) => c.trim());
    const values = {};
    columns.forEach((c, i) => {
      values[c] = params[i];
    });
    // Column order in the VALUES list is not positional in this route
    // ($1,$2,$19,$20,$3...), so re-map by reading the placeholder order.
    const placeholders = s.match(/VALUES\s*\(([\s\S]*?)\)/)[1]
      .split(',')
      .map((p) => p.trim());
    placeholders.forEach((ph, i) => {
      const idx = Number(ph.replace('$', '')) - 1;
      values[columns[i]] = params[idx];
    });
    captured = { table: insert[1], values };

    if (overflowOnInsert) {
      // What Postgres actually did before the fix.
      const err = new Error('numeric field overflow');
      err.code = '22003';
      throw err;
    }
    return { rows: [values] };
  }
  return { rows: [] };
});

jest.mock('../../src/config/database', () => ({ pool: { query: (...a) => mockQuery(...a) } }));

jest.mock('../../src/middleware/auth', () => (req, _res, next) => {
  req.user = { id: '11111111-1111-1111-1111-111111111111', email: 'qa@example.com' };
  next();
});

jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
}));

const incomeFormRouter = require('../../src/routes/incomeForm');

const app = express();
app.use(express.json());
app.use('/api/income-form', incomeFormRouter);

const post = (body) => request(app).post('/api/income-form/2025-26').send(body);

beforeEach(() => {
  captured = undefined;
  overflowOnInsert = false;
  mockQuery.mockClear();
});

describe('F-09 — non-numeric input is rejected, never coerced to 0', () => {
  // Before: HTTP 200 and 0.00 stored. The user is told "saved" while the figure
  // they typed is destroyed.
  it.each([
    ['not-a-number'],
    ['<script>alert(1)</script>'],
  ])('rejects %p with 400 and does not write', async (junk) => {
    const res = await post({ annual_basic_salary: junk });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.errors).toHaveLength(1);
    expect(res.body.errors[0]).toMatchObject({
      field: 'annual_basic_salary',
      code: 'NOT_A_NUMBER',
    });
    expect(captured).toBeUndefined();
  });

  it('rejects a boolean and an object in a money field', async () => {
    const res = await post({ bonus: true, directorship_fee: { amount: 5 } });

    expect(res.status).toBe(400);
    expect(res.body.errors.map((e) => e.field).sort()).toEqual(['bonus', 'directorship_fee']);
    expect(res.body.errors.every((e) => e.code === 'NOT_A_NUMBER')).toBe(true);
  });

  it('does NOT leak the offending value back in the error message', async () => {
    const res = await post({ annual_basic_salary: '<script>alert(1)</script>' });
    expect(JSON.stringify(res.body)).not.toContain('<script>');
  });
});

describe('F-07 — negative amounts are rejected', () => {
  // Before: HTTP 200, stored basic=-5000000.00 bonus=-250000.00, and the
  // negative total flowed into wealth reconciliation and the PDF.
  it('rejects the exact QA payload with 400 and writes nothing', async () => {
    const res = await post({ annual_basic_salary: -5000000, bonus: -250000 });

    expect(res.status).toBe(400);
    expect(res.body.errors).toHaveLength(2);
    expect(res.body.errors.map((e) => e.field).sort())
      .toEqual(['annual_basic_salary', 'bonus']);
    expect(res.body.errors.every((e) => e.code === 'NEGATIVE_AMOUNT')).toBe(true);
    expect(captured).toBeUndefined();
  });

  it('rejects a negative supplied as a string', async () => {
    const res = await post({ allowances: '-1,000' });
    expect(res.status).toBe(400);
    expect(res.body.errors[0].code).toBe('NEGATIVE_AMOUNT');
  });

  it('still accepts zero — zero is a real answer, not a missing one', async () => {
    const res = await post({ annual_basic_salary: 0 });
    expect(res.status).toBe(200);
    expect(Number(captured.values.annual_basic_salary)).toBe(0);
  });
});

describe('F-08 — amounts past DECIMAL(15,2) are a 400, not an opaque 500', () => {
  it('rejects the QA 14-digit payload before any INSERT is attempted', async () => {
    // Prove the pre-fix failure mode is genuinely unreachable: if the guard let
    // it through, the mocked INSERT would throw 22003 and produce the old 500.
    overflowOnInsert = true;

    const res = await post({ annual_basic_salary: 99999999999999 });

    expect(res.status).toBe(400);
    expect(res.body.errors[0]).toMatchObject({
      field: 'annual_basic_salary',
      code: 'AMOUNT_TOO_LARGE',
    });
    expect(captured).toBeUndefined();
  });

  it('accepts the largest storable value and rejects one step past it', async () => {
    const ok = await post({ annual_basic_salary: DECIMAL_15_2_MAX });
    expect(ok.status).toBe(200);

    const bad = await post({ annual_basic_salary: 1e13 });
    expect(bad.status).toBe(400);
    expect(bad.body.errors[0].code).toBe('AMOUNT_TOO_LARGE');
  });

  it('catches an overflow produced by annualisation, not just by raw input', async () => {
    // monthly_basic_salary is x12 by CalculationService. 1e12 is individually
    // storable; 1.2e13 is not. Without the post-calculation check this is the
    // same opaque 500 F-08 reported.
    overflowOnInsert = true;

    const res = await post({ monthly_basic_salary: 1000000000000 });

    expect(res.status).toBe(400);
    expect(res.body.errors.some((e) => e.code === 'AMOUNT_TOO_LARGE')).toBe(true);
  });
});

describe('counter-evidence — the lenient parser must not change', () => {
  // QA verified all four of these already work. Tightening the parser to fix
  // F-09 would be a regression worse than the defect.
  it.each([
    ['1,200,000', 1200000],
    ['1200000.75', 1200000.75],
    ['  1200000  ', 1200000],
    ['1.2e6', 1200000],
  ])('%p still stores %p', async (input, expected) => {
    const res = await post({ annual_basic_salary: input });

    expect(res.status).toBe(200);
    expect(Number(captured.values.annual_basic_salary)).toBe(expected);
  });
});

describe('fields the request did not send are left alone', () => {
  it('accepts a partial save and does not invent errors for absent fields', async () => {
    const res = await post({ annual_basic_salary: 1200000 });

    expect(res.status).toBe(200);
    // Every other money column defaults to 0 exactly as before.
    expect(Number(captured.values.bonus)).toBe(0);
    expect(Number(captured.values.directorship_fee)).toBe(0);
  });

  it('treats blank / null as "not supplied", never as invalid', async () => {
    const res = await post({ annual_basic_salary: 1200000, bonus: '', allowances: null });

    expect(res.status).toBe(200);
    expect(Number(captured.values.bonus)).toBe(0);
    expect(Number(captured.values.allowances)).toBe(0);
  });

  it('ignores non-money keys in the body (flags, ids, tax-year strings)', async () => {
    const res = await post({
      annual_basic_salary: 1200000,
      isComplete: true,
      tax_year: '2025-26',
      some_yn: 'Y',
      user_id: 'not-a-number-and-not-money',
    });

    expect(res.status).toBe(200);
  });
});

describe('all offending fields are reported in one response', () => {
  it('returns every violation, mixed reasons, in a single 400', async () => {
    const res = await post({
      annual_basic_salary: 'not-a-number',   // F-09
      bonus: -250000,                        // F-07
      directorship_fee: 99999999999999,      // F-08
      allowances: 500000,                    // fine
    });

    expect(res.status).toBe(400);
    expect(res.body.errors).toHaveLength(3);

    const byField = Object.fromEntries(res.body.errors.map((e) => [e.field, e.code]));
    expect(byField).toEqual({
      annual_basic_salary: 'NOT_A_NUMBER',
      bonus: 'NEGATIVE_AMOUNT',
      directorship_fee: 'AMOUNT_TOO_LARGE',
    });
    expect(captured).toBeUndefined();
  });
});
