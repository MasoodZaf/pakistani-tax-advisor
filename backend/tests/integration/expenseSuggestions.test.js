/**
 * Integration test for GET /api/tax-forms/expense-suggestions — the filing-
 * time aggregator that turns the mobile expense ledger into pre-fills for
 * the web tax forms.
 *
 * Database pool and auth middleware are mocked.
 */

const express = require('express');

const mockQuery = jest.fn();
jest.mock('../../src/config/database', () => ({
  pool: { query: (...args) => mockQuery(...args) },
}));

jest.mock('../../src/middleware/auth', () => (req, _res, next) => {
  req.user = { id: '11111111-1111-1111-1111-111111111111', email: 'test@example.com' };
  next();
});

jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
}));

const request = require('supertest');

function buildApp() {
  // taxForms.js exports a router that we mount under /api/tax-forms.
  const taxFormsRouter = require('../../src/modules/IncomeTax/routes/taxForms');
  const app = express();
  app.use(express.json());
  app.use('/api/tax-forms', taxFormsRouter);
  return app;
}

const USER_ID = '11111111-1111-1111-1111-111111111111';

beforeEach(() => {
  mockQuery.mockReset();
});

describe('GET /api/tax-forms/expense-suggestions', () => {
  test('groups expenses by tax_treatment and tracks unmapped', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 'a1', tax_treatment: 'zakat',       amount_pkr: '10000.00', occurred_on: '2026-05-18', category: 'zakat',   description: null },
        { id: 'a2', tax_treatment: 'zakat',       amount_pkr: '40000.00', occurred_on: '2026-04-10', category: 'zakat',   description: null },
        { id: 'a3', tax_treatment: 'donation',    amount_pkr: '25000.00', occurred_on: '2026-03-22', category: 'charity', description: null },
        { id: 'a4', tax_treatment: 'medical',     amount_pkr: '180000.00', occurred_on: '2026-02-01', category: 'medical', description: null },
        { id: 'a5', tax_treatment: null,          amount_pkr: '12000.00', occurred_on: '2026-01-15', category: 'transport', description: null },
        { id: 'a6', tax_treatment: null,          amount_pkr: '10000.00', occurred_on: '2025-12-30', category: 'food_dining', description: null },
      ],
    });

    const res = await request(buildApp())
      .get('/api/tax-forms/expense-suggestions?taxYear=2025-26');

    expect(res.status).toBe(200);
    expect(res.body.tax_year).toBe('2025-26');
    expect(res.body.by_treatment.zakat).toEqual({ total_pkr: 50000, count: 2, expense_ids: ['a1', 'a2'] });
    expect(res.body.by_treatment.donation).toEqual({ total_pkr: 25000, count: 1, expense_ids: ['a3'] });
    expect(res.body.by_treatment.medical).toEqual({ total_pkr: 180000, count: 1, expense_ids: ['a4'] });
    expect(res.body.unmapped).toEqual({ total_pkr: 22000, count: 2, expense_ids: ['a5', 'a6'] });
    expect(res.body.total_captured_pkr).toBe(277000);
  });

  test('returns empty buckets when user has no expenses', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(buildApp())
      .get('/api/tax-forms/expense-suggestions?taxYear=2025-26');

    expect(res.status).toBe(200);
    expect(res.body.by_treatment).toEqual({});
    expect(res.body.unmapped).toEqual({ total_pkr: 0, count: 0, expense_ids: [] });
    expect(res.body.total_captured_pkr).toBe(0);
  });

  test('query uses correct user_id and excludes included/deleted rows', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await request(buildApp()).get('/api/tax-forms/expense-suggestions?taxYear=2025-26');

    expect(mockQuery).toHaveBeenCalledTimes(1);
    const [sql, params] = mockQuery.mock.calls[0];
    expect(params).toEqual([USER_ID, '2025-26']);
    expect(sql).toMatch(/deleted_at IS NULL/);
    expect(sql).toMatch(/included_in_return = FALSE/);
  });
});

describe('POST /api/tax-forms/expense-suggestions/apply', () => {
  test('marks expenses included and returns per-treatment totals', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 'a1', tax_treatment: 'zakat',    amount_pkr: '10000.00' },
        { id: 'a2', tax_treatment: 'zakat',    amount_pkr: '40000.00' },
        { id: 'a3', tax_treatment: 'donation', amount_pkr: '25000.00' },
        { id: 'a4', tax_treatment: null,       amount_pkr: '5000.00' },
      ],
    });

    const res = await request(buildApp())
      .post('/api/tax-forms/expense-suggestions/apply')
      .send({ taxYear: '2025-26', expense_ids: ['a1', 'a2', 'a3', 'a4'] });

    expect(res.status).toBe(200);
    expect(res.body.applied_count).toBe(4);
    expect(res.body.total_applied_pkr).toBe(80000);
    expect(res.body.by_treatment.zakat).toEqual({ total_pkr: 50000, count: 2 });
    expect(res.body.by_treatment.donation).toEqual({ total_pkr: 25000, count: 1 });
    expect(res.body.by_treatment.unmapped).toEqual({ total_pkr: 5000, count: 1 });
  });

  test('requires taxYear and non-empty expense_ids', async () => {
    let res = await request(buildApp())
      .post('/api/tax-forms/expense-suggestions/apply')
      .send({ expense_ids: ['a1'] });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('taxYear_required');

    res = await request(buildApp())
      .post('/api/tax-forms/expense-suggestions/apply')
      .send({ taxYear: '2025-26' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('expense_ids_required');

    res = await request(buildApp())
      .post('/api/tax-forms/expense-suggestions/apply')
      .send({ taxYear: '2025-26', expense_ids: [] });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('expense_ids_required');
  });

  test('UPDATE is scoped to caller, year, not-deleted, not-already-included', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await request(buildApp())
      .post('/api/tax-forms/expense-suggestions/apply')
      .send({ taxYear: '2025-26', expense_ids: ['a1'] });

    const [sql, params] = mockQuery.mock.calls[0];
    expect(params).toEqual([USER_ID, '2025-26', ['a1']]);
    expect(sql).toMatch(/UPDATE expenses/);
    expect(sql).toMatch(/user_id = \$1/);
    expect(sql).toMatch(/deleted_at IS NULL/);
    expect(sql).toMatch(/included_in_return = FALSE/);
    expect(sql).toMatch(/id = ANY\(\$3::uuid\[\]\)/);
  });
});
