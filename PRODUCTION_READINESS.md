# Production Readiness Checklist

This is the single document an operator walks through before pointing real
users at this deployment. It lists **what must be true** (not what *was*
true in development). Items are grouped so you can skim quickly.

Last updated: 2026-04-24.

---

## 1. Environment variables

Every one of these must be set in the target environment. The app refuses to
boot without `JWT_SECRET` and `DB_PASSWORD`.

| Variable | Required? | Notes |
|---|---|---|
| `NODE_ENV` | **yes** — set to `production` | Enables helmet CSP, prod log level, response sanitizer, SSL on pg pool. |
| `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` / `DB_PASSWORD` | **yes** | No default passwords — boot fails. |
| `DATABASE_URL` | **yes** | Prisma uses this. Keep consistent with the discrete vars above. |
| `JWT_SECRET` | **yes**, ≥32 chars | Generate: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`. |
| `SESSION_SECRET` | yes | Same generator. |
| `CORS_ORIGINS` | yes | Comma-separated list of frontend origins (e.g. `https://yourdomain.com`). |
| `FRONTEND_URL` | yes | Same origin as the React build. |
| `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` | **yes, once** | For bootstrap run. Password ≥12 chars, ≥1 letter, ≥1 digit. |
| `ENABLE_TEST_ROUTES` | **must NOT be** `true` in prod | Gates `/api/test/*` destructive endpoints behind a super_admin + env flag. |
| `DB_MAX_CONNECTIONS` | optional, default 20 | Bump on busy deployments. |
| `DB_CONNECT_TIMEOUT` | optional, default 5000 ms | Fails a connection attempt fast. |
| `DB_STATEMENT_TIMEOUT` | optional, default 30000 ms | Server-side runaway-query guard. |
| `MAX_SESSION_AGE_DAYS` | optional, default 30 | Used by the session-cleanup script. |
| `BACKUP_DIR` / `BACKUP_RETENTION_DAYS` / `BACKUP_S3_BUCKET` | optional | Used by `scripts/backup.sh`. |

**Never commit `.env`.** Both `.env` and `backend/.env` are in `.gitignore`.

---

## 2. Database bootstrap

The root-level `schema.sql` is **archived** as `schema.legacy.sql` and must
not be used. The authoritative flow is:

```bash
cd backend

# 1. Prisma baseline — creates all tables.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f prisma/migrations/0_init/migration.sql

# 2. Phase migrations — apply IN ORDER. These:
#    - add UNIQUE(user_id, tax_year) to 11 form tables
#    - seed rate tables (tax_slabs + tax_rates_config) for TY 2024-25 and 2025-26
#    - add the tax_years_filable view
#    - upgrade tax_return_history to the archive model
for f in $(ls database/migrations/phase-*.sql | sort); do
  echo "applying $f"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"
done

# 3. Verify.
psql "$DATABASE_URL" -c "SELECT * FROM tax_years_filable;"
# Expect: at least one row with is_current=true.

psql "$DATABASE_URL" -c "SELECT tax_year, COUNT(*) FROM tax_slabs JOIN tax_years ON tax_slabs.tax_year_id=tax_years.id GROUP BY tax_year;"
# Expect: 6 individual slabs per seeded year.
```

---

## 3. Super admin bootstrap

```bash
cd backend
SUPER_ADMIN_EMAIL=you@example.com \
SUPER_ADMIN_PASSWORD="$(node -e 'console.log(require(\"crypto\").randomBytes(18).toString(\"base64\"))')" \
node create-super-admin.js
```

- Script prints the email but **not the password** on success.
- Log in immediately, change the password, confirm the user appears in
  `users` with `role='super_admin'`.

---

## 4. Secrets hygiene

- [ ] `JWT_SECRET` is a fresh, random ≥32-char value (not from `.env.example`).
- [ ] `DB_PASSWORD` is not `admin` / `password` / `postgres` / any published default.
- [ ] No `.env` file committed. `git log -p --all | grep -E "JWT_SECRET|DB_PASSWORD"` returns nothing.
- [ ] `ENABLE_TEST_ROUTES` unset or explicitly `false`.
- [ ] `create-super-admin.js` default password `SuperAdmin@2025` is **not** in use — script refuses to run without env vars.
- [ ] Super-admin account rotated away from any dev-seed password.

---

## 5. Network / deploy config

- [ ] Postgres port **not** published to the host. `docker-compose.prod.yml`
      uses `expose: "5432"`, not `ports: "5432:5432"`.
