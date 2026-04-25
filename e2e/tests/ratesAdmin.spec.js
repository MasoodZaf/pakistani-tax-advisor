// Rates-admin end-to-end tests.
//
// Covers Sprint Q: CRUD on tax_rates_config (all 8 non-slab rate types) plus
// the rates-bundle preview/apply workflow. Before Sprint Q these were SQL-only
// — this suite locks the newly exposed admin surface into CI so regressions
// are caught before they hit production.

const { test, expect, request } = require('@playwright/test');

const SUPER_EMAIL    = process.env.E2E_SUPER_EMAIL    || 'superadmin@paktax.com';
const SUPER_PASSWORD = process.env.E2E_SUPER_PASSWORD || 'PaktaxAdmin2026!';

const CURRENT_YEAR = '2025-26';

async function superLogin(api) {
  const res = await api.post('/api/login', {
    data: { email: SUPER_EMAIL, password: SUPER_PASSWORD },
  });
  expect(res.status(), 'super_admin login').toBe(200);
  const body = await res.json();
  return body.token;
}

test.describe('Tax rates admin (non-slab rate_types)', () => {
  test('GET /api/admin/tax-rates/types lists all 8 rate types', async () => {
    const api = await request.newContext({ baseURL: process.env.E2E_API_URL });
    const token = await superLogin(api);
    const res = await api.get('/api/admin/tax-rates/types', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    const expected = [
      'surcharge', 'super_tax', 'withholding', 'capital_gains',
      'final_tax', 'credit_cap', 'deduction_threshold', 'reduction',
    ];
    for (const t of expected) {
      expect(body.data, `type ${t}`).toContain(t);
    }
  });

  test('GET /api/admin/tax-rates filters by taxYear + rateType', async () => {
    const api = await request.newContext({ baseURL: process.env.E2E_API_URL });
    const token = await superLogin(api);
    const headers = { Authorization: `Bearer ${token}` };

    // 400 without taxYear.
    const bad = await api.get('/api/admin/tax-rates', { headers });
    expect(bad.status()).toBe(400);

    const res = await api.get(`/api/admin/tax-rates?taxYear=${CURRENT_YEAR}&rateType=surcharge`, { headers });
    expect(res.status(), await res.text()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    // Every row should have the requested rate_type and year.
    for (const row of body.data) {
      expect(row.rate_type).toBe('surcharge');
      expect(row.tax_year).toBe(CURRENT_YEAR);
      // pg NUMERIC must come back as Number (shapeRow coercion).
      expect(typeof row.tax_rate === 'number' || row.tax_rate === null).toBe(true);
    }
  });

  test('POST /api/admin/tax-rates rejects unknown rate_type', async () => {
    const api = await request.newContext({ baseURL: process.env.E2E_API_URL });
    const token = await superLogin(api);
    const res = await api.post('/api/admin/tax-rates', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        tax_year: CURRENT_YEAR,
        rate_type: 'bogus_rate_type',
        rate_category: 'e2e_bogus',
        tax_rate: 0.1,
      },
    });
    expect(res.status()).toBe(400);
  });

  test('rates CRUD round-trip: POST → PUT → DELETE', async () => {
    const api = await request.newContext({ baseURL: process.env.E2E_API_URL });
    const token = await superLogin(api);
    const headers = { Authorization: `Bearer ${token}` };

    const rate_category = `e2e_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

    // Create — use "reduction" because it's lightly populated; won't clash with
    // seeded categories.
    const createRes = await api.post('/api/admin/tax-rates', {
      headers,
      data: {
        tax_year: CURRENT_YEAR,
        rate_type: 'reduction',
        rate_category,
        tax_rate: 0.25,
        min_amount: 0,
        max_amount: 999999999999,
        fixed_amount: 0,
        description: 'E2E test row',
        fbr_reference: 'E2E',
      },
    });
    expect(createRes.status(), await createRes.text()).toBe(200);
    const created = await createRes.json();
    const id = created.data.id;
    expect(Number(created.data.tax_rate)).toBeCloseTo(0.25, 6);

    // Update — change tax_rate and description.
    const putRes = await api.put(`/api/admin/tax-rates/${id}`, {
      headers,
      data: { tax_rate: 0.4, description: 'E2E updated' },
    });
    expect(putRes.status(), await putRes.text()).toBe(200);
    const updated = await putRes.json();
    expect(Number(updated.data.tax_rate)).toBeCloseTo(0.4, 6);
    expect(updated.data.description).toBe('E2E updated');

    // List should now see the updated row.
    const listRes = await api.get(
      `/api/admin/tax-rates?taxYear=${CURRENT_YEAR}&rateType=reduction`,
      { headers }
    );
    const listBody = await listRes.json();
    const found = listBody.data.find(r => r.id === id);
    expect(found, 'created row in list').toBeTruthy();
    expect(Number(found.tax_rate)).toBeCloseTo(0.4, 6);

    // Delete.
    const delRes = await api.delete(`/api/admin/tax-rates/${id}`, { headers });
    expect(delRes.status()).toBe(200);

    // Gone.
    const afterList = await api.get(
      `/api/admin/tax-rates?taxYear=${CURRENT_YEAR}&rateType=reduction`,
      { headers }
    );
    const afterBody = await afterList.json();
    expect(afterBody.data.find(r => r.id === id)).toBeUndefined();
  });

  test('POST /api/admin/tax-rates rejects duplicate (tax_year, rate_type, rate_category) with 409', async () => {
    const api = await request.newContext({ baseURL: process.env.E2E_API_URL });
    const token = await superLogin(api);
    const headers = { Authorization: `Bearer ${token}` };

    const rate_category = `e2e_dup_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

    const payload = {
      tax_year: CURRENT_YEAR,
      rate_type: 'reduction',
      rate_category,
      tax_rate: 0.1,
    };
    const first = await api.post('/api/admin/tax-rates', { headers, data: payload });
    expect(first.status()).toBe(200);
    const firstId = (await first.json()).data.id;

    // Duplicate insert should return 409 (pg unique violation → mapped by route).
    const dup = await api.post('/api/admin/tax-rates', { headers, data: payload });
    expect(dup.status()).toBe(409);

    // Cleanup.
    await api.delete(`/api/admin/tax-rates/${firstId}`, { headers });
  });
});

