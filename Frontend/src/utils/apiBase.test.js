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

test('localhost still points at the dev backend, and honours the legacy var', () => {
  expect(loadApiBase({ hostname: 'localhost' })).toBe('http://localhost:3001');
  expect(
    loadApiBase({ hostname: 'localhost', env: { REACT_APP_API_URL: 'http://localhost:4001' } })
  ).toBe('http://localhost:4001');
});
