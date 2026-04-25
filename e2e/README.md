# End-to-end smoke tests

Playwright smoke suite — just enough to catch the worst kind of deploy
regression. Not a comprehensive feature test.

## Install

```bash
cd e2e
npm install
npx playwright install chromium   # one-time browser download
```

## Run

Against a locally-running stack:

```bash
# terminal 1 — start the backend
cd backend && npm start

# terminal 2 — skip the auto-spawned webServer (our dev one is already up)
cd e2e && E2E_SKIP_WEBSERVER=1 npx playwright test
```

Against a fresh stack (Playwright starts the backend):

```bash
cd e2e && npx playwright test
```

Env overrides:
- `E2E_API_URL` — defaults to `http://localhost:3001`
- `E2E_WEB_URL` — defaults to `http://localhost:3000`
- `E2E_SKIP_WEBSERVER=1` — don't auto-spawn the backend

## What's covered

- `tests/health.spec.js` — `/api/health` 200, helmet headers present, 401 on
  unauthenticated access to protected routes.
- `tests/auth.spec.js` — register + login + authenticated call to
  `/api/tax-computation/years/filable`; password policy enforcement; bad
  login returns 4xx.

## What's NOT covered (yet)

- UI flows (the React pages themselves). Would need the frontend running +
  form selectors. Good next step but out of this smoke tier.
- Tax computation end-to-end (income form → preview → save).
- Prior-year archive upload / copy-forward.
- Admin flows (impersonation, audit log).
