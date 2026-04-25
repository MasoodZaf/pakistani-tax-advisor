/**
 * Unit tests for CalculationService.calculateProgressiveTax.
 *
 * These are pure-function tests — no DB. They feed slab data inline so they
 * catch regressions in the slab-walk algorithm regardless of what the DB says.
 * A separate integration suite tests the DB-loaded values.
 */

const CalculationService = require('../../src/services/calculationService');

// Canonical FA 2025 salaried-individual slabs — same shape as tax_slabs DB rows.
// Boundary values reflect the DB's "starts-at" convention (see phase-B notes).
const FA2025_SLABS = [
  { min_income: 0,       max_income: 600000,   tax_rate: 0.00 },
  { min_income: 600001,  max_income: 1200000,  tax_rate: 0.01 },
  { min_income: 1200001, max_income: 2200000,  tax_rate: 0.11 },
  { min_income: 2200001, max_income: 3200000,  tax_rate: 0.23 },
  { min_income: 3200001, max_income: 4100000,  tax_rate: 0.30 },
  { min_income: 4100001, max_income: null,     tax_rate: 0.35 },
];

// TY 2024-25 (pre-FA-2025): verifies slab changes between years resolve correctly.
const FA2024_SLABS = [
  { min_income: 0,       max_income: 600000,   tax_rate: 0.00 },
  { min_income: 600001,  max_income: 1200000,  tax_rate: 0.05 },
  { min_income: 1200001, max_income: 2200000,  tax_rate: 0.15 },
  { min_income: 2200001, max_income: 3200000,  tax_rate: 0.25 },
  { min_income: 3200001, max_income: 4100000,  tax_rate: 0.30 },
  { min_income: 4100001, max_income: null,     tax_rate: 0.35 },
];

describe('CalculationService.calculateProgressiveTax — FA 2025', () => {
  test.each([
    [0,         0],
    [300000,    0],
    [600000,    0],
    [600001,    0],    // Slab boundary — still effectively untaxed at Rs 1.
    [900000,    3000],  // 1% of 300k above 600k.
    [1200000,   6000],
    [1500000,   39000], // 6k + 11% × 300k.
    [2200000,   116000],
    [3200000,   346000],
    [4100000,   616000],
    [5000000,   931000],
    [10000000,  2681000],
    [15000000,  4431000],
    [100000000, 34181000],
  ])('taxableIncome=%i → %i', (income, expected) => {
    expect(CalculationService.calculateProgressiveTax(income, FA2025_SLABS)).toBe(expected);
  });

  test('zero and negative income returns 0', () => {
    expect(CalculationService.calculateProgressiveTax(0, FA2025_SLABS)).toBe(0);
    expect(CalculationService.calculateProgressiveTax(-5000, FA2025_SLABS)).toBe(0);
  });

  test('empty slab list returns 0', () => {
    expect(CalculationService.calculateProgressiveTax(1000000, [])).toBe(0);
    expect(CalculationService.calculateProgressiveTax(1000000, null)).toBe(0);
  });

  test('FA 2024 slabs produce different tax for same income (5% vs 1%)', () => {
    const income = 1200000;
    const fa2025 = CalculationService.calculateProgressiveTax(income, FA2025_SLABS);
    const fa2024 = CalculationService.calculateProgressiveTax(income, FA2024_SLABS);
    expect(fa2025).toBe(6000);   // 1% × 600k
    expect(fa2024).toBe(30000);  // 5% × 600k
    expect(fa2024).toBeGreaterThan(fa2025);
  });

  test('slabs unsorted in input are handled correctly', () => {
    const shuffled = [...FA2025_SLABS].reverse();
    expect(CalculationService.calculateProgressiveTax(5000000, shuffled)).toBe(931000);
  });

  test('rate as string (from pg numeric) is coerced correctly', () => {
    const stringRates = FA2025_SLABS.map((s) => ({
      min_income: String(s.min_income),
      max_income: s.max_income === null ? null : String(s.max_income),
      tax_rate: String(s.tax_rate),
    }));
    expect(CalculationService.calculateProgressiveTax(5000000, stringRates)).toBe(931000);
  });
});
