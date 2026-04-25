// Backend health smoke — the cheapest possible "is the deploy alive?" check.
// Runs against whatever API_URL resolves to (defaults to localhost:3001).

const { test, expect, request } = require('@playwright/test');

test('GET /api/health returns success + DB connected', async () => {
  const api = await request.newContext();
  const res = await api.get(`${process.env.E2E_API_URL}/api/health`);
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.status).toBe('success');
  expect(body.database?.connected).toBe(true);
});

test('helmet headers are present', async () => {
  const api = await request.newContext();
  const res = await api.get(`${process.env.E2E_API_URL}/api/health`);
  const h = res.headers();
  expect(h['x-content-type-options']).toBe('nosniff');
  expect(h['x-frame-options']).toBeDefined();
  expect(h['content-security-policy']).toBeDefined();
});

test('protected route returns 401 without a token', async () => {
  const api = await request.newContext();
  const res = await api.get(`${process.env.E2E_API_URL}/api/tax-computation/years/filable`);
  expect(res.status()).toBe(401);
});
