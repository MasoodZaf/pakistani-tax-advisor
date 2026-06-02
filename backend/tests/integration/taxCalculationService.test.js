/**
 * Integration tests for TaxCalculationService.previewTaxComputation.
 *
 * Verifies the full DB-rates → compute engine → breakdown pipeline against
 * FA 2025 golden values. This is the end-to-end regression suite for the
 * tax math users care about.
 */

require('dotenv').config();
const { pool } = require('../../src/config/database');
const TCS = require('../../src/services/taxCalculationService');

afterAll(async () => {
  await pool.end();
});

describe('previewTaxComputation — FA 2025 salaried individual', () => {
  test('Rs 5M salary → Rs 931,000 tax, no surcharge, no super-tax', async () => {
    const r = await TCS.previewTaxComputation('2025-26', {
      income: { annual_salary_wages_total: 5000000 },
    });
    expect(r.tax.normalIncomeTax).toBe(931000);
    expect(r.tax.surcharge).toBe(0);
    expect(r.tax.superTax).toBe(0);
    expect(r.tax.totalTaxChargeable).toBe(931000);
  });

  test('Rs 15M salary → normal 4.431M + surcharge 9% of that = 4.83M', async () => {
    const r = await TCS.previewTaxComputation('2025-26', {
      income: { annual_salary_wages_total: 15000000 },
    });
    expect(r.tax.normalIncomeTax).toBe(4431000);
    expect(r.tax.surcharge).toBe(398790); // Math.round(4431000 * 0.09)
    expect(r.tax.totalTaxBeforeAdjustments).toBe(4431000 + 398790);
    expect(r.tax.superTax).toBe(0);
  });

  test('Rs 175M salary → super-tax tier 1 (1%) = 1.75M', async () => {
    const r = await TCS.previewTaxComputation('2025-26', {
      income: { annual_salary_wages_total: 175000000 },
    });
    expect(r.tax.superTax).toBe(1750000);
  });

  test('Rs 200,000,001 salary → super-tax tier 2 (2%) = 4,000,000.02 → 4M rounded', async () => {
    const r = await TCS.previewTaxComputation('2025-26', {
      income: { annual_salary_wages_total: 200000001 },
    });
    expect(r.tax.superTax).toBe(4000000);
  });

  test('deductible allowances (zakat) reduce taxable income', async () => {
    const withoutZakat = await TCS.previewTaxComputation('2025-26', {
      income: { annual_salary_wages_total: 5000000 },
    });
    const withZakat = await TCS.previewTaxComputation('2025-26', {
      income: { annual_salary_wages_total: 5000000 },
      deductions: { zakat_paid_amount: 500000 },
    });
    // Zakat reduces the taxable base, so normal tax should go down.
    expect(withZakat.tax.normalIncomeTax).toBeLessThan(withoutZakat.tax.normalIncomeTax);
    expect(withZakat.income.deductibleAllowances).toBe(500000);
  });

  test('unconfigured tax year fails loudly', async () => {
    await expect(
      TCS.previewTaxComputation('2099-00', {
        income: { annual_salary_wages_total: 1000000 },
      })
    // Fails loudly — the exact message depends on which rate lookup trips first
    // (tax-year row, slabs, surcharge, credit caps…), so match either phrasing.
    ).rejects.toThrow(/not configured|configured for tax year/i);
  });
});

describe('previewTaxComputation — TY 2024-25 regression', () => {
  test('Rs 1.2M → 30k (5% slab, pre-FA-2025)', async () => {
    const r = await TCS.previewTaxComputation('2024-25', {
      income: { annual_salary_wages_total: 1200000 },
    });
    expect(r.tax.normalIncomeTax).toBe(30000);
  });

  test('Rs 15M → 10% surcharge (pre-FA-2025 rate)', async () => {
    const r = await TCS.previewTaxComputation('2024-25', {
      income: { annual_salary_wages_total: 15000000 },
    });
    // Normal tax FA 2024 on 15M = 30k + 15% × 1M + 25% × 1M + 30% × 900k + 35% × 10.9M
    //                            = 30k + 150k + 250k + 270k + 3,815k = 4,515k → 4,515,000
    // Surcharge = 10% × 4,515,000 = 451,500
    expect(r.tax.normalIncomeTax).toBe(4515000);
    expect(r.tax.surcharge).toBe(451500);
  });
});
