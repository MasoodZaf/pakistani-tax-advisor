/**
 * Auto-calculation guard test for DeductionsForm.
 *
 * The form auto-calculates the professional-expenses (POS u/s 60C) deduction
 * as MIN(5% of POS amount, 25% of taxable income), provided the taxpayer is
 * eligible (taxable income <= Rs 1.5M threshold). This test locks that the
 * "Total POS payments" input drives `professional_expenses_amount` to the
 * expected lower-of value (NOT 0).
 *
 * Mocking mirrors AdjustableTaxForm.test.js (react-router-dom, react-hot-toast,
 * TaxFormContext useTaxForm, TaxYearContext useTaxYear, useTaxRates), adapted to
 * what DeductionsForm consumes (rates.deductionThresholds.*, formData.income).
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DeductionsForm from './DeductionsForm';

const mockSaveFormStep = jest.fn().mockResolvedValue(true);
const mockGetStepData = jest.fn(() => ({}));
let mockFormData = {};

// Avoid pulling axios (and its network init) through the mobile widget.
jest.mock('../../../components/MobileExpenses/MobileExpensesWidget', () => () => null);

jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn() }));
jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }));
jest.mock('../../../contexts/TaxFormContext', () => ({
  useTaxForm: () => ({
    saveFormStep: mockSaveFormStep,
    getStepData: mockGetStepData,
    formData: mockFormData,
    saving: false,
    incomeProfile: { addons: [] },
  }),
}));
jest.mock('../../../contexts/TaxYearContext', () => ({
  useTaxYear: () => ({ currentTaxYear: '2025-26' }),
}));
jest.mock('../../../hooks/useTaxRates', () => ({
  useTaxRates: () => ({
    rates: {
      deductionThresholds: {
        prof_expenses_max_taxable_income: { fixedAmount: 1500000 },
        prof_expenses_pos_amount_pct: { rate: 0.05 },
        prof_expenses_taxable_income_pct: { rate: 0.25 },
        education_max_taxable_income: { fixedAmount: 1500000 },
        education_per_child_cap: { fixedAmount: 60000 },
        education_max_children: { fixedAmount: 2 },
      },
    },
  }),
}));

beforeEach(() => {
  // taxableIncome = total_employment_income (1,000,000) -> eligible (<= 1.5M).
  mockFormData = {
    deductions: {},
    income: { total_employment_income: 1000000 },
  };
  mockSaveFormStep.mockClear();
});

test('typing a POS amount auto-fills professional_expenses_amount to the lower-of value', async () => {
  const { container } = render(<DeductionsForm />);

  // POS = 400,000.  posCapped = 400,000 * 0.05 = 20,000.
  // incomeCapped = 1,000,000 * 0.25 = 250,000.  MIN = 20,000.
  const posInput = container.querySelector('#professional_expenses_pos_amount');
  expect(posInput).not.toBeNull(); // row visible => eligible
  await userEvent.type(posInput, '400000');

  const deductionInput = container.querySelector('input[name="professional_expenses_amount"]');
  expect(deductionInput).not.toBeNull();

  await waitFor(() => {
    expect(Number(deductionInput.value)).toBe(20000);
  });
  expect(Number(deductionInput.value)).not.toBe(0);
});

/**
 * The s.60C / s.60D threshold is on TAXABLE income, not gross.
 *
 * Gross 1,600,000 with 200,000 of Zakat paid is taxable income of 1,400,000 —
 * the taxpayer IS eligible. The pre-fix form summed employment + other income
 * with nothing subtracted and denied both allowances outright.
 */
test('Zakat brings a gross-ineligible taxpayer back under the threshold', async () => {
  mockFormData = { deductions: {}, income: { total_employment_income: 1600000 } };
  const { container } = render(<DeductionsForm />);

  // Gross 1.6M → the POS sub-input is not rendered yet.
  expect(container.querySelector('#professional_expenses_pos_amount')).toBeNull();

  await userEvent.type(container.querySelector('#zakat_paid_amount'), '200000');

  await waitFor(() => {
    expect(container.querySelector('#professional_expenses_pos_amount')).not.toBeNull();
  });
});

/**
 * The statute says taxable income "less than" Rs 1,500,000. Exactly at the
 * threshold is NOT eligible; the pre-fix code used `<=`.
 */
test('exactly at the threshold is not eligible', async () => {
  mockFormData = { deductions: {}, income: { total_employment_income: 1500000 } };
  const { container } = render(<DeductionsForm />);

  expect(container.querySelector('#professional_expenses_pos_amount')).toBeNull();
  expect(screen.getAllByText(/not below the/i).length).toBeGreaterThan(0);
});

/**
 * The threshold base has to match the buckets the server charges the slabs on.
 * The pre-fix form read only `other_income_no_min_tax_total` and silently
 * dropped `other_income_min_tax_total`, so a taxpayer at 1,600,000 total looked
 * like 1,400,000 and was offered an allowance the server would refuse.
 */
test('minimum-tax other income counts toward the threshold', async () => {
  mockFormData = {
    deductions: {},
    income: { total_employment_income: 1400000, other_income_min_tax_total: 200000 },
  };
  const { container } = render(<DeductionsForm />);

  expect(container.querySelector('#professional_expenses_pos_amount')).toBeNull();
});

/**
 * The 25% s.60C cap is computed on taxable income too. Gross 1,400,000 less
 * 200,000 Zakat = 1,200,000 taxable → cap 300,000, not the 350,000 a gross
 * basis would allow. (Client-side preview only — the server is authoritative.)
 */
test('the 25% cap is computed on taxable income, not gross', async () => {
  mockFormData = { deductions: {}, income: { total_employment_income: 1400000 } };
  const { container } = render(<DeductionsForm />);

  await userEvent.type(container.querySelector('#zakat_paid_amount'), '200000');
  await userEvent.type(container.querySelector('#professional_expenses_pos_amount'), '10000000');

  const deductionInput = container.querySelector('input[name="professional_expenses_amount"]');
  await waitFor(() => {
    // min(5% × 10,000,000 = 500,000 ; 25% × 1,200,000 = 300,000)
    expect(Number(deductionInput.value)).toBe(300000);
  });
  expect(Number(deductionInput.value)).not.toBe(350000); // the gross-basis figure
});
