/**
 * Integration tests for /api/wizard/*.
 *
 * Strategy: mock the DB pool and the LLM extractor so the route layer is
 * exercised against deterministic responses. Real schema/DB intentionally
 * not touched — the SQL strings + parameters are asserted instead.
 */

const express = require('express');

const mockQuery = jest.fn();
const mockConnect = jest.fn();
jest.mock('../../src/config/database', () => ({
  pool: {
    query: (...args) => mockQuery(...args),
    connect: (...args) => mockConnect(...args),
  },
}));

jest.mock('../../src/middleware/auth', () => (req, _res, next) => {
  req.user = { id: '11111111-1111-1111-1111-111111111111', email: 'user@example.com' };
  next();
});

jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
}));

jest.mock('../../src/helpers/auditLog', () => ({
  insertAudit: jest.fn().mockResolvedValue(null),
}));

// Stub the tax-rate + tax-compute services so we don't pull in the slab
// loader. taxYearId is fixed.
jest.mock('../../src/services/taxRateService', () => ({
  resolveTaxYearId: jest.fn().mockResolvedValue('22222222-2222-2222-2222-222222222222'),
  getAllRates: jest.fn(),
}));

jest.mock('../../src/services/taxCalculationService', () => ({
  calculateTaxComputation: jest.fn().mockResolvedValue({
    taxYear: '2025-26',
    income: { totalIncome: 1500000 },
    tax: { totalTaxChargeable: 9000, netTaxPayable: 9000 },
    payments: { balancePayableRefundable: 0 },
  }),
}));

// Mock ensureTaxReturn so we don't hit the user lookup chain.
jest.mock('../../src/helpers/ensureTaxReturn', () =>
  jest.fn().mockResolvedValue('33333333-3333-3333-3333-333333333333')
);

// Mock the LLM extractor to keep tests offline + deterministic.
const mockExtract = jest.fn();
jest.mock('../../src/services/wizard/wizardExtractor', () => ({
  extract: (...args) => mockExtract(...args),
}));

const request = require('supertest');
const wizardRoutes = require('../../src/routes/wizard');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/wizard', wizardRoutes);
  return app;
}

const USER_ID = '11111111-1111-1111-1111-111111111111';
const SESSION_ID = '44444444-4444-4444-4444-444444444444';

beforeEach(() => {
  mockQuery.mockReset();
  mockConnect.mockReset();
  mockExtract.mockReset();
});

// Helper: a tx client mock that just records the calls.
function txClient() {
  const calls = [];
  return {
    query: jest.fn(async (sql, params) => {
      calls.push({ sql, params });
      return { rows: [] };
    }),
    release: jest.fn(),
    _calls: calls,
  };
}

describe('GET /api/wizard/status', () => {
  test('reports no session when none exist', async () => {
    // 1. currentTaxYear lookup (tax_years)
    mockQuery.mockResolvedValueOnce({ rows: [{ tax_year: '2025-26' }] });
    // 2. wizardSessions.getStatus SELECT
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(buildApp()).get('/api/wizard/status');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      taxYear: '2025-26',
      completed: false,
      in_progress: false,
      can_resume: false,
    });
  });

  test('reports completed when a completed session exists', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ tax_year: '2025-26' }] });
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: SESSION_ID,
          status: 'completed',
          current_step: null,
          completed_at: new Date('2026-05-24T10:00:00Z'),
          started_at: new Date('2026-05-24T09:55:00Z'),
        },
      ],
    });

    const res = await request(buildApp()).get('/api/wizard/status');
    expect(res.body.completed).toBe(true);
    expect(res.body.in_progress).toBe(false);
  });
});

