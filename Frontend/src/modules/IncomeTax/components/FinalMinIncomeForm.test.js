/**
 * Characterization + guard test for FinalMinIncomeForm.
 *
 * This form drives compliance-critical final/minimum-tax math, including the
 * ATL x2 rule: a non-filer pays exactly double the filer final-tax rate on
 * every line (FBR Tax Card 2025-26). PERF-02 refactors this form's re-render
 * model (controlled inputs -> per-row self-subscription); this test locks the
 * behaviour that MUST NOT change across that refactor:
 *
 *   1. Typing an amount auto-calculates tax chargeable = amount x filer-rate.
 *   2. Toggling to Non-filer doubles it (amount x 2 x filer-rate).
 *   3. The grand total reflects the sum of tax chargeable.
 *   4. Submitting persists grand_total_tax_chargeable.
 *
 * It was written against the pre-refactor code and must stay green after.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FinalMinIncomeForm from './FinalMinIncomeForm';

// ── Mock the contexts/hooks the form pulls from ──────────────────────────────
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
    incomeProfile: { addons: ['dividends'] }, // unlocks the dividend rows
  }),
}));
jest.mock('../../../contexts/TaxYearContext', () => ({
  useTaxYear: () => ({ currentTaxYear: '2025-26' }),
}));
jest.mock('../../../hooks/useTaxRates', () => ({
  useTaxRates: () => ({
    rates: {
      slabs: [{ min_income: 0, max_income: 600000, tax_rate: 0 }],
      surcharge: { rate: 0.09, threshold: 10000000 },
      finalTax: {}, // empty -> resolveFinalTaxRate falls back to field.taxRate (0.35)
    },
  }),
}));

// The lime value <p> in the grand-total row. Subtotal shows the same number
// when only one row is filled, so target the grand-total cell specifically.
function grandTotalText() {
  return screen
    .getByText('Grand total tax chargeable')
    .closest('div.flex')
    .querySelector('p.text-lime').textContent;
}

beforeEach(() => {
  mockFormData = { final_min_income: {}, income: {}, capital_gain: {} };
  mockSaveFormStep.mockClear();
});

test('ATL x2 final-tax: filer rate, then doubled for non-filer, flows to grand total', async () => {
  render(<FinalMinIncomeForm />);

  const amountInput = screen.getByLabelText(/@35%.*amount$/i);
  await userEvent.clear(amountInput);
  await userEvent.type(amountInput, '100000');
  fireEvent.blur(amountInput);

  // Filer (default ATL=true): tax chargeable = 100000 x 0.35 = 35,000.
  await waitFor(() => expect(grandTotalText()).toMatch(/35,000/));

  // Toggle to Non-filer -> ATL x2 -> 100000 x 0.70 = 70,000.
  await userEvent.click(screen.getByRole('button', { name: /Non-filer/i }));
  await waitFor(() => expect(grandTotalText()).toMatch(/70,000/));
});

test('submitting persists the computed grand_total_tax_chargeable', async () => {
  render(<FinalMinIncomeForm />);
  const amountInput = screen.getByLabelText(/@35%.*amount$/i);
  await userEvent.clear(amountInput);
  await userEvent.type(amountInput, '100000');
  fireEvent.blur(amountInput);

  await waitFor(() => expect(grandTotalText()).toMatch(/35,000/));

  await userEvent.click(screen.getByRole('button', { name: /Complete & next/i }));

  await waitFor(() => expect(mockSaveFormStep).toHaveBeenCalled());
  const [step, payload] = mockSaveFormStep.mock.calls[0];
  expect(step).toBe('final_min_income');
  expect(payload.grand_total_tax_chargeable).toBe(35000);
});
