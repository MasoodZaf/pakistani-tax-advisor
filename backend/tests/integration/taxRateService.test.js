/**
 * Integration tests for TaxRateService — these hit the real (dev) DB to verify
 * both that the service reads rates correctly AND that the seeded values are
 * the authoritative FA 2025 / TY 2024-25 numbers.
 *
 * Run:  npm test -- tests/integration
 * Requires DATABASE_URL / DB_* env vars set.
 */

require('dotenv').config();
const { pool } = require('../../src/config/database');
const TaxRateService = require('../../src/services/taxRateService');

afterAll(async () => {
  await pool.end();
});

describe('TaxRateService.listFilableYears', () => {
  test('returns TY 2025-26 as filable and current', async () => {
    const years = await TaxRateService.listFilableYears();
    const current = years.find((y) => y.tax_year === '2025-26');
    expect(current).toBeDefined();
    expect(current.is_current).toBe(true);
  });
});

describe('TaxRateService.getSurcharge', () => {
  test('FA 2025 surcharge is 9% over Rs 10M', async () => {
    const s = await TaxRateService.getSurcharge('2025-26');
    expect(s.rate).toBeCloseTo(0.09, 4);
    expect(s.threshold).toBe(10000000);
  });

  test('FA 2024 surcharge is 10% over Rs 10M', async () => {
    const s = await TaxRateService.getSurcharge('2024-25');
    expect(s.rate).toBeCloseTo(0.10, 4);
    expect(s.threshold).toBe(10000000);
  });

  test('unconfigured year throws', async () => {
    await expect(TaxRateService.getSurcharge('2099-00')).rejects.toThrow(/not configured/);
  });
});

describe('TaxRateService.calculateSuperTax', () => {
  test('below 150M threshold → 0', async () => {
    expect(await TaxRateService.calculateSuperTax('2025-26', 100000000)).toBe(0);
    expect(await TaxRateService.calculateSuperTax('2025-26', 150000000)).toBe(0);
  });

  test.each([
    [150000001, 1500000],   // tier_1: 1%
    [200000000, 2000000],   // tier_1: 1%
    [200000001, 4000000],   // tier_2: 2% (bracket transition)
    [300000000, 9000000],   // tier_3: 3%
    [500000001, 50000000],  // tier_7: 10%
  ])('income=%i → %i', async (income, expected) => {
    expect(await TaxRateService.calculateSuperTax('2025-26', income)).toBe(expected);
  });
});

describe('TaxRateService.calculateSurcharge', () => {
  test('income at/below threshold → 0', async () => {
    expect(await TaxRateService.calculateSurcharge('2025-26', 500000, 5000000)).toBe(0);
    expect(await TaxRateService.calculateSurcharge('2025-26', 500000, 10000000)).toBe(0);
  });

  test('above threshold → normalTax × rate', async () => {
    // 12M income, 1M base tax → 9% × 1M = 90k surcharge.
    expect(await TaxRateService.calculateSurcharge('2025-26', 1000000, 12000000)).toBe(90000);
  });

  test('zero normal tax → 0 surcharge', async () => {
    expect(await TaxRateService.calculateSurcharge('2025-26', 0, 12000000)).toBe(0);
  });
});

describe('TaxRateService.getCreditCaps', () => {
  test('FA 2025 donation cap is 30%, associate 15%, pension 20%', async () => {
    const caps = await TaxRateService.getCreditCaps('2025-26');
    expect(caps.donation_u61.rate).toBeCloseTo(0.30, 4);
    expect(caps.donation_u61_associate.rate).toBeCloseTo(0.15, 4);
    expect(caps.pension_u63.rate).toBeCloseTo(0.20, 4);
  });
});

describe('TaxRateService.getAllRates', () => {
  test('bundles all rate kinds for TY 2025-26', async () => {
    const r = await TaxRateService.getAllRates('2025-26');
    expect(r.slabs.length).toBeGreaterThan(0);
    expect(r.surcharge.rate).toBeCloseTo(0.09, 4);
    expect(r.superTax.length).toBeGreaterThanOrEqual(7);
    expect(r.creditCaps.donation_u61).toBeDefined();
    expect(r.deductionThresholds.prof_expenses_max_taxable_income.fixedAmount).toBe(1500000);
  });
});
