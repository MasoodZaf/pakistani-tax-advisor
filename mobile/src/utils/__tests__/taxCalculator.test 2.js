import { MobileTaxCalculator } from '../taxCalculator';

/**
 * Golden-value contract test for the offline mobile tax calculator.
 *
 * These expected values are computed independently from the Finance Act 2025
 * salaried-individual slabs (0/1/11/23/30/35 %) and MUST equal what the backend
 * taxCalculationService produces. They guard against the stale-rate regression
 * caught in the audit (TEST-01) where the mobile table shipped the FA-2024
 * rates (5/15/25 %) and over-stated tax by tens of thousands of rupees.
 *
 * If the Finance Act changes the slabs, update the backend seed AND this table
 * together (or, better, fetch rates from /api/tax-year so this fallback can be
 * removed entirely).
 */
describe('MobileTaxCalculator — FA-2025 salaried slabs', () => {
  const tax = (income) => MobileTaxCalculator.calculateProgressiveTax(income).totalTax;

  test('zero / below-threshold income is untaxed', () => {
    expect(tax(0)).toBe(0);
    expect(tax(600000)).toBe(0);
  });

  test('matches backend golden values across the slabs', () => {
    expect(tax(1200000)).toBe(6000);      // 600k @ 1%
    expect(tax(2200000)).toBe(116000);    // +1M @ 11%
    expect(tax(2500000)).toBe(185000);    // +300k @ 23%  (audit reference case)
    expect(tax(3200000)).toBe(346000);    // +1M @ 23%
    expect(tax(4100000)).toBe(616000);    // +900k @ 30%
    expect(tax(7200000)).toBe(1701000);   // +3.1M @ 35% (live-verified figure)
  });

  test('does NOT use the stale FA-2024 rates (regression guard)', () => {
    // Under the old 5/15/25 % table, 2.5M produced 255,000. The correct
    // FA-2025 figure is 185,000. Assert we are not back on the old rates.
    expect(tax(2500000)).not.toBe(255000);
  });

  test('applies the 10% surcharge above Rs 10,000,000', () => {
    const slabTaxAt12M = 6000 + 110000 + 230000 + 270000 + 0.35 * (12000000 - 4100000); // 3,381,000
    const withSurcharge = slabTaxAt12M + Math.round(slabTaxAt12M * 0.10);
    expect(tax(12000000)).toBe(withSurcharge);
    const r = MobileTaxCalculator.calculateProgressiveTax(12000000);
    expect(r.surcharge).toBe(Math.round(slabTaxAt12M * 0.10));
    // No surcharge at/under the threshold.
    expect(MobileTaxCalculator.calculateProgressiveTax(10000000).surcharge).toBe(0);
  });
});
