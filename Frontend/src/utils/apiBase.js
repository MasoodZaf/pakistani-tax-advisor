// API base URL resolution.
//
// In PRODUCTION the app is served same-origin behind Caddy → nginx, which
// proxies `/api/*` to the backend. Using a same-origin base ('') makes the app
// work on ANY domain it is served from (mera-tax.com, tax.aurmak.com, …) and
// keeps the live domain fully self-contained — no hard dependency on, or leak
// of, another host. In local development we point at the dev backend.
//
// `REACT_APP_API_URL` is only honoured on localhost (dev). In prod it is
// intentionally ignored in favour of same-origin, so a stale baked-in value
// (e.g. an old api.<staging> host) can never override the served domain.
const isLocalHost =
  typeof window !== 'undefined' &&
  /^(localhost|127\.0\.0\.1|\[?::1\]?)$/.test(window.location.hostname);

export const API_BASE = isLocalHost
  ? ((process.env.REACT_APP_API_URL || '').trim() || 'http://localhost:3001')
  : ''; // same-origin in production
