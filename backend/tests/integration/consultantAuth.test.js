/**
 * Integration tests for the Tax Consultant role gating (phase-z6).
 *
 * Strategy: mock the database pool, logger and audit helper so we can drive the
 * authorization paths without Postgres. The auth middleware looks the caller up
 * in `users`; we mock that lookup to return whatever role each test needs, then
 * assert the route-level / in-controller guards behave.
 *
 * Crown-jewel properties under test:
 *   1. tax_consultant reaches the elevated surface (bulk import/delete, playbook).
 *   2. A plain admin and a regular user are REJECTED from the elevated surface.
 *   3. tax_consultant is REJECTED from tax-rate changes (the one thing it can't do).
 *   4. tax_consultant cannot escalate: creating a staff account is refused.
 */

const express = require('express');
const jwt = require('jsonwebtoken');

const mockQuery = jest.fn();
const mockClientQuery = jest.fn();
const mockConnect = jest.fn();

jest.mock('../../src/config/database', () => ({
  pool: {
    query: (...args) => mockQuery(...args),
    connect: (...args) => mockConnect(...args),
  },
}));

jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
}));

jest.mock('../../src/helpers/auditLog', () => ({
  insertAudit: jest.fn().mockResolvedValue(null),
}));

process.env.JWT_SECRET = 'test-secret-do-not-use-in-prod-padded-to-32-chars';

const request = require('supertest');
const adminModule = require('../../src/modules/Admin');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/admin', adminModule);
  return app;
}

const IDS = {
  super_admin: '11111111-1111-1111-1111-111111111111',
  tax_consultant: '22222222-2222-2222-2222-222222222222',
  admin: '33333333-3333-3333-3333-333333333333',
  user: '44444444-4444-4444-4444-444444444444',
};

// Sign a JWT the auth middleware will accept (no token_version → version check skipped).
const tokenFor = (role) => jwt.sign({ userId: IDS[role], role }, process.env.JWT_SECRET);

// The next pool.query is always the auth middleware's user lookup — answer it
// with a row carrying the requested role.
function mockAuthAs(role) {
  mockQuery.mockResolvedValueOnce({
    rows: [{ id: IDS[role], name: role, email: `${role}@test.pk`, role, user_type: 'individual', token_version: null }],
  });
}

beforeEach(() => {
  mockQuery.mockReset();
  mockClientQuery.mockReset();
  mockConnect.mockReset();
  // A pooled client whose queries succeed (BEGIN/SAVEPOINT/etc.) — controllers
  // that reach DB work get benign responses; the guard tests return before real work.
  mockClientQuery.mockResolvedValue({ rows: [] });
  mockConnect.mockResolvedValue({ query: (...a) => mockClientQuery(...a), release: jest.fn() });
});

describe('elevated surface — bulk template (GET /users/bulk-template)', () => {
  test('tax_consultant is allowed (200, xlsx)', async () => {
    mockAuthAs('tax_consultant');
    const res = await request(buildApp())
      .get('/api/admin/users/bulk-template')
      .set('Authorization', `Bearer ${tokenFor('tax_consultant')}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml');
  });

  test('super_admin is allowed (200)', async () => {
    mockAuthAs('super_admin');
    const res = await request(buildApp())
      .get('/api/admin/users/bulk-template')
      .set('Authorization', `Bearer ${tokenFor('super_admin')}`);
    expect(res.status).toBe(200);
  });

  test('plain admin is REJECTED (403)', async () => {
    mockAuthAs('admin');
    const res = await request(buildApp())
      .get('/api/admin/users/bulk-template')
      .set('Authorization', `Bearer ${tokenFor('admin')}`);
    expect(res.status).toBe(403);
  });

  test('regular user is REJECTED (403)', async () => {
    mockAuthAs('user');
    const res = await request(buildApp())
      .get('/api/admin/users/bulk-template')
      .set('Authorization', `Bearer ${tokenFor('user')}`);
    expect(res.status).toBe(403);
  });
});

describe('elevated surface — bulk delete (POST /users/bulk-delete)', () => {
  test('tax_consultant passes the gate (400 on empty body, not 403)', async () => {
    mockAuthAs('tax_consultant');
    const res = await request(buildApp())
      .post('/api/admin/users/bulk-delete')
      .set('Authorization', `Bearer ${tokenFor('tax_consultant')}`)
      .send({ userIds: [] });
    // Past the gate → the controller's own validation answers (empty array → 400).
    expect(res.status).toBe(400);
  });

  test('plain admin is REJECTED at the gate (403)', async () => {
    mockAuthAs('admin');
    const res = await request(buildApp())
      .post('/api/admin/users/bulk-delete')
      .set('Authorization', `Bearer ${tokenFor('admin')}`)
      .send({ userIds: ['x'] });
    expect(res.status).toBe(403);
  });
});

describe('rate changes stay super_admin-only', () => {
  test('tax_consultant is REJECTED from POST /tax-rates (403)', async () => {
    mockAuthAs('tax_consultant');
    const res = await request(buildApp())
      .post('/api/admin/tax-rates')
      .set('Authorization', `Bearer ${tokenFor('tax_consultant')}`)
      .send({ tax_year: '2025-26', rate_type: 'surcharge', rate_value: 10 });
    expect(res.status).toBe(403);
  });
});

describe('no privilege escalation', () => {
  test('tax_consultant creating a staff account is REFUSED (403)', async () => {
    mockAuthAs('tax_consultant');
    const res = await request(buildApp())
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${tokenFor('tax_consultant')}`)
      .send({ email: 'new.admin@test.pk', name: 'New Admin', password: 'Whatever1!', role: 'admin' });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/super admin/i);
  });

  test('tax_consultant creating a regular user passes the escalation guard', async () => {
    mockAuthAs('tax_consultant');
    // createUser path: connect→BEGIN→checks→provisionUser. Make the email/name
    // dedup SELECTs come back empty and the rest succeed so it doesn't 403/409.
    const res = await request(buildApp())
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${tokenFor('tax_consultant')}`)
      .send({ email: 'new.user@test.pk', name: 'New User', password: 'Whatever1!', role: 'user' });
    // Whatever the downstream DB mock yields, it must NOT be the escalation 403.
    expect(res.status).not.toBe(403);
  });
});
