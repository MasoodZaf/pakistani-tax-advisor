# Runbook — "Network Error" on login / signup

## The failure this document exists for

**26 Aug 2026.** Production login and signup were dead. Users saw a red
**"Network Error"** toast. It had been broken for days.

Nothing was down:

| Signal | Reading during the outage |
|---|---|
| `docker ps` | `Up 3 weeks (healthy)` — all three containers |
| frontend healthcheck | `curl -f http://localhost:80` → 200 |
| backend healthcheck | `curl -f http://localhost:3001/api/health` → 200 |
| `/api/health` from outside | 200, `database.connected: true` |
| `RestartCount` | 0 — no crash, no OOM, no restart |

**It was not a crash.** The shipped JavaScript bundle had a dead API hostname
baked into it at build time. Only the browser was affected, and no server-side
check can see that.

### Root cause chain

1. Prod `.env` still carried `REACT_APP_API_URL=https://api.tax.aurmak.com`
   from before the mera-tax.com rebrand.
2. `Frontend/Dockerfile` defaults `REACT_APP_API_BASE_URL` to
   `REACT_APP_API_URL`, so the value was **baked into the bundle** at build
   time. Restarting the container cannot change it — only a rebuild can.
3. That value was harmless while `api.tax.aurmak.com` still pointed at this
   box. Later the `aurmak.com` DNS was repointed to an unrelated IONOS server
   (`88.208.255.166`, Hestia panel, self-signed cert).
4. Every browser API call then died in the TLS handshake →
   `TypeError: Failed to fetch` → axios surfaces `"Network Error"`.
5. `apiBase.js` **failed open**: its guard only rejected *loopback* base URLs.
   A public hostname that simply was not ours passed straight through, with no
   console warning.

The outage cost days, not minutes, because **nobody was told**.

## Diagnose in 60 seconds

```bash
scripts/smoke.sh https://mera-tax.com
```

This asserts only what a browser experiences, from outside. If it passes, a
user can log in. Read the first failing line:

| Failing check | Meaning |
|---|---|
| `bundle API base ... is a DIFFERENT SITE` | **This outage.** Rebuild the frontend (below). |
| `POST /api/login could not connect at all` | DNS / TLS / Caddy route. Check `dig`, then `sudo caddy validate`. |
| `POST /api/login returned 404` | Route not mounted or proxy path wrong. Login is `/api/login`, **not** `/api/auth/login`. |
| `POST /api/login returned 5xx` | Backend or DB. `docker logs tax-advisor-backend --since 10m`. |
| `database NOT connected` | Postgres. `docker ps`, then DB logs. |
| `CORS allow-origin is ...` | `CORS_ORIGINS` in `docker-compose.override.yml` (the override **wins** over `.env`). |
| `index.html is NOT no-cache` | Deploys will not reach returning browsers. Check `Frontend/nginx.conf`. |

## Fix: a stale API host in the bundle

```bash
cd /opt/tax-advisor
cp -a .env .env.bak.$(date +%Y%m%d-%H%M%S)

# Empty = same-origin. Deliberately empty, not hardcoded to the current domain,
# so it cannot rot again at the next rename.
sed -i -E 's#^REACT_APP_API_URL=.*#REACT_APP_API_URL=#' .env

CF="-f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.override.yml"
docker compose $CF config | grep -A3 published:      # ports MUST stay 127.0.0.1
docker compose $CF up -d --build frontend

scripts/smoke.sh https://mera-tax.com
```

`--build frontend` also recreates `backend` (it is a `depends_on` and shares
env). The database is **not** recreated.

> **Before any `up --build` on prod**, dry-run `docker compose config` and diff
> the resolved ports against the running containers. The `database` service has
> published `0.0.0.0:5432` past `ufw` before. Ports must read `127.0.0.1`.

## "I fixed it but it still fails for me"

Almost always a stale bundle in *your* browser. Hashed assets are served
`immutable, max-age=31536000`, so the old file stays in the CDN and in your
cache for a year. `index.html` is `no-cache`, so a genuinely fresh load is
correct.

Hard-refresh (`Cmd+Shift+R`), or use a private window. Confirm in DevTools →
Network that the bundle hash matches what `scripts/smoke.sh` reports. Optionally
purge the Cloudflare cache for `/static/js/*` to protect other users.

## The three defences now in place

1. **Prevention — `Frontend/src/utils/apiBase.js`.** A configured API base on a
   different *site* than the page is refused in production and falls back to
   same-origin, which is correct behind Caddy. The bad build would have served
   a working app. Opt out deliberately with
   `REACT_APP_API_ALLOW_CROSS_SITE=true`. Pinned by tests in `apiBase.test.js`.
2. **Detection — `scripts/smoke.sh`.** Tests the browser path from outside.
   Exit 0 pass / 1 fail / 2 usage, so it chains after a deploy.
3. **Notification — `scripts/smoke-cron.sh`.** Every 5 minutes via cron. Emails
   on state change only (down / recovered), re-nags every 6h while broken.
   Log: `/var/tmp/meratax-smoke/smoke.log`.

## Known gap

Cron runs **on the box it monitors**. If the whole server or its network dies,
no alert is sent. An external monitor (UptimeRobot, Better Stack, Cloudflare
Health Checks) pointed at `https://mera-tax.com/api/health` closes that hole and
is the recommended complement — it cannot do the bundle check, but it survives
the box going away.
