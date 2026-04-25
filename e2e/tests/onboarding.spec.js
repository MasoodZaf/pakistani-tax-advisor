// Onboarding flag round-trip — locks in the fix for the bug where the
// OnboardingRoute redirected freshly-registered users to /dashboard the
// moment register() set the auth user, silently skipping steps 2-4 of the
// wizard.
//
// Asserts:
//   - register returns onboarding_completed: false
//   - JWT carries the flag
//   - POST /api/onboarding/complete flips it and reissues a JWT with the
//     new value
//   - existing accounts (pre-migration) come back as completed so they
//     aren't dragged through the wizard again on next login

const { test, expect, request } = require('@playwright/test');

function decodeJwt(token) {
  const [, payload] = token.split('.');
  const padded = payload + '==='.slice(0, (4 - (payload.length % 4)) % 4);
  return JSON.parse(Buffer.from(padded, 'base64url').toString('utf8'));
}

const SUPER_EMAIL    = process.env.E2E_SUPER_EMAIL    || 'superadmin@paktax.com';
const SUPER_PASSWORD = process.env.E2E_SUPER_PASSWORD || 'PaktaxAdmin2026!';

test.describe('Onboarding flag', () => {
  test('register → flag is false in body and JWT', async () => {
    const api = await request.newContext({ baseURL: process.env.E2E_API_URL });

    const email = `e2e-onb-${Date.now()}-${Math.floor(Math.random() * 1e6)}@playwright.test`;
    const reg = await api.post('/api/register', {
      data: { email, name: `OnbReg ${Date.now()}`, password: 'OnbReg2026Test!', user_type: 'individual' },
    });
    expect(reg.status(), await reg.text()).toBe(200);
    const body = await reg.json();
    expect(body.user.onboarding_completed).toBe(false);
    expect(decodeJwt(body.token).onboarding_completed).toBe(false);
  });

  test('POST /api/onboarding/complete flips the flag and reissues a JWT', async () => {
    const api = await request.newContext({ baseURL: process.env.E2E_API_URL });

    const email = `e2e-onb-${Date.now()}-${Math.floor(Math.random() * 1e6)}@playwright.test`;
    const reg = await api.post('/api/register', {
      data: { email, name: `OnbDone ${Date.now()}`, password: 'OnbDone2026Test!', user_type: 'individual' },
    });
    expect(reg.status()).toBe(200);
    const { token: oldToken } = await reg.json();

    const completeRes = await api.post('/api/onboarding/complete', {
      headers: { Authorization: `Bearer ${oldToken}` },
    });
    expect(completeRes.status(), await completeRes.text()).toBe(200);
    const completeBody = await completeRes.json();
    expect(completeBody.user.onboarding_completed).toBe(true);
    expect(completeBody.token).toBeTruthy();
    expect(completeBody.token).not.toBe(oldToken);
    expect(decodeJwt(completeBody.token).onboarding_completed).toBe(true);
  });

  test('login after register reflects the persisted flag', async () => {
    const api = await request.newContext({ baseURL: process.env.E2E_API_URL });

    const email = `e2e-onb-${Date.now()}-${Math.floor(Math.random() * 1e6)}@playwright.test`;
    const password = 'OnbLogin2026Test!';
    const reg = await api.post('/api/register', {
      data: { email, name: `OnbLogin ${Date.now()}`, password, user_type: 'individual' },
    });
    expect(reg.status()).toBe(200);
    const regToken = (await reg.json()).token;

    // Login while still pending — should report false.
    const beforeLogin = await api.post('/api/login', { data: { email, password } });
    expect(beforeLogin.status()).toBe(200);
    const before = await beforeLogin.json();
    expect(before.user.onboarding_completed).toBe(false);

    // Complete and re-login — should report true.
    await api.post('/api/onboarding/complete', { headers: { Authorization: `Bearer ${regToken}` } });
    const afterLogin = await api.post('/api/login', { data: { email, password } });
    expect(afterLogin.status()).toBe(200);
    const after = await afterLogin.json();
    expect(after.user.onboarding_completed).toBe(true);
  });

  test('existing super_admin login reports onboarding_completed: true (migration backfill)', async () => {
    const api = await request.newContext({ baseURL: process.env.E2E_API_URL });
    const res = await api.post('/api/login', { data: { email: SUPER_EMAIL, password: SUPER_PASSWORD } });
    expect(res.status(), await res.text()).toBe(200);
    const body = await res.json();
    // Pre-migration users were flipped to true so they don't get dragged into
    // the new wizard on next login.
    expect(body.user.onboarding_completed).toBe(true);
  });
});
