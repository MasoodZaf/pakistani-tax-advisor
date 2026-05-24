/**
 * Integration tests for /api/sso/{google,apple}.
 *
 * Strategy: mock the database pool and the OIDC verifier so we can drive
 * the three code paths (direct SSO match / email-match-link / new-user)
 * without hitting the network or Postgres.
 */

const express = require('express');

const mockQuery = jest.fn();
jest.mock('../../src/config/database', () => ({
  pool: {
    query: (...args) => mockQuery(...args),
    connect: jest.fn(),
  },
}));

jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
}));

jest.mock('../../src/helpers/auditLog', () => ({
  insertAudit: jest.fn().mockResolvedValue(null),
}));

// jsonwebtoken is real but needs JWT_SECRET to sign.
process.env.JWT_SECRET = 'test-secret-do-not-use-in-prod-padded-to-32-chars';

const request = require('supertest');
const authRoutes = require('../../src/routes/auth');
const oidc = require('../../src/services/oidcVerifier');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api', authRoutes);
  return app;
}

const USER_ID = '11111111-1111-1111-1111-111111111111';
const ANOTHER_USER_ID = '22222222-2222-2222-2222-222222222222';

const baseUser = (overrides = {}) => ({
  id: USER_ID,
  email: 'user@example.com',
  name: 'Sample User',
  role: 'user',
  user_type: 'individual',
  permissions: null,
  onboarding_completed: false,
  cnic: null,
  phone: null,
  is_active: true,
  ...overrides,
});

beforeEach(() => {
  mockQuery.mockReset();
  oidc._setVerifierForTests(null);
});

afterAll(() => {
  oidc._setVerifierForTests(null);
});

