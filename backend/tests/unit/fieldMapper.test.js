/**
 * Unit tests for fieldMapper.js — the FBR-label → DB-column translator.
 *
 * Coverage measured against the canonical Salaried Individuals 2025
 * reference workbook at the repo root. Before Path B, only 3 of ~150
 * fields mapped; after Path B, ~95+ map.
 */

const fs   = require('fs');
const path = require('path');
const { parseExcelBuffer } = require('../../src/services/parsers/excelParser');
const { mapFields }        = require('../../src/services/parsers/fieldMapper');

const REFERENCE_PATH = path.resolve(
  __dirname, '..', '..', '..', 'Salaried Individuals 2025.xlsx'
);

describe('fieldMapper — FBR-label translation', () => {

  describe('basic semantics', () => {
    test('exact-string source matches case-insensitively', () => {
      const { mapped } = mapFields({ 'Annual Basic Salary': 1000 });
      expect(mapped.income.annual_basic_salary).toBe(1000);
    });

    test('snake_case shorthand also matches', () => {
      const { mapped } = mapFields({ annual_basic_salary: 2000 });
      expect(mapped.income.annual_basic_salary).toBe(2000);
    });

    test('regex source matches normalised key', () => {
      const { mapped } = mapFields({
        'Capital Gains on Securities u/s 37A @15%': 500,
      });
      expect(mapped.capital_gain.securities).toBe(500);
    });

    test('unmatched keys are returned in the unmatched bucket', () => {
      const { mapped, unmatched } = mapFields({
        'Annual Basic Salary': 1,
        'NIC':                 '420000000000',
      });
      expect(mapped.income.annual_basic_salary).toBe(1);
      expect(unmatched.NIC).toBe('420000000000');
    });

    test('a single source label can populate multiple (step, dst) pairs', () => {
      // "Directorship Fee u/s 149(3)" appears on both the Income and
      // Adjustable Tax sheets in the FBR template.
      const { mapped } = mapFields({ 'Directorship Fee u/s 149(3)': 40000 });
      expect(mapped.income.directorship_fee).toBe(40000);
      expect(mapped.adjustable_tax.directorship_fee_149_3_gross_receipt).toBe(40000);
    });
  });

  describe('coverage on the Salaried Individuals 2025 reference workbook', () => {
    if (!fs.existsSync(REFERENCE_PATH)) {
      // The reference file is committed at the repo root, but skip rather
      // than fail loudly if it's been moved or removed.
      test.skip('reference workbook not found, skipping coverage tests', () => {});
      return;
    }

    let raw;
    let mapped;
    let unmatched;

    beforeAll(async () => {
      const buf = fs.readFileSync(REFERENCE_PATH);
      raw = await parseExcelBuffer(buf);
      const result = mapFields(raw);
      mapped = result.mapped;
      unmatched = result.unmatched;
    });

    test('parser captures the expected number of label/value pairs', () => {
      // The reference has ~150 populated rows (taxpayer profile, all 9 form
      // sheets, and the calc output sheet). Pin a generous lower bound so a
      // future workbook revision doesn't trip the test for free.
      expect(Object.keys(raw).length).toBeGreaterThan(120);
    });

    test('mapper translates a substantial majority of input fields', () => {
      // Pre-Path-B baseline: 3/150 mapped. Post-Path-B: ~95+/150. Anchor at
      // 80 so we have headroom for incidental label tweaks but anything
      // catastrophic (e.g. a regression in normalise()) shows up loudly.
      let mappedTargets = 0;
      for (const step of Object.keys(mapped)) {
        mappedTargets += Object.keys(mapped[step]).length;
      }
      expect(mappedTargets).toBeGreaterThanOrEqual(80);
    });

    test('every primary form step has at least one mapped field', () => {
      // We expect coverage across all the user-facing form steps. (The
      // taxpayer profile and the Tax Computation output sheet don't count
      // — those aren't form inputs.)
      const requiredSteps = [
        'income', 'adjustable_tax', 'final_min_income',
        'capital_gain', 'reductions', 'credits', 'deductions',
        'expenses', 'wealth', 'wealth_reconciliation',
      ];
      const empty = requiredSteps.filter(
        (s) => !mapped[s] || Object.keys(mapped[s]).length === 0
      );
      expect(empty).toEqual([]);
    });

    test('headline labels resolve to the right DB columns', () => {
      // Spot-check a handful of known label → column pairs so a silent
      // regression in any single mapping surfaces here.
      expect(mapped.income.annual_basic_salary).toBe(7200000);
      expect(mapped.income.allowances).toBe(6000000);
      expect(mapped.income.bonus).toBe(1500000);
      expect(mapped.income.profit_on_debt_15_percent).toBe(700000);
      expect(mapped.expenses.travelling).toBe(2500000);
      expect(mapped.expenses.electricity).toBe(750000);
      expect(mapped.wealth_reconciliation.net_assets_current_year).toBe(36780000);
      expect(mapped.wealth_reconciliation.taxable_income).toBe(24060000);
    });

    test('unmatched bucket contains only profile / generated-total rows', () => {
      // Sanity: after all real fields are mapped, the leftovers should be
      // identifiable as either taxpayer profile (Name, NIC, Email, …) or
      // computed totals (Subtotal, Grand Total, Tax Computation outputs).
      // If a *real* user-input label slips into unmatched, the test should
      // surface it for review.
      const expectedCategories = [
        // Taxpayer profile
        'Name', 'NIC', 'Email', 'Mobile Phone Number/Service provider',
        'Major Source of Income', 'Description',
        // Generated totals / aggregates the parser still picks up
        'Total', 'Subtotal', 'Grand Total', 'Total Gapital Gain',
        'Capital Gain', 'Total Expensespaid by taxpayer',
        'Annual Salary and Wages', 'Total non cash benefits',
        'Other taxable income - Total',
        'Income Exempt from tax', 'Non cash benefit exempt from tax',
        // Tax Computation sheet — those are calc outputs, not inputs
        'Income from Salary', 'Other Income subject to minimum tax',
        'Income / (Loss) from Other Sources',
        'Deductible Allowances', 'Taxable Income excluding capital gains/(loss)',
        'Gains / (Loss) from Capital Assets',
        'Taxable Income including capital gains/(loss)',
        'Normal Income Tax',
        'Surcharge (10% of Income Tax where income exceed Rs 10m)',
        'Capital Gain Tax (CGT)',
        'Normal Income Tax including Surcharge and CGT',
        'Tax Reductions', 'Tax Credits',
        'Normal Income Tax after Tax Reduction/Credit',
        'Final / Fixed / Minimum / Average / Relevant / Reduced Income Tax',
        'Totlal Tax Chargeable',
        'Withholding Income Tax',
        'Refund Adjustment of Other Year(s) against Demand of this Year',
        'Total Taxes Paid/Adjusted', 'Income Tax Demanded /(Refundable)',
        'Total Deduction from Income', 'Total Tax Reduction',
        'Total Tax Credit',
        // Wealth statement aggregates
        'Total Assets inside Pakistan', 'Total Assets',
        'Total Liabilities', 'Net Assets at end of Tax Year',
      ];

      const expectedSet = new Set(expectedCategories.map((s) => s.toLowerCase().trim()));
      const surprises = Object.keys(unmatched).filter(
        (k) => !expectedSet.has(String(k).toLowerCase().trim())
      );

      // Whitelist a handful that aren't pure profile/total but are genuinely
      // out-of-scope for v1 mapper (long descriptive prose rows etc.).
      const tolerated = surprises.filter((k) => {
        const lower = String(k).toLowerCase();
        return (
          // Long FBR explanatory paragraphs (multi-sentence rows) — value
          // contains the same prose, not a number
          lower.includes('rebate at the average rate') ||
          lower.includes('donations to certain approved institutes') ||
          // Substring of the prose row above the Zakat input — probably has
          // an unusual character so we match a shorter unique fragment.
          (lower.startsWith('special straight') && lower.includes('zakat')) ||
          // Section header tokens with no input value
          lower === 'closing balance last year 30 jun 2024' ||
          // Rows where col B is the unit ("Amount in PKR") not a value
          lower === 'description'
        );
      });

      const realSurprises = surprises.filter((k) => !tolerated.includes(k));
      // If anything new shows up here, either add a mapper entry or extend
      // the expected/tolerated lists with justification.
      expect(realSurprises).toEqual([]);
    });
  });
});