describe('POST /api/wizard/start', () => {
  test('starts a fresh session for a user with no profile (4-turn baseline)', async () => {
    // 1. currentTaxYear
    mockQuery.mockResolvedValueOnce({ rows: [{ tax_year: '2025-26' }] });
    // 2. getStatus (none)
    mockQuery.mockResolvedValueOnce({ rows: [] });
    // 3. loadAddons (no income_profile)
    mockQuery.mockResolvedValueOnce({ rows: [] });
    // 4. sessions.create
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: SESSION_ID,
        status: 'in_progress',
        current_step: 'salary_basics',
        captured_data: {},
        started_at: new Date(),
      }],
    });

    const res = await request(buildApp()).post('/api/wizard/start').send({});

    expect(res.status).toBe(200);
    expect(res.body.session_id).toBe(SESSION_ID);
    expect(res.body.current_step).toBe('salary_basics');
    expect(res.body.prompt.fields.map((f) => f.key)).toEqual(['annual_basic_salary', 'allowances', 'bonus']);
    // Pure-salaried path: 3 input steps (salary_basics, salary_wht, common_deductions).
    // The review screen rendered after done:true is UI-only and not in STEPS.
    expect(res.body.progress).toEqual({ current: 1, total: 3 });
    expect(res.body.resumed).toBe(false);
  });

  test('refuses to start when a completed session exists (no force)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ tax_year: '2025-26' }] });
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: SESSION_ID, status: 'completed', current_step: null, completed_at: new Date(), started_at: new Date() }],
    });

    const res = await request(buildApp()).post('/api/wizard/start').send({});

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('wizard_already_completed');
  });

  test('resumes an in-progress session', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ tax_year: '2025-26' }] });
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: SESSION_ID, status: 'in_progress', current_step: 'salary_wht', completed_at: null, started_at: new Date() }],
    });
    // existing fetch
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: SESSION_ID, current_step: 'salary_wht', captured_data: { salary_basics: { annual_basic_salary: 1500000 } } }],
    });
    // loadAddons
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(buildApp()).post('/api/wizard/start').send({});

    expect(res.body.resumed).toBe(true);
    expect(res.body.session_id).toBe(SESSION_ID);
    expect(res.body.current_step).toBe('salary_wht');
    expect(res.body.captured_data.salary_basics.annual_basic_salary).toBe(1500000);
  });

  test('includes addon-gated steps in the path when profile has them', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ tax_year: '2025-26' }] });
    mockQuery.mockResolvedValueOnce({ rows: [] });
    // loadAddons returns rental
    mockQuery.mockResolvedValueOnce({
      rows: [{ income_profile: { addons: ['rental'] } }],
    });
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: SESSION_ID, status: 'in_progress', current_step: 'salary_basics', captured_data: {}, started_at: new Date() }],
    });

    const res = await request(buildApp()).post('/api/wizard/start').send({});
    // 3 baseline + rental = 4 input steps
    expect(res.body.progress).toEqual({ current: 1, total: 4 });
  });

});

describe('POST /api/wizard/turn', () => {
  test('400 when session_id or step_id is missing', async () => {
    const res = await request(buildApp()).post('/api/wizard/turn').send({});
    expect(res.status).toBe(400);
  });

  test('happy path: structured values only, advances to next step', async () => {
    // sessions.getById
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: SESSION_ID,
        user_id: USER_ID,
        tax_year: '2025-26',
        status: 'in_progress',
        current_step: 'salary_basics',
        captured_data: {},
      }],
    });
    // loadAddons (none)
    mockQuery.mockResolvedValueOnce({ rows: [] });
    // recordTurn UPDATE
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: SESSION_ID, captured_data: { salary_basics: { annual_basic_salary: 1500000 } }, current_step: 'salary_wht' }],
    });

    const res = await request(buildApp())
      .post('/api/wizard/turn')
      .send({
        session_id: SESSION_ID,
        step_id: 'salary_basics',
        values: { annual_basic_salary: 1500000, allowances: 0, bonus: 0 },
      });

    expect(res.status).toBe(200);
    expect(res.body.done).toBe(false);
    expect(res.body.next_step).toBe('salary_wht');
    expect(res.body.progress).toEqual({ current: 2, total: 3 });
    expect(mockExtract).not.toHaveBeenCalled(); // structured only — no LLM call
  });

  test('runs the LLM extractor when raw_reply is provided', async () => {
    mockExtract.mockResolvedValueOnce({
      values: { annual_basic_salary: 1500000 },
      echo: 'Got it — ₨1,500,000 basic salary. Correct?',
      low_confidence: [],
    });
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: SESSION_ID,
        user_id: USER_ID,
        tax_year: '2025-26',
        status: 'in_progress',
        current_step: 'salary_basics',
        captured_data: {},
      }],
    });
    mockQuery.mockResolvedValueOnce({ rows: [] });   // loadAddons
    mockQuery.mockResolvedValueOnce({ rows: [{ id: SESSION_ID, current_step: 'salary_wht' }] });

    const res = await request(buildApp())
      .post('/api/wizard/turn')
      .send({
        session_id: SESSION_ID,
        step_id: 'salary_basics',
        raw_reply: '15 lakhs',
      });

    expect(res.status).toBe(200);
    expect(res.body.echo).toMatch(/1,500,000/);
    expect(mockExtract).toHaveBeenCalledTimes(1);
  });

  test('structured values override LLM extraction on conflict', async () => {
    mockExtract.mockResolvedValueOnce({
      values: { annual_basic_salary: 999999 },  // LLM extracted wrong
      echo: '...',
      low_confidence: [],
    });
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: SESSION_ID, user_id: USER_ID, tax_year: '2025-26', status: 'in_progress', current_step: 'salary_basics', captured_data: {} }],
    });
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockQuery.mockResolvedValueOnce({ rows: [{ id: SESSION_ID }] });

    await request(buildApp())
      .post('/api/wizard/turn')
      .send({
        session_id: SESSION_ID,
        step_id: 'salary_basics',
        raw_reply: 'something',
        values: { annual_basic_salary: 1500000, allowances: 0, bonus: 0 },  // structured wins
      });

    // The recordTurn UPDATE should have received the structured value, not 999999.
    const updateCall = mockQuery.mock.calls[2];
    const stepPatch = JSON.parse(updateCall[1][0]);
    expect(stepPatch.salary_basics.annual_basic_salary).toBe(1500000);
  });

  test('422 on validation failure with per-field errors', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: SESSION_ID, user_id: USER_ID, tax_year: '2025-26', status: 'in_progress', current_step: 'salary_basics', captured_data: {} }],
    });

    const res = await request(buildApp())
      .post('/api/wizard/turn')
      .send({
        session_id: SESSION_ID,
        step_id: 'salary_basics',
        values: { annual_basic_salary: -500 },  // negative — invalid
      });

    expect(res.status).toBe(422);
    expect(res.body.error).toBe('validation_failed');
    expect(res.body.field_errors.annual_basic_salary).toBe('negative_not_allowed');
  });

  test('409 when step_id is out of sequence', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: SESSION_ID, user_id: USER_ID, tax_year: '2025-26', status: 'in_progress', current_step: 'salary_basics', captured_data: {} }],
    });

    const res = await request(buildApp())
      .post('/api/wizard/turn')
      .send({
        session_id: SESSION_ID,
        step_id: 'salary_wht',  // wrong — wizard is on salary_basics
        values: { salary_tax_deducted: 1000 },
      });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('step_out_of_sequence');
  });

  test('returns done: true on the last step (pure-salaried 3rd turn)', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: SESSION_ID,
        user_id: USER_ID,
        tax_year: '2025-26',
        status: 'in_progress',
        current_step: 'common_deductions',
        captured_data: { salary_basics: { annual_basic_salary: 1500000 } },
      }],
    });
    mockQuery.mockResolvedValueOnce({ rows: [] });  // loadAddons
    mockQuery.mockResolvedValueOnce({ rows: [{ id: SESSION_ID, current_step: null }] });

    const res = await request(buildApp())
      .post('/api/wizard/turn')
      .send({
        session_id: SESSION_ID,
        step_id: 'common_deductions',
        values: { zakat_paid_amount: 0, charitable_donations_amount: 0 },
      });

    expect(res.body.done).toBe(true);
  });
});