describe('POST /api/sso/google', () => {
  test('400 when idToken is missing', async () => {
    const res = await request(buildApp()).post('/api/sso/google').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('idToken_required');
  });

  test('401 when verifier rejects the token', async () => {
    oidc._setVerifierForTests(async () => {
      throw new Error('token_expired');
    });
    const res = await request(buildApp())
      .post('/api/sso/google')
      .send({ idToken: 'whatever' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('token_expired');
  });

  test('direct match: SSO identity already linked → log in, no link/create', async () => {
    oidc._setVerifierForTests(async () => ({
      sub: 'google-sub-001',
      email: 'user@example.com',
      name: 'Sample User',
      provider: 'google',
    }));

    // 1) lookup by (sso_provider, sso_subject) → hit
    mockQuery.mockResolvedValueOnce({ rows: [baseUser()] });
    // 2) INSERT INTO user_sessions
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(buildApp())
      .post('/api/sso/google')
      .send({ idToken: 'valid' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.id).toBe(USER_ID);
    expect(typeof res.body.sessionToken).toBe('string');
    expect(typeof res.body.token).toBe('string');
    expect(res.body.sso.provider).toBe('google');
    // No link UPDATE, no user INSERT.
    expect(mockQuery).toHaveBeenCalledTimes(2);
  });

  test('email conflict: existing account with same email → 409, no auto-link', async () => {
    // Policy: /register has no email-verification step, so silently linking
    // a fresh SSO identity to a pre-existing email row would let an attacker
    // who squatted on a victim's email inherit the victim's SSO login. The
    // server refuses; the user must sign in with their password first and
    // link the SSO provider from their profile.
    oidc._setVerifierForTests(async () => ({
      sub: 'google-sub-002',
      email: 'legacy@example.com',
      name: 'Legacy User',
      provider: 'google',
    }));

    // 1) SSO lookup → miss
    mockQuery.mockResolvedValueOnce({ rows: [] });
    // 2) email lookup (LOWER(email) = $1) → hit on existing password user
    mockQuery.mockResolvedValueOnce({ rows: [{ id: ANOTHER_USER_ID, sso_provider: null }] });

    const res = await request(buildApp())
      .post('/api/sso/google')
      .send({ idToken: 'valid' });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('sso_email_conflict');

    // Only the two SELECTs — no UPDATE, no INSERT, no session.
    expect(mockQuery).toHaveBeenCalledTimes(2);
    // The email lookup must be case-insensitive — otherwise legacy mixed-case
    // rows slip through and trigger a duplicate-row INSERT later.
    expect(mockQuery.mock.calls[1][0]).toMatch(/LOWER\(email\)/);
  });

  test('new user: no SSO row, no email row → INSERT with password_hash=NULL', async () => {
    oidc._setVerifierForTests(async () => ({
      sub: 'google-sub-003',
      email: 'newcomer@example.com',
      name: 'Newcomer',
      provider: 'google',
    }));

    // 1) SSO lookup → miss
    mockQuery.mockResolvedValueOnce({ rows: [] });
    // 2) email lookup → miss
    mockQuery.mockResolvedValueOnce({ rows: [] });
    // 3) INSERT INTO users → returns the new row
    mockQuery.mockResolvedValueOnce({
      rows: [baseUser({ email: 'newcomer@example.com', name: 'Newcomer' })],
    });
    // 4) session INSERT
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(buildApp())
      .post('/api/sso/google')
      .send({ idToken: 'valid' });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('newcomer@example.com');

    const insertCall = mockQuery.mock.calls[2];
    expect(insertCall[0]).toMatch(/INSERT INTO users/);
    expect(insertCall[0]).toMatch(/password_hash/);
    // Should pass NULL for the password_hash slot — there's no $-param for it.
    expect(insertCall[1]).toEqual([
      'newcomer@example.com', 'Newcomer', 'individual', 'google', 'google-sub-003',
    ]);
  });

  test('disabled user → 403', async () => {
    oidc._setVerifierForTests(async () => ({
      sub: 'google-sub-004',
      email: 'banned@example.com',
      provider: 'google',
    }));
    mockQuery.mockResolvedValueOnce({ rows: [baseUser({ is_active: false })] });

    const res = await request(buildApp())
      .post('/api/sso/google')
      .send({ idToken: 'valid' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('account_disabled');
  });
});

describe('POST /api/sso/link/:provider (authenticated)', () => {
  // The link endpoint runs jwtAuth, so we need a signed token for the
  // supertest request. Sign one with the same JWT_SECRET set above.
  const jwt = require('jsonwebtoken');
  function authHeader(userId, email) {
    const token = jwt.sign(
      { userId, email, name: 'Test', role: 'user', onboarding_completed: true },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    return { Authorization: `Bearer ${token}` };
  }

  test('401 when not authenticated', async () => {
    const res = await request(buildApp())
      .post('/api/sso/link/google')
      .send({ idToken: 'whatever' });
    expect(res.status).toBe(401);
  });

  test('400 when idToken missing', async () => {
    // jwtAuth runs SELECT to load the user before our handler — return one row.
    mockQuery.mockResolvedValueOnce({ rows: [baseUser()] });
    const res = await request(buildApp())
      .post('/api/sso/link/google')
      .set(authHeader(USER_ID, 'user@example.com'))
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('idToken_required');
  });

  test('403 when verified email does not match the account email', async () => {
    oidc._setVerifierForTests(async () => ({
      sub: 'g-sub-A',
      email: 'someoneelse@example.com',
      provider: 'google',
    }));
    mockQuery.mockResolvedValueOnce({ rows: [baseUser()] }); // jwtAuth loads user

    const res = await request(buildApp())
      .post('/api/sso/link/google')
      .set(authHeader(USER_ID, 'user@example.com'))
      .send({ idToken: 'valid' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('email_mismatch');
  });

  test('409 when account already has an SSO provider linked', async () => {
    oidc._setVerifierForTests(async () => ({
      sub: 'g-sub-A',
      email: 'user@example.com',
      provider: 'google',
    }));
    mockQuery.mockResolvedValueOnce({ rows: [baseUser()] }); // jwtAuth
    mockQuery.mockResolvedValueOnce({ rows: [{ sso_provider: 'apple' }] }); // existing check

    const res = await request(buildApp())
      .post('/api/sso/link/google')
      .set(authHeader(USER_ID, 'user@example.com'))
      .send({ idToken: 'valid' });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('sso_already_linked');
    expect(res.body.current_provider).toBe('apple');
  });

  test('409 when the SSO identity is already claimed by another user', async () => {
    oidc._setVerifierForTests(async () => ({
      sub: 'g-sub-A',
      email: 'user@example.com',
      provider: 'google',
    }));
    mockQuery.mockResolvedValueOnce({ rows: [baseUser()] }); // jwtAuth
    mockQuery.mockResolvedValueOnce({ rows: [{ sso_provider: null }] }); // existing check
    mockQuery.mockResolvedValueOnce({ rows: [{ id: ANOTHER_USER_ID }] }); // claimed check

    const res = await request(buildApp())
      .post('/api/sso/link/google')
      .set(authHeader(USER_ID, 'user@example.com'))
      .send({ idToken: 'valid' });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('sso_identity_taken');
  });

  test('happy path: links the SSO identity', async () => {
    oidc._setVerifierForTests(async () => ({
      sub: 'g-sub-A',
      email: 'user@example.com',
      provider: 'google',
    }));
    mockQuery.mockResolvedValueOnce({ rows: [baseUser()] }); // jwtAuth
    mockQuery.mockResolvedValueOnce({ rows: [{ sso_provider: null }] }); // existing check
    mockQuery.mockResolvedValueOnce({ rows: [] }); // claimed check (none)
    mockQuery.mockResolvedValueOnce({ rows: [] }); // UPDATE

    const res = await request(buildApp())
      .post('/api/sso/link/google')
      .set(authHeader(USER_ID, 'user@example.com'))
      .send({ idToken: 'valid' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, provider: 'google' });

    // Verify the UPDATE was the link UPDATE, scoped to the calling user.
    const updateCall = mockQuery.mock.calls[3];
    expect(updateCall[0]).toMatch(/UPDATE users/);
    expect(updateCall[0]).toMatch(/sso_provider/);
    expect(updateCall[1]).toEqual(['google', 'g-sub-A', USER_ID]);
  });
});

describe('POST /api/sso/unlink (authenticated)', () => {
  const jwt = require('jsonwebtoken');
  function authHeader(userId, email) {
    const token = jwt.sign(
      { userId, email, name: 'Test', role: 'user', onboarding_completed: true },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    return { Authorization: `Bearer ${token}` };
  }

  test('409 when no SSO is linked', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [baseUser()] }); // jwtAuth
    mockQuery.mockResolvedValueOnce({ rows: [{ sso_provider: null, password_hash: 'x' }] });

    const res = await request(buildApp())
      .post('/api/sso/unlink')
      .set(authHeader(USER_ID, 'user@example.com'))
      .send({});

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('no_sso_linked');
  });

  test('409 when no password is set (would lock the user out)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [baseUser()] }); // jwtAuth
    mockQuery.mockResolvedValueOnce({ rows: [{ sso_provider: 'google', password_hash: null }] });

    const res = await request(buildApp())
      .post('/api/sso/unlink')
      .set(authHeader(USER_ID, 'user@example.com'))
      .send({});

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('no_password_set');
  });

  test('happy path: unlinks', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [baseUser()] }); // jwtAuth
    mockQuery.mockResolvedValueOnce({ rows: [{ sso_provider: 'google', password_hash: 'x' }] });
    mockQuery.mockResolvedValueOnce({ rows: [] }); // UPDATE

    const res = await request(buildApp())
      .post('/api/sso/unlink')
      .set(authHeader(USER_ID, 'user@example.com'))
      .send({});

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, unlinked_provider: 'google' });
  });
});

