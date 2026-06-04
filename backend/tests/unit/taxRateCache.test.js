/**
 * PERF-03 regression: getAllRates caches the assembled bundle per tax year so
 * repeat computes within the TTL don't re-fire the ~9-SELECT burst, and
 * purgeCache() forces a fresh load.
 */

const mockQuery = jest.fn();
jest.mock('../../src/config/database', () => ({ pool: { query: (...a) => mockQuery(...a) } }));
jest.mock('../../src/utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const TaxRateService = require('../../src/services/taxRateService');

// A row shaped to satisfy every getter (slabs, single-rate, rate-set, brackets).
const ROW = {
  id: 'ty-uuid', tax_rate: '0.10', min_amount: '0', max_amount: '0', fixed_amount: '0',
  min_income: '0', max_income: '0', rate_category: 'cat', description: 'd',
};

beforeEach(() => {
  mockQuery.mockReset();
  mockQuery.mockResolvedValue({ rows: [ROW] });
  TaxRateService.purgeCache(); // clean slate between tests
});

test('second getAllRates within TTL hits cache (no further DB queries)', async () => {
  await TaxRateService.getAllRates('2025-26');
  const afterFirst = mockQuery.mock.calls.length;
  expect(afterFirst).toBeGreaterThan(0);

  await TaxRateService.getAllRates('2025-26');
  expect(mockQuery.mock.calls.length).toBe(afterFirst); // unchanged → served from cache
});

test('purgeCache forces a fresh load', async () => {
  await TaxRateService.getAllRates('2025-26');
  const afterFirst = mockQuery.mock.calls.length;

  TaxRateService.purgeCache('2025-26');
  await TaxRateService.getAllRates('2025-26');
  expect(mockQuery.mock.calls.length).toBeGreaterThan(afterFirst); // re-queried
});

test('different tax years are cached independently', async () => {
  await TaxRateService.getAllRates('2025-26');
  const afterFirst = mockQuery.mock.calls.length;
  await TaxRateService.getAllRates('2024-25'); // different key → must query
  expect(mockQuery.mock.calls.length).toBeGreaterThan(afterFirst);
});
