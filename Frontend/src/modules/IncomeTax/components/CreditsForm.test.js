/**
 * Auto-calculation test for CreditsForm.
 *
 * CreditsForm computes a "rebate at average rate" tax credit (ITO 2001 u/s 61,
 * 62, 63) in a headless <CreditsAutoCalc> effect:
 *
 *   credit       = round(eligible × avgRate)
 *   eligible     = MIN(actualAmount, taxableIncome × capPct)
 *   avgRate      = normalTax / taxableIncome
 *   taxableIncome= (income context, minus deductions)
 *   normalTax    = progressive walk over rates.slabs
 *   capPct       = rates.creditCaps.donation_u61.rate
 *
 * This test drives the always-visible "Charitable Donations u/s 61" row:
 * feeds a known taxableIncome + slab (=> normalTax + avgRate) and donation cap,
 * types a donation amount, and asserts the credit input auto-fills to the
 * computed value (NOT 0).
 *
 * Mocking mirrors AdjustableTaxForm.test.js (react-router-dom, react-hot-toast,
 * TaxFormContext useTaxForm, TaxYearContext useTaxYear, useTaxRates), adapted
 * to what CreditsForm consumes (formData income, rates.slabs, rates.creditCaps).
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CreditsForm from './CreditsForm';

const mockSaveFormStep = jest.fn().mockResolvedValue(true);
const mockGetStepData = jest.fn(() => ({}));
let mockFormData = {};

jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn() }));
jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }));
jest.mock('../../../contexts/TaxFormContext', () => ({
  useTaxForm: () => ({
    saveFormStep: mockSaveFormStep,
    getStepData: mockGetStepData,
    formData: mockFormData,
    saving: false,
    incomeProfile: { addons: [] }, // pure salaried -> charitable-donations row visible
  }),
}));
jest.mock('../../../contexts/TaxYearContext', () => ({
  useTaxYear: () => ({ currentTaxYear: '2025-26' }),
}));
jest.mock('../../../hooks/useTaxRates', () => ({
  useTaxRates: () => ({
    rates: {
      // Single flat 20% slab => normalTax = taxableIncome * 0.20, avgRate = 0.20.
      slabs: [{ min_income: 0, max_income: null, tax_rate: 0.2 }],
      creditCaps: {
        donation_u61: { rate: 0.3 },
        donation_u61_associate: { rate: 0.15 },
        pension_u63: { rate: 0.2 },
      },
    },
  }),
}));

beforeEach(() => {
  // taxableIncome = total_employment_income - total_deductions = 5,000,000 - 0
  mockFormData = {
    credits: {},
    income: { total_employment_income: 5000000 },
    deductions: {},
  };
  mockSaveFormStep.mockClear();
});

test('typing a donation amount auto-fills the charitable-donations credit at the average rate', async () => {
  const { container } = render(<CreditsForm />);

  // Confirm the context banner shows the derived figures (taxableIncome nonzero).
  expect(screen.getByText(/auto-calculated using a taxable income/i)).toBeInTheDocument();

  const amountInput = container.querySelector('#charitable_donations_amount');
  const creditInput = container.querySelector('#charitable_donations_tax_credit');
  expect(amountInput).toBeTruthy();
  expect(creditInput).toBeTruthy();

  // Inputs:
  //   donation amount = 1,000,000
  //   taxableIncome   = 5,000,000
  //   normalTax       = 5,000,000 * 0.20 = 1,000,000
  //   avgRate         = 1,000,000 / 5,000,000 = 0.20
  //   donationCap     = 0.30
  // Expected:
  //   cap amount = 5,000,000 * 0.30 = 1,500,000
  //   eligible   = MIN(1,000,000, 1,500,000) = 1,000,000
  //   credit     = round(1,000,000 * 0.20) = 200,000
  await userEvent.type(amountInput, '1000000');

  await waitFor(() => expect(creditInput.value).toBe('200000'));
  expect(creditInput.value).not.toBe('0');
});
