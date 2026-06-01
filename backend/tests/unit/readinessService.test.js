/**
 * Unit tests for readinessService — the pre-submit gate.
 *
 * The top-level `checkReadiness` function is DB-dependent (queries every
 * form table). The individual check functions are pure and exported via
 * `_internal` for unit testing. We exercise those directly so the rules
 * are pinned without needing postgres.
 */

jest.mock('../../src/config/database', () => ({ pool: {} }));

const { _internal } = require('../../src/services/readinessService');
const {
  checkUserIdentity, checkIncomeForm, checkAdjustableTax,
  checkCapitalGain, checkWealth, checkExpenses, checkAlreadySubmitted,
} = _internal;

const errorOf  = (issues, code) => issues.find((i) => i.severity === 'error'   && i.code === code);
const warnOf   = (issues, code) => issues.find((i) => i.severity === 'warning' && i.code === code);

describe('readinessService — individual checks', () => {

  // ── User identity ──────────────────────────────────────────────────────────
  describe('checkUserIdentity', () => {
    test('user not loaded → blocking error', () => {
      const issues = checkUserIdentity(null);
      expect(errorOf(issues, 'USER_NOT_FOUND')).toBeDefined();
    });

    test('missing name → blocking error', () => {
      const issues = checkUserIdentity({ id: 'u', email: 'a@b.c', name: '' });
      expect(errorOf(issues, 'NAME_MISSING')).toBeDefined();
    });

    test('valid CNIC formats are accepted (with and without dashes)', () => {
      expect(checkUserIdentity({ name: 'X', cnic: '12345-1234567-1' })).toEqual([]);
      expect(checkUserIdentity({ name: 'X', cnic: '4220123456789' })).toEqual([]);
    });

    test('invalid CNIC → blocking error', () => {
      const issues = checkUserIdentity({ name: 'X', cnic: '123-456' });
      expect(errorOf(issues, 'CNIC_INVALID')).toBeDefined();
    });

    test('missing CNIC and NTN are tolerated (not enforced at submit time yet)', () => {
      // The legacy onboarding flow doesn't always capture CNIC/NTN. Don't
      // block existing users — only flag mis-formatted values they've typed.
      expect(checkUserIdentity({ name: 'X' })).toEqual([]);
    });
  });

  // ── Income form ────────────────────────────────────────────────────────────
  describe('checkIncomeForm', () => {
    test('missing income form → blocking error', () => {
      const issues = checkIncomeForm(null);
      expect(errorOf(issues, 'INCOME_FORM_MISSING')).toBeDefined();
    });

    test('present income form with non-negative numbers → no issues', () => {
      const issues = checkIncomeForm({
        annual_basic_salary: 1000000, allowances: 0, bonus: 0,
        taxable_car_value: 0, other_taxable_subsidies: 0,
        profit_on_debt_15_percent: 0, profit_on_debt_12_5_percent: 0,
      });
      expect(issues).toEqual([]);
    });

    test('negative income value → blocking error', () => {
      const issues = checkIncomeForm({ annual_basic_salary: -500 });
      expect(errorOf(issues, 'INCOME_NEGATIVE_VALUE')).toBeDefined();
    });
  });

  // ── Adjustable Tax ─────────────────────────────────────────────────────────
  describe('checkAdjustableTax', () => {
    test('AT salary gross drift from Income → warning', () => {
      const issues = checkAdjustableTax(
        { annual_salary_wages_total: 1000000 },
        { salary_employees_149_gross_receipt: 950000 }
      );
      expect(warnOf(issues, 'AT_SALARY_GROSS_DRIFT')).toBeDefined();
    });

    test('AT tax exceeding gross receipt → blocking error', () => {
      const issues = checkAdjustableTax(
        { annual_salary_wages_total: 1000000 },
        { salary_employees_149_gross_receipt: 1000000,
          salary_employees_149_tax_collected: 1500000 }
      );
      expect(errorOf(issues, 'AT_TAX_EXCEEDS_GROSS')).toBeDefined();
    });

    test('clean AT data → no issues', () => {
      const issues = checkAdjustableTax(
        { annual_salary_wages_total: 1000000 },
        { salary_employees_149_gross_receipt: 1000000,
          salary_employees_149_tax_collected: 100000 }
      );
      expect(issues).toEqual([]);
    });

    test('absent AT row is silently OK (form not yet filled)', () => {
      expect(checkAdjustableTax({}, null)).toEqual([]);
    });
  });

  // ── Capital Gain ───────────────────────────────────────────────────────────
  describe('checkCapitalGain', () => {
    // The per-bucket drift check was retired (audit BE-04). Migration phase-u
    // dropped the legacy bucket columns (property_1_year, property_2_3_years,
    // securities, other_capital_gains, total_capital_gains) and re-added
    // total_capital_gain as a GENERATED ALWAYS AS (...) STORED column summed
    // from the surviving immovable_property_*_taxable / securities_*_taxable
    // families — so the declared total can no longer drift from its components
    // and there is nothing to verify. (Reading the old column names here also
    // silently produced 0, making the check a permanent no-op.)
    test('returns no issues — drift check retired, total is DB-generated', () => {
      const issues = checkCapitalGain({
        immovable_property_2_years_taxable: 500000,
        securities_15_percent_taxable: 1000000,
        total_capital_gain: 1500000,
      });
      expect(issues).toEqual([]);
    });

    test('matched totals → no issues', () => {
      const issues = checkCapitalGain({
        immovable_property_2_years_taxable: 500000,
        securities_15_percent_taxable: 1000000,
        total_capital_gain: 1500000,
      });
      expect(issues).toEqual([]);
    });
  });

  // ── Wealth + Reconciliation ────────────────────────────────────────────────
  describe('checkWealth', () => {
    test('missing wealth_reconciliation → blocking error', () => {
      const issues = checkWealth(null, null);
      expect(errorOf(issues, 'WEALTH_RECON_MISSING')).toBeDefined();
    });

    test('non-zero unreconciled_difference → blocking error (the #1 FBR rejection)', () => {
      const issues = checkWealth(null, { unreconciled_difference: 50000 });
      expect(errorOf(issues, 'WEALTH_RECON_UNBALANCED')).toBeDefined();
    });

    test('balanced reconciliation → no error', () => {
      const issues = checkWealth(null, { unreconciled_difference: 0 });
      expect(issues.filter((i) => i.severity === 'error')).toEqual([]);
    });

    test('net-assets drift between wealth statement and reconciliation → warning', () => {
      const wealth = {
        total_assets_current_year: 10000000, total_liabilities_current_year: 1000000,
        total_assets_previous_year: 8000000, total_liabilities_previous_year: 1000000,
      };
      const recon = {
        unreconciled_difference: 0,
        net_assets_current_year: 8000000, // wrong: should be 9m
        net_assets_previous_year: 7000000,
      };
      const issues = checkWealth(wealth, recon);
      expect(issues.filter((i) => i.code === 'WEALTH_NET_ASSETS_DRIFT').length).toBeGreaterThan(0);
    });
  });

  // ── Expenses ───────────────────────────────────────────────────────────────
  describe('checkExpenses', () => {
    test('expenses > 1.5x income → warning', () => {
      const issues = checkExpenses(
        { total_expenses: 5000000 },
        { total_employment_income: 2000000, other_income_min_tax_total: 0, other_income_no_min_tax_total: 0 }
      );
      expect(warnOf(issues, 'EXPENSES_EXCEED_INCOME')).toBeDefined();
    });

    test('expenses within bounds → no issues', () => {
      const issues = checkExpenses(
        { total_expenses: 1000000 },
        { total_employment_income: 2000000, other_income_min_tax_total: 0, other_income_no_min_tax_total: 0 }
      );
      expect(issues).toEqual([]);
    });
  });

  // ── Already submitted ──────────────────────────────────────────────────────
  describe('checkAlreadySubmitted', () => {
    test('submitted return → blocking error preventing re-submission', () => {
      const issues = checkAlreadySubmitted({
        filing_status: 'submitted',
        submission_date: '2026-04-20',
      });
      expect(errorOf(issues, 'ALREADY_SUBMITTED')).toBeDefined();
    });

    test('draft return → no issues', () => {
      expect(checkAlreadySubmitted({ filing_status: 'draft' })).toEqual([]);
    });

    test('null return → no issues (no record to block on)', () => {
      expect(checkAlreadySubmitted(null)).toEqual([]);
    });
  });
});
