#!/usr/bin/env bash
#
# Browser-path smoke test.
#
# WHY THIS EXISTS
# ---------------
# In August 2026 production login and signup were dead for days while every
# health signal reported green:
#
#   * `docker ps`                -> Up 3 weeks (healthy)
#   * frontend healthcheck        -> curl -f http://localhost:80        200
#   * backend  healthcheck        -> curl -f http://localhost:3001/api/health  200
#   * /api/health from outside    -> 200, database.connected: true
#
# Every one of those probes passed because every one of them tests the server
# from INSIDE the box. The actual failure was in the shipped JavaScript: it had
# a retired API hostname baked in at build time, so the BROWSER — and only the
# browser — could not reach the backend. No server-side check can see that.
#
# So this script deliberately tests only what a browser experiences, from
# outside, over the real public hostname: DNS -> CDN -> Caddy -> nginx ->
# backend -> Postgres. If this passes, a user can log in. That is the whole
# contract.
#
# USAGE
#   scripts/smoke.sh https://mera-tax.com
#   scripts/smoke.sh https://staging.mera-tax.com
#
# Exit status is 0 only if every check passes, so it is safe to chain after a
# deploy or run from cron:
#   docker compose ... up -d --build frontend && scripts/smoke.sh https://mera-tax.com
#
set -uo pipefail

BASE="${1:-}"
if [ -z "$BASE" ]; then
  echo "usage: $0 <base-url>   e.g. $0 https://mera-tax.com" >&2
  exit 2
fi
BASE="${BASE%/}"
HOST="$(printf '%s' "$BASE" | sed -E 's#^https?://##; s#/.*$##')"
CURL="curl -sS --max-time 25"

FAILURES=0
pass() { printf '  \033[32mPASS\033[0m  %s\n' "$1"; }
fail() { printf '  \033[31mFAIL\033[0m  %s\n' "$1"; FAILURES=$((FAILURES + 1)); }
info() { printf '        %s\n' "$1"; }

# Same-site test mirroring Frontend/src/utils/apiBase.js: last two labels.
registrable() { printf '%s' "$1" | tr 'A-Z' 'a-z' | awk -F. '{ if (NF<2) print $0; else print $(NF-1)"."$NF }'; }

printf '\nBrowser-path smoke test: %s\n\n' "$BASE"

# ---------------------------------------------------------------- 1. the page
code=$($CURL -o /tmp/smoke-index.$$ -w '%{http_code}' "$BASE/" 2>/dev/null)
if [ "$code" = "200" ]; then
  pass "index.html served (200)"
else
  fail "index.html returned $code (expected 200)"
fi

# index.html MUST NOT be cached, or browsers keep loading a stale bundle hash
# after a deploy and the fix appears not to have shipped.
if $CURL -I "$BASE/" 2>/dev/null | grep -qi 'cache-control:.*no-cache'; then
  pass "index.html is no-cache (deploys reach returning browsers)"
else
  fail "index.html is NOT no-cache — users can be pinned to a stale bundle"
fi

# ------------------------------------------------------------- 2. the bundle
BUNDLE=$(grep -oE '/static/js/main\.[a-z0-9]+\.js' /tmp/smoke-index.$$ 2>/dev/null | head -1)
if [ -n "$BUNDLE" ]; then
  pass "bundle referenced: $BUNDLE"
  if $CURL -o /tmp/smoke-bundle.$$ -w '' "$BASE$BUNDLE" 2>/dev/null && [ -s /tmp/smoke-bundle.$$ ]; then
    pass "bundle downloads"

    # THE CHECK THAT WOULD HAVE CAUGHT THE OUTAGE.
    # Assert the API origin baked into the bundle is same-origin (empty) or at
    # least on the same site as the host we are testing.
    baked=$(grep -oE 'REACT_APP_API_BASE_URL:"[^"]*"' /tmp/smoke-bundle.$$ | head -1 | sed -E 's/^[^:]*:"//; s/"$//')
    if [ -z "$baked" ]; then
      pass "bundle API base is same-origin (empty) — correct behind Caddy"
    else
      bhost=$(printf '%s' "$baked" | sed -E 's#^https?://##; s#[:/].*$##')
      if [ "$(registrable "$bhost")" = "$(registrable "$HOST")" ]; then
        pass "bundle API base '$baked' is same-site as $HOST"
      else
        fail "bundle API base '$baked' is a DIFFERENT SITE from $HOST"
        info "this is the August 2026 failure: the browser cannot reach it,"
        info "while every server-side health check stays green."
      fi
    fi
  else
    fail "bundle $BUNDLE did not download"
  fi
else
  fail "no /static/js/main.*.js reference found in index.html"
fi

# -------------------------------------------------------------- 3. the API
health=$($CURL "$BASE/api/health" 2>/dev/null)
if printf '%s' "$health" | grep -q '"status":"success"'; then
  pass "/api/health reachable same-origin"
else
  fail "/api/health did not return success — got: ${health:-<empty>}"
fi
if printf '%s' "$health" | grep -q '"connected":true'; then
  pass "database connected"
else
  fail "database NOT connected"
fi

# ------------------------------------------------------- 4. login round-trip
# The single most important assertion. A deliberately wrong password must come
# back as a clean 401 from the application. Anything else means the browser
# never reached the app:
#   000 -> DNS/TLS/connection failure  (what the outage actually looked like)
#   404 -> route not mounted / bad proxy path
#   5xx -> backend or database down
resp=$($CURL -o /tmp/smoke-login.$$ -w '%{http_code}' \
  -X POST "$BASE/api/login" \
  -H 'Content-Type: application/json' \
  -H "Origin: $BASE" \
  -d '{"email":"smoke-probe@example.invalid","password":"deliberately-wrong"}' 2>/dev/null)
case "$resp" in
  401) pass "POST /api/login rejects bad credentials with 401 (login path is live)" ;;
  000) fail "POST /api/login could not connect at all (DNS/TLS) — this is the outage signature" ;;
  *)   fail "POST /api/login returned $resp (expected 401): $(head -c 160 /tmp/smoke-login.$$ 2>/dev/null)" ;;
esac

# CORS must name this exact origin, or the browser discards the response even
# when the server answered correctly.
acao=$($CURL -o /dev/null -D - -X POST "$BASE/api/login" \
  -H 'Content-Type: application/json' -H "Origin: $BASE" \
  -d '{"email":"smoke-probe@example.invalid","password":"deliberately-wrong"}' 2>/dev/null \
  | grep -i '^access-control-allow-origin:' | tr -d '\r' | awk '{print $2}')
if [ "$acao" = "$BASE" ]; then
  pass "CORS allows $BASE"
else
  fail "CORS allow-origin is '${acao:-<none>}', expected '$BASE'"
fi

rm -f /tmp/smoke-index.$$ /tmp/smoke-bundle.$$ /tmp/smoke-login.$$

printf '\n'
if [ "$FAILURES" -eq 0 ]; then
  printf '\033[32mAll checks passed — a user can log in at %s\033[0m\n\n' "$BASE"
  exit 0
fi
printf '\033[31m%s check(s) FAILED — %s is not fully usable\033[0m\n\n' "$FAILURES" "$BASE"
exit 1
