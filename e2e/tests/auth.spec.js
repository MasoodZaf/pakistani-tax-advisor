// Auth smoke — register + login produce a working JWT that can hit a
// protected route. Uses a freshly-generated email each run so the suite
// can run repeatedly without polluting the DB.

const { test, expect, request } = require('@playwright/test');

function uniqueEmail() {
  return `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@playwright.test`;
}

test('register → login → /current protected call', async () => {
  const api = await request.newContext({ baseURL: process.env.E2E_API_URL });

  const email = uniqueEmail();
  const name = `E2E User ${Date.now()}`;
  // Matches the policy from backend/src/helpers/passwordPolicy.js.
  const password = 'PlaywrightSmoke123!';

  // Register.
  const reg = await api.post('/api/register', {
    data: { email, name, password, user_type: 'individual' },
  });
  expect(reg.status()).toBe(200);
  const regBody = await reg.json();
  expect(regBody.success).toBe(true);
  expect(regBody.token).toBeTruthy();

  // Login against the just-registered account.
  const login = await api.post('/api/login', { data: { email, password } });
  expect(login.status()).toBe(200);
  const loginBody = await login.json();
  expect(loginBody.success).toBe(true);
  expect(loginBody.token).toBeTruthy();

  // Authenticated call — filable years should be reachable with a user token.
  const filable = await api.get('/api/tax-computation/years/filable', {
    headers: { Authorization: `Bearer ${loginBody.token}` },
  });
  expect(filable.status()).toBe(200);
  const filableBody = await filable.json();
  expect(filableBody.success).toBe(true);
  expect(Array.isArray(filableBody.data)).toBe(true);
  expect(filableBody.data.length).toBeGreaterThan(0);
});

test('register rejects weak password (policy)', async () => {
  const api = await request.newContext({ baseURL: process.env.E2E_API_URL });
  const reg = await api.post('/api/register', {
    data: {
      email: uniqueEmail(),
      name: `E2E Weak ${Date.now()}`,
      password: 'short1', // fails length + letter/digit check
    },
  });
  expect(reg.status()).toBe(400);
  const body = await reg.json();
  expect(body.error).toMatch(/policy/i);
});

test('login rejects wrong password', async () => {
  const api = await request.newContext({ baseURL: process.env.E2E_API_URL });
  const res = await api.post('/api/login', {
    data: { email: 'no-such-user@example.com', password: 'wrongPassword123' },
  });
  expect([400, 401]).toContain(res.status());
});