describe('POST /api/wizard/finalize', () => {
  test('happy path: writes draft rows, returns rough calc, marks complete', async () => {
    // 1. sessions.getById
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: SESSION_ID,
        user_id: USER_ID,
        tax_year_id: '22222222-2222-2222-2222-222222222222',
        tax_year: '2025-26',
        status: 'in_progress',
        current_step: 'common_deductions',
        captured_data: {
          salary_basics: { annual_basic_salary: 1500000, allowances: 0, bonus: 0 },
          salary_wht: { salary_tax_deducted: 9000 },
          common_deductions: { zakat_paid_amount: 0, charitable_donations_amount: 0 },
        },
      }],
    });
    // 2. finalize: user email lookup
    mockQuery.mockResolvedValueOnce({ rows: [{ email: 'user@example.com' }] });
    // 3. tx connect
    const tx = txClient();
    mockConnect.mockResolvedValueOnce(tx);
    // 4. markCompleted UPDATE
    mockQuery.mockResolvedValueOnce({ rows: [{ id: SESSION_ID, status: 'completed', completed_at: new Date(), rough_calc: {} }] });

    const res = await request(buildApp())
      .post('/api/wizard/finalize')
      .send({ session_id: SESSION_ID });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('completed');
    expect(res.body.rough_calc.tax.totalTaxChargeable).toBe(9000);
    expect(res.body.message).toMatch(/rough estimates/);
    expect(res.body.tables_written).toEqual(
      expect.arrayContaining(['income_forms', 'adjustable_tax_forms']),
    );
    // tx should have begun + committed + closed
    expect(tx._calls[0].sql).toBe('BEGIN');
    expect(tx._calls[tx._calls.length - 1].sql).toBe('COMMIT');
    expect(tx.release).toHaveBeenCalled();
  });

  test('404 when session does not belong to the user', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(buildApp()).post('/api/wizard/finalize').send({ session_id: SESSION_ID });
    expect(res.status).toBe(404);
  });
});

describe('POST /api/wizard/reset', () => {
  test('archives prior sessions and returns the seed payload from the last completed', async () => {
    // 1. currentTaxYear
    mockQuery.mockResolvedValueOnce({ rows: [{ tax_year: '2025-26' }] });
    // sessions.reset: tx connect
    const tx = txClient();
    tx.query = jest.fn(async (sql) => {
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] };
      if (sql.includes('SELECT id, status')) {
        return {
          rows: [
            { id: SESSION_ID, status: 'completed', captured_data: { salary_basics: { annual_basic_salary: 1500000 } } },
          ],
        };
      }
      if (sql.startsWith('UPDATE')) return { rows: [] };
      return { rows: [] };
    });
    mockConnect.mockResolvedValueOnce(tx);

    const res = await request(buildApp()).post('/api/wizard/reset').send({});

    expect(res.body.ok).toBe(true);
    expect(res.body.archived).toBe(1);
    expect(res.body.seed_captured_data.salary_basics.annual_basic_salary).toBe(1500000);
  });
});