describe('GET /api/sso/status', () => {
  const jwt = require('jsonwebtoken');
  function authHeader(userId, email) {
    const token = jwt.sign(
      { userId, email, name: 'Test', role: 'user', onboarding_completed: true },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    return { Authorization: `Bearer ${token}` };
  }

  test('returns current provider + has_password', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [baseUser()] }); // jwtAuth
    mockQuery.mockResolvedValueOnce({ rows: [{ sso_provider: 'google', has_password: true }] });

    const res = await request(buildApp())
      .get('/api/sso/status')
      .set(authHeader(USER_ID, 'user@example.com'));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ provider: 'google', has_password: true });
  });

  test('null provider for unlinked accounts', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [baseUser()] }); // jwtAuth
    mockQuery.mockResolvedValueOnce({ rows: [{ sso_provider: null, has_password: true }] });

    const res = await request(buildApp())
      .get('/api/sso/status')
      .set(authHeader(USER_ID, 'user@example.com'));

    expect(res.body.provider).toBe(null);
  });
});

describe('POST /api/sso/apple', () => {
  test('same code path as Google — sanity check that the route is wired', async () => {
    oidc._setVerifierForTests(async (provider) => {
      expect(provider).toBe('apple');
      return {
        sub: 'apple-sub-001',
        email: 'apple-user@example.com',
        name: null,
        provider: 'apple',
      };
    });

    mockQuery.mockResolvedValueOnce({ rows: [baseUser({ email: 'apple-user@example.com' })] });
    mockQuery.mockResolvedValueOnce({ rows: [] }); // session insert

    const res = await request(buildApp())
      .post('/api/sso/apple')
      .send({ idToken: 'valid' });

    expect(res.status).toBe(200);
    expect(res.body.sso.provider).toBe('apple');
  });
});
