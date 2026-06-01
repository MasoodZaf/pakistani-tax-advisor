# Deploy — tax-advisor on the VPS (codearc-staging-01)

This VPS co-hosts several apps behind ONE Caddy (a host process, **not** nginx).
Public routing for tax:

    tax.aurmak.com      ->  127.0.0.1:4000   (frontend)
    api.tax.aurmak.com  ->  127.0.0.1:3001   (backend)

The stack MUST be brought up with **both** compose files. `docker-compose.override.yml`
is host-local (gitignored — copy it from `docker-compose.override.yml.example`). It:

- binds backend to `127.0.0.1:${BACKEND_HOST_PORT}` (`prod.yml` ALONE exposes `0.0.0.0:3001`)
- binds frontend to `127.0.0.1:${FRONTEND_HOST_PORT}`
- renames containers to `tax-advisor-*` (dashes; avoids clashing with co-hosted stacks)
- sets the CORS allowlist + the testing-phase rate limits (login 200/15min, api 1000/min)

## Required in `.env`

    BACKEND_HOST_PORT=3001          # MUST match the Caddy api route (api.tax.aurmak.com)
    FRONTEND_HOST_PORT=4000         # MUST match the Caddy frontend route (tax.aurmak.com)
    REACT_APP_API_URL=https://api.tax.aurmak.com

`REACT_APP_API_URL` is baked into the frontend at **build time**
(`axios.defaults.baseURL = process.env.REACT_APP_API_URL || 'http://localhost:3001'`).
If it is missing, a rebuilt bundle bakes `localhost:3001` and the live site breaks.

**Do NOT delete `BACKEND_HOST_PORT` / `FRONTEND_HOST_PORT`** — the override references
them with no default, so deleting them breaks the deploy.

## Canonical deploy — ALWAYS both -f files

    cd /opt/tax-advisor
    git pull --ff-only origin main
    docker compose -f docker-compose.prod.yml -f docker-compose.override.yml build
    docker compose -f docker-compose.prod.yml -f docker-compose.override.yml up -d

## Backend-only restart (after a code / .env change)

    docker compose -f docker-compose.prod.yml -f docker-compose.override.yml up -d --no-deps backend

## DO NOT do this

    docker compose -f docker-compose.prod.yml up -d backend     # <-- drops the override

It puts backend on PUBLIC `0.0.0.0:3001`, loses the testing rate limits + CORS, and
`api.tax.aurmak.com` 502s if Caddy is dialing a different port.

## Health check (is it correct?)

  - `docker ps` shows `tax-advisor-backend` (DASHES) on `127.0.0.1:3001->3001/tcp`
  - underscore names (`tax_advisor_backend`) == override was dropped == BROKEN
  - quick verify:

        curl -s -o /dev/null -w '%{http_code}\n' https://api.tax.aurmak.com/api/health        # 200
        curl -s -o /dev/null -w '%{http_code}\n' -X POST https://api.tax.aurmak.com/api/login  # 400/401, NOT 502
        curl -s -o /dev/null -w '%{http_code}\n' https://tax.aurmak.com                         # 200

## DB migrations

initdb scripts only run on an EMPTY volume, so they do NOT re-run on a container
recreate. Apply migrations additively to the live DB, after a dump:

    docker exec tax-advisor-db pg_dump -U postgres -d tax_advisor | gzip > ~/predeploy_$(date +%F).sql.gz
    cat backend/database/migrations/<file>.sql | docker exec -i tax-advisor-db psql -U postgres -d tax_advisor -v ON_ERROR_STOP=1

## History

- 2026-05-31 — backend restarted with `prod.yml` only -> override dropped -> login 502.
  Fixed by recreating with both -f files (`--no-deps backend`).
- 2026-06-01 — standardized backend on **3001** (was 4001); audit PR #1 deployed;
  `is_atl` migration applied; the public `0.0.0.0:3001` exposure was closed.
