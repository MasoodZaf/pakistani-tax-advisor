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
