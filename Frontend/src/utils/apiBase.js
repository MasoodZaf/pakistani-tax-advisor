// API base URL resolution.
//
// Resolution order:
//
//   1. `REACT_APP_API_BASE_URL` — the explicit, build-time override. Honoured on
//      EVERY host, dev and production. Set it only when the API genuinely lives
//      on a different origin from the served app; the value is baked into the
//      bundle at build time, so it must be the origin the *deployed* app will
//      talk to. If it is cross-origin, that origin must also be in the
//      backend's CORS allowlist (`CORS_ORIGINS`, lane E) or every request will
//      be rejected.
//   2. Same-origin ('') in production. The app is served behind Caddy → nginx,
//      which proxies `/api/*` to the backend, so a same-origin base makes the
//      app work on ANY domain it is served from (mera-tax.com, a future
//      meratax.pk, a preview host) with no rebuild and no leak of another host.
//      This is the right default and should stay the default.
//   3. `REACT_APP_API_URL` (legacy) on localhost only, else `http://localhost:3001`.
//
// Why the legacy var is deliberately NOT honoured in production: the shipped
// bundle was found baking in an `api.<old-staging-host>` origin whose DNS had
// since been re-pointed, because the compose file still passed that value as a
// build arg. A stale build arg must never be able to steer the deployed app at
// an unreachable host. `REACT_APP_API_BASE_URL` is a new name precisely so that
// honouring it cannot resurrect an old value: it has to be set deliberately.
//
// NOTE (outside this lane): to actually set `REACT_APP_API_BASE_URL` at image
// build time, `Frontend/Dockerfile` needs a matching `ARG`/`ENV` pair and
// `docker-compose*.yml` needs to pass it through. Neither is edited here.

const isLocalHost =
  typeof window !== 'undefined' &&
  /^(localhost|127\.0\.0\.1|\[?::1\]?)$/.test(window.location.hostname);

// Trailing slashes would produce '//api/...' once callers append their path.
const trimTrailingSlash = (value) => value.replace(/\/+$/, '');

const resolveApiBase = () => {
  const explicit = (process.env.REACT_APP_API_BASE_URL || '').trim();
  if (explicit) {
    if (!/^https?:\/\//i.test(explicit)) {
      // Fail loudly rather than silently issuing requests to a relative path
      // that happens to look like a host.
      // eslint-disable-next-line no-console
      console.error(
        `[apiBase] REACT_APP_API_BASE_URL must be an absolute http(s) URL; got "${explicit}". Falling back to same-origin.`
      );
    } else {
      return trimTrailingSlash(explicit);
    }
  }

  if (isLocalHost) {
    const legacy = (process.env.REACT_APP_API_URL || '').trim();
    return trimTrailingSlash(legacy || 'http://localhost:3001');
  }

  return ''; // same-origin in production
};

export const API_BASE = resolveApiBase();