test.describe('Rates bundle (preview / apply round-trip)', () => {
  test('GET /api/admin/rates-bundle/info returns bundle metadata', async () => {
    const api = await request.newContext({ baseURL: process.env.E2E_API_URL });
    const token = await superLogin(api);
    const res = await api.get('/api/admin/rates-bundle/info', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status(), await res.text()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('version');
    expect(body.data).toHaveProperty('checksum');
    expect(body.data).toHaveProperty('checksum_ok');
    expect(Array.isArray(body.data.years)).toBe(true);
    expect(body.data.years.length).toBeGreaterThan(0);
  });

  test('GET /api/admin/rates-bundle/preview returns diff shape', async () => {
    const api = await request.newContext({ baseURL: process.env.E2E_API_URL });
    const token = await superLogin(api);
    const res = await api.get('/api/admin/rates-bundle/preview', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status(), await res.text()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('total_changes');
    expect(typeof body.data.total_changes).toBe('number');
    expect(Array.isArray(body.data.years)).toBe(true);

    for (const y of body.data.years) {
      expect(y).toHaveProperty('tax_year');
      expect(y).toHaveProperty('summary');
      expect(y).toHaveProperty('diff');
      expect(y.diff).toHaveProperty('slabs');
      expect(y.diff).toHaveProperty('rates');
    }
  });

  test('POST /api/admin/rates-bundle/apply is idempotent (second apply → 0 changes)', async () => {
    const api = await request.newContext({ baseURL: process.env.E2E_API_URL });
    const token = await superLogin(api);
    const headers = { Authorization: `Bearer ${token}` };

    // Apply once — works regardless of current diff state.
    const apply1 = await api.post('/api/admin/rates-bundle/apply', { headers });
    expect(apply1.status(), await apply1.text()).toBe(200);
    const body1 = await apply1.json();
    expect(body1.success).toBe(true);
    expect(Array.isArray(body1.data.applied)).toBe(true);

    // Preview after apply → must be 0 total_changes (upsert is deterministic).
    const prevRes = await api.get('/api/admin/rates-bundle/preview', { headers });
    const prevBody = await prevRes.json();
    expect(prevBody.data.total_changes).toBe(0);

    // Applying again should still succeed and remain a no-op diff.
    const apply2 = await api.post('/api/admin/rates-bundle/apply', { headers });
    expect(apply2.status()).toBe(200);

    const prevRes2 = await api.get('/api/admin/rates-bundle/preview', { headers });
    const prevBody2 = await prevRes2.json();
    expect(prevBody2.data.total_changes).toBe(0);
  });

  test('rates-bundle apply rejects non-super_admin with 403', async () => {
    const api = await request.newContext({ baseURL: process.env.E2E_API_URL });

    // Create a non-super user.
    const email = `e2e-rb-${Date.now()}-${Math.floor(Math.random() * 1e6)}@playwright.test`;
    const reg = await api.post('/api/register', {
      data: { email, name: 'Rates Bundle E2E', password: 'RbE2eUser2026!', user_type: 'individual' },
    });
    expect(reg.status()).toBe(200);
    const regBody = await reg.json();
    const userToken = regBody.token;
    const userId = regBody.user?.id;

    const res = await api.post('/api/admin/rates-bundle/apply', {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    expect([401, 403]).toContain(res.status());

    // Cleanup via super_admin.
    const superToken = await superLogin(api);
    if (userId) {
      await api.delete(`/api/admin/users/${userId}`, {
        headers: { Authorization: `Bearer ${superToken}` },
      });
    }
  });
});
