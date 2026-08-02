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
//   3. `REACT_APP_API_URL` (legacy) — honoured ONLY when the page is being
//      served from a localhost hostname AND the var is actually set. It is a
//      convenience for `npm start` against a backend on another port, nothing
//      more. It is never inferred and never has a default.
//
// Why the legacy var is deliberately NOT honoured in production: the shipped
// bundle was found baking in an `api.<old-staging-host>` origin whose DNS had
// since been re-pointed, because the compose file still passed that value as a
// build arg. A stale build arg must never be able to steer the deployed app at
// an unreachable host. `REACT_APP_API_BASE_URL` is a new name precisely so that
// honouring it cannot resurrect an old value: it has to be set deliberately.
//
// How the two interact: `REACT_APP_API_BASE_URL` wins everywhere and is the
// only knob that has any effect on a deployed host. `REACT_APP_API_URL` is
// strictly narrower — it is consulted only after the new var is found empty
// AND only on localhost, so a stale value inherited from an old build arg is
// inert in every environment that matters. Setting both is not an error; the
// new one simply takes precedence. New code and new environments should set
// `REACT_APP_API_BASE_URL`; the legacy var survives only so existing local dev
// setups keep working.
//
// R-04 — why there is no `http://localhost:3001` default any more:
// this file used to return that absolute URL for ANY localhost hostname with
// no env var set. Port 3001 is PRODUCTION's backend on the shared box; staging
// is 3002. So a developer or QA engineer with a tunnel open was one hostname
// away from a staging browser session issuing writes against the production
// API — a cross-environment data-integrity hazard, not merely a broken login.
// A hostname is not evidence of which backend you meant. Same-origin is the
// only safe thing to infer; it is correct behind Caddy and on any preview
// host. Anything else must be stated out loud in the environment. Local `npm
// start` against a separately-run backend therefore needs one line in
// `Frontend/.env.local` — see the note at the bottom of this file.
//
// NOTE (outside this lane): to actually set `REACT_APP_API_BASE_URL` at image
// build time, `Frontend/Dockerfile` needs a matching `ARG`/`ENV` pair and
// `docker-compose*.yml` needs to pass it through. Neither is edited here.

const LOOPBACK_HOSTNAME = /^(localhost|127\.0\.0\.1|\[?::1\]?)$/;

const isLocalHost =
  typeof window !== 'undefined' &&
  LOOPBACK_HOSTNAME.test(window.location.hostname);

// Trailing slashes would produce '//api/...' once callers append their path.
const trimTrailingSlash = (value) => value.replace(/\/+$/, '');

const pointsAtLoopback = (absoluteUrl) => {
  try {
    return LOOPBACK_HOSTNAME.test(new URL(absoluteUrl).hostname);
  } catch {
    return false;
  }
};

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
    } else if (!isLocalHost && pointsAtLoopback(explicit)) {
      // Backstop for a build-arg default leaking into a deployed image.
      // `Frontend/Dockerfile` defaults REACT_APP_API_BASE_URL to
      // REACT_APP_API_URL, which itself defaults to http://localhost:3001 — so
      // an image built with neither variable set ships a bundle aimed at a
      // loopback port. Served from a real domain that is never right: it
      // resolves to whatever happens to be listening on the VIEWER's machine,
      // which on the shared box is production's backend on 3001 while the app
      // in front of it is staging. Refuse it rather than let a browser session
      // cross environments.
      // eslint-disable-next-line no-console
      console.error(
        `[apiBase] Ignoring REACT_APP_API_BASE_URL "${explicit}": a loopback API base cannot be correct for a page served from ${window.location.hostname}. Falling back to same-origin.`
      );
    } else {
      return trimTrailingSlash(explicit);
    }
  }

  // Local development only, and only when asked for explicitly. There is no
  // default port: an unset legacy var on localhost means same-origin, which is
  // what a dev-server proxy or a single-origin docker-compose already provides.
  if (isLocalHost) {
    const legacy = (process.env.REACT_APP_API_URL || '').trim();
    if (legacy) return trimTrailingSlash(legacy);
  }

  return ''; // same-origin — the default everywhere
};

export const API_BASE = resolveApiBase();

// Running `npm start` against a backend on another port? Put the port you
// actually mean in `Frontend/.env.local` (gitignored, never baked into an
// image):
//
//   REACT_APP_API_BASE_URL=http://localhost:3001   # local backend
//
// Deliberately not defaulted: 3001 is production's backend on the shared
// staging/prod box and 3002 is staging's. Guessing between them is how a
// staging session ends up writing to production.
