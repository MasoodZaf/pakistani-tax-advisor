/**
 * Integration tests for the derived notifications feed (phase-z10).
 * Same mocked-pool strategy as the other integration suites.
 */

const express = require('express');
const jwt = require('jsonwebtoken');

const mockQuery = jest.fn();

jest.mock('../../src/config/database', () => ({
  pool: { query: (...args) => mockQuery(...args) },
}));

jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
}));

process.env.JWT_SECRET = 'test-secret-do-not-use-in-prod-padded-to-32-chars';

const request = require('supertest');
const notificationsRoutes = require('../../src/routes/notifications');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/notifications', notificationsRoutes);
  return app;
}

const USER_ID = '44444444-4444-4444-4444-444444444444';
const token = jwt.sign({ userId: USER_ID, role: 'user' }, process.env.JWT_SECRET);

function mockAuth() {
  mockQuery.mockResolvedValueOnce({
    rows: [{ id: USER_ID, name: 'user', email: 'user@test.pk', role: 'user', user_type: 'individual', token_version: null }],
  });
}

beforeEach(() => mockQuery.mockReset());

describe('GET /api/notifications', () => {
  test('maps audit events to user-facing items with unread state', async () => {
    mockAuth();
    const old = new Date(Date.now() - 86400000).toISOString();
    const fresh = new Date().toISOString();
    // Promise.all order: seen lookup, events, current tax year
    mockQuery
      .mockResolvedValueOnce({ rows: [{ notifications_seen_at: new Date(Date.now() - 3600000).toISOString() }] })
      .mockResolvedValueOnce({
        rows: [
          { id: 'e1', user_email: 'consultant@test.pk', action: 'impersonate_start', new_value: null, change_summary: '', created_at: fresh },
          { id: 'e2', user_email: 'super@test.pk', action: 'consultant_assigned', new_value: '{"consultant_email":"consultant@test.pk"}', change_summary: '', created_at: old },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ tax_year: '1999-00' }] }); // deadline long past → no synthetic item

    const res = await request(buildApp())
      .get('/api/notifications')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const { items, unread } = res.body.data;
    expect(items).toHaveLength(2);
    expect(items[0].title).toBe('Your account was accessed');
    expect(items[0].unread).toBe(true);
    expect(items[1].title).toBe('Consultant assigned');
    expect(items[1].body).toContain('consultant@test.pk');
    expect(items[1].unread).toBe(false); // older than seen marker
    expect(unread).toBe(1);
    // Feed query excludes self-initiated events and scopes to this user.
    const feedCall = mockQuery.mock.calls[2];
    expect(feedCall[0]).toContain('record_id = $1');
    expect(feedCall[0]).toContain('user_id <> $1');
    expect(feedCall[1][0]).toBe(USER_ID);
  });

  test('never-seen user gets everything unread', async () => {
    mockAuth();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ notifications_seen_at: null }] })
      .mockResolvedValueOnce({
        rows: [{ id: 'e1', user_email: 's@test.pk', action: 'password_reset', new_value: null, change_summary: '', created_at: new Date().toISOString() }],
      })
      .mockResolvedValueOnce({ rows: [] });
    const res = await request(buildApp())
      .get('/api/notifications')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.unread).toBe(1);
    expect(res.body.data.items[0].type).toBe('security');
  });

  test('unauthenticated request is rejected', async () => {
    const res = await request(buildApp()).get('/api/notifications');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/notifications/seen', () => {
  test('stamps notifications_seen_at for the caller', async () => {
    mockAuth();
    mockQuery.mockResolvedValueOnce({ rows: [] }); // UPDATE
    const res = await request(buildApp())
      .post('/api/notifications/seen')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const updateCall = mockQuery.mock.calls[1];
    expect(updateCall[0]).toContain('UPDATE users SET notifications_seen_at');
    expect(updateCall[1]).toEqual([USER_ID]);
  });
});