- [ ] Backend behind a reverse proxy (Render / Railway / nginx / ALB).
      `app.set('trust proxy', 1)` is already enabled — req.ip will reflect
      the real client.
- [ ] HTTPS terminated at the proxy. The helmet CSP emits
      `upgrade-insecure-requests`.
- [ ] `CORS_ORIGINS` contains only the exact frontend origin(s).

---

## 6. Backups

- [ ] Cron entry for `scripts/backup.sh`, e.g.:
      `0 3 * * * /path/to/scripts/backup.sh >> /var/log/tax_advisor_backup.log 2>&1`
- [ ] `BACKUP_DIR` is on durable storage, **not** the app container's FS.
- [ ] `BACKUP_S3_BUCKET` set OR dumps mirrored offsite some other way.
- [ ] At least one restore dry-run completed (restore into a scratch DB
      and confirm row counts + `tax_years_filable` view).

---

## 7. Log rotation + monitoring

- [ ] `backend/logs/` is on durable storage (not container-ephemeral) OR logs
      shipped to a provider.
- [ ] `winston-daily-rotate-file` is configured (combined-*.log, error-*.log,
      gzip, 14 and 30 day retention). Default in `backend/src/utils/logger.js`.
- [ ] Error-tracking hook (Sentry / equivalent) wired to the central
      Express error handler in `backend/src/app.js`. Not yet done — document
      gap.
- [ ] Health endpoint `/api/health` responds 200 from the deployed host.
- [ ] Status-page / uptime monitor polls `/api/health`.

---

## 8. Scheduled maintenance

- [ ] Session sweep cron, e.g.:
      `0 4 * * * cd /path/to/app/backend && node src/scripts/cleanupExpiredSessions.js`
- [ ] Any rate-table updates (new Finance Act) applied as a new
      `database/migrations/phase-<letter>-*.sql` file, not by editing rows
      in place. Existing filers for the closed year keep their historical rates.

---

## 9. Application-level settings

- [ ] `helmet()` + `compression()` wired in `backend/src/app.js` (done).
- [ ] `express.json({ limit: '1mb' })` (done).
- [ ] Rate limiters sit behind trust-proxy so they key on real client IP (done).
- [ ] Prod error sanitizer strips `error` field from 5xx responses (done).
- [ ] bcrypt work factor is 12 (done, via `BCRYPT_ROUNDS`).
- [ ] Password policy ≥12 chars + letter + digit enforced on register /
      change-password / admin-reset / super-admin bootstrap (done).

---

## 10. Tax data sanity

- [ ] `tax_years_filable` returns the year(s) you expect.
- [ ] `tax_rates_config` has rows for each of `surcharge`, `super_tax`,
      `withholding`, `capital_gains`, `final_tax`, `credit_cap`,
      `deduction_threshold`, `reduction` for the current year.
- [ ] `tax_slabs` has 6 rows for slab_type='individual' per seeded year.
- [ ] Run `cd backend && npx jest` — all 42 tests pass.
- [ ] Smoke: log in as a test user, fill the income form, confirm the
      tax-computation summary renders without a "rates not available" banner.

---

## 11. Audit / compliance

- [ ] Audit-log is writing. After any admin action (user create / delete,
      password reset, impersonation), row in `audit_log` confirms fail-closed
      behavior.
- [ ] `REVOKE DELETE ON audit_log` applied at DB level (future hardening —
      currently only enforced at application layer).
- [ ] Privileged actions (impersonation, view credentials) issue audits
      with `severity='high'` and are surfaced in the audit-log UI.

---

## 12. Known gaps (document, don't hide)

- Frontend uses `react-hook-form`'s `watch()` without per-field subscription
  — large forms re-render on every keystroke. Not a correctness issue.
- No E2E test suite (Cypress / Playwright).
- Mobile app is a prototype; not for end users (see `mobile/README.md`).
- No automatic Sentry / OpsGenie wiring — errors surface only in the log file
  until you add an APM transport.
- FBR Iris format compatibility isn't programmatically verified. Do a
  one-time parity check with a qualified filer before first real filing.

---

## 13. Final smoke run

```bash
cd backend

# Boot
DB_PASSWORD=… JWT_SECRET=… NODE_ENV=production npm start &
APP=$!

sleep 5
curl -s http://localhost:3001/api/health   # expect 200
curl -s -I http://localhost:3001/api/health | grep -i security-policy  # expect CSP header

# Shutdown cleanly
kill -TERM $APP
wait $APP
# Expect: "SIGTERM received — shutting down gracefully" + "DB pool closed"
```

If any checkbox in sections 1–11 is unchecked, you are not ready.
