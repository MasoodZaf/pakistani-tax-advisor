/**
 * Integration tests for consultant ↔ client isolation (phase-z9).
 *
 * Same mocked-pool strategy as consultantAuth.test.js: the auth middleware's
 * user lookup is answered per-test, then the scoping layer's queries are fed
 * the rows each scenario needs.
 *
 * Crown-jewel properties under test:
 *   1. A consultant CANNOT reach an unassigned user's detail/tax-records/
 *      impersonation routes — 404, with no existence leak.
 *   2. A consultant CAN reach an assigned client (scope check passes through).
 *   3. The user list a consultant sees is filtered by assignment (the SQL
 *      carries the consultant_clients subquery + their id as a parameter).
 *   4. Assignment management is super_admin only, refuses silent switching
 *      (409 while a consultant is already assigned), and only targets
 *      regular users.
 *   5. A client can deregister themselves; independent users have nothing
 *      to deregister (404).
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
const consultantLinkRoutes = require('../../src/routes/consultantLink');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/admin', adminModule);
  app.use('/api/consultant-link', consultantLinkRoutes);
  return app;
}

const IDS = {
  super_admin: '11111111-1111-1111-1111-111111111111',
  tax_consultant: '22222222-2222-2222-2222-222222222222',
  other_consultant: '55555555-5555-5555-5555-555555555555',
  user: '44444444-4444-4444-4444-444444444444',
};
const CLIENT_ID = '99999999-9999-9999-9999-999999999999';

const tokenFor = (role) => jwt.sign({ userId: IDS[role], role }, process.env.JWT_SECRET);

function mockAuthAs(role) {
  mockQuery.mockResolvedValueOnce({
    rows: [{ id: IDS[role], name: role, email: `${role}@test.pk`, role, user_type: 'individual', token_version: null }],
  });
}

beforeEach(() => {
  mockQuery.mockReset();
  mockClientQuery.mockReset();
  mockConnect.mockReset();
  mockClientQuery.mockResolvedValue({ rows: [] });
  mockConnect.mockResolvedValue({ query: (...a) => mockClientQuery(...a), release: jest.fn() });
});

describe('consultant scope guard on client routes', () => {
  test('consultant is DENIED an unassigned user (404, no existence leak)', async () => {
    mockAuthAs('tax_consultant');
    // Scope check: no consultant_clients row.
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(buildApp())
      .get(`/api/admin/users/${CLIENT_ID}`)
      .set('Authorization', `Bearer ${tokenFor('tax_consultant')}`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('User not found');
    // The scope query carries the CONSULTANT's id and the client id.
    const scopeCall = mockQuery.mock.calls[1];
    expect(scopeCall[0]).toContain('consultant_clients');
    expect(scopeCall[1]).toEqual([IDS.tax_consultant, CLIENT_ID]);
  });

  test('consultant is DENIED tax-records of an unassigned user (404)', async () => {
    mockAuthAs('tax_consultant');
    mockQuery.mockResolvedValueOnce({ rows: [] }); // no assignment
    const res = await request(buildApp())
      .get(`/api/admin/users/${CLIENT_ID}/tax-records`)
      .set('Authorization', `Bearer ${tokenFor('tax_consultant')}`);
    expect(res.status).toBe(404);
  });

  test('consultant is DENIED impersonating an unassigned user (404)', async () => {
    mockAuthAs('tax_consultant');
    mockQuery.mockResolvedValueOnce({ rows: [] }); // no assignment
    const res = await request(buildApp())
      .post(`/api/admin/impersonate/${CLIENT_ID}`)
      .set('Authorization', `Bearer ${tokenFor('tax_consultant')}`);
    expect(res.status).toBe(404);
  });

  test('consultant PASSES scope for an assigned client (guard calls through)', async () => {
    mockAuthAs('tax_consultant');
    // Scope check finds the assignment…
    mockQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
    // …then the controller's own user lookup runs (empty → its normal 404,
    // which proves the guard did NOT block).
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(buildApp())
      .get(`/api/admin/users/${CLIENT_ID}`)
      .set('Authorization', `Bearer ${tokenFor('tax_consultant')}`);
    expect(res.status).toBe(404);
    expect(mockQuery.mock.calls.length).toBe(3); // auth + scope + controller lookup
  });

  test('super_admin bypasses the scope guard entirely', async () => {
    mockAuthAs('super_admin');
    mockQuery.mockResolvedValueOnce({ rows: [] }); // controller user lookup
    const res = await request(buildApp())
      .get(`/api/admin/users/${CLIENT_ID}`)
      .set('Authorization', `Bearer ${tokenFor('super_admin')}`);
    expect(res.status).toBe(404);
    // Only auth + controller lookup — NO scope query in between.
    expect(mockQuery.mock.calls.length).toBe(2);
    expect(mockQuery.mock.calls[1][0]).not.toContain('consultant_clients');
  });
});

describe('consultant-scoped user list', () => {
  test('GET /users as consultant filters by consultant_clients with own id', async () => {
    mockAuthAs('tax_consultant');
    mockQuery.mockResolvedValueOnce({ rows: [] });               // list query
    mockQuery.mockResolvedValueOnce({ rows: [{ total: '0' }] }); // count query
    const res = await request(buildApp())
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${tokenFor('tax_consultant')}`);
    expect(res.status).toBe(200);
    const listCall = mockQuery.mock.calls[1];
    expect(listCall[0]).toContain('consultant_clients');
    expect(listCall[1]).toContain(IDS.tax_consultant);
  });

  test('GET /users as super_admin is NOT filtered', async () => {
    mockAuthAs('super_admin');
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockQuery.mockResolvedValueOnce({ rows: [{ total: '0' }] });
    const res = await request(buildApp())
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${tokenFor('super_admin')}`);
    expect(res.status).toBe(200);
    expect(mockQuery.mock.calls[1][0]).not.toContain('WHERE 1=1 AND u.id IN (SELECT client_id');
  });
});

describe('assignment management (super_admin only)', () => {
  test('consultant CANNOT assign clients (403)', async () => {
    mockAuthAs('tax_consultant');
    const res = await request(buildApp())
      .put(`/api/admin/users/${CLIENT_ID}/consultant`)
      .set('Authorization', `Bearer ${tokenFor('tax_consultant')}`)
      .send({ consultantId: IDS.tax_consultant });
    expect(res.status).toBe(403);
  });

  test('consultant CANNOT list consultants (403)', async () => {
    mockAuthAs('tax_consultant');
    const res = await request(buildApp())
      .get('/api/admin/consultants')
      .set('Authorization', `Bearer ${tokenFor('tax_consultant')}`);
    expect(res.status).toBe(403);
  });

  test('assigning an ALREADY-ASSIGNED client is refused (409 — deregister first)', async () => {
    mockAuthAs('super_admin');
    // target lookup → regular user
    mockQuery.mockResolvedValueOnce({ rows: [{ id: CLIENT_ID, email: 'client@test.pk', role: 'user' }] });
    // existing assignment → other consultant already holds the client
    mockQuery.mockResolvedValueOnce({ rows: [{ consultant_id: IDS.other_consultant }] });
    const res = await request(buildApp())
      .put(`/api/admin/users/${CLIENT_ID}/consultant`)
      .set('Authorization', `Bearer ${tokenFor('super_admin')}`)
      .send({ consultantId: IDS.tax_consultant });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/deregister/i);
  });

  test('staff accounts cannot be assigned to a consultant (400)', async () => {
    mockAuthAs('super_admin');
    mockQuery.mockResolvedValueOnce({ rows: [{ id: CLIENT_ID, email: 'admin@test.pk', role: 'admin' }] });
    const res = await request(buildApp())
      .put(`/api/admin/users/${CLIENT_ID}/consultant`)
      .set('Authorization', `Bearer ${tokenFor('super_admin')}`)
      .send({ consultantId: IDS.tax_consultant });
    expect(res.status).toBe(400);
  });

  test('super_admin assigns an independent client (200)', async () => {
    mockAuthAs('super_admin');
    mockQuery.mockResolvedValueOnce({ rows: [{ id: CLIENT_ID, email: 'client@test.pk', role: 'user' }] }); // target
    mockQuery.mockResolvedValueOnce({ rows: [] });                                                          // no existing
    mockQuery.mockResolvedValueOnce({ rows: [{ id: IDS.tax_consultant, name: 'Con', email: 'c@test.pk' }] }); // consultant
    mockQuery.mockResolvedValueOnce({ rows: [] });                                                          // insert
    const res = await request(buildApp())
      .put(`/api/admin/users/${CLIENT_ID}/consultant`)
      .set('Authorization', `Bearer ${tokenFor('super_admin')}`)
      .send({ consultantId: IDS.tax_consultant });
    expect(res.status).toBe(200);
  });
});

describe('client self-deregistration (/api/consultant-link)', () => {
  test('assigned client deregisters (200)', async () => {
    mockAuthAs('user');
    mockQuery.mockResolvedValueOnce({ rows: [{ consultant_id: IDS.tax_consultant, consultant_email: 'c@test.pk' }] });
    mockQuery.mockResolvedValueOnce({ rows: [] }); // delete
    const res = await request(buildApp())
      .delete('/api/consultant-link')
      .set('Authorization', `Bearer ${tokenFor('user')}`);
    expect(res.status).toBe(200);
  });

  test('independent user has nothing to deregister (404)', async () => {
    mockAuthAs('user');
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(buildApp())
      .delete('/api/consultant-link')
      .set('Authorization', `Bearer ${tokenFor('user')}`);
    expect(res.status).toBe(404);
  });

  test('client can see who their consultant is', async () => {
    mockAuthAs('user');
    mockQuery.mockResolvedValueOnce({ rows: [{ name: 'Con', email: 'c@test.pk', assigned_at: '2026-06-11' }] });
    const res = await request(buildApp())
      .get('/api/consultant-link')
      .set('Authorization', `Bearer ${tokenFor('user')}`);
    expect(res.status).toBe(200);
    expect(res.body.data.consultant.email).toBe('c@test.pk');
  });
});
