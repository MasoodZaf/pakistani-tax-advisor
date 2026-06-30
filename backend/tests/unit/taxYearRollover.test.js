/**
 * Regression: the rollover cron must NOT move `is_current` onto a tax year that
 * isn't active yet. Otherwise no row satisfies the app's
 * `is_current AND is_active` filing-year guard, which would break the
 * current-year lookup during the prior year's filing season (2025-26 returns
 * are filed Jul–Sep, AFTER the 2026-27 fiscal year has already started).
 * is_current advances only once an admin activates the new year.
 */

const mockConnect = jest.fn();
const mockPoolQuery = jest.fn();

jest.mock('../../src/config/database', () => ({
  pool: { connect: (...a) => mockConnect(...a), query: (...a) => mockPoolQuery(...a) },
}));
jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
}));
jest.mock('../../src/helpers/auditLog', () => ({ insertAudit: jest.fn().mockResolvedValue() }));

const { rolloverOnce } = require('../../src/services/cron/taxYearRollover');

// Fake client: the year-lookup SELECT returns `targetRow`; everything else is
// a no-op. Records each SQL string so tests can assert what ran.
function makeClient(targetRow) {
  const sqls = [];
  const query = jest.fn(async (sql) => {
    sqls.push(typeof sql === 'string' ? sql : '');
    if (/SELECT id, tax_year, is_current, is_active FROM tax_years WHERE tax_year/.test(sql)) {
      return { rows: [targetRow] };
    }
    return { rows: [] };
  });
  return { query, release: jest.fn(), sqls };
}

const JULY_2026 = new Date('2026-07-01T00:00:00Z'); // fiscal year 2026-27

beforeEach(() => {
  mockConnect.mockReset();
  mockPoolQuery.mockReset().mockResolvedValue({ rows: [] });
});

test('does NOT flip is_current onto an inactive new year (defers)', async () => {
  const client = makeClient({ id: 'ty-2026', tax_year: '2026-27', is_current: false, is_active: false });
  mockConnect.mockResolvedValue(client);

  const res = await rolloverOnce(JULY_2026);

  const flips = client.sqls.filter((s) => /SET is_current = true/.test(s));
  expect(flips).toHaveLength(0);       // no is_current flip
  expect(res.deferred).toBe(true);
  expect(res.changed).toBe(false);
});

test('flips is_current once the new year is active', async () => {
  const client = makeClient({ id: 'ty-2026', tax_year: '2026-27', is_current: false, is_active: true });
  mockConnect.mockResolvedValue(client);

  const res = await rolloverOnce(JULY_2026);

  const flips = client.sqls.filter((s) => /SET is_current = true/.test(s));
  expect(flips.length).toBeGreaterThan(0);
  expect(res.changed).toBe(true);
});

test('no-op when the target year is already current', async () => {
  const client = makeClient({ id: 'ty-2026', tax_year: '2026-27', is_current: true, is_active: true });
  mockConnect.mockResolvedValue(client);

  const res = await rolloverOnce(JULY_2026);

  const flips = client.sqls.filter((s) => /SET is_current = true/.test(s));
  expect(flips).toHaveLength(0);
  expect(res.changed).toBe(false);
});
