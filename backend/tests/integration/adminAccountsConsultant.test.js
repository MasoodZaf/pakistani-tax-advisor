/**
 * Integration tests: super_admin manages tax_consultant accounts (PR2 of the
 * consultant-isolation campaign). Until now the admin-accounts whitelists were
 * ['admin','super_admin'] only — consultants could not be created, listed,
 * edited, or password-reset through the API at all.
 *
 * Same mocked-pool strategy as consultantAuth.test.js / consultantIsolation.test.js.
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
};
const TARGET_ID = '99999999-9999-9999-9999-999999999999';

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

describe('create admin account — tax_consultant role', () => {
  test('super_admin creates a tax_consultant (201)', async () => {
    mockAuthAs('super_admin');
    mockClientQuery
      .mockResolvedValueOnce({ rows: [] })                       // BEGIN
      .mockResolvedValueOnce({ rows: [] })                       // email uniqueness
      .mockResolvedValueOnce({ rows: [{ id: TARGET_ID, email: 'tc@test.pk', name: 'Con', role: 'tax_consultant' }] }) // INSERT
      .mockResolvedValueOnce({ rows: [] })                       // audit
      .mockResolvedValueOnce({ rows: [] });                      // COMMIT
    const res = await request(buildApp())
      .post('/api/admin/admin-accounts')
      .set('Authorization', `Bearer ${tokenFor('super_admin')}`)
      .send({ email: 'tc@test.pk', name: 'Con', password: 'Str0ng!Passw0rd', role: 'tax_consultant' });
    expect(res.status).toBe(201);
    expect(res.body.data.role).toBe('tax_consultant');
  });

  test('an unknown role string is rejected (400)', async () => {
    mockAuthAs('super_admin');
    const res = await request(buildApp())
      .post('/api/admin/admin-accounts')
      .set('Authorization', `Bearer ${tokenFor('super_admin')}`)
      .send({ email: 'x@test.pk', name: 'X', password: 'Str0ng!Passw0rd', role: 'hacker' });
    expect(res.status).toBe(400);
  });

  test('a tax_consultant cannot create staff accounts (403)', async () => {
    mockAuthAs('tax_consultant');
    const res = await request(buildApp())
      .post('/api/admin/admin-accounts')
      .set('Authorization', `Bearer ${tokenFor('tax_consultant')}`)
      .send({ email: 'x@test.pk', name: 'X', password: 'Str0ng!Passw0rd', role: 'tax_consultant' });
    expect(res.status).toBe(403);
  });
});

describe('list admin accounts includes consultants', () => {
  test('listing query covers tax_consultant and joins client counts', async () => {
    mockAuthAs('super_admin');
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(buildApp())
      .get('/api/admin/admin-accounts')
      .set('Authorization', `Bearer ${tokenFor('super_admin')}`);
    expect(res.status).toBe(200);
    const listSql = mockQuery.mock.calls[1][0];
    expect(listSql).toContain("tax_consultant");
    expect(listSql).toContain('consultant_clients');
  });
});

describe('update admin account — role validation + client release', () => {
  test('writing an arbitrary role string is now rejected (400)', async () => {
    mockAuthAs('super_admin');
    mockQuery.mockResolvedValueOnce({ rows: [{ id: TARGET_ID, email: 'a@test.pk', role: 'admin' }] }); // target lookup
    const res = await request(buildApp())
      .put(`/api/admin/admin-accounts/${TARGET_ID}`)
      .set('Authorization', `Bearer ${tokenFor('super_admin')}`)
      .send({ role: 'pwned_role' });
    expect(res.status).toBe(400);
  });

  test('demoting a consultant releases their clients', async () => {
    mockAuthAs('super_admin');
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: TARGET_ID, email: 'tc@test.pk', role: 'tax_consultant' }] }) // target lookup
      .mockResolvedValueOnce({ rows: [{ id: TARGET_ID, email: 'tc@test.pk', role: 'admin', is_active: true }] }) // UPDATE
      .mockResolvedValueOnce({ rows: [{ client_id: 'c1' }, { client_id: 'c2' }] }) // DELETE consultant_clients
      .mockResolvedValueOnce({ rows: [] }); // audit insert
    const res = await request(buildApp())
      .put(`/api/admin/admin-accounts/${TARGET_ID}`)
      .set('Authorization', `Bearer ${tokenFor('super_admin')}`)
      .send({ role: 'admin' });
    expect(res.status).toBe(200);
    const deleteCall = mockQuery.mock.calls.find(c => String(c[0]).includes('DELETE FROM consultant_clients'));
    expect(deleteCall).toBeTruthy();
    expect(deleteCall[1]).toEqual([TARGET_ID]);
  });

  test('a regular user cannot be edited through admin-accounts (404)', async () => {
    mockAuthAs('super_admin');
    mockQuery.mockResolvedValueOnce({ rows: [] }); // staff-scoped lookup misses
    const res = await request(buildApp())
      .put(`/api/admin/admin-accounts/${TARGET_ID}`)
      .set('Authorization', `Bearer ${tokenFor('super_admin')}`)
      .send({ name: 'New Name' });
    expect(res.status).toBe(404);
  });
});

describe('reset password covers consultants', () => {
  test('reset for a tax_consultant succeeds (200)', async () => {
    mockAuthAs('super_admin');
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: TARGET_ID, email: 'tc@test.pk', role: 'tax_consultant' }] }) // lookup
      .mockResolvedValueOnce({ rows: [] })  // UPDATE password
      .mockResolvedValueOnce({ rows: [] }); // audit
    const res = await request(buildApp())
      .post(`/api/admin/admin-accounts/${TARGET_ID}/reset-password`)
      .set('Authorization', `Bearer ${tokenFor('super_admin')}`)
      .send({ newPassword: 'Str0ng!Passw0rd' });
    expect(res.status).toBe(200);
  });
});
