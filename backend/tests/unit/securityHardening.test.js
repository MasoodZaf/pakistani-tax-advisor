/**
 * Regression tests for the Wave-1 security hardening (2026-06-04):
 *   - SEC-01: JWT revocation via users.token_version (auth middleware)
 *   - SEC-09: :taxYear param validation (router.param handler)
 *
 * Both are pure-ish: the middleware only needs pool.query + jwt mocked, the
 * validator is a plain function. No live DB required.
 */

process.env.JWT_SECRET = process.env.JWT_SECRET || 'unit-test-secret-at-least-32-chars-long';

const jwt = require('jsonwebtoken');

// Mock the DB pool + logger the auth middleware pulls in.
const mockQuery = jest.fn();
jest.mock('../../src/config/database', () => ({ pool: { query: (...a) => mockQuery(...a) } }));
jest.mock('../../src/utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const auth = require('../../src/middleware/auth');
const { validateTaxYearParam } = require('../../src/middleware/validation');

const SECRET = process.env.JWT_SECRET;
const USER = { id: 'u1', name: 'T', email: 't@e.com', role: 'user', user_type: 'individual', token_version: 2 };

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
}

async function runAuth(tokenPayload) {
  mockQuery.mockReset();
  mockQuery.mockResolvedValue({ rows: [USER] });
  const token = jwt.sign(tokenPayload, SECRET);
  const req = { header: () => `Bearer ${token}` };
  const res = mockRes();
  let nexted = false;
  await auth(req, res, () => { nexted = true; });
  return { nexted, res, req };
}

describe('SEC-01 — JWT revocation via token_version', () => {
  test('accepts a token whose token_version matches the DB', async () => {
    const { nexted, req } = await runAuth({ userId: 'u1', token_version: 2 });
    expect(nexted).toBe(true);
    expect(req.user.id).toBe('u1');
  });

  test('rejects a token whose token_version is stale (revoked)', async () => {
    const { nexted, res } = await runAuth({ userId: 'u1', token_version: 1 });
    expect(nexted).toBe(false);
    expect(res.statusCode).toBe(401);
  });

  test('accepts a legacy token with NO token_version (backward compatible)', async () => {
    const { nexted } = await runAuth({ userId: 'u1' });
    expect(nexted).toBe(true);
  });
});

describe('SEC-09 — :taxYear validation', () => {
  const run = (value) => {
    const res = mockRes();
    let nexted = false;
    validateTaxYearParam({}, res, () => { nexted = true; }, value);
    return { nexted, res };
  };

  test.each(['2025-26', '2024-25'])('accepts valid year %s', (v) => {
    expect(run(v).nexted).toBe(true);
  });

  test.each(['2025', '2025-99', 'abc', '2025-26; DROP TABLE', '2099-00', '2014-15'])(
    'rejects invalid year %s with 400',
    (v) => {
      const { nexted, res } = run(v);
      expect(nexted).toBe(false);
      expect(res.statusCode).toBe(400);
    }
  );
});
