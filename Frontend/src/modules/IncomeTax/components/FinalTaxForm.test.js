/**
 * Characterization + guard test for FinalTaxForm.
 *
 * FinalTaxForm taxes income at fixed final-tax rates. For every non-manual
 * FINAL_TAX_ITEM the headless <FinalTaxAutoCalc> effect computes
 *   tax = Math.round(amount * rates.finalTax[item.id].rate)
 * and writes it into the (read-only) tax input via setValue. This test proves
 * that auto-calculation works:
 *
 *   1. Typing a gross amount into a final-tax item's amount input makes its
 *      tax input show amount × rate (NOT 0).
 *   2. Changing the amount recomputes the tax.
 *
 * Item used: prize_bond_winnings (u/s 156), rate mocked at 0.15.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FinalTaxForm from './FinalTaxForm';

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
    incomeProfile: { addons: [] },
  }),
}));
jest.mock('../../../contexts/TaxYearContext', () => ({
  useTaxYear: () => ({ currentTaxYear: '2025-26' }),
}));
jest.mock('../../../hooks/useTaxRates', () => ({
  useTaxRates: () => ({
    rates: {
      // FinalTaxAutoCalc reads rates.finalTax[item.id].rate
      finalTax: {
        prize_bond_winnings: { rate: 0.15 },
      },
    },
  }),
}));

beforeEach(() => {
  mockFormData = { final_tax: {} };
  mockSaveFormStep.mockClear();
});

test('typing a gross amount auto-calculates the final tax at the configured rate', async () => {
  const { container } = render(<FinalTaxForm />);

  // Inputs use react-hook-form register, so setValue updates the DOM input;
  // we read input.value. Fields are keyed by id == amountField/taxField.
  const amountInput = container.querySelector('#prize_bond_winnings_amount');
  const taxInput = container.querySelector('#prize_bond_winnings_tax');
  expect(amountInput).toBeTruthy();
  expect(taxInput).toBeTruthy();

  await userEvent.type(amountInput, '10000');
  fireEvent.blur(amountInput);

  // 10000 * 0.15 = 1500 (not 0)
  await waitFor(() => expect(taxInput.value).toBe('1500'));
  expect(taxInput.value).not.toBe('0');
});

test('changing the gross amount recomputes the final tax', async () => {
  const { container } = render(<FinalTaxForm />);

  const amountInput = container.querySelector('#prize_bond_winnings_amount');
  const taxInput = container.querySelector('#prize_bond_winnings_tax');

  await userEvent.type(amountInput, '10000');
  fireEvent.blur(amountInput);
  await waitFor(() => expect(taxInput.value).toBe('1500'));

  // Replace 10000 -> 20000; tax must recompute to 3000.
  await userEvent.clear(amountInput);
  await userEvent.type(amountInput, '20000');
  fireEvent.blur(amountInput);

  await waitFor(() => expect(taxInput.value).toBe('3000'));
});
