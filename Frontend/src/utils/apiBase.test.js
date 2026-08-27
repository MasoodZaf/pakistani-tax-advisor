/**
 * API base resolution.
 *
 * The shipped bundle was found baking in a dead API origin, so the deployed app
 * could not reach its own backend. These tests pin the resolution order and, in
 * particular, that a stale legacy `REACT_APP_API_URL` can never steer a
 * production build.
 *
 * `apiBase` resolves at module load, so every case re-imports it under
 * jest.isolateModules with the environment it is testing.
 */
const ORIGINAL_ENV = process.env;

const loadApiBase = ({ hostname, env = {} }) => {
  process.env = { ...ORIGINAL_ENV, ...env };
  delete window.location;
  window.location = { hostname };

  let API_BASE;
  jest.isolateModules(() => {
    // eslint-disable-next-line global-require
    ({ API_BASE } = require('./apiBase'));
  });
  return API_BASE;
};

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

test('defaults to same-origin in production so any served domain works', () => {
  expect(loadApiBase({ hostname: 'mera-tax.com' })).toBe('');
});

test('a stale legacy REACT_APP_API_URL cannot steer a production build', () => {
  expect(
    loadApiBase({
      hostname: 'mera-tax.com',
      env: { REACT_APP_API_URL: 'https://api.some-retired-host.example' },
    })
  ).toBe('');
});

test('REACT_APP_API_BASE_URL is honoured in production when set deliberately', () => {
  expect(
    loadApiBase({
      hostname: 'mera-tax.com',
      env: { REACT_APP_API_BASE_URL: 'https://api.mera-tax.com' },
    })
  ).toBe('https://api.mera-tax.com');
});

test('a trailing slash is trimmed so callers do not produce //api/...', () => {
  expect(
    loadApiBase({
      hostname: 'mera-tax.com',
      env: { REACT_APP_API_BASE_URL: 'https://api.mera-tax.com/' },
    })
  ).toBe('https://api.mera-tax.com');
});

test('a non-absolute override is rejected and falls back to same-origin', () => {
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
  expect(
    loadApiBase({ hostname: 'mera-tax.com', env: { REACT_APP_API_BASE_URL: 'api.mera-tax.com' } })
  ).toBe('');
  expect(spy).toHaveBeenCalled();
  spy.mockRestore();
});

// R-04: hostname must never imply a backend port.
//
// The old behaviour returned 'http://localhost:3001' for ANY loopback hostname
// with no env var set. On the shared box 3001 is PRODUCTION's backend and
// staging is 3002, so that default let a staging browser session reach the
// production API through a tunnel. Local dev is now opt-in, by env, per port.
describe('R-04 — no inferred backend port', () => {
  test.each(['localhost', '127.0.0.1', '::1'])(
    'a bare %s host falls back to same-origin, never to :3001',
    (hostname) => {
      const base = loadApiBase({ hostname });
      expect(base).toBe('');
      expect(base).not.toMatch(/3001/);
    }
  );

  test('local development is opt-in via REACT_APP_API_BASE_URL', () => {
    expect(
      loadApiBase({ hostname: 'localhost', env: { REACT_APP_API_BASE_URL: 'http://localhost:3002' } })
    ).toBe('http://localhost:3002');
  });

  test('the legacy REACT_APP_API_URL still works on localhost when explicitly set', () => {
    expect(
      loadApiBase({ hostname: 'localhost', env: { REACT_APP_API_URL: 'http://localhost:4001' } })
    ).toBe('http://localhost:4001');
  });

  test('REACT_APP_API_BASE_URL wins over the legacy var on localhost too', () => {
    expect(
      loadApiBase({
        hostname: 'localhost',
        env: {
          REACT_APP_API_BASE_URL: 'http://localhost:3002',
          REACT_APP_API_URL: 'http://localhost:3001',
        },
      })
    ).toBe('http://localhost:3002');
  });

  test('a loopback base leaked in by the Dockerfile default is refused on a real host', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    // Frontend/Dockerfile defaults REACT_APP_API_BASE_URL to REACT_APP_API_URL,
    // which defaults to http://localhost:3001 — an image built with neither set
    // must still not aim a deployed page at a loopback port.
    expect(
      loadApiBase({
        hostname: 'tax.aurmak.com',
        env: { REACT_APP_API_BASE_URL: 'http://localhost:3001' },
      })
    ).toBe('');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

/**
 * Same-site guard.
 *
 * These pin the 2026-08 production outage: the shipped bundle carried
 * `REACT_APP_API_BASE_URL=https://api.tax.aurmak.com` while being served from
 * mera-tax.com. That host was public and resolvable, so the loopback backstop
 * never fired — it had merely been repointed at an unrelated server. Login and
 * signup were dead for days while every health signal stayed green.
 */
describe('a cross-site API base cannot steer a deployed build', () => {
  const errorSpy = () => jest.spyOn(console, 'error').mockImplementation(() => {});

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('the exact outage: a retired domain falls back to same-origin', () => {
    const spy = errorSpy();
    expect(
      loadApiBase({
        hostname: 'mera-tax.com',
        env: { REACT_APP_API_BASE_URL: 'https://api.tax.aurmak.com' },
      })
    ).toBe('');
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('different site'));
  });

  test('a same-site API subdomain is still honoured (split-domain deploys)', () => {
    expect(
      loadApiBase({
        hostname: 'mera-tax.com',
        env: { REACT_APP_API_BASE_URL: 'https://api.mera-tax.com' },
      })
    ).toBe('https://api.mera-tax.com');
  });

  test('a same-site base is honoured from a subdomain page too', () => {
    expect(
      loadApiBase({
        hostname: 'staging.mera-tax.com',
        env: { REACT_APP_API_BASE_URL: 'https://api.mera-tax.com' },
      })
    ).toBe('https://api.mera-tax.com');
  });

  test('an exact hostname match is honoured', () => {
    expect(
      loadApiBase({
        hostname: 'mera-tax.com',
        env: { REACT_APP_API_BASE_URL: 'https://mera-tax.com' },
      })
    ).toBe('https://mera-tax.com');
  });

  test('a deliberate cross-site API is allowed only when opted in', () => {
    expect(
      loadApiBase({
        hostname: 'mera-tax.com',
        env: {
          REACT_APP_API_BASE_URL: 'https://api.example.net',
          REACT_APP_API_ALLOW_CROSS_SITE: 'true',
        },
      })
    ).toBe('https://api.example.net');
  });

  test('the opt-in must be exactly "true", not any truthy string', () => {
    errorSpy();
    expect(
      loadApiBase({
        hostname: 'mera-tax.com',
        env: {
          REACT_APP_API_BASE_URL: 'https://api.example.net',
          REACT_APP_API_ALLOW_CROSS_SITE: '1',
        },
      })
    ).toBe('');
  });

  test('localhost dev is unaffected — a cross-site base still works there', () => {
    expect(
      loadApiBase({
        hostname: 'localhost',
        env: { REACT_APP_API_BASE_URL: 'https://api.example.net' },
      })
    ).toBe('https://api.example.net');
  });
});
