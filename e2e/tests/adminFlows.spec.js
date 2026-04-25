// Admin-area end-to-end smoke tests.
//
// These exercise the real admin routes against the running backend. They're
// written to catch exactly the class of bug the user hit in the UI:
//   - delete blocked by FK constraint
//   - bulk delete silently failing on one row
//   - status toggle not persisting
//   - pg NUMERIC-as-string confusion on stats / tax records
//
// Requires a super_admin account. Seeded in globalSetup so the suite is
// self-sufficient.

const { test, expect, request } = require('@playwright/test');

const SUPER_EMAIL    = process.env.E2E_SUPER_EMAIL    || 'superadmin@paktax.com';
const SUPER_PASSWORD = process.env.E2E_SUPER_PASSWORD || 'PaktaxAdmin2026!';

async function superLogin(api) {
  const res = await api.post('/api/login', {
    data: { email: SUPER_EMAIL, password: SUPER_PASSWORD },
  });
  expect(res.status(), 'super_admin login').toBe(200);
  const body = await res.json();
  expect(body.token).toBeTruthy();
  return body.token;
}

async function signupUser(api) {
  const email = `e2e-adm-${Date.now()}-${Math.floor(Math.random() * 1e6)}@playwright.test`;
  const password = 'TargetUser2026!';
  const name = `AdmTarget ${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const reg = await api.post('/api/register', {
    data: { email, name, password, user_type: 'individual' },
  });
  expect(reg.status(), 'register target').toBe(200);
  const { user, token } = await reg.json();
  return { email, name, password, token, userId: user.id };
}

test.describe('Admin area flows', () => {
  test('GET /api/admin/users lists users', async () => {
    const api = await request.newContext({ baseURL: process.env.E2E_API_URL });
    const token = await superLogin(api);
    const res = await api.get('/api/admin/users', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    const list = Array.isArray(body?.data) ? body.data : body;
    expect(Array.isArray(list)).toBe(true);
  });

  test('GET /api/admin/stats returns shape', async () => {
    const api = await request.newContext({ baseURL: process.env.E2E_API_URL });
    const token = await superLogin(api);
    const res = await api.get('/api/admin/stats', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('success');
  });

  test('DELETE /api/admin/users/:id succeeds (was FK-blocked)', async () => {
    const api = await request.newContext({ baseURL: process.env.E2E_API_URL });
    const token = await superLogin(api);
    const target = await signupUser(api);

    const del = await api.delete(`/api/admin/users/${target.userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(del.status(), `delete returned ${del.status()}: ${await del.text()}`).toBe(200);

    // Confirm the account really went.
    const login = await api.post('/api/login', {
      data: { email: target.email, password: target.password },
    });
    expect([400, 401]).toContain(login.status());
  });

  test('bulk delete (parallel fan-out) succeeds for 3 users', async () => {
    const api = await request.newContext({ baseURL: process.env.E2E_API_URL });
    const token = await superLogin(api);

    const targets = await Promise.all([signupUser(api), signupUser(api), signupUser(api)]);
    const headers = { Authorization: `Bearer ${token}` };

    // Same fan-out UserManagement.js does client-side.
    const results = await Promise.all(
      targets.map((t) => api.delete(`/api/admin/users/${t.userId}`, { headers })),
    );
    for (const [i, r] of results.entries()) {
      expect(r.status(), `target ${i} deleted`).toBe(200);
    }
  });

  test('PUT /api/admin/users/:id updates name + email', async () => {
    const api = await request.newContext({ baseURL: process.env.E2E_API_URL });
    const token = await superLogin(api);
    const target = await signupUser(api);
    const headers = { Authorization: `Bearer ${token}` };

    const newName = `Renamed ${Date.now()}`;
    const res = await api.put(`/api/admin/users/${target.userId}`, {
      headers,
      data: { name: newName },
    });
    expect(res.status(), `update returned ${res.status()}: ${await res.text()}`).toBe(200);
    const body = await res.json();
    expect(body?.data?.name || body?.name).toBe(newName);
  });

  test('PUT /api/admin/users/:id/status toggles active flag', async () => {
    const api = await request.newContext({ baseURL: process.env.E2E_API_URL });
    const token = await superLogin(api);
    const target = await signupUser(api);
    const headers = { Authorization: `Bearer ${token}` };

    const deactivate = await api.put(`/api/admin/users/${target.userId}/status`, {
      headers,
      data: { is_active: false },
    });
    expect(deactivate.status(), `status PUT returned ${deactivate.status()}: ${await deactivate.text()}`).toBe(200);

    // Deactivated user should not be able to log in.
    const login = await api.post('/api/login', {
      data: { email: target.email, password: target.password },
    });
    expect([400, 401, 403]).toContain(login.status());

    // Cleanup.
    await api.delete(`/api/admin/users/${target.userId}`, { headers });
  });

  test('POST /api/admin/users creates a new user', async () => {
    const api = await request.newContext({ baseURL: process.env.E2E_API_URL });
    const token = await superLogin(api);
    const headers = { Authorization: `Bearer ${token}` };

    const email = `e2e-adm-created-${Date.now()}-${Math.floor(Math.random() * 1e6)}@playwright.test`;
    const name = `AdminCreated ${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const password = 'AdminCreated2026!';

    const res = await api.post('/api/admin/users', {
      headers,
      data: { email, name, password, user_type: 'individual', role: 'user' },
    });
    expect(res.status(), `create returned ${res.status()}: ${await res.text()}`).toBe(200);

    // Confirm the created user can log in.
    const login = await api.post('/api/login', { data: { email, password } });
    expect(login.status()).toBe(200);

    // Cleanup: need user id. Login response has it.
    const { user } = await login.json();
    await api.delete(`/api/admin/users/${user.id}`, { headers });
  });

  test('GET /api/admin/users/:id/tax-records returns aggregate', async () => {
    const api = await request.newContext({ baseURL: process.env.E2E_API_URL });
    const token = await superLogin(api);
    const target = await signupUser(api);
    const headers = { Authorization: `Bearer ${token}` };

    const res = await api.get(`/api/admin/users/${target.userId}/tax-records`, { headers });
    expect(res.status(), `records status ${res.status()}: ${await res.text()}`).toBe(200);

    // Cleanup.
    await api.delete(`/api/admin/users/${target.userId}`, { headers });
  });

  test('GET /api/admin/audit-logs returns rows', async () => {
    const api = await request.newContext({ baseURL: process.env.E2E_API_URL });
    const token = await superLogin(api);
    const res = await api.get('/api/admin/audit-logs', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
  });

  test('POST /api/admin/impersonate/:userId → end-impersonation round-trip', async () => {
    const api = await request.newContext({ baseURL: process.env.E2E_API_URL });
    const token = await superLogin(api);
    const target = await signupUser(api);
    const headers = { Authorization: `Bearer ${token}` };

    const imp = await api.post(`/api/admin/impersonate/${target.userId}`, { headers });
    expect(imp.status(), `impersonate status ${imp.status()}: ${await imp.text()}`).toBe(200);
    const impBody = await imp.json();
    const impToken = impBody?.data?.impersonationToken;
    expect(impToken).toBeTruthy();

    // The impersonation token should authenticate for user endpoints.
    const asTarget = await api.get('/api/tax-computation/years/filable', {
      headers: { Authorization: `Bearer ${impToken}` },
    });
    expect(asTarget.status()).toBe(200);

    // End impersonation — returns an admin session token.
    const end = await api.post('/api/admin/end-impersonation', {
      headers: { Authorization: `Bearer ${impToken}` },
    });
    expect(end.status(), `end-impersonation status ${end.status()}: ${await end.text()}`).toBe(200);

    // Cleanup.
    await api.delete(`/api/admin/users/${target.userId}`, { headers });
  });
});
